// Archivo de configuración de autenticación usando JWT nativo
// Este archivo solo mantiene las configuraciones necesarias para nuestro sistema JWT personalizado

// Ya no necesitamos NextAuth, usamos JWT directamente con jose y cookies
export const JWT_SECRET = process.env.JWT_SECRET || 'Messi';

import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export async function getUserIdFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) throw new Error('No token provided');
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload.userId as number;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

/**
 * Verifica un token JWT y retorna el payload completo
 * Usado por endpoints que necesitan userId, companyId, etc.
 */
export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload;
  } catch (error) {
    return null;
  }
}

export interface AuthPayload {
  userId: number;
  companyId: number | null;
  role: string;
  email?: string;
  name?: string;
}

/**
 * Verifica la autenticación de una request y retorna el payload del usuario
 * Usado por API routes que necesitan verificar autenticación
 */
export async function verifyAuth(request: NextRequest): Promise<AuthPayload | null> {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    return {
      userId: payload.userId as number,
      companyId: (payload.companyId as number) || null,
      role: payload.role as string,
      email: payload.email as string | undefined,
      name: payload.name as string | undefined,
    };
  } catch (error) {
    return null;
  }
} 