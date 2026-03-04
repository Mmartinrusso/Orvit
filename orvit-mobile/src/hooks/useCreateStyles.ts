import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import {
  typography,
  spacing,
  radius,
  type ColorPalette,
  type Typography,
  type Spacing,
  type Radius,
} from "@/lib/theme";

type StyleFactory<T> = (
  colors: ColorPalette,
  t: Typography,
  s: Spacing,
  r: Radius
) => T;

export function useCreateStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: StyleFactory<T>
): T {
  const { colors } = useTheme();
  return useMemo(
    () => StyleSheet.create(factory(colors, typography, spacing, radius)),
    [colors]
  );
}
