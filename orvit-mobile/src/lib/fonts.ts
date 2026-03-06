import { Platform } from "react-native";

// Font families matching Figma design system
// Inter → main UI text, IBM Plex Mono → timestamps & badge numbers

const isIOS = Platform.OS === "ios";

export const fonts = {
  // Inter variants
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semiBold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extraBold: "Inter_800ExtraBold",
  // IBM Plex Mono variants
  monoMedium: "IBMPlexMono_500Medium",
  monoBold: "IBMPlexMono_700Bold",
} as const;
