import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JWT_SECRET } from '@/lib/auth';
import { validateRequest } from '@/lib/validations/helpers';
import { CreateDailySessionSchema } from '@/lib/validations/daily-sessions';

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

// GET /api/production/daily-sessions - Get or auto-create session for a day/sector/shift
export async function GET(request: Request) {
  try {
    const { companyId } = await getUserFromToken();
    const { searchParams } = new URL(request.url);

    const sectorId = searchParams.get('sectorId');
    const productionDate = searchParams.get('productionDate');
    const shiftId = searchParams.get('shiftId');
    const autoCreate = searchParams.get('autoCreate') !== 'false';

    if (!sectorId || !productionDate) {
      return NextResponse.json(
        { success: false, error: 'sectorId y productionDate son requeridos' },
        { status: 400 }
      );
    }

    const dateObj = new Date(productionDate + 'T00:00:00.000Z');
    const parsedSectorId = sectorId;
    const parsedShiftId = shiftId ? parseInt(shiftId) : null;

    // Try to find existing session
    let session = await prisma.dailyProductionSession.findFirst({
      where: {
        companyId,
        sectorId: parsedSectorId,
        productionDate: dateObj,
        shiftId: parsedShiftId,
      },
      include: {
        sector: { select: { id: true, name: true } },
        shift: { select: { id: true, name: true, code: true } },
        submittedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        entries: {
          include: {
            product: {
              select: {
                id: true, name: true, code: true, unit: true,
                recipeId: true,
                recipe: { select: { id: true, name: true } },
              },
            },
            workCenter: { select: { id: true, name: true, code: true } },
            registeredBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // Auto-create if not found
    if (!session && autoCreate) {
      session = await prisma.dailyProductionSession.create({
        data: {
          productionDate: dateObj,
          sectorId: parsedSectorId,
          shiftId: parsedShiftId,
          status: 'DRAFT',
          companyId,
        },
        include: {
          sector: { select: { id: true, name: true } },
          shift: { select: { id: true, name: true, code: true } },
          submittedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          entries: {
            include: {
              product: {
                select: {
                  id: true, name: true, code: true, unit: true,
                  recipeId: true,
                  recipe: { select: { id: true, name: true } },
                },
              },
              workCenter: { select: { id: true, name: true, code: true } },
              registeredBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Sesión no encontrada' },
        { status: 404 }
      );
    }

    // Calculate totals
    const totals = {
      quantity: session.entries.reduce((sum, e) => sum + Number(e.quantity), 0),
      scrapQuantity: session.entries.reduce((sum, e) => sum + Number(e.scrapQuantity), 0),
      entryCount: session.entries.length,
    };

    return NextResponse.json({ success: true, session, totals });
  } catch (error) {
    console.error('Error fetching daily production session:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener sesión de producción' },
      { status: 500 }
    );
  }
}

// POST /api/production/daily-sessions - Create session manually
export async function POST(request: Request) {
  try {
    const { companyId } = await getUserFromToken();
    const body = await request.json();

    const validation = validateRequest(CreateDailySessionSchema, body);
    if (!validation.success) return validation.response;

    const { sectorId, productionDate, shiftId, notes } = validation.data;

    const dateObj = new Date(productionDate + 'T00:00:00.000Z');
    const parsedShiftId = shiftId ?? null;

    // Check for duplicate
    const existing = await prisma.dailyProductionSession.findFirst({
      where: {
        companyId,
        sectorId: sectorId,
        productionDate: dateObj,
        shiftId: parsedShiftId,
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Ya existe una sesión para este día/sector/turno' },
        { status: 400 }
      );
    }

    const session = await prisma.dailyProductionSession.create({
      data: {
        productionDate: dateObj,
        sectorId: sectorId,
        shiftId: parsedShiftId,
        status: 'DRAFT',
        notes,
        companyId,
      },
      include: {
        sector: { select: { id: true, name: true } },
        shift: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ success: true, session }, { status: 201 });
  } catch (error) {
    console.error('Error creating daily production session:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear sesión de producción' },
      { status: 500 }
    );
  }
}
