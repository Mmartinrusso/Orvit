import React from "react";
import { View, Text, Image, Linking, ActionSheetIOS, Platform, Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import AudioPlayer from "@/components/AudioPlayer";
import ReactionPills from "@/components/ReactionPills";
import type { Message } from "@/types/chat";

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const SWIPE_THRESHOLD = 60; // px to trigger reply

// Consistent sender colors for group chats
const SENDER_COLORS = [
  "#25D366", "#00a884", "#53bdeb", "#e07c5c",
  "#7c5ce0", "#e05c8f", "#5ce0c4", "#e0c45c",
  "#5c8fe0", "#c45ce0", "#5ce07c", "#e0875c",
];

function getSenderColor(senderId: number): string {
  return SENDER_COLORS[senderId % SENDER_COLORS.length];
}

interface Props {
  message: Message;
  isMe: boolean;
  userId: number;
  onReply: (msg: Message) => void;
  onForward: (msg: Message) => void;
  onReaction: (msg: Message) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onEdit?: (msg: Message) => void;
  onDelete?: (msg: Message) => void;
  onImagePreview?: (url: string) => void;
  showSender?: boolean;
  highlighted?: boolean;
}

function MessageBubble({
  message,
  isMe,
  userId,
  onReply,
  onForward,
  onReaction,
  onToggleReaction,
  onEdit,
  onDelete,
  onImagePreview,
  showSender = true,
  highlighted = false,
}: Props) {
  const { colors, isDark } = useTheme();
  const translateX = useSharedValue(0);
  const replyIconOpacity = useSharedValue(0);
  const hasTriggered = useSharedValue(false);

  // ── Swipe to reply gesture ──
  const triggerReply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onReply(message);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX(20)
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      // Only allow swipe right
      if (e.translationX < 0) return;
      const clamped = Math.min(e.translationX, 100);
      translateX.value = clamped;
      replyIconOpacity.value = Math.min(clamped / SWIPE_THRESHOLD, 1);

      if (clamped >= SWIPE_THRESHOLD && !hasTriggered.value) {
        hasTriggered.value = true;
        runOnJS(triggerReply)();
      }
    })
    .onEnd(() => {
      translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      replyIconOpacity.value = withTiming(0, { duration: 150 });
      hasTriggered.value = false;
    });

  const bubbleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const replyIconStyle = useAnimatedStyle(() => ({
    opacity: replyIconOpacity.value,
    transform: [{ scale: replyIconOpacity.value }],
  }));

  // ── Long press menu (forward, react, copy, edit, delete) ──
  const handleLongPress = () => {
    if (message.isDeleted) return;

    const canEdit =
      isMe &&
      message.type === "text" &&
      Date.now() - new Date(message.createdAt).getTime() < EDIT_WINDOW_MS;

    const options: string[] = [];
    const actions: (() => void)[] = [];

    options.push("Reenviar");
    actions.push(() => onForward(message));

    options.push("Reaccionar");
    actions.push(() => onReaction(message));

    if (message.type === "text") {
      options.push("Copiar texto");
      actions.push(async () => {
        await Clipboard.setStringAsync(message.content);
      });
    }

    if (canEdit && onEdit) {
      options.push("Editar");
      actions.push(() => onEdit(message));
    }

    if (isMe && onDelete) {
      options.push("Eliminar");
      actions.push(() => onDelete(message));
    }

    options.push("Cancelar");

    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = isMe && onDelete
      ? options.indexOf("Eliminar")
      : undefined;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex, destructiveButtonIndex },
        (buttonIndex) => {
          if (buttonIndex !== cancelButtonIndex) {
            actions[buttonIndex]();
          }
        }
      );
    } else {
      const alertOptions = options
        .filter((_, i) => i !== cancelButtonIndex)
        .map((label, i) => ({
          text: label,
          onPress: () => actions[i](),
          style: (i === destructiveButtonIndex ? "destructive" : "default") as "destructive" | "default",
        }));
      alertOptions.push({ text: "Cancelar", onPress: () => {}, style: "default" });
      Alert.alert("Opciones", undefined, alertOptions);
    }
  };

  // System message
  if (message.type === "system") {
    return (
      <View style={{ alignItems: "center", marginVertical: 6 }}>
        <View
          style={{
            backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 5,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: isDark ? "rgba(233,237,239,0.6)" : "rgba(0,0,0,0.45)",
              textAlign: "center",
            }}
          >
            {message.content}
          </Text>
        </View>
      </View>
    );
  }

  const timeStr = new Date(message.createdAt).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const bubbleBg = isMe ? colors.bubbleMeBg : colors.bubbleOtherBg;
  const textColor = isMe ? colors.bubbleMeText : colors.bubbleOtherText;
  const timeColor = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)";
  const senderColor = message.sender
    ? getSenderColor(message.senderId ?? 0)
    : colors.primary;

  const hasReactions = message.reactions && message.reactions.length > 0;

  return (
    <View>
      {/* Reply icon that appears behind the bubble on swipe */}
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 8,
            top: 0,
            bottom: 0,
            justifyContent: "center",
            alignItems: "center",
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
            alignSelf: "center",
            marginTop: 8,
          },
          replyIconStyle,
        ]}
        pointerEvents="none"
      >
        <Ionicons name="arrow-undo-outline" size={18} color={colors.textPrimary} />
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={bubbleAnimStyle}>
          <AnimatedPressable
            onLongPress={handleLongPress}
            style={{
              alignItems: isMe ? "flex-end" : "flex-start",
              marginVertical: 5,
              marginHorizontal: 4,
              marginBottom: hasReactions ? 18 : 5,
              overflow: "visible" as any,
            }}
            haptic="none"
            scaleValue={0.985}
          >
            <View
              style={{
                maxWidth: "82%",
                backgroundColor: highlighted ? (isMe ? "#1a3a2a" : "#1a2a3a") : bubbleBg,
                borderRadius: 10,
                borderTopLeftRadius: isMe ? 10 : 2,
                borderTopRightRadius: isMe ? 2 : 10,
                ...(highlighted && { borderWidth: 1, borderColor: "#3b82f6" }),
                paddingHorizontal: 9,
                paddingTop: 5,
                paddingBottom: 3,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isDark ? 0.3 : 0.08,
                shadowRadius: 2,
                elevation: 1,
              }}
            >
              {/* Sender name (groups, not me) */}
              {!isMe && showSender && message.sender && (
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: senderColor,
                    marginBottom: 1,
                  }}
                >
                  {message.sender.name}
                </Text>
              )}

              {/* Reply preview */}
              {message.replyTo && (
                <View
                  style={{
                    flexDirection: "row",
                    backgroundColor: isMe
                      ? "rgba(0,0,0,0.1)"
                      : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"),
                    borderRadius: 6,
                    marginBottom: 4,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: 3,
                      backgroundColor: message.replyTo.sender
                        ? getSenderColor(message.replyTo.senderId ?? 0)
                        : colors.primary,
                    }}
                  />
                  <View style={{ paddingHorizontal: 8, paddingVertical: 4, flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: message.replyTo.sender
                          ? getSenderColor(message.replyTo.senderId ?? 0)
                          : colors.primary,
                      }}
                    >
                      {message.replyTo.sender?.name || ""}
                    </Text>
                    <Text
                      style={{ fontSize: 12, color: timeColor, marginTop: 1 }}
                      numberOfLines={1}
                    >
                      {message.replyTo.type === "audio"
                        ? "Audio"
                        : message.replyTo.content}
                    </Text>
                  </View>
                </View>
              )}

              {/* Audio */}
              {message.type === "audio" && message.fileUrl && (
                <AudioPlayer
                  uri={message.fileUrl}
                  duration={message.fileDuration || 0}
                  isMe={isMe}
                />
              )}

              {/* Image */}
              {message.type === "image" && message.fileUrl && (
                <AnimatedPressable
                  onPress={() => {
                    if (onImagePreview) {
                      onImagePreview(message.fileUrl!);
                    } else {
                      Linking.openURL(message.fileUrl!);
                    }
                  }}
                  haptic="none"
                >
                  <Image
                    source={{ uri: message.fileUrl }}
                    style={{
                      width: 240,
                      height: 180,
                      borderRadius: 6,
                      marginBottom: 2,
                    }}
                    resizeMode="cover"
                  />
                </AnimatedPressable>
              )}

              {/* File */}
              {message.type === "file" && (
                <AnimatedPressable
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: isMe
                      ? "rgba(0,0,0,0.1)"
                      : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"),
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 2,
                  }}
                  onPress={() => message.fileUrl && Linking.openURL(message.fileUrl)}
                  haptic="light"
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      backgroundColor: isMe
                        ? "rgba(255,255,255,0.15)"
                        : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"),
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name="document-outline"
                      size={22}
                      color={textColor}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontSize: 13, fontWeight: "500", color: textColor }}
                      numberOfLines={1}
                    >
                      {message.fileName || "Archivo"}
                    </Text>
                    {message.fileSize && (
                      <Text style={{ fontSize: 11, color: timeColor, marginTop: 2 }}>
                        {(message.fileSize / 1024).toFixed(0)} KB
                      </Text>
                    )}
                  </View>
                  <Ionicons name="download-outline" size={20} color={timeColor} />
                </AnimatedPressable>
              )}

              {/* Text content */}
              {(message.type === "text" ||
                (!message.fileUrl && (message.type as string) !== "system")) && (
                <Text
                  style={{
                    fontSize: 15,
                    lineHeight: 20,
                    color: textColor,
                    ...(message.isDeleted && { fontStyle: "italic", opacity: 0.6 }),
                  }}
                >
                  {message.isDeleted ? "Mensaje eliminado" : message.content}
                </Text>
              )}

              {/* Time + checkmarks row */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 3,
                  marginTop: 1,
                  marginBottom: 1,
                }}
              >
                {message.editedAt && !message.isDeleted && (
                  <Text style={{ fontSize: 10, color: timeColor, fontStyle: "italic" }}>
                    editado
                  </Text>
                )}
                <Text style={{ fontSize: 11, color: timeColor }}>
                  {timeStr}
                </Text>
                {isMe && (
                  <Ionicons
                    name="checkmark-done-outline"
                    size={16}
                    color="#53bdeb"
                  />
                )}
              </View>
            </View>

            {/* Reactions — floating below bubble */}
            {hasReactions && (
              <View
                style={{
                  position: "absolute",
                  bottom: -12,
                  left: isMe ? undefined : 8,
                  right: isMe ? 8 : undefined,
                }}
              >
                <ReactionPills
                  reactions={message.reactions}
                  userId={userId}
                  onToggle={(emoji) => onToggleReaction(message.id, emoji)}
                  isMe={isMe}
                />
              </View>
            )}
          </AnimatedPressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export default React.memo(MessageBubble, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.isDeleted === next.message.isDeleted &&
    prev.message.editedAt === next.message.editedAt &&
    prev.message.reactions === next.message.reactions &&
    prev.isMe === next.isMe &&
    prev.highlighted === next.highlighted &&
    prev.showSender === next.showSender
  );
});
