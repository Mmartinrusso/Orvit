'use client';

import React, { useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  Clock,
  Wrench,
  UserX,
  Zap,
  AlertTriangle,
  Copy,
} from 'lucide-react';

export type FailurePresetKey = 'all' | 'open' | 'no_ot' | 'downtime' | 'unassigned' | 'p1_p2' | 'duplicates';

export interface FailurePresetFilters {
  status?: string | string[];
  hasWorkOrder?: boolean;
  causedDowntime?: boolean;
  isLinkedDuplicate?: boolean;
  priority?: string[];
  assignee?: string;
}

export interface FailurePreset {
  key: FailurePresetKey;
  label: string;
  icon?: React.ElementType;
  filters: FailurePresetFilters;
  color?: string;
}

export const FAILURE_PRESETS: FailurePreset[] = [
  { key: 'all', label: 'Todas', filters: {} },
  {
    key: 'open',
    label: 'Abiertas',
    icon: AlertCircle,
    filters: { status: ['OPEN', 'IN_PROGRESS'] },
    color: 'text-info-muted-foreground'
  },
  {
    key: 'no_ot',
    label: 'Sin OT',
    icon: Wrench,
    filters: { hasWorkOrder: false, status: ['OPEN', 'IN_PROGRESS'] },
    color: 'text-warning-muted-foreground'
  },
  {
    key: 'downtime',
    label: 'Con downtime',
    icon: Zap,
    filters: { causedDowntime: true },
    color: 'text-destructive'
  },
  {
    key: 'unassigned',
    label: 'Sin asignar',
    icon: UserX,
    filters: { hasWorkOrder: false, status: 'OPEN' },
    color: 'text-warning-muted-foreground'
  },
  {
    key: 'p1_p2',
    label: 'P1/P2',
    icon: AlertTriangle,
    filters: { priority: ['URGENT', 'HIGH'] },
    color: 'text-destructive'
  },
  {
    key: 'duplicates',
    label: 'Duplicados',
    icon: Copy,
    filters: { isLinkedDuplicate: true },
    color: 'text-purple-600'
  },
];

export function useFailurePreset(): FailurePresetKey {
  const searchParams = useSearchParams();
  const preset = searchParams.get('preset') as FailurePresetKey;
  return preset && FAILURE_PRESETS.some(p => p.key === preset) ? preset : 'all';
}

export function useFailurePresetFilters(): FailurePresetFilters {
  const presetKey = useFailurePreset();
  const preset = FAILURE_PRESETS.find(p => p.key === presetKey);
  return preset?.filters || {};
}

export function useSetFailurePreset() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (preset: FailurePresetKey) => {
    const params = new URLSearchParams(searchParams.toString());

    if (preset === 'all') {
      params.delete('preset');
    } else {
      params.set('preset', preset);
    }

    const queryString = params.toString();
    router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
  };
}

interface FailureOccurrence {
  id: number;
  status: string;
  priority: string;
  causedDowntime?: boolean;
  isLinkedDuplicate?: boolean;
  failureId?: number | null;
}

interface FailuresSavedViewsBarProps {
  failures?: FailureOccurrence[];
  className?: string;
}

export function FailuresSavedViewsBar({ failures = [], className }: FailuresSavedViewsBarProps) {
  const currentPreset = useFailurePreset();
  const setPreset = useSetFailurePreset();

  // Calcular conteos para cada preset
  const presetCounts = useMemo(() => {
    const counts: Record<FailurePresetKey, number> = {
      all: failures.length,
      open: 0,
      no_ot: 0,
      downtime: 0,
      unassigned: 0,
      p1_p2: 0,
      duplicates: 0,
    };

    failures.forEach((f) => {
      const isOpen = f.status === 'OPEN' || f.status === 'IN_PROGRESS';
      const hasOT = !!f.failureId;

      if (isOpen) counts.open++;
      if (!hasOT && isOpen) counts.no_ot++;
      if (f.causedDowntime) counts.downtime++;
      if (!hasOT && f.status === 'OPEN') counts.unassigned++;
      if (f.priority === 'URGENT' || f.priority === 'HIGH') counts.p1_p2++;
      if (f.isLinkedDuplicate) counts.duplicates++;
    });

    return counts;
  }, [failures]);

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {FAILURE_PRESETS.map((preset) => {
        const Icon = preset.icon;
        const isActive = currentPreset === preset.key;
        const count = presetCounts[preset.key];

        return (
          <button
            key={preset.key}
            onClick={() => setPreset(preset.key)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
              'border hover:shadow-sm',
              isActive
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  'h-3 w-3',
                  isActive ? 'text-primary-foreground' : preset.color
                )}
              />
            )}
            <span>{preset.label}</span>
            {count > 0 && (
              <Badge
                variant={isActive ? 'secondary' : 'outline'}
                className={cn(
                  'ml-1 h-5 min-w-[1rem] px-1 text-xs font-semibold',
                  isActive && 'bg-primary-foreground/20 text-primary-foreground'
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

export default FailuresSavedViewsBar;
