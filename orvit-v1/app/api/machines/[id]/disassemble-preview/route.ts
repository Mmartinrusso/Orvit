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

// Helper: obtener todos los descendientes de un componente
async function getComponentDescendants(componentId: number): Promise<number[]> {
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

// GET /api/machines/[id]/disassemble-preview
// Retorna información de todos los componentes y sus datos asociados
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Validar autenticación
  const user = await validateTokenFromCookie();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const machineId = Number(params.id);
  if (isNaN(machineId)) {
    return NextResponse.json({ error: 'ID de máquina inválido' }, { status: 400 });
  }

  try {
    // 2. Obtener máquina con sus componentes principales (nivel 1)
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        components: {
          where: { parentId: null }, // Solo componentes raíz
          include: {
            children: {
              include: {
                children: true // Hasta 3 niveles de profundidad para preview
              }
            }
          }
        }
      }
    });

    if (!machine) {
      return NextResponse.json({ error: 'Máquina no encontrada' }, { status: 404 });
    }

    // Verificar que la máquina pertenece a la empresa del usuario
    if (machine.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Sin permisos para esta máquina' }, { status: 403 });
    }

    // 3. Para cada componente raíz, calcular estadísticas
    const componentsWithStats = await Promise.all(
      machine.components.map(async (component) => {
        // Obtener todos los IDs de descendientes
        const descendantIds = await getComponentDescendants(component.id);
        const allComponentIds = [component.id, ...descendantIds];

        // Contar entidades
        const [workOrdersCount, failuresCount, documentsCount, historyCount, lotInstallationsCount, checklistsCount] = await Promise.all([
          prisma.workOrder.count({
            where: { componentId: { in: allComponentIds } }
          }),
          prisma.failureOccurrence.count({
            where: { subcomponentId: { in: allComponentIds } }
          }),
          prisma.document.count({
            where: { componentId: { in: allComponentIds } }
          }),
          prisma.historyEvent.count({
            where: { componentId: { in: allComponentIds } }
          }),
          prisma.lotInstallation.count({
            where: { componentId: { in: allComponentIds } }
          }),
          prisma.maintenanceChecklist.count({
            where: { componentId: { in: allComponentIds } }
          }),
        ]);

        // Contar OTs activas
        const activeWorkOrdersCount = await prisma.workOrder.count({
          where: {
            componentId: { in: allComponentIds },
            status: { in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD'] }
          }
        });

        return {
          id: component.id,
          name: component.name,
          code: component.code,
          type: component.type,
          description: component.description,
          criticality: component.criticality,
          isSafetyCritical: component.isSafetyCritical,
          childrenCount: descendantIds.length,
          children: component.children.map(child => ({
            id: child.id,
            name: child.name,
            childrenCount: child.children?.length || 0
          })),
          stats: {
            workOrders: workOrdersCount,
            failures: failuresCount,
            documents: documentsCount,
            historyEvents: historyCount,
            activeWorkOrders: activeWorkOrdersCount,
            lotInstallations: lotInstallationsCount,
            checklists: checklistsCount,
          }
        };
      })
    );

    // 4. Calcular totales de la máquina
    const allComponentIds = machine.components.flatMap(c => [c.id]);
    const [
      totalWorkOrders,
      totalFailures,
      totalDocuments,
      machineDocuments,
      totalLotInstallations,
      totalChecklists,
      machineOnlyChecklists,
      preventiveTemplates
    ] = await Promise.all([
      prisma.workOrder.count({ where: { machineId } }),
      prisma.failureOccurrence.count({ where: { machineId } }),
      prisma.document.count({ where: { machineId } }),
      prisma.document.count({ where: { machineId, componentId: null } }), // Docs directos de máquina
      prisma.lotInstallation.count({ where: { machineId } }),
      prisma.maintenanceChecklist.count({ where: { machineId } }),
      prisma.maintenanceChecklist.count({ where: { machineId, componentId: null } }), // Checklists a nivel máquina
      // Preventive maintenance templates (stored as JSON in Document.url)
      prisma.document.findMany({
        where: {
          entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE',
          url: { contains: `"machineId":${machineId}` }
        },
        select: { id: true, url: true }
      }),
    ]);

    // Contar templates preventivos activos
    let activePreventiveCount = 0;
    for (const template of preventiveTemplates) {
      try {
        const data = JSON.parse(template.url);
        if (data.isActive !== false && data.machineId === machineId) {
          activePreventiveCount++;
        }
      } catch {
        // Skip invalid JSON
      }
    }

    return NextResponse.json({
      success: true,
      machine: {
        id: machine.id,
        name: machine.name,
        status: machine.status,
        assetCode: machine.assetCode,
        brand: machine.brand,
        model: machine.model,
        serialNumber: machine.serialNumber,
      },
      components: componentsWithStats,
      totals: {
        components: machine.components.length,
        workOrders: totalWorkOrders,
        failures: totalFailures,
        documents: totalDocuments,
        machineOnlyDocuments: machineDocuments, // Documentos que quedarían huérfanos
        lotInstallations: totalLotInstallations,
        checklists: totalChecklists,
        machineOnlyChecklists: machineOnlyChecklists, // Checklists a nivel máquina (sin componentId)
        preventiveTemplates: activePreventiveCount, // Templates de mantenimiento preventivo
      },
      warnings: {
        hasActiveWorkOrders: componentsWithStats.some(c => c.stats.activeWorkOrders > 0),
        totalActiveWorkOrders: componentsWithStats.reduce((sum, c) => sum + c.stats.activeWorkOrders, 0),
      }
    });

  } catch (error: any) {
    console.error('Error getting disassemble preview:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}
