import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ============================================
// OPTIMIZED HELPERS using Recursive CTEs
// These execute a SINGLE query instead of N+1
// ============================================

// Helper: Obtener ruta completa (breadcrumb) usando CTE recursivo
// ANTES: N queries (uno por ancestro)
// AHORA: 1 query
async function getComponentBreadcrumb(componentId: number): Promise<string[]> {
  const result = await prisma.$queryRaw<{ name: string; depth: number }[]>`
    WITH RECURSIVE ancestors AS (
      SELECT id, name, "parentId", 0 as depth
      FROM "Component"
      WHERE id = ${componentId}
      UNION ALL
      SELECT c.id, c.name, c."parentId", a.depth + 1
      FROM "Component" c
      INNER JOIN ancestors a ON c.id = a."parentId"
      WHERE a.depth < 50
    )
    SELECT name, depth FROM ancestors ORDER BY depth DESC
  `;
  return result.map(r => r.name);
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const componentId = parseInt(params.id);

    // ✨ OPTIMIZADO: Queries en paralelo
    const [parentComponent, parentBreadcrumb, subcomponents] = await Promise.all([
      // Query 1: Componente padre con máquina
      prisma.component.findUnique({
        where: { id: componentId },
        include: {
          machine: {
            select: { id: true, name: true }
          }
        }
      }),

      // Query 2: Breadcrumb con CTE (1 query)
      getComponentBreadcrumb(componentId),

      // Query 3: Subcomponentes directos
      prisma.component.findMany({
        where: { parentId: componentId },
        select: {
          id: true,
          name: true,
          code: true,
          type: true,
          description: true,
          technicalInfo: true,
          logo: true,
          system: true,
          parentId: true,
          machineId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { children: true }
          },
          tools: {
            include: {
              tool: {
                select: { id: true, name: true, code: true, itemType: true, stockQuantity: true, status: true }
              }
            }
          }
        },
        orderBy: { name: 'asc' },
      })
    ]);

    if (!parentComponent) {
      return NextResponse.json({ error: 'Componente padre no encontrado' }, { status: 404 });
    }

    // Depth = breadcrumb.length - 1 (el breadcrumb incluye el componente actual)
    const parentDepth = parentBreadcrumb.length - 1;

    // Agregar breadcrumb, depth y machineName a cada subcomponente
    const subcomponentsWithHierarchy = subcomponents.map(sub => ({
      ...sub,
      breadcrumb: [...parentBreadcrumb, sub.name],
      depth: parentDepth + 1,
      machineName: parentComponent.machine?.name,
      children: [], // Placeholder - si necesitan hijos, se cargan aparte
      documents: [] // Placeholder - si necesitan docs, se cargan aparte
    }));

    return NextResponse.json(subcomponentsWithHierarchy);
  } catch (error) {
    console.error('Error al obtener subcomponentes:', error);
    return NextResponse.json(
      { error: 'Error al obtener subcomponentes' },
      { status: 500 }
    );
  }
} 