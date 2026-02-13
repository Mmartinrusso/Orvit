import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';
import { PaymentRequestStatus, Priority } from '@prisma/client';
import { invalidateSolicitudesCache } from '../route';
import { logStatusChange, logDeletion } from '@/lib/compras/audit-helper';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload as { id: number; email: string; name: string };
  } catch (error) {
    return null;
  }
}

// Estados que permiten edición
const ESTADOS_EDITABLES: PaymentRequestStatus[] = ['BORRADOR', 'SOLICITADA', 'RECHAZADA'];

// Estados que permiten eliminación
const ESTADOS_ELIMINABLES: PaymentRequestStatus[] = ['BORRADOR', 'SOLICITADA'];

// Mapeo de prioridades frontend -> backend
const mapPrioridad = (prioridad: string): Priority => {
  const map: Record<string, Priority> = {
    'baja': 'LOW',
    'media': 'MEDIUM',
    'alta': 'HIGH',
    'urgente': 'URGENT',
    'LOW': 'LOW',
    'MEDIUM': 'MEDIUM',
    'HIGH': 'HIGH',
    'URGENT': 'URGENT'
  };
  return map[prioridad] || 'MEDIUM';
};

// Mapeo de prioridades backend -> frontend
const mapPrioridadToFrontend = (prioridad: Priority): string => {
  const map: Record<Priority, string> = {
    'LOW': 'baja',
    'MEDIUM': 'media',
    'HIGH': 'alta',
    'URGENT': 'urgente'
  };
  return map[prioridad] || 'media';
};

// Mapeo de estados backend -> frontend
const mapEstadoToFrontend = (estado: PaymentRequestStatus): string => {
  const map: Record<PaymentRequestStatus, string> = {
    'BORRADOR': 'borrador',
    'SOLICITADA': 'pendiente',
    'EN_REVISION': 'en_revision',
    'APROBADA': 'aprobada',
    'RECHAZADA': 'rechazada',
    'CONVERTIDA': 'convertida',
    'PAGADA': 'pagada',
    'CANCELADA': 'cancelada'
  };
  return map[estado] || 'pendiente';
};

// GET /api/compras/solicitudes/[id] - Obtener detalle de solicitud
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const solicitudId = parseInt(id);

    if (isNaN(solicitudId)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }

    const paymentRequest = await prisma.paymentRequest.findUnique({
      where: { id: solicitudId },
      include: {
        proveedor: {
          select: {
            id: true,
            name: true,
            razon_social: true,
            cuit: true,
            email: true,
            phone: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        aprobadoByUser: {
          select: {
            id: true,
            name: true
          }
        },
        rechazadoByUser: {
          select: {
            id: true,
            name: true
          }
        },
        facturas: {
          include: {
            receipt: {
              select: {
                id: true,
                numeroSerie: true,
                numeroFactura: true,
                tipo: true,
                total: true,
                estado: true,
                fechaEmision: true,
                fechaVencimiento: true,
                items: {
                  select: {
                    id: true,
                    descripcion: true,
                    cantidad: true,
                    unidad: true,
                    precioUnitario: true,
                    subtotal: true
                  }
                }
              }
            }
          }
        },
        // logs relation - comentado hasta que se ejecute la migración
        // logs: {
        //   orderBy: { createdAt: 'desc' },
        //   take: 20,
        //   include: {
        //     user: {
        //       select: {
        //         id: true,
        //         name: true
        //       }
        //     }
        //   }
        // }
      }
    });

    if (!paymentRequest) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    // Calcular flag disponibleParaPagar
    const disponibleParaPagar =
      ['SOLICITADA', 'EN_REVISION', 'APROBADA'].includes(paymentRequest.estado);

    // Calcular si puede ser editada/eliminada
    const puedeEditar = ESTADOS_EDITABLES.includes(paymentRequest.estado);
    const puedeEliminar = ESTADOS_ELIMINABLES.includes(paymentRequest.estado);

    const response = {
      success: true,
      solicitud: {
        id: paymentRequest.id,
        numero: paymentRequest.numero,
        estado: mapEstadoToFrontend(paymentRequest.estado),
        estadoRaw: paymentRequest.estado,
        prioridad: mapPrioridadToFrontend(paymentRequest.prioridad),
        prioridadRaw: paymentRequest.prioridad,
        esUrgente: paymentRequest.esUrgente,
        fechaSolicitud: paymentRequest.fechaSolicitud.toISOString(),
        fechaObjetivo: paymentRequest.fechaObjetivo?.toISOString() || null,
        fechaAprobacion: paymentRequest.fechaAprobacion?.toISOString() || null,
        fechaPago: paymentRequest.fechaPago?.toISOString() || null,
        montoTotal: Number(paymentRequest.montoTotal),
        motivo: paymentRequest.motivo,
        comentarios: paymentRequest.comentarios,
        motivoRechazo: paymentRequest.motivoRechazo,
        proveedor: {
          id: paymentRequest.proveedor.id,
          nombre: paymentRequest.proveedor.name,
          razonSocial: paymentRequest.proveedor.razon_social,
          cuit: paymentRequest.proveedor.cuit,
          email: paymentRequest.proveedor.email,
          telefono: paymentRequest.proveedor.phone
        },
        solicitante: {
          id: paymentRequest.createdByUser.id,
          nombre: paymentRequest.createdByUser.name,
          email: paymentRequest.createdByUser.email
        },
        aprobadoPor: paymentRequest.aprobadoByUser ? {
          id: paymentRequest.aprobadoByUser.id,
          nombre: paymentRequest.aprobadoByUser.name
        } : null,
        rechazadoPor: paymentRequest.rechazadoByUser ? {
          id: paymentRequest.rechazadoByUser.id,
          nombre: paymentRequest.rechazadoByUser.name
        } : null,
        comprobantes: paymentRequest.facturas.map(f => ({
          id: f.id,
          receiptId: f.receiptId,
          montoSolicitado: Number(f.montoSolicitado),
          receipt: f.receipt ? {
            id: f.receipt.id,
            tipo: f.receipt.tipo,
            numeroSerie: f.receipt.numeroSerie,
            numeroFactura: f.receipt.numeroFactura,
            total: Number(f.receipt.total),
            estado: f.receipt.estado,
            fechaEmision: f.receipt.fechaEmision?.toISOString() || null,
            fechaVencimiento: f.receipt.fechaVencimiento?.toISOString() || null,
            items: f.receipt.items?.map(item => ({
              id: item.id,
              descripcion: item.descripcion,
              cantidad: Number(item.cantidad),
              unidad: item.unidad,
              precioUnitario: Number(item.precioUnitario),
              subtotal: Number(item.subtotal)
            })) || []
          } : null
        })),
        // Historial - comentado hasta que se ejecute la migración
        historial: [], // paymentRequest.logs?.map(log => ({...})) || [],
        createdAt: paymentRequest.createdAt.toISOString(),
        updatedAt: paymentRequest.updatedAt.toISOString(),
        // Flags de permisos
        disponibleParaPagar,
        puedeEditar,
        puedeEliminar
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error en GET /api/compras/solicitudes/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/compras/solicitudes/[id] - Actualizar solicitud
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const solicitudId = parseInt(id);

    if (isNaN(solicitudId)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      prioridad,
      observaciones,
      fechaObjetivo,
      comprobantes // Array de { id: receiptId, total: monto }
    } = body;

    // Usar transacción para garantizar consistencia
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verificar que la solicitud existe y puede ser editada
      const current = await tx.paymentRequest.findUnique({
        where: { id: solicitudId },
        include: {
          facturas: true
        }
      });

      if (!current) {
        throw new Error('Solicitud no encontrada');
      }

      if (!ESTADOS_EDITABLES.includes(current.estado)) {
        throw new Error(`No se puede editar una solicitud en estado ${current.estado}`);
      }

      // 2. Verificar permisos (solo creador o admin)
      // TODO: implementar verificación de rol admin
      if (current.createdBy !== user.id) {
        throw new Error('No tiene permisos para editar esta solicitud');
      }

      // 3. Si hay nuevos comprobantes, validar duplicados
      let nuevosComprobantes = comprobantes;
      let nuevoMontoTotal = Number(current.montoTotal);

      if (comprobantes && comprobantes.length > 0) {
        const receiptIds = comprobantes.map((c: any) => parseInt(c.id));

        // Validar que no estén en otra solicitud activa (excluyendo la actual)
        const duplicados = await tx.paymentRequestReceipt.findMany({
          where: {
            receiptId: { in: receiptIds },
            paymentRequest: {
              id: { not: solicitudId },
              estado: { notIn: ['RECHAZADA', 'CANCELADA', 'PAGADA'] }
            }
          },
          include: {
            paymentRequest: {
              select: { numero: true }
            }
          }
        });

        if (duplicados.length > 0) {
          const numeros = [...new Set(duplicados.map(d => d.paymentRequest.numero))];
          throw new Error(`Comprobante(s) ya incluido(s) en solicitud(es): ${numeros.join(', ')}`);
        }

        // Eliminar comprobantes actuales
        await tx.paymentRequestReceipt.deleteMany({
          where: { paymentRequestId: solicitudId }
        });

        // Recalcular total
        nuevoMontoTotal = comprobantes.reduce((sum: number, c: any) => {
          return sum + (parseFloat(c.total) || 0);
        }, 0);

        // Crear nuevos comprobantes
        await tx.paymentRequestReceipt.createMany({
          data: comprobantes.map((c: any) => ({
            paymentRequestId: solicitudId,
            receiptId: parseInt(c.id),
            montoSolicitado: parseFloat(c.total) || 0
          }))
        });
      }

      // 4. Preparar datos de actualización
      const updateData: any = {
        motivo: observaciones !== undefined ? observaciones : current.motivo,
        montoTotal: nuevoMontoTotal
      };

      if (prioridad) {
        updateData.prioridad = mapPrioridad(prioridad);
        updateData.esUrgente = prioridad === 'urgente' || prioridad === 'URGENT';
      }

      if (fechaObjetivo !== undefined) {
        updateData.fechaObjetivo = fechaObjetivo ? new Date(fechaObjetivo) : null;
      }

      // 5. Actualizar solicitud
      const updated = await tx.paymentRequest.update({
        where: { id: solicitudId },
        data: updateData,
        include: {
          proveedor: {
            select: { name: true, razon_social: true }
          },
          facturas: true
        }
      });

      // 6. Registrar en auditoría
      const cambios: string[] = [];
      if (prioridad && mapPrioridad(prioridad) !== current.prioridad) {
        cambios.push('prioridad');
      }
      if (observaciones !== undefined && observaciones !== current.motivo) {
        cambios.push('observaciones');
      }
      if (comprobantes && comprobantes.length > 0) {
        cambios.push('comprobantes');
      }
      if (fechaObjetivo !== undefined) {
        cambios.push('fechaObjetivo');
      }

      // Auditoría - comentado hasta que se ejecute la migración
      // await tx.paymentRequestLog.create({
      //   data: {
      //     paymentRequestId: solicitudId,
      //     accion: 'EDITADA',
      //     estadoAnterior: current.estado,
      //     estadoNuevo: updated.estado,
      //     prioridadAnterior: current.prioridad,
      //     prioridadNueva: updated.prioridad,
      //     userId: user.id,
      //     detalles: {
      //       camposModificados: cambios,
      //       montoAnterior: Number(current.montoTotal),
      //       montoNuevo: nuevoMontoTotal
      //     }
      //   }
      // });

      return updated;
    });

    // Invalidar caché
    invalidateSolicitudesCache(result.companyId);

    return NextResponse.json({
      success: true,
      solicitud: {
        id: result.id,
        numero: result.numero,
        estado: mapEstadoToFrontend(result.estado),
        prioridad: mapPrioridadToFrontend(result.prioridad),
        monto: Number(result.montoTotal),
        items: result.facturas.length
      },
      message: 'Solicitud actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error en PUT /api/compras/solicitudes/[id]:', error);

    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    const isValidationError = message.includes('Comprobante') ||
                              message.includes('permisos') ||
                              message.includes('estado') ||
                              message.includes('encontrada');

    return NextResponse.json(
      { error: message, success: false },
      { status: isValidationError ? 400 : 500 }
    );
  }
}

// DELETE /api/compras/solicitudes/[id] - Eliminar solicitud
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const solicitudId = parseInt(id);

    if (isNaN(solicitudId)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }

    // Usar transacción para garantizar consistencia
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verificar que la solicitud existe y puede ser eliminada
      const current = await tx.paymentRequest.findUnique({
        where: { id: solicitudId },
        select: {
          id: true,
          numero: true,
          estado: true,
          companyId: true,
          createdBy: true,
          montoTotal: true
        }
      });

      if (!current) {
        throw new Error('Solicitud no encontrada');
      }

      if (!ESTADOS_ELIMINABLES.includes(current.estado)) {
        throw new Error(`No se puede eliminar una solicitud en estado ${current.estado}`);
      }

      // 2. Verificar permisos (solo creador o admin)
      // TODO: implementar verificación de rol admin
      if (current.createdBy !== user.id) {
        throw new Error('No tiene permisos para eliminar esta solicitud');
      }

      // 3. Registrar en auditoría antes de eliminar - comentado hasta que se ejecute la migración
      // await tx.paymentRequestLog.create({
      //   data: {
      //     paymentRequestId: solicitudId,
      //     accion: 'ELIMINADA',
      //     estadoAnterior: current.estado,
      //     userId: user.id,
      //     detalles: {
      //       numero: current.numero,
      //       montoTotal: Number(current.montoTotal)
      //     }
      //   }
      // });

      // 4. Eliminar comprobantes relacionados (cascade debería hacerlo, pero por seguridad)
      await tx.paymentRequestReceipt.deleteMany({
        where: { paymentRequestId: solicitudId }
      });

      // 5. Eliminar la solicitud
      await tx.paymentRequest.delete({
        where: { id: solicitudId }
      });

      return current;
    });

    // Invalidar caché
    invalidateSolicitudesCache(result.companyId);

    // Registrar auditoría
    await logDeletion({
      entidad: 'payment_request',
      entidadId: solicitudId,
      companyId: result.companyId,
      userId: user.id as number,
      estadoAnterior: result.estado,
    });

    return NextResponse.json({
      success: true,
      message: `Solicitud ${result.numero} eliminada exitosamente`
    });
  } catch (error) {
    console.error('Error en DELETE /api/compras/solicitudes/[id]:', error);

    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    const isValidationError = message.includes('permisos') ||
                              message.includes('estado') ||
                              message.includes('encontrada');

    return NextResponse.json(
      { error: message, success: false },
      { status: isValidationError ? 400 : 500 }
    );
  }
}
