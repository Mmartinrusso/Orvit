import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extender jsPDF para autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

export interface PurchaseOrderItem {
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  descuento: number;
  subtotal: number;
  codigoProveedor?: string;
}

export interface PurchaseOrderPDFData {
  numero: string;
  fechaEmision: string | Date;
  fechaEntregaEsperada?: string | Date | null;
  estado: string;
  condicionesPago?: string | null;
  moneda: string;
  subtotal: number;
  tasaIva: number;
  impuestos: number;
  total: number;
  notas?: string | null;
  esEmergencia?: boolean;
  motivoEmergencia?: string | null;
  company?: {
    name?: string | null;
    cuit?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  proveedor: {
    name: string;
    razonSocial?: string | null;
    cuit?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  items: PurchaseOrderItem[];
  createdByUser?: { name: string } | null;
}

const currency = (value: any, moneda: string = 'ARS'): string => {
  const n = Number(value || 0);
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 2,
  }).format(n);
};

const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-AR');
};

export function generatePurchaseOrderPDF(data: PurchaseOrderPDFData): string {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 15;

  // ================== ENCABEZADO EMPRESA ==================
  const companyName = data.company?.name || 'Empresa';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(companyName, 15, y);

  // Número de OC a la derecha
  doc.setFontSize(12);
  doc.text('ORDEN DE COMPRA', pageWidth - 15, y, { align: 'right' });
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(data.numero, pageWidth - 15, y, { align: 'right' });

  // Info empresa
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (data.company?.cuit) {
    doc.text(`CUIT: ${data.company.cuit}`, 15, y);
    y += 4;
  }
  if (data.company?.address) {
    doc.text(data.company.address, 15, y);
    y += 4;
  }
  if (data.company?.phone || data.company?.email) {
    const contacto = [data.company.phone, data.company.email].filter(Boolean).join(' | ');
    doc.text(contacto, 15, y);
    y += 4;
  }

  y += 4;

  // Línea divisoria
  doc.setDrawColor(200, 200, 200);
  doc.line(15, y, pageWidth - 15, y);
  y += 8;

  // ================== DATOS DEL PROVEEDOR ==================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PROVEEDOR', 15, y);

  // Fechas a la derecha
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const fechaEmisionStr = `Fecha: ${formatDate(data.fechaEmision)}`;
  const fechaEntregaStr = data.fechaEntregaEsperada
    ? `Entrega: ${formatDate(data.fechaEntregaEsperada)}`
    : '';

  doc.text(fechaEmisionStr, pageWidth - 15, y, { align: 'right' });
  y += 4;
  if (fechaEntregaStr) {
    doc.text(fechaEntregaStr, pageWidth - 15, y, { align: 'right' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(data.proveedor.name, 15, y);
  y += 4;

  if (data.proveedor.razonSocial && data.proveedor.razonSocial !== data.proveedor.name) {
    doc.text(data.proveedor.razonSocial, 15, y);
    y += 4;
  }
  if (data.proveedor.cuit) {
    doc.text(`CUIT: ${data.proveedor.cuit}`, 15, y);
    y += 4;
  }
  if (data.proveedor.address) {
    doc.text(data.proveedor.address, 15, y);
    y += 4;
  }
  if (data.proveedor.phone || data.proveedor.email) {
    const contacto = [data.proveedor.phone, data.proveedor.email].filter(Boolean).join(' | ');
    doc.text(contacto, 15, y);
    y += 4;
  }

  y += 4;

  // Condiciones
  if (data.condicionesPago) {
    doc.setFont('helvetica', 'bold');
    doc.text('Condiciones de pago: ', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.condicionesPago, 55, y);
    y += 6;
  }

  // Emergencia
  if (data.esEmergencia) {
    doc.setTextColor(255, 102, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('⚠ COMPRA DE EMERGENCIA', 15, y);
    doc.setTextColor(0, 0, 0);
    y += 4;
    if (data.motivoEmergencia) {
      doc.setFont('helvetica', 'normal');
      doc.text(`Motivo: ${data.motivoEmergencia}`, 15, y);
      y += 4;
    }
    y += 2;
  }

  // ================== TABLA DE ITEMS ==================
  const tableBody = data.items.map((item) => [
    item.codigoProveedor || '-',
    item.descripcion,
    `${item.cantidad} ${item.unidad}`,
    currency(item.precioUnitario, data.moneda),
    item.descuento > 0 ? `${item.descuento}%` : '-',
    currency(item.subtotal, data.moneda),
  ]);

  (doc as any).autoTable({
    startY: y,
    head: [['Código', 'Descripción', 'Cantidad', 'Precio Unit.', 'Desc.', 'Subtotal']],
    body: tableBody,
    theme: 'striped',
    styles: {
      fontSize: 9,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [50, 50, 50],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 25, halign: 'left' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 28, halign: 'right' },
    },
    margin: { left: 15, right: 15 },
  });

  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 6;

  // ================== TOTALES ==================
  const totalesX = pageWidth - 15;
  const labelX = totalesX - 50;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  doc.text('Subtotal:', labelX, y, { align: 'right' });
  doc.text(currency(data.subtotal, data.moneda), totalesX, y, { align: 'right' });
  y += 5;

  doc.text(`IVA (${data.tasaIva}%):`, labelX, y, { align: 'right' });
  doc.text(currency(data.impuestos, data.moneda), totalesX, y, { align: 'right' });
  y += 5;

  // Línea antes del total
  doc.setDrawColor(0);
  doc.line(labelX - 10, y, totalesX, y);
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL:', labelX, y, { align: 'right' });
  doc.text(currency(data.total, data.moneda), totalesX, y, { align: 'right' });
  y += 10;

  // ================== NOTAS ==================
  if (data.notas) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Notas:', 15, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    const textLines = doc.splitTextToSize(data.notas, pageWidth - 30);
    doc.text(textLines, 15, y);
    y += textLines.length * 4 + 6;
  }

  // ================== PIE DE PÁGINA ==================
  // Líneas de firma
  const firmaY = pageHeight - 35;

  doc.setDrawColor(150);
  doc.line(25, firmaY, 85, firmaY);
  doc.line(pageWidth - 85, firmaY, pageWidth - 25, firmaY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Firma y Sello Compras', 55, firmaY + 5, { align: 'center' });
  doc.text('Firma y Sello Proveedor', pageWidth - 55, firmaY + 5, { align: 'center' });

  // Info al pie
  doc.setFontSize(7);
  doc.setTextColor(128);
  const footerY = pageHeight - 10;
  doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, 15, footerY);
  if (data.createdByUser) {
    doc.text(`Creado por: ${data.createdByUser.name}`, pageWidth / 2, footerY, { align: 'center' });
  }
  doc.text(`Moneda: ${data.moneda}`, pageWidth - 15, footerY, { align: 'right' });

  // Devolver URL del blob
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}

// Función auxiliar para descargar directamente
export function downloadPurchaseOrderPDF(data: PurchaseOrderPDFData) {
  const pdfUrl = generatePurchaseOrderPDF(data);

  // Crear link y descargar
  const link = document.createElement('a');
  link.href = pdfUrl;
  link.download = `${data.numero}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Liberar memoria
  setTimeout(() => URL.revokeObjectURL(pdfUrl), 100);
}
