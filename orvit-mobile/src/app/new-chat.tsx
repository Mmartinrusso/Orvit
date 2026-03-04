import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCreateStyles } from "@/hooks/useCreateStyles";
import { useHaptics } from "@/hooks/useHaptics";
import { getCompanyUsers, createConversation } from "@/api/chat";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import Avatar from "@/components/ui/Avatar";
import type { CompanyUser } from "@/types/chat";

export default function NewChatScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const haptics = useHaptics();
  const [search, setSearch] = useState("");
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<CompanyUser[]>([]);
  const [creating, setCreating] = useState(false);

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
    searchContainer: {
      marginHorizontal: s.lg,
      marginBottom: s.md,
    },
    searchInput: {
      backgroundColor: c.bgInput,
      borderRadius: r.md,
      paddingHorizontal: s.lg,
      paddingVertical: s.md,
      ...t.body,
      color: c.textPrimary,
      borderWidth: 1,
      borderColor: c.border,
    },
    modeToggle: {
      flexDirection: "row" as const,
      marginHorizontal: s.lg,
      marginBottom: s.md,
      backgroundColor: c.bgSecondary,
      borderRadius: r.md,
      padding: 3,
      borderWidth: 1,
      borderColor: c.border,
    },
    modeTab: {
      flex: 1,
      paddingVertical: s.sm + 2,
      borderRadius: r.sm + 2,
      alignItems: "center" as const,
    },
    modeTabActive: {
      backgroundColor: c.primary,
    },
    modeText: { ...t.caption, color: c.textSecondary },
    modeTextActive: { color: "#fff", fontWeight: "700" as const },
    groupNameContainer: {
      marginHorizontal: s.lg,
      marginBottom: s.md,
    },
    groupNameInput: {
      backgroundColor: c.bgInput,
      borderRadius: r.md,
      paddingHorizontal: s.lg,
      paddingVertical: s.md,
      ...t.body,
      color: c.textPrimary,
      borderWidth: 1,
      borderColor: c.primary,
    },
    selectedChips: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: s.sm,
      marginHorizontal: s.lg,
      marginBottom: s.md,
    },
    chip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: c.primaryBg,
      borderRadius: r.full,
      paddingLeft: 4,
      paddingRight: s.sm,
      paddingVertical: 4,
      gap: s.xs,
      borderWidth: 1,
      borderColor: c.primary,
    },
    chipName: { ...t.small, color: c.primary, fontWeight: "600" as const },
    userItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: s.lg,
      paddingVertical: s.md,
      gap: s.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    userInfo: { flex: 1 },
    userName: { ...t.bodyMedium, color: c.textPrimary },
    userEmail: { ...t.small, color: c.textMuted },
    selectedIndicator: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.primary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    unselectedIndicator: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: c.border,
    },
    createBtnContainer: {
      paddingHorizontal: s.lg,
      paddingVertical: s.md,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.bg,
    },
    createBtn: {
      backgroundColor: c.primary,
      borderRadius: r.md,
      paddingVertical: s.md + 2,
      alignItems: "center" as const,
      flexDirection: "row" as const,
      justifyContent: "center" as const,
      gap: s.sm,
    },
    createBtnDisabled: { opacity: 0.5 },
    createBtnText: { color: "#fff", ...t.bodyMedium },
    sectionLabel: {
      ...t.caption,
      color: c.textMuted,
      paddingHorizontal: s.lg,
      paddingVertical: s.sm,
      textTransform: "uppercase" as const,
      letterSpacing: 1,
    },
  }));

  const { data: users, isLoading } = useQuery({
    queryKey: ["company-users"],
    queryFn: getCompanyUsers,
  });

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users
      .filter((u) => u.id !== user?.id && u.isActive)
      .filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
      );
  }, [users, search, user?.id]);

  const toggleUser = useCallback(
    (u: CompanyUser) => {
      haptics.selection();
      setSelectedUsers((prev) =>
        prev.find((s) => s.id === u.id)
          ? prev.filter((s) => s.id !== u.id)
          : [...prev, u]
      );
    },
    [haptics]
  );

  const handleCreateDirect = useCallback(
    async (targetUser: CompanyUser) => {
      setCreating(true);
      try {
        const conv = await createConversation({
          type: "DIRECT",
          memberIds: [targetUser.id],
        });
        haptics.success();
        router.replace(`/chat/${conv.id}`);
      } catch {
        Alert.alert("Error", "No se pudo crear la conversación");
      } finally {
        setCreating(false);
      }
    },
    [haptics]
  );

  const handleCreateGroup = useCallback(async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    setCreating(true);
    try {
      const conv = await createConversation({
        type: "CHANNEL",
        name: groupName.trim(),
        memberIds: selectedUsers.map((u) => u.id),
      });
      haptics.success();
      router.replace(`/chat/${conv.id}`);
    } catch {
      Alert.alert("Error", "No se pudo crear el grupo");
    } finally {
      setCreating(false);
    }
  }, [groupName, selectedUsers, haptics]);

  const canCreate = isGroupMode && groupName.trim() && selectedUsers.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedPressable
          onPress={() => router.back()}
          style={styles.backBtn}
          haptic="light"
        >
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>
          {isGroupMode ? "Nuevo grupo" : "Nuevo chat"}
        </Text>
      </View>

      {/* Mode toggle */}
      <Animated.View entering={FadeInDown.delay(50).duration(250)} style={styles.modeToggle}>
        <AnimatedPressable
          style={[styles.modeTab, !isGroupMode && styles.modeTabActive]}
          onPress={() => {
            setIsGroupMode(false);
            setSelectedUsers([]);
          }}
          haptic="selection"
        >
          <Text style={[styles.modeText, !isGroupMode && styles.modeTextActive]}>
            Chat directo
          </Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={[styles.modeTab, isGroupMode && styles.modeTabActive]}
          onPress={() => setIsGroupMode(true)}
          haptic="selection"
        >
          <Text style={[styles.modeText, isGroupMode && styles.modeTextActive]}>
            Grupo
          </Text>
        </AnimatedPressable>
      </Animated.View>

      {/* Group name input */}
      {isGroupMode && (
        <Animated.View entering={FadeInDown.duration(200)} style={styles.groupNameContainer}>
          <TextInput
            style={styles.groupNameInput}
            placeholder="Nombre del grupo"
            placeholderTextColor={colors.textMuted}
            value={groupName}
            onChangeText={setGroupName}
          />
        </Animated.View>
      )}

      {/* Selected chips */}
      {isGroupMode && selectedUsers.length > 0 && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.selectedChips}>
          {selectedUsers.map((u) => (
            <AnimatedPressable
              key={u.id}
              style={styles.chip}
              onPress={() => toggleUser(u)}
              haptic="light"
            >
              <Avatar name={u.name} size="sm" />
              <Text style={styles.chipName}>{u.name.split(" ")[0]}</Text>
              <Ionicons name="close" size={14} color={colors.primary} />
            </AnimatedPressable>
          ))}
        </Animated.View>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre o email..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      <Text style={styles.sectionLabel}>
        {isGroupMode ? "Seleccionar miembros" : "Usuarios"}
      </Text>

      {/* User list */}
      {isLoading ? (
        <View style={{ paddingTop: 40, alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => {
            const isSelected = selectedUsers.some((s) => s.id === item.id);
            return (
              <Animated.View entering={FadeInDown.delay(index * 30).duration(200)}>
                <AnimatedPressable
                  style={styles.userItem}
                  onPress={() => {
                    if (isGroupMode) {
                      toggleUser(item);
                    } else {
                      handleCreateDirect(item);
                    }
                  }}
                  haptic="selection"
                  disabled={creating}
                >
                  <Avatar name={item.name} size="md" />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userEmail}>{item.email}</Text>
                  </View>
                  {isGroupMode && (
                    isSelected ? (
                      <View style={styles.selectedIndicator}>
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      </View>
                    ) : (
                      <View style={styles.unselectedIndicator} />
                    )
                  )}
                  {!isGroupMode && (
                    <Ionicons
                      name="chatbubble-outline"
                      size={20}
                      color={colors.textMuted}
                    />
                  )}
                </AnimatedPressable>
              </Animated.View>
            );
          }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={{ paddingTop: 40, alignItems: "center" }}>
              <Text style={{ color: colors.textMuted }}>
                {search ? "Sin resultados" : "No hay usuarios"}
              </Text>
            </View>
          }
        />
      )}

      {/* Create group button */}
      {isGroupMode && (
        <View style={styles.createBtnContainer}>
          <AnimatedPressable
            style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}
            onPress={handleCreateGroup}
            disabled={!canCreate || creating}
            haptic="medium"
          >
            {creating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="people" size={20} color="#fff" />
                <Text style={styles.createBtnText}>
                  Crear grupo
                  {selectedUsers.length > 0
                    ? ` (${selectedUsers.length})`
                    : ""}
                </Text>
              </>
            )}
          </AnimatedPressable>
        </View>
      )}
    </SafeAreaView>
  );
}
