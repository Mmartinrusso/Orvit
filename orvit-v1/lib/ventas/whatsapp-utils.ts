/**
 * WhatsApp Utilities for Ventas Module
 *
 * Generates wa.me links with pre-composed messages.
 * No API required - opens WhatsApp with the message ready to send.
 */

// =====================================================
// TYPES
// =====================================================

export interface WhatsAppMessageData {
  phone: string;
  message: string;
}

export interface QuoteMessageData {
  clientName: string;
  quoteNumber: string;
  total: number;
  currency: string;
  validUntil?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
  companyName: string;
  sellerName?: string;
  sellerPhone?: string;
}

export interface OrderMessageData {
  clientName: string;
  orderNumber: string;
  total: number;
  currency: string;
  deliveryDate?: string;
  companyName: string;
}

export interface InvoiceMessageData {
  clientName: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  dueDate?: string;
  companyName: string;
}

export interface DeliveryMessageData {
  clientName: string;
  deliveryNumber: string;
  orderNumber?: string;
  scheduledDate?: string;
  address?: string;
  driverName?: string;
  driverPhone?: string;
  companyName: string;
  status: 'scheduled' | 'dispatched' | 'delivered' | 'failed';
}

export interface PaymentReminderData {
  clientName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate: string;
  daysOverdue?: number;
  companyName: string;
}

export interface CollectionConfirmationData {
  clientName: string;
  paymentNumber: string;
  amount: number;
  currency: string;
  companyName: string;
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Normalizes a phone number for WhatsApp
 * Removes spaces, dashes, and ensures country code
 */
export function normalizePhoneForWhatsApp(phone: string, defaultCountryCode: string = '54'): string {
  if (!phone) return '';

  // Remove all non-numeric characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If starts with +, remove it (wa.me doesn't need it)
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // If doesn't start with country code, add Argentina's
  if (!cleaned.startsWith(defaultCountryCode) && cleaned.length <= 10) {
    // Argentine mobile numbers: remove leading 0 if present, add 54 9
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    // Add country code + 9 for mobile
    cleaned = `${defaultCountryCode}9${cleaned}`;
  }

  return cleaned;
}

/**
 * Generates a wa.me URL with pre-composed message
 */
export function generateWhatsAppLink(phone: string, message: string): string {
  const normalizedPhone = normalizePhoneForWhatsApp(phone);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
}

/**
 * Opens WhatsApp in a new tab/window
 */
export function openWhatsApp(phone: string, message: string): void {
  const url = generateWhatsAppLink(phone, message);
  window.open(url, '_blank');
}

// =====================================================
// MESSAGE FORMATTERS
// =====================================================

/**
 * Format currency for display in messages
 */
function formatCurrency(amount: number, currency: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Format date for display in messages
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

// =====================================================
// MESSAGE GENERATORS
// =====================================================

/**
 * Generate message for sending a quote
 */
export function generateQuoteMessage(data: QuoteMessageData): string {
  const lines = [
    `Hola ${data.clientName}!`,
    '',
    `Le enviamos la cotización *${data.quoteNumber}* de *${data.companyName}*:`,
    '',
  ];

  // Add items if provided
  if (data.items && data.items.length > 0) {
    lines.push('*Detalle:*');
    data.items.slice(0, 5).forEach(item => {
      lines.push(`• ${item.name} x${item.quantity} - ${formatCurrency(item.price, data.currency)}`);
    });
    if (data.items.length > 5) {
      lines.push(`... y ${data.items.length - 5} items más`);
    }
    lines.push('');
  }

  lines.push(`*Total: ${formatCurrency(data.total, data.currency)}*`);

  if (data.validUntil) {
    lines.push(`Válida hasta: ${formatDate(data.validUntil)}`);
  }

  lines.push('');
  lines.push('Quedamos a disposición para cualquier consulta.');

  if (data.sellerName) {
    lines.push('');
    lines.push(`Saludos,`);
    lines.push(`${data.sellerName}`);
    lines.push(`${data.companyName}`);
  }

  return lines.join('\n');
}

/**
 * Generate message for order confirmation
 */
export function generateOrderConfirmationMessage(data: OrderMessageData): string {
  const lines = [
    `Hola ${data.clientName}!`,
    '',
    `Confirmamos su pedido *${data.orderNumber}* en *${data.companyName}*.`,
    '',
    `*Total: ${formatCurrency(data.total, data.currency)}*`,
  ];

  if (data.deliveryDate) {
    lines.push(`Fecha de entrega estimada: ${formatDate(data.deliveryDate)}`);
  }

  lines.push('');
  lines.push('Le avisaremos cuando esté listo para entrega.');
  lines.push('');
  lines.push('Gracias por su compra!');

  return lines.join('\n');
}

/**
 * Generate message for invoice sent
 */
export function generateInvoiceMessage(data: InvoiceMessageData): string {
  const lines = [
    `Hola ${data.clientName}!`,
    '',
    `Le enviamos la factura *${data.invoiceNumber}* de *${data.companyName}*.`,
    '',
    `*Total: ${formatCurrency(data.total, data.currency)}*`,
  ];

  if (data.dueDate) {
    lines.push(`Vencimiento: ${formatDate(data.dueDate)}`);
  }

  lines.push('');
  lines.push('Puede abonar mediante transferencia o en nuestras oficinas.');
  lines.push('');
  lines.push('Saludos cordiales.');

  return lines.join('\n');
}

/**
 * Generate message for delivery notifications
 */
export function generateDeliveryMessage(data: DeliveryMessageData): string {
  const lines: string[] = [];

  switch (data.status) {
    case 'scheduled':
      lines.push(`Hola ${data.clientName}!`);
      lines.push('');
      lines.push(`Su entrega *${data.deliveryNumber}* ha sido programada.`);
      if (data.scheduledDate) {
        lines.push(`Fecha: ${formatDate(data.scheduledDate)}`);
      }
      if (data.address) {
        lines.push(`Dirección: ${data.address}`);
      }
      break;

    case 'dispatched':
      lines.push(`Hola ${data.clientName}!`);
      lines.push('');
      lines.push(`Su pedido *${data.orderNumber || data.deliveryNumber}* está en camino!`);
      if (data.driverName) {
        lines.push(`Transportista: ${data.driverName}`);
      }
      if (data.driverPhone) {
        lines.push(`Tel: ${data.driverPhone}`);
      }
      if (data.address) {
        lines.push(`Destino: ${data.address}`);
      }
      break;

    case 'delivered':
      lines.push(`Hola ${data.clientName}!`);
      lines.push('');
      lines.push(`Su entrega *${data.deliveryNumber}* fue completada exitosamente.`);
      lines.push('');
      lines.push('Gracias por su confianza!');
      break;

    case 'failed':
      lines.push(`Hola ${data.clientName}!`);
      lines.push('');
      lines.push(`No pudimos completar la entrega *${data.deliveryNumber}*.`);
      lines.push('');
      lines.push('Por favor contáctenos para coordinar un nuevo intento.');
      break;
  }

  lines.push('');
  lines.push(`- ${data.companyName}`);

  return lines.join('\n');
}

/**
 * Generate message for payment reminder
 */
export function generatePaymentReminderMessage(data: PaymentReminderData): string {
  const lines = [
    `Hola ${data.clientName}!`,
    '',
  ];

  if (data.daysOverdue && data.daysOverdue > 0) {
    lines.push(`Le recordamos que la factura *${data.invoiceNumber}* venció hace ${data.daysOverdue} días.`);
  } else {
    lines.push(`Le recordamos que la factura *${data.invoiceNumber}* vence el ${formatDate(data.dueDate)}.`);
  }

  lines.push('');
  lines.push(`*Monto: ${formatCurrency(data.amount, data.currency)}*`);
  lines.push('');
  lines.push('Por favor contáctenos si tiene alguna consulta sobre el pago.');
  lines.push('');
  lines.push(`Saludos,`);
  lines.push(`${data.companyName}`);

  return lines.join('\n');
}

/**
 * Generate message for collection/payment confirmation
 */
export function generateCollectionConfirmationMessage(data: CollectionConfirmationData): string {
  const lines = [
    `Hola ${data.clientName}!`,
    '',
    `Confirmamos la recepción de su pago *${data.paymentNumber}*.`,
    '',
    `*Monto recibido: ${formatCurrency(data.amount, data.currency)}*`,
    '',
    'Muchas gracias!',
    '',
    `- ${data.companyName}`,
  ];

  return lines.join('\n');
}

// =====================================================
// QUICK ACTION GENERATORS
// =====================================================

/**
 * Generate a simple custom message
 */
export function generateCustomMessage(
  clientName: string,
  subject: string,
  body: string,
  companyName: string
): string {
  return [
    `Hola ${clientName}!`,
    '',
    subject,
    '',
    body,
    '',
    `- ${companyName}`,
  ].join('\n');
}

/**
 * Generate a follow-up message for quotes
 */
export function generateQuoteFollowUpMessage(
  clientName: string,
  quoteNumber: string,
  daysSinceQuote: number,
  companyName: string
): string {
  const lines = [
    `Hola ${clientName}!`,
    '',
  ];

  if (daysSinceQuote <= 3) {
    lines.push(`Le escribimos para saber si pudo revisar la cotización *${quoteNumber}* que le enviamos.`);
  } else if (daysSinceQuote <= 7) {
    lines.push(`Queríamos consultar si tiene alguna duda sobre la cotización *${quoteNumber}*.`);
  } else {
    lines.push(`Hace unos días le enviamos la cotización *${quoteNumber}*. ¿Sigue interesado?`);
  }

  lines.push('');
  lines.push('Quedamos a disposición para cualquier consulta.');
  lines.push('');
  lines.push(`Saludos,`);
  lines.push(`${companyName}`);

  return lines.join('\n');
}
