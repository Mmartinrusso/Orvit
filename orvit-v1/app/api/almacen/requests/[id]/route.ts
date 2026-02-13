import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/almacen/requests/[id]
 *
 * Get a single material request by ID
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

    const materialRequest = await prisma.materialRequest.findUnique({
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
          },
        },
        reservations: {
          select: {
            id: true,
            supplierItemId: true,
            cantidad: true,
            cantidadConsumida: true,
            estado: true,
            warehouse: {
              select: { id: true, nombre: true },
            },
          },
        },
        despachos: {
          select: {
            id: true,
            numero: true,
            estado: true,
            fechaDespacho: true,
            items: {
              select: {
                supplierItemId: true,
                cantidadDespachada: true,
              },
            },
          },
        },
        solicitante: {
          select: { id: true, name: true, email: true },
        },
        destinatario: {
          select: { id: true, name: true },
        },
        aprobador: {
          select: { id: true, name: true },
        },
        warehouse: {
          select: { id: true, nombre: true },
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
        company: {
          select: { id: true, name: true },
        },
      },
    });

    if (!materialRequest) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ request: materialRequest });
  } catch (error) {
    console.error('Error en GET /api/almacen/requests/[id]:', error);
    return NextResponse.json(
      { error: 'Error al obtener solicitud' },
      { status: 500 }
    );
  }
}
