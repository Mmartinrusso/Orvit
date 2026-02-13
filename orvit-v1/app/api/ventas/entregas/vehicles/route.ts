import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

/**
 * GET - Get list of recent vehicles from past deliveries
 * Returns vehicles with delivery count for autocomplete
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get distinct vehicles from past deliveries
    const vehicles = await prisma.saleDelivery.groupBy({
      by: ['vehiculo', 'transportista'],
      where: {
        companyId: user!.companyId,
        vehiculo: { not: null },
      },
      _count: {
        vehiculo: true,
      },
      orderBy: {
        _count: {
          vehiculo: 'desc',
        },
      },
      take: limit,
    });

    // Transform to response format
    const vehiclesList = vehicles.map((vehicle) => ({
      vehiculo: vehicle.vehiculo!,
      transportista: vehicle.transportista,
      count: vehicle._count.vehiculo,
    }));

    return NextResponse.json({
      vehicles: vehiclesList,
      total: vehiclesList.length,
    });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return NextResponse.json({ error: 'Error al obtener vehículos' }, { status: 500 });
  }
}
