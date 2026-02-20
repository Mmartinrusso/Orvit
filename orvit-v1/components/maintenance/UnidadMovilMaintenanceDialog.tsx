'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
 Truck, 
 Calendar, 
 Clock, 
 AlertTriangle, 
 Wrench,
 User,
 FileText,
 Plus,
 X,
 History,
 Loader2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DatePicker } from '@/components/ui/date-picker';

interface UnidadMovil {
 id: number;
 nombre: string;
 tipo: string;
 marca: string;
 modelo: string;
 año: number;
 patente: string;
 estado: string;
 sectorId?: number;
 sector?: {
 id: number;
 name: string;
 };
 kilometraje?: number;
}

interface User {
 id: number;
 name: string;
 email: string;
}

interface UnidadMovilMaintenanceDialogProps {
 isOpen: boolean;
 onClose: () => void;
 onSave: (data: any) => void;
 companyId: number;
 sectorId?: number;
 selectedUnidad?: UnidadMovil;
 editingMaintenance?: any;
 mode?: 'create' | 'edit';
}

export default function UnidadMovilMaintenanceDialog({
 isOpen,
 onClose,
 onSave,
 companyId,
 sectorId,
 selectedUnidad,
 editingMaintenance,
 mode = 'create'
}: UnidadMovilMaintenanceDialogProps) {
 const [loading, setLoading] = useState(false);
 const [unidades, setUnidades] = useState<UnidadMovil[]>([]);
 const [users, setUsers] = useState<User[]>([]);
 const [activeTab, setActiveTab] = useState('general');
 
 // Estados para el historial
 const [maintenanceHistory, setMaintenanceHistory] = useState([]);
 const [loadingHistory, setLoadingHistory] = useState(false);
 const [showHistoryModal, setShowHistoryModal] = useState(false);

 const [formData, setFormData] = useState({
 title: '',
 description: '',
 type: 'PREVENTIVE',
 priority: 'MEDIUM',
 unidadMovilId: selectedUnidad?.id?.toString() || '',
 assignedToId: '',
 scheduledDate: format(new Date(), 'dd/MM/yyyy'), // Cambiar a formato dd/mm/yyyy
 estimatedHours: 2,
 estimatedMinutes: 0,
 estimatedTimeType: 'MINUTES', // 'MINUTES' o 'HOURS'
 maintenanceInterval: 0,
 maintenanceIntervalType: 'DAYS', // 'DAYS', 'HOURS' o 'KILOMETERS'
 frequency: 'MONTHLY',
 notes: '',
 tools: [] as Array<{name: string, description: string}>,
 spareParts: [] as Array<{name: string, quantity: number, cost: number}>,
 instructives: [] as Array<{title: string, description: string, file: any}>,
 // Campos específicos para unidades móviles
 maintenanceTrigger: 'KILOMETERS', // 'KILOMETERS' o 'DAYS'
 triggerValue: 10000, // Valor del trigger (km o días)
 currentKilometers: selectedUnidad?.kilometraje || 0,
 nextMaintenanceKilometers: (selectedUnidad?.kilometraje || 0) + 10000
 });

 const [toolInput, setToolInput] = useState({ name: '', description: '' });
 const [sparePartInput, setSparePartInput] = useState({ name: '', quantity: 1, cost: 0 });
 const [instructiveInput, setInstructiveInput] = useState({ title: '', description: '', file: null });
 const [uploadedFiles, setUploadedFiles] = useState<Array<{name: string, file: File, size: number}>>([]);

 useEffect(() => {
 if (isOpen) {
 loadUnidades();
 loadUsers();
 if (editingMaintenance) {
 loadMaintenanceData();
 } else if (selectedUnidad) {
 setFormData(prev => ({
 ...prev,
 unidadMovilId: selectedUnidad.id.toString(),
 currentKilometers: selectedUnidad.kilometraje || 0,
 nextMaintenanceKilometers: (selectedUnidad.kilometraje || 0) + 10000
 }));
 }
 }
 }, [isOpen, selectedUnidad, editingMaintenance]);

 const loadMaintenanceData = () => {
 if (editingMaintenance) {
 // Determinar el tipo de tiempo basado en los minutos
 let timeType = 'MINUTES';
 if (editingMaintenance.estimatedMinutes && editingMaintenance.estimatedMinutes >= 60) {
 // Si tiene 60+ minutos, verificar si es más lógico mostrarlo en horas
 const hours = editingMaintenance.estimatedMinutes / 60;
 if (hours % 1 === 0 || hours >= 2) { // Si es un número entero o >= 2 horas
 timeType = 'HOURS';
 }
 }
 
 setFormData({
 title: editingMaintenance.title || '',
 description: editingMaintenance.description || '',
 type: editingMaintenance.type || 'PREVENTIVE',
 priority: editingMaintenance.priority || 'MEDIUM',
 unidadMovilId: editingMaintenance.unidadMovilId?.toString() || '',
 assignedToId: editingMaintenance.assignedToId?.toString() || '',
 scheduledDate: editingMaintenance.scheduledDate ? formatDateToDDMMYYYY(editingMaintenance.scheduledDate) : format(new Date(), 'dd/MM/yyyy'),
 estimatedHours: editingMaintenance.estimatedHours || 2,
 estimatedMinutes: editingMaintenance.estimatedMinutes || 0,
 estimatedTimeType: editingMaintenance.estimatedTimeType || timeType,
 maintenanceInterval: editingMaintenance.maintenanceInterval || 0,
 maintenanceIntervalType: editingMaintenance.maintenanceIntervalType || 'DAYS',
 frequency: editingMaintenance.frequency || 'MONTHLY',
 notes: editingMaintenance.notes || '',
 tools: editingMaintenance.tools || [],
 spareParts: editingMaintenance.spareParts || [],
 instructives: editingMaintenance.instructives || [],
 maintenanceTrigger: editingMaintenance.maintenanceTrigger || 'KILOMETERS',
 triggerValue: editingMaintenance.triggerValue || 10000,
 currentKilometers: editingMaintenance.currentKilometers || 0,
 nextMaintenanceKilometers: editingMaintenance.nextMaintenanceKilometers || 0
 });
 
 // Cargar archivos si existen
 if (editingMaintenance.uploadedFiles && editingMaintenance.uploadedFiles.length > 0) {
 setUploadedFiles(editingMaintenance.uploadedFiles.map((file: any) => ({
 name: file.name,
 file: new File([], file.name, { type: file.type }),
 size: file.size
 })));
 }
 }
 };

 const loadUnidades = async () => {
 try {
 const response = await fetch(`/api/mantenimiento/unidades-moviles?companyId=${companyId}`);
 if (response.ok) {
 const data = await response.json();
 // La API devuelve { unidades: [...] }, necesitamos extraer el array
 const unidadesArray = data.unidades || data;
 setUnidades(Array.isArray(unidadesArray) ? unidadesArray : []);
 }
 } catch (error) {
 console.error('Error loading unidades:', error);
 setUnidades([]);
 }
 };

 const loadUsers = async () => {
 try {
 const response = await fetch(`/api/users?companyId=${companyId}`);
 if (response.ok) {
 const data = await response.json();
 // Asegurar que data sea un array
 setUsers(Array.isArray(data) ? data : []);
 }
 } catch (error) {
 console.error('Error loading users:', error);
 setUsers([]);
 }
 };

 const handleSubmit = async () => {
 if (!formData.title || !formData.unidadMovilId) {
 toast({
 title: 'Error',
 description: 'Por favor completa todos los campos obligatorios',
 variant: 'destructive'
 });
 return;
 }

 // Validar fecha
 if (!isCompleteAndValidDate(formData.scheduledDate)) {
 toast({
 title: 'Error',
 description: 'Por favor ingrese una fecha válida en formato dd/mm/yyyy',
 variant: 'destructive'
 });
 return;
 }

 setLoading(true);
 try {
 const maintenanceData = {
 ...formData,
 companyId,
 sectorId,
 unidadMovilId: parseInt(formData.unidadMovilId),
 assignedToId: formData.assignedToId ? parseInt(formData.assignedToId) : null,
 estimatedHours: parseFloat(formData.estimatedHours.toString()),
 estimatedMinutes: parseInt(formData.estimatedMinutes.toString()),
 estimatedTimeType: formData.estimatedTimeType,
 // Agregar ID para modo edición
 ...(mode === 'edit' && editingMaintenance && { id: editingMaintenance.id }),
 // Campos específicos para unidades móviles
 maintenanceTrigger: formData.maintenanceTrigger,
 triggerValue: formData.triggerValue,
 currentKilometers: formData.currentKilometers,
 nextMaintenanceKilometers: formData.nextMaintenanceKilometers,
 scheduledDate: convertDateToISO(formData.scheduledDate),
 tools: formData.tools,
 spareParts: formData.spareParts,
 instructives: formData.instructives,
 uploadedFiles: uploadedFiles.map(file => ({
 name: file.name,
 size: file.size,
 type: file.file.type,
 uploadedAt: new Date().toISOString()
 })), // Agregar información de archivos subidos
 frequencyDays: getFrequencyDays(formData.frequency), // Agregar días de frecuencia
 isRecurring: true, // Siempre true ya que usamos frecuencia
 isActive: true // Siempre true para mantenimientos activos
 };

 // Llamar al endpoint API para crear el mantenimiento
 const response = await fetch('/api/maintenance/unidad-movil', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify(maintenanceData),
 });

 const result = await response.json();

 if (result.success) {
 toast({
 title: 'Mantenimiento Creado',
 description: `El mantenimiento para la unidad móvil se ha creado exitosamente`,
 });
 // Solo notificar el éxito, no pasar los datos para evitar duplicación
 onSave({ success: true });
 onClose();
 } else {
 throw new Error(result.error || 'Error al crear el mantenimiento');
 }
 } catch (error) {
 console.error('Error creating maintenance:', error);
 toast({
 title: 'Error',
 description: 'No se pudo crear el mantenimiento',
 variant: 'destructive'
 });
 } finally {
 setLoading(false);
 }
 };

 const addTool = () => {
 if (toolInput.name.trim()) {
 setFormData(prev => ({
 ...prev,
 tools: [...prev.tools, { ...toolInput }]
 }));
 setToolInput({ name: '', description: '' });
 }
 };

 const removeTool = (index: number) => {
 setFormData(prev => ({
 ...prev,
 tools: prev.tools.filter((_, i) => i !== index)
 }));
 };

 const addSparePart = () => {
 if (sparePartInput.name.trim()) {
 setFormData(prev => ({
 ...prev,
 spareParts: [...prev.spareParts, { ...sparePartInput }]
 }));
 setSparePartInput({ name: '', quantity: 1, cost: 0 });
 }
 };

 const removeSparePart = (index: number) => {
 setFormData(prev => ({
 ...prev,
 spareParts: prev.spareParts.filter((_, i) => i !== index)
 }));
 };

 const addInstructive = () => {
 if (instructiveInput.title.trim()) {
 setFormData(prev => ({
 ...prev,
 instructives: [...prev.instructives, { ...instructiveInput }]
 }));
 setInstructiveInput({ title: '', description: '', file: null });
 }
 };

 const removeInstructive = (index: number) => {
 setFormData(prev => ({
 ...prev,
 instructives: prev.instructives.filter((_, i) => i !== index)
 }));
 };

 const getPriorityColor = (priority: string) => {
 switch (priority) {
 case 'LOW': return 'bg-muted text-foreground';
 case 'MEDIUM': return 'bg-warning-muted text-warning-muted-foreground';
 case 'HIGH': return 'bg-warning-muted text-warning-muted-foreground';
 case 'URGENT': return 'bg-destructive/10 text-destructive';
 default: return 'bg-muted text-foreground';
 }
 };

 const getPriorityText = (priority: string) => {
 switch (priority) {
 case 'LOW': return 'Baja';
 case 'MEDIUM': return 'Media';
 case 'HIGH': return 'Alta';
 case 'URGENT': return 'Urgente';
 default: return priority;
 }
 };

 const getTypeColor = (type: string) => {
 switch (type) {
 case 'PREVENTIVE': return 'bg-success-muted text-success-muted-foreground';
 case 'CORRECTIVE': return 'bg-warning-muted text-warning-muted-foreground';
 case 'PREDICTIVE': return 'bg-info-muted text-info-muted-foreground';
 case 'EMERGENCY': return 'bg-destructive/10 text-destructive';
 default: return 'bg-muted text-foreground';
 }
 };

 const getTypeText = (type: string) => {
 switch (type) {
 case 'PREVENTIVE': return 'Preventivo';
 case 'CORRECTIVE': return 'Correctivo';
 case 'PREDICTIVE': return 'Predictivo';
 case 'EMERGENCY': return 'Emergencia';
 default: return type;
 }
 };

 // Función para cargar el historial de mantenimientos de la unidad móvil
 const loadMaintenanceHistory = async (unidadMovilId: number) => {
 try {
 setLoadingHistory(true);
 const response = await fetch(`/api/maintenance/history?companyId=${companyId}&unidadMovilId=${unidadMovilId}`);
 if (response.ok) {
 const data = await response.json();
 setMaintenanceHistory(data.data?.executions || []);
 } else {
 console.error('Error cargando historial:', response.statusText);
 setMaintenanceHistory([]);
 }
 } catch (error) {
 console.error('Error cargando historial:', error);
 setMaintenanceHistory([]);
 } finally {
 setLoadingHistory(false);
 }
 };

 const handleUnidadChange = (unidadId: string) => {
 const unidad = unidades.find(u => u.id.toString() === unidadId);
 if (unidad) {
 setFormData(prev => ({
 ...prev,
 unidadMovilId: unidadId,
 currentKilometers: unidad.kilometraje || 0,
 nextMaintenanceKilometers: (unidad.kilometraje || 0) + prev.triggerValue
 }));
 }
 };

 const handleTriggerValueChange = (value: number) => {
 setFormData(prev => ({
 ...prev,
 triggerValue: value,
 nextMaintenanceKilometers: prev.currentKilometers + value
 }));
 };

 const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
 const files = event.target.files;
 if (files) {
 const newFiles = Array.from(files).map(file => ({
 name: file.name,
 file: file,
 size: file.size
 }));
 setUploadedFiles(prev => [...prev, ...newFiles]);
 }
 };

 const removeFile = (index: number) => {
 setUploadedFiles(prev => prev.filter((_, i) => i !== index));
 };

 const formatFileSize = (bytes: number) => {
 if (bytes === 0) return '0 Bytes';
 const k = 1024;
 const sizes = ['Bytes', 'KB', 'MB', 'GB'];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
 };

 const generateTitle = () => {
 if (!formData.title && formData.maintenanceIntervalType && formData.maintenanceInterval) {
 const triggerText = formData.maintenanceIntervalType === 'HOURS' 
 ? `cada ${formData.maintenanceInterval.toLocaleString()} horas`
 : formData.maintenanceIntervalType === 'KILOMETERS'
 ? `cada ${formData.maintenanceInterval.toLocaleString()} km`
 : `cada ${formData.maintenanceInterval} días`;
 
 setFormData(prev => ({
 ...prev,
 title: `Mantenimiento preventivo ${triggerText}`
 }));
 }
 };

 const getNextMaintenanceDate = () => {
 if (!formData.frequency) return null;
 
 // Usar la fecha programada como base para el cálculo
 let baseDate: Date;
 try {
 if (formData.scheduledDate && formData.scheduledDate.includes('/')) {
 // Convertir de dd/mm/yyyy a Date
 const [day, month, year] = formData.scheduledDate.split('/');
 baseDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
 } else {
 baseDate = new Date();
 }
 } catch (error) {
 baseDate = new Date();
 }
 
 const nextDate = new Date(baseDate);
 
 switch (formData.frequency) {
 case 'DAILY':
 nextDate.setDate(nextDate.getDate() + 1);
 break;
 case 'WEEKLY':
 nextDate.setDate(nextDate.getDate() + 7);
 break;
 case 'BIWEEKLY':
 nextDate.setDate(nextDate.getDate() + 15);
 break;
 case 'MONTHLY':
 nextDate.setMonth(nextDate.getMonth() + 1);
 break;
 case 'QUARTERLY':
 nextDate.setMonth(nextDate.getMonth() + 3);
 break;
 case 'YEARLY':
 nextDate.setFullYear(nextDate.getFullYear() + 1);
 break;
 default:
 return null;
 }
 
 return nextDate;
 };

 const getFrequencyText = (frequency: string) => {
 switch (frequency) {
 case 'DAILY': return 'Diario';
 case 'WEEKLY': return 'Semanal';
 case 'BIWEEKLY': return 'Quincenal';
 case 'MONTHLY': return 'Mensual';
 case 'QUARTERLY': return 'Trimestral';
 case 'YEARLY': return 'Anual';
 default: return frequency;
 }
 };

 const getFrequencyDays = (frequency: string) => {
 switch (frequency) {
 case 'DAILY': return 1;
 case 'WEEKLY': return 7;
 case 'BIWEEKLY': return 15;
 case 'MONTHLY': return 30;
 case 'QUARTERLY': return 90;
 case 'YEARLY': return 365;
 default: return 30;
 }
 };

 // Función para convertir fecha de dd/mm/yyyy a formato ISO para el backend
 const convertDateToISO = (dateString: string) => {
 if (!dateString) return new Date().toISOString();
 
 try {
 // Si ya está en formato ISO, devolverlo
 if (dateString.includes('T') || dateString.includes('-')) {
 return new Date(dateString).toISOString();
 }
 
 // Convertir de dd/mm/yyyy a Date
 const [day, month, year] = dateString.split('/');
 const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
 return date.toISOString();
 } catch (error) {
 console.error('Error converting date:', error);
 return new Date().toISOString();
 }
 };

 // Función para formatear fecha a dd/mm/yyyy
 const formatDateToDDMMYYYY = (date: Date | string) => {
 try {
 const dateObj = typeof date === 'string' ? new Date(date) : date;
 return format(dateObj, 'dd/MM/yyyy');
 } catch (error) {
 console.error('Error formatting date:', error);
 return format(new Date(), 'dd/MM/yyyy');
 }
 };

 // Función para validar y formatear fecha en tiempo real
 const handleDateInputChange = (value: string) => {
 // Remover caracteres no numéricos excepto barras
 let cleanValue = value.replace(/[^\d\/]/g, '');
 
 // Si el usuario borra todo, permitir campo vacío
 if (cleanValue === '') {
 setFormData(prev => ({ ...prev, scheduledDate: '' }));
 return;
 }
 
 // Agregar barras automáticamente
 if (cleanValue.length === 2 && !cleanValue.includes('/')) {
 cleanValue = cleanValue + '/';
 } else if (cleanValue.length === 5 && cleanValue.split('/').length === 2) {
 cleanValue = cleanValue + '/';
 }
 
 // Limitar a 10 caracteres (dd/mm/yyyy)
 if (cleanValue.length <= 10) {
 setFormData(prev => ({ ...prev, scheduledDate: cleanValue }));
 }
 };

 // Función para validar si la fecha es válida
 const isValidDate = (dateString: string) => {
 if (!dateString) return true; // Permitir campo vacío
 
 // Si la fecha no está completa, no validar aún
 if (dateString.length !== 10) return true;
 
 try {
 const [day, month, year] = dateString.split('/');
 const dayNum = parseInt(day);
 const monthNum = parseInt(month);
 const yearNum = parseInt(year);
 
 // Validaciones básicas
 if (dayNum < 1 || dayNum > 31) return false;
 if (monthNum < 1 || monthNum > 12) return false;
 if (yearNum < 1900 || yearNum > 2100) return false;
 
 // Crear fecha y verificar que sea válida
 const date = new Date(yearNum, monthNum - 1, dayNum);
 return date.getDate() === dayNum && 
 date.getMonth() === monthNum - 1 && 
 date.getFullYear() === yearNum;
 } catch (error) {
 return false;
 }
 };

 // Función para validar si la fecha está completa y es válida
 const isCompleteAndValidDate = (dateString: string) => {
 return dateString.length === 10 && isValidDate(dateString);
 };

 const selectedUnidadData = Array.isArray(unidades) ? unidades.find(u => u.id.toString() === formData.unidadMovilId) : null;

 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent size="lg">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <div className="bg-info-muted p-2 rounded-lg">
 <Truck className="h-5 w-5 text-info-muted-foreground" />
 </div>
 {mode === 'edit' ? 'Editar Mantenimiento - Unidad Móvil' : 'Nuevo Mantenimiento - Unidad Móvil'}
 </DialogTitle>
 <DialogDescription>
 {mode === 'edit' ? 'Edita el mantenimiento de la unidad móvil' : 'Crea un nuevo mantenimiento para una unidad móvil'}
 </DialogDescription>
 </DialogHeader>

 <DialogBody>
 <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
 <TabsList className="w-full justify-start overflow-x-auto">
 <TabsTrigger value="general">General</TabsTrigger>
 <TabsTrigger value="schedule">Programación</TabsTrigger>
 <TabsTrigger value="resources">Recursos</TabsTrigger>
 <TabsTrigger value="details">Detalles</TabsTrigger>
 </TabsList>

 <TabsContent value="general" className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="title">Título del Mantenimiento *</Label>
 <div className="flex gap-2">
 <Input
 id="title"
 value={formData.title}
 onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
 placeholder="Ej: Cambio de ruedas cada 10,000 km"
 className="flex-1"
 />
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={generateTitle}
 disabled={!formData.maintenanceIntervalType || !formData.maintenanceInterval}
 title="Generar título automáticamente"
 >
 <Plus className="h-4 w-4" />
 </Button>
 </div>
 </div>

 <div className="space-y-2">
 <Label htmlFor="type">Tipo de Mantenimiento</Label>
 <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="PREVENTIVE">Preventivo</SelectItem>
 <SelectItem value="CORRECTIVE">Correctivo</SelectItem>
 <SelectItem value="PREDICTIVE">Predictivo</SelectItem>
 <SelectItem value="EMERGENCY">Emergencia</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label htmlFor="priority">Prioridad</Label>
 <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="LOW">Baja</SelectItem>
 <SelectItem value="MEDIUM">Media</SelectItem>
 <SelectItem value="HIGH">Alta</SelectItem>
 <SelectItem value="URGENT">Urgente</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label htmlFor="unidadMovilId">Unidad Móvil *</Label>
 <Select value={formData.unidadMovilId} onValueChange={handleUnidadChange}>
 <SelectTrigger>
 <SelectValue placeholder="Seleccionar unidad móvil" />
 </SelectTrigger>
 <SelectContent>
 {Array.isArray(unidades) && unidades.map((unidad) => (
 <SelectItem key={unidad.id} value={unidad.id.toString()}>
 {unidad.nombre} - {unidad.patente} ({unidad.tipo}) - {unidad.kilometraje} km
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 </div>

 <div className="space-y-2">
 <Label htmlFor="description">Descripción</Label>
 <Textarea
 id="description"
 value={formData.description}
 onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
 placeholder="Describe las tareas a realizar en este mantenimiento..."
 rows={3}
 />
 </div>

 {/* Plantillas comunes */}
 <div className="bg-background p-4 rounded-lg border">
 <p className="text-sm font-medium text-foreground mb-3">Plantillas comunes:</p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => {
 setFormData(prev => ({
 ...prev,
 title: 'Cambio de aceite del motor',
 description: 'Cambio de aceite del motor y filtro de aceite. Verificar nivel de aceite y estado del filtro.',
 type: 'PREVENTIVE',
 priority: 'MEDIUM',
 maintenanceTrigger: 'KILOMETERS',
 triggerValue: 10000,
 estimatedHours: 2,
 estimatedMinutes: 120,
 estimatedTimeType: 'MINUTES',
 maintenanceInterval: 10000,
 maintenanceIntervalType: 'KILOMETERS'
 }));
 }}
 className="justify-start text-left h-auto p-3"
 >
 <div>
 <div className="font-medium">Cambio de aceite</div>
 <div className="text-xs text-muted-foreground">cada 10,000 km</div>
 </div>
 </Button>
 
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => {
 setFormData(prev => ({
 ...prev,
 title: 'Cambio de ruedas',
 description: 'Cambio de ruedas delanteras y traseras. Verificar presión y estado de las ruedas.',
 type: 'PREVENTIVE',
 priority: 'MEDIUM',
 maintenanceTrigger: 'KILOMETERS',
 triggerValue: 10000,
 estimatedHours: 3,
 estimatedMinutes: 180,
 estimatedTimeType: 'MINUTES',
 maintenanceInterval: 10000,
 maintenanceIntervalType: 'KILOMETERS'
 }));
 }}
 className="justify-start text-left h-auto p-3"
 >
 <div>
 <div className="font-medium">Cambio de ruedas</div>
 <div className="text-xs text-muted-foreground">cada 10,000 km</div>
 </div>
 </Button>
 
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => {
 setFormData(prev => ({
 ...prev,
 title: 'Revisión de frenos',
 description: 'Revisión completa del sistema de frenos. Verificar pastillas, discos y líquido de frenos.',
 type: 'PREVENTIVE',
 priority: 'HIGH',
 maintenanceTrigger: 'KILOMETERS',
 triggerValue: 15000,
 estimatedHours: 4,
 estimatedMinutes: 240,
 estimatedTimeType: 'MINUTES',
 maintenanceInterval: 15000,
 maintenanceIntervalType: 'KILOMETERS'
 }));
 }}
 className="justify-start text-left h-auto p-3"
 >
 <div>
 <div className="font-medium">Revisión de frenos</div>
 <div className="text-xs text-muted-foreground">cada 15,000 km</div>
 </div>
 </Button>
 
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => {
 setFormData(prev => ({
 ...prev,
 title: 'Mantenimiento mayor',
 description: 'Mantenimiento completo del vehículo. Revisión general de todos los sistemas.',
 type: 'PREVENTIVE',
 priority: 'HIGH',
 maintenanceTrigger: 'KILOMETERS',
 triggerValue: 50000,
 estimatedHours: 8,
 estimatedMinutes: 480,
 estimatedTimeType: 'MINUTES',
 maintenanceInterval: 50000,
 maintenanceIntervalType: 'KILOMETERS'
 }));
 }}
 className="justify-start text-left h-auto p-3"
 >
 <div>
 <div className="font-medium">Mantenimiento mayor</div>
 <div className="text-xs text-muted-foreground">cada 50,000 km</div>
 </div>
 </Button>
 </div>
 </div>

 {selectedUnidadData && (
 <Card>
 <CardHeader>
 <CardTitle className="text-sm">Unidad Seleccionada</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="flex items-center gap-3">
 <div className="bg-info-muted p-2 rounded-lg">
 <Truck className="h-4 w-4 text-info-muted-foreground" />
 </div>
 <div>
 <p className="font-medium">{selectedUnidadData.nombre}</p>
 <p className="text-sm text-muted-foreground">
 {selectedUnidadData.marca} {selectedUnidadData.modelo} • {selectedUnidadData.año} • {selectedUnidadData.patente}
 </p>
 </div>
 <Badge className={getPriorityColor(selectedUnidadData.estado)}>
 {selectedUnidadData.estado}
 </Badge>
 </div>
 </CardContent>
 </Card>
 )}
 </TabsContent>

 <TabsContent value="schedule" className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="scheduledDate">Fecha Programada</Label>
 <DatePicker
 value={formData.scheduledDate ? convertDateToISO(formData.scheduledDate).split('T')[0] : ''}
 onChange={(date) => {
 if (date) {
 const dateObj = new Date(date + 'T00:00:00');
 const formattedDate = formatDateToDDMMYYYY(dateObj);
 setFormData(prev => ({ ...prev, scheduledDate: formattedDate }));
 } else {
 setFormData(prev => ({ ...prev, scheduledDate: '' }));
 }
 }}
 placeholder="Seleccionar fecha..."
 clearable
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="frequencyType">Frecuencia de días, horas o kilómetros</Label>
 <Select value={formData.maintenanceIntervalType || 'DAYS'} onValueChange={(value) => setFormData(prev => ({ ...prev, maintenanceIntervalType: value }))}>
 <SelectTrigger>
 <SelectValue placeholder="Seleccionar tipo" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="DAYS">Días</SelectItem>
 <SelectItem value="HOURS">Horas</SelectItem>
 <SelectItem value="KILOMETERS">Kilómetros</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label htmlFor="maintenanceInterval">
 Cada cuántas {formData.maintenanceIntervalType === 'HOURS' ? 'horas' : 
 formData.maintenanceIntervalType === 'KILOMETERS' ? 'kilómetros' : 'días'}
 </Label>
 <Input
 id="maintenanceInterval"
 type="number"
 min="1"
 step="1"
 value={formData.maintenanceInterval === 0 ? '' : formData.maintenanceInterval}
 onChange={(e) => {
 const value = parseFloat(e.target.value) || 0;
 setFormData(prev => ({ 
 ...prev, 
 maintenanceInterval: value
 }));
 }}
 onFocus={(e) => {
 if (formData.maintenanceInterval === 0) {
 e.target.select();
 }
 }}
 onBlur={(e) => {
 // Conversión automática cuando sales del campo
 const value = parseFloat(e.target.value) || 0;
 if (formData.maintenanceIntervalType === 'HOURS' && value >= 24) {
 setFormData(prev => ({
 ...prev,
 maintenanceInterval: Math.round(value / 24),
 maintenanceIntervalType: 'DAYS'
 }));
 }
 }}
 placeholder={
 formData.maintenanceIntervalType === 'HOURS' ? "500" : 
 formData.maintenanceIntervalType === 'KILOMETERS' ? "10000" : "30"
 }
 />
 {formData.maintenanceIntervalType === 'HOURS' && formData.maintenanceInterval >= 24 && (
 <p className="text-sm text-info-muted-foreground">
 Se convertirá automáticamente a {Math.round(formData.maintenanceInterval / 24)} días
 </p>
 )}
 </div>

 <div className="space-y-2">
 <Label htmlFor="assignedToId">Asignar a</Label>
 <Select value={formData.assignedToId} onValueChange={(value) => setFormData(prev => ({ ...prev, assignedToId: value }))}>
 <SelectTrigger>
 <SelectValue placeholder="Seleccionar técnico" />
 </SelectTrigger>
 <SelectContent>
 {Array.isArray(users) && users.map((user) => (
 <SelectItem key={user.id} value={user.id.toString()}>
 {user.name} ({user.email})
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label htmlFor="estimatedTimeType">Tiempo estimado de realización</Label>
 <Select value={formData.estimatedTimeType || 'MINUTES'} onValueChange={(value) => setFormData(prev => ({ ...prev, estimatedTimeType: value }))}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="MINUTES">Minutos</SelectItem>
 <SelectItem value="HOURS">Horas</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label htmlFor="estimatedTimeValue">
 {formData.estimatedTimeType === 'HOURS' ? 'Cantidad de horas' : 'Cantidad de minutos'}
 </Label>
 <Input
 id="estimatedTimeValue"
 type="number"
 min="1"
 step={formData.estimatedTimeType === 'HOURS' ? "0.5" : "1"}
 value={formData.estimatedMinutes === 0 ? '' : (formData.estimatedTimeType === 'HOURS' ? (formData.estimatedMinutes / 60).toFixed(1) : formData.estimatedMinutes)}
 onChange={(e) => {
 const value = parseFloat(e.target.value) || 0;
 const minutes = formData.estimatedTimeType === 'HOURS' ? value * 60 : value;
 setFormData(prev => ({ 
 ...prev, 
 estimatedMinutes: Math.round(minutes)
 }));
 }}
 onFocus={(e) => {
 if (formData.estimatedMinutes === 0) {
 e.target.select();
 }
 }}
 placeholder={formData.estimatedTimeType === 'HOURS' ? "2.0" : "120"}
 />
 </div>

 {/* Información de la unidad seleccionada */}
 {selectedUnidadData && (
 <div className="bg-muted p-4 rounded-lg border">
 <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
 <Truck className="h-4 w-4" />
 Información de la Unidad
 </h4>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
 <div>
 <p className="text-foreground">Marca/Modelo</p>
 <p className="font-medium">{selectedUnidadData.marca} {selectedUnidadData.modelo}</p>
 </div>
 <div>
 <p className="text-foreground">Año</p>
 <p className="font-medium">{selectedUnidadData.año}</p>
 </div>
 <div>
 <p className="text-foreground">Patente</p>
 <p className="font-medium">{selectedUnidadData.patente}</p>
 </div>
 <div>
 <p className="text-foreground">Kilometraje</p>
 <p className="font-medium">{selectedUnidadData.kilometraje.toLocaleString()} km</p>
 </div>
 </div>
 </div>
 )}

 {/* Sección específica para programación de unidades móviles */}
 {formData.unidadMovilId && (
 <div className="bg-info-muted p-4 rounded-lg border">
 <h4 className="font-semibold text-info-muted-foreground mb-3 flex items-center gap-2">
 <Truck className="h-4 w-4" />
 ¿Cuándo se debe realizar este mantenimiento?
 </h4>
 
 <div className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="maintenanceTrigger">Tipo de Programación</Label>
 <Select value={formData.maintenanceTrigger} onValueChange={(value) => setFormData(prev => ({ ...prev, maintenanceTrigger: value }))}>
 <SelectTrigger>
 <SelectValue placeholder="Seleccionar tipo" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="KILOMETERS">Cada cierta cantidad de kilómetros</SelectItem>
 <SelectItem value="HOURS">Cada cierta cantidad de horas</SelectItem>
 <SelectItem value="DAYS">Cada cierta cantidad de días</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label htmlFor="triggerValue">
 {formData.maintenanceTrigger === 'KILOMETERS' ? 'Cada cuántos kilómetros' : 
 formData.maintenanceTrigger === 'HOURS' ? 'Cada cuántas horas' : 'Cada cuántos días'}
 </Label>
 <Input
 type="number"
 value={formData.triggerValue}
 onChange={(e) => handleTriggerValueChange(parseInt(e.target.value) || 0)}
 placeholder={formData.maintenanceTrigger === 'KILOMETERS' ? '10000' : 
 formData.maintenanceTrigger === 'HOURS' ? '500' : '30'}
 />
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="bg-background p-3 rounded border">
 <p className="text-sm text-foreground">Kilometraje Actual</p>
 <p className="font-semibold text-lg">{formData.currentKilometers.toLocaleString()} km</p>
 </div>
 <div className="bg-background p-3 rounded border">
 <p className="text-sm text-foreground">Próximo Mantenimiento</p>
 <p className="font-semibold text-lg text-info-muted-foreground">
 {formData.maintenanceTrigger === 'KILOMETERS' 
 ? `${formData.nextMaintenanceKilometers.toLocaleString()} km`
 : `En ${formData.triggerValue} días`
 }
 </p>
 </div>
 </div>
 </div>
 </div>
 )}

 <div className="space-y-2">
 <Label htmlFor="frequency">Frecuencia del mantenimiento</Label>
 <Select value={formData.frequency} onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value }))}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="DAILY">Diario</SelectItem>
 <SelectItem value="WEEKLY">Semanal</SelectItem>
 <SelectItem value="BIWEEKLY">Quincenal</SelectItem>
 <SelectItem value="MONTHLY">Mensual</SelectItem>
 <SelectItem value="QUARTERLY">Trimestral</SelectItem>
 <SelectItem value="YEARLY">Anual</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>

 {/* Información del próximo mantenimiento basado en frecuencia */}
 {formData.frequency && formData.scheduledDate && (
 <div className="bg-success-muted p-4 rounded-lg border">
 <h4 className="font-semibold text-success-muted-foreground mb-3 flex items-center gap-2">
 <Calendar className="h-4 w-4" />
 Próximo Mantenimiento
 </h4>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="bg-background p-3 rounded border">
 <p className="text-sm text-foreground">Frecuencia</p>
 <p className="font-semibold text-lg">{getFrequencyText(formData.frequency)}</p>
 </div>
 <div className="bg-background p-3 rounded border">
 <p className="text-sm text-foreground">Próximo Mantenimiento</p>
 <p className="font-semibold text-lg text-success">
 {getNextMaintenanceDate() ? formatDateToDDMMYYYY(getNextMaintenanceDate()!) : 'No calculado'}
 </p>
 </div>
 </div>
 </div>
 )}
 </TabsContent>

 <TabsContent value="resources" className="space-y-4">
 {/* Herramientas */}
 <Card>
 <CardHeader>
 <CardTitle className="text-sm flex items-center gap-2">
 <Wrench className="h-4 w-4" />
 Herramientas Requeridas
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="flex gap-2">
 <Input
 placeholder="Nombre de la herramienta"
 value={toolInput.name}
 onChange={(e) => setToolInput(prev => ({ ...prev, name: e.target.value }))}
 />
 <Input
 placeholder="Descripción"
 value={toolInput.description}
 onChange={(e) => setToolInput(prev => ({ ...prev, description: e.target.value }))}
 />
 <Button onClick={addTool} size="sm">
 <Plus className="h-4 w-4" />
 </Button>
 </div>
 <div className="space-y-2">
 {formData.tools.map((tool, index) => (
 <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
 <span className="flex-1 font-medium">{tool.name}</span>
 <span className="flex-1 text-sm text-muted-foreground">{tool.description}</span>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => removeTool(index)}
 className="text-destructive hover:text-destructive"
 >
 <X className="h-4 w-4" />
 </Button>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>

 {/* Repuestos */}
 <Card>
 <CardHeader>
 <CardTitle className="text-sm flex items-center gap-2">
 <AlertTriangle className="h-4 w-4" />
 Repuestos Necesarios
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="grid grid-cols-3 gap-2">
 <Input
 placeholder="Nombre del repuesto"
 value={sparePartInput.name}
 onChange={(e) => setSparePartInput(prev => ({ ...prev, name: e.target.value }))}
 />
 <Input
 type="number"
 placeholder="Cantidad"
 value={sparePartInput.quantity}
 onChange={(e) => setSparePartInput(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
 />
 <Input
 type="number"
 placeholder="Costo"
 value={sparePartInput.cost}
 onChange={(e) => setSparePartInput(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
 />
 </div>
 <Button onClick={addSparePart} size="sm">
 <Plus className="h-4 w-4 mr-1" />
 Agregar Repuesto
 </Button>
 <div className="space-y-2">
 {formData.spareParts.map((part, index) => (
 <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
 <span className="flex-1 font-medium">{part.name}</span>
 <span className="text-sm">Cantidad: {part.quantity}</span>
 <span className="text-sm">Costo: ${part.cost}</span>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => removeSparePart(index)}
 className="text-destructive hover:text-destructive"
 >
 <X className="h-4 w-4" />
 </Button>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="details" className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="notes">Notas Adicionales</Label>
 <Textarea
 id="notes"
 value={formData.notes}
 onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
 placeholder="Información adicional, observaciones, etc..."
 rows={4}
 />
 </div>

 {/* Sección de archivos adjuntos */}
 <Card>
 <CardHeader>
 <CardTitle className="text-sm flex items-center gap-2">
 <FileText className="h-4 w-4" />
 Archivos Adjuntos
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="fileUpload">Subir Archivos</Label>
 <div className="flex items-center gap-2">
 <Input
 id="fileUpload"
 type="file"
 multiple
 accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
 onChange={handleFileUpload}
 className="flex-1"
 />
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => document.getElementById('fileUpload')?.click()}
 >
 <Plus className="h-4 w-4 mr-2" />
 Seleccionar
 </Button>
 </div>
 <p className="text-xs text-muted-foreground">
 Formatos permitidos: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG, TXT
 </p>
 </div>

 {/* Lista de archivos subidos */}
 {uploadedFiles.length > 0 && (
 <div className="space-y-2">
 <Label>Archivos Seleccionados:</Label>
 <div className="space-y-2">
 {uploadedFiles.map((file, index) => (
 <div key={index} className="flex items-center justify-between p-2 bg-muted rounded border">
 <div className="flex items-center gap-2">
 <FileText className="h-4 w-4 text-muted-foreground" />
 <div>
 <p className="text-sm font-medium">{file.name}</p>
 <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
 </div>
 </div>
 <Button
 type="button"
 variant="ghost"
 size="sm"
 onClick={() => removeFile(index)}
 className="text-destructive hover:text-destructive"
 >
 <X className="h-4 w-4" />
 </Button>
 </div>
 ))}
 </div>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Instructivos */}
 <Card>
 <CardHeader>
 <CardTitle className="text-sm flex items-center gap-2">
 <FileText className="h-4 w-4" />
 Instructivos
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="space-y-2">
 <Input
 placeholder="Título del instructivo"
 value={instructiveInput.title}
 onChange={(e) => setInstructiveInput(prev => ({ ...prev, title: e.target.value }))}
 />
 <Textarea
 placeholder="Descripción del instructivo"
 value={instructiveInput.description}
 onChange={(e) => setInstructiveInput(prev => ({ ...prev, description: e.target.value }))}
 rows={2}
 />
 </div>
 <Button onClick={addInstructive} size="sm">
 <Plus className="h-4 w-4 mr-1" />
 Agregar Instructivo
 </Button>
 <div className="space-y-2">
 {formData.instructives.map((instructive, index) => (
 <div key={index} className="p-2 bg-muted rounded">
 <div className="flex items-center justify-between">
 <div>
 <p className="font-medium">{instructive.title}</p>
 <p className="text-sm text-muted-foreground">{instructive.description}</p>
 </div>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => removeInstructive(index)}
 className="text-destructive hover:text-destructive"
 >
 <X className="h-4 w-4" />
 </Button>
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </DialogBody>

 <DialogFooter>
 <div className="flex justify-between w-full">
 <Button 
 variant="outline" 
 onClick={() => {
 if (formData.unidadMovilId) {
 setShowHistoryModal(true);
 loadMaintenanceHistory(parseInt(formData.unidadMovilId));
 } else {
 toast({
 title: 'Selecciona una unidad móvil',
 description: 'Primero debes seleccionar una unidad móvil para ver su historial',
 variant: 'destructive'
 });
 }
 }}
 className="flex items-center gap-2"
 >
 <History className="h-4 w-4" />
 Ver historial de unidad móvil
 </Button>
 <div className="flex gap-2">
 <Button variant="outline" onClick={onClose}>
 Cancelar
 </Button>
 <Button onClick={handleSubmit} disabled={loading}>
 {loading ? (mode === 'edit' ? 'Actualizando...' : 'Creando...') : (mode === 'edit' ? 'Actualizar Mantenimiento' : 'Crear Mantenimiento')}
 </Button>
 </div>
 </div>
 </DialogFooter>
 </DialogContent>
 
 {/* Modal del Historial */}
 <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
 <DialogContent size="lg">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <History className="h-5 w-5" />
 Historial de Mantenimientos - Unidad Móvil
 </DialogTitle>
 <DialogDescription>
 Historial de mantenimientos realizados en esta unidad móvil
 </DialogDescription>
 </DialogHeader>

 <DialogBody>
 {loadingHistory ? (
 <div className="flex justify-center items-center py-8">
 <Loader2 className="h-8 w-8 animate-spin" />
 </div>
 ) : maintenanceHistory.length === 0 ? (
 <p className="text-muted-foreground text-center py-8">
 No hay historial de mantenimientos para esta unidad móvil
 </p>
 ) : (
 <div className="space-y-4">
 {maintenanceHistory.map((maintenance: any) => (
 <Card key={maintenance.id} className="border-l-4 border-l-blue-500">
 <CardContent className="pt-6">
 <div>
 <h4 className="font-semibold text-lg mb-2">{maintenance.title}</h4>
 <p className="text-sm text-muted-foreground mb-2">{maintenance.description}</p>
 <div className="flex flex-wrap gap-2">
 <Badge variant="outline">
 {getTypeText(maintenance.type)}
 </Badge>
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}
 </DialogBody>
 </DialogContent>
 </Dialog>
 </Dialog>
 );
}
