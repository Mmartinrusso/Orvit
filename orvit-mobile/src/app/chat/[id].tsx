import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Image,
  Dimensions,
  TextInput,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import {
  getMessages,
  sendMessage,
  markAsRead,
  getConversation,
  getMembers,
  addReaction,
  removeReaction,
  editMessage,
  deleteMessage,
  sendTyping,
  searchMessages,
} from "@/api/chat";
import { getAccessToken } from "@/lib/storage";
import { API_URL } from "@/api/client";
import { getPusherClient } from "@/lib/pusher";
import ChatHeader from "@/components/chat/ChatHeader";
import MessageBubble from "@/components/chat/MessageBubble";
import ChatInputBar from "@/components/chat/ChatInputBar";
import ForwardMessageModal from "@/components/chat/ForwardMessageModal";
import TypingIndicator from "@/components/chat/TypingIndicator";
import MentionList from "@/components/MentionList";
import ReactionPicker from "@/components/ReactionPicker";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import type { Message } from "@/types/chat";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── Date separator helper ──────────────────────────────────
function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  return date.toLocaleDateString("es", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

const DateSeparator = React.memo(function DateSeparator({ date, isDark }: { date: string; isDark: boolean }) {
  return (
    <View style={{ alignItems: "center", marginVertical: 10 }}>
      <View
        style={{
          backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)",
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 5,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDark ? 0.2 : 0.06,
          shadowRadius: 2,
          elevation: 1,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: "500",
            color: isDark ? "rgba(233,237,239,0.6)" : "rgba(0,0,0,0.5)",
          }}
        >
          {formatDateSeparator(date)}
        </Text>
      </View>
    </View>
  );
});

// ── Chat background texture (WhatsApp-style dense doodle) ──
const ChatBackgroundPattern = React.memo(function ChatBackgroundPattern({ isDark }: { isDark: boolean }) {
  const icons = [
    "heart-outline", "camera-outline", "musical-notes-outline", "gift-outline",
    "happy-outline", "star-outline", "call-outline", "chatbubble-outline",
    "globe-outline", "time-outline", "lock-closed-outline", "alarm-outline",
    "calculator-outline", "calendar-outline", "bulb-outline", "compass-outline",
    "football-outline", "basketball-outline", "balloon-outline", "bicycle-outline",
    "boat-outline", "bus-outline", "cafe-outline", "cart-outline",
    "cloud-outline", "code-slash-outline", "color-palette-outline", "construct-outline",
    "cube-outline", "diamond-outline", "earth-outline", "film-outline",
    "fish-outline", "fitness-outline", "flame-outline", "flash-outline",
    "flower-outline", "game-controller-outline", "headset-outline", "home-outline",
    "ice-cream-outline", "key-outline", "leaf-outline", "library-outline",
    "location-outline", "mail-outline", "megaphone-outline", "mic-outline",
    "moon-outline", "newspaper-outline", "notifications-outline", "paper-plane-outline",
    "paw-outline", "pencil-outline", "pizza-outline", "planet-outline",
    "play-outline", "rainy-outline", "rocket-outline", "rose-outline",
    "school-outline", "shirt-outline", "skull-outline", "snow-outline",
    "sparkles-outline", "sunny-outline", "telescope-outline", "tennisball-outline",
    "thumbs-up-outline", "ticket-outline", "trophy-outline", "umbrella-outline",
    "videocam-outline", "wallet-outline", "watch-outline", "wine-outline",
  ] as const;
  const rows = 40;
  const cols = 9;
  const items = [];
  // Pseudo-random using deterministic seed per position
  const rand = (r: number, c: number) => ((r * 131 + c * 97 + 37) % 256) / 256;
  for (let r = 0; r < rows; r++) {
    const isOffset = r % 2 === 1;
    for (let c = 0; c < cols; c++) {
      const idx = Math.floor(rand(r, c) * icons.length) % icons.length;
      const rot = Math.floor(rand(r + 5, c + 3) * 360) - 180;
      const size = 11 + Math.floor(rand(r + 2, c + 7) * 5); // 11-15
      items.push(
        <View
          key={`${r}-${c}`}
          style={{
            width: `${100 / cols}%` as any,
            height: 28,
            alignItems: "center",
            justifyContent: "center",
            marginLeft: isOffset && c === 0 ? 16 : 0,
          }}
        >
          <Ionicons
            name={icons[idx]}
            size={size}
            color={isDark ? "#ffffff" : "#000000"}
            style={{ transform: [{ rotate: `${rot}deg` }] }}
          />
        </View>
      );
    }
  }
  return (
    <View
      style={{
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        flexDirection: "row",
        flexWrap: "wrap",
        opacity: 0.04,
        paddingTop: 2,
        zIndex: 0,
      }}
      pointerEvents="none"
    >
      {items}
    </View>
  );
});

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const [inputText, setInputText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);
  const [mentionFilter, setMentionFilter] = useState<string | null>(null);
  const [mentionIds, setMentionIds] = useState<number[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResultIds, setSearchResultIds] = useState<string[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const lastTypingSentRef = useRef(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Conversation info — useQuery so we can seed from list cache
  const { data: conv } = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => getConversation(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    initialData: () => {
      // Try conversations list cache first
      const cached = queryClient.getQueryData<{ conversations?: any[] }>(["conversations", { archived: false }]);
      const fromList = cached?.conversations?.find((c: any) => c.id === id);
      if (fromList) return fromList;
      // Try bot-conversation cache
      const botConv = queryClient.getQueryData<any>(["bot-conversation"]);
      if (botConv?.id === id) return botConv;
      return undefined;
    },
  });

  const { title, isGroup, memberCount, isOrvitBot } = useMemo(() => {
    if (!conv) return { title: "Chat", isGroup: false, memberCount: 0, isOrvitBot: false };
    const isBotConv = conv.isSystemBot === true;
    if (isBotConv) {
      return {
        title: conv.name || "ORVIT",
        isGroup: false,
        memberCount: 0,
        isOrvitBot: true,
      };
    }
    if (conv.type === "DIRECT") {
      const other = conv.members?.find((m: any) => m.userId !== user?.id);
      return {
        title: other?.user?.name || "Chat directo",
        isGroup: false,
        memberCount: 0,
        isOrvitBot: false,
      };
    }
    return {
      title: conv.name || "Chat",
      isGroup: true,
      memberCount: conv.members?.length ?? 0,
      isOrvitBot: false,
    };
  }, [conv, user?.id]);

  // Members for mentions
  const { data: members } = useQuery({
    queryKey: ["members", id],
    queryFn: () => getMembers(id!),
    enabled: !!id,
  });

  // Messages
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["messages", id],
      queryFn: ({ pageParam }) =>
        getMessages(id!, { cursor: pageParam, limit: 50 }),
      getNextPageParam: (lastPage) =>
        lastPage.length === 50
          ? lastPage[lastPage.length - 1].createdAt
          : undefined,
      initialPageParam: undefined as string | undefined,
      enabled: !!id,
    });

  const allMessages = useMemo(() => {
    const flat = data?.pages.flat() ?? [];
    // Deduplicate by id (Pusher + optimistic update can cause dupes)
    const seen = new Set<string>();
    return flat.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [data]);

  // Map server search result IDs to local FlatList indices
  const searchResultIndices = useMemo(() => {
    if (!searchResultIds.length) return [];
    const idSet = new Set(searchResultIds);
    const indices: number[] = [];
    allMessages.forEach((m, i) => {
      if (idSet.has(m.id)) indices.push(i);
    });
    return indices;
  }, [searchResultIds, allMessages]);

  

  // Send message
  const sendMutation = useMutation({
    mutationFn: (msgData: Parameters<typeof sendMessage>[1]) =>
      sendMessage(id!, msgData),
    onSuccess: (newMessage) => {
      queryClient.setQueryData(["messages", id], (old: typeof data) => {
        if (!old) return old;
        return {
          ...old,
          pages: [[newMessage, ...old.pages[0]], ...old.pages.slice(1)],
        };
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  // Mark as read
  useEffect(() => {
    if (id) markAsRead(id).catch(() => {});
  }, [id]);

  // Pusher realtime
  useEffect(() => {
    if (!id) return;
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`private-chat-${id}`);

    channel.bind("message:new", (evt: { message: Message }) => {
      queryClient.setQueryData(["messages", id], (old: typeof data) => {
        if (!old || !("pages" in old)) return old;
        const typedOld = old as { pages: Message[][]; pageParams: unknown[] };
        // Skip if message already exists (optimistic update already added it)
        if (typedOld.pages.some((p) => p.some((m) => m.id === evt.message.id))) {
          return typedOld;
        }
        return {
          ...typedOld,
          pages: [
            [evt.message, ...typedOld.pages[0]],
            ...typedOld.pages.slice(1),
          ],
        };
      });
      markAsRead(id).catch(() => {});
    });

    channel.bind(
      "reaction:added",
      (evt: { messageId: string; emoji: string; userId: number; userName: string }) => {
        updateReactionInCache(evt.messageId, evt.emoji, evt.userId, evt.userName, "add");
      }
    );

    channel.bind(
      "reaction:removed",
      (evt: { messageId: string; emoji: string; userId: number }) => {
        updateReactionInCache(evt.messageId, evt.emoji, evt.userId, "", "remove");
      }
    );

    // Message edited
    channel.bind(
      "message:edited",
      (evt: { messageId: string; content: string; editedAt: string }) => {
        updateMessageInCache(evt.messageId, {
          content: evt.content,
          editedAt: evt.editedAt,
        });
      }
    );

    // Message deleted
    channel.bind("message:deleted", (evt: { messageId: string }) => {
      updateMessageInCache(evt.messageId, {
        isDeleted: true,
        content: "",
      });
    });

    // Typing indicator
    channel.bind(
      "typing",
      (evt: { userId: number; userName: string }) => {
        if (evt.userId === user?.id) return;
        setTypingUsers((prev) => {
          if (prev.includes(evt.userName)) return prev;
          return [...prev, evt.userName];
        });
        // Clear after 3 seconds
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((n) => n !== evt.userName));
        }, 3000);
      }
    );

    return () => {
      pusher.unsubscribe(`private-chat-${id}`);
    };
  }, [id, queryClient, user?.id]);

  function updateMessageInCache(
    messageId: string,
    updates: Partial<Message>
  ) {
    queryClient.setQueryData(["messages", id], (old: typeof data) => {
      if (!old) return old;
      const typedOld = old as { pages: Message[][]; pageParams: unknown[] };
      return {
        ...typedOld,
        pages: typedOld.pages.map((page) =>
          page.map((msg) =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          )
        ),
      };
    });
  }

  function updateReactionInCache(
    messageId: string,
    emoji: string,
    reactUserId: number,
    userName: string,
    action: "add" | "remove"
  ) {
    queryClient.setQueryData(["messages", id], (old: typeof data) => {
      if (!old) return old;
      const typedOld = old as { pages: Message[][]; pageParams: unknown[] };
      return {
        ...typedOld,
        pages: typedOld.pages.map((page) =>
          page.map((msg) => {
            if (msg.id !== messageId) return msg;
            let reactions = [...(msg.reactions || [])];
            if (action === "add") {
              const existing = reactions.find((r) => r.emoji === emoji);
              if (existing) {
                if (!existing.users.some((u) => u.id === reactUserId)) {
                  existing.count++;
                  existing.users.push({ id: reactUserId, name: userName });
                }
              } else {
                reactions.push({
                  emoji,
                  count: 1,
                  users: [{ id: reactUserId, name: userName }],
                });
              }
            } else {
              reactions = reactions
                .map((r) => {
                  if (r.emoji !== emoji) return r;
                  return {
                    ...r,
                    count: r.count - 1,
                    users: r.users.filter((u) => u.id !== reactUserId),
                  };
                })
                .filter((r) => r.count > 0);
            }
            return { ...msg, reactions };
          })
        ),
      };
    });
  }

  // Handlers
  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    setInputText("");
    sendMutation.mutate({
      content: text,
      type: "text",
      replyToId: replyTo?.id,
      mentions: mentionIds.length > 0 ? mentionIds : undefined,
    });
    setReplyTo(null);
    setMentionIds([]);
  }, [inputText, sendMutation, replyTo, mentionIds]);

  const handleAudioReady = useCallback(
    (audioData: { url: string; fileName: string; fileSize: number; fileDuration: number }) => {
      sendMutation.mutate({
        content: "Audio",
        type: "audio",
        fileUrl: audioData.url,
        fileName: audioData.fileName,
        fileSize: audioData.fileSize,
        fileDuration: audioData.fileDuration,
        replyToId: replyTo?.id,
      });
      setReplyTo(null);
    },
    [sendMutation, replyTo]
  );

  const handlePickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];

    // Resize large images to max 1600px for faster uploads
    // TODO: Install expo-image-manipulator for proper resize; for now relying on quality compression
    let finalUri = asset.uri;
    let finalName = asset.fileName || `image-${Date.now()}.jpg`;
    let finalType = asset.mimeType || "image/jpeg";

    const formData = new FormData();
    formData.append("file", {
      uri: finalUri,
      name: finalName,
      type: finalType,
    } as unknown as Blob);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/api/chat/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const uploadData = await res.json();

      sendMutation.mutate({
        content: "Imagen",
        type: "image",
        fileUrl: uploadData.url,
        fileName: uploadData.fileName,
        fileSize: uploadData.fileSize,
        replyToId: replyTo?.id,
      });
      setReplyTo(null);
    } catch {
      Alert.alert("Error", "No se pudo enviar la imagen");
    }
  }, [sendMutation, replyTo]);

  const handlePickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "*/*" });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const formData = new FormData();
    formData.append("file", {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType || "application/octet-stream",
    } as unknown as Blob);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/api/chat/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const uploadData = await res.json();

      sendMutation.mutate({
        content: asset.name,
        type: "file",
        fileUrl: uploadData.url,
        fileName: asset.name,
        fileSize: uploadData.fileSize,
        replyToId: replyTo?.id,
      });
      setReplyTo(null);
    } catch {
      Alert.alert("Error", "No se pudo enviar el archivo");
    }
  }, [sendMutation, replyTo]);

  const handleToggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const msg = allMessages.find((m) => m.id === messageId);
      const existing = msg?.reactions?.find((r) => r.emoji === emoji);
      const isMine = existing?.users.some((u) => u.id === user?.id);

      if (isMine) {
        removeReaction(messageId, emoji).catch(() => {});
        updateReactionInCache(messageId, emoji, user!.id, "", "remove");
      } else {
        addReaction(messageId, emoji).catch(() => {});
        updateReactionInCache(messageId, emoji, user!.id, user!.name, "add");
      }
    },
    [allMessages, user]
  );

  // Edit message
  const handleStartEdit = useCallback((msg: Message) => {
    setEditingMessage(msg);
    setEditText(msg.content);
    haptics.selection();
  }, [haptics]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingMessage || !editText.trim()) return;
    try {
      const updated = await editMessage(editingMessage.id, editText.trim());
      updateMessageInCache(editingMessage.id, {
        content: updated.content,
        editedAt: updated.editedAt,
      });
      setEditingMessage(null);
      haptics.success();
    } catch {
      Alert.alert("Error", "No se pudo editar el mensaje");
    }
  }, [editingMessage, editText, haptics]);

  // Delete message
  const handleDelete = useCallback(
    (msg: Message) => {
      Alert.alert(
        "Eliminar mensaje",
        "Este mensaje será eliminado para todos.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteMessage(msg.id);
                updateMessageInCache(msg.id, { isDeleted: true, content: "" });
                haptics.medium();
              } catch {
                Alert.alert("Error", "No se pudo eliminar el mensaje");
              }
            },
          },
        ]
      );
    },
    [haptics]
  );

  // Typing indicator - send on text change
  const handleTextChange = useCallback(
    (text: string) => {
      setInputText(text);
      const match = text.match(/@(\w*)$/);
      setMentionFilter(match ? match[1] : null);

      // Throttle typing events to 1 per 2 seconds
      const now = Date.now();
      if (now - lastTypingSentRef.current > 2000 && id) {
        lastTypingSentRef.current = now;
        sendTyping(id).catch(() => {});
      }
    },
    [id]
  );

  const handleMentionSelect = useCallback(
    (member: { userId: number; user: { name: string } }) => {
      const newText = inputText.replace(/@\w*$/, `@${member.user.name} `);
      setInputText(newText);
      setMentionFilter(null);
      setMentionIds((prev) =>
        prev.includes(member.userId) ? prev : [...prev, member.userId]
      );
    },
    [inputText]
  );

  // ── Stable callbacks for FlatList ──
  const handleReply = useCallback((msg: Message) => setReplyTo(msg), []);
  const handleForward = useCallback((msg: Message) => setForwardMessage(msg), []);
  const handleReaction = useCallback((msg: Message) => {
    setReactionTargetId(msg.id);
    setShowReactionPicker(true);
  }, []);
  const handleImagePreview = useCallback((url: string) => setImagePreviewUrl(url), []);

  const scrollBtnVisible = useRef(false);
  const handleScroll = useCallback((e: any) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const shouldShow = offsetY > 300;
    if (shouldShow !== scrollBtnVisible.current) {
      scrollBtnVisible.current = shouldShow;
      setShowScrollBtn(shouldShow);
    }
  }, []);

  const keyExtractor = useCallback((item: Message) => item.id, []);

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const nextMsg = allMessages[index + 1];
      const showDate =
        !nextMsg ||
        new Date(item.createdAt).toDateString() !==
          new Date(nextMsg.createdAt).toDateString();

      return (
        <>
          <MessageBubble
            message={item}
            isMe={item.senderId === (user?.id ?? 1)}
            userId={user?.id ?? 0}
            highlighted={searchMode && searchResultIndices.includes(index)}
            onReply={handleReply}
            onForward={handleForward}
            onReaction={handleReaction}
            onToggleReaction={handleToggleReaction}
            onEdit={handleStartEdit}
            onDelete={handleDelete}
            onImagePreview={handleImagePreview}
            showSender={isGroup}
          />
          {showDate && <DateSeparator date={item.createdAt} isDark={isDark} />}
        </>
      );
    },
    [allMessages, user?.id, searchMode, searchResultIndices, isGroup, isDark,
     handleReply, handleForward, handleReaction, handleToggleReaction,
     handleStartEdit, handleDelete, handleImagePreview]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.chatHeaderBg, paddingTop: insets.top }}>
      <ChatHeader
        title={title}
        conversationId={id!}
        isGroup={isGroup}
        isOrvitBot={isOrvitBot}
        memberCount={memberCount}
        typingNames={typingUsers}
        onSearchPress={() => {
          setSearchMode(true);
          setSearchQuery("");
          setSearchResultIds([]);
          setSearchIndex(0);
          setIsSearching(false);
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.chatBg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ flex: 1, position: "relative" }}>
        <ChatBackgroundPattern isDark={isDark} />
        <FlatList
          ref={flatListRef}
          style={{ zIndex: 1 }}
          data={allMessages}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          inverted
          removeClippedSubviews={Platform.OS !== "web"}
          maxToRenderPerBatch={15}
          windowSize={11}
          initialNumToRender={20}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.3}
          contentContainerStyle={{ paddingHorizontal: 4, paddingVertical: 6 }}
          onScroll={handleScroll}
          scrollEventThrottle={250}
          ListHeaderComponent={
            typingUsers.length > 0 ? (
              <TypingIndicator names={typingUsers} />
            ) : null
          }
        />

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={{
              position: "absolute",
              bottom: 12,
              right: 12,
              zIndex: 10,
            }}
          >
            <AnimatedPressable
              onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
              haptic="light"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.bgSecondary,
                justifyContent: "center",
                alignItems: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDark ? 0.3 : 0.15,
                shadowRadius: 4,
                elevation: 4,
              }}
            >
              <Ionicons name="chevron-down" size={22} color={colors.textPrimary} />
            </AnimatedPressable>
          </Animated.View>
        )}
        </View>

        {/* Search bar overlay */}
        {searchMode && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.chatHeaderBg,
              paddingHorizontal: 12,
              paddingVertical: 8,
              gap: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={{
                flex: 1,
                color: colors.textPrimary,
                fontSize: 14,
                backgroundColor: colors.bgInput,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
                height: 34,
              }}
              placeholder="Buscar en la conversación..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (!text.trim()) {
                  setSearchResultIds([]);
                  setSearchIndex(0);
                  setIsSearching(false);
                  if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                  return;
                }
                if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                setIsSearching(true);
                searchDebounceRef.current = setTimeout(async () => {
                  try {
                    const results = await searchMessages(id!, text.trim(), { limit: 100 });
                    const ids = results.map((m) => m.id);
                    setSearchResultIds(ids);
                    setSearchIndex(0);
                    setIsSearching(false);
                    if (ids.length > 0) {
                      const firstIdx = allMessages.findIndex((m) => ids.includes(m.id));
                      if (firstIdx >= 0) {
                        flatListRef.current?.scrollToIndex({ index: firstIdx, animated: true });
                      }
                    }
                  } catch {
                    setIsSearching(false);
                  }
                }, 300);
              }}
              autoFocus
            />
            {isSearching && (
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>...</Text>
            )}
            {!isSearching && searchResultIndices.length > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {searchIndex + 1}/{searchResultIndices.length}
                </Text>
                <AnimatedPressable
                  onPress={() => {
                    const next = (searchIndex + 1) % searchResultIndices.length;
                    setSearchIndex(next);
                    flatListRef.current?.scrollToIndex({ index: searchResultIndices[next], animated: true });
                  }}
                  haptic="light"
                  style={{ padding: 4 }}
                >
                  <Ionicons name="chevron-down" size={18} color={colors.textPrimary} />
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={() => {
                    const prev = searchIndex === 0 ? searchResultIndices.length - 1 : searchIndex - 1;
                    setSearchIndex(prev);
                    flatListRef.current?.scrollToIndex({ index: searchResultIndices[prev], animated: true });
                  }}
                  haptic="light"
                  style={{ padding: 4 }}
                >
                  <Ionicons name="chevron-up" size={18} color={colors.textPrimary} />
                </AnimatedPressable>
              </View>
            )}
            {!isSearching && searchQuery.trim() && searchResultIndices.length === 0 && searchResultIds.length > 0 && (
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                {searchResultIds.length} resultado{searchResultIds.length !== 1 ? "s" : ""} (cargar más)
              </Text>
            )}
            {!isSearching && searchQuery.trim() && searchResultIds.length === 0 && (
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>Sin resultados</Text>
            )}
            <AnimatedPressable
              onPress={() => {
                setSearchMode(false);
                setSearchQuery("");
                setSearchResultIds([]);
                setIsSearching(false);
                if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
              }}
              haptic="light"
            >
              <Ionicons name="close-outline" size={22} color={colors.textPrimary} />
            </AnimatedPressable>
          </Animated.View>
        )}

        {/* Mention list */}
        {mentionFilter !== null && members && (
          <View style={{ position: "relative" }}>
            <MentionList
              members={members}
              filter={mentionFilter}
              onSelect={handleMentionSelect}
            />
          </View>
        )}

        {/* Edit message bar */}
        {editingMessage && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.chatBg,
              paddingHorizontal: 16,
              paddingVertical: 8,
              gap: 8,
            }}
          >
            <Ionicons name="pencil-outline" size={18} color={colors.primary} />
            <TextInput
              style={{
                flex: 1,
                color: colors.textPrimary,
                fontSize: 15,
                backgroundColor: colors.bgInput,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderWidth: 1,
                borderColor: colors.primary,
              }}
              value={editText}
              onChangeText={setEditText}
              autoFocus
            />
            <AnimatedPressable
              onPress={() => setEditingMessage(null)}
              haptic="light"
            >
              <Ionicons name="close-outline" size={22} color={colors.textMuted} />
            </AnimatedPressable>
            <AnimatedPressable onPress={handleSaveEdit} haptic="medium">
              <Ionicons name="checkmark-outline" size={22} color={colors.primary} />
            </AnimatedPressable>
          </Animated.View>
        )}

        {!editingMessage && (
          <ChatInputBar
            inputText={inputText}
            onChangeText={handleTextChange}
            onSend={handleSend}
            onPickImage={handlePickImage}
            onPickFile={handlePickFile}
            onAudioReady={handleAudioReady}
            isSending={sendMutation.isPending}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            bottomInset={insets.bottom}
          />
        )}
      </KeyboardAvoidingView>

      <ForwardMessageModal
        visible={!!forwardMessage}
        message={forwardMessage}
        currentConversationId={id}
        onClose={() => setForwardMessage(null)}
        onForwarded={(_convId, convName) => {
          haptics.success();
          setForwardMessage(null);
          Alert.alert("Mensaje reenviado", `Enviado a ${convName}`);
        }}
      />

      <ReactionPicker
        visible={showReactionPicker}
        onSelect={(emoji) => {
          if (reactionTargetId) {
            handleToggleReaction(reactionTargetId, emoji);
          }
          setReactionTargetId(null);
        }}
        onClose={() => {
          setShowReactionPicker(false);
          setReactionTargetId(null);
        }}
      />

      {/* Image preview modal */}
      <Modal
        visible={!!imagePreviewUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePreviewUrl(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.92)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <AnimatedPressable
            style={{ position: "absolute", top: 60, right: 20, zIndex: 10 }}
            onPress={() => setImagePreviewUrl(null)}
            haptic="light"
          >
            <Ionicons name="close-circle-outline" size={36} color="#fff" />
          </AnimatedPressable>
          {imagePreviewUrl && (
            <Image
              source={{ uri: imagePreviewUrl }}
              style={{
                width: SCREEN_WIDTH - 32,
                height: SCREEN_HEIGHT * 0.7,
              }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}
