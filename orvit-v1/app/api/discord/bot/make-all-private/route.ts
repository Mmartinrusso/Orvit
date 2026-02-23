/**
 * API: /api/discord/bot/make-all-private
 *
 * POST - Hace privadas TODAS las categorías de Discord de los sectores de la empresa
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

    const companyId = payload.companyId as number;

    // 2. Verificar permisos (solo admin)
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true },
    });

    const adminRoles = ['ADMIN', 'SUPERADMIN', 'SUPER_ADMIN', 'ADMIN_ENTERPRISE'];
    if (!user || !adminRoles.includes(user.role)) {
      return NextResponse.json(
        { error: `Solo administradores pueden modificar canales. Tu rol: ${user?.role || 'ninguno'}` },
        { status: 403 }
      );
    }

    // 3. Obtener guildId
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { discordGuildId: true }
    });

    let guildId = company?.discordGuildId;

    if (!guildId) {
      const guildsResult = await manageBotChannels('getGuilds', {});
      if (guildsResult.success && guildsResult.guilds?.length > 0) {
        guildId = guildsResult.guilds[0].id;
        await prisma.company.update({
          where: { id: companyId },
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

    // 4. Obtener todos los sectores con categoría de Discord
    const sectors = await prisma.sector.findMany({
      where: {
        companyId,
        discordCategoryId: { not: null }
      },
      select: {
        id: true,
        name: true,
        discordCategoryId: true,
      }
    });

    if (sectors.length === 0) {
      return NextResponse.json(
        { error: 'No hay sectores con categorías de Discord configuradas' },
        { status: 400 }
      );
    }

    // 5. Hacer privada cada categoría
    const results: { sector: string; success: boolean; error?: string }[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const sector of sectors) {
      if (!sector.discordCategoryId) continue;

      const result = await manageBotChannels('makeCategoryPrivate', { guildId, categoryId: sector.discordCategoryId });

      if (result.success) {
        successCount++;
        results.push({ sector: sector.name, success: true });
      } else {
        errorCount++;
        results.push({ sector: sector.name, success: false, error: result.error });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${successCount} categorías hechas privadas${errorCount > 0 ? `, ${errorCount} errores` : ''}`,
      successCount,
      errorCount,
      details: results,
    });

  } catch (error: any) {
    console.error('❌ Error en POST /api/discord/bot/make-all-private:', error);
    return NextResponse.json(
      { error: 'Error al hacer privadas las categorías', detail: error.message },
      { status: 500 }
    );
  }
}
