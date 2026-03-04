import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCreateStyles } from "@/hooks/useCreateStyles";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import { router } from "expo-router";

export default function LoginScreen() {
  const { login } = useAuth();
  const { colors } = useTheme();
  const styles = useCreateStyles((c, t, s, r) => ({
    gradient: {
      flex: 1,
    },
    inner: {
      flex: 1,
      justifyContent: "center" as const,
      paddingHorizontal: s.xxxl,
    },
    title: {
      ...t.title,
      fontSize: 36,
      color: c.primary,
      textAlign: "center" as const,
      letterSpacing: 6,
      marginBottom: s.xs,
    },
    subtitle: {
      ...t.body,
      color: c.textMuted,
      textAlign: "center" as const,
      marginBottom: 40,
    },
    inputContainer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: c.bgInput,
      borderRadius: r.md,
      borderWidth: 1,
      marginBottom: s.lg,
      paddingHorizontal: s.lg,
    },
    inputIcon: {
      marginRight: s.md,
    },
    input: {
      flex: 1,
      paddingVertical: s.lg,
      ...t.body,
      color: c.textPrimary,
    },
    button: {
      backgroundColor: c.primary,
      borderRadius: r.md,
      paddingVertical: s.lg,
      alignItems: "center" as const,
      marginTop: s.sm,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      ...t.subheading,
      color: "#ffffff",
    },
  }));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

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

  return (
    <LinearGradient
      colors={[colors.bgSecondary, colors.bg]}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.inner}>
          <Animated.Text
            entering={FadeInDown.delay(0).duration(400).springify()}
            style={styles.title}
          >
            ORVIT
          </Animated.Text>

          <Animated.Text
            entering={FadeInDown.delay(100).duration(400).springify()}
            style={styles.subtitle}
          >
            Chat Empresarial
          </Animated.Text>

          <Animated.View
            entering={FadeInDown.delay(200).duration(400).springify()}
          >
            <View
              style={[
                styles.inputContainer,
                {
                  borderColor: emailFocused
                    ? colors.primary
                    : colors.border,
                },
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color={emailFocused ? colors.primary : colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(300).duration(400).springify()}
          >
            <View
              style={[
                styles.inputContainer,
                {
                  borderColor: passwordFocused
                    ? colors.primary
                    : colors.border,
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={passwordFocused ? colors.primary : colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Contraseña"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(400).duration(400).springify()}
          >
            <AnimatedPressable
              onPress={handleLogin}
              disabled={isLoading}
              haptic="medium"
              style={[
                styles.button,
                isLoading && styles.buttonDisabled,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Iniciar sesión</Text>
              )}
            </AnimatedPressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
