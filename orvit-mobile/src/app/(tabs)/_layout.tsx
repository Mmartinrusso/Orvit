import { Tabs } from "expo-router";
import { Platform, Text, View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/fonts";

function M6TabBar({ state, descriptors, navigation }: any) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 8 : Math.max(insets.bottom, 0);

  const bgColor = isDark ? "#0A0A0A" : "#FFFFFF";
  const borderColor = isDark ? "#1A1A1A" : "#E5E5E5";
  const activeColor = isDark ? "#FFFFFF" : "#0A0A0A";
  const inactiveColor = isDark ? "#404040" : "#A3A3A3";
  const badgeBorderColor = isDark ? "#0A0A0A" : "#FFFFFF";

  const tabConfig: Record<string, {
    icon: keyof typeof Ionicons.glyphMap;
    iconOutline: keyof typeof Ionicons.glyphMap;
    label: string;
  }> = {
    inbox: { icon: "chatbox", iconOutline: "chatbox-outline", label: "Chats" },
    contacts: { icon: "people", iconOutline: "people-outline", label: "Contactos" },
    settings: { icon: "settings", iconOutline: "settings-outline", label: "Ajustes" },
  };

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: bgColor,
        borderTopWidth: 1,
        borderTopColor: borderColor,
        paddingTop: 10,
        paddingBottom: bottomPad + 8,
        justifyContent: "space-around",
        alignItems: "flex-start",
      }}
    >
      {state.routes.map((route: any, index: number) => {
        const config = tabConfig[route.name];
        if (!config) return null; // Skip hidden tabs like agenda

        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const color = isFocused ? activeColor : inactiveColor;

        // Get badge from route params
        const badge = route.params?.unreadBadge;
        const showBadge = badge != null && badge > 0;
        const badgeText = badge && badge > 99 ? "99+" : String(badge);

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            activeOpacity={0.7}
            style={{
              width: 72,
              height: 37,
              alignItems: "center",
            }}
          >
            {/* Icon container */}
            <View style={{ position: "relative" }}>
              <Ionicons
                name={isFocused ? config.icon : config.iconOutline}
                size={22}
                color={color}
              />
              {/* Badge */}
              {showBadge && (
                <View
                  style={{
                    position: "absolute",
                    top: -3,
                    left: 16,
                    backgroundColor: "#EF4444",
                    borderWidth: 2,
                    borderColor: badgeBorderColor,
                    borderRadius: 8,
                    minWidth: 17,
                    height: 16,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingHorizontal: 4,
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 8,
                      fontWeight: "700",
                      fontFamily: fonts.monoBold,
                      fontVariant: ["tabular-nums"],
                      includeFontPadding: false,
                    }}
                  >
                    {badgeText}
                  </Text>
                </View>
              )}
            </View>

            {/* Label */}
            <Text
              style={{
                fontSize: 10,
                fontWeight: "600",
                fontFamily: fonts.semiBold,
                color,
                marginTop: 3,
              }}
            >
              {config.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <M6TabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="inbox" />
      <Tabs.Screen name="contacts" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen name="agenda" options={{ href: null }} />
    </Tabs>
  );
}
