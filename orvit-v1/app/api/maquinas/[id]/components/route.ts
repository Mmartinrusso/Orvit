import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// ✅ OPTIMIZADO: Construir árbol en memoria (de N+1 queries a 2 queries fijas)
function buildComponentTree(
  components: any[],
  toolsByComponentId: Map<number, any[]>,
  parentId: number | null = null
): any[] {
  return components
    .filter(c => c.parentId === parentId)
    .map(component => ({
      ...component,
      tools: toolsByComponentId.get(component.id) || [],
      children: buildComponentTree(components, toolsByComponentId, component.id)
    }));
}

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = context.params;
    const machineId = Number(id);

    if (isNaN(machineId)) {
      return NextResponse.json({ error: 'ID de máquina inválido' }, { status: 400 });
    }

    // ✅ Query 1: Verificar máquina existe
    const machine = await prisma.machine.findFirst({
      where: { id: machineId },
      select: { id: true, companyId: true }
    });

    if (!machine) {
      return NextResponse.json({ error: 'Máquina no encontrada' }, { status: 404 });
    }

    if (machine.companyId !== auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // ✅ Query 2 y 3 en paralelo: Todos los componentes + Todas las herramientas
    const [allComponents, allComponentTools] = await Promise.all([
      // Obtener TODOS los componentes de la máquina en una sola query
      prisma.component.findMany({
        where: { machineId: machine.id },
        select: {
          id: true,
          name: true,
          code: true,
          itemNumber: true,
          quantity: true,
          type: true,
          description: true,
          parentId: true,
          technicalInfo: true,
          logo: true,
          system: true,
          createdAt: true,
          updatedAt: true,
        }
      }),
      // Obtener TODAS las herramientas de componentes de esta máquina
      prisma.componentTool.findMany({
        where: {
          component: { machineId: machine.id }
        },
        select: {
          id: true,
          componentId: true,
          toolId: true,
          quantityNeeded: true,
          minStockLevel: true,
          isOptional: true,
          notes: true,
          tool: {
            select: {
              id: true,
              name: true,
              description: true,
              category: true,
              stockQuantity: true,
              status: true
            }
          }
        }
      })
    ]);

    // ✅ Construir mapa de herramientas por componentId
    const toolsByComponentId = new Map<number, any[]>();
    for (const ct of allComponentTools) {
      const existing = toolsByComponentId.get(ct.componentId) || [];
      existing.push(ct);
      toolsByComponentId.set(ct.componentId, existing);
    }

    // ✅ Construir árbol en memoria (O(n) en lugar de O(n²))
    const tree = buildComponentTree(allComponents, toolsByComponentId, null);

    return NextResponse.json(tree);
  } catch (error) {
    console.error(`❌ [API] Error en GET /api/maquinas/${context.params.id}/components:`, error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
} 