import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  ActionSheetIOS,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
  LinearTransition,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { fonts } from "@/lib/fonts";
import {
  getCompanyUsers,
  createConversation,
  uploadChatFile,
} from "@/api/chat";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import type { CompanyUser } from "@/types/chat";

export default function NewChatScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const params = useLocalSearchParams<{ parentId?: string; mode?: string }>();
  const parentId = params.parentId || undefined;
  const initialGroupMode = params.mode === "group" || !!parentId;

  const [search, setSearch] = useState("");
  const [isGroupMode, setIsGroupMode] = useState(initialGroupMode);
  const [selectedUsers, setSelectedUsers] = useState<CompanyUser[]>([]);
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupAvatar, setGroupAvatar] = useState<
    { type: "icon" } | { type: "image"; uri: string }
  >({ type: "icon" });

  const hasAuth = !!user;
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["company-users"],
    queryFn: getCompanyUsers,
    enabled: hasAuth,
    retry: 2,
  });

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users
      .filter((u) => u.id !== user?.id && u.isActive)
      .filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
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

  const removeUser = useCallback(
    (u: CompanyUser) => {
      haptics.light();
      setSelectedUsers((prev) => prev.filter((s) => s.id !== u.id));
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
    }
  }, []);

  const pickImageFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Se necesita acceso a la camara");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setGroupAvatar({ type: "image", uri: result.assets[0].uri });
    }
  }, []);

  const handleAvatarPress = useCallback(() => {
    haptics.selection();
    const options = ["Elegir foto", "Sacar foto", "Cancelar"];
    const cancelButtonIndex = 2;
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex },
        (idx) => {
          if (idx === 0) pickImageFromLibrary();
          else if (idx === 1) pickImageFromCamera();
        }
      );
    } else {
      Alert.alert("Avatar del grupo", "", [
        { text: "Elegir foto", onPress: pickImageFromLibrary },
        { text: "Sacar foto", onPress: pickImageFromCamera },
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
        Alert.alert("Error", "No se pudo crear la conversacion");
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
      if (groupAvatar.type === "image") {
        try {
          const upload = await uploadChatFile(groupAvatar.uri, "group-avatar.jpg", "image/jpeg");
          avatarUrl = upload.url;
        } catch {
          Alert.alert("Error", "No se pudo subir la imagen");
          setCreating(false);
          return;
        }
      }
      const conv = await createConversation({
        type: "CHANNEL",
        name: groupName.trim(),
        memberIds: selectedUsers.map((u) => u.id),
        parentId,
        avatarUrl,
      });
      haptics.success();
      router.replace(`/chat/${conv.id}`);
    } catch {
      Alert.alert("Error", "No se pudo crear el grupo");
    } finally {
      setCreating(false);
    }
  }, [groupName, selectedUsers, parentId, groupAvatar, haptics]);

  const canCreate = groupName.trim().length > 0 && selectedUsers.length > 0;

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const getShortName = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) return `${parts[0]} ${parts[1][0]}.`;
    return name;
  };

  // ── If not group mode, show simple user list for direct chat ──
  if (!isGroupMode) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 14,
            paddingBottom: 14,
            gap: 8,
          }}
        >
          <AnimatedPressable onPress={() => router.back()} haptic="light">
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </AnimatedPressable>
          <Text
            style={{
              fontFamily: fonts.extraBold,
              fontSize: 20,
              color: colors.textPrimary,
              letterSpacing: -0.4,
              flex: 1,
            }}
          >
            Nuevo chat
          </Text>
          <AnimatedPressable
            onPress={() => setIsGroupMode(true)}
            haptic="light"
          >
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 13,
                color: colors.textSecondary,
              }}
            >
              Crear grupo
            </Text>
          </AnimatedPressable>
        </View>

        {/* Search */}
        <View
          style={{
            marginHorizontal: 20,
            backgroundColor: colors.bgTertiary,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 13,
            height: 36,
            gap: 8,
            marginBottom: 8,
          }}
        >
          <Ionicons name="search-outline" size={14} color={colors.textMuted} />
          <TextInput
            style={{
              flex: 1,
              fontFamily: fonts.regular,
              fontSize: 12,
              color: colors.textPrimary,
            }}
            placeholder="Buscar..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* User list */}
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ flexGrow: 1 }}
          removeClippedSubviews
          maxToRenderPerBatch={15}
          windowSize={11}
          initialNumToRender={20}
          renderItem={({ item }) => (
            <AnimatedPressable
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 20,
                paddingVertical: 10,
                gap: 12,
                borderTopWidth: 1,
                borderTopColor: isDark ? "#111111" : "#F0F0F0",
              }}
              onPress={() => handleCreateDirect(item)}
              haptic="selection"
              disabled={creating}
            >
              {/* Avatar */}
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.bgTertiary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: 13,
                    color: colors.textSecondary,
                  }}
                >
                  {getInitials(item.name)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: fonts.semiBold,
                    fontSize: 13,
                    color: colors.textPrimary,
                  }}
                >
                  {item.name}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 11,
                    color: colors.textMuted,
                    marginTop: 1,
                  }}
                >
                  {item.email}
                </Text>
              </View>
            </AnimatedPressable>
          )}
          ListEmptyComponent={
            isLoading ? (
              <View style={{ paddingTop: 60, alignItems: "center" }}>
                <ActivityIndicator color={colors.textMuted} />
              </View>
            ) : (
              <View style={{ alignItems: "center", paddingTop: 80 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted }}>
                  {search ? "Sin resultados" : "No hay usuarios"}
                </Text>
              </View>
            )
          }
        />
      </SafeAreaView>
    );
  }

  // ── Group mode: single screen matching Figma m6 ──
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      {/* Header: < Nuevo grupo */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: 14,
          gap: 8,
        }}
      >
        <AnimatedPressable
          onPress={() => {
            if (isGroupMode && !initialGroupMode) {
              setIsGroupMode(false);
              setSelectedUsers([]);
              setGroupName("");
            } else {
              router.back();
            }
          }}
          haptic="light"
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </AnimatedPressable>
        <Text
          style={{
            fontFamily: fonts.extraBold,
            fontSize: 20,
            color: colors.textPrimary,
            letterSpacing: -0.4,
          }}
        >
          Nuevo grupo
        </Text>
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
        removeClippedSubviews
        maxToRenderPerBatch={15}
        windowSize={11}
        initialNumToRender={20}
        ListHeaderComponent={
          <View>
            {/* Camera avatar */}
            <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 16 }}>
              <AnimatedPressable onPress={handleAvatarPress} haptic="medium">
                {groupAvatar.type === "image" ? (
                  <Image
                    source={{ uri: groupAvatar.uri }}
                    style={{ width: 64, height: 64, borderRadius: 32 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: colors.bgTertiary,
                      borderWidth: 2,
                      borderColor: colors.border,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons name="camera-outline" size={24} color={colors.textMuted} />
                  </View>
                )}
              </AnimatedPressable>
            </View>

            {/* Group name input */}
            <View
              style={{
                marginHorizontal: 20,
                backgroundColor: colors.bgTertiary,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 15,
                height: 40,
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <TextInput
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 13,
                  color: colors.textPrimary,
                }}
                placeholder="Nombre del grupo..."
                placeholderTextColor={colors.textMuted}
                value={groupName}
                onChangeText={setGroupName}
              />
            </View>

            {/* PARTICIPANTES label + chips */}
            {selectedUsers.length > 0 && (
              <View>
                <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 6 }}>
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: 9,
                      color: isDark ? "#333333" : "#A3A3A3",
                      letterSpacing: 0.72,
                      textTransform: "uppercase",
                    }}
                  >
                    Participantes ({selectedUsers.length})
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: 20,
                    gap: 6,
                    paddingBottom: 10,
                  }}
                  keyboardShouldPersistTaps="handled"
                >
                  {selectedUsers.map((u) => (
                    <Animated.View
                      key={u.id}
                      entering={ZoomIn.duration(150)}
                      exiting={ZoomOut.duration(100)}
                      layout={LinearTransition.duration(150)}
                    >
                      <AnimatedPressable
                        onPress={() => removeUser(u)}
                        haptic="light"
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: colors.bgTertiary,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 14,
                          height: 28,
                          paddingLeft: 6,
                          paddingRight: 8,
                          gap: 6,
                        }}
                      >
                        {/* Mini avatar */}
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: colors.border,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: fonts.bold,
                              fontSize: 8,
                              color: colors.textSecondary,
                            }}
                          >
                            {getInitials(u.name)}
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontFamily: fonts.semiBold,
                            fontSize: 11,
                            color: colors.textSecondary,
                          }}
                        >
                          {getShortName(u.name)}
                        </Text>
                        <Ionicons name="close" size={12} color={colors.textMuted} />
                      </AnimatedPressable>
                    </Animated.View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Search participants */}
            <View
              style={{
                marginHorizontal: 20,
                backgroundColor: colors.bgTertiary,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 13,
                height: 36,
                gap: 8,
                marginBottom: 4,
              }}
            >
              <Ionicons name="search-outline" size={14} color={colors.textMuted} />
              <TextInput
                style={{
                  flex: 1,
                  fontFamily: fonts.regular,
                  fontSize: 12,
                  color: colors.textPrimary,
                }}
                placeholder="Agregar participantes..."
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
              />
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = selectedUsers.some((s) => s.id === item.id);
          return (
            <AnimatedPressable
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 20,
                paddingVertical: 10,
                gap: 12,
                borderTopWidth: 1,
                borderTopColor: isDark ? "#111111" : "#F0F0F0",
              }}
              onPress={() => toggleUser(item)}
              haptic="selection"
            >
              {/* Checkbox */}
              {isSelected ? (
                <Animated.View entering={ZoomIn.duration(150)}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      backgroundColor: colors.textPrimary,
                      borderWidth: 1,
                      borderColor: colors.textPrimary,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons name="checkmark" size={14} color={colors.bg} />
                  </View>
                </Animated.View>
              ) : (
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: isDark ? "#333333" : "#D4D4D4",
                  }}
                />
              )}

              {/* Avatar */}
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.bgTertiary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: 13,
                    color: colors.textSecondary,
                  }}
                >
                  {getInitials(item.name)}
                </Text>
              </View>

              {/* Name + role */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: fonts.semiBold,
                    fontSize: 13,
                    color: colors.textPrimary,
                  }}
                >
                  {item.name}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 11,
                    color: colors.textMuted,
                    marginTop: 1,
                  }}
                >
                  {item.email}
                </Text>
              </View>
            </AnimatedPressable>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingTop: 60, alignItems: "center" }}>
              <ActivityIndicator color={colors.textMuted} />
            </View>
          ) : (
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted }}>
                {search ? "Sin resultados" : "No hay usuarios"}
              </Text>
            </View>
          )
        }
      />

      {/* Bottom: Crear grupo button */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 12,
          paddingBottom: 16,
          backgroundColor: colors.bg,
        }}
      >
        <AnimatedPressable
          onPress={handleCreateGroup}
          disabled={!canCreate || creating}
          haptic="medium"
          style={{
            height: 44,
            borderRadius: 12,
            backgroundColor: canCreate ? colors.textPrimary : (isDark ? "#1A1A1A" : "#E5E5E5"),
            justifyContent: "center",
            alignItems: "center",
            opacity: creating ? 0.6 : 1,
          }}
        >
          {creating ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text
              style={{
                fontFamily: fonts.semiBold,
                fontSize: 14,
                color: canCreate ? colors.bg : colors.textMuted,
              }}
            >
              Crear grupo
            </Text>
          )}
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}
