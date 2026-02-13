import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JWT_SECRET } from '@/lib/auth';
import { validateRequest } from '@/lib/validations/helpers';
import { CreateDailyEntrySchema } from '@/lib/validations/production';

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

// GET /api/production/daily-entries - List entries for a session
export async function GET(request: Request) {
  try {
    const { companyId } = await getUserFromToken();
    const { searchParams } = new URL(request.url);

    const sessionId = searchParams.get('sessionId');
    const sectorId = searchParams.get('sectorId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = { companyId };

    if (sessionId) {
      where.sessionId = parseInt(sessionId);
    }
    if (sectorId) {
      where.sectorId = parseInt(sectorId);
    }
    if (startDate || endDate) {
      where.recordedAt = {};
      if (startDate) where.recordedAt.gte = new Date(startDate);
      if (endDate) where.recordedAt.lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const [entries, total] = await Promise.all([
      prisma.dailyProductionEntry.findMany({
        where,
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
          session: {
            select: { id: true, productionDate: true, status: true },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dailyProductionEntry.count({ where }),
    ]);

    // Calculate totals
    const totals = await prisma.dailyProductionEntry.aggregate({
      where,
      _sum: {
        quantity: true,
        scrapQuantity: true,
      },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      entries,
      totals: {
        quantity: totals._sum.quantity?.toNumber() || 0,
        scrapQuantity: totals._sum.scrapQuantity?.toNumber() || 0,
        count: totals._count,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching daily production entries:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener registros de producción' },
      { status: 500 }
    );
  }
}

// POST /api/production/daily-entries - Create entry within a session
export async function POST(request: Request) {
  try {
    const { userId, companyId } = await getUserFromToken();
    const body = await request.json();

    const validation = validateRequest(CreateDailyEntrySchema, body);
    if (!validation.success) return validation.response;

    const { sessionId, productId, quantity, scrapQuantity, uom, workCenterId, batchNumber, notes } = validation.data;

    // Verify session exists and is in DRAFT status
    const session = await prisma.dailyProductionSession.findFirst({
      where: { id: sessionId, companyId },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Sesión no encontrada' },
        { status: 404 }
      );
    }

    if (session.status !== 'DRAFT') {
      return NextResponse.json(
        { success: false, error: 'La sesión no está en estado borrador. No se pueden agregar registros.' },
        { status: 400 }
      );
    }

    // Verify product and get sectorId for denormalization
    const product = await prisma.product.findFirst({
      where: { id: productId, companyId },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    const entry = await prisma.dailyProductionEntry.create({
      data: {
        sessionId,
        productId,
        sectorId: session.sectorId,
        quantity,
        scrapQuantity: scrapQuantity || 0,
        uom: uom || product.unit || 'unidad',
        workCenterId: workCenterId || null,
        batchNumber: batchNumber || null,
        notes: notes || null,
        registeredById: userId,
        companyId,
      },
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

    return NextResponse.json({ success: true, entry }, { status: 201 });
  } catch (error) {
    console.error('Error creating daily production entry:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear registro de producción' },
      { status: 500 }
    );
  }
}
