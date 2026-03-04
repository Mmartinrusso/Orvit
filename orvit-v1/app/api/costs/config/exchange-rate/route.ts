import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';
import { syncSupplyPrice } from '@/lib/costs/sync-supply-prices';

export const dynamic = 'force-dynamic';

// GET /api/costs/config/exchange-rate - Obtener tipo de cambio USD de reposición
export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const settings = await prisma.companySettingsCosting.findUnique({
      where: { companyId: user!.companyId },
      select: { tipoCambioUSD: true, updatedAt: true },
    });

    return NextResponse.json({
      tipoCambioUSD: settings?.tipoCambioUSD ? Number(settings.tipoCambioUSD) : null,
      updatedAt: settings?.updatedAt || null,
    });
  } catch (err: any) {
    console.error('[exchange-rate] GET error:', err?.message);
    return NextResponse.json({ error: 'Error al obtener tipo de cambio' }, { status: 500 });
  }
}

// PUT /api/costs/config/exchange-rate - Actualizar tipo de cambio USD y recalcular costos
export async function PUT(request: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const { tipoCambioUSD } = body;

    if (!tipoCambioUSD || isNaN(Number(tipoCambioUSD)) || Number(tipoCambioUSD) <= 0) {
      return NextResponse.json(
        { error: 'tipoCambioUSD debe ser un número positivo' },
        { status: 400 }
      );
    }

    const companyId = user!.companyId;
    const tcValue = Number(tipoCambioUSD);

    // Upsert en CompanySettingsCosting
    await prisma.companySettingsCosting.upsert({
      where: { companyId },
      update: { tipoCambioUSD: tcValue },
      create: {
        id: `costing-${companyId}`,
        companyId,
        tipoCambioUSD: tcValue,
        updatedAt: new Date(),
      },
    });

    // Buscar todos los supplyIds que tienen compras en USD
    const usdSupplies = await prisma.$queryRaw<Array<{
      supplyId: number;
      fechaEmision: Date;
    }>>`
      SELECT DISTINCT si."supplyId", pr."fechaEmision"
      FROM "PurchaseReceiptItem" pri
      JOIN "SupplierItem" si ON si.id = pri."itemId"
      JOIN "PurchaseReceipt" pr ON pr.id = pri."comprobanteId"
      WHERE pr."moneda" = 'USD'
        AND pri."companyId" = ${companyId}
        AND si."supplyId" IS NOT NULL
        AND pri."precioUnitario" > 0
        AND pri.cantidad > 0
    `;

    // Agrupar por supplyId + mes para recalcular cada combinación única
    const recalcKeys = new Set<string>();
    const recalcTasks: Array<{ supplyId: number; fechaEmision: Date }> = [];

    for (const row of usdSupplies) {
      const date = new Date(row.fechaEmision);
      const key = `${row.supplyId}-${date.getFullYear()}-${date.getMonth()}`;
      if (!recalcKeys.has(key)) {
        recalcKeys.add(key);
        recalcTasks.push({ supplyId: row.supplyId, fechaEmision: date });
      }
    }

    // Recalcular precios para cada supply+mes afectado
    let recalculados = 0;
    for (const task of recalcTasks) {
      try {
        // Necesitamos un itemId para syncSupplyPrice, buscar un SupplierItem de este supply
        const si = await prisma.supplierItem.findFirst({
          where: { supplyId: task.supplyId, companyId },
          select: { id: true },
        });
        if (!si) continue;

        await prisma.$transaction(async (tx) => {
          await syncSupplyPrice(tx, {
            itemId: si.id,
            fechaEmision: task.fechaEmision,
            companyId,
          });
        });
        recalculados++;
      } catch (err) {
        console.warn(`[exchange-rate] Error recalculando supply ${task.supplyId}:`, err);
      }
    }

    return NextResponse.json({
      tipoCambioUSD: tcValue,
      recalculados,
      message: `Tipo de cambio actualizado. ${recalculados} insumo(s) recalculado(s).`,
    });
  } catch (err: any) {
    console.error('[exchange-rate] PUT error:', err?.message);
    return NextResponse.json({ error: 'Error al actualizar tipo de cambio' }, { status: 500 });
  }
}
