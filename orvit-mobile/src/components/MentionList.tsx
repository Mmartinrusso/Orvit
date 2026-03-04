import { View, Text, FlatList } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import Avatar from "@/components/ui/Avatar";

interface Member {
  userId: number;
  user: { id: number; name: string; avatar: string | null };
}

interface MentionListProps {
  members: Member[];
  filter: string;
  onSelect: (member: Member) => void;
}

export default function MentionList({
  members,
  filter,
  onSelect,
}: MentionListProps) {
  const { colors } = useTheme();
  const filtered = members.filter((m) =>
    m.user.name.toLowerCase().includes(filter.toLowerCase())
  );

  if (filtered.length === 0) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(200).springify()}
      style={{
        position: "absolute",
        bottom: "100%",
        left: 12,
        right: 12,
        backgroundColor: colors.bgSecondary,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        maxHeight: 200,
        marginBottom: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.userId)}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInUp.delay(index * 40).duration(200)}>
            <AnimatedPressable
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 10,
                borderRadius: 8,
                gap: 10,
              }}
              onPress={() => onSelect(item)}
              haptic="selection"
            >
              <Avatar name={item.user.name} size="sm" />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 14,
                  fontWeight: "500",
                }}
              >
                {item.user.name}
              </Text>
            </AnimatedPressable>
          </Animated.View>
        )}
        keyboardShouldPersistTaps="handled"
        style={{ padding: 4 }}
      />
    </Animated.View>
  );
}
