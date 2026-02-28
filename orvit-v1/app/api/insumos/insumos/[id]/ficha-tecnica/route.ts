import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const supplyId = parseInt(params.id);

    const sheet = await prisma.supplyTechnicalSheet.findUnique({
      where: { supplyId },
    });

    return NextResponse.json({ sheet });
  } catch (error) {
    console.error('Error obteniendo ficha técnica:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const supplyId = parseInt(params.id);
    const body = await request.json();

    const {
      density,
      viscosity,
      ph,
      flashPoint,
      color,
      odor,
      storageTemp,
      storageConditions,
      shelfLifeDays,
      casNumber,
      hazardClass,
      sdsUrl,
      documents,
      notes,
    } = body;

    const data = {
      density: density !== undefined && density !== '' ? Number(density) : null,
      viscosity: viscosity !== undefined && viscosity !== '' ? Number(viscosity) : null,
      ph: ph !== undefined && ph !== '' ? Number(ph) : null,
      flashPoint: flashPoint !== undefined && flashPoint !== '' ? Number(flashPoint) : null,
      color: color || null,
      odor: odor || null,
      storageTemp: storageTemp || null,
      storageConditions: storageConditions || null,
      shelfLifeDays: shelfLifeDays !== undefined && shelfLifeDays !== '' ? Number(shelfLifeDays) : null,
      casNumber: casNumber || null,
      hazardClass: hazardClass || null,
      sdsUrl: sdsUrl || null,
      documents: documents ?? [],
      notes: notes || null,
    };

    const sheet = await prisma.supplyTechnicalSheet.upsert({
      where: { supplyId },
      create: { supplyId, ...data },
      update: { ...data, updatedAt: new Date() },
    });

    return NextResponse.json({ sheet });
  } catch (error) {
    console.error('Error guardando ficha técnica:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
