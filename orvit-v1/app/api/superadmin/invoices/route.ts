import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { createInvoice, listInvoices, getBillingSummary } from '@/lib/billing/invoicing';

export const dynamic = 'force-dynamic';

// GET - Listar facturas con filtros
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscriptionId');
    const status = searchParams.get('status') as any;
    const docType = searchParams.get('docType') as 'T1' | 'T2' | null;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const summary = searchParams.get('summary') === 'true';

    // Si piden resumen, retornar estadísticas
    if (summary) {
      const summaryData = await getBillingSummary({
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      });
      return NextResponse.json({ summary: summaryData });
    }

    const result = await listInvoices({
      subscriptionId: subscriptionId || undefined,
      status: status || undefined,
      docType: docType || undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit,
      offset,
    });

    // Formatear facturas
    const formattedInvoices = result.invoices.map(inv => ({
      id: inv.id,
      number: inv.number,
      subscriptionId: inv.subscriptionId,
      currency: inv.currency,
      subtotal: Number(inv.subtotal),
      tax: Number(inv.tax),
      total: Number(inv.total),
      status: inv.status,
      periodStart: inv.periodStart,
      periodEnd: inv.periodEnd,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt,
      docType: inv.docType,
      createdAt: inv.createdAt,
      // Usuario y plan de la suscripción
      user: inv.subscription.user,
      plan: inv.subscription.plan,
      // Conteos
      itemsCount: inv._count.items,
      paymentsCount: inv._count.payments,
    }));

    return NextResponse.json({
      invoices: formattedInvoices,
      total: result.total,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Error al obtener facturas' }, { status: 500 });
  }
}

// POST - Crear factura manual
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      subscriptionId,
      periodStart,
      periodEnd,
      dueDate,
      items,
      docType = 'T1',
      notes,
      taxRate = 0,
    } = body;

    // Validaciones
    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'subscriptionId es requerido' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere al menos un item' },
        { status: 400 }
      );
    }

    // Validar items
    for (const item of items) {
      if (!item.type || !item.description || item.unitPrice === undefined) {
        return NextResponse.json(
          { error: 'Cada item debe tener type, description y unitPrice' },
          { status: 400 }
        );
      }
    }

    const invoice = await createInvoice({
      subscriptionId,
      periodStart: periodStart ? new Date(periodStart) : new Date(),
      periodEnd: periodEnd ? new Date(periodEnd) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      items,
      docType,
      notes,
      taxRate,
    });

    return NextResponse.json({
      success: true,
      invoice: {
        ...invoice,
        subtotal: Number(invoice.subtotal),
        tax: Number(invoice.tax),
        total: Number(invoice.total),
      },
    });
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear factura' },
      { status: 500 }
    );
  }
}
