import { useState, useRef, useCallback, useEffect } from "react";
import { View, Text, Alert } from "react-native";
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
import * as Haptics from "expo-haptics";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import { useTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/fonts";
import { API_URL } from "@/api/client";
import { getAccessToken } from "@/lib/storage";

interface AudioRecorderProps {
  onAudioReady: (data: {
    url: string;
    fileName: string;
    fileSize: number;
    fileDuration: number;
  }) => void;
  disabled?: boolean;
  onRecordingChange?: (recording: boolean) => void;
  /** When true, automatically start recording on mount */
  autoStart?: boolean;
}

// ── Animated waveform bars ──
const BAR_COUNT = 8;

function WaveformBars({ isRecording, color }: { isRecording: boolean; color: string }) {
  const bars = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    bars.push(<WaveformBar key={i} index={i} isRecording={isRecording} color={color} />);
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2, height: 22 }}>
      {bars}
    </View>
  );
}

function WaveformBar({ index, isRecording, color }: { index: number; isRecording: boolean; color: string }) {
  const height = useSharedValue(4);

  useEffect(() => {
    if (isRecording) {
      const minH = 4 + (index % 3) * 2;
      const maxH = 10 + ((index * 7) % 12);
      const dur = 300 + ((index * 53) % 250);
      const del = (index * 40) % 200;
      height.value = withDelay(
        del,
        withRepeat(
          withSequence(
            withTiming(maxH, { duration: dur, easing: Easing.inOut(Easing.sin) }),
            withTiming(minH, { duration: dur, easing: Easing.inOut(Easing.sin) })
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

  const animatedStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Animated.View
      style={[{ width: 3, borderRadius: 1.5, backgroundColor: color }, animatedStyle]}
    />
  );
}

// ── Waveform dots ──
const DOT_COUNT = 28;

function WaveformDots({ isRecording, dotColor }: { isRecording: boolean; dotColor: string }) {
  const dots = [];
  for (let i = 0; i < DOT_COUNT; i++) {
    dots.push(<WaveformDot key={i} index={i} isRecording={isRecording} dotColor={dotColor} />);
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2, height: 22 }}>
      {dots}
    </View>
  );
}

function WaveformDot({ index, isRecording, dotColor }: { index: number; isRecording: boolean; dotColor: string }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    if (isRecording) {
      const delay = (index * 60) % 800;
      opacity.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 400, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.3, { duration: 400, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        )
      );
    } else {
      cancelAnimation(opacity);
      opacity.value = withTiming(0.3, { duration: 200 });
    }
  }, [isRecording]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: dotColor }, style]}
    />
  );
}

// ── Recording indicator dot (pulsing red) ──
function RecordingDot() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#f87171" }, style]}
    />
  );
}

// ── Main Component ──

export default function AudioRecorder({
  onAudioReady,
  disabled,
  onRecordingChange,
  autoStart,
}: AudioRecorderProps) {
  const { colors, isDark } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setRecordingState = (val: boolean) => {
    setIsRecording(val);
    onRecordingChange?.(val);
  };

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert("Permiso denegado", "Se necesita acceso al micrófono para grabar audio.");
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
      setRecordingState(true);
      setDuration(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (error) {
      console.error("[AudioRecorder] Failed to start:", error);
      Alert.alert("Error", "No se pudo iniciar la grabación");
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      await recordingRef.current.stopAndUnloadAsync();
    } catch {}
    recordingRef.current = null;
    setRecordingState(false);
    setDuration(0);
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const stopAndSend = useCallback(async () => {
    if (!recordingRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      const status = await recordingRef.current.getStatusAsync();
      recordingRef.current = null;

      if (!uri) throw new Error("No recording URI");

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const durationSec = (status.durationMillis || 0) / 1000;

      setRecordingState(false);

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
      setRecordingState(false);
    }
  }, [onAudioReady]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Auto-start recording when mounted with autoStart prop
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStart && !autoStarted.current) {
      autoStarted.current = true;
      startRecording();
    }
  }, [autoStart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  // ── Recording: compact single-row bar (Figma m6) ──
  if (isRecording || autoStart) {
    const recColor = colors.recording;
    return (
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 10,
          gap: 10,
        }}
      >
        {/* Red dot + time */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <RecordingDot />
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: 14,
              color: colors.textPrimary,
              minWidth: 32,
            }}
          >
            {formatTime(duration)}
          </Text>
        </View>

        {/* Waveform bars + dots */}
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <WaveformBars isRecording={isRecording} color={recColor} />
          <View style={{ flex: 1 }}>
            <WaveformDots isRecording={isRecording} dotColor={recColor} />
          </View>
        </View>

        {/* Cancel */}
        <AnimatedPressable onPress={cancelRecording} haptic="light">
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 13,
              color: colors.textMuted,
            }}
          >
            Cancelar
          </Text>
        </AnimatedPressable>

        {/* Send */}
        <AnimatedPressable
          onPress={stopAndSend}
          haptic="medium"
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: "#ef4444",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons name="send-outline" size={17} color="#fff" />
        </AnimatedPressable>
      </Animated.View>
    );
  }

  // ── Idle: mic icon ──
  return (
    <Animated.View entering={FadeIn.duration(150)}>
      <AnimatedPressable
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: colors.chatButtonBg,
          justifyContent: "center",
          alignItems: "center",
          ...(disabled && { opacity: 0.4 }),
        }}
        onPress={() => {
          onRecordingChange?.(true);
        }}
        disabled={disabled}
        haptic="none"
      >
        <Ionicons name="mic" size={18} color={colors.textMuted} />
      </AnimatedPressable>
    </Animated.View>
  );
}
