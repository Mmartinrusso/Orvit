'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { Skeleton } from '@/components/ui/skeleton';
import { usePresetFilters } from './WorkOrdersSavedViewsBar';
import type { EventClickArg } from '@fullcalendar/core';

interface WorkOrdersCalendarViewProps {
  onSelectWorkOrder?: (workOrderId: number) => void;
  className?: string;
}

type ViewType = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';

// Colores por estado
const statusColors: Record<string, { bg: string; border: string }> = {
  PENDING: { bg: '#f59e0b', border: '#d97706' },      // Amber
  IN_PROGRESS: { bg: '#3b82f6', border: '#2563eb' },  // Blue
  COMPLETED: { bg: '#10b981', border: '#059669' },    // Green
  CANCELLED: { bg: '#6b7280', border: '#4b5563' },    // Gray
  ON_HOLD: { bg: '#ef4444', border: '#dc2626' },      // Red
  WAITING: { bg: '#f97316', border: '#ea580c' },      // Orange
};

// Colores por prioridad (para el borde izquierdo)
const priorityColors: Record<string, string> = {
  URGENT: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
};

export function WorkOrdersCalendarView({
  onSelectWorkOrder,
  className
}: WorkOrdersCalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const { currentCompany } = useCompany();
  const presetFilters = usePresetFilters();
  const [currentView, setCurrentView] = useState<ViewType>('dayGridMonth');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [title, setTitle] = useState('');

  // Fetch work orders
  const { data: workOrders = [], isLoading, refetch } = useQuery({
    queryKey: ['work-orders-calendar', currentCompany?.id, presetFilters],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const res = await fetch(`/api/work-orders?companyId=${currentCompany.id}`);
      if (!res.ok) throw new Error('Error al cargar órdenes');
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });

  // Convertir work orders a eventos de calendario
  const calendarEvents = useMemo(() => {
    let filtered = workOrders;

    // Aplicar filtros de preset
    if (presetFilters.type) {
      filtered = filtered.filter((wo: any) => wo.maintenanceType === presetFilters.type);
    }

    return filtered
      .filter((wo: any) => wo.scheduledDate) // Solo OTs con fecha programada
      .map((wo: any) => {
        const statusColor = statusColors[wo.status] || statusColors.PENDING;
        const priorityColor = priorityColors[wo.priority] || priorityColors.MEDIUM;

        return {
          id: wo.id.toString(),
          title: wo.title || 'Sin título',
          start: new Date(wo.scheduledDate),
          end: wo.completedDate ? new Date(wo.completedDate) : undefined,
          backgroundColor: statusColor.bg,
          borderColor: priorityColor,
          borderLeftWidth: '4px',
          textColor: '#ffffff',
          extendedProps: {
            workOrder: wo,
            status: wo.status,
            priority: wo.priority,
            type: wo.maintenanceType,
            machine: wo.machine?.name,
            assignedTo: wo.assignedTo?.name,
          }
        };
      });
  }, [workOrders, presetFilters]);

  // Manejar cambio de vista
  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.changeView(view);
    }
  };

  // Navegación
  const handleToday = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.today();
      setCurrentDate(new Date());
    }
  };

  const handlePrev = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.prev();
      setCurrentDate(calendarApi.getDate());
    }
  };

  const handleNext = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.next();
      setCurrentDate(calendarApi.getDate());
    }
  };

  // Actualizar título
  const updateTitle = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const view = calendarApi.view;

      if (currentView === 'dayGridMonth') {
        const date = view.currentStart;
        setTitle(date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));
      } else if (currentView === 'timeGridWeek') {
        const start = view.currentStart;
        const end = new Date(view.currentEnd);
        end.setDate(end.getDate() - 1);
        const startStr = start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        const endStr = end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
        setTitle(`${startStr} - ${endStr}`);
      } else {
        const date = view.currentStart;
        setTitle(date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
      }
    }
  };

  // Click en evento
  const handleEventClick = (clickInfo: EventClickArg) => {
    const workOrderId = parseInt(clickInfo.event.id);
    onSelectWorkOrder?.(workOrderId);
  };

  // Actualizar título cuando cambia la vista
  useEffect(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const handleDatesSet = () => {
        setCurrentDate(calendarApi.getDate());
        updateTitle();
      };
      calendarApi.on('datesSet', handleDatesSet);
      updateTitle();
      return () => {
        calendarApi.off('datesSet', handleDatesSet);
      };
    }
  }, [currentView]);

  // Stats
  const stats = useMemo(() => {
    const thisMonth = new Date();
    const startOfMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
    const endOfMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 1, 0);

    const thisMonthEvents = calendarEvents.filter((e: any) => {
      const date = new Date(e.start);
      return date >= startOfMonth && date <= endOfMonth;
    });

    return {
      total: thisMonthEvents.length,
      pending: thisMonthEvents.filter((e: any) => e.extendedProps.status === 'PENDING').length,
      inProgress: thisMonthEvents.filter((e: any) => e.extendedProps.status === 'IN_PROGRESS').length,
      completed: thisMonthEvents.filter((e: any) => e.extendedProps.status === 'COMPLETED').length,
    };
  }, [calendarEvents]);

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex justify-between items-center">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-48" />
        </div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Navegación */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleToday} className="h-9 text-xs">
            Hoy
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handlePrev} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[180px] text-center capitalize">
              {title}
            </span>
            <Button variant="ghost" size="sm" onClick={handleNext} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats del mes */}
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="gap-1">
            {stats.total} este mes
          </Badge>
          <Badge variant="outline" className="gap-1 border-warning text-warning-muted-foreground">
            {stats.pending} pendientes
          </Badge>
          <Badge variant="outline" className="gap-1 border-info text-info-muted-foreground">
            {stats.inProgress} en curso
          </Badge>
          <Badge variant="outline" className="gap-1 border-success text-success">
            {stats.completed} completadas
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8 w-8 p-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Selector de vista */}
        <div className="flex bg-muted/40 border border-border rounded-md p-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewChange('dayGridMonth')}
            className={cn(
              'text-xs font-normal h-7 px-3',
              currentView === 'dayGridMonth' && 'bg-background shadow-sm'
            )}
          >
            Mes
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewChange('timeGridWeek')}
            className={cn(
              'text-xs font-normal h-7 px-3',
              currentView === 'timeGridWeek' && 'bg-background shadow-sm'
            )}
          >
            Semana
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewChange('timeGridDay')}
            className={cn(
              'text-xs font-normal h-7 px-3',
              currentView === 'timeGridDay' && 'bg-background shadow-sm'
            )}
          >
            Día
          </Button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: statusColors.PENDING.bg }} />
          <span className="text-muted-foreground">Pendiente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: statusColors.IN_PROGRESS.bg }} />
          <span className="text-muted-foreground">En progreso</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: statusColors.COMPLETED.bg }} />
          <span className="text-muted-foreground">Completada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: statusColors.ON_HOLD.bg }} />
          <span className="text-muted-foreground">Bloqueada</span>
        </div>
      </div>

      {/* Calendario */}
      <Card>
        <CardContent className="p-0">
          <div className="wo-calendar-wrapper">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale={esLocale}
              events={calendarEvents}
              headerToolbar={false}
              height="auto"
              eventClick={handleEventClick}
              dayMaxEvents={3}
              moreLinkText={(n) => `+${n} más`}
              eventDisplay="block"
              eventTextColor="#ffffff"
              dayHeaderFormat={{ weekday: 'short' }}
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              allDaySlot={true}
              allDayText="Todo el día"
              weekends={true}
              firstDay={1}
              contentHeight="auto"
              aspectRatio={1.8}
              eventContent={(eventInfo) => (
                <div className="flex items-center gap-1 px-1 py-0.5 overflow-hidden">
                  <span className="truncate text-xs font-medium">
                    {eventInfo.event.title}
                  </span>
                </div>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Estilos */}
      <style jsx global>{`
        .wo-calendar-wrapper {
          padding: 1rem;
        }

        .wo-calendar-wrapper .fc {
          font-family: inherit;
        }

        .wo-calendar-wrapper .fc-header-toolbar {
          display: none !important;
        }

        .wo-calendar-wrapper .fc-daygrid-day {
          background-color: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          min-height: 100px;
        }

        .wo-calendar-wrapper .fc-daygrid-day-frame {
          min-height: 100px;
          padding: 2px;
        }

        .wo-calendar-wrapper .fc-daygrid-day-number {
          font-size: 0.8rem;
          font-weight: 400;
          padding: 4px 6px;
          color: hsl(var(--foreground));
        }

        .wo-calendar-wrapper .fc-day-today {
          background-color: hsl(var(--accent) / 0.3) !important;
        }

        .wo-calendar-wrapper .fc-day-today .fc-daygrid-day-number {
          font-weight: 600;
          color: hsl(var(--primary));
        }

        .wo-calendar-wrapper .fc-col-header-cell {
          font-size: 0.75rem;
          font-weight: 500;
          padding: 8px 4px;
          background-color: hsl(var(--muted));
          border: 1px solid hsl(var(--border));
          color: hsl(var(--muted-foreground));
          text-transform: capitalize;
        }

        .wo-calendar-wrapper .fc-event {
          border: none;
          border-radius: 4px;
          margin: 1px 2px;
          cursor: pointer;
          transition: opacity 0.15s;
          border-left-width: 3px !important;
          border-left-style: solid !important;
        }

        .wo-calendar-wrapper .fc-event:hover {
          opacity: 0.85;
        }

        .wo-calendar-wrapper .fc-daygrid-event {
          font-size: 0.7rem;
          padding: 2px 4px;
        }

        .wo-calendar-wrapper .fc-more-link {
          font-size: 0.7rem;
          font-weight: 500;
          color: hsl(var(--primary));
          padding: 2px 4px;
        }

        .wo-calendar-wrapper .fc-more-link:hover {
          text-decoration: underline;
        }

        .wo-calendar-wrapper .fc-timegrid-slot {
          border-top: 1px solid hsl(var(--border) / 0.5);
          height: 40px;
        }

        .wo-calendar-wrapper .fc-timegrid-slot-label {
          font-size: 0.7rem;
          color: hsl(var(--muted-foreground));
        }

        .wo-calendar-wrapper .fc-timegrid-col {
          border-left: 1px solid hsl(var(--border));
        }

        .wo-calendar-wrapper .fc-timegrid-event {
          border-radius: 4px;
          font-size: 0.7rem;
        }

        .wo-calendar-wrapper .fc-view-harness {
          background-color: hsl(var(--card));
        }

        .wo-calendar-wrapper .fc-scrollgrid {
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          overflow: hidden;
        }

        .wo-calendar-wrapper .fc-scrollgrid td:last-child {
          border-right: none;
        }

        .wo-calendar-wrapper .fc-scrollgrid tr:last-child td {
          border-bottom: none;
        }

        @media (max-width: 768px) {
          .wo-calendar-wrapper {
            padding: 0.5rem;
          }

          .wo-calendar-wrapper .fc-daygrid-day-number {
            font-size: 0.7rem;
          }

          .wo-calendar-wrapper .fc-col-header-cell {
            font-size: 0.65rem;
            padding: 4px 2px;
          }

          .wo-calendar-wrapper .fc-daygrid-event {
            font-size: 0.65rem;
            padding: 1px 2px;
          }
        }
      `}</style>
    </div>
  );
}

export default WorkOrdersCalendarView;
