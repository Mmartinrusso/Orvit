'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarClock, Calendar, LayoutGrid, History, BarChart3, Inbox } from 'lucide-react';
import { AgendaPage } from '@/components/agenda';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import { cn } from '@/lib/utils';

import dynamic from 'next/dynamic';
const TareasContent = dynamic(() => import('@/components/tasks/TareasContent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center space-x-2">
        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
        <span className="text-sm text-muted-foreground">Cargando...</span>
      </div>
    </div>
  )
});

type AgendaTab = 'agenda' | 'tareas' | 'fijas' | 'dashboard' | 'historial' | 'metricas';
type TareasTab = 'tareas' | 'fijas' | 'dashboard' | 'historial' | 'metricas';

const TAREAS_TABS: TareasTab[] = ['tareas', 'fijas', 'dashboard', 'historial', 'metricas'];

interface TabDef {
  value: AgendaTab;
  label: string;
  icon: typeof CalendarClock;
  permission?: 'tasks' | 'historial' | 'estadisticas';
}

export default function UnifiedAgendaPage() {
  const [activeTab, setActiveTab] = useState<AgendaTab>('agenda');
  const searchParams = useSearchParams();

  const { hasPermission: canAccessTasks, isLoading: loadingTasksPerm } = usePermissionRobust('ingresar_tareas');
  const { hasPermission: canSeeHistorial, isLoading: loadingHistorialPerm } = usePermissionRobust('ver_historial_tareas');
  const { hasPermission: canSeeEstadisticas, isLoading: loadingEstadisticasPerm } = usePermissionRobust('ver_estadisticas');

  // Handle URL params for navigation
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      // Compatibilidad: si alguien navega a ?tab=mi-agenda, redirigir a agenda
      if (tab === 'mi-agenda') {
        setActiveTab('agenda');
      } else {
        const validTabs: AgendaTab[] = ['agenda', 'tareas', 'fijas', 'dashboard', 'historial', 'metricas'];
        if (validTabs.includes(tab as AgendaTab)) {
          setActiveTab(tab as AgendaTab);
        }
      }
    }
  }, [searchParams]);

  // Build visible tabs based on permissions
  const tabs: TabDef[] = useMemo(() => {
    const result: TabDef[] = [
      { value: 'agenda', label: 'Agenda', icon: CalendarClock },
    ];

    if (!loadingTasksPerm && canAccessTasks) {
      result.push(
        { value: 'tareas', label: 'Tareas', icon: Inbox, permission: 'tasks' },
        { value: 'fijas', label: 'Fijas', icon: Calendar, permission: 'tasks' },
        { value: 'dashboard', label: 'Dashboard', icon: LayoutGrid, permission: 'tasks' },
      );
    }
    if (!loadingHistorialPerm && canSeeHistorial) {
      result.push({ value: 'historial', label: 'Historial', icon: History, permission: 'historial' });
    }
    if (!loadingEstadisticasPerm && canSeeEstadisticas) {
      result.push({ value: 'metricas', label: 'Métricas', icon: BarChart3, permission: 'estadisticas' });
    }

    return result;
  }, [canAccessTasks, canSeeHistorial, canSeeEstadisticas, loadingTasksPerm, loadingHistorialPerm, loadingEstadisticasPerm]);

  const isTareasTab = TAREAS_TABS.includes(activeTab as TareasTab);

  return (
    <div className="w-full p-0">
      {/* Tab Navigation */}
      <div className="px-4 md:px-6 pt-4 pb-3">
        <div className="w-full sm:w-fit bg-muted/40 border border-border rounded-md p-1 h-9 overflow-x-auto flex items-center gap-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "inline-flex items-center justify-center whitespace-nowrap rounded-sm text-xs font-normal h-7 px-3 shrink-0 gap-1.5 transition-all",
                  isActive
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'agenda' && (
        <AgendaPage />
      )}

      {isTareasTab && (
        <div className="px-4 md:px-6 pb-6">
          <TareasContent activeTab={activeTab as TareasTab} />
        </div>
      )}
    </div>
  );
}
