import { View, Text } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";
import { useCreateStyles } from "@/hooks/useCreateStyles";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import Avatar from "@/components/ui/Avatar";

interface Props {
  title: string;
  conversationId: string;
}

export default function ChatHeader({ title, conversationId }: Props) {
  const { colors } = useTheme();
  const styles = useCreateStyles((c, t, s) => ({
    container: {
      paddingHorizontal: s.lg,
      paddingVertical: s.md,
    },
    row: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: s.md,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.bgTertiary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    titleRow: {
      flex: 1,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: s.md,
    },
    titleContainer: { flex: 1 },
    title: { ...t.subheading, color: c.textPrimary },
    subtitle: { ...t.tiny, color: c.textMuted, marginTop: 1 },
    infoBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.bgTertiary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
  }));

  return (
    <LinearGradient
      colors={[colors.headerGradientStart, colors.headerGradientEnd]}
    >
      <View style={styles.container}>
        <View style={styles.row}>
          <AnimatedPressable
            onPress={() => router.back()}
            style={styles.backButton}
            haptic="light"
          >
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
          </AnimatedPressable>

          <AnimatedPressable
            style={styles.titleRow}
            onPress={() => router.push(`/chat-info/${conversationId}`)}
            haptic="light"
          >
            <Avatar name={title} size="sm" />
            <View style={styles.titleContainer}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.subtitle}>en linea</Text>
            </View>
          </AnimatedPressable>

          <AnimatedPressable
            style={styles.infoBtn}
            onPress={() => router.push(`/chat-info/${conversationId}`)}
            haptic="light"
          >
            <Ionicons
              name="ellipsis-vertical"
              size={18}
              color={colors.textSecondary}
            />
          </AnimatedPressable>
        </View>
      </View>
    </LinearGradient>
  );
}
