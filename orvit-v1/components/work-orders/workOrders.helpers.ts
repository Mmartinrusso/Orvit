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

export const statusLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  INCOMING: 'Pendiente',
  SCHEDULED: 'Programada',
  IN_PROGRESS: 'En proceso',
  WAITING: 'En espera',
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

export const statusColors: Record<string, string> = {
  PENDING: 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
  INCOMING: 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
  SCHEDULED: 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
  IN_PROGRESS: 'bg-info-muted text-info-muted-foreground border-info-muted',
  WAITING: 'bg-primary/10 text-primary border-primary/20',
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
export const statusIndicatorColors: Record<string, string> = {
  PENDING: 'bg-warning',
  INCOMING: 'bg-warning',
  SCHEDULED: 'bg-warning',
  IN_PROGRESS: 'bg-info',
  WAITING: 'bg-primary',
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
  status: string
): boolean {
  if (!scheduledDate) return false;
  if (status === WorkOrderStatus.COMPLETED || status === WorkOrderStatus.CANCELLED || status === 'CANCELLED') {
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
  status: string
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
export const filterStatusLabels: Record<string, string> = {
  ALL: 'Todos los estados',
  PENDING: 'Pendiente',
  INCOMING: 'Pendiente',
  SCHEDULED: 'Programada',
  IN_PROGRESS: 'En proceso',
  WAITING: 'En espera',
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

// =============================================================================
// HEX COLOR CHIP MAPS (inline styles — design system)
// =============================================================================

export const WO_STATUS_CHIP: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  PENDING:     { bg: '#FEF3C7', text: '#92400E', dot: '#D97706', label: 'Pendiente' },
  INCOMING:    { bg: '#FEF3C7', text: '#92400E', dot: '#D97706', label: 'Pendiente' },
  SCHEDULED:   { bg: '#FEF3C7', text: '#92400E', dot: '#D97706', label: 'Programada' },
  IN_PROGRESS: { bg: '#DBEAFE', text: '#1E40AF', dot: '#2563EB', label: 'En proceso' },
  WAITING:     { bg: '#E0E7FF', text: '#3730A3', dot: '#6366F1', label: 'En espera' },
  ON_HOLD:     { bg: '#E0E7FF', text: '#3730A3', dot: '#6366F1', label: 'En espera' },
  COMPLETED:   { bg: '#D1FAE5', text: '#065F46', dot: '#059669', label: 'Completada' },
  CANCELLED:   { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF', label: 'Cancelada' },
};

export const WO_PRIORITY_CHIP: Record<string, { bg: string; text: string; label: string }> = {
  LOW:    { bg: '#F3F4F6', text: '#6B7280', label: 'Baja' },
  MEDIUM: { bg: '#FEF3C7', text: '#92400E', label: 'Media' },
  HIGH:   { bg: '#FED7AA', text: '#C2410C', label: 'Alta' },
  URGENT: { bg: '#FEE2E2', text: '#DC2626', label: 'Urgente' },
};

export const WO_TYPE_CHIP: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  PREVENTIVE: { bg: '#D1FAE5', text: '#065F46', dot: '#059669', label: 'Preventivo' },
  CORRECTIVE: { bg: '#FEF3C7', text: '#92400E', dot: '#D97706', label: 'Correctivo' },
  PREDICTIVE: { bg: '#DBEAFE', text: '#1E40AF', dot: '#2563EB', label: 'Predictivo' },
  EMERGENCY:  { bg: '#FEE2E2', text: '#DC2626', dot: '#DC2626', label: 'Emergencia' },
};

// Hex colors for status indicator bars (left border on cards)
export const WO_STATUS_BAR_COLOR: Record<string, string> = {
  PENDING:     '#D97706',
  INCOMING:    '#D97706',
  SCHEDULED:   '#D97706',
  IN_PROGRESS: '#2563EB',
  WAITING:     '#6366F1',
  ON_HOLD:     '#6366F1',
  COMPLETED:   '#059669',
  CANCELLED:   '#9CA3AF',
};

// Hex colors for KPI dots/icons
export const WO_KPI_COLORS: Record<string, { dot: string; icon: string }> = {
  total:      { dot: '#2563EB', icon: '#2563EB' },
  pending:    { dot: '#D97706', icon: '#D97706' },
  inProgress: { dot: '#2563EB', icon: '#2563EB' },
  overdue:    { dot: '#DC2626', icon: '#DC2626' },
  unassigned: { dot: '#6B7280', icon: '#6B7280' },
  completed:  { dot: '#059669', icon: '#059669' },
};

