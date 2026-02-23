/**
 * Configuración DEFAULT del sidebar de Ventas
 *
 * Esta es la estructura que ve cada empresa hasta que el admin personalice la suya.
 * Replica exactamente la estructura hardcodeada anterior de Sidebar.tsx.
 */

import type { ModuleSidebarConfig } from './company-sidebar-config';

export const VENTAS_DEFAULT_CONFIG: ModuleSidebarConfig = {
  version: 1,
  groups: [
    // Dashboard — item suelto al inicio (sin grupo contenedor)
    {
      type: 'group',
      id: 'default-dashboard',
      name: '__flat__', // Grupos con __flat__ se renderizan sin header de grupo
      icon: 'LayoutDashboard',
      children: [
        { type: 'item', moduleId: 'ventas.dashboard' },
      ],
    },

    // Maestros
    {
      type: 'group',
      id: 'default-maestros',
      name: 'Maestros',
      icon: 'Database',
      children: [
        { type: 'item', moduleId: 'ventas.clientes' },
        { type: 'item', moduleId: 'ventas.productos' },
        { type: 'item', moduleId: 'ventas.listas-precios' },
        { type: 'item', moduleId: 'ventas.zonas' },
        { type: 'item', moduleId: 'ventas.condiciones-pago' },
        { type: 'item', moduleId: 'ventas.configuracion' },
      ],
    },

    // Equipo Comercial
    {
      type: 'group',
      id: 'default-equipo-comercial',
      name: 'Equipo Comercial',
      icon: 'Users',
      children: [
        { type: 'item', moduleId: 'ventas.vendedores' },
        { type: 'item', moduleId: 'ventas.liquidaciones' },
      ],
    },

    // Ciclo de Ventas
    {
      type: 'group',
      id: 'default-ciclo-ventas',
      name: 'Ciclo de Ventas',
      icon: 'RefreshCw',
      children: [
        { type: 'item', moduleId: 'ventas.cotizaciones' },
        { type: 'item', moduleId: 'ventas.notas-pedido' },
        { type: 'item', moduleId: 'ventas.ordenes' },
        { type: 'item', moduleId: 'ventas.ordenes-carga' },
        // Entregas como subgrupo
        {
          type: 'group',
          id: 'default-entregas',
          name: 'Entregas',
          icon: 'Truck',
          children: [
            { type: 'item', moduleId: 'ventas.entregas' },
            { type: 'item', moduleId: 'ventas.entregas-rutas' },
          ],
        },
        { type: 'item', moduleId: 'ventas.turnos' },
      ],
    },

    // Facturación
    {
      type: 'group',
      id: 'default-facturacion',
      name: 'Facturación',
      icon: 'Receipt',
      children: [
        { type: 'item', moduleId: 'ventas.comprobantes' },
        { type: 'item', moduleId: 'ventas.cobranzas' },
        { type: 'item', moduleId: 'ventas.aprobacion-pagos' },
        { type: 'item', moduleId: 'ventas.valores' },
        { type: 'item', moduleId: 'ventas.cuenta-corriente' },
        { type: 'item', moduleId: 'ventas.disputas' },
        { type: 'item', moduleId: 'ventas.alertas' },
      ],
    },

    // Análisis
    {
      type: 'group',
      id: 'default-analisis',
      name: 'Análisis',
      icon: 'BarChart3',
      children: [
        { type: 'item', moduleId: 'ventas.reportes' },
      ],
    },
  ],
};
