import type { ModuleSidebarConfig } from './company-sidebar-config';

export const ALMACEN_DEFAULT_CONFIG: ModuleSidebarConfig = {
  version: 1,
  groups: [
    {
      type: 'group',
      id: 'alm-default-all',
      name: '__flat__',
      icon: 'Warehouse',
      children: [
        { type: 'item', moduleId: 'almacen.dashboard' },
        { type: 'item', moduleId: 'almacen.inventario' },
        { type: 'item', moduleId: 'almacen.solicitudes' },
        { type: 'item', moduleId: 'almacen.despachos' },
        { type: 'item', moduleId: 'almacen.devoluciones' },
        { type: 'item', moduleId: 'almacen.reservas' },
        { type: 'item', moduleId: 'almacen.movimientos' },
      ],
    },
  ],
};
