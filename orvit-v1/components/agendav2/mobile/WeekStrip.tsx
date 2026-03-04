'use client';

import { addDays, startOfWeek, format, isToday, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface WeekStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function WeekStrip({ selectedDate, onSelectDate }: WeekStripProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="px-4 pt-1 pb-3">
      <div className="flex items-center bg-muted/50 rounded-2xl p-1.5 gap-0.5">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentDay = isToday(day);
          const isSun = day.getDay() === 0;

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl',
                'transition-all duration-200 active:scale-95',
                isSelected && 'bg-foreground shadow-sm',
              )}
            >
              {/* Date number */}
              <span
                className={cn(
                  'text-[16px] font-semibold leading-none',
                  isSelected
                    ? 'text-background'
                    : isCurrentDay
                      ? 'text-red-500 font-bold'
                      : 'text-foreground',
                )}
              >
                {format(day, 'd')}
              </span>

              {/* Day abbreviation */}
              <span
                className={cn(
                  'text-[9px] uppercase tracking-wider leading-none mt-0.5',
                  isSelected
                    ? 'text-background/60 font-semibold'
                    : isCurrentDay
                      ? 'text-red-500/70 font-semibold'
                      : isSun
                        ? 'text-muted-foreground/50'
                        : 'text-muted-foreground/70',
                )}
              >
                {format(day, 'EEE', { locale: es }).toUpperCase()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
