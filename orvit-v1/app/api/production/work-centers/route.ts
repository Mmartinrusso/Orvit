import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserAndCompany } from '@/lib/costs-auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Schema de validación para WorkCenter
const WorkCenterSchema = z.object({
  code: z.string().min(1, 'El código es requerido'),
  name: z.string().min(1, 'El nombre es requerido'),
  type: z.string().min(1, 'El tipo es requerido'), // 'LINE', 'MACHINE', 'STATION', 'CELL', 'MOLD', custom
  description: z.string().optional().nullable(),
  parentId: z.number().optional().nullable(),
  theoreticalCapacity: z.number().optional().nullable(),
  capacityUnit: z.string().optional().nullable(),
  standardCycleSeconds: z.number().optional().nullable(),
  standardSetupMinutes: z.number().optional().nullable(),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']).default('ACTIVE'),
  machineId: z.number().optional().nullable(),
  lineId: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const parentId = searchParams.get('parentId');
    const includeChildren = searchParams.get('includeChildren') === 'true';

    const whereClause: any = {
      companyId: auth.companyId,
    };

    if (type) {
      whereClause.type = type;
    }

    if (status) {
      whereClause.status = status;
    }

    if (parentId !== null && parentId !== undefined) {
      whereClause.parentId = parentId === 'null' ? null : parseInt(parentId);
    }

    const workCenters = await prisma.workCenter.findMany({
      where: whereClause,
      include: {
        parent: true,
        children: includeChildren,
        machine: {
          select: {
            id: true,
            name: true,
            nickname: true,
            sectorId: true,
          },
        },
        line: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      workCenters,
    });
  } catch (error) {
    console.error('Error fetching work centers:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = WorkCenterSchema.parse(body);

    // Verificar si ya existe un centro de trabajo con el mismo código
    const existingWorkCenter = await prisma.workCenter.findUnique({
      where: {
        companyId_code: {
          companyId: auth.companyId,
          code: validatedData.code,
        },
      },
    });

    if (existingWorkCenter) {
      return NextResponse.json(
        { error: 'Ya existe un centro de trabajo con ese código' },
        { status: 400 }
      );
    }

    // Si se especifica parentId, verificar que existe
    if (validatedData.parentId) {
      const parent = await prisma.workCenter.findFirst({
        where: {
          id: validatedData.parentId,
          companyId: auth.companyId,
        },
      });

      if (!parent) {
        return NextResponse.json(
          { error: 'Centro de trabajo padre no encontrado' },
          { status: 400 }
        );
      }
    }

    // Si se especifica machineId, verificar que existe
    if (validatedData.machineId) {
      const machine = await prisma.machine.findFirst({
        where: {
          id: validatedData.machineId,
          companyId: auth.companyId,
        },
      });

      if (!machine) {
        return NextResponse.json(
          { error: 'Máquina no encontrada' },
          { status: 400 }
        );
      }
    }

    // Si se especifica lineId, verificar que existe
    if (validatedData.lineId) {
      const line = await prisma.line.findFirst({
        where: {
          id: validatedData.lineId,
          companyId: auth.companyId,
        },
      });

      if (!line) {
        return NextResponse.json(
          { error: 'Línea no encontrada' },
          { status: 400 }
        );
      }
    }

    const workCenter = await prisma.workCenter.create({
      data: {
        ...validatedData,
        theoreticalCapacity: validatedData.theoreticalCapacity ?? undefined,
        companyId: auth.companyId,
      },
      include: {
        parent: true,
        machine: {
          select: {
            id: true,
            name: true,
            nickname: true,
            sectorId: true,
          },
        },
        line: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      workCenter,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating work center:', error);

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
