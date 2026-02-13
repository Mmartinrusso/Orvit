import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAvailableWidgets, WIDGET_CATALOG, CATEGORY_LABELS } from '@/lib/dashboard/widget-catalog';
import { ROLE_PERMISSIONS, UserRole } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * GET - Obtener widgets disponibles según permisos del usuario
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const companyId = searchParams.get('companyId');
    const userRole = searchParams.get('role') as UserRole;

    if (!userId || !companyId) {
      return NextResponse.json(
        { error: 'userId y companyId son requeridos' },
        { status: 400 }
      );
    }

    const userIdNum = parseInt(userId);
    const companyIdNum = parseInt(companyId);

    // Obtener permisos del usuario
    let userPermissions: string[] = [];

    // 1. Obtener permisos base del rol
    const normalizedRole = (userRole?.toUpperCase() || 'USER') as UserRole;
    const basePermissions = ROLE_PERMISSIONS[normalizedRole] || ROLE_PERMISSIONS.USER;
    userPermissions = [...basePermissions];

    // 2. Obtener permisos específicos del usuario (overrides)
    try {
      const userSpecificPermissions = await prisma.userPermission.findMany({
        where: {
          userId: userIdNum,
          isGranted: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        },
        include: {
          permission: true
        }
      });

      // Agregar permisos específicos
      userSpecificPermissions.forEach(up => {
        if (up.permission?.name && up.isGranted) {
          if (!userPermissions.includes(up.permission.name)) {
            userPermissions.push(up.permission.name);
          }
        }
      });
    } catch (e) {
      // Si falla, continuar con permisos base del rol
      console.warn('No se pudieron cargar permisos específicos del usuario');
    }

    // 3. Obtener permisos del rol de la empresa si existe
    try {
      const userOnCompany = await prisma.userOnCompany.findFirst({
        where: {
          userId: userIdNum,
          companyId: companyIdNum,
        },
        include: {
          role: {
            include: {
              permissions: {
                where: { isGranted: true },
                include: { permission: true }
              }
            }
          }
        }
      });

      if (userOnCompany?.role?.permissions) {
        userOnCompany.role.permissions.forEach(rp => {
          if (rp.permission?.name && rp.isGranted) {
            if (!userPermissions.includes(rp.permission.name)) {
              userPermissions.push(rp.permission.name);
            }
          }
        });
      }
    } catch (e) {
      // Si falla, continuar con permisos actuales
      console.warn('No se pudieron cargar permisos del rol de empresa');
    }

    // SUPERADMIN y ADMIN tienen acceso a todos los widgets
    const isAdmin = normalizedRole === 'SUPERADMIN' || 
                    normalizedRole === 'ADMIN' || 
                    normalizedRole === 'ADMIN_ENTERPRISE';

    let availableWidgets;
    if (isAdmin) {
      availableWidgets = WIDGET_CATALOG;
    } else {
      availableWidgets = getAvailableWidgets(userPermissions);
    }

    // Agrupar por categoría
    const widgetsByCategory: Record<string, typeof availableWidgets> = {};
    availableWidgets.forEach(widget => {
      if (!widgetsByCategory[widget.category]) {
        widgetsByCategory[widget.category] = [];
      }
      widgetsByCategory[widget.category].push(widget);
    });

    return NextResponse.json({
      widgets: availableWidgets,
      widgetsByCategory,
      categoryLabels: CATEGORY_LABELS,
      totalAvailable: availableWidgets.length,
      userPermissions: isAdmin ? ['ALL'] : userPermissions,
    });
  } catch (error) {
    console.error('[AVAILABLE_WIDGETS_ERROR]', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

