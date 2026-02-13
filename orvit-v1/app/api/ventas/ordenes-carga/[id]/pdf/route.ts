import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { generateLoadOrderPDF } from '@/lib/ventas/pdf/load-order-pdf-generator';

export const dynamic = 'force-dynamic';

/**
 * GET - Generate and download Load Order PDF
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_VIEW);
    if (error) return error;

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const viewMode = getViewMode(request);

    // Fetch load order with all related data
    const loadOrder = await prisma.loadOrder.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
      include: {
        items: {
          include: {
            product: true,
            saleItem: true,
          },
          orderBy: { secuencia: 'asc' },
        },
        sale: {
          include: {
            client: true,
          },
        },
        confirmedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!loadOrder) {
      return NextResponse.json({ error: 'Orden de carga no encontrada' }, { status: 404 });
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
      loadOrder,
      sale: loadOrder.sale,
      client: loadOrder.sale.client,
      company,
      items: loadOrder.items,
    };

    // Generate PDF
    const pdfBuffer = await generateLoadOrderPDF(pdfData);

    // Return PDF as download
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="OC-${loadOrder.numero}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating load order PDF:', error);
    return NextResponse.json(
      { error: 'Error al generar PDF de orden de carga' },
      { status: 500 }
    );
  }
}
