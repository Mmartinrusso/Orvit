import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getUserPermissions } from "@/lib/permissions-helpers";
import { JWT_SECRET } from '@/lib/auth';
import { getClientIdentifier, checkRateLimit, incrementRateLimit } from '@/lib/auth/rate-limit';
import { cached, invalidateCache } from '@/lib/cache/cache-manager';
import { authKeys, permissionKeys, TTL } from '@/lib/cache/cache-keys';
import { validateRequest } from '@/lib/validations/helpers';
import { AuthMeSchema } from '@/lib/validations/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

/**
 * Invalidate auth cache for a user (call on login/logout/permission changes)
 */
export async function clearAuthCache(userId?: number) {
  if (userId) {
    await invalidateCache([authKeys.me(userId)]);
  }
}

// POST /api/auth/me - Obtener usuario por email
export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP (5 req/min)
    const clientIp = getClientIdentifier(request);
    const rl = await checkRateLimit(clientIp, 'login');
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Intenta de nuevo más tarde.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rl.retryAfter ?? 60),
          },
        }
      );
    }
    await incrementRateLimit(clientIp, 'login');

    const body = await request.json();
    const validation = validateRequest(AuthMeSchema, body);
    if (!validation.success) return validation.response;

    const { email } = validation.data;

    // Buscar usuario en la base de datos
    const user = await prisma.user.findFirst({
      where: { email }
    });

    if (!user) {
      // console.log('❌ Usuario no encontrado en la base de datos'); // Log reducido
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // console.log('✅ Usuario encontrado:', user.name); // Log reducido

    // Usar directamente el rol del usuario para evitar consultas problemáticas
    const role = user.role || 'USER';

    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: role,
      avatar: user.avatar
    };

    return NextResponse.json(userData);
  } catch (error) {
    console.error('❌ Error obteniendo usuario:', error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// GET /api/auth/me - Verificar sesión actual mediante JWT en cookies
export async function GET(request: NextRequest) {
  try {
    // Intentar accessToken (nuevo sistema) primero, luego token legacy
    const accessToken = cookies().get('accessToken')?.value;
    const legacyToken = cookies().get('token')?.value;
    const token = accessToken || legacyToken;

    if (!token) {
      return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
    }

    // ✅ FIX: Permitir bypass de caché con query param o header
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true' ||
                         request.headers.get('X-Force-Refresh') === 'true';

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
      const userId = payload.userId as number;

      // Force refresh: invalidate cache first
      if (forceRefresh) {
        await invalidateCache([authKeys.me(userId)]);
      }

      const cacheKey = authKeys.me(userId);

      const userData = await cached(cacheKey, async () => {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
            companies: {
              take: 1,
              select: {
                company: { select: { id: true } },
                role: { select: { name: true, sectorId: true } }
              }
            },
            ownedCompanies: {
              take: 1,
              select: { id: true }
            }
          }
        });

        if (!user) return null;

        let companyId: number | null = null;
        let userRoleInCompany: string = user.role || 'USER';
        let userSectorId: number | null = null;

        if (user.ownedCompanies && user.ownedCompanies.length > 0) {
          companyId = user.ownedCompanies[0].id;
        } else if (user.companies && user.companies.length > 0) {
          const userOnCompany = user.companies[0];
          companyId = userOnCompany.company.id;
          if (userOnCompany.role) {
            userRoleInCompany = userOnCompany.role.name;
            if (userOnCompany.role.sectorId) {
              userSectorId = userOnCompany.role.sectorId;
            }
          }
        }

        if (!companyId) companyId = 1;

        const permissions = await getUserPermissions(user.id, userRoleInCompany, companyId);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: userRoleInCompany,
          sectorId: userSectorId,
          avatar: user.avatar,
          permissions: permissions
        };
      }, TTL.SHORT);

      if (!userData) {
        return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
      }

      return NextResponse.json(userData, {
        headers: { 'Cache-Control': 'private, max-age=60' }
      });
    } catch (jwtError) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }
  } catch (error) {
    console.error('❌ Error verificando sesión:', error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
} 