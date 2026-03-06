import { useState } from "react";
import { View, Text, TextInput, Alert, ScrollView } from "react-native";
import { fonts } from "@/lib/fonts";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { API_URL } from "@/api/client";
import { getAccessToken } from "@/lib/storage";

type IoniconsName = keyof typeof Ionicons.glyphMap;

export default function AccountSecurityScreen() {
  const { user, logout } = useAuth();
  const { isDark } = useTheme();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changing, setChanging] = useState(false);

  // ── m6 colors ──────────────────────────────────────────────
  const bg = isDark ? "#0A0A0A" : "#FFFFFF";
  const surface = isDark ? "#171717" : "#FAFAFA";
  const border = isDark ? "#262626" : "#E5E5E5";
  const text = isDark ? "#E5E5E5" : "#0A0A0A";
  const textMuted = isDark ? "#555555" : "#A3A3A3";
  const textDim = isDark ? "#404040" : "#737373";
  const sectionColor = isDark ? "#333333" : "#A3A3A3";
  const divider = isDark ? "#111111" : "#F0F0F0";

  // ── Change password handler ──────────────────────────────────
  async function handleChangePassword() {
    if (!currentPassword.trim()) {
      Alert.alert("Error", "Ingresa tu contrasena actual");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Error", "La nueva contrasena debe tener al menos 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Las contrasenas no coinciden");
      return;
    }

    setChanging(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "No se pudo cambiar la contrasena");
      }

      Alert.alert("Listo", "Contrasena actualizada");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      Alert.alert("Error", err.message || "No se pudo cambiar la contrasena");
    } finally {
      setChanging(false);
    }
  }

  // ── Logout all sessions ──────────────────────────────────────
  function handleLogoutAll() {
    Alert.alert(
      "Cerrar todas las sesiones",
      "Se cerrara la sesion en todos los dispositivos, incluyendo este.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Cerrar todas",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getAccessToken();
              await fetch(`${API_URL}/api/auth/logout-all`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              });
              await logout();
              router.replace("/login");
            } catch {
              Alert.alert("Error", "No se pudieron cerrar las sesiones");
            }
          },
        },
      ]
    );
  }

  // ── Section header renderer ────────────────────────────────
  function renderSectionHeader(label: string) {
    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 }}>
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

        {options?.trailing || (
          <Ionicons name="chevron-forward" size={16} color={textMuted} />
        )}
      </View>
    );

    const dividerView =
      options?.showDivider !== false ? (
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

  // ── Password input renderer ────────────────────────────────
  function renderPasswordInput(
    placeholder: string,
    value: string,
    onChangeText: (t: string) => void,
    show: boolean,
    toggleShow: () => void
  ) {
    return (
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <View
          style={{
            height: 44,
            borderRadius: 10,
            backgroundColor: surface,
            borderWidth: 1,
            borderColor: border,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
          }}
        >
          <TextInput
            placeholder={placeholder}
            placeholderTextColor={textMuted}
            secureTextEntry={!show}
            value={value}
            onChangeText={onChangeText}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              flex: 1,
              fontSize: 13,
              fontFamily: fonts.regular,
              color: text,
              height: "100%",
            }}
          />
          <AnimatedPressable onPress={toggleShow} haptic="light">
            <Ionicons
              name={show ? "eye-off-outline" : "eye-outline"}
              size={18}
              color={textMuted}
            />
          </AnimatedPressable>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 12,
          gap: 12,
        }}
      >
        <AnimatedPressable onPress={() => router.back()} haptic="light">
          <Ionicons name="arrow-back" size={22} color={text} />
        </AnimatedPressable>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            fontFamily: fonts.semiBold,
            color: text,
          }}
        >
          Cuenta y seguridad
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* CUENTA section */}
        {renderSectionHeader("CUENTA")}

        {renderMenuItem("mail-outline", user?.email || "Sin email", {
          subtitle: "Email de acceso",
          trailing: <View />,
          showDivider: false,
        })}

        {/* CAMBIAR CONTRASENA section */}
        {renderSectionHeader("CAMBIAR CONTRASENA")}

        {renderPasswordInput(
          "Contrasena actual",
          currentPassword,
          setCurrentPassword,
          showCurrent,
          () => setShowCurrent(!showCurrent)
        )}

        {renderPasswordInput(
          "Nueva contrasena",
          newPassword,
          setNewPassword,
          showNew,
          () => setShowNew(!showNew)
        )}

        {renderPasswordInput(
          "Confirmar nueva contrasena",
          confirmPassword,
          setConfirmPassword,
          showConfirm,
          () => setShowConfirm(!showConfirm)
        )}

        {/* Change password button */}
        <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
          <AnimatedPressable
            onPress={handleChangePassword}
            haptic="medium"
            disabled={changing}
          >
            <View
              style={{
                height: 44,
                borderRadius: 12,
                backgroundColor: text,
                justifyContent: "center",
                alignItems: "center",
                opacity: changing ? 0.5 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  fontFamily: fonts.semiBold,
                  color: bg,
                }}
              >
                {changing ? "Cambiando..." : "Cambiar contrasena"}
              </Text>
            </View>
          </AnimatedPressable>
        </View>

        {/* SESION section */}
        {renderSectionHeader("SESION")}

        {renderMenuItem("log-out-outline", "Cerrar todas las sesiones", {
          subtitle: "Cierra sesion en todos los dispositivos",
          onPress: handleLogoutAll,
          showDivider: false,
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
