import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const sectorId = searchParams.get('sectorId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    const where: any = {
      companyId: parseInt(companyId)
    };

    if (sectorId) {
      where.sectorId = parseInt(sectorId);
    }

    // Buscar configuración específica primero
    let config = await prisma.maintenanceConfig.findFirst({
      where,
      include: {
        company: {
          select: {
            id: true,
            name: true
          }
        },
        sector: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Si no existe configuración específica para el sector, buscar la de la empresa
    if (!config && sectorId) {
      config = await prisma.maintenanceConfig.findFirst({
        where: {
          companyId: parseInt(companyId),
          sectorId: null
        },
        include: {
          company: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
    }

    // Si no existe ninguna configuración, crear una por defecto
    if (!config) {
      config = await prisma.maintenanceConfig.create({
        data: {
          companyId: parseInt(companyId),
          sectorId: sectorId ? parseInt(sectorId) : null,
          defaultTimeUnit: 'HOURS',
          defaultExecutionWindow: 'ANY_TIME',
          autoScheduling: true,
          reminderDays: 3,
          allowOverdue: true,
          requirePhotos: false,
          requireSignoff: false
        },
        include: {
          company: {
            select: {
              id: true,
              name: true
            }
          },
          sector: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error fetching maintenance config:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const config = await prisma.maintenanceConfig.upsert({
      where: {
        companyId_sectorId: {
          companyId: data.companyId,
          sectorId: data.sectorId || null
        }
      },
      update: {
        defaultTimeUnit: data.defaultTimeUnit,
        defaultExecutionWindow: data.defaultExecutionWindow,
        autoScheduling: data.autoScheduling,
        reminderDays: data.reminderDays,
        allowOverdue: data.allowOverdue,
        requirePhotos: data.requirePhotos,
        requireSignoff: data.requireSignoff
      },
      create: {
        companyId: data.companyId,
        sectorId: data.sectorId || null,
        defaultTimeUnit: data.defaultTimeUnit || 'HOURS',
        defaultExecutionWindow: data.defaultExecutionWindow || 'ANY_TIME',
        autoScheduling: data.autoScheduling ?? true,
        reminderDays: data.reminderDays ?? 3,
        allowOverdue: data.allowOverdue ?? true,
        requirePhotos: data.requirePhotos ?? false,
        requireSignoff: data.requireSignoff ?? false
      },
      include: {
        company: {
          select: {
            id: true,
            name: true
          }
        },
        sector: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error saving maintenance config:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

