import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { logSalesCreation } from '@/lib/ventas/audit-helper';
import { getViewMode, isExtendedMode, DOC_TYPE } from '@/lib/view-mode';
import { generateSaleNumber } from '@/lib/ventas/document-number';
import { requirePermission, checkPermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { createSaleSchema } from '@/lib/ventas/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/ventas/idempotency-helper';

export const dynamic = 'force-dynamic';

// Cache
const ordenesCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutos

// GET - Listar órdenes de venta
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    // ViewMode - filtrar según modo activo
    const viewMode = getViewMode(request);
    const isExtended = viewMode === 'E';

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const estado = searchParams.get('estado') || searchParams.get('status');
    const clienteId = searchParams.get('clienteId');
    const vendedorId = searchParams.get('vendedorId');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const search = searchParams.get('search');

    // Construir where base
    const baseConditions: Prisma.SaleWhereInput = {
      companyId,
      ...(estado && { estado: estado as any }),
      ...(clienteId && { clientId: clienteId }),
      ...(vendedorId && { sellerId: parseInt(vendedorId) }),
      ...(fechaDesde && { fechaEmision: { gte: new Date(fechaDesde) } }),
      ...(fechaHasta && { fechaEmision: { lte: new Date(fechaHasta) } }),
    };

    // Construir AND conditions para evitar conflictos entre ORs
    const andConditions: Prisma.SaleWhereInput[] = [];

    // Search OR
    if (search) {
      andConditions.push({
        OR: [
          { numero: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { client: { legalName: { contains: search, mode: Prisma.QueryMode.insensitive } } },
          { client: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } },
        ]
      });
    }

    // ViewMode: Standard muestra solo T1, Extended muestra todo (T1+T2)
    if (!isExtended) {
      andConditions.push({ docType: 'T1' });
    }

    // Construir where final
    const where: Prisma.SaleWhereInput = andConditions.length > 0
      ? { ...baseConditions, AND: andConditions }
      : baseConditions;

    // Verificar caché - incluir viewMode en key
    const cacheKey = `ordenes-venta-${companyId}-${page}-${estado || 'all'}-${viewMode}`;
    if (!search && !clienteId && !fechaDesde && !fechaHasta) {
      const cached = ordenesCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data, { headers: { 'X-Cache': 'HIT' } });
      }
    }

    const [ordenes, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              legalName: true,
              name: true,
              cuit: true,
              email: true
            }
          },
          seller: {
            select: { id: true, name: true, email: true }
          },
          createdByUser: {
            select: { id: true, name: true }
          },
          quote: {
            select: { id: true, numero: true }
          },
          _count: {
            select: {
              items: true,
              deliveries: true,
              invoices: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sale.count({ where })
    ]);

    // Verificar permisos granulares de costos y márgenes
    const [canViewCosts, canViewMargins] = await Promise.all([
      checkPermission(user!.id, user!.companyId, VENTAS_PERMISSIONS.COSTS_VIEW),
      checkPermission(user!.id, user!.companyId, VENTAS_PERMISSIONS.MARGINS_VIEW),
    ]);

    // Filtrar campos sensibles según permisos
    const ordenesSanitized = ordenes.map(orden => ({
      ...orden,
      ...(!canViewCosts && { costoTotal: undefined }),
      ...(!canViewMargins && { margenBruto: undefined, margenPorcentaje: undefined }),
    }));

    const result = {
      data: ordenesSanitized,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };

    // Guardar en caché
    if (!search && !clienteId && !fechaDesde && !fechaHasta) {
      ordenesCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching órdenes de venta:', error);
    return NextResponse.json(
      { error: 'Error al obtener las órdenes de venta', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Crear orden de venta (directa, sin cotización)
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_CREATE);
    if (error) return error;

    const companyId = user!.companyId;

    // Get idempotency key (optional but recommended)
    const idempotencyKey = getIdempotencyKey(request);

    // ViewMode - determinar docType según modo activo
    const docType = isExtendedMode(request) ? DOC_TYPE.T2 : DOC_TYPE.T1;

    const body = await request.json();

    // Validate with Zod schema
    const validation = createSaleSchema.safeParse(body);
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
      'CREATE_SALE',
      async () => {
        // Obtener configuración de ventas
        const salesConfig = await prisma.salesConfig.findUnique({
          where: { companyId }
        });

        // Calcular totales
        let subtotal = 0;
        let costoTotalCalc = 0;
        const itemsConCalculos = await Promise.all(data.items.map(async (item, index: number) => {
          const cantidad = item.cantidad;
          const precio = item.precioUnitario;
          const descuento = item.descuento;
          const itemSubtotal = cantidad * precio * (1 - descuento / 100);
          subtotal += itemSubtotal;

          // Obtener costo del producto (SOLO server-side)
          let costoUnitario = 0;
          let productAplicaComision = true;
          if (item.productId) {
            const product = await prisma.product.findUnique({
              where: { id: item.productId },
              select: { cost: true, aplicaComision: true }
            });
            if (product?.cost) {
              costoUnitario = Number(product.cost);
              costoTotalCalc += costoUnitario * cantidad;
            }
            productAplicaComision = product?.aplicaComision ?? true;
          }
          const aplicaComision = item.aplicaComision !== undefined ? item.aplicaComision : productAplicaComision;

          return {
            productId: item.productId || null,
            codigo: item.codigo || null,
            descripcion: item.descripcion,
            cantidad,
            cantidadEntregada: 0,
            cantidadPendiente: cantidad,
            unidad: item.unidad,
            precioUnitario: precio,
            descuento,
            subtotal: itemSubtotal,
            costoUnitario,
            notas: item.notas || null,
            orden: index,
            aplicaComision,
          };
        }));

        // Descuento global
        const descuentoGlobalPct = data.descuentoGlobal;
        const descuentoMonto = subtotal * (descuentoGlobalPct / 100);
        const subtotalConDescuento = subtotal - descuentoMonto;

        // IVA configurable
        const tasaIva = salesConfig?.tasaIvaDefault
          ? parseFloat(salesConfig.tasaIvaDefault.toString())
          : 21;
        const impuestos = subtotalConDescuento * (tasaIva / 100);
        const total = subtotalConDescuento + impuestos;

        // Calcular margen
        const margenBruto = subtotalConDescuento - costoTotalCalc;
        const margenPorcentaje = subtotalConDescuento > 0
          ? (margenBruto / subtotalConDescuento) * 100
          : 0;

        // Generar número
        const numero = await generateSaleNumber(companyId);

        // Crear orden de venta en transacción
        const nuevaOrden = await prisma.$transaction(async (tx) => {
          const orden = await tx.sale.create({
            data: {
              numero,
              clientId: data.clientId,
              sellerId: data.sellerId ?? user!.id,
              estado: 'BORRADOR',
              fechaEmision: data.fechaEmision ? new Date(data.fechaEmision) : new Date(),
              fechaEntregaEstimada: data.fechaEntregaEstimada ? new Date(data.fechaEntregaEstimada) : null,
              moneda: data.moneda,
              subtotal,
              descuentoGlobal: descuentoGlobalPct,
              descuentoMonto,
              tasaIva,
              impuestos,
              total,
              condicionesPago: data.condicionesPago || null,
              diasPlazo: data.diasPlazo ?? null,
              lugarEntrega: data.lugarEntrega || null,
              notas: data.notas || null,
              notasInternas: data.notasInternas || null,
              docType,
              costoTotal: costoTotalCalc,
              margenBruto,
              margenPorcentaje,
              companyId,
              createdBy: user!.id,
            }
          });

          // Crear items
          await tx.saleItem.createMany({
            data: itemsConCalculos.map((item) => ({
              saleId: orden.id,
              productId: item.productId,
              codigo: item.codigo,
              descripcion: item.descripcion,
              cantidad: item.cantidad,
              cantidadEntregada: item.cantidadEntregada,
              cantidadPendiente: item.cantidadPendiente,
              unidad: item.unidad,
              precioUnitario: item.precioUnitario,
              descuento: item.descuento,
              subtotal: item.subtotal,
              costoUnitario: item.costoUnitario,
              notas: item.notas,
              orden: item.orden,
              aplicaComision: item.aplicaComision,
            }))
          });

          return orden;
        });

        // Invalidar caché
        for (const key of ordenesCache.keys()) {
          if (key.startsWith(`ordenes-venta-${companyId}`)) {
            ordenesCache.delete(key);
          }
        }

        // Obtener orden completa (sin costos)
        const ordenCompleta = await prisma.sale.findUnique({
          where: { id: nuevaOrden.id },
          include: {
            client: {
              select: {
                id: true,
                legalName: true,
                name: true,
                email: true
              }
            },
            seller: {
              select: { id: true, name: true }
            },
            items: {
              select: {
                id: true,
                productId: true,
                codigo: true,
                descripcion: true,
                cantidad: true,
                cantidadEntregada: true,
                cantidadPendiente: true,
                unidad: true,
                precioUnitario: true,
                descuento: true,
                subtotal: true,
                notas: true,
                orden: true,
                product: {
                  select: { id: true, name: true, sku: true }
                }
              },
              orderBy: { orden: 'asc' }
            }
          }
        });

        // Registrar auditoría
        const client = await prisma.client.findUnique({
          where: { id: data.clientId },
          select: { legalName: true }
        });

        await logSalesCreation({
          entidad: 'sale',
          entidadId: nuevaOrden.id,
          companyId,
          userId: user!.id,
          estadoInicial: 'BORRADOR',
          amount: total,
          clientId: data.clientId,
          clientName: client?.legalName,
          documentNumber: numero,
        });

        return ordenCompleta;
      },
      {
        entityType: 'Sale',
        getEntityId: (result) => result?.id || 0,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      status: idempotencyResult.isReplay ? 200 : 201,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    console.error('Error creating orden de venta:', error);

    // Handle idempotency conflict error
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Error al crear la orden de venta', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
