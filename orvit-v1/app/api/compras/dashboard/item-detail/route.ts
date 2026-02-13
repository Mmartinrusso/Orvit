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

    const { searchParams } = new URL(request.url);
    const descripcion = searchParams.get('descripcion');

    if (!descripcion) {
      return NextResponse.json({ error: 'Descripcion de item requerida' }, { status: 400 });
    }

    const viewMode = getViewMode(request);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Get total for this item (by description match)
    const itemStats = await prisma.purchaseReceiptItem.aggregate({
      where: {
        companyId,
        descripcion: { contains: descripcion, mode: 'insensitive' },
        comprobante: applyViewMode({
          fechaEmision: { gte: sixMonthsAgo }
        }, viewMode)
      },
      _sum: { cantidad: true, subtotal: true },
      _avg: { precioUnitario: true }
    });

    // Get proveedores for this item
    const itemsByProveedor = await prisma.purchaseReceiptItem.findMany({
      where: {
        companyId,
        descripcion: { contains: descripcion, mode: 'insensitive' },
        comprobante: applyViewMode({
          fechaEmision: { gte: sixMonthsAgo }
        }, viewMode)
      },
      select: {
        cantidad: true,
        precioUnitario: true,
        comprobante: {
          select: {
            proveedorId: true,
            proveedor: { select: { id: true, name: true } },
            fechaEmision: true
          }
        }
      },
      orderBy: { comprobante: { fechaEmision: 'desc' } }
    });

    // Group by proveedor
    const proveedoresMap = new Map<number, {
      id: number;
      nombre: string;
      ultimoPrecio: number;
      cantidad: number;
    }>();

    for (const item of itemsByProveedor) {
      const provId = item.comprobante.proveedorId;
      if (!proveedoresMap.has(provId)) {
        proveedoresMap.set(provId, {
          id: provId,
          nombre: item.comprobante.proveedor?.name || 'Desconocido',
          ultimoPrecio: Number(item.precioUnitario || 0),
          cantidad: Number(item.cantidad || 0)
        });
      } else {
        const existing = proveedoresMap.get(provId)!;
        existing.cantidad += Number(item.cantidad || 0);
      }
    }

    // Sort by lowest price
    const proveedores = Array.from(proveedoresMap.values())
      .sort((a, b) => a.ultimoPrecio - b.ultimoPrecio);

    // Get compras por mes
    const comprasPorMes: Array<{ mes: string; cantidad: number; total: number }> = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);

      const compras = await prisma.purchaseReceiptItem.aggregate({
        where: {
          companyId,
          descripcion: { contains: descripcion, mode: 'insensitive' },
          comprobante: applyViewMode({
            fechaEmision: { gte: startOfMonth, lte: endOfMonth }
          }, viewMode)
        },
        _sum: { cantidad: true, subtotal: true }
      });

      const mesNombre = targetDate.toLocaleDateString('es-AR', { month: 'short' });
      comprasPorMes.push({
        mes: mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1),
        cantidad: Number(compras._sum.cantidad || 0),
        total: Number(compras._sum.subtotal || 0)
      });
    }

    // Get ultimas compras
    const ultimasCompras = await prisma.purchaseReceiptItem.findMany({
      where: {
        companyId,
        descripcion: { contains: descripcion, mode: 'insensitive' },
        comprobante: applyViewMode({}, viewMode)
      },
      select: {
        cantidad: true,
        precioUnitario: true,
        comprobante: {
          select: {
            fechaEmision: true,
            proveedor: { select: { name: true } }
          }
        }
      },
      orderBy: { comprobante: { fechaEmision: 'desc' } },
      take: 5
    });

    const response = {
      descripcion,
      codigo: null, // Could be added if item has a code
      totalComprado: Number(itemStats._sum.subtotal || 0),
      cantidadTotal: Number(itemStats._sum.cantidad || 0),
      precioPromedio: Number(itemStats._avg.precioUnitario || 0),
      proveedores,
      comprasPorMes,
      ultimasCompras: ultimasCompras.map(c => ({
        fecha: c.comprobante.fechaEmision.toISOString(),
        proveedor: c.comprobante.proveedor?.name || 'Desconocido',
        cantidad: Number(c.cantidad || 0),
        precio: Number(c.precioUnitario || 0)
      }))
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching item detail:', error);
    return NextResponse.json(
      { error: 'Error al obtener detalles del item' },
      { status: 500 }
    );
  }
}
