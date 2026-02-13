/**
 * API: /api/work-orders/[id]/qa
 *
 * GET - Obtener estado QA del workOrder
 * POST - Crear o iniciar QA
 * PATCH - Actualizar evidencia, aprobar o rechazar
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';
import { requiresQA, getCorrectiveSettings } from '@/lib/corrective/qa-rules';

export const dynamic = 'force-dynamic';

/**
 * Schema para actualizar QA
 */
const updateQASchema = z.object({
  // Actualizar estado
  status: z.enum(['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED']).optional(),

  // Notas del revisor
  notes: z.string().max(1000).optional(),

  // Checklist items completados
  checklist: z.array(z.object({
    id: z.string(),
    label: z.string(),
    checked: z.boolean(),
    notes: z.string().optional()
  })).optional(),

  // Evidencia
  evidenceProvided: z.array(z.object({
    url: z.string().url(),
    type: z.enum(['IMAGE', 'VIDEO', 'DOCUMENT']),
    filename: z.string(),
    description: z.string().optional()
  })).optional(),

  // Razón de rechazo
  rejectionReason: z.string().max(500).optional(),

  // Confirmar retorno a producción
  confirmReturnToProduction: z.boolean().optional(),
});

/**
 * GET /api/work-orders/[id]/qa
 * Obtiene estado QA del workOrder
 */
export async function GET(
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
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const workOrderId = parseInt(params.id);

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Obtener work order con QA y falla
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        qualityAssurance: {
          include: {
            verifiedBy: {
              select: { id: true, name: true, email: true }
            },
            returnConfirmedBy: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        failureOccurrences: {
          select: {
            id: true,
            priority: true,
            isSafetyRelated: true,
            causedDowntime: true
          },
          take: 1
        },
        machine: {
          select: { id: true, name: true, criticality: true }
        }
      }
    });

    if (!workOrder || workOrder.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Orden de trabajo no encontrada' },
        { status: 404 }
      );
    }

    // 3. Calcular si QA es requerido (si no existe aún)
    const failure = workOrder.failureOccurrences[0];
    let qaRequirement = null;

    if (!workOrder.qualityAssurance) {
      // Calcular downtime total si hay
      let downtimeMinutes = 0;
      if (failure?.causedDowntime) {
        const downtimes = await prisma.downtimeLog.findMany({
          where: { workOrderId, endedAt: { not: null } },
          select: { totalMinutes: true }
        });
        downtimeMinutes = downtimes.reduce((sum, d) => sum + (d.totalMinutes || 0), 0);
      }

      // Verificar reincidencia
      let isRecurrence = false;
      if (failure) {
        const settings = await getCorrectiveSettings(companyId);
        const windowDate = new Date();
        windowDate.setDate(windowDate.getDate() - settings.recurrenceWindowDays);

        const recentFailures = await prisma.failureOccurrence.count({
          where: {
            companyId,
            machineId: workOrder.machineId,
            id: { not: failure.id },
            reportedAt: { gte: windowDate },
            isLinkedDuplicate: false
          }
        });
        isRecurrence = recentFailures >= 2;
      }

      qaRequirement = await requiresQA({
        isSafetyRelated: failure?.isSafetyRelated || workOrder.isSafetyRelated || false,
        priority: (failure?.priority || workOrder.priority || 'P3') as 'P1' | 'P2' | 'P3' | 'P4',
        assetCriticality: (workOrder.machine?.criticality || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        causedDowntime: failure?.causedDowntime || false,
        downtimeMinutes,
        isRecurrence,
        recurrenceDays: isRecurrence ? 7 : undefined,
        companyId
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        workOrderId,
        qualityAssurance: workOrder.qualityAssurance,
        qaRequirement,
        failure: failure || null,
        machine: workOrder.machine
      }
    });

  } catch (error) {
    console.error('❌ Error en GET /api/work-orders/[id]/qa:', error);
    return NextResponse.json(
      { error: 'Error al obtener QA' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/work-orders/[id]/qa
 * Crear o iniciar QA
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
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Verificar que la orden existe
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        qualityAssurance: true,
        failureOccurrences: {
          select: {
            id: true,
            priority: true,
            isSafetyRelated: true,
            causedDowntime: true
          },
          take: 1
        },
        machine: {
          select: { criticality: true }
        }
      }
    });

    if (!workOrder || workOrder.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Orden de trabajo no encontrada' },
        { status: 404 }
      );
    }

    if (workOrder.qualityAssurance) {
      return NextResponse.json(
        { error: 'Ya existe un registro QA para esta orden' },
        { status: 400 }
      );
    }

    // 3. Calcular si QA es requerido
    const failure = workOrder.failureOccurrences[0];

    const qaRequirement = await requiresQA({
      isSafetyRelated: failure?.isSafetyRelated || workOrder.isSafetyRelated || false,
      priority: (failure?.priority || workOrder.priority || 'P3') as 'P1' | 'P2' | 'P3' | 'P4',
      assetCriticality: (workOrder.machine?.criticality || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      causedDowntime: failure?.causedDowntime || false,
      isRecurrence: false,
      companyId
    });

    // 4. Crear registro QA
    const qa = await prisma.qualityAssurance.create({
      data: {
        workOrderId,
        isRequired: qaRequirement.required,
        requiredReason: qaRequirement.reason || null,
        status: qaRequirement.required ? 'PENDING' : 'NOT_REQUIRED',
        evidenceRequired: qaRequirement.evidenceLevel
      }
    });

    return NextResponse.json({
      success: true,
      data: qa,
      message: qaRequirement.required
        ? `QA requerido: ${qaRequirement.reason}`
        : 'QA no requerido para esta orden'
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Error en POST /api/work-orders/[id]/qa:', error);
    return NextResponse.json(
      { error: 'Error al crear QA' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/work-orders/[id]/qa
 * Actualizar QA (evidencia, aprobar, rechazar)
 */
export async function PATCH(
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
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Parsear y validar body
    const body = await request.json();
    const validationResult = updateQASchema.safeParse(body);

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

    // 3. Verificar que existe QA
    const existingQA = await prisma.qualityAssurance.findUnique({
      where: { workOrderId },
      include: {
        workOrder: {
          select: { companyId: true }
        }
      }
    });

    if (!existingQA || existingQA.workOrder.companyId !== companyId) {
      return NextResponse.json(
        { error: 'QA no encontrado' },
        { status: 404 }
      );
    }

    // 4. Preparar datos de actualización
    const updateData: any = {};

    if (data.status) {
      updateData.status = data.status;

      if (data.status === 'APPROVED') {
        updateData.verifiedById = userId;
        updateData.verifiedAt = new Date();
      }
    }

    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    if (data.checklist) {
      updateData.checklist = JSON.stringify(data.checklist);
    }

    if (data.evidenceProvided) {
      updateData.evidenceProvided = JSON.stringify(data.evidenceProvided);
    }

    if (data.confirmReturnToProduction) {
      updateData.returnToProductionConfirmed = true;
      updateData.returnConfirmedById = userId;
      updateData.returnConfirmedAt = new Date();
    }

    // 5. Actualizar QA
    const updatedQA = await prisma.qualityAssurance.update({
      where: { workOrderId },
      data: updateData,
      include: {
        verifiedBy: {
          select: { id: true, name: true, email: true }
        },
        returnConfirmedBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedQA,
      message: data.status === 'APPROVED'
        ? 'QA aprobado exitosamente'
        : data.status === 'REJECTED'
        ? 'QA rechazado'
        : 'QA actualizado'
    });

  } catch (error) {
    console.error('❌ Error en PATCH /api/work-orders/[id]/qa:', error);
    return NextResponse.json(
      { error: 'Error al actualizar QA' },
      { status: 500 }
    );
  }
}
