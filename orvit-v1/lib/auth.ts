// Archivo de configuración de autenticación usando JWT nativo
// Este archivo solo mantiene las configuraciones necesarias para nuestro sistema JWT personalizado

import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

// Validación lazy del JWT_SECRET para evitar crash en module load
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET no está definido o es demasiado corto. ' +
      'Debe tener al menos 32 caracteres. ' +
      'Configuralo en .env o en las variables de entorno del servidor.'
    );
  }
  return secret;
}

// Export mantenido para compatibilidad con 180+ archivos que importan JWT_SECRET
export const JWT_SECRET = process.env.JWT_SECRET ?? '';

function getJwtSecretKey(): Uint8Array {
  return new TextEncoder().encode(getJwtSecret());
}

export async function getUserIdFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) throw new Error('No token provided');
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
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
    const { payload } = await jwtVerify(token, getJwtSecretKey());
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

    const { payload } = await jwtVerify(token, getJwtSecretKey());

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