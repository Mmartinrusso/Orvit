/**
 * Condiciones de Pago (Payment Terms) API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { applyViewMode, getViewMode } from '@/lib/view-mode';
import { createPaymentTermSchema } from '@/lib/ventas/validation-schemas';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CONFIG_VIEW);
    if (error) return error;

    const viewMode = getViewMode(req);

    const condiciones = await prisma.paymentTerm.findMany({
      where: applyViewMode({ companyId: user!.companyId }, viewMode),
      orderBy: { dias: 'asc' },
    });

    return NextResponse.json({ data: condiciones });
  } catch (error) {
    console.error('Error fetching payment terms:', error);
    return NextResponse.json({ error: 'Error al obtener condiciones' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CONFIG_EDIT);
    if (error) return error;

    const body = await req.json();

    // Validate with Zod
    const validation = createPaymentTermSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const condicion = await prisma.paymentTerm.create({
      data: {
        ...validation.data,
        companyId: user!.companyId,
      },
    });

    return NextResponse.json(condicion, { status: 201 });
  } catch (error) {
    console.error('Error creating payment term:', error);
    return NextResponse.json({ error: 'Error al crear condición' }, { status: 500 });
  }
}
