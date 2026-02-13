import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserAndCompany } from '@/lib/costs-auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Schema de validación para ProductionReasonCode
const ReasonCodeSchema = z.object({
  code: z.string().min(1, 'El código es requerido'),
  name: z.string().min(1, 'El nombre es requerido'),
  type: z.enum(['DOWNTIME', 'SCRAP', 'REWORK', 'QUALITY_HOLD'], {
    errorMap: () => ({ message: 'Tipo inválido. Debe ser: DOWNTIME, SCRAP, REWORK o QUALITY_HOLD' }),
  }),
  parentId: z.number().optional().nullable(),
  requiresNote: z.boolean().default(false),
  triggersMaintenance: z.boolean().default(false),
  affectsOEE: z.boolean().default(true),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const parentId = searchParams.get('parentId');
    const flat = searchParams.get('flat') === 'true'; // Retornar lista plana o jerárquica

    const whereClause: any = {
      companyId: auth.companyId,
    };

    if (type) {
      whereClause.type = type;
    }

    if (activeOnly) {
      whereClause.isActive = true;
    }

    if (parentId !== null && parentId !== undefined) {
      whereClause.parentId = parentId === 'null' ? null : parseInt(parentId);
    }

    const reasonCodes = await prisma.productionReasonCode.findMany({
      where: whereClause,
      include: flat ? undefined : {
        parent: true,
        children: {
          where: activeOnly ? { isActive: true } : undefined,
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [
        { type: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    // Si se quiere estructura jerárquica (solo raíces con children anidados)
    if (!flat && !parentId) {
      const rootCodes = reasonCodes.filter(rc => rc.parentId === null);
      return NextResponse.json({
        success: true,
        reasonCodes: rootCodes,
      });
    }

    return NextResponse.json({
      success: true,
      reasonCodes,
    });
  } catch (error) {
    console.error('Error fetching reason codes:', error);
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
    const validatedData = ReasonCodeSchema.parse(body);

    // Verificar si ya existe un código de motivo con el mismo código
    const existingCode = await prisma.productionReasonCode.findUnique({
      where: {
        companyId_code: {
          companyId: auth.companyId,
          code: validatedData.code,
        },
      },
    });

    if (existingCode) {
      return NextResponse.json(
        { error: 'Ya existe un código de motivo con ese código' },
        { status: 400 }
      );
    }

    // Si se especifica parentId, verificar que existe y es del mismo tipo
    if (validatedData.parentId) {
      const parent = await prisma.productionReasonCode.findFirst({
        where: {
          id: validatedData.parentId,
          companyId: auth.companyId,
        },
      });

      if (!parent) {
        return NextResponse.json(
          { error: 'Código de motivo padre no encontrado' },
          { status: 400 }
        );
      }

      if (parent.type !== validatedData.type) {
        return NextResponse.json(
          { error: 'El código hijo debe ser del mismo tipo que el padre' },
          { status: 400 }
        );
      }
    }

    const reasonCode = await prisma.productionReasonCode.create({
      data: {
        ...validatedData,
        companyId: auth.companyId,
      },
      include: {
        parent: true,
      },
    });

    return NextResponse.json({
      success: true,
      reasonCode,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating reason code:', error);

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

// Endpoint para crear múltiples códigos de motivo (seed inicial)
export async function PUT(request: NextRequest) {
  try {
    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.reasonCodes || !Array.isArray(body.reasonCodes)) {
      return NextResponse.json(
        { error: 'Se requiere un array de reasonCodes' },
        { status: 400 }
      );
    }

    const created: any[] = [];
    const errors: any[] = [];

    for (const item of body.reasonCodes) {
      try {
        const validatedData = ReasonCodeSchema.parse(item);

        // Verificar si ya existe
        const existing = await prisma.productionReasonCode.findUnique({
          where: {
            companyId_code: {
              companyId: auth.companyId,
              code: validatedData.code,
            },
          },
        });

        if (existing) {
          errors.push({ code: validatedData.code, error: 'Ya existe' });
          continue;
        }

        const reasonCode = await prisma.productionReasonCode.create({
          data: {
            ...validatedData,
            companyId: auth.companyId,
          },
        });

        created.push(reasonCode);
      } catch (err) {
        errors.push({ code: item.code, error: err instanceof Error ? err.message : 'Error desconocido' });
      }
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error bulk creating reason codes:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
