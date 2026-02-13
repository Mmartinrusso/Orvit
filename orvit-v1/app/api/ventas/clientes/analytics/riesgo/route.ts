import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { subMonths, differenceInDays } from 'date-fns';

export const dynamic = 'force-dynamic';

type RiskLevel = 'ALTO' | 'MEDIO' | 'BAJO' | 'NINGUNO';

interface RiskFactor {
  factor: string;
  severity: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO';
  description: string;
  value?: number;
}

interface ClientRisk {
  clientId: string;
  clientName: string;
  email: string;
  riskLevel: RiskLevel;
  riskScore: number; // 0-100 (mayor = más riesgo)
  factors: RiskFactor[];
  metrics: {
    creditUtilization: number; // %
    daysOverdue: number;
    overdueAmount: number;
    punctualityRate: number; // %
    paymentTrend: 'deteriorating' | 'stable' | 'improving';
  };
  recommendations: string[];
}

interface RiskResponse {
  summary: {
    totalClients: number;
    alto: number;
    medio: number;
    bajo: number;
    ninguno: number;
    totalAtRisk: number;
    totalExposure: number; // Monto total en riesgo
  };
  clients: ClientRisk[];
}

// GET: Obtener análisis de riesgo de clientes
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);
    const { searchParams } = new URL(request.url);

    const riskLevel = searchParams.get('riskLevel') as RiskLevel | null;
    const limite = parseInt(searchParams.get('limite') || '50', 10);

    const now = new Date();
    const last3Months = subMonths(now, 3);
    const last6Months = subMonths(now, 6);

    // Obtener todos los clientes activos
    const clients = await prisma.client.findMany({
      where: {
        companyId,
        isActive: true,
      },
      select: {
        id: true,
        legalName: true,
        name: true,
        email: true,
        creditLimit: true,
        currentBalance: true,
        isBlocked: true,
        createdAt: true,
      },
    });

    const clientsRisk: ClientRisk[] = [];
    const summary = {
      totalClients: clients.length,
      alto: 0,
      medio: 0,
      bajo: 0,
      ninguno: 0,
      totalAtRisk: 0,
      totalExposure: 0,
    };

    // Procesar cada cliente
    for (const client of clients) {
      const factors: RiskFactor[] = [];
      let riskScore = 0;
      const clientDisplayName = client.legalName || client.name || 'Sin nombre';

      // ========================================
      // FACTORES DE RIESGO
      // ========================================

      // 1. Utilización de crédito
      const creditLimit = Number(client.creditLimit || 0);
      const currentBalance = Number(client.currentBalance || 0);
      const creditUtilization = creditLimit > 0 ? (currentBalance / creditLimit) * 100 : 0;

      if (creditUtilization >= 100) {
        factors.push({
          factor: 'Crédito excedido',
          severity: 'CRITICO',
          description: `Límite excedido en ${((creditUtilization - 100)).toFixed(1)}%`,
          value: creditUtilization,
        });
        riskScore += 35;
      } else if (creditUtilization >= 90) {
        factors.push({
          factor: 'Crédito muy alto',
          severity: 'ALTO',
          description: `Utilizando ${creditUtilization.toFixed(1)}% del límite`,
          value: creditUtilization,
        });
        riskScore += 25;
      } else if (creditUtilization >= 75) {
        factors.push({
          factor: 'Crédito elevado',
          severity: 'MEDIO',
          description: `Utilizando ${creditUtilization.toFixed(1)}% del límite`,
          value: creditUtilization,
        });
        riskScore += 15;
      }

      // 2. Facturas vencidas
      const overdueInvoices = await prisma.salesInvoice.findMany({
        where: applyViewMode(
          {
            clientId: client.id,
            companyId,
            fechaVencimiento: { lt: now },
            saldoPendiente: { gt: 0 },
            estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
          },
          viewMode
        ),
        select: {
          saldoPendiente: true,
          fechaVencimiento: true,
        },
      });

      const overdueAmount = overdueInvoices.reduce(
        (sum, inv) => sum + Number(inv.saldoPendiente || 0),
        0
      );
      const daysOverdue =
        overdueInvoices.length > 0
          ? Math.max(
              ...overdueInvoices.map((inv) =>
                inv.fechaVencimiento ? differenceInDays(now, inv.fechaVencimiento) : 0
              )
            )
          : 0;

      if (daysOverdue > 90) {
        factors.push({
          factor: 'Mora crítica',
          severity: 'CRITICO',
          description: `${daysOverdue} días de mora en $${overdueAmount.toFixed(2)}`,
          value: daysOverdue,
        });
        riskScore += 30;
      } else if (daysOverdue > 60) {
        factors.push({
          factor: 'Mora alta',
          severity: 'ALTO',
          description: `${daysOverdue} días de mora en $${overdueAmount.toFixed(2)}`,
          value: daysOverdue,
        });
        riskScore += 20;
      } else if (daysOverdue > 30) {
        factors.push({
          factor: 'Mora moderada',
          severity: 'MEDIO',
          description: `${daysOverdue} días de mora en $${overdueAmount.toFixed(2)}`,
          value: daysOverdue,
        });
        riskScore += 10;
      }

      // 3. Tasa de puntualidad
      const recentInvoices = await prisma.salesInvoice.findMany({
        where: applyViewMode(
          {
            clientId: client.id,
            companyId,
            fechaEmision: { gte: last6Months },
            estado: { notIn: ['CANCELADA', 'ANULADA'] },
          },
          viewMode
        ),
        select: {
          id: true,
          fechaVencimiento: true,
          saldoPendiente: true,
        },
      });

      const paidInvoices = recentInvoices.filter((inv) => Number(inv.saldoPendiente || 0) === 0);

      let punctualityRate = 100;
      if (paidInvoices.length > 0) {
        // Get payment allocations for these invoices
        const invoicePayments = await prisma.invoicePaymentAllocation.findMany({
          where: {
            invoiceId: { in: paidInvoices.map((inv) => inv.id) },
          },
          select: {
            invoiceId: true,
            payment: {
              select: {
                clientId: true,
                companyId: true,
                estado: true,
                fechaPago: true,
              },
            },
          },
        });

        // Filter in JS to avoid nested relation filter issues
        const validPayments = invoicePayments.filter(
          (ip) => ip.payment.clientId === client.id && ip.payment.companyId === companyId && ip.payment.estado === 'CONFIRMADO'
        );

        const paymentDates = new Map<number, Date>();
        validPayments.forEach((ip) => {
          if (!paymentDates.has(ip.invoiceId)) {
            paymentDates.set(ip.invoiceId, ip.payment.fechaPago);
          }
        });

        let paidOnTime = 0;
        paidInvoices.forEach((inv) => {
          const paymentDate = paymentDates.get(inv.id);
          if (paymentDate && inv.fechaVencimiento && paymentDate <= inv.fechaVencimiento) {
            paidOnTime++;
          }
        });

        punctualityRate = (paidOnTime / paidInvoices.length) * 100;
      }

      if (punctualityRate < 50) {
        factors.push({
          factor: 'Baja puntualidad',
          severity: 'ALTO',
          description: `Solo ${punctualityRate.toFixed(1)}% de pagos a tiempo`,
          value: punctualityRate,
        });
        riskScore += 20;
      } else if (punctualityRate < 70) {
        factors.push({
          factor: 'Puntualidad irregular',
          severity: 'MEDIO',
          description: `${punctualityRate.toFixed(1)}% de pagos a tiempo`,
          value: punctualityRate,
        });
        riskScore += 10;
      }

      // 4. Tendencia de pagos
      const last3MonthsPayments = await prisma.clientPayment.aggregate({
        where: {
          clientId: client.id,
          companyId,
          fechaPago: { gte: last3Months },
          estado: 'CONFIRMADO',
        },
        _sum: {
          totalPago: true,
        },
      });

      const prev3MonthsPayments = await prisma.clientPayment.aggregate({
        where: {
          clientId: client.id,
          companyId,
          fechaPago: { gte: last6Months, lt: last3Months },
          estado: 'CONFIRMADO',
        },
        _sum: {
          totalPago: true,
        },
      });

      const recentPayments = Number(last3MonthsPayments._sum.totalPago || 0);
      const previousPayments = Number(prev3MonthsPayments._sum.totalPago || 0);

      let paymentTrend: 'deteriorating' | 'stable' | 'improving' = 'stable';
      if (previousPayments > 0) {
        const changeRate = ((recentPayments - previousPayments) / previousPayments) * 100;
        if (changeRate < -20) {
          paymentTrend = 'deteriorating';
          factors.push({
            factor: 'Pagos en descenso',
            severity: 'ALTO',
            description: `Reducción del ${Math.abs(changeRate).toFixed(1)}% en pagos`,
            value: changeRate,
          });
          riskScore += 15;
        } else if (changeRate > 20) {
          paymentTrend = 'improving';
        }
      }

      // 5. Cliente bloqueado
      if (client.isBlocked) {
        factors.push({
          factor: 'Cliente bloqueado',
          severity: 'CRITICO',
          description: 'Cuenta bloqueada actualmente',
        });
        riskScore += 40;
      }

      // 6. Inactividad prolongada (sin facturas en 3 meses)
      const daysSinceCreation = differenceInDays(now, client.createdAt);
      if (recentInvoices.length === 0 && daysSinceCreation > 90) {
        factors.push({
          factor: 'Inactividad',
          severity: 'MEDIO',
          description: 'Sin actividad en los últimos 3 meses',
        });
        riskScore += 10;
      }

      // ========================================
      // DETERMINAR NIVEL DE RIESGO
      // ========================================
      let riskLevel: RiskLevel;
      if (riskScore >= 60) {
        riskLevel = 'ALTO';
        summary.alto++;
        summary.totalExposure += currentBalance;
      } else if (riskScore >= 30) {
        riskLevel = 'MEDIO';
        summary.medio++;
        summary.totalExposure += currentBalance * 0.5; // 50% de exposición
      } else if (riskScore >= 10) {
        riskLevel = 'BAJO';
        summary.bajo++;
      } else {
        riskLevel = 'NINGUNO';
        summary.ninguno++;
      }

      // ========================================
      // RECOMENDACIONES
      // ========================================
      const recommendations: string[] = [];
      if (creditUtilization >= 90) {
        recommendations.push('Bloquear nuevas ventas hasta regularizar saldo');
      }
      if (daysOverdue > 60) {
        recommendations.push('Iniciar gestión de cobranza urgente');
        recommendations.push('Evaluar garantías y cheques pendientes');
      }
      if (punctualityRate < 70) {
        recommendations.push('Reducir límite de crédito');
        recommendations.push('Exigir garantías adicionales');
      }
      if (paymentTrend === 'deteriorating') {
        recommendations.push('Contactar para entender cambio en comportamiento');
      }
      if (riskLevel === 'ALTO') {
        recommendations.push('Considerar venta solo contra pago');
        recommendations.push('Evaluar inicio de acciones legales');
      }

      // Solo incluir clientes con algún riesgo
      if (riskLevel !== 'NINGUNO') {
        clientsRisk.push({
          clientId: client.id,
          clientName: clientDisplayName,
          email: client.email,
          riskLevel,
          riskScore: Math.min(riskScore, 100),
          factors,
          metrics: {
            creditUtilization: Math.round(creditUtilization * 100) / 100,
            daysOverdue,
            overdueAmount: Math.round(overdueAmount * 100) / 100,
            punctualityRate: Math.round(punctualityRate * 100) / 100,
            paymentTrend,
          },
          recommendations,
        });
      }
    }

    // Aplicar filtro de nivel de riesgo
    let filteredClients = clientsRisk;
    if (riskLevel) {
      filteredClients = clientsRisk.filter((c) => c.riskLevel === riskLevel);
    }

    // Ordenar por riskScore descendente
    filteredClients.sort((a, b) => b.riskScore - a.riskScore);

    // Limitar resultados
    const limitedClients = filteredClients.slice(0, limite);

    summary.totalAtRisk = summary.alto + summary.medio;

    const response: RiskResponse = {
      summary: {
        ...summary,
        totalExposure: Math.round(summary.totalExposure * 100) / 100,
      },
      clients: limitedClients,
    };

    const headers = new Headers();
    headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600'); // 5 min cache

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error('Error obteniendo análisis de riesgo:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
