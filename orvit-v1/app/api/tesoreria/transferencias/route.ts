import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getViewMode, applyViewMode, isExtendedMode } from '@/lib/view-mode';
import { Prisma } from '@prisma/client';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import { createTransferSchema } from '@/lib/tesoreria/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/tesoreria/idempotency-helper';

export const dynamic = 'force-dynamic';

// Generar número de transferencia
async function generateNumero(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TRF-${year}-`;

  const lastTransfer = await prisma.treasuryTransfer.findFirst({
    where: {
      companyId,
      numero: { startsWith: prefix }
    },
    orderBy: { numero: 'desc' }
  });

  if (!lastTransfer) {
    return `${prefix}00001`;
  }

  const lastNum = parseInt(lastTransfer.numero.replace(prefix, '')) || 0;
  return `${prefix}${String(lastNum + 1).padStart(5, '0')}`;
}

// GET /api/tesoreria/transferencias - Listar transferencias
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.TRANSFERENCIAS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const estado = searchParams.get('estado');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    const viewMode = getViewMode(request);

    // Base where
    const baseWhere: Prisma.TreasuryTransferWhereInput = {
      companyId,
      ...(estado && { estado: estado as any }),
    };

    // Filtro por rango de fechas
    if (fechaDesde || fechaHasta) {
      baseWhere.fecha = {
        ...(fechaDesde && { gte: new Date(fechaDesde) }),
        ...(fechaHasta && { lte: new Date(fechaHasta) }),
      };
    }

    // Aplicar filtro ViewMode (T1/T2)
    const where = applyViewMode(baseWhere, viewMode);

    const [transferencias, total] = await Promise.all([
      prisma.treasuryTransfer.findMany({
        where,
        include: {
          origenCaja: {
            select: { id: true, codigo: true, nombre: true }
          },
          origenBanco: {
            select: { id: true, codigo: true, nombre: true, banco: true }
          },
          destinoCaja: {
            select: { id: true, codigo: true, nombre: true }
          },
          destinoBanco: {
            select: { id: true, codigo: true, nombre: true, banco: true }
          },
          createdByUser: {
            select: { id: true, name: true }
          }
        },
        orderBy: { fecha: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.treasuryTransfer.count({ where })
    ]);

    // Resumen por estado
    // Para groupBy, usamos filtro directo porque NOT no funciona bien con groupBy
    const resumenWhere: Prisma.TreasuryTransferWhereInput = { companyId };
    if (viewMode === 'S') {
      resumenWhere.OR = [
        { docType: 'T1' },
        { docType: null }
      ];
    }

    const resumen = await prisma.treasuryTransfer.groupBy({
      by: ['estado', 'moneda'],
      where: resumenWhere,
      _count: { id: true },
      _sum: { importe: true }
    });

    // Total del mes actual
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const totalMes = await prisma.treasuryTransfer.aggregate({
      where: applyViewMode({
        companyId,
        fecha: { gte: inicioMes },
        estado: 'COMPLETADA'
      }, viewMode),
      _sum: { importe: true },
      _count: { id: true }
    });

    return NextResponse.json({
      data: transferencias,
      resumen,
      totalMes: {
        cantidad: totalMes._count.id,
        total: Number(totalMes._sum.importe || 0)
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      _m: viewMode
    });
  } catch (error) {
    console.error('Error fetching transferencias:', error);
    return NextResponse.json(
      { error: 'Error al obtener las transferencias' },
      { status: 500 }
    );
  }
}

// POST /api/tesoreria/transferencias - Crear transferencia
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.TRANSFERENCIAS_CREATE);
    if (error) return error;

    const companyId = user!.companyId;

    // Get idempotency key
    const idempotencyKey = getIdempotencyKey(request);

    const viewMode = getViewMode(request);
    const body = await request.json();

    // Validate with Zod schema
    const validation = createTransferSchema.safeParse(body);
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
      'CREATE_TRANSFER',
      async () => {
        // Validar docType - T2 solo en modo Extended
        const requestedDocType = data.docType === 'T2' ? 'T2' : 'T1';
        if (requestedDocType === 'T2' && !isExtendedMode(viewMode)) {
          throw new Error('T2_NOT_ALLOWED');
        }

        // Validar que origen y destino sean diferentes
        if (data.tipoOrigen === data.tipoDestino && data.origenId === data.destinoId) {
          throw new Error('SAME_ORIGIN_DESTINATION');
        }

        // Verificar que las cuentas existan y pertenezcan a la empresa
        if (data.tipoOrigen === 'caja') {
          const caja = await prisma.cashAccount.findFirst({
            where: { id: data.origenId, companyId }
          });
          if (!caja) throw new Error('ORIGIN_CASH_NOT_FOUND');
        } else {
          const banco = await prisma.bankAccount.findFirst({
            where: { id: data.origenId, companyId }
          });
          if (!banco) throw new Error('ORIGIN_BANK_NOT_FOUND');
        }

        if (data.tipoDestino === 'caja') {
          const caja = await prisma.cashAccount.findFirst({
            where: { id: data.destinoId, companyId }
          });
          if (!caja) throw new Error('DEST_CASH_NOT_FOUND');
        } else {
          const banco = await prisma.bankAccount.findFirst({
            where: { id: data.destinoId, companyId }
          });
          if (!banco) throw new Error('DEST_BANK_NOT_FOUND');
        }

        const numero = await generateNumero(companyId);

        // Crear la transferencia
        const transfer = await prisma.treasuryTransfer.create({
          data: {
            companyId,
            numero,
            origenCajaId: data.tipoOrigen === 'caja' ? data.origenId : null,
            origenBancoId: data.tipoOrigen === 'banco' ? data.origenId : null,
            destinoCajaId: data.tipoDestino === 'caja' ? data.destinoId : null,
            destinoBancoId: data.tipoDestino === 'banco' ? data.destinoId : null,
            importe: data.importe,
            moneda: data.moneda,
            fecha: new Date(),
            descripcion: data.descripcion || null,
            estado: 'COMPLETADA',
            docType: requestedDocType as any,
            createdBy: user!.id
          },
          include: {
            origenCaja: { select: { codigo: true, nombre: true } },
            origenBanco: { select: { codigo: true, nombre: true, banco: true } },
            destinoCaja: { select: { codigo: true, nombre: true } },
            destinoBanco: { select: { codigo: true, nombre: true, banco: true } },
          }
        });

        // Crear movimientos en las cuentas correspondientes
        // Egreso en origen
        if (data.tipoOrigen === 'caja') {
          await prisma.cashMovement.create({
            data: {
              companyId,
              cashAccountId: data.origenId,
              tipo: 'TRANSFERENCIA_SALIDA',
              descripcion: `Transferencia ${numero} a ${data.tipoDestino === 'caja' ? transfer.destinoCaja?.nombre : transfer.destinoBanco?.nombre}`,
              ingreso: 0,
              egreso: data.importe,
              fecha: new Date(),
              docType: requestedDocType as any,
              createdBy: user!.id
            }
          });
        } else {
          await prisma.bankMovement.create({
            data: {
              companyId,
              bankAccountId: data.origenId,
              tipo: 'TRANSFERENCIA_SALIDA',
              descripcion: `Transferencia ${numero} a ${data.tipoDestino === 'caja' ? transfer.destinoCaja?.nombre : transfer.destinoBanco?.nombre}`,
              ingreso: 0,
              egreso: data.importe,
              fecha: new Date(),
              createdBy: user!.id
            }
          });
        }

        // Ingreso en destino
        if (data.tipoDestino === 'caja') {
          await prisma.cashMovement.create({
            data: {
              companyId,
              cashAccountId: data.destinoId,
              tipo: 'TRANSFERENCIA_ENTRADA',
              descripcion: `Transferencia ${numero} desde ${data.tipoOrigen === 'caja' ? transfer.origenCaja?.nombre : transfer.origenBanco?.nombre}`,
              ingreso: data.importe,
              egreso: 0,
              fecha: new Date(),
              docType: requestedDocType as any,
              createdBy: user!.id
            }
          });
        } else {
          await prisma.bankMovement.create({
            data: {
              companyId,
              bankAccountId: data.destinoId,
              tipo: 'TRANSFERENCIA_ENTRADA',
              descripcion: `Transferencia ${numero} desde ${data.tipoOrigen === 'caja' ? transfer.origenCaja?.nombre : transfer.origenBanco?.nombre}`,
              ingreso: data.importe,
              egreso: 0,
              fecha: new Date(),
              createdBy: user!.id
            }
          });
        }

        return transfer;
      },
      {
        entityType: 'TreasuryTransfer',
        getEntityId: (result) => result.id,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      status: idempotencyResult.isReplay ? 200 : 201,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    console.error('Error creating transferencia:', error);

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
      if (error.message === 'SAME_ORIGIN_DESTINATION') {
        return NextResponse.json(
          { error: 'Origen y destino no pueden ser el mismo' },
          { status: 400 }
        );
      }
      if (error.message === 'ORIGIN_CASH_NOT_FOUND') {
        return NextResponse.json({ error: 'Caja de origen no encontrada' }, { status: 404 });
      }
      if (error.message === 'ORIGIN_BANK_NOT_FOUND') {
        return NextResponse.json({ error: 'Banco de origen no encontrado' }, { status: 404 });
      }
      if (error.message === 'DEST_CASH_NOT_FOUND') {
        return NextResponse.json({ error: 'Caja de destino no encontrada' }, { status: 404 });
      }
      if (error.message === 'DEST_BANK_NOT_FOUND') {
        return NextResponse.json({ error: 'Banco de destino no encontrado' }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: 'Error al crear la transferencia' },
      { status: 500 }
    );
  }
}
