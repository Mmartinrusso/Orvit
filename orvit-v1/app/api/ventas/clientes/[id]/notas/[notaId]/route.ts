import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// PUT: Actualizar nota
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; notaId: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_EDIT);
    if (error) return error;

    const companyId = user!.companyId;
    const { id: clientId, notaId } = await params;

    // Verificar que la nota existe y pertenece al cliente
    const existing = await prisma.clientNote.findFirst({
      where: {
        id: notaId,
        clientId,
        companyId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const {
      tipo,
      asunto,
      contenido,
      importante,
      recordatorio,
      completado,
    } = body;

    // Validar tipo si se provee
    if (tipo) {
      const validTipos = ['LLAMADA', 'REUNION', 'EMAIL', 'RECLAMO', 'VISITA', 'NOTA', 'SEGUIMIENTO'];
      if (!validTipos.includes(tipo)) {
        return NextResponse.json({
          error: `Tipo inválido. Debe ser uno de: ${validTipos.join(', ')}`
        }, { status: 400 });
      }
    }

    // Actualizar nota
    const nota = await prisma.clientNote.update({
      where: { id: notaId },
      data: {
        ...(tipo !== undefined && { tipo }),
        ...(asunto !== undefined && { asunto }),
        ...(contenido !== undefined && { contenido }),
        ...(importante !== undefined && { importante }),
        ...(recordatorio !== undefined && { recordatorio: recordatorio ? new Date(recordatorio) : null }),
        ...(completado !== undefined && { completado }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(nota);
  } catch (error) {
    console.error('Error actualizando nota:', error);
    return NextResponse.json({ error: 'Error al actualizar nota' }, { status: 500 });
  }
}

// DELETE: Eliminar nota
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; notaId: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_EDIT);
    if (error) return error;

    const companyId = user!.companyId;
    const { id: clientId, notaId } = await params;

    // Verificar que la nota existe y pertenece al cliente
    const existing = await prisma.clientNote.findFirst({
      where: {
        id: notaId,
        clientId,
        companyId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 });
    }

    // Eliminar nota
    await prisma.clientNote.delete({
      where: { id: notaId },
    });

    return NextResponse.json({ message: 'Nota eliminada correctamente' });
  } catch (error) {
    console.error('Error eliminando nota:', error);
    return NextResponse.json({ error: 'Error al eliminar nota' }, { status: 500 });
  }
}
