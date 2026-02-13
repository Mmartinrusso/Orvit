import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export interface DeliveryPODData {
  delivery: any;
  sale: any;
  client: any;
  company: any;
  items: any[];
}

export async function generateDeliveryPOD(data: DeliveryPODData): Promise<Buffer> {
  const { delivery, sale, client, company, items } = data;

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
  if (delivery.estado === 'ENTREGA_FALLIDA') {
    doc.setFontSize(60);
    doc.setTextColor(255, 0, 0, 0.3);
    doc.text('FALLIDA', pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 45,
    });
    doc.setTextColor(0, 0, 0);
  } else if (delivery.estado === 'CANCELADA') {
    doc.setFontSize(60);
    doc.setTextColor(200, 200, 200);
    doc.text('CANCELADA', pageWidth / 2, pageHeight / 2, {
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

  // Título del documento
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROBANTE DE ENTREGA', pageWidth - 20, 20, { align: 'right' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº ${delivery.numero}`, pageWidth - 20, 27, { align: 'right' });

  // Estado
  const estadoColors: Record<string, number[]> = {
    PENDIENTE: [156, 163, 175],
    EN_PREPARACION: [234, 179, 8],
    LISTA_PARA_DESPACHO: [59, 130, 246],
    EN_TRANSITO: [147, 51, 234],
    RETIRADA: [6, 182, 212],
    ENTREGADA: [34, 197, 94],
    ENTREGA_FALLIDA: [239, 68, 68],
    PARCIAL: [251, 146, 60],
    CANCELADA: [156, 163, 175],
  };

  const estadoColor = estadoColors[delivery.estado] || [0, 0, 0];
  doc.setFillColor(...estadoColor);
  doc.rect(pageWidth - 50, 30, 30, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(delivery.estado, pageWidth - 35, 34.5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  currentY += 10;

  // ============================================================
  // Línea separadora
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

  if (client.phone) {
    doc.text(`Teléfono: ${client.phone}`, 20, currentY);
    currentY += 5;
  }

  currentY += 5;

  // ============================================================
  // DELIVERY DETAILS
  // ============================================================
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalles de la Entrega', 20, currentY);
  currentY += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Orden de Venta
  if (sale?.numero) {
    doc.text(`Orden de Venta: ${sale.numero}`, 20, currentY);
    currentY += 5;
  }

  // Tipo de entrega
  doc.text(`Tipo: ${delivery.tipo === 'RETIRO' ? 'Retiro en local' : 'Envío a domicilio'}`, 20, currentY);
  currentY += 5;

  // Fecha Programada
  if (delivery.fechaProgramada) {
    const fechaProg = format(new Date(delivery.fechaProgramada), "dd/MM/yyyy 'a las' HH:mm", { locale: es });
    doc.text(`Fecha Programada: ${fechaProg}`, 20, currentY);
    currentY += 5;
  }

  // Fecha de Entrega
  if (delivery.fechaEntrega) {
    const fechaEnt = format(new Date(delivery.fechaEntrega), "dd/MM/yyyy 'a las' HH:mm", { locale: es });
    doc.text(`Fecha de Entrega: ${fechaEnt}`, 20, currentY);
    currentY += 5;
  }

  // Dirección de Entrega
  if (delivery.direccionEntrega) {
    doc.text(`Dirección: ${delivery.direccionEntrega}`, 20, currentY);
    currentY += 5;
  }

  // Transportista/Conductor/Vehículo
  if (delivery.transportista) {
    doc.text(`Transportista: ${delivery.transportista}`, 20, currentY);
    currentY += 5;
  }

  if (delivery.conductorNombre) {
    doc.text(`Conductor: ${delivery.conductorNombre}`, 20, currentY);
    if (delivery.conductorDNI) {
      doc.text(` - DNI: ${delivery.conductorDNI}`, 65, currentY);
    }
    currentY += 5;
  }

  if (delivery.vehiculo) {
    doc.text(`Vehículo: ${delivery.vehiculo}`, 20, currentY);
    currentY += 5;
  }

  currentY += 5;

  // ============================================================
  // ITEMS TABLE
  // ============================================================
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Productos Entregados', 20, currentY);
  currentY += 7;

  const tableData = items.map((item) => [
    item.product?.codigo || '-',
    item.product?.name || item.descripcion || 'Sin descripción',
    item.cantidad.toString(),
    item.saleItem?.unidadMedida || '-',
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Código', 'Producto', 'Cantidad', 'Unidad']],
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
      0: { cellWidth: 30 },
      1: { cellWidth: 90 },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 25, halign: 'center' },
    },
    margin: { left: 20, right: 20 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // ============================================================
  // RECIPIENT INFORMATION (if delivered)
  // ============================================================
  if (delivery.estado === 'ENTREGADA' || delivery.estado === 'RETIRADA') {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Recibido Por', 20, currentY);
    currentY += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    if (delivery.recibeNombre) {
      doc.text(`Nombre: ${delivery.recibeNombre}`, 20, currentY);
      currentY += 5;
    }

    if (delivery.recibeDNI) {
      doc.text(`DNI: ${delivery.recibeDNI}`, 20, currentY);
      currentY += 5;
    }

    // Signature section
    currentY += 5;
    doc.setDrawColor(0, 0, 0);
    doc.line(20, currentY, 90, currentY); // Signature line
    currentY += 5;
    doc.setFontSize(9);
    doc.text('Firma y Aclaración', 20, currentY);

    // If signature image exists, embed it
    if (delivery.firmaRecepcion) {
      try {
        // Position signature above the line
        const signatureY = currentY - 25;
        doc.addImage(delivery.firmaRecepcion, 'PNG', 20, signatureY, 60, 20);
      } catch (error) {
        console.error('Error adding signature to PDF:', error);
      }
    }
  }

  // ============================================================
  // GPS COORDINATES (if available)
  // ============================================================
  currentY += 10;

  if (delivery.latitudEntrega && delivery.longitudEntrega) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Coordenadas GPS: ${Number(delivery.latitudEntrega).toFixed(6)}, ${Number(delivery.longitudEntrega).toFixed(6)}`,
      20,
      currentY
    );
    currentY += 5;
  }

  // ============================================================
  // NOTES (if any)
  // ============================================================
  if (delivery.notas) {
    currentY += 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Observaciones', 20, currentY);
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const notesLines = doc.splitTextToSize(delivery.notas, pageWidth - 40);
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
    'Este documento constituye comprobante de entrega de mercadería.',
    pageWidth / 2,
    currentY,
    { align: 'center' }
  );

  // Generar buffer
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return pdfBuffer;
}
