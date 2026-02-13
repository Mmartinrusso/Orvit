/**
 * GET /api/ventas/facturas/[id]/pdf
 *
 * Generates and returns invoice PDF
 * - AFIP compliant format
 * - Includes CAE if authorized
 * - QR code for validation
 * - Downloadable or preview
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { generateInvoicePDF, InvoicePDFData } from '@/lib/ventas/pdf/invoice-pdf-generator';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.FACTURAS_VIEW);
    if (error) return error;

    const invoiceId = parseInt(params.id);
    if (isNaN(invoiceId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const viewMode = getViewMode(request);

    // Fetch invoice with all relations
    const invoice = await prisma.salesInvoice.findFirst({
      where: applyViewMode({ id: invoiceId, companyId: user!.companyId }, viewMode),
      include: {
        client: true,
        sale: {
          select: {
            numero: true,
            condicionesPago: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
        company: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    // Prepare PDF data
    const pdfData: InvoicePDFData = {
      company: {
        name: invoice.company.name,
        cuit: invoice.company.cuit || '',
        address: invoice.company.address || '',
        city: invoice.company.city || '',
        province: invoice.company.province || '',
        phone: invoice.company.phone || undefined,
        email: invoice.company.email || undefined,
        logo: invoice.company.logo || undefined,
        actividadPrincipal: invoice.company.mainActivity || 'Comercio',
        condicionIVA: invoice.company.taxCategory || 'Responsable Inscripto',
        inicioActividades: invoice.company.businessStartDate
          ? new Date(invoice.company.businessStartDate).toLocaleDateString('es-AR')
          : '01/01/2020',
      },

      invoice: {
        tipo: invoice.tipo as 'A' | 'B' | 'C' | 'E' | 'M',
        letra: invoice.letra,
        puntoVenta: invoice.puntoVenta,
        numero: invoice.numero,
        numeroCompleto: invoice.numeroCompleto,
        fechaEmision: new Date(invoice.fechaEmision),
        fechaVencimiento: new Date(invoice.fechaVencimiento),
        cae: invoice.cae || undefined,
        fechaVtoCae: invoice.fechaVtoCae ? new Date(invoice.fechaVtoCae) : undefined,

        netoGravado: parseFloat(invoice.netoGravado.toString()),
        iva21: invoice.iva21 ? parseFloat(invoice.iva21.toString()) : undefined,
        iva105: invoice.iva105 ? parseFloat(invoice.iva105.toString()) : undefined,
        iva27: invoice.iva27 ? parseFloat(invoice.iva27.toString()) : undefined,
        exento: invoice.exento ? parseFloat(invoice.exento.toString()) : undefined,
        percepciones: invoice.percepciones ? parseFloat(invoice.percepciones.toString()) : undefined,
        total: parseFloat(invoice.total.toString()),

        condicionesPago: invoice.condicionesPago || invoice.sale?.condicionesPago || undefined,
        moneda: 'ARS',
      },

      client: {
        name: invoice.client.legalName || invoice.client.name,
        cuit: invoice.client.cuit || undefined,
        condicionIVA: invoice.client.fiscalCategory || 'Consumidor Final',
        address: invoice.client.address || '',
        city: invoice.client.city || undefined,
        province: invoice.client.province || undefined,
      },

      items: invoice.items.map((item) => ({
        codigo: item.codigo || item.product?.code || undefined,
        descripcion: item.descripcion,
        cantidad: parseFloat(item.cantidad.toString()),
        unidad: item.unidad || 'UN',
        precioUnitario: parseFloat(item.precioUnitario.toString()),
        descuento: parseFloat(item.descuento.toString()),
        alicuotaIVA: parseFloat(item.alicuotaIva.toString()),
        subtotal: parseFloat(item.subtotal.toString()),
      })),

      observaciones: invoice.observaciones || undefined,
    };

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(pdfData);

    // Determine filename
    const filename = `Factura_${invoice.letra}_${invoice.numeroCompleto.replace(/\//g, '-')}.pdf`;

    // Check if preview or download
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
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');

    return new NextResponse(pdfBuffer, { headers });
  } catch (error) {
    console.error('[INVOICE-PDF] Error:', error);
    return NextResponse.json(
      { error: 'Error al generar PDF de factura' },
      { status: 500 }
    );
  }
}
