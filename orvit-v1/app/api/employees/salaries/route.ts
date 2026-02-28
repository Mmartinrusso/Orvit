import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

// GET /api/employees/salaries - Obtener sueldos mensuales
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    console.log('🔍 API Salaries GET - Iniciando...');
    const { searchParams } = new URL(request.url);
    const companyId = String(user!.companyId);
    const employeeId = searchParams.get('employeeId');
    const month = searchParams.get('month');

    console.log('📊 Parámetros:', { companyId, employeeId, month });

    // Construir filtros
    const whereClause: any = {
      company_id: parseInt(companyId),
    };

    if (employeeId) {
      whereClause.employee_id = employeeId;
    }

    // Si se especifica un mes, filtrar por ese mes
    if (month) {
      const startDate = new Date(month + '-01T00:00:00.000Z');
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      
      whereClause.effective_from = {
        gte: startDate,
        lt: endDate
      };
    }

    console.log('🔍 Consultando sueldos con filtros:', whereClause);
    
    // Usar SQL directo para evitar problemas con modelos
    let query = `
      SELECT 
        esh.id,
        esh.employee_id as "employeeId",
        esh.effective_from as "effectiveFrom",
        esh.gross_salary as "grossSalary",
        esh.payroll_taxes as "payrollTaxes",
        esh.change_pct as "changePct",
        esh.reason,
        e.name as "employeeName",
        e.role as "employeeRole",
        ec.name as "categoryName"
      FROM employee_salary_history esh
      LEFT JOIN employees e ON esh.employee_id = e.id
      LEFT JOIN employee_categories ec ON e.category_id = ec.id
      WHERE esh.company_id = $1
    `;

    const params = [parseInt(companyId)];

    if (employeeId) {
      query += ` AND esh.employee_id = $${params.length + 1}`;
      params.push(employeeId);
    }

    if (month) {
      const startDate = new Date(month + '-01T00:00:00.000Z');
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      
      query += ` AND esh.effective_from >= $${params.length + 1} AND esh.effective_from < $${params.length + 2}`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY esh.effective_from DESC`;

    const salaries = await prisma.$queryRawUnsafe(query, ...params);

    console.log('📊 Sueldos encontrados:', salaries.length);

    // Si se especifica un mes, obtener solo el último registro de cada empleado para ese mes
    let processedSalaries;
    if (month) {
      // Agrupar por empleado y tomar el más reciente de cada uno
      const salariesByEmployee = new Map();
      salaries.forEach(salary => {
        const employeeId = salary.employeeId;
        if (!salariesByEmployee.has(employeeId) || 
            (salary.effectiveFrom && salariesByEmployee.get(employeeId).effectiveFrom && 
             salary.effectiveFrom > salariesByEmployee.get(employeeId).effectiveFrom)) {
          salariesByEmployee.set(employeeId, salary);
        }
      });
      
      processedSalaries = Array.from(salariesByEmployee.values()).map(salary => ({
        id: salary.id,
        employeeId: salary.employeeId,
        fecha_imputacion: salary.effectiveFrom ? salary.effectiveFrom.toISOString().slice(0, 7) : '',
        grossSalary: Number(salary.grossSalary),
        payrollTaxes: Number(salary.payrollTaxes || 0),
        totalCost: Number(salary.grossSalary) + Number(salary.payrollTaxes || 0),
        notes: salary.reason || '',
        companyId: salary.company_id,
        createdAt: salary.created_at?.toISOString(),
        updatedAt: salary.updated_at?.toISOString(),
        employeeName: salary.employeeName || 'Empleado desconocido',
        employeeRole: salary.employeeRole || 'Sin rol',
        categoryName: salary.categoryName || 'Sin categoría'
      }));
    } else {
      // Sin filtro de mes, devolver todos los sueldos
      processedSalaries = salaries.map(salary => ({
        id: salary.id,
        employeeId: salary.employeeId,
        fecha_imputacion: salary.effectiveFrom ? salary.effectiveFrom.toISOString().slice(0, 7) : '',
        grossSalary: Number(salary.grossSalary),
        payrollTaxes: Number(salary.payrollTaxes || 0),
        totalCost: Number(salary.grossSalary) + Number(salary.payrollTaxes || 0),
        notes: salary.reason || '',
        companyId: salary.company_id,
        createdAt: salary.created_at?.toISOString(),
        updatedAt: salary.updated_at?.toISOString(),
        employeeName: salary.employeeName || 'Empleado desconocido',
        employeeRole: salary.employeeRole || 'Sin rol',
        categoryName: salary.categoryName || 'Sin categoría'
      }));
    }

    // ✅ OPTIMIZADO: Removido console.log innecesario
    return NextResponse.json(processedSalaries);

  } catch (error) {
    console.error('Error obteniendo sueldos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect() - no es necesario con conexión pooling
}

// POST /api/employees/salaries - Registrar nuevo sueldo
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const { employeeId, fecha_imputacion, grossSalary, payrollTaxes, notes } = body;
    const companyId = String(user!.companyId);

    if (!employeeId || !fecha_imputacion || !grossSalary) {
      return NextResponse.json(
        { error: 'employeeId, fecha_imputacion y grossSalary son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el empleado existe
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        company_id: parseInt(companyId),
        active: true
      },
      include: {
        employee_categories: true
      }
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado o inactivo' },
        { status: 404 }
      );
    }

    // Crear fecha sin problemas de zona horaria
    const [year, month] = fecha_imputacion.split('-');
    const effectiveDate = new Date(parseInt(year), parseInt(month) - 1, 1, 12, 0, 0);
    
    // Crear registro de sueldo
    const newSalary = await prisma.employeeSalaryHistory.create({
      data: {
        employee_id: employeeId,
        company_id: parseInt(companyId),
        effective_from: effectiveDate,
        gross_salary: parseFloat(grossSalary),
        payroll_taxes: parseFloat(payrollTaxes || 0),
        created_at: new Date()
      }
    });

    // Obtener el sueldo creado con información del empleado
    const salaryWithDetails = await prisma.$queryRaw`
      SELECT 
        esh.id,
        esh.employee_id as "employeeId",
        esh.effective_from as "fecha_imputacion",
        esh.gross_salary as "grossSalary",
        esh.payroll_taxes as "payrollTaxes",
        (esh.gross_salary + COALESCE(esh.payroll_taxes, 0)) as "totalCost",
        esh.created_at as "createdAt",
        esh.updated_at as "updatedAt",
        e.name as "employeeName",
        e.role as "employeeRole",
        ec.name as "categoryName",
        esh.company_id as "companyId"
      FROM employee_salary_history esh
      LEFT JOIN employees e ON esh.employee_id = e.id
      LEFT JOIN employee_categories ec ON e.category_id = ec.id
      WHERE esh.id = ${newSalary.id}
    `;

    const processedSalary = (salaryWithDetails as any[])[0];
    const result = {
      ...processedSalary,
      id: Number(processedSalary.id),
      grossSalary: Number(processedSalary.grossSalary),
      payrollTaxes: Number(processedSalary.payrollTaxes || 0),
      totalCost: Number(processedSalary.totalCost),
      companyId: Number(processedSalary.companyId),
      fecha_imputacion: processedSalary.fecha_imputacion ? processedSalary.fecha_imputacion.toISOString().slice(0, 7) : '',
      createdAt: processedSalary.createdAt?.toISOString(),
      updatedAt: processedSalary.updatedAt?.toISOString()
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error registrando sueldo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect() - no es necesario con connection pooling
}