import { useState, useEffect } from "react";
import { View, Text, ScrollView, Alert, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { useTheme } from "@/contexts/ThemeContext";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import { router } from "expo-router";
import { fonts } from "@/lib/fonts";
import { getValue, storeValue } from "@/lib/storage";
import { BIOMETRIC_KEY } from "@/components/BiometricLock";

type IoniconsName = keyof typeof Ionicons.glyphMap;

export default function PrivacyScreen() {
  const { isDark } = useTheme();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState("");

  // ── m6 colors ──────────────────────────────────────────────
  const bg = isDark ? "#0A0A0A" : "#FFFFFF";
  const surface = isDark ? "#171717" : "#FAFAFA";
  const text = isDark ? "#E5E5E5" : "#0A0A0A";
  const textMuted = isDark ? "#555555" : "#A3A3A3";
  const textDim = isDark ? "#404040" : "#737373";
  const sectionColor = isDark ? "#333333" : "#A3A3A3";
  const divider = isDark ? "#111111" : "#F0F0F0";

  // Check biometric availability on mount
  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);

      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType("Face ID");
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType("Huella digital");
      } else {
        setBiometricType("Biometrico");
      }

      const stored = await getValue(BIOMETRIC_KEY);
      setBiometricEnabled(stored === "true");
    })();
  }, []);

  async function handleToggleBiometric(value: boolean) {
    if (value) {
      // Verify identity before enabling
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Verificar identidad para activar bloqueo",
        fallbackLabel: "Usar contrasena",
      });
      if (!result.success) return;
    }
    setBiometricEnabled(value);
    await storeValue(BIOMETRIC_KEY, value ? "true" : "false");
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
          style={{ height: 1, backgroundColor: divider, marginLeft: 66 }}
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={["top"]}>
      {/* Header */}
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
          Privacidad
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Visibilidad Section */}
        {renderSectionHeader("VISIBILIDAD")}

        {renderMenuItem("time-outline", "Ultima conexion", {
          subtitle: "Quien puede ver tu ultima conexion",
          trailing: (
            <Text style={{ fontSize: 13, fontFamily: fonts.regular, color: textMuted }}>
              Todos
            </Text>
          ),
        })}

        {renderMenuItem("person-circle-outline", "Foto de perfil", {
          subtitle: "Quien puede ver tu foto",
          trailing: (
            <Text style={{ fontSize: 13, fontFamily: fonts.regular, color: textMuted }}>
              Todos
            </Text>
          ),
        })}

        {renderMenuItem("chatbubble-ellipses-outline", "Info (estado)", {
          subtitle: "Quien puede ver tu estado",
          showDivider: false,
          trailing: (
            <Text style={{ fontSize: 13, fontFamily: fonts.regular, color: textMuted }}>
              Todos
            </Text>
          ),
        })}

        {/* Seguridad Section */}
        {renderSectionHeader("SEGURIDAD")}

        {renderMenuItem("shield-checkmark-outline", "Verificacion en dos pasos", {
          subtitle: "No activada",
          onPress: () => Alert.alert("Proximamente", "Esta funcionalidad estara disponible pronto."),
        })}

        {renderMenuItem(
          "finger-print-outline",
          `Bloqueo con ${biometricType || "biometrico"}`,
          {
            subtitle: biometricEnabled
              ? "Activado"
              : biometricAvailable
                ? "No activado"
                : "No disponible en este dispositivo",
            trailing: biometricAvailable ? (
              <Switch
                value={biometricEnabled}
                onValueChange={handleToggleBiometric}
                trackColor={{ false: "#333333", true: "#FFFFFF" }}
                thumbColor={isDark ? "#0A0A0A" : "#FFFFFF"}
                ios_backgroundColor="#333333"
                style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
              />
            ) : (
              <Ionicons name="close-circle-outline" size={18} color={textMuted} />
            ),
            showDivider: false,
          }
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
