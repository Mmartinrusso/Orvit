/**
 * PUT /api/loads/[id]/status
 *
 * Actualiza el estado de una carga (workflow).
 * Valida transiciones permitidas según el estado actual.
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JWT_SECRET } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LoadStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  const legacyToken = cookieStore.get('token')?.value;
  const token = accessToken || legacyToken;
  if (!token) throw new Error('No token provided');
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return {
      userId: payload.userId as number,
      companyId: payload.companyId as number,
      userName: payload.name as string || 'Usuario',
    };
  } catch {
    throw new Error('Invalid token');
  }
}

// Transiciones permitidas por estado
const ALLOWED_TRANSITIONS: Record<LoadStatus, LoadStatus[]> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['IN_TRANSIT', 'DRAFT', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: ['DRAFT'],
};

// Campos de fecha a actualizar según el nuevo estado
const STATUS_DATE_FIELDS: Partial<Record<LoadStatus, string>> = {
  IN_TRANSIT: 'departureDate',
  DELIVERED: 'deliveryDate',
};

interface StatusUpdateBody {
  status: LoadStatus;
  notes?: string;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, companyId, userName } = await getUserFromToken();
    const { id } = await params;
    const loadId = parseInt(id);

    if (isNaN(loadId)) {
      return NextResponse.json({ error: 'ID de carga inválido' }, { status: 400 });
    }

    const body: StatusUpdateBody = await request.json();
    const { status: newStatus, notes } = body;

    if (!newStatus) {
      return NextResponse.json({ error: 'Se requiere el nuevo estado' }, { status: 400 });
    }

    // Validar que el status sea válido
    const validStatuses: LoadStatus[] = ['DRAFT', 'PENDING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: `Estado inválido. Valores permitidos: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Obtener la carga actual
    const load = await prisma.load.findFirst({
      where: {
        id: loadId,
        companyId,
      },
    });

    if (!load) {
      return NextResponse.json({ error: 'Carga no encontrada' }, { status: 404 });
    }

    const currentStatus = load.status;

    // Validar transición permitida
    const allowedTransitions = ALLOWED_TRANSITIONS[currentStatus];
    if (!allowedTransitions.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Transición no permitida: ${currentStatus} → ${newStatus}`,
          allowedTransitions,
        },
        { status: 400 }
      );
    }

    // Preparar datos de actualización
    const updateData: any = {
      status: newStatus,
    };

    // Actualizar fecha correspondiente si aplica
    const dateField = STATUS_DATE_FIELDS[newStatus];
    if (dateField) {
      updateData[dateField] = new Date();
    }

    // Actualizar la carga
    const updatedLoad = await prisma.load.update({
      where: { id: loadId },
      data: updateData,
      include: {
        truck: true,
        items: {
          orderBy: { position: 'asc' },
        },
      },
    });

    // Registrar en auditoría (tabla dinámica)
    try {
      await prisma.$executeRaw`
        INSERT INTO "LoadAudit" ("loadId", "userId", "action", "changes", "createdAt")
        VALUES (
          ${loadId},
          ${userId},
          'STATUS_CHANGE',
          ${JSON.stringify({
            status: { old: currentStatus, new: newStatus },
            notes: notes || null,
            userName,
          })}::jsonb,
          NOW()
        )
      `;
    } catch {
      // Si la tabla no existe, ignorar silenciosamente
      console.warn('[status] No se pudo registrar auditoría');
    }

    console.log(`[status] Carga #${loadId}: ${currentStatus} → ${newStatus} por ${userName}`);

    return NextResponse.json({
      success: true,
      data: updatedLoad,
      transition: {
        from: currentStatus,
        to: newStatus,
      },
    });
  } catch (error) {
    console.error('[status] Error actualizando estado:', error);

    if (error instanceof Error) {
      if (error.message === 'Invalid token' || error.message === 'No token provided') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Error al actualizar estado' }, { status: 500 });
  }
}

// GET para obtener el historial de estados
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await getUserFromToken();
    const { id } = await params;
    const loadId = parseInt(id);

    if (isNaN(loadId)) {
      return NextResponse.json({ error: 'ID de carga inválido' }, { status: 400 });
    }

    // Verificar que la carga existe y pertenece a la empresa
    const load = await prisma.load.findFirst({
      where: {
        id: loadId,
        companyId,
      },
      select: {
        id: true,
        status: true,
        scheduledDate: true,
        departureDate: true,
        deliveryDate: true,
      },
    });

    if (!load) {
      return NextResponse.json({ error: 'Carga no encontrada' }, { status: 404 });
    }

    // Obtener historial de auditoría de cambios de estado
    let history: any[] = [];
    try {
      history = await prisma.$queryRaw`
        SELECT
          la.id,
          la."createdAt",
          la.changes->>'status' as status_change,
          la.changes->'status'->>'old' as from_status,
          la.changes->'status'->>'new' as to_status,
          la.changes->>'userName' as user_name,
          la.changes->>'notes' as notes
        FROM "LoadAudit" la
        WHERE la."loadId" = ${loadId}
          AND la.action = 'STATUS_CHANGE'
        ORDER BY la."createdAt" DESC
        LIMIT 50
      `;
    } catch {
      // Si la tabla no existe, retornar historial vacío
    }

    return NextResponse.json({
      currentStatus: load.status,
      allowedTransitions: ALLOWED_TRANSITIONS[load.status],
      dates: {
        scheduled: load.scheduledDate,
        departure: load.departureDate,
        delivery: load.deliveryDate,
      },
      history,
    });
  } catch (error) {
    console.error('[status] Error obteniendo estado:', error);

    if (error instanceof Error) {
      if (error.message === 'Invalid token' || error.message === 'No token provided') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
    }

    return NextResponse.json({ error: 'Error al obtener estado' }, { status: 500 });
  }
}
