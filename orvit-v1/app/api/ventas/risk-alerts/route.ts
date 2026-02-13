import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getActiveAlerts, getAlertsSummary, resolveAlert } from '@/lib/ventas/risk-alert-service';

export const dynamic = 'force-dynamic';

/**
 * GET - Get active risk alerts
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const severidad = searchParams.get('severidad') as any;
    const categoria = searchParams.get('categoria') as any;
    const documentType = searchParams.get('documentType') as any;
    const limit = parseInt(searchParams.get('limit') || '50');

    const [alerts, summary] = await Promise.all([
      getActiveAlerts(user!.companyId, { severidad, categoria, documentType, limit }),
      getAlertsSummary(user!.companyId)
    ]);

    return NextResponse.json({ alerts, summary });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json({ error: 'Error al obtener alertas' }, { status: 500 });
  }
}

/**
 * POST - Resolve alert
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_EDIT);
    if (error) return error;

    const { alertId, comentario } = await request.json();

    await resolveAlert(alertId, user!.id, comentario);

    return NextResponse.json({ success: true, message: 'Alerta resuelta' });
  } catch (error) {
    console.error('Error resolving alert:', error);
    return NextResponse.json({ error: 'Error al resolver alerta' }, { status: 500 });
  }
}
