import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentPortalSession } from '@/lib/portal/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/portal/cotizaciones/[id]/aceptar
 * Aceptar o rechazar una cotización
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getCurrentPortalSession();

    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (!session.permissions.canAcceptQuotes) {
      return NextResponse.json(
        { error: 'No tiene permisos para aceptar cotizaciones' },
        { status: 403 }
      );
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { aceptar, comentarios } = body;

    if (typeof aceptar !== 'boolean') {
      return NextResponse.json(
        { error: 'Debe indicar si acepta o rechaza la cotización' },
        { status: 400 }
      );
    }

    // Verificar que la cotización existe y pertenece al cliente
    const cotizacion = await prisma.quote.findFirst({
      where: {
        id,
        companyId: session.companyId,
        clientId: session.clientId,
        estado: {
          in: ['ENVIADA', 'EN_NEGOCIACION'],
        },
      },
    });

    if (!cotizacion) {
      return NextResponse.json(
        { error: 'Cotización no encontrada o no puede ser modificada' },
        { status: 404 }
      );
    }

    // Verificar que no está vencida
    if (cotizacion.fechaValidez < new Date()) {
      return NextResponse.json(
        { error: 'La cotización ha vencido' },
        { status: 400 }
      );
    }

    // Verificar límites de monto si aplica
    if (aceptar && session.limits.maxOrderAmount) {
      const total = Number(cotizacion.total);
      if (total > session.limits.maxOrderAmount) {
        return NextResponse.json(
          { error: `El monto excede su límite de $${session.limits.maxOrderAmount.toLocaleString()}` },
          { status: 400 }
        );
      }
    }

    // Obtener IP y user agent
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    // Ejecutar en transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear registro de aceptación
      const acceptance = await tx.quoteAcceptance.create({
        data: {
          quoteId: id,
          status: aceptar ? 'ACCEPTED' : 'REJECTED',
          acceptedAt: new Date(),
          comments: comentarios || null,
          acceptedByContactId: session.portalUserId,
          ipAddress: ip,
          userAgent,
        },
      });

      // Actualizar estado de la cotización
      const nuevoEstado = aceptar ? 'ACEPTADA' : 'PERDIDA';
      const updated = await tx.quote.update({
        where: { id },
        data: {
          estado: nuevoEstado,
          aprobadoAt: aceptar ? new Date() : undefined,
          fechaCierre: !aceptar ? new Date() : undefined,
          motivoPerdida: !aceptar ? 'Rechazada por cliente en portal' : undefined,
        },
      });

      // Registrar actividad
      await tx.clientPortalActivity.create({
        data: {
          portalUserId: session.portalUserId,
          clientId: session.clientId,
          companyId: session.companyId,
          action: aceptar ? 'ACCEPT_QUOTE' : 'REJECT_QUOTE',
          entityType: 'quote',
          entityId: id,
          details: {
            quoteNumber: cotizacion.numero,
            total: Number(cotizacion.total),
            comentarios,
          },
          ipAddress: ip,
          userAgent,
        },
      });

      return { acceptance, quote: updated };
    });

    return NextResponse.json({
      success: true,
      message: aceptar
        ? 'Cotización aceptada correctamente'
        : 'Cotización rechazada',
      cotizacion: {
        id: result.quote.id,
        numero: result.quote.numero,
        estado: result.quote.estado,
      },
    });
  } catch (error) {
    console.error('Error procesando aceptación de cotización:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
