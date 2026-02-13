/**
 * Invoice PDF Generator - AFIP Compliant
 *
 * Generates professional invoices for Argentina with:
 * - AFIP legal format (Resolución General 1415/2003)
 * - QR Code with CAE validation URL
 * - Barcode with invoice data
 * - Proper layout for Factura A, B, C
 * - IVA breakdown
 * - CAE and expiration date
 *
 * Uses jsPDF and qrcode libraries
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

export interface InvoicePDFData {
  // Company Info
  company: {
    name: string;
    cuit: string;
    address: string;
    city: string;
    province: string;
    phone?: string;
    email?: string;
    logo?: string; // Base64 or URL
    actividadPrincipal: string;
    condicionIVA: string; // Responsable Inscripto, Monotributo, etc.
    inicioActividades: string;
  };

  // Invoice Info
  invoice: {
    tipo: 'A' | 'B' | 'C' | 'E' | 'M';
    letra: string;
    puntoVenta: string;
    numero: string;
    numeroCompleto: string;
    fechaEmision: Date;
    fechaVencimiento: Date;
    cae?: string;
    fechaVtoCae?: Date;

    // Totals
    netoGravado: number;
    iva21?: number;
    iva105?: number;
    iva27?: number;
    exento?: number;
    percepciones?: number;
    total: number;

    // Payment info
    condicionesPago?: string;
    moneda: string;
  };

  // Client Info
  client: {
    name: string;
    cuit?: string;
    condicionIVA: string;
    address: string;
    city?: string;
    province?: string;
  };

  // Items
  items: Array<{
    codigo?: string;
    descripcion: string;
    cantidad: number;
    unidad: string;
    precioUnitario: number;
    descuento: number;
    alicuotaIVA: number;
    subtotal: number;
  }>;

  // Optional
  observaciones?: string;
}

export class InvoicePDFGenerator {
  private doc: jsPDF;
  private currentY: number = 20;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 15;
  private invoiceData: InvoicePDFData;

  // AFIP Colors
  private readonly COLOR_A = [0, 128, 255]; // Azul
  private readonly COLOR_B = [255, 165, 0]; // Naranja
  private readonly COLOR_C = [255, 0, 0]; // Rojo

  constructor(data: InvoicePDFData) {
    this.invoiceData = data;
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  /**
   * Add AFIP compliant header
   */
  private addHeader() {
    const { company, invoice } = this.invoiceData;

    // Logo (left side)
    if (company.logo) {
      try {
        this.doc.addImage(company.logo, 'PNG', this.margin, this.currentY, 40, 20);
      } catch (err) {
        console.warn('Failed to add logo:', err);
      }
    }

    // Issuer info (left column)
    const leftX = this.margin + (company.logo ? 45 : 0);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(company.name, leftX, this.currentY + 5);

    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`CUIT: ${this.formatCUIT(company.cuit)}`, leftX, this.currentY + 10);
    this.doc.text(company.address, leftX, this.currentY + 14);
    this.doc.text(`${company.city}, ${company.province}`, leftX, this.currentY + 18);
    if (company.phone) {
      this.doc.text(`Tel: ${company.phone}`, leftX, this.currentY + 22);
    }

    // Central "LETRA" box (AFIP requirement)
    const boxX = this.pageWidth / 2 - 10;
    const boxY = this.currentY;
    const boxSize = 20;

    const letterColor = invoice.tipo === 'A' ? this.COLOR_A :
                        invoice.tipo === 'B' ? this.COLOR_B :
                        this.COLOR_C;

    this.doc.setDrawColor(...letterColor);
    this.doc.setLineWidth(1.5);
    this.doc.rect(boxX, boxY, boxSize, boxSize);

    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...letterColor);
    this.doc.text(invoice.letra, boxX + boxSize / 2, boxY + boxSize / 2 + 3, { align: 'center' });
    this.doc.setTextColor(0, 0, 0);

    // Document type label below letter
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    const docTypeLabel = `Cod. ${invoice.tipo === 'A' ? '01' : invoice.tipo === 'B' ? '06' : '11'}`;
    this.doc.text(docTypeLabel, boxX + boxSize / 2, boxY + boxSize + 4, { align: 'center' });

    // Right column - Invoice details
    const rightX = boxX + boxSize + 5;
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    const invoiceType = invoice.tipo === 'A' ? 'FACTURA A' :
                        invoice.tipo === 'B' ? 'FACTURA B' :
                        'FACTURA C';
    this.doc.text(invoiceType, rightX, this.currentY + 5);

    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`N°: ${invoice.numeroCompleto}`, rightX, this.currentY + 11);
    this.doc.text(`Fecha: ${this.formatDate(invoice.fechaEmision)}`, rightX, this.currentY + 16);
    this.doc.text(`Vencimiento: ${this.formatDate(invoice.fechaVencimiento)}`, rightX, this.currentY + 21);

    this.currentY += 30;

    // Separator line
    this.doc.setDrawColor(200, 200, 200);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 3;

    // Company fiscal info (AFIP requirement)
    this.doc.setFontSize(7);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Condición frente al IVA: ${company.condicionIVA}`, this.margin, this.currentY);
    this.currentY += 4;
    this.doc.text(`Actividad Principal: ${company.actividadPrincipal}`, this.margin, this.currentY);
    this.currentY += 4;
    this.doc.text(`Inicio de Actividades: ${company.inicioActividades}`, this.margin, this.currentY);
    this.currentY += 6;
  }

  /**
   * Add client information box
   */
  private addClientInfo() {
    const { client } = this.invoiceData;

    // Client box
    this.doc.setDrawColor(0, 0, 0);
    this.doc.setLineWidth(0.5);
    this.doc.rect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, 22);

    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('DATOS DEL CLIENTE', this.margin + 2, this.currentY + 4);

    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Razón Social: ${client.name}`, this.margin + 2, this.currentY + 8);

    if (client.cuit) {
      this.doc.text(`CUIT: ${this.formatCUIT(client.cuit)}`, this.margin + 2, this.currentY + 12);
    }

    this.doc.text(`Condición IVA: ${client.condicionIVA}`, this.margin + 2, this.currentY + 16);
    this.doc.text(`Domicilio: ${client.address}`, this.margin + 2, this.currentY + 20);

    this.currentY += 26;
  }

  /**
   * Add items table
   */
  private addItemsTable() {
    const { items, invoice } = this.invoiceData;

    const showIVA = invoice.tipo === 'A'; // Solo Factura A muestra IVA desglosado

    const columns = showIVA
      ? ['Código', 'Descripción', 'Cant.', 'Unidad', 'P. Unit.', 'Desc.%', 'IVA%', 'Subtotal']
      : ['Código', 'Descripción', 'Cantidad', 'Unidad', 'P. Unitario', 'Desc.%', 'Subtotal'];

    const rows = items.map((item) => {
      const baseRow = [
        item.codigo || '-',
        item.descripcion,
        item.cantidad.toString(),
        item.unidad,
        this.formatCurrency(item.precioUnitario, false),
        item.descuento > 0 ? `${item.descuento}%` : '-',
      ];

      if (showIVA) {
        baseRow.push(
          `${item.alicuotaIVA}%`,
          this.formatCurrency(item.subtotal, false)
        );
      } else {
        baseRow.push(this.formatCurrency(item.subtotal, false));
      }

      return baseRow;
    });

    autoTable(this.doc, {
      startY: this.currentY,
      head: [columns],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
      },
      styles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: showIVA ? {
        0: { cellWidth: 18 },
        1: { cellWidth: 60 },
        2: { cellWidth: 15, halign: 'right' },
        3: { cellWidth: 15 },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 12, halign: 'right' },
        6: { cellWidth: 12, halign: 'right' },
        7: { cellWidth: 25, halign: 'right' },
      } : {
        0: { cellWidth: 20 },
        1: { cellWidth: 80 },
        2: { cellWidth: 15, halign: 'right' },
        3: { cellWidth: 15 },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 12, halign: 'right' },
        6: { cellWidth: 28, halign: 'right' },
      },
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 5;
  }

  /**
   * Add totals section
   */
  private addTotals() {
    const { invoice } = this.invoiceData;

    const startX = this.pageWidth - this.margin - 60;
    this.doc.setFontSize(9);

    // Factura A shows detailed IVA breakdown
    if (invoice.tipo === 'A') {
      this.doc.setFont('helvetica', 'normal');
      this.doc.text('Subtotal (Neto):', startX, this.currentY);
      this.doc.text(this.formatCurrency(invoice.netoGravado), startX + 55, this.currentY, { align: 'right' });
      this.currentY += 5;

      if (invoice.iva21) {
        this.doc.text('IVA 21%:', startX, this.currentY);
        this.doc.text(this.formatCurrency(invoice.iva21), startX + 55, this.currentY, { align: 'right' });
        this.currentY += 5;
      }

      if (invoice.iva105) {
        this.doc.text('IVA 10.5%:', startX, this.currentY);
        this.doc.text(this.formatCurrency(invoice.iva105), startX + 55, this.currentY, { align: 'right' });
        this.currentY += 5;
      }

      if (invoice.iva27) {
        this.doc.text('IVA 27%:', startX, this.currentY);
        this.doc.text(this.formatCurrency(invoice.iva27), startX + 55, this.currentY, { align: 'right' });
        this.currentY += 5;
      }

      if (invoice.percepciones) {
        this.doc.text('Percepciones:', startX, this.currentY);
        this.doc.text(this.formatCurrency(invoice.percepciones), startX + 55, this.currentY, { align: 'right' });
        this.currentY += 5;
      }
    } else {
      // Factura B/C shows only total
      this.doc.setFont('helvetica', 'normal');
      this.doc.text('Subtotal:', startX, this.currentY);
      this.doc.text(this.formatCurrency(invoice.netoGravado), startX + 55, this.currentY, { align: 'right' });
      this.currentY += 5;
    }

    // Total (always)
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(11);
    this.doc.text('TOTAL:', startX, this.currentY);
    this.doc.text(this.formatCurrency(invoice.total), startX + 55, this.currentY, { align: 'right' });

    this.currentY += 8;
  }

  /**
   * Add CAE section (AFIP authorization)
   */
  private async addCAE() {
    const { invoice } = this.invoiceData;

    if (!invoice.cae) {
      // No CAE yet - show pending message
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'italic');
      this.doc.text('⚠ Comprobante pendiente de autorización AFIP', this.margin, this.currentY);
      this.currentY += 6;
      return;
    }

    // CAE box
    const boxY = this.currentY;
    this.doc.setDrawColor(0, 0, 0);
    this.doc.setLineWidth(0.5);
    this.doc.rect(this.margin, boxY, this.pageWidth - 2 * this.margin, 20);

    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('COMPROBANTE AUTORIZADO', this.margin + 2, boxY + 4);

    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`CAE N°: ${invoice.cae}`, this.margin + 2, boxY + 9);
    this.doc.text(`Fecha de Vto. de CAE: ${this.formatDate(invoice.fechaVtoCae!)}`, this.margin + 2, boxY + 14);

    // QR Code (right side of CAE box)
    if (invoice.cae) {
      const qrUrl = this.generateAFIPQRUrl();
      try {
        const qrDataUrl = await QRCode.toDataURL(qrUrl, {
          width: 200,
          margin: 1,
        });

        const qrSize = 18;
        const qrX = this.pageWidth - this.margin - qrSize - 2;
        this.doc.addImage(qrDataUrl, 'PNG', qrX, boxY + 1, qrSize, qrSize);
      } catch (err) {
        console.warn('Failed to generate QR code:', err);
      }
    }

    this.currentY = boxY + 24;
  }

  /**
   * Add barcode with invoice data
   */
  private addBarcode() {
    const { invoice, company } = this.invoiceData;

    if (!invoice.cae) return; // No barcode without CAE

    // Generate barcode data (AFIP format)
    // Format: CUIT + TipoComp + PtoVenta + CAE + FechaVto
    const barcodeData =
      company.cuit.replace(/-/g, '') +
      (invoice.tipo === 'A' ? '01' : invoice.tipo === 'B' ? '06' : '11') +
      invoice.puntoVenta.padStart(5, '0') +
      invoice.cae +
      this.formatDateBarcode(invoice.fechaVtoCae!);

    try {
      // Create canvas element for barcode
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, barcodeData, {
        format: 'CODE128',
        width: 1,
        height: 40,
        displayValue: false,
      });

      const barcodeImg = canvas.toDataURL('image/png');
      const barcodeWidth = 100;
      const barcodeHeight = 15;
      const barcodeX = (this.pageWidth - barcodeWidth) / 2;

      this.doc.addImage(barcodeImg, 'PNG', barcodeX, this.currentY, barcodeWidth, barcodeHeight);
      this.currentY += barcodeHeight + 2;
    } catch (err) {
      console.warn('Failed to generate barcode:', err);
    }
  }

  /**
   * Add observations/notes
   */
  private addObservations() {
    const { observaciones } = this.invoiceData;

    if (!observaciones || observaciones.trim() === '') return;

    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Observaciones:', this.margin, this.currentY);
    this.currentY += 4;

    this.doc.setFont('helvetica', 'normal');
    const splitNotes = this.doc.splitTextToSize(observaciones, this.pageWidth - 2 * this.margin);
    this.doc.text(splitNotes, this.margin, this.currentY);
    this.currentY += splitNotes.length * 4;
  }

  /**
   * Add footer
   */
  private addFooter() {
    const footerY = this.pageHeight - 10;

    this.doc.setFontSize(7);
    this.doc.setTextColor(128, 128, 128);

    // Legal text
    const legalText = 'Documento no válido como factura';
    if (!this.invoiceData.invoice.cae) {
      this.doc.text(legalText, this.margin, footerY);
    }

    // Page number
    this.doc.text(
      `Página ${this.doc.getCurrentPageInfo().pageNumber}`,
      this.pageWidth - this.margin,
      footerY,
      { align: 'right' }
    );

    this.doc.setTextColor(0, 0, 0);
  }

  /**
   * Generate complete PDF
   */
  async generate(): Promise<Buffer> {
    this.addHeader();
    this.addClientInfo();
    this.addItemsTable();
    this.addTotals();
    await this.addCAE();
    this.addBarcode();
    this.addObservations();
    this.addFooter();

    const arrayBuffer = this.doc.output('arraybuffer');
    return Buffer.from(arrayBuffer);
  }

  /**
   * Generate and return PDF as base64
   */
  async generateBase64(): Promise<string> {
    await this.generate();
    return this.doc.output('datauristring');
  }

  // Helper methods

  private formatCUIT(cuit: string): string {
    const clean = cuit.replace(/\D/g, '');
    if (clean.length === 11) {
      return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
    }
    return cuit;
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private formatDateBarcode(date: Date): string {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }

  private formatCurrency(amount: number, includeSymbol: boolean = true): string {
    const formatted = new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

    return includeSymbol ? `$ ${formatted}` : formatted;
  }

  private generateAFIPQRUrl(): string {
    const { invoice, company } = this.invoiceData;

    // AFIP QR format
    // https://www.afip.gob.ar/fe/qr/?p=base64(JSON)
    const qrData = {
      ver: 1,
      fecha: this.formatDateBarcode(invoice.fechaEmision),
      cuit: company.cuit.replace(/-/g, ''),
      ptoVta: parseInt(invoice.puntoVenta),
      tipoCmp: invoice.tipo === 'A' ? 1 : invoice.tipo === 'B' ? 6 : 11,
      nroCmp: parseInt(invoice.numero),
      importe: invoice.total,
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: 80, // CUIT
      nroDocRec: this.invoiceData.client.cuit?.replace(/-/g, '') || '',
      tipoCodAut: 'E', // CAE
      codAut: invoice.cae || '',
    };

    const base64Data = Buffer.from(JSON.stringify(qrData)).toString('base64');
    return `https://www.afip.gob.ar/fe/qr/?p=${base64Data}`;
  }
}

/**
 * Quick function to generate invoice PDF
 */
export async function generateInvoicePDF(data: InvoicePDFData): Promise<Buffer> {
  const generator = new InvoicePDFGenerator(data);
  return await generator.generate();
}
