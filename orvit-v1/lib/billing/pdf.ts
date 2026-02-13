/**
 * Generador de PDF para Facturas
 * Genera HTML optimizado para conversión a PDF
 */

import { prisma } from '@/lib/prisma';

const APP_NAME = 'ORVIT';
const COMPANY_INFO = {
  name: 'ORVIT SAS',
  cuit: '30-71234567-8',
  address: 'Av. Corrientes 1234, CABA',
  phone: '+54 11 1234-5678',
  email: 'facturacion@orvit.app',
};

/**
 * Formatea moneda
 */
function formatCurrency(amount: number, currency: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
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

/**
 * Formatea fecha corta
 */
function formatDateShort(date: Date | string): string {
  return new Date(date).toLocaleDateString('es-AR');
}

/**
 * Genera el HTML de una factura para PDF
 */
export async function generateInvoiceHTML(invoiceId: string): Promise<string | null> {
  const invoice = await prisma.billingInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: true,
      payments: {
        where: { status: 'COMPLETED' },
        orderBy: { paidAt: 'desc' },
      },
      subscription: {
        include: {
          user: true,
          plan: true,
        },
      },
      coupon: true,
    },
  });

  if (!invoice) return null;

  const user = invoice.subscription.user;
  const plan = invoice.subscription.plan;
  const planSnapshot = invoice.planSnapshot as any;

  // Determinar estado y color
  const statusInfo: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Borrador', color: '#6B7280', bg: '#F3F4F6' },
    OPEN: { label: 'Pendiente', color: '#D97706', bg: '#FEF3C7' },
    PAID: { label: 'Pagada', color: '#059669', bg: '#D1FAE5' },
    VOID: { label: 'Anulada', color: '#DC2626', bg: '#FEE2E2' },
    UNCOLLECTIBLE: { label: 'Incobrable', color: '#DC2626', bg: '#FEE2E2' },
  };

  const status = statusInfo[invoice.status] || statusInfo.DRAFT;

  // Generar filas de items
  const itemsRows = invoice.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">${item.description}</td>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: right;">${formatCurrency(Number(item.unitPrice), invoice.currency)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: right;">${formatCurrency(Number(item.total), invoice.currency)}</td>
    </tr>
  `).join('');

  // Calcular total pagado
  const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Number(invoice.total) - totalPaid;

  // Generar filas de pagos
  const paymentsRows = invoice.payments.length > 0 ? `
    <div style="margin-top: 30px;">
      <h3 style="font-size: 14px; color: #374151; margin-bottom: 10px;">Pagos Registrados</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: #F9FAFB;">
            <th style="padding: 8px; text-align: left;">Fecha</th>
            <th style="padding: 8px; text-align: left;">Método</th>
            <th style="padding: 8px; text-align: right;">Monto</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.payments.map(p => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #E5E7EB;">${formatDateShort(p.paidAt || p.createdAt)}</td>
              <td style="padding: 8px; border-bottom: 1px solid #E5E7EB;">${p.method}</td>
              <td style="padding: 8px; border-bottom: 1px solid #E5E7EB; text-align: right;">${formatCurrency(Number(p.amount), invoice.currency)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Factura ${invoice.number}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 14px;
      color: #1F2937;
      line-height: 1.5;
      margin: 0;
      padding: 0;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .logo { font-size: 32px; font-weight: bold; color: #8B5CF6; }
    .invoice-info { text-align: right; }
    .invoice-number { font-size: 24px; font-weight: bold; color: #374151; }
    .invoice-date { color: #6B7280; margin-top: 4px; }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      margin-top: 8px;
    }
    .parties { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .party { width: 48%; }
    .party-title { font-size: 12px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .party-name { font-size: 16px; font-weight: 600; color: #374151; }
    .party-details { font-size: 13px; color: #6B7280; margin-top: 4px; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .items-table th { background: #F9FAFB; padding: 12px; text-align: left; font-size: 12px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .totals { margin-left: auto; width: 300px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E7EB; }
    .total-row.grand-total { border-bottom: none; padding-top: 12px; font-size: 18px; font-weight: bold; }
    .notes { margin-top: 40px; padding: 20px; background: #F9FAFB; border-radius: 8px; }
    .notes-title { font-size: 12px; color: #6B7280; text-transform: uppercase; margin-bottom: 8px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 12px; color: #9CA3AF; }
    .period-info { background: #F3F4F6; padding: 12px 16px; border-radius: 6px; margin-bottom: 30px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div>
        <div class="logo">${APP_NAME}</div>
        <div style="font-size: 12px; color: #6B7280; margin-top: 4px;">
          ${COMPANY_INFO.name}<br>
          CUIT: ${COMPANY_INFO.cuit}<br>
          ${COMPANY_INFO.address}
        </div>
      </div>
      <div class="invoice-info">
        <div class="invoice-number">Factura ${invoice.number}</div>
        <div class="invoice-date">Emitida: ${formatDate(invoice.createdAt)}</div>
        <div class="invoice-date">Vencimiento: ${formatDate(invoice.dueDate)}</div>
        <div class="status-badge" style="background: ${status.bg}; color: ${status.color};">
          ${status.label}
        </div>
      </div>
    </div>

    <!-- Parties -->
    <div class="parties">
      <div class="party">
        <div class="party-title">Facturar a</div>
        <div class="party-name">${user.name}</div>
        <div class="party-details">
          ${user.email}<br>
          ${user.phone || ''}
        </div>
      </div>
      <div class="party">
        <div class="party-title">Plan de Suscripción</div>
        <div class="party-name">${planSnapshot?.displayName || plan.displayName}</div>
        <div class="party-details">
          Ciclo: ${invoice.subscription.billingCycle === 'MONTHLY' ? 'Mensual' : 'Anual'}
        </div>
      </div>
    </div>

    <!-- Period -->
    <div class="period-info">
      <strong>Período facturado:</strong> ${formatDateShort(invoice.periodStart)} al ${formatDateShort(invoice.periodEnd)}
    </div>

    <!-- Items -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 50%;">Descripción</th>
          <th style="text-align: center;">Cantidad</th>
          <th style="text-align: right;">Precio Unit.</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals">
      <div class="total-row">
        <span>Subtotal</span>
        <span>${formatCurrency(Number(invoice.subtotal), invoice.currency)}</span>
      </div>
      ${invoice.coupon ? `
      <div class="total-row" style="color: #059669;">
        <span>Descuento (${invoice.coupon.code})</span>
        <span>-${formatCurrency(Number(invoice.discountAmount || 0), invoice.currency)}</span>
      </div>
      ` : ''}
      ${Number(invoice.tax) > 0 ? `
      <div class="total-row">
        <span>IVA (21%)</span>
        <span>${formatCurrency(Number(invoice.tax), invoice.currency)}</span>
      </div>
      ` : ''}
      <div class="total-row grand-total">
        <span>Total</span>
        <span>${formatCurrency(Number(invoice.total), invoice.currency)}</span>
      </div>
      ${invoice.status === 'PAID' ? `
      <div class="total-row" style="color: #059669;">
        <span>Pagado</span>
        <span>${formatCurrency(totalPaid, invoice.currency)}</span>
      </div>
      ` : balance > 0 ? `
      <div class="total-row" style="color: #D97706;">
        <span>Saldo pendiente</span>
        <span>${formatCurrency(balance, invoice.currency)}</span>
      </div>
      ` : ''}
    </div>

    ${paymentsRows}

    ${invoice.notes ? `
    <div class="notes">
      <div class="notes-title">Notas</div>
      <div>${invoice.notes}</div>
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <p>${COMPANY_INFO.name} | ${COMPANY_INFO.email} | ${COMPANY_INFO.phone}</p>
      <p>Documento generado electrónicamente - ${formatDate(new Date())}</p>
    </div>
  </div>
</body>
</html>
  `;

  return html;
}

/**
 * Datos de factura para la API
 */
export async function getInvoiceForPDF(invoiceId: string) {
  const invoice = await prisma.billingInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: true,
      payments: {
        where: { status: 'COMPLETED' },
      },
      subscription: {
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          plan: { select: { id: true, displayName: true } },
        },
      },
      coupon: { select: { code: true, name: true } },
    },
  });

  if (!invoice) return null;

  return {
    ...invoice,
    subtotal: Number(invoice.subtotal),
    tax: Number(invoice.tax),
    total: Number(invoice.total),
    discountAmount: invoice.discountAmount ? Number(invoice.discountAmount) : 0,
    items: invoice.items.map(item => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    })),
    payments: invoice.payments.map(payment => ({
      ...payment,
      amount: Number(payment.amount),
    })),
  };
}
