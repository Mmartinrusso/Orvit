import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// DELETE /api/employees/delete - Eliminar empleado
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    console.log('=== INICIO DELETE EMPLOYEE ===');

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const companyId = String(user!.companyId);

    console.log('Parámetros recibidos:', { employeeId, companyId });

    if (!employeeId) {
      console.log('Faltan parámetros requeridos');
      return NextResponse.json(
        { error: 'employeeId es requerido' },
        { status: 400 }
      );
    }

    // Probar conexión a base de datos
    console.log('Probando conexión a base de datos...');
    
    try {
      const testQuery = await prisma.$queryRaw`SELECT 1 as test`;
      console.log('Conexión exitosa, resultado test:', testQuery);
    } catch (dbError) {
      console.error('Error de conexión a BD:', dbError);
      return NextResponse.json(
        { error: 'Error de conexión a la base de datos' },
        { status: 500 }
      );
    }

    // Buscar el empleado
    console.log('Buscando empleado...');
    
    let existingEmployee;
    try {
      existingEmployee = await prisma.$queryRaw`
        SELECT id, name, role, gross_salary, payroll_taxes, active
        FROM employees 
        WHERE id = ${employeeId}
      `;
      console.log('Consulta de búsqueda exitosa, resultado:', existingEmployee);
    } catch (searchError) {
      console.error('Error en búsqueda:', searchError);
      return NextResponse.json(
        { error: `Error buscando empleado: ${searchError}` },
        { status: 500 }
      );
    }

    if (!existingEmployee || (existingEmployee as any[]).length === 0) {
      console.log('Empleado no encontrado');
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // Eliminar el empleado
    console.log('Empleado encontrado, procediendo a eliminar...');

    try {
      await prisma.$queryRaw`
        DELETE FROM employees 
        WHERE id = ${employeeId}
      `;
      console.log('Empleado eliminado exitosamente');
    } catch (deleteError) {
      console.error('Error eliminando:', deleteError);
      return NextResponse.json(
        { error: `Error eliminando empleado: ${deleteError}` },
        { status: 500 }
      );
    }

    const employee = (existingEmployee as any[])[0];
    console.log('Empleado eliminado:', employee);

    return NextResponse.json({
      success: true,
      message: `Empleado ${employee.name} (${employee.role}) eliminado exitosamente`,
      deletedEmployee: {
        id: employee.id,
        name: employee.name,
        role: employee.role
      }
    });

  } catch (error) {
    console.error('Error general en DELETE:', error);
    return NextResponse.json(
      { error: `Error interno del servidor: ${error}` },
      { status: 500 }
    );
  } finally {
    console.log('=== FIN DELETE EMPLOYEE ===');
  }
}
