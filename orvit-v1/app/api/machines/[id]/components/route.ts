import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ✅ OPTIMIZADO: Construir árbol en memoria con profundidad ilimitada
function buildSubcomponentTree(components: any[], parentId: number | null): any[] {
  return components
    .filter(c => c.parentId === parentId)
    .map(component => ({
      id: component.id,
      name: component.name,
      type: parentId === null ? 'component' : 'subcomponent',
      machineId: component.machineId,
      parentId: component.parentId,
      subcomponents: buildSubcomponentTree(components, component.id)
    }));
}

// GET /api/machines/[id]/components
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const machineId = Number(id);

    if (isNaN(machineId)) {
      return NextResponse.json({ error: 'ID de máquina inválido' }, { status: 400 });
    }

    // ✅ OPTIMIZADO: Verificar máquina y obtener componentes en paralelo
    const [machine, allComponents] = await Promise.all([
      prisma.machine.findUnique({
        where: { id: machineId },
        select: { id: true }
      }),
      // Obtener TODOS los componentes de la máquina en una sola query
      prisma.component.findMany({
        where: { machineId },
        orderBy: { name: 'asc' }
      })
    ]);

    if (!machine) {
      return NextResponse.json({ error: 'Máquina no encontrada' }, { status: 404 });
    }

    // Si no hay componentes, devolver array vacío
    if (allComponents.length === 0) {
      return NextResponse.json([]);
    }

    // ✅ Construir árbol en memoria (profundidad ilimitada)
    const tree = buildSubcomponentTree(allComponents, null);

    return NextResponse.json(tree);
  } catch (error) {
    console.error('Error en GET /api/machines/[id]/components:', error);
    return NextResponse.json({ error: 'Error al obtener componentes' }, { status: 500 });
  }
}

 