import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { logSalesCreation } from '@/lib/ventas/audit-helper';
import { getViewMode, applyViewMode, isExtendedMode, DOC_TYPE } from '@/lib/view-mode';
import { generateInvoiceNumber } from '@/lib/ventas/document-number';
import { requirePermission, checkPermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/ventas/idempotency-helper';

export const dynamic = 'force-dynamic';

// GET - Listar facturas
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.FACTURAS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    // ViewMode - filtrar según modo activo
    const viewMode = getViewMode(request);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const clienteId = searchParams.get('clienteId');
    const tipo = searchParams.get('tipo');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const search = searchParams.get('search');
    const pendientes = searchParams.get('pendientes') === 'true';
    const vencidas = searchParams.get('vencidas') === 'true';

    // Construir where base
    const baseWhere: Prisma.SalesInvoiceWhereInput = {
      companyId,
      ...(status && { estado: status as any }),
      ...(clienteId && { clientId: clienteId }),
      ...(tipo && { tipo: tipo as any }),
      ...(pendientes && { estado: 'EMITIDA', saldoPendiente: { gt: 0 } }),
      ...(vencidas && { estado: 'EMITIDA', fechaVencimiento: { lt: new Date() }, saldoPendiente: { gt: 0 } }),
      ...(fechaDesde && { fechaEmision: { gte: new Date(fechaDesde) } }),
      ...(fechaHasta && { fechaEmision: { lte: new Date(fechaHasta) } }),
      ...(search && {
        OR: [
          { numero: { contains: search, mode: 'insensitive' } },
          { client: { legalName: { contains: search, mode: 'insensitive' } } },
        ]
      }),
    };

    // Aplicar filtro ViewMode (Standard: T1+null, Extended: todo)
    const where = applyViewMode(baseWhere, viewMode);

    const [facturas, total] = await Promise.all([
      prisma.salesInvoice.findMany({
        where,
        include: {
          client: { select: { id: true, legalName: true, cuit: true } },
          sale: { select: { id: true, numero: true } },
          _count: { select: { items: true, payments: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.salesInvoice.count({ where })
    ]);

    // Verificar permisos granulares de costos y márgenes
    const [canViewCosts, canViewMargins] = await Promise.all([
      checkPermission(user!.id, user!.companyId, VENTAS_PERMISSIONS.COSTS_VIEW),
      checkPermission(user!.id, user!.companyId, VENTAS_PERMISSIONS.MARGINS_VIEW),
    ]);

    // Filtrar campos sensibles según permisos (protección para campos actuales y futuros)
    const facturasSanitized = facturas.map(factura => ({
      ...factura,
      ...(!canViewCosts && { costoTotal: undefined }),
      ...(!canViewMargins && { margenBruto: undefined, margenPorcentaje: undefined }),
    }));

    return NextResponse.json({
      data: facturasSanitized,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error fetching facturas:', error);
    return NextResponse.json({ error: 'Error al obtener facturas' }, { status: 500 });
  }
}

// POST - Crear factura desde orden de venta
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.FACTURAS_CREATE);
    if (error) return error;

    const companyId = user!.companyId;

    // Cargar configuración de ventas
    const salesConfig = await prisma.salesConfig.findUnique({
      where: { companyId },
      select: {
        tasaIvaDefault: true,
        ivaRates: true,
        diasVencimientoFacturaDefault: true,
      },
    });

    // Get idempotency key (optional but recommended)
    const idempotencyKey = getIdempotencyKey(request);

    // ViewMode - determinar docType según modo activo
    const docType = isExtendedMode(request) ? DOC_TYPE.T2 : DOC_TYPE.T1;

    const body = await request.json();
    const { saleId, clientId, tipo, fechaVencimiento, condicionesPago, notas, items } = body;

    // Validaciones básicas (antes de idempotency)
    if (!clientId) return NextResponse.json({ error: 'Cliente requerido' }, { status: 400 });
    if (!tipo || !['A', 'B', 'C', 'M'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo de factura inválido (A, B, C o M)' }, { status: 400 });
    }

    // Execute with idempotency support
    const idempotencyResult = await withIdempotency(
      idempotencyKey,
      companyId,
      'CREATE_INVOICE',
      async () => {
        let itemsFactura: any[] = [];
        let orden: any = null;

        // Si viene de una orden de venta
        if (saleId) {
          orden = await prisma.sale.findFirst({
            where: { id: parseInt(saleId), companyId },
            include: {
              items: {
                include: {
                  invoiceItems: {
                    where: {
                      invoice: {
                        estado: { notIn: ['ANULADA', 'CANCELADA'] }
                      }
                    }
                  }
                }
              },
              client: true
            }
          });

          if (!orden) throw new Error('ORDER_NOT_FOUND');

          // Items pendientes de facturar (calculate invoiced quantity from invoice items)
          itemsFactura = items && items.length > 0 ? items : orden.items
            .filter((i: any) => {
              const cantidadFacturada = i.invoiceItems?.reduce((sum: number, ii: any) => sum + Number(ii.cantidad), 0) || 0;
              return Number(i.cantidad) - cantidadFacturada > 0;
            })
            .map((i: any) => {
              const cantidadFacturada = i.invoiceItems?.reduce((sum: number, ii: any) => sum + Number(ii.cantidad), 0) || 0;
              return {
                saleItemId: i.id,
                productId: i.productId,
                descripcion: i.descripcion,
                cantidad: Number(i.cantidad) - cantidadFacturada,
                precioUnitario: Number(i.precioUnitario),
                descuento: Number(i.descuento || 0),
              };
            });
        } else {
          // Factura directa (sin orden)
          if (!items || items.length === 0) {
            throw new Error('ITEMS_REQUIRED');
          }
          itemsFactura = items;
        }

        if (itemsFactura.length === 0) {
          throw new Error('NO_ITEMS_TO_INVOICE');
        }

        // Calcular totales con IVA multi-alícuota
        let subtotal = 0;
        let iva21 = 0;
        let iva105 = 0;
        let iva27 = 0;
        let exento = 0;

        const itemsConCalculos = itemsFactura.map((item: any) => {
          const cantidad = parseFloat(item.cantidad);
          const precio = parseFloat(item.precioUnitario);
          const descuento = parseFloat(item.descuento || '0');
          const alicuotaIva = parseFloat(item.alicuotaIva || item.alicuotaIVA || salesConfig?.tasaIvaDefault?.toString() || '21');
          const itemSubtotal = cantidad * precio * (1 - descuento / 100);

          subtotal += itemSubtotal;

          // Calcular IVA por item según alícuota (solo si no es Factura C)
          if (tipo !== 'C') {
            const itemIva = itemSubtotal * (alicuotaIva / 100);

            if (alicuotaIva === 21) {
              iva21 += itemIva;
            } else if (alicuotaIva === 10.5) {
              iva105 += itemIva;
            } else if (alicuotaIva === 27) {
              iva27 += itemIva;
            } else if (alicuotaIva === 0) {
              exento += itemSubtotal;
            }
          }

          return {
            ...item,
            cantidad,
            precioUnitario: precio,
            descuento,
            alicuotaIva,
            subtotal: itemSubtotal,
          };
        });

        const impuestos = iva21 + iva105 + iva27;
        const total = subtotal + impuestos;

        const numero = await generateInvoiceNumber(companyId, tipo as 'A' | 'B' | 'C' | 'NV');

        // Crear factura en transacción
        const factura = await prisma.$transaction(async (tx) => {
          const invoice = await tx.salesInvoice.create({
            data: {
              numero,
              clientId,
              saleId: saleId ? parseInt(saleId) : null,
              tipo: tipo as any,
              estado: 'BORRADOR',
              fecha: new Date(),
              fechaVencimiento: fechaVencimiento
                ? new Date(fechaVencimiento)
                : new Date(Date.now() + (salesConfig?.diasVencimientoFacturaDefault || 30) * 24 * 60 * 60 * 1000),
              moneda: orden?.moneda || 'ARS',
              netoGravado: subtotal,
              iva21: iva21 > 0 ? iva21 : null,
              iva105: iva105 > 0 ? iva105 : null,
              iva27: iva27 > 0 ? iva27 : null,
              exento: exento > 0 ? exento : null,
              total,
              saldoPendiente: total,
              condicionesPago: condicionesPago || orden?.condicionesPago,
              notas,
              docType,
              companyId,
              createdBy: user!.id,
            }
          });

          // Crear items
          await tx.salesInvoiceItem.createMany({
            data: itemsConCalculos.map((item: any) => ({
              invoiceId: invoice.id,
              saleItemId: item.saleItemId || null,
              productId: item.productId || null,
              codigo: item.codigo || null,
              descripcion: item.descripcion || '',
              cantidad: item.cantidad,
              unidad: item.unidad || 'UN',
              precioUnitario: item.precioUnitario,
              descuento: item.descuento,
              alicuotaIva: item.alicuotaIva,
              subtotal: item.subtotal,
            }))
          });

          return invoice;
        });

        // Auditoría
        const client = await prisma.client.findUnique({
          where: { id: clientId },
          select: { legalName: true }
        });

        await logSalesCreation({
          entidad: 'sales_invoice',
          entidadId: factura.id,
          companyId,
          userId: user!.id,
          estadoInicial: 'BORRADOR',
          amount: total,
          clientId,
          clientName: client?.legalName,
          documentNumber: numero,
        });

        return factura;
      },
      {
        entityType: 'SalesInvoice',
        getEntityId: (result) => result?.id || 0,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      status: idempotencyResult.isReplay ? 200 : 201,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    console.error('Error creating factura:', error);

    // Handle idempotency conflict error
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    // Handle custom errors
    if (error instanceof Error) {
      if (error.message === 'ORDER_NOT_FOUND') {
        return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
      }
      if (error.message === 'ITEMS_REQUIRED') {
        return NextResponse.json({ error: 'Items requeridos' }, { status: 400 });
      }
      if (error.message === 'NO_ITEMS_TO_INVOICE') {
        return NextResponse.json({ error: 'No hay items para facturar' }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'Error al crear factura' }, { status: 500 });
  }
}
