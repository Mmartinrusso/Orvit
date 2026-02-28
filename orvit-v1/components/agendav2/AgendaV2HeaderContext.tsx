'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface AgendaV2HeaderContextType {
  search: string;
  setSearch: (v: string) => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
}

const Ctx = createContext<AgendaV2HeaderContextType | null>(null);

export function AgendaV2HeaderProvider({ children }: { children: ReactNode }) {
  const [search, setSearch]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  return (
    <Ctx.Provider value={{ search, setSearch, isLoading, setIsLoading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAgendaV2Header(): AgendaV2HeaderContextType | null {
  return useContext(Ctx);
}
