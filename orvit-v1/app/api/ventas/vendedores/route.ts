/**
 * Vendedores (Sales Reps) API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { createSalesRepSchema } from '@/lib/ventas/validation-schemas';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CONFIG_VIEW);
    if (error) return error;

    const vendedores = await prisma.salesRep.findMany({
      where: { companyId: user!.companyId },
      include: {
        zona: { select: { id: true, nombre: true } },
      },
      orderBy: { nombre: 'asc' },
    });

    return NextResponse.json({ data: vendedores });
  } catch (error) {
    console.error('Error fetching vendedores:', error);
    return NextResponse.json({ error: 'Error al obtener vendedores' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CONFIG_EDIT);
    if (error) return error;

    const body = await req.json();

    // Validate with centralized Zod schema
    const validation = createSalesRepSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const vendedor = await prisma.salesRep.create({
      data: {
        ...validation.data,
        companyId: user!.companyId,
        ventasMes: 0,
        ventasAnio: 0,
      },
    });

    return NextResponse.json(vendedor, { status: 201 });
  } catch (error) {
    console.error('Error creating vendedor:', error);
    return NextResponse.json({ error: 'Error al crear vendedor' }, { status: 500 });
  }
}
