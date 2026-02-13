import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserAndCompany } from '@/lib/costs-auth';

export const dynamic = 'force-dynamic';

// GET /api/production/routines/machines
// Obtiene máquinas disponibles para seleccionar en rutinas
// Filtros: sectorId, workCenterId, type, status
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sectorId = searchParams.get('sectorId');
    const workCenterId = searchParams.get('workCenterId');
    const machineType = searchParams.get('type');
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    // Si se provee workCenterId, obtener el sector de la máquina del workCenter
    let targetSectorId: number | null = null;

    if (workCenterId) {
      const workCenter = await prisma.workCenter.findFirst({
        where: {
          id: parseInt(workCenterId),
          companyId: auth.companyId,
        },
        include: {
          machine: {
            select: { sectorId: true },
          },
        },
      });

      if (workCenter?.machine?.sectorId) {
        targetSectorId = workCenter.machine.sectorId;
      }
    }

    // Si se provee sectorId directamente, usarlo
    if (sectorId) {
      targetSectorId = parseInt(sectorId);
    }

    // Construir filtro para máquinas
    const whereClause: any = {
      companyId: auth.companyId,
    };

    if (activeOnly) {
      whereClause.status = 'ACTIVE';
    }

    if (targetSectorId) {
      whereClause.sectorId = targetSectorId;
    }

    if (machineType) {
      whereClause.type = machineType;
    }

    // Buscar máquinas
    const machines = await prisma.machine.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        nickname: true,
        type: true,
        brand: true,
        model: true,
        serialNumber: true,
        assetCode: true,
        status: true,
        photo: true,
        sectorId: true,
        sector: {
          select: {
            id: true,
            name: true,
          },
        },
        area: {
          select: {
            id: true,
            name: true,
          },
        },
        // TODO: Descomentar cuando exista la tabla machine_counters
        // counters: {
        //   select: {
        //     id: true,
        //     name: true,
        //     unit: true,
        //     currentValue: true,
        //   },
        // },
      },
      orderBy: [
        { sector: { name: 'asc' } },
        { name: 'asc' },
      ],
    });

    // Transformar a formato para frontend
    const result = machines.map(machine => ({
      id: machine.id,
      name: machine.name,
      nickname: machine.nickname,
      displayName: machine.nickname || machine.name,
      type: machine.type,
      brand: machine.brand,
      model: machine.model,
      serialNumber: machine.serialNumber,
      assetCode: machine.assetCode,
      status: machine.status,
      photo: machine.photo,
      sector: machine.sector ? {
        id: machine.sector.id,
        name: machine.sector.name,
      } : null,
      area: machine.area ? {
        id: machine.area.id,
        name: machine.area.name,
      } : null,
      // TODO: Descomentar cuando exista la tabla machine_counters
      counters: [],
    }));

    // Obtener tipos de máquina disponibles
    const machineTypes = await prisma.machine.findMany({
      where: { companyId: auth.companyId },
      distinct: ['type'],
      select: { type: true },
    });

    return NextResponse.json({
      success: true,
      machines: result,
      meta: {
        total: result.length,
        filteredBySector: !!targetSectorId,
        sectorId: targetSectorId,
        availableTypes: machineTypes.map(m => m.type),
      },
    });
  } catch (error) {
    console.error('Error fetching machines:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
