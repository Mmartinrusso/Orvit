import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Esta es la clave secreta para verificar los tokens
const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function verifySuperAdmin() {
  const token = cookies().get('token')?.value;

  if (!token) {
    throw new Error('No autorizado');
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    if (payload.role !== 'SUPERADMIN') {
      throw new Error('No autorizado');
    }

    return payload;
  } catch (error) {
    throw new Error('No autorizado');
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verificar que el usuario es superadmin
    await verifySuperAdmin();

    // Obtener todos los administradores (incluyendo superadmins)
    const admins = await prisma.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'SUPERADMIN']
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transformar para el frontend
    const transformedAdmins = admins.map((admin: {
      id: number;
      name: string | null;
      email: string;
      role: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }) => ({
      id: admin.id.toString(),
      name: admin.name,
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
      createdAt: admin.createdAt.toISOString(),
      updatedAt: admin.updatedAt.toISOString(),
    }));

    return NextResponse.json(transformedAdmins);
  } catch (error: any) {
    console.error('Error al obtener administradores:', error);
    
    if (error.message === 'No autorizado') {
      return NextResponse.json(
        { error: 'No autorizado para realizar esta acción' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 