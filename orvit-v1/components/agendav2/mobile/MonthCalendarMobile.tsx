'use client';

import { useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { AgendaTask } from '@/lib/agenda/types';

interface MonthCalendarMobileProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  tasks: AgendaTask[];
  onCollapse: () => void;
}

const DAY_NAMES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function MonthCalendarMobile({
  selectedDate,
  onSelectDate,
  tasks,
  onCollapse,
}: MonthCalendarMobileProps) {
  // Build calendar grid
  const weeks = useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const result: Date[][] = [];
    let day = calStart;
    while (day <= calEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(day);
        day = addDays(day, 1);
      }
      result.push(week);
    }
    return result;
  }, [selectedDate]);

  // Task count per day
  const tasksByDay = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach((t) => {
      if (t.dueDate) {
        const key = format(new Date(t.dueDate), 'yyyy-MM-dd');
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    });
    return map;
  }, [tasks]);

  return (
    <div className="px-4 pb-3">
      {/* Month/Year header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground capitalize">
          {format(selectedDate, 'MMMM yyyy', { locale: es })}
        </h3>
        <button
          onClick={onCollapse}
          className="text-xs font-medium text-primary"
        >
          Semana
        </button>
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {DAY_NAMES.map((name) => (
          <div key={name} className="text-center">
            <span className="text-[10px] font-medium text-muted-foreground">
              {name}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="space-y-0.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0">
            {week.map((day) => {
              const isSelected = isSameDay(day, selectedDate);
              const isCurrent = isToday(day);
              const inMonth = isSameMonth(day, selectedDate);
              const dayKey = format(day, 'yyyy-MM-dd');
              const taskCount = tasksByDay.get(dayKey) ?? 0;

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => {
                    onSelectDate(day);
                    onCollapse();
                  }}
                  className={cn(
                    'flex flex-col items-center justify-center py-1.5 rounded-xl transition-all active:scale-95',
                    isSelected && 'bg-primary text-primary-foreground',
                    !isSelected && isCurrent && 'bg-primary/10',
                    !inMonth && 'opacity-30'
                  )}
                >
                  <span
                    className={cn(
                      'text-sm',
                      isSelected ? 'font-bold text-primary-foreground' : isCurrent ? 'font-bold text-primary' : 'text-foreground'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {/* Task indicator dots */}
                  {taskCount > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {Array.from({ length: Math.min(taskCount, 3) }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            'w-1 h-1 rounded-full',
                            isSelected ? 'bg-primary-foreground/70' : 'bg-primary'
                          )}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
