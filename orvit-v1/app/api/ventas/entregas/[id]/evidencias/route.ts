import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * GET - List evidences for a delivery
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_VIEW);
    if (error) return error;

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const viewMode = getViewMode(request);

    // Verify delivery exists and user has access
    const delivery = await prisma.saleDelivery.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
    });

    if (!delivery) {
      return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 });
    }

    // Get evidences
    const evidences = await prisma.saleDeliveryEvidence.findMany({
      where: { deliveryId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: evidences });
  } catch (error) {
    console.error('Error fetching evidences:', error);
    return NextResponse.json({ error: 'Error al obtener evidencias' }, { status: 500 });
  }
}

/**
 * POST - Upload evidence (photo, signature, document)
 * Expects multipart/form-data with file upload
 * For now, we'll accept base64 encoded images in JSON
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_EDIT);
    if (error) return error;

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const viewMode = getViewMode(request);

    // Verify delivery exists and user has access
    const delivery = await prisma.saleDelivery.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
    });

    if (!delivery) {
      return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const { tipo, url, descripcion } = body;

    if (!tipo || !url) {
      return NextResponse.json(
        { error: 'Tipo y URL son requeridos' },
        { status: 400 }
      );
    }

    if (!['foto', 'firma', 'documento'].includes(tipo)) {
      return NextResponse.json(
        { error: 'Tipo inválido. Debe ser: foto, firma, documento' },
        { status: 400 }
      );
    }

    // Create evidence record
    const evidence = await prisma.saleDeliveryEvidence.create({
      data: {
        deliveryId: id,
        tipo,
        url,
        descripcion,
      },
    });

    return NextResponse.json(evidence, { status: 201 });
  } catch (error) {
    console.error('Error uploading evidence:', error);
    return NextResponse.json({ error: 'Error al subir evidencia' }, { status: 500 });
  }
}

/**
 * DELETE - Remove evidence
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_EDIT);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const evidenceId = searchParams.get('evidenceId');

    if (!evidenceId) {
      return NextResponse.json({ error: 'evidenceId requerido' }, { status: 400 });
    }

    const id = parseInt(params.id);
    const viewMode = getViewMode(request);

    // Verify delivery exists and user has access
    const delivery = await prisma.saleDelivery.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
    });

    if (!delivery) {
      return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 });
    }

    // Delete evidence
    await prisma.saleDeliveryEvidence.delete({
      where: {
        id: parseInt(evidenceId),
        deliveryId: id, // Ensure evidence belongs to this delivery
      },
    });

    return NextResponse.json({ message: 'Evidencia eliminada' });
  } catch (error) {
    console.error('Error deleting evidence:', error);
    return NextResponse.json({ error: 'Error al eliminar evidencia' }, { status: 500 });
  }
}
