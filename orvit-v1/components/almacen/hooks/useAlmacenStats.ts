'use client';

import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';

interface DespachoEnSalida {
  id: number;
  numero: string;
  fecha: string;
  destinatario?: string;
  itemsCount: number;
  diasEnSalida: number;
}

interface ItemBajoStock {
  supplierItemId: number;
  itemCode: string;
  itemName: string;
  warehouseName: string;
  available: number;
  stockMinimo: number;
  unit: string;
}

interface MovimientoReciente {
  id: number;
  fecha: string;
  tipo: string;
  cantidad: number;
  itemName: string;
  warehouseName: string;
}

interface AlmacenStats {
  // Solicitudes
  solicitudesPendientes: number;
  solicitudesAprobadas: number;
  solicitudesHoy: number;

  // Despachos
  despachosPendientes: number;
  despachosHoy: number;
  despachosListos: number;
  despachosEnSalida: number; // Sin devolver
  despachosEnSalidaList: DespachoEnSalida[];

  // Devoluciones
  devolucionesPendientes: number;
  devolucionesHoy: number;

  // Reservas
  reservasActivas: number;
  reservasProximasVencer: number;

  // Inventario
  itemsBajoMinimo: number;
  itemsBajoReorden: number;
  alertasStock: number;
  itemsBajoStockList: ItemBajoStock[];

  // Movimientos
  movimientosHoy: number;
  entradasHoy: number;
  salidasHoy: number;
  movimientosRecientes: MovimientoReciente[];
}

/**
 * Hook para obtener estadísticas generales de almacén
 * Combina datos de múltiples fuentes para el dashboard
 */
export function useAlmacenStats(warehouseId?: number) {
  const { currentCompany } = useCompany();

  return useQuery<AlmacenStats>({
    queryKey: ['almacen', 'stats', currentCompany?.id, warehouseId],
    queryFn: async () => {
      if (!currentCompany?.id) {
        return getEmptyStats();
      }

      const baseParams = warehouseId
        ? `companyId=${currentCompany.id}&warehouseId=${warehouseId}`
        : `companyId=${currentCompany.id}`;

      // Hacer llamadas en paralelo para obtener datos
      const today = new Date().toISOString().split('T')[0];
      const [
        solicitudesPendientes,
        solicitudesAprobadas,
        despachosPendientes,
        despachosListos,
        despachosEnSalidaData,
        devolucionesPendientes,
        availability,
        reservations,
        movimientosHoyData,
      ] = await Promise.all([
        // Solicitudes pendientes de aprobación
        fetch(`/api/almacen/requests?${baseParams}&estado=PENDIENTE_APROBACION&pageSize=1`)
          .then(r => r.json())
          .then(d => d.total || 0)
          .catch(() => 0),

        // Solicitudes aprobadas (pendientes de despacho)
        fetch(`/api/almacen/requests?${baseParams}&estado=APROBADA&pageSize=1`)
          .then(r => r.json())
          .then(d => d.total || 0)
          .catch(() => 0),

        // Despachos en preparación
        fetch(`/api/almacen/despachos?${baseParams}&estado=EN_PREPARACION&pageSize=1`)
          .then(r => r.json())
          .then(d => d.total || 0)
          .catch(() => 0),

        // Despachos listos
        fetch(`/api/almacen/despachos?${baseParams}&estado=LISTO_DESPACHO&pageSize=1`)
          .then(r => r.json())
          .then(d => d.total || 0)
          .catch(() => 0),

        // Despachos despachados (en salida, sin devolver)
        fetch(`/api/almacen/despachos?${baseParams}&estado=DESPACHADO&pageSize=20`)
          .then(r => r.json())
          .catch(() => ({ despachos: [], total: 0 })),

        // Devoluciones pendientes
        fetch(`/api/almacen/devoluciones?${baseParams}&estado=PENDIENTE_REVISION&pageSize=1`)
          .then(r => r.json())
          .then(d => d.total || 0)
          .catch(() => 0),

        // Stock bajo
        fetch(`/api/almacen/availability?${baseParams}&onlyBelowReorder=true&pageSize=10`)
          .then(r => r.json())
          .catch(() => ({ items: [], total: 0 })),

        // Reservas activas
        fetch(`/api/almacen/reservations?${baseParams}`)
          .then(r => r.json())
          .catch(() => ({ reservations: [] })),

        // Movimientos del día
        fetch(`/api/almacen/movements?${baseParams}&fechaDesde=${today}&fechaHasta=${today}&pageSize=20`)
          .then(r => r.json())
          .catch(() => ({ movimientos: [], total: 0 })),
      ]);

      const items = availability.items || [];
      const reservas = reservations.reservations || [];
      const despachosEnSalida = despachosEnSalidaData.despachos || [];
      const movimientosHoy = movimientosHoyData.movimientos || [];

      // Calcular reservas próximas a vencer (7 días)
      const now = new Date();
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const proximasVencer = reservas.filter((r: any) => {
        if (r.estado !== 'ACTIVA' || !r.fechaExpiracion) return false;
        const exp = new Date(r.fechaExpiracion);
        return exp <= in7Days;
      }).length;

      // Procesar despachos en salida
      const despachosEnSalidaList: DespachoEnSalida[] = despachosEnSalida.map((d: any) => {
        const fechaDespacho = new Date(d.fechaDespacho || d.createdAt);
        const diasEnSalida = Math.floor((now.getTime() - fechaDespacho.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: d.id,
          numero: d.numero || `D-${d.id}`,
          fecha: d.fechaDespacho || d.createdAt,
          destinatario: d.destinatario || d.receptor?.name || 'Sin asignar',
          itemsCount: d.items?.length || d._count?.items || 0,
          diasEnSalida,
        };
      });

      // Procesar items bajo stock
      const itemsBajoStockList: ItemBajoStock[] = items.slice(0, 10).map((i: any) => ({
        supplierItemId: i.supplierItemId,
        itemCode: i.itemCode || '',
        itemName: i.itemName || '',
        warehouseName: i.warehouseName || '',
        available: i.available || 0,
        stockMinimo: i.stockMinimo || 0,
        unit: i.unit || '',
      }));

      // Procesar movimientos recientes
      const movimientosRecientes: MovimientoReciente[] = movimientosHoy.slice(0, 10).map((m: any) => ({
        id: m.id,
        fecha: m.fecha,
        tipo: m.tipo,
        cantidad: m.cantidad,
        itemName: m.supplierItem?.name || '',
        warehouseName: m.warehouse?.nombre || '',
      }));

      // Contar entradas y salidas del día
      const entradasHoy = movimientosHoy.filter((m: any) =>
        ['ENTRADA', 'ENTRADA_RECEPCION', 'TRANSFERENCIA_ENTRADA', 'AJUSTE_POSITIVO', 'DEVOLUCION'].includes(m.tipo)
      ).length;
      const salidasHoy = movimientosHoy.filter((m: any) =>
        ['SALIDA', 'SALIDA_DEVOLUCION', 'TRANSFERENCIA_SALIDA', 'AJUSTE_NEGATIVO', 'CONSUMO_PRODUCCION', 'DESPACHO'].includes(m.tipo)
      ).length;

      return {
        solicitudesPendientes,
        solicitudesAprobadas,
        solicitudesHoy: 0,

        despachosPendientes,
        despachosHoy: despachosEnSalida.filter((d: any) => {
          const fecha = new Date(d.fechaDespacho || d.createdAt);
          return fecha.toDateString() === now.toDateString();
        }).length,
        despachosListos,
        despachosEnSalida: despachosEnSalidaData.total || despachosEnSalida.length,
        despachosEnSalidaList,

        devolucionesPendientes,
        devolucionesHoy: 0,

        reservasActivas: reservas.filter((r: any) => r.estado === 'ACTIVA').length,
        reservasProximasVencer: proximasVencer,

        itemsBajoMinimo: items.filter((i: any) => i.belowMinimum).length,
        itemsBajoReorden: items.filter((i: any) => i.belowReorderPoint).length,
        alertasStock: availability.total || items.length,
        itemsBajoStockList,

        movimientosHoy: movimientosHoyData.total || movimientosHoy.length,
        entradasHoy,
        salidasHoy,
        movimientosRecientes,
      };
    },
    enabled: !!currentCompany?.id,
    staleTime: 60 * 1000, // 1 minuto
    refetchOnWindowFocus: true,
  });
}

function getEmptyStats(): AlmacenStats {
  return {
    solicitudesPendientes: 0,
    solicitudesAprobadas: 0,
    solicitudesHoy: 0,
    despachosPendientes: 0,
    despachosHoy: 0,
    despachosListos: 0,
    despachosEnSalida: 0,
    despachosEnSalidaList: [],
    devolucionesPendientes: 0,
    devolucionesHoy: 0,
    reservasActivas: 0,
    reservasProximasVencer: 0,
    itemsBajoMinimo: 0,
    itemsBajoReorden: 0,
    alertasStock: 0,
    itemsBajoStockList: [],
    movimientosHoy: 0,
    entradasHoy: 0,
    salidasHoy: 0,
    movimientosRecientes: [],
  };
}

/**
 * Hook para obtener KPIs específicos del dashboard
 */
export function useAlmacenKPIs(warehouseId?: number) {
  const { data: stats, isLoading, error } = useAlmacenStats(warehouseId);

  const kpis = stats
    ? [
        {
          label: 'Solicitudes Pendientes',
          value: stats.solicitudesPendientes,
          color: stats.solicitudesPendientes > 0 ? 'yellow' : 'green',
          href: '/almacen?tab=solicitudes&estado=PENDIENTE_APROBACION',
        },
        {
          label: 'Despachos Listos',
          value: stats.despachosListos,
          color: stats.despachosListos > 0 ? 'blue' : 'gray',
          href: '/almacen?tab=despachos&estado=LISTO_DESPACHO',
        },
        {
          label: 'Alertas de Stock',
          value: stats.alertasStock,
          color: stats.alertasStock > 5 ? 'red' : stats.alertasStock > 0 ? 'orange' : 'green',
          href: '/almacen?tab=inventario&onlyBelowReorder=true',
        },
        {
          label: 'Reservas Activas',
          value: stats.reservasActivas,
          color: 'blue',
          href: '/almacen?tab=reservas',
        },
      ]
    : [];

  return {
    kpis,
    isLoading,
    error,
  };
}
