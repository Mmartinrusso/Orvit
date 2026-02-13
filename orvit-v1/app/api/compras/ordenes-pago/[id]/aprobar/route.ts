/**
 * API para aprobar/rechazar órdenes de pago que requieren doble aprobación
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { verificarSoDSimple } from '@/lib/compras/sod-rules';

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

/**
 * POST - Aprobar o rechazar orden de pago pendiente
 * Body: { accion: 'aprobar' | 'rechazar', motivo?: string }
 */
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

    // Verificar permisos - solo roles con permisos de aprobación
    if (!['SUPERADMIN', 'ADMIN', 'ADMIN_ENTERPRISE', 'SUPERVISOR'].includes(user.role)) {
      return NextResponse.json({ error: 'No tiene permisos para aprobar pagos' }, { status: 403 });
    }

    const { id } = await params;
    const ordenId = parseInt(id);
    const body = await request.json();
    const { accion, motivo } = body;

    if (!['aprobar', 'rechazar'].includes(accion)) {
      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    const orden = await prisma.paymentOrder.findFirst({
      where: { id: ordenId, companyId },
      include: {
        recibos: {
          include: {
            receipt: {
              select: { id: true, total: true, estado: true, numeroFactura: true, numeroSerie: true, tipo: true }
            }
          }
        },
        proveedor: { select: { id: true, name: true } },
      },
    });

    if (!orden) {
      return NextResponse.json({ error: 'Orden de pago no encontrada' }, { status: 404 });
    }

    if (orden.estado !== 'PENDIENTE_APROBACION') {
      return NextResponse.json(
        { error: `No se puede ${accion} una orden en estado ${orden.estado}` },
        { status: 400 }
      );
    }

    // ENFORCEMENT: SoD - El creador/primera aprobación no puede dar la segunda aprobación
    const sodCheck = verificarSoDSimple(orden.primeraAprobacionBy || orden.createdBy, user.id);
    if (!sodCheck.allowed) {
      return NextResponse.json(
        {
          error: 'No puede aprobar una orden de pago que usted mismo creó o aprobó inicialmente (SoD)',
          code: 'SOD_VIOLATION'
        },
        { status: 403 }
      );
    }

    if (accion === 'aprobar') {
      // Ejecutar el pago real dentro de una transacción
      await prisma.$transaction(async (tx) => {
        // ============================================
        // FIX RACE CONDITION: Calcular pagos previos ANTES de marcar como ejecutado
        // Excluimos la orden actual del aggregate para evitar contarla dos veces
        // ============================================
        const pagosPreviosPorFactura = new Map<number, number>();

        for (const recibo of orden.recibos) {
          const pagosPrevios = await tx.paymentOrderReceipt.aggregate({
            where: {
              receiptId: recibo.receiptId,
              paymentOrderId: { not: ordenId }, // Excluir orden actual
              paymentOrder: {
                estado: 'EJECUTADO',
              }
            },
            _sum: { montoAplicado: true },
          });
          pagosPreviosPorFactura.set(
            recibo.receiptId,
            Number(pagosPrevios._sum?.montoAplicado || 0)
          );
        }

        // AHORA marcar la orden como EJECUTADO
        await tx.paymentOrder.update({
          where: { id: ordenId },
          data: {
            estado: 'EJECUTADO',
            segundaAprobacionBy: user.id,
            segundaAprobacionAt: new Date(),
          },
        });

        // Aplicar pagos a las facturas usando los valores pre-calculados
        for (const recibo of orden.recibos) {
          const receiptId = recibo.receiptId;
          const montoAplicado = Number(recibo.montoAplicado || 0);
          const pagadoPrevio = pagosPreviosPorFactura.get(receiptId) || 0;

          // Total pagado = previos + este pago
          const pagado = pagadoPrevio + montoAplicado;
          const total = Number(recibo.receipt.total || 0);

          let nuevoEstado = 'pendiente';
          if (pagado >= total && total > 0) {
            nuevoEstado = 'pagada';
          } else if (pagado > 0 && pagado < total) {
            nuevoEstado = 'parcial';
          }

          await tx.purchaseReceipt.update({
            where: { id: receiptId },
            data: { estado: nuevoEstado },
          });

          console.log(`[APROBAR PAGO] Factura ${receiptId}: ${nuevoEstado} (previo: $${pagadoPrevio}, aplicado: $${montoAplicado}, total pagado: $${pagado}, total factura: $${total})`);
        }

        // Registrar en auditoría
        await tx.purchaseAuditLog.create({
          data: {
            entidad: 'payment_order',
            entidadId: ordenId,
            accion: 'APROBAR_PAGO',
            datosAnteriores: { estado: 'PENDIENTE_APROBACION' },
            datosNuevos: {
              estado: 'EJECUTADO',
              segundaAprobacionBy: user.id,
              facturasPagadas: orden.recibos.length,
            },
            companyId,
            userId: user.id,
          },
        });
      });

      console.log(`[APROBAR PAGO] ✅ Orden ${ordenId} aprobada por ${user.name}`);

      // Obtener orden actualizada
      const ordenActualizada = await prisma.paymentOrder.findUnique({
        where: { id: ordenId },
        include: {
          proveedor: { select: { id: true, name: true, razon_social: true } },
          recibos: {
            include: {
              receipt: { select: { id: true, numeroFactura: true, numeroSerie: true, total: true, estado: true } }
            }
          },
          createdByUser: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Orden de pago aprobada y ejecutada',
        orden: ordenActualizada,
      });

    } else {
      // Rechazar
      if (!motivo) {
        return NextResponse.json(
          { error: 'Debe proporcionar un motivo de rechazo' },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        // Marcar orden como rechazada
        await tx.paymentOrder.update({
          where: { id: ordenId },
          data: {
            estado: 'RECHAZADO',
            motivoRechazo: motivo,
            segundaAprobacionBy: user.id,
            segundaAprobacionAt: new Date(),
          },
        });

        // ============================================
        // SOFT DELETE: NO eliminamos los recibos para mantener audit trail
        // Los recibos quedan vinculados a la orden RECHAZADA
        // Las queries de totales deben filtrar por paymentOrder.estado = 'EJECUTADO'
        // ============================================

        // Registrar en auditoría CON detalle de facturas que estaban vinculadas
        await tx.purchaseAuditLog.create({
          data: {
            entidad: 'payment_order',
            entidadId: ordenId,
            accion: 'RECHAZAR_PAGO',
            datosAnteriores: {
              estado: 'PENDIENTE_APROBACION',
              facturasVinculadas: orden.recibos.map(r => ({
                receiptId: r.receiptId,
                montoAplicado: Number(r.montoAplicado),
                numeroFactura: r.receipt.numeroFactura,
              })),
            },
            datosNuevos: {
              estado: 'RECHAZADO',
              motivoRechazo: motivo,
              rechazadoPor: user.name,
            },
            companyId,
            userId: user.id,
          },
        });
      });

      console.log(`[APROBAR PAGO] ❌ Orden ${ordenId} rechazada: ${motivo}`);

      return NextResponse.json({
        success: true,
        message: 'Orden de pago rechazada',
        ordenId,
      });
    }
  } catch (error) {
    console.error('Error procesando aprobación de pago:', error);
    return NextResponse.json(
      { error: 'Error al procesar la aprobación' },
      { status: 500 }
    );
  }
}

/**
 * GET - Obtener órdenes de pago pendientes de aprobación
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const ordenesPendientes = await prisma.paymentOrder.findMany({
      where: {
        companyId,
        estado: 'PENDIENTE_APROBACION',
      },
      include: {
        proveedor: { select: { id: true, name: true, razon_social: true, cuit: true } },
        recibos: {
          include: {
            receipt: { select: { id: true, numeroFactura: true, numeroSerie: true, total: true, tipo: true } }
          }
        },
        createdByUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(ordenesPendientes);
  } catch (error) {
    console.error('Error fetching pending payment orders:', error);
    return NextResponse.json(
      { error: 'Error al obtener órdenes pendientes' },
      { status: 500 }
    );
  }
}
