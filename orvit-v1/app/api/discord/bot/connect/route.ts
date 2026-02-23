/**
 * API: /api/discord/bot/connect
 *
 * GET - Obtener estado del bot (proxy a bot-service)
 * POST - El bot ahora corre como servicio externo en Railway
 * DELETE - El bot ahora corre como servicio externo en Railway
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getBotServiceStatus } from '@/lib/discord/bot-service-client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // El bot ahora corre como servicio independiente en Railway.
    // No es necesario conectarlo manualmente desde la app.
    return NextResponse.json({
      success: true,
      message: 'El bot de Discord ahora corre como servicio externo en Railway. No requiere conexión manual.',
    });

  } catch (error: any) {
    console.error('Error en POST /api/discord/bot/connect:', error);
    return NextResponse.json(
      { error: 'Error al procesar solicitud', detail: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // El bot ahora corre como servicio independiente en Railway.
    // No es posible desconectarlo desde la app.
    return NextResponse.json({
      success: true,
      message: 'El bot de Discord ahora corre como servicio externo en Railway. No se puede desconectar desde aquí.',
    });

  } catch (error: any) {
    console.error('Error en DELETE /api/discord/bot/connect:', error);
    return NextResponse.json(
      { error: 'Error al procesar solicitud', detail: error.message },
      { status: 500 }
    );
  }
}

// GET - Obtener estado del bot vía bot-service
export async function GET() {
  try {
    const status = await getBotServiceStatus();

    return NextResponse.json({
      connected: status.success && status.connected,
      username: status.username,
      guilds: status.guilds,
      uptime: status.uptime,
      ...status,
    });

  } catch (error: any) {
    console.error('Error en GET /api/discord/bot/connect:', error);
    return NextResponse.json(
      { error: 'Error al obtener estado del bot', detail: error.message },
      { status: 500 }
    );
  }
}
