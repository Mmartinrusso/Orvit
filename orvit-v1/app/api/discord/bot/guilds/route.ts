/**
 * API: /api/discord/bot/guilds
 *
 * GET - Listar servidores de Discord donde está el bot
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { isBotReady, listGuilds } from '@/lib/discord';

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

    // 2. Verificar que el bot esté conectado
    if (!isBotReady()) {
      return NextResponse.json(
        { error: 'Bot no está conectado' },
        { status: 400 }
      );
    }

    // 3. Obtener lista de servidores
    const guilds = listGuilds();

    return NextResponse.json({
      connected: true,
      guilds,
      totalGuilds: guilds.length,
    });

  } catch (error: any) {
    console.error('❌ Error en GET /api/discord/bot/guilds:', error);
    return NextResponse.json(
      { error: 'Error al obtener servidores', detail: error.message },
      { status: 500 }
    );
  }
}
