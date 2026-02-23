'use client';

import React, { useRef, useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DateSelectArg, EventClickArg } from '@fullcalendar/core';
import MaintenanceDetailDialog from './MaintenanceDetailDialog';

interface MaintenanceEvent {
 id: string;
 title: string;
 date: string | Date;
 status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
 priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

interface MaintenanceCalendarProps {
 maintenances: any[]; // Array de EnhancedWorkOrder
 onEventClick?: (event: any) => void;
 onEventSelect?: (event: any) => void;
 filters?: {
 selectedMachines: string[];
 selectedUnidadesMoviles: string[];
 maintenanceTypes: string[];
 };
 companyId?: number;
 canEdit?: boolean;
 onEdit?: (maintenance: any) => void;
}

type ViewType = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';

const MaintenanceCalendar: React.FC<MaintenanceCalendarProps> = ({
 maintenances,
 onEventClick,
 onEventSelect,
 filters,
 companyId,
 canEdit = false,
 onEdit
}) => {
 const calendarRef = useRef<FullCalendar>(null);
 const [currentView, setCurrentView] = useState<ViewType>('dayGridMonth');
 const [currentDate, setCurrentDate] = useState<Date>(new Date());
 const [selectedMaintenance, setSelectedMaintenance] = useState<any | null>(null);
 const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

 // Función para obtener colores según tipo, estado y prioridad
 const getEventColors = (maintenance: any) => {
 const rawDateValue = maintenance.scheduledDate || maintenance.nextMaintenanceDate;
 const eventDate = rawDateValue ? new Date(rawDateValue) : null;
 const isOverdue = eventDate && eventDate < new Date() && maintenance.status !== 'COMPLETED';
 const isCompleted = maintenance.status === 'COMPLETED';
 const type = maintenance.type || 'PREVENTIVE';
 const priority = maintenance.priority || 'MEDIUM';

 // Si está vencido y no completado, mostrar en rojo
 if (isOverdue) {
 return {
 backgroundColor: '#ef4444', // Rojo
 borderColor: '#dc2626',
 textColor: '#ffffff'
 };
 }

 // Si está completado, verde
 if (isCompleted) {
 return {
 backgroundColor: '#10b981',
 borderColor: '#059669',
 textColor: '#ffffff'
 };
 }

 // Colores por tipo de mantenimiento
 const typeColors: Record<string, { bg: string; border: string }> = {
 'PREVENTIVE': { bg: '#3b82f6', border: '#2563eb' }, // Azul
 'CORRECTIVE': { bg: '#f97316', border: '#ea580c' }, // Naranja
 'PREDICTIVE': { bg: '#8b5cf6', border: '#7c3aed' }, // Morado
 'EMERGENCY': { bg: '#ef4444', border: '#dc2626' }, // Rojo
 };

 const colors = typeColors[type] || typeColors['PREVENTIVE'];

 // Borde según prioridad (más oscuro = más urgente)
 const priorityBorders: Record<string, string> = {
 'URGENT': '#991b1b', // Rojo muy oscuro
 'HIGH': '#dc2626', // Rojo
 'MEDIUM': colors.border, // Color normal del tipo
 'LOW': colors.border, // Color normal del tipo
 };

 return {
 backgroundColor: colors.bg,
 borderColor: priorityBorders[priority] || colors.border,
 textColor: '#ffffff'
 };
 };

 // Convertir mantenimientos a eventos de FullCalendar
 const calendarEvents = React.useMemo(() => {
 let filteredMaintenances = maintenances;

 // Aplicar filtros si existen
 if (filters) {
 // Filtro por tipo de mantenimiento
 if (filters.maintenanceTypes && filters.maintenanceTypes.length > 0) {
 filteredMaintenances = filteredMaintenances.filter(maint =>
 filters.maintenanceTypes!.includes(maint.type)
 );
 }

 // Filtro por máquina/unidad móvil
 const hasMachineFilters = filters.selectedMachines && filters.selectedMachines.length > 0;
 const hasUnidadMovilFilters = filters.selectedUnidadesMoviles && filters.selectedUnidadesMoviles.length > 0;

 if (hasMachineFilters || hasUnidadMovilFilters) {
 filteredMaintenances = filteredMaintenances.filter(maint => {
 const currentMaintMachineId = maint.machineId?.toString();
 const currentMaintUnidadMovilId = maint.unidadMovilId?.toString();

 const matchesMachineFilter = currentMaintMachineId && filters.selectedMachines!.includes(currentMaintMachineId);
 const matchesUnidadMovilFilter = currentMaintUnidadMovilId && filters.selectedUnidadesMoviles!.includes(currentMaintUnidadMovilId);

 const noMachineOrUnidadMovilFiltersApplied = !hasMachineFilters && !hasUnidadMovilFilters;

 if (noMachineOrUnidadMovilFiltersApplied) {
 return true;
 } else {
 return (hasMachineFilters && matchesMachineFilter) || (hasUnidadMovilFilters && matchesUnidadMovilFilter);
 }
 });
 }
 }

 return filteredMaintenances.map(maintenance => {
 const rawDateValue = maintenance.scheduledDate || maintenance.nextMaintenanceDate || new Date();
 const rawDate = new Date(rawDateValue);

 // Obtener colores según tipo, estado y prioridad
 const colors = getEventColors(maintenance);

 // Construir título con info de máquina/unidad
 const machineName = maintenance.machine?.name || maintenance.machineName;
 const unidadName = maintenance.unidadMovil?.nombre || maintenance.unidadMovilName;
 const assetName = machineName || unidadName;
 const title = assetName
 ? `${maintenance.title || 'Sin título'} • ${assetName}`
 : (maintenance.title || 'Sin título');

 // Indicador de prioridad para el título
 const priorityIndicator = maintenance.priority === 'URGENT' || maintenance.priority === 'HIGH'
 ? '⚠️ '
 : '';

 return {
 id: maintenance.id.toString(),
 title: priorityIndicator + title,
 start: rawDate,
 backgroundColor: colors.backgroundColor,
 borderColor: colors.borderColor,
 textColor: colors.textColor,
 extendedProps: {
 status: maintenance.status,
 priority: maintenance.priority,
 type: maintenance.type,
 isOverdue: rawDate < new Date() && maintenance.status !== 'COMPLETED',
 maintenance: maintenance // Guardar el objeto completo
 }
 };
 });
 }, [maintenances, filters]);

 // Manejar cambio de vista
 const handleViewChange = (view: ViewType) => {
 setCurrentView(view);
 if (calendarRef.current) {
 const calendarApi = calendarRef.current.getApi();
 calendarApi.changeView(view);
 }
 };

 // Manejar botón "Hoy"
 const handleToday = () => {
 if (calendarRef.current) {
 const calendarApi = calendarRef.current.getApi();
 calendarApi.today();
 setCurrentDate(new Date());
 }
 };

 // Manejar navegación anterior
 const handlePrev = () => {
 if (calendarRef.current) {
 const calendarApi = calendarRef.current.getApi();
 calendarApi.prev();
 setCurrentDate(calendarApi.getDate());
 }
 };

 // Manejar navegación siguiente
 const handleNext = () => {
 if (calendarRef.current) {
 const calendarApi = calendarRef.current.getApi();
 calendarApi.next();
 setCurrentDate(calendarApi.getDate());
 }
 };

 // Obtener título del rango actual
 const getTitle = () => {
 if (calendarRef.current) {
 const calendarApi = calendarRef.current.getApi();
 const view = calendarApi.view;
 
 if (currentView === 'dayGridMonth') {
 // Formato: "diciembre 2025"
 const date = view.currentStart;
 return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
 } else if (currentView === 'timeGridWeek') {
 // Formato: "01 dic - 07 dic 2025"
 const start = view.currentStart;
 const end = view.currentEnd;
 const startStr = start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
 const endStr = end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
 return `${startStr} - ${endStr}`;
 } else {
 // Formato: "01 diciembre 2025"
 const date = view.currentStart;
 return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
 }
 }
 return '';
 };

 // Manejar click en evento
 const handleEventClick = (clickInfo: EventClickArg) => {
 const maintenance = clickInfo.event.extendedProps.maintenance;

 // Cerrar cualquier popover abierto de FullCalendar inmediatamente
 const closePopover = () => {
 const popovers = document.querySelectorAll('.fc-popover, .fc-more-popover');
 popovers.forEach(popover => popover.remove());
 };

 // Cerrar inmediatamente y también después de un pequeño delay por si se re-renderiza
 closePopover();
 setTimeout(closePopover, 50);

 // Si no hay maintenance en extendedProps, buscar en el array de maintenances
 let selectedMaint = maintenance;
 if (!selectedMaint) {
 selectedMaint = maintenances.find(m => m.id.toString() === clickInfo.event.id);
 }

 if (selectedMaint) {
 // Si hay callback personalizado, solo llamarlo (el padre manejará el modal)
 if (onEventClick) {
 onEventClick({ id: clickInfo.event.id, ...selectedMaint });
 return; // No abrir modal interno si hay callback externo
 }

 // Solo abrir modal interno si NO hay callback externo y tenemos companyId
 if (companyId) {
 setSelectedMaintenance(selectedMaint);
 setIsDetailDialogOpen(true);
 }
 }
 };

 // Manejar selección de fecha
 const handleDateSelect = (selectInfo: DateSelectArg) => {
 // Aquí podrías abrir un modal para crear un nuevo mantenimiento
 };

 // Manejar click en "Ver más" - usar popover nativo de FullCalendar
 const handleMoreLinkClick = (arg: any): 'popover' => {
 // Retornar 'popover' para que FullCalendar muestre su popover nativo
 // Los eventos dentro del popover se manejarán con handleEventClick
 // que cierra el popover automáticamente
 return 'popover';
 };
 
 // Actualizar título cuando cambia la vista o fecha
 useEffect(() => {
 if (calendarRef.current) {
 const calendarApi = calendarRef.current.getApi();
 const handleDatesSet = () => {
 setCurrentDate(calendarApi.getDate());
 };
 calendarApi.on('datesSet', handleDatesSet);
 return () => {
 calendarApi.off('datesSet', handleDatesSet);
 };
 }
 }, [currentView]);

 return (
 <div className="w-full h-full">
 {/* Header personalizado */}
 <div className="mb-4">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
 <h2 className="text-sm font-medium">Calendario de Mantenimientos</h2>

 {/* Leyenda de colores */}
 <div className="flex flex-wrap items-center gap-3 text-xs">
 <div className="flex items-center gap-1">
 <div className="w-3 h-3 rounded bg-info-muted0" />
 <span className="text-muted-foreground">Preventivo</span>
 </div>
 <div className="flex items-center gap-1">
 <div className="w-3 h-3 rounded bg-warning-muted0" />
 <span className="text-muted-foreground">Correctivo</span>
 </div>
 <div className="flex items-center gap-1">
 <div className="w-3 h-3 rounded bg-violet-500" />
 <span className="text-muted-foreground">Predictivo</span>
 </div>
 <div className="flex items-center gap-1">
 <div className="w-3 h-3 rounded bg-success-muted0" />
 <span className="text-muted-foreground">Completado</span>
 </div>
 <div className="flex items-center gap-1">
 <div className="w-3 h-3 rounded bg-destructive/100" />
 <span className="text-muted-foreground">Vencido</span>
 </div>
 </div>
 </div>

 <div className="flex items-center gap-2 mb-4">
 {/* Botón Hoy */}
 <Button
 variant="outline"
 size="sm"
 onClick={handleToday}
 className="shrink-0 h-9 text-xs"
 >
 Hoy
 </Button>
 
 {/* Navegación del mes/año */}
 <div className="flex items-center flex-1 min-w-0 justify-center gap-1 sm:gap-2">
 <Button
 variant="ghost"
 size="sm"
 onClick={handlePrev}
 className="h-7 w-7 sm:h-8 sm:w-8 p-0 shrink-0"
 aria-label="Anterior"
 >
 <ChevronLeft className="h-4 w-4" />
 </Button>
 <div className="text-center px-1 sm:px-2 shrink-0">
 <h3 className="text-sm font-medium text-foreground whitespace-nowrap">
 {getTitle()}
 </h3>
 </div>
 <Button
 variant="ghost"
 size="sm"
 onClick={handleNext}
 className="h-7 w-7 sm:h-8 sm:w-8 p-0 shrink-0"
 aria-label="Siguiente"
 >
 <ChevronRight className="h-4 w-4" />
 </Button>
 </div>
 
 {/* Selector de vista */}
 <div className="flex bg-muted/40 border border-border rounded-md p-0.5 shrink-0">
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleViewChange('dayGridMonth')}
 className={cn(
 "flex items-center gap-1.5 text-xs font-normal h-7 px-3 shrink-0",
 currentView === 'dayGridMonth' && "bg-background shadow-sm"
 )}
 >
 Mes
 </Button>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleViewChange('timeGridWeek')}
 className={cn(
 "flex items-center gap-1.5 text-xs font-normal h-7 px-3 shrink-0",
 currentView === 'timeGridWeek' && "bg-background shadow-sm"
 )}
 >
 Semana
 </Button>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleViewChange('timeGridDay')}
 className={cn(
 "flex items-center gap-1.5 text-xs font-normal h-7 px-3 shrink-0",
 currentView === 'timeGridDay' && "bg-background shadow-sm"
 )}
 >
 Día
 </Button>
 </div>
 </div>
 </div>

 {/* Calendario */}
 <Card>
 <CardContent className="p-0">
 <div className="maintenance-calendar-wrapper">
 <FullCalendar
 ref={calendarRef}
 plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
 initialView="dayGridMonth"
 locale={esLocale}
 events={calendarEvents}
 headerToolbar={false}
 height="auto"
 eventClick={handleEventClick}
 selectable={true}
 select={handleDateSelect}
 dayMaxEvents={3}
 moreLinkClick={handleMoreLinkClick}
 moreLinkContent={(args) => `+${args.num} más`}
 eventDisplay="block"
 eventTextColor="#ffffff"
 dayHeaderFormat={{ weekday: 'short' }}
 slotMinTime="00:00:00"
 slotMaxTime="24:00:00"
 allDaySlot={false}
 weekends={true}
 firstDay={1} // Lunes
 contentHeight="auto"
 aspectRatio={1.8}
 />
 </div>
 </CardContent>
 </Card>

 {/* Modal de detalle de mantenimiento */}
 {companyId && (
 <MaintenanceDetailDialog
 isOpen={isDetailDialogOpen && !!selectedMaintenance}
 onClose={() => {
 setIsDetailDialogOpen(false);
 setSelectedMaintenance(null);
 }}
 maintenance={selectedMaintenance}
 canEdit={canEdit}
 onEdit={onEdit}
 companyId={companyId}
 />
 )}

 {/* Estilos de FullCalendar */}
 <style jsx global>{`
 /* Estilos base de FullCalendar */
 .fc {
 font-family: inherit;
 direction: ltr;
 text-align: left;
 }
 
 .fc table {
 border-collapse: collapse;
 border-spacing: 0;
 }
 
 .fc-header-toolbar {
 display: none !important;
 }
 
 /* Day Grid - Altura fija para todos los días */
 .fc-daygrid-day {
 background-color: white;
 border: 1px solid #e5e7eb;
 height: 120px !important;
 min-height: 120px !important;
 }
 
 .fc-daygrid-day-frame {
 height: 120px !important;
 min-height: 120px !important;
 max-height: 120px !important;
 padding: 2px;
 display: flex;
 flex-direction: column;
 }
 
 .fc-daygrid-day-events {
 flex: 1;
 overflow-y: auto;
 overflow-x: hidden;
 max-height: calc(120px - 30px); /* Altura disponible menos el número del día */
 }
 
 /* Cuando el día está expandido, mostrar todos los eventos */
 .fc-daygrid-day-events.fc-day-expanded {
 max-height: none;
 overflow-y: visible;
 }
 
 .fc-day-expanded .fc-daygrid-event {
 display: block !important;
 }
 
 .fc-daygrid-day-number {
 font-size: 0.875rem;
 font-weight: 400;
 padding: 4px;
 color: #374151;
 }
 
 .fc-col-header-cell {
 font-size: 0.75rem;
 font-weight: 400;
 padding: 8px 4px;
 text-transform: none;
 background-color: white;
 border: 1px solid #e5e7eb;
 color: #374151;
 }
 
 .fc-col-header-cell-cushion {
 padding: 4px;
 }
 
 .fc-daygrid-day-top {
 flex-direction: row;
 justify-content: flex-end;
 flex-shrink: 0;
 }
 
 /* Asegurar que todas las celdas tengan el mismo tamaño */
 .fc-daygrid-body td {
 height: 120px !important;
 vertical-align: top;
 }
 
 .fc-day-today {
 background-color: transparent;
 }
 
 .fc-day-today .fc-daygrid-day-number {
 font-weight: 500;
 }
 
 /* Eventos */
 .fc-event {
 border: none;
 border-radius: 4px;
 padding: 2px 4px;
 margin: 1px 0;
 cursor: pointer;
 }
 
 .fc-daygrid-event {
 font-size: 0.75rem;
 font-weight: 600 !important; /* Negrita */
 padding: 3px 6px;
 border-radius: 4px;
 white-space: nowrap;
 overflow: hidden;
 text-overflow: ellipsis;
 }
 
 .fc-event-title {
 font-size: 0.75rem;
 font-weight: 600 !important; /* Negrita */
 padding: 0;
 white-space: nowrap;
 overflow: hidden;
 text-overflow: ellipsis;
 }
 
 .fc-event-title-container {
 font-weight: 600 !important; /* Negrita */
 }
 
 .fc-event-title-container {
 padding: 0;
 }
 
 /* More link */
 .fc-more-link {
 font-size: 0.75rem;
 font-weight: 400;
 color: #3b82f6;
 padding: 2px 4px;
 cursor: pointer;
 }
 
 .fc-more-link:hover {
 text-decoration: underline;
 }
 
 /* Time Grid (Semana/Día) */
 .fc-timegrid-slot {
 border-top: 1px solid #f3f4f6;
 }
 
 .fc-timegrid-col {
 border-left: 1px solid #e5e7eb;
 }
 
 .fc-timegrid-axis {
 border-right: 1px solid #e5e7eb;
 }
 
 .fc-timegrid-axis-cushion {
 font-size: 0.75rem;
 color: #6b7280;
 }
 
 .fc-timegrid-event {
 border-radius: 4px;
 padding: 2px 4px;
 font-size: 0.75rem;
 }
 
 /* Scrollbar */
 .fc-scroller {
 overflow-y: auto;
 overflow-x: hidden;
 }
 
 .maintenance-calendar-wrapper {
 padding: 1rem;
 }
 
 .fc-view-harness {
 background-color: white;
 }
 
 /* Popover de "Ver más" */
 .fc-popover {
 z-index: 9999 !important;
 border-radius: 8px;
 box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
 border: 1px solid #e5e7eb;
 max-width: 350px;
 max-height: 400px;
 overflow: hidden;
 }

 .fc-popover-header {
 background-color: #f9fafb;
 padding: 10px 12px;
 font-size: 0.875rem;
 font-weight: 600;
 border-bottom: 1px solid #e5e7eb;
 display: flex;
 justify-content: space-between;
 align-items: center;
 }

 .fc-popover-title {
 color: #374151;
 }

 .fc-popover-close {
 cursor: pointer;
 font-size: 1.25rem;
 color: #9ca3af;
 background: none;
 border: none;
 padding: 0 4px;
 line-height: 1;
 }

 .fc-popover-close:hover {
 color: #374151;
 }

 .fc-popover-body {
 padding: 8px;
 max-height: 300px;
 overflow-y: auto;
 background: white;
 }

 .fc-popover .fc-daygrid-event {
 margin: 4px 0;
 font-size: 0.7rem;
 padding: 6px 8px;
 border-radius: 4px;
 white-space: normal;
 line-height: 1.3;
 }

 .fc-popover .fc-event-title {
 white-space: normal;
 overflow: visible;
 text-overflow: clip;
 }

 .fc-popover .fc-event-time {
 display: none;
 }

 @media (max-width: 768px) {
 .maintenance-calendar-wrapper {
 padding: 0.5rem;
 }

 .fc-daygrid-day-number {
 font-size: 0.7rem;
 }

 .fc-col-header-cell {
 font-size: 0.7rem;
 padding: 6px 2px;
 }

 .fc-daygrid-event {
 font-size: 0.7rem;
 padding: 1px 2px;
 }

 .fc-more-link {
 font-size: 0.7rem;
 }

 .fc-popover {
 max-width: 280px;
 }
 }
 `}</style>
 </div>
 );
};

export default MaintenanceCalendar;
