/**
 * API: /api/discord/bot/make-private
 *
 * POST - Hace privada una categoría de Discord existente
 *        Útil para arreglar categorías que fueron creadas antes de implementar privacidad por defecto
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
    if (!payload || !payload.userId || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // 2. Verificar permisos (solo admin)
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
      return NextResponse.json(
        { error: 'Solo administradores pueden modificar canales' },
        { status: 403 }
      );
    }

    // 3. Obtener datos del body
    const body = await request.json();
    const { sectorId, categoryId } = body;

    // 4. Obtener guildId
    const company = await prisma.company.findUnique({
      where: { id: payload.companyId as number },
      select: { discordGuildId: true }
    });

    let guildId = company?.discordGuildId;

    if (!guildId) {
      const guildsResult = await manageBotChannels('getGuilds', {});
      if (guildsResult.success && guildsResult.guilds?.length > 0) {
        guildId = guildsResult.guilds[0].id;
        // Guardar para futuras operaciones
        await prisma.company.update({
          where: { id: payload.companyId as number },
          data: { discordGuildId: guildId }
        });
      }
    }

    if (!guildId) {
      return NextResponse.json(
        { error: 'No se encontró servidor de Discord' },
        { status: 400 }
      );
    }

    // 5. Si se proporciona sectorId, obtener la categoría del sector
    let targetCategoryId = categoryId;

    if (sectorId && !categoryId) {
      const sector = await prisma.sector.findUnique({
        where: { id: sectorId },
        select: { discordCategoryId: true, name: true }
      });

      if (!sector?.discordCategoryId) {
        return NextResponse.json(
          { error: 'El sector no tiene categoría de Discord configurada' },
          { status: 400 }
        );
      }

      targetCategoryId = sector.discordCategoryId;
    }

    if (!targetCategoryId) {
      return NextResponse.json(
        { error: 'Se requiere sectorId o categoryId' },
        { status: 400 }
      );
    }

    // 6. Hacer privada la categoría
    const result = await manageBotChannels('makeCategoryPrivate', { guildId, categoryId: targetCategoryId });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Error al hacer privada la categoría' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Categoría ahora es privada (y todos sus canales)',
      categoryId: targetCategoryId,
    });

  } catch (error: any) {
    console.error('❌ Error en POST /api/discord/bot/make-private:', error);
    return NextResponse.json(
      { error: 'Error al hacer privada la categoría', detail: error.message },
      { status: 500 }
    );
  }
}
