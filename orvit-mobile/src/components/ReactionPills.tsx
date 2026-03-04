import { View, Text } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import { useTheme } from "@/contexts/ThemeContext";

interface ReactionGroup {
  emoji: string;
  count: number;
  users: { id: number; name: string }[];
}

interface ReactionPillsProps {
  reactions: ReactionGroup[];
  userId: number;
  onToggle: (emoji: string) => void;
  isMe?: boolean;
}

export default function ReactionPills({
  reactions,
  userId,
  onToggle,
  isMe,
}: ReactionPillsProps) {
  const { colors } = useTheme();

  if (!reactions || reactions.length === 0) return null;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
      {reactions.map((r) => {
        const isMine = r.users.some((u) => u.id === userId);
        return (
          <Animated.View key={r.emoji} entering={FadeIn.springify()}>
            <AnimatedPressable
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: isMine
                  ? colors.primaryBg
                  : isMe
                  ? "rgba(255,255,255,0.12)"
                  : colors.bgTertiary,
                borderRadius: 12,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderWidth: 1,
                borderColor: isMine
                  ? colors.primary
                  : isMe
                  ? "rgba(255,255,255,0.15)"
                  : colors.border,
                gap: 4,
              }}
              onPress={() => onToggle(r.emoji)}
              haptic="selection"
              scaleValue={0.9}
            >
              <Text style={{ fontSize: 14 }}>{r.emoji}</Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: isMine
                    ? colors.primary
                    : isMe
                    ? "rgba(255,255,255,0.7)"
                    : colors.textSecondary,
                }}
              >
                {r.count}
              </Text>
            </AnimatedPressable>
          </Animated.View>
        );
      })}
    </View>
  );
}
