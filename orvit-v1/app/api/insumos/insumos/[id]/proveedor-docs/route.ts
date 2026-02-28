import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/insumos/insumos/[id]/proveedor-docs
 * Returns all supplier items for a supply, with their documents.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const supplyId = parseInt(params.id);

    const items = await prisma.supplierItem.findMany({
      where: { supplyId, activo: true },
      select: {
        id: true,
        nombre: true,
        codigoProveedor: true,
        unidad: true,
        supplierDocuments: true,
        supplier: {
          select: { id: true, name: true },
        },
      },
      orderBy: { supplier: { name: 'asc' } },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error obteniendo documentos de proveedores:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

/**
 * PATCH /api/insumos/insumos/[id]/proveedor-docs
 * Updates the supplierDocuments for a specific SupplierItem.
 * Body: { supplierItemId: number, documents: FileAttachment[] }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const supplyId = parseInt(params.id);
    const { supplierItemId, documents } = await request.json();

    if (!supplierItemId) {
      return NextResponse.json({ error: 'supplierItemId es requerido' }, { status: 400 });
    }

    // Verify the supplier item belongs to this supply
    const item = await prisma.supplierItem.findFirst({
      where: { id: supplierItemId, supplyId },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item de proveedor no encontrado' }, { status: 404 });
    }

    const updated = await prisma.supplierItem.update({
      where: { id: supplierItemId },
      data: { supplierDocuments: documents ?? [] },
      select: {
        id: true,
        nombre: true,
        supplierDocuments: true,
      },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('Error actualizando documentos de proveedor:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
