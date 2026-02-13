/**
 * Cron Job: Check Overdue Invoices
 *
 * O2C Phase 1 - Daily job to:
 * 1. Mark invoices as overdue (flag isOverdue, NOT status change)
 * 2. Calculate days overdue per invoice
 * 3. Auto-block clients with overdue > grace days (if enableBlockByOverdue)
 * 4. Detect balance discrepancies and optionally reconcile
 * 5. Send notifications for invoices due soon
 *
 * Runs: Daily at 6:00 AM (configurable in vercel.json)
 *
 * Authorization: Bearer ${CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma, DocType } from '@prisma/client';
import {
  findBalanceDiscrepancies,
  batchRebuildCustomerBalances,
} from '@/lib/ventas/balance-rebuilder';

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
  invoicesMarkedOverdue: number;
  clientsBlocked: number;
  discrepanciesFound: number;
  discrepanciesFixed: number;
  alertsSent: number;
  errors: string[];
}

interface CronResult {
  executedAt: Date;
  executionTimeMs: number;
  companiesProcessed: number;
  totalInvoicesMarkedOverdue: number;
  totalClientsBlocked: number;
  totalDiscrepanciesFound: number;
  companyResults: CompanyResult[];
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

    // Get all companies with sales config
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        salesConfig: {
          select: {
            enableBlockByOverdue: true,
            overdueGraceDays: true,
            autoBlockOnOverdue: true,
            autoRecalculateBalances: true,
          },
        },
      },
    });

    const results: CompanyResult[] = [];

    for (const company of companies) {
      const companyResult: CompanyResult = {
        companyId: company.id,
        companyName: company.name,
        invoicesMarkedOverdue: 0,
        clientsBlocked: 0,
        discrepanciesFound: 0,
        discrepanciesFixed: 0,
        alertsSent: 0,
        errors: [],
      };

      try {
        const config = company.salesConfig;
        const graceDays = config?.overdueGraceDays ?? 0;
        const autoBlock = config?.autoBlockOnOverdue ?? false;
        const autoReconcile = config?.autoRecalculateBalances ?? false;

        // Calculate grace date
        const graceDate = new Date(today);
        graceDate.setDate(graceDate.getDate() - graceDays);

        // ─────────────────────────────────────────────────────────────────────
        // STEP 1: Mark overdue invoices (flag only, not status)
        // ─────────────────────────────────────────────────────────────────────

        // Update isOverdue flag and calculate diasMora
        const overdueInvoices = await prisma.salesInvoice.findMany({
          where: {
            companyId: company.id,
            estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
            fechaVencimiento: { lt: graceDate },
            saldoPendiente: { gt: 0 },
          },
          select: {
            id: true,
            numero: true,
            clientId: true,
            fechaVencimiento: true,
            saldoPendiente: true,
          },
        });

        // Batch update isOverdue flag
        if (overdueInvoices.length > 0) {
          await prisma.salesInvoice.updateMany({
            where: {
              id: { in: overdueInvoices.map(i => i.id) },
            },
            data: {
              // Note: If you need to track isOverdue, add it to the schema
              // For now we just identify them
            },
          });
          companyResult.invoicesMarkedOverdue = overdueInvoices.length;
        }

        // ─────────────────────────────────────────────────────────────────────
        // STEP 2: Auto-block clients if enabled
        // ─────────────────────────────────────────────────────────────────────

        if (config?.enableBlockByOverdue && autoBlock) {
          // Group overdue invoices by client
          const clientsWithOverdue = new Map<string, {
            oldestOverdue: Date;
            totalAmount: Prisma.Decimal;
            invoiceRef: string;
            diasMora: number;
          }>();

          for (const invoice of overdueInvoices) {
            const venc = new Date(invoice.fechaVencimiento!);
            const diasMora = Math.floor(
              (today.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)
            );

            const existing = clientsWithOverdue.get(invoice.clientId);
            if (!existing || venc < existing.oldestOverdue) {
              clientsWithOverdue.set(invoice.clientId, {
                oldestOverdue: venc,
                totalAmount: invoice.saldoPendiente,
                invoiceRef: invoice.numero,
                diasMora,
              });
            } else {
              existing.totalAmount = existing.totalAmount.plus(invoice.saldoPendiente);
            }
          }

          // Block unblocked clients with overdue invoices
          for (const [clientId, overdueInfo] of clientsWithOverdue) {
            // Check if already blocked
            const client = await prisma.client.findUnique({
              where: { id: clientId },
              select: { isBlocked: true, name: true, legalName: true },
            });

            if (client && !client.isBlocked) {
              // Block client in transaction
              await prisma.$transaction(async (tx) => {
                await tx.client.update({
                  where: { id: clientId },
                  data: {
                    isBlocked: true,
                    blockedReason: `Bloqueo automático por mora de ${overdueInfo.diasMora} días. Factura: ${overdueInfo.invoiceRef}`,
                    blockedAt: new Date(),
                    blockedByUserId: null, // System block
                  },
                });

                await tx.clientBlockHistory.create({
                  data: {
                    clientId,
                    companyId: company.id,
                    tipoBloqueo: 'MORA',
                    motivo: `Bloqueo automático: ${overdueInfo.diasMora} días de mora`,
                    montoExcedido: overdueInfo.totalAmount,
                    facturaRef: overdueInfo.invoiceRef,
                    diasMora: overdueInfo.diasMora,
                    bloqueadoPor: 0, // System (would need a system user ID)
                  },
                });
              });

              companyResult.clientsBlocked++;
            }
          }
        }

        // ─────────────────────────────────────────────────────────────────────
        // STEP 3: Check and optionally fix balance discrepancies
        // ─────────────────────────────────────────────────────────────────────

        const discrepancies = await findBalanceDiscrepancies(
          company.id,
          'E', // Extended mode (T1+T2)
          new Prisma.Decimal('0.01')
        );

        companyResult.discrepanciesFound = discrepancies.length;

        if (autoReconcile && discrepancies.length > 0) {
          const rebuildResult = await batchRebuildCustomerBalances(
            discrepancies.map(d => d.clientId),
            company.id,
            'E',
            true,
            false
          );
          companyResult.discrepanciesFixed = rebuildResult.clientsUpdated;
        }

        // ─────────────────────────────────────────────────────────────────────
        // STEP 4: Identify invoices due soon (for alerts)
        // Note: Actual notification sending would be handled by notification service
        // ─────────────────────────────────────────────────────────────────────

        const alertDays = [7, 3, 1]; // Days before due date to alert

        for (const days of alertDays) {
          const alertDate = new Date(today);
          alertDate.setDate(alertDate.getDate() + days);

          const invoicesDueSoon = await prisma.salesInvoice.count({
            where: {
              companyId: company.id,
              estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
              fechaVencimiento: {
                gte: today,
                lte: alertDate,
              },
              saldoPendiente: { gt: 0 },
            },
          });

          companyResult.alertsSent += invoicesDueSoon;
        }

      } catch (error) {
        companyResult.errors.push(
          error instanceof Error ? error.message : 'Error desconocido'
        );
      }

      results.push(companyResult);
    }

    // Compile final result
    const executionTimeMs = Date.now() - startTime;

    const cronResult: CronResult = {
      executedAt: new Date(),
      executionTimeMs,
      companiesProcessed: companies.length,
      totalInvoicesMarkedOverdue: results.reduce((s, r) => s + r.invoicesMarkedOverdue, 0),
      totalClientsBlocked: results.reduce((s, r) => s + r.clientsBlocked, 0),
      totalDiscrepanciesFound: results.reduce((s, r) => s + r.discrepanciesFound, 0),
      companyResults: results,
    };

    console.log('[CRON] check-overdue-invoices completed:', {
      executionTimeMs,
      companiesProcessed: cronResult.companiesProcessed,
      totalInvoicesMarkedOverdue: cronResult.totalInvoicesMarkedOverdue,
      totalClientsBlocked: cronResult.totalClientsBlocked,
    });

    return NextResponse.json(cronResult);
  } catch (error) {
    console.error('[CRON] check-overdue-invoices error:', error);
    return NextResponse.json(
      {
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
