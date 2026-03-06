import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  SectionList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { getCompanyUsers, createConversation } from "@/api/chat";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import { fonts } from "@/lib/fonts";
import type { CompanyUser } from "@/types/chat";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ContactsScreen() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const haptics = useHaptics();

  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  // m6 colors
  const bgColor = isDark ? "#0A0A0A" : "#FFFFFF";
  const surfaceBg = isDark ? "#171717" : "#FAFAFA";
  const borderColor = isDark ? "#262626" : "#E5E5E5";
  const textColor = isDark ? "#E5E5E5" : "#0A0A0A";
  const textSecondary = isDark ? "#A3A3A3" : "#737373";
  const textMuted = isDark ? "#555555" : "#A3A3A3";
  const textDim = isDark ? "#404040" : "#737373";
  const sectionText = isDark ? "#333333" : "#A3A3A3";
  const dividerColor = isDark ? "#111111" : "#F0F0F0";
  const btnBg = isDark ? "#171717" : "#FAFAFA";
  const btnBorder = isDark ? "#262626" : "#E5E5E5";
  const btnIcon = isDark ? "#A3A3A3" : "#737373";
  const onlineDotBorder = isDark ? "#0A0A0A" : "#FFFFFF";

  const hasAuth = !!user;
  const {
    data: users = [],
    isLoading,
  } = useQuery({
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
      );
  }, [users, search, user?.id]);

  const sections = useMemo(() => {
    const sorted = [...filteredUsers].sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" })
    );

    const letterMap = new Map<string, CompanyUser[]>();
    for (const u of sorted) {
      const letter = u.name.charAt(0).toUpperCase();
      if (!letterMap.has(letter)) letterMap.set(letter, []);
      letterMap.get(letter)!.push(u);
    }

    const result: { title: string; data: CompanyUser[] }[] = [];
    for (const [letter, letterUsers] of letterMap) {
      result.push({ title: letter, data: letterUsers });
    }

    return result;
  }, [filteredUsers]);

  const handleOpenDM = useCallback(
    async (targetUser: CompanyUser) => {
      if (creating) return;
      haptics.selection();
      setCreating(true);
      try {
        const conv = await createConversation({
          type: "DIRECT",
          memberIds: [targetUser.id],
        });
        router.push(`/chat/${conv.id}`);
      } catch {
        Alert.alert("Error", "No se pudo abrir la conversación");
      } finally {
        setCreating(false);
      }
    },
    [creating, haptics]
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: bgColor }}
      edges={["top"]}
    >
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 14 }}>
        {/* Title row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontSize: 28,
              fontWeight: "800",
              fontFamily: fonts.extraBold,
              color: textColor,
              letterSpacing: -0.84,
            }}
          >
            Contactos
          </Text>
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
            <Ionicons name="person-add-outline" size={18} color={btnIcon} />
          </AnimatedPressable>
        </View>

        {/* Search bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: surfaceBg,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: borderColor,
            paddingLeft: 14,
            height: 38,
            gap: 10,
          }}
        >
          <Ionicons name="search-outline" size={16} color={textMuted} />
          <TextInput
            style={
              {
                flex: 1,
                fontSize: 13,
                fontWeight: "400",
                fontFamily: fonts.regular,
                color: textColor,
                outlineStyle: "none",
              } as any
            }
            placeholder="Buscar contacto..."
            placeholderTextColor={textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <AnimatedPressable
              onPress={() => setSearch("")}
              haptic="light"
              style={{ paddingRight: 12 }}
            >
              <Ionicons name="close-circle" size={16} color={textMuted} />
            </AnimatedPressable>
          )}
        </View>
      </View>

      {/* Contact list */}
      {isLoading ? (
        <View style={{ paddingTop: 60, alignItems: "center" }}>
          <ActivityIndicator
            color={isDark ? "#555555" : "#A3A3A3"}
            size="large"
          />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          renderSectionHeader={({ section }) => (
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                fontFamily: fonts.bold,
                letterSpacing: 0.22,
                color: sectionText,
                paddingHorizontal: 20,
                paddingTop: 8,
                paddingBottom: 4,
              }}
            >
              {section.title}
            </Text>
          )}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: 1,
                backgroundColor: dividerColor,
                marginLeft: 72,
              }}
            />
          )}
          renderItem={({ item }) => (
            <AnimatedPressable
              onPress={() => handleOpenDM(item)}
              haptic="selection"
              disabled={creating}
              style={{
                flexDirection: "row",
                alignItems: "center",
                height: 60,
                paddingHorizontal: 20,
              }}
            >
              {/* Avatar */}
              <View style={{ position: "relative" }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: surfaceBg,
                    borderWidth: 1,
                    borderColor: borderColor,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      fontFamily: fonts.bold,
                      color: textSecondary,
                    }}
                  >
                    {getInitials(item.name)}
                  </Text>
                </View>
                {/* Online indicator */}
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
                    borderColor: onlineDotBorder,
                  }}
                />
              </View>

              {/* Info */}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    fontFamily: fonts.semiBold,
                    color: textColor,
                  }}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "400",
                    fontFamily: fonts.regular,
                    color: textDim,
                    marginTop: 1,
                  }}
                  numberOfLines={1}
                >
                  {item.role}
                </Text>
              </View>
            </AnimatedPressable>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  backgroundColor: surfaceBg,
                  borderWidth: 1,
                  borderColor: borderColor,
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <Ionicons
                  name={search ? "search-outline" : "people-outline"}
                  size={24}
                  color={textMuted}
                />
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  fontFamily: fonts.semiBold,
                  color: textColor,
                  marginBottom: 6,
                }}
              >
                {search ? "Sin resultados" : "No hay contactos"}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: fonts.regular,
                  color: textMuted,
                  textAlign: "center",
                  paddingHorizontal: 40,
                }}
              >
                {search
                  ? "Probá con otro nombre o email"
                  : "Los miembros de tu empresa aparecerán aquí"}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
