/**
 * Automated Collection Reminders Cron Job
 *
 * This cron job runs daily to:
 * 1. Send reminders for invoices approaching due date
 * 2. Send escalated reminders for overdue invoices
 * 3. Process scheduled follow-ups from collection attempts
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Dunning schedule (days overdue -> action)
const DUNNING_SCHEDULE = {
  '-3': { type: 'REMINDER_PRE', subject: 'Recordatorio: Factura próxima a vencer' },
  '1': { type: 'REMINDER_1', subject: 'Aviso: Factura vencida' },
  '7': { type: 'REMINDER_2', subject: 'Segundo aviso: Factura pendiente de pago' },
  '15': { type: 'REMINDER_3', subject: 'Tercer aviso: Acción requerida' },
  '30': { type: 'ESCALATION', subject: 'Aviso final: Factura en mora' },
};

interface ReminderResult {
  invoiceId: number;
  clientId: string;
  type: string;
  success: boolean;
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (for security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: ReminderResult[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all companies with active collection reminders
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        salesConfig: {
          select: {
            enableCollectionReminders: true,
            reminderDaysBefore: true,
            reminderEscalationDays: true,
          },
        },
      },
    });

    for (const company of companies) {
      // Skip if reminders not enabled
      if (!company.salesConfig?.enableCollectionReminders) continue;

      // 1. Get invoices approaching due date (pre-reminder)
      const preDueDate = new Date(today);
      preDueDate.setDate(preDueDate.getDate() + (company.salesConfig.reminderDaysBefore || 3));

      const approachingDue = await prisma.salesInvoice.findMany({
        where: {
          companyId: company.id,
          estado: { in: ['EMITIDA'] },
          saldoPendiente: { gt: 0 },
          fechaVencimiento: {
            gte: today,
            lte: preDueDate,
          },
        },
        include: {
          client: true,
        },
      });

      for (const invoice of approachingDue) {
        // Check if we already sent a reminder today
        const existingReminder = await prisma.collectionAttempt.findFirst({
          where: {
            invoiceId: invoice.id,
            attemptType: 'AUTOMATED_REMINDER',
            attemptDate: {
              gte: new Date(today.getTime() - 24 * 60 * 60 * 1000),
            },
          },
        });

        if (!existingReminder) {
          const result = await sendReminder(
            invoice,
            invoice.client,
            company,
            'REMINDER_PRE',
            'Recordatorio: Factura próxima a vencer'
          );
          results.push(result);
        }
      }

      // 2. Get overdue invoices for dunning sequence
      const overdueInvoices = await prisma.salesInvoice.findMany({
        where: {
          companyId: company.id,
          estado: { in: ['EMITIDA', 'VENCIDA', 'PARCIALMENTE_COBRADA'] },
          saldoPendiente: { gt: 0 },
          fechaVencimiento: { lt: today },
        },
        include: {
          client: true,
          collectionAttempts: {
            where: { attemptType: 'AUTOMATED_REMINDER' },
            orderBy: { attemptDate: 'desc' },
            take: 1,
          },
        },
      });

      for (const invoice of overdueInvoices) {
        const daysOverdue = Math.floor(
          (today.getTime() - new Date(invoice.fechaVencimiento!).getTime()) / (1000 * 60 * 60 * 24)
        );

        const lastReminder = invoice.collectionAttempts[0];
        const lastReminderType = lastReminder?.result || null;

        // Determine which reminder to send based on days overdue
        let reminderToSend: { type: string; subject: string } | null = null;

        if (daysOverdue >= 30 && lastReminderType !== 'ESCALATION') {
          reminderToSend = DUNNING_SCHEDULE['30'];
        } else if (daysOverdue >= 15 && lastReminderType !== 'REMINDER_3' && lastReminderType !== 'ESCALATION') {
          reminderToSend = DUNNING_SCHEDULE['15'];
        } else if (daysOverdue >= 7 && !['REMINDER_2', 'REMINDER_3', 'ESCALATION'].includes(lastReminderType || '')) {
          reminderToSend = DUNNING_SCHEDULE['7'];
        } else if (daysOverdue >= 1 && !['REMINDER_1', 'REMINDER_2', 'REMINDER_3', 'ESCALATION'].includes(lastReminderType || '')) {
          reminderToSend = DUNNING_SCHEDULE['1'];
        }

        if (reminderToSend) {
          const result = await sendReminder(
            invoice,
            invoice.client,
            company,
            reminderToSend.type,
            reminderToSend.subject
          );
          results.push(result);
        }
      }

      // 3. Process scheduled follow-ups
      const scheduledFollowUps = await prisma.collectionAttempt.findMany({
        where: {
          companyId: company.id,
          nextFollowUpDate: {
            gte: new Date(today.getTime() - 24 * 60 * 60 * 1000),
            lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
          result: 'COMPROMISO_PAGO',
        },
        include: {
          invoice: {
            include: {
              client: true,
            },
          },
        },
      });

      for (const followUp of scheduledFollowUps) {
        // Check if payment was received
        const invoice = followUp.invoice;
        if (invoice.saldoPendiente && invoice.saldoPendiente.toNumber() > 0) {
          // Payment not received, send follow-up reminder
          const result = await sendReminder(
            invoice as any,
            invoice.client,
            company,
            'FOLLOWUP',
            'Seguimiento: Compromiso de pago pendiente'
          );
          results.push(result);
        }
      }
    }

    // Summary stats
    const summary = {
      totalReminders: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      byType: results.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return NextResponse.json({
      success: true,
      summary,
      results,
      processedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error processing collection reminders:', err);
    return NextResponse.json(
      { error: 'Error processing collection reminders', details: String(err) },
      { status: 500 }
    );
  }
}

async function sendReminder(
  invoice: any,
  client: any,
  company: any,
  reminderType: string,
  subject: string
): Promise<ReminderResult> {
  try {
    // Log the attempt
    await prisma.collectionAttempt.create({
      data: {
        invoiceId: invoice.id,
        companyId: company.id,
        userId: 1, // System user
        attemptType: 'AUTOMATED_REMINDER',
        result: reminderType,
        notes: `Recordatorio automático enviado: ${subject}`,
        attemptDate: new Date(),
      },
    });

    // Send email if client has email
    if (client?.email) {
      // Note: Implement actual email sending via your email service
      // For now, we just log the reminder
      console.log(`[Collection Reminder] Sending to ${client.email}: ${subject}`);
      console.log(`  Invoice: ${invoice.numeroCompleto}`);
      console.log(`  Amount: ${invoice.saldoPendiente}`);
      console.log(`  Due: ${invoice.fechaVencimiento}`);

      // TODO: Integrate with email service
      // await sendEmail({
      //   to: client.email,
      //   subject,
      //   template: 'collection-reminder',
      //   data: {
      //     clientName: client.legalName,
      //     invoiceNumber: invoice.numeroCompleto,
      //     amount: invoice.saldoPendiente,
      //     dueDate: invoice.fechaVencimiento,
      //     companyName: company.name,
      //   },
      // });
    }

    return {
      invoiceId: invoice.id,
      clientId: client?.id || '',
      type: reminderType,
      success: true,
    };
  } catch (error) {
    console.error(`Error sending reminder for invoice ${invoice.id}:`, error);
    return {
      invoiceId: invoice.id,
      clientId: client?.id || '',
      type: reminderType,
      success: false,
      error: String(error),
    };
  }
}
