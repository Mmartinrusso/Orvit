import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/tools/[id]/component-usage - Obtener componentes que usan este repuesto
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const toolId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    // Obtener componentes que usan este repuesto usando SQL directo
    const componentUsage = await prisma.$queryRaw`
      SELECT 
        m.id as machine_id,
        m.name as machine_name,
        m.nickname as machine_nickname,
        c.id as component_id,
        c.name as component_name,
        c."technicalInfo" as component_description,
        ct."quantityNeeded",
        ct."minStockLevel",
        ct.notes
      FROM "ComponentTool" ct
      INNER JOIN "Component" c ON ct."componentId" = c.id
      INNER JOIN "Machine" m ON c."machineId" = m.id
      WHERE ct."toolId" = ${toolId}
        AND m."companyId" = ${parseInt(companyId)}
        AND c.status != 'INACTIVO'
      ORDER BY m.name, c.name
    ` as any[];

    // Agrupar por máquina
    const groupedUsage = componentUsage.reduce((acc: any[], row: any) => {
      const existingMachine = acc.find(m => m.machine.id === row.machine_id);
      
      const componentData = {
        id: row.component_id,
        name: row.component_name,
        description: row.component_description || '',
        quantityNeeded: row.quantityNeeded || 1,
        minStockLevel: row.minStockLevel || null,
        notes: row.notes || null
      };

      if (existingMachine) {
        existingMachine.components.push(componentData);
      } else {
        acc.push({
          machine: {
            id: row.machine_id,
            name: row.machine_name,
            nickname: row.machine_nickname || null
          },
          components: [componentData]
        });
      }

      return acc;
    }, []);

    return NextResponse.json({
      success: true,
      usage: groupedUsage
    });

  } catch (error) {
    console.error('Error en GET /api/tools/[id]/component-usage:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 