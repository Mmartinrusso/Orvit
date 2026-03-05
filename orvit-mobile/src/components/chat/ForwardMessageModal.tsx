import { useState, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { getConversations, sendMessage } from "@/api/chat";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import type { Message, Conversation } from "@/types/chat";

interface Props {
  visible: boolean;
  message: Message | null;
  onClose: () => void;
  onForwarded: (conversationId: string) => void;
}

export default function ForwardMessageModal({
  visible,
  message,
  onClose,
  onForwarded,
}: Props) {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["conversations-forward"],
    queryFn: () => getConversations({ limit: 100 }),
    enabled: visible,
  });

  const conversations = useMemo(() => {
    const list = data?.conversations ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((c) => {
      const name =
        c.type === "DIRECT"
          ? c.members?.find((m) => m.userId !== user?.id)?.user?.name || ""
          : c.name || "";
      return name.toLowerCase().includes(q);
    });
  }, [data, search, user?.id]);

  const getConvName = (c: Conversation) => {
    if (c.type === "DIRECT") {
      return c.members?.find((m) => m.userId !== user?.id)?.user?.name || "Chat directo";
    }
    return c.name || "Grupo";
  };

  const handleForward = async (conv: Conversation) => {
    if (!message || sending) return;
    setSending(conv.id);
    try {
      const prefix = `↪️ *Reenviado*\n`;
      let content = prefix;

      if (message.type === "text") {
        content += message.content;
      } else if (message.type === "audio") {
        content += "🎤 Audio";
      } else if (message.type === "image") {
        content += "📷 Imagen";
      } else if (message.type === "file") {
        content += `📎 ${message.fileName || "Archivo"}`;
      }

      await sendMessage(conv.id, {
        content,
        type: message.type === "text" ? "text" : message.type,
        fileUrl: message.fileUrl || undefined,
        fileName: message.fileName || undefined,
        fileSize: message.fileSize || undefined,
        fileDuration: message.fileDuration || undefined,
      });

      onForwarded(conv.id);
      onClose();
      setSearch("");
    } catch {
      Alert.alert("Error", "No se pudo reenviar el mensaje");
    } finally {
      setSending(null);
    }
  };

  const renderItem = ({ item }: { item: Conversation }) => {
    const name = getConvName(item);
    const isGroup = item.type !== "DIRECT";
    const isSending = sending === item.id;

    return (
      <AnimatedPressable
        onPress={() => handleForward(item)}
        haptic="light"
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 12,
          opacity: isSending ? 0.5 : 1,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: isGroup
              ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)")
              : colors.primary,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons
            name={isGroup ? "people-outline" : "person-outline"}
            size={20}
            color={isGroup ? colors.textPrimary : "#fff"}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "500" }}>
            {name}
          </Text>
          {isGroup && (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }}>
              Grupo
            </Text>
          )}
        </View>
        {isSending && <ActivityIndicator size="small" color={colors.primary} />}
      </AnimatedPressable>
    );
  };

  if (!message) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 12,
            backgroundColor: colors.chatHeaderBg,
            gap: 12,
          }}
        >
          <AnimatedPressable onPress={onClose} haptic="light">
            <Ionicons name="close-outline" size={24} color={colors.textPrimary} />
          </AnimatedPressable>
          <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 18, fontWeight: "600" }}>
            Reenviar a...
          </Text>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.chatHeaderBg }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.chatInputBg,
              borderRadius: 10,
              paddingHorizontal: 12,
              height: 36,
            }}
          >
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={{
                flex: 1,
                color: colors.textPrimary,
                fontSize: 14,
                marginLeft: 8,
                height: 36,
              }}
              placeholder="Buscar conversación..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {/* Message preview */}
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 8,
            marginBottom: 4,
            backgroundColor: colors.bgSecondary,
            borderRadius: 10,
            padding: 12,
            borderLeftWidth: 3,
            borderLeftColor: colors.primary,
          }}
        >
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 2 }}>
            {message.sender?.name || "Mensaje"}
          </Text>
          <Text style={{ color: colors.textPrimary, fontSize: 13 }} numberOfLines={2}>
            {message.type === "audio"
              ? "🎤 Audio"
              : message.type === "image"
              ? "📷 Imagen"
              : message.type === "file"
              ? `📎 ${message.fileName || "Archivo"}`
              : message.content}
          </Text>
        </View>

        {/* Conversation list */}
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: 4 }}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: "center" }}>
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                No se encontraron conversaciones
              </Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}
