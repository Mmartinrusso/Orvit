import { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";

interface Props {
  names?: string[];
}

export default function TypingIndicator({ names = [] }: Props) {
  const { colors, isDark } = useTheme();
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const bounce = withRepeat(
      withSequence(
        withTiming(-5, { duration: 300 }),
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
    backgroundColor: isDark ? "rgba(233,237,239,0.4)" : "rgba(0,0,0,0.3)",
  };

  const label =
    names.length === 1
      ? `${names[0]} está escribiendo`
      : names.length === 2
      ? `${names[0]} y ${names[1]} están escribiendo`
      : names.length > 2
      ? `${names[0]} y ${names.length - 1} más están escribiendo`
      : "Escribiendo";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: colors.bubbleOtherBg,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 10,
          borderTopLeftRadius: 2,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDark ? 0.2 : 0.06,
          shadowRadius: 2,
          elevation: 1,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            color: isDark ? "rgba(233,237,239,0.6)" : "rgba(0,0,0,0.45)",
            fontStyle: "italic",
            marginRight: 4,
          }}
        >
          {label}
        </Text>
        <Animated.View style={[dotStyle, style1]} />
        <Animated.View style={[dotStyle, style2]} />
        <Animated.View style={[dotStyle, style3]} />
      </View>
    </View>
  );
}
