/**
 * Servicio de Facturación de Billing
 * Maneja la creación de facturas, items y pagos
 */

import { prisma } from '@/lib/prisma';
import { Prisma, BillingInvoiceStatus, BillingPaymentStatus, BillingCycle, DocType } from '@prisma/client';
import { logBillingAction } from './audit';

// Generar IDs
function generateInvoiceId(): string {
  return `inv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateItemId(): string {
  return `itm_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

function generatePaymentId(): string {
  return `pay_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Genera un número de factura único
 * Formato: INV-YYYYMM-XXXX (ej: INV-202601-0001)
 */
export async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `INV-${yearMonth}-`;

  // Obtener el último número del mes
  const lastInvoice = await prisma.billingInvoice.findFirst({
    where: {
      number: { startsWith: prefix },
    },
    orderBy: { number: 'desc' },
  });

  let nextNumber = 1;
  if (lastInvoice) {
    const lastNumber = parseInt(lastInvoice.number.split('-')[2], 10);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}

export interface PlanSnapshot {
  planId: string;
  name: string;
  displayName: string;
  monthlyPrice: number;
  annualPrice: number | null;
  billingCycle: BillingCycle;
  capturedAt: string;
}

/**
 * Crea un snapshot del plan para la factura
 * El snapshot se guarda en la factura y no cambia aunque el plan se modifique
 */
export function createPlanSnapshot(
  plan: {
    id: string;
    name: string;
    displayName: string;
    monthlyPrice: Prisma.Decimal;
    annualPrice: Prisma.Decimal | null;
  },
  billingCycle: BillingCycle
): PlanSnapshot {
  return {
    planId: plan.id,
    name: plan.name,
    displayName: plan.displayName,
    monthlyPrice: Number(plan.monthlyPrice),
    annualPrice: plan.annualPrice ? Number(plan.annualPrice) : null,
    billingCycle,
    capturedAt: new Date().toISOString(),
  };
}

export interface InvoiceItemInput {
  type: 'SUBSCRIPTION' | 'TOKENS' | 'ADDON' | 'PRORATION';
  description: string;
  quantity?: number;
  unitPrice: number;
  metadata?: Record<string, any>;
}

export interface CreateInvoiceInput {
  subscriptionId: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  items: InvoiceItemInput[];
  docType?: 'T1' | 'T2';
  notes?: string;
  taxRate?: number; // Porcentaje, ej: 21 para 21%
}

/**
 * Crea una factura con sus items
 */
export async function createInvoice(input: CreateInvoiceInput) {
  const {
    subscriptionId,
    periodStart,
    periodEnd,
    dueDate,
    items,
    docType = 'T1',
    notes,
    taxRate = 0,
  } = input;

  // Obtener suscripción con plan
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    throw new Error('Suscripción no encontrada');
  }

  // Calcular totales
  const subtotal = items.reduce((sum, item) => {
    const itemTotal = (item.quantity || 1) * item.unitPrice;
    return sum + itemTotal;
  }, 0);

  const tax = taxRate > 0 ? subtotal * (taxRate / 100) : 0;
  const total = subtotal + tax;

  // Generar IDs y número
  const invoiceId = generateInvoiceId();
  const invoiceNumber = await generateInvoiceNumber();

  // Crear snapshot del plan
  const planSnapshot = createPlanSnapshot(subscription.plan, subscription.billingCycle);

  // Crear factura con items en una transacción
  const invoice = await prisma.$transaction(async (tx) => {
    // Crear factura
    const createdInvoice = await tx.billingInvoice.create({
      data: {
        id: invoiceId,
        number: invoiceNumber,
        subscriptionId,
        currency: subscription.plan.currency,
        subtotal: new Prisma.Decimal(subtotal),
        tax: new Prisma.Decimal(tax),
        total: new Prisma.Decimal(total),
        status: 'DRAFT',
        periodStart,
        periodEnd,
        dueDate,
        planSnapshot: planSnapshot as any,
        docType: docType as DocType,
        notes,
      },
    });

    // Crear items
    for (const item of items) {
      const itemTotal = (item.quantity || 1) * item.unitPrice;
      await tx.billingInvoiceItem.create({
        data: {
          id: generateItemId(),
          invoiceId,
          type: item.type,
          description: item.description,
          quantity: item.quantity || 1,
          unitPrice: new Prisma.Decimal(item.unitPrice),
          total: new Prisma.Decimal(itemTotal),
          metadata: item.metadata as any,
        },
      });
    }

    return createdInvoice;
  });

  return invoice;
}

/**
 * Actualiza el estado de una factura
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: BillingInvoiceStatus,
  userId?: number
) {
  const invoice = await prisma.billingInvoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    throw new Error('Factura no encontrada');
  }

  const oldStatus = invoice.status;

  const updated = await prisma.billingInvoice.update({
    where: { id: invoiceId },
    data: {
      status,
      paidAt: status === 'PAID' ? new Date() : invoice.paidAt,
    },
  });

  // Registrar en audit log
  if (userId) {
    await logBillingAction(
      userId,
      'INVOICE_STATUS_CHANGE',
      'invoice',
      invoiceId,
      { status: oldStatus },
      { status }
    );
  }

  return updated;
}

/**
 * Abre una factura (la pone disponible para pago)
 */
export async function openInvoice(invoiceId: string, userId?: number) {
  return updateInvoiceStatus(invoiceId, 'OPEN', userId);
}

export interface PaymentInput {
  amount: number;
  method: 'CASH' | 'TRANSFER' | 'CARD' | 'MERCADOPAGO' | 'STRIPE';
  docType?: 'T1' | 'T2';
  notes?: string;
  providerPaymentId?: string;
  providerRef?: string;
}

/**
 * Registra un pago para una factura
 */
export async function registerPayment(
  invoiceId: string,
  payment: PaymentInput,
  receivedByUserId?: number
) {
  const invoice = await prisma.billingInvoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });

  if (!invoice) {
    throw new Error('Factura no encontrada');
  }

  if (invoice.status === 'PAID') {
    throw new Error('La factura ya está pagada');
  }

  if (invoice.status === 'VOID') {
    throw new Error('La factura está anulada');
  }

  // Calcular total ya pagado
  const totalPaid = invoice.payments
    .filter(p => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const remaining = Number(invoice.total) - totalPaid;

  if (payment.amount > remaining) {
    throw new Error(`El monto excede el saldo pendiente (${remaining})`);
  }

  const paymentId = generatePaymentId();
  const now = new Date();

  // Crear pago y actualizar factura si corresponde
  const result = await prisma.$transaction(async (tx) => {
    const createdPayment = await tx.billingPayment.create({
      data: {
        id: paymentId,
        invoiceId,
        amount: new Prisma.Decimal(payment.amount),
        currency: invoice.currency,
        method: payment.method,
        status: 'COMPLETED',
        docType: (payment.docType || 'T1') as DocType,
        notes: payment.notes,
        providerPaymentId: payment.providerPaymentId,
        providerRef: payment.providerRef,
        receivedBy: receivedByUserId,
        paidAt: now,
      },
    });

    // Si el pago completa la factura, marcarla como pagada
    const newTotalPaid = totalPaid + payment.amount;
    if (newTotalPaid >= Number(invoice.total)) {
      await tx.billingInvoice.update({
        where: { id: invoiceId },
        data: {
          status: 'PAID',
          paidAt: now,
        },
      });
    }

    return createdPayment;
  });

  // Registrar en audit log
  if (receivedByUserId) {
    await logBillingAction(
      receivedByUserId,
      'PAYMENT_RECEIVED',
      'payment',
      paymentId,
      null,
      {
        invoiceId,
        amount: payment.amount,
        method: payment.method,
        docType: payment.docType || 'T1',
      }
    );
  }

  return result;
}

/**
 * Anula una factura
 */
export async function voidInvoice(invoiceId: string, reason: string, userId?: number) {
  const invoice = await prisma.billingInvoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });

  if (!invoice) {
    throw new Error('Factura no encontrada');
  }

  if (invoice.status === 'PAID') {
    throw new Error('No se puede anular una factura pagada. Debe generar una nota de crédito.');
  }

  // Si tiene pagos pendientes, rechazarlos
  const updated = await prisma.$transaction(async (tx) => {
    // Marcar pagos pendientes como fallidos
    await tx.billingPayment.updateMany({
      where: {
        invoiceId,
        status: 'PENDING',
      },
      data: {
        status: 'FAILED',
      },
    });

    // Anular factura
    return tx.billingInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'VOID',
        notes: invoice.notes
          ? `${invoice.notes}\n\n[ANULADA] ${reason}`
          : `[ANULADA] ${reason}`,
      },
    });
  });

  // Audit log
  if (userId) {
    await logBillingAction(
      userId,
      'INVOICE_VOIDED',
      'invoice',
      invoiceId,
      { status: invoice.status },
      { status: 'VOID', reason }
    );
  }

  return updated;
}

/**
 * Obtiene una factura con todos sus detalles
 */
export async function getInvoiceWithDetails(invoiceId: string) {
  return prisma.billingInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: true,
      payments: {
        include: {
          receivedByUser: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      subscription: {
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
          plan: true,
        },
      },
    },
  });
}

/**
 * Lista facturas con filtros
 */
export async function listInvoices(options?: {
  subscriptionId?: string;
  status?: BillingInvoiceStatus;
  docType?: 'T1' | 'T2';
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};

  if (options?.subscriptionId) {
    where.subscriptionId = options.subscriptionId;
  }

  if (options?.status) {
    where.status = options.status;
  }

  if (options?.docType) {
    where.docType = options.docType;
  }

  if (options?.from || options?.to) {
    where.createdAt = {};
    if (options.from) where.createdAt.gte = options.from;
    if (options.to) where.createdAt.lte = options.to;
  }

  const [invoices, total] = await Promise.all([
    prisma.billingInvoice.findMany({
      where,
      include: {
        subscription: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            plan: {
              select: { id: true, name: true, displayName: true },
            },
          },
        },
        _count: {
          select: { items: true, payments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    }),
    prisma.billingInvoice.count({ where }),
  ]);

  return {
    invoices,
    total,
    hasMore: (options?.offset || 0) + invoices.length < total,
  };
}

/**
 * Genera la factura de renovación de suscripción
 */
export async function generateRenewalInvoice(subscriptionId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    throw new Error('Suscripción no encontrada');
  }

  // Calcular período
  const periodStart = subscription.currentPeriodEnd;
  const periodEnd = new Date(periodStart);
  if (subscription.billingCycle === 'MONTHLY') {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  }

  // Calcular fecha de vencimiento (15 días después)
  const dueDate = new Date(periodStart);
  dueDate.setDate(dueDate.getDate() + 15);

  // Determinar precio según ciclo
  const price = subscription.billingCycle === 'ANNUAL' && subscription.plan.annualPrice
    ? Number(subscription.plan.annualPrice)
    : Number(subscription.plan.monthlyPrice);

  const items: InvoiceItemInput[] = [
    {
      type: 'SUBSCRIPTION',
      description: `${subscription.plan.displayName} - ${subscription.billingCycle === 'MONTHLY' ? 'Mensual' : 'Anual'}`,
      quantity: 1,
      unitPrice: price,
    },
  ];

  return createInvoice({
    subscriptionId,
    periodStart,
    periodEnd,
    dueDate,
    items,
    docType: 'T1',
  });
}

/**
 * Obtiene resumen de facturación para dashboard
 */
export async function getBillingSummary(options?: {
  from?: Date;
  to?: Date;
}) {
  const where: any = {};

  if (options?.from || options?.to) {
    where.createdAt = {};
    if (options.from) where.createdAt.gte = options.from;
    if (options.to) where.createdAt.lte = options.to;
  }

  const [invoices, payments] = await Promise.all([
    prisma.billingInvoice.groupBy({
      by: ['status'],
      where,
      _sum: { total: true },
      _count: true,
    }),
    prisma.billingPayment.groupBy({
      by: ['status', 'method'],
      where: {
        invoice: where,
      },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  // Calcular totales
  const invoiceSummary = {
    draft: { count: 0, total: 0 },
    open: { count: 0, total: 0 },
    paid: { count: 0, total: 0 },
    void: { count: 0, total: 0 },
    uncollectible: { count: 0, total: 0 },
  };

  for (const inv of invoices) {
    const key = inv.status.toLowerCase() as keyof typeof invoiceSummary;
    if (key in invoiceSummary) {
      invoiceSummary[key] = {
        count: inv._count,
        total: Number(inv._sum.total || 0),
      };
    }
  }

  const paymentSummary: Record<string, { count: number; total: number }> = {};
  for (const pay of payments) {
    if (pay.status === 'COMPLETED') {
      if (!paymentSummary[pay.method]) {
        paymentSummary[pay.method] = { count: 0, total: 0 };
      }
      paymentSummary[pay.method].count += pay._count;
      paymentSummary[pay.method].total += Number(pay._sum.amount || 0);
    }
  }

  return {
    invoices: invoiceSummary,
    payments: paymentSummary,
    totalRevenue: invoiceSummary.paid.total,
    pendingRevenue: invoiceSummary.open.total,
  };
}
