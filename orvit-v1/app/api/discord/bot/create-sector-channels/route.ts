/**
 * API: /api/discord/bot/create-sector-channels
 *
 * POST - Crear estructura de canales de Discord para un sector
 *        Crea una categoría y los canales correspondientes
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { manageBotChannels } from '@/lib/discord/bot-service-client';

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

    // 2. Verificar permisos (solo admin)
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
      return NextResponse.json(
        { error: 'Solo administradores pueden crear canales' },
        { status: 403 }
      );
    }

    // 3. Obtener datos del body
    const body = await request.json();
    const { sectorId, guildId, channels } = body;

    if (!sectorId) {
      return NextResponse.json(
        { error: 'Se requiere sectorId' },
        { status: 400 }
      );
    }

    // 4. Obtener el sector
    const sector = await prisma.sector.findUnique({
      where: { id: sectorId },
      include: {
        company: {
          select: { discordGuildId: true },
        },
      },
    });

    if (!sector) {
      return NextResponse.json(
        { error: 'Sector no encontrado' },
        { status: 404 }
      );
    }

    // 5. Determinar el guildId a usar
    let targetGuildId = guildId || sector.company?.discordGuildId;

    if (!targetGuildId) {
      // Usar el primer servidor disponible vía bot-service
      const guildsResult = await manageBotChannels('getGuilds', {});
      const guilds = guildsResult.guilds || [];
      if (guilds.length > 0) {
        targetGuildId = guilds[0].id;
      }
    }

    if (!targetGuildId) {
      return NextResponse.json(
        { error: 'No se encontró servidor de Discord' },
        { status: 400 }
      );
    }

    // 6. Crear la estructura de canales vía bot-service
    const createChannels = channels || {
      fallas: true,
      preventivos: true,
      ordenesTrabajo: true,
      resumenDia: true,
      general: true,
    };

    const result = await manageBotChannels('createSectorChannels', {
      guildId: targetGuildId,
      sectorName: sector.name,
      createChannels,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Error al crear canales' },
        { status: 400 }
      );
    }

    // 7. Actualizar el sector con los IDs de los canales
    const updateData: any = {
      discordCategoryId: result.categoryId,
    };

    if (result.channels?.fallas) {
      updateData.discordFallasChannelId = result.channels.fallas;
    }
    if (result.channels?.preventivos) {
      updateData.discordPreventivosChannelId = result.channels.preventivos;
    }
    if (result.channels?.ordenesTrabajo) {
      updateData.discordOTChannelId = result.channels.ordenesTrabajo;
    }
    if (result.channels?.resumenDia) {
      updateData.discordResumenChannelId = result.channels.resumenDia;
    }

    await prisma.sector.update({
      where: { id: sectorId },
      data: updateData,
    });

    // 8. Actualizar el guildId de la empresa si no estaba configurado
    if (!sector.company?.discordGuildId) {
      await prisma.company.update({
        where: { id: sector.companyId },
        data: { discordGuildId: targetGuildId },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Canales creados para sector "${sector.name}"`,
      guildId: targetGuildId,
      categoryId: result.categoryId,
      channels: result.channels,
    });

  } catch (error: any) {
    console.error('Error en POST /api/discord/bot/create-sector-channels:', error);
    return NextResponse.json(
      { error: 'Error al crear canales', detail: error.message },
      { status: 500 }
    );
  }
}
