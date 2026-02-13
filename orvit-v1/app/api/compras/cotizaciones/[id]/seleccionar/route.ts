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

// POST - Seleccionar cotizacion (version simplificada)
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

    const { id } = await params;
    const cotizacionId = parseInt(id);

    // Usar select para evitar columnas que no existen en la BD
    const cotizacion = await prisma.purchaseQuotation.findFirst({
      where: { id: cotizacionId, companyId },
      select: {
        id: true,
        numero: true,
        requestId: true,
        supplierId: true,
        estado: true,
        total: true,
        esSeleccionada: true,
        request: {
          select: {
            id: true,
            estado: true,
            numero: true
          }
        },
        supplier: { select: { id: true, name: true } }
      }
    });

    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotizacion no encontrada' }, { status: 404 });
    }

    // Solo se pueden seleccionar cotizaciones en estados validos
    if (!['RECIBIDA', 'EN_REVISION', 'SELECCIONADA'].includes(cotizacion.estado)) {
      return NextResponse.json(
        { error: 'Solo se pueden seleccionar cotizaciones en estado recibida, en revision o seleccionada' },
        { status: 400 }
      );
    }

    // Verificar que el pedido esta en estado valido para seleccion
    if (!['ENVIADA', 'EN_COTIZACION', 'COTIZADA', 'EN_APROBACION'].includes(cotizacion.request.estado)) {
      return NextResponse.json(
        { error: 'El pedido no esta en estado valido para seleccion de cotizacion' },
        { status: 400 }
      );
    }

    // Ejecutar en transaccion
    const result = await prisma.$transaction(async (tx) => {
      // 1. Buscar si hay otra cotizacion seleccionada
      const otraSeleccionada = await tx.purchaseQuotation.findFirst({
        where: {
          requestId: cotizacion.requestId,
          estado: 'SELECCIONADA',
          id: { not: cotizacionId }
        },
        select: { id: true }
      });

      // 2. Si hay otra seleccionada, deseleccionarla usando SQL directo
      if (otraSeleccionada) {
        await tx.$executeRawUnsafe(
          `UPDATE purchase_quotations SET estado = 'EN_REVISION', "esSeleccionada" = false, "seleccionadaPor" = NULL, "seleccionadaAt" = NULL, "updatedAt" = NOW() WHERE id = $1`,
          otraSeleccionada.id
        );
      }

      // 3. Deseleccionar otras cotizaciones activas usando SQL directo
      await tx.$executeRawUnsafe(
        `UPDATE purchase_quotations SET "esSeleccionada" = false, "updatedAt" = NOW() WHERE "requestId" = $1 AND id != $2 AND estado IN ('RECIBIDA', 'EN_REVISION')`,
        cotizacion.requestId,
        cotizacionId
      );

      // 4. Seleccionar esta cotizacion usando SQL directo
      await tx.$executeRawUnsafe(
        `UPDATE purchase_quotations SET estado = 'SELECCIONADA', "esSeleccionada" = true, "seleccionadaPor" = $1, "seleccionadaAt" = NOW(), "updatedAt" = NOW() WHERE id = $2`,
        user.id,
        cotizacionId
      );

      // 5. Actualizar estado del pedido a EN_APROBACION usando SQL directo
      await tx.$executeRawUnsafe(
        `UPDATE purchase_requests SET estado = 'EN_APROBACION', "updatedAt" = NOW() WHERE id = $1`,
        cotizacion.requestId
      );

      // Obtener la cotizacion actualizada
      const cotizacionSeleccionada = await tx.purchaseQuotation.findUnique({
        where: { id: cotizacionId },
        select: {
          id: true,
          numero: true,
          estado: true,
          total: true,
          esSeleccionada: true,
          supplier: { select: { id: true, name: true } }
        }
      });

      return cotizacionSeleccionada;
    });

    // 6. Crear comentario de sistema (fuera de transaccion - no critico)
    try {
      await prisma.purchaseComment.create({
        data: {
          entidad: 'request',
          entidadId: cotizacion.requestId,
          tipo: 'SISTEMA',
          contenido: `Cotizacion ${cotizacion.numero} de ${cotizacion.supplier.name} seleccionada por ${user.name}`,
          companyId,
          userId: user.id
        }
      });
    } catch (commentError) {
      console.warn('No se pudo crear comentario de sistema:', commentError);
    }

    return NextResponse.json({
      success: true,
      cotizacion: result,
      message: 'Cotizacion seleccionada. El pedido esta pendiente de aprobacion.'
    });
  } catch (error: any) {
    console.error('='.repeat(60));
    console.error('[cotizaciones/seleccionar] ERROR DETALLADO:');
    console.error('Error:', error);
    console.error('Message:', error?.message);
    console.error('Code:', error?.code);
    console.error('='.repeat(60));

    // Detectar violacion de indice unico (race condition)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya hay otra cotizacion seleccionada para este pedido. Por favor, reintente.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Error al seleccionar la cotizacion' },
      { status: 500 }
    );
  }
}
