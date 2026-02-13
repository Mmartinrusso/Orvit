'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
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
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {PRESETS.map((preset) => {
        const isActive = currentPreset === preset.key;
        const count = counts[preset.key];

        return (
          <Button
            key={preset.key}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetChange(preset.key)}
            className={cn(
              'h-7 text-xs font-normal',
              isActive && 'font-medium'
            )}
          >
            {preset.label}
            {count > 0 && (
              <Badge
                variant={isActive ? 'secondary' : 'outline'}
                className={cn(
                  'ml-1.5 h-4 px-1.5 text-[10px] font-normal',
                  isActive && 'bg-primary-foreground/20 text-primary-foreground'
                )}
              >
                {count}
              </Badge>
            )}
          </Button>
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
