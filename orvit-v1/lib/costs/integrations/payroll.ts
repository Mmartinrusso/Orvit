/**
 * Centro de Costos V2 - Integración con Nóminas
 *
 * Lee datos de PayrollRun (nóminas cerradas) para alimentar
 * el sistema de costos automáticamente.
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export interface PayrollCostData {
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  employerCost: number;  // COSTO REAL para la empresa
  employeeCount: number;
  payrollCount: number;
  details: PayrollDetail[];
}

export interface PayrollDetail {
  runId: number;
  periodType: string;
  runNumber: number;
  runType: string;
  employeeCount: number;
  gross: number;
  deductions: number;
  net: number;
  employerCost: number;
  approvedAt: Date | null;
  paidAt: Date | null;
}

/**
 * Obtiene los costos de nómina para un mes específico.
 * Solo considera nóminas con status APPROVED o PAID.
 *
 * @param companyId - ID de la empresa
 * @param month - Mes en formato "YYYY-MM" (ej: "2026-01")
 */
export async function getPayrollCostsForMonth(
  companyId: number,
  month: string
): Promise<PayrollCostData> {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);

  // Buscar nóminas cerradas (APPROVED o PAID) del mes
  const payrollRuns = await prisma.payrollRun.findMany({
    where: {
      company_id: companyId,
      period: {
        year,
        month: monthNum
      },
      status: { in: ['APPROVED', 'PAID'] }
    },
    include: {
      period: {
        select: {
          period_type: true,
          year: true,
          month: true,
          period_start: true,
          period_end: true
        }
      }
    },
    orderBy: [
      { period_id: 'asc' },
      { run_number: 'asc' }
    ]
  });

  // Si no hay nóminas, retornar valores en cero
  if (payrollRuns.length === 0) {
    return {
      totalGross: 0,
      totalDeductions: 0,
      totalNet: 0,
      employerCost: 0,
      employeeCount: 0,
      payrollCount: 0,
      details: []
    };
  }

  // Calcular totales
  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;
  let employerCost = 0;
  let totalEmployees = 0;

  const details: PayrollDetail[] = [];

  for (const run of payrollRuns) {
    const gross = toNumber(run.total_gross);
    const deductions = toNumber(run.total_deductions);
    const net = toNumber(run.total_net);
    const employer = toNumber(run.total_employer_cost);

    totalGross += gross;
    totalDeductions += deductions;
    totalNet += net;
    employerCost += employer;
    totalEmployees += run.employee_count;

    details.push({
      runId: run.id,
      periodType: run.period.period_type,
      runNumber: run.run_number,
      runType: run.run_type,
      employeeCount: run.employee_count,
      gross,
      deductions,
      net,
      employerCost: employer,
      approvedAt: run.approved_at,
      paidAt: run.paid_at
    });
  }

  return {
    totalGross,
    totalDeductions,
    totalNet,
    employerCost,
    employeeCount: totalEmployees,
    payrollCount: payrollRuns.length,
    details
  };
}

/**
 * Obtiene un resumen de nóminas por período tipo (quincenas vs mensual)
 */
export async function getPayrollSummaryByType(
  companyId: number,
  month: string
): Promise<Record<string, PayrollCostData>> {
  const data = await getPayrollCostsForMonth(companyId, month);

  const byType: Record<string, PayrollCostData> = {};

  for (const detail of data.details) {
    const type = detail.periodType;

    if (!byType[type]) {
      byType[type] = {
        totalGross: 0,
        totalDeductions: 0,
        totalNet: 0,
        employerCost: 0,
        employeeCount: 0,
        payrollCount: 0,
        details: []
      };
    }

    byType[type].totalGross += detail.gross;
    byType[type].totalDeductions += detail.deductions;
    byType[type].totalNet += detail.net;
    byType[type].employerCost += detail.employerCost;
    byType[type].employeeCount += detail.employeeCount;
    byType[type].payrollCount += 1;
    byType[type].details.push(detail);
  }

  return byType;
}

/**
 * Helper para convertir Decimal de Prisma a number
 */
function toNumber(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value);
}
