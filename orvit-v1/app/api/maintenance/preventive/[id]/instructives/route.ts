import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/maintenance/preventive/[id]/instructives - Obtener instructivos de un mantenimiento preventivo
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const templateId = params.id;

    // Obtener instructivos asociados al template
    const instructives = await prisma.document.findMany({
      where: {
        entityType: 'PREVENTIVE_MAINTENANCE_INSTRUCTIVE',
        entityId: templateId
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    const instructivesData = instructives.map(instructive => ({
      id: instructive.id,
      fileName: instructive.originalName,
      url: instructive.url,
      uploadedAt: instructive.createdAt
    }));

    return NextResponse.json({
      success: true,
      instructives: instructivesData
    });

  } catch (error) {
    console.error('Error en GET /api/maintenance/preventive/[id]/instructives:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/maintenance/preventive/[id]/instructives - Agregar instructivo a un mantenimiento preventivo
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const templateId = params.id;
    const body = await request.json();
    const { url, originalName, fileName } = body;

    if (!url || !originalName) {
      return NextResponse.json(
        { error: 'URL y nombre original son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el template existe
    const template = await prisma.document.findFirst({
      where: {
        id: templateId,
        entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE'
      }
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Mantenimiento preventivo no encontrado' },
        { status: 404 }
      );
    }

    // Crear el instructivo
    const instructive = await prisma.document.create({
      data: {
        id: `instructive-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        entityType: 'PREVENTIVE_MAINTENANCE_INSTRUCTIVE',
        entityId: templateId,
        originalName,
        url,
      }
    });

    return NextResponse.json({
      success: true,
      instructive: {
        id: instructive.id,
        fileName: instructive.originalName,
        url: instructive.url,
        uploadedAt: instructive.createdAt
      }
    });

  } catch (error) {
    console.error('Error en POST /api/maintenance/preventive/[id]/instructives:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/maintenance/preventive/[id]/instructives?instructiveId=xyz - Eliminar instructivo
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const templateId = params.id;
    const { searchParams } = new URL(request.url);
    const instructiveId = searchParams.get('instructiveId');

    if (!instructiveId) {
      return NextResponse.json(
        { error: 'instructiveId es requerido' },
        { status: 400 }
      );
    }

    // Verificar que el instructivo existe y pertenece al template
    const instructive = await prisma.document.findFirst({
      where: {
        id: instructiveId,
        entityType: 'PREVENTIVE_MAINTENANCE_INSTRUCTIVE',
        entityId: templateId
      }
    });

    if (!instructive) {
      return NextResponse.json(
        { error: 'Instructivo no encontrado' },
        { status: 404 }
      );
    }

    // Eliminar el instructivo
    await prisma.document.delete({
      where: {
        id: instructiveId
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Instructivo eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error en DELETE /api/maintenance/preventive/[id]/instructives:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 