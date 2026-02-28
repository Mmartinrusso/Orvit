import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Schema de validación para actualización
const WorkShiftUpdateSchema = z.object({
  code: z.string().min(1, 'El código es requerido').optional(),
  name: z.string().min(1, 'El nombre es requerido').optional(),
  type: z.string().min(1, 'El tipo es requerido').optional(),
  startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)').optional(),
  endTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)').optional(),
  breakMinutes: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.SHIFTS);
    if (error) return error;

    const shiftId = parseInt(params.id);
    if (isNaN(shiftId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const shift = await prisma.workShift.findFirst({
      where: {
        id: shiftId,
        companyId: user!.companyId,
      },
    });

    if (!shift) {
      return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      shift,
    });
  } catch (error) {
    console.error('Error fetching work shift:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.SHIFTS);
    if (error) return error;

    const shiftId = parseInt(params.id);
    if (isNaN(shiftId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que el turno existe y pertenece a la empresa
    const existingShift = await prisma.workShift.findFirst({
      where: {
        id: shiftId,
        companyId: user!.companyId,
      },
    });

    if (!existingShift) {
      return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = WorkShiftUpdateSchema.parse(body);

    // Si se está actualizando el código, verificar que no exista otro con el mismo código
    if (validatedData.code && validatedData.code !== existingShift.code) {
      const duplicateCode = await prisma.workShift.findFirst({
        where: {
          companyId: user!.companyId,
          code: validatedData.code,
          id: { not: shiftId },
        },
      });

      if (duplicateCode) {
        return NextResponse.json(
          { error: 'Ya existe un turno con ese código' },
          { status: 400 }
        );
      }
    }

    const shift = await prisma.workShift.update({
      where: { id: shiftId },
      data: validatedData,
    });

    return NextResponse.json({
      success: true,
      shift,
    });
  } catch (error) {
    console.error('Error updating work shift:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.SHIFTS);
    if (error) return error;

    const shiftId = parseInt(params.id);
    if (isNaN(shiftId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que el turno existe y pertenece a la empresa
    const existingShift = await prisma.workShift.findFirst({
      where: {
        id: shiftId,
        companyId: user!.companyId,
      },
    });

    if (!existingShift) {
      return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
    }

    // Verificar si hay datos asociados
    const hasRelatedData = await prisma.dailyProductionReport.findFirst({
      where: { shiftId },
    });

    if (hasRelatedData) {
      // En lugar de eliminar, desactivar
      await prisma.workShift.update({
        where: { id: shiftId },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        message: 'Turno desactivado (tiene datos asociados)',
        deactivated: true,
      });
    }

    // Si no hay datos asociados, eliminar
    await prisma.workShift.delete({
      where: { id: shiftId },
    });

    return NextResponse.json({
      success: true,
      message: 'Turno eliminado',
      deleted: true,
    });
  } catch (error) {
    console.error('Error deleting work shift:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
