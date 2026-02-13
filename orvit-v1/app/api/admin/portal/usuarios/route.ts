import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { generateInviteToken, hashPassword } from '@/lib/portal/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/portal/usuarios
 * Listar usuarios del portal de clientes
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('isActive');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Construir filtro
    const where: any = {
      companyId: auth.companyId,
    };

    if (clientId) {
      where.clientId = clientId;
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { contact: { firstName: { contains: search, mode: 'insensitive' } } },
        { contact: { lastName: { contains: search, mode: 'insensitive' } } },
        { client: { legalName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Obtener usuarios
    const [usuarios, total] = await Promise.all([
      prisma.clientPortalUser.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              position: true,
            },
          },
          client: {
            select: {
              id: true,
              name: true,
              legalName: true,
            },
          },
          invites: {
            where: { usedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              token: true,
              expiresAt: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              sessions: { where: { isActive: true } },
              orders: true,
              activities: true,
            },
          },
        },
      }),
      prisma.clientPortalUser.count({ where }),
    ]);

    // Formatear respuesta
    const formattedUsuarios = usuarios.map((u) => ({
      id: u.id,
      email: u.email,
      contact: u.contact,
      client: u.client,
      isActive: u.isActive,
      isVerified: u.isVerified,
      activatedAt: u.activatedAt,
      lastLoginAt: u.lastLoginAt,
      lastLoginIp: u.lastLoginIp,
      createdAt: u.createdAt,
      permissions: {
        canViewPrices: u.canViewPrices,
        canViewQuotes: u.canViewQuotes,
        canAcceptQuotes: u.canAcceptQuotes,
        canCreateOrders: u.canCreateOrders,
        canViewHistory: u.canViewHistory,
        canViewDocuments: u.canViewDocuments,
      },
      limits: {
        maxOrderAmount: u.maxOrderAmount ? Number(u.maxOrderAmount) : null,
        requiresApprovalAbove: u.requiresApprovalAbove ? Number(u.requiresApprovalAbove) : null,
      },
      pendingInvite: u.invites[0] || null,
      stats: {
        activeSessions: u._count.sessions,
        totalOrders: u._count.orders,
        totalActivities: u._count.activities,
      },
    }));

    return NextResponse.json({
      usuarios: formattedUsuarios,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error obteniendo usuarios del portal:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/portal/usuarios
 * Crear usuario del portal (invitar contacto)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      contactId,
      email,
      permissions = {},
      limits = {},
    } = body;

    // Validaciones
    if (!contactId) {
      return NextResponse.json(
        { error: 'Debe seleccionar un contacto' },
        { status: 400 }
      );
    }

    // Verificar que el contacto existe y pertenece a la empresa
    const contact = await prisma.clientContact.findFirst({
      where: {
        id: contactId,
        client: {
          companyId: auth.companyId,
        },
      },
      include: {
        client: {
          select: { id: true, name: true, legalName: true },
        },
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: 'Contacto no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que no exista ya un usuario para este contacto
    const existingUser = await prisma.clientPortalUser.findUnique({
      where: { contactId },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Este contacto ya tiene acceso al portal' },
        { status: 400 }
      );
    }

    // Usar email del contacto o el proporcionado
    const userEmail = email || contact.email;
    if (!userEmail) {
      return NextResponse.json(
        { error: 'El contacto debe tener un email' },
        { status: 400 }
      );
    }

    // Verificar que el email no esté en uso
    const emailInUse = await prisma.clientPortalUser.findFirst({
      where: {
        email: userEmail.toLowerCase().trim(),
        companyId: auth.companyId,
      },
    });

    if (emailInUse) {
      return NextResponse.json(
        { error: 'Este email ya está registrado en el portal' },
        { status: 400 }
      );
    }

    // Obtener configuración del portal
    const config = await prisma.salesConfig.findUnique({
      where: { companyId: auth.companyId },
      select: { portalInviteDays: true },
    });

    const inviteDays = config?.portalInviteDays || 7;

    // Generar token de invitación
    const inviteToken = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + inviteDays);

    // Crear usuario y invitación en transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear usuario del portal
      const portalUser = await tx.clientPortalUser.create({
        data: {
          companyId: auth.companyId,
          clientId: contact.clientId,
          contactId: contact.id,
          email: userEmail.toLowerCase().trim(),
          passwordHash: '', // Se establecerá en la activación
          isActive: true,
          isVerified: false,
          // Permisos
          canViewPrices: permissions.canViewPrices ?? true,
          canViewQuotes: permissions.canViewQuotes ?? true,
          canAcceptQuotes: permissions.canAcceptQuotes ?? false,
          canCreateOrders: permissions.canCreateOrders ?? false,
          canViewHistory: permissions.canViewHistory ?? true,
          canViewDocuments: permissions.canViewDocuments ?? true,
          // Límites
          maxOrderAmount: limits.maxOrderAmount || null,
          requiresApprovalAbove: limits.requiresApprovalAbove || null,
        },
      });

      // Crear invitación
      const invite = await tx.clientPortalInvite.create({
        data: {
          portalUserId: portalUser.id,
          companyId: auth.companyId,
          token: inviteToken,
          expiresAt,
          invitedById: auth.userId,
        },
      });

      return { portalUser, invite };
    });

    // Construir URL de activación
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const activationUrl = `${baseUrl}/portal/activate/${inviteToken}`;

    return NextResponse.json({
      success: true,
      message: 'Usuario creado correctamente',
      usuario: {
        id: result.portalUser.id,
        email: result.portalUser.email,
        contact: {
          firstName: contact.firstName,
          lastName: contact.lastName,
        },
        client: contact.client,
      },
      invite: {
        token: inviteToken,
        expiresAt,
        activationUrl,
      },
    });
  } catch (error) {
    console.error('Error creando usuario del portal:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
