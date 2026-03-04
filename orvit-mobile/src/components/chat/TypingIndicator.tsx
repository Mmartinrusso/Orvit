import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";

export default function TypingIndicator() {
  const { colors } = useTheme();
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const bounce = withRepeat(
      withSequence(
        withTiming(-6, { duration: 300 }),
        withTiming(0, { duration: 300 })
      ),
      -1
    );

    dot1.value = bounce;
    dot2.value = withDelay(150, bounce);
    dot3.value = withDelay(300, bounce);
  }, []);

  const style1 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot1.value }],
  }));
  const style2 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot2.value }],
  }));
  const style3 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot3.value }],
  }));

  const dotStyle = {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.textMuted,
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: colors.bgSecondary,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 16,
          borderBottomLeftRadius: 4,
        }}
      >
        <Animated.View style={[dotStyle, style1]} />
        <Animated.View style={[dotStyle, style2]} />
        <Animated.View style={[dotStyle, style3]} />
      </View>
    </View>
  );
}
