/**
 * Servicio de Notificaciones de Billing
 * Envía emails transaccionales para eventos de facturación
 *
 * Soporta:
 * - Resend (recomendado)
 * - SMTP genérico
 * - SendGrid (futuro)
 */

import { prisma } from '@/lib/prisma';

// Configuración
const EMAIL_FROM = process.env.EMAIL_FROM || 'ORVIT <billing@orvit.app>';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.orvit.ar';

export type BillingEmailType =
  | 'INVOICE_CREATED'
  | 'INVOICE_REMINDER'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_FAILED'
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_EXPIRING'
  | 'SUBSCRIPTION_CANCELED'
  | 'SUBSCRIPTION_REACTIVATED'
  | 'AUTO_PAYMENT_SETUP'
  | 'AUTO_PAYMENT_FAILED'
  | 'TOKENS_LOW'
  | 'TOKENS_PURCHASED';

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * Envía un email usando Resend
 */
async function sendWithResend(options: SendEmailOptions): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no configurado, email no enviado');
    return false;
  }

  try {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: recipients.map(r => r.email),
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error enviando email con Resend:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error enviando email:', error);
    return false;
  }
}

/**
 * Genera el template base del email
 */
function generateEmailTemplate(content: string, footerText?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ORVIT</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: white; border-radius: 8px; padding: 32px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eee; margin-bottom: 20px; }
    .logo { font-size: 28px; font-weight: bold; color: #8B5CF6; }
    .content { padding: 20px 0; }
    .button { display: inline-block; background: #8B5CF6; color: white !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 20px 0; }
    .button:hover { background: #7C3AED; }
    .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; margin-top: 20px; font-size: 12px; color: #666; }
    .amount { font-size: 32px; font-weight: bold; color: #8B5CF6; }
    .status-paid { color: #10B981; }
    .status-pending { color: #F59E0B; }
    .status-failed { color: #EF4444; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
    .detail-label { color: #666; }
    .detail-value { font-weight: 500; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f9fafb; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">ORVIT</div>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        ${footerText || 'Este es un mensaje automático del sistema de facturación de ORVIT.'}
        <br><br>
        <a href="${APP_URL}">Acceder a ORVIT</a>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Formatea moneda
 */
function formatCurrency(amount: number, currency: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Formatea fecha
 */
function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// =============================================================================
// EMAILS DE FACTURACIÓN
// =============================================================================

/**
 * Email: Factura creada
 */
export async function sendInvoiceCreatedEmail(invoiceId: string): Promise<boolean> {
  const invoice = await prisma.billingInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      subscription: {
        include: {
          user: true,
          plan: true,
        },
      },
      items: true,
    },
  });

  if (!invoice) return false;

  const user = invoice.subscription.user;
  const plan = invoice.subscription.plan;

  const itemsHtml = invoice.items.map(item => `
    <tr>
      <td>${item.description}</td>
      <td style="text-align: right">${item.quantity}</td>
      <td style="text-align: right">${formatCurrency(Number(item.total), invoice.currency)}</td>
    </tr>
  `).join('');

  const content = `
    <h2>Nueva factura generada</h2>
    <p>Hola ${user.name},</p>
    <p>Se ha generado una nueva factura para tu suscripción de <strong>${plan.displayName}</strong>.</p>

    <div style="text-align: center; margin: 30px 0;">
      <div class="amount">${formatCurrency(Number(invoice.total), invoice.currency)}</div>
      <p style="color: #666;">Factura #${invoice.number}</p>
    </div>

    <table>
      <thead>
        <tr>
          <th>Concepto</th>
          <th style="text-align: right">Cant.</th>
          <th style="text-align: right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="text-align: right"><strong>Subtotal</strong></td>
          <td style="text-align: right">${formatCurrency(Number(invoice.subtotal), invoice.currency)}</td>
        </tr>
        ${Number(invoice.tax) > 0 ? `
        <tr>
          <td colspan="2" style="text-align: right"><strong>IVA</strong></td>
          <td style="text-align: right">${formatCurrency(Number(invoice.tax), invoice.currency)}</td>
        </tr>
        ` : ''}
        <tr>
          <td colspan="2" style="text-align: right"><strong>Total</strong></td>
          <td style="text-align: right"><strong>${formatCurrency(Number(invoice.total), invoice.currency)}</strong></td>
        </tr>
      </tfoot>
    </table>

    <p><strong>Fecha de vencimiento:</strong> ${formatDate(invoice.dueDate)}</p>

    <div style="text-align: center;">
      <a href="${APP_URL}/billing/invoices/${invoice.id}" class="button">Ver Factura</a>
    </div>
  `;

  return sendWithResend({
    to: { email: user.email, name: user.name },
    subject: `Factura #${invoice.number} - ${formatCurrency(Number(invoice.total), invoice.currency)}`,
    html: generateEmailTemplate(content),
  });
}

/**
 * Email: Recordatorio de pago
 */
export async function sendPaymentReminderEmail(invoiceId: string): Promise<boolean> {
  const invoice = await prisma.billingInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      subscription: {
        include: { user: true },
      },
    },
  });

  if (!invoice || invoice.status !== 'OPEN') return false;

  const user = invoice.subscription.user;
  const daysUntilDue = Math.ceil((invoice.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const content = `
    <h2>Recordatorio de pago</h2>
    <p>Hola ${user.name},</p>
    <p>Te recordamos que tienes una factura pendiente de pago.</p>

    <div style="text-align: center; margin: 30px 0;">
      <div class="amount">${formatCurrency(Number(invoice.total), invoice.currency)}</div>
      <p style="color: #666;">Factura #${invoice.number}</p>
      <p class="${daysUntilDue <= 0 ? 'status-failed' : daysUntilDue <= 3 ? 'status-pending' : ''}">
        ${daysUntilDue <= 0 ? 'Vencida' : daysUntilDue === 1 ? 'Vence mañana' : `Vence en ${daysUntilDue} días`}
      </p>
    </div>

    <div style="text-align: center;">
      <a href="${APP_URL}/billing/invoices/${invoice.id}" class="button">Pagar Ahora</a>
    </div>

    <p style="font-size: 14px; color: #666; margin-top: 20px;">
      Si ya realizaste el pago, puedes ignorar este mensaje. El estado se actualizará automáticamente.
    </p>
  `;

  return sendWithResend({
    to: { email: user.email, name: user.name },
    subject: `Recordatorio: Factura #${invoice.number} ${daysUntilDue <= 0 ? 'vencida' : 'por vencer'}`,
    html: generateEmailTemplate(content),
  });
}

/**
 * Email: Pago recibido
 */
export async function sendPaymentReceivedEmail(
  invoiceId: string,
  paymentAmount: number
): Promise<boolean> {
  const invoice = await prisma.billingInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      subscription: {
        include: { user: true, plan: true },
      },
    },
  });

  if (!invoice) return false;

  const user = invoice.subscription.user;

  const content = `
    <h2 class="status-paid">¡Pago recibido!</h2>
    <p>Hola ${user.name},</p>
    <p>Hemos recibido tu pago correctamente.</p>

    <div style="text-align: center; margin: 30px 0;">
      <div class="amount status-paid">${formatCurrency(paymentAmount, invoice.currency)}</div>
      <p style="color: #666;">Factura #${invoice.number}</p>
    </div>

    <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; text-align: center;">
      <p style="color: #10B981; font-weight: 500; margin: 0;">
        ✓ Tu suscripción está activa
      </p>
    </div>

    <p style="margin-top: 20px;">
      Gracias por confiar en ORVIT. Si necesitas el comprobante de pago, puedes descargarlo desde tu panel.
    </p>

    <div style="text-align: center;">
      <a href="${APP_URL}/billing/invoices/${invoice.id}" class="button">Ver Comprobante</a>
    </div>
  `;

  return sendWithResend({
    to: { email: user.email, name: user.name },
    subject: `Pago confirmado - Factura #${invoice.number}`,
    html: generateEmailTemplate(content),
  });
}

/**
 * Email: Pago fallido (débito automático)
 */
export async function sendPaymentFailedEmail(
  subscriptionId: string,
  reason: string
): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      user: true,
      plan: true,
      autoPaymentConfig: true,
    },
  });

  if (!subscription) return false;

  const user = subscription.user;
  const card = subscription.autoPaymentConfig;

  const content = `
    <h2 class="status-failed">Problema con tu pago</h2>
    <p>Hola ${user.name},</p>
    <p>No pudimos procesar el pago automático de tu suscripción.</p>

    ${card ? `
    <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Tarjeta:</strong> ${card.cardBrand?.toUpperCase()} terminada en ${card.cardLast4}</p>
      <p style="margin: 8px 0 0 0; color: #EF4444;"><strong>Motivo:</strong> ${reason}</p>
    </div>
    ` : ''}

    <p>Por favor, actualiza tu método de pago o realiza el pago manualmente para evitar la suspensión de tu servicio.</p>

    <div style="text-align: center;">
      <a href="${APP_URL}/billing/payment-methods" class="button">Actualizar Método de Pago</a>
    </div>

    <p style="font-size: 14px; color: #666; margin-top: 20px;">
      Si necesitas ayuda, no dudes en contactarnos.
    </p>
  `;

  return sendWithResend({
    to: { email: user.email, name: user.name },
    subject: `Acción requerida: Problema con tu pago`,
    html: generateEmailTemplate(content),
  });
}

/**
 * Email: Suscripción por vencer
 */
export async function sendSubscriptionExpiringEmail(
  subscriptionId: string,
  daysUntilExpiry: number
): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { user: true, plan: true },
  });

  if (!subscription) return false;

  const user = subscription.user;

  const content = `
    <h2>Tu suscripción está por vencer</h2>
    <p>Hola ${user.name},</p>
    <p>Tu suscripción de <strong>${subscription.plan.displayName}</strong> vence en <strong>${daysUntilExpiry} días</strong>.</p>

    <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; color: #D97706; font-weight: 500;">
        Fecha de vencimiento: ${formatDate(subscription.currentPeriodEnd)}
      </p>
    </div>

    <p>Para continuar disfrutando de todos los beneficios, asegúrate de tener tu método de pago actualizado.</p>

    <div style="text-align: center;">
      <a href="${APP_URL}/billing" class="button">Gestionar Suscripción</a>
    </div>
  `;

  return sendWithResend({
    to: { email: user.email, name: user.name },
    subject: `Tu suscripción vence en ${daysUntilExpiry} días`,
    html: generateEmailTemplate(content),
  });
}

/**
 * Email: Tokens bajos
 */
export async function sendLowTokensEmail(
  subscriptionId: string,
  remainingTokens: number
): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { user: true, plan: true },
  });

  if (!subscription) return false;

  const user = subscription.user;

  const content = `
    <h2>Tokens bajos</h2>
    <p>Hola ${user.name},</p>
    <p>Te quedan pocos tokens en tu suscripción.</p>

    <div style="text-align: center; margin: 30px 0;">
      <div class="amount status-pending">${remainingTokens}</div>
      <p style="color: #666;">tokens restantes</p>
    </div>

    <p>Puedes comprar tokens adicionales para seguir utilizando todas las funcionalidades de IA.</p>

    <div style="text-align: center;">
      <a href="${APP_URL}/billing/tokens" class="button">Comprar Tokens</a>
    </div>
  `;

  return sendWithResend({
    to: { email: user.email, name: user.name },
    subject: `Te quedan ${remainingTokens} tokens`,
    html: generateEmailTemplate(content),
  });
}

/**
 * Envía notificaciones de billing según el tipo de evento
 */
export async function sendBillingNotification(
  type: BillingEmailType,
  data: Record<string, any>
): Promise<boolean> {
  try {
    switch (type) {
      case 'INVOICE_CREATED':
        return await sendInvoiceCreatedEmail(data.invoiceId);

      case 'INVOICE_REMINDER':
        return await sendPaymentReminderEmail(data.invoiceId);

      case 'PAYMENT_RECEIVED':
        return await sendPaymentReceivedEmail(data.invoiceId, data.amount);

      case 'PAYMENT_FAILED':
      case 'AUTO_PAYMENT_FAILED':
        return await sendPaymentFailedEmail(data.subscriptionId, data.reason);

      case 'SUBSCRIPTION_EXPIRING':
        return await sendSubscriptionExpiringEmail(data.subscriptionId, data.daysUntilExpiry);

      case 'TOKENS_LOW':
        return await sendLowTokensEmail(data.subscriptionId, data.remainingTokens);

      default:
        console.warn(`Tipo de notificación no implementado: ${type}`);
        return false;
    }
  } catch (error) {
    console.error(`Error enviando notificación ${type}:`, error);
    return false;
  }
}
