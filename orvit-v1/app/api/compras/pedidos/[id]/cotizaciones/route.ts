import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    return user;
  } catch {
    return null;
  }
}

/**
 * GET - Obtener cotizaciones de un pedido (lazy loading)
 * Endpoint separado para cargar cotizaciones solo cuando se necesitan
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { id } = await params;
    const pedidoId = parseInt(id);

    // Verificar que el pedido existe y pertenece a la empresa
    const pedido = await prisma.purchaseRequest.findFirst({
      where: { id: pedidoId, companyId },
      select: { id: true }
    });

    if (!pedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    // Obtener cotizaciones con todos los detalles
    const quotations = await prisma.purchaseQuotation.findMany({
      where: { requestId: pedidoId },
      select: {
        id: true,
        numero: true,
        estado: true,
        total: true,
        subtotal: true,
        impuestos: true,
        descuento: true,
        moneda: true,
        esSeleccionada: true,
        fechaCotizacion: true,
        validezHasta: true,
        plazoEntrega: true,
        fechaEntregaEstimada: true,
        condicionesPago: true,
        formaPago: true,
        garantia: true,
        observaciones: true,
        adjuntos: true,
        createdAt: true,
        supplier: {
          select: { id: true, name: true, email: true, phone: true }
        },
        createdByUser: {
          select: { id: true, name: true }
        },
        seleccionadaByUser: {
          select: { id: true, name: true }
        },
        items: {
          select: {
            id: true,
            descripcion: true,
            cantidad: true,
            unidad: true,
            precioUnitario: true,
            descuento: true,
            subtotal: true,
            supplierItemId: true,
            supplierItem: {
              select: {
                id: true,
                nombre: true,
                codigoProveedor: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      data: quotations,
      count: quotations.length
    });
  } catch (error: any) {
    console.error('Error fetching quotations:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener cotizaciones' },
      { status: 500 }
    );
  }
}
