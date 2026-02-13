/**
 * Zonas de Venta (Sales Territories) API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { applyViewMode, getViewMode } from '@/lib/view-mode';
import { createSalesZoneSchema } from '@/lib/ventas/validation-schemas';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CONFIG_VIEW);
    if (error) return error;

    const viewMode = getViewMode(req);

    const zonas = await prisma.salesZone.findMany({
      where: applyViewMode({ companyId: user!.companyId }, viewMode),
      include: {
        _count: {
          select: {
            vendedores: true,
            clientes: true,
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    const data = zonas.map((z) => ({
      ...z,
      vendedoresCount: z._count.vendedores,
      clientesCount: z._count.clientes,
      ventasMes: 0, // TODO: Calculate from sales
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching zonas:', error);
    return NextResponse.json({ error: 'Error al obtener zonas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CONFIG_EDIT);
    if (error) return error;

    const body = await req.json();

    // Validate with Zod
    const validation = createSalesZoneSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const zona = await prisma.salesZone.create({
      data: {
        ...validation.data,
        companyId: user!.companyId,
      },
    });

    return NextResponse.json(zona, { status: 201 });
  } catch (error) {
    console.error('Error creating zona:', error);
    return NextResponse.json({ error: 'Error al crear zona' }, { status: 500 });
  }
}
