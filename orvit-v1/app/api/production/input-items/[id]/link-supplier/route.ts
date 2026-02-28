import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';

/**
 * PATCH /api/production/input-items/[id]/link-supplier
 *
 * Link an InputItem to a SupplierItem for stock consumption
 *
 * Body:
 * - supplierItemId: number | null (null to unlink)
 * - conversionFactor: number (optional, default: 1)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.EDIT);
    if (error) return error;

    const inputItemId = params.id;
    if (!inputItemId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { supplierItemId, conversionFactor } = body;

    // Verify input item exists
    const inputItem = await prisma.inputItem.findUnique({
      where: { id: inputItemId },
      select: { id: true, companyId: true },
    });

    if (!inputItem) {
      return NextResponse.json(
        { error: 'InputItem no encontrado' },
        { status: 404 }
      );
    }

    // If linking, verify supplier item exists and belongs to same company
    if (supplierItemId) {
      const supplierItem = await prisma.supplierItem.findUnique({
        where: { id: Number(supplierItemId) },
        select: { id: true, companyId: true, nombre: true, unidad: true },
      });

      if (!supplierItem) {
        return NextResponse.json(
          { error: 'SupplierItem no encontrado' },
          { status: 404 }
        );
      }

      if (supplierItem.companyId !== inputItem.companyId) {
        return NextResponse.json(
          { error: 'El item de proveedor pertenece a otra empresa' },
          { status: 400 }
        );
      }
    }

    // Update the link
    const updated = await prisma.inputItem.update({
      where: { id: inputItemId },
      data: {
        supplierItemId: supplierItemId ? Number(supplierItemId) : null,
        conversionFactor: conversionFactor ? Number(conversionFactor) : 1,
      },
      include: {
        supplierItem: {
          select: {
            id: true,
            nombre: true,
            unidad: true,
            codigoProveedor: true,
          },
        },
      },
    });

    return NextResponse.json({ inputItem: updated });
  } catch (error) {
    console.error('Error en PATCH /api/production/input-items/[id]/link-supplier:', error);
    return NextResponse.json(
      { error: 'Error al vincular items' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/production/input-items/[id]/link-supplier
 *
 * Get current link status for an InputItem
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.EDIT);
    if (error) return error;

    const inputItemId = params.id;
    if (!inputItemId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const inputItem = await prisma.inputItem.findUnique({
      where: { id: inputItemId },
      include: {
        supplierItem: {
          select: {
            id: true,
            nombre: true,
            unidad: true,
            codigoProveedor: true,
            activo: true,
            stockLocations: {
              select: {
                warehouseId: true,
                cantidad: true,
                cantidadReservada: true,
                warehouse: {
                  select: { id: true, nombre: true },
                },
              },
            },
          },
        },
      },
    });

    if (!inputItem) {
      return NextResponse.json(
        { error: 'InputItem no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      inputItem: {
        id: inputItem.id,
        name: inputItem.name,
        unitLabel: inputItem.unitLabel,
        supplierItemId: inputItem.supplierItemId,
        conversionFactor: inputItem.conversionFactor,
        supplierItem: inputItem.supplierItem,
      },
    });
  } catch (error) {
    console.error('Error en GET /api/production/input-items/[id]/link-supplier:', error);
    return NextResponse.json(
      { error: 'Error al obtener vinculación' },
      { status: 500 }
    );
  }
}
