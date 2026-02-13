import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import * as cache from '@/app/api/compras/comprobantes/cache';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener usuario desde JWT
async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    
    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true
          }
        }
      }
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// PATCH /api/compras/comprobantes/[id]/urgente - Marcar/desmarcar factura como urgente
export async function PATCH(
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

    const comprobanteId = parseInt(params.id);
    if (isNaN(comprobanteId)) {
      return NextResponse.json({ error: 'ID de comprobante inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { pagoUrgente } = body;

    if (typeof pagoUrgente !== 'boolean') {
      return NextResponse.json({ error: 'pagoUrgente debe ser un booleano' }, { status: 400 });
    }

    // Verificar que el comprobante pertenece a la empresa del usuario
    const comprobante = await prisma.purchaseReceipt.findFirst({
      where: {
        id: comprobanteId,
        companyId: companyId,
      },
    });

    if (!comprobante) {
      return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 });
    }

    // Actualizar el estado de pago urgente
    const updated = await prisma.purchaseReceipt.update({
      where: { id: comprobanteId },
      data: { pagoUrgente },
      select: {
        id: true,
        pagoUrgente: true,
        proveedorId: true,
        proveedor: {
          select: {
            id: true,
            name: true,
            razon_social: true,
            cuit: true,
          }
        },
      },
    });

    // Invalidar caché después de actualizar pago urgente
    cache.invalidateCache(companyId);

    return NextResponse.json({
      success: true,
      comprobante: updated,
      message: pagoUrgente 
        ? 'Factura marcada como pago urgente' 
        : 'Factura desmarcada como pago urgente'
    });
  } catch (error) {
    console.error('Error actualizando pago urgente:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

