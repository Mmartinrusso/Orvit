/**
 * Catálogo de Widgets FUNCIONALES para Dashboard Personalizable
 * Solo widgets que tienen datos reales de las APIs existentes
 */

import { Permission } from '@/lib/permissions';

export type WidgetSize = 'small' | 'medium' | 'large' | 'full';
export type WidgetCategory = 
  | 'kpis' 
  | 'orders' 
  | 'maintenance'
  | 'machines' 
  | 'tasks' 
  | 'calendar';

// Estilos de visualización
export type WidgetStyle = 
  | 'list'
  | 'cards'
  | 'bar-chart'
  | 'pie-chart'
  | 'donut-chart'
  | 'progress'
  | 'stat-card';

export interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: WidgetCategory;
  defaultSize: WidgetSize;
  cols: number; // Columnas que ocupa (1-4)
  rows: number; // Filas que ocupa
  requiredPermissions: Permission[];
  availableStyles: WidgetStyle[];
  defaultStyle: WidgetStyle;
}

export interface WidgetInstance {
  id: string;
  widgetId: string;
  order: number; // Posición en el dashboard
  style?: WidgetStyle;
}

export interface DashboardLayout {
  widgets: WidgetInstance[];
}

// ===========================================
// CATÁLOGO DE WIDGETS FUNCIONALES
// Solo widgets con APIs que funcionan
// ===========================================

export const WIDGET_CATALOG: WidgetDefinition[] = [
  // ========== KPIs RÁPIDOS (1 columna) ==========
  {
    id: 'kpi-total-orders',
    name: 'Total Órdenes',
    description: 'Órdenes de trabajo del mes',
    icon: 'Hash',
    category: 'kpis',
    defaultSize: 'small',
    cols: 1,
    rows: 1,
    requiredPermissions: ['work_orders.view'],
    availableStyles: ['stat-card'],
    defaultStyle: 'stat-card',
  },
  {
    id: 'kpi-overdue',
    name: 'Vencidas',
    description: 'Órdenes vencidas',
    icon: 'AlertTriangle',
    category: 'kpis',
    defaultSize: 'small',
    cols: 1,
    rows: 1,
    requiredPermissions: ['work_orders.view'],
    availableStyles: ['stat-card'],
    defaultStyle: 'stat-card',
  },
  {
    id: 'kpi-completed',
    name: 'Completadas',
    description: 'Completadas este mes',
    icon: 'CheckCircle',
    category: 'kpis',
    defaultSize: 'small',
    cols: 1,
    rows: 1,
    requiredPermissions: ['work_orders.view'],
    availableStyles: ['stat-card'],
    defaultStyle: 'stat-card',
  },
  {
    id: 'kpi-in-progress',
    name: 'En Progreso',
    description: 'Órdenes activas',
    icon: 'Wrench',
    category: 'kpis',
    defaultSize: 'small',
    cols: 1,
    rows: 1,
    requiredPermissions: ['work_orders.view'],
    availableStyles: ['stat-card'],
    defaultStyle: 'stat-card',
  },

  // ========== ÓRDENES DE TRABAJO (2 columnas) ==========
  {
    id: 'orders-overdue-list',
    name: 'Órdenes Vencidas',
    description: 'Lista de órdenes que requieren atención urgente',
    icon: 'AlertTriangle',
    category: 'orders',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['work_orders.view'],
    availableStyles: ['list', 'cards'],
    defaultStyle: 'list',
  },
  {
    id: 'orders-in-progress',
    name: 'En Progreso',
    description: 'Órdenes actualmente en ejecución',
    icon: 'Wrench',
    category: 'orders',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['work_orders.view'],
    availableStyles: ['list', 'cards'],
    defaultStyle: 'list',
  },
  {
    id: 'orders-completed',
    name: 'Recién Completadas',
    description: 'Últimas órdenes completadas',
    icon: 'CheckCircle',
    category: 'orders',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['work_orders.view'],
    availableStyles: ['list', 'cards'],
    defaultStyle: 'list',
  },
  {
    id: 'orders-by-status',
    name: 'Por Estado',
    description: 'Distribución de órdenes por estado',
    icon: 'BarChart3',
    category: 'orders',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['work_orders.view'],
    availableStyles: ['bar-chart', 'donut-chart', 'list'],
    defaultStyle: 'bar-chart',
  },
  {
    id: 'orders-by-priority',
    name: 'Por Prioridad',
    description: 'Órdenes por nivel de prioridad',
    icon: 'ArrowUpDown',
    category: 'orders',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['work_orders.view'],
    availableStyles: ['bar-chart', 'donut-chart', 'list'],
    defaultStyle: 'donut-chart',
  },

  // ========== MANTENIMIENTO (2-3 columnas) ==========
  {
    id: 'maintenance-type',
    name: 'Preventivo vs Correctivo',
    description: 'Distribución por tipo de mantenimiento',
    icon: 'PieChart',
    category: 'maintenance',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['preventive_maintenance.view'],
    availableStyles: ['donut-chart', 'pie-chart', 'bar-chart', 'progress'],
    defaultStyle: 'donut-chart',
  },
  {
    id: 'maintenance-kpis',
    name: 'KPIs Técnicos',
    description: 'MTTR, MTBF, Disponibilidad',
    icon: 'Gauge',
    category: 'maintenance',
    defaultSize: 'large',
    cols: 3,
    rows: 2,
    requiredPermissions: ['preventive_maintenance.view', 'reports.view'],
    availableStyles: ['stat-card', 'bar-chart'],
    defaultStyle: 'stat-card',
  },

  // ========== MÁQUINAS (2 columnas) ==========
  {
    id: 'machines-status',
    name: 'Estado de Máquinas',
    description: 'Máquinas operativas, en mantenimiento, etc.',
    icon: 'Cog',
    category: 'machines',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['machines.view'],
    availableStyles: ['donut-chart', 'cards', 'list'],
    defaultStyle: 'donut-chart',
  },

  // ========== TAREAS (2 columnas) ==========
  {
    id: 'my-tasks',
    name: 'Mis Tareas',
    description: 'Tareas asignadas a ti',
    icon: 'ListTodo',
    category: 'tasks',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['ingresar_tareas'],
    availableStyles: ['list', 'cards'],
    defaultStyle: 'list',
  },
  {
    id: 'tasks-by-status',
    name: 'Tareas por Estado',
    description: 'Distribución de tareas',
    icon: 'PieChart',
    category: 'tasks',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['tasks.view_all'],
    availableStyles: ['donut-chart', 'bar-chart', 'list'],
    defaultStyle: 'donut-chart',
  },

  // ========== CALENDARIO (2-3 columnas) ==========
  {
    id: 'upcoming-maintenance',
    name: 'Próximos Mantenimientos',
    description: 'Mantenimientos de los próximos 7 días',
    icon: 'CalendarDays',
    category: 'calendar',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['preventive_maintenance.view'],
    availableStyles: ['list', 'cards'],
    defaultStyle: 'list',
  },
  {
    id: 'maintenance-calendar',
    name: 'Calendario de Mantenimientos',
    description: 'Vista mensual con todos los mantenimientos',
    icon: 'Calendar',
    category: 'calendar',
    defaultSize: 'large',
    cols: 2,
    rows: 3,
    requiredPermissions: ['preventive_maintenance.view'],
    availableStyles: ['stat-card'],
    defaultStyle: 'stat-card',
  },
];

// ===========================================
// HELPERS
// ===========================================

export function getAvailableWidgets(userPermissions: string[]): WidgetDefinition[] {
  return WIDGET_CATALOG.filter(widget => {
    return widget.requiredPermissions.some(perm => 
      userPermissions.includes(perm)
    );
  });
}

export function getWidgetsByCategory(
  widgets: WidgetDefinition[], 
  category: WidgetCategory
): WidgetDefinition[] {
  return widgets.filter(w => w.category === category);
}

export function getWidgetById(widgetId: string): WidgetDefinition | undefined {
  return WIDGET_CATALOG.find(w => w.id === widgetId);
}

export function getDefaultLayoutForRole(role: string, permissions: string[]): DashboardLayout {
  const availableWidgets = getAvailableWidgets(permissions);
  
  // Layouts predefinidos según rol
  const layouts: Record<string, string[]> = {
    SUPERADMIN: [
      'kpi-total-orders',
      'kpi-overdue',
      'kpi-completed',
      'kpi-in-progress',
      'orders-by-status',
      'maintenance-type',
      'orders-overdue-list',
      'upcoming-maintenance',
    ],
    ADMIN: [
      'kpi-total-orders',
      'kpi-overdue',
      'kpi-completed',
      'kpi-in-progress',
      'orders-by-status',
      'orders-overdue-list',
    ],
    ADMIN_ENTERPRISE: [
      'kpi-total-orders',
      'kpi-overdue',
      'orders-overdue-list',
      'orders-in-progress',
      'machines-status',
    ],
    SUPERVISOR: [
      'kpi-overdue',
      'kpi-in-progress',
      'orders-overdue-list',
      'my-tasks',
      'upcoming-maintenance',
    ],
    USER: [
      'my-tasks',
      'upcoming-maintenance',
    ],
  };

  const roleWidgets = layouts[role] || layouts.USER;
  const filteredWidgets = roleWidgets.filter(wId => 
    availableWidgets.some(aw => aw.id === wId)
  );

  const widgets: WidgetInstance[] = filteredWidgets.map((widgetId, index) => {
    const widgetDef = getWidgetById(widgetId);
    return {
      id: `${widgetId}-${Date.now()}-${index}`,
      widgetId,
      order: index,
      style: widgetDef?.defaultStyle,
    };
  });

  return { widgets };
}

export const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  kpis: 'Indicadores',
  orders: 'Órdenes de Trabajo',
  maintenance: 'Mantenimiento',
  machines: 'Máquinas',
  tasks: 'Tareas',
  calendar: 'Calendario',
};

export const STYLE_LABELS: Record<WidgetStyle, string> = {
  'list': 'Lista',
  'cards': 'Tarjetas',
  'bar-chart': 'Barras',
  'pie-chart': 'Torta',
  'donut-chart': 'Dona',
  'progress': 'Progreso',
  'stat-card': 'Estadística',
};

export const STYLE_ICONS: Record<WidgetStyle, string> = {
  'list': 'List',
  'cards': 'LayoutGrid',
  'bar-chart': 'BarChart3',
  'pie-chart': 'PieChart',
  'donut-chart': 'Circle',
  'progress': 'SlidersHorizontal',
  'stat-card': 'Square',
};

export const SIZE_LABELS: Record<string, string> = {
  '1x1': '1 col × 1 fila',
  '2x2': '2 cols × 2 filas',
  '3x2': '3 cols × 2 filas',
  '4x2': '4 cols × 2 filas',
};
