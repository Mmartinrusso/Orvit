import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // ✅ Usar singleton
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener el usuario actual
async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload;
  } catch (error) {
    console.error('Error verificando token:', error);
    return null;
  }
}

// GET /api/components/[id]/failures - Obtener fallas relacionadas con un componente
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const componentId = parseInt(params.id);
    if (isNaN(componentId)) {
      return NextResponse.json(
        { error: 'ID de componente inválido' },
        { status: 400 }
      );
    }

    // Obtener información del componente principal
    const mainComponent = await prisma.component.findUnique({
      where: { id: componentId },
      select: { id: true, name: true, machineId: true }
    });

    if (!mainComponent) {
        return NextResponse.json(
        { error: 'Componente no encontrado' },
        { status: 404 }
      );
    }

    // ✅ OPTIMIZADO: Obtener toda la jerarquía con CTE recursivo (1 query en vez de N)
    const hierarchyResult = await prisma.$queryRaw<{ id: number }[]>`
      WITH RECURSIVE component_tree AS (
        SELECT id FROM "Component" WHERE id = ${componentId}
        UNION ALL
        SELECT c.id FROM "Component" c
        INNER JOIN component_tree ct ON c."parentId" = ct.id
      )
      SELECT id FROM component_tree
    `;
    const componentHierarchyIds = hierarchyResult.map(r => r.id);

    // Obtener fallas de la empresa del usuario filtradas por componente
    const userCompanyId = user.companyId as number;
    if (!userCompanyId) {
      return NextResponse.json(
        { error: 'No se pudo determinar la empresa del usuario' },
        { status: 403 }
      );
    }

    const allFailures = await prisma.workOrder.findMany({
      where: {
        companyId: userCompanyId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        machineId: true,
        status: true,
        priority: true,
        notes: true,
        actualHours: true,
        estimatedHours: true,
        completedDate: true,
        createdAt: true,
        updatedAt: true,
        machine: {
          select: {
            id: true,
            name: true,
          }
        },
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            url: true,
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 500,
    });

    // Filtrar fallas que incluyan cualquiera de estos componentes
    const failures = allFailures.filter(failure => {
      if (!failure.notes) return false;

      try {
        const notesData = JSON.parse(failure.notes);
        const rawSelectedComponents = notesData.affectedComponents || notesData.selectedComponents || [];
        const rawSelectedSubcomponents = notesData.selectedSubcomponents || [];

        const selectedComponents = rawSelectedComponents.map((c: any) => typeof c === 'string' ? parseInt(c) : c).filter((c: number) => !isNaN(c));
        const selectedSubcomponents = rawSelectedSubcomponents.map((c: any) => typeof c === 'string' ? parseInt(c) : c).filter((c: number) => !isNaN(c));

        return componentHierarchyIds.some(id =>
          selectedComponents.includes(id) || selectedSubcomponents.includes(id)
        );
      } catch {
        return false;
      }
    });

    // ✅ OPTIMIZADO: Batch query para todos los componentes de la jerarquía (1 query en vez de N)
    const allComponentsInfo = await prisma.component.findMany({
      where: { id: { in: componentHierarchyIds } },
      select: { id: true, name: true }
    });
    const componentInfoMap = new Map(allComponentsInfo.map(c => [c.id, c]));

    // Transformar las fallas (sin queries adicionales)
    const transformedFailures = failures.map((failure) => {
      // Parsear datos adicionales del JSON en notes
      let additionalData: any = {
        selectedComponents: [],
        selectedSubcomponents: [],
        toolsUsed: [],
        sparePartsUsed: [],
        failureType: 'MECANICA',
        solution: ''
      };

      try {
        if (failure.notes) {
          additionalData = { ...additionalData, ...JSON.parse(failure.notes) };
        }
      } catch (error) {
        console.error('Error parsing notes:', error);
      }

      // Determinar qué componentes de la jerarquía están involucrados
      const rawComponentsToCheck = additionalData.affectedComponents || additionalData.selectedComponents || [];
      const rawSubcomponentsToCheck = additionalData.selectedSubcomponents || [];

      const componentsToCheck = rawComponentsToCheck.map((c: any) => typeof c === 'string' ? parseInt(c) : c).filter((c: number) => !isNaN(c));
      const subcomponentsToCheck = rawSubcomponentsToCheck.map((c: any) => typeof c === 'string' ? parseInt(c) : c).filter((c: number) => !isNaN(c));

      const involvedComponents = componentHierarchyIds.filter((id: number) =>
        componentsToCheck.includes(id) || subcomponentsToCheck.includes(id)
      );

      // ✅ Usar el map pre-cargado (O(1) por componente)
      const involvedComponentsInfo = involvedComponents.map((compId: number) =>
        componentInfoMap.get(compId) || { id: compId, name: `Componente ${compId}` }
      );

      return {
        id: failure.id,
        title: failure.title,
        description: failure.description,
        machineId: failure.machineId,
        machine: failure.machine,
        componentName: failure.machine?.name || 'Máquina no especificada',
        failureType: additionalData.failureType || 'MECANICA',
        status: failure.status,
        priority: failure.priority,
        reportedDate: failure.createdAt,
        resolvedDate: failure.completedDate || null,
        solution: additionalData.solution || '',
        actualHours: failure.actualHours,
        estimatedHours: failure.estimatedHours,
        reportedBy: failure.createdBy,
        resolvedBy: failure.assignedTo,
        tags: [],
        downtime: null,
        rootCause: null,
        preventiveMeasures: null,
        selectedComponents: additionalData.affectedComponents || additionalData.selectedComponents || [],
        selectedSubcomponents: additionalData.selectedSubcomponents || [],
        toolsUsed: additionalData.toolsUsed || [],
        sparePartsUsed: additionalData.sparePartsUsed || [],
        involvedComponents: involvedComponents,
        involvedComponentsInfo: involvedComponentsInfo,
        attachments: failure.attachments.filter(att => !att.fileType?.startsWith('solution_')).map(att => ({
          ...att,
          fileUrl: att.url
        })),
        solutionAttachments: failure.attachments.filter(att => att.fileType?.startsWith('solution_')).map(att => ({
          ...att,
          fileUrl: att.url,
          fileType: att.fileType.replace('solution_', '')
        })),
        createdAt: failure.createdAt,
        updatedAt: failure.updatedAt
      };
    });

    return NextResponse.json({
      success: true,
      failures: transformedFailures,
      componentHierarchy: componentHierarchyIds,
      total: transformedFailures.length
    });

  } catch (error) {
    console.error('❌ Error en GET /api/components/[id]/failures:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 