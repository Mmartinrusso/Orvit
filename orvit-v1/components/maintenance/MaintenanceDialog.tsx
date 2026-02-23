'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { 
 CalendarIcon,
 Plus,
 Trash2,
 Settings,
 Wrench,
 Clock,
 AlertTriangle,
 User,
 MapPin,
 FileText,
 Save,
 X,
 Info,
 CheckCircle2,
 Package,
 BookOpen,
 History,
 Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDate } from '@/lib/date-utils';
import { toast } from '@/hooks/use-toast';
import { useGlobalCache, createCacheKey } from '@/hooks/use-global-cache';
import { useMachinesInitial } from '@/hooks/use-machines-initial';

interface MaintenanceDialogProps {
 isOpen: boolean;
 onClose: () => void;
 onSave: (data: any) => void;
 editingMaintenance?: any;
 mode?: 'create' | 'edit';
 companyId: number;
 machineId?: number;
 sectorId?: number;
}

export default function MaintenanceDialog({
 isOpen,
 onClose,
 onSave,
 editingMaintenance,
 mode = 'create',
 companyId,
 machineId,
 sectorId
}: MaintenanceDialogProps) {
 // ✨ OPTIMIZADO: Usar hook con React Query para máquinas
 const { data: machinesData } = useMachinesInitial(
 companyId,
 sectorId || null,
 { enabled: isOpen && !!companyId }
 );
 const machines = machinesData?.machines || [];

 const [loading, setLoading] = useState(false);
 const [users, setUsers] = useState<any[]>([]);
 const [components, setComponents] = useState<any[]>([]);
 const [subcomponents, setSubcomponents] = useState<any[]>([]);
 const [activeTab, setActiveTab] = useState('general');
 const [maintenanceHistory, setMaintenanceHistory] = useState<any[]>([]);
 const [loadingHistory, setLoadingHistory] = useState(false);

 // Estados del formulario
 const [formData, setFormData] = useState({
 title: '',
 description: '',
 type: 'PREVENTIVE',
 priority: 'MEDIUM',
 status: 'PENDING',
 machineId: machineId?.toString() || '',
 componentId: '',
 subcomponentId: '',
 assignedWorkerId: '',
 scheduledDate: new Date(),
 estimatedDuration: 2,
 executionWindow: 'ANY_TIME',
 timeUnit: 'HOURS',
 timeValue: 1,
 frequency: 'MONTHLY',
 isRecurring: false,
 isActive: true,
 tags: [] as string[],
 rootCause: '',
 correctiveActions: '',
 preventiveActions: '',
 spareParts: [] as Array<{name: string, quantity: number, cost: number}>,
 failureDescription: '',
 solution: '',
 notes: '',
 tools: [] as Array<{name: string, description: string}>,
 instructives: [] as Array<{title: string, description: string, file: any}>,
 selectedComponents: [] as string[],
 selectedSubcomponents: [] as string[]
 });

 const [tagInput, setTagInput] = useState('');
 const [sparePartInput, setSparePartInput] = useState({ name: '', quantity: 1, cost: 0 });
 const [toolInput, setToolInput] = useState({ name: '', description: '' });
 const [instructiveInput, setInstructiveInput] = useState({ title: '', description: '', file: null });

 const cache = useGlobalCache();
 const loadingRef = useRef({ machines: false, users: false, components: false, subcomponents: false });

 // Cargar datos en paralelo cuando se abre el modal
 useEffect(() => {
 if (isOpen) {
 // Cargar máquinas y usuarios en paralelo
 Promise.all([
 loadMachines(),
 loadUsers()
 ]);
 
 if (editingMaintenance) {
 loadMaintenanceData();
 }
 }
 }, [isOpen, editingMaintenance, companyId, sectorId]);

 // Cargar componentes cuando se selecciona una máquina
 useEffect(() => {
 if (formData.machineId) {
 Promise.all([
 loadComponents(formData.machineId),
 loadMaintenanceHistory(formData.machineId)
 ]);
 } else {
 setComponents([]);
 setSubcomponents([]);
 setMaintenanceHistory([]);
 }
 }, [formData.machineId]);

 // Cargar subcomponentes cuando se selecciona un componente
 useEffect(() => {
 if (formData.componentId) {
 loadSubcomponents(formData.machineId, formData.componentId);
 } else {
 setSubcomponents([]);
 }
 }, [formData.componentId, formData.machineId]);

 // ✨ OPTIMIZADO: loadMachines ya no es necesario, las máquinas vienen del hook useMachinesInitial
 const loadMachines = useCallback(async () => {
 // Las máquinas ahora vienen del hook useMachinesInitial
 }, []);

 const loadUsers = useCallback(async () => {
 if (loadingRef.current.users) return;
 
 const cacheKey = createCacheKey('users', companyId.toString());
 const cached = cache.get<any[]>(cacheKey);
 if (cached) {
 setUsers(cached);
 return;
 }

 loadingRef.current.users = true;
 try {
 const response = await fetch(`/api/users?companyId=${companyId}`);
 if (response.ok) {
 const data = await response.json();
 setUsers(data);
 cache.set(cacheKey, data);
 }
 } catch (error) {
 console.error('Error loading users:', error);
 } finally {
 loadingRef.current.users = false;
 }
 }, [companyId, cache]);

 const loadComponents = useCallback(async (machineId: string) => {
 if (loadingRef.current.components) return;
 
 const cacheKey = createCacheKey('components', machineId);
 const cached = cache.get<any[]>(cacheKey);
 if (cached) {
 setComponents(cached);
 return;
 }

 loadingRef.current.components = true;
 try {
 const response = await fetch(`/api/maquinas/${machineId}/components`);
 if (response.ok) {
 const data = await response.json();
 setComponents(data);
 cache.set(cacheKey, data);
 }
 } catch (error) {
 console.error('Error loading components:', error);
 setComponents([]);
 } finally {
 loadingRef.current.components = false;
 }
 }, [cache]);

 const loadSubcomponents = useCallback(async (machineId: string, componentId: string) => {
 if (loadingRef.current.subcomponents) return;
 
 const cacheKey = createCacheKey('subcomponents', componentId);
 const cached = cache.get<any[]>(cacheKey);
 if (cached) {
 setSubcomponents(cached);
 return;
 }

 loadingRef.current.subcomponents = true;
 try {
 const response = await fetch(`/api/components/${componentId}/subcomponents`);
 if (response.ok) {
 const data = await response.json();
 setSubcomponents(data);
 cache.set(cacheKey, data);
 }
 } catch (error) {
 console.error('Error loading subcomponents:', error);
 setSubcomponents([]);
 } finally {
 loadingRef.current.subcomponents = false;
 }
 }, [cache]);

 const loadMaintenanceData = () => {
 if (editingMaintenance) {
 setFormData({
 title: editingMaintenance.title || '',
 description: editingMaintenance.description || '',
 type: editingMaintenance.type || 'PREVENTIVE',
 priority: editingMaintenance.priority || 'MEDIUM',
 status: editingMaintenance.status || 'PENDING',
 machineId: editingMaintenance.machineId?.toString() || '',
 componentId: editingMaintenance.componentId?.toString() || '',
 subcomponentId: editingMaintenance.subcomponentId?.toString() || '',
 assignedWorkerId: editingMaintenance.assignedWorkerId?.toString() || '',
 scheduledDate: editingMaintenance.scheduledDate ? new Date(editingMaintenance.scheduledDate) : new Date(),
 estimatedDuration: editingMaintenance.estimatedDuration || 2,
 executionWindow: editingMaintenance.executionWindow || 'ANY_TIME',
 timeUnit: editingMaintenance.timeUnit || 'HOURS',
 timeValue: editingMaintenance.timeValue || 1,
 frequency: editingMaintenance.frequency || 'MONTHLY',
 isRecurring: editingMaintenance.isRecurring || false,
 isActive: editingMaintenance.isActive !== false,
 tags: editingMaintenance.tags || [],
 rootCause: editingMaintenance.rootCause || '',
 correctiveActions: editingMaintenance.correctiveActions || '',
 preventiveActions: editingMaintenance.preventiveActions || '',
 spareParts: editingMaintenance.spareParts || [],
 failureDescription: editingMaintenance.failureDescription || '',
 solution: editingMaintenance.solution || '',
 notes: editingMaintenance.notes || '',
 tools: editingMaintenance.tools || [],
 instructives: editingMaintenance.instructives || [],
 selectedComponents: editingMaintenance.selectedComponents || [],
 selectedSubcomponents: editingMaintenance.selectedSubcomponents || []
 });
 }
 };

 const loadMaintenanceHistory = async (machineIdToLoad: string) => {
 if (!machineIdToLoad) return;
 
 setLoadingHistory(true);
 try {
 const response = await fetch(`/api/maintenance/history?machineId=${machineIdToLoad}&companyId=${companyId}`);
 if (!response.ok) throw new Error('Error al cargar historial');
 
 const data = await response.json();
 setMaintenanceHistory(data.maintenances || []);
 } catch (error) {
 console.error('Error loading maintenance history:', error);
 toast({
 title: 'Error',
 description: 'No se pudo cargar el historial de mantenimientos',
 variant: 'destructive'
 });
 } finally {
 setLoadingHistory(false);
 }
 };

 const handleSubmit = async () => {
 if (!formData.title || !formData.machineId) {
 toast({
 title: 'Error',
 description: 'Por favor completa los campos obligatorios',
 variant: 'destructive'
 });
 return;
 }

 setLoading(true);
 try {
 const payload = {
 ...formData,
 companyId,
 sectorId,
 machineId: parseInt(formData.machineId),
 assignedWorkerId: formData.assignedWorkerId ? parseInt(formData.assignedWorkerId) : null,
 scheduledDate: formData.scheduledDate.toISOString(),
 spareParts: JSON.stringify(formData.spareParts),
 tools: JSON.stringify(formData.tools),
 instructives: JSON.stringify(formData.instructives)
 };

 const url = mode === 'edit' ? `/api/maintenance/${editingMaintenance.id}` : '/api/maintenance';
 const method = mode === 'edit' ? 'PUT' : 'POST';

 const response = await fetch(url, {
 method,
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload)
 });

 if (response.ok) {
 const result = await response.json();
 toast({
 title: mode === 'edit' ? 'Mantenimiento actualizado' : 'Mantenimiento creado',
 description: mode === 'edit' ? 'El mantenimiento ha sido actualizado exitosamente' : 'El mantenimiento ha sido creado exitosamente'
 });
 onSave(result);
 onClose();
 resetForm();
 } else {
 throw new Error('Error al guardar el mantenimiento');
 }
 } catch (error) {
 toast({
 title: 'Error',
 description: 'No se pudo guardar el mantenimiento',
 variant: 'destructive'
 });
 } finally {
 setLoading(false);
 }
 };

 const resetForm = () => {
 setFormData({
 title: '',
 description: '',
 type: 'PREVENTIVE',
 priority: 'MEDIUM',
 status: 'PENDING',
 machineId: machineId?.toString() || '',
 componentId: '',
 subcomponentId: '',
 assignedWorkerId: '',
 scheduledDate: new Date(),
 estimatedDuration: 2,
 executionWindow: 'ANY_TIME',
 timeUnit: 'HOURS',
 timeValue: 1,
 frequency: 'MONTHLY',
 isRecurring: false,
 isActive: true,
 tags: [],
 rootCause: '',
 correctiveActions: '',
 preventiveActions: '',
 spareParts: [],
 failureDescription: '',
 solution: '',
 notes: '',
 tools: [],
 instructives: [],
 selectedComponents: [],
 selectedSubcomponents: []
 });
 setActiveTab('general');
 setTagInput('');
 setSparePartInput({ name: '', quantity: 1, cost: 0 });
 setToolInput({ name: '', description: '' });
 setInstructiveInput({ title: '', description: '', file: null });
 };

 const addTag = () => {
 if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
 setFormData(prev => ({
 ...prev,
 tags: [...prev.tags, tagInput.trim()]
 }));
 setTagInput('');
 }
 };

 const removeTag = (tag: string) => {
 setFormData(prev => ({
 ...prev,
 tags: prev.tags.filter(t => t !== tag)
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
 default: return 'bg-warning-muted text-warning-muted-foreground';
 }
 };

 const getPriorityDot = (priority: string) => {
 switch (priority) {
 case 'LOW': return 'bg-muted-foreground';
 case 'MEDIUM': return 'bg-warning';
 case 'HIGH': return 'bg-warning';
 case 'URGENT': return 'bg-destructive';
 default: return 'bg-warning';
 }
 };

 const getTypeIcon = (type: string) => {
 switch (type) {
 case 'PREVENTIVE': return <Settings className="h-6 w-6 text-success" />;
 case 'CORRECTIVE': return <Wrench className="h-6 w-6 text-destructive" />;
 case 'PREDICTIVE': return <AlertTriangle className="h-6 w-6 text-warning-muted-foreground" />;
 default: return <Settings className="h-6 w-6 text-success" />;
 }
 };

 const getTypeLabel = (type: string) => {
 switch (type) {
 case 'PREVENTIVE': return 'Preventivo';
 case 'CORRECTIVE': return 'Correctivo';
 case 'PREDICTIVE': return 'Predictivo';
 default: return type;
 }
 };

 const getPriorityLabel = (priority: string) => {
 switch (priority) {
 case 'LOW': return 'Baja';
 case 'MEDIUM': return 'Media';
 case 'HIGH': return 'Alta';
 case 'URGENT': return 'Urgente';
 default: return priority;
 }
 };

 const isFormValid = () => {
 return formData.title.trim() !== '' && formData.machineId !== '';
 };

 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent size="xl">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <div className="bg-success-muted p-2 rounded-lg">
 {getTypeIcon(formData.type)}
 </div>
 {mode === 'edit' ? 'Editar Mantenimiento' : `Nuevo Mantenimiento ${getTypeLabel(formData.type)}`}
 </DialogTitle>
 <DialogDescription>
 {mode === 'edit' ? 'Modifica los datos del mantenimiento' : `Programa un mantenimiento ${getTypeLabel(formData.type).toLowerCase()} recurrente con herramientas especificas`}
 </DialogDescription>
 </DialogHeader>

 <DialogBody>
 <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
 <TabsList className="w-full justify-start overflow-x-auto h-9">
 <TabsTrigger value="general">General</TabsTrigger>
 <TabsTrigger value="equipment">Equipamiento</TabsTrigger>
 <TabsTrigger value="tools">Herramientas</TabsTrigger>
 <TabsTrigger value="instructives">Instructivos</TabsTrigger>
 <TabsTrigger value="schedule">Programación</TabsTrigger>
 <TabsTrigger value="history" disabled={!formData.machineId}>
 <History className="h-4 w-4 mr-2" />
 Historial
 </TabsTrigger>
 </TabsList>

 <TabsContent value="general" className="space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Info className="h-5 w-5" />
 Información General
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div>
 <Label htmlFor="title">Título del Mantenimiento *</Label>
 <Input
 id="title"
 value={formData.title}
 onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
 placeholder="Ej: Lubricación de rodamientos"
 />
 </div>
 <div>
 <Label htmlFor="description">Descripción Detallada</Label>
 <Textarea
 id="description"
 value={formData.description}
 onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
 placeholder="Describa el procedimiento de mantenimiento..."
 rows={4}
 />
 </div>
 <div>
 <Label htmlFor="priority">Prioridad *</Label>
 <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
 <SelectTrigger>
 <SelectValue>
 <div className="flex items-center gap-2">
 <div className={cn('w-3 h-3 rounded-full', getPriorityDot(formData.priority))}></div>
 {getPriorityLabel(formData.priority)}
 </div>
 </SelectValue>
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="LOW">
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 bg-muted-foreground rounded-full"></div>
 Baja
 </div>
 </SelectItem>
 <SelectItem value="MEDIUM">
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 bg-warning rounded-full"></div>
 Media
 </div>
 </SelectItem>
 <SelectItem value="HIGH">
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 bg-warning rounded-full"></div>
 Alta
 </div>
 </SelectItem>
 <SelectItem value="URGENT">
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 bg-destructive rounded-full"></div>
 Urgente
 </div>
 </SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label htmlFor="estimatedHours">Duración Estimada (horas) *</Label>
 <Input
 id="estimatedHours"
 type="number"
 min="0.5"
 step="0.5"
 value={formData.estimatedDuration}
 onChange={(e) => setFormData(prev => ({ ...prev, estimatedDuration: parseFloat(e.target.value) || 2 }))}
 />
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <User className="h-5 w-5" />
 Asignación
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div>
 <Label htmlFor="assignedTo">Técnico Asignado</Label>
 <Select value={formData.assignedWorkerId} onValueChange={(value) => setFormData(prev => ({ ...prev, assignedWorkerId: value }))}>
 <SelectTrigger>
 <SelectValue placeholder="Sin asignar" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="none">Sin asignar</SelectItem>
 {Array.isArray(users) && users.map((user: any) => (
 <SelectItem key={user.id} value={user.id.toString()}>
 {user.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label htmlFor="notes">Notas Adicionales</Label>
 <Textarea
 id="notes"
 value={formData.notes}
 onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
 placeholder="Instrucciones especiales, precauciones..."
 rows={3}
 />
 </div>
 <div className="flex items-center space-x-2">
 <Checkbox
 id="isActive"
 checked={formData.isActive}
 onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked as boolean }))}
 />
 <Label htmlFor="isActive">Mantenimiento activo</Label>
 </div>
 </CardContent>
 </Card>
 </div>
 </TabsContent>

 <TabsContent value="equipment" className="space-y-6">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Wrench className="h-5 w-5" />
 Selección de Equipamiento
 </CardTitle>
 <p className="text-sm text-muted-foreground">
 Seleccione la máquina, componente y subcomponente específico
 </p>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div>
 <Label htmlFor="machine">Máquina *</Label>
 <Select value={formData.machineId} onValueChange={(value) => setFormData(prev => ({ ...prev, machineId: value, componentId: '', subcomponentId: '' }))}>
 <SelectTrigger>
 <SelectValue placeholder="Seleccionar máquina" />
 </SelectTrigger>
 <SelectContent>
 {Array.isArray(machines) && machines.map((machine: any) => (
 <SelectItem key={machine.id} value={machine.id.toString()}>
 {machine.name} ({machine.nickname})
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div>
 <Label htmlFor="components">Componentes (selección múltiple)</Label>
 <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
 <div className="space-y-2">
 <div className="flex items-center space-x-2">
 <Checkbox
 id="all-components"
 checked={formData.selectedComponents?.length === components.length && components.length > 0}
 onCheckedChange={(checked) => {
 if (checked) {
 setFormData(prev => ({
 ...prev,
 selectedComponents: components.map((c: any) => c.id.toString())
 }));
 } else {
 setFormData(prev => ({ ...prev, selectedComponents: [] }));
 }
 }}
 />
 <Label htmlFor="all-components" className="text-sm font-medium">
 Seleccionar todos
 </Label>
 </div>
 {Array.isArray(components) && components.map((component: any) => (
 <div key={component.id} className="flex items-center space-x-2">
 <Checkbox
 id={`component-${component.id}`}
 checked={formData.selectedComponents?.includes(component.id.toString())}
 onCheckedChange={(checked) => {
 const currentSelected = formData.selectedComponents || [];
 if (checked) {
 setFormData(prev => ({
 ...prev,
 selectedComponents: [...currentSelected, component.id.toString()]
 }));
 } else {
 setFormData(prev => ({
 ...prev,
 selectedComponents: currentSelected.filter(id => id !== component.id.toString())
 }));
 }
 }}
 />
 <Label htmlFor={`component-${component.id}`} className="font-medium text-sm">
 {component.name}
 </Label>
 </div>
 ))}
 </div>
 </div>
 </div>

 <div>
 <Label htmlFor="subcomponents">Subcomponentes (selección múltiple)</Label>
 <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
 {formData.selectedComponents?.length > 0 ? (
 <div className="space-y-2">
 <div className="flex items-center space-x-2">
 <Checkbox
 id="all-subcomponents"
 checked={formData.selectedSubcomponents?.length === subcomponents.length && subcomponents.length > 0}
 onCheckedChange={(checked) => {
 if (checked) {
 setFormData(prev => ({
 ...prev,
 selectedSubcomponents: subcomponents.map((s: any) => s.id.toString())
 }));
 } else {
 setFormData(prev => ({ ...prev, selectedSubcomponents: [] }));
 }
 }}
 />
 <Label htmlFor="all-subcomponents" className="text-sm font-medium">
 Seleccionar todos
 </Label>
 </div>
 {Array.isArray(subcomponents) && subcomponents.map((subcomponent: any) => (
 <div key={subcomponent.id} className="flex items-center space-x-2">
 <Checkbox
 id={`subcomponent-${subcomponent.id}`}
 checked={formData.selectedSubcomponents?.includes(subcomponent.id.toString())}
 onCheckedChange={(checked) => {
 const currentSelected = formData.selectedSubcomponents || [];
 if (checked) {
 setFormData(prev => ({
 ...prev,
 selectedSubcomponents: [...currentSelected, subcomponent.id.toString()]
 }));
 } else {
 setFormData(prev => ({
 ...prev,
 selectedSubcomponents: currentSelected.filter(id => id !== subcomponent.id.toString())
 }));
 }
 }}
 />
 <Label htmlFor={`subcomponent-${subcomponent.id}`} className="font-medium text-sm">
 {subcomponent.name}
 </Label>
 </div>
 ))}
 </div>
 ) : (
 <p className="text-sm text-muted-foreground">Selecciona componentes primero</p>
 )}
 </div>
 </div>
 </div>

 <div className="mt-6 p-4 bg-muted rounded-lg">
 <h4 className="font-semibold mb-2">Resumen de Equipamiento Seleccionado:</h4>
 <div className="flex flex-wrap gap-2">
 {formData.machineId && (
 <Badge variant="secondary" className="bg-info-muted text-info-muted-foreground">
 Máquina: {machines.find((m: any) => m.id.toString() === formData.machineId)?.name || 'N/A'}
 </Badge>
 )}
 {formData.selectedComponents?.map((componentId: string) => {
 const component = components.find((c: any) => c.id.toString() === componentId);
 return component ? (
 <Badge key={componentId} variant="outline">
 {component.name}
 </Badge>
 ) : null;
 })}
 {formData.selectedSubcomponents?.map((subcomponentId: string) => {
 const subcomponent = subcomponents.find((s: any) => s.id.toString() === subcomponentId);
 return subcomponent ? (
 <Badge key={subcomponentId} variant="outline" className="bg-success-muted text-success">
 {subcomponent.name}
 </Badge>
 ) : null;
 })}
 </div>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="tools" className="space-y-6">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Wrench className="h-5 w-5" />
 Herramientas Requeridas
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label>Nombre de la Herramienta</Label>
 <Input
 value={toolInput.name}
 onChange={(e) => setToolInput(prev => ({ ...prev, name: e.target.value }))}
 placeholder="Ej: Llave ajustable"
 />
 </div>
 <div>
 <Label>Descripción</Label>
 <Input
 value={toolInput.description}
 onChange={(e) => setToolInput(prev => ({ ...prev, description: e.target.value }))}
 placeholder="Especificaciones o notas"
 />
 </div>
 </div>
 <Button onClick={addTool} className="w-full">
 <Plus className="h-4 w-4 mr-2" />
 Agregar Herramienta
 </Button>

 <div className="space-y-2">
 {formData.tools.map((tool, index) => (
 <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
 <div>
 <h4 className="font-medium">{tool.name}</h4>
 {tool.description && (
 <p className="text-sm text-muted-foreground">{tool.description}</p>
 )}
 </div>
 <Button
 variant="outline"
 size="sm"
 onClick={() => removeTool(index)}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="instructives" className="space-y-6">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <BookOpen className="h-5 w-5" />
 Instructivos y Documentación
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label>Título del Instructivo</Label>
 <Input
 value={instructiveInput.title}
 onChange={(e) => setInstructiveInput(prev => ({ ...prev, title: e.target.value }))}
 placeholder="Ej: Procedimiento de lubricación"
 />
 </div>
 <div>
 <Label>Descripción</Label>
 <Input
 value={instructiveInput.description}
 onChange={(e) => setInstructiveInput(prev => ({ ...prev, description: e.target.value }))}
 placeholder="Breve descripción"
 />
 </div>
 </div>
 <Button onClick={addInstructive} className="w-full">
 <Plus className="h-4 w-4 mr-2" />
 Agregar Instructivo
 </Button>

 <div className="space-y-2">
 {formData.instructives.map((instructive, index) => (
 <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
 <div>
 <h4 className="font-medium">{instructive.title}</h4>
 {instructive.description && (
 <p className="text-sm text-muted-foreground">{instructive.description}</p>
 )}
 </div>
 <Button
 variant="outline"
 size="sm"
 onClick={() => removeInstructive(index)}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="schedule" className="space-y-6">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Calendar className="h-5 w-5" />
 Programación y Frecuencia
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <Label>Fecha Programada</Label>
 <Popover>
 <PopoverTrigger asChild>
 <Button variant="outline" className="w-full justify-start text-left font-normal">
 <CalendarIcon className="mr-2 h-4 w-4" />
 {formData.scheduledDate ? format(formData.scheduledDate, 'PPP', { locale: es }) : 'Seleccionar fecha'}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-0">
 <Calendar
 mode="single"
 selected={formData.scheduledDate}
 onSelect={(date) => date && setFormData(prev => ({ ...prev, scheduledDate: date }))}
 initialFocus
 />
 </PopoverContent>
 </Popover>
 </div>

 <div>
 <Label htmlFor="executionWindow">Ventana de Ejecución</Label>
 <Select value={formData.executionWindow} onValueChange={(value) => setFormData(prev => ({ ...prev, executionWindow: value }))}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="ANY_TIME">Cualquier momento</SelectItem>
 <SelectItem value="BEFORE_START">Antes del inicio</SelectItem>
 <SelectItem value="MID_SHIFT">Mitad de turno</SelectItem>
 <SelectItem value="END_SHIFT">Fin de turno</SelectItem>
 <SelectItem value="WEEKEND">Fin de semana</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>

 <div className="flex items-center space-x-2">
 <Switch
 id="isRecurring"
 checked={formData.isRecurring}
 onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isRecurring: checked }))}
 />
 <Label htmlFor="isRecurring">Mantenimiento recurrente</Label>
 </div>

 {formData.isRecurring && (
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="frequency">Frecuencia</Label>
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

 <div>
 <Label htmlFor="timeValue">Valor de Tiempo</Label>
 <Input
 id="timeValue"
 type="number"
 value={formData.timeValue}
 onChange={(e) => setFormData(prev => ({ ...prev, timeValue: parseInt(e.target.value) || 1 }))}
 />
 </div>
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="history" className="space-y-6">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <History className="h-5 w-5" />
 Historial de Mantenimientos
 </CardTitle>
 </CardHeader>
 <CardContent>
 {loadingHistory ? (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="h-8 w-8 animate-spin" />
 <span className="ml-3">Cargando historial...</span>
 </div>
 ) : maintenanceHistory.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
 <p>No hay mantenimientos registrados para esta {formData.machineId ? 'máquina/unidad móvil' : 'selección'}</p>
 {!formData.machineId && (
 <p className="text-sm mt-2">Selecciona una máquina o unidad móvil para ver su historial</p>
 )}
 </div>
 ) : (
 <div className="space-y-3 max-h-[400px] overflow-y-auto">
 {maintenanceHistory.map((maintenance: any) => (
 <div key={maintenance.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <h4 className="font-semibold">{maintenance.title}</h4>
 <Badge variant={maintenance.type === 'PREVENTIVE' ? 'default' : 'destructive'}>
 {maintenance.type === 'PREVENTIVE' ? 'Preventivo' : 'Correctivo'}
 </Badge>
 <Badge variant={
 maintenance.status === 'COMPLETED' ? 'default' :
 maintenance.status === 'IN_PROGRESS' ? 'secondary' :
 'outline'
 }>
 {maintenance.status === 'COMPLETED' ? 'Completado' :
 maintenance.status === 'IN_PROGRESS' ? 'En Progreso' :
 'Pendiente'}
 </Badge>
 </div>
 {maintenance.description && (
 <p className="text-sm text-muted-foreground mb-2">{maintenance.description}</p>
 )}
 <div className="flex items-center gap-4 text-xs text-muted-foreground">
 {maintenance.scheduledDate && (
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 <span>Programado: {formatDate(maintenance.scheduledDate)}</span>
 </div>
 )}
 {maintenance.completedDate && (
 <div className="flex items-center gap-1">
 <CheckCircle2 className="h-3 w-3" />
 <span>Completado: {formatDate(maintenance.completedDate)}</span>
 </div>
 )}
 {maintenance.assignedWorker && (
 <div className="flex items-center gap-1">
 <User className="h-3 w-3" />
 <span>{maintenance.assignedWorker.name}</span>
 </div>
 )}
 </div>
 </div>
 <div className="flex items-center gap-2">
 {maintenance.priority && (
 <Badge variant={
 maintenance.priority === 'URGENT' ? 'destructive' :
 maintenance.priority === 'HIGH' ? 'secondary' :
 'outline'
 }>
 {maintenance.priority === 'URGENT' ? 'Urgente' :
 maintenance.priority === 'HIGH' ? 'Alta' :
 maintenance.priority === 'MEDIUM' ? 'Media' :
 'Baja'}
 </Badge>
 )}
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </DialogBody>

 <DialogFooter className="justify-between">
 <div className="flex items-center gap-4">
 <div className="text-sm text-muted-foreground">
 <span>Complete los campos obligatorios (*)</span>
 </div>
 </div>
 <div className="flex gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={() => {
 if (formData.machineId) {
 setActiveTab('history');
 } else {
 toast({
 title: 'Selecciona una maquina',
 description: 'Primero debes seleccionar una maquina para ver su historial',
 variant: 'destructive'
 });
 }
 }}
 className="flex items-center gap-2"
 >
 <History className="h-4 w-4" />
 Ver historial
 </Button>
 <Button variant="outline" size="sm" onClick={onClose}>
 Cancelar
 </Button>
 <Button size="sm" onClick={handleSubmit} disabled={loading || !isFormValid()}>
 {loading ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Guardando...
 </>
 ) : (
 <>
 <Save className="h-4 w-4 mr-2" />
 {mode === 'edit' ? 'Actualizar' : 'Crear'} Mantenimiento
 </>
 )}
 </Button>
 </div>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
