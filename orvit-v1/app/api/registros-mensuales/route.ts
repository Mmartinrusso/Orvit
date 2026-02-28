import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const month = searchParams.get('month'); // Formato: YYYY-MM

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID es requerido' }, { status: 400 });
    }

    // ✅ OPTIMIZADO: Ejecutar todas las queries en paralelo
    const companyIdNum = parseInt(companyId);
    
    // Preparar queries base
    const baseQueries = month ? {
      sueldosMensuales: prisma.$queryRaw`
        SELECT ems.id, ems.employee_id, ems.gross_salary, ems.payroll_taxes, ems.total_cost,
               ems.fecha_imputacion, ems.notes, e.name as employee_name, e.role as employee_role, ec.name as category_name
        FROM employee_monthly_salaries ems
        LEFT JOIN employees e ON ems.employee_id = e.id
        LEFT JOIN employee_categories ec ON e.category_id = ec.id
        WHERE ems.company_id = ${companyIdNum} AND ems.fecha_imputacion = ${month}
        ORDER BY ems.fecha_imputacion DESC, e.name ASC
      `,
      sueldosHistorial: prisma.employeeSalaryHistory.findMany({
        where: {
          company_id: companyIdNum,
          effective_from: {
            gte: new Date(month + '-01T00:00:00.000Z'),
            lt: new Date(new Date(month + '-01T00:00:00.000Z').setMonth(new Date(month + '-01T00:00:00.000Z').getMonth() + 1))
          }
        },
        orderBy: { effective_from: 'desc' }
      }),
      registrosMensuales: prisma.$queryRaw`
        SELECT icmr.id, icmr.amount, icmr.fecha_imputacion, icmr.status, icmr.notes, icmr.cost_base_id, icmr.created_at,
               icb.name as base_name, icc.name as category_name
        FROM indirect_cost_monthly_records icmr
        LEFT JOIN indirect_cost_base icb ON icmr.cost_base_id = icb.id
        LEFT JOIN indirect_cost_categories icc ON icb.category_id = icc.id
        WHERE icb.company_id = ${companyIdNum} AND icmr.fecha_imputacion = ${month}
        ORDER BY icmr.cost_base_id, icmr.created_at DESC
      `,
      costosIndirectos: prisma.$queryRaw`
        SELECT ic.id, ic.name, ic.amount, ic.fecha_imputacion, ic.name as base_name, icc.name as category_name
        FROM indirect_costs ic
        LEFT JOIN indirect_cost_categories icc ON ic.category_id = icc.id
        WHERE ic.company_id = ${companyIdNum} AND ic.fecha_imputacion = ${month}
        ORDER BY ic.fecha_imputacion DESC, ic.name ASC
      `,
      preciosInsumos: prisma.$queryRaw`
        SELECT smp.id, smp.price_per_unit as amount, smp.fecha_imputacion, smp.notes, s.name as supply_name, s.unit_measure
        FROM supply_monthly_prices smp
        LEFT JOIN supplies s ON smp.supply_id = s.id
        WHERE smp.company_id = ${companyIdNum} AND smp.fecha_imputacion = ${month}
        ORDER BY smp.fecha_imputacion DESC, s.name ASC
      `,
      produccion: prisma.$queryRaw`
        SELECT mp.id, mp.product_id, mp.month as fecha_imputacion, mp.good_units as quantity, mp.scrap_units, mp.total_units,
               mp.observations, p.name as product_name, pc.name as category_name
        FROM monthly_production mp
        LEFT JOIN products p ON mp.product_id = p.id
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE mp.company_id = ${companyIdNum} AND mp.month = ${month}
        ORDER BY mp.month DESC, p.name ASC
      `,
      ventas: prisma.$queryRaw`
        SELECT ms.id, ms.product_id, ms.month as fecha_imputacion, ms.units_sold, ms.unit_price, ms.discount_percentage,
               ms.total_revenue as total_amount, ms.observations, p.name as product_name, pc.name as category_name
        FROM monthly_sales ms
        LEFT JOIN products p ON ms.product_id = p.id
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE ms.company_id = ${companyIdNum} AND ms.month = ${month}
        ORDER BY ms.month DESC, p.name ASC
      `
    } : {
      sueldosMensuales: prisma.$queryRaw`
        SELECT ems.id, ems.employee_id, ems.gross_salary, ems.payroll_taxes, ems.total_cost,
               ems.fecha_imputacion, ems.notes, e.name as employee_name, e.role as employee_role, ec.name as category_name
        FROM employee_monthly_salaries ems
        LEFT JOIN employees e ON ems.employee_id = e.id
        LEFT JOIN employee_categories ec ON e.category_id = ec.id
        WHERE ems.company_id = ${companyIdNum}
        ORDER BY ems.fecha_imputacion DESC, e.name ASC
      `,
      sueldosHistorial: prisma.employeeSalaryHistory.findMany({
        where: { company_id: companyIdNum },
        orderBy: { effective_from: 'desc' }
      }),
      registrosMensuales: prisma.$queryRaw`
        SELECT icmr.id, icmr.amount, icmr.fecha_imputacion, icmr.status, icmr.notes, icmr.cost_base_id, icmr.created_at,
               icb.name as base_name, icc.name as category_name
        FROM indirect_cost_monthly_records icmr
        LEFT JOIN indirect_cost_base icb ON icmr.cost_base_id = icb.id
        LEFT JOIN indirect_cost_categories icc ON icb.category_id = icc.id
        WHERE icb.company_id = ${companyIdNum}
        ORDER BY icmr.fecha_imputacion DESC, icmr.cost_base_id, icmr.created_at DESC
      `,
      costosIndirectos: prisma.$queryRaw`
        SELECT ic.id, ic.name, ic.amount, ic.fecha_imputacion, ic.name as base_name, icc.name as category_name
        FROM indirect_costs ic
        LEFT JOIN indirect_cost_categories icc ON ic.category_id = icc.id
        WHERE ic.company_id = ${companyIdNum}
        ORDER BY ic.fecha_imputacion DESC, ic.name ASC
      `,
      preciosInsumos: prisma.$queryRaw`
        SELECT smp.id, smp.price_per_unit as amount, smp.fecha_imputacion, smp.notes, s.name as supply_name, s.unit_measure
        FROM supply_monthly_prices smp
        LEFT JOIN supplies s ON smp.supply_id = s.id
        WHERE smp.company_id = ${companyIdNum}
        ORDER BY smp.fecha_imputacion DESC, s.name ASC
      `,
      produccion: prisma.$queryRaw`
        SELECT mp.id, mp.product_id, mp.month as fecha_imputacion, mp.good_units as quantity, mp.scrap_units, mp.total_units,
               mp.observations, p.name as product_name, pc.name as category_name
        FROM monthly_production mp
        LEFT JOIN products p ON mp.product_id = p.id
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE mp.company_id = ${companyIdNum}
        ORDER BY mp.month DESC, p.name ASC
      `,
      ventas: prisma.$queryRaw`
        SELECT ms.id, ms.product_id, ms.month as fecha_imputacion, ms.units_sold, ms.unit_price, ms.discount_percentage,
               ms.total_revenue as total_amount, ms.observations, p.name as product_name, pc.name as category_name
        FROM monthly_sales ms
        LEFT JOIN products p ON ms.product_id = p.id
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE ms.company_id = ${companyIdNum}
        ORDER BY ms.month DESC, p.name ASC
      `
    };

    // ✅ EJECUTAR TODAS LAS QUERIES EN PARALELO
    const [
      sueldosMensualesResult,
      sueldosHistorialResult,
      registrosMensualesResult,
      costosIndirectosResult,
      preciosInsumosResult,
      produccionResult,
      ventasResult
    ] = await Promise.all([
      baseQueries.sueldosMensuales.catch(() => []),
      baseQueries.sueldosHistorial.catch(() => []),
      baseQueries.registrosMensuales.catch(() => []),
      baseQueries.costosIndirectos.catch(() => []),
      baseQueries.preciosInsumos.catch(() => []),
      baseQueries.produccion.catch(() => []),
      baseQueries.ventas.catch(() => [])
    ]);

    // Procesar sueldos
    let sueldosEmpleados = [];
    const sueldosMensuales = sueldosMensualesResult as any[];
    const sueldosHistorial = sueldosHistorialResult as any[];
    
    if (sueldosHistorial.length > 0) {
      const employeeIds = Array.from(new Set(sueldosHistorial.map(esh => esh.employee_id)));
      const employees = employeeIds.length > 0 ? await prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        include: { employee_categories: true }
      }) : [];

      const employeesMap = new Map(employees.map(emp => [emp.id, emp]));

      // Obtener solo el último registro de cada empleado
      const sueldosUnicos = new Map();
      sueldosHistorial.forEach(esh => {
        const employeeId = esh.employee_id;
        if (!sueldosUnicos.has(employeeId)) {
          sueldosUnicos.set(employeeId, esh);
        }
      });

      // Transformar los datos al formato esperado
      const sueldosHistorialFormatted = Array.from(sueldosUnicos.values()).map(esh => {
        const grossSalary = Number(esh.gross_salary);
        const payrollTaxes = Number(esh.payroll_taxes || 0);
        const totalCost = grossSalary + payrollTaxes;
        const employee = employeesMap.get(esh.employee_id);
        
        return {
          id: esh.id,
          employee_id: esh.employee_id,
          gross_salary: grossSalary,
          payroll_taxes: payrollTaxes,
          total_cost: totalCost,
          fecha_imputacion: esh.effective_from.toISOString().slice(0, 7),
          notes: esh.reason,
          employee_name: employee?.name || 'Sin nombre',
          employee_role: employee?.role || 'Sin rol',
          category_name: employee?.employee_categories?.name || 'Sin categoría'
        };
      });

      // Combinar y deduplicar
      const todosLosSueldos = [...sueldosMensuales, ...sueldosHistorialFormatted];
      const sueldosFinales = new Map();
      todosLosSueldos.forEach(sueldo => {
        const employeeId = sueldo.employee_id;
        if (!sueldosFinales.has(employeeId)) {
          sueldosFinales.set(employeeId, sueldo);
        } else {
          const existente = sueldosFinales.get(employeeId);
          const fechaExistente = new Date(existente.fecha_imputacion + '-01');
          const fechaNueva = new Date(sueldo.fecha_imputacion + '-01');
          if (fechaNueva > fechaExistente) {
            sueldosFinales.set(employeeId, sueldo);
          }
        }
      });
      
      sueldosEmpleados = Array.from(sueldosFinales.values());
    } else {
      sueldosEmpleados = sueldosMensuales;
    }

    // Procesar registros mensuales (deduplicar)
    const todosRegistros = registrosMensualesResult as any[];
    const registrosUnicos = new Map();
    todosRegistros.forEach(registro => {
      const key = month ? registro.cost_base_id : `${registro.cost_base_id}-${registro.fecha_imputacion}`;
      if (!registrosUnicos.has(key)) {
        registrosUnicos.set(key, registro);
      }
    });
    const registrosMensuales = Array.from(registrosUnicos.values());

    // Asignar resultados directamente
    const costosIndirectos = costosIndirectosResult as any[];
    const preciosInsumos = preciosInsumosResult as any[];
    const produccion = produccionResult as any[];
    const ventas = ventasResult as any[];

    // Calcular totales
    const totales = {
      sueldosEmpleados: sueldosEmpleados.length,
      costosIndirectos: costosIndirectos.length,
      registrosMensuales: registrosMensuales.length,
      preciosInsumos: preciosInsumos.length,
      ventas: ventas.length,
      produccion: produccion.length
    };

    return NextResponse.json({
      success: true,
      data: {
        sueldosEmpleados,
        costosIndirectos,
        registrosMensuales,
        preciosInsumos,
        ventas,
        produccion,
        totales
      }
    });

  } catch (error) {
    console.error('Error obteniendo registros mensuales:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
