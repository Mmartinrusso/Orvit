/**
 * Control Tower API - Dashboard de Control para Compras
 *
 * Proporciona KPIs y métricas consolidadas para el monitoreo
 * del ciclo P2P (Procure-to-Pay) de la empresa.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { getGRNIStats } from '@/lib/compras/grni-helper';
import { getUserAndCompany } from '@/lib/compras/auth-helper';
import { getAllQueuesForUser } from '@/lib/compras/control-tower-queues';
import { getExceptionStats } from '@/lib/compras/match-exception-workflow';
import { differenceInDays, addDays } from 'date-fns';

export const dynamic = 'force-dynamic';

/**
 * Estadísticas de pedidos pendientes de aprobación
 */
async function getPedidosPendientesStats(companyId: number) {
  const pedidos = await prisma.purchaseRequest.findMany({
    where: {
      companyId,
      estado: 'EN_APROBACION',
    },
    include: {
      solicitante: { select: { id: true, name: true } },
    },
    orderBy: [
      { prioridad: 'desc' },
      { createdAt: 'asc' }
    ]
  });

  const hoy = new Date();
  const porPrioridad = { URGENTE: 0, ALTA: 0, MEDIA: 0, BAJA: 0 };
  let totalMonto = 0;
  let totalDias = 0;

  const pedidosConDias = pedidos.map(p => {
    const diasEspera = differenceInDays(hoy, p.createdAt);
    porPrioridad[p.prioridad as keyof typeof porPrioridad] = (porPrioridad[p.prioridad as keyof typeof porPrioridad] || 0) + 1;
    totalMonto += Number(p.presupuestoEstimado || 0);
    totalDias += diasEspera;

    return {
      id: p.id,
      numero: p.numero,
      titulo: p.titulo,
      monto: Number(p.presupuestoEstimado || 0),
      diasEspera,
      solicitante: p.solicitante?.name || 'N/A',
      prioridad: p.prioridad,
    };
  });

  return {
    total: pedidos.length,
    montoTotal: totalMonto,
    porPrioridad,
    antiguedadPromedio: pedidos.length > 0 ? Math.round(totalDias / pedidos.length) : 0,
    pedidosUrgentes: pedidosConDias
      .filter(p => p.prioridad === 'URGENTE' || p.prioridad === 'ALTA')
      .slice(0, 10),
  };
}

/**
 * Estadísticas de excepciones de match
 */
async function getMatchExceptionStats(companyId: number, docType: string | null) {
  const whereClause: any = {
    matchResult: {
      companyId,
      ...(docType && { docType }),
    },
    resuelta: false,
  };

  const excepciones = await prisma.matchException.findMany({
    where: whereClause,
    include: {
      matchResult: {
        select: {
          id: true,
          facturaId: true,
          ordenCompraId: true,
        }
      }
    }
  });

  const porTipo: Record<string, number> = {};
  let montoAfectado = 0;
  let totalDias = 0;
  const hoy = new Date();

  for (const ex of excepciones) {
    porTipo[ex.tipo] = (porTipo[ex.tipo] || 0) + 1;
    montoAfectado += Number(ex.montoAfectado || 0);
    totalDias += differenceInDays(hoy, ex.createdAt);
  }

  return {
    total: excepciones.length,
    porTipo,
    montoAfectado,
    antiguedadPromedio: excepciones.length > 0 ? Math.round(totalDias / excepciones.length) : 0,
  };
}

/**
 * Estadísticas de pagos bloqueados/pendientes
 */
async function getPagosBloqueadosStats(companyId: number) {
  // Facturas bloqueadas por match
  const facturasBloqueadas = await prisma.purchaseReceipt.findMany({
    where: {
      companyId,
      matchStatus: 'MATCH_BLOCKED',
      estado: { not: 'pagada' },
    },
    select: { id: true, total: true },
  });

  // Pagos pendientes de aprobación
  const pagosPendientes = await prisma.paymentOrder.findMany({
    where: {
      companyId,
      estado: 'PENDIENTE_APROBACION',
    },
    select: { id: true, totalPago: true },
  });

  // Cambios bancarios pendientes
  const cambiosBancarios = await prisma.supplierChangeRequest.count({
    where: {
      companyId,
      estado: 'PENDIENTE_APROBACION',
      tipo: 'CAMBIO_BANCARIO',
    },
  });

  const montoFacturasBloqueadas = facturasBloqueadas.reduce(
    (sum, f) => sum + Number(f.total || 0), 0
  );
  const montoPagosPendientes = pagosPendientes.reduce(
    (sum, p) => sum + Number(p.totalPago || 0), 0
  );

  return {
    total: facturasBloqueadas.length + pagosPendientes.length,
    porMotivo: {
      MATCH_BLOQUEADO: facturasBloqueadas.length,
      PENDIENTE_APROBACION: pagosPendientes.length,
      CAMBIO_BANCARIO_PENDIENTE: cambiosBancarios,
    },
    montoRetenido: montoFacturasBloqueadas + montoPagosPendientes,
  };
}

/**
 * Estadísticas de OCs pendientes de recepción
 */
async function getOCsPendientesStats(companyId: number, docType: string | null) {
  const hoy = new Date();
  const en7Dias = addDays(hoy, 7);

  const whereClause: any = {
    companyId,
    estado: { in: ['ENVIADA_PROVEEDOR', 'CONFIRMADA', 'PARCIALMENTE_RECIBIDA'] },
    ...(docType && { docType }),
  };

  const ocs = await prisma.purchaseOrder.findMany({
    where: whereClause,
    select: {
      id: true,
      numero: true,
      total: true,
      fechaEntregaEstimada: true,
      proveedor: { select: { name: true } },
    },
  });

  let montoTotal = 0;
  let vencidas = 0;
  let porVencer = 0;
  const ocsVencidasList: any[] = [];

  for (const oc of ocs) {
    montoTotal += Number(oc.total || 0);
    if (oc.fechaEntregaEstimada) {
      const fechaEntrega = new Date(oc.fechaEntregaEstimada);
      if (fechaEntrega < hoy) {
        vencidas++;
        ocsVencidasList.push({
          id: oc.id,
          numero: oc.numero,
          proveedor: oc.proveedor?.name || 'N/A',
          diasVencida: differenceInDays(hoy, fechaEntrega),
        });
      } else if (fechaEntrega <= en7Dias) {
        porVencer++;
      }
    }
  }

  return {
    total: ocs.length,
    montoTotal,
    vencidas,
    porVencer,
    ocsVencidas: ocsVencidasList.slice(0, 5),
  };
}

/**
 * Oportunidades de pronto pago
 */
async function getProntoPagoOportunidades(companyId: number) {
  const hoy = new Date();

  // Facturas pendientes con pronto pago configurado
  const facturas = await prisma.purchaseReceipt.findMany({
    where: {
      companyId,
      estado: { in: ['pendiente', 'parcial'] },
      prontoPagoAplicado: { not: true },
    },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          prontoPagoDias: true,
          prontoPagoPorcentaje: true,
        }
      }
    }
  });

  let oportunidades = 0;
  let ahorroPotencial = 0;
  const facturasElegibles: any[] = [];

  for (const f of facturas) {
    const diasPP = f.supplier?.prontoPagoDias;
    const pctPP = Number(f.supplier?.prontoPagoPorcentaje || 0);

    if (diasPP && pctPP > 0) {
      const fechaLimite = addDays(f.createdAt, diasPP);
      const diasRestantes = differenceInDays(fechaLimite, hoy);

      if (diasRestantes > 0) {
        const descuento = Number(f.total || 0) * (pctPP / 100);
        oportunidades++;
        ahorroPotencial += descuento;

        facturasElegibles.push({
          id: f.id,
          numero: `${f.tipo || 'FC'} ${f.numeroSerie || ''}-${f.numeroFactura || ''}`,
          monto: Number(f.total || 0),
          descuento,
          diasRestantes,
          proveedor: f.supplier?.name || 'N/A',
        });
      }
    }
  }

  return {
    oportunidades,
    ahorroPotencial,
    facturasElegibles: facturasElegibles.sort((a, b) => a.diasRestantes - b.diasRestantes).slice(0, 5),
  };
}

/**
 * Cambios sensibles pendientes
 */
async function getCambiosSensiblesPendientes(companyId: number) {
  const [cambiosBancarios, pagosPendientes] = await Promise.all([
    prisma.supplierChangeRequest.count({
      where: {
        companyId,
        estado: 'PENDIENTE_APROBACION',
      },
    }),
    prisma.paymentOrder.count({
      where: {
        companyId,
        estado: 'PENDIENTE_APROBACION',
      },
    }),
  ]);

  return {
    cambiosBancarios,
    pagosPendientes,
    aprobacionesPendientes: cambiosBancarios + pagosPendientes,
  };
}

/**
 * GET - Obtener métricas del Control Tower
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndCompany();
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { companyId, userId } = auth;

    const viewMode = getViewMode(request);
    const docType = viewMode === 'E' ? null : 'T1'; // En Extended ver todo, en Standard solo T1

    // Verificar si se solicitan bandejas de trabajo
    const url = new URL(request.url);
    const includeQueues = url.searchParams.get('includeQueues') === 'true';

    // Ejecutar queries en paralelo para mejor performance
    const [pedidos, grni, matchEx, pagosBloq, ocsPend, prontoPago, cambios] = await Promise.all([
      getPedidosPendientesStats(companyId),
      getGRNIStats(companyId, docType, prisma),
      getMatchExceptionStats(companyId, docType),
      getPagosBloqueadosStats(companyId),
      getOCsPendientesStats(companyId, docType),
      getProntoPagoOportunidades(companyId),
      getCambiosSensiblesPendientes(companyId),
    ]);

    // Obtener bandejas de trabajo si se solicitan
    let queues = null;
    let exceptionStats = null;
    if (includeQueues && userId) {
      [queues, exceptionStats] = await Promise.all([
        getAllQueuesForUser(userId, companyId, prisma, docType),
        getExceptionStats(companyId, prisma),
      ]);
    }

    return NextResponse.json({
      pedidosPendientes: pedidos,
      grni,
      matchExceptions: matchEx,
      pagosBloqueados: pagosBloq,
      ocsPendientes: ocsPend,
      prontoPago,
      cambiosSensibles: cambios,
      // Bandejas de trabajo (si se solicitan)
      ...(queues && { queues }),
      ...(exceptionStats && { exceptionStats }),
      docType: docType || 'ALL',
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error en Control Tower API:', error);
    return NextResponse.json(
      { error: 'Error al obtener datos del Control Tower' },
      { status: 500 }
    );
  }
}
