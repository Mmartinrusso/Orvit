import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JWT_SECRET } from '@/lib/auth';
import { validateRequest } from '@/lib/validations/helpers';
import { UpdateRoutineTemplateSchema } from '@/lib/validations/production';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  const token = cookies().get('token')?.value;
  if (!token) throw new Error('No token provided');
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return { userId: payload.userId as number, companyId: payload.companyId as number };
  } catch {
    throw new Error('Invalid token');
  }
}

// GET /api/production/routines/templates/[id] - Get template by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { companyId } = await getUserFromToken();
    const id = parseInt(params.id);

    const template = await prisma.productionRoutineTemplate.findFirst({
      where: { id, companyId },
      include: {
        workCenter: {
          select: { id: true, name: true, code: true }
        },
        sector: {
          select: { id: true, name: true }
        },
        executions: {
          take: 10,
          orderBy: { executedAt: 'desc' },
          include: {
            executedBy: { select: { id: true, name: true } },
            shift: { select: { id: true, name: true } },
          }
        },
        _count: {
          select: { executions: true }
        }
      },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Plantilla no encontrada' },
        { status: 404 }
      );
    }

    // Transform template to include itemsStructure at top level
    const itemsData = template.items as any;
    const isNewFormat = itemsData && typeof itemsData === 'object' && !Array.isArray(itemsData) && 'itemsStructure' in itemsData;

    const transformedTemplate = {
      ...template,
      itemsStructure: isNewFormat ? itemsData.itemsStructure : 'flat',
      items: isNewFormat ? itemsData.items : itemsData,
      groups: isNewFormat ? itemsData.groups : null,
      sections: isNewFormat ? itemsData.sections : [],
      preExecutionInputs: isNewFormat ? itemsData.preExecutionInputs : [],
    };

    return NextResponse.json({ success: true, template: transformedTemplate });
  } catch (error) {
    console.error('Error fetching routine template:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener plantilla' },
      { status: 500 }
    );
  }
}

// PUT /api/production/routines/templates/[id] - Update template
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { companyId } = await getUserFromToken();
    const id = parseInt(params.id);
    const body = await request.json();

    const validation = validateRequest(UpdateRoutineTemplateSchema, body);
    if (!validation.success) return validation.response;

    const existing = await prisma.productionRoutineTemplate.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Plantilla no encontrada' },
        { status: 404 }
      );
    }

    const validated = validation.data;

    // Check for duplicate code (if changing)
    if (validated.code && validated.code !== existing.code) {
      const duplicate = await prisma.productionRoutineTemplate.findFirst({
        where: { companyId, code: validated.code, NOT: { id } },
      });

      if (duplicate) {
        return NextResponse.json(
          { success: false, error: 'Ya existe una plantilla con ese código' },
          { status: 400 }
        );
      }
    }

    // Prepare items data - store itemsStructure, items, groups, sections, and preExecutionInputs together
    let itemsData = existing.items;
    if (validated.items !== undefined || validated.groups !== undefined || validated.sections !== undefined || validated.itemsStructure !== undefined || validated.preExecutionInputs !== undefined) {
      itemsData = {
        itemsStructure: validated.itemsStructure || 'flat',
        items: validated.items || [],
        groups: validated.groups || null,
        sections: validated.sections || [],
        preExecutionInputs: validated.preExecutionInputs || [],
      };
    }

    const template = await prisma.productionRoutineTemplate.update({
      where: { id },
      data: {
        code: validated.code || existing.code,
        name: validated.name || existing.name,
        type: validated.type || existing.type,
        workCenterId: validated.workCenterId !== undefined
          ? (validated.workCenterId || null)
          : existing.workCenterId,
        sectorId: validated.sectorId !== undefined
          ? (validated.sectorId || null)
          : existing.sectorId,
        items: itemsData,
        frequency: validated.frequency || existing.frequency,
        isActive: validated.isActive !== undefined ? validated.isActive : existing.isActive,
        maxCompletionTimeMinutes: validated.maxCompletionTimeMinutes !== undefined
          ? validated.maxCompletionTimeMinutes
          : existing.maxCompletionTimeMinutes,
        enableCompletionReminders: validated.enableCompletionReminders !== undefined
          ? validated.enableCompletionReminders
          : existing.enableCompletionReminders,
      },
      include: {
        workCenter: {
          select: { id: true, name: true, code: true }
        },
        sector: {
          select: { id: true, name: true }
        },
      },
    });

    // Transform response to include itemsStructure at top level
    const responseTemplate = {
      ...template,
      itemsStructure: (template.items as any)?.itemsStructure || 'flat',
      items: (template.items as any)?.items || template.items,
      groups: (template.items as any)?.groups || null,
      sections: (template.items as any)?.sections || [],
      preExecutionInputs: (template.items as any)?.preExecutionInputs || [],
    };

    return NextResponse.json({ success: true, template: responseTemplate });
  } catch (error) {
    console.error('Error updating routine template:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar plantilla' },
      { status: 500 }
    );
  }
}

// DELETE /api/production/routines/templates/[id] - Delete template
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { companyId } = await getUserFromToken();
    const id = parseInt(params.id);

    const existing = await prisma.productionRoutineTemplate.findFirst({
      where: { id, companyId },
      include: { _count: { select: { executions: true } } }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Plantilla no encontrada' },
        { status: 404 }
      );
    }

    // Check if has executions
    if (existing._count.executions > 0) {
      // Soft delete - just deactivate
      await prisma.productionRoutineTemplate.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        message: 'Plantilla desactivada (tiene ejecuciones históricas)'
      });
    }

    // Hard delete if no executions
    await prisma.productionRoutineTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Plantilla eliminada' });
  } catch (error) {
    console.error('Error deleting routine template:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar plantilla' },
      { status: 500 }
    );
  }
}
