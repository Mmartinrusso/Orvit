import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getPayrollCostsForMonth } from '@/lib/costs/integrations/payroll';
import { getPurchaseCostsForMonth } from '@/lib/costs/integrations/purchases';
import { getIndirectCostsForMonth } from '@/lib/costs/integrations/indirect';
import { getProductionCostsForMonth } from '@/lib/costs/integrations/production';
import { getSalesForMonth } from '@/lib/costs/integrations/sales';

export const dynamic = 'force-dynamic';

/** Genera una lista de N meses hacia atrás (incluyendo el actual), en formato YYYY-MM, ASC. */
function generateMonths(count: number): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    );
  }
  return months;
}

/**
 * GET /api/costos/v2/history?feature=purchases|indirect|production|sales|payroll&months=12
 *
 * Retorna datos históricos agregados por mes para el feature indicado.
 * Usado por los tabs de Costos V2 para mostrar evolución y sparklines.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const feature = request.nextUrl.searchParams.get('feature');
    const monthsParam = request.nextUrl.searchParams.get('months');
    const monthsCount = Math.min(24, Math.max(1, parseInt(monthsParam ?? '12', 10) || 12));

    const validFeatures = ['purchases', 'indirect', 'production', 'sales', 'payroll'];
    if (!feature || !validFeatures.includes(feature)) {
      return NextResponse.json(
        { error: `feature debe ser uno de: ${validFeatures.join(', ')}` },
        { status: 400 }
      );
    }

    const months = generateMonths(monthsCount);

    let monthData: any[];

    switch (feature) {
      case 'purchases':
        monthData = await Promise.all(
          months.map(async (month) => {
            try {
              const d = await getPurchaseCostsForMonth(companyId, month);
              return {
                month,
                total: d.totalPurchases,
                receiptCount: d.receiptCount,
                supplierCount: d.bySupplier.length,
                avgTicket: d.receiptCount > 0 ? d.totalPurchases / d.receiptCount : 0,
              };
            } catch {
              return { month, total: 0, receiptCount: 0, supplierCount: 0, avgTicket: 0 };
            }
          })
        );
        break;

      case 'indirect':
        monthData = await Promise.all(
          months.map(async (month) => {
            try {
              const d = await getIndirectCostsForMonth(companyId, month);
              return {
                month,
                total: d.total,
                itemCount: d.itemCount,
                categoryCount: Object.keys(d.byCategory).length,
                avgPerItem: d.itemCount > 0 ? d.total / d.itemCount : 0,
              };
            } catch {
              return { month, total: 0, itemCount: 0, categoryCount: 0, avgPerItem: 0 };
            }
          })
        );
        break;

      case 'production':
        monthData = await Promise.all(
          months.map(async (month) => {
            try {
              const d = await getProductionCostsForMonth(companyId, month);
              return {
                month,
                totalCost: d.totalProductionCost,
                unitsProduced: d.unitsProduced,
                productCount: d.productCount,
                costPerUnit: d.unitsProduced > 0 ? d.totalProductionCost / d.unitsProduced : 0,
              };
            } catch {
              return { month, totalCost: 0, unitsProduced: 0, productCount: 0, costPerUnit: 0 };
            }
          })
        );
        break;

      case 'sales':
        monthData = await Promise.all(
          months.map(async (month) => {
            try {
              const d = await getSalesForMonth(companyId, month);
              return {
                month,
                revenue: d.totalRevenue,
                cost: d.totalCost,
                grossMargin: d.grossMargin,
                marginPercent: d.marginPercent,
                invoiceCount: d.invoiceCount,
                avgTicket: d.invoiceCount > 0 ? d.totalRevenue / d.invoiceCount : 0,
              };
            } catch {
              return {
                month,
                revenue: 0, cost: 0, grossMargin: 0, marginPercent: 0,
                invoiceCount: 0, avgTicket: 0,
              };
            }
          })
        );
        break;

      case 'payroll':
        monthData = await Promise.all(
          months.map(async (month) => {
            try {
              const d = await getPayrollCostsForMonth(companyId, month);
              const cargasSociales = Math.max(0, d.employerCost - d.totalGross);
              return {
                month,
                employerCost: d.employerCost,
                totalGross: d.totalGross,
                cargasSociales,
                employeeCount: d.employeeCount,
                payrollCount: d.payrollCount,
                costPerEmployee: d.employeeCount > 0 ? d.employerCost / d.employeeCount : 0,
              };
            } catch {
              return {
                month,
                employerCost: 0, totalGross: 0, cargasSociales: 0,
                employeeCount: 0, payrollCount: 0, costPerEmployee: 0,
              };
            }
          })
        );
        break;

      default:
        monthData = [];
    }

    return NextResponse.json({
      success: true,
      feature,
      months: monthData,
    });
  } catch (error) {
    console.error('Error obteniendo historial de costos V2:', error);
    return NextResponse.json(
      { error: 'Error al obtener historial' },
      { status: 500 }
    );
  }
}
