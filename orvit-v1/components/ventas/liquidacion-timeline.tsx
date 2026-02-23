'use client';

import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TimelineEvent {
  label: string;
  date?: string | Date | null;
  user?: string | null;
  completed: boolean;
  active?: boolean;
}

interface LiquidacionTimelineProps {
  liquidacion: {
    estado: string;
    createdAt: string;
    createdByUser?: { name: string } | null;
    confirmadoAt?: string | null;
    confirmadoByUser?: { name: string } | null;
    pagadoAt?: string | null;
    pagadoByUser?: { name: string } | null;
  };
}

export function LiquidacionTimeline({ liquidacion }: LiquidacionTimelineProps) {
  const isAnulada = liquidacion.estado === 'ANULADA';

  const events: TimelineEvent[] = [
    {
      label: 'Creada',
      date: liquidacion.createdAt,
      user: liquidacion.createdByUser?.name,
      completed: true,
    },
    {
      label: 'Confirmada',
      date: liquidacion.confirmadoAt,
      user: liquidacion.confirmadoByUser?.name,
      completed: ['CONFIRMADA', 'PAGADA'].includes(liquidacion.estado),
      active: liquidacion.estado === 'BORRADOR' && !isAnulada,
    },
    {
      label: 'Pagada',
      date: liquidacion.pagadoAt,
      user: liquidacion.pagadoByUser?.name,
      completed: liquidacion.estado === 'PAGADA',
      active: liquidacion.estado === 'CONFIRMADA',
    },
  ];

  return (
    <div className="flex items-start gap-0">
      {events.map((event, idx) => (
        <div key={event.label} className="flex items-start">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'w-3 h-3 rounded-full border-2',
                event.completed
                  ? 'bg-primary border-primary'
                  : event.active
                    ? 'bg-background border-primary animate-pulse'
                    : 'bg-muted border-muted-foreground/30'
              )}
            />
            <div className="mt-1.5 text-center">
              <p className={cn(
                'text-xs font-medium',
                event.completed ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {event.label}
              </p>
              {event.date && (
                <p className="text-xs text-muted-foreground">
                  {format(new Date(event.date), 'dd/MM/yy', { locale: es })}
                </p>
              )}
              {event.user && (
                <p className="text-xs text-muted-foreground">{event.user}</p>
              )}
              {!event.completed && event.active && (
                <p className="text-xs text-primary">Pendiente</p>
              )}
            </div>
          </div>
          {idx < events.length - 1 && (
            <div
              className={cn(
                'h-0.5 w-16 mt-1.5',
                event.completed ? 'bg-primary' : 'bg-muted-foreground/20'
              )}
            />
          )}
        </div>
      ))}
      {isAnulada && (
        <div className="flex items-start ml-4">
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-red-500" />
            <p className="text-xs font-medium text-red-500 mt-1.5">Anulada</p>
          </div>
        </div>
      )}
    </div>
  );
}
