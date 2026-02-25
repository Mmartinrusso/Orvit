import type { SidebarModule } from './ventas-modules';

export const MANTENIMIENTO_MODULES: SidebarModule[] = [
  // ─── CORE ───
  { id: 'mant.dashboard', name: 'Dashboard', icon: 'LayoutDashboard', path: '/mantenimiento/dashboard', isCore: true, category: 'core', description: 'KPIs, tareas urgentes, alertas del sector', order: 0 },

  // ─── CORRECTIVO ───
  { id: 'mant.fallas', name: 'Fallas', icon: 'AlertTriangle', path: '/mantenimiento/fallas', isCore: true, category: 'core', description: 'Reportes e incidentes', order: 10 },
  { id: 'mant.ordenes', name: 'Órdenes de trabajo', icon: 'ClipboardList', path: '/mantenimiento/ordenes', isCore: true, category: 'core', description: 'Gestión de órdenes de trabajo', order: 11 },
  { id: 'mant.soluciones', name: 'Soluciones', icon: 'Lightbulb', path: '/mantenimiento/soluciones', isCore: false, category: 'optional', description: 'Base de conocimiento de soluciones', order: 12 },

  // ─── PREVENTIVO ───
  { id: 'mant.preventivo', name: 'Preventivo', icon: 'CalendarClock', path: '/mantenimiento/preventivo', isCore: true, category: 'core', description: 'Mantenimiento preventivo y programado', order: 20 },

  // ─── ACTIVOS ───
  { id: 'mant.maquinas', name: 'Máquinas', icon: 'Cog', path: '/mantenimiento/maquinas', isCore: true, category: 'core', description: 'Lista completa de máquinas', order: 30 },
  { id: 'mant.unidades-moviles', name: 'Unidades Móviles', icon: 'Truck', path: '/mantenimiento/unidades-moviles', isCore: false, category: 'optional', description: 'Vehículos y equipos móviles', order: 31 },
  { id: 'mant.puestos-trabajo', name: 'Puestos de trabajo', icon: 'Building2', path: '/mantenimiento/puestos-trabajo', isCore: false, category: 'optional', description: 'Puestos de trabajo e instructivos', order: 32 },

  // ─── PAÑOL ───
  { id: 'mant.panol', name: 'Inventario', icon: 'Package', path: '/panol', isCore: true, category: 'core', description: 'Ver todos los items del pañol', order: 40 },
  { id: 'mant.panol-repuestos', name: 'Repuestos', icon: 'Cog', path: '/panol/repuestos', isCore: false, category: 'optional', description: 'Gestión de repuestos', order: 41 },
  { id: 'mant.panol-movimientos', name: 'Movimientos', icon: 'ArrowRightLeft', path: '/panol/movimientos', isCore: false, category: 'optional', description: 'Historial de entradas y salidas', order: 42 },
  { id: 'mant.panol-dashboard', name: 'Dashboard Pañol', icon: 'BarChart3', path: '/panol/dashboard', isCore: false, category: 'optional', description: 'Métricas y analytics del pañol', order: 43 },
  { id: 'mant.panol-conteo', name: 'Conteo Físico', icon: 'ClipboardCheck', path: '/panol/conteo', isCore: false, category: 'optional', description: 'Auditoría de inventario', order: 44 },
  { id: 'mant.panol-rapido', name: 'Acciones Rápidas', icon: 'ScanLine', path: '/panol/rapido', isCore: false, category: 'optional', description: 'Escaneo QR y operaciones rápidas', order: 45 },
  { id: 'mant.panol-lotes', name: 'Lotes', icon: 'Layers', path: '/panol/lotes', isCore: false, category: 'optional', description: 'Trazabilidad de lotes y vencimientos', order: 46 },
  { id: 'mant.panol-reservas', name: 'Reservas', icon: 'CalendarCheck', path: '/panol/reservas', isCore: false, category: 'optional', description: 'Reservas de repuestos por OT', order: 47 },
  { id: 'mant.panol-consumo', name: 'Consumo', icon: 'TrendingDown', path: '/panol/consumo', isCore: false, category: 'optional', description: 'Análisis de consumo de repuestos', order: 48 },
  { id: 'mant.panol-forecast', name: 'Forecast', icon: 'LineChart', path: '/panol/forecast', isCore: false, category: 'optional', description: 'Proyección de necesidades de stock', order: 49 },
  { id: 'mant.panol-prestamos', name: 'Préstamos', icon: 'HandMetal', path: '/panol/prestamos', isCore: false, category: 'optional', description: 'Control de préstamos de herramientas', order: 50 },

  // ─── GENERAL ───
  { id: 'mant.ideas', name: 'Ideas', icon: 'Lightbulb', path: '/mantenimiento/ideas', isCore: false, category: 'optional', description: 'Libro de ideas y sugerencias de mejora', order: 55 },
  { id: 'mant.costos', name: 'Costos', icon: 'DollarSign', path: '/mantenimiento/costos', isCore: false, category: 'optional', description: 'Análisis de costos de mantenimiento', order: 56 },

  // ─── CONFIABILIDAD ───
  { id: 'mant.health-score', name: 'Health Score', icon: 'HeartPulse', path: '/mantenimiento/health-score', isCore: false, category: 'advanced', description: 'Indicador de salud de máquinas', order: 60 },
  { id: 'mant.fmea', name: 'FMEA', icon: 'TrendingDown', path: '/mantenimiento/fmea', isCore: false, category: 'advanced', description: 'Análisis de modos de falla y efectos', order: 61 },
  { id: 'mant.criticidad', name: 'Criticidad', icon: 'Target', path: '/mantenimiento/criticidad', isCore: false, category: 'advanced', description: 'Matriz de criticidad de activos', order: 62 },
  { id: 'mant.monitoreo', name: 'Monitoreo', icon: 'Activity', path: '/mantenimiento/monitoreo', isCore: false, category: 'advanced', description: 'Monitoreo de condición y sensores', order: 63 },

  // ─── SEGURIDAD ───
  { id: 'mant.ptw', name: 'PTW', icon: 'Shield', path: '/mantenimiento/ptw', isCore: false, category: 'advanced', description: 'Permisos de trabajo (Permit to Work)', order: 70 },
  { id: 'mant.loto', name: 'LOTO', icon: 'Lock', path: '/mantenimiento/loto', isCore: false, category: 'advanced', description: 'Bloqueo y etiquetado (Lockout-Tagout)', order: 71 },
  { id: 'mant.moc', name: 'MOC', icon: 'RefreshCw', path: '/mantenimiento/moc', isCore: false, category: 'advanced', description: 'Gestión del cambio (Management of Change)', order: 72 },

  // ─── GESTIÓN ───
  { id: 'mant.skills', name: 'Skills', icon: 'Target', path: '/mantenimiento/skills', isCore: false, category: 'advanced', description: 'Matriz de habilidades y certificaciones', order: 80 },
  { id: 'mant.contadores', name: 'Contadores', icon: 'Clock', path: '/mantenimiento/contadores', isCore: false, category: 'advanced', description: 'Contadores de uso y mantenimiento', order: 81 },
  { id: 'mant.calibracion', name: 'Calibración', icon: 'Gauge', path: '/mantenimiento/calibracion', isCore: false, category: 'advanced', description: 'Gestión de calibraciones de equipos', order: 82 },
  { id: 'mant.lubricacion', name: 'Lubricación', icon: 'Droplet', path: '/mantenimiento/lubricacion', isCore: false, category: 'advanced', description: 'Puntos y rutas de lubricación', order: 83 },
  { id: 'mant.contratistas', name: 'Contratistas', icon: 'HardHat', path: '/mantenimiento/contratistas', isCore: false, category: 'advanced', description: 'Gestión de contratistas externos', order: 84 },

  // ─── DOCUMENTACIÓN ───
  { id: 'mant.conocimiento', name: 'Conocimiento', icon: 'BookOpen', path: '/mantenimiento/conocimiento', isCore: false, category: 'advanced', description: 'Base de conocimiento y documentación', order: 90 },
  { id: 'mant.lecciones', name: 'Lecciones', icon: 'GraduationCap', path: '/mantenimiento/lecciones', isCore: false, category: 'advanced', description: 'Base de lecciones aprendidas', order: 91 },
  { id: 'mant.garantias', name: 'Garantías', icon: 'ShieldCheck', path: '/mantenimiento/garantias', isCore: false, category: 'advanced', description: 'Gestión de garantías y reclamos', order: 92 },
  { id: 'mant.paradas', name: 'Paradas', icon: 'Construction', path: '/mantenimiento/paradas', isCore: false, category: 'advanced', description: 'Gestión de paradas y turnarounds', order: 93 },
  { id: 'mant.qr', name: 'QR Codes', icon: 'QrCode', path: '/mantenimiento/qr', isCore: false, category: 'advanced', description: 'Generación y gestión de códigos QR', order: 94 },
  { id: 'mant.puntos-medicion', name: 'Puntos Medición', icon: 'Thermometer', path: '/mantenimiento/puntos-medicion', isCore: false, category: 'advanced', description: 'Puntos de medición y rondas de inspección', order: 95 },
];

export function getMantenimientoModuleById(id: string): SidebarModule | undefined {
  return MANTENIMIENTO_MODULES.find(m => m.id === id);
}
