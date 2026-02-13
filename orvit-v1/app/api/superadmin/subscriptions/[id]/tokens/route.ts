import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import {
  addPurchasedTokens,
  adjustTokens,
  getTokenHistory,
  getTokenBalance,
} from '@/lib/billing/tokens';
import { logBillingAction } from '@/lib/billing/audit';

export const dynamic = 'force-dynamic';

// GET - Obtener historial de tokens
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as any;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Verificar que la suscripción existe
    const subscription = await prisma.subscription.findUnique({
      where: { id: params.id },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 });
    }

    // Obtener balance actual
    const balance = await getTokenBalance(params.id);

    // Obtener historial
    const history = await getTokenHistory(params.id, {
      type: type || undefined,
      limit,
      offset,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });

    return NextResponse.json({
      balance,
      transactions: history.transactions.map(t => ({
        ...t,
        unitPrice: t.unitPrice ? Number(t.unitPrice) : null,
        totalPrice: t.totalPrice ? Number(t.totalPrice) : null,
      })),
      total: history.total,
      hasMore: history.hasMore,
    });
  } catch (error) {
    console.error('Error fetching token history:', error);
    return NextResponse.json({ error: 'Error al obtener historial de tokens' }, { status: 500 });
  }
}

// POST - Agregar tokens (compra o ajuste)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que la suscripción existe
    const subscription = await prisma.subscription.findUnique({
      where: { id: params.id },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const {
      action, // 'purchase' | 'adjust'
      amount,
      unitPrice,
      description,
      adjustPurchased = false, // Para ajustes: ajustar purchased en lugar de included
    } = body;

    if (!action || !amount) {
      return NextResponse.json(
        { error: 'Se requiere action y amount' },
        { status: 400 }
      );
    }

    if (typeof amount !== 'number') {
      return NextResponse.json(
        { error: 'amount debe ser un número' },
        { status: 400 }
      );
    }

    let result;

    if (action === 'purchase') {
      if (amount <= 0) {
        return NextResponse.json(
          { error: 'La cantidad para compra debe ser positiva' },
          { status: 400 }
        );
      }

      if (unitPrice === undefined || unitPrice < 0) {
        return NextResponse.json(
          { error: 'Se requiere unitPrice para compras' },
          { status: 400 }
        );
      }

      result = await addPurchasedTokens(
        params.id,
        amount,
        unitPrice,
        description
      );

      if (result.success) {
        await logBillingAction(
          auth.userId,
          'TOKENS_PURCHASED',
          'tokens',
          params.id,
          null,
          { amount, unitPrice, totalPrice: amount * unitPrice }
        );
      }
    } else if (action === 'adjust') {
      if (!description) {
        return NextResponse.json(
          { error: 'Se requiere description para ajustes' },
          { status: 400 }
        );
      }

      result = await adjustTokens(
        params.id,
        amount, // Puede ser positivo o negativo
        description,
        adjustPurchased
      );

      if (result.success) {
        await logBillingAction(
          auth.userId,
          'TOKENS_ADJUSTED',
          'tokens',
          params.id,
          null,
          { amount, adjustPurchased, description }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'action debe ser "purchase" o "adjust"' },
        { status: 400 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Error al procesar tokens' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      balance: result.balanceAfter,
      transactionId: result.transactionId,
    });
  } catch (error) {
    console.error('Error processing tokens:', error);
    return NextResponse.json({ error: 'Error al procesar tokens' }, { status: 500 });
  }
}
