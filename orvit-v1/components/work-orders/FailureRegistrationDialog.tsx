'use client';

import { useState, useEffect } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  AlertTriangle,
  Network,
  CloudUpload,
  X,
  Upload,
  FileText
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';

interface FailureRegistrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onFailureSaved: (failureData: any) => void;
  onLoadSolution: (failureData: any) => void;
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
}

export default function FailureRegistrationDialog({
  isOpen,
  onClose,
  onFailureSaved,
  onLoadSolution
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
    files: []
  });
  
  // Estados de datos
  const [machines, setMachines] = useState<Machine[]>([]);
  const [components, setComponents] = useState<MachineComponent[]>([]);
  const [subcomponents, setSubcomponents] = useState<any[]>([]);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [loadingSubcomponents, setLoadingSubcomponents] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Estados para selección de componentes
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
  const [selectedSubcomponentIds, setSelectedSubcomponentIds] = useState<string[]>([]);
  const [showComponentSelector, setShowComponentSelector] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    if (!currentSector?.id) return;
    
    try {
      // Cargar máquinas
      const machinesResponse = await fetch(`/api/maquinas?sectorId=${currentSector.id}`);
      if (machinesResponse.ok) {
        const machinesData = await machinesResponse.json();
        setMachines(Array.isArray(machinesData) ? machinesData : []);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const handleMachineChange = async (machineId: string) => {
    setSelectedMachineId(machineId);
    setSelectedComponentIds([]);
    setSelectedSubcomponentIds([]);
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
        console.error('Error loading components:', error);
      } finally {
        setLoadingComponents(false);
      }
    }
  };

  const handleComponentChange = async (componentIds: string[]) => {
    setSelectedComponentIds(componentIds);
    setSelectedSubcomponentIds([]);
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
        console.error('Error loading subcomponents:', error);
      } finally {
        setLoadingSubcomponents(false);
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setFailureData(prev => ({
      ...prev,
      files: [...prev.files, ...files]
    }));
  };

  const removeFile = (index: number) => {
    setFailureData(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
  };

  const handleSaveFailure = async () => {
    if (!failureData.title || !failureData.description) {
      toast({
        title: 'Campos requeridos',
        description: 'Por favor completa el título y descripción de la falla',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const failureToSave = {
        ...failureData,
        affectedComponents: [...selectedComponentIds, ...selectedSubcomponentIds],
        companyId: currentCompany?.id,
        sectorId: currentSector?.id,
        createdById: user?.id,
        machineId: selectedMachineId
      };

      onFailureSaved(failureToSave);
    } catch (error) {
      console.error('Error saving failure:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la falla',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSolution = async () => {
    if (!failureData.title || !failureData.description) {
      toast({
        title: 'Campos requeridos',
        description: 'Por favor completa el título y descripción de la falla',
        variant: 'destructive'
      });
      return;
    }

    const failureToLoad = {
      ...failureData,
      affectedComponents: [...selectedComponentIds, ...selectedSubcomponentIds],
      companyId: currentCompany?.id,
      sectorId: currentSector?.id,
      createdById: user?.id,
      machineId: selectedMachineId
    };

    onLoadSolution(failureToLoad);
  };

  const resetForm = () => {
    setFailureData({
      title: '',
      reportDate: new Date().toISOString().split('T')[0],
      affectedComponents: [],
      description: '',
      failureType: 'MECANICA',
      priority: 'MEDIUM',
      estimatedTime: 0,
      timeUnit: 'hours',
      files: []
    });
    setSelectedMachineId('');
    setSelectedComponentIds([]);
    setSelectedSubcomponentIds([]);
    setShowComponentSelector(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Registrar Nueva Falla
          </DialogTitle>
          <DialogDescription>
            Registra una falla o problema para {currentCompany?.name || 'la empresa'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        <form className="space-y-6">
          {/* Título y Fecha */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Título de la falla</Label>
              <Input
                id="title"
                value={failureData.title}
                onChange={(e) => setFailureData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: Falla en motor principal"
                required
              />
            </div>
            <div>
              <Label htmlFor="reportDate">Fecha de reporte</Label>
              <DatePicker
                value={failureData.reportDate}
                onChange={(date) => setFailureData(prev => ({ ...prev, reportDate: date }))}
                placeholder="Seleccionar fecha"
              />
            </div>
          </div>

          {/* Componentes afectados */}
          <div>
            <Label className="mb-3 block">Componentes afectados</Label>
            <div className="space-y-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowComponentSelector(!showComponentSelector)}
                className="w-full"
              >
                <Network className="h-4 w-4 mr-2" />
                Seleccionar
              </Button>
              
              {showComponentSelector && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Selección de Equipamiento</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Máquina */}
                    <div>
                      <Label>Máquina</Label>
                      <Select value={selectedMachineId} onValueChange={handleMachineChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar máquina" />
                        </SelectTrigger>
                        <SelectContent>
                          {machines.map((machine) => (
                            <SelectItem key={machine.id} value={machine.id.toString()}>
                              {machine.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Componentes */}
                    {selectedMachineId && (
                      <div>
                        <Label>Componentes</Label>
                        <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
                          {loadingComponents ? (
                            <p className="text-sm text-muted-foreground">Cargando componentes...</p>
                          ) : components.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No hay componentes disponibles</p>
                          ) : (
                            <div className="space-y-2">
                              {components.map((component) => (
                                <div key={component.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`component-${component.id}`}
                                    checked={selectedComponentIds.includes(component.id.toString())}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        handleComponentChange([...selectedComponentIds, component.id.toString()]);
                                      } else {
                                        handleComponentChange(selectedComponentIds.filter(id => id !== component.id.toString()));
                                      }
                                    }}
                                  />
                                  <Label htmlFor={`component-${component.id}`} className="text-sm">
                                    {component.name}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Subcomponentes */}
                    {selectedComponentIds.length > 0 && (
                      <div>
                        <Label>Subcomponentes</Label>
                        <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
                          {loadingSubcomponents ? (
                            <p className="text-sm text-muted-foreground">Cargando subcomponentes...</p>
                          ) : subcomponents.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No hay subcomponentes disponibles</p>
                          ) : (
                            <div className="space-y-2">
                              {subcomponents.map((subcomponent) => (
                                <div key={subcomponent.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`subcomponent-${subcomponent.id}`}
                                    checked={selectedSubcomponentIds.includes(subcomponent.id.toString())}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedSubcomponentIds([...selectedSubcomponentIds, subcomponent.id.toString()]);
                                      } else {
                                        setSelectedSubcomponentIds(selectedSubcomponentIds.filter(id => id !== subcomponent.id.toString()));
                                      }
                                    }}
                                  />
                                  <Label htmlFor={`subcomponent-${subcomponent.id}`} className="text-sm">
                                    {subcomponent.name}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Descripción detallada */}
          <div>
            <Label htmlFor="description">Descripción detallada</Label>
            <Textarea
              id="description"
              value={failureData.description}
              onChange={(e) => setFailureData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe el problema en detalle..."
              className="min-h-[100px]"
              required
            />
          </div>

          {/* Tipo, Prioridad y Tiempo estimado */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="failureType">Tipo de falla</Label>
              <Select 
                value={failureData.failureType} 
                onValueChange={(value: any) => setFailureData(prev => ({ ...prev, failureType: value }))}
              >
                <SelectTrigger>
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
            <div>
              <Label htmlFor="priority">Prioridad</Label>
              <Select 
                value={failureData.priority} 
                onValueChange={(value: any) => setFailureData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baja</SelectItem>
                  <SelectItem value="MEDIUM">Media</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="estimatedTime">Tiempo estimado</Label>
              <div className="flex gap-2">
                <Input
                  id="estimatedTime"
                  type="number"
                  placeholder="0"
                  min="0"
                  step="0.5"
                  value={failureData.estimatedTime}
                  onChange={(e) => setFailureData(prev => ({ ...prev, estimatedTime: Number(e.target.value) }))}
                  className="flex-1"
                />
                <Select 
                  value={failureData.timeUnit} 
                  onValueChange={(value: any) => setFailureData(prev => ({ ...prev, timeUnit: value }))}
                >
                  <SelectTrigger className="w-24">
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
          <div>
            <Label>Archivos de falla</Label>
            <div className="mt-2">
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
                className="flex items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-muted-foreground transition-colors"
              >
                <div className="text-center">
                  <CloudUpload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Haz clic o arrastra archivos aquí</p>
                  <p className="text-xs text-muted-foreground">PDF, DOC, XLS, imágenes hasta 10MB</p>
                </div>
              </label>
            </div>
            
            {/* Lista de archivos */}
            {failureData.files.length > 0 && (
              <div className="mt-3 space-y-2">
                {failureData.files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm truncate">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleLoadSolution}
            disabled={loading}
          >
            Cargar Solución de Falla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
