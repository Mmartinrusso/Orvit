'use client';

import { useState, useEffect, useRef } from 'react';
import { Machine, MachineComponent, Priority, ExecutionWindow, TimeUnit } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Calendar,
  Clock,
  Wrench,
  Settings,
  User,
  AlertTriangle,
  Hammer,
  Plus,
  X,
  Search,
  Info,
  Package,
  Cog,
  FileText,
  Upload,
  Eye,
  Trash2,
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
import { MultiSelect, MultiSelectOption } from '@/components/ui/multi-select';
import ComponentDialog from '@/components/maquinas/ComponentDialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { SectionCard } from './SectionCard';
import { EmptyState } from './EmptyState';
import { SelectionSummaryChips } from './SelectionSummaryChips';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

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

interface ToolRequest {
  id: string;
  name: string;
  quantity: number;
  category?: string;
  location?: string;
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
                    <SectionCard
                      title="Selección de Equipamiento"
                      icon={Wrench}
                      description="Seleccione la máquina, componente y subcomponente específico"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Máquina */}
                        <div className="space-y-2">
                          <Label htmlFor="machine" className="text-xs font-medium">
                            Máquina <span className="text-destructive">*</span>
                          </Label>
                    <Select
                      value={formData.machineId}
                      onValueChange={(value) => {
                        handleInputChange('machineId', value);
                        clearFieldError('machineId');
                      }}
                    >
                      <SelectTrigger className={cn(
                        validationErrors.machineId ? 'border-destructive ring-destructive/20 ring-2' : ''
                      )}>
                        <SelectValue placeholder="Seleccionar máquina" />
                      </SelectTrigger>
                      <SelectContent>
                        {machines.length === 0 ? (
                          <SelectItem value="no-machines" disabled>No hay máquinas disponibles</SelectItem>
                        ) : (
                          machines.map((machine) => (
                            <SelectItem key={machine.id} value={machine.id.toString()}>
                                    {machine.name} {machine.nickname && `(${machine.nickname})`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {validationErrors.machineId && (
                      <p className="text-xs text-destructive font-medium">{validationErrors.machineId}</p>
                    )}
                  </div>

                        {/* Componentes */}
                        <div className="space-y-2">
                          <Label htmlFor="components" className="text-xs font-medium">
                            Componentes (selección múltiple)
                          </Label>
                      {!formData.machineId ? (
                            <EmptyState
                              icon={Wrench}
                              title="Selecciona una máquina primero"
                              subtitle="Para cargar los componentes disponibles"
                            />
                      ) : loadingComponents ? (
                            <div className="flex items-center justify-center py-8 border rounded-lg">
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                              <span className="ml-2 text-sm text-muted-foreground">Cargando componentes...</span>
                            </div>
                          ) : (
                            <MultiSelect
                              options={components.map(c => ({ value: c.id.toString(), label: c.name }))}
                              selected={formData.componentIds}
                              onChange={(selected) => setFormData(prev => ({ ...prev, componentIds: selected }))}
                              placeholder="Seleccionar o crear componente..."
                              emptyMessage="No hay componentes. Escribí un nombre para crear uno."
                              searchPlaceholder="Buscar componentes..."
                              onCreateNew={handleCreateComponent}
                            />
                          )}
                  </div>

                        {/* Subcomponentes */}
                        <div className="space-y-2">
                          <Label htmlFor="subcomponents" className="text-xs font-medium">
                            Subcomponentes (selección múltiple)
                          </Label>
                      {formData.componentIds.length === 0 ? (
                            <EmptyState
                              icon={Cog}
                              title="Selecciona componentes primero"
                              subtitle="Para cargar los subcomponentes disponibles"
                            />
                      ) : loadingSubcomponents ? (
                            <div className="flex items-center justify-center py-8 border rounded-lg">
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                              <span className="ml-2 text-sm text-muted-foreground">Cargando subcomponentes...</span>
                            </div>
                          ) : (
                            <MultiSelect
                              options={subcomponents.map(s => ({ value: s.id.toString(), label: s.name }))}
                              selected={formData.subcomponentIds}
                              onChange={(selected) => setFormData(prev => ({ ...prev, subcomponentIds: selected }))}
                              placeholder="Seleccionar o crear subcomponente..."
                              emptyMessage="No hay subcomponentes. Escribí un nombre para crear uno."
                              searchPlaceholder="Buscar subcomponentes..."
                              disabled={formData.componentIds.length === 0}
                              onCreateNew={handleCreateSubcomponent}
                            />
                          )}
                  </div>
                </div>

                {/* Resumen de selección */}
                      <SelectionSummaryChips
                        machineName={selectedMachine?.name}
                        componentNames={selectedComponents.map(c => c.name)}
                        subcomponentNames={selectedSubcomponents.map(s => s.name)}
                        onClear={() => {
                          setFormData(prev => ({ ...prev, componentIds: [], subcomponentIds: [] }));
                        }}
                        className="mt-6"
                      />
                    </SectionCard>
          </TabsContent>

                  <TabsContent value="general" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Información General */}
                      <SectionCard
                        title="Información General"
                        icon={Info}
                        description="Datos básicos del mantenimiento preventivo"
                      >
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="title" className="text-xs font-medium">
                              Título <span className="text-destructive">*</span>
                            </Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => {
                        handleInputChange('title', e.target.value);
                        clearFieldError('title');
                      }}
                      placeholder="Ej: Lubricación de rodamientos"
                              className={cn(
                                validationErrors.title ? 'border-destructive ring-destructive/20 ring-2' : '',
                                !formData.title.trim() && !validationErrors.title ? 'border-destructive/50' : ''
                              )}
                    />
                            {validationErrors.title ? (
                              <p className="text-xs text-destructive font-medium">{validationErrors.title}</p>
                            ) : (
                            <p className="text-xs text-muted-foreground">
                              Nombre descriptivo del mantenimiento
                            </p>
                            )}
                  </div>

                          <div className="space-y-2">
                            <Label htmlFor="description" className="text-xs font-medium">
                              Descripción
                            </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Describa el procedimiento de mantenimiento..."
                      rows={4}
                              className="resize-none"
                    />
                            <p className="text-xs text-muted-foreground">
                              Detalles del procedimiento a realizar
                            </p>
                  </div>

                          <div className="space-y-2">
                            <Label htmlFor="priority" className="text-xs font-medium">
                              Prioridad <span className="text-destructive">*</span>
                            </Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => handleInputChange('priority', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={Priority.LOW}>
                          <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 bg-muted-foreground rounded-full"></div>
                            Baja
                          </div>
                        </SelectItem>
                        <SelectItem value={Priority.MEDIUM}>
                          <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 bg-warning rounded-full"></div>
                            Media
                          </div>
                        </SelectItem>
                        <SelectItem value={Priority.HIGH}>
                          <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 bg-warning rounded-full"></div>
                            Alta
                          </div>
                        </SelectItem>
                        <SelectItem value={Priority.URGENT}>
                          <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 bg-destructive rounded-full"></div>
                            Urgente
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                            <p className="text-xs text-muted-foreground">
                              Nivel de urgencia del mantenimiento
                            </p>
                  </div>
                        </div>
                      </SectionCard>

                      {/* Asignación */}
                      <SectionCard
                        title="Asignación"
                        icon={User}
                        description="Técnico responsable y configuración"
                      >
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="assignedTo" className="text-xs font-medium">
                              Técnico Asignado
                            </Label>
                    <Select
                      value={formData.assignedToId}
                      onValueChange={(value) => handleInputChange('assignedToId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar técnico" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
                        
                        {/* Usuarios del Sistema */}
                        {users.filter(user => user.type === 'USER').length > 0 && (
                          <>
                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50 border-b">
                              Usuarios del Sistema
                            </div>
                            {users.filter(user => user.type === 'USER').map((user) => (
                              <SelectItem key={user.id} value={user.id.toString()}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{user.name}</span>
                                          <Badge variant="secondary" className="bg-info-muted text-info-muted-foreground text-xs ml-2">
                                    {user.role === 'ADMIN' || user.role === 'SUPERADMIN' ? 'Admin' : 'Usuario'}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </>
                        )}

                        {/* Operarios */}
                        {users.filter(user => user.type === 'WORKER').length > 0 && (
                          <>
                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50 border-b">
                              Operarios
                            </div>
                            {users.filter(user => user.type === 'WORKER').map((user) => (
                              <SelectItem key={user.id} value={user.id.toString()}>
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex flex-col items-start">
                                    <span>{user.name}</span>
                                    {user.specialty && (
                                      <span className="text-xs text-muted-foreground">
                                        {user.specialty}
                                      </span>
                                    )}
                                  </div>
                                          <Badge variant="secondary" className="bg-success-muted text-success text-xs ml-2">
                                    Operario
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                            <p className="text-xs text-muted-foreground">
                              Persona responsable de ejecutar el mantenimiento
                            </p>
                  </div>

                          <div className="space-y-2">
                            <Label htmlFor="notes" className="text-xs font-medium">
                              Notas Adicionales
                            </Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      placeholder="Instrucciones especiales, precauciones..."
                      rows={3}
                              className="resize-none"
                    />
                            <p className="text-xs text-muted-foreground">
                              Información adicional para el técnico
                            </p>
                  </div>

                          <Separator />

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="isActive" className="text-xs font-medium">
                                Mantenimiento activo
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                El mantenimiento se ejecutará según la programación
                              </p>
                            </div>
                            <Switch
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                    />
                  </div>
                        </div>
                      </SectionCard>
            </div>
          </TabsContent>

                  <TabsContent value="tools" className="space-y-6 mt-0">
              {/* Sección de herramientas generales y repuestos específicos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Herramientas Generales */}
                      <SectionCard
                        title="Herramientas Generales"
                        icon={Hammer}
                        description="Herramientas del pañol de uso general"
                      >
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar herramientas..."
                          value={toolSearchTerm}
                          onChange={(e) => setToolSearchTerm(e.target.value)}
                          className="pl-10 pr-10"
                        />
                        {toolSearchTerm && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                            onClick={() => setToolSearchTerm('')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                          <ScrollArea className="h-[320px]">
                            <div className="space-y-2 pr-4">
                        {loadingTools ? (
                          <div className="flex items-center justify-center py-12">
                                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                  <span className="ml-2 text-sm text-muted-foreground">Cargando herramientas...</span>
                          </div>
                        ) : filteredTools.length === 0 ? (
                                <EmptyState
                                  icon={Hammer}
                                  title={toolSearchTerm ? 'No se encontraron herramientas' : 'No hay herramientas disponibles'}
                                  subtitle={toolSearchTerm ? 'Intente con otro término de búsqueda' : 'Las herramientas se cargarán desde el pañol'}
                                />
                        ) : (
                          filteredTools.map((tool) => (
                            <div
                              key={tool.id}
                                    className="flex items-center justify-between p-2.5 border rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => addTool(tool)}
                            >
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-xs truncate">{tool.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {tool.category?.name || 'Sin categoría'} • {tool.location?.name || 'Sin ubicación'}
                                </p>
                                {tool.stockQuantity !== undefined && (
                                        <Badge variant="outline" className="text-xs mt-1 bg-info-muted text-info-muted-foreground border-info-muted">
                                          Stock: {tool.stockQuantity}
                                        </Badge>
                                )}
                              </div>
                                    <Button variant="outline" size="sm" className="ml-2 shrink-0">
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                          </ScrollArea>
                    </div>
                      </SectionCard>

                {/* Repuestos Específicos */}
                      <SectionCard
                        title="Repuestos Específicos"
                        icon={Cog}
                        description={selectedMachine 
                          ? `Repuestos asociados a ${selectedMachine.name}${selectedComponents.length > 0 ? ` - ${selectedComponents.map(c => c.name).join(', ')}` : ''}`
                          : 'Repuestos asociados a la máquina seleccionada'
                        }
                      >
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar repuestos..."
                          value={spareSearchTerm}
                          onChange={(e) => setSpareSearchTerm(e.target.value)}
                          className="pl-10 pr-10"
                          disabled={!formData.machineId}
                        />
                        {spareSearchTerm && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                            onClick={() => setSpareSearchTerm('')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                          <ScrollArea className="h-[320px]">
                            <div className="space-y-2 pr-4">
                        {!formData.machineId ? (
                                <EmptyState
                                  icon={Cog}
                                  title="Seleccione una máquina"
                                  subtitle="Para ver sus repuestos específicos"
                                />
                        ) : loadingSpares ? (
                          <div className="flex items-center justify-center py-12">
                                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                  <span className="ml-2 text-sm text-muted-foreground">Cargando repuestos...</span>
                          </div>
                        ) : filteredSpares.length === 0 ? (
                                <EmptyState
                                  icon={Cog}
                                  title={spareSearchTerm ? 'No se encontraron repuestos' : 'No hay repuestos específicos'}
                                  subtitle={spareSearchTerm ? 'Intente con otro término' : 'Esta máquina no tiene repuestos asociados'}
                                />
                        ) : (
                          filteredSpares.map((spare) => (
                            <div
                              key={spare.tool.id}
                                    className="flex items-center justify-between p-2.5 border rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => addSpare(spare)}
                            >
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-xs truncate">{spare.tool.name}</p>
                                <p className="text-xs text-muted-foreground">
                                        {spare.tool.category || 'Sin categoría'}
                                        {spare.tool.stockQuantity !== undefined && ` • Stock: ${spare.tool.stockQuantity}`}
                                </p>
                                      {spare.components.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {spare.components.slice(0, 2).map((comp: any) => (
                                    <Badge key={comp.id} variant="secondary" className="text-xs">
                                      {comp.name} ({comp.quantityNeeded})
                                    </Badge>
                                  ))}
                                          {spare.components.length > 2 && (
                                            <Badge variant="secondary" className="text-xs">
                                              +{spare.components.length - 2}
                                            </Badge>
                                          )}
                                </div>
                                      )}
                              </div>
                                    <Button variant="outline" size="sm" className="ml-2 shrink-0">
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                          </ScrollArea>
                    </div>
                      </SectionCard>
              </div>

              {/* Productos Seleccionados */}
                    {selectedTools.length > 0 && (
                      <SectionCard
                        title={`Seleccionados (${selectedTools.length})`}
                        icon={Package}
                        description="Productos agregados a este mantenimiento"
                      >
                        <div className="space-y-2">
                          <div className="flex justify-end mb-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedTools([])}
                              className="h-7 text-xs"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Quitar todo
                            </Button>
                          </div>
                          <ScrollArea className="h-[200px]">
                            <div className="space-y-2 pr-4">
                              {selectedTools.map((tool) => (
                        <div
                          key={tool.id}
                                  className="flex items-center justify-between p-3 border rounded-md bg-muted/30"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-xs truncate">{tool.name}</p>
                                    <p className="text-xs text-muted-foreground">
                              {tool.category} • {tool.location}
                            </p>
                          </div>
                                  <div className="flex items-center gap-2 ml-4">
                            <Input
                              type="number"
                              min="1"
                              value={tool.quantity}
                              onChange={(e) => updateToolQuantity(tool.id, Number(e.target.value))}
                                      className="w-20 h-8 text-sm"
                            />
                            <Button
                                      variant="ghost"
                              size="sm"
                              onClick={() => removeTool(tool.id)}
                                      className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                              ))}
                  </div>
                          </ScrollArea>
            </div>
                      </SectionCard>
                    )}
          </TabsContent>

                  <TabsContent value="instructives" className="space-y-6 mt-0">
                    {/* Subir Instructivo */}
                    <SectionCard
                      title="Subir Instructivo"
                      icon={Upload}
                      description="Archivos con las instrucciones detalladas para realizar este mantenimiento"
                    >
                <div className="space-y-4">
                        {/* Dropzone */}
                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 hover:border-muted-foreground/40 transition-colors">
                          <div className="text-center space-y-4">
                            <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                            <div>
                              <h4 className="text-sm font-semibold mb-1">Seleccionar archivo</h4>
                              <p className="text-xs text-muted-foreground">
                                Máx 10MB
                              </p>
                            </div>
                      
                      {/* Campo de descripción */}
                            <div className="text-left max-w-md mx-auto">
                        <Label htmlFor="instructiveDescription" className="text-xs font-medium">
                                Descripción del instructivo
                        </Label>
                        <Textarea
                          id="instructiveDescription"
                                placeholder="Describe brevemente el contenido..."
                          value={instructiveDescription}
                          onChange={(e) => setInstructiveDescription(e.target.value)}
                                className="mt-1.5 resize-none"
                          rows={3}
                        />
                      </div>
                      
                            <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 transition-colors text-sm">
                        <Upload className="h-4 w-4" />
                        {uploadingInstructive ? 'Subiendo...' : 'Seleccionar archivo'}
                        <input
                          type="file"
                          onChange={handleInstructiveUpload}
                          className="hidden"
                          disabled={uploadingInstructive}
                        />
                      </label>
                    </div>
                  </div>
                      </div>
                    </SectionCard>

                    {/* Lista de instructivos */}
                    <SectionCard
                      title={`Instructivos subidos (${instructives.length})`}
                      icon={FileText}
                      description={instructives.length === 0 ? 'Los instructivos ayudarán a los técnicos a realizar el mantenimiento correctamente' : undefined}
                    >
                      {instructives.length === 0 ? (
                        <EmptyState
                          icon={FileText}
                          title="No hay instructivos subidos"
                          subtitle="Sube archivos con las instrucciones para este mantenimiento"
                        />
                      ) : (
                    <div className="space-y-3">
                      {instructives.map((instructive) => (
                        <div
                          key={instructive.id}
                              className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <FileText className="h-5 w-5 text-primary shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-xs truncate">
                                    {instructive.originalName || instructive.fileName}
                                  </p>
                              {instructive.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                  {instructive.description}
                                </p>
                              )}
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                Subido el {new Date(instructive.uploadedAt).toLocaleDateString('es-ES')}
                              </p>
                            </div>
                          </div>
                              <div className="flex items-center gap-2 shrink-0 ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewInstructive(instructive.url)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteInstructive(instructive.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                    </SectionCard>
          </TabsContent>

                  <TabsContent value="schedule" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Configuración */}
                      <SectionCard
                        title="Configuración"
                        icon={Calendar}
                        description="Fecha, frecuencia y alertas del mantenimiento"
                      >
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="startDate" className="text-xs font-medium">
                              Fecha de inicio <span className="text-destructive">*</span>
                            </Label>
                    <DatePicker
                      value={formData.startDate}
                      onChange={(date) => {
                        handleInputChange('startDate', date);
                        clearFieldError('startDate');
                      }}
                      placeholder="Seleccionar fecha"
                      className={cn(
                        validationErrors.startDate ? 'border-destructive ring-destructive/20 ring-2' : ''
                      )}
                    />
                            {validationErrors.startDate ? (
                              <p className="text-xs text-destructive font-medium">{validationErrors.startDate}</p>
                            ) : (
                            <p className="text-xs text-muted-foreground">
                              Primera ejecución {mode === 'create' ? '(puede ser una fecha pasada si el mantenimiento ya fue realizado)' : '(puede ser fecha pasada al editar)'}
                            </p>
                            )}
                  </div>

                          <div className="space-y-2">
                            <Label htmlFor="frequencyDays" className="text-xs font-medium">
                              Frecuencia <span className="text-destructive">*</span>
                            </Label>
                            <div className="flex items-center gap-2">
                    <Input
                      id="frequencyDays"
                      type="number"
                      min="1"
                      max="365"
                      value={formData.frequencyDays}
                      onChange={(e) => {
                        handleInputChange('frequencyDays', Number(e.target.value));
                        clearFieldError('frequencyDays');
                      }}
                                className={cn(
                                  "flex-1",
                                  validationErrors.frequencyDays ? 'border-destructive ring-destructive/20 ring-2' : ''
                                )}
                    />
                              <span className="text-sm text-muted-foreground whitespace-nowrap">días</span>
                            </div>
                            {validationErrors.frequencyDays ? (
                              <p className="text-xs text-destructive font-medium">{validationErrors.frequencyDays}</p>
                            ) : (
                            <p className="text-xs text-muted-foreground">
                      El mantenimiento se repetirá cada {formData.frequencyDays} días
                    </p>
                            )}
                  </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-medium">
                              Días de alerta <span className="text-destructive">*</span>
                            </Label>
                            <div className={cn(
                              "flex flex-wrap gap-2 p-2 rounded-md",
                              validationErrors.alertDaysBefore ? 'bg-destructive/10 ring-2 ring-destructive/20' : ''
                            )}>
                              {[
                                { value: 0, label: 'El mismo día', icon: '🔔' },
                                { value: 1, label: '1 día antes', icon: '📅' },
                                { value: 2, label: '2 días antes', icon: '📅' },
                                { value: 3, label: '3 días antes', icon: '📅' }
                              ].map(option => {
                                const alertDays = Array.isArray(formData.alertDaysBefore) ? formData.alertDaysBefore : [3, 2, 1, 0];
                                const isSelected = alertDays.includes(option.value);
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                      if (isSelected) {
                                        setFormData(prev => ({
                                          ...prev,
                                          alertDaysBefore: alertDays.filter(day => day !== option.value)
                                        }));
                                      } else {
                                        setFormData(prev => ({
                                          ...prev,
                                          alertDaysBefore: [...alertDays, option.value].sort((a, b) => a - b)
                                        }));
                                      }
                                      clearFieldError('alertDaysBefore');
                                    }}
                                    className={cn(
                                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                      "border-2 cursor-pointer",
                                      isSelected
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                        : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-muted/50"
                                    )}
                                  >
                                    {isSelected && <span className="text-xs">✓</span>}
                                    <span>{option.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                            {validationErrors.alertDaysBefore ? (
                              <p className="text-xs text-destructive font-medium">{validationErrors.alertDaysBefore}</p>
                            ) : (
                            <p className="text-xs text-muted-foreground">
                              Se enviarán alertas en los días seleccionados
                            </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="executionWindow" className="text-xs font-medium">
                              Ventana de ejecución
                            </Label>
                    <Select
                      value={formData.executionWindow}
                      onValueChange={(value) => handleInputChange('executionWindow', value)}
                    >
                      <SelectTrigger>
                                <SelectValue placeholder="Seleccionar ventana" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="NONE">Sin especificar</SelectItem>
                          <SelectItem value="ANY_TIME">Cualquier momento</SelectItem>
                          <SelectItem value="BEFORE_START">Antes del inicio</SelectItem>
                          <SelectItem value="MID_SHIFT">Mitad de turno</SelectItem>
                          <SelectItem value="END_SHIFT">Fin de turno</SelectItem>
                          <SelectItem value="WEEKEND">Fin de semana</SelectItem>
                      </SelectContent>
                    </Select>
                            <p className="text-xs text-muted-foreground">
                      Cuándo se debe ejecutar el mantenimiento
                    </p>
                  </div>

                          <div className="space-y-2">
                            <Label htmlFor="timeValue" className="text-xs font-medium">
                              Tiempo estimado
                            </Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0.5"
                        max="24"
                        step="0.5"
                        value={formData.timeValue}
                        onChange={(e) => handleInputChange('timeValue', Number(e.target.value))}
                        className="flex-1"
                        placeholder="1"
                      />
                      <Select
                        value={formData.timeUnit}
                        onValueChange={(value) => handleInputChange('timeUnit', value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HOURS">Horas</SelectItem>
                          <SelectItem value="MINUTES">Minutos</SelectItem>
                          <SelectItem value="DAYS">Días</SelectItem>
                          <SelectItem value="CYCLES">Ciclos</SelectItem>
                          <SelectItem value="KILOMETERS">Kilómetros</SelectItem>
                          <SelectItem value="SHIFTS">Turnos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                            <p className="text-xs text-muted-foreground">
                      Duración estimada del mantenimiento
                    </p>
                  </div>
                        </div>
                      </SectionCard>

                      {/* Próximas Fechas */}
                      <SectionCard
                        title="Próximas fechas"
                        icon={Clock}
                        description="Previsualización de las próximas ejecuciones programadas"
                      >
                  {formData.startDate && formData.frequencyDays && formData.frequencyDays > 0 ? (
                    <div className="space-y-3">
                            <ScrollArea className="h-[400px]">
                              <div className="space-y-2 pr-4">
                      {Array.from({ length: 5 }, (_, i) => {
                        const date = new Date(formData.startDate);
                        date.setDate(date.getDate() + (i * formData.frequencyDays));
                        
                        const adjustToWeekday = (dateToAdjust: Date) => {
                                    const dayOfWeek = dateToAdjust.getDay();
                                    if (dayOfWeek === 0) dateToAdjust.setDate(dateToAdjust.getDate() + 1);
                                    else if (dayOfWeek === 6) dateToAdjust.setDate(dateToAdjust.getDate() + 2);
                          return dateToAdjust;
                        };
                        
                        adjustToWeekday(date);
                        const alertDays = Array.isArray(formData.alertDaysBefore) ? formData.alertDaysBefore : [3, 2, 1, 0];
                        
                        const isToday = date.toDateString() === new Date().toDateString();
                                  const isPast = date < new Date() && !isToday;
                        
                        return (
                                    <div
                                      key={i}
                                      className={cn('flex items-center justify-between p-3 rounded-md border',
                                        isToday ? 'bg-info-muted border-info-muted' :
                                        isPast ? 'bg-muted border-border' : 'bg-success-muted border-success-muted'
                                      )}
                                    >
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                                          <span className={cn('text-xs font-semibold',
                                isToday ? 'text-info-muted-foreground' :
                                            isPast ? 'text-muted-foreground' : 'text-success'
                              )}>
                                {date.toLocaleDateString('es-ES', {
                                  weekday: 'short',
                                  day: 'numeric',
                                              month: 'short',
                                              year: 'numeric'
                                })}
                              </span>
                              {isToday && (
                                            <Badge variant="outline" className="text-xs bg-info-muted text-info-muted-foreground border-info-muted">
                                              HOY
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Alertas: {alertDays.map(d => d === 0 ? 'el mismo día' : `${d} día${d > 1 ? 's' : ''} antes`).join(', ')}
                                        </p>
                            </div>
                          </div>
                        );
                      })}
                              </div>
                            </ScrollArea>

                            {/* Resumen Automático */}
                            <div className="mt-4 p-4 bg-muted/50 border rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                <p className="text-xs font-semibold">
                                  Reglas activas
                          </p>
                        </div>
                              <ul className="space-y-1.5 text-xs text-muted-foreground">
                                <li>• Se repetirá automáticamente cada <strong className="text-foreground">{formData.frequencyDays} días</strong></li>
                                <li>• Alertas: <strong className="text-foreground">
                    {Array.isArray(formData.alertDaysBefore) ? 
                      formData.alertDaysBefore.map(days => 
                        days === 0 ? 'el mismo día' : `${days} día${days > 1 ? 's' : ''} antes`
                      ).join(', ') : 
                      '3, 2, 1 días antes y el mismo día'
                    }
                                </strong></li>
                                <li>• <strong className="text-foreground">Solo días laborables</strong> (lunes a viernes)</li>
                                <li>• Ventana: <strong className="text-foreground">{getExecutionWindowText(formData.executionWindow)}</strong></li>
                                <li>• Duración: <strong className="text-foreground">{formData.timeValue} {getTimeUnitText(formData.timeUnit).toLowerCase()}</strong></li>
                              </ul>
                      </div>
                    </div>
                  ) : (
                          <EmptyState
                            icon={Calendar}
                            title="Configure fecha y frecuencia"
                            subtitle="Para ver las próximas fechas programadas"
                          />
                        )}
                      </SectionCard>
                    </div>
                  </TabsContent>

                  {/* Paso: Resumen */}
                  <TabsContent value="summary" className="space-y-6 mt-0">
                    <SectionCard
                      title="Resumen del Mantenimiento Preventivo"
                      icon={Info}
                      description="Revise la información antes de crear el mantenimiento preventivo"
                    >
                      <div className="space-y-6">
                        {/* Información General */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-foreground">Información General</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5">Título</p>
                              <p className="text-sm font-medium">{formData.title || 'Sin título'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5">Prioridad</p>
                              <Badge className={getPriorityColor(formData.priority)}>
                                {getPriorityText(formData.priority)}
                              </Badge>
                            </div>
                            {formData.description && (
                              <div className="md:col-span-2">
                                <p className="text-xs text-muted-foreground mb-1.5">Descripción</p>
                                <p className="text-sm">{formData.description}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <Separator />

                        {/* Equipamiento */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-foreground">Equipamiento</h4>
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5">Máquina</p>
                              <p className="text-sm font-medium">{selectedMachine?.name || 'No seleccionada'}</p>
                            </div>
                            {selectedComponents.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1.5">Componentes ({selectedComponents.length})</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {selectedComponents.map(c => (
                                    <Badge key={c.id} variant="outline">{c.name}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {selectedSubcomponents.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1.5">Subcomponentes ({selectedSubcomponents.length})</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {selectedSubcomponents.map(s => (
                                    <Badge key={s.id} variant="outline">{s.name}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <Separator />

                        {/* Asignación */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-foreground">Asignación</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5">Técnico</p>
                              <p className="text-sm font-medium">
                                {formData.assignedToId === 'none' 
                                  ? 'Sin asignar' 
                                  : users.find(u => u.id.toString() === formData.assignedToId)?.name || 'No encontrado'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5">Estado</p>
                              <Badge variant={formData.isActive ? 'default' : 'secondary'}>
                                {formData.isActive ? 'Activo' : 'Inactivo'}
                              </Badge>
                            </div>
                            {formData.notes && (
                              <div className="md:col-span-2">
                                <p className="text-xs text-muted-foreground mb-1.5">Notas</p>
                                <p className="text-sm">{formData.notes}</p>
                              </div>
                            )}
                          </div>
            </div>

                        <Separator />

                        {/* Programación */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-foreground">Programación</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5">Fecha de inicio</p>
                              <p className="text-sm font-medium">{formatDateForDisplay(formData.startDate) || 'No definida'}</p>
                  </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5">Frecuencia</p>
                              <p className="text-sm font-medium">Cada {formData.frequencyDays} día{formData.frequencyDays !== 1 ? 's' : ''}</p>
                  </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5">Próxima ejecución</p>
                              <p className="text-sm font-medium">{formatDateForDisplay(calculateNextExecutionDate() || '') || 'No calculada'}</p>
                  </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5">Ventana de ejecución</p>
                              <p className="text-sm font-medium">{getExecutionWindowText(formData.executionWindow)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5">Tiempo estimado</p>
                              <p className="text-sm font-medium">{formData.timeValue} {getTimeUnitText(formData.timeUnit).toLowerCase()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5">Alertas</p>
                              <div className="flex flex-wrap gap-1">
                                {Array.isArray(formData.alertDaysBefore) && formData.alertDaysBefore.map(days => (
                                  <Badge key={days} variant="outline" className="text-xs">
                                    {days === 0 ? 'El mismo día' : `${days} día${days > 1 ? 's' : ''} antes`}
                    </Badge>
                                ))}
                    </div>
                  </div>
                </div>
                        </div>

                        <Separator />

                        {/* Recursos */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-foreground">Recursos</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5">Herramientas seleccionadas</p>
                              <p className="text-sm font-medium">{selectedTools.length} herramienta{selectedTools.length !== 1 ? 's' : ''}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5">Instructivos</p>
                              <p className="text-sm font-medium">{instructives.length} archivo{instructives.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </SectionCard>
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
