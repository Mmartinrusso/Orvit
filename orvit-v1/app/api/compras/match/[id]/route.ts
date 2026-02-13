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

// GET - Obtener detalle de un resultado de match
export async function GET(
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

    const matchResult = await prisma.matchResult.findFirst({
      where: { id, companyId },
      include: {
        purchaseOrder: {
          include: {
            proveedor: { select: { id: true, name: true } },
            items: {
              include: {
                supplierItem: { select: { id: true, nombre: true, unidad: true } }
              }
            }
          }
        },
        goodsReceipt: {
          include: {
            warehouse: { select: { id: true, codigo: true, nombre: true } },
            items: {
              include: {
                supplierItem: { select: { id: true, nombre: true, unidad: true } }
              }
            }
          }
        },
        factura: {
          include: {
            proveedor: { select: { id: true, name: true, cuit: true } },
            items: {
              include: {
                supplierItem: { select: { id: true, nombre: true, unidad: true } }
              }
            }
          }
        },
        lineResults: {
          orderBy: { id: 'asc' }
        },
        exceptions: {
          orderBy: { id: 'asc' }
        },
        resueltoByUser: { select: { id: true, name: true } }
      }
    });

    if (!matchResult) {
      return NextResponse.json({ error: 'Resultado de match no encontrado' }, { status: 404 });
    }

    return NextResponse.json(matchResult);
  } catch (error) {
    console.error('Error fetching match result:', error);
    return NextResponse.json(
      { error: 'Error al obtener el resultado de match' },
      { status: 500 }
    );
  }
}

// PUT - Resolver discrepancia / actualizar match
export async function PUT(
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

    const matchResult = await prisma.matchResult.findFirst({
      where: { id, companyId }
    });

    if (!matchResult) {
      return NextResponse.json({ error: 'Resultado de match no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const { accion, notas, excepciones } = body;

    // Acciones posibles:
    // - 'aprobar': Aprobar a pesar de discrepancias (dentro de tolerancia)
    // - 'rechazar': Rechazar y bloquear pago
    // - 'vincular_oc': Vincular una OC específica
    // - 'vincular_recepcion': Vincular una recepción específica
    // - 'resolver_excepcion': Marcar excepciones como resueltas

    let updateData: any = {
      notas: notas || matchResult.notas
    };

    switch (accion) {
      case 'aprobar':
        // Aprobar discrepancias menores
        updateData.estado = 'RESUELTO';
        updateData.resuelto = true;
        updateData.resueltoPor = user.id;
        updateData.resueltoAt = new Date();
        updateData.accionTomada = 'APROBADO_CON_DISCREPANCIAS';

        // Marcar todas las excepciones como resueltas
        await prisma.matchException.updateMany({
          where: { matchResultId: id },
          data: {
            resuelto: true,
            resueltoPor: user.id,
            resueltoAt: new Date(),
            accion: 'APROBADO'
          }
        });
        break;

      case 'rechazar':
        updateData.estado = 'BLOQUEADO';
        updateData.accionTomada = 'RECHAZADO';
        break;

      case 'vincular_oc':
        const { purchaseOrderId } = body;
        if (!purchaseOrderId) {
          return NextResponse.json({ error: 'purchaseOrderId es requerido' }, { status: 400 });
        }

        // Verificar que la OC existe y pertenece a la empresa
        const oc = await prisma.purchaseOrder.findFirst({
          where: { id: parseInt(purchaseOrderId), companyId }
        });

        if (!oc) {
          return NextResponse.json({ error: 'Orden de compra no encontrada' }, { status: 404 });
        }

        updateData.purchaseOrderId = parseInt(purchaseOrderId);
        updateData.accionTomada = 'OC_VINCULADA_MANUALMENTE';
        break;

      case 'vincular_recepcion':
        const { goodsReceiptId } = body;
        if (!goodsReceiptId) {
          return NextResponse.json({ error: 'goodsReceiptId es requerido' }, { status: 400 });
        }

        // Verificar que la recepción existe
        const recepcion = await prisma.goodsReceipt.findFirst({
          where: { id: parseInt(goodsReceiptId), companyId }
        });

        if (!recepcion) {
          return NextResponse.json({ error: 'Recepción no encontrada' }, { status: 404 });
        }

        updateData.goodsReceiptId = parseInt(goodsReceiptId);
        updateData.accionTomada = 'RECEPCION_VINCULADA_MANUALMENTE';

        // Vincular factura a recepción
        await prisma.goodsReceipt.update({
          where: { id: parseInt(goodsReceiptId) },
          data: {
            facturaId: matchResult.facturaId,
            tieneFactura: true
          }
        });
        break;

      case 'resolver_excepcion':
        // Resolver excepciones específicas
        if (excepciones && Array.isArray(excepciones)) {
          for (const excepcionId of excepciones) {
            await prisma.matchException.update({
              where: { id: parseInt(excepcionId) },
              data: {
                resuelto: true,
                resueltoPor: user.id,
                resueltoAt: new Date(),
                accion: notas || 'RESUELTO_MANUALMENTE'
              }
            });
          }
        }

        // Verificar si todas las excepciones están resueltas
        const excepcionesPendientes = await prisma.matchException.count({
          where: { matchResultId: id, resuelto: false }
        });

        if (excepcionesPendientes === 0) {
          updateData.estado = 'RESUELTO';
          updateData.resuelto = true;
          updateData.resueltoPor = user.id;
          updateData.resueltoAt = new Date();
        }
        break;

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    const matchActualizado = await prisma.matchResult.update({
      where: { id },
      data: updateData,
      include: {
        purchaseOrder: { select: { id: true, numero: true } },
        goodsReceipt: { select: { id: true, numero: true } },
        factura: { select: { id: true, numero_factura: true } },
        exceptions: true
      }
    });

    // Registrar en auditoría
    await prisma.purchaseAuditLog.create({
      data: {
        entidad: 'match_result',
        entidadId: id,
        accion: `RESOLVER_MATCH_${accion.toUpperCase()}`,
        datosAnteriores: { estado: matchResult.estado },
        datosNuevos: { estado: matchActualizado.estado, accion },
        companyId,
        userId: user.id
      }
    });

    return NextResponse.json({
      message: 'Match actualizado correctamente',
      matchResult: matchActualizado
    });
  } catch (error) {
    console.error('Error updating match result:', error);
    return NextResponse.json(
      { error: 'Error al actualizar el resultado de match' },
      { status: 500 }
    );
  }
}
