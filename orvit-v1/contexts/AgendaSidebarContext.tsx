'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { AgendaTask } from '@/lib/agenda/types';
import type { TaskGroupItem } from '@/components/agendav2/AgendaV2Sidebar';

type ViewMode = 'board' | 'inbox' | 'dashboard' | 'reporting' | 'portfolio' | 'fixed-tasks';

export interface AgendaSidebarState {
  view: ViewMode;
  tasks: AgendaTask[];
  groups: TaskGroupItem[];
  selectedGroupId: number | null;
  loadingGroups: boolean;
  onViewChange: (v: ViewMode) => void;
  onCreateTask: () => void;
  onSelectGroup: (id: number | null) => void;
  onCreateGroup: (isProject: boolean) => void;
}

interface AgendaSidebarContextValue {
  /** null when not on the agenda page */
  agendaSidebar: AgendaSidebarState | null;
  setAgendaSidebar: (state: AgendaSidebarState | null) => void;
}

const AgendaSidebarContext = createContext<AgendaSidebarContextValue>({
  agendaSidebar: null,
  setAgendaSidebar: () => {},
});

export function AgendaSidebarProvider({ children }: { children: ReactNode }) {
  const [agendaSidebar, setAgendaSidebar] = useState<AgendaSidebarState | null>(null);

  const setAgendaSidebarStable = useCallback((state: AgendaSidebarState | null) => {
    setAgendaSidebar(state);
  }, []);

  return (
    <AgendaSidebarContext.Provider value={{ agendaSidebar, setAgendaSidebar: setAgendaSidebarStable }}>
      {children}
    </AgendaSidebarContext.Provider>
  );
}

export function useAgendaSidebar() {
  return useContext(AgendaSidebarContext);
}
