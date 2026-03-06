// ─── m6 Color Palettes (Monochrome) ─────────────────────────

export const darkPalette = {
  // Backgrounds
  bg: "#0A0A0A",
  bgSecondary: "#171717",
  bgTertiary: "#1A1A1A",
  bgInput: "#171717",

  // Borders
  border: "#262626",
  borderLight: "#333333",

  // Text
  textPrimary: "#E5E5E5",
  textSecondary: "#A3A3A3",
  textMuted: "#555555",

  // Primary (white on dark)
  primary: "#FFFFFF",
  primaryDark: "#E5E5E5",
  primaryBg: "rgba(255, 255, 255, 0.08)",

  // Semantic
  success: "#34d399",
  error: "#f87171",
  warning: "#fbbf24",

  // Message bubbles (Figma m6)
  bubbleMeBg: "#E5E5E5",
  bubbleMeText: "#0A0A0A",
  bubbleOtherBg: "#151515",
  bubbleOtherText: "#D4D4D4",
  bubbleSenderName: "#737373",
  bubbleTimeMe: "#737373",
  bubbleTimeOther: "#555555",
  chatBg: "#0A0A0A",
  chatHeaderBg: "#0A0A0A",
  chatHeaderBorder: "#151515",
  chatInputBg: "#151515",
  chatInputBorder: "#1F1F1F",
  chatInputPlaceholder: "#333333",
  chatButtonBg: "#151515",
  chatDateBg: "#151515",
  chatDateText: "#404040",

  // Misc
  overlay: "rgba(0, 0, 0, 0.6)",
  skeleton: "#171717",
  skeletonShimmer: "#262626",
  online: "#34d399",
  recording: "#f87171",
  badge: "#FFFFFF",

  // Tab bar
  tabBarBg: "#0A0A0A",
  tabBarBorder: "#262626",
  tabActive: "#FFFFFF",
  tabInactive: "#555555",

  // Header
  headerGradientStart: "#0A0A0A",
  headerGradientEnd: "#0A0A0A",
};

export const lightPalette: typeof darkPalette = {
  // Backgrounds
  bg: "#FFFFFF",
  bgSecondary: "#FAFAFA",
  bgTertiary: "#F5F5F5",
  bgInput: "#FAFAFA",

  // Borders
  border: "#E5E5E5",
  borderLight: "#CCCCCC",

  // Text
  textPrimary: "#0A0A0A",
  textSecondary: "#737373",
  textMuted: "#A3A3A3",

  // Primary (black on light)
  primary: "#0A0A0A",
  primaryDark: "#000000",
  primaryBg: "rgba(10, 10, 10, 0.05)",

  // Semantic
  success: "#10b981",
  error: "#ef4444",
  warning: "#f59e0b",

  // Message bubbles (Figma m6)
  bubbleMeBg: "#0A0A0A",
  bubbleMeText: "#E5E5E5",
  bubbleOtherBg: "#F5F5F5",
  bubbleOtherText: "#333333",
  bubbleSenderName: "#737373",
  bubbleTimeMe: "#737373",
  bubbleTimeOther: "#A3A3A3",
  chatBg: "#FFFFFF",
  chatHeaderBg: "#FFFFFF",
  chatHeaderBorder: "#F0F0F0",
  chatInputBg: "#F5F5F5",
  chatInputBorder: "#E5E5E5",
  chatInputPlaceholder: "#A3A3A3",
  chatButtonBg: "#F5F5F5",
  chatDateBg: "#F5F5F5",
  chatDateText: "#A3A3A3",

  // Misc
  overlay: "rgba(0, 0, 0, 0.4)",
  skeleton: "#F5F5F5",
  skeletonShimmer: "#E5E5E5",
  online: "#10b981",
  recording: "#ef4444",
  badge: "#0A0A0A",

  // Tab bar
  tabBarBg: "#FFFFFF",
  tabBarBorder: "#E5E5E5",
  tabActive: "#0A0A0A",
  tabInactive: "#A3A3A3",

  // Header
  headerGradientStart: "#FFFFFF",
  headerGradientEnd: "#FFFFFF",
};

export type ColorPalette = typeof darkPalette;

// ─── Typography ──────────────────────────────────────────────

export const typography = {
  title: { fontSize: 28, fontWeight: "800" as const, letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.3 },
  subheading: { fontSize: 17, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 21 },
  bodyMedium: { fontSize: 15, fontWeight: "500" as const },
  caption: { fontSize: 13, fontWeight: "500" as const },
  small: { fontSize: 12, fontWeight: "400" as const },
  tiny: { fontSize: 10, fontWeight: "400" as const },
};

export type Typography = typeof typography;

// ─── Spacing ─────────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export type Spacing = typeof spacing;

// ─── Border Radius ───────────────────────────────────────────

export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 24,
  full: 999,
};

export type Radius = typeof radius;

// ─── Animation Config ────────────────────────────────────────

export const animConfig = {
  spring: { damping: 15, stiffness: 150, mass: 0.8 },
  springFast: { damping: 20, stiffness: 200 },
  springBouncy: { damping: 12, stiffness: 120 },
  duration: { fast: 150, normal: 250, slow: 400 },
};

// ─── Avatar sizes ────────────────────────────────────────────

export const avatarSizes = {
  sm: 32,
  md: 44,
  lg: 64,
  xl: 80,
};
