import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserAndCompany } from '@/lib/costs-auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ResourceSchema = z.object({
  code: z.string().min(1, 'El código es requerido').max(50),
  name: z.string().min(1, 'El nombre es requerido').max(255),
  resourceTypeId: z.number().int().positive('Tipo de recurso es requerido'),
  workCenterId: z.number().int().positive().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']).default('ACTIVE'),
  order: z.number().int().default(0),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resourceTypeId = searchParams.get('resourceTypeId');
    const resourceTypeCode = searchParams.get('resourceTypeCode');
    const workCenterId = searchParams.get('workCenterId');
    const status = searchParams.get('status');

    const whereClause: any = {
      companyId: auth.companyId,
    };

    if (resourceTypeId) {
      whereClause.resourceTypeId = parseInt(resourceTypeId);
    }

    if (resourceTypeCode) {
      whereClause.resourceType = {
        code: resourceTypeCode.toUpperCase(),
      };
    }

    if (workCenterId) {
      whereClause.workCenterId = parseInt(workCenterId);
    }

    if (status) {
      whereClause.status = status;
    }

    const resources = await prisma.productionResource.findMany({
      where: whereClause,
      include: {
        resourceType: {
          select: { id: true, code: true, name: true, config: true },
        },
        workCenter: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: [
        { order: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      resources,
    });
  } catch (error) {
    console.error('Error fetching resources:', error);
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
    const validatedData = ResourceSchema.parse(body);

    // Verificar que el tipo de recurso existe
    const resourceType = await prisma.productionResourceType.findFirst({
      where: {
        id: validatedData.resourceTypeId,
        companyId: auth.companyId,
      },
    });

    if (!resourceType) {
      return NextResponse.json(
        { error: 'Tipo de recurso no encontrado' },
        { status: 400 }
      );
    }

    // Verificar que no exista recurso con el mismo código
    const existing = await prisma.productionResource.findUnique({
      where: {
        companyId_code: {
          companyId: auth.companyId,
          code: validatedData.code.toUpperCase(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un recurso con ese código' },
        { status: 400 }
      );
    }

    // Verificar workCenter si se especifica
    if (validatedData.workCenterId) {
      const workCenter = await prisma.workCenter.findFirst({
        where: {
          id: validatedData.workCenterId,
          companyId: auth.companyId,
        },
      });

      if (!workCenter) {
        return NextResponse.json(
          { error: 'Centro de trabajo no encontrado' },
          { status: 400 }
        );
      }
    }

    // Si no se especifica order, obtener el máximo actual + 1
    let order = validatedData.order;
    if (!order) {
      const maxOrder = await prisma.productionResource.aggregate({
        where: {
          companyId: auth.companyId,
          resourceTypeId: validatedData.resourceTypeId,
        },
        _max: { order: true },
      });
      order = (maxOrder._max.order ?? 0) + 1;
    }

    const resource = await prisma.productionResource.create({
      data: {
        code: validatedData.code.toUpperCase(),
        name: validatedData.name,
        resourceTypeId: validatedData.resourceTypeId,
        workCenterId: validatedData.workCenterId,
        metadata: validatedData.metadata ?? undefined,
        status: validatedData.status,
        order,
        companyId: auth.companyId,
      },
      include: {
        resourceType: {
          select: { id: true, code: true, name: true },
        },
        workCenter: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      resource,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating resource:', error);

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
