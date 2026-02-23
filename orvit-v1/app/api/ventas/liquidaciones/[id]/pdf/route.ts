import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { generateLiquidacionPDF } from '@/lib/ventas/pdf/liquidacion-pdf-generator';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.LIQUIDACIONES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const { id } = await params;
    const liquidacionId = parseInt(id);
    if (isNaN(liquidacionId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const liquidacion = await prisma.sellerLiquidacion.findFirst({
      where: { id: liquidacionId, companyId },
      include: {
        seller: { select: { id: true, name: true, email: true } },
        createdByUser: { select: { id: true, name: true } },
        confirmadoByUser: { select: { id: true, name: true } },
        pagadoByUser: { select: { id: true, name: true } },
        items: {
          include: {
            sale: {
              select: {
                id: true,
                numero: true,
                items: {
                  select: {
                    id: true,
                    descripcion: true,
                    cantidad: true,
                    precioUnitario: true,
                    costBreakdown: {
                      select: { concepto: true, monto: true, orden: true },
                      orderBy: { orden: 'asc' as const },
                    },
                  },
                },
              },
            },
          },
          orderBy: { fechaVenta: 'asc' },
        },
        company: true,
      },
    });

    if (!liquidacion) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    const pdfBuffer = await generateLiquidacionPDF({
      liquidacion,
      company: {
        name: liquidacion.company.name,
        cuit: liquidacion.company.cuit || '',
        address: liquidacion.company.address || '',
        phone: liquidacion.company.phone || '',
        email: liquidacion.company.email || '',
      },
      seller: liquidacion.seller,
    });

    const filename = `Liquidacion_${liquidacion.numero.replace(/\//g, '-')}.pdf`;

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'download';

    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');

    if (mode === 'preview') {
      headers.set('Content-Disposition', `inline; filename="${filename}"`);
    } else {
      headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    }

    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    return new NextResponse(pdfBuffer, { headers });
  } catch (error) {
    console.error('[LIQUIDACION-PDF] Error:', error);
    return NextResponse.json(
      { error: 'Error al generar PDF de liquidación' },
      { status: 500 }
    );
  }
}
