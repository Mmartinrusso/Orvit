import React from "react";
import { View, Text, Image, Linking, ActionSheetIOS, Platform, Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/fonts";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import AudioPlayer from "@/components/AudioPlayer";
import ReactionPills from "@/components/ReactionPills";
import SimpleMarkdown from "@/components/chat/SimpleMarkdown";
import type { Message } from "@/types/chat";

function highlightText(content: string, query: string) {
  if (!query.trim()) return content;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = content.split(regex);
  if (parts.length === 1) return content;
  return parts.map((part, i) =>
    regex.test(part) ? (
      <Text
        key={i}
        style={{
          backgroundColor: "rgba(59,130,246,0.25)",
          borderRadius: 2,
        }}
      >
        {part}
      </Text>
    ) : (
      part
    )
  );
}

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const SWIPE_THRESHOLD = 60; // px to trigger reply

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
  searchQuery?: string;
  isBot?: boolean;
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
  searchQuery,
  isBot = false,
}: Props) {
  const { colors, isDark } = useTheme();
  const translateX = useSharedValue(0);
  const hasTriggered = useSharedValue(false);

  const triggerReply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onReply(message);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX(20)
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      if (e.translationX < 0) return;
      translateX.value = Math.min(e.translationX, SWIPE_THRESHOLD);
      if (e.translationX >= SWIPE_THRESHOLD && !hasTriggered.value) {
        hasTriggered.value = true;
        runOnJS(triggerReply)();
      }
    })
    .onEnd(() => {
      translateX.value = withTiming(0, { duration: 150 });
      hasTriggered.value = false;
    });

  const bubbleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
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
              fontFamily: fonts.medium,
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
  const timeColor = isMe ? colors.bubbleTimeMe : colors.bubbleTimeOther;

  // Bot-specific colors
  const botCodeColor = isDark ? "#A3A3A3" : "#555555";
  const botCodeBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
  const botAvatarBg = isDark ? "#FFFFFF" : "#0A0A0A";
  const botAvatarIcon = isDark ? "#0A0A0A" : "#FFFFFF";

  const hasReactions = message.reactions && message.reactions.length > 0;
  const isBotMessage = isBot && !isMe;

  // Replace "ORVIT" with "M6" in bot messages (server sends "ORVIT" in prompts)
  const displayContent = isBotMessage
    ? message.content.replace(/ORVIT/gi, "M6")
    : message.content;

  // ── Shared bubble content ──
  const bubbleContent = (
    <>
      {/* Sender name (groups, not me) */}
      {!isMe && showSender && message.sender && !isBotMessage && (
        <Text
          style={{
            fontSize: 11,
            fontFamily: fonts.semiBold,
            letterSpacing: -0.11,
            color: colors.bubbleSenderName,
            marginBottom: 2,
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
              backgroundColor: colors.bubbleSenderName,
            }}
          />
          <View style={{ paddingHorizontal: 8, paddingVertical: 4, flex: 1 }}>
            <Text
              style={{
                fontSize: 11,
                fontFamily: fonts.semiBold,
                letterSpacing: -0.11,
                color: colors.bubbleSenderName,
              }}
            >
              {message.replyTo.sender?.name || ""}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontFamily: fonts.regular,
                color: timeColor,
                marginTop: 1,
              }}
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
              width: 180,
              height: 120,
              borderRadius: 10,
              backgroundColor: isDark ? "#C4C4C4" : "#E5E5E5",
              marginBottom: 4,
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
            marginBottom: 4,
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
              style={{
                fontSize: 13,
                fontFamily: fonts.medium,
                color: textColor,
              }}
              numberOfLines={1}
            >
              {message.fileName || "Archivo"}
            </Text>
            {message.fileSize && (
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: fonts.regular,
                  color: timeColor,
                  marginTop: 2,
                }}
              >
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
        message.isDeleted ? (
          <Text
            style={{
              fontSize: 13.5,
              fontFamily: fonts.regular,
              letterSpacing: -0.135,
              lineHeight: 18.9,
              color: textColor,
              fontStyle: "italic",
              opacity: 0.6,
            }}
          >
            Mensaje eliminado
          </Text>
        ) : isBotMessage ? (
          <SimpleMarkdown
            content={displayContent}
            textColor={textColor}
            codeColor={botCodeColor}
            codeBg={botCodeBg}
          />
        ) : (
          <Text
            style={{
              fontSize: 13.5,
              fontFamily: fonts.regular,
              letterSpacing: -0.135,
              lineHeight: 18.9,
              color: textColor,
            }}
          >
            {highlighted && searchQuery
              ? highlightText(displayContent, searchQuery)
              : displayContent}
          </Text>
        )
      )}

      {/* Time + checkmarks row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 3,
          marginTop: 2,
        }}
      >
        {message.editedAt && !message.isDeleted && (
          <Text
            style={{
              fontSize: 10,
              fontFamily: fonts.regular,
              letterSpacing: -0.135,
              color: timeColor,
              fontStyle: "italic",
            }}
          >
            editado
          </Text>
        )}
        <Text
          style={{
            fontSize: 10,
            fontFamily: fonts.regular,
            letterSpacing: -0.135,
            color: timeColor,
          }}
        >
          {timeStr}
        </Text>
        {isMe && (
          <Ionicons
            name="checkmark-done"
            size={13}
            color="#3b82f6"
          />
        )}
      </View>
    </>
  );

  // ── Shared bubble style ──
  const bubbleStyle = {
    backgroundColor: bubbleBg,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: isMe ? 14 : 4,
    borderBottomRightRadius: isMe ? 4 : 14,
    paddingLeft: 11,
    paddingRight: 11,
    paddingTop: 8,
    paddingBottom: 6,
  };

  return (
    <View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={bubbleAnimStyle}>
          <AnimatedPressable
            onLongPress={handleLongPress}
            style={{
              alignItems: isMe ? "flex-end" : "flex-start",
              marginVertical: 3,
              marginHorizontal: 4,
              marginBottom: hasReactions ? 18 : 3,
              overflow: "visible" as any,
            }}
            haptic="none"
            scaleValue={0.985}
          >
            {isBotMessage ? (
              /* Bot message: avatar + bubble in a row */
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, maxWidth: "80%" }}>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: botAvatarBg,
                    justifyContent: "center",
                    alignItems: "center",
                    marginTop: 2,
                    flexShrink: 0,
                  }}
                >
                  <Ionicons name="sparkles" size={11} color={botAvatarIcon} />
                </View>
                <View style={[bubbleStyle, { flex: 1 }]}>
                  {bubbleContent}
                </View>
              </View>
            ) : (
              /* Regular message */
              <View style={[bubbleStyle, { maxWidth: "70%" }]}>
                {bubbleContent}
              </View>
            )}

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
    prev.isBot === next.isBot &&
    prev.highlighted === next.highlighted &&
    prev.showSender === next.showSender &&
    prev.searchQuery === next.searchQuery
  );
});
