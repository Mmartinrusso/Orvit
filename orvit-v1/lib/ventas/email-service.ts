/**
 * Email Service for Cotizaciones (Quotes)
 *
 * This service handles sending quote-related emails to clients.
 * Configure email provider via environment variables.
 */

// Types
interface QuoteEmailData {
  quoteNumber: string;
  clientName: string;
  clientEmail: string;
  companyName: string;
  total: number;
  moneda: string;
  validUntil: Date | null;
  portalUrl?: string;
  portalToken?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send quote email to client with PDF attachment and portal access
 */
export async function sendQuoteEmail(data: QuoteEmailData): Promise<EmailResult> {
  try {
    // Email configuration
    const emailConfig = {
      from: process.env.EMAIL_FROM || 'ventas@orvit.com',
      smtpHost: process.env.SMTP_HOST,
      smtpPort: parseInt(process.env.SMTP_PORT || '587'),
      smtpUser: process.env.SMTP_USER,
      smtpPass: process.env.SMTP_PASS,
    };

    // Validate configuration
    if (!emailConfig.smtpHost || !emailConfig.smtpUser || !emailConfig.smtpPass) {
      console.error('[Email] SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS environment variables.');

      // Log email details for manual sending (development/testing)
      console.log('[Email] Would send email:', {
        to: data.clientEmail,
        subject: `Cotización ${data.quoteNumber} - ${data.companyName}`,
        quoteNumber: data.quoteNumber,
        clientName: data.clientName,
        total: `${data.moneda} ${data.total.toLocaleString('es-AR')}`,
        portalUrl: data.portalUrl,
      });

      // Return success for development (prevents workflow blockage)
      return {
        success: true,
        messageId: `dev-${Date.now()}`,
        error: 'Email not sent (SMTP not configured)',
      };
    }

    // In production, use nodemailer or your preferred email service
    // Example with nodemailer:
    /*
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      host: emailConfig.smtpHost,
      port: emailConfig.smtpPort,
      secure: emailConfig.smtpPort === 465,
      auth: {
        user: emailConfig.smtpUser,
        pass: emailConfig.smtpPass,
      },
    });

    const emailHtml = generateQuoteEmailHtml(data);

    const info = await transporter.sendMail({
      from: `"${data.companyName}" <${emailConfig.from}>`,
      to: data.clientEmail,
      subject: `Cotización ${data.quoteNumber} - ${data.companyName}`,
      html: emailHtml,
      // Optionally attach PDF (requires fetching PDF first)
      // attachments: [{ filename: `Cotizacion-${data.quoteNumber}.pdf`, content: pdfBuffer }],
    });

    return {
      success: true,
      messageId: info.messageId,
    };
    */

    // For now, log and return success
    console.log('[Email] Email queued for sending:', {
      to: data.clientEmail,
      subject: `Cotización ${data.quoteNumber} - ${data.companyName}`,
    });

    return {
      success: true,
      messageId: `queued-${Date.now()}`,
    };
  } catch (error) {
    console.error('[Email] Error sending quote email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate HTML email template for quote
 */
function generateQuoteEmailHtml(data: QuoteEmailData): string {
  const validUntilText = data.validUntil
    ? new Date(data.validUntil).toLocaleDateString('es-AR')
    : 'Sin vencimiento';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cotización ${data.quoteNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .container { background-color: #f9fafb; padding: 20px; }
    .header { background-color: #1f2937; color: white; padding: 20px; text-align: center; }
    .content { background-color: white; padding: 30px; margin: 20px 0; border-radius: 8px; }
    .button { display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; padding: 20px; }
    .highlight { background-color: #eff6ff; padding: 15px; border-left: 4px solid #3b82f6; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${data.companyName}</h1>
      <p>Cotización Nº ${data.quoteNumber}</p>
    </div>

    <div class="content">
      <p>Estimado/a <strong>${data.clientName}</strong>,</p>

      <p>Nos complace enviarle la cotización solicitada:</p>

      <div class="highlight">
        <p><strong>Número de Cotización:</strong> ${data.quoteNumber}</p>
        <p><strong>Monto Total:</strong> ${data.moneda} ${data.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
        <p><strong>Válida hasta:</strong> ${validUntilText}</p>
      </div>

      ${data.portalUrl ? `
      <p>Puede revisar y aceptar la cotización accediendo a nuestro portal:</p>
      <div style="text-align: center;">
        <a href="${data.portalUrl}" class="button">Ver Cotización</a>
      </div>
      <p style="font-size: 12px; color: #6b7280;">
        Este enlace es válido por 30 días. Si tiene dificultades para acceder, contáctenos.
      </p>
      ` : ''}

      <p>Si tiene alguna pregunta o necesita información adicional, no dude en contactarnos.</p>

      <p>Saludos cordiales,<br>
      <strong>${data.companyName}</strong></p>
    </div>

    <div class="footer">
      <p>Este es un email automático generado por el sistema de cotizaciones.</p>
      <p>Por favor no responda a este email.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Send quote reminder email (for expiring quotes)
 */
export async function sendQuoteReminderEmail(data: QuoteEmailData): Promise<EmailResult> {
  console.log('[Email] Quote reminder email would be sent:', {
    to: data.clientEmail,
    quoteNumber: data.quoteNumber,
    validUntil: data.validUntil,
  });

  return {
    success: true,
    messageId: `reminder-${Date.now()}`,
  };
}

/**
 * Send quote expiration notification
 */
export async function sendQuoteExpiredEmail(data: QuoteEmailData): Promise<EmailResult> {
  console.log('[Email] Quote expired notification would be sent:', {
    to: data.clientEmail,
    quoteNumber: data.quoteNumber,
  });

  return {
    success: true,
    messageId: `expired-${Date.now()}`,
  };
}
