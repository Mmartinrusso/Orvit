import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import {
  setupAutoPayment,
  getAutoPaymentConfig,
  enableAutoPayment,
  disableAutoPayment,
  processAutoPayment,
} from '@/lib/billing/auto-payment';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Obtener configuración de débito automático
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const config = await getAutoPaymentConfig(params.id);

    return NextResponse.json({
      hasAutoPayment: !!config,
      config: config ? {
        id: config.id,
        provider: config.provider,
        cardLast4: config.cardLast4,
        cardBrand: config.cardBrand,
        cardExpMonth: config.cardExpMonth,
        cardExpYear: config.cardExpYear,
        isEnabled: config.isEnabled,
        failedAttempts: config.failedAttempts,
        lastFailureReason: config.lastFailureReason,
        lastPaymentAt: config.lastPaymentAt,
        user: config.subscription.user,
        plan: config.subscription.plan,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching auto-payment config:', error);
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
  }
}

// POST - Configurar o actualizar débito automático
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    // Acciones especiales
    if (action === 'enable') {
      const config = await enableAutoPayment(params.id, auth.userId);
      return NextResponse.json({ success: true, config });
    }

    if (action === 'disable') {
      const config = await disableAutoPayment(params.id, auth.userId);
      return NextResponse.json({ success: true, config });
    }

    if (action === 'charge') {
      // Cobrar factura específica
      const { invoiceId } = body;
      if (!invoiceId) {
        return NextResponse.json({ error: 'invoiceId es requerido' }, { status: 400 });
      }
      const result = await processAutoPayment(invoiceId);
      return NextResponse.json(result);
    }

    // Configurar nuevo débito automático
    const {
      provider,
      providerCustomerId,
      providerPaymentMethodId,
      providerSubscriptionId,
      card,
    } = body;

    if (!provider || !providerPaymentMethodId || !card) {
      return NextResponse.json(
        { error: 'provider, providerPaymentMethodId y card son requeridos' },
        { status: 400 }
      );
    }

    if (!['STRIPE', 'MERCADOPAGO'].includes(provider)) {
      return NextResponse.json(
        { error: 'provider debe ser STRIPE o MERCADOPAGO' },
        { status: 400 }
      );
    }

    const config = await setupAutoPayment(
      {
        subscriptionId: params.id,
        provider,
        providerCustomerId,
        providerPaymentMethodId,
        providerSubscriptionId,
        card,
      },
      auth.userId
    );

    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        provider: config.provider,
        cardLast4: config.cardLast4,
        cardBrand: config.cardBrand,
        isEnabled: config.isEnabled,
      },
    });
  } catch (error: any) {
    console.error('Error setting up auto-payment:', error);
    return NextResponse.json(
      { error: error.message || 'Error configurando débito automático' },
      { status: 400 }
    );
  }
}

// DELETE - Eliminar configuración de débito automático
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Eliminar la configuración
    await prisma.billingAutoPaymentConfig.delete({
      where: { subscriptionId: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting auto-payment config:', error);
    return NextResponse.json({ error: 'Error eliminando configuración' }, { status: 500 });
  }
}
