import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Alert,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
  TouchableOpacity,
  Switch,
  ActionSheetIOS,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { fonts } from "@/lib/fonts";
import {
  getConversation,
  getMembers,
  updateConversation,
  addMembers,
  removeMember,
  updateMemberRole,
  getCompanyUsers,
} from "@/api/chat";
import Avatar from "@/components/ui/Avatar";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import type { Conversation, ConversationMember } from "@/types/chat";

export default function ChatInfoScreen() {
  const { colors, isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const haptics = useHaptics();
  const queryClient = useQueryClient();

  // ── m6 colors ──────────────────────────────────────────────
  const bg = isDark ? "#0A0A0A" : "#FFFFFF";
  const surface = isDark ? "#171717" : "#FAFAFA";
  const border = isDark ? "#262626" : "#E5E5E5";
  const text = isDark ? "#E5E5E5" : "#0A0A0A";
  const textMuted = isDark ? "#555555" : "#A3A3A3";
  const textDim = isDark ? "#404040" : "#737373";
  const sectionColor = isDark ? "#333333" : "#A3A3A3";
  const divider = isDark ? "#111111" : "#F0F0F0";
  const errorColor = "#EF4444";

  // ── State ──────────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [togglingAdminsOnly, setTogglingAdminsOnly] = useState(false);

  // ── Queries ────────────────────────────────────────────────
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
  const isOrvitBot = conv?.isSystemBot === true;
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
    if (isOrvitBot) return "Asistente de IA";
    if (conv?.type === "DIRECT") return "en linea";
    const count = members?.length ?? 0;
    return `${count} participante${count !== 1 ? "s" : ""}`;
  }, [conv?.type, members?.length, isOrvitBot]);

  // ── Handlers ───────────────────────────────────────────────
  const handleToggleMute = useCallback(() => {
    haptics.selection();
    Alert.alert("Proximamente", "Esta funcion estara disponible pronto");
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
          ? "La conversacion fue archivada"
          : "La conversacion fue restaurada"
      );
    } catch {
      Alert.alert("Error", "No se pudo actualizar la conversacion");
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

  const handleSaveDescription = useCallback(async () => {
    try {
      await updateConversation(id!, { description: newDescription.trim() });
      queryClient.invalidateQueries({ queryKey: ["conversation", id] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setEditingDescription(false);
      haptics.success();
    } catch {
      Alert.alert("Error", "No se pudo actualizar la descripcion");
    }
  }, [newDescription, id, queryClient, haptics]);

  const handleToggleAdminsOnly = useCallback(async (value: boolean) => {
    if (!conv) return;
    try {
      setTogglingAdminsOnly(true);
      await updateConversation(conv.id, { onlyAdminsPost: value });
      queryClient.invalidateQueries({ queryKey: ["conversation", id] });
      haptics.selection();
    } catch {
      Alert.alert("Error", "No se pudo actualizar la configuracion");
    } finally {
      setTogglingAdminsOnly(false);
    }
  }, [conv, id, queryClient, haptics]);

  const handleToggleRole = useCallback(
    (memberId: number, memberName: string, currentRole: string) => {
      const newRole = currentRole === "admin" ? "member" : "admin";
      const actionText = newRole === "admin" ? "hacer administrador" : "quitar como administrador";
      Alert.alert(
        "Cambiar rol",
        `Queres ${actionText} a ${memberName}?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Confirmar",
            onPress: async () => {
              try {
                await updateMemberRole(id!, memberId, newRole);
                refetchMembers();
                haptics.success();
              } catch {
                Alert.alert("Error", "No se pudo cambiar el rol");
              }
            },
          },
        ]
      );
    },
    [id, refetchMembers, haptics]
  );

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
          ? "Queres salir de este grupo?"
          : `Remover a ${memberName} del grupo?`,
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

  const handleMemberActions = useCallback(
    (memberId: number, memberName: string, currentRole: string) => {
      const isTargetAdmin = currentRole === "admin";
      const roleAction = isTargetAdmin ? "Quitar admin" : "Hacer admin";

      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ["Cancelar", roleAction, "Eliminar del grupo"],
            destructiveButtonIndex: 2,
            cancelButtonIndex: 0,
            title: memberName,
          },
          (buttonIndex) => {
            if (buttonIndex === 1) {
              handleToggleRole(memberId, memberName, currentRole);
            } else if (buttonIndex === 2) {
              handleRemoveMember(memberId, memberName);
            }
          }
        );
      } else {
        Alert.alert(memberName, "Elegi una accion", [
          { text: "Cancelar", style: "cancel" },
          {
            text: roleAction,
            onPress: () => handleToggleRole(memberId, memberName, currentRole),
          },
          {
            text: "Eliminar del grupo",
            style: "destructive",
            onPress: () => handleRemoveMember(memberId, memberName),
          },
        ]);
      }
    },
    [handleToggleRole, handleRemoveMember]
  );

  const handleDangerAction = useCallback(() => {
    if (isGroup) {
      handleRemoveMember(user!.id, user!.name);
    } else {
      Alert.alert(
        "Eliminar chat",
        "Estas seguro? Esta accion no se puede deshacer.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Eliminar", style: "destructive", onPress: () => {
            // TODO: implement delete
            Alert.alert("Proximamente", "Esta funcion estara disponible pronto");
          }},
        ]
      );
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

  // ── Quick action button ────────────────────────────────────
  function renderQuickAction(
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    onPress: () => void
  ) {
    return (
      <AnimatedPressable
        key={label}
        onPress={onPress}
        haptic="light"
        style={{ alignItems: "center", gap: 6 }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: surface,
            borderWidth: 1,
            borderColor: border,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons name={icon} size={20} color={text} />
        </View>
        <Text
          style={{
            fontSize: 11,
            fontFamily: fonts.regular,
            color: textMuted,
          }}
        >
          {label}
        </Text>
      </AnimatedPressable>
    );
  }

  // ── Menu item renderer (settings style) ────────────────────
  function renderMenuItem(
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    options?: {
      subtitle?: string;
      trailing?: React.ReactNode;
      onPress?: () => void;
      showDivider?: boolean;
      iconColor?: string;
      textColor?: string;
    }
  ) {
    const content = (
      <View
        style={{
          height: 52,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          gap: 14,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: options?.iconColor
              ? `${options.iconColor}15`
              : surface,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons
            name={icon}
            size={17}
            color={options?.iconColor || text}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 13,
              fontFamily: fonts.semiBold,
              color: options?.textColor || text,
            }}
          >
            {title}
          </Text>
          {options?.subtitle && (
            <Text
              style={{
                fontSize: 11,
                fontFamily: fonts.regular,
                color: textDim,
                marginTop: 1,
              }}
            >
              {options.subtitle}
            </Text>
          )}
        </View>
        {options?.trailing || (
          <Ionicons name="chevron-forward" size={16} color={textMuted} />
        )}
      </View>
    );

    const dividerView = options?.showDivider !== false ? (
      <View
        style={{
          height: 1,
          backgroundColor: divider,
          marginLeft: 66,
        }}
      />
    ) : null;

    if (options?.onPress) {
      return (
        <View key={title}>
          <AnimatedPressable onPress={options.onPress} haptic="light">
            {content}
          </AnimatedPressable>
          {dividerView}
        </View>
      );
    }

    return (
      <View key={title}>
        {content}
        {dividerView}
      </View>
    );
  }

  // ── Section header ─────────────────────────────────────────
  function renderSectionHeader(label: string) {
    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 }}>
        <Text
          style={{
            fontSize: 9,
            fontFamily: fonts.bold,
            fontWeight: "700",
            letterSpacing: 0.72,
            textTransform: "uppercase",
            color: sectionColor,
          }}
        >
          {label}
        </Text>
      </View>
    );
  }

  // ── Loading ────────────────────────────────────────────────
  if (!conv) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={["top"]}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            height: 48,
            gap: 12,
          }}
        >
          <AnimatedPressable onPress={() => router.back()} haptic="light">
            <Ionicons name="arrow-back" size={22} color={text} />
          </AnimatedPressable>
          <Text
            style={{
              fontSize: 16,
              fontFamily: fonts.semiBold,
              color: text,
            }}
          >
            Info
          </Text>
        </View>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: fonts.regular,
              color: textMuted,
            }}
          >
            Cargando...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Build quick actions based on type ──────────────────────
  const quickActions: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
  }[] = [];

  if (isOrvitBot) {
    quickActions.push(
      { icon: "search-outline", label: "Buscar", onPress: () => Alert.alert("Proximamente", "Busqueda dentro del chat") },
      { icon: "notifications-off-outline", label: conv?.muted ? "Activar" : "Silenciar", onPress: handleToggleMute },
      { icon: "help-circle-outline", label: "Ayuda", onPress: () => Alert.alert("Orvit AI", "Podes mandarme:\n\nAudios para crear fallas, tareas o consultas\nTexto con instrucciones\nPedidos de reportes y resumenes") },
    );
  } else if (isGroup) {
    if (isAdmin) {
      quickActions.push({
        icon: "person-add-outline",
        label: "Agregar",
        onPress: () => setShowAddMember(true),
      });
    }
    quickActions.push(
      { icon: "search-outline", label: "Buscar", onPress: () => Alert.alert("Proximamente", "Busqueda dentro del chat") },
      { icon: "notifications-off-outline", label: conv?.muted ? "Activar" : "Silenciar", onPress: handleToggleMute },
    );
  } else {
    // Direct chat — only search + mute (no calls)
    quickActions.push(
      { icon: "search-outline", label: "Buscar", onPress: () => Alert.alert("Proximamente", "Busqueda dentro del chat") },
      { icon: "notifications-off-outline", label: conv?.muted ? "Activar" : "Silenciar", onPress: handleToggleMute },
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={["top"]}>
      {/* ── Header ─────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          height: 48,
          gap: 12,
        }}
      >
        <AnimatedPressable onPress={() => router.back()} haptic="light">
          <Ionicons name="arrow-back" size={22} color={text} />
        </AnimatedPressable>
        <Text
          style={{
            fontSize: 16,
            fontFamily: fonts.semiBold,
            color: text,
          }}
        >
          Info
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile section ──────────────────────────────── */}
        <View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
          {isOrvitBot ? (
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: text,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="sparkles" size={36} color={bg} />
            </View>
          ) : isGroup ? (
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: surface,
                borderWidth: 1,
                borderColor: border,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="people" size={36} color={text} />
            </View>
          ) : (
            <Avatar name={displayName} size="xl" />
          )}
          <Text
            style={{
              fontSize: 20,
              fontFamily: fonts.bold,
              fontWeight: "700",
              letterSpacing: -0.3,
              color: text,
              textAlign: "center",
              paddingHorizontal: 20,
              marginTop: 4,
            }}
          >
            {displayName}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontFamily: fonts.regular,
              color: textMuted,
            }}
          >
            {subtitle}
          </Text>
        </View>

        {/* ── Quick actions ────────────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: 28,
            paddingVertical: 4,
            paddingHorizontal: 16,
          }}
        >
          {quickActions.map((a) => renderQuickAction(a.icon, a.label, a.onPress))}
        </View>

        {/* ── Divider ──────────────────────────────────────── */}
        <View
          style={{
            height: 1,
            backgroundColor: divider,
            marginHorizontal: 20,
            marginTop: 20,
          }}
        />

        {/* ── Edit name (inline — group admin only) ────────── */}
        {editingName && (
          <Animated.View entering={FadeInDown.duration(200)}>
            <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
              <TextInput
                style={{
                  backgroundColor: surface,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: border,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 14,
                  fontFamily: fonts.regular,
                  color: text,
                }}
                value={newName}
                onChangeText={setNewName}
                placeholder="Nombre del grupo"
                placeholderTextColor={textMuted}
                autoFocus
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 10,
                }}
              >
                <AnimatedPressable
                  onPress={() => setEditingName(false)}
                  haptic="light"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: surface,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: fonts.semiBold,
                      color: textMuted,
                    }}
                  >
                    Cancelar
                  </Text>
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={handleSaveName}
                  haptic="medium"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: text,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: fonts.semiBold,
                      color: bg,
                    }}
                  >
                    Guardar
                  </Text>
                </AnimatedPressable>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Description edit (inline) ────────────────────── */}
        {editingDescription && (
          <Animated.View entering={FadeInDown.duration(200)}>
            <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
              <TextInput
                style={{
                  backgroundColor: surface,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: border,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 14,
                  fontFamily: fonts.regular,
                  color: text,
                  minHeight: 60,
                  textAlignVertical: "top",
                }}
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder="Descripcion del grupo"
                placeholderTextColor={textMuted}
                multiline
                autoFocus
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 10,
                }}
              >
                <AnimatedPressable
                  onPress={() => setEditingDescription(false)}
                  haptic="light"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: surface,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: fonts.semiBold,
                      color: textMuted,
                    }}
                  >
                    Cancelar
                  </Text>
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={handleSaveDescription}
                  haptic="medium"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: text,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: fonts.semiBold,
                      color: bg,
                    }}
                  >
                    Guardar
                  </Text>
                </AnimatedPressable>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Description (read only) ──────────────────────── */}
        {!editingDescription && (isGroup || isOrvitBot) && conv.description ? (
          <AnimatedPressable
            onPress={
              isAdmin && isGroup
                ? () => {
                    setNewDescription(conv.description || "");
                    setEditingDescription(true);
                  }
                : undefined
            }
            haptic="light"
            disabled={!isAdmin || !isGroup}
          >
            <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: fonts.regular,
                  color: textDim,
                  lineHeight: 19,
                }}
              >
                {conv.description}
              </Text>
            </View>
          </AnimatedPressable>
        ) : null}

        {/* ── Group settings section ───────────────────────── */}
        {isGroup && isAdmin && !editingName && !editingDescription && (
          <>
            {renderSectionHeader("AJUSTES")}
            {renderMenuItem("pencil-outline", "Editar nombre", {
              onPress: () => {
                setNewName(conv?.name || "");
                setEditingName(true);
              },
            })}
            {!conv.description
              ? renderMenuItem("document-text-outline", "Agregar descripcion", {
                  onPress: () => {
                    setNewDescription("");
                    setEditingDescription(true);
                  },
                })
              : renderMenuItem("document-text-outline", "Editar descripcion", {
                  onPress: () => {
                    setNewDescription(conv.description || "");
                    setEditingDescription(true);
                  },
                })}
            {renderMenuItem("shield-checkmark-outline", "Solo admins escriben", {
              subtitle: conv?.onlyAdminsPost
                ? "Solo administradores"
                : "Todos los miembros",
              trailing: (
                <Switch
                  value={conv?.onlyAdminsPost ?? false}
                  onValueChange={handleToggleAdminsOnly}
                  disabled={togglingAdminsOnly}
                  trackColor={{ false: "#333333", true: "#FFFFFF" }}
                  thumbColor={isDark ? "#0A0A0A" : "#FFFFFF"}
                  ios_backgroundColor="#333333"
                  style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                />
              ),
              showDivider: false,
            })}
          </>
        )}

        {/* ── Media ────────────────────────────────────────── */}
        {renderSectionHeader("ARCHIVOS")}
        {renderMenuItem("image-outline", "Archivos, enlaces y documentos", {
          onPress: () =>
            Alert.alert("Proximamente", "Archivos multimedia"),
          showDivider: false,
        })}

        {/* ── Parent group ─────────────────────────────────── */}
        {conv.parent && (
          <>
            {renderSectionHeader("GRUPO PADRE")}
            {renderMenuItem("people-outline", conv.parent.name || "Sin nombre", {
              onPress: () => router.push(`/chat/${conv.parent!.id}`),
              showDivider: false,
            })}
          </>
        )}

        {/* ── Participants ─────────────────────────────────── */}
        {members && members.length > 0 && (
          <>
            {renderSectionHeader(
              `PARTICIPANTES${isGroup ? ` (${members.length})` : ""}`
            )}

            {/* Add member row — admin only */}
            {isGroup && isAdmin && (
              <AnimatedPressable
                onPress={() => setShowAddMember(true)}
                haptic="light"
              >
                <View
                  style={{
                    height: 52,
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    gap: 14,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: surface,
                      borderWidth: 1,
                      borderColor: border,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons name="person-add-outline" size={16} color={text} />
                  </View>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: fonts.semiBold,
                      color: text,
                    }}
                  >
                    Agregar miembro
                  </Text>
                </View>
              </AnimatedPressable>
            )}

            {members.map((member, index) => (
              <View
                key={member.userId}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  height: 56,
                  gap: 14,
                }}
              >
                <Avatar name={member.user?.name || "?"} size="sm" />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: fonts.semiBold,
                      color: text,
                    }}
                  >
                    {member.user?.name || "Usuario"}
                  </Text>
                  {member.role === "admin" && (
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: fonts.regular,
                        color: textDim,
                        marginTop: 1,
                      }}
                    >
                      Administrador
                    </Text>
                  )}
                </View>
                {member.userId === user?.id ? (
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                      backgroundColor: isDark ? "#1a2a1a" : "#f0fdf4",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: fonts.semiBold,
                        color: "#22c55e",
                      }}
                    >
                      Tu
                    </Text>
                  </View>
                ) : isAdmin ? (
                  <AnimatedPressable
                    onPress={() =>
                      handleMemberActions(
                        member.userId,
                        member.user?.name || "",
                        member.role
                      )
                    }
                    haptic="light"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name="ellipsis-vertical"
                      size={16}
                      color={textMuted}
                    />
                  </AnimatedPressable>
                ) : null}
                {index < members.length - 1 && (
                  <View
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 70,
                      right: 20,
                      height: 1,
                      backgroundColor: divider,
                    }}
                  />
                )}
              </View>
            ))}
          </>
        )}

        {/* ── Subgroups ────────────────────────────────────── */}
        {isGroup && conv.type === "CHANNEL" && (conv.depth ?? 0) < 4 && (
          <>
            {renderSectionHeader(
              `SUBGRUPOS${conv.children?.length ? ` (${conv.children.length})` : ""}`
            )}

            {(!conv.children || conv.children.length === 0) ? (
              <View
                style={{
                  alignItems: "center",
                  paddingVertical: 20,
                  gap: 6,
                }}
              >
                <Ionicons
                  name="folder-open-outline"
                  size={24}
                  color={textMuted}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: fonts.regular,
                    color: textMuted,
                  }}
                >
                  No hay subgrupos
                </Text>
              </View>
            ) : (
              conv.children.map((child, index) => (
                <AnimatedPressable
                  key={child.id}
                  onPress={() => router.push(`/chat/${child.id}`)}
                  haptic="light"
                >
                  <View
                    style={{
                      height: 52,
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 20,
                      gap: 14,
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: surface,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Ionicons name="people-outline" size={16} color={text} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: fonts.semiBold,
                          color: text,
                        }}
                      >
                        {child.name || "Sin nombre"}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: fonts.regular,
                          color: textDim,
                          marginTop: 1,
                        }}
                      >
                        {child.memberCount} miembro
                        {child.memberCount !== 1 ? "s" : ""}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={textMuted}
                    />
                  </View>
                  {index < (conv.children?.length ?? 0) - 1 && (
                    <View
                      style={{
                        height: 1,
                        backgroundColor: divider,
                        marginLeft: 66,
                      }}
                    />
                  )}
                </AnimatedPressable>
              ))
            )}

            {isAdmin && (
              <AnimatedPressable
                onPress={() => router.push(`/new-chat?parentId=${conv.id}`)}
                haptic="light"
              >
                <View
                  style={{
                    height: 52,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 20,
                    gap: 8,
                  }}
                >
                  <Ionicons name="add-outline" size={18} color={text} />
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: fonts.semiBold,
                      color: text,
                    }}
                  >
                    Crear subgrupo
                  </Text>
                </View>
              </AnimatedPressable>
            )}
          </>
        )}

        {/* ── Danger zone ──────────────────────────────────── */}
        <View style={{ marginTop: 24 }}>
          <View
            style={{
              height: 1,
              backgroundColor: divider,
              marginHorizontal: 20,
            }}
          />
          <AnimatedPressable onPress={handleDangerAction} haptic="medium">
            <View
              style={{
                height: 56,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 20,
                gap: 8,
              }}
            >
              <Ionicons
                name={isGroup ? "exit-outline" : "trash-outline"}
                size={17}
                color={errorColor}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: fonts.semiBold,
                  color: errorColor,
                }}
              >
                {isGroup ? "Salir del grupo" : "Eliminar chat"}
              </Text>
            </View>
          </AnimatedPressable>
        </View>

        {/* ── Footer ───────────────────────────────────────── */}
        <View style={{ alignItems: "center", paddingTop: 16 }}>
          <Text
            style={{
              fontSize: 11,
              fontFamily: fonts.regular,
              color: isDark ? "#262626" : "#A3A3A3",
            }}
          >
            m6 Chat v1.0.0
          </Text>
        </View>
      </ScrollView>

      {/* ── Add member modal ───────────────────────────────── */}
      <Modal
        visible={showAddMember}
        animationType="slide"
        onRequestClose={() => setShowAddMember(false)}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: bg }}
          edges={["top", "bottom"]}
        >
          {/* Modal header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              height: 48,
              gap: 12,
              borderBottomWidth: 1,
              borderBottomColor: divider,
            }}
          >
            <AnimatedPressable
              onPress={() => {
                setShowAddMember(false);
                setAddSearch("");
              }}
              haptic="light"
            >
              <Ionicons name="arrow-back" size={22} color={text} />
            </AnimatedPressable>
            <Text
              style={{
                fontSize: 16,
                fontFamily: fonts.semiBold,
                color: text,
                flex: 1,
              }}
            >
              Agregar miembro
            </Text>
          </View>

          {/* Search */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <TextInput
              style={{
                backgroundColor: surface,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: border,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 13,
                fontFamily: fonts.regular,
                color: text,
              }}
              placeholder="Buscar por nombre o email..."
              placeholderTextColor={textMuted}
              value={addSearch}
              onChangeText={setAddSearch}
              autoCapitalize="none"
            />
          </View>

          <FlatList
            data={availableUsers}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => {
              const isMember = memberIds.includes(item.id);
              return (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    height: 56,
                    gap: 14,
                  }}
                >
                  <Avatar name={item.name} size="sm" />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: fonts.semiBold,
                        color: text,
                      }}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: fonts.regular,
                        color: textDim,
                        marginTop: 1,
                      }}
                    >
                      {item.email}
                    </Text>
                  </View>
                  {isMember ? (
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: fonts.regular,
                        color: textMuted,
                      }}
                    >
                      Ya es miembro
                    </Text>
                  ) : (
                    <AnimatedPressable
                      onPress={() => handleAddMember(item.id)}
                      haptic="medium"
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: text,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: fonts.semiBold,
                          color: bg,
                        }}
                      >
                        Agregar
                      </Text>
                    </AnimatedPressable>
                  )}
                </View>
              );
            }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingTop: 40,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: fonts.regular,
                    color: textMuted,
                  }}
                >
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
