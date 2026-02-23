import type { SidebarModule } from './ventas-modules';

export const PRODUCCION_MODULES: SidebarModule[] = [
  { id: 'prod.dashboard', name: 'Dashboard', icon: 'LayoutDashboard', path: '/produccion/dashboard', isCore: true, category: 'core', description: 'KPIs, alertas y resumen de producción', order: 0 },
  { id: 'prod.ordenes', name: 'Órdenes', icon: 'ClipboardList', path: '/produccion/ordenes', isCore: true, category: 'core', description: 'Órdenes de producción', order: 10 },
  { id: 'prod.registro-diario', name: 'Producción del Día', icon: 'Package', path: '/produccion/registro-diario', isCore: true, category: 'core', description: 'Cargar producción diaria por sector', order: 11 },
  { id: 'prod.paradas', name: 'Paradas', icon: 'Pause', path: '/produccion/paradas', isCore: false, category: 'optional', description: 'Registro y análisis de paradas', order: 12 },
  { id: 'prod.rutinas', name: 'Rutinas', icon: 'CheckSquare', path: '/produccion/rutinas', isCore: false, category: 'optional', description: 'Checklists operativos', order: 13 },
  { id: 'prod.calidad', name: 'Calidad', icon: 'CheckCircle2', path: '/produccion/calidad', isCore: false, category: 'optional', description: 'Control de calidad y lotes', order: 20 },
  { id: 'prod.centros-trabajo', name: 'Centros de Trabajo', icon: 'Building2', path: '/produccion/configuracion/centros-trabajo', isCore: false, category: 'optional', description: 'Líneas, máquinas y estaciones', order: 30 },
  { id: 'prod.turnos', name: 'Turnos', icon: 'Clock', path: '/produccion/configuracion/turnos', isCore: false, category: 'optional', description: 'Configuración de turnos', order: 31 },
  { id: 'prod.codigos-motivo', name: 'Códigos de Motivo', icon: 'Tags', path: '/produccion/configuracion/codigos-motivo', isCore: false, category: 'optional', description: 'Paradas, scrap y retrabajo', order: 32 },
  { id: 'prod.plantillas-rutinas', name: 'Plantillas Rutinas', icon: 'ListChecks', path: '/produccion/configuracion/rutinas', isCore: false, category: 'optional', description: 'Plantillas de checklists', order: 33 },
  { id: 'prod.recursos', name: 'Recursos', icon: 'Boxes', path: '/produccion/configuracion/recursos', isCore: false, category: 'optional', description: 'Bancos, silos y recursos de producción', order: 34 },
  { id: 'prod.reportes', name: 'Reportes', icon: 'BarChart3', path: '/produccion/reportes', isCore: false, category: 'optional', description: 'Reportes y tendencias', order: 40 },
  { id: 'prod.maquinas', name: 'Máquinas', icon: 'Cog', path: '/maquinas', isCore: false, category: 'optional', description: 'Gestión de máquinas de producción', order: 50 },
  { id: 'prod.vehiculos', name: 'Vehículos', icon: 'Truck', path: '/vehicles', isCore: false, category: 'optional', description: 'Gestión de vehículos y transporte', order: 51 },
];

export function getProduccionModuleById(id: string): SidebarModule | undefined {
  return PRODUCCION_MODULES.find(m => m.id === id);
}
