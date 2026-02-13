'use client';

import { createContext, useContext } from 'react';

export interface SidebarContextType {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  isHoverOpen: boolean;
  setIsHoverOpen: (open: boolean) => void;
  preventClose: boolean;
  setPreventClose: (prevent: boolean) => void;
}

export const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function useSidebarContext() {
  const context = useContext(SidebarContext);
  if (!context) {
    return null;
  }
  return context;
}
