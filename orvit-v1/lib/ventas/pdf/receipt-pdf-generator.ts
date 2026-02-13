/**
 * Receipt PDF Generator
 *
 * Generates professional payment receipt PDFs (Recibo de Pago) with:
 * - Company and client information
 * - Payment methods breakdown
 * - Applied invoices list
 * - Total amount
 * - Signatures
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export interface ReceiptPDFData {
  payment: {
    id: number;
    numero: string;
    fechaPago: Date;
    totalPago: number;
    efectivo: number;
    transferencia: number;
    chequesTerceros: number;
    chequesPropios: number;
    tarjetaCredito: number;
    tarjetaDebito: number;
    otrosMedios: number;
    retIVA?: number;
    retGanancias?: number;
    retIngBrutos?: number;
    bancoOrigen?: string;
    numeroOperacion?: string;
    notas?: string;
  };
  client: {
    id: string;
    legalName?: string;
    name?: string;
    cuit?: string;
    direccion?: string;
  };
  company: {
    name: string;
    cuit?: string;
    direccion?: string;
    email?: string;
    phone?: string;
  };
  allocations?: Array<{
    invoiceNumero: string;
    montoAplicado: number;
  }>;
  cheques?: Array<{
    numero: string;
    banco: string;
    titular?: string;
    fechaVencimiento?: Date;
    importe: number;
  }>;
}

export async function generateReceiptPDF(data: ReceiptPDFData): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const { payment, client, company, allocations, cheques } = data;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  // Helper function to add text with automatic page break
  const addText = (text: string, x: number, y: number, options: any = {}) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      return margin;
    }
    doc.text(text, x, y, options);
    return y;
  };

  // =========================================================================
  // Header
  // =========================================================================

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  yPos = addText('RECIBO DE PAGO', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Receipt number and date
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  yPos = addText(`N° ${payment.numero}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 7;
  yPos = addText(
    format(new Date(payment.fechaPago), 'dd/MM/yyyy HH:mm', { locale: es }),
    pageWidth / 2,
    yPos,
    { align: 'center' }
  );
  yPos += 12;

  // Horizontal line
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // =========================================================================
  // Company Information
  // =========================================================================

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  yPos = addText('Recibí de:', margin, yPos);
  yPos += 7;

  doc.setFont('helvetica', 'normal');
  const clientName = client.legalName || client.name || 'Sin nombre';
  yPos = addText(clientName, margin + 5, yPos);
  yPos += 5;

  if (client.cuit) {
    yPos = addText(`CUIT: ${client.cuit}`, margin + 5, yPos);
    yPos += 5;
  }

  if (client.direccion) {
    yPos = addText(`Domicilio: ${client.direccion}`, margin + 5, yPos);
    yPos += 5;
  }

  yPos += 5;

  // =========================================================================
  // Payment Amount
  // =========================================================================

  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 15, 'F');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  yPos += 10;
  yPos = addText('TOTAL:', margin + 5, yPos);

  const totalFormatted = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(payment.totalPago);

  yPos = addText(totalFormatted, pageWidth - margin - 5, yPos, { align: 'right' });
  yPos += 10;

  // =========================================================================
  // Payment Methods
  // =========================================================================

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  yPos = addText('Detalle de Medios de Pago:', margin, yPos);
  yPos += 7;

  doc.setFont('helvetica', 'normal');

  const paymentMethods = [
    { label: 'Efectivo', value: payment.efectivo },
    { label: 'Transferencia', value: payment.transferencia },
    { label: 'Cheques de Terceros', value: payment.chequesTerceros },
    { label: 'Cheques Propios', value: payment.chequesPropios },
    { label: 'Tarjeta de Crédito', value: payment.tarjetaCredito },
    { label: 'Tarjeta de Débito', value: payment.tarjetaDebito },
    { label: 'Otros Medios', value: payment.otrosMedios },
  ].filter((method) => method.value > 0);

  for (const method of paymentMethods) {
    const formatted = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(method.value);

    yPos = addText(`${method.label}:`, margin + 5, yPos);
    yPos = addText(formatted, pageWidth - margin - 5, yPos, { align: 'right' });
    yPos += 5;
  }

  // Transfer details
  if (payment.transferencia > 0) {
    yPos += 3;
    if (payment.bancoOrigen) {
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      yPos = addText(`  Banco: ${payment.bancoOrigen}`, margin + 10, yPos);
      yPos += 4;
    }
    if (payment.numeroOperacion) {
      yPos = addText(`  N° Operación: ${payment.numeroOperacion}`, margin + 10, yPos);
      yPos += 4;
    }
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
  }

  yPos += 5;

  // Retentions
  const retentions = [
    { label: 'Retención IVA', value: payment.retIVA || 0 },
    { label: 'Retención Ganancias', value: payment.retGanancias || 0 },
    { label: 'Retención Ing. Brutos', value: payment.retIngBrutos || 0 },
  ].filter((ret) => ret.value > 0);

  if (retentions.length > 0) {
    doc.setFont('helvetica', 'bold');
    yPos = addText('Retenciones:', margin, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');

    for (const ret of retentions) {
      const formatted = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
      }).format(ret.value);

      yPos = addText(`${ret.label}:`, margin + 5, yPos);
      yPos = addText(formatted, pageWidth - margin - 5, yPos, { align: 'right' });
      yPos += 5;
    }

    yPos += 5;
  }

  // =========================================================================
  // Applied Invoices
  // =========================================================================

  if (allocations && allocations.length > 0) {
    yPos += 5;

    // Check if we need a new page
    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFont('helvetica', 'bold');
    yPos = addText('Aplicado a Facturas:', margin, yPos);
    yPos += 7;

    autoTable(doc, {
      startY: yPos,
      head: [['Factura', 'Monto Aplicado']],
      body: allocations.map((alloc) => [
        alloc.invoiceNumero,
        new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: 'ARS',
        }).format(alloc.montoAplicado),
      ]),
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [66, 139, 202], textColor: 255 },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // =========================================================================
  // Cheques Detail
  // =========================================================================

  if (cheques && cheques.length > 0) {
    yPos += 5;

    // Check if we need a new page
    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFont('helvetica', 'bold');
    yPos = addText('Detalle de Cheques:', margin, yPos);
    yPos += 7;

    autoTable(doc, {
      startY: yPos,
      head: [['N° Cheque', 'Banco', 'Titular', 'Vencimiento', 'Importe']],
      body: cheques.map((ch) => [
        ch.numero,
        ch.banco,
        ch.titular || '-',
        ch.fechaVencimiento ? format(new Date(ch.fechaVencimiento), 'dd/MM/yyyy') : '-',
        new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: 'ARS',
        }).format(ch.importe),
      ]),
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202], textColor: 255 },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // =========================================================================
  // Notes
  // =========================================================================

  if (payment.notas) {
    yPos += 10;

    // Check if we need a new page
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFont('helvetica', 'bold');
    yPos = addText('Observaciones:', margin, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const notesLines = doc.splitTextToSize(payment.notas, pageWidth - 2 * margin - 10);
    for (const line of notesLines) {
      yPos = addText(line, margin + 5, yPos);
      yPos += 5;
    }
    doc.setFontSize(10);
  }

  // =========================================================================
  // Footer - Signatures
  // =========================================================================

  // Position signatures at bottom of page or after content
  yPos = Math.max(yPos + 30, pageHeight - 50);

  doc.setLineWidth(0.3);
  doc.line(margin + 10, yPos, margin + 70, yPos);
  doc.line(pageWidth - margin - 70, yPos, pageWidth - margin - 10, yPos);

  yPos += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  yPos = addText('Firma y Aclaración', margin + 40, yPos, { align: 'center' });
  yPos = addText('Recibí Conforme', pageWidth - margin - 40, yPos, { align: 'center' });

  // Company info at bottom
  yPos = pageHeight - 15;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  let companyInfo = company.name;
  if (company.cuit) companyInfo += ` | CUIT: ${company.cuit}`;
  if (company.direccion) companyInfo += ` | ${company.direccion}`;
  if (company.phone) companyInfo += ` | Tel: ${company.phone}`;

  doc.text(companyInfo, pageWidth / 2, yPos, { align: 'center' });

  // Page number
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin - 5, pageHeight - 10, {
      align: 'right',
    });
  }

  return Buffer.from(doc.output('arraybuffer'));
}
