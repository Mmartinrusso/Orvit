/**
 * API: /api/work-orders/[id]/rca
 *
 * GET  - Obtener RCA (Root Cause Analysis) de una OT
 * POST - Crear/Actualizar RCA con metodología 5-Whys
 *
 * P5.2: Root Cause Analysis (5-Whys)
 *
 * Estructura de whys:
 * [
 *   { level: 1, question: "¿Por qué falló?", answer: "Porque se recalentó" },
 *   { level: 2, question: "¿Por qué se recalentó?", answer: "Falta de lubricación" },
 *   ...
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Schema para un "Why" individual
 */
const whySchema = z.object({
  level: z.number().int().min(1).max(5),
  question: z.string().min(1),
  answer: z.string().min(1)
});

/**
 * Schema para crear/actualizar RCA
 */
const rcaSchema = z.object({
  whys: z.array(whySchema).min(1).max(5),
  rootCause: z.string().optional(),
  conclusion: z.string().optional(),
  correctiveActions: z.array(z.object({
    action: z.string(),
    responsible: z.string().optional(),
    responsibleId: z.number().int().positive().optional(),
    dueDate: z.string().datetime().optional(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).default('PENDING')
  })).optional(),
  status: z.enum(['DRAFT', 'COMPLETED', 'REVIEWED']).default('DRAFT')
});

/**
 * GET /api/work-orders/[id]/rca
 * Obtener RCA de una WorkOrder
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
      return NextResponse.json(
        { error: 'ID de orden inválido' },
        { status: 400 }
      );
    }

    // Verificar que la OT existe
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId },
      select: {
        id: true,
        title: true,
        status: true,
        failureOccurrences: {
          select: { id: true, title: true }
        }
      }
    });

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Orden de trabajo no encontrada' },
        { status: 404 }
      );
    }

    // Buscar RCA existente
    const rca = await prisma.rootCauseAnalysis.findFirst({
      where: { workOrderId, companyId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } }
      }
    });

    if (!rca) {
      return NextResponse.json({
        exists: false,
        workOrder: {
          id: workOrder.id,
          title: workOrder.title,
          failureOccurrences: workOrder.failureOccurrences
        },
        rca: null,
        // Template vacío para iniciar
        template: {
          whys: [
            { level: 1, question: '¿Por qué ocurrió la falla?', answer: '' },
            { level: 2, question: '¿Por qué?', answer: '' },
            { level: 3, question: '¿Por qué?', answer: '' },
            { level: 4, question: '¿Por qué?', answer: '' },
            { level: 5, question: '¿Por qué? (Causa raíz)', answer: '' }
          ],
          rootCause: '',
          conclusion: '',
          correctiveActions: [],
          status: 'DRAFT'
        }
      });
    }

    return NextResponse.json({
      exists: true,
      workOrder: {
        id: workOrder.id,
        title: workOrder.title,
        failureOccurrences: workOrder.failureOccurrences
      },
      rca: {
        id: rca.id,
        whys: rca.whys,
        rootCause: rca.rootCause,
        conclusion: rca.conclusion,
        correctiveActions: rca.correctiveActions,
        status: rca.status,
        createdBy: rca.createdBy,
        createdAt: rca.createdAt,
        updatedAt: rca.updatedAt
      }
    });

  } catch (error: any) {
    console.error('❌ Error en GET /api/work-orders/[id]/rca:', error);
    return NextResponse.json(
      { error: 'Error al obtener RCA', detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/work-orders/[id]/rca
 * Crear o actualizar RCA
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
      return NextResponse.json(
        { error: 'ID de orden inválido' },
        { status: 400 }
      );
    }

    // Parsear y validar body
    const body = await request.json();
    const validationResult = rcaSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return NextResponse.json(
        { error: `Validación falló: ${errors}` },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Verificar que la OT existe
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId },
      include: {
        failureOccurrences: { select: { id: true } }
      }
    });

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Orden de trabajo no encontrada' },
        { status: 404 }
      );
    }

    // Buscar RCA existente
    const existingRca = await prisma.rootCauseAnalysis.findFirst({
      where: { workOrderId, companyId }
    });

    // Si existe RCA y está REVIEWED, no permitir modificar
    if (existingRca && existingRca.status === 'REVIEWED') {
      return NextResponse.json(
        { error: 'El RCA ya fue revisado y no puede modificarse' },
        { status: 400 }
      );
    }

    // Determinar causa raíz del último "Why" si no se proporciona explícitamente
    let rootCause = data.rootCause;
    if (!rootCause && data.whys.length > 0) {
      const lastWhy = data.whys[data.whys.length - 1];
      rootCause = lastWhy.answer;
    }

    // Crear o actualizar RCA (transacción)
    const result = await prisma.$transaction(async (tx) => {
      let rca;

      if (existingRca) {
        // Actualizar
        rca = await tx.rootCauseAnalysis.update({
          where: { id: existingRca.id },
          data: {
            whys: data.whys,
            rootCause,
            conclusion: data.conclusion,
            correctiveActions: data.correctiveActions,
            status: data.status
          },
          include: {
            createdBy: { select: { id: true, name: true } }
          }
        });
      } else {
        // Crear nuevo
        const failureOccurrenceId = workOrder.failureOccurrences.length > 0
          ? workOrder.failureOccurrences[0].id
          : null;

        rca = await tx.rootCauseAnalysis.create({
          data: {
            companyId,
            workOrderId,
            failureOccurrenceId,
            whys: data.whys,
            rootCause,
            conclusion: data.conclusion,
            correctiveActions: data.correctiveActions,
            status: data.status,
            createdById: userId
          },
          include: {
            createdBy: { select: { id: true, name: true } }
          }
        });
      }

      // Registrar en timeline
      try {
        await tx.activityEvent.create({
          data: {
            companyId,
            eventType: existingRca ? 'RCA_UPDATED' : 'RCA_CREATED',
            entityType: 'WORK_ORDER',
            entityId: workOrderId,
            newValue: rca.status,
            metadata: {
              rcaId: rca.id,
              whysCount: data.whys.length,
              hasRootCause: !!rootCause,
              hasConclusion: !!data.conclusion,
              correctiveActionsCount: data.correctiveActions?.length || 0
            },
            performedById: userId
          }
        });
      } catch (e) {
        console.warn('⚠️ No se pudo crear ActivityEvent');
      }

      return { rca, isNew: !existingRca };
    });

    console.log(`✅ RCA ${result.isNew ? 'creado' : 'actualizado'}: ID ${result.rca.id} para OT #${workOrderId}`);

    return NextResponse.json({
      success: true,
      message: result.isNew ? 'RCA creado exitosamente' : 'RCA actualizado exitosamente',
      rca: {
        id: result.rca.id,
        whys: result.rca.whys,
        rootCause: result.rca.rootCause,
        conclusion: result.rca.conclusion,
        correctiveActions: result.rca.correctiveActions,
        status: result.rca.status,
        createdBy: result.rca.createdBy,
        createdAt: result.rca.createdAt,
        updatedAt: result.rca.updatedAt
      }
    }, { status: result.isNew ? 201 : 200 });

  } catch (error: any) {
    console.error('❌ Error en POST /api/work-orders/[id]/rca:', error);
    return NextResponse.json(
      { error: 'Error al guardar RCA', detail: error.message },
      { status: 500 }
    );
  }
}
