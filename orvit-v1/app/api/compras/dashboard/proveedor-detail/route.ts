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
    const proveedorId = parseInt(searchParams.get('id') || '0');

    if (!proveedorId) {
      return NextResponse.json({ error: 'ID de proveedor requerido' }, { status: 400 });
    }

    const viewMode = getViewMode(request);

    // Get proveedor basic info
    const proveedor = await prisma.suppliers.findUnique({
      where: { id: proveedorId },
      select: {
        id: true,
        name: true,
        cuit: true
      }
    });

    if (!proveedor) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Get total compras and facturas count
    const [comprasData, deudaData, ultimaCompraData] = await Promise.all([
      prisma.purchaseReceipt.aggregate({
        where: applyViewMode({
          companyId,
          proveedorId,
          fechaEmision: { gte: sixMonthsAgo }
        }, viewMode),
        _sum: { total: true },
        _count: { id: true }
      }),
      prisma.purchaseReceipt.aggregate({
        where: applyViewMode({
          companyId,
          proveedorId,
          estado: { in: ['pendiente', 'parcial'] }
        }, viewMode),
        _sum: { total: true }
      }),
      prisma.purchaseReceipt.findFirst({
        where: applyViewMode({ companyId, proveedorId }, viewMode),
        orderBy: { fechaEmision: 'desc' },
        select: { fechaEmision: true }
      })
    ]);

    // Get compras por mes
    const comprasPorMes: Array<{ mes: string; total: number }> = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);

      const compras = await prisma.purchaseReceipt.aggregate({
        where: applyViewMode({
          companyId,
          proveedorId,
          fechaEmision: { gte: startOfMonth, lte: endOfMonth }
        }, viewMode),
        _sum: { total: true }
      });

      const mesNombre = targetDate.toLocaleDateString('es-AR', { month: 'short' });
      comprasPorMes.push({
        mes: mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1),
        total: Number(compras._sum.total || 0)
      });
    }

    // Get top items from this proveedor
    const topItems = await prisma.purchaseReceiptItem.groupBy({
      by: ['descripcion'],
      where: {
        companyId,
        comprobante: applyViewMode({
          proveedorId,
          fechaEmision: { gte: sixMonthsAgo }
        }, viewMode)
      },
      _sum: { cantidad: true, subtotal: true },
      orderBy: { _sum: { subtotal: 'desc' } },
      take: 5
    });

    // Get recent facturas
    const facturasRecientes = await prisma.purchaseReceipt.findMany({
      where: applyViewMode({ companyId, proveedorId }, viewMode),
      orderBy: { fechaEmision: 'desc' },
      select: {
        id: true,
        numero: true,
        fechaEmision: true,
        total: true,
        estado: true
      },
      take: 5
    });

    const response = {
      id: proveedor.id,
      nombre: proveedor.name,
      cuit: proveedor.cuit,
      totalCompras: Number(comprasData._sum.total || 0),
      totalFacturas: comprasData._count.id,
      deudaPendiente: Number(deudaData._sum.total || 0),
      ultimaCompra: ultimaCompraData?.fechaEmision?.toISOString() || null,
      comprasPorMes,
      topItems: topItems.map(i => ({
        descripcion: i.descripcion,
        cantidad: Number(i._sum.cantidad || 0),
        total: Number(i._sum.subtotal || 0)
      })),
      facturasRecientes: facturasRecientes.map(f => ({
        id: f.id,
        numero: f.numero,
        fecha: f.fechaEmision.toISOString(),
        total: Number(f.total || 0),
        estado: f.estado
      }))
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching proveedor detail:', error);
    return NextResponse.json(
      { error: 'Error al obtener detalles del proveedor' },
      { status: 500 }
    );
  }
}
