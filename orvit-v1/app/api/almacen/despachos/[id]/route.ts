import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/almacen/despachos/[id]
 *
 * Get a single despacho by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const despacho = await prisma.despacho.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            supplierItem: {
              select: {
                id: true,
                nombre: true,
                codigoProveedor: true,
                unidad: true,
                supplier: {
                  select: { id: true, name: true },
                },
              },
            },
            tool: {
              select: { id: true, name: true, code: true },
            },
            stockLocation: {
              select: {
                id: true,
                ubicacion: true,
                ubicacionFisica: true,
              },
            },
            stockMovement: {
              select: {
                id: true,
                cantidad: true,
                cantidadAnterior: true,
                cantidadPosterior: true,
                createdAt: true,
              },
            },
          },
        },
        warehouse: {
          select: { id: true, nombre: true, codigo: true },
        },
        materialRequest: {
          select: {
            id: true,
            numero: true,
            tipo: true,
            estado: true,
            motivo: true,
            solicitante: {
              select: { id: true, name: true },
            },
          },
        },
        workOrder: {
          select: {
            id: true,
            orderNumber: true,
            description: true,
            status: true,
          },
        },
        productionOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            product: {
              select: { id: true, name: true },
            },
          },
        },
        despachador: {
          select: { id: true, name: true, email: true },
        },
        receptor: {
          select: { id: true, name: true },
        },
        destinatario: {
          select: { id: true, name: true },
        },
        company: {
          select: { id: true, name: true },
        },
      },
    });

    if (!despacho) {
      return NextResponse.json(
        { error: 'Despacho no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ despacho });
  } catch (error) {
    console.error('Error en GET /api/almacen/despachos/[id]:', error);
    return NextResponse.json(
      { error: 'Error al obtener despacho' },
      { status: 500 }
    );
  }
}
