import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import {
  getInvoiceWithDetails,
  openInvoice,
  voidInvoice,
  registerPayment,
} from '@/lib/billing/invoicing';

export const dynamic = 'force-dynamic';

// GET - Obtener detalle de una factura
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const invoice = await getInvoiceWithDetails(params.id);

    if (!invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      invoice: {
        ...invoice,
        subtotal: Number(invoice.subtotal),
        tax: Number(invoice.tax),
        total: Number(invoice.total),
        items: invoice.items.map(item => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          total: Number(item.total),
        })),
        payments: invoice.payments.map(payment => ({
          ...payment,
          amount: Number(payment.amount),
        })),
        subscription: {
          ...invoice.subscription,
          plan: {
            ...invoice.subscription.plan,
            monthlyPrice: Number(invoice.subscription.plan.monthlyPrice),
            annualPrice: invoice.subscription.plan.annualPrice
              ? Number(invoice.subscription.plan.annualPrice)
              : null,
          },
        },
      },
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json({ error: 'Error al obtener factura' }, { status: 500 });
  }
}

// PATCH - Actualizar estado de factura
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { action, reason } = body;

    if (!action) {
      return NextResponse.json({ error: 'Se requiere action' }, { status: 400 });
    }

    let result;

    switch (action) {
      case 'open':
        result = await openInvoice(params.id, auth.userId);
        break;

      case 'void':
        if (!reason) {
          return NextResponse.json(
            { error: 'Se requiere reason para anular' },
            { status: 400 }
          );
        }
        result = await voidInvoice(params.id, reason, auth.userId);
        break;

      default:
        return NextResponse.json(
          { error: 'action inválida. Usar: open, void' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      invoice: {
        ...result,
        subtotal: Number(result.subtotal),
        tax: Number(result.tax),
        total: Number(result.total),
      },
    });
  } catch (error: any) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar factura' },
      { status: 500 }
    );
  }
}

// POST - Registrar pago para la factura
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
    const {
      amount,
      method,
      docType = 'T1',
      notes,
      providerPaymentId,
      providerRef,
    } = body;

    // Validaciones
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'amount debe ser un número positivo' },
        { status: 400 }
      );
    }

    if (!method) {
      return NextResponse.json(
        { error: 'method es requerido (CASH, TRANSFER, CARD, MERCADOPAGO, STRIPE)' },
        { status: 400 }
      );
    }

    const validMethods = ['CASH', 'TRANSFER', 'CARD', 'MERCADOPAGO', 'STRIPE'];
    if (!validMethods.includes(method)) {
      return NextResponse.json(
        { error: `method inválido. Usar: ${validMethods.join(', ')}` },
        { status: 400 }
      );
    }

    const payment = await registerPayment(
      params.id,
      {
        amount,
        method,
        docType,
        notes,
        providerPaymentId,
        providerRef,
      },
      auth.userId
    );

    return NextResponse.json({
      success: true,
      payment: {
        ...payment,
        amount: Number(payment.amount),
      },
    });
  } catch (error: any) {
    console.error('Error registering payment:', error);
    return NextResponse.json(
      { error: error.message || 'Error al registrar pago' },
      { status: 500 }
    );
  }
}
