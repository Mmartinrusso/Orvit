/**
 * Webhook Handler para Proveedores de Pago
 *
 * Endpoints:
 * - POST /api/webhooks/payments?provider=stripe
 * - POST /api/webhooks/payments?provider=mercadopago
 *
 * Configurar en:
 * - Stripe Dashboard: https://dashboard.stripe.com/webhooks
 * - MercadoPago: https://www.mercadopago.com.ar/developers/panel
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { registerPayment } from '@/lib/billing/invoicing';
import { logBillingAction } from '@/lib/billing/audit';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Verificar firma de Stripe
function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const parts = signature.split(',');
    const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
    const v1 = parts.find(p => p.startsWith('v1='))?.slice(3);

    if (!timestamp || !v1) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(v1),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// Verificar firma de MercadoPago
function verifyMercadoPagoSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string,
  secret: string
): boolean {
  try {
    const parts = xSignature.split(',');
    const ts = parts.find(p => p.includes('ts='))?.split('=')[1];
    const v1 = parts.find(p => p.includes('v1='))?.split('=')[1];

    if (!ts || !v1) return false;

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(v1),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');

  if (!provider || !['stripe', 'mercadopago'].includes(provider)) {
    return NextResponse.json(
      { error: 'Provider inválido. Usar: stripe, mercadopago' },
      { status: 400 }
    );
  }

  try {
    const body = await request.text();
    const payload = JSON.parse(body);

    // ================================================
    // STRIPE
    // ================================================
    if (provider === 'stripe') {
      const signature = request.headers.get('stripe-signature');
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!signature || !webhookSecret) {
        console.warn('Stripe: Falta firma o secret');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (!verifyStripeSignature(body, signature, webhookSecret)) {
        console.warn('Stripe: Firma inválida');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

      // Procesar eventos de Stripe
      const event = payload;

      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object;

          // Buscar factura por metadata o providerRef
          const invoice = await prisma.billingInvoice.findFirst({
            where: {
              OR: [
                { id: paymentIntent.metadata?.invoiceId },
                // Buscar por monto si no hay ID
              ],
              status: 'OPEN',
            },
          });

          if (invoice) {
            await registerPayment(
              invoice.id,
              {
                amount: paymentIntent.amount / 100, // Stripe usa centavos
                method: 'STRIPE',
                providerPaymentId: paymentIntent.id,
                providerRef: paymentIntent.charges?.data?.[0]?.receipt_url,
                notes: `Pago automático via Stripe`,
              },
              0 // Sistema
            );

            console.log(`Stripe: Pago registrado para factura ${invoice.id}`);
          }
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          // Actualizar estado de suscripción si es necesario
          console.log('Stripe: Suscripción actualizada', subscription.id);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;

          // Buscar y cancelar suscripción local
          const localSub = await prisma.subscription.findFirst({
            where: { providerSubscriptionId: subscription.id },
          });

          if (localSub) {
            await prisma.subscription.update({
              where: { id: localSub.id },
              data: {
                status: 'CANCELED',
                canceledAt: new Date(),
              },
            });

            await logBillingAction(
              0,
              'SUBSCRIPTION_STATUS_CHANGE',
              'subscription',
              localSub.id,
              { status: localSub.status },
              { status: 'CANCELED', source: 'stripe_webhook' }
            );
          }
          break;
        }

        case 'invoice.payment_failed': {
          const stripeInvoice = event.data.object;
          console.warn('Stripe: Pago fallido', stripeInvoice.id);
          // Aquí podrías enviar notificación al usuario
          break;
        }

        default:
          console.log(`Stripe: Evento no manejado: ${event.type}`);
      }

      return NextResponse.json({ received: true });
    }

    // ================================================
    // MERCADOPAGO
    // ================================================
    if (provider === 'mercadopago') {
      const xSignature = request.headers.get('x-signature');
      const xRequestId = request.headers.get('x-request-id');
      const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

      // MercadoPago puede enviar notificaciones sin firma en algunos casos
      if (xSignature && webhookSecret && xRequestId) {
        const dataId = payload.data?.id?.toString() || '';
        if (!verifyMercadoPagoSignature(xSignature, xRequestId, dataId, webhookSecret)) {
          console.warn('MercadoPago: Firma inválida');
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      }

      const { type, data } = payload;

      switch (type) {
        case 'payment': {
          // Obtener detalles del pago desde MercadoPago API
          const paymentId = data.id;
          const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

          if (!mpAccessToken) {
            console.error('MercadoPago: Falta access token');
            return NextResponse.json({ received: true });
          }

          // Fetch payment details
          const mpResponse = await fetch(
            `https://api.mercadopago.com/v1/payments/${paymentId}`,
            {
              headers: {
                Authorization: `Bearer ${mpAccessToken}`,
              },
            }
          );

          if (!mpResponse.ok) {
            console.error('MercadoPago: Error obteniendo pago', paymentId);
            return NextResponse.json({ received: true });
          }

          const mpPayment = await mpResponse.json();

          if (mpPayment.status === 'approved') {
            // Buscar factura por external_reference (debería ser el invoice ID)
            const invoiceId = mpPayment.external_reference;

            if (invoiceId) {
              const invoice = await prisma.billingInvoice.findUnique({
                where: { id: invoiceId },
              });

              if (invoice && invoice.status === 'OPEN') {
                await registerPayment(
                  invoice.id,
                  {
                    amount: mpPayment.transaction_amount,
                    method: 'MERCADOPAGO',
                    providerPaymentId: paymentId.toString(),
                    providerRef: mpPayment.order?.id?.toString(),
                    notes: `Pago automático via MercadoPago - ${mpPayment.payment_type_id}`,
                  },
                  0 // Sistema
                );

                console.log(`MercadoPago: Pago registrado para factura ${invoice.id}`);
              }
            }
          }
          break;
        }

        case 'subscription_preapproval': {
          // Suscripción de MercadoPago
          console.log('MercadoPago: Evento de suscripción', data.id);
          break;
        }

        default:
          console.log(`MercadoPago: Evento no manejado: ${type}`);
      }

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ error: 'Provider no soportado' }, { status: 400 });

  } catch (error) {
    console.error('Error procesando webhook:', error);
    // Siempre devolver 200 para evitar reintentos
    return NextResponse.json({ received: true, error: 'Error interno' });
  }
}
