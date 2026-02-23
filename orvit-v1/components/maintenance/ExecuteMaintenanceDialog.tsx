import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
 DialogBody,
 DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
 Command,
 CommandEmpty,
 CommandGroup,
 CommandInput,
 CommandItem,
 CommandList,
} from '@/components/ui/command';
import {
 Clock,
 CheckCircle,
 AlertCircle,
 User,
 Users,
 Calendar,
 Building,
 Wrench,
 Timer,
 Target,
 ThumbsUp,
 FileCheck,
 MessageSquare,
 Ban,
 ShieldCheck,
 Activity,
 AlertTriangle,
 Zap,
 Camera,
 X,
 Image as ImageIcon,
 Loader2,
 Check,
 ChevronsUpDown,
 Package,
 Plus,
 Search,
 Minus,
} from 'lucide-react';
import { formatDate } from '@/lib/date-utils';
import { useCompany } from '@/contexts/CompanyContext';
import { DateTimePicker } from '@/components/ui/datetime-picker';

type ResourceConfirmation = {
 reservationId: number | null;
 toolId: number | null;
 toolName: string;
 toolItemType: string;
 toolUnit: string;
 pickedQuantity: number;
 usedQuantity: number;
 returnedDamaged: boolean;
 isAdHoc: boolean;
};

const CONSUMABLE_TYPES = ['SPARE_PART', 'CONSUMABLE', 'MATERIAL'];
const TOOL_TYPES = ['TOOL', 'HAND_TOOL'];

interface ExecuteMaintenanceDialogProps {
 isOpen: boolean;
 onClose: () => void;
 maintenance: any;
 onExecute: (executionData: any) => void;
 isLoading?: boolean;
}

export default function ExecuteMaintenanceDialog({
 isOpen,
 onClose,
 maintenance,
 onExecute,
 isLoading = false
}: ExecuteMaintenanceDialogProps) {
 const { currentCompany } = useCompany();
 const [employees, setEmployees] = useState<any[]>([]);
 const [loadingEmployees, setLoadingEmployees] = useState(false);
 const [selectedOperators, setSelectedOperators] = useState<{id: string, name: string}[]>([]);
 const [operatorPopoverOpen, setOperatorPopoverOpen] = useState(false);
 const [executionDate, setExecutionDate] = useState<Date>(() => {
   const now = new Date();
   now.setSeconds(0, 0);
   return now;
 });
 const [executionData, setExecutionData] = useState({
 actualDuration: '',
 actualDurationUnit: 'HOURS', // Unidad por defecto para tiempo de ejecución
 actualValue: '',
 actualUnit: 'CYCLES', // Unidad por defecto para ciclos/producto
 notes: '',
 issues: '',
 // qualityScore: '', // Removido - será asignado por supervisor
 completionStatus: 'COMPLETED',
 reExecutionReason: '', // Razón para re-ejecutar si ya fue completado hoy
 excludeQuantity: false // Excluir cantidad de ciclos/producto
 });

 const [errors, setErrors] = useState<Record<string, string>>({});
 const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);

 // Recursos utilizados
 const [resources, setResources] = useState<ResourceConfirmation[]>([]);
 const [loadingResources, setLoadingResources] = useState(false);
 const [showAdHocSearch, setShowAdHocSearch] = useState(false);
 const [adHocSearch, setAdHocSearch] = useState('');
 const [adHocResults, setAdHocResults] = useState<any[]>([]);
 const [searchingAdHoc, setSearchingAdHoc] = useState(false);

 useEffect(() => {
 if (isOpen && maintenance) {
 // Reset form when dialog opens
 setExecutionData({
 actualDuration: '',
 actualDurationUnit: 'HOURS', // Por defecto en horas
 actualValue: maintenance.timeValue?.toString() || '',
 actualUnit: 'CYCLES', // Siempre inicializar con ciclos por defecto para cantidad
 notes: '',
 issues: '',
 // qualityScore: '', // Removido - será asignado por supervisor
 completionStatus: 'COMPLETED',
 reExecutionReason: '',
 excludeQuantity: false // Inicializar como no excluido
 });
 setErrors({});
 setSelectedOperators([]);
 setExecutionDate(() => { const now = new Date(); now.setSeconds(0, 0); return now; });
 // Limpiar fotos previas
 photos.forEach(photo => URL.revokeObjectURL(photo.preview));
 setPhotos([]);
 // Reset recursos
 setResources([]);
 setShowAdHocSearch(false);
 setAdHocSearch('');
 setAdHocResults([]);
 }
 }, [isOpen, maintenance]);

 // Cargar empleados activos de la empresa
 useEffect(() => {
 if (!isOpen || !currentCompany?.id) return;
 setLoadingEmployees(true);
 fetch(`/api/costos/empleados?companyId=${currentCompany.id}&limit=200`)
   .then(res => res.ok ? res.json() : { items: [] })
   .then(data => setEmployees(Array.isArray(data.items) ? data.items : []))
   .catch(() => setEmployees([]))
   .finally(() => setLoadingEmployees(false));
 }, [isOpen, currentCompany?.id]);

 // Cargar recursos (reservaciones o toolsRequired)
 useEffect(() => {
 if (!isOpen || !maintenance) return;

 const isPreventive = maintenance.isPreventive || maintenance.type === 'PREVENTIVE';

 if (!isPreventive && maintenance.id) {
   // CORRECTIVO: cargar reservaciones del pañol
   setLoadingResources(true);
   fetch(`/api/tools/reservations?workOrderId=${maintenance.id}`)
     .then(res => res.ok ? res.json() : { data: [] })
     .then(data => {
       const reservations = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
       const picked = reservations.filter((r: any) => r.status === 'PICKED' || r.status === 'PENDING');
       setResources(picked.map((r: any) => ({
         reservationId: r.id,
         toolId: r.tool?.id || r.toolId,
         toolName: r.tool?.name || r.toolName || 'Sin nombre',
         toolItemType: r.tool?.itemType || 'UNKNOWN',
         toolUnit: r.tool?.unit || 'unidad',
         pickedQuantity: r.quantity,
         usedQuantity: r.quantity,
         returnedDamaged: false,
         isAdHoc: false,
       })));
     })
     .catch(() => setResources([]))
     .finally(() => setLoadingResources(false));
 } else if (maintenance.toolsRequired?.length > 0) {
   // PREVENTIVO: mostrar herramientas requeridas como checklist
   setResources(maintenance.toolsRequired.map((t: any) => ({
     reservationId: null,
     toolId: null,
     toolName: t.name,
     toolItemType: 'UNKNOWN',
     toolUnit: 'unidad',
     pickedQuantity: t.quantity || 1,
     usedQuantity: t.quantity || 1,
     returnedDamaged: false,
     isAdHoc: false,
   })));
 } else {
   setResources([]);
 }
 }, [isOpen, maintenance]);

 // Funciones para manejo de fotos
 const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = e.target.files;
 if (!files) return;

 const newPhotos = Array.from(files).map(file => ({
 file,
 preview: URL.createObjectURL(file)
 }));

 setPhotos(prev => [...prev, ...newPhotos]);
 };

 const removePhoto = (index: number) => {
 setPhotos(prev => {
 const updated = [...prev];
 URL.revokeObjectURL(updated[index].preview);
 updated.splice(index, 1);
 return updated;
 });
 };

 // Helpers para recursos
 const updateResource = (index: number, updates: Partial<ResourceConfirmation>) => {
   setResources(prev => prev.map((r, i) => i === index ? { ...r, ...updates } : r));
 };

 const removeResource = (index: number) => {
   setResources(prev => prev.filter((_, i) => i !== index));
 };

 const searchAdHocTool = async (query: string) => {
   if (!query || query.length < 2 || !currentCompany?.id) return;
   setSearchingAdHoc(true);
   try {
     const res = await fetch(`/api/tools?companyId=${currentCompany.id}&search=${encodeURIComponent(query)}&limit=10`);
     if (res.ok) {
       const data = await res.json();
       setAdHocResults(Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []));
     }
   } catch { setAdHocResults([]); }
   finally { setSearchingAdHoc(false); }
 };

 const addAdHocResource = (tool: any) => {
   // Evitar duplicados
   if (resources.some(r => r.toolId === tool.id)) return;
   setResources(prev => [...prev, {
     reservationId: null,
     toolId: tool.id,
     toolName: tool.name,
     toolItemType: tool.itemType || 'UNKNOWN',
     toolUnit: tool.unit || 'unidad',
     pickedQuantity: 1,
     usedQuantity: 1,
     returnedDamaged: false,
     isAdHoc: true,
   }]);
   setShowAdHocSearch(false);
   setAdHocSearch('');
   setAdHocResults([]);
 };

 // Forzar re-render cuando cambie la unidad de tiempo para actualizar el tiempo estimado
 useEffect(() => {
 // Este efecto se ejecuta cuando cambia actualDurationUnit para forzar el re-render
 }, [executionData.actualDurationUnit]);

 // Debug logs removed for cleaner console

 if (!maintenance) return null;

 // Función para verificar si el mantenimiento ya fue completado hoy
 const isCompletedToday = () => {
 if (!maintenance.lastMaintenanceDate) return false;
 
 const today = new Date();
 today.setHours(0, 0, 0, 0);
 
 const lastMaintenance = new Date(maintenance.lastMaintenanceDate);
 lastMaintenance.setHours(0, 0, 0, 0);
 
 return lastMaintenance.getTime() === today.getTime();
 };

 const wasCompletedToday = isCompletedToday();

 const getTimeUnitText = (unit: string) => {
 switch (unit) {
 case 'HOURS': return 'horas';
 case 'MINUTES': return 'minutos';
 case 'DAYS': return 'días';
 case 'CYCLES': return 'ciclos';
 case 'KILOMETERS': return 'kilómetros';
 case 'SHIFTS': return 'turnos';
 case 'UNITS_PRODUCED': return 'unidades';
 default: return unit?.toLowerCase() || 'unidades';
 }
 };

 const getEstimatedTimeDisplay = () => {
 if (!maintenance.estimatedHours) return null;
 
 if (executionData.actualDurationUnit === 'MINUTES') {
 const estimatedMinutes = Math.round(maintenance.estimatedHours * 60);
 return `Estimado: ${estimatedMinutes} min`;
 } else {
 return `Estimado: ${maintenance.estimatedHours}h`;
 }
 };

 const getPriorityColor = (priority: string) => {
 switch (priority) {
 case 'URGENT': return 'bg-destructive/10 text-destructive border-destructive/30';
 case 'HIGH': return 'bg-warning-muted text-warning-muted-foreground border-warning-muted';
 case 'MEDIUM': return 'bg-warning-muted text-warning-muted-foreground border-warning-muted';
 case 'LOW': return 'bg-success-muted text-success-muted-foreground border-success-muted';
 default: return 'bg-muted text-foreground border-border';
 }
 };

 const getTypeLabel = (type: any) => {
 // Asegurar que type sea un string
 const typeString = typeof type === 'string' ? type : (type?.type || 'UNKNOWN');
 switch (typeString) {
 case 'PREVENTIVE': return 'Preventivo';
 case 'CORRECTIVE': return 'Correctivo';
 case 'PREDICTIVE': return 'Predictivo';
 case 'EMERGENCY': return 'Emergencia';
 default: return typeString;
 }
 };

 const getPriorityLabel = (priority: any) => {
 // Asegurar que priority sea un string
 const priorityString = typeof priority === 'string' ? priority : (priority?.priority || 'UNKNOWN');
 switch (priorityString) {
 case 'URGENT': return 'Urgente';
 case 'HIGH': return 'Alta';
 case 'MEDIUM': return 'Media';
 case 'LOW': return 'Baja';
 default: return priorityString;
 }
 };

 const validateForm = () => {
 const newErrors: Record<string, string> = {};

 if (!executionData.actualDuration) {
 newErrors.actualDuration = 'La duración real es requerida';
 } else if (isNaN(Number(executionData.actualDuration)) || Number(executionData.actualDuration) <= 0) {
 newErrors.actualDuration = 'Debe ser un número mayor a 0';
 }

 if (!executionData.excludeQuantity) {
 if (!executionData.actualValue) {
 newErrors.actualValue = 'La cantidad es requerida';
 } else if (isNaN(Number(executionData.actualValue)) || Number(executionData.actualValue) <= 0) {
 newErrors.actualValue = 'Debe ser un número mayor a 0';
 }
 }

 // Validar que se haya seleccionado al menos un operador
 if (selectedOperators.length === 0) {
 newErrors.operators = 'Debe seleccionar al menos un operador';
 }

 // Validar razón de re-ejecución si ya fue completado hoy
 if (wasCompletedToday && !executionData.reExecutionReason.trim()) {
 newErrors.reExecutionReason = 'Debe proporcionar una razón para re-ejecutar el mantenimiento';
 }

 setErrors(newErrors);
 return Object.keys(newErrors).length === 0;
 };

 const handleSubmit = () => {
 if (!validateForm()) return;

 // Convertir la duración a horas si está en minutos
 let actualDurationInHours = Number(executionData.actualDuration);
 let originalDuration = Number(executionData.actualDuration);
 if (executionData.actualDurationUnit === 'MINUTES') {
 actualDurationInHours = actualDurationInHours / 60;
 }

 const executionPayload = {
 maintenanceId: maintenance.id,
 maintenanceType: maintenance.type || (maintenance.isPreventive ? 'PREVENTIVE' : 'CORRECTIVE'),
 isPreventive: maintenance.isPreventive || maintenance.type === 'PREVENTIVE',
 actualDuration: actualDurationInHours,
 originalDuration: originalDuration, // Agregar el valor original
 actualDurationUnit: executionData.actualDurationUnit, // Agregar la unidad de tiempo
 actualValue: executionData.excludeQuantity ? null : Number(executionData.actualValue),
 actualUnit: executionData.excludeQuantity ? null : executionData.actualUnit,
 excludeQuantity: executionData.excludeQuantity, // Agregar el campo de exclusión
 notes: executionData.notes,
 issues: executionData.issues,
 // qualityScore: null, // Removido - será asignado por supervisor
 completionStatus: executionData.completionStatus,
 reExecutionReason: wasCompletedToday ? executionData.reExecutionReason : null,
 executedAt: executionDate ? executionDate.toISOString() : new Date().toISOString(),
 operators: selectedOperators,
 resources: resources.length > 0 ? resources.map(r => ({
   reservationId: r.reservationId,
   toolId: r.toolId,
   toolName: r.toolName,
   toolItemType: r.toolItemType,
   usedQuantity: r.usedQuantity,
   returnedDamaged: r.returnedDamaged,
   isAdHoc: r.isAdHoc,
 })) : undefined,
 machineId: maintenance.machineId,
 machineName: typeof maintenance.machine?.name === 'string' ? maintenance.machine.name : (maintenance.machine?.name?.name || ''),
 unidadMovilId: (maintenance as any).unidadMovilId,
 unidadMovilName: typeof (maintenance as any).unidadMovil?.nombre === 'string' ? (maintenance as any).unidadMovil.nombre : ((maintenance as any).unidadMovil?.nombre?.nombre || ''),
 title: maintenance.title,
 description: maintenance.description,
 assignedToId: maintenance.assignedToId,
 assignedToName: maintenance.assignedTo?.name || maintenance.assignedWorker?.name || maintenance.assignedToName,
 componentIds: maintenance.componentIds || [],
 subcomponentIds: maintenance.subcomponentIds || [],
 estimatedDuration: maintenance.estimatedHours,
 estimatedValue: maintenance.timeValue
 };

 onExecute(executionPayload);
 };

 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent size="lg">
 <DialogHeader>
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
 <div className="flex items-center gap-3">
 <div className="bg-success-muted p-2 rounded-lg">
 <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
 </div>
 <div>
 <DialogTitle className="text-base sm:text-lg font-bold">
 Realizar Mantenimiento
 </DialogTitle>
 <DialogDescription className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-muted-foreground">
 <span>ID: {maintenance.id}</span>
 <span>•</span>
 <span>Equipo: {(() => {
 const unidadMovilName = (maintenance as any).unidadMovil?.nombre;
 const machineName = maintenance.machine?.name;
 const name = unidadMovilName || machineName;
 return typeof name === 'string' ? name : (name?.name || 'N/A');
 })()}</span>
 </DialogDescription>
 </div>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <Badge className={cn(getPriorityColor(maintenance.priority), 'border-2 text-xs')}>
 {getPriorityLabel(maintenance.priority)}
 </Badge>
 <Badge variant="outline" className="border-2 text-xs">
 {getTypeLabel(maintenance.type)}
 </Badge>
 </div>
 </div>
 </DialogHeader>

 <DialogBody>
 <div className="space-y-4">
 {/* Información del Mantenimiento */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="flex items-center gap-2 text-base">
 <Wrench className="h-4 w-4" />
 {maintenance.title}
 </CardTitle>
 </CardHeader>
 <CardContent className="pt-0">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
 <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
 <Building className="h-4 w-4 text-muted-foreground" />
 <div className="flex-1 min-w-0">
 <p className="text-xs text-muted-foreground">Equipo</p>
 <p className="text-sm font-semibold mt-0.5">
 {(() => {
 const unidadMovilName = (maintenance as any).unidadMovil?.nombre;
 const machineName = maintenance.machine?.name;
 const name = unidadMovilName || machineName;
 return typeof name === 'string' ? name : (name?.name || 'N/A');
 })()}
 </p>
 </div>
 </div>
 
 <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
 <User className="h-4 w-4 text-muted-foreground" />
 <div className="flex-1 min-w-0">
 <p className="text-xs text-muted-foreground">Asignado a</p>
 <p className="text-sm font-semibold mt-0.5">
 {maintenance.assignedTo?.name || maintenance.assignedWorker?.name || maintenance.assignedToName || 'Sin asignar'}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
 <Calendar className="h-4 w-4 text-muted-foreground" />
 <div className="flex-1 min-w-0">
 <p className="text-xs text-muted-foreground">Programado</p>
 <p className="text-sm font-semibold mt-0.5">
 {maintenance.scheduledDate ?
 formatDate(maintenance.scheduledDate) :
 'N/A'
 }
 </p>
 </div>
 </div>
 </div>

 {maintenance.description && (
 <div className="p-2 bg-muted/30 rounded-lg mb-3">
 <p className="text-xs text-muted-foreground mb-1">Descripción:</p>
 <p className="text-xs">{maintenance.description}</p>
 </div>
 )}

 {/* Información de la unidad de medida */}
 {maintenance.timeUnit && maintenance.timeValue && (
 <div className="p-2 bg-info-muted rounded-lg border border-info-muted">
 <div className="flex items-center gap-2 mb-1">
 <Target className="h-3 w-3 text-info-muted-foreground" />
 <p className="text-xs font-medium text-info-muted-foreground">Configuración Original</p>
 </div>
 <p className="text-xs text-info-muted-foreground">
 Configurado para {maintenance.timeValue} {getTimeUnitText(maintenance.timeUnit).toLowerCase()}.
 </p>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Advertencia si ya fue completado hoy */}
 {wasCompletedToday && (
 <Card className="border-warning-muted bg-warning-muted">
 <CardHeader className="pb-2">
 <CardTitle className="flex items-center gap-2 text-warning-muted-foreground text-sm">
 <AlertCircle className="h-4 w-4" />
 Mantenimiento ya completado hoy
 </CardTitle>
 </CardHeader>
 <CardContent className="pt-0">
 <p className="text-xs text-warning-muted-foreground mb-3">
 Este mantenimiento ya fue completado hoy. Proporcione una razón válida para re-ejecutar.
 </p>
 <div className="space-y-2">
 <Label htmlFor="reExecutionReason" className="text-warning-muted-foreground text-xs">
 Razón para re-ejecutar *
 </Label>
 <Textarea
 id="reExecutionReason"
 placeholder="Explique por qué necesita ejecutar este mantenimiento nuevamente..."
 value={executionData.reExecutionReason}
 onChange={(e) => setExecutionData(prev => ({
 ...prev,
 reExecutionReason: e.target.value
 }))}
 className={cn('text-sm', errors.reExecutionReason ? 'border-destructive' : 'border-warning-muted')}
 rows={2}
 />
 {errors.reExecutionReason && (
 <p className="text-xs text-destructive">{typeof errors.reExecutionReason === 'string' ? errors.reExecutionReason : 'Error de validación'}</p>
 )}
 </div>
 </CardContent>
 </Card>
 )}

 {/* Formulario de Ejecución */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="flex items-center gap-2 text-base">
 <Timer className="h-4 w-4" />
 Datos de Ejecución
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3 pt-0">
 {/* Fecha y hora de ejecución */}
 <div className="space-y-1.5">
 <Label className="text-xs flex items-center gap-1.5">
 <Calendar className="h-3 w-3" />
 Fecha y hora de ejecución <span className="text-destructive">*</span>
 </Label>
 <DateTimePicker
 value={executionDate}
 onChange={(date) => date && setExecutionDate(date)}
 maxDate={new Date()}
 placeholder="Seleccionar fecha y hora"
 />
 <p className="text-xs text-muted-foreground">Podés registrar una fecha pasada si el mantenimiento ya fue realizado</p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {/* Tiempo que tomó hacer el mantenimiento */}
 <div className="space-y-2">
 <Label htmlFor="actualDuration" className="text-xs">
 Tiempo de Ejecución *
 </Label>
 <div className="flex gap-2">
 <Input
 id="actualDuration"
 type="number"
 step="0.1"
 min="0"
 placeholder="Ej: 2.5"
 value={executionData.actualDuration}
 onChange={(e) => setExecutionData(prev => ({
 ...prev,
 actualDuration: e.target.value
 }))}
 className={cn('flex-1 h-8 text-sm', errors.actualDuration && 'border-destructive')}
 />
 <Select
 value={executionData.actualDurationUnit}
 onValueChange={(value) => {
 setExecutionData(prev => ({
 ...prev,
 actualDurationUnit: value
 }));
 }}
 >
 <SelectTrigger className="w-[95px] h-8 text-sm shrink-0">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="MINUTES">Min</SelectItem>
 <SelectItem value="HOURS">Horas</SelectItem>
 </SelectContent>
 </Select>
 </div>
 {errors.actualDuration && (
 <p className="text-xs text-destructive">{typeof errors.actualDuration === 'string' ? errors.actualDuration : 'Error de validación'}</p>
 )}
 {getEstimatedTimeDisplay() && (
 <p className="text-xs text-muted-foreground">
 {getEstimatedTimeDisplay()}
 </p>
 )}
 </div>

 {/* Cantidad de ciclos/producto que aguantó */}
 <div className="space-y-2">
 <Label htmlFor="actualValue" className="text-xs">
 Cantidad de Ciclos/Producto *
 </Label>
 
 {!executionData.excludeQuantity && (
 <>
 <div className="flex gap-2">
 <Input
 id="actualValue"
 type="number"
 step="1"
 min="0"
 placeholder="Ej: 1000"
 value={executionData.actualValue}
 onChange={(e) => setExecutionData(prev => ({
 ...prev,
 actualValue: e.target.value
 }))}
 className={cn('flex-1 h-8 text-sm', errors.actualValue && 'border-destructive')}
 />
 
 <Select
 value={executionData.actualUnit}
 onValueChange={(value) => {
 setExecutionData(prev => ({
 ...prev,
 actualUnit: value
 }));
 }}
 >
 <SelectTrigger className="w-[110px] h-8 text-sm shrink-0">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="CYCLES">Ciclos</SelectItem>
 <SelectItem value="UNITS_PRODUCED">Unidades</SelectItem>
 <SelectItem value="KILOMETERS">Km</SelectItem>
 <SelectItem value="HOURS">Horas</SelectItem>
 <SelectItem value="DAYS">Días</SelectItem>
 <SelectItem value="SHIFTS">Turnos</SelectItem>
 </SelectContent>
 </Select>
 </div>
 
 {errors.actualValue && (
 <p className="text-xs text-destructive">{typeof errors.actualValue === 'string' ? errors.actualValue : 'Error de validación'}</p>
 )}
 
 <p className="text-xs text-muted-foreground">
 Cantidad que aguantó antes del mantenimiento
 </p>
 </>
 )}
 
 <div className="flex items-center space-x-2">
 <Checkbox
 id="excludeQuantity"
 checked={executionData.excludeQuantity}
 onCheckedChange={(checked) => {
 setExecutionData(prev => ({
 ...prev,
 excludeQuantity: checked as boolean
 }));
 }}
 className="h-3.5 w-3.5"
 />
 <Label htmlFor="excludeQuantity" className="text-xs font-medium">
 Excluir cantidad de ciclos/producto
 </Label>
 </div>
 </div>

 {/* Estado de Finalización */}
 <div className="space-y-2">
 <Label htmlFor="completionStatus" className="text-xs">
 Estado de Finalización
 </Label>
 <Select
 value={executionData.completionStatus}
 onValueChange={(value) => setExecutionData(prev => ({
 ...prev,
 completionStatus: value
 }))}
 >
 <SelectTrigger className="h-8 text-sm">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="COMPLETED">Completado</SelectItem>
 <SelectItem value="PARTIALLY_COMPLETED">Parcialmente Completado</SelectItem>
 <SelectItem value="REQUIRES_FOLLOWUP">Requiere Seguimiento</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>

 {/* Operadores */}
 <div className="space-y-2">
 <Label className="text-xs flex items-center gap-1.5">
 <Users className="h-3 w-3" />
 Operadores <span className="text-destructive">*</span>
 </Label>
 {loadingEmployees ? (
 <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
 <Loader2 className="h-3 w-3 animate-spin" />
 Cargando empleados...
 </div>
 ) : (
 <Popover open={operatorPopoverOpen} onOpenChange={setOperatorPopoverOpen}>
 <PopoverTrigger asChild>
 <Button
 variant="outline"
 role="combobox"
 aria-expanded={operatorPopoverOpen}
 className={cn(
 'h-8 w-full justify-between text-sm font-normal',
 errors.operators && 'border-destructive'
 )}
 >
 {selectedOperators.length > 0
 ? `${selectedOperators.length} operador${selectedOperators.length > 1 ? 'es' : ''} seleccionado${selectedOperators.length > 1 ? 's' : ''}`
 : 'Buscar y seleccionar operadores...'}
 <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-full p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)' }}>
 <Command>
 <CommandInput placeholder="Buscar por nombre..." className="h-8 text-sm" />
 <CommandList>
 <CommandEmpty className="py-3 text-xs text-center text-muted-foreground">
 No se encontraron empleados
 </CommandEmpty>
 <CommandGroup>
 {employees.map((employee: any) => {
 const isSelected = selectedOperators.some(op => op.id === employee.id);
 return (
 <CommandItem
 key={employee.id}
 value={employee.name}
 onSelect={() => {
 if (isSelected) {
 setSelectedOperators(prev => prev.filter(op => op.id !== employee.id));
 } else {
 setSelectedOperators(prev => [...prev, { id: employee.id, name: employee.name }]);
 }
 }}
 className="text-sm"
 >
 <Check className={cn('mr-2 h-3.5 w-3.5', isSelected ? 'opacity-100 text-primary' : 'opacity-0')} />
 {employee.name}
 </CommandItem>
 );
 })}
 </CommandGroup>
 </CommandList>
 </Command>
 </PopoverContent>
 </Popover>
 )}
 {selectedOperators.length > 0 && (
 <div className="flex flex-wrap gap-1.5">
 {selectedOperators.map((operator) => (
 <div key={operator.id} className="flex items-center gap-1 bg-muted rounded-full px-2.5 py-1 text-xs">
 <User className="h-3 w-3" />
 <span>{operator.name}</span>
 <button
 type="button"
 onClick={() => setSelectedOperators(prev => prev.filter(op => op.id !== operator.id))}
 className="ml-0.5 hover:text-destructive transition-colors"
 >
 <X className="h-3 w-3" />
 </button>
 </div>
 ))}
 </div>
 )}
 {errors.operators && (
 <p className="text-xs text-destructive">{errors.operators}</p>
 )}
 {!errors.operators && <p className="text-xs text-muted-foreground">Empleados que realizaron el mantenimiento</p>}
 </div>

 {/* Recursos Utilizados */}
 {(resources.length > 0 || loadingResources) && (
 <div className="space-y-3 pt-3 border-t">
 <Label className="text-xs flex items-center gap-1.5">
   <Package className="h-3 w-3" />
   Recursos Utilizados
 </Label>

 {loadingResources ? (
   <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
     <Loader2 className="h-3 w-3 animate-spin" />
     Cargando recursos...
   </div>
 ) : (
   <>
     {/* Herramientas */}
     {resources.filter(r => TOOL_TYPES.includes(r.toolItemType) || (r.toolItemType === 'UNKNOWN' && !CONSUMABLE_TYPES.includes(r.toolItemType))).length > 0 && (
       <div className="space-y-1.5">
         <p className="text-xs text-muted-foreground font-medium">Herramientas</p>
         {resources.map((r, idx) => {
           if (!TOOL_TYPES.includes(r.toolItemType) && r.toolItemType !== 'UNKNOWN') return null;
           if (r.toolItemType === 'UNKNOWN' && CONSUMABLE_TYPES.includes(r.toolItemType)) return null;
           return (
             <div key={`tool-${idx}`} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
               <Wrench className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
               <span className="text-xs flex-1 min-w-0 truncate">{r.toolName}</span>
               <span className="text-xs text-muted-foreground shrink-0">x{r.pickedQuantity}</span>
               <div className="flex items-center gap-1.5 shrink-0">
                 <Checkbox
                   id={`damaged-${idx}`}
                   checked={r.returnedDamaged}
                   onCheckedChange={(checked) => updateResource(idx, { returnedDamaged: checked as boolean })}
                   className="h-3.5 w-3.5"
                 />
                 <Label htmlFor={`damaged-${idx}`} className="text-xs text-muted-foreground cursor-pointer">
                   Dañada
                 </Label>
               </div>
               {r.isAdHoc && (
                 <button type="button" onClick={() => removeResource(idx)} className="text-muted-foreground hover:text-destructive">
                   <X className="h-3 w-3" />
                 </button>
               )}
             </div>
           );
         })}
       </div>
     )}

     {/* Repuestos / Insumos */}
     {resources.filter(r => CONSUMABLE_TYPES.includes(r.toolItemType)).length > 0 && (
       <div className="space-y-1.5">
         <p className="text-xs text-muted-foreground font-medium">Repuestos / Insumos</p>
         {resources.map((r, idx) => {
           if (!CONSUMABLE_TYPES.includes(r.toolItemType)) return null;
           const toReturn = r.pickedQuantity - r.usedQuantity;
           return (
             <div key={`part-${idx}`} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg flex-wrap">
               <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
               <span className="text-xs flex-1 min-w-0 truncate">{r.toolName}</span>
               {!r.isAdHoc && (
                 <span className="text-xs text-muted-foreground shrink-0">Sacado: {r.pickedQuantity}</span>
               )}
               <div className="flex items-center gap-1 shrink-0">
                 <span className="text-xs text-muted-foreground">Usado:</span>
                 <div className="flex items-center border rounded-md">
                   <button
                     type="button"
                     onClick={() => updateResource(idx, { usedQuantity: Math.max(0, r.usedQuantity - 1) })}
                     className="h-6 w-6 flex items-center justify-center hover:bg-muted transition-colors"
                     disabled={r.usedQuantity <= 0}
                   >
                     <Minus className="h-3 w-3" />
                   </button>
                   <Input
                     type="number"
                     min={0}
                     max={r.isAdHoc ? 9999 : r.pickedQuantity}
                     value={r.usedQuantity}
                     onChange={(e) => {
                       const val = Math.max(0, Math.min(r.isAdHoc ? 9999 : r.pickedQuantity, Number(e.target.value) || 0));
                       updateResource(idx, { usedQuantity: val });
                     }}
                     className="h-6 w-12 text-center text-xs border-0 px-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                   />
                   <button
                     type="button"
                     onClick={() => updateResource(idx, { usedQuantity: Math.min(r.isAdHoc ? 9999 : r.pickedQuantity, r.usedQuantity + 1) })}
                     className="h-6 w-6 flex items-center justify-center hover:bg-muted transition-colors"
                     disabled={!r.isAdHoc && r.usedQuantity >= r.pickedQuantity}
                   >
                     <Plus className="h-3 w-3" />
                   </button>
                 </div>
               </div>
               {!r.isAdHoc && toReturn > 0 && (
                 <Badge variant="secondary" className="text-xs h-5 shrink-0">
                   Devolver: {toReturn}
                 </Badge>
               )}
               {r.isAdHoc && (
                 <button type="button" onClick={() => removeResource(idx)} className="text-muted-foreground hover:text-destructive shrink-0">
                   <X className="h-3 w-3" />
                 </button>
               )}
             </div>
           );
         })}
       </div>
     )}

     {/* Botón agregar recurso no planificado (solo correctivos) */}
     {!(maintenance.isPreventive || maintenance.type === 'PREVENTIVE') && (
       <div className="space-y-2">
         {!showAdHocSearch ? (
           <Button
             type="button"
             variant="outline"
             size="sm"
             className="h-7 text-xs"
             onClick={() => setShowAdHocSearch(true)}
           >
             <Plus className="h-3 w-3 mr-1" />
             Agregar recurso no planificado
           </Button>
         ) : (
           <div className="p-2 border rounded-lg space-y-2 bg-muted/20">
             <div className="flex items-center gap-2">
               <div className="relative flex-1">
                 <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                 <Input
                   placeholder="Buscar en pañol..."
                   value={adHocSearch}
                   onChange={(e) => {
                     setAdHocSearch(e.target.value);
                     searchAdHocTool(e.target.value);
                   }}
                   className="h-7 text-xs pl-7"
                   autoFocus
                 />
               </div>
               <Button
                 type="button"
                 variant="ghost"
                 size="sm"
                 className="h-7 w-7 p-0"
                 onClick={() => { setShowAdHocSearch(false); setAdHocSearch(''); setAdHocResults([]); }}
               >
                 <X className="h-3 w-3" />
               </Button>
             </div>
             {searchingAdHoc && (
               <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
                 <Loader2 className="h-3 w-3 animate-spin" />
                 Buscando...
               </div>
             )}
             {adHocResults.length > 0 && (
               <div className="max-h-32 overflow-y-auto space-y-1">
                 {adHocResults.map((tool: any) => (
                   <button
                     key={tool.id}
                     type="button"
                     className="w-full flex items-center gap-2 p-1.5 hover:bg-muted rounded text-left transition-colors"
                     onClick={() => addAdHocResource(tool)}
                   >
                     {TOOL_TYPES.includes(tool.itemType) ? (
                       <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
                     ) : (
                       <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                     )}
                     <span className="text-xs flex-1 truncate">{tool.name}</span>
                     <Badge variant="outline" className="text-[10px] h-4 shrink-0">
                       {tool.itemType === 'TOOL' ? 'Herramienta' :
                        tool.itemType === 'HAND_TOOL' ? 'Herr. manual' :
                        tool.itemType === 'SPARE_PART' ? 'Repuesto' :
                        tool.itemType === 'CONSUMABLE' ? 'Consumible' :
                        tool.itemType === 'MATERIAL' ? 'Material' : tool.itemType}
                     </Badge>
                     {tool.stockQuantity != null && (
                       <span className="text-[10px] text-muted-foreground shrink-0">Stock: {tool.stockQuantity}</span>
                     )}
                   </button>
                 ))}
               </div>
             )}
             {adHocSearch.length >= 2 && !searchingAdHoc && adHocResults.length === 0 && (
               <p className="text-xs text-muted-foreground py-1">No se encontraron resultados</p>
             )}
           </div>
         )}
       </div>
     )}
   </>
 )}
 </div>
 )}

 {/* Notas */}
 <div className="space-y-2">
 <Label htmlFor="notes" className="text-xs flex items-center gap-1.5">
 <MessageSquare className="h-3 w-3" />
 Notas de Ejecución
 </Label>
 <div className="flex flex-wrap gap-1.5 mb-2">
 <button
 type="button"
 onClick={() => setExecutionData(prev => ({
 ...prev,
 notes: prev.notes ? `${prev.notes}\nTodo OK` : 'Todo OK'
 }))}
 className="inline-flex items-center gap-1.5 rounded-full bg-success-muted hover:bg-success-muted border border-success-muted px-2.5 py-1 text-xs font-medium text-success hover:text-success-muted-foreground transition-colors"
 >
 <ThumbsUp className="h-3 w-3" />
 Todo OK
 </button>
 <button
 type="button"
 onClick={() => setExecutionData(prev => ({
 ...prev,
 notes: prev.notes ? `${prev.notes}\nCompletado según procedimiento` : 'Completado según procedimiento'
 }))}
 className="inline-flex items-center gap-1.5 rounded-full bg-info-muted hover:bg-info-muted border border-info-muted px-2.5 py-1 text-xs font-medium text-info-muted-foreground hover:text-info-muted-foreground transition-colors"
 >
 <FileCheck className="h-3 w-3" />
 Según procedimiento
 </button>
 <button
 type="button"
 onClick={() => setExecutionData(prev => ({
 ...prev,
 notes: prev.notes ? `${prev.notes}\nSin observaciones` : 'Sin observaciones'
 }))}
 className="inline-flex items-center gap-1.5 rounded-full bg-muted hover:bg-accent border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:text-foreground transition-colors"
 >
 <Ban className="h-3 w-3" />
 Sin observaciones
 </button>
 </div>
 <Textarea
 id="notes"
 placeholder="Observaciones del mantenimiento..."
 rows={2}
 value={executionData.notes}
 onChange={(e) => setExecutionData(prev => ({
 ...prev,
 notes: e.target.value
 }))}
 className="text-sm min-h-[60px]"
 />
 </div>

 {/* Problemas Encontrados */}
 <div className="space-y-2">
 <Label htmlFor="issues" className="text-xs flex items-center gap-1.5">
 <AlertTriangle className="h-3 w-3" />
 Problemas Encontrados
 </Label>
 <div className="flex flex-wrap gap-1.5 mb-2">
 <button
 type="button"
 onClick={() => setExecutionData(prev => ({
 ...prev,
 issues: prev.issues ? `${prev.issues}\nNinguno` : 'Ninguno'
 }))}
 className="inline-flex items-center gap-1.5 rounded-full bg-success-muted hover:bg-success-muted border border-success-muted px-2.5 py-1 text-xs font-medium text-success hover:text-success-muted-foreground transition-colors"
 >
 <ShieldCheck className="h-3 w-3" />
 Ninguno
 </button>
 <button
 type="button"
 onClick={() => setExecutionData(prev => ({
 ...prev,
 issues: prev.issues ? `${prev.issues}\nSin problemas` : 'Sin problemas'
 }))}
 className="inline-flex items-center gap-1.5 rounded-full bg-info-muted hover:bg-info-muted border border-info-muted px-2.5 py-1 text-xs font-medium text-info-muted-foreground hover:text-info-muted-foreground transition-colors"
 >
 <CheckCircle className="h-3 w-3" />
 Sin problemas
 </button>
 <button
 type="button"
 onClick={() => setExecutionData(prev => ({
 ...prev,
 issues: prev.issues ? `${prev.issues}\nDesgaste normal` : 'Desgaste normal'
 }))}
 className="inline-flex items-center gap-1.5 rounded-full bg-warning-muted hover:bg-warning-muted border border-warning-muted px-2.5 py-1 text-xs font-medium text-warning-muted-foreground hover:text-warning-muted-foreground transition-colors"
 >
 <Activity className="h-3 w-3" />
 Desgaste normal
 </button>
 <button
 type="button"
 onClick={() => setExecutionData(prev => ({
 ...prev,
 issues: prev.issues ? `${prev.issues}\nRequiere seguimiento` : 'Requiere seguimiento'
 }))}
 className="inline-flex items-center gap-1.5 rounded-full bg-warning-muted hover:bg-warning-muted border border-warning-muted px-2.5 py-1 text-xs font-medium text-warning-muted-foreground hover:text-warning-muted-foreground transition-colors"
 >
 <Zap className="h-3 w-3" />
 Requiere seguimiento
 </button>
 </div>
 <Textarea
 id="issues"
 placeholder="Problemas o anomalías encontradas..."
 rows={2}
 value={executionData.issues}
 onChange={(e) => setExecutionData(prev => ({
 ...prev,
 issues: e.target.value
 }))}
 className="text-sm min-h-[60px]"
 />
 </div>

 {/* Evidencia Fotográfica */}
 <div className="space-y-2 pt-3 border-t">
 <Label className="text-xs flex items-center gap-1.5">
 <Camera className="h-3.5 w-3.5" />
 Evidencia Fotográfica
 </Label>
 <p className="text-xs text-muted-foreground">
 Adjunta fotos del trabajo realizado o problemas encontrados
 </p>

 {/* Área de subida */}
 <div className="flex items-center gap-2">
 <label
 htmlFor="photo-upload"
 className="flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted border border-dashed border-muted-foreground/25 rounded-lg cursor-pointer transition-colors"
 >
 <Camera className="h-4 w-4 text-muted-foreground" />
 <span className="text-xs text-muted-foreground">Agregar fotos</span>
 </label>
 <input
 id="photo-upload"
 type="file"
 accept="image/*"
 multiple
 onChange={handlePhotoUpload}
 className="hidden"
 />
 {photos.length > 0 && (
 <Badge variant="secondary" className="text-xs">
 {photos.length} foto{photos.length > 1 ? 's' : ''}
 </Badge>
 )}
 </div>

 {/* Previsualizaciones */}
 {photos.length > 0 && (
 <div className="flex flex-wrap gap-2 mt-2">
 {photos.map((photo, index) => (
 <div key={index} className="relative group">
 <img
 src={photo.preview}
 alt={`Foto ${index + 1}`}
 className="w-16 h-16 object-cover rounded-lg border"
 />
 <button
 type="button"
 onClick={() => removePhoto(index)}
 className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
 >
 <X className="h-3 w-3" />
 </button>
 </div>
 ))}
 </div>
 )}
 </div>
 </CardContent>
 </Card>
 </div>
 </DialogBody>

 <DialogFooter>
 <Button
 variant="outline"
 onClick={onClose}
 disabled={isLoading}
 className="h-8 text-xs px-3"
 >
 Cancelar
 </Button>
 <Button
 onClick={handleSubmit}
 disabled={isLoading}
 className="h-8 text-xs px-4 min-w-[100px]"
 >
 {isLoading ? (
 <>
 <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
 Guardando...
 </>
 ) : (
 <>
 <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
 Realizar
 </>
 )}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
