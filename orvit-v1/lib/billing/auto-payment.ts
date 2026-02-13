/**
 * Servicio de Débito Automático / Pagos Recurrentes
 * Integración con Stripe y MercadoPago para cobros automáticos
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { logBillingAction } from './audit';
import { registerPayment } from './invoicing';

// Generar ID
function generateConfigId(): string {
  return `apc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

export type PaymentProvider = 'STRIPE' | 'MERCADOPAGO';

export interface CardInfo {
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
}

export interface SetupAutoPaymentInput {
  subscriptionId: string;
  provider: PaymentProvider;
  providerCustomerId?: string;
  providerPaymentMethodId: string;
  providerSubscriptionId?: string;
  card: CardInfo;
}

/**
 * Configura débito automático para una suscripción
 */
export async function setupAutoPayment(
  input: SetupAutoPaymentInput,
  userId?: number
) {
  const {
    subscriptionId,
    provider,
    providerCustomerId,
    providerPaymentMethodId,
    providerSubscriptionId,
    card,
  } = input;

  // Verificar que existe la suscripción
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new Error('Suscripción no encontrada');
  }

  const configId = generateConfigId();

  const config = await prisma.billingAutoPaymentConfig.upsert({
    where: { subscriptionId },
    create: {
      id: configId,
      subscriptionId,
      provider,
      providerCustomerId,
      providerPaymentMethodId,
      providerSubscriptionId,
      cardLast4: card.last4,
      cardBrand: card.brand,
      cardExpMonth: card.expMonth,
      cardExpYear: card.expYear,
      isEnabled: true,
    },
    update: {
      provider,
      providerCustomerId,
      providerPaymentMethodId,
      providerSubscriptionId,
      cardLast4: card.last4,
      cardBrand: card.brand,
      cardExpMonth: card.expMonth,
      cardExpYear: card.expYear,
      isEnabled: true,
      failedAttempts: 0,
      lastFailureReason: null,
    },
  });

  // También actualizar datos en la suscripción
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      providerCustomerId,
      providerSubscriptionId,
    },
  });

  // Audit log
  if (userId) {
    await logBillingAction(
      userId,
      'AUTO_PAYMENT_SETUP',
      'subscription',
      subscriptionId,
      null,
      {
        provider,
        cardLast4: card.last4,
        cardBrand: card.brand,
      }
    );
  }

  return config;
}

/**
 * Obtiene la configuración de débito automático
 */
export async function getAutoPaymentConfig(subscriptionId: string) {
  const config = await prisma.billingAutoPaymentConfig.findUnique({
    where: { subscriptionId },
    include: {
      subscription: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          plan: { select: { id: true, displayName: true } },
        },
      },
    },
  });

  return config;
}

/**
 * Desactiva el débito automático
 */
export async function disableAutoPayment(subscriptionId: string, userId?: number) {
  const config = await prisma.billingAutoPaymentConfig.update({
    where: { subscriptionId },
    data: { isEnabled: false },
  });

  if (userId) {
    await logBillingAction(
      userId,
      'AUTO_PAYMENT_DISABLED',
      'subscription',
      subscriptionId,
      { isEnabled: true },
      { isEnabled: false }
    );
  }

  return config;
}

/**
 * Reactiva el débito automático
 */
export async function enableAutoPayment(subscriptionId: string, userId?: number) {
  const config = await prisma.billingAutoPaymentConfig.update({
    where: { subscriptionId },
    data: {
      isEnabled: true,
      failedAttempts: 0,
      lastFailureReason: null,
    },
  });

  if (userId) {
    await logBillingAction(
      userId,
      'AUTO_PAYMENT_ENABLED',
      'subscription',
      subscriptionId,
      { isEnabled: false },
      { isEnabled: true }
    );
  }

  return config;
}

/**
 * Procesa un cobro automático para una factura
 * Retorna el resultado del intento de cobro
 */
export async function processAutoPayment(invoiceId: string): Promise<{
  success: boolean;
  paymentId?: string;
  error?: string;
  requiresAction?: boolean;
  actionUrl?: string;
}> {
  // Obtener factura con suscripción y config
  const invoice = await prisma.billingInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      subscription: {
        include: {
          autoPaymentConfig: true,
        },
      },
    },
  });

  if (!invoice) {
    return { success: false, error: 'Factura no encontrada' };
  }

  if (invoice.status !== 'OPEN') {
    return { success: false, error: 'La factura no está abierta para pago' };
  }

  const config = invoice.subscription.autoPaymentConfig;

  if (!config || !config.isEnabled) {
    return { success: false, error: 'Débito automático no configurado o deshabilitado' };
  }

  try {
    let result: { success: boolean; paymentId?: string; error?: string; requiresAction?: boolean; actionUrl?: string };

    // Procesar según proveedor
    if (config.provider === 'STRIPE') {
      result = await processStripePayment(invoice, config);
    } else if (config.provider === 'MERCADOPAGO') {
      result = await processMercadoPagoPayment(invoice, config);
    } else {
      return { success: false, error: 'Proveedor no soportado' };
    }

    if (result.success && result.paymentId) {
      // Registrar pago exitoso
      await registerPayment(
        invoiceId,
        {
          amount: Number(invoice.total),
          method: config.provider,
          providerPaymentId: result.paymentId,
          notes: 'Pago automático',
        },
        0 // Sistema
      );

      // Actualizar config
      await prisma.billingAutoPaymentConfig.update({
        where: { id: config.id },
        data: {
          lastPaymentAt: new Date(),
          failedAttempts: 0,
          lastFailureReason: null,
        },
      });

      // Audit log
      await logBillingAction(
        0,
        'AUTO_PAYMENT_SUCCESS',
        'invoice',
        invoiceId,
        null,
        {
          provider: config.provider,
          paymentId: result.paymentId,
          amount: Number(invoice.total),
        }
      );
    } else if (!result.success) {
      // Registrar fallo
      await prisma.billingAutoPaymentConfig.update({
        where: { id: config.id },
        data: {
          failedAttempts: { increment: 1 },
          lastFailureReason: result.error,
        },
      });

      // Si hay muchos fallos, desactivar
      if (config.failedAttempts >= 2) {
        await prisma.billingAutoPaymentConfig.update({
          where: { id: config.id },
          data: { isEnabled: false },
        });
      }

      await logBillingAction(
        0,
        'AUTO_PAYMENT_FAILED',
        'invoice',
        invoiceId,
        null,
        {
          provider: config.provider,
          error: result.error,
          attemptNumber: config.failedAttempts + 1,
        }
      );
    }

    return result;
  } catch (error: any) {
    console.error('Error procesando pago automático:', error);
    return {
      success: false,
      error: error.message || 'Error interno procesando pago',
    };
  }
}

/**
 * Procesa pago con Stripe
 */
async function processStripePayment(
  invoice: any,
  config: any
): Promise<{
  success: boolean;
  paymentId?: string;
  error?: string;
  requiresAction?: boolean;
  actionUrl?: string;
}> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    return { success: false, error: 'Stripe no configurado' };
  }

  try {
    // Crear PaymentIntent con el método de pago guardado
    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: Math.round(Number(invoice.total) * 100).toString(), // Stripe usa centavos
        currency: invoice.currency.toLowerCase(),
        customer: config.providerCustomerId || '',
        payment_method: config.providerPaymentMethodId,
        off_session: 'true',
        confirm: 'true',
        'metadata[invoiceId]': invoice.id,
        'metadata[subscriptionId]': invoice.subscriptionId,
      }),
    });

    const paymentIntent = await response.json();

    if (paymentIntent.error) {
      return {
        success: false,
        error: paymentIntent.error.message || 'Error de Stripe',
      };
    }

    if (paymentIntent.status === 'succeeded') {
      return {
        success: true,
        paymentId: paymentIntent.id,
      };
    }

    if (paymentIntent.status === 'requires_action') {
      return {
        success: false,
        requiresAction: true,
        actionUrl: paymentIntent.next_action?.redirect_to_url?.url,
        error: 'Se requiere autenticación adicional',
      };
    }

    return {
      success: false,
      error: `Estado inesperado: ${paymentIntent.status}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error conectando con Stripe',
    };
  }
}

/**
 * Procesa pago con MercadoPago
 */
async function processMercadoPagoPayment(
  invoice: any,
  config: any
): Promise<{
  success: boolean;
  paymentId?: string;
  error?: string;
  requiresAction?: boolean;
  actionUrl?: string;
}> {
  const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!mpAccessToken) {
    return { success: false, error: 'MercadoPago no configurado' };
  }

  try {
    // Crear pago con el método guardado
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `inv_${invoice.id}_${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: Number(invoice.total),
        token: config.providerPaymentMethodId, // Card token
        description: `Factura ${invoice.number}`,
        installments: 1,
        payment_method_id: config.cardBrand?.toLowerCase() || 'visa',
        payer: {
          id: config.providerCustomerId,
        },
        external_reference: invoice.id,
        metadata: {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscriptionId,
        },
      }),
    });

    const payment = await response.json();

    if (payment.status === 'approved') {
      return {
        success: true,
        paymentId: payment.id.toString(),
      };
    }

    if (payment.status === 'pending' || payment.status === 'in_process') {
      return {
        success: false,
        requiresAction: true,
        actionUrl: payment.point_of_interaction?.transaction_data?.ticket_url,
        error: 'Pago pendiente de confirmación',
      };
    }

    return {
      success: false,
      error: payment.status_detail || payment.message || 'Pago rechazado',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error conectando con MercadoPago',
    };
  }
}

/**
 * Lista suscripciones con débito automático configurado
 */
export async function listAutoPaymentConfigs(options?: {
  provider?: PaymentProvider;
  isEnabled?: boolean;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};

  if (options?.provider) {
    where.provider = options.provider;
  }

  if (options?.isEnabled !== undefined) {
    where.isEnabled = options.isEnabled;
  }

  const [configs, total] = await Promise.all([
    prisma.billingAutoPaymentConfig.findMany({
      where,
      include: {
        subscription: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            plan: { select: { id: true, displayName: true, monthlyPrice: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    }),
    prisma.billingAutoPaymentConfig.count({ where }),
  ]);

  return {
    configs,
    total,
    hasMore: (options?.offset || 0) + configs.length < total,
  };
}

/**
 * Obtiene estadísticas de débito automático
 */
export async function getAutoPaymentStats() {
  const [total, enabled, byProvider, recentFailures] = await Promise.all([
    prisma.billingAutoPaymentConfig.count(),
    prisma.billingAutoPaymentConfig.count({ where: { isEnabled: true } }),
    prisma.billingAutoPaymentConfig.groupBy({
      by: ['provider'],
      _count: true,
    }),
    prisma.billingAutoPaymentConfig.findMany({
      where: {
        failedAttempts: { gt: 0 },
      },
      include: {
        subscription: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
  ]);

  return {
    total,
    enabled,
    disabled: total - enabled,
    byProvider: byProvider.reduce((acc, item) => {
      acc[item.provider] = item._count;
      return acc;
    }, {} as Record<string, number>),
    recentFailures: recentFailures.map(f => ({
      id: f.id,
      subscriptionId: f.subscriptionId,
      userName: f.subscription.user.name,
      userEmail: f.subscription.user.email,
      failedAttempts: f.failedAttempts,
      lastFailureReason: f.lastFailureReason,
      provider: f.provider,
    })),
  };
}

/**
 * Cron job: Procesa pagos automáticos para facturas vencidas
 */
export async function processAllPendingAutoPayments(): Promise<{
  processed: number;
  successful: number;
  failed: number;
  errors: Array<{ invoiceId: string; error: string }>;
}> {
  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [] as Array<{ invoiceId: string; error: string }>,
  };

  // Obtener facturas OPEN con débito automático habilitado
  const invoices = await prisma.billingInvoice.findMany({
    where: {
      status: 'OPEN',
      dueDate: { lte: new Date() }, // Vencidas o al día
      subscription: {
        autoPaymentConfig: {
          isEnabled: true,
        },
      },
    },
    include: {
      subscription: {
        include: {
          autoPaymentConfig: true,
        },
      },
    },
    take: 100, // Limitar por batch
  });

  for (const invoice of invoices) {
    results.processed++;

    const result = await processAutoPayment(invoice.id);

    if (result.success) {
      results.successful++;
    } else {
      results.failed++;
      results.errors.push({
        invoiceId: invoice.id,
        error: result.error || 'Error desconocido',
      });
    }
  }

  return results;
}
