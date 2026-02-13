'use client';

/**
 * FailureTimelineTab - Timeline de actividades de una falla
 *
 * Muestra cronológicamente:
 * - Eventos de actividad (ActivityEvent)
 * - Cambios de estado
 * - Comentarios
 * - Eventos de downtime
 * - Creación/actualización de OT
 *
 * P5.1: Timeline unificado
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  FileText,
  MessageSquare,
  Wrench,
  User,
  ClipboardList,
  Flag,
  AlertCircle,
  Timer,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

// ============================================================
// TIPOS
// ============================================================

interface TimelineEvent {
  id: string;
  type: string;
  occurredAt: string;
  title: string;
  description?: string;
  performedBy?: {
    id: number;
    name: string;
    avatar?: string;
  };
  metadata?: Record<string, any>;
  previousValue?: string;
  newValue?: string;
}

interface FailureTimelineTabProps {
  failureOccurrenceId: number;
  workOrderId?: number;
  className?: string;
}

// ============================================================
// CONFIGURACIÓN DE TIPOS DE EVENTOS
// ============================================================

const EVENT_CONFIG: Record<string, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  label: string;
}> = {
  // Falla
  FAILURE_REPORTED: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Falla reportada'
  },
  FAILURE_ASSIGNED: {
    icon: User,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Falla asignada'
  },
  FAILURE_RESOLVED: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Falla resuelta'
  },
  FAILURE_CANCELLED: {
    icon: XCircle,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    label: 'Falla cancelada'
  },
  FAILURE_REOPENED: {
    icon: RefreshCw,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    label: 'Falla reabierta'
  },
  DUPLICATE_LINKED: {
    icon: Flag,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: 'Duplicado vinculado'
  },

  // OT
  WORK_ORDER_CREATED: {
    icon: FileText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'OT creada'
  },
  WORK_ORDER_STARTED: {
    icon: PlayCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'OT iniciada'
  },
  WORK_ORDER_PAUSED: {
    icon: PauseCircle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    label: 'OT pausada'
  },
  WORK_ORDER_WAITING: {
    icon: Clock,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    label: 'OT en espera'
  },
  WORK_ORDER_COMPLETED: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'OT completada'
  },
  STATUS_CHANGED: {
    icon: RefreshCw,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Estado cambiado'
  },

  // Downtime
  DOWNTIME_STARTED: {
    icon: Timer,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Downtime iniciado'
  },
  DOWNTIME_ENDED: {
    icon: PlayCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Downtime finalizado'
  },
  RETURN_TO_PRODUCTION: {
    icon: PlayCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Retorno a producción'
  },

  // Checklists
  CHECKLIST_STARTED: {
    icon: ClipboardList,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Checklist iniciado'
  },
  CHECKLIST_COMPLETED: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Checklist completado'
  },

  // RCA
  RCA_CREATED: {
    icon: AlertCircle,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: 'RCA iniciado'
  },
  RCA_UPDATED: {
    icon: AlertCircle,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: 'RCA actualizado'
  },
  RCA_COMPLETED: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'RCA completado'
  },

  // Soluciones
  SOLUTION_APPLIED: {
    icon: Wrench,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Solución aplicada'
  },
  SOLUTION_SUGGESTED: {
    icon: Wrench,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Solución sugerida'
  },

  // Comentarios
  COMMENT_ADDED: {
    icon: MessageSquare,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    label: 'Comentario agregado'
  },
  MENTION_ADDED: {
    icon: User,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Mención'
  },

  // Default
  DEFAULT: {
    icon: Clock,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    label: 'Evento'
  }
};

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

function TimelineEventCard({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false);

  const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.DEFAULT;
  const Icon = config.icon;

  const hasDetails = event.metadata && Object.keys(event.metadata).length > 0;

  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      {/* Línea vertical */}
      <div className="absolute left-5 top-10 bottom-0 w-px bg-gray-200 last:hidden" />

      {/* Icono */}
      <div className={cn(
        'relative z-10 flex h-10 w-10 items-center justify-center rounded-full',
        config.bgColor
      )}>
        <Icon className={cn('h-5 w-5', config.color)} />
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900">{event.title}</p>
            {event.description && (
              <p className="text-sm text-gray-600 mt-0.5">{event.description}</p>
            )}

            {/* Cambio de valor */}
            {event.previousValue && event.newValue && (
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs bg-gray-50">
                  {event.previousValue}
                </Badge>
                <span className="text-gray-400">→</span>
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                  {event.newValue}
                </Badge>
              </div>
            )}
          </div>

          {/* Tiempo */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(event.occurredAt), {
                addSuffix: true,
                locale: es
              })}
            </span>
            <span className="text-xs text-gray-400">
              {format(new Date(event.occurredAt), 'dd/MM/yyyy HH:mm', { locale: es })}
            </span>
          </div>
        </div>

        {/* Usuario */}
        {event.performedBy && (
          <div className="flex items-center gap-2 mt-2">
            <Avatar className="h-6 w-6">
              {event.performedBy.avatar && (
                <AvatarImage src={event.performedBy.avatar} />
              )}
              <AvatarFallback className="text-xs">
                {event.performedBy.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-gray-600">{event.performedBy.name}</span>
          </div>
        )}

        {/* Detalles expandibles */}
        {hasDetails && (
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-gray-500 hover:text-gray-700 px-2"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Ocultar detalles
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Ver detalles
                </>
              )}
            </Button>

            {expanded && event.metadata && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
                <dl className="space-y-1">
                  {Object.entries(event.metadata).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <dt className="text-gray-500 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').toLowerCase()}:
                      </dt>
                      <dd className="text-gray-900">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineGroupHeader({ date }: { date: string }) {
  const dateObj = new Date(date);
  const isToday = new Date().toDateString() === dateObj.toDateString();
  const isYesterday = new Date(Date.now() - 86400000).toDateString() === dateObj.toDateString();

  let label = format(dateObj, "EEEE, d 'de' MMMM", { locale: es });
  if (isToday) label = 'Hoy';
  if (isYesterday) label = 'Ayer';

  return (
    <div className="sticky top-0 z-20 bg-white py-2 mb-2">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-sm font-medium text-gray-600 capitalize">{label}</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function FailureTimelineTab({
  failureOccurrenceId,
  workOrderId,
  className
}: FailureTimelineTabProps) {
  const [filter, setFilter] = useState<string>('all');

  // Fetch timeline
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['failure-timeline', failureOccurrenceId, workOrderId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (workOrderId) params.set('workOrderId', String(workOrderId));

      const res = await fetch(
        `/api/failure-occurrences/${failureOccurrenceId}/timeline?${params.toString()}`
      );

      if (!res.ok) throw new Error('Error al cargar timeline');
      return res.json();
    },
    staleTime: 30000 // 30 segundos
  });

  // Agrupar eventos por día
  const groupedEvents = useMemo(() => {
    if (!data?.events) return {};

    let events = data.events as TimelineEvent[];

    // Aplicar filtro
    if (filter !== 'all') {
      events = events.filter(e => {
        switch (filter) {
          case 'status':
            return e.type.includes('STATUS') || e.type.includes('STARTED') ||
                   e.type.includes('COMPLETED') || e.type.includes('WAITING');
          case 'downtime':
            return e.type.includes('DOWNTIME') || e.type.includes('RETURN');
          case 'work':
            return e.type.includes('CHECKLIST') || e.type.includes('RCA') ||
                   e.type.includes('SOLUTION');
          case 'comments':
            return e.type.includes('COMMENT') || e.type.includes('MENTION');
          default:
            return true;
        }
      });
    }

    // Agrupar por fecha
    const grouped: Record<string, TimelineEvent[]> = {};
    events.forEach(event => {
      const date = new Date(event.occurredAt).toDateString();
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(event);
    });

    return grouped;
  }, [data?.events, filter]);

  // Ordenar fechas (más reciente primero)
  const sortedDates = useMemo(() => {
    return Object.keys(groupedEvents).sort((a, b) =>
      new Date(b).getTime() - new Date(a).getTime()
    );
  }, [groupedEvents]);

  const totalEvents = data?.events?.length || 0;
  const filteredEvents = Object.values(groupedEvents).flat().length;

  if (isLoading) {
    return (
      <div className={cn('p-4', className)}>
        <TimelineSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4', className)}>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
          <p className="text-gray-600 mb-4">Error al cargar el timeline</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Filtros */}
      <div className="flex items-center justify-between gap-4 p-4 border-b bg-gray-50/50">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Filtrar:</span>
          <div className="flex gap-1">
            {[
              { value: 'all', label: 'Todo' },
              { value: 'status', label: 'Estados' },
              { value: 'downtime', label: 'Downtime' },
              { value: 'work', label: 'Trabajo' },
              { value: 'comments', label: 'Comentarios' }
            ].map(opt => (
              <Button
                key={opt.value}
                variant={filter === opt.value ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFilter(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {filter === 'all'
              ? `${totalEvents} eventos`
              : `${filteredEvents} de ${totalEvents}`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4">
        {sortedDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">Sin actividad</p>
            <p className="text-sm text-gray-500 mt-1">
              {filter === 'all'
                ? 'No hay eventos registrados aún'
                : 'No hay eventos que coincidan con el filtro'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedDates.map(date => (
              <div key={date}>
                <TimelineGroupHeader date={date} />
                <div className="space-y-0">
                  {groupedEvents[date]
                    .sort((a, b) =>
                      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
                    )
                    .map(event => (
                      <TimelineEventCard key={event.id} event={event} />
                    ))
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FailureTimelineTab;
