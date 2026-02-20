'use client';

/**
 * Hook centralizado de colores del usuario.
 *
 * Lee las preferencias de color guardadas en localStorage (clave: 'userColors').
 * Si no hay preferencias guardadas, devuelve DEFAULT_COLORS como fallback.
 *
 * Uso en componentes:
 *   import { useUserColors } from '@/hooks/use-user-colors';
 *   const userColors = useUserColors();
 */

import { useState, useEffect } from 'react';
import { DEFAULT_COLORS, type UserColorPreferences } from '@/lib/colors';

const STORAGE_KEY = 'userColors';

function readColorsFromStorage(): UserColorPreferences {
  if (typeof window === 'undefined') return DEFAULT_COLORS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLORS;
    const parsed = JSON.parse(raw);
    // Validación mínima — si le falta chart1, descartamos
    if (!parsed?.chart1) return DEFAULT_COLORS;
    return { ...DEFAULT_COLORS, ...parsed };
  } catch {
    return DEFAULT_COLORS;
  }
}

export function useUserColors(): UserColorPreferences {
  const [colors, setColors] = useState<UserColorPreferences>(DEFAULT_COLORS);

  useEffect(() => {
    // Leer al montar
    setColors(readColorsFromStorage());

    // Escuchar cambios (p.ej. cuando el usuario cambia tema en Settings)
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setColors(readColorsFromStorage());
      }
    }

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return colors;
}
