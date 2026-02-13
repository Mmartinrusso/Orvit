/**
 * Enhanced PDF Generator with QR Code
 *
 * Generates professional PDFs for sales documents with:
 * - Company logo
 * - QR code for tracking
 * - Watermarks for draft states
 * - Proper formatting and styling
 *
 * Uses jsPDF and qrcode libraries
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

export interface PDFCompanyInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  cuit?: string;
  logo?: string; // Base64 or URL
}

export interface PDFDocumentInfo {
  type: 'SALE_ORDER' | 'LOAD_ORDER' | 'DELIVERY' | 'REMITO' | 'INVOICE';
  numero: string;
  fecha: Date;
  estado: string;
  trackingUrl?: string; // For QR code
}

export interface PDFClientInfo {
  name: string;
  cuit?: string;
  address?: string;
  phone?: string;
}

export interface PDFItem {
  codigo?: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario?: number;
  subtotal?: number;
}

export interface PDFOptions {
  includeQR?: boolean;
  includeWatermark?: boolean;
  watermarkText?: string;
  includeFooter?: boolean;
  footerText?: string;
  currency?: string;
}

export class EnhancedPDFGenerator {
  private doc: jsPDF;
  private currentY: number = 20;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 15;

  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  /**
   * Add company header with logo
   */
  async addHeader(company: PDFCompanyInfo, document: PDFDocumentInfo) {
    // Add logo if available
    if (company.logo) {
      try {
        this.doc.addImage(company.logo, 'PNG', this.margin, this.currentY, 40, 20);
      } catch (err) {
        console.warn('Failed to add logo:', err);
      }
    }

    // Company info (right side)
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    const companyX = this.pageWidth - this.margin - 80;
    this.doc.text(company.name, companyX, this.currentY + 5, { align: 'left' });

    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    if (company.cuit) {
      this.doc.text(`CUIT: ${company.cuit}`, companyX, this.currentY + 10);
    }
    if (company.address) {
      this.doc.text(company.address, companyX, this.currentY + 14, { maxWidth: 75 });
    }
    if (company.phone) {
      this.doc.text(`Tel: ${company.phone}`, companyX, this.currentY + 18);
    }

    this.currentY += 30;

    // Document title
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    const title = this.getDocumentTitle(document.type);
    this.doc.text(title, this.pageWidth / 2, this.currentY, { align: 'center' });

    this.currentY += 10;

    // Document info line
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    const fecha = this.formatDate(document.fecha);
    const infoLine = `${document.numero} | ${fecha} | Estado: ${document.estado}`;
    this.doc.text(infoLine, this.pageWidth / 2, this.currentY, { align: 'center' });

    this.currentY += 10;
  }

  /**
   * Add client information box
   */
  addClientInfo(client: PDFClientInfo) {
    // Draw box
    this.doc.setDrawColor(200, 200, 200);
    this.doc.rect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, 25);

    // Title
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('CLIENTE', this.margin + 3, this.currentY + 5);

    // Info
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(client.name, this.margin + 3, this.currentY + 10);

    if (client.cuit) {
      this.doc.text(`CUIT: ${client.cuit}`, this.margin + 3, this.currentY + 14);
    }

    if (client.address) {
      this.doc.text(
        `Dirección: ${client.address}`,
        this.margin + 3,
        this.currentY + 18,
        { maxWidth: 90 }
      );
    }

    if (client.phone) {
      this.doc.text(`Tel: ${client.phone}`, this.margin + 100, this.currentY + 18);
    }

    this.currentY += 30;
  }

  /**
   * Add items table
   */
  addItemsTable(items: PDFItem[], includePrice: boolean = true) {
    const columns = includePrice
      ? ['Código', 'Descripción', 'Cantidad', 'Unidad', 'P. Unit.', 'Subtotal']
      : ['Código', 'Descripción', 'Cantidad', 'Unidad'];

    const rows = items.map((item) => {
      const baseRow = [
        item.codigo || '-',
        item.descripcion,
        item.cantidad.toString(),
        item.unidad,
      ];

      if (includePrice && item.precioUnitario !== undefined) {
        baseRow.push(
          this.formatCurrency(item.precioUnitario),
          this.formatCurrency(item.subtotal || 0)
        );
      }

      return baseRow;
    });

    autoTable(this.doc, {
      startY: this.currentY,
      head: [columns],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [66, 139, 202], textColor: 255 },
      styles: { fontSize: 9 },
      columnStyles: includePrice
        ? {
            0: { cellWidth: 25 },
            1: { cellWidth: 70 },
            2: { cellWidth: 20, halign: 'right' },
            3: { cellWidth: 20 },
            4: { cellWidth: 25, halign: 'right' },
            5: { cellWidth: 25, halign: 'right' },
          }
        : {
            0: { cellWidth: 30 },
            1: { cellWidth: 100 },
            2: { cellWidth: 25, halign: 'right' },
            3: { cellWidth: 25 },
          },
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
  }

  /**
   * Add totals section
   */
  addTotals(totals: { label: string; value: number }[]) {
    const startX = this.pageWidth - this.margin - 60;

    this.doc.setFontSize(10);

    for (const total of totals) {
      this.doc.setFont('helvetica', total.label.includes('Total') ? 'bold' : 'normal');
      this.doc.text(total.label, startX, this.currentY);
      this.doc.text(this.formatCurrency(total.value), startX + 55, this.currentY, {
        align: 'right',
      });
      this.currentY += 6;
    }

    this.currentY += 5;
  }

  /**
   * Add QR code for tracking
   */
  async addQRCode(trackingUrl: string, label: string = 'Escanea para rastrear') {
    try {
      const qrDataUrl = await QRCode.toDataURL(trackingUrl, {
        width: 200,
        margin: 1,
      });

      const qrSize = 30;
      const qrX = this.pageWidth - this.margin - qrSize;
      const qrY = this.pageHeight - this.margin - qrSize - 10;

      this.doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

      // Label
      this.doc.setFontSize(8);
      this.doc.text(label, qrX + qrSize / 2, qrY + qrSize + 4, { align: 'center' });
    } catch (err) {
      console.warn('Failed to generate QR code:', err);
    }
  }

  /**
   * Add watermark for draft/cancelled states
   */
  addWatermark(text: string) {
    this.doc.setFontSize(60);
    this.doc.setTextColor(200, 200, 200);
    this.doc.setFont('helvetica', 'bold');

    // Rotate and center
    this.doc.text(text, this.pageWidth / 2, this.pageHeight / 2, {
      align: 'center',
      angle: 45,
    });

    // Reset color
    this.doc.setTextColor(0, 0, 0);
  }

  /**
   * Add footer
   */
  addFooter(text?: string) {
    const footerY = this.pageHeight - this.margin;

    this.doc.setFontSize(8);
    this.doc.setTextColor(128, 128, 128);

    if (text) {
      this.doc.text(text, this.margin, footerY);
    }

    // Page number
    const pageText = `Página ${this.doc.getCurrentPageInfo().pageNumber}`;
    this.doc.text(pageText, this.pageWidth - this.margin, footerY, { align: 'right' });

    // Generated date
    const genText = `Generado: ${this.formatDate(new Date())}`;
    this.doc.text(genText, this.pageWidth / 2, footerY, { align: 'center' });

    this.doc.setTextColor(0, 0, 0);
  }

  /**
   * Add notes section
   */
  addNotes(notes: string) {
    if (!notes || notes.trim() === '') return;

    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Observaciones:', this.margin, this.currentY);

    this.currentY += 5;

    this.doc.setFont('helvetica', 'normal');
    const splitNotes = this.doc.splitTextToSize(
      notes,
      this.pageWidth - 2 * this.margin
    );
    this.doc.text(splitNotes, this.margin, this.currentY);

    this.currentY += splitNotes.length * 5 + 5;
  }

  /**
   * Generate and return PDF as buffer
   */
  async generate(): Promise<Buffer> {
    const arrayBuffer = this.doc.output('arraybuffer');
    return Buffer.from(arrayBuffer);
  }

  /**
   * Generate and return PDF as base64
   */
  async generateBase64(): Promise<string> {
    return this.doc.output('datauristring');
  }

  // Helper methods
  private getDocumentTitle(type: PDFDocumentInfo['type']): string {
    const titles = {
      SALE_ORDER: 'ORDEN DE VENTA',
      LOAD_ORDER: 'ORDEN DE CARGA',
      DELIVERY: 'ENTREGA',
      REMITO: 'REMITO',
      INVOICE: 'FACTURA',
    };
    return titles[type];
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private formatCurrency(amount: number, currency: string = 'ARS'): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  }
}

/**
 * Quick function to generate a load order PDF
 */
export async function generateLoadOrderPDF(data: {
  company: PDFCompanyInfo;
  document: PDFDocumentInfo;
  client: PDFClientInfo;
  items: PDFItem[];
  driver?: { name: string; dni: string };
  vehicle?: { type: string; plate: string };
  notes?: string;
  options?: PDFOptions;
}): Promise<Buffer> {
  const pdf = new EnhancedPDFGenerator();

  await pdf.addHeader(data.company, data.document);
  pdf.addClientInfo(data.client);

  // Add driver/vehicle info if available
  if (data.driver || data.vehicle) {
    const currentY = (pdf as any).currentY;
    (pdf as any).doc.setFontSize(9);
    (pdf as any).doc.setFont('helvetica', 'bold');

    let infoText = '';
    if (data.driver) {
      infoText += `Chofer: ${data.driver.name} (DNI: ${data.driver.dni})`;
    }
    if (data.vehicle) {
      if (infoText) infoText += ' | ';
      infoText += `Vehículo: ${data.vehicle.type} - ${data.vehicle.plate}`;
    }

    (pdf as any).doc.text(infoText, (pdf as any).margin, currentY);
    (pdf as any).currentY = currentY + 8;
  }

  pdf.addItemsTable(data.items, false);

  if (data.notes) {
    pdf.addNotes(data.notes);
  }

  // Add QR code if tracking URL provided
  if (data.options?.includeQR && data.document.trackingUrl) {
    await pdf.addQRCode(data.document.trackingUrl);
  }

  // Add watermark for draft
  if (
    data.options?.includeWatermark &&
    (data.document.estado === 'BORRADOR' || data.document.estado === 'PENDIENTE')
  ) {
    pdf.addWatermark(data.options.watermarkText || 'BORRADOR');
  }

  // Add footer
  if (data.options?.includeFooter !== false) {
    pdf.addFooter(data.options?.footerText);
  }

  return await pdf.generate();
}
