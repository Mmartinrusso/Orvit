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

    // 2. Obtener guildId del query param o de la empresa
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

      // Si aún no hay guildId, usar el primer servidor disponible vía bot-service
      if (!guildId) {
        const guildsResult = await manageBotChannels('getGuilds', {});
        const guilds = guildsResult.guilds || [];
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

    // 3. Obtener miembros del servidor vía bot-service
    const membersResult = await manageBotChannels('getGuildMembers', { guildId });

    if (!membersResult.success) {
      return NextResponse.json(
        { error: membersResult.error || 'Error al obtener miembros' },
        { status: 400 }
      );
    }

    const members = membersResult.members || [];

    // 4. Obtener usuarios ya vinculados de la BD
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

    // 5. Marcar miembros que ya están vinculados
    const membersWithStatus = members.map((member: any) => ({
      ...member,
      linked: linkedDiscordIds.has(member.id),
      linkedUserId: linkedUsers.find(u => u.discordUserId === member.id)?.id,
      linkedUserName: linkedUsers.find(u => u.discordUserId === member.id)?.name,
    }));

    return NextResponse.json({
      guildId,
      members: membersWithStatus,
      totalMembers: members.length,
      linkedCount: membersWithStatus.filter((m: any) => m.linked).length,
    });

  } catch (error: any) {
    console.error('Error en GET /api/discord/bot/members:', error);
    return NextResponse.json(
      { error: 'Error al obtener miembros', detail: error.message },
      { status: 500 }
    );
  }
}
