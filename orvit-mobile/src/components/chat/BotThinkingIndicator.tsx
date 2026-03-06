import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  type SharedValue,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Minimal thinking indicator — 3 dots that fade in/out sequentially.
 * Inspired by ChatGPT's subtle pulsing dots.
 */
export default function BotThinkingIndicator() {
  const { isDark } = useTheme();

  const o1 = useSharedValue(0.2);
  const o2 = useSharedValue(0.2);
  const o3 = useSharedValue(0.2);

  useEffect(() => {
    const pulse = (sv: SharedValue<number>, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          -1,
          true
        )
      );
    };
    pulse(o1, 0);
    pulse(o2, 200);
    pulse(o3, 400);
  }, []);

  const s1 = useAnimatedStyle(() => ({ opacity: o1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: o2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: o3.value }));

  const dotColor = isDark ? "#555555" : "#A3A3A3";

  const dot = {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: dotColor,
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 16,
        paddingVertical: 10,
      }}
    >
      <Animated.View style={[dot, s1]} />
      <Animated.View style={[dot, s2]} />
      <Animated.View style={[dot, s3]} />
    </View>
  );
}
