'use client';

import { useUserColors } from '@/hooks/use-user-colors';
import { useRef, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { Card, CardContent } from '@/components/ui/card';
import type { UnifiedTask } from '@/types/unified-task';
import { isUnifiedTaskOverdue } from '@/types/unified-task';



interface AgendaCalendarViewProps {
  tasks: UnifiedTask[];
  onSelect: (task: UnifiedTask) => void;
}

export function AgendaCalendarView({ tasks, onSelect }: AgendaCalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const userColors = useUserColors();

  // Convertir tareas unificadas a eventos de FullCalendar
  const calendarEvents = useMemo(() => {
    return tasks
      .filter((task) => task.dueDate)
      .map((task) => {
        const overdue = isUnifiedTaskOverdue(task);
        const isCompleted = task.status === 'completed';
        const isCancelled = task.status === 'cancelled';

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
            case 'urgent':
              backgroundColor = userColors.kpiNegative;
              borderColor = userColors.kpiNegative;
              break;
            case 'high':
              backgroundColor = userColors.chart4;
              borderColor = userColors.chart4;
              break;
            case 'medium':
              backgroundColor = userColors.chart1;
              borderColor = userColors.chart1;
              break;
            default:
              backgroundColor = userColors.kpiNeutral;
              borderColor = userColors.kpiNeutral;
          }
        }

        // Diferenciar visualmente tareas regulares con borde punteado
        const classNames = task.origin === 'regular' ? ['fc-event-regular-task'] : [];

        return {
          id: task.uid,
          title: `${task.origin === 'regular' ? '[T] ' : ''}${task.title}`,
          start: task.dueDate,
          allDay: true,
          backgroundColor: `${backgroundColor}B3`,
          borderColor,
          textColor: '#fff',
          classNames,
          extendedProps: {
            type: 'task',
            data: task,
          },
        };
      });
  }, [tasks, userColors]);

  const handleEventClick = (info: any) => {
    const task = info.event.extendedProps.data as UnifiedTask;
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
          .fc-event-regular-task {
            border-style: dashed !important;
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
