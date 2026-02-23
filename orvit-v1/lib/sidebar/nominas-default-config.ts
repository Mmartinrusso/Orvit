import type { ModuleSidebarConfig } from './company-sidebar-config';

export const NOMINAS_DEFAULT_CONFIG: ModuleSidebarConfig = {
  version: 1,
  groups: [
    {
      type: 'group',
      id: 'nom-default-all',
      name: '__flat__',
      icon: 'Users',
      children: [
        { type: 'item', moduleId: 'nominas.dashboard' },
        { type: 'item', moduleId: 'nominas.empleados' },
        { type: 'item', moduleId: 'nominas.gremios' },
        { type: 'item', moduleId: 'nominas.sectores' },
        { type: 'item', moduleId: 'nominas.configuracion' },
        { type: 'item', moduleId: 'nominas.componentes' },
        { type: 'item', moduleId: 'nominas.adelantos' },
        { type: 'item', moduleId: 'nominas.liquidaciones' },
      ],
    },
  ],
};
