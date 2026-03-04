import { View, Text } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import AnimatedPressable from "@/components/ui/AnimatedPressable";

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
}: ReactionPillsProps) {
  if (!reactions || reactions.length === 0) return null;

  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {reactions.map((r) => {
        const isMine = r.users.some((u) => u.id === userId);
        return (
          <Animated.View key={r.emoji} entering={FadeIn.springify()}>
            <AnimatedPressable
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#1a1a1e",
                borderRadius: 12,
                paddingHorizontal: r.count > 1 ? 6 : 5,
                paddingVertical: 2,
                gap: r.count > 1 ? 2 : 0,
                minWidth: 26,
                minHeight: 24,
                justifyContent: "center",
              }}
              onPress={() => onToggle(r.emoji)}
              haptic="selection"
              scaleValue={0.9}
            >
              <Text style={{ fontSize: 14 }}>{r.emoji}</Text>
              {r.count > 1 && (
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: isMine ? "#53bdeb" : "rgba(255,255,255,0.6)",
                  }}
                >
                  {r.count}
                </Text>
              )}
            </AnimatedPressable>
          </Animated.View>
        );
      })}
    </View>
  );
}
