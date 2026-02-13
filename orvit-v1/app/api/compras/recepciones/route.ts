import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { logCreation } from '@/lib/compras/audit-helper';
import { verificarProveedorBloqueado } from '@/lib/compras/payment-eligibility';
import { getViewMode, isExtendedMode } from '@/lib/view-mode/get-mode';
import { applyViewMode } from '@/lib/view-mode/prisma-helper';
import { getT2Client, isT2DatabaseConfigured } from '@/lib/prisma-t2';
import { validarCompraRapida, determinarEstadoRegularizacion } from '@/lib/compras/quick-purchase-helper';
import {
  recepcionesCache,
  RECEPCIONES_CACHE_TTL,
  invalidarCacheOrdenes,
  invalidarCacheRecepciones
} from '@/lib/compras/cache';
import { validateRequest } from '@/lib/validations/helpers';
import { CreateRecepcionSchema } from '@/lib/validations/recepciones';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Usar caché compartido
const CACHE_TTL = RECEPCIONES_CACHE_TTL;

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        name: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    return user;
  } catch (error) {
    return null;
  }
}

// Generar número de recepción automático con offset para evitar duplicados en retries
async function generarNumeroRecepcion(companyId: number, tx?: any, offset: number = 0): Promise<string> {
  const año = new Date().getFullYear();
  const prefix = `REC-${año}-`;
  const db = tx || prisma;

  // Buscar todas las recepciones del año para encontrar el máximo número estándar
  // (excluir formatos especiales como REC-2026-QP-xxx)
  const recepciones = await db.goodsReceipt.findMany({
    where: {
      companyId,
      numero: { startsWith: prefix }
    },
    select: { numero: true }
  });

  // Filtrar solo los números con formato estándar (REC-YYYY-NNNNN) y encontrar el máximo
  let maxNumero = 0;
  const regex = new RegExp(`^${prefix}(\\d{5})$`);

  for (const rec of recepciones) {
    const match = rec.numero.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumero) {
        maxNumero = num;
      }
    }
  }

  // Agregar offset en caso de retry para evitar colisiones
  return `${prefix}${String(maxNumero + 1 + offset).padStart(5, '0')}`;
}

// GET - Listar recepciones
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const estado = searchParams.get('estado');
    const proveedorId = searchParams.get('proveedorId');
    const warehouseId = searchParams.get('warehouseId');
    const purchaseOrderId = searchParams.get('purchaseOrderId');
    const facturaId = searchParams.get('facturaId');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const pendientesRegularizacion = searchParams.get('pendientesRegularizacion');
    const search = searchParams.get('search');

    // Get ViewMode from middleware header
    const viewMode = getViewMode(request);

    // Construir where con ViewMode filter
    const where: Prisma.GoodsReceiptWhereInput = applyViewMode({
      companyId,
      ...(estado && { estado: estado as any }),
      ...(proveedorId && { proveedorId: parseInt(proveedorId) }),
      ...(warehouseId && { warehouseId: parseInt(warehouseId) }),
      ...(purchaseOrderId && { purchaseOrderId: parseInt(purchaseOrderId) }),
      ...(facturaId && { facturaId: parseInt(facturaId) }),
      ...(pendientesRegularizacion === 'true' && {
        requiereRegularizacion: true,
        regularizada: false
      }),
      ...(fechaDesde && {
        fechaRecepcion: { gte: new Date(fechaDesde) }
      }),
      ...(fechaHasta && {
        fechaRecepcion: { lte: new Date(fechaHasta) }
      }),
      ...(search && {
        OR: [
          { numero: { contains: search, mode: 'insensitive' } },
          { numeroRemito: { contains: search, mode: 'insensitive' } },
          { proveedor: { name: { contains: search, mode: 'insensitive' } } },
        ]
      }),
    }, viewMode);

    // Verificar caché (incluir viewMode)
    const cacheKey = `recepciones-${companyId}-${page}-${estado || 'all'}-${viewMode}`;
    if (!search && !proveedorId && !fechaDesde && !fechaHasta) {
      const cached = recepcionesCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data, { headers: { 'X-Cache': 'HIT' } });
      }
    }

    const [recepciones, total] = await Promise.all([
      prisma.goodsReceipt.findMany({
        where,
        select: {
          id: true,
          numero: true,
          fechaRecepcion: true,
          numeroRemito: true,
          estado: true,
          adjuntos: true,
          firma: true,
          observacionesRecepcion: true,
          docType: true,
          proveedor: {
            select: { id: true, name: true, cuit: true }
          },
          purchaseOrder: {
            select: { id: true, numero: true, estado: true }
          },
          // Incluir factura relacionada si existe
          factura: {
            select: {
              id: true,
              numeroSerie: true,
              numeroFactura: true,
            }
          },
          warehouse: {
            select: { id: true, codigo: true, nombre: true }
          },
          createdByUser: {
            select: { id: true, name: true }
          },
          _count: {
            select: {
              items: true,
              stockMovements: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.goodsReceipt.count({ where })
    ]);

    const result = {
      data: recepciones,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };

    // Guardar en caché
    if (!search && !proveedorId && !fechaDesde && !fechaHasta) {
      recepcionesCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching recepciones:', error);
    return NextResponse.json(
      { error: 'Error al obtener las recepciones' },
      { status: 500 }
    );
  }
}

// POST - Crear recepción
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    // Get ViewMode from middleware header
    const viewMode = getViewMode(request);

    const body = await request.json();

    const validation = validateRequest(CreateRecepcionSchema, body);
    if (!validation.success) {
      return validation.response;
    }

    const {
      proveedorId,
      purchaseOrderId,
      warehouseId,
      fechaRecepcion,
      numeroRemito,
      esEmergencia,
      notas,
      items,
      adjuntos,
      firma,
      observacionesRecepcion,
      docType,
      facturaId,
      isQuickPurchase,
      quickPurchaseReason,
      quickPurchaseJustification,
    } = validation.data;

    // Validar docType - T2 solo se puede crear en modo Extended
    const requestedDocType = docType === 'T2' ? 'T2' : 'T1';
    if (requestedDocType === 'T2' && !isExtendedMode(viewMode)) {
      return NextResponse.json(
        { error: 'No autorizado para crear este tipo de documento' },
        { status: 403 }
      );
    }

    // ENFORCEMENT: Verificar proveedor bloqueado (T1 solamente)
    if (requestedDocType === 'T1') {
      const proveedorCheck = await verificarProveedorBloqueado(proveedorId, prisma);
      if (!proveedorCheck.eligible) {
        console.log('[RECEPCIONES] ❌ Proveedor bloqueado:', proveedorCheck);
        return NextResponse.json(
          {
            error: proveedorCheck.reason,
            code: proveedorCheck.code,
            details: proveedorCheck.details,
          },
          { status: 403 }
        );
      }
    }

    // Verificar que el depósito existe y está activo (warehouseId ya es number por z.coerce)
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId, isActive: true }
    });

    if (!warehouse) {
      return NextResponse.json({ error: 'Depósito no encontrado o inactivo' }, { status: 400 });
    }

    // Si viene de una OC, verificar que existe y está en estado correcto
    let ordenCompra = null;
    if (purchaseOrderId) {
      // Si viene desde una factura, la OC puede estar COMPLETADA (solo para enriquecimiento)
      const estadosPermitidos = facturaId
        ? ['APROBADA', 'ENVIADA_PROVEEDOR', 'CONFIRMADA', 'PARCIALMENTE_RECIBIDA', 'COMPLETADA']
        : ['APROBADA', 'ENVIADA_PROVEEDOR', 'CONFIRMADA', 'PARCIALMENTE_RECIBIDA'];

      ordenCompra = await prisma.purchaseOrder.findFirst({
        where: {
          id: purchaseOrderId,
          companyId,
          estado: { in: estadosPermitidos }
        },
        include: {
          items: true
        }
      });

      if (!ordenCompra) {
        // Si viene de factura, no bloquear - solo log warning
        if (facturaId) {
          console.warn(`[Recepciones] OC ${purchaseOrderId} no encontrada o en estado inválido para enriquecimiento, continuando sin OC`);
        } else {
          return NextResponse.json(
            { error: 'Orden de compra no encontrada o no está en estado válido para recepción' },
            { status: 400 }
          );
        }
      }

      // Verificar que el proveedor coincide (solo si se encontró la OC)
      if (ordenCompra && ordenCompra.proveedorId !== proveedorId) {
        return NextResponse.json(
          { error: 'El proveedor no coincide con la orden de compra' },
          { status: 400 }
        );
      }
    }

    // Determinar si es compra rápida (sin OC y sin factura)
    const esCompraRapida = isQuickPurchase === true || (!purchaseOrderId && !facturaId && esEmergencia);

    // Validar compra rápida según política de la empresa
    if (esCompraRapida) {
      const validacion = await validarCompraRapida(
        {
          proveedorId, // Ya es number por z.coerce
          items: items.map((item) => ({
            supplierItemId: item.supplierItemId, // Ya es number por z.coerce
            cantidadRecibida: item.cantidadRecibida, // Ya es number por z.coerce
            precioUnitario: item.precioUnitario ?? 0 // Ya es number por z.coerce
          })),
          quickPurchaseReason,
          quickPurchaseJustification,
          esEmergencia
        },
        user.id,
        companyId
      );

      if (!validacion.permitido) {
        return NextResponse.json(
          {
            error: 'No se puede crear la compra rápida',
            errores: validacion.errores,
            advertencias: validacion.advertencias
          },
          { status: 400 }
        );
      }

      // Si hay advertencias, incluirlas en la respuesta (pero no bloquear)
      if (validacion.advertencias.length > 0) {
        console.warn('Compra rápida con advertencias:', validacion.advertencias);
      }
    }

    // Obtener config para calcular fecha límite
    const config = await prisma.purchaseConfig.findUnique({
      where: { companyId }
    });

    // Calcular monto total para determinar estado de regularización (ya son numbers por z.coerce)
    let montoTotal = 0;
    for (const item of items) {
      montoTotal += item.cantidadRecibida * (item.precioUnitario ?? 0);
    }

    // Calcular estado de regularización y fecha límite
    let fechaLimiteRegularizacion = null;
    let regularizationStatus = null;
    if (esCompraRapida) {
      const regResult = determinarEstadoRegularizacion(montoTotal, {
        quickPurchaseMaxAmount: config?.quickPurchaseMaxAmount ? Number(config.quickPurchaseMaxAmount) : null,
        diasLimiteRegularizacion: config?.diasLimiteRegularizacion || 15
      });
      regularizationStatus = regResult.regularizationStatus;
      fechaLimiteRegularizacion = regResult.fechaLimite;
    } else if (esEmergencia) {
      fechaLimiteRegularizacion = new Date();
      fechaLimiteRegularizacion.setDate(fechaLimiteRegularizacion.getDate() + (config?.diasLimiteRegularizacion || 7));
    }

    // Crear recepción con items en transacción con retry para manejar race conditions
    const MAX_RETRIES = 5;
    let nuevaRecepcion = null;
    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Delay aleatorio para dispersar requests concurrentes (evita race conditions)
        // Primera vez: 0-50ms, luego exponencial: 50-150ms, 100-300ms, etc.
        const baseDelay = attempt === 0 ? 0 : 50 * Math.pow(2, attempt - 1);
        const jitter = Math.random() * (50 + attempt * 50);
        await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));

        nuevaRecepcion = await prisma.$transaction(async (tx) => {
          // Generar número dentro de la transacción (con offset para evitar colisiones en retries)
          const numero = await generarNumeroRecepcion(companyId, tx, attempt);

          const recepcion = await tx.goodsReceipt.create({
            data: {
              numero,
              proveedorId, // Ya es number por z.coerce
              purchaseOrderId: purchaseOrderId ?? null,
              warehouseId, // Ya es number por z.coerce
              estado: 'BORRADOR',
              fechaRecepcion: fechaRecepcion ? new Date(fechaRecepcion) : new Date(),
              numeroRemito: numeroRemito || null,
              esEmergencia: esEmergencia || false,
              requiereRegularizacion: esCompraRapida || esEmergencia || false,
              fechaLimiteRegularizacion,
              notas: (requestedDocType === 'T2' && facturaId)
                ? `[T2-Factura:${facturaId}] ${notas || ''}`
                : (notas || null),
              // Evidencia de recepción
              adjuntos: adjuntos || [],
              firma: firma || null,
              observacionesRecepcion: observacionesRecepcion || null,
              docType: requestedDocType,  // T1 o T2 según el modo
              // Vinculacion con factura (solo T1 tiene FK real, T2 no tiene en BD principal)
              facturaId: (facturaId && requestedDocType !== 'T2') ? facturaId : null,
              tieneFactura: !!facturaId,
              // Compra rapida
              isQuickPurchase: esCompraRapida,
              quickPurchaseReason: esCompraRapida ? (quickPurchaseReason || 'OTRO') : null,
              quickPurchaseJustification: esCompraRapida ? quickPurchaseJustification : null,
              regularizationStatus: regularizationStatus as any,
              companyId,
              createdBy: user.id,
            }
          });

          // Crear items - enriquecer con datos de la OC y/o del insumo (supply.code)
          const ocItemsBySupplierId = new Map<number, any>();
          if (ordenCompra?.items) {
            for (const ocItem of ordenCompra.items) {
              ocItemsBySupplierId.set(ocItem.supplierItemId, ocItem);
            }
          }

          // Obtener código interno (supply.code) para cada supplierItem como fallback
          const supplierItemIds = items.map((item) => item.supplierItemId);
          const supplierItemsWithSupply = supplierItemIds.length > 0
            ? await tx.supplierItem.findMany({
                where: { id: { in: supplierItemIds } },
                select: { id: true, codigoProveedor: true, supply: { select: { code: true } } }
              })
            : [];
          const supplyCodeMap = new Map<number, { code: string | null; codigoProveedor: string | null }>();
          for (const si of supplierItemsWithSupply) {
            supplyCodeMap.set(si.id, { code: si.supply?.code || null, codigoProveedor: si.codigoProveedor });
          }

          await tx.goodsReceiptItem.createMany({
            data: items.map((item) => {
              // Todos los campos numéricos ya son numbers por z.coerce en el schema
              const ocItem = ocItemsBySupplierId.get(item.supplierItemId);
              const supplyData = supplyCodeMap.get(item.supplierItemId);

              return {
                goodsReceiptId: recepcion.id,
                purchaseOrderItemId: item.purchaseOrderItemId ?? (ocItem?.id || null),
                supplierItemId: item.supplierItemId,
                codigoPropio: item.codigoPropio || ocItem?.codigoPropio || supplyData?.code || null,
                codigoProveedor: item.codigoProveedor || ocItem?.codigoProveedor || supplyData?.codigoProveedor || null,
                descripcion: item.descripcion || '',
                cantidadEsperada: item.cantidadEsperada ?? null,
                cantidadRecibida: item.cantidadRecibida,
                cantidadAceptada: item.cantidadAceptada ?? item.cantidadRecibida,
                cantidadRechazada: item.cantidadRechazada ?? 0,
                unidad: item.unidad || 'UN',
                motivoRechazo: item.motivoRechazo || null,
                lote: item.lote || null,
                fechaVencimiento: item.fechaVencimiento ? new Date(item.fechaVencimiento) : null,
                notas: item.notas || null,
              };
            })
          });

          return recepcion;
        });

        // Si llegamos aquí, la transacción fue exitosa
        break;
      } catch (error) {
        lastError = error;

        // P2002 es el código de Prisma para unique constraint violation
        if ((error as any).code === 'P2002' && attempt < MAX_RETRIES - 1) {
          // Esperar un pequeño delay aleatorio antes de reintentar
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
          continue;
        }

        // Si no es un error de constraint o ya agotamos los reintentos, lanzar
        throw error;
      }
    }

    if (!nuevaRecepcion) {
      throw lastError || new Error('No se pudo crear la recepción después de múltiples intentos');
    }

    // Si es una recepción vinculada a una factura T2, marcar ingresoConfirmado en T2
    if (facturaId && requestedDocType === 'T2' && isT2DatabaseConfigured()) {
      try {
        const prismaT2 = getT2Client();
        await prismaT2.t2PurchaseReceipt.update({
          where: { id: facturaId },
          data: {
            ingresoConfirmado: true,
            ingresoConfirmadoPor: user.id,
            ingresoConfirmadoAt: new Date(),
          },
        });
        console.log(`[Recepciones] T2 receipt ${facturaId} marked as ingresoConfirmado`);
      } catch (t2Error) {
        console.error('[Recepciones] Error updating T2 receipt:', t2Error);
        // No fallar la creación del GoodsReceipt por esto
      }
    }

    // Invalidar cachés (recepciones + órdenes de compra)
    invalidarCacheRecepciones(companyId);
    invalidarCacheOrdenes(companyId); // También invalidar OC porque se actualizó _count.goodsReceipts

    // Obtener recepción completa
    const recepcionCompleta = await prisma.goodsReceipt.findUnique({
      where: { id: nuevaRecepcion.id },
      include: {
        proveedor: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, numero: true } },
        warehouse: { select: { id: true, codigo: true, nombre: true } },
        items: {
          include: {
            supplierItem: { select: { id: true, nombre: true, unidad: true } }
          }
        }
      }
    });

    // Registrar auditoría
    await logCreation({
      entidad: 'goods_receipt',
      entidadId: nuevaRecepcion.id,
      companyId,
      userId: user.id,
      estadoInicial: 'BORRADOR',
      relatedIds: purchaseOrderId
        ? [{ entity: 'purchase_order', id: purchaseOrderId }]
        : undefined,
    });

    return NextResponse.json(recepcionCompleta, { status: 201 });
  } catch (error) {
    console.error('Error creating recepcion:', error);
    return NextResponse.json(
      { error: 'Error al crear la recepción' },
      { status: 500 }
    );
  }
}
