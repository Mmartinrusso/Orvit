'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface NavigationContextType {
  isNavigating: boolean;
  setNavigating: (navigating: boolean) => void;
  navigateTo: (path: string) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();

  // Ocultar el indicador cuando la ruta cambia completamente
  useEffect(() => {
    if (isNavigating) {
      // Esperar a que la página se cargue completamente
      const timer = setTimeout(() => {
        setIsNavigating(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  const setNavigating = useCallback((navigating: boolean) => {
    setIsNavigating(navigating);
  }, []);

  const navigateTo = useCallback((path: string) => {
    setIsNavigating(true);
  }, []);

  return (
    <NavigationContext.Provider value={{ isNavigating, setNavigating, navigateTo }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}

