/**
 * Utilidades de presentación compartidas para el módulo de Mantenimiento.
 * Centraliza labels, colores y formatos para evitar duplicación entre componentes.
 */

export const getPriorityLabel = (priority: string): string => {
  switch (priority?.toUpperCase()) {
    case 'HIGH':     return 'Alta';
    case 'MEDIUM':   return 'Media';
    case 'LOW':      return 'Baja';
    case 'CRITICAL': return 'Crítica';
    case 'URGENT':   return 'Urgente';
    case 'P1':       return 'Urgente';
    case 'P2':       return 'Alta';
    case 'P3':       return 'Media';
    case 'P4':       return 'Baja';
    default:         return priority ?? 'Sin prioridad';
  }
};

export const getPriorityColor = (priority: string): string => {
  switch (priority?.toUpperCase()) {
    case 'CRITICAL':
    case 'URGENT':
    case 'P1':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'HIGH':
    case 'P2':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'MEDIUM':
    case 'P3':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'LOW':
    case 'P4':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const translateExecutionWindow = (window: string): string => {
  const normalized = (window || '').toUpperCase().trim();
  switch (normalized) {
    case 'NONE':
    case '':
      return 'Sin especificar';
    case 'MORNING':            return 'Mañana';
    case 'AFTERNOON':          return 'Tarde';
    case 'NIGHT':              return 'Noche';
    case 'EVENING':            return 'Tarde-Noche';
    case 'ANY':
    case 'ANYTIME':
    case 'ANY_TIME':
    case 'ANY TIME':
      return 'Cualquier momento';
    case 'BEFORE_PRODUCTION':
    case 'BEFORE PRODUCTION':
      return 'Antes de producción';
    case 'AFTER_PRODUCTION':
    case 'AFTER PRODUCTION':
      return 'Después de producción';
    case 'DURING_PRODUCTION':
    case 'DURING PRODUCTION':
      return 'Durante producción';
    default:
      return 'Cualquier momento';
  }
};

export const formatFrequency = (frequency: number | string): string => {
  if (typeof frequency === 'string') {
    switch (frequency.toUpperCase()) {
      case 'DAILY':     return 'Diario';
      case 'WEEKLY':    return 'Semanal';
      case 'BIWEEKLY':  return 'Quincenal';
      case 'MONTHLY':   return 'Mensual';
      case 'QUARTERLY': return 'Trimestral';
      case 'YEARLY':    return 'Anual';
      default:          return frequency;
    }
  }
  if (frequency === 1)   return 'Diario';
  if (frequency === 7)   return 'Semanal';
  if (frequency === 14)  return 'Quincenal';
  if (frequency === 30)  return 'Mensual';
  if (frequency === 90)  return 'Trimestral';
  if (frequency === 365) return 'Anual';
  return `Cada ${frequency} días`;
};

export const getStatusLabel = (status: string): string => {
  switch (status?.toUpperCase()) {
    case 'PENDING':             return 'Pendiente';
    case 'IN_PROGRESS':         return 'En progreso';
    case 'COMPLETED':           return 'Completado';
    case 'CANCELLED':           return 'Cancelado';
    case 'PARTIALLY_COMPLETED': return 'Parcialmente completado';
    case 'OVERDUE':             return 'Vencido';
    default:                    return status ?? 'Desconocido';
  }
};
