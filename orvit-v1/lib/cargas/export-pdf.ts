'use client';

/**
 * Utilidades para exportar cargas a PDF
 */

import { Load } from './types';
import { formatLoadDate, calculateTotalWeight, calculateTotalPackages } from './utils';

/**
 * Exportar una carga a PDF usando html2canvas y jsPDF
 * Requiere instalar: npm install jspdf html2canvas
 */
export async function exportLoadToPDF(
  printElement: HTMLElement,
  load: Load,
  companyName?: string
): Promise<void> {
  // Importar dinámicamente para evitar problemas de SSR
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  // Generar canvas del elemento
  const canvas = await html2canvas(printElement, {
    scale: 2, // Mayor resolución
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  // Crear PDF en landscape A4
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Dimensiones de la página
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;

  // Calcular dimensiones de la imagen
  const imgWidth = pageWidth - 2 * margin;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // Si la imagen es muy alta, ajustar
  let finalHeight = imgHeight;
  let finalWidth = imgWidth;
  if (imgHeight > pageHeight - 2 * margin) {
    finalHeight = pageHeight - 2 * margin;
    finalWidth = (canvas.width * finalHeight) / canvas.height;
  }

  // Agregar imagen al PDF
  const imgData = canvas.toDataURL('image/png');
  pdf.addImage(imgData, 'PNG', margin, margin, finalWidth, finalHeight);

  // Nombre del archivo
  const filename = generatePDFFilename(load, companyName);

  // Descargar
  pdf.save(filename);
}

/**
 * Generar nombre de archivo PDF
 */
function generatePDFFilename(load: Load, companyName?: string): string {
  const date = formatLoadDate(load.date).replace(/\//g, '-');
  const truckName = load.truck?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'carga';
  const prefix = companyName ? `${companyName}_` : '';
  return `${prefix}carga_${load.id}_${truckName}_${date}.pdf`;
}

/**
 * Exportar múltiples cargas a un solo PDF
 */
export async function exportMultipleLoadsToPDF(
  loads: Load[],
  getElementById: (id: number) => HTMLElement | null,
  companyName?: string
): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;

  for (let i = 0; i < loads.length; i++) {
    const load = loads[i];
    const element = getElementById(load.id);

    if (!element) continue;

    if (i > 0) {
      pdf.addPage();
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgWidth = pageWidth - 2 * margin;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let finalHeight = imgHeight;
    let finalWidth = imgWidth;
    if (imgHeight > pageHeight - 2 * margin) {
      finalHeight = pageHeight - 2 * margin;
      finalWidth = (canvas.width * finalHeight) / canvas.height;
    }

    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', margin, margin, finalWidth, finalHeight);
  }

  const date = new Date().toISOString().split('T')[0];
  const prefix = companyName ? `${companyName}_` : '';
  pdf.save(`${prefix}cargas_${loads.length}_${date}.pdf`);
}

/**
 * Crear contenido HTML para impresión directa
 */
export function createPrintableHTML(load: Load, companyName?: string): string {
  const totalWeight = calculateTotalWeight(load.items);
  const totalPackages = calculateTotalPackages(load.items);
  const totalUnits = load.items.reduce((sum, item) => sum + item.quantity, 0);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Carga #${load.id} - ${load.truck?.name || 'Sin camión'}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .company { font-size: 24px; font-weight: bold; }
        .title { font-size: 18px; margin-top: 5px; }
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
        .info-item { padding: 8px; background: #f5f5f5; border-radius: 4px; }
        .info-label { font-size: 12px; color: #666; }
        .info-value { font-size: 16px; font-weight: bold; }
        .items-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .items-table th, .items-table td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        .items-table th { background: #f0f0f0; font-weight: bold; }
        .totals { margin-top: 20px; padding: 10px; background: #e8f4e8; border-radius: 4px; }
        .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        ${companyName ? `<div class="company">${companyName}</div>` : ''}
        <div class="title">Remito de Carga #${load.id}</div>
      </div>

      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Fecha</div>
          <div class="info-value">${formatLoadDate(load.date)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Camión</div>
          <div class="info-value">${load.truck?.name || '-'} (${load.truck?.type || '-'})</div>
        </div>
        <div class="info-item">
          <div class="info-label">Cliente</div>
          <div class="info-value">${load.deliveryClient || 'Corralón'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Dirección</div>
          <div class="info-value">${load.deliveryAddress || '-'}</div>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Largo (m)</th>
            <th>Peso (kg)</th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody>
          ${load.items
            .map(
              (item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${item.productName}</td>
              <td>${item.quantity}</td>
              <td>${item.length?.toFixed(2) || '-'}</td>
              <td>${item.weight?.toFixed(2) || '-'}</td>
              <td>${item.notes || '-'}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <div class="totals">
        <strong>Totales:</strong>
        ${totalUnits} unidades |
        ${totalPackages} paquetes |
        ${totalWeight.toFixed(2)} Tn
      </div>

      ${load.description ? `<p style="margin-top: 15px;"><strong>Observaciones:</strong> ${load.description}</p>` : ''}

      <div class="footer">
        Generado el ${new Date().toLocaleString('es-AR')}
      </div>
    </body>
    </html>
  `;
}

/**
 * Abrir ventana de impresión con HTML
 */
export function openPrintWindow(load: Load, companyName?: string): void {
  const html = createPrintableHTML(load, companyName);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}
