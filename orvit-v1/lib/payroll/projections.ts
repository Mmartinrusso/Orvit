/**
 * Proyecciones de Flujo de Caja para Nóminas
 *
 * Calcula cuánto dinero se necesita para próximos pagos
 */

import {
  PayrollProjection,
  PeriodType,
  PayrollPeriodData,
  SalaryComponentData,
} from './config';
import {
  generateMonthPeriods,
  formatPeriodDisplay,
  formatCurrency,
  daysUntilNextPayment,
  Holiday,
} from './period-utils';
import { EmployeeData, estimateNextPayment } from './calculator';

// =============================================================================
// TIPOS
// =============================================================================

export interface ProjectionConfig {
  paymentFrequency: 'MONTHLY' | 'BIWEEKLY';
  firstPaymentDay: number;
  secondPaymentDay: number;
  paymentDayRule: 'PREVIOUS_BUSINESS_DAY' | 'NEXT_BUSINESS_DAY' | 'EXACT';
}

export interface PendingAdvance {
  employeeId: string;
  employeeName: string;
  amount: number;
  remainingAmount: number;
  nextInstallmentAmount: number;
}

export interface ProjectionSummary {
  nextPayment: {
    date: Date;
    daysUntil: number;
    periodType: PeriodType;
    periodDisplay: string;
    estimatedTotal: number;
    employeeCount: number;
    breakdown: {
      grossSalaries: number;
      deductions: number;
      advances: number;
      netTotal: number;
      employerCost: number;
    };
  } | null;
  monthlyProjection: PayrollProjection[];
  pendingAdvances: {
    total: number;
    count: number;
    byEmployee: PendingAdvance[];
  };
  alerts: ProjectionAlert[];
}

export interface ProjectionAlert {
  type: 'warning' | 'info' | 'error';
  message: string;
  details?: string;
}

// =============================================================================
// PROYECCIÓN DE PRÓXIMO PAGO
// =============================================================================

/**
 * Calcula la proyección del próximo pago
 */
export function calculateNextPaymentProjection(
  employees: EmployeeData[],
  components: SalaryComponentData[],
  periods: PayrollPeriodData[],
  pendingAdvances: PendingAdvance[],
  today: Date = new Date()
): PayrollProjection | null {
  // Encontrar el próximo período con fecha de pago futura
  const futurePeriods = periods
    .filter((p) => p.paymentDate >= today && !p.isClosed)
    .sort((a, b) => a.paymentDate.getTime() - b.paymentDate.getTime());

  const nextPeriod = futurePeriods[0];
  if (!nextPeriod) {
    return null;
  }

  // Calcular adelantos que se descontarán en este período
  const advancesForPeriod = pendingAdvances.reduce(
    (sum, adv) => sum + adv.nextInstallmentAmount,
    0
  );

  // Estimar el pago
  const estimation = estimateNextPayment(
    employees,
    components,
    {
      periodStart: nextPeriod.periodStart,
      periodEnd: nextPeriod.periodEnd,
      businessDays: nextPeriod.businessDays,
    },
    pendingAdvances.map((a) => ({
      employeeId: a.employeeId,
      amount: a.nextInstallmentAmount,
    }))
  );

  return {
    periodType: nextPeriod.periodType as PeriodType,
    paymentDate: nextPeriod.paymentDate,
    estimatedTotal: estimation.estimated.totalNet,
    employeeCount: estimation.estimated.employeeCount,
    pendingAdvances: advancesForPeriod,
    breakdown: {
      grossSalaries: estimation.estimated.totalGross,
      deductions: estimation.estimated.totalDeductions - advancesForPeriod,
      advances: advancesForPeriod,
      netTotal: estimation.estimated.totalNet,
      employerCost: estimation.estimated.totalEmployerCost,
    },
  };
}

// =============================================================================
// PROYECCIÓN MENSUAL (3 MESES)
// =============================================================================

/**
 * Genera proyección para los próximos N meses
 */
export function generateMonthlyProjections(
  companyId: number,
  employees: EmployeeData[],
  components: SalaryComponentData[],
  config: ProjectionConfig,
  holidays: Holiday[],
  pendingAdvances: PendingAdvance[],
  monthsAhead: number = 3,
  today: Date = new Date()
): PayrollProjection[] {
  const projections: PayrollProjection[] = [];
  let currentYear = today.getFullYear();
  let currentMonth = today.getMonth() + 1;

  for (let i = 0; i < monthsAhead; i++) {
    // Generar períodos del mes
    const periods = generateMonthPeriods(
      companyId,
      currentYear,
      currentMonth,
      config.paymentFrequency,
      config.firstPaymentDay,
      config.secondPaymentDay,
      config.paymentDayRule,
      holidays
    );

    // Calcular proyección para cada período
    for (const period of periods) {
      // Solo incluir si la fecha de pago es futura
      if (period.paymentDate >= today) {
        // Distribuir adelantos proporcionalmente
        const advancesPerPeriod = pendingAdvances.reduce(
          (sum, adv) => sum + adv.nextInstallmentAmount,
          0
        );

        const estimation = estimateNextPayment(
          employees,
          components,
          {
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            businessDays: period.businessDays,
          },
          []
        );

        projections.push({
          periodType: period.periodType as PeriodType,
          paymentDate: period.paymentDate,
          estimatedTotal: estimation.estimated.totalNet - advancesPerPeriod,
          employeeCount: estimation.estimated.employeeCount,
          pendingAdvances: advancesPerPeriod,
          breakdown: {
            grossSalaries: estimation.estimated.totalGross,
            deductions: estimation.estimated.totalDeductions,
            advances: advancesPerPeriod,
            netTotal: estimation.estimated.totalNet - advancesPerPeriod,
            employerCost: estimation.estimated.totalEmployerCost,
          },
        });
      }
    }

    // Avanzar al siguiente mes
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }

  return projections;
}

// =============================================================================
// RESUMEN COMPLETO
// =============================================================================

/**
 * Genera un resumen completo de proyecciones
 */
export function generateProjectionSummary(
  companyId: number,
  employees: EmployeeData[],
  components: SalaryComponentData[],
  periods: PayrollPeriodData[],
  config: ProjectionConfig,
  holidays: Holiday[],
  pendingAdvances: PendingAdvance[],
  today: Date = new Date()
): ProjectionSummary {
  const alerts: ProjectionAlert[] = [];

  // Próximo pago
  const nextPaymentProjection = calculateNextPaymentProjection(
    employees,
    components,
    periods,
    pendingAdvances,
    today
  );

  let nextPayment = null;
  if (nextPaymentProjection) {
    const nextPeriod = periods.find(
      (p) =>
        p.paymentDate.getTime() === nextPaymentProjection.paymentDate.getTime() &&
        p.periodType === nextPaymentProjection.periodType
    );

    nextPayment = {
      date: nextPaymentProjection.paymentDate,
      daysUntil: daysUntilNextPayment(nextPaymentProjection.paymentDate, today),
      periodType: nextPaymentProjection.periodType,
      periodDisplay: nextPeriod ? formatPeriodDisplay(nextPeriod) : '',
      estimatedTotal: nextPaymentProjection.estimatedTotal,
      employeeCount: nextPaymentProjection.employeeCount,
      breakdown: nextPaymentProjection.breakdown,
    };

    // Alertas
    if (nextPayment.daysUntil <= 3) {
      alerts.push({
        type: 'warning',
        message: `Pago programado en ${nextPayment.daysUntil} día${nextPayment.daysUntil !== 1 ? 's' : ''}`,
        details: `Necesitas ${formatCurrency(nextPayment.estimatedTotal)} para el ${nextPayment.periodDisplay}`,
      });
    }
  } else {
    alerts.push({
      type: 'info',
      message: 'No hay períodos de pago configurados',
      details: 'Genera los períodos del mes actual para ver proyecciones',
    });
  }

  // Proyección mensual
  const monthlyProjection = generateMonthlyProjections(
    companyId,
    employees,
    components,
    config,
    holidays,
    pendingAdvances,
    3,
    today
  );

  // Adelantos pendientes
  const advancesTotal = pendingAdvances.reduce((sum, a) => sum + a.remainingAmount, 0);

  if (pendingAdvances.length > 0) {
    alerts.push({
      type: 'info',
      message: `${pendingAdvances.length} adelanto${pendingAdvances.length !== 1 ? 's' : ''} pendiente${pendingAdvances.length !== 1 ? 's' : ''}`,
      details: `Total pendiente de descontar: ${formatCurrency(advancesTotal)}`,
    });
  }

  // Alerta si hay muchos empleados sin fecha de alta
  const employeesWithoutHireDate = employees.filter((e) => !e.hireDate);
  if (employeesWithoutHireDate.length > 0) {
    alerts.push({
      type: 'warning',
      message: `${employeesWithoutHireDate.length} empleado${employeesWithoutHireDate.length !== 1 ? 's' : ''} sin fecha de alta`,
      details: 'No se puede calcular antigüedad correctamente',
    });
  }

  return {
    nextPayment,
    monthlyProjection,
    pendingAdvances: {
      total: advancesTotal,
      count: pendingAdvances.length,
      byEmployee: pendingAdvances,
    },
    alerts,
  };
}

// =============================================================================
// UTILIDADES DE FORMATO
// =============================================================================

/**
 * Formatea un resumen de proyección para mostrar
 */
export function formatProjectionMessage(summary: ProjectionSummary): string {
  if (!summary.nextPayment) {
    return 'No hay pagos programados próximamente.';
  }

  const { nextPayment } = summary;
  const dateStr = nextPayment.date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  let message = `📅 Próximo pago: ${dateStr}\n`;
  message += `💰 Necesitas: ${formatCurrency(nextPayment.estimatedTotal)}\n`;
  message += `👥 Empleados: ${nextPayment.employeeCount}\n`;

  if (summary.pendingAdvances.total > 0) {
    message += `📋 Adelantos a descontar: ${formatCurrency(nextPayment.breakdown.advances)}\n`;
  }

  return message;
}

/**
 * Calcula el total necesario para los próximos N días
 */
export function calculateTotalNeededInDays(
  projections: PayrollProjection[],
  days: number,
  today: Date = new Date()
): number {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + days);

  return projections
    .filter((p) => p.paymentDate >= today && p.paymentDate <= cutoff)
    .reduce((sum, p) => sum + p.estimatedTotal, 0);
}
