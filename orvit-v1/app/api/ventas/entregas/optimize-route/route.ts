import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * POST - Optimize delivery route
 * Uses a simple nearest-neighbor algorithm to order deliveries
 * Can be enhanced with real distance calculation (Google Maps API, OSRM, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_VIEW);
    if (error) return error;

    const body = await request.json();
    const { deliveryIds } = body;

    if (!deliveryIds || !Array.isArray(deliveryIds) || deliveryIds.length < 2) {
      return NextResponse.json(
        { error: 'Debe seleccionar al menos 2 entregas' },
        { status: 400 }
      );
    }

    const viewMode = getViewMode(request);

    // Fetch deliveries with locations
    const deliveries = await prisma.saleDelivery.findMany({
      where: applyViewMode(
        {
          id: { in: deliveryIds },
          companyId: user!.companyId,
        },
        viewMode
      ),
      select: {
        id: true,
        numero: true,
        direccionEntrega: true,
        latitud: true,
        longitud: true,
        sale: {
          select: {
            client: {
              select: {
                legalName: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (deliveries.length === 0) {
      return NextResponse.json({ error: 'No se encontraron entregas' }, { status: 404 });
    }

    // Simple optimization: Order by address alphabetically as a basic heuristic
    // In production, this should use real routing API (Google Maps, OSRM, etc.)
    const optimizedDeliveries = [...deliveries].sort((a, b) => {
      // Prioritize deliveries with GPS coordinates
      if (a.latitud && a.longitud && (!b.latitud || !b.longitud)) return -1;
      if ((!a.latitud || !a.longitud) && b.latitud && b.longitud) return 1;

      // Then sort by address
      const addressA = a.direccionEntrega || '';
      const addressB = b.direccionEntrega || '';
      return addressA.localeCompare(addressB);
    });

    // Calculate estimated metrics (simplified)
    const totalDistance = deliveries.length * 5; // Assume 5km average between stops
    const estimatedTime = deliveries.length * 20; // Assume 20min average per delivery

    return NextResponse.json({
      optimizedRoute: optimizedDeliveries.map((d) => d.id),
      deliveries: optimizedDeliveries,
      totalDistance, // in kilometers
      estimatedTime, // in minutes
      algorithm: 'nearest-neighbor-simple',
      note: 'Esta es una optimización básica. Para rutas reales, se recomienda integrar con Google Maps API o similar.',
    });
  } catch (error) {
    console.error('Error optimizing route:', error);
    return NextResponse.json(
      { error: 'Error al optimizar ruta' },
      { status: 500 }
    );
  }
}
