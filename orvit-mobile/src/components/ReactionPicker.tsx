import { View, Text } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import BottomSheet from "@/components/ui/BottomSheet";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import { useTheme } from "@/contexts/ThemeContext";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🙏"];

interface ReactionPickerProps {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function ReactionPicker({
  visible,
  onSelect,
  onClose,
}: ReactionPickerProps) {
  const { colors } = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose} height={140}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 4,
          paddingHorizontal: 16,
        }}
      >
        {QUICK_EMOJIS.map((emoji, i) => (
          <Animated.View key={emoji} entering={FadeIn.delay(i * 40).duration(200)}>
            <AnimatedPressable
              style={{
                width: 52,
                height: 52,
                justifyContent: "center",
                alignItems: "center",
                borderRadius: 14,
              }}
              onPress={() => {
                onSelect(emoji);
                onClose();
              }}
              haptic="light"
            >
              <Text style={{ fontSize: 28 }}>{emoji}</Text>
            </AnimatedPressable>
          </Animated.View>
        ))}
      </View>
    </BottomSheet>
  );
}
