import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAvailability, getCompanyAvailability, checkAvailability } from '@/lib/almacen/stock-availability';
import { requirePermission } from '@/lib/auth/shared-helpers';

/**
 * GET /api/almacen/availability
 *
 * Query params:
 * - supplierItemId: number (optional) - Get availability for specific item
 * - warehouseId: number (optional) - Filter by warehouse
 * - search: string (optional) - Search by item name/code
 * - onlyBelowMinimum: boolean (optional) - Filter items below minimum stock
 * - onlyBelowReorder: boolean (optional) - Filter items below reorder point
 * - page: number (optional) - Page number (default: 1)
 * - pageSize: number (optional) - Items per page (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    // Permission check: almacen.view_inventory
    const { user, error: authError } = await requirePermission('almacen.view_inventory');
    if (authError) return authError;

    const { searchParams } = new URL(request.url);

    // Get company from session/auth
    const companyId = Number(searchParams.get('companyId'));
    if (!companyId || isNaN(companyId)) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    const supplierItemId = searchParams.get('supplierItemId');
    const warehouseId = searchParams.get('warehouseId');

    // If specific item requested, return single availability
    if (supplierItemId && warehouseId) {
      const availability = await getAvailability(
        Number(supplierItemId),
        Number(warehouseId),
        companyId
      );
      return NextResponse.json({ availability });
    }

    // Otherwise, return paginated list
    const search = searchParams.get('search') || undefined;
    const onlyBelowMinimum = searchParams.get('onlyBelowMinimum') === 'true';
    const onlyBelowReorder = searchParams.get('onlyBelowReorder') === 'true';
    const page = Number(searchParams.get('page')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || 50;

    const result = await getCompanyAvailability(companyId, {
      warehouseId: warehouseId ? Number(warehouseId) : undefined,
      search,
      onlyBelowMinimum,
      onlyBelowReorder,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error en GET /api/almacen/availability:', error);
    return NextResponse.json(
      { error: 'Error al obtener disponibilidad' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/almacen/availability/check
 *
 * Body:
 * - supplierItemId: number
 * - warehouseId: number
 * - quantity: number
 * - companyId: number
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supplierItemId, warehouseId, quantity, companyId } = body;

    if (!supplierItemId || !warehouseId || !quantity || !companyId) {
      return NextResponse.json(
        { error: 'supplierItemId, warehouseId, quantity y companyId son requeridos' },
        { status: 400 }
      );
    }

    const result = await checkAvailability(
      Number(supplierItemId),
      Number(warehouseId),
      Number(companyId),
      Number(quantity)
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error en POST /api/almacen/availability:', error);
    return NextResponse.json(
      { error: 'Error al verificar disponibilidad' },
      { status: 500 }
    );
  }
}
