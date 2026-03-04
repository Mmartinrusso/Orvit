import { useCallback, useState } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
  FadeIn,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import AudioRecorder from "@/components/AudioRecorder";
import type { Message } from "@/types/chat";

interface Props {
  inputText: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onPickImage: () => void;
  onPickFile: () => void;
  onAudioReady: (data: {
    url: string;
    fileName: string;
    fileSize: number;
    fileDuration: number;
  }) => void;
  isSending: boolean;
  replyTo: Message | null;
  onCancelReply: () => void;
}

export default function ChatInputBar({
  inputText,
  onChangeText,
  onSend,
  onPickImage,
  onPickFile,
  onAudioReady,
  isSending,
  replyTo,
  onCancelReply,
}: Props) {
  const { colors } = useTheme();
  const haptics = useHaptics();
  const [showAttachments, setShowAttachments] = useState(false);
  const hasInput = inputText.trim().length > 0;

  const sendScale = useSharedValue(1);

  const handleSend = useCallback(() => {
    haptics.medium();
    sendScale.value = withSpring(0.8, { damping: 10 });
    setTimeout(() => {
      sendScale.value = withSpring(1, { damping: 10 });
    }, 100);
    onSend();
  }, [onSend]);

  const sendButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
      {/* Reply preview */}
      {replyTo && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={[styles.replyBar, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
        >
          <View style={[styles.replyAccent, { backgroundColor: colors.primary }]} />
          <View style={styles.replyContent}>
            <Animated.Text style={[styles.replyName, { color: colors.primary }]}>
              {replyTo.sender?.name || "Unknown"}
            </Animated.Text>
            <Animated.Text style={[styles.replyText, { color: colors.textSecondary }]} numberOfLines={1}>
              {replyTo.type === "audio" ? "Audio" : replyTo.content}
            </Animated.Text>
          </View>
          <AnimatedPressable onPress={onCancelReply} haptic="light">
            <Ionicons name="close-circle" size={22} color={colors.textMuted} />
          </AnimatedPressable>
        </Animated.View>
      )}

      {/* Attachment menu */}
      {showAttachments && (
        <Animated.View
          entering={FadeInDown.duration(200).springify()}
          style={[styles.attachMenu, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
        >
          <AnimatedPressable
            style={[styles.attachOption, { backgroundColor: colors.primaryBg }]}
            onPress={() => { setShowAttachments(false); onPickImage(); }}
            haptic="light"
          >
            <Ionicons name="image-outline" size={24} color={colors.primary} />
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.attachOption, { backgroundColor: colors.primaryBg }]}
            onPress={() => { setShowAttachments(false); onPickFile(); }}
            haptic="light"
          >
            <Ionicons name="document-outline" size={24} color={colors.primary} />
          </AnimatedPressable>
        </Animated.View>
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        <AnimatedPressable
          onPress={() => setShowAttachments(!showAttachments)}
          haptic="light"
          style={[styles.iconBtn, showAttachments && { backgroundColor: colors.primaryBg }]}
        >
          <Ionicons
            name={showAttachments ? "close" : "add"}
            size={24}
            color={showAttachments ? colors.primary : colors.textMuted}
          />
        </AnimatedPressable>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.bgInput,
              color: colors.textPrimary,
              borderColor: colors.border,
            },
          ]}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={colors.textMuted}
          value={inputText}
          onChangeText={onChangeText}
          multiline
          maxLength={4000}
        />

        {hasInput ? (
          <Animated.View entering={FadeIn.duration(150)} style={sendButtonStyle}>
            <AnimatedPressable
              style={[styles.sendBtn, { backgroundColor: colors.primary }]}
              onPress={handleSend}
              disabled={isSending}
              haptic="none"
            >
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </AnimatedPressable>
          </Animated.View>
        ) : (
          <AudioRecorder onAudioReady={onAudioReady} disabled={isSending} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingBottom: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 8,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    paddingRight: 8,
  },
  replyAccent: { width: 3, alignSelf: "stretch" },
  replyContent: { flex: 1, paddingHorizontal: 10, paddingVertical: 6 },
  replyName: { fontSize: 12, fontWeight: "600" },
  replyText: { fontSize: 12 },
  attachMenu: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  attachOption: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
});
