import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logQuoteSent } from '@/lib/ventas/audit-helper';
import { randomBytes } from 'crypto';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { quoteSendSchema } from '@/lib/ventas/validation-schemas';
import { sendQuoteEmail } from '@/lib/ventas/email-service';
import { scheduleAutoFollowUps } from '@/lib/ventas/follow-up-scheduler';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Enviar cotización al cliente
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_SEND);
    if (error) return error;

    const companyId = user!.companyId;
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que existe y pertenece a la empresa
    const cotizacion = await prisma.quote.findFirst({
      where: { id, companyId },
      include: {
        client: {
          select: {
            id: true,
            legalName: true,
            email: true
          }
        }
      }
    });

    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    // Solo se pueden enviar cotizaciones en BORRADOR
    if (cotizacion.estado !== 'BORRADOR') {
      return NextResponse.json(
        { error: `No se puede enviar una cotización en estado ${cotizacion.estado}` },
        { status: 422 }
      );
    }

    // Parse and validate request body
    const rawBody = await request.json();
    const validationResult = quoteSendSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Datos de solicitud inválidos',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { mensaje, crearPortalAccess } = validationResult.data;

    // Validar campos requeridos antes de enviar
    const validationErrors: string[] = [];

    if (!cotizacion.client.email && crearPortalAccess) {
      validationErrors.push('El cliente debe tener un email configurado para crear acceso al portal');
    }

    if (!cotizacion.items || cotizacion.items.length === 0) {
      validationErrors.push('La cotización debe tener al menos un item');
    }

    if (!cotizacion.condicionesPago && !cotizacion.diasPlazo) {
      validationErrors.push('Debe especificar condiciones de pago o días de plazo');
    }

    if (!cotizacion.fechaValidez) {
      validationErrors.push('Debe especificar una fecha de validez para la cotización');
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Cotización incompleta',
          details: validationErrors,
        },
        { status: 422 }
      );
    }

    // Actualizar cotización en transacción
    const cotizacionActualizada = await prisma.$transaction(async (tx) => {
      // Actualizar estado
      const updated = await tx.quote.update({
        where: { id },
        data: {
          estado: 'ENVIADA',
          fechaEnvio: new Date(),
        }
      });

      // Crear acceso al portal si se solicita
      if (crearPortalAccess && cotizacion.client.email) {
        const token = randomBytes(32).toString('hex');
        const expiracion = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días

        await tx.clientPortalAccess.create({
          data: {
            clientId: cotizacion.clientId,
            token,
            expiresAt: expiracion,
            quoteId: id,
          }
        });

        // Construir URL del portal
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const portalUrl = `${baseUrl}/portal/cotizaciones/${cotizacion.numero}?token=${token}`;

        console.log(`[Portal] Token de acceso generado para cotización ${cotizacion.numero}: ${token}`);
      }

      return updated;
    });

    // Registrar auditoría
    await logQuoteSent({
      quoteId: id,
      companyId,
      userId: user!.id,
      clientId: cotizacion.clientId,
      clientName: cotizacion.client.legalName,
      documentNumber: cotizacion.numero,
    });

    // Enviar email al cliente si tiene email y se creó acceso al portal
    if (crearPortalAccess && cotizacion.client.email) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const portalAccess = await prisma.clientPortalAccess.findFirst({
        where: { clientId: cotizacion.clientId, quoteId: id },
        orderBy: { createdAt: 'desc' },
      });

      if (portalAccess) {
        const portalUrl = `${baseUrl}/portal/cotizaciones/${cotizacion.numero}?token=${portalAccess.token}`;

        // Enviar email (no esperar, es async)
        sendQuoteEmail({
          quoteNumber: cotizacion.numero,
          clientName: cotizacion.client.legalName || cotizacion.client.name || 'Cliente',
          clientEmail: cotizacion.client.email,
          companyName: 'ORVIT', // TODO: Get from company settings
          total: Number(cotizacion.total),
          moneda: cotizacion.moneda,
          validUntil: cotizacion.fechaValidez,
          portalUrl,
          portalToken: portalAccess.token,
        }).catch(error => {
          console.error('[Email] Error sending quote email (non-blocking):', error);
        });
      }
    }

    // Schedule automatic follow-ups
    scheduleAutoFollowUps(id, companyId, user!.id, { skipExisting: true })
      .then(result => {
        console.log(`[FollowUp] Scheduled ${result.created} automatic follow-ups for quote ${cotizacion.numero}`);
      })
      .catch(error => {
        console.error('[FollowUp] Error scheduling follow-ups (non-blocking):', error);
      });

    return NextResponse.json({
      message: 'Cotización enviada correctamente' + (crearPortalAccess && cotizacion.client.email ? ' (email en camino)' : ''),
      cotizacion: cotizacionActualizada
    });
  } catch (error) {
    console.error('Error enviando cotización:', error);
    return NextResponse.json(
      { error: 'Error al enviar la cotización' },
      { status: 500 }
    );
  }
}
