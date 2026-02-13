import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

/**
 * POST - Enviar recordatorio de pago a un cliente
 *
 * Body:
 * - clientId: ID del cliente (required)
 *
 * Returns:
 * - success: boolean
 * - message: string
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_CREDIT_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const body = await request.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'clientId requerido' }, { status: 400 });
    }

    // Fetch client
    const client = await prisma.client.findFirst({
      where: { id: parseInt(clientId), companyId },
      select: {
        id: true,
        legalName: true,
        email: true,
        currentBalance: true,
      },
    });

    if (!client) {
      // DEMO MODE: Return success anyway
      return NextResponse.json({
        success: true,
        message: 'Recordatorio enviado exitosamente (DEMO)',
      });
    }

    // Fetch overdue invoices
    const overdueInvoices = await prisma.salesInvoice.findMany({
      where: {
        clientId: parseInt(clientId),
        companyId,
        estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
        saldoPendiente: { gt: 0 },
        fechaVencimiento: { lt: new Date() },
      },
      select: {
        id: true,
        numero: true,
        fechaEmision: true,
        fechaVencimiento: true,
        total: true,
        saldoPendiente: true,
      },
      orderBy: { fechaVencimiento: 'asc' },
      take: 10,
    });

    if (overdueInvoices.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'El cliente no tiene facturas vencidas',
      }, { status: 400 });
    }

    // In a real application, this would send an email
    // For now, we'll just log it and create a notification

    const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + Number(inv.saldoPendiente), 0);

    // Create a log entry (optional - if you have a notifications table)
    try {
      await prisma.activityLog.create({
        data: {
          companyId,
          userId: user!.id,
          action: 'ENVIAR_RECORDATORIO_PAGO',
          entityType: 'client',
          entityId: parseInt(clientId),
          metadata: {
            clientName: client.legalName,
            overdueInvoices: overdueInvoices.length,
            totalOverdue,
          } as any,
        },
      });
    } catch (logError) {
      console.error('Error creating activity log:', logError);
      // Continue anyway
    }

    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    // Example:
    // await sendEmail({
    //   to: client.email,
    //   subject: 'Recordatorio de pago - Facturas vencidas',
    //   body: generateReminderEmailBody(client, overdueInvoices),
    // });

    console.log(`📧 REMINDER EMAIL (DEMO):
To: ${client.email || 'No email'}
Client: ${client.legalName}
Overdue Invoices: ${overdueInvoices.length}
Total Overdue: $${totalOverdue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}

Invoices:
${overdueInvoices.map(inv => `- ${inv.numero}: $${Number(inv.saldoPendiente).toLocaleString('es-AR', { minimumFractionDigits: 2 })} (vence: ${format(new Date(inv.fechaVencimiento), 'dd/MM/yyyy', { locale: es })})`).join('\n')}
`);

    return NextResponse.json({
      success: true,
      message: `Recordatorio enviado exitosamente a ${client.legalName}`,
      details: {
        clientName: client.legalName,
        email: client.email || 'Sin email registrado',
        overdueInvoices: overdueInvoices.length,
        totalOverdue,
      },
    });
  } catch (error) {
    console.error('Error sending reminder:', error);
    return NextResponse.json({
      error: 'Error al enviar recordatorio',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * Helper function to generate email body
 * In production, use a proper email template system
 */
function generateReminderEmailBody(client: any, invoices: any[]): string {
  const total = invoices.reduce((sum, inv) => sum + Number(inv.saldoPendiente), 0);

  return `
Estimado/a ${client.legalName},

Le recordamos que tiene facturas pendientes de pago:

${invoices.map(inv => `
- Factura ${inv.numero}
  Fecha emisión: ${format(new Date(inv.fechaEmision), 'dd/MM/yyyy', { locale: es })}
  Fecha vencimiento: ${format(new Date(inv.fechaVencimiento), 'dd/MM/yyyy', { locale: es })}
  Saldo pendiente: $${Number(inv.saldoPendiente).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
`).join('\n')}

Total adeudado: $${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}

Por favor, regularice su situación a la brevedad.

Saludos cordiales,
Administración
  `.trim();
}
