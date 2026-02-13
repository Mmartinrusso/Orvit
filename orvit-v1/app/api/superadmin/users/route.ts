import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { logBillingAction } from '@/lib/billing/audit';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// GET - Listar usuarios con filtros
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const noSubscription = searchParams.get('noSubscription') === 'true';
    const hasSubscription = searchParams.get('hasSubscription') === 'true';
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build where clause
    const where: any = {};

    if (role) {
      where.role = role;
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by subscription status
    if (noSubscription) {
      where.subscription = null;
    } else if (hasSubscription) {
      where.subscription = { isNot: null };
    }

    const [users, total, stats] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          subscription: {
            select: {
              id: true,
              status: true,
              plan: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
          _count: {
            select: {
              companies: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
      // Get stats
      prisma.user.groupBy({
        by: ['role'],
        _count: true,
      }),
    ]);

    // Format response
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive ?? true,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      companiesCount: user._count.companies,
      subscription: user.subscription ? {
        id: user.subscription.id,
        status: user.subscription.status,
        planId: user.subscription.plan.id,
        planName: user.subscription.plan.displayName,
      } : null,
    }));

    // Format stats
    const roleStats = stats.reduce((acc, s) => {
      acc[s.role] = s._count;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      users: formattedUsers,
      total,
      hasMore: offset + users.length < total,
      stats: {
        byRole: roleStats,
        total,
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 });
  }
}

// POST - Crear nuevo usuario (ADMIN_ENTERPRISE)
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, phone, password, role = 'ADMIN_ENTERPRISE' } = body;

    // Validations
    if (!name || !email) {
      return NextResponse.json(
        { error: 'Nombre y email son requeridos' },
        { status: 400 }
      );
    }

    // Check if email exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un usuario con ese email' },
        { status: 400 }
      );
    }

    // Generate password if not provided
    const userPassword = password || Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(userPassword, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        phone: phone || null,
        password: hashedPassword,
        role,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    // Audit log
    await logBillingAction(
      auth.userId,
      'USER_CREATED',
      'user',
      user.id.toString(),
      null,
      { name: user.name, email: user.email, role: user.role }
    );

    return NextResponse.json({
      success: true,
      user,
      // Only return password if it was auto-generated
      ...(password ? {} : { generatedPassword: userPassword }),
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
  }
}
