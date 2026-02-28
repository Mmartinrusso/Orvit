import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

// PUT /api/cost-distribution/[id] - Actualizar configuración de distribución de costos
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    console.log('🔄 API Cost Distribution PUT - Iniciando...');
    
    const { id } = params;
    const body = await request.json();
    
    const {
      costType,
      costName,
      productCategoryId,
      percentage
    } = body;

    if (!costType || !costName || !productCategoryId || !percentage) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      );
    }

    // Actualizar la configuración
    const updatedDistribution = await prisma.$queryRawUnsafe(`
      UPDATE cost_distribution_config 
      SET 
        cost_type = $1,
        cost_name = $2,
        product_category_id = $3,
        percentage = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, costType, costName, parseInt(productCategoryId), parseFloat(percentage), parseInt(id));

    console.log('✅ Configuración actualizada:', updatedDistribution);
    return NextResponse.json({ 
      success: true, 
      message: 'Configuracion actualizada exitosamente',
      data: updatedDistribution 
    });

  } catch (error) {
    console.error('❌ Error actualizando configuración:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/cost-distribution/[id] - Eliminar configuración de distribución de costos
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    console.log('🗑️ API Cost Distribution DELETE - Iniciando...');
    
    const { id } = params;

    // Eliminar la configuración
    const deletedDistribution = await prisma.$queryRawUnsafe(`
      DELETE FROM cost_distribution_config 
      WHERE id = $1
      RETURNING *
    `, parseInt(id));

    if (!deletedDistribution || (deletedDistribution as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Configuración no encontrada' },
        { status: 404 }
      );
    }

    console.log('✅ Configuración eliminada:', deletedDistribution);
    return NextResponse.json({ 
      success: true, 
      message: 'Configuracion eliminada exitosamente',
      data: deletedDistribution 
    });

  } catch (error) {
    console.error('❌ Error eliminando configuración:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
