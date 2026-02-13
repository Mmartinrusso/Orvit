import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { generateOrdenPDF } from '@/lib/ventas/pdf/orden-pdf-generator';

export const dynamic = 'force-dynamic';

/**
 * GET - Generar PDF de una orden de venta
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_VIEW);
    if (error) return error;

    const { id: idParam } = await params;
    const ordenId = parseInt(idParam);

    // Obtener orden completa
    const orden = await prisma.sale.findFirst({
      where: {
        id: ordenId,
        companyId: user!.companyId,
      },
      include: {
        items: {
          orderBy: { orden: 'asc' },
        },
        client: true,
        seller: true,
        company: true,
      },
    });

    if (!orden) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    // Generar PDF
    const pdfBuffer = await generateOrdenPDF({
      orden,
      company: orden.company,
      client: orden.client,
    });

    // Retornar PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Orden_${orden.numero}.pdf"`,
        'Cache-Control': 'private, max-age=300', // 5 minutos
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ error: 'Error al generar PDF' }, { status: 500 });
  }
}
