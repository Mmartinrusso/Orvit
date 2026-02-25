import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// GET /api/components/[id]/tools - Obtener repuestos de un componente
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const componentId = parseInt(params.id);

    // Verificar company boundary a través de la máquina
    const component = await prisma.component.findUnique({
      where: { id: componentId },
      select: { id: true, machine: { select: { companyId: true } } }
    });
    if (!component || component.machine.companyId !== auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const componentTools = await prisma.componentTool.findMany({
      where: {
        componentId: componentId
      },
      select: {
        id: true,
        componentId: true,
        toolId: true,
        quantityNeeded: true,
        minStockLevel: true,
        isOptional: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        tool: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            stockQuantity: true,
            minStockLevel: true,
            status: true
          }
        },
        component: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { isOptional: 'asc' }, // Obligatorios primero
        { tool: { name: 'asc' } }
      ]
    });

    return NextResponse.json(componentTools, { status: 200 });
  } catch (error) {
    console.error('Error en GET /api/components/[id]/tools:', error);
    return NextResponse.json(
      { error: 'Error al obtener repuestos del componente' },
      { status: 500 }
    );
  }
}

// POST /api/components/[id]/tools - Vincular repuesto a componente
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const componentId = parseInt(params.id);

    // Verificar company boundary a través de la máquina
    const component = await prisma.component.findUnique({
      where: { id: componentId },
      select: { id: true, name: true, machine: { select: { companyId: true } } }
    });
    if (!component || component.machine.companyId !== auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();

    const {
      toolId,
      quantityNeeded,
      minStockLevel,
      notes,
      isOptional
    } = body;

    // Validaciones básicas
    if (!toolId) {
      return NextResponse.json(
        { error: 'El ID del repuesto es requerido' },
        { status: 400 }
      );
    }

    // Verificar que el repuesto existe
    const tool = await prisma.tool.findUnique({
      where: { id: parseInt(toolId) }
    });

    if (!tool) {
      return NextResponse.json(
        { error: 'Repuesto no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que no esté ya vinculado
    const existingRelation = await prisma.componentTool.findUnique({
      where: {
        componentId_toolId: {
          componentId: componentId,
          toolId: parseInt(toolId)
        }
      },
      select: {
        id: true,
        componentId: true,
        toolId: true
      }
    });

    if (existingRelation) {
      return NextResponse.json(
        { error: 'Este repuesto ya está vinculado al componente' },
        { status: 409 }
      );
    }

    // Crear la relación
    const componentTool = await prisma.componentTool.create({
      data: {
        componentId: componentId,
        toolId: parseInt(toolId),
        quantityNeeded: quantityNeeded || 1,
        minStockLevel: minStockLevel || null,
        notes: notes || null,
        isOptional: isOptional || false
      },
      select: {
        id: true,
        componentId: true,
        toolId: true,
        quantityNeeded: true,
        minStockLevel: true,
        isOptional: true,
        notes: true,
        createdAt: true,
        tool: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            stockQuantity: true
          }
        },
        component: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // console.log(`✅ Repuesto "${tool.name}" vinculado al componente "${component.name}"`) // Log reducido;
    
    return NextResponse.json(componentTool, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/components/[id]/tools:', error);
    return NextResponse.json(
      { error: 'Error al vincular repuesto al componente' },
      { status: 500 }
    );
  }
}

// DELETE /api/components/[id]/tools?toolId=123 - Desvincular repuesto
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const componentId = parseInt(params.id);

    // Verificar company boundary a través de la máquina
    const componentCheck = await prisma.component.findUnique({
      where: { id: componentId },
      select: { id: true, machine: { select: { companyId: true } } }
    });
    if (!componentCheck || componentCheck.machine.companyId !== auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId');

    if (!toolId) {
      return NextResponse.json(
        { error: 'El ID del repuesto es requerido' },
        { status: 400 }
      );
    }

    // Verificar que la relación existe
    const existingRelation = await prisma.componentTool.findUnique({
      where: {
        componentId_toolId: {
          componentId: componentId,
          toolId: parseInt(toolId)
        }
      },
      select: {
        id: true,
        componentId: true,
        toolId: true,
        tool: {
          select: {
            id: true,
            name: true
          }
        },
        component: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!existingRelation) {
      return NextResponse.json(
        { error: 'Relación no encontrada' },
        { status: 404 }
      );
    }

    // Eliminar la relación
    await prisma.componentTool.delete({
      where: {
        componentId_toolId: {
          componentId: componentId,
          toolId: parseInt(toolId)
        }
      }
    });

    // console.log(`✅ Repuesto "${existingRelation.tool.name}" desvinculado del componente "${existingRelation.component.name}"`) // Log reducido;

    return NextResponse.json(
      { 
        message: 'Repuesto desvinculado exitosamente',
        deletedRelation: {
          componentName: existingRelation.component.name,
          toolName: existingRelation.tool.name
        }
      }, 
      { status: 200 }
    );
  } catch (error) {
    console.error('Error en DELETE /api/components/[id]/tools:', error);
    return NextResponse.json(
      { error: 'Error al desvincular repuesto del componente' },
      { status: 500 }
    );
  }
} 