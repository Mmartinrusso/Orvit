import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
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

// POST - Regularizar recepción de emergencia
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
    const { purchaseOrderId, numeroRemito, notas } = body;

    // Obtener recepción
    const recepcion = await prisma.goodsReceipt.findFirst({
      where: { id, companyId }
    });

    if (!recepcion) {
      return NextResponse.json({ error: 'Recepción no encontrada' }, { status: 404 });
    }

    if (!recepcion.requiereRegularizacion) {
      return NextResponse.json(
        { error: 'Esta recepción no requiere regularización' },
        { status: 400 }
      );
    }

    if (recepcion.regularizada) {
      return NextResponse.json(
        { error: 'Esta recepción ya fue regularizada' },
        { status: 400 }
      );
    }

    // Validaciones
    if (!purchaseOrderId) {
      return NextResponse.json(
        { error: 'Debe vincular una orden de compra para regularizar' },
        { status: 400 }
      );
    }

    // Verificar que la OC existe y está en estado válido
    const ordenCompra = await prisma.purchaseOrder.findFirst({
      where: {
        id: parseInt(purchaseOrderId),
        companyId,
        proveedorId: recepcion.proveedorId
      }
    });

    if (!ordenCompra) {
      return NextResponse.json(
        { error: 'Orden de compra no encontrada o no corresponde al proveedor' },
        { status: 400 }
      );
    }

    // Actualizar recepción
    const recepcionActualizada = await prisma.goodsReceipt.update({
      where: { id },
      data: {
        purchaseOrderId: parseInt(purchaseOrderId),
        regularizada: true,
        regularizadaAt: new Date(),
        ...(numeroRemito && { numeroRemito }),
        ...(notas && { notas: `${recepcion.notas || ''}\n[REGULARIZACIÓN] ${notas}`.trim() }),
      },
      include: {
        proveedor: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, numero: true, estado: true } },
        warehouse: { select: { id: true, codigo: true, nombre: true } }
      }
    });

    // Registrar en auditoría
    await prisma.purchaseAuditLog.create({
      data: {
        entidad: 'goods_receipt',
        entidadId: id,
        accion: 'REGULARIZAR',
        datosAnteriores: {
          regularizada: false,
          purchaseOrderId: recepcion.purchaseOrderId
        },
        datosNuevos: {
          regularizada: true,
          purchaseOrderId: parseInt(purchaseOrderId),
          regularizadaAt: new Date()
        },
        companyId,
        userId: user.id,
      }
    });

    return NextResponse.json({
      message: 'Recepción regularizada correctamente',
      recepcion: recepcionActualizada
    });
  } catch (error) {
    console.error('Error regularizando recepcion:', error);
    return NextResponse.json(
      { error: 'Error al regularizar la recepción' },
      { status: 500 }
    );
  }
}
