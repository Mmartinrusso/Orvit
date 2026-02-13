import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: { company: true },
        },
      },
    });

    return user;
  } catch (error) {
    console.error('[OP ATTACHMENTS] Error obteniendo usuario:', error);
    return null;
  }
}

// POST /api/compras/ordenes-pago/[id]/attachments
// Guarda los attachments de comprobantes de pago
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
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

    const paymentOrderId = Number(params.id);
    if (!paymentOrderId || Number.isNaN(paymentOrderId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que la orden de pago existe y pertenece a la empresa
    const paymentOrder = await prisma.paymentOrder.findFirst({
      where: { id: paymentOrderId, companyId },
    });

    if (!paymentOrder) {
      return NextResponse.json({ error: 'Orden de pago no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const { attachments } = body as {
      attachments: Array<{ fileName: string; fileUrl: string; fileType?: string; fileSize?: number; description?: string }>;
    };

    if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
      return NextResponse.json({ error: 'No se proporcionaron attachments' }, { status: 400 });
    }

    // Crear los attachments
    const createdAttachments = await prisma.paymentOrderAttachment.createMany({
      data: attachments.map(att => ({
        paymentOrderId,
        fileName: att.fileName,
        fileUrl: att.fileUrl,
        fileType: att.fileType || 'application/octet-stream',
        fileSize: att.fileSize || null,
        description: att.description || 'Comprobante de pago',
      })),
    });

    return NextResponse.json({
      ok: true,
      count: createdAttachments.count,
    });
  } catch (error) {
    console.error('[OP ATTACHMENTS] Error en POST:', error);
    return NextResponse.json({ error: 'Error al guardar comprobantes' }, { status: 500 });
  }
}

// GET /api/compras/ordenes-pago/[id]/attachments
// Obtiene los attachments de una orden de pago
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
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

    const paymentOrderId = Number(params.id);
    if (!paymentOrderId || Number.isNaN(paymentOrderId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que la orden de pago existe y pertenece a la empresa
    const paymentOrder = await prisma.paymentOrder.findFirst({
      where: { id: paymentOrderId, companyId },
    });

    if (!paymentOrder) {
      return NextResponse.json({ error: 'Orden de pago no encontrada' }, { status: 404 });
    }

    const attachments = await prisma.paymentOrderAttachment.findMany({
      where: { paymentOrderId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(attachments);
  } catch (error) {
    console.error('[OP ATTACHMENTS] Error en GET:', error);
    return NextResponse.json({ error: 'Error al obtener comprobantes' }, { status: 500 });
  }
}

// DELETE /api/compras/ordenes-pago/[id]/attachments?attachmentId=X
// Elimina un attachment específico
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
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

    const paymentOrderId = Number(params.id);
    if (!paymentOrderId || Number.isNaN(paymentOrderId)) {
      return NextResponse.json({ error: 'ID de orden inválido' }, { status: 400 });
    }

    const attachmentId = Number(request.nextUrl.searchParams.get('attachmentId'));
    if (!attachmentId || Number.isNaN(attachmentId)) {
      return NextResponse.json({ error: 'ID de attachment requerido' }, { status: 400 });
    }

    // Verificar que la orden de pago existe y pertenece a la empresa
    const paymentOrder = await prisma.paymentOrder.findFirst({
      where: { id: paymentOrderId, companyId },
    });

    if (!paymentOrder) {
      return NextResponse.json({ error: 'Orden de pago no encontrada' }, { status: 404 });
    }

    // Verificar que el attachment existe y pertenece a esta orden
    const attachment = await prisma.paymentOrderAttachment.findFirst({
      where: { id: attachmentId, paymentOrderId },
    });

    if (!attachment) {
      return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 });
    }

    // Eliminar el attachment
    await prisma.paymentOrderAttachment.delete({
      where: { id: attachmentId },
    });

    return NextResponse.json({ ok: true, deleted: attachmentId });
  } catch (error) {
    console.error('[OP ATTACHMENTS] Error en DELETE:', error);
    return NextResponse.json({ error: 'Error al eliminar comprobante' }, { status: 500 });
  }
}
