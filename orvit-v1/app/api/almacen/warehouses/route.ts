import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeWarehouses } from '@/lib/almacen/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/almacen/warehouses
 *
 * Query params:
 * - companyId: number (required)
 * - includeInactive: boolean (optional) - Include inactive warehouses
 * - isTransit: boolean (optional) - Filter only transit warehouses
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const companyId = Number(searchParams.get('companyId'));
    if (!companyId || isNaN(companyId)) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    const includeInactive = searchParams.get('includeInactive') === 'true';
    const isTransit = searchParams.get('isTransit');

    const where: any = { companyId };

    if (!includeInactive) {
      where.isActive = true;
    }

    if (isTransit !== null && isTransit !== undefined) {
      where.isTransit = isTransit === 'true';
    }

    const warehouses = await prisma.warehouse.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { nombre: 'asc' },
      ],
    });

    // Normalizar con adapter para garantizar campos consistentes
    const normalized = normalizeWarehouses(warehouses);

    return NextResponse.json({ warehouses: normalized });
  } catch (error) {
    console.error('Error en GET /api/almacen/warehouses:', error);
    return NextResponse.json(
      { error: 'Error al obtener depósitos' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/almacen/warehouses
 *
 * Body:
 * - codigo: string (required)
 * - nombre: string (required)
 * - descripcion: string (optional)
 * - direccion: string (optional)
 * - isDefault: boolean (optional)
 * - isActive: boolean (optional)
 * - isTransit: boolean (optional)
 * - companyId: number (required)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      codigo,
      nombre,
      descripcion,
      direccion,
      isDefault = false,
      isActive = true,
      isTransit = false,
      companyId,
    } = body;

    if (!codigo || !nombre || !companyId) {
      return NextResponse.json(
        { error: 'codigo, nombre y companyId son requeridos' },
        { status: 400 }
      );
    }

    // Si es default, quitar default de otros
    if (isDefault) {
      await prisma.warehouse.updateMany({
        where: { companyId: Number(companyId), isDefault: true },
        data: { isDefault: false },
      });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        codigo,
        nombre,
        descripcion,
        direccion,
        isDefault,
        isActive,
        isTransit,
        companyId: Number(companyId),
      },
    });

    return NextResponse.json({ warehouse });
  } catch (error) {
    console.error('Error en POST /api/almacen/warehouses:', error);
    return NextResponse.json(
      { error: 'Error al crear depósito' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/almacen/warehouses
 *
 * Body:
 * - id: number (required)
 * - codigo?: string
 * - nombre?: string
 * - descripcion?: string
 * - direccion?: string
 * - isDefault?: boolean
 * - isActive?: boolean
 * - isTransit?: boolean
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id es requerido' },
        { status: 400 }
      );
    }

    const existing = await prisma.warehouse.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Depósito no encontrado' },
        { status: 404 }
      );
    }

    // Si se está seteando como default, quitar default de otros
    if (updateData.isDefault) {
      await prisma.warehouse.updateMany({
        where: {
          companyId: existing.companyId,
          isDefault: true,
          id: { not: Number(id) },
        },
        data: { isDefault: false },
      });
    }

    const warehouse = await prisma.warehouse.update({
      where: { id: Number(id) },
      data: updateData,
    });

    return NextResponse.json({ warehouse });
  } catch (error) {
    console.error('Error en PATCH /api/almacen/warehouses:', error);
    return NextResponse.json(
      { error: 'Error al actualizar depósito' },
      { status: 500 }
    );
  }
}
