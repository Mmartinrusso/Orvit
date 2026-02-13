import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import {
  listAutoPaymentConfigs,
  getAutoPaymentStats,
  processAllPendingAutoPayments,
} from '@/lib/billing/auto-payment';

export const dynamic = 'force-dynamic';

// GET - Listar configuraciones de débito automático o estadísticas
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Obtener estadísticas
    if (action === 'stats') {
      const stats = await getAutoPaymentStats();
      return NextResponse.json(stats);
    }

    // Listar configuraciones
    const provider = searchParams.get('provider') as 'STRIPE' | 'MERCADOPAGO' | null;
    const isEnabled = searchParams.get('enabled');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await listAutoPaymentConfigs({
      provider: provider || undefined,
      isEnabled: isEnabled !== null ? isEnabled === 'true' : undefined,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching auto-payment configs:', error);
    return NextResponse.json({ error: 'Error al obtener configuraciones' }, { status: 500 });
  }
}

// POST - Procesar pagos pendientes (manual trigger)
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'process_pending') {
      const results = await processAllPendingAutoPayments();
      return NextResponse.json({
        success: true,
        results,
      });
    }

    return NextResponse.json(
      { error: 'Acción no válida. Usar: process_pending' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing auto-payments:', error);
    return NextResponse.json({ error: 'Error procesando pagos' }, { status: 500 });
  }
}
