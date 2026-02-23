/**
 * Product Bundle [id] API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// GET - Detalle del bundle
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_VIEW);
    if (error) return error;

    const { id } = await params;
    const bundleId = parseInt(id);
    if (isNaN(bundleId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const bundle = await prisma.productBundle.findFirst({
      where: { id: bundleId, companyId: user!.companyId },
      include: {
        components: {
          include: {
            product: { select: { id: true, name: true, code: true, unit: true, costPrice: true } },
          },
          orderBy: { orden: 'asc' },
        },
      },
    });

    if (!bundle) return NextResponse.json({ error: 'Bundle no encontrado' }, { status: 404 });
    return NextResponse.json(bundle);
  } catch (error) {
    console.error('Error fetching bundle:', error);
    return NextResponse.json({ error: 'Error al obtener bundle' }, { status: 500 });
  }
}

// PATCH - Editar bundle
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_EDIT);
    if (error) return error;

    const { id } = await params;
    const bundleId = parseInt(id);
    if (isNaN(bundleId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const body = await req.json();
    const { nombre, descripcion, unidad, components } = body;

    const existing = await prisma.productBundle.findFirst({
      where: { id: bundleId, companyId: user!.companyId },
    });
    if (!existing) return NextResponse.json({ error: 'Bundle no encontrado' }, { status: 404 });

    const bundle = await prisma.$transaction(async (tx) => {
      const updated = await tx.productBundle.update({
        where: { id: bundleId },
        data: {
          ...(nombre && { nombre: nombre.trim() }),
          ...(descripcion !== undefined && { descripcion: descripcion?.trim() || null }),
          ...(unidad && { unidad }),
        },
      });

      if (Array.isArray(components)) {
        await tx.productBundleComponent.deleteMany({ where: { bundleId } });
        await tx.productBundleComponent.createMany({
          data: components.map((c: any, i: number) => ({
            bundleId,
            productId: c.productId || null,
            concepto: c.concepto.trim(),
            cantidad: Number(c.cantidad),
            monto: Number(c.monto),
            orden: i,
          })),
        });
      }

      return tx.productBundle.findFirst({
        where: { id: bundleId },
        include: {
          components: {
            include: {
              product: { select: { id: true, name: true, code: true, unit: true } },
            },
            orderBy: { orden: 'asc' },
          },
        },
      });
    });

    return NextResponse.json(bundle);
  } catch (error) {
    console.error('Error updating bundle:', error);
    return NextResponse.json({ error: 'Error al actualizar bundle' }, { status: 500 });
  }
}

// DELETE - Eliminar bundle (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_EDIT);
    if (error) return error;

    const { id } = await params;
    const bundleId = parseInt(id);
    if (isNaN(bundleId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const existing = await prisma.productBundle.findFirst({
      where: { id: bundleId, companyId: user!.companyId },
    });
    if (!existing) return NextResponse.json({ error: 'Bundle no encontrado' }, { status: 404 });

    await prisma.productBundle.update({
      where: { id: bundleId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bundle:', error);
    return NextResponse.json({ error: 'Error al eliminar bundle' }, { status: 500 });
  }
}
