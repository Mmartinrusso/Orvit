import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requirePermission } from '@/lib/auth/shared-helpers';

// GET /api/companies/[id]/settings - Obtener configuración de la empresa
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const companyId = parseInt(params.id);

    if (isNaN(companyId)) {
      return NextResponse.json(
        { error: 'ID de empresa inválido' },
        { status: 400 }
      );
    }

    // Buscar o crear settings
    let settings = await prisma.companySettings.findUnique({
      where: { companyId },
    });

    if (!settings) {
      // Crear settings por defecto
      settings = await prisma.companySettings.create({
        data: {
          companyId,
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching company settings:', error);
    return NextResponse.json(
      { error: 'Error al obtener configuración' },
      { status: 500 }
    );
  }
}

// PATCH /api/companies/[id]/settings - Actualizar configuración de la empresa
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { error: permError } = await requirePermission('settings.edit');
  if (permError) return permError;

  try {
    const companyId = parseInt(params.id);

    if (isNaN(companyId)) {
      return NextResponse.json(
        { error: 'ID de empresa inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Campos permitidos para actualizar
    const updateData: Record<string, any> = {};

    if (body.batchLabel !== undefined) updateData.batchLabel = body.batchLabel;
    if (body.intermediateLabel !== undefined) updateData.intermediateLabel = body.intermediateLabel;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.machineOrder !== undefined) updateData.machineOrder = body.machineOrder;
    if (body.toleranciaFaltante !== undefined) updateData.toleranciaFaltante = body.toleranciaFaltante;
    if (body.toleranciaPrecio !== undefined) updateData.toleranciaPrecio = body.toleranciaPrecio;
    if (body.requireDespachoSignature !== undefined) updateData.requireDespachoSignature = body.requireDespachoSignature;

    // Upsert settings
    const settings = await prisma.companySettings.upsert({
      where: { companyId },
      update: updateData,
      create: {
        companyId,
        ...updateData,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating company settings:', error);
    return NextResponse.json(
      { error: 'Error al actualizar configuración' },
      { status: 500 }
    );
  }
}
