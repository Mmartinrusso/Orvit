/**
 * API: /api/mantenimiento/unidades-moviles/[id]
 *
 * GET - Obtener una unidad móvil específica
 * PUT - Actualizar una unidad móvil
 * DELETE - Eliminar una unidad móvil
 *
 * ✅ OPTIMIZADO:
 * - Validación con Zod
 * - Autenticación con verifyToken
 * - Queries optimizadas (sin findUnique redundantes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { updateUnidadMovilSchema, validateSafe } from '@/lib/unidades-moviles/validations';

// GET - Obtener una unidad móvil específica
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const companyId = payload.companyId as number;

    // 2. Obtener unidad con work orders count (companyId siempre del JWT)
    const unidad = await prisma.unidadMovil.findFirst({
      where: { id, companyId },
      include: {
        sector: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            workOrders: {
              where: {
                status: { in: ['PENDING', 'IN_PROGRESS'] }
              }
            }
          }
        }
      }
    });

    if (!unidad) {
      return NextResponse.json(
        { error: 'Unidad móvil no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      unidad: {
        ...unidad,
        workOrdersCount: unidad._count.workOrders,
        _count: undefined
      }
    });

  } catch (error) {
    console.error('❌ Error en GET /api/mantenimiento/unidades-moviles/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar una unidad móvil
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Parsear y validar body
    const body = await request.json();
    const validation = validateSafe(updateUnidadMovilSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.errors.join(', ') },
        { status: 400 }
      );
    }

    const data = validation.data;
    const companyId = payload.companyId as number; // Siempre del JWT

    // 3. ✅ OPTIMIZADO: Verificar duplicado solo si se proporciona patente
    if (data.patente) {
      const duplicate = await prisma.unidadMovil.findFirst({
        where: {
          patente: data.patente,
          companyId,
          id: { not: id }
        },
        select: { id: true }
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'Ya existe otra unidad móvil con esta patente' },
          { status: 400 }
        );
      }
    }

    // 4. Actualizar directamente con companyId en WHERE para evitar cross-tenant
    try {
      const unidad = await prisma.unidadMovil.update({
        where: { id, companyId },
        data: {
          ...(data.nombre !== undefined && { nombre: data.nombre }),
          ...(data.tipo !== undefined && { tipo: data.tipo }),
          ...(data.marca !== undefined && { marca: data.marca }),
          ...(data.modelo !== undefined && { modelo: data.modelo }),
          ...(data.año !== undefined && { año: data.año }),
          ...(data.patente !== undefined && { patente: data.patente }),
          ...(data.numeroChasis !== undefined && { numeroChasis: data.numeroChasis }),
          ...(data.numeroMotor !== undefined && { numeroMotor: data.numeroMotor }),
          ...(data.kilometraje !== undefined && { kilometraje: data.kilometraje }),
          ...(data.estado !== undefined && { estado: data.estado }),
          ...(data.sectorId !== undefined && { sectorId: data.sectorId }),
          ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
          ...(data.fechaAdquisicion !== undefined && {
            fechaAdquisicion: data.fechaAdquisicion ? new Date(data.fechaAdquisicion) : null
          }),
          ...(data.valorAdquisicion !== undefined && { valorAdquisicion: data.valorAdquisicion }),
          ...(data.proveedor !== undefined && { proveedor: data.proveedor }),
          ...(data.garantiaHasta !== undefined && {
            garantiaHasta: data.garantiaHasta ? new Date(data.garantiaHasta) : null
          }),
          ...(data.combustible !== undefined && { combustible: data.combustible }),
          ...(data.capacidadCombustible !== undefined && { capacidadCombustible: data.capacidadCombustible }),
          ...(data.consumoPromedio !== undefined && { consumoPromedio: data.consumoPromedio }),
          ...(data.kmUpdateFrequencyDays !== undefined && { kmUpdateFrequencyDays: data.kmUpdateFrequencyDays }),
          updatedAt: new Date()
        },
        include: {
          sector: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              workOrders: {
                where: {
                  status: { in: ['PENDING', 'IN_PROGRESS'] }
                }
              }
            }
          }
        }
      });

      return NextResponse.json({
        success: true,
        unidad: {
          ...unidad,
          workOrdersCount: unidad._count.workOrders,
          _count: undefined
        },
        message: 'Unidad móvil actualizada correctamente'
      });
    } catch (prismaError: any) {
      if (prismaError.code === 'P2025') {
        return NextResponse.json(
          { error: 'Unidad móvil no encontrada' },
          { status: 404 }
        );
      }
      throw prismaError;
    }

  } catch (error) {
    console.error('❌ Error en PUT /api/mantenimiento/unidades-moviles/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar una unidad móvil
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const companyId = payload.companyId as number;

    // 2. Eliminar con companyId en WHERE para evitar cross-tenant
    try {
      await prisma.unidadMovil.delete({
        where: { id, companyId }
      });

      return NextResponse.json({
        success: true,
        message: 'Unidad móvil eliminada correctamente'
      });
    } catch (prismaError: any) {
      if (prismaError.code === 'P2025') {
        return NextResponse.json(
          { error: 'Unidad móvil no encontrada' },
          { status: 404 }
        );
      }
      throw prismaError;
    }

  } catch (error) {
    console.error('❌ Error en DELETE /api/mantenimiento/unidades-moviles/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
