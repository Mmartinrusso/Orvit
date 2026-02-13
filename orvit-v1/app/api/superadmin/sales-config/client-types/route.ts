import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function verifyAdmin() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
    });
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

// GET - Obtener tipos de cliente por empresa
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId requerido' }, { status: 400 });
    }

    const clientTypes = await prisma.clientType.findMany({
      where: { companyId: parseInt(companyId) },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ clientTypes });
  } catch (error) {
    console.error('Error obteniendo tipos de cliente:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST - Crear tipo de cliente
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, companyId } = body;

    if (!name?.trim() || !companyId) {
      return NextResponse.json({ error: 'Nombre y companyId requeridos' }, { status: 400 });
    }

    const clientType = await prisma.clientType.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        companyId: parseInt(companyId),
      },
    });

    return NextResponse.json(clientType, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un tipo con ese nombre' }, { status: 409 });
    }
    console.error('Error creando tipo de cliente:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT - Actualizar tipo de cliente
export async function PUT(request: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, description, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const clientType = await prisma.clientType.update({
      where: { id },
      data: {
        name: name?.trim(),
        description: description?.trim() || null,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    return NextResponse.json(clientType);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un tipo con ese nombre' }, { status: 409 });
    }
    console.error('Error actualizando tipo de cliente:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE - Eliminar tipo de cliente
export async function DELETE(request: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    await prisma.clientType.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando tipo de cliente:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
