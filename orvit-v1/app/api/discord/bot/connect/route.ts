/**
 * API: /api/discord/bot/connect
 *
 * POST - Conectar el bot de Discord usando el token de la empresa
 * DELETE - Desconectar el bot de Discord
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { connectBot, disconnectBot, isBotReady, getBotInfo } from '@/lib/discord';

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

    // 2. Verificar permisos (solo admin puede conectar el bot)
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
      return NextResponse.json(
        { error: 'Solo administradores pueden gestionar el bot de Discord' },
        { status: 403 }
      );
    }

    // 3. Obtener datos del body
    const body = await request.json();
    const { companyId, botToken } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Se requiere companyId' },
        { status: 400 }
      );
    }

    // 4. Obtener o actualizar el token del bot
    let tokenToUse = botToken;

    if (botToken) {
      // Guardar nuevo token
      await prisma.company.update({
        where: { id: companyId },
        data: { discordBotToken: botToken },
      });
    } else {
      // Usar token existente
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { discordBotToken: true },
      });

      if (!company?.discordBotToken) {
        return NextResponse.json(
          { error: 'No hay token de bot configurado. Proporciona botToken.' },
          { status: 400 }
        );
      }

      tokenToUse = company.discordBotToken;
    }

    // 5. Conectar el bot
    const result = await connectBot(tokenToUse);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Error al conectar bot' },
        { status: 400 }
      );
    }

    // 6. Obtener info del bot conectado
    const botInfo = getBotInfo();

    return NextResponse.json({
      success: true,
      message: 'Bot conectado exitosamente',
      bot: botInfo,
    });

  } catch (error: any) {
    console.error('❌ Error en POST /api/discord/bot/connect:', error);
    return NextResponse.json(
      { error: 'Error al conectar bot', detail: error.message },
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

    // 2. Desconectar el bot
    await disconnectBot();

    return NextResponse.json({
      success: true,
      message: 'Bot desconectado',
    });

  } catch (error: any) {
    console.error('❌ Error en DELETE /api/discord/bot/connect:', error);
    return NextResponse.json(
      { error: 'Error al desconectar bot', detail: error.message },
      { status: 500 }
    );
  }
}

// GET - Obtener estado del bot
export async function GET() {
  try {
    const isConnected = isBotReady();
    const botInfo = getBotInfo();

    return NextResponse.json({
      connected: isConnected,
      ...botInfo,
    });

  } catch (error: any) {
    console.error('❌ Error en GET /api/discord/bot/connect:', error);
    return NextResponse.json(
      { error: 'Error al obtener estado del bot', detail: error.message },
      { status: 500 }
    );
  }
}
