import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { createCoupon, listCoupons, validateCoupon } from '@/lib/billing/coupons';

export const dynamic = 'force-dynamic';

// GET - Listar cupones
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('active');
    const includeExpired = searchParams.get('includeExpired') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await listCoupons({
      isActive: isActive !== null ? isActive === 'true' : undefined,
      includeExpired,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching coupons:', error);
    return NextResponse.json({ error: 'Error al obtener cupones' }, { status: 500 });
  }
}

// POST - Crear cupón o validar código
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();

    // Si viene con action: 'validate', es para validar un código
    if (body.action === 'validate') {
      const { code, subscriptionId, amount } = body;

      if (!code || !subscriptionId || !amount) {
        return NextResponse.json(
          { error: 'code, subscriptionId y amount son requeridos' },
          { status: 400 }
        );
      }

      const result = await validateCoupon(code, subscriptionId, amount);
      return NextResponse.json(result);
    }

    // Crear nuevo cupón
    const {
      code,
      name,
      description,
      discountType,
      discountValue,
      currency,
      maxUses,
      maxUsesPerUser,
      validFrom,
      validUntil,
      appliesToPlans,
      appliesToCycles,
      minAmount,
      firstPaymentOnly,
      durationMonths,
    } = body;

    // Validaciones
    if (!code) {
      return NextResponse.json({ error: 'code es requerido' }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: 'name es requerido' }, { status: 400 });
    }

    if (!discountValue || discountValue <= 0) {
      return NextResponse.json({ error: 'discountValue debe ser mayor a 0' }, { status: 400 });
    }

    const coupon = await createCoupon(
      {
        code,
        name,
        description,
        discountType,
        discountValue,
        currency,
        maxUses,
        maxUsesPerUser,
        validFrom: validFrom ? new Date(validFrom) : undefined,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        appliesToPlans,
        appliesToCycles,
        minAmount,
        firstPaymentOnly,
        durationMonths,
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
    console.error('Error creating coupon:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear cupón' },
      { status: 400 }
    );
  }
}
