'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'metal';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    // Obtener tema guardado o preferencia del sistema
    const saved = (localStorage.getItem('dashboard-theme') as Theme) || undefined;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (saved) {
      // Compatibilidad: mapear themes antiguos
      if (saved === 'black') setThemeState('dark');
      else setThemeState(saved);
    } else if (systemPrefersDark) {
      setThemeState('dark');
    }
  }, []);

  useEffect(() => {
    // Aplicar clase al html
    document.documentElement.classList.remove('light', 'dark', 'metal');
    document.documentElement.classList.add(theme);

    localStorage.setItem('dashboard-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (t: Theme) => setThemeState(t);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}