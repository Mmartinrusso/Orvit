import React, { useState, useEffect } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMachinesInitial } from '@/hooks/use-machines-initial';
import {
  TrendingUp,
  AlertTriangle,
  Settings,
  BarChart3,
  Thermometer,
  Gauge,
  Activity,
  Zap,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Loader2
} from 'lucide-react';

interface PredictiveMaintenanceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  editingMaintenance?: any | null;
  mode?: 'create' | 'edit';
  preselectedMachineId?: number;
}

interface MonitoringParameter {
  id: string;
  name: string;
  type: 'temperature' | 'vibration' | 'pressure' | 'current' | 'voltage' | 'speed' | 'flow' | 'level' | 'custom';
  unit: string;
  minThreshold: number;
  maxThreshold: number;
  warningThreshold: number;
  criticalThreshold: number;
  isActive: boolean;
}

interface PredictionModel {
  id: string;
  name: string;
  type: 'linear' | 'exponential' | 'polynomial' | 'ml' | 'custom';
  parameters: string[];
  accuracy: number;
  lastTraining: string;
  isActive: boolean;
}

export default function PredictiveMaintenanceDialog({
  isOpen,
  onClose,
  onSave,
  editingMaintenance,
  mode = 'create',
  preselectedMachineId
}: PredictiveMaintenanceDialogProps) {
  const { currentCompany, currentSector } = useCompany();
  const { user } = useAuth();

  // Validar que editingMaintenance sea un objeto válido
  const validEditingMaintenance = editingMaintenance && 
    typeof editingMaintenance === 'object' && 
    !Array.isArray(editingMaintenance) ? 
    editingMaintenance : null;

  // Estados principales
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    machineId: preselectedMachineId ? preselectedMachineId.toString() : '',
    componentIds: [] as string[],
    subcomponentIds: [] as string[],
    priority: 'MEDIUM',
    estimatedHours: 0,
    executionWindow: 'ANY_TIME',
    frequency: 30,
    frequencyUnit: 'DAYS',
    enabled: true,
    autoSchedule: true,
    notificationDays: 7,
    costThreshold: 0,
    efficiencyThreshold: 80,
    riskLevel: 'MEDIUM'
  });

  // ✨ OPTIMIZADO: Usar hook con React Query para máquinas
  const companyIdNum = currentCompany?.id ? parseInt(String(currentCompany.id)) : null;
  const sectorIdNum = currentSector?.id ? parseInt(String(currentSector.id)) : null;
  const { data: machinesData } = useMachinesInitial(
    companyIdNum,
    sectorIdNum,
    { enabled: isOpen && !!companyIdNum }
  );
  const machines = machinesData?.machines || [];

  // Estados para monitoreo
  const [monitoringParameters, setMonitoringParameters] = useState<MonitoringParameter[]>([]);
  const [predictionModels, setPredictionModels] = useState<PredictionModel[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [subcomponents, setSubcomponents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [loadingSubcomponents, setLoadingSubcomponents] = useState(false);

  // Estados para análisis
  const [analysisData, setAnalysisData] = useState({
    historicalDataPoints: 0,
    predictionAccuracy: 0,
    lastAnalysis: '',
    nextAnalysis: '',
    trends: [],
    anomalies: []
  });

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      if (validEditingMaintenance) {
        loadEditingData();
      }
    }
  }, [isOpen, validEditingMaintenance]);

  // Cargar componentes cuando se selecciona una máquina
  useEffect(() => {
    if (formData.machineId) {
      fetchComponents(formData.machineId);
      setFormData(prev => ({ ...prev, componentIds: [], subcomponentIds: [] }));
    }
  }, [formData.machineId]);

  // Cargar subcomponentes cuando se selecciona un componente
  useEffect(() => {
    if (formData.componentIds.length > 0) {
      // Cargar subcomponentes para el primer componente seleccionado
      fetchSubcomponents(formData.componentIds[0]);
      setFormData(prev => ({ ...prev, subcomponentIds: [] }));
    }
  }, [formData.componentIds]);

  // ✨ OPTIMIZADO: Máquinas vienen del hook, loadInitialData ya no es necesario
  const loadInitialData = async () => {
    // Las máquinas ahora vienen del hook useMachinesInitial
    // Esta función se mantiene para compatibilidad pero no hace nada
  };

  const fetchComponents = async (machineId: string) => {
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

  const loadEditingData = () => {
    if (validEditingMaintenance) {
      // Validar que editingMaintenance sea un objeto válido
      try {
        setFormData({
          title: String(validEditingMaintenance.title || ''),
          description: String(validEditingMaintenance.description || ''),
          machineId: validEditingMaintenance.machineId ? String(validEditingMaintenance.machineId) : '',
          componentIds: Array.isArray(validEditingMaintenance.componentIds) ? validEditingMaintenance.componentIds : [],
          subcomponentIds: Array.isArray(validEditingMaintenance.subcomponentIds) ? validEditingMaintenance.subcomponentIds : [],
          priority: String(validEditingMaintenance.priority || 'MEDIUM'),
          estimatedHours: Number(validEditingMaintenance.estimatedHours) || 0,
          executionWindow: String(validEditingMaintenance.executionWindow || 'ANY_TIME'),
          frequency: Number(validEditingMaintenance.frequency) || 30,
          frequencyUnit: String(validEditingMaintenance.frequencyUnit || 'DAYS'),
          enabled: Boolean(validEditingMaintenance.enabled !== false),
          autoSchedule: Boolean(validEditingMaintenance.autoSchedule !== false),
          notificationDays: Number(validEditingMaintenance.notificationDays) || 7,
          costThreshold: Number(validEditingMaintenance.costThreshold) || 0,
          efficiencyThreshold: Number(validEditingMaintenance.efficiencyThreshold) || 80,
          riskLevel: String(validEditingMaintenance.riskLevel || 'MEDIUM')
        });

        // Cargar parámetros de monitoreo si existen
        if (Array.isArray(validEditingMaintenance.monitoringParameters)) {
          setMonitoringParameters(validEditingMaintenance.monitoringParameters);
        }

        // Cargar modelos de predicción si existen
        if (Array.isArray(validEditingMaintenance.predictionModels)) {
          setPredictionModels(validEditingMaintenance.predictionModels);
        }

        // Cargar componentes y subcomponentes si existe machineId
        if (validEditingMaintenance.machineId) {
          fetchComponents(String(validEditingMaintenance.machineId));
        }
      } catch (error) {
        console.error('Error loading editing data:', error);
        // Si hay error, limpiar el estado
        setFormData({
          title: '',
          description: '',
          machineId: preselectedMachineId ? preselectedMachineId.toString() : '',
          componentIds: [],
          subcomponentIds: [],
          priority: 'MEDIUM',
          estimatedHours: 0,
          executionWindow: 'ANY_TIME',
          frequency: 30,
          frequencyUnit: 'DAYS',
          enabled: true,
          autoSchedule: true,
          notificationDays: 7,
          costThreshold: 0,
          efficiencyThreshold: 80,
          riskLevel: 'MEDIUM'
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "El título es requerido",
        variant: "destructive",
      });
      return;
    }

    if (!formData.machineId) {
      toast({
        title: "Error",
        description: "Debe seleccionar una máquina",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const maintenanceData = {
        ...formData,
        type: 'PREDICTIVE',
        companyId: currentCompany?.id,
        sectorId: currentSector?.id,
        createdById: user?.id,
        monitoringParameters,
        predictionModels,
        analysisData,
        scheduledDate: new Date().toISOString(),
        status: 'PENDING'
      };

      const response = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maintenanceData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear el mantenimiento predictivo');
      }

      const result = await response.json();
      
      toast({
        title: "Mantenimiento Predictivo Creado",
        description: "El mantenimiento predictivo se ha creado exitosamente",
        duration: 3000,
      });

      onSave(result);
      handleClose();

    } catch (error) {
      console.error('Error creating predictive maintenance:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al crear el mantenimiento predictivo",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      machineId: preselectedMachineId ? preselectedMachineId.toString() : '',
      componentIds: [],
      subcomponentIds: [],
      priority: 'MEDIUM',
      estimatedHours: 0,
      executionWindow: 'ANY_TIME',
      frequency: 30,
      frequencyUnit: 'DAYS',
      enabled: true,
      autoSchedule: true,
      notificationDays: 7,
      costThreshold: 0,
      efficiencyThreshold: 80,
      riskLevel: 'MEDIUM'
    });
    setMonitoringParameters([]);
    setPredictionModels([]);
    setComponents([]);
    setSubcomponents([]);
    onClose();
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Funciones para parámetros de monitoreo
  const addMonitoringParameter = () => {
    const newParameter: MonitoringParameter = {
      id: Date.now().toString(),
      name: '',
      type: 'temperature',
      unit: '',
      minThreshold: 0,
      maxThreshold: 100,
      warningThreshold: 80,
      criticalThreshold: 95,
      isActive: true
    };
    setMonitoringParameters(prev => [...prev, newParameter]);
  };

  const updateMonitoringParameter = (id: string, field: string, value: any) => {
    setMonitoringParameters(prev => 
      prev.map(param => 
        param.id === id ? { ...param, [field]: value } : param
      )
    );
  };

  const removeMonitoringParameter = (id: string) => {
    setMonitoringParameters(prev => prev.filter(param => param.id !== id));
  };

  // Funciones para modelos de predicción
  const addPredictionModel = () => {
    const newModel: PredictionModel = {
      id: Date.now().toString(),
      name: '',
      type: 'linear',
      parameters: [],
      accuracy: 0,
      lastTraining: new Date().toISOString(),
      isActive: true
    };
    setPredictionModels(prev => [...prev, newModel]);
  };

  const updatePredictionModel = (id: string, field: string, value: any) => {
    setPredictionModels(prev => 
      prev.map(model => 
        model.id === id ? { ...model, [field]: value } : model
      )
    );
  };

  const removePredictionModel = (id: string) => {
    setPredictionModels(prev => prev.filter(model => model.id !== id));
  };

  // Funciones auxiliares
  const getParameterTypeIcon = (type: string) => {
    switch (type) {
      case 'temperature': return <Thermometer className="h-4 w-4" />;
      case 'vibration': return <Activity className="h-4 w-4" />;
      case 'pressure': return <Gauge className="h-4 w-4" />;
      case 'current': return <Zap className="h-4 w-4" />;
      case 'voltage': return <Zap className="h-4 w-4" />;
      case 'speed': return <Activity className="h-4 w-4" />;
      case 'flow': return <Activity className="h-4 w-4" />;
      case 'level': return <BarChart3 className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'bg-success-muted text-success';
      case 'MEDIUM': return 'bg-warning-muted text-warning-muted-foreground';
      case 'HIGH': return 'bg-warning-muted text-warning-muted-foreground';
      case 'CRITICAL': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            {mode === 'create' ? 'Crear Mantenimiento Predictivo' : 'Editar Mantenimiento Predictivo'}
          </DialogTitle>
          <DialogDescription>
            Configure el mantenimiento predictivo basado en análisis de datos y tendencias
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        <form id="predictive-maintenance-form" onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="monitoring">Monitoreo</TabsTrigger>
              <TabsTrigger value="prediction">Predicción</TabsTrigger>
              <TabsTrigger value="analysis">Análisis</TabsTrigger>
              <TabsTrigger value="settings">Configuración</TabsTrigger>
            </TabsList>

            {/* Pestaña: Información General */}
            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Información Básica
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="title">Título del Mantenimiento Predictivo</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Ej: Análisis predictivo motor principal"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="priority">Prioridad</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
                      >
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

                    <div>
                      <Label htmlFor="riskLevel">Nivel de Riesgo</Label>
                      <Select
                        value={formData.riskLevel}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, riskLevel: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">Bajo</SelectItem>
                          <SelectItem value="MEDIUM">Medio</SelectItem>
                          <SelectItem value="HIGH">Alto</SelectItem>
                          <SelectItem value="CRITICAL">Crítico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="machine">Máquina *</Label>
                    <Select
                      value={formData.machineId}
                      onValueChange={(value) => handleInputChange('machineId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar máquina" />
                      </SelectTrigger>
                      <SelectContent>
                        {machines.length === 0 ? (
                          <SelectItem value="no-machines" disabled>No hay máquinas disponibles</SelectItem>
                        ) : (
                          machines.map((machine) => (
                            <SelectItem key={machine.id} value={machine.id.toString()}>
                              {machine.name} ({machine.nickname || 'Sin apodo'})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="components">Componentes (selección múltiple)</Label>
                      <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                        {!formData.machineId ? (
                          <p className="text-sm text-muted-foreground">Selecciona una máquina primero</p>
                        ) : loadingComponents ? (
                          <p className="text-sm text-muted-foreground">Cargando componentes...</p>
                        ) : components.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No hay componentes disponibles</p>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="all-components"
                                checked={formData.componentIds.length === components.length && components.length > 0}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFormData(prev => ({ ...prev, componentIds: components.map(c => c.id.toString()) }));
                                  } else {
                                    setFormData(prev => ({ ...prev, componentIds: [] }));
                                  }
                                }}
                              />
                              <Label htmlFor="all-components" className="text-sm font-medium">
                                Seleccionar todos
                              </Label>
                            </div>
                            {components.map((component) => (
                              <div key={component.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`component-${component.id}`}
                                  checked={formData.componentIds.includes(component.id.toString())}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setFormData(prev => ({ 
                                        ...prev, 
                                        componentIds: [...prev.componentIds, component.id.toString()] 
                                      }));
                                    } else {
                                      setFormData(prev => ({ 
                                        ...prev, 
                                        componentIds: prev.componentIds.filter(id => id !== component.id.toString()) 
                                      }));
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

                    <div>
                      <Label htmlFor="subcomponents">Subcomponentes (selección múltiple)</Label>
                      <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                        {formData.componentIds.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Selecciona componentes primero</p>
                        ) : loadingSubcomponents ? (
                          <p className="text-sm text-muted-foreground">Cargando subcomponentes...</p>
                        ) : subcomponents.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No hay subcomponentes disponibles</p>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="all-subcomponents"
                                checked={formData.subcomponentIds.length === subcomponents.length && subcomponents.length > 0}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFormData(prev => ({ ...prev, subcomponentIds: subcomponents.map(c => c.id.toString()) }));
                                  } else {
                                    setFormData(prev => ({ ...prev, subcomponentIds: [] }));
                                  }
                                }}
                              />
                              <Label htmlFor="all-subcomponents" className="text-sm font-medium">
                                Seleccionar todos
                              </Label>
                            </div>
                            {subcomponents.map((subcomponent) => (
                              <div key={subcomponent.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`subcomponent-${subcomponent.id}`}
                                  checked={formData.subcomponentIds.includes(subcomponent.id.toString())}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setFormData(prev => ({ 
                                        ...prev, 
                                        subcomponentIds: [...prev.subcomponentIds, subcomponent.id.toString()] 
                                      }));
                                    } else {
                                      setFormData(prev => ({ 
                                        ...prev, 
                                        subcomponentIds: prev.subcomponentIds.filter(id => id !== subcomponent.id.toString()) 
                                      }));
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
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe el mantenimiento predictivo y sus objetivos..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="estimatedHours">Tiempo Estimado (horas)</Label>
                      <Input
                        id="estimatedHours"
                        type="number"
                        value={formData.estimatedHours}
                        onChange={(e) => setFormData(prev => ({ ...prev, estimatedHours: parseFloat(e.target.value) || 0 }))}
                        min="0"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="frequency">Frecuencia</Label>
                      <div className="flex gap-2">
                        <Input
                          id="frequency"
                          type="number"
                          value={formData.frequency}
                          onChange={(e) => setFormData(prev => ({ ...prev, frequency: parseInt(e.target.value) || 0 }))}
                          min="1"
                        />
                        <Select
                          value={formData.frequencyUnit}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, frequencyUnit: value }))}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HOURS">Horas</SelectItem>
                            <SelectItem value="DAYS">Días</SelectItem>
                            <SelectItem value="WEEKS">Semanas</SelectItem>
                            <SelectItem value="MONTHS">Meses</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="notificationDays">Días de Notificación</Label>
                      <Input
                        id="notificationDays"
                        type="number"
                        value={formData.notificationDays}
                        onChange={(e) => setFormData(prev => ({ ...prev, notificationDays: parseInt(e.target.value) || 0 }))}
                        min="0"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pestaña: Parámetros de Monitoreo */}
            <TabsContent value="monitoring" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Parámetros de Monitoreo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      Configure los parámetros que se monitorearán para el análisis predictivo
                    </p>
                    <Button type="button" onClick={addMonitoringParameter} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Parámetro
                    </Button>
                  </div>

                  {monitoringParameters.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No hay parámetros de monitoreo configurados</p>
                      <p className="text-sm">Haga clic en &quot;Agregar Parámetro&quot; para comenzar</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {monitoringParameters.map((parameter) => (
                        <Card key={parameter.id} className="p-4">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-2">
                              {getParameterTypeIcon(parameter.type)}
                              <h4 className="font-medium">Parámetro de Monitoreo</h4>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMonitoringParameter(parameter.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Nombre del Parámetro</Label>
                              <Input
                                value={parameter.name}
                                onChange={(e) => updateMonitoringParameter(parameter.id, 'name', e.target.value)}
                                placeholder="Ej: Temperatura del motor"
                              />
                            </div>
                            <div>
                              <Label>Tipo de Parámetro</Label>
                              <Select
                                value={parameter.type}
                                onValueChange={(value) => updateMonitoringParameter(parameter.id, 'type', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="temperature">Temperatura</SelectItem>
                                  <SelectItem value="vibration">Vibración</SelectItem>
                                  <SelectItem value="pressure">Presión</SelectItem>
                                  <SelectItem value="current">Corriente</SelectItem>
                                  <SelectItem value="voltage">Voltaje</SelectItem>
                                  <SelectItem value="speed">Velocidad</SelectItem>
                                  <SelectItem value="flow">Flujo</SelectItem>
                                  <SelectItem value="level">Nivel</SelectItem>
                                  <SelectItem value="custom">Personalizado</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Unidad de Medida</Label>
                              <Input
                                value={parameter.unit}
                                onChange={(e) => updateMonitoringParameter(parameter.id, 'unit', e.target.value)}
                                placeholder="Ej: °C, RPM, PSI"
                              />
                            </div>
                            <div>
                              <Label>Estado</Label>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  checked={parameter.isActive}
                                  onCheckedChange={(checked) => updateMonitoringParameter(parameter.id, 'isActive', checked)}
                                />
                                <span className="text-sm">{parameter.isActive ? 'Activo' : 'Inactivo'}</span>
                              </div>
                            </div>
                          </div>

                          <Separator className="my-4" />

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <Label>Umbral Mínimo</Label>
                              <Input
                                type="number"
                                value={parameter.minThreshold}
                                onChange={(e) => updateMonitoringParameter(parameter.id, 'minThreshold', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div>
                              <Label>Umbral Máximo</Label>
                              <Input
                                type="number"
                                value={parameter.maxThreshold}
                                onChange={(e) => updateMonitoringParameter(parameter.id, 'maxThreshold', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div>
                              <Label>Umbral de Advertencia</Label>
                              <Input
                                type="number"
                                value={parameter.warningThreshold}
                                onChange={(e) => updateMonitoringParameter(parameter.id, 'warningThreshold', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div>
                              <Label>Umbral Crítico</Label>
                              <Input
                                type="number"
                                value={parameter.criticalThreshold}
                                onChange={(e) => updateMonitoringParameter(parameter.id, 'criticalThreshold', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pestaña: Modelos de Predicción */}
            <TabsContent value="prediction" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Modelos de Predicción
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      Configure los modelos de predicción para el análisis de datos
                    </p>
                    <Button type="button" onClick={addPredictionModel} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Modelo
                    </Button>
                  </div>

                  {predictionModels.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No hay modelos de predicción configurados</p>
                      <p className="text-sm">Haga clic en &quot;Agregar Modelo&quot; para comenzar</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {predictionModels.map((model) => (
                        <Card key={model.id} className="p-4">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <BarChart3 className="h-4 w-4" />
                              <h4 className="font-medium">Modelo de Predicción</h4>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePredictionModel(model.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Nombre del Modelo</Label>
                              <Input
                                value={model.name}
                                onChange={(e) => updatePredictionModel(model.id, 'name', e.target.value)}
                                placeholder="Ej: Modelo de temperatura lineal"
                              />
                            </div>
                            <div>
                              <Label>Tipo de Modelo</Label>
                              <Select
                                value={model.type}
                                onValueChange={(value) => updatePredictionModel(model.id, 'type', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="linear">Lineal</SelectItem>
                                  <SelectItem value="exponential">Exponencial</SelectItem>
                                  <SelectItem value="polynomial">Polinomial</SelectItem>
                                  <SelectItem value="ml">Machine Learning</SelectItem>
                                  <SelectItem value="custom">Personalizado</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Precisión (%)</Label>
                              <Input
                                type="number"
                                value={model.accuracy}
                                onChange={(e) => updatePredictionModel(model.id, 'accuracy', parseFloat(e.target.value) || 0)}
                                min="0"
                                max="100"
                                step="0.1"
                              />
                            </div>
                            <div>
                              <Label>Estado</Label>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  checked={model.isActive}
                                  onCheckedChange={(checked) => updatePredictionModel(model.id, 'isActive', checked)}
                                />
                                <span className="text-sm">{model.isActive ? 'Activo' : 'Inactivo'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4">
                            <Label>Parámetros del Modelo</Label>
                            <Textarea
                              value={model.parameters.join(', ')}
                              onChange={(e) => updatePredictionModel(model.id, 'parameters', e.target.value.split(',').map(p => p.trim()))}
                              placeholder="Ingrese los parámetros separados por comas"
                              rows={2}
                            />
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pestaña: Análisis y Tendencias */}
            <TabsContent value="analysis" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Análisis y Tendencias
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">Configuración de Análisis</h4>
                      <div className="space-y-4">
                        <div>
                          <Label>Puntos de Datos Históricos</Label>
                          <Input
                            type="number"
                            value={analysisData.historicalDataPoints}
                            onChange={(e) => setAnalysisData(prev => ({ ...prev, historicalDataPoints: parseInt(e.target.value) || 0 }))}
                            placeholder="1000"
                          />
                        </div>
                        <div>
                          <Label>Precisión de Predicción Objetivo (%)</Label>
                          <Input
                            type="number"
                            value={analysisData.predictionAccuracy}
                            onChange={(e) => setAnalysisData(prev => ({ ...prev, predictionAccuracy: parseFloat(e.target.value) || 0 }))}
                            min="0"
                            max="100"
                            step="0.1"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Programación de Análisis</h4>
                      <div className="space-y-4">
                        <div>
                          <Label>Último Análisis</Label>
                          <Input
                            type="datetime-local"
                            value={analysisData.lastAnalysis}
                            onChange={(e) => setAnalysisData(prev => ({ ...prev, lastAnalysis: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label>Próximo Análisis</Label>
                          <Input
                            type="datetime-local"
                            value={analysisData.nextAnalysis}
                            onChange={(e) => setAnalysisData(prev => ({ ...prev, nextAnalysis: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-3">Configuración de Alertas</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Umbral de Costo</Label>
                        <Input
                          type="number"
                          value={formData.costThreshold}
                          onChange={(e) => setFormData(prev => ({ ...prev, costThreshold: parseFloat(e.target.value) || 0 }))}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label>Umbral de Eficiencia (%)</Label>
                        <Input
                          type="number"
                          value={formData.efficiencyThreshold}
                          onChange={(e) => setFormData(prev => ({ ...prev, efficiencyThreshold: parseFloat(e.target.value) || 0 }))}
                          min="0"
                          max="100"
                          step="0.1"
                        />
                      </div>
                      <div>
                        <Label>Nivel de Riesgo</Label>
                        <Select
                          value={formData.riskLevel}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, riskLevel: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LOW">Bajo</SelectItem>
                            <SelectItem value="MEDIUM">Medio</SelectItem>
                            <SelectItem value="HIGH">Alto</SelectItem>
                            <SelectItem value="CRITICAL">Crítico</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pestaña: Configuración Avanzada */}
            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Configuración Avanzada
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">Configuración del Sistema</h4>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Mantenimiento Habilitado</Label>
                            <p className="text-sm text-muted-foreground">Activar el mantenimiento predictivo</p>
                          </div>
                          <Switch
                            checked={formData.enabled}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Programación Automática</Label>
                            <p className="text-sm text-muted-foreground">Programar automáticamente las tareas</p>
                          </div>
                          <Switch
                            checked={formData.autoSchedule}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoSchedule: checked }))}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Ventana de Ejecución</h4>
                      <div className="space-y-4">
                        <div>
                          <Label>Tipo de Ventana</Label>
                          <Select
                            value={formData.executionWindow}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, executionWindow: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ANY_TIME">Cualquier momento</SelectItem>
                              <SelectItem value="WORK_HOURS">Horario laboral</SelectItem>
                              <SelectItem value="NIGHT_SHIFT">Turno nocturno</SelectItem>
                              <SelectItem value="WEEKEND">Fin de semana</SelectItem>
                              <SelectItem value="CUSTOM">Personalizado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-3">Configuración de Notificaciones</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Días de Anticipación para Notificación</Label>
                        <Input
                          type="number"
                          value={formData.notificationDays}
                          onChange={(e) => setFormData(prev => ({ ...prev, notificationDays: parseInt(e.target.value) || 0 }))}
                          min="0"
                        />
                      </div>
                      <div>
                        <Label>Frecuencia de Análisis</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={formData.frequency}
                            onChange={(e) => setFormData(prev => ({ ...prev, frequency: parseInt(e.target.value) || 0 }))}
                            min="1"
                          />
                          <Select
                            value={formData.frequencyUnit}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, frequencyUnit: value }))}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="HOURS">Horas</SelectItem>
                              <SelectItem value="DAYS">Días</SelectItem>
                              <SelectItem value="WEEKS">Semanas</SelectItem>
                              <SelectItem value="MONTHS">Meses</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" form="predictive-maintenance-form" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {mode === 'create' ? 'Crear Mantenimiento Predictivo' : 'Guardar Cambios'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
