import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/insumos/insumos/[id]/proveedores?companyId=X
 *
 * Devuelve el supply con todos sus SupplierItems (uno por proveedor),
 * incluyendo: precio actual, stock, últimas 5 compras, y precio promedio del mes.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const supplyId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');

    if (!supplyId || !companyId) {
      return NextResponse.json({ error: 'supplyId y companyId requeridos' }, { status: 400 });
    }

    // 1. Supply base
    const supply = await prisma.supplies.findFirst({
      where: { id: supplyId, company_id: companyId, is_active: true },
      select: { id: true, name: true, unit_measure: true },
    });

    if (!supply) {
      return NextResponse.json({ error: 'Insumo no encontrado' }, { status: 404 });
    }

    // 2. SupplierItems con supplier + stock + últimas compras
    const supplierItems = await prisma.supplierItem.findMany({
      where: { supplyId, companyId, activo: true },
      select: {
        id: true,
        nombre: true,
        codigoProveedor: true,
        unidad: true,
        precioUnitario: true,
        supplier: {
          select: { id: true, name: true, razon_social: true },
        },
        stock: {
          select: { cantidad: true, ultimaActualizacion: true },
        },
        priceHistory: {
          orderBy: { fecha: 'desc' },
          take: 6,
          select: {
            id: true,
            precioUnitario: true,
            fecha: true,
            comprobante: {
              select: { numeroSerie: true, numeroFactura: true, tipo: true },
            },
          },
        },
      },
      orderBy: { supplier: { name: 'asc' } },
    });

    // 3. Precio promedio ponderado del mes actual desde supply_monthly_prices
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthPrices = await prisma.$queryRaw<Array<{
      price_per_unit: number;
      notes: string | null;
    }>>`
      SELECT price_per_unit, notes
      FROM supply_monthly_prices
      WHERE supply_id = ${supplyId}
        AND company_id = ${companyId}
        AND month_year >= ${monthStart}
      ORDER BY month_year DESC
      LIMIT 1
    `;

    const avgMonthPrice = monthPrices[0]?.price_per_unit ?? null;
    const avgNotes = monthPrices[0]?.notes ?? null;

    // 4. Historial mensual de precios (últimos 6 meses)
    const monthlyHistory = await prisma.$queryRaw<Array<{
      month_year: Date;
      price_per_unit: number;
      notes: string | null;
    }>>`
      SELECT month_year, price_per_unit, notes
      FROM supply_monthly_prices
      WHERE supply_id = ${supplyId}
        AND company_id = ${companyId}
      ORDER BY month_year DESC
      LIMIT 6
    `;

    return NextResponse.json({
      supply: {
        id: supply.id,
        name: supply.name,
        unitMeasure: supply.unit_measure,
      },
      proveedores: supplierItems.map((si) => ({
        supplierItemId: si.id,
        supplierId: si.supplier.id,
        supplierName: si.supplier.razon_social || si.supplier.name,
        codigoProveedor: si.codigoProveedor,
        unidad: si.unidad,
        precioActual: si.precioUnitario ? Number(si.precioUnitario) : null,
        stock: si.stock ? Number(si.stock.cantidad) : 0,
        ultimaActualizacion: si.stock?.ultimaActualizacion ?? null,
        ultimasCompras: si.priceHistory.map((ph) => ({
          id: ph.id,
          precio: Number(ph.precioUnitario),
          fecha: ph.fecha,
          comprobante: ph.comprobante
            ? `${ph.comprobante.tipo} ${ph.comprobante.numeroSerie}-${ph.comprobante.numeroFactura}`
            : null,
        })),
      })),
      precioPromedioPonderado: avgMonthPrice ? Number(avgMonthPrice) : null,
      precioPromedioNotes: avgNotes,
      historialMensual: monthlyHistory.map((m) => ({
        mes: m.month_year,
        precio: Number(m.price_per_unit),
        notes: m.notes,
      })),
    });
  } catch (error) {
    console.error('[GET /api/insumos/[id]/proveedores]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
