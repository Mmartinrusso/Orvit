/**
 * Servicio de Tokens de Billing
 * Maneja el consumo atómico de tokens con protección de concurrencia
 *
 * Arquitectura de tokens:
 * - includedTokensRemaining: Allowance mensual del plan (resetea cada período)
 * - purchasedTokensBalance: Tokens comprados (carry-over, no vencen)
 * - tokensUsedThisPeriod: Contador de uso del período actual
 *
 * Orden de consumo: primero allowance, luego purchased
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// Generar UUID para IDs
function generateId(): string {
  return `tok_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

export interface TokenConsumptionResult {
  success: boolean;
  error?: string;
  balanceAfter?: {
    included: number;
    purchased: number;
    total: number;
  };
  transactionId?: string;
}

export interface TokenBalance {
  included: number;
  purchased: number;
  usedThisPeriod: number;
  total: number;
}

/**
 * Consume tokens de una suscripción de forma atómica
 * Usa UPDATE ... WHERE para prevenir race conditions
 *
 * @param subscriptionId - ID de la suscripción
 * @param amount - Cantidad de tokens a consumir (positivo)
 * @param description - Descripción del consumo
 * @param referenceType - Tipo de referencia (ej: 'AI_QUERY', 'PDF_EXPORT')
 * @param referenceId - ID de la entidad que consume
 * @param idempotencyKey - Clave única para prevenir doble consumo
 */
export async function consumeTokens(
  subscriptionId: string,
  amount: number,
  description: string,
  referenceType?: string,
  referenceId?: string,
  idempotencyKey?: string
): Promise<TokenConsumptionResult> {
  if (amount <= 0) {
    return {
      success: false,
      error: 'La cantidad debe ser positiva',
    };
  }

  // Verificar idempotencia si se proporciona key
  if (idempotencyKey) {
    const existing = await prisma.tokenTransaction.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        success: true,
        balanceAfter: {
          included: existing.includedBalanceAfter,
          purchased: existing.purchasedBalanceAfter,
          total: existing.includedBalanceAfter + existing.purchasedBalanceAfter,
        },
        transactionId: existing.id,
      };
    }
  }

  const transactionId = generateId();

  try {
    // Usar transacción con raw SQL para atomicidad
    const result = await prisma.$transaction(async (tx) => {
      // 1. Intentar consumir atómicamente con UPDATE ... WHERE
      // Primero consume del allowance, luego del purchased si no alcanza
      const updateResult = await tx.$executeRaw`
        UPDATE subscriptions SET
          "includedTokensRemaining" = GREATEST(0, "includedTokensRemaining" - ${amount}),
          "purchasedTokensBalance" = CASE
            WHEN "includedTokensRemaining" >= ${amount} THEN "purchasedTokensBalance"
            ELSE "purchasedTokensBalance" - (${amount} - "includedTokensRemaining")
          END,
          "tokensUsedThisPeriod" = "tokensUsedThisPeriod" + ${amount},
          "updatedAt" = NOW()
        WHERE id = ${subscriptionId}
          AND ("includedTokensRemaining" + "purchasedTokensBalance") >= ${amount}
      `;

      // Si no se actualizó ninguna fila, fondos insuficientes
      if (updateResult === 0) {
        throw new Error('INSUFFICIENT_TOKENS');
      }

      // 2. Obtener el balance actualizado
      const subscription = await tx.subscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription) {
        throw new Error('SUBSCRIPTION_NOT_FOUND');
      }

      // 3. Registrar la transacción
      await tx.tokenTransaction.create({
        data: {
          id: transactionId,
          subscriptionId,
          type: 'USAGE',
          amount: -amount, // Negativo para débitos
          includedBalanceAfter: subscription.includedTokensRemaining,
          purchasedBalanceAfter: subscription.purchasedTokensBalance,
          description,
          referenceType,
          referenceId,
          idempotencyKey,
        },
      });

      return {
        included: subscription.includedTokensRemaining,
        purchased: subscription.purchasedTokensBalance,
      };
    });

    return {
      success: true,
      balanceAfter: {
        included: result.included,
        purchased: result.purchased,
        total: result.included + result.purchased,
      },
      transactionId,
    };
  } catch (error: any) {
    if (error.message === 'INSUFFICIENT_TOKENS') {
      // Obtener balance actual para el mensaje de error
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });
      const available = subscription
        ? subscription.includedTokensRemaining + subscription.purchasedTokensBalance
        : 0;

      return {
        success: false,
        error: `Tokens insuficientes. Disponible: ${available}, requerido: ${amount}`,
      };
    }

    if (error.message === 'SUBSCRIPTION_NOT_FOUND') {
      return {
        success: false,
        error: 'Suscripción no encontrada',
      };
    }

    console.error('Error al consumir tokens:', error);
    return {
      success: false,
      error: 'Error interno al procesar tokens',
    };
  }
}

/**
 * Agrega tokens comprados a una suscripción
 */
export async function addPurchasedTokens(
  subscriptionId: string,
  amount: number,
  unitPrice: number,
  description?: string
): Promise<TokenConsumptionResult> {
  if (amount <= 0) {
    return {
      success: false,
      error: 'La cantidad debe ser positiva',
    };
  }

  const transactionId = generateId();
  const totalPrice = amount * unitPrice;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Actualizar balance
      const subscription = await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          purchasedTokensBalance: {
            increment: amount,
          },
        },
      });

      // Registrar transacción
      await tx.tokenTransaction.create({
        data: {
          id: transactionId,
          subscriptionId,
          type: 'PURCHASE',
          amount: amount, // Positivo para créditos
          includedBalanceAfter: subscription.includedTokensRemaining,
          purchasedBalanceAfter: subscription.purchasedTokensBalance,
          description: description || `Compra de ${amount} tokens`,
          unitPrice: new Prisma.Decimal(unitPrice),
          totalPrice: new Prisma.Decimal(totalPrice),
        },
      });

      return subscription;
    });

    return {
      success: true,
      balanceAfter: {
        included: result.includedTokensRemaining,
        purchased: result.purchasedTokensBalance,
        total: result.includedTokensRemaining + result.purchasedTokensBalance,
      },
      transactionId,
    };
  } catch (error) {
    console.error('Error al agregar tokens:', error);
    return {
      success: false,
      error: 'Error al agregar tokens',
    };
  }
}

/**
 * Resetea el allowance mensual de tokens (para cron de renovación)
 */
export async function resetMonthlyAllowance(subscriptionId: string): Promise<TokenConsumptionResult> {
  const transactionId = generateId();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Obtener suscripción con plan
      const subscription = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: true },
      });

      if (!subscription) {
        throw new Error('SUBSCRIPTION_NOT_FOUND');
      }

      const newAllowance = subscription.plan.includedTokensMonthly;
      const oldIncluded = subscription.includedTokensRemaining;

      // Si hay tokens del período anterior, se pierden (expiran)
      if (oldIncluded > 0) {
        // Registrar expiración
        await tx.tokenTransaction.create({
          data: {
            id: `exp_${transactionId}`,
            subscriptionId,
            type: 'EXPIRATION',
            amount: -oldIncluded,
            includedBalanceAfter: 0,
            purchasedBalanceAfter: subscription.purchasedTokensBalance,
            description: `Expiración de ${oldIncluded} tokens del período anterior`,
          },
        });
      }

      // Actualizar suscripción
      const updated = await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          includedTokensRemaining: newAllowance,
          tokensUsedThisPeriod: 0,
        },
      });

      // Registrar crédito mensual
      await tx.tokenTransaction.create({
        data: {
          id: transactionId,
          subscriptionId,
          type: 'MONTHLY_CREDIT',
          amount: newAllowance,
          includedBalanceAfter: updated.includedTokensRemaining,
          purchasedBalanceAfter: updated.purchasedTokensBalance,
          description: `Crédito mensual de ${newAllowance} tokens`,
        },
      });

      return updated;
    });

    return {
      success: true,
      balanceAfter: {
        included: result.includedTokensRemaining,
        purchased: result.purchasedTokensBalance,
        total: result.includedTokensRemaining + result.purchasedTokensBalance,
      },
      transactionId,
    };
  } catch (error: any) {
    if (error.message === 'SUBSCRIPTION_NOT_FOUND') {
      return {
        success: false,
        error: 'Suscripción no encontrada',
      };
    }
    console.error('Error al resetear allowance:', error);
    return {
      success: false,
      error: 'Error al resetear allowance mensual',
    };
  }
}

/**
 * Aplica un ajuste manual de tokens (para correcciones administrativas)
 */
export async function adjustTokens(
  subscriptionId: string,
  amount: number,
  description: string,
  adjustPurchased: boolean = false
): Promise<TokenConsumptionResult> {
  const transactionId = generateId();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const updateData: any = {};

      if (adjustPurchased) {
        updateData.purchasedTokensBalance = { increment: amount };
      } else {
        updateData.includedTokensRemaining = { increment: amount };
      }

      const subscription = await tx.subscription.update({
        where: { id: subscriptionId },
        data: updateData,
      });

      // Registrar ajuste
      await tx.tokenTransaction.create({
        data: {
          id: transactionId,
          subscriptionId,
          type: 'ADJUSTMENT',
          amount,
          includedBalanceAfter: subscription.includedTokensRemaining,
          purchasedBalanceAfter: subscription.purchasedTokensBalance,
          description,
        },
      });

      return subscription;
    });

    return {
      success: true,
      balanceAfter: {
        included: result.includedTokensRemaining,
        purchased: result.purchasedTokensBalance,
        total: result.includedTokensRemaining + result.purchasedTokensBalance,
      },
      transactionId,
    };
  } catch (error) {
    console.error('Error al ajustar tokens:', error);
    return {
      success: false,
      error: 'Error al ajustar tokens',
    };
  }
}

/**
 * Reembolsa tokens (devuelve al balance)
 */
export async function refundTokens(
  subscriptionId: string,
  amount: number,
  description: string,
  referenceType?: string,
  referenceId?: string
): Promise<TokenConsumptionResult> {
  const transactionId = generateId();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Devolver al purchased (ya que no sabemos de dónde se consumieron originalmente)
      const subscription = await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          purchasedTokensBalance: { increment: amount },
          tokensUsedThisPeriod: { decrement: Math.min(amount, 0) }, // No ir a negativo
        },
      });

      // Registrar reembolso
      await tx.tokenTransaction.create({
        data: {
          id: transactionId,
          subscriptionId,
          type: 'REFUND',
          amount,
          includedBalanceAfter: subscription.includedTokensRemaining,
          purchasedBalanceAfter: subscription.purchasedTokensBalance,
          description,
          referenceType,
          referenceId,
        },
      });

      return subscription;
    });

    return {
      success: true,
      balanceAfter: {
        included: result.includedTokensRemaining,
        purchased: result.purchasedTokensBalance,
        total: result.includedTokensRemaining + result.purchasedTokensBalance,
      },
      transactionId,
    };
  } catch (error) {
    console.error('Error al reembolsar tokens:', error);
    return {
      success: false,
      error: 'Error al reembolsar tokens',
    };
  }
}

/**
 * Obtiene el balance actual de tokens
 */
export async function getTokenBalance(subscriptionId: string): Promise<TokenBalance | null> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      includedTokensRemaining: true,
      purchasedTokensBalance: true,
      tokensUsedThisPeriod: true,
    },
  });

  if (!subscription) {
    return null;
  }

  return {
    included: subscription.includedTokensRemaining,
    purchased: subscription.purchasedTokensBalance,
    usedThisPeriod: subscription.tokensUsedThisPeriod,
    total: subscription.includedTokensRemaining + subscription.purchasedTokensBalance,
  };
}

/**
 * Calcula tokens disponibles para una suscripción (helper)
 */
export function calculateAvailableTokens(subscription: {
  includedTokensRemaining: number;
  purchasedTokensBalance: number;
}): number {
  return subscription.includedTokensRemaining + subscription.purchasedTokensBalance;
}

/**
 * Verifica si hay suficientes tokens sin consumir
 */
export async function hasEnoughTokens(
  subscriptionId: string,
  requiredAmount: number
): Promise<boolean> {
  const balance = await getTokenBalance(subscriptionId);
  if (!balance) return false;
  return balance.total >= requiredAmount;
}

/**
 * Obtiene el historial de transacciones de tokens
 */
export async function getTokenHistory(
  subscriptionId: string,
  options?: {
    type?: 'MONTHLY_CREDIT' | 'PURCHASE' | 'USAGE' | 'REFUND' | 'ADJUSTMENT' | 'EXPIRATION';
    limit?: number;
    offset?: number;
    from?: Date;
    to?: Date;
  }
) {
  const where: any = { subscriptionId };

  if (options?.type) {
    where.type = options.type;
  }

  if (options?.from || options?.to) {
    where.createdAt = {};
    if (options.from) where.createdAt.gte = options.from;
    if (options.to) where.createdAt.lte = options.to;
  }

  const [transactions, total] = await Promise.all([
    prisma.tokenTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    }),
    prisma.tokenTransaction.count({ where }),
  ]);

  return {
    transactions,
    total,
    hasMore: (options?.offset || 0) + transactions.length < total,
  };
}
