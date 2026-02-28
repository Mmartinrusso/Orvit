import { NextRequest, NextResponse } from 'next/server';
import {
  getValidReasonCodes,
  getDefaultReasonCode,
  getReasonCode,
  type EntityType,
  type ActionType,
} from '@/lib/compras/audit-reason-codes';
import { requireAuth } from '@/lib/auth/shared-helpers';

/**
 * GET /api/compras/reason-codes
 * Obtiene los reason codes válidos para una entidad y acción
 *
 * Query params:
 * - entityType: EntityType (required)
 * - actionType: ActionType (required)
 * - code: string (optional) - Para obtener un código específico
 */
export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get('entityType') as EntityType | null;
    const actionType = searchParams.get('actionType') as ActionType | null;
    const specificCode = searchParams.get('code');

    // Si se pide un código específico
    if (specificCode) {
      const code = getReasonCode(specificCode);
      if (!code) {
        return NextResponse.json({ error: 'Código no encontrado' }, { status: 404 });
      }
      return NextResponse.json({ code });
    }

    // Validar parámetros requeridos
    if (!entityType || !actionType) {
      return NextResponse.json(
        { error: 'entityType y actionType son requeridos' },
        { status: 400 }
      );
    }

    // Obtener códigos válidos
    const codes = getValidReasonCodes(entityType, actionType);
    const defaultCode = getDefaultReasonCode(entityType, actionType);

    return NextResponse.json({
      codes,
      defaultCode,
      entityType,
      actionType,
    });
  } catch (error) {
    console.error('[REASON-CODES] Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener reason codes' },
      { status: 500 }
    );
  }
}
