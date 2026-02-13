/**
 * AFIP Pending Queue Processor - O2C Phase 5
 *
 * Cron job to process pending invoices and credit notes for AFIP authorization.
 * Should be called periodically (e.g., every 5 minutes).
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Process pending AFIP authorizations
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    // Verify cron secret for security
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
      invoicesProcessed: 0,
      invoicesAuthorized: 0,
      invoicesRejected: 0,
      creditNotesProcessed: 0,
      creditNotesAuthorized: 0,
      creditNotesRejected: 0,
      errors: [] as string[],
    };

    // Get all companies with active AFIP integration
    const companies = await prisma.afipConfig.findMany({
      where: {
        ambiente: 'PRODUCTION', // Only process production environments
      },
      select: { companyId: true, maxRetries: true, retryDelaySeconds: true },
    });

    for (const company of companies) {
      // Process pending invoices
      const pendingInvoices = await prisma.salesInvoice.findMany({
        where: {
          companyId: company.companyId,
          fiscalStatus: 'PENDING_AFIP',
          afipRetries: { lt: company.maxRetries },
        },
        take: 10, // Process 10 at a time per company
        orderBy: { createdAt: 'asc' },
      });

      for (const invoice of pendingInvoices) {
        results.invoicesProcessed++;

        try {
          // TODO: Call actual AFIP web service
          // For now, simulate authorization
          const authorized = Math.random() > 0.1; // 90% success rate for simulation

          if (authorized) {
            const mockCae = `70${Date.now()}${invoice.id}`;
            const caeVencimiento = new Date();
            caeVencimiento.setDate(caeVencimiento.getDate() + 10);

            await prisma.salesInvoice.update({
              where: { id: invoice.id },
              data: {
                fiscalStatus: 'AUTHORIZED',
                cae: mockCae,
                caeVencimiento,
                afipLastAttempt: new Date(),
                afipResponse: { status: 'OK', cae: mockCae },
              },
            });

            results.invoicesAuthorized++;
          } else {
            await prisma.salesInvoice.update({
              where: { id: invoice.id },
              data: {
                fiscalStatus: 'REJECTED',
                afipRetries: { increment: 1 },
                afipLastAttempt: new Date(),
                afipError: 'AFIP rejection simulated',
                afipResponse: { status: 'ERROR', error: 'Simulated rejection' },
              },
            });

            results.invoicesRejected++;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push(`Invoice ${invoice.numero}: ${message}`);

          await prisma.salesInvoice.update({
            where: { id: invoice.id },
            data: {
              afipRetries: { increment: 1 },
              afipLastAttempt: new Date(),
              afipError: message,
            },
          });
        }
      }

      // Process pending credit/debit notes
      const pendingNotes = await prisma.salesCreditDebitNote.findMany({
        where: {
          companyId: company.companyId,
          fiscalStatus: 'PENDING_AFIP',
          afipRetries: { lt: company.maxRetries },
        },
        take: 10,
        orderBy: { createdAt: 'asc' },
      });

      for (const note of pendingNotes) {
        results.creditNotesProcessed++;

        try {
          // TODO: Call actual AFIP web service
          const authorized = Math.random() > 0.1;

          if (authorized) {
            const mockCae = `70${Date.now()}${note.id}`;
            const caeVencimiento = new Date();
            caeVencimiento.setDate(caeVencimiento.getDate() + 10);

            await prisma.salesCreditDebitNote.update({
              where: { id: note.id },
              data: {
                fiscalStatus: 'AUTHORIZED',
                cae: mockCae,
                caeVencimiento,
                afipLastAttempt: new Date(),
                afipResponse: { status: 'OK', cae: mockCae },
              },
            });

            results.creditNotesAuthorized++;
          } else {
            await prisma.salesCreditDebitNote.update({
              where: { id: note.id },
              data: {
                fiscalStatus: 'REJECTED',
                afipRetries: { increment: 1 },
                afipLastAttempt: new Date(),
                afipError: 'AFIP rejection simulated',
                afipResponse: { status: 'ERROR', error: 'Simulated rejection' },
              },
            });

            results.creditNotesRejected++;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push(`Credit Note ${note.numero}: ${message}`);

          await prisma.salesCreditDebitNote.update({
            where: { id: note.id },
            data: {
              afipRetries: { increment: 1 },
              afipLastAttempt: new Date(),
              afipError: message,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      companiesProcessed: companies.length,
      ...results,
    });
  } catch (error) {
    console.error('Error in AFIP cron job:', error);
    return NextResponse.json(
      { error: 'Error processing AFIP queue' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get AFIP queue status
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');

    const where = companyId ? { companyId } : {};

    const [
      pendingInvoices,
      rejectedInvoices,
      pendingNotes,
      rejectedNotes,
    ] = await Promise.all([
      prisma.salesInvoice.count({
        where: { ...where, fiscalStatus: 'PENDING_AFIP' },
      }),
      prisma.salesInvoice.count({
        where: { ...where, fiscalStatus: 'REJECTED' },
      }),
      prisma.salesCreditDebitNote.count({
        where: { ...where, fiscalStatus: 'PENDING_AFIP' },
      }),
      prisma.salesCreditDebitNote.count({
        where: { ...where, fiscalStatus: 'REJECTED' },
      }),
    ]);

    return NextResponse.json({
      invoices: {
        pending: pendingInvoices,
        rejected: rejectedInvoices,
      },
      creditNotes: {
        pending: pendingNotes,
        rejected: rejectedNotes,
      },
      totalPending: pendingInvoices + pendingNotes,
      totalRejected: rejectedInvoices + rejectedNotes,
    });
  } catch (error) {
    console.error('Error getting AFIP queue status:', error);
    return NextResponse.json(
      { error: 'Error getting queue status' },
      { status: 500 }
    );
  }
}
