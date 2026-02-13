import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret
import { deductSparePartsFromInventory } from '@/lib/corrective/inventory-integration';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener el usuario actual
async function getCurrentUser() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: { id: true, name: true, email: true, role: true }
    });
    return user;
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return null;
  }
}

// POST /api/work-orders/[id]/apply-solution
// Aplica una solución existente o crea una nueva para un WorkOrder PENDING
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const workOrderId = parseInt(params.id);
    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'ID de orden inválido' }, { status: 400 });
    }

    const body = await request.json();
    const {
      existingSolutionId, // ID de solución existente (si se selecciona una)
      newSolution,        // Datos de nueva solución (si se crea una)
      actualHours,        // Tiempo real de aplicación
      timeUnit = 'hours',
      notes,              // Notas específicas de esta aplicación
      effectiveness       // Efectividad en esta aplicación (1-5)
    } = body;

    console.log(`📝 POST /api/work-orders/${workOrderId}/apply-solution`);
    console.log(`🔍 Payload recibido:`, { existingSolutionId, hasNewSolution: !!newSolution, actualHours, timeUnit });

    // Obtener el WorkOrder
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        failureOccurrences: {
          include: {
            workOrder: true
          }
        }
      }
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });
    }

    // Verificar que sea CORRECTIVE y PENDING
    if (workOrder.type !== 'CORRECTIVE') {
      return NextResponse.json(
        { error: 'Solo se pueden aplicar soluciones a órdenes correctivas' },
        { status: 400 }
      );
    }

    if (workOrder.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'La orden ya no está pendiente' },
        { status: 400 }
      );
    }

    // Obtener la ocurrencia asociada (o crearla si no existe)
    let occurrence = workOrder.failureOccurrences?.[0];

    // Si no existe la ocurrencia, crearla (compatibilidad con WorkOrders legacy)
    if (!occurrence) {
      console.log(`⚠️ No se encontró FailureOccurrence para WorkOrder ${workOrderId}, creando una nueva...`);

      try {
        // Parsear notes para obtener información adicional
        let notes: any = {};
        try {
          notes = typeof workOrder.notes === 'string' ? JSON.parse(workOrder.notes) : workOrder.notes;
        } catch (e) {
          console.log('⚠️ Error parseando notes del WorkOrder');
        }

        occurrence = await (prisma as any).failureOccurrence.create({
          data: {
            failureId: workOrderId, // ID del WorkOrder
            failureTypeId: null, // No tenemos el tipo de falla
            machineId: workOrder.machineId,
            reportedBy: workOrder.createdById || user.id,
            title: workOrder.title,
            description: workOrder.description || '',
            failureCategory: notes?.failureCategory || 'MECANICA',
            priority: workOrder.priority,
            affectedComponents: notes?.affectedComponents || null,
            status: 'OPEN', // Se actualizará a RESOLVED después de aplicar la solución
            notes: notes?.notes || null,
            reportedAt: workOrder.createdAt || new Date(),
            resolvedAt: null // Se actualizará después de aplicar la solución
          }
        });

        console.log(`✅ FailureOccurrence creada: ${occurrence.id} para WorkOrder ${workOrderId}`);
      } catch (e) {
        console.error('❌ Error creando FailureOccurrence:', e);
        return NextResponse.json(
          { error: 'Error al crear la ocurrencia asociada: ' + (e as Error).message },
          { status: 500 }
        );
      }
    }

    let solutionId: number | undefined;
    let isNewSolution = false;
    let isLegacySolution = false;

    // Si se seleccionó una solución existente
    if (existingSolutionId !== undefined && existingSolutionId !== null) {
      console.log(`🔍 existingSolutionId recibido: ${existingSolutionId} (tipo: ${typeof existingSolutionId})`);

      // Detectar si es una solución legacy o de WorkOrder (formato "legacy-X" o "wo-X")
      if (typeof existingSolutionId === 'string' && (existingSolutionId.startsWith('legacy-') || existingSolutionId.startsWith('wo-'))) {
        console.log(`📝 Solución legacy/WorkOrder detectada: ${existingSolutionId}`);
        isLegacySolution = true;
        // No necesitamos verificar que exista en FailureSolution porque es legacy
        // Solo registraremos que se aplicó esta solución
      } else {
        // Es una solución real de FailureSolution
        solutionId = typeof existingSolutionId === 'number'
          ? existingSolutionId
          : parseInt(String(existingSolutionId));

        console.log(`🔍 solutionId parseado: ${solutionId} (isNaN: ${isNaN(solutionId)})`);

        // Validar que el ID sea un número válido
        if (isNaN(solutionId) || solutionId <= 0) {
          return NextResponse.json(
            { error: `ID de solución inválido: "${existingSolutionId}" (parseado como: ${solutionId})` },
            { status: 400 }
          );
        }

        console.log(`🔍 Verificando solución existente con ID ${solutionId}`);

        // Verificar que la solución existe
        const solution = await (prisma as any).failureSolution.findUnique({
          where: { id: solutionId }
        });

        if (!solution) {
          return NextResponse.json(
            { error: `Solución no encontrada con ID: ${solutionId}` },
            { status: 404 }
          );
        }

        console.log(`🔄 Aplicando solución existente ${solutionId} a WorkOrder ${workOrderId}`);
      }
    }
    // Si se está creando una nueva solución
    else if (newSolution) {
      const createdSolution = await prisma.failureSolution.create({
        data: {
          occurrenceId: occurrence.id,
          title: newSolution.title,
          description: newSolution.description,
          appliedById: user.id,
          appliedAt: new Date(),
          actualHours: actualHours ? parseFloat(actualHours) : null,
          timeUnit: timeUnit,
          toolsUsed: newSolution.toolsUsed || null,
          sparePartsUsed: newSolution.sparePartsUsed || null,
          rootCause: newSolution.rootCause || null,
          preventiveActions: newSolution.preventiveActions || null,
          attachments: newSolution.attachments || null,
          effectiveness: effectiveness ? parseInt(effectiveness) : null,
          isPreferred: false // No marcar como preferida automáticamente
        }
      });

      solutionId = createdSolution.id;
      isNewSolution = true;
      console.log(`✨ Nueva solución creada ${solutionId} para WorkOrder ${workOrderId}`);
    } else {
      return NextResponse.json(
        { error: 'Debe seleccionar una solución existente o crear una nueva' },
        { status: 400 }
      );
    }

    // Crear el registro de aplicación de solución (solo para soluciones reales, no legacy)
    let application: any = null;
    if (!isLegacySolution && solutionId) {
      application = await prisma.solutionApplication.create({
        data: {
          failureSolutionId: solutionId,
          workOrderId: workOrderId,
          occurrenceId: occurrence.id,
          appliedById: user.id,
          appliedAt: new Date(),
          actualHours: actualHours ? parseFloat(actualHours) : null,
          timeUnit: timeUnit,
          notes: notes || null,
          effectiveness: effectiveness ? parseInt(effectiveness) : null
        }
      });

      console.log(`✅ SolutionApplication creada: ${application.id}`);
    } else if (isLegacySolution) {
      console.log(`📝 Solución legacy aplicada, sin crear SolutionApplication`);
    }

    // Actualizar el WorkOrder a COMPLETED
    let actualHoursInHours = timeUnit === 'minutes'
      ? parseFloat(actualHours) / 60
      : parseFloat(actualHours);

    // Redondear a 2 decimales para evitar problemas de precisión de punto flotante
    actualHoursInHours = actualHoursInHours ? Math.round(actualHoursInHours * 100) / 100 : null;

    // Si es una nueva solución, actualizar también el título y descripción del WorkOrder
    const updateData: any = {
      status: 'COMPLETED',
      completedDate: new Date(),
      startedDate: workOrder.startedDate || new Date(),
      actualHours: actualHoursInHours
    };

    // Solo asignar si no tiene asignado (mantener el asignado original)
    if (!workOrder.assignedToId) {
      updateData.assignedToId = user.id;
      console.log(`👤 Asignando WorkOrder ${workOrderId} a usuario ${user.id} (${user.name})`);
    } else {
      console.log(`👤 Manteniendo asignado original de WorkOrder ${workOrderId}: ${workOrder.assignedToId}`);
    }

    // Si se creó una nueva solución, actualizar el WorkOrder con el título y descripción de la solución
    if (isNewSolution && newSolution) {
      updateData.title = newSolution.title;
      updateData.description = newSolution.description;
      console.log(`📝 Actualizando WorkOrder ${workOrderId} con título: "${newSolution.title}"`);
    }

    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: updateData
    });

    // Actualizar la ocurrencia a RESOLVED
    await prisma.failureOccurrence.update({
      where: { id: occurrence.id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date()
      }
    });

    console.log(`✅ WorkOrder ${workOrderId} marcada como COMPLETED`);

    // ✅ NUEVO: Descontar repuestos del inventario automáticamente
    let inventoryResult = null;
    const sparePartsToDeduct = newSolution?.sparePartsUsed;
    if (sparePartsToDeduct && Array.isArray(sparePartsToDeduct) && sparePartsToDeduct.length > 0) {
      try {
        inventoryResult = await deductSparePartsFromInventory(
          sparePartsToDeduct,
          workOrderId,
          user.id,
          workOrder.companyId
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
      message: isNewSolution
        ? 'Nueva solución creada y aplicada exitosamente'
        : isLegacySolution
        ? 'Solución legacy aplicada exitosamente'
        : 'Solución aplicada exitosamente',
      application: application ? {
        id: application.id,
        solutionId: solutionId,
        workOrderId: workOrderId,
        appliedAt: application.appliedAt,
        effectiveness: application.effectiveness
      } : {
        workOrderId: workOrderId,
        isLegacy: true
      },
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
    console.error('❌ Error en POST /api/work-orders/[id]/apply-solution:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
