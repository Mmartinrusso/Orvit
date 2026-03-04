import { useState, useCallback } from "react";
import {
  View,
  Text,
  Alert,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCreateStyles } from "@/hooks/useCreateStyles";
import { useHaptics } from "@/hooks/useHaptics";
import {
  getConversation,
  getMembers,
  updateConversation,
  addMembers,
  removeMember,
  getCompanyUsers,
} from "@/api/chat";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import AnimatedFadeIn from "@/components/ui/AnimatedFadeIn";
import Avatar from "@/components/ui/Avatar";

export default function ChatInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [addSearch, setAddSearch] = useState("");

  const styles = useCreateStyles((c, t, s, r) => ({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: s.lg,
      paddingVertical: s.md,
      gap: s.md,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.bgTertiary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    headerTitle: { ...t.heading, color: c.textPrimary, flex: 1 },
    profileSection: {
      alignItems: "center" as const,
      paddingVertical: s.xxxl,
      gap: s.md,
    },
    profileName: { ...t.heading, color: c.textPrimary },
    profileType: { ...t.caption, color: c.textMuted },
    card: {
      marginHorizontal: s.lg,
      marginBottom: s.lg,
      backgroundColor: c.bgSecondary,
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.border,
      overflow: "hidden" as const,
    },
    cardTitle: {
      ...t.caption,
      color: c.textMuted,
      paddingHorizontal: s.lg,
      paddingTop: s.md,
      paddingBottom: s.sm,
      textTransform: "uppercase" as const,
      letterSpacing: 1,
    },
    actionRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: s.lg,
      paddingVertical: s.md + 2,
      gap: s.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    actionRowLast: { borderBottomWidth: 0 },
    actionIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    actionText: { ...t.body, color: c.textPrimary, flex: 1 },
    memberItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: s.lg,
      paddingVertical: s.md,
      gap: s.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    memberName: { ...t.bodyMedium, color: c.textPrimary, flex: 1 },
    memberRole: {
      ...t.tiny,
      color: c.primary,
      backgroundColor: c.primaryBg,
      paddingHorizontal: s.sm,
      paddingVertical: 2,
      borderRadius: r.sm,
      overflow: "hidden" as const,
    },
    editInput: {
      backgroundColor: c.bgInput,
      borderRadius: r.md,
      paddingHorizontal: s.lg,
      paddingVertical: s.md,
      ...t.body,
      color: c.textPrimary,
      borderWidth: 1,
      borderColor: c.primary,
      marginHorizontal: s.lg,
      marginBottom: s.md,
    },
    editActions: {
      flexDirection: "row" as const,
      justifyContent: "flex-end" as const,
      gap: s.md,
      paddingHorizontal: s.lg,
      marginBottom: s.lg,
    },
    editBtn: {
      paddingHorizontal: s.lg,
      paddingVertical: s.sm,
      borderRadius: r.sm,
      backgroundColor: c.primary,
    },
    editBtnCancel: {
      paddingHorizontal: s.lg,
      paddingVertical: s.sm,
      borderRadius: r.sm,
      backgroundColor: c.bgTertiary,
    },
    editBtnText: { ...t.caption, color: "#fff" },
    editBtnCancelText: { ...t.caption, color: c.textSecondary },
    removeBtn: {
      paddingHorizontal: s.sm,
      paddingVertical: 2,
      borderRadius: r.sm,
      backgroundColor: `${c.error}15`,
    },
    removeBtnText: { ...t.tiny, color: c.error },
    // Add member modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: c.bg,
    },
    modalHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: s.lg,
      paddingVertical: s.md,
      gap: s.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    modalTitle: { ...t.heading, color: c.textPrimary, flex: 1 },
    modalSearch: {
      backgroundColor: c.bgInput,
      borderRadius: r.md,
      paddingHorizontal: s.lg,
      paddingVertical: s.md,
      ...t.body,
      color: c.textPrimary,
      borderWidth: 1,
      borderColor: c.border,
      marginHorizontal: s.lg,
      marginVertical: s.md,
    },
    userItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: s.lg,
      paddingVertical: s.md,
      gap: s.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    userName: { ...t.bodyMedium, color: c.textPrimary, flex: 1 },
    userEmail: { ...t.small, color: c.textMuted },
    addBtn: {
      paddingHorizontal: s.md,
      paddingVertical: s.xs,
      borderRadius: r.sm,
      backgroundColor: c.primary,
    },
    addBtnText: { ...t.caption, color: "#fff" },
    alreadyMember: { ...t.small, color: c.textMuted },
  }));

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
  const isAdmin = members?.some(
    (m) => m.userId === user?.id && m.role === "admin"
  );

  const displayName = (() => {
    if (conv?.type === "DIRECT") {
      const other = conv.members?.find((m) => m.userId !== user?.id);
      return other?.user?.name || "Chat directo";
    }
    return conv?.name || "Chat";
  })();

  const typeLabel =
    conv?.type === "DIRECT"
      ? "Chat directo"
      : conv?.type === "CHANNEL"
      ? "Grupo"
      : "Chat contextual";

  const handleToggleMute = useCallback(async () => {
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

  // Filter users for add member modal
  const memberIds = members?.map((m) => m.userId) ?? [];
  const availableUsers = (allUsers ?? [])
    .filter((u) => u.isActive && u.id !== user?.id)
    .filter(
      (u) =>
        u.name.toLowerCase().includes(addSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(addSearch.toLowerCase())
    );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedPressable
          onPress={() => router.back()}
          style={styles.backBtn}
          haptic="light"
        >
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>Info</Text>
      </View>

      <ScrollView>
        {/* Profile section */}
        <AnimatedFadeIn delay={0}>
          <View style={styles.profileSection}>
            <Avatar name={displayName} size="xl" />
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileType}>{typeLabel}</Text>
          </View>
        </AnimatedFadeIn>

        {/* Edit name (group only) */}
        {editingName && (
          <Animated.View entering={FadeInDown.duration(200)}>
            <TextInput
              style={styles.editInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Nombre del grupo"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={styles.editActions}>
              <AnimatedPressable
                style={styles.editBtnCancel}
                onPress={() => setEditingName(false)}
                haptic="light"
              >
                <Text style={styles.editBtnCancelText}>Cancelar</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={styles.editBtn}
                onPress={handleSaveName}
                haptic="medium"
              >
                <Text style={styles.editBtnText}>Guardar</Text>
              </AnimatedPressable>
            </View>
          </Animated.View>
        )}

        {/* Actions */}
        <AnimatedFadeIn delay={100}>
          <Text style={styles.cardTitle}>Acciones</Text>
          <View style={styles.card}>
            {isGroup && isAdmin && (
              <AnimatedPressable
                style={styles.actionRow}
                onPress={() => {
                  setNewName(conv?.name || "");
                  setEditingName(true);
                }}
                haptic="light"
              >
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: colors.primaryBg },
                  ]}
                >
                  <Ionicons name="pencil" size={18} color={colors.primary} />
                </View>
                <Text style={styles.actionText}>Editar nombre</Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textMuted}
                />
              </AnimatedPressable>
            )}

            <AnimatedPressable
              style={styles.actionRow}
              onPress={handleToggleMute}
              haptic="light"
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: `${colors.warning}15` },
                ]}
              >
                <Ionicons
                  name={conv?.muted ? "notifications" : "notifications-off"}
                  size={18}
                  color={colors.warning}
                />
              </View>
              <Text style={styles.actionText}>
                {conv?.muted ? "Activar notificaciones" : "Silenciar"}
              </Text>
            </AnimatedPressable>

            <AnimatedPressable
              style={[styles.actionRow, !isGroup && styles.actionRowLast]}
              onPress={handleToggleArchive}
              haptic="light"
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: `${colors.textMuted}15` },
                ]}
              >
                <Ionicons
                  name={conv?.isArchived ? "arrow-undo" : "archive"}
                  size={18}
                  color={colors.textMuted}
                />
              </View>
              <Text style={styles.actionText}>
                {conv?.isArchived ? "Desarchivar" : "Archivar"}
              </Text>
            </AnimatedPressable>

            {isGroup && (
              <AnimatedPressable
                style={[styles.actionRow, styles.actionRowLast]}
                onPress={() => handleRemoveMember(user!.id, user!.name)}
                haptic="light"
              >
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: `${colors.error}15` },
                  ]}
                >
                  <Ionicons
                    name="exit-outline"
                    size={18}
                    color={colors.error}
                  />
                </View>
                <Text style={[styles.actionText, { color: colors.error }]}>
                  Salir del grupo
                </Text>
              </AnimatedPressable>
            )}
          </View>
        </AnimatedFadeIn>

        {/* Members (group only) */}
        {isGroup && members && (
          <AnimatedFadeIn delay={200}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingRight: 16,
              }}
            >
              <Text style={styles.cardTitle}>
                Miembros ({members.length})
              </Text>
              {isAdmin && (
                <AnimatedPressable
                  onPress={() => setShowAddMember(true)}
                  haptic="light"
                >
                  <Ionicons
                    name="person-add"
                    size={20}
                    color={colors.primary}
                  />
                </AnimatedPressable>
              )}
            </View>
            <View style={styles.card}>
              {members.map((member, index) => (
                <View
                  key={member.userId}
                  style={[
                    styles.memberItem,
                    index === members.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <Avatar name={member.user.name} size="sm" />
                  <Text style={styles.memberName}>{member.user.name}</Text>
                  {member.role === "admin" && (
                    <Text style={styles.memberRole}>Admin</Text>
                  )}
                  {member.userId === user?.id && (
                    <Text
                      style={[
                        styles.memberRole,
                        {
                          backgroundColor: `${colors.success}15`,
                          color: colors.success,
                        },
                      ]}
                    >
                      Tú
                    </Text>
                  )}
                  {isAdmin &&
                    member.userId !== user?.id &&
                    member.role !== "admin" && (
                      <AnimatedPressable
                        style={styles.removeBtn}
                        onPress={() =>
                          handleRemoveMember(member.userId, member.user.name)
                        }
                        haptic="light"
                      >
                        <Text style={styles.removeBtnText}>Remover</Text>
                      </AnimatedPressable>
                    )}
                </View>
              ))}
            </View>
          </AnimatedFadeIn>
        )}

        {/* Direct chat participants */}
        {conv?.type === "DIRECT" && members && (
          <AnimatedFadeIn delay={200}>
            <Text style={styles.cardTitle}>Participantes</Text>
            <View style={styles.card}>
              {members.map((member, index) => (
                <View
                  key={member.userId}
                  style={[
                    styles.memberItem,
                    index === members.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <Avatar name={member.user.name} size="sm" />
                  <Text style={styles.memberName}>{member.user.name}</Text>
                  {member.userId === user?.id && (
                    <Text
                      style={[
                        styles.memberRole,
                        {
                          backgroundColor: `${colors.success}15`,
                          color: colors.success,
                        },
                      ]}
                    >
                      Tú
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </AnimatedFadeIn>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add member modal */}
      <Modal
        visible={showAddMember}
        animationType="slide"
        onRequestClose={() => setShowAddMember(false)}
      >
        <SafeAreaView style={styles.modalOverlay} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <AnimatedPressable
              onPress={() => {
                setShowAddMember(false);
                setAddSearch("");
              }}
              style={styles.backBtn}
              haptic="light"
            >
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </AnimatedPressable>
            <Text style={styles.modalTitle}>Agregar miembro</Text>
          </View>

          <TextInput
            style={styles.modalSearch}
            placeholder="Buscar por nombre o email..."
            placeholderTextColor={colors.textMuted}
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
                <View style={styles.userItem}>
                  <Avatar name={item.name} size="md" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userEmail}>{item.email}</Text>
                  </View>
                  {isMember ? (
                    <Text style={styles.alreadyMember}>Ya es miembro</Text>
                  ) : (
                    <AnimatedPressable
                      style={styles.addBtn}
                      onPress={() => handleAddMember(item.id)}
                      haptic="medium"
                    >
                      <Text style={styles.addBtnText}>Agregar</Text>
                    </AnimatedPressable>
                  )}
                </View>
              );
            }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={{ paddingTop: 40, alignItems: "center" }}>
                <Text style={{ color: colors.textMuted }}>
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
