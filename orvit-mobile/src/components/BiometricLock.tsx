import { useState, useEffect, useCallback } from "react";
import { View, Text, AppState, AppStateStatus } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { getValue } from "@/lib/storage";
import { fonts } from "@/lib/fonts";
import AnimatedPressable from "@/components/ui/AnimatedPressable";

const BIOMETRIC_KEY = "orvit_biometric_enabled";

export default function BiometricLock() {
  const { isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const [locked, setLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const bg = isDark ? "#0A0A0A" : "#FFFFFF";
  const text = isDark ? "#E5E5E5" : "#0A0A0A";
  const textMuted = isDark ? "#555555" : "#A3A3A3";

  // Check if biometric is enabled
  useEffect(() => {
    getValue(BIOMETRIC_KEY).then((val) => {
      setBiometricEnabled(val === "true");
    });
  }, []);

  // Listen for app state changes
  useEffect(() => {
    if (!biometricEnabled || !isAuthenticated) return;

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === "background" || nextState === "inactive") {
        setLocked(true);
      }
    };

    const sub = AppState.addEventListener("change", handleAppState);
    return () => sub.remove();
  }, [biometricEnabled, isAuthenticated]);

  const authenticate = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Desbloquear m6",
        fallbackLabel: "Usar contrasena",
        disableDeviceFallback: false,
      });
      if (result.success) {
        setLocked(false);
      }
    } catch {
      // Silently fail — user can retry
    }
  }, []);

  // Auto-authenticate when locked
  useEffect(() => {
    if (locked) {
      authenticate();
    }
  }, [locked, authenticate]);

  if (!locked || !biometricEnabled || !isAuthenticated) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: bg,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        gap: 20,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: isDark ? "#171717" : "#FAFAFA",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Ionicons name="lock-closed" size={32} color={text} />
      </View>

      <Text
        style={{
          fontSize: 18,
          fontFamily: fonts.bold,
          color: text,
          letterSpacing: -0.3,
        }}
      >
        m6 bloqueado
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
        Usa Face ID o huella para desbloquear
      </Text>

      <AnimatedPressable
        onPress={authenticate}
        haptic="light"
        style={{
          marginTop: 12,
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: text,
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontFamily: fonts.semiBold,
            color: bg,
          }}
        >
          Desbloquear
        </Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

export { BIOMETRIC_KEY };
