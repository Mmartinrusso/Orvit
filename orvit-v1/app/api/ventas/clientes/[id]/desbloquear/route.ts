/**
 * POST /api/ventas/clientes/[id]/desbloquear
 *
 * Unblocks a client and updates the block history entry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { unblockClientSchema } from '@/lib/ventas/validation-schemas';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_BLOCK);
    if (error) return error;

    const companyId = user!.companyId;

    const { id: clientId } = await params;
    if (!clientId) {
      return NextResponse.json({ error: 'ID de cliente requerido' }, { status: 400 });
    }

    // Parse and validate request body
    const rawBody = await request.json();
    const validationResult = unblockClientSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Datos de solicitud inválidos',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const body = validationResult.data;

    // Check if client exists and belongs to company
    const client = await prisma.client.findFirst({
      where: { id: clientId, companyId },
      select: {
        id: true,
        name: true,
        legalName: true,
        isBlocked: true,
        blockedReason: true,
        blockedAt: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Check if blocked
    if (!client.isBlocked) {
      return NextResponse.json(
        { error: 'Cliente no está bloqueado' },
        { status: 400 }
      );
    }

    // Transaction: Unblock client and update history entry
    const result = await prisma.$transaction(async (tx) => {
      // Update client
      const updatedClient = await tx.client.update({
        where: { id: clientId },
        data: {
          isBlocked: false,
          blockedReason: null,
          blockedAt: null,
          blockedByUserId: null,
        },
        select: {
          id: true,
          name: true,
          legalName: true,
          isBlocked: true,
        },
      });

      // Find the most recent unresolved block history entry
      const historyEntry = await tx.clientBlockHistory.findFirst({
        where: {
          clientId,
          companyId,
          desbloqueadoAt: null,
        },
        orderBy: { bloqueadoAt: 'desc' },
      });

      // Update history entry if found
      let updatedHistory = null;
      if (historyEntry) {
        updatedHistory = await tx.clientBlockHistory.update({
          where: { id: historyEntry.id },
          data: {
            desbloqueadoAt: new Date(),
            desbloqueadoPor: user!.id,
            motivoDesbloqueo: body.motivoDesbloqueo,
          },
          select: {
            id: true,
            tipoBloqueo: true,
            motivo: true,
            bloqueadoAt: true,
            desbloqueadoAt: true,
            motivoDesbloqueo: true,
          },
        });
      }

      return { client: updatedClient, history: updatedHistory };
    });

    return NextResponse.json({
      success: true,
      message: `Cliente ${client.name || client.legalName} desbloqueado exitosamente`,
      previousBlockReason: client.blockedReason,
      blockedSince: client.blockedAt,
      client: result.client,
      history: result.history,
    });
  } catch (error) {
    console.error('Error unblocking client:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
