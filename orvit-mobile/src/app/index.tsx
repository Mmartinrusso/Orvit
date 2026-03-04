import { useEffect } from "react";
import { Redirect } from "expo-router";
import { View } from "react-native";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCreateStyles } from "@/hooks/useCreateStyles";

export default function Index() {
  const { isLoading, isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const styles = useCreateStyles((c, t, s, r) => ({
    container: {
      flex: 1,
      backgroundColor: c.bg,
      justifyContent: "center",
      alignItems: "center",
    },
    brandText: {
      ...t.title,
      fontSize: 36,
      color: c.primary,
      letterSpacing: 6,
    },
    pulseBar: {
      width: 40,
      height: 3,
      borderRadius: r.full,
      backgroundColor: c.primary,
      marginTop: s.lg,
    },
  }));

  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Animated.Text entering={FadeIn.duration(600)} style={styles.brandText}>
          ORVIT
        </Animated.Text>
        <Animated.View style={[styles.pulseBar, pulseStyle]} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)/inbox" />;
}
