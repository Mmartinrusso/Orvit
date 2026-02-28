import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Schema de validación para WorkShift
const WorkShiftSchema = z.object({
  code: z.string().min(1, 'El código es requerido'),
  name: z.string().min(1, 'El nombre es requerido'),
  type: z.string().min(1, 'El tipo es requerido'), // 'MORNING', 'AFTERNOON', 'NIGHT', 'SPLIT', custom
  startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)'),
  endTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)'),
  breakMinutes: z.number().min(0).default(30),
  isActive: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.SHIFTS);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const whereClause: any = {
      companyId: user!.companyId,
    };

    if (activeOnly) {
      whereClause.isActive = true;
    }

    const shifts = await prisma.workShift.findMany({
      where: whereClause,
      orderBy: [
        { isActive: 'desc' },
        { startTime: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      shifts,
    });
  } catch (error) {
    console.error('Error fetching work shifts:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.SHIFTS);
    if (error) return error;

    const body = await request.json();
    const validatedData = WorkShiftSchema.parse(body);

    // Verificar si ya existe un turno con el mismo código
    const existingShift = await prisma.workShift.findUnique({
      where: {
        companyId_code: {
          companyId: user!.companyId,
          code: validatedData.code,
        },
      },
    });

    if (existingShift) {
      return NextResponse.json(
        { error: 'Ya existe un turno con ese código' },
        { status: 400 }
      );
    }

    const shift = await prisma.workShift.create({
      data: {
        ...validatedData,
        companyId: user!.companyId,
      },
    });

    return NextResponse.json({
      success: true,
      shift,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating work shift:', error);

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
