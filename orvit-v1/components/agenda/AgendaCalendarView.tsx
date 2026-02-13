'use client';

import { useRef, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { Card, CardContent } from '@/components/ui/card';
import type { AgendaTask } from '@/lib/agenda/types';
import { PRIORITY_CONFIG, isTaskOverdue } from '@/lib/agenda/types';

const DEFAULT_COLORS = {
  chart1: '#6366f1',
  chart2: '#8b5cf6',
  chart3: '#ec4899',
  chart4: '#f59e0b',
  chart5: '#10b981',
  chart6: '#06b6d4',
  kpiPositive: '#10b981',
  kpiNegative: '#ef4444',
  kpiNeutral: '#64748b',
};

interface AgendaCalendarViewProps {
  tasks: AgendaTask[];
  onSelect: (task: AgendaTask) => void;
}

export function AgendaCalendarView({ tasks, onSelect }: AgendaCalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const userColors = DEFAULT_COLORS;

  // Convertir tareas a eventos de FullCalendar
  const calendarEvents = useMemo(() => {
    return tasks
      .filter((task) => task.dueDate)
      .map((task) => {
        const overdue = isTaskOverdue(task);
        const isCompleted = task.status === 'COMPLETED';
        const isCancelled = task.status === 'CANCELLED';

        // Color según prioridad y estado
        let backgroundColor = userColors.chart1;
        let borderColor = userColors.chart1;

        if (isCompleted) {
          backgroundColor = userColors.kpiPositive;
          borderColor = userColors.kpiPositive;
        } else if (isCancelled) {
          backgroundColor = userColors.kpiNeutral;
          borderColor = userColors.kpiNeutral;
        } else if (overdue) {
          backgroundColor = userColors.kpiNegative;
          borderColor = userColors.kpiNegative;
        } else {
          switch (task.priority) {
            case 'URGENT':
              backgroundColor = userColors.kpiNegative;
              borderColor = userColors.kpiNegative;
              break;
            case 'HIGH':
              backgroundColor = userColors.chart4;
              borderColor = userColors.chart4;
              break;
            case 'MEDIUM':
              backgroundColor = userColors.chart1;
              borderColor = userColors.chart1;
              break;
            default:
              backgroundColor = userColors.kpiNeutral;
              borderColor = userColors.kpiNeutral;
          }
        }

        return {
          id: `task-${task.id}`,
          title: task.title,
          start: task.dueDate,
          allDay: true,
          backgroundColor: `${backgroundColor}90`,
          borderColor,
          textColor: '#fff',
          extendedProps: {
            type: 'task',
            data: task,
          },
        };
      });
  }, [tasks, userColors]);

  const handleEventClick = (info: any) => {
    const task = info.event.extendedProps.data as AgendaTask;
    onSelect(task);
  };

  return (
    <Card className="h-full">
      <CardContent className="p-4 h-full">
        <style jsx global>{`
          .fc {
            --fc-border-color: hsl(var(--border));
            --fc-today-bg-color: hsl(var(--accent) / 0.3);
          }
          .fc .fc-daygrid-day-number {
            font-size: 0.875rem;
          }
          .fc .fc-event {
            font-size: 0.75rem;
            padding: 2px 4px;
            border-radius: 4px;
          }
          .fc .fc-toolbar-title {
            font-size: 1.125rem;
            font-weight: 600;
          }
          .fc .fc-button {
            font-size: 0.875rem;
          }
          .fc-theme-standard td,
          .fc-theme-standard th {
            border-color: hsl(var(--border));
          }
        `}</style>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={esLocale}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={calendarEvents}
          eventClick={handleEventClick}
          height="100%"
          dayMaxEvents={3}
          moreLinkText={(num) => `+${num} más`}
          buttonText={{
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
            day: 'Día',
          }}
        />
      </CardContent>
    </Card>
  );
}
