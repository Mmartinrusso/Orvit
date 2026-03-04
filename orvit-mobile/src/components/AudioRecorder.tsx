import { useState, useRef, useCallback, useEffect } from "react";
import { View, Text, Alert, ActivityIndicator } from "react-native";
import { Audio } from "expo-av";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  cancelAnimation,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { useCreateStyles } from "@/hooks/useCreateStyles";
import { useHaptics } from "@/hooks/useHaptics";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import { API_URL } from "@/api/client";
import { getAccessToken } from "@/lib/storage";
import type { ColorPalette, Typography, Spacing, Radius } from "@/lib/theme";

// ─── Types ────────────────────────────────────────────────────

interface AudioRecorderProps {
  onAudioReady: (data: {
    url: string;
    fileName: string;
    fileSize: number;
    fileDuration: number;
  }) => void;
  disabled?: boolean;
}

// ─── Waveform Bar ─────────────────────────────────────────────

const BAR_COUNT = 12;

function WaveformBar({
  index,
  isRecording,
  color,
}: {
  index: number;
  isRecording: boolean;
  color: string;
}) {
  const height = useSharedValue(4);

  useEffect(() => {
    if (isRecording) {
      // Each bar gets a different min/max height and delay to look organic
      const minH = 4 + (index % 3) * 2;
      const maxH = 12 + ((index * 7) % 14);
      const duration = 300 + ((index * 53) % 250);
      const delay = (index * 40) % 200;

      height.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(maxH, { duration, easing: Easing.inOut(Easing.sin) }),
            withTiming(minH, { duration, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        )
      );
    } else {
      cancelAnimation(height);
      height.value = withTiming(4, { duration: 200 });
    }
  }, [isRecording]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: 3,
          borderRadius: 1.5,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function AudioRecorder({
  onAudioReady,
  disabled,
}: AudioRecorderProps) {
  const { colors } = useTheme();
  const styles = useCreateStyles(createStyles);
  const haptics = useHaptics();

  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [duration, setDuration] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Recording Logic ─────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert(
          "Permiso denegado",
          "Se necesita acceso al micrófono para grabar audio."
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsRecording(true);
      setDuration(0);
      haptics.heavy();

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (error) {
      console.error("[AudioRecorder] Failed to start:", error);
      Alert.alert("Error", "No se pudo iniciar la grabación");
    }
  }, [haptics]);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    haptics.medium();
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setIsUploading(true);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      const status = await recordingRef.current.getStatusAsync();
      recordingRef.current = null;

      if (!uri) throw new Error("No recording URI");

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const durationSec = (status.durationMillis || 0) / 1000;

      // Upload to S3
      const formData = new FormData();
      formData.append("file", {
        uri,
        name: `audio-${Date.now()}.m4a`,
        type: "audio/m4a",
      } as unknown as Blob);
      formData.append("duration", String(durationSec));

      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/api/chat/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      onAudioReady({
        url: data.url,
        fileName: data.fileName,
        fileSize: data.fileSize,
        fileDuration: durationSec,
      });
    } catch (error) {
      console.error("[AudioRecorder] Failed to upload:", error);
      Alert.alert("Error", "No se pudo enviar el audio");
    } finally {
      setIsUploading(false);
    }
  }, [onAudioReady, haptics]);

  // ─── Helpers ──────────────────────────────────────────────

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ─── Uploading State ─────────────────────────────────────

  if (isUploading) {
    return (
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(150)}
        style={styles.uploadingContainer}
      >
        <ActivityIndicator size="small" color={colors.primary} />
      </Animated.View>
    );
  }

  // ─── Recording State ─────────────────────────────────────

  if (isRecording) {
    return (
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={[styles.recordingContainer, { backgroundColor: colors.bgSecondary }]}
      >
        {/* Waveform bars */}
        <View style={styles.waveformContainer}>
          {Array.from({ length: BAR_COUNT }).map((_, i) => (
            <WaveformBar
              key={i}
              index={i}
              isRecording={isRecording}
              color={colors.recording}
            />
          ))}
        </View>

        {/* Timer */}
        <Text style={[styles.timerText, { color: colors.textPrimary }]}>
          {formatTime(duration)}
        </Text>

        {/* Stop button */}
        <AnimatedPressable
          style={[styles.stopButton, { backgroundColor: colors.recording }]}
          onPress={stopRecording}
          haptic="none"
        >
          <Ionicons name="stop-circle" size={20} color="#fff" />
        </AnimatedPressable>
      </Animated.View>
    );
  }

  // ─── Idle State ───────────────────────────────────────────

  return (
    <Animated.View entering={FadeIn.duration(150)}>
      <AnimatedPressable
        style={[
          styles.micButton,
          { backgroundColor: colors.bgTertiary },
          disabled && styles.disabled,
        ]}
        onPress={startRecording}
        disabled={disabled}
        haptic="none"
      >
        <Ionicons name="mic" size={20} color={colors.textMuted} />
      </AnimatedPressable>
    </Animated.View>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const createStyles = (colors: ColorPalette, t: Typography, s: Spacing, r: Radius) => ({
  uploadingContainer: {
    width: 38,
    height: 38,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  recordingContainer: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    borderRadius: r.xl,
    paddingHorizontal: s.lg,
    paddingVertical: s.sm + 2,
    marginRight: s.sm,
    gap: s.md,
  },
  waveformContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
    height: 26,
  },
  timerText: {
    fontSize: t.body.fontSize,
    fontWeight: "600" as const,
    flex: 1,
  },
  stopButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  micButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  disabled: {
    opacity: 0.4,
  },
});
