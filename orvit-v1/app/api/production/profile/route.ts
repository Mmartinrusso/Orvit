import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JWT_SECRET } from '@/lib/auth';

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

// GET /api/production/profile - Get production profile
export async function GET() {
  try {
    const { companyId } = await getUserFromToken();

    let profile = await prisma.productionProfile.findUnique({
      where: { companyId },
    });

    // Create default profile if doesn't exist
    if (!profile) {
      profile = await prisma.productionProfile.create({
        data: {
          companyId,
          primaryUnitOfWork: 'TURNO',
          defaultUom: {
            length: 'm',
            weight: 'kg',
            volume: 'm3',
            quantity: 'u',
            time: 'min',
          },
          settings: {
            trackBatches: false,
            requirePhotos: false,
            autoCreateIncidents: false,
          },
        },
      });
    }

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('Error fetching production profile:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener perfil de producción' },
      { status: 500 }
    );
  }
}

// PUT /api/production/profile - Update production profile
export async function PUT(request: Request) {
  try {
    const { companyId } = await getUserFromToken();
    const body = await request.json();

    const { primaryUnitOfWork, defaultUom, settings } = body;

    const profile = await prisma.productionProfile.upsert({
      where: { companyId },
      update: {
        primaryUnitOfWork: primaryUnitOfWork,
        defaultUom: defaultUom,
        settings: settings,
      },
      create: {
        companyId,
        primaryUnitOfWork: primaryUnitOfWork || 'TURNO',
        defaultUom: defaultUom || {
          length: 'm',
          weight: 'kg',
          volume: 'm3',
          quantity: 'u',
          time: 'min',
        },
        settings: settings || {},
      },
    });

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('Error updating production profile:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar perfil de producción' },
      { status: 500 }
    );
  }
}
