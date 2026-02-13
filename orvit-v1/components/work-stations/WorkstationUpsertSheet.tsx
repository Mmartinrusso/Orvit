'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  FileText,
  Wrench,
  Plus,
  Edit,
  Trash2,
  Search,
  Grid3X3,
  List,
  X,
} from 'lucide-react';
import { WorkStation } from './WorkstationCard';
import InstructiveDialog from '@/components/mantenimiento/InstructiveDialog';
import WorkStationMachinesDialog from '@/components/mantenimiento/WorkStationMachinesDialog';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { Upload, Building2, Cog, Paperclip, Link2, Layers } from 'lucide-react';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import {
  InstructionUpsertSheet,
  InstructionPayload,
  ComponentNode,
  Machine as InstructionMachine,
  ComponentsTreeSelect
} from './instruction';

interface WorkstationUpsertSheetProps {
  workstation: WorkStation | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description?: string;
    code?: string;
    status: 'ACTIVE' | 'INACTIVE';
    sectorId?: number;
  }) => Promise<void>;
  onSuccess?: () => void;
  sectorName?: string;
  loading?: boolean;
  sectores?: Array<{ id: number; name: string }>;
}

interface Instructive {
  id: number;
  title: string;
  description?: string;
  content?: string;
  fileName?: string;
  machines?: Machine[];
}

interface Machine {
  id: number;
  name: string;
  type?: string;
}

export function WorkstationUpsertSheet({
  workstation,
  isOpen,
  onClose,
  onSave,
  onSuccess,
  sectorName,
  loading = false,
  sectores = [],
}: WorkstationUpsertSheetProps) {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    sectorId: undefined as number | undefined,
  });
  const [activeTab, setActiveTab] = useState('basica');
  const [instructives, setInstructives] = useState<Instructive[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [availableMachines, setAvailableMachines] = useState<Machine[]>([]);
  const [realMachinesOnly, setRealMachinesOnly] = useState<Machine[]>([]); // Solo máquinas reales (sin componentes)
  const realMachinesOnlyRef = useRef<Machine[]>([]); // Ref para evitar stale closures
  // Estados para instructivos y máquinas pendientes (antes de guardar)
  const [pendingInstructives, setPendingInstructives] = useState<Array<{
    id: string; // ID temporal
    title: string;
    content?: string; // Contenido HTML del editor
    description?: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    file?: File; // Archivo pendiente de subir
    machineIds?: number[]; // Máquinas asociadas al instructivo
    componentIds?: number[]; // Componentes asociados
    scope?: 'EQUIPMENT' | 'MACHINES' | 'COMPONENTS';
    attachments?: any[];
  }>>([]);
  const [pendingMachines, setPendingMachines] = useState<number[]>([]); // IDs de máquinas pendientes
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [justCreated, setJustCreated] = useState(false); // Flag para saber si se acaba de crear
  const justCreatedRef = useRef(false); // useRef para persistir a través de re-renders
  const [isInstructiveDialogOpen, setIsInstructiveDialogOpen] = useState(false);
  const [editingInstructive, setEditingInstructive] = useState<Instructive | null>(null);
  const [isMachinesDialogOpen, setIsMachinesDialogOpen] = useState(false);
  const [searchInstructives, setSearchInstructives] = useState('');
  const [searchMachines, setSearchMachines] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [instructiveToDelete, setInstructiveToDelete] = useState<number | string | null>(null);
  const [deleteMachineDialogOpen, setDeleteMachineDialogOpen] = useState(false);
  const [machineToDelete, setMachineToDelete] = useState<number | null>(null);
  const [selectedMachineIdsForDialog, setSelectedMachineIdsForDialog] = useState<string[]>([]);
  const [selectedComponentIdsForDialog, setSelectedComponentIdsForDialog] = useState<string[]>([]);
  const [componentsByMachine, setComponentsByMachine] = useState<Map<number, ComponentNode[]>>(new Map());

  // Cargar datos del formulario
  useEffect(() => {
    if (workstation) {
      setFormData({
        name: workstation.name,
        description: workstation.description || '',
        status: workstation.status === 'MAINTENANCE' ? 'ACTIVE' : workstation.status,
        sectorId: workstation.sectorId,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        status: 'ACTIVE',
        sectorId: undefined,
      });
    }
    // Resetear tab cuando se abre
    if (isOpen) {
      setActiveTab('basica');
    } else {
      // Limpiar pendientes al cerrar si no se guardó
      if (!workstation?.id) {
        setPendingInstructives([]);
        setPendingMachines([]);
      }
    }
  }, [workstation, isOpen]);

  // Cargar todas las máquinas disponibles de la empresa o del sector seleccionado
  useEffect(() => {
    if (isOpen && currentCompany?.id) {
      loadAllAvailableMachines();
    }
  }, [isOpen, currentCompany?.id, formData.sectorId]);

  // Cargar instructivos y máquinas si es edición
  useEffect(() => {
    if (isOpen && workstation?.id) {
      fetchDetails();
    } else {
      setInstructives([]);
      setMachines([]);
    }
  }, [isOpen, workstation?.id]);

  const loadAllAvailableMachines = async () => {
    try {
      const url = formData.sectorId
        ? `/api/machines-and-components?companyId=${currentCompany?.id}&sectorId=${formData.sectorId}&includeComponents=true`
        : `/api/machines-and-components?companyId=${currentCompany?.id}&includeComponents=true`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const allItems = data.machines || [];
        const machinesList: Machine[] = [];
        const realMachinesList: Machine[] = [];

        // Aplanar toda la jerarquía: máquinas, componentes y subcomponentes
        const extractAllItems = (items: any[], prefix: string = '', isTopLevel: boolean = true) => {
          for (const item of items) {
            const displayName = prefix ? `${prefix} › ${item.name || item.displayName}` : (item.name || item.displayName);

            machinesList.push({
              id: item.id,
              name: displayName,
              type: item.type || (isTopLevel ? 'MACHINE' : 'COMPONENT'),
            });

            // Solo las máquinas de nivel superior son máquinas reales
            if (isTopLevel && item.type === 'MACHINE') {
              realMachinesList.push({
                id: item.id,
                name: item.name || item.displayName,
                type: 'MACHINE',
              });
            }

            // Recorrer hijos para agregar componentes y subcomponentes con indentación
            if (item.children && item.children.length > 0) {
              extractAllItems(item.children, displayName, false);
            }
          }
        };

        extractAllItems(allItems);
        console.log('📋 Total items aplanados:', machinesList.length);
        console.log('🔧 Máquinas reales (solo nivel superior):', realMachinesList.length, realMachinesList.map(m => ({ id: m.id, name: m.name })));
        setAvailableMachines(machinesList);
        setRealMachinesOnly(realMachinesList);
        realMachinesOnlyRef.current = realMachinesList; // Actualizar ref también
      }
    } catch (error) {
      console.error('Error cargando máquinas disponibles:', error);
    }
  };

  const fetchDetails = async () => {
    if (!workstation?.id) return;
    
    try {
      setLoadingDetails(true);
      const response = await fetch(`/api/work-stations/${workstation.id}`);
      if (response.ok) {
        const data = await response.json();
        setInstructives(data.instructives || []);
        setMachines(data.machines?.map((m: any) => ({ id: m.machineId || m.id, name: m.machine?.name || m.name })) || []);
      }
    } catch (error) {
      console.error('Error fetching details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      const wasNew = !workstation?.id;
      const hasPendingItems = pendingInstructives.length > 0 || pendingMachines.length > 0;

      console.log('💾 [SUBMIT] Guardando workstation:', {
        wasNew,
        hasPendingItems,
        pendingInstructivesCount: pendingInstructives.length,
        pendingMachinesCount: pendingMachines.length
      });

      // Marcar ANTES de guardar para que el estado esté listo
      if (wasNew && hasPendingItems) {
        console.log('🚀 [SUBMIT] Estableciendo justCreated = true ANTES de onSave');
        setJustCreated(true);
        justCreatedRef.current = true; // También establecer en ref para persistir
      }

      await onSave({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        status: formData.status,
        code: workstation?.code,
        sectorId: formData.sectorId,
      });

      console.log('✅ [SUBMIT] onSave completado exitosamente');
    } catch (error) {
      console.error('❌ [SUBMIT] Error en onSave:', error);
      // Resetear flag si hubo error
      setJustCreated(false);
      justCreatedRef.current = false;
    }
  };

  // Asociar instructivos y máquinas pendientes después de crear el puesto
  useEffect(() => {
    console.log('🔍 [PENDING ITEMS] useEffect triggered:', {
      workstationId: workstation?.id,
      isEdit,
      justCreated,
      justCreatedRef: justCreatedRef.current,
      pendingInstructivesCount: pendingInstructives.length,
      pendingMachinesCount: pendingMachines.length,
      willAssociate: workstation?.id && (justCreated || justCreatedRef.current) && (pendingInstructives.length > 0 || pendingMachines.length > 0)
    });

    if (workstation?.id && (justCreated || justCreatedRef.current)) {
      if (pendingInstructives.length > 0 || pendingMachines.length > 0) {
        console.log('✅ [PENDING ITEMS] Llamando associatePendingItems');
        setJustCreated(false); // Reset flag inmediatamente para evitar llamadas duplicadas
        justCreatedRef.current = false; // También resetear ref

        // Usar setTimeout para asegurar que el workstation.id esté disponible
        setTimeout(() => {
          associatePendingItems();
        }, 100);
      } else {
        console.log('⚠️ [PENDING ITEMS] No hay items pendientes para asociar');
        setJustCreated(false);
        justCreatedRef.current = false;
      }
    }
  }, [workstation?.id, justCreated, pendingInstructives.length, pendingMachines.length]);

  const associatePendingItems = async () => {
    console.log('🚀 associatePendingItems - workstation.id:', workstation?.id);
    console.log('🚀 pendingInstructives:', pendingInstructives);
    console.log('🚀 pendingMachines:', pendingMachines);
    if (!workstation?.id) {
      console.error('❌ No hay workstation.id, abortando associatePendingItems');
      return;
    }

    let instructivesSuccess = 0;
    let instructivesError = 0;
    let machinesSuccess = 0;
    let machinesError = 0;

    try {
      // Asociar instructivos pendientes
      console.log('📋 Iniciando asociación de instructivos...');
      for (const pendingInstr of pendingInstructives) {
        try {
          console.log('📋 Procesando instructivo:', pendingInstr.title);
          let fileUrl = pendingInstr.fileUrl;

          // Si hay un archivo pendiente, subirlo primero
          if (pendingInstr.file) {
            console.log('📤 Subiendo archivo del instructivo...');
            const formData = new FormData();
            formData.append('file', pendingInstr.file);

            const uploadResponse = await fetch('/api/upload', {
              method: 'POST',
              body: formData,
            });

            if (uploadResponse.ok) {
              const uploadData = await uploadResponse.json();
              fileUrl = uploadData.url;
              console.log('✅ Archivo subido exitosamente:', fileUrl);
            } else {
              console.error('❌ Error subiendo archivo:', await uploadResponse.text());
            }
          }

          // Crear el instructivo
          console.log('📋 Creando instructivo en API...');
          const response = await fetch(`/api/work-stations/${workstation.id}/instructives`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: pendingInstr.title,
              description: pendingInstr.description,
              contentHtml: pendingInstr.content || pendingInstr.description,
              scope: pendingInstr.scope || 'EQUIPMENT',
              machineIds: pendingInstr.machineIds || [],
              componentIds: pendingInstr.componentIds || [],
              attachments: pendingInstr.attachments || [],
              fileUrl,
              fileName: pendingInstr.fileName,
              fileType: pendingInstr.fileType,
              fileSize: pendingInstr.fileSize,
            }),
          });

          if (response.ok) {
            console.log('✅ Instructivo creado exitosamente:', pendingInstr.title);
            instructivesSuccess++;
          } else {
            const errorText = await response.text();
            console.error('❌ Error creando instructivo:', errorText);
            instructivesError++;
          }
        } catch (error) {
          console.error('❌ Error asociando instructivo pendiente:', error);
          instructivesError++;
        }
      }

      // Asociar máquinas pendientes (solo máquinas, sin componentes)
      console.log('🔧 Iniciando asociación de máquinas...');
      console.log('🔧 Total de máquinas pendientes:', pendingMachines.length);

      // Asociar cada máquina
      for (const machineId of pendingMachines) {
        try {
          console.log('🔧 Asociando máquina ID:', machineId, 'al workstation:', workstation.id);
          const response = await fetch(`/api/work-stations/${workstation.id}/machines`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              machineId,
              isRequired: true,
              notes: null,
            }),
          });

          console.log('🔧 Response status para ID', machineId, ':', response.status);
          if (response.ok) {
            console.log('✅ Máquina asociada exitosamente:', machineId);
            machinesSuccess++;
          } else {
            const errorText = await response.text();
            console.error('❌ Error al asociar máquina:', machineId, '-', errorText);
            machinesError++;
          }
        } catch (error) {
          console.error('🔴 Excepción al asociar máquina:', machineId, '-', error);
          machinesError++;
        }
      }

      console.log('📊 Resumen de asociación:');
      console.log('  Instructivos exitosos:', instructivesSuccess, '/', pendingInstructives.length);
      console.log('  Instructivos con error:', instructivesError);
      console.log('  Máquinas exitosas:', machinesSuccess, '/', pendingMachines.length);
      console.log('  Máquinas con error:', machinesError);

      // Mostrar notificación al usuario
      const totalSuccess = instructivesSuccess + machinesSuccess;
      const totalError = instructivesError + machinesError;

      if (totalSuccess > 0) {
        toast({
          title: 'Asociación completada',
          description: `${instructivesSuccess} instructivo(s) y ${machinesSuccess} máquina(s) asociados correctamente.`,
          variant: 'default',
        });
      }

      if (totalError > 0) {
        toast({
          title: 'Errores en asociación',
          description: `${instructivesError} instructivo(s) y ${machinesError} máquina(s) fallaron. Revisa la consola.`,
          variant: 'destructive',
        });
      }

      // Limpiar pendientes y recargar detalles
      setPendingInstructives([]);
      setPendingMachines([]);
      console.log('🔄 Recargando detalles del workstation...');
      if (workstation.id) {
        fetchDetails();
      }
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('❌ Error general en associatePendingItems:', error);
      toast({
        title: 'Error',
        description: 'Error al asociar los elementos. Revisa la consola para más detalles.',
        variant: 'destructive',
      });
    }
  };

  const handleInstructiveSuccess = () => {
    setIsInstructiveDialogOpen(false);
    setEditingInstructive(null);
    if (workstation?.id) {
      fetchDetails();
    }
    if (onSuccess) onSuccess();
  };

  const handleMachinesSuccess = () => {
    setIsMachinesDialogOpen(false);
    if (workstation?.id) {
      fetchDetails();
    }
    if (onSuccess) onSuccess();
  };

  const confirmDeleteInstructive = (id: number | string) => {
    setInstructiveToDelete(id);
    setDeleteDialogOpen(true);
  };

  const getDisplayName = (name: string) => {
    // Si el nombre contiene "›", verificar si es subcomponente
    if (name.includes('›')) {
      const parts = name.split('›').map(p => p.trim());

      // Si tiene más de 2 niveles, es un subcomponente: mostrar los últimos 2 niveles
      // Ejemplo: "Planta › Chimango › Reductor" → "Chimango › Reductor"
      if (parts.length > 2) {
        return parts.slice(-2).join(' › ');
      }

      // Si tiene 2 niveles, es un componente directo: mostrar solo el último
      // Ejemplo: "Planta › Chimango" → "Chimango"
      return parts[parts.length - 1];
    }
    return name;
  };

  const handleDeleteInstructive = async (id: number | string, isPending: boolean) => {
    // Si es un ID temporal (string), eliminar de pendientes
    if (isPending) {
      setPendingInstructives(prev => prev.filter(instr => instr.id !== id));
      toast({
        title: 'Instructivo eliminado',
        description: 'El instructivo se eliminó correctamente',
      });
      return;
    }

    // Si es un instructivo guardado, eliminarlo del servidor
    if (!workstation?.id) {
      return;
    }

    try {
      const response = await fetch(`/api/work-stations/${workstation.id}/instructives/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'Instructivo eliminado',
          description: 'El instructivo se eliminó correctamente',
        });
        fetchDetails();
        if (onSuccess) onSuccess();
      } else {
        toast({
          title: 'Error',
          description: 'No se pudo eliminar el instructivo',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error eliminando instructivo:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el instructivo',
        variant: 'destructive'
      });
    }
  };

  const confirmDeleteMachine = (machineId: number) => {
    setMachineToDelete(machineId);
    setDeleteMachineDialogOpen(true);
  };

  const handleOpenMachinesDialog = async () => {
    // Inicializar las selecciones con las máquinas pendientes actuales (solo máquinas, no componentes)
    const machineIds: string[] = pendingMachines.map(id => String(id));
    setSelectedMachineIdsForDialog(machineIds);
    setSelectedComponentIdsForDialog([]); // No usamos componentes

    setIsMachinesDialogOpen(true);
  };

  const handleRemoveMachine = async (machineId: number) => {
    // Si la máquina está en pendientes, solo removerla de ahí
    if (pendingMachines.includes(machineId)) {
      setPendingMachines(prev => prev.filter(id => id !== machineId));
      toast({
        title: 'Máquina removida',
        description: 'La máquina se removió correctamente',
      });
      return;
    }

    // Si es una máquina guardada, eliminarla del servidor
    if (!workstation?.id) {
      return;
    }

    try {
      const response = await fetch(`/api/work-stations/${workstation.id}/machines/${machineId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: 'Máquina removida correctamente'
        });
        fetchDetails();
        if (onSuccess) onSuccess();
      } else {
        toast({
          title: 'Error',
          description: 'No se pudo remover la máquina',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error removiendo máquina:', error);
      toast({
        title: 'Error',
        description: 'No se pudo remover la máquina',
        variant: 'destructive'
      });
    }
  };

  const isFormValid = formData.name.trim().length > 0 && formData.sectorId !== undefined;
  const isEdit = workstation && workstation.id > 0;
  
  // Combinar instructivos guardados con pendientes
  const allInstructives = [
    ...instructives,
    ...pendingInstructives.map(instr => ({
      id: instr.id, // Mantener el ID temporal como string
      title: instr.title,
      content: instr.content,
      description: instr.description || instr.content,
      fileName: instr.fileName,
      scope: instr.scope,
      machineIds: instr.machineIds,
      componentIds: instr.componentIds,
      attachments: instr.attachments,
    })),
  ];
  
  const filteredInstructives = allInstructives.filter(instr =>
    instr.title.toLowerCase().includes(searchInstructives.toLowerCase())
  );
  
  // Para máquinas, necesitamos cargar los nombres de las máquinas pendientes
  const [pendingMachinesData, setPendingMachinesData] = useState<Machine[]>([]);
  
  useEffect(() => {
    if (pendingMachines.length > 0 && realMachinesOnly.length > 0) {
      loadPendingMachinesData();
    } else {
      setPendingMachinesData([]);
    }
  }, [pendingMachines, realMachinesOnly]);

  const loadPendingMachinesData = () => {
    // Buscar máquinas pendientes en la lista de máquinas reales disponibles
    const foundMachines: Machine[] = [];

    for (const machineId of pendingMachines) {
      const machine = realMachinesOnly.find(m => Number(m.id) === Number(machineId));
      if (machine) {
        foundMachines.push({ id: machine.id, name: machine.name });
      }
    }

    console.log('🟢 Máquinas pendientes encontradas:', foundMachines.length);
    setPendingMachinesData(foundMachines);
  };
  
  const allMachines = [
    ...machines,
    ...pendingMachinesData,
  ];
  
  // Eliminar duplicados por ID
  const uniqueMachines = allMachines.filter((machine, index, self) =>
    index === self.findIndex((m) => m.id === machine.id)
  );
  
  const filteredMachines = uniqueMachines.filter(m =>
    m.name.toLowerCase().includes(searchMachines.toLowerCase())
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold leading-none tracking-tight">
              {workstation ? 'Editar Puesto de Trabajo' : 'Nuevo Puesto de Trabajo'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {workstation
                ? 'Modifica la información del puesto de trabajo'
                : sectorName
                ? `Sector: ${sectorName}`
                : 'Completa la información para crear un nuevo puesto de trabajo'}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 h-9">
              <TabsTrigger value="basica" className="text-xs">Información Básica</TabsTrigger>
              <TabsTrigger value="instructivos" className="text-xs">
                Instructivos {(allInstructives.length > 0) && (
                  <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4">
                    {allInstructives.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="maquinas" className="text-xs">
                Máquinas {(uniqueMachines.length > 0) && (
                  <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4">
                    {uniqueMachines.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Tab Información Básica */}
            <TabsContent value="basica" className="space-y-4 mt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej: Puesto de soldadura"
                      className="h-9 text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Estado *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: 'ACTIVE' | 'INACTIVE') =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Activo</SelectItem>
                        <SelectItem value="INACTIVE">Inactivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sector">Sector *</Label>
                  <Select
                    value={formData.sectorId?.toString() || ''}
                    onValueChange={(value) =>
                      setFormData({ ...formData, sectorId: value ? parseInt(value) : undefined })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Seleccionar sector" />
                    </SelectTrigger>
                    <SelectContent>
                      {sectores.map((sector) => (
                        <SelectItem key={sector.id} value={sector.id.toString()}>
                          {sector.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {workstation?.code && (
                  <div className="space-y-2">
                    <Label htmlFor="code">Código</Label>
                    <Input
                      id="code"
                      value={workstation.code}
                      disabled
                      className="h-9 text-xs bg-muted/50"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción del puesto de trabajo..."
                    rows={4}
                    className="text-xs"
                  />
                </div>

                <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={loading}
                    className="h-9 text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading || !isFormValid} className="h-9 text-xs">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {workstation ? 'Actualizar' : 'Crear'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>

            {/* Tab Instructivos */}
            <TabsContent value="instructivos" className="space-y-4 mt-4">
              <div className="space-y-4">
                {/* Header con búsqueda y botón */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar instructivos..."
                      value={searchInstructives}
                      onChange={(e) => setSearchInstructives(e.target.value)}
                      className="pl-9 h-9 text-xs"
                    />
                  </div>
                  <Button
                    size="lg"
                    onClick={() => {
                      if (isEdit && workstation?.id) {
                        setEditingInstructive(null);
                        setIsInstructiveDialogOpen(true);
                      } else {
                        setEditingInstructive(null);
                        setIsInstructiveDialogOpen(true);
                      }
                    }}
                    className="text-xs shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Agregar instructivo
                  </Button>
                </div>

                {/* Lista de instructivos */}
                {loadingDetails ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredInstructives.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium text-foreground mb-1">No hay instructivos</p>
                      <p className="text-xs text-muted-foreground mb-4">
                        {searchInstructives ? 'No se encontraron resultados' : 'Comienza agregando tu primer instructivo'}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingInstructive(null);
                          setIsInstructiveDialogOpen(true);
                        }}
                        className="h-9 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Agregar primer instructivo
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {filteredInstructives.map((instr) => {
                      // Obtener datos directamente de instr (ya incluye todos los campos necesarios)
                      const scope = (instr as any)?.scope || 'EQUIPMENT';
                      const machineIds = (instr as any)?.machineIds || [];
                      const componentIds = (instr as any)?.componentIds || [];
                      const attachmentsCount = (instr as any)?.attachments?.length || 0;

                      console.log('📋 [CARD] Mostrando instructivo:', {
                        id: instr.id,
                        title: instr.title,
                        scope,
                        machineIds,
                        componentIds,
                        attachmentsCount,
                        instr,
                      });

                      return (
                      <Card key={instr.id} className="overflow-hidden hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-semibold text-foreground">{instr.title}</h4>
                                {attachmentsCount > 0 && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                                    <Paperclip className="h-2.5 w-2.5 mr-1" />
                                    {attachmentsCount}
                                  </Badge>
                                )}
                                {/* Mostrar máquinas directamente como badges */}
                                {machineIds.length > 0 && availableMachines.filter(m => machineIds.includes(m.id) || machineIds.includes(String(m.id))).slice(0, 3).map((machine) => (
                                  <Badge key={`machine-${machine.id}`} variant="outline" className="text-[10px] px-1.5 py-0.5 border-amber-500/30 text-amber-600 bg-amber-500/10">
                                    <Wrench className="h-2.5 w-2.5 mr-1" />
                                    {getDisplayName(machine.name)}
                                  </Badge>
                                ))}
                                {/* Mostrar componentes directamente como badges */}
                                {componentIds.length > 0 && availableMachines.filter(m => componentIds.includes(m.id) || componentIds.includes(String(m.id))).slice(0, 3).map((component) => (
                                  <Badge key={`component-${component.id}`} variant="outline" className="text-[10px] px-1.5 py-0.5 border-purple-500/30 text-purple-600 bg-purple-500/10">
                                    <Cog className="h-2.5 w-2.5 mr-1" />
                                    {getDisplayName(component.name)}
                                  </Badge>
                                ))}
                                {/* Mostrar contador si hay más de 6 */}
                                {(machineIds.length + componentIds.length > 6) && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-muted-foreground">
                                    +{(machineIds.length + componentIds.length) - 6} más
                                  </Badge>
                                )}
                              </div>
                              {(instr.content || instr.description) && (
                                <div 
                                  className="text-xs text-muted-foreground prose prose-sm max-w-none dark:prose-invert"
                                  dangerouslySetInnerHTML={{ 
                                    __html: instr.content || instr.description || '' 
                                  }}
                                  style={{
                                    maxHeight: '80px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                />
                              )}
                              {instr.fileName && (
                                <div className="flex items-center gap-2 mt-2">
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">{instr.fileName}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  console.log('✏️ [EDIT] Editando instructivo:', instr);
                                  setEditingInstructive(instr);
                                  setIsInstructiveDialogOpen(true);
                                }}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  console.log('🗑️ [DELETE] Solicitando confirmación para eliminar:', instr.id);
                                  confirmDeleteInstructive(instr.id);
                                }}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab Máquinas */}
            <TabsContent value="maquinas" className="space-y-4 mt-4">
              <div className="space-y-4">
                {/* Header con búsqueda */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar máquinas..."
                      value={searchMachines}
                      onChange={(e) => setSearchMachines(e.target.value)}
                      className="pl-9 h-9 text-xs"
                    />
                  </div>
                  <Button
                    size="lg"
                    onClick={handleOpenMachinesDialog}
                    className="text-xs shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Asignar máquinas
                  </Button>
                </div>

                {/* Lista de máquinas */}
                {loadingDetails ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : uniqueMachines.length === 0 && pendingMachines.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="p-6 py-12 text-center">
                      <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium text-foreground mb-1">No hay máquinas asignadas</p>
                      <p className="text-xs text-muted-foreground mb-4">
                        {searchMachines ? 'No se encontraron resultados' : 'Comienza asignando tu primera máquina'}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenMachinesDialog}
                        className="h-9 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Asignar primera máquina
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {/* Mostrar máquinas guardadas (de la base de datos) */}
                    {machines.length > 0 && machines.map((machine) => (
                      <Card key={`saved-${machine.id}`} className="overflow-hidden hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Wrench className="h-4 w-4 text-primary shrink-0" />
                                <h4 className="text-sm font-semibold text-foreground">{machine.name}</h4>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-green-600 border-green-500/30 bg-green-500/10">
                                  Guardado
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => confirmDeleteMachine(machine.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {/* Mostrar máquinas pendientes */}
                    {pendingMachines.length > 0 && pendingMachinesData.map((machine) => (
                      <Card key={`pending-${machine.id}`} className="overflow-hidden hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Wrench className="h-4 w-4 text-primary shrink-0" />
                                <h4 className="text-sm font-semibold text-foreground">{machine.name}</h4>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-amber-600 border-amber-500/30 bg-amber-500/10">
                                  Pendiente
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => confirmDeleteMachine(machine.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
            </Tabs>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Dialog de Instructivos - Para puesto existente usa el dialog original */}
      {isEdit && workstation?.id ? (
        <InstructiveDialog
          open={isInstructiveDialogOpen}
          onOpenChange={setIsInstructiveDialogOpen}
          workStationId={workstation.id}
          instructive={editingInstructive}
          onSuccess={handleInstructiveSuccess}
        />
      ) : (
        <InstructionUpsertSheet
          open={isInstructiveDialogOpen}
          onOpenChange={(open) => {
            setIsInstructiveDialogOpen(open);
            if (!open) setEditingInstructive(null);
          }}
          workstationId="pending"
          workstationName={formData.name || 'Nuevo puesto'}
          mode={editingInstructive && typeof editingInstructive.id === 'string' && editingInstructive.id.startsWith('temp-') ? 'edit' : 'create'}
          initialData={editingInstructive && typeof editingInstructive.id === 'string' && editingInstructive.id.startsWith('temp-') ? {
            id: parseInt(editingInstructive.id.replace('temp-', '')) || 0,
            title: editingInstructive.title,
            contentHtml: editingInstructive.content || editingInstructive.description || '',
            scope: pendingInstructives.find(p => p.id === editingInstructive.id)?.scope || 'EQUIPMENT',
            machineIds: (pendingInstructives.find(p => p.id === editingInstructive.id)?.machineIds || []).map(String),
            componentIds: (pendingInstructives.find(p => p.id === editingInstructive.id)?.componentIds || []).map(String),
            attachments: pendingInstructives.find(p => p.id === editingInstructive.id)?.attachments || [],
          } : undefined}
          machines={availableMachines.map(m => ({ id: m.id, name: m.name }))}
          loadComponentsByMachine={async (machineId) => {
            console.log('🔧 loadComponentsByMachine - machineId:', machineId, 'sectorId:', formData.sectorId);
            try {
              const url = formData.sectorId
                ? `/api/machines-and-components?companyId=${currentCompany?.id}&sectorId=${formData.sectorId}&machineId=${machineId}&includeComponents=true`
                : `/api/machines-and-components?companyId=${currentCompany?.id}&machineId=${machineId}&includeComponents=true`;

              console.log('🔧 Fetching URL:', url);
              const response = await fetch(url);
              console.log('🔧 Response status:', response.status);

              if (response.ok) {
                const data = await response.json();
                console.log('🔧 Data recibida:', data);

                // Buscar la máquina en el array de máquinas
                const findMachineInArray = (items: any[], targetId: string): any => {
                  for (const item of items) {
                    if (item.id.toString() === targetId) {
                      return item;
                    }
                    if (item.children) {
                      const found = findMachineInArray(item.children, targetId);
                      if (found) return found;
                    }
                  }
                  return null;
                };

                const allItems = data.machines || [];
                const machine = findMachineInArray(allItems, machineId);
                console.log('🔧 Máquina encontrada:', machine);

                if (!machine || !machine.children) {
                  console.log('⚠️ No se encontraron componentes para la máquina');
                  return [];
                }

                // Mapear los hijos (componentes) de la máquina
                const components = machine.children.map((c: any) => ({
                  id: c.id,
                  name: c.name || c.displayName,
                  type: c.type === 'SUB_COMPONENT' || c.type === 'SUBCOMPONENT' ? 'SUBCOMPONENT' : 'COMPONENT',
                  children: c.children?.map((sc: any) => ({
                    id: sc.id,
                    name: sc.name || sc.displayName,
                    type: 'SUBCOMPONENT',
                    children: [],
                  })) || [],
                }));

                console.log('🟢 Componentes mapeados:', components);
                return components;
              }
              return [];
            } catch (error) {
              console.error('🔴 Error loading components:', error);
              return [];
            }
          }}
          onSave={async (payload) => {
            // Convertir payload al formato de pendingInstructives
            const newInstructive = {
              id: editingInstructive?.id?.startsWith?.('temp-') 
                ? editingInstructive.id 
                : `temp-${Date.now()}-${Math.random()}`,
              title: payload.title,
              content: payload.contentHtml,
              description: payload.contentHtml,
              machineIds: payload.machineIds.map(Number),
              componentIds: payload.componentIds.map(Number),
              scope: payload.scope,
              attachments: payload.attachments,
            };
            
            if (editingInstructive && typeof editingInstructive.id === 'string' && editingInstructive.id.startsWith('temp-')) {
              setPendingInstructives(prev => prev.map(p => 
                p.id === editingInstructive.id ? { ...p, ...newInstructive, id: p.id } : p
              ));
            } else {
              setPendingInstructives(prev => [...prev, newInstructive]);
            }
          }}
          onSuccess={() => {
            setIsInstructiveDialogOpen(false);
            setEditingInstructive(null);
          }}
        />
      )}

      {/* Dialog de Máquinas - Solo selección de máquinas */}
      <Dialog open={isMachinesDialogOpen} onOpenChange={setIsMachinesDialogOpen}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>Asignar Máquinas</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Selecciona las máquinas que estarán disponibles en este puesto de trabajo
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-2">
              {realMachinesOnly.length === 0 ? (
                <div className="text-center py-8">
                  <Wrench className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No hay máquinas disponibles</p>
                </div>
              ) : (
                realMachinesOnly.map((machine) => {
                  const isSelected = selectedMachineIdsForDialog.includes(String(machine.id));
                  return (
                    <div
                      key={machine.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted/50 border-border'
                      }`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedMachineIdsForDialog(prev => prev.filter(id => id !== String(machine.id)));
                        } else {
                          setSelectedMachineIdsForDialog(prev => [...prev, String(machine.id)]);
                        }
                      }}
                    >
                      <div className={`h-5 w-5 rounded border flex items-center justify-center ${
                        isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                      }`}>
                        {isSelected && (
                          <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium flex-1">{machine.name}</span>
                    </div>
                  );
                })
              )}
            </div>
          </DialogBody>

          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-muted-foreground">
                {selectedMachineIdsForDialog.length} máquina(s) seleccionada(s)
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMachinesDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    // Convertir IDs de string a number (solo máquinas)
                    const machineIds = selectedMachineIdsForDialog.map(Number);
                    setPendingMachines(machineIds);
                    setIsMachinesDialogOpen(false);
                    toast({
                      title: 'Éxito',
                      description: `${machineIds.length} máquina(s) asignada(s) correctamente`,
                    });
                  }}
                >
                  Guardar selección
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog de confirmación de eliminación de instructivo */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar instructivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El instructivo será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (instructiveToDelete !== null) {
                  const isPending = typeof instructiveToDelete === 'string' && instructiveToDelete.startsWith('temp-');
                  handleDeleteInstructive(instructiveToDelete, isPending);
                  setDeleteDialogOpen(false);
                  setInstructiveToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog de confirmación de eliminación de máquina */}
      <AlertDialog open={deleteMachineDialogOpen} onOpenChange={setDeleteMachineDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar máquina?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción quitará la máquina del puesto de trabajo. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteMachineDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (machineToDelete !== null) {
                  handleRemoveMachine(machineToDelete);
                  setDeleteMachineDialogOpen(false);
                  setMachineToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Componente temporal para agregar instructivos antes de guardar
interface PendingInstructiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (instructive: {
    title: string;
    content?: string;
    description?: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    file?: File;
    machineIds?: number[];
  }) => void;
  editingInstructive?: {
    id: string;
    title: string;
    content?: string;
    description?: string;
    fileName?: string;
    machineIds?: number[];
  } | null;
  availableMachines?: Machine[];
}

function PendingInstructiveDialog({
  open,
  onOpenChange,
  onAdd,
  editingInstructive,
  availableMachines = [],
}: PendingInstructiveDialogProps) {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedMachineIds, setSelectedMachineIds] = useState<number[]>([]);
  const [availableMachinesList, setAvailableMachinesList] = useState<Machine[]>(availableMachines);
  const [searchMachineTerm, setSearchMachineTerm] = useState('');

  useEffect(() => {
    if (editingInstructive) {
      setFormData({
        title: editingInstructive.title,
        content: editingInstructive.content || editingInstructive.description || '',
      });
      setSelectedMachineIds(editingInstructive.machineIds || []);
    } else {
      setFormData({ title: '', content: '' });
      setSelectedMachineIds([]);
    }
    setSelectedFile(null);
    setSearchMachineTerm('');
  }, [editingInstructive, open]);

  useEffect(() => {
    if (open && currentCompany?.id && availableMachines.length === 0) {
      loadAvailableMachines();
    } else if (availableMachines.length > 0) {
      setAvailableMachinesList(availableMachines);
    }
  }, [open, currentCompany?.id, availableMachines]);

  const loadAvailableMachines = async () => {
    try {
      const response = await fetch(`/api/machines-and-components?companyId=${currentCompany?.id}&includeComponents=true`);
      if (response.ok) {
        const data = await response.json();
        const allItems = data.machines || [];
        const machinesList: Machine[] = [];

        const extractMachines = (items: any[]) => {
          for (const item of items) {
            if (item.type === 'MACHINE' || item.type === 'COMPONENT' || item.type === 'SUBCOMPONENT') {
              machinesList.push({
                id: item.id,
                name: item.name || item.displayName,
              });
            }
            if (item.children) {
              extractMachines(item.children);
            }
          }
        };

        extractMachines(allItems);
        setAvailableMachinesList(machinesList);
      }
    } catch (error) {
      console.error('Error cargando máquinas:', error);
    }
  };

  const toggleMachineSelection = (machineId: number) => {
    setSelectedMachineIds(prev =>
      prev.includes(machineId)
        ? prev.filter(id => id !== machineId)
        : [...prev, machineId]
    );
  };

  const filteredMachines = availableMachinesList.filter(m =>
    m.name.toLowerCase().includes(searchMachineTerm.toLowerCase())
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'Por favor ingresa el título del instructivo',
        variant: 'destructive',
      });
      return;
    }

    onAdd({
      title: formData.title.trim(),
      content: formData.content || undefined,
      description: formData.content || undefined, // Mantener compatibilidad
      fileName: selectedFile?.name,
      fileType: selectedFile?.type,
      fileSize: selectedFile?.size,
      file: selectedFile || undefined,
      machineIds: selectedMachineIds.length > 0 ? selectedMachineIds : undefined,
    });

    setFormData({ title: '', content: '' });
    setSelectedFile(null);
    setSelectedMachineIds([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {editingInstructive ? 'Editar Instructivo' : 'Nuevo Instructivo'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {editingInstructive
              ? 'Modifica la información del instructivo'
              : 'El instructivo se asociará al puesto de trabajo al guardarlo'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-xs font-medium">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ej: Procedimiento de soldadura"
              className="h-9 text-xs"
              required
            />
          </div>
          <div className="space-y-2 flex-1 min-h-0 flex flex-col">
            <Label htmlFor="content" className="text-xs font-medium">Contenido</Label>
            <div className="flex-1 min-h-[400px]">
              <RichTextEditor
                value={formData.content}
                onChange={(value) => setFormData({ ...formData, content: value })}
                placeholder="Escribe el contenido del instructivo aquí... Puedes usar formato, listas e insertar imágenes."
                className="h-full"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="file" className="text-xs font-medium">Archivo adjunto (opcional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="file"
                type="file"
                onChange={handleFileChange}
                className="h-9 text-xs"
              />
              {selectedFile && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  <span>{selectedFile.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Selección de máquinas asociadas */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Máquinas asociadas (opcional)</Label>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar máquinas..."
                  value={searchMachineTerm}
                  onChange={(e) => setSearchMachineTerm(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
              <div className="border rounded-lg p-3 max-h-[200px] overflow-y-auto space-y-2">
                {filteredMachines.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {searchMachineTerm ? 'No se encontraron máquinas' : 'No hay máquinas disponibles'}
                  </p>
                ) : (
                  filteredMachines.map((machine) => (
                    <div
                      key={machine.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleMachineSelection(machine.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMachineIds.includes(machine.id)}
                        onChange={() => toggleMachineSelection(machine.id)}
                        className="h-4 w-4"
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">{machine.name}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {selectedMachineIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedMachineIds.map((machineId) => {
                    const machine = availableMachinesList.find(m => m.id === machineId);
                    return machine ? (
                      <Badge key={machineId} variant="secondary" className="text-xs">
                        {machine.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingInstructive ? 'Actualizar' : 'Agregar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Componente mejorado para seleccionar máquinas antes de guardar
interface PendingMachinesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMachineIds: number[];
  sectorId?: number;
  onSave: (machineIds: number[]) => void;
}

function PendingMachinesDialog({
  open,
  onOpenChange,
  selectedMachineIds,
  sectorId,
  onSave,
}: PendingMachinesDialogProps) {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [availableMachines, setAvailableMachines] = useState<Machine[]>([]);
  const [selectedMachines, setSelectedMachines] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Resetear selección y cargar máquinas cuando se abre el modal
  useEffect(() => {
    console.log('🔵 PendingMachinesDialog useEffect - open:', open, 'sectorId:', sectorId, 'selectedMachineIds:', selectedMachineIds);
    if (open) {
      setSelectedMachines(selectedMachineIds);
      setSearchTerm('');
      setAvailableMachines([]);
      // Cargar máquinas automáticamente si hay un sector
      if (sectorId) {
        console.log('🟢 Cargando máquinas para sector:', sectorId);
        loadAvailableMachines();
      } else {
        console.log('🔴 No hay sectorId definido');
      }
    }
  }, [open, selectedMachineIds]);

  const loadAvailableMachines = async () => {
    console.log('🟡 loadAvailableMachines llamado - sectorId:', sectorId, 'companyId:', currentCompany?.id);
    if (!sectorId) {
      console.log('🔴 No se puede cargar sin sectorId');
      toast({
        title: 'Aviso',
        description: 'Debes seleccionar un sector primero',
        variant: 'default'
      });
      return;
    }

    try {
      setLoading(true);
      const url = sectorId
        ? `/api/machines-and-components?companyId=${currentCompany?.id}&sectorId=${sectorId}&includeComponents=true`
        : `/api/machines-and-components?companyId=${currentCompany?.id}&includeComponents=true`;

      console.log('🟡 Fetching URL:', url);
      const response = await fetch(url);
      console.log('🟡 Response status:', response.status, response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('🟡 Data recibida:', data);
        const allItems = data.machines || [];
        console.log('🟡 All items:', allItems);
        const machinesList: Machine[] = [];

        const extractMachines = (items: any[]) => {
          for (const item of items) {
            console.log('🟡 Procesando item:', item.id, item.name, item.type);
            if (item.type === 'MACHINE' || item.type === 'COMPONENT' || item.type === 'SUBCOMPONENT') {
              machinesList.push({
                id: item.id,
                name: item.name || item.displayName,
              });
              console.log('✅ Agregado:', item.id, item.name || item.displayName);
            }
            if (item.children) {
              extractMachines(item.children);
            }
          }
        };

        extractMachines(allItems);
        console.log('🟢 Máquinas extraídas:', machinesList);
        setAvailableMachines(machinesList);
      }
    } catch (error) {
      console.error('🔴 Error cargando máquinas:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las máquinas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (machineId: number) => {
    console.log('🔵 toggleSelection - machineId:', machineId);
    setSelectedMachines(prev => {
      const isSelected = prev.includes(machineId);
      const newSelection = isSelected
        ? prev.filter(id => id !== machineId)
        : [...prev, machineId];
      console.log('🟡 Nueva selección:', newSelection);
      return newSelection;
    });
  };

  const handleSave = () => {
    console.log('💾 handleSave - Guardando máquinas seleccionadas:', selectedMachines);
    onSave(selectedMachines);
    onOpenChange(false);
  };

  const filteredMachines = availableMachines.filter(machine =>
    machine.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Asignar Máquinas al Puesto</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Selecciona las máquinas que estarán disponibles en este puesto de trabajo
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {/* Barra de búsqueda y vista - Solo mostrar si hay máquinas cargadas o está cargando */}
          {(availableMachines.length > 0 || loading) && (
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar máquinas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button
                  type="button"
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="icon-sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="icon-sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Máquinas seleccionadas */}
          {selectedMachines.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border">
              <span className="text-xs font-medium text-muted-foreground w-full mb-1">
                Seleccionadas ({selectedMachines.length}):
              </span>
              {selectedMachines.map((machineId) => {
                const machine = availableMachines.find(m => m.id === machineId);
                return machine ? (
                  <Badge key={machineId} variant="secondary" className="text-xs flex items-center gap-1.5">
                    <Wrench className="h-3 w-3" />
                    {machine.name}
                    <button
                      onClick={() => toggleSelection(machineId)}
                      className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ) : null;
              })}
            </div>
          )}

          {/* Lista de máquinas */}
          {loading ? (
            <div className="flex items-center justify-center py-12 flex-1">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : availableMachines.length === 0 ? (
            <div></div>
          ) : filteredMachines.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium text-foreground mb-1">
                  {searchTerm ? 'No se encontraron máquinas' : 'No hay máquinas disponibles'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {searchTerm ? 'Intenta con otro término de búsqueda' : 'Las máquinas aparecerán aquí una vez que las agregues al sistema'}
                </p>
              </CardContent>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto flex-1">
              {filteredMachines.map((machine) => (
                <Card
                  key={machine.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedMachines.includes(machine.id)
                      ? 'ring-2 ring-primary bg-primary/5'
                      : ''
                  }`}
                  onClick={() => toggleSelection(machine.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                        selectedMachines.includes(machine.id)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}>
                        <Wrench className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedMachines.includes(machine.id)}
                            onChange={() => toggleSelection(machine.id)}
                            className="h-4 w-4 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <h4 className="text-sm font-semibold truncate">{machine.name}</h4>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto flex-1">
              {filteredMachines.map((machine) => (
                <Card
                  key={machine.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedMachines.includes(machine.id)
                      ? 'ring-2 ring-primary bg-primary/5'
                      : ''
                  }`}
                  onClick={() => toggleSelection(machine.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedMachines.includes(machine.id)}
                        onChange={() => toggleSelection(machine.id)}
                        className="h-4 w-4 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        selectedMachines.includes(machine.id)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}>
                        <Wrench className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold">{machine.name}</h4>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave}>
            Guardar {selectedMachines.length > 0 && `(${selectedMachines.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
