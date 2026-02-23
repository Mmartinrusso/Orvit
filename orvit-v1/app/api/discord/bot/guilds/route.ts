/**
 * API: /api/discord/bot/guilds
 *
 * GET - Listar servidores de Discord donde está el bot
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { manageBotChannels } from '@/lib/discord/bot-service-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    // 2. Obtener lista de servidores vía bot-service
    const result = await manageBotChannels('getGuilds', {});

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Error al obtener servidores' },
        { status: 400 }
      );
    }

    const guilds = result.guilds || [];

    return NextResponse.json({
      connected: true,
      guilds,
      totalGuilds: guilds.length,
    });

  } catch (error: any) {
    console.error('Error en GET /api/discord/bot/guilds:', error);
    return NextResponse.json(
      { error: 'Error al obtener servidores', detail: error.message },
      { status: 500 }
    );
  }
}
