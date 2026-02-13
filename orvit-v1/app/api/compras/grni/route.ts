import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { getGRNIStats, getGRNIDetalle, getResumenCierrePeriodo } from '@/lib/compras/grni-helper';
import { getViewMode } from '@/lib/view-mode/get-mode';

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
        name: true,
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
 * GET - Obtener estadísticas y detalle de GRNI
 *
 * Query params:
 * - view: 'stats' | 'detalle' | 'cierre' (default: 'stats')
 * - estado: 'PENDIENTE' | 'FACTURADO' | 'REVERSADO' | 'ANULADO'
 * - supplierId: number
 * - periodoDesde: string (YYYY-MM)
 * - periodoHasta: string (YYYY-MM)
 * - periodo: string (YYYY-MM) - para cierre
 */
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
    const view = searchParams.get('view') || 'stats';
    const viewMode = getViewMode(request);
    const docType = viewMode === 'E' ? null : 'T1'; // En Extended ver todo, en Standard solo T1

    if (view === 'stats') {
      // Estadísticas para Control Tower
      const stats = await getGRNIStats(companyId, docType, prisma);

      return NextResponse.json({
        ...stats,
        docType: docType || 'ALL',
        generatedAt: new Date().toISOString(),
      });
    }

    if (view === 'detalle') {
      // Detalle para reporte
      const filters = {
        estado: searchParams.get('estado') || undefined,
        supplierId: searchParams.get('supplierId') ? parseInt(searchParams.get('supplierId')!) : undefined,
        periodoDesde: searchParams.get('periodoDesde') || undefined,
        periodoHasta: searchParams.get('periodoHasta') || undefined,
        docType: docType || undefined,
      };

      const detalle = await getGRNIDetalle(companyId, filters, prisma);

      return NextResponse.json({
        data: detalle,
        count: detalle.length,
        filters,
        generatedAt: new Date().toISOString(),
      });
    }

    if (view === 'cierre') {
      // Resumen de cierre de período
      const periodo = searchParams.get('periodo');
      if (!periodo) {
        return NextResponse.json(
          { error: 'El parámetro periodo es requerido (formato YYYY-MM)' },
          { status: 400 }
        );
      }

      const resumen = await getResumenCierrePeriodo(companyId, periodo, docType, prisma);

      return NextResponse.json({
        ...resumen,
        docType: docType || 'ALL',
        generatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: 'Vista no válida' }, { status: 400 });
  } catch (error: any) {
    console.error('Error en GRNI API:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener datos de GRNI' },
      { status: 500 }
    );
  }
}
