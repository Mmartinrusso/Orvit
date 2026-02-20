import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import {
  getPurchaseCostsForMonth,
  getPurchasesBySupplier
} from '@/lib/costs/integrations/purchases';

export const dynamic = 'force-dynamic';

/**
 * GET /api/costos/purchases?month=2026-01
 *
 * Obtiene los costos de compras para un mes específico.
 * Los datos vienen de GoodsReceipt con estado CONFIRMADA.
 *
 * IMPORTANTE: Calcula por items de recepción (cantidadAceptada × precio),
 * no por OC completa, evitando duplicar en recepciones parciales.
 */
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

    // Obtener mes de query params
    const month = request.nextUrl.searchParams.get('month');
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Parámetro month requerido en formato YYYY-MM' },
        { status: 400 }
      );
    }

    // Verificar si solo se quiere resumen por proveedor
    const bySupplierOnly = request.nextUrl.searchParams.get('bySupplier') === 'true';

    if (bySupplierOnly) {
      const bySupplier = await getPurchasesBySupplier(companyId, month);
      return NextResponse.json({
        success: true,
        month,
        source: 'PurchaseReceipt',
        bySupplier
      });
    }

    // Obtener datos completos
    const data = await getPurchaseCostsForMonth(companyId, month);

    return NextResponse.json({
      success: true,
      month,
      source: 'PurchaseReceipt',
      hasData: data.receiptCount > 0,
      summary: {
        totalPurchases: data.totalPurchases,
        receiptCount: data.receiptCount,
        itemCount: data.itemCount,
        supplierCount: data.bySupplier.length
      },
      bySupplier: data.bySupplier,
      details: data.details
    });

  } catch (error) {
    console.error('Error obteniendo costos de compras:', error);
    return NextResponse.json(
      { error: 'Error al obtener costos de compras' },
      { status: 500 }
    );
  }
}
