import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import { fonts } from "@/lib/fonts";

interface Props {
  title: string;
  conversationId: string;
  subtitle?: string;
  isGroup?: boolean;
  isOrvitBot?: boolean;
  memberCount?: number;
  typingNames?: string[];
  onSearchPress?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ChatHeader({
  title,
  conversationId,
  subtitle,
  isGroup,
  isOrvitBot,
  memberCount,
  typingNames,
  onSearchPress,
}: Props) {
  const { colors, isDark } = useTheme();

  const hasTyping = typingNames && typingNames.length > 0;
  let statusText: string;
  if (hasTyping) {
    statusText =
      typingNames.length === 1
        ? `${typingNames[0]} escribiendo...`
        : `${typingNames[0]} y ${typingNames.length - 1} más escribiendo...`;
  } else {
    statusText =
      subtitle || (isGroup && memberCount ? `${memberCount} miembros` : "en línea");
  }

  // Online count for subtitle (reuse memberCount or default)
  const onlineText =
    subtitle || (isGroup && memberCount ? `${memberCount} miembros` : "en línea");

  return (
    <View
      style={{
        backgroundColor: colors.chatHeaderBg,
        borderBottomWidth: 1,
        borderBottomColor: colors.chatHeaderBorder,
        paddingHorizontal: 16,
        height: 51,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      {/* Back button */}
      <AnimatedPressable
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/(tabs)/inbox");
          }
        }}
        haptic="light"
        style={{
          width: 22,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
      </AnimatedPressable>

      {/* Avatar + Title — takes all remaining space */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/chat-info/${conversationId}`)}
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        {/* Avatar 32px */}
        {isOrvitBot ? (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: isDark ? "#FFFFFF" : "#000000",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons
              name="sparkles"
              size={16}
              color={isDark ? "#000000" : "#FFFFFF"}
            />
          </View>
        ) : (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: isDark ? "#1A1A1A" : "#F5F5F5",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: fonts.bold,
                fontSize: 11,
                color: "#737373",
              }}
            >
              {getInitials(title)}
            </Text>
          </View>
        )}

        {/* Title + subtitle */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 14,
              letterSpacing: -0.14,
              color: isDark ? "#E5E5E5" : colors.textPrimary,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 }}>
            {hasTyping ? (
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 10,
                  color: "#10B981",
                }}
                numberOfLines={1}
              >
                {statusText}
              </Text>
            ) : (
              <>
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: "#10B981",
                  }}
                />
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 10,
                    color: isDark ? "#404040" : "#A3A3A3",
                  }}
                  numberOfLines={1}
                >
                  {onlineText}
                </Text>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Ellipsis menu — far right */}
      <AnimatedPressable
        onPress={onSearchPress}
        haptic="light"
        style={{
          width: 22,
          height: 44,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
      </AnimatedPressable>
    </View>
  );
}
