import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export interface LoadOrderPDFData {
  loadOrder: any;
  sale: any;
  client: any;
  company: any;
  items: any[];
}

export async function generateLoadOrderPDF(data: LoadOrderPDFData): Promise<Buffer> {
  const { loadOrder, sale, client, company, items } = data;

  // Create PDF document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let currentY = 20;

  // Watermark based on status
  if (loadOrder.estado === 'CANCELADA') {
    doc.setFontSize(60);
    doc.setTextColor(255, 0, 0, 0.3);
    doc.text('CANCELADA', pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 45,
    });
    doc.setTextColor(0, 0, 0);
  } else if (loadOrder.estado === 'PENDIENTE') {
    doc.setFontSize(60);
    doc.setTextColor(200, 200, 200);
    doc.text('PENDIENTE', pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 45,
    });
    doc.setTextColor(0, 0, 0);
  }

  // ============================================================
  // HEADER - Company Information
  // ============================================================
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

  // Document title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEN DE CARGA', pageWidth - 20, 20, { align: 'right' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº ${loadOrder.numero}`, pageWidth - 20, 27, { align: 'right' });

  // Status badge
  const estadoColors: Record<string, number[]> = {
    PENDIENTE: [156, 163, 175],
    CARGANDO: [234, 179, 8],
    CARGADA: [59, 130, 246],
    DESPACHADA: [34, 197, 94],
    CANCELADA: [239, 68, 68],
  };

  const estadoColor = estadoColors[loadOrder.estado] || [0, 0, 0];
  doc.setFillColor(...estadoColor);
  doc.rect(pageWidth - 50, 30, 30, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(loadOrder.estado, pageWidth - 35, 34.5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  currentY += 10;

  // ============================================================
  // Separator Line
  // ============================================================
  doc.setDrawColor(200, 200, 200);
  doc.line(20, currentY, pageWidth - 20, currentY);
  currentY += 10;

  // ============================================================
  // CLIENT INFORMATION
  // ============================================================
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Datos del Cliente', 20, currentY);
  currentY += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  if (client.legalName || client.name) {
    doc.text(`Razón Social: ${client.legalName || client.name}`, 20, currentY);
    currentY += 5;
  }

  if (client.cuit) {
    doc.text(`CUIT: ${client.cuit}`, 20, currentY);
    currentY += 5;
  }

  if (client.address) {
    doc.text(`Dirección: ${client.address}`, 20, currentY);
    currentY += 5;
  }

  currentY += 5;

  // ============================================================
  // LOAD ORDER DETAILS
  // ============================================================
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalles de la Carga', 20, currentY);
  currentY += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Sale reference
  if (sale?.numero) {
    doc.text(`Orden de Venta: ${sale.numero}`, 20, currentY);
    currentY += 5;
  }

  // Date
  if (loadOrder.fecha) {
    const fecha = format(new Date(loadOrder.fecha), 'dd/MM/yyyy', { locale: es });
    doc.text(`Fecha: ${fecha}`, 20, currentY);
    currentY += 5;
  }

  // Vehicle
  if (loadOrder.vehiculo) {
    doc.text(`Vehículo: ${loadOrder.vehiculo}`, 20, currentY);
    if (loadOrder.vehiculoPatente) {
      doc.text(` - Patente: ${loadOrder.vehiculoPatente}`, 65, currentY);
    }
    currentY += 5;
  }

  // Driver
  if (loadOrder.chofer) {
    doc.text(`Chofer: ${loadOrder.chofer}`, 20, currentY);
    if (loadOrder.choferDNI) {
      doc.text(` - DNI: ${loadOrder.choferDNI}`, 65, currentY);
    }
    currentY += 5;
  }

  // Weight & Volume
  if (loadOrder.pesoTotal || loadOrder.volumenTotal) {
    if (loadOrder.pesoTotal) {
      doc.text(`Peso Total: ${loadOrder.pesoTotal} kg`, 20, currentY);
      currentY += 5;
    }
    if (loadOrder.volumenTotal) {
      doc.text(`Volumen Total: ${loadOrder.volumenTotal} m³`, 20, currentY);
      currentY += 5;
    }
  }

  currentY += 5;

  // ============================================================
  // ITEMS TABLE
  // ============================================================
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Items a Cargar', 20, currentY);
  currentY += 7;

  const isConfirmed = ['CARGADA', 'DESPACHADA'].includes(loadOrder.estado);

  const tableData = items.map((item) => {
    const row = [
      item.secuencia || '-',
      item.product?.codigo || '-',
      item.product?.name || 'Sin descripción',
      item.cantidad.toString(),
    ];

    if (isConfirmed) {
      row.push(item.cantidadCargada?.toString() || '-');
    }

    row.push(item.posicion || '-');

    return row;
  });

  const headers = ['Sec', 'Código', 'Producto', 'Cant'];
  if (isConfirmed) {
    headers.push('Cargada');
  }
  headers.push('Posición');

  autoTable(doc, {
    startY: currentY,
    head: [headers],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontSize: 10,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 25 },
      2: { cellWidth: isConfirmed ? 70 : 85 },
      3: { cellWidth: 20, halign: 'center' },
      ...(isConfirmed ? { 4: { cellWidth: 25, halign: 'center' } } : {}),
      [isConfirmed ? 5 : 4]: { cellWidth: 25, halign: 'center' },
    },
    margin: { left: 20, right: 20 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // ============================================================
  // CONFIRMATION INFO
  // ============================================================
  if (loadOrder.confirmadoAt) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Confirmación de Carga', 20, currentY);
    currentY += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Confirmada: ${format(new Date(loadOrder.confirmadoAt), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}`,
      20,
      currentY
    );
    currentY += 5;

    if (loadOrder.confirmedBy) {
      doc.text(`Confirmado por: ${loadOrder.confirmedBy.name}`, 20, currentY);
      currentY += 5;
    }

    // Signature section
    if (loadOrder.firmaOperario) {
      currentY += 5;
      try {
        doc.addImage(loadOrder.firmaOperario, 'PNG', 20, currentY, 60, 20);
        currentY += 25;
        doc.text('Firma del Operario', 20, currentY);
      } catch (error) {
        console.error('Error adding signature to PDF:', error);
      }
    }
  }

  // ============================================================
  // OBSERVATIONS
  // ============================================================
  if (loadOrder.observaciones) {
    currentY += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Observaciones', 20, currentY);
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const notesLines = doc.splitTextToSize(loadOrder.observaciones, pageWidth - 40);
    doc.text(notesLines, 20, currentY);
    currentY += notesLines.length * 4;
  }

  // ============================================================
  // FOOTER
  // ============================================================
  currentY = pageHeight - 30;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, currentY, pageWidth - 20, currentY);
  currentY += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Documento generado el ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}`,
    20,
    currentY
  );

  doc.text('Página 1 de 1', pageWidth - 20, currentY, { align: 'right' });

  currentY += 5;
  doc.text(
    'Este documento constituye una orden de carga para el transporte de mercadería.',
    pageWidth / 2,
    currentY,
    { align: 'center' }
  );

  // Generate buffer
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return pdfBuffer;
}
