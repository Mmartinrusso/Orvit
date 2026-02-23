import type { SidebarModule } from './ventas-modules';

export const COMPRAS_MODULES: SidebarModule[] = [
  { id: 'compras.dashboard', name: 'Dashboard', icon: 'LayoutDashboard', path: '/administracion/compras', isCore: true, category: 'core', description: 'Panel de control de compras', order: 0 },
  { id: 'compras.torre-control', name: 'Torre de Control', icon: 'Gauge', path: '/administracion/compras/torre-control', isCore: true, category: 'core', description: 'Control centralizado de compras y entregas', order: 1 },
  { id: 'compras.pedidos', name: 'Pedidos de Compra', icon: 'ClipboardList', path: '/administracion/compras/pedidos', isCore: true, category: 'core', description: 'Solicitudes internas con cotizaciones', order: 10 },
  { id: 'compras.ordenes', name: 'Órdenes de Compra', icon: 'ShoppingCart', path: '/administracion/compras/ordenes', isCore: true, category: 'core', description: 'Gestión de órdenes de compra', order: 11 },
  { id: 'compras.proveedores', name: 'Proveedores', icon: 'Building2', path: '/administracion/compras/proveedores', isCore: true, category: 'core', description: 'Gestión de proveedores y contactos', order: 20 },
  { id: 'compras.cuentas-corrientes', name: 'Cuentas Corrientes', icon: 'Wallet', path: '/administracion/compras/cuentas-corrientes', isCore: false, category: 'optional', description: 'Estados de cuenta y saldos de proveedores', order: 21 },
  { id: 'compras.comprobantes', name: 'Comprobantes', icon: 'Receipt', path: '/administracion/compras/comprobantes', isCore: true, category: 'core', description: 'Cargar comprobantes de compra', order: 30 },
  { id: 'compras.stock', name: 'Inventario', icon: 'Package', path: '/administracion/compras/stock', isCore: false, category: 'optional', description: 'Stock por depósito y alertas', order: 40 },
  { id: 'compras.stock-kardex', name: 'Kardex', icon: 'FileText', path: '/administracion/compras/stock/kardex', isCore: false, category: 'optional', description: 'Historial de movimientos', order: 41 },
  { id: 'compras.stock-ajustes', name: 'Ajustes', icon: 'ClipboardCheck', path: '/administracion/compras/stock/ajustes', isCore: false, category: 'optional', description: 'Ajustes de inventario', order: 42 },
  { id: 'compras.stock-transferencias', name: 'Transferencias Stock', icon: 'ArrowRightLeft', path: '/administracion/compras/stock/transferencias', isCore: false, category: 'optional', description: 'Transferencias entre depósitos', order: 43 },
  { id: 'compras.stock-reposicion', name: 'Reposición', icon: 'Lightbulb', path: '/administracion/compras/stock/reposicion', isCore: false, category: 'optional', description: 'Sugerencias de reposición', order: 44 },
  { id: 'compras.solicitudes', name: 'Solicitudes', icon: 'FileCheck', path: '/administracion/compras/solicitudes', isCore: false, category: 'optional', description: 'Solicitudes de compra y aprobaciones', order: 50 },
  { id: 'compras.devoluciones', name: 'Devoluciones', icon: 'RefreshCw', path: '/administracion/compras/devoluciones', isCore: false, category: 'optional', description: 'Gestión de devoluciones a proveedores', order: 51 },
  { id: 'compras.historial', name: 'Historial', icon: 'History', path: '/administracion/compras/historial', isCore: false, category: 'optional', description: 'Historial de compras realizadas', order: 60 },
];

export function getComprasModuleById(id: string): SidebarModule | undefined {
  return COMPRAS_MODULES.find(m => m.id === id);
}
