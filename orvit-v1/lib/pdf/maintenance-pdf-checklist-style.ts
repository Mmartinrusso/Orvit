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

// Colores profesionales del checklist
const COLORS = {
  primary: [52, 152, 219] as [number, number, number],    // Azul principal
  secondary: [236, 240, 241] as [number, number, number], // Gris muy claro
  accent: [41, 128, 185] as [number, number, number],     // Azul oscuro
  text: [44, 62, 80] as [number, number, number],         // Texto principal
  textLight: [127, 140, 141] as [number, number, number], // Texto secundario
  success: [39, 174, 96] as [number, number, number],     // Verde
  warning: [243, 156, 18] as [number, number, number],    // Naranja
  white: [255, 255, 255] as [number, number, number],     // Blanco
  border: [189, 195, 199] as [number, number, number],    // Bordes
  background: [248, 249, 250] as [number, number, number] // Fondo
};

// Funciones de formateo en español
function formatPriority(priority: string): string {
  const priorityMap: { [key: string]: string } = {
    'HIGH': 'Alta',
    'MEDIUM': 'Media', 
    'LOW': 'Baja',
    'URGENT': 'Urgente'
  };
  return priorityMap[priority?.toUpperCase()] || priority || 'Media';
}

function formatMaintenanceType(type: string): string {
  const typeMap: { [key: string]: string } = {
    'PREVENTIVE': 'Preventivo',
    'CORRECTIVE': 'Correctivo',
    'PREDICTIVE': 'Predictivo',
    'EMERGENCY': 'Emergencia'
  };
  return typeMap[type?.toUpperCase()] || type || 'Mantenimiento';
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
  return statusMap[status?.toUpperCase()] || status || 'Pendiente';
}

function formatFrequency(frequency: number, unit: string): string {
  if (!frequency || !unit) return 'Diario';
  
  const unitMap: { [key: string]: string } = {
    'DAYS': 'días',
    'WEEKS': 'semanas', 
    'MONTHS': 'meses',
    'YEARS': 'años',
    'HOURS': 'horas',
    'KILOMETERS': 'kilómetros'
  };
  
  const unitText = unitMap[unit.toUpperCase()] || unit.toLowerCase();
  if (frequency === 1 && unit.toUpperCase() === 'DAYS') {
    return 'Diario';
  }
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

// Función para crear header profesional estilo checklist
function addChecklistHeader(doc: jsPDF, title: string, companyName: string, isLandscape: boolean = false) {
  const pageWidth = isLandscape ? 297 : 210;
  
  // Información superior izquierda
  doc.setTextColor(...COLORS.textLight);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${new Date().toLocaleDateString('es-ES', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  })}, ${new Date().toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })}`, 15, 20);
  
  // Información superior derecha
  doc.text(`${title} - ${companyName}`, pageWidth - 15, 20, { align: 'right' });
  
  // Título principal centrado
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isLandscape ? 22 : 20);
  doc.text(companyName, pageWidth / 2, 45, { align: 'center' });
  
  // Subtítulo
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(isLandscape ? 14 : 12);
  doc.text(title, pageWidth / 2, 55, { align: 'center' });
  
  // Fecha de generación
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.textLight);
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long', 
    year: 'numeric'
  })}`, pageWidth / 2, 65, { align: 'center' });
  
  // Línea decorativa
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(1);
  doc.line(15, 75, pageWidth - 15, 75);
  
  return 85; // Retorna la posición Y donde continuar
}

// Función para agregar tarjetas de resumen estilo checklist
function addSummaryCards(doc: jsPDF, data: MaintenancePDFData, filters: PDFFilters, isLandscape: boolean, startY: number) {
  let yPosition = startY;
  const pageWidth = isLandscape ? 297 : 210;
  const cardWidth = isLandscape ? 65 : 85;
  const cardHeight = 35;
  const gap = 10;
  
  // Calcular datos
  const preventiveCount = data.preventiveMaintenances.filter(m => {
    const machine = data.machines.find(machine => machine.id === m.machineId);
    return machine && filters.machineIds.includes(machine.id);
  }).length;
  
  const correctiveCount = data.correctiveMaintenances.filter(m => {
    const machine = data.machines.find(machine => machine.id === m.machineId);
    return machine && filters.machineIds.includes(machine.id);
  }).length;
  
  const totalItems = preventiveCount + correctiveCount;
  const machineCount = data.machines.filter(m => filters.machineIds.includes(m.id)).length;
  
  // Determinar frecuencia más común
  const frequencies = data.preventiveMaintenances
    .filter(m => {
      const machine = data.machines.find(machine => machine.id === m.machineId);
      return machine && filters.machineIds.includes(machine.id);
    })
    .map(m => formatFrequency(m.frequency, m.frequencyUnit));
  const mostCommonFreq = frequencies.length > 0 ? frequencies[0] : 'Diario';
  
  const cards = [
    { label: 'Categoría', value: 'Mantenimiento', color: COLORS.primary },
    { label: 'Frecuencia', value: mostCommonFreq, color: COLORS.primary },
    { label: 'Total Items', value: totalItems.toString(), color: COLORS.primary },
    { label: 'Tiempo Estimado', value: '0 min', color: COLORS.primary }
  ];
  
  // Calcular posición inicial para centrar las tarjetas
  const totalWidth = (cardWidth * cards.length) + (gap * (cards.length - 1));
  let startX = (pageWidth - totalWidth) / 2;
  
  cards.forEach((card, index) => {
    const x = startX + (cardWidth + gap) * index;
    
    // Fondo de la tarjeta
    doc.setFillColor(...COLORS.secondary);
    doc.roundedRect(x, yPosition, cardWidth, cardHeight, 3, 3, 'F');
    
    // Borde sutil
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, yPosition, cardWidth, cardHeight, 3, 3, 'S');
    
    // Label
    doc.setTextColor(...COLORS.textLight);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(card.label, x + cardWidth/2, yPosition + 12, { align: 'center' });
    
    // Value
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(card.value, x + cardWidth/2, yPosition + 24, { align: 'center' });
  });
  
  return yPosition + cardHeight + 20;
}

// 1. LISTADO HORIZONTAL - Estilo checklist profesional
function generateListadoHorizontalPDF(
  data: MaintenancePDFData,
  filters: PDFFilters,
  companyName: string
) {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = 297;
  let yPosition = 20;

  // Header profesional
  yPosition = addChecklistHeader(doc, 'Listado de Mantenimientos', companyName, true);
  
  // Tarjetas de resumen
  yPosition = addSummaryCards(doc, data, filters, true, yPosition);
  
  // Título de sección
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Items del Listado', 15, yPosition);
  
  // Línea decorativa
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(15, yPosition + 5, pageWidth - 15, yPosition + 5);
  
  yPosition += 15;

  // Procesar mantenimientos por fases/secciones
  if (filters.maintenanceTypes.includes('PREVENTIVE') && data.preventiveMaintenances.length > 0) {
    yPosition = addMaintenancePhase(doc, 'Fase 1: Mantenimientos Preventivos', 
      'Mantenimientos programados y preventivos', data.preventiveMaintenances, 
      data.machines, filters, true, yPosition, 'preventive');
  }
  
  if (filters.maintenanceTypes.includes('CORRECTIVE') && data.correctiveMaintenances.length > 0) {
    yPosition = addMaintenancePhase(doc, 'Fase 2: Mantenimientos Correctivos', 
      'Mantenimientos correctivos y reparaciones', data.correctiveMaintenances, 
      data.machines, filters, true, yPosition, 'corrective');
  }

  // Footer estilo checklist
  addChecklistFooter(doc, 'Ejecutado por', 'Supervisado por', true);

  return doc;
}

// 2. LISTADO VERTICAL - Estilo checklist profesional
function generateListadoVerticalPDF(
  data: MaintenancePDFData,
  filters: PDFFilters,
  companyName: string
) {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = 210;
  let yPosition = 20;

  // Header profesional
  yPosition = addChecklistHeader(doc, 'Listado de Mantenimientos', companyName, false);
  
  // Tarjetas de resumen
  yPosition = addSummaryCards(doc, data, filters, false, yPosition);
  
  // Título de sección
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Items del Listado', 15, yPosition);
  
  // Línea decorativa
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(15, yPosition + 5, pageWidth - 15, yPosition + 5);
  
  yPosition += 15;

  // Procesar mantenimientos por fases/secciones
  if (filters.maintenanceTypes.includes('PREVENTIVE') && data.preventiveMaintenances.length > 0) {
    yPosition = addMaintenancePhase(doc, 'Fase 1: Mantenimientos Preventivos', 
      'Mantenimientos programados y preventivos', data.preventiveMaintenances, 
      data.machines, filters, false, yPosition, 'preventive');
  }
  
  if (filters.maintenanceTypes.includes('CORRECTIVE') && data.correctiveMaintenances.length > 0) {
    yPosition = addMaintenancePhase(doc, 'Fase 2: Mantenimientos Correctivos', 
      'Mantenimientos correctivos y reparaciones', data.correctiveMaintenances, 
      data.machines, filters, false, yPosition, 'corrective');
  }

  // Footer estilo checklist
  addChecklistFooter(doc, 'Ejecutado por', 'Supervisado por', false);

  return doc;
}

// 3. CONTROL HORIZONTAL - Estilo checklist profesional
function generateControlHorizontalPDF(
  data: MaintenancePDFData,
  filters: PDFFilters,
  companyName: string
) {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = 297;
  let yPosition = 20;

  // Header profesional
  yPosition = addChecklistHeader(doc, 'Checklist de Mantenimiento', companyName, true);
  
  // Tarjetas de resumen
  yPosition = addSummaryCards(doc, data, filters, true, yPosition);
  
  // Título de sección
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Items del Checklist', 15, yPosition);
  
  // Línea decorativa
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(15, yPosition + 5, pageWidth - 15, yPosition + 5);
  
  yPosition += 15;

  // Procesar mantenimientos por fases/secciones con checkboxes
  if (filters.maintenanceTypes.includes('PREVENTIVE') && data.preventiveMaintenances.length > 0) {
    yPosition = addMaintenancePhaseControl(doc, 'Fase 1: Mantenimientos Preventivos', 
      'Mantenimientos programados y preventivos', data.preventiveMaintenances, 
      data.machines, filters, true, yPosition, 'preventive');
  }
  
  if (filters.maintenanceTypes.includes('CORRECTIVE') && data.correctiveMaintenances.length > 0) {
    yPosition = addMaintenancePhaseControl(doc, 'Fase 2: Mantenimientos Correctivos', 
      'Mantenimientos correctivos y reparaciones', data.correctiveMaintenances, 
      data.machines, filters, true, yPosition, 'corrective');
  }

  // Footer estilo checklist
  addChecklistFooter(doc, 'Ejecutado por', 'Supervisado por', true);

  return doc;
}

// 4. CONTROL VERTICAL - Estilo checklist profesional
function generateControlVerticalPDF(
  data: MaintenancePDFData,
  filters: PDFFilters,
  companyName: string
) {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = 210;
  let yPosition = 20;

  // Header profesional
  yPosition = addChecklistHeader(doc, 'Checklist de Mantenimiento', companyName, false);
  
  // Tarjetas de resumen
  yPosition = addSummaryCards(doc, data, filters, false, yPosition);
  
  // Título de sección
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Items del Checklist', 15, yPosition);
  
  // Línea decorativa
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(15, yPosition + 5, pageWidth - 15, yPosition + 5);
  
  yPosition += 15;

  // Procesar mantenimientos por fases/secciones con checkboxes
  if (filters.maintenanceTypes.includes('PREVENTIVE') && data.preventiveMaintenances.length > 0) {
    yPosition = addMaintenancePhaseControl(doc, 'Fase 1: Mantenimientos Preventivos', 
      'Mantenimientos programados y preventivos', data.preventiveMaintenances, 
      data.machines, filters, false, yPosition, 'preventive');
  }
  
  if (filters.maintenanceTypes.includes('CORRECTIVE') && data.correctiveMaintenances.length > 0) {
    yPosition = addMaintenancePhaseControl(doc, 'Fase 2: Mantenimientos Correctivos', 
      'Mantenimientos correctivos y reparaciones', data.correctiveMaintenances, 
      data.machines, filters, false, yPosition, 'corrective');
  }

  // Footer estilo checklist
  addChecklistFooter(doc, 'Ejecutado por', 'Supervisado por', false);

  return doc;
}

// Función para agregar fase de mantenimiento (para listados)
function addMaintenancePhase(
  doc: jsPDF, 
  phaseTitle: string, 
  phaseDescription: string,
  maintenances: any[], 
  machines: Machine[], 
  filters: PDFFilters,
  isLandscape: boolean, 
  startY: number, 
  type: 'preventive' | 'corrective'
): number {
  let yPosition = startY;
  const pageWidth = isLandscape ? 297 : 210;
  
  // Título de fase
  doc.setTextColor(...COLORS.warning);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(phaseTitle, 15, yPosition);
  
  yPosition += 8;
  
  // Descripción de fase
  doc.setTextColor(...COLORS.textLight);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text(phaseDescription, 15, yPosition);
  
  yPosition += 15;
  
  // Listar mantenimientos de esta fase
  maintenances.forEach((maint, index) => {
    const machine = machines.find(m => m.id === maint.machineId);
    if (machine && filters.machineIds.includes(machine.id)) {
      
      // ID del mantenimiento
      doc.setTextColor(...COLORS.text);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`ID: ${maint.id} - ${maint.title}`, 15, yPosition);
      
      // Tags de información
      const tags = [];
      if (type === 'preventive') {
        tags.push({ text: 'Obligatorio', color: COLORS.warning });
        tags.push({ text: formatFrequency(maint.frequency, maint.frequencyUnit), color: COLORS.primary });
        tags.push({ text: formatMaintenanceType('PREVENTIVE'), color: COLORS.success });
      } else {
        tags.push({ text: 'Obligatorio', color: COLORS.warning });
        tags.push({ text: formatStatus(maint.status), color: COLORS.primary });
        tags.push({ text: formatMaintenanceType('CORRECTIVE'), color: COLORS.success });
      }
      
      let tagX = pageWidth - 15;
      tags.forEach(tag => {
        const tagWidth = doc.getTextWidth(tag.text) + 8;
        tagX -= tagWidth + 5;
        
        // Fondo del tag
        doc.setFillColor(...tag.color);
        doc.roundedRect(tagX, yPosition - 6, tagWidth, 10, 2, 2, 'F');
        
        // Texto del tag
        doc.setTextColor(...COLORS.white);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(tag.text, tagX + 4, yPosition - 1);
      });
      
      yPosition += 10;
      
      // Descripción del mantenimiento
      if (maint.description) {
        doc.setTextColor(...COLORS.textLight);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(maint.description, pageWidth - 40);
        doc.text(lines, 25, yPosition);
        yPosition += lines.length * 5;
      }
      
      yPosition += 10;
    }
  });
  
  return yPosition + 10;
}

// Función para agregar fase de mantenimiento con control (para checklists)
function addMaintenancePhaseControl(
  doc: jsPDF, 
  phaseTitle: string, 
  phaseDescription: string,
  maintenances: any[], 
  machines: Machine[], 
  filters: PDFFilters,
  isLandscape: boolean, 
  startY: number, 
  type: 'preventive' | 'corrective'
): number {
  let yPosition = startY;
  const pageWidth = isLandscape ? 297 : 210;
  
  // Título de fase
  doc.setTextColor(...COLORS.warning);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(phaseTitle, 15, yPosition);
  
  yPosition += 8;
  
  // Descripción de fase
  doc.setTextColor(...COLORS.textLight);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text(phaseDescription, 15, yPosition);
  
  yPosition += 15;
  
  // Listar mantenimientos de esta fase con checkboxes
  maintenances.forEach((maint, index) => {
    const machine = machines.find(m => m.id === maint.machineId);
    if (machine && filters.machineIds.includes(machine.id)) {
      
      // Checkbox
      doc.setDrawColor(...COLORS.border);
      doc.setLineWidth(1);
      doc.rect(15, yPosition - 4, 5, 5, 'S');
      
      // ID del mantenimiento y título
      doc.setTextColor(...COLORS.text);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`ID: ${maint.id} - ${maint.title}`, 25, yPosition);
      
      // Tags de información
      const tags = [];
      if (type === 'preventive') {
        tags.push({ text: 'Obligatorio', color: COLORS.warning });
        tags.push({ text: formatFrequency(maint.frequency, maint.frequencyUnit), color: COLORS.primary });
        tags.push({ text: formatMaintenanceType('PREVENTIVE'), color: COLORS.success });
      } else {
        tags.push({ text: 'Obligatorio', color: COLORS.warning });
        tags.push({ text: formatStatus(maint.status), color: COLORS.primary });
        tags.push({ text: formatMaintenanceType('CORRECTIVE'), color: COLORS.success });
      }
      
      let tagX = pageWidth - 15;
      tags.forEach(tag => {
        const tagWidth = doc.getTextWidth(tag.text) + 8;
        tagX -= tagWidth + 5;
        
        // Fondo del tag
        doc.setFillColor(...tag.color);
        doc.roundedRect(tagX, yPosition - 6, tagWidth, 10, 2, 2, 'F');
        
        // Texto del tag
        doc.setTextColor(...COLORS.white);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(tag.text, tagX + 4, yPosition - 1);
      });
      
      yPosition += 10;
      
      // Descripción del mantenimiento
      if (maint.description) {
        doc.setTextColor(...COLORS.textLight);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(maint.description, pageWidth - 50);
        doc.text(lines, 25, yPosition);
        yPosition += lines.length * 5;
      }
      
      yPosition += 15;
    }
  });
  
  return yPosition + 10;
}

// Función para agregar footer estilo checklist
function addChecklistFooter(doc: jsPDF, leftTitle: string, rightTitle: string, isLandscape: boolean) {
  const pageWidth = isLandscape ? 297 : 210;
  const pageHeight = isLandscape ? 210 : 297;
  const footerY = pageHeight - 60;
  
  // Cajas de firma
  const boxWidth = isLandscape ? 120 : 80;
  const boxHeight = 40;
  const leftBoxX = 15;
  const rightBoxX = pageWidth - boxWidth - 15;
  
  // Caja izquierda
  doc.setFillColor(...COLORS.secondary);
  doc.roundedRect(leftBoxX, footerY, boxWidth, boxHeight, 3, 3, 'F');
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.roundedRect(leftBoxX, footerY, boxWidth, boxHeight, 3, 3, 'S');
  
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(leftTitle, leftBoxX + boxWidth/2, footerY + 25, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.primary);
  doc.text('Nombre y Firma', leftBoxX + boxWidth/2, footerY + 32, { align: 'center' });
  
  // Caja derecha
  doc.setFillColor(...COLORS.secondary);
  doc.roundedRect(rightBoxX, footerY, boxWidth, boxHeight, 3, 3, 'F');
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.roundedRect(rightBoxX, footerY, boxWidth, boxHeight, 3, 3, 'S');
  
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(rightTitle, rightBoxX + boxWidth/2, footerY + 25, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.primary);
  doc.text('Nombre y Firma', rightBoxX + boxWidth/2, footerY + 32, { align: 'center' });
  
  // Información del sistema
  doc.setTextColor(...COLORS.textLight);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Este checklist fue generado automáticamente por el sistema de mantenimiento', pageWidth / 2, pageHeight - 20, { align: 'center' });
  doc.text(`Fecha de impresión: ${new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })}`, pageWidth / 2, pageHeight - 12, { align: 'center' });
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
