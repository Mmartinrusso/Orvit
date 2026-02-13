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
  orientation: 'horizontal' | 'vertical';
  displayType: 'screen' | 'pdf';
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
  if (filters.orientation === 'horizontal') {
    return generateListadoHorizontalPDF(data, filters, companyName);
  } else {
    return generateListadoVerticalPDF(data, filters, companyName);
  }
}

// Función para crear header profesional para listado
function addListHeader(doc: jsPDF, title: string, companyName: string, isLandscape: boolean = false) {
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
  const cardWidth = isLandscape ? 60 : 85;
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
  yPosition = addListHeader(doc, 'Listado de Mantenimientos', companyName, true);
  
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
  console.log('🔍 Generando PDF con datos:', {
    preventive: data.preventiveMaintenances.length,
    corrective: data.correctiveMaintenances.length,
    machines: data.machines.length,
    filters: filters
  });
  
  if (filters.maintenanceTypes.includes('PREVENTIVE')) {
    console.log('📋 Agregando sección preventivos...');
    yPosition = addMaintenancePhase(doc, 'Fase 1: Mantenimientos Preventivos', 
      'Mantenimientos programados y preventivos', data.preventiveMaintenances, 
      data.machines, filters, true, yPosition, 'preventive');
  }
  
  if (filters.maintenanceTypes.includes('CORRECTIVE')) {
    console.log('🚨 Agregando sección correctivos...');
    yPosition = addMaintenancePhase(doc, 'Fase 2: Mantenimientos Correctivos', 
      'Mantenimientos correctivos y reparaciones', data.correctiveMaintenances, 
      data.machines, filters, true, yPosition, 'corrective');
  }

  // Footer simple solo con información
  addSimpleFooter(doc, true);

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
  yPosition = addListHeader(doc, 'Listado de Mantenimientos', companyName, false);
  
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
  if (filters.maintenanceTypes.includes('PREVENTIVE')) {
    yPosition = addMaintenancePhase(doc, 'Fase 1: Mantenimientos Preventivos', 
      'Mantenimientos programados y preventivos', data.preventiveMaintenances, 
      data.machines, filters, false, yPosition, 'preventive');
  }
  
  if (filters.maintenanceTypes.includes('CORRECTIVE')) {
    yPosition = addMaintenancePhase(doc, 'Fase 2: Mantenimientos Correctivos', 
      'Mantenimientos correctivos y reparaciones', data.correctiveMaintenances, 
      data.machines, filters, false, yPosition, 'corrective');
  }

  // Footer simple solo con información
  addSimpleFooter(doc, false);

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
  
  // Verificar si necesita nueva página para el título de la fase
  yPosition = checkNewPage(doc, yPosition, 30, isLandscape);
  
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
  console.log(`🔍 ${type} - Procesando ${maintenances.length} mantenimientos`);
  console.log('Máquinas disponibles:', machines.map(m => ({ id: m.id, name: m.name })));
  console.log('Filtros de máquinas:', filters.machineIds);
  
  maintenances.forEach((maint, index) => {
    const machine = machines.find(m => m.id === maint.machineId);
    console.log(`📋 Mantenimiento ${index + 1}: ${maint.title} (MachineId: ${maint.machineId})`);
    console.log(`🔧 Máquina encontrada:`, machine ? `${machine.name} (ID: ${machine.id})` : 'NO ENCONTRADA');
    console.log(`✅ ¿Incluir en filtro?`, machine && filters.machineIds.includes(machine.id));
    
    if (machine && filters.machineIds.includes(machine.id)) {
      
      // Verificar si necesita nueva página (estimamos 40mm por ítem)
      yPosition = checkNewPage(doc, yPosition, 40, isLandscape);
      
      // Card de mantenimiento (igual que pantalla)
      const cardHeight = 25;
      const cardWidth = pageWidth - 30;
      
      // Fondo de la card
      doc.setFillColor(...COLORS.white);
      doc.roundedRect(15, yPosition - 5, cardWidth, cardHeight, 3, 3, 'F');
      
      // Borde de la card (verde para preventivo, rojo para correctivo)
      const borderColor = type === 'preventive' ? COLORS.success : [239, 68, 68];
      doc.setDrawColor(...borderColor);
      doc.setLineWidth(2);
      doc.line(15, yPosition - 5, 15, yPosition + cardHeight - 5);
      
      // Borde completo sutil
      doc.setDrawColor(...COLORS.border);
      doc.setLineWidth(0.5);
      doc.roundedRect(15, yPosition - 5, cardWidth, cardHeight, 3, 3, 'S');
      
      // Título del mantenimiento con ID
      doc.setTextColor(...COLORS.text);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`ID: ${maint.id} - ${maint.title}`, 20, yPosition + 2);
      
      // Descripción (si existe)
      if (maint.description) {
        doc.setTextColor(...COLORS.textLight);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const shortDesc = maint.description.length > 80 ? 
          maint.description.substring(0, 80) + '...' : maint.description;
        doc.text(shortDesc, 20, yPosition + 8);
      }
      
      // Información adicional (frecuencia, duración, etc.)
      doc.setTextColor(...COLORS.textLight);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      if (type === 'preventive') {
        const freqText = formatFrequency(maint.frequency, maint.frequencyUnit);
        const durationText = `${maint.estimatedDuration} ${maint.durationType === 'HOURS' ? 'horas' : 'días'}`;
        doc.text(`📅 ${freqText} | ⏱️ ${durationText}`, 20, yPosition + 14);
      } else {
        const statusText = formatStatus(maint.status);
        const costText = maint.estimatedCost ? `$${maint.estimatedCost}` : '';
        doc.text(`Estado: ${statusText}${costText ? ` | Costo estimado: ${costText}` : ''}`, 20, yPosition + 14);
      }
      
      // Tags en el lado derecho
      const tags = [];
      if (type === 'preventive') {
        tags.push({ text: 'Preventivo', color: COLORS.success });
        tags.push({ text: formatPriority(maint.priority), color: type === 'preventive' ? COLORS.primary : COLORS.warning });
        tags.push({ text: 'Obligatorio', color: COLORS.warning });
      } else {
        tags.push({ text: 'Correctivo', color: [239, 68, 68] });
        tags.push({ text: formatPriority(maint.priority), color: COLORS.primary });
        tags.push({ text: 'Obligatorio', color: COLORS.warning });
      }
      
      let tagX = pageWidth - 20;
      tags.forEach(tag => {
        const tagWidth = doc.getTextWidth(tag.text) + 6;
        tagX -= tagWidth + 3;
        
        // Fondo del tag
        doc.setFillColor(...tag.color);
        doc.roundedRect(tagX, yPosition - 3, tagWidth, 8, 2, 2, 'F');
        
        // Texto del tag
        doc.setTextColor(...COLORS.white);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(tag.text, tagX + 3, yPosition + 1);
      });
      
      yPosition += cardHeight + 5;
    }
  });
  
  return yPosition + 10;
}


// Función para verificar si necesita nueva página
function checkNewPage(doc: jsPDF, currentY: number, requiredSpace: number, isLandscape: boolean): number {
  const pageHeight = isLandscape ? 210 : 297;
  const marginBottom = 40; // Espacio reservado para footer simple
  
  if (currentY + requiredSpace > pageHeight - marginBottom) {
    doc.addPage();
    return 20; // Margen superior de nueva página
  }
  return currentY;
}

// Función para agregar footer simple solo con información
function addSimpleFooter(doc: jsPDF, isLandscape: boolean) {
  const pageWidth = isLandscape ? 297 : 210;
  const pageHeight = isLandscape ? 210 : 297;
  const totalPages = doc.internal.pages.length - 1; // -1 porque la primera es vacía
  
  // Agregar footer a todas las páginas
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    
    const footerY = pageHeight - 25;
    
    // Línea decorativa
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.5);
    doc.line(20, footerY - 5, pageWidth - 20, footerY - 5);
    
    // Información del sistema centrada
    doc.setTextColor(...COLORS.textLight);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Listado generado automáticamente por el sistema de mantenimiento', pageWidth / 2, footerY, { align: 'center' });
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })}`, pageWidth / 2, footerY + 8, { align: 'center' });
    
    // Número de página
    doc.setTextColor(...COLORS.textLight);
    doc.setFontSize(8);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - 15, footerY + 15, { align: 'right' });
  }
}

// Función para descargar el PDF
export function downloadMaintenancePDF(
  data: MaintenancePDFData,
  filters: PDFFilters,
  companyName: string = 'Empresa'
) {
  // Solo generar PDF si displayType es 'pdf'
  if (filters.displayType === 'pdf') {
    const doc = generateMaintenancePDF(data, filters, companyName);
    const fileName = `mantenimiento_listado_${filters.orientation}_${new Date().getTime()}.pdf`;
    doc.save(fileName);
  }
}
