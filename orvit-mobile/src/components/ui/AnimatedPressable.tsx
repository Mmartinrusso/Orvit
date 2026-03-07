import { useCallback } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Pressable } from "react-native";
import { useHaptics } from "@/hooks/useHaptics";

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  onPressIn?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: "light" | "medium" | "selection" | "none";
  scaleValue?: number;
}

export default function AnimatedPressable({
  children,
  onPress,
  onPressIn,
  onLongPress,
  style,
  disabled,
  haptic = "light",
  scaleValue = 0.97,
}: Props) {
  const scale = useSharedValue(1);
  const haptics = useHaptics();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(scaleValue, { damping: 15, stiffness: 200 });
    onPressIn?.();
  }, [scaleValue, onPressIn]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  }, []);

  const handlePress = useCallback(() => {
    if (haptic !== "none") {
      if (haptic === "selection") haptics.selection();
      else if (haptic === "medium") haptics.medium();
      else haptics.light();
    }
    onPress?.();
  }, [haptic, onPress]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      onLongPress={onLongPress}
      disabled={disabled}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
