/**
 * Notification Service
 *
 * Handles SMS, Email, and Push notifications for sales events.
 * Integrates with Twilio (SMS), SendGrid/Resend (Email), and FCM (Push).
 */

export type NotificationChannel = 'email' | 'sms' | 'push' | 'whatsapp';

export interface NotificationRecipient {
  name: string;
  email?: string;
  phone?: string;
  pushToken?: string;
}

export interface NotificationTemplate {
  subject: string;
  body: string;
  html?: string;
}

export interface NotificationOptions {
  channels?: NotificationChannel[];
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  scheduleFor?: Date;
  metadata?: Record<string, any>;
}

/**
 * Send notification via configured channels
 */
export async function sendNotification(
  recipient: NotificationRecipient,
  template: NotificationTemplate,
  options: NotificationOptions = {}
): Promise<void> {
  const channels = options.channels || ['email'];

  const results = await Promise.allSettled([
    channels.includes('email') && recipient.email
      ? sendEmail(recipient, template)
      : Promise.resolve(),
    channels.includes('sms') && recipient.phone
      ? sendSMS(recipient, template)
      : Promise.resolve(),
    channels.includes('whatsapp') && recipient.phone
      ? sendWhatsApp(recipient, template)
      : Promise.resolve(),
    channels.includes('push') && recipient.pushToken
      ? sendPush(recipient, template)
      : Promise.resolve(),
  ]);

  // Log failures
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`[NOTIFICATION] Channel ${channels[index]} failed:`, result.reason);
    }
  });
}

/**
 * Send email notification
 */
async function sendEmail(
  recipient: NotificationRecipient,
  template: NotificationTemplate
): Promise<void> {
  // TODO: Integrate with SendGrid, Resend, or SMTP
  // Example with Resend:
  /*
  import { Resend } from 'resend';
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: 'noreply@empresa.com',
    to: recipient.email!,
    subject: template.subject,
    html: template.html || template.body,
  });
  */

  console.log(`[EMAIL] Would send to ${recipient.email}:`, template.subject);
}

/**
 * Send SMS notification
 */
async function sendSMS(
  recipient: NotificationRecipient,
  template: NotificationTemplate
): Promise<void> {
  // TODO: Integrate with Twilio
  // Example:
  /*
  import twilio from 'twilio';
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  await client.messages.create({
    body: template.body,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: recipient.phone!,
  });
  */

  console.log(`[SMS] Would send to ${recipient.phone}:`, template.body);
}

/**
 * Send WhatsApp notification
 */
async function sendWhatsApp(
  recipient: NotificationRecipient,
  template: NotificationTemplate
): Promise<void> {
  // TODO: Integrate with Twilio WhatsApp API or WhatsApp Business API
  console.log(`[WHATSAPP] Would send to ${recipient.phone}:`, template.body);
}

/**
 * Send push notification
 */
async function sendPush(
  recipient: NotificationRecipient,
  template: NotificationTemplate
): Promise<void> {
  // TODO: Integrate with Firebase Cloud Messaging
  console.log(`[PUSH] Would send to ${recipient.pushToken}:`, template.subject);
}

/**
 * Pre-defined notification templates for sales events
 */
export const SALES_NOTIFICATION_TEMPLATES = {
  // Sale Order notifications
  ORDER_CREATED: (orderNumber: string, clientName: string): NotificationTemplate => ({
    subject: `Nueva orden de venta ${orderNumber}`,
    body: `Se ha creado la orden ${orderNumber} para ${clientName}.`,
    html: `<p>Se ha creado la orden <strong>${orderNumber}</strong> para ${clientName}.</p>`,
  }),

  ORDER_CONFIRMED: (orderNumber: string): NotificationTemplate => ({
    subject: `Orden ${orderNumber} confirmada`,
    body: `La orden ${orderNumber} ha sido confirmada y está lista para preparación.`,
  }),

  ORDER_READY_TO_SHIP: (orderNumber: string): NotificationTemplate => ({
    subject: `Orden ${orderNumber} lista para envío`,
    body: `La orden ${orderNumber} está lista para ser despachada.`,
  }),

  ORDER_SHIPPED: (
    orderNumber: string,
    trackingUrl: string
  ): NotificationTemplate => ({
    subject: `Orden ${orderNumber} despachada`,
    body: `Su pedido ${orderNumber} ha sido despachado. Rastree su envío: ${trackingUrl}`,
    html: `<p>Su pedido <strong>${orderNumber}</strong> ha sido despachado.</p><p><a href="${trackingUrl}">Rastrear envío</a></p>`,
  }),

  ORDER_DELIVERED: (orderNumber: string): NotificationTemplate => ({
    subject: `Orden ${orderNumber} entregada`,
    body: `Su pedido ${orderNumber} ha sido entregado exitosamente.`,
  }),

  // Invoice notifications
  INVOICE_ISSUED: (
    invoiceNumber: string,
    amount: number,
    dueDate: string
  ): NotificationTemplate => ({
    subject: `Factura ${invoiceNumber} emitida`,
    body: `Se ha emitido la factura ${invoiceNumber} por $${amount.toFixed(2)}. Vencimiento: ${dueDate}`,
  }),

  INVOICE_DUE_SOON: (
    invoiceNumber: string,
    amount: number,
    daysLeft: number
  ): NotificationTemplate => ({
    subject: `Factura ${invoiceNumber} vence en ${daysLeft} días`,
    body: `Recordatorio: La factura ${invoiceNumber} por $${amount.toFixed(2)} vence en ${daysLeft} días.`,
  }),

  INVOICE_OVERDUE: (
    invoiceNumber: string,
    amount: number,
    daysOverdue: number
  ): NotificationTemplate => ({
    subject: `⚠️ Factura ${invoiceNumber} vencida`,
    body: `La factura ${invoiceNumber} por $${amount.toFixed(2)} está vencida hace ${daysOverdue} días.`,
  }),

  PAYMENT_RECEIVED: (
    invoiceNumber: string,
    amount: number
  ): NotificationTemplate => ({
    subject: `Pago recibido - Factura ${invoiceNumber}`,
    body: `Se ha registrado un pago de $${amount.toFixed(2)} para la factura ${invoiceNumber}.`,
  }),

  // Load Order notifications
  LOAD_READY: (
    loadOrderNumber: string,
    driver: string,
    vehicle: string
  ): NotificationTemplate => ({
    subject: `Carga lista - ${loadOrderNumber}`,
    body: `La carga ${loadOrderNumber} está lista para retirar. Chofer: ${driver}, Vehículo: ${vehicle}`,
  }),

  DELIVERY_FAILED: (
    loadOrderNumber: string,
    reason: string
  ): NotificationTemplate => ({
    subject: `⚠️ Entrega fallida - ${loadOrderNumber}`,
    body: `La entrega ${loadOrderNumber} no pudo completarse. Motivo: ${reason}`,
  }),

  // Alerts
  STOCK_LOW: (productName: string, quantity: number): NotificationTemplate => ({
    subject: `⚠️ Stock bajo - ${productName}`,
    body: `El producto ${productName} tiene stock bajo (${quantity} unidades).`,
  }),

  CREDIT_LIMIT_EXCEEDED: (
    clientName: string,
    amount: number
  ): NotificationTemplate => ({
    subject: `⚠️ Límite de crédito excedido - ${clientName}`,
    body: `El cliente ${clientName} ha excedido su límite de crédito por $${amount.toFixed(2)}.`,
  }),
};

/**
 * Send sales event notification
 */
export async function notifySalesEvent(
  eventType: keyof typeof SALES_NOTIFICATION_TEMPLATES,
  recipient: NotificationRecipient,
  templateData: any[],
  options?: NotificationOptions
): Promise<void> {
  const templateFn = SALES_NOTIFICATION_TEMPLATES[eventType];
  const template = templateFn(...templateData);

  await sendNotification(recipient, template, options);
}

/**
 * Batch send notifications to multiple recipients
 */
export async function sendBatchNotifications(
  recipients: NotificationRecipient[],
  template: NotificationTemplate,
  options?: NotificationOptions
): Promise<void> {
  await Promise.allSettled(
    recipients.map((recipient) => sendNotification(recipient, template, options))
  );
}

/**
 * Schedule notification for later
 */
export async function scheduleNotification(
  recipient: NotificationRecipient,
  template: NotificationTemplate,
  scheduleFor: Date,
  options?: NotificationOptions
): Promise<void> {
  // TODO: Integrate with job queue (Bull, BullMQ, etc.)
  // For now, just log
  console.log(
    `[NOTIFICATION] Scheduled for ${scheduleFor.toISOString()}:`,
    template.subject
  );

  // In production, enqueue job:
  /*
  import { notificationQueue } from '@/lib/queue';

  await notificationQueue.add(
    'send-notification',
    { recipient, template, options },
    { delay: scheduleFor.getTime() - Date.now() }
  );
  */
}
