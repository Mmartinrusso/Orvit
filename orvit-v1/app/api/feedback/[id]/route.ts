import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken, getUserCompanyId } from "@/lib/admin-auth";

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/feedback/[id]
 * Actualizar status, respuesta admin, marcar leído
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const companyId = getUserCompanyId(user);
    if (!companyId) {
      return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
    }

    const { id } = await params;
    const feedbackId = parseInt(id);
    if (isNaN(feedbackId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // Verificar que el feedback pertenece a la empresa
    const existing = await prisma.feedback.findFirst({
      where: { id: feedbackId, companyId }
    });

    if (!existing) {
      return NextResponse.json({ error: "Feedback no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const { status, adminResponse, read } = body;

    const updateData: Record<string, unknown> = {};

    if (status !== undefined) {
      const validStatuses = ['pendiente', 'en-progreso', 'completado', 'rechazado'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: "status debe ser: pendiente, en-progreso, completado o rechazado" },
          { status: 400 }
        );
      }
      updateData.status = status;
      if (status === 'completado' || status === 'rechazado') {
        updateData.resolvedAt = new Date();
      } else {
        updateData.resolvedAt = null;
      }
    }

    if (adminResponse !== undefined) {
      updateData.adminResponse = adminResponse;
    }

    if (read !== undefined) {
      updateData.read = read;
    }

    const feedback = await prisma.feedback.update({
      where: { id: feedbackId },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true }
        }
      }
    });

    return NextResponse.json({ success: true, feedback });
  } catch (error) {
    console.error('Error actualizando feedback:', error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/feedback/[id]
 * Eliminar un feedback
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const companyId = getUserCompanyId(user);
    if (!companyId) {
      return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
    }

    const { id } = await params;
    const feedbackId = parseInt(id);
    if (isNaN(feedbackId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const existing = await prisma.feedback.findFirst({
      where: { id: feedbackId, companyId }
    });

    if (!existing) {
      return NextResponse.json({ error: "Feedback no encontrado" }, { status: 404 });
    }

    await prisma.feedback.delete({ where: { id: feedbackId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando feedback:', error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
