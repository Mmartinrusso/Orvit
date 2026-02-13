'use client';

import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Truck,
  AlertTriangle,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UnidadMovil } from './UnitCard';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  getDay,
  isPast,
} from 'date-fns';
import { es } from 'date-fns/locale';

interface UnitsCalendarProps {
  unidades: UnidadMovil[];
  onUnitClick?: (unidad: UnidadMovil) => void;
  onScheduleService?: (unidad: UnidadMovil) => void;
  className?: string;
}

interface MaintenanceEvent {
  unidad: UnidadMovil;
  date: Date;
  isOverdue: boolean;
}

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function UnitsCalendar({
  unidades,
  onUnitClick,
  onScheduleService,
  className,
}: UnitsCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Get maintenance events for the current month
  const maintenanceEvents = useMemo(() => {
    const events: MaintenanceEvent[] = [];

    unidades.forEach(unidad => {
      if (unidad.proximoMantenimiento) {
        const date = new Date(unidad.proximoMantenimiento);
        events.push({
          unidad,
          date,
          isOverdue: isPast(date) && !isToday(date),
        });
      }
    });

    return events;
  }, [unidades]);

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return maintenanceEvents.filter(event => isSameDay(event.date, day));
  };

  // Calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Add padding days at start
    const startPadding = getDay(monthStart);
    const paddingDays: Date[] = [];
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(monthStart);
      date.setDate(date.getDate() - (i + 1));
      paddingDays.push(date);
    }

    return [...paddingDays, ...days];
  }, [currentMonth]);

  // Stats for the month
  const monthStats = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const monthEvents = maintenanceEvents.filter(
      event => event.date >= monthStart && event.date <= monthEnd
    );

    const overdueCount = maintenanceEvents.filter(event => event.isOverdue).length;
    const upcomingCount = monthEvents.filter(event => !event.isOverdue).length;

    return { overdueCount, upcomingCount, total: monthEvents.length };
  }, [maintenanceEvents, currentMonth]);

  // Units without scheduled maintenance
  const unitsWithoutSchedule = useMemo(() => {
    return unidades.filter(u => !u.proximoMantenimiento && u.estado === 'ACTIVO');
  }, [unidades]);

  return (
    <TooltipProvider delayDuration={300}>
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <CalendarIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Calendario de Mantenimiento</h3>
            <p className="text-xs text-muted-foreground">
              {monthStats.total} servicios programados este mes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {monthStats.overdueCount > 0 && (
            <Badge variant="destructive" className="text-[10px] h-5">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {monthStats.overdueCount} vencidos
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px] h-5">
            {monthStats.upcomingCount} próximos
          </Badge>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h4 className="font-semibold text-sm capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <Card className="p-3">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map(day => (
            <div key={day} className="text-center text-[10px] font-medium text-muted-foreground py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, idx) => {
            const events = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);
            const hasOverdue = events.some(e => e.isOverdue);

            return (
              <div
                key={idx}
                className={cn(
                  'min-h-[60px] p-1 rounded-md border transition-colors',
                  !isCurrentMonth && 'opacity-40',
                  isTodayDate && 'bg-primary/10 border-primary',
                  hasOverdue && 'border-red-300 bg-red-50 dark:bg-red-950/30',
                  events.length > 0 && !hasOverdue && 'bg-blue-50 dark:bg-blue-950/30'
                )}
              >
                <div className={cn(
                  'text-[10px] font-medium mb-1',
                  isTodayDate && 'text-primary',
                  !isCurrentMonth && 'text-muted-foreground'
                )}>
                  {format(day, 'd')}
                </div>

                {/* Events */}
                <div className="space-y-0.5">
                  {events.slice(0, 2).map((event, eventIdx) => (
                    <Tooltip key={eventIdx}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onUnitClick?.(event.unidad)}
                          className={cn(
                            'w-full text-left px-1 py-0.5 rounded text-[9px] truncate transition-colors',
                            event.isOverdue
                              ? 'bg-red-200 text-red-800 hover:bg-red-300 dark:bg-red-900 dark:text-red-200'
                              : 'bg-blue-200 text-blue-800 hover:bg-blue-300 dark:bg-blue-900 dark:text-blue-200'
                          )}
                        >
                          {event.unidad.nombre}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <div className="space-y-1">
                          <p className="font-medium text-xs">{event.unidad.nombre}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {event.unidad.tipo} • {event.unidad.patente}
                          </p>
                          {event.isOverdue && (
                            <Badge variant="destructive" className="text-[9px] h-4">
                              Vencido
                            </Badge>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {events.length > 2 && (
                    <div className="text-[9px] text-muted-foreground text-center">
                      +{events.length - 2} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Units without schedule */}
      {unitsWithoutSchedule.length > 0 && (
        <Card className="p-3 border-amber-200 bg-amber-50/50 dark:bg-amber-950/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                Sin mantenimiento programado
              </span>
            </div>
            <Badge variant="outline" className="text-[10px] h-5 border-amber-300">
              {unitsWithoutSchedule.length} unidades
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unitsWithoutSchedule.slice(0, 6).map(unidad => (
              <Tooltip key={unidad.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onScheduleService?.(unidad)}
                    className="h-7 text-[10px] gap-1 border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                  >
                    <Truck className="h-3 w-3" />
                    {unidad.nombre}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Click para programar service</p>
                </TooltipContent>
              </Tooltip>
            ))}
            {unitsWithoutSchedule.length > 6 && (
              <Badge variant="secondary" className="text-[10px] h-7 px-2">
                +{unitsWithoutSchedule.length - 6} más
              </Badge>
            )}
          </div>
        </Card>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-200 dark:bg-blue-900" />
          <span>Programado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-200 dark:bg-red-900" />
          <span>Vencido</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-primary bg-primary/10" />
          <span>Hoy</span>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}

export default UnitsCalendar;
