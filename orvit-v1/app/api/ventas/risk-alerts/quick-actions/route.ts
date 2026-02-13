/**
 * Risk Alerts Quick Actions API
 *
 * POST: Execute a quick action on a risk alert
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { resolveAlert } from '@/lib/ventas/risk-alert-service';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface QuickActionRequest {
  alertId: number;
  action: string;
  params?: Record<string, any>;
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COBRANZAS_EDIT);
    if (error) return error;

    const body: QuickActionRequest = await request.json();
    const { alertId, action, params } = body;

    if (!alertId || !action) {
      return NextResponse.json(
        { error: 'alertId y action son requeridos' },
        { status: 400 }
      );
    }

    // Verify alert belongs to company
    const alert = await prisma.$queryRaw<any[]>`
      SELECT * FROM sales_risk_alerts
      WHERE id = ${alertId} AND "companyId" = ${user!.companyId}
    `;

    if (alert.length === 0) {
      return NextResponse.json(
        { error: 'Alerta no encontrada' },
        { status: 404 }
      );
    }

    const alertData = alert[0];
    let result: any = { success: true };

    switch (action) {
      case 'SEND_REMINDER':
        // Log a collection attempt for the related invoice
        if (alertData.documentType === 'INVOICE' || params?.invoiceId) {
          const invoiceId = params?.invoiceId || alertData.documentId;
          await prisma.collectionAttempt.create({
            data: {
              invoiceId,
              companyId: user!.companyId,
              userId: user!.id,
              attemptType: 'EMAIL',
              result: 'CONTACTADO',
              notes: `Recordatorio rápido desde alerta de riesgo: ${alertData.titulo}`,
              attemptDate: new Date(),
            },
          });
          result.message = 'Recordatorio enviado exitosamente';
        }
        break;

      case 'BLOCK_CLIENT':
        if (alertData.documentType === 'CLIENT' || params?.clientId) {
          const clientId = params?.clientId || String(alertData.documentId);
          await prisma.client.update({
            where: { id: clientId },
            data: {
              isBlocked: true,
              blockedReason: `Bloqueado por alerta: ${alertData.tipo}`,
              blockedAt: new Date(),
              blockedByUserId: user!.id,
            },
          });

          // Resolve the alert
          await resolveAlert(alertId, user!.id, 'Cliente bloqueado desde acción rápida');
          result.message = 'Cliente bloqueado exitosamente';
        }
        break;

      case 'EXTEND_CREDIT':
        // Get current credit data for the client
        if (alertData.documentType === 'CLIENT' || params?.clientId) {
          const clientId = params?.clientId || String(alertData.documentId);
          const client = await prisma.client.findFirst({
            where: { id: clientId, companyId: user!.companyId },
            select: {
              id: true,
              legalName: true,
              creditLimit: true,
              currentBalance: true,
            },
          });

          if (client) {
            // Suggest 20% increase
            const suggestedIncrease = Math.ceil((client.creditLimit || 0) * 1.2 / 1000) * 1000;
            result.clientData = {
              ...client,
              suggestedNewLimit: suggestedIncrease,
            };
            result.message = 'Datos de crédito obtenidos';
            result.requiresInput = true;
            result.inputFields = [
              {
                name: 'newCreditLimit',
                label: 'Nuevo límite de crédito',
                type: 'number',
                defaultValue: suggestedIncrease,
              },
              {
                name: 'reason',
                label: 'Motivo del cambio',
                type: 'text',
              },
            ];
          }
        }
        break;

      case 'UPDATE_CREDIT_LIMIT':
        // Actually update the credit limit
        if (params?.clientId && params?.newCreditLimit) {
          const client = await prisma.client.findFirst({
            where: { id: params.clientId, companyId: user!.companyId },
          });

          if (client) {
            const oldLimit = client.creditLimit;
            await prisma.client.update({
              where: { id: params.clientId },
              data: { creditLimit: params.newCreditLimit },
            });

            // Log the change
            await prisma.clientNote.create({
              data: {
                clientId: params.clientId,
                companyId: user!.companyId,
                userId: user!.id,
                content: `Límite de crédito actualizado: $${oldLimit?.toLocaleString()} → $${params.newCreditLimit.toLocaleString()}. Motivo: ${params.reason || 'Acción rápida desde alertas'}`,
                type: 'CREDIT_CHANGE',
              },
            });

            // Resolve the related alert
            await resolveAlert(alertId, user!.id, `Límite de crédito actualizado a $${params.newCreditLimit.toLocaleString()}`);
            result.message = 'Límite de crédito actualizado exitosamente';
          }
        }
        break;

      case 'CALL_CLIENT':
        // Log a phone call attempt
        const clientIdForCall = params?.clientId || (alertData.documentType === 'CLIENT' ? String(alertData.documentId) : null);

        if (clientIdForCall) {
          // Get client's most recent overdue invoice if any
          const overdueInvoice = await prisma.salesInvoice.findFirst({
            where: {
              clientId: clientIdForCall,
              companyId: user!.companyId,
              estado: { in: ['EMITIDA', 'VENCIDA'] },
              saldoPendiente: { gt: 0 },
            },
            orderBy: { fechaVencimiento: 'asc' },
          });

          if (overdueInvoice) {
            await prisma.collectionAttempt.create({
              data: {
                invoiceId: overdueInvoice.id,
                companyId: user!.companyId,
                userId: user!.id,
                attemptType: 'PHONE',
                result: 'CONTACTADO',
                notes: `Llamada desde alerta de riesgo: ${alertData.titulo}`,
                attemptDate: new Date(),
              },
            });
          }

          // Get contact info
          const client = await prisma.client.findFirst({
            where: { id: clientIdForCall },
            select: { phone: true, alternatePhone: true, contactPerson: true, legalName: true },
          });

          result.contactInfo = client;
          result.message = 'Llamada registrada';
        }
        break;

      case 'CREATE_PAYMENT_PLAN':
        // Return data for creating a payment plan
        const invoiceForPlan = await prisma.salesInvoice.findFirst({
          where: {
            id: params?.invoiceId || alertData.documentId,
            companyId: user!.companyId,
          },
          include: {
            client: { select: { id: true, legalName: true } },
          },
        });

        if (invoiceForPlan) {
          result.invoiceData = {
            id: invoiceForPlan.id,
            numero: invoiceForPlan.numeroCompleto,
            saldoPendiente: invoiceForPlan.saldoPendiente?.toNumber(),
            clientId: invoiceForPlan.clientId,
            clientName: invoiceForPlan.client?.legalName,
          };
          result.message = 'Datos para plan de pagos obtenidos';
          result.requiresInput = true;
          result.inputFields = [
            {
              name: 'cuotas',
              label: 'Número de cuotas',
              type: 'number',
              defaultValue: 3,
              min: 2,
              max: 12,
            },
            {
              name: 'fechaPrimeraCuota',
              label: 'Fecha primera cuota',
              type: 'date',
            },
            {
              name: 'notas',
              label: 'Notas',
              type: 'text',
            },
          ];
        }
        break;

      case 'DISMISS_ALERT':
        // Mark alert as reviewed but not resolved
        await prisma.$executeRaw`
          UPDATE sales_risk_alerts
          SET estado = 'REVISADA',
              "revisadaPor" = ${user!.id},
              "revisadaAt" = NOW(),
              "comentarioResolucion" = ${params?.reason || 'Descartada desde acción rápida'}
          WHERE id = ${alertId}
        `;
        result.message = 'Alerta descartada';
        break;

      case 'RESOLVE_ALERT':
        await resolveAlert(alertId, user!.id, params?.reason || 'Resuelta desde acción rápida');
        result.message = 'Alerta resuelta exitosamente';
        break;

      default:
        result.success = false;
        result.message = `Acción no reconocida: ${action}`;
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('Error executing quick action:', err);
    return NextResponse.json(
      { error: 'Error al ejecutar acción rápida' },
      { status: 500 }
    );
  }
}
