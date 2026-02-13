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

// GET - Obtener rubros/sectores por empresa
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

    const businessSectors = await prisma.businessSector.findMany({
      where: { companyId: parseInt(companyId) },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ businessSectors });
  } catch (error) {
    console.error('Error obteniendo rubros:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST - Crear rubro/sector
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

    const sector = await prisma.businessSector.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        companyId: parseInt(companyId),
      },
    });

    return NextResponse.json(sector, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un rubro con ese nombre' }, { status: 409 });
    }
    console.error('Error creando rubro:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT - Actualizar rubro/sector
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

    const sector = await prisma.businessSector.update({
      where: { id },
      data: {
        name: name?.trim(),
        description: description?.trim() || null,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    return NextResponse.json(sector);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un rubro con ese nombre' }, { status: 409 });
    }
    console.error('Error actualizando rubro:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE - Eliminar rubro/sector
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

    await prisma.businessSector.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando rubro:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
