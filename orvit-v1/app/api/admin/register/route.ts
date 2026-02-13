import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
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

export async function POST(request: Request) {
  try {
    // Verificar que el usuario es superadmin
    const superAdminPayload = await verifySuperAdmin();

    const body = await request.json();
    
    // Validaciones básicas
    if (!body.email || !body.password || !body.name) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      );
    }

    // Verificar si el email ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'El correo electrónico ya está registrado' },
        { status: 400 }
      );
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(body.password, 10);

    // Crear el nuevo administrador
    const newAdmin = await prisma.user.create({
      data: {
        email: body.email,
        password: hashedPassword,
        name: body.name,
        role: 'ADMIN',
      },
    });

    // NOTA: El administrador NO se asocia automáticamente a ninguna empresa
    // El administrador deberá crear sus propias empresas o ser asociado manualmente
    console.log(`🏢 [Register Admin] ✅ Administrador ${newAdmin.name} creado sin empresa asociada`);
    console.log('💡 El administrador puede crear sus propias empresas desde la interfaz');

    // No enviamos la contraseña en la respuesta
    const { password, ...adminWithoutPassword } = newAdmin;

    return NextResponse.json({
      admin: adminWithoutPassword,
      message: 'Administrador creado exitosamente',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error al registrar administrador:', error);
    
    if (error.message === 'No autorizado') {
      return NextResponse.json(
        { error: 'No autorizado para realizar esta acción' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Error al registrar administrador' },
      { status: 500 }
    );
  }
} 