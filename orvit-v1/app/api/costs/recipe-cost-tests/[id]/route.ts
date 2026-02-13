import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserAndCompany } from '@/lib/costs-auth';

// DELETE /api/costs/recipe-cost-tests/[id] - Eliminar una prueba de costos
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('🗑️ DELETE /api/costs/recipe-cost-tests/[id] - Iniciando...');
  try {
    const auth = await getUserAndCompany();
    console.log('🔐 Auth obtenida:', { hasAuth: !!auth, companyId: auth?.companyId });
    if (!auth || !auth.companyId) {
      console.log('❌ No autorizado');
      return NextResponse.json({ error: 'No autorizado o sin empresa asociada' }, { status: 401 });
    }

    const testId = parseInt(params.id, 10);
    if (isNaN(testId)) {
      return NextResponse.json({ error: 'ID de prueba inválido' }, { status: 400 });
    }

    console.log('🔍 Buscando prueba con ID:', testId);

    // Verificar que la prueba existe y pertenece a la empresa
    const test = await prisma.recipe_cost_tests.findFirst({
      where: {
        id: testId,
        company_id: auth.companyId
      }
    });

    if (!test) {
      console.log('❌ Prueba no encontrada');
      return NextResponse.json({ error: 'Prueba no encontrada o no tienes permisos para eliminarla' }, { status: 404 });
    }

    // Eliminar la prueba
    try {
      await prisma.recipe_cost_tests.delete({
        where: {
          id: testId
        }
      });

      console.log('✅ Prueba eliminada exitosamente:', testId);
      return NextResponse.json({ 
        success: true, 
        message: 'Prueba eliminada exitosamente',
        id: testId
      });
    } catch (prismaError: any) {
      console.error('Error con Prisma delete, intentando SQL directo:', prismaError);
      
      // Fallback a SQL directo
      await prisma.$queryRawUnsafe(`
        DELETE FROM recipe_cost_tests 
        WHERE id = $1 AND company_id = $2
      `, testId, auth.companyId);

      console.log('✅ Prueba eliminada exitosamente (SQL directo):', testId);
      return NextResponse.json({ 
        success: true, 
        message: 'Prueba eliminada exitosamente',
        id: testId
      });
    }
  } catch (error: any) {
    console.error('❌ Error eliminando prueba de costos:', error);
    console.error('Stack:', error?.stack);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor', 
        details: error?.message || 'Error desconocido',
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}

