/**
 * API: /api/failure-occurrences/quick-report
 *
 * POST - Reporte rápido de falla (modo operario 20-30 segundos)
 *        Solo requiere: máquina/componente + síntomas + ¿paró producción? + foto
 *        Auto-detecta duplicados y retorna opciones: Resolver Ahora | Crear OT | Cerrar
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';
import { calculatePriority } from '@/lib/corrective/priority-calculator';
import { detectDuplicates } from '@/lib/corrective/duplicate-detector';
import { handleDowntime } from '@/lib/corrective/downtime-manager';
import { notifyNewFailure, notifyP1ToSectorTechnicians } from '@/lib/discord/notifications';

export const dynamic = 'force-dynamic';

/**
 * Schema de validación para quick-report (MÍNIMO)
 * Soporta múltiples componentes y subcomponentes
 */
const quickReportSchema = z.object({
  // OBLIGATORIO (3 campos mínimos)
  machineId: z.number().int().positive('Debe seleccionar una máquina'),
  componentIds: z.array(z.number().int().positive()).optional(),
  subcomponentIds: z.array(z.number().int().positive()).optional(),

  // Título (OBLIGATORIO)
  title: z.string().min(5, 'Mínimo 5 caracteres').max(255),

  // Síntomas (chips - OPCIONAL)
  symptomIds: z.array(z.number().int().positive()).optional(),

  // ¿Paró producción? (OBLIGATORIO)
  causedDowntime: z.boolean(),

  // Foto (OPCIONAL pero recomendado)
  attachments: z.array(z.string()).optional(),

  // OPCIONAL (colapsable "+ Detalles")
  description: z.string().optional(),
  failureCategory: z.enum(['MECANICA', 'ELECTRICA', 'HIDRAULICA', 'NEUMATICA', 'OTRA']).optional(),
  isIntermittent: z.boolean().optional().default(false),
  isObservation: z.boolean().optional().default(false),
  isSafetyRelated: z.boolean().optional().default(false),
  notes: z.string().optional(),

  // CIERRE INMEDIATO (ya se resolvió en el momento)
  resolveImmediately: z.boolean().optional().default(false),
  immediateSolution: z.string().optional(),

  // CONTROL DE FLUJO
  forceCreate: z.boolean().optional().default(false), // Ignorar duplicados
  linkToOccurrenceId: z.number().int().positive().optional(), // Vincular como duplicado
});

/**
 * POST /api/failure-occurrences/quick-report
 * Reporte rápido de falla (20-30s)
 */
export async function POST(request: NextRequest) {
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

    // 2. Parsear y validar body
    const body = await request.json();
    const validationResult = quickReportSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e =>
        `${e.path.join('.')}: ${e.message}`
      ).join(', ');

      return NextResponse.json(
        { error: `Validación falló: ${errors}` },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // 3. Extraer componentes principales (el primero de cada array)
    const primaryComponentId = data.componentIds && data.componentIds.length > 0
      ? data.componentIds[0]
      : undefined;
    const primarySubcomponentId = data.subcomponentIds && data.subcomponentIds.length > 0
      ? data.subcomponentIds[0]
      : undefined;

    // 4. Verificar duplicados ANTES de crear (SALVO que forceCreate=true o linkToOccurrenceId esté presente)
    if (!data.forceCreate && !data.linkToOccurrenceId) {
      const duplicates = await detectDuplicates({
        machineId: data.machineId,
        componentId: primaryComponentId,
        subcomponentId: primarySubcomponentId,
        title: data.title,
        symptomIds: data.symptomIds || [],
        companyId
      });

      // Si hay duplicados, retornar para confirmación del usuario
      if (duplicates.length > 0) {
        return NextResponse.json({
          hasDuplicates: true,
          duplicates: duplicates.map(d => ({
            id: d.id,
            title: d.title,
            status: d.status,
            priority: d.priority,
            reportedAt: d.reportedAt,
            similarity: d.similarity,
            machineId: d.machineId
          })),
          // No crear la ocurrencia aún - esperar confirmación del usuario
          message: 'Se detectaron fallas similares. ¿Desea vincular a una existente o crear una nueva?'
        }, { status: 200 });
      }
    }

    // 4.1 Si linkToOccurrenceId está presente, validar que existe
    let isLinkingToExisting = false;
    if (data.linkToOccurrenceId) {
      const mainOccurrence = await prisma.failureOccurrence.findFirst({
        where: {
          id: data.linkToOccurrenceId,
          companyId,
          isLinkedDuplicate: false // Solo puede vincular a casos principales
        }
      });

      if (!mainOccurrence) {
        return NextResponse.json(
          { error: 'La ocurrencia principal no existe o ya es un duplicado vinculado' },
          { status: 400 }
        );
      }

      if (mainOccurrence.machineId !== data.machineId) {
        return NextResponse.json(
          { error: 'Solo puede vincular fallas de la misma máquina' },
          { status: 400 }
        );
      }

      isLinkingToExisting = true;
    }

    // 5. Auto-calcular prioridad (sin criticidad de activo - usa default)
    const priorityResult = calculatePriority({
      assetCriticality: undefined, // La máquina no tiene criticidad definida
      causedDowntime: data.causedDowntime,
      isIntermittent: data.isIntermittent,
      isSafetyRelated: data.isSafetyRelated || false,
      isObservation: data.isObservation
    });

    // 6. Construir notas con información de múltiples componentes
    let additionalNotes = data.notes || '';

    // Si hay múltiples componentes, agregarlos a las notas
    if (data.componentIds && data.componentIds.length > 1) {
      const components = await prisma.component.findMany({
        where: { id: { in: data.componentIds } },
        select: { id: true, name: true }
      });

      const componentNames = components.map(c => c.name).join(', ');
      additionalNotes = `Componentes afectados: ${componentNames}\n\n${additionalNotes}`;
    }

    // Si hay múltiples subcomponentes (que son Component con parentId), agregarlos a las notas
    if (data.subcomponentIds && data.subcomponentIds.length > 1) {
      // Subcomponentes son Component con parentId (jerarquía)
      const subcomponents = await prisma.component.findMany({
        where: { id: { in: data.subcomponentIds } },
        select: { id: true, name: true }
      });

      const subcomponentNames = subcomponents.map(s => s.name).join(', ');
      additionalNotes = `Subcomponentes afectados: ${subcomponentNames}\n\n${additionalNotes}`;
    }

    // 7. Construir estructura de componentes afectados
    const affectedComponentsData = {
      componentIds: data.componentIds || [],
      subcomponentIds: data.subcomponentIds || [],
    };

    // 8. Determinar el tipo de creación:
    // - OBSERVACIÓN: Solo FailureOccurrence (sin OT)
    // - CIERRE INMEDIATO: FailureOccurrence ya resuelta (sin OT)
    // - FALLA NORMAL: FailureOccurrence + WorkOrder automática
    let workOrder: any = null;
    let occurrence: any = null;
    let downtimeLog = null;
    let downtimeError = null;
    let resolvedImmediately = false;

    if (data.isObservation) {
      // ========== OBSERVACIÓN: Solo crear FailureOccurrence SIN WorkOrder ==========
      occurrence = await prisma.failureOccurrence.create({
        data: {
          // failureId: null (NO hay WorkOrder para observaciones)
          companyId,
          machineId: data.machineId,
          subcomponentId: primarySubcomponentId,
          affectedComponents: (data.componentIds?.length || data.subcomponentIds?.length)
            ? affectedComponentsData
            : undefined,
          title: data.title,
          description: data.description,
          failureCategory: data.failureCategory || 'MECANICA',
          priority: priorityResult.priority,
          isIntermittent: data.isIntermittent,
          isObservation: true,
          causedDowntime: false, // Observaciones no causan downtime
          notes: `[OBSERVACIÓN] ${additionalNotes.trim() || 'Registrada para seguimiento'}`,
          reportedBy: userId,
          reportedAt: new Date(),
          status: 'OPEN',
          symptoms: data.symptomIds || [],
          photos: data.attachments && data.attachments.length > 0
            ? data.attachments.map((url: string) => ({ url, uploadedAt: new Date().toISOString() }))
            : undefined,
          isLinkedDuplicate: isLinkingToExisting,
          linkedToOccurrenceId: data.linkToOccurrenceId || null,
          linkedById: isLinkingToExisting ? userId : null,
          linkedAt: isLinkingToExisting ? new Date() : null,
          linkedReason: isLinkingToExisting
            ? `Vinculado desde reporte rápido como duplicado de #${data.linkToOccurrenceId}`
            : null,
        },
        include: {
          machine: { select: { id: true, name: true, serialNumber: true } },
          reporter: { select: { id: true, name: true, email: true } },
        }
      });

      console.log('📋 Observación creada (sin OT):');
      console.log('   - FailureOccurrence ID:', occurrence.id);

    } else if (data.resolveImmediately) {
      // ========== CIERRE INMEDIATO: FailureOccurrence resuelta SIN WorkOrder ==========
      // Se registra la falla y la solución en el momento, sin crear OT
      resolvedImmediately = true;

      const solutionNote = data.immediateSolution
        ? `[SOLUCIÓN INMEDIATA] ${data.immediateSolution}`
        : '[SOLUCIONADA INMEDIATAMENTE]';

      occurrence = await prisma.failureOccurrence.create({
        data: {
          companyId,
          machineId: data.machineId,
          subcomponentId: primarySubcomponentId,
          affectedComponents: (data.componentIds?.length || data.subcomponentIds?.length)
            ? affectedComponentsData
            : undefined,
          title: data.title,
          description: data.description,
          failureCategory: data.failureCategory || 'MECANICA',
          priority: priorityResult.priority,
          isIntermittent: data.isIntermittent,
          isObservation: false,
          causedDowntime: data.causedDowntime,
          notes: `${solutionNote}\n\n${additionalNotes.trim()}`.trim(),
          reportedBy: userId,
          reportedAt: new Date(),
          status: 'RESOLVED', // Ya resuelta
          resolvedImmediately: true,
          symptoms: data.symptomIds || [],
          photos: data.attachments && data.attachments.length > 0
            ? data.attachments.map((url: string) => ({ url, uploadedAt: new Date().toISOString() }))
            : undefined,
          isLinkedDuplicate: isLinkingToExisting,
          linkedToOccurrenceId: data.linkToOccurrenceId || null,
          linkedById: isLinkingToExisting ? userId : null,
          linkedAt: isLinkingToExisting ? new Date() : null,
          linkedReason: isLinkingToExisting
            ? `Vinculado desde reporte rápido como duplicado de #${data.linkToOccurrenceId}`
            : null,
        },
        include: {
          machine: { select: { id: true, name: true, serialNumber: true } },
          reporter: { select: { id: true, name: true, email: true } },
        }
      });

      console.log('✅ Falla con cierre inmediato creada (sin OT):');
      console.log('   - FailureOccurrence ID:', occurrence.id);
      console.log('   - Solución:', data.immediateSolution || 'No especificada');

    } else {
      // ========== FALLA NORMAL: Crear WorkOrder + FailureOccurrence ==========
      // P0.2: Auto-OT title = "Solucionar — {FailureOccurrence.title}"
      const autoOTTitle = `Solucionar — ${data.title}`;

      // OT se crea sin asignar (PENDING), el supervisor asigna en el modal del frontend
      // Flujo: Crear falla → Modal de asignación → Supervisor asigna → OT queda PENDING con responsable

      workOrder = await prisma.workOrder.create({
        data: {
          title: autoOTTitle,
          description: data.description || `Falla reportada: ${data.title}`,
          type: 'CORRECTIVE',
          status: 'PENDING', // Siempre PENDING, el supervisor asigna en el frontend
          priority: priorityResult.priority === 'P1' ? 'URGENT' :
                    priorityResult.priority === 'P2' ? 'HIGH' :
                    priorityResult.priority === 'P3' ? 'MEDIUM' : 'LOW',
          origin: 'FAILURE',
          machineId: data.machineId,
          componentId: primaryComponentId,
          companyId,
          createdById: userId,
          assignedToId: null, // Sin asignar, el supervisor asigna en modal
          assignedAt: null,
          failureDescription: data.title,
          notes: additionalNotes.trim() || undefined,
          isSafetyRelated: data.isSafetyRelated || false,
        }
      });

      occurrence = await prisma.failureOccurrence.create({
        data: {
          failureId: workOrder.id, // WorkOrder asociado
          companyId,
          machineId: data.machineId,
          subcomponentId: primarySubcomponentId,
          affectedComponents: (data.componentIds?.length || data.subcomponentIds?.length)
            ? affectedComponentsData
            : undefined,
          title: data.title,
          description: data.description,
          failureCategory: data.failureCategory || 'MECANICA',
          priority: priorityResult.priority,
          isIntermittent: data.isIntermittent,
          isObservation: false,
          causedDowntime: data.causedDowntime,
          notes: additionalNotes.trim() || undefined,
          reportedBy: userId,
          reportedAt: new Date(),
          status: isLinkingToExisting ? 'RESOLVED' : 'OPEN',
          symptoms: data.symptomIds || [],
          photos: data.attachments && data.attachments.length > 0
            ? data.attachments.map((url: string) => ({ url, uploadedAt: new Date().toISOString() }))
            : undefined,
          isLinkedDuplicate: isLinkingToExisting,
          linkedToOccurrenceId: data.linkToOccurrenceId || null,
          linkedById: isLinkingToExisting ? userId : null,
          linkedAt: isLinkingToExisting ? new Date() : null,
          linkedReason: isLinkingToExisting
            ? `Vinculado desde reporte rápido como duplicado de #${data.linkToOccurrenceId}`
            : null,
        },
        include: {
          machine: { select: { id: true, name: true, serialNumber: true } },
          reporter: { select: { id: true, name: true, email: true } },
          linkedOccurrence: isLinkingToExisting ? {
            select: { id: true, title: true, status: true, priority: true }
          } : false,
        }
      });

      // Si causó downtime, iniciar registro automático
      if (data.causedDowntime) {
        try {
          downtimeLog = await handleDowntime({
            failureOccurrenceId: occurrence.id,
            workOrderId: workOrder.id,
            machineId: data.machineId,
            causedDowntime: true,
            companyId,
            category: 'UNPLANNED'
          });
          console.log('✅ DowntimeLog creado:', downtimeLog?.id);
        } catch (dtError: any) {
          console.error('⚠️ Error creando DowntimeLog (soft fail):', dtError.message);
          downtimeError = dtError.message;
        }
      }

      console.log('📋 Quick Report creado exitosamente:');
      console.log('   - WorkOrder ID:', workOrder.id);
    }
    console.log('   - FailureOccurrence ID:', occurrence.id);
    console.log('   - Máquina:', occurrence.machine?.name);
    console.log('   - Título:', occurrence.title);
    console.log('   - Prioridad:', occurrence.priority);
    console.log('   - CausedDowntime:', data.causedDowntime);
    console.log('   - DowntimeLog ID:', downtimeLog?.id || 'NO CREADO');
    if (downtimeError) {
      console.log('   - DowntimeLog Error:', downtimeError);
    }

    // 12. Notificaciones Discord (fire-and-forget)
    const sendDiscordNotifications = async () => {
      try {
        const machineWithSector = await prisma.machine.findUnique({
          where: { id: data.machineId },
          select: { sectorId: true }
        });

        if (!machineWithSector?.sectorId) return;

        // Solo notificar si no es duplicado vinculado
        if (!isLinkingToExisting) {
          await notifyNewFailure({
            id: occurrence.id,
            title: occurrence.title,
            machineName: occurrence.machine?.name || 'Sin máquina',
            machineId: data.machineId,
            sectorId: machineWithSector.sectorId,
            priority: priorityResult.priority,
            category: data.failureCategory,
            reportedBy: occurrence.reporter?.name || 'Usuario',
            causedDowntime: data.causedDowntime,
            description: data.description
          });

          // Si es P1, enviar DM a técnicos del sector
          if (priorityResult.priority === 'P1') {
            const sectorTechnicians = await prisma.user.findMany({
              where: {
                discordUserId: { not: null },
                isActive: true,
                companies: {
                  some: {
                    companyId,
                    role: {
                      OR: [
                        { name: { contains: 'Técnico', mode: 'insensitive' } },
                        { name: { contains: 'Tecnico', mode: 'insensitive' } },
                        { name: { contains: 'Mantenimiento', mode: 'insensitive' } },
                      ]
                    }
                  }
                },
                machinesTechnical: {
                  some: { sectorId: machineWithSector.sectorId }
                }
              },
              select: { id: true }
            });

            if (sectorTechnicians.length > 0) {
              await notifyP1ToSectorTechnicians({
                failureId: occurrence.id,
                title: occurrence.title,
                machineName: occurrence.machine?.name || 'Sin máquina',
                sectorId: machineWithSector.sectorId,
                category: data.failureCategory,
                reportedBy: occurrence.reporter?.name || 'Usuario',
                causedDowntime: data.causedDowntime,
                description: data.description
              }, sectorTechnicians.map(t => t.id));
            }
          }
        }
      } catch (discordError) {
        console.warn('⚠️ Error enviando notificación Discord:', discordError);
      }
    };
    sendDiscordNotifications().catch(() => {});

    // 13. Retornar resultado exitoso con toda la info
    return NextResponse.json({
      success: true,
      hasDuplicates: false, // Ya pasamos la verificación de duplicados
      wasLinkedToExisting: isLinkingToExisting,
      isObservation: data.isObservation || false,
      resolvedImmediately,
      occurrence: {
        ...occurrence,
        id: occurrence.id,
      },
      // Si fue vinculado, incluir info del caso principal
      linkedTo: isLinkingToExisting && occurrence.linkedOccurrence ? {
        id: occurrence.linkedOccurrence.id,
        title: occurrence.linkedOccurrence.title,
        status: occurrence.linkedOccurrence.status,
        priority: occurrence.linkedOccurrence.priority,
      } : null,
      // WorkOrder solo si NO es observación y NO fue cierre inmediato
      workOrder: workOrder ? {
        id: workOrder.id,
        title: workOrder.title,
        status: workOrder.status,
        priority: workOrder.priority,
        type: workOrder.type,
      } : null,
      downtimeLog: downtimeLog ? {
        id: downtimeLog.id,
        startedAt: downtimeLog.startedAt,
      } : null,
      // Warnings si algo falló parcialmente
      warnings: downtimeError ? [{
        type: 'DOWNTIME_CREATION_FAILED',
        message: 'El registro de downtime no pudo crearse. Ejecute la migración de BD.',
        detail: downtimeError
      }] : [],
      // Resumen de lo creado
      summary: {
        workOrderCreated: !!workOrder,
        occurrenceCreated: true,
        downtimeCreated: !!downtimeLog,
        linkedToExisting: isLinkingToExisting,
        isObservationOnly: data.isObservation || false,
        resolvedImmediately,
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Error en POST /api/failure-occurrences/quick-report:', error);
    return NextResponse.json(
      {
        error: 'Error al crear reporte rápido',
        detail: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }
}
