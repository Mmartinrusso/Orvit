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
  | 'calendar'
  | 'team'
  | 'analytics';

// Estilos de visualización
export type WidgetStyle =
  | 'list'
  | 'cards'
  | 'bar-chart'
  | 'pie-chart'
  | 'donut-chart'
  | 'area-chart'
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

  // ========== EQUIPO (2 columnas) ==========
  {
    id: 'my-work-orders',
    name: 'Mis OTs Asignadas',
    description: 'Órdenes de trabajo asignadas a ti',
    icon: 'ClipboardList',
    category: 'team',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['work_orders.view'],
    availableStyles: ['list', 'cards'],
    defaultStyle: 'list',
  },
  {
    id: 'my-controls-timeline',
    name: 'Mis Controles',
    description: 'Controles de seguimiento pendientes',
    icon: 'ClipboardCheck',
    category: 'team',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['work_orders.view'],
    availableStyles: ['list'],
    defaultStyle: 'list',
  },
  {
    id: 'my-recent-completions',
    name: 'Mis Completadas',
    description: 'Tus órdenes completadas recientemente',
    icon: 'Trophy',
    category: 'team',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['work_orders.view'],
    availableStyles: ['list', 'cards'],
    defaultStyle: 'list',
  },
  {
    id: 'team-workload',
    name: 'Carga del Equipo',
    description: 'Distribución de trabajo por técnico',
    icon: 'Users',
    category: 'team',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['work_orders.view'],
    availableStyles: ['bar-chart', 'list'],
    defaultStyle: 'bar-chart',
  },
  {
    id: 'failures-open',
    name: 'Fallas Abiertas',
    description: 'Fallas no resueltas del sector',
    icon: 'AlertOctagon',
    category: 'team',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['work_orders.view'],
    availableStyles: ['list', 'donut-chart'],
    defaultStyle: 'list',
  },
  {
    id: 'team-controls-timeline',
    name: 'Controles del Equipo',
    description: 'Controles de seguimiento pendientes del sector',
    icon: 'ClipboardList',
    category: 'team',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['work_orders.view'],
    availableStyles: ['list'],
    defaultStyle: 'list',
  },

  // ========== ANALYTICS (2-3 columnas) ==========
  {
    id: 'trend-completion-6m',
    name: 'Tendencia 6 Meses',
    description: 'Tendencia de completitud de OTs últimos 6 meses',
    icon: 'TrendingUp',
    category: 'analytics',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['preventive_maintenance.view', 'reports.view'],
    availableStyles: ['area-chart', 'bar-chart'],
    defaultStyle: 'area-chart',
  },
  {
    id: 'top-failing-machines',
    name: 'Top Máquinas Fallas',
    description: 'Máquinas con más fallas registradas',
    icon: 'AlertTriangle',
    category: 'analytics',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['preventive_maintenance.view', 'reports.view'],
    availableStyles: ['bar-chart', 'list'],
    defaultStyle: 'bar-chart',
  },
  {
    id: 'cost-by-month',
    name: 'Costos Mensuales',
    description: 'Costos de mantenimiento por mes',
    icon: 'DollarSign',
    category: 'analytics',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['reports.view'],
    availableStyles: ['bar-chart', 'area-chart'],
    defaultStyle: 'bar-chart',
  },
  {
    id: 'cross-sector-comparison',
    name: 'Comparativa Sectores',
    description: 'Métricas comparativas entre sectores',
    icon: 'Building2',
    category: 'analytics',
    defaultSize: 'large',
    cols: 3,
    rows: 2,
    requiredPermissions: ['reports.view'],
    availableStyles: ['bar-chart', 'list'],
    defaultStyle: 'bar-chart',
  },
  {
    id: 'solution-effectiveness',
    name: 'Efectividad Soluciones',
    description: 'Resultado de soluciones aplicadas',
    icon: 'Target',
    category: 'analytics',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['work_orders.view'],
    availableStyles: ['donut-chart', 'bar-chart'],
    defaultStyle: 'donut-chart',
  },
  {
    id: 'health-scores-overview',
    name: 'Health Scores',
    description: 'Salud de máquinas del sector',
    icon: 'Activity',
    category: 'analytics',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['machines.view'],
    availableStyles: ['list', 'bar-chart'],
    defaultStyle: 'list',
  },
  {
    id: 'preventive-compliance',
    name: 'Cumplimiento Preventivo',
    description: 'Tasa de cumplimiento de mantenimientos preventivos',
    icon: 'Shield',
    category: 'analytics',
    defaultSize: 'medium',
    cols: 2,
    rows: 2,
    requiredPermissions: ['preventive_maintenance.view'],
    availableStyles: ['donut-chart', 'progress', 'stat-card'],
    defaultStyle: 'donut-chart',
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
      'maintenance-kpis',
      'trend-completion-6m',
      'top-failing-machines',
      'cost-by-month',
      'cross-sector-comparison',
      'solution-effectiveness',
      'health-scores-overview',
      'preventive-compliance',
    ],
    ADMIN: [
      'maintenance-kpis',
      'trend-completion-6m',
      'top-failing-machines',
      'cost-by-month',
      'health-scores-overview',
      'preventive-compliance',
    ],
    ADMIN_ENTERPRISE: [
      'kpi-total-orders',
      'kpi-overdue',
      'orders-overdue-list',
      'orders-in-progress',
      'machines-status',
    ],
    SUPERVISOR: [
      'team-workload',
      'orders-overdue-list',
      'failures-open',
      'machines-status',
      'my-work-orders',
      'team-controls-timeline',
      'preventive-compliance',
      'upcoming-maintenance',
    ],
    USER: [
      'my-work-orders',
      'my-controls-timeline',
      'my-recent-completions',
      'upcoming-maintenance',
      'my-tasks',
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
  team: 'Equipo',
  analytics: 'Analítica',
};

export const STYLE_LABELS: Record<WidgetStyle, string> = {
  'list': 'Lista',
  'cards': 'Tarjetas',
  'bar-chart': 'Barras',
  'pie-chart': 'Torta',
  'donut-chart': 'Dona',
  'area-chart': 'Área',
  'progress': 'Progreso',
  'stat-card': 'Estadística',
};

export const STYLE_ICONS: Record<WidgetStyle, string> = {
  'list': 'List',
  'cards': 'LayoutGrid',
  'bar-chart': 'BarChart3',
  'pie-chart': 'PieChart',
  'donut-chart': 'Circle',
  'area-chart': 'AreaChart',
  'progress': 'SlidersHorizontal',
  'stat-card': 'Square',
};

export const SIZE_LABELS: Record<string, string> = {
  '1x1': '1 col × 1 fila',
  '2x2': '2 cols × 2 filas',
  '3x2': '3 cols × 2 filas',
  '4x2': '4 cols × 2 filas',
};

// ===========================================
// PLANTILLAS DE DASHBOARD
// ===========================================

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Roles para los que esta plantilla es relevante */
  roles: string[];
  /** IDs de widgets con estilos opcionales */
  widgets: { widgetId: string; style?: WidgetStyle }[];
  /** Color de preview */
  color: string;
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  // ===== OPERADOR =====
  {
    id: 'operador-mi-dia',
    name: 'Mi Día',
    description: 'Todo lo que necesitás para tu jornada: OTs asignadas, tareas, controles pendientes y próximos mantenimientos',
    icon: 'CalendarCheck',
    roles: ['USER', 'SUPERVISOR'],
    color: 'hsl(var(--chart-1))',
    widgets: [
      { widgetId: 'kpi-total-orders', style: 'stat-card' },
      { widgetId: 'kpi-overdue', style: 'stat-card' },
      { widgetId: 'kpi-completed', style: 'stat-card' },
      { widgetId: 'kpi-in-progress', style: 'stat-card' },
      { widgetId: 'my-work-orders', style: 'list' },
      { widgetId: 'my-controls-timeline', style: 'list' },
      { widgetId: 'upcoming-maintenance', style: 'list' },
      { widgetId: 'my-tasks', style: 'list' },
      { widgetId: 'machines-status', style: 'donut-chart' },
      { widgetId: 'my-recent-completions', style: 'list' },
      { widgetId: 'orders-by-priority', style: 'donut-chart' },
      { widgetId: 'maintenance-calendar', style: 'stat-card' },
    ],
  },
  {
    id: 'operador-completo',
    name: 'Operador Completo',
    description: 'Vista 360 del operador: KPIs, OTs, controles, máquinas, tareas, calendario y completadas recientes',
    icon: 'LayoutDashboard',
    roles: ['USER', 'SUPERVISOR'],
    color: 'hsl(var(--primary))',
    widgets: [
      { widgetId: 'kpi-total-orders', style: 'stat-card' },
      { widgetId: 'kpi-overdue', style: 'stat-card' },
      { widgetId: 'kpi-completed', style: 'stat-card' },
      { widgetId: 'kpi-in-progress', style: 'stat-card' },
      { widgetId: 'my-work-orders', style: 'cards' },
      { widgetId: 'my-controls-timeline', style: 'list' },
      { widgetId: 'upcoming-maintenance', style: 'cards' },
      { widgetId: 'machines-status', style: 'donut-chart' },
      { widgetId: 'my-tasks', style: 'list' },
      { widgetId: 'my-recent-completions', style: 'cards' },
      { widgetId: 'orders-by-status', style: 'bar-chart' },
      { widgetId: 'orders-by-priority', style: 'donut-chart' },
      { widgetId: 'maintenance-type', style: 'donut-chart' },
      { widgetId: 'maintenance-calendar', style: 'stat-card' },
    ],
  },
  {
    id: 'operador-visual',
    name: 'Operador Visual',
    description: 'Dashboard rico en gráficos: donas, barras y tarjetas para ver todo de un vistazo',
    icon: 'PieChart',
    roles: ['USER', 'SUPERVISOR'],
    color: 'hsl(var(--chart-4))',
    widgets: [
      { widgetId: 'kpi-total-orders', style: 'stat-card' },
      { widgetId: 'kpi-overdue', style: 'stat-card' },
      { widgetId: 'kpi-completed', style: 'stat-card' },
      { widgetId: 'kpi-in-progress', style: 'stat-card' },
      { widgetId: 'orders-by-status', style: 'donut-chart' },
      { widgetId: 'orders-by-priority', style: 'bar-chart' },
      { widgetId: 'machines-status', style: 'donut-chart' },
      { widgetId: 'maintenance-type', style: 'donut-chart' },
      { widgetId: 'my-work-orders', style: 'cards' },
      { widgetId: 'my-controls-timeline', style: 'list' },
      { widgetId: 'upcoming-maintenance', style: 'list' },
      { widgetId: 'my-tasks', style: 'cards' },
      { widgetId: 'my-recent-completions', style: 'list' },
    ],
  },

  // ===== SUPERVISOR =====
  {
    id: 'supervisor-equipo',
    name: 'Vista de Equipo',
    description: 'Carga de trabajo por técnico, OTs vencidas, fallas abiertas, controles del sector y estado de máquinas',
    icon: 'Users',
    roles: ['SUPERVISOR', 'ADMIN'],
    color: 'hsl(var(--chart-3))',
    widgets: [
      { widgetId: 'kpi-overdue', style: 'stat-card' },
      { widgetId: 'kpi-in-progress', style: 'stat-card' },
      { widgetId: 'kpi-completed', style: 'stat-card' },
      { widgetId: 'kpi-total-orders', style: 'stat-card' },
      { widgetId: 'team-workload', style: 'bar-chart' },
      { widgetId: 'failures-open', style: 'donut-chart' },
      { widgetId: 'orders-overdue-list', style: 'list' },
      { widgetId: 'team-controls-timeline', style: 'list' },
      { widgetId: 'machines-status', style: 'donut-chart' },
      { widgetId: 'preventive-compliance', style: 'donut-chart' },
      { widgetId: 'upcoming-maintenance', style: 'list' },
      { widgetId: 'orders-by-status', style: 'bar-chart' },
      { widgetId: 'my-work-orders', style: 'list' },
      { widgetId: 'maintenance-type', style: 'donut-chart' },
    ],
  },
  {
    id: 'supervisor-operativo',
    name: 'Supervisor Operativo',
    description: 'Balance completo: gestión de equipo + tu trabajo propio con KPIs, gráficos y listas',
    icon: 'Wrench',
    roles: ['SUPERVISOR'],
    color: 'hsl(var(--info))',
    widgets: [
      { widgetId: 'kpi-overdue', style: 'stat-card' },
      { widgetId: 'kpi-in-progress', style: 'stat-card' },
      { widgetId: 'kpi-completed', style: 'stat-card' },
      { widgetId: 'kpi-total-orders', style: 'stat-card' },
      { widgetId: 'team-workload', style: 'list' },
      { widgetId: 'orders-overdue-list', style: 'list' },
      { widgetId: 'my-work-orders', style: 'cards' },
      { widgetId: 'failures-open', style: 'donut-chart' },
      { widgetId: 'team-controls-timeline', style: 'list' },
      { widgetId: 'my-controls-timeline', style: 'list' },
      { widgetId: 'preventive-compliance', style: 'progress' },
      { widgetId: 'machines-status', style: 'donut-chart' },
      { widgetId: 'upcoming-maintenance', style: 'list' },
      { widgetId: 'orders-by-priority', style: 'bar-chart' },
      { widgetId: 'my-tasks', style: 'list' },
      { widgetId: 'maintenance-type', style: 'donut-chart' },
    ],
  },
  {
    id: 'supervisor-analitico',
    name: 'Supervisor Analítico',
    description: 'Métricas del sector, tendencias, cumplimiento preventivo, fallas y efectividad con gráficos avanzados',
    icon: 'TrendingUp',
    roles: ['SUPERVISOR'],
    color: 'hsl(var(--chart-5))',
    widgets: [
      { widgetId: 'kpi-overdue', style: 'stat-card' },
      { widgetId: 'kpi-in-progress', style: 'stat-card' },
      { widgetId: 'kpi-completed', style: 'stat-card' },
      { widgetId: 'kpi-total-orders', style: 'stat-card' },
      { widgetId: 'team-workload', style: 'bar-chart' },
      { widgetId: 'failures-open', style: 'list' },
      { widgetId: 'preventive-compliance', style: 'donut-chart' },
      { widgetId: 'orders-by-status', style: 'donut-chart' },
      { widgetId: 'machines-status', style: 'donut-chart' },
      { widgetId: 'maintenance-type', style: 'bar-chart' },
      { widgetId: 'orders-by-priority', style: 'donut-chart' },
      { widgetId: 'health-scores-overview', style: 'bar-chart' },
      { widgetId: 'orders-overdue-list', style: 'list' },
      { widgetId: 'upcoming-maintenance', style: 'list' },
    ],
  },

  // ===== GERENTE =====
  {
    id: 'gerente-estrategico',
    name: 'Vista Estratégica',
    description: 'KPIs técnicos MTTR/MTBF, tendencias 6 meses, costos, comparativa sectores, fallas y cumplimiento',
    icon: 'TrendingUp',
    roles: ['ADMIN', 'SUPERADMIN', 'ADMIN_ENTERPRISE'],
    color: 'hsl(var(--success))',
    widgets: [
      { widgetId: 'maintenance-kpis', style: 'stat-card' },
      { widgetId: 'trend-completion-6m', style: 'area-chart' },
      { widgetId: 'cost-by-month', style: 'bar-chart' },
      { widgetId: 'cross-sector-comparison', style: 'bar-chart' },
      { widgetId: 'top-failing-machines', style: 'bar-chart' },
      { widgetId: 'solution-effectiveness', style: 'donut-chart' },
      { widgetId: 'health-scores-overview', style: 'list' },
      { widgetId: 'preventive-compliance', style: 'donut-chart' },
      { widgetId: 'orders-by-status', style: 'donut-chart' },
      { widgetId: 'machines-status', style: 'donut-chart' },
      { widgetId: 'maintenance-type', style: 'donut-chart' },
      { widgetId: 'orders-overdue-list', style: 'list' },
    ],
  },
  {
    id: 'gerente-completo',
    name: 'Gerente 360',
    description: 'Visión completa: KPIs, tendencias, equipo, costos, fallas, cumplimiento, máquinas y comparativa de sectores',
    icon: 'BarChart3',
    roles: ['ADMIN', 'SUPERADMIN'],
    color: 'hsl(var(--chart-5))',
    widgets: [
      { widgetId: 'kpi-total-orders', style: 'stat-card' },
      { widgetId: 'kpi-overdue', style: 'stat-card' },
      { widgetId: 'kpi-completed', style: 'stat-card' },
      { widgetId: 'kpi-in-progress', style: 'stat-card' },
      { widgetId: 'maintenance-kpis', style: 'stat-card' },
      { widgetId: 'trend-completion-6m', style: 'area-chart' },
      { widgetId: 'cross-sector-comparison', style: 'bar-chart' },
      { widgetId: 'top-failing-machines', style: 'bar-chart' },
      { widgetId: 'cost-by-month', style: 'bar-chart' },
      { widgetId: 'solution-effectiveness', style: 'donut-chart' },
      { widgetId: 'health-scores-overview', style: 'bar-chart' },
      { widgetId: 'preventive-compliance', style: 'donut-chart' },
      { widgetId: 'orders-overdue-list', style: 'list' },
      { widgetId: 'orders-by-status', style: 'bar-chart' },
      { widgetId: 'orders-by-priority', style: 'donut-chart' },
      { widgetId: 'machines-status', style: 'donut-chart' },
      { widgetId: 'maintenance-type', style: 'donut-chart' },
      { widgetId: 'team-workload', style: 'bar-chart' },
    ],
  },
  {
    id: 'gerente-costos',
    name: 'Control de Costos',
    description: 'Foco en costos mensuales, efectividad de soluciones, tendencias y comparativa de sectores',
    icon: 'DollarSign',
    roles: ['ADMIN', 'SUPERADMIN'],
    color: 'hsl(var(--warning))',
    widgets: [
      { widgetId: 'kpi-total-orders', style: 'stat-card' },
      { widgetId: 'kpi-completed', style: 'stat-card' },
      { widgetId: 'kpi-overdue', style: 'stat-card' },
      { widgetId: 'kpi-in-progress', style: 'stat-card' },
      { widgetId: 'cost-by-month', style: 'area-chart' },
      { widgetId: 'maintenance-kpis', style: 'stat-card' },
      { widgetId: 'cross-sector-comparison', style: 'bar-chart' },
      { widgetId: 'solution-effectiveness', style: 'donut-chart' },
      { widgetId: 'trend-completion-6m', style: 'bar-chart' },
      { widgetId: 'maintenance-type', style: 'donut-chart' },
      { widgetId: 'top-failing-machines', style: 'list' },
      { widgetId: 'preventive-compliance', style: 'stat-card' },
      { widgetId: 'health-scores-overview', style: 'list' },
      { widgetId: 'orders-overdue-list', style: 'list' },
    ],
  },
  {
    id: 'gerente-confiabilidad',
    name: 'Confiabilidad & Fallas',
    description: 'Análisis de fallas, top máquinas, health scores, efectividad de soluciones y tendencias de completitud',
    icon: 'Shield',
    roles: ['ADMIN', 'SUPERADMIN'],
    color: 'hsl(var(--destructive))',
    widgets: [
      { widgetId: 'maintenance-kpis', style: 'stat-card' },
      { widgetId: 'top-failing-machines', style: 'bar-chart' },
      { widgetId: 'health-scores-overview', style: 'bar-chart' },
      { widgetId: 'failures-open', style: 'list' },
      { widgetId: 'solution-effectiveness', style: 'donut-chart' },
      { widgetId: 'preventive-compliance', style: 'donut-chart' },
      { widgetId: 'trend-completion-6m', style: 'area-chart' },
      { widgetId: 'machines-status', style: 'donut-chart' },
      { widgetId: 'orders-by-priority', style: 'bar-chart' },
      { widgetId: 'maintenance-type', style: 'bar-chart' },
      { widgetId: 'cross-sector-comparison', style: 'list' },
      { widgetId: 'orders-overdue-list', style: 'list' },
      { widgetId: 'cost-by-month', style: 'bar-chart' },
    ],
  },

  // ===== UNIVERSALES =====
  {
    id: 'resumen-ejecutivo',
    name: 'Resumen Ejecutivo',
    description: 'KPIs principales, estado general y las listas más importantes en un solo lugar',
    icon: 'LayoutDashboard',
    roles: ['USER', 'SUPERVISOR', 'ADMIN', 'SUPERADMIN', 'ADMIN_ENTERPRISE'],
    color: 'hsl(var(--primary))',
    widgets: [
      { widgetId: 'kpi-total-orders', style: 'stat-card' },
      { widgetId: 'kpi-overdue', style: 'stat-card' },
      { widgetId: 'kpi-completed', style: 'stat-card' },
      { widgetId: 'kpi-in-progress', style: 'stat-card' },
      { widgetId: 'orders-overdue-list', style: 'list' },
      { widgetId: 'orders-in-progress', style: 'list' },
      { widgetId: 'orders-by-status', style: 'donut-chart' },
      { widgetId: 'machines-status', style: 'donut-chart' },
      { widgetId: 'upcoming-maintenance', style: 'list' },
      { widgetId: 'orders-by-priority', style: 'bar-chart' },
      { widgetId: 'maintenance-type', style: 'donut-chart' },
      { widgetId: 'my-tasks', style: 'list' },
    ],
  },
  {
    id: 'analitico',
    name: 'Analítico Avanzado',
    description: 'Todos los gráficos y métricas disponibles: donas, barras, áreas, tendencias y comparativas',
    icon: 'PieChart',
    roles: ['SUPERVISOR', 'ADMIN', 'SUPERADMIN'],
    color: 'hsl(var(--chart-2))',
    widgets: [
      { widgetId: 'maintenance-kpis', style: 'stat-card' },
      { widgetId: 'trend-completion-6m', style: 'area-chart' },
      { widgetId: 'cost-by-month', style: 'area-chart' },
      { widgetId: 'cross-sector-comparison', style: 'bar-chart' },
      { widgetId: 'orders-by-status', style: 'donut-chart' },
      { widgetId: 'orders-by-priority', style: 'donut-chart' },
      { widgetId: 'maintenance-type', style: 'donut-chart' },
      { widgetId: 'top-failing-machines', style: 'bar-chart' },
      { widgetId: 'solution-effectiveness', style: 'donut-chart' },
      { widgetId: 'health-scores-overview', style: 'bar-chart' },
      { widgetId: 'preventive-compliance', style: 'donut-chart' },
      { widgetId: 'machines-status', style: 'donut-chart' },
      { widgetId: 'team-workload', style: 'bar-chart' },
      { widgetId: 'failures-open', style: 'donut-chart' },
    ],
  },
  {
    id: 'operaciones-diarias',
    name: 'Operaciones Diarias',
    description: 'Lo operativo del día a día: vencidas, en progreso, tareas, controles, máquinas y calendario',
    icon: 'ClipboardList',
    roles: ['USER', 'SUPERVISOR', 'ADMIN', 'SUPERADMIN', 'ADMIN_ENTERPRISE'],
    color: 'hsl(var(--chart-3))',
    widgets: [
      { widgetId: 'kpi-overdue', style: 'stat-card' },
      { widgetId: 'kpi-in-progress', style: 'stat-card' },
      { widgetId: 'kpi-completed', style: 'stat-card' },
      { widgetId: 'kpi-total-orders', style: 'stat-card' },
      { widgetId: 'orders-overdue-list', style: 'list' },
      { widgetId: 'orders-in-progress', style: 'list' },
      { widgetId: 'my-work-orders', style: 'list' },
      { widgetId: 'my-controls-timeline', style: 'list' },
      { widgetId: 'my-tasks', style: 'list' },
      { widgetId: 'upcoming-maintenance', style: 'list' },
      { widgetId: 'machines-status', style: 'donut-chart' },
      { widgetId: 'orders-completed', style: 'list' },
      { widgetId: 'maintenance-calendar', style: 'stat-card' },
    ],
  },
];

/** Get templates relevant to a role */
export function getTemplatesForRole(role: string): DashboardTemplate[] {
  return DASHBOARD_TEMPLATES.filter(t => t.roles.includes(role));
}

/** Apply a template, returning a DashboardLayout */
export function applyTemplate(template: DashboardTemplate): DashboardLayout {
  const ts = Date.now();
  const widgets: WidgetInstance[] = template.widgets.map((tw, index) => {
    const widgetDef = getWidgetById(tw.widgetId);
    return {
      id: `${tw.widgetId}-${ts}-${index}`,
      widgetId: tw.widgetId,
      order: index,
      style: tw.style || widgetDef?.defaultStyle,
    };
  });
  return { widgets };
}
