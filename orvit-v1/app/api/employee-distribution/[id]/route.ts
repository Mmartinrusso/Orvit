import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// PUT /api/employee-distribution/[id] - Actualizar configuración de distribución de empleados
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔄 API Employee Distribution PUT - Iniciando...');
    
    const { id } = params;
    const body = await request.json();
    
    const {
      employeeId,
      productCategoryId,
      percentage
    } = body;

    if (!employeeId || !productCategoryId || !percentage) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      );
    }

    // Actualizar la configuración
    const updatedDistribution = await prisma.$queryRawUnsafe(`
      UPDATE employee_distribution_config 
      SET 
        employee_id = $1,
        product_category_id = $2,
        percentage = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, parseInt(employeeId), parseInt(productCategoryId), parseFloat(percentage), parseInt(id));

    console.log('✅ Configuración actualizada:', updatedDistribution);
    return NextResponse.json({ 
      success: true, 
      message: 'Configuración actualizada exitosamente',
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

// DELETE /api/employee-distribution/[id] - Eliminar configuración de distribución de empleados
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🗑️ API Employee Distribution DELETE - Iniciando...');
    
    const { id } = params;

    // Eliminar la configuración
    const deletedDistribution = await prisma.$queryRawUnsafe(`
      DELETE FROM employee_distribution_config 
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
      message: 'Configuración eliminada exitosamente',
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
