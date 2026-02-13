'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

interface ThemeForceProps {
  children: React.ReactNode;
}

export function ThemeForce({ children }: ThemeForceProps) {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    // Asegurar que el tema se aplique correctamente
    const applyTheme = () => {
      const html = document.documentElement;
      
      // Remover todas las clases de tema
      html.classList.remove('light', 'dark', 'black');
      
      // Aplicar la clase del tema actual
      if (theme && theme !== 'system') {
        html.classList.add(theme);
      } else if (theme === 'system') {
        // Para el tema del sistema, detectar automáticamente
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const prefersBlack = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (prefersBlack) {
          html.classList.add('black');
        } else if (prefersDark) {
          html.classList.add('dark');
        } else {
          html.classList.add('light');
        }
      }
    };

    applyTheme();

    // Escuchar cambios en la preferencia del sistema
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return <>{children}</>;
} 