import type { ModuleSidebarConfig } from './company-sidebar-config';

export const COMPRAS_DEFAULT_CONFIG: ModuleSidebarConfig = {
  version: 1,
  groups: [
    {
      type: 'group',
      id: 'compras-default-principal',
      name: '__flat__',
      icon: 'LayoutDashboard',
      children: [
        { type: 'item', moduleId: 'compras.dashboard' },
        { type: 'item', moduleId: 'compras.torre-control' },
      ],
    },
    {
      type: 'group',
      id: 'compras-default-documentos',
      name: 'Documentos',
      icon: 'ClipboardList',
      children: [
        { type: 'item', moduleId: 'compras.pedidos' },
        { type: 'item', moduleId: 'compras.ordenes' },
        { type: 'item', moduleId: 'compras.comprobantes' },
        { type: 'item', moduleId: 'compras.solicitudes' },
        { type: 'item', moduleId: 'compras.devoluciones' },
        { type: 'item', moduleId: 'compras.historial' },
      ],
    },
    {
      type: 'group',
      id: 'compras-default-proveedores',
      name: 'Proveedores',
      icon: 'Building2',
      children: [
        { type: 'item', moduleId: 'compras.proveedores' },
        { type: 'item', moduleId: 'compras.cuentas-corrientes' },
      ],
    },
    {
      type: 'group',
      id: 'compras-default-stock',
      name: 'Stock',
      icon: 'Boxes',
      children: [
        { type: 'item', moduleId: 'compras.stock' },
        { type: 'item', moduleId: 'compras.stock-kardex' },
        { type: 'item', moduleId: 'compras.stock-ajustes' },
        { type: 'item', moduleId: 'compras.stock-transferencias' },
        { type: 'item', moduleId: 'compras.stock-reposicion' },
      ],
    },
  ],
};
