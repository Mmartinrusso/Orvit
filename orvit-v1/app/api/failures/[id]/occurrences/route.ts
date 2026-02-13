import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener el usuario actual
async function getCurrentUser() {
  try {
    const token = cookies().get('token')?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    // Buscar usuario directamente por ID
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return null;
  }
}

// POST /api/failures/[id]/occurrences - Registrar una nueva ocurrencia de falla
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔍 Iniciando POST /api/failures/[id]/occurrences');

    const user = await getCurrentUser();
    console.log('🔍 Usuario obtenido:', user ? 'Sí' : 'No');

    if (!user) {
      console.log('❌ Usuario no autorizado');
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const failureId = parseInt(params.id);
    if (isNaN(failureId)) {
      return NextResponse.json(
        { error: 'ID de falla inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    console.log(`📝 POST /api/failures/${failureId}/occurrences - Registrando ocurrencia:`, body);

    const {
      failureTypeId,
      machineId,
      reportedBy,
      notes,
      status = 'OPEN',
      title,
      description,
      failureCategory,
      priority,
      affectedComponents,
      hasSolution = false,
      solution,           // Datos de nueva solución
      existingSolutionId  // ✅ ID de solución existente para reutilizar
    } = body;

    // Verificar que la falla/WorkOrder existe
    const existingFailure = await prisma.workOrder.findUnique({
      where: { id: failureId },
      include: {
        machine: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } }
      }
    });

    if (!existingFailure) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    // Crear WorkOrder tipo CORRECTIVE para esta ocurrencia
    const workOrderStatus = hasSolution ? 'COMPLETED' : 'PENDING';
    const completedDate = hasSolution ? new Date() : null;

    // Convertir tiempo de solución a horas para WorkOrder.actualHours
    let actualHoursInHours = null;
    if (hasSolution && solution?.actualHours) {
      const hours = parseFloat(solution.actualHours);
      actualHoursInHours = solution.timeUnit === 'minutes' ? hours / 60 : hours;
    }

    // Log para debug
    console.log(`📋 Creando WorkOrder - hasSolution: ${hasSolution}, user.id: ${user.id}, solution?.appliedById: ${solution?.appliedById}`);
    // Si tiene solución: asignar a quien aplicó la solución (o al usuario actual)
    // Si NO tiene solución: asignar al usuario que reporta (quien registra la ocurrencia)
    // Asegurar que el ID sea un número
    const userIdNumber = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    const appliedByIdNumber = solution?.appliedById ? (typeof solution.appliedById === 'string' ? parseInt(solution.appliedById) : solution.appliedById) : null;
    const assignedToId = hasSolution ? (appliedByIdNumber || userIdNumber) : userIdNumber;
    console.log(`👤 AssignedToId calculado: ${assignedToId} (tipo: ${typeof assignedToId})`);

    const newWorkOrder = await prisma.workOrder.create({
      data: {
        title: title || existingFailure.title,
        description: description || existingFailure.description,
        type: 'CORRECTIVE',
        status: workOrderStatus,
        priority: priority || existingFailure.priority || 'MEDIUM',
        machineId: machineId || existingFailure.machineId,
        companyId: existingFailure.companyId,
        sectorId: existingFailure.sectorId,
        createdById: user.id,
        assignedToId: assignedToId,
        scheduledDate: hasSolution ? new Date() : null,
        startedDate: hasSolution ? new Date() : null,
        completedDate: completedDate,
        estimatedHours: existingFailure.estimatedHours,
        actualHours: actualHoursInHours,
        notes: JSON.stringify({
          isOccurrenceSolution: true,
          relatedFailureId: failureId,
          reportedBy: user.name,
          reportedById: user.id,
          failureCategory: failureCategory || 'MECANICA'
        })
      }
    });

    console.log(`✅ WorkOrder creada: ${newWorkOrder.id} (${workOrderStatus})`);

    // Intentar crear en la tabla FailureOccurrence (nuevo sistema)
    let occurrence: any = null;
    try {
      // Asegurar que reportedBy sea un número
      const reportedByNumber = reportedBy ? (typeof reportedBy === 'string' ? parseInt(reportedBy) : reportedBy) : userIdNumber;

      occurrence = await (prisma as any).failureOccurrence.create({
        data: {
          failureId: newWorkOrder.id, // WorkOrder ID recién creada
          failureTypeId: failureTypeId || null, // Failure catalog ID (optional)
          machineId: machineId || existingFailure.machineId,
          reportedBy: reportedByNumber,
          title: title || existingFailure.title,
          description: description || existingFailure.description,
          failureCategory: failureCategory || 'MECANICA',
          priority: priority || existingFailure.priority || 'MEDIUM',
          affectedComponents: affectedComponents || null,
          status: hasSolution ? 'RESOLVED' : 'OPEN',
          notes: notes || null,
          reportedAt: new Date(),
          resolvedAt: hasSolution ? new Date() : null
        }
      });

      console.log(`✅ FailureOccurrence creada: ${occurrence.id}`);

      // ✅ Si tiene solución, verificar si es existente o nueva
      if (hasSolution) {
        let solutionIdToUse: number | null = null;

        // Caso 1: Solución existente - crear solo SolutionApplication
        if (existingSolutionId !== undefined && existingSolutionId !== null) {
          console.log(`🔄 Reutilizando solución existente: ${existingSolutionId}`);

          // Parsear el ID (puede ser string o number)
          if (typeof existingSolutionId === 'string' && (existingSolutionId.startsWith('legacy-') || existingSolutionId.startsWith('wo-'))) {
            console.log(`⚠️ Solución legacy/WorkOrder detectada: ${existingSolutionId} - no se puede reutilizar directamente`);
            // Para soluciones legacy, tendríamos que crear una nueva FailureSolution basada en esos datos
            // Por ahora solo logueamos
          } else {
            solutionIdToUse = typeof existingSolutionId === 'number'
              ? existingSolutionId
              : parseInt(String(existingSolutionId));

            if (!isNaN(solutionIdToUse) && solutionIdToUse > 0) {
              // Verificar que la solución existe
              const existingSolution = await (prisma as any).failureSolution.findUnique({
                where: { id: solutionIdToUse }
              });

              if (existingSolution) {
                console.log(`✅ Solución encontrada, creando SolutionApplication`);

                // Crear SolutionApplication para registrar este uso
                await prisma.solutionApplication.create({
                  data: {
                    failureSolutionId: solutionIdToUse,
                    workOrderId: newWorkOrder.id,
                    occurrenceId: occurrence.id,
                    appliedById: userIdNumber,
                    appliedAt: new Date(),
                    actualHours: solution?.actualHours ? parseFloat(solution.actualHours) : null,
                    timeUnit: solution?.timeUnit || 'hours',
                    notes: notes || null,
                    effectiveness: solution?.effectiveness ? parseInt(solution.effectiveness) : null
                  }
                });

                console.log(`✅ SolutionApplication creada para solución ${solutionIdToUse}`);
              } else {
                console.warn(`⚠️ Solución ${solutionIdToUse} no encontrada, creando nueva solución`);
                solutionIdToUse = null;
              }
            }
          }
        }

        // Caso 2: Nueva solución - crear FailureSolution + SolutionApplication
        if (solutionIdToUse === null && solution) {
          console.log(`✨ Creando nueva FailureSolution`);

          const failureSolution = await (prisma as any).failureSolution.create({
            data: {
              occurrenceId: occurrence.id,
              title: solution.title || title || existingFailure.title,
              description: solution.description || description || '',
              appliedById: appliedByIdNumber || userIdNumber,
              appliedAt: new Date(),
              actualHours: solution.actualHours ? parseFloat(solution.actualHours) : null,
              timeUnit: solution.timeUnit || 'hours',
              toolsUsed: solution.toolsUsed || null,
              sparePartsUsed: solution.sparePartsUsed || null,
              rootCause: solution.rootCause || null,
              preventiveActions: solution.preventiveActions || null,
              attachments: solution.attachments || null,
              effectiveness: solution.effectiveness ? parseInt(solution.effectiveness) : null,
              isPreferred: true
            }
          });

          console.log(`✅ Nueva FailureSolution creada: ${failureSolution.id}`);

          // Crear también SolutionApplication para la primera aplicación
          await prisma.solutionApplication.create({
            data: {
              failureSolutionId: failureSolution.id,
              workOrderId: newWorkOrder.id,
              occurrenceId: occurrence.id,
              appliedById: appliedByIdNumber || userIdNumber,
              appliedAt: new Date(),
              actualHours: solution.actualHours ? parseFloat(solution.actualHours) : null,
              timeUnit: solution.timeUnit || 'hours',
              notes: notes || null,
              effectiveness: solution.effectiveness ? parseInt(solution.effectiveness) : null
            }
          });

          console.log(`✅ SolutionApplication creada para nueva solución ${failureSolution.id}`);
        }
      }
    } catch (e) {
      console.log('⚠️ FailureOccurrence table not available, falling back to comments');

      // Fallback: crear comentario de ocurrencia (sistema legacy)
      const occurrenceComment = await prisma.workOrderComment.create({
        data: {
          content: `🚨 OCURRENCIA REGISTRADA - ${new Date().toLocaleString('es-ES')} - Reportado por: ${user.name}${notes ? ` - Notas: ${notes}` : ''}`,
          type: 'occurrence',
          workOrderId: failureId,
          authorId: user.id
        }
      });

      console.log(`✅ Ocurrencia registrada como comentario: ${occurrenceComment.id}`);
      return NextResponse.json({
        success: true,
        message: 'Ocurrencia registrada exitosamente (legacy)',
        occurrence: {
          id: occurrenceComment.id,
          reportedAt: occurrenceComment.createdAt,
          reportedBy: user.name,
          content: occurrenceComment.content,
          isLegacy: true
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: hasSolution
        ? 'Ocurrencia y solución registradas exitosamente'
        : 'Ocurrencia registrada exitosamente',
      occurrence: {
        id: occurrence.id,
        failureId: occurrence.failureId,
        workOrderId: newWorkOrder.id,
        machineId: occurrence.machineId,
        reportedAt: occurrence.reportedAt,
        reportedBy: user.name,
        status: occurrence.status,
        notes: occurrence.notes
      },
      workOrder: {
        id: newWorkOrder.id,
        status: newWorkOrder.status,
        completedDate: newWorkOrder.completedDate
      }
    });

  } catch (error) {
    console.error('❌ Error en POST /api/failures/[id]/occurrences:', error);
    return NextResponse.json({ error: 'Error interno del servidor: ' + (error as Error).message }, { status: 500 });
  }
}

// GET /api/failures/[id]/occurrences - Obtener ocurrencias de una falla
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

    const failureId = parseInt(params.id);
    if (isNaN(failureId)) {
      return NextResponse.json(
        { error: 'ID de falla inválido' },
        { status: 400 }
      );
    }

    console.log(`📋 GET /api/failures/${failureId}/occurrences - Obteniendo ocurrencias`);

    let occurrences: any[] = [];

    // Intentar obtener de FailureOccurrence (nuevo sistema)
    try {
      const failureOccurrences = await (prisma as any).failureOccurrence.findMany({
        where: { failureId: failureId },
        include: {
          solutions: {
            include: {
              appliedBy: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { reportedAt: 'desc' }
      });

      if (failureOccurrences && failureOccurrences.length > 0) {
        occurrences = failureOccurrences.map((occ: any) => ({
          id: occ.id,
          reportedAt: occ.reportedAt,
          resolvedAt: occ.resolvedAt,
          status: occ.status,
          notes: occ.notes,
          solutions: occ.solutions?.map((sol: any) => ({
            id: sol.id,
            title: sol.title,
            description: sol.description,
            appliedByName: sol.appliedBy?.name,
            appliedAt: sol.appliedAt,
            actualHours: sol.actualHours ? Number(sol.actualHours) : null,
            timeUnit: sol.timeUnit,
            effectiveness: sol.effectiveness,
            isPreferred: sol.isPreferred
          })) || [],
          isLegacy: false
        }));
      }
    } catch (e) {
      console.log('⚠️ FailureOccurrence table not available');
    }

    // También obtener comentarios de tipo 'occurrence' (legacy)
    const occurrenceComments = await prisma.workOrderComment.findMany({
      where: {
        workOrderId: failureId,
        type: 'occurrence'
      },
      include: {
        author: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const legacyOccurrences = occurrenceComments.map(occurrence => ({
      id: `legacy-${occurrence.id}`,
      reportedAt: occurrence.createdAt,
      reportedBy: occurrence.author?.name || 'Usuario desconocido',
      notes: occurrence.content.replace(/^🚨 OCURRENCIA REGISTRADA - .*? - Reportado por: .*?( - Notas: )?/, '').trim() || null,
      solutions: [],
      isLegacy: true
    }));

    // Combinar ambas listas
    const allOccurrences = [...occurrences, ...legacyOccurrences];

    console.log(`✅ Ocurrencias obtenidas: ${allOccurrences.length}`);
    return NextResponse.json({
      success: true,
      occurrences: allOccurrences
    });

  } catch (error) {
    console.error('❌ Error en GET /api/failures/[id]/occurrences:', error);
    return NextResponse.json({ error: 'Error interno del servidor: ' + (error as Error).message }, { status: 500 });
  }
}
