/**
 * Protección para rutas de debug
 * Solo permite acceso en desarrollo o con autenticación SUPERADMIN
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export interface DebugAuthResult {
  allowed: boolean;
  response?: NextResponse;
  user?: { id: number; role: string };
}

/**
 * Verifica si el acceso a rutas de debug está permitido
 * - En desarrollo: siempre permitido
 * - En producción: requiere SUPERADMIN
 */
export async function checkDebugAccess(): Promise<DebugAuthResult> {
  // En desarrollo, permitir acceso
  if (process.env.NODE_ENV === 'development') {
    return { allowed: true };
  }

  // En producción, verificar que sea SUPERADMIN
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return {
        allowed: false,
        response: NextResponse.json(
          { error: 'Debug routes require authentication in production' },
          { status: 401 }
        )
      };
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: { id: true, role: true }
    });

    if (!user || user.role !== 'SUPERADMIN') {
      return {
        allowed: false,
        response: NextResponse.json(
          { error: 'Debug routes require SUPERADMIN role in production' },
          { status: 403 }
        )
      };
    }

    return { allowed: true, user: { id: user.id, role: user.role } };
  } catch (error) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    };
  }
}
