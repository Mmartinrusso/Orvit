import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { logSalesCreation } from '@/lib/ventas/audit-helper';
import { generateQuoteNumber } from '@/lib/ventas/document-number';
import { requirePermission, checkPermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { createQuotationSchema } from '@/lib/ventas/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/ventas/idempotency-helper';

// Nota: Cotizaciones NO usan ViewMode (T1/T2) porque no son documentos fiscales.
// El docType solo se asigna cuando la cotización se CONVIERTE en venta.

export const dynamic = 'force-dynamic';

// Cache
const cotizacionesCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutos

// GET - Listar cotizaciones
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const estado = searchParams.get('estado') || searchParams.get('status');
    const clienteId = searchParams.get('clienteId');
    const vendedorId = searchParams.get('vendedorId');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const search = searchParams.get('search');

    // Construir where - Cotizaciones NO filtran por docType
    const where: Prisma.QuoteWhereInput = {
      companyId,
      ...(estado && { estado: estado as any }),
      ...(clienteId && { clientId: clienteId }),
      ...(vendedorId && { sellerId: parseInt(vendedorId) }),
      ...(fechaDesde && { fechaEmision: { gte: new Date(fechaDesde) } }),
      ...(fechaHasta && { fechaEmision: { lte: new Date(fechaHasta) } }),
      ...(search && {
        OR: [
          { numero: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { titulo: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { client: { legalName: { contains: search, mode: Prisma.QueryMode.insensitive } } },
          { client: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } },
        ]
      }),
    };

    // Verificar caché
    const cacheKey = `cotizaciones-${companyId}-${page}-${estado || 'all'}`;
    if (!search && !clienteId && !fechaDesde && !fechaHasta) {
      const cached = cotizacionesCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data, { headers: { 'X-Cache': 'HIT' } });
      }
    }

    const [cotizaciones, total] = await Promise.all([
      prisma.quote.findMany({
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
          _count: {
            select: {
              items: true,
              versions: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.quote.count({ where })
    ]);

    // Verificar permisos granulares de costos y márgenes
    const [canViewCosts, canViewMargins] = await Promise.all([
      checkPermission(user!.id, user!.companyId, VENTAS_PERMISSIONS.COSTS_VIEW),
      checkPermission(user!.id, user!.companyId, VENTAS_PERMISSIONS.MARGINS_VIEW),
    ]);

    // Filtrar campos sensibles según permisos
    const cotizacionesSanitized = cotizaciones.map(cot => ({
      ...cot,
      ...(!canViewCosts && { costoTotal: undefined }),
      ...(!canViewMargins && { margenBruto: undefined, margenPorcentaje: undefined }),
    }));

    const result = {
      data: cotizacionesSanitized,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };

    // Guardar en caché
    if (!search && !clienteId && !fechaDesde && !fechaHasta) {
      cotizacionesCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching cotizaciones:', error);
    return NextResponse.json(
      { error: 'Error al obtener las cotizaciones' },
      { status: 500 }
    );
  }
}

// POST - Crear cotización
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_CREATE);
    if (error) return error;

    const companyId = user!.companyId;

    // Get idempotency key (optional but recommended)
    const idempotencyKey = getIdempotencyKey(request);

    // Nota: Cotizaciones NO usan docType - se asigna al convertir a venta

    const body = await request.json();

    // Validate with Zod schema
    const validation = createQuotationSchema.safeParse(body);
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
      'CREATE_QUOTATION',
      async () => {
        // Obtener configuración de ventas
        const salesConfig = await prisma.salesConfig.findUnique({
          where: { companyId }
        });

        // Calcular totales
        let subtotal = 0;
        let costoTotalCalc = 0;
        const itemsConCalculos = await Promise.all(data.items.map(async (item: any, index: number) => {
          const cantidad = parseFloat(String(item.cantidad));
          const precio = parseFloat(String(item.precioUnitario));
          const descuento = parseFloat(String(item.descuento || '0'));
          const itemSubtotal = cantidad * precio * (1 - descuento / 100);
          subtotal += itemSubtotal;

          // Obtener costo del producto si existe (SOLO para cálculos server-side)
          let costoUnitario = 0;
          let margenItem = 0;
          if (item.productId) {
            const product = await prisma.product.findUnique({
              where: { id: item.productId },
              select: { cost: true, sku: true }
            });
            if (product?.cost) {
              costoUnitario = Number(product.cost);
              margenItem = precio > 0 ? ((precio - costoUnitario) / precio) * 100 : 0;
              costoTotalCalc += costoUnitario * cantidad;
            }
          }

          return {
            productId: item.productId || null,
            codigo: item.codigo || null,
            descripcion: item.descripcion,
            cantidad,
            unidad: item.unidad || 'UN',
            precioUnitario: precio,
            descuento,
            subtotal: itemSubtotal,
            costoUnitario,
            margenItem,
            notas: item.notas || null,
            orden: index,
          };
        }));

        // Descuento global
        const descuentoGlobalPct = data.descuentoGlobal || 0;
        const descuentoMonto = subtotal * (descuentoGlobalPct / 100);
        const subtotalConDescuento = subtotal - descuentoMonto;

        // IVA configurable desde SalesConfig
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

        // Validar margen mínimo si está configurado
        if (salesConfig?.margenMinimoPermitido) {
          const minMargin = parseFloat(salesConfig.margenMinimoPermitido.toString());
          if (margenPorcentaje < minMargin) {
            throw new Error(`MARGIN_TOO_LOW:${margenPorcentaje.toFixed(1)}:${minMargin}`);
          }
        }

        // Generar número
        const numero = await generateQuoteNumber(companyId);

        // Crear cotización con items en transacción
        const nuevaCotizacion = await prisma.$transaction(async (tx) => {
          const cotizacion = await tx.quote.create({
            data: {
              numero,
              clientId: data.clientId,
              sellerId: data.sellerId ? data.sellerId : user!.id,
              titulo: data.titulo || `Cotización ${numero}`,
              descripcion: data.descripcion || null,
              fechaEmision: data.fechaEmision ? new Date(data.fechaEmision) : new Date(),
              fechaValidez: data.fechaValidez
                ? new Date(data.fechaValidez)
                : new Date(Date.now() + (salesConfig?.diasValidezCotizacion || 30) * 24 * 60 * 60 * 1000),
              estado: 'BORRADOR',
              moneda: data.moneda || 'ARS',
              subtotal,
              descuentoGlobal: descuentoGlobalPct,
              descuentoMonto,
              tasaIva,
              impuestos,
              total,
              condicionesPago: data.condicionesPago || null,
              diasPlazo: data.diasPlazo ? data.diasPlazo : null,
              condicionesEntrega: data.condicionesEntrega || null,
              tiempoEntrega: data.tiempoEntrega || null,
              lugarEntrega: data.lugarEntrega || null,
              notas: data.notas || null,
              notasInternas: data.notasInternas || null,
              costoTotal: costoTotalCalc,
              margenBruto,
              margenPorcentaje,
              companyId,
              createdBy: user!.id,
            }
          });

          // Crear items
          await tx.quoteItem.createMany({
            data: itemsConCalculos.map((item) => ({
              quoteId: cotizacion.id,
              productId: item.productId,
              codigo: item.codigo,
              descripcion: item.descripcion,
              cantidad: item.cantidad,
              unidad: item.unidad,
              precioUnitario: item.precioUnitario,
              descuento: item.descuento,
              subtotal: item.subtotal,
              costoUnitario: item.costoUnitario,
              margenItem: item.margenItem,
              notas: item.notas,
              orden: item.orden,
            }))
          });

          // Crear versión inicial
          await tx.quoteVersion.create({
            data: {
              quoteId: cotizacion.id,
              version: 1,
              datos: {
                numero: cotizacion.numero,
                titulo: cotizacion.titulo,
                subtotal,
                impuestos,
                total,
                itemsCount: itemsConCalculos.length,
              },
              motivo: 'Creación inicial',
              createdBy: user!.id,
            }
          });

          return cotizacion;
        });

        // Invalidar caché
        for (const key of cotizacionesCache.keys()) {
          if (key.startsWith(`cotizaciones-${companyId}`)) {
            cotizacionesCache.delete(key);
          }
        }

        // Obtener cotización completa para retornar (sin costos)
        const cotizacionCompleta = await prisma.quote.findUnique({
          where: { id: nuevaCotizacion.id },
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
          entidad: 'quote',
          entidadId: nuevaCotizacion.id,
          companyId,
          userId: user!.id,
          estadoInicial: 'BORRADOR',
          amount: total,
          clientId: data.clientId,
          clientName: client?.legalName,
          documentNumber: numero,
        });

        return cotizacionCompleta;
      },
      {
        entityType: 'Quote',
        getEntityId: (result) => result?.id || 0,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      status: idempotencyResult.isReplay ? 200 : 201,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    console.error('Error creating cotización:', error);

    // Handle idempotency conflict error
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    // Handle custom errors
    if (error instanceof Error) {
      if (error.message.startsWith('MARGIN_TOO_LOW:')) {
        const parts = error.message.split(':');
        const margenActual = parseFloat(parts[1]);
        const margenMinimo = parseFloat(parts[2]);
        return NextResponse.json(
          {
            error: `El margen (${margenActual}%) está por debajo del mínimo permitido (${margenMinimo}%)`,
            requiereAprobacion: true,
            margenActual,
            margenMinimo
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Error al crear la cotización', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
