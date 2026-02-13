/**
 * API: /api/corrective-checklists/templates
 *
 * GET  - Lista plantillas de checklist para correctivo
 * POST - Crear nueva plantilla de checklist
 *
 * P5.3: Checklists por tipo de falla
 *
 * Estructura de phases:
 * [
 *   {
 *     id: "phase-1",
 *     name: "Verificación inicial",
 *     items: [
 *       { id: "item-1", description: "Verificar voltaje", type: "check", required: true },
 *       { id: "item-2", description: "Medir temperatura", type: "value", unit: "°C", minValue: 0, maxValue: 100 }
 *     ]
 *   }
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Schema para item de checklist
 */
const checklistItemSchema = z.object({
  id: z.string(),
  description: z.string().min(1),
  type: z.enum(['check', 'value', 'text', 'photo']),
  required: z.boolean().default(true),
  unit: z.string().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  expectedValue: z.string().optional()
});

/**
 * Schema para fase de checklist
 */
const checklistPhaseSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  items: z.array(checklistItemSchema).min(1)
});

/**
 * Schema para crear plantilla
 */
const createTemplateSchema = z.object({
  name: z.string().min(3).max(255),
  description: z.string().optional(),
  machineId: z.number().int().positive().optional(),
  componentId: z.number().int().positive().optional(),
  failureTypeId: z.number().int().positive().optional(),
  minPriority: z.enum(['P1', 'P2', 'P3', 'P4']).optional(),
  tags: z.array(z.string()).optional(),
  phases: z.array(checklistPhaseSchema).min(1)
});

/**
 * GET /api/corrective-checklists/templates
 * Lista plantillas de checklist
 */
export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url);

    // Filtros opcionales
    const machineId = searchParams.get('machineId');
    const componentId = searchParams.get('componentId');
    const minPriority = searchParams.get('minPriority');
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    const where: any = {
      companyId,
      ...(activeOnly && { isActive: true }),
      ...(machineId && { machineId: parseInt(machineId) }),
      ...(componentId && { componentId: parseInt(componentId) }),
      ...(minPriority && { minPriority })
    };

    const templates = await prisma.correctiveChecklistTemplate.findMany({
      where,
      include: {
        machine: { select: { id: true, name: true } },
        component: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } }
      },
      orderBy: [
        { usageCount: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return NextResponse.json({
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        machine: t.machine,
        component: t.component,
        minPriority: t.minPriority,
        tags: t.tags,
        phases: t.phases,
        phasesCount: Array.isArray(t.phases) ? (t.phases as any[]).length : 0,
        itemsCount: Array.isArray(t.phases)
          ? (t.phases as any[]).reduce((sum, p) => sum + (p.items?.length || 0), 0)
          : 0,
        isActive: t.isActive,
        usageCount: t.usageCount,
        createdBy: t.createdBy,
        createdAt: t.createdAt
      })),
      total: templates.length
    });

  } catch (error: any) {
    console.error('❌ Error en GET /api/corrective-checklists/templates:', error);
    return NextResponse.json(
      { error: 'Error al obtener plantillas', detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/corrective-checklists/templates
 * Crear nueva plantilla de checklist
 */
export async function POST(request: NextRequest) {
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

    // Parsear y validar body
    const body = await request.json();
    const validationResult = createTemplateSchema.safeParse(body);

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

    // Crear plantilla
    const template = await prisma.correctiveChecklistTemplate.create({
      data: {
        companyId,
        name: data.name,
        description: data.description,
        machineId: data.machineId,
        componentId: data.componentId,
        failureTypeId: data.failureTypeId,
        minPriority: data.minPriority,
        tags: data.tags,
        phases: data.phases,
        createdById: userId
      },
      include: {
        machine: { select: { id: true, name: true } },
        component: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } }
      }
    });

    console.log(`✅ Plantilla de checklist creada: ID ${template.id} - "${template.name}"`);

    return NextResponse.json({
      success: true,
      message: 'Plantilla creada exitosamente',
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        machine: template.machine,
        component: template.component,
        minPriority: template.minPriority,
        tags: template.tags,
        phases: template.phases,
        createdBy: template.createdBy,
        createdAt: template.createdAt
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Error en POST /api/corrective-checklists/templates:', error);
    return NextResponse.json(
      { error: 'Error al crear plantilla', detail: error.message },
      { status: 500 }
    );
  }
}
