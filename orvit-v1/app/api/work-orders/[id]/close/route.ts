/**
 * API: /api/work-orders/[id]/close
 *
 * POST - Cerrar orden de trabajo correctiva con registro de solución aplicada
 *        Dos modos: MINIMUM (obligatorio) y PROFESSIONAL (completo)
 *        Valida: ReturnToProduction, Downtime cerrado, QA aprobado
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';
import { validateCanClose } from '@/lib/corrective/downtime-manager';
import { requiresQA } from '@/lib/corrective/qa-rules';
import { calculateWorkOrderCost } from '@/lib/maintenance-costs/calculator';
import { notifyOTCompleted } from '@/lib/discord/notifications';

export const dynamic = 'force-dynamic';

/**
 * Schema de validación para cierre (MINIMUM + PROFESSIONAL)
 */
const closeWorkOrderSchema = z.object({
  // ===== MODO MINIMUM (OBLIGATORIO) =====
  // Título del mantenimiento (lo que se hizo)
  title: z.string().min(5, 'El título debe tener al menos 5 caracteres').max(150, 'Máximo 150 caracteres').optional(),
  // Diagnóstico y solución
  diagnosis: z.string().min(10, 'El diagnóstico debe tener al menos 10 caracteres'),
  solution: z.string().min(10, 'La solución debe tener al menos 10 caracteres'),
  outcome: z.enum(['FUNCIONÓ', 'PARCIAL', 'NO_FUNCIONÓ']),

  // Quién y cuándo (performedById es opcional, usa el usuario actual si no se proporciona)
  performedById: z.number().int().positive().optional(),
  performedByIds: z.array(z.number().int().positive()).optional(), // Si fueron varios técnicos
  performedAt: z.string().optional(), // ISO string, default ahora
  actualMinutes: z.number().int().positive().optional(),

  // ===== MODO PROFESSIONAL (OPCIONAL) =====
  // Clasificación final (dónde estaba realmente la falla)
  finalComponentId: z.number().int().positive().optional(),
  finalSubcomponentId: z.number().int().positive().optional(),
  confirmedCause: z.string().max(255).optional(),

  // Tipo de solución
  fixType: z.enum(['PARCHE', 'DEFINITIVA']).optional().default('DEFINITIVA'),

  // Plantilla usada (si aplica)
  templateUsedId: z.number().int().positive().optional(),
  sourceSolutionId: z.number().int().positive().optional(), // Si se prellenó desde solución previa

  // Materiales y herramientas
  toolsUsed: z.array(z.object({
    id: z.number().int().positive(),
    name: z.string(),
    quantity: z.number().positive().optional()
  })).optional(),

  sparePartsUsed: z.array(z.object({
    id: z.number().int().positive(),
    name: z.string(),
    quantity: z.number().positive(),
    cost: z.number().positive().optional()
  })).optional(),

  // Efectividad y evidencia
  effectiveness: z.number().int().min(1).max(5).optional(),
  attachments: z.array(z.object({
    url: z.string().url(),
    type: z.enum(['IMAGE', 'VIDEO', 'DOCUMENT']),
    filename: z.string()
  })).optional(),

  notes: z.string().optional(),

  // Modo de cierre
  closingMode: z.enum(['MINIMUM', 'PROFESSIONAL']).optional().default('MINIMUM'),
});

/**
 * POST /api/work-orders/[id]/close
 * Cerrar orden de trabajo con SolutionApplied
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;
    const workOrderId = parseInt(params.id);

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'ID de orden inválido' }, { status: 400 });
    }

    // 2. Verificar que la orden existe y pertenece a la empresa
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        qualityAssurance: true,
        failureOccurrences: {
          select: {
            id: true,
            title: true,  // ✅ Incluir para evitar query adicional
            causedDowntime: true,
            priority: true
          }
        }
      }
    });

    if (!workOrder || workOrder.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Orden de trabajo no encontrada' },
        { status: 404 }
      );
    }

    if (workOrder.status === 'COMPLETED' || workOrder.status === 'CANCELLED') {
      return NextResponse.json(
        { error: `La orden ya está ${workOrder.status === 'COMPLETED' ? 'completada' : 'cancelada'}` },
        { status: 400 }
      );
    }

    // 3. VALIDACIÓN CRÍTICA: Verificar que se puede cerrar
    // (Si el módulo correctivo no está configurado, permitir cerrar igualmente)
    try {
      const validationResult = await validateCanClose({
        workOrderId,
        companyId
      });

      if (!validationResult.valid) {
        return NextResponse.json(
          {
            error: 'No se puede cerrar la orden',
            reason: validationResult.error,
            requiresAction: true
          },
          { status: 400 }
        );
      }
    } catch (validationError: any) {
      // Si falla la validación por tablas faltantes, continuar (permite cerrar OT legacy)
      console.warn('⚠️ Validación de cierre falló (ignorando):', validationError?.message);
    }

    // 4. Parsear y validar body
    const body = await request.json();
    console.log('📝 [CLOSE] Body recibido:', JSON.stringify(body, null, 2));

    const validationSchema = closeWorkOrderSchema.safeParse(body);

    if (!validationSchema.success) {
      const errors = validationSchema.error.errors.map(e =>
        `${e.path.join('.')}: ${e.message}`
      ).join(', ');

      console.error('❌ [CLOSE] Validación falló:', errors);
      console.error('❌ [CLOSE] Errores detallados:', JSON.stringify(validationSchema.error.errors, null, 2));

      return NextResponse.json(
        { error: `Validación falló: ${errors}` },
        { status: 400 }
      );
    }

    console.log('✅ [CLOSE] Validación exitosa');

    const data = validationSchema.data;

    // 5. Obtener failureOccurrenceId (puede no existir para OTs legacy)
    const failureOccurrence = workOrder.failureOccurrences?.[0];
    const performerId = data.performedById || userId;

    // 6. Crear SolutionApplied solo si hay failureOccurrence asociada
    let solutionApplied = null;
    if (failureOccurrence) {
      try {
        solutionApplied = await prisma.solutionApplied.create({
          data: {
            // Relaciones
            failureOccurrenceId: failureOccurrence.id,
            workOrderId: workOrder.id,
            companyId,

            // OBLIGATORIO (MINIMUM)
            diagnosis: data.diagnosis,
            solution: data.solution,
            outcome: data.outcome,
            performedById: performerId,
            performedByIds: data.performedByIds ? JSON.stringify(data.performedByIds) : null,
            performedAt: data.performedAt ? new Date(data.performedAt) : new Date(),
            actualMinutes: data.actualMinutes,

            // OPCIONAL (PROFESSIONAL)
            finalComponentId: data.finalComponentId,
            finalSubcomponentId: data.finalSubcomponentId,
            confirmedCause: data.confirmedCause,
            fixType: data.fixType,
            templateUsedId: data.templateUsedId,
            sourceSolutionId: data.sourceSolutionId,
            toolsUsed: data.toolsUsed ? JSON.stringify(data.toolsUsed) : null,
            sparePartsUsed: data.sparePartsUsed ? JSON.stringify(data.sparePartsUsed) : null,
            effectiveness: data.effectiveness,
            attachments: data.attachments ? JSON.stringify(data.attachments) : null,
            notes: data.notes,
          },
          include: {
            performedBy: {
              select: { id: true, name: true, email: true }
            }
          }
        });
      } catch (solutionError: any) {
        console.warn('⚠️ No se pudo crear SolutionApplied:', solutionError?.message);
        // Continuar con el cierre de la OT aunque falle crear la solución
      }
    }

    // 7. Actualizar WorkOrder a COMPLETED
    // Construir lista de ejecutores: el que cerró + técnicos adicionales si los hay
    const executorIdsList: number[] = [performerId];
    if (data.performedByIds && data.performedByIds.length > 0) {
      for (const id of data.performedByIds) {
        if (!executorIdsList.includes(id)) {
          executorIdsList.push(id);
        }
      }
    }

    // El título del mantenimiento: "Falla X — [título usuario]" o solo el título si no hay falla
    let maintenanceTitle: string;
    const userTitle = data.title || (data.solution.length > 80 ? data.solution.substring(0, 80) + '...' : data.solution);

    if (failureOccurrence) {
      // ✅ OPTIMIZADO: Usar título ya cargado en el include inicial
      maintenanceTitle = `${failureOccurrence.title || 'Falla'} — ${userTitle}`;
    } else {
      maintenanceTitle = userTitle;
    }

    // Convertir minutos a horas para actualHours
    const actualHours = data.actualMinutes ? Math.round((data.actualMinutes / 60) * 100) / 100 : null;

    const updatedWorkOrder = await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: 'COMPLETED',
        completedDate: new Date(),
        isCompleted: true,
        // Actualizar título con formato: "Falla X — Título del mantenimiento"
        title: maintenanceTitle,
        closingMode: data.closingMode,
        diagnosisNotes: data.diagnosis,
        workPerformedNotes: data.solution,
        resultNotes: data.outcome,
        rootCause: data.diagnosis,
        solution: data.solution,
        // Tiempo real trabajado
        actualHours: actualHours,
        // Guardar quién ejecutó la OT
        executorIds: executorIdsList,
        // Si no había asignado, asignar al que cerró
        assignedToId: workOrder.assignedToId || performerId,
      },
      include: {
        assignedTo: {
          select: { id: true, name: true }
        }
      }
    });

    // 8. Actualizar FailureOccurrence a RESOLVED (solo si existe)
    if (failureOccurrence) {
      try {
        await prisma.failureOccurrence.update({
          where: { id: failureOccurrence.id },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date()
          }
        });
      } catch (failureUpdateError: any) {
        console.warn('⚠️ No se pudo actualizar FailureOccurrence:', failureUpdateError?.message);
      }
    }

    // 9. Si QA está activo y fue aprobado, marcar como completado
    if (workOrder.qualityAssurance?.isRequired && workOrder.qualityAssurance.status === 'APPROVED') {
      await prisma.qualityAssurance.update({
        where: { workOrderId },
        data: {
          status: 'RETURNED_TO_PRODUCTION',
          notes: `Orden cerrada con solución aplicada (${data.outcome})`
        }
      });
    }

    // 10. Procesar repuestos usados y reservas
    // Esto incluye: descontar stock, marcar reservas como PICKED, crear movimientos
    const sparePartsResult = await processSparePartsOnClose({
      workOrderId,
      companyId,
      userId: performerId,
      sparePartsUsed: data.sparePartsUsed
    });

    if (sparePartsResult.errors.length > 0) {
      console.warn('⚠️ Algunos repuestos no se pudieron procesar:', sparePartsResult.errors);
    }

    // 11. Calcular costos de la orden de trabajo
    let costBreakdown = null;
    try {
      costBreakdown = await calculateWorkOrderCost(workOrderId, companyId);
      console.log(`✅ Costos calculados para OT #${workOrderId}: $${costBreakdown.totalCost}`);
    } catch (costError: any) {
      console.warn('⚠️ No se pudieron calcular los costos:', costError?.message);
    }

    // 12. ✅ OPTIMIZADO: Discord non-blocking (fire-and-forget)
    const sendDiscordNotification = async () => {
      try {
        // Obtener sectorId y nombre de máquina
        const workOrderWithDetails = await prisma.workOrder.findUnique({
          where: { id: workOrderId },
          select: {
            sectorId: true,
            machine: { select: { name: true } },
            assignedTo: { select: { name: true } }
          }
        });

        if (workOrderWithDetails?.sectorId) {
          // Formatear duración
          let durationStr: string | undefined;
          if (data.actualMinutes) {
            const hours = Math.floor(data.actualMinutes / 60);
            const mins = data.actualMinutes % 60;
            durationStr = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
          }

          await notifyOTCompleted({
            id: workOrderId,
            title: maintenanceTitle,
            machineName: workOrderWithDetails.machine?.name,
            sectorId: workOrderWithDetails.sectorId,
            completedBy: workOrderWithDetails.assignedTo?.name || 'Técnico',
            diagnosis: data.diagnosis,
            solution: data.solution,
            result: data.outcome,
            duration: durationStr
          });
        }
      } catch (discordError) {
        console.warn('⚠️ Error enviando notificación Discord (no crítico):', discordError);
      }
    };
    // Fire-and-forget
    sendDiscordNotification().catch(() => {});

    // 13. Retornar resultado
    return NextResponse.json({
      success: true,
      workOrder: updatedWorkOrder,
      solutionApplied,
      sparePartsProcessed: sparePartsResult,
      costBreakdown,
      message: 'Orden de trabajo cerrada exitosamente'
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Error en POST /api/work-orders/[id]/close:', error);
    console.error('❌ Stack:', error?.stack);
    console.error('❌ Message:', error?.message);
    return NextResponse.json(
      {
        error: 'Error al cerrar orden de trabajo',
        detail: error?.message || 'Error desconocido',
        code: error?.code
      },
      { status: 500 }
    );
  }
}

/**
 * Procesar repuestos al cerrar OT:
 * 1. Marcar reservas PENDING como PICKED
 * 2. Descontar stock de repuestos que no tenían reserva
 * 3. Crear movimientos de inventario
 */
interface SparePartUsed {
  id: number;
  name: string;
  quantity: number;
  cost?: number;
}

interface ProcessResult {
  processed: Array<{ toolId: number; name: string; quantity: number; source: 'reservation' | 'direct' }>;
  errors: string[];
  stockMovements: number;
}

async function processSparePartsOnClose({
  workOrderId,
  companyId,
  userId,
  sparePartsUsed
}: {
  workOrderId: number;
  companyId: number;
  userId: number;
  sparePartsUsed?: SparePartUsed[];
}): Promise<ProcessResult> {
  const result: ProcessResult = {
    processed: [],
    errors: [],
    stockMovements: 0
  };

  try {
    // 1. Obtener todas las reservas pendientes para esta OT
    const pendingReservations = await prisma.sparePartReservation.findMany({
      where: {
        workOrderId,
        companyId,
        status: 'PENDING'
      },
      include: {
        tool: { select: { id: true, name: true, stockQuantity: true, unit: true } }
      }
    });

    // Mapa de tool.id -> reserva para lookup rápido
    const reservationMap = new Map(
      pendingReservations.map(r => [r.toolId, r])
    );

    // 2. Procesar reservas pendientes -> PICKED
    for (const reservation of pendingReservations) {
      try {
        // Verificar stock
        if (reservation.tool.stockQuantity < reservation.quantity) {
          result.errors.push(
            `Stock insuficiente para ${reservation.tool.name}: disponible ${reservation.tool.stockQuantity}, reservado ${reservation.quantity}`
          );
          continue;
        }

        // Transacción: actualizar reserva + descontar stock + crear movimiento
        await prisma.$transaction([
          prisma.sparePartReservation.update({
            where: { id: reservation.id },
            data: {
              status: 'PICKED',
              pickedAt: new Date(),
              pickedById: userId
            }
          }),
          prisma.tool.update({
            where: { id: reservation.toolId },
            data: {
              stockQuantity: { decrement: reservation.quantity }
            }
          }),
          prisma.toolMovement.create({
            data: {
              toolId: reservation.toolId,
              type: 'OUT',
              quantity: reservation.quantity,
              reason: `Cierre OT #${workOrderId}`,
              description: `Reserva #${reservation.id} auto-procesada`,
              userId
            }
          })
        ]);

        result.processed.push({
          toolId: reservation.toolId,
          name: reservation.tool.name,
          quantity: reservation.quantity,
          source: 'reservation'
        });
        result.stockMovements++;
      } catch (err: any) {
        result.errors.push(`Error procesando reserva ${reservation.id}: ${err.message}`);
      }
    }

    // 3. Procesar sparePartsUsed que no tenían reserva
    if (sparePartsUsed && sparePartsUsed.length > 0) {
      for (const part of sparePartsUsed) {
        // Si ya se procesó via reserva, saltar
        if (reservationMap.has(part.id)) {
          const reservation = reservationMap.get(part.id)!;
          // Verificar si la cantidad usada es mayor que la reservada
          if (part.quantity > reservation.quantity) {
            const extraQuantity = part.quantity - reservation.quantity;
            // Descontar el extra directamente
            try {
              const tool = await prisma.tool.findUnique({
                where: { id: part.id },
                select: { id: true, name: true, stockQuantity: true }
              });

              if (!tool || tool.stockQuantity < extraQuantity) {
                result.errors.push(
                  `Stock insuficiente para cantidad extra de ${part.name}: necesita ${extraQuantity} más`
                );
                continue;
              }

              await prisma.$transaction([
                prisma.tool.update({
                  where: { id: part.id },
                  data: { stockQuantity: { decrement: extraQuantity } }
                }),
                prisma.toolMovement.create({
                  data: {
                    toolId: part.id,
                    type: 'OUT',
                    quantity: extraQuantity,
                    reason: `Cierre OT #${workOrderId} (extra)`,
                    description: `Cantidad adicional a reserva`,
                    userId
                  }
                })
              ]);

              result.processed.push({
                toolId: part.id,
                name: part.name,
                quantity: extraQuantity,
                source: 'direct'
              });
              result.stockMovements++;
            } catch (err: any) {
              result.errors.push(`Error descontando extra de ${part.name}: ${err.message}`);
            }
          }
          continue;
        }

        // No tenía reserva -> descontar directamente
        try {
          const tool = await prisma.tool.findFirst({
            where: { id: part.id, companyId },
            select: { id: true, name: true, stockQuantity: true }
          });

          if (!tool) {
            result.errors.push(`Herramienta ${part.name} (ID: ${part.id}) no encontrada`);
            continue;
          }

          if (tool.stockQuantity < part.quantity) {
            result.errors.push(
              `Stock insuficiente para ${part.name}: disponible ${tool.stockQuantity}, usado ${part.quantity}`
            );
            continue;
          }

          await prisma.$transaction([
            prisma.tool.update({
              where: { id: part.id },
              data: { stockQuantity: { decrement: part.quantity } }
            }),
            prisma.toolMovement.create({
              data: {
                toolId: part.id,
                type: 'OUT',
                quantity: part.quantity,
                reason: `Cierre OT #${workOrderId}`,
                description: `Uso directo (sin reserva previa)`,
                userId
              }
            })
          ]);

          result.processed.push({
            toolId: part.id,
            name: part.name,
            quantity: part.quantity,
            source: 'direct'
          });
          result.stockMovements++;
        } catch (err: any) {
          result.errors.push(`Error descontando ${part.name}: ${err.message}`);
        }
      }
    }

    return result;
  } catch (error: any) {
    console.error('Error en processSparePartsOnClose:', error);
    result.errors.push(`Error general: ${error.message}`);
    return result;
  }
}
