/**
 * API: /api/solutions-applied
 *
 * GET - Obtener historial de soluciones aplicadas con filtros y paginación
 *       Usado para: biblioteca de soluciones, top soluciones, soluciones similares
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import {
  getTopSolutions,
  getSolutionHistory,
  findSimilarSolutions
} from '@/lib/corrective/solution-history';

export const dynamic = 'force-dynamic';

/**
 * GET /api/solutions-applied
 * Obtiene historial de soluciones aplicadas
 *
 * Query params:
 * - mode: 'top' | 'history' | 'similar' (default: 'history')
 * - limit: número de resultados (default: 50, max: 200)
 * - offset: para paginación (default: 0)
 * - machineId: filtrar por máquina
 * - componentId: filtrar por componente
 * - subcomponentId: filtrar por subcomponente
 * - minEffectiveness: mínimo de efectividad (1-5, default: 3 para 'top')
 * - startDate: fecha inicio (ISO string)
 * - endDate: fecha fin (ISO string)
 * - outcome: 'FUNCIONÓ' | 'PARCIAL' | 'NO_FUNCIONÓ'
 * - title: búsqueda de texto (para mode='similar')
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;

    // 2. Parsear query params
    const searchParams = request.nextUrl.searchParams;

    const mode = searchParams.get('mode') || 'history'; // 'top' | 'history' | 'similar'
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '50'),
      mode === 'top' ? 50 : 200
    );
    const offset = parseInt(searchParams.get('offset') || '0');

    const machineId = searchParams.get('machineId')
      ? parseInt(searchParams.get('machineId')!)
      : undefined;

    const componentId = searchParams.get('componentId')
      ? parseInt(searchParams.get('componentId')!)
      : undefined;

    const subcomponentId = searchParams.get('subcomponentId')
      ? parseInt(searchParams.get('subcomponentId')!)
      : undefined;

    const minEffectiveness = searchParams.get('minEffectiveness')
      ? parseInt(searchParams.get('minEffectiveness')!)
      : undefined;

    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;

    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;

    const outcome = searchParams.get('outcome') as 'FUNCIONÓ' | 'PARCIAL' | 'NO_FUNCIONÓ' | undefined;

    const title = searchParams.get('title') || undefined;
    const search = searchParams.get('search') || undefined;

    // 3. Ejecutar según modo
    switch (mode) {
      case 'top': {
        // Top soluciones por efectividad y uso
        const topSolutions = await getTopSolutions({
          companyId,
          machineId,
          componentId,
          subcomponentId,
          limit,
          minEffectiveness: minEffectiveness || 3
        });

        return NextResponse.json({
          mode: 'top',
          data: topSolutions,
          count: topSolutions.length
        }, { status: 200 });
      }

      case 'similar': {
        // Soluciones similares a un título dado
        if (!title) {
          return NextResponse.json(
            { error: 'title es obligatorio para mode=similar' },
            { status: 400 }
          );
        }

        if (!machineId) {
          return NextResponse.json(
            { error: 'machineId es obligatorio para mode=similar' },
            { status: 400 }
          );
        }

        const similarSolutions = await findSimilarSolutions({
          companyId,
          machineId,
          componentId,
          subcomponentId,
          title,
          limit
        });

        return NextResponse.json({
          mode: 'similar',
          data: similarSolutions,
          count: similarSolutions.length
        }, { status: 200 });
      }

      case 'history':
      default: {
        // Historial completo con filtros
        const history = await getSolutionHistory({
          companyId,
          machineId,
          componentId,
          subcomponentId,
          limit,
          offset,
          startDate,
          endDate,
          outcome,
          minEffectiveness,
          search
        });

        return NextResponse.json({
          mode: 'history',
          data: history.solutions,
          pagination: {
            total: history.total,
            limit,
            offset,
            hasMore: history.hasMore
          }
        }, { status: 200 });
      }
    }

  } catch (error: any) {
    console.error('❌ Error en GET /api/solutions-applied:', error);

    // Si es error de validación, retornar 400
    if (error.message?.includes('Validación falló')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error al obtener soluciones aplicadas' },
      { status: 500 }
    );
  }
}
