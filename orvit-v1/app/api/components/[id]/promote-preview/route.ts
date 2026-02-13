import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

// Validar token desde cookies
async function validateTokenFromCookie() {
  const cookieStore = cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return null;

  try {
    const JWT_SECRET = new TextEncoder().encode(
      process.env.JWT_SECRET || 'Messi'
    );
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { id: number; companyId: number; role: string };
  } catch {
    return null;
  }
}

// Helper: obtener descendientes con CTE recursivo
async function getAllDescendantIds(componentId: number): Promise<number[]> {
  const result = await prisma.$queryRaw<{ id: number }[]>`
    WITH RECURSIVE descendants AS (
      SELECT id FROM "Component" WHERE "parentId" = ${componentId}
      UNION ALL
      SELECT c.id FROM "Component" c
      INNER JOIN descendants d ON c."parentId" = d.id
    )
    SELECT id FROM descendants;
  `;
  return result.map(r => r.id);
}

// GET /api/components/[id]/promote-preview
// Retorna conteos sin ejecutar la migración
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Validar autenticación
  const user = await validateTokenFromCookie();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const componentId = Number(params.id);
  if (isNaN(componentId)) {
    return NextResponse.json({ error: 'ID de componente inválido' }, { status: 400 });
  }

  try {
    // 2. Obtener componente con máquina origen
    const component = await prisma.component.findUnique({
      where: { id: componentId },
      include: {
        machine: {
          select: {
            id: true,
            name: true,
            companyId: true,
            sectorId: true,
            plantZoneId: true,
            areaId: true,
          }
        }
      }
    });

    if (!component) {
      return NextResponse.json({ error: 'Componente no encontrado' }, { status: 404 });
    }

    if (!component.machine) {
      return NextResponse.json({ error: 'Componente sin máquina asociada' }, { status: 400 });
    }

    // Verificar que el componente pertenece a la empresa del usuario
    if (component.machine.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Sin permisos para este componente' }, { status: 403 });
    }

    // 3. Obtener todos los descendientes
    const descendantIds = await getAllDescendantIds(componentId);
    const scopeComponentIds = [componentId, ...descendantIds];

    // 4. Contar entidades a migrar
    const [
      subcomponentsCount,
      workOrdersCount,
      failuresCount,
      documentsCount,
      historyEventsCount,
      activeWorkOrdersCount,
    ] = await Promise.all([
      // Subcomponentes
      prisma.component.count({
        where: { id: { in: descendantIds } }
      }),
      // Work Orders
      prisma.workOrder.count({
        where: { componentId: { in: scopeComponentIds } }
      }),
      // Failure Occurrences
      prisma.failureOccurrence.count({
        where: { subcomponentId: { in: scopeComponentIds } }
      }),
      // Documents
      prisma.document.count({
        where: { componentId: { in: scopeComponentIds } }
      }),
      // History Events
      prisma.historyEvent.count({
        where: { componentId: { in: scopeComponentIds } }
      }),
      // OTs activas (warning)
      prisma.workOrder.count({
        where: {
          componentId: { in: scopeComponentIds },
          status: { in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD'] }
        }
      }),
    ]);

    // 5. Obtener nombres de subcomponentes principales
    const mainSubcomponents = await prisma.component.findMany({
      where: { parentId: componentId },
      select: { id: true, name: true },
      take: 5
    });

    return NextResponse.json({
      success: true,
      component: {
        id: component.id,
        name: component.name,
        code: component.code,
        type: component.type,
        description: component.description,
        criticality: component.criticality,
        isSafetyCritical: component.isSafetyCritical,
      },
      originMachine: {
        id: component.machine.id,
        name: component.machine.name,
        sectorId: component.machine.sectorId,
        plantZoneId: component.machine.plantZoneId,
        areaId: component.machine.areaId,
      },
      counts: {
        subcomponents: subcomponentsCount,
        workOrders: workOrdersCount,
        failures: failuresCount,
        documents: documentsCount,
        historyEvents: historyEventsCount,
      },
      warnings: {
        hasActiveWorkOrders: activeWorkOrdersCount > 0,
        activeWorkOrdersCount,
      },
      mainSubcomponents,
      scopeComponentIds,
    });

  } catch (error: any) {
    console.error('Error getting promotion preview:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}
