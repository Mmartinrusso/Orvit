import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { applyViewMode } from '@/lib/view-mode/prisma-helper';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
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
  } catch (error) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const viewMode = getViewMode(request);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Get all items grouped by description
    const itemsAgrupados = await prisma.purchaseReceiptItem.groupBy({
      by: ['descripcion'],
      where: {
        companyId,
        comprobante: applyViewMode({
          fechaEmision: { gte: sixMonthsAgo }
        }, viewMode)
      },
      _sum: { cantidad: true, subtotal: true },
      _avg: { precioUnitario: true },
      _count: { id: true }
    });

    // For each item, get provider count and price variation
    const result = await Promise.all(
      itemsAgrupados.map(async (item) => {
        // Get number of distinct proveedores
        const proveedoresCount = await prisma.purchaseReceiptItem.findMany({
          where: {
            companyId,
            descripcion: item.descripcion,
            comprobante: applyViewMode({
              fechaEmision: { gte: sixMonthsAgo }
            }, viewMode)
          },
          select: {
            comprobante: {
              select: { proveedorId: true }
            }
          },
          distinct: ['comprobante']
        });

        const uniqueProveedores = new Set(proveedoresCount.map(p => p.comprobante.proveedorId));

        // Get last two prices for variation
        const ultimasCompras = await prisma.purchaseReceiptItem.findMany({
          where: {
            companyId,
            descripcion: item.descripcion,
            comprobante: applyViewMode({}, viewMode)
          },
          select: {
            precioUnitario: true,
            comprobante: {
              select: { fechaEmision: true }
            }
          },
          orderBy: { comprobante: { fechaEmision: 'desc' } },
          take: 2
        });

        let variacionPrecio = 0;
        if (ultimasCompras.length >= 2) {
          const precioActual = Number(ultimasCompras[0].precioUnitario || 0);
          const precioAnterior = Number(ultimasCompras[1].precioUnitario || 0);
          if (precioAnterior > 0) {
            variacionPrecio = ((precioActual - precioAnterior) / precioAnterior) * 100;
          }
        }

        return {
          descripcion: item.descripcion,
          codigo: null, // Could be added if item has a code
          totalComprado: Number(item._sum.subtotal || 0),
          cantidadTotal: Number(item._sum.cantidad || 0),
          precioPromedio: Number(item._avg.precioUnitario || 0),
          variacionPrecio: Math.round(variacionPrecio * 10) / 10,
          cantidadProveedores: uniqueProveedores.size,
          ultimaCompra: ultimasCompras[0]?.comprobante?.fechaEmision?.toISOString() || null
        };
      })
    );

    // Sort by total purchased
    result.sort((a, b) => b.totalComprado - a.totalComprado);

    return NextResponse.json({ items: result });
  } catch (error) {
    console.error('Error fetching items list:', error);
    return NextResponse.json(
      { error: 'Error al obtener lista de items' },
      { status: 500 }
    );
  }
}
