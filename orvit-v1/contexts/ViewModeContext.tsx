'use client';

/**
 * ViewMode Context
 * Global context for view mode state and toggle
 * Generic naming for security/indetectability
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { usePathname } from 'next/navigation';

type ViewMode = 'S' | 'E';

interface ViewModeConfig {
  enabled: boolean;
  hk?: string;      // Encrypted hotkey
  t?: number;       // Session timeout
  m?: ViewMode;     // Current mode
  ct?: string[];    // Configured types
}

interface ViewModeContextValue {
  mode: ViewMode;
  canToggle: boolean;
  isLoading: boolean;
  requestToggle: () => void;
  setMode: (mode: ViewMode) => void;
  config: ViewModeConfig | null;
  showVerification: boolean;
  setShowVerification: (show: boolean) => void;
  onVerificationSuccess: (newMode: ViewMode) => void;
  ct: string[];  // Configured types
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

interface ViewModeProviderProps {
  children: ReactNode;
}

// Public paths that don't require authentication
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/empresas'];

// Key para localStorage (ofuscado)
const VM_LOCAL_KEY = '_vml';

export function ViewModeProvider({ children }: ViewModeProviderProps) {
  // Inicializar SIEMPRE en Standard - será actualizado por la API si corresponde
  // Esto evita que se quede "trabado" en Extended si hay algún problema
  const [mode, setModeState] = useState<ViewMode>('S');
  const [config, setConfig] = useState<ViewModeConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showVerification, setShowVerification] = useState(false);
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();

  // Limpiar localStorage al montar para evitar valores "trabados"
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Limpiamos el localStorage al inicio - solo la API determina el modo
        localStorage.removeItem(VM_LOCAL_KEY);
      } catch { /* ignore */ }
    }
  }, []);

  // Helper para resetear a Standard (T1) - usado ante cualquier duda/error
  const resetToStandard = useCallback(() => {
    setModeState('S');
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(VM_LOCAL_KEY);
      } catch { /* ignore */ }
    }
  }, []);

  // Load config only when user is authenticated and on a protected page
  useEffect(() => {
    // Skip on public pages
    const isPublicPath = PUBLIC_PATHS.some(p => pathname?.startsWith(p));
    if (isPublicPath) {
      setIsLoading(false);
      return;
    }

    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    // Don't make API call if not authenticated - SIEMPRE resetear a Standard
    if (!user || !user.id) {
      resetToStandard();
      setIsLoading(false);
      return;
    }

    const loadConfig = async () => {
      try {
        const response = await fetch('/api/user/view-preferences');

        // Ante cualquier error HTTP, resetear a Standard
        if (!response.ok) {
          resetToStandard();
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        setConfig(data);

        // Solo mantener Extended si está explícitamente habilitado Y tiene modo E
        if (data.enabled === true && data.m === 'E') {
          setModeState('E');
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(VM_LOCAL_KEY, 'E');
            } catch { /* ignore */ }
          }
        } else {
          // En CUALQUIER otro caso, resetear a Standard
          resetToStandard();
        }
      } catch {
        // Ante cualquier error (network, parse, etc), resetear a Standard
        resetToStandard();
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [user, authLoading, pathname, resetToStandard]);

  // Listen for hotkey
  useEffect(() => {
    if (!config?.enabled || !config?.hk) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Decode hotkey (simple XOR obfuscation for demo)
      // In production, use proper encryption
      const hotkey = config.hk;
      if (!hotkey) return;

      // Parse hotkey format: "ctrl+shift+v" or similar
      const parts = hotkey.toLowerCase().split('+');
      const key = parts[parts.length - 1];
      const needsCtrl = parts.includes('ctrl');
      const needsShift = parts.includes('shift');
      const needsAlt = parts.includes('alt');

      const matches =
        e.key.toLowerCase() === key &&
        e.ctrlKey === needsCtrl &&
        e.shiftKey === needsShift &&
        e.altKey === needsAlt;

      if (matches) {
        e.preventDefault();
        setShowVerification(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config]);

  const requestToggle = useCallback(() => {
    if (config?.enabled) {
      setShowVerification(true);
    }
  }, [config]);

  // Helper para actualizar modo y persistir en localStorage
  const updateMode = useCallback((newMode: ViewMode) => {
    setModeState(newMode);
    // Persistir en localStorage para evitar flash al refresh
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(VM_LOCAL_KEY, newMode);
      } catch {
        // localStorage no disponible
      }
    }
  }, []);

  const setMode = useCallback((newMode: ViewMode) => {
    updateMode(newMode);
  }, [updateMode]);

  const onVerificationSuccess = useCallback((newMode: ViewMode) => {
    updateMode(newMode);
    setShowVerification(false);

    // Invalidate all queries to refresh data with new mode
    queryClient.invalidateQueries();
  }, [queryClient, updateMode]);

  const value: ViewModeContextValue = {
    mode,
    canToggle: config?.enabled ?? false,
    isLoading,
    requestToggle,
    setMode,
    config,
    showVerification,
    setShowVerification,
    onVerificationSuccess,
    ct: config?.ct || [],  // Configured types
  };

  return (
    <ViewModeContext.Provider value={value}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode(): ViewModeContextValue {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error('useViewMode must be used within a ViewModeProvider');
  }
  return context;
}
