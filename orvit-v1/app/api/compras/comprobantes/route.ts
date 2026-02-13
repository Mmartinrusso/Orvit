import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { getT2Client, isT2DatabaseConfigured } from '@/lib/prisma-t2';
import { logCreation } from '@/lib/compras/audit-helper';
import { verificarProveedorBloqueado } from '@/lib/compras/payment-eligibility';
import { getViewMode, isExtendedMode } from '@/lib/view-mode/get-mode';
import { MODE } from '@/lib/view-mode/types';
import { applyViewMode } from '@/lib/view-mode/prisma-helper';
import { shouldQueryT2, enrichT2Receipts } from '@/lib/view-mode';
import { inicializarProntoPago } from '@/lib/compras/pronto-pago-helper';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

import * as cache from './cache';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

// Caché para getUserFromToken (30 segundos TTL)
const userTokenCache = new Map<string, { data: any; timestamp: number }>();
const USER_TOKEN_CACHE_TTL = 30 * 1000; // 30 segundos

// Helper para obtener usuario desde JWT (ULTRA optimizado con caché)
async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return null;
    }

    // Verificar caché
    const cacheKey = `user-${token.substring(0, 20)}`;
    const cached = userTokenCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < USER_TOKEN_CACHE_TTL) {
      return cached.data;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    // Optimización: Solo obtener companyId sin incluir toda la relación
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        companies: {
          select: {
            companyId: true
          },
          take: 1
        }
      }
    });

    // Guardar en caché
    if (user) {
      userTokenCache.set(cacheKey, {
        data: user,
        timestamp: Date.now()
      });
      
      // Limpiar caché antiguo
      if (userTokenCache.size > 100) {
        const now = Date.now();
        for (const [key, value] of userTokenCache.entries()) {
          if (now - value.timestamp > USER_TOKEN_CACHE_TTL) {
            userTokenCache.delete(key);
          }
        }
      }
    }

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// GET /api/compras/comprobantes - Obtener todos los comprobantes
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
    const tipo = searchParams.get('tipo');
    const estado = searchParams.get('estado');
    const proveedorId = searchParams.get('proveedorId');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const pagoUrgente = searchParams.get('pagoUrgente');
    const itemSearch = searchParams.get('itemSearch'); // Búsqueda por item

    // Get ViewMode from middleware header
    const viewMode = getViewMode(request);

    // === DEBUG: Mostrar ViewMode y conteo por docType ===
    console.log('\n========================================');
    console.log('[Comprobantes] 🔍 ViewMode:', viewMode, viewMode === 'S' ? '(BLANCO)' : '(NEGRO+BLANCO)');
    try {
      const [t1, t2, nulls] = await Promise.all([
        prisma.purchaseReceipt.count({ where: { companyId, docType: 'T1' } }),
        prisma.purchaseReceipt.count({ where: { companyId, docType: 'T2' } }),
        prisma.purchaseReceipt.count({ where: { companyId, docType: null } })
      ]);
      console.log('[DEBUG] 📊 Comprobantes en BD:');
      console.log(`        T1 (blanco): ${t1}`);
      console.log(`        T2 (negro):  ${t2}`);
      console.log(`        null (legacy): ${nulls}`);
      console.log(`        Con ViewMode=${viewMode}, mostraremos: ${viewMode === 'S' ? t1 + nulls : t1 + t2 + nulls}`);
    } catch (e) { /* ignore */ }
    console.log('========================================\n');

    // Generar clave de caché (incluir pagoUrgente, viewMode e itemSearch)
    const cacheKey = `${companyId}-${proveedorId || 'all'}-${estado || 'all'}-${tipo || 'all'}-${pagoUrgente || 'false'}-${viewMode}-${itemSearch || 'none'}`;
    const cached = cache.getCache(cacheKey);

    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, max-age=600',
          'X-Cache': 'HIT'
        }
      });
    }

    // Build base where clause first, then apply ViewMode at the end
    const baseWhere: any = {
      companyId: companyId,
    };

    if (tipo && tipo !== 'all') {
      baseWhere.tipo = tipo;
    }

    if (estado && estado !== 'all') {
      baseWhere.estado = estado;
    }

    if (proveedorId) {
      baseWhere.proveedorId = parseInt(proveedorId);
    }

    if (pagoUrgente === 'true') {
      baseWhere.pagoUrgente = true;
      // Si no hay filtro de estado, por defecto para urgentes
      if (!baseWhere.estado) {
        baseWhere.estado = 'pendiente';
      }
    }

    if (fechaDesde || fechaHasta) {
      baseWhere.fechaEmision = {};
      if (fechaDesde) {
        baseWhere.fechaEmision.gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        baseWhere.fechaEmision.lte = new Date(fechaHasta);
      }
    }

    // Búsqueda por item (nombre o código)
    if (itemSearch && itemSearch.trim()) {
      const searchTerm = itemSearch.trim();
      baseWhere.items = {
        some: {
          OR: [
            // Buscar en descripción del item de la factura
            { descripcion: { contains: searchTerm, mode: 'insensitive' } },
            // Buscar en el SupplierItem vinculado
            {
              supplierItem: {
                OR: [
                  { nombre: { contains: searchTerm, mode: 'insensitive' } },
                  { codigoProveedor: { contains: searchTerm, mode: 'insensitive' } },
                ]
              }
            }
          ]
        }
      };
    }

    // =================================================================
    // BD T2 SEPARADA: Excluir T2 de BD principal, consultar BD T2 aparte
    // =================================================================
    // En BD principal: solo T1 + null (legacy), NUNCA T2
    const where = {
      ...baseWhere,
      docType: { not: 'T2' }
    };

    // Optimización: Solo incluir datos necesarios para la lista
    // Si solo se necesita para mostrar facturas, no incluir items
    // Usar índice compuesto si existe: (companyId, proveedorId)
    // Optimización adicional: Si es pagoUrgente, reducir aún más los campos
    const isUrgentOnly = pagoUrgente === 'true' && estado === 'pendiente';

    // ULTRA OPTIMIZACIÓN: Mantener proveedor pero con select mínimo
    const limit = isUrgentOnly ? 30 : (proveedorId ? 40 : 50); // Límite extremadamente reducido

    const comprobantes = await prisma.purchaseReceipt.findMany({
      where,
      select: {
        id: true,
        numeroSerie: true,
        numeroFactura: true,
        tipo: true,
        fechaEmision: true,
        fechaVencimiento: true,
        estado: true,
        total: true,
        proveedorId: true,
        pagoUrgente: true,
        // ViewMode docType
        docType: true,
        // Control de ingreso de stock
        ingresoConfirmado: true,
        ingresoConfirmadoAt: true,
        firmaIngreso: true,
        remitoUrl: true,
        fotoIngresoUrl: true,
        // Recepciones vinculadas directamente (facturaId = this.id)
        goodsReceipts: {
          select: {
            id: true,
            numero: true,
            estado: true,
          },
          take: 5
        },
        // Items de la factura (para GoodsReceipt check + modal Cargar Remito)
        items: {
          select: {
            id: true,
            itemId: true,
            descripcion: true,
            cantidad: true,
            unidad: true,
            precioUnitario: true,
            subtotal: true,
            proveedorId: true,
            supplierItem: {
              select: {
                id: true,
                codigoProveedor: true,
              },
            },
          },
          take: 50
        },
        proveedor: {
          select: {
            id: true,
            name: true,
            razon_social: true,
            cuit: true,
          }
        },
        // NO incluir tipoCuenta - no se usa en listado
      },
      orderBy: [
        { fechaEmision: 'desc' }
      ],
      take: limit,
    });

    // Buscar facturas sin vínculo directo a GoodsReceipt para verificar por items
    const facturasNeedCheck = comprobantes.filter(
      c => !c.ingresoConfirmado && (!c.goodsReceipts || !c.goodsReceipts.some((gr: any) => gr.estado === 'CONFIRMADA'))
    );

    // Para cada factura sin vínculo directo, buscar si hay GoodsReceipts confirmadas
    // del mismo proveedor con items coincidentes (mismos supplierItemIds)
    const facturasConRecepcion = new Set<number>(); // Set de facturaIds con recepción

    if (facturasNeedCheck.length > 0) {
      // Crear mapa de factura -> itemIds
      const facturaItemMap = new Map<number, { proveedorId: number; itemIds: number[] }>();
      const allProveedorIds = new Set<number>();
      const allItemIds = new Set<number>();

      for (const f of facturasNeedCheck) {
        const itemIds = (f.items || []).map(i => i.itemId).filter((id): id is number => id !== null);
        if (itemIds.length > 0) {
          facturaItemMap.set(f.id, { proveedorId: f.proveedorId, itemIds });
          allProveedorIds.add(f.proveedorId);
          itemIds.forEach(id => allItemIds.add(id));
        }
      }

      // Buscar GoodsReceipts confirmadas para estos proveedores que tengan items coincidentes
      if (facturaItemMap.size > 0) {
        const recepcionesConfirmadas = await prisma.goodsReceipt.findMany({
          where: {
            companyId,
            proveedorId: { in: Array.from(allProveedorIds) },
            estado: 'CONFIRMADA',
            items: {
              some: {
                supplierItemId: { in: Array.from(allItemIds) }
              }
            }
          },
          select: {
            proveedorId: true,
            items: {
              select: { supplierItemId: true }
            }
          }
        });

        // Agrupar recepciones por proveedor
        const recepcionesByProveedor = new Map<number, number[]>();
        for (const rec of recepcionesConfirmadas) {
          const existing = recepcionesByProveedor.get(rec.proveedorId) || [];
          existing.push(...rec.items.map(i => i.supplierItemId));
          recepcionesByProveedor.set(rec.proveedorId, existing);
        }

        // Para cada factura, verificar si sus items están en las recepciones del mismo proveedor
        for (const [facturaId, { proveedorId, itemIds }] of facturaItemMap) {
          const recepcionItemIds = recepcionesByProveedor.get(proveedorId) || [];
          // Si hay al menos un item de la factura en las recepciones confirmadas
          const tieneItemsEnComun = itemIds.some(id => recepcionItemIds.includes(id));
          if (tieneItemsEnComun) {
            facturasConRecepcion.add(facturaId);
          }
        }
      }
    }

    // Mapear para incluir ingresoConfirmado y remitoEstado derivados de goodsReceipts
    const comprobantesConIngreso = comprobantes.map(c => {
      // Buscar GoodsReceipts vinculadas
      const grConfirmada = c.goodsReceipts?.some((gr: any) => gr.estado === 'CONFIRMADA');
      const grBorrador = c.goodsReceipts?.some((gr: any) => gr.estado === 'BORRADOR');
      const tieneRecepcionPorItems = facturasConRecepcion.has(c.id);

      // ingresoConfirmado es true si tiene GoodsReceipt confirmada o legacy field
      const ingresoConfirmado = c.ingresoConfirmado || grConfirmada || tieneRecepcionPorItems;

      // remitoEstado: 'confirmado' | 'borrador' | 'sin_remito'
      let remitoEstado: string = 'sin_remito';
      if (ingresoConfirmado) {
        remitoEstado = 'confirmado';
      } else if (grBorrador) {
        remitoEstado = 'borrador';
      }

      // Obtener numero del primer GoodsReceipt vinculado
      const primerGR = c.goodsReceipts?.[0];

      return {
        ...c,
        ingresoConfirmado,
        remitoEstado,
        goodsReceiptNumero: primerGR?.numero || null,
        goodsReceiptEstado: primerGR?.estado || null,
        // No exponer GoodsReceipts internos (ya se derivó remitoEstado)
        goodsReceipts: undefined,
      };
    });

    // Calcular saldo pendiente para cada factura (total - pagos aplicados)
    const comprobanteIds = comprobantesConIngreso.map(c => c.id);
    const pagosAplicados = await prisma.paymentOrderReceipt.groupBy({
      by: ['receiptId'],
      where: { receiptId: { in: comprobanteIds } },
      _sum: { montoAplicado: true }
    });
    const pagosMap = new Map(
      pagosAplicados.map(p => [p.receiptId, Number(p._sum.montoAplicado || 0)])
    );

    // Agregar saldo calculado a cada comprobante
    const comprobantesConSaldo = comprobantesConIngreso.map(c => {
      const pagado = pagosMap.get(c.id) || 0;
      const total = Number(c.total || 0);
      const saldo = Math.max(0, total - pagado);
      return {
        ...c,
        pagado,
        saldo
      };
    });

    // =================================================================
    // CONSULTAR BD T2 SI ESTÁ HABILITADO
    // =================================================================
    let allComprobantes = [...comprobantesConSaldo];

    if (await shouldQueryT2(companyId, viewMode)) {
      try {
        const prismaT2 = getT2Client();

        // Construir filtro para BD T2
        const t2Where: any = { companyId };
        if (tipo && tipo !== 'all') t2Where.tipo = tipo;
        if (estado && estado !== 'all') t2Where.estado = estado;
        if (proveedorId) t2Where.supplierId = parseInt(proveedorId);
        if (fechaDesde || fechaHasta) {
          t2Where.fechaEmision = {};
          if (fechaDesde) t2Where.fechaEmision.gte = new Date(fechaDesde);
          if (fechaHasta) t2Where.fechaEmision.lte = new Date(fechaHasta);
        }

        const t2Raw = await prismaT2.t2PurchaseReceipt.findMany({
          where: t2Where,
          include: {
            items: {
              select: {
                id: true,
                supplierItemId: true,
                descripcion: true,
                cantidad: true,
                precioUnitario: true,
                subtotal: true,
              }
            }
          },
          orderBy: { fechaEmision: 'desc' },
          take: limit,
        });

        // Enriquecer con datos de proveedores de BD principal
        const t2Enriched = await enrichT2Receipts(t2Raw);

        // Calcular saldo para T2 (total - pagos aplicados)
        const t2Ids = t2Enriched.map((r: any) => r.id);
        const t2PagosAplicados = await prismaT2.t2PaymentOrderReceipt.groupBy({
          by: ['receiptId'],
          where: { receiptId: { in: t2Ids } },
          _sum: { montoAplicado: true }
        });
        const t2PagosMap = new Map(
          t2PagosAplicados.map(p => [p.receiptId, Number(p._sum.montoAplicado || 0)])
        );

        // Mapear a formato compatible con T1
        const t2Formatted = t2Enriched.map((r: any) => {
          const total = Number(r.total || 0);
          const pagado = t2PagosMap.get(r.id) || 0;
          const saldo = Math.max(0, total - pagado);

          return {
            id: r.id,
            numeroSerie: r.numeroSerie,
            numeroFactura: r.numeroFactura,
            tipo: r.tipo,
            fechaEmision: r.fechaEmision,
            fechaVencimiento: r.fechaVencimiento,
            estado: r.estado,
            total: r.total,
            proveedorId: r.supplierId,
            pagoUrgente: false,
            docType: 'T2' as const,
            ingresoConfirmado: r.ingresoConfirmado || false,
            remitoEstado: r.ingresoConfirmado ? 'confirmado' : 'sin_remito',
            goodsReceiptNumero: null,
            goodsReceiptEstado: null,
            proveedor: r.proveedor ? {
              id: r.proveedor.id,
              name: r.proveedor.razon_social,
              razon_social: r.proveedor.razon_social,
              cuit: r.proveedor.cuit,
            } : null,
            items: (r.items || []).map((i: any) => ({
              id: i.id,
              itemId: i.supplierItemId,
              descripcion: i.descripcion || '',
              cantidad: Number(i.cantidad),
              unidad: 'UN',
              precioUnitario: Number(i.precioUnitario),
              subtotal: Number(i.subtotal),
              proveedorId: r.supplierId,
            })),
            pagado,
            saldo,
            _fromT2: true, // Marker interno para debugging
          };
        });

        // Combinar y ordenar por fecha
        allComprobantes = [...comprobantesConSaldo, ...t2Formatted].sort((a, b) => {
          const dateA = new Date(a.fechaEmision).getTime();
          const dateB = new Date(b.fechaEmision).getTime();
          return dateB - dateA;
        }).slice(0, limit);

        console.log('[Comprobantes] 📦 BD T2: agregados', t2Formatted.length, 'comprobantes T2');
      } catch (t2Error: any) {
        console.error('[Comprobantes] ⚠️ Error consultando BD T2:', t2Error?.message);
        // No fallar la request, solo no mostrar T2
      }
    }

    // Guardar en caché
    cache.setCache(cacheKey, allComprobantes);

    console.log('[Comprobantes] ✅ Devolviendo', allComprobantes.length, 'comprobantes (ViewMode:', viewMode + ')');

    return NextResponse.json(allComprobantes, {
      headers: {
        'Cache-Control': 'public, max-age=600',
        'X-Cache': 'MISS'
      }
    });
  } catch (error: any) {
    console.error('Error fetching comprobantes:', error?.message || error);
    console.error('Stack:', error?.stack);
    return NextResponse.json(
      { error: 'Error al obtener los comprobantes', details: error?.message },
      { status: 500 }
    );
  }
}

// POST /api/compras/comprobantes - Crear nuevo comprobante
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
    const {
      numeroSerie,
      numeroFactura,
      tipo,
      proveedorId,
      fechaEmision,
      fechaVencimiento,
      fechaImputacion,
      tipoPago,
      metodoPago,
      items,
      neto,
      iva21,
      noGravado,
      impInter,
      percepcionIVA,
      percepcionIIBB,
      otrosConceptos,
      iva105,
      iva27,
      exento,
      iibb,
      total,
      tipoCuentaId,
      observaciones,
      docType,  // T1 (documentado) o T2 (extendido)
    } = body;

    // Validar docType - T2 solo se puede crear en modo Extended
    const requestedDocType = docType === 'T2' ? 'T2' : 'T1';
    if (requestedDocType === 'T2' && !isExtendedMode(viewMode)) {
      return NextResponse.json(
        { error: 'No autorizado para crear este tipo de documento' },
        { status: 403 }
      );
    }

    // ENFORCEMENT: Verificar proveedor bloqueado (T1 solamente)
    if (requestedDocType === 'T1' && proveedorId) {
      const proveedorCheck = await verificarProveedorBloqueado(Number(proveedorId), prisma);
      if (!proveedorCheck.eligible) {
        console.log('[COMPROBANTES] ❌ Proveedor bloqueado:', proveedorCheck);
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

    // Validaciones básicas
    if (!numeroSerie || !numeroFactura || !tipo || !proveedorId || !fechaEmision || !fechaImputacion) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'El comprobante debe tener al menos un item' },
        { status: 400 }
      );
    }

    if (!tipoCuentaId) {
      return NextResponse.json(
        { error: 'Debe seleccionar un tipo de cuenta' },
        { status: 400 }
      );
    }

    // =================================================================
    // CREAR EN BD T2 SI ES DOCUMENTO T2
    // =================================================================
    if (requestedDocType === 'T2') {
      // Verificar que T2 está habilitado
      if (!(await shouldQueryT2(companyId, viewMode))) {
        return NextResponse.json(
          { error: 'Base de datos T2 no disponible' },
          { status: 503 }
        );
      }

      try {
        const prismaT2 = getT2Client();

        // Crear comprobante en BD T2
        const comprobanteT2 = await prismaT2.t2PurchaseReceipt.create({
          data: {
            companyId,
            supplierId: parseInt(proveedorId),
            tipoCuentaId: parseInt(tipoCuentaId),
            createdBy: user.id,
            numeroSerie,
            numeroFactura,
            tipo: tipo || 'X', // Usar tipo del frontend, fallback 'X'
            fechaEmision: new Date(fechaEmision),
            fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
            fechaImputacion: new Date(fechaImputacion),
            tipoPago: tipoPago || 'contado',
            metodoPago: metodoPago || null,
            neto: parseFloat(neto) || 0,
            total: parseFloat(total) || 0,
            estado: 'pendiente',
            observaciones: observaciones || null,
          },
        });

        // Crear items en BD T2
        for (const item of items) {
          await prismaT2.t2PurchaseReceiptItem.create({
            data: {
              receiptId: comprobanteT2.id,
              supplierItemId: item.itemId ? parseInt(item.itemId) : 0,
              cantidad: parseFloat(item.cantidad) || 0,
              precioUnitario: parseFloat(item.precioUnitario) || 0,
              subtotal: parseFloat(item.subtotal) || 0,
              descripcion: item.descripcion || null,
            },
          });
          // Nota: El historial de precios se crea al momento del PAGO, no aquí
        }

        // Enriquecer con datos del proveedor
        const [enriched] = await enrichT2Receipts([comprobanteT2]);

        // Invalidar caché
        cache.invalidateCache(companyId);

        console.log('[Comprobantes] ✅ Creado comprobante T2 en BD secundaria:', comprobanteT2.id);

        return NextResponse.json({
          ...enriched,
          docType: 'T2',
          _fromT2: true,
        }, { status: 201 });
      } catch (t2Error: any) {
        console.error('[Comprobantes] ❌ Error creando en BD T2:', t2Error?.message);
        return NextResponse.json(
          { error: 'Error al crear documento T2', details: t2Error?.message },
          { status: 500 }
        );
      }
    }

    // =================================================================
    // CREAR EN BD PRINCIPAL (T1)
    // =================================================================
    // Crear comprobante con items en una transacción
    const nuevoComprobante = await prisma.$transaction(async (tx) => {
      // Crear el comprobante
      const comprobante = await tx.purchaseReceipt.create({
        data: {
          numeroSerie,
          numeroFactura,
          tipo,
          proveedorId: parseInt(proveedorId),
          fechaEmision: new Date(fechaEmision),
          fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
          fechaImputacion: new Date(fechaImputacion),
          tipoPago,
          metodoPago: metodoPago || null,
          neto: parseFloat(neto) || 0,
          iva21: parseFloat(iva21) || 0,
          noGravado: parseFloat(noGravado) || 0,
          impInter: parseFloat(impInter) || 0,
          percepcionIVA: parseFloat(percepcionIVA) || 0,
          percepcionIIBB: parseFloat(percepcionIIBB) || 0,
          otrosConceptos: parseFloat(otrosConceptos) || 0,
          iva105: parseFloat(iva105) || 0,
          iva27: parseFloat(iva27) || 0,
          exento: parseFloat(exento) || 0,
          iibb: parseFloat(iibb) || 0,
          total: parseFloat(total) || 0,
          tipoCuentaId: parseInt(tipoCuentaId),
          estado: tipoPago === 'contado' ? 'pagada' : 'pendiente',
          observaciones: observaciones || null,
          docType: 'T1',  // Siempre T1 en BD principal
          companyId,
          createdBy: user.id,
        },
      });

      // Resolver/crear SupplierItem para cada fila y luego crear los items del comprobante
      const resolvedItems: any[] = [];

      for (const item of items) {
        let supplierItemId: number | null = null;

        if (item.itemId) {
          // Ya viene vinculado a un SupplierItem
          supplierItemId = parseInt(item.itemId);
        } else if (item.descripcion) {
          // No tiene itemId: crear o reutilizar supply + supplierItem
          const nombre = String(item.descripcion).trim();
          const unidad = item.unidad || 'UN';
          // El proveedor SIEMPRE es el de la factura, no confiamos en item.proveedorId
          const proveedorItemId = parseInt(proveedorId);

          // Buscar o crear supply interno
          let supply = await tx.supplies.findFirst({
            where: {
              name: nombre,
              company_id: companyId,
            },
          });

          if (!supply) {
            supply = await tx.supplies.create({
              data: {
                name: nombre,
                unit_measure: unidad,
                company_id: companyId,
                is_active: true,
              },
            });
          }

          // Buscar o crear SupplierItem para este proveedor + producto interno
          let supplierItem = await tx.supplierItem.findFirst({
            where: {
              supplierId: proveedorItemId,
              supplyId: supply.id,
              companyId,
            },
          });

          if (!supplierItem) {
            supplierItem = await tx.supplierItem.create({
              data: {
                supplierId: proveedorItemId,
                supplyId: supply.id,
                nombre,
                descripcion: item.descripcion || null,
                codigoProveedor: item.codigoProveedor || null,
                unidad,
                precioUnitario: item.precioUnitario ? parseFloat(item.precioUnitario) : null,
                activo: true,
                companyId,
              },
            });
          } else {
            // Actualizar datos básicos por si cambiaron
            await tx.supplierItem.update({
              where: { id: supplierItem.id },
              data: {
                nombre,
                descripcion: item.descripcion || supplierItem.descripcion,
                codigoProveedor: item.codigoProveedor || supplierItem.codigoProveedor,
                unidad,
              },
            });
          }

          supplierItemId = supplierItem.id;
        }

        const cantidad = parseFloat(item.cantidad) || 0;
        const precioUnitario = parseFloat(item.precioUnitario) || 0;
        const subtotal = parseFloat(item.subtotal) || cantidad * precioUnitario || 0;

        resolvedItems.push({
          comprobanteId: comprobante.id,
          itemId: supplierItemId,
          descripcion: item.descripcion,
          cantidad,
          unidad: item.unidad || '',
          precioUnitario,
          subtotal,
          // Forzamos que el proveedor del item sea el mismo del comprobante
          proveedorId: parseInt(proveedorId),
          companyId,
        });
      }

      // Crear los items del comprobante
      if (resolvedItems.length > 0) {
        await tx.purchaseReceiptItem.createMany({
          data: resolvedItems,
        });
      }

      // NOTA: El comprobante NO actualiza stock automáticamente.
      // El stock se actualiza cuando se confirma una RECEPCIÓN (GoodsReceipt),
      // donde el encargado confirma que la mercadería llegó físicamente
      // y puede subir evidencia (foto del remito firmado, firma digital, etc.)

      // NOTA: El historial de precios se crea al momento del PAGO (ordenes-pago),
      // donde se calcula el precio efectivo considerando NCAs y descuentos.
      // Precio efectivo = (Total Factura - NCAs aplicadas) / Cantidad

      // Obtener el comprobante completo con relaciones
      return await tx.purchaseReceipt.findUnique({
        where: { id: comprobante.id },
        include: {
          proveedor: {
            select: {
              id: true,
              name: true,
              cuit: true,
              razon_social: true,
            }
          },
          tipoCuenta: {
            select: {
              id: true,
              nombre: true,
            }
          },
          items: {
            include: {
              supplierItem: {
                include: {
                  supply: {
                    select: {
                      id: true,
                      name: true,
                    }
                  }
                }
              }
            }
          },
        },
      });
    });

    // Invalidar caché después de crear
    cache.invalidateCache(companyId);

    // Inicializar pronto pago si el proveedor lo tiene configurado
    if (nuevoComprobante) {
      try {
        const prontoPagoData = await inicializarProntoPago(
          nuevoComprobante.id,
          parseInt(proveedorId),
          new Date(fechaEmision),
          parseFloat(neto) || 0,
          parseFloat(total) || 0
        );

        if (prontoPagoData.prontoPagoDisponible) {
          await prisma.purchaseReceipt.update({
            where: { id: nuevoComprobante.id },
            data: {
              prontoPagoDisponible: prontoPagoData.prontoPagoDisponible,
              prontoPagoFechaLimite: prontoPagoData.prontoPagoFechaLimite,
              prontoPagoPorcentaje: prontoPagoData.prontoPagoPorcentaje,
              prontoPagoMonto: prontoPagoData.prontoPagoMonto
            }
          });
        }
      } catch (error) {
        console.error('Error inicializando pronto pago:', error);
        // No bloquear la creación del comprobante si falla el pronto pago
      }
    }

    // Registrar auditoría
    if (nuevoComprobante) {
      await logCreation({
        entidad: 'purchase_receipt',
        entidadId: nuevoComprobante.id,
        companyId,
        userId: user.id,
        estadoInicial: nuevoComprobante.estado,
        amount: nuevoComprobante.total ? Number(nuevoComprobante.total) : undefined,
      });
    }

    return NextResponse.json(nuevoComprobante, { status: 201 });
  } catch (error) {
    console.error('Error creating comprobante:', error);
    return NextResponse.json(
      { error: 'Error al crear el comprobante' },
      { status: 500 }
    );
  }
}

