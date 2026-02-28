import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

// GET /api/production/profile - Get production profile
export async function GET() {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.PARTES.VIEW);
    if (error) return error;
    const companyId = user!.companyId;

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
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.PARTES.VIEW);
    if (error) return error;
    const companyId = user!.companyId;
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
