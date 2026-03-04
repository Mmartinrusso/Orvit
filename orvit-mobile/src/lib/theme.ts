// ─── Color Palettes ──────────────────────────────────────────

export const darkPalette = {
  // Backgrounds
  bg: "#0c111d",
  bgSecondary: "#161d2e",
  bgTertiary: "#1f2a3d",
  bgInput: "#1a2336",

  // Borders
  border: "#263040",
  borderLight: "#2d3a4e",

  // Text
  textPrimary: "#f0f4f8",
  textSecondary: "#8b9bb4",
  textMuted: "#5b6b82",

  // Primary (dark navy)
  primary: "#1a3a6b",
  primaryDark: "#122b52",
  primaryBg: "rgba(26, 58, 107, 0.12)",

  // Semantic
  success: "#34d399",
  error: "#f87171",
  warning: "#fbbf24",

  // Message bubbles
  bubbleMeBg: "#0b3d6e",
  bubbleMeText: "#ffffff",
  bubbleOtherBg: "#1f2c34",
  bubbleOtherText: "#ffffff",
  chatBg: "#0b141a",
  chatHeaderBg: "#1f2c34",

  // Misc
  overlay: "rgba(0, 0, 0, 0.6)",
  skeleton: "#1f2a3d",
  skeletonShimmer: "#2d3a4e",
  online: "#34d399",
  recording: "#f87171",
  badge: "#1a3a6b",

  // Tab bar
  tabBarBg: "#0c111d",
  tabBarBorder: "#1a2336",
  tabActive: "#1a3a6b",
  tabInactive: "#5b6b82",

  // Header
  headerGradientStart: "#161d2e",
  headerGradientEnd: "#0c111d",
};

export const lightPalette: typeof darkPalette = {
  bg: "#f8fafc",
  bgSecondary: "#ffffff",
  bgTertiary: "#f1f5f9",
  bgInput: "#f1f5f9",

  border: "#e2e8f0",
  borderLight: "#cbd5e1",

  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#94a3b8",

  primary: "#152e54",
  primaryDark: "#0f2240",
  primaryBg: "rgba(21, 46, 84, 0.08)",

  success: "#10b981",
  error: "#ef4444",
  warning: "#f59e0b",

  // Message bubbles
  bubbleMeBg: "#1a4a7a",
  bubbleMeText: "#ffffff",
  bubbleOtherBg: "#2a2a2e",
  bubbleOtherText: "#ffffff",
  chatBg: "#efeae2",
  chatHeaderBg: "#008069",

  overlay: "rgba(0, 0, 0, 0.4)",
  skeleton: "#e2e8f0",
  skeletonShimmer: "#f1f5f9",
  online: "#10b981",
  recording: "#ef4444",
  badge: "#152e54",

  tabBarBg: "#ffffff",
  tabBarBorder: "#e2e8f0",
  tabActive: "#152e54",
  tabInactive: "#94a3b8",

  headerGradientStart: "#ffffff",
  headerGradientEnd: "#f8fafc",
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
  md: 12,
  lg: 16,
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
