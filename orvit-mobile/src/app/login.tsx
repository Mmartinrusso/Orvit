import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const { login } = useAuth();
  const { colors, isDark } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Ingresá email y contraseña");
      return;
    }
    setIsLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)/inbox");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al iniciar sesión";
      Alert.alert("Error", message);
    } finally {
      setIsLoading(false);
    }
  }

  // Adaptive colors
  const bgColor = isDark ? "#000000" : "#ffffff";
  const inputBorderColor = isDark
    ? "rgba(255, 255, 255, 0.15)"
    : "rgba(0, 0, 0, 0.15)";
  const inputFocusBorder = isDark
    ? "rgba(255, 255, 255, 0.4)"
    : "rgba(0, 0, 0, 0.4)";
  const inputText = isDark ? "#ffffff" : "#000000";
  const placeholderColor = isDark
    ? "rgba(255, 255, 255, 0.35)"
    : "rgba(0, 0, 0, 0.35)";
  const headingColor = isDark ? "#ffffff" : "#000000";
  const subtitleColor = isDark
    ? "rgba(255, 255, 255, 0.5)"
    : "rgba(0, 0, 0, 0.45)";
  const mutedColor = isDark
    ? "rgba(255, 255, 255, 0.4)"
    : "rgba(0, 0, 0, 0.4)";
  const dividerColor = isDark
    ? "rgba(255, 255, 255, 0.08)"
    : "rgba(0, 0, 0, 0.08)";

  // Button colors
  const primaryBtnBg = isDark ? "#ffffff" : "#000000";
  const primaryBtnText = isDark ? "#000000" : "#ffffff";

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              paddingHorizontal: 32,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo placeholder — reemplazar con imagen después */}
            <View style={{ height: 60, marginBottom: 16 }} />

            {/* Heading */}
            <Animated.View
              entering={FadeInDown.delay(80).duration(500).springify()}
              style={{ alignItems: "center", marginBottom: 8 }}
            >
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: "700",
                  color: headingColor,
                  letterSpacing: -0.5,
                }}
              >
                Bienvenido
              </Text>
            </Animated.View>

            {/* Subtitle */}
            <Animated.View
              entering={FadeInDown.delay(140).duration(500).springify()}
              style={{ alignItems: "center", marginBottom: 40 }}
            >
              <Text
                style={{
                  fontSize: 15,
                  color: subtitleColor,
                  letterSpacing: 0.1,
                }}
              >
                Ingresá a tu cuenta de ORVIT
              </Text>
            </Animated.View>

            {/* Email Input */}
            <Animated.View
              entering={FadeInDown.delay(200).duration(500).springify()}
              style={{ marginBottom: 14 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: emailFocused ? inputFocusBorder : inputBorderColor,
                  paddingHorizontal: 18,
                  height: 54,
                }}
              >
                <TextInput
                  style={{
                    flex: 1,
                    fontSize: 16,
                    color: inputText,
                    letterSpacing: 0.1,
                    outlineStyle: "none",
                  } as any}
                  placeholder="Tu email"
                  placeholderTextColor={placeholderColor}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>
            </Animated.View>

            {/* Password Input */}
            <Animated.View
              entering={FadeInDown.delay(260).duration(500).springify()}
              style={{ marginBottom: 16 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: passwordFocused
                    ? inputFocusBorder
                    : inputBorderColor,
                  paddingHorizontal: 18,
                  height: 54,
                }}
              >
                <TextInput
                  ref={passwordRef}
                  style={{
                    flex: 1,
                    fontSize: 16,
                    color: inputText,
                    letterSpacing: 0.1,
                    outlineStyle: "none",
                  } as any}
                  placeholder="Tu contraseña"
                  placeholderTextColor={placeholderColor}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <AnimatedPressable
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={12}
                  style={{ padding: 4 }}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={mutedColor}
                  />
                </AnimatedPressable>
              </View>
            </Animated.View>

            {/* Forgot password */}
            <Animated.View
              entering={FadeInDown.delay(300).duration(500).springify()}
              style={{ alignItems: "center", marginBottom: 32 }}
            >
              <Text style={{ fontSize: 14, color: mutedColor }}>
                ¿Olvidaste tu contraseña?
              </Text>
            </Animated.View>

            {/* Sign In Button */}
            <Animated.View
              entering={FadeInDown.delay(360).duration(500).springify()}
            >
              <AnimatedPressable
                onPress={handleLogin}
                disabled={isLoading}
                haptic="medium"
                style={{
                  backgroundColor: primaryBtnBg,
                  borderRadius: 50,
                  height: 54,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: isLoading ? 0.7 : 1,
                }}
              >
                {isLoading ? (
                  <ActivityIndicator color={primaryBtnText} />
                ) : (
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: primaryBtnText,
                      letterSpacing: 0.2,
                    }}
                  >
                    Iniciar sesión
                  </Text>
                )}
              </AnimatedPressable>
            </Animated.View>

            {/* Bottom spacer inside scroll */}

            {/* Bottom spacer */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
