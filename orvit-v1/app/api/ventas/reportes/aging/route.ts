/**
 * Aging Report API - O2C Phase 5
 *
 * Provides accounts receivable aging analysis by client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { applyViewMode, ViewMode } from '@/lib/view-mode';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get aging report
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.REPORTES_AGING);
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const companyId = user!.companyId;
    const clientId = searchParams.get('clientId');
    const asOfDate = searchParams.get('asOfDate');
    const viewMode = (searchParams.get('viewMode') || 'S') as ViewMode;
    const includeDetails = searchParams.get('includeDetails') === 'true';
    const buckets = searchParams.get('buckets') || '30,60,90,120';

    const referenceDate = asOfDate ? new Date(asOfDate) : new Date();
    referenceDate.setHours(0, 0, 0, 0);

    const bucketDays = buckets.split(',').map(Number);
    // Ensure buckets are sorted
    bucketDays.sort((a, b) => a - b);

    // Get all open invoices
    const invoices = await prisma.salesInvoice.findMany({
      where: applyViewMode(
        {
          companyId,
          estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
          saldoPendiente: { gt: 0 },
          ...(clientId && { clientId }),
        },
        viewMode
      ),
      select: {
        id: true,
        numero: true,
        clientId: true,
        fecha: true,
        fechaVencimiento: true,
        total: true,
        saldoPendiente: true,
        client: {
          select: {
            id: true,
            name: true,
            legalName: true,
            creditLimit: true,
            isBlocked: true,
          },
        },
      },
      orderBy: { fechaVencimiento: 'asc' },
    });

    // Calculate aging for each invoice
    interface AgingInvoice {
      id: number;
      numero: string;
      fecha: Date;
      fechaVencimiento: Date;
      total: Prisma.Decimal;
      saldoPendiente: Prisma.Decimal;
      daysOverdue: number;
      bucket: string;
    }

    interface ClientAging {
      clientId: string;
      clientName: string;
      creditLimit: Prisma.Decimal | null;
      isBlocked: boolean;
      current: number;
      buckets: Record<string, number>;
      total: number;
      invoices: AgingInvoice[];
    }

    const clientAgingMap = new Map<string, ClientAging>();

    // Initialize bucket labels
    const bucketLabels: string[] = ['Corriente'];
    for (let i = 0; i < bucketDays.length; i++) {
      const start = i === 0 ? 1 : bucketDays[i - 1] + 1;
      const end = bucketDays[i];
      bucketLabels.push(`${start}-${end}`);
    }
    bucketLabels.push(`>${bucketDays[bucketDays.length - 1]}`);

    for (const invoice of invoices) {
      const client = invoice.client;
      const clientKey = invoice.clientId;

      if (!clientAgingMap.has(clientKey)) {
        const initialBuckets: Record<string, number> = {};
        bucketLabels.forEach((label) => (initialBuckets[label] = 0));

        clientAgingMap.set(clientKey, {
          clientId: clientKey,
          clientName: client.legalName || client.name || clientKey,
          creditLimit: client.creditLimit,
          isBlocked: client.isBlocked,
          current: 0,
          buckets: initialBuckets,
          total: 0,
          invoices: [],
        });
      }

      const clientAging = clientAgingMap.get(clientKey)!;
      const saldo = Number(invoice.saldoPendiente);

      // Calculate days overdue
      const vencimiento = new Date(invoice.fechaVencimiento);
      const daysOverdue = Math.floor(
        (referenceDate.getTime() - vencimiento.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Determine bucket
      let bucket = 'Corriente';
      if (daysOverdue > 0) {
        let found = false;
        for (let i = 0; i < bucketDays.length; i++) {
          if (daysOverdue <= bucketDays[i]) {
            const start = i === 0 ? 1 : bucketDays[i - 1] + 1;
            bucket = `${start}-${bucketDays[i]}`;
            found = true;
            break;
          }
        }
        if (!found) {
          bucket = `>${bucketDays[bucketDays.length - 1]}`;
        }
      }

      // Update client aging
      if (daysOverdue <= 0) {
        clientAging.current += saldo;
      }
      clientAging.buckets[bucket] = (clientAging.buckets[bucket] || 0) + saldo;
      clientAging.total += saldo;

      if (includeDetails) {
        clientAging.invoices.push({
          id: invoice.id,
          numero: invoice.numero,
          fecha: invoice.fecha,
          fechaVencimiento: invoice.fechaVencimiento,
          total: invoice.total,
          saldoPendiente: invoice.saldoPendiente,
          daysOverdue,
          bucket,
        });
      }
    }

    // Convert to array and calculate totals
    const agingByClient = Array.from(clientAgingMap.values());

    // Calculate summary totals
    const summary = {
      current: 0,
      buckets: {} as Record<string, number>,
      total: 0,
      clientCount: agingByClient.length,
      invoiceCount: invoices.length,
    };

    bucketLabels.forEach((label) => (summary.buckets[label] = 0));

    for (const client of agingByClient) {
      summary.current += client.current;
      for (const [bucket, amount] of Object.entries(client.buckets)) {
        summary.buckets[bucket] = (summary.buckets[bucket] || 0) + amount;
      }
      summary.total += client.total;
    }

    // Sort by total descending
    agingByClient.sort((a, b) => b.total - a.total);

    return NextResponse.json({
      asOfDate: referenceDate.toISOString().split('T')[0],
      bucketDays,
      bucketLabels,
      summary,
      clients: agingByClient,
    });
  } catch (error) {
    console.error('Error generating aging report:', error);
    return NextResponse.json(
      { error: 'Error al generar reporte de antigüedad' },
      { status: 500 }
    );
  }
}
