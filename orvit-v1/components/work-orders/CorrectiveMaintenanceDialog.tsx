'use client';

import { useState, useEffect } from 'react';
import { Machine, MachineComponent, Priority } from '@/lib/types';
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
  Wrench,
  AlertTriangle,
  User,
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
  Calendar,
  Clock,
  CheckCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMachinesInitial } from '@/hooks/use-machines-initial';

interface CorrectiveMaintenanceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: any) => void;
  editingMaintenance?: any;
  mode?: 'create' | 'edit';
  preselectedMachineId?: number;
  preselectedComponentId?: string | number;
  failureData?: any; // Datos de la falla pre-cargados
}

interface ToolRequest {
  id: string;
  name: string;
  quantity: number;
}

export default function CorrectiveMaintenanceDialog({
  isOpen,
  onClose,
  onSave,
  editingMaintenance,
  mode = 'create',
  preselectedMachineId,
  preselectedComponentId,
  failureData
}: CorrectiveMaintenanceDialogProps) {
  const { currentCompany, currentSector } = useCompany();
  const { user } = useAuth();
  
  // Estados del formulario
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [machineId, setMachineId] = useState<number | ''>('');
  const [componentIds, setComponentIds] = useState<string[]>([]);
  const [subcomponentIds, setSubcomponentIds] = useState<string[]>([]);
  const [assignedToId, setAssignedToId] = useState<string>('none');
  const [estimatedHours, setEstimatedHours] = useState<number>(2);
  const [failureDescription, setFailureDescription] = useState('');
  const [failureDate, setFailureDate] = useState('');
  const [failureTime, setFailureTime] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [solution, setSolution] = useState('');
  const [notes, setNotes] = useState('');
  const [toolsRequired, setToolsRequired] = useState<ToolRequest[]>([]);
  const [instructives, setInstructives] = useState<File[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [failureFiles, setFailureFiles] = useState<File[]>([]);
  
  // ✨ OPTIMIZADO: Usar hook con React Query para máquinas
  const companyIdNum = currentCompany?.id ? parseInt(String(currentCompany.id)) : null;
  const sectorIdNum = currentSector?.id ? parseInt(String(currentSector.id)) : null;
  const { data: machinesData } = useMachinesInitial(
    companyIdNum,
    sectorIdNum,
    { enabled: isOpen && !!companyIdNum && !!sectorIdNum }
  );
  const machines = (machinesData?.machines || []) as Machine[];

  // Estados de datos
  const [components, setComponents] = useState<MachineComponent[]>([]);
  const [subcomponents, setSubcomponents] = useState<any[]>([]);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [loadingSubcomponents, setLoadingSubcomponents] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      if (editingMaintenance) {
        loadEditingData();
      } else if (failureData) {
        loadFailureData();
      } else {
        resetForm();
        if (preselectedMachineId) {
          setMachineId(preselectedMachineId);
        }
        if (preselectedComponentId) {
          setComponentIds([preselectedComponentId.toString()]);
        }
      }
    }
  }, [isOpen, editingMaintenance, failureData, preselectedMachineId, preselectedComponentId]);

  // ✨ OPTIMIZADO: Máquinas vienen del hook, solo cargar usuarios
  const loadInitialData = async () => {
    if (!currentCompany?.id) return;
    
    try {
      // Cargar usuarios
      const usersResponse = await fetch(`/api/companies/${currentCompany?.id}/users`);
      
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(Array.isArray(usersData) ? usersData : []);
      }
    } catch (error) {
      console.error('❌ [CORRECTIVE] Error loading initial data:', error);
    }
  };

  const loadEditingData = () => {
    if (!editingMaintenance) return;
    
    setTitle(editingMaintenance.title || '');
    setDescription(editingMaintenance.description || '');
    setPriority(editingMaintenance.priority || 'MEDIUM');
    setMachineId(editingMaintenance.machineId?.toString() || editingMaintenance.machine?.id?.toString() || '');
    
    // Manejar componentes (convertir de single a multiple)
    if (editingMaintenance.componentId || editingMaintenance.component?.id) {
      const componentId = editingMaintenance.componentId?.toString() || editingMaintenance.component?.id?.toString();
      setComponentIds(componentId ? [componentId] : []);
    } else if (editingMaintenance.componentIds) {
      setComponentIds(editingMaintenance.componentIds.map(id => id.toString()));
    } else {
      setComponentIds([]);
    }
    
    // Manejar subcomponentes
    if (editingMaintenance.subcomponentIds) {
      setSubcomponentIds(editingMaintenance.subcomponentIds.map(id => id.toString()));
    } else {
      setSubcomponentIds([]);
    }
    
    setAssignedToId(editingMaintenance.assignedToId?.toString() || editingMaintenance.assignedTo?.id?.toString() || editingMaintenance.assignedWorker?.id?.toString() || 'none');
    setEstimatedHours(editingMaintenance.estimatedHours || 2);
    setFailureDescription(editingMaintenance.failureDescription || '');
    setFailureDate(editingMaintenance.failureDate || '');
    setFailureTime(editingMaintenance.failureTime || '');
    setRootCause(editingMaintenance.rootCause || '');
    setSolution(editingMaintenance.solution || '');
    setNotes(editingMaintenance.notes || '');
    
    // Cargar herramientas
    if (editingMaintenance.toolsRequired || editingMaintenance.tools) {
      const tools = editingMaintenance.toolsRequired || editingMaintenance.tools || [];
      setToolsRequired(tools);
    }
    
    // Cargar instructivos
    if (editingMaintenance.instructives || editingMaintenance.instructiveFiles) {
      const instructives = editingMaintenance.instructives || editingMaintenance.instructiveFiles || [];
      setInstructives(instructives);
    }
  };

  const loadFailureData = async () => {
    if (!failureData) return;
    
    setTitle(failureData.title || '');
    setDescription(failureData.description || '');
    setPriority(failureData.priority || 'MEDIUM');
    setMachineId(failureData.machineId?.toString() || '');
    
    // Separar componentes y subcomponentes de affectedComponents
    const componentIds = [];
    const subcomponentIds = [];
    
    if (failureData.affectedComponents && failureData.affectedComponents.length > 0) {
      // Primero cargar todos los componentes para poder identificar cuáles son componentes vs subcomponentes
      const componentsResponse = await fetch(`/api/maquinas/${failureData.machineId}/components`);
      if (componentsResponse.ok) {
        const componentsData = await componentsResponse.json();
        const allComponents = Array.isArray(componentsData) ? componentsData : [];
        setComponents(allComponents);
        
        // Identificar cuáles son componentes y cuáles subcomponentes
        for (const affectedId of failureData.affectedComponents) {
          const isComponent = allComponents.some(comp => comp.id.toString() === affectedId.toString());
          if (isComponent) {
            componentIds.push(affectedId.toString());
          } else {
            subcomponentIds.push(affectedId.toString());
          }
        }
        
        setComponentIds(componentIds);
        setSubcomponentIds(subcomponentIds);
        
        // Cargar subcomponentes para mostrar sus nombres
        if (componentIds.length > 0) {
          const allSubcomponents: any[] = [];
          for (const componentId of componentIds) {
            const response = await fetch(`/api/components/${componentId}/subcomponents`);
            if (response.ok) {
              const data = await response.json();
              if (Array.isArray(data)) {
                allSubcomponents.push(...data);
              }
            }
          }
          setSubcomponents(allSubcomponents);
        }
      }
    }
    
    setEstimatedHours(failureData.estimatedTime || 2);
    setFailureDescription(failureData.description || '');
    setFailureDate(failureData.reportDate || '');
    setFailureTime(new Date().toTimeString().split(' ')[0]); // Hora actual
    
    // Cargar archivos de la falla como instructivos
    if (failureData.files && failureData.files.length > 0) {
      setInstructives(failureData.files);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setMachineId('');
    setComponentIds([]);
    setSubcomponentIds([]);
    setAssignedToId('none');
    setEstimatedHours(2);
    setFailureDescription('');
    setFailureDate('');
    setFailureTime('');
    setRootCause('');
    setSolution('');
    setNotes('');
    setToolsRequired([]);
    setInstructives([]);
    setPhotos([]);
    setFailureFiles([]);
  };

  const handleMachineChange = async (machineId: string) => {
    setMachineId(Number(machineId));
    setComponentIds([]);
    setSubcomponentIds([]);
    setComponents([]);
    setSubcomponents([]);
    
    if (machineId) {
      try {
        setLoadingComponents(true);
        const response = await fetch(`/api/maquinas/${machineId}/components`);
        
        if (response.ok) {
          const data = await response.json();
          setComponents(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        // Error silencioso
      } finally {
        setLoadingComponents(false);
      }
    }
  };

  const handleComponentChange = async (componentIds: string[]) => {
    setComponentIds(componentIds);
    setSubcomponentIds([]);
    setSubcomponents([]);
    
    if (componentIds.length > 0) {
      try {
        setLoadingSubcomponents(true);
        const allSubcomponents: any[] = [];
        
        for (const componentId of componentIds) {
          const response = await fetch(`/api/components/${componentId}/subcomponents`);
          
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
              allSubcomponents.push(...data);
            }
          }
        }
        
        setSubcomponents(allSubcomponents);
      } catch (error) {
        // Error silencioso
      } finally {
        setLoadingSubcomponents(false);
      }
    }
  };

  const addTool = () => {
    const newTool: ToolRequest = {
      id: Date.now().toString(),
      name: '',
      quantity: 1
    };
    setToolsRequired([...toolsRequired, newTool]);
  };

  const removeTool = (toolId: string) => {
    setToolsRequired(toolsRequired.filter(tool => tool.id !== toolId));
  };

  const updateTool = (toolId: string, field: 'name' | 'quantity', value: string | number) => {
    setToolsRequired(toolsRequired.map(tool => 
      tool.id === toolId ? { ...tool, [field]: value } : tool
    ));
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setPhotos(prev => [...prev, ...files]);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleInstructiveChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setInstructives(prev => [...prev, ...files]);
  };

  const removeInstructive = (index: number) => {
    setInstructives(prev => prev.filter((_, i) => i !== index));
  };

  const handleFailureFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast({
          title: 'Archivo demasiado grande',
          description: `${file.name} excede el límite de 10MB`,
          variant: 'destructive'
        });
        return false;
      }
      
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Tipo de archivo no soportado',
          description: `${file.name} no es un tipo de archivo válido`,
          variant: 'destructive'
        });
        return false;
      }
      
      return true;
    });

    if (validFiles.length > 0) {
      setFailureFiles(prev => [...prev, ...validFiles]);
      toast({
        title: 'Archivos agregados',
        description: `Se agregaron ${validFiles.length} archivo(s) de falla`
      });
    }
    
    // Limpiar el input
    event.target.value = '';
  };

  const removeFailureFile = (index: number) => {
    setFailureFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title || !machineId || !failureDescription) {
      toast({
        title: 'Campos requeridos',
        description: 'Por favor completa todos los campos obligatorios',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const maintenanceData = {
        title,
        description,
        priority,
        machineId: Number(machineId),
        componentIds: componentIds.map(id => Number(id)),
        subcomponentIds: subcomponentIds.map(id => Number(id)),
        assignedToId: assignedToId ? Number(assignedToId) : null,
        estimatedHours,
        failureDescription,
        failureDate,
        failureTime,
        rootCause,
        solution,
        notes,
        toolsRequired: toolsRequired.filter(tool => tool.name.trim()),
        photos: photos,
        instructives: instructives,
        failureFiles: failureFiles,
        companyId: currentCompany?.id,
        sectorId: currentSector?.id,
        createdById: user?.id,
        type: 'CORRECTIVE'
      };

      if (onSave) {
        // Crear FormData para incluir archivos
        const formData = new FormData();
        
        // Agregar todos los datos del mantenimiento
        formData.append('title', maintenanceData.title);
        formData.append('description', maintenanceData.description || '');
        formData.append('priority', maintenanceData.priority);
        formData.append('estimatedHours', maintenanceData.estimatedHours.toString());
        formData.append('notes', maintenanceData.notes || '');
        formData.append('companyId', maintenanceData.companyId.toString());
        if (maintenanceData.machineId) formData.append('machineId', maintenanceData.machineId.toString());
        if (maintenanceData.assignedToId) formData.append('assignedToId', maintenanceData.assignedToId.toString());
        if (maintenanceData.sectorId) formData.append('sectorId', maintenanceData.sectorId.toString());
        if (maintenanceData.createdById) formData.append('createdBy', maintenanceData.createdById.toString());
        
        // Agregar datos específicos de fallas
        formData.append('failureDescription', maintenanceData.failureDescription || '');
        formData.append('failureDate', maintenanceData.failureDate || '');
        formData.append('failureTime', maintenanceData.failureTime || '');
        formData.append('rootCause', maintenanceData.rootCause || '');
        formData.append('solution', maintenanceData.solution || '');
        
        // Agregar archivos de instructivos
        instructives.forEach((file) => {
          formData.append('instructivesFiles', file);
        });
        
        // Agregar archivos de fallas
        failureFiles.forEach((file) => {
          formData.append('failureFiles', file);
        });
        
        // Llamar al API directamente
        try {
          const response = await fetch('/api/maintenance/corrective', {
            method: 'POST',
            body: formData
          });
          
          if (response.ok) {
            
            toast({
              title: 'Mantenimiento Correctivo Creado',
              description: 'El mantenimiento correctivo se ha registrado exitosamente'
            });
            
            resetForm();
            onClose();
            
            // Llamar onSave con los datos para actualizar la UI
            onSave(result.maintenance);
            return;
          } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al crear mantenimiento');
          }
        } catch (error) {
          console.error('❌ Error creando mantenimiento correctivo:', error);
          toast({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Error al crear el mantenimiento',
            variant: 'destructive'
          });
          return;
        }
      }
      
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error saving corrective maintenance:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el mantenimiento correctivo',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // console.log('🔍 [CORRECTIVE] Render - machines:', machines);
  // console.log('🔍 [CORRECTIVE] Render - currentSector:', currentSector);
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent size="xl" className="p-0 flex flex-col overflow-hidden h-[85vh]">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <div className="bg-orange-100 p-2 rounded-lg">
              <Wrench className="h-6 w-6 text-orange-600" />
            </div>
            {mode === 'edit' ? 'Editar Mantenimiento Correctivo' : 'Nuevo Mantenimiento Correctivo'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit' ? 'Modifica la información del mantenimiento correctivo' : 'Registra un mantenimiento correctivo para reparar una falla'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex-1 overflow-y-auto px-6 py-4">

         <Tabs defaultValue="general" className="w-full">
                       <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">Información General</TabsTrigger>
              <TabsTrigger value="failures">Fallas</TabsTrigger>
              <TabsTrigger value="tools">Herramientas y Repuestos</TabsTrigger>
              <TabsTrigger value="instructives">Instructivos</TabsTrigger>
            </TabsList>

           <TabsContent value="general" className="space-y-6">
             <form className="space-y-6">
           {/* Título y Fecha */}
           <div className="grid grid-cols-2 gap-4">
             <div>
               <Label htmlFor="title">Título *</Label>
               <Input
                 id="title"
                 value={title}
                 onChange={(e) => setTitle(e.target.value)}
                 placeholder="Ej: Reparación bomba hidráulica"
                 required
               />
             </div>
             <div>
               <Label htmlFor="priority">Prioridad *</Label>
               <Select value={priority} onValueChange={(value: Priority) => setPriority(value)}>
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
           </div>

           {/* Descripción */}
           <div>
             <Label htmlFor="description">Descripción</Label>
             <Textarea
               id="description"
               value={description}
               onChange={(e) => setDescription(e.target.value)}
               placeholder="Descripción detallada del mantenimiento"
               className="min-h-[100px]"
             />
           </div>

           {/* Demora en Corrección */}
           <div>
             <Label htmlFor="estimatedHours">Demora en Corrección</Label>
             <div className="flex gap-2">
               <Input
                 id="estimatedHours"
                 type="number"
                 placeholder="0"
                 min="0"
                 step="0.5"
                 value={estimatedHours}
                 onChange={(e) => setEstimatedHours(Number(e.target.value))}
                 className="flex-1"
               />
               <Select value="hours" disabled>
                 <SelectTrigger className="w-24">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="hours">Horas</SelectItem>
                 </SelectContent>
               </Select>
             </div>
           </div>

           {/* Equipamiento Seleccionado */}
           <div>
             <Label className="mb-3 block">Equipamiento Seleccionado</Label>
             <Card>
               <CardHeader>
                 <CardTitle className="text-sm">Equipamiento de la Falla</CardTitle>
               </CardHeader>
               <CardContent className="space-y-4">
                 {/* Máquina */}
                 <div>
                   <Label>Máquina</Label>
                   <div className="p-3 bg-gray-50 rounded-md border">
                     <span className="text-sm font-medium">
                       {machines.find(m => m.id.toString() === machineId?.toString())?.name || 'No seleccionada'}
                     </span>
                   </div>
                 </div>

                 {/* Componentes */}
                 <div>
                   <Label>Componentes</Label>
                   <div className="p-3 bg-gray-50 rounded-md border min-h-[60px]">
                     {componentIds.length === 0 ? (
                       <p className="text-sm text-muted-foreground">No hay componentes seleccionados</p>
                     ) : (
                       <div className="space-y-1">
                         {componentIds.map((componentId) => {
                           const component = components.find(c => c.id.toString() === componentId);
                           return component ? (
                             <div key={componentId} className="flex items-center space-x-2">
                               <CheckCircle className="h-4 w-4 text-green-500" />
                               <span className="text-sm">{component.name}</span>
                             </div>
                           ) : null;
                         })}
                       </div>
                     )}
                   </div>
                 </div>

                 {/* Subcomponentes */}
                 <div>
                   <Label>Subcomponentes</Label>
                   <div className="p-3 bg-gray-50 rounded-md border min-h-[60px]">
                     {subcomponentIds.length === 0 ? (
                       <p className="text-sm text-muted-foreground">No hay subcomponentes seleccionados</p>
                     ) : (
                       <div className="space-y-1">
                         {subcomponentIds.map((subcomponentId) => {
                           const subcomponent = subcomponents.find(s => s.id.toString() === subcomponentId);
                           return subcomponent ? (
                             <div key={subcomponentId} className="flex items-center space-x-2">
                               <CheckCircle className="h-4 w-4 text-green-500" />
                               <span className="text-sm">{subcomponent.name}</span>
                             </div>
                           ) : null;
                         })}
                       </div>
                     )}
                   </div>
                 </div>
               </CardContent>
             </Card>
           </div>

           {/* Usuario Asignado */}
           <div>
             <Label htmlFor="assignedTo">Asignar a (opcional)</Label>
             <Select value={assignedToId} onValueChange={setAssignedToId}>
               <SelectTrigger>
                 <SelectValue placeholder="Seleccionar usuario" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="none">Sin asignar</SelectItem>
                 {Array.isArray(users) && users.map((user) => (
                   <SelectItem key={user.id} value={user.id.toString()}>
                     {user.name}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>

             {/* Botones */}
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const tabsList = document.querySelector('[role="tablist"]');
                  const nextTab = tabsList?.querySelector('[data-state="inactive"][value="failures"]');
                  if (nextTab) {
                    (nextTab as HTMLElement).click();
                  }
                }}
              >
                Siguiente
              </Button>
            </div>
             </form>
           </TabsContent>

           <TabsContent value="failures" className="space-y-6">
             <form className="space-y-6">
               {/* Descripción de la Falla */}
               <div>
                 <Label htmlFor="failureDescription">Descripción de la Falla *</Label>
                 <Textarea
                   id="failureDescription"
                   value={failureDescription}
                   onChange={(e) => setFailureDescription(e.target.value)}
                   placeholder="Describe detalladamente la falla encontrada..."
                   className="min-h-[120px]"
                   required
                 />
               </div>

               {/* Fecha y Hora de la Falla */}
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <Label htmlFor="failureDate">Fecha de la Falla</Label>
                   <DatePicker
                     value={failureDate}
                     onChange={(date) => setFailureDate(date)}
                     placeholder="Seleccionar fecha"
                     clearable
                   />
                 </div>
                 <div>
                   <Label htmlFor="failureTime">Hora de la Falla</Label>
                   <Input
                     id="failureTime"
                     type="time"
                     value={failureTime}
                     onChange={(e) => setFailureTime(e.target.value)}
                   />
                 </div>
               </div>

               {/* Causa Raíz */}
               <div>
                 <Label htmlFor="rootCause">Causa Raíz</Label>
                 <Textarea
                   id="rootCause"
                   value={rootCause}
                   onChange={(e) => setRootCause(e.target.value)}
                   placeholder="Análisis de la causa raíz de la falla..."
                   className="min-h-[100px]"
                 />
               </div>

               {/* Solución Aplicada */}
               <div>
                 <Label htmlFor="solution">Solución Aplicada</Label>
                 <Textarea
                   id="solution"
                   value={solution}
                   onChange={(e) => setSolution(e.target.value)}
                   placeholder="Describe la solución aplicada o a aplicar..."
                   className="min-h-[100px]"
                 />
               </div>

               {/* Archivos de la Falla */}
               <div>
                 <Label className="mb-3 block">Archivos de la Falla</Label>
                 <Card>
                   <CardHeader>
                     <CardTitle className="text-sm flex items-center gap-2">
                       <Upload className="h-4 w-4" />
                       Documentos de Evidencia
                     </CardTitle>
                     <CardDescription className="text-xs">
                       Sube fotos, documentos y evidencia de la falla (PDF, DOC, XLS, imágenes hasta 10MB cada uno)
                     </CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-4">
                     {/* Área de carga */}
                     <div>
                       <input
                         id="failure-files-input"
                         type="file"
                         multiple
                         accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt"
                         onChange={handleFailureFileUpload}
                         className="hidden"
                       />
                       <label
                         htmlFor="failure-files-input"
                         className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors"
                         onClick={() => {
                           const input = document.getElementById('failure-files-input') as HTMLInputElement;
                           if (input) {
                             input.click();
                           }
                         }}
                         onDragOver={(e) => {
                           e.preventDefault();
                           e.currentTarget.classList.add('border-blue-400', 'bg-blue-50');
                         }}
                         onDragLeave={(e) => {
                           e.preventDefault();
                           e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
                         }}
                         onDrop={(e) => {
                           e.preventDefault();
                           e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
                           const files = Array.from(e.dataTransfer.files);
                           files.forEach(file => {
                             const event = {
                               target: { files: [file] }
                             } as React.ChangeEvent<HTMLInputElement>;
                             handleFailureFileUpload(event);
                           });
                         }}
                       >
                         <div className="text-center">
                           <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                           <p className="text-sm text-gray-600">Haz clic o arrastra archivos de falla aquí</p>
                           <p className="text-xs text-gray-500">PDF, DOC, XLS, imágenes hasta 10MB cada uno</p>
                         </div>
                       </label>
                     </div>
                     
                     {/* Lista de archivos de falla */}
                     {failureFiles.length > 0 && (
                       <div className="mt-3 space-y-2">
                         <h4 className="text-sm font-medium text-gray-700">Archivos de Falla ({failureFiles.length})</h4>
                         {failureFiles.map((file, index) => (
                           <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded border border-red-200">
                             <div className="flex items-center gap-2">
                               <FileText className="h-4 w-4 text-red-600" />
                               <span className="text-sm truncate font-medium">{file.name}</span>
                               <span className="text-xs text-gray-500">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                             </div>
                             <Button
                               type="button"
                               variant="ghost"
                               size="sm"
                               onClick={() => removeFailureFile(index)}
                               className="text-red-600 hover:text-red-800 hover:bg-red-100"
                             >
                               <Trash2 className="h-4 w-4" />
                             </Button>
                           </div>
                         ))}
                       </div>
                     )}
                   </CardContent>
                 </Card>
               </div>

               {/* Botones */}
               <div className="flex justify-between">
                 <Button
                   type="button"
                   variant="outline"
                   size="sm"
                   onClick={() => {
                     const tabsList = document.querySelector('[role="tablist"]');
                     const prevTab = tabsList?.querySelector('[data-state="inactive"][value="general"]');
                     if (prevTab) {
                       (prevTab as HTMLElement).click();
                     }
                   }}
                 >
                   Anterior
                 </Button>
                 <div className="flex space-x-2">
                   <Button type="button" variant="outline" size="sm" onClick={handleClose}>
                     Cancelar
                   </Button>
                   <Button
                     type="button"
                     size="sm"
                     onClick={() => {
                       const tabsList = document.querySelector('[role="tablist"]');
                       const nextTab = tabsList?.querySelector('[data-state="inactive"][value="tools"]');
                       if (nextTab) {
                         (nextTab as HTMLElement).click();
                       }
                     }}
                   >
                     Siguiente
                   </Button>
                 </div>
               </div>
             </form>
           </TabsContent>

           <TabsContent value="tools" className="space-y-6">
              {/* Productos Disponibles del Pañol */}
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  Productos Disponibles del Pañol
                </h3>
                <p className="text-sm text-muted-foreground">
                  Seleccione herramientas generales y repuestos específicos para este mantenimiento
                </p>
              </div>

              {/* Herramientas Generales y Repuestos Específicos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Herramientas Generales */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Wrench className="h-4 w-4 text-gray-600" />
                      Herramientas Generales
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Herramientas del pañol de uso general
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Buscador */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Buscar herramientas..."
                        className="pl-10"
                      />
                    </div>
                    
                    {/* Lista de herramientas */}
                    <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                      <div className="text-center py-8">
                        <Wrench className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                        <p className="text-sm text-gray-500">No hay herramientas disponibles</p>
                        <p className="text-xs text-gray-400">Las herramientas se cargarán desde el pañol</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Repuestos Específicos */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Cog className="h-4 w-4 text-gray-600" />
                      Repuestos Específicos
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Repuestos asociados a la máquina seleccionada
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Buscador */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Buscar repuestos..."
                        className="pl-10"
                      />
                    </div>
                    
                    {/* Lista de repuestos */}
                    <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                      <div className="text-center py-8">
                        <Cog className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                        <p className="text-sm text-gray-500">Seleccione una máquina para ver sus repuestos específicos</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Productos Seleccionados */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Wrench className="h-4 w-4 text-gray-600" />
                    Productos Seleccionados ({toolsRequired.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {toolsRequired.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500">No hay productos seleccionados</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {toolsRequired.map((tool) => (
                        <div key={tool.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{tool.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Cantidad: {tool.quantity}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeTool(tool.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Botones de navegación */}
              <div className="flex justify-between space-x-2 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const tabsList = document.querySelector('[role="tablist"]');
                    const prevTab = tabsList?.querySelector('[data-state="inactive"][value="failures"]');
                    if (prevTab) {
                      (prevTab as HTMLElement).click();
                    }
                  }}
                >
                  Anterior
                </Button>
                <div className="flex space-x-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleClose}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const tabsList = document.querySelector('[role="tablist"]');
                      const nextTab = tabsList?.querySelector('[data-state="inactive"][value="instructives"]');
                      if (nextTab) {
                        (nextTab as HTMLElement).click();
                      }
                    }}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </TabsContent>

           <TabsContent value="instructives" className="space-y-6">
             {/* Archivos Instructivos */}
             <div>
               <Label>Archivos Instructivos</Label>
               <div className="mt-2">
                 <input
                   multiple
                   accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif"
                   className="hidden"
                   id="instructive-files-input"
                   type="file"
                   onChange={handleInstructiveChange}
                 />
                 <label
                   htmlFor="instructive-files-input"
                   className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors"
                 >
                   <div className="text-center">
                     <FileText className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                     <p className="text-sm text-gray-600">Haz clic o arrastra archivos instructivos aquí</p>
                     <p className="text-xs text-gray-500">PDF, DOC, XLS, imágenes hasta 10MB cada uno</p>
                   </div>
                 </label>
               </div>
               
               {/* Lista de archivos instructivos */}
               {instructives.length > 0 && (
                 <div className="mt-3 space-y-2">
                   {instructives.map((file, index) => (
                     <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                       <span className="text-sm truncate">{file.name}</span>
                       <Button
                         type="button"
                         variant="ghost"
                         size="sm"
                         onClick={() => removeInstructive(index)}
                       >
                         <X className="h-4 w-4" />
                       </Button>
                     </div>
                   ))}
                 </div>
               )}
             </div>
             
             {/* Botones finales */}
             <div className="flex justify-between space-x-2 pt-6">
               <Button
                 type="button"
                 variant="outline"
                 size="sm"
                 onClick={() => {
                   const tabsList = document.querySelector('[role="tablist"]');
                   const prevTab = tabsList?.querySelector('[data-state="inactive"][value="tools"]');
                   if (prevTab) {
                     (prevTab as HTMLElement).click();
                   }
                 }}
               >
                 Anterior
               </Button>
               <div className="flex space-x-2">
                 <Button type="button" variant="outline" size="sm" onClick={handleClose}>
                   Cancelar
                 </Button>
                 <Button
                   type="button"
                   size="sm"
                   onClick={handleSubmit}
                   disabled={loading}
                 >
                   {loading ? 'Guardando...' : mode === 'edit' ? 'Actualizar' : 'Crear Mantenimiento'}
                 </Button>
               </div>
             </div>
           </TabsContent>
         </Tabs>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
