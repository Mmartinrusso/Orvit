import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";
import AnimatedPressable from "@/components/ui/AnimatedPressable";

interface ReplyBarProps {
  senderName: string;
  content: string;
  type?: string;
  onClose: () => void;
}

export default function ReplyBar({
  senderName,
  content,
  type,
  onClose,
}: ReplyBarProps) {
  const { colors } = useTheme();

  const previewMap: Record<string, string> = {
    audio: "Audio",
    image: "Imagen",
    file: "Archivo",
  };
  const preview = previewMap[type || ""] || content;

  return (
    <Animated.View
      entering={FadeInDown.duration(200).springify()}
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: 12,
        marginBottom: 4,
        backgroundColor: colors.bgSecondary,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        paddingRight: 8,
      }}
    >
      <View
        style={{
          width: 3,
          alignSelf: "stretch",
          backgroundColor: colors.primary,
        }}
      />
      <View style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 6 }}>
        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>
          {senderName}
        </Text>
        <Text
          style={{ color: colors.textSecondary, fontSize: 13, marginTop: 1 }}
          numberOfLines={1}
        >
          {preview}
        </Text>
      </View>
      <AnimatedPressable onPress={onClose} haptic="light">
        <Ionicons name="close-circle" size={20} color={colors.textMuted} />
      </AnimatedPressable>
    </Animated.View>
  );
}
