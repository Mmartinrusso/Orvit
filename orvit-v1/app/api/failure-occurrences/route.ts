/**
 * API: /api/failure-occurrences
 *
 * GET - Lista de ocurrencias de fallas (con filtros y paginación)
 * POST - Crear nueva ocurrencia de falla
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';
import { calculatePriority } from '@/lib/corrective/priority-calculator';
import { detectDuplicates } from '@/lib/corrective/duplicate-detector';
import { expandSymptoms } from '@/lib/corrective/symptoms';
import { findSimilarSolutions } from '@/lib/corrective/solution-history';
import { notifyNewFailure, notifyP1ToSectorTechnicians } from '@/lib/discord/notifications';

export const dynamic = 'force-dynamic';

/**
 * Schema de validación para POST (crear falla)
 */
const createFailureOccurrenceSchema = z.object({
  // Identificación (OBLIGATORIO)
  machineId: z.number().int().positive('machineId es obligatorio'),
  componentId: z.number().int().positive().optional(),
  subcomponentId: z.number().int().positive().optional(),

  // Descripción (OBLIGATORIO)
  title: z.string().min(3, 'title debe tener al menos 3 caracteres').max(255),
  description: z.string().optional(),

  // Síntomas (OPCIONAL)
  symptoms: z.array(z.number().int().positive()).optional().default([]),

  // Tipo de falla (OPCIONAL con defaults)
  failureCategory: z.enum(['MECANICA', 'ELECTRICA', 'HIDRAULICA', 'NEUMATICA', 'OTRA']).optional().default('MECANICA'),

  // Prioridad (OPCIONAL - se auto-calcula si no se provee)
  priority: z.enum(['P1', 'P2', 'P3', 'P4']).optional(),

  // Flags (OPCIONAL)
  isIntermittent: z.boolean().optional().default(false),
  isObservation: z.boolean().optional().default(false),
  causedDowntime: z.boolean().optional().default(false),

  // Componentes afectados (OPCIONAL)
  affectedComponents: z.array(z.object({
    componentId: z.number().int().positive(),
    subcomponentId: z.number().int().positive().optional(),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional()
  })).optional(),

  // Notas adicionales (OPCIONAL)
  notes: z.string().optional(),

  // Adjuntos (OPCIONAL)
  attachments: z.array(z.object({
    url: z.string().url(),
    type: z.enum(['IMAGE', 'VIDEO', 'DOCUMENT']),
    filename: z.string()
  })).optional(),
});

/**
 * GET /api/failure-occurrences
 * Lista de ocurrencias de fallas con filtros y paginación
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;

    // 2. Parsear query params
    const searchParams = request.nextUrl.searchParams;

    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    const status = searchParams.get('status'); // REPORTED, IN_PROGRESS, RESOLVED, etc. (comma-separated)
    const machineId = searchParams.get('machineId');
    const priority = searchParams.get('priority'); // comma-separated
    const causedDowntime = searchParams.get('causedDowntime');
    const isIntermittent = searchParams.get('isIntermittent');
    const isObservation = searchParams.get('isObservation');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const componentId = searchParams.get('componentId');
    const reportedById = searchParams.get('reportedById');
    const hasWorkOrder = searchParams.get('hasWorkOrder');
    const hasDuplicates = searchParams.get('hasDuplicates');
    const isLinkedDuplicate = searchParams.get('isLinkedDuplicate');

    // 3. Construir where clause
    const where: any = {
      companyId,
      // Por defecto solo casos principales, pero permite filtrar duplicados si se pide explícitamente
      isLinkedDuplicate: isLinkedDuplicate === 'true' ? true : false,
    };

    // Status (supports comma-separated values)
    if (status) {
      const statusArray = status.split(',').filter(Boolean);
      if (statusArray.length === 1) {
        where.status = statusArray[0];
      } else if (statusArray.length > 1) {
        where.status = { in: statusArray };
      }
    }

    if (machineId) {
      where.machineId = parseInt(machineId);
    }

    // Priority (supports comma-separated values)
    if (priority) {
      const priorityArray = priority.split(',').filter(Boolean);
      if (priorityArray.length === 1) {
        where.priority = priorityArray[0];
      } else if (priorityArray.length > 1) {
        where.priority = { in: priorityArray };
      }
    }

    if (causedDowntime === 'true') {
      where.causedDowntime = true;
    }

    if (isIntermittent === 'true') {
      where.isIntermittent = true;
    }

    if (isObservation === 'true') {
      where.isObservation = true;
    } else if (isObservation === 'false') {
      where.isObservation = false;
    }

    // Date range
    if (dateFrom || dateTo) {
      where.reportedAt = {};
      if (dateFrom) {
        where.reportedAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Add 1 day to include the entire end date
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        where.reportedAt.lte = endDate;
      }
    }

    // Component filter (check in affectedComponents JSON)
    if (componentId) {
      // For now, filter by workOrder.componentId since affectedComponents is JSON
      where.workOrder = {
        componentId: parseInt(componentId),
      };
    }

    // Reported by
    if (reportedById) {
      where.reportedBy = parseInt(reportedById);
    }

    // Has work order
    if (hasWorkOrder === 'true') {
      where.workOrder = { isNot: null };
    } else if (hasWorkOrder === 'false') {
      where.workOrder = null;
    }

    // Has duplicates
    if (hasDuplicates === 'true') {
      where.linkedDuplicates = { some: {} };
    } else if (hasDuplicates === 'false') {
      where.linkedDuplicates = { none: {} };
    }

    // Search (title, description, notes)
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 4. Obtener total count (para paginación)
    const totalCount = await prisma.failureOccurrence.count({ where });

    // 5. Obtener ocurrencias con relaciones
    const occurrences = await prisma.failureOccurrence.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { reportedAt: 'desc' },
      include: {
        machine: {
          select: { id: true, name: true, serialNumber: true }
        },
        reporter: {
          select: { id: true, name: true, email: true }
        },
        workOrder: {
          select: {
            id: true,
            status: true,
            assignedToId: true,
            isSafetyRelated: true,
            componentId: true,
            component: {
              select: { id: true, name: true }
            },
            assignedTo: {
              select: { id: true, name: true }
            }
          }
        },
        linkedDuplicates: {
          select: { id: true, reportedAt: true, reporter: { select: { name: true } } }
        }
      }
    });

    // 6. Obtener IDs de componentes para resolver nombres
    const allComponentIds = new Set<number>();
    const allSubcomponentIds = new Set<number>();

    occurrences.forEach((occ: any) => {
      if (occ.affectedComponents) {
        const affected = typeof occ.affectedComponents === 'string'
          ? JSON.parse(occ.affectedComponents)
          : occ.affectedComponents;

        if (Array.isArray(affected)) {
          // Formato antiguo: array de IDs
          affected.forEach((id: number) => allComponentIds.add(id));
        } else if (affected.componentIds || affected.subcomponentIds) {
          // Formato nuevo: { componentIds: [], subcomponentIds: [] }
          (affected.componentIds || []).forEach((id: number) => allComponentIds.add(id));
          (affected.subcomponentIds || []).forEach((id: number) => allSubcomponentIds.add(id));
        }
      }
    });

    // 7. Resolver nombres de componentes y subcomponentes en UNA SOLA query
    const componentsMap = new Map<number, { id: number; name: string }>();
    const subcomponentsMap = new Map<number, { id: number; name: string; parentId?: number | null }>();

    // ✅ OPTIMIZADO: Una sola query para ambos tipos
    const allIds = new Set([...allComponentIds, ...allSubcomponentIds]);
    if (allIds.size > 0) {
      const allComponents = await prisma.component.findMany({
        where: { id: { in: Array.from(allIds) } },
        select: { id: true, name: true, parentId: true }
      });

      for (const c of allComponents) {
        if (allComponentIds.has(c.id)) {
          componentsMap.set(c.id, { id: c.id, name: c.name });
        }
        if (allSubcomponentIds.has(c.id)) {
          subcomponentsMap.set(c.id, { id: c.id, name: c.name, parentId: c.parentId });
        }
      }
    }

    // 8. Transformar respuesta para incluir datos anidados de forma plana
    const transformedOccurrences = occurrences.map((occ: any) => {
      // Parsear affectedComponents
      let components: { id: number; name: string }[] = [];
      let subcomponents: { id: number; name: string }[] = [];

      if (occ.affectedComponents) {
        const affected = typeof occ.affectedComponents === 'string'
          ? JSON.parse(occ.affectedComponents)
          : occ.affectedComponents;

        if (Array.isArray(affected)) {
          // Formato antiguo: array de IDs (solo componentes)
          components = affected
            .map((id: number) => componentsMap.get(id))
            .filter(Boolean) as { id: number; name: string }[];
        } else if (affected.componentIds || affected.subcomponentIds) {
          // Formato nuevo
          components = (affected.componentIds || [])
            .map((id: number) => componentsMap.get(id))
            .filter(Boolean) as { id: number; name: string }[];
          subcomponents = (affected.subcomponentIds || [])
            .map((id: number) => subcomponentsMap.get(id))
            .filter(Boolean) as { id: number; name: string }[];
        }
      }

      // Expandir síntomas
      const symptomsArray = Array.isArray(occ.symptoms) ? occ.symptoms : [];
      const symptomsList = expandSymptoms(symptomsArray);

      return {
        ...occ,
        // Componente principal viene del WorkOrder
        component: occ.workOrder?.component || (components.length > 0 ? components[0] : null),
        // Lista expandida de componentes y subcomponentes afectados
        affectedComponentsList: components,
        affectedSubcomponentsList: subcomponents,
        // Síntomas expandidos con labels
        symptomsList,
        // isSafetyRelated viene del WorkOrder
        isSafetyRelated: occ.workOrder?.isSafetyRelated || false,
        // Wrap workOrder en array
        workOrders: occ.workOrder ? [occ.workOrder] : [],
      };
    });

    return NextResponse.json({
      data: transformedOccurrences,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Error en GET /api/failure-occurrences:', error);
    // Si es error de columna/tabla no existente, retornar lista vacía
    if (error?.code === 'P2010' || error?.code === 'P2022' || error?.message?.includes('column') || error?.message?.includes('does not exist') || error?.message?.includes('relation')) {
      console.warn('⚠️ Schema desactualizado para failure_occurrences. Ejecutar: npx prisma db push');
      return NextResponse.json({
        data: [],
        pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
        _warning: 'Schema desactualizado - ejecutar: npx prisma db push'
      });
    }
    return NextResponse.json(
      { error: 'Error al obtener ocurrencias de fallas', detail: error?.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/failure-occurrences
 * Crear nueva ocurrencia de falla
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
    const validationResult = createFailureOccurrenceSchema.safeParse(body);

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

    // 3. Auto-calcular prioridad si no se provee
    let priority = data.priority;

    // Obtener info de máquina para calcular prioridad
    const machine = await prisma.machine.findUnique({
      where: { id: data.machineId },
      select: {
        criticality: true,
        name: true
      }
    });

    if (!priority) {
      const assetCriticality = machine?.criticality as any;

      priority = calculatePriority({
        assetCriticality,
        causedDowntime: data.causedDowntime,
        isIntermittent: data.isIntermittent,
        isSafetyRelated: false, // Se puede agregar después
        isObservation: data.isObservation
      });
    }

    // 4. Crear FailureOccurrence
    const occurrence = await prisma.failureOccurrence.create({
      data: {
        companyId,
        machineId: data.machineId,
        componentId: data.componentId,
        subcomponentId: data.subcomponentId,
        title: data.title,
        description: data.description,
        failureCategory: data.failureCategory,
        priority,
        isIntermittent: data.isIntermittent,
        isObservation: data.isObservation,
        causedDowntime: data.causedDowntime,
        affectedComponents: data.affectedComponents ? JSON.stringify(data.affectedComponents) : null,
        notes: data.notes,
        reportedBy: userId,
        reportedAt: new Date(),
        status: 'OPEN', // ✅ Usar OPEN según schema (no REPORTED)
        symptoms: data.symptoms.length > 0 ? JSON.stringify(data.symptoms) : null,
      },
      include: {
        machine: { select: { id: true, name: true, assetCode: true } },
        component: { select: { id: true, name: true } },
        subcomponent: { select: { id: true, name: true } },
        reportedByUser: { select: { id: true, name: true, email: true } }
      }
    });

    // 5. Detectar duplicados y buscar soluciones similares en paralelo
    const [duplicates, suggestedSolutions] = await Promise.all([
      detectDuplicates({
        machineId: data.machineId,
        componentId: data.componentId,
        subcomponentId: data.subcomponentId,
        title: data.title,
        symptomIds: data.symptoms,
        companyId
      }),
      // ✅ NUEVO: Auto-sugerir soluciones previas exitosas
      findSimilarSolutions({
        companyId,
        machineId: data.machineId,
        componentId: data.componentId,
        subcomponentId: data.subcomponentId,
        title: data.title,
        description: data.description,
        limit: 3
      }).catch(() => []) // Si falla, retornar array vacío
    ]);

    // ✅ OPTIMIZADO: Notificaciones Discord en background (fire-and-forget)
    // No bloquean la respuesta al usuario
    const sendDiscordNotifications = async () => {
      try {
        // Obtener sectorId de la máquina
        const machineWithSector = await prisma.machine.findUnique({
          where: { id: data.machineId },
          select: { sectorId: true }
        });

        if (machineWithSector?.sectorId) {
          // Notificar al canal #fallas
          await notifyNewFailure({
            id: occurrence.id,
            title: occurrence.title,
            machineName: occurrence.machine?.name || 'Sin máquina',
            machineId: occurrence.machine?.id || data.machineId,
            sectorId: machineWithSector.sectorId,
            priority: priority || 'P3',
            category: data.failureCategory,
            component: occurrence.component?.name,
            subComponent: occurrence.subcomponent?.name,
            reportedBy: occurrence.reportedByUser?.name || 'Usuario',
            causedDowntime: data.causedDowntime,
            description: data.description
          });

          // Si es P1, enviar DM a técnicos del sector
          if (priority === 'P1') {
            const sectorTechnicians = await prisma.user.findMany({
              where: {
                discordUserId: { not: null },
                isActive: true,
                companies: {
                  some: {
                    companyId: companyId,
                    role: {
                      OR: [
                        { name: { contains: 'Técnico', mode: 'insensitive' } },
                        { name: { contains: 'Tecnico', mode: 'insensitive' } },
                        { name: { contains: 'Mantenimiento', mode: 'insensitive' } },
                        { name: { contains: 'Operador', mode: 'insensitive' } }
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
              const techIds = sectorTechnicians.map(t => t.id);
              const dmResult = await notifyP1ToSectorTechnicians({
                failureId: occurrence.id,
                title: occurrence.title,
                machineName: occurrence.machine?.name || 'Sin máquina',
                sectorId: machineWithSector.sectorId,
                category: data.failureCategory,
                reportedBy: occurrence.reportedByUser?.name || 'Usuario',
                causedDowntime: data.causedDowntime,
                description: data.description
              }, techIds);

              console.log(`📢 P1 DM enviado a ${dmResult.sent} técnicos (${dmResult.failed} fallos)`);
            }
          }
        }
      } catch (discordError: any) {
        console.error('⚠️ Error enviando notificación Discord:', discordError?.message || discordError);
      }
    };

    // Fire-and-forget: no esperamos a que termine
    sendDiscordNotifications().catch(() => {});

    return NextResponse.json({
      occurrence,
      duplicates: duplicates.length > 0 ? duplicates : undefined,
      // ✅ NUEVO: Soluciones sugeridas basadas en historial exitoso
      suggestedSolutions: suggestedSolutions.length > 0 ? suggestedSolutions : undefined
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Error en POST /api/failure-occurrences:', error);
    return NextResponse.json(
      { error: 'Error al crear ocurrencia de falla', detail: error?.message, code: error?.code },
      { status: 500 }
    );
  }
}
