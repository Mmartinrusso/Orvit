import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET /api/employees/categories - Obtener categorías de empleados
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const companyId = String(user!.companyId);

    // Obtener categorías de empleados activas
    const categories = await prisma.$queryRaw`
      SELECT id, name, description, is_active, company_id
      FROM employee_categories 
      WHERE company_id = ${parseInt(companyId)} AND is_active = true
      ORDER BY name
    `;

    return NextResponse.json({
      success: true,
      categories
    });

  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
