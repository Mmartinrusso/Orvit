import type { ModuleSidebarConfig } from './company-sidebar-config';

export const TESORERIA_DEFAULT_CONFIG: ModuleSidebarConfig = {
  version: 1,
  groups: [
    {
      type: 'group',
      id: 'tes-default-all',
      name: '__flat__',
      icon: 'Wallet',
      children: [
        { type: 'item', moduleId: 'tesoreria.posicion' },
        { type: 'item', moduleId: 'tesoreria.cajas' },
        { type: 'item', moduleId: 'tesoreria.bancos' },
        { type: 'item', moduleId: 'tesoreria.cheques' },
        { type: 'item', moduleId: 'tesoreria.transferencias' },
        { type: 'item', moduleId: 'tesoreria.flujo-caja' },
      ],
    },
  ],
};
