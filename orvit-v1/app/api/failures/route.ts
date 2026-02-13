import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { triggerFailureReported, triggerWorkOrderCreated } from '@/lib/automation/engine';
import { validateRequest } from '@/lib/validations/helpers';
import { CreateFailureSchema } from '@/lib/validations/failures';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma en lugar de crear nueva

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔧 [API] Recibiendo datos de falla:', body);
    console.log('🔧 [API] Datos completos:', JSON.stringify(body, null, 2));

    const validation = validateRequest(CreateFailureSchema, body);
    if (!validation.success) {
      return validation.response;
    }

    const data = validation.data;

    // Obtener companyId y createdById (ya son números por z.coerce en el schema)
    const companyIdFromData = data.companyId ?? null;
    const createdByIdFromData = data.createdBy || data.createdById || null;

    console.log('🔧 [API] companyId from data:', companyIdFromData);
    console.log('🔧 [API] createdById from data:', createdByIdFromData);

    // Verificar que la máquina existe (machineId ya es number por z.coerce)
    const machine = await prisma.machine.findUnique({
      where: { id: data.machineId },
      select: { id: true, companyId: true }
    });

    if (!machine) {
      return NextResponse.json(
        { error: 'La máquina especificada no existe' },
        { status: 400 }
      );
    }

    console.log('🔧 [API] Máquina encontrada:', machine);

    // Usar el companyId de la máquina si no se proporciona uno válido
    const finalCompanyId = companyIdFromData ?? machine.companyId;
    console.log('🔧 [API] Final companyId:', finalCompanyId);

    // Verificar que el usuario existe o obtener el primero disponible
    // NOTA: createdById en WorkOrder es requerido (Int, no Int?)
    // Los usuarios están asociados a empresas via UserOnCompany
    let finalCreatedById: number;

    // Primero intentar usar el createdBy/createdById si existe
    if (createdByIdFromData) {
      const user = await prisma.user.findUnique({
        where: { id: createdByIdFromData }
      });
      if (user) {
        finalCreatedById = user.id;
      } else {
        console.log('🔧 [API] Usuario especificado no existe, buscando usuario alternativo via UserOnCompany');
        // Buscar usuario via UserOnCompany
        const userOnCompany = await prisma.userOnCompany.findFirst({
          where: { companyId: finalCompanyId, isActive: true },
          select: { userId: true }
        });
        if (!userOnCompany) {
          return NextResponse.json(
            { error: 'No se encontró un usuario válido para asignar como creador' },
            { status: 400 }
          );
        }
        finalCreatedById = userOnCompany.userId;
      }
    } else {
      // Si no hay createdById válido, buscar cualquier usuario de la empresa via UserOnCompany
      const userOnCompany = await prisma.userOnCompany.findFirst({
        where: { companyId: finalCompanyId, isActive: true },
        select: { userId: true }
      });
      if (!userOnCompany) {
        return NextResponse.json(
          { error: 'No se encontró un usuario válido para asignar como creador' },
          { status: 400 }
        );
      }
      finalCreatedById = userOnCompany.userId;
    }

    console.log('🔧 [API] Final createdById:', finalCreatedById);

    // ✅ Obtener nombres de componentes afectados (ya son numbers por z.coerce)
    const componentIds = data.selectedComponents || [];

    let componentNames: string[] = [];
    if (componentIds.length > 0) {
      const components = await prisma.component.findMany({
        where: { id: { in: componentIds } },
        select: { id: true, name: true }
      });
      // Mantener el orden de los IDs originales
      componentNames = componentIds.map((id: number) => {
        const comp = components.find(c => c.id === id);
        return comp?.name || `Componente ${id}`;
      });
    }

    console.log('🔧 [API] Componentes afectados:', { componentIds, componentNames });

    // Transacción atómica: crear WorkOrder + FailureOccurrence
    const { result, failureOccurrence } = await prisma.$transaction(async (tx) => {
      // 1. Crear la falla como WorkOrder
      const workOrder = await tx.workOrder.create({
        data: {
          title: data.title,
          description: data.description || '',
          type: 'CORRECTIVE',
          priority: data.priority || 'MEDIUM',
          estimatedHours: data.estimatedHours || 0,
          machineId: data.machineId,
          status: 'PENDING',
          companyId: finalCompanyId,
          createdById: finalCreatedById,
          notes: JSON.stringify({
            failureType: data.failureType || 'MECANICA',
            affectedComponents: componentIds,
            componentNames: componentNames,
            attachments: data.failureAttachments?.map((file: any) => file.name || file) || [],
            reportedDate: data.reportedDate ? new Date(data.reportedDate).toISOString() : new Date().toISOString(),
            timeUnit: data.timeUnit || 'hours',
            estimatedTime: data.estimatedHours || 0,
            reportedById: data.createdById || null,
            reportedByName: data.createdByName || null
          })
        }
      });

      console.log('✅ [API] WorkOrder de falla creado:', workOrder.id);

      // 2. Crear FailureOccurrence asociada al WorkOrder
      const occurrence = await tx.failureOccurrence.create({
        data: {
          failureId: workOrder.id,
          failureTypeId: data.failureTypeId ?? null,
          machineId: data.machineId,
          companyId: finalCompanyId,
          reportedBy: finalCreatedById,
          reportedAt: data.reportedDate ? new Date(data.reportedDate) : new Date(),
          title: data.title,
          description: data.description || null,
          failureCategory: data.failureType || 'MECANICA',
          priority: data.priority || 'MEDIUM',
          affectedComponents: componentIds.length > 0 ? componentIds : null,
          status: 'OPEN',
          notes: null
        }
      });

      console.log('✅ [API] FailureOccurrence creada:', occurrence.id);

      return { result: workOrder, failureOccurrence: occurrence };
    });

    // Si se proporcionó un failureTypeId, crear/verificar el tipo de falla en el catálogo
    if (data.failureTypeId) {
      console.log('✅ [API] Falla vinculada a tipo de falla del catálogo:', data.failureTypeId);
    } else if (data.addToCatalog) {
      // Opcionalmente agregar esta falla al catálogo de tipos
      try {
        const existingType = await prisma.failure.findFirst({
          where: {
            title: { equals: data.title, mode: 'insensitive' },
            machine_id: data.machineId
          }
        });

        if (!existingType) {
          const newType = await prisma.failure.create({
            data: {
              title: data.title,
              description: data.description || null,
              machine_id: data.machineId,
              companyId: finalCompanyId,
              failure_type: data.failureType || 'MECANICA',
              priority: data.priority || 'MEDIUM',
              estimated_hours: data.estimatedHours ?? null,
              affected_components: componentIds.length > 0 ? componentIds : null,
              isActive: true,
              status: 'ACTIVE'
            }
          });
          console.log('✅ [API] Nuevo tipo de falla agregado al catálogo:', newType.id);

          // Actualizar la ocurrencia con el tipo de falla creado
          if (failureOccurrence) {
            await prisma.failureOccurrence.update({
              where: { id: failureOccurrence.id },
              data: { failureTypeId: newType.id }
            });
          }
        }
      } catch (catalogError) {
        console.error('⚠️ [API] Error agregando al catálogo (no crítico):', catalogError);
      }
    }

    console.log('✅ [API] Falla creada exitosamente:', result);

    // Procesar automatizaciones
    try {
      // Trigger de falla reportada
      if (failureOccurrence) {
        await triggerFailureReported(
          finalCompanyId,
          { ...failureOccurrence, machine: { id: data.machineId } } as unknown as Record<string, unknown>,
          finalCreatedById
        );
      }
      // Trigger de OT creada (ya que la falla crea un WorkOrder)
      await triggerWorkOrderCreated(
        finalCompanyId,
        result as unknown as Record<string, unknown>,
        finalCreatedById
      );
    } catch (automationError) {
      console.error('Error procesando automatizaciones:', automationError);
      // No fallar la creación si fallan las automatizaciones
    }

    return NextResponse.json({
      success: true,
      failure: result,
      id: result.id,
      occurrenceId: failureOccurrence?.id || null
    });

  } catch (error) {
    console.error('❌ [API] Error al crear falla:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al crear la falla: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get('machineId');
    const companyId = searchParams.get('companyId');

    console.log('🔍 [API GET /failures] Parámetros:', { machineId, companyId });

    let whereClause: any = {
      type: 'CORRECTIVE' // Solo fallas (mantenimientos correctivos)
    };

    if (machineId) {
      whereClause.machineId = parseInt(machineId);
    }

    if (companyId) {
      whereClause.companyId = parseInt(companyId);
    }

    console.log('🔍 [API GET /failures] Where clause:', whereClause);

    const workOrders = await prisma.workOrder.findMany({
      where: whereClause,
      include: {
        machine: {
          select: {
            id: true,
            name: true
          }
        },
        component: {
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
      }
    });

    console.log('🔍 [API GET /failures] Work orders encontrados:', workOrders.length);

    // Transformar WorkOrders al formato esperado por el frontend
    // ✅ FILTRAR: Excluir los WorkOrders que son soluciones de ocurrencia (no son fallas, son mantenimientos)
    const filteredWorkOrders = workOrders.filter(wo => {
      try {
        if (wo.notes) {
          const notesData = JSON.parse(wo.notes);
          if (notesData.isOccurrenceSolution === true) {
            return false;
          }
        }
      } catch (e) {}
      return true;
    });

    // ✅ Recolectar todos los IDs de componentes que necesitan nombres
    const allComponentIds = new Set<number>();
    for (const wo of filteredWorkOrders) {
      try {
        if (wo.notes) {
          const notesData = JSON.parse(wo.notes);
          const ids = notesData.affectedComponents || [];
          // Si hay IDs pero no hay nombres, necesitamos buscarlos
          if (ids.length > 0 && (!notesData.componentNames || notesData.componentNames.length === 0)) {
            ids.forEach((id: number) => allComponentIds.add(id));
          }
        }
      } catch (e) {}
    }

    // ✅ Buscar nombres de componentes en la base de datos (una sola query)
    let componentNamesMap: Map<number, string> = new Map();
    if (allComponentIds.size > 0) {
      const components = await prisma.component.findMany({
        where: { id: { in: Array.from(allComponentIds) } },
        select: { id: true, name: true }
      });
      components.forEach(c => componentNamesMap.set(c.id, c.name));
      console.log(`🔍 [API GET /failures] Fetched ${components.length} component names from DB`);
    }

    // ✅ Mapear los WorkOrders con los nombres de componentes
    const failures = filteredWorkOrders.map(wo => {
      let additionalData: any = {};
      try {
        if (wo.notes) {
          additionalData = JSON.parse(wo.notes);
        }
      } catch (e) {
        additionalData = { notes: wo.notes };
      }

      // Obtener nombres de componentes: primero de notes, luego de DB
      let componentNames = additionalData.componentNames || [];
      const affectedComponents = additionalData.affectedComponents || [];

      // Si no hay nombres pero sí hay IDs, buscar en el mapa
      if (componentNames.length === 0 && affectedComponents.length > 0) {
        componentNames = affectedComponents.map((id: number) =>
          componentNamesMap.get(id) || `Componente ${id}`
        );
      }

      return {
        id: wo.id,
        title: wo.title,
        description: wo.description || '',
        machineId: wo.machineId,
        machineName: wo.machine?.name || '',
        componentId: wo.componentId || affectedComponents[0] || null,
        componentName: wo.component?.name || 'General',
        status: wo.status,
        priority: wo.priority,
        failureType: additionalData.failureType || 'MECANICA',
        reportedDate: additionalData.reportedDate || wo.createdAt?.toISOString(),
        estimatedHours: wo.estimatedHours || 0,
        actualHours: wo.actualHours || 0,
        downtime: wo.actualHours || 0,
        affectedComponents: affectedComponents,
        componentNames: componentNames, // ✅ Nombres de componentes (de notes o de DB)
        attachments: additionalData.attachments || [],
        tags: additionalData.tags || [],
        solution: wo.solution || additionalData.solution || '',
        rootCause: wo.rootCause || additionalData.rootCause || '',
        assignedTo: wo.assignedTo,
        createdAt: wo.createdAt,
        updatedAt: wo.updatedAt,
        completedDate: wo.completedDate,
        // ✅ Campos de tiempo con unidad
        timeUnit: additionalData.timeUnit || 'hours',
        timeValue: additionalData.estimatedTime || wo.estimatedHours || 0,
        // ✅ Campos del reportador
        reportedById: additionalData.reportedById || null,
        reportedByName: additionalData.reportedByName || null,
        // Campos adicionales del WorkOrder
        notes: typeof wo.notes === 'string' && !additionalData.failureType ? wo.notes : additionalData.notes || ''
      };
    });

    console.log('✅ [API GET /failures] Fallas procesadas:', failures.length);

    return NextResponse.json({
      success: true,
      failures
    });

  } catch (error) {
    console.error('❌ [API] Error al obtener fallas:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al obtener las fallas' },
      { status: 500 }
    );
  }
}