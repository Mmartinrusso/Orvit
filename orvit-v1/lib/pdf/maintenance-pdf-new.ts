import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extender el tipo jsPDF para incluir autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

interface Machine {
  id: number;
  name: string;
  nickname?: string;
  type: string;
  brand?: string;
  model?: string;
  status: string;
  sector?: {
    id: number;
    name: string;
  };
}

interface PreventiveMaintenance {
  id: number;
  title: string;
  description?: string;
  frequency: number;
  frequencyUnit: string;
  priority: string;
  estimatedDuration: number;
  durationType: string;
  machineId: number;
  instances?: any[];
}

interface CorrectiveMaintenance {
  id: number;
  title: string;
  description?: string;
  type: string;
  priority: string;
  status: string;
  reportedDate?: string;
  assignedTo?: string;
  estimatedCost?: number;
  machineId: number;
}

interface MaintenancePDFData {
  machines: Machine[];
  preventiveMaintenances: PreventiveMaintenance[];
  correctiveMaintenances: CorrectiveMaintenance[];
  companyName: string;
}

interface PDFFilters {
  machineIds: number[];
  maintenanceTypes: string[];
  pdfType: 'listado' | 'control';
  orientation: 'horizontal' | 'vertical';
}

// Colores solo blanco y negro
const COLORS = {
  black: [0, 0, 0],           // Negro
  white: [255, 255, 255],     // Blanco
  gray: [128, 128, 128],      // Gris medio
  lightGray: [240, 240, 240], // Gris claro
  border: [200, 200, 200]     // Gris para bordes
};

// Funciones de formateo en español
function formatPriority(priority: string): string {
  const priorityMap: { [key: string]: string } = {
    'HIGH': 'Alta',
    'MEDIUM': 'Media',
    'LOW': 'Baja',
    'URGENT': 'Urgente'
  };
  return priorityMap[priority?.toUpperCase()] || priority || 'No especificada';
}

function formatMaintenanceType(type: string): string {
  const typeMap: { [key: string]: string } = {
    'PREVENTIVE': 'Preventivo',
    'CORRECTIVE': 'Correctivo',
    'PREDICTIVE': 'Predictivo',
    'EMERGENCY': 'Emergencia'
  };
  return typeMap[type?.toUpperCase()] || type || 'No especificado';
}

function formatStatus(status: string): string {
  const statusMap: { [key: string]: string } = {
    'PENDING': 'Pendiente',
    'COMPLETED': 'Completado',
    'IN_PROGRESS': 'En Progreso',
    'CANCELLED': 'Cancelado',
    'ACTIVE': 'Activo',
    'INACTIVE': 'Inactivo',
    'MEDIUM': 'Media'
  };
  return statusMap[status?.toUpperCase()] || status || 'No especificado';
}

function formatFrequency(frequency: number, unit: string): string {
  if (!frequency || !unit) return 'No especificada';
  
  const unitMap: { [key: string]: string } = {
    'DAYS': 'días',
    'WEEKS': 'semanas',
    'MONTHS': 'meses',
    'YEARS': 'años',
    'HOURS': 'horas',
    'KILOMETERS': 'kilómetros'
  };
  
  const unitText = unitMap[unit.toUpperCase()] || unit.toLowerCase();
  return `Cada ${frequency} ${unitText}`;
}

// Función principal de generación
export function generateMaintenancePDF(
  data: MaintenancePDFData,
  filters: PDFFilters,
  companyName: string = 'Empresa'
) {
  if (filters.pdfType === 'control') {
    if (filters.orientation === 'horizontal') {
      return generateControlHorizontalPDF(data, filters, companyName);
    } else {
      return generateControlVerticalPDF(data, filters, companyName);
    }
  } else {
    if (filters.orientation === 'horizontal') {
      return generateListadoHorizontalPDF(data, filters, companyName);
    } else {
      return generateListadoVerticalPDF(data, filters, companyName);
    }
  }
}

// 1. LISTADO HORIZONTAL - Tabla amplia optimizada para A4 horizontal
function generateListadoHorizontalPDF(
  data: MaintenancePDFData,
  filters: PDFFilters,
  companyName: string
) {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = 297;
  const pageHeight = 210;
  let yPosition = 20;

  // Header simple
  doc.setFillColor(...COLORS.black);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('LISTADO DE MANTENIMIENTOS - HORIZONTAL', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(companyName, pageWidth / 2, 28, { align: 'center' });

  yPosition = 50;

  // Tabla única con todos los mantenimientos
  const allMaintenances: any[] = [];

  // Agregar preventivos
  if (filters.maintenanceTypes.includes('PREVENTIVE')) {
    data.preventiveMaintenances.forEach(maint => {
      const machine = data.machines.find(m => m.id === maint.machineId);
      if (machine && filters.machineIds.includes(machine.id)) {
        allMaintenances.push([
          machine.name,
          `ID: ${maint.id} - ${maint.title}`,
          'Preventivo',
          formatPriority(maint.priority),
          formatFrequency(maint.frequency, maint.frequencyUnit),
          `${maint.estimatedDuration} ${maint.durationType === 'HOURS' ? 'horas' : 'días'}`,
          maint.description || '-'
        ]);
      }
    });
  }

  // Agregar correctivos
  if (filters.maintenanceTypes.includes('CORRECTIVE')) {
    data.correctiveMaintenances.forEach(maint => {
      const machine = data.machines.find(m => m.id === maint.machineId);
      if (machine && filters.machineIds.includes(machine.id)) {
        allMaintenances.push([
          machine.name,
          `ID: ${maint.id} - ${maint.title}`,
          'Correctivo',
          formatPriority(maint.priority),
          formatStatus(maint.status),
          maint.estimatedCost ? `$${maint.estimatedCost}` : '-',
          maint.description || '-'
        ]);
      }
    });
  }

  (doc as any).autoTable({
    startY: yPosition,
    head: [['Máquina', 'Título', 'Tipo', 'Prioridad', 'Frecuencia/Estado', 'Duración/Costo', 'Descripción']],
    body: allMaintenances,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4,
      overflow: 'linebreak',
      halign: 'left',
      valign: 'middle',
      lineColor: COLORS.border,
      lineWidth: 0.5,
      textColor: COLORS.black,
      fillColor: COLORS.white
    },
    headStyles: {
      fillColor: COLORS.black,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: COLORS.lightGray
    },
    columnStyles: {
      0: { cellWidth: 35 },  // Máquina
      1: { cellWidth: 50 },  // Título
      2: { cellWidth: 25 },  // Tipo
      3: { cellWidth: 25 },  // Prioridad
      4: { cellWidth: 40 },  // Frecuencia/Estado
      5: { cellWidth: 30 },  // Duración/Costo
      6: { cellWidth: 'auto' } // Descripción
    },
    margin: { top: 50, right: 15, bottom: 30, left: 15 }
  });

  // Footer
  doc.setTextColor(...COLORS.gray);
  doc.setFontSize(8);
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

  return doc;
}

// 2. LISTADO VERTICAL - Diseño compacto optimizado para A4 vertical
function generateListadoVerticalPDF(
  data: MaintenancePDFData,
  filters: PDFFilters,
  companyName: string
) {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  let yPosition = 20;

  // Header simple
  doc.setFillColor(...COLORS.black);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LISTADO DE MANTENIMIENTOS', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(9);
  doc.text(companyName, pageWidth / 2, 28, { align: 'center' });

  yPosition = 50;

  // Secciones separadas por tipo
  if (filters.maintenanceTypes.includes('PREVENTIVE')) {
    // Título de sección
    doc.setFillColor(...COLORS.lightGray);
    doc.rect(15, yPosition, 180, 8, 'F');
    doc.setTextColor(...COLORS.black);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('MANTENIMIENTOS PREVENTIVOS', 20, yPosition + 5);
    yPosition += 15;

    const preventiveData = data.preventiveMaintenances
      .filter(maint => {
        const machine = data.machines.find(m => m.id === maint.machineId);
        return machine && filters.machineIds.includes(machine.id);
      })
      .map(maint => {
        const machine = data.machines.find(m => m.id === maint.machineId);
        return [
          machine?.name || '',
          maint.title,
          formatPriority(maint.priority),
          formatFrequency(maint.frequency, maint.frequencyUnit)
        ];
      });

    (doc as any).autoTable({
      startY: yPosition,
      head: [['Máquina', 'Título', 'Prioridad', 'Frecuencia']],
      body: preventiveData,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 3,
        overflow: 'linebreak',
        halign: 'left',
        valign: 'middle',
        lineColor: COLORS.border,
        lineWidth: 0.5,
        textColor: COLORS.black,
        fillColor: COLORS.white
      },
      headStyles: {
        fillColor: COLORS.black,
        textColor: COLORS.white,
        fontStyle: 'bold',
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 70 },
        2: { cellWidth: 30 },
        3: { cellWidth: 40 }
      },
      margin: { left: 15, right: 15 }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  if (filters.maintenanceTypes.includes('CORRECTIVE')) {
    // Título de sección
    doc.setFillColor(...COLORS.lightGray);
    doc.rect(15, yPosition, 180, 8, 'F');
    doc.setTextColor(...COLORS.black);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('MANTENIMIENTOS CORRECTIVOS', 20, yPosition + 5);
    yPosition += 15;

    const correctiveData = data.correctiveMaintenances
      .filter(maint => {
        const machine = data.machines.find(m => m.id === maint.machineId);
        return machine && filters.machineIds.includes(machine.id);
      })
      .map(maint => {
        const machine = data.machines.find(m => m.id === maint.machineId);
        return [
          machine?.name || '',
          maint.title,
          formatPriority(maint.priority),
          formatStatus(maint.status)
        ];
      });

    (doc as any).autoTable({
      startY: yPosition,
      head: [['Máquina', 'Título', 'Prioridad', 'Estado']],
      body: correctiveData,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 3,
        overflow: 'linebreak',
        halign: 'left',
        valign: 'middle',
        lineColor: COLORS.border,
        lineWidth: 0.5,
        textColor: COLORS.black,
        fillColor: COLORS.white
      },
      headStyles: {
        fillColor: COLORS.black,
        textColor: COLORS.white,
        fontStyle: 'bold',
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 70 },
        2: { cellWidth: 30 },
        3: { cellWidth: 40 }
      },
      margin: { left: 15, right: 15 }
    });
  }

  // Footer
  doc.setTextColor(...COLORS.gray);
  doc.setFontSize(8);
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

  return doc;
}

// 3. CONTROL HORIZONTAL - Checklist con casillas para marcar en A4 horizontal
function generateControlHorizontalPDF(
  data: MaintenancePDFData,
  filters: PDFFilters,
  companyName: string
) {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = 297;
  const pageHeight = 210;
  let yPosition = 20;

  // Header
  doc.setFillColor(...COLORS.black);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('CONTROL DE MANTENIMIENTOS - HORIZONTAL', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(companyName, pageWidth / 2, 28, { align: 'center' });

  yPosition = 50;

  // Función para dibujar checkbox
  const drawCheckbox = (x: number, y: number, size: number = 4) => {
    doc.setDrawColor(...COLORS.black);
    doc.setLineWidth(0.5);
    doc.rect(x, y, size, size, 'S');
  };

  // Tabla de control con checkboxes
  const controlData: any[] = [];

  // Agregar preventivos
  if (filters.maintenanceTypes.includes('PREVENTIVE')) {
    data.preventiveMaintenances.forEach(maint => {
      const machine = data.machines.find(m => m.id === maint.machineId);
      if (machine && filters.machineIds.includes(machine.id)) {
        controlData.push([
          '', // Checkbox (se dibuja manualmente)
          machine.name,
          maint.title,
          'Preventivo',
          formatFrequency(maint.frequency, maint.frequencyUnit),
          formatPriority(maint.priority),
          '________________', // Espacio para observaciones
          '________________'  // Espacio para fecha
        ]);
      }
    });
  }

  // Agregar correctivos
  if (filters.maintenanceTypes.includes('CORRECTIVE')) {
    data.correctiveMaintenances.forEach(maint => {
      const machine = data.machines.find(m => m.id === maint.machineId);
      if (machine && filters.machineIds.includes(machine.id)) {
        controlData.push([
          '', // Checkbox (se dibuja manualmente)
          machine.name,
          maint.title,
          'Correctivo',
          formatStatus(maint.status),
          formatPriority(maint.priority),
          '________________', // Espacio para observaciones
          '________________'  // Espacio para fecha
        ]);
      }
    });
  }

  (doc as any).autoTable({
    startY: yPosition,
    head: [['✓', 'Máquina', 'Título', 'Tipo', 'Frecuencia/Estado', 'Prioridad', 'Observaciones', 'Fecha']],
    body: controlData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 6,
      overflow: 'linebreak',
      halign: 'left',
      valign: 'middle',
      lineColor: COLORS.border,
      lineWidth: 0.5,
      textColor: COLORS.black,
      fillColor: COLORS.white
    },
    headStyles: {
      fillColor: COLORS.black,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },  // Checkbox
      1: { cellWidth: 35 },  // Máquina
      2: { cellWidth: 45 },  // Título
      3: { cellWidth: 25 },  // Tipo
      4: { cellWidth: 35 },  // Frecuencia/Estado
      5: { cellWidth: 25 },  // Prioridad
      6: { cellWidth: 60 },  // Observaciones
      7: { cellWidth: 35 }   // Fecha
    },
    margin: { top: 50, right: 15, bottom: 30, left: 15 },
    didDrawCell: (data: any) => {
      // Dibujar checkboxes en la primera columna
      if (data.column.index === 0 && data.section === 'body') {
        const x = data.cell.x + 3;
        const y = data.cell.y + 3;
        drawCheckbox(x, y);
      }
    }
  });

  // Sección de observaciones generales
  yPosition = (doc as any).lastAutoTable.finalY + 20;
  
  doc.setTextColor(...COLORS.black);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('OBSERVACIONES GENERALES:', 20, yPosition);
  
  // Líneas para escribir
  for (let i = 0; i < 4; i++) {
    yPosition += 10;
    doc.setDrawColor(...COLORS.gray);
    doc.setLineWidth(0.3);
    doc.line(20, yPosition, pageWidth - 20, yPosition);
  }

  // Footer con firma
  doc.setTextColor(...COLORS.gray);
  doc.setFontSize(8);
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 20, pageHeight - 20);
  doc.text('Responsable: ________________________', pageWidth - 120, pageHeight - 20);
  doc.text('Firma: ________________________', pageWidth - 120, pageHeight - 10);

  return doc;
}

// 4. CONTROL VERTICAL - Checklist compacto para A4 vertical
function generateControlVerticalPDF(
  data: MaintenancePDFData,
  filters: PDFFilters,
  companyName: string
) {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  let yPosition = 20;

  // Header
  doc.setFillColor(...COLORS.black);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('CONTROL DE MANTENIMIENTOS', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(9);
  doc.text(companyName, pageWidth / 2, 28, { align: 'center' });

  yPosition = 50;

  // Función para dibujar checkbox
  const drawCheckbox = (x: number, y: number, size: number = 4) => {
    doc.setDrawColor(...COLORS.black);
    doc.setLineWidth(0.5);
    doc.rect(x, y, size, size, 'S');
  };

  // Lista de control por secciones
  if (filters.maintenanceTypes.includes('PREVENTIVE')) {
    // Título de sección
    doc.setFillColor(...COLORS.lightGray);
    doc.rect(15, yPosition, 180, 8, 'F');
    doc.setTextColor(...COLORS.black);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('PREVENTIVOS - CONTROL', 20, yPosition + 5);
    yPosition += 15;

    data.preventiveMaintenances.forEach(maint => {
      const machine = data.machines.find(m => m.id === maint.machineId);
      if (machine && filters.machineIds.includes(machine.id)) {
        // Checkbox
        drawCheckbox(20, yPosition);
        
        // Información del mantenimiento
        doc.setTextColor(...COLORS.black);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`${machine.name} - ${maint.title}`, 30, yPosition + 3);
        doc.setFontSize(8);
        doc.text(`${formatFrequency(maint.frequency, maint.frequencyUnit)} | ${formatPriority(maint.priority)}`, 30, yPosition + 8);
        
        // Línea para observaciones
        doc.setDrawColor(...COLORS.gray);
        doc.setLineWidth(0.3);
        doc.line(30, yPosition + 12, pageWidth - 20, yPosition + 12);
        
        yPosition += 18;
      }
    });
    
    yPosition += 10;
  }

  if (filters.maintenanceTypes.includes('CORRECTIVE')) {
    // Título de sección
    doc.setFillColor(...COLORS.lightGray);
    doc.rect(15, yPosition, 180, 8, 'F');
    doc.setTextColor(...COLORS.black);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CORRECTIVOS - CONTROL', 20, yPosition + 5);
    yPosition += 15;

    data.correctiveMaintenances.forEach(maint => {
      const machine = data.machines.find(m => m.id === maint.machineId);
      if (machine && filters.machineIds.includes(machine.id)) {
        // Checkbox
        drawCheckbox(20, yPosition);
        
        // Información del mantenimiento
        doc.setTextColor(...COLORS.black);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`${machine.name} - ${maint.title}`, 30, yPosition + 3);
        doc.setFontSize(8);
        doc.text(`${formatStatus(maint.status)} | ${formatPriority(maint.priority)}`, 30, yPosition + 8);
        
        // Línea para observaciones
        doc.setDrawColor(...COLORS.gray);
        doc.setLineWidth(0.3);
        doc.line(30, yPosition + 12, pageWidth - 20, yPosition + 12);
        
        yPosition += 18;
      }
    });
  }

  // Sección de observaciones generales
  yPosition += 20;
  
  doc.setTextColor(...COLORS.black);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('OBSERVACIONES GENERALES:', 20, yPosition);
  
  // Líneas para escribir
  for (let i = 0; i < 6; i++) {
    yPosition += 12;
    doc.setDrawColor(...COLORS.gray);
    doc.setLineWidth(0.3);
    doc.line(20, yPosition, pageWidth - 20, yPosition);
  }

  // Footer con firma
  doc.setTextColor(...COLORS.gray);
  doc.setFontSize(8);
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 20, pageHeight - 30);
  doc.text('Responsable: ________________________', 20, pageHeight - 20);
  doc.text('Firma: ________________________', 20, pageHeight - 10);

  return doc;
}

// Función para descargar el PDF
export function downloadMaintenancePDF(
  data: MaintenancePDFData,
  filters: PDFFilters,
  companyName: string = 'Empresa'
) {
  const doc = generateMaintenancePDF(data, filters, companyName);
  const fileName = `mantenimiento_${filters.pdfType}_${filters.orientation}_${new Date().getTime()}.pdf`;
  doc.save(fileName);
}