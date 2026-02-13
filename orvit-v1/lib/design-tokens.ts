/**
 * Design Tokens - Sistema de Diseño ORVIT
 *
 * Este archivo define los tokens de diseño estándar para mantener
 * consistencia visual en todo el sistema.
 *
 * USO: Importar estos tokens en componentes para asegurar consistencia.
 */

// ============================================
// TAMAÑOS DE DIALOG/SHEET
// ============================================

export const DIALOG_SIZES = {
  /** Para formularios simples, confirmaciones */
  sm: 'max-w-md',
  /** Para formularios medianos, selección de items */
  md: 'max-w-2xl',
  /** Para formularios complejos, tablas pequeñas */
  lg: 'max-w-4xl',
  /** Para dashboards, tablas grandes, vistas completas */
  xl: 'max-w-6xl',
  /** Pantalla completa para gestión compleja */
  full: 'max-w-[95vw]',
} as const;

// Usar dvh (dynamic viewport height) para tener en cuenta barras del navegador (marcadores, etc.)
export const DIALOG_MAX_HEIGHT = 'max-h-[90dvh]';

// Clases completas para DialogContent
export const DIALOG_CONTENT_CLASSES = {
  sm: `${DIALOG_SIZES.sm} ${DIALOG_MAX_HEIGHT} overflow-hidden flex flex-col`,
  md: `${DIALOG_SIZES.md} ${DIALOG_MAX_HEIGHT} overflow-hidden flex flex-col`,
  lg: `${DIALOG_SIZES.lg} ${DIALOG_MAX_HEIGHT} overflow-hidden flex flex-col`,
  xl: `${DIALOG_SIZES.xl} ${DIALOG_MAX_HEIGHT} overflow-hidden flex flex-col`,
  full: `${DIALOG_SIZES.full} ${DIALOG_MAX_HEIGHT} overflow-hidden flex flex-col`,
} as const;

// Para Sheet (side panels)
export const SHEET_SIZES = {
  /** Panel estrecho - detalles rápidos */
  sm: 'w-[400px]',
  /** Panel mediano - formularios */
  md: 'w-[600px]',
  /** Panel amplio - formularios complejos */
  lg: 'w-[800px]',
  /** Panel muy amplio - gestión completa */
  xl: 'w-[1000px]',
} as const;

// ============================================
// TAMAÑOS DE BOTONES
// ============================================

export const BUTTON_SIZES = {
  /** Botones muy pequeños - íconos inline */
  xs: 'h-6 px-2 text-xs',
  /** Botones pequeños - acciones secundarias */
  sm: 'h-8 px-3 text-sm',
  /** Botones normales - acciones principales */
  default: 'h-9 px-4 text-sm',
  /** Botones grandes - CTAs importantes */
  lg: 'h-10 px-6 text-base',
} as const;

// Botones de ícono (cuadrados)
export const ICON_BUTTON_SIZES = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  default: 'h-9 w-9',
  lg: 'h-10 w-10',
} as const;

// ============================================
// TABS
// ============================================

export const TAB_SIZES = {
  /** Tabs compactas - muchas opciones */
  sm: 'h-7 px-2.5 text-xs',
  /** Tabs normales - uso general */
  default: 'h-8 px-3 text-sm',
  /** Tabs grandes - navegación principal */
  lg: 'h-9 px-4 text-sm',
} as const;

export const TAB_LIST_CLASSES = {
  /** TabsList con scroll horizontal */
  scrollable: 'inline-flex h-9 items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground w-full overflow-x-auto gap-1',
  /** TabsList fija sin scroll */
  fixed: 'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
} as const;

// ============================================
// BADGES / CHIPS
// ============================================

export const BADGE_SIZES = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  default: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm',
} as const;

// ============================================
// INPUTS Y FORMULARIOS
// ============================================

export const INPUT_SIZES = {
  sm: 'h-8 text-sm',
  default: 'h-9 text-sm',
  lg: 'h-10 text-base',
} as const;

export const SELECT_SIZES = {
  sm: 'h-8 text-sm',
  default: 'h-9 text-sm',
  lg: 'h-10 text-base',
} as const;

// ============================================
// ESPACIADO
// ============================================

export const SPACING = {
  /** Espaciado mínimo entre elementos relacionados */
  xs: 'gap-1',
  /** Espaciado pequeño */
  sm: 'gap-2',
  /** Espaciado normal */
  default: 'gap-4',
  /** Espaciado amplio */
  lg: 'gap-6',
} as const;

export const PADDING = {
  /** Padding compacto */
  sm: 'p-3',
  /** Padding normal */
  default: 'p-4',
  /** Padding amplio */
  lg: 'p-6',
} as const;

// ============================================
// CARDS Y CONTENEDORES
// ============================================

export const CARD_PADDING = {
  sm: 'p-3',
  default: 'p-4',
  lg: 'p-6',
} as const;

export const CARD_HEADER_CLASSES = 'pb-3 space-y-1';
export const CARD_CONTENT_CLASSES = 'pt-0';

// ============================================
// TABLAS
// ============================================

export const TABLE_CELL_PADDING = {
  sm: 'px-2 py-1.5',
  default: 'px-3 py-2',
  lg: 'px-4 py-3',
} as const;

export const TABLE_HEADER_CLASSES = 'text-xs font-medium text-muted-foreground uppercase tracking-wider';

// ============================================
// ESTADOS Y COLORES
// ============================================

export const STATUS_COLORS = {
  pending: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-200',
    border: 'border-yellow-300 dark:border-yellow-700',
  },
  in_progress: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-300 dark:border-blue-700',
  },
  completed: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-200',
    border: 'border-green-300 dark:border-green-700',
  },
  cancelled: {
    bg: 'bg-gray-100 dark:bg-gray-900/30',
    text: 'text-gray-800 dark:text-gray-200',
    border: 'border-gray-300 dark:border-gray-700',
  },
  overdue: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-200',
    border: 'border-red-300 dark:border-red-700',
  },
} as const;

export const PRIORITY_COLORS = {
  LOW: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-700 dark:text-gray-300',
  },
  MEDIUM: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-300',
  },
  HIGH: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-300',
  },
  CRITICAL: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
  },
} as const;

// ============================================
// ANIMACIONES Y TRANSICIONES
// ============================================

export const TRANSITIONS = {
  fast: 'transition-all duration-150',
  default: 'transition-all duration-200',
  slow: 'transition-all duration-300',
} as const;

// ============================================
// HELPERS - Funciones utilitarias
// ============================================

/**
 * Combina clases de dialog content con tamaño
 */
export function getDialogClasses(size: keyof typeof DIALOG_SIZES = 'md', additionalClasses = '') {
  return `${DIALOG_CONTENT_CLASSES[size]} ${additionalClasses}`.trim();
}

/**
 * Combina clases de button con tamaño
 */
export function getButtonClasses(size: keyof typeof BUTTON_SIZES = 'default', additionalClasses = '') {
  return `${BUTTON_SIZES[size]} ${additionalClasses}`.trim();
}

/**
 * Obtiene colores de estado
 */
export function getStatusClasses(status: string) {
  const normalizedStatus = status.toLowerCase().replace(' ', '_') as keyof typeof STATUS_COLORS;
  return STATUS_COLORS[normalizedStatus] || STATUS_COLORS.pending;
}

/**
 * Obtiene colores de prioridad
 */
export function getPriorityClasses(priority: string) {
  const normalizedPriority = priority.toUpperCase() as keyof typeof PRIORITY_COLORS;
  return PRIORITY_COLORS[normalizedPriority] || PRIORITY_COLORS.MEDIUM;
}
