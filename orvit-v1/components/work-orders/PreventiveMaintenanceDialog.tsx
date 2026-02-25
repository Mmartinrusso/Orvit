'use client';

import { useState, useEffect, useRef } from 'react';
import { Machine, MachineComponent, Priority, ExecutionWindow, TimeUnit } from '@/lib/types';
import { EquipmentStep } from './preventive-steps/EquipmentStep';
import { GeneralStep } from './preventive-steps/GeneralStep';
import { ToolsStep } from './preventive-steps/ToolsStep';
import { InstructivesStep } from './preventive-steps/InstructivesStep';
import { ScheduleStep } from './preventive-steps/ScheduleStep';
import { SummaryStep } from './preventive-steps/SummaryStep';
import type { ToolRequest } from './preventive-steps/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '@/components/ui/dialog';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Calendar,
  Clock,
  Wrench,
  Settings,
  User,
  X,
  Search,
  Cog,
  History,
  ChevronLeft,
  ChevronRight,
  Save,
  Loader2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMachinesInitial } from '@/hooks/use-machines-initial';
import { Step, Stepper } from '@/components/ui/stepper';
import { MaintenanceSummaryBar } from './MaintenanceSummaryBar';
import ComponentDialog from '@/components/maquinas/ComponentDialog';

interface PreventiveMaintenanceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: any) => void;
  editingMaintenance?: any; // Datos del mantenimiento a editar
  mode?: 'create' | 'edit'; // Modo del diálogo
  preselectedMachineId?: number; // ID de la máquina preseleccionada
  preselectedComponentId?: string | number; // ID del componente (nivel 1) preseleccionado
  preselectedParentComponentId?: string; // ID del componente padre preseleccionado
  preselectedSubcomponentId?: string | number; // ID del subcomponente preseleccionado
}

// ✅ OPTIMIZACIÓN: Desactivar logs en producción
const DEBUG = false;
const log = DEBUG ? (...args: unknown[]) => { /* debug */ } : () => {};

export default function PreventiveMaintenanceDialog({
  isOpen,
  onClose,
  onSave,
  editingMaintenance,
  mode = 'create',
  preselectedMachineId,
  preselectedComponentId,
  preselectedParentComponentId,
  preselectedSubcomponentId,
}: PreventiveMaintenanceDialogProps) {
  const { currentCompany, currentSector } = useCompany();
  const { user } = useAuth();

  // Función para formatear fecha en formato dd/mm/yyyy
  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return '';
    
    // Formateando fecha
    
    // Crear la fecha usando la fecha local sin considerar zona horaria
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    // Fecha creada y extraída
    
    if (isNaN(date.getTime())) return '';
    
    const dayFormatted = date.getDate().toString().padStart(2, '0');
    const monthFormatted = (date.getMonth() + 1).toString().padStart(2, '0');
    const yearFormatted = date.getFullYear();
    
    const result = `${dayFormatted}/${monthFormatted}/${yearFormatted}`;
    // Resultado formateado
    
    return result;
  };

  // Función para asegurar que la fecha se guarde en la zona horaria local
  const ensureLocalDate = (dateString: string) => {
    if (!dateString) return '';
    
    // Crear la fecha usando la fecha local sin considerar zona horaria
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    // Asegurar que se use la fecha local
    const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return localDate.toISOString().split('T')[0];
  };

  // Definir pasos del wizard
  const wizardSteps: Step[] = [
    { id: 'equipment', label: 'Equipamiento', description: 'Selección de máquina y componentes' },
    { id: 'general', label: 'General', description: 'Información básica' },
    { id: 'tools', label: 'Herramientas', description: 'Productos necesarios' },
    { id: 'instructives', label: 'Instructivos', description: 'Documentación' },
    { id: 'schedule', label: 'Programación', description: 'Frecuencia y alertas' },
    { id: 'summary', label: 'Resumen', description: 'Revisión final' }
  ];

  // Funciones para navegación entre pestañas
  const handleNextTab = () => {
    const tabs = ['equipment', 'general', 'tools', 'instructives', 'schedule', 'summary'];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1]);
    }
  };

  const handlePreviousTab = () => {
    const tabs = ['equipment', 'general', 'tools', 'instructives', 'schedule', 'summary'];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1]);
    }
  };

  const isLastTab = () => {
    return activeTab === 'summary';
  };

  const canGoToStep = (stepId: string) => {
    const tabs = ['equipment', 'general', 'tools', 'instructives', 'schedule', 'summary'];
    const currentIndex = tabs.indexOf(activeTab);
    const targetIndex = tabs.indexOf(stepId);
    
    // Si es el mismo paso, no hacer nada (aunque técnicamente no debería llamarse)
    if (targetIndex === currentIndex) {
      return false;
    }
    
    // Permitir ir a cualquier paso anterior (siempre, sin restricciones)
    if (targetIndex < currentIndex) {
      return true;
    }
    
    // Para pasos futuros, permitir siempre (navegación libre como tabs)
    // El usuario puede navegar libremente y la validación se hará al guardar
    return true;
  };

  // Estados del formulario
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: Priority.MEDIUM,
    frequencyDays: 30,
    machineId: preselectedMachineId ? preselectedMachineId.toString() : '',
    componentIds: (() => {
      const ids: string[] = [];
      if (preselectedComponentId) ids.push(preselectedComponentId.toString());
      // Solo agregar el padre si es diferente al componentId (evitar duplicados)
      if (preselectedParentComponentId && preselectedParentComponentId !== preselectedComponentId?.toString()) {
        ids.push(preselectedParentComponentId);
      }
      return ids;
    })(),
    subcomponentIds: preselectedSubcomponentId ? [preselectedSubcomponentId.toString()] : [] as string[],
    assignedToId: 'none',
    startDate: (() => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    })(), // Fecha de mañana por defecto
    notes: '',
    alertDaysBefore: [3, 2, 1, 0] as number[], // Alertas: 3, 2, 1 día antes y el mismo día
    isActive: true,
    executionWindow: 'NONE' as ExecutionWindow,
    timeUnit: 'MINUTES' as TimeUnit,
    timeValue: 30
  });

  // Estado para el display de la fecha
  const [dateDisplay, setDateDisplay] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDateForDisplay(tomorrow.toISOString().split('T')[0]);
  });

  // ✨ OPTIMIZADO: Usar hook con React Query para máquinas
  const companyIdNum = currentCompany?.id ? parseInt(String(currentCompany.id)) : null;
  const sectorIdNum = currentSector?.id ? parseInt(String(currentSector.id)) : null;
  const { data: machinesData } = useMachinesInitial(
    companyIdNum,
    sectorIdNum,
    { enabled: isOpen && !!companyIdNum }
  );
  const machines = (machinesData?.machines || []) as Machine[];

  // Estados para datos
  const [components, setComponents] = useState<MachineComponent[]>([]);
  const [subcomponents, setSubcomponents] = useState<MachineComponent[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const [selectedTools, setSelectedTools] = useState<ToolRequest[]>([]);
  const [selectedSpareParts, setSelectedSpareParts] = useState<any[]>([]);
  const [toolSearchTerm, setToolSearchTerm] = useState('');
  const [machineSpares, setMachineSpares] = useState<any[]>([]);
  const [spareSearchTerm, setSpareSearchTerm] = useState('');
  const [instructives, setInstructives] = useState<any[]>([]);
  const [uploadingInstructive, setUploadingInstructive] = useState(false);
  const [instructiveDescription, setInstructiveDescription] = useState('');

  // Estados de carga
  const [loading, setLoading] = useState(false);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [loadingSubcomponents, setLoadingSubcomponents] = useState(false);
  const [loadingTools, setLoadingTools] = useState(false);
  const [loadingSpares, setLoadingSpares] = useState(false);

  // Estado para errores de validación visual
  const [validationErrors, setValidationErrors] = useState<{
    title?: string;
    machineId?: string;
    frequencyDays?: string;
    startDate?: string;
    alertDaysBefore?: string;
  }>({});

  // Estado para la pestaña activa
  const [activeTab, setActiveTab] = useState('equipment');
  
  // Estados para el historial
  const [maintenanceHistory, setMaintenanceHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  // Función para cargar el historial de mantenimientos
  const loadMaintenanceHistory = async (machineId: number, componentIds?: string[], subcomponentIds?: string[]) => {
    try {
      log('🔍 Cargando mantenimientos para máquina:', machineId, 'componentes:', componentIds, 'subcomponentes:', subcomponentIds);
      setLoadingHistory(true);
      
      // Usar la API de preventivos para obtener los mantenimientos programados
      const url = `/api/maintenance/preventive?companyId=${currentCompany?.id}`;
      log('🔍 URL de preventivos:', url);
      
      const response = await fetch(url);
      log('🔍 Respuesta del servidor:', response.status, response.ok ? 'OK' : 'ERROR');
      
      if (response.ok) {
        const data = await response.json();
        log('🔍 Datos recibidos:', data);
        
        // Filtrar por máquina
        const machineMaintenances = data.filter((m: any) => {
          const templateMachineId = m.machineId ? Number(m.machineId) : null;
          return templateMachineId === Number(machineId);
        });
        
        log('🔍 Mantenimientos de la máquina:', machineMaintenances.length);
        
        // Si hay componentes seleccionados, filtrar también por componente
        let filteredMaintenances = machineMaintenances;
        if (componentIds && componentIds.length > 0) {
          filteredMaintenances = machineMaintenances.filter((m: any) => {
            const templateComponentIds = m.componentIds || [];
            return templateComponentIds.length === 0 || 
                   componentIds.some(cId => templateComponentIds.includes(Number(cId)));
          });
        }
        
        log('🔍 Mantenimientos filtrados:', filteredMaintenances.length);
        
        // Transformar a formato de historial
        const historyData = filteredMaintenances.map((m: any) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          type: 'PREVENTIVE_TEMPLATE',
          status: m.lastMaintenanceDate ? 'COMPLETED' : 'PENDING',
          completionStatus: m.lastMaintenanceDate ? 'COMPLETED' : 'PENDING',
          machineName: m.machineName,
          componentName: m.componentNames?.join(', ') || null,
          componentNames: m.componentNames || [],
          subcomponentNames: m.subcomponentNames || [],
          executedAt: m.lastMaintenanceDate || m.nextMaintenanceDate,
          scheduledDate: m.nextMaintenanceDate,
          assignedToName: m.assignedToName || m.lastExecutedBy,
          frequencyDays: m.frequencyDays,
          priority: m.priority || 'MEDIUM',
          executionWindow: m.executionWindow || 'ANY_TIME',
          timeValue: m.timeValue,
          timeUnit: m.timeUnit,
          notes: m.notes || '',
          maintenanceCount: m.maintenanceCount || 0
        }));
        
        setMaintenanceHistory(historyData);
      } else {
        console.error('Error cargando mantenimientos:', response.statusText);
        setMaintenanceHistory([]);
      }
    } catch (error) {
      console.error('Error cargando mantenimientos:', error);
      setMaintenanceHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Resetear pestaña activa cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setActiveTab('equipment');
    }
  }, [isOpen]);


  // ✨ OPTIMIZADO: Máquinas vienen del hook, solo cargar usuarios y herramientas
  useEffect(() => {
    if (isOpen && currentCompany) {
      // fetchMachines(); // ✨ Ya no es necesario, viene del hook
      fetchUsers();
      fetchTools();
      
      // Si estamos editando o duplicando, cargar los datos del mantenimiento
      if (editingMaintenance) {
        loadMaintenanceData(editingMaintenance).catch(error => {
          console.error('❌ Error cargando datos de mantenimiento:', error);
        });
      }
    } else if (!isOpen) {
      // Resetear formulario cuando se cierra el modal
      resetForm();
    }
  }, [isOpen, currentCompany, editingMaintenance]);

  // Sincronizar el display de la fecha cuando cambie formData.startDate
  useEffect(() => {
    setDateDisplay(formatDateForDisplay(formData.startDate));
  }, [formData.startDate]);

  // Log para debugging del formData
  useEffect(() => {
    if (mode === 'edit' && formData.componentIds && formData.componentIds.length > 0) {
      log('🔍 FormData actualizado en modo edición:', {
        componentIds: formData.componentIds,
        subcomponentIds: formData.subcomponentIds,
        executionWindow: formData.executionWindow,
        timeUnit: formData.timeUnit,
        timeValue: formData.timeValue
      });
    }
  }, [formData.componentIds, formData.subcomponentIds, formData.executionWindow, formData.timeUnit, formData.timeValue, mode]);

  // Refs para detectar cambios reales vs mount inicial
  const prevMachineIdRef = useRef<string | null>(null);
  const prevComponentIdsRef = useRef<string | null>(null);

  // Cargar componentes cuando se selecciona una máquina (solo en modo creación sin datos previos)
  useEffect(() => {
    if (formData.machineId && !editingMaintenance) {
      fetchComponents(formData.machineId);
      // Solo resetear componentes si la máquina realmente cambió (no en el primer render)
      if (prevMachineIdRef.current !== null && prevMachineIdRef.current !== formData.machineId) {
        setFormData(prev => ({ ...prev, componentIds: [], subcomponentIds: [] }));
        prevComponentIdsRef.current = null; // Resetear también el ref de componentes
      }
      prevMachineIdRef.current = formData.machineId;
    }
  }, [formData.machineId, editingMaintenance]);

  // Cargar subcomponentes cuando se selecciona un componente (solo en modo creación sin datos previos)
  useEffect(() => {
    if (formData.componentIds.length > 0 && !editingMaintenance) {
      // Cargar subcomponentes para el primer componente seleccionado
      fetchSubcomponents(formData.componentIds[0]);
      // Solo resetear subcomponentes si los componentes realmente cambiaron (no en el primer render)
      const currentComponentKey = formData.componentIds.join(',');
      if (prevComponentIdsRef.current !== null && prevComponentIdsRef.current !== currentComponentKey) {
        setFormData(prev => ({ ...prev, subcomponentIds: [] }));
      }
      prevComponentIdsRef.current = currentComponentKey;
    }
  }, [formData.componentIds, editingMaintenance]);

  // Cargar repuestos específicos cuando se selecciona máquina o componente
  useEffect(() => {
    if (formData.machineId) {
      const firstComponentId = formData.componentIds.length > 0 ? formData.componentIds[0] : undefined;
      fetchMachineSpares(formData.machineId, firstComponentId);
    }
  }, [formData.machineId, formData.componentIds]);

  // ✨ OPTIMIZADO: fetchMachines ya no es necesario, las máquinas vienen del hook useMachinesInitial

  const fetchComponents = async (machineId: string) => {
    // No cargar componentes para unidades móviles
    if (machineId && machineId.toString().startsWith('mobile-')) {
      log('🔍 Es una unidad móvil, no se cargan componentes');
      setComponents([]);
      return;
    }

    setLoadingComponents(true);
    try {
      const response = await fetch(`/api/maquinas/${machineId}/components`);
      if (response.ok) {
        const data = await response.json();
        setComponents(data);
      } else {
        console.error('Error al obtener componentes:', response.status);
      }
    } catch (error) {
      console.error('Error fetching components:', error);
    } finally {
      setLoadingComponents(false);
    }
  };

  const fetchSubcomponents = async (componentId: string) => {
    setLoadingSubcomponents(true);
    try {
      const response = await fetch(`/api/components/${componentId}/subcomponents`);
      if (response.ok) {
        const data = await response.json();
        setSubcomponents(data);
      } else {
        console.error('Error al obtener subcomponentes:', response.status);
      }
    } catch (error) {
      console.error('Error fetching subcomponents:', error);
    } finally {
      setLoadingSubcomponents(false);
    }
  };

  // Estados para el dialog de creación de componente/subcomponente
  const [showComponentDialog, setShowComponentDialog] = useState(false);
  const [componentDialogMode, setComponentDialogMode] = useState<'component' | 'subcomponent'>('component');
  const [pendingComponentName, setPendingComponentName] = useState('');

  // Abre el ComponentDialog con el nombre pre-cargado
  const handleCreateComponent = (name: string) => {
    setPendingComponentName(name);
    setComponentDialogMode('component');
    setShowComponentDialog(true);
  };

  const handleCreateSubcomponent = (name: string) => {
    if (!formData.componentIds[0]) return;
    setPendingComponentName(name);
    setComponentDialogMode('subcomponent');
    setShowComponentDialog(true);
  };

  // Callback del ComponentDialog: llama API y auto-selecciona
  const handleComponentDialogSave = async (data: any) => {
    const parentId = componentDialogMode === 'subcomponent' && formData.componentIds[0]
      ? Number(formData.componentIds[0])
      : undefined;

    const response = await fetch('/api/components', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        machineId: Number(formData.machineId),
        ...(parentId ? { parentId } : {}),
      }),
    });
    if (!response.ok) throw new Error('Error al crear componente');
    const result = await response.json();
    const newId = result.component.id.toString();

    if (componentDialogMode === 'component') {
      await fetchComponents(formData.machineId);
      setFormData(prev => ({ ...prev, componentIds: [...prev.componentIds, newId] }));
    } else {
      await fetchSubcomponents(formData.componentIds[0]);
      setFormData(prev => ({ ...prev, subcomponentIds: [...prev.subcomponentIds, newId] }));
    }
    setShowComponentDialog(false);
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`/api/companies/${currentCompany?.id}/users`);
      if (response.ok) {
        const data = await response.json();
        // Asegurar que users siempre sea un array
        const usersArray = data.users || data || [];
        setUsers(Array.isArray(usersArray) ? usersArray : []);
      } else {
        console.error('Error al obtener usuarios:', response.status);
        setUsers([]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    }
  };

  const fetchTools = async () => {
    setLoadingTools(true);
    try {
      const companyId = currentCompany?.id;
      
      if (!companyId) {
        console.error('No hay companyId para herramientas');
        setAvailableTools([]);
        return;
      }
      
      // Filtrar solo herramientas (TOOL), excluir repuestos (SUPPLY)
      const response = await fetch(`/api/tools?companyId=${companyId}&itemType=TOOL`);
      
      if (response.ok) {
        const data = await response.json();
        // El endpoint devuelve { tools: [...] } no un array directo
        const toolsArray = data.tools || data || [];
        setAvailableTools(Array.isArray(toolsArray) ? toolsArray : []);
      } else {
        const errorData = await response.json();
        console.error('Error al obtener herramientas:', response.status, errorData);
        setAvailableTools([]);
      }
    } catch (error) {
      console.error('Error fetching tools:', error);
      setAvailableTools([]);
    } finally {
      setLoadingTools(false);
    }
  };

  const fetchMachineSpares = async (machineId: string, componentId?: string) => {
    // No cargar repuestos para unidades móviles
    if (machineId && machineId.toString().startsWith('mobile-')) {
      log('🔍 Es una unidad móvil, no se cargan repuestos');
      setMachineSpares([]);
      return;
    }

    setLoadingSpares(true);
    try {
      let url = `/api/machines/${machineId}/tools`;
      if (componentId && componentId !== 'none') {
        url += `?componentId=${componentId}`;
      }
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        const sparesArray = data.tools || [];
        setMachineSpares(Array.isArray(sparesArray) ? sparesArray : []);
      } else {
        const errorData = await response.json();
        console.error('Error al obtener repuestos de máquina:', response.status, errorData);
        setMachineSpares([]);
      }
    } catch (error) {
      console.error('Error fetching machine spares:', error);
      setMachineSpares([]);
    } finally {
      setLoadingSpares(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    if (field === 'startDate') {
      // Para fechas, asegurar que se use la zona horaria local
      log('🔍 Fecha seleccionada:', value);
      const localDate = ensureLocalDate(value);
      log('🔍 Fecha local procesada:', localDate);
      setFormData(prev => ({ ...prev, [field]: localDate }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const loadMaintenanceData = async (maintenance: any) => {
    
    // Extraer machineId de diferentes posibles ubicaciones
    let machineId = maintenance.machineId?.toString() || 
                    maintenance.machine?.id?.toString() || 
                    maintenance.workOrder?.machineId?.toString() || '';
    
    // Si es una unidad móvil, convertir el ID para que coincida con el formato del dropdown
    if (maintenance.unidadMovilId || maintenance.unidadMovil?.id) {
      const mobileUnitId = maintenance.unidadMovilId?.toString() || maintenance.unidadMovil?.id?.toString();
      machineId = `mobile-${mobileUnitId}`;
      log('🔍 Detectada unidad móvil, machineId convertido a:', machineId);
    }
    
    // Extraer componentIds de diferentes posibles ubicaciones
    let componentIds = [];
    if (maintenance.componentIds && Array.isArray(maintenance.componentIds)) {
      componentIds = maintenance.componentIds.map(id => id.toString());
    } else if (maintenance.component && maintenance.component.id) {
      componentIds = [maintenance.component.id.toString()];
    } else if (maintenance.workOrder?.componentIds && Array.isArray(maintenance.workOrder.componentIds)) {
      componentIds = maintenance.workOrder.componentIds.map(id => id.toString());
    }
    
    // Extraer subcomponentIds
    let subcomponentIds = [];
    if (maintenance.subcomponentIds && Array.isArray(maintenance.subcomponentIds)) {
      subcomponentIds = maintenance.subcomponentIds.map(id => id.toString());
    } else if (maintenance.workOrder?.subcomponentIds && Array.isArray(maintenance.workOrder.subcomponentIds)) {
      subcomponentIds = maintenance.workOrder.subcomponentIds.map(id => id.toString());
    }
    
    log('🔍 IDs extraídos:', { machineId, componentIds, subcomponentIds });
    log('🔍 Fuentes de datos:', {
      machineIdSource: maintenance.machineId ? 'maintenance.machineId' : 
                      maintenance.machine?.id ? 'maintenance.machine.id' : 
                      maintenance.workOrder?.machineId ? 'maintenance.workOrder.machineId' : 'none',
      componentIdsSource: maintenance.componentIds ? 'maintenance.componentIds' :
                         maintenance.component ? 'maintenance.component' :
                         maintenance.workOrder?.componentIds ? 'maintenance.workOrder.componentIds' : 'none'
    });
    
    // Extraer datos de programación de diferentes ubicaciones
    const executionWindow = maintenance.executionWindow || 
                           maintenance.workOrder?.executionWindow || 
                           'ANY_TIME';
    const timeUnit = maintenance.timeUnit || 
                    maintenance.workOrder?.timeUnit || 
                    'HOURS';
    const timeValue = maintenance.timeValue || 
                     maintenance.workOrder?.timeValue || 
                     1;
    const frequencyDays = maintenance.frequencyDays || 
                         maintenance.workOrder?.frequencyDays || 
                         30;
    
    // Extraer alertDaysBefore
    let alertDaysBefore = [3, 2, 1, 0];
    if (Array.isArray(maintenance.alertDaysBefore)) {
      alertDaysBefore = maintenance.alertDaysBefore;
    } else if (Array.isArray(maintenance.workOrder?.alertDaysBefore)) {
      alertDaysBefore = maintenance.workOrder.alertDaysBefore;
    }
    
    // Extraer assignedToId
    const assignedToId = maintenance.assignedToId?.toString() || 
                        maintenance.assignedTo?.id?.toString() || 
                        maintenance.assignedWorker?.id?.toString() || 
                        maintenance.workOrder?.assignedToId?.toString() ||
                        'none';
    
    // Extraer startDate
    let startDate = new Date().toISOString().split('T')[0];
    if (maintenance.nextMaintenanceDate) {
      startDate = new Date(maintenance.nextMaintenanceDate).toISOString().split('T')[0];
    } else if (maintenance.scheduledDate) {
      startDate = new Date(maintenance.scheduledDate).toISOString().split('T')[0];
    } else if (maintenance.workOrder?.scheduledDate) {
      startDate = new Date(maintenance.workOrder.scheduledDate).toISOString().split('T')[0];
    }
    
    const formDataToSet = {
      title: maintenance.title || '',
      description: maintenance.description || '',
      priority: maintenance.priority || Priority.MEDIUM,
      frequencyDays: frequencyDays,
      machineId: machineId,
      componentIds: componentIds,
      subcomponentIds: subcomponentIds,
      assignedToId: assignedToId,
      startDate: startDate,
      notes: maintenance.notes || '',
      alertDaysBefore: alertDaysBefore,
      isActive: maintenance.isActive !== undefined ? maintenance.isActive : true,
      executionWindow: executionWindow,
      timeUnit: timeUnit,
      timeValue: timeValue
    };
    
    log('🔍 FormData que se va a establecer:', formDataToSet);
    log('🔍 Verificación de programación:', {
      executionWindow: formDataToSet.executionWindow,
      timeUnit: formDataToSet.timeUnit,
      timeValue: formDataToSet.timeValue
    });
    setFormData(formDataToSet);

    // Cargar componentes si hay machineId y no es una unidad móvil
    if (machineId && !machineId.toString().startsWith('mobile-')) {
      try {
        log('🔍 Cargando componentes para máquina:', machineId);
        const response = await fetch(`/api/maquinas/${machineId}/components`);
        if (response.ok) {
          const componentsData = await response.json();
          setComponents(componentsData);
          log('🔍 Componentes cargados:', componentsData.length);
          log('🔍 Componentes cargados (primeros 3):', componentsData.slice(0, 3).map(c => ({ id: c.id, name: c.name })));
          
          // Cargar subcomponentes de todos los componentes seleccionados
          if (componentIds.length > 0) {
            log('🔍 Cargando subcomponentes para todos los componentes:', componentIds);
            const allSubcomponents = [];
            
            for (const componentId of componentIds) {
              try {
                const subResponse = await fetch(`/api/components/${componentId}/subcomponents`);
                if (subResponse.ok) {
                  const subcomponentsData = await subResponse.json();
                  allSubcomponents.push(...subcomponentsData);
                  log(`🔍 Subcomponentes cargados para componente ${componentId}:`, subcomponentsData.length);
                }
              } catch (error) {
                console.error(`❌ Error cargando subcomponentes para componente ${componentId}:`, error);
              }
            }
            
            setSubcomponents(allSubcomponents);
            log('🔍 Total de subcomponentes cargados:', allSubcomponents.length);
            log('🔍 Subcomponentes cargados (primeros 3):', allSubcomponents.slice(0, 3).map(s => ({ id: s.id, name: s.name })));
          }
        }
      } catch (error) {
        console.error('❌ Error cargando componentes/subcomponentes:', error);
      }
    } else if (machineId && machineId.toString().startsWith('mobile-')) {
      log('🔍 Es una unidad móvil, no se cargan componentes');
      setComponents([]);
      setSubcomponents([]);
    }

    // Cargar herramientas seleccionadas
    if (maintenance.toolsRequired || maintenance.tools) {
      const tools = maintenance.toolsRequired || maintenance.tools || [];
      log('🔍 Cargando herramientas:', tools);
      setSelectedTools(tools);
    }

    // Cargar instructivos
    log('🔍 Verificando instructivos en maintenance:', {
      hasInstructives: !!maintenance.instructives,
      hasInstructiveFiles: !!maintenance.instructiveFiles,
      instructives: maintenance.instructives,
      instructiveFiles: maintenance.instructiveFiles,
      instructivesLength: maintenance.instructives?.length || 0,
      instructiveFilesLength: maintenance.instructiveFiles?.length || 0
    });
    
    if (maintenance.instructives || maintenance.instructiveFiles) {
      const instructives = maintenance.instructives || maintenance.instructiveFiles || [];
      log('🔍 Cargando instructivos:', instructives);
      log('🔍 Instructivos mapeados:', instructives.map((file: any) => ({
        id: file.id || `temp-${Date.now()}`,
        url: file.url,
        originalName: file.originalName || file.fileName || `Instructivo ${Date.now()}`,
        fileName: file.fileName || file.originalName || `Instructivo ${Date.now()}`,
        description: file.description || '',
        uploadedAt: file.uploadedAt || new Date().toISOString(),
        isTemporary: false
      })));
      
      setInstructives(instructives.map((file: any) => ({
        id: file.id || `temp-${Date.now()}`,
        url: file.url,
        originalName: file.originalName || file.fileName || `Instructivo ${Date.now()}`,
        fileName: file.fileName || file.originalName || `Instructivo ${Date.now()}`,
        description: file.description || '',
        uploadedAt: file.uploadedAt || new Date().toISOString(),
        isTemporary: false
      })));
    } else {
      log('🔍 No se encontraron instructivos en el mantenimiento');
      setInstructives([]);
    }

    // Cargar repuestos
    if (maintenance.spareParts || maintenance.parts) {
      const parts = maintenance.spareParts || maintenance.parts || [];
      log('🔍 Cargando repuestos:', parts);
      setSelectedSpareParts(parts);
    }

    // Actualizar display de fecha
    setDateDisplay(formatDateForDisplay(startDate));
  };

  const addTool = (tool: any) => {
    if (selectedTools.find(t => t.id === tool.id)) {
      toast({
        title: 'Herramienta ya agregada',
        description: 'Esta herramienta ya está en la lista',
        variant: 'destructive'
      });
      return;
    }

    const newTool: ToolRequest = {
      id: tool.id,
      name: tool.name,
      quantity: 1,
      category: tool.category?.name || '',
      location: tool.location?.name || ''
    };

    setSelectedTools(prev => [...prev, newTool]);
    setToolSearchTerm('');
  };

  const removeTool = (toolId: string) => {
    setSelectedTools(prev => prev.filter(t => t.id !== toolId));
  };

  const updateToolQuantity = (toolId: string, quantity: number) => {
    if (quantity <= 0) {
      removeTool(toolId);
      return;
    }

    setSelectedTools(prev =>
      prev.map(t => t.id === toolId ? { ...t, quantity } : t)
    );
  };

  const validateForm = () => {
    const errors: typeof validationErrors = {};
    let firstErrorTab = '';

    // Validar título (tab: general)
    if (!formData.title.trim()) {
      errors.title = 'El título es obligatorio';
      if (!firstErrorTab) firstErrorTab = 'general';
    }

    // Validar máquina (tab: equipment)
    if (!formData.machineId) {
      errors.machineId = 'Debe seleccionar una máquina';
      if (!firstErrorTab) firstErrorTab = 'equipment';
    }

    // Validar frecuencia (tab: schedule)
    if (formData.frequencyDays < 1 || formData.frequencyDays > 365) {
      errors.frequencyDays = 'La frecuencia debe estar entre 1 y 365 días';
      if (!firstErrorTab) firstErrorTab = 'schedule';
    }

    // Validar fecha de inicio (tab: schedule)
    if (!formData.startDate) {
      errors.startDate = 'Debe seleccionar la fecha de inicio';
      if (!firstErrorTab) firstErrorTab = 'schedule';
    }

    // Validar alertas (tab: schedule)
    if (!Array.isArray(formData.alertDaysBefore) || formData.alertDaysBefore.length === 0) {
      errors.alertDaysBefore = 'Debe seleccionar al menos un día de alerta';
      if (!firstErrorTab) firstErrorTab = 'schedule';
    }

    // Actualizar errores de validación
    setValidationErrors(errors);

    // Si hay errores, mostrar toast y navegar al tab correcto
    if (Object.keys(errors).length > 0) {
      const errorMessages = Object.values(errors);
      toast({
        title: 'Errores de validación',
        description: (
          <ul className="list-disc list-inside">
            {errorMessages.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        ),
        variant: 'destructive'
      });

      // Navegar al primer tab con error
      if (firstErrorTab) {
        setActiveTab(firstErrorTab);
      }
      return false;
    }

    return true;
  };

  // Limpiar error de un campo cuando cambia su valor
  const clearFieldError = (field: keyof typeof validationErrors) => {
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Determinar si es una unidad móvil basado en el ID
      const isMobileUnit = formData.machineId && formData.machineId.toString().startsWith('mobile-');
      const actualMachineId = isMobileUnit ? 
        formData.machineId.toString().replace('mobile-', '') : 
        formData.machineId;

      const preventiveMaintenanceData = {
        ...formData,
        type: 'PREVENTIVE',
        companyId: currentCompany?.id,
        sectorId: currentSector?.id,
        createdById: user?.id,
        toolsRequired: selectedTools,
        instructives: instructives.map(inst => ({
        ...inst,
        description: inst.description || '' // Asegurar que siempre tenga descripción
      })), // Agregar instructivos
        machineId: isMobileUnit ? null : Number(actualMachineId),
        unidadMovilId: isMobileUnit ? Number(actualMachineId) : null,
        componentIds: formData.componentIds.length > 0 ? formData.componentIds.map(id => Number(id)) : [],
        subcomponentIds: formData.subcomponentIds.length > 0 ? formData.subcomponentIds.map(id => Number(id)) : [],
        assignedToId: formData.assignedToId && formData.assignedToId !== 'none' ? Number(formData.assignedToId) : null,
        frequencyDays: Number(formData.frequencyDays),
        alertDaysBefore: formData.alertDaysBefore,
        executionWindow: formData.executionWindow,
        timeUnit: formData.timeUnit,
        timeValue: Number(formData.timeValue)
      };

      log('🔍 FormData antes de procesar:', {
        machineId: formData.machineId,
        componentIds: formData.componentIds,
        subcomponentIds: formData.subcomponentIds,
        executionWindow: formData.executionWindow,
        timeUnit: formData.timeUnit,
        timeValue: formData.timeValue
      });

      log('🔍 Datos que se van a enviar al servidor:', {
        machineId: preventiveMaintenanceData.machineId,
        componentIds: preventiveMaintenanceData.componentIds,
        subcomponentIds: preventiveMaintenanceData.subcomponentIds,
        executionWindow: preventiveMaintenanceData.executionWindow,
        timeUnit: preventiveMaintenanceData.timeUnit,
        timeValue: preventiveMaintenanceData.timeValue
      });

      log('🔍 Payload completo:', preventiveMaintenanceData);
      log('🔍 Instructivos en payload:', {
        instructivesCount: preventiveMaintenanceData.instructives.length,
        instructives: preventiveMaintenanceData.instructives,
        mode: mode,
        isEditing: mode === 'edit' && editingMaintenance
      });

      const isEditing = mode === 'edit' && editingMaintenance;
      const url = isEditing ? `/api/maintenance/preventive/${editingMaintenance.id}` : '/api/maintenance/preventive';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preventiveMaintenanceData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Error al ${isEditing ? 'actualizar' : 'crear'} el mantenimiento preventivo`);
      }

      const selectedMachine = machines.find(m => m.id === formData.machineId);
      
      toast({
        title: `Mantenimiento preventivo ${isEditing ? 'actualizado' : 'creado'}`,
        description: result.message || `"${formData.title}" ${isEditing ? 'actualizado' : 'programado'} para ${selectedMachine?.name} cada ${formData.frequencyDays} días.`,
      });

      if (onSave) {
        onSave(result);
      }

      handleClose();
    } catch (error: any) {
      console.error('Error al crear mantenimiento preventivo:', error);
      toast({
        title: 'Error al crear mantenimiento',
        description: error.message || 'No se pudo crear el mantenimiento preventivo. Verifique la conexión e intente nuevamente.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInstructiveUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    log('🔍 Subiendo instructivo:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      mode: mode
    });

    // Permitir cualquier tipo de archivo
    // Validar solo el tamaño máximo (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB en bytes
    if (file.size > maxSize) {
      toast({
        title: 'Error de archivo',
        description: 'El archivo es demasiado grande. Máximo 10MB permitido.',
        variant: 'destructive'
      });
      return;
    }

    setUploadingInstructive(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'preventive_maintenance_instructive');
      formData.append('entityId', `temp-${Date.now()}`); // ID temporal
      formData.append('fileType', 'instructive');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al subir el instructivo');
      }

      const uploadData = await response.json();
      
      // Agregar a la lista temporal de instructivos
      const newInstructive = {
        id: `temp-${Date.now()}`,
        url: uploadData.url,
        originalName: uploadData.originalName,
        fileName: file.name,
        description: instructiveDescription, // Agregar la descripción
        uploadedAt: new Date().toISOString(),
        isTemporary: true // Marcar como temporal hasta que se guarde el mantenimiento
      };

      setInstructives(prev => [...prev, newInstructive]);
      
      // Limpiar la descripción después de subir
      setInstructiveDescription('');
      
      toast({
        title: 'Instructivo subido',
        description: `"${file.name}" se ha subido correctamente`,
      });

    } catch (error: any) {
      toast({
        title: 'Error al subir instructivo',
        description: error.message || 'No se pudo subir el archivo',
        variant: 'destructive'
      });
    } finally {
      setUploadingInstructive(false);
      // Limpiar el input
      event.target.value = '';
    }
  };

  const handleDeleteInstructive = (instructiveId: string) => {
    log('🔍 Eliminando instructivo:', {
      instructiveId,
      currentInstructives: instructives.length,
      mode: mode
    });
    
    setInstructives(prev => {
      const newInstructives = prev.filter(inst => inst.id !== instructiveId);
      log('🔍 Instructivos después de eliminar:', {
        before: prev.length,
        after: newInstructives.length,
        removedId: instructiveId
      });
      return newInstructives;
    });
    
    toast({
      title: 'Instructivo eliminado',
      description: 'El instructivo ha sido eliminado de la lista',
    });
  };

  const handleViewInstructive = (url: string) => {
    window.open(url, '_blank');
  };

  const resetForm = () => {
    prevMachineIdRef.current = null; // Permitir re-inicialización sin resetear componentes
    prevComponentIdsRef.current = null; // Permitir re-inicialización sin resetear subcomponentes
    setFormData({
      title: '',
      description: '',
      priority: Priority.MEDIUM,
      frequencyDays: 30,
      estimatedHours: 2,
      machineId: preselectedMachineId ? preselectedMachineId.toString() : '',
      componentIds: (() => {
        const ids: string[] = [];
        if (preselectedComponentId) ids.push(preselectedComponentId.toString());
        if (preselectedParentComponentId && preselectedParentComponentId !== preselectedComponentId?.toString()) {
          ids.push(preselectedParentComponentId);
        }
        return ids;
      })(),
      subcomponentIds: preselectedSubcomponentId ? [preselectedSubcomponentId.toString()] : [],
      assignedToId: 'none',
      startDate: (() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
      })(), // Fecha de mañana por defecto
      notes: '',
      alertDaysBefore: [3, 2, 1, 0] as number[],
      isActive: true,
      executionWindow: 'NONE' as ExecutionWindow,
      timeUnit: 'MINUTES' as TimeUnit,
      timeValue: 30
    });
    setSelectedTools([]);
    setSelectedSpareParts([]);
    setComponents([]);
    setSubcomponents([]);
    setMachineSpares([]);
    setToolSearchTerm('');
    setSpareSearchTerm('');
    setInstructives([]);
    setInstructiveDescription('');
  };

  const filteredTools = (availableTools || []).filter(tool =>
    tool?.name?.toLowerCase().includes(toolSearchTerm.toLowerCase()) ||
    tool?.category?.name?.toLowerCase().includes(toolSearchTerm.toLowerCase())
  );

  const filteredSpares = (machineSpares || []).filter(spare =>
    spare?.tool?.name?.toLowerCase().includes(spareSearchTerm.toLowerCase()) ||
    spare?.tool?.category?.toLowerCase().includes(spareSearchTerm.toLowerCase()) ||
    spare?.components?.some((comp: any) => comp.name.toLowerCase().includes(spareSearchTerm.toLowerCase()))
  );

  const addSpare = (spare: any) => {
    const tool = spare.tool;
    if (selectedTools.find(t => t.id === tool.id)) {
      toast({
        title: 'Repuesto ya agregado',
        description: 'Este repuesto ya está en la lista',
        variant: 'destructive'
      });
      return;
    }

    const newTool: ToolRequest = {
      id: tool.id,
      name: tool.name,
      quantity: spare.totalQuantityNeeded || 1,
      category: tool.category || '',
      location: tool.location || ''
    };

    setSelectedTools(prev => [...prev, newTool]);
    setSpareSearchTerm('');
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case Priority.LOW:
        return 'bg-muted text-foreground border-border';
      case Priority.MEDIUM:
        return 'bg-warning-muted text-warning-muted-foreground border-warning';
      case Priority.HIGH:
        return 'bg-warning-muted text-warning-muted-foreground border-warning';
      case Priority.URGENT:
        return 'bg-destructive/10 text-destructive border-destructive';
      default:
        return 'bg-muted text-foreground border-border';
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

  const getPriorityText = (priority: Priority) => {
    switch (priority) {
      case Priority.LOW:
        return 'Baja';
      case Priority.MEDIUM:
        return 'Media';
      case Priority.HIGH:
        return 'Alta';
      case Priority.URGENT:
        return 'Urgente';
      default:
        return priority;
    }
  };

  const getExecutionWindowText = (window: ExecutionWindow) => {
    switch (window) {
      case 'NONE':
        return 'Sin especificar';
      case 'ANY_TIME':
        return 'Cualquier momento';
      case 'BEFORE_START':
        return 'Antes del inicio';
      case 'MID_SHIFT':
        return 'Mitad del turno';
      case 'END_SHIFT':
        return 'Fin del turno';
      case 'WEEKEND':
        return 'Fin de semana';
      default:
        return 'Sin especificar';
    }
  };

  const getTimeUnitText = (unit: TimeUnit) => {
    switch (unit) {
      case 'HOURS':
        return 'Horas';
      case 'MINUTES':
        return 'Minutos';
      case 'DAYS':
        return 'Días';
      case 'CYCLES':
        return 'Ciclos';
      case 'KILOMETERS':
        return 'Kilómetros';
      case 'SHIFTS':
        return 'Turnos';
      default:
        return unit;
    }
  };

  // Calcular valores derivados
  const selectedMachine = machines.find((m) => m.id === Number(formData.machineId));
  const selectedComponents = formData.componentIds.length > 0 
    ? components.filter((c) => formData.componentIds.includes(c.id.toString())) 
    : [];
  const selectedSubcomponents = formData.subcomponentIds.length > 0 
    ? subcomponents.filter((s) => formData.subcomponentIds.includes(s.id.toString())) 
    : [];

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const calculateNextExecutionDate = () => {
    if (!formData.startDate || !formData.frequencyDays) {
      return undefined;
    }
    try {
      const [year, month, day] = formData.startDate.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0) {
        date.setDate(date.getDate() + 1);
      } else if (dayOfWeek === 6) {
        date.setDate(date.getDate() + 2);
      }
      return date.toISOString().split('T')[0];
    } catch (error) {
      return undefined;
    }
  };

  return (
  <>
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent size="xl" className="p-0" hideCloseButton>
        {/* Header Sticky - Unificado con Summary */}
        <div className="flex-shrink-0 bg-background border-b">
          {/* Título y badges de resumen */}
          <div className="px-4 py-2.5 sm:px-6 sm:py-4 relative flex flex-col items-center sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3">
            {/* Botón cerrar — absoluto top-right en mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 sm:hidden h-8 w-8 rounded-full hover:bg-accent"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Cerrar</span>
            </Button>

            {/* Título centrado en mobile */}
            <div className="w-full sm:w-auto text-center sm:text-left">
              <DialogHeader className="p-0 border-0">
                <DialogTitle className="text-base sm:text-lg font-semibold">
                  {mode === 'edit' ? 'Editar Mantenimiento Preventivo' : 'Nuevo Mantenimiento Preventivo'}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {mode === 'edit' ? 'Modifica la configuración del mantenimiento preventivo' : 'Programa un mantenimiento preventivo recurrente'}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Badges centrados en mobile */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <MaintenanceSummaryBar
                machineName={selectedMachine?.name}
                priority={formData.priority}
                frequencyDays={formData.frequencyDays}
                nextExecutionDate={calculateNextExecutionDate()}
                isActive={formData.isActive}
                onActiveChange={(active) => handleInputChange('isActive', active)}
                compact={true}
              />
              {/* Botón cerrar desktop */}
              <Button
                variant="ghost"
                size="icon"
                className="hidden sm:inline-flex h-8 w-8 ml-2 rounded-full hover:bg-accent"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Cerrar</span>
              </Button>
            </div>
          </div>

          {/* Stepper */}
          <div className="flex justify-center px-3 pb-3 pt-0.5 sm:px-6 sm:pb-4 sm:pt-1">
            <Stepper
              steps={wizardSteps}
              currentStep={activeTab}
              onStepClick={(stepId) => {
                if (canGoToStep(stepId)) {
                  setActiveTab(stepId);
                }
              }}
              className="w-full max-w-4xl"
            />
          </div>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="px-4 py-4 sm:px-6 sm:py-6">
              <div className="max-w-6xl mx-auto">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsContent value="equipment" className="space-y-6 mt-0">
                    <EquipmentStep
                      formData={formData}
                      setFormData={setFormData}
                      validationErrors={validationErrors}
                      clearFieldError={clearFieldError}
                      handleInputChange={handleInputChange}
                      machines={machines}
                      components={components}
                      subcomponents={subcomponents}
                      loadingComponents={loadingComponents}
                      loadingSubcomponents={loadingSubcomponents}
                      selectedMachine={selectedMachine}
                      selectedComponents={selectedComponents}
                      selectedSubcomponents={selectedSubcomponents}
                      handleCreateComponent={handleCreateComponent}
                      handleCreateSubcomponent={handleCreateSubcomponent}
                    />
                  </TabsContent>

                  <TabsContent value="general" className="space-y-6 mt-0">
                    <GeneralStep
                      formData={formData}
                      handleInputChange={handleInputChange}
                      clearFieldError={clearFieldError}
                      validationErrors={validationErrors}
                      users={users}
                    />
                  </TabsContent>

                  <TabsContent value="tools" className="space-y-6 mt-0">
                    <ToolsStep
                      formData={formData}
                      selectedTools={selectedTools}
                      setSelectedTools={setSelectedTools}
                      toolSearchTerm={toolSearchTerm}
                      setToolSearchTerm={setToolSearchTerm}
                      spareSearchTerm={spareSearchTerm}
                      setSpareSearchTerm={setSpareSearchTerm}
                      filteredTools={filteredTools}
                      filteredSpares={filteredSpares}
                      loadingTools={loadingTools}
                      loadingSpares={loadingSpares}
                      selectedMachine={selectedMachine}
                      selectedComponents={selectedComponents}
                      addTool={addTool}
                      addSpare={addSpare}
                      removeTool={removeTool}
                      updateToolQuantity={updateToolQuantity}
                    />
                  </TabsContent>

                  <TabsContent value="instructives" className="space-y-6 mt-0">
                    <InstructivesStep
                      instructives={instructives}
                      instructiveDescription={instructiveDescription}
                      setInstructiveDescription={setInstructiveDescription}
                      uploadingInstructive={uploadingInstructive}
                      handleInstructiveUpload={handleInstructiveUpload}
                      handleDeleteInstructive={handleDeleteInstructive}
                      handleViewInstructive={handleViewInstructive}
                    />
                  </TabsContent>

                  <TabsContent value="schedule" className="space-y-6 mt-0">
                    <ScheduleStep
                      formData={formData}
                      setFormData={setFormData}
                      handleInputChange={handleInputChange}
                      clearFieldError={clearFieldError}
                      validationErrors={validationErrors}
                      mode={mode}
                      getExecutionWindowText={getExecutionWindowText}
                      getTimeUnitText={getTimeUnitText}
                    />
                  </TabsContent>

                  {/* Paso: Resumen */}
                  <TabsContent value="summary" className="space-y-6 mt-0">
                    <SummaryStep
                      formData={formData}
                      selectedMachine={selectedMachine}
                      selectedComponents={selectedComponents}
                      selectedSubcomponents={selectedSubcomponents}
                      users={users}
                      selectedTools={selectedTools}
                      instructives={instructives}
                      formatDateForDisplay={formatDateForDisplay}
                      calculateNextExecutionDate={calculateNextExecutionDate}
                      getPriorityColor={getPriorityColor}
                      getPriorityText={getPriorityText}
                      getExecutionWindowText={getExecutionWindowText}
                      getTimeUnitText={getTimeUnitText}
                      mode={mode}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
        </div>

        {/* Footer Sticky - Mejorado */}
        <div className="flex-shrink-0 bg-muted/30 border-t px-4 py-2 sm:px-6 sm:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Lado izquierdo: Progreso y estado */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Indicador de paso */}
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
                <span className="font-medium text-muted-foreground">
                  Paso {wizardSteps.findIndex(s => s.id === activeTab) + 1}/{wizardSteps.length}
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="font-medium">
                  {wizardSteps.find(s => s.id === activeTab)?.label}
                </span>
              </div>

              {/* Estado del formulario */}
              <div className="hidden sm:block text-xs">
                {formData.title.trim() && formData.machineId && formData.startDate && formData.frequencyDays > 0 ? (
                  <span className="text-success font-medium">✓ Listo para guardar</span>
                ) : (
                  <span className="text-muted-foreground">Complete los campos obligatorios</span>
                )}
              </div>
            </div>

            {/* Lado derecho: Botones de navegación */}
            <div className="flex items-center gap-2">
              {/* Ver historial */}
              {formData.machineId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (formData.machineId) {
                      setShowHistoryModal(true);
                      loadMaintenanceHistory(
                        Number(formData.machineId),
                        formData.componentIds,
                        formData.subcomponentIds
                      );
                    }
                  }}
                  className="text-xs"
                >
                  <History className="h-3.5 w-3.5 mr-1" />
                  Historial
                </Button>
              )}

              <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                disabled={loading}
                className="hidden sm:inline-flex"
              >
                Cancelar
              </Button>

              {activeTab !== 'equipment' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousTab}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Atrás
                </Button>
              )}

              {!isLastTab() ? (
                <Button size="sm" onClick={handleNextTab}>
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={loading || !formData.title.trim() || !formData.machineId || !formData.startDate || formData.frequencyDays <= 0}
                  className="sm:min-w-[160px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {mode === 'edit' ? 'Guardando...' : 'Creando...'}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {mode === 'edit' ? 'Guardar' : 'Crear'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Modal del Historial */}
      <Dialog open={showHistoryModal} onOpenChange={(open) => {
        setShowHistoryModal(open);
        if (!open) {
          setHistorySearchTerm(''); // Limpiar búsqueda al cerrar
        }
      }}>
        <DialogContent size="lg">
          <DialogHeader>
            <div className="flex flex-col space-y-1.5 text-center">
              <DialogTitle className="text-sm font-medium">
                Mantenimientos Preventivos
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-2">
                {formData.componentIds?.length > 0 
                  ? 'Mantenimientos preventivos configurados para el componente seleccionado'
                  : 'Mantenimientos preventivos configurados para esta máquina'}
              </DialogDescription>
            </div>
          </DialogHeader>
          
          <DialogBody>
          {/* Buscador */}
          {maintenanceHistory.length > 0 && (
            <div className="px-1 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por título o descripción..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>
          )}

          <div>
            {loadingHistory ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-foreground" />
              </div>
            ) : (() => {
              // Filtrar mantenimientos por término de búsqueda
              const filteredHistory = maintenanceHistory.filter((maintenance: any) => {
                if (!historySearchTerm.trim()) return true;
                const searchLower = historySearchTerm.toLowerCase();
                return (
                  maintenance.title?.toLowerCase().includes(searchLower) ||
                  maintenance.description?.toLowerCase().includes(searchLower) ||
                  maintenance.componentName?.toLowerCase().includes(searchLower)
                );
              });

              if (filteredHistory.length === 0) {
                return (
                  <div className="text-center py-8 space-y-2">
                    {maintenanceHistory.length === 0 ? (
                      <>
                        <p className="text-sm text-muted-foreground">
                          No hay mantenimientos preventivos configurados para esta máquina
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Los mantenimientos aparecerán aquí una vez que se creen.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">
                          No se encontraron mantenimientos que coincidan con la búsqueda
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Intenta con otros términos de búsqueda.
                        </p>
                      </>
                    )}
                  </div>
                );
              }

              // Funciones helper para formatear
              const translateExecutionWindow = (window: string) => {
                const translations: { [key: string]: string } = {
                  '1': 'Antes del inicio',
                  '2': 'Mitad del turno',
                  '3': 'Fin del turno',
                  '4': 'Cualquier momento',
                  '5': 'Programado',
                  '6': 'Fin de semana',
                  'NONE': 'Sin especificar',
                  'BEFORE_START': 'Antes del inicio',
                  'MID_SHIFT': 'Mitad del turno',
                  'END_SHIFT': 'Fin del turno',
                  'ANY_TIME': 'Cualquier momento',
                  'SCHEDULED': 'Programado',
                  'WEEKEND': 'Fin de semana'
                };
                return translations[window] || 'Sin especificar';
              };

              const getPriorityLabel = (priority: string) => {
                const translations: { [key: string]: string } = {
                  'LOW': 'Baja',
                  'MEDIUM': 'Media',
                  'HIGH': 'Alta',
                  'URGENT': 'Urgente',
                  'CRITICAL': 'Crítica'
                };
                return translations[priority] || priority;
              };

              const formatFrequency = (frequencyDays: number): string => {
                if (!frequencyDays) return 'Sin frecuencia';
                if (frequencyDays === 1) return 'Diaria (1 día)';
                if (frequencyDays >= 2 && frequencyDays <= 7) return `Semanal (${frequencyDays} días)`;
                if (frequencyDays >= 8 && frequencyDays <= 15) return `Quincenal (${frequencyDays} días)`;
                if (frequencyDays >= 16 && frequencyDays <= 30) return `Mensual (${frequencyDays} días)`;
                if (frequencyDays >= 31 && frequencyDays <= 90) return `Trimestral (${frequencyDays} días)`;
                if (frequencyDays >= 91 && frequencyDays <= 180) return `Semestral (${frequencyDays} días)`;
                if (frequencyDays >= 181 && frequencyDays <= 365) return `Anual (${frequencyDays} días)`;
                return `Cada ${frequencyDays} días`;
              };

              const getDurationDisplay = (m: any) => {
                if (m.timeValue && m.timeUnit) {
                  const unitText = m.timeUnit === 'HOURS' ? 'h' : 'm';
                  return `${m.timeValue}${unitText}`;
                }
                return 'Sin tiempo estimado';
              };

              return (
                <div className="space-y-4">
                  {filteredHistory.map((maintenance: any) => {
                    const hasExecutions = maintenance.maintenanceCount && maintenance.maintenanceCount > 0;
                    const status = hasExecutions ? 'COMPLETED' : 'PENDING';
                    
                    return (
                      <Card 
                        key={maintenance.id} 
                        className="cursor-pointer hover:shadow-md transition-shadow w-full overflow-hidden"
                      >
                        <div className="p-4 sm:p-4 overflow-x-hidden">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <h3 className="text-sm font-medium break-words">{maintenance.title || 'Sin título'}</h3>
                                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-muted text-muted-foreground shrink-0">
                                  ID: {maintenance.id}
                                </div>
                                {maintenance.priority && (
                                  <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-primary/80 bg-warning-muted text-warning-muted-foreground shrink-0">
                                    {getPriorityLabel(maintenance.priority)}
                                  </div>
                                )}
                                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-primary/80 shrink-0 bg-warning-muted text-warning-muted-foreground">
                                  {status === 'COMPLETED' ? 'Completado' : 'Pendiente'}
                                </div>
                                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground shrink-0">
                                  Preventivo
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2 break-words">{maintenance.description || 'Sin descripción'}</p>
                              <div className="flex flex-wrap items-center gap-3 mb-2 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 shrink-0" />
                                  <span>Ventana: {maintenance.executionWindow ? translateExecutionWindow(maintenance.executionWindow) : 'Cualquier momento'}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                {maintenance.machineName && (
                                  <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground text-xs">
                                    <Wrench className="h-3 w-3 mr-1" />
                                    {maintenance.machineName}
                                  </div>
                                )}
                                {maintenance.componentNames && maintenance.componentNames.length > 0 && maintenance.componentNames.map((name: string, idx: number) => (
                                  <div key={`component-${idx}`} className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-xs bg-info-muted text-info-muted-foreground">
                                    <Cog className="h-3 w-3 mr-1" />
                                    {name}
                                  </div>
                                ))}
                                {maintenance.subcomponentNames && maintenance.subcomponentNames.length > 0 && maintenance.subcomponentNames.map((name: string, idx: number) => (
                                  <div key={`subcomponent-${idx}`} className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-xs bg-primary/10 text-primary">
                                    <Settings className="h-3 w-3 mr-1" />
                                    {name}
                                  </div>
                                ))}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-muted-foreground">
                                {maintenance.frequencyDays && (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>{formatFrequency(maintenance.frequencyDays)}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {getDurationDisplay(maintenance)}
                                </div>
                                {maintenance.scheduledDate && (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>Próximo: {new Date(maintenance.scheduledDate).toLocaleDateString('es-ES', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric'
                                    })}</span>
                                  </div>
                                )}
                                {maintenance.assignedToName ? (
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    <span>{maintenance.assignedToName}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    <span>Sin asignar</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Dialog>

    {/* Dialog para crear componente o subcomponente desde el selector */}
    {showComponentDialog && formData.machineId && (
      <ComponentDialog
        isOpen={showComponentDialog}
        onClose={() => setShowComponentDialog(false)}
        onSave={handleComponentDialogSave}
        machineId={Number(formData.machineId)}
        machineName={machines.find(m => m.id === Number(formData.machineId))?.name}
        initialValues={{
          name: pendingComponentName,
          machineId: Number(formData.machineId),
        }}
        parentComponent={componentDialogMode === 'subcomponent' && formData.componentIds[0] ? (() => {
          const parentComp = components.find(c => c.id.toString() === formData.componentIds[0]);
          return parentComp ? { id: Number(parentComp.id), name: parentComp.name } : undefined;
        })() : undefined}
      />
    )}
  </>
  );
} 
