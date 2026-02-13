import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// GET - Datos para gráfico de líneas: últimos 12 meses de ventas/cotizaciones/cobranzas
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.DASHBOARD_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const ahora = new Date();
    const hace12Meses = new Date(ahora.getFullYear(), ahora.getMonth() - 11, 1);

    // Ejecutar 3 queries en paralelo: cotizaciones, ventas, cobranzas
    const [cotizacionesResult, ventasResult, cobranzasResult] = await Promise.all([
      // Cotizaciones agrupadas por mes
      prisma.$queryRaw`
        SELECT
          TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') as mes,
          COUNT(*)::int as cantidad,
          COALESCE(SUM(total), 0)::float as monto
        FROM "quotes"
        WHERE "companyId" = ${companyId}
          AND "createdAt" >= ${hace12Meses}
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY mes ASC
      ` as Promise<Array<{ mes: string; cantidad: number; monto: number }>>,

      // Ventas (Sales) con total de pagos
      prisma.$queryRaw`
        SELECT
          TO_CHAR(DATE_TRUNC('month', s."fechaEmision"), 'YYYY-MM') as mes,
          COUNT(*)::int as cantidad,
          COALESCE(SUM(s.total), 0)::float as monto
        FROM "sales" s
        WHERE s."companyId" = ${companyId}
          AND s."fechaEmision" >= ${hace12Meses}
        GROUP BY DATE_TRUNC('month', s."fechaEmision")
        ORDER BY mes ASC
      ` as Promise<Array<{ mes: string; cantidad: number; monto: number }>>,

      // Cobranzas (ClientPayments)
      prisma.$queryRaw`
        SELECT
          TO_CHAR(DATE_TRUNC('month', cp."fechaPago"), 'YYYY-MM') as mes,
          COUNT(*)::int as cantidad,
          COALESCE(SUM(cp."totalPago"), 0)::float as monto
        FROM "client_payments" cp
        WHERE cp."companyId" = ${companyId}
          AND cp."fechaPago" >= ${hace12Meses}
        GROUP BY DATE_TRUNC('month', cp."fechaPago")
        ORDER BY mes ASC
      ` as Promise<Array<{ mes: string; cantidad: number; monto: number }>>,
    ]);

    // Crear mapa de 12 meses con datos combinados
    const mesesMap = new Map<string, {
      mes: string;
      cotizaciones: number;
      cotizacionesMonto: number;
      ventas: number;
      ventasMonto: number;
      cobranzas: number;
      cobranzasMonto: number;
    }>();

    // Generar los 12 meses
    for (let i = 0; i < 12; i++) {
      const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - 11 + i, 1);
      const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      mesesMap.set(mesKey, {
        mes: mesKey,
        cotizaciones: 0,
        cotizacionesMonto: 0,
        ventas: 0,
        ventasMonto: 0,
        cobranzas: 0,
        cobranzasMonto: 0,
      });
    }

    // Llenar datos de cotizaciones
    for (const row of cotizacionesResult) {
      const entry = mesesMap.get(row.mes);
      if (entry) {
        entry.cotizaciones = Number(row.cantidad);
        entry.cotizacionesMonto = Number(row.monto);
      }
    }

    // Llenar datos de ventas
    for (const row of ventasResult) {
      const entry = mesesMap.get(row.mes);
      if (entry) {
        entry.ventas = Number(row.cantidad);
        entry.ventasMonto = Number(row.monto);
      }
    }

    // Llenar datos de cobranzas
    for (const row of cobranzasResult) {
      const entry = mesesMap.get(row.mes);
      if (entry) {
        entry.cobranzas = Number(row.cantidad);
        entry.cobranzasMonto = Number(row.monto);
      }
    }

    const data = Array.from(mesesMap.values());

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching grafico temporal:', error);
    return NextResponse.json(
      { error: 'Error al obtener datos del gráfico temporal', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
