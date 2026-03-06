import { View, Text, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import { useTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/fonts";

interface Prompt {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  message: string;
}

const PROMPTS: Prompt[] = [
  {
    icon: "alert-circle-outline",
    label: "Reportar falla",
    message: "Quiero reportar una falla",
  },
  {
    icon: "checkbox-outline",
    label: "Crear tarea",
    message: "Necesito crear una tarea",
  },
  {
    icon: "bar-chart-outline",
    label: "Resumen del dia",
    message: "Dame un resumen del dia de hoy",
  },
  {
    icon: "construct-outline",
    label: "Estado de ordenes",
    message: "Cual es el estado de mis ordenes de trabajo?",
  },
];

interface Props {
  onSelect: (message: string) => void;
}

export default function BotSuggestedPrompts({ onSelect }: Props) {
  const { isDark } = useTheme();

  const chipBg = isDark ? "#151515" : "#F5F5F5";
  const chipBorder = isDark ? "#1F1F1F" : "#E5E5E5";
  const chipText = isDark ? "#A3A3A3" : "#555555";
  const chipIcon = isDark ? "#555555" : "#A3A3A3";

  return (
    <View style={{ paddingVertical: 8 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 12,
          gap: 8,
        }}
      >
        {PROMPTS.map((prompt) => (
          <AnimatedPressable
            key={prompt.label}
            onPress={() => onSelect(prompt.message)}
            haptic="light"
            scaleValue={0.95}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: chipBg,
              borderWidth: 1,
              borderColor: chipBorder,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Ionicons name={prompt.icon} size={14} color={chipIcon} />
            <Text
              style={{
                fontSize: 12,
                fontFamily: fonts.medium,
                color: chipText,
              }}
            >
              {prompt.label}
            </Text>
          </AnimatedPressable>
        ))}
      </ScrollView>
    </View>
  );
}
