import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET - Public delivery tracking endpoint
 * NO AUTH REQUIRED - This is intentionally public for customer tracking
 *
 * Accepts delivery number (e.g., ENT-2024-00001) and returns tracking info
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { numero: string } }
) {
  try {
    const numero = decodeURIComponent(params.numero);

    if (!numero) {
      return NextResponse.json(
        { error: 'Número de entrega requerido' },
        { status: 400 }
      );
    }

    // Find delivery by numero (case insensitive)
    const delivery = await prisma.saleDelivery.findFirst({
      where: {
        numero: {
          equals: numero,
          mode: 'insensitive',
        },
        // Only show deliveries that are not in early draft states for security
        // (prevents tracking of internal/incomplete deliveries)
        estado: {
          not: 'PENDIENTE', // Optionally hide very early stages
        },
      },
      select: {
        id: true,
        numero: true,
        estado: true,
        tipo: true,
        fechaProgramada: true,
        fechaEntrega: true,
        direccionEntrega: true,
        conductorNombre: true,
        vehiculo: true,
        notas: true,
        createdAt: true,
        sale: {
          select: {
            numero: true,
            client: {
              select: {
                businessName: true,
                fantasyName: true,
              },
            },
          },
        },
        items: {
          select: {
            cantidad: true,
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      return NextResponse.json(
        { error: 'Entrega no encontrada' },
        { status: 404 }
      );
    }

    // Build timeline from status changes (audit log)
    const auditLogs = await prisma.salesStatusAudit.findMany({
      where: {
        entidad: 'delivery',
        entidadId: delivery.id,
      },
      orderBy: {
        timestamp: 'desc',
      },
      select: {
        estadoNuevo: true,
        timestamp: true,
        notas: true,
      },
    });

    // Convert audit logs to timeline events
    const timeline = auditLogs.map((log) => ({
      estado: log.estadoNuevo,
      fecha: log.timestamp,
      notas: log.notas,
    }));

    // Add creation event if no logs exist
    if (timeline.length === 0) {
      timeline.push({
        estado: delivery.estado,
        fecha: delivery.createdAt,
        notas: 'Entrega creada',
      });
    }

    // Return sanitized tracking information
    const trackingInfo = {
      numero: delivery.numero,
      estado: delivery.estado,
      tipo: delivery.tipo,
      fechaProgramada: delivery.fechaProgramada,
      fechaEntrega: delivery.fechaEntrega,
      direccionEntrega: delivery.direccionEntrega,
      conductorNombre: delivery.conductorNombre,
      vehiculo: delivery.vehiculo,
      sale: {
        numero: delivery.sale.numero,
        client: {
          businessName: delivery.sale.client.businessName,
        },
      },
      items: delivery.items,
      timeline,
    };

    return NextResponse.json(trackingInfo);
  } catch (error) {
    console.error('Error fetching tracking info:', error);
    return NextResponse.json(
      { error: 'Error al obtener información de seguimiento' },
      { status: 500 }
    );
  }
}
