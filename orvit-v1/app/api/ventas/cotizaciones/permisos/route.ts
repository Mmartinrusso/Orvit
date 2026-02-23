import { NextResponse } from 'next/server';
import { requirePermission, checkPermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// GET - Verificar permisos del cotizador para el usuario autenticado
export async function GET() {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_VIEW);
    if (error) return error;

    const [canViewCosts, canViewMargins, canOverrideMargins] = await Promise.all([
      checkPermission(user!.id, user!.companyId, VENTAS_PERMISSIONS.COSTS_VIEW),
      checkPermission(user!.id, user!.companyId, VENTAS_PERMISSIONS.MARGINS_VIEW),
      checkPermission(user!.id, user!.companyId, VENTAS_PERMISSIONS.MARGINS_OVERRIDE),
    ]);

    return NextResponse.json({ canViewCosts, canViewMargins, canOverrideMargins });
  } catch (error) {
    console.error('Error fetching quote permissions:', error);
    return NextResponse.json({ error: 'Error al obtener permisos' }, { status: 500 });
  }
}
