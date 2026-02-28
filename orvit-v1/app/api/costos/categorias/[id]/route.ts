import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

// PUT - Actualizar categoría
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const { name, description } = body;
    const companyId = String(user!.companyId);
    const categoryId = parseInt(params.id);

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'El nombre de la categoría es obligatorio' },
        { status: 400 }
      );
    }

    // Verificar que la categoría existe y pertenece a la empresa
    const existingCategory = await prisma.$queryRaw`
      SELECT id FROM employee_categories 
      WHERE id = ${categoryId} AND company_id = ${parseInt(companyId)}
    `;

    if (!existingCategory || (Array.isArray(existingCategory) && existingCategory.length === 0)) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 }
      );
    }

    // Actualizar la categoría
    const result = await prisma.$queryRaw`
      UPDATE employee_categories 
      SET name = ${name}, description = ${description || null}, updated_at = NOW()
      WHERE id = ${categoryId} AND company_id = ${parseInt(companyId)}
      RETURNING id, name, description, is_active as "isActive", company_id as "companyId",
                created_at as "createdAt", updated_at as "updatedAt"
    `;

    const updatedCategory = Array.isArray(result) ? result[0] : result;
    
    return NextResponse.json(updatedCategory);
  } catch (error) {
    console.error('Error actualizando categoría:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar categoría (marcar como inactiva)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const companyId = String(user!.companyId);
    const categoryId = parseInt(params.id);

    // Verificar que la categoría existe y pertenece a la empresa
    const existingCategory = await prisma.$queryRaw`
      SELECT id FROM employee_categories 
      WHERE id = ${categoryId} AND company_id = ${parseInt(companyId)}
    `;

    if (!existingCategory || (Array.isArray(existingCategory) && existingCategory.length === 0)) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 }
      );
    }

    // Verificar si hay empleados en esta categoría
    const employeesInCategory = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM employees 
      WHERE category_id = ${categoryId} AND company_id = ${parseInt(companyId)} AND active = true
    `;

    const employeeCount = Array.isArray(employeesInCategory) 
      ? (employeesInCategory[0] as any)?.count || 0 
      : (employeesInCategory as any)?.count || 0;

    console.log(`Categoría ${categoryId}: ${employeeCount} empleados activos encontrados`);

    if (employeeCount > 0) {
      // Obtener más detalles sobre los empleados
      const employeeDetails = await prisma.$queryRaw`
        SELECT id, name, role FROM employees 
        WHERE category_id = ${categoryId} AND company_id = ${parseInt(companyId)} AND active = true
        LIMIT 5
      `;
      
      console.log('Empleados en la categoría:', employeeDetails);
      
      return NextResponse.json(
        { 
          error: `No se puede eliminar una categoría que tiene ${employeeCount} empleado(s) asignado(s)`,
          employeeCount,
          employees: employeeDetails
        },
        { status: 400 }
      );
    }

    // Eliminar la categoría (marcar como inactiva en lugar de eliminar físicamente)
    await prisma.$executeRaw`
      UPDATE employee_categories 
      SET is_active = false, updated_at = NOW()
      WHERE id = ${categoryId} AND company_id = ${parseInt(companyId)}
    `;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando categoría:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
