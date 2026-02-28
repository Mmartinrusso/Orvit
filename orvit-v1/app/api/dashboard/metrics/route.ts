import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startPerf, endParse, startDb, endDb, startCompute, endCompute, startJson, endJson, withPerfHeaders } from '@/lib/perf';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const perfCtx = startPerf();
  const { searchParams } = new URL(request.url);

  try {
    const companyId = searchParams.get('companyId');
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    const startDate = new Date(`${month}-01`);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid month format' }, { status: 400 });
    }

    endParse(perfCtx);
    startDb(perfCtx);

    const prevMonth = new Date(`${month}-01`);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevMonthStr = prevMonth.toISOString().slice(0, 7);

    // ✅ OPTIMIZACIÓN: Ejecutar queries en paralelo
    const [salesData, prevSalesData, currentTotals, prevTotals, purchasesCurrent, purchasesPrev] = await Promise.all([
      prisma.monthly_sales.findMany({
        where: { company_id: parseInt(companyId), fecha_imputacion: month }
      }),
      prisma.monthly_sales.findMany({
        where: { company_id: parseInt(companyId), fecha_imputacion: prevMonthStr }
      }),
      loadCostCalculatorTotals(companyId, month),
      loadCostCalculatorTotals(companyId, prevMonthStr),
      loadPurchasesTotal(companyId, month),
      loadPurchasesTotal(companyId, prevMonthStr)
    ]);

    const totalMaterialsCost = currentTotals.materials;
    const totalIndirectCosts = currentTotals.indirects;
    const totalEmployeeCosts = currentTotals.employees;
    let totalCosts = currentTotals.total + purchasesCurrent;
    let prevTotalCosts = prevTotals.total + purchasesPrev;

    endDb(perfCtx);
    startCompute(perfCtx);

    const totalSales = salesData.reduce((sum, sale) => sum + Number(sale.total_revenue), 0);
    const totalUnitsSold = salesData.reduce((sum, sale) => sum + Number(sale.quantity_sold), 0);
    const prevTotalSales = prevSalesData.reduce((sum, sale) => sum + Number(sale.total_revenue), 0);
    
    const netMargin = totalSales - totalCosts;
    const marginPercentage = totalSales > 0 ? (netMargin / totalSales) * 100 : 0;
    const yoyGrowth = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : 0;

    const today = new Date();
    const daysWorked = Math.min(today.getDate(), new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate());
    const daysTotal = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const runRate = daysWorked > 0 ? totalSales / daysWorked : 0;
    const forecastEom = runRate * daysTotal;

    // Contribuciones por producto (simplificado)
    const productContributions: Record<string, { name: string; value: number; units: number }> = {};
    salesData.forEach(sale => {
      const productName = sale.product_name;
      if (!productContributions[productName]) {
        productContributions[productName] = { name: productName, value: 0, units: 0 };
      }
      productContributions[productName].value += Number(sale.total_revenue);
      productContributions[productName].units += Number(sale.quantity_sold);
    });

    const contributions = Object.values(productContributions)
      .map((c) => ({
        name: c.name,
        value: c.value,
        units: c.units,
        delta: 0,
        deltaPct: 0,
        contributionPct: totalSales > 0 ? (c.value / totalSales) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    endCompute(perfCtx);
    startJson(perfCtx);

    const responseData = {
      monthSummary: { month, daysWorked, daysTotal, mtd: totalSales, budget: totalSales * 1.2, runRate, forecastEom, yoyPct: yoyGrowth },
      dailyData: [],
      contributions,
      metrics: {
        totalSales, totalCosts, totalUnitsSold, netMargin, marginPercentage, yoyGrowth,
        costBreakdown: { materials: totalMaterialsCost, indirects: totalIndirectCosts, employees: totalEmployeeCosts, purchases: purchasesCurrent }
      },
      currentMetrics: {
        ventas: totalSales, costos: totalCosts, sueldos: totalEmployeeCosts, indirectos: totalIndirectCosts,
        compras: purchasesCurrent, materiales: totalMaterialsCost,
        margenBruto: totalSales - (totalIndirectCosts + totalEmployeeCosts + totalMaterialsCost + purchasesCurrent),
        margenNeto: netMargin,
        margenBrutoPct: totalSales > 0 ? ((totalSales - (totalIndirectCosts + totalEmployeeCosts + totalMaterialsCost + purchasesCurrent)) / totalSales) * 100 : 0,
        margenNetoPct: marginPercentage
      },
      changes: {
        ventas: { amount: totalSales - prevTotalSales, percentage: prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : 0 },
        costos: { amount: totalCosts - prevTotalCosts, percentage: prevTotalCosts > 0 ? ((totalCosts - prevTotalCosts) / prevTotalCosts) * 100 : 0 },
        sueldos: { amount: totalEmployeeCosts - prevTotals.employees, percentage: prevTotals.employees > 0 ? ((totalEmployeeCosts - prevTotals.employees) / prevTotals.employees) * 100 : 0 }
      },
      period: { current: month, previous: prevMonthStr }
    };

    const response = NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'private, max-age=300, s-maxage=300', // ✨ OPTIMIZADO: Cache de 5 minutos
      }
    });

    const metrics = endJson(perfCtx, responseData);
    return withPerfHeaders(response, metrics, searchParams);

  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard metrics' }, { status: 500 });
  }
}


/**
 * ✅ OPTIMIZADO: Calcular costos directamente con queries SQL
 * ANTES: Hacía fetch interno a /api/calculadora-costos-final (6-12 segundos)
 * DESPUÉS: Queries directas a la BD (~100-300ms)
 */
async function loadCostCalculatorTotals(companyId: string, targetMonth: string) {
  try {
    const companyIdNum = parseInt(companyId, 10);
    
    const [materialsResult, indirectsResult, employeesResult] = await Promise.all([
      prisma.$queryRaw`
        SELECT COALESCE(SUM(
          CASE WHEN mp.quantity_produced > 0 THEN mp.quantity_produced * COALESCE(p.unit_cost, 0)
          ELSE 0 END
        ), 0) as total
        FROM monthly_production mp
        LEFT JOIN products p ON mp.product_id = p.id::text
        WHERE mp.company_id = ${companyIdNum} AND mp.fecha_imputacion = ${targetMonth}
      ` as Promise<any[]>,
      
      prisma.$queryRaw`
        SELECT COALESCE(SUM(icmr.amount), 0) as total
        FROM indirect_cost_monthly_records icmr
        WHERE icmr.company_id = ${companyIdNum} AND icmr.fecha_imputacion = ${targetMonth}
      ` as Promise<any[]>,
      
      prisma.$queryRaw`
        SELECT COALESCE(SUM(ems.total_cost), 0) as total
        FROM employee_monthly_salaries ems
        WHERE ems.company_id = ${companyIdNum} AND ems.fecha_imputacion = ${targetMonth}
      ` as Promise<any[]>
    ]);
    
    const materials = Number(materialsResult[0]?.total) || 0;
    const indirects = Number(indirectsResult[0]?.total) || 0;
    let employees = Number(employeesResult[0]?.total) || 0;
    
    if (employees === 0) {
      // Query optimizada: usa DISTINCT ON en lugar de subquery correlacionada N+1
      const employeeFallback = await prisma.$queryRaw`
        SELECT COALESCE(SUM(latest.gross_salary + latest.payroll_taxes), 0) as total
        FROM employees e
        INNER JOIN (
          SELECT DISTINCT ON (employee_id) employee_id, gross_salary, payroll_taxes
          FROM employee_salary_history
          ORDER BY employee_id, effective_from DESC
        ) latest ON e.id = latest.employee_id
        WHERE e.company_id = ${companyIdNum} AND e.active = true
      ` as any[];
      employees = Number(employeeFallback[0]?.total) || 0;
    }
    
    return { materials, indirects, employees, total: materials + indirects + employees };
  } catch (error) {
    console.error(`❌ Error calculando costos para ${targetMonth}:`, error);
    return { materials: 0, indirects: 0, employees: 0, total: 0 };
  }
}

async function loadPurchasesTotal(companyId: string, targetMonth: string) {
  const companyIdNum = parseInt(companyId, 10);

  try {
    const pnlRecord = await prisma.factPnLMonthly.findUnique({
      where: { companyId_month: { companyId: companyIdNum, month: targetMonth } }
    });
    if (pnlRecord?.purchasesTotal !== null && pnlRecord?.purchasesTotal !== undefined) {
      return Number(pnlRecord.purchasesTotal);
    }
  } catch (error) { /* ignore */ }

  try {
    const purchasesRecord = await prisma.factPurchasesMonthly.findUnique({
      where: { companyId_month: { companyId: companyIdNum, month: targetMonth } }
    });
    if (purchasesRecord) return parseFloat(purchasesRecord.amount.toString());
  } catch (error) { /* ignore */ }

  return 0;
}
