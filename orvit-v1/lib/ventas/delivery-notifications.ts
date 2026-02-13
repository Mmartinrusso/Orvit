/**
 * Delivery Notifications Service
 * Sends automated notifications to customers based on delivery state changes
 */

import { prisma } from '@/lib/prisma';

async function sendEmail(to: string, subject: string, htmlBody: string): Promise<boolean> {
  try {
    console.log('[EMAIL]', { to, subject });
    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  try {
    console.log('[WHATSAPP]', { to, preview: message.substring(0, 50) });
    // TODO: Integrate with WhatsApp Business API
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp:', error);
    return false;
  }
}

export async function notifyDeliveryScheduled(deliveryId: number): Promise<void> {
  try {
    const delivery = await prisma.saleDelivery.findUnique({
      where: { id: deliveryId },
      include: { sale: { include: { client: true } }, items: true },
    });

    if (!delivery?.sale?.client) return;

    const client = delivery.sale.client;
    const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/delivery-tracker/${delivery.id}`;

    const emailHtml = `
      <h2>Entrega Programada</h2>
      <p>Hola ${client.legalName},</p>
      <p>Tu pedido <strong>${delivery.numero}</strong> ha sido programado para entrega.</p>
      <p>Fecha: ${delivery.fechaProgramada?.toLocaleDateString('es-AR')}</p>
      <p><a href="${trackingUrl}">Rastrear pedido</a></p>
    `;

    if (client.email) {
      await sendEmail(client.email, `Entrega programada - ${delivery.numero}`, emailHtml);
    }

    if (client.telefono) {
      const message = `Hola ${client.legalName}! Tu pedido ${delivery.numero} está programado. Rastrear: ${trackingUrl}`;
      await sendWhatsApp(client.telefono, message);
    }
  } catch (error) {
    console.error('Error in notifyDeliveryScheduled:', error);
  }
}

export async function notifyDeliveryDispatched(deliveryId: number): Promise<void> {
  try {
    const delivery = await prisma.saleDelivery.findUnique({
      where: { id: deliveryId },
      include: { sale: { include: { client: true } } },
    });

    if (!delivery?.sale?.client) return;

    const client = delivery.sale.client;
    const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/delivery-tracker/${delivery.id}`;

    const emailHtml = `
      <h2>Pedido en Camino</h2>
      <p>Hola ${client.legalName},</p>
      <p>Tu pedido <strong>${delivery.numero}</strong> está en camino!</p>
      ${delivery.conductorNombre ? `<p>Conductor: ${delivery.conductorNombre}</p>` : ''}
      <p><a href="${trackingUrl}">Ver ubicación en tiempo real</a></p>
    `;

    if (client.email) {
      await sendEmail(client.email, `Tu pedido está en camino - ${delivery.numero}`, emailHtml);
    }

    if (client.telefono) {
      const message = `¡Tu pedido ${delivery.numero} está en camino! ${delivery.conductorNombre ? `Conductor: ${delivery.conductorNombre}` : ''} Ver: ${trackingUrl}`;
      await sendWhatsApp(client.telefono, message);
    }
  } catch (error) {
    console.error('Error in notifyDeliveryDispatched:', error);
  }
}

export async function notifyDeliveryCompleted(deliveryId: number): Promise<void> {
  try {
    const delivery = await prisma.saleDelivery.findUnique({
      where: { id: deliveryId },
      include: { sale: { include: { client: true } } },
    });

    if (!delivery?.sale?.client) return;

    const client = delivery.sale.client;
    const podUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/ventas/entregas/${delivery.id}/pod`;

    const emailHtml = `
      <h2>Entrega Completada</h2>
      <p>Gracias ${client.legalName}!</p>
      <p>Tu pedido <strong>${delivery.numero}</strong> ha sido entregado exitosamente.</p>
      <p>Fecha: ${delivery.fechaEntrega?.toLocaleDateString('es-AR')}</p>
      <p><a href="${podUrl}">Descargar Comprobante</a></p>
    `;

    if (client.email) {
      await sendEmail(client.email, `Entrega completada - ${delivery.numero}`, emailHtml);
    }

    if (client.telefono) {
      const message = `✅ Entrega completada de ${delivery.numero}. Comprobante: ${podUrl}`;
      await sendWhatsApp(client.telefono, message);
    }
  } catch (error) {
    console.error('Error in notifyDeliveryCompleted:', error);
  }
}

export async function notifyDeliveryFailed(deliveryId: number, reason: string): Promise<void> {
  try {
    const delivery = await prisma.saleDelivery.findUnique({
      where: { id: deliveryId },
      include: { sale: { include: { client: true } } },
    });

    if (!delivery?.sale?.client) return;

    const client = delivery.sale.client;

    const emailHtml = `
      <h2>Actualización de Entrega</h2>
      <p>Hola ${client.legalName},</p>
      <p>No pudimos completar la entrega de <strong>${delivery.numero}</strong>.</p>
      <p>Motivo: ${reason}</p>
      <p>Por favor contáctanos para coordinar una nueva fecha.</p>
    `;

    if (client.email) {
      await sendEmail(client.email, `Actualización de entrega - ${delivery.numero}`, emailHtml);
    }

    if (client.telefono) {
      const message = `⚠️ No pudimos completar la entrega de ${delivery.numero}. Motivo: ${reason}. Contáctanos para coordinar.`;
      await sendWhatsApp(client.telefono, message);
    }
  } catch (error) {
    console.error('Error in notifyDeliveryFailed:', error);
  }
}
