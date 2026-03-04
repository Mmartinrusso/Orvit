import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import {
  getTask,
  updateTask,
  deleteTask,
  getSubtasks,
  createSubtask,
  toggleSubtask,
  getComments,
  addComment,
} from "@/api/agenda";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCreateStyles } from "@/hooks/useCreateStyles";
import { useHaptics } from "@/hooks/useHaptics";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import Avatar from "@/components/ui/Avatar";
import type { TaskStatus, Priority } from "@/types/agenda";

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

const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  WAITING: "En espera",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

const STATUS_ICONS: Record<TaskStatus, keyof typeof Ionicons.glyphMap> = {
  PENDING: "radio-button-off",
  IN_PROGRESS: "time-outline",
  WAITING: "pause-circle-outline",
  COMPLETED: "checkmark-circle",
  CANCELLED: "close-circle",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  PENDING: "#6366f1",
  IN_PROGRESS: "#3b82f6",
  WAITING: "#f59e0b",
  COMPLETED: "#10b981",
  CANCELLED: "#ef4444",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Sin fecha";
  return new Date(dateStr).toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin}m`;
  if (diffHrs < 24) return `hace ${diffHrs}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;
  return date.toLocaleDateString("es", { day: "numeric", month: "short" });
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskId = Number(id);
  const { user } = useAuth();
  const { colors } = useTheme();
  const haptics = useHaptics();
  const queryClient = useQueryClient();

  const [newSubtask, setNewSubtask] = useState("");
  const [newComment, setNewComment] = useState("");
  const [isSending, setIsSending] = useState(false);
  const commentInputRef = useRef<TextInput>(null);

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
    moreBtn: { padding: s.xs },
    scroll: { flex: 1, paddingHorizontal: s.xl, paddingTop: s.lg },
    title: { ...t.title, color: c.textPrimary, marginBottom: s.sm },
    description: {
      ...t.body,
      color: c.textSecondary,
      marginBottom: s.xl,
      lineHeight: 22,
    },
    metaRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: s.md,
      gap: s.md,
    },
    metaLabel: { ...t.caption, color: c.textMuted, width: 80 },
    metaValue: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
    },
    statusChip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: s.md,
      paddingVertical: s.xs,
      borderRadius: r.full,
      gap: 6,
    },
    statusText: { ...t.caption, fontWeight: "700" as const },
    priorityDot: { width: 8, height: 8, borderRadius: 4 },
    sectionTitle: {
      ...t.subheading,
      color: c.textPrimary,
      marginTop: s.xxl,
      marginBottom: s.md,
    },
    subtaskItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingVertical: s.sm,
      gap: s.sm,
    },
    subtaskText: { ...t.body, color: c.textPrimary, flex: 1 },
    subtaskDone: {
      textDecorationLine: "line-through" as const,
      color: c.textMuted,
    },
    addSubtaskRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginTop: s.sm,
      gap: s.sm,
    },
    subtaskInput: {
      flex: 1,
      ...t.body,
      color: c.textPrimary,
      backgroundColor: c.bgInput,
      borderRadius: r.sm,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
      borderWidth: 1,
      borderColor: c.border,
    },
    commentCard: {
      backgroundColor: c.bgSecondary,
      borderRadius: r.md,
      padding: s.md,
      marginBottom: s.sm,
      borderWidth: 1,
      borderColor: c.border,
    },
    commentHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: s.xs,
      gap: s.sm,
    },
    commentAuthor: { ...t.caption, color: c.textPrimary, fontWeight: "600" as const },
    commentTime: { ...t.small, color: c.textMuted },
    commentText: { ...t.body, color: c.textSecondary },
    inputBar: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: s.lg,
      paddingVertical: s.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.bgSecondary,
      gap: s.sm,
    },
    commentInput: {
      flex: 1,
      ...t.body,
      color: c.textPrimary,
      backgroundColor: c.bgInput,
      borderRadius: r.lg,
      paddingHorizontal: s.lg,
      paddingVertical: s.sm + 2,
      maxHeight: 100,
      borderWidth: 1,
      borderColor: c.border,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    sendBtnDisabled: { opacity: 0.4 },
    createdInfo: {
      ...t.small,
      color: c.textMuted,
      marginBottom: s.xxl,
    },
    assigneeRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: s.sm,
    },
  }));

  // Queries
  const { data: task, isLoading } = useQuery({
    queryKey: ["agenda-task", taskId],
    queryFn: () => getTask(taskId),
    enabled: !!taskId,
  });

  const { data: subtasks = [] } = useQuery({
    queryKey: ["agenda-subtasks", taskId],
    queryFn: () => getSubtasks(taskId),
    enabled: !!taskId,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["agenda-comments", taskId],
    queryFn: () => getComments(taskId),
    enabled: !!taskId,
  });

  // Handlers
  const handleStatusChange = useCallback(() => {
    if (!task) return;
    haptics.medium();

    const statuses: TaskStatus[] = [
      "PENDING",
      "IN_PROGRESS",
      "WAITING",
      "COMPLETED",
      "CANCELLED",
    ];
    const options = [
      ...statuses.map((s) => STATUS_LABELS[s]),
      "Cancelar",
    ];
    const cancelButtonIndex = options.length - 1;

    const handleAction = async (idx: number) => {
      if (idx === cancelButtonIndex) return;
      const newStatus = statuses[idx];
      if (newStatus === task.status) return;
      try {
        await updateTask(task.id, { status: newStatus });
        queryClient.invalidateQueries({ queryKey: ["agenda-task", taskId] });
        queryClient.invalidateQueries({ queryKey: ["agenda-tasks"] });
        haptics.success();
      } catch {
        Alert.alert("Error", "No se pudo actualizar el estado");
      }
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex },
        handleAction
      );
    } else {
      Alert.alert(
        "Cambiar estado",
        undefined,
        [
          ...statuses.map((s, i) => ({
            text: STATUS_LABELS[s],
            onPress: () => handleAction(i),
          })),
          { text: "Cancelar", style: "cancel" as const },
        ]
      );
    }
  }, [task, haptics, queryClient, taskId]);

  const handlePriorityChange = useCallback(() => {
    if (!task) return;
    haptics.medium();

    const priorities: Priority[] = ["LOW", "MEDIUM", "HIGH"];
    const options = [...priorities.map((p) => PRIORITY_LABELS[p]), "Cancelar"];
    const cancelButtonIndex = options.length - 1;

    const handleAction = async (idx: number) => {
      if (idx === cancelButtonIndex) return;
      const newPriority = priorities[idx];
      if (newPriority === task.priority) return;
      try {
        await updateTask(task.id, { priority: newPriority });
        queryClient.invalidateQueries({ queryKey: ["agenda-task", taskId] });
        queryClient.invalidateQueries({ queryKey: ["agenda-tasks"] });
        haptics.success();
      } catch {
        Alert.alert("Error", "No se pudo cambiar la prioridad");
      }
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex },
        handleAction
      );
    } else {
      Alert.alert("Cambiar prioridad", undefined, [
        ...priorities.map((p, i) => ({
          text: PRIORITY_LABELS[p],
          onPress: () => handleAction(i),
        })),
        { text: "Cancelar", style: "cancel" as const },
      ]);
    }
  }, [task, haptics, queryClient, taskId]);

  const handleDelete = useCallback(() => {
    if (!task) return;
    Alert.alert("Eliminar tarea", `¿Eliminar "${task.title}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTask(task.id);
            queryClient.invalidateQueries({ queryKey: ["agenda-tasks"] });
            haptics.success();
            router.back();
          } catch {
            Alert.alert("Error", "No se pudo eliminar");
          }
        },
      },
    ]);
  }, [task, haptics, queryClient]);

  const handleMoreOptions = useCallback(() => {
    haptics.medium();
    const options = ["Eliminar tarea", "Cancelar"];
    const destructiveButtonIndex = 0;
    const cancelButtonIndex = 1;

    const handleAction = (idx: number) => {
      if (idx === 0) handleDelete();
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex, destructiveButtonIndex },
        handleAction
      );
    } else {
      Alert.alert("Opciones", undefined, [
        {
          text: "Eliminar tarea",
          style: "destructive",
          onPress: handleDelete,
        },
        { text: "Cancelar", style: "cancel" },
      ]);
    }
  }, [haptics, handleDelete]);

  const handleToggleSubtask = useCallback(
    async (subtaskId: number, done: boolean) => {
      haptics.selection();
      try {
        await toggleSubtask(taskId, subtaskId, !done);
        queryClient.invalidateQueries({
          queryKey: ["agenda-subtasks", taskId],
        });
        queryClient.invalidateQueries({ queryKey: ["agenda-tasks"] });
      } catch {
        Alert.alert("Error", "No se pudo actualizar la subtarea");
      }
    },
    [taskId, haptics, queryClient]
  );

  const handleAddSubtask = useCallback(async () => {
    if (!newSubtask.trim()) return;
    haptics.light();
    try {
      await createSubtask(taskId, newSubtask.trim());
      setNewSubtask("");
      queryClient.invalidateQueries({
        queryKey: ["agenda-subtasks", taskId],
      });
      queryClient.invalidateQueries({ queryKey: ["agenda-tasks"] });
    } catch {
      Alert.alert("Error", "No se pudo crear la subtarea");
    }
  }, [newSubtask, taskId, haptics, queryClient]);

  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || isSending) return;
    setIsSending(true);
    haptics.light();
    try {
      await addComment(taskId, newComment.trim());
      setNewComment("");
      queryClient.invalidateQueries({
        queryKey: ["agenda-comments", taskId],
      });
    } catch {
      Alert.alert("Error", "No se pudo agregar el comentario");
    } finally {
      setIsSending(false);
    }
  }, [newComment, isSending, taskId, haptics, queryClient]);

  if (isLoading || !task) {
    return (
      <SafeAreaView style={styles.container}>
        <View
          style={[
            styles.header,
            { justifyContent: "center", paddingVertical: 16 },
          ]}
        >
          <Text style={{ color: colors.textMuted }}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = STATUS_COLORS[task.status];

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
        <Text style={styles.headerTitle} numberOfLines={1}>
          Tarea
        </Text>
        <AnimatedPressable
          style={styles.moreBtn}
          onPress={handleMoreOptions}
          haptic="light"
        >
          <Ionicons
            name="ellipsis-vertical"
            size={22}
            color={colors.textMuted}
          />
        </AnimatedPressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Title */}
          <Text style={styles.title}>{task.title}</Text>

          {/* Description */}
          {task.description && (
            <Text style={styles.description}>{task.description}</Text>
          )}

          {/* Meta: Status */}
          <AnimatedPressable onPress={handleStatusChange} haptic="selection">
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Estado</Text>
              <View
                style={[
                  styles.statusChip,
                  { backgroundColor: `${statusColor}18` },
                ]}
              >
                <Ionicons
                  name={STATUS_ICONS[task.status]}
                  size={16}
                  color={statusColor}
                />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {STATUS_LABELS[task.status]}
                </Text>
              </View>
            </View>
          </AnimatedPressable>

          {/* Meta: Priority */}
          <AnimatedPressable onPress={handlePriorityChange} haptic="selection">
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Prioridad</Text>
              <View style={styles.metaValue}>
                <View
                  style={[
                    styles.priorityDot,
                    { backgroundColor: PRIORITY_COLORS[task.priority] },
                  ]}
                />
                <Text
                  style={{
                    color: PRIORITY_COLORS[task.priority],
                    fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  {PRIORITY_LABELS[task.priority]}
                </Text>
              </View>
            </View>
          </AnimatedPressable>

          {/* Meta: Due Date */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Fecha</Text>
            <View style={styles.metaValue}>
              <Ionicons
                name="calendar-outline"
                size={16}
                color={colors.textSecondary}
              />
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                {formatDate(task.dueDate)}
              </Text>
            </View>
          </View>

          {/* Meta: Assignee */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Asignado</Text>
            {task.assignedToName ? (
              <View style={styles.assigneeRow}>
                <Avatar name={task.assignedToName} size="sm" />
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                  {task.assignedToName}
                </Text>
              </View>
            ) : (
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                Sin asignar
              </Text>
            )}
          </View>

          {/* Meta: Category */}
          {task.category && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Categoría</Text>
              <View style={styles.metaValue}>
                <Ionicons
                  name="pricetag-outline"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                  {task.category}
                </Text>
              </View>
            </View>
          )}

          {/* Meta: Group */}
          {task.group && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Grupo</Text>
              <View style={styles.metaValue}>
                <Ionicons
                  name="folder-outline"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                  {task.group.name}
                </Text>
              </View>
            </View>
          )}

          {/* Created info */}
          <Text style={styles.createdInfo}>
            Creada por {task.createdBy.name} · {formatTime(task.createdAt)}
          </Text>

          {/* ── Subtasks ────────────────────────── */}
          <Text style={styles.sectionTitle}>
            Subtareas{" "}
            {subtasks.length > 0 && (
              <Text style={{ color: colors.textMuted, fontWeight: "400" }}>
                ({subtasks.filter((s) => s.done).length}/{subtasks.length})
              </Text>
            )}
          </Text>

          {subtasks.map((sub, i) => (
            <Animated.View
              key={sub.id}
              entering={FadeIn.delay(i * 30)}
            >
              <AnimatedPressable
                style={styles.subtaskItem}
                onPress={() => handleToggleSubtask(sub.id, sub.done)}
                haptic="selection"
              >
                <Ionicons
                  name={sub.done ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={sub.done ? colors.success : colors.textMuted}
                />
                <Text
                  style={[
                    styles.subtaskText,
                    sub.done && styles.subtaskDone,
                  ]}
                >
                  {sub.title}
                </Text>
              </AnimatedPressable>
            </Animated.View>
          ))}

          {/* Add subtask */}
          <View style={styles.addSubtaskRow}>
            <TextInput
              style={styles.subtaskInput}
              placeholder="Agregar subtarea..."
              placeholderTextColor={colors.textMuted}
              value={newSubtask}
              onChangeText={setNewSubtask}
              onSubmitEditing={handleAddSubtask}
              returnKeyType="done"
            />
            {newSubtask.trim().length > 0 && (
              <AnimatedPressable onPress={handleAddSubtask} haptic="light">
                <Ionicons
                  name="add-circle"
                  size={32}
                  color={colors.primary}
                />
              </AnimatedPressable>
            )}
          </View>

          {/* ── Comments ────────────────────────── */}
          <Text style={styles.sectionTitle}>
            Comentarios{" "}
            {comments.length > 0 && (
              <Text style={{ color: colors.textMuted, fontWeight: "400" }}>
                ({comments.length})
              </Text>
            )}
          </Text>

          {comments.length === 0 && (
            <Text style={{ color: colors.textMuted, marginBottom: 16 }}>
              Sin comentarios aún
            </Text>
          )}

          {comments.map((c, i) => (
            <Animated.View
              key={c.id}
              entering={FadeInDown.delay(i * 40)}
            >
              <View style={styles.commentCard}>
                <View style={styles.commentHeader}>
                  <Avatar name={c.author.name} size="sm" />
                  <Text style={styles.commentAuthor}>{c.author.name}</Text>
                  <Text style={styles.commentTime}>
                    {formatTime(c.createdAt)}
                  </Text>
                </View>
                <Text style={styles.commentText}>{c.content}</Text>
              </View>
            </Animated.View>
          ))}

          {/* Bottom spacing for comment input */}
          <View style={{ height: 80 }} />
        </ScrollView>

        {/* Comment Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            ref={commentInputRef}
            style={styles.commentInput}
            placeholder="Escribir comentario..."
            placeholderTextColor={colors.textMuted}
            value={newComment}
            onChangeText={setNewComment}
            multiline
          />
          <AnimatedPressable
            style={[
              styles.sendBtn,
              (!newComment.trim() || isSending) && styles.sendBtnDisabled,
            ]}
            onPress={handleAddComment}
            haptic="light"
            disabled={!newComment.trim() || isSending}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
