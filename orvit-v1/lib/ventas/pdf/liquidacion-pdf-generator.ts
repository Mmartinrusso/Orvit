import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export interface LiquidacionPDFData {
  liquidacion: any;
  company: any;
  seller: any;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export async function generateLiquidacionPDF(data: LiquidacionPDFData): Promise<Buffer> {
  const { liquidacion, company, seller } = data;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let currentY = 20;

  // Watermark según estado
  if (liquidacion.estado === 'BORRADOR') {
    doc.setFontSize(60);
    doc.setTextColor(200, 200, 200);
    doc.text('BORRADOR', pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 45,
    });
    doc.setTextColor(0, 0, 0);
  } else if (liquidacion.estado === 'ANULADA') {
    doc.setFontSize(60);
    doc.setTextColor(255, 0, 0, 0.3);
    doc.text('ANULADA', pageWidth / 2, pageHeight / 2, {
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
    currentY += 5;
  }

  // Título del documento
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('LIQUIDACION DE COMISIONES', pageWidth - 20, 20, { align: 'right' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`N° ${liquidacion.numero}`, pageWidth - 20, 27, { align: 'right' });

  // Estado
  const estadoColors: Record<string, number[]> = {
    BORRADOR: [156, 163, 175],
    CONFIRMADA: [59, 130, 246],
    PAGADA: [34, 197, 94],
    ANULADA: [239, 68, 68],
  };

  const estadoColor = estadoColors[liquidacion.estado] || [0, 0, 0];
  doc.setFillColor(...estadoColor);
  doc.rect(pageWidth - 55, 30, 35, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(liquidacion.estado, pageWidth - 37.5, 34.5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  currentY = Math.max(currentY, 45) + 5;

  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(20, currentY, pageWidth - 20, currentY);
  currentY += 10;

  // Información en dos columnas
  const col1X = 20;
  const col2X = pageWidth / 2 + 10;

  // Columna 1 - Datos del vendedor
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Vendedor', col1X, currentY);
  currentY += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  doc.text(seller.name || 'N/A', col1X, currentY);
  currentY += 5;
  if (seller.email) {
    doc.text(seller.email, col1X, currentY);
    currentY += 5;
  }

  // Columna 2 - Datos de la liquidación
  let currentY2 = currentY - 16;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Periodo', col2X, currentY2);
  currentY2 += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const fechaDesde = format(new Date(liquidacion.fechaDesde), 'dd/MM/yyyy', { locale: es });
  const fechaHasta = format(new Date(liquidacion.fechaHasta), 'dd/MM/yyyy', { locale: es });
  doc.text(`Desde: ${fechaDesde}`, col2X, currentY2);
  currentY2 += 5;
  doc.text(`Hasta: ${fechaHasta}`, col2X, currentY2);
  currentY2 += 5;
  doc.text(`Fecha emisión: ${format(new Date(liquidacion.createdAt), 'dd/MM/yyyy', { locale: es })}`, col2X, currentY2);

  currentY = Math.max(currentY, currentY2 + 5) + 10;

  // Resumen de comisión (recuadro destacado)
  doc.setFillColor(245, 247, 250);
  doc.rect(20, currentY, pageWidth - 40, 25, 'F');
  doc.setDrawColor(59, 130, 246);
  doc.rect(20, currentY, pageWidth - 40, 25, 'S');

  const boxY = currentY + 5;
  const colWidth = (pageWidth - 40) / 4;

  // Total Ventas
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Total Ventas', 25, boxY);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(formatCurrency(Number(liquidacion.totalVentas)), 25, boxY + 8);

  // Comisión %
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Comisión', 25 + colWidth, boxY);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`${Number(liquidacion.comisionPorcentaje)}%`, 25 + colWidth, boxY + 8);

  // Ajustes
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Ajustes', 25 + colWidth * 2, boxY);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const ajustes = Number(liquidacion.ajustes || 0);
  doc.setTextColor(ajustes >= 0 ? 0 : 239, ajustes >= 0 ? 0 : 68, ajustes >= 0 ? 0 : 68);
  doc.text(formatCurrency(ajustes), 25 + colWidth * 2, boxY + 8);

  // TOTAL A PAGAR
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('TOTAL A PAGAR', 25 + colWidth * 3, boxY);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text(formatCurrency(Number(liquidacion.totalLiquidacion)), 25 + colWidth * 3, boxY + 8);
  doc.setTextColor(0, 0, 0);

  currentY += 35;

  // Tabla de ventas incluidas
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalle de Ventas Incluidas', 20, currentY);
  currentY += 5;

  const itemsIncluidos = (liquidacion.items || []).filter((i: any) => i.incluido);
  const itemsExcluidos = (liquidacion.items || []).filter((i: any) => !i.incluido);

  if (itemsIncluidos.length > 0) {
    const tableData = itemsIncluidos.map((item: any) => [
      item.saleNumero,
      item.clienteNombre,
      format(new Date(item.fechaVenta), 'dd/MM/yyyy', { locale: es }),
      formatCurrency(Number(item.totalVenta)),
      formatCurrency(Number(item.comisionMonto)),
    ]);

    (doc as any).autoTable({
      startY: currentY,
      head: [['N° Orden', 'Cliente', 'Fecha', 'Total Venta', 'Comisión']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 25 },
        3: { cellWidth: 30, halign: 'right' as const },
        4: { cellWidth: 30, halign: 'right' as const, fontStyle: 'bold' },
      },
      margin: { left: 20, right: 20 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 5;

    // Desglose de costos por venta (si tiene items con breakdown)
    for (const item of itemsIncluidos) {
      if (!item.sale?.items) continue;
      const itemsConBreakdown = item.sale.items.filter(
        (si: any) => si.costBreakdown && si.costBreakdown.length > 0
      );
      if (itemsConBreakdown.length === 0) continue;

      // Verificar si necesitamos nueva página
      if (currentY > pageHeight - 60) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text(`Desglose - ${item.saleNumero}:`, 25, currentY);
      currentY += 4;

      const breakdownData: string[][] = [];
      for (const si of itemsConBreakdown) {
        for (const cb of si.costBreakdown) {
          breakdownData.push([
            si.descripcion,
            cb.concepto,
            formatCurrency(Number(cb.monto)),
          ]);
        }
      }

      (doc as any).autoTable({
        startY: currentY,
        head: [['Item', 'Concepto', 'Monto']],
        body: breakdownData,
        theme: 'plain',
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [100, 100, 100],
          fontStyle: 'bold',
          fontSize: 8,
        },
        bodyStyles: { fontSize: 8, textColor: [80, 80, 80] },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 40 },
          2: { cellWidth: 30, halign: 'right' as const },
        },
        margin: { left: 30, right: 30 },
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;
      doc.setTextColor(0, 0, 0);
    }
  }

  // Ventas excluidas (si las hay)
  if (itemsExcluidos.length > 0) {
    if (currentY > pageHeight - 40) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(150, 150, 150);
    doc.text('Ventas Excluidas', 20, currentY);
    currentY += 5;

    const excData = itemsExcluidos.map((item: any) => [
      item.saleNumero,
      item.clienteNombre,
      formatCurrency(Number(item.totalVenta)),
      item.motivoExclusion || '-',
    ]);

    (doc as any).autoTable({
      startY: currentY,
      head: [['N° Orden', 'Cliente', 'Total', 'Motivo Exclusión']],
      body: excData,
      theme: 'plain',
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [150, 150, 150],
        fontSize: 8,
      },
      bodyStyles: { fontSize: 8, textColor: [150, 150, 150] },
      margin: { left: 20, right: 20 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
    doc.setTextColor(0, 0, 0);
  }

  // Totales finales
  if (currentY > pageHeight - 60) {
    doc.addPage();
    currentY = 20;
  }

  currentY += 5;
  const totalesX = pageWidth - 80;
  const totalesWidth = 60;

  doc.setDrawColor(200, 200, 200);
  doc.line(totalesX, currentY, totalesX + totalesWidth, currentY);
  currentY += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Total Ventas:', totalesX, currentY);
  doc.text(formatCurrency(Number(liquidacion.totalVentas)), totalesX + totalesWidth, currentY, { align: 'right' });
  currentY += 6;

  doc.text(`Comisión (${Number(liquidacion.comisionPorcentaje)}%):`, totalesX, currentY);
  doc.text(formatCurrency(Number(liquidacion.totalComisiones)), totalesX + totalesWidth, currentY, { align: 'right' });
  currentY += 6;

  if (ajustes !== 0) {
    doc.text('Ajustes:', totalesX, currentY);
    doc.text(formatCurrency(ajustes), totalesX + totalesWidth, currentY, { align: 'right' });
    currentY += 6;
  }

  doc.setDrawColor(0, 0, 0);
  doc.line(totalesX, currentY, totalesX + totalesWidth, currentY);
  currentY += 6;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL A PAGAR:', totalesX, currentY);
  doc.text(formatCurrency(Number(liquidacion.totalLiquidacion)), totalesX + totalesWidth, currentY, { align: 'right' });

  // Info de pago (si fue pagada)
  if (liquidacion.estado === 'PAGADA' && liquidacion.pagadoAt) {
    currentY += 12;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(34, 197, 94);
    doc.text(
      `Pagado el ${format(new Date(liquidacion.pagadoAt), 'dd/MM/yyyy', { locale: es })}` +
        (liquidacion.medioPago ? ` - ${liquidacion.medioPago}` : '') +
        (liquidacion.referenciaPago ? ` (Ref: ${liquidacion.referenciaPago})` : ''),
      20,
      currentY
    );
    doc.setTextColor(0, 0, 0);
  }

  // Notas
  if (liquidacion.notas) {
    currentY += 12;
    if (currentY > pageHeight - 50) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Observaciones:', 20, currentY);
    currentY += 5;
    doc.setFont('helvetica', 'normal');
    const notasLines = doc.splitTextToSize(liquidacion.notas, pageWidth - 40);
    doc.text(notasLines, 20, currentY);
    currentY += notasLines.length * 5;
  }

  // Espacio para firmas
  const firmaY = pageHeight - 50;
  if (currentY < firmaY - 10) {
    doc.setDrawColor(0, 0, 0);

    // Firma del vendedor
    doc.line(30, firmaY, 90, firmaY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Firma del Vendedor', 60, firmaY + 5, { align: 'center' });
    doc.text(seller.name || '', 60, firmaY + 10, { align: 'center' });

    // Firma de la empresa
    doc.line(pageWidth - 90, firmaY, pageWidth - 30, firmaY);
    doc.text('Firma de la Empresa', pageWidth - 60, firmaY + 5, { align: 'center' });
    doc.text(company.name || '', pageWidth - 60, firmaY + 10, { align: 'center' });
  }

  // Footer
  const footerY = pageHeight - 15;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, footerY - 5, pageWidth - 20, footerY - 5);

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `${liquidacion.numero} - Generado el ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return pdfBuffer;
}
