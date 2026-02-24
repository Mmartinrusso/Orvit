

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/sanitize';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { 
 Plus,
 Trash2,
 Edit,
 Save,
 CheckSquare,
 Square,
 FileText,
 Clock,
 AlertTriangle,
 CheckCircle2,
 X,
 GripVertical,
 Search,
 ChevronDown,
 ChevronUp,
 RefreshCw,
 ChevronLeft,
 ChevronRight,
 Info,
 Loader2
} from 'lucide-react';
import { ChecklistPhaseDialog } from './ChecklistPhaseDialog';
import { toast } from '@/hooks/use-toast';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { BookOpen } from 'lucide-react';
import { useMachinesInitial } from '@/hooks/use-machines-initial';
import { fetchAllMaintenancesCached } from '@/hooks/use-all-maintenances';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Stepper, Step } from '@/components/ui/stepper';

interface ChecklistItem {
 id?: number | string;
 title: string;
 description: string;
 isRequired: boolean;
 order: number;
 category: string;
 estimatedTime: number;
 maintenanceId?: number;
 maintenanceType?: string;
 isMaintenanceItem?: boolean;
}

interface ChecklistPhase {
 id: string;
 name: string;
 description: string;
 order: number;
 estimatedTime: number;
 items: ChecklistItem[];
}

interface ChecklistFormData {
 title: string;
 description: string;
 machineId?: string;
 unidadMovilId?: string;
 sectorId?: string;
 frequency?: string;
 isActive?: boolean;
 category?: string;
 estimatedTotalTime?: number;
 items?: ChecklistItem[];
 phases?: ChecklistPhase[];
}

interface ChecklistManagementDialogProps {
 isOpen: boolean;
 onClose: () => void;
 onSave: (data: any) => void;
 editingChecklist?: any;
 mode?: 'create' | 'edit';
 companyId: number;
 machineId?: number;
 sectorId?: number;
 selectedAsset?: {
 type: 'unidad-movil' | 'maquina';
 id: number;
 name: string;
 } | null;
}

export default function ChecklistManagementDialog({
 isOpen,
 onClose,
 onSave,
 editingChecklist,
 mode = 'create',
 companyId,
 machineId,
 sectorId,
 selectedAsset
}: ChecklistManagementDialogProps) {
 // ✨ OPTIMIZADO: Usar hook con React Query para máquinas
 const { data: machinesData } = useMachinesInitial(
 companyId,
 sectorId || null,
 { enabled: isOpen && !!companyId }
 );
 
 const [loading, setLoading] = useState(false);
 const [machines, setMachines] = useState<any[]>([]);
 const [availableMaintenances, setAvailableMaintenances] = useState<any[]>([]);
 const [selectedMaintenances, setSelectedMaintenances] = useState<number[]>([]);
 const [activeTab, setActiveTab] = useState('basic');
 const [availableSectors, setAvailableSectors] = useState<Array<{ id: number; name: string }>>([]);
 const [showPhaseDialog, setShowPhaseDialog] = useState(false);
 const [viewMode, setViewMode] = useState<'list' | 'cards'>('list'); // Vista por defecto: lista
 const [searchTerm, setSearchTerm] = useState('');
 const [isExpanded, setIsExpanded] = useState(false);
 const [assetTypeFilter, setAssetTypeFilter] = useState<'all' | 'maquina' | 'unidad-movil'>('all');
 const [usePhases, setUsePhases] = useState(false); // Por defecto sin fases
 
 // ✨ Sincronizar máquinas del hook con estado local
 useEffect(() => {
 if (machinesData?.machines) {
 // Agregar tipo 'machine' a cada máquina
 const machinesWithType = (machinesData.machines as any[]).map((machine: any) => ({
 ...machine,
 assetType: 'machine'
 }));
 setMachines(machinesWithType);
 }
 }, [machinesData]);
 
 // Estado para instructivos
 const [instructives, setInstructives] = useState<Array<{ id: string; title: string; content: string }>>([]);
 const [currentInstructive, setCurrentInstructive] = useState({ title: '', content: '' });

 // Estados del formulario
 const [formData, setFormData] = useState<ChecklistFormData>({
 title: '',
 description: '',
 machineId: 'all',
 unidadMovilId: 'all',
 frequency: 'MONTHLY',
 category: 'MAINTENANCE',
 isActive: true, // ✅ Asegurar que siempre tenga un valor booleano para evitar warning de Switch
 estimatedTotalTime: 0,
 items: [],
 phases: [] // Sin fases por defecto
 });

 // Asegurar que phases siempre esté definido
 const phases = formData.phases || [];



 useEffect(() => {
 if (isOpen) {
 loadMachines();
 loadAvailableMaintenances();
 loadSectors();
 if (editingChecklist) {
 loadChecklistData();
 } else {
 // Resetear el formulario para modo creación
 setActiveTab('basic');
 setSearchTerm('');
 setIsExpanded(false);
 setAssetTypeFilter('all');
 setUsePhases(false); // Por defecto sin fases

 // Resetear completamente el formulario
 setFormData({
 title: '',
 description: '',
 machineId: machineId?.toString() || 'all', // Usar el machineId pasado como prop
 unidadMovilId: 'all',
 sectorId: sectorId?.toString() || '', // Usar el sectorId pasado como prop
 phases: [], // Sin fases por defecto
 frequency: 'MONTHLY',
 category: 'MAINTENANCE',
 isActive: true
 });
 
 // Resetear selecciones
 setSelectedMaintenances([]);
 setAvailableMaintenances([]);
 
 // Si hay un activo seleccionado, marcarlo automáticamente
 if (selectedAsset) {
 if (selectedAsset.type === 'maquina') {
 setFormData(prev => ({
 ...prev,
 machineId: selectedAsset.id.toString(),
 unidadMovilId: 'all',
 title: `Checklist - ${selectedAsset.name}`
 }));
 // Recargar mantenimientos con el filtro de máquina
 loadAvailableMaintenances();
 } else if (selectedAsset.type === 'unidad-movil') {
 setFormData(prev => ({
 ...prev,
 machineId: 'all',
 unidadMovilId: selectedAsset.id.toString(),
 title: `Checklist - ${selectedAsset.name}`
 }));
 // Recargar mantenimientos con el filtro de unidad móvil
 loadAvailableMaintenances();
 }
 } else if (machineId) {
 // Si no hay selectedAsset pero hay machineId, usarlo
 setFormData(prev => ({
 ...prev,
 machineId: machineId.toString(),
 unidadMovilId: 'all'
 }));
 // Recargar mantenimientos con el filtro de máquina
 loadAvailableMaintenances();
 }
 }
 }
 }, [isOpen, editingChecklist, selectedAsset]);

 // Handler para cerrar con ESC
 useEffect(() => {
 if (!isOpen) return;

 const handleEscape = (e: KeyboardEvent) => {
 if (e.key === 'Escape') {
 onClose();
 }
 };

 document.addEventListener('keydown', handleEscape);
 return () => {
 document.removeEventListener('keydown', handleEscape);
 };
 }, [isOpen, onClose]);

 // Debug: Monitorear cambios en formData.phases
 useEffect(() => {
 // FormData phases changed
 }, [formData.phases]);

 // Crear fases automáticamente cuando cambie la selección de mantenimientos
 // Solo si no estamos en modo edición, usePhases está activado, y es la primera carga
 useEffect(() => {
 if (selectedMaintenances.length > 0 && !editingChecklist && usePhases) {
 createPhasesAutomatically();
 } else if ((selectedMaintenances.length === 0 || !usePhases) && !editingChecklist) {
 setFormData(prev => ({ ...prev, phases: [] }));
 }
 }, [selectedMaintenances, editingChecklist, usePhases]);

 const loadSectors = async () => {
 try {
 const response = await fetch(`/api/sectores?companyId=${companyId}`);
 if (response.ok) {
 const sectors = await response.json();
 setAvailableSectors(Array.isArray(sectors) ? sectors : []);
 }
 } catch (error) {
 console.error('Error loading sectors:', error);
 }
 };

 // ✨ OPTIMIZADO: loadMachines ahora solo carga unidades móviles (máquinas vienen del hook)
 const loadMachines = async () => {
 try {
 // Las máquinas ya vienen del hook useMachinesInitial
 let allAssets = [...machines];
 
 // Cargar unidades móviles
 const unidadesResponse = await fetch(`/api/mantenimiento/unidades-moviles?companyId=${companyId}`);
 if (unidadesResponse.ok) {
 const unidadesData = await unidadesResponse.json();
 if (unidadesData.success && unidadesData.unidades) {
 // Transformar unidades móviles para que tengan el mismo formato que las máquinas
 const unidadesWithType = unidadesData.unidades.map((unidad: any) => ({
 id: unidad.id,
 name: unidad.nombre,
 type: unidad.tipo,
 status: unidad.estado,
 assetType: 'unidad-movil',
 sectorId: sectorId,
 sector: { id: sectorId, name: 'Unidades Móviles' }
 }));
 allAssets = [...allAssets, ...unidadesWithType];
 }
 }
 
 setMachines(allAssets);
 } catch (error) {
 console.error('Error loading mobile units:', error);
 }
 };

 const loadAvailableMaintenances = async () => {
 try {
 // Usar cache global para evitar llamadas duplicadas
 // ✅ Pasar sectorId para filtrar por sector
 const allMaintenances = await fetchAllMaintenancesCached(companyId, sectorId);
 
 // Filtrar por asset si hay uno seleccionado
 let filtered = allMaintenances;
 if (selectedAsset?.type === 'maquina') {
 filtered = allMaintenances.filter((m: any) => m.machineId === selectedAsset.id);
 } else if (selectedAsset?.type === 'unidad-movil') {
 filtered = allMaintenances.filter((m: any) => m.unidadMovilId === selectedAsset.id);
 }
 
 // Filtrar para excluir fallas y mantenimientos correctivos
 const filteredMaintenances = filtered.filter((m: any) => {
 const isFailure = m.notes?.includes('"isFailure":true');
 const isCorrective = m.type === 'CORRECTIVE';
 return !isFailure && !isCorrective;
 });
 
 setAvailableMaintenances(filteredMaintenances);
 } catch (error) {
 console.error('Error loading available maintenances:', error);
 }
 };

 const loadChecklistData = () => {
 if (editingChecklist) {
 // Detectar si el checklist tiene fases
 const hasPhases = editingChecklist.phases && editingChecklist.phases.length > 0;
 setUsePhases(hasPhases);

 // Cargar datos básicos del formulario
 const basicData = {
 title: editingChecklist.title || '',
 description: editingChecklist.description || '',
 frequency: editingChecklist.frequency || 'MONTHLY',
 machineId: editingChecklist.machineId?.toString() || 'all',
 sectorId: editingChecklist.sectorId?.toString() || 'all',
 isActive: editingChecklist.isActive !== false,
 category: editingChecklist.category || 'MAINTENANCE',
 estimatedTotalTime: editingChecklist.estimatedTotalTime || 0,
 items: editingChecklist.items || [],
 phases: editingChecklist.phases || []
 };

 setFormData(basicData);
 
 // Intentar obtener los IDs de mantenimientos desde diferentes fuentes
 let selectedIds: number[] = [];
 
 // Método 1: Desde items directos
 if (editingChecklist.items && editingChecklist.items.length > 0) {
 selectedIds = editingChecklist.items
 .filter((item: any) => item.isMaintenanceItem)
 .map((item: any) => item.maintenanceId);
 }
 
 // Método 2: Desde fases
 if (selectedIds.length === 0 && editingChecklist.phases && editingChecklist.phases.length > 0) {
 selectedIds = editingChecklist.phases
 .flatMap((phase: any) => phase.items || [])
 .filter((item: any) => item.isMaintenanceItem)
 .map((item: any) => item.maintenanceId);
 }
 
 // Método 3: Si el checklist tiene un array de maintenanceIds directamente
 if (selectedIds.length === 0 && editingChecklist.maintenanceIds) {
 selectedIds = editingChecklist.maintenanceIds;
 }
 
 setSelectedMaintenances(selectedIds);
 
 // Cargar instructivos si existen
 if (editingChecklist.instructives && Array.isArray(editingChecklist.instructives)) {
 const loadedInstructives = editingChecklist.instructives.map((inst: any, index: number) => ({
 id: inst.id || `instructive_${index}`,
 title: inst.title || '',
 content: inst.content || ''
 }));
 setInstructives(loadedInstructives);
 } else {
 setInstructives([]);
 }
 
 setActiveTab('basic');
 
 toast({
 title: 'Checklist cargado',
 description: `Editando "${editingChecklist.title}" con ${selectedIds.length} mantenimientos`,
 });
 }
 };

 const handleSubmit = async () => {
 // Verificar si hay elementos seleccionados
 if (!formData.title || selectedMaintenances.length === 0) {
 toast({
 title: 'Error',
 description: 'Por favor completa el título y selecciona al menos un mantenimiento',
 variant: 'destructive'
 });
 return;
 }

 setLoading(true);
 try {
 // Usar las fases existentes o crear nuevas si no existen o están vacías
 let phasesToUse: ChecklistPhase[] = formData.phases || [];

 // DIVIDIR AUTOMÁTICAMENTE POR FASES antes de guardar (solo si usePhases está activado)
 if (selectedMaintenances.length > 0 && usePhases) {
 // Obtener los mantenimientos seleccionados
 const selectedMaintenanceData = availableMaintenances.filter((m: any) => 
 selectedMaintenances.includes(m.id)
 );
 
 // Crear fases automáticamente
 const phases: ChecklistPhase[] = [
 {
 id: 'phase_1',
 name: 'Fase 1 - Antes del Inicio',
 description: 'Mantenimientos antes de comenzar producción',
 order: 1,
 estimatedTime: 0,
 items: []
 },
 {
 id: 'phase_2',
 name: 'Fase 2 - Mitad de Turno',
 description: 'Mantenimientos durante la mitad del turno',
 order: 2,
 estimatedTime: 0,
 items: []
 },
 {
 id: 'phase_3',
 name: 'Fase 3 - Fin de Turno',
 description: 'Mantenimientos al finalizar el turno',
 order: 3,
 estimatedTime: 0,
 items: []
 },
 {
 id: 'phase_4',
 name: 'Fase 4 - Fin de Semana',
 description: 'Mantenimientos para fin de semana',
 order: 4,
 estimatedTime: 0,
 items: []
 }
 ];

 // Distribuir mantenimientos según su configuración
 selectedMaintenanceData.forEach((maintenance, maintIndex) => {
 // Calcular el tiempo estimado correctamente
 let estimatedTimeInMinutes = 30; // Valor por defecto
 if (maintenance.estimatedMinutes && maintenance.estimatedTimeType) {
 // Priorizar los campos correctos para unidades móviles
 if (maintenance.estimatedTimeType === 'HOURS') {
 estimatedTimeInMinutes = maintenance.estimatedMinutes * 60;
 } else if (maintenance.estimatedTimeType === 'MINUTES') {
 estimatedTimeInMinutes = maintenance.estimatedMinutes;
 }
 } else if (maintenance.timeValue && maintenance.timeUnit) {
 // Fallback a los campos antiguos
 if (maintenance.timeUnit === 'MINUTES') {
 estimatedTimeInMinutes = maintenance.timeValue;
 } else if (maintenance.timeUnit === 'HOURS') {
 estimatedTimeInMinutes = maintenance.timeValue * 60;
 }
 } else if (maintenance.estimatedHours) {
 // Fallback al campo estimatedHours si existe
 estimatedTimeInMinutes = Math.round(maintenance.estimatedHours * 60);
 }
 
 const maintenanceItem: ChecklistItem = {
 id: `maintenance_${maintenance.id}`,
 title: maintenance.title,
 description: maintenance.description || `Mantenimiento preventivo`,
 isRequired: true,
 order: 0,
 category: 'MAINTENANCE',
 estimatedTime: estimatedTimeInMinutes,
 maintenanceId: maintenance.id,
 maintenanceType: 'PREVENTIVE',
 isMaintenanceItem: true
 };
 
 // Determinar la fase basándose en la configuración real del mantenimiento
 let phaseIndex = 1; // Por defecto: Mitad de turno

 // Consultar la ventana de ejecución del mantenimiento
 if (maintenance.executionWindow) {
 
 switch (maintenance.executionWindow) {
 case 'BEFORE_START':
 phaseIndex = 0; // Fase 1: Antes del inicio
 break;
 case 'MID_SHIFT':
 phaseIndex = 1; // Fase 2: Mitad de turno
 break;
 case 'END_SHIFT':
 phaseIndex = 2; // Fase 3: Fin de turno
 break;
 case 'WEEKEND':
 phaseIndex = 3; // Fase 4: Fin de semana
 break;
 case 'ANY_TIME':
 case 'SCHEDULED':
 default:
 // Para ANY_TIME y SCHEDULED, usar lógica basada en frecuencia
 if (maintenance.frequencyDays) {
 if (maintenance.frequencyDays <= 7) {
 phaseIndex = 0; // Diarios y semanales van al inicio
 } else if (maintenance.frequencyDays <= 30) {
 phaseIndex = 1; // Mensuales en mitad de turno
 } else {
 phaseIndex = 2; // Trimestrales y anuales al final del turno
 }
 } else {
 phaseIndex = 1; // Por defecto en mitad de turno
 }
 break;
 }
 } else {
 // Si no hay ventana de ejecución configurada, usar la configuración por defecto
 if (maintenance.frequencyDays) {
 if (maintenance.frequencyDays <= 7) {
 phaseIndex = 0; // Diarios y semanales van al inicio
 } else if (maintenance.frequencyDays <= 30) {
 phaseIndex = 1; // Mensuales en mitad de turno
 } else {
 phaseIndex = 2; // Trimestrales y anuales al final del turno
 }
 } else {
 phaseIndex = 1; // Por defecto en mitad de turno
 }
 }
 
 phases[phaseIndex].items.push({
 ...maintenanceItem,
 order: phases[phaseIndex].items.length
 });
 });

 // Filtrar solo fases con elementos
 const phasesWithItems = phases.filter(phase => phase.items.length > 0);

 // Verificar que todos los items estén en las fases
 const totalItemsInPhases = phasesWithItems.reduce((total, phase) => total + phase.items.length, 0);
 
 if (totalItemsInPhases !== selectedMaintenanceData.length) {
 console.error('⚠️ ADVERTENCIA: No todos los items están en las fases!');
 console.error(' Items en fases:', totalItemsInPhases);
 console.error(' Items seleccionados:', selectedMaintenanceData.length);
 }
 
 // Actualizar formData y usar las fases recién creadas
 phasesToUse = phasesWithItems;
 setFormData(prev => ({
 ...prev,
 phases: phasesWithItems
 }));

 // Automatic phase division completed
 }

 // Calcular tiempo total estimado correctamente
 let estimatedTotalTime = 0;
 
 // Usar phasesToUse en lugar de phases (que puede no estar definida si no se recrearon)
 const phasesForCalculation = phasesToUse.length > 0 ? phasesToUse : (formData.phases || []);
 
 if (phasesForCalculation && phasesForCalculation.length > 0) {
 // Si hay fases, sumar el tiempo de todos los items en todas las fases
 estimatedTotalTime = phasesForCalculation.reduce((total, phase) => {
 return total + phase.items.reduce((phaseTotal, item) => {
 // Si es un item de mantenimiento, obtener el tiempo del mantenimiento original
 if (item.isMaintenanceItem && item.maintenanceId) {
 const originalMaintenance = availableMaintenances.find(m => m.id === item.maintenanceId);
 if (originalMaintenance) {
 // Priorizar campos nuevos para unidades móviles
 if (originalMaintenance.estimatedMinutes && originalMaintenance.estimatedTimeType) {
 if (originalMaintenance.estimatedTimeType === 'MINUTES') {
 return phaseTotal + originalMaintenance.estimatedMinutes;
 } else if (originalMaintenance.estimatedTimeType === 'HOURS') {
 return phaseTotal + (originalMaintenance.estimatedMinutes * 60);
 }
 } else if (originalMaintenance.timeValue && originalMaintenance.timeUnit) {
 // Fallback a campos antiguos
 if (originalMaintenance.timeUnit === 'MINUTES') {
 return phaseTotal + originalMaintenance.timeValue;
 } else if (originalMaintenance.timeUnit === 'HOURS') {
 return phaseTotal + (originalMaintenance.timeValue * 60);
 }
 }
 }
 }
 // Si no es un mantenimiento o no tiene tiempo configurado, usar el tiempo del item
 return phaseTotal + (item.estimatedTime || 0);
 }, 0);
 }, 0);
 } else if (formData.items && formData.items.length > 0) {
 // Si hay items directos, sumar su tiempo
 estimatedTotalTime = formData.items.reduce((total, item) => {
 if (item.isMaintenanceItem && item.maintenanceId) {
 const originalMaintenance = availableMaintenances.find(m => m.id === item.maintenanceId);
 if (originalMaintenance) {
 // Priorizar campos nuevos para unidades móviles
 if (originalMaintenance.estimatedMinutes && originalMaintenance.estimatedTimeType) {
 if (originalMaintenance.estimatedTimeType === 'MINUTES') {
 return total + originalMaintenance.estimatedMinutes;
 } else if (originalMaintenance.estimatedTimeType === 'HOURS') {
 return total + (originalMaintenance.estimatedMinutes * 60);
 }
 } else if (originalMaintenance.timeValue && originalMaintenance.timeUnit) {
 // Fallback a campos antiguos
 if (originalMaintenance.timeUnit === 'MINUTES') {
 return total + originalMaintenance.timeValue;
 } else if (originalMaintenance.timeUnit === 'HOURS') {
 return total + (originalMaintenance.timeValue * 60);
 }
 }
 }
 }
 return total + (item.estimatedTime || 0);
 }, 0);
 } else if (selectedMaintenances.length > 0) {
 // Si no hay fases ni items pero hay mantenimientos seleccionados, calcular desde los mantenimientos
 estimatedTotalTime = selectedMaintenances.reduce((total, maintenanceId) => {
 const maintenance = availableMaintenances.find(m => m.id === maintenanceId);
 if (maintenance) {
 // Priorizar campos nuevos para unidades móviles
 if (maintenance.estimatedMinutes && maintenance.estimatedTimeType) {
 if (maintenance.estimatedTimeType === 'MINUTES') {
 return total + maintenance.estimatedMinutes;
 } else if (maintenance.estimatedTimeType === 'HOURS') {
 return total + (maintenance.estimatedMinutes * 60);
 }
 } else if (maintenance.timeValue && maintenance.timeUnit) {
 // Fallback a campos antiguos
 if (maintenance.timeUnit === 'MINUTES') {
 return total + maintenance.timeValue;
 } else if (maintenance.timeUnit === 'HOURS') {
 return total + (maintenance.timeValue * 60);
 }
 }
 }
 return total;
 }, 0);
 }
 
 // Determinar qué tipo de activo está seleccionado
 const isUnidadMovil = formData.unidadMovilId && formData.unidadMovilId !== '' && formData.unidadMovilId !== 'all';
 const isMachine = formData.machineId && formData.machineId !== '' && formData.machineId !== 'all';
 
 // Asegurarse de usar las fases correctas
 // Si usePhases está desactivado, NO enviar fases
 const finalPhases = usePhases
 ? (phasesToUse.length > 0 ? phasesToUse : (formData.phases || []))
 : [];
 
 // Determinar sectorId: usar formData.sectorId si está definido, sino usar el prop sectorId
 let finalSectorId = null;
 if (formData.sectorId && formData.sectorId !== '' && formData.sectorId !== 'all') {
 finalSectorId = parseInt(formData.sectorId);
 } else if (sectorId) {
 // Si formData.sectorId no está definido, usar el sectorId del prop
 finalSectorId = sectorId;
 }
 
 const payload = {
 ...formData,
 companyId,
 machineId: isMachine ? parseInt(formData.machineId!) : null,
 unidadMovilId: isUnidadMovil ? parseInt(formData.unidadMovilId!) : null,
 sectorId: finalSectorId,
 estimatedTotalTime,
 // Usar las fases correctas
 phases: finalPhases,
 // Agregar los mantenimientos seleccionados como items con datos completos
 items: selectedMaintenances.map(id => {
 const maintenance = availableMaintenances.find(m => m.id === id);
 if (maintenance) {
 // Calcular tiempo estimado basado en estimatedMinutes y estimatedTimeType
 let estimatedTime = 30; // default

 if (maintenance.estimatedMinutes && maintenance.estimatedTimeType) {
 if (maintenance.estimatedTimeType === 'HOURS') {
 estimatedTime = maintenance.estimatedMinutes * 60; // convertir horas a minutos
 } else if (maintenance.estimatedTimeType === 'MINUTES') {
 estimatedTime = maintenance.estimatedMinutes;
 }
 } else if (maintenance.timeValue && maintenance.timeUnit) {
 // Fallback a los campos antiguos si los nuevos no están disponibles
 if (maintenance.timeUnit === 'HOURS') {
 estimatedTime = maintenance.timeValue * 60; // convertir horas a minutos
 } else if (maintenance.timeUnit === 'MINUTES') {
 estimatedTime = maintenance.timeValue;
 }
 }

 return {
 id: `maintenance_${maintenance.id}`,
 title: maintenance.title,
 description: maintenance.description,
 estimatedTime: estimatedTime,
 isRequired: true,
 category: 'MAINTENANCE',
 maintenanceId: maintenance.id,
 maintenanceType: maintenance.type,
 isMaintenanceItem: true,
 machine: maintenance.machine,
 unidadMovil: maintenance.unidadMovil,
 assignedTo: maintenance.assignedTo
 };
 }
 return { maintenanceId: id };
 }),
 // Agregar instructivos
 instructives: instructives.map(inst => ({
 title: inst.title,
 content: inst.content
 }))
 };
 
 const url = mode === 'edit' ? `/api/maintenance/checklists/${editingChecklist.id}` : '/api/maintenance/checklists';
 const method = mode === 'edit' ? 'PUT' : 'POST';

 const response = await fetch(url, {
 method,
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload)
 });

 if (response.ok) {
 const result = await response.json();
 toast({
 title: mode === 'edit' ? 'Checklist actualizado' : 'Checklist creado',
 description: mode === 'edit' ? 'El checklist ha sido actualizado exitosamente' : 'El checklist ha sido creado exitosamente con división automática por fases'
 });
 onSave(result);
 onClose();
 resetForm();
 } else {
 throw new Error('Error al guardar el checklist');
 }
 } catch (error) {
 console.error('Error al guardar checklist:', error);
 toast({
 title: 'Error',
 description: 'No se pudo guardar el checklist',
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
 frequency: 'MONTHLY',
 machineId: 'all',
 sectorId: sectorId?.toString() || '',
 isActive: true,
 category: 'MAINTENANCE',
 estimatedTotalTime: 0,
 items: [],
 phases: []
 });
 setSelectedMaintenances([]);
 setActiveTab('basic');
 setSearchTerm('');
 setIsExpanded(false);
 setViewMode('list');
 setInstructives([]);
 setCurrentInstructive({ title: '', content: '' });
 };


 // Debug: Log de mantenimientos seleccionados
 useEffect(() => {
 // Checking selected maintenances
 
 if (selectedMaintenances.length > 0) {
 // Verificar que los IDs seleccionados existan en los mantenimientos disponibles
 const availableIds = availableMaintenances.map(m => m.id);
 const missingIds = selectedMaintenances.filter(id => !availableIds.includes(id));
 if (missingIds.length > 0) {
 console.warn('⚠️ IDs de mantenimientos no encontrados:', missingIds);
 }
 } else {
 // No maintenances selected
 }
 }, [selectedMaintenances, availableMaintenances]);



 const handlePhasesSave = (phases: any[]) => {
 // Aquí se guardarían las fases en el backend
 setShowPhaseDialog(false);
 };

 const divideIntoPhases = () => {
 if (!selectedMaintenances.length) {
 toast({
 title: 'Error',
 description: 'Debe seleccionar al menos un mantenimiento',
 variant: 'destructive'
 });
 return;
 }

 // Obtener los mantenimientos seleccionados
 const selectedMaintenanceData = availableMaintenances.filter(m => 
 selectedMaintenances.includes(m.id)
 );

 // Verificar si hay unidades móviles en la selección
 const hasUnidadMovil = selectedMaintenanceData.some((maintenance: any) => 
 maintenance.unidadMovilId || maintenance.unidadMovil
 );

 // Si hay unidades móviles, mostrar mensaje y no organizar por fases
 if (hasUnidadMovil) {
 toast({
 title: 'Información',
 description: 'Los checklists con unidades móviles no se organizan por fases automáticamente',
 variant: 'default'
 });
 return;
 }

 // Dividir automáticamente por ventana de tiempo
 const phases = [
 {
 id: 'phase_1',
 name: 'Fase 1 - Antes del Inicio',
 description: 'Mantenimientos antes de comenzar producción',
 order: 1,
 estimatedTime: 0,
 items: []
 },
 {
 id: 'phase_2',
 name: 'Fase 2 - Mitad de Turno',
 description: 'Mantenimientos durante la mitad del turno',
 order: 2,
 estimatedTime: 0,
 items: []
 },
 {
 id: 'phase_3',
 name: 'Fase 3 - Fin de Turno',
 description: 'Mantenimientos al finalizar el turno',
 order: 3,
 estimatedTime: 0,
 items: []
 },
 {
 id: 'phase_4',
 name: 'Fase 4 - Fin de Semana',
 description: 'Mantenimientos para fin de semana',
 order: 4,
 estimatedTime: 0,
 items: []
 }
 ];

 // Distribuir mantenimientos según su configuración
 selectedMaintenanceData.forEach(maintenance => {
 // Calcular el tiempo estimado correctamente
 let estimatedTimeInMinutes = 30; // Valor por defecto
 if (maintenance.estimatedMinutes && maintenance.estimatedTimeType) {
 // Priorizar los campos correctos para unidades móviles
 if (maintenance.estimatedTimeType === 'HOURS') {
 estimatedTimeInMinutes = maintenance.estimatedMinutes * 60;
 } else if (maintenance.estimatedTimeType === 'MINUTES') {
 estimatedTimeInMinutes = maintenance.estimatedMinutes;
 }
 } else if (maintenance.timeValue && maintenance.timeUnit) {
 // Fallback a los campos antiguos
 if (maintenance.timeUnit === 'MINUTES') {
 estimatedTimeInMinutes = maintenance.timeValue;
 } else if (maintenance.timeUnit === 'HOURS') {
 estimatedTimeInMinutes = maintenance.timeValue * 60;
 }
 } else if (maintenance.estimatedHours) {
 // Fallback al campo estimatedHours si existe
 estimatedTimeInMinutes = Math.round(maintenance.estimatedHours * 60);
 }

 const maintenanceItem = {
 id: `maintenance_${maintenance.id}`,
 title: maintenance.title,
 description: maintenance.description || `Mantenimiento preventivo`,
 isRequired: true,
 order: 0,
 category: 'MAINTENANCE',
 estimatedTime: estimatedTimeInMinutes,
 maintenanceId: maintenance.id,
 maintenanceType: 'PREVENTIVE',
 isMaintenanceItem: true
 };

 // Determinar la fase basándose en la configuración real del mantenimiento
 let phaseIndex = 1; // Por defecto: Mitad de turno
 
 // Consultar la ventana de ejecución del mantenimiento
 if (maintenance.executionWindow) {
 switch (maintenance.executionWindow) {
 case 'BEFORE_START':
 phaseIndex = 0; // Fase 1: Antes del inicio
 break;
 case 'MID_SHIFT':
 phaseIndex = 1; // Fase 2: Mitad de turno
 break;
 case 'END_SHIFT':
 phaseIndex = 2; // Fase 3: Fin de turno
 break;
 case 'WEEKEND':
 phaseIndex = 3; // Fase 4: Fin de semana
 break;
 case 'ANY_TIME':
 case 'SCHEDULED':
 default:
 // Para ANY_TIME y SCHEDULED, usar lógica basada en frecuencia
 if (maintenance.frequencyDays) {
 if (maintenance.frequencyDays <= 7) {
 phaseIndex = 0; // Diarios y semanales van al inicio
 } else if (maintenance.frequencyDays <= 30) {
 phaseIndex = 1; // Mensuales en mitad de turno
 } else {
 phaseIndex = 2; // Trimestrales y anuales al final del turno
 }
 } else {
 phaseIndex = 1; // Por defecto en mitad de turno
 }
 break;
 }
 } else {
 // Si no hay ventana de ejecución configurada, usar la configuración por defecto
 if (maintenance.frequencyDays) {
 if (maintenance.frequencyDays <= 7) {
 phaseIndex = 0; // Diarios y semanales van al inicio
 } else if (maintenance.frequencyDays <= 30) {
 phaseIndex = 1; // Mensuales en mitad de turno
 } else {
 phaseIndex = 2; // Trimestrales y anuales al final del turno
 }
 } else {
 phaseIndex = 1; // Por defecto en mitad de turno
 }
 }

 (phases[phaseIndex].items as ChecklistItem[]).push({
 ...maintenanceItem,
 order: phases[phaseIndex].items.length
 });
 });

 // Actualizar el estado con las fases generadas
 setFormData(prev => ({
 ...prev,
 phases: phases.filter(phase => phase.items.length > 0) // Solo fases con elementos
 }));

 const phasesWithItems = phases.filter(phase => phase.items.length > 0);
 const totalItems = phasesWithItems.reduce((total, phase) => total + phase.items.length, 0);
 
 // Crear un resumen detallado de la organización
 const phaseSummary = phasesWithItems.map(phase => {
 const beforeStart = phase.items.filter((item: ChecklistItem) => item.title.includes('BEFORE_START')).length;
 const midShift = phase.items.filter((item: ChecklistItem) => item.title.includes('MID_SHIFT')).length;
 const endShift = phase.items.filter((item: ChecklistItem) => item.title.includes('END_SHIFT')).length;
 
 return `${phase.name}: ${phase.items.length} mantenimientos`;
 }).join(', ');
 
 toast({
 title: 'Fases Generadas',
 description: `Se han organizado ${totalItems} mantenimientos en ${phasesWithItems.length} fases según su ventana de ejecución configurada`,
 });
 };

 const addPhase = () => {
 const newPhase: ChecklistPhase = {
 id: `phase_${Date.now()}`,
 name: `Fase ${phases.length + 1}`,
 description: '',
 order: phases.length + 1,
 estimatedTime: 0,
 items: []
 };
 
 setFormData(prev => ({
 ...prev,
 phases: [...(prev.phases || []), newPhase]
 }));
 };

 const removePhase = (phaseId: string) => {
 setFormData(prev => ({
 ...prev,
 phases: (prev.phases || []).filter(phase => phase.id !== phaseId)
 }));
 };

 const updatePhase = (phaseId: string, updates: Partial<ChecklistPhase>) => {
 setFormData(prev => ({
 ...prev,
 phases: (prev.phases || []).map(phase => 
 phase.id === phaseId ? { ...phase, ...updates } : phase
 )
 }));
 };

 const createPhasesAutomatically = () => {
 // Si usePhases está desactivado, limpiar las fases y salir
 if (!usePhases) {
 setFormData(prev => ({ ...prev, phases: [] }));
 return;
 }

 if (selectedMaintenances.length === 0) {
 setFormData(prev => ({ ...prev, phases: [] }));
 return;
 }

 // Obtener los mantenimientos seleccionados
 const selectedMaintenanceData = availableMaintenances.filter((m: any) => 
 selectedMaintenances.includes(m.id)
 );

 // Verificar si hay unidades móviles en la selección
 const hasUnidadMovil = selectedMaintenanceData.some((maintenance: any) => 
 maintenance.unidadMovilId || maintenance.unidadMovil
 );

 // Si hay unidades móviles, no organizar por fases
 if (hasUnidadMovil) {
 setFormData(prev => ({ ...prev, phases: [] }));
 return;
 }

 // Crear fases automáticamente
 const phases: ChecklistPhase[] = [
 {
 id: 'phase_1',
 name: 'Fase 1 - Antes del Inicio',
 description: 'Mantenimientos antes de comenzar producción',
 order: 1,
 estimatedTime: 0,
 items: []
 },
 {
 id: 'phase_2',
 name: 'Fase 2 - Mitad de Turno',
 description: 'Mantenimientos durante la mitad del turno',
 order: 2,
 estimatedTime: 0,
 items: []
 },
 {
 id: 'phase_3',
 name: 'Fase 3 - Fin de Turno',
 description: 'Mantenimientos al finalizar el turno',
 order: 3,
 estimatedTime: 0,
 items: []
 },
 {
 id: 'phase_4',
 name: 'Fase 4 - Fin de Semana',
 description: 'Mantenimientos para fin de semana',
 order: 4,
 estimatedTime: 0,
 items: []
 }
 ];

 // Distribuir mantenimientos según su configuración
 selectedMaintenanceData.forEach(maintenance => {
 // Calcular el tiempo estimado correctamente
 let estimatedTimeInMinutes = 30; // Valor por defecto
 if (maintenance.estimatedMinutes && maintenance.estimatedTimeType) {
 // Priorizar los campos correctos para unidades móviles
 if (maintenance.estimatedTimeType === 'HOURS') {
 estimatedTimeInMinutes = maintenance.estimatedMinutes * 60;
 } else if (maintenance.estimatedTimeType === 'MINUTES') {
 estimatedTimeInMinutes = maintenance.estimatedMinutes;
 }
 } else if (maintenance.timeValue && maintenance.timeUnit) {
 // Fallback a los campos antiguos
 if (maintenance.timeUnit === 'MINUTES') {
 estimatedTimeInMinutes = maintenance.timeValue;
 } else if (maintenance.timeUnit === 'HOURS') {
 estimatedTimeInMinutes = maintenance.timeValue * 60;
 }
 } else if (maintenance.estimatedHours) {
 // Fallback al campo estimatedHours si existe
 estimatedTimeInMinutes = Math.round(maintenance.estimatedHours * 60);
 }

 const maintenanceItem: ChecklistItem = {
 id: `maintenance_${maintenance.id}`,
 title: maintenance.title,
 description: maintenance.description || `Mantenimiento preventivo`,
 isRequired: true,
 order: 0,
 category: 'MAINTENANCE',
 estimatedTime: estimatedTimeInMinutes,
 maintenanceId: maintenance.id,
 maintenanceType: 'PREVENTIVE',
 isMaintenanceItem: true
 };

 // Determinar la fase basándose en la configuración real del mantenimiento
 let phaseIndex = 1; // Por defecto: Mitad de turno
 
 // Consultar la ventana de ejecución del mantenimiento
 if (maintenance.executionWindow) {
 switch (maintenance.executionWindow) {
 case 'BEFORE_START':
 phaseIndex = 0; // Fase 1: Antes del inicio
 break;
 case 'MID_SHIFT':
 phaseIndex = 1; // Fase 2: Mitad de turno
 break;
 case 'END_SHIFT':
 phaseIndex = 2; // Fase 3: Fin de turno
 break;
 case 'WEEKEND':
 phaseIndex = 3; // Fase 4: Fin de semana
 break;
 case 'ANY_TIME':
 case 'SCHEDULED':
 default:
 // Para ANY_TIME y SCHEDULED, usar lógica basada en frecuencia
 if (maintenance.frequencyDays) {
 if (maintenance.frequencyDays <= 7) {
 phaseIndex = 0; // Diarios y semanales van al inicio
 } else if (maintenance.frequencyDays <= 30) {
 phaseIndex = 1; // Mensuales en mitad de turno
 } else {
 phaseIndex = 2; // Trimestrales y anuales al final del turno
 }
 } else {
 phaseIndex = 1; // Por defecto en mitad de turno
 }
 break;
 }
 } else {
 // Si no hay ventana de ejecución configurada, usar la configuración por defecto
 if (maintenance.frequencyDays) {
 if (maintenance.frequencyDays <= 7) {
 phaseIndex = 0; // Diarios y semanales van al inicio
 } else if (maintenance.frequencyDays <= 30) {
 phaseIndex = 1; // Mensuales en mitad de turno
 } else {
 phaseIndex = 2; // Trimestrales y anuales al final del turno
 }
 } else {
 phaseIndex = 1; // Por defecto en mitad de turno
 }
 }

 phases[phaseIndex].items.push({
 ...maintenanceItem,
 order: phases[phaseIndex].items.length
 });
 });

 // Filtrar solo fases con elementos y actualizar formData
 const phasesWithItems = phases.filter(phase => phase.items.length > 0);
 
 setFormData(prev => ({
 ...prev,
 phases: phasesWithItems
 }));

 // Phases created automatically
 };

 const toggleMaintenanceSelection = (maintenance: any) => {
 // Toggling maintenance selection
 
 if (selectedMaintenances.includes(maintenance.id)) {
 // Remover mantenimiento
 setSelectedMaintenances(prev => prev.filter(id => id !== maintenance.id));
 
 // Remover de todas las fases
 setFormData(prev => ({
 ...prev,
 phases: (prev.phases || []).map(phase => ({
 ...phase,
 items: phase.items.filter(item => item.maintenanceId !== maintenance.id)
 }))
 }));
 
 } else {
 // Agregar mantenimiento
 setSelectedMaintenances(prev => [...prev, maintenance.id]);
 
 // Si estamos en modo edición, agregar a la primera fase disponible o crear una nueva
 if (editingChecklist) {
 // Calcular el tiempo estimado correctamente
 let estimatedTimeInMinutes = 30; // Valor por defecto
 if (maintenance.timeValue && maintenance.timeUnit) {
 if (maintenance.timeUnit === 'MINUTES') {
 estimatedTimeInMinutes = maintenance.timeValue;
 } else if (maintenance.timeUnit === 'HOURS') {
 estimatedTimeInMinutes = maintenance.timeValue * 60;
 }
 } else if (maintenance.estimatedHours) {
 // Fallback al campo estimatedHours si existe
 estimatedTimeInMinutes = Math.round(maintenance.estimatedHours * 60);
 }
 
 const maintenanceItem = {
 id: `maintenance_${maintenance.id}`,
 title: maintenance.title,
 description: maintenance.description || `Mantenimiento preventivo`,
 isRequired: true,
 order: 0,
 category: 'MAINTENANCE',
 estimatedTime: estimatedTimeInMinutes,
 maintenanceId: maintenance.id,
 maintenanceType: 'PREVENTIVE',
 isMaintenanceItem: true
 };
 
 // Solo agregar a fases si usePhases está activado
 if (usePhases) {
 setFormData(prev => {
 const currentPhases = prev.phases || [];
 if (currentPhases.length === 0) {
 // Si no hay fases, crear una nueva
 return {
 ...prev,
 phases: [{
 id: 'phase_1',
 name: 'Fase 1 - Mantenimientos',
 description: 'Mantenimientos del checklist',
 order: 1,
 estimatedTime: 0,
 items: [maintenanceItem]
 }]
 };
 } else {
 // Agregar a la primera fase
 return {
 ...prev,
 phases: currentPhases.map((phase, index) => {
 if (index === 0) {
 return {
 ...phase,
 items: [...phase.items, { ...maintenanceItem, order: phase.items.length }]
 };
 }
 return phase;
 })
 };
 }
 });
 }
 } else {
 // Crear fases automáticamente después de agregar (solo si usePhases está activado)
 if (usePhases) {
 setTimeout(() => createPhasesAutomatically(), 100);
 }
 }
 }
 };

 const addMaintenanceToPhase = (maintenance: any, phaseId: string) => {
 // Calcular el tiempo estimado correctamente
 let estimatedTimeInMinutes = 30; // Valor por defecto
 if (maintenance.timeValue && maintenance.timeUnit) {
 if (maintenance.timeUnit === 'MINUTES') {
 estimatedTimeInMinutes = maintenance.timeValue;
 } else if (maintenance.timeUnit === 'HOURS') {
 estimatedTimeInMinutes = maintenance.timeValue * 60;
 }
 } else if (maintenance.estimatedHours) {
 // Fallback al campo estimatedHours si existe
 estimatedTimeInMinutes = Math.round(maintenance.estimatedHours * 60);
 }

 const maintenanceItem = {
 id: `maintenance_${maintenance.id}`,
 title: maintenance.title,
 description: maintenance.description || `Mantenimiento preventivo`,
 isRequired: true,
 order: 0,
 category: 'MAINTENANCE',
 estimatedTime: estimatedTimeInMinutes,
 maintenanceId: maintenance.id,
 maintenanceType: 'PREVENTIVE',
 isMaintenanceItem: true
 };

 setFormData(prev => ({
 ...prev,
 phases: (prev.phases || []).map(phase => {
 if (phase.id === phaseId) {
 return {
 ...phase,
 items: [...phase.items, { ...maintenanceItem, order: phase.items.length }]
 };
 }
 return phase;
 })
 }));

 setSelectedMaintenances(prev => [...prev, maintenance.id]);
 
 // Crear fases automáticamente después de agregar
 setTimeout(() => createPhasesAutomatically(), 100);
 };

 const removeMaintenanceFromPhase = (maintenanceId: string, phaseId: string) => {
 const numericId = parseInt(maintenanceId.replace('maintenance_', ''));

 setFormData(prev => ({
 ...prev,
 phases: (prev.phases || []).map(phase => {
 if (phase.id === phaseId) {
 return {
 ...phase,
 items: phase.items.filter(item => item.id !== maintenanceId)
 };
 }
 return phase;
 })
 }));

 setSelectedMaintenances(prev => prev.filter(id => id !== numericId));
 
 // Solo recrear fases automáticamente si no estamos en modo edición
 if (!editingChecklist) {
 setTimeout(() => createPhasesAutomatically(), 100);
 }
 };

 const removeItem = (index: number) => {
 const itemToRemove = formData.items?.[index];
 
 setFormData(prev => ({
 ...prev,
 items: (prev.items || []).filter((_, i) => i !== index).map((item, i) => ({ ...item, order: i }))
 }));

 // Si es un elemento de mantenimiento, removerlo de la lista de seleccionados
 if (itemToRemove?.isMaintenanceItem && itemToRemove?.maintenanceId) {
 setSelectedMaintenances(prev => prev.filter(id => id !== itemToRemove.maintenanceId));
 
 // Recrear fases automáticamente después de remover
 setTimeout(() => createPhasesAutomatically(), 100);
 }
 };

 const moveItem = (index: number, direction: 'up' | 'down') => {
 const currentItems = formData.items || [];
 const newItems = [...currentItems];
 const targetIndex = direction === 'up' ? index - 1 : index + 1;

 if (targetIndex >= 0 && targetIndex < newItems.length) {
 [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
 newItems.forEach((item, i) => item.order = i);
 
 setFormData(prev => ({ ...prev, items: newItems }));
 }
 };

 const updateItem = (index: number, updates: Partial<ChecklistItem>) => {
 setFormData(prev => ({
 ...prev,
 items: (prev.items || []).map((item, i) => i === index ? { ...item, ...updates } : item)
 }));
 };

 const getCategoryColor = (category?: string) => {
 switch (category) {
 case 'INSPECTION': return 'bg-info-muted text-info-muted-foreground';
 case 'MAINTENANCE': return 'bg-success-muted text-success-muted-foreground';
 case 'SAFETY': return 'bg-destructive/10 text-destructive';
 case 'CLEANING': return 'bg-purple-100 text-purple-800';
 case 'LUBRICATION': return 'bg-warning-muted text-warning-muted-foreground';
 default: return 'bg-muted text-foreground';
 }
 };

 const getCategoryLabel = (category?: string) => {
 switch (category) {
 case 'INSPECTION': return 'Inspección';
 case 'MAINTENANCE': return 'Mantenimiento';
 case 'SAFETY': return 'Seguridad';
 case 'CLEANING': return 'Limpieza';
 case 'LUBRICATION': return 'Lubricación';
 default: return category || 'Mantenimiento';
 }
 };

 const getFrequencyLabel = (frequency?: string) => {
 switch (frequency) {
 case 'DAILY': return 'Diario';
 case 'WEEKLY': return 'Semanal';
 case 'BIWEEKLY': return 'Quincenal';
 case 'MONTHLY': return 'Mensual';
 case 'QUARTERLY': return 'Trimestral';
 case 'YEARLY': return 'Anual';
 default: return frequency || 'Mensual';
 }
 };

 // Validaciones por paso
 const validateStep = (step: string): boolean => {
 switch (step) {
 case 'basic':
 const hasTitle = !!formData.title?.trim();
 const hasSector = !!formData.sectorId && formData.sectorId !== 'all';
 return hasTitle && hasSector;
 case 'items':
 return selectedMaintenances.length > 0;
 case 'instructives':
 return true; // Opcional
 case 'preview':
 return true;
 default:
 return false;
 }
 };

 const canGoToStep = (targetStep: string): boolean => {
 const stepOrder = ['basic', 'items', 'instructives', 'preview'];
 const currentIndex = stepOrder.indexOf(activeTab);
 const targetIndex = stepOrder.indexOf(targetStep);
 
 // Si vamos hacia atrás, permitir siempre
 if (targetIndex < currentIndex) return true;
 
 // Permitir avanzar a "items" sin validación (sin completar título y sector)
 if (targetStep === 'items') return true;
 
 // Permitir avanzar a "instructives" sin validación (sin seleccionar elementos)
 if (targetStep === 'instructives') return true;
 
 // Si vamos al siguiente, validar el paso actual (solo para pasos después de instructives)
 if (targetIndex === currentIndex + 1) {
 if (!validateStep(activeTab)) {
 return false;
 }
 return true;
 }
 
 // Para saltos mayores, validar todos los pasos intermedios (excepto basic, items e instructives)
 for (let i = currentIndex; i < targetIndex; i++) {
 if (stepOrder[i] === 'basic' || stepOrder[i] === 'items' || stepOrder[i] === 'instructives') continue;
 if (!validateStep(stepOrder[i])) return false;
 }
 return true;
 };

 const handleStepChange = (step: string) => {
 if (canGoToStep(step)) {
 setActiveTab(step);
 }
 };

 const handleNext = () => {
 const stepOrder = ['basic', 'items', 'instructives', 'preview'];
 const currentIndex = stepOrder.indexOf(activeTab);
 if (currentIndex < stepOrder.length - 1) {
 handleStepChange(stepOrder[currentIndex + 1]);
 }
 };

 const handlePrevious = () => {
 const stepOrder = ['basic', 'items', 'instructives', 'preview'];
 const currentIndex = stepOrder.indexOf(activeTab);
 if (currentIndex > 0) {
 setActiveTab(stepOrder[currentIndex - 1]);
 }
 };

 // Definir los steps del stepper
 const wizardSteps: Step[] = [
 { id: 'basic', label: 'Información Básica' },
 { id: 'items', label: 'Elementos del Checklist' },
 { id: 'instructives', label: 'Instructivos' },
 { id: 'preview', label: 'Vista Previa' }
 ];

 // Filtrar mantenimientos según búsqueda y filtros
 const filteredMaintenances = useMemo(() => {
 let filtered = availableMaintenances;

 // Filtro por tipo de activo
 if (assetTypeFilter === 'maquina') {
 filtered = filtered.filter((m: any) => m.machineId && !m.unidadMovilId);
 } else if (assetTypeFilter === 'unidad-movil') {
 filtered = filtered.filter((m: any) => m.unidadMovilId && !m.machineId);
 }

 // Filtro por búsqueda
 if (searchTerm.trim()) {
 const searchLower = searchTerm.toLowerCase();
 filtered = filtered.filter((m: any) => {
 const matchesTitle = m.title?.toLowerCase().includes(searchLower);
 const matchesDescription = m.description?.toLowerCase().includes(searchLower);
 const matchesMachine = m.machine?.name?.toLowerCase().includes(searchLower);
 const matchesUnidad = m.unidadMovil?.nombre?.toLowerCase().includes(searchLower);
 return matchesTitle || matchesDescription || matchesMachine || matchesUnidad;
 });
 }

 return filtered;
 }, [availableMaintenances, assetTypeFilter, searchTerm]);

 // Opciones de filtro de activo
 const assetFilterOptions = useMemo(() => {
 const options = [
 { value: 'all', label: 'Todos los activos' }
 ];
 
 const hasMachines = availableMaintenances.some((m: any) => m.machineId && !m.unidadMovilId);
 const hasUnidades = availableMaintenances.some((m: any) => m.unidadMovilId && !m.machineId);
 
 if (hasMachines) options.push({ value: 'maquina', label: 'Solo Máquinas' });
 if (hasUnidades) options.push({ value: 'unidad-movil', label: 'Solo Unidades Móviles' });
 
 return options;
 }, [availableMaintenances]);

 return (
 <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
 {/* p-0: custom layout with manual header/stepper/footer spacing */}
 <DialogContent size="xl" className="p-0" hideCloseButton>
 {/* HEADER STICKY */}
 <div className="flex-shrink-0 bg-background border-b border-border/60 px-4 py-3 sm:px-6 sm:py-4 relative">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2 text-base font-semibold">
 <CheckSquare className="h-4 w-4" />
 {mode === 'edit' ? 'Editar Checklist' : 'Nuevo Checklist de Mantenimiento'}
 </DialogTitle>
 <DialogDescription className="text-xs text-muted-foreground mt-1.5">
 {mode === 'edit' ? 'Modifica el checklist de mantenimiento' : 'Crea un nuevo checklist con elementos verificables'}
 </DialogDescription>
 </DialogHeader>
 <Button
 variant="ghost"
 size="icon"
 className="absolute right-4 top-4 h-8 w-8 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 onClick={onClose}
 type="button"
 >
 <X className="h-4 w-4" />
 <span className="sr-only">Cerrar</span>
 </Button>
 </div>

 {/* STEPPER STICKY */}
 <div className="flex-shrink-0 bg-muted/40 border-b border-border/60 px-4 py-2 sm:px-6 sm:py-3">
 <Stepper 
 steps={wizardSteps} 
 currentStep={activeTab}
 onStepClick={handleStepChange}
 />
 </div>

 {/* BODY SCROLLEABLE */}
 <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
 <Tabs value={activeTab} onValueChange={handleStepChange} className="w-full">

 <TabsContent value="basic" className="mt-0">
 <div className="space-y-4 pb-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Card A - Identidad */}
 <Card>
 <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
 <CardTitle className="text-sm font-semibold">Identidad</CardTitle>
 </CardHeader>
 <CardContent className="px-4 pt-0 pb-4 space-y-4 sm:px-6 sm:pb-6">
 <div className="space-y-1.5">
 <Label htmlFor="title" className="text-xs font-medium">Título del Checklist *</Label>
 <Input
 id="title"
 value={formData.title}
 onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
 placeholder="Ej: Checklist Mensual de Mantenimiento"
 className="text-sm"
 />
 </div>

 <div className="space-y-1.5">
 <Label htmlFor="description" className="text-xs font-medium">Descripción</Label>
 <Textarea
 id="description"
 value={formData.description}
 onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
 placeholder="Descripción del checklist y su propósito"
 rows={4}
 className="text-sm resize-none"
 />
 </div>

 {/* Mini preview de chips */}
 {(formData.category || formData.frequency || formData.sectorId) && (
 <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60">
 {formData.category && (
 <Badge className={getCategoryColor(formData.category)}>
 {getCategoryLabel(formData.category)}
 </Badge>
 )}
 {formData.frequency && (
 <Badge variant="outline">
 {getFrequencyLabel(formData.frequency)}
 </Badge>
 )}
 {formData.sectorId && formData.sectorId !== 'all' && (
 <Badge variant="outline">
 {availableSectors.find(s => s.id.toString() === formData.sectorId)?.name || 'Sector'}
 </Badge>
 )}
 </div>
 )}
 </CardContent>
 </Card>

 {/* Card B - Configuración */}
 <Card>
 <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
 <CardTitle className="text-sm font-semibold">Configuración</CardTitle>
 </CardHeader>
 <CardContent className="px-4 pt-0 pb-4 space-y-4 sm:px-6 sm:pb-6">
 <div className="space-y-1.5">
 <Label htmlFor="frequency" className="text-xs font-medium">Frecuencia</Label>
 <Select value={formData.frequency || 'MONTHLY'} onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value }))}>
 <SelectTrigger className="text-sm">
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

 <div className="space-y-1.5">
 <Label htmlFor="category" className="text-xs font-medium">Categoría</Label>
 <Select value={formData.category || 'MAINTENANCE'} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
 <SelectTrigger className="text-sm">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="MAINTENANCE">Mantenimiento</SelectItem>
 <SelectItem value="INSPECTION">Inspección</SelectItem>
 <SelectItem value="SAFETY">Seguridad</SelectItem>
 <SelectItem value="CLEANING">Limpieza</SelectItem>
 <SelectItem value="LUBRICATION">Lubricación</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-1.5">
 <Label htmlFor="sectorId" className="text-xs font-medium">Sector *</Label>
 <Select 
 value={formData.sectorId || 'all'} 
 onValueChange={(value) => setFormData(prev => ({ ...prev, sectorId: value === 'all' ? '' : value }))}
 >
 <SelectTrigger className="text-sm">
 <SelectValue placeholder="Seleccionar sector" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todos los sectores</SelectItem>
 {availableSectors.map((sector) => (
 <SelectItem key={sector.id} value={sector.id.toString()}>
 {sector.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="flex items-center space-x-2 pt-2 border-t border-border/60">
 <Switch
 id="isActive"
 checked={formData.isActive}
 onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
 />
 <div className="flex-1">
 <Label htmlFor="isActive" className="text-xs font-medium cursor-pointer">Checklist activo</Label>
 <p className="text-xs text-muted-foreground mt-0.5">El checklist estará disponible para ejecución</p>
 </div>
 </div>

 <div className="flex items-center space-x-2 pt-2 border-t border-border/60">
 <Switch
 id="usePhases"
 checked={usePhases}
 onCheckedChange={(checked) => setUsePhases(checked)}
 />
 <div className="flex-1">
 <Label htmlFor="usePhases" className="text-xs font-medium cursor-pointer">Organizar por fases</Label>
 <p className="text-xs text-muted-foreground mt-0.5">
 {usePhases
 ? 'Los items se agruparán en fases automáticamente'
 : 'Los items se guardarán sin organización por fases'}
 </p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 </div>
 </TabsContent>

 <TabsContent value="items" className="mt-0">
 <div className="space-y-4 pb-4">
 {/* Split View 60/40 */}
 <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
 {/* IZQUIERDA - Disponibles (60%) */}
 <Card>
 <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
 <CardTitle className="text-sm font-semibold flex items-center gap-2">
 Disponibles
 <Badge variant="secondary" className="text-xs font-normal">
 {filteredMaintenances.length}
 </Badge>
 {filteredMaintenances.length !== availableMaintenances.length && (
 <span className="text-xs text-muted-foreground font-normal">
 / {availableMaintenances.length} total
 </span>
 )}
 </CardTitle>
 </CardHeader>
 <CardContent className="px-4 pt-0 pb-4 space-y-3 sm:px-6 sm:pb-6">
 {/* Filtros */}
 <div className="space-y-2 flex-shrink-0">
 <div className="grid grid-cols-2 gap-2">
 <div className="space-y-1.5">
 <Label className="text-xs font-medium">Tipo de Activo</Label>
 <Select value={assetTypeFilter} onValueChange={(value: any) => setAssetTypeFilter(value)}>
 <SelectTrigger className="w-full text-sm h-9">
 <SelectValue placeholder="Todos" />
 </SelectTrigger>
 <SelectContent>
 {assetFilterOptions.map((option) => (
 <SelectItem key={option.value} value={option.value}>
 {option.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 
 {/* Toggle vista */}
 <div className="space-y-1.5">
 <Label className="text-xs font-medium">Vista</Label>
 <div className="flex border rounded-md overflow-hidden h-9">
 <Button
 variant={viewMode === 'list' ? 'default' : 'ghost'}
 size="sm"
 onClick={() => setViewMode('list')}
 className="rounded-none border-0 h-full flex-1 text-xs"
 >
 <FileText className="h-3.5 w-3.5 mr-1.5" />
 Lista
 </Button>
 <Button
 variant={viewMode === 'cards' ? 'default' : 'ghost'}
 size="sm"
 onClick={() => setViewMode('cards')}
 className="rounded-none border-0 h-full flex-1 text-xs"
 >
 <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
 Tarjetas
 </Button>
 </div>
 </div>
 </div>

 {/* Barra de búsqueda */}
 <div className="relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3.5 w-3.5" />
 <Input
 placeholder="Buscar mantenimientos..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-9 text-sm h-9"
 />
 </div>
 </div>

 {/* Lista de mantenimientos */}
 <div className="border rounded-lg">
 {filteredMaintenances.length === 0 ? (
 <div className="text-center py-12 text-muted-foreground">
 <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
 <p className="text-xs font-medium">{searchTerm ? 'No se encontraron mantenimientos' : 'No hay mantenimientos disponibles'}</p>
 <p className="text-xs mt-1">{searchTerm ? 'Intenta con otros términos de búsqueda' : 'Crea algunos mantenimientos primero'}</p>
 </div>
 ) : viewMode === 'cards' ? (
 <div className="h-[550px] overflow-y-auto p-3 pr-2">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {filteredMaintenances.map((maintenance: any) => {
 const isSelected = selectedMaintenances.includes(maintenance.id);
 const timeDisplay = (() => {
 if (maintenance.unidadMovilId || maintenance.unidadMovil) {
 if (maintenance.estimatedMinutes && maintenance.estimatedMinutes > 0) {
 if (maintenance.estimatedTimeType === 'HOURS') {
 const hours = Math.floor(maintenance.estimatedMinutes / 60);
 const minutes = maintenance.estimatedMinutes % 60;
 return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
 }
 return `${maintenance.estimatedMinutes}m`;
 }
 }
 if (maintenance.timeValue && maintenance.timeUnit) {
 return maintenance.timeUnit === 'MINUTES' 
 ? `${maintenance.timeValue} min`
 : `${maintenance.timeValue} h`;
 }
 return null;
 })();

 return (
 <div
 key={maintenance.id}
 className={cn(
 'p-3 border rounded-lg cursor-pointer transition-colors',
 isSelected
 ? 'border-primary bg-primary/5'
 : 'border-border hover:border-primary/50 hover:bg-muted/50'
 )}
 onClick={() => toggleMaintenanceSelection(maintenance)}
 >
 <div className="flex items-start justify-between mb-2">
 <div className="flex-1 min-w-0 flex items-center gap-1.5">
 <h4 className="font-medium text-xs line-clamp-1">{maintenance.title}</h4>
 {maintenance.description && (
 <TooltipProvider delayDuration={200}>
 <Tooltip>
 <TooltipTrigger asChild>
 <button
 type="button"
 onClick={(e) => e.stopPropagation()}
 className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
 >
 <Info className="h-3 w-3" />
 </button>
 </TooltipTrigger>
 <TooltipContent side="top" className="max-w-sm p-3 bg-popover border shadow-lg">
 <div className="space-y-1.5">
 <p className="text-xs font-semibold text-foreground">Descripción</p>
 <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{maintenance.description}</p>
 </div>
 </TooltipContent>
 </Tooltip>
 </TooltipProvider>
 )}
 </div>
 <div className="ml-2 shrink-0">
 {isSelected ? (
 <CheckCircle2 className="h-4 w-4 text-primary" />
 ) : (
 <Square className="h-4 w-4 text-muted-foreground" />
 )}
 </div>
 </div>
 {(maintenance.machine || maintenance.unidadMovil) && (
 <p className="text-xs text-muted-foreground mb-1">
 {maintenance.machine ? `Máquina: ${maintenance.machine.name}` : `Unidad: ${maintenance.unidadMovil.nombre}`}
 </p>
 )}
 {/* Componente principal */}
 {maintenance.component && (
 <p className="text-xs text-muted-foreground mb-1">
 Componente: {maintenance.component.name}
 </p>
 )}
 {/* Componentes (array) */}
 {maintenance.components && Array.isArray(maintenance.components) && maintenance.components.length > 0 && (
 <div className="mb-1">
 <p className="text-xs text-muted-foreground">
 Componentes: {maintenance.components.slice(0, 2).map((c: any) => c.name || c).join(', ')}
 {maintenance.components.length > 2 && ` +${maintenance.components.length - 2}`}
 </p>
 </div>
 )}
 {/* Subcomponentes */}
 {maintenance.subcomponents && Array.isArray(maintenance.subcomponents) && maintenance.subcomponents.length > 0 && (
 <div className="mb-1">
 <p className="text-xs text-muted-foreground">
 Subcomponentes: {maintenance.subcomponents.slice(0, 2).map((s: any) => s.name || s).join(', ')}
 {maintenance.subcomponents.length > 2 && ` +${maintenance.subcomponents.length - 2}`}
 </p>
 </div>
 )}
 {maintenance.description && (
 <p className="text-xs text-muted-foreground mb-2 line-clamp-2 mt-1">
 {maintenance.description}
 </p>
 )}
 <div className="flex items-center gap-2 flex-wrap">
 <Badge variant="default" className="text-xs px-1.5 py-0">Preventivo</Badge>
 {timeDisplay && (
 <Badge variant="outline" className="text-xs px-1.5 py-0">{timeDisplay}</Badge>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 ) : (
 <div className="h-[550px] overflow-y-auto pr-2">
 <div className="space-y-2 p-2">
 {filteredMaintenances.map((maintenance: any) => {
 const isSelected = selectedMaintenances.includes(maintenance.id);
 const timeDisplay = (() => {
 if (maintenance.unidadMovilId || maintenance.unidadMovil) {
 if (maintenance.estimatedMinutes && maintenance.estimatedMinutes > 0) {
 if (maintenance.estimatedTimeType === 'HOURS') {
 const hours = Math.floor(maintenance.estimatedMinutes / 60);
 const minutes = maintenance.estimatedMinutes % 60;
 return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
 }
 return `${maintenance.estimatedMinutes}m`;
 }
 }
 if (maintenance.timeValue && maintenance.timeUnit) {
 return maintenance.timeUnit === 'MINUTES' 
 ? `${maintenance.timeValue} min`
 : `${maintenance.timeValue} h`;
 }
 return null;
 })();

 return (
 <div
 key={maintenance.id}
 className={cn(
 'p-2.5 border rounded-md cursor-pointer transition-colors flex items-start gap-3',
 isSelected
 ? 'border-primary bg-primary/5'
 : 'border-border hover:border-primary/50 hover:bg-muted/50'
 )}
 onClick={() => toggleMaintenanceSelection(maintenance)}
 >
 <div className="mt-0.5">
 {isSelected ? (
 <CheckCircle2 className="h-4 w-4 text-primary" />
 ) : (
 <Square className="h-4 w-4 text-muted-foreground" />
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <div className="flex items-center gap-1.5">
 <h4 className="font-medium text-xs">{maintenance.title}</h4>
 {maintenance.description && (
 <TooltipProvider delayDuration={200}>
 <Tooltip>
 <TooltipTrigger asChild>
 <button
 type="button"
 onClick={(e) => e.stopPropagation()}
 className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
 >
 <Info className="h-3 w-3" />
 </button>
 </TooltipTrigger>
 <TooltipContent side="top" className="max-w-sm p-3 bg-popover border shadow-lg">
 <div className="space-y-1.5">
 <p className="text-xs font-semibold text-foreground">Descripción</p>
 <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{maintenance.description}</p>
 </div>
 </TooltipContent>
 </Tooltip>
 </TooltipProvider>
 )}
 </div>
 <Badge variant="default" className="text-xs px-1.5 py-0">Preventivo</Badge>
 {timeDisplay && (
 <Badge variant="outline" className="text-xs px-1.5 py-0">{timeDisplay}</Badge>
 )}
 </div>
 {(maintenance.machine || maintenance.unidadMovil) && (
 <p className="text-xs text-muted-foreground mt-0.5">
 {maintenance.machine ? `Máquina: ${maintenance.machine.name}` : `Unidad: ${maintenance.unidadMovil.nombre}`}
 </p>
 )}
 {/* Componente principal */}
 {maintenance.component && (
 <p className="text-xs text-muted-foreground mt-0.5">
 Componente: {maintenance.component.name}
 </p>
 )}
 {/* Componentes (array) */}
 {maintenance.components && Array.isArray(maintenance.components) && maintenance.components.length > 0 && (
 <p className="text-xs text-muted-foreground mt-0.5">
 Componentes: {maintenance.components.slice(0, 2).map((c: any) => c.name || c).join(', ')}
 {maintenance.components.length > 2 && ` +${maintenance.components.length - 2}`}
 </p>
 )}
 {/* Subcomponentes */}
 {maintenance.subcomponents && Array.isArray(maintenance.subcomponents) && maintenance.subcomponents.length > 0 && (
 <p className="text-xs text-muted-foreground mt-0.5">
 Subcomponentes: {maintenance.subcomponents.slice(0, 2).map((s: any) => s.name || s).join(', ')}
 {maintenance.subcomponents.length > 2 && ` +${maintenance.subcomponents.length - 2}`}
 </p>
 )}
 {maintenance.description && (
 <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
 {maintenance.description}
 </p>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}
 </div>
 </CardContent>
 </Card>

 {/* DERECHA - Seleccionados (40%) */}
 <Card>
 <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
 <div className="flex items-center justify-between">
 <CardTitle className="text-sm font-semibold">
 Seleccionados ({selectedMaintenances.length})
 </CardTitle>
 {selectedMaintenances.length > 0 && (
 <Button
 variant="ghost"
 size="sm"
 onClick={() => {
 setSelectedMaintenances([]);
 setFormData(prev => ({ ...prev, phases: [] }));
 }}
 className="h-7 text-xs"
 >
 <X className="h-3.5 w-3.5 mr-1.5" />
 Limpiar
 </Button>
 )}
 </div>
 </CardHeader>
 <CardContent className="px-4 pt-0 pb-4 sm:px-6 sm:pb-6">
 <div className="border rounded-lg">
 {selectedMaintenances.length === 0 ? (
 <div className="text-center py-12 text-muted-foreground">
 <CheckSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
 <p className="text-xs font-medium">No hay elementos seleccionados</p>
 <p className="text-xs mt-1">Selecciona mantenimientos de la lista</p>
 </div>
 ) : (
 <div className="h-[665px] overflow-y-auto pr-2">
 <div className="space-y-2 p-2">
 {availableMaintenances
 .filter((m: any) => selectedMaintenances.includes(m.id))
 .map((maintenance: any) => (
 <div
 key={maintenance.id}
 className="flex items-start justify-between gap-2 p-2.5 border rounded-md bg-muted/30"
 >
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-1.5">
 <h4 className="font-medium text-xs line-clamp-1">{maintenance.title}</h4>
 {maintenance.description && (
 <TooltipProvider delayDuration={200}>
 <Tooltip>
 <TooltipTrigger asChild>
 <button
 type="button"
 onClick={(e) => e.stopPropagation()}
 className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
 >
 <Info className="h-3 w-3" />
 </button>
 </TooltipTrigger>
 <TooltipContent side="top" className="max-w-sm p-3 bg-popover border shadow-lg">
 <div className="space-y-1.5">
 <p className="text-xs font-semibold text-foreground">Descripción</p>
 <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{maintenance.description}</p>
 </div>
 </TooltipContent>
 </Tooltip>
 </TooltipProvider>
 )}
 </div>
 {(maintenance.machine || maintenance.unidadMovil) && (
 <p className="text-xs text-muted-foreground mt-0.5">
 {maintenance.machine ? `Máquina: ${maintenance.machine.name}` : `Unidad: ${maintenance.unidadMovil.nombre}`}
 </p>
 )}
 {/* Componente principal */}
 {maintenance.component && (
 <p className="text-xs text-muted-foreground mt-0.5">
 Componente: {maintenance.component.name}
 </p>
 )}
 {/* Componentes (array) */}
 {maintenance.components && Array.isArray(maintenance.components) && maintenance.components.length > 0 && (
 <p className="text-xs text-muted-foreground mt-0.5">
 Componentes: {maintenance.components.slice(0, 2).map((c: any) => c.name || c).join(', ')}
 {maintenance.components.length > 2 && ` +${maintenance.components.length - 2}`}
 </p>
 )}
 {/* Subcomponentes */}
 {maintenance.subcomponents && Array.isArray(maintenance.subcomponents) && maintenance.subcomponents.length > 0 && (
 <p className="text-xs text-muted-foreground mt-0.5">
 Subcomponentes: {maintenance.subcomponents.slice(0, 2).map((s: any) => s.name || s).join(', ')}
 {maintenance.subcomponents.length > 2 && ` +${maintenance.subcomponents.length - 2}`}
 </p>
 )}
 </div>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => toggleMaintenanceSelection(maintenance)}
 className="h-6 w-6 p-0 shrink-0"
 >
 <X className="h-3.5 w-3.5" />
 </Button>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </CardContent>
 </Card>
 </div>
 </div>
 </TabsContent>

 <TabsContent value="instructives" className="mt-0">
 <div className="space-y-4 pb-4">
 {/* Layout 2 columnas */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 {/* IZQUIERDA - Lista de instructivos */}
 <Card>
 <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
 <CardTitle className="text-sm font-semibold">
 Instructivos ({instructives.length})
 </CardTitle>
 </CardHeader>
 <CardContent className="px-4 pt-0 pb-4 sm:px-6 sm:pb-6">
 {instructives.length === 0 ? (
 <div className="text-center py-12 text-muted-foreground">
 <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
 <p className="text-xs font-medium">No hay instructivos creados</p>
 <p className="text-xs mt-1">Crea el primer instructivo a la derecha</p>
 </div>
 ) : (
 <div className="h-[280px] overflow-y-auto pr-2">
 <div className="space-y-2">
 {instructives.map((instructive, index) => (
 <div
 key={instructive.id}
 className="border rounded-lg p-3 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
 onClick={() => setCurrentInstructive({ title: instructive.title, content: instructive.content })}
 >
 <div className="flex items-start justify-between">
 <div className="flex-1 min-w-0">
 <h5 className="font-medium text-xs line-clamp-1">{instructive.title}</h5>
 <div 
 className="text-xs text-muted-foreground mt-1.5 line-clamp-2"
 dangerouslySetInnerHTML={{ __html: sanitizeHtml(instructive.content.replace(/<[^>]*>/g, '').substring(0, 100) + '...') }}
 />
 </div>
 <Button
 type="button"
 variant="ghost"
 size="sm"
 onClick={(e) => {
 e.stopPropagation();
 setInstructives(prev => prev.filter((_, i) => i !== index));
 toast({
 title: 'Instructivo eliminado',
 description: 'El instructivo ha sido eliminado'
 });
 }}
 className="text-destructive hover:bg-destructive/10 h-7 w-7 p-0 shrink-0 ml-2"
 >
 <X className="h-3.5 w-3.5" />
 </Button>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </CardContent>
 </Card>

 {/* DERECHA - Editor de instructivo */}
 <Card>
 <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
 <CardTitle className="text-sm font-semibold">
 {instructives.length > 0 && currentInstructive.title ? 'Editar Instructivo' : 'Crear Instructivo'}
 </CardTitle>
 <p className="text-xs text-muted-foreground mt-1">
 Puedes pegar imágenes con Ctrl+V o Cmd+V
 </p>
 </CardHeader>
 <CardContent className="px-4 pt-0 pb-4 space-y-4 sm:px-6 sm:pb-6">
 <div className="space-y-1.5">
 <Label htmlFor="instructiveTitle" className="text-xs font-medium">Título del instructivo *</Label>
 <Input
 id="instructiveTitle"
 value={currentInstructive.title}
 onChange={(e) => setCurrentInstructive({ ...currentInstructive, title: e.target.value })}
 placeholder="Ej: Procedimiento de limpieza de filtros"
 className="text-sm"
 />
 </div>

 <div className="space-y-1.5">
 <Label htmlFor="instructiveContent" className="text-xs font-medium">Contenido del instructivo *</Label>
 <div className="border rounded-md">
 <RichTextEditor
 value={currentInstructive.content}
 onChange={(content) => setCurrentInstructive({ ...currentInstructive, content })}
 placeholder="Escribe el contenido del instructivo aquí... Puedes pegar imágenes con Ctrl+V o Cmd+V"
 />
 </div>
 </div>

 <Button
 type="button"
 onClick={() => {
 if (!currentInstructive.title.trim() || !currentInstructive.content.trim()) {
 toast({
 title: 'Error',
 description: 'Por favor completa el título y el contenido del instructivo',
 variant: 'destructive'
 });
 return;
 }
 
 const newInstructive = {
 id: `instructive_${Date.now()}`,
 title: currentInstructive.title,
 content: currentInstructive.content
 };
 
 setInstructives(prev => [...prev, newInstructive]);
 setCurrentInstructive({ title: '', content: '' });
 
 toast({
 title: 'Instructivo agregado',
 description: 'El instructivo ha sido agregado correctamente'
 });
 }}
 className="w-full h-9 text-xs"
 disabled={!currentInstructive.title.trim() || !currentInstructive.content.trim()}
 >
 <Plus className="h-3.5 w-3.5 mr-2" />
 {currentInstructive.title ? 'Actualizar' : 'Agregar'} Instructivo
 </Button>
 </CardContent>
 </Card>
 </div>
 </div>
 </TabsContent>

 <TabsContent value="preview" className="mt-0">
 <div className="space-y-4 pb-4">
 {/* Header de resumen con chips */}
 <div className="border rounded-lg p-4 bg-muted/30">
 <div className="flex items-center justify-between flex-wrap gap-3">
 <div>
 <h3 className="text-base font-semibold">{formData.title || 'Título del Checklist'}</h3>
 {formData.description && (
 <p className="text-xs text-muted-foreground mt-1">{formData.description}</p>
 )}
 </div>
 <div className="flex flex-wrap gap-2">
 <Badge className={getCategoryColor(formData.category)}>
 {getCategoryLabel(formData.category)}
 </Badge>
 <Badge variant="outline">
 {getFrequencyLabel(formData.frequency)}
 </Badge>
 {formData.sectorId && formData.sectorId !== 'all' && (
 <Badge variant="outline">
 {availableSectors.find(s => s.id.toString() === formData.sectorId)?.name || 'Sector'}
 </Badge>
 )}
 <Badge variant={formData.isActive ? 'default' : 'secondary'}>
 {formData.isActive ? 'Activo' : 'Inactivo'}
 </Badge>
 </div>
 </div>
 </div>

 {/* Cards de resumen */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Card Datos Básicos */}
 <Card>
 <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
 <CardTitle className="text-sm font-semibold">Datos Básicos</CardTitle>
 </CardHeader>
 <CardContent className="px-4 pt-0 pb-4 space-y-2 text-xs sm:px-6 sm:pb-6">
 <div className="flex justify-between">
 <span className="text-muted-foreground">Título:</span>
 <span className="font-medium">{formData.title || 'Sin título'}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Categoría:</span>
 <span className="font-medium">{getCategoryLabel(formData.category)}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Frecuencia:</span>
 <span className="font-medium">{getFrequencyLabel(formData.frequency)}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Sector:</span>
 <span className="font-medium">
 {formData.sectorId && formData.sectorId !== 'all'
 ? availableSectors.find(s => s.id.toString() === formData.sectorId)?.name || 'Todos'
 : 'Todos los sectores'}
 </span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Estado:</span>
 <Badge variant={formData.isActive ? 'default' : 'secondary'} className="text-xs">
 {formData.isActive ? 'Activo' : 'Inactivo'}
 </Badge>
 </div>
 </CardContent>
 </Card>

 {/* Card Elementos Seleccionados */}
 <Card>
 <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
 <CardTitle className="text-sm font-semibold">Elementos Seleccionados</CardTitle>
 </CardHeader>
 <CardContent className="px-4 pt-0 pb-4 space-y-2 sm:px-6 sm:pb-6">
 <div className="flex items-center justify-between">
 <span className="text-xs text-muted-foreground">Mantenimientos:</span>
 <Badge variant="outline" className="text-xs">
 {selectedMaintenances.length}
 </Badge>
 </div>
 {phases && phases.length > 0 && (
 <div className="flex items-center justify-between">
 <span className="text-xs text-muted-foreground">Fases:</span>
 <Badge variant="outline" className="text-xs">
 {phases.length}
 </Badge>
 </div>
 )}
 {(() => {
 let totalMinutes = 0;
 if (phases && phases.length > 0) {
 totalMinutes = phases.reduce((total, phase) => {
 return total + phase.items.reduce((phaseTotal, item) => {
 if (item.isMaintenanceItem && item.maintenanceId) {
 const originalMaintenance = availableMaintenances.find(m => m.id === item.maintenanceId);
 if (originalMaintenance?.timeValue && originalMaintenance?.timeUnit) {
 if (originalMaintenance.timeUnit === 'MINUTES') {
 return phaseTotal + originalMaintenance.timeValue;
 } else if (originalMaintenance.timeUnit === 'HOURS') {
 return phaseTotal + (originalMaintenance.timeValue * 60);
 }
 }
 }
 return phaseTotal + (item.estimatedTime || 0);
 }, 0);
 }, 0);
 }
 const hours = Math.floor(totalMinutes / 60);
 const minutes = totalMinutes % 60;
 const timeDisplay = hours > 0 ? (minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`) : `${minutes}min`;
 
 return (
 <div className="flex items-center justify-between">
 <span className="text-xs text-muted-foreground">Tiempo estimado:</span>
 <Badge variant="outline" className="text-xs">
 {timeDisplay}
 </Badge>
 </div>
 );
 })()}
 </CardContent>
 </Card>

 {/* Card Instructivos */}
 <Card>
 <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
 <CardTitle className="text-sm font-semibold">Instructivos</CardTitle>
 </CardHeader>
 <CardContent className="px-4 pt-0 pb-4 sm:px-6 sm:pb-6">
 <div className="flex items-center justify-between">
 <span className="text-xs text-muted-foreground">Total:</span>
 <Badge variant="outline" className="text-xs">
 {instructives.length}
 </Badge>
 </div>
 </CardContent>
 </Card>

 {/* Card Resumen Final */}
 <Card>
 <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
 <CardTitle className="text-sm font-semibold">Resumen</CardTitle>
 </CardHeader>
 <CardContent className="px-4 pt-0 pb-4 space-y-2 text-xs sm:px-6 sm:pb-6">
 <div className="flex justify-between">
 <span className="text-muted-foreground">Mantenimientos seleccionados:</span>
 <span className="font-medium">{selectedMaintenances.length}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Fases configuradas:</span>
 <span className="font-medium">{phases?.length || 0}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Instructivos:</span>
 <span className="font-medium">{instructives.length}</span>
 </div>
 </CardContent>
 </Card>
 </div>
 </div>
 </TabsContent>
 </Tabs>
 </div>

 {/* FOOTER STICKY */}
 <div className="flex-shrink-0 bg-background border-t border-border/60 px-4 py-2 sm:px-6 sm:py-3">
 <div className="flex justify-between items-center gap-4">
 <Button variant="ghost" onClick={onClose} className="text-xs shrink-0 text-muted-foreground hover:text-foreground">
 Cancelar
 </Button>
 
 <div className="flex gap-2 shrink-0">
 {/* Botón Anterior */}
 {activeTab !== 'basic' && (
 <Button
 variant="outline"
 size="lg"
 onClick={handlePrevious}
 className="text-xs whitespace-nowrap"
 >
 <ChevronLeft className="h-3.5 w-3.5 mr-1.5 shrink-0" />
 Anterior
 </Button>
 )}
 
 {/* Botón Siguiente o Crear */}
 {activeTab !== 'preview' && (
 <Button
 size="lg"
 onClick={handleNext}
 className="text-xs whitespace-nowrap"
 >
 Siguiente
 <ChevronRight className="h-3.5 w-3.5 ml-1.5 shrink-0" />
 </Button>
 )}
 
 {activeTab === 'preview' && (
 <Button size="lg" onClick={handleSubmit} disabled={loading} className="text-xs whitespace-nowrap">
 {loading ? (
 <>
 <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
 Guardando...
 </>
 ) : (
 <>
 <Save className="h-3.5 w-3.5 mr-2" />
 {mode === 'edit' ? 'Actualizar' : 'Crear'} Checklist
 </>
 )}
 </Button>
 )}
 </div>
 </div>
 </div>
 </DialogContent>

 {/* Diálogo de Fases */}
 <ChecklistPhaseDialog
 isOpen={showPhaseDialog}
 onClose={() => setShowPhaseDialog(false)}
 onSave={handlePhasesSave}
 />
 </Dialog>
 );
}
