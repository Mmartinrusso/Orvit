import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { differenceInDays, subMonths } from 'date-fns';
export const dynamic = 'force-dynamic';

interface ClientScore {
  clientId: string;
  score: number; // 0-100
  category: 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'RIESGO';
  breakdown: {
    punctuality: number; // 0-40
    volume: number; // 0-30
    seniority: number; // 0-15
    consistency: number; // 0-10
    profitability: number; // 0-5
  };
  badges: string[];
}

// GET: Obtener score de un cliente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);
    const { id: clientId } = await params;

    // Verificar que el cliente existe
    const client = await prisma.client.findFirst({
      where: { id: clientId, companyId },
      select: {
        id: true,
        createdAt: true,
        currentBalance: true,
        creditLimit: true,
        isBlocked: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const now = new Date();
    const last6Months = subMonths(now, 6);
    const last12Months = subMonths(now, 12);

    // ===== 1. PUNTUALIDAD (40 puntos) =====
    // % de facturas pagadas a tiempo en los últimos 6 meses
    const recentInvoices = await prisma.salesInvoice.findMany({
      where: applyViewMode(
        {
          clientId,
          companyId,
          fechaEmision: { gte: last6Months },
          estado: { notIn: ['CANCELADA', 'ANULADA'] },
        },
        viewMode
      ),
      select: {
        id: true,
        fechaEmision: true,
        fechaVencimiento: true,
        saldoPendiente: true,
        estado: true,
      },
    });

    const paidInvoices = recentInvoices.filter(
      (inv) => Number(inv.saldoPendiente || 0) === 0 || inv.estado === 'COBRADA'
    );

    let punctualityScore = 0;
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
        (ip) => ip.payment && ip.payment.clientId === clientId && ip.payment.companyId === companyId && ip.payment.estado === 'CONFIRMADO'
      );

      const invoicePaymentDates = new Map<number, Date>();
      validPayments.forEach((ip) => {
        if (!invoicePaymentDates.has(ip.invoiceId)) {
          invoicePaymentDates.set(ip.invoiceId, ip.payment.fechaPago);
        }
      });

      let paidOnTime = 0;
      paidInvoices.forEach((inv) => {
        const paymentDate = invoicePaymentDates.get(inv.id);
        if (paymentDate && inv.fechaVencimiento) {
          if (paymentDate <= inv.fechaVencimiento) {
            paidOnTime++;
          }
        }
      });

      const punctualityRate = (paidOnTime / paidInvoices.length) * 100;
      punctualityScore = (punctualityRate / 100) * 40; // Max 40 puntos
    } else {
      // Si no tiene facturas pagadas, dar un score neutro de 20 puntos
      punctualityScore = 20;
    }

    // ===== 2. VOLUMEN (30 puntos) =====
    // Facturación en los últimos 12 meses vs top cliente
    const clientRevenue = await prisma.salesInvoice.aggregate({
      where: applyViewMode(
        {
          clientId,
          companyId,
          fechaEmision: { gte: last12Months },
          estado: { notIn: ['CANCELADA', 'ANULADA'] },
        },
        viewMode
      ),
      _sum: {
        total: true,
      },
    });

    const totalRevenue = Number(clientRevenue._sum.total || 0);

    // Obtener el top cliente para normalizar
    const topClient = await prisma.salesInvoice.groupBy({
      by: ['clientId'],
      where: applyViewMode(
        {
          companyId,
          fechaEmision: { gte: last12Months },
          estado: { notIn: ['CANCELADA', 'ANULADA'] },
        },
        viewMode
      ),
      _sum: {
        total: true,
      },
      orderBy: {
        _sum: {
          total: 'desc',
        },
      },
      take: 1,
    });

    const topClientRevenue = topClient.length > 0 ? Number(topClient[0]._sum.total || 0) : 1;
    const volumeScore = Math.min((totalRevenue / topClientRevenue) * 30, 30); // Max 30 puntos

    // ===== 3. ANTIGÜEDAD (15 puntos) =====
    // Meses como cliente (max 5 años = 60 meses)
    const daysSinceCreation = differenceInDays(now, client.createdAt);
    const monthsSinceCreation = daysSinceCreation / 30;
    const seniorityScore = Math.min((monthsSinceCreation / 60) * 15, 15); // Max 15 puntos

    // ===== 4. CONSISTENCIA (10 puntos) =====
    // Cantidad de meses con compras en los últimos 12 meses
    const monthlyInvoices = await prisma.salesInvoice.findMany({
      where: applyViewMode(
        {
          clientId,
          companyId,
          fechaEmision: { gte: last12Months },
          estado: { notIn: ['CANCELADA', 'ANULADA'] },
        },
        viewMode
      ),
      select: {
        fechaEmision: true,
      },
    });

    const monthsWithSales = new Set(
      monthlyInvoices.map((inv) => inv.fechaEmision.toISOString().substring(0, 7))
    );
    const consistencyScore = (monthsWithSales.size / 12) * 10; // Max 10 puntos

    // ===== 5. RENTABILIDAD (5 puntos) =====
    // TODO: Calcular margen promedio obtenido del cliente
    // Por ahora, asignar un score promedio
    const profitabilityScore = 2.5;

    // ===== SCORE TOTAL =====
    const totalScore = Math.round(
      punctualityScore + volumeScore + seniorityScore + consistencyScore + profitabilityScore
    );

    // Determinar categoría
    let category: 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'RIESGO';
    if (totalScore >= 90) category = 'EXCELENTE';
    else if (totalScore >= 75) category = 'BUENO';
    else if (totalScore >= 60) category = 'REGULAR';
    else category = 'RIESGO';

    // ===== BADGES =====
    const badges: string[] = [];
    if (punctualityScore >= 35) badges.push('Pagador Puntual');
    if (volumeScore >= 25) badges.push('Alto Volumen');
    if (seniorityScore >= 12) badges.push('Cliente Leal');
    if (consistencyScore >= 8) badges.push('Comprador Frecuente');
    if (client.isBlocked) badges.push('⚠️ Bloqueado');
    if (
      client.creditLimit &&
      Number(client.currentBalance) / Number(client.creditLimit) >= 0.8
    ) {
      badges.push('⚠️ Cerca del Límite');
    }

    const response: ClientScore = {
      clientId,
      score: totalScore,
      category,
      breakdown: {
        punctuality: Math.round(punctualityScore * 100) / 100,
        volume: Math.round(volumeScore * 100) / 100,
        seniority: Math.round(seniorityScore * 100) / 100,
        consistency: Math.round(consistencyScore * 100) / 100,
        profitability: Math.round(profitabilityScore * 100) / 100,
      },
      badges,
    };

    const headers = new Headers();
    headers.set('Cache-Control', 'private, max-age=600, stale-while-revalidate=1200'); // 10 min cache

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error('Error calculando score de cliente:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
