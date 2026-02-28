import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { logStateChange } from '@/lib/compras/audit-helper';
import { requirePermission } from '@/lib/auth/shared-helpers';

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

// POST - Rechazar ajuste pendiente
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Permission check: almacen.adjust
    const { error: permError } = await requirePermission('almacen.adjust');
    if (permError) return permError;

    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const ajusteId = parseInt(params.id);
    if (isNaN(ajusteId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { motivo } = body;

    const ajuste = await prisma.stockAdjustment.findFirst({
      where: { id: ajusteId, companyId }
    });

    if (!ajuste) {
      return NextResponse.json({ error: 'Ajuste no encontrado' }, { status: 404 });
    }

    if (ajuste.estado !== 'PENDIENTE_APROBACION') {
      return NextResponse.json(
        { error: `Solo se pueden rechazar ajustes en estado PENDIENTE_APROBACION. Estado actual: ${ajuste.estado}` },
        { status: 400 }
      );
    }

    // Rechazar
    const ajusteRechazado = await prisma.stockAdjustment.update({
      where: { id: ajusteId },
      data: {
        estado: 'RECHAZADO',
        aprobadoPor: user.id,
        aprobadoAt: new Date(),
        notas: motivo ? `${ajuste.notas || ''}\n[RECHAZADO]: ${motivo}`.trim() : ajuste.notas
      }
    });

    // Registrar auditoría
    await logStateChange({
      entidad: 'stock_adjustment',
      entidadId: ajusteId,
      estadoAnterior: 'PENDIENTE_APROBACION',
      estadoNuevo: 'RECHAZADO',
      companyId,
      userId: user.id,
      motivo: motivo || 'Rechazo de ajuste de inventario'
    });

    // Obtener ajuste completo
    const ajusteCompleto = await prisma.stockAdjustment.findUnique({
      where: { id: ajusteId },
      include: {
        warehouse: { select: { id: true, codigo: true, nombre: true } },
        createdByUser: { select: { id: true, name: true } },
        aprobadoByUser: { select: { id: true, name: true } },
        items: {
          include: {
            supplierItem: {
              select: { id: true, nombre: true, unidad: true }
            }
          }
        }
      }
    });

    return NextResponse.json({
      ...ajusteCompleto,
      message: 'Ajuste rechazado'
    });
  } catch (error) {
    console.error('Error rejecting ajuste:', error);
    return NextResponse.json(
      { error: 'Error al rechazar el ajuste' },
      { status: 500 }
    );
  }
}
