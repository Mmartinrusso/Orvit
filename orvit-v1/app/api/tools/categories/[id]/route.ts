import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';

// GET /api/tools/categories/[id] - Obtener una categoría específica
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission('tools.view');
    if (error) return error;

    const categoryId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }
    
    // Obtener categoría específica
    const category = await prisma.toolCategory.findFirst({
      where: {
        id: categoryId,
        companyId: parseInt(companyId)
      }
    });
    
    if (!category) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      category
    });

  } catch (error) {
    console.error('Error en GET /api/tools/categories/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/tools/categories/[id] - Actualizar una categoría
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission('tools.edit');
    if (error) return error;

    const categoryId = parseInt(params.id);
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }
    
    const { name, description, icon, color } = body;

    // Validaciones básicas
    if (!name) {
      return NextResponse.json(
        { error: 'El nombre de la categoría es requerido' },
        { status: 400 }
      );
    }

    // Verificar que la categoría existe y pertenece a la compañía
    const existingCategory = await prisma.toolCategory.findFirst({
      where: {
        id: categoryId,
        companyId: parseInt(companyId)
      }
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 }
      );
    }

    // Verificar si ya existe otra categoría con el mismo nombre
    const duplicateCategory = await prisma.toolCategory.findFirst({
      where: {
        name: name,
        companyId: parseInt(companyId),
        id: {
          not: categoryId
        }
      }
    });

    if (duplicateCategory) {
      return NextResponse.json(
        { error: 'Ya existe una categoría con ese nombre' },
        { status: 400 }
      );
    }

    // Actualizar categoría
    const updatedCategory = await prisma.toolCategory.update({
      where: {
        id: categoryId
      },
      data: {
        name: name,
        description: description || '',
        icon: icon || 'wrench',
        color: color || 'blue'
      }
    });

    return NextResponse.json({
      success: true,
      category: updatedCategory,
      message: 'Categoría actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error en PUT /api/tools/categories/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/tools/categories/[id] - Eliminar una categoría
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission('tools.delete');
    if (error) return error;

    const categoryId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }
    
    // Verificar que la categoría existe y pertenece a la compañía
    const existingCategory = await prisma.toolCategory.findFirst({
      where: {
        id: categoryId,
        companyId: parseInt(companyId)
      }
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 }
      );
    }

    // Verificar si la categoría tiene herramientas asociadas
    const toolsUsingCategory = await prisma.tool.count({
      where: {
        category: existingCategory.name,
        companyId: parseInt(companyId)
      }
    });

    if (toolsUsingCategory > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar la categoría "${existingCategory.name}" porque tiene ${toolsUsingCategory} herramientas asociadas. Primero reasigna o elimina las herramientas.` },
        { status: 400 }
      );
    }

    // Eliminar la categoría
    await prisma.toolCategory.delete({
      where: {
        id: categoryId
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Categoría eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error en DELETE /api/tools/categories/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 