import { useEffect, useRef, useState, useCallback } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
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
} from "@/api/chat";
import { getAccessToken } from "@/lib/storage";
import { API_URL } from "@/api/client";
import { getPusherClient } from "@/lib/pusher";
import ChatHeader from "@/components/chat/ChatHeader";
import MessageBubble from "@/components/chat/MessageBubble";
import ChatInputBar from "@/components/chat/ChatInputBar";
import TypingIndicator from "@/components/chat/TypingIndicator";
import MentionList from "@/components/MentionList";
import ReactionPicker from "@/components/ReactionPicker";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import type { Message } from "@/types/chat";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const [inputText, setInputText] = useState("");
  const [title, setTitle] = useState("Chat");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);
  const [mentionFilter, setMentionFilter] = useState<string | null>(null);
  const [mentionIds, setMentionIds] = useState<number[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const lastTypingSentRef = useRef(0);

  // Conversation info
  useEffect(() => {
    if (!id) return;
    getConversation(id)
      .then((conv) => {
        if (conv.type === "DIRECT") {
          const other = conv.members?.find((m) => m.userId !== user?.id);
          setTitle(other?.user?.name || "Chat directo");
        } else {
          setTitle(conv.name || "Chat");
        }
      })
      .catch(() => {});
  }, [id, user?.id]);

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

  const allMessages = data?.pages.flat() ?? [];

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
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const formData = new FormData();
    formData.append("file", {
      uri: asset.uri,
      name: asset.fileName || `image-${Date.now()}.jpg`,
      type: asset.mimeType || "image/jpeg",
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <ChatHeader title={title} conversationId={id!} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={allMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isMe={item.senderId === user?.id}
              userId={user?.id ?? 0}
              onReply={(msg) => setReplyTo(msg)}
              onReaction={(msg) => {
                setReactionTargetId(msg.id);
                setShowReactionPicker(true);
              }}
              onToggleReaction={handleToggleReaction}
              onEdit={handleStartEdit}
              onDelete={handleDelete}
              onImagePreview={(url) => setImagePreviewUrl(url)}
            />
          )}
          inverted
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.3}
          contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 8 }}
          ListHeaderComponent={
            typingUsers.length > 0 ? (
              <TypingIndicator />
            ) : null
          }
        />

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
              backgroundColor: colors.bgSecondary,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingHorizontal: 16,
              paddingVertical: 8,
              gap: 8,
            }}
          >
            <Ionicons name="pencil" size={18} color={colors.primary} />
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
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </AnimatedPressable>
            <AnimatedPressable onPress={handleSaveEdit} haptic="medium">
              <Ionicons name="checkmark" size={22} color={colors.primary} />
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
          />
        )}
      </KeyboardAvoidingView>

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
            <Ionicons name="close-circle" size={36} color="#fff" />
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
    </SafeAreaView>
  );
}
