'use client';

import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extender el tipo jsPDF para incluir autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

function formatPriority(priority: string): string {
  const map: Record<string, string> = {
    CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja', NORMAL: 'Normal',
  };
  return map[priority?.toUpperCase()] || priority || 'Media';
}

function formatFrequency(item: any): string {
  if (item.frequencyDays) {
    const d = Number(item.frequencyDays);
    if (d === 1) return 'Diario';
    if (d === 7) return 'Semanal';
    if (d === 14) return 'Quincenal';
    if (d === 30) return 'Mensual';
    if (d === 90) return 'Trimestral';
    if (d === 180) return 'Semestral';
    if (d === 365) return 'Anual';
    return `${d} días`;
  }
  if (item.frequency) {
    const map: Record<string, string> = {
      DAILY: 'Diario', WEEKLY: 'Semanal', BIWEEKLY: 'Quincenal',
      MONTHLY: 'Mensual', QUARTERLY: 'Trimestral', YEARLY: 'Anual',
    };
    return map[item.frequency] || item.frequency;
  }
  return '-';
}

function formatDuration(item: any): string {
  if (item.timeValue && item.timeUnit) {
    const unit = item.timeUnit === 'HOURS' ? 'h' : 'min';
    return `${item.timeValue}${unit}`;
  }
  if (item.estimatedHours) return `${item.estimatedHours}h`;
  if (item.estimatedMinutes) return `${item.estimatedMinutes}min`;
  return '-';
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '-';
  }
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Exporta una lista de mantenimientos preventivos a PDF.
 * Compatible con los items de PreventivoHoyView (work orders) y PreventivoPlanesView (templates).
 */
export function exportPreventivePDF(
  items: any[],
  companyName: string,
  viewTitle = 'Mantenimientos Preventivos'
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageWidth = 297;
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-AR', { dateStyle: 'long' });
  const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(44, 62, 80);
  doc.rect(0, 0, pageWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(viewTitle, 14, 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(companyName, 14, 17);
  doc.text(`${dateStr} ${timeStr}`, pageWidth - 14, 17, { align: 'right' });

  // ── Stats row ──────────────────────────────────────────────────────────────
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.text(`Total: ${items.length} ítem${items.length !== 1 ? 's' : ''}`, 14, 29);

  // ── Table ──────────────────────────────────────────────────────────────────
  const rows = items.map((item) => [
    (item.title || 'Sin título').substring(0, 60),
    item.unidadMovil?.nombre || item.machine?.name || item.machineName || 'Sin equipo',
    formatPriority(item.priority),
    formatFrequency(item),
    formatDuration(item),
    formatDate(item.nextMaintenanceDate || item.scheduledDate),
    item.assignedTo?.name || item.assignedWorker?.name || item.assignedToName || 'Sin asignar',
    stripHtml(item.description).substring(0, 50) || '-',
  ]);

  doc.autoTable({
    startY: 33,
    head: [['Título', 'Equipo', 'Prioridad', 'Frecuencia', 'Duración', 'Próxima Fecha', 'Responsable', 'Descripción']],
    body: rows,
    headStyles: {
      fillColor: [52, 73, 94],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fontSize: 7.5, textColor: [44, 62, 80] },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: {
      0: { cellWidth: 52 },
      1: { cellWidth: 32 },
      2: { cellWidth: 18 },
      3: { cellWidth: 20 },
      4: { cellWidth: 18 },
      5: { cellWidth: 25 },
      6: { cellWidth: 30 },
      7: { cellWidth: 'auto' },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (_data: any) => {
      // Footer en cada página
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Página ${(doc as any).internal.getCurrentPageInfo().pageNumber} / ${pageCount}`,
        pageWidth / 2, 207, { align: 'center' }
      );
    },
  });

  const filename = `preventivo-${now.toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
