import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET /api/indirect-costs - Obtener costos indirectos desde la tabla indirect_costs
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    console.log('🔍 API Indirect Costs GET - Iniciando...');
    
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    
    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Obtener costos indirectos desde indirect_costs
    const indirectCosts = await prisma.$queryRawUnsafe(`
      SELECT 
        ic.id,
        ic.name,
        ic.description,
        ic.category_id,
        icc.name as category_name,
        ic.company_id,
        ic.created_at,
        ic.updated_at
      FROM indirect_costs ic
      LEFT JOIN indirect_cost_categories icc ON ic.category_id = icc.id
      WHERE ic.company_id = $1
      ORDER BY icc.name, ic.name
    `, parseInt(companyId));

    console.log('📊 Costos indirectos obtenidos:', indirectCosts);
    
    // Transformar para que coincida con el formato esperado por el frontend
    const transformedCosts = (indirectCosts as any[]).map(cost => ({
      id: cost.id,
      costType: cost.category_name || 'Sin categoría',
      costName: cost.name,
      code: `IC-${cost.id}`,
      description: cost.description
    }));

    return NextResponse.json({ indirectItems: transformedCosts });

  } catch (error) {
    console.error('❌ Error obteniendo costos indirectos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
