/**
 * Utilidades para Períodos de Nómina
 *
 * - Cálculo de días hábiles
 * - Manejo de feriados
 * - Ajuste de fechas de pago
 */

import {
  PaymentDayRule,
  PeriodType,
  PayrollPeriodData,
  PAYMENT_DAY_RULE,
  PERIOD_TYPE,
} from './config';

// =============================================================================
// TIPOS
// =============================================================================

export interface Holiday {
  date: Date;
  name: string;
  isNational: boolean;
}

// =============================================================================
// UTILIDADES DE FECHAS
// =============================================================================

/**
 * Verifica si una fecha es fin de semana
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Domingo = 0, Sábado = 6
}

/**
 * Verifica si una fecha es feriado
 */
export function isHoliday(date: Date, holidays: Holiday[]): boolean {
  const dateStr = formatDateOnly(date);
  return holidays.some((h) => formatDateOnly(h.date) === dateStr);
}

/**
 * Verifica si una fecha es día hábil (no fin de semana ni feriado)
 */
export function isBusinessDay(date: Date, holidays: Holiday[]): boolean {
  return !isWeekend(date) && !isHoliday(date, holidays);
}

/**
 * Formatea fecha como YYYY-MM-DD (solo fecha, sin hora)
 */
export function formatDateOnly(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Obtiene el último día del mes
 */
export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Crea una fecha a las 00:00:00 local
 */
export function createDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

// =============================================================================
// AJUSTE DE FECHAS DE PAGO
// =============================================================================

/**
 * Ajusta una fecha de pago según la regla configurada
 */
export function adjustPaymentDate(
  date: Date,
  rule: PaymentDayRule,
  holidays: Holiday[]
): Date {
  if (rule === PAYMENT_DAY_RULE.EXACT) {
    return date;
  }

  let adjusted = new Date(date);

  if (rule === PAYMENT_DAY_RULE.PREVIOUS_BUSINESS_DAY) {
    // Si cae en no-hábil, mover al día hábil anterior
    while (!isBusinessDay(adjusted, holidays)) {
      adjusted.setDate(adjusted.getDate() - 1);
    }
  } else if (rule === PAYMENT_DAY_RULE.NEXT_BUSINESS_DAY) {
    // Si cae en no-hábil, mover al día hábil siguiente
    while (!isBusinessDay(adjusted, holidays)) {
      adjusted.setDate(adjusted.getDate() + 1);
    }
  }

  return adjusted;
}

// =============================================================================
// CÁLCULO DE DÍAS HÁBILES
// =============================================================================

/**
 * Cuenta los días hábiles entre dos fechas (inclusive)
 */
export function countBusinessDays(
  startDate: Date,
  endDate: Date,
  holidays: Holiday[]
): number {
  let count = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    if (isBusinessDay(current, holidays)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Cuenta los días calendario entre dos fechas (inclusive)
 */
export function countCalendarDays(startDate: Date, endDate: Date): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// =============================================================================
// GENERACIÓN DE PERÍODOS
// =============================================================================

/**
 * Genera los datos de un período de nómina
 */
export function generatePeriodData(
  companyId: number,
  year: number,
  month: number,
  periodType: PeriodType,
  firstPaymentDay: number,
  secondPaymentDay: number,
  paymentDayRule: PaymentDayRule,
  holidays: Holiday[]
): PayrollPeriodData {
  const lastDay = getLastDayOfMonth(year, month);

  let periodStart: Date;
  let periodEnd: Date;
  let paymentDay: number;

  switch (periodType) {
    case PERIOD_TYPE.QUINCENA_1:
      periodStart = createDate(year, month, 1);
      periodEnd = createDate(year, month, 15);
      paymentDay = Math.min(firstPaymentDay, lastDay);
      break;

    case PERIOD_TYPE.QUINCENA_2:
      periodStart = createDate(year, month, 16);
      periodEnd = createDate(year, month, lastDay);
      paymentDay = Math.min(secondPaymentDay, lastDay);
      break;

    case PERIOD_TYPE.MONTHLY:
    default:
      periodStart = createDate(year, month, 1);
      periodEnd = createDate(year, month, lastDay);
      paymentDay = Math.min(secondPaymentDay, lastDay);
      break;
  }

  // Fecha de pago base
  let paymentDate = createDate(year, month, paymentDay);

  // Si es quincena 2 o mensual y el día de pago es menor a 16, pagar el mes siguiente
  if (
    (periodType === PERIOD_TYPE.QUINCENA_2 || periodType === PERIOD_TYPE.MONTHLY) &&
    paymentDay < 16
  ) {
    // El pago es del mes siguiente
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    paymentDate = createDate(nextYear, nextMonth, Math.min(paymentDay, getLastDayOfMonth(nextYear, nextMonth)));
  }

  // Ajustar fecha de pago según regla
  paymentDate = adjustPaymentDate(paymentDate, paymentDayRule, holidays);

  // Calcular días hábiles del período
  const businessDays = countBusinessDays(periodStart, periodEnd, holidays);

  return {
    companyId,
    periodType,
    year,
    month,
    periodStart,
    periodEnd,
    paymentDate,
    businessDays,
    isClosed: false,
  };
}

/**
 * Genera todos los períodos de un mes según la frecuencia
 */
export function generateMonthPeriods(
  companyId: number,
  year: number,
  month: number,
  paymentFrequency: 'MONTHLY' | 'BIWEEKLY',
  firstPaymentDay: number,
  secondPaymentDay: number,
  paymentDayRule: PaymentDayRule,
  holidays: Holiday[]
): PayrollPeriodData[] {
  const periods: PayrollPeriodData[] = [];

  if (paymentFrequency === 'BIWEEKLY') {
    // Dos quincenas
    periods.push(
      generatePeriodData(
        companyId,
        year,
        month,
        PERIOD_TYPE.QUINCENA_1,
        firstPaymentDay,
        secondPaymentDay,
        paymentDayRule,
        holidays
      )
    );
    periods.push(
      generatePeriodData(
        companyId,
        year,
        month,
        PERIOD_TYPE.QUINCENA_2,
        firstPaymentDay,
        secondPaymentDay,
        paymentDayRule,
        holidays
      )
    );
  } else {
    // Un período mensual
    periods.push(
      generatePeriodData(
        companyId,
        year,
        month,
        PERIOD_TYPE.MONTHLY,
        firstPaymentDay,
        secondPaymentDay,
        paymentDayRule,
        holidays
      )
    );
  }

  return periods;
}

// =============================================================================
// CÁLCULO DE PRORRATEO
// =============================================================================

/**
 * Calcula el factor de prorrateo para un empleado en un período
 *
 * @param hireDate - Fecha de alta del empleado
 * @param terminationDate - Fecha de baja (si aplica)
 * @param periodStart - Inicio del período
 * @param periodEnd - Fin del período
 * @returns Factor entre 0 y 1 (1 = mes completo)
 */
export function calculateProrateFactor(
  hireDate: Date | null,
  terminationDate: Date | null,
  periodStart: Date,
  periodEnd: Date
): number {
  const totalDays = countCalendarDays(periodStart, periodEnd);

  // Determinar fecha de inicio efectiva
  let effectiveStart = periodStart;
  if (hireDate && hireDate > periodStart) {
    effectiveStart = hireDate;
  }

  // Determinar fecha de fin efectiva
  let effectiveEnd = periodEnd;
  if (terminationDate && terminationDate < periodEnd) {
    effectiveEnd = terminationDate;
  }

  // Si no hay overlap, factor = 0
  if (effectiveStart > effectiveEnd) {
    return 0;
  }

  const workedDays = countCalendarDays(effectiveStart, effectiveEnd);
  return workedDays / totalDays;
}

/**
 * Verifica si un empleado estaba activo durante un período
 */
export function wasActiveInPeriod(
  hireDate: Date | null,
  terminationDate: Date | null,
  periodStart: Date,
  periodEnd: Date,
  isActive: boolean
): boolean {
  // Si no está activo actualmente y no tiene fecha de baja, no incluir
  if (!isActive && !terminationDate) {
    return false;
  }

  // Si fue dado de alta después del fin del período, no incluir
  if (hireDate && hireDate > periodEnd) {
    return false;
  }

  // Si fue dado de baja antes del inicio del período, no incluir
  if (terminationDate && terminationDate < periodStart) {
    return false;
  }

  return true;
}

// =============================================================================
// UTILIDADES DE ANTIGÜEDAD
// =============================================================================

/**
 * Calcula los años de antigüedad de un empleado
 */
export function calculateYearsOfService(hireDate: Date | null, referenceDate: Date): number {
  if (!hireDate) return 0;

  const years =
    (referenceDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.floor(Math.max(0, years));
}

/**
 * Calcula los meses de antigüedad de un empleado
 */
export function calculateMonthsOfService(hireDate: Date | null, referenceDate: Date): number {
  if (!hireDate) return 0;

  const years = referenceDate.getFullYear() - hireDate.getFullYear();
  const months = referenceDate.getMonth() - hireDate.getMonth();
  const totalMonths = years * 12 + months;

  // Ajustar si el día del mes no ha llegado
  if (referenceDate.getDate() < hireDate.getDate()) {
    return Math.max(0, totalMonths - 1);
  }

  return Math.max(0, totalMonths);
}

// =============================================================================
// PRÓXIMO PERÍODO DE PAGO
// =============================================================================

/**
 * Obtiene la información del próximo pago programado
 */
export function getNextPaymentInfo(
  periods: PayrollPeriodData[],
  today: Date = new Date()
): PayrollPeriodData | null {
  // Filtrar períodos con fecha de pago futura y ordenar
  const futurePeriods = periods
    .filter((p) => p.paymentDate >= today && !p.isClosed)
    .sort((a, b) => a.paymentDate.getTime() - b.paymentDate.getTime());

  return futurePeriods[0] || null;
}

/**
 * Calcula cuántos días faltan para el próximo pago
 */
export function daysUntilNextPayment(
  paymentDate: Date,
  today: Date = new Date()
): number {
  const diff = paymentDate.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// =============================================================================
// FORMATEO
// =============================================================================

/**
 * Formatea un período para mostrar (ej: "Enero 2024 - 1ra Quincena")
 */
export function formatPeriodDisplay(period: PayrollPeriodData): string {
  const monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  const monthName = monthNames[period.month - 1];

  switch (period.periodType) {
    case PERIOD_TYPE.QUINCENA_1:
      return `${monthName} ${period.year} - 1ra Quincena`;
    case PERIOD_TYPE.QUINCENA_2:
      return `${monthName} ${period.year} - 2da Quincena`;
    case PERIOD_TYPE.MONTHLY:
    default:
      return `${monthName} ${period.year}`;
  }
}

/**
 * Formatea una fecha para mostrar
 */
export function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formatea un monto como moneda
 */
export function formatCurrency(amount: number, currency: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
