import type { ModuleSidebarConfig } from './company-sidebar-config';

export const PRODUCCION_DEFAULT_CONFIG: ModuleSidebarConfig = {
  version: 1,
  groups: [
    {
      type: 'group',
      id: 'prod-default-dashboard',
      name: '__flat__',
      icon: 'LayoutDashboard',
      children: [{ type: 'item', moduleId: 'prod.dashboard' }],
    },
    {
      type: 'group',
      id: 'prod-default-operaciones',
      name: 'Operaciones',
      icon: 'Factory',
      children: [
        { type: 'item', moduleId: 'prod.ordenes' },
        { type: 'item', moduleId: 'prod.registro-diario' },
        { type: 'item', moduleId: 'prod.paradas' },
        { type: 'item', moduleId: 'prod.rutinas' },
      ],
    },
    {
      type: 'group',
      id: 'prod-default-calidad',
      name: '__flat__',
      icon: 'CheckCircle2',
      children: [{ type: 'item', moduleId: 'prod.calidad' }],
    },
    {
      type: 'group',
      id: 'prod-default-config',
      name: 'Configuración',
      icon: 'Settings',
      children: [
        { type: 'item', moduleId: 'prod.centros-trabajo' },
        { type: 'item', moduleId: 'prod.turnos' },
        { type: 'item', moduleId: 'prod.codigos-motivo' },
        { type: 'item', moduleId: 'prod.plantillas-rutinas' },
        { type: 'item', moduleId: 'prod.recursos' },
      ],
    },
    {
      type: 'group',
      id: 'prod-default-reportes',
      name: '__flat__',
      icon: 'BarChart3',
      children: [{ type: 'item', moduleId: 'prod.reportes' }],
    },
    {
      type: 'group',
      id: 'prod-default-activos',
      name: 'Activos',
      icon: 'Cog',
      children: [
        { type: 'item', moduleId: 'prod.maquinas' },
        { type: 'item', moduleId: 'prod.vehiculos' },
      ],
    },
  ],
};
