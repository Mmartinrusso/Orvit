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

export interface FacturaEstadoCuenta {
  numero: string;
  fecha: string | Date;
  tipo: string;
  total: number;
  saldo: number;
  vencimiento?: string | Date | null;
  estado: string;
}

export interface PagoEstadoCuenta {
  fecha: string | Date;
  monto: number;
  metodo: string;
  facturaNumero?: string;
  observaciones?: string;
}

export interface AccountStatementPDFData {
  proveedor: {
    nombre: string;
    razonSocial?: string;
    cuit?: string;
    direccion?: string;
    telefono?: string;
    email?: string;
  };
  company?: {
    name?: string;
    cuit?: string;
    address?: string;
    phone?: string;
  };
  fechaDesde?: string;
  fechaHasta?: string;
  facturas: FacturaEstadoCuenta[];
  pagos: PagoEstadoCuenta[];
  resumen: {
    totalFacturado: number;
    totalPagado: number;
    saldoTotal: number;
    facturasVencidas: number;
    montoVencido: number;
  };
}

const currency = (value: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(value);
};

const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-AR');
};

export function generateAccountStatementPDF(data: AccountStatementPDFData): string {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Título
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ESTADO DE CUENTA', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Fecha de emisión
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha de emisión: ${formatDate(new Date())}`, pageWidth - 15, y, { align: 'right' });
  y += 8;

  // Datos del proveedor
  doc.setFillColor(240, 240, 240);
  doc.rect(15, y, pageWidth - 30, 28, 'F');
  y += 5;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PROVEEDOR', 20, y);
  y += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(data.proveedor.nombre, 20, y);
  y += 4;

  if (data.proveedor.razonSocial && data.proveedor.razonSocial !== data.proveedor.nombre) {
    doc.setFontSize(9);
    doc.text(`Razón Social: ${data.proveedor.razonSocial}`, 20, y);
    y += 4;
  }

  if (data.proveedor.cuit) {
    doc.text(`CUIT: ${data.proveedor.cuit}`, 20, y);
    y += 4;
  }

  if (data.proveedor.direccion) {
    doc.text(`Dirección: ${data.proveedor.direccion}`, 20, y);
  }

  y += 12;

  // Período del estado de cuenta
  if (data.fechaDesde || data.fechaHasta) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    const periodo = data.fechaDesde && data.fechaHasta
      ? `Período: ${formatDate(data.fechaDesde)} al ${formatDate(data.fechaHasta)}`
      : data.fechaDesde
        ? `Desde: ${formatDate(data.fechaDesde)}`
        : `Hasta: ${formatDate(data.fechaHasta)}`;
    doc.text(periodo, 15, y);
    y += 8;
  }

  // Resumen
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMEN', 15, y);
  y += 6;

  const resumenData = [
    ['Total Facturado', currency(data.resumen.totalFacturado)],
    ['Total Pagado', currency(data.resumen.totalPagado)],
    ['Saldo Pendiente', currency(data.resumen.saldoTotal)],
  ];

  if (data.resumen.facturasVencidas > 0) {
    resumenData.push(['Facturas Vencidas', `${data.resumen.facturasVencidas} (${currency(data.resumen.montoVencido)})`]);
  }

  doc.autoTable({
    startY: y,
    head: [],
    body: resumenData,
    theme: 'plain',
    styles: { fontSize: 9 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { halign: 'right', cellWidth: 50 },
    },
    margin: { left: 15, right: pageWidth - 115 },
  });

  y = doc.lastAutoTable.finalY + 10;

  // Tabla de Facturas
  if (data.facturas.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURAS', 15, y);
    y += 2;

    doc.autoTable({
      startY: y,
      head: [['Número', 'Fecha', 'Tipo', 'Total', 'Saldo', 'Vencimiento', 'Estado']],
      body: data.facturas.map(f => [
        f.numero,
        formatDate(f.fecha),
        f.tipo,
        currency(f.total),
        currency(f.saldo),
        f.vencimiento ? formatDate(f.vencimiento) : '-',
        f.estado.charAt(0).toUpperCase() + f.estado.slice(1),
      ]),
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 66, 66], fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 35 },
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
      margin: { left: 15, right: 15 },
    });

    y = doc.lastAutoTable.finalY + 10;
  }

  // Tabla de Pagos
  if (data.pagos.length > 0) {
    // Verificar si necesitamos nueva página
    if (y > 230) {
      doc.addPage();
      y = 15;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGOS REGISTRADOS', 15, y);
    y += 2;

    doc.autoTable({
      startY: y,
      head: [['Fecha', 'Monto', 'Método', 'Factura', 'Observaciones']],
      body: data.pagos.map(p => [
        formatDate(p.fecha),
        currency(p.monto),
        p.metodo || '-',
        p.facturaNumero || '-',
        p.observaciones || '-',
      ]),
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [34, 139, 34], fontSize: 8 },
      columnStyles: {
        1: { halign: 'right' },
        4: { cellWidth: 40 },
      },
      margin: { left: 15, right: 15 },
    });

    y = doc.lastAutoTable.finalY + 10;
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
    doc.text(
      'Generado automáticamente - Estado de Cuenta',
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' }
    );
  }

  // Retornar como data URL
  return doc.output('bloburl');
}

// Función para imprimir directamente
export function printAccountStatement(data: AccountStatementPDFData): void {
  const pdfUrl = generateAccountStatementPDF(data);
  const printWindow = window.open(pdfUrl, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}
