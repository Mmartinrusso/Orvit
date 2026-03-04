import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Alert,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useHaptics } from "@/hooks/useHaptics";
import {
  getConversation,
  getMembers,
  updateConversation,
  addMembers,
  removeMember,
  getCompanyUsers,
} from "@/api/chat";
import Avatar from "@/components/ui/Avatar";
import type { Conversation, ConversationMember } from "@/types/chat";

// ── WhatsApp Dark palette ─────────────────────────────────
const C = {
  bg: "#0b1014",
  card: "#111820",
  textPrimary: "#ffffff",
  textSecondary: "rgba(255,255,255,0.5)",
  accent: "#3b82f6",
  danger: "#ef4444",
  success: "#22c55e",
  divider: "rgba(255,255,255,0.06)",
  actionBg: "rgba(255,255,255,0.08)",
};


// ── Component ─────────────────────────────────────────────
export default function ChatInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [addSearch, setAddSearch] = useState("");

  const { data: conv } = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => getConversation(id!),
    enabled: !!id,
  });

  const { data: members, refetch: refetchMembers } = useQuery({
    queryKey: ["members", id],
    queryFn: () => getMembers(id!),
    enabled: !!id,
  });

  const { data: allUsers } = useQuery({
    queryKey: ["company-users"],
    queryFn: getCompanyUsers,
    enabled: showAddMember,
  });

  const isGroup = conv?.type === "CHANNEL" || conv?.type === "CONTEXTUAL";
  const isOrvitBot = (conv as any)?._isOrvitBot === true;
  const isAdmin = members?.some(
    (m) => m.userId === user?.id && m.role === "admin"
  );

  const displayName = useMemo(() => {
    if (isOrvitBot) return "Orvit";
    if (conv?.type === "DIRECT") {
      const other = conv.members?.find((m) => m.userId !== user?.id);
      return other?.user?.name || "Chat directo";
    }
    return conv?.name || "Chat";
  }, [conv, user?.id, isOrvitBot]);

  const subtitle = useMemo(() => {
    if (isOrvitBot) return "Asistente de IA · Siempre disponible";
    if (conv?.type === "DIRECT") return "en línea";
    const count = members?.length ?? 0;
    return `${count} miembro${count !== 1 ? "s" : ""} · Grupo`;
  }, [conv?.type, members?.length, isOrvitBot]);

  // ── Handlers ────────────────────────────────────────────
  const handleToggleMute = useCallback(() => {
    haptics.selection();
    Alert.alert("Próximamente", "Esta función estará disponible pronto");
  }, [haptics]);

  const handleToggleArchive = useCallback(async () => {
    if (!conv) return;
    const newArchived = !conv.isArchived;
    try {
      haptics.medium();
      await updateConversation(conv.id, { isArchived: newArchived });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversation", id] });
      Alert.alert(
        newArchived ? "Archivado" : "Desarchivado",
        newArchived
          ? "La conversación fue archivada"
          : "La conversación fue restaurada"
      );
    } catch {
      Alert.alert("Error", "No se pudo actualizar la conversación");
    }
  }, [conv, haptics, queryClient, id]);

  const handleSaveName = useCallback(async () => {
    if (!newName.trim()) return;
    try {
      await updateConversation(id!, { name: newName.trim() });
      queryClient.invalidateQueries({ queryKey: ["conversation", id] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setEditingName(false);
      haptics.success();
    } catch {
      Alert.alert("Error", "No se pudo actualizar el nombre");
    }
  }, [newName, id, queryClient, haptics]);

  const handleAddMember = useCallback(
    async (userId: number) => {
      try {
        await addMembers(id!, [userId]);
        refetchMembers();
        haptics.success();
      } catch {
        Alert.alert("Error", "No se pudo agregar al miembro");
      }
    },
    [id, refetchMembers, haptics]
  );

  const handleRemoveMember = useCallback(
    (memberId: number, memberName: string) => {
      const isSelf = memberId === user?.id;
      Alert.alert(
        isSelf ? "Salir del grupo" : "Remover miembro",
        isSelf
          ? "¿Querés salir de este grupo?"
          : `¿Remover a ${memberName} del grupo?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: isSelf ? "Salir" : "Remover",
            style: "destructive",
            onPress: async () => {
              try {
                await removeMember(id!, memberId);
                if (isSelf) {
                  router.replace("/(tabs)/inbox");
                } else {
                  refetchMembers();
                }
                haptics.medium();
              } catch {
                Alert.alert("Error", "No se pudo remover al miembro");
              }
            },
          },
        ]
      );
    },
    [id, user?.id, refetchMembers, haptics]
  );

  const handleDangerAction = useCallback(() => {
    if (isGroup) {
      handleRemoveMember(user!.id, user!.name);
    } else {
      Alert.alert("Próximamente", "Esta función estará disponible pronto");
    }
  }, [isGroup, handleRemoveMember, user]);

  // Filter users for add member modal
  const memberIds = members?.map((m) => m.userId) ?? [];
  const availableUsers = (allUsers ?? [])
    .filter((u) => u.isActive && u.id !== user?.id)
    .filter(
      (u) =>
        u.name.toLowerCase().includes(addSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(addSearch.toLowerCase())
    );

  // ── Quick action buttons config ─────────────────────────
  const quickActions = useMemo(() => {
    if (isOrvitBot) {
      return [
        { icon: "mic" as const, label: "Audio", onPress: () => Alert.alert("Tip", "Mandá un audio desde el chat y Orvit lo procesa automáticamente") },
        { icon: "search" as const, label: "Buscar", onPress: () => Alert.alert("Próximamente", "Búsqueda dentro del chat") },
        { icon: "notifications-off" as const, label: conv?.muted ? "Activar" : "Silenciar", onPress: handleToggleMute },
        { icon: "help-circle" as const, label: "Ayuda", onPress: () => Alert.alert("Orvit AI", "Podés mandarme:\n\n🎤 Audios para crear fallas, tareas o consultas\n✍️ Texto con instrucciones\n📊 Pedidos de reportes y resúmenes\n\nEjemplos:\n• \"La máquina 5 tiene una falla\"\n• \"Creame una tarea para mañana\"\n• \"Cómo viene la producción?\"") },
      ];
    }
    if (isGroup) {
      return [
        ...(isAdmin
          ? [{ icon: "person-add" as const, label: "Agregar", onPress: () => setShowAddMember(true) }]
          : []),
        { icon: "search" as const, label: "Buscar", onPress: () => Alert.alert("Próximamente", "Búsqueda dentro del chat") },
        { icon: "notifications-off" as const, label: conv?.muted ? "Activar" : "Silenciar", onPress: handleToggleMute },
        { icon: "ellipsis-horizontal" as const, label: "Más", onPress: handleToggleArchive },
      ];
    }
    return [
      { icon: "call" as const, label: "Audio", onPress: () => Alert.alert("Próximamente", "Llamadas de voz") },
      { icon: "videocam" as const, label: "Video", onPress: () => Alert.alert("Próximamente", "Videollamadas") },
      { icon: "search" as const, label: "Buscar", onPress: () => Alert.alert("Próximamente", "Búsqueda dentro del chat") },
      { icon: "notifications-off" as const, label: conv?.muted ? "Activar" : "Silenciar", onPress: handleToggleMute },
    ];
  }, [isGroup, isAdmin, isOrvitBot, conv?.muted, handleToggleMute, handleToggleArchive]);

  if (!conv) {
    return (
      <SafeAreaView style={s.container} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={C.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Info</Text>
        </View>
        <View style={s.emptyCenter}>
          <Text style={s.emptyText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* ── Header ─────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Info</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {/* ── Profile ────────────────────────────────────── */}
        <View style={s.profileSection}>
          {isOrvitBot ? (
            <View style={[s.avatarLarge, { backgroundColor: C.accent }]}>
              <Ionicons name="sparkles" size={36} color="#fff" />
            </View>
          ) : isGroup ? (
            <View style={s.avatarLarge}>
              <Ionicons
                name={(conv.iconName as keyof typeof Ionicons.glyphMap) || "people"}
                size={36}
                color={C.textPrimary}
              />
            </View>
          ) : (
            <Avatar name={displayName} size="xl" />
          )}
          <Text style={s.profileName}>{displayName}</Text>
          <Text style={s.profileSubtitle}>{subtitle}</Text>
        </View>

        {/* ── Edit name (inline) ─────────────────────────── */}
        {editingName && (
          <Animated.View entering={FadeInDown.duration(200)} style={s.editContainer}>
            <TextInput
              style={s.editInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Nombre del grupo"
              placeholderTextColor={C.textSecondary}
              autoFocus
            />
            <View style={s.editActions}>
              <TouchableOpacity
                style={s.editBtnCancel}
                onPress={() => setEditingName(false)}
                activeOpacity={0.7}
              >
                <Text style={s.editBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.editBtnSave}
                onPress={handleSaveName}
                activeOpacity={0.7}
              >
                <Text style={s.editBtnSaveText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* ── Quick actions ──────────────────────────────── */}
        <View style={s.quickActions}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={s.quickActionBtn}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <View style={s.quickActionCircle}>
                <Ionicons name={action.icon} size={20} color={C.textPrimary} />
              </View>
              <Text style={s.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Description (group or Orvit bot) ─────────────── */}
        {(isGroup || isOrvitBot) && conv.description && (
          <View style={s.card}>
            <Text style={s.cardDescription}>{conv.description}</Text>
          </View>
        )}

        {/* ── Edit name row (admin) ──────────────────────── */}
        {isGroup && isAdmin && !editingName && (
          <TouchableOpacity
            style={s.card}
            onPress={() => {
              setNewName(conv?.name || "");
              setEditingName(true);
            }}
            activeOpacity={0.7}
          >
            <View style={s.rowItem}>
              <Ionicons name="pencil" size={18} color={C.accent} />
              <Text style={[s.rowText, { color: C.accent }]}>Editar nombre del grupo</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Media placeholder ──────────────────────────── */}
        <TouchableOpacity
          style={s.card}
          onPress={() => Alert.alert("Próximamente", "Archivos multimedia")}
          activeOpacity={0.7}
        >
          <View style={s.rowItem}>
            <Ionicons name="image" size={18} color={C.textSecondary} />
            <Text style={[s.rowText, { flex: 1 }]}>Archivos, enlaces y documentos</Text>
            <Ionicons name="chevron-forward" size={16} color={C.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* ── Parent group link ──────────────────────────── */}
        {conv.parent && (
          <>
            <Text style={s.sectionTitle}>Grupo padre</Text>
            <TouchableOpacity
              style={s.card}
              onPress={() => router.push(`/chat/${conv.parent!.id}`)}
              activeOpacity={0.7}
            >
              <View style={s.rowItem}>
                <View style={s.rowIconCircle}>
                  <Ionicons
                    name={(conv.parent.iconName as keyof typeof Ionicons.glyphMap) || "people"}
                    size={16}
                    color={C.accent}
                  />
                </View>
                <Text style={[s.rowText, { flex: 1 }]}>{conv.parent.name || "Sin nombre"}</Text>
                <Ionicons name="chevron-forward" size={16} color={C.textSecondary} />
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* ── Members ────────────────────────────────────── */}
        {members && members.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>
                {isGroup ? `${members.length} miembros` : "Participantes"}
              </Text>
              {isGroup && isAdmin && (
                <TouchableOpacity onPress={() => setShowAddMember(true)} activeOpacity={0.7}>
                  <Ionicons name="search" size={18} color={C.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <View style={s.card}>
              {/* Add member row (admin only) */}
              {isGroup && isAdmin && (
                <TouchableOpacity
                  style={[s.memberRow, s.memberRowBorder]}
                  onPress={() => setShowAddMember(true)}
                  activeOpacity={0.7}
                >
                  <View style={[s.memberAvatar, { backgroundColor: C.success }]}>
                    <Ionicons name="person-add" size={16} color="#fff" />
                  </View>
                  <Text style={[s.memberName, { color: C.textPrimary }]}>Agregar miembro</Text>
                </TouchableOpacity>
              )}

              {members.map((member, index) => (
                <View
                  key={member.userId}
                  style={[
                    s.memberRow,
                    index < members.length - 1 && s.memberRowBorder,
                  ]}
                >
                  <Avatar name={member.user?.name || "?"} size="sm" />
                  <View style={s.memberInfo}>
                    <Text style={s.memberName}>{member.user?.name || "Usuario"}</Text>
                  </View>
                  {member.role === "admin" && (
                    <View style={s.badge}>
                      <Text style={s.badgeText}>Admin</Text>
                    </View>
                  )}
                  {member.userId === user?.id && (
                    <View style={[s.badge, { backgroundColor: `${C.success}20` }]}>
                      <Text style={[s.badgeText, { color: C.success }]}>Tú</Text>
                    </View>
                  )}
                  {isAdmin && member.userId !== user?.id && member.role !== "admin" && (
                    <TouchableOpacity
                      style={s.removeBadge}
                      onPress={() => handleRemoveMember(member.userId, member.user?.name || "")}
                      activeOpacity={0.7}
                    >
                      <Text style={s.removeBadgeText}>Remover</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Subgroups ──────────────────────────────────── */}
        {isGroup && conv.type === "CHANNEL" && (conv.depth ?? 0) < 4 && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>
                Subgrupos{conv.children && conv.children.length > 0 ? ` (${conv.children.length})` : ""}
              </Text>
              {isAdmin && (
                <TouchableOpacity
                  onPress={() => router.push(`/new-chat?parentId=${conv.id}`)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle" size={22} color={C.accent} />
                </TouchableOpacity>
              )}
            </View>
            <View style={s.card}>
              {(!conv.children || conv.children.length === 0) ? (
                <View style={s.emptyCard}>
                  <Ionicons name="folder-open-outline" size={24} color={C.textSecondary} />
                  <Text style={s.emptyCardText}>No hay subgrupos</Text>
                </View>
              ) : (
                conv.children.map((child, index) => (
                  <TouchableOpacity
                    key={child.id}
                    style={[
                      s.memberRow,
                      index < (conv.children?.length ?? 0) - 1 && s.memberRowBorder,
                    ]}
                    onPress={() => router.push(`/chat/${child.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={s.rowIconCircle}>
                      <Ionicons
                        name={(child.iconName as keyof typeof Ionicons.glyphMap) || "people"}
                        size={16}
                        color={C.accent}
                      />
                    </View>
                    <View style={s.memberInfo}>
                      <Text style={s.memberName}>{child.name || "Sin nombre"}</Text>
                      <Text style={s.memberSub}>
                        {child.memberCount} miembro{child.memberCount !== 1 ? "s" : ""}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={C.textSecondary} />
                  </TouchableOpacity>
                ))
              )}

              {isAdmin && (
                <TouchableOpacity
                  style={[s.memberRow, { justifyContent: "center" }]}
                  onPress={() => router.push(`/new-chat?parentId=${conv.id}`)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={18} color={C.accent} />
                  <Text style={[s.memberName, { color: C.accent, flex: 0, marginLeft: 6 }]}>
                    Crear subgrupo
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* ── Danger zone ────────────────────────────────── */}
        <TouchableOpacity style={s.dangerCard} onPress={handleDangerAction} activeOpacity={0.7}>
          <Ionicons
            name={isGroup ? "exit-outline" : "trash-outline"}
            size={18}
            color={C.danger}
          />
          <Text style={s.dangerText}>
            {isGroup ? "Salir del grupo" : "Eliminar chat"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Add member modal ─────────────────────────────── */}
      <Modal
        visible={showAddMember}
        animationType="slide"
        onRequestClose={() => setShowAddMember(false)}
      >
        <SafeAreaView style={s.modalContainer} edges={["top", "bottom"]}>
          <View style={s.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowAddMember(false);
                setAddSearch("");
              }}
              style={s.backBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color={C.textPrimary} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Agregar miembro</Text>
          </View>

          <TextInput
            style={s.modalSearch}
            placeholder="Buscar por nombre o email..."
            placeholderTextColor={C.textSecondary}
            value={addSearch}
            onChangeText={setAddSearch}
            autoCapitalize="none"
          />

          <FlatList
            data={availableUsers}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => {
              const isMember = memberIds.includes(item.id);
              return (
                <View style={[s.memberRow, s.memberRowBorder, { paddingHorizontal: 16 }]}>
                  <Avatar name={item.name} size="md" />
                  <View style={s.memberInfo}>
                    <Text style={s.memberName}>{item.name}</Text>
                    <Text style={s.memberSub}>{item.email}</Text>
                  </View>
                  {isMember ? (
                    <Text style={s.alreadyText}>Ya es miembro</Text>
                  ) : (
                    <TouchableOpacity
                      style={s.addMemberBtn}
                      onPress={() => handleAddMember(item.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.addMemberBtnText}>Agregar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={s.emptyCenter}>
                <Text style={s.emptyText}>
                  {addSearch ? "Sin resultados" : "Cargando..."}
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: C.textPrimary,
    flex: 1,
  },

  // Profile
  profileSection: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 8,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.actionBg,
    justifyContent: "center",
    alignItems: "center",
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    color: C.textPrimary,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  profileSubtitle: {
    fontSize: 13,
    color: C.textSecondary,
  },

  // Edit name
  editContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  editInput: {
    backgroundColor: C.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.textPrimary,
    borderWidth: 1,
    borderColor: C.accent,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
  },
  editBtnCancel: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.actionBg,
  },
  editBtnCancelText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textSecondary,
  },
  editBtnSave: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.accent,
  },
  editBtnSaveText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },

  // Quick actions
  quickActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  quickActionBtn: {
    alignItems: "center",
    gap: 6,
  },
  quickActionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.actionBg,
    justifyContent: "center",
    alignItems: "center",
  },
  quickActionLabel: {
    fontSize: 11,
    color: C.textSecondary,
  },

  // Cards
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: C.card,
    borderRadius: 12,
    overflow: "hidden",
  },
  cardDescription: {
    fontSize: 14,
    color: C.textPrimary,
    padding: 14,
    lineHeight: 20,
  },

  // Row item (media, edit, parent)
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  rowText: {
    fontSize: 14,
    color: C.textPrimary,
  },
  rowIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.actionBg,
    justifyContent: "center",
    alignItems: "center",
  },

  // Section headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  // Member rows
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  memberRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.divider,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "500",
    color: C.textPrimary,
  },
  memberSub: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 1,
  },

  // Badges
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: `${C.accent}20`,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: C.accent,
  },
  removeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: `${C.danger}15`,
  },
  removeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: C.danger,
  },

  // Danger
  dangerCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: C.card,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  dangerText: {
    fontSize: 15,
    fontWeight: "500",
    color: C.danger,
  },

  // Empty states
  emptyCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 14,
    color: C.textSecondary,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  emptyCardText: {
    fontSize: 13,
    color: C.textSecondary,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: C.bg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.divider,
  },
  modalSearch: {
    backgroundColor: C.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: C.textPrimary,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  alreadyText: {
    fontSize: 12,
    color: C.textSecondary,
  },
  addMemberBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.accent,
  },
  addMemberBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
});
