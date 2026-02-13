/**
 * GET /api/ventas/pagos/[id]/recibo
 *
 * Generates and returns a payment receipt PDF
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { generateReceiptPDF, ReceiptPDFData } from '@/lib/ventas/pdf/receipt-pdf-generator';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PAGOS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);
    const paymentId = parseInt(params.id);

    if (isNaN(paymentId)) {
      return NextResponse.json({ error: 'ID de pago inválido' }, { status: 400 });
    }

    // Fetch payment with all relations
    const payment = await prisma.clientPayment.findFirst({
      where: applyViewMode({ id: paymentId, companyId }, viewMode),
      include: {
        client: {
          select: {
            id: true,
            legalName: true,
            name: true,
            cuit: true,
            direccion: true,
          },
        },
        allocations: {
          include: {
            invoice: {
              select: {
                numero: true,
              },
            },
          },
        },
        cheques: {
          select: {
            numero: true,
            banco: true,
            titular: true,
            fechaVencimiento: true,
            importe: true,
          },
        },
        company: {
          select: {
            name: true,
            cuit: true,
            direccion: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    }

    // Prepare PDF data
    const pdfData: ReceiptPDFData = {
      payment: {
        id: payment.id,
        numero: payment.numero,
        fechaPago: new Date(payment.fechaPago),
        totalPago: parseFloat(payment.totalPago.toString()),
        efectivo: parseFloat((payment.efectivo || 0).toString()),
        transferencia: parseFloat((payment.transferencia || 0).toString()),
        chequesTerceros: parseFloat((payment.chequesTerceros || 0).toString()),
        chequesPropios: parseFloat((payment.chequesPropios || 0).toString()),
        tarjetaCredito: parseFloat((payment.tarjetaCredito || 0).toString()),
        tarjetaDebito: parseFloat((payment.tarjetaDebito || 0).toString()),
        otrosMedios: parseFloat((payment.otrosMedios || 0).toString()),
        retIVA: payment.retIVA ? parseFloat(payment.retIVA.toString()) : undefined,
        retGanancias: payment.retGanancias ? parseFloat(payment.retGanancias.toString()) : undefined,
        retIngBrutos: payment.retIngBrutos ? parseFloat(payment.retIngBrutos.toString()) : undefined,
        bancoOrigen: payment.bancoOrigen || undefined,
        numeroOperacion: payment.numeroOperacion || undefined,
        notas: payment.notas || undefined,
      },
      client: {
        id: payment.client.id,
        legalName: payment.client.legalName || undefined,
        name: payment.client.name || undefined,
        cuit: payment.client.cuit || undefined,
        direccion: payment.client.direccion || undefined,
      },
      company: {
        name: payment.company.name,
        cuit: payment.company.cuit || undefined,
        direccion: payment.company.direccion || undefined,
        email: payment.company.email || undefined,
        phone: payment.company.phone || undefined,
      },
      allocations:
        payment.allocations?.map((alloc) => ({
          invoiceNumero: alloc.invoice.numero,
          montoAplicado: parseFloat(alloc.montoAplicado.toString()),
        })) || [],
      cheques:
        payment.cheques?.map((ch) => ({
          numero: ch.numero,
          banco: ch.banco,
          titular: ch.titular || undefined,
          fechaVencimiento: ch.fechaVencimiento ? new Date(ch.fechaVencimiento) : undefined,
          importe: parseFloat(ch.importe.toString()),
        })) || [],
    };

    // Generate PDF
    const pdfBuffer = await generateReceiptPDF(pdfData);

    // Return PDF with download headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Recibo-${payment.numero}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[RECIBO-PDF] Error:', error);
    return NextResponse.json(
      {
        error: 'Error al generar el recibo',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
