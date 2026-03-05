import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  SectionList,
  Alert,
  ActivityIndicator,
  ScrollView,
  Switch,
  ActionSheetIOS,
  Platform,
  Image,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  ZoomIn,
  ZoomOut,
  LinearTransition,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCreateStyles } from "@/hooks/useCreateStyles";
import { useHaptics } from "@/hooks/useHaptics";
import {
  getCompanyUsers,
  createConversation,
  getConversationAncestors,
  uploadChatFile,
} from "@/api/chat";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import Avatar from "@/components/ui/Avatar";
import type { CompanyUser } from "@/types/chat";


const GROUP_ICONS: { name: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { name: "people", icon: "people" },
  { name: "briefcase", icon: "briefcase" },
  { name: "construct", icon: "construct" },
  { name: "cog", icon: "cog" },
  { name: "megaphone", icon: "megaphone" },
  { name: "chatbubbles", icon: "chatbubbles" },
  { name: "flag", icon: "flag" },
  { name: "star", icon: "star" },
  { name: "shield", icon: "shield" },
  { name: "rocket", icon: "rocket" },
  { name: "heart", icon: "heart" },
  { name: "flash", icon: "flash" },
];

export default function NewChatScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const params = useLocalSearchParams<{ parentId?: string }>();
  const parentId = params.parentId || undefined;

  const [search, setSearch] = useState("");
  const [isGroupMode, setIsGroupMode] = useState(!!parentId);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [selectedUsers, setSelectedUsers] = useState<CompanyUser[]>([]);
  const [creating, setCreating] = useState(false);

  // Step 2 fields
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedIcon, setSelectedIcon] = useState<string>("people");
  const [onlyAdminsPost, setOnlyAdminsPost] = useState(false);
  const [muteGroup, setMuteGroup] = useState(false);
  const [onlyAdminsAddMembers, setOnlyAdminsAddMembers] = useState(false);

  // Avatar: icon or image
  const [groupAvatar, setGroupAvatar] = useState<
    { type: "icon"; icon: string } | { type: "image"; uri: string }
  >({ type: "icon", icon: "people" });
  const [showIconPicker, setShowIconPicker] = useState(false);

  const styles = useCreateStyles((c, t, s, r) => ({
    container: {
      flex: 1,
      backgroundColor: c.bg,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      overflow: "hidden" as const,
    },

    // ── Header (WhatsApp style: Cancel — Title — Action) ──
    header: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10,
    },
    headerLeft: {
      minWidth: 70,
    },
    cancelText: {
      fontSize: 15,
      color: c.primary,
      fontWeight: "400" as const,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: c.textPrimary,
      textAlign: "center" as const,
    },
    headerRight: {
      minWidth: 70,
      alignItems: "flex-end" as const,
    },
    headerAction: {
      fontSize: 15,
      color: c.primary,
      fontWeight: "600" as const,
    },
    headerActionDisabled: {
      opacity: 0.35,
    },
    headerSeparator: {
      height: 0.5,
      backgroundColor: c.border,
    },

    headerSubtitle: {
      fontSize: 12,
      color: c.textMuted,
      textAlign: "center" as const,
      marginTop: 1,
    },

    // ── Mode toggle (compact, pill style) ──
    modeToggle: {
      flexDirection: "row" as const,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
      gap: 8,
    },
    modeTab: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: c.bgTertiary,
    },
    modeTabActive: {
      backgroundColor: c.primary,
    },
    modeText: { fontSize: 13, color: c.textMuted, fontWeight: "500" as const },
    modeTextActive: { color: "#fff", fontWeight: "600" as const },

    // ── Search (compact, matching inbox style) ──
    searchContainer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 6,
    },
    searchRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: c.bgTertiary,
      borderRadius: 10,
      paddingHorizontal: 10,
      height: 34,
      gap: s.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: c.textPrimary,
    },

    // ── Selected chips (WhatsApp vertical style) ──
    selectedChipsScroll: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    chip: {
      alignItems: "center" as const,
      width: 58,
    },
    chipAvatarWrap: {
      position: "relative" as const,
      marginBottom: 3,
    },
    chipRemove: {
      position: "absolute" as const,
      top: -3,
      right: -3,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: c.textMuted,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      zIndex: 1,
    },
    chipName: {
      fontSize: 11,
      color: c.textSecondary,
      textAlign: "center" as const,
      lineHeight: 13,
      maxWidth: 56,
    },

    // ── Section headers ──
    letterHeader: {
      fontSize: 14,
      color: c.textMuted,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 6,
      fontWeight: "500" as const,
      backgroundColor: c.bg,
    },

    // ── User list ──
    userItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: 16,
      paddingVertical: 7,
      gap: 10,
    },
    userItemDivider: {
      height: 0.5,
      backgroundColor: c.border,
      marginLeft: 58,
    },
    userInfo: { flex: 1 },
    userName: { fontSize: 15, color: c.textPrimary, fontWeight: "500" as const },
    userEmail: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    selectedIndicator: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.primary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    unselectedIndicator: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    // ── Bottom action (step 2 only) ──
    bottomBar: {
      paddingHorizontal: s.xl,
      paddingTop: s.md,
      paddingBottom: s.md,
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      backgroundColor: c.bg,
    },
    actionBtn: {
      backgroundColor: c.primary,
      borderRadius: r.lg,
      paddingVertical: s.lg,
      alignItems: "center" as const,
      flexDirection: "row" as const,
      justifyContent: "center" as const,
      gap: s.sm,
    },
    actionBtnDisabled: { opacity: 0.4 },
    actionBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600" as const,
    },

    // ── Empty state ──
    emptyContainer: {
      alignItems: "center" as const,
      paddingTop: 80,
      paddingHorizontal: s.xxxl,
    },
    emptyIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: c.bgTertiary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginBottom: s.lg,
    },
    emptyTitle: {
      ...t.subheading,
      color: c.textPrimary,
      marginBottom: s.xs,
    },
    emptySubtitle: {
      ...t.body,
      color: c.textMuted,
      textAlign: "center" as const,
    },

    // ── Step 2 styles ──
    detailsContainer: {
      flex: 1,
    },
    detailsScroll: {
      paddingHorizontal: s.xl,
    },
    groupAvatarPreview: {
      alignItems: "center" as const,
      paddingVertical: s.xxl,
    },
    groupAvatarCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: c.primary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginBottom: s.md,
    },
    groupAvatarHint: {
      ...t.small,
      color: c.textMuted,
    },
    inputLabel: {
      ...t.small,
      color: c.textMuted,
      marginBottom: s.xs + 2,
      marginTop: s.xl,
      textTransform: "uppercase" as const,
      letterSpacing: 0.8,
      fontWeight: "600" as const,
    },
    textInput: {
      backgroundColor: c.bgTertiary,
      borderRadius: r.lg,
      paddingHorizontal: s.lg,
      paddingVertical: s.md + 2,
      ...t.body,
      color: c.textPrimary,
    },
    textInputFocused: {
      borderWidth: 1.5,
      borderColor: c.primary,
    },
    descriptionInput: {
      minHeight: 88,
      textAlignVertical: "top" as const,
      paddingTop: s.md,
    },
    iconPickerContainer: {
      marginTop: s.xs,
    },
    iconPicker: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: s.sm + 2,
    },
    iconOption: {
      width: 48,
      height: 48,
      borderRadius: r.md,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      backgroundColor: c.bgTertiary,
    },
    iconOptionSelected: {
      backgroundColor: c.primaryBg,
      borderWidth: 2,
      borderColor: c.primary,
    },
    settingsCard: {
      marginTop: s.xl,
      backgroundColor: c.bgSecondary,
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.border,
      overflow: "hidden" as const,
    },
    toggleRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      paddingHorizontal: s.lg,
      paddingVertical: s.lg,
    },
    toggleLabel: { ...t.bodyMedium, color: c.textPrimary, flex: 1 },
    toggleSublabel: { ...t.small, color: c.textMuted, marginTop: 2 },
    membersPreview: {
      marginTop: s.xl,
    },
    membersRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: -8,
    },
    memberAvatarWrap: {
      borderWidth: 2,
      borderColor: c.bg,
      borderRadius: 18,
    },
    membersOverflow: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.bgTertiary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      borderWidth: 2,
      borderColor: c.bg,
    },
    membersOverflowText: {
      ...t.tiny,
      color: c.textMuted,
      fontWeight: "600" as const,
    },
    memberListItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingVertical: s.sm + 2,
      gap: s.md,
    },
    memberListInfo: {
      flex: 1,
    },
    memberListName: {
      ...t.bodyMedium,
      color: c.textPrimary,
    },
    memberListEmail: {
      ...t.small,
      color: c.textMuted,
      marginTop: 1,
    },
    memberRemoveBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.bgTertiary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    settingsSeparator: {
      height: 0.5,
      backgroundColor: c.border,
      marginLeft: s.lg,
    },
    avatarImage: {
      width: 88,
      height: 88,
      borderRadius: 44,
    },
    avatarCameraBadge: {
      position: "absolute" as const,
      bottom: 0,
      right: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.primary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      borderWidth: 2,
      borderColor: c.bg,
    },

    // ── Breadcrumb ──
    breadcrumb: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      flexWrap: "wrap" as const,
      marginHorizontal: s.xl,
      marginBottom: s.md,
      paddingVertical: s.sm + 2,
      paddingHorizontal: s.md,
      backgroundColor: c.bgTertiary,
      borderRadius: r.md,
      gap: 4,
    },
    breadcrumbText: { ...t.small, color: c.textSecondary },
    breadcrumbCurrent: { ...t.small, color: c.primary, fontWeight: "600" as const },
  }));

  const hasAuth = !!user;
  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: ["company-users"],
    queryFn: getCompanyUsers,
    enabled: hasAuth,
    retry: 2,
  });

  const showLoading = isLoading && hasAuth;

  const { data: ancestorsData } = useQuery({
    queryKey: ["conversation-ancestors", parentId],
    queryFn: () => getConversationAncestors(parentId!),
    enabled: !!parentId,
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

  // Build sections: alphabetical only (selected users shown as chips above, not duplicated)
  const sections = useMemo(() => {
    const result: { title: string; type: "letter"; data: CompanyUser[] }[] = [];

    const sorted = [...filteredUsers].sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" })
    );

    const letterMap = new Map<string, CompanyUser[]>();
    for (const u of sorted) {
      const letter = u.name.charAt(0).toUpperCase();
      if (!letterMap.has(letter)) letterMap.set(letter, []);
      letterMap.get(letter)!.push(u);
    }

    for (const [letter, letterUsers] of letterMap) {
      result.push({ title: letter, type: "letter", data: letterUsers });
    }

    return result;
  }, [filteredUsers]);

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

  const pickImageFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setGroupAvatar({ type: "image", uri: result.assets[0].uri });
      setShowIconPicker(false);
    }
  }, []);

  const pickImageFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Se necesita acceso a la cámara para tomar fotos");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setGroupAvatar({ type: "image", uri: result.assets[0].uri });
      setShowIconPicker(false);
    }
  }, []);

  const handleAvatarPress = useCallback(() => {
    haptics.selection();
    const options = ["Elegir foto", "Sacar foto", "Elegir ícono", "Cancelar"];
    const cancelButtonIndex = 3;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex },
        (idx) => {
          if (idx === 0) pickImageFromLibrary();
          else if (idx === 1) pickImageFromCamera();
          else if (idx === 2) setShowIconPicker(true);
        }
      );
    } else {
      // Android fallback using Alert
      Alert.alert("Avatar del grupo", "Elige una opción", [
        { text: "Elegir foto", onPress: pickImageFromLibrary },
        { text: "Sacar foto", onPress: pickImageFromCamera },
        { text: "Elegir ícono", onPress: () => setShowIconPicker(true) },
        { text: "Cancelar", style: "cancel" },
      ]);
    }
  }, [haptics, pickImageFromLibrary, pickImageFromCamera]);

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
      let avatarUrl: string | undefined;

      // Upload image if selected
      if (groupAvatar.type === "image") {
        try {
          const upload = await uploadChatFile(groupAvatar.uri, "group-avatar.jpg", "image/jpeg");
          avatarUrl = upload.url;
        } catch {
          Alert.alert("Error", "No se pudo subir la imagen del grupo");
          setCreating(false);
          return;
        }
      }

      const conv = await createConversation({
        type: "CHANNEL",
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
        memberIds: selectedUsers.map((u) => u.id),
        parentId,
        iconName: groupAvatar.type === "icon" ? groupAvatar.icon : selectedIcon,
        avatarUrl,
        onlyAdminsPost,
      });
      haptics.success();
      router.replace(`/chat/${conv.id}`);
    } catch {
      Alert.alert("Error", "No se pudo crear el grupo");
    } finally {
      setCreating(false);
    }
  }, [groupName, groupDescription, selectedUsers, parentId, selectedIcon, onlyAdminsPost, groupAvatar, haptics]);

  const handleNextStep = useCallback(() => {
    haptics.selection();
    setWizardStep(2);
  }, [haptics]);

  const handleBackStep = useCallback(() => {
    haptics.selection();
    setWizardStep(1);
  }, [haptics]);

  const canProceedToStep2 = isGroupMode && selectedUsers.length > 0;
  const canCreate = isGroupMode && groupName.trim() && selectedUsers.length > 0;

  const headerTitle = useMemo(() => {
    if (!isGroupMode) return "Nuevo chat";
    if (parentId) return wizardStep === 1 ? "Nuevo subgrupo" : "Detalles";
    return wizardStep === 1 ? "Nuevo grupo" : "Detalles";
  }, [isGroupMode, parentId, wizardStep]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* ── Header (WhatsApp style) ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <AnimatedPressable
            onPress={() => {
              if (isGroupMode && wizardStep === 2) {
                handleBackStep();
              } else {
                router.back();
              }
            }}
            haptic="light"
          >
            <Text style={styles.cancelText}>
              {isGroupMode && wizardStep === 2 ? "Atrás" : "Cancelar"}
            </Text>
          </AnimatedPressable>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          {isGroupMode && wizardStep === 1 && (
            <Text style={styles.headerSubtitle}>
              {selectedUsers.length > 0
                ? `${selectedUsers.length} seleccionado${selectedUsers.length !== 1 ? "s" : ""}`
                : "Agregar miembros"}
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          {isGroupMode && wizardStep === 1 && (
            <AnimatedPressable
              onPress={handleNextStep}
              disabled={!canProceedToStep2}
              haptic="medium"
            >
              <Text style={[styles.headerAction, !canProceedToStep2 && styles.headerActionDisabled]}>
                Siguiente
              </Text>
            </AnimatedPressable>
          )}
          {isGroupMode && wizardStep === 2 && (
            <AnimatedPressable
              onPress={handleCreateGroup}
              disabled={!canCreate || creating}
              haptic="medium"
            >
              {creating ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={[styles.headerAction, !canCreate && styles.headerActionDisabled]}>
                  Crear
                </Text>
              )}
            </AnimatedPressable>
          )}
        </View>
      </View>
      <View style={styles.headerSeparator} />

      {/* ── Breadcrumb for subgroups ── */}
      {parentId && ancestorsData?.ancestors && ancestorsData.ancestors.length > 0 && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.breadcrumb}>
          {ancestorsData.ancestors.map((a, i) => (
            <View key={a.id} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {i > 0 && (
                <Ionicons name="chevron-forward" size={11} color={colors.textMuted} />
              )}
              <Text style={i === ancestorsData.ancestors.length - 1 ? styles.breadcrumbCurrent : styles.breadcrumbText}>
                {a.name || "Sin nombre"}
              </Text>
            </View>
          ))}
          <Ionicons name="chevron-forward" size={11} color={colors.textMuted} />
          <Text style={styles.breadcrumbCurrent}>Nuevo</Text>
        </Animated.View>
      )}

      {/* ── Mode toggle ── */}
      {!parentId && wizardStep === 1 && (
        <Animated.View entering={FadeInDown.delay(50).duration(250)} style={styles.modeToggle}>
          <AnimatedPressable
            style={[styles.modeTab, !isGroupMode && styles.modeTabActive]}
            onPress={() => {
              setIsGroupMode(false);
              setSelectedUsers([]);
              setWizardStep(1);
            }}
            haptic="selection"
          >
            <Text style={[styles.modeText, !isGroupMode && styles.modeTextActive]}>
              Directo
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
      )}

      {/* ====== STEP 1: Select members ====== */}
      {wizardStep === 1 && (
        <>
          {/* Search */}
          <View style={styles.searchContainer}>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={15} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nombre o email..."
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

          {/* Selected chips — WhatsApp vertical style */}
          {isGroupMode && selectedUsers.length > 0 && (
            <Animated.View
              entering={FadeIn.duration(150)}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.selectedChipsScroll}
                keyboardShouldPersistTaps="handled"
              >
                {selectedUsers.map((u) => (
                  <Animated.View
                    key={u.id}
                    entering={ZoomIn.duration(200)}
                    exiting={ZoomOut.duration(150)}
                    layout={LinearTransition.duration(200)}
                  >
                    <AnimatedPressable
                      style={styles.chip}
                      onPress={() => toggleUser(u)}
                      haptic="light"
                    >
                      <View style={styles.chipAvatarWrap}>
                        <Avatar name={u.name} size="sm" />
                        <View style={styles.chipRemove}>
                          <Ionicons name="close" size={10} color="#fff" />
                        </View>
                      </View>
                      <Text style={styles.chipName} numberOfLines={2}>
                        {u.name.split(" ").slice(0, 2).join("\n")}
                      </Text>
                    </AnimatedPressable>
                  </Animated.View>
                ))}
              </ScrollView>
            </Animated.View>
          )}

          {/* User list with sections */}
          {showLoading ? (
            <View style={{ paddingTop: 60, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section }) => (
                <Text style={styles.letterHeader}>
                  {section.title}
                </Text>
              )}
              ItemSeparatorComponent={() => (
                <View style={styles.userItemDivider} />
              )}
              renderItem={({ item }) => {
                const isSelected = selectedUsers.some(
                  (s) => s.id === item.id
                );
                return (
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
                    <Avatar name={item.name} size="sm" />
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{item.name}</Text>
                      <Text style={styles.userEmail}>{item.email}</Text>
                    </View>
                    {isGroupMode &&
                      (isSelected ? (
                        <Animated.View
                          entering={ZoomIn.duration(150)}
                          style={styles.selectedIndicator}
                        >
                          <Ionicons
                            name="checkmark"
                            size={14}
                            color="#fff"
                          />
                        </Animated.View>
                      ) : (
                        <View style={styles.unselectedIndicator} />
                      ))}
                  </AnimatedPressable>
                );
              }}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1 }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons
                      name={search ? "search" : "people-outline"}
                      size={32}
                      color={colors.textMuted}
                    />
                  </View>
                  <Text style={styles.emptyTitle}>
                    {search ? "Sin resultados" : "No hay usuarios"}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {search
                      ? `No se encontraron usuarios para "${search}"`
                      : "Los miembros de tu empresa aparecerán aquí"}
                  </Text>
                </View>
              }
            />
          )}
        </>
      )}

      {/* ====== STEP 2: Group details ====== */}
      {wizardStep === 2 && (
        <>
          <ScrollView
            style={styles.detailsContainer}
            contentContainerStyle={styles.detailsScroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* Group avatar preview — tap to change */}
            <View style={styles.groupAvatarPreview}>
              <AnimatedPressable onPress={handleAvatarPress} haptic="medium">
                <View style={{ position: "relative" }}>
                  {groupAvatar.type === "image" ? (
                    <Image source={{ uri: groupAvatar.uri }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.groupAvatarCircle}>
                      <Ionicons
                        name={(GROUP_ICONS.find((g) => g.name === groupAvatar.icon)?.icon) || "people"}
                        size={36}
                        color="#fff"
                      />
                    </View>
                  )}
                  <View style={styles.avatarCameraBadge}>
                    <Ionicons name="camera" size={14} color="#fff" />
                  </View>
                </View>
              </AnimatedPressable>
              <Text style={[styles.groupAvatarHint, { marginTop: 8 }]}>
                Tocar para cambiar
              </Text>
            </View>

            {/* Icon picker (shown when chosen from action sheet) */}
            {showIconPicker && (
              <Animated.View entering={FadeIn.duration(200)} style={styles.iconPickerContainer}>
                <Text style={styles.inputLabel}>Ícono</Text>
                <View style={styles.iconPicker}>
                  {GROUP_ICONS.map((gi) => (
                    <AnimatedPressable
                      key={gi.name}
                      style={[
                        styles.iconOption,
                        groupAvatar.type === "icon" && groupAvatar.icon === gi.name && styles.iconOptionSelected,
                      ]}
                      onPress={() => {
                        haptics.selection();
                        setGroupAvatar({ type: "icon", icon: gi.name });
                        setSelectedIcon(gi.name);
                      }}
                      haptic="selection"
                    >
                      <Ionicons
                        name={gi.icon}
                        size={22}
                        color={groupAvatar.type === "icon" && groupAvatar.icon === gi.name ? colors.primary : colors.textMuted}
                      />
                    </AnimatedPressable>
                  ))}
                </View>
              </Animated.View>
            )}

            {/* Group name */}
            <Text style={styles.inputLabel}>Nombre *</Text>
            <TextInput
              style={[styles.textInput, groupName ? styles.textInputFocused : null]}
              placeholder={parentId ? "Nombre del subgrupo" : "Nombre del grupo"}
              placeholderTextColor={colors.textMuted}
              value={groupName}
              onChangeText={setGroupName}
              autoFocus
            />

            {/* Description */}
            <Text style={styles.inputLabel}>Descripción</Text>
            <TextInput
              style={[styles.textInput, styles.descriptionInput]}
              placeholder="¿De qué se trata este grupo?"
              placeholderTextColor={colors.textMuted}
              value={groupDescription}
              onChangeText={setGroupDescription}
              multiline
              numberOfLines={3}
            />

            {/* Settings card */}
            <Text style={styles.inputLabel}>Configuración</Text>
            <View style={styles.settingsCard}>
              {/* Only admins post */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.toggleLabel}>Solo admins escriben</Text>
                  <Text style={styles.toggleSublabel}>
                    Los miembros solo pueden leer mensajes
                  </Text>
                </View>
                <Switch
                  value={onlyAdminsPost}
                  onValueChange={(v) => {
                    haptics.selection();
                    setOnlyAdminsPost(v);
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              <View style={styles.settingsSeparator} />

              {/* Only admins add members */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.toggleLabel}>Grupo privado</Text>
                  <Text style={styles.toggleSublabel}>
                    Solo admins pueden agregar miembros
                  </Text>
                </View>
                <Switch
                  value={onlyAdminsAddMembers}
                  onValueChange={(v) => {
                    haptics.selection();
                    setOnlyAdminsAddMembers(v);
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              <View style={styles.settingsSeparator} />

              {/* Mute group */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.toggleLabel}>Silenciar grupo</Text>
                  <Text style={styles.toggleSublabel}>
                    No recibir notificaciones de este grupo
                  </Text>
                </View>
                <Switch
                  value={muteGroup}
                  onValueChange={(v) => {
                    haptics.selection();
                    setMuteGroup(v);
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            </View>

            {/* Members list (editable) */}
            <View style={styles.membersPreview}>
              <Text style={styles.inputLabel}>
                Miembros ({selectedUsers.length})
              </Text>
              <View style={{ gap: 2 }}>
                {selectedUsers.map((u) => (
                  <Animated.View
                    key={u.id}
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                    layout={LinearTransition.duration(200)}
                    style={styles.memberListItem}
                  >
                    <Avatar name={u.name} size="sm" />
                    <View style={styles.memberListInfo}>
                      <Text style={styles.memberListName}>{u.name}</Text>
                      <Text style={styles.memberListEmail}>{u.email}</Text>
                    </View>
                    <AnimatedPressable
                      style={styles.memberRemoveBtn}
                      onPress={() => toggleUser(u)}
                      haptic="light"
                    >
                      <Ionicons name="close" size={16} color={colors.textMuted} />
                    </AnimatedPressable>
                  </Animated.View>
                ))}
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}
