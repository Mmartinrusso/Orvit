import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';

// Extender jsPDF para autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

type PaymentOrderCheque = {
  tipo?: string;
  numero?: string;
  banco?: string | null;
  titular?: string | null;
  fechaVencimiento?: string | Date | null;
  importe?: number | string | null;
};

type PaymentOrderReceipt = {
  receipt?: {
    numeroSerie?: string;
    numeroFactura?: string;
    total?: number | string | null;
    tipo?: string | null;
    logo?: string | null;
    logoLight?: string | null;
    logoDark?: string | null;
  } | null;
  montoAplicado?: number | string | null;
};

type PaymentOrderAttachment = {
  id?: number;
  fileName?: string;
  fileUrl?: string;
  fileType?: string;
};

export interface PaymentOrderPDFData {
  id: number | string;
  fechaPago: string | Date;
  totalPago: number | string;
  anticipo?: number | string | null;
  efectivo?: number | string | null;
  dolares?: number | string | null;
  transferencia?: number | string | null;
  chequesTerceros?: number | string | null;
  chequesPropios?: number | string | null;
  retIVA?: number | string | null;
  retGanancias?: number | string | null;
  retIngBrutos?: number | string | null;
  notas?: string | null;
  company?: {
    name?: string | null;
    cuit?: string | null;
    address?: string | null;
    phone?: string | null;
  } | null;
  proveedor?: {
    razonSocial?: string | null;
    codigo?: string | null;
    cuit?: string | null;
    banco?: string | null;
    tipoCuenta?: string | null;
    numeroCuenta?: string | null;
    cbu?: string | null;
    aliasCbu?: string | null;
  } | null;
  recibos?: PaymentOrderReceipt[];
  cheques?: PaymentOrderCheque[];
  attachments?: PaymentOrderAttachment[];
}

const currency = (value: any): string => {
  const n = Number(value || 0);
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(n);
};

const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-AR');
};

const getPrefijoComprobante = (tipoCompleto?: string | null): string => {
  if (!tipoCompleto) return '';
  const t = tipoCompleto.toLowerCase();
  if (t.includes('factura a')) return 'FCA-';
  if (t.includes('factura b')) return 'FCB-';
  if (t.includes('factura c')) return 'FCC-';
  return '';
};

// Helper para cargar imagen como base64 (usa proxy para evitar CORS)
const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    // Usar proxy para evitar CORS con S3
    const isS3Url = url.includes('s3.') && url.includes('amazonaws.com');
    const fetchUrl = isS3Url
      ? `/api/proxy-file?url=${encodeURIComponent(url)}`
      : url;

    const response = await fetch(fetchUrl);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

// Helper para obtener dimensiones de imagen
const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = base64;
  });
};

// Helper para cargar PDF desde URL como ArrayBuffer (usa proxy para evitar CORS)
const loadPdfFromUrl = async (url: string): Promise<ArrayBuffer | null> => {
  try {
    // Usar proxy para evitar CORS con S3
    const isS3Url = url.includes('s3.') && url.includes('amazonaws.com');
    const fetchUrl = isS3Url
      ? `/api/proxy-file?url=${encodeURIComponent(url)}`
      : url;

    const response = await fetch(fetchUrl);
    if (!response.ok) {
      console.error(`Error fetching PDF: ${response.status} ${response.statusText}`);
      return null;
    }
    return await response.arrayBuffer();
  } catch (err) {
    console.error('Error loading PDF from URL:', err);
    return null;
  }
};

export async function generatePaymentOrderPDF(data: PaymentOrderPDFData): Promise<string> {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 15;

  // Encabezado empresa (solo texto por ahora; logo externo puede dar problemas de CORS)
  const companyName = data.company?.name || 'Empresa';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);

  doc.text(companyName, pageWidth / 2, y + 3, { align: 'center' });
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (data.company?.address) {
    doc.text(String(data.company.address), pageWidth / 2, y, { align: 'center' });
    y += 5;
  }
  if (data.company?.phone) {
    doc.text(`Tel: ${data.company.phone}`, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }
  if (data.company?.cuit) {
    doc.text(`CUIT: ${data.company.cuit}`, pageWidth / 2, y, { align: 'center' });
    y += 6;
  }

  // Línea divisoria entre encabezado de empresa y datos de orden/proveedor
  y += 3;
  doc.setDrawColor(0);
  doc.line(15, y, pageWidth - 15, y);
  y += 4;

  // Título y datos generales
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ORDEN DE PAGO - COMPRAS', 15, y);

  doc.setFontSize(9);
  let rightY = y;
  doc.text(`N° Orden: ${data.id}`, pageWidth - 15, rightY, { align: 'right' });
  rightY += 4;
  doc.text(`Fecha: ${formatDate(data.fechaPago)}`, pageWidth - 15, rightY, {
    align: 'right',
  });
  rightY += 4;
  if (data.proveedor?.cuit) {
    doc.text(`CUIT Prov.: ${data.proveedor.cuit}`, pageWidth - 15, rightY, {
      align: 'right',
    });
  }

  y += 6;
  doc.setFont('helvetica', 'normal');
  // Mostrar solo la razón social del proveedor (sin el código/ID)
  const proveedorLinea = `Proveedor: ${data.proveedor?.razonSocial || ''}`;
  doc.text(proveedorLinea.trim(), 15, y);
  y += 6;

  // Facturas asociadas
  if (data.recibos && data.recibos.length > 0) {
    const facturasBody = data.recibos.map((r) => {
      const rec = r.receipt;
      const numero = rec
        ? `${getPrefijoComprobante(rec.tipo)}${rec.numeroSerie || ''}-${rec.numeroFactura || ''}`
        : '-';
      return [
        numero,
        currency(rec?.total ?? 0),
        currency(r.montoAplicado ?? 0),
      ];
    });

    (doc as any).autoTable({
      startY: y,
      head: [['Factura', 'Total factura', 'Monto aplicado']],
      body: facturasBody,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [240, 240, 240], textColor: 0 },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'right' },
        2: { halign: 'right' },
      },
      margin: { left: 15, right: 15 },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Datos bancarios del proveedor (si existen)
  const tieneDatosBancarios =
    data.proveedor?.banco ||
    data.proveedor?.tipoCuenta ||
    data.proveedor?.numeroCuenta ||
    data.proveedor?.cbu ||
    data.proveedor?.aliasCbu;

  if (tieneDatosBancarios) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Datos bancarios del proveedor', 15, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    const lineas: string[] = [];
    if (data.proveedor?.banco) lineas.push(`Banco: ${data.proveedor.banco}`);
    if (data.proveedor?.tipoCuenta) lineas.push(`Tipo de cuenta: ${data.proveedor.tipoCuenta}`);
    if (data.proveedor?.numeroCuenta) {
      lineas.push(`Número de cuenta: ${data.proveedor.numeroCuenta}`);
    }
    if (data.proveedor?.cbu) lineas.push(`CBU: ${data.proveedor.cbu}`);
    if (data.proveedor?.aliasCbu) lineas.push(`Alias CBU: ${data.proveedor.aliasCbu}`);

    lineas.forEach((l) => {
      doc.text(l, 17, y);
      y += 4;
    });
    y += 2;
  }

  // Detalle de pago (debajo de facturas/datos bancarios, antes de cheques)
  const medios: { label: string; value: any }[] = [
    { label: 'Efectivo', value: data.efectivo },
    { label: 'Dólares', value: data.dolares },
    { label: 'Transferencia', value: data.transferencia },
    { label: 'Ch. Terceros', value: data.chequesTerceros },
    { label: 'Ch. Propios', value: data.chequesPropios },
    { label: 'Ret. IVA', value: data.retIVA },
    { label: 'Ret. Ganancias', value: data.retGanancias },
    { label: 'Ret. ING.BRU.', value: data.retIngBrutos },
  ].filter((m) => Number(m.value || 0) > 0);

  const totalPagoNumber = Number(data.totalPago || 0);
  const anticipoNumber = Number(data.anticipo || 0);

  if (medios.length > 0) {
    const body = medios.map((m) => [m.label, currency(m.value)]);
    (doc as any).autoTable({
      startY: y,
      head: [['Detalle de pago', 'Importe']],
      body,
      theme: 'grid',
      styles: { fontSize: 9, halign: 'right' },
      headStyles: { fillColor: [240, 240, 240], textColor: 0, halign: 'center' },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'right' },
      },
      margin: { left: 15, right: 15 },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 4;

    // Total pagado (y anticipo) inmediatamente debajo de la tabla de detalle de pago
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    let totalLinea = `Total pagado: ${currency(totalPagoNumber)}`;
    if (anticipoNumber > 0) {
      totalLinea += `   |   Anticipo generado: ${currency(anticipoNumber)}`;
    }
    doc.text(totalLinea, pageWidth - 15, y, { align: 'right' });
    y += 6;
  }

  // Cheques enviados
  if (data.cheques && data.cheques.length > 0) {
    const chequesBody = data.cheques.map((c) => [
      c.tipo === 'ECHEQ' ? 'eCheq' : 'Cheque',
      c.numero || '',
      c.banco || '',
      c.titular || '',
      formatDate(c.fechaVencimiento || null),
      currency(c.importe ?? 0),
    ]);

    (doc as any).autoTable({
      startY: y,
      head: [['Tipo', 'Número', 'Banco', 'Titular', 'Vencimiento', 'Importe']],
      body: chequesBody,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [240, 240, 240], textColor: 0 },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'left' },
        2: { halign: 'left' },
        3: { halign: 'left' },
        4: { halign: 'center' },
        5: { halign: 'right' },
      },
      margin: { left: 15, right: 15 },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Notas
  if (data.notas) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Notas:', 15, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    const textLines = doc.splitTextToSize(data.notas, pageWidth - 30);
    doc.text(textLines, 15, y);
    y += textLines.length * 4 + 4;
  }

  // Agregar imágenes adjuntas como páginas adicionales (dentro del mismo PDF jsPDF)
  if (data.attachments && data.attachments.length > 0) {
    const imageAttachments = data.attachments.filter(att => {
      const isImage = att.fileType?.startsWith('image/') ||
        att.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
      return isImage && att.fileUrl;
    });

    for (let i = 0; i < imageAttachments.length; i++) {
      const att = imageAttachments[i];
      try {
        const base64 = await loadImageAsBase64(att.fileUrl!);
        if (base64) {
          // Nueva página para el comprobante
          doc.addPage();

          // Título de la página
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.text(`Comprobante (imagen) ${i + 1} de ${imageAttachments.length}`, pageWidth / 2, 15, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text(att.fileName || 'Comprobante', pageWidth / 2, 22, { align: 'center' });

          // Obtener dimensiones y calcular escala
          const dims = await getImageDimensions(base64);
          if (dims.width > 0 && dims.height > 0) {
            const maxWidth = pageWidth - 30;
            const maxHeight = pageHeight - 50;
            let imgWidth = dims.width;
            let imgHeight = dims.height;

            // Escalar para que quepa en la página
            const scaleW = maxWidth / imgWidth;
            const scaleH = maxHeight / imgHeight;
            const scale = Math.min(scaleW, scaleH, 1);

            imgWidth *= scale;
            imgHeight *= scale;

            // Centrar imagen
            const imgX = (pageWidth - imgWidth) / 2;
            const imgY = 30;

            // Determinar formato
            const format = att.fileType?.includes('png') ? 'PNG' : 'JPEG';
            doc.addImage(base64, format, imgX, imgY, imgWidth, imgHeight);
          }
        }
      } catch (err) {
        console.error('Error agregando imagen al PDF:', err);
      }
    }
  }

  // Firma al pie (solo en la primera página)
  doc.setPage(1);
  const firmaY = pageHeight - 20;

  doc.setFontSize(9);
  doc.text('____________________________________', pageWidth / 2, firmaY, {
    align: 'center',
  });
  doc.text('Firma y Sello', pageWidth / 2, firmaY + 5, { align: 'center' });

  // Convertir jsPDF a ArrayBuffer para poder usar pdf-lib
  const jsPdfArrayBuffer = doc.output('arraybuffer');

  // Obtener PDFs adjuntos
  const pdfAttachments = (data.attachments || []).filter(att => {
    const isPdf = att.fileType?.includes('pdf') || att.fileName?.toLowerCase().endsWith('.pdf');
    return isPdf && att.fileUrl;
  });

  // Si no hay PDFs adjuntos, devolver el PDF de jsPDF directamente
  if (pdfAttachments.length === 0) {
    const blob = new Blob([jsPdfArrayBuffer], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  }

  // Si hay PDFs adjuntos, usar pdf-lib para combinarlos
  try {
    // Cargar el PDF base generado con jsPDF
    const mergedPdf = await PDFDocument.load(jsPdfArrayBuffer);

    // Agregar cada PDF adjunto
    for (let i = 0; i < pdfAttachments.length; i++) {
      const att = pdfAttachments[i];
      try {
        console.log(`Cargando PDF adjunto ${i + 1}/${pdfAttachments.length}: ${att.fileName}`);
        const pdfBytes = await loadPdfFromUrl(att.fileUrl!);

        if (pdfBytes) {
          const attachmentPdf = await PDFDocument.load(pdfBytes);
          const copiedPages = await mergedPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices());

          // Agregar todas las páginas del PDF adjunto
          copiedPages.forEach((page) => {
            mergedPdf.addPage(page);
          });

          console.log(`PDF adjunto "${att.fileName}" agregado (${copiedPages.length} páginas)`);
        } else {
          console.warn(`No se pudo cargar el PDF: ${att.fileName}`);
        }
      } catch (err) {
        console.error(`Error agregando PDF adjunto "${att.fileName}":`, err);
      }
    }

    // Generar el PDF final combinado
    const mergedPdfBytes = await mergedPdf.save();
    const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
    return URL.createObjectURL(blob);

  } catch (err) {
    console.error('Error combinando PDFs:', err);
    // Si falla la combinación, devolver al menos el PDF base
    const blob = new Blob([jsPdfArrayBuffer], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  }
}
