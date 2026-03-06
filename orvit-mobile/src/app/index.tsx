import { useEffect } from "react";
import { Redirect } from "expo-router";
import { View, Text } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/fonts";

export default function Index() {
  const { isLoading, isAuthenticated } = useAuth();
  const { isDark } = useTheme();

  const bg = isDark ? "#0A0A0A" : "#FFFFFF";
  const text = isDark ? "#E5E5E5" : "#0A0A0A";
  const textDim = isDark ? "#262626" : "#D4D4D4";

  // Pulse animation for loading bar
  const barWidth = useSharedValue(0);
  const barOpacity = useSharedValue(0.4);

  useEffect(() => {
    barWidth.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    barOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const barStyle = useAnimatedStyle(() => ({
    width: 20 + barWidth.value * 24,
    opacity: barOpacity.value,
  }));

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: bg,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Logo box */}
        <Animated.View
          entering={FadeIn.duration(400)}
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            backgroundColor: text,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 24,
              fontFamily: fonts.extraBold,
              fontWeight: "800",
              color: bg,
              letterSpacing: -0.96,
            }}
          >
            m6
          </Text>
        </Animated.View>

        {/* Loading bar */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(400)}
          style={{
            height: 3,
            borderRadius: 1.5,
            backgroundColor: textDim,
            overflow: "hidden",
            marginTop: 8,
          }}
        >
          <Animated.View
            style={[
              {
                height: 3,
                borderRadius: 1.5,
                backgroundColor: text,
              },
              barStyle,
            ]}
          />
        </Animated.View>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)/inbox" />;
}
