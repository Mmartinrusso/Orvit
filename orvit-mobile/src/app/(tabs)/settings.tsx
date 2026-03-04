import { View, Text, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCreateStyles } from "@/hooks/useCreateStyles";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import AnimatedFadeIn from "@/components/ui/AnimatedFadeIn";
import Avatar from "@/components/ui/Avatar";
import { router } from "expo-router";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useCreateStyles((c, t, s, r) => ({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    header: {
      paddingHorizontal: s.xl,
      paddingVertical: s.lg,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerTitle: {
      ...t.title,
      color: c.textPrimary,
    },
    content: {
      paddingHorizontal: s.xl,
      paddingTop: s.xxl,
    },
    card: {
      backgroundColor: c.bgSecondary,
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: s.xxl,
      alignItems: "center" as const,
      marginBottom: s.lg,
    },
    name: {
      ...t.heading,
      color: c.textPrimary,
      marginTop: s.lg,
      marginBottom: s.xs,
    },
    email: {
      ...t.caption,
      color: c.textSecondary,
      marginBottom: 2,
    },
    company: {
      ...t.caption,
      color: c.textMuted,
    },
    themeCard: {
      backgroundColor: c.bgSecondary,
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: s.lg,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      marginBottom: s.lg,
    },
    themeLeft: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: s.md,
    },
    themeIconContainer: {
      width: 40,
      height: 40,
      borderRadius: r.md,
      backgroundColor: c.primaryBg,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    themeLabel: {
      ...t.bodyMedium,
      color: c.textPrimary,
    },
    themeSubLabel: {
      ...t.small,
      color: c.textMuted,
    },
    togglePill: {
      width: 52,
      height: 30,
      borderRadius: 15,
      padding: 3,
      justifyContent: "center" as const,
    },
    toggleKnob: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#ffffff",
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    logoutCard: {
      backgroundColor: c.bgSecondary,
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: s.lg,
      alignItems: "center" as const,
      flexDirection: "row" as const,
      justifyContent: "center" as const,
      gap: s.sm,
    },
    logoutText: {
      ...t.subheading,
      color: c.error,
    },
    versionText: {
      ...t.small,
      color: c.textMuted,
      textAlign: "center" as const,
      marginTop: s.xxxl,
    },
  }));

  async function handleLogout() {
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Perfil</Text>
      </View>

      <View style={styles.content}>
        <AnimatedFadeIn delay={0}>
          <View style={styles.card}>
            <Avatar name={user?.name || "Usuario"} size="xl" />
            <Text style={styles.name}>{user?.name || "Usuario"}</Text>
            <Text style={styles.email}>{user?.email || ""}</Text>
            <Text style={styles.company}>{user?.companyName || ""}</Text>
          </View>
        </AnimatedFadeIn>

        <AnimatedFadeIn delay={100}>
          <View style={styles.themeCard}>
            <View style={styles.themeLeft}>
              <View style={styles.themeIconContainer}>
                <Ionicons
                  name={isDark ? "moon" : "sunny"}
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View>
                <Text style={styles.themeLabel}>
                  {isDark ? "Modo oscuro" : "Modo claro"}
                </Text>
                <Text style={styles.themeSubLabel}>
                  Apariencia de la app
                </Text>
              </View>
            </View>

            <AnimatedPressable
              onPress={toggleTheme}
              haptic="selection"
              style={[
                styles.togglePill,
                {
                  backgroundColor: isDark ? colors.primary : colors.borderLight,
                  alignItems: isDark ? "flex-end" : "flex-start",
                },
              ]}
            >
              <View style={styles.toggleKnob}>
                <Ionicons
                  name={isDark ? "moon" : "sunny"}
                  size={14}
                  color={isDark ? colors.primaryDark : colors.warning}
                />
              </View>
            </AnimatedPressable>
          </View>
        </AnimatedFadeIn>

        <AnimatedFadeIn delay={200}>
          <AnimatedPressable
            onPress={handleLogout}
            haptic="medium"
            style={styles.logoutCard}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </AnimatedPressable>
        </AnimatedFadeIn>

        <Text style={styles.versionText}>ORVIT v1.0.0</Text>
      </View>
    </SafeAreaView>
  );
}
