/**
 * API: /api/discord/bot/members
 *
 * GET - Listar miembros de un servidor de Discord
 *       Permite obtener la lista de usuarios para vincularlos con ORVIT
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isBotReady, getGuildMembers, listGuilds } from '@/lib/discord';

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

    // 3. Obtener guildId del query param o de la empresa
    const { searchParams } = new URL(request.url);
    let guildId = searchParams.get('guildId');

    if (!guildId) {
      // Intentar obtener de la empresa del usuario
      const companyId = searchParams.get('companyId');
      if (companyId) {
        const company = await prisma.company.findUnique({
          where: { id: parseInt(companyId) },
          select: { discordGuildId: true },
        });
        guildId = company?.discordGuildId || null;
      }

      // Si aún no hay guildId, usar el primer servidor disponible
      if (!guildId) {
        const guilds = listGuilds();
        if (guilds.length > 0) {
          guildId = guilds[0].id;
        }
      }
    }

    if (!guildId) {
      return NextResponse.json(
        { error: 'No se especificó servidor de Discord' },
        { status: 400 }
      );
    }

    // 4. Obtener miembros del servidor
    const members = await getGuildMembers(guildId);

    // 5. Obtener usuarios ya vinculados de la BD
    const linkedUsers = await prisma.user.findMany({
      where: {
        discordUserId: { not: null },
      },
      select: {
        id: true,
        name: true,
        discordUserId: true,
      },
    });

    const linkedDiscordIds = new Set(
      linkedUsers.map(u => u.discordUserId).filter(Boolean)
    );

    // 6. Marcar miembros que ya están vinculados
    const membersWithStatus = members.map(member => ({
      ...member,
      linked: linkedDiscordIds.has(member.id),
      linkedUserId: linkedUsers.find(u => u.discordUserId === member.id)?.id,
      linkedUserName: linkedUsers.find(u => u.discordUserId === member.id)?.name,
    }));

    return NextResponse.json({
      guildId,
      members: membersWithStatus,
      totalMembers: members.length,
      linkedCount: membersWithStatus.filter(m => m.linked).length,
    });

  } catch (error: any) {
    console.error('❌ Error en GET /api/discord/bot/members:', error);
    return NextResponse.json(
      { error: 'Error al obtener miembros', detail: error.message },
      { status: 500 }
    );
  }
}
