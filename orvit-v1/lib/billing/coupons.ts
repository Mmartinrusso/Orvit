/**
 * Servicio de Cupones de Descuento
 * Maneja la creación, validación y aplicación de cupones
 */

import { prisma } from '@/lib/prisma';
import { Prisma, DiscountType, BillingCycle } from '@prisma/client';
import { logBillingAction } from './audit';

// Generar ID único para cupones
function generateCouponId(): string {
  return `coupon_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateRedemptionId(): string {
  return `redemp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

export interface CouponValidationResult {
  valid: boolean;
  error?: string;
  coupon?: {
    id: string;
    code: string;
    name: string;
    discountType: DiscountType;
    discountValue: number;
    durationMonths: number | null;
  };
  discountAmount?: number;
}

export interface CreateCouponInput {
  code: string;
  name: string;
  description?: string;
  discountType?: DiscountType;
  discountValue: number;
  currency?: string;
  maxUses?: number;
  maxUsesPerUser?: number;
  validFrom?: Date;
  validUntil?: Date;
  appliesToPlans?: string[];
  appliesToCycles?: BillingCycle[];
  minAmount?: number;
  firstPaymentOnly?: boolean;
  durationMonths?: number;
}

/**
 * Crea un nuevo cupón
 */
export async function createCoupon(
  input: CreateCouponInput,
  createdByUserId?: number
) {
  const {
    code,
    name,
    description,
    discountType = 'PERCENTAGE',
    discountValue,
    currency = 'ARS',
    maxUses,
    maxUsesPerUser = 1,
    validFrom = new Date(),
    validUntil,
    appliesToPlans = [],
    appliesToCycles = [],
    minAmount,
    firstPaymentOnly = false,
    durationMonths,
  } = input;

  // Validar código único
  const existing = await prisma.billingCoupon.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (existing) {
    throw new Error('Ya existe un cupón con ese código');
  }

  // Validar valor del descuento
  if (discountType === 'PERCENTAGE' && (discountValue <= 0 || discountValue > 100)) {
    throw new Error('El porcentaje debe estar entre 1 y 100');
  }

  if (discountType === 'FIXED_AMOUNT' && discountValue <= 0) {
    throw new Error('El monto fijo debe ser mayor a 0');
  }

  const coupon = await prisma.billingCoupon.create({
    data: {
      id: generateCouponId(),
      code: code.toUpperCase(),
      name,
      description,
      discountType,
      discountValue: new Prisma.Decimal(discountValue),
      currency,
      maxUses,
      maxUsesPerUser,
      validFrom,
      validUntil,
      appliesToPlans,
      appliesToCycles,
      minAmount: minAmount ? new Prisma.Decimal(minAmount) : null,
      firstPaymentOnly,
      durationMonths,
      createdBy: createdByUserId,
    },
  });

  // Audit log
  if (createdByUserId) {
    await logBillingAction(
      createdByUserId,
      'COUPON_CREATED',
      'coupon',
      coupon.id,
      null,
      {
        code: coupon.code,
        discountType,
        discountValue,
        maxUses,
      }
    );
  }

  return coupon;
}

/**
 * Valida si un cupón puede aplicarse a una suscripción
 */
export async function validateCoupon(
  code: string,
  subscriptionId: string,
  amount: number
): Promise<CouponValidationResult> {
  const coupon = await prisma.billingCoupon.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!coupon) {
    return { valid: false, error: 'Cupón no encontrado' };
  }

  if (!coupon.isActive) {
    return { valid: false, error: 'Este cupón ya no está activo' };
  }

  // Verificar fechas de validez
  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom) {
    return { valid: false, error: 'Este cupón aún no está vigente' };
  }

  if (coupon.validUntil && now > coupon.validUntil) {
    return { valid: false, error: 'Este cupón ha expirado' };
  }

  // Verificar límite de usos global
  if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
    return { valid: false, error: 'Este cupón ha alcanzado su límite de usos' };
  }

  // Obtener la suscripción con plan
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    return { valid: false, error: 'Suscripción no encontrada' };
  }

  // Verificar si aplica al plan
  if (coupon.appliesToPlans.length > 0) {
    if (!coupon.appliesToPlans.includes(subscription.planId)) {
      return { valid: false, error: 'Este cupón no aplica a tu plan' };
    }
  }

  // Verificar si aplica al ciclo de facturación
  if (coupon.appliesToCycles.length > 0) {
    if (!coupon.appliesToCycles.includes(subscription.billingCycle)) {
      return { valid: false, error: 'Este cupón no aplica a tu ciclo de facturación' };
    }
  }

  // Verificar monto mínimo
  if (coupon.minAmount && amount < Number(coupon.minAmount)) {
    return {
      valid: false,
      error: `Este cupón requiere un monto mínimo de $${coupon.minAmount}`,
    };
  }

  // Verificar usos por usuario/suscripción
  const existingRedemption = await prisma.billingCouponRedemption.findUnique({
    where: {
      couponId_subscriptionId: {
        couponId: coupon.id,
        subscriptionId,
      },
    },
  });

  if (existingRedemption) {
    // Si es cupón de duración, verificar si aún está activo
    if (coupon.durationMonths && existingRedemption.expiresAt) {
      if (now < existingRedemption.expiresAt) {
        // Aún está activo, puede seguir usándose
      } else {
        return { valid: false, error: 'El descuento de este cupón ha expirado' };
      }
    } else {
      return { valid: false, error: 'Ya has utilizado este cupón' };
    }
  }

  // Verificar si es solo para primer pago
  if (coupon.firstPaymentOnly) {
    const existingInvoices = await prisma.billingInvoice.count({
      where: {
        subscriptionId,
        status: 'PAID',
      },
    });

    if (existingInvoices > 0) {
      return { valid: false, error: 'Este cupón solo aplica al primer pago' };
    }
  }

  // Calcular descuento
  let discountAmount: number;
  if (coupon.discountType === 'PERCENTAGE') {
    discountAmount = amount * (Number(coupon.discountValue) / 100);
  } else {
    discountAmount = Math.min(Number(coupon.discountValue), amount);
  }

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      durationMonths: coupon.durationMonths,
    },
    discountAmount: Math.round(discountAmount * 100) / 100,
  };
}

/**
 * Aplica un cupón a una factura
 */
export async function applyCouponToInvoice(
  couponId: string,
  invoiceId: string,
  subscriptionId: string,
  originalAmount: number
): Promise<{
  success: boolean;
  discountAmount: number;
  finalAmount: number;
  redemptionId?: string;
  error?: string;
}> {
  const coupon = await prisma.billingCoupon.findUnique({
    where: { id: couponId },
  });

  if (!coupon) {
    return { success: false, discountAmount: 0, finalAmount: originalAmount, error: 'Cupón no encontrado' };
  }

  // Calcular descuento
  let discountAmount: number;
  if (coupon.discountType === 'PERCENTAGE') {
    discountAmount = originalAmount * (Number(coupon.discountValue) / 100);
  } else {
    discountAmount = Math.min(Number(coupon.discountValue), originalAmount);
  }

  discountAmount = Math.round(discountAmount * 100) / 100;
  const finalAmount = Math.max(0, originalAmount - discountAmount);

  const redemptionId = generateRedemptionId();

  try {
    await prisma.$transaction(async (tx) => {
      // Calcular fecha de expiración si tiene duración
      let expiresAt: Date | null = null;
      if (coupon.durationMonths) {
        expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + coupon.durationMonths);
      }

      // Crear o actualizar redemption
      await tx.billingCouponRedemption.upsert({
        where: {
          couponId_subscriptionId: {
            couponId,
            subscriptionId,
          },
        },
        create: {
          id: redemptionId,
          couponId,
          subscriptionId,
          invoiceId,
          discountAmount: new Prisma.Decimal(discountAmount),
          expiresAt,
        },
        update: {
          appliedCount: { increment: 1 },
          invoiceId,
          discountAmount: new Prisma.Decimal(discountAmount),
        },
      });

      // Incrementar contador de usos del cupón
      await tx.billingCoupon.update({
        where: { id: couponId },
        data: { currentUses: { increment: 1 } },
      });

      // Actualizar factura con descuento
      await tx.billingInvoice.update({
        where: { id: invoiceId },
        data: {
          couponId,
          discountAmount: new Prisma.Decimal(discountAmount),
          total: new Prisma.Decimal(finalAmount),
        },
      });
    });

    return {
      success: true,
      discountAmount,
      finalAmount,
      redemptionId,
    };
  } catch (error) {
    console.error('Error aplicando cupón:', error);
    return {
      success: false,
      discountAmount: 0,
      finalAmount: originalAmount,
      error: 'Error al aplicar el cupón',
    };
  }
}

/**
 * Verifica si una suscripción tiene un cupón activo
 * (para descuentos recurrentes)
 */
export async function getActiveRedemption(subscriptionId: string) {
  const now = new Date();

  const redemption = await prisma.billingCouponRedemption.findFirst({
    where: {
      subscriptionId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    include: {
      coupon: true,
    },
    orderBy: { redeemedAt: 'desc' },
  });

  if (!redemption || !redemption.coupon.isActive) {
    return null;
  }

  return {
    redemptionId: redemption.id,
    coupon: {
      id: redemption.coupon.id,
      code: redemption.coupon.code,
      name: redemption.coupon.name,
      discountType: redemption.coupon.discountType,
      discountValue: Number(redemption.coupon.discountValue),
    },
    appliedCount: redemption.appliedCount,
    expiresAt: redemption.expiresAt,
  };
}

/**
 * Lista todos los cupones con estadísticas
 */
export async function listCoupons(options?: {
  isActive?: boolean;
  includeExpired?: boolean;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};

  if (options?.isActive !== undefined) {
    where.isActive = options.isActive;
  }

  if (!options?.includeExpired) {
    where.OR = [
      { validUntil: null },
      { validUntil: { gte: new Date() } },
    ];
  }

  const [coupons, total] = await Promise.all([
    prisma.billingCoupon.findMany({
      where,
      include: {
        _count: {
          select: { redemptions: true },
        },
        createdByUser: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    }),
    prisma.billingCoupon.count({ where }),
  ]);

  return {
    coupons: coupons.map(c => ({
      ...c,
      discountValue: Number(c.discountValue),
      minAmount: c.minAmount ? Number(c.minAmount) : null,
      redemptionsCount: c._count.redemptions,
    })),
    total,
    hasMore: (options?.offset || 0) + coupons.length < total,
  };
}

/**
 * Obtiene un cupón por ID o código
 */
export async function getCoupon(idOrCode: string) {
  const coupon = await prisma.billingCoupon.findFirst({
    where: {
      OR: [
        { id: idOrCode },
        { code: idOrCode.toUpperCase() },
      ],
    },
    include: {
      redemptions: {
        include: {
          subscription: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { redeemedAt: 'desc' },
        take: 20,
      },
      createdByUser: {
        select: { id: true, name: true },
      },
      _count: {
        select: { redemptions: true, invoices: true },
      },
    },
  });

  if (!coupon) return null;

  return {
    ...coupon,
    discountValue: Number(coupon.discountValue),
    minAmount: coupon.minAmount ? Number(coupon.minAmount) : null,
    redemptionsCount: coupon._count.redemptions,
    invoicesCount: coupon._count.invoices,
  };
}

/**
 * Actualiza un cupón
 */
export async function updateCoupon(
  id: string,
  updates: Partial<CreateCouponInput> & { isActive?: boolean },
  updatedByUserId?: number
) {
  const existing = await prisma.billingCoupon.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Cupón no encontrado');
  }

  const data: any = {};

  if (updates.name !== undefined) data.name = updates.name;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.maxUses !== undefined) data.maxUses = updates.maxUses;
  if (updates.maxUsesPerUser !== undefined) data.maxUsesPerUser = updates.maxUsesPerUser;
  if (updates.validFrom !== undefined) data.validFrom = updates.validFrom;
  if (updates.validUntil !== undefined) data.validUntil = updates.validUntil;
  if (updates.appliesToPlans !== undefined) data.appliesToPlans = updates.appliesToPlans;
  if (updates.appliesToCycles !== undefined) data.appliesToCycles = updates.appliesToCycles;
  if (updates.minAmount !== undefined) {
    data.minAmount = updates.minAmount ? new Prisma.Decimal(updates.minAmount) : null;
  }
  if (updates.firstPaymentOnly !== undefined) data.firstPaymentOnly = updates.firstPaymentOnly;
  if (updates.isActive !== undefined) data.isActive = updates.isActive;

  const coupon = await prisma.billingCoupon.update({
    where: { id },
    data,
  });

  // Audit log
  if (updatedByUserId) {
    await logBillingAction(
      updatedByUserId,
      'COUPON_UPDATED',
      'coupon',
      id,
      { isActive: existing.isActive, maxUses: existing.maxUses },
      { isActive: coupon.isActive, maxUses: coupon.maxUses }
    );
  }

  return coupon;
}

/**
 * Desactiva un cupón
 */
export async function deactivateCoupon(id: string, userId?: number) {
  return updateCoupon(id, { isActive: false }, userId);
}
