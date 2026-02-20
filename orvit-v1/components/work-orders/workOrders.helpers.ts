/**
 * Work Orders Helpers - Mappers, formatters y estilos centralizados
 * ================================================================
 * Este archivo centraliza toda la lógica de transformación de datos,
 * labels en español, estilos de badges y formateo de fechas.
 */

import { WorkOrderStatus, Priority, MaintenanceType } from '@/lib/types';
import { formatDistanceToNow, format, isAfter, isBefore, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

// =============================================================================
// LABELS EN ESPAÑOL (nunca mostrar enums crudos)
// =============================================================================

export const statusLabels: Record<WorkOrderStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En proceso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  ON_HOLD: 'En espera',
};

export const priorityLabels: Record<Priority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export const maintenanceTypeLabels: Record<MaintenanceType, string> = {
  PREVENTIVE: 'Preventivo',
  CORRECTIVE: 'Correctivo',
  PREDICTIVE: 'Predictivo',
  EMERGENCY: 'Emergencia',
};

// Labels para el wizard de creación
export const wizardTypeLabels = {
  CORRECTIVE: {
    title: 'Reparar algo que se rompió',
    subtitle: 'Correctivo - Algo dejó de funcionar',
    icon: 'wrench',
  },
  PREVENTIVE: {
    title: 'Preparar para el futuro',
    subtitle: 'Preventivo - Mantenimiento programado',
    icon: 'calendar',
  },
  EMERGENCY: {
    title: 'Urgente - Parar todo',
    subtitle: 'Emergencia - Requiere atención inmediata',
    icon: 'alertTriangle',
  },
  PREDICTIVE: {
    title: 'Mejorar o actualizar',
    subtitle: 'Predictivo - Basado en análisis',
    icon: 'trendingUp',
  },
};

// =============================================================================
// FUNCIONES DE LABEL
// =============================================================================

export function getStatusLabel(status: WorkOrderStatus): string {
  return statusLabels[status] || status;
}

export function getPriorityLabel(priority: Priority): string {
  return priorityLabels[priority] || priority;
}

export function getMaintenanceTypeLabel(type: MaintenanceType): string {
  return maintenanceTypeLabels[type] || type;
}

// =============================================================================
// ESTILOS DE BADGES (suaves, sin colores chillones)
// =============================================================================

export const statusColors: Record<WorkOrderStatus, string> = {
  PENDING: 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
  IN_PROGRESS: 'bg-info-muted text-info-muted-foreground border-info-muted',
  COMPLETED: 'bg-success-muted text-success border-success-muted',
  CANCELLED: 'bg-muted text-muted-foreground border-border',
  ON_HOLD: 'bg-primary/10 text-primary border-primary/20',
};

export const priorityColors: Record<Priority, string> = {
  LOW: 'bg-muted text-muted-foreground border-border',
  MEDIUM: 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
  HIGH: 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
  URGENT: 'bg-destructive/10 text-destructive border-destructive/20',
};

export const maintenanceTypeColors: Record<MaintenanceType, string> = {
  PREVENTIVE: 'bg-success-muted text-success border-success-muted',
  CORRECTIVE: 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
  PREDICTIVE: 'bg-info-muted text-info-muted-foreground border-info-muted',
  EMERGENCY: 'bg-destructive/10 text-destructive border-destructive/20',
};

// Colores para indicadores laterales de estado (barra izquierda de cards)
export const statusIndicatorColors: Record<WorkOrderStatus, string> = {
  PENDING: 'bg-warning',
  IN_PROGRESS: 'bg-info',
  COMPLETED: 'bg-success',
  CANCELLED: 'bg-muted-foreground',
  ON_HOLD: 'bg-primary',
};

// Colores para dots de KPIs
export const kpiDotColors = {
  total: 'bg-primary',
  pending: 'bg-warning',
  inProgress: 'bg-info',
  overdue: 'bg-destructive',
  unassigned: 'bg-muted-foreground',
  completed: 'bg-success',
};

// =============================================================================
// FORMATEO DE FECHAS
// =============================================================================

/**
 * Formatea una fecha en formato legible
 * @example formatDate(new Date()) => "15 Ene 2024"
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  try {
    return format(new Date(date), 'dd MMM yyyy', { locale: es });
  } catch {
    return '—';
  }
}

/**
 * Formatea una fecha en formato corto
 * @example formatDateShort(new Date()) => "15 Ene"
 */
export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return '—';
  try {
    return format(new Date(date), 'dd MMM', { locale: es });
  } catch {
    return '—';
  }
}

/**
 * Formatea una fecha en formato corto con hora (para Argentina)
 * @example formatDateShortWithTime(new Date()) => "15 Ene, 14:30"
 */
export function formatDateShortWithTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  try {
    return format(new Date(date), 'dd MMM, HH:mm', { locale: es });
  } catch {
    return '—';
  }
}

/**
 * Formatea una fecha con hora
 * @example formatDateTime(new Date()) => "15 Ene 2024, 14:30"
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  try {
    return format(new Date(date), 'dd MMM yyyy, HH:mm', { locale: es });
  } catch {
    return '—';
  }
}

/**
 * Retorna tiempo relativo
 * @example relativeTime(new Date()) => "hace 2 días"
 */
export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
  } catch {
    return '—';
  }
}

/**
 * Retorna tiempo relativo sin "hace"
 * @example relativeTimeShort(new Date()) => "2 días"
 */
export function relativeTimeShort(date: Date | string | null | undefined): string {
  if (!date) return '—';
  try {
    return formatDistanceToNow(new Date(date), { locale: es });
  } catch {
    return '—';
  }
}

// =============================================================================
// LÓGICA DE NEGOCIO / HELPERS
// =============================================================================

/**
 * Verifica si una orden está vencida
 */
export function isOverdue(
  scheduledDate: Date | string | null | undefined,
  status: WorkOrderStatus
): boolean {
  if (!scheduledDate) return false;
  if (status === WorkOrderStatus.COMPLETED || status === WorkOrderStatus.CANCELLED) {
    return false;
  }
  try {
    return isBefore(new Date(scheduledDate), new Date());
  } catch {
    return false;
  }
}

/**
 * Calcula días hasta vencimiento
 * @returns número positivo = días restantes, negativo = días vencidos, 0 = hoy
 */
export function daysUntilDue(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  try {
    return differenceInDays(new Date(date), new Date());
  } catch {
    return null;
  }
}

/**
 * Retorna texto de vencimiento
 * @example getDueText(date, status) => "Vence en 3 días" | "Vencida hace 2 días" | "Hoy"
 */
export function getDueText(
  date: Date | string | null | undefined,
  status: WorkOrderStatus
): string | null {
  if (!date) return null;
  if (status === WorkOrderStatus.COMPLETED || status === WorkOrderStatus.CANCELLED) {
    return null;
  }

  const days = daysUntilDue(date);
  if (days === null) return null;

  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  if (days > 1) return `Vence en ${days} días`;
  if (days === -1) return 'Vencida ayer';
  return `Vencida hace ${Math.abs(days)} días`;
}

/**
 * Obtiene las iniciales de un nombre
 * @example getInitials("Juan Pérez") => "JP"
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Formatea horas (convierte minutos a formato legible)
 * @example formatHours(90) => "1h 30m"
 */
export function formatHours(minutes: number | null | undefined): string {
  if (!minutes && minutes !== 0) return '—';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Formatea costo
 * @example formatCost(1500) => "$1.500"
 */
export function formatCost(amount: number | null | undefined, currency = '$'): string {
  if (!amount && amount !== 0) return '—';
  return `${currency}${amount.toLocaleString('es-AR')}`;
}

/**
 * Remueve tags HTML y retorna solo texto plano
 * @example stripHtml("<p>Hola mundo</p>") => "Hola mundo"
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  // Reemplazar <br>, <p>, <div> por espacios para mantener separación
  let text = html.replace(/<(br|p|div)[^>]*>/gi, ' ');
  // Remover todos los tags HTML
  text = text.replace(/<[^>]*>/g, '');
  // Decodificar entidades HTML comunes
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Limpiar espacios múltiples
  text = text.replace(/\s+/g, ' ').trim();
  return text || 'Sin descripción';
}

/**
 * Formatea duración considerando el timeUnit de la WorkOrder
 * Convierte actualHours (almacenado en horas) según timeUnit
 * @example formatDuration(1.5, 'hours') => "1h 30m"
 * @example formatDuration(0.5, 'hours') => "30m"
 * @example formatDuration(30, 'minutes') => "30m"
 */
export function formatDuration(actualHours: number | null | undefined, timeUnit?: string | null): string {
  if (!actualHours && actualHours !== 0) return '—';

  // Si timeUnit es 'minutes', actualHours está en minutos
  // Si timeUnit es 'hours' o undefined, actualHours está en horas
  const minutes = timeUnit === 'minutes'
    ? actualHours
    : actualHours * 60;

  return formatHours(minutes);
}

// =============================================================================
// ACCIONES CONTEXTUALES POR ESTADO
// =============================================================================

export type ContextualAction = {
  label: string;
  icon: string;
  targetStatus: WorkOrderStatus;
  variant: 'default' | 'secondary' | 'outline' | 'ghost';
};

/**
 * Obtiene la acción principal según el estado actual
 */
export function getPrimaryActionByStatus(status: WorkOrderStatus): ContextualAction | null {
  switch (status) {
    case WorkOrderStatus.PENDING:
      return {
        label: 'Iniciar',
        icon: 'play',
        targetStatus: WorkOrderStatus.IN_PROGRESS,
        variant: 'default',
      };
    case WorkOrderStatus.IN_PROGRESS:
      return {
        label: 'Completar',
        icon: 'checkCircle',
        targetStatus: WorkOrderStatus.COMPLETED,
        variant: 'default',
      };
    case WorkOrderStatus.COMPLETED:
      return {
        label: 'Reabrir',
        icon: 'rotateCcw',
        targetStatus: WorkOrderStatus.PENDING,
        variant: 'outline',
      };
    case WorkOrderStatus.ON_HOLD:
      return {
        label: 'Reanudar',
        icon: 'play',
        targetStatus: WorkOrderStatus.IN_PROGRESS,
        variant: 'default',
      };
    default:
      return null;
  }
}

/**
 * Obtiene acciones secundarias disponibles
 */
export function getSecondaryActionsByStatus(status: WorkOrderStatus): ContextualAction[] {
  const actions: ContextualAction[] = [];

  if (status === WorkOrderStatus.PENDING || status === WorkOrderStatus.IN_PROGRESS) {
    actions.push({
      label: 'Pausar',
      icon: 'pause',
      targetStatus: WorkOrderStatus.ON_HOLD,
      variant: 'outline',
    });
  }

  if (status !== WorkOrderStatus.CANCELLED && status !== WorkOrderStatus.COMPLETED) {
    actions.push({
      label: 'Cancelar',
      icon: 'x',
      targetStatus: WorkOrderStatus.CANCELLED,
      variant: 'ghost',
    });
  }

  return actions;
}

// =============================================================================
// PRIORIDAD SUGERIDA POR TIPO DE MANTENIMIENTO
// =============================================================================

export function getSuggestedPriority(type: MaintenanceType): Priority {
  switch (type) {
    case MaintenanceType.EMERGENCY:
      return Priority.URGENT;
    case MaintenanceType.CORRECTIVE:
      return Priority.HIGH;
    case MaintenanceType.PREVENTIVE:
      return Priority.MEDIUM;
    case MaintenanceType.PREDICTIVE:
      return Priority.LOW;
    default:
      return Priority.MEDIUM;
  }
}

// =============================================================================
// TIPOS EXPORTADOS
// =============================================================================

export interface WorkOrderFilters {
  search: string;
  status: WorkOrderStatus | 'ALL' | 'OVERDUE' | null;
  priority: Priority | 'ALL' | null;
  assignee: string; // 'all' | 'unassigned' | 'user-{id}' | 'worker-{id}'
  machineId: number | null;
  maintenanceType: MaintenanceType | 'ALL' | null;
  dateRange: {
    from?: Date;
    to?: Date;
  };
  tags: string[];
  sortBy: 'dueDate' | 'priority' | 'recent' | 'created' | undefined;
  onlyOverdue?: boolean;
  onlyUnassigned?: boolean;
}

export const defaultFilters: WorkOrderFilters = {
  search: '',
  status: null,
  priority: null,
  assignee: 'all',
  machineId: null,
  maintenanceType: null,
  dateRange: {},
  tags: [],
  sortBy: undefined,
  onlyOverdue: false,
  onlyUnassigned: false,
};

// Labels para los selectores de filtros
export const filterStatusLabels: Record<WorkOrderStatus | 'ALL', string> = {
  ALL: 'Todos los estados',
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En proceso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  ON_HOLD: 'En espera',
};

export const filterPriorityLabels: Record<Priority | 'ALL', string> = {
  ALL: 'Todas las prioridades',
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export const filterMaintenanceTypeLabels: Record<MaintenanceType | 'ALL', string> = {
  ALL: 'Todos los tipos',
  PREVENTIVE: 'Preventivo',
  CORRECTIVE: 'Correctivo',
  PREDICTIVE: 'Predictivo',
  EMERGENCY: 'Emergencia',
};

export const sortByLabels: Record<string, string> = {
  dueDate: 'Vence primero',
  priority: 'Mayor prioridad',
  recent: 'Más reciente',
  created: 'Fecha de creación',
};

