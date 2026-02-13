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

// POST - Cerrar solicitud de NCA
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
        creditNotes: { select: { id: true, estado: true } }
      }
    });

    if (!solicitud) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // Solo se puede cerrar si tiene NCA recibida o si fue rechazada
    const estadosPermitidos = ['SNCA_NCA_RECIBIDA', 'SNCA_APROBADA', 'SNCA_PARCIAL', 'SNCA_RECHAZADA'];
    if (!estadosPermitidos.includes(solicitud.estado)) {
      return NextResponse.json(
        { error: `No se puede cerrar una solicitud en estado ${solicitud.estado}. Debe tener respuesta del proveedor.` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { notas, motivoCierre } = body;

    // Verificar si las NCAs relacionadas están aplicadas
    // Estados pendientes de aplicar: BORRADOR o EMITIDA (no APLICADA ni ANULADA)
    const ncasPendientes = solicitud.creditNotes.filter(nca => nca.estado === 'BORRADOR' || nca.estado === 'EMITIDA');
    if (ncasPendientes.length > 0 && solicitud.estado !== 'SNCA_RECHAZADA') {
      return NextResponse.json(
        {
          error: 'Hay NCAs pendientes de aplicar',
          ncasPendientes: ncasPendientes.map(n => n.id)
        },
        { status: 400 }
      );
    }

    // Determinar estado final
    let estadoFinal = 'SNCA_CERRADA';
    if (solicitud.estado === 'SNCA_RECHAZADA') {
      estadoFinal = 'SNCA_CERRADA'; // Se cierra aunque fue rechazada
    }

    // Actualizar estado
    const actualizada = await prisma.creditNoteRequest.update({
      where: { id },
      data: {
        estado: estadoFinal as any,
        fechaCierre: new Date(),
        ...(notas && {
          descripcion: solicitud.descripcion
            ? `${solicitud.descripcion}\n\nNotas cierre: ${notas}`
            : `Notas cierre: ${notas}`
        })
      }
    });

    // Registrar auditoría
    await prisma.purchaseAuditLog.create({
      data: {
        entidad: 'credit_note_request',
        entidadId: id,
        accion: 'CERRAR_SOLICITUD',
        datosAnteriores: { estado: solicitud.estado },
        datosNuevos: {
          estado: estadoFinal,
          fechaCierre: actualizada.fechaCierre,
          motivoCierre
        },
        companyId,
        userId: user.id
      }
    });

    return NextResponse.json({
      message: 'Solicitud de NCA cerrada',
      solicitud: actualizada
    });
  } catch (error) {
    console.error('Error cerrando solicitud NCA:', error);
    return NextResponse.json(
      { error: 'Error al cerrar la solicitud' },
      { status: 500 }
    );
  }
}
