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

    // Get all proveedores with purchase activity
    const comprasAgrupadas = await prisma.purchaseReceipt.groupBy({
      by: ['proveedorId'],
      where: applyViewMode({
        companyId,
        fechaEmision: { gte: sixMonthsAgo }
      }, viewMode),
      _sum: { total: true },
      _count: { id: true },
      _max: { fechaEmision: true }
    });

    // Get proveedor details
    const proveedorIds = comprasAgrupadas.map(c => c.proveedorId);
    const proveedores = await prisma.suppliers.findMany({
      where: { id: { in: proveedorIds } },
      select: { id: true, name: true, cuit: true }
    });
    const proveedoresMap = new Map(proveedores.map(p => [p.id, p]));

    // Get deuda pendiente for each proveedor
    const deudasAgrupadas = await prisma.purchaseReceipt.groupBy({
      by: ['proveedorId'],
      where: applyViewMode({
        companyId,
        estado: { in: ['pendiente', 'parcial'] }
      }, viewMode),
      _sum: { total: true }
    });
    const deudasMap = new Map(deudasAgrupadas.map(d => [d.proveedorId, Number(d._sum.total || 0)]));

    // Calculate month-over-month variation for top proveedores
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [currentMonthByProv, prevMonthByProv] = await Promise.all([
      prisma.purchaseReceipt.groupBy({
        by: ['proveedorId'],
        where: applyViewMode({
          companyId,
          fechaEmision: { gte: startOfMonth }
        }, viewMode),
        _sum: { total: true }
      }),
      prisma.purchaseReceipt.groupBy({
        by: ['proveedorId'],
        where: applyViewMode({
          companyId,
          fechaEmision: { gte: startOfPrevMonth, lte: endOfPrevMonth }
        }, viewMode),
        _sum: { total: true }
      })
    ]);

    const currentMonthMap = new Map(currentMonthByProv.map(c => [c.proveedorId, Number(c._sum.total || 0)]));
    const prevMonthMap = new Map(prevMonthByProv.map(c => [c.proveedorId, Number(c._sum.total || 0)]));

    // Build response
    const result = comprasAgrupadas
      .map(c => {
        const prov = proveedoresMap.get(c.proveedorId);
        const currentMonth = currentMonthMap.get(c.proveedorId) || 0;
        const prevMonth = prevMonthMap.get(c.proveedorId) || 0;
        const variacion = prevMonth > 0 ? ((currentMonth - prevMonth) / prevMonth) * 100 : 0;

        return {
          id: c.proveedorId,
          nombre: prov?.name || 'Proveedor desconocido',
          cuit: prov?.cuit || null,
          totalCompras: Number(c._sum.total || 0),
          cantidadFacturas: c._count.id,
          deudaPendiente: deudasMap.get(c.proveedorId) || 0,
          ultimaCompra: c._max.fechaEmision?.toISOString() || null,
          variacionMensual: Math.round(variacion * 10) / 10
        };
      })
      .sort((a, b) => b.totalCompras - a.totalCompras);

    return NextResponse.json({ proveedores: result });
  } catch (error) {
    console.error('Error fetching proveedores list:', error);
    return NextResponse.json(
      { error: 'Error al obtener lista de proveedores' },
      { status: 500 }
    );
  }
}
