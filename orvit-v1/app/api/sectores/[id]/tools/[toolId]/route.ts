import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

// DELETE - Eliminar una herramienta asignada a un sector
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; toolId: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const sectorId = parseInt(params.id);
    const toolId = parseInt(params.toolId);

    if (isNaN(sectorId) || isNaN(toolId)) {
      return NextResponse.json(
        { error: 'IDs inválidos' },
        { status: 400 }
      );
    }

    // Verificar que la asignación existe
    const sectorTool = await prisma.sectorTool.findUnique({
      where: {
        sectorId_toolId: {
          sectorId,
          toolId
        }
      }
    });

    if (!sectorTool) {
      return NextResponse.json(
        { error: 'Asignación no encontrada' },
        { status: 404 }
      );
    }

    // Eliminar la asignación
    await prisma.sectorTool.delete({
      where: {
        sectorId_toolId: {
          sectorId,
          toolId
        }
      }
    });

    return NextResponse.json({ message: 'Herramienta eliminada del sector correctamente' });
  } catch (error) {
    console.error('Error eliminando herramienta del sector:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar una asignación de herramienta
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; toolId: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const sectorId = parseInt(params.id);
    const toolId = parseInt(params.toolId);
    const body = await request.json();
    const { quantity, isRequired, notes } = body;

    if (isNaN(sectorId) || isNaN(toolId)) {
      return NextResponse.json(
        { error: 'IDs inválidos' },
        { status: 400 }
      );
    }

    // Verificar que la asignación existe
    const existingSectorTool = await prisma.sectorTool.findUnique({
      where: {
        sectorId_toolId: {
          sectorId,
          toolId
        }
      }
    });

    if (!existingSectorTool) {
      return NextResponse.json(
        { error: 'Asignación no encontrada' },
        { status: 404 }
      );
    }

    // Actualizar la asignación
    const updatedSectorTool = await prisma.sectorTool.update({
      where: {
        sectorId_toolId: {
          sectorId,
          toolId
        }
      },
      data: {
        quantity: quantity !== undefined ? quantity : existingSectorTool.quantity,
        isRequired: isRequired !== undefined ? isRequired : existingSectorTool.isRequired,
        notes: notes !== undefined ? notes : existingSectorTool.notes
      },
      include: {
        tool: true
      }
    });

    return NextResponse.json(updatedSectorTool);
  } catch (error) {
    console.error('Error actualizando asignación de herramienta:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 