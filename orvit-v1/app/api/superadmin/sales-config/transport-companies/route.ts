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

// GET - Obtener transportes por empresa
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

    const transportCompanies = await prisma.transportCompany.findMany({
      where: { companyId: parseInt(companyId) },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ transportCompanies });
  } catch (error) {
    console.error('Error obteniendo transportes:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST - Crear transporte
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, phone, email, companyId } = body;

    if (!name?.trim() || !companyId) {
      return NextResponse.json({ error: 'Nombre y companyId requeridos' }, { status: 400 });
    }

    const transport = await prisma.transportCompany.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        companyId: parseInt(companyId),
      },
    });

    return NextResponse.json(transport, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un transporte con ese nombre' }, { status: 409 });
    }
    console.error('Error creando transporte:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT - Actualizar transporte
export async function PUT(request: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, description, phone, email, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const transport = await prisma.transportCompany.update({
      where: { id },
      data: {
        name: name?.trim(),
        description: description?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    return NextResponse.json(transport);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un transporte con ese nombre' }, { status: 409 });
    }
    console.error('Error actualizando transporte:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE - Eliminar transporte
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

    await prisma.transportCompany.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando transporte:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
