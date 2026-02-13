/**
 * GPS Tracking endpoints for Load Orders
 *
 * POST - Log GPS position
 * GET - Get tracking history
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// POST - Log GPS position
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_EDIT);
    if (error) return error;

    const loadOrderId = parseInt(params.id);
    const body = await request.json();

    const { latitud, longitud, velocidad, precision, evento } = body;

    if (!latitud || !longitud) {
      return NextResponse.json(
        { error: 'Latitud y longitud requeridas' },
        { status: 400 }
      );
    }

    const gpsLog = await prisma.deliveryGPSLog.create({
      data: {
        loadOrderId,
        deliveryId: body.deliveryId,
        latitud,
        longitud,
        velocidad: velocidad || null,
        precision: precision || null,
        evento: evento || 'EN_RUTA',
        timestamp: new Date(),
      },
    });

    // Update current position on load order
    await prisma.loadOrder.update({
      where: { id: loadOrderId },
      data: {
        latitudActual: latitud,
        longitudActual: longitud,
      },
    });

    return NextResponse.json(gpsLog, { status: 201 });
  } catch (error) {
    console.error('[GPS-LOG] Error:', error);
    return NextResponse.json({ error: 'Error al registrar GPS' }, { status: 500 });
  }
}

// GET - Get tracking history
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_VIEW);
    if (error) return error;

    const loadOrderId = parseInt(params.id);

    const history = await prisma.deliveryGPSLog.findMany({
      where: { loadOrderId },
      orderBy: { timestamp: 'asc' },
    });

    return NextResponse.json({ data: history });
  } catch (error) {
    console.error('[GPS-HISTORY] Error:', error);
    return NextResponse.json({ error: 'Error al obtener historial GPS' }, { status: 500 });
  }
}
