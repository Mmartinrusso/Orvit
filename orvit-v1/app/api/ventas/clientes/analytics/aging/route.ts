import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { differenceInDays } from 'date-fns';

export const dynamic = 'force-dynamic';

interface AgingBucket {
  range: string;
  days: string;
  amount: number;
  invoiceCount: number;
  percentage: number;
  clients: Array<{
    clientId: string;
    clientName: string;
    amount: number;
  }>;
}

interface ClientAging {
  clientId: string;
  clientName: string;
  email: string;
  sellerId: number | null;
  sellerName: string | null;
  totalPending: number;
  current: number; // No vencido
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days91Plus: number;
  oldestDays: number;
  invoiceCount: number;
}

interface AgingResponse {
  summary: {
    totalPending: number;
    current: number;
    days1_30: number;
    days31_60: number;
    days61_90: number;
    days91Plus: number;
    buckets: AgingBucket[];
  };
  byClient: ClientAging[];
  dsoAverage: number;
}

// GET: Obtener aging report (antigüedad de cuentas por cobrar)
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);
    const { searchParams } = new URL(request.url);

    const sellerId = searchParams.get('sellerId')
      ? parseInt(searchParams.get('sellerId')!, 10)
      : null;
    const includeClients = searchParams.get('includeClients') === 'true';

    const now = new Date();

    // Obtener todas las facturas pendientes
    const pendingInvoices = await prisma.salesInvoice.findMany({
      where: applyViewMode(
        {
          companyId,
          saldoPendiente: { gt: 0 },
          estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
          ...(sellerId && {
            client: {
              sellerId,
            },
          }),
        },
        viewMode
      ),
      select: {
        id: true,
        numero: true,
        clientId: true,
        fecha: true,
        fechaVencimiento: true,
        saldoPendiente: true,
        client: {
          select: {
            legalName: true,
            name: true,
            email: true,
            sellerId: true,
            seller: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Inicializar buckets (rangos de antigüedad)
    const buckets = {
      current: { amount: 0, count: 0, clients: new Map<string, number>() },
      days1_30: { amount: 0, count: 0, clients: new Map<string, number>() },
      days31_60: { amount: 0, count: 0, clients: new Map<string, number>() },
      days61_90: { amount: 0, count: 0, clients: new Map<string, number>() },
      days91Plus: { amount: 0, count: 0, clients: new Map<string, number>() },
    };

    // Mapa para acumular por cliente
    const clientAgingMap = new Map<
      string,
      {
        name: string;
        email: string;
        sellerId: number | null;
        sellerName: string | null;
        total: number;
        current: number;
        days1_30: number;
        days31_60: number;
        days61_90: number;
        days91Plus: number;
        oldestDays: number;
        invoiceCount: number;
      }
    >();

    let totalDso = 0;

    // Procesar cada factura
    pendingInvoices.forEach((invoice) => {
      const saldo = Number(invoice.saldoPendiente || 0);
      const clientDisplayName = invoice.client.legalName || invoice.client.name || 'Sin nombre';

      // Calcular días de vencimiento
      let daysOverdue = 0;
      if (invoice.fechaVencimiento) {
        daysOverdue = differenceInDays(now, invoice.fechaVencimiento);
      }

      totalDso += daysOverdue;

      // Asignar a bucket correspondiente
      let bucket: keyof typeof buckets;
      if (daysOverdue <= 0) {
        bucket = 'current';
      } else if (daysOverdue <= 30) {
        bucket = 'days1_30';
      } else if (daysOverdue <= 60) {
        bucket = 'days31_60';
      } else if (daysOverdue <= 90) {
        bucket = 'days61_90';
      } else {
        bucket = 'days91Plus';
      }

      buckets[bucket].amount += saldo;
      buckets[bucket].count += 1;
      const clientBucketAmount = buckets[bucket].clients.get(invoice.clientId) || 0;
      buckets[bucket].clients.set(invoice.clientId, clientBucketAmount + saldo);

      // Acumular por cliente
      if (!clientAgingMap.has(invoice.clientId)) {
        clientAgingMap.set(invoice.clientId, {
          name: clientDisplayName,
          email: invoice.client.email,
          sellerId: invoice.client.sellerId,
          sellerName: invoice.client.seller?.name || null,
          total: 0,
          current: 0,
          days1_30: 0,
          days31_60: 0,
          days61_90: 0,
          days91Plus: 0,
          oldestDays: 0,
          invoiceCount: 0,
        });
      }

      const clientData = clientAgingMap.get(invoice.clientId)!;
      clientData.total += saldo;
      clientData.invoiceCount += 1;

      switch (bucket) {
        case 'current':
          clientData.current += saldo;
          break;
        case 'days1_30':
          clientData.days1_30 += saldo;
          break;
        case 'days31_60':
          clientData.days31_60 += saldo;
          break;
        case 'days61_90':
          clientData.days61_90 += saldo;
          break;
        case 'days91Plus':
          clientData.days91Plus += saldo;
          break;
      }

      if (daysOverdue > clientData.oldestDays) {
        clientData.oldestDays = daysOverdue;
      }
    });

    const totalPending =
      buckets.current.amount +
      buckets.days1_30.amount +
      buckets.days31_60.amount +
      buckets.days61_90.amount +
      buckets.days91Plus.amount;

    // Construir respuesta de buckets con detalles
    const agingBuckets: AgingBucket[] = [
      {
        range: 'Al día',
        days: '0',
        amount: Math.round(buckets.current.amount * 100) / 100,
        invoiceCount: buckets.current.count,
        percentage: totalPending > 0 ? Math.round((buckets.current.amount / totalPending) * 100) : 0,
        clients: Array.from(buckets.current.clients.entries())
          .map(([clientId, amount]) => ({
            clientId,
            clientName:
              pendingInvoices.find((i) => i.clientId === clientId)?.client.legalName || '',
            amount: Math.round(amount * 100) / 100,
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5), // Top 5 clientes
      },
      {
        range: '1-30 días',
        days: '1-30',
        amount: Math.round(buckets.days1_30.amount * 100) / 100,
        invoiceCount: buckets.days1_30.count,
        percentage:
          totalPending > 0 ? Math.round((buckets.days1_30.amount / totalPending) * 100) : 0,
        clients: Array.from(buckets.days1_30.clients.entries())
          .map(([clientId, amount]) => ({
            clientId,
            clientName:
              pendingInvoices.find((i) => i.clientId === clientId)?.client.legalName || '',
            amount: Math.round(amount * 100) / 100,
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5),
      },
      {
        range: '31-60 días',
        days: '31-60',
        amount: Math.round(buckets.days31_60.amount * 100) / 100,
        invoiceCount: buckets.days31_60.count,
        percentage:
          totalPending > 0 ? Math.round((buckets.days31_60.amount / totalPending) * 100) : 0,
        clients: Array.from(buckets.days31_60.clients.entries())
          .map(([clientId, amount]) => ({
            clientId,
            clientName:
              pendingInvoices.find((i) => i.clientId === clientId)?.client.legalName || '',
            amount: Math.round(amount * 100) / 100,
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5),
      },
      {
        range: '61-90 días',
        days: '61-90',
        amount: Math.round(buckets.days61_90.amount * 100) / 100,
        invoiceCount: buckets.days61_90.count,
        percentage:
          totalPending > 0 ? Math.round((buckets.days61_90.amount / totalPending) * 100) : 0,
        clients: Array.from(buckets.days61_90.clients.entries())
          .map(([clientId, amount]) => ({
            clientId,
            clientName:
              pendingInvoices.find((i) => i.clientId === clientId)?.client.legalName || '',
            amount: Math.round(amount * 100) / 100,
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5),
      },
      {
        range: '+90 días',
        days: '91+',
        amount: Math.round(buckets.days91Plus.amount * 100) / 100,
        invoiceCount: buckets.days91Plus.count,
        percentage:
          totalPending > 0 ? Math.round((buckets.days91Plus.amount / totalPending) * 100) : 0,
        clients: Array.from(buckets.days91Plus.clients.entries())
          .map(([clientId, amount]) => ({
            clientId,
            clientName:
              pendingInvoices.find((i) => i.clientId === clientId)?.client.legalName || '',
            amount: Math.round(amount * 100) / 100,
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5),
      },
    ];

    // Construir respuesta por cliente (opcional)
    const byClient: ClientAging[] = includeClients
      ? Array.from(clientAgingMap.entries())
          .map(([clientId, data]) => ({
            clientId,
            clientName: data.name,
            email: data.email,
            sellerId: data.sellerId,
            sellerName: data.sellerName,
            totalPending: Math.round(data.total * 100) / 100,
            current: Math.round(data.current * 100) / 100,
            days1_30: Math.round(data.days1_30 * 100) / 100,
            days31_60: Math.round(data.days31_60 * 100) / 100,
            days61_90: Math.round(data.days61_90 * 100) / 100,
            days91Plus: Math.round(data.days91Plus * 100) / 100,
            oldestDays: data.oldestDays,
            invoiceCount: data.invoiceCount,
          }))
          .sort((a, b) => b.totalPending - a.totalPending)
      : [];

    // Calcular DSO promedio
    const dsoAverage =
      pendingInvoices.length > 0 ? Math.round(totalDso / pendingInvoices.length) : 0;

    const response: AgingResponse = {
      summary: {
        totalPending: Math.round(totalPending * 100) / 100,
        current: Math.round(buckets.current.amount * 100) / 100,
        days1_30: Math.round(buckets.days1_30.amount * 100) / 100,
        days31_60: Math.round(buckets.days31_60.amount * 100) / 100,
        days61_90: Math.round(buckets.days61_90.amount * 100) / 100,
        days91Plus: Math.round(buckets.days91Plus.amount * 100) / 100,
        buckets: agingBuckets,
      },
      byClient,
      dsoAverage,
    };

    const headers = new Headers();
    headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600'); // 5 min cache

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error('Error obteniendo aging report:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
