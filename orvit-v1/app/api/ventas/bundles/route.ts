/**
 * Product Bundles API — Combinaciones de productos del catálogo
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// GET - Listar bundles de la empresa
export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_VIEW);
    if (error) return error;

    const bundles = await prisma.productBundle.findMany({
      where: { companyId: user!.companyId, isActive: true },
      include: {
        components: {
          include: {
            product: { select: { id: true, name: true, code: true, unit: true } },
          },
          orderBy: { orden: 'asc' },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    return NextResponse.json({ data: bundles });
  } catch (error) {
    console.error('Error fetching bundles:', error);
    return NextResponse.json({ error: 'Error al obtener bundles' }, { status: 500 });
  }
}

// POST - Crear bundle nuevo
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_CREATE);
    if (error) return error;

    const body = await req.json();
    const { nombre, descripcion, unidad, components } = body;

    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    }
    if (!Array.isArray(components) || components.length < 2) {
      return NextResponse.json({ error: 'Se requieren al menos 2 componentes' }, { status: 400 });
    }
    for (const c of components) {
      if (!c.concepto?.trim()) return NextResponse.json({ error: 'Concepto requerido en cada componente' }, { status: 400 });
      if (!c.monto || Number(c.monto) < 0) return NextResponse.json({ error: 'Monto inválido en componente' }, { status: 400 });
      if (!c.cantidad || Number(c.cantidad) <= 0) return NextResponse.json({ error: 'Cantidad inválida en componente' }, { status: 400 });
    }

    const bundle = await prisma.productBundle.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        unidad: unidad || 'UN',
        companyId: user!.companyId,
        createdBy: user!.id,
        components: {
          create: components.map((c: any, i: number) => ({
            productId: c.productId || null,
            concepto: c.concepto.trim(),
            cantidad: Number(c.cantidad),
            monto: Number(c.monto),
            orden: i,
          })),
        },
      },
      include: {
        components: {
          include: {
            product: { select: { id: true, name: true, code: true, unit: true } },
          },
          orderBy: { orden: 'asc' },
        },
      },
    });

    return NextResponse.json(bundle, { status: 201 });
  } catch (error) {
    console.error('Error creating bundle:', error);
    return NextResponse.json({ error: 'Error al crear bundle' }, { status: 500 });
  }
}
