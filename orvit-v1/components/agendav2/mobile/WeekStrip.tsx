'use client';

import { addDays, startOfWeek, format, isToday, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface WeekStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function WeekStrip({ selectedDate, onSelectDate }: WeekStripProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="px-4 pt-1 pb-3">
      {/* Day name labels */}
      <div className="flex justify-between mb-1.5">
        {days.map((day) => (
          <div key={day.toISOString()} className="w-9 text-center">
            <span
              style={{
                fontSize: '10px',
                fontWeight: 500,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {format(day, 'EEEEE', { locale: es })}
            </span>
          </div>
        ))}
      </div>

      {/* Day pills */}
      <div className="flex justify-between">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentDay = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95"
              style={{
                backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                boxShadow: isSelected
                  ? '0 2px 8px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)'
                  : 'none',
                color: isSelected
                  ? '#0f172a'
                  : isCurrentDay
                  ? '#06b6d4'
                  : '#64748b',
                fontWeight: isSelected || isCurrentDay ? 700 : 400,
                fontSize: '14px',
              }}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
