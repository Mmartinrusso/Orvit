import type { ModuleSidebarConfig } from './company-sidebar-config';

export const MANTENIMIENTO_DEFAULT_CONFIG: ModuleSidebarConfig = {
  version: 1,
  groups: [
    {
      type: 'group',
      id: 'mant-default-dashboard',
      name: '__flat__',
      icon: 'LayoutDashboard',
      children: [{ type: 'item', moduleId: 'mant.dashboard' }],
    },
    {
      type: 'group',
      id: 'mant-default-correctivo',
      name: 'Correctivo',
      icon: 'Zap',
      children: [
        { type: 'item', moduleId: 'mant.fallas' },
        { type: 'item', moduleId: 'mant.ordenes' },
        { type: 'item', moduleId: 'mant.soluciones' },
      ],
    },
    {
      type: 'group',
      id: 'mant-default-preventivo',
      name: '__flat__',
      icon: 'CalendarClock',
      children: [{ type: 'item', moduleId: 'mant.preventivo' }],
    },
    {
      type: 'group',
      id: 'mant-default-activos',
      name: 'Activos',
      icon: 'Cog',
      children: [
        { type: 'item', moduleId: 'mant.maquinas' },
        { type: 'item', moduleId: 'mant.unidades-moviles' },
        { type: 'item', moduleId: 'mant.puestos-trabajo' },
      ],
    },
    {
      type: 'group',
      id: 'mant-default-panol',
      name: 'Pañol',
      icon: 'Package',
      children: [
        { type: 'item', moduleId: 'mant.panol' },
        { type: 'item', moduleId: 'mant.panol-repuestos' },
        { type: 'item', moduleId: 'mant.panol-movimientos' },
        { type: 'item', moduleId: 'mant.panol-dashboard' },
        { type: 'item', moduleId: 'mant.panol-conteo' },
        { type: 'item', moduleId: 'mant.panol-rapido' },
      ],
    },
    {
      type: 'group',
      id: 'mant-default-general',
      name: '__flat__',
      icon: 'Lightbulb',
      children: [
        { type: 'item', moduleId: 'mant.ideas' },
        { type: 'item', moduleId: 'mant.costos' },
      ],
    },
    {
      type: 'group',
      id: 'mant-default-confiabilidad',
      name: 'Confiabilidad',
      icon: 'TrendingUp',
      children: [
        { type: 'item', moduleId: 'mant.health-score' },
        { type: 'item', moduleId: 'mant.fmea' },
        { type: 'item', moduleId: 'mant.criticidad' },
        { type: 'item', moduleId: 'mant.monitoreo' },
      ],
    },
    {
      type: 'group',
      id: 'mant-default-seguridad',
      name: 'Seguridad',
      icon: 'ShieldAlert',
      children: [
        { type: 'item', moduleId: 'mant.ptw' },
        { type: 'item', moduleId: 'mant.loto' },
        { type: 'item', moduleId: 'mant.moc' },
      ],
    },
    {
      type: 'group',
      id: 'mant-default-gestion',
      name: 'Gestión',
      icon: 'Users',
      children: [
        { type: 'item', moduleId: 'mant.skills' },
        { type: 'item', moduleId: 'mant.contadores' },
        { type: 'item', moduleId: 'mant.calibracion' },
        { type: 'item', moduleId: 'mant.lubricacion' },
        { type: 'item', moduleId: 'mant.contratistas' },
      ],
    },
    {
      type: 'group',
      id: 'mant-default-documentacion',
      name: 'Documentación',
      icon: 'FileText',
      children: [
        { type: 'item', moduleId: 'mant.conocimiento' },
        { type: 'item', moduleId: 'mant.lecciones' },
        { type: 'item', moduleId: 'mant.garantias' },
        { type: 'item', moduleId: 'mant.paradas' },
        { type: 'item', moduleId: 'mant.qr' },
        { type: 'item', moduleId: 'mant.puntos-medicion' },
      ],
    },
  ],
};
