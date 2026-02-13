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

// POST - Registrar NCA recibida del proveedor
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
        items: true
      }
    });

    if (!solicitud) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // Solo se puede registrar NCA si la solicitud está en estado ENVIADA, EN_REVISION o APROBADA/PARCIAL
    const estadosPermitidos = ['SNCA_ENVIADA', 'SNCA_EN_REVISION', 'SNCA_APROBADA', 'SNCA_PARCIAL'];
    if (!estadosPermitidos.includes(solicitud.estado)) {
      return NextResponse.json(
        { error: `No se puede registrar NCA para una solicitud en estado ${solicitud.estado}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      // Datos de la NCA
      numeroSerie,
      numeroComprobante,
      fecha,
      montoAprobado,
      // Respuesta del proveedor
      respuestaProveedor,
      estadoRespuesta, // 'APROBADA', 'PARCIAL', 'RECHAZADA'
      // Items aprobados (opcional)
      itemsAprobados
    } = body;

    if (!estadoRespuesta) {
      return NextResponse.json({ error: 'Debe indicar el estado de la respuesta del proveedor' }, { status: 400 });
    }

    // Determinar nuevo estado de la solicitud
    let nuevoEstado: string;
    switch (estadoRespuesta) {
      case 'APROBADA':
        nuevoEstado = numeroComprobante ? 'SNCA_NCA_RECIBIDA' : 'SNCA_APROBADA';
        break;
      case 'PARCIAL':
        nuevoEstado = numeroComprobante ? 'SNCA_NCA_RECIBIDA' : 'SNCA_PARCIAL';
        break;
      case 'RECHAZADA':
        nuevoEstado = 'SNCA_RECHAZADA';
        break;
      default:
        return NextResponse.json({ error: 'Estado de respuesta no válido' }, { status: 400 });
    }

    // Transacción para actualizar solicitud y crear NCA si corresponde
    const resultado = await prisma.$transaction(async (tx) => {
      // Actualizar solicitud
      const solicitudActualizada = await tx.creditNoteRequest.update({
        where: { id },
        data: {
          estado: nuevoEstado as any,
          montoAprobado: montoAprobado ? parseFloat(montoAprobado) : null,
          respuestaProveedor: respuestaProveedor || null,
          fechaRespuesta: new Date(),
        }
      });

      // Actualizar items si hay itemsAprobados
      if (itemsAprobados && Array.isArray(itemsAprobados)) {
        for (const itemAprobado of itemsAprobados) {
          await tx.creditNoteRequestItem.update({
            where: { id: itemAprobado.itemId },
            data: {
              cantidadAprobada: parseFloat(itemAprobado.cantidadAprobada)
            }
          });
        }
      }

      // Si se proporciona número de NCA, crear la nota de crédito
      let creditNote = null;
      if (numeroComprobante && (estadoRespuesta === 'APROBADA' || estadoRespuesta === 'PARCIAL')) {
        // Verificar que no exista ya una NCA con ese número
        const ncaExistente = await tx.creditDebitNote.findFirst({
          where: {
            companyId,
            numeroSerie: numeroSerie || '0000',
            numero: numeroComprobante
          }
        });

        if (ncaExistente) {
          throw new Error(`Ya existe una NCA con el número ${numeroSerie || '0000'}-${numeroComprobante}`);
        }

        // Crear la NCA
        const montoTotal = montoAprobado ? parseFloat(montoAprobado) : Number(solicitud.montoSolicitado);
        creditNote = await tx.creditDebitNote.create({
          data: {
            tipo: 'NOTA_CREDITO',
            numero: numeroComprobante,
            numeroSerie: numeroSerie || '0000',
            fechaEmision: fecha ? new Date(fecha) : new Date(),
            proveedorId: solicitud.proveedorId,
            neto: montoTotal,
            iva21: 0,
            total: montoTotal,
            estado: 'EMITIDA',
            motivo: `NCA por solicitud ${solicitud.numero}: ${solicitud.motivo}`,
            requestId: id,
            // IMPORTANTE: La NCA nunca mueve stock por sí sola
            // El tipo de NCA es solo para clasificación
            tipoNca: solicitud.tipo as any,
            docType: solicitud.docType,
            companyId,
            createdBy: user.id
          }
        });
      }

      return { solicitudActualizada, creditNote };
    });

    // Registrar auditoría
    await prisma.purchaseAuditLog.create({
      data: {
        entidad: 'credit_note_request',
        entidadId: id,
        accion: 'REGISTRAR_RESPUESTA_PROVEEDOR',
        datosAnteriores: { estado: solicitud.estado },
        datosNuevos: {
          estado: nuevoEstado,
          estadoRespuesta,
          montoAprobado,
          ncaCreada: resultado.creditNote?.id || null
        },
        companyId,
        userId: user.id
      }
    });

    return NextResponse.json({
      message: `Respuesta del proveedor registrada: ${estadoRespuesta}`,
      solicitud: resultado.solicitudActualizada,
      creditNote: resultado.creditNote
    });
  } catch (error: any) {
    console.error('Error registrando NCA:', error);
    return NextResponse.json(
      { error: error.message || 'Error al registrar la NCA' },
      { status: 500 }
    );
  }
}
