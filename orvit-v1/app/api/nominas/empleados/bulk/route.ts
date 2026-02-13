import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

// PUT - Actualizar multiples empleados de una vez
export async function PUT(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { employees } = body;

    if (!Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere un array de empleados' },
        { status: 400 }
      );
    }

    if (employees.length > 100) {
      return NextResponse.json(
        { error: 'Maximo 100 empleados por lote' },
        { status: 400 }
      );
    }

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const emp of employees) {
      try {
        if (!emp.id) {
          results.push({ id: '', success: false, error: 'ID requerido' });
          continue;
        }

        // Verificar que el empleado pertenece a la empresa
        const existing = await prisma.$queryRaw<any[]>`
          SELECT id FROM employees
          WHERE id = ${emp.id} AND company_id = ${auth.companyId}
        `;

        if (existing.length === 0) {
          results.push({ id: emp.id, success: false, error: 'Empleado no encontrado' });
          continue;
        }

        // Verificar CUIL unico si se proporciona
        if (emp.cuil) {
          const existingCuil = await prisma.$queryRaw<any[]>`
            SELECT id FROM employees
            WHERE company_id = ${auth.companyId} AND cuil = ${emp.cuil} AND id != ${emp.id}
          `;
          if (existingCuil.length > 0) {
            results.push({ id: emp.id, success: false, error: 'CUIL duplicado' });
            continue;
          }
        }

        await prisma.$queryRaw`
          UPDATE employees
          SET
            name = COALESCE(${emp.name?.trim() || null}, name),
            role = COALESCE(${emp.role ?? null}, role),
            cuil = ${emp.cuil || null},
            hire_date = ${emp.hireDate ? new Date(emp.hireDate) : null},
            union_category_id = ${emp.unionCategoryId ? parseInt(emp.unionCategoryId) : null},
            work_sector_id = ${emp.workSectorId ? parseInt(emp.workSectorId) : null},
            updated_at = NOW()
          WHERE id = ${emp.id} AND company_id = ${auth.companyId}
        `;

        results.push({ id: emp.id, success: true });
      } catch (err) {
        results.push({ id: emp.id, success: false, error: 'Error al actualizar' });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `${successCount} empleado${successCount !== 1 ? 's' : ''} actualizado${successCount !== 1 ? 's' : ''}${errorCount > 0 ? `, ${errorCount} error${errorCount !== 1 ? 'es' : ''}` : ''}`,
      results,
    });
  } catch (error) {
    console.error('Error en actualizacion masiva:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
