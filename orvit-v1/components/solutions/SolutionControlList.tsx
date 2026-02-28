'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SolutionControlCompleteModal } from './SolutionControlCompleteModal';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  SkipForward,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Types ─────────────────────────────────────────────────────────────────
type ControlStatus = 'WAITING' | 'PENDING' | 'NOTIFIED' | 'COMPLETED' | 'OVERDUE' | 'SKIPPED';

interface ControlInstance {
  id: number;
  order: number;
  delayMinutes: number;
  description: string;
  scheduledAt: string | null;
  status: ControlStatus;
  completedAt: string | null;
  outcome: string | null;
  notes: string | null;
  requiresFollowup: boolean;
  solutionAppliedId: number;
  completedBy: { id: number; name: string } | null;
}

interface Props {
  solutionAppliedId: number;
}

// ─── Status styles ──────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  ControlStatus,
  { label: string; icon: typeof Clock; iconClass: string; badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  WAITING: {
    label: 'Esperando',
    icon: Clock,
    iconClass: 'text-muted-foreground',
    badgeVariant: 'secondary',
  },
  PENDING: {
    label: 'Pendiente',
    icon: Clock,
    iconClass: 'text-warning',
    badgeVariant: 'outline',
  },
  NOTIFIED: {
    label: 'Notificado',
    icon: AlertCircle,
    iconClass: 'text-warning',
    badgeVariant: 'outline',
  },
  COMPLETED: {
    label: 'Completado',
    icon: CheckCircle2,
    iconClass: 'text-success',
    badgeVariant: 'secondary',
  },
  OVERDUE: {
    label: 'Vencido',
    icon: XCircle,
    iconClass: 'text-destructive',
    badgeVariant: 'destructive',
  },
  SKIPPED: {
    label: 'Saltado',
    icon: SkipForward,
    iconClass: 'text-muted-foreground',
    badgeVariant: 'secondary',
  },
};

function outcomeLabel(outcome: string | null) {
  if (!outcome) return null;
  const map: Record<string, string> = { OK: '✅ OK', PARCIAL: '⚠️ Parcial', NOK: '❌ No OK' };
  return map[outcome] ?? outcome;
}

function delayLabel(delayMinutes: number): string {
  if (delayMinutes < 60) return `${delayMinutes}min`;
  if (delayMinutes % 1440 === 0) return `${delayMinutes / 1440}d`;
  return `${Math.round(delayMinutes / 60 * 10) / 10}hs`;
}

// ─── Main Component ─────────────────────────────────────────────────────────
export function SolutionControlList({ solutionAppliedId }: Props) {
  const queryClient = useQueryClient();
  const [completeModal, setCompleteModal] = useState<ControlInstance | null>(null);
  const [skippingId, setSkippingId] = useState<number | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['solution-controls', solutionAppliedId],
    queryFn: async () => {
      const res = await fetch(`/api/solutions-applied/${solutionAppliedId}/controls`);
      if (!res.ok) throw new Error('Error al cargar controles');
      return res.json() as Promise<{
        controls: ControlInstance[];
        summary: { total: number; completed: number; pending: number; overdue: number };
      }>;
    },
    refetchInterval: 30_000, // Auto-refresh each 30s
  });

  const handleSkip = async (ctrl: ControlInstance) => {
    setSkippingId(ctrl.id);
    try {
      const res = await fetch(
        `/api/solutions-applied/${solutionAppliedId}/controls/${ctrl.id}/skip`,
        { method: 'POST' }
      );
      if (!res.ok) throw new Error('Error al saltar control');
      toast.success(`Control #${ctrl.order} saltado`);
      queryClient.invalidateQueries({ queryKey: ['solution-controls', solutionAppliedId] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSkippingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        {[1, 2].map(i => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No se pudieron cargar los controles.
      </p>
    );
  }

  const { controls, summary } = data;

  if (controls.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Esta solución no tiene plan de control.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{summary.total} controles</span>
        {summary.completed > 0 && (
          <span className="text-success">· {summary.completed} completados</span>
        )}
        {summary.pending > 0 && (
          <span className="text-warning">· {summary.pending} pendientes</span>
        )}
        {summary.overdue > 0 && (
          <span className="text-destructive">· {summary.overdue} vencidos</span>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {controls.map((ctrl, idx) => {
          const cfg = STATUS_CONFIG[ctrl.status] ?? STATUS_CONFIG.PENDING;
          const Icon = cfg.icon;
          const canAct = ctrl.status === 'PENDING' || ctrl.status === 'NOTIFIED' || ctrl.status === 'OVERDUE';
          const isWaiting = ctrl.status === 'WAITING';

          return (
            <div
              key={ctrl.id}
              className={cn(
                'flex gap-3 p-3 rounded-lg border bg-card',
                isWaiting && 'opacity-50'
              )}
            >
              {/* Icon + connector */}
              <div className="flex flex-col items-center pt-0.5">
                <Icon className={cn('h-4 w-4 shrink-0', cfg.iconClass)} />
                {idx < controls.length - 1 && (
                  <div className="w-px flex-1 bg-border mt-1.5 min-h-3" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs text-muted-foreground mr-1.5">
                      Paso {ctrl.order}
                      {ctrl.order > 1 && ` · ${delayLabel(ctrl.delayMinutes)} después del anterior`}
                      {ctrl.order === 1 && ` · ${delayLabel(ctrl.delayMinutes)} tras la solución`}
                    </span>
                    <p className="text-sm font-medium leading-snug">{ctrl.description}</p>
                  </div>
                  <Badge variant={cfg.badgeVariant} className="shrink-0 text-xs">
                    {cfg.label}
                  </Badge>
                </div>

                {/* Scheduled time */}
                {ctrl.scheduledAt && (
                  <p className="text-xs text-muted-foreground">
                    {ctrl.status === 'COMPLETED' || ctrl.status === 'SKIPPED'
                      ? `Completado ${ctrl.completedAt ? formatDistanceToNow(new Date(ctrl.completedAt), { addSuffix: true, locale: es }) : ''}`
                      : `Programado: ${format(new Date(ctrl.scheduledAt), "d MMM HH:mm", { locale: es })} (${formatDistanceToNow(new Date(ctrl.scheduledAt), { addSuffix: true, locale: es })})`
                    }
                  </p>
                )}

                {/* Completion details */}
                {ctrl.status === 'COMPLETED' && (
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {ctrl.outcome && (
                      <span className="text-xs">{outcomeLabel(ctrl.outcome)}</span>
                    )}
                    {ctrl.completedBy && (
                      <span className="text-xs text-muted-foreground">
                        por {ctrl.completedBy.name}
                      </span>
                    )}
                    {ctrl.requiresFollowup && (
                      <Badge variant="outline" className="text-xs h-4">
                        Seguimiento requerido
                      </Badge>
                    )}
                    {ctrl.notes && (
                      <p className="text-xs text-muted-foreground w-full italic">
                        "{ctrl.notes}"
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                {canAct && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs"
                      onClick={() => setCompleteModal(ctrl)}
                    >
                      Completar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground"
                      disabled={skippingId === ctrl.id}
                      onClick={() => handleSkip(ctrl)}
                    >
                      {skippingId === ctrl.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <SkipForward className="h-3 w-3 mr-1" />
                      }
                      Saltar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Complete Modal */}
      {completeModal && (
        <SolutionControlCompleteModal
          instance={completeModal}
          open={!!completeModal}
          onOpenChange={open => { if (!open) setCompleteModal(null); }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['solution-controls', solutionAppliedId] });
          }}
        />
      )}
    </div>
  );
}
