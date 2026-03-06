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
  TouchableOpacity,
  Modal,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { fonts } from "@/lib/fonts";
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

  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Ingresa email y contrasena");
      return;
    }
    setIsLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)/inbox");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al iniciar sesion";
      Alert.alert("Error", message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!forgotEmail.trim()) {
      Alert.alert("Error", "Ingresa tu email");
      return;
    }
    setForgotLoading(true);
    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      // Always show success (don't reveal if email exists)
      Alert.alert(
        "Email enviado",
        "Si el email esta registrado, vas a recibir un enlace para restablecer tu contrasena.",
        [{ text: "Volver al login", onPress: () => setForgotMode(false) }]
      );
    } catch {
      Alert.alert("Error", "No se pudo enviar el email. Intenta de nuevo.");
    } finally {
      setForgotLoading(false);
    }
  }

  // m6 palette colors
  const bgColor = isDark ? "#0A0A0A" : "#FFFFFF";
  const logoBg = isDark ? "#FFFFFF" : "#0A0A0A";
  const logoText = isDark ? "#0A0A0A" : "#FFFFFF";
  const titleColor = isDark ? "#E5E5E5" : "#0A0A0A";
  const subtitleColor = isDark ? "#555555" : "#737373";
  const labelColor = isDark ? "#A3A3A3" : "#737373";
  const inputBg = isDark ? "#171717" : "#FAFAFA";
  const inputBorder = isDark ? "#262626" : "#E5E5E5";
  const inputBorderFocused = isDark ? "#555555" : "#A3A3A3";
  const inputText = isDark ? "#E5E5E5" : "#0A0A0A";
  const placeholderColor = isDark ? "#404040" : "#A3A3A3";
  const iconColor = isDark ? "#555555" : "#A3A3A3";
  const eyeIconColor = isDark ? "#404040" : "#A3A3A3";
  const forgotColor = isDark ? "#555555" : "#737373";
  const btnBg = isDark ? "#FFFFFF" : "#0A0A0A";
  const btnText = isDark ? "#0A0A0A" : "#FFFFFF";
  const dividerColor = isDark ? "#262626" : "#E5E5E5";
  const dividerTextColor = isDark ? "#404040" : "#A3A3A3";
  const ssoTextColor = isDark ? "#A3A3A3" : "#737373";
  const ssoBorder = isDark ? "#262626" : "#E5E5E5";
  const ssoIconColor = isDark ? "#A3A3A3" : "#737373";
  const footerColor = isDark ? "#404040" : "#A3A3A3";

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
            {/* Logo */}
            <Animated.View
              entering={FadeInDown.delay(0).duration(500).springify()}
              style={{ alignItems: "center", marginBottom: 28 }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  backgroundColor: logoBg,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    fontFamily: fonts.extraBold,
                    color: logoText,
                    letterSpacing: -0.88,
                  }}
                >
                  m6
                </Text>
              </View>
            </Animated.View>

            {/* Title */}
            <Animated.View
              entering={FadeInDown.delay(80).duration(500).springify()}
              style={{ alignItems: "center", marginBottom: 6 }}
            >
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: "800",
                  fontFamily: fonts.extraBold,
                  color: titleColor,
                  letterSpacing: -0.72,
                  textAlign: "center",
                }}
              >
                Iniciar sesión
              </Text>
            </Animated.View>

            {/* Subtitle */}
            <Animated.View
              entering={FadeInDown.delay(140).duration(500).springify()}
              style={{ alignItems: "center", marginBottom: 40 }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "400",
                  fontFamily: fonts.regular,
                  color: subtitleColor,
                  textAlign: "center",
                }}
              >
                Ingresa tus credenciales.
              </Text>
            </Animated.View>

            {/* Email Label */}
            <Animated.View
              entering={FadeInDown.delay(200).duration(500).springify()}
              style={{ marginBottom: 6 }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  fontFamily: fonts.semiBold,
                  color: labelColor,
                }}
              >
                Email o usuario
              </Text>
            </Animated.View>

            {/* Email Input */}
            <Animated.View
              entering={FadeInDown.delay(220).duration(500).springify()}
              style={{ marginBottom: 16 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: emailFocused ? inputBorderFocused : inputBorder,
                  backgroundColor: inputBg,
                  paddingHorizontal: 14,
                  height: 44,
                  gap: 10,
                }}
              >
                <Ionicons name="mail-outline" size={18} color={iconColor} />
                <TextInput
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: "400",
                    fontFamily: fonts.regular,
                    color: inputText,
                    outlineStyle: "none",
                  } as any}
                  placeholder="usuario@empresa.com"
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

            {/* Password Label */}
            <Animated.View
              entering={FadeInDown.delay(260).duration(500).springify()}
              style={{ marginBottom: 6 }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  fontFamily: fonts.semiBold,
                  color: labelColor,
                }}
              >
                Contraseña
              </Text>
            </Animated.View>

            {/* Password Input */}
            <Animated.View
              entering={FadeInDown.delay(280).duration(500).springify()}
              style={{ marginBottom: 8 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: passwordFocused
                    ? inputBorderFocused
                    : inputBorder,
                  backgroundColor: inputBg,
                  paddingHorizontal: 14,
                  height: 44,
                  gap: 10,
                }}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={iconColor}
                />
                <TextInput
                  ref={passwordRef}
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: "400",
                    fontFamily: fonts.regular,
                    color: inputText,
                    outlineStyle: "none",
                  } as any}
                  placeholder="••••••••"
                  placeholderTextColor={placeholderColor}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={eyeIconColor}
                  />
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* Forgot Password */}
            <Animated.View
              entering={FadeInDown.delay(300).duration(500).springify()}
              style={{ alignItems: "flex-end", marginBottom: 24 }}
            >
              <AnimatedPressable
                onPress={() => {
                  setForgotEmail(email);
                  setForgotMode(true);
                }}
                haptic="light"
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "500",
                    fontFamily: fonts.medium,
                    color: forgotColor,
                    textAlign: "right",
                  }}
                >
                  Olvidaste tu contrasena?
                </Text>
              </AnimatedPressable>
            </Animated.View>

            {/* Sign In Button */}
            <Animated.View
              entering={FadeInDown.delay(340).duration(500).springify()}
              style={{ marginBottom: 20 }}
            >
              <AnimatedPressable
                onPress={handleLogin}
                disabled={isLoading}
                haptic="medium"
                style={{
                  backgroundColor: btnBg,
                  borderRadius: 10,
                  height: 44,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: isLoading ? 0.7 : 1,
                }}
              >
                {isLoading ? (
                  <ActivityIndicator color={btnText} />
                ) : (
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      fontFamily: fonts.semiBold,
                      color: btnText,
                    }}
                  >
                    Iniciar sesión
                  </Text>
                )}
              </AnimatedPressable>
            </Animated.View>

            {/* Divider */}
            <Animated.View
              entering={FadeInDown.delay(380).duration(500).springify()}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 20,
                gap: 14,
              }}
            >
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: dividerColor,
                }}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "500",
                  fontFamily: fonts.medium,
                  color: dividerTextColor,
                  letterSpacing: 1.32,
                  textTransform: "uppercase",
                }}
              >
                o
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: dividerColor,
                }}
              />
            </Animated.View>

            {/* SSO Button */}
            <Animated.View
              entering={FadeInDown.delay(420).duration(500).springify()}
            >
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: ssoBorder,
                  height: 44,
                  gap: 8,
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="key-outline" size={16} color={ssoIconColor} />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "500",
                    fontFamily: fonts.medium,
                    color: ssoTextColor,
                  }}
                >
                  Continuar con SSO
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <View style={{ height: 60 }} />
          </ScrollView>

          {/* Footer */}
          <View
            style={{
              alignItems: "center",
              paddingBottom: 16,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "400",
                fontFamily: fonts.regular,
                color: footerColor,
                textAlign: "center",
              }}
            >
              © 2025 m6
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Forgot Password Modal */}
      <Modal visible={forgotMode} animationType="slide">
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
                {/* Back */}
                <View style={{ position: "absolute", top: 16, left: 20 }}>
                  <AnimatedPressable onPress={() => setForgotMode(false)} haptic="light">
                    <Ionicons name="arrow-back" size={22} color={titleColor} />
                  </AnimatedPressable>
                </View>

                {/* Icon */}
                <View style={{ alignItems: "center", marginBottom: 28 }}>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: logoBg,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons name="key-outline" size={24} color={logoText} />
                  </View>
                </View>

                {/* Title */}
                <View style={{ alignItems: "center", marginBottom: 6 }}>
                  <Text
                    style={{
                      fontSize: 24,
                      fontWeight: "800",
                      fontFamily: fonts.extraBold,
                      color: titleColor,
                      letterSpacing: -0.72,
                      textAlign: "center",
                    }}
                  >
                    Restablecer contrasena
                  </Text>
                </View>

                {/* Subtitle */}
                <View style={{ alignItems: "center", marginBottom: 40 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: fonts.regular,
                      color: subtitleColor,
                      textAlign: "center",
                      lineHeight: 19,
                    }}
                  >
                    Ingresa tu email y te enviaremos un enlace para restablecer tu contrasena.
                  </Text>
                </View>

                {/* Email Label */}
                <View style={{ marginBottom: 6 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: fonts.semiBold,
                      color: labelColor,
                    }}
                  >
                    Email
                  </Text>
                </View>

                {/* Email Input */}
                <View style={{ marginBottom: 24 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: inputBorder,
                      backgroundColor: inputBg,
                      paddingHorizontal: 14,
                      height: 44,
                      gap: 10,
                    }}
                  >
                    <Ionicons name="mail-outline" size={18} color={iconColor} />
                    <TextInput
                      style={{
                        flex: 1,
                        fontSize: 13,
                        fontFamily: fonts.regular,
                        color: inputText,
                        outlineStyle: "none",
                      } as any}
                      placeholder="usuario@empresa.com"
                      placeholderTextColor={placeholderColor}
                      value={forgotEmail}
                      onChangeText={setForgotEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                    />
                  </View>
                </View>

                {/* Send Button */}
                <AnimatedPressable
                  onPress={handleForgotPassword}
                  disabled={forgotLoading}
                  haptic="medium"
                  style={{
                    backgroundColor: btnBg,
                    borderRadius: 10,
                    height: 44,
                    justifyContent: "center",
                    alignItems: "center",
                    opacity: forgotLoading ? 0.7 : 1,
                    marginBottom: 16,
                  }}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color={btnText} />
                  ) : (
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: fonts.semiBold,
                        color: btnText,
                      }}
                    >
                      Enviar enlace
                    </Text>
                  )}
                </AnimatedPressable>

                {/* Back to login link */}
                <AnimatedPressable
                  onPress={() => setForgotMode(false)}
                  haptic="light"
                  style={{ alignItems: "center" }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: fonts.medium,
                      color: forgotColor,
                    }}
                  >
                    Volver al login
                  </Text>
                </AnimatedPressable>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
