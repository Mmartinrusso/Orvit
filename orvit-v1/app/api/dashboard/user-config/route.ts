import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDefaultLayoutForRole } from '@/lib/dashboard/widget-catalog';
import { cached, invalidateCache } from '@/lib/cache/cache-manager';
import { dashboardConfigKeys, invalidationPatterns, TTL } from '@/lib/cache/cache-keys';
import { validateRequest } from '@/lib/validations/helpers';
import { SaveDashboardConfigSchema } from '@/lib/validations/dashboard';

export const dynamic = 'force-dynamic';

/**
 * GET - Obtener configuración de dashboard del usuario
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const companyId = searchParams.get('companyId');
    const configName = searchParams.get('name');

    if (!userId || !companyId) {
      return NextResponse.json(
        { error: 'userId y companyId son requeridos' },
        { status: 400 }
      );
    }

    const userIdNum = parseInt(userId);
    const companyIdNum = parseInt(companyId);
    const cacheKey = dashboardConfigKeys.userConfig(userIdNum, companyIdNum);

    const result = await cached(cacheKey, async () => {
      // Buscar configuración específica o la default
      const whereClause: any = {
        userId: userIdNum,
        companyId: companyIdNum,
      };

      if (configName) {
        whereClause.name = configName;
      } else {
        whereClause.isDefault = true;
      }

      let config = await prisma.userDashboardConfig.findFirst({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
      });

      // Si no existe configuración, buscar cualquier configuración del usuario
      if (!config && !configName) {
        config = await prisma.userDashboardConfig.findFirst({
          where: {
            userId: userIdNum,
            companyId: companyIdNum,
          },
          orderBy: { updatedAt: 'desc' },
        });
      }

      return { config: config || null };
    }, TTL.LONG);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[DASHBOARD_CONFIG_GET_ERROR]', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST - Crear o actualizar configuración de dashboard
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateRequest(SaveDashboardConfigSchema, body);
    if (!validation.success) return validation.response;

    const { userId, companyId, name: configName, layout, isDefault } = validation.data;

    const userIdNum = userId;
    const companyIdNum = companyId;

    // Si es default, quitar default de otras configuraciones
    if (isDefault) {
      await prisma.userDashboardConfig.updateMany({
        where: {
          userId: userIdNum,
          companyId: companyIdNum,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    // Upsert la configuración
    const config = await prisma.userDashboardConfig.upsert({
      where: {
        userId_companyId_name: {
          userId: userIdNum,
          companyId: companyIdNum,
          name: configName,
        },
      },
      create: {
        userId: userIdNum,
        companyId: companyIdNum,
        name: configName,
        layout: layout || { widgets: [], columns: 4 },
        isDefault: isDefault ?? true,
      },
      update: {
        layout: layout,
        isDefault: isDefault,
        updatedAt: new Date(),
      },
    });

    // Invalidar cache de dashboard config
    await invalidateCache(invalidationPatterns.dashboardConfig(userIdNum, companyIdNum));

    return NextResponse.json({ config, success: true });
  } catch (error) {
    console.error('[DASHBOARD_CONFIG_POST_ERROR]', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Eliminar configuración de dashboard
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('id');
    const userId = searchParams.get('userId');
    const companyId = searchParams.get('companyId');

    if (!configId) {
      return NextResponse.json(
        { error: 'id es requerido' },
        { status: 400 }
      );
    }

    await prisma.userDashboardConfig.delete({
      where: { id: parseInt(configId) },
    });

    // Invalidar cache si tenemos userId y companyId
    if (userId && companyId) {
      await invalidateCache(
        invalidationPatterns.dashboardConfig(parseInt(userId), parseInt(companyId))
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DASHBOARD_CONFIG_DELETE_ERROR]', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
