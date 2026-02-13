/**
 * Configuración y Tipos del Módulo de Nóminas
 */

// =============================================================================
// ENUMS Y CONSTANTES
// =============================================================================

export const PAYMENT_FREQUENCY = {
  MONTHLY: 'MONTHLY',
  BIWEEKLY: 'BIWEEKLY',
} as const;

export const PERIOD_TYPE = {
  QUINCENA_1: 'QUINCENA_1',
  QUINCENA_2: 'QUINCENA_2',
  MONTHLY: 'MONTHLY',
} as const;

export const PAYMENT_DAY_RULE = {
  PREVIOUS_BUSINESS_DAY: 'PREVIOUS_BUSINESS_DAY',
  NEXT_BUSINESS_DAY: 'NEXT_BUSINESS_DAY',
  EXACT: 'EXACT',
} as const;

export const COMPONENT_TYPE = {
  EARNING: 'EARNING',
  DEDUCTION: 'DEDUCTION',
} as const;

export const CALC_TYPE = {
  FIXED: 'FIXED',
  PERCENTAGE: 'PERCENTAGE',
  FORMULA: 'FORMULA',
  DAYS_BASED: 'DAYS_BASED',
} as const;

export const BASE_VARIABLE = {
  GROSS: 'gross',
  BASE: 'base',
  NET: 'net',
} as const;

export const ROUNDING_MODE = {
  HALF_UP: 'HALF_UP',
  DOWN: 'DOWN',
  UP: 'UP',
  NONE: 'NONE',
} as const;

export const PAYROLL_STATUS = {
  DRAFT: 'DRAFT',
  CALCULATED: 'CALCULATED',
  APPROVED: 'APPROVED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
} as const;

export const ADVANCE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export const INSTALLMENT_STATUS = {
  PENDING: 'PENDING',
  DISCOUNTED: 'DISCOUNTED',
} as const;

export const AUDIT_ACTIONS = {
  CREATED: 'CREATED',
  CALCULATED: 'CALCULATED',
  RECALCULATED: 'RECALCULATED',
  APPROVED: 'APPROVED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  REOPENED: 'REOPENED',
} as const;

// =============================================================================
// TIPOS
// =============================================================================

export type PaymentFrequency = (typeof PAYMENT_FREQUENCY)[keyof typeof PAYMENT_FREQUENCY];
export type PeriodType = (typeof PERIOD_TYPE)[keyof typeof PERIOD_TYPE];
export type PaymentDayRule = (typeof PAYMENT_DAY_RULE)[keyof typeof PAYMENT_DAY_RULE];
export type ComponentType = (typeof COMPONENT_TYPE)[keyof typeof COMPONENT_TYPE];
export type CalcType = (typeof CALC_TYPE)[keyof typeof CALC_TYPE];
export type BaseVariable = (typeof BASE_VARIABLE)[keyof typeof BASE_VARIABLE];
export type RoundingMode = (typeof ROUNDING_MODE)[keyof typeof ROUNDING_MODE];
export type PayrollStatus = (typeof PAYROLL_STATUS)[keyof typeof PAYROLL_STATUS];
export type AdvanceStatus = (typeof ADVANCE_STATUS)[keyof typeof ADVANCE_STATUS];
export type InstallmentStatus = (typeof INSTALLMENT_STATUS)[keyof typeof INSTALLMENT_STATUS];
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// =============================================================================
// INTERFACES DE CONFIGURACIÓN
// =============================================================================

export interface PayrollConfigData {
  id?: number;
  companyId: number;
  paymentFrequency: PaymentFrequency;
  firstPaymentDay: number;
  secondPaymentDay: number;
  quincenaPercentage: number;
  paymentDayRule: PaymentDayRule;
  maxAdvancePercent: number;
  maxActiveAdvances: number;
}

export interface SalaryComponentData {
  id?: number;
  companyId: number;
  code: string;
  name: string;
  type: ComponentType;
  calcType: CalcType;
  calcValue?: number | null;
  calcFormula?: string | null;
  baseVariable: BaseVariable;
  dependsOn: string[];
  roundingMode: RoundingMode;
  roundingDecimals: number;
  capMin?: number | null;
  capMax?: number | null;
  isTaxable: boolean;
  isActive: boolean;
  applyTo: string;
  prorateOnPartial: boolean;
  order: number;
}

// =============================================================================
// CONTEXTO DE FÓRMULAS
// =============================================================================

export interface FormulaContext {
  // Variables del empleado
  base: number;
  gross: number;
  years: number;
  months: number;
  hire_date: Date | null;

  // Variables del período
  days_in_period: number;
  days_worked: number;
  absence_days: number;
  overtime_hours: number;
  vacation_days: number;

  // Inputs custom del período
  bonus: number;
  commission: number;
  [key: string]: number | Date | null;
}

// =============================================================================
// INTERFACES DE LIQUIDACIÓN
// =============================================================================

export interface PayrollPeriodData {
  id?: number;
  companyId: number;
  periodType: PeriodType;
  year: number;
  month: number;
  periodStart: Date;
  periodEnd: Date;
  paymentDate: Date;
  businessDays: number;
  isClosed: boolean;
}

export interface PayrollInputData {
  periodId: number;
  employeeId: string;
  inputKey: string;
  inputValue: number;
  meta?: Record<string, unknown>;
}

export interface PayrollItemLineData {
  componentId?: number;
  code: string;
  name: string;
  type: ComponentType;
  baseAmount: number;
  calculatedAmount: number;
  finalAmount: number;
  formulaUsed?: string;
  meta?: Record<string, unknown>;
}

export interface PayrollItemData {
  employeeId: string;
  employeeName: string;
  costCenterId?: number;
  daysWorked: number;
  daysInPeriod: number;
  prorateFactor: number;
  baseSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  advancesDiscounted: number;
  netSalary: number;
  employerCost: number;
  lines: PayrollItemLineData[];
}

export interface PayrollData {
  id?: number;
  companyId: number;
  periodId: number;
  status: PayrollStatus;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  totalEmployerCost: number;
  employeeCount: number;
  notes?: string;
  items: PayrollItemData[];
}

// =============================================================================
// INTERFACES DE ADELANTOS
// =============================================================================

export interface SalaryAdvanceData {
  id?: number;
  companyId: number;
  employeeId: string;
  amount: number;
  installmentsCount: number;
  installmentAmount: number;
  remainingAmount: number;
  requestDate: Date;
  status: AdvanceStatus;
  notes?: string;
  approvedAt?: Date;
  approvedBy?: number;
  rejectedAt?: Date;
  rejectedBy?: number;
  rejectReason?: string;
  payrollId?: number;
}

export interface AdvanceInstallmentData {
  id?: number;
  advanceId: number;
  installmentNum: number;
  amount: number;
  duePeriodId?: number;
  status: InstallmentStatus;
  discountedAt?: Date;
  payrollItemId?: number;
}

// =============================================================================
// INTERFACES DE PROYECCIÓN
// =============================================================================

export interface PayrollProjection {
  periodType: PeriodType;
  paymentDate: Date;
  estimatedTotal: number;
  employeeCount: number;
  pendingAdvances: number;
  breakdown: {
    grossSalaries: number;
    deductions: number;
    advances: number;
    netTotal: number;
    employerCost: number;
  };
}

// =============================================================================
// COMPONENTES PREDETERMINADOS (Argentina)
// =============================================================================

export const DEFAULT_COMPONENTS_AR: Partial<SalaryComponentData>[] = [
  {
    code: 'SUELDO_BASE',
    name: 'Sueldo Básico',
    type: 'EARNING',
    calcType: 'FIXED',
    baseVariable: 'base',
    dependsOn: [],
    roundingMode: 'HALF_UP',
    roundingDecimals: 2,
    isTaxable: true,
    isActive: true,
    applyTo: 'ALL',
    prorateOnPartial: true,
    order: 0,
  },
  {
    code: 'PRESENTISMO',
    name: 'Presentismo',
    type: 'EARNING',
    calcType: 'FORMULA',
    calcFormula: 'days_worked >= (days_in_period - 1) ? base * 0.0833 : 0',
    baseVariable: 'base',
    dependsOn: ['SUELDO_BASE'],
    roundingMode: 'HALF_UP',
    roundingDecimals: 2,
    isTaxable: true,
    isActive: true,
    applyTo: 'ALL',
    prorateOnPartial: false,
    order: 10,
  },
  {
    code: 'ANTIGUEDAD',
    name: 'Antigüedad',
    type: 'EARNING',
    calcType: 'FORMULA',
    calcFormula: 'base * 0.01 * years',
    baseVariable: 'base',
    dependsOn: ['SUELDO_BASE'],
    roundingMode: 'HALF_UP',
    roundingDecimals: 2,
    isTaxable: true,
    isActive: true,
    applyTo: 'ALL',
    prorateOnPartial: true,
    order: 20,
  },
  {
    code: 'JUBILACION',
    name: 'Jubilación (11%)',
    type: 'DEDUCTION',
    calcType: 'PERCENTAGE',
    calcValue: 11,
    baseVariable: 'gross',
    dependsOn: [],
    roundingMode: 'HALF_UP',
    roundingDecimals: 2,
    isTaxable: false,
    isActive: true,
    applyTo: 'ALL',
    prorateOnPartial: true,
    order: 100,
  },
  {
    code: 'OBRA_SOCIAL',
    name: 'Obra Social (3%)',
    type: 'DEDUCTION',
    calcType: 'PERCENTAGE',
    calcValue: 3,
    baseVariable: 'gross',
    dependsOn: [],
    roundingMode: 'HALF_UP',
    roundingDecimals: 2,
    isTaxable: false,
    isActive: true,
    applyTo: 'ALL',
    prorateOnPartial: true,
    order: 110,
  },
  {
    code: 'LEY_19032',
    name: 'Ley 19.032 (3%)',
    type: 'DEDUCTION',
    calcType: 'PERCENTAGE',
    calcValue: 3,
    baseVariable: 'gross',
    dependsOn: [],
    roundingMode: 'HALF_UP',
    roundingDecimals: 2,
    isTaxable: false,
    isActive: true,
    applyTo: 'ALL',
    prorateOnPartial: true,
    order: 120,
  },
  {
    code: 'CARGAS_SOCIALES_EMPLEADOR',
    name: 'Cargas Sociales Empleador (23%)',
    type: 'EARNING', // Se suma al costo empleador, no al neto
    calcType: 'PERCENTAGE',
    calcValue: 23,
    baseVariable: 'gross',
    dependsOn: [],
    roundingMode: 'HALF_UP',
    roundingDecimals: 2,
    isTaxable: false,
    isActive: true,
    applyTo: 'ALL',
    prorateOnPartial: true,
    order: 200,
  },
];

// =============================================================================
// INPUTS ESTÁNDAR DE PERÍODO
// =============================================================================

export const STANDARD_PAYROLL_INPUTS = {
  DAYS_WORKED: 'days_worked',
  ABSENCE_DAYS: 'absence_days',
  OVERTIME_HOURS: 'overtime_hours',
  OVERTIME_HOURS_50: 'overtime_hours_50',
  OVERTIME_HOURS_100: 'overtime_hours_100',
  VACATION_DAYS: 'vacation_days',
  SICK_DAYS: 'sick_days',
  BONUS: 'bonus',
  COMMISSION: 'commission',
} as const;

export type StandardPayrollInput =
  (typeof STANDARD_PAYROLL_INPUTS)[keyof typeof STANDARD_PAYROLL_INPUTS];

// =============================================================================
// UTILIDADES
// =============================================================================

export function getPayrollStatusLabel(status: PayrollStatus): string {
  const labels: Record<PayrollStatus, string> = {
    DRAFT: 'Borrador',
    CALCULATED: 'Calculada',
    APPROVED: 'Aprobada',
    PAID: 'Pagada',
    CANCELLED: 'Cancelada',
  };
  return labels[status] || status;
}

export function getAdvanceStatusLabel(status: AdvanceStatus): string {
  const labels: Record<AdvanceStatus, string> = {
    PENDING: 'Pendiente',
    APPROVED: 'Aprobado',
    ACTIVE: 'Activo',
    COMPLETED: 'Completado',
    REJECTED: 'Rechazado',
    CANCELLED: 'Cancelado',
  };
  return labels[status] || status;
}

export function getComponentTypeLabel(type: ComponentType): string {
  return type === 'EARNING' ? 'Haberes' : 'Descuentos';
}

export function getPeriodTypeLabel(type: PeriodType): string {
  const labels: Record<PeriodType, string> = {
    QUINCENA_1: '1ra Quincena',
    QUINCENA_2: '2da Quincena',
    MONTHLY: 'Mensual',
  };
  return labels[type] || type;
}

export function canEditPayroll(status: PayrollStatus): boolean {
  return status === 'DRAFT' || status === 'CALCULATED';
}

export function canApprovePayroll(status: PayrollStatus): boolean {
  return status === 'CALCULATED';
}

export function canPayPayroll(status: PayrollStatus): boolean {
  return status === 'APPROVED';
}

export function canCancelPayroll(status: PayrollStatus): boolean {
  return status !== 'PAID' && status !== 'CANCELLED';
}
