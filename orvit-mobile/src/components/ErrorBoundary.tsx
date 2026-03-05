import React from "react";
import { View, Text, TouchableOpacity, Appearance } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      const isDark = Appearance.getColorScheme() === "dark";
      const bg = isDark ? "#0c111d" : "#f8fafc";
      const textColor = isDark ? "#f0f4f8" : "#0f172a";
      const subColor = isDark ? "#8b9bb4" : "#64748b";
      const accent = isDark ? "#1a3a6b" : "#152e54";
      const accentBg = isDark ? "rgba(26,58,107,0.15)" : "rgba(21,46,84,0.1)";

      return (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: bg,
            padding: 24,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: accentBg,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <Ionicons name="alert-circle-outline" size={48} color={accent} />
          </View>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: textColor,
              marginBottom: 8,
            }}
          >
            Algo salio mal
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: subColor,
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            La app encontro un error inesperado.
          </Text>
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: accent,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
            }}
            onPress={() => this.setState({ hasError: false })}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
              Reintentar
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
