/**
 * Payment Disputes API - O2C Phase 5
 *
 * Handles customer disputes about invoices.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getNextNumber } from '@/lib/ventas/sequence-generator';
import { applyViewMode, ViewMode, isExtendedMode, DOC_TYPE } from '@/lib/view-mode';
import { createDisputeSchema } from '@/lib/ventas/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/ventas/idempotency-helper';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - List disputes
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COBRANZAS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const invoiceId = searchParams.get('invoiceId');
    const tipo = searchParams.get('tipo');
    const estado = searchParams.get('estado');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const viewMode = (searchParams.get('viewMode') || 'S') as ViewMode;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where = applyViewMode(
      {
        companyId,
        ...(clientId && { clientId }),
        ...(invoiceId && { invoiceId: parseInt(invoiceId) }),
        ...(tipo && { tipo: tipo as any }),
        ...(estado && { estado: estado as any }),
        ...(fechaDesde &&
          fechaHasta && {
            createdAt: {
              gte: new Date(fechaDesde),
              lte: new Date(fechaHasta),
            },
          }),
      },
      viewMode
    );

    const [disputes, total] = await Promise.all([
      prisma.paymentDispute.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          invoice: {
            select: {
              id: true,
              numero: true,
              total: true,
              saldoPendiente: true,
            },
          },
          creditNote: {
            select: { id: true, numero: true, total: true },
          },
        },
        orderBy: [{ estado: 'asc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.paymentDispute.count({ where }),
    ]);

    return NextResponse.json({
      data: disputes,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('Error fetching disputes:', error);
    return NextResponse.json(
      { error: 'Error al obtener disputas' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Create dispute
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COBRANZAS_MANAGE);
    if (error) return error;

    const companyId = user!.companyId;

    // Get idempotency key
    const idempotencyKey = getIdempotencyKey(req);

    // Determine docType from ViewMode
    const docType = isExtendedMode(req) ? DOC_TYPE.T2 : DOC_TYPE.T1;

    const body = await req.json();

    // Validate with Zod schema
    const validation = createDisputeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Execute with idempotency support
    const idempotencyResult = await withIdempotency(
      idempotencyKey,
      companyId,
      'CREATE_DISPUTE',
      async () => {
        // Generate dispute number
        const sequence = await getNextNumber(companyId, 'DISPUTE');

        const dispute = await prisma.paymentDispute.create({
          data: {
            numero: sequence.formatted,
            clientId: data.clientId,
            invoiceId: data.invoiceId,
            deliveryId: data.deliveryId,
            tipo: data.tipo as any,
            estado: 'ABIERTA',
            descripcion: data.descripcion,
            montoDisputa: data.montoDisputa,
            docType,
            companyId,
            createdBy: user!.id,
          },
          include: {
            client: { select: { id: true, name: true } },
          },
        });

        return {
          id: dispute.id,
          numero: dispute.numero,
          message: 'Disputa creada',
        };
      },
      {
        entityType: 'PaymentDispute',
        getEntityId: (result) => result.id,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      status: idempotencyResult.isReplay ? 200 : 201,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    console.error('Error creating dispute:', error);

    // Handle idempotency conflict error
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    return NextResponse.json(
      { error: 'Error al crear disputa' },
      { status: 500 }
    );
  }
}
