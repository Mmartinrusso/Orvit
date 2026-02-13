import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { generateInviteToken } from '@/lib/portal/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/portal/usuarios/[id]
 * Obtener detalle de un usuario del portal
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const usuario = await prisma.clientPortalUser.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
      include: {
        contact: true,
        client: {
          select: { id: true, name: true, legalName: true },
        },
        sessions: {
          where: { isActive: true },
          orderBy: { lastActivityAt: 'desc' },
          take: 5,
          select: {
            id: true,
            createdAt: true,
            lastActivityAt: true,
            ipAddress: true,
            userAgent: true,
          },
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true,
          },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            action: true,
            entityType: true,
            entityId: true,
            details: true,
            ipAddress: true,
            createdAt: true,
          },
        },
        invites: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            token: true,
            expiresAt: true,
            usedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      usuario: {
        id: usuario.id,
        email: usuario.email,
        contact: usuario.contact,
        client: usuario.client,
        isActive: usuario.isActive,
        isVerified: usuario.isVerified,
        activatedAt: usuario.activatedAt,
        lastLoginAt: usuario.lastLoginAt,
        lastLoginIp: usuario.lastLoginIp,
        failedLoginAttempts: usuario.failedLoginAttempts,
        lockedUntil: usuario.lockedUntil,
        createdAt: usuario.createdAt,
        permissions: {
          canViewPrices: usuario.canViewPrices,
          canViewQuotes: usuario.canViewQuotes,
          canAcceptQuotes: usuario.canAcceptQuotes,
          canCreateOrders: usuario.canCreateOrders,
          canViewHistory: usuario.canViewHistory,
          canViewDocuments: usuario.canViewDocuments,
        },
        limits: {
          maxOrderAmount: usuario.maxOrderAmount ? Number(usuario.maxOrderAmount) : null,
          requiresApprovalAbove: usuario.requiresApprovalAbove ? Number(usuario.requiresApprovalAbove) : null,
        },
        sessions: usuario.sessions,
        orders: usuario.orders.map(o => ({
          ...o,
          total: Number(o.total),
        })),
        activities: usuario.activities,
        invites: usuario.invites,
      },
    });
  } catch (error) {
    console.error('Error obteniendo usuario del portal:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/portal/usuarios/[id]
 * Actualizar usuario del portal
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { permissions, limits, isActive } = body;

    // Verificar que el usuario existe
    const usuario = await prisma.clientPortalUser.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Construir datos de actualización
    const updateData: any = {};

    if (permissions !== undefined) {
      if (permissions.canViewPrices !== undefined) {
        updateData.canViewPrices = permissions.canViewPrices;
      }
      if (permissions.canViewQuotes !== undefined) {
        updateData.canViewQuotes = permissions.canViewQuotes;
      }
      if (permissions.canAcceptQuotes !== undefined) {
        updateData.canAcceptQuotes = permissions.canAcceptQuotes;
      }
      if (permissions.canCreateOrders !== undefined) {
        updateData.canCreateOrders = permissions.canCreateOrders;
      }
      if (permissions.canViewHistory !== undefined) {
        updateData.canViewHistory = permissions.canViewHistory;
      }
      if (permissions.canViewDocuments !== undefined) {
        updateData.canViewDocuments = permissions.canViewDocuments;
      }
    }

    if (limits !== undefined) {
      updateData.maxOrderAmount = limits.maxOrderAmount || null;
      updateData.requiresApprovalAbove = limits.requiresApprovalAbove || null;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;

      // Si se desactiva, invalidar todas las sesiones
      if (!isActive) {
        await prisma.clientPortalSession.updateMany({
          where: { portalUserId: params.id },
          data: { isActive: false },
        });
      }
    }

    // Actualizar usuario
    const updated = await prisma.clientPortalUser.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: 'Usuario actualizado correctamente',
      usuario: {
        id: updated.id,
        isActive: updated.isActive,
        permissions: {
          canViewPrices: updated.canViewPrices,
          canViewQuotes: updated.canViewQuotes,
          canAcceptQuotes: updated.canAcceptQuotes,
          canCreateOrders: updated.canCreateOrders,
          canViewHistory: updated.canViewHistory,
          canViewDocuments: updated.canViewDocuments,
        },
        limits: {
          maxOrderAmount: updated.maxOrderAmount ? Number(updated.maxOrderAmount) : null,
          requiresApprovalAbove: updated.requiresApprovalAbove ? Number(updated.requiresApprovalAbove) : null,
        },
      },
    });
  } catch (error) {
    console.error('Error actualizando usuario del portal:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/portal/usuarios/[id]
 * Eliminar usuario del portal
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que el usuario existe
    const usuario = await prisma.clientPortalUser.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Eliminar usuario (cascade eliminará sesiones, invitaciones, etc.)
    await prisma.clientPortalUser.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Usuario eliminado correctamente',
    });
  } catch (error) {
    console.error('Error eliminando usuario del portal:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
