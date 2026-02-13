/**
 * API: /api/discord/bot/resync-all-access
 *
 * POST - Re-sincroniza TODOS los accesos de Discord de todos los usuarios
 *        Útil para arreglar permisos que no se aplicaron correctamente
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { syncUserDiscordAccess } from '@/lib/discord/permissions-sync';

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

    // 2. Verificar permisos
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true },
    });

    const adminRoles = ['ADMIN', 'SUPERADMIN', 'SUPER_ADMIN', 'ADMIN_ENTERPRISE'];
    if (!user || !adminRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Solo administradores pueden re-sincronizar accesos' },
        { status: 403 }
      );
    }

    // 3. Obtener todos los accesos de la empresa
    const accesses = await prisma.userDiscordAccess.findMany({
      where: {
        sector: { companyId }
      },
      include: {
        user: { select: { id: true, name: true, discordUserId: true } },
        sector: { select: { id: true, name: true } }
      }
    });

    if (accesses.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay accesos para sincronizar'
      });
    }

    // 4. Agrupar por usuario
    const userAccesses = new Map<number, { name: string; sectorIds: number[] }>();
    for (const access of accesses) {
      if (!access.user.discordUserId) continue; // Skip users without Discord

      if (!userAccesses.has(access.user.id)) {
        userAccesses.set(access.user.id, { name: access.user.name, sectorIds: [] });
      }
      userAccesses.get(access.user.id)!.sectorIds.push(access.sector.id);
    }

    // 5. Sincronizar cada usuario
    const results: { user: string; success: boolean; message: string }[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const [userId, data] of userAccesses) {
      const result = await syncUserDiscordAccess(userId, 'grant', data.sectorIds);

      if (result.success) {
        successCount++;
        results.push({ user: data.name, success: true, message: result.message });
      } else {
        errorCount++;
        results.push({ user: data.name, success: false, message: result.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${successCount} usuarios sincronizados${errorCount > 0 ? `, ${errorCount} con errores` : ''}`,
      successCount,
      errorCount,
      totalAccesses: accesses.length,
      details: results,
    });

  } catch (error: any) {
    console.error('❌ Error en POST /api/discord/bot/resync-all-access:', error);
    return NextResponse.json(
      { error: 'Error al re-sincronizar accesos', detail: error.message },
      { status: 500 }
    );
  }
}
