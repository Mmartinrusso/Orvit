import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  FlatList as RNFlatList,
  RefreshControl,
  ActionSheetIOS,
  Platform,
  Alert,
  TextInput,
  ScrollView,
} from "react-native";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useNavigation, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";

import { Ionicons } from "@expo/vector-icons";
import { getConversations, getBotConversation, updateConversation, getMessages } from "@/api/chat";
import { getPusherClient } from "@/lib/pusher";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import { SkeletonConversation } from "@/components/ui/Skeleton";
import { fonts } from "@/lib/fonts";
import type { Conversation } from "@/types/chat";

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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type FilterChip = "ordered" | "unordered" | "groups" | "direct";
type InboxItem = any & {
  _subgroups?: any[];
  _isSubgroup?: boolean;
  _depth?: number;
  _isLastInGroup?: boolean;
  _sectionHeader?: string;
  _parentName?: string;
};

// ── Conversation Item ───────────────────────────────────────
const ConversationItem = React.memo(function ConversationItem({
  item,
  userId,
  onLongPress,
  isSubgroup,
  isLastInGroup,
  hasChildren,
  isExpanded,
  onToggleExpand,
}: {
  item: any;
  userId: number;
  onLongPress: (conv: any) => void;
  isSubgroup?: boolean;
  isLastInGroup?: boolean;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();

  const displayName = item.isSystemBot
    ? (item.name || "M6 Assistant")
    : item.type === "DIRECT"
      ? item.members?.find((m: any) => m.userId !== userId)?.user?.name || "Chat directo"
      : item.name || "Sin nombre";
  const isRemindersBot = item.isSystemBot && item.name === "Recordatorios";
  const botIcon: keyof typeof Ionicons.glyphMap = isRemindersBot ? "notifications" : "sparkles";

  const unreadCount = item.unreadCount ?? 0;
  const hasUnread = unreadCount > 0;
  const isDirect = item.type === "DIRECT";
  const isOnline = isDirect && item.members?.find((m: any) => m.userId !== userId)?.user?.isOnline;

  const depth = item._depth ?? 0;
  const treeColor = isDark ? "#262626" : "#E5E5E5";
  const dividerColor = isDark ? "#141414" : "#F5F5F5";
  const parentName = item._parentName;

  // Figma sizes per depth: top=44/14, L1=38/12, L2=34/10
  const avatarSize = depth === 0 ? 44 : depth === 1 ? 38 : 34;
  const avatarRadius = depth === 0 ? 14 : depth === 1 ? 12 : 10;
  const iconSize = depth === 0 ? 20 : depth === 1 ? 16 : 14;
  const nameFontSize = depth === 0 ? 13 : depth === 1 ? 12 : 11;
  // Figma left offsets: top=20, L1=44, L2=60
  const avatarLeft = depth === 0 ? 20 : depth === 1 ? 44 : 60;
  const contentLeft = avatarLeft + avatarSize + 12;
  const rowHeight = depth === 0 ? 64 : depth === 1 ? 59 : 55;

  return (
    <View>
      <AnimatedPressable
        style={{ height: rowHeight, justifyContent: "center" }}
        onPress={() => router.push(`/chat/${item.id}`)}
        onLongPress={() => onLongPress(item)}
        onPressIn={() => {
          // Prefetch messages while the user's finger is still down (WhatsApp-style)
          queryClient.prefetchInfiniteQuery({
            queryKey: ["messages", item.id],
            queryFn: () => getMessages(item.id, { limit: 30 }),
            initialPageParam: undefined,
            staleTime: 60_000,
          });
        }}
        haptic="selection"
      >
        {/* Tree lines depth 1 */}
        {isSubgroup && depth === 1 && (
          <>
            <View
              style={{
                position: "absolute",
                left: 30,
                top: 0,
                bottom: isLastInGroup ? rowHeight / 2 : 0,
                width: 1.5,
                backgroundColor: treeColor,
                borderRadius: 1,
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 30,
                top: Math.round(rowHeight / 2),
                width: 10,
                height: 1.5,
                backgroundColor: treeColor,
                borderRadius: 1,
              }}
            />
          </>
        )}

        {/* Depth-1 continuation line for depth 2+ (only if parent is not last sibling) */}
        {isSubgroup && depth >= 2 && !item._parentIsLast && (
          <View
            style={{
              position: "absolute",
              left: 30,
              top: 0,
              bottom: 0,
              width: 1.5,
              backgroundColor: treeColor,
              borderRadius: 1,
            }}
          />
        )}

        {/* Tree lines depth 2+ */}
        {isSubgroup && depth >= 2 && (
          <>
            <View
              style={{
                position: "absolute",
                left: 46,
                top: 0,
                bottom: isLastInGroup ? rowHeight / 2 : 0,
                width: 1.5,
                backgroundColor: treeColor,
                borderRadius: 1,
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 46,
                top: Math.round(rowHeight / 2),
                width: 10,
                height: 1.5,
                backgroundColor: treeColor,
                borderRadius: 1,
              }}
            />
          </>
        )}

        {/* Avatar */}
        <View style={{ position: "absolute", left: avatarLeft, top: 10 }}>
          {item.isSystemBot ? (
            <View
              style={{
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarRadius,
                backgroundColor: isRemindersBot
                  ? (isDark ? "#7C3AED" : "#8B5CF6")
                  : (isDark ? "#FFFFFF" : "#0A0A0A"),
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons
                name={botIcon}
                size={iconSize}
                color={isRemindersBot ? "#FFFFFF" : (isDark ? "#0A0A0A" : "#FFFFFF")}
              />
            </View>
          ) : isDirect ? (
            <View
              style={{
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarRadius,
                backgroundColor: isDark ? "#171717" : "#FAFAFA",
                borderWidth: 1,
                borderColor: isDark ? "#262626" : "#E5E5E5",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  fontFamily: fonts.bold,
                  color: isDark ? "#E5E5E5" : "#0A0A0A",
                }}
              >
                {getInitials(displayName)}
              </Text>
            </View>
          ) : (
            <View
              style={{
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarRadius,
                backgroundColor: isDark ? "#171717" : "#FAFAFA",
                borderWidth: 1,
                borderColor: isDark ? "#262626" : "#E5E5E5",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons
                name="people-outline"
                size={iconSize}
                color={isDark ? "#E5E5E5" : "#0A0A0A"}
              />
            </View>
          )}
          {/* Online indicator */}
          {isOnline && (
            <View
              style={{
                position: "absolute",
                right: -1,
                bottom: -1,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: "#10b981",
                borderWidth: 2,
                borderColor: isDark ? "#0A0A0A" : "#FFFFFF",
              }}
            />
          )}
        </View>

        {/* Content */}
        <View
          style={{
            position: "absolute",
            left: contentLeft,
            top: 0,
            bottom: 0,
            right: 66,
            justifyContent: "center",
          }}
        >
          {/* Name row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 2,
              gap: 4,
            }}
          >
            <Text
              style={{
                fontSize: nameFontSize,
                fontWeight: "600",
                fontFamily: fonts.semiBold,
                color: isDark ? "#E5E5E5" : "#0A0A0A",
                flexShrink: 1,
              }}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            {/* Bot badge */}
            {item.isSystemBot && (
              <View
                style={{
                  backgroundColor: isRemindersBot
                    ? (isDark ? "#7C3AED20" : "#8B5CF620")
                    : (isDark ? "#1A1A1A" : "#F5F5F5"),
                  borderRadius: 4,
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                }}
              >
                <Text
                  style={{
                    fontSize: 8,
                    fontWeight: "700",
                    fontFamily: fonts.bold,
                    color: isRemindersBot
                      ? (isDark ? "#A78BFA" : "#7C3AED")
                      : (isDark ? "#555555" : "#A3A3A3"),
                    letterSpacing: 0.32,
                    textTransform: "uppercase",
                  }}
                >
                  {isRemindersBot ? "BOT" : "IA"}
                </Text>
              </View>
            )}
            {/* Parent group badge (Desordenado view) */}
            {parentName && (
              <View
                style={{
                  backgroundColor: isDark ? "#1A1A1A" : "#F5F5F5",
                  borderRadius: 4,
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                }}
              >
                <Text
                  style={{
                    fontSize: 8,
                    fontWeight: "700",
                    fontFamily: fonts.bold,
                    color: isDark ? "#555555" : "#A3A3A3",
                    letterSpacing: 0.32,
                  }}
                  numberOfLines={1}
                >
                  {parentName}
                </Text>
              </View>
            )}
          </View>

          {/* Preview */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: "400",
              fontFamily: fonts.regular,
              color: isDark ? "#555555" : "#A3A3A3",
            }}
            numberOfLines={1}
          >
            {item.lastMessageText || "Sin mensajes"}
          </Text>
        </View>

        {/* Right column: time + badge + chevron */}
        {hasChildren ? (
          <AnimatedPressable
            onPress={(e: any) => {
              e?.stopPropagation?.();
              onToggleExpand?.();
            }}
            haptic="selection"
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: 70,
              alignItems: "flex-end",
              justifyContent: "center",
              paddingRight: 20,
              gap: 4,
            }}
          >
            {item.lastMessageAt && (
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "500",
                  fontFamily: fonts.monoMedium,
                  color: isDark ? "#555555" : "#A3A3A3",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatTime(item.lastMessageAt)}
              </Text>
            )}
            {hasUnread ? (
              <View
                style={{
                  backgroundColor: "#EF4444",
                  borderRadius: 9,
                  minWidth: 18,
                  height: 18,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: 5,
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 9,
                    fontWeight: "700",
                    fontFamily: fonts.monoBold,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {unreadCount}
                </Text>
              </View>
            ) : null}
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={isDark ? "#A3A3A3" : "#737373"}
            />
          </AnimatedPressable>
        ) : (
          <View
            style={{
              position: "absolute",
              right: 20,
              top: 0,
              bottom: 0,
              alignItems: "flex-end",
              justifyContent: "center",
              gap: 4,
            }}
          >
            {item.lastMessageAt && (
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "500",
                  fontFamily: fonts.monoMedium,
                  color: isDark ? "#555555" : "#A3A3A3",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatTime(item.lastMessageAt)}
              </Text>
            )}
            {hasUnread ? (
              <View
                style={{
                  backgroundColor: "#EF4444",
                  borderRadius: 9,
                  minWidth: 18,
                  height: 18,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: 5,
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 9,
                    fontWeight: "700",
                    fontFamily: fonts.monoBold,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {unreadCount}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </AnimatedPressable>
    </View>
  );
});

// ── Section Header ──────────────────────────────────────────
function SectionHeader({ title, isDark }: { title: string; isDark: boolean }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 }}>
      <Text
        style={{
          fontSize: 9,
          fontWeight: "700",
          fontFamily: fonts.bold,
          letterSpacing: 0.72,
          textTransform: "uppercase",
          color: isDark ? "#404040" : "#CCCCCC",
        }}
      >
        {title}
      </Text>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────
export default function InboxScreen() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const [activeFilter, setActiveFilter] = useState<FilterChip>("ordered");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Debounce search to avoid filtering on every keystroke
  useEffect(() => {
    if (!search.trim()) {
      setDebouncedSearch("");
      return;
    }
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  // Real data query
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["conversations", { archived: false }],
    queryFn: () => getConversations({ archived: false, limit: 50 }),
    enabled: !!user,
  });

  const { data: botConv } = useQuery({
    queryKey: ["bot-conversation"],
    queryFn: getBotConversation,
    enabled: !!user,
    staleTime: Infinity,
  });

  // Only refetch on focus if data is stale (>2 min old), not every time
  useFocusEffect(
    useCallback(() => {
      if (user) {
        const state = queryClient.getQueryState(["conversations", { archived: false }]);
        const age = Date.now() - (state?.dataUpdatedAt ?? 0);
        if (age > 2 * 60_000) refetch();
      }
    }, [user])
  );

  // Pusher: listen for new messages to update inbox in real-time
  useEffect(() => {
    if (!user) return;
    const pusher = getPusherClient();

    // Subscribe to user's private channel for inbox updates
    const channel = pusher.subscribe(`private-user-${user.id}`);

    channel.bind("conversation:updated", (evt: any) => {
      if (evt?.conversationId) {
        // Partial cache update — avoid full refetch
        queryClient.setQueryData(["conversations", { archived: false }], (old: any) => {
          if (!old?.conversations) return old;
          return {
            ...old,
            conversations: old.conversations.map((c: any) =>
              c.id === evt.conversationId
                ? { ...c, ...evt.updates, lastMessageAt: evt.lastMessageAt ?? c.lastMessageAt }
                : c
            ),
          };
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }
    });

    channel.bind("message:new", (evt: any) => {
      if (evt?.conversationId) {
        // Update just the affected conversation in cache
        queryClient.setQueryData(["conversations", { archived: false }], (old: any) => {
          if (!old?.conversations) return old;
          return {
            ...old,
            conversations: old.conversations.map((c: any) =>
              c.id === evt.conversationId
                ? {
                    ...c,
                    lastMessageText: evt.preview ?? c.lastMessageText,
                    lastMessageBy: evt.senderName ?? c.lastMessageBy,
                    lastMessageAt: evt.createdAt ?? new Date().toISOString(),
                    unreadCount: (c.unreadCount ?? 0) + 1,
                  }
                : c
            ),
          };
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }
    });

    return () => {
      pusher.unsubscribe(`private-user-${user.id}`);
    };
  }, [user?.id, queryClient]);

  const rawConversations = useMemo(() => {
    const convs = data?.conversations || [];
    if (botConv) {
      const withoutBot = convs.filter((c: any) => c.id !== botConv.id);
      const inboxBot = convs.find((c: any) => c.id === botConv.id);
      const mergedBot = inboxBot || botConv;
      return [mergedBot, ...withoutBot];
    }
    return convs;
  }, [data?.conversations, botConv]);

  const totalUnread = useMemo(
    () => rawConversations.reduce((sum: number, c: any) => sum + (c.unreadCount ?? 0), 0),
    [rawConversations]
  );

  useEffect(() => {
    navigation.setParams({ unreadBadge: totalUnread > 0 ? totalUnread : undefined } as any);
  }, [totalUnread, navigation]);

  // Search filter (uses debounced value to avoid filtering on every keystroke)
  const searchFiltered = useMemo(() => {
    let convs = rawConversations;
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      convs = convs.filter((c: any) => {
        const name =
          c.type === "DIRECT"
            ? c.members?.find((m: any) => m.userId !== (user?.id ?? 1))?.user?.name || ""
            : c.name || "";
        return name.toLowerCase().includes(q) || (c.lastMessageText || "").toLowerCase().includes(q);
      });
    }
    return convs;
  }, [rawConversations, debouncedSearch, user?.id]);

  // Type filter
  const typeFiltered = useMemo(() => {
    if (activeFilter === "groups") return searchFiltered.filter((c: any) => c.type === "CHANNEL" || c.isSystemBot);
    if (activeFilter === "direct") return searchFiltered.filter((c: any) => c.type === "DIRECT" || c.isSystemBot);
    return searchFiltered;
  }, [searchFiltered, activeFilter]);

  // Build parent name map
  const parentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of rawConversations) {
      if (c.id && c.name) map.set(c.id, c.name);
    }
    return map;
  }, [rawConversations]);

  // Groups start collapsed — user expands them manually

  // ── "Ordenado" — hierarchical with tree lines + sections ──
  const orderedFlatData = useMemo(() => {
    const bots = typeFiltered.filter((c: any) => c.isSystemBot);
    const groups = typeFiltered.filter((c: any) => c.type === "CHANNEL" && !c.parentId && !c.isSystemBot);
    const directs = typeFiltered.filter((c: any) => c.type === "DIRECT" && !c.isSystemBot);

    const allIds = new Set(typeFiltered.map((c: any) => c.id));
    const childrenMap = new Map<string, any[]>();
    for (const conv of typeFiltered) {
      if (conv.parentId && allIds.has(conv.parentId)) {
        const existing = childrenMap.get(conv.parentId) || [];
        existing.push(conv);
        childrenMap.set(conv.parentId, existing);
      }
    }

    const result: InboxItem[] = [];

    // Bots first
    for (const b of bots) result.push(b);

    // Groups section
    if (groups.length > 0 || childrenMap.size > 0) {
      result.push({ _sectionHeader: "Grupos" });

      function flattenGroup(items: any[], depth: number, parentIsLast?: boolean) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const children = childrenMap.get(item.id) || [];
          const isLastSibling = i === items.length - 1;
          const hasKids = children.length > 0;
          const expanded = hasKids && expandedGroups.has(item.id);
          if (depth > 0) {
            result.push({
              ...item,
              _isSubgroup: true,
              _depth: depth,
              _isLastInGroup: isLastSibling,
              _hasChildren: hasKids,
              _isExpanded: expanded,
              _parentIsLast: parentIsLast,
            });
          } else {
            result.push({ ...item, _hasChildren: hasKids, _isExpanded: expanded });
          }
          if (expanded) {
            flattenGroup(children, depth + 1, isLastSibling);
          }
        }
      }
      flattenGroup(groups, 0);
    }

    // Direct messages section
    if (directs.length > 0) {
      result.push({ _sectionHeader: "Mensajes directos" });
      for (const dm of directs) result.push(dm);
    }

    return result;
  }, [typeFiltered, expandedGroups]);

  // ── "Desordenado" — flat list sorted by lastMessageAt, with parent badges ──
  const unorderedFlatData = useMemo(() => {
    const bots = typeFiltered.filter((c: any) => c.isSystemBot);
    const rest = typeFiltered.filter((c: any) => !c.isSystemBot);

    const sorted = [...rest].sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tb - ta;
    });

    return [...bots, ...sorted].map((c) => {
      if (c.parentId && parentNameMap.has(c.parentId)) {
        return { ...c, _parentName: parentNameMap.get(c.parentId) };
      }
      return c;
    });
  }, [typeFiltered, parentNameMap]);

  // Choose which data to show
  const flatData = activeFilter === "unordered" ? unorderedFlatData : orderedFlatData;

  const toggleExpand = useCallback((id: string) => {
    haptics.selection();
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, [haptics]);

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
    { key: "ordered", label: "Ordenado" },
    { key: "unordered", label: "Desordenado" },
    { key: "groups", label: "Grupos" },
    { key: "direct", label: "Directos" },
  ];

  const inboxKeyExtractor = useCallback(
    (item: any) =>
      item._sectionHeader
        ? `section-${item._sectionHeader}`
        : item.id,
    []
  );

  const inboxRenderItem = useCallback(
    ({ item }: { item: any }) => {
      if (item._sectionHeader) {
        return <SectionHeader title={item._sectionHeader} isDark={isDark} />;
      }

      return (
        <ConversationItem
          item={item}
          userId={user?.id ?? 1}
          onLongPress={handleLongPress}
          isSubgroup={!!item._isSubgroup}
          isLastInGroup={item._isLastInGroup}
          hasChildren={!!item._hasChildren}
          isExpanded={!!item._isExpanded}
          onToggleExpand={item._hasChildren ? () => toggleExpand(item.id) : undefined}
        />
      );
    },
    [isDark, user?.id, handleLongPress, toggleExpand]
  );

  // m6 colors
  const bgColor = isDark ? "#0A0A0A" : "#FFFFFF";
  const searchBg = isDark ? "#171717" : "#FAFAFA";
  const searchBorder = isDark ? "#262626" : "#E5E5E5";
  const searchIcon = isDark ? "#555555" : "#A3A3A3";
  const chipActiveBg = isDark ? "#FFFFFF" : "#0A0A0A";
  const chipActiveText = isDark ? "#0A0A0A" : "#FFFFFF";
  const chipActiveBorder = isDark ? "#FFFFFF" : "#0A0A0A";
  const chipInactiveBg = isDark ? "#171717" : "#FAFAFA";
  const chipInactiveBorder = isDark ? "#262626" : "#E5E5E5";
  const chipInactiveText = isDark ? "#555555" : "#A3A3A3";
  const btnBg = isDark ? "#171717" : "#FAFAFA";
  const btnBorder = isDark ? "#262626" : "#E5E5E5";
  const btnIcon = isDark ? "#A3A3A3" : "#737373";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }} edges={["top"]}>
      {/* Header + Search */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 14 }}>
        {/* Title row */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text
            style={{
              fontSize: 28,
              fontWeight: "800",
              fontFamily: fonts.extraBold,
              color: isDark ? "#E5E5E5" : "#0A0A0A",
              letterSpacing: -0.84,
            }}
          >
            Chats
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <AnimatedPressable
              onPress={() => {}}
              haptic="light"
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: btnBg,
                borderWidth: 1,
                borderColor: btnBorder,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="search-outline" size={18} color={btnIcon} />
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => router.push("/new-chat")}
              haptic="light"
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: btnBg,
                borderWidth: 1,
                borderColor: btnBorder,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="add" size={18} color={btnIcon} />
            </AnimatedPressable>
          </View>
        </View>

        {/* Search bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: searchBg,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: searchBorder,
            paddingLeft: 14,
            height: 38,
            gap: 10,
          }}
        >
          <Ionicons name="search-outline" size={16} color={searchIcon} />
          <TextInput
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: "400",
              fontFamily: fonts.regular,
              color: isDark ? "#E5E5E5" : "#0A0A0A",
              outlineStyle: "none",
            } as any}
            placeholder="Buscar conversacion..."
            placeholderTextColor={isDark ? "#555555" : "#A3A3A3"}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {search.length > 0 && (
            <AnimatedPressable onPress={() => setSearch("")} haptic="light" style={{ paddingRight: 12 }}>
              <Ionicons name="close-circle" size={16} color={searchIcon} />
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
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 0,
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
                height: 26,
                justifyContent: "center",
                borderRadius: 13,
                backgroundColor: isActive ? chipActiveBg : chipInactiveBg,
                borderWidth: 1,
                borderColor: isActive ? chipActiveBorder : chipInactiveBorder,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  fontFamily: fonts.semiBold,
                  color: isActive ? chipActiveText : chipInactiveText,
                }}
              >
                {chip.label}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>

      {/* Conversation list */}
      <FlashList
        data={flatData}
        keyExtractor={inboxKeyExtractor}
        estimatedItemSize={62}
        drawDistance={250}
        renderItem={inboxRenderItem}
        getItemType={(item: any) => item._sectionHeader ? "section" : "conversation"}
        extraData={expandedGroups}
        ItemSeparatorComponent={() => (
          <View
            style={{
              height: 1,
              backgroundColor: isDark ? "#141414" : "#F5F5F5",
              marginLeft: 76,
            }}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              haptics.light();
              refetch();
            }}
            tintColor={isDark ? "#555555" : "#A3A3A3"}
          />
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingTop: 4 }}>
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <SkeletonConversation key={i} />
              ))}
            </View>
          ) : (
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  backgroundColor: isDark ? "#171717" : "#FAFAFA",
                  borderWidth: 1,
                  borderColor: isDark ? "#262626" : "#E5E5E5",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <Ionicons
                  name={search ? "search-outline" : "chatbubbles-outline"}
                  size={24}
                  color={isDark ? "#555555" : "#A3A3A3"}
                />
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  fontFamily: fonts.semiBold,
                  color: isDark ? "#E5E5E5" : "#0A0A0A",
                  marginBottom: 6,
                }}
              >
                {search ? "Sin resultados" : "No hay conversaciones"}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: fonts.regular,
                  color: isDark ? "#555555" : "#A3A3A3",
                  textAlign: "center",
                  paddingHorizontal: 40,
                }}
              >
                {search ? "Probá con otro término" : "Tocá + para iniciar una conversación"}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
