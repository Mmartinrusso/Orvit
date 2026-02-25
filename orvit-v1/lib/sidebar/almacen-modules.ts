import type { SidebarModule } from './ventas-modules';

export const ALMACEN_MODULES: SidebarModule[] = [
  { id: 'almacen.dashboard', name: 'Dashboard', icon: 'LayoutDashboard', path: '/almacen', isCore: true, category: 'core', description: 'Panel de control de almacén', order: 0 },
  { id: 'almacen.inventario', name: 'Inventario', icon: 'PackageSearch', path: '/almacen/inventario', isCore: true, category: 'core', description: 'Vista unificada de inventario', order: 10 },
  { id: 'almacen.solicitudes', name: 'Solicitudes', icon: 'ClipboardPen', path: '/almacen/solicitudes', isCore: true, category: 'core', description: 'Solicitudes de material de OT, OP y áreas', order: 20 },
  { id: 'almacen.despachos', name: 'Despachos', icon: 'PackageCheck', path: '/almacen/despachos', isCore: true, category: 'core', description: 'Despachos y entregas de material', order: 30 },
  { id: 'almacen.devoluciones', name: 'Devoluciones', icon: 'PackageX', path: '/almacen/devoluciones', isCore: false, category: 'optional', description: 'Devoluciones de material no utilizado', order: 40 },
  { id: 'almacen.reservas', name: 'Reservas', icon: 'Boxes', path: '/almacen/reservas', isCore: false, category: 'optional', description: 'Reservas activas de stock', order: 50 },
  { id: 'almacen.movimientos', name: 'Movimientos', icon: 'ArrowRightLeft', path: '/almacen/movimientos', isCore: true, category: 'core', description: 'Kardex y historial de movimientos', order: 60 },
  { id: 'almacen.transferencias', name: 'Transferencias', icon: 'ArrowLeftRight', path: '/almacen/transferencias', isCore: false, category: 'optional', description: 'Transferencias entre depósitos', order: 55 },
  { id: 'almacen.ajustes', name: 'Ajustes', icon: 'ClipboardMinus', path: '/almacen/ajustes', isCore: false, category: 'optional', description: 'Ajustes de inventario con aprobación', order: 56 },
];

export function getAlmacenModuleById(id: string): SidebarModule | undefined {
  return ALMACEN_MODULES.find(m => m.id === id);
}
