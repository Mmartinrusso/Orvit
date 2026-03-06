import { View, Text, Alert, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import Avatar from "@/components/ui/Avatar";
import { router } from "expo-router";
import { fonts } from "@/lib/fonts";

type IoniconsName = keyof typeof Ionicons.glyphMap;

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { isDark, mode, setMode, toggleTheme } = useTheme();
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

  // ── Logout ─────────────────────────────────────────────────
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

  // ── Menu item renderer ─────────────────────────────────────
  function renderMenuItem(
    icon: IoniconsName,
    title: string,
    options?: {
      subtitle?: string;
      trailing?: React.ReactNode;
      onPress?: () => void;
      showDivider?: boolean;
    }
  ) {
    const content = (
      <View
        style={{
          height: 56,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          gap: 14,
        }}
      >
        {/* Icon container */}
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
          <Ionicons name={icon} size={17} color={text} />
        </View>

        {/* Text */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              fontFamily: fonts.semiBold,
              color: text,
            }}
          >
            {title}
          </Text>
          {options?.subtitle && (
            <Text
              style={{
                fontSize: 11,
                fontWeight: "400",
                fontFamily: fonts.regular,
                color: textDim,
                marginTop: 1,
              }}
            >
              {options.subtitle}
            </Text>
          )}
        </View>

        {/* Trailing */}
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

  // ── Section header renderer ────────────────────────────────
  function renderSectionHeader(label: string) {
    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 }}>
        <Text
          style={{
            fontSize: 9,
            fontWeight: "700",
            fontFamily: fonts.bold,
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

  // ── Get user initials ──────────────────────────────────────
  const initials = (user?.name || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const roleLabel = user?.companyName || "Supervisor de Mantenimiento";

  // ── Theme toggle switch ────────────────────────────────────
  const themeToggle = (
    <Switch
      value={isDark}
      onValueChange={toggleTheme}
      trackColor={{
        false: "#333333",
        true: "#FFFFFF",
      }}
      thumbColor={isDark ? "#0A0A0A" : "#FFFFFF"}
      ios_backgroundColor="#333333"
      style={{
        transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
      }}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={["top"]}>
      {/* Title */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Text
          style={{
            fontSize: 28,
            fontWeight: "800",
            fontFamily: fonts.extraBold,
            letterSpacing: -0.84,
            color: isDark ? "#E5E5E5" : "#0A0A0A",
          }}
        >
          Ajustes
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Row */}
        <AnimatedPressable
          onPress={() => router.push("/profile")}
          haptic="light"
        >
          <View
            style={{
              height: 88,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              gap: 14,
            }}
          >
            {/* Avatar */}
            <View style={{ position: "relative" }}>
              {user?.avatar ? (
                <Avatar
                  name={user?.name || "Usuario"}
                  size="lg"
                  imageUrl={user.avatar}
                />
              ) : (
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: surface,
                    borderWidth: 1,
                    borderColor: border,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "700",
                      fontFamily: fonts.bold,
                      color: isDark ? "#E5E5E5" : "#0A0A0A",
                    }}
                  >
                    {initials}
                  </Text>
                </View>
              )}
            </View>

            {/* Name + role */}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  fontFamily: fonts.bold,
                  letterSpacing: -0.16,
                  color: isDark ? "#E5E5E5" : "#0A0A0A",
                }}
                numberOfLines={1}
              >
                {user?.name || "Usuario"}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "400",
                  fontFamily: fonts.regular,
                  color: textMuted,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {roleLabel}
              </Text>
            </View>

            {/* Chevron */}
            <Ionicons name="chevron-forward" size={18} color={textMuted} />
          </View>
        </AnimatedPressable>

        {/* Divider after profile */}
        <View style={{ height: 1, backgroundColor: divider, marginHorizontal: 20 }} />

        {/* GENERAL section */}
        {renderSectionHeader("GENERAL")}

        {renderMenuItem("shield-checkmark-outline", "Cuenta y seguridad", {
          subtitle: "Email, contrasena, 2FA",
          onPress: () => router.push("/account-security"),
        })}

        {renderMenuItem("notifications-outline", "Notificaciones", {
          subtitle: "Push, sonidos, grupos",
          onPress: () => router.push("/notification-settings"),
        })}

        {renderMenuItem(
          isDark ? "moon-outline" : "sunny-outline",
          "Apariencia",
          {
            subtitle: mode === "system"
              ? "Automatico"
              : isDark ? "Tema oscuro" : "Tema claro",
            trailing: themeToggle,
            onPress: toggleTheme,
            showDivider: false,
          }
        )}

        {renderMenuItem("phone-portrait-outline", "Tema automatico", {
          subtitle: "Seguir el tema del sistema",
          trailing: (
            <Switch
              value={mode === "system"}
              onValueChange={(val) => setMode(val ? "system" : (isDark ? "dark" : "light"))}
              trackColor={{ false: "#333333", true: "#FFFFFF" }}
              thumbColor={isDark ? "#0A0A0A" : "#FFFFFF"}
              ios_backgroundColor="#333333"
              style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
            />
          ),
          showDivider: false,
        })}

        {/* DATOS section */}
        {renderSectionHeader("DATOS")}

        {renderMenuItem("cloud-outline", "Almacenamiento", {
          subtitle: "Cache y datos locales",
          onPress: () => Alert.alert("Almacenamiento", "Cache: datos temporales de la app.\n\nPara liberar espacio, podes cerrar sesion y volver a entrar."),
        })}

        {renderMenuItem("eye-off-outline", "Privacidad", {
          subtitle: "Ultimo visto, foto de perfil",
          onPress: () => router.push("/privacy"),
          showDivider: false,
        })}

        {/* SOPORTE section */}
        {renderSectionHeader("SOPORTE")}

        {renderMenuItem("help-circle-outline", "Ayuda", {
          onPress: () => router.push("/help"),
        })}

        {renderMenuItem("information-circle-outline", "Acerca de m6", {
          subtitle: "Version 1.0.0",
          onPress: () => Alert.alert("M6", "Version 1.0.0\n\nDesarrollado por M6\nm6.app"),
          showDivider: false,
        })}

        {/* Logout row */}
        <View style={{ marginTop: 16 }}>
          <View style={{ height: 1, backgroundColor: divider, marginHorizontal: 20 }} />
          <AnimatedPressable onPress={handleLogout} haptic="medium">
            <View
              style={{
                height: 56,
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
                  backgroundColor: isDark ? "#1A0A0A" : "#FEF2F2",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Ionicons name="log-out-outline" size={17} color={errorColor} />
              </View>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  fontFamily: fonts.semiBold,
                  color: errorColor,
                }}
              >
                Cerrar sesion
              </Text>
            </View>
          </AnimatedPressable>
        </View>

        {/* Footer */}
        <View style={{ alignItems: "center", paddingTop: 20 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "400",
              fontFamily: fonts.regular,
              color: isDark ? "#262626" : "#A3A3A3",
            }}
          >
            m6 Chat v1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
