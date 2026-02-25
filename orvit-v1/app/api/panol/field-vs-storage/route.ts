/**
 * API: /api/panol/field-vs-storage
 *
 * GET - Repuestos: cuántos en pañol (storage) vs instalados en máquinas (field)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 30);

    // 1. Todos los SPARE_PART de la empresa
    const sparePartTools = await prisma.tool.findMany({
      where: { companyId, itemType: 'SPARE_PART' },
      select: { id: true, name: true, code: true, stockQuantity: true, minStockLevel: true },
    });

    if (sparePartTools.length === 0) {
      return NextResponse.json({
        success: true,
        summary: { totalTypes: 0, totalInStorage: 0, totalInField: 0, totalNeeded: 0, overallCoverage: 100 },
        topItems: [],
      });
    }

    const toolIds = sparePartTools.map(t => t.id);

    // 2. Stock en almacén: InventoryLot con status AVAILABLE y remainingQty > 0
    const lotsInStorage = await prisma.inventoryLot.groupBy({
      by: ['toolId'],
      where: {
        companyId,
        toolId: { in: toolIds },
        status: 'AVAILABLE',
        remainingQty: { gt: 0 },
      },
      _sum: { remainingQty: true },
    });
    const storageByTool = new Map(
      lotsInStorage.map(l => [l.toolId, l._sum.remainingQty || 0])
    );

    // 3. En campo: LotInstallation activas, agrupadas por toolId via lot
    const activeInstallations = await prisma.lotInstallation.findMany({
      where: {
        removedAt: null,
        companyId,
        lot: { toolId: { in: toolIds } },
      },
      select: {
        quantity: true,
        lot: { select: { toolId: true } },
      },
    });

    const fieldByTool = new Map<number, number>();
    for (const inst of activeInstallations) {
      if (inst.lot.toolId != null) {
        fieldByTool.set(inst.lot.toolId, (fieldByTool.get(inst.lot.toolId) || 0) + inst.quantity);
      }
    }

    // 4. Total needed: ComponentTool.quantityNeeded
    const componentToolsRaw = await prisma.componentTool.groupBy({
      by: ['toolId'],
      where: { toolId: { in: toolIds } },
      _sum: { quantityNeeded: true },
    });
    const neededByTool = new Map(
      componentToolsRaw.map(ct => [ct.toolId, ct._sum.quantityNeeded || 0])
    );

    // 5. Construir respuesta per-tool
    const perTool = sparePartTools.map(tool => {
      const inStorage = storageByTool.get(tool.id) || 0;
      const inField = fieldByTool.get(tool.id) || 0;
      const totalNeeded = neededByTool.get(tool.id) || 0;
      const coverage = totalNeeded > 0
        ? Math.round(((inStorage + inField) / totalNeeded) * 100)
        : null;

      return {
        id: tool.id,
        name: tool.name,
        code: tool.code,
        inStorage,
        inField,
        totalNeeded,
        coverage,
      };
    });

    // Ordenar por total descendente
    perTool.sort((a, b) => (b.inStorage + b.inField) - (a.inStorage + a.inField));

    // 6. KPIs de resumen
    const totalTypes = sparePartTools.length;
    const totalInStorage = perTool.reduce((s, t) => s + t.inStorage, 0);
    const totalInField = perTool.reduce((s, t) => s + t.inField, 0);
    const totalNeeded = perTool.reduce((s, t) => s + t.totalNeeded, 0);
    const overallCoverage = totalNeeded > 0
      ? Math.round(((totalInStorage + totalInField) / totalNeeded) * 100)
      : 100;

    return NextResponse.json({
      success: true,
      summary: {
        totalTypes,
        totalInStorage,
        totalInField,
        totalNeeded,
        overallCoverage,
      },
      topItems: perTool.slice(0, limit),
    });
  } catch (error) {
    console.error('[GET /api/panol/field-vs-storage]', error);
    return NextResponse.json({ error: 'Error al obtener datos' }, { status: 500 });
  }
}
