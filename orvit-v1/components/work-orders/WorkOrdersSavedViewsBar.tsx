'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { WorkOrder, MaintenanceType, WorkOrderStatus } from '@/lib/types';

export type PresetKey = 'all' | 'correctivos' | 'preventivos' | 'mine' | 'unassigned';

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
    key: 'preventivos',
    label: 'Preventivos',
    filters: { type: 'PREVENTIVE' as MaintenanceType },
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
    <div className={cn('flex flex-wrap items-center gap-1 bg-muted/50 p-1 rounded-lg', className)}>
      {PRESETS.map((preset) => {
        const isActive = currentPreset === preset.key;
        const count = counts[preset.key];

        return (
          <button
            key={preset.key}
            onClick={() => handlePresetChange(preset.key)}
            className={cn(
              'inline-flex items-center justify-center rounded-md px-3 h-7 text-xs transition-all',
              isActive
                ? 'bg-background text-foreground shadow-sm font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
          >
            {preset.label}
            {count > 0 && (
              <Badge
                variant={isActive ? 'secondary' : 'outline'}
                className={cn(
                  'ml-1.5 h-5 px-1.5 text-xs font-normal',
                  isActive
                    ? 'bg-foreground/10 text-foreground border-transparent'
                    : 'bg-transparent border-border/50'
                )}
              >
                {count}
              </Badge>
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
