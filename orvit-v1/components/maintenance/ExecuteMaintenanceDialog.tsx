import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Calendar,
  Building,
  Wrench,
  Timer,
  Target,
  ThumbsUp,
  FileCheck,
  MessageSquare,
  Ban,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Zap,
  Camera,
  X,
  Image as ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ExecuteMaintenanceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  maintenance: any;
  onExecute: (executionData: any) => void;
  isLoading?: boolean;
}

export default function ExecuteMaintenanceDialog({
  isOpen,
  onClose,
  maintenance,
  onExecute,
  isLoading = false
}: ExecuteMaintenanceDialogProps) {
       const [executionData, setExecutionData] = useState({
    actualDuration: '',
    actualDurationUnit: 'HOURS', // Unidad por defecto para tiempo de ejecución
    actualValue: '',
    actualUnit: 'CYCLES', // Unidad por defecto para ciclos/producto
    notes: '',
    issues: '',
    // qualityScore: '', // Removido - será asignado por supervisor
    completionStatus: 'COMPLETED',
    reExecutionReason: '', // Razón para re-ejecutar si ya fue completado hoy
    excludeQuantity: false // Excluir cantidad de ciclos/producto
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);

    useEffect(() => {
    if (isOpen && maintenance) {
      // Reset form when dialog opens
                          setExecutionData({
        actualDuration: '',
        actualDurationUnit: 'HOURS', // Por defecto en horas
        actualValue: maintenance.timeValue?.toString() || '',
        actualUnit: 'CYCLES', // Siempre inicializar con ciclos por defecto para cantidad
        notes: '',
        issues: '',
        // qualityScore: '', // Removido - será asignado por supervisor
        completionStatus: 'COMPLETED',
        reExecutionReason: '',
        excludeQuantity: false // Inicializar como no excluido
      });
      setErrors({});
      // Limpiar fotos previas
      photos.forEach(photo => URL.revokeObjectURL(photo.preview));
      setPhotos([]);
    }
  }, [isOpen, maintenance]);

  // Funciones para manejo de fotos
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPhotos = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));

    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  // Forzar re-render cuando cambie la unidad de tiempo para actualizar el tiempo estimado
  useEffect(() => {
    // Este efecto se ejecuta cuando cambia actualDurationUnit para forzar el re-render
  }, [executionData.actualDurationUnit]);

  // Debug logs removed for cleaner console

  if (!maintenance) return null;

  // Función para verificar si el mantenimiento ya fue completado hoy
  const isCompletedToday = () => {
    if (!maintenance.lastMaintenanceDate) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastMaintenance = new Date(maintenance.lastMaintenanceDate);
    lastMaintenance.setHours(0, 0, 0, 0);
    
    return lastMaintenance.getTime() === today.getTime();
  };

  const wasCompletedToday = isCompletedToday();

       const getTimeUnitText = (unit: string) => {
    switch (unit) {
      case 'HOURS': return 'horas';
      case 'MINUTES': return 'minutos';
      case 'DAYS': return 'días';
      case 'CYCLES': return 'ciclos';
      case 'KILOMETERS': return 'kilómetros';
      case 'SHIFTS': return 'turnos';
      case 'UNITS_PRODUCED': return 'unidades';
      default: return unit?.toLowerCase() || 'unidades';
    }
  };

  const getEstimatedTimeDisplay = () => {
    if (!maintenance.estimatedHours) return null;
    
    if (executionData.actualDurationUnit === 'MINUTES') {
      const estimatedMinutes = Math.round(maintenance.estimatedHours * 60);
      return `Estimado: ${estimatedMinutes} min`;
    } else {
      return `Estimado: ${maintenance.estimatedHours}h`;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeLabel = (type: any) => {
    // Asegurar que type sea un string
    const typeString = typeof type === 'string' ? type : (type?.type || 'UNKNOWN');
    switch (typeString) {
      case 'PREVENTIVE': return 'Preventivo';
      case 'CORRECTIVE': return 'Correctivo';
      case 'PREDICTIVE': return 'Predictivo';
      case 'EMERGENCY': return 'Emergencia';
      default: return typeString;
    }
  };

  const getPriorityLabel = (priority: any) => {
    // Asegurar que priority sea un string
    const priorityString = typeof priority === 'string' ? priority : (priority?.priority || 'UNKNOWN');
    switch (priorityString) {
      case 'URGENT': return 'Urgente';
      case 'HIGH': return 'Alta';
      case 'MEDIUM': return 'Media';
      case 'LOW': return 'Baja';
      default: return priorityString;
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!executionData.actualDuration) {
      newErrors.actualDuration = 'La duración real es requerida';
    } else if (isNaN(Number(executionData.actualDuration)) || Number(executionData.actualDuration) <= 0) {
      newErrors.actualDuration = 'Debe ser un número mayor a 0';
    }

         if (!executionData.excludeQuantity) {
       if (!executionData.actualValue) {
         newErrors.actualValue = 'La cantidad es requerida';
       } else if (isNaN(Number(executionData.actualValue)) || Number(executionData.actualValue) <= 0) {
         newErrors.actualValue = 'Debe ser un número mayor a 0';
       }
     }

    // Validación de calidad removida - será asignada por supervisor

    // Validar razón de re-ejecución si ya fue completado hoy
    if (wasCompletedToday && !executionData.reExecutionReason.trim()) {
      newErrors.reExecutionReason = 'Debe proporcionar una razón para re-ejecutar el mantenimiento';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    // Convertir la duración a horas si está en minutos
    let actualDurationInHours = Number(executionData.actualDuration);
    let originalDuration = Number(executionData.actualDuration);
    if (executionData.actualDurationUnit === 'MINUTES') {
      actualDurationInHours = actualDurationInHours / 60;
    }

    const executionPayload = {
      maintenanceId: maintenance.id,
      maintenanceType: maintenance.type || (maintenance.isPreventive ? 'PREVENTIVE' : 'CORRECTIVE'),
      isPreventive: maintenance.isPreventive || maintenance.type === 'PREVENTIVE',
      actualDuration: actualDurationInHours,
      originalDuration: originalDuration, // Agregar el valor original
      actualDurationUnit: executionData.actualDurationUnit, // Agregar la unidad de tiempo
      actualValue: executionData.excludeQuantity ? null : Number(executionData.actualValue),
      actualUnit: executionData.excludeQuantity ? null : executionData.actualUnit,
      excludeQuantity: executionData.excludeQuantity, // Agregar el campo de exclusión
      notes: executionData.notes,
      issues: executionData.issues,
      // qualityScore: null, // Removido - será asignado por supervisor
      completionStatus: executionData.completionStatus,
      reExecutionReason: wasCompletedToday ? executionData.reExecutionReason : null,
      executedAt: new Date().toISOString(),
      machineId: maintenance.machineId,
      machineName: typeof maintenance.machine?.name === 'string' ? maintenance.machine.name : (maintenance.machine?.name?.name || ''),
      unidadMovilId: (maintenance as any).unidadMovilId,
      unidadMovilName: typeof (maintenance as any).unidadMovil?.nombre === 'string' ? (maintenance as any).unidadMovil.nombre : ((maintenance as any).unidadMovil?.nombre?.nombre || ''),
      title: maintenance.title,
      description: maintenance.description,
      assignedToId: maintenance.assignedToId,
      assignedToName: maintenance.assignedTo?.name || maintenance.assignedWorker?.name,
      componentIds: maintenance.componentIds || [],
      subcomponentIds: maintenance.subcomponentIds || [],
      estimatedDuration: maintenance.estimatedHours,
      estimatedValue: maintenance.timeValue
    };

    console.log('🔧 Ejecutando mantenimiento:', executionPayload);
    console.log('🔍 Valores del formulario:', {
      actualDuration: executionData.actualDuration,
      actualDurationUnit: executionData.actualDurationUnit,
      actualValue: executionData.actualValue,
      actualUnit: executionData.actualUnit,
      excludeQuantity: executionData.excludeQuantity
    });
    console.log('🔍 Estado completo del formulario:', executionData);
    onExecute(executionPayload);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="lg" className="max-h-[95vh] overflow-hidden p-0 flex flex-col">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 flex-shrink-0 border-b bg-background">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold">
                  Realizar Mantenimiento
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                  <span>ID: {maintenance.id}</span>
                  <span>•</span>
                  <span>Equipo: {(() => {
                    const unidadMovilName = (maintenance as any).unidadMovil?.nombre;
                    const machineName = maintenance.machine?.name;
                    const name = unidadMovilName || machineName;
                    return typeof name === 'string' ? name : (name?.name || 'N/A');
                  })()}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`${getPriorityColor(maintenance.priority)} border-2 text-xs`}>
                {getPriorityLabel(maintenance.priority)}
              </Badge>
              <Badge variant="outline" className="border-2 text-xs">
                {getTypeLabel(maintenance.type)}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-4">
          {/* Información del Mantenimiento */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="h-4 w-4" />
                {maintenance.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Equipo</p>
                    <p className="text-sm font-semibold mt-0.5">
                      {(() => {
                        const unidadMovilName = (maintenance as any).unidadMovil?.nombre;
                        const machineName = maintenance.machine?.name;
                        const name = unidadMovilName || machineName;
                        return typeof name === 'string' ? name : (name?.name || 'N/A');
                      })()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Asignado a</p>
                    <p className="text-sm font-semibold mt-0.5">
                      {maintenance.assignedTo?.name || maintenance.assignedWorker?.name || 'Sin asignar'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Programado</p>
                    <p className="text-sm font-semibold mt-0.5">
                      {maintenance.scheduledDate ? 
                        format(new Date(maintenance.scheduledDate), 'dd/MM/yyyy', { locale: es }) : 
                        'N/A'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {maintenance.description && (
                <div className="p-2 bg-muted/30 rounded-lg mb-3">
                  <p className="text-xs text-muted-foreground mb-1">Descripción:</p>
                  <p className="text-xs">{maintenance.description}</p>
                </div>
              )}

              {/* Información de la unidad de medida */}
              {maintenance.timeUnit && maintenance.timeValue && (
                <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="h-3 w-3 text-blue-600" />
                    <p className="text-xs font-medium text-blue-800">Configuración Original</p>
                  </div>
                  <p className="text-xs text-blue-700">
                    Configurado para {maintenance.timeValue} {getTimeUnitText(maintenance.timeUnit).toLowerCase()}.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Advertencia si ya fue completado hoy */}
          {wasCompletedToday && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-orange-800 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  Mantenimiento ya completado hoy
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-orange-700 mb-3">
                  Este mantenimiento ya fue completado hoy. Proporcione una razón válida para re-ejecutar.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="reExecutionReason" className="text-orange-800 text-xs">
                    Razón para re-ejecutar *
                  </Label>
                  <Textarea
                    id="reExecutionReason"
                    placeholder="Explique por qué necesita ejecutar este mantenimiento nuevamente..."
                    value={executionData.reExecutionReason}
                    onChange={(e) => setExecutionData(prev => ({
                      ...prev,
                      reExecutionReason: e.target.value
                    }))}
                    className={`text-sm ${errors.reExecutionReason ? 'border-red-500' : 'border-orange-300'}`}
                    rows={2}
                  />
                  {errors.reExecutionReason && (
                    <p className="text-xs text-red-600">{typeof errors.reExecutionReason === 'string' ? errors.reExecutionReason : 'Error de validación'}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Formulario de Ejecución */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Timer className="h-4 w-4" />
                Datos de Ejecución
              </CardTitle>
            </CardHeader>
                         <CardContent className="space-y-3 pt-0">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 {/* Tiempo que tomó hacer el mantenimiento */}
                 <div className="space-y-2">
                   <Label htmlFor="actualDuration" className="text-xs">
                     Tiempo de Ejecución *
                   </Label>
                   <div className="flex gap-2">
                     <Input
                       id="actualDuration"
                       type="number"
                       step="0.1"
                       min="0"
                       placeholder="Ej: 2.5"
                       value={executionData.actualDuration}
                       onChange={(e) => setExecutionData(prev => ({
                         ...prev,
                         actualDuration: e.target.value
                       }))}
                       className={`flex-1 h-8 text-sm ${errors.actualDuration ? 'border-red-500' : ''}`}
                     />
                     <Select
                       value={executionData.actualDurationUnit}
                       onValueChange={(value) => {
                         console.log('🕐 Cambiando unidad de tiempo a:', value);
                         setExecutionData(prev => ({
                           ...prev,
                           actualDurationUnit: value
                         }));
                       }}
                     >
                       <SelectTrigger className="w-[95px] h-8 text-sm shrink-0">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="MINUTES">Min</SelectItem>
                         <SelectItem value="HOURS">Horas</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                   {errors.actualDuration && (
                     <p className="text-xs text-red-600">{typeof errors.actualDuration === 'string' ? errors.actualDuration : 'Error de validación'}</p>
                   )}
                   {getEstimatedTimeDisplay() && (
                     <p className="text-xs text-muted-foreground">
                       {getEstimatedTimeDisplay()}
                     </p>
                   )}
                 </div>

                 {/* Cantidad de ciclos/producto que aguantó */}
                 <div className="space-y-2">
                   <Label htmlFor="actualValue" className="text-xs">
                     Cantidad de Ciclos/Producto *
                   </Label>
                   
                   {!executionData.excludeQuantity && (
                     <>
                       <div className="flex gap-2">
                         <Input
                           id="actualValue"
                           type="number"
                           step="1"
                           min="0"
                           placeholder="Ej: 1000"
                           value={executionData.actualValue}
                           onChange={(e) => setExecutionData(prev => ({
                             ...prev,
                             actualValue: e.target.value
                           }))}
                           className={`flex-1 h-8 text-sm ${errors.actualValue ? 'border-red-500' : ''}`}
                         />
                         
                         <Select
                           value={executionData.actualUnit}
                           onValueChange={(value) => {
                             console.log('📊 Cambiando unidad de cantidad a:', value);
                             setExecutionData(prev => ({
                               ...prev,
                               actualUnit: value
                             }));
                           }}
                         >
                           <SelectTrigger className="w-[110px] h-8 text-sm shrink-0">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="CYCLES">Ciclos</SelectItem>
                             <SelectItem value="UNITS_PRODUCED">Unidades</SelectItem>
                             <SelectItem value="KILOMETERS">Km</SelectItem>
                             <SelectItem value="HOURS">Horas</SelectItem>
                             <SelectItem value="DAYS">Días</SelectItem>
                             <SelectItem value="SHIFTS">Turnos</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                       
                       {errors.actualValue && (
                         <p className="text-xs text-red-600">{typeof errors.actualValue === 'string' ? errors.actualValue : 'Error de validación'}</p>
                       )}
                       
                       <p className="text-xs text-muted-foreground">
                         Cantidad que aguantó antes del mantenimiento
                       </p>
                     </>
                   )}
                   
                   <div className="flex items-center space-x-2">
                     <Checkbox
                       id="excludeQuantity"
                       checked={executionData.excludeQuantity}
                       onCheckedChange={(checked) => {
                         setExecutionData(prev => ({
                           ...prev,
                           excludeQuantity: checked as boolean
                         }));
                       }}
                       className="h-3.5 w-3.5"
                     />
                     <Label htmlFor="excludeQuantity" className="text-xs font-medium">
                       Excluir cantidad de ciclos/producto
                     </Label>
                   </div>
                 </div>

                 {/* Estado de Finalización */}
                 <div className="space-y-2">
                   <Label htmlFor="completionStatus" className="text-xs">
                     Estado de Finalización
                   </Label>
                   <Select
                     value={executionData.completionStatus}
                     onValueChange={(value) => setExecutionData(prev => ({
                       ...prev,
                       completionStatus: value
                     }))}
                   >
                     <SelectTrigger className="h-8 text-sm">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="COMPLETED">Completado</SelectItem>
                       <SelectItem value="PARTIALLY_COMPLETED">Parcialmente Completado</SelectItem>
                       <SelectItem value="REQUIRES_FOLLOWUP">Requiere Seguimiento</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
               </div>

              {/* Notas */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-xs flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3" />
                  Notas de Ejecución
                </Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <button
                    type="button"
                    onClick={() => setExecutionData(prev => ({
                      ...prev,
                      notes: prev.notes ? `${prev.notes}\nTodo OK` : 'Todo OK'
                    }))}
                    className="inline-flex items-center gap-1.5 rounded-full bg-green-50 hover:bg-green-100 border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700 hover:text-green-800 transition-colors"
                  >
                    <ThumbsUp className="h-3 w-3" />
                    Todo OK
                  </button>
                  <button
                    type="button"
                    onClick={() => setExecutionData(prev => ({
                      ...prev,
                      notes: prev.notes ? `${prev.notes}\nCompletado según procedimiento` : 'Completado según procedimiento'
                    }))}
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:text-blue-800 transition-colors"
                  >
                    <FileCheck className="h-3 w-3" />
                    Según procedimiento
                  </button>
                  <button
                    type="button"
                    onClick={() => setExecutionData(prev => ({
                      ...prev,
                      notes: prev.notes ? `${prev.notes}\nSin observaciones` : 'Sin observaciones'
                    }))}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-700 transition-colors"
                  >
                    <Ban className="h-3 w-3" />
                    Sin observaciones
                  </button>
                </div>
                <Textarea
                  id="notes"
                  placeholder="Observaciones del mantenimiento..."
                  rows={2}
                  value={executionData.notes}
                  onChange={(e) => setExecutionData(prev => ({
                    ...prev,
                    notes: e.target.value
                  }))}
                  className="text-sm min-h-[60px]"
                />
              </div>

              {/* Problemas Encontrados */}
              <div className="space-y-2">
                <Label htmlFor="issues" className="text-xs flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" />
                  Problemas Encontrados
                </Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <button
                    type="button"
                    onClick={() => setExecutionData(prev => ({
                      ...prev,
                      issues: prev.issues ? `${prev.issues}\nNinguno` : 'Ninguno'
                    }))}
                    className="inline-flex items-center gap-1.5 rounded-full bg-green-50 hover:bg-green-100 border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700 hover:text-green-800 transition-colors"
                  >
                    <ShieldCheck className="h-3 w-3" />
                    Ninguno
                  </button>
                  <button
                    type="button"
                    onClick={() => setExecutionData(prev => ({
                      ...prev,
                      issues: prev.issues ? `${prev.issues}\nSin problemas` : 'Sin problemas'
                    }))}
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:text-blue-800 transition-colors"
                  >
                    <CheckCircle className="h-3 w-3" />
                    Sin problemas
                  </button>
                  <button
                    type="button"
                    onClick={() => setExecutionData(prev => ({
                      ...prev,
                      issues: prev.issues ? `${prev.issues}\nDesgaste normal` : 'Desgaste normal'
                    }))}
                    className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 px-2.5 py-1 text-xs font-medium text-yellow-700 hover:text-yellow-800 transition-colors"
                  >
                    <Activity className="h-3 w-3" />
                    Desgaste normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setExecutionData(prev => ({
                      ...prev,
                      issues: prev.issues ? `${prev.issues}\nRequiere seguimiento` : 'Requiere seguimiento'
                    }))}
                    className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2.5 py-1 text-xs font-medium text-orange-700 hover:text-orange-800 transition-colors"
                  >
                    <Zap className="h-3 w-3" />
                    Requiere seguimiento
                  </button>
                </div>
                <Textarea
                  id="issues"
                  placeholder="Problemas o anomalías encontradas..."
                  rows={2}
                  value={executionData.issues}
                  onChange={(e) => setExecutionData(prev => ({
                    ...prev,
                    issues: e.target.value
                  }))}
                  className="text-sm min-h-[60px]"
                />
              </div>

              {/* Evidencia Fotográfica */}
              <div className="space-y-2 pt-3 border-t">
                <Label className="text-xs flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5" />
                  Evidencia Fotográfica
                </Label>
                <p className="text-xs text-muted-foreground">
                  Adjunta fotos del trabajo realizado o problemas encontrados
                </p>

                {/* Área de subida */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="photo-upload"
                    className="flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted border border-dashed border-muted-foreground/25 rounded-lg cursor-pointer transition-colors"
                  >
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Agregar fotos</span>
                  </label>
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  {photos.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {photos.length} foto{photos.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>

                {/* Previsualizaciones */}
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={photo.preview}
                          alt={`Foto ${index + 1}`}
                          className="w-16 h-16 object-cover rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 pb-3 px-4 sm:px-6 border-t bg-background sticky bottom-0 z-10 flex-shrink-0">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isLoading}
            className="h-8 text-xs px-3"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isLoading}
            className="h-8 text-xs px-4 min-w-[100px]"
          >
            {isLoading ? (
              <>
                <Clock className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                Realizar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
