/**
 * Cron Job: Vencimientos Check (Ventas)
 *
 * Daily job that checks for upcoming and overdue sales deadlines:
 * 1. Facturas (SalesInvoice) that are due in N days (default: 3)
 * 2. Cheques that are due tomorrow (default: 1 day)
 * 3. Cotizaciones (Quote) that expire in N days (default: 7)
 *
 * Creates in-app notifications for responsible users in each company.
 *
 * Runs: Daily at 7:00 AM
 * Authorization: Bearer ${CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createNotification,
  createBulkNotifications,
  getCompanyAdminIds,
  isDuplicateNotification,
} from '@/lib/notifications/notification-service';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════════

function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return process.env.NODE_ENV === 'development';
  }

  return authHeader === `Bearer ${cronSecret}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CompanyResult {
  companyId: number;
  companyName: string;
  invoicesDueSoon: number;
  invoicesOverdue: number;
  chequesDueSoon: number;
  chequesOverdue: number;
  quotesExpiring: number;
  notificationsSent: number;
  errors: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    if (!verifyCronAuth(request)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all active companies
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        salesConfig: {
          select: {
            diasRecordatorioFactura: true,
            diasValidezCotizacion: true,
          },
        },
      },
    });

    const results: CompanyResult[] = [];

    for (const company of companies) {
      const result: CompanyResult = {
        companyId: company.id,
        companyName: company.name,
        invoicesDueSoon: 0,
        invoicesOverdue: 0,
        chequesDueSoon: 0,
        chequesOverdue: 0,
        quotesExpiring: 0,
        notificationsSent: 0,
        errors: [],
      };

      try {
        const adminIds = await getCompanyAdminIds(company.id);
        if (adminIds.length === 0) {
          result.errors.push('No admin users found');
          results.push(result);
          continue;
        }

        // ─────────────────────────────────────────────────────────────────────
        // 1. FACTURAS - Due soon (3 days default)
        // ─────────────────────────────────────────────────────────────────────
        const invoiceDaysBefore = company.salesConfig?.diasRecordatorioFactura ?? 3;
        const invoiceDueDate = new Date(today);
        invoiceDueDate.setDate(invoiceDueDate.getDate() + invoiceDaysBefore);

        const invoicesDueSoon = await prisma.salesInvoice.findMany({
          where: {
            companyId: company.id,
            estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
            fechaVencimiento: {
              gte: today,
              lte: invoiceDueDate,
            },
            saldoPendiente: { gt: 0 },
          },
          select: {
            id: true,
            numeroCompleto: true,
            saldoPendiente: true,
            fechaVencimiento: true,
            client: { select: { name: true, legalName: true } },
          },
        });

        result.invoicesDueSoon = invoicesDueSoon.length;

        for (const invoice of invoicesDueSoon) {
          const daysLeft = Math.ceil(
            (new Date(invoice.fechaVencimiento).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          const clientName = invoice.client?.legalName || invoice.client?.name || 'Sin cliente';

          // Avoid duplicate notifications
          const isDuplicate = await isDuplicateNotification(
            adminIds[0], company.id, 'invoice_due_soon', 'invoiceId', invoice.id
          );
          if (isDuplicate) continue;

          const res = await createBulkNotifications(
            adminIds,
            company.id,
            'invoice_due_soon',
            `Factura ${invoice.numeroCompleto} vence en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`,
            `La factura ${invoice.numeroCompleto} de ${clientName} por $${Number(invoice.saldoPendiente).toLocaleString('es-AR')} vence el ${new Date(invoice.fechaVencimiento).toLocaleDateString('es-AR')}.`,
            daysLeft <= 1 ? 'high' : 'medium',
            { invoiceId: invoice.id, daysLeft },
            `/ventas/facturas?id=${invoice.id}`
          );
          result.notificationsSent += res.sent;
        }

        // ─────────────────────────────────────────────────────────────────────
        // 2. FACTURAS - Overdue
        // ─────────────────────────────────────────────────────────────────────
        const invoicesOverdue = await prisma.salesInvoice.findMany({
          where: {
            companyId: company.id,
            estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
            fechaVencimiento: { lt: today },
            saldoPendiente: { gt: 0 },
          },
          select: {
            id: true,
            numeroCompleto: true,
            saldoPendiente: true,
            fechaVencimiento: true,
            client: { select: { name: true, legalName: true } },
          },
        });

        result.invoicesOverdue = invoicesOverdue.length;

        for (const invoice of invoicesOverdue) {
          const daysOverdue = Math.floor(
            (today.getTime() - new Date(invoice.fechaVencimiento).getTime()) / (1000 * 60 * 60 * 24)
          );
          const clientName = invoice.client?.legalName || invoice.client?.name || 'Sin cliente';

          // Only notify at specific intervals: 1, 3, 7, 15, 30 days overdue
          if (![1, 3, 7, 15, 30].includes(daysOverdue)) continue;

          const isDuplicate = await isDuplicateNotification(
            adminIds[0], company.id, 'invoice_overdue', 'invoiceId', invoice.id
          );
          if (isDuplicate) continue;

          const res = await createBulkNotifications(
            adminIds,
            company.id,
            'invoice_overdue',
            `Factura ${invoice.numeroCompleto} vencida hace ${daysOverdue} día${daysOverdue !== 1 ? 's' : ''}`,
            `La factura ${invoice.numeroCompleto} de ${clientName} por $${Number(invoice.saldoPendiente).toLocaleString('es-AR')} está vencida desde el ${new Date(invoice.fechaVencimiento).toLocaleDateString('es-AR')}.`,
            daysOverdue >= 7 ? 'urgent' : 'high',
            { invoiceId: invoice.id, daysOverdue },
            `/ventas/facturas?id=${invoice.id}`
          );
          result.notificationsSent += res.sent;
        }

        // ─────────────────────────────────────────────────────────────────────
        // 3. CHEQUES - Due soon (tomorrow)
        // ─────────────────────────────────────────────────────────────────────
        const chequeDueDate = new Date(today);
        chequeDueDate.setDate(chequeDueDate.getDate() + 1);

        const chequesDueSoon = await prisma.cheque.findMany({
          where: {
            companyId: company.id,
            estado: 'CARTERA',
            fechaVencimiento: {
              gte: today,
              lte: chequeDueDate,
            },
          },
          select: {
            id: true,
            numero: true,
            banco: true,
            titular: true,
            importe: true,
            fechaVencimiento: true,
            origen: true,
          },
        });

        result.chequesDueSoon = chequesDueSoon.length;

        for (const cheque of chequesDueSoon) {
          const isDuplicate = await isDuplicateNotification(
            adminIds[0], company.id, 'cheque_due_soon', 'chequeId', cheque.id
          );
          if (isDuplicate) continue;

          const origenLabel = cheque.origen === 'RECIBIDO' ? 'recibido' : 'emitido';
          const res = await createBulkNotifications(
            adminIds,
            company.id,
            'cheque_due_soon',
            `Cheque ${origenLabel} #${cheque.numero} vence mañana`,
            `Cheque ${origenLabel} #${cheque.numero} de ${cheque.titular} (${cheque.banco}) por $${Number(cheque.importe).toLocaleString('es-AR')} vence el ${new Date(cheque.fechaVencimiento).toLocaleDateString('es-AR')}.`,
            'high',
            { chequeId: cheque.id, origen: cheque.origen },
            `/ventas/cheques?id=${cheque.id}`
          );
          result.notificationsSent += res.sent;
        }

        // ─────────────────────────────────────────────────────────────────────
        // 4. CHEQUES - Overdue (in CARTERA past due date)
        // ─────────────────────────────────────────────────────────────────────
        const chequesOverdue = await prisma.cheque.findMany({
          where: {
            companyId: company.id,
            estado: 'CARTERA',
            fechaVencimiento: { lt: today },
          },
          select: {
            id: true,
            numero: true,
            banco: true,
            titular: true,
            importe: true,
            fechaVencimiento: true,
            origen: true,
          },
        });

        result.chequesOverdue = chequesOverdue.length;

        for (const cheque of chequesOverdue) {
          const daysOverdue = Math.floor(
            (today.getTime() - new Date(cheque.fechaVencimiento).getTime()) / (1000 * 60 * 60 * 24)
          );

          // Only notify at 1, 3, 7 days overdue
          if (![1, 3, 7].includes(daysOverdue)) continue;

          const isDuplicate = await isDuplicateNotification(
            adminIds[0], company.id, 'cheque_overdue', 'chequeId', cheque.id
          );
          if (isDuplicate) continue;

          const origenLabel = cheque.origen === 'RECIBIDO' ? 'recibido' : 'emitido';
          const res = await createBulkNotifications(
            adminIds,
            company.id,
            'cheque_overdue',
            `Cheque ${origenLabel} #${cheque.numero} vencido hace ${daysOverdue} día${daysOverdue !== 1 ? 's' : ''}`,
            `Cheque ${origenLabel} #${cheque.numero} de ${cheque.titular} por $${Number(cheque.importe).toLocaleString('es-AR')} está vencido sin depositar.`,
            'urgent',
            { chequeId: cheque.id, daysOverdue, origen: cheque.origen },
            `/ventas/cheques?id=${cheque.id}`
          );
          result.notificationsSent += res.sent;
        }

        // ─────────────────────────────────────────────────────────────────────
        // 5. COTIZACIONES - Expiring in 7 days
        // ─────────────────────────────────────────────────────────────────────
        const quoteDaysBefore = 7;
        const quoteExpiryDate = new Date(today);
        quoteExpiryDate.setDate(quoteExpiryDate.getDate() + quoteDaysBefore);

        const quotesExpiring = await prisma.quote.findMany({
          where: {
            companyId: company.id,
            estado: { in: ['ENVIADA', 'EN_NEGOCIACION', 'BORRADOR'] },
            fechaValidez: {
              gte: today,
              lte: quoteExpiryDate,
            },
          },
          select: {
            id: true,
            numero: true,
            total: true,
            fechaValidez: true,
            sellerId: true,
            client: { select: { name: true, legalName: true } },
          },
        });

        result.quotesExpiring = quotesExpiring.length;

        for (const quote of quotesExpiring) {
          const daysLeft = Math.ceil(
            (new Date(quote.fechaValidez).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          const clientName = quote.client?.legalName || quote.client?.name || 'Sin cliente';

          const isDuplicate = await isDuplicateNotification(
            adminIds[0], company.id, 'quote_expiring', 'quoteId', quote.id
          );
          if (isDuplicate) continue;

          // Notify the seller if assigned, otherwise notify admins
          const notifyUserIds = quote.sellerId
            ? [quote.sellerId, ...adminIds.filter((id) => id !== quote.sellerId)]
            : adminIds;

          const res = await createBulkNotifications(
            notifyUserIds,
            company.id,
            'quote_expiring',
            `Cotización ${quote.numero} vence en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`,
            `La cotización ${quote.numero} para ${clientName} por $${Number(quote.total).toLocaleString('es-AR')} vence el ${new Date(quote.fechaValidez).toLocaleDateString('es-AR')}.`,
            daysLeft <= 2 ? 'high' : 'medium',
            { quoteId: quote.id, daysLeft },
            `/ventas/cotizaciones?id=${quote.id}`
          );
          result.notificationsSent += res.sent;
        }
      } catch (error) {
        result.errors.push(
          error instanceof Error ? error.message : 'Error desconocido'
        );
      }

      results.push(result);
    }

    // Compile summary
    const executionTimeMs = Date.now() - startTime;
    const summary = {
      success: true,
      executedAt: new Date().toISOString(),
      executionTimeMs,
      companiesProcessed: companies.length,
      totals: {
        invoicesDueSoon: results.reduce((s, r) => s + r.invoicesDueSoon, 0),
        invoicesOverdue: results.reduce((s, r) => s + r.invoicesOverdue, 0),
        chequesDueSoon: results.reduce((s, r) => s + r.chequesDueSoon, 0),
        chequesOverdue: results.reduce((s, r) => s + r.chequesOverdue, 0),
        quotesExpiring: results.reduce((s, r) => s + r.quotesExpiring, 0),
        notificationsSent: results.reduce((s, r) => s + r.notificationsSent, 0),
      },
      companyResults: results,
    };

    console.log('[CRON] vencimientos-check completed:', {
      executionTimeMs,
      companiesProcessed: summary.companiesProcessed,
      ...summary.totals,
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error('[CRON] vencimientos-check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno',
        executionTimeMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// POST handler for manual trigger
export async function POST(request: NextRequest) {
  return GET(request);
}
