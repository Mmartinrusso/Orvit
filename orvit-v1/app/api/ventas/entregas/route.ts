import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { logDeliveryCreated } from '@/lib/ventas/audit-helper';
import { getViewMode, applyViewMode, isExtendedMode, DOC_TYPE } from '@/lib/view-mode';
import { generateDeliveryNumber } from '@/lib/ventas/document-number';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { createDeliverySchema } from '@/lib/ventas/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/ventas/idempotency-helper';

export const dynamic = 'force-dynamic';

// GET - Listar entregas
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    // ViewMode - filtrar según modo activo
    const viewMode = getViewMode(request);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const statusIn = searchParams.get('statusIn'); // Comma-separated statuses
    const saleId = searchParams.get('saleId');
    const clienteId = searchParams.get('clienteId');
    const search = searchParams.get('search');
    const transportista = searchParams.get('transportista');
    const conductorNombre = searchParams.get('conductorNombre');
    const direccion = searchParams.get('direccion');
    const fechaProgramadaDesde = searchParams.get('fechaProgramadaDesde');
    const fechaProgramadaHasta = searchParams.get('fechaProgramadaHasta');
    const fechaEntregaDesde = searchParams.get('fechaEntregaDesde');
    const fechaEntregaHasta = searchParams.get('fechaEntregaHasta');
    const tipo = searchParams.get('tipo'); // RETIRO | ENVIO

    // Construir where base
    const baseWhere: Prisma.SaleDeliveryWhereInput = {
      companyId,
      ...(status && { estado: status as any }),
      ...(statusIn && { estado: { in: statusIn.split(',') as any } }),
      ...(saleId && { saleId: parseInt(saleId) }),
      ...(clienteId && { clientId: parseInt(clienteId) }),
      ...(tipo && { tipo: tipo as any }),
      ...(transportista && { transportista: { contains: transportista, mode: 'insensitive' } }),
      ...(conductorNombre && { conductorNombre: { contains: conductorNombre, mode: 'insensitive' } }),
      ...(direccion && { direccionEntrega: { contains: direccion, mode: 'insensitive' } }),
      ...(fechaProgramadaDesde && {
        fechaProgramada: { gte: new Date(fechaProgramadaDesde) }
      }),
      ...(fechaProgramadaHasta && {
        fechaProgramada: { lte: new Date(fechaProgramadaHasta) }
      }),
      ...(fechaEntregaDesde && {
        fechaEntrega: { gte: new Date(fechaEntregaDesde) }
      }),
      ...(fechaEntregaHasta && {
        fechaEntrega: { lte: new Date(fechaEntregaHasta) }
      }),
      ...(search && {
        OR: [
          { numero: { contains: search, mode: 'insensitive' } },
          { sale: { numero: { contains: search, mode: 'insensitive' } } },
          { sale: { client: { legalName: { contains: search, mode: 'insensitive' } } } },
          { sale: { client: { name: { contains: search, mode: 'insensitive' } } } },
        ]
      }),
    };

    // Aplicar filtro ViewMode (Standard: T1+null, Extended: todo)
    const where = applyViewMode(baseWhere, viewMode);

    const [entregas, total] = await Promise.all([
      prisma.saleDelivery.findMany({
        where,
        include: {
          sale: {
            select: {
              id: true,
              numero: true,
              client: {
                select: {
                  id: true,
                  legalName: true,
                  name: true,
                }
              }
            }
          },
          _count: { select: { items: true, evidences: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.saleDelivery.count({ where })
    ]);

    return NextResponse.json({
      data: entregas,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error fetching entregas:', error);
    return NextResponse.json({ error: 'Error al obtener entregas' }, { status: 500 });
  }
}

// POST - Crear entrega desde orden de venta
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_CREATE);
    if (error) return error;

    const companyId = user!.companyId;

    // Get idempotency key (optional but recommended)
    const idempotencyKey = getIdempotencyKey(request);

    // ViewMode - determinar docType según modo activo
    const docType = isExtendedMode(request) ? DOC_TYPE.T2 : DOC_TYPE.T1;

    const body = await request.json();

    // Validar con Zod
    const validation = createDeliverySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { saleId, fechaProgramada, direccionEntrega, transportista, notas, items, tipo } = validation.data;
    const costoFlete = body.costoFlete; // Optional field not in schema

    // Execute with idempotency support
    const idempotencyResult = await withIdempotency(
      idempotencyKey,
      companyId,
      'CREATE_DELIVERY',
      async () => {
        // Verificar orden
        const orden = await prisma.sale.findFirst({
          where: { id: saleId, companyId },
          include: { items: true }
        });

        if (!orden) throw new Error('ORDER_NOT_FOUND');
        if (!['CONFIRMADA', 'EN_PREPARACION'].includes(orden.estado)) {
          throw new Error(`INVALID_STATE:${orden.estado}`);
        }

        const numero = await generateDeliveryNumber(companyId);

        // Crear entrega
        const entrega = await prisma.$transaction(async (tx) => {
          const delivery = await tx.saleDelivery.create({
            data: {
              numero,
              saleId,
              tipo: tipo || 'ENVIO',
              clientId: orden.clientId,
              estado: 'PENDIENTE',
              fechaProgramada: fechaProgramada ? new Date(fechaProgramada) : null,
              direccionEntrega: direccionEntrega || orden.lugarEntrega,
              transportista,
              costoFlete: costoFlete ? parseFloat(costoFlete) : null,
              notas,
              docType,
              companyId,
              createdBy: user!.id,
            }
          });

          // Items a entregar
          const itemsEntrega = items && items.length > 0 ? items : orden.items.map(i => ({
            saleItemId: i.id,
            productId: i.productId,
            cantidad: Number(i.cantidadPendiente)
          }));

          await tx.saleDeliveryItem.createMany({
            data: itemsEntrega.filter((i: any) => i.cantidad > 0).map((item: any) => ({
              deliveryId: delivery.id,
              saleItemId: item.saleItemId,
              productId: item.productId,
              cantidad: item.cantidad,
            }))
          });

          // Actualizar estado de la orden
          await tx.sale.update({
            where: { id: saleId },
            data: { estado: 'EN_PREPARACION' }
          });

          return delivery;
        });

        await logDeliveryCreated({
          deliveryId: entrega.id,
          companyId,
          userId: user!.id,
          saleId,
          saleNumber: orden.numero,
        });

        return entrega;
      },
      {
        entityType: 'SaleDelivery',
        getEntityId: (result) => result?.id || 0,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      status: idempotencyResult.isReplay ? 200 : 201,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    console.error('Error creating entrega:', error);

    // Handle idempotency conflict error
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    // Handle custom errors
    if (error instanceof Error) {
      if (error.message === 'ORDER_NOT_FOUND') {
        return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
      }
      if (error.message.startsWith('INVALID_STATE:')) {
        const estado = error.message.split(':')[1];
        return NextResponse.json({ error: `No se puede crear entrega para orden en estado ${estado}` }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'Error al crear entrega' }, { status: 500 });
  }
}
