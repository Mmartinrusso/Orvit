import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TextInput,
  ActionSheetIOS,
  Platform,
  Alert,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { getTasks, updateTask, deleteTask } from "@/api/agenda";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCreateStyles } from "@/hooks/useCreateStyles";
import { useHaptics } from "@/hooks/useHaptics";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import Avatar from "@/components/ui/Avatar";
import type { AgendaTask, Priority, TaskStatus } from "@/types/agenda";

// ── Helpers ─────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<Priority, string> = {
  HIGH: "#ef4444",
  MEDIUM: "#f59e0b",
  LOW: "#6366f1",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  WAITING: "En espera",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

const STATUS_ICONS: Record<TaskStatus, string> = {
  PENDING: "radio-button-off",
  IN_PROGRESS: "time-outline",
  WAITING: "pause-circle-outline",
  COMPLETED: "checkmark-circle",
  CANCELLED: "close-circle",
};

function formatDueDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < -1) return `Venció hace ${Math.abs(diffDays)}d`;
  if (diffDays === -1) return "Venció ayer";
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Mañana";
  if (diffDays < 7) return date.toLocaleDateString("es", { weekday: "short" });
  return date.toLocaleDateString("es", { day: "numeric", month: "short" });
}

type FilterStatus = "all" | "active" | "completed";

// ── Task Item ───────────────────────────────────────────────────

function TaskItem({
  item,
  index,
  onLongPress,
  onToggleComplete,
}: {
  item: AgendaTask;
  index: number;
  onLongPress: (task: AgendaTask) => void;
  onToggleComplete: (task: AgendaTask) => void;
}) {
  const { colors } = useTheme();
  const styles = useCreateStyles((c, t, s, r) => ({
    item: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      paddingHorizontal: s.xl,
      paddingVertical: s.md + 2,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    checkbox: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginRight: s.md,
      marginTop: 2,
    },
    content: { flex: 1 },
    topRow: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "flex-start" as const,
      marginBottom: 4,
    },
    title: { ...t.bodyMedium, color: c.textPrimary, flex: 1, marginRight: s.sm },
    titleDone: { textDecorationLine: "line-through" as const, color: c.textMuted },
    bottomRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
      flexWrap: "wrap" as const,
    },
    chip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: r.full,
      gap: 4,
    },
    chipText: { ...t.tiny, fontWeight: "600" as const },
    subtaskText: { ...t.small, color: c.textMuted },
    assignee: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
    },
    assigneeName: { ...t.small, color: c.textSecondary },
  }));

  const isDone = item.status === "COMPLETED" || item.status === "CANCELLED";
  const dueLabel = formatDueDate(item.dueDate);
  const isOverdue =
    item.dueDate && new Date(item.dueDate) < new Date() && !isDone;
  const priorityColor = PRIORITY_COLORS[item.priority];

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(250)}>
      <AnimatedPressable
        style={styles.item}
        onPress={() => router.push(`/task/${item.id}`)}
        onLongPress={() => onLongPress(item)}
        haptic="selection"
      >
        {/* Checkbox */}
        <AnimatedPressable
          style={[
            styles.checkbox,
            {
              borderColor: isDone ? colors.success : priorityColor,
              backgroundColor: isDone ? colors.success : "transparent",
            },
          ]}
          onPress={() => onToggleComplete(item)}
          haptic="medium"
        >
          {isDone && (
            <Ionicons name="checkmark" size={16} color="#fff" />
          )}
        </AnimatedPressable>

        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text
              style={[styles.title, isDone && styles.titleDone]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
          </View>

          <View style={styles.bottomRow}>
            {/* Priority chip */}
            <View
              style={[
                styles.chip,
                { backgroundColor: `${priorityColor}18` },
              ]}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: priorityColor,
                }}
              />
              <Text style={[styles.chipText, { color: priorityColor }]}>
                {item.priority === "HIGH"
                  ? "Alta"
                  : item.priority === "MEDIUM"
                  ? "Media"
                  : "Baja"}
              </Text>
            </View>

            {/* Due date */}
            {dueLabel && (
              <View
                style={[
                  styles.chip,
                  {
                    backgroundColor: isOverdue
                      ? `${colors.error}15`
                      : `${colors.textMuted}12`,
                  },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={11}
                  color={isOverdue ? colors.error : colors.textMuted}
                />
                <Text
                  style={[
                    styles.chipText,
                    { color: isOverdue ? colors.error : colors.textMuted },
                  ]}
                >
                  {dueLabel}
                </Text>
              </View>
            )}

            {/* Subtask progress */}
            {(item._count.subtasks ?? 0) > 0 && (
              <Text style={styles.subtaskText}>
                {item._count.subtasksDone ?? 0}/{item._count.subtasks}
              </Text>
            )}

            {/* Assignee */}
            {item.assignedToName && (
              <View style={styles.assignee}>
                <Avatar name={item.assignedToName} size="sm" />
              </View>
            )}

            {/* Comment count */}
            {item._count.comments > 0 && (
              <View style={[styles.chip, { backgroundColor: "transparent" }]}>
                <Ionicons
                  name="chatbubble-outline"
                  size={11}
                  color={colors.textMuted}
                />
                <Text
                  style={[styles.chipText, { color: colors.textMuted }]}
                >
                  {item._count.comments}
                </Text>
              </View>
            )}
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────

export default function AgendaScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterStatus>("active");
  const [search, setSearch] = useState("");

  const styles = useCreateStyles((c, t, s, r) => ({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      paddingHorizontal: s.xl,
      paddingTop: s.lg,
      paddingBottom: s.sm,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
    },
    headerTitle: { ...t.title, color: c.textPrimary },
    searchContainer: { marginHorizontal: s.xl, marginBottom: s.sm },
    searchInputRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: c.bgInput,
      borderRadius: r.md,
      paddingHorizontal: s.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    searchInput: {
      flex: 1,
      ...t.body,
      color: c.textPrimary,
      paddingVertical: s.sm + 2,
      paddingHorizontal: s.sm,
    },
    filters: {
      flexDirection: "row" as const,
      marginHorizontal: s.xl,
      marginBottom: s.md,
      gap: s.sm,
    },
    filterChip: {
      paddingHorizontal: s.md,
      paddingVertical: s.xs + 2,
      borderRadius: r.full,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgSecondary,
    },
    filterChipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    filterChipText: { ...t.caption, color: c.textSecondary },
    filterChipTextActive: { color: "#fff", fontWeight: "700" as const },
    empty: { flex: 1 },
    emptyState: {
      flex: 1,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      paddingTop: 100,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: c.bgTertiary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginBottom: s.lg,
    },
    emptyText: { ...t.heading, color: c.textPrimary, marginBottom: s.xs },
    emptySubtext: {
      ...t.body,
      color: c.textSecondary,
      textAlign: "center" as const,
      paddingHorizontal: s.xxxl,
    },
    fab: {
      position: "absolute" as const,
      bottom: s.xl,
      right: s.xl,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.primary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 8,
    },
    statsRow: {
      flexDirection: "row" as const,
      marginHorizontal: s.xl,
      marginBottom: s.md,
      gap: s.sm,
    },
    statCard: {
      flex: 1,
      backgroundColor: c.bgSecondary,
      borderRadius: r.md,
      padding: s.md,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center" as const,
    },
    statValue: { ...t.heading, color: c.textPrimary },
    statLabel: { ...t.tiny, color: c.textMuted, marginTop: 2 },
  }));

  // Determine API status param based on filter
  const statusParam = useMemo(() => {
    if (filter === "completed") return "COMPLETED";
    if (filter === "active") return "PENDING,IN_PROGRESS,WAITING";
    return undefined;
  }, [filter]);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["agenda-tasks", { status: statusParam, search }],
    queryFn: () =>
      getTasks({
        companyId: user?.companyId ?? 0,
        status: statusParam,
        search: search.trim() || undefined,
        sortBy: "dueDate",
        sortOrder: "asc",
        pageSize: 100,
      }),
    enabled: !!user,
  });

  const tasks = data?.tasks ?? [];

  const handleToggleComplete = useCallback(
    async (task: AgendaTask) => {
      haptics.medium();
      const newStatus = task.status === "COMPLETED" ? "PENDING" : "COMPLETED";
      try {
        await updateTask(task.id, { status: newStatus });
        queryClient.invalidateQueries({ queryKey: ["agenda-tasks"] });
        haptics.success();
      } catch {
        Alert.alert("Error", "No se pudo actualizar la tarea");
      }
    },
    [haptics, queryClient]
  );

  const handleLongPress = useCallback(
    (task: AgendaTask) => {
      haptics.medium();

      const statusOptions: TaskStatus[] = [
        "PENDING",
        "IN_PROGRESS",
        "WAITING",
        "COMPLETED",
      ];
      const options = [
        "Ver detalle",
        ...statusOptions
          .filter((s) => s !== task.status)
          .map((s) => `→ ${STATUS_LABELS[s]}`),
        "Eliminar",
        "Cancelar",
      ];
      const destructiveButtonIndex = options.length - 2;
      const cancelButtonIndex = options.length - 1;

      const handleAction = async (buttonIndex: number) => {
        if (buttonIndex === 0) {
          router.push(`/task/${task.id}`);
        } else if (buttonIndex === cancelButtonIndex) {
          return;
        } else if (buttonIndex === destructiveButtonIndex) {
          Alert.alert(
            "Eliminar tarea",
            `¿Eliminar "${task.title}"?`,
            [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Eliminar",
                style: "destructive",
                onPress: async () => {
                  try {
                    await deleteTask(task.id);
                    queryClient.invalidateQueries({
                      queryKey: ["agenda-tasks"],
                    });
                    haptics.success();
                  } catch {
                    Alert.alert("Error", "No se pudo eliminar");
                  }
                },
              },
            ]
          );
        } else {
          // Status change
          const availableStatuses = statusOptions.filter(
            (s) => s !== task.status
          );
          const newStatus = availableStatuses[buttonIndex - 1];
          if (newStatus) {
            try {
              await updateTask(task.id, { status: newStatus });
              queryClient.invalidateQueries({ queryKey: ["agenda-tasks"] });
              haptics.success();
            } catch {
              Alert.alert("Error", "No se pudo actualizar");
            }
          }
        }
      };

      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          { options, cancelButtonIndex, destructiveButtonIndex },
          handleAction
        );
      } else {
        // Android: use Alert with all options
        Alert.alert(
          "Opciones",
          task.title,
          [
            { text: "Ver detalle", onPress: () => handleAction(0) },
            ...statusOptions
              .filter((s) => s !== task.status)
              .map((s, i) => ({
                text: `→ ${STATUS_LABELS[s]}`,
                onPress: () => handleAction(i + 1),
              })),
            {
              text: "Eliminar",
              style: "destructive" as const,
              onPress: () => handleAction(destructiveButtonIndex),
            },
            { text: "Cancelar", style: "cancel" as const },
          ]
        );
      }
    },
    [haptics, queryClient]
  );

  // Stats
  const totalTasks = data?.totalCount ?? 0;
  const completedCount = tasks.filter(
    (t) => t.status === "COMPLETED"
  ).length;
  const overdueCount = tasks.filter(
    (t) =>
      t.dueDate &&
      new Date(t.dueDate) < new Date() &&
      t.status !== "COMPLETED" &&
      t.status !== "CANCELLED"
  ).length;

  const emptyText = search
    ? "Sin resultados"
    : filter === "completed"
    ? "No hay tareas completadas"
    : "No hay tareas pendientes";
  const emptySubtext = search
    ? "Probá con otro término"
    : "Toca + para crear una tarea";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Agenda</Text>
        <AnimatedPressable
          onPress={() => router.push("/voice-task")}
          haptic="medium"
          style={{ padding: 4 }}
        >
          <Ionicons name="mic-outline" size={24} color={colors.primary} />
        </AnimatedPressable>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputRow}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar tarea..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <AnimatedPressable onPress={() => setSearch("")} haptic="light">
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </AnimatedPressable>
          )}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalTasks}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.success }]}>
            {completedCount}
          </Text>
          <Text style={styles.statLabel}>Completadas</Text>
        </View>
        <View style={styles.statCard}>
          <Text
            style={[
              styles.statValue,
              { color: overdueCount > 0 ? colors.error : colors.textPrimary },
            ]}
          >
            {overdueCount}
          </Text>
          <Text style={styles.statLabel}>Vencidas</Text>
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filters}>
        {(["active", "completed", "all"] as FilterStatus[]).map((f) => (
          <AnimatedPressable
            key={f}
            style={[
              styles.filterChip,
              filter === f && styles.filterChipActive,
            ]}
            onPress={() => setFilter(f)}
            haptic="selection"
          >
            <Text
              style={[
                styles.filterChipText,
                filter === f && styles.filterChipTextActive,
              ]}
            >
              {f === "active"
                ? "Activas"
                : f === "completed"
                ? "Completadas"
                : "Todas"}
            </Text>
          </AnimatedPressable>
        ))}
      </View>

      {/* Task List */}
      {isLoading ? (
        <View style={{ padding: 20, alignItems: "center" }}>
          <Text style={{ color: colors.textMuted }}>Cargando tareas...</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => (
            <TaskItem
              item={item}
              index={index}
              onLongPress={handleLongPress}
              onToggleComplete={handleToggleComplete}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                haptics.light();
                refetch();
              }}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={!tasks.length ? styles.empty : undefined}
          ListEmptyComponent={
            <Animated.View
              entering={FadeInDown.delay(200)}
              style={styles.emptyState}
            >
              <View style={styles.emptyIcon}>
                <Ionicons
                  name={search ? "search-outline" : "checkbox-outline"}
                  size={32}
                  color={colors.textMuted}
                />
              </View>
              <Text style={styles.emptyText}>{emptyText}</Text>
              <Text style={styles.emptySubtext}>{emptySubtext}</Text>
            </Animated.View>
          }
        />
      )}

      {/* FAB */}
      <Animated.View entering={FadeInRight.delay(400).springify()}>
        <AnimatedPressable
          style={styles.fab}
          onPress={() => router.push("/create-task")}
          haptic="medium"
        >
          <Ionicons name="add" size={28} color="#fff" />
        </AnimatedPressable>
      </Animated.View>
    </SafeAreaView>
  );
}
