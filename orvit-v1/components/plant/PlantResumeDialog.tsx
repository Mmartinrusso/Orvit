'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
// Removed Command and Popover imports as they're no longer used
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  CheckCircle,
  Play,
  Camera,
  Upload,
  X,
  Cog,
  CheckCircle2,
  Search,
  Plus,
  Loader2
} from 'lucide-react';
import { useMachinesInitial } from '@/hooks/use-machines-initial';

interface PlantResumeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  plantStopId?: string;
}

export default function PlantResumeDialog({ isOpen, onClose, plantStopId }: PlantResumeDialogProps) {
  const { currentSector, currentCompany, refreshSectors } = useCompany();
  const { user } = useAuth();
  
  // ✨ OPTIMIZADO: Usar hook con React Query para máquinas
  const companyIdNum = currentCompany?.id ? parseInt(String(currentCompany.id)) : null;
  const sectorIdNum = currentSector?.id ? parseInt(String(currentSector.id)) : null;
  const { data: machinesData } = useMachinesInitial(
    companyIdNum,
    sectorIdNum,
    { enabled: isOpen && !!companyIdNum && !!sectorIdNum }
  );
  const machines = machinesData?.machines || [];
  
  const [components, setComponents] = useState<any[]>([]);
  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const [requestedTools, setRequestedTools] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [formData, setFormData] = useState({
    detailedDescription: '',
    machineId: '',
    componentId: '',
    subcomponentId: '',
    selectedTools: [] as string[],
    requestedToolsUsed: [] as string[],
    photos: [] as File[]
  });

  // ✨ OPTIMIZADO: Máquinas vienen del hook, solo cargar herramientas
  useEffect(() => {
    if (isOpen && currentCompany) {
      if (plantStopId) {
        fetchRequestedTools();
      } else {
        fetchAvailableTools();
      }
    }
  }, [isOpen, plantStopId, currentCompany]);

  // Fetch available tools cuando se cargan los requested tools
  useEffect(() => {
    if (currentCompany) {
      fetchAvailableTools();
    }
  }, [requestedTools, currentCompany]);

  const fetchComponents = async (machineId: number) => {
    try {
      const response = await fetch(`/api/machines/${machineId}/components`);
      if (response.ok) {
        const data = await response.json();
        setComponents(data);
      }
    } catch (error) {
      console.error('Error fetching components:', error);
    }
  };

  const fetchAvailableTools = async (search?: string) => {
    if (!currentCompany) return;
    
    try {
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
      const response = await fetch(`/api/tools?companyId=${currentCompany.id}${searchParam}`);
      if (response.ok) {
        const data = await response.json();
        // Filtrar productos que no están en los solicitados durante la parada
        const requestedToolNames = requestedTools.map(rt => rt.toolName);
        const filtered = data.tools.filter((tool: any) => !requestedToolNames.includes(tool.name));
        setAvailableTools(filtered || []);
      }
    } catch (error) {
      console.error('Error fetching tools:', error);
      setAvailableTools([]);
    }
  };

  const fetchRequestedTools = async () => {
    if (!plantStopId || !currentCompany) return;
    
    try {
              const response = await fetch(`/api/plant/tool-requests/by-stop/${plantStopId}?companyId=${currentCompany.id}`);
      if (response.ok) {
        const data = await response.json();
        const tools = data.tools || [];
        setRequestedTools(tools);
        
        // Pre-seleccionar automáticamente todas las herramientas solicitadas
        const toolNames = tools.map((tool: any) => tool.toolName);
        setFormData(prev => ({
          ...prev,
          requestedToolsUsed: toolNames
        }));
        
      }
    } catch (error) {
      console.error('Error fetching requested tools:', error);
    }
  };

  const handleMachineSelect = (machineId: string) => {
    setFormData(prev => ({ ...prev, machineId, componentId: '', subcomponentId: '' }));
    if (machineId) {
      fetchComponents(Number(machineId));
    }
  };

  const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newPhotos = Array.from(files);
      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, ...newPhotos]
      }));
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const uploadPhotosToS3 = async (photos: File[]): Promise<string[]> => {
    if (photos.length === 0) return [];

    setUploadingImages(true);
    const uploadedUrls: string[] = [];

    try {
      for (const photo of photos) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', photo);
        formDataUpload.append('type', 'plant-resume');
        formDataUpload.append('entityId', `${currentSector?.id}-${Date.now()}`);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formDataUpload,
        });

        if (response.ok) {
          const result = await response.json();
          uploadedUrls.push(result.url);
        } else {
          throw new Error(`Error uploading ${photo.name}`);
        }
      }
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast.error('Error al subir algunas fotos');
    } finally {
      setUploadingImages(false);
    }

    return uploadedUrls;
  };

  const handleSubmit = async () => {
    if (!formData.detailedDescription.trim()) {
      toast.error('Por favor completa la descripción detallada del trabajo realizado');
      return;
    }

    if (!formData.machineId) {
      toast.error('Por favor selecciona la máquina que fue reparada');
      return;
    }

    // Validar que se haya seleccionado al menos un producto si hay productos solicitados
    const hasRequestedTools = formData.requestedToolsUsed.length > 0;
    const hasAdditionalTools = formData.selectedTools.length > 0;
    
    if (requestedTools.length > 0 && !hasRequestedTools && !hasAdditionalTools) {
      toast.error('Debes marcar al menos un producto utilizado para el historial de reparación');
      return;
    }

    setIsLoading(true);
    try {
      // Subir fotos a S3 primero
      const photoUrls = await uploadPhotosToS3(formData.photos);

      const machine = machines.find(m => m.id.toString() === formData.machineId);
      const component = components.find(c => c.id.toString() === formData.componentId);
      const subcomponent = component?.subcomponents?.find((s: any) => s.id.toString() === formData.subcomponentId);

      // Combinar productos solicitados utilizados con productos adicionales  
      const allToolsUsed = [
        ...formData.requestedToolsUsed.map(toolName => {
          const tool = requestedTools.find(t => t.toolName === toolName);
          return `${toolName} (Solicitado - x${tool?.quantity || 1})`;
        }),
        ...formData.selectedTools.map(toolName => `${toolName} (Adicional)`)
      ];

      const resumeData = {
        plantStopId: plantStopId || `plant-stop-${currentSector?.id}`,
        sectorId: currentSector?.id,
        companyId: currentCompany?.id,
        supervisorId: user?.id,
        supervisorName: user?.name,
        toolsUsed: allToolsUsed,
        requestedToolsUsed: formData.requestedToolsUsed,
        additionalTools: formData.selectedTools,
        detailedDescription: formData.detailedDescription.trim(),
        machineId: Number(formData.machineId),
        machineName: machine?.name,
        componentId: formData.componentId ? Number(formData.componentId) : null,
        componentName: component?.name,
        subcomponentId: formData.subcomponentId ? Number(formData.subcomponentId) : null,
        subcomponentName: subcomponent?.name,
        photoUrls,
        timestamp: new Date().toISOString()
      };

      const response = await fetch('/api/plant/resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resumeData),
      });

      if (response.ok) {
        toast.success('Planta reactivada exitosamente. Guardando en historial...');
        
        // Refrescar sectores para actualizar el estado
        await refreshSectors();
        
        onClose();
        setFormData({
          detailedDescription: '',
          machineId: '',
          componentId: '',
          subcomponentId: '',
          selectedTools: [],
          requestedToolsUsed: [],
          photos: []
        });
        setRequestedTools([]);
      } else {
        throw new Error('Error al reactivar la planta');
      }
    } catch (error) {
      toast.error('Error al reactivar la planta');
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = formData.detailedDescription.trim() && formData.machineId && 
    (requestedTools.length === 0 || formData.requestedToolsUsed.length > 0 || formData.selectedTools.length > 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-success" />
            Reactivar Planta - {currentSector?.name}
          </DialogTitle>
          <p className="text-muted-foreground">
            Documenta la resolución del problema y reactiva las operaciones del sector
          </p>
        </DialogHeader>

        <DialogBody>
        <div className="space-y-6">
          <div className="bg-warning-muted border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-warning rounded-full animate-pulse"></div>
              <span className="font-semibold text-warning-muted-foreground">Sector en Parada</span>
            </div>
            <p className="text-warning-muted-foreground text-sm">
              Documenta qué se reparó y cómo se solucionó el problema para el historial de mantenimiento.
            </p>
          </div>

          {/* Descripción detallada */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Descripción Detallada del Trabajo Realizado *
            </label>
            <Textarea
              value={formData.detailedDescription}
              onChange={(e) => setFormData(prev => ({ ...prev, detailedDescription: e.target.value }))}
              placeholder="Describe en detalle qué se hizo para solucionar el problema: piezas cambiadas, ajustes realizados, procedimientos seguidos..."
              className="min-h-[120px] resize-none"
              maxLength={1000}
            />
            <div className="text-right text-xs text-muted-foreground mt-1">
              {formData.detailedDescription.length}/1000 caracteres
            </div>
          </div>

          {/* Selección de máquina */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Máquina Reparada *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-60 overflow-y-auto">
              {machines.map((machine) => (
                <Card 
                  key={machine.id}
                  className={cn('cursor-pointer transition-all duration-200 hover:shadow-lg', formData.machineId === machine.id.toString() ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md')}
                  onClick={() => handleMachineSelect(machine.id.toString())}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Cog className="h-6 w-6 text-primary" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold truncate">{machine.name}</h4>
                        <p className="text-sm text-muted-foreground truncate">{machine.nickname || 'Sin apodo'}</p>
                      </div>
                      {formData.machineId === machine.id.toString() && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Componentes */}
          {formData.machineId && components.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Componente Reparado (Opcional)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-48 overflow-y-auto">
                {components.map((component) => (
                  <Card 
                    key={component.id}
                    className={cn('cursor-pointer transition-all duration-200 hover:shadow-lg', formData.componentId === component.id.toString() ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md')}
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      componentId: component.id.toString(),
                      subcomponentId: '' 
                    }))}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">{component.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {component.subcomponents?.length || 0} subcomponentes
                          </p>
                        </div>
                        {formData.componentId === component.id.toString() && (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Subcomponentes */}
          {formData.componentId && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Subcomponente Específico (Opcional)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-40 overflow-y-auto">
                {components
                  .find(c => c.id.toString() === formData.componentId)
                  ?.subcomponents?.map((subcomponent: any) => (
                    <Card 
                      key={subcomponent.id}
                      className={cn('cursor-pointer transition-all duration-200 hover:shadow-lg', formData.subcomponentId === subcomponent.id.toString() ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md')}
                      onClick={() => setFormData(prev => ({ 
                        ...prev, 
                        subcomponentId: subcomponent.id.toString() 
                      }))}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{subcomponent.name}</span>
                          {formData.subcomponentId === subcomponent.id.toString() && (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {/* Productos Solicitados Durante la Parada */}
          {requestedTools.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Productos Solicitados Durante la Parada
              </label>
              <p className="text-sm text-muted-foreground mb-2">
                Estos productos fueron solicitados durante la parada y están pre-seleccionados. Desmarca los que NO utilizaste.
              </p>
              <div className="bg-success-muted border border-border rounded-lg p-3 mb-4">
                <p className="text-success-muted-foreground text-sm font-medium">
                  Productos pre-seleccionados automáticamente. Puedes desmarcar los que no utilizaste.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto bg-info-muted p-4 rounded-lg border">
                {requestedTools.map((tool, index) => {
                  const isSelected = formData.requestedToolsUsed.includes(tool.toolName);
                  return (
                    <Card 
                      key={index}
                      className={cn('cursor-pointer transition-all duration-200 hover:shadow-lg border-l-4', isSelected ? 'ring-2 ring-success shadow-lg border-l-success bg-success-muted' : 'hover:shadow-md border-l-primary bg-card')}
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          requestedToolsUsed: isSelected
                            ? prev.requestedToolsUsed.filter(t => t !== tool.toolName)
                            : [...prev.requestedToolsUsed, tool.toolName]
                        }));
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-sm">{tool.toolName}</h4>
                              <Badge variant="secondary" className="text-xs">
                                Cant: {tool.quantity}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Para:</span> {tool.reason}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Solicitado por:</span> {tool.requestedBy}
                            </p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-5 w-5 text-success" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {formData.requestedToolsUsed.length > 0 && (
                <div className="mt-4 p-3 bg-success-muted border rounded-lg">
                  <h4 className="font-semibold text-sm text-success-muted-foreground mb-2">
                    Productos Solicitados Utilizados ({formData.requestedToolsUsed.length}):
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {formData.requestedToolsUsed.map((toolName, index) => {
                      const tool = requestedTools.find(t => t.toolName === toolName);
                      return (
                        <Badge 
                          key={index} 
                          variant="secondary" 
                          className="bg-success-muted text-success-muted-foreground"
                        >
                          {toolName} (x{tool?.quantity || 1})
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Productos Adicionales del Pañol */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Productos Adicionales del Pañol
            </label>
            <p className="text-sm text-muted-foreground mb-4">
              ¿Necesitaste productos adicionales que no fueron solicitados durante la parada? Selecciónalos aquí organizados por tipo.
            </p>

            {availableTools.length === 0 ? (
              <div className="mt-3 p-3 bg-info-muted border rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="text-info-muted-foreground mt-0.5">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-info-muted-foreground">
                      No hay productos adicionales registrados
                    </p>
                    <p className="text-sm text-info-muted-foreground mt-1">
                      Solo aparecerán aquí productos del pañol que no fueron solicitados durante la parada. 
                      Los productos ya solicitados se muestran en la sección superior.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Búsqueda Global */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Buscar productos..."
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    onChange={(e) => fetchAvailableTools(e.target.value)}
                  />
                </div>

                {/* Herramientas (TOOL) */}
                {(() => {
                  const herramientas = availableTools.filter((tool: any) => tool.itemType === 'TOOL');
                  return herramientas.length > 0 && (
                    <div className="bg-info-muted border rounded-lg p-4">
                      <h3 className="font-semibold text-info-muted-foreground mb-3 flex items-center gap-2">
                        Herramientas ({herramientas.length})
                      </h3>
                      <p className="text-xs text-info-muted-foreground mb-3">
                        Se prestan temporalmente y se devuelven al pañol
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {herramientas.map((tool: any) => {
                          const isSelected = formData.selectedTools.includes(tool.name);
                          return (
                            <Card 
                              key={tool.id}
                              className={cn('cursor-pointer transition-all duration-200 hover:shadow-lg', isSelected ? 'ring-2 ring-primary shadow-lg bg-primary/10' : 'hover:shadow-md bg-card')}
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  selectedTools: isSelected
                                    ? prev.selectedTools.filter(t => t !== tool.name)
                                    : [...prev.selectedTools, tool.name]
                                }));
                              }}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-2">
                    
                                    <span className="font-medium text-sm">{tool.name}</span>
                                  </div>
                                  {isSelected && (
                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Repuestos/Materiales (SUPPLY) */}
                {(() => {
                  const repuestos = availableTools.filter((tool: any) => tool.itemType === 'SUPPLY');
                  const selectedMachine = machines.find(m => m.id.toString() === formData.machineId);
                  
                  return repuestos.length > 0 && (
                    <div className="bg-muted border rounded-lg p-4">
                      <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                        Repuestos y Materiales ({repuestos.length})
                      </h3>
                      <div className="flex flex-col gap-2 text-xs text-muted-foreground mb-3">
                        <div>Se consumen en las máquinas y agotan el stock</div>
                        {selectedMachine && (
                          <div className="bg-muted p-2 rounded">
                            <strong>Máquina seleccionada:</strong> {selectedMachine.name}
                            <br />
                                                          Se muestran todos los repuestos. En el futuro se filtrarán por compatibilidad.
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {repuestos.map((tool: any) => {
                          const isSelected = formData.selectedTools.includes(tool.name);
                          return (
                            <Card 
                              key={tool.id}
                              className={cn('cursor-pointer transition-all duration-200 hover:shadow-lg', isSelected ? 'ring-2 ring-primary shadow-lg bg-primary/10' : 'hover:shadow-md bg-card')}
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  selectedTools: isSelected
                                    ? prev.selectedTools.filter(t => t !== tool.name)
                                    : [...prev.selectedTools, tool.name]
                                }));
                              }}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-2">
                    
                                    <div>
                                      <div className="font-medium text-sm">{tool.name}</div>
                                      {tool.category && (
                                        <div className="text-xs text-muted-foreground">
                                          {tool.category}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            
            {formData.selectedTools.length > 0 && (
              <div className="mt-4 p-3 bg-success-muted border rounded-lg">
                <h4 className="font-semibold text-sm text-success-muted-foreground mb-2">
                  Productos Adicionales Seleccionados ({formData.selectedTools.length}):
                </h4>
                <div className="flex flex-wrap gap-2">
                  {formData.selectedTools.map((toolName, index) => {
                    const tool = availableTools.find((t: any) => t.name === toolName);
                    const emoji = '';
                    return (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="bg-success-muted text-success-muted-foreground cursor-pointer hover:bg-success-muted/80"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            selectedTools: prev.selectedTools.filter(t => t !== toolName)
                          }));
                        }}
                      >
                        {emoji} {toolName}
                        <X className="ml-1 h-3 w-3" />
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Fotos */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Fotos del Trabajo Realizado
            </label>
            <div className="space-y-4">
              <div className="flex gap-2">
                <label className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handlePhotoCapture}
                    className="hidden"
                    id="camera-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => document.getElementById('camera-input')?.click()}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Tomar Foto
                  </Button>
                </label>
                <label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoCapture}
                    className="hidden"
                    id="upload-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('upload-input')?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Subir
                  </Button>
                </label>
              </div>

              {formData.photos.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {formData.photos.map((photo, index) => (
                    <div key={index} className="relative">
                      <img
                        src={URL.createObjectURL(photo)}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 p-0"
                        onClick={() => removePhoto(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>

          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit || isLoading || uploadingImages}
            className={cn(!canSubmit ? 'bg-muted cursor-not-allowed text-muted-foreground opacity-50' : 'bg-success hover:bg-success/90 text-white')}
          >
            {isLoading || uploadingImages ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {uploadingImages ? 'Subiendo fotos...' : 'Reactivando...'}
              </>
            ) : !canSubmit && requestedTools.length > 0 &&
                 formData.requestedToolsUsed.length === 0 &&
                 formData.selectedTools.length === 0 ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Marca productos utilizados
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Reactivar Planta
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 