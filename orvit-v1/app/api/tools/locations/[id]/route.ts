import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/tools/locations/[id] - Obtener una ubicación específica
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const locationId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }
    
    // Obtener ubicación específica
    const location = await prisma.toolLocation.findFirst({
      where: {
        id: locationId,
        companyId: parseInt(companyId)
      }
    });
    
    if (!location) {
      return NextResponse.json(
        { error: 'Ubicación no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      location: location
    });

  } catch (error) {
    console.error('Error en GET /api/tools/locations/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/tools/locations/[id] - Actualizar una ubicación
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const locationId = parseInt(params.id);
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }
    
    const { name, description, type } = body;

    // Validaciones básicas
    if (!name) {
      return NextResponse.json(
        { error: 'El nombre de la ubicación es requerido' },
        { status: 400 }
      );
    }

    // Verificar que la ubicación existe y pertenece a la compañía
    const existingLocation = await prisma.toolLocation.findFirst({
      where: {
        id: locationId,
        companyId: parseInt(companyId)
      }
    });

    if (!existingLocation) {
      return NextResponse.json(
        { error: 'Ubicación no encontrada' },
        { status: 404 }
      );
    }

    // Verificar si ya existe otra ubicación con el mismo nombre
    const duplicateLocation = await prisma.toolLocation.findFirst({
      where: {
        name: name,
        companyId: parseInt(companyId),
        id: {
          not: locationId
        }
      }
    });

    if (duplicateLocation) {
      return NextResponse.json(
        { error: 'Ya existe una ubicación con ese nombre' },
        { status: 400 }
      );
    }

    // Actualizar ubicación
    const updatedLocation = await prisma.toolLocation.update({
      where: {
        id: locationId
      },
      data: {
        name: name,
        description: description || '',
        type: type || 'SHELF'
      }
    });

    return NextResponse.json({
      success: true,
      location: updatedLocation,
      message: 'Ubicación actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error en PUT /api/tools/locations/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/tools/locations/[id] - Eliminar una ubicación
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const locationId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }
    
    // Verificar que la ubicación existe y pertenece a la compañía
    const existingLocation = await prisma.toolLocation.findFirst({
      where: {
        id: locationId,
        companyId: parseInt(companyId)
      }
    });

    if (!existingLocation) {
      return NextResponse.json(
        { error: 'Ubicación no encontrada' },
        { status: 404 }
      );
    }

    // Verificar si la ubicación tiene herramientas asociadas
    const toolsUsingLocation = await prisma.tool.count({
      where: {
        location: existingLocation.name,
        companyId: parseInt(companyId)
      }
    });

    if (toolsUsingLocation > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar la ubicación "${existingLocation.name}" porque tiene ${toolsUsingLocation} herramientas asociadas. Primero reasigna o elimina las herramientas.` },
        { status: 400 }
      );
    }

    // Eliminar la ubicación
    await prisma.toolLocation.delete({
      where: {
        id: locationId
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Ubicación eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error en DELETE /api/tools/locations/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 