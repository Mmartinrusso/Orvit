import { View, Text, StyleSheet, Image } from "react-native";
import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";
import { avatarSizes } from "@/lib/theme";

interface Props {
  name: string;
  size?: keyof typeof avatarSizes;
  imageUrl?: string | null;
  showOnline?: boolean;
  isOnline?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#06b6d4",
    "#3b82f6",
    "#f97316",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function OnlineDot({ size }: { size: number }) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const dotSize = Math.max(size * 0.28, 10);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.2, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View
      style={[
        styles.onlineContainer,
        {
          width: dotSize + 4,
          height: dotSize + 4,
          borderRadius: (dotSize + 4) / 2,
          backgroundColor: colors.bg,
          bottom: -1,
          right: -1,
        },
      ]}
    >
      <Animated.View
        style={[
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: colors.online,
          },
          pulseStyle,
        ]}
      />
    </View>
  );
}

export default function Avatar({
  name,
  size = "md",
  imageUrl,
  showOnline = false,
  isOnline = false,
}: Props) {
  const { colors } = useTheme();
  const px = avatarSizes[size];
  const fontSize = px * 0.38;
  const bgColor = getAvatarColor(name);

  return (
    <View style={{ width: px, height: px }}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{
            width: px,
            height: px,
            borderRadius: px / 2,
          }}
        />
      ) : (
        <View
          style={{
            width: px,
            height: px,
            borderRadius: px / 2,
            backgroundColor: bgColor,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize,
              fontWeight: "700",
              letterSpacing: 0.5,
            }}
          >
            {getInitials(name)}
          </Text>
        </View>
      )}
      {showOnline && isOnline && <OnlineDot size={px} />}
    </View>
  );
}

const styles = StyleSheet.create({
  onlineContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
});
