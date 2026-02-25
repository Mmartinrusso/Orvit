import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// GET /api/failures/[id]/solutions - Obtener soluciones de una falla específica
// Busca primero en la tabla FailureSolution (nuevo sistema), luego en notes (legacy)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const authPayload = await verifyToken(token);
    if (!authPayload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const failureId = parseInt(params.id);

    if (!failureId || isNaN(failureId)) {
      return NextResponse.json(
        { error: 'ID de falla inválido' },
        { status: 400 }
      );
    }

    console.log(`📋 GET /api/failures/${failureId}/solutions`);

    // Obtener la falla/WorkOrder
    const failure = await prisma.workOrder.findUnique({
      where: { id: failureId },
      include: {
        machine: {
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
        },
        createdBy: {
          select: {
            id: true,
            name: true
          }
        },
        attachments: true,
      }
    });

    // Intentar obtener TODAS las occurrences y sus solutions (puede fallar si las tablas no existen aún)
    let occurrences: any[] = [];
    try {
      // ✅ Buscar por AMBOS: failureId (WorkOrders directos) Y failureTypeId (del catálogo)
      // Esto asegura que encontremos soluciones de ocurrencias registradas desde el catálogo
      const occurrenceResults = await prisma.failureOccurrence.findMany({
        where: {
          OR: [
            { failureId: failureId },       // WorkOrders directos de esta falla
            { failureTypeId: failureId },   // Ocurrencias del catálogo de fallas
          ]
        },
        include: {
          solutions: {
            include: {
              appliedBy: {
                select: {
                  id: true,
                  name: true
                }
              },
              applications: {
                include: {
                  appliedBy: {
                    select: {
                      id: true,
                      name: true
                    }
                  },
                  workOrder: {
                    select: {
                      id: true,
                      title: true,
                      completedDate: true
                    }
                  }
                },
                orderBy: {
                  appliedAt: 'desc'
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        },
        orderBy: {
          reportedAt: 'desc'
        }
      });
      occurrences = occurrenceResults || [];
      console.log(`🔍 Found ${occurrences.length} occurrences for failure ${failureId} (searching by failureId OR failureTypeId)`);
    } catch (e) {
      // Las tablas aún no existen, continuar con fallback a notes
      console.log('⚠️ FailureOccurrence table not found, using legacy notes');
    }

    if (!failure) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    const solutions: any[] = [];

    // ✅ Parsear notes de la falla para obtener timeUnit y estimatedTime
    let failureNotes: any = {};
    try {
      if (failure.notes) {
        failureNotes = JSON.parse(failure.notes);
      }
    } catch (e) {}

    // Tiempo estimado de la falla (para todas las soluciones)
    const failureEstimatedHours = failure.estimatedHours || failureNotes.estimatedTime || 0;
    const failureEstimatedTimeUnit = failureNotes.timeUnit || 'hours';

    // ✅ NUEVO: Primero buscar en FailureSolution de TODAS las occurrences (nuevo sistema)
    if (occurrences.length > 0) {
      let totalSolutions = 0;

      for (const occurrence of occurrences) {
        if (occurrence?.solutions && occurrence.solutions.length > 0) {
          totalSolutions += occurrence.solutions.length;

          for (const solution of occurrence.solutions) {
            // ✅ El conteo real de aplicaciones viene directamente de SolutionApplications
            // (TODAS las aplicaciones, incluyendo la primera, están en applications)
            const applicationCount = solution.applications?.length || 0;

            // Historial de aplicaciones (todas vienen de SolutionApplication)
            const applicationHistory = solution.applications?.map((app: any) => ({
              id: app.id,
              appliedAt: app.appliedAt,
              appliedBy: app.appliedBy?.name || null,
              appliedById: app.appliedById,
              actualHours: app.actualHours ? Number(app.actualHours) : null,
              timeUnit: app.timeUnit,
              effectiveness: app.effectiveness,
              workOrderId: app.workOrderId,
              workOrderTitle: app.workOrder?.title || null,
              completedDate: app.workOrder?.completedDate || null,
              notes: app.notes
            })) || [];

            solutions.push({
              id: solution.id,
              occurrenceId: solution.occurrenceId,
              occurrenceDate: occurrence.reportedAt, // Fecha de la ocurrencia
              title: solution.title,
              description: solution.description,
              appliedById: solution.appliedById,
              appliedByName: solution.appliedBy?.name || null,
              appliedAt: solution.appliedAt,
              actualHours: solution.actualHours ? Number(solution.actualHours) : null,
              timeUnit: solution.timeUnit,
              // ✅ Tiempo estimado de la falla original
              estimatedHours: failureEstimatedHours,
              estimatedTimeUnit: failureEstimatedTimeUnit,
              toolsUsed: solution.toolsUsed || [],
              sparePartsUsed: solution.sparePartsUsed || [],
              rootCause: solution.rootCause,
              preventiveActions: solution.preventiveActions,
              attachments: solution.attachments || [],
              effectiveness: solution.effectiveness,
              isPreferred: solution.isPreferred,
              createdAt: solution.createdAt,
              updatedAt: solution.updatedAt,
              // ✅ NUEVO: Conteo de usos e historial
              usageCount: applicationCount,
              applicationHistory: applicationHistory,
              // Campos adicionales para compatibilidad
              status: 'COMPLETED',
              completedDate: solution.appliedAt,
            });
          }
        }
      }

      console.log(`🔍 Found ${totalSolutions} unique FailureSolutions across ${occurrences.length} occurrences for failure ${failureId}`);
    }

    // ✅ ELIMINADO: La lógica de buscar WorkOrders y crearlos como "wo-X" duplicados
    // Ahora los WorkOrders están vinculados a través de SolutionApplication
    // y se muestran en el historial de cada solución (applicationHistory)

    // ✅ SIEMPRE buscar solución legacy en notes del WorkOrder original
    // (No solo cuando no hay otras soluciones - la primera solución puede estar aquí)
    // Usar failureNotes que ya fue parseado arriba

    console.log(`🔍 Failure ${failureId} status: ${failure.status}, has legacy solution: ${!!failureNotes.solution}`);

    // Verificar si ya tenemos esta solución para evitar duplicados
    // La solución legacy tiene id = failure.id, las otras tienen IDs numéricos o "wo-X"
    const hasLegacySolutionAlready = solutions.some(s => s.id === failure.id || s.id === `legacy-${failure.id}`);

    if (failureNotes.solution && !hasLegacySolutionAlready) {
      // Agregar la solución legacy al inicio (fue la primera)
      solutions.unshift({
        id: `legacy-${failure.id}`,
        title: failureNotes.solutionTitle || failure.title,
        description: failureNotes.solution,
        solution: failureNotes.solution, // Compatibilidad con UI existente
        status: failure.status,
        priority: failure.priority,
        type: failure.type,
        machineId: failure.machineId,
        machine: failure.machine,
        assignedTo: failure.assignedTo,
        createdBy: failure.createdBy,
        // ✅ Tiempo estimado de la falla
        estimatedHours: failureEstimatedHours,
        estimatedTimeUnit: failureEstimatedTimeUnit,
        actualHours: failureNotes.actualHours || failure.actualHours,
        timeUnit: failureNotes.solutionTimeUnit || 'hours',
        solutionTimeUnit: failureNotes.solutionTimeUnit || 'hours',
        scheduledDate: failure.scheduledDate,
        startedDate: failure.startedDate,
        completedDate: failure.completedDate,
        appliedAt: failureNotes.appliedDate || failure.completedDate,
        createdAt: failure.createdAt,
        updatedAt: failure.updatedAt,
        attachments: failure.attachments,
        appliedBy: failureNotes.appliedBy || null,
        appliedById: failureNotes.appliedById || null,
        appliedByName: failureNotes.appliedBy || null,
        toolsUsed: failureNotes.toolsUsed || [],
        sparePartsUsed: failureNotes.sparePartsUsed || [],
        rootCause: failureNotes.rootCause || null,
        preventiveActions: failureNotes.preventiveActions || null,
        effectiveness: failureNotes.effectiveness || null,
        isPreferred: failureNotes.isPreferred || true, // La primera solución suele ser preferida
        solutionFiles: failureNotes.solutionFiles || [],
        isLegacy: true, // Marcar como legacy para debugging
        // Datos de la falla original
        failureTitle: failureNotes.failureTitle || failure.title,
        failureDescription: failureNotes.failureDescription || failure.description,
        failureType: failureNotes.failureType || 'MECANICA',
        affectedComponents: failureNotes.affectedComponents || [],
        componentNames: failureNotes.componentNames || [],
        reportedByName: failureNotes.reportedByName || null,
        reportedById: failureNotes.reportedById || null
      });
      console.log(`📝 Added legacy solution from WorkOrder notes for failure ${failureId}`);
    }

    console.log(`✅ Found ${solutions.length} solutions for failure ${failureId}`);

    return NextResponse.json({
      success: true,
      failure: {
        id: failure.id,
        title: failure.title,
        description: failure.description,
        status: failure.status,
        occurrenceCount: occurrences.length,
        occurrences: occurrences.map(occ => ({
          id: occ.id,
          reportedAt: occ.reportedAt,
          status: occ.status,
          solutionCount: occ.solutions?.length || 0
        }))
      },
      solutions
    });

  } catch (error) {
    console.error('❌ Error en GET /api/failures/[id]/solutions:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
