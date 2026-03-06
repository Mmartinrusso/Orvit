import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import { getValue, storeValue } from "@/lib/storage";
import { fonts } from "@/lib/fonts";

type IoniconsName = keyof typeof Ionicons.glyphMap;

const STORAGE_KEY = "orvit_notif_prefs";

interface NotifPrefs {
  newMessages: boolean;
  mentions: boolean;
  sound: boolean;
  vibration: boolean;
  groupMessages: boolean;
  groupMentionsOnly: boolean;
  assignedTasks: boolean;
  reminders: boolean;
  taskComments: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  newMessages: true,
  mentions: true,
  sound: true,
  vibration: true,
  groupMessages: true,
  groupMentionsOnly: false,
  assignedTasks: true,
  reminders: true,
  taskComments: true,
};

interface ToggleRow {
  key: keyof NotifPrefs;
  icon: IoniconsName;
  title: string;
}

const SECTIONS: { label: string; rows: ToggleRow[] }[] = [
  {
    label: "MENSAJES",
    rows: [
      { key: "newMessages", icon: "chatbubble-outline", title: "Mensajes nuevos" },
      { key: "mentions", icon: "at-outline", title: "Menciones" },
      { key: "sound", icon: "volume-medium-outline", title: "Sonido" },
      { key: "vibration", icon: "phone-portrait-outline", title: "Vibracion" },
    ],
  },
  {
    label: "GRUPOS",
    rows: [
      { key: "groupMessages", icon: "people-outline", title: "Mensajes de grupo" },
      { key: "groupMentionsOnly", icon: "at-circle-outline", title: "Solo menciones en grupos" },
    ],
  },
  {
    label: "TAREAS",
    rows: [
      { key: "assignedTasks", icon: "checkbox-outline", title: "Tareas asignadas" },
      { key: "reminders", icon: "alarm-outline", title: "Recordatorios" },
      { key: "taskComments", icon: "chatbubbles-outline", title: "Comentarios en tareas" },
    ],
  },
];

export default function NotificationSettingsScreen() {
  const { isDark } = useTheme();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  // ── m6 colors ──────────────────────────────────────────────
  const bg = isDark ? "#0A0A0A" : "#FFFFFF";
  const surface = isDark ? "#171717" : "#FAFAFA";
  const text = isDark ? "#E5E5E5" : "#0A0A0A";
  const sectionColor = isDark ? "#333333" : "#A3A3A3";
  const divider = isDark ? "#111111" : "#F0F0F0";

  // ── Load prefs on mount ────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await getValue(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<NotifPrefs>;
          setPrefs({ ...DEFAULT_PREFS, ...parsed });
        }
      } catch {
        // use defaults
      }
      setLoaded(true);
    })();
  }, []);

  // ── Toggle handler ─────────────────────────────────────────
  const toggle = useCallback(
    (key: keyof NotifPrefs) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        storeValue(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  if (!loaded) return <View style={{ flex: 1, backgroundColor: bg }} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          height: 52,
          gap: 12,
        }}
      >
        <AnimatedPressable onPress={() => router.back()} haptic="light">
          <Ionicons name="arrow-back" size={22} color={text} />
        </AnimatedPressable>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "700",
            fontFamily: fonts.bold,
            letterSpacing: -0.16,
            color: text,
          }}
        >
          Notificaciones
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map((section) => (
          <View key={section.label}>
            {/* Section header */}
            <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 }}>
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "700",
                  fontFamily: fonts.bold,
                  letterSpacing: 0.72,
                  textTransform: "uppercase",
                  color: sectionColor,
                }}
              >
                {section.label}
              </Text>
            </View>

            {/* Rows */}
            {section.rows.map((row, idx) => {
              const isLast = idx === section.rows.length - 1;
              return (
                <View key={row.key}>
                  <View
                    style={{
                      height: 52,
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 20,
                      gap: 14,
                    }}
                  >
                    {/* Icon container */}
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: surface,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Ionicons name={row.icon} size={17} color={text} />
                    </View>

                    {/* Title */}
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 13,
                        fontWeight: "600",
                        fontFamily: fonts.semiBold,
                        color: text,
                      }}
                    >
                      {row.title}
                    </Text>

                    {/* Switch */}
                    <Switch
                      value={prefs[row.key]}
                      onValueChange={() => toggle(row.key)}
                      trackColor={{ false: "#333333", true: "#FFFFFF" }}
                      thumbColor={isDark ? "#0A0A0A" : "#FFFFFF"}
                      ios_backgroundColor="#333333"
                      style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                    />
                  </View>

                  {/* Divider (skip last in section) */}
                  {!isLast && (
                    <View
                      style={{
                        height: 1,
                        backgroundColor: divider,
                        marginLeft: 66,
                      }}
                    />
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
