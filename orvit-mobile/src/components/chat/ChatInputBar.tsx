import { useCallback, useState } from "react";
import { View, Text, TextInput, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { fonts } from "@/lib/fonts";
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
  const { colors } = useTheme();
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

  // ── Normal input mode ──
  return (
    <View
      style={{
        backgroundColor: colors.chatHeaderBg,
        borderTopWidth: 1,
        borderTopColor: colors.chatHeaderBorder,
      }}
    >
      {/* Attachment menu */}
      {showAttachments && (
        <Animated.View
          entering={FadeInDown.duration(200).springify()}
          style={{
            flexDirection: "row",
            gap: 12,
            paddingHorizontal: 14,
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
              backgroundColor: colors.chatButtonBg,
            }}
            onPress={() => { setShowAttachments(false); onPickFile(); }}
            haptic="light"
          >
            <Ionicons name="document-outline" size={24} color={colors.textMuted} />
          </AnimatedPressable>
          <AnimatedPressable
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: colors.chatButtonBg,
            }}
            onPress={() => { setShowAttachments(false); onPickImage(); }}
            haptic="light"
          >
            <Ionicons name="image-outline" size={24} color={colors.textMuted} />
          </AnimatedPressable>
        </Animated.View>
      )}

      {/* Reply preview */}
      {replyTo && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingRight: 12,
          }}
        >
          <View
            style={{
              width: 3,
              alignSelf: "stretch",
              backgroundColor: "#ef4444",
            }}
          />
          <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Text
              style={{
                fontFamily: fonts.semiBold,
                fontSize: 13,
                color: colors.textSecondary,
              }}
            >
              {replyTo.sender?.name || ""}
            </Text>
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 13,
                color: colors.textMuted,
                marginTop: 1,
              }}
              numberOfLines={1}
            >
              {replyTo.type === "audio" ? "Audio" : replyTo.content}
            </Text>
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
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </AnimatedPressable>
        </View>
      )}

      {/* Input row or recording bar */}
      <View
        style={{
          paddingBottom: bottomInset > 0 ? bottomInset : 28,
        }}
      >
        {isRecording ? (
          <AudioRecorder
            onAudioReady={onAudioReady}
            onRecordingChange={setIsRecording}
            autoStart
          />
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 14,
              paddingTop: 6,
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
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: colors.chatButtonBg,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons
                name={showAttachments ? "close" : "add"}
                size={18}
                color={colors.textMuted}
              />
            </AnimatedPressable>

            {/* Input pill */}
            <View
              style={{
                flex: 1,
                backgroundColor: colors.chatInputBg,
                borderRadius: 17,
                borderWidth: 1,
                borderColor: colors.chatInputBorder,
                paddingHorizontal: 15,
                height: 34,
                justifyContent: "center",
              }}
            >
              <TextInput
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 13,
                  color: colors.textPrimary,
                  includeFontPadding: false,
                  padding: 0,
                  margin: 0,
                } as any}
                placeholder="Mensaje..."
                placeholderTextColor={colors.chatInputPlaceholder}
                value={inputText}
                onChangeText={onChangeText}
                maxLength={4000}
              />
            </View>

            {/* Mic / Send */}
            {hasInput ? (
              <Animated.View entering={FadeIn.duration(100)} style={sendButtonStyle}>
                <AnimatedPressable
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: colors.textPrimary,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                  onPress={handleSend}
                  disabled={isSending}
                  haptic="none"
                >
                  <Ionicons name="send" size={16} color={colors.bg} />
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
        )}
      </View>
    </View>
  );
}
