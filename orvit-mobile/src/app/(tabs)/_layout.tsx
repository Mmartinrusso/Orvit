import { Tabs } from "expo-router";
import { Platform, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";

function TabIcon({
  name,
  outlineName,
  label,
  focused,
  activeColor,
  inactiveColor,
  size = 26,
  badge,
}: {
  name: keyof typeof Ionicons.glyphMap;
  outlineName: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
  activeColor: string;
  inactiveColor: string;
  size?: number;
  badge?: number;
}) {
  const color = focused ? activeColor : inactiveColor;
  const showBadge = badge != null && badge > 0;
  const badgeText = badge && badge > 99 ? "99+" : String(badge);

  return (
    <View style={{ alignItems: "center", justifyContent: "center", gap: 2, minHeight: 44 }}>
      <View>
        <Ionicons name={focused ? name : outlineName} size={size} color={color} />
        {showBadge && (
          <View
            style={{
              position: "absolute",
              top: -5,
              right: -14,
              backgroundColor: "#ef4444",
              borderRadius: 9,
              minWidth: 18,
              height: 18,
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: 4,
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 10,
                fontWeight: "700",
                lineHeight: 13,
              }}
            >
              {badgeText}
            </Text>
          </View>
        )}
      </View>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "600",
          color,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const { colors, isDark } = useTheme();

  const inactiveColor = isDark ? "rgba(255,255,255,0.5)" : "#8696a0";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarBadgeStyle: { display: "none" },
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 0.5,
          height: Platform.OS === "web" ? 68 : 90,
          paddingTop: 10,
          paddingBottom: Platform.OS === "web" ? 8 : 28,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: isDark ? 0.4 : 0.12,
          shadowRadius: 12,
        },
        tabBarItemStyle: {
          justifyContent: "center" as const,
          alignItems: "center" as const,
        },
      }}
    >
      <Tabs.Screen
        name="inbox"
        options={({ route }: any) => ({
          title: "Chats",
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon
              name="chatbubbles"
              outlineName="chatbubbles-outline"
              label="Chats"
              focused={focused}
              activeColor={colors.primary}
              inactiveColor={inactiveColor}
              badge={route.params?.unreadBadge}
            />
          ),
        })}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Tú",
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="person-circle"
              outlineName="person-circle-outline"
              label="Tú"
              focused={focused}
              activeColor={colors.primary}
              inactiveColor={inactiveColor}
              size={28}
            />
          ),
        }}
      />
      {/* Hide agenda tab */}
      <Tabs.Screen
        name="agenda"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
