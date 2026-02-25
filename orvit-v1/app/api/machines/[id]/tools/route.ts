import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// GET /api/machines/[id]/tools - Obtener repuestos asociados a una máquina
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const machineId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const componentId = searchParams.get('componentId');

    if (!machineId || isNaN(machineId)) {
      return NextResponse.json(
        { error: 'ID de máquina inválido' },
        { status: 400 }
      );
    }

    // Verificar que la máquina pertenece a la empresa del usuario
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      select: { id: true, companyId: true }
    });

    if (!machine) {
      return NextResponse.json({ error: 'Máquina no encontrada' }, { status: 404 });
    }

    if (machine.companyId !== auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Construir la consulta base
    let whereClause: any = {
      component: {
        machineId: machineId
      }
    };

    // Si se especifica un componente, filtrar por él
    if (componentId && componentId !== 'none') {
      whereClause.componentId = parseInt(componentId);
    }

    // Obtener repuestos asociados a la máquina (o componente específico)
    const machineTools = await prisma.componentTool.findMany({
      where: whereClause,
      include: {
        tool: {
          include: {
            company: true
          }
        },
        component: {
          select: {
            id: true,
            name: true,
            machineId: true
          }
        }
      },
      orderBy: [
        { isOptional: 'asc' }, // Obligatorios primero
        { tool: { name: 'asc' } }
      ]
    });

    // Agrupar por herramienta para evitar duplicados si una herramienta
    // está asociada a múltiples componentes de la misma máquina
    const uniqueTools = machineTools.reduce((acc: any[], item) => {
      const existingTool = acc.find(t => t.tool.id === item.tool.id);
      
      if (existingTool) {
        // Si ya existe, agregar el componente a la lista
        existingTool.components.push({
          id: item.component.id,
          name: item.component.name,
          quantityNeeded: item.quantityNeeded,
          notes: item.notes,
          isOptional: item.isOptional
        });
      } else {
        // Si no existe, agregarlo
        acc.push({
          tool: item.tool,
          components: [{
            id: item.component.id,
            name: item.component.name,
            quantityNeeded: item.quantityNeeded,
            notes: item.notes,
            isOptional: item.isOptional
          }],
          totalQuantityNeeded: item.quantityNeeded,
          minStockLevel: item.minStockLevel,
          isOptional: item.isOptional
        });
      }
      
      return acc;
    }, []);

    return NextResponse.json({
      success: true,
      machineId: machineId,
      tools: uniqueTools,
      totalTools: uniqueTools.length
    });

  } catch (error) {
    console.error('Error en GET /api/machines/[id]/tools:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 