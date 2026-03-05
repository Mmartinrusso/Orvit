import { useCallback, useState } from "react";
import { View, TextInput } from "react-native";
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

const SENDER_COLORS = [
  "#25D366", "#00a884", "#53bdeb", "#e07c5c",
  "#7c5ce0", "#e05c8f", "#5ce0c4", "#e0c45c",
  "#5c8fe0", "#c45ce0", "#5ce07c", "#e0875c",
];
function getSenderColor(senderId: number | null): string {
  return SENDER_COLORS[(senderId ?? 0) % SENDER_COLORS.length];
}

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
  bottomInset?: number;
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
  bottomInset = 0,
}: Props) {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const [showAttachments, setShowAttachments] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
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

  const barBg = colors.chatHeaderBg;
  const inputBg = colors.chatInputBg;
  const accentBlue = colors.primary;
  const iconColor = colors.textPrimary;

  // ── Recording mode: full-width AudioRecorder with autoStart ──
  if (isRecording) {
    return (
      <View style={{ backgroundColor: barBg, paddingBottom: bottomInset }}>
        <AudioRecorder
          onAudioReady={onAudioReady}
          onRecordingChange={setIsRecording}
          autoStart
        />
      </View>
    );
  }

  // ── Normal input mode ──
  return (
    <View style={{ backgroundColor: barBg }}>
      {/* Attachment menu */}
      {showAttachments && (
        <Animated.View
          entering={FadeInDown.duration(200).springify()}
          style={{
            flexDirection: "row",
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 10,
          }}
        >
          <AnimatedPressable
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            }}
            onPress={() => { setShowAttachments(false); onPickFile(); }}
            haptic="light"
          >
            <Ionicons name="document-outline" size={24} color={iconColor} />
          </AnimatedPressable>
          <AnimatedPressable
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            }}
            onPress={() => { setShowAttachments(false); onPickImage(); }}
            haptic="light"
          >
            <Ionicons name="image-outline" size={24} color={iconColor} />
          </AnimatedPressable>
        </Animated.View>
      )}

      {/* Reply preview */}
      {replyTo && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginHorizontal: 8,
            marginTop: 8,
            marginBottom: 0,
            backgroundColor: isDark ? "#1a1f2a" : colors.bgTertiary,
            borderRadius: 12,
            overflow: "hidden",
            paddingRight: 12,
          }}
        >
          <View
            style={{
              width: 4,
              alignSelf: "stretch",
              backgroundColor: getSenderColor(replyTo.senderId),
            }}
          />
          <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Animated.Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: getSenderColor(replyTo.senderId),
              }}
            >
              {replyTo.sender?.name || ""}
            </Animated.Text>
            <Animated.Text
              style={{ fontSize: 14, color: colors.textPrimary, marginTop: 2 }}
              numberOfLines={1}
            >
              {replyTo.type === "audio" ? "🎤 Audio" : replyTo.content}
            </Animated.Text>
          </View>
          <AnimatedPressable
            onPress={onCancelReply}
            haptic="light"
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons name="close-circle-outline" size={26} color={colors.textMuted} />
          </AnimatedPressable>
        </Animated.View>
      )}

      {/* Input row: [+] [input] [camera] [mic/send] */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 8,
          paddingTop: replyTo ? 6 : 12,
          paddingBottom: 14 + bottomInset,
          gap: 8,
        }}
      >
        {/* + button */}
        <AnimatedPressable
          onPress={() => {
            haptics.light();
            setShowAttachments(!showAttachments);
          }}
          haptic="none"
          style={{
            width: 32,
            height: 36,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons
            name={showAttachments ? "close-outline" : "add-outline"}
            size={26}
            color={iconColor}
          />
        </AnimatedPressable>

        {/* Input pill */}
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "flex-end",
            backgroundColor: inputBg,
            borderRadius: 20,
            borderWidth: isDark ? 0 : 1,
            borderColor: colors.border,
            paddingHorizontal: 14,
            minHeight: 36,
            maxHeight: 100,
          }}
        >
          <TextInput
            style={{
              flex: 1,
              fontSize: 14,
              color: colors.textPrimary,
              minHeight: 36,
              maxHeight: 100,
              textAlignVertical: "center",
              includeFontPadding: false,
              paddingTop: 8,
              paddingBottom: 8,
            } as any}
            placeholder="Mensaje"
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={onChangeText}
            maxLength={4000}
            multiline
          />
        </View>

        {/* Camera */}
        <AnimatedPressable
          onPress={onPickImage}
          haptic="light"
          style={{
            width: 32,
            height: 36,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons name="camera-outline" size={22} color={iconColor} />
        </AnimatedPressable>

        {/* Mic / Send */}
        {hasInput ? (
          <Animated.View entering={FadeIn.duration(100)} style={sendButtonStyle}>
            <AnimatedPressable
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: accentBlue,
                justifyContent: "center",
                alignItems: "center",
              }}
              onPress={handleSend}
              disabled={isSending}
              haptic="none"
            >
              <Ionicons name="send-outline" size={18} color="#fff" />
            </AnimatedPressable>
          </Animated.View>
        ) : (
          <AudioRecorder
            onAudioReady={onAudioReady}
            disabled={isSending}
            onRecordingChange={setIsRecording}
          />
        )}
      </View>
    </View>
  );
}
