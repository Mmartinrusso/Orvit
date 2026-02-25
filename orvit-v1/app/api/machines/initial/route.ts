import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { logApiPerformance, logApiError } from '@/lib/logger';
import { verifyAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * ✨ ENDPOINT AGREGADOR: Datos iniciales de máquinas
 * Consolida múltiples requests en uno solo para la pantalla de máquinas
 * 
 * ANTES: 3-5 requests (machines, sectors, stats, etc.)
 * DESPUÉS: 1 request
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sectorId = searchParams.get('sectorId');

  const perf = logApiPerformance('machines/initial', { sectorId });

  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      perf.end({ error: 'unauthorized' });
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '100', 10), 200);

    // Siempre usar companyId del usuario autenticado
    const companyIdNum = auth.companyId!;
    if (!companyIdNum) {
      perf.end({ error: 'companyId missing' });
      return NextResponse.json(
        { error: 'Usuario sin empresa asociada' },
        { status: 400 }
      );
    }

    const sectorIdNum = sectorId ? parseInt(sectorId) : null;

    // ✨ OPTIMIZACIÓN: Ejecutar todas las queries en paralelo
    const [machines, sectors, stats] = await Promise.all([
      getMachines(companyIdNum, sectorIdNum, pageSize),
      getSectors(companyIdNum),
      getStats(companyIdNum, sectorIdNum)
    ]);

    // Log de performance
    perf.end({
      machinesCount: machines.length,
      sectorsCount: sectors.length,
      stats
    });

    return NextResponse.json({
      machines,
      sectors,
      stats,
      metadata: {
        companyId: companyIdNum,
        sectorId: sectorIdNum,
        timestamp: new Date().toISOString(),
        total: machines.length
      }
    });

  } catch (error) {
    logApiError('machines/initial', error, { sectorId });
    perf.end({ error: true });
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

async function getMachines(companyId: number, sectorId: number | null, limit: number) {
  const where: any = { companyId };
  if (sectorId) {
    where.sectorId = sectorId;
  }

  // ✨ SUPER OPTIMIZADO: Usar raw SQL para obtener todo en UNA query
  // Esto evita N+1 y múltiples JOINs de Prisma
  const machines = await prisma.$queryRaw<any[]>`
    SELECT
      m.id,
      m.name,
      m.nickname,
      m.aliases,
      m.type,
      m.brand,
      m.model,
      m.status,
      m.photo,
      m.logo,
      m."sectorId",
      m."companyId",
      m."serialNumber",
      m."plantZoneId",
      m."healthScore",
      m."criticalityScore",
      -- Sector info
      s.id as "sector_id",
      s.name as "sector_name",
      s."areaId" as "sector_areaId",
      -- Plant zone info
      pz.id as "plantZone_id",
      pz.name as "plantZone_name",
      pz.color as "plantZone_color",
      -- Counts usando subqueries (más eficiente que JOINs para conteos)
      (SELECT COUNT(*) FROM "Component" c WHERE c."machineId" = m.id) as "componentsCount",
      (SELECT COUNT(*) FROM "work_orders" wo WHERE wo."machineId" = m.id) as "totalWorkOrders",
      (SELECT COUNT(*) FROM "work_orders" wo WHERE wo."machineId" = m.id AND wo.status IN ('PENDING', 'IN_PROGRESS')) as "pendingWorkOrders",
      (SELECT COUNT(*) FROM "failures" f WHERE f.machine_id = m.id AND f.status NOT IN ('RESOLVED', 'CLOSED', 'COMPLETADA')) as "openFailures"
    FROM "Machine" m
    LEFT JOIN "Sector" s ON m."sectorId" = s.id
    LEFT JOIN "PlantZone" pz ON m."plantZoneId" = pz.id
    WHERE m."companyId" = ${companyId}
    ${sectorId ? Prisma.sql`AND m."sectorId" = ${sectorId}` : Prisma.empty}
    ORDER BY m.name ASC
    LIMIT ${limit}
  `;

  // Transformar resultado a formato esperado por el frontend
  return machines.map(m => ({
    id: m.id,
    name: m.name,
    nickname: m.nickname,
    aliases: m.aliases,
    type: m.type,
    brand: m.brand,
    model: m.model,
    status: m.status,
    photo: m.photo,
    logo: m.logo,
    sectorId: m.sectorId,
    companyId: m.companyId,
    serialNumber: m.serialNumber,
    plantZoneId: m.plantZoneId,
    healthScore: m.healthScore,
    criticalityScore: m.criticalityScore,
    sector: m.sector_id ? {
      id: m.sector_id,
      name: m.sector_name,
      areaId: m.sector_areaId
    } : null,
    plantZone: m.plantZone_id ? {
      id: m.plantZone_id,
      name: m.plantZone_name,
      color: m.plantZone_color
    } : null,
    _count: {
      components: Number(m.componentsCount),
      workOrders: Number(m.totalWorkOrders)
    },
    pendingWorkOrders: Number(m.pendingWorkOrders),
    openFailures: Number(m.openFailures)
  }));
}

async function getSectors(companyId: number) {
  return prisma.sector.findMany({
    where: {
      area: {
        companyId
      }
    },
    select: {
      id: true,
      name: true,
      area: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: { name: 'asc' }
  });
}

async function getStats(companyId: number, sectorId: number | null) {
  try {
    // ✨ SUPER OPTIMIZADO: Una sola query para todos los stats
    const result = await prisma.$queryRaw<{
      total: bigint;
      active: bigint;
      inactive: bigint;
      maintenance: bigint;
      withOpenFailures: bigint;
    }[]>`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active,
        COUNT(*) FILTER (WHERE status = 'INACTIVE') as inactive,
        COUNT(*) FILTER (WHERE status = 'MAINTENANCE') as maintenance,
        COUNT(DISTINCT CASE
          WHEN EXISTS (
            SELECT 1 FROM "failures" f
            WHERE f.machine_id = m.id
            AND f.status NOT IN ('RESOLVED', 'CLOSED', 'COMPLETADA')
          ) THEN m.id
        END) as "withOpenFailures"
      FROM "Machine" m
      WHERE m."companyId" = ${companyId}
      ${sectorId ? Prisma.sql`AND m."sectorId" = ${sectorId}` : Prisma.empty}
    `;

    const stats = result[0];
    return {
      total: Number(stats?.total || 0),
      active: Number(stats?.active || 0),
      inactive: Number(stats?.inactive || 0),
      maintenance: Number(stats?.maintenance || 0),
      withOpenFailures: Number(stats?.withOpenFailures || 0)
    };
  } catch (error) {
    console.error('[MACHINES_STATS_ERROR]', error);
    return {
      total: 0,
      active: 0,
      inactive: 0,
      maintenance: 0,
      withOpenFailures: 0
    };
  }
}
