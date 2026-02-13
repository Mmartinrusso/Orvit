import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

/**
 * GET - Get list of recent drivers from past deliveries
 * Returns drivers with delivery count for autocomplete
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get distinct drivers from past deliveries
    const drivers = await prisma.saleDelivery.groupBy({
      by: ['conductorNombre', 'conductorDNI'],
      where: {
        companyId: user!.companyId,
        conductorNombre: { not: null },
      },
      _count: {
        conductorNombre: true,
      },
      orderBy: {
        _count: {
          conductorNombre: 'desc',
        },
      },
      take: limit,
    });

    // Transform to response format
    const driversList = drivers.map((driver) => ({
      conductorNombre: driver.conductorNombre!,
      conductorDNI: driver.conductorDNI,
      count: driver._count.conductorNombre,
    }));

    return NextResponse.json({
      drivers: driversList,
      total: driversList.length,
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return NextResponse.json({ error: 'Error al obtener conductores' }, { status: 500 });
  }
}
