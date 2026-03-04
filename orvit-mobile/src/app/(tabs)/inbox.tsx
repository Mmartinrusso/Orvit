import { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActionSheetIOS,
  Platform,
  Alert,
  TextInput,
  ScrollView,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useNavigation } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn, FadeInRight } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { getConversations, updateConversation } from "@/api/chat";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import Avatar from "@/components/ui/Avatar";
import { SkeletonConversation } from "@/components/ui/Skeleton";
import type { Conversation } from "@/types/chat";

// No mock data — real API only
// (removed MOCK_CONVERSATIONS — app uses getConversations API)



// ── Helpers ─────────────────────────────────────────────────
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

type FilterChip = "all" | "unread" | "groups" | "direct";

// ── Types ───────────────────────────────────────────────────
type InboxItem = any & { _subgroups?: any[]; _isSubgroup?: boolean };

// ── Conversation Item ───────────────────────────────────────
function ConversationItem({
  item,
  userId,
  onLongPress,
  isSubgroup,
  hasSubgroups,
  isExpanded,
  onToggleExpand,
  totalUnread,
}: {
  item: any;
  userId: number;
  onLongPress: (conv: any) => void;
  isSubgroup?: boolean;
  hasSubgroups?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  totalUnread?: number;
}) {
  const { colors, isDark } = useTheme();

  const displayName =
    item.type === "DIRECT"
      ? item.members?.find((m: any) => m.userId !== userId)?.user?.name || "Chat directo"
      : item.name || "Sin nombre";

  const unreadCount = totalUnread ?? (item.unreadCount ?? 0);
  const hasUnread = unreadCount > 0;
  const isGroup = item.type === "CHANNEL";

  const dividerColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const subgroupBorderColor = `${colors.primary}40`;
  const depth = (item as any)._depth ?? (isSubgroup ? 1 : 0);
  const indentLeft = depth > 0 ? 20 + (depth - 1) * 16 : 0;

  return (
    <View>
      <View style={{ flexDirection: "row" }}>
        {/* Subgroup left accent border */}
        {isSubgroup && (
          <View
            style={{
              width: 2,
              backgroundColor: subgroupBorderColor,
              marginLeft: 20 + indentLeft,
            }}
          />
        )}
        <View style={{ flex: 1 }}>
          <AnimatedPressable
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: isSubgroup ? 12 : 20,
              paddingLeft: isSubgroup ? 16 : 20,
              paddingVertical: isSubgroup ? 8 : 10,
            }}
            onPress={() => router.push(`/chat/${item.id}`)}
            onLongPress={() => onLongPress(item)}
            haptic="selection"
          >
            {/* Chevron for groups with subgroups */}
            {hasSubgroups && (
              <AnimatedPressable
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  onToggleExpand?.();
                }}
                haptic="selection"
                style={{
                  width: 28,
                  height: 28,
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 4,
                }}
              >
                <Ionicons
                  name={isExpanded ? "chevron-down" : "chevron-forward"}
                  size={18}
                  color={colors.textMuted}
                />
              </AnimatedPressable>
            )}

            {/* Avatar */}
            {(item as any)._isOrvitBot ? (
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: "#3b82f6",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Ionicons name="sparkles" size={24} color="#fff" />
              </View>
            ) : isGroup ? (
              <View
                style={{
                  width: isSubgroup ? 40 : 52,
                  height: isSubgroup ? 40 : 52,
                  borderRadius: isSubgroup ? 20 : 26,
                  backgroundColor: isSubgroup ? `${colors.primary}30` : colors.primary,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Ionicons
                  name={isSubgroup ? "chatbubble" : "people"}
                  size={isSubgroup ? 18 : 24}
                  color={isSubgroup ? colors.primary : "#fff"}
                />
              </View>
            ) : (
              <Avatar name={displayName} size={isSubgroup ? "sm" : "md"} />
            )}

            {/* Content */}
            <View style={{ flex: 1, marginLeft: isSubgroup ? 10 : 14 }}>
              {/* Top row: name + time */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: isSubgroup ? 2 : 4,
                }}
              >
                <Text
                  style={{
                    fontSize: isSubgroup ? 14 : 16,
                    fontWeight: hasUnread ? "700" : "500",
                    color: colors.textPrimary,
                    flex: 1,
                    marginRight: 8,
                  }}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                {item.lastMessageAt && (
                  <Text
                    style={{
                      fontSize: isSubgroup ? 11 : 12,
                      color: hasUnread ? colors.primary : colors.textMuted,
                      fontWeight: hasUnread ? "600" : "400",
                    }}
                  >
                    {formatTime(item.lastMessageAt)}
                  </Text>
                )}
              </View>

              {/* Bottom row: preview + badges */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: isSubgroup ? 13 : 14,
                    color: hasUnread ? colors.textSecondary : colors.textMuted,
                    flex: 1,
                    marginRight: 8,
                  }}
                  numberOfLines={1}
                >
                  {item.lastMessageText || "Sin mensajes"}
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {(item.isMuted || item.muted) && (
                    <Ionicons
                      name="volume-mute"
                      size={isSubgroup ? 14 : 16}
                      color={colors.textMuted}
                    />
                  )}
                  {item.isPinned && (
                    <Ionicons name="pin" size={14} color={colors.textMuted} />
                  )}
                  {hasUnread && (
                    <View
                      style={{
                        backgroundColor: colors.primary,
                        borderRadius: 12,
                        minWidth: isSubgroup ? 18 : 22,
                        height: isSubgroup ? 18 : 22,
                        justifyContent: "center",
                        alignItems: "center",
                        paddingHorizontal: isSubgroup ? 4 : 6,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: isSubgroup ? 10 : 11, fontWeight: "700" }}>
                        {unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </AnimatedPressable>
        </View>
      </View>
      {/* Divider — starts after avatar */}
      <View
        style={{
          height: 0.5,
          backgroundColor: dividerColor,
          marginLeft: isSubgroup ? 106 : 86,
          marginRight: 20,
        }}
      />
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────
export default function InboxScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const [activeFilter, setActiveFilter] = useState<FilterChip>("all");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Real data query
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["conversations", { archived: false }],
    queryFn: () => getConversations({ archived: false, limit: 50 }),
    enabled: !!user,
  });

  const rawConversations = useMemo(() => {
    return data?.conversations || [];
  }, [data?.conversations]);

  // Total unread badge on tab
  const totalUnread = useMemo(
    () => rawConversations.reduce((sum: number, c: any) => sum + (c.unreadCount ?? 0), 0),
    [rawConversations]
  );

  useEffect(() => {
    navigation.setParams({ unreadBadge: totalUnread > 0 ? totalUnread : undefined } as any);
  }, [totalUnread, navigation]);

  // Filter
  const filteredConversations = useMemo(() => {
    let convs = rawConversations;

    // Apply filter chip
    if (activeFilter === "unread") {
      convs = convs.filter((c: any) => (c.unreadCount ?? 0) > 0);
    } else if (activeFilter === "groups") {
      convs = convs.filter((c: any) => c.type === "CHANNEL");
    } else if (activeFilter === "direct") {
      convs = convs.filter((c: any) => c.type === "DIRECT");
    }

    // Apply search
    if (search.trim()) {
      const q = search.toLowerCase();
      convs = convs.filter((c: any) => {
        const name =
          c.type === "DIRECT"
            ? c.members?.find((m: any) => m.userId !== (user?.id ?? 1))?.user?.name || ""
            : c.name || "";
        return (
          name.toLowerCase().includes(q) ||
          (c.lastMessageText || "").toLowerCase().includes(q)
        );
      });
    }

    return convs;
  }, [rawConversations, activeFilter, search, user?.id]);

  // Group conversations into recursive hierarchy
  const groupedConversations = useMemo((): InboxItem[] => {
    const allIds = new Set(filteredConversations.map((c: any) => c.id));
    const childrenMap = new Map<string, any[]>();
    const topLevel: any[] = [];

    for (const conv of filteredConversations) {
      if (conv.parentId && allIds.has(conv.parentId)) {
        const existing = childrenMap.get(conv.parentId) || [];
        existing.push(conv);
        childrenMap.set(conv.parentId, existing);
      } else {
        topLevel.push(conv);
      }
    }

    // Recursively attach subgroups
    function attachChildren(items: any[]): InboxItem[] {
      return items.map((conv) => {
        const subs = childrenMap.get(conv.id);
        if (subs && subs.length > 0) {
          return { ...conv, _subgroups: attachChildren(subs) };
        }
        return conv;
      });
    }

    return attachChildren(topLevel);
  }, [filteredConversations]);

  // Flatten recursively for FlatList
  const flatData = useMemo((): InboxItem[] => {
    const result: InboxItem[] = [];
    function flatten(items: InboxItem[], depth: number) {
      for (const item of items) {
        if (depth > 0) {
          result.push({ ...item, _isSubgroup: true, _depth: depth });
        } else {
          result.push(item);
        }
        if (item._subgroups && expandedGroups.has(item.id)) {
          flatten(item._subgroups, depth + 1);
        }
      }
    }
    flatten(groupedConversations, 0);
    return result;
  }, [groupedConversations, expandedGroups]);

  // Calculate total unread recursively
  const getTotalUnread = useCallback((item: InboxItem): number => {
    const own = item.unreadCount ?? 0;
    if (!item._subgroups) return own;
    const subsUnread = item._subgroups.reduce(
      (sum: number, sub: any) => sum + getTotalUnread(sub),
      0
    );
    return own + subsUnread;
  }, []);

  const toggleExpand = useCallback((id: string) => {
    haptics.selection();
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, [haptics]);

  const archivedCount = 0;

  const handleLongPress = useCallback(
    (conv: any) => {
      haptics.medium();
      const options = ["Info del chat", conv.isArchived ? "Desarchivar" : "Archivar", "Cancelar"];
      const cancelButtonIndex = 2;

      const handleAction = async (buttonIndex: number) => {
        if (buttonIndex === 0) {
          router.push(`/chat-info/${conv.id}`);
        } else if (buttonIndex === 1) {
          try {
            await updateConversation(conv.id, { isArchived: !conv.isArchived });
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
          } catch {}
        }
      };

      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex }, handleAction);
      } else {
        Alert.alert("Opciones", undefined, [
          { text: "Info del chat", onPress: () => handleAction(0) },
          { text: conv.isArchived ? "Desarchivar" : "Archivar", onPress: () => handleAction(1) },
          { text: "Cancelar", style: "cancel" },
        ]);
      }
    },
    [haptics, queryClient]
  );

  const filterChips: { key: FilterChip; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "unread", label: "No leídos" },
    { key: "groups", label: "Grupos" },
    { key: "direct", label: "Directos" },
  ];

  const bgColor = isDark ? "#000000" : "#ffffff";
  const searchBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const chipBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
  const chipActiveBg = colors.primary;
  const chipText = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";
  const archivedBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            fontSize: 26,
            fontWeight: "700",
            color: colors.textPrimary,
            letterSpacing: -0.3,
          }}
        >
          Chats
        </Text>
        <AnimatedPressable
          onPress={() => router.push("/new-chat")}
          haptic="light"
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: colors.primary,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons name="add" size={18} color="#fff" />
        </AnimatedPressable>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: searchBg,
            borderRadius: 10,
            paddingHorizontal: 10,
            height: 34,
          }}
        >
          <Ionicons name="search" size={15} color={colors.textMuted} />
          <TextInput
            style={{
              flex: 1,
              fontSize: 14,
              color: colors.textPrimary,
              marginLeft: 8,
              outlineStyle: "none",
            } as any}
            placeholder="Buscar"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {search.length > 0 && (
            <AnimatedPressable onPress={() => setSearch("")} haptic="light">
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </AnimatedPressable>
          )}
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 4,
          gap: 6,
        }}
      >
        {filterChips.map((chip) => {
          const isActive = activeFilter === chip.key;
          return (
            <AnimatedPressable
              key={chip.key}
              onPress={() => setActiveFilter(chip.key)}
              haptic="selection"
              style={{
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 16,
                backgroundColor: isActive ? chipActiveBg : chipBg,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: isActive ? "600" : "500",
                  color: isActive ? "#fff" : chipText,
                }}
              >
                {chip.label}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>

      {/* Archivados row */}
      {archivedCount > 0 && activeFilter === "all" && (
        <AnimatedPressable
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingVertical: 4,
          }}
          haptic="light"
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: chipBg,
              justifyContent: "center",
              alignItems: "center",
              marginRight: 8,
            }}
          >
            <Ionicons
              name="archive-outline"
              size={12}
              color={colors.textMuted}
            />
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: "500",
              color: colors.textSecondary,
            }}
          >
            Archivados
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: colors.textMuted,
            }}
          >
            {archivedCount}
          </Text>
        </AnimatedPressable>
      )}

      {/* Conversation list */}
      <FlatList
        style={{ flex: 1 }}
        data={flatData}
        keyExtractor={(item: any, index: number) => `${item.id}-${item._isSubgroup ? 'sub' : 'top'}-${index}`}
        renderItem={({ item }) => {
          const hasSubgroups = !!(item._subgroups && item._subgroups.length > 0);
          const isSubgroup = !!item._isSubgroup;
          const isExpanded = expandedGroups.has(item.id);

          return (
            <ConversationItem
              item={item}
              userId={user?.id ?? 1}
              onLongPress={handleLongPress}
              isSubgroup={isSubgroup}
              hasSubgroups={hasSubgroups}
              isExpanded={isExpanded}
              onToggleExpand={() => toggleExpand(item.id)}
              totalUnread={hasSubgroups ? getTotalUnread(item) : undefined}
            />
          );
        }}
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
        contentContainerStyle={{ paddingBottom: 20, flexGrow: 0 }}
        ListEmptyComponent={
          <View
            style={{
              alignItems: "center",
              paddingTop: 40,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: chipBg,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons
                name={search ? "search-outline" : "chatbubbles-outline"}
                size={28}
                color={colors.textMuted}
              />
            </View>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: colors.textPrimary,
                marginBottom: 6,
              }}
            >
              {search ? "Sin resultados" : "No hay conversaciones"}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.textMuted,
                textAlign: "center",
                paddingHorizontal: 40,
              }}
            >
              {search
                ? "Probá con otro término"
                : "Tocá + para iniciar una conversación"}
            </Text>
          </View>
        }
      />

    </SafeAreaView>
  );
}
