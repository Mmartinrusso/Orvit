'use client';

import { useRef, useEffect, useMemo } from 'react';
import { addDays, startOfWeek, format, isToday, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface WeekStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const TOTAL_WEEKS = 5; // 2 weeks before + current + 2 weeks after

export function WeekStrip({ selectedDate, onSelectDate }: WeekStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Generate days: 2 weeks before current week through 2 weeks after
  const days = useMemo(() => {
    const currentWeekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const rangeStart = addDays(currentWeekStart, -14); // 2 weeks before
    return Array.from({ length: TOTAL_WEEKS * 7 }, (_, i) => addDays(rangeStart, i));
  }, [selectedDate]);

  // Scroll to center the selected date on mount and when selectedDate changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const selectedIndex = days.findIndex((d) => isSameDay(d, selectedDate));
    if (selectedIndex < 0) return;

    // Each day is ~48px wide + gap, estimate and center
    const dayWidth = 48;
    const scrollTarget = selectedIndex * dayWidth - el.clientWidth / 2 + dayWidth / 2;
    el.scrollTo({ left: scrollTarget, behavior: 'smooth' });
  }, [selectedDate, days]);

  return (
    <div className="px-4 pt-1 pb-3">
      <div
        ref={scrollRef}
        className="flex items-center bg-muted/30 shadow-[0_0_0_0.5px_rgba(0,0,0,0.15)] rounded-2xl p-1 gap-1 overflow-x-auto no-scrollbar"
      >
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentDay = isToday(day);
          const isSun = day.getDay() === 0;

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={cn(
                'shrink-0 w-[46px] flex flex-col items-center gap-0.5 py-1.5 rounded-xl',
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
