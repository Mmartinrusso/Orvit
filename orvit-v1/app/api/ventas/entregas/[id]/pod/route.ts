import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { generateDeliveryPOD } from '@/lib/ventas/pdf/delivery-pod-generator';

export const dynamic = 'force-dynamic';

/**
 * GET - Generate and download Proof of Delivery (POD) PDF
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

    // Fetch delivery with all related data
    const delivery = await prisma.saleDelivery.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
      include: {
        items: {
          include: {
            product: true,
            saleItem: true,
          },
        },
        sale: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!delivery) {
      return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 });
    }

    // Fetch company info
    const company = await prisma.company.findUnique({
      where: { id: user!.companyId },
    });

    if (!company) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 });
    }

    // Prepare data for PDF generation
    const pdfData = {
      delivery,
      sale: delivery.sale,
      client: delivery.sale.client,
      company,
      items: delivery.items,
    };

    // Generate PDF
    const pdfBuffer = await generateDeliveryPOD(pdfData);

    // Return PDF as download
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="POD-${delivery.numero}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating POD:', error);
    return NextResponse.json(
      { error: 'Error al generar comprobante de entrega' },
      { status: 500 }
    );
  }
}
