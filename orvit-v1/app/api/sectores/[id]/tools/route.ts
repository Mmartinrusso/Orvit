import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

// GET - Obtener todas las herramientas asignadas a un sector
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const sectorId = parseInt(params.id);

    if (isNaN(sectorId)) {
      return NextResponse.json(
        { error: 'ID de sector inválido' },
        { status: 400 }
      );
    }

    const sectorTools = await prisma.sectorTool.findMany({
      where: {
        sectorId: sectorId
      },
      include: {
        tool: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(sectorTools);
  } catch (error) {
    console.error('Error obteniendo herramientas del sector:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Asignar una herramienta a un sector
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const sectorId = parseInt(params.id);
    const body = await request.json();
    const { toolId, quantity = 1, isRequired = true, notes } = body;

    if (isNaN(sectorId)) {
      return NextResponse.json(
        { error: 'ID de sector inválido' },
        { status: 400 }
      );
    }

    if (!toolId) {
      return NextResponse.json(
        { error: 'ID de herramienta es requerido' },
        { status: 400 }
      );
    }

    // Verificar que el sector existe
    const sector = await prisma.sector.findUnique({
      where: { id: sectorId }
    });

    if (!sector) {
      return NextResponse.json(
        { error: 'Sector no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que la herramienta existe
    const tool = await prisma.tool.findUnique({
      where: { id: toolId }
    });

    if (!tool) {
      return NextResponse.json(
        { error: 'Herramienta no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que la herramienta pertenece a la misma empresa que el sector
    if (tool.companyId !== sector.companyId) {
      return NextResponse.json(
        { error: 'La herramienta no pertenece a la misma empresa que el sector' },
        { status: 400 }
      );
    }

    // Crear la asignación
    const sectorTool = await prisma.sectorTool.create({
      data: {
        sectorId,
        toolId,
        quantity,
        isRequired,
        notes
      },
      include: {
        tool: true
      }
    });

    return NextResponse.json(sectorTool, { status: 201 });
  } catch (error) {
    console.error('Error asignando herramienta al sector:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Esta herramienta ya está asignada a este sector' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 