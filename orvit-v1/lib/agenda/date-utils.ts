import { differenceInCalendarDays, isToday, isTomorrow, isPast, format } from 'date-fns';
import { es } from 'date-fns/locale';

export interface DueDateInfo {
  label: string;
  urgent: boolean;
}

export function formatDueDate(date: Date | string | null | undefined): DueDateInfo {
  if (!date) return { label: '', urgent: false };
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return { label: '', urgent: false };

  if (isToday(d)) return { label: 'Vence hoy', urgent: true };
  if (isTomorrow(d)) return { label: 'Vence mañana', urgent: false };

  if (isPast(d)) {
    const days = Math.abs(differenceInCalendarDays(new Date(), d));
    return {
      label: `Venció hace ${days} día${days !== 1 ? 's' : ''}`,
      urgent: true,
    };
  }

  const days = differenceInCalendarDays(d, new Date());
  if (days <= 7) {
    return { label: `En ${days} día${days !== 1 ? 's' : ''}`, urgent: false };
  }

  return { label: format(d, 'd MMM', { locale: es }), urgent: false };
}
