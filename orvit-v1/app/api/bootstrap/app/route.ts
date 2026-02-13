import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

/**
 * ✨ ENDPOINT BOOTSTRAP: Consolida datos necesarios para la app
 * 
 * Este endpoint devuelve en una sola llamada:
 * - Settings del sistema
 * - Áreas de la empresa
 * - Notificaciones del usuario
 * 
 * Reduce la cantidad de requests paralelos y mejora el TTFB
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const token = cookies().get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const userId = payload.userId as number;

    // Obtener usuario con sus relaciones
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        sectorId: true,
        companies: {
          select: {
            companyId: true
          },
          take: 1
        },
        ownedCompanies: {
          select: {
            id: true
          },
          take: 1
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Determinar companyId
    const companyId = user.ownedCompanies && user.ownedCompanies.length > 0
      ? user.ownedCompanies[0].id
      : (user.companies && user.companies.length > 0 ? user.companies[0].companyId : null);

    if (!companyId) {
      return NextResponse.json({ error: "Usuario sin empresa" }, { status: 400 });
    }

    // Obtener permisos del usuario
    const userPermissions = await prisma.userPermission.findMany({
      where: {
        userId: userId,
        isActive: true
      },
      select: {
        permission: {
          select: {
            name: true
          }
        }
      }
    });

    const permissions = userPermissions
      .map(up => up.permission?.name)
      .filter((name): name is string => !!name);

    // Cargar datos en paralelo para optimizar
    const [systemSettings, areas, notifications] = await Promise.all([
      // System Settings (valores por defecto por ahora)
      Promise.resolve({
        id: 'system-settings-default',
        systemLogoDark: null,
        systemLogoLight: null,
        timezone: 'America/Argentina/Buenos_Aires',
        currency: 'ARS',
        dateFormat: 'dd/MM/yyyy'
      }),

      // Áreas de la empresa
      prisma.area.findMany({
        where: { companyId: companyId },
        select: {
          id: true,
          name: true,
          icon: true,
          logo: true,
          companyId: true,
        },
        orderBy: [{ name: 'asc' }],
        take: 100
      }),

      // Notificaciones del usuario (últimas 50)
      prisma.notification.findMany({
        where: {
          userId: userId,
          companyId: companyId
        },
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          priority: true,
          read: true,
          createdAt: true,
          workOrderId: true,
          toolId: true,
          toolRequestId: true,
          taskId: true,
          reminderId: true,
          userId: true,
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 50
      })
    ]);

    // Formatear notificaciones para el frontend
    const formattedNotifications = notifications.map(notif => ({
      id: notif.id.toString(),
      type: notif.type,
      title: notif.title,
      message: notif.message,
      priority: notif.priority,
      timestamp: notif.createdAt,
      read: notif.read,
      userId: notif.userId,
      workOrderId: notif.workOrderId,
      toolId: notif.toolId,
      toolRequestId: notif.toolRequestId,
      taskId: notif.taskId,
      reminderId: notif.reminderId,
    }));

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          sectorId: user.sectorId,
          permissions: permissions
        },
        systemSettings,
        areas,
        notifications: formattedNotifications,
        companyId
      }
    }, {
      headers: {
        'Cache-Control': 'private, max-age=30',
      }
    });

  } catch (error) {
    console.error('[BOOTSTRAP_ERROR]', error);
    return NextResponse.json(
      { error: 'Error al cargar datos de bootstrap' },
      { status: 500 }
    );
  }
}

