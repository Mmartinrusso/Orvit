import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { verificarSoDPedidoAprobacion } from '@/lib/compras/pedidos-enforcement';

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
        role: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    return user;
  } catch {
    return null;
  }
}

// POST - Aprobar pedido (EN_APROBACION -> APROBADA)
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

    // Verificar permisos - roles que pueden aprobar
    if (!['SUPERADMIN', 'ADMIN', 'ADMIN_ENTERPRISE', 'SUPERVISOR'].includes(user.role)) {
      return NextResponse.json({ error: 'No tiene permisos para aprobar' }, { status: 403 });
    }

    const { id } = await params;
    const pedidoId = parseInt(id);
    const body = await request.json();

    // Soportar ambos formatos: { accion: 'aprobar' } o { aprobar: true }
    let accion: string;
    let motivo: string | undefined;

    if ('accion' in body) {
      accion = body.accion;
      motivo = body.motivo;
    } else if ('aprobar' in body) {
      accion = body.aprobar ? 'aprobar' : 'rechazar';
      motivo = body.motivo;
    } else {
      return NextResponse.json({ error: 'Formato de solicitud inválido' }, { status: 400 });
    }

    // Usar select para evitar columnas que no existen en la BD (como exchangeRate)
    const pedido = await prisma.purchaseRequest.findFirst({
      where: { id: pedidoId, companyId },
      select: {
        id: true,
        numero: true,
        estado: true,
        solicitanteId: true,
        quotations: {
          where: { esSeleccionada: true },
          select: {
            id: true,
            numero: true,
            esSeleccionada: true
          }
        }
      }
    });

    if (!pedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    if (pedido.estado !== 'EN_APROBACION') {
      return NextResponse.json(
        { error: 'Solo se pueden aprobar/rechazar pedidos en estado EN_APROBACION' },
        { status: 400 }
      );
    }

    // ENFORCEMENT: SoD - Verificar que el creador no sea quien aprueba
    const sodCheck = verificarSoDPedidoAprobacion(pedido.solicitanteId, user.id);
    if (!sodCheck.permitido) {
      console.log('[PEDIDOS APROBAR] ❌ Violación SoD:', sodCheck.mensaje);
      return NextResponse.json(
        { error: sodCheck.mensaje, code: 'SOD_VIOLATION' },
        { status: 403 }
      );
    }

    if (accion === 'aprobar') {
      // Verificar que hay cotización seleccionada
      if (pedido.quotations.length === 0) {
        return NextResponse.json(
          { error: 'Debe haber una cotización seleccionada para aprobar' },
          { status: 400 }
        );
      }

      // Aprobar
      const [pedidoActualizado] = await prisma.$transaction([
        prisma.purchaseRequest.update({
          where: { id: pedidoId },
          data: { estado: 'APROBADA' }
        }),
        prisma.purchaseComment.create({
          data: {
            entidad: 'request',
            entidadId: pedidoId,
            tipo: 'SISTEMA',
            contenido: `Pedido aprobado por ${user.name}${motivo ? `. Motivo: ${motivo}` : ''}`,
            companyId,
            userId: user.id
          }
        })
      ]);

      return NextResponse.json({
        success: true,
        pedido: pedidoActualizado,
        message: 'Pedido aprobado exitosamente'
      });
    } else if (accion === 'rechazar') {
      if (!motivo) {
        return NextResponse.json(
          { error: 'Debe proporcionar un motivo de rechazo' },
          { status: 400 }
        );
      }

      // Rechazar
      const [pedidoActualizado] = await prisma.$transaction([
        prisma.purchaseRequest.update({
          where: { id: pedidoId },
          data: { estado: 'RECHAZADA' }
        }),
        prisma.purchaseComment.create({
          data: {
            entidad: 'request',
            entidadId: pedidoId,
            tipo: 'SISTEMA',
            contenido: `Pedido rechazado por ${user.name}. Motivo: ${motivo}`,
            companyId,
            userId: user.id
          }
        })
      ]);

      return NextResponse.json({
        success: true,
        pedido: pedidoActualizado,
        message: 'Pedido rechazado'
      });
    } else {
      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error aprobando/rechazando pedido:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}
