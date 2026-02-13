import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logSalesStatusChange } from '@/lib/ventas/audit-helper';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

interface BulkResult {
  id: number;
  success: boolean;
  error?: string;
}

interface BulkResponse {
  ok: boolean;
  total: number;
  exitosos: number;
  fallidos: number;
  results: BulkResult[];
}

// POST - Acciones en lote
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_DELETE);
    if (error) return error;

    const companyId = user!.companyId;
    const body = await request.json();
    const { accion, ids } = body;

    if (!accion || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Debe especificar accion e ids (array)' },
        { status: 400 }
      );
    }

    const validActions = ['enviar', 'eliminar'];
    if (!validActions.includes(accion)) {
      return NextResponse.json(
        { error: `Acción inválida. Acciones válidas: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // Verificar permisos de admin para algunas acciones
    const isAdmin = user!.role === 'ADMIN' || user!.role === 'OWNER';

    const results: BulkResult[] = [];

    // Procesar cada ID
    for (const id of ids) {
      const quoteId = parseInt(id);
      if (isNaN(quoteId)) {
        results.push({ id, success: false, error: 'ID inválido' });
        continue;
      }

      try {
        // Obtener cotización
        const cotizacion = await prisma.quote.findUnique({
          where: { id: quoteId },
          select: {
            id: true,
            numero: true,
            estado: true,
            companyId: true,
            sellerId: true,
            total: true,
            clientId: true
          }
        });

        if (!cotizacion) {
          results.push({ id: quoteId, success: false, error: 'Cotización no encontrada' });
          continue;
        }

        // Verificar permisos
        if (cotizacion.companyId !== companyId) {
          results.push({ id: quoteId, success: false, error: 'Sin permisos' });
          continue;
        }

        // Si no es admin, solo puede modificar sus propias cotizaciones
        if (!isAdmin && cotizacion.sellerId !== user!.id) {
          results.push({ id: quoteId, success: false, error: 'Sin permisos para esta cotización' });
          continue;
        }

        // Ejecutar acción
        switch (accion) {
          case 'enviar':
            await handleEnviar(cotizacion, user!, results);
            break;
          case 'eliminar':
            await handleEliminar(cotizacion, user!, results);
            break;
        }
      } catch (error) {
        results.push({
          id: quoteId,
          success: false,
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    const exitosos = results.filter(r => r.success).length;
    const fallidos = results.filter(r => !r.success).length;

    const response: BulkResponse = {
      ok: exitosos > 0,
      total: ids.length,
      exitosos,
      fallidos,
      results
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in bulk action:', error);
    return NextResponse.json(
      { error: 'Error al procesar acción en lote', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function handleEnviar(
  cotizacion: { id: number; numero: string; estado: string; companyId: number; total: any; clientId: string },
  user: { id: number; name: string | null },
  results: BulkResult[]
) {
  // Solo BORRADOR puede enviarse
  if (cotizacion.estado !== 'BORRADOR') {
    results.push({
      id: cotizacion.id,
      success: false,
      error: `Estado inválido para enviar: ${cotizacion.estado}`
    });
    return;
  }

  await prisma.quote.update({
    where: { id: cotizacion.id },
    data: {
      estado: 'ENVIADA',
      fechaEnvio: new Date()
    }
  });

  // Registrar auditoría
  await logSalesStatusChange({
    entidad: 'quote',
    entidadId: cotizacion.id,
    companyId: cotizacion.companyId,
    userId: user.id,
    estadoAnterior: 'BORRADOR',
    estadoNuevo: 'ENVIADA',
    reason: 'Acción en lote'
  });

  results.push({ id: cotizacion.id, success: true });
}

async function handleEliminar(
  cotizacion: { id: number; numero: string; estado: string; companyId: number },
  user: { id: number; name: string | null },
  results: BulkResult[]
) {
  // Solo BORRADOR puede eliminarse
  if (cotizacion.estado !== 'BORRADOR') {
    results.push({
      id: cotizacion.id,
      success: false,
      error: `Solo se pueden eliminar cotizaciones en estado BORRADOR (actual: ${cotizacion.estado})`
    });
    return;
  }

  // Eliminar en cascada (items, versions, etc. se eliminan por FK)
  await prisma.$transaction(async (tx) => {
    // Eliminar items
    await tx.quoteItem.deleteMany({ where: { quoteId: cotizacion.id } });
    // Eliminar versiones
    await tx.quoteVersion.deleteMany({ where: { quoteId: cotizacion.id } });
    // Eliminar attachments
    await tx.quoteAttachment.deleteMany({ where: { quoteId: cotizacion.id } });
    // Eliminar cotización
    await tx.quote.delete({ where: { id: cotizacion.id } });
  });

  results.push({ id: cotizacion.id, success: true });
}
