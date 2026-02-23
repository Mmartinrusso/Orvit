import type { SidebarModule } from './ventas-modules';

export const TESORERIA_MODULES: SidebarModule[] = [
  { id: 'tesoreria.posicion', name: 'Posición', icon: 'LayoutDashboard', path: '/administracion/tesoreria', isCore: true, category: 'core', description: 'Posición consolidada de fondos', order: 0 },
  { id: 'tesoreria.cajas', name: 'Cajas', icon: 'DollarSign', path: '/administracion/tesoreria/cajas', isCore: true, category: 'core', description: 'Gestión de cajas de efectivo', order: 10 },
  { id: 'tesoreria.bancos', name: 'Bancos', icon: 'Building2', path: '/administracion/tesoreria/bancos', isCore: true, category: 'core', description: 'Cuentas bancarias y movimientos', order: 20 },
  { id: 'tesoreria.cheques', name: 'Cheques', icon: 'FileCheck', path: '/administracion/tesoreria/cheques', isCore: false, category: 'optional', description: 'Cartera de cheques', order: 30 },
  { id: 'tesoreria.transferencias', name: 'Transferencias', icon: 'ArrowRightLeft', path: '/administracion/tesoreria/transferencias', isCore: false, category: 'optional', description: 'Transferencias internas', order: 40 },
  { id: 'tesoreria.flujo-caja', name: 'Flujo de Caja', icon: 'TrendingUp', path: '/administracion/tesoreria/flujo-caja', isCore: false, category: 'optional', description: 'Proyección de flujo de caja', order: 50 },
];

export function getTesoreriaModuleById(id: string): SidebarModule | undefined {
  return TESORERIA_MODULES.find(m => m.id === id);
}
