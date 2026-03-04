import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useColorScheme } from "react-native";
import {
  darkPalette,
  lightPalette,
  type ColorPalette,
} from "@/lib/theme";
import { getValue, storeValue } from "@/lib/storage";

const THEME_KEY = "orvit_theme_mode";

type ThemeMode = "dark" | "light" | "system";

interface ThemeContextValue {
  colors: ColorPalette;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkPalette,
  isDark: true,
  mode: "dark",
  setMode: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getValue(THEME_KEY).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setModeState(stored);
      }
      setLoaded(true);
    });
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    storeValue(THEME_KEY, newMode);
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  const isDark = useMemo(() => {
    if (mode === "system") return systemScheme !== "light";
    return mode === "dark";
  }, [mode, systemScheme]);

  const colors = isDark ? darkPalette : lightPalette;

  const value = useMemo(
    () => ({ colors, isDark, mode, setMode, toggleTheme }),
    [colors, isDark, mode, setMode, toggleTheme]
  );

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
