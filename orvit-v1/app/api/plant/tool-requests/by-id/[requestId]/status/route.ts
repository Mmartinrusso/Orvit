import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

// PUT /api/plant/tool-requests/by-id/[requestId]/status - Actualizar estado de solicitud
export async function PUT(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const requestId = params.requestId;
    const body = await request.json();
    const { status, notes, updatedBy } = body;

    // Validar estados permitidos
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'DELIVERED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Estado inválido. Estados permitidos: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Buscar la solicitud
    const toolRequest = await prisma.document.findUnique({
      where: { id: requestId }
    });

    if (!toolRequest || toolRequest.entityType !== 'TOOL_REQUEST') {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    // Actualizar el estado
    const requestData = JSON.parse(toolRequest.url);
    requestData.status = status;
    requestData.statusUpdatedAt = new Date().toISOString();
    requestData.statusUpdatedBy = updatedBy;
    
    if (notes) {
      requestData.notes = notes;
    }

    // Guardar cambios
    await prisma.document.update({
      where: { id: requestId },
      data: {
        url: JSON.stringify(requestData),
        originalName: `${toolRequest.originalName} - ${status}`
      }
    });

    console.log(`📦 Solicitud ${requestId} actualizada a ${status} por ${updatedBy}`);

    return NextResponse.json({
      success: true,
      message: `Solicitud marcada como ${status.toLowerCase()}`,
      requestId,
      status,
      updatedBy,
      updatedAt: requestData.statusUpdatedAt
    });

  } catch (error) {
    console.error('Error en PUT /api/plant/tool-requests/by-id/[requestId]/status:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 