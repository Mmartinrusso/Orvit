import { useState, useCallback, useRef, useEffect } from "react";
import { View, Text, Alert } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { readAsStringAsync } from "expo-file-system/legacy";
import { useQueryClient } from "@tanstack/react-query";
import { createTaskFromVoice } from "@/api/agenda";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCreateStyles } from "@/hooks/useCreateStyles";
import { useHaptics } from "@/hooks/useHaptics";
import AnimatedPressable from "@/components/ui/AnimatedPressable";

type RecordingState = "idle" | "recording" | "processing" | "done";

export default function VoiceTaskScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const haptics = useHaptics();
  const queryClient = useQueryClient();

  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [transcription, setTranscription] = useState("");
  const [createdTaskId, setCreatedTaskId] = useState<number | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulse animation for recording indicator
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const styles = useCreateStyles((c, t, s, r) => ({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: s.lg,
      paddingVertical: s.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.bgSecondary,
    },
    backBtn: { padding: s.xs, marginRight: s.sm },
    headerTitle: { ...t.subheading, color: c.textPrimary, flex: 1 },
    content: {
      flex: 1,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      paddingHorizontal: s.xxxl,
    },
    instruction: {
      ...t.heading,
      color: c.textPrimary,
      textAlign: "center" as const,
      marginBottom: s.sm,
    },
    subtitle: {
      ...t.body,
      color: c.textSecondary,
      textAlign: "center" as const,
      marginBottom: s.xxxl + 16,
    },
    recordBtn: {
      width: 100,
      height: 100,
      borderRadius: 50,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginBottom: s.xxl,
    },
    pulseRing: {
      position: "absolute" as const,
      width: 130,
      height: 130,
      borderRadius: 65,
      backgroundColor: c.recording,
    },
    timer: {
      ...t.title,
      color: c.textPrimary,
      marginBottom: s.xl,
      fontVariant: ["tabular-nums" as const],
    },
    processingText: {
      ...t.body,
      color: c.textSecondary,
      textAlign: "center" as const,
      marginTop: s.xl,
    },
    resultCard: {
      backgroundColor: c.bgSecondary,
      borderRadius: r.lg,
      padding: s.xl,
      marginHorizontal: s.xl,
      borderWidth: 1,
      borderColor: c.border,
      width: "100%" as const,
    },
    resultLabel: {
      ...t.caption,
      color: c.textMuted,
      textTransform: "uppercase" as const,
      marginBottom: s.xs,
    },
    resultText: {
      ...t.body,
      color: c.textPrimary,
      marginBottom: s.lg,
    },
    viewBtn: {
      backgroundColor: c.primary,
      borderRadius: r.md,
      paddingVertical: s.md,
      alignItems: "center" as const,
    },
    viewBtnText: { ...t.bodyMedium, color: "#fff", fontWeight: "700" as const },
    newBtn: {
      marginTop: s.md,
      paddingVertical: s.md,
      alignItems: "center" as const,
    },
    newBtnText: { ...t.body, color: c.primary },
  }));

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const startRecording = useCallback(async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permiso requerido", "Se necesita acceso al micrófono.");
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
      setState("recording");
      setDuration(0);
      haptics.medium();

      // Start pulse animation
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.2, { duration: 800 }),
          withTiming(0.6, { duration: 800 })
        ),
        -1
      );

      // Timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert("Error", "No se pudo iniciar la grabación");
    }
  }, [haptics, pulseScale, pulseOpacity]);

  const stopAndProcess = useCallback(async () => {
    if (!recordingRef.current || !user) return;

    // Stop timer & animation
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    cancelAnimation(pulseScale);
    cancelAnimation(pulseOpacity);
    pulseScale.value = 1;
    pulseOpacity.value = 0;

    setState("processing");
    haptics.light();

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error("No recording URI");

      // Read file as base64
      const base64 = await readAsStringAsync(uri, {
        encoding: "base64",
      });

      // Send to backend
      const result = await createTaskFromVoice(
        user.companyId,
        base64,
        "audio/m4a"
      );

      setTranscription(result.transcription);
      setCreatedTaskId(result.task.id);
      setState("done");
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ["agenda-tasks"] });
    } catch (error: any) {
      console.error("Voice task error:", error);
      Alert.alert(
        "Error",
        error.message || "No se pudo procesar el audio"
      );
      setState("idle");
    }
  }, [user, haptics, queryClient, pulseScale, pulseOpacity]);

  const resetAndRecordAgain = useCallback(() => {
    setState("idle");
    setDuration(0);
    setTranscription("");
    setCreatedTaskId(null);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedPressable
          style={styles.backBtn}
          onPress={() => router.back()}
          haptic="light"
        >
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>Tarea por voz</Text>
      </View>

      <View style={styles.content}>
        {state === "idle" && (
          <Animated.View
            entering={FadeIn}
            style={{ alignItems: "center" }}
          >
            <Text style={styles.instruction}>Grabá tu tarea</Text>
            <Text style={styles.subtitle}>
              Describí qué hay que hacer y la IA creará la tarea
              automáticamente
            </Text>
            <AnimatedPressable
              style={[styles.recordBtn, { backgroundColor: colors.recording }]}
              onPress={startRecording}
              haptic="medium"
            >
              <Ionicons name="mic" size={44} color="#fff" />
            </AnimatedPressable>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              Toca para grabar
            </Text>
          </Animated.View>
        )}

        {state === "recording" && (
          <Animated.View
            entering={FadeIn}
            style={{ alignItems: "center" }}
          >
            <Text style={styles.instruction}>Grabando...</Text>
            <Text style={styles.timer}>{formatDuration(duration)}</Text>
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <Animated.View style={[styles.pulseRing, pulseStyle]} />
              <AnimatedPressable
                style={[
                  styles.recordBtn,
                  { backgroundColor: colors.recording, zIndex: 1 },
                ]}
                onPress={stopAndProcess}
                haptic="medium"
              >
                <Ionicons name="stop" size={36} color="#fff" />
              </AnimatedPressable>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 16 }}>
              Toca para detener
            </Text>
          </Animated.View>
        )}

        {state === "processing" && (
          <Animated.View
            entering={FadeIn}
            style={{ alignItems: "center" }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                borderWidth: 4,
                borderColor: `${colors.primary}30`,
                borderTopColor: colors.primary,
                marginBottom: 24,
              }}
            />
            <Text style={styles.instruction}>Procesando...</Text>
            <Text style={styles.processingText}>
              Transcribiendo audio y creando tarea
            </Text>
          </Animated.View>
        )}

        {state === "done" && createdTaskId && (
          <Animated.View
            entering={FadeInDown.springify()}
            style={{ alignItems: "center", width: "100%" }}
          >
            <Ionicons
              name="checkmark-circle"
              size={64}
              color={colors.success}
              style={{ marginBottom: 16 }}
            />
            <Text style={styles.instruction}>Tarea creada</Text>

            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Transcripción</Text>
              <Text style={styles.resultText}>"{transcription}"</Text>

              <AnimatedPressable
                style={styles.viewBtn}
                onPress={() => router.replace(`/task/${createdTaskId}`)}
                haptic="medium"
              >
                <Text style={styles.viewBtnText}>Ver tarea</Text>
              </AnimatedPressable>

              <AnimatedPressable
                style={styles.newBtn}
                onPress={resetAndRecordAgain}
                haptic="light"
              >
                <Text style={styles.newBtnText}>Grabar otra</Text>
              </AnimatedPressable>
            </View>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}
