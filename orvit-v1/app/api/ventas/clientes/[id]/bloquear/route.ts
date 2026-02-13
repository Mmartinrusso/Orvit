/**
 * POST /api/ventas/clientes/[id]/bloquear
 *
 * Blocks a client and creates audit trail in ClientBlockHistory.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { blockClientSchema } from '@/lib/ventas/validation-schemas';

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
    const validationResult = blockClientSchema.safeParse(rawBody);

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
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Check if already blocked
    if (client.isBlocked) {
      return NextResponse.json(
        {
          error: 'Cliente ya está bloqueado',
          currentReason: client.blockedReason,
        },
        { status: 400 }
      );
    }

    // Transaction: Block client and create history entry
    const result = await prisma.$transaction(async (tx) => {
      // Update client
      const updatedClient = await tx.client.update({
        where: { id: clientId },
        data: {
          isBlocked: true,
          blockedReason: body.motivo,
          blockedAt: new Date(),
          blockedByUserId: user!.id,
        },
        select: {
          id: true,
          name: true,
          legalName: true,
          isBlocked: true,
          blockedReason: true,
          blockedAt: true,
        },
      });

      // Create history entry
      const historyEntry = await tx.clientBlockHistory.create({
        data: {
          clientId,
          companyId,
          tipoBloqueo: body.tipoBloqueo,
          motivo: body.motivo,
          montoExcedido: body.montoExcedido
            ? new Prisma.Decimal(body.montoExcedido)
            : null,
          facturaRef: body.facturaRef ?? null,
          diasMora: body.diasMora ?? null,
          bloqueadoPor: user!.id,
        },
        select: {
          id: true,
          tipoBloqueo: true,
          motivo: true,
          bloqueadoAt: true,
        },
      });

      return { client: updatedClient, history: historyEntry };
    });

    return NextResponse.json({
      success: true,
      message: `Cliente ${client.name || client.legalName} bloqueado exitosamente`,
      client: result.client,
      history: result.history,
    });
  } catch (error) {
    console.error('Error blocking client:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
