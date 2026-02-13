import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Verificar autorización del cron
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Si no hay CRON_SECRET configurado, permitir solo en desarrollo
  if (!cronSecret) {
    return process.env.NODE_ENV === 'development';
  }

  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Cron Job: Vencimiento de Cotizaciones de Ventas
 *
 * Reglas Enterprise:
 * | Estado Actual      | fechaValidez < hoy | Acción                           |
 * |--------------------|-------------------|----------------------------------|
 * | BORRADOR           | Sí                | → VENCIDA                        |
 * | ENVIADA            | Sí                | → VENCIDA                        |
 * | EN_NEGOCIACION     | Sí                | → VENCIDA                        |
 * | ACEPTADA           | Sí                | Solo isExpired=true (NO cambia)  |
 * | CONVERTIDA         | Sí                | Solo isExpired=true (NO cambia)  |
 * | PERDIDA            | Sí                | No tocar                         |
 * | VENCIDA            | Sí                | Ya está                          |
 *
 * Configurar en Vercel: vercel.json con crons
 * O usar servicio externo (cron-job.org, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autorización
    if (!verifyCronAuth(request)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // 1. Cambiar estado a VENCIDA para estados activos que pueden vencer
    // (BORRADOR, ENVIADA, EN_NEGOCIACION)
    const vencidas = await prisma.quote.updateMany({
      where: {
        estado: { in: ['BORRADOR', 'ENVIADA', 'EN_NEGOCIACION'] },
        fechaValidez: { lt: hoy },
        OR: [
          { isExpired: false },
          { isExpired: null }
        ]
      },
      data: {
        estado: 'VENCIDA',
        isExpired: true
      }
    });

    // 2. Solo marcar isExpired (NO cambiar estado) para ACEPTADA y CONVERTIDA
    // Estas cotizaciones ya fueron exitosas, solo marcamos que pasó la fecha
    const expiradasSinCambio = await prisma.quote.updateMany({
      where: {
        estado: { in: ['ACEPTADA', 'CONVERTIDA'] },
        fechaValidez: { lt: hoy },
        OR: [
          { isExpired: false },
          { isExpired: null }
        ]
      },
      data: {
        isExpired: true
      }
    });

    // 3. Obtener lista de cotizaciones que cambiaron a VENCIDA para logging
    const cotizacionesVencidas = await prisma.quote.findMany({
      where: {
        estado: 'VENCIDA',
        isExpired: true,
        updatedAt: { gte: new Date(Date.now() - 60000) } // Últimos 60 segundos
      },
      select: {
        id: true,
        numero: true,
        companyId: true,
        total: true,
        client: {
          select: { legalName: true, name: true }
        }
      },
      take: 100
    });

    // Log de resultados
    console.log(`[Cron] Cotizaciones ventas vencimiento:
      - Cambiadas a VENCIDA: ${vencidas.count}
      - Marcadas isExpired (sin cambio estado): ${expiradasSinCambio.count}
    `);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      resultados: {
        vencidas: vencidas.count,
        marcadasExpired: expiradasSinCambio.count,
        total: vencidas.count + expiradasSinCambio.count
      },
      detalleVencidas: cotizacionesVencidas.map(c => ({
        id: c.id,
        numero: c.numero,
        companyId: c.companyId,
        cliente: c.client.legalName || c.client.name,
        total: Number(c.total)
      }))
    });
  } catch (error) {
    console.error('[Cron] Error en cotizaciones-ventas-vencimiento:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al procesar vencimientos',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// También soportar POST para llamadas manuales
export async function POST(request: NextRequest) {
  return GET(request);
}
