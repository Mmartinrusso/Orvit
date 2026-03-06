import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/fonts";

/**
 * Welcome/onboarding card shown when bot chat has no messages.
 * Explains what the bot can do with clean m6 styling.
 */
export default function BotWelcomeMessage() {
  const { isDark } = useTheme();

  const bgColor = isDark ? "#111111" : "#FAFAFA";
  const borderColor = isDark ? "#1F1F1F" : "#E5E5E5";
  const titleColor = isDark ? "#E5E5E5" : "#0A0A0A";
  const subtitleColor = isDark ? "#555555" : "#A3A3A3";
  const itemBg = isDark ? "#151515" : "#F5F5F5";
  const itemIcon = isDark ? "#404040" : "#A3A3A3";
  const itemText = isDark ? "#A3A3A3" : "#555555";
  const avatarBg = isDark ? "#FFFFFF" : "#0A0A0A";
  const avatarIcon = isDark ? "#0A0A0A" : "#FFFFFF";

  const capabilities: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: "mic-outline", text: "Envia audios para crear fallas, tareas o consultas" },
    { icon: "chatbubble-outline", text: "Escribi instrucciones o pedidos en texto" },
    { icon: "document-text-outline", text: "Pedi reportes y resumenes del dia" },
    { icon: "construct-outline", text: "Consulta el estado de ordenes de trabajo" },
  ];

  return (
    <View
      style={{
        alignItems: "center",
        paddingHorizontal: 24,
        paddingVertical: 32,
        transform: [{ scaleY: -1 }],
      }}
    >
      {/* Avatar */}
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: avatarBg,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Ionicons name="sparkles" size={26} color={avatarIcon} />
      </View>

      {/* Title */}
      <Text
        style={{
          fontSize: 18,
          fontFamily: fonts.bold,
          color: titleColor,
          letterSpacing: -0.3,
          marginBottom: 6,
        }}
      >
        M6 Assistant
      </Text>
      <Text
        style={{
          fontSize: 13,
          fontFamily: fonts.regular,
          color: subtitleColor,
          textAlign: "center",
          marginBottom: 24,
          maxWidth: 260,
          lineHeight: 18,
        }}
      >
        Tu asistente de M6. Preguntame lo que necesites.
      </Text>

      {/* Capabilities */}
      <View
        style={{
          width: "100%",
          backgroundColor: bgColor,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: borderColor,
          overflow: "hidden",
        }}
      >
        {capabilities.map((cap, i) => (
          <View
            key={cap.text}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: i < capabilities.length - 1 ? 1 : 0,
              borderBottomColor: borderColor,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: itemBg,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name={cap.icon} size={16} color={itemIcon} />
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 12,
                fontFamily: fonts.regular,
                color: itemText,
                lineHeight: 17,
              }}
            >
              {cap.text}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
