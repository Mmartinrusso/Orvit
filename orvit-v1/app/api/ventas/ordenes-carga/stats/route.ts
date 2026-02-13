import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * GET - Obtener estadísticas completas de órdenes de carga
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const viewMode = getViewMode(request);
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    const where = applyViewMode(
      {
        companyId: user!.companyId,
        ...(fechaDesde &&
          fechaHasta && {
            fecha: {
              gte: new Date(fechaDesde),
              lte: new Date(fechaHasta),
            },
          }),
      },
      viewMode
    );

    // Get all load orders for stats
    const loadOrders = await prisma.loadOrder.findMany({
      where,
      select: {
        id: true,
        estado: true,
        pesoTotal: true,
        volumenTotal: true,
        confirmadoAt: true,
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    // Calculate stats
    const stats = {
      // Count by status
      porEstado: {
        PENDIENTE: loadOrders.filter((o) => o.estado === 'PENDIENTE').length,
        CARGANDO: loadOrders.filter((o) => o.estado === 'CARGANDO').length,
        CARGADA: loadOrders.filter((o) => o.estado === 'CARGADA').length,
        DESPACHADA: loadOrders.filter((o) => o.estado === 'DESPACHADA').length,
        CANCELADA: loadOrders.filter((o) => o.estado === 'CANCELADA').length,
      },

      // Total counts
      total: loadOrders.length,
      confirmadas: loadOrders.filter((o) => o.confirmadoAt).length,
      noConfirmadas: loadOrders.filter((o) => !o.confirmadoAt).length,

      // Weight and volume
      pesoTotal: loadOrders.reduce((sum, o) => sum + (o.pesoTotal || 0), 0),
      volumenTotal: loadOrders.reduce((sum, o) => sum + (o.volumenTotal || 0), 0),

      // Items
      totalItems: loadOrders.reduce((sum, o) => sum + o._count.items, 0),
      promedioItemsPorOrden:
        loadOrders.length > 0
          ? loadOrders.reduce((sum, o) => sum + o._count.items, 0) / loadOrders.length
          : 0,

      // Average peso/volumen per order
      promedioPesoPorOrden:
        loadOrders.length > 0
          ? loadOrders.reduce((sum, o) => sum + (o.pesoTotal || 0), 0) / loadOrders.length
          : 0,
      promedioVolumenPorOrden:
        loadOrders.length > 0
          ? loadOrders.reduce((sum, o) => sum + (o.volumenTotal || 0), 0) / loadOrders.length
          : 0,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching load order stats:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas' },
      { status: 500 }
    );
  }
}
