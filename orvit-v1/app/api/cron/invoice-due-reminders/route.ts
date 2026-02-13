/**
 * Cron Job: Invoice Due Reminders
 *
 * Runs daily to:
 * - Find invoices approaching due date
 * - Find overdue invoices
 * - Send email/SMS reminders to clients
 * - Log reminder actions
 *
 * Schedule: Daily at 9:00 AM
 *
 * Vercel Cron: Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/invoice-due-reminders",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

interface ReminderConfig {
  daysBeforeDue: number[]; // e.g. [7, 3, 1] - remind 7, 3, and 1 day before
  daysAfterDue: number[]; // e.g. [1, 7, 15, 30] - remind at these intervals after due
  enabled: boolean;
}

const DEFAULT_CONFIG: ReminderConfig = {
  daysBeforeDue: [7, 3, 1],
  daysAfterDue: [1, 3, 7, 15, 30],
  enabled: true,
};

export async function GET(request: NextRequest) {
  // Verify cron secret (security)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[CRON] Starting invoice due reminders job...');

  try {
    const now = new Date();
    const stats = {
      processed: 0,
      remindersSent: 0,
      errors: 0,
      companies: 0,
    };

    // Get all active companies
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });

    stats.companies = companies.length;

    for (const company of companies) {
      try {
        // Get company reminder config (from settings or use default)
        const config = DEFAULT_CONFIG; // TODO: Load from company settings

        if (!config.enabled) continue;

        // Find invoices that need reminders
        const candidateInvoices = await prisma.salesInvoice.findMany({
          where: {
            companyId: company.id,
            estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
            saldoPendiente: { gt: 0 },
            docType: 'T1', // Only send for T1 (real invoices, not simulated)
          },
          include: {
            client: {
              select: {
                id: true,
                legalName: true,
                businessName: true,
                name: true,
                email: true,
                phone: true,
                contactName: true,
                notificationPreferences: true,
              },
            },
            company: {
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        });

        stats.processed += candidateInvoices.length;

        for (const invoice of candidateInvoices) {
          const dueDate = new Date(invoice.fechaVencimiento);
          const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          let shouldRemind = false;
          let reminderType: 'PRE_DUE' | 'OVERDUE' | 'DUE_TODAY' = 'PRE_DUE';

          // Check if invoice is due today
          if (daysUntilDue === 0) {
            shouldRemind = true;
            reminderType = 'DUE_TODAY';
          }
          // Check if approaching due date
          else if (daysUntilDue > 0 && config.daysBeforeDue.includes(daysUntilDue)) {
            shouldRemind = true;
            reminderType = 'PRE_DUE';
          }
          // Check if overdue
          else if (daysUntilDue < 0) {
            const daysOverdue = Math.abs(daysUntilDue);
            if (config.daysAfterDue.includes(daysOverdue)) {
              shouldRemind = true;
              reminderType = 'OVERDUE';
            }
          }

          if (!shouldRemind) continue;

          // Check if reminder already sent today
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const existingReminder = await prisma.invoiceReminder.findFirst({
            where: {
              invoiceId: invoice.id,
              sentAt: { gte: today },
            },
          });

          if (existingReminder) {
            console.log(`[CRON] Reminder already sent today for invoice ${invoice.numero}`);
            continue;
          }

          // Send reminder
          const reminderSent = await sendReminder(invoice, reminderType, daysUntilDue);

          if (reminderSent) {
            // Log reminder
            await prisma.invoiceReminder.create({
              data: {
                invoiceId: invoice.id,
                clientId: invoice.clientId,
                tipo: reminderType,
                daysUntilDue: daysUntilDue,
                channel: invoice.client.email ? 'EMAIL' : 'NONE',
                sentTo: invoice.client.email || '',
                sentAt: new Date(),
                companyId: company.id,
              },
            });

            stats.remindersSent++;
          }
        }
      } catch (companyError) {
        console.error(`[CRON] Error processing company ${company.id}:`, companyError);
        stats.errors++;
      }
    }

    console.log('[CRON] Invoice due reminders job completed:', stats);

    return NextResponse.json({
      success: true,
      message: 'Invoice reminders processed',
      stats,
    });
  } catch (error) {
    console.error('[CRON] Fatal error in invoice reminders:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Send reminder to client
 */
async function sendReminder(
  invoice: any,
  tipo: 'PRE_DUE' | 'OVERDUE' | 'DUE_TODAY',
  daysUntilDue: number
): Promise<boolean> {
  const client = invoice.client;
  const company = invoice.company;

  if (!client.email) {
    console.log(`[REMINDER] No email for client ${client.id}, skipping`);
    return false;
  }

  // Prepare email content
  const subject = getEmailSubject(tipo, invoice.numero, daysUntilDue);
  const body = getEmailBody(tipo, invoice, client, company, daysUntilDue);

  try {
    // TODO: Integrate with actual email service (SendGrid, SES, etc.)
    console.log(`[REMINDER] Would send email to ${client.email}:`);
    console.log(`Subject: ${subject}`);
    console.log(`Body preview: ${body.substring(0, 200)}...`);

    // Simulate email sending
    // await sendEmail({
    //   to: client.email,
    //   from: company.email || 'noreply@empresa.com',
    //   subject,
    //   html: body,
    // });

    return true;
  } catch (error) {
    console.error('[REMINDER] Error sending email:', error);
    return false;
  }
}

function getEmailSubject(tipo: string, invoiceNumber: string, daysUntilDue: number): string {
  switch (tipo) {
    case 'DUE_TODAY':
      return `⏰ Recordatorio: Factura ${invoiceNumber} vence HOY`;
    case 'PRE_DUE':
      return `📅 Recordatorio: Factura ${invoiceNumber} vence en ${daysUntilDue} día${daysUntilDue > 1 ? 's' : ''}`;
    case 'OVERDUE':
      return `🔴 URGENTE: Factura ${invoiceNumber} vencida hace ${Math.abs(daysUntilDue)} día${Math.abs(daysUntilDue) > 1 ? 's' : ''}`;
    default:
      return `Recordatorio de pago - Factura ${invoiceNumber}`;
  }
}

function getEmailBody(
  tipo: string,
  invoice: any,
  client: any,
  company: any,
  daysUntilDue: number
): string {
  const clientName = client.legalName || client.businessName || client.name;
  const saldoPendiente = parseFloat(invoice.saldoPendiente.toString());
  const formattedSaldo = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(saldoPendiente);

  const dueDate = new Date(invoice.fechaVencimiento).toLocaleDateString('es-AR');

  let urgencyMessage = '';
  if (tipo === 'DUE_TODAY') {
    urgencyMessage = '<p style="color: #d97706; font-weight: bold;">⏰ Esta factura vence HOY</p>';
  } else if (tipo === 'OVERDUE') {
    urgencyMessage = `<p style="color: #dc2626; font-weight: bold;">🔴 Esta factura está VENCIDA desde hace ${Math.abs(daysUntilDue)} día${Math.abs(daysUntilDue) > 1 ? 's' : ''}</p>`;
  } else {
    urgencyMessage = `<p>Esta factura vencerá en ${daysUntilDue} día${daysUntilDue > 1 ? 's' : ''}.</p>`;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .invoice-details { background: #fff; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .amount { font-size: 24px; font-weight: bold; color: #2563eb; }
        .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Recordatorio de Pago</h2>
          <p>Estimado/a ${clientName},</p>
        </div>

        ${urgencyMessage}

        <p>Le recordamos que tiene pendiente el pago de la siguiente factura:</p>

        <div class="invoice-details">
          <table style="width: 100%;">
            <tr>
              <td><strong>Factura N°:</strong></td>
              <td>${invoice.numeroCompleto}</td>
            </tr>
            <tr>
              <td><strong>Fecha de emisión:</strong></td>
              <td>${new Date(invoice.fechaEmision).toLocaleDateString('es-AR')}</td>
            </tr>
            <tr>
              <td><strong>Fecha de vencimiento:</strong></td>
              <td>${dueDate}</td>
            </tr>
            <tr>
              <td><strong>Saldo pendiente:</strong></td>
              <td class="amount">${formattedSaldo}</td>
            </tr>
          </table>
        </div>

        <p>Por favor, proceda con el pago a la brevedad posible.</p>

        <p>Para consultas o coordinación de pago, puede contactarnos a:</p>
        <ul>
          <li>Email: ${company.email || 'contacto@empresa.com'}</li>
          <li>Tel: ${company.phone || '-'}</li>
        </ul>

        <div class="footer">
          <p>Este es un mensaje automático. Por favor, no responda a este correo.</p>
          <p><strong>${company.name}</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;
}
