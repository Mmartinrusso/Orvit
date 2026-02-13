import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/portal/config
 * Obtener configuración del portal
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const config = await prisma.salesConfig.findUnique({
      where: { companyId: auth.companyId },
      select: {
        portalEnabled: true,
        portalSessionDays: true,
        portalInviteDays: true,
        portalRequireApproval: true,
        portalDefaultOrderApproval: true,
      },
    });

    // Estadísticas del portal
    const [
      totalUsers,
      activeUsers,
      verifiedUsers,
      totalOrders,
      pendingOrders,
    ] = await Promise.all([
      prisma.clientPortalUser.count({
        where: { companyId: auth.companyId },
      }),
      prisma.clientPortalUser.count({
        where: { companyId: auth.companyId, isActive: true },
      }),
      prisma.clientPortalUser.count({
        where: { companyId: auth.companyId, isVerified: true },
      }),
      prisma.clientPortalOrder.count({
        where: { companyId: auth.companyId },
      }),
      prisma.clientPortalOrder.count({
        where: { companyId: auth.companyId, status: 'PENDING' },
      }),
    ]);

    return NextResponse.json({
      config: config || {
        portalEnabled: false,
        portalSessionDays: 7,
        portalInviteDays: 7,
        portalRequireApproval: true,
        portalDefaultOrderApproval: 0,
      },
      stats: {
        totalUsers,
        activeUsers,
        verifiedUsers,
        pendingActivation: activeUsers - verifiedUsers,
        totalOrders,
        pendingOrders,
      },
    });
  } catch (error) {
    console.error('Error obteniendo configuración del portal:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/portal/config
 * Actualizar configuración del portal
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      portalEnabled,
      portalSessionDays,
      portalInviteDays,
      portalRequireApproval,
      portalDefaultOrderApproval,
    } = body;

    // Validaciones
    if (portalSessionDays !== undefined && (portalSessionDays < 1 || portalSessionDays > 365)) {
      return NextResponse.json(
        { error: 'Duración de sesión debe estar entre 1 y 365 días' },
        { status: 400 }
      );
    }

    if (portalInviteDays !== undefined && (portalInviteDays < 1 || portalInviteDays > 30)) {
      return NextResponse.json(
        { error: 'Duración de invitación debe estar entre 1 y 30 días' },
        { status: 400 }
      );
    }

    // Construir datos de actualización
    const updateData: any = {};

    if (portalEnabled !== undefined) {
      updateData.portalEnabled = portalEnabled;
    }
    if (portalSessionDays !== undefined) {
      updateData.portalSessionDays = portalSessionDays;
    }
    if (portalInviteDays !== undefined) {
      updateData.portalInviteDays = portalInviteDays;
    }
    if (portalRequireApproval !== undefined) {
      updateData.portalRequireApproval = portalRequireApproval;
    }
    if (portalDefaultOrderApproval !== undefined) {
      updateData.portalDefaultOrderApproval = portalDefaultOrderApproval;
    }

    // Actualizar configuración
    const config = await prisma.salesConfig.upsert({
      where: { companyId: auth.companyId },
      create: {
        companyId: auth.companyId,
        ...updateData,
      },
      update: updateData,
    });

    return NextResponse.json({
      success: true,
      message: 'Configuración actualizada correctamente',
      config: {
        portalEnabled: config.portalEnabled,
        portalSessionDays: config.portalSessionDays,
        portalInviteDays: config.portalInviteDays,
        portalRequireApproval: config.portalRequireApproval,
        portalDefaultOrderApproval: config.portalDefaultOrderApproval
          ? Number(config.portalDefaultOrderApproval)
          : null,
      },
    });
  } catch (error) {
    console.error('Error actualizando configuración del portal:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
