import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActionSheetIOS,
  Platform,
  Alert,
  TextInput,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn, FadeInRight } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { getConversations, updateConversation } from "@/api/chat";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCreateStyles } from "@/hooks/useCreateStyles";
import { useHaptics } from "@/hooks/useHaptics";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import Avatar from "@/components/ui/Avatar";
import { SkeletonConversation } from "@/components/ui/Skeleton";
import type { Conversation } from "@/types/chat";

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) {
    return date.toLocaleDateString("es", { weekday: "short" });
  }
  return date.toLocaleDateString("es", { day: "numeric", month: "short" });
}

function ConversationItem({
  item,
  userId,
  index,
  onLongPress,
}: {
  item: Conversation;
  userId: number;
  index: number;
  onLongPress: (conv: Conversation) => void;
}) {
  const { colors } = useTheme();
  const styles = useCreateStyles((c, t, s, r) => ({
    item: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: s.xl,
      paddingVertical: s.md + 2,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    content: { flex: 1, marginLeft: s.md },
    topRow: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: 3,
    },
    name: { ...t.bodyMedium, color: c.textPrimary, flex: 1, marginRight: s.sm },
    time: { ...t.small, color: c.textMuted },
    bottomRow: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
    },
    preview: { ...t.small, color: c.textSecondary, flex: 1, marginRight: s.sm },
    badge: {
      backgroundColor: c.badge,
      borderRadius: r.full,
      minWidth: 22,
      height: 22,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      paddingHorizontal: 6,
    },
    badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" as const },
  }));

  const displayName =
    item.type === "DIRECT"
      ? item.members?.find((m) => m.userId !== userId)?.user?.name || "Chat directo"
      : item.name || "Sin nombre";

  const hasUnread = (item.unreadCount ?? 0) > 0;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <AnimatedPressable
        style={styles.item}
        onPress={() => router.push(`/chat/${item.id}`)}
        onLongPress={() => onLongPress(item)}
        haptic="selection"
      >
        <Avatar name={displayName} size="md" />
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text
              style={[styles.name, hasUnread && { fontWeight: "700" }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            {item.lastMessageAt && (
              <Text
                style={[styles.time, hasUnread && { color: colors.primary }]}
              >
                {formatTime(item.lastMessageAt)}
              </Text>
            )}
          </View>
          <View style={styles.bottomRow}>
            <Text
              style={[styles.preview, hasUnread && { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {item.lastMessageText || "Sin mensajes"}
            </Text>
            {hasUnread && (
              <Animated.View entering={FadeIn.springify()} style={styles.badge}>
                <Text style={styles.badgeText}>{item.unreadCount}</Text>
              </Animated.View>
            )}
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function InboxScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
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
    searchContainer: {
      marginHorizontal: s.xl,
      marginBottom: s.sm,
    },
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
    tabs: {
      flexDirection: "row" as const,
      marginHorizontal: s.xl,
      marginBottom: s.md,
      backgroundColor: c.bgSecondary,
      borderRadius: r.md,
      padding: 3,
      borderWidth: 1,
      borderColor: c.border,
    },
    tab: {
      flex: 1,
      paddingVertical: s.sm,
      borderRadius: r.sm + 2,
      alignItems: "center" as const,
    },
    tabActive: { backgroundColor: c.primary },
    tabText: { ...t.caption, color: c.textSecondary },
    tabTextActive: { color: "#fff", fontWeight: "700" as const },
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
  }));

  const isArchived = activeTab === "archived";

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["conversations", { archived: isArchived }],
    queryFn: () => getConversations({ archived: isArchived, limit: 50 }),
    enabled: !!user,
  });

  // Filter conversations by search
  const filteredConversations = useMemo(() => {
    const convs = data?.conversations || [];
    if (!search.trim()) return convs;
    const q = search.toLowerCase();
    return convs.filter((c) => {
      const name =
        c.type === "DIRECT"
          ? c.members?.find((m) => m.userId !== user?.id)?.user?.name || ""
          : c.name || "";
      return (
        name.toLowerCase().includes(q) ||
        (c.lastMessageText || "").toLowerCase().includes(q)
      );
    });
  }, [data?.conversations, search, user?.id]);

  const handleLongPress = useCallback(
    (conv: Conversation) => {
      haptics.medium();

      const archiveLabel = conv.isArchived ? "Desarchivar" : "Archivar";
      const options = ["Info del chat", archiveLabel, "Cancelar"];
      const cancelButtonIndex = options.length - 1;

      const handleAction = async (buttonIndex: number) => {
        if (buttonIndex === 0) {
          router.push(`/chat-info/${conv.id}`);
        } else if (buttonIndex === 1) {
          try {
            await updateConversation(conv.id, {
              isArchived: !conv.isArchived,
            });
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            haptics.success();
          } catch {
            Alert.alert("Error", "No se pudo actualizar la conversación");
          }
        }
      };

      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          { options, cancelButtonIndex },
          handleAction
        );
      } else {
        Alert.alert("Opciones", undefined, [
          { text: "Info del chat", onPress: () => handleAction(0) },
          { text: archiveLabel, onPress: () => handleAction(1) },
          { text: "Cancelar", style: "cancel" },
        ]);
      }
    },
    [haptics, queryClient]
  );

  const emptyText = isArchived
    ? "No hay chats archivados"
    : search
    ? "Sin resultados"
    : "No hay conversaciones";
  const emptySubtext = isArchived
    ? "Los chats que archives aparecerán aquí"
    : search
    ? "Probá con otro término de búsqueda"
    : "Toca + para iniciar una conversación";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chat</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputRow}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar conversación..."
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

      {/* Tabs */}
      <View style={styles.tabs}>
        <AnimatedPressable
          style={[styles.tab, activeTab === "active" && styles.tabActive]}
          onPress={() => setActiveTab("active")}
          haptic="selection"
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "active" && styles.tabTextActive,
            ]}
          >
            Activos
          </Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={[styles.tab, activeTab === "archived" && styles.tabActive]}
          onPress={() => setActiveTab("archived")}
          haptic="selection"
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "archived" && styles.tabTextActive,
            ]}
          >
            Archivados
          </Text>
        </AnimatedPressable>
      </View>

      {/* List */}
      {isLoading ? (
        <View>
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonConversation key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <ConversationItem
              item={item}
              userId={user?.id ?? 0}
              index={index}
              onLongPress={handleLongPress}
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
          contentContainerStyle={
            !filteredConversations.length ? styles.empty : undefined
          }
          ListEmptyComponent={
            <Animated.View
              entering={FadeInDown.delay(200)}
              style={styles.emptyState}
            >
              <View style={styles.emptyIcon}>
                <Ionicons
                  name={
                    isArchived
                      ? "archive-outline"
                      : search
                      ? "search-outline"
                      : "chatbubbles-outline"
                  }
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
          onPress={() => router.push("/new-chat")}
          haptic="medium"
        >
          <Ionicons name="create-outline" size={26} color="#fff" />
        </AnimatedPressable>
      </Animated.View>
    </SafeAreaView>
  );
}

