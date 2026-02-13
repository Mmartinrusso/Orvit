import { createHmac } from 'crypto';

export interface WebhookPayload {
  event: string;
  timestamp: Date;
  data: any;
}

export async function dispatchWebhook(
  companyId: number,
  event: string,
  data: any
) {
  try {
    // Obtener webhooks activos para este evento
    // TODO: Implementar modelo Webhook en schema
    const webhooks = await getActiveWebhooks(companyId, event);

    for (const webhook of webhooks) {
      await sendWebhook(webhook, event, data);
    }
  } catch (error) {
    console.error('[Webhook] Error dispatching:', error);
  }
}

async function getActiveWebhooks(companyId: number, event: string) {
  // Mock data - en producción vendría de la base de datos
  return [
    // {
    //   id: 1,
    //   url: 'https://external-system.com/webhook',
    //   secret: 'webhook_secret_key',
    //   events: ['orden.confirmada', 'orden.entregada'],
    //   active: true
    // }
  ];
}

async function sendWebhook(webhook: any, event: string, data: any) {
  try {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date(),
      data,
    };

    const signature = createHmac('sha256', webhook.secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': event,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log(`[Webhook] Sent to ${webhook.url}: ${event}`);
  } catch (error: any) {
    console.error(`[Webhook] Failed to send to ${webhook.url}:`, error.message);
    // TODO: Implementar retry logic y dead letter queue
  }
}

// Eventos disponibles
export const WebhookEvents = {
  ORDEN_CREATED: 'orden.created',
  ORDEN_CONFIRMED: 'orden.confirmada',
  ORDEN_PREPARED: 'orden.preparada',
  ORDEN_DELIVERED: 'orden.entregada',
  ORDEN_INVOICED: 'orden.facturada',
  ORDEN_COMPLETED: 'orden.completada',
  ORDEN_CANCELLED: 'orden.cancelada',
  ORDEN_APPROVED: 'orden.aprobada',
  ORDEN_REJECTED: 'orden.rechazada',
};
