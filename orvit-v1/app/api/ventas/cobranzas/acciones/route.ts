/**
 * Collection Actions API - O2C Phase 5
 *
 * Handles dunning/collection actions for overdue invoices.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { applyViewMode, ViewMode, isExtendedMode, DOC_TYPE } from '@/lib/view-mode';
import { createCollectionActionSchema } from '@/lib/ventas/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/ventas/idempotency-helper';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - List collection actions
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
    const asignadoA = searchParams.get('asignadoA');
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
        ...(asignadoA && { asignadoA: parseInt(asignadoA) }),
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

    const [actions, total] = await Promise.all([
      prisma.collectionAction.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, phone: true } },
          invoice: {
            select: {
              id: true,
              numero: true,
              total: true,
              saldoPendiente: true,
              fechaVencimiento: true,
            },
          },
        },
        orderBy: [{ estado: 'asc' }, { fecha: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.collectionAction.count({ where }),
    ]);

    return NextResponse.json({
      data: actions,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('Error fetching collection actions:', error);
    return NextResponse.json(
      { error: 'Error al obtener acciones de cobranza' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Create collection action
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
    const validation = createCollectionActionSchema.safeParse(body);
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
      'CREATE_COLLECTION_ACTION',
      async () => {
        const action = await prisma.collectionAction.create({
          data: {
            clientId: data.clientId,
            invoiceId: data.invoiceId,
            tipo: data.tipo as any,
            estado: 'PENDIENTE',
            fecha: new Date(data.fecha),
            descripcion: data.descripcion,
            contactoNombre: data.contactoNombre,
            contactoTelefono: data.contactoTelefono,
            contactoEmail: data.contactoEmail,
            asignadoA: data.asignadoA || user!.id,
            proximaAccion: data.proximaAccion ? new Date(data.proximaAccion) : null,
            promesaPago: data.promesaPago ? new Date(data.promesaPago) : null,
            promesaMonto: data.promesaMonto,
            docType,
            companyId,
            createdBy: user!.id,
          },
          include: {
            client: { select: { id: true, name: true } },
          },
        });

        return {
          id: action.id,
          tipo: action.tipo,
          message: 'Acción de cobranza creada',
        };
      },
      {
        entityType: 'CollectionAction',
        getEntityId: (result) => result.id,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      status: idempotencyResult.isReplay ? 200 : 201,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    console.error('Error creating collection action:', error);

    // Handle idempotency conflict error
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    return NextResponse.json(
      { error: 'Error al crear acción de cobranza' },
      { status: 500 }
    );
  }
}
