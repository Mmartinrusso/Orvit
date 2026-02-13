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
    area?: {
      id: number;
      name: string;
    };
  };
}

interface PreventiveMaintenance {
  id: number;
  title: string;
  description: string;
  frequency: number;
  frequencyUnit: string;
  priority: string;
  machineId: number;
  machine?: Machine;
  instances: any[];
}

interface CorrectiveMaintenance {
  id: number;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  scheduledDate?: string;
  assignedTo?: {
    name: string;
  };
  cost?: number;
  machineId: number;
  machine?: Machine;
}

interface MaintenancePDFData {
  preventiveMaintenances: PreventiveMaintenance[];
  correctiveMaintenances: CorrectiveMaintenance[];
  machines: Machine[];
}

interface PDFFilters {
  machineIds: number[];
  maintenanceTypes: string[];
  pdfType: 'listado' | 'control';
  orientation: 'horizontal' | 'vertical';
}

// Paleta de colores estética
const COLORS = {
  black: [0, 0, 0],           // Negro
  white: [255, 255, 255],     // Blanco
  gray: [128, 128, 128],      // Gris medio
  lightGray: [240, 240, 240], // Gris claro
  border: [200, 200, 200]     // Gris para bordes
};

// Funciones de formateo
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
    'HOURS': 'horas'
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

// Función para generar header estético
function addStylishHeader(doc: jsPDF, title: string, companyName: string, isLandscape: boolean = false) {
  const pageWidth = isLandscape ? 297 : 210;
  
  // Header simple en blanco y negro
  doc.setFillColor(...COLORS.black);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  // Línea decorativa simple
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(2);
  doc.line(20, 35, pageWidth - 20, 35);
  
  // Título principal
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, pageWidth / 2, 20, { align: 'center' });
  
  // Información de la empresa
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(companyName, pageWidth / 2, 30, { align: 'center' });
  
  return 55; // Retorna la posición Y donde continuar
}

// Función para agregar footer estético
function addStylishFooter(doc: jsPDF, pageNum: number, totalPages: number, isLandscape: boolean = false) {
  const pageWidth = isLandscape ? 297 : 210;
  const pageHeight = isLandscape ? 210 : 297;
  
  // Línea superior del footer
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20);
  
  // Texto del footer
  doc.setTextColor(...COLORS.gray);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  const date = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  doc.text(`Generado el ${date}`, 20, pageHeight - 10);
  doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
}

// PDF HORIZONTAL - Diseño optimizado para A4 landscape
function generateListadoHorizontalPDF(
  data: MaintenancePDFData,
  filters: PDFFilters,
  companyName: string
) {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  
  let yPosition = addStylishHeader(doc, 'Reporte de Mantenimientos', companyName, true);
  
  // Información de filtros aplicados
  yPosition = addFilterSection(doc, filters, data, true, yPosition);
  
  // Resumen estadístico
  yPosition = addSummarySection(doc, data, true, yPosition);
  
  // Generar contenido por máquina
  const selectedMachines = data.machines.filter(m => filters.machineIds.includes(m.id));
  
  selectedMachines.forEach((machine, index) => {
    // Verificar espacio para nueva sección
    if (yPosition > 160) {
      doc.addPage('landscape', 'mm', 'a4');
      yPosition = 20;
    }
    
    yPosition = addMachineSection(doc, machine, data, filters, true, yPosition);
  });
  
  // Agregar footers a todas las páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addStylishFooter(doc, i, totalPages, true);
  }
  
  return doc;
}

// PDF VERTICAL - Diseño optimizado para A4 portrait
function generateListadoVerticalPDF(
  data: MaintenancePDFData,
  filters: PDFFilters,
  companyName: string
) {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  
  let yPosition = addStylishHeader(doc, 'Reporte de Mantenimientos', companyName, false);
  
  // Información de filtros aplicados
  yPosition = addFilterSection(doc, filters, data, false, yPosition);
  
  // Resumen estadístico
  yPosition = addSummarySection(doc, data, false, yPosition);
  
  // Generar contenido por máquina
  const selectedMachines = data.machines.filter(m => filters.machineIds.includes(m.id));
  
  selectedMachines.forEach((machine, index) => {
    // Verificar espacio para nueva sección
    if (yPosition > 240) {
      doc.addPage('portrait', 'mm', 'a4');
      yPosition = 20;
    }
    
    yPosition = addMachineSection(doc, machine, data, filters, false, yPosition);
  });
  
  // Agregar footers a todas las páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addStylishFooter(doc, i, totalPages, false);
  }
  
  return doc;
}

// PDF DE CONTROL - Diseño para checklist
function generateControlPDF(
  data: MaintenancePDFData,
  filters: PDFFilters,
  companyName: string
) {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  
  let yPosition = addStylishHeader(doc, 'Control de Mantenimientos', companyName, true);
  
  // Información del responsable
  yPosition = addResponsibleSection(doc, yPosition);
  
  // Información de filtros
  yPosition = addFilterSection(doc, filters, data, true, yPosition);
  
  // Generar tabla de control
  yPosition = addControlTable(doc, data, filters, yPosition);
  
  // Sección de observaciones
  addObservationsSection(doc, yPosition);
  
  // Agregar footers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addStylishFooter(doc, i, totalPages, true);
  }
  
  return doc;
}

// Función para agregar sección de filtros
function addFilterSection(
  doc: jsPDF, 
  filters: PDFFilters, 
  data: MaintenancePDFData, 
  isLandscape: boolean, 
  startY: number
): number {
  let yPosition = startY;
  
  // Título de sección con diseño moderno
  doc.setFillColor(...COLORS.background);
  doc.rect(20, yPosition, isLandscape ? 257 : 170, 10, 'F');
  
  // Borde sutil
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.rect(20, yPosition, isLandscape ? 257 : 170, 10, 'S');
  
  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('FILTROS APLICADOS', 25, yPosition + 6.5);
  
  yPosition += 15;
  
  // Contenido de filtros
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  const selectedMachines = data.machines.filter(m => filters.machineIds.includes(m.id));
  const machineNames = selectedMachines.length > 3 
    ? `${selectedMachines.slice(0, 3).map(m => m.name).join(', ')} y ${selectedMachines.length - 3} más`
    : selectedMachines.map(m => m.name).join(', ');
  
  doc.text(`Máquinas: ${machineNames}`, 22, yPosition);
  yPosition += 6;
  
  const typeNames = filters.maintenanceTypes.map(type => formatMaintenanceType(type)).join(', ');
  doc.text(`Tipos: ${typeNames}`, 22, yPosition);
  yPosition += 6;
  
  doc.text(`Formato: ${filters.pdfType === 'listado' ? 'Listado' : 'Control'}`, 22, yPosition);
  if (filters.pdfType === 'listado') {
    doc.text(` - ${filters.orientation === 'horizontal' ? 'Horizontal' : 'Vertical'}`, 60, yPosition);
  }
  
  return yPosition + 15;
}

// Función para agregar sección de resumen
function addSummarySection(
  doc: jsPDF, 
  data: MaintenancePDFData, 
  isLandscape: boolean, 
  startY: number
): number {
  let yPosition = startY;
  
  // Título de sección con diseño elegante
  doc.setFillColor(...COLORS.accent);
  doc.rect(20, yPosition, isLandscape ? 257 : 170, 10, 'F');
  
  // Borde sutil
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.rect(20, yPosition, isLandscape ? 257 : 170, 10, 'S');
  
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('RESUMEN ESTADÍSTICO', 25, yPosition + 6.5);
  
  yPosition += 15;
  
  // Cards de estadísticas
  const cardWidth = isLandscape ? 60 : 50;
  const cardHeight = 25;
  const gap = 10;
  
  const stats = [
    { label: 'Preventivos', value: data.preventiveMaintenances.length, color: COLORS.success },
    { label: 'Correctivos', value: data.correctiveMaintenances.length, color: COLORS.warning },
    { label: 'Máquinas', value: data.machines.length, color: COLORS.accent }
  ];
  
  stats.forEach((stat, index) => {
    const x = 20 + (cardWidth + gap) * index;
    
    // Fondo de la card con sombra sutil
    doc.setFillColor(...stat.color);
    doc.roundedRect(x, yPosition, cardWidth, cardHeight, 4, 4, 'F');
    
    // Borde sutil
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, yPosition, cardWidth, cardHeight, 4, 4, 'S');
    
    // Valor con tipografía mejorada
    doc.setTextColor(...COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(stat.value.toString(), x + cardWidth/2, yPosition + 11, { align: 'center' });
    
    // Label con estilo
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(stat.label, x + cardWidth/2, yPosition + 19, { align: 'center' });
  });
  
  return yPosition + cardHeight + 15;
}

// Función para agregar sección de máquina
function addMachineSection(
  doc: jsPDF,
  machine: Machine,
  data: MaintenancePDFData,
  filters: PDFFilters,
  isLandscape: boolean,
  startY: number
): number {
  let yPosition = startY;
  
  // Header de máquina con diseño moderno
  doc.setFillColor(...COLORS.secondary);
  doc.rect(20, yPosition, isLandscape ? 257 : 170, 14, 'F');
  
  // Línea decorativa
  doc.setFillColor(...COLORS.accent);
  doc.rect(20, yPosition + 11, isLandscape ? 257 : 170, 3, 'F');
  
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(machine.name, 25, yPosition + 8);
  
  // Información adicional de la máquina
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const machineInfo = `${machine.type} | ${machine.status}${machine.sector ? ` | ${machine.sector.name}` : ''}`;
  doc.text(machineInfo, isLandscape ? 200 : 140, yPosition + 8, { align: 'right' });
  
  yPosition += 20;
  
  // Mantenimientos preventivos
  if (filters.maintenanceTypes.includes('PREVENTIVE')) {
    const preventives = data.preventiveMaintenances.filter(m => m.machineId === machine.id);
    if (preventives.length > 0) {
      yPosition = addMaintenanceTable(doc, preventives, 'preventive', isLandscape, yPosition);
    }
  }
  
  // Mantenimientos correctivos
  if (filters.maintenanceTypes.includes('CORRECTIVE')) {
    const correctives = data.correctiveMaintenances.filter(m => m.machineId === machine.id);
    if (correctives.length > 0) {
      yPosition = addMaintenanceTable(doc, correctives, 'corrective', isLandscape, yPosition);
    }
  }
  
  return yPosition + 10;
}

// Función para agregar tabla de mantenimientos
function addMaintenanceTable(
  doc: jsPDF,
  maintenances: any[],
  type: 'preventive' | 'corrective',
  isLandscape: boolean,
  startY: number
): number {
  // Título de la tabla
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(
    type === 'preventive' ? 'Mantenimientos Preventivos' : 'Mantenimientos Correctivos',
    20,
    startY
  );
  
  const tableStartY = startY + 8;
  
  if (type === 'preventive') {
    const tableData = maintenances.map(m => [
      m.title,
      m.description || 'Sin descripción',
      formatFrequency(m.frequency, m.frequencyUnit),
      formatPriority(m.priority),
      m.instances?.length?.toString() || '0'
    ]);
    
    (doc as any).autoTable({
      startY: tableStartY,
      head: [['Título', 'Descripción', 'Frecuencia', 'Prioridad', 'Instancias']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: isLandscape ? 9 : 8,
        cellPadding: isLandscape ? 8 : 6,
        overflow: 'linebreak',
        halign: 'left',
        valign: 'middle',
        lineColor: COLORS.border,
        lineWidth: 0.3,
        textColor: COLORS.text,
        fillColor: COLORS.white
      },
      headStyles: {
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontStyle: 'bold',
        fontSize: isLandscape ? 10 : 9,
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: COLORS.background
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: isLandscape ? 60 : 45 },
        1: { halign: 'left', cellWidth: isLandscape ? 100 : 70 },
        2: { halign: 'center', cellWidth: isLandscape ? 40 : 30 },
        3: { halign: 'center', cellWidth: isLandscape ? 30 : 25 },
        4: { halign: 'center', cellWidth: isLandscape ? 25 : 20 }
      },
      margin: { left: 20, right: 20 }
    });
  } else {
    const tableData = maintenances.map(m => [
      m.title,
      formatMaintenanceType(m.type),
      formatPriority(m.priority),
      formatStatus(m.status),
      m.scheduledDate ? new Date(m.scheduledDate).toLocaleDateString('es-ES') : 'No programado',
      m.assignedTo?.name || 'Sin asignar',
      m.cost ? `$${m.cost.toFixed(2)}` : 'No especificado'
    ]);
    
    (doc as any).autoTable({
      startY: tableStartY,
      head: [['Título', 'Tipo', 'Prioridad', 'Estado', 'Fecha', 'Asignado', 'Costo']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: isLandscape ? 9 : 8,
        cellPadding: isLandscape ? 8 : 6,
        overflow: 'linebreak',
        halign: 'left',
        valign: 'middle',
        lineColor: COLORS.border,
        lineWidth: 0.3,
        textColor: COLORS.text,
        fillColor: COLORS.white
      },
      headStyles: {
        fillColor: COLORS.warning,
        textColor: COLORS.white,
        fontStyle: 'bold',
        fontSize: isLandscape ? 10 : 9,
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: COLORS.background
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: isLandscape ? 50 : 35 },
        1: { halign: 'center', cellWidth: isLandscape ? 30 : 25 },
        2: { halign: 'center', cellWidth: isLandscape ? 25 : 20 },
        3: { halign: 'center', cellWidth: isLandscape ? 25 : 20 },
        4: { halign: 'center', cellWidth: isLandscape ? 35 : 30 },
        5: { halign: 'left', cellWidth: isLandscape ? 40 : 30 },
        6: { halign: 'center', cellWidth: isLandscape ? 30 : 25 }
      },
      margin: { left: 20, right: 20 }
    });
  }
  
  return (doc as any).lastAutoTable.finalY + 15;
}

// Función para agregar sección del responsable (PDF Control)
function addResponsibleSection(doc: jsPDF, startY: number): number {
  let yPosition = startY;
  
  // Campo para responsable
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('RESPONSABLE:', 20, yPosition);
  
  // Línea para escribir
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(60, yPosition, 200, yPosition);
  
  yPosition += 10;
  
  // Campo para fecha
  doc.text('FECHA:', 20, yPosition);
  doc.line(45, yPosition, 120, yPosition);
  
  doc.text('FIRMA:', 140, yPosition);
  doc.line(165, yPosition, 240, yPosition);
  
  return yPosition + 20;
}

// Función para agregar tabla de control
function addControlTable(
  doc: jsPDF,
  data: MaintenancePDFData,
  filters: PDFFilters,
  startY: number
): number {
  let yPosition = startY;
  
  // Título
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LISTA DE CONTROL', 20, yPosition);
  
  yPosition += 15;
  
  // Combinar todos los mantenimientos
  const allMaintenances: any[] = [];
  
  if (filters.maintenanceTypes.includes('PREVENTIVE')) {
    data.preventiveMaintenances.forEach(m => {
      allMaintenances.push({
        ...m,
        type: 'PREVENTIVE',
        isPreventive: true
      });
    });
  }
  
  if (filters.maintenanceTypes.includes('CORRECTIVE')) {
    data.correctiveMaintenances.forEach(m => {
      allMaintenances.push({
        ...m,
        isPreventive: false
      });
    });
  }
  
  // Ordenar por máquina
  allMaintenances.sort((a, b) => {
    const machineA = a.machine?.name || '';
    const machineB = b.machine?.name || '';
    return machineA.localeCompare(machineB);
  });
  
  // Crear tabla de control
  const tableData = allMaintenances.map(maintenance => [
    '☐', // Checkbox
    maintenance.title,
    maintenance.machine?.name || 'Sin máquina',
    formatMaintenanceType(maintenance.type),
    maintenance.isPreventive 
      ? formatFrequency(maintenance.frequency, maintenance.frequencyUnit)
      : formatStatus(maintenance.status),
    formatPriority(maintenance.priority),
    '' // Observaciones
  ]);
  
  (doc as any).autoTable({
    startY: yPosition,
    head: [['✓', 'Mantenimiento', 'Máquina', 'Tipo', 'Frecuencia/Estado', 'Prioridad', 'Observaciones']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 8,
      overflow: 'linebreak',
      halign: 'left',
      valign: 'middle',
      lineColor: COLORS.border,
      lineWidth: 0.5,
      textColor: COLORS.text
    },
    headStyles: {
      fillColor: COLORS.dark,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { halign: 'left', cellWidth: 60 },
      2: { halign: 'left', cellWidth: 50 },
      3: { halign: 'center', cellWidth: 35 },
      4: { halign: 'center', cellWidth: 45 },
      5: { halign: 'center', cellWidth: 30 },
      6: { halign: 'left', cellWidth: 50 }
    },
    margin: { left: 20, right: 20 }
  });
  
  return (doc as any).lastAutoTable.finalY + 20;
}

// Función para agregar sección de observaciones
function addObservationsSection(doc: jsPDF, startY: number): void {
  let yPosition = startY;
  
  // Verificar si hay espacio
  if (yPosition > 150) {
    doc.addPage('landscape', 'mm', 'a4');
    yPosition = 20;
  }
  
  // Título
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('OBSERVACIONES GENERALES', 20, yPosition);
  
  yPosition += 10;
  
  // Caja para observaciones
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(1);
  doc.rect(20, yPosition, 257, 60);
  
  // Líneas para escribir
  for (let i = 0; i < 8; i++) {
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(25, yPosition + 8 + (i * 7), 272, yPosition + 8 + (i * 7));
  }
}

// Función para descargar el PDF
export function downloadMaintenancePDF(
  data: MaintenancePDFData,
  filters: PDFFilters,
  companyName: string = 'Empresa'
): void {
  const doc = generateMaintenancePDF(data, filters, companyName);
  
  const orientationText = filters.orientation === 'horizontal' ? 'horizontal' : 'vertical';
  const typeText = filters.pdfType === 'listado' ? 'listado' : 'control';
  const date = new Date().toISOString().split('T')[0];
  
  doc.save(`mantenimientos_${typeText}_${orientationText}_${date}.pdf`);
}
