import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyPermission } from '@/lib/auth/shared-helpers';
import { verificarSoDPedidoAprobacion } from '@/lib/compras/pedidos-enforcement';

export const dynamic = 'force-dynamic';

// POST - Aprobar/Rechazar pedido (EN_APROBACION -> APROBADA/RECHAZADA)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAnyPermission(['compras.pedidos.aprobar', 'compras.pedidos.rechazar']);
    if (error) return error;

    const companyId = user!.companyId;

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
    const sodCheck = verificarSoDPedidoAprobacion(pedido.solicitanteId, user!.id);
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
            contenido: `Pedido aprobado por ${user!.name}${motivo ? `. Motivo: ${motivo}` : ''}`,
            companyId,
            userId: user!.id
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
            contenido: `Pedido rechazado por ${user!.name}. Motivo: ${motivo}`,
            companyId,
            userId: user!.id
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
