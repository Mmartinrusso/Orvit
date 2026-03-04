import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { ViewStyle, StyleProp } from "react-native";

interface Props {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  direction?: "up" | "down";
  style?: StyleProp<ViewStyle>;
}

export default function AnimatedFadeIn({
  children,
  delay = 0,
  duration = 300,
  direction = "down",
  style,
}: Props) {
  const entering =
    direction === "down"
      ? FadeInDown.delay(delay).duration(duration).springify()
      : FadeInUp.delay(delay).duration(duration).springify();

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
