/**
 * Motor de Cálculo de Nóminas
 *
 * Calcula sueldos, haberes, descuentos y costos de empleador
 */

import {
  SalaryComponentData,
  FormulaContext,
  PayrollItemData,
  PayrollItemLineData,
  COMPONENT_TYPE,
  CALC_TYPE,
  PayrollInputData,
} from './config';
import { evaluateFormula, applyRounding, applyCaps } from './formula-parser';
import {
  calculateYearsOfService,
  calculateMonthsOfService,
  calculateProrateFactor,
  wasActiveInPeriod,
} from './period-utils';

// =============================================================================
// TIPOS
// =============================================================================

export interface EmployeeData {
  id: string;
  name: string;
  grossSalary: number;
  hireDate: Date | null;
  terminationDate: Date | null;
  isActive: boolean;
  costCenterId?: number;
}

export interface PeriodData {
  periodStart: Date;
  periodEnd: Date;
  businessDays: number;
}

export interface CalculationResult {
  items: PayrollItemData[];
  totals: {
    totalGross: number;
    totalDeductions: number;
    totalNet: number;
    totalEmployerCost: number;
    employeeCount: number;
  };
}

export interface AdvanceToDiscount {
  advanceId: number;
  installmentId: number;
  amount: number;
  employeeId: string;
}

// =============================================================================
// ORDENAMIENTO DE COMPONENTES
// =============================================================================

/**
 * Ordena los componentes respetando las dependencias
 */
function sortComponentsByDependency(components: SalaryComponentData[]): SalaryComponentData[] {
  const sorted: SalaryComponentData[] = [];
  const remaining = [...components];
  const added = new Set<string>();

  // Primero los que no tienen dependencias
  let iterations = 0;
  const maxIterations = components.length * 2;

  while (remaining.length > 0 && iterations < maxIterations) {
    iterations++;

    for (let i = remaining.length - 1; i >= 0; i--) {
      const comp = remaining[i];
      const deps = comp.dependsOn || [];

      // Si todas las dependencias ya fueron agregadas
      const allDepsResolved = deps.every((dep) => added.has(dep));

      if (allDepsResolved) {
        sorted.push(comp);
        added.add(comp.code);
        remaining.splice(i, 1);
      }
    }
  }

  // Si quedaron componentes, agregarlos al final (posible ciclo de dependencias)
  if (remaining.length > 0) {
    console.warn('Posible ciclo de dependencias en componentes:', remaining.map((c) => c.code));
    sorted.push(...remaining);
  }

  // Ordenar por el campo 'order' dentro de cada nivel de dependencia
  return sorted.sort((a, b) => a.order - b.order);
}

// =============================================================================
// CONSTRUCCIÓN DE CONTEXTO
// =============================================================================

/**
 * Construye el contexto de fórmulas para un empleado
 */
function buildFormulaContext(
  employee: EmployeeData,
  period: PeriodData,
  inputs: PayrollInputData[],
  calculatedComponents: Map<string, number>
): FormulaContext {
  // Obtener inputs del período para este empleado
  const employeeInputs = inputs.filter((i) => i.employeeId === employee.id);
  const inputMap = new Map<string, number>();
  for (const input of employeeInputs) {
    inputMap.set(input.inputKey, input.inputValue);
  }

  // Calcular antigüedad
  const referenceDate = period.periodEnd;
  const years = calculateYearsOfService(employee.hireDate, referenceDate);
  const months = calculateMonthsOfService(employee.hireDate, referenceDate);

  // Contexto base
  const context: FormulaContext = {
    base: employee.grossSalary,
    gross: employee.grossSalary, // Se actualizará después de calcular haberes
    years,
    months,
    hire_date: employee.hireDate,
    days_in_period: period.businessDays,
    days_worked: inputMap.get('days_worked') ?? period.businessDays,
    absence_days: inputMap.get('absence_days') ?? 0,
    overtime_hours: inputMap.get('overtime_hours') ?? 0,
    vacation_days: inputMap.get('vacation_days') ?? 0,
    bonus: inputMap.get('bonus') ?? 0,
    commission: inputMap.get('commission') ?? 0,
  };

  // Agregar inputs custom
  for (const [key, value] of inputMap) {
    if (!(key in context)) {
      context[key] = value;
    }
  }

  // Agregar componentes ya calculados
  for (const [code, value] of calculatedComponents) {
    context[code] = value;
  }

  return context;
}

// =============================================================================
// CÁLCULO DE UN COMPONENTE
// =============================================================================

/**
 * Calcula el valor de un componente salarial
 */
function calculateComponent(
  component: SalaryComponentData,
  context: FormulaContext,
  prorateFactor: number
): { baseAmount: number; calculatedAmount: number; finalAmount: number; formulaUsed?: string } {
  let baseAmount = 0;
  let calculatedAmount = 0;
  let formulaUsed: string | undefined;

  // Determinar la base según baseVariable
  switch (component.baseVariable) {
    case 'gross':
      baseAmount = context.gross;
      break;
    case 'base':
      baseAmount = context.base;
      break;
    case 'net':
      // Net se calcula al final, usar gross por ahora
      baseAmount = context.gross;
      break;
    default:
      baseAmount = context.base;
  }

  // Calcular según el tipo
  switch (component.calcType) {
    case CALC_TYPE.FIXED:
      calculatedAmount = component.calcValue || 0;
      break;

    case CALC_TYPE.PERCENTAGE:
      calculatedAmount = baseAmount * ((component.calcValue || 0) / 100);
      break;

    case CALC_TYPE.FORMULA:
      if (component.calcFormula) {
        formulaUsed = component.calcFormula;
        calculatedAmount = evaluateFormula(component.calcFormula, context);
      }
      break;

    case CALC_TYPE.DAYS_BASED:
      const daysWorked = context.days_worked as number;
      const daysInPeriod = context.days_in_period as number;
      calculatedAmount = (baseAmount / daysInPeriod) * daysWorked;
      break;

    default:
      calculatedAmount = 0;
  }

  // Aplicar prorrateo si corresponde
  if (component.prorateOnPartial && prorateFactor < 1) {
    calculatedAmount = calculatedAmount * prorateFactor;
  }

  // Aplicar redondeo
  let finalAmount = applyRounding(
    calculatedAmount,
    component.roundingMode,
    component.roundingDecimals
  );

  // Aplicar caps
  finalAmount = applyCaps(finalAmount, component.capMin, component.capMax);

  return { baseAmount, calculatedAmount, finalAmount, formulaUsed };
}

// =============================================================================
// CÁLCULO COMPLETO DE UN EMPLEADO
// =============================================================================

/**
 * Calcula la liquidación de un empleado
 */
export function calculateEmployeePayroll(
  employee: EmployeeData,
  components: SalaryComponentData[],
  period: PeriodData,
  inputs: PayrollInputData[],
  advancesToDiscount: AdvanceToDiscount[] = []
): PayrollItemData | null {
  // Verificar si el empleado estaba activo en el período
  if (
    !wasActiveInPeriod(
      employee.hireDate,
      employee.terminationDate,
      period.periodStart,
      period.periodEnd,
      employee.isActive
    )
  ) {
    return null;
  }

  // Calcular factor de prorrateo
  const prorateFactor = calculateProrateFactor(
    employee.hireDate,
    employee.terminationDate,
    period.periodStart,
    period.periodEnd
  );

  // Si el prorrateo es 0, no incluir
  if (prorateFactor === 0) {
    return null;
  }

  // Ordenar componentes por dependencias
  const sortedComponents = sortComponentsByDependency(
    components.filter((c) => c.isActive)
  );

  // Filtrar componentes aplicables a este empleado
  const applicableComponents = sortedComponents.filter((comp) => {
    if (comp.applyTo === 'ALL') return true;
    if (comp.applyTo.startsWith('EMPLOYEE:')) {
      return comp.applyTo === `EMPLOYEE:${employee.id}`;
    }
    // TODO: Filtrar por categoría si es necesario
    return true;
  });

  // Calcular cada componente
  const lines: PayrollItemLineData[] = [];
  const calculatedValues = new Map<string, number>();
  let totalEarnings = 0;
  let totalDeductions = 0;
  let employerCost = 0;

  // Primera pasada: calcular haberes para actualizar gross
  for (const comp of applicableComponents) {
    if (comp.type === COMPONENT_TYPE.EARNING && comp.code !== 'CARGAS_SOCIALES_EMPLEADOR') {
      const context = buildFormulaContext(employee, period, inputs, calculatedValues);
      const result = calculateComponent(comp, context, prorateFactor);

      calculatedValues.set(comp.code, result.finalAmount);
      totalEarnings += result.finalAmount;
    }
  }

  // Actualizar gross en contexto
  const gross = employee.grossSalary * prorateFactor + totalEarnings - employee.grossSalary * prorateFactor;
  // Gross real = sueldo base prorrateado + otros haberes
  const realGross = totalEarnings > 0 ? totalEarnings : employee.grossSalary * prorateFactor;

  // Segunda pasada: calcular todos los componentes con el gross actualizado
  calculatedValues.clear();
  totalEarnings = 0;
  totalDeductions = 0;

  for (const comp of applicableComponents) {
    const context = buildFormulaContext(employee, period, inputs, calculatedValues);
    // Actualizar gross en el contexto
    context.gross = realGross;

    const result = calculateComponent(comp, context, prorateFactor);
    calculatedValues.set(comp.code, result.finalAmount);

    // Crear línea
    const line: PayrollItemLineData = {
      componentId: comp.id,
      code: comp.code,
      name: comp.name,
      type: comp.type,
      baseAmount: result.baseAmount,
      calculatedAmount: result.calculatedAmount,
      finalAmount: result.finalAmount,
      formulaUsed: result.formulaUsed,
      meta: {
        calcType: comp.calcType,
        calcValue: comp.calcValue,
        prorateFactor,
      },
    };
    lines.push(line);

    // Sumar a totales
    if (comp.type === COMPONENT_TYPE.EARNING) {
      if (comp.code === 'CARGAS_SOCIALES_EMPLEADOR') {
        employerCost += result.finalAmount;
      } else {
        totalEarnings += result.finalAmount;
      }
    } else {
      totalDeductions += result.finalAmount;
    }
  }

  // Calcular adelantos a descontar
  const employeeAdvances = advancesToDiscount.filter((a) => a.employeeId === employee.id);
  const advancesDiscounted = employeeAdvances.reduce((sum, a) => sum + a.amount, 0);
  totalDeductions += advancesDiscounted;

  // Calcular neto
  const netSalary = totalEarnings - totalDeductions;

  // Calcular costo empleador total (bruto + cargas)
  const totalEmployerCost = totalEarnings + employerCost;

  // Construir el item
  const item: PayrollItemData = {
    employeeId: employee.id,
    employeeName: employee.name,
    costCenterId: employee.costCenterId,
    daysWorked: (inputs.find((i) => i.employeeId === employee.id && i.inputKey === 'days_worked')
      ?.inputValue ?? period.businessDays) as number,
    daysInPeriod: period.businessDays,
    prorateFactor,
    baseSalary: employee.grossSalary,
    totalEarnings,
    totalDeductions,
    advancesDiscounted,
    netSalary,
    employerCost: totalEmployerCost,
    lines,
  };

  return item;
}

// =============================================================================
// CÁLCULO DE NÓMINA COMPLETA
// =============================================================================

/**
 * Calcula la nómina completa para todos los empleados
 */
export function calculatePayroll(
  employees: EmployeeData[],
  components: SalaryComponentData[],
  period: PeriodData,
  inputs: PayrollInputData[],
  advancesToDiscount: AdvanceToDiscount[] = []
): CalculationResult {
  const items: PayrollItemData[] = [];

  for (const employee of employees) {
    const item = calculateEmployeePayroll(
      employee,
      components,
      period,
      inputs,
      advancesToDiscount
    );

    if (item) {
      items.push(item);
    }
  }

  // Calcular totales
  const totals = {
    totalGross: items.reduce((sum, i) => sum + i.totalEarnings, 0),
    totalDeductions: items.reduce((sum, i) => sum + i.totalDeductions, 0),
    totalNet: items.reduce((sum, i) => sum + i.netSalary, 0),
    totalEmployerCost: items.reduce((sum, i) => sum + i.employerCost, 0),
    employeeCount: items.length,
  };

  return { items, totals };
}

// =============================================================================
// ESTIMACIÓN DE PRÓXIMO PAGO
// =============================================================================

/**
 * Estima el monto del próximo pago (para proyección)
 */
export function estimateNextPayment(
  employees: EmployeeData[],
  components: SalaryComponentData[],
  period: PeriodData,
  pendingAdvances: { employeeId: string; amount: number }[] = []
): {
  estimated: {
    totalGross: number;
    totalDeductions: number;
    totalNet: number;
    totalEmployerCost: number;
    employeeCount: number;
    advancesTotal: number;
  };
} {
  // Usar el cálculo normal pero sin inputs específicos
  const result = calculatePayroll(employees, components, period, []);

  // Sumar adelantos pendientes
  const advancesTotal = pendingAdvances.reduce((sum, a) => sum + a.amount, 0);

  return {
    estimated: {
      ...result.totals,
      advancesTotal,
      totalDeductions: result.totals.totalDeductions + advancesTotal,
      totalNet: result.totals.totalNet - advancesTotal,
    },
  };
}
