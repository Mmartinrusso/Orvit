import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
import { validateRequest } from '@/lib/validations/helpers';
import { UpdateDailyEntrySchema } from '@/lib/validations/production';

export const dynamic = 'force-dynamic';

// GET /api/production/daily-entries/[id] - Get single entry
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.PARTES.VIEW);
    if (error) return error;
    const companyId = user!.companyId;
    const id = parseInt(params.id);

    const entry = await prisma.dailyProductionEntry.findFirst({
      where: { id, companyId },
      include: {
        product: {
          select: { id: true, name: true, code: true, unit: true, image: true },
        },
        workCenter: {
          select: { id: true, name: true, code: true },
        },
        registeredBy: {
          select: { id: true, name: true },
        },
        session: {
          select: { id: true, productionDate: true, status: true, sectorId: true },
        },
      },
    });

    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Registro no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, entry });
  } catch (error) {
    console.error('Error fetching daily production entry:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener registro' },
      { status: 500 }
    );
  }
}

// PUT /api/production/daily-entries/[id] - Update entry (only if session is DRAFT)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.PARTES.EDIT);
    if (error) return error;
    const companyId = user!.companyId;
    const id = parseInt(params.id);
    const body = await request.json();

    const validation = validateRequest(UpdateDailyEntrySchema, body);
    if (!validation.success) return validation.response;

    const existing = await prisma.dailyProductionEntry.findFirst({
      where: { id, companyId },
      include: {
        session: { select: { status: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Registro no encontrado' },
        { status: 404 }
      );
    }

    if (existing.session.status !== 'DRAFT') {
      return NextResponse.json(
        { success: false, error: 'La sesión no está en estado borrador. No se puede editar.' },
        { status: 400 }
      );
    }

    const validated = validation.data;
    const data: any = {};
    if (validated.quantity !== undefined) data.quantity = validated.quantity;
    if (validated.scrapQuantity !== undefined) data.scrapQuantity = validated.scrapQuantity;
    if (validated.uom !== undefined) data.uom = validated.uom;
    if (validated.workCenterId !== undefined) {
      data.workCenterId = validated.workCenterId || null;
    }
    if (validated.batchNumber !== undefined) data.batchNumber = validated.batchNumber;
    if (validated.notes !== undefined) data.notes = validated.notes;

    const entry = await prisma.dailyProductionEntry.update({
      where: { id },
      data,
      include: {
        product: {
          select: {
            id: true, name: true, code: true, unit: true,
            recipeId: true,
            recipe: { select: { id: true, name: true } },
          },
        },
        workCenter: {
          select: { id: true, name: true, code: true },
        },
        registeredBy: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ success: true, entry });
  } catch (error) {
    console.error('Error updating daily production entry:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar registro' },
      { status: 500 }
    );
  }
}

// DELETE /api/production/daily-entries/[id] - Delete entry (only if session is DRAFT)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.PARTES.EDIT);
    if (error) return error;
    const companyId = user!.companyId;
    const id = parseInt(params.id);

    const existing = await prisma.dailyProductionEntry.findFirst({
      where: { id, companyId },
      include: {
        session: { select: { status: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Registro no encontrado' },
        { status: 404 }
      );
    }

    if (existing.session.status !== 'DRAFT') {
      return NextResponse.json(
        { success: false, error: 'La sesión no está en estado borrador. No se puede eliminar.' },
        { status: 400 }
      );
    }

    await prisma.dailyProductionEntry.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Registro eliminado' });
  } catch (error) {
    console.error('Error deleting daily production entry:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar registro' },
      { status: 500 }
    );
  }
}
