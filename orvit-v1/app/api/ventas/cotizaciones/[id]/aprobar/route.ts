import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logSalesApproval, logSalesRejection } from '@/lib/ventas/audit-helper';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { quoteApprovalSchema } from '@/lib/ventas/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
  type VentasOperation,
} from '@/lib/ventas/idempotency-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function getOperationType(accion: string): VentasOperation {
  return accion === 'aprobar' ? 'APPROVE_QUOTE' : 'REJECT_QUOTE';
}

// POST - Aprobar o rechazar cotización
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_APPROVE);
    if (error) return error;

    const companyId = user!.companyId;
    const { id } = await params;
    const quoteId = parseInt(id);

    if (isNaN(quoteId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Parse and validate request body
    const rawBody = await request.json();
    const validationResult = quoteApprovalSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Datos de solicitud inválidos',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const body = validationResult.data;
    const idempotencyKey = getIdempotencyKey(request);
    const operation = getOperationType(body.accion);

    // Execute with idempotency
    const idempotencyResult = await withIdempotency(
      idempotencyKey,
      companyId,
      operation,
      async () => {
        // Verificar que existe y pertenece a la empresa
        const cotizacion = await prisma.quote.findFirst({
          where: { id: quoteId, companyId },
        });

        if (!cotizacion) {
          throw new Error('NOT_FOUND');
        }

        // Validar estados permitidos para aprobar/rechazar
        const estadosPermitidos = ['ENVIADA', 'EN_NEGOCIACION'];
        if (!estadosPermitidos.includes(cotizacion.estado)) {
          throw new Error(`INVALID_STATE:${cotizacion.estado}`);
        }

        // Actualizar cotización
        const nuevoEstado = body.accion === 'aprobar' ? 'ACEPTADA' : 'PERDIDA';

        const cotizacionActualizada = await prisma.quote.update({
          where: { id: quoteId },
          data: {
            estado: nuevoEstado,
            aprobadoPor: body.accion === 'aprobar' ? user!.id : null,
            aprobadoAt: body.accion === 'aprobar' ? new Date() : null,
            motivoPerdida: body.accion === 'rechazar' ? body.motivo : null,
          },
        });

        // Registrar auditoría
        if (body.accion === 'aprobar') {
          await logSalesApproval({
            entidad: 'quote',
            entidadId: quoteId,
            estadoAnterior: cotizacion.estado,
            companyId,
            userId: user!.id,
          });
        } else {
          await logSalesRejection({
            entidad: 'quote',
            entidadId: quoteId,
            estadoAnterior: cotizacion.estado,
            reason: body.motivo,
            companyId,
            userId: user!.id,
          });
        }

        return {
          message: `Cotización ${body.accion === 'aprobar' ? 'aprobada' : 'rechazada'} correctamente`,
          cotizacion: cotizacionActualizada,
        };
      },
      {
        entityType: 'Quote',
        getEntityId: () => quoteId,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    // Handle idempotency errors
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    // Handle custom errors
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
      }
      if (error.message.startsWith('INVALID_STATE:')) {
        const estado = error.message.split(':')[1];
        return NextResponse.json(
          { error: `No se puede aprobar/rechazar una cotización en estado ${estado}` },
          { status: 422 }
        );
      }
    }

    console.error('Error aprobando/rechazando cotización:', error);
    return NextResponse.json(
      { error: 'Error al procesar la cotización' },
      { status: 500 }
    );
  }
}
