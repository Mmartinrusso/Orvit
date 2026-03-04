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

// ── Waveform dots (WhatsApp-style) ──
const DOT_COUNT = 40;

function WaveformDots({ isRecording }: { isRecording: boolean }) {
  const dots = [];
  for (let i = 0; i < DOT_COUNT; i++) {
    dots.push(
      <WaveformDot key={i} index={i} isRecording={isRecording} />
    );
  }
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        height: 20,
      }}
    >
      {dots}
    </View>
  );
}

function WaveformDot({ index, isRecording }: { index: number; isRecording: boolean }) {
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
      style={[
        {
          width: 3,
          height: 3,
          borderRadius: 1.5,
          backgroundColor: "#ffffff",
        },
        style,
      ]}
    />
  );
}

// ── Animated waveform bars (for inline preview) ──
const BAR_COUNT = 12;

function WaveformBar({ index, isRecording, color }: { index: number; isRecording: boolean; color: string }) {
  const height = useSharedValue(4);

  useEffect(() => {
    if (isRecording) {
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

  const animatedStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Animated.View
      style={[{ width: 3, borderRadius: 1.5, backgroundColor: color }, animatedStyle]}
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
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setRecording = (val: boolean) => {
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
      setRecording(true);
      setIsPaused(false);
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
    setRecording(false);
    setIsPaused(false);
    setDuration(0);
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const togglePause = useCallback(async () => {
    if (!recordingRef.current) return;
    try {
      if (isPaused) {
        await recordingRef.current.startAsync();
        setIsPaused(false);
        timerRef.current = setInterval(() => {
          setDuration((d) => d + 1);
        }, 1000);
      } else {
        await recordingRef.current.pauseAsync();
        setIsPaused(true);
        if (timerRef.current) clearInterval(timerRef.current);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  }, [isPaused]);

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

      // Hide recording UI immediately — upload in background
      setRecording(false);
      setIsPaused(false);

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
      setRecording(false);
      setIsPaused(false);
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

  // ── Recording (or autoStart pending): full-width WhatsApp-style UI ──
  if (isRecording || autoStart) {
    return (
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={{ flex: 1 }}
      >
        {/* Top: timer + waveform dots */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 8,
            gap: 12,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "600", color: "#fff", minWidth: 44 }}>
            {formatTime(duration)}
          </Text>
          <WaveformDots isRecording={isRecording && !isPaused} />
        </View>

        {/* Bottom: delete / pause / send */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 24,
            paddingBottom: 14,
          }}
        >
          {/* Delete */}
          <AnimatedPressable onPress={cancelRecording} haptic="light">
            <Ionicons name="trash-outline" size={26} color="rgba(255,255,255,0.6)" />
          </AnimatedPressable>

          {/* Pause / Resume */}
          <AnimatedPressable
            onPress={togglePause}
            haptic="medium"
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              borderWidth: 2.5,
              borderColor: "#ef4444",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons
              name={isPaused ? "play" : "pause"}
              size={22}
              color="#ef4444"
            />
          </AnimatedPressable>

          {/* Send */}
          <AnimatedPressable
            onPress={stopAndSend}
            haptic="medium"
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: "#3b82f6",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </AnimatedPressable>
        </View>
      </Animated.View>
    );
  }

  // ── Idle: mic icon ──
  return (
    <Animated.View entering={FadeIn.duration(150)}>
      <AnimatedPressable
        style={{
          width: 36,
          height: 36,
          justifyContent: "center",
          alignItems: "center",
          ...(disabled && { opacity: 0.4 }),
        }}
        onPress={() => {
          // Notify parent immediately so it renders the full-width AudioRecorder with autoStart
          onRecordingChange?.(true);
        }}
        disabled={disabled}
        haptic="none"
      >
        <Ionicons name="mic-outline" size={24} color="#ffffff" />
      </AnimatedPressable>
    </Animated.View>
  );
}
