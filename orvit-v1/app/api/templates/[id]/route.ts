/**
 * API: /api/templates/[id]
 *
 * GET - Obtener plantilla por ID
 * PATCH - Actualizar plantilla
 * DELETE - Eliminar plantilla
 * POST (use) - Usar plantilla (incrementa usageCount)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Schema para actualizar plantilla
 */
const updateTemplateSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().max(500).optional().nullable(),
  content: z.record(z.any()).optional(),
  componentId: z.number().int().positive().optional().nullable(),
  machineId: z.number().int().positive().optional().nullable(),
  areaId: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
}).strict();

/**
 * GET /api/templates/[id]
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
    const templateId = parseInt(params.id);

    if (isNaN(templateId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const template = await prisma.template.findUnique({
      where: { id: templateId },
      include: {
        createdBy: {
          select: { id: true, name: true }
        }
      }
    });

    if (!template || template.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Plantilla no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template
    });

  } catch (error) {
    console.error('❌ Error en GET /api/templates/[id]:', error);
    return NextResponse.json(
      { error: 'Error al obtener plantilla' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/templates/[id]
 */
export async function PATCH(
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
    const templateId = parseInt(params.id);

    if (isNaN(templateId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que existe
    const existing = await prisma.template.findUnique({
      where: { id: templateId }
    });

    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Plantilla no encontrada' },
        { status: 404 }
      );
    }

    // Parsear body
    const body = await request.json();
    const validationResult = updateTemplateSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e =>
        `${e.path.join('.')}: ${e.message}`
      ).join(', ');

      return NextResponse.json(
        { error: `Validación falló: ${errors}` },
        { status: 400 }
      );
    }

    const updates = validationResult.data;

    const updated = await prisma.template.update({
      where: { id: templateId },
      data: updates,
      include: {
        createdBy: {
          select: { id: true, name: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: updated
    });

  } catch (error) {
    console.error('❌ Error en PATCH /api/templates/[id]:', error);
    return NextResponse.json(
      { error: 'Error al actualizar plantilla' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/templates/[id]
 */
export async function DELETE(
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
    const templateId = parseInt(params.id);

    if (isNaN(templateId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que existe
    const existing = await prisma.template.findUnique({
      where: { id: templateId }
    });

    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Plantilla no encontrada' },
        { status: 404 }
      );
    }

    // Soft delete
    await prisma.template.update({
      where: { id: templateId },
      data: { isActive: false }
    });

    return NextResponse.json({
      success: true,
      message: 'Plantilla eliminada'
    });

  } catch (error) {
    console.error('❌ Error en DELETE /api/templates/[id]:', error);
    return NextResponse.json(
      { error: 'Error al eliminar plantilla' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates/[id]
 * Usar plantilla (incrementa usageCount)
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
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const templateId = parseInt(params.id);

    if (isNaN(templateId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que existe
    const existing = await prisma.template.findUnique({
      where: { id: templateId }
    });

    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Plantilla no encontrada' },
        { status: 404 }
      );
    }

    // Incrementar usageCount
    const updated = await prisma.template.update({
      where: { id: templateId },
      data: {
        usageCount: { increment: 1 }
      }
    });

    return NextResponse.json({
      success: true,
      data: updated.content,
      usageCount: updated.usageCount
    });

  } catch (error) {
    console.error('❌ Error en POST /api/templates/[id]:', error);
    return NextResponse.json(
      { error: 'Error al usar plantilla' },
      { status: 500 }
    );
  }
}
