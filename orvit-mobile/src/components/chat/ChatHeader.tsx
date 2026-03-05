import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import Avatar from "@/components/ui/Avatar";

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

  const headerBg = colors.chatHeaderBg;
  const headerText = colors.textPrimary;
  const headerSubtext = colors.textMuted;

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

  return (
    <View
      style={{
        backgroundColor: headerBg,
        paddingTop: 4,
        paddingBottom: 8,
        paddingHorizontal: 6,
        flexDirection: "row",
        alignItems: "center",
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
          width: 36,
          height: 44,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Ionicons name="arrow-back-outline" size={22} color={headerText} />
      </AnimatedPressable>

      {/* Avatar + Title — takes all remaining space */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/chat-info/${conversationId}`)}
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          marginLeft: 2,
          gap: 10,
        }}
      >
        {isOrvitBot ? (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "#3b82f6",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons name="sparkles-outline" size={20} color="#fff" />
          </View>
        ) : isGroup ? (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons name="people-outline" size={20} color={headerText} />
          </View>
        ) : (
          <Avatar name={title} size="sm" />
        )}
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontSize: 15, fontWeight: "600", color: headerText }}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: hasTyping ? "#25D366" : headerSubtext,
              fontStyle: hasTyping ? "italic" : "normal",
            }}
            numberOfLines={1}
          >
            {statusText}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Search — always at far right */}
      <TouchableOpacity
        onPress={onSearchPress}
        disabled={!onSearchPress}
        activeOpacity={0.6}
        style={{
          width: 44,
          height: 44,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {onSearchPress && (
          <Ionicons name="search-outline" size={20} color={headerText} />
        )}
      </TouchableOpacity>
    </View>
  );
}
