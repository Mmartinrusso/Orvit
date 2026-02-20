'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogBody } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useMachinesInitial } from '@/hooks/use-machines-initial';
import { MaintenanceType, Priority } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Wrench,
  AlertTriangle,
  Calendar,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Loader2,
  Plus,
  User,
  Settings,
  FileText,
  Clock,
  Zap,
} from 'lucide-react';
import {
  maintenanceTypeLabels,
  priorityLabels,
  priorityColors,
  getSuggestedPriority,
} from './workOrders.helpers';
import { MachineTreeSelector } from './MachineTreeSelector';
import FailureQuickReportDialog from '@/components/failures/FailureQuickReportDialog';

interface WorkOrderWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  preselectedMachine?: any;
  preselectedUnidadMovil?: { id: number; nombre: string } | null;
  preselectedType?: string | null;
  preselectedComponentId?: string | number;
  preselectedSubcomponentId?: string | number;
}

// Definición de tipos de trabajo con íconos y colores usando tokens
const workOrderTypes = [
  {
    id: MaintenanceType.CORRECTIVE,
    name: 'Reparar algo que se rompió',
    subtitle: 'Correctivo - Algo dejó de funcionar',
    icon: Wrench,
    examples: ['La máquina no enciende', 'Se rompió una pieza', 'Hay una fuga', 'Ruido extraño'],
    bgColor: 'bg-warning-muted hover:bg-warning-muted/80',
    borderColor: 'border-warning/30',
    iconColor: 'text-warning-muted-foreground',
    ringColor: 'ring-warning',
  },
  {
    id: MaintenanceType.PREVENTIVE,
    name: 'Preparar para el futuro',
    subtitle: 'Preventivo - Mantenimiento programado',
    icon: Calendar,
    examples: ['Cambio de aceite', 'Limpiar filtros', 'Revisión general', 'Calibración'],
    bgColor: 'bg-info-muted hover:bg-info-muted/80',
    borderColor: 'border-info/30',
    iconColor: 'text-info-muted-foreground',
    ringColor: 'ring-info',
  },
  {
    id: MaintenanceType.EMERGENCY,
    name: 'Urgente - Parar todo',
    subtitle: 'Emergencia - Requiere atención inmediata',
    icon: AlertTriangle,
    examples: ['Peligro para operarios', 'Producción parada', 'Emergencia de seguridad'],
    bgColor: 'bg-destructive/10 hover:bg-destructive/20',
    borderColor: 'border-destructive/30',
    iconColor: 'text-destructive',
    ringColor: 'ring-destructive',
  },
  {
    id: MaintenanceType.PREDICTIVE,
    name: 'Mejorar o actualizar',
    subtitle: 'Predictivo - Basado en análisis',
    icon: TrendingUp,
    examples: ['Cambiar pieza', 'Automatizar proceso', 'Mejorar eficiencia', 'Modernizar'],
    bgColor: 'bg-success-muted hover:bg-success-muted/80',
    borderColor: 'border-success/30',
    iconColor: 'text-success',
    ringColor: 'ring-success',
  },
];

// Prioridades
const priorityOptions = [
  { id: Priority.LOW, name: 'Puede esperar', description: 'No hay apuro, cuando se pueda' },
  { id: Priority.MEDIUM, name: 'Normal', description: 'En los próximos días' },
  { id: Priority.HIGH, name: 'Importante', description: 'Hay que hacerlo pronto' },
  { id: Priority.URGENT, name: 'Urgente', description: 'Hacerlo ya mismo' },
];

export default function WorkOrderWizard({ isOpen, onClose, onSubmit, preselectedMachine, preselectedUnidadMovil, preselectedType, preselectedComponentId, preselectedSubcomponentId }: WorkOrderWizardProps) {
  const { currentCompany, currentSector } = useCompany();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);

  const companyIdNum = currentCompany?.id ? parseInt(String(currentCompany.id)) : null;
  const sectorIdNum = currentSector?.id ? parseInt(String(currentSector.id)) : null;
  const { data: machinesData } = useMachinesInitial(
    companyIdNum,
    sectorIdNum,
    { enabled: isOpen && !!companyIdNum }
  );
  const machines = machinesData?.machines || [];

  const [formData, setFormData] = useState({
    type: '' as MaintenanceType | '',
    priority: '' as Priority | '',
    machineId: '',
    componentId: '',
    subcomponentId: '',
    unidadMovilId: '',
    unidadMovilName: '',
    title: '',
    description: '',
    assignedToId: '',
    scheduledDate: '',
    notes: '',
    failureId: '', // For corrective maintenance
  });

  const [failures, setFailures] = useState<any[]>([]);
  const [loadingFailures, setLoadingFailures] = useState(false);
  const [showFailureCreateDialog, setShowFailureCreateDialog] = useState(false);

  // Dynamic total steps - add failure step for corrective
  const isCorrectiveType = formData.type === MaintenanceType.CORRECTIVE;
  const totalSteps = isCorrectiveType ? 5 : 4;
  const progress = (currentStep / totalSteps) * 100;

  // Reset form cuando se abre
  useEffect(() => {
    if (isOpen) {
      // Si hay tipo preseleccionado, saltar al paso 2
      const initialStep = preselectedType ? 2 : 1;
      setCurrentStep(initialStep);
      setFormData({
        type: (preselectedType as MaintenanceType) || '',
        priority: '',
        machineId: preselectedMachine?.id?.toString() || '',
        componentId: preselectedComponentId ? preselectedComponentId.toString() : '',
        subcomponentId: preselectedSubcomponentId ? preselectedSubcomponentId.toString() : '',
        unidadMovilId: preselectedUnidadMovil?.id?.toString() || '',
        unidadMovilName: preselectedUnidadMovil?.nombre || '',
        title: '',
        description: '',
        assignedToId: '',
        scheduledDate: '',
        notes: '',
        failureId: '',
      });
      setFailures([]);
      fetchUsers();
      if (preselectedMachine?.id) {
        fetchComponents(preselectedMachine.id);
        fetchFailures(preselectedMachine.id);
      }
    }
  }, [isOpen, preselectedMachine, preselectedUnidadMovil, preselectedType, preselectedComponentId, preselectedSubcomponentId]);

  // Auto-suggest priority based on type
  useEffect(() => {
    if (formData.type && !formData.priority) {
      const suggested = getSuggestedPriority(formData.type);
      setFormData(prev => ({ ...prev, priority: suggested }));
    }
  }, [formData.type]);

  const fetchUsers = async () => {
    try {
      if (!currentCompany?.id) return;
      const response = await fetch(`/api/companies/${currentCompany.id}/users`);
      if (response.ok) {
        const data = await response.json();
        const allUsers = data.users || data || [];
        setUsers(allUsers.filter((u: any) => u.role !== 'SUPERADMIN'));
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

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

  const fetchFailures = async (machineId: number) => {
    setLoadingFailures(true);
    try {
      const response = await fetch(`/api/failures/occurrences?machineId=${machineId}&status=OPEN`);
      if (response.ok) {
        const data = await response.json();
        setFailures(Array.isArray(data) ? data : data.occurrences || []);
      }
    } catch (error) {
      console.error('Error fetching failures:', error);
    } finally {
      setLoadingFailures(false);
    }
  };

  // Handler for when a new failure is created
  const handleFailureCreated = async (result: any) => {
    setShowFailureCreateDialog(false);
    // Refresh the failures list
    if (formData.machineId) {
      await fetchFailures(parseInt(formData.machineId));
    }
    // Auto-select the newly created failure
    if (result?.id) {
      setFormData(prev => ({ ...prev, failureId: result.id.toString() }));
      toast.success('Falla creada y seleccionada');
    }
  };

  const handleMachineChange = (machineId: string) => {
    setFormData(prev => ({ ...prev, machineId, componentId: '', subcomponentId: '', failureId: '' }));
    if (machineId) {
      fetchComponents(Number(machineId));
      fetchFailures(Number(machineId));
    }
  };

  const generateTitle = () => {
    const typeObj = workOrderTypes.find(t => t.id === formData.type);
    const machine = machines.find((m: any) => m.id.toString() === formData.machineId);
    let title = typeObj?.name || 'Orden de trabajo';
    if (machine) {
      title = `${maintenanceTypeLabels[formData.type as MaintenanceType]} - ${machine.name}`;
    } else if (formData.unidadMovilName) {
      title = `${maintenanceTypeLabels[formData.type as MaintenanceType]} - ${formData.unidadMovilName}`;
    }
    return title;
  };

  const canProceed = () => {
    // Check if machine or unidad movil is selected
    const hasAssetSelected = formData.machineId !== '' || formData.unidadMovilId !== '';

    // For corrective: Step 2 is failure selection, steps shift by 1
    if (isCorrectiveType) {
      switch (currentStep) {
        case 1:
          return formData.type !== '';
        case 2:
          return true; // Failure selection is optional
        case 3:
          return hasAssetSelected && formData.priority !== '';
        case 4:
          return formData.title.trim() !== '';
        case 5:
          return true;
        default:
          return false;
      }
    }

    // For other types: normal flow
    switch (currentStep) {
      case 1:
        return formData.type !== '';
      case 2:
        return hasAssetSelected && formData.priority !== '';
      case 3:
        return formData.title.trim() !== '';
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    // Generate title at the step before details (step 3 for normal, step 4 for corrective)
    const titleStepPrev = isCorrectiveType ? 3 : 2;
    if (currentStep === titleStepPrev && !formData.title) {
      setFormData(prev => ({ ...prev, title: generateTitle() }));
    }
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    if (formData.type || formData.machineId || formData.title) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const orderData = {
        title: formData.title || generateTitle(),
        description: formData.description,
        type: formData.type,
        priority: formData.priority,
        machineId: formData.machineId ? Number(formData.machineId) : null,
        componentId: formData.componentId ? Number(formData.componentId) : null,
        subcomponentId: formData.subcomponentId ? Number(formData.subcomponentId) : null,
        unidadMovilId: formData.unidadMovilId ? Number(formData.unidadMovilId) : null,
        assignedToId: formData.assignedToId ? Number(formData.assignedToId) : null,
        scheduledDate: formData.scheduledDate ? new Date(formData.scheduledDate) : null,
        notes: formData.notes,
        createdById: user?.id ? Number(user.id) : null,
        companyId: currentCompany?.id ? Number(currentCompany.id) : null,
        sectorId: currentSector?.id ? Number(currentSector.id) : null,
        failureOccurrenceId: formData.failureId ? Number(formData.failureId) : null,
      };

      await onSubmit(orderData);
      toast.success('Orden de trabajo creada exitosamente');
      onClose();
    } catch (error) {
      console.error('Error creating work order:', error);
      toast.error('Error al crear la orden de trabajo');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Tipo de trabajo
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-foreground">¿Qué necesitas hacer?</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Selecciona el tipo de trabajo que mejor describe la situación
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {workOrderTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = formData.type === type.id;

          return (
            <Card
              key={type.id}
              className={cn(
                'cursor-pointer transition-all duration-200 border-2',
                type.bgColor,
                isSelected
                  ? `${type.borderColor} ring-2 ${type.ringColor}`
                  : 'border-transparent hover:border-border'
              )}
              onClick={() => setFormData(prev => ({ ...prev, type: type.id }))}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-xl',
                    'bg-background/80 shadow-sm'
                  )}>
                    <Icon className={cn('h-5 w-5', type.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-foreground line-clamp-1">
                      {type.name}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {type.subtitle}
                    </p>
                    <div className="mt-2 space-y-0.5">
                      {type.examples.slice(0, 2).map((example, i) => (
                        <p key={i} className="text-xs text-muted-foreground/80">
                          • {example}
                        </p>
                      ))}
                    </div>
                  </div>
                  {isSelected && (
                    <div className={cn('flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center', type.iconColor, 'bg-current/10')}>
                      <Check className="h-3 w-3 text-current" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {formData.type && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Tip:</span> Esto definirá la prioridad sugerida y los campos disponibles
          </p>
        </div>
      )}
    </div>
  );

  // Step 2: Contexto operativo
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-foreground">Contexto operativo</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Indica la máquina y prioridad del trabajo
        </p>
      </div>

      <div className="space-y-4">
        {/* Unidad Móvil preseleccionada o Máquina y Componente */}
        {formData.unidadMovilId ? (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Unidad Móvil</Label>
            <Card className="border-2 border-primary bg-primary/5">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Settings className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{formData.unidadMovilName}</p>
                  <p className="text-xs text-muted-foreground">Vehículo / Equipo móvil</p>
                </div>
                <Check className="h-4 w-4 text-primary" />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Máquina *</Label>
            <MachineTreeSelector
              value={{
                machineId: formData.machineId ? Number(formData.machineId) : undefined,
                componentId: formData.componentId ? Number(formData.componentId) : undefined,
                subcomponentIds: formData.subcomponentId ? [Number(formData.subcomponentId)] : undefined,
              }}
              onChange={(selection) => {
                setFormData(prev => ({
                  ...prev,
                  machineId: selection.machineId?.toString() || '',
                  componentId: selection.componentId?.toString() || '',
                  subcomponentId: selection.subcomponentIds?.[0]?.toString() || '',
                }));
              }}
              machines={machines}
            />
          </div>
        )}

        <Separator />

        {/* Prioridad */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Prioridad *</Label>
          <div className="grid grid-cols-2 gap-2">
            {priorityOptions.map((priority) => {
              const isSelected = formData.priority === priority.id;
              return (
                <Card
                  key={priority.id}
                  className={cn(
                    'cursor-pointer transition-all border-2',
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-transparent bg-muted/30 hover:bg-muted/50'
                  )}
                  onClick={() => setFormData(prev => ({ ...prev, priority: priority.id }))}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-normal text-foreground">{priority.name}</p>
                      <p className="text-xs text-muted-foreground">{priority.description}</p>
                    </div>
                    {isSelected && <Check className="h-3 w-3 text-primary" />}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Fecha programada */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Fecha programada (opcional)</Label>
          <DatePicker
            value={formData.scheduledDate}
            onChange={(value) => setFormData(prev => ({ ...prev, scheduledDate: value }))}
            placeholder="dd/mm/yyyy"
            className="h-9 text-xs"
          />
        </div>
      </div>
    </div>
  );

  // Step 3: Detalles
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-foreground">Detalles del trabajo</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Describe qué hay que hacer
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Título *</Label>
          <Input
            className="h-9 text-xs"
            placeholder="Ej: Cambio de aceite del motor principal"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Descripción (opcional)</Label>
          <Textarea
            placeholder="Describe el trabajo a realizar, instrucciones especiales, etc."
            rows={4}
            className="resize-none text-xs"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Responsable (opcional)</Label>
          <Select
            value={formData.assignedToId || 'unassigned'}
            onValueChange={(value) => setFormData(prev => ({ ...prev, assignedToId: value === 'unassigned' ? undefined : value }))}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Sin asignar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Sin asignar</SelectItem>
              {users.map((u: any) => (
                <SelectItem key={u.id} value={u.id.toString()}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Notas adicionales (opcional)</Label>
          <Textarea
            placeholder="Materiales necesarios, precauciones, etc."
            rows={2}
            className="resize-none text-xs"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          />
        </div>
      </div>
    </div>
  );

  // Step 4: Revisión
  const renderStep4 = () => {
    const selectedType = workOrderTypes.find(t => t.id === formData.type);
    const selectedMachine = machines.find((m: any) => m.id.toString() === formData.machineId);
    const selectedUser = users.find((u: any) => u.id.toString() === formData.assignedToId);

    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-foreground">Revisar y crear</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Confirma los datos antes de crear la orden
          </p>
        </div>

        <Card className="border-border bg-background">
          <CardContent className="p-4 space-y-4">
            {/* Título */}
            <div>
              <h4 className="font-semibold text-foreground text-lg">
                {formData.title || generateTitle()}
              </h4>
              {formData.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {formData.description}
                </p>
              )}
            </div>

            <Separator />

            {/* Detalles en grid */}
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Tipo</dt>
                <dd className="font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                  {selectedType && (
                    <>
                      <selectedType.icon className={cn('h-4 w-4', selectedType.iconColor)} />
                      {maintenanceTypeLabels[formData.type as MaintenanceType]}
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Prioridad</dt>
                <dd className="mt-0.5">
                  <Badge variant="outline" className={cn('text-xs', priorityColors[formData.priority as Priority])}>
                    {priorityLabels[formData.priority as Priority]}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Máquina</dt>
                <dd className="font-medium text-foreground mt-0.5">
                  {selectedMachine?.name || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Responsable</dt>
                <dd className="font-medium text-foreground mt-0.5">
                  {selectedUser?.name || 'Sin asignar'}
                </dd>
              </div>
              {formData.scheduledDate && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Fecha programada</dt>
                  <dd className="font-medium text-foreground mt-0.5">
                    {new Date(formData.scheduledDate).toLocaleDateString('es-ES', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </dd>
                </div>
              )}
            </dl>

            {formData.notes && (
              <>
                <Separator />
                <div>
                  <dt className="text-sm text-muted-foreground">Notas</dt>
                  <dd className="text-sm text-foreground mt-1">{formData.notes}</dd>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Step for failure selection (only for corrective)
  const renderFailureStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-foreground">¿Hay una falla registrada?</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Selecciona una falla existente, crea una nueva, o continúa sin vincular
        </p>
      </div>

      <div className="space-y-3">
        {loadingFailures ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Option to create new failure */}
            <Card
              className="cursor-pointer transition-all border-2 border-dashed border-warning/50 hover:border-warning hover:bg-warning-muted/50"
              onClick={() => setShowFailureCreateDialog(true)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-warning-muted">
                  <Plus className="h-5 w-5 text-warning-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-warning-muted-foreground">Crear nueva falla</p>
                  <p className="text-xs text-muted-foreground">Registrar una falla y vincularla a esta orden</p>
                </div>
                <Zap className="h-4 w-4 text-warning-muted-foreground" />
              </CardContent>
            </Card>

            {/* Option to skip */}
            <Card
              className={cn(
                'cursor-pointer transition-all border-2',
                formData.failureId === ''
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-transparent bg-muted/30 hover:bg-muted/50'
              )}
              onClick={() => setFormData(prev => ({ ...prev, failureId: '' }))}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted">
                  <X className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Continuar sin vincular falla</p>
                  <p className="text-xs text-muted-foreground">La orden no estará asociada a ninguna falla</p>
                </div>
                {formData.failureId === '' && <Check className="h-4 w-4 text-primary" />}
              </CardContent>
            </Card>

            {/* Separator if there are existing failures */}
            {failures.length > 0 && (
              <div className="flex items-center gap-3 py-2">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">o selecciona una existente</span>
                <Separator className="flex-1" />
              </div>
            )}

            {/* List of existing failures */}
            {failures.map((failure: any) => {
              const isSelected = formData.failureId === failure.id.toString();
              return (
                <Card
                  key={failure.id}
                  className={cn(
                    'cursor-pointer transition-all border-2',
                    isSelected
                      ? 'border-warning bg-warning-muted/50 ring-1 ring-warning/20'
                      : 'border-transparent bg-muted/30 hover:bg-muted/50'
                  )}
                  onClick={() => setFormData(prev => ({ ...prev, failureId: failure.id.toString() }))}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-warning-muted">
                      <AlertTriangle className="h-5 w-5 text-warning-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {failure.failureMode?.name || failure.title || failure.description || 'Falla sin nombre'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {failure.component?.name || failure.machine?.name || 'Sin ubicación'} •{' '}
                        {failure.reportedAt ? new Date(failure.reportedAt).toLocaleDateString('es-ES') : 'Sin fecha'}
                      </p>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-warning-muted-foreground" />}
                  </CardContent>
                </Card>
              );
            })}

            {/* Empty state message when no failures */}
            {failures.length === 0 && (
              <p className="text-xs text-center text-muted-foreground py-2">
                No hay fallas abiertas para esta máquina
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    // For corrective: add failure step at position 2
    if (isCorrectiveType) {
      switch (currentStep) {
        case 1:
          return renderStep1();
        case 2:
          return renderFailureStep();
        case 3:
          return renderStep2();
        case 4:
          return renderStep3();
        case 5:
          return renderStep4();
        default:
          return null;
      }
    }

    // Normal flow for other types
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent
          size="md"
          className="p-0 rounded-2xl border border-border bg-card shadow-xl [&>button:last-child]:hidden"
        >
          <div className="flex flex-col h-full">
            {/* Header sticky */}
            <div className="flex-shrink-0 border-b border-border bg-card px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Crear orden de trabajo
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Paso {currentStep} de {totalSteps}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="h-9 w-9"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <Progress value={progress} className="h-1" />
              </div>
            </div>

            {/* Body con scroll */}
            <div className="flex-1 overflow-y-auto p-6">
              {renderCurrentStep()}
            </div>

            {/* Footer sticky */}
            <div className="flex-shrink-0 border-t border-border bg-card px-6 py-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  disabled={currentStep === 1 || isLoading}
                  className="items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 text-xs"
                >
                  <ChevronLeft className="h-3 w-3 mr-1" />
                  Anterior
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={isLoading}
                    className="items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md px-3 h-9 text-xs"
                  >
                    Cancelar
                  </Button>

                  {currentStep < totalSteps ? (
                    <Button
                      onClick={handleNext}
                      disabled={!canProceed() || isLoading}
                      className="items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 rounded-md px-3 bg-foreground hover:bg-foreground/90 text-white h-9 text-xs"
                    >
                      Siguiente
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSubmit}
                      disabled={isLoading}
                      className="items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 rounded-md px-3 bg-foreground hover:bg-foreground/90 text-white h-9 text-xs gap-1.5"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        <>
                          <Zap className="h-3 w-3" />
                          Crear OT
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm close dialog */}
      <AlertDialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Perderás toda la información que has ingresado. ¿Estás seguro?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={onClose}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Failure creation dialog */}
      <FailureQuickReportDialog
        isOpen={showFailureCreateDialog}
        onClose={() => setShowFailureCreateDialog(false)}
        onSuccess={handleFailureCreated}
        preselectedMachineId={formData.machineId ? parseInt(formData.machineId) : undefined}
      />
    </>
  );
}
