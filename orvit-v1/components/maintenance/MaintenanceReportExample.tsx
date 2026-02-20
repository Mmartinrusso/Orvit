'use client';

/**
 * EXAMPLE: How to use the MaintenanceReportModal component
 * 
 * This file demonstrates how to integrate the printable maintenance report modal
 * into your application with mock data.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { MaintenanceReportModalWrapper } from './MaintenanceReportModal';
import type { MaintenanceReportData } from '@/types/maintenance-report';

// ============================================
// MOCK DATA EXAMPLE
// ============================================

const mockReportData: MaintenanceReportData = {
 companyName: 'Pretensados Cordoba',
 title: 'Listado de Mantenimientos',
 subtitle: 'Reporte de mantenimientos preventivos y correctivos',
 generatedAt: '25 de diciembre de 2025',
 
 summaryCards: [
 { label: 'Categoría', value: 'Mantenimiento', tone: 'blue' },
 { label: 'Frecuencia', value: 'Mensual (16-30 días)', tone: 'green' },
 { label: 'Total Items', value: 38, tone: 'purple' },
 { label: 'Tiempo Estimado', value: '0 min', tone: 'orange' },
 ],
 
 appliedFilters: [
 { label: 'Máquinas', value: 'Caldera Vapor, Carro de Mezcla, Cortadora Viguetas N° 1' },
 { label: 'Tipos', value: 'Preventivo, Correctivo' },
 ],
 
 machines: [
 {
 id: 1,
 name: 'Carro de Mezcla',
 code: 'CM-001',
 totalCount: 27,
 metaRightTop: 'Máquina 1',
 metaRightBottom: 'Producción • Activa',
 groups: [
 {
 title: 'Mantenimientos Preventivos',
 count: 27,
 tone: 'green',
 icon: 'wrench',
 items: [
 {
 id: 887,
 name: 'Cable de alimentación general',
 description: `a.\tControlar arrollamiento de cable en canasto
b.\tControlar aislación del cable`,
 frequencyLabel: 'Mensual (16-30 días)',
 durationLabel: '30 min',
 nextDateLabel: '10/12/2025',
 tags: [
 { label: 'Preventivo', tone: 'green' },
 { label: 'Media', tone: 'yellow' },
 { label: 'Obligatorio', tone: 'orange' },
 ],
 },
 {
 id: 882,
 name: 'Corona eje conducido motriz de traslado',
 description: `a.\tControlar desgaste de dientes de corona
b.\tControlar alineación entre piñón y corona`,
 frequencyLabel: 'Mensual (16-30 días)',
 durationLabel: '30 min',
 nextDateLabel: '10/12/2025',
 tags: [
 { label: 'Preventivo', tone: 'green' },
 { label: 'Media', tone: 'yellow' },
 { label: 'Obligatorio', tone: 'orange' },
 ],
 },
 {
 id: 877,
 name: 'Eje conducido de conjunto motriz de traslado',
 description: 'a.\t controlar alineación',
 frequencyLabel: 'Mensual (16-30 días)',
 durationLabel: '30 min',
 nextDateLabel: '10/12/2025',
 tags: [
 { label: 'Preventivo', tone: 'green' },
 { label: 'Media', tone: 'yellow' },
 { label: 'Obligatorio', tone: 'orange' },
 ],
 },
 {
 id: 872,
 name: 'Cadena de conjunto motriz de traslado',
 description: `a.\tControlar limpieza
b.\tControlar desgaste de eslabones
c.\tLubricar con aceite quemado, no exceder en la cantidad de aceite`,
 frequencyLabel: 'Mensual (16-30 días)',
 durationLabel: '30 min',
 nextDateLabel: '10/12/2025',
 tags: [
 { label: 'Preventivo', tone: 'green' },
 { label: 'Media', tone: 'yellow' },
 { label: 'Obligatorio', tone: 'orange' },
 ],
 },
 {
 id: 867,
 name: 'Piñón de conjunto motriz de traslado',
 description: `a.\tControlar desgaste de dientes
b.\tControlar que no le falte el prisionero`,
 frequencyLabel: 'Mensual (16-30 días)',
 durationLabel: '30 min',
 nextDateLabel: '10/12/2025',
 tags: [
 { label: 'Preventivo', tone: 'green' },
 { label: 'Media', tone: 'yellow' },
 { label: 'Obligatorio', tone: 'orange' },
 ],
 },
 ],
 },
 ],
 },
 {
 id: 2,
 name: 'Cortadora Viguetas N° 1',
 code: 'CV-001',
 totalCount: 11,
 metaRightTop: 'Máquina 2',
 metaRightBottom: 'Producción • Activa',
 groups: [
 {
 title: 'Mantenimientos Preventivos',
 count: 11,
 tone: 'green',
 icon: 'wrench',
 items: [
 {
 id: 1222,
 name: 'Cable de alimentación eléctrica',
 description: `a.\tControlar aislación del cable
b.\tControlar que se arrolla correctamente en canasto
c.\tControlar que la ficha de conexión no este rota`,
 frequencyLabel: 'Mensual (16-30 días)',
 durationLabel: '30 min',
 nextDateLabel: '22/12/2025',
 tags: [
 { label: 'Preventivo', tone: 'green' },
 { label: 'Media', tone: 'yellow' },
 { label: 'Obligatorio', tone: 'orange' },
 ],
 },
 {
 id: 1217,
 name: 'Ruedas libres',
 description: 'a.\tRepetir control de punto numero 9',
 frequencyLabel: 'Mensual (16-30 días)',
 durationLabel: '30 min',
 nextDateLabel: '22/12/2025',
 tags: [
 { label: 'Preventivo', tone: 'green' },
 { label: 'Media', tone: 'yellow' },
 { label: 'Obligatorio', tone: 'orange' },
 ],
 },
 {
 id: 1212,
 name: 'Ruedas motrices',
 description: `a.\tControlar desgaste
b.\tControlar que estén puestas las tapas de las cajas porta ruedas
c.\tControlar rodamiento de ruedas motrices`,
 frequencyLabel: 'Mensual (16-30 días)',
 durationLabel: '30 min',
 nextDateLabel: '22/12/2025',
 tags: [
 { label: 'Preventivo', tone: 'green' },
 { label: 'Media', tone: 'yellow' },
 { label: 'Obligatorio', tone: 'orange' },
 ],
 },
 {
 id: 1207,
 name: 'Eje de transmisión de movimiento de cabezal de corte',
 description: `a.\tControlar piñones de transmisión en ambos lados, desgaste
b.\tControlar que no falten los prisioneros de los piñones
c.\tControlar cadena de transmisión, limpieza, desgaste y lubricar
d.\tcontrolar rodamientos de cajas porta rodamientos del eje de transmisión
e.\tLa cadena de transmisión del carro de movimiento del disco de corte, recibe polvillo con agua, debido a que el disco de corte requiere agua para enfriarse mientras está cortando.
f.\tPara realizar un mantenimiento correcto de esta cadena, se requiere lo siguiente:
i.\tPosterior a finalizar los trabajos de corte de viguetas
ii.\tLavar la cadena con agua a presión
iii.\tSopletear la cadena con gasoil, utilizando un pulverizador
iv.\tEngrasar la cadena manualmente, con una espátula, cubriendo el ancho de la cadena y toda su longitud.
g.\tVerificar que los eslabones, formados por la placa exterior e interior y rodillos, no estén endurecidos debido a suciedad o falta de lubricación.`,
 frequencyLabel: 'Mensual (16-30 días)',
 durationLabel: '1 hora',
 nextDateLabel: '22/12/2025',
 tags: [
 { label: 'Preventivo', tone: 'green' },
 { label: 'Media', tone: 'yellow' },
 { label: 'Obligatorio', tone: 'orange' },
 ],
 },
 {
 id: 1172,
 name: 'Estructura chasis de la cortadora',
 description: `a.\tControlar soldaduras o partes fisuradas o con desgaste
b.\tControlar que no existan piezas sueltas o bulones flojos
c.\tControlar limpieza
d.\tControlar que el tablero eléctrico este firmemente ajustado y la tapa cerrada`,
 frequencyLabel: 'Mensual (16-30 días)',
 durationLabel: '30 min',
 nextDateLabel: '22/12/2025',
 tags: [
 { label: 'Preventivo', tone: 'green' },
 { label: 'Media', tone: 'yellow' },
 { label: 'Obligatorio', tone: 'orange' },
 ],
 },
 ],
 },
 {
 title: 'Mantenimientos Correctivos',
 count: 2,
 tone: 'red',
 icon: 'alert-triangle',
 items: [
 {
 id: 9001,
 name: 'Reparación de motor principal',
 description: 'Cambio de rodamientos del motor de accionamiento principal debido a ruidos anormales detectados.',
 frequencyLabel: 'A demanda',
 durationLabel: '4 horas',
 tags: [
 { label: 'Correctivo', tone: 'red' },
 { label: 'Alta', tone: 'red' },
 { label: 'Urgente', tone: 'amber' },
 ],
 },
 {
 id: 9002,
 name: 'Cambio de disco de corte',
 description: 'El disco de corte presenta desgaste excesivo y requiere reemplazo inmediato.',
 frequencyLabel: 'A demanda',
 durationLabel: '2 horas',
 tags: [
 { label: 'Correctivo', tone: 'red' },
 { label: 'Media', tone: 'yellow' },
 ],
 },
 ],
 },
 ],
 },
 ],
};

// ============================================
// EXAMPLE COMPONENT
// ============================================

export function MaintenanceReportExample() {
 const [isOpen, setIsOpen] = useState(false);

 return (
 <div className="p-4">
 <Button onClick={() => setIsOpen(true)} className="flex items-center gap-2">
 <FileText className="h-4 w-4" />
 Ver Reporte de Mantenimientos
 </Button>

 <MaintenanceReportModalWrapper
 open={isOpen}
 onOpenChange={setIsOpen}
 report={mockReportData}
 />
 </div>
 );
}

// ============================================
// USAGE EXAMPLE WITH REAL DATA
// ============================================

/**
 * Example of how to transform your real maintenance data into the report format:
 * 
 * ```tsx
 * import { MaintenanceReportModalWrapper } from '@/components/maintenance/MaintenanceReportModal';
 * import type { MaintenanceReportData, MachineSection, MaintenanceGroup } from '@/types/maintenance-report';
 * 
 * // In your component:
 * const [showReport, setShowReport] = useState(false);
 * 
 * // Transform your data to the report format
 * const reportData: MaintenanceReportData = {
 * companyName: company.name,
 * title: 'Listado de Mantenimientos',
 * generatedAt: format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es }),
 * summaryCards: [
 * { label: 'Categoría', value: selectedCategory, tone: 'blue' },
 * { label: 'Frecuencia', value: selectedFrequency, tone: 'green' },
 * { label: 'Total Items', value: totalItems, tone: 'purple' },
 * { label: 'Tiempo Estimado', value: `${totalMinutes} min`, tone: 'orange' },
 * ],
 * appliedFilters: [
 * { label: 'Máquinas', value: selectedMachines.join(', ') },
 * { label: 'Tipos', value: selectedTypes.join(', ') },
 * ],
 * machines: maintenances.map(m => ({
 * id: m.machineId,
 * name: m.machineName,
 * totalCount: m.items.length,
 * metaRightTop: `Máquina ${m.order}`,
 * metaRightBottom: `${m.sector} • ${m.status}`,
 * groups: groupByType(m.items), // Your grouping logic
 * })),
 * };
 * 
 * return (
 * <>
 * <Button onClick={() => setShowReport(true)}>
 * Generar Reporte
 * </Button>
 * <MaintenanceReportModalWrapper
 * open={showReport}
 * onOpenChange={setShowReport}
 * report={reportData}
 * />
 * </>
 * );
 * ```
 */

export default MaintenanceReportExample;

