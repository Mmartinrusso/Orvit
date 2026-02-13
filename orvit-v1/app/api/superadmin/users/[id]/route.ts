import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { logBillingAction } from '@/lib/billing/audit';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// GET - Obtener detalle de usuario
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userId = parseInt(params.id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        subscription: {
          select: {
            id: true,
            status: true,
            billingCycle: true,
            startDate: true,
            currentPeriodEnd: true,
            nextBillingDate: true,
            includedTokensRemaining: true,
            purchasedTokensBalance: true,
            tokensUsedThisPeriod: true,
            plan: {
              select: {
                id: true,
                displayName: true,
                monthlyPrice: true,
              },
            },
          },
        },
        companies: {
          select: {
            id: true,
            name: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Get audit log for this user
    const auditLog = await prisma.billingAuditLog.findMany({
      where: {
        OR: [
          { userId },
          { entityType: 'user', entityId: userId.toString() },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      user: {
        ...user,
        subscription: user.subscription ? {
          ...user.subscription,
          plan: {
            ...user.subscription.plan,
            monthlyPrice: Number(user.subscription.plan.monthlyPrice),
          },
        } : null,
      },
      auditLog,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Error al obtener usuario' }, { status: 500 });
  }
}

// PUT - Actualizar usuario
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userId = parseInt(params.id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
    }

    const body = await request.json();
    const { name, email, phone, role, isActive } = body;

    // Get current user data
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Check email uniqueness if changing
    if (email && email.toLowerCase() !== currentUser.email) {
      const existing = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Ya existe un usuario con ese email' },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email.toLowerCase();
    if (phone !== undefined) updateData.phone = phone || null;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Audit log
    await logBillingAction(
      auth.userId,
      'USER_UPDATED',
      'user',
      userId.toString(),
      { name: currentUser.name, email: currentUser.email, role: currentUser.role, isActive: currentUser.isActive },
      updateData
    );

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
  }
}

// POST - Acciones especiales (reset password, impersonate, etc)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userId = parseInt(params.id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
    }

    const body = await request.json();
    const { action, newPassword } = body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    switch (action) {
      case 'reset_password': {
        const password = newPassword || Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
          where: { id: userId },
          data: { password: hashedPassword },
        });

        await logBillingAction(
          auth.userId,
          'USER_PASSWORD_RESET',
          'user',
          userId.toString(),
          null,
          { resetBy: auth.userId }
        );

        return NextResponse.json({
          success: true,
          message: 'Contrasena reseteada',
          ...(newPassword ? {} : { generatedPassword: password }),
        });
      }

      case 'toggle_active': {
        const newStatus = !user.isActive;
        await prisma.user.update({
          where: { id: userId },
          data: { isActive: newStatus },
        });

        await logBillingAction(
          auth.userId,
          newStatus ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
          'user',
          userId.toString(),
          { isActive: user.isActive },
          { isActive: newStatus }
        );

        return NextResponse.json({
          success: true,
          isActive: newStatus,
          message: newStatus ? 'Usuario activado' : 'Usuario desactivado',
        });
      }

      default:
        return NextResponse.json({ error: 'Accion no valida' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error performing action:', error);
    return NextResponse.json({ error: 'Error al realizar accion' }, { status: 500 });
  }
}
