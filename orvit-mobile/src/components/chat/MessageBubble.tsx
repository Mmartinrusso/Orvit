import { View, Text, Image, Linking, ActionSheetIOS, Platform, Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { useCreateStyles } from "@/hooks/useCreateStyles";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import AudioPlayer from "@/components/AudioPlayer";
import ReactionPills from "@/components/ReactionPills";
import type { Message } from "@/types/chat";

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface Props {
  message: Message;
  isMe: boolean;
  userId: number;
  onReply: (msg: Message) => void;
  onReaction: (msg: Message) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onEdit?: (msg: Message) => void;
  onDelete?: (msg: Message) => void;
  onImagePreview?: (url: string) => void;
}

export default function MessageBubble({
  message,
  isMe,
  userId,
  onReply,
  onReaction,
  onToggleReaction,
  onEdit,
  onDelete,
  onImagePreview,
}: Props) {
  const { colors } = useTheme();
  const styles = useCreateStyles((c, t, s, r) => ({
    systemMessage: { alignItems: "center" as const, marginVertical: s.sm },
    systemText: { ...t.small, color: c.textMuted, fontStyle: "italic" as const },
    bubbleRow: { marginVertical: 2 },
    bubbleRowMe: { alignItems: "flex-end" as const },
    bubble: {
      maxWidth: "80%" as `${number}%`,
      borderRadius: r.lg,
      paddingHorizontal: s.md + 2,
      paddingVertical: s.md - 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 1,
    },
    bubbleMe: {
      backgroundColor: c.bubbleMeBg,
      borderBottomRightRadius: s.xs,
    },
    bubbleOther: {
      backgroundColor: c.bubbleOtherBg,
      borderBottomLeftRadius: s.xs,
    },
    senderName: {
      color: c.primary,
      fontSize: 12,
      fontWeight: "600" as const,
      marginBottom: 2,
    },
    replyPreview: {
      flexDirection: "row" as const,
      backgroundColor: "rgba(0,0,0,0.12)",
      borderRadius: 6,
      marginBottom: 6,
      overflow: "hidden" as const,
    },
    replyAccent: { width: 3, backgroundColor: c.primary },
    replyContent: { paddingHorizontal: 8, paddingVertical: 4, flex: 1 },
    replyName: { color: c.primary, fontSize: 11, fontWeight: "600" as const },
    replyText: { ...t.small, color: c.textSecondary },
    messageText: { ...t.body, color: c.bubbleOtherText },
    messageTextMe: { color: c.bubbleMeText },
    deletedText: { fontStyle: "italic" as const, opacity: 0.6 },
    timeRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      alignSelf: "flex-end" as const,
      gap: 4,
      marginTop: 3,
    },
    messageTime: { ...t.tiny, color: c.textMuted },
    messageTimeMe: { color: "rgba(255,255,255,0.55)" },
    editedLabel: { ...t.tiny, fontStyle: "italic" as const },
    imagePreview: {
      width: 220,
      height: 160,
      borderRadius: r.sm,
      marginBottom: s.xs,
    },
    fileCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: s.sm,
      backgroundColor: "rgba(0,0,0,0.12)",
      borderRadius: r.sm,
      padding: s.sm,
      marginBottom: s.xs,
    },
    fileName: { ...t.caption, color: c.bubbleOtherText },
    fileSize: { ...t.tiny, color: c.textMuted },
  }));

  const handleLongPress = () => {
    if (message.isDeleted) return;

    const canEdit =
      isMe &&
      message.type === "text" &&
      Date.now() - new Date(message.createdAt).getTime() < EDIT_WINDOW_MS;

    const options: string[] = [];
    const actions: (() => void)[] = [];

    // Responder
    options.push("Responder");
    actions.push(() => onReply(message));

    // Reaccionar
    options.push("Reaccionar");
    actions.push(() => onReaction(message));

    // Copiar (text only)
    if (message.type === "text") {
      options.push("Copiar texto");
      actions.push(async () => {
        await Clipboard.setStringAsync(message.content);
      });
    }

    // Editar (own text messages within 15min)
    if (canEdit && onEdit) {
      options.push("Editar");
      actions.push(() => onEdit(message));
    }

    // Eliminar (own messages)
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
      // Android fallback
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

  if (message.type === "system") {
    return (
      <View style={styles.systemMessage}>
        <Text style={styles.systemText}>{message.content}</Text>
      </View>
    );
  }

  const timeStr = new Date(message.createdAt).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Animated.View entering={FadeInDown.duration(200).springify()}>
      <AnimatedPressable
        onLongPress={handleLongPress}
        onPress={() => onReply(message)}
        style={[styles.bubbleRow, isMe && styles.bubbleRowMe]}
        haptic="none"
        scaleValue={0.98}
      >
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          {!isMe && message.sender && (
            <Text style={styles.senderName}>{message.sender.name}</Text>
          )}

          {message.replyTo && (
            <View style={styles.replyPreview}>
              <View style={styles.replyAccent} />
              <View style={styles.replyContent}>
                <Text style={styles.replyName}>
                  {message.replyTo.sender?.name || "Unknown"}
                </Text>
                <Text style={styles.replyText} numberOfLines={1}>
                  {message.replyTo.type === "audio"
                    ? "Audio"
                    : message.replyTo.content}
                </Text>
              </View>
            </View>
          )}

          {message.type === "audio" && message.fileUrl && (
            <AudioPlayer
              uri={message.fileUrl}
              duration={message.fileDuration || 0}
              isMe={isMe}
            />
          )}

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
                style={styles.imagePreview}
                resizeMode="cover"
              />
            </AnimatedPressable>
          )}

          {message.type === "file" && (
            <AnimatedPressable
              style={styles.fileCard}
              onPress={() => message.fileUrl && Linking.openURL(message.fileUrl)}
              haptic="light"
            >
              <Ionicons
                name="document-outline"
                size={22}
                color={isMe ? colors.bubbleMeText : colors.primary}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.fileName, isMe && { color: colors.bubbleMeText }]}
                  numberOfLines={1}
                >
                  {message.fileName || "Archivo"}
                </Text>
                {message.fileSize && (
                  <Text style={styles.fileSize}>
                    {(message.fileSize / 1024).toFixed(0)} KB
                  </Text>
                )}
              </View>
            </AnimatedPressable>
          )}

          {(message.type === "text" ||
            (!message.fileUrl && (message.type as string) !== "system")) && (
            <Text
              style={[
                styles.messageText,
                isMe && styles.messageTextMe,
                message.isDeleted && styles.deletedText,
              ]}
            >
              {message.isDeleted ? "Mensaje eliminado" : message.content}
            </Text>
          )}

          <View style={styles.timeRow}>
            {message.editedAt && !message.isDeleted && (
              <Text
                style={[
                  styles.editedLabel,
                  { color: isMe ? "rgba(255,255,255,0.45)" : colors.textMuted },
                ]}
              >
                editado
              </Text>
            )}
            <Text
              style={[styles.messageTime, isMe && styles.messageTimeMe]}
            >
              {timeStr}
            </Text>
            {isMe && (
              <Ionicons
                name="checkmark-done"
                size={14}
                color="rgba(255,255,255,0.5)"
              />
            )}
          </View>

          <ReactionPills
            reactions={message.reactions}
            userId={userId}
            onToggle={(emoji) => onToggleReaction(message.id, emoji)}
            isMe={isMe}
          />
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}
