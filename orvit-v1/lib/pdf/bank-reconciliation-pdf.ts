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

export interface ReconciliationPDFItem {
  fecha: string;
  descripcion: string;
  referencia: string | null;
  debito: number;
  credito: number;
  matchType: string | null;
  matchConfidence: number | null;
  conciliado: boolean;
  esSuspense: boolean;
  suspenseResuelto: boolean;
  suspenseNotas: string | null;
  movimientoSistema: {
    fecha: string;
    tipo: string;
    monto: number;
    descripcion: string | null;
  } | null;
}

export interface ReconciliationPDFDiferencia {
  monto: number;
  concepto: string;
  justificacion: string;
}

export interface ReconciliationPDFData {
  banco: {
    nombre: string;
    banco: string;
    numeroCuenta: string;
    cbu?: string;
  };
  company?: {
    name?: string;
    cuit?: string;
  };
  periodo: string;
  estado: string;
  saldoInicial: number;
  saldoFinal: number;
  saldoContable: number;
  saldoBancario: number;
  totalDebitos: number;
  totalCreditos: number;
  // Estadísticas
  totalItems: number;
  itemsConciliados: number;
  itemsPendientes: number;
  itemsSuspense: number;
  matchBreakdown: {
    EXACT: number;
    FUZZY: number;
    REFERENCE: number;
    MANUAL: number;
  };
  // Items
  itemsConciliadosList: ReconciliationPDFItem[];
  itemsPendientesList: ReconciliationPDFItem[];
  // Diferencias justificadas
  diferencias: ReconciliationPDFDiferencia[];
  // Cierre
  cerradoAt?: string;
  cerradoPor?: string;
  notasCierre?: string;
}

const currency = (value: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(value);
};

const formatDate = (value: string | null | undefined): string => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-AR');
};

const pct = (value: number | null): string => {
  if (value === null || value === undefined) return '-';
  return `${Math.round(value * 100)}%`;
};

export function generateBankReconciliationPDF(data: ReconciliationPDFData): string {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // ═══════════════════════════════════════════════════════════════════
  // ENCABEZADO
  // ═══════════════════════════════════════════════════════════════════

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('REPORTE DE CONCILIACIÓN BANCARIA', pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${data.periodo}`, pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFontSize(8);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR')}`, pageWidth - 15, y, { align: 'right' });
  y += 8;

  // ═══════════════════════════════════════════════════════════════════
  // DATOS DE CUENTA
  // ═══════════════════════════════════════════════════════════════════

  doc.setFillColor(240, 240, 240);
  doc.rect(15, y, pageWidth - 30, 18, 'F');
  y += 5;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('CUENTA BANCARIA', 20, y);

  if (data.company?.name) {
    doc.setFont('helvetica', 'normal');
    doc.text(`Empresa: ${data.company.name}`, pageWidth - 20, y, { align: 'right' });
  }
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.text(`${data.banco.nombre} - ${data.banco.banco}`, 20, y);
  doc.text(`Cuenta: ${data.banco.numeroCuenta}`, pageWidth / 2, y);
  if (data.banco.cbu) {
    doc.text(`CBU: ${data.banco.cbu}`, pageWidth - 20, y, { align: 'right' });
  }
  y += 12;

  // ═══════════════════════════════════════════════════════════════════
  // KPIs / RESUMEN
  // ═══════════════════════════════════════════════════════════════════

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMEN', 15, y);
  y += 2;

  const kpiData = [
    ['Saldo Inicial Extracto', currency(data.saldoInicial), 'Total Items', String(data.totalItems)],
    ['Saldo Final Extracto', currency(data.saldoFinal), 'Conciliados', String(data.itemsConciliados)],
    ['Saldo Contable (Sistema)', currency(data.saldoContable), 'Pendientes', String(data.itemsPendientes)],
    ['Saldo Bancario (Extracto)', currency(data.saldoBancario), 'Suspense', String(data.itemsSuspense)],
    ['Diferencia', currency(data.saldoBancario - data.saldoContable), 'Estado', data.estado],
  ];

  doc.autoTable({
    startY: y,
    head: [],
    body: kpiData,
    theme: 'plain',
    styles: { fontSize: 8 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55 },
      1: { halign: 'right', cellWidth: 45 },
      2: { fontStyle: 'bold', cellWidth: 45 },
      3: { halign: 'right', cellWidth: 35 },
    },
    margin: { left: 15, right: 15 },
  });

  y = doc.lastAutoTable.finalY + 5;

  // Breakdown de match types
  const breakdownText = `Match: Exacto=${data.matchBreakdown.EXACT}, Fuzzy=${data.matchBreakdown.FUZZY}, Referencia=${data.matchBreakdown.REFERENCE}, Manual=${data.matchBreakdown.MANUAL}`;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text(breakdownText, 15, y);
  y += 8;

  // ═══════════════════════════════════════════════════════════════════
  // MOVIMIENTOS CONCILIADOS
  // ═══════════════════════════════════════════════════════════════════

  if (data.itemsConciliadosList.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('MOVIMIENTOS CONCILIADOS', 15, y);
    y += 2;

    doc.autoTable({
      startY: y,
      head: [['Fecha', 'Descripción', 'Referencia', 'Débito', 'Crédito', 'Match', 'Confianza', 'Mov. Sistema']],
      body: data.itemsConciliadosList.map((item) => [
        formatDate(item.fecha),
        item.descripcion.substring(0, 40),
        item.referencia || '-',
        item.debito > 0 ? currency(item.debito) : '-',
        item.credito > 0 ? currency(item.credito) : '-',
        item.matchType || '-',
        pct(item.matchConfidence),
        item.movimientoSistema
          ? `${item.movimientoSistema.tipo} ${currency(item.movimientoSistema.monto)}`
          : '-',
      ]),
      theme: 'striped',
      styles: { fontSize: 7 },
      headStyles: { fillColor: [34, 139, 34], fontSize: 7 },
      columnStyles: {
        1: { cellWidth: 50 },
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
      margin: { left: 15, right: 15 },
    });

    y = doc.lastAutoTable.finalY + 8;
  }

  // ═══════════════════════════════════════════════════════════════════
  // MOVIMIENTOS PENDIENTES / SUSPENSE
  // ═══════════════════════════════════════════════════════════════════

  if (data.itemsPendientesList.length > 0) {
    if (y > 170) {
      doc.addPage();
      y = 15;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('MOVIMIENTOS PENDIENTES / SUSPENSE', 15, y);
    y += 2;

    doc.autoTable({
      startY: y,
      head: [['Fecha', 'Descripción', 'Referencia', 'Débito', 'Crédito', 'Estado', 'Notas']],
      body: data.itemsPendientesList.map((item) => [
        formatDate(item.fecha),
        item.descripcion.substring(0, 45),
        item.referencia || '-',
        item.debito > 0 ? currency(item.debito) : '-',
        item.credito > 0 ? currency(item.credito) : '-',
        item.esSuspense
          ? item.suspenseResuelto
            ? 'Resuelto'
            : 'Suspense'
          : 'Pendiente',
        item.suspenseNotas || '-',
      ]),
      theme: 'striped',
      styles: { fontSize: 7 },
      headStyles: { fillColor: [220, 150, 30], fontSize: 7 },
      columnStyles: {
        1: { cellWidth: 55 },
        3: { halign: 'right' },
        4: { halign: 'right' },
        6: { cellWidth: 50 },
      },
      margin: { left: 15, right: 15 },
    });

    y = doc.lastAutoTable.finalY + 8;
  }

  // ═══════════════════════════════════════════════════════════════════
  // DIFERENCIAS JUSTIFICADAS
  // ═══════════════════════════════════════════════════════════════════

  if (data.diferencias.length > 0) {
    if (y > 170) {
      doc.addPage();
      y = 15;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DIFERENCIAS JUSTIFICADAS', 15, y);
    y += 2;

    doc.autoTable({
      startY: y,
      head: [['Concepto', 'Monto', 'Justificación']],
      body: data.diferencias.map((d) => [
        d.concepto,
        currency(d.monto),
        d.justificacion,
      ]),
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [180, 50, 50], fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { halign: 'right', cellWidth: 40 },
        2: { cellWidth: 120 },
      },
      margin: { left: 15, right: 15 },
    });

    y = doc.lastAutoTable.finalY + 5;

    // Total diferencias
    const totalDif = data.diferencias.reduce((s, d) => s + d.monto, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Diferencias Justificadas: ${currency(totalDif)}`, 15, y);
    y += 8;
  }

  // ═══════════════════════════════════════════════════════════════════
  // CIERRE
  // ═══════════════════════════════════════════════════════════════════

  if (data.cerradoAt) {
    if (y > 180) {
      doc.addPage();
      y = 15;
    }

    doc.setFillColor(230, 230, 230);
    doc.rect(15, y, pageWidth - 30, 20, 'F');
    y += 5;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('CIERRE DE CONCILIACIÓN', 20, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de cierre: ${formatDate(data.cerradoAt)}`, 20, y);
    if (data.cerradoPor) {
      doc.text(`Responsable: ${data.cerradoPor}`, pageWidth / 2, y);
    }
    y += 5;
    if (data.notasCierre) {
      doc.text(`Notas: ${data.notasCierre}`, 20, y);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════════════════════════

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
    doc.text(
      'Reporte de Conciliación Bancaria - Generado automáticamente',
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 5,
      { align: 'center' }
    );
  }

  return doc.output('datauristring');
}
