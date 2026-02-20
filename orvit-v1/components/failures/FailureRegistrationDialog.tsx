'use client';

import React, { useState, useEffect } from 'react';
import { Machine, MachineComponent } from '@/lib/types';
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
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertTriangle,
  Network,
  CloudUpload,
  X,
  Upload,
  FileText,
  Cog,
  Wrench,
  Loader2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import ComponentSelectionModal from './ComponentSelectionModal';
import { DatePicker } from '@/components/ui/date-picker';
import { useMachinesInitial } from '@/hooks/use-machines-initial';
import { User } from 'lucide-react';
import FailureTypeSelector from './FailureTypeSelector';
import { FailureType } from '@/hooks/maintenance/use-failure-types';

interface Employee {
  id: string;
  name: string;
  role?: string;
}

interface FailureRegistrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onFailureSaved: (failureData: any) => void;
  onLoadSolution: (failureData: any) => void;
  machineId?: number;
  machineName?: string;
  components?: MachineComponent[];
}

interface FailureData {
  title: string;
  reportDate: string;
  affectedComponents: string[];
  description: string;
  failureType: 'MECANICA' | 'ELECTRICA' | 'HIDRAULICA' | 'NEUMATICA' | 'AUTOMATIZACION';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedTime: number;
  timeUnit: 'hours' | 'minutes';
  files: File[];
  createdById: string;
  createdByName: string;
}

export default function FailureRegistrationDialog({
  isOpen,
  onClose,
  onFailureSaved,
  onLoadSolution,
  machineId,
  machineName,
  components = []
}: FailureRegistrationDialogProps) {
  const { currentCompany, currentSector } = useCompany();
  const { user } = useAuth();

  // Estados del formulario
  const [failureData, setFailureData] = useState<FailureData>({
    title: '',
    reportDate: new Date().toISOString().split('T')[0],
    affectedComponents: [],
    description: '',
    failureType: 'MECANICA',
    priority: 'MEDIUM',
    estimatedTime: 0,
    timeUnit: 'hours',
    files: [],
    createdById: '',
    createdByName: ''
  });

  // Estado para empleados (creadores de falla)
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  
  // ✨ OPTIMIZADO: Usar hook con React Query para máquinas
  const companyIdNum = currentCompany?.id ? parseInt(String(currentCompany.id)) : null;
  const sectorIdNum = currentSector?.id ? parseInt(String(currentSector.id)) : null;
  const { data: machinesData, isLoading: loadingMachines } = useMachinesInitial(
    companyIdNum,
    sectorIdNum,
    { enabled: isOpen && !!companyIdNum && !machineId }
  );
  const machines = (machinesData?.machines || []) as Machine[];

  // Estados de datos
  const [allComponents, setAllComponents] = useState<MachineComponent[]>([]);
  const [subcomponents, setSubcomponents] = useState<any[]>([]);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [loadingSubcomponents, setLoadingSubcomponents] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Estados para selección de componentes
  const [selectedMachineId, setSelectedMachineId] = useState<string>(machineId?.toString() || '');
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
  const [selectedSubcomponentIds, setSelectedSubcomponentIds] = useState<string[]>([]);
  const [showComponentSelector, setShowComponentSelector] = useState(false);

  // Estado para tipo de falla del catálogo
  const [selectedFailureType, setSelectedFailureType] = useState<FailureType | null>(null);

  // Cargar datos iniciales
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      loadEmployees();
    }
  }, [isOpen, machineId, currentSector?.id]);

  // ✅ Cargar empleados de la API de administración/costos
  const loadEmployees = async () => {
    if (!currentCompany?.id) return;

    setLoadingEmployees(true);
    try {
      const response = await fetch(`/api/costos/empleados?companyId=${currentCompany.id}`);
      if (response.ok) {
        const data = await response.json();
        setEmployees(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoadingEmployees(false);
    }
  };

  // ✨ OPTIMIZADO: Máquinas vienen del hook, solo cargar componentes
  const loadInitialData = async () => {
    try {
      // Si se proporcionan componentes, usarlos
      if (components.length > 0) {
        setAllComponents(components);
        return;
      }

      // Si se proporciona machineId, cargar componentes de esa máquina
      if (machineId) {
        await loadComponents(machineId);
        return;
      }

      // Si hay máquinas del hook, cargar componentes de la primera
      if (machines.length > 0 && !selectedMachineId) {
        const firstMachine = machines[0];
        setSelectedMachineId(firstMachine.id.toString());
        await loadComponents(firstMachine.id);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  // Cargar componentes cuando cambian las máquinas del hook
  useEffect(() => {
    if (isOpen && machines.length > 0 && !machineId && !selectedMachineId) {
      const firstMachine = machines[0];
      setSelectedMachineId(firstMachine.id.toString());
      loadComponents(firstMachine.id);
    }
  }, [isOpen, machines, machineId, selectedMachineId]);

  const loadComponents = async (machineIdToLoad: number) => {
    setLoadingComponents(true);
    try {
      const response = await fetch(`/api/maquinas/${machineIdToLoad}/components`);
      if (response.ok) {
        const data = await response.json();
        setAllComponents(data);
      } else {
        console.error('Failed to load components:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error loading components:', error);
    } finally {
      setLoadingComponents(false);
    }
  };

  const loadSubcomponents = async (componentId: string) => {
    setLoadingSubcomponents(true);
    try {
      const response = await fetch(`/api/components/${componentId}/subcomponents`);
      if (response.ok) {
        const data = await response.json();
        setSubcomponents(prev => [...prev, ...data]);
      }
    } catch (error) {
      console.error('Error loading subcomponents:', error);
    } finally {
      setLoadingSubcomponents(false);
    }
  };

  const handleMachineChange = async (machineId: string) => {
    setSelectedMachineId(machineId);
    setSelectedComponentIds([]);
    setSelectedSubcomponentIds([]);
    setSubcomponents([]);
    
    if (machineId) {
      await loadComponents(parseInt(machineId));
    }
  };

  const handleComponentChange = async (componentId: string, checked: boolean) => {
    if (checked) {
      setSelectedComponentIds(prev => [...prev, componentId]);
      await loadSubcomponents(componentId);
    } else {
      setSelectedComponentIds(prev => prev.filter(id => id !== componentId));
      // Remove subcomponents of this component
      const component = allComponents.find(c => c.id.toString() === componentId);
      if (component?.children) {
        const subcomponentIdsToRemove = component.children.map(sub => sub.id.toString());
        setSelectedSubcomponentIds(prev => prev.filter(id => !subcomponentIdsToRemove.includes(id)));
      }
    }
  };

  const handleSubcomponentChange = (subcomponentId: string, checked: boolean) => {
    if (checked) {
      setSelectedSubcomponentIds(prev => [...prev, subcomponentId]);
    } else {
      setSelectedSubcomponentIds(prev => prev.filter(id => id !== subcomponentId));
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      setFailureData(prev => ({
        ...prev,
        files: [...prev.files, ...fileArray]
      }));
    }
  };

  const removeFile = (index: number) => {
    setFailureData(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
  };

  const handleClose = () => {
    // Reset form
    setFailureData({
      title: '',
      reportDate: new Date().toISOString().split('T')[0],
      affectedComponents: [],
      description: '',
      failureType: 'MECANICA',
      priority: 'MEDIUM',
      estimatedTime: 0,
      timeUnit: 'hours',
      files: [],
      createdById: '',
      createdByName: ''
    });
    setSelectedMachineId(machineId?.toString() || '');
    setSelectedComponentIds([]);
    setSelectedSubcomponentIds([]);
    setSubcomponents([]);
    onClose();
  };

  const handleLoadSolution = () => {
    if (!failureData.title.trim()) {
      toast({
        title: "Error",
        description: "El título de la falla es requerido",
        variant: "destructive",
      });
      return;
    }

    const finalFailureData = {
      ...failureData,
      affectedComponents: [...selectedComponentIds, ...selectedSubcomponentIds],
      machineId: selectedMachineId ? parseInt(selectedMachineId) : machineId,
      machineName: machineName || machines.find(m => m.id.toString() === selectedMachineId)?.name,
      // ✅ NUEVO: Incluir failureTypeId si se seleccionó del catálogo
      failureTypeId: selectedFailureType?.id || null,
      addToCatalog: !selectedFailureType // Agregar al catálogo si es nueva
    };

    // Pasar los datos de la falla al componente padre para abrir el modal de solución
    onLoadSolution(finalFailureData);
  };

  const handleSaveFailure = async () => {
    if (!failureData.title.trim()) {
      toast({
        title: "Error",
        description: "El título de la falla es requerido",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const finalFailureData = {
        ...failureData,
        affectedComponents: [...selectedComponentIds, ...selectedSubcomponentIds],
        machineId: selectedMachineId ? parseInt(selectedMachineId) : machineId,
        machineName: machineName || machines.find(m => m.id.toString() === selectedMachineId)?.name,
        // ✅ NUEVO: Incluir failureTypeId si se seleccionó del catálogo
        failureTypeId: selectedFailureType?.id || null,
        addToCatalog: !selectedFailureType // Agregar al catálogo si es nueva
      };

      onFailureSaved(finalFailureData);
    } catch (error) {
      console.error('Error saving failure:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la falla",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="bg-warning-muted p-1.5 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
            </div>
            Registrar Nueva Falla
          </DialogTitle>
          <DialogDescription>
            Registra una falla y carga el mantenimiento aplicado para {machineName || 'la máquina seleccionada'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        <form className="space-y-4">
          {/* Selector de tipo de falla conocida */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">¿Es una falla conocida?</Label>
            <FailureTypeSelector
              companyId={currentCompany?.id ? parseInt(String(currentCompany.id)) : null}
              machineId={machineId || (selectedMachineId ? parseInt(selectedMachineId) : null)}
              value={selectedFailureType}
              onChange={(failureType) => {
                setSelectedFailureType(failureType);
                if (failureType) {
                  // Pre-llenar campos del formulario con datos del tipo de falla
                  setFailureData(prev => ({
                    ...prev,
                    title: failureType.title,
                    description: failureType.description || '',
                    failureType: (failureType.failureType as any) || 'MECANICA',
                    priority: (failureType.priority as any) || 'MEDIUM',
                    estimatedTime: failureType.estimatedHours || 0
                  }));
                  // Pre-seleccionar componentes afectados si existen
                  if (failureType.affectedComponents && Array.isArray(failureType.affectedComponents)) {
                    setSelectedComponentIds(failureType.affectedComponents.map(String));
                  }
                }
              }}
              onCreateNew={() => {
                setSelectedFailureType(null);
                // Limpiar campos para crear nueva falla
                setFailureData(prev => ({
                  ...prev,
                  title: '',
                  description: ''
                }));
              }}
              placeholder="Buscar falla conocida o crear nueva..."
            />
            <p className="text-xs text-muted-foreground">
              {selectedFailureType
                ? `Falla del catálogo: ocurrió ${selectedFailureType.occurrencesCount} vez${selectedFailureType.occurrencesCount !== 1 ? 'es' : ''}`
                : 'Selecciona una falla conocida para pre-llenar los campos, o crea una nueva'
              }
            </p>
          </div>

          {/* Información básica */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Título de la falla</Label>
              <Input
                value={failureData.title}
                onChange={(e) => setFailureData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: Falla en motor principal"
                className="bg-background border-border text-sm"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Fecha de reporte</Label>
              <DatePicker
                value={failureData.reportDate}
                onChange={(date) => setFailureData(prev => ({ ...prev, reportDate: date }))}
                placeholder="Seleccionar fecha..."
                className="text-sm"
              />
            </div>
          </div>

          {/* Creador de la falla */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Reportado por
            </Label>
            {loadingEmployees ? (
              <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Cargando empleados...</span>
              </div>
            ) : (
              <Select
                value={failureData.createdById}
                onValueChange={(value) => {
                  const selectedEmployee = employees.find(e => e.id.toString() === value);
                  setFailureData(prev => ({
                    ...prev,
                    createdById: value,
                    createdByName: selectedEmployee?.name || ''
                  }));
                }}
              >
                <SelectTrigger className="bg-background border-border text-sm">
                  <SelectValue placeholder="Seleccionar quien reporta..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.length > 0 ? (
                    employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id.toString()}>
                        {employee.name} {employee.role ? `(${employee.role})` : ''}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-employees" disabled>
                      No hay empleados disponibles
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Selección de máquina */}
          {!machineId && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Máquina</Label>
              {loadingMachines ? (
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Cargando máquinas...</span>
                </div>
              ) : machines.length > 0 ? (
                <>
                  <Select 
                    value={selectedMachineId} 
                    onValueChange={handleMachineChange}
                  >
                    <SelectTrigger className="bg-background border-border text-sm">
                      <SelectValue placeholder="Selecciona una máquina" />
                    </SelectTrigger>
                    <SelectContent>
                      {machines.map((machine) => (
                        <SelectItem key={machine.id} value={machine.id.toString()}>
                          {machine.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedMachineId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Máquina seleccionada: {machines.find(m => m.id.toString() === selectedMachineId)?.name}
                    </p>
                  )}
                </>
              ) : (
                <div className="p-2 border rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground">No hay máquinas disponibles</p>
                </div>
              )}
            </div>
          )}



          {/* Componentes afectados */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Componentes afectados</Label>
            <div className="space-y-4">
              {(!machineId && !selectedMachineId) ? (
                <div className="p-3 border rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground text-center">
                    Selecciona una máquina para ver sus componentes
                  </p>
                </div>
              ) : (
                <>
                  {/* Componentes principales seleccionados */}
                  {selectedComponentIds.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-2 h-2 bg-info rounded-full"></div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Componentes Principales ({selectedComponentIds.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedComponentIds.map((componentId) => {
                      const component = allComponents.find(c => c.id.toString() === componentId);
                      return component ? (
                        <div key={componentId} className="group flex items-center gap-1.5 bg-info-muted border border-info-muted text-info-muted-foreground px-2 py-1 rounded-md text-xs font-medium shadow-sm hover:shadow-md transition-all duration-200">
                          <Cog className="h-3 w-3 text-info-muted-foreground" />
                          <span>{component.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedComponentIds(prev => prev.filter(id => id !== componentId));
                              // Remove subcomponents of this component
                              if (component.children) {
                                const subcomponentIdsToRemove = component.children.map(sub => sub.id.toString());
                                setSelectedSubcomponentIds(prev => prev.filter(id => !subcomponentIdsToRemove.includes(id)));
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 hover:bg-info-muted/80 rounded-full w-4 h-4 flex items-center justify-center transition-all duration-200 text-info-muted-foreground hover:text-info-muted-foreground text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* Subcomponentes seleccionados */}
              {selectedSubcomponentIds.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-2 h-2 bg-success rounded-full"></div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subcomponentes ({selectedSubcomponentIds.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSubcomponentIds.map((subcomponentId) => {
                      const subcomponent = allComponents
                        .flatMap(comp => comp.children || [])
                        .find(child => child.id.toString() === subcomponentId);
                      
                      return subcomponent ? (
                        <div key={subcomponentId} className="group flex items-center gap-1.5 bg-success-muted border border-success-muted text-success px-2 py-1 rounded-md text-xs font-medium shadow-sm hover:shadow-md transition-all duration-200">
                          <Wrench className="h-3 w-3 text-success" />
                          <span>{subcomponent.name}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedSubcomponentIds(prev => prev.filter(id => id !== subcomponentId))}
                            className="opacity-0 group-hover:opacity-100 hover:bg-success-muted/80 rounded-full w-4 h-4 flex items-center justify-center transition-all duration-200 text-success hover:text-success text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
              
              {/* Botón para abrir selector */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowComponentSelector(true)}
                className="w-full h-9 text-xs"
                disabled={!selectedMachineId && !machineId}
              >
                <Network className="h-3.5 w-3.5 mr-1.5" />
                Seleccionar
              </Button>
                </>
              )}
            </div>
          </div>

          {/* Descripción detallada con editor rico */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Descripción detallada</Label>
            <RichTextEditor
              content={failureData.description}
              onChange={(content) => setFailureData(prev => ({ ...prev, description: content }))}
              placeholder="Describe el problema en detalle. Puedes agregar imágenes directamente..."
              minHeight="150px"
            />
          </div>

          {/* Tipo de falla, Prioridad y Tiempo estimado */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tipo de falla</Label>
              <Select 
                value={failureData.failureType} 
                onValueChange={(value: any) => setFailureData(prev => ({ ...prev, failureType: value }))}
              >
                <SelectTrigger className="bg-background border-border text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MECANICA">Mecánica</SelectItem>
                  <SelectItem value="ELECTRICA">Eléctrica</SelectItem>
                  <SelectItem value="HIDRAULICA">Hidráulica</SelectItem>
                  <SelectItem value="NEUMATICA">Neumática</SelectItem>
                  <SelectItem value="AUTOMATIZACION">Automatización</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Prioridad</Label>
              <Select 
                value={failureData.priority} 
                onValueChange={(value: any) => setFailureData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger className="bg-background border-border text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baja</SelectItem>
                  <SelectItem value="MEDIUM">Media</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tiempo estimado</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={failureData.estimatedTime}
                  onChange={(e) => setFailureData(prev => ({ ...prev, estimatedTime: Number(e.target.value) }))}
                  placeholder="0"
                  min="0"
                  step="0.5"
                  className="bg-background border-border flex-1 text-sm"
                />
                <Select 
                  value={failureData.timeUnit} 
                  onValueChange={(value: any) => setFailureData(prev => ({ ...prev, timeUnit: value }))}
                >
                  <SelectTrigger className="w-24 bg-background border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Horas</SelectItem>
                    <SelectItem value="minutes">Minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Archivos de falla */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Archivos de falla</Label>
            <div>
              <input
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt"
                className="hidden"
                id="failure-files-input"
                type="file"
                onChange={handleFileChange}
              />
              <label
                htmlFor="failure-files-input"
                className="flex items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-muted-foreground/50 transition-colors bg-muted hover:bg-accent"
              >
                <div className="text-center">
                  <CloudUpload className="w-6 h-6 mx-auto text-muted-foreground mb-1.5" />
                  <p className="text-xs text-foreground">Haz clic o arrastra archivos aquí</p>
                  <p className="text-[10px] text-muted-foreground">PDF, DOC, XLS, imágenes hasta 10MB</p>
                  {failureData.files.length > 0 && (
                    <p className="text-xs text-success mt-1 font-medium">
                      {failureData.files.length} archivo(s) seleccionado(s)
                    </p>
                  )}
                </div>
              </label>
            </div>
            
            {/* Lista de archivos */}
            {failureData.files.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <p className="text-xs font-medium text-foreground">Archivos seleccionados:</p>
                {failureData.files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-info-muted border border-info-muted-foreground/20 rounded-md">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-3.5 w-3.5 text-info-muted-foreground shrink-0" />
                      <span className="text-xs font-medium text-info-muted-foreground truncate">{file.name}</span>
                      <span className="text-[10px] text-info-muted-foreground shrink-0">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0 shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleLoadSolution}
          >
            Cargar Mantenimiento Aplicado
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Modal de selección de componentes */}
      <ComponentSelectionModal
        isOpen={showComponentSelector}
        onClose={() => setShowComponentSelector(false)}
        components={allComponents}
        selectedComponents={selectedComponentIds}
        selectedSubcomponents={selectedSubcomponentIds}
        onSelectionChange={(components, subcomponents) => {
          setSelectedComponentIds(components);
          setSelectedSubcomponentIds(subcomponents);
        }}
        machineName={machineName}
      />
    </Dialog>
  );
}
