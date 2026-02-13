import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JWT_SECRET } from '@/lib/auth';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { MODE } from '@/lib/view-mode/types';
import { executeT2Query } from '@/lib/view-mode';

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

/**
 * GET /api/compras/grni/stats
 * Obtiene estadísticas de GRNI: total pendiente, aging buckets, top proveedores
 */
export async function GET(req: NextRequest) {
  try {
    const { companyId } = await getUserFromToken();
    const mode = getViewMode(req);

    if (mode === MODE.EXTENDED) {
      // T2 stats via raw query
      const statsQuery = `
        SELECT
          SUM(CASE WHEN estado = 'PENDIENTE' THEN "montoEstimado" ELSE 0 END) as total_pendiente,
          COUNT(CASE WHEN estado = 'PENDIENTE' THEN 1 END) as cantidad_recepciones,
          SUM(CASE WHEN estado = 'PENDIENTE' AND "createdAt" > NOW() - INTERVAL '30 days' THEN "montoEstimado" ELSE 0 END) as aging_0_30,
          SUM(CASE WHEN estado = 'PENDIENTE' AND "createdAt" <= NOW() - INTERVAL '30 days' AND "createdAt" > NOW() - INTERVAL '60 days' THEN "montoEstimado" ELSE 0 END) as aging_31_60,
          SUM(CASE WHEN estado = 'PENDIENTE' AND "createdAt" <= NOW() - INTERVAL '60 days' AND "createdAt" > NOW() - INTERVAL '90 days' THEN "montoEstimado" ELSE 0 END) as aging_61_90,
          SUM(CASE WHEN estado = 'PENDIENTE' AND "createdAt" <= NOW() - INTERVAL '90 days' THEN "montoEstimado" ELSE 0 END) as aging_90_plus
        FROM grni_accruals
        WHERE "companyId" = $1
      `;

      const supplierQuery = `
        SELECT
          ga."supplierId",
          s.name as supplier_name,
          SUM(ga."montoEstimado") as monto,
          COUNT(*) as count
        FROM grni_accruals ga
        JOIN "Supplier" s ON s.id = ga."supplierId"
        WHERE ga."companyId" = $1 AND ga.estado = 'PENDIENTE'
        GROUP BY ga."supplierId", s.name
        ORDER BY monto DESC
        LIMIT 10
      `;

      const [statsResult, supplierResult] = await Promise.all([
        executeT2Query(statsQuery, [companyId]),
        executeT2Query(supplierQuery, [companyId]),
      ]);

      const stats = statsResult.rows?.[0] || {};

      return NextResponse.json({
        totalPendiente: Number(stats.total_pendiente) || 0,
        cantidadRecepciones: Number(stats.cantidad_recepciones) || 0,
        aging: {
          '0-30': Number(stats.aging_0_30) || 0,
          '31-60': Number(stats.aging_31_60) || 0,
          '61-90': Number(stats.aging_61_90) || 0,
          '90+': Number(stats.aging_90_plus) || 0,
        },
        bySupplier: (supplierResult.rows || []).map((r: any) => ({
          supplierId: r.supplierId,
          supplierName: r.supplier_name,
          monto: Number(r.monto) || 0,
          count: Number(r.count) || 0,
        })),
        mode: MODE.EXTENDED,
      });
    }

    // T1 - Calculate stats with Prisma
    const now = new Date();
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days60Ago = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Get all pending accruals
    const pendingAccruals = await prisma.gRNIAccrual.findMany({
      where: { companyId, estado: 'PENDIENTE' },
      select: {
        id: true,
        montoEstimado: true,
        createdAt: true,
        supplierId: true,
        supplier: {
          select: { name: true },
        },
      },
    });

    // Calculate aging buckets
    const aging = {
      '0-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0,
    };

    let totalPendiente = 0;
    const supplierTotals: Record<number, { name: string; monto: number; count: number }> = {};

    for (const accrual of pendingAccruals) {
      const monto = Number(accrual.montoEstimado) || 0;
      totalPendiente += monto;

      // Aging bucket
      if (accrual.createdAt > days30Ago) {
        aging['0-30'] += monto;
      } else if (accrual.createdAt > days60Ago) {
        aging['31-60'] += monto;
      } else if (accrual.createdAt > days90Ago) {
        aging['61-90'] += monto;
      } else {
        aging['90+'] += monto;
      }

      // By supplier
      if (!supplierTotals[accrual.supplierId]) {
        supplierTotals[accrual.supplierId] = {
          name: accrual.supplier?.name || 'Desconocido',
          monto: 0,
          count: 0,
        };
      }
      supplierTotals[accrual.supplierId].monto += monto;
      supplierTotals[accrual.supplierId].count += 1;
    }

    // Sort suppliers by monto
    const bySupplier = Object.entries(supplierTotals)
      .map(([id, data]) => ({
        supplierId: parseInt(id, 10),
        supplierName: data.name,
        monto: data.monto,
        count: data.count,
      }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 10);

    return NextResponse.json({
      totalPendiente,
      cantidadRecepciones: pendingAccruals.length,
      aging,
      bySupplier,
      mode: MODE.STANDARD,
    });
  } catch (error) {
    console.error('[GRNI-STATS] Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas GRNI' },
      { status: 500 }
    );
  }
}
