import { useState } from "react";
import { View, Text, ScrollView, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import { router } from "expo-router";
import { fonts } from "@/lib/fonts";

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    question: "Como envio un mensaje de voz?",
    answer:
      "Mantene presionado el icono de microfono en el chat para grabar un audio. Soltar para enviarlo.",
  },
  {
    question: "Como creo un grupo?",
    answer:
      "Desde la bandeja de entrada, toca el icono + en la esquina superior derecha y selecciona Crear grupo.",
  },
  {
    question: "Como cambio mi foto de perfil?",
    answer:
      "Anda a Ajustes, toca tu foto de perfil actual y selecciona una nueva imagen de tu galeria.",
  },
  {
    question: "Como silencio un chat?",
    answer:
      "En la info del chat, toca el boton Silenciar para dejar de recibir notificaciones.",
  },
  {
    question: "Que es Orvit AI?",
    answer:
      "Es el asistente de inteligencia artificial integrado. Podes mandarle audios o texto para crear tareas, reportar fallas o pedir resumenes.",
  },
];

export default function HelpScreen() {
  const { isDark } = useTheme();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // ── m6 colors ──────────────────────────────────────────────
  const bg = isDark ? "#0A0A0A" : "#FFFFFF";
  const surface = isDark ? "#171717" : "#FAFAFA";
  const text = isDark ? "#E5E5E5" : "#0A0A0A";
  const textMuted = isDark ? "#555555" : "#A3A3A3";
  const textDim = isDark ? "#404040" : "#737373";
  const sectionColor = isDark ? "#333333" : "#A3A3A3";
  const divider = isDark ? "#111111" : "#F0F0F0";

  // ── Section header renderer ────────────────────────────────
  function renderSectionHeader(label: string) {
    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 }}>
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
          {label}
        </Text>
      </View>
    );
  }

  // ── Menu item renderer ─────────────────────────────────────
  function renderMenuItem(
    icon: IoniconsName,
    title: string,
    options?: {
      subtitle?: string;
      trailing?: React.ReactNode;
      onPress?: () => void;
      showDivider?: boolean;
      showChevron?: boolean;
    }
  ) {
    const content = (
      <View
        style={{
          height: 56,
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
          <Ionicons name={icon} size={17} color={text} />
        </View>

        {/* Text */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              fontFamily: fonts.semiBold,
              color: text,
            }}
          >
            {title}
          </Text>
          {options?.subtitle && (
            <Text
              style={{
                fontSize: 11,
                fontWeight: "400",
                fontFamily: fonts.regular,
                color: textDim,
                marginTop: 1,
              }}
            >
              {options.subtitle}
            </Text>
          )}
        </View>

        {/* Trailing */}
        {options?.trailing ||
          (options?.showChevron !== false && (
            <Ionicons name="chevron-forward" size={16} color={textMuted} />
          ))}
      </View>
    );

    const dividerView =
      options?.showDivider !== false ? (
        <View
          style={{
            height: 1,
            backgroundColor: divider,
            marginLeft: 66,
          }}
        />
      ) : null;

    if (options?.onPress) {
      return (
        <View key={title}>
          <AnimatedPressable onPress={options.onPress} haptic="light">
            {content}
          </AnimatedPressable>
          {dividerView}
        </View>
      );
    }

    return (
      <View key={title}>
        {content}
        {dividerView}
      </View>
    );
  }

  // ── FAQ item renderer ──────────────────────────────────────
  function renderFAQItem(item: FAQItem, index: number) {
    const isExpanded = expandedIndex === index;
    const isLast = index === FAQ_DATA.length - 1;

    return (
      <View key={index}>
        <AnimatedPressable
          onPress={() => setExpandedIndex(isExpanded ? null : index)}
          haptic="light"
        >
          <View
            style={{
              paddingHorizontal: 20,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: "600",
                fontFamily: fonts.semiBold,
                color: text,
              }}
            >
              {item.question}
            </Text>
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={textMuted}
            />
          </View>

          {isExpanded && (
            <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "400",
                  fontFamily: fonts.regular,
                  color: textDim,
                  marginTop: 6,
                  lineHeight: 18,
                }}
              >
                {item.answer}
              </Text>
            </View>
          )}
        </AnimatedPressable>

        {!isLast && (
          <View
            style={{
              height: 1,
              backgroundColor: divider,
              marginLeft: 20,
            }}
          />
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 12,
          gap: 12,
        }}
      >
        <AnimatedPressable onPress={() => router.back()} haptic="light">
          <Ionicons name="arrow-back" size={22} color={text} />
        </AnimatedPressable>
        <Text
          style={{
            fontSize: 28,
            fontWeight: "800",
            fontFamily: fonts.extraBold,
            letterSpacing: -0.84,
            color: text,
          }}
        >
          Ayuda
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* FAQ Section */}
        {renderSectionHeader("PREGUNTAS FRECUENTES")}
        {FAQ_DATA.map((item, index) => renderFAQItem(item, index))}

        {/* Contacto Section */}
        <View style={{ marginTop: 16 }} />
        {renderSectionHeader("CONTACTO")}

        {renderMenuItem("mail-outline", "Escribinos por email", {
          onPress: () => Linking.openURL("mailto:soporte@orvit.app"),
        })}

        {renderMenuItem("information-circle-outline", "Version de la app", {
          subtitle: "m6 Chat v1.0.0",
          showChevron: false,
          showDivider: false,
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
