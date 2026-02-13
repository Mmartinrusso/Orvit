import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { generateInvoiceHTML, getInvoiceForPDF } from '@/lib/billing/pdf';

export const dynamic = 'force-dynamic';

/**
 * GET /api/superadmin/invoices/[id]/pdf
 * Genera el HTML de la factura para conversión a PDF
 *
 * Query params:
 * - format: 'html' (default) | 'data'
 *
 * Para generar PDF en el cliente, usar una librería como:
 * - html2pdf.js (browser)
 * - @react-pdf/renderer (React)
 * - puppeteer (server-side)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'html';

    // Si se pide solo los datos
    if (format === 'data') {
      const invoice = await getInvoiceForPDF(params.id);

      if (!invoice) {
        return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
      }

      return NextResponse.json({ invoice });
    }

    // Generar HTML
    const html = await generateInvoiceHTML(params.id);

    if (!html) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    // Retornar HTML para renderizar o convertir a PDF
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="factura-${params.id}.html"`,
      },
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return NextResponse.json({ error: 'Error generando PDF' }, { status: 500 });
  }
}
