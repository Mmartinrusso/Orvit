import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getT2Client, isT2DatabaseConfigured } from '@/lib/prisma-t2';
import { logCreation, logStatusChange } from '@/lib/compras/audit-helper';
import { verificarProveedorBloqueado, verificarElegibilidadFacturas, requiereDobleAprobacion } from '@/lib/compras/payment-eligibility';
import { verificarSoDEntreDocumentos } from '@/lib/compras/sod-rules';
import { getUserAndCompany, CREATOR_ROLES } from '@/lib/compras/auth-helper';
import { getViewMode, isExtendedMode } from '@/lib/view-mode/get-mode';
import { MODE } from '@/lib/view-mode/types';
import { shouldQueryT2, enrichT2PaymentOrders } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

import * as cache from './cache';
import { invalidateSolicitudesCache } from '../solicitudes/route';

// GET /api/compras/ordenes-pago
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndCompany();
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { companyId } = auth;

    const { searchParams } = new URL(request.url);
    const proveedorId = searchParams.get('proveedorId');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    // Get ViewMode from middleware header
    const viewMode = getViewMode(request);

    // Generar clave de caché (incluir viewMode)
    const cacheKey = `ordenes-${companyId}-${proveedorId || 'all'}-${fechaDesde || ''}-${fechaHasta || ''}-${viewMode}`;
    const cached = cache.getCache(cacheKey);

    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, max-age=300',
          'X-Cache': 'HIT'
        }
      });
    }

    // =================================================================
    // BD T2 SEPARADA: Excluir T2 de BD principal, consultar BD T2 aparte
    // =================================================================
    console.log('[ORDENES PAGO] ViewMode recibido:', viewMode);
    // Siempre excluir T2 de BD principal (ahora vive en otra BD)
    const where: any = { companyId, docType: { not: 'T2' } };

    if (proveedorId) {
      where.proveedorId = parseInt(proveedorId);
      // Optimización: Si hay proveedorId (cuenta corriente), reducir límite
    }

    if (fechaDesde || fechaHasta) {
      where.fechaPago = {};
      if (fechaDesde) {
        where.fechaPago.gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        where.fechaPago.lte = new Date(fechaHasta);
      }
    }

    // Optimización: Incluir recibos solo cuando hay proveedorId (cuenta corriente)
    // Para el historial de pagos necesitamos los recibos
    const baseSelect: any = {
      id: true,
      fechaPago: true,
      totalPago: true,
      efectivo: true,
      dolares: true,
      transferencia: true,
      chequesTerceros: true,
      chequesPropios: true,
      retIVA: true,
      retGanancias: true,
      retIngBrutos: true,
      anticipo: true,
      notas: true,
      proveedor: {
        select: {
          id: true,
          name: true,
          razon_social: true,
          cuit: true,
        },
      },
      createdByUser: {
        select: { id: true, name: true },
      },
    };

    // Si hay proveedorId (cuenta corriente), incluir recibos, company y cheques para el historial y PDF
    if (proveedorId) {
      baseSelect.company = {
        select: {
          id: true,
          name: true,
          cuit: true,
          address: true,
          phone: true,
          logo: true,
          logoLight: true,
          logoDark: true,
        },
      };
      baseSelect.recibos = {
        take: 10, // Limitar a 10 recibos por orden para rendimiento
        select: {
          id: true,
          montoAplicado: true,
          receipt: {
            select: {
              id: true,
              numeroSerie: true,
              numeroFactura: true,
              total: true,
              tipo: true,
            }
          }
        }
      };
      baseSelect.cheques = {
        select: {
          id: true,
          tipo: true,
          numero: true,
          banco: true,
          titular: true,
          fechaVencimiento: true,
          importe: true,
        }
      };
    }

    const ordenesRaw = await prisma.paymentOrder.findMany({
      where,
      select: baseSelect,
      orderBy: { fechaPago: 'desc' },
      take: proveedorId ? 30 : 50, // Límite extremadamente reducido
    });

    // Eliminar duplicados por ID (por si acaso)
    const ordenes = Array.from(
      new Map(ordenesRaw.map((o: any) => [o.id, o])).values()
    );

    console.log('[ORDENES PAGO] GET - Órdenes T1 encontradas:', ordenesRaw.length, 'únicas:', ordenes.length, 'para proveedorId:', proveedorId);

    // =================================================================
    // CONSULTAR BD T2 SI ESTÁ HABILITADO
    // =================================================================
    let allOrdenes = [...ordenes];

    if (await shouldQueryT2(companyId, viewMode)) {
      try {
        const prismaT2 = getT2Client();

        // Construir filtro para BD T2
        const t2Where: any = { companyId };
        if (proveedorId) t2Where.supplierId = parseInt(proveedorId);
        if (fechaDesde || fechaHasta) {
          t2Where.fechaPago = {};
          if (fechaDesde) t2Where.fechaPago.gte = new Date(fechaDesde);
          if (fechaHasta) t2Where.fechaPago.lte = new Date(fechaHasta);
        }

        const t2Raw = await prismaT2.t2PaymentOrder.findMany({
          where: t2Where,
          orderBy: { fechaPago: 'desc' },
          take: proveedorId ? 30 : 50,
        });

        // Enriquecer con datos de proveedores de BD principal
        const t2Enriched = await enrichT2PaymentOrders(t2Raw);

        // Mapear a formato compatible con T1
        const t2Formatted = t2Enriched.map((o: any) => ({
          id: o.id,
          fechaPago: o.fechaPago,
          totalPago: o.totalPago,
          efectivo: o.efectivo,
          dolares: 0,
          transferencia: o.transferencia,
          chequesTerceros: 0,
          chequesPropios: 0,
          retIVA: 0,
          retGanancias: 0,
          retIngBrutos: 0,
          anticipo: 0,
          notas: o.notas,
          docType: 'T2' as const,
          proveedor: o.proveedor ? {
            id: o.proveedor.id,
            name: o.proveedor.razonSocial,
            razon_social: o.proveedor.razonSocial,
            cuit: o.proveedor.cuit,
          } : null,
          createdByUser: o.createdByUser,
          _fromT2: true,
        }));

        // Combinar y ordenar por fecha
        allOrdenes = [...ordenes, ...t2Formatted].sort((a: any, b: any) => {
          const dateA = new Date(a.fechaPago).getTime();
          const dateB = new Date(b.fechaPago).getTime();
          return dateB - dateA;
        });

        console.log('[ORDENES PAGO] 📦 BD T2: agregadas', t2Formatted.length, 'órdenes T2');
      } catch (t2Error: any) {
        console.error('[ORDENES PAGO] ⚠️ Error consultando BD T2:', t2Error?.message);
      }
    }

    // Guardar en caché
    cache.setCache(cacheKey, allOrdenes);

    return NextResponse.json(allOrdenes, {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'X-Cache': 'MISS'
      }
    });
  } catch (error) {
    console.error('[ORDENES PAGO] Error en GET:', error);
    return NextResponse.json({ error: 'Error al obtener las órdenes de pago' }, { status: 500 });
  }
}

// POST /api/compras/ordenes-pago
export async function POST(request: NextRequest) {
  try {
    // Usar auth helper centralizado con verificación de roles para crear órdenes
    const auth = await getUserAndCompany(CREATOR_ROLES);
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user, companyId } = auth;

    // Get ViewMode from middleware header
    const viewMode = getViewMode(request);

    const body = await request.json();
    const {
      proveedorId,
      fechaPago,
      efectivo = 0,
      dolares = 0,
      transferencia = 0,
      chequesTerceros = 0,
      chequesPropios = 0,
      retIVA = 0,
      retGanancias = 0,
      retIngBrutos = 0,
      notas,
      facturas, // [{ receiptId, montoAplicado }]
      anticiposUsados = [], // [{ id, monto }]
      // docType ya NO viene del request - se hereda de las facturas
    } = body;

    // docType puede venir del request para anticipos puros (sin facturas)
    const requestedDocTypeFromBody = body.docType as 'T1' | 'T2' | undefined;

    if (!proveedorId || !fechaPago) {
      return NextResponse.json(
        { error: 'Faltan proveedorId o fechaPago' },
        { status: 400 },
      );
    }

    // ============================================
    // ENFORCEMENT: Verificar proveedor bloqueado
    // ============================================
    const proveedorCheck = await verificarProveedorBloqueado(Number(proveedorId), prisma);
    if (!proveedorCheck.eligible) {
      console.log('[ORDENES PAGO] ❌ Proveedor bloqueado:', proveedorCheck);
      return NextResponse.json(
        {
          error: proveedorCheck.reason,
          code: proveedorCheck.code,
          details: proveedorCheck.details,
        },
        { status: 403 }
      );
    }

    // Calcular total del pago para validar que no sea 0
    const totalPagoCalc =
      Number(efectivo || 0) +
      Number(dolares || 0) +
      Number(transferencia || 0) +
      Number(chequesTerceros || 0) +
      Number(chequesPropios || 0) +
      Number(retIVA || 0) +
      Number(retGanancias || 0) +
      Number(retIngBrutos || 0);

    // Permitir anticipos puros (sin facturas) si hay un monto de pago
    const esAnticipoPuro = !facturas || !Array.isArray(facturas) || facturas.length === 0;

    if (esAnticipoPuro && totalPagoCalc === 0) {
      return NextResponse.json(
        { error: 'Debe ingresar un monto de pago para crear un anticipo' },
        { status: 400 },
      );
    }

    // ============================================
    // VALIDACIÓN DE PAGOS DUPLICADOS (solo si hay facturas)
    // ============================================
    const receiptIds = esAnticipoPuro ? [] : (facturas as any[]).map((f: any) => Number(f.receiptId));

    // Obtener estado actual de las facturas con lock FOR UPDATE para evitar race conditions
    const facturasActuales = await prisma.purchaseReceipt.findMany({
      where: {
        id: { in: receiptIds },
        companyId
      },
      select: {
        id: true,
        numeroFactura: true,
        numeroSerie: true,
        tipo: true,
        total: true,
        estado: true,
        docType: true, // Incluir docType para heredar al pago
      }
    });

    // ============================================
    // DETERMINAR docType
    // - Si hay facturas: heredar de las facturas (no mezclar T1 y T2)
    // - Si es anticipo puro: usar el docType del request body
    // ============================================
    let requestedDocType: 'T1' | 'T2' = 'T1';

    if (esAnticipoPuro) {
      // Anticipo puro: usar docType del request o default T1
      requestedDocType = requestedDocTypeFromBody || 'T1';
      console.log('[ORDENES PAGO] Anticipo puro con docType:', requestedDocType);
    } else {
      // Con facturas: heredar docType de las facturas
      const docTypes = new Set(facturasActuales.map(f => f.docType || 'T1')); // null = legacy = T1
      if (docTypes.size > 1) {
        return NextResponse.json(
          {
            error: 'No se pueden pagar facturas de distinto tipo en una misma orden. Separe las facturas T1 y T2.',
            code: 'MIXED_DOCTYPE'
          },
          { status: 400 }
        );
      }
      requestedDocType = (docTypes.values().next().value || 'T1') as 'T1' | 'T2';
      console.log('[ORDENES PAGO] DocType heredado de facturas:', requestedDocType);
    }

    // T2 solo se puede pagar en modo Extended
    if (requestedDocType === 'T2' && !isExtendedMode(viewMode)) {
      return NextResponse.json(
        { error: 'No autorizado para pagar este tipo de documento' },
        { status: 403 }
      );
    }

    // ============================================
    // ENFORCEMENT: Verificar elegibilidad de facturas (match status, recepción)
    // Aplica tanto para T1 como T2
    // ============================================
    if (!esAnticipoPuro && receiptIds.length > 0) {
      const eligibilityCheck = await verificarElegibilidadFacturas(receiptIds, companyId, prisma);

      if (!eligibilityCheck.allEligible) {
        console.log('[ORDENES PAGO] ❌ Facturas no elegibles para pago:', eligibilityCheck.blockedFacturas);
        return NextResponse.json(
          {
            error: 'Una o más facturas no son elegibles para pago',
            code: 'FACTURAS_NO_ELEGIBLES',
            blockedFacturas: eligibilityCheck.blockedFacturas,
          },
          { status: 403 }
        );
      }

      // ============================================
      // ENFORCEMENT: SoD - Verificar que el usuario no haya aprobado las OCs relacionadas
      // ============================================
      // Obtener OCs relacionadas con las facturas
      const facturasConOC = await prisma.purchaseReceipt.findMany({
        where: { id: { in: receiptIds } },
        select: {
          id: true,
          purchaseOrderId: true,
          goodsReceipts: {
            select: { id: true, purchaseOrderId: true }
          }
        }
      });

      // Recopilar IDs de OCs únicas
      const ocIds = new Set<number>();
      for (const factura of facturasConOC) {
        if (factura.purchaseOrderId) {
          ocIds.add(factura.purchaseOrderId);
        }
        for (const gr of factura.goodsReceipts) {
          if (gr.purchaseOrderId) {
            ocIds.add(gr.purchaseOrderId);
          }
        }
      }

      // Verificar SoD para cada OC
      for (const ocId of ocIds) {
        const sodCheck = await verificarSoDEntreDocumentos(
          user.id,
          'CREAR_OP',
          ocId,
          'OC',
          prisma
        );
        if (!sodCheck.allowed) {
          console.log('[ORDENES PAGO] ❌ Violación SoD:', sodCheck.message);
          return NextResponse.json(
            { error: sodCheck.message, code: 'SOD_VIOLATION' },
            { status: 403 }
          );
        }
      }
    }

    // ============================================
    // VALIDACIÓN DE MEDIOS DE PAGO PARA T2
    // T2 permite: efectivo, dólares, transferencias, cheques físicos
    // NO permite: ECHEQ, retenciones (son fiscales)
    // ============================================
    if (requestedDocType === 'T2') {
      // Retenciones no permitidas en T2 (son fiscales)
      if (Number(retIVA || 0) > 0 || Number(retGanancias || 0) > 0 || Number(retIngBrutos || 0) > 0) {
        return NextResponse.json(
          { error: 'Las retenciones no están permitidas para este tipo de operación' },
          { status: 400 }
        );
      }

      // Validar que los cheques usados sean físicos (no ECHEQ)
      const chequesUsados = (body as any).chequesUsados as any[] | undefined;
      if (chequesUsados && chequesUsados.length > 0) {
        const tieneEcheq = chequesUsados.some(c => c.tipo === 'ECHEQ');
        if (tieneEcheq) {
          return NextResponse.json(
            { error: 'Los cheques electrónicos (ECHEQ) no están permitidos para este tipo de operación' },
            { status: 400 }
          );
        }
      }
    }

    // Verificar facturas ya pagadas (solo si hay facturas)
    if (!esAnticipoPuro) {
      const facturasPagadas = facturasActuales.filter(f => f.estado === 'pagada');
      if (facturasPagadas.length > 0) {
        const nombres = facturasPagadas.map(f =>
          `${f.tipo || 'FC'} ${f.numeroSerie || ''}-${f.numeroFactura || ''}`
        ).join(', ');
        return NextResponse.json(
          {
            error: `Las siguientes facturas ya están pagadas: ${nombres}`,
            code: 'FACTURAS_YA_PAGADAS',
            facturasPagadas: facturasPagadas.map(f => f.id)
          },
          { status: 400 },
        );
      }
    }

    // Obtener pagos previos para cada factura para validar sobrepago (solo si hay facturas)
    const pagosPreviosPorFactura = esAnticipoPuro ? [] : await prisma.paymentOrderReceipt.groupBy({
      by: ['receiptId'],
      where: { receiptId: { in: receiptIds } },
      _sum: { montoAplicado: true }
    });

    const pagosPreviosMap = new Map(
      pagosPreviosPorFactura.map(p => [p.receiptId, Number(p._sum.montoAplicado || 0)])
    );

    // Verificar sobrepagos
    const advertenciasSobrepago: string[] = [];
    for (const factura of facturas) {
      const receiptId = Number(factura.receiptId);
      const montoAplicado = Number(factura.montoAplicado || 0);
      const facturaActual = facturasActuales.find(f => f.id === receiptId);

      if (facturaActual) {
        const pagoPrevio = pagosPreviosMap.get(receiptId) || 0;
        const total = Number(facturaActual.total || 0);
        const nuevoTotal = pagoPrevio + montoAplicado;

        if (nuevoTotal > total * 1.01) { // 1% tolerancia por redondeo
          const nombre = `${facturaActual.tipo || 'FC'} ${facturaActual.numeroSerie || ''}-${facturaActual.numeroFactura || ''}`;
          advertenciasSobrepago.push(
            `${nombre}: Total=$${total.toFixed(2)}, Ya pagado=$${pagoPrevio.toFixed(2)}, Intentando pagar=$${montoAplicado.toFixed(2)}`
          );
        }
      }
    }

    if (advertenciasSobrepago.length > 0) {
      console.warn('[ORDENES PAGO] Advertencias de sobrepago:', advertenciasSobrepago);
      // No bloqueamos, solo advertimos en el log
    }

    const totalPagoMedios =
      Number(efectivo || 0) +
      Number(dolares || 0) +
      Number(transferencia || 0) +
      Number(chequesTerceros || 0) +
      Number(chequesPropios || 0) +
      Number(retIVA || 0) +
      Number(retGanancias || 0) +
      Number(retIngBrutos || 0);

    console.log('[ORDENES PAGO] Iniciando creación de orden de pago...', {
      companyId,
      proveedorId,
      facturasCount: esAnticipoPuro ? 0 : (facturas as any[]).length,
      esAnticipoPuro,
      totalPagoMedios,
      requestedDocType
    });

    // =================================================================
    // SI ES T2: Crear orden de pago en BD T2
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

        // Calcular totales
        const totalAplicado = esAnticipoPuro ? 0 : (facturas as any[]).reduce(
          (sum: number, f: any) => sum + Number(f.montoAplicado || 0), 0
        );
        const totalPago = totalPagoMedios;
        const anticipo = totalPago - totalAplicado;

        // Crear orden de pago T2
        const ordenT2 = await prismaT2.t2PaymentOrder.create({
          data: {
            companyId,
            supplierId: Number(proveedorId),
            fechaPago: new Date(fechaPago),
            totalPago,
            efectivo: Number(efectivo || 0),
            transferencia: Number(transferencia || 0),
            notas: notas || null,
            createdBy: user.id,
          },
        });

        // Crear relaciones con facturas T2 y actualizar estados
        if (!esAnticipoPuro && facturas && facturas.length > 0) {
          for (const factura of facturas as any[]) {
            const receiptId = Number(factura.receiptId);
            const montoAplicado = Number(factura.montoAplicado || 0);

            // Crear relación
            await prismaT2.t2PaymentOrderReceipt.create({
              data: {
                paymentOrderId: ordenT2.id,
                receiptId,
                montoAplicado,
              },
            });

            // Actualizar estado de la factura T2
            const receipt = await prismaT2.t2PurchaseReceipt.findUnique({
              where: { id: receiptId },
              select: { total: true },
            });

            if (receipt) {
              // Calcular total pagado
              const pagosPrevios = await prismaT2.t2PaymentOrderReceipt.aggregate({
                where: { receiptId },
                _sum: { montoAplicado: true },
              });

              const pagado = Number(pagosPrevios._sum?.montoAplicado || 0);
              const total = Number(receipt.total || 0);

              let nuevoEstado = 'pendiente';
              if (pagado >= total && total > 0) {
                nuevoEstado = 'pagada';
              } else if (pagado > 0 && pagado < total) {
                nuevoEstado = 'parcial';
              }

              await prismaT2.t2PurchaseReceipt.update({
                where: { id: receiptId },
                data: { estado: nuevoEstado },
              });

              // =====================================================
              // HISTORIAL DE PRECIOS T2: Solo cuando la factura queda PAGADA
              // Calcular precio efectivo considerando NCAs vinculadas
              // =====================================================
              if (nuevoEstado === 'pagada') {
                // Obtener items de la factura T2
                const facturaItems = await prismaT2.t2PurchaseReceiptItem.findMany({
                  where: { receiptId },
                  select: {
                    supplierItemId: true,
                    cantidad: true,
                    precioUnitario: true,
                    subtotal: true,
                  },
                });

                // Obtener NCAs vinculadas a esta factura T2 (están en BD principal)
                // Las NCAs con docType='T2' y facturaId=receiptId
                const ncasVinculadas = await prisma.creditDebitNote.findMany({
                  where: {
                    facturaId: receiptId,
                    docType: 'T2',
                    tipo: 'NOTA_CREDITO',
                    aplicada: true,
                    companyId,
                  },
                  select: { total: true },
                });

                const totalNCAs = ncasVinculadas.reduce(
                  (sum, nca) => sum + Number(nca.total || 0),
                  0
                );

                // Calcular factor de ajuste proporcional
                const factorAjuste = total > 0 ? Math.max(0, (total - totalNCAs) / total) : 1;

                // Crear historial de precios para cada item (en BD principal)
                for (const item of facturaItems) {
                  if (item.supplierItemId && item.supplierItemId > 0 && item.precioUnitario) {
                    const precioOriginal = Number(item.precioUnitario);
                    const precioEfectivo = precioOriginal * factorAjuste;

                    // Crear registro en historial de precios (BD principal)
                    await prisma.priceHistory.create({
                      data: {
                        supplierItemId: item.supplierItemId,
                        precioUnitario: precioEfectivo,
                        comprobanteId: null, // T2 no tiene comprobante en T1
                        fecha: new Date(),
                        companyId,
                      },
                    });

                    // Actualizar precio actual del SupplierItem (BD principal)
                    await prisma.supplierItem.update({
                      where: { id: item.supplierItemId },
                      data: { precioUnitario: precioEfectivo },
                    });
                  }
                }

                console.log(`[ORDENES PAGO] Historial de precios T2 creado para factura ${receiptId}, factor ajuste: ${factorAjuste.toFixed(4)}`);
              }
            }
          }
        }

        // Enriquecer con datos del proveedor
        const [enriched] = await enrichT2PaymentOrders([ordenT2]);

        // Invalidar caché
        cache.invalidateCache(companyId);

        console.log('[ORDENES PAGO] ✅ Orden T2 creada en BD secundaria:', ordenT2.id);

        return NextResponse.json({
          ...enriched,
          docType: 'T2',
          _fromT2: true,
        }, { status: 201 });
      } catch (t2Error: any) {
        console.error('[ORDENES PAGO] ❌ Error creando orden T2:', t2Error?.message);
        return NextResponse.json(
          { error: 'Error al crear orden de pago T2', details: t2Error?.message },
          { status: 500 }
        );
      }
    }

    // =================================================================
    // SI ES T1: Crear orden de pago en BD PRINCIPAL
    // =================================================================

    // ============================================
    // VERIFICAR SI REQUIERE DOBLE APROBACIÓN
    // ============================================
    const checkDobleAprobacion = await requiereDobleAprobacion(totalPagoMedios, companyId, prisma);
    const necesitaDobleAprobacion = checkDobleAprobacion.requiere;

    if (necesitaDobleAprobacion) {
      console.log(`[ORDENES PAGO] ⚠️ Pago de $${totalPagoMedios} requiere doble aprobación (umbral: $${checkDobleAprobacion.umbral})`);
    }

    const orden = await prisma.$transaction(async (tx) => {
      // ============================================
      // OPTIMISTIC LOCKING: Re-validar dentro de transacción (solo si hay facturas)
      // ============================================
      // Esto previene race conditions cuando 2 usuarios intentan pagar la misma factura
      if (!esAnticipoPuro && !necesitaDobleAprobacion) {
        const facturasEnTx = await tx.purchaseReceipt.findMany({
          where: {
            id: { in: receiptIds },
            companyId
          },
          select: { id: true, estado: true, numeroFactura: true, numeroSerie: true, tipo: true }
        });

        const facturasYaPagadasEnTx = facturasEnTx.filter(f => f.estado === 'pagada');
        if (facturasYaPagadasEnTx.length > 0) {
          const nombres = facturasYaPagadasEnTx.map(f =>
            `${f.tipo || 'FC'} ${f.numeroSerie || ''}-${f.numeroFactura || ''}`
          ).join(', ');
          throw new Error(`CONFLICT: Facturas ya pagadas por otro usuario: ${nombres}`);
        }
      }

      // Calcular cuánto se aplica realmente a facturas (0 para anticipos puros)
      const totalAplicado = esAnticipoPuro ? 0 : (facturas as any[]).reduce(
        (sum: number, f: any) => sum + Number(f.montoAplicado || 0),
        0,
      );
      const totalAnticiposUsados = (anticiposUsados as any[]).reduce(
        (sum, a) => sum + Number(a.monto || 0),
        0,
      );
      const totalPago = totalPagoMedios + totalAnticiposUsados;
      const anticipo = totalPago - totalAplicado;

      console.log('[ORDENES PAGO] Creando orden en BD...', {
        totalPago,
        anticipo,
        totalAplicado,
        necesitaDobleAprobacion
      });

      const nuevaOrden = await tx.paymentOrder.create({
        data: {
          companyId,
          proveedorId: Number(proveedorId),
          fechaPago: new Date(fechaPago),
          totalPago,
          efectivo: Number(efectivo || 0),
          dolares: Number(dolares || 0),
          transferencia: Number(transferencia || 0),
          chequesTerceros: Number(chequesTerceros || 0),
          chequesPropios: Number(chequesPropios || 0),
          retIVA: Number(retIVA || 0),
          retGanancias: Number(retGanancias || 0),
          retIngBrutos: Number(retIngBrutos || 0),
          anticipo: anticipo > 0 ? anticipo : 0,
          notas: notas || null,
          docType: 'T1',  // Siempre T1 aquí (T2 se maneja arriba y retorna temprano)
          createdBy: user.id,
          // Doble aprobación
          estado: necesitaDobleAprobacion ? 'PENDIENTE_APROBACION' : 'EJECUTADO',
          requiereDobleAprobacion: necesitaDobleAprobacion,
          primeraAprobacionBy: necesitaDobleAprobacion ? user.id : null,
          primeraAprobacionAt: necesitaDobleAprobacion ? new Date() : null,
        },
      });

      // Si requiere doble aprobación, NO aplicar pagos a facturas todavía
      // Solo guardar la relación para referencia
      if (necesitaDobleAprobacion) {
        // Guardar facturas asociadas pero sin aplicar pago
        const recibosData = esAnticipoPuro ? [] : (facturas as any[]).map((f: any) => ({
          paymentOrderId: nuevaOrden.id,
          receiptId: Number(f.receiptId),
          montoAplicado: Number(f.montoAplicado || 0),
        }));

        if (recibosData.length > 0) {
          await tx.paymentOrderReceipt.createMany({ data: recibosData });
        }

        // Registrar en auditoría
        await tx.purchaseAuditLog.create({
          data: {
            entidad: 'payment_order',
            entidadId: nuevaOrden.id,
            accion: 'CREAR_PENDIENTE_APROBACION',
            datosNuevos: {
              totalPago,
              requiereDobleAprobacion: true,
              umbral: checkDobleAprobacion.umbral,
            },
            companyId,
            userId: user.id,
          }
        });

        return nuevaOrden;
      }

      const recibosData = esAnticipoPuro ? [] : (facturas as any[]).map((f: any) => ({
        paymentOrderId: nuevaOrden.id,
        receiptId: Number(f.receiptId),
        montoAplicado: Number(f.montoAplicado || 0),
      }));

      if (recibosData.length > 0) {
        await tx.paymentOrderReceipt.createMany({ data: recibosData });

        // Actualizar estado de las facturas según lo pagado
        const uniqueReceiptIds = Array.from(new Set(recibosData.map((r) => r.receiptId)));

        for (const receiptId of uniqueReceiptIds) {
          const recibo = await tx.purchaseReceipt.findUnique({
            where: { id: receiptId },
            select: { total: true },
          });

          if (!recibo) continue;

          const pagosPrevios = await tx.paymentOrderReceipt.aggregate({
            where: { receiptId },
            _sum: { montoAplicado: true },
          });

          const pagado = Number(pagosPrevios._sum.montoAplicado || 0);
          const total = Number(recibo.total || 0);

          let nuevoEstado: string = 'pendiente';
          if (pagado >= total && total > 0) {
            nuevoEstado = 'pagada';
          } else if (pagado > 0 && pagado < total) {
            nuevoEstado = 'parcial';
          }

          await tx.purchaseReceipt.update({
            where: { id: receiptId },
            data: { estado: nuevoEstado },
          });

          // =====================================================
          // HISTORIAL DE PRECIOS: Solo cuando la factura queda PAGADA
          // Calcular precio efectivo considerando NCAs vinculadas
          // =====================================================
          if (nuevoEstado === 'pagada') {
            // Obtener items de la factura
            // NOTA: El campo es comprobanteId, no receiptId
            const facturaItems = await tx.purchaseReceiptItem.findMany({
              where: { comprobanteId: receiptId },
              select: {
                itemId: true,
                cantidad: true,
                precioUnitario: true,
                subtotal: true,
              },
            });

            // Obtener NCAs vinculadas a esta factura (solo aplicadas)
            const ncasVinculadas = await tx.creditDebitNote.findMany({
              where: {
                facturaId: receiptId,
                tipo: 'NOTA_CREDITO',
                aplicada: true,
                companyId,
              },
              select: { total: true },
            });

            const totalNCAs = ncasVinculadas.reduce(
              (sum, nca) => sum + Number(nca.total || 0),
              0
            );

            // Calcular factor de ajuste proporcional
            // factorAjuste = (totalFactura - NCAs) / totalFactura
            const factorAjuste = total > 0 ? Math.max(0, (total - totalNCAs) / total) : 1;

            // Crear historial de precios para cada item
            for (const item of facturaItems) {
              if (item.itemId && item.precioUnitario) {
                const precioOriginal = Number(item.precioUnitario);
                const precioEfectivo = precioOriginal * factorAjuste;

                // Crear registro en historial de precios
                await tx.priceHistory.create({
                  data: {
                    supplierItemId: item.itemId,
                    precioUnitario: precioEfectivo,
                    comprobanteId: receiptId,
                    fecha: new Date(),
                    companyId,
                  },
                });

                // Actualizar precio actual del SupplierItem
                await tx.supplierItem.update({
                  where: { id: item.itemId },
                  data: { precioUnitario: precioEfectivo },
                });
              }
            }

            console.log(`[ORDENES PAGO] Historial de precios creado para factura ${receiptId}, factor ajuste: ${factorAjuste.toFixed(4)}`);
          }
        }
      }


      // Marcar anticipos usados como consumidos (poner anticipo en 0 por ahora)
      if ((anticiposUsados as any[]).length > 0) {
        const anticipoIds = Array.from(
          new Set((anticiposUsados as any[]).map((a) => Number(a.id))),
        );
        for (const id of anticipoIds) {
          await tx.paymentOrder.updateMany({
            where: { id, companyId },
            data: { anticipo: 0 },
          });
        }
      }

      // Guardar detalle de cheques utilizados (si vienen en el body)
      const chequesUsados = (body as any).chequesUsados as any[] | undefined;
      if (chequesUsados && chequesUsados.length > 0) {
        const chequesData = chequesUsados.map((c) => ({
          paymentOrderId: nuevaOrden.id,
          tipo: c.tipo || 'CHEQUE',
          numero: String(c.numero || ''),
          banco: c.banco || null,
          titular: c.titular || null,
          fechaVencimiento: c.fechaVencimiento ? new Date(c.fechaVencimiento) : null,
          importe: Number(c.importe || 0),
          companyId,
        }));
        await tx.paymentOrderCheque.createMany({ data: chequesData });
      }

      console.log('[ORDENES PAGO] Orden creada en BD con ID:', nuevaOrden.id);
      return nuevaOrden;
    });

    console.log('[ORDENES PAGO] Transacción completada, orden ID:', orden.id);

    // ============================================
    // SI REQUIERE DOBLE APROBACIÓN: Retornar sin ejecutar pago
    // ============================================
    if (necesitaDobleAprobacion) {
      // Obtener orden con relaciones básicas
      const ordenPendiente = await prisma.paymentOrder.findUnique({
        where: { id: orden.id },
        include: {
          proveedor: { select: { id: true, name: true, razon_social: true, cuit: true } },
          recibos: {
            include: {
              receipt: { select: { id: true, numeroSerie: true, numeroFactura: true, total: true, tipo: true } },
            },
          },
          createdByUser: { select: { id: true, name: true } },
        },
      });

      // Invalidar caché
      cache.invalidateCache(companyId);

      console.log('[ORDENES PAGO] ⚠️ Orden creada pendiente de segunda aprobación:', orden.id);

      return NextResponse.json({
        ...ordenPendiente,
        message: `Pago de $${totalPagoMedios.toFixed(2)} requiere segunda aprobación (umbral: $${checkDobleAprobacion.umbral})`,
        requiresApproval: true,
        estado: 'PENDIENTE_APROBACION',
      }, { status: 201 });
    }

    // Volver a consultar la orden de pago completa con sus relaciones
    const ordenCompleta = await prisma.paymentOrder.findUnique({
      where: { id: orden.id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            cuit: true,
            address: true,
            phone: true,
            logo: true,
            logoLight: true,
            logoDark: true,
          },
        },
        proveedor: {
          select: {
            id: true,
            name: true,
            razon_social: true,
            cuit: true,
          },
        },
        recibos: {
          include: {
            receipt: {
              select: {
                id: true,
                numeroSerie: true,
                numeroFactura: true,
                total: true,
                tipo: true,
              },
            },
          },
        },
        cheques: true,
        createdByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Invalidar caché después de crear
    console.log('[ORDENES PAGO] Invalidando caché para companyId:', companyId);
    cache.invalidateCache(companyId);
    // También invalidar caché de comprobantes para que se actualicen las facturas
    try {
      const comprobantesCache = await import('../comprobantes/cache');
      comprobantesCache.invalidateCache(companyId);
      console.log('[ORDENES PAGO] Caché de comprobantes invalidado');
    } catch (error) {
      console.warn('[ORDENES PAGO] Error invalidando caché de comprobantes:', error);
    }
    console.log('[ORDENES PAGO] Caché invalidado');
    
    // Marcar solicitudes de pago como PAGADA si todas sus facturas están pagadas
    // Hacerlo después de la transacción para evitar problemas
    try {
      console.log('[ORDENES PAGO] Verificando solicitudes para marcar como pagadas...');
      const facturasIds = facturas.map((f: any) => Number(f.receiptId));
      console.log('[ORDENES PAGO] Facturas en esta orden:', facturasIds);

      // Buscar solicitudes de pago (PaymentRequest) que contengan estas facturas
      const solicitudesAfectadas = await prisma.paymentRequest.findMany({
        where: {
          companyId: companyId,
          estado: { notIn: ['PAGADA', 'CANCELADA', 'RECHAZADA'] },
          facturas: {
            some: {
              receiptId: { in: facturasIds }
            }
          }
        },
        include: {
          facturas: {
            select: { receiptId: true }
          }
        }
      });

      console.log(`[ORDENES PAGO] Encontradas ${solicitudesAfectadas.length} solicitudes afectadas`);

      for (const solicitud of solicitudesAfectadas) {
        // Verificar el estado de TODAS las facturas de esta solicitud
        const receiptIds = solicitud.facturas.map(f => f.receiptId);

        const facturasEstado = await prisma.purchaseReceipt.findMany({
          where: { id: { in: receiptIds } },
          select: { id: true, estado: true }
        });

        const todasPagadas = facturasEstado.length > 0 && facturasEstado.every(
          (f) => f.estado === 'pagada'
        );

        console.log(`[ORDENES PAGO] Verificando solicitud ${solicitud.id} (${solicitud.numero}):`, {
          totalFacturas: facturasEstado.length,
          pagadas: facturasEstado.filter(f => f.estado === 'pagada').length,
          todasPagadas
        });

        if (todasPagadas) {
          console.log(`[ORDENES PAGO] ✅ Marcando solicitud ${solicitud.numero} como PAGADA`);
          await prisma.paymentRequest.update({
            where: { id: solicitud.id },
            data: { estado: 'PAGADA' }
          });
        } else {
          console.log(`[ORDENES PAGO] ⏸️ Solicitud ${solicitud.numero} aún tiene facturas pendientes`);
        }
      }
    } catch (error) {
      // No fallar la creación de la orden si hay error al actualizar solicitudes
      console.error('[ORDENES PAGO] Error al actualizar solicitudes:', error);
    }
    
    // Invalidar caché de solicitudes (puede que se hayan eliminado solicitudes)
    invalidateSolicitudesCache(companyId);

    // Invalidar caché de Next.js para la página de solicitudes
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/administracion/compras/solicitudes');

    // ============================================
    // AUDITORÍA COMPLETA
    // ============================================

    // 1. Registrar creación de la orden de pago con detalles completos
    const mediosPago: string[] = [];
    if (Number(efectivo || 0) > 0) mediosPago.push(`Efectivo: $${Number(efectivo).toFixed(2)}`);
    if (Number(dolares || 0) > 0) mediosPago.push(`Dólares: $${Number(dolares).toFixed(2)}`);
    if (Number(transferencia || 0) > 0) mediosPago.push(`Transferencia: $${Number(transferencia).toFixed(2)}`);
    if (Number(chequesTerceros || 0) > 0) mediosPago.push(`Cheques 3ros: $${Number(chequesTerceros).toFixed(2)}`);
    if (Number(chequesPropios || 0) > 0) mediosPago.push(`Cheques propios: $${Number(chequesPropios).toFixed(2)}`);
    if (Number(retIVA || 0) > 0) mediosPago.push(`Ret. IVA: $${Number(retIVA).toFixed(2)}`);
    if (Number(retGanancias || 0) > 0) mediosPago.push(`Ret. Ganancias: $${Number(retGanancias).toFixed(2)}`);
    if (Number(retIngBrutos || 0) > 0) mediosPago.push(`Ret. IIBB: $${Number(retIngBrutos).toFixed(2)}`);

    const facturasInfo = ordenCompleta?.recibos?.map(r => ({
      entity: 'purchase_receipt' as const,
      id: r.receipt.id,
      numero: `${r.receipt.tipo || 'FC'} ${r.receipt.numeroSerie || ''}-${r.receipt.numeroFactura || ''}`
    })) || [];

    await logCreation({
      entidad: 'payment_order',
      entidadId: orden.id,
      companyId,
      userId: user.id,
      amount: orden.totalPago ? Number(orden.totalPago) : undefined,
      relatedIds: facturasInfo,
    });

    // 2. Registrar cambio de estado de cada factura afectada
    for (const factura of facturas) {
      const receiptId = Number(factura.receiptId);
      const facturaActual = facturasActuales.find(f => f.id === receiptId);

      if (facturaActual) {
        // Verificar nuevo estado después del pago
        const pagosPrevios = await prisma.paymentOrderReceipt.aggregate({
          where: { receiptId },
          _sum: { montoAplicado: true },
        });

        const recibo = await prisma.purchaseReceipt.findUnique({
          where: { id: receiptId },
          select: { total: true, estado: true },
        });

        if (recibo && recibo.estado !== facturaActual.estado) {
          await logStatusChange({
            entidad: 'purchase_receipt',
            entidadId: receiptId,
            estadoAnterior: facturaActual.estado || 'pendiente',
            estadoNuevo: recibo.estado || 'pendiente',
            companyId,
            userId: user.id,
            reason: `Pago registrado en orden #${orden.id}`,
            relatedIds: [{ entity: 'payment_order', id: orden.id }],
          });
        }
      }
    }

    console.log('[ORDENES PAGO] Auditoría registrada:', {
      ordenId: orden.id,
      mediosPago,
      facturasAfectadas: facturasInfo.length
    });

    return NextResponse.json(ordenCompleta || orden, { status: 201 });
  } catch (error: any) {
    console.error('[ORDENES PAGO] Error en POST:', error);

    // Manejar errores de conflicto (optimistic locking)
    if (error.message?.startsWith('CONFLICT:')) {
      return NextResponse.json(
        {
          error: error.message.replace('CONFLICT: ', ''),
          code: 'CONFLICT_FACTURA_PAGADA'
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: 'Error al crear la orden de pago' }, { status: 500 });
  }
}


