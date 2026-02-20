/**
 * Sistema de colores centralizado de Orvit.
 * Único source of truth — no duplicar DEFAULT_COLORS en componentes.
 *
 * Uso:
 *   import { DEFAULT_COLORS } from '@/lib/colors';
 *   import { useUserColors } from '@/hooks/use-user-colors';
 */

export interface UserColorPreferences {
  themeName: string;
  chart1: string;  // Primario   — Azul/Indigo
  chart2: string;  // Secundario — Violeta
  chart3: string;  // Terciario  — Rosa/Magenta
  chart4: string;  // Advertencia — Ámbar/Naranja
  chart5: string;  // Éxito      — Verde/Esmeralda
  chart6: string;  // Info       — Cyan/Turquesa
  kpiPositive: string; // Verde para positivos
  kpiNegative: string; // Rojo para negativos
  kpiNeutral: string;  // Gris para neutrales
}

/** Paleta base — se usa como fallback cuando no hay preferencias del usuario */
export const DEFAULT_COLORS: UserColorPreferences = {
  themeName: 'Predeterminado',
  chart1: '#6366f1',
  chart2: '#8b5cf6',
  chart3: '#ec4899',
  chart4: '#f59e0b',
  chart5: '#10b981',
  chart6: '#06b6d4',
  kpiPositive: '#10b981',
  kpiNegative: '#ef4444',
  kpiNeutral: '#64748b',
};

/** Colores para avatares de usuario (lista circulante) */
export const AVATAR_COLORS: string[] = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#3b82f6', '#ef4444', '#84cc16', '#f97316',
];

/**
 * Devuelve el color correspondiente a una prioridad de tarea/OT.
 * @param priority  Valor de prioridad (URGENT, HIGH, MEDIUM, LOW o equivalentes en español)
 * @param colors    Paleta a usar (default: DEFAULT_COLORS)
 */
export function getPriorityColor(
  priority: string,
  colors: UserColorPreferences = DEFAULT_COLORS
): string {
  const p = priority?.toUpperCase();
  switch (p) {
    case 'URGENT':
    case 'CRITICA':
    case 'CRITICO':
      return colors.kpiNegative;
    case 'HIGH':
    case 'ALTA':
    case 'ALTO':
      return colors.chart4;
    case 'MEDIUM':
    case 'MEDIA':
    case 'MEDIO':
      return colors.chart1;
    case 'LOW':
    case 'BAJA':
    case 'BAJO':
    default:
      return colors.kpiNeutral;
  }
}

/**
 * Devuelve el color correspondiente a un estado de tarea/OT.
 * @param status  Valor de estado (PENDING, IN_PROGRESS, COMPLETED, OVERDUE, etc.)
 * @param colors  Paleta a usar (default: DEFAULT_COLORS)
 */
export function getStatusColor(
  status: string,
  colors: UserColorPreferences = DEFAULT_COLORS
): string {
  const s = status?.toUpperCase();
  switch (s) {
    case 'COMPLETED':
    case 'COMPLETADO':
    case 'DONE':
      return colors.kpiPositive;
    case 'IN_PROGRESS':
    case 'EN_PROGRESO':
    case 'OPEN':
      return colors.chart1;
    case 'OVERDUE':
    case 'VENCIDO':
      return colors.kpiNegative;
    case 'PENDING':
    case 'PENDIENTE':
      return colors.chart4;
    case 'CANCELLED':
    case 'CANCELADO':
    default:
      return colors.kpiNeutral;
  }
}

/**
 * Retorna el color de avatar para un índice dado (circulante).
 */
export function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}
