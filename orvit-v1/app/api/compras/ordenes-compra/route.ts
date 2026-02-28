import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { logCreation } from '@/lib/compras/audit-helper';
import { verificarProveedorBloqueado } from '@/lib/compras/payment-eligibility';
import { puedeCrearOCDesdePedido } from '@/lib/compras/pedidos-enforcement';
import { getViewMode, isExtendedMode } from '@/lib/view-mode/get-mode';
import { withComprasGuards } from '@/lib/modules';
import { ordenesCache, ORDENES_CACHE_TTL } from '@/lib/compras/cache';
import { hasUserPermission } from '@/lib/permissions-helpers';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Usar caché compartido
const CACHE_TTL = ORDENES_CACHE_TTL;

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

// Generar número de OC automático
async function generarNumeroOC(companyId: number): Promise<string> {
  const año = new Date().getFullYear();
  const prefix = `OC-${año}-`;

  const ultimaOC = await prisma.purchaseOrder.findFirst({
    where: {
      companyId,
      numero: { startsWith: prefix }
    },
    orderBy: { numero: 'desc' },
    select: { numero: true }
  });

  if (ultimaOC) {
    const ultimoNumero = parseInt(ultimaOC.numero.replace(prefix, '')) || 0;
    return `${prefix}${String(ultimoNumero + 1).padStart(5, '0')}`;
  }

  return `${prefix}00001`;
}

// GET - Listar órdenes de compra
// Protegido por módulos purchases_core + purchase_orders
export const GET = withComprasGuards(async (request: NextRequest) => {
  console.log('[ordenes-compra] Handler iniciado - pasó withComprasGuards');
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const estado = searchParams.get('estado');
    const proveedorId = searchParams.get('proveedorId');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const esEmergencia = searchParams.get('esEmergencia');
    const search = searchParams.get('search');
    const docTypeParam = searchParams.get('docType'); // T1, T2 o null (todo)
    const countAtrasadas = searchParams.get('countAtrasadas') === 'true';

    // Filtro por docType - el frontend controla qué pide
    // - docType=T1 → solo T1
    // - docType=T2 → solo T2 (requiere modo Extended)
    // - sin docType → según ViewMode (S=T1, E=todo)
    const viewMode = getViewMode(request);
    console.log('[ordenes-compra] ViewMode recibido:', viewMode, '| docTypeParam:', docTypeParam);
    let docTypeFilter: Prisma.PurchaseOrderWhereInput = {};

    if (docTypeParam === 'T1') {
      docTypeFilter = { docType: 'T1' };
    } else if (docTypeParam === 'T2') {
      // T2 solo disponible en modo Extended
      if (viewMode !== 'E') {
        return NextResponse.json({ error: 'T2 no disponible en modo Standard' }, { status: 403 });
      }
      docTypeFilter = { docType: 'T2' };
    } else {
      // Sin parámetro: Standard=T1, Extended=todo
      if (viewMode === 'S') {
        docTypeFilter = { docType: 'T1' };
      }
      // Extended sin filtro = todo
    }
    console.log('[ordenes-compra] Filtro docType aplicado:', JSON.stringify(docTypeFilter));

    const where: Prisma.PurchaseOrderWhereInput = {
      companyId,
      ...docTypeFilter,
      ...(estado && { estado: estado as any }),
      ...(proveedorId && { proveedorId: parseInt(proveedorId) }),
      ...(esEmergencia === 'true' && { esEmergencia: true }),
      ...(fechaDesde && {
        fechaEmision: { gte: new Date(fechaDesde) }
      }),
      ...(fechaHasta && {
        fechaEmision: { lte: new Date(fechaHasta) }
      }),
      ...(search && {
        OR: [
          { numero: { contains: search, mode: 'insensitive' } },
          { proveedor: { name: { contains: search, mode: 'insensitive' } } },
        ]
      }),
    };

    // Endpoint ligero: contar órdenes atrasadas sin cargar todos los datos
    if (countAtrasadas) {
      const count = await prisma.purchaseOrder.count({
        where: {
          companyId,
          ...docTypeFilter,
          estado: { notIn: ['COMPLETADA', 'CANCELADA'] },
          fechaEntregaEsperada: { lt: new Date() },
        },
      });
      return NextResponse.json({ atrasadas: count });
    }

    // Verificar caché solo si no hay filtros específicos
    const cacheKey = `ordenes-${companyId}-${page}-${estado || 'all'}-${viewMode}-${docTypeParam || 'all'}`;
    if (!search && !proveedorId && !fechaDesde && !fechaHasta) {
      const cached = ordenesCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data, { headers: { 'X-Cache': 'HIT' } });
      }
    }

    const [ordenes, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          proveedor: {
            select: { id: true, name: true, cuit: true }
          },
          createdByUser: {
            select: { id: true, name: true }
          },
          costCenter: {
            select: { id: true, codigo: true, nombre: true }
          },
          project: {
            select: { id: true, codigo: true, nombre: true }
          },
          items: {
            select: {
              id: true,
              descripcion: true,
              cantidad: true,
              unidad: true,
              precioUnitario: true,
              subtotal: true,
              supplierItem: {
                select: { id: true, nombre: true }
              }
            },
            take: 3  // Solo primeros 3 items para preview
          },
          _count: {
            select: {
              items: true,
              goodsReceipts: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where })
    ]);

    const result = {
      data: ordenes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };

    // Guardar en caché
    if (!search && !proveedorId && !fechaDesde && !fechaHasta) {
      ordenesCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('='.repeat(60));
    console.error('[ordenes-compra] ERROR DETALLADO:');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('Message:', error instanceof Error ? error.message : String(error));
    console.error('='.repeat(60));
    return NextResponse.json(
      { error: 'Error al obtener las órdenes de compra', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}, ['purchase_orders']);

// POST - Crear orden de compra
// Protegido por módulos purchases_core + purchase_orders
export const POST = withComprasGuards(async (request: NextRequest) => {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    // Permission check: ingresar_compras
    const hasPerm = await hasUserPermission(user.id, companyId, 'ingresar_compras');
    if (!hasPerm) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    // Get ViewMode from middleware header
    const viewMode = getViewMode(request);

    const body = await request.json();
    const {
      proveedorId,
      fechaEmision,
      fechaEntregaEsperada,
      condicionesPago,
      moneda,
      notas,
      notasInternas,
      costCenterId,
      projectId,
      esEmergencia,
      motivoEmergencia,
      items, // Array de items
      docType, // T1 o T2
      purchaseRequestId, // Pedido de compra de origen (opcional)
      purchaseQuotationId, // Cotización seleccionada (opcional)
    } = body;

    // Validar docType - T2 solo se puede crear en modo Extended
    const requestedDocType = docType === 'T2' ? 'T2' : 'T1';
    if (requestedDocType === 'T2' && !isExtendedMode(viewMode)) {
      return NextResponse.json(
        { error: 'No autorizado para crear este tipo de documento' },
        { status: 403 }
      );
    }

    // Validaciones
    if (!proveedorId) {
      return NextResponse.json({ error: 'El proveedor es requerido' }, { status: 400 });
    }

    // ENFORCEMENT: Verificar proveedor bloqueado (T1 solamente)
    if (requestedDocType === 'T1') {
      const proveedorCheck = await verificarProveedorBloqueado(Number(proveedorId), prisma);
      if (!proveedorCheck.eligible) {
        console.log('[ORDENES-COMPRA] ❌ Proveedor bloqueado:', proveedorCheck);
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

    // ENFORCEMENT: Verificar que el pedido esté aprobado (si se proporciona)
    if (purchaseRequestId) {
      const pedido = await prisma.purchaseRequest.findUnique({
        where: { id: parseInt(purchaseRequestId) },
        select: { id: true, estado: true, numero: true },
      });

      if (!pedido) {
        return NextResponse.json(
          { error: 'Pedido de compra no encontrado', code: 'PEDIDO_NO_ENCONTRADO' },
          { status: 404 }
        );
      }

      const verificacion = puedeCrearOCDesdePedido(pedido.estado);
      if (!verificacion.permitido) {
        console.log('[ORDENES-COMPRA] ❌ Pedido no aprobado:', verificacion);
        return NextResponse.json(
          {
            error: verificacion.mensaje,
            code: 'PEDIDO_NO_APROBADO',
            estadoPedido: pedido.estado,
          },
          { status: 403 }
        );
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Debe agregar al menos un item' }, { status: 400 });
    }

    // Validar items
    for (const item of items) {
      if (!item.supplierItemId || !item.cantidad || !item.precioUnitario) {
        return NextResponse.json(
          { error: 'Cada item debe tener supplierItemId, cantidad y precioUnitario' },
          { status: 400 }
        );
      }
    }

    // Calcular totales
    let subtotal = 0;
    const itemsConSubtotal = items.map((item: any) => {
      const cantidad = parseFloat(item.cantidad);
      const precio = parseFloat(item.precioUnitario);
      const descuento = parseFloat(item.descuento || '0');
      const itemSubtotal = cantidad * precio * (1 - descuento / 100);
      subtotal += itemSubtotal;

      return {
        ...item,
        cantidad,
        precioUnitario: precio,
        descuento,
        subtotal: itemSubtotal,
        cantidadPendiente: cantidad, // Inicialmente todo está pendiente
      };
    });

    // IVA configurable (default 21%)
    const tasaIvaValue = parseFloat(body.tasaIva || '21');
    const impuestos = subtotal * (tasaIvaValue / 100);
    const total = subtotal + impuestos;

    // Generar número
    const numero = await generarNumeroOC(companyId);

    // Verificar si requiere aprobación
    const config = await prisma.purchaseConfig.findUnique({
      where: { companyId }
    });

    const requiereAprobacion = config?.requiereAprobacionMontoMinimo
      ? total >= parseFloat(config.requiereAprobacionMontoMinimo.toString())
      : false;

    // Crear OC con items en transacción
    const nuevaOrden = await prisma.$transaction(async (tx) => {
      const orden = await tx.purchaseOrder.create({
        data: {
          numero,
          proveedorId: parseInt(proveedorId),
          estado: requiereAprobacion ? 'PENDIENTE_APROBACION' : 'BORRADOR',
          fechaEmision: fechaEmision ? new Date(fechaEmision) : new Date(),
          fechaEntregaEsperada: fechaEntregaEsperada ? new Date(fechaEntregaEsperada) : null,
          condicionesPago: condicionesPago || null,
          moneda: moneda || 'ARS',
          subtotal,
          tasaIva: tasaIvaValue,
          impuestos,
          total,
          notas: notas || null,
          notasInternas: notasInternas || null,
          costCenterId: costCenterId ? parseInt(costCenterId) : null,
          projectId: projectId ? parseInt(projectId) : null,
          esEmergencia: esEmergencia || false,
          motivoEmergencia: esEmergencia ? motivoEmergencia : null,
          requiereAprobacion,
          docType: requestedDocType,  // T1 o T2 según el modo
          companyId,
          createdBy: user.id,
          // Vinculación con pedido y cotización (opcional)
          purchaseRequestId: purchaseRequestId ? parseInt(purchaseRequestId) : null,
          purchaseQuotationId: purchaseQuotationId ? parseInt(purchaseQuotationId) : null,
        }
      });

      // Crear items (incluir códigos para trazabilidad)
      await tx.purchaseOrderItem.createMany({
        data: itemsConSubtotal.map((item: any) => ({
          purchaseOrderId: orden.id,
          supplierItemId: parseInt(item.supplierItemId),
          // Códigos del item para trazabilidad
          codigoPropio: item.codigoPropio || null,
          codigoProveedor: item.codigoProveedor || null,
          descripcion: item.descripcion || '',
          cantidad: item.cantidad,
          cantidadRecibida: 0,
          cantidadPendiente: item.cantidadPendiente,
          unidad: item.unidad || 'UN',
          precioUnitario: item.precioUnitario,
          descuento: item.descuento,
          subtotal: item.subtotal,
          fechaEntregaEsperada: item.fechaEntregaEsperada ? new Date(item.fechaEntregaEsperada) : null,
          notas: item.notas || null,
        }))
      });

      return orden;
    });

    // Invalidar caché
    for (const key of ordenesCache.keys()) {
      if (key.startsWith(`ordenes-${companyId}`)) {
        ordenesCache.delete(key);
      }
    }

    // Obtener orden completa para retornar
    const ordenCompleta = await prisma.purchaseOrder.findUnique({
      where: { id: nuevaOrden.id },
      include: {
        proveedor: { select: { id: true, name: true } },
        items: {
          include: {
            supplierItem: { select: { id: true, nombre: true, unidad: true } }
          }
        }
      }
    });

    // Registrar auditoría
    await logCreation({
      entidad: 'purchase_order',
      entidadId: nuevaOrden.id,
      companyId,
      userId: user.id,
      estadoInicial: nuevaOrden.estado,
      amount: nuevaOrden.montoTotal ? Number(nuevaOrden.montoTotal) : undefined,
    });

    return NextResponse.json(ordenCompleta, { status: 201 });
  } catch (error) {
    console.error('Error creating orden de compra:', error);
    return NextResponse.json(
      { error: 'Error al crear la orden de compra' },
      { status: 500 }
    );
  }
}, ['purchase_orders']);
