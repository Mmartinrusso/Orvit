'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarClock, ClipboardList, Calendar, LayoutGrid, History, BarChart3 } from 'lucide-react';
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
        <span className="text-sm text-muted-foreground">Cargando agenda...</span>
      </div>
    </div>
  )
});

type AgendaTab = 'mi-agenda' | 'tareas' | 'fijas' | 'dashboard' | 'historial' | 'metricas';
type TareasTab = 'tareas' | 'fijas' | 'dashboard' | 'historial' | 'metricas';

const TAREAS_TABS: TareasTab[] = ['tareas', 'fijas', 'dashboard', 'historial', 'metricas'];

interface TabDef {
  value: AgendaTab;
  label: string;
  icon: typeof CalendarClock;
  permission?: 'tasks' | 'historial' | 'estadisticas';
}

export default function UnifiedAgendaPage() {
  const [activeTab, setActiveTab] = useState<AgendaTab>('mi-agenda');
  const searchParams = useSearchParams();

  const { hasPermission: canAccessTasks, isLoading: loadingTasksPerm } = usePermissionRobust('ingresar_tareas');
  const { hasPermission: canSeeHistorial, isLoading: loadingHistorialPerm } = usePermissionRobust('ver_historial_tareas');
  const { hasPermission: canSeeEstadisticas, isLoading: loadingEstadisticasPerm } = usePermissionRobust('ver_estadisticas');

  // Handle URL params for navigation (e.g., from notifications)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      const validTabs: AgendaTab[] = ['mi-agenda', 'tareas', 'fijas', 'dashboard', 'historial', 'metricas'];
      if (validTabs.includes(tab as AgendaTab)) {
        setActiveTab(tab as AgendaTab);
      }
    }
  }, [searchParams]);

  // Build visible tabs based on permissions
  const tabs: TabDef[] = useMemo(() => {
    const result: TabDef[] = [
      { value: 'mi-agenda', label: 'Mi Agenda', icon: CalendarClock },
    ];

    if (!loadingTasksPerm && canAccessTasks) {
      result.push(
        { value: 'tareas', label: 'Tareas', icon: ClipboardList, permission: 'tasks' },
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
      <div className="px-4 md:px-6 pt-4 pb-3 flex justify-center">
        <div className="w-full sm:w-fit bg-muted/40 border border-border rounded-md p-1 h-auto min-h-9 overflow-x-auto flex items-center gap-0.5 flex-wrap sm:flex-nowrap">
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
      {activeTab === 'mi-agenda' && (
        <AgendaPage />
      )}

      {isTareasTab && (
        <div className={activeTab === 'tareas' ? 'h-[calc(100vh-8rem)] overflow-hidden' : 'px-4 md:px-6 pb-6'}>
          <TareasContent activeTab={activeTab as TareasTab} />
        </div>
      )}
    </div>
  );
}
