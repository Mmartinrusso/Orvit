import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// Schemas de validación
const CreateInputSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100, 'Nombre muy largo'),
  unitLabel: z.string().min(1, 'Unidad requerida').max(20, 'Unidad muy larga'),
  supplier: z.string().max(100, 'Proveedor muy largo').optional(),
  currentPrice: z.number().positive('Precio debe ser positivo'),
  companyId: z.number().int().positive('ID de empresa inválido'),
});

const UpdateInputSchema = CreateInputSchema.partial().omit({ companyId: true });

// GET /api/inputs - Listar insumos
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId requerido' },
        { status: 400 }
      );
    }

    const whereClause: any = {
      companyId: parseInt(companyId),
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { supplier: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [inputs, total] = await Promise.all([
      prisma.inputItem.findMany({
        where: whereClause,
        include: {
          _count: {
            select: {
              priceHistory: true,
              recipeItems: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.inputItem.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      inputs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching inputs:', error);
    return NextResponse.json(
      { error: 'Error al obtener insumos' },
      { status: 500 }
    );
  }
}

// POST /api/inputs - Crear insumo
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const validatedData = CreateInputSchema.parse(body);

    // Verificar que la empresa existe
    const company = await prisma.company.findUnique({
      where: { id: validatedData.companyId },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que no existe otro insumo con el mismo nombre en la empresa
    const existingInput = await prisma.inputItem.findFirst({
      where: {
        companyId: validatedData.companyId,
        name: validatedData.name,
      },
    });

    if (existingInput) {
      return NextResponse.json(
        { error: 'Ya existe un insumo con ese nombre en esta empresa' },
        { status: 400 }
      );
    }

    // Crear el insumo y su primer precio en el historial
    const result = await prisma.$transaction(async (tx) => {
      const newInput = await tx.inputItem.create({
        data: {
          companyId: validatedData.companyId,
          name: validatedData.name,
          unitLabel: validatedData.unitLabel,
          supplier: validatedData.supplier,
          currentPrice: validatedData.currentPrice,
        },
        include: {
          _count: {
            select: {
              priceHistory: true,
              recipeItems: true,
            },
          },
        },
      });

      // Crear el primer registro de historial de precios
      await tx.inputPriceHistory.create({
        data: {
          companyId: validatedData.companyId,
          inputId: newInput.id,
          effectiveFrom: new Date(),
          price: validatedData.currentPrice,
        },
      });

      return newInput;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating input:', error);
    return NextResponse.json(
      { error: 'Error al crear insumo' },
      { status: 500 }
    );
  }
}
