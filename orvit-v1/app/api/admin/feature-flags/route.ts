import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withGuards } from '@/lib/middleware/withGuards';
import { invalidateFeatureFlagCache } from '@/lib/feature-flags';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ─── Validación ─────────────────────────────────────────────────────────────

const createFlagSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede superar 100 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  enabled: z.boolean().default(false),
  companyId: z.number().int().positive().nullable().optional(),
  userId: z.number().int().positive().nullable().optional(),
});

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'ADMIN_ENTERPRISE'];

// ─── GET: Listar feature flags ──────────────────────────────────────────────

export const GET = withGuards(async (request: NextRequest, { user }) => {
  if (!ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json(
      { error: 'Solo administradores pueden gestionar feature flags' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    const where: Record<string, unknown> = {};

    // SUPERADMIN ve todos, otros admin solo los de su empresa + globales
    if (user.role !== 'SUPERADMIN') {
      where.OR = [
        { companyId: user.companyId },
        { companyId: null },
      ];
    }

    if (name) {
      where.name = { contains: name, mode: 'insensitive' };
    }

    const flags = await prisma.featureFlag.findMany({
      where,
      orderBy: [{ name: 'asc' }, { companyId: 'asc' }, { userId: 'asc' }],
      include: {
        company: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const data = flags.map((flag) => ({
      id: flag.id,
      name: flag.name,
      enabled: flag.enabled,
      scope: flag.userId
        ? 'user'
        : flag.companyId
          ? 'company'
          : 'global',
      companyId: flag.companyId,
      companyName: flag.company?.name ?? null,
      userId: flag.userId,
      userName: flag.user?.name ?? null,
      userEmail: flag.user?.email ?? null,
      createdAt: flag.createdAt,
      updatedAt: flag.updatedAt,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error en GET /api/admin/feature-flags:', error);
    return NextResponse.json(
      { error: 'Error al obtener feature flags' },
      { status: 500 }
    );
  }
});

// ─── POST: Crear o actualizar feature flag ──────────────────────────────────

export const POST = withGuards(async (request: NextRequest, { user }) => {
  if (!ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json(
      { error: 'Solo administradores pueden gestionar feature flags' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createFlagSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, enabled, companyId: rawCompanyId, userId: rawUserId } = parsed.data;
    const companyId = rawCompanyId ?? null;
    const userId = rawUserId ?? null;

    // Non-SUPERADMIN solo puede crear flags para su propia empresa
    if (user.role !== 'SUPERADMIN' && companyId !== null && companyId !== user.companyId) {
      return NextResponse.json(
        { error: 'Solo puedes gestionar flags de tu empresa' },
        { status: 403 }
      );
    }

    // Non-SUPERADMIN no puede crear flags globales
    if (user.role !== 'SUPERADMIN' && companyId === null) {
      return NextResponse.json(
        { error: 'Solo SUPERADMIN puede crear flags globales' },
        { status: 403 }
      );
    }

    // Upsert: crear o actualizar si ya existe
    const flag = await prisma.featureFlag.upsert({
      where: {
        name_companyId_userId: { name, companyId, userId },
      },
      update: { enabled },
      create: { name, enabled, companyId, userId },
    });

    // Invalidar cache
    await invalidateFeatureFlagCache(
      name,
      companyId ?? undefined,
      userId ?? undefined
    );

    return NextResponse.json({
      data: flag,
      message: 'Feature flag guardado correctamente',
    });
  } catch (error) {
    console.error('Error en POST /api/admin/feature-flags:', error);
    return NextResponse.json(
      { error: 'Error al guardar feature flag' },
      { status: 500 }
    );
  }
}, {
  rateLimitOverride: 30,
});

// ─── DELETE: Eliminar feature flag ──────────────────────────────────────────

export const DELETE = withGuards(async (request: NextRequest, { user }) => {
  if (!ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json(
      { error: 'Solo administradores pueden gestionar feature flags' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');

    if (!idParam) {
      return NextResponse.json(
        { error: 'El parámetro id es requerido' },
        { status: 400 }
      );
    }

    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'El id debe ser un número' },
        { status: 400 }
      );
    }

    // Buscar el flag antes de eliminarlo para validar acceso y para invalidar cache
    const flag = await prisma.featureFlag.findUnique({ where: { id } });

    if (!flag) {
      return NextResponse.json(
        { error: 'Feature flag no encontrado' },
        { status: 404 }
      );
    }

    // Non-SUPERADMIN solo puede eliminar flags de su empresa
    if (user.role !== 'SUPERADMIN' && flag.companyId !== null && flag.companyId !== user.companyId) {
      return NextResponse.json(
        { error: 'Solo puedes eliminar flags de tu empresa' },
        { status: 403 }
      );
    }

    if (user.role !== 'SUPERADMIN' && flag.companyId === null) {
      return NextResponse.json(
        { error: 'Solo SUPERADMIN puede eliminar flags globales' },
        { status: 403 }
      );
    }

    await prisma.featureFlag.delete({ where: { id } });

    // Invalidar cache
    await invalidateFeatureFlagCache(
      flag.name,
      flag.companyId ?? undefined,
      flag.userId ?? undefined
    );

    return NextResponse.json({
      message: 'Feature flag eliminado correctamente',
    });
  } catch (error) {
    console.error('Error en DELETE /api/admin/feature-flags:', error);
    return NextResponse.json(
      { error: 'Error al eliminar feature flag' },
      { status: 500 }
    );
  }
}, {
  rateLimitOverride: 30,
});
