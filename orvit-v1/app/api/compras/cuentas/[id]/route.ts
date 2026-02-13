import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener usuario desde JWT
async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    
    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true
          }
        }
      }
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// TODO: Implementar con Prisma cuando tengas la tabla de cuentas

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { nombre, descripcion, activa } = body;

    if (!nombre || !nombre.trim()) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    // Verificar que la cuenta existe y pertenece a la empresa
    const cuentaExistente = await prisma.purchaseAccount.findFirst({
      where: {
        id: parseInt(id),
        companyId: companyId,
      },
    });

    if (!cuentaExistente) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    // Actualizar cuenta en la base de datos
    const cuentaActualizada = await prisma.purchaseAccount.update({
      where: { id: parseInt(id) },
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        activa: activa !== undefined ? activa : cuentaExistente.activa,
      },
    });

    return NextResponse.json(cuentaActualizada);
  } catch (error) {
    console.error('Error updating cuenta:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la cuenta' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = params;

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    // Verificar que la cuenta existe y pertenece a la empresa
    const cuentaExistente = await prisma.purchaseAccount.findFirst({
      where: {
        id: parseInt(id),
        companyId: companyId,
      },
      include: {
        comprobantes: {
          take: 1,
        },
      },
    });

    if (!cuentaExistente) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    // Verificar que no esté siendo usada en comprobantes
    if (cuentaExistente.comprobantes.length > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar la cuenta porque está siendo usada en comprobantes' },
        { status: 400 }
      );
    }

    // Eliminar cuenta de la base de datos
    await prisma.purchaseAccount.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting cuenta:', error);
    return NextResponse.json(
      { error: 'Error al eliminar la cuenta' },
      { status: 500 }
    );
  }
}

