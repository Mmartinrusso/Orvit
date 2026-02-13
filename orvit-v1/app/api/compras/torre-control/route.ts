import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { subDays, addDays } from 'date-fns';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { applyViewMode } from '@/lib/view-mode/prisma-helper';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

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

// Helper para ejecutar queries de forma segura (retorna 0 si falla)
async function safeCount(queryFn: () => Promise<number>): Promise<number> {
  try {
    return await queryFn();
  } catch (error) {
    console.warn('Query failed in torre-control:', error);
    return 0;
  }
}

// Helper para ejecutar groupBy de forma segura
async function safeGroupBy<T>(queryFn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await queryFn();
  } catch (error) {
    console.warn('GroupBy query failed in torre-control:', error);
    return [];
  }
}

// Helper para ejecutar aggregate de forma segura
async function safeAggregate<T>(queryFn: () => Promise<T>): Promise<T> {
  try {
    return await queryFn();
  } catch (error) {
    console.warn('Aggregate query failed in torre-control:', error);
    return { _sum: { total: 0 } } as T;
  }
}

// Helper para ejecutar findMany de forma segura
async function safeFind<T>(queryFn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await queryFn();
  } catch (error) {
    console.warn('Find query failed in torre-control:', error);
    return [];
  }
}

// Helper para ejecutar raw queries de conteo de forma segura
async function safeRawCount(queryFn: () => Promise<number>): Promise<number> {
  try {
    return await queryFn();
  } catch (error) {
    console.warn('Raw count query failed in torre-control:', error);
    return 0;
  }
}

// GET - Obtener todos los contadores de la torre de control
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

    const viewMode = getViewMode(request);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const en3Dias = addDays(hoy, 3);
    const en7Dias = addDays(hoy, 7);
    const hace15Dias = subDays(hoy, 15);

    // Helper to apply view mode
    const withViewMode = (base: any) => applyViewMode({ ...base, companyId }, viewMode);

    // Ejecutar queries de forma segura (cada una puede fallar independientemente)
    const [
      // RECEPCIONES
      recepcionesSinConfirmar,
      recepcionesSinFactura,
      recepcionesPorRegularizar,
      recepcionesConDiferencias,

      // FACTURAS - queries básicas
      facturasPorVencer,
      facturasVencidas,

      // FACTURAS - queries con campos nuevos (pueden fallar si migración no corrió)
      facturasMatchBlocked,
      facturasMatchPending,
      facturasMatchWarning,
      facturasDuplicadasSospechosas,

      // SOLICITUDES NCA (pueden fallar si tabla no existe)
      solicitudesNcaNuevas,
      solicitudesNcaEnviadas,
      solicitudesNcaEsperandoRespuesta,
      ncaPorAplicar,

      // PRONTO PAGO (pueden fallar si campos no existen)
      prontoPagoDisponibleHoy,
      prontoPagoVence3Dias,
      prontoPagoVence7Dias,
      prontoPagoVencido,

      // ORDENES DE COMPRA
      ocPendienteEntrega,
      ocParcialmenteRecibidas,
      ocAtrasadas,
      ocSinRecepcionMas15Dias,

      // PAGOS
      facturasListasParaPagar,
      facturasBloqueadas,
      pagosProgramados,

      // DEVOLUCIONES
      devolucionesBorrador,
      devolucionesPendientesEnvio,
      devolucionesEnviadas,
      devolucionesEnEvaluacion,
      devolucionesSinNca,

      // STOCK
      stockBajoMinimo,
      stockSinExistencia,

      // SUGERENCIAS REPOSICION
      sugerenciasReposicionPendientes,

      // ALERTAS
      comprasRapidasFrecuentes
    ] = await Promise.all([
      // RECEPCIONES - queries básicas (siempre deberían funcionar)
      safeCount(() => prisma.goodsReceipt.count({
        where: withViewMode({ estado: 'BORRADOR' })
      })),
      safeCount(() => prisma.goodsReceipt.count({
        where: withViewMode({
          estado: 'CONFIRMADA',
          tieneFactura: false
        })
      })),
      safeCount(() => prisma.goodsReceipt.count({
        where: withViewMode({
          isQuickPurchase: true,
          regularizationStatus: 'REG_PENDING'
        })
      })),
      safeCount(() => prisma.goodsReceipt.count({
        where: withViewMode({
          estado: 'CONFIRMADA',
          matchResults: {
            some: {
              estado: { in: ['DISCREPANCIA', 'BLOQUEADO'] }
            }
          }
        })
      })),

      // FACTURAS - queries básicas
      safeCount(() => prisma.purchaseReceipt.count({
        where: withViewMode({
          estado: 'pendiente',
          fechaVencimiento: {
            gte: hoy,
            lte: en7Dias
          }
        })
      })),
      safeCount(() => prisma.purchaseReceipt.count({
        where: withViewMode({
          estado: 'pendiente',
          fechaVencimiento: { lt: hoy }
        })
      })),

      // FACTURAS - queries con campos nuevos
      safeCount(() => prisma.purchaseReceipt.count({
        where: withViewMode({
          matchStatus: 'MATCH_BLOCKED',
          estado: { notIn: ['ANULADA', 'PAGADA'] }
        })
      })),
      safeCount(() => prisma.purchaseReceipt.count({
        where: withViewMode({
          matchStatus: 'MATCH_PENDING',
          estado: { notIn: ['ANULADA', 'PAGADA'] }
        })
      })),
      safeCount(() => prisma.purchaseReceipt.count({
        where: withViewMode({
          matchStatus: 'MATCH_WARNING',
          estado: { notIn: ['ANULADA', 'PAGADA'] }
        })
      })),
      safeCount(() => prisma.purchaseReceipt.count({
        where: withViewMode({
          requiereRevisionDuplicado: true,
          estado: { notIn: ['ANULADA'] }
        })
      })),

      // SOLICITUDES NCA
      safeCount(() => prisma.creditNoteRequest.count({
        where: withViewMode({ estado: 'SNCA_NUEVA' })
      })),
      safeCount(() => prisma.creditNoteRequest.count({
        where: withViewMode({ estado: 'SNCA_ENVIADA' })
      })),
      safeCount(() => prisma.creditNoteRequest.count({
        where: withViewMode({ estado: 'SNCA_EN_REVISION' })
      })),
      safeCount(() => prisma.creditNoteRequest.count({
        where: withViewMode({ estado: 'SNCA_NCA_RECIBIDA' })
      })),

      // PRONTO PAGO
      safeCount(() => prisma.purchaseReceipt.count({
        where: withViewMode({
          prontoPagoDisponible: true,
          prontoPagoAplicado: false,
          prontoPagoFechaLimite: { gte: hoy },
          estado: { notIn: ['ANULADA', 'PAGADA'] }
        })
      })),
      safeCount(() => prisma.purchaseReceipt.count({
        where: withViewMode({
          prontoPagoDisponible: true,
          prontoPagoAplicado: false,
          prontoPagoFechaLimite: { gte: hoy, lte: en3Dias },
          estado: { notIn: ['ANULADA', 'PAGADA'] }
        })
      })),
      safeCount(() => prisma.purchaseReceipt.count({
        where: withViewMode({
          prontoPagoDisponible: true,
          prontoPagoAplicado: false,
          prontoPagoFechaLimite: { gte: hoy, lte: en7Dias },
          estado: { notIn: ['ANULADA', 'PAGADA'] }
        })
      })),
      safeCount(() => prisma.purchaseReceipt.count({
        where: withViewMode({
          prontoPagoDisponible: true,
          prontoPagoAplicado: false,
          prontoPagoFechaLimite: { lt: hoy },
          estado: { notIn: ['ANULADA', 'PAGADA'] }
        })
      })),

      // ORDENES DE COMPRA
      safeCount(() => prisma.purchaseOrder.count({
        where: withViewMode({
          estado: { in: ['ENVIADA_PROVEEDOR', 'CONFIRMADA'] }
        })
      })),
      safeCount(() => prisma.purchaseOrder.count({
        where: withViewMode({
          estado: 'PARCIALMENTE_RECIBIDA'
        })
      })),
      safeCount(() => prisma.purchaseOrder.count({
        where: withViewMode({
          estado: { in: ['ENVIADA_PROVEEDOR', 'CONFIRMADA'] },
          fechaEntregaEsperada: { lt: hoy }
        })
      })),
      safeCount(() => prisma.purchaseOrder.count({
        where: withViewMode({
          estado: { in: ['ENVIADA_PROVEEDOR', 'CONFIRMADA'] },
          createdAt: { lt: hace15Dias },
          goodsReceipts: { none: {} }
        })
      })),

      // PAGOS
      safeCount(() => prisma.purchaseReceipt.count({
        where: withViewMode({
          estado: 'pendiente',
          facturaValidada: true,
          matchStatus: 'MATCH_OK',
          payApprovalStatus: { in: ['PAY_PENDING', 'PAY_APPROVED'] }
        })
      })),
      safeCount(() => prisma.purchaseReceipt.count({
        where: withViewMode({
          estado: 'pendiente',
          payApprovalStatus: 'PAY_BLOCKED_BY_MATCH'
        })
      })),
      // Pagos programados para el futuro
      safeCount(() => prisma.paymentOrder.count({
        where: {
          companyId,
          fechaPago: { gte: hoy }
        }
      })),

      // DEVOLUCIONES
      // Borradores
      safeCount(() => prisma.purchaseReturn.count({
        where: withViewMode({ estado: 'BORRADOR' })
      })),
      // Pendientes de envío (aprobadas pero no enviadas)
      safeCount(() => prisma.purchaseReturn.count({
        where: withViewMode({ estado: { in: ['SOLICITADA', 'APROBADA_PROVEEDOR'] } })
      })),
      // Enviadas esperando respuesta
      safeCount(() => prisma.purchaseReturn.count({
        where: withViewMode({ estado: 'ENVIADA' })
      })),
      // En evaluación por proveedor
      safeCount(() => prisma.purchaseReturn.count({
        where: withViewMode({ estado: { in: ['RECIBIDA_PROVEEDOR', 'EN_EVALUACION'] } })
      })),
      // Resueltas sin NCA asociada
      safeCount(() => prisma.purchaseReturn.count({
        where: withViewMode({
          estado: 'RESUELTA',
          creditNoteId: null,
          creditNoteRequestId: null
        })
      })),

      // STOCK - Items con stock bajo mínimo (usando raw query)
      safeRawCount(async () => {
        const result = await prisma.$queryRaw<[{count: bigint}]>`
          SELECT COUNT(*) as count
          FROM "SupplierItem" si
          JOIN "Stock" s ON s."supplierItemId" = si.id
          WHERE si."companyId" = ${companyId}
            AND si."stockMinimo" > 0
            AND s.cantidad <= si."stockMinimo"
            AND si.activo = true
        `;
        return Number(result[0]?.count || 0);
      }),

      // STOCK - Items sin existencia
      safeRawCount(async () => {
        const result = await prisma.$queryRaw<[{count: bigint}]>`
          SELECT COUNT(*) as count
          FROM "SupplierItem" si
          JOIN "Stock" s ON s."supplierItemId" = si.id
          WHERE si."companyId" = ${companyId}
            AND s.cantidad <= 0
            AND si.activo = true
        `;
        return Number(result[0]?.count || 0);
      }),

      // SUGERENCIAS DE REPOSICIÓN pendientes
      safeCount(() => prisma.replenishmentSuggestion.count({
        where: {
          companyId,
          estado: 'PENDIENTE'
        }
      })),

      // ALERTAS - Compras rápidas frecuentes (usuarios con más de 3 en 7 días)
      safeGroupBy(() => prisma.goodsReceipt.groupBy({
        by: ['createdBy'],
        where: withViewMode({
          isQuickPurchase: true,
          createdAt: { gte: subDays(hoy, 7) }
        }),
        _count: true,
        having: {
          createdBy: { _count: { gte: 3 } }
        }
      }))
    ]);

    // === MÉTRICAS ADICIONALES (faltantes) ===
    const [
      // OC pendientes de aprobación
      ocPendientesAprobacion,
      // Facturas sin validar (más de 3 días)
      facturasSinValidar,
      // Facturas sin ingreso confirmado
      facturasSinIngreso,
      // Match sin resolver (discrepancias pendientes)
      matchSinResolver,
      // Pagos forzados (auditoría)
      pagosForzados,
      // Ajustes de stock pendientes
      ajustesStockPendientes,
      // Transferencias en tránsito
      transferenciasEnTransito,
      // Recepciones con calidad rechazada
      recepcionesCalidadRechazada,
      // NCA aprobadas sin aplicar por más de 7 días
      ncaSinAplicar7Dias,
    ] = await Promise.all([
      // OC pendientes de aprobación
      safeCount(() => prisma.purchaseOrder.count({
        where: withViewMode({ estado: 'PENDIENTE_APROBACION' })
      })),
      // Facturas sin validar (creadas hace más de 3 días)
      safeCount(() => prisma.purchaseReceipt.count({
        where: withViewMode({
          facturaValidada: false,
          estado: 'pendiente',
          createdAt: { lt: subDays(hoy, 3) }
        })
      })),
      // Facturas sin ingreso confirmado (ya validadas pero sin confirmar ingreso)
      safeCount(() => prisma.purchaseReceipt.count({
        where: withViewMode({
          facturaValidada: true,
          ingresoConfirmado: false,
          pagoForzado: false,
          estado: 'pendiente'
        })
      })),
      // Match sin resolver
      safeCount(() => prisma.matchResult.count({
        where: {
          purchaseOrder: { companyId },
          estado: { in: ['DISCREPANCIA', 'BLOQUEADO'] },
          resuelto: false
        }
      })),
      // Pagos forzados (sin ingreso confirmado) - para auditoría
      safeCount(() => prisma.purchaseReceipt.count({
        where: withViewMode({
          pagoForzado: true,
          ingresoConfirmado: false
        })
      })),
      // Ajustes de stock pendientes de aprobación
      safeCount(() => prisma.stockAdjustment.count({
        where: {
          companyId,
          estado: 'PENDIENTE'
        }
      })),
      // Transferencias en tránsito (enviadas pero no recibidas)
      safeCount(() => prisma.stockTransfer.count({
        where: {
          companyId,
          estado: 'ENVIADA'
        }
      })),
      // Recepciones con calidad rechazada pendientes
      safeCount(() => prisma.goodsReceipt.count({
        where: withViewMode({
          estadoCalidad: 'RECHAZADO',
          estado: 'CONFIRMADA'
        })
      })),
      // NCA aprobadas/recibidas sin aplicar por más de 7 días
      safeCount(() => prisma.creditNoteRequest.count({
        where: withViewMode({
          estado: 'SNCA_NCA_RECIBIDA',
          fechaRespuesta: { lt: subDays(hoy, 7) }
        })
      })),
    ]);

    // Detectar facturas duplicadas sospechosas (de forma segura)
    const duplicadasSospechosas = await detectarFacturasDuplicadas(companyId, viewMode);

    // Obtener montos y listas de detalle en paralelo
    const [
      // Montos de facturas
      montoFacturasVencidas,
      montoFacturasPorVencer,
      montoListasParaPagar,
      montoBloqueadas,
      // Listas de detalle (top 5)
      topFacturasVencidas,
      topOcsAtrasadas,
      topListasParaPagar,
    ] = await Promise.all([
      // Monto facturas vencidas
      safeAggregate(() => prisma.purchaseReceipt.aggregate({
        where: withViewMode({
          estado: 'pendiente',
          fechaVencimiento: { lt: hoy }
        }),
        _sum: { total: true }
      })),
      // Monto facturas por vencer
      safeAggregate(() => prisma.purchaseReceipt.aggregate({
        where: withViewMode({
          estado: 'pendiente',
          fechaVencimiento: { gte: hoy, lte: en7Dias }
        }),
        _sum: { total: true }
      })),
      // Monto listas para pagar
      safeAggregate(() => prisma.purchaseReceipt.aggregate({
        where: withViewMode({
          estado: 'pendiente',
          facturaValidada: true,
          matchStatus: 'MATCH_OK',
          payApprovalStatus: { in: ['PAY_PENDING', 'PAY_APPROVED'] }
        }),
        _sum: { total: true }
      })),
      // Monto bloqueadas
      safeAggregate(() => prisma.purchaseReceipt.aggregate({
        where: withViewMode({
          estado: 'pendiente',
          payApprovalStatus: 'PAY_BLOCKED_BY_MATCH'
        }),
        _sum: { total: true }
      })),
      // Top 5 facturas vencidas
      safeFind(() => prisma.purchaseReceipt.findMany({
        where: withViewMode({
          estado: 'pendiente',
          fechaVencimiento: { lt: hoy }
        }),
        select: {
          id: true,
          numeroFactura: true,
          tipo: true,
          total: true,
          fechaVencimiento: true,
          supplier: { select: { name: true } }
        },
        orderBy: { total: 'desc' },
        take: 5
      })),
      // Top 5 OCs atrasadas
      safeFind(() => prisma.purchaseOrder.findMany({
        where: withViewMode({
          estado: { in: ['ENVIADA_PROVEEDOR', 'CONFIRMADA'] },
          fechaEntregaEsperada: { lt: hoy }
        }),
        select: {
          id: true,
          numero: true,
          total: true,
          fechaEntregaEsperada: true,
          supplier: { select: { name: true } }
        },
        orderBy: { fechaEntregaEsperada: 'asc' },
        take: 5
      })),
      // Top 5 listas para pagar
      safeFind(() => prisma.purchaseReceipt.findMany({
        where: withViewMode({
          estado: 'pendiente',
          facturaValidada: true,
          matchStatus: 'MATCH_OK',
          payApprovalStatus: { in: ['PAY_PENDING', 'PAY_APPROVED'] }
        }),
        select: {
          id: true,
          numeroFactura: true,
          tipo: true,
          total: true,
          fechaVencimiento: true,
          supplier: { select: { name: true } }
        },
        orderBy: { fechaVencimiento: 'asc' },
        take: 5
      })),
    ]);

    // === LISTAS DE DETALLE ADICIONALES ===
    const [
      // Recepciones
      listaRecepcionesSinConfirmar,
      listaRecepcionesConDiferencias,
      // Facturas
      listaFacturasMatchBlocked,
      listaFacturasPorVencer,
      // OCs
      listaOcsPendientesAprobacion,
      listaOcsParciales,
      // Pagos bloqueados
      listaPagosBloqueados,
      // NCA
      listaNcaPorAplicar,
      // Stock
      listaStockSinExistencia,
    ] = await Promise.all([
      // Recepciones sin confirmar (top 10)
      safeFind(() => prisma.goodsReceipt.findMany({
        where: withViewMode({ estado: 'BORRADOR' }),
        select: {
          id: true,
          numero: true,
          fechaRecepcion: true,
          purchaseOrder: { select: { numero: true } },
          supplier: { select: { name: true } },
          _count: { select: { items: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })),
      // Recepciones con diferencias (top 10)
      safeFind(() => prisma.goodsReceipt.findMany({
        where: withViewMode({
          estado: 'CONFIRMADA',
          matchResults: { some: { estado: { in: ['DISCREPANCIA', 'BLOQUEADO'] } } }
        }),
        select: {
          id: true,
          numero: true,
          fechaRecepcion: true,
          purchaseOrder: { select: { numero: true } },
          supplier: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })),
      // Facturas match bloqueado (top 10)
      safeFind(() => prisma.purchaseReceipt.findMany({
        where: withViewMode({
          matchStatus: 'MATCH_BLOCKED',
          estado: { notIn: ['ANULADA', 'PAGADA'] }
        }),
        select: {
          id: true,
          numeroFactura: true,
          tipo: true,
          total: true,
          fechaEmision: true,
          supplier: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })),
      // Facturas por vencer 7 días (top 10)
      safeFind(() => prisma.purchaseReceipt.findMany({
        where: withViewMode({
          estado: 'pendiente',
          fechaVencimiento: { gte: hoy, lte: en7Dias }
        }),
        select: {
          id: true,
          numeroFactura: true,
          tipo: true,
          total: true,
          fechaVencimiento: true,
          supplier: { select: { name: true } }
        },
        orderBy: { fechaVencimiento: 'asc' },
        take: 10
      })),
      // OCs pendientes aprobación (top 10)
      safeFind(() => prisma.purchaseOrder.findMany({
        where: withViewMode({ estado: 'PENDIENTE_APROBACION' }),
        select: {
          id: true,
          numero: true,
          total: true,
          createdAt: true,
          supplier: { select: { name: true } },
          createdByUser: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })),
      // OCs parcialmente recibidas (top 10)
      safeFind(() => prisma.purchaseOrder.findMany({
        where: withViewMode({ estado: 'PARCIALMENTE_RECIBIDA' }),
        select: {
          id: true,
          numero: true,
          total: true,
          fechaEntregaEsperada: true,
          supplier: { select: { name: true } },
          _count: { select: { goodsReceipts: true } }
        },
        orderBy: { fechaEntregaEsperada: 'asc' },
        take: 10
      })),
      // Pagos bloqueados (top 10)
      safeFind(() => prisma.purchaseReceipt.findMany({
        where: withViewMode({
          estado: 'pendiente',
          payApprovalStatus: 'PAY_BLOCKED_BY_MATCH'
        }),
        select: {
          id: true,
          numeroFactura: true,
          tipo: true,
          total: true,
          fechaVencimiento: true,
          supplier: { select: { name: true } }
        },
        orderBy: { total: 'desc' },
        take: 10
      })),
      // NCA por aplicar (top 10)
      safeFind(() => prisma.creditNoteRequest.findMany({
        where: withViewMode({ estado: 'SNCA_NCA_RECIBIDA' }),
        select: {
          id: true,
          numero: true,
          montoSolicitado: true,
          fechaRespuesta: true,
          supplier: { select: { name: true } },
          motivo: true
        },
        orderBy: { fechaRespuesta: 'desc' },
        take: 10
      })),
      // Stock sin existencia (top 10)
      safeFind(() => prisma.$queryRaw<any[]>`
        SELECT
          si.id,
          si.name,
          si.code,
          si."stockMinimo" as "stockMinimo",
          s.cantidad as "stockActual",
          sup.name as "proveedorNombre"
        FROM "SupplierItem" si
        JOIN "Stock" s ON s."supplierItemId" = si.id
        LEFT JOIN "Supplier" sup ON sup.id = si."supplierId"
        WHERE si."companyId" = ${companyId}
          AND s.cantidad <= 0
          AND si.activo = true
        ORDER BY si.name
        LIMIT 10
      `),
    ]);

    // Construir respuesta base
    const response: any = {
      recepciones: {
        sinConfirmar: recepcionesSinConfirmar,
        sinFactura: recepcionesSinFactura,
        porRegularizar: recepcionesPorRegularizar,
        conDiferencias: recepcionesConDiferencias,
        calidadRechazada: recepcionesCalidadRechazada,
      },
      facturas: {
        matchBlocked: facturasMatchBlocked,
        matchPending: facturasMatchPending,
        matchWarning: facturasMatchWarning,
        porVencer7Dias: facturasPorVencer,
        vencidas: facturasVencidas,
        duplicadasSospechosas: duplicadasSospechosas.length,
        sinValidar: facturasSinValidar,
        sinIngreso: facturasSinIngreso,
        matchSinResolver: matchSinResolver,
        // Montos agregados
        montos: {
          vencidas: Number(montoFacturasVencidas._sum?.total || 0),
          porVencer: Number(montoFacturasPorVencer._sum?.total || 0),
        }
      },
      solicitudesNca: {
        nuevas: solicitudesNcaNuevas,
        enviadas: solicitudesNcaEnviadas,
        esperandoRespuesta: solicitudesNcaEsperandoRespuesta,
        ncaPorAplicar: ncaPorAplicar,
        ncaSinAplicar7Dias: ncaSinAplicar7Dias,
      },
      prontoPago: {
        disponibleHoy: prontoPagoDisponibleHoy,
        venceEn3Dias: prontoPagoVence3Dias,
        venceEn7Dias: prontoPagoVence7Dias,
        vencido: prontoPagoVencido
      },
      ordenesCompra: {
        pendienteEntrega: ocPendienteEntrega,
        parcialmenteRecibidas: ocParcialmenteRecibidas,
        atrasadas: ocAtrasadas,
        sinRecepcionMas15Dias: ocSinRecepcionMas15Dias,
        pendientesAprobacion: ocPendientesAprobacion,
      },
      pagos: {
        listasParaPagar: facturasListasParaPagar,
        bloqueadas: facturasBloqueadas,
        programados: pagosProgramados,
        // Montos agregados
        montos: {
          listasParaPagar: Number(montoListasParaPagar._sum?.total || 0),
          bloqueadas: Number(montoBloqueadas._sum?.total || 0),
        }
      },
      devoluciones: {
        borrador: devolucionesBorrador,
        pendientesEnvio: devolucionesPendientesEnvio,
        enviadas: devolucionesEnviadas,
        enEvaluacion: devolucionesEnEvaluacion,
        sinNca: devolucionesSinNca,
        total: devolucionesBorrador + devolucionesPendientesEnvio + devolucionesEnviadas + devolucionesEnEvaluacion
      },
      stock: {
        bajoMinimo: stockBajoMinimo,
        sinExistencia: stockSinExistencia,
        sugerenciasReposicion: sugerenciasReposicionPendientes,
        ajustesPendientes: ajustesStockPendientes,
        transferenciasEnTransito: transferenciasEnTransito,
      },
      alertas: {
        comprasRapidasFrecuentes: comprasRapidasFrecuentes.length,
        duplicadosSospechosos: duplicadasSospechosas.length,
        pagosForzados: pagosForzados,
        detalles: {
          comprasRapidas: comprasRapidasFrecuentes,
          duplicados: duplicadasSospechosas.slice(0, 5)
        }
      },
      resumen: {
        totalPendientes:
          recepcionesSinConfirmar +
          recepcionesPorRegularizar +
          facturasMatchBlocked +
          facturasMatchPending +
          facturasSinValidar +
          facturasSinIngreso +
          solicitudesNcaNuevas +
          solicitudesNcaEnviadas +
          devolucionesBorrador +
          devolucionesPendientesEnvio +
          ocPendientesAprobacion +
          ajustesStockPendientes,
        urgente:
          facturasVencidas +
          ocAtrasadas +
          prontoPagoVence3Dias +
          recepcionesConDiferencias +
          recepcionesCalidadRechazada +
          devolucionesSinNca +
          stockSinExistencia +
          matchSinResolver +
          ncaSinAplicar7Dias,
        requiereAtencion:
          facturasMatchWarning +
          prontoPagoVence7Dias +
          ocSinRecepcionMas15Dias +
          ocPendientesAprobacion +
          duplicadasSospechosas.length +
          stockBajoMinimo +
          sugerenciasReposicionPendientes +
          facturasSinValidar +
          facturasSinIngreso +
          transferenciasEnTransito +
          ajustesStockPendientes,
        // Monto total urgente
        montoUrgente: Number(montoFacturasVencidas._sum?.total || 0),
      },
      // Listas de detalle para acción rápida
      detalles: {
        facturasVencidas: topFacturasVencidas.map((f: any) => ({
          id: f.id,
          numero: `${f.tipo || 'FC'} ${f.numeroFactura}`,
          proveedor: f.supplier?.name || 'Sin proveedor',
          monto: Number(f.total),
          vencimiento: f.fechaVencimiento?.toISOString(),
        })),
        ocsAtrasadas: topOcsAtrasadas.map((oc: any) => ({
          id: oc.id,
          numero: oc.numero,
          proveedor: oc.supplier?.name || 'Sin proveedor',
          monto: Number(oc.total),
          fechaEntrega: oc.fechaEntregaEsperada?.toISOString(),
        })),
        listasParaPagar: topListasParaPagar.map((f: any) => ({
          id: f.id,
          numero: `${f.tipo || 'FC'} ${f.numeroFactura}`,
          proveedor: f.supplier?.name || 'Sin proveedor',
          monto: Number(f.total),
          vencimiento: f.fechaVencimiento?.toISOString(),
        })),
        // === NUEVAS LISTAS ===
        recepcionesSinConfirmar: listaRecepcionesSinConfirmar.map((r: any) => ({
          id: r.id,
          numero: r.numero,
          proveedor: r.supplier?.name || 'Sin proveedor',
          oc: r.purchaseOrder?.numero || null,
          fecha: r.fechaRecepcion?.toISOString(),
          items: r._count?.items || 0,
        })),
        recepcionesConDiferencias: listaRecepcionesConDiferencias.map((r: any) => ({
          id: r.id,
          numero: r.numero,
          proveedor: r.supplier?.name || 'Sin proveedor',
          oc: r.purchaseOrder?.numero || null,
          fecha: r.fechaRecepcion?.toISOString(),
        })),
        facturasMatchBlocked: listaFacturasMatchBlocked.map((f: any) => ({
          id: f.id,
          numero: `${f.tipo || 'FC'} ${f.numeroFactura}`,
          proveedor: f.supplier?.name || 'Sin proveedor',
          monto: Number(f.total),
          fecha: f.fechaEmision?.toISOString(),
        })),
        facturasPorVencer: listaFacturasPorVencer.map((f: any) => ({
          id: f.id,
          numero: `${f.tipo || 'FC'} ${f.numeroFactura}`,
          proveedor: f.supplier?.name || 'Sin proveedor',
          monto: Number(f.total),
          vencimiento: f.fechaVencimiento?.toISOString(),
        })),
        ocsPendientesAprobacion: listaOcsPendientesAprobacion.map((oc: any) => ({
          id: oc.id,
          numero: oc.numero,
          proveedor: oc.supplier?.name || 'Sin proveedor',
          monto: Number(oc.total),
          fecha: oc.createdAt?.toISOString(),
          solicitante: oc.createdByUser?.name || null,
        })),
        ocsParciales: listaOcsParciales.map((oc: any) => ({
          id: oc.id,
          numero: oc.numero,
          proveedor: oc.supplier?.name || 'Sin proveedor',
          monto: Number(oc.total),
          fechaEntrega: oc.fechaEntregaEsperada?.toISOString(),
          recepciones: oc._count?.goodsReceipts || 0,
        })),
        pagosBloqueados: listaPagosBloqueados.map((f: any) => ({
          id: f.id,
          numero: `${f.tipo || 'FC'} ${f.numeroFactura}`,
          proveedor: f.supplier?.name || 'Sin proveedor',
          monto: Number(f.total),
          vencimiento: f.fechaVencimiento?.toISOString(),
        })),
        ncaPorAplicar: listaNcaPorAplicar.map((n: any) => ({
          id: n.id,
          numero: n.numero,
          proveedor: n.supplier?.name || 'Sin proveedor',
          monto: Number(n.montoSolicitado || 0),
          fecha: n.fechaRespuesta?.toISOString(),
          motivo: n.motivo || null,
        })),
        stockSinExistencia: listaStockSinExistencia.map((s: any) => ({
          id: Number(s.id),
          nombre: s.name,
          codigo: s.code,
          proveedor: s.proveedorNombre || 'Sin proveedor',
          stockMinimo: Number(s.stockMinimo || 0),
        })),
      },
    };

    // En modo extendido, agregar split T1/T2
    if (viewMode === 'E') {
      const [t1Vencidas, t2Vencidas, t1ListasPagar, t2ListasPagar] = await Promise.all([
        safeCount(() => prisma.purchaseReceipt.count({
          where: { companyId, docType: 'T1', estado: 'pendiente', fechaVencimiento: { lt: hoy } }
        })),
        safeCount(() => prisma.purchaseReceipt.count({
          where: { companyId, docType: 'T2', estado: 'pendiente', fechaVencimiento: { lt: hoy } }
        })),
        safeCount(() => prisma.purchaseReceipt.count({
          where: { companyId, docType: 'T1', estado: 'pendiente', facturaValidada: true, matchStatus: 'MATCH_OK' }
        })),
        safeCount(() => prisma.purchaseReceipt.count({
          where: { companyId, docType: 'T2', estado: 'pendiente', facturaValidada: true, matchStatus: 'MATCH_OK' }
        })),
      ]);

      response._split = {
        facturas: {
          vencidas: { t1: t1Vencidas, t2: t2Vencidas },
          listasPagar: { t1: t1ListasPagar, t2: t2ListasPagar },
        }
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching torre control data:', error);
    return NextResponse.json(
      { error: 'Error al obtener datos de la torre de control' },
      { status: 500 }
    );
  }
}

// Función para detectar facturas potencialmente duplicadas
async function detectarFacturasDuplicadas(companyId: number, viewMode: any): Promise<any[]> {
  try {
    // Criterio 1: Mismo número de factura exacto del mismo proveedor
    const duplicadosPorNumero = await prisma.$queryRaw<any[]>`
      SELECT
        f1.id as factura1_id,
        f2.id as factura2_id,
        f1."proveedorId",
        f1."numeroFactura",
        f1."numeroSerie",
        f1.total,
        'NUMERO_EXACTO' as criterio,
        95 as confianza
      FROM "PurchaseReceipt" f1
      INNER JOIN "PurchaseReceipt" f2 ON
        f1."proveedorId" = f2."proveedorId" AND
        f1."numeroFactura" = f2."numeroFactura" AND
        f1."numeroSerie" = f2."numeroSerie" AND
        f1.id < f2.id
      WHERE f1."companyId" = ${companyId}
        AND f1.estado != 'ANULADA'
        AND f2.estado != 'ANULADA'
      LIMIT 10
    `;

    // Criterio 2: Mismo proveedor + mismo total + fecha cercana (5 días)
    const duplicadosPorTotalFecha = await prisma.$queryRaw<any[]>`
      SELECT
        f1.id as factura1_id,
        f2.id as factura2_id,
        f1."proveedorId",
        f1.total,
        f1."fechaEmision" as fecha1,
        f2."fechaEmision" as fecha2,
        'TOTAL_FECHA_CERCANA' as criterio,
        60 as confianza
      FROM "PurchaseReceipt" f1
      INNER JOIN "PurchaseReceipt" f2 ON
        f1."proveedorId" = f2."proveedorId" AND
        f1.total = f2.total AND
        f1.id < f2.id AND
        ABS(EXTRACT(DAY FROM f1."fechaEmision" - f2."fechaEmision")) <= 5
      WHERE f1."companyId" = ${companyId}
        AND f1.estado != 'ANULADA'
        AND f2.estado != 'ANULADA'
        -- Excluir los que ya detectamos por número
        AND NOT EXISTS (
          SELECT 1 FROM "PurchaseReceipt" f3
          WHERE f3.id = f2.id
          AND f3."numeroFactura" = f1."numeroFactura"
          AND f3."numeroSerie" = f1."numeroSerie"
        )
      LIMIT 10
    `;

    return [...duplicadosPorNumero, ...duplicadosPorTotalFecha];
  } catch (error) {
    console.error('Error detectando duplicados:', error);
    return [];
  }
}
