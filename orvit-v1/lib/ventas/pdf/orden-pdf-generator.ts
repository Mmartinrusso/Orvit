import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export interface OrdenPDFData {
  orden: any;
  company: any;
  client: any;
}

export async function generateOrdenPDF(data: OrdenPDFData): Promise<Buffer> {
  const { orden, company, client } = data;

  // Crear documento PDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let currentY = 20;

  // Watermark según estado
  if (orden.estado === 'BORRADOR') {
    doc.setFontSize(60);
    doc.setTextColor(200, 200, 200);
    doc.text('BORRADOR', pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 45,
    });
    doc.setTextColor(0, 0, 0);
  } else if (orden.estado === 'CANCELADA') {
    doc.setFontSize(60);
    doc.setTextColor(255, 0, 0, 0.3);
    doc.text('CANCELADA', pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 45,
    });
    doc.setTextColor(0, 0, 0);
  }

  // Header - Logo y datos de empresa
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(company.name || 'Empresa', 20, currentY);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  currentY += 7;

  if (company.address) {
    doc.text(company.address, 20, currentY);
    currentY += 5;
  }

  if (company.phone || company.email) {
    const contactInfo = [company.phone, company.email].filter(Boolean).join(' | ');
    doc.text(contactInfo, 20, currentY);
    currentY += 5;
  }

  if (company.cuit) {
    doc.text(`CUIT: ${company.cuit}`, 20, currentY);
    currentY += 10;
  }

  // Título del documento
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEN DE VENTA', pageWidth - 20, 20, { align: 'right' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº ${orden.numero}`, pageWidth - 20, 27, { align: 'right' });

  // Estado
  const estadoColors: Record<string, number[]> = {
    BORRADOR: [156, 163, 175],
    CONFIRMADA: [59, 130, 246],
    EN_PREPARACION: [234, 179, 8],
    ENTREGADA: [34, 197, 94],
    FACTURADA: [99, 102, 241],
    COMPLETADA: [20, 184, 166],
    CANCELADA: [239, 68, 68],
  };

  const estadoColor = estadoColors[orden.estado] || [0, 0, 0];
  doc.setFillColor(...estadoColor);
  doc.rect(pageWidth - 50, 30, 30, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(orden.estado, pageWidth - 35, 34.5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  currentY += 10;

  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(20, currentY, pageWidth - 20, currentY);
  currentY += 10;

  // Información de la orden y cliente (dos columnas)
  const col1X = 20;
  const col2X = pageWidth / 2 + 10;

  // Columna 1 - Datos de la orden
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Datos de la Orden', col1X, currentY);
  currentY += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const ordenInfo = [
    `Fecha de Emisión: ${format(new Date(orden.fechaEmision), 'dd/MM/yyyy', { locale: es })}`,
    orden.fechaEntregaEstimada
      ? `Entrega Estimada: ${format(new Date(orden.fechaEntregaEstimada), 'dd/MM/yyyy', { locale: es })}`
      : null,
    orden.condicionesPago ? `Condiciones de Pago: ${orden.condicionesPago}` : null,
    orden.diasPlazo ? `Plazo: ${orden.diasPlazo} días` : null,
  ].filter(Boolean);

  ordenInfo.forEach((info) => {
    doc.text(info!, col1X, currentY);
    currentY += 5;
  });

  // Columna 2 - Datos del cliente
  let currentY2 = currentY - (ordenInfo.length * 5) - 6;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente', col2X, currentY2);
  currentY2 += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const clientInfo = [
    client.legalName || client.name,
    client.cuit ? `CUIT: ${client.cuit}` : null,
    client.address || null,
    client.city ? `${client.city}${client.province ? `, ${client.province}` : ''}` : null,
    client.phone || client.email || null,
  ].filter(Boolean);

  clientInfo.forEach((info) => {
    doc.text(info!, col2X, currentY2);
    currentY2 += 5;
  });

  currentY = Math.max(currentY, currentY2) + 10;

  // Lugar de entrega (si es diferente)
  if (orden.lugarEntrega) {
    doc.setFont('helvetica', 'bold');
    doc.text('Lugar de Entrega:', col1X, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(orden.lugarEntrega, col1X + 35, currentY);
    currentY += 10;
  }

  // Tabla de items
  const tableData = orden.items.map((item: any) => {
    const subtotal = Number(item.cantidad) * Number(item.precioUnitario);
    const descuento = subtotal * (Number(item.descuento) / 100);
    const total = subtotal - descuento;

    return [
      item.codigo || '-',
      item.descripcion + (item.notas ? `\n${item.notas}` : ''),
      `${Number(item.cantidad)} ${item.unidad}`,
      `$${Number(item.precioUnitario).toFixed(2)}`,
      Number(item.descuento) > 0 ? `${Number(item.descuento)}%` : '-',
      `$${total.toFixed(2)}`,
    ];
  });

  (doc as any).autoTable({
    startY: currentY,
    head: [['Código', 'Descripción', 'Cantidad', 'Precio Unit.', 'Desc.', 'Subtotal']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 20, right: 20 },
  });

  // Obtener posición Y después de la tabla
  currentY = (doc as any).lastAutoTable.finalY + 10;

  // Totales (columna derecha)
  const totalesX = pageWidth - 70;
  const totalesWidth = 50;

  doc.setFontSize(10);

  // Subtotal sin descuento
  const subtotalSinDescuento = Number(orden.subtotal) + Number(orden.descuentoMonto || 0);
  doc.text('Subtotal:', totalesX, currentY);
  doc.text(`$${subtotalSinDescuento.toFixed(2)}`, totalesX + totalesWidth, currentY, { align: 'right' });
  currentY += 6;

  // Descuento global
  if (Number(orden.descuentoGlobal) > 0) {
    doc.setTextColor(200, 120, 0);
    doc.text(`Descuento (${orden.descuentoGlobal}%):`, totalesX, currentY);
    doc.text(`-$${Number(orden.descuentoMonto || 0).toFixed(2)}`, totalesX + totalesWidth, currentY, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    currentY += 6;
  }

  // Subtotal con descuento
  doc.text('Subtotal:', totalesX, currentY);
  doc.text(`$${Number(orden.subtotal).toFixed(2)}`, totalesX + totalesWidth, currentY, { align: 'right' });
  currentY += 6;

  // IVA
  if (Number(orden.impuestos) > 0) {
    doc.text(`IVA (${orden.tasaIva}%):`, totalesX, currentY);
    doc.text(`$${Number(orden.impuestos).toFixed(2)}`, totalesX + totalesWidth, currentY, { align: 'right' });
    currentY += 6;
  }

  // Línea separadora
  doc.setDrawColor(0, 0, 0);
  doc.line(totalesX, currentY, totalesX + totalesWidth, currentY);
  currentY += 6;

  // Total
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', totalesX, currentY);
  doc.text(`${orden.moneda} $${Number(orden.total).toFixed(2)}`, totalesX + totalesWidth, currentY, { align: 'right' });

  currentY += 15;

  // Notas
  if (orden.notas) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Observaciones:', 20, currentY);
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    const notasLines = doc.splitTextToSize(orden.notas, pageWidth - 40);
    doc.text(notasLines, 20, currentY);
    currentY += notasLines.length * 5 + 10;
  }

  // Footer
  const footerY = pageHeight - 30;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, footerY, pageWidth - 20, footerY);

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Este documento fue generado electrónicamente y es válido sin firma.', pageWidth / 2, footerY + 5, { align: 'center' });
  doc.text(`Generado el ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`, pageWidth / 2, footerY + 10, { align: 'center' });

  // Convertir a buffer
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return pdfBuffer;
}
