/**
 * Servicio de Prorrateo para Billing
 * Calcula ajustes al cambiar de plan o ciclo de facturación
 */

import { Prisma, BillingCycle } from '@prisma/client';

export interface ProrationResult {
  // Crédito por tiempo no usado del plan actual
  creditAmount: number;
  creditDays: number;

  // Cargo por el nuevo plan (resto del período)
  chargeAmount: number;
  chargeDays: number;

  // Neto a cobrar (puede ser negativo = crédito)
  netAmount: number;

  // Detalles para factura
  items: ProrationItem[];
}

export interface ProrationItem {
  type: 'CREDIT' | 'CHARGE';
  description: string;
  days: number;
  dailyRate: number;
  total: number;
}

export interface PlanPricing {
  monthlyPrice: number;
  annualPrice: number | null;
}

/**
 * Calcula el prorrateo al cambiar de plan
 */
export function calculateProration(
  currentPlan: PlanPricing,
  newPlan: PlanPricing,
  currentCycle: BillingCycle,
  newCycle: BillingCycle,
  periodStart: Date,
  periodEnd: Date,
  changeDate: Date = new Date()
): ProrationResult {
  // Calcular días totales y restantes del período
  const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
  const usedDays = Math.ceil((changeDate.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
  const remainingDays = totalDays - usedDays;

  if (remainingDays <= 0) {
    return {
      creditAmount: 0,
      creditDays: 0,
      chargeAmount: 0,
      chargeDays: 0,
      netAmount: 0,
      items: [],
    };
  }

  // Calcular precio del período actual
  const currentPeriodPrice = currentCycle === 'ANNUAL' && currentPlan.annualPrice
    ? currentPlan.annualPrice
    : currentPlan.monthlyPrice * (currentCycle === 'ANNUAL' ? 12 : 1);

  // Calcular precio del nuevo período
  const newPeriodPrice = newCycle === 'ANNUAL' && newPlan.annualPrice
    ? newPlan.annualPrice
    : newPlan.monthlyPrice * (newCycle === 'ANNUAL' ? 12 : 1);

  // Días del período según ciclo
  const periodDaysForCurrent = currentCycle === 'ANNUAL' ? 365 : 30;
  const periodDaysForNew = newCycle === 'ANNUAL' ? 365 : 30;

  // Tasa diaria
  const currentDailyRate = currentPeriodPrice / periodDaysForCurrent;
  const newDailyRate = newPeriodPrice / periodDaysForNew;

  // Crédito por tiempo no usado
  const creditAmount = currentDailyRate * remainingDays;

  // Cargo por el nuevo plan (resto del período actual)
  const chargeAmount = newDailyRate * remainingDays;

  const items: ProrationItem[] = [];

  // Item de crédito
  if (creditAmount > 0) {
    items.push({
      type: 'CREDIT',
      description: `Crédito por ${remainingDays} días no utilizados del plan anterior`,
      days: remainingDays,
      dailyRate: -currentDailyRate,
      total: -creditAmount,
    });
  }

  // Item de cargo
  if (chargeAmount > 0) {
    items.push({
      type: 'CHARGE',
      description: `Cargo por ${remainingDays} días del nuevo plan`,
      days: remainingDays,
      dailyRate: newDailyRate,
      total: chargeAmount,
    });
  }

  return {
    creditAmount: Math.round(creditAmount * 100) / 100,
    creditDays: remainingDays,
    chargeAmount: Math.round(chargeAmount * 100) / 100,
    chargeDays: remainingDays,
    netAmount: Math.round((chargeAmount - creditAmount) * 100) / 100,
    items,
  };
}

/**
 * Determina si el cambio es un upgrade o downgrade
 */
export function getPlanChangeType(
  currentMonthlyPrice: number,
  newMonthlyPrice: number
): 'upgrade' | 'downgrade' | 'same' {
  if (newMonthlyPrice > currentMonthlyPrice) return 'upgrade';
  if (newMonthlyPrice < currentMonthlyPrice) return 'downgrade';
  return 'same';
}

/**
 * Calcula el precio efectivo mensual para comparación
 */
export function getEffectiveMonthlyPrice(
  plan: PlanPricing,
  cycle: BillingCycle
): number {
  if (cycle === 'ANNUAL' && plan.annualPrice) {
    return plan.annualPrice / 12;
  }
  return plan.monthlyPrice;
}

/**
 * Calcula fecha de próximo cobro después de cambio
 */
export function getNextBillingDateAfterChange(
  periodEnd: Date,
  newCycle: BillingCycle,
  immediateChange: boolean = true
): Date {
  if (immediateChange) {
    // El próximo cobro es al final del período actual
    return new Date(periodEnd);
  }

  // Si el cambio es diferido, calcular según el nuevo ciclo
  const nextDate = new Date(periodEnd);
  if (newCycle === 'ANNUAL') {
    nextDate.setFullYear(nextDate.getFullYear() + 1);
  } else {
    nextDate.setMonth(nextDate.getMonth() + 1);
  }

  return nextDate;
}

/**
 * Formatea el resultado del prorrateo para mostrar al usuario
 */
export function formatProrationForDisplay(
  proration: ProrationResult,
  currency: string = 'ARS'
): {
  summary: string;
  details: string[];
  isCredit: boolean;
  formattedNet: string;
} {
  const formatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
  });

  const details = proration.items.map(item => {
    const sign = item.type === 'CREDIT' ? '-' : '+';
    return `${sign} ${formatter.format(Math.abs(item.total))} - ${item.description}`;
  });

  const isCredit = proration.netAmount < 0;
  const formattedNet = formatter.format(Math.abs(proration.netAmount));

  let summary: string;
  if (isCredit) {
    summary = `Se generará un crédito de ${formattedNet} a tu favor`;
  } else if (proration.netAmount > 0) {
    summary = `Se cobrará un ajuste de ${formattedNet}`;
  } else {
    summary = 'No hay ajuste de precio';
  }

  return {
    summary,
    details,
    isCredit,
    formattedNet,
  };
}
