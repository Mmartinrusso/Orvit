import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getViewMode, isExtendedMode } from '@/lib/view-mode';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import { createChequeSchema } from '@/lib/tesoreria/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/tesoreria/idempotency-helper';

export const dynamic = 'force-dynamic';

// GET /api/tesoreria/cheques - Listar cartera de cheques
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CHEQUES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const estado = searchParams.get('estado');
    const origen = searchParams.get('origen');
    const tipo = searchParams.get('tipo');
    const enCartera = searchParams.get('enCartera');
    const vencidosHoy = searchParams.get('vencidosHoy');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    const viewMode = getViewMode(request);

    // Construir where con ViewMode filter
    const baseWhere: Prisma.ChequeWhereInput = {
      companyId,
      ...(estado && { estado: estado as any }),
      ...(origen && { origen: origen as any }),
      ...(tipo && { tipo: tipo as any }),
      ...(enCartera === 'true' && { estado: 'CARTERA' }),
    };

    // Filtro por vencimientos de hoy
    if (vencidosHoy === 'true') {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);
      baseWhere.fechaVencimiento = { gte: hoy, lt: manana };
      baseWhere.estado = 'CARTERA';
    }

    // Filtro por rango de fechas de vencimiento
    if (fechaDesde || fechaHasta) {
      baseWhere.fechaVencimiento = {
        ...(fechaDesde && { gte: new Date(fechaDesde) }),
        ...(fechaHasta && { lte: new Date(fechaHasta) }),
      };
    }

    // Aplicar filtro ViewMode manualmente para evitar problemas con NOT y null
    let where: Prisma.ChequeWhereInput = baseWhere;
    if (viewMode === 'S') {
      // Standard mode: solo T1 (excluir T2)
      // Usamos docType no igual a T2 porque cheques legacy pueden tener null
      where = {
        ...baseWhere,
        NOT: { docType: 'T2' }
      };
    }

    const [cheques, total] = await Promise.all([
      prisma.cheque.findMany({
        where,
        include: {
          clientPayment: {
            select: {
              id: true,
              numero: true,
              client: {
                select: { id: true, name: true }
              }
            }
          },
          paymentOrder: {
            select: {
              id: true,
              fechaPago: true,
              proveedor: {
                select: { id: true, name: true }
              }
            }
          },
          bankAccount: {
            select: { id: true, codigo: true, nombre: true, banco: true }
          },
        },
        orderBy: [
          { estado: 'asc' },
          { fechaVencimiento: 'asc' }
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.cheque.count({ where })
    ]);

    // Resumen de cartera
    const resumenWhere: Prisma.ChequeWhereInput = { companyId };
    if (viewMode === 'S') {
      // Standard mode: excluir T2
      resumenWhere.NOT = { docType: 'T2' };
    }

    const resumenCartera = await prisma.cheque.groupBy({
      by: ['estado', 'moneda'],
      where: resumenWhere,
      _count: { id: true },
      _sum: { importe: true }
    });

    return NextResponse.json({
      data: cheques,
      resumen: resumenCartera,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      _m: viewMode
    });
  } catch (error) {
    console.error('Error fetching cheques:', error);
    return NextResponse.json(
      { error: 'Error al obtener los cheques' },
      { status: 500 }
    );
  }
}

// POST /api/tesoreria/cheques - Crear cheque manual (no asociado a pago/cobro)
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CHEQUES_CREATE);
    if (error) return error;

    const companyId = user!.companyId;

    // Get idempotency key
    const idempotencyKey = getIdempotencyKey(request);

    const viewMode = getViewMode(request);
    const body = await request.json();

    // Validate with Zod schema
    const validation = createChequeSchema.safeParse(body);
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
      'CREATE_CHEQUE',
      async () => {
        // Validar docType - T2 solo se puede crear en modo Extended
        const requestedDocType = data.docType === 'T2' ? 'T2' : 'T1';
        if (requestedDocType === 'T2') {
          if (!isExtendedMode(viewMode)) {
            throw new Error('T2_NOT_ALLOWED');
          }
          if (data.tipo === 'ECHEQ') {
            throw new Error('ECHEQ_CANNOT_BE_T2');
          }
        }

        // Si es EMITIDO y FISICO, debe tener cuenta bancaria (already validated in Zod)

        const nuevoCheque = await prisma.cheque.create({
          data: {
            companyId,
            origen: data.origen as any,
            tipo: data.tipo as any,
            numero: data.numero,
            banco: data.banco,
            sucursal: data.sucursal || null,
            titular: data.titular,
            cuitTitular: data.cuitTitular || null,
            importe: data.importe,
            moneda: data.moneda,
            fechaEmision: new Date(data.fechaEmision),
            fechaVencimiento: new Date(data.fechaVencimiento),
            estado: 'CARTERA',
            bankAccountId: data.bankAccountId || null,
            docType: data.tipo === 'ECHEQ' ? 'T1' : requestedDocType, // ECHEQ siempre T1
            createdBy: user!.id
          },
          include: {
            bankAccount: {
              select: { codigo: true, nombre: true, banco: true }
            }
          }
        });

        return nuevoCheque;
      },
      {
        entityType: 'Cheque',
        getEntityId: (result) => result.id,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      status: idempotencyResult.isReplay ? 200 : 201,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    console.error('Error creating cheque:', error);

    // Handle idempotency conflict error
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    // Handle custom errors
    if (error instanceof Error) {
      if (error.message === 'T2_NOT_ALLOWED') {
        return NextResponse.json(
          { error: 'No autorizado para crear este tipo de documento' },
          { status: 403 }
        );
      }
      if (error.message === 'ECHEQ_CANNOT_BE_T2') {
        return NextResponse.json(
          { error: 'Los ECHEQ no pueden ser de tipo T2' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Error al crear el cheque' },
      { status: 500 }
    );
  }
}
