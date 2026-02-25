'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { WorkOrder, MaintenanceType, WorkOrderStatus } from '@/lib/types';

export type PresetKey = 'all' | 'correctivos' | 'mine' | 'unassigned';

export interface PresetFilters {
  type?: MaintenanceType;
  assignee?: 'current-user' | 'unassigned';
  statuses?: WorkOrderStatus[];
}

export interface Preset {
  key: PresetKey;
  label: string;
  filters: PresetFilters;
}

// Presets centralizados - única fuente de verdad
export const PRESETS: Preset[] = [
  {
    key: 'all',
    label: 'Todas',
    filters: {},
  },
  {
    key: 'correctivos',
    label: 'Correctivos',
    filters: { type: 'CORRECTIVE' as MaintenanceType },
  },
  {
    key: 'mine',
    label: 'Mis órdenes',
    filters: { assignee: 'current-user' },
  },
  {
    key: 'unassigned',
    label: 'Sin asignar',
    filters: { assignee: 'unassigned' },
  },
];

interface WorkOrdersSavedViewsBarProps {
  workOrders?: WorkOrder[];
  className?: string;
}

export function WorkOrdersSavedViewsBar({ workOrders = [], className }: WorkOrdersSavedViewsBarProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const currentPreset = (searchParams.get('preset') as PresetKey) || 'all';

  const handlePresetChange = useCallback((preset: PresetKey) => {
    const params = new URLSearchParams(searchParams.toString());

    if (preset === 'all') {
      params.delete('preset');
    } else {
      params.set('preset', preset);
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  // Calcular counts para cada preset
  const counts = useMemo(() => {
    const userId = user?.id;

    return PRESETS.reduce((acc, preset) => {
      let filtered = [...workOrders];

      if (preset.filters.type) {
        filtered = filtered.filter(wo => wo.maintenanceType === preset.filters.type);
      }

      if (preset.filters.assignee === 'current-user' && userId) {
        filtered = filtered.filter(wo =>
          wo.assignedToId === userId || wo.assignedWorkerId === userId
        );
      }

      if (preset.filters.assignee === 'unassigned') {
        filtered = filtered.filter(wo => !wo.assignedToId && !wo.assignedWorkerId);
      }

      // Excluir completadas y canceladas del count
      filtered = filtered.filter(wo =>
        wo.status !== WorkOrderStatus.COMPLETED &&
        wo.status !== WorkOrderStatus.CANCELLED
      );

      acc[preset.key] = filtered.length;
      return acc;
    }, {} as Record<PresetKey, number>);
  }, [workOrders, user?.id]);

  return (
    <div className={cn('flex w-fit max-w-full items-center bg-muted/70 p-1 rounded-lg gap-0.5 overflow-x-auto overflow-y-hidden hide-scrollbar', className)}>
      {PRESETS.map((preset) => {
        const isActive = currentPreset === preset.key;
        const count = counts[preset.key];

        return (
          <button
            key={preset.key}
            onClick={() => handlePresetChange(preset.key)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 h-7 text-xs rounded-md transition-all whitespace-nowrap shrink-0',
              isActive
                ? 'bg-background text-foreground font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
            )}
          >
            {preset.label}
            {count > 0 && (
              <span
                className={cn(
                  'tabular-nums px-1.5 py-px rounded-full text-[10px] font-semibold min-w-[18px] text-center leading-4',
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'bg-background/80 text-muted-foreground'
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Hook para obtener los filtros del preset actual
export function usePresetFilters(): PresetFilters {
  const searchParams = useSearchParams();
  const presetKey = (searchParams.get('preset') as PresetKey) || 'all';
  const preset = PRESETS.find(p => p.key === presetKey);
  return preset?.filters || {};
}

// Hook para obtener el preset actual
export function useCurrentPreset(): PresetKey {
  const searchParams = useSearchParams();
  return (searchParams.get('preset') as PresetKey) || 'all';
}
