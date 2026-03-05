import { useState } from "react";
import { View, Text, Alert, ScrollView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCreateStyles } from "@/hooks/useCreateStyles";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import AnimatedFadeIn from "@/components/ui/AnimatedFadeIn";
import Avatar from "@/components/ui/Avatar";
import { router } from "expo-router";
import { API_URL } from "@/api/client";
import { getAccessToken } from "@/lib/storage";

type IoniconsName = keyof typeof Ionicons.glyphMap;

export default function SettingsScreen() {
  const { user, logout, refreshUser } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function handleChangeAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso denegado", "Se necesita acceso a la galeria para cambiar tu foto.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: `avatar.${asset.uri.split(".").pop() || "jpg"}`,
        type: asset.mimeType || "image/jpeg",
      } as unknown as Blob);

      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/api/auth/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      // Refresh user data to get new avatar URL
      await refreshUser();
      Alert.alert("Listo", "Foto de perfil actualizada");
    } catch {
      Alert.alert("Error", "No se pudo cambiar la foto");
    } finally {
      setUploadingAvatar(false);
    }
  }

  const styles = useCreateStyles((c, t, s, r) => ({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    header: {
      paddingHorizontal: s.xl,
      paddingTop: s.md,
      paddingBottom: s.sm,
    },
    headerTitle: {
      ...t.title,
      color: c.textPrimary,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    // Profile card
    profileCard: {
      marginHorizontal: s.xl,
      marginTop: s.lg,
      marginBottom: s.xxl,
      backgroundColor: c.bgSecondary,
      borderRadius: r.xl,
      borderWidth: 1,
      borderColor: c.border,
      overflow: "hidden" as const,
    },
    profileTop: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      padding: s.lg,
      gap: s.lg,
    },
    avatarContainer: {
      position: "relative" as const,
    },
    onlineDot: {
      position: "absolute" as const,
      bottom: 2,
      right: 2,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: "#34d399",
      borderWidth: 2.5,
      borderColor: c.bgSecondary,
    },
    profileInfo: {
      flex: 1,
    },
    profileName: {
      ...t.heading,
      color: c.textPrimary,
    },
    profileEmail: {
      ...t.caption,
      color: c.textSecondary,
      marginTop: 2,
    },
    companyRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginTop: s.sm,
      gap: 6,
    },
    companyText: {
      ...t.small,
      color: c.primary,
      fontWeight: "600" as const,
    },
    profileDivider: {
      height: 1,
      backgroundColor: c.border,
      marginHorizontal: s.lg,
    },
    profileStats: {
      flexDirection: "row" as const,
      paddingVertical: s.md,
      paddingHorizontal: s.lg,
    },
    statItem: {
      flex: 1,
      alignItems: "center" as const,
    },
    statValue: {
      ...t.subheading,
      color: c.textPrimary,
      fontWeight: "700" as const,
    },
    statLabel: {
      ...t.tiny,
      color: c.textMuted,
      marginTop: 2,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
    },
    statDivider: {
      width: 1,
      backgroundColor: c.border,
      marginVertical: 4,
    },
    // Menu sections
    sectionLabel: {
      ...t.small,
      color: c.textMuted,
      fontWeight: "600" as const,
      textTransform: "uppercase" as const,
      letterSpacing: 0.8,
      marginHorizontal: s.xl,
      marginBottom: s.sm,
      marginTop: s.md,
    },
    menuGroup: {
      marginHorizontal: s.xl,
      marginBottom: s.lg,
      backgroundColor: c.bgSecondary,
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.border,
      overflow: "hidden" as const,
    },
    menuRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: s.lg,
      paddingVertical: 14,
      gap: s.md,
    },
    menuRowBorder: {
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    menuIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    menuText: {
      flex: 1,
    },
    menuLabel: {
      ...t.bodyMedium,
      color: c.textPrimary,
    },
    menuSub: {
      ...t.small,
      color: c.textMuted,
      marginTop: 1,
    },
    // Toggle
    toggleTrack: {
      width: 48,
      height: 28,
      borderRadius: 14,
      padding: 2,
      justifyContent: "center" as const,
    },
    toggleKnob: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#ffffff",
      justifyContent: "center" as const,
      alignItems: "center" as const,
      ...(Platform.OS !== "web"
        ? {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.15,
            shadowRadius: 2,
            elevation: 2,
          }
        : {}),
    },
    // Logout
    logoutRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingVertical: s.lg,
      gap: s.sm,
    },
    logoutText: {
      ...t.bodyMedium,
      color: c.error,
    },
    // Footer
    footer: {
      alignItems: "center" as const,
      paddingTop: s.xxl,
      paddingBottom: s.lg,
      gap: 2,
    },
    footerBrand: {
      ...t.small,
      fontWeight: "700" as const,
      color: c.textMuted,
      letterSpacing: 2,
    },
    footerVersion: {
      ...t.tiny,
      color: c.textMuted,
      opacity: 0.6,
    },
  }));

  async function handleLogout() {
    Alert.alert("Cerrar sesion", "Estas seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesion",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  }

  function renderMenuItem(
    icon: IoniconsName,
    iconColor: string,
    iconBg: string,
    label: string,
    options?: {
      subtitle?: string;
      trailing?: React.ReactNode;
      onPress?: () => void;
      isLast?: boolean;
    }
  ) {
    const row = (
      <View style={[styles.menuRow, !options?.isLast && styles.menuRowBorder]}>
        <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={17} color={iconColor} />
        </View>
        <View style={styles.menuText}>
          <Text style={styles.menuLabel}>{label}</Text>
          {options?.subtitle && (
            <Text style={styles.menuSub}>{options.subtitle}</Text>
          )}
        </View>
        {options?.trailing || (
          <Ionicons name="chevron-forward-outline" size={16} color={colors.textMuted} />
        )}
      </View>
    );

    if (options?.onPress) {
      return (
        <AnimatedPressable
          key={label}
          onPress={options.onPress}
          haptic="light"
        >
          {row}
        </AnimatedPressable>
      );
    }
    return <View key={label}>{row}</View>;
  }

  const themeToggle = (
    <AnimatedPressable onPress={toggleTheme} haptic="selection">
      <View
        style={[
          styles.toggleTrack,
          {
            backgroundColor: isDark ? colors.primary : colors.borderLight,
            alignItems: isDark
              ? ("flex-end" as const)
              : ("flex-start" as const),
          },
        ]}
      >
        <View style={styles.toggleKnob}>
          <Ionicons
            name={isDark ? "moon-outline" : "sunny-outline"}
            size={13}
            color={isDark ? colors.primary : colors.warning}
          />
        </View>
      </View>
    </AnimatedPressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Perfil</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <AnimatedFadeIn delay={0}>
          <View style={styles.profileCard}>
            <View style={styles.profileTop}>
              <AnimatedPressable
                onPress={handleChangeAvatar}
                haptic="light"
                disabled={uploadingAvatar}
                style={styles.avatarContainer}
              >
                <Avatar
                  name={user?.name || "Usuario"}
                  size="lg"
                  imageUrl={user?.avatar}
                />
                <View style={styles.onlineDot} />
                <View
                  style={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: colors.primary,
                    justifyContent: "center",
                    alignItems: "center",
                    borderWidth: 2,
                    borderColor: colors.bgSecondary,
                  }}
                >
                  {uploadingAvatar ? (
                    <ActivityIndicator size={10} color="#fff" />
                  ) : (
                    <Ionicons name="camera-outline" size={12} color="#fff" />
                  )}
                </View>
              </AnimatedPressable>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {user?.name || "Usuario"}
                </Text>
                <Text style={styles.profileEmail} numberOfLines={1}>
                  {user?.email || ""}
                </Text>
                {user?.companyName ? (
                  <View style={styles.companyRow}>
                    <Ionicons
                      name="business-outline"
                      size={12}
                      color={colors.primary}
                    />
                    <Text style={styles.companyText}>{user.companyName}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </AnimatedFadeIn>

        {/* General */}
        <AnimatedFadeIn delay={100}>
          <Text style={styles.sectionLabel}>General</Text>
          <View style={styles.menuGroup}>
            {renderMenuItem(
              isDark ? "moon-outline" : "sunny-outline",
              isDark ? "#a78bfa" : "#f59e0b",
              isDark ? "rgba(167,139,250,0.15)" : "rgba(245,158,11,0.15)",
              isDark ? "Modo oscuro" : "Modo claro",
              {
                subtitle: "Apariencia de la app",
                trailing: themeToggle,
              }
            )}
            {renderMenuItem(
              "notifications-outline",
              "#3b82f6",
              "rgba(59,130,246,0.15)",
              "Notificaciones",
              { subtitle: "Sonidos y alertas", isLast: true }
            )}
          </View>
        </AnimatedFadeIn>

        {/* Info */}
        <AnimatedFadeIn delay={200}>
          <Text style={styles.sectionLabel}>Informacion</Text>
          <View style={styles.menuGroup}>
            {renderMenuItem(
              "help-circle-outline",
              "#8b5cf6",
              "rgba(139,92,246,0.15)",
              "Ayuda",
              { subtitle: "Centro de asistencia", isLast: true }
            )}
          </View>
        </AnimatedFadeIn>

        {/* Logout */}
        <AnimatedFadeIn delay={300}>
          <View style={[styles.menuGroup, { marginTop: 4 }]}>
            <AnimatedPressable onPress={handleLogout} haptic="medium">
              <View style={styles.logoutRow}>
                <Ionicons
                  name="log-out-outline"
                  size={20}
                  color={colors.error}
                />
                <Text style={styles.logoutText}>Cerrar sesion</Text>
              </View>
            </AnimatedPressable>
          </View>
        </AnimatedFadeIn>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>ORVIT</Text>
          <Text style={styles.footerVersion}>v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
