import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET /api/cost-distribution - Obtener configuraciones de distribución de costos
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    
    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Obtener todas las configuraciones de distribución de costos para la empresa
    const distributions = await prisma.$queryRawUnsafe(`
      SELECT 
        cdc.id,
        cdc.cost_type,
        cdc.cost_name,
        cdc.product_category_id,
        COALESCE(pc.name, 'Sin categoría') as "productCategoryName",
        cdc.percentage,
        cdc.is_active,
        cdc.created_at as "createdAt",
        cdc.updated_at as "updatedAt"
      FROM cost_distribution_config cdc
      LEFT JOIN product_categories pc ON cdc.product_category_id = pc.id
      WHERE cdc.company_id = $1
      ORDER BY cdc.cost_type, cdc.cost_name
    `, parseInt(companyId));

    return NextResponse.json(distributions);

  } catch (error) {
    console.error('❌ Error obteniendo configuraciones:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/cost-distribution - Crear nueva configuración de distribución
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const { 
      companyId, 
      costType, 
      costName, 
      productCategoryId, 
      percentage 
    } = body;

    // Validaciones
    if (!companyId || !costType || !costName || !productCategoryId || percentage === undefined) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      );
    }

    if (percentage < 0 || percentage > 100) {
      return NextResponse.json(
        { error: 'El porcentaje debe estar entre 0 y 100' },
        { status: 400 }
      );
    }

    // Verificar que no exista una configuración duplicada
    const existingConfig = await prisma.$queryRawUnsafe(`
      SELECT id FROM cost_distribution_config 
      WHERE company_id = $1 
      AND cost_type = $2 
      AND product_category_id = $3
    `, parseInt(companyId), costType, parseInt(productCategoryId));

    if (existingConfig && (existingConfig as any[]).length > 0) {
      return NextResponse.json(
        { error: 'Ya existe una configuración para este tipo de costo y categoría' },
        { status: 409 }
      );
    }

    // Crear la configuración
    const newConfig = await prisma.$queryRawUnsafe(`
      INSERT INTO cost_distribution_config (
        company_id, cost_type, cost_name, product_category_id, percentage
      ) VALUES (
        $1, $2, $3, $4, $5
      ) RETURNING id
    `, parseInt(companyId), costType, costName, parseInt(productCategoryId), parseFloat(percentage));

    return NextResponse.json({
      success: true,
      message: 'Configuración creada exitosamente',
      id: (newConfig as any[])[0].id
    });

  } catch (error) {
    console.error('❌ Error creando configuración:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
