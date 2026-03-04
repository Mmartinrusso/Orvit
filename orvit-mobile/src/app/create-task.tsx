import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  ActionSheetIOS,
  KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { createTask } from "@/api/agenda";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCreateStyles } from "@/hooks/useCreateStyles";
import { useHaptics } from "@/hooks/useHaptics";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import type { Priority } from "@/types/agenda";

const PRIORITY_COLORS: Record<Priority, string> = {
  HIGH: "#ef4444",
  MEDIUM: "#f59e0b",
  LOW: "#6366f1",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};

export default function CreateTaskScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const haptics = useHaptics();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const styles = useCreateStyles((c, t, s, r) => ({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      paddingHorizontal: s.lg,
      paddingVertical: s.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.bgSecondary,
    },
    backBtn: { padding: s.xs },
    headerTitle: { ...t.subheading, color: c.textPrimary },
    saveBtn: {
      paddingHorizontal: s.lg,
      paddingVertical: s.sm,
      borderRadius: r.sm,
      backgroundColor: c.primary,
    },
    saveBtnDisabled: { opacity: 0.4 },
    saveBtnText: { ...t.caption, color: "#fff", fontWeight: "700" as const },
    scroll: { flex: 1, padding: s.xl },
    label: {
      ...t.caption,
      color: c.textMuted,
      marginBottom: s.xs,
      marginTop: s.lg,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
    },
    input: {
      ...t.body,
      color: c.textPrimary,
      backgroundColor: c.bgInput,
      borderRadius: r.md,
      paddingHorizontal: s.lg,
      paddingVertical: s.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    textArea: { minHeight: 100, textAlignVertical: "top" as const },
    priorityRow: {
      flexDirection: "row" as const,
      gap: s.sm,
      marginTop: s.xs,
    },
    priorityChip: {
      flex: 1,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingVertical: s.md,
      borderRadius: r.md,
      borderWidth: 2,
      gap: 6,
    },
    priorityText: { ...t.caption, fontWeight: "700" as const },
    dateHint: {
      ...t.small,
      color: c.textMuted,
      marginTop: s.xs,
    },
  }));

  const canSubmit = title.trim().length > 0 && !isSubmitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !user) return;
    setIsSubmitting(true);
    haptics.medium();

    try {
      const task = await createTask(user.companyId, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate.trim() || undefined,
        source: "MOBILE",
      });
      queryClient.invalidateQueries({ queryKey: ["agenda-tasks"] });
      haptics.success();
      router.replace(`/task/${task.id}`);
    } catch {
      Alert.alert("Error", "No se pudo crear la tarea");
      setIsSubmitting(false);
    }
  }, [canSubmit, user, title, description, priority, dueDate, haptics, queryClient]);

  const handlePickPriority = useCallback(
    (p: Priority) => {
      haptics.selection();
      setPriority(p);
    },
    [haptics]
  );

  const handlePickDate = useCallback(() => {
    haptics.selection();
    const options = [
      "Hoy",
      "Mañana",
      "En 3 días",
      "En 1 semana",
      "Sin fecha",
      "Cancelar",
    ];
    const cancelButtonIndex = options.length - 1;

    const handleAction = (idx: number) => {
      const now = new Date();
      let date: Date | null = null;

      if (idx === 0) date = now;
      else if (idx === 1) {
        date = new Date(now);
        date.setDate(date.getDate() + 1);
      } else if (idx === 2) {
        date = new Date(now);
        date.setDate(date.getDate() + 3);
      } else if (idx === 3) {
        date = new Date(now);
        date.setDate(date.getDate() + 7);
      } else if (idx === 4) {
        setDueDate("");
        return;
      }

      if (date) {
        setDueDate(date.toISOString().split("T")[0]);
      }
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex },
        handleAction
      );
    } else {
      Alert.alert("Fecha de vencimiento", undefined, [
        { text: "Hoy", onPress: () => handleAction(0) },
        { text: "Mañana", onPress: () => handleAction(1) },
        { text: "En 3 días", onPress: () => handleAction(2) },
        { text: "En 1 semana", onPress: () => handleAction(3) },
        { text: "Sin fecha", onPress: () => handleAction(4) },
        { text: "Cancelar", style: "cancel" },
      ]);
    }
  }, [haptics]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedPressable
          style={styles.backBtn}
          onPress={() => router.back()}
          haptic="light"
        >
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>Nueva Tarea</Text>
        <AnimatedPressable
          style={[styles.saveBtn, !canSubmit && styles.saveBtnDisabled]}
          onPress={handleSubmit}
          haptic="medium"
          disabled={!canSubmit}
        >
          <Text style={styles.saveBtnText}>Crear</Text>
        </AnimatedPressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Title */}
          <Text style={styles.label}>Título *</Text>
          <TextInput
            style={styles.input}
            placeholder="¿Qué hay que hacer?"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
            autoFocus
          />

          {/* Description */}
          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Detalles adicionales..."
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          {/* Priority */}
          <Text style={styles.label}>Prioridad</Text>
          <View style={styles.priorityRow}>
            {(["LOW", "MEDIUM", "HIGH"] as Priority[]).map((p) => {
              const isActive = priority === p;
              const color = PRIORITY_COLORS[p];
              return (
                <AnimatedPressable
                  key={p}
                  style={[
                    styles.priorityChip,
                    {
                      borderColor: isActive ? color : colors.border,
                      backgroundColor: isActive ? `${color}15` : "transparent",
                    },
                  ]}
                  onPress={() => handlePickPriority(p)}
                  haptic="selection"
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: color,
                    }}
                  />
                  <Text
                    style={[
                      styles.priorityText,
                      { color: isActive ? color : colors.textSecondary },
                    ]}
                  >
                    {PRIORITY_LABELS[p]}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>

          {/* Due Date */}
          <Text style={styles.label}>Fecha de vencimiento</Text>
          <AnimatedPressable onPress={handlePickDate} haptic="selection">
            <View
              style={[
                styles.input,
                {
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                },
              ]}
            >
              <Text
                style={{
                  color: dueDate ? colors.textPrimary : colors.textMuted,
                  fontSize: 15,
                }}
              >
                {dueDate
                  ? new Date(dueDate + "T12:00:00").toLocaleDateString("es", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })
                  : "Seleccionar fecha"}
              </Text>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={colors.textMuted}
              />
            </View>
          </AnimatedPressable>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
