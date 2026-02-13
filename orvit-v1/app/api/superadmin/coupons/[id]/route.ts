import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getCoupon, updateCoupon, deactivateCoupon, applyCouponToInvoice } from '@/lib/billing/coupons';

export const dynamic = 'force-dynamic';

// GET - Obtener detalle de cupón
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const coupon = await getCoupon(params.id);

    if (!coupon) {
      return NextResponse.json({ error: 'Cupón no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ coupon });
  } catch (error) {
    console.error('Error fetching coupon:', error);
    return NextResponse.json({ error: 'Error al obtener cupón' }, { status: 500 });
  }
}

// PUT - Actualizar cupón
export async function PUT(
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
      name,
      description,
      maxUses,
      maxUsesPerUser,
      validFrom,
      validUntil,
      appliesToPlans,
      appliesToCycles,
      minAmount,
      firstPaymentOnly,
      isActive,
    } = body;

    const coupon = await updateCoupon(
      params.id,
      {
        name,
        description,
        maxUses,
        maxUsesPerUser,
        validFrom: validFrom ? new Date(validFrom) : undefined,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        appliesToPlans,
        appliesToCycles,
        minAmount,
        firstPaymentOnly,
        isActive,
      },
      auth.userId
    );

    return NextResponse.json({
      success: true,
      coupon: {
        ...coupon,
        discountValue: Number(coupon.discountValue),
        minAmount: coupon.minAmount ? Number(coupon.minAmount) : null,
      },
    });
  } catch (error: any) {
    console.error('Error updating coupon:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar cupón' },
      { status: 400 }
    );
  }
}

// DELETE - Desactivar cupón
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    await deactivateCoupon(params.id, auth.userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deactivating coupon:', error);
    return NextResponse.json(
      { error: error.message || 'Error al desactivar cupón' },
      { status: 400 }
    );
  }
}

// POST - Aplicar cupón a factura
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
    const { invoiceId, subscriptionId, originalAmount } = body;

    if (!invoiceId || !subscriptionId || !originalAmount) {
      return NextResponse.json(
        { error: 'invoiceId, subscriptionId y originalAmount son requeridos' },
        { status: 400 }
      );
    }

    const result = await applyCouponToInvoice(
      params.id,
      invoiceId,
      subscriptionId,
      originalAmount
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error applying coupon:', error);
    return NextResponse.json(
      { error: error.message || 'Error al aplicar cupón' },
      { status: 400 }
    );
  }
}
