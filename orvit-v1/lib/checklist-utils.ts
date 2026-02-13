import { addDays, addWeeks, addMonths, addQuarters, addYears, isAfter, startOfDay } from 'date-fns';

export interface ChecklistExecutionInfo {
  lastExecutionDate?: string;
  frequency: string;
  isCompleted?: boolean;
}

export function shouldResetChecklist(checklist: ChecklistExecutionInfo): boolean {
  if (!checklist.lastExecutionDate || !checklist.isCompleted) {
    return false;
  }

  const lastExecution = new Date(checklist.lastExecutionDate);
  const now = new Date();
  const today = startOfDay(now);

  // Calcular la fecha de reinicio según la frecuencia
  let resetDate: Date;

  switch (checklist.frequency) {
    case 'DAILY':
      resetDate = startOfDay(addDays(lastExecution, 1));
      break;
    case 'WEEKLY':
      resetDate = startOfDay(addWeeks(lastExecution, 1));
      break;
    case 'MONTHLY':
      resetDate = startOfDay(addMonths(lastExecution, 1));
      break;
    case 'QUARTERLY':
      resetDate = startOfDay(addQuarters(lastExecution, 1));
      break;
    case 'SEMIANNUAL':
      resetDate = startOfDay(addMonths(lastExecution, 6));
      break;
    case 'ANNUAL':
      resetDate = startOfDay(addYears(lastExecution, 1));
      break;
    default:
      return false;
  }

  // Si la fecha actual es después de la fecha de reinicio, debe reiniciarse
  return isAfter(today, resetDate);
}

export function getNextResetDate(checklist: ChecklistExecutionInfo): Date | null {
  if (!checklist.lastExecutionDate || !checklist.isCompleted) {
    return null;
  }

  const lastExecution = new Date(checklist.lastExecutionDate);

  switch (checklist.frequency) {
    case 'DAILY':
      return startOfDay(addDays(lastExecution, 1));
    case 'WEEKLY':
      return startOfDay(addWeeks(lastExecution, 1));
    case 'MONTHLY':
      return startOfDay(addMonths(lastExecution, 1));
    case 'QUARTERLY':
      return startOfDay(addQuarters(lastExecution, 1));
    case 'SEMIANNUAL':
      return startOfDay(addMonths(lastExecution, 6));
    case 'ANNUAL':
      return startOfDay(addYears(lastExecution, 1));
    default:
      return null;
  }
}

export function getFrequencyLabel(frequency: string): string {
  const labels = {
    'DAILY': 'Diario',
    'WEEKLY': 'Semanal',
    'MONTHLY': 'Mensual',
    'QUARTERLY': 'Trimestral',
    'SEMIANNUAL': 'Semestral',
    'ANNUAL': 'Anual'
  };
  return labels[frequency as keyof typeof labels] || frequency;
}

export function formatLastExecution(lastExecutionDate?: string): string {
  if (!lastExecutionDate) {
    return 'Nunca';
  }

  const date = new Date(lastExecutionDate);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 60) {
    return `Hace ${diffInMinutes} minutos`;
  } else if (diffInMinutes < 1440) { // menos de 24 horas
    const hours = Math.floor(diffInMinutes / 60);
    const remainingMinutes = diffInMinutes % 60;
    if (remainingMinutes === 0) {
      return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
    } else {
      return `Hace ${hours}h ${remainingMinutes}min`;
    }
  } else if (diffInMinutes < 2880) { // menos de 48 horas
    return 'Ayer';
  } else {
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
}
