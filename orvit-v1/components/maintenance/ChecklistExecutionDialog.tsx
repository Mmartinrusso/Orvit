'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  Play,
  Pause,
  Eye,
  Wrench,
  Settings,
  FileText,
  Edit3,
  X,
  Timer,
  Zap
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  isRequired: boolean;
  order: number;
  category: string;
  estimatedTime: number;
  maintenanceId?: number;
  maintenanceType?: string;
  isMaintenanceItem: boolean;
  isCompleted?: boolean;
  completedAt?: Date;
  completedBy?: string;
  notes?: string;
  issues?: string;
  justification?: string; // Justificación si no se completó
  skippedAt?: Date; // Cuándo se saltó el item
  skippedBy?: string; // Quién saltó el item
}

interface ChecklistPhase {
  id: string;
  name: string;
  description: string;
  order: number;
  estimatedTime: number;
  items: ChecklistItem[];
  isCompleted?: boolean;
  completedAt?: Date;
}

interface ChecklistExecutionData {
  id: number;
  title: string;
  description: string;
  frequency: string;
  machineId: number | null;
  sectorId: number | null;
  companyId: number;
  isActive: boolean;
  category: string;
  estimatedTotalTime: number;
  items: ChecklistItem[];
  phases: ChecklistPhase[];
  createdAt: string;
  updatedAt: string;
}

interface ChecklistExecutionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  checklist: ChecklistExecutionData | null;
  onChecklistCompleted?: () => void; // Callback para actualizar la lista
}

interface MaintenanceDetail {
  id: number;
  title: string;
  description: string;
  machine?: {
    id: number;
    name: string;
  };
  components?: Array<{
    id: number;
    name: string;
    subcomponents?: Array<{
      id: number;
      name: string;
    }>;
  }>;
  instructions?: string;
  estimatedTime?: number;
  timeUnit?: string;
  priority?: string;
  frequency?: string;
}

export default function ChecklistExecutionDialog({
  isOpen,
  onClose,
  checklist,
  onChecklistCompleted
}: ChecklistExecutionDialogProps) {
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [phases, setPhases] = useState<ChecklistPhase[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStartTime, setExecutionStartTime] = useState<Date | null>(null);
  const [executionStarted, setExecutionStarted] = useState(false);

  const [selectedMaintenanceDetail, setSelectedMaintenanceDetail] = useState<MaintenanceDetail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedItemForNotes, setSelectedItemForNotes] = useState<ChecklistItem | null>(null);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [itemNotes, setItemNotes] = useState('');
  const [itemIssues, setItemIssues] = useState('');
  const [showIncompleteDialog, setShowIncompleteDialog] = useState(false);
  const [incompleteItems, setIncompleteItems] = useState<ChecklistItem[]>([]);
  const [showJustificationDialog, setShowJustificationDialog] = useState(false);
  const [itemsToJustify, setItemsToJustify] = useState<ChecklistItem[]>([]);
  const [justifications, setJustifications] = useState<{[itemId: string]: string}>({});

  // Timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer effect
  useEffect(() => {
    if (isExecuting && executionStarted) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isExecuting, executionStarted]);

  // Reset timer when dialog opens
  useEffect(() => {
    if (isOpen) {
      setElapsedSeconds(0);
    }
  }, [isOpen]);

  // Format elapsed time as HH:MM:SS
  const formatElapsedTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (checklist && isOpen) {
      // Inicializar fases con el estado de ejecución
      const initializedPhases = checklist.phases.map(phase => ({
        ...phase,
        items: phase.items.map(item => ({
          ...item,
          isCompleted: false,
          completedAt: undefined,
          completedBy: undefined
        })),
          isCompleted: false,
        completedAt: undefined
      }));
      setPhases(initializedPhases);
      setCurrentPhaseIndex(0);
      setIsExecuting(false);
      setExecutionStartTime(new Date()); // Inicializar automáticamente el tiempo de ejecución
      setExecutionStarted(false); // Resetear el estado de ejecución
      
      console.log('🚀 Checklist inicializado con executionStartTime:', new Date());
    }
  }, [checklist, isOpen]);

  const currentPhase = phases[currentPhaseIndex];
  const totalPhases = phases.length;
  const completedPhases = phases.filter(phase => phase.isCompleted).length;
  const progressPercentage = totalPhases > 0 ? (completedPhases / totalPhases) * 100 : 0;

  const handleItemToggle = (itemId: string) => {
    // Verificar si la ejecución ha comenzado
    if (!executionStarted) {
      toast({
        title: 'Ejecución no iniciada',
        description: 'Debes iniciar la ejecución antes de marcar items como completados',
        variant: 'destructive'
      });
      return;
    }

    // Encontrar el item
    const item = phases.flatMap(phase => phase.items).find(item => item.id === itemId);
    if (!item) return;

    // Si se está marcando como completado, abrir modal de notas
    if (!item.isCompleted) {
      setPhases(prev => prev.map(phase => ({
        ...phase,
        items: phase.items.map(phaseItem => 
          phaseItem.id === itemId 
            ? { 
                ...phaseItem, 
                isCompleted: true,
                completedAt: new Date(),
                completedBy: 'Usuario Actual'
              }
            : phaseItem
        )
      })));
      
      setSelectedItemForNotes(item);
      setItemNotes('');
      setItemIssues('');
      setIsNotesModalOpen(true);
    } else {
      // Si se está desmarcando, solo cambiar el estado
      setPhases(prev => prev.map(phase => ({
        ...phase,
        items: phase.items.map(phaseItem => 
          phaseItem.id === itemId 
            ? { 
                ...phaseItem, 
          isCompleted: false,
                completedAt: undefined,
                completedBy: undefined,
                notes: undefined,
                issues: undefined
              }
            : phaseItem
        )
      })));
    }
  };



  const handleSaveNotes = () => {
    if (!selectedItemForNotes) return;

    // Validar que AMBOS campos estén llenos obligatoriamente
    if (!itemNotes.trim()) {
      toast({
        title: 'Campo requerido',
        description: 'Debes completar las notas antes de continuar.',
        variant: 'destructive'
      });
      return;
    }

    if (!itemIssues.trim()) {
      toast({
        title: 'Campo requerido',
        description: 'Debes completar los problemas encontrados antes de continuar.',
        variant: 'destructive'
      });
      return;
    }

    setPhases(prev => prev.map(phase => ({
      ...phase,
      items: phase.items.map(item => 
        item.id === selectedItemForNotes.id 
          ? { 
              ...item, 
              notes: itemNotes,
              issues: itemIssues
            }
          : item
      )
    })));

    setIsNotesModalOpen(false);
    setSelectedItemForNotes(null);
    setItemNotes('');
    setItemIssues('');
  };

  const handleQuickResponse = (type: 'notes' | 'issues', value: string) => {
    if (type === 'notes') {
      setItemNotes(value);
    } else {
      setItemIssues(value);
    }
  };

  const getIncompleteRequiredItems = (phase: ChecklistPhase) => {
    return phase.items.filter(item => item.isRequired && !item.isCompleted);
  };

  const handleNextPhase = () => {
    if (!currentPhase) return;

    const incompleteRequired = getIncompleteRequiredItems(currentPhase);
    
    if (incompleteRequired.length > 0) {
      // Mostrar diálogo de confirmación en lugar del toast
      setIncompleteItems(incompleteRequired);
      setShowIncompleteDialog(true);
      return;
    }

    // Marcar fase como completada
    setPhases(prev => prev.map((phase, index) => 
      index === currentPhaseIndex 
        ? { ...phase, isCompleted: true, completedAt: new Date() }
        : phase
    ));

    // Ir a la siguiente fase
    if (currentPhaseIndex < totalPhases - 1) {
      setCurrentPhaseIndex(currentPhaseIndex + 1);
    } else {
      // Checklist completado
      handleCompleteChecklist();
    }
  };

  const handleContinueWithIncomplete = () => {
    setShowIncompleteDialog(false);
    
    // Marcar fase como completada
    setPhases(prev => prev.map((phase, index) => 
      index === currentPhaseIndex 
        ? { ...phase, isCompleted: true, completedAt: new Date() }
        : phase
    ));

    // Ir a la siguiente fase
    if (currentPhaseIndex < totalPhases - 1) {
      setCurrentPhaseIndex(currentPhaseIndex + 1);
    } else {
      handleCompleteChecklist();
    }
  };

  const handlePreviousPhase = () => {
    if (currentPhaseIndex > 0) {
      setCurrentPhaseIndex(currentPhaseIndex - 1);
    }
  };



  const handleStartExecution = () => {
    console.log('🚀 Iniciando ejecución del checklist...');
    setIsExecuting(true);
    setExecutionStarted(true);
    setExecutionStartTime(new Date());
    console.log('✅ ExecutionStartTime inicializado:', new Date());
  };

  const handlePauseExecution = () => {
    setIsExecuting(false);
  };

  const handleCompleteChecklist = async () => {
    try {
      // Recolectar todos los items de todas las fases
      const allItems = phases.flatMap(phase => phase.items);
      const completedItems = allItems.filter(item => item.isCompleted);
      const incompleteItems = allItems.filter(item => !item.isCompleted);

      // Si hay items incompletos, mostrar diálogo de justificación
      if (incompleteItems.length > 0) {
        setItemsToJustify(incompleteItems);
        setJustifications({});
        setShowJustificationDialog(true);
        return;
      }

      // Si todos los items están completados, proceder normalmente
      await executeChecklist(completedItems, 'COMPLETED', []);
    } catch (error) {
      console.error('Error completing checklist:', error);
      toast({
        title: 'Error',
        description: 'Error al completar el checklist',
        variant: 'destructive'
      });
    }
  };

  const executeChecklist = async (completedItems: ChecklistItem[], status: 'COMPLETED' | 'PARTIALLY_COMPLETED', incompleteItems: ChecklistItem[] = []) => {
    try {
      const executionTime = executionStartTime 
        ? Math.round((new Date().getTime() - executionStartTime.getTime()) / 60000)
        : 15;

      console.log('✅ Ejecutando checklist:', {
        checklistId: checklist?.id,
        completedItems: completedItems.length,
        status,
        executionTime,
        phases: phases.length
      });

      // Llamar a la API para ejecutar los mantenimientos
      const response = await fetch('/api/maintenance/execute-checklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checklistId: checklist?.id,
          completedItems,
          executionTime,
          executedBy: 'Usuario Actual',
          companyId: checklist?.companyId,
          sectorId: checklist?.sectorId,
          status,
          justifications: incompleteItems.map(item => ({
            itemTitle: item.title || 'Item sin título',
            justification: justifications[item.id] || 'Sin justificación',
            skippedAt: new Date().toISOString()
          })),
          totalItems: phases.reduce((total, phase) => total + phase.items.length, 0)
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Checklist execution result:', result);

        const statusText = status === 'COMPLETED' ? 'completado' : 'completado parcialmente';
        toast({
          title: `Checklist ${statusText}`,
          description: `Se ejecutaron ${completedItems.length} mantenimientos correctamente`,
        });

        // Actualizar el estado del checklist
        if (checklist?.id) {
          try {
            await fetch('/api/maintenance/checklists', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                checklistId: checklist.id,
                isCompleted: true,
                lastExecutionDate: new Date().toISOString(),
                executionStatus: status
              })
            });
          } catch (error) {
            console.error('Error updating checklist status:', error);
          }
        }

        onClose();
        
        if (onChecklistCompleted) {
          setTimeout(() => {
            onChecklistCompleted();
          }, 500);
        }
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error executing checklist:', error);
      toast({
        title: 'Error',
        description: 'Error al ejecutar el checklist',
        variant: 'destructive'
      });
    }
  };

  const handleJustificationSubmit = async () => {
    // Verificar que todas las justificaciones estén completadas
    const missingJustifications = itemsToJustify.filter(item => 
      !justifications[item.id] || !justifications[item.id].trim()
    );

    if (missingJustifications.length > 0) {
      toast({
        title: 'Justificaciones requeridas',
        description: `Debes justificar por qué no se completaron ${missingJustifications.length} items`,
        variant: 'destructive'
      });
      return;
    }

    // Actualizar los items con sus justificaciones
    const updatedPhases = phases.map(phase => ({
      ...phase,
      items: phase.items.map(item => {
        const justification = justifications[item.id];
        if (justification) {
          return {
            ...item,
            justification,
            skippedAt: new Date(),
            skippedBy: 'Usuario Actual'
          };
        }
        return item;
      })
    }));
    setPhases(updatedPhases);

    // Obtener items completados para la ejecución
    const completedItems = updatedPhases.flatMap(phase => 
      phase.items.filter(item => item.isCompleted)
    );

    // Cerrar el diálogo de justificación
    setShowJustificationDialog(false);
    setItemsToJustify([]);
    setJustifications({});

    // Obtener items incompletos para las justificaciones
    const incompleteItems = updatedPhases.flatMap(phase => 
      phase.items.filter(item => !item.isCompleted)
    );

    // Ejecutar el checklist como parcialmente completado
    await executeChecklist(completedItems, 'PARTIALLY_COMPLETED', incompleteItems);
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  };

  const handleViewMaintenanceDetail = async (maintenanceId: number) => {
    try {
      console.log('🔍 Buscando mantenimiento con ID:', maintenanceId);
      
      // Buscar el mantenimiento en la lista de mantenimientos disponibles
      const response = await fetch(`/api/maintenance/all?companyId=${checklist?.companyId}&sectorId=${checklist?.sectorId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 API Response:', data);
        
        // La API devuelve un objeto con la propiedad 'maintenances'
        const maintenances = data.maintenances || [];
        console.log('🔍 Maintenances array:', maintenances);
        console.log('🔍 IDs disponibles:', maintenances.map((m: any) => m.id));
        
        let maintenance = maintenances.find((m: any) => m.id === maintenanceId);
        console.log('🔍 Found maintenance by ID:', maintenance);
        
        // Si no se encuentra por ID, intentar buscar por título
        if (!maintenance) {
          // Buscar el item del checklist para obtener el título
          const checklistItem = currentPhase?.items.find(item => item.maintenanceId === maintenanceId);
          if (checklistItem) {
            console.log('🔍 Buscando por título:', checklistItem.title);
            maintenance = maintenances.find((m: any) => 
              m.title?.toLowerCase().includes(checklistItem.title.toLowerCase()) ||
              checklistItem.title.toLowerCase().includes(m.title?.toLowerCase())
            );
            console.log('🔍 Found maintenance by title:', maintenance);
          }
        }
        
        if (maintenance) {
           console.log('🔍 Maintenance components:', maintenance.components);
           console.log('🔍 Maintenance subcomponents:', maintenance.subcomponents);
           console.log('🔍 Maintenance machine:', maintenance.machine);
           
           // Estructurar componentes con sus subcomponentes
           let structuredComponents: any[] = [];
           if (maintenance.components && maintenance.components.length > 0) {
             structuredComponents = maintenance.components.map((component: any) => ({
               ...component,
               subcomponents: maintenance.subcomponents?.filter((sub: any) => 
                 maintenance.subcomponentIds?.includes(sub.id)
               ) || []
             }));
           }
           
           console.log('🔍 Structured components:', structuredComponents);
           
           setSelectedMaintenanceDetail({
             id: maintenance.id,
             title: maintenance.title,
             description: maintenance.description || '',
             machine: maintenance.machine,
             components: structuredComponents,
             instructions: maintenance.instructions || maintenance.notes || '',
             estimatedTime: maintenance.estimatedHours,
             timeUnit: maintenance.timeUnit || 'hours',
             priority: maintenance.priority,
             frequency: maintenance.frequency
           });
           setIsDetailModalOpen(true);
        } else {
          // Buscar el item del checklist para obtener más información
          const checklistItem = currentPhase?.items.find(item => item.maintenanceId === maintenanceId);
          const itemTitle = checklistItem?.title || `ID ${maintenanceId}`;
          
          console.log('❌ No se encontró el mantenimiento:', {
            maintenanceId,
            itemTitle,
            availableIds: maintenances.map((m: any) => m.id),
            availableTitles: maintenances.map((m: any) => m.title)
          });
          
          toast({
            title: 'Mantenimiento no encontrado',
            description: `No se encontró el mantenimiento "${itemTitle}" (ID: ${maintenanceId}). Es posible que haya sido eliminado o modificado.`,
            variant: 'destructive'
          });
        }
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error loading maintenance detail:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar el detalle del mantenimiento',
        variant: 'destructive'
      });
    }
  };

  if (!checklist || !currentPhase) {
    return null;
  }

  const incompleteRequired = getIncompleteRequiredItems(currentPhase);
  const completedItems = currentPhase.items.filter(item => item.isCompleted).length;
  const totalItems = currentPhase.items.length;
  const phaseProgress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  return (
    <>
             <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
               <Play className="h-5 w-5" />
            Ejecutar Checklist: {checklist.title}
          </DialogTitle>
             <DialogDescription className="sr-only">
               Ejecutar checklist de mantenimiento con fases
             </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {/* Barra de progreso general - Mejorada */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <span className="text-lg font-bold text-purple-600">{Math.round(progressPercentage)}%</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Progreso General</p>
                  <p className="text-xs text-muted-foreground">{completedPhases} de {totalPhases} fases completadas</p>
                </div>
              </div>
              <div className="flex gap-1">
                {phases.map((phase, index) => (
                  <div
                    key={phase.id}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      phase.isCompleted
                        ? 'bg-green-500'
                        : index === currentPhaseIndex
                        ? 'bg-blue-500 animate-pulse'
                        : 'bg-gray-300'
                    }`}
                    title={`Fase ${index + 1}: ${phase.name}`}
                  />
                ))}
              </div>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Navegación de fases */}
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              onClick={handlePreviousPhase}
              disabled={currentPhaseIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Fase anterior
            </Button>

            <div className="text-center">
              <h3 className="text-lg font-semibold">{currentPhase.name}</h3>
              <p className="text-sm text-muted-foreground">{currentPhase.description}</p>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span>Fase {currentPhaseIndex + 1} de {totalPhases}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatTime(currentPhase.estimatedTime)}
                </span>
                </div>
              </div>

            <Button
              variant="outline"
              onClick={handleNextPhase}
              disabled={currentPhaseIndex === totalPhases - 1}
            >
              Siguiente fase
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>

          {/* Timer y controles de ejecución */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              {/* Timer display */}
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${executionStarted ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <Timer className={`h-5 w-5 ${executionStarted ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tiempo transcurrido</p>
                  <p className={`text-2xl font-mono font-bold ${isExecuting ? 'text-green-600' : 'text-gray-600'}`}>
                    {formatElapsedTime(elapsedSeconds)}
                  </p>
                </div>
              </div>

              {/* Control buttons */}
              <div className="flex items-center gap-2">
                {!executionStarted ? (
                  <Button onClick={handleStartExecution} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                    <Play className="h-4 w-4" />
                    Iniciar ejecución
                  </Button>
                ) : !isExecuting ? (
                  <Button onClick={handleStartExecution} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                    <Play className="h-4 w-4" />
                    Reanudar
                  </Button>
                ) : (
                  <Button variant="outline" onClick={handlePauseExecution} className="flex items-center gap-2 border-orange-300 text-orange-600 hover:bg-orange-50">
                    <Pause className="h-4 w-4" />
                    Pausar
                  </Button>
                )}
              </div>

              {/* Status indicator */}
              <div className="flex items-center gap-2">
                {executionStarted && (
                  <Badge variant={isExecuting ? "default" : "secondary"} className={isExecuting ? "bg-green-600 animate-pulse" : ""}>
                    <Zap className="h-3 w-3 mr-1" />
                    {isExecuting ? 'En ejecución' : 'Pausado'}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Progreso de la fase actual - Mejorado */}
          <div className="bg-white rounded-lg p-4 border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progreso de fase actual</span>
              <span className="text-sm font-bold text-blue-600">{completedItems}/{totalItems} items</span>
            </div>
            <Progress value={phaseProgress} className="h-3" />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-muted-foreground">
                {totalItems - completedItems} restantes
              </span>
              <span className="text-xs font-medium text-blue-600">{Math.round(phaseProgress)}%</span>
            </div>
          </div>

          {/* Items de la fase actual */}
          <div className="space-y-3">
            <h4 className="font-medium">Items de esta fase:</h4>
            

                         {currentPhase.items.map((item) => (
               <Card 
                 key={item.id} 
                 className={`transition-colors ${
                   item.isCompleted ? 'bg-green-50 border-green-200' : ''
                 }`}
               >
                  <CardContent className="p-4">
                   <div className="flex items-start gap-3">
                                           <Checkbox
                        checked={item.isCompleted}
                        onCheckedChange={() => handleItemToggle(item.id)}
                        disabled={!executionStarted}
                        className={`mt-1 ${!executionStarted ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                        <h5 
                          className={`font-medium ${item.maintenanceId ? 'cursor-pointer hover:text-blue-600 transition-colors select-none' : ''}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (item.maintenanceId) {
                              handleViewMaintenanceDetail(item.maintenanceId);
                            }
                          }}
                          title={item.maintenanceId ? 'Toca para ver detalles del mantenimiento' : ''}
                        >
                          {item.title}
                        </h5>
                          {item.isRequired && (
                          <Badge variant="destructive" className="text-xs">
                            Obligatorio
                            </Badge>
                          )}
                        <Badge variant="outline" className="text-xs">
                          {formatTime(item.estimatedTime)}
                        </Badge>
                      </div>
                      
                      {/* Resumen del mantenimiento */}
                      <div className="space-y-2 mb-3">
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                        
                        {/* Información de máquina y componentes */}
                        {item.maintenanceId && (
                          <div className="flex items-center gap-4 text-xs text-gray-600">
                            <div className="flex items-center gap-1">
                              <Wrench className="h-3 w-3" />
                              <span>Mantenimiento #{item.maintenanceId}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Settings className="h-3 w-3" />
                              <span>Preventivo</span>
                            </div>
                        </div>
                        )}
                      </div>
                      
                      {/* Botones de acción */}
                      <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                          {item.maintenanceId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewMaintenanceDetail(item.maintenanceId!)}
                              className="text-xs"
                              title={`Ver detalles del mantenimiento "${item.title}"`}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Ver detalle
                            </Button>
                          )}
                          {item.isCompleted && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedItemForNotes(item);
                                setItemNotes(item.notes || '');
                                setItemIssues(item.issues || '');
                                setIsNotesModalOpen(true);
                              }}
                              className="text-xs"
                            >
                              <Edit3 className="h-3 w-3 mr-1" />
                              Editar notas
                            </Button>
                          )}
                        </div>
                        
                                                 {item.isCompleted && (
                           <div className="flex items-center gap-2 text-xs">
                             <div className="flex items-center gap-1 text-green-600">
                               <CheckCircle className="h-3 w-3" />
                               Completado {item.completedAt && new Date(item.completedAt).toLocaleTimeString()}
                             </div>
                             {(item.notes || item.issues) && (
                               <div className="flex items-center gap-1 text-blue-600">
                                 <Edit3 className="h-3 w-3" />
                                 Con notas
                               </div>
                             )}
                           </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
                    </div>
        </DialogBody>

          {/* Botón de completar checklist */}
          {currentPhaseIndex === totalPhases - 1 && (
            <DialogFooter>
              <Button
                onClick={handleCompleteChecklist}
                className="flex items-center gap-2"
                size="default"
              >
                <CheckCircle className="h-4 w-4" />
                Completar Checklist
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

             {/* Modal de detalle del mantenimiento */}
       <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
         <DialogContent size="md">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <FileText className="h-5 w-5" />
               Detalle del Mantenimiento
             </DialogTitle>
             {selectedMaintenanceDetail?.description && (
               <DialogDescription className="sr-only">
                 {selectedMaintenanceDetail.description}
               </DialogDescription>
             )}
           </DialogHeader>

           <DialogBody>
           {selectedMaintenanceDetail && (
             <div className="space-y-4">
               {/* Información básica */}
               <div className="border rounded-lg p-4">
                 <h3 className="text-xl font-semibold mb-2">{selectedMaintenanceDetail.title}</h3>
                 <p className="text-gray-600">{selectedMaintenanceDetail.description}</p>
               </div>

               {/* Información técnica */}
               <div className="border rounded-lg p-4">
                 <h4 className="font-medium mb-3">Información Técnica</h4>
                 <div className="space-y-2 text-sm">
                   <div className="flex justify-between">
                     <span className="text-gray-600">Prioridad:</span>
                     <span className="font-medium">
                       {selectedMaintenanceDetail.priority === 'HIGH' ? 'Alta' : selectedMaintenanceDetail.priority === 'MEDIUM' ? 'Media' : selectedMaintenanceDetail.priority === 'LOW' ? 'Baja' : 'No especificada'}
                     </span>
                   </div>
                   <div className="flex justify-between">
                     <span className="text-gray-600">Frecuencia:</span>
                     <span className="font-medium">{selectedMaintenanceDetail.frequency || 'No especificada'}</span>
                   </div>
                   <div className="flex justify-between">
                     <span className="text-gray-600">Tiempo estimado:</span>
                     <span className="font-medium">
                       {selectedMaintenanceDetail.estimatedTime} {selectedMaintenanceDetail.timeUnit === 'MINUTES' ? 'minutos' : selectedMaintenanceDetail.timeUnit === 'HOURS' ? 'horas' : selectedMaintenanceDetail.timeUnit?.toLowerCase() || 'horas'}
                     </span>
                   </div>
                 </div>
                      </div>

               {/* Equipamiento */}
               <div className="border rounded-lg p-4">
                 <h4 className="font-medium mb-3">Equipamiento</h4>
                 <div className="space-y-2 text-sm">
                   <div className="flex justify-between">
                     <span className="text-gray-600">Máquina:</span>
                     <span className="font-medium">{selectedMaintenanceDetail.machine?.name || 'No especificada'}</span>
                   </div>
                   <div className="flex justify-between">
                     <span className="text-gray-600">Componentes:</span>
                     <span className="font-medium">{selectedMaintenanceDetail.components?.length || 0} componente(s)</span>
                   </div>
                      </div>
                    </div>

               {/* Componentes */}
               {selectedMaintenanceDetail.components && selectedMaintenanceDetail.components.length > 0 && (
                 <div className="border rounded-lg p-4">
                   <h4 className="font-medium mb-3">Componentes Involucrados</h4>
                   <div className="space-y-3">
                     {selectedMaintenanceDetail.components.map((component, index) => (
                       <div key={component.id} className="border-l-2 border-gray-300 pl-3">
                         <div className="font-medium text-sm">{component.name}</div>
                         {component.subcomponents && component.subcomponents.length > 0 && (
                           <div className="mt-2 ml-2">
                             <div className="text-xs text-gray-500 mb-1">Subcomponentes:</div>
                             <div className="space-y-1">
                               {component.subcomponents.map(sc => (
                                 <div key={sc.id} className="text-xs text-gray-600 ml-2">• {sc.name}</div>
                               ))}
                             </div>
                           </div>
                         )}
                       </div>
                     ))}
                   </div>
                 </div>
               )}

               {/* Instructivo */}
               {selectedMaintenanceDetail.instructions && (
                 <div className="border rounded-lg p-4">
                   <h4 className="font-medium mb-3">Instructivo</h4>
                   <div className="bg-gray-50 p-3 rounded">
                     <p className="text-sm whitespace-pre-wrap">{selectedMaintenanceDetail.instructions}</p>
                        </div>
                      </div>
                    )}
          </div>
                      )}
           </DialogBody>
         </DialogContent>
       </Dialog>

       {/* Modal de notas y problemas */}
       <Dialog open={isNotesModalOpen} onOpenChange={(open) => {
         if (!open) {
           // Desmarcar el item si se cierra el modal sin guardar
           if (selectedItemForNotes) {
             setPhases(prev => prev.map(phase => ({
               ...phase,
               items: phase.items.map(item => 
                 item.id === selectedItemForNotes.id 
                   ? { 
                       ...item, 
                       isCompleted: false,
                       completedAt: undefined,
                       completedBy: undefined,
                       notes: undefined,
                       issues: undefined
                     }
                   : item
               )
             })));
           }
           
           setSelectedItemForNotes(null);
           setItemNotes('');
           setItemIssues('');
         }
         setIsNotesModalOpen(open);
       }}>
         <DialogContent size="md">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <Edit3 className="h-5 w-5" />
               Completar Item: {selectedItemForNotes?.title}
             </DialogTitle>
             <DialogDescription asChild>
               <div>
                 Agrega notas y problemas encontrados para este item del checklist.
                 <span className="text-red-500 font-medium">* Ambos campos son obligatorios para continuar.</span>
               </div>
             </DialogDescription>
           </DialogHeader>

           <DialogBody>
             {/* Notas */}
             <div className="space-y-3 mb-6">
               <div className="flex items-center justify-between">
                 <label className="text-sm font-medium">
                   Notas: <span className="text-red-500">*</span>
                 </label>
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => handleQuickResponse('notes', 'Todo OK')}
                 >
                   Todo OK
                 </Button>
               </div>
              <Textarea
                 placeholder="Describe las notas de la ejecución..."
                 value={itemNotes}
                 onChange={(e) => setItemNotes(e.target.value)}
                 rows={3}
                 className={!itemNotes.trim() ? 'border-red-300 focus:border-red-500' : ''}
               />
               {!itemNotes.trim() && (
                 <p className="text-red-500 text-xs">Las notas son obligatorias</p>
               )}
             </div>

             {/* Problemas encontrados */}
             <div className="space-y-3">
              <div className="flex items-center justify-between">
                 <label className="text-sm font-medium">
                   Problemas encontrados: <span className="text-red-500">*</span>
                 </label>
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => handleQuickResponse('issues', 'Ningún problema encontrado')}
                 >
                   Sin problemas
                 </Button>
                  </div>
               <Textarea
                 placeholder="Describe los problemas encontrados..."
                 value={itemIssues}
                 onChange={(e) => setItemIssues(e.target.value)}
                 rows={3}
                 className={!itemIssues.trim() ? 'border-red-300 focus:border-red-500' : ''}
               />
               {!itemIssues.trim() && (
                 <p className="text-red-500 text-xs">Los problemas encontrados son obligatorios</p>
               )}
                </div>
           </DialogBody>

           <DialogFooter>
             <Button
               variant="outline"
               size="sm"
               onClick={() => setIsNotesModalOpen(false)}
             >
               Cancelar
             </Button>
             <Button
               size="sm"
               onClick={handleSaveNotes}
               disabled={!itemNotes.trim() || !itemIssues.trim()}
             >
               Guardar
             </Button>
           </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Diálogo de confirmación para items incompletos */}
    <Dialog open={showIncompleteDialog} onOpenChange={setShowIncompleteDialog}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="h-5 w-5" />
            Items Obligatorios Pendientes
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3">
              <p>
                Tienes {incompleteItems.length} items obligatorios sin completar:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1">
                {incompleteItems.map(item => (
                  <li key={item.id} className="text-gray-700">{item.title}</li>
                ))}
              </ul>
              <p className="font-medium text-gray-900">
                Deseas continuar a la siguiente fase sin completar estos items?
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowIncompleteDialog(false)}
          >
            Completar items
          </Button>
          <Button
            size="sm"
            onClick={handleContinueWithIncomplete}
            className="bg-red-500 hover:bg-red-600"
          >
            Continuar sin completar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Diálogo de justificación para items incompletos */}
    <Dialog open={showJustificationDialog} onOpenChange={setShowJustificationDialog}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-5 w-5" />
            Justificar Items No Completados
          </DialogTitle>
          <DialogDescription asChild>
            <p className="text-gray-700">
              Tienes {itemsToJustify.length} items que no fueron completados.
              Debes justificar por que no se realizaron antes de finalizar el checklist.
            </p>
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            {itemsToJustify.map((item) => (
              <Card key={item.id} className="border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{item.title}</h4>
                      {item.isRequired && (
                        <Badge variant="destructive" className="text-xs">
                          Obligatorio
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{item.description}</p>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Justificacion: <span className="text-red-500">*</span>
                      </label>
                      <Textarea
                        placeholder="Explica por que no se pudo completar este item..."
                        value={justifications[item.id] || ''}
                        onChange={(e) => setJustifications(prev => ({
                          ...prev,
                          [item.id]: e.target.value
                        }))}
                        rows={3}
                        className={!justifications[item.id]?.trim() ? 'border-red-300 focus:border-red-500' : ''}
                      />
                      {!justifications[item.id]?.trim() && (
                        <p className="text-red-500 text-xs">La justificacion es obligatoria</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowJustificationDialog(false)}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleJustificationSubmit}
            className="bg-orange-600 hover:bg-orange-700"
          >
            Completar Checklist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
     </>
  );
}

