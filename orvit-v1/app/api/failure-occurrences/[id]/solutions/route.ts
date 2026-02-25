import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { deductSparePartsFromInventory } from '@/lib/corrective/inventory-integration';
import { notifyFailureResolved } from '@/lib/discord/notifications';

export const dynamic = 'force-dynamic';

async function getAuthPayload() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// GET: Listar todas las soluciones de una ocurrencia de falla
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await getAuthPayload();
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const occurrenceId = parseInt(params.id);

    if (isNaN(occurrenceId)) {
      return NextResponse.json(
        { error: 'ID de ocurrencia inválido' },
        { status: 400 }
      );
    }

    // Verificar que la ocurrencia existe
    const occurrence = await prisma.failureOccurrence.findUnique({
      where: { id: occurrenceId },
      include: {
        workOrder: {
          select: {
            id: true,
            title: true,
            status: true
          }
        }
      }
    });

    if (!occurrence) {
      return NextResponse.json(
        { error: 'Ocurrencia no encontrada' },
        { status: 404 }
      );
    }

    // Obtener todas las soluciones
    const solutions = await prisma.failureSolution.findMany({
      where: { occurrenceId },
      include: {
        appliedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: [
        { isPreferred: 'desc' },
        { appliedAt: 'desc' }
      ]
    });

    // Transformar respuesta
    const result = solutions.map(sol => ({
      id: sol.id,
      occurrenceId: sol.occurrenceId,
      title: sol.title,
      description: sol.description,
      appliedById: sol.appliedById,
      appliedByName: sol.appliedBy?.name || null,
      appliedAt: sol.appliedAt,
      actualHours: sol.actualHours ? Number(sol.actualHours) : null,
      timeUnit: sol.timeUnit,
      toolsUsed: sol.toolsUsed,
      sparePartsUsed: sol.sparePartsUsed,
      rootCause: sol.rootCause,
      preventiveActions: sol.preventiveActions,
      attachments: sol.attachments,
      effectiveness: sol.effectiveness,
      isPreferred: sol.isPreferred,
      createdAt: sol.createdAt,
      updatedAt: sol.updatedAt
    }));

    return NextResponse.json({
      success: true,
      occurrence: {
        id: occurrence.id,
        workOrderId: occurrence.failureId,
        workOrderTitle: occurrence.workOrder?.title,
        status: occurrence.status
      },
      solutions: result,
      totalSolutions: result.length
    });

  } catch (error: any) {
    console.error('❌ Error en GET /api/failure-occurrences/[id]/solutions:', error);
    // Errores de schema son errores reales — no silenciar
    if (error?.code === 'P2010' || error?.code === 'P2022' || error?.message?.includes('column') || error?.message?.includes('does not exist') || error?.message?.includes('relation')) {
      console.error('⚠️ Schema desactualizado para FailureSolution. Ejecutar: npx prisma db push');
      return NextResponse.json(
        { error: 'Schema de base de datos desactualizado. Contacte al administrador.', _schema_error: true },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + error?.message },
      { status: 500 }
    );
  }
}

// POST: Agregar una nueva solución a una ocurrencia
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await getAuthPayload();
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const occurrenceId = parseInt(params.id);

    if (isNaN(occurrenceId)) {
      return NextResponse.json(
        { error: 'ID de ocurrencia inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const {
      title,
      description,
      appliedById,
      appliedAt,
      actualHours,
      timeUnit = 'hours',
      toolsUsed,
      sparePartsUsed,
      rootCause,
      preventiveActions,
      attachments,
      effectiveness,
      isPreferred = false
    } = body;

    // Validaciones
    if (!title) {
      return NextResponse.json(
        { error: 'El título de la solución es requerido' },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        { error: 'La descripción de la solución es requerida' },
        { status: 400 }
      );
    }

    if (!appliedById) {
      return NextResponse.json(
        { error: 'El usuario que aplicó la solución es requerido' },
        { status: 400 }
      );
    }

    // Verificar que la ocurrencia existe
    const occurrence = await prisma.failureOccurrence.findUnique({
      where: { id: occurrenceId },
      include: {
        workOrder: true
      }
    });

    if (!occurrence) {
      return NextResponse.json(
        { error: 'Ocurrencia no encontrada' },
        { status: 404 }
      );
    }

    // ✅ OPTIMIZADO: Usar transacción para atomicidad de isPreferred + create
    const solution = await prisma.$transaction(async (tx) => {
      // Si esta solución es preferida, desmarcar las demás
      if (isPreferred) {
        await tx.failureSolution.updateMany({
          where: { occurrenceId },
          data: { isPreferred: false }
        });
      }

      // Crear la solución
      return tx.failureSolution.create({
        data: {
          occurrenceId,
          title,
          description,
          appliedById: parseInt(appliedById),
          appliedAt: appliedAt ? new Date(appliedAt) : new Date(),
          actualHours: actualHours ? parseFloat(actualHours) : null,
          timeUnit,
          toolsUsed: toolsUsed || null,
          sparePartsUsed: sparePartsUsed || null,
          rootCause: rootCause || null,
          preventiveActions: preventiveActions || null,
          attachments: attachments || null,
          effectiveness: effectiveness ? parseInt(effectiveness) : null,
          isPreferred
        },
        include: {
          appliedBy: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
    });

    // Actualizar el estado de la ocurrencia a RESOLVED si es la primera solución
    const solutionsCount = await prisma.failureSolution.count({
      where: { occurrenceId }
    });

    if (solutionsCount === 1) {
      await prisma.failureOccurrence.update({
        where: { id: occurrenceId },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date()
        }
      });

      // También actualizar el WorkOrder asociado a COMPLETED
      if (occurrence.failureId) {
        await prisma.workOrder.update({
          where: { id: occurrence.failureId },
          data: {
            status: 'COMPLETED',
            completedDate: new Date(),
            actualHours: actualHours ? parseFloat(actualHours) : null
          }
        });
      }

      // Notificar por Discord que la falla fue resuelta (fire-and-forget)
      const sendDiscordResolved = async () => {
        try {
          const fullOccurrence = await prisma.failureOccurrence.findUnique({
            where: { id: occurrenceId },
            include: {
              machine: { select: { name: true, sectorId: true } },
              component: { select: { name: true } },
              subComponent: { select: { name: true } },
            }
          });

          if (!fullOccurrence?.machine?.sectorId) return;

          const appliedByUser = await prisma.user.findUnique({
            where: { id: parseInt(appliedById) },
            select: { name: true }
          });

          // Calcular tiempo de resolución
          let resolutionTime: string | undefined;
          if (fullOccurrence.reportedAt) {
            const diffMs = new Date().getTime() - new Date(fullOccurrence.reportedAt).getTime();
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            resolutionTime = diffHours > 0 ? `${diffHours}h ${diffMins}min` : `${diffMins} min`;
          }

          await notifyFailureResolved({
            id: occurrenceId,
            title: fullOccurrence.title,
            machineName: fullOccurrence.machine.name,
            sectorId: fullOccurrence.machine.sectorId,
            resolvedBy: appliedByUser?.name || 'Usuario',
            resolutionTime,
            solution: title,
            component: fullOccurrence.component?.name,
            subComponent: fullOccurrence.subComponent?.name
          });
        } catch (discordErr) {
          console.warn('⚠️ Error enviando notificación Discord de resolución:', discordErr);
        }
      };
      sendDiscordResolved().catch(() => {});
    }

    console.log(`✅ Solución creada: ${solution.id} para ocurrencia ${occurrenceId}`);

    // ✅ NUEVO: Descontar repuestos del inventario automáticamente
    let inventoryResult = null;
    if (sparePartsUsed && Array.isArray(sparePartsUsed) && sparePartsUsed.length > 0) {
      try {
        inventoryResult = await deductSparePartsFromInventory(
          sparePartsUsed,
          occurrence.failureId, // workOrderId
          parseInt(appliedById),
          occurrence.companyId
        );

        if (inventoryResult.totalDeducted > 0) {
          console.log(`📦 Inventario actualizado: ${inventoryResult.totalDeducted} repuestos descontados`);
        }
        if (inventoryResult.errors.length > 0) {
          console.warn(`⚠️ Errores de inventario:`, inventoryResult.errors);
        }
      } catch (invError) {
        console.error('⚠️ Error descontando inventario (no crítico):', invError);
        // No falla la operación principal, solo loguea el error
      }
    }

    return NextResponse.json({
      success: true,
      solution: {
        id: solution.id,
        occurrenceId: solution.occurrenceId,
        title: solution.title,
        description: solution.description,
        appliedById: solution.appliedById,
        appliedByName: solution.appliedBy?.name || null,
        appliedAt: solution.appliedAt,
        actualHours: solution.actualHours ? Number(solution.actualHours) : null,
        timeUnit: solution.timeUnit,
        toolsUsed: solution.toolsUsed,
        sparePartsUsed: solution.sparePartsUsed,
        rootCause: solution.rootCause,
        preventiveActions: solution.preventiveActions,
        attachments: solution.attachments,
        effectiveness: solution.effectiveness,
        isPreferred: solution.isPreferred,
        createdAt: solution.createdAt
      },
      message: solutionsCount === 1
        ? 'Solución creada y falla marcada como resuelta'
        : 'Solución agregada exitosamente',
      // ✅ NUEVO: Info de inventario si se procesaron repuestos
      inventoryUpdated: inventoryResult ? {
        partsDeducted: inventoryResult.totalDeducted,
        stockAlerts: inventoryResult.processedParts
          .filter(p => p.stockAlert)
          .map(p => ({ name: p.name, alert: p.stockAlert, newStock: p.newStock })),
        errors: inventoryResult.errors.length > 0 ? inventoryResult.errors : undefined
      } : undefined
    });

  } catch (error) {
    console.error('❌ Error en POST /api/failure-occurrences/[id]/solutions:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
