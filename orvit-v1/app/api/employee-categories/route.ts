import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

// GET /api/employee-categories - Obtener categorías de empleados
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API Employee Categories GET - Iniciando...');
    
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    
    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Obtener todas las categorías de empleados para la empresa
    const categories = await prisma.$queryRaw`
      SELECT 
        id,
        name,
        description,
        is_active,
        created_at,
        updated_at
      FROM employee_categories
      WHERE company_id = ${parseInt(companyId)} AND is_active = true
      ORDER BY name
    `;

    console.log('📊 Categorías de empleados obtenidas:', categories);
    return NextResponse.json(categories);

  } catch (error) {
    console.error('❌ Error obteniendo categorías de empleados:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
