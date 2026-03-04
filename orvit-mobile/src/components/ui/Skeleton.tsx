import { useEffect } from "react";
import { ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";

interface Props {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function Skeleton({
  width,
  height,
  borderRadius = 8,
  style,
}: Props) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: colors.skeleton,
        },
        style,
        animatedStyle,
      ]}
    />
  );
}

export function SkeletonConversation() {
  const { colors } = useTheme();
  return (
    <Animated.View
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Skeleton width={48} height={48} borderRadius={24} />
      <Animated.View style={{ flex: 1, gap: 8 }}>
        <Skeleton width={140} height={14} />
        <Skeleton width={200} height={12} />
      </Animated.View>
      <Skeleton width={40} height={10} />
    </Animated.View>
  );
}

export function SkeletonMessage({ isMe }: { isMe: boolean }) {
  return (
    <Animated.View
      style={{
        alignSelf: isMe ? "flex-end" : "flex-start",
        marginHorizontal: 16,
        marginVertical: 4,
      }}
    >
      <Skeleton
        width={isMe ? 180 : 220}
        height={44}
        borderRadius={16}
      />
    </Animated.View>
  );
}
