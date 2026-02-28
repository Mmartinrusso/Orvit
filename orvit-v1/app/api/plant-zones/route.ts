import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// Helper: Obtener profundidad de una zona
async function getZoneDepth(zoneId: number): Promise<number> {
  let depth = 0;
  let currentId: number | null = zoneId;

  while (currentId) {
    const zoneData: { parentId: number | null } | null = await prisma.plantZone.findUnique({
      where: { id: currentId },
      select: { parentId: true }
    });
    if (!zoneData || !zoneData.parentId) break;
    currentId = zoneData.parentId;
    depth++;
    if (depth > 50) break;
  }
  return depth;
}

// Helper: Obtener breadcrumb de una zona
async function getZoneBreadcrumb(zoneId: number): Promise<string[]> {
  const path: string[] = [];
  let currentId: number | null = zoneId;

  while (currentId) {
    const zoneData: { name: string; parentId: number | null } | null = await prisma.plantZone.findUnique({
      where: { id: currentId },
      select: { name: true, parentId: true }
    });
    if (!zoneData) break;
    path.unshift(zoneData.name);
    currentId = zoneData.parentId;
    if (path.length > 50) break;
  }
  return path;
}

// ✅ OPTIMIZADO: Obtener stats de máquinas (OTs y Fallas) en batch
async function getMachineStats(machineIds: number[]): Promise<Map<number, { pendingWorkOrders: number; openFailures: number; healthScore: number | null }>> {
  if (machineIds.length === 0) return new Map();

  const stats = await prisma.$queryRaw<{
    id: number;
    pendingWorkOrders: bigint;
    openFailures: bigint;
    healthScore: number | null;
  }[]>`
    SELECT
      m.id,
      m."healthScore",
      (SELECT COUNT(*) FROM "work_orders" wo WHERE wo."machineId" = m.id AND wo.status IN ('PENDING', 'IN_PROGRESS')) as "pendingWorkOrders",
      (SELECT COUNT(*) FROM "failures" f WHERE f.machine_id = m.id AND f.status NOT IN ('RESOLVED', 'CLOSED', 'COMPLETADA')) as "openFailures"
    FROM "Machine" m
    WHERE m.id IN (${Prisma.join(machineIds)})
  `;

  const map = new Map<number, { pendingWorkOrders: number; openFailures: number; healthScore: number | null }>();
  for (const s of stats) {
    map.set(s.id, {
      pendingWorkOrders: Number(s.pendingWorkOrders),
      openFailures: Number(s.openFailures),
      healthScore: s.healthScore
    });
  }
  return map;
}

// Helper: Agregar stats a máquinas de una zona recursivamente
function enrichMachinesWithStats(zone: any, statsMap: Map<number, { pendingWorkOrders: number; openFailures: number; healthScore: number | null }>): any {
  const enrichedZone = { ...zone };

  if (zone.machines?.length > 0) {
    enrichedZone.machines = zone.machines.map((m: any) => {
      const stats = statsMap.get(m.id);
      return {
        ...m,
        pendingWorkOrders: stats?.pendingWorkOrders ?? 0,
        openFailures: stats?.openFailures ?? 0,
        healthScore: stats?.healthScore ?? null
      };
    });
  }

  if (zone.children?.length > 0) {
    enrichedZone.children = zone.children.map((child: any) => enrichMachinesWithStats(child, statsMap));
  }

  return enrichedZone;
}

// Helper: Recolectar todos los IDs de máquinas de zonas
function collectMachineIds(zones: any[]): number[] {
  const ids: number[] = [];
  for (const zone of zones) {
    if (zone.machines?.length > 0) {
      ids.push(...zone.machines.map((m: any) => m.id));
    }
    if (zone.children?.length > 0) {
      ids.push(...collectMachineIds(zone.children));
    }
  }
  return ids;
}

// GET: Listar zonas de planta
export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const sectorId = searchParams.get('sectorId');
    const parentId = searchParams.get('parentId');
    const includeChildren = searchParams.get('includeChildren') === 'true';
    const includeMachines = searchParams.get('includeMachines') === 'true';

    // Construir filtros
    const where: any = {
      companyId: user!.companyId
    };

    if (sectorId) {
      where.sectorId = Number(sectorId);
    }

    // Si parentId es "null" o no se proporciona, obtener zonas raíz
    if (parentId === 'null' || parentId === '') {
      where.parentId = null;
    } else if (parentId) {
      where.parentId = Number(parentId);
    }

    const zones = await prisma.plantZone.findMany({
      where,
      include: {
        children: includeChildren ? {
          include: {
            children: true,
            machines: includeMachines ? {
              select: {
                id: true,
                name: true,
                nickname: true,
                logo: true,
                status: true
              }
            } : false,
            _count: {
              select: {
                children: true,
                machines: true
              }
            }
          }
        } : false,
        machines: includeMachines ? {
          select: {
            id: true,
            name: true,
            nickname: true,
            logo: true,
            status: true,
            brand: true,
            model: true,
            type: true,
            serialNumber: true,
            companyId: true,
            sectorId: true,
            plantZoneId: true,
            acquisitionDate: true,
            assetCode: true,
            sapCode: true,
            productionLine: true,
            installationDate: true,
            manufacturingYear: true,
            description: true,
            voltage: true,
            power: true,
            weight: true,
            dimensions: true,
            aliases: true,
          }
        } : false,
        sector: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            children: true,
            machines: true
          }
        }
      },
      orderBy: [
        { order: 'asc' },
        { name: 'asc' }
      ]
    });

    // ✅ OPTIMIZADO: Obtener stats de máquinas en batch si se incluyen máquinas
    let statsMap = new Map<number, { pendingWorkOrders: number; openFailures: number; healthScore: number | null }>();
    if (includeMachines) {
      const allMachineIds = collectMachineIds(zones);
      if (allMachineIds.length > 0) {
        statsMap = await getMachineStats(allMachineIds);
      }
    }

    // Agregar breadcrumb, depth y stats a cada zona
    const zonesWithHierarchy = await Promise.all(zones.map(async (zone) => {
      const breadcrumb = await getZoneBreadcrumb(zone.id);
      const depth = await getZoneDepth(zone.id);
      const enrichedZone = includeMachines ? enrichMachinesWithStats(zone, statsMap) : zone;
      return {
        ...enrichedZone,
        breadcrumb,
        depth
      };
    }));

    return NextResponse.json(zonesWithHierarchy);
  } catch (error) {
    console.error('Error al obtener zonas:', error);
    return NextResponse.json({ error: 'Error al obtener zonas' }, { status: 500 });
  }
}

// POST: Crear zona de planta
export async function POST(request: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const {
      name,
      description,
      logo,
      photo,
      color,
      order = 0,
      parentId,
      sectorId,
    } = body;

    const companyId = user!.companyId;

    // Validaciones
    if (!name || !sectorId) {
      return NextResponse.json({
        error: 'Faltan campos obligatorios: name, sectorId'
      }, { status: 400 });
    }

    // Validar que el sector existe y pertenece a la empresa
    const sector = await prisma.sector.findFirst({
      where: {
        id: Number(sectorId),
        companyId: Number(companyId)
      }
    });

    if (!sector) {
      return NextResponse.json({
        error: 'Sector no encontrado o no pertenece a la empresa'
      }, { status: 404 });
    }

    // Si hay parentId, validar que existe y pertenece al mismo sector
    let parentInfo = null;
    let depth = 0;
    let breadcrumb: string[] = [];

    if (parentId) {
      const parent = await prisma.plantZone.findUnique({
        where: { id: Number(parentId) },
        select: { id: true, name: true, sectorId: true }
      });

      if (!parent) {
        return NextResponse.json({
          error: `Zona padre con ID ${parentId} no encontrada`
        }, { status: 404 });
      }

      if (parent.sectorId !== Number(sectorId)) {
        return NextResponse.json({
          error: 'La zona padre debe pertenecer al mismo sector'
        }, { status: 400 });
      }

      parentInfo = parent;
      depth = (await getZoneDepth(parent.id)) + 1;
      breadcrumb = await getZoneBreadcrumb(parent.id);

      if (depth >= 10) {
        console.warn(`⚠️ Zona "${name}" tendrá profundidad ${depth + 1}`);
      }
    }

    // Crear la zona
    const zone = await prisma.plantZone.create({
      data: {
        name,
        description,
        logo,
        photo,
        color,
        order: Number(order),
        parentId: parentId ? Number(parentId) : null,
        sectorId: Number(sectorId),
        companyId: Number(companyId)
      },
      include: {
        sector: {
          select: { id: true, name: true }
        },
        parent: {
          select: { id: true, name: true }
        },
        _count: {
          select: {
            children: true,
            machines: true
          }
        }
      }
    });

    return NextResponse.json({
      zone,
      hierarchy: {
        depth,
        breadcrumb: [...breadcrumb, name],
        parentName: parentInfo?.name || null
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error al crear zona:', error);
    return NextResponse.json({ error: 'Error al crear zona' }, { status: 500 });
  }
}
