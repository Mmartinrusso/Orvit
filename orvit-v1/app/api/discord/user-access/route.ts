/**
 * API: /api/discord/user-access
 *
 * Gestiona el acceso de usuarios a sectores en Discord
 * con control granular por tipo de canal
 *
 * GET - Lista usuarios con sus accesos a sectores Discord
 * POST - Otorga acceso a un usuario a sectores (con permisos de canales)
 * PATCH - Actualiza permisos de canales para un acceso existente
 * DELETE - Revoca acceso de un usuario a un sector
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { syncUserDiscordAccess, syncChannelPermissions } from '@/lib/discord/permissions-sync';

export const dynamic = 'force-dynamic';

/**
 * GET /api/discord/user-access
 * Lista usuarios con sus accesos a sectores Discord
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    // Si se pide un usuario específico
    if (userId) {
      const user = await prisma.user.findFirst({
        where: {
          id: parseInt(userId),
          companies: { some: { companyId } }
        },
        select: {
          id: true,
          name: true,
          email: true,
          discordUserId: true,
          discordSectorAccess: {
            include: {
              sector: {
                select: {
                  id: true,
                  name: true,
                  discordCategoryId: true,
                  discordFallasChannelId: true,
                  discordPreventivosChannelId: true,
                  discordOTChannelId: true,
                  discordGeneralChannelId: true,
                }
              },
              granter: {
                select: { id: true, name: true }
              }
            }
          }
        }
      });

      if (!user) {
        return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
      }

      return NextResponse.json({ user });
    }

    // Lista todos los usuarios con Discord vinculado
    const users = await prisma.user.findMany({
      where: {
        companies: { some: { companyId } },
        discordUserId: { not: null }
      },
      select: {
        id: true,
        name: true,
        email: true,
        discordUserId: true,
        isActive: true,
        discordSectorAccess: {
          select: {
            id: true,
            sectorId: true,
            grantedAt: true,
            canViewFallas: true,
            canViewPreventivos: true,
            canViewOT: true,
            canViewGeneral: true,
            sector: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Lista sectores disponibles
    const sectors = await prisma.sector.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        discordCategoryId: true,
        discordFallasChannelId: true,
        discordPreventivosChannelId: true,
        discordOTChannelId: true,
        discordGeneralChannelId: true,
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ users, sectors });
  } catch (error: any) {
    console.error('Error en GET /api/discord/user-access:', error);
    return NextResponse.json(
      { error: 'Error al obtener accesos Discord', detail: error?.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/discord/user-access
 * Otorga acceso a un usuario a uno o más sectores
 * Body: {
 *   userId: number,
 *   sectorIds: number[],
 *   channelPermissions?: { fallas?: boolean, preventivos?: boolean, ot?: boolean, general?: boolean }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const grantedBy = payload.userId as number;

    const body = await request.json();
    const { userId, sectorIds, channelPermissions } = body;

    if (!userId || !Array.isArray(sectorIds) || sectorIds.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere userId y sectorIds (array)' },
        { status: 400 }
      );
    }

    // Verificar que el usuario existe y tiene Discord vinculado
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        companies: { some: { companyId } }
      },
      select: { id: true, discordUserId: true, name: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (!user.discordUserId) {
      return NextResponse.json(
        { error: 'El usuario no tiene Discord vinculado' },
        { status: 400 }
      );
    }

    // Verificar que los sectores existen y pertenecen a la empresa
    const sectors = await prisma.sector.findMany({
      where: {
        id: { in: sectorIds },
        companyId
      },
      select: { id: true, name: true, discordCategoryId: true }
    });

    if (sectors.length !== sectorIds.length) {
      return NextResponse.json(
        { error: 'Algunos sectores no existen o no pertenecen a la empresa' },
        { status: 400 }
      );
    }

    // Permisos por defecto (todos habilitados)
    const perms = {
      canViewFallas: channelPermissions?.fallas ?? true,
      canViewPreventivos: channelPermissions?.preventivos ?? true,
      canViewOT: channelPermissions?.ot ?? true,
      canViewGeneral: channelPermissions?.general ?? true,
    };

    // Crear accesos (ignorar duplicados)
    const created = await prisma.userDiscordAccess.createMany({
      data: sectorIds.map((sectorId: number) => ({
        userId,
        sectorId,
        grantedBy,
        ...perms
      })),
      skipDuplicates: true
    });

    // Sincronizar permisos en Discord
    const syncResult = await syncUserDiscordAccess(userId, 'grant', sectorIds);

    return NextResponse.json({
      success: true,
      created: created.count,
      sectors: sectors.map(s => s.name),
      discordSync: syncResult
    });
  } catch (error: any) {
    console.error('Error en POST /api/discord/user-access:', error);
    return NextResponse.json(
      { error: 'Error al otorgar acceso Discord', detail: error?.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/discord/user-access
 * Actualiza permisos de canales para un acceso existente
 * Body: {
 *   userId: number,
 *   sectorId: number,
 *   channelPermissions: { fallas?: boolean, preventivos?: boolean, ot?: boolean, general?: boolean }
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;

    const body = await request.json();
    const { userId, sectorId, channelPermissions } = body;

    if (!userId || !sectorId || !channelPermissions) {
      return NextResponse.json(
        { error: 'Se requiere userId, sectorId y channelPermissions' },
        { status: 400 }
      );
    }

    // Verificar que el acceso existe
    const access = await prisma.userDiscordAccess.findUnique({
      where: {
        userId_sectorId: { userId, sectorId }
      },
      include: {
        user: { select: { discordUserId: true } },
        sector: {
          select: {
            companyId: true,
            discordFallasChannelId: true,
            discordPreventivosChannelId: true,
            discordOTChannelId: true,
            discordGeneralChannelId: true,
          }
        }
      }
    });

    if (!access || access.sector.companyId !== companyId) {
      return NextResponse.json({ error: 'Acceso no encontrado' }, { status: 404 });
    }

    // Actualizar permisos en DB
    const updated = await prisma.userDiscordAccess.update({
      where: {
        userId_sectorId: { userId, sectorId }
      },
      data: {
        canViewFallas: channelPermissions.fallas ?? access.canViewFallas,
        canViewPreventivos: channelPermissions.preventivos ?? access.canViewPreventivos,
        canViewOT: channelPermissions.ot ?? access.canViewOT,
        canViewGeneral: channelPermissions.general ?? access.canViewGeneral,
      }
    });

    // Sincronizar permisos en Discord para cada canal
    if (access.user.discordUserId) {
      const syncResult = await syncChannelPermissions(
        access.user.discordUserId,
        sectorId,
        {
          fallas: updated.canViewFallas,
          preventivos: updated.canViewPreventivos,
          ot: updated.canViewOT,
          general: updated.canViewGeneral,
        }
      );

      return NextResponse.json({
        success: true,
        updated,
        discordSync: syncResult
      });
    }

    return NextResponse.json({ success: true, updated });
  } catch (error: any) {
    console.error('Error en PATCH /api/discord/user-access:', error);
    return NextResponse.json(
      { error: 'Error al actualizar permisos', detail: error?.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/discord/user-access
 * Revoca acceso de un usuario a sectores
 * Query: ?userId=X&sectorIds=1,2,3
 */
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const sectorIdsParam = searchParams.get('sectorIds');

    if (!userId || !sectorIdsParam) {
      return NextResponse.json(
        { error: 'Se requiere userId y sectorIds' },
        { status: 400 }
      );
    }

    const sectorIds = sectorIdsParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));

    // Verificar que el usuario existe
    const user = await prisma.user.findFirst({
      where: {
        id: parseInt(userId),
        companies: { some: { companyId } }
      },
      select: { id: true, discordUserId: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Eliminar accesos
    const deleted = await prisma.userDiscordAccess.deleteMany({
      where: {
        userId: parseInt(userId),
        sectorId: { in: sectorIds }
      }
    });

    // Sincronizar permisos en Discord (revocar)
    const syncResult = await syncUserDiscordAccess(parseInt(userId), 'revoke', sectorIds);

    return NextResponse.json({
      success: true,
      deleted: deleted.count,
      discordSync: syncResult
    });
  } catch (error: any) {
    console.error('Error en DELETE /api/discord/user-access:', error);
    return NextResponse.json(
      { error: 'Error al revocar acceso Discord', detail: error?.message },
      { status: 500 }
    );
  }
}
