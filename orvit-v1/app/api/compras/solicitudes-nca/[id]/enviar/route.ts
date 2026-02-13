import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        name: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    return user;
  } catch (error) {
    return null;
  }
}

// POST - Marcar solicitud como enviada al proveedor
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const solicitud = await prisma.creditNoteRequest.findFirst({
      where: { id, companyId },
      include: {
        proveedor: { select: { id: true, name: true, email: true } }
      }
    });

    if (!solicitud) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // Solo se puede enviar desde estado NUEVA
    if (solicitud.estado !== 'SNCA_NUEVA') {
      return NextResponse.json(
        { error: `No se puede enviar una solicitud en estado ${solicitud.estado}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { metodoEnvio, notas } = body;

    // Actualizar estado
    const actualizada = await prisma.creditNoteRequest.update({
      where: { id },
      data: {
        estado: 'SNCA_ENVIADA',
        fechaEnvio: new Date(),
        ...(notas && { descripcion: solicitud.descripcion ? `${solicitud.descripcion}\n\nNotas envío: ${notas}` : `Notas envío: ${notas}` })
      },
      include: {
        proveedor: { select: { id: true, name: true, email: true } }
      }
    });

    // Registrar auditoría
    await prisma.purchaseAuditLog.create({
      data: {
        entidad: 'credit_note_request',
        entidadId: id,
        accion: 'ENVIAR_A_PROVEEDOR',
        datosAnteriores: { estado: 'SNCA_NUEVA' },
        datosNuevos: {
          estado: 'SNCA_ENVIADA',
          fechaEnvio: actualizada.fechaEnvio,
          metodoEnvio: metodoEnvio || 'manual'
        },
        companyId,
        userId: user.id
      }
    });

    // TODO: Aquí se podría integrar envío de email si el proveedor tiene email

    return NextResponse.json({
      message: 'Solicitud marcada como enviada al proveedor',
      solicitud: actualizada
    });
  } catch (error) {
    console.error('Error enviando solicitud NCA:', error);
    return NextResponse.json(
      { error: 'Error al enviar la solicitud' },
      { status: 500 }
    );
  }
}
