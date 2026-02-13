import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { verificarSoD, registrarAccionParaSoD } from '@/lib/compras/sod-rules';

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

// POST - Ejecutar acción sobre OC
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { accion, motivo, comentarios } = body;

    const orden = await prisma.purchaseOrder.findFirst({
      where: { id, companyId }
    });

    if (!orden) {
      return NextResponse.json({ error: 'Orden de compra no encontrada' }, { status: 404 });
    }

    let updateData: any = {};
    let nuevoEstado: string | null = null;

    switch (accion) {
      case 'enviar_aprobacion':
        // De BORRADOR a PENDIENTE_APROBACION
        if (orden.estado !== 'BORRADOR') {
          return NextResponse.json(
            { error: 'Solo se pueden enviar a aprobación órdenes en borrador' },
            { status: 400 }
          );
        }
        nuevoEstado = 'PENDIENTE_APROBACION';
        updateData.requiereAprobacion = true;
        break;

      case 'aprobar':
        // De PENDIENTE_APROBACION a APROBADA
        if (orden.estado !== 'PENDIENTE_APROBACION') {
          return NextResponse.json(
            { error: 'Solo se pueden aprobar órdenes pendientes de aprobación' },
            { status: 400 }
          );
        }

        // ENFORCEMENT: SoD - Verificar que el creador no sea quien aprueba
        if (orden.createdBy === user.id) {
          console.log('[OC ACCIONES] ❌ Violación SoD: Creador intentando aprobar');
          return NextResponse.json(
            {
              error: 'No puede aprobar una orden de compra que usted mismo creó (SoD)',
              code: 'SOD_VIOLATION'
            },
            { status: 403 }
          );
        }

        // Verificar SoD adicional basado en audit log
        const sodCheckAprobar = await verificarSoD(
          user.id,
          'APROBAR_OC',
          id,
          'OC',
          prisma
        );
        if (!sodCheckAprobar.allowed) {
          console.log('[OC ACCIONES] ❌ Violación SoD:', sodCheckAprobar.message);
          return NextResponse.json(
            { error: sodCheckAprobar.message, code: 'SOD_VIOLATION' },
            { status: 403 }
          );
        }

        nuevoEstado = 'APROBADA';
        updateData.aprobadoPor = user.id;
        updateData.aprobadoAt = new Date();
        break;

      case 'rechazar':
        // De PENDIENTE_APROBACION a RECHAZADA
        if (orden.estado !== 'PENDIENTE_APROBACION') {
          return NextResponse.json(
            { error: 'Solo se pueden rechazar órdenes pendientes de aprobación' },
            { status: 400 }
          );
        }
        if (!motivo) {
          return NextResponse.json(
            { error: 'El motivo del rechazo es requerido' },
            { status: 400 }
          );
        }
        nuevoEstado = 'RECHAZADA';
        updateData.rechazadoPor = user.id;
        updateData.rechazadoAt = new Date();
        updateData.motivoRechazo = motivo;
        break;

      case 'enviar_proveedor':
        // De APROBADA o BORRADOR (si no requiere aprobación) a ENVIADA_PROVEEDOR
        if (!['APROBADA', 'BORRADOR'].includes(orden.estado)) {
          return NextResponse.json(
            { error: 'Solo se pueden enviar órdenes aprobadas o en borrador' },
            { status: 400 }
          );
        }
        if (orden.estado === 'BORRADOR' && orden.requiereAprobacion) {
          return NextResponse.json(
            { error: 'Esta orden requiere aprobación antes de enviarse' },
            { status: 400 }
          );
        }
        nuevoEstado = 'ENVIADA_PROVEEDOR';
        break;

      case 'confirmar':
        // De ENVIADA_PROVEEDOR a CONFIRMADA (el proveedor confirmó)
        if (orden.estado !== 'ENVIADA_PROVEEDOR') {
          return NextResponse.json(
            { error: 'Solo se pueden confirmar órdenes enviadas al proveedor' },
            { status: 400 }
          );
        }
        nuevoEstado = 'CONFIRMADA';
        break;

      case 'reabrir':
        // De RECHAZADA o CANCELADA a BORRADOR
        if (!['RECHAZADA', 'CANCELADA'].includes(orden.estado)) {
          return NextResponse.json(
            { error: 'Solo se pueden reabrir órdenes rechazadas o canceladas' },
            { status: 400 }
          );
        }
        nuevoEstado = 'BORRADOR';
        updateData.rechazadoPor = null;
        updateData.rechazadoAt = null;
        updateData.motivoRechazo = null;
        break;

      case 'completar':
        // Marcar como completada manualmente
        if (!['CONFIRMADA', 'PARCIALMENTE_RECIBIDA'].includes(orden.estado)) {
          return NextResponse.json(
            { error: 'Solo se pueden completar órdenes confirmadas o parcialmente recibidas' },
            { status: 400 }
          );
        }
        nuevoEstado = 'COMPLETADA';
        updateData.fechaEntregaReal = new Date();
        break;

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    // Actualizar orden
    const ordenActualizada = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        estado: nuevoEstado as any,
        ...updateData
      },
      include: {
        proveedor: { select: { id: true, name: true } }
      }
    });

    // Mapear acción a nombre SoD consistente
    const accionSoD: Record<string, string> = {
      'enviar_aprobacion': 'ENVIAR_APROBACION',
      'aprobar': 'APROBAR_OC',
      'rechazar': 'RECHAZAR_OC',
      'enviar_proveedor': 'ENVIAR_PROVEEDOR',
      'confirmar': 'CONFIRMAR_OC',
      'reabrir': 'REABRIR_OC',
      'completar': 'COMPLETAR_OC',
    };

    // Registrar en auditoría
    await prisma.purchaseAuditLog.create({
      data: {
        entidad: 'purchase_order',
        entidadId: id,
        accion: accionSoD[accion] || accion.toUpperCase(),
        datosAnteriores: { estado: orden.estado },
        datosNuevos: { estado: nuevoEstado, ...(motivo && { motivo }) },
        companyId,
        userId: user.id,
      }
    });

    return NextResponse.json({
      message: `Orden ${accion.replace('_', ' ')} correctamente`,
      orden: ordenActualizada
    });
  } catch (error) {
    console.error('Error ejecutando acción en orden de compra:', error);
    return NextResponse.json(
      { error: 'Error al ejecutar la acción' },
      { status: 500 }
    );
  }
}
