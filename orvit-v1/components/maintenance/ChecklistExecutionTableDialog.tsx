'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Search,
  Calendar,
  Clock,
  Gauge,
  FileText,
  AlertCircle,
  CheckCircle,
  Loader2,
  Info,
  AlertTriangle,
  BookOpen,
  X,
  Timer,
  Camera,
  Filter,
  Save,
  Play,
  Pause,
  ChevronDown,
  Mic,
  MicOff,
  Volume2,
  ArrowDown,
  Zap,
  User,
  Users,
  MessageSquare,
  Edit3
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { format, differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import { DatePicker } from '@/components/ui/date-picker';
// Lazy load componente pesado para mejor rendimiento inicial
const MaintenanceDetailDialog = lazy(() => import('./MaintenanceDetailDialog'));

interface MaintenanceItem {
  id: string;
  maintenanceId: number;
  maintenanceData: any;
  completedDate?: string;
  rescheduleDate?: string;
  currentKilometers?: number;
  currentHours?: number;
  notes?: string;
  issues?: string;
  isCompleted?: boolean;
  quickNotesSelected?: string[];
  quickIssuesSelected?: string[];
  executors?: string[];
  responsables?: string[];
  supervisors?: string[];
}

interface ChecklistExecutionTableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  checklist?: any;
  selectedAsset?: {
    type: 'unidad-movil' | 'maquina';
    id: number;
    name: string;
  };
  onChecklistCompleted: (checklistId: number, executionData: any) => void;
}

// Mapas estáticos fuera del componente para mejor rendimiento
const FREQUENCY_MAP: { [key: string]: string } = {
  'DAILY': 'Diario',
  'WEEKLY': 'Semanal',
  'BIWEEKLY': 'Quincenal',
  'MONTHLY': 'Mensual',
  'QUARTERLY': 'Trimestral',
  'YEARLY': 'Anual'
};

const INTERVAL_MAP: { [key: string]: string } = {
  'DAYS': 'días',
  'WEEKS': 'semanas',
  'MONTHS': 'meses',
  'YEARS': 'años'
};

// Función optimizada para calcular el estado del mantenimiento (sin React.memo porque no es componente)
const calculateMaintenanceStatus = (maintenanceData: any) => {
  if (!maintenanceData) return { status: 'unknown', message: 'Sin datos' };

  const { status, frequencyDays, frequency, maintenanceInterval, maintenanceIntervalType } = maintenanceData;

  if (status === 'COMPLETED') {
    return { status: 'completed', message: 'Completado' };
  }

  let periodicidadText = '';
  
  if (frequencyDays) {
    if (frequencyDays === 1) periodicidadText = 'Diario';
    else if (frequencyDays === 7) periodicidadText = 'Semanal';
    else if (frequencyDays === 15) periodicidadText = 'Quincenal';
    else if (frequencyDays === 30) periodicidadText = 'Mensual';
    else periodicidadText = `Cada ${frequencyDays} días`;
  } else if (frequency) {
    periodicidadText = FREQUENCY_MAP[frequency] || frequency;
  } else if (maintenanceInterval && maintenanceIntervalType) {
    const unit = INTERVAL_MAP[maintenanceIntervalType] || maintenanceIntervalType.toLowerCase();
    periodicidadText = `Cada ${maintenanceInterval} ${unit}`;
  }
  
  if (!periodicidadText) {
    return { status: 'no-periodicity', message: 'Sin periodicidad definida' };
  }

  return { status: 'periodic', message: periodicidadText };
};

export default function ChecklistExecutionTableDialog({
  isOpen,
  onClose,
  checklist,
  selectedAsset,
  onChecklistCompleted
}: ChecklistExecutionTableDialogProps) {
  
   const { currentCompany, currentSector } = useCompany();
   const { user } = useAuth();
   const { hasPermission: canEditMaintenance } = usePermissionRobust('editar_mantenimiento');
   const [maintenanceItems, setMaintenanceItems] = useState<MaintenanceItem[]>([]);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [checklistId, setChecklistId] = useState('');
   const [loadingChecklist, setLoadingChecklist] = useState(false);
   const [loadedChecklist, setLoadedChecklist] = useState<any>(null);
  const [confirmCompleteItemId, setConfirmCompleteItemId] = useState<string | null>(null);
  const [confirmUncompleteItemId, setConfirmUncompleteItemId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [isMassAssignOpen, setIsMassAssignOpen] = useState(false);
  // Estados para controlar popovers de empleados por item
  const [executorPopoverOpen, setExecutorPopoverOpen] = useState<Record<string, boolean>>({});
  const [supervisorPopoverOpen, setSupervisorPopoverOpen] = useState<Record<string, boolean>>({});
  const [massAssignRole, setMassAssignRole] = useState<'executors' | 'supervisors'>('executors');
  const [massEmployeeSearch, setMassEmployeeSearch] = useState('');
  const [massSelectedEmployee, setMassSelectedEmployee] = useState<{ id: string; name: string } | null>(null);
  const [massEmployeePopoverOpen, setMassEmployeePopoverOpen] = useState(false);
  const [massSelectedItems, setMassSelectedItems] = useState<Record<string, boolean>>({});
  // Estado para asignaciones individuales por tarea
  const [massTaskAssignments, setMassTaskAssignments] = useState<Record<string, { role: 'executors' | 'supervisors'; employee: { id: string; name: string } | null }>>({});
  const [massTaskEmployeeSearch, setMassTaskEmployeeSearch] = useState<Record<string, string>>({});
  const [massTaskPopoverOpen, setMassTaskPopoverOpen] = useState<Record<string, boolean>>({});
  // Estado para guardar TODAS las asignaciones acumuladas (aunque no estén tildadas)
  const [accumulatedAssignments, setAccumulatedAssignments] = useState<Record<string, Array<{ role: 'executors' | 'supervisors'; employee: { id: string; name: string } }>>>({});
  // Estado para notas por tarea en el modal
  const [massTaskNotes, setMassTaskNotes] = useState<Record<string, { notes: string; issues: string }>>({});
  const [massTaskNotesPopoverOpen, setMassTaskNotesPopoverOpen] = useState<Record<string, boolean>>({});

  // ========== EJECUCIÓN MASIVA ==========
  type MassResultOption = 'realizado' | 'reprogramar';
  const [massResultOption, setMassResultOption] = useState<MassResultOption>('realizado');
  const [massExecutionDate, setMassExecutionDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  // Para selección de items
  const [massItemsToProcess, setMassItemsToProcess] = useState<string[]>([]);
  // Arrays para múltiples ejecutores, responsables y supervisores
  const [massExecutors, setMassExecutors] = useState<Array<{ id: string; name: string }>>([]);
  const [massResponsables, setMassResponsables] = useState<Array<{ id: string; name: string }>>([]);
  const [massSupervisors, setMassSupervisors] = useState<Array<{ id: string; name: string }>>([]);
  // Popover para ver qué falta
  const [showFaltantesPopover, setShowFaltantesPopover] = useState(false);
  // Double tap detection con timeout para evitar toggle en double tap
  const tapTimeoutRef = useRef<Record<string, NodeJS.Timeout | null>>({});
  // Edit date popover for completed items
  const [editDateItemId, setEditDateItemId] = useState<string | null>(null);
  // Popover para agregar/editar notas por item
  const [notesPopoverItemId, setNotesPopoverItemId] = useState<string | null>(null);

  // Referencias a observers e intervalos para limpiarlos correctamente
  const popoverObserversRef = React.useRef<Record<string, MutationObserver>>({});
  const popoverIntervalsRef = React.useRef<Record<string, NodeJS.Timeout>>({});
  // Firmas
  const [executorSignatures, setExecutorSignatures] = useState<Record<string, string>>({});
  const [supervisorSignatures, setSupervisorSignatures] = useState<Record<string, string>>({});
  const [signatureModal, setSignatureModal] = useState<{ open: boolean; role: 'executors' | 'supervisors'; name: string } | null>(null);
  const [selectedMaintenanceForDetail, setSelectedMaintenanceForDetail] = useState<any>(null);
  const [isMaintenanceDetailOpen, setIsMaintenanceDetailOpen] = useState(false);
  const [clickTimers, setClickTimers] = useState<Record<string, NodeJS.Timeout | null>>({});
  const [isInstructivesModalOpen, setIsInstructivesModalOpen] = useState(false);
  const [checklistInstructives, setChecklistInstructives] = useState<Array<{ id?: string | number; title: string; content: string }>>([]);
  const [selectedInstructiveIndex, setSelectedInstructiveIndex] = useState<number | null>(null);
  
  // Estado para manejar el touch en cada item de error en "Ver qué falta"
  const touchStateRef = React.useRef<{ [key: string]: { startY: number; hasMoved: boolean } }>({});
  const [showIncompleteErrorsPopover, setShowIncompleteErrorsPopover] = useState(false);

  // ============= NUEVAS MEJORAS =============
  // Timer de ejecución
  const [executionStartTime, setExecutionStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isExecutionPaused, setIsExecutionPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Filtro/búsqueda de items
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [showCompletedOnly, setShowCompletedOnly] = useState<'all' | 'completed' | 'pending'>('all');

  // Auto-guardado
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

  // ID de la ejecución actual (para actualizar en vez de crear nueva)
  const [currentExecutionId, setCurrentExecutionId] = useState<number | null>(null);

  // Ref para trackear si ya cargamos este checklist (evita recargar si el prop cambia de referencia)
  const lastLoadedChecklistIdRef = useRef<number | null>(null);

  // Helpers para guardar/recuperar el ID de ejecución en localStorage (persiste aunque el componente se desmonte)
  const SAVED_EXECUTION_KEY = 'checklist-execution-in-progress';
  const getSavedExecutionId = useCallback((checklistId: number): number | null => {
    try {
      const saved = localStorage.getItem(SAVED_EXECUTION_KEY);
      if (!saved) return null;
      const data = JSON.parse(saved);
      if (data.checklistId === checklistId) {
        return data.executionId;
      }
    } catch {}
    return null;
  }, []);
  const setSavedExecutionId = useCallback((checklistId: number, executionId: number) => {
    try {
      localStorage.setItem(SAVED_EXECUTION_KEY, JSON.stringify({ checklistId, executionId }));
    } catch {}
  }, []);
  const clearSavedExecutionId = useCallback((checklistId?: number) => {
    try {
      if (checklistId) {
        const saved = localStorage.getItem(SAVED_EXECUTION_KEY);
        if (saved) {
          const data = JSON.parse(saved);
          if (data.checklistId === checklistId) {
            localStorage.removeItem(SAVED_EXECUTION_KEY);
          }
        }
      } else {
        localStorage.removeItem(SAVED_EXECUTION_KEY);
      }
    } catch {}
  }, []);

  // Fotos por item
  const [itemPhotos, setItemPhotos] = useState<Record<string, Array<{ file: File; preview: string }>>>({});

  // ============= VISTA SWIPE CARDS MÓVIL =============
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const cardContainerRef = useRef<HTMLDivElement>(null);

  // ============= NUEVAS MEJORAS UX OPERADOR =============
  // Modo ejecución masiva rápida
  const [isBulkExecutionMode, setIsBulkExecutionMode] = useState(false);
  const [bulkNotes, setBulkNotes] = useState('Sin novedad');
  const [bulkSupervisor, setBulkSupervisor] = useState<string>('');
  const [bulkExecutor, setBulkExecutor] = useState<string>('');
  const [bulkExecutionDate, setBulkExecutionDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  });
  const [bulkSupervisorSearch, setBulkSupervisorSearch] = useState('');
  const [bulkExecutorSearch, setBulkExecutorSearch] = useState('');
  const [bulkSupervisorPopoverOpen, setBulkSupervisorPopoverOpen] = useState(false);
  const [bulkExecutorPopoverOpen, setBulkExecutorPopoverOpen] = useState(false);

  // Input de voz
  const [isRecording, setIsRecording] = useState(false);
  const [currentVoiceItemId, setCurrentVoiceItemId] = useState<string | null>(null);
  const [voiceField, setVoiceField] = useState<'notes' | 'issues'>('notes');
  const recognitionRef = useRef<any>(null);

  // Auto-scroll a siguiente tarea
  const [showNextTaskFab, setShowNextTaskFab] = useState(true);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Respuestas rápidas predefinidas
  const quickResponses = [
    { label: 'Sin novedad', value: 'Sin novedad' },
    { label: 'Requiere atención', value: 'Requiere atención - Revisar en próximo mantenimiento' },
    { label: 'Falta repuesto', value: 'Falta repuesto - Solicitar compra' },
    { label: 'OK verificado', value: 'Verificación visual OK' },
  ];
   
   // Estado para responsables
  const [responsibles, setResponsibles] = useState({
    ejecutores: [''],
    supervisores: ['']
  });

  // Funciones optimizadas con useCallback para evitar recreaciones innecesarias
  const addEjecutor = useCallback(() => {
    setResponsibles(prev => ({
      ...prev,
      ejecutores: [...prev.ejecutores, '']
    }));
  }, []);

  const removeEjecutor = useCallback((index: number) => {
    setResponsibles(prev => {
      if (prev.ejecutores.length > 1) {
        return {
        ...prev,
        ejecutores: prev.ejecutores.filter((_, i) => i !== index)
  };
      }
      return prev;
    });
  }, []);

  const updateEjecutor = useCallback((index: number, value: string) => {
    setResponsibles(prev => ({
      ...prev,
      ejecutores: prev.ejecutores.map((ejecutor, i) => i === index ? value : ejecutor)
    }));
  }, []);

  const addSupervisor = useCallback(() => {
    setResponsibles(prev => ({
      ...prev,
      supervisores: [...prev.supervisores, '']
    }));
  }, []);

  const removeSupervisor = useCallback((index: number) => {
    setResponsibles(prev => {
      if (prev.supervisores.length > 1) {
        return {
        ...prev,
        supervisores: prev.supervisores.filter((_, i) => i !== index)
  };
      }
      return prev;
    });
  }, []);

  const updateSupervisor = useCallback((index: number, value: string) => {
    setResponsibles(prev => ({
      ...prev,
      supervisores: prev.supervisores.map((supervisor, i) => i === index ? value : supervisor)
    }));
  }, []);

  // ============= EFECTOS PARA MEJORAS =============

  // Timer de ejecución - inicia cuando se abre el diálogo
  useEffect(() => {
    if (isOpen && maintenanceItems.length > 0 && !executionStartTime) {
      setExecutionStartTime(new Date());
      setElapsedSeconds(0);
      setIsExecutionPaused(false);
    }

    if (!isOpen) {
      // Limpiar timer al cerrar
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setExecutionStartTime(null);
      setElapsedSeconds(0);
      // Resetear ref para que al abrir otro checklist se cargue correctamente
      lastLoadedChecklistIdRef.current = null;
    }
  }, [isOpen, maintenanceItems.length]);

  // Efecto del timer
  useEffect(() => {
    if (executionStartTime && !isExecutionPaused && isOpen) {
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
  }, [executionStartTime, isExecutionPaused, isOpen]);

  // Formatear tiempo transcurrido
  const formatElapsedTime = useCallback((seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Auto-guardado cada 2 minutos
  useEffect(() => {
    if (hasUnsavedChanges && maintenanceItems.length > 0 && isOpen) {
      autoSaveRef.current = setTimeout(async () => {
        try {
          // Guardar como borrador
          await handleSubmit(false, true); // false = no finalizar, true = es auto-guardado
          setLastAutoSave(new Date());
          setHasUnsavedChanges(false);
        } catch (error) {
          console.error('Error en auto-guardado:', error);
        }
      }, 120000); // 2 minutos
    }

    return () => {
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
    };
  }, [hasUnsavedChanges, maintenanceItems, isOpen]);

  // Marcar cambios sin guardar cuando se modifican items
  useEffect(() => {
    if (maintenanceItems.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [maintenanceItems]);

  // Función para agregar foto a un item
  const handleAddPhoto = useCallback((itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPhotos = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));

    setItemPhotos(prev => ({
      ...prev,
      [itemId]: [...(prev[itemId] || []), ...newPhotos]
    }));
  }, []);

  // Función para eliminar foto de un item
  const handleRemovePhoto = useCallback((itemId: string, photoIndex: number) => {
    setItemPhotos(prev => {
      const itemPhotosArr = prev[itemId] || [];
      // Revocar URL para liberar memoria
      if (itemPhotosArr[photoIndex]) {
        URL.revokeObjectURL(itemPhotosArr[photoIndex].preview);
      }
      return {
        ...prev,
        [itemId]: itemPhotosArr.filter((_, idx) => idx !== photoIndex)
      };
    });
  }, []);

  // ============= FUNCIONES NUEVAS UX OPERADOR =============

  // Obtener siguiente tarea pendiente
  const getNextPendingItem = useCallback(() => {
    return maintenanceItems.find(item => !item.completedDate && !item.rescheduleDate);
  }, [maintenanceItems]);

  // Obtener índice del siguiente pendiente
  const nextPendingIndex = useMemo(() => {
    return maintenanceItems.findIndex(item => !item.completedDate && !item.rescheduleDate);
  }, [maintenanceItems]);

  // Auto-scroll a siguiente tarea
  const scrollToNextTask = useCallback(() => {
    const nextItem = getNextPendingItem();
    if (nextItem && itemRefs.current[nextItem.id]) {
      itemRefs.current[nextItem.id]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      // Haptic feedback
      triggerHaptic('light');
      // Expandir el item en móvil
      if (isMobile) {
        setOpenItemId(nextItem.id);
      }
      // Resaltar brevemente
      const element = itemRefs.current[nextItem.id];
      if (element) {
        element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
        }, 2000);
      }
    } else {
      toast({
        title: '¡Todo completado!',
        description: 'No hay más tareas pendientes',
        variant: 'default'
      });
    }
  }, [getNextPendingItem, isMobile]);

  // Haptic feedback (vibración)
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' | 'error') => {
    if ('vibrate' in navigator) {
      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(25);
          break;
        case 'heavy':
          navigator.vibrate(50);
          break;
        case 'success':
          navigator.vibrate([10, 50, 10]); // Doble vibración corta
          break;
        case 'error':
          navigator.vibrate([50, 100, 50]); // Vibración larga-pausa-larga
          break;
      }
    }
  }, []);

  // Completar tarea rápido (un toque) - sin validar supervisor/executor hasta el final
  const handleQuickComplete = useCallback((itemId: string) => {
    // Calcular fecha de hoy inline para evitar problemas de orden de declaración
    const d = new Date();
    const day = `${d.getDate()}`.padStart(2, '0');
    const month = `${d.getMonth() + 1}`.padStart(2, '0');
    const year = d.getFullYear();
    const today = `${day}/${month}/${year}`;

    setMaintenanceItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          completedDate: today,
          notes: item.notes || 'Sin novedad',
          issues: item.issues || 'Sin inconvenientes'
        };
      }
      return item;
    }));

    // Haptic feedback de éxito
    triggerHaptic('success');

    // Toast de confirmación
    toast({
      title: '✓ Tarea completada',
      description: 'Recuerda asignar responsables antes de finalizar',
      duration: 2000
    });

    // Auto-scroll al siguiente después de un delay
    setTimeout(() => {
      scrollToNextTask();
    }, 500);
  }, [triggerHaptic, scrollToNextTask]);

  // Descompletar tarea rápido
  const handleQuickUncomplete = useCallback((itemId: string) => {
    setMaintenanceItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          completedDate: undefined,
          rescheduleDate: undefined
        };
      }
      return item;
    }));
    triggerHaptic('light');
  }, [triggerHaptic]);

  // Agregar respuesta rápida a notas
  const handleQuickResponse = useCallback((itemId: string, response: string, field: 'notes' | 'issues') => {
    setMaintenanceItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const currentValue = item[field] || '';
        const newValue = currentValue ? `${currentValue}. ${response}` : response;
        return { ...item, [field]: newValue };
      }
      return item;
    }));
    triggerHaptic('light');
  }, [triggerHaptic]);

  // Función para completar TODAS las tareas pendientes de golpe (ejecución masiva)
  const handleBulkCompleteAll = useCallback(() => {
    // Validaciones
    if (!bulkSupervisor) {
      toast({
        title: 'Supervisor requerido',
        description: 'Debe seleccionar un supervisor para la ejecución masiva',
        variant: 'destructive'
      });
      return;
    }
    if (!bulkExecutor) {
      toast({
        title: 'Ejecutor requerido',
        description: 'Debe seleccionar un ejecutor para la ejecución masiva',
        variant: 'destructive'
      });
      return;
    }

    const completionDate = bulkExecutionDate || (() => {
      const d = new Date();
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    })();

    const pendingCount = maintenanceItems.filter(item => !item.isCompleted).length;

    setMaintenanceItems(prev => prev.map(item => {
      if (!item.isCompleted) {
        return {
          ...item,
          isCompleted: true,
          completedDate: completionDate,
          notes: bulkNotes || 'Sin novedad',
          executors: [bulkExecutor],
          responsables: [bulkExecutor], // Sincronizar con executors
          supervisors: [bulkSupervisor]
        };
      }
      return item;
    }));

    triggerHaptic('medium');
    toast({
      title: '¡Ejecución masiva completada!',
      description: `${pendingCount} tareas fueron marcadas como completadas`,
    });
    setIsBulkExecutionMode(false);
    // Reset bulk states
    setBulkSupervisor('');
    setBulkExecutor('');
    setBulkNotes('Sin novedad');
  }, [bulkNotes, bulkSupervisor, bulkExecutor, bulkExecutionDate, maintenanceItems, triggerHaptic]);

  // Input de voz - iniciar grabación
  const startVoiceInput = useCallback((itemId: string, field: 'notes' | 'issues') => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({
        title: 'No disponible',
        description: 'Tu navegador no soporta entrada de voz',
        variant: 'destructive'
      });
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-AR';

    recognition.onstart = () => {
      setIsRecording(true);
      setCurrentVoiceItemId(itemId);
      setVoiceField(field);
      triggerHaptic('medium');
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        setMaintenanceItems(prev => prev.map(item => {
          if (item.id === itemId) {
            const currentValue = item[field] || '';
            const newValue = currentValue ? `${currentValue} ${finalTranscript}` : finalTranscript;
            return { ...item, [field]: newValue };
          }
          return item;
        }));
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      setCurrentVoiceItemId(null);
      triggerHaptic('error');
    };

    recognition.onend = () => {
      setIsRecording(false);
      setCurrentVoiceItemId(null);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [triggerHaptic]);

  // Input de voz - detener grabación
  const stopVoiceInput = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setCurrentVoiceItemId(null);
    triggerHaptic('light');
  }, [triggerHaptic]);

  // Leer instrucciones en voz alta
  const speakText = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      // Cancelar cualquier lectura anterior
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-AR';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
      triggerHaptic('light');
    } else {
      toast({
        title: 'No disponible',
        description: 'Tu navegador no soporta síntesis de voz',
        variant: 'destructive'
      });
    }
  }, [triggerHaptic]);

  // Calcular progreso
  const progressData = useMemo(() => {
    const total = maintenanceItems.length;
    const completed = maintenanceItems.filter(item => item.completedDate || item.rescheduleDate).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percentage };
  }, [maintenanceItems]);

  // Filtrar items según búsqueda y estado
  const filteredItems = useMemo(() => {
    return maintenanceItems.filter(item => {
      // Filtro por texto
      const matchesSearch = itemSearchTerm === '' ||
        (item.maintenanceData?.title || '').toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
        (item.maintenanceData?.machine?.name || '').toLowerCase().includes(itemSearchTerm.toLowerCase());

      // Filtro por estado
      const isCompleted = !!(item.completedDate || item.rescheduleDate);
      const matchesStatus = showCompletedOnly === 'all' ||
        (showCompletedOnly === 'completed' && isCompleted) ||
        (showCompletedOnly === 'pending' && !isCompleted);

      return matchesSearch && matchesStatus;
    });
  }, [maintenanceItems, itemSearchTerm, showCompletedOnly]);

  // Función para cargar checklist por ID (optimizada para fluidez)
  const fetchChecklistById = async (checklistId: number, inProgressExecutionId?: number) => {
    setLoadingChecklist(true);
    try {
      // Cargar checklist primero (crítico)
      const response = await fetch(`/api/maintenance/checklists?checklistId=${checklistId}`);
      const result = await response.json();
      
      if (result.success && result.checklists && result.checklists.length > 0) {
        const checklist = result.checklists[0];
        
        // Mostrar checklist inmediatamente (sin esperar ejecución)
        setLoadedChecklist(checklist);
        
        // Cargar instructivos del checklist inmediatamente
        if (checklist.instructives && Array.isArray(checklist.instructives) && checklist.instructives.length > 0) {
          setChecklistInstructives(checklist.instructives);
        } else {
          setChecklistInstructives([]);
        }
        
        // Si hay una ejecución en progreso, cargar sus datos (en paralelo si es posible)
        const executionIdToLoad = inProgressExecutionId || checklist.inProgressExecutionId;
        if (executionIdToLoad) {
          try {
            // Cargar ejecución sin bloquear la UI
            const executionResponse = await fetch(`/api/maintenance/checklist-execution?executionId=${executionIdToLoad}`);
            const executionResult = await executionResponse.json();
            
            if (executionResult.success && executionResult.execution) {
              const execution = executionResult.execution;
              // Guardar el ID de ejecución para poder actualizarla en vez de crear una nueva
              setCurrentExecutionId(execution.id);
              const executionDetails = execution.executionDetails || {};
              const savedMaintenanceItems = executionDetails.maintenanceItems || [];
              const savedResponsibles = executionDetails.responsibles || {};
              const savedSignatures = executionDetails.signatures || {};
              
              // Cargar items desde fases o items directos
              let itemsToLoad: any[] = [];
              if (checklist.phases && checklist.phases.length > 0) {
                itemsToLoad = checklist.phases.reduce((acc: any[], phase: any) => {
                  if (phase.items && phase.items.length > 0) {
                    return [...acc, ...phase.items];
                  }
                  return acc;
                }, []);
              } else if (checklist.items && checklist.items.length > 0) {
                itemsToLoad = checklist.items;
              }
              
              // Crear items iniciales con datos guardados (mostrar inmediatamente)
              const items: MaintenanceItem[] = itemsToLoad.map((item: any, index: number) => {
                const savedItem = savedMaintenanceItems.find((si: any) => si.maintenanceId === item.maintenanceId) || savedMaintenanceItems[index];
                // Usar executors o responsables guardados (ambos campos deben tener los mismos valores)
                const savedExecutors = savedItem?.executors || savedItem?.responsables || [];
                return {
                  id: `item-${Date.now()}-${item.maintenanceId}-${index}`,
                  maintenanceId: item.maintenanceId,
                  maintenanceData: item, // Datos básicos primero
                  completedDate: savedItem?.completedDate || '',
                  rescheduleDate: savedItem?.rescheduleDate || '',
                  currentKilometers: savedItem?.currentKilometers || item.unidadMovil?.kilometraje || 0,
                  currentHours: savedItem?.currentHours || 0,
                  notes: savedItem?.notes || '',
                  issues: savedItem?.issues || '',
                  executors: savedExecutors,
                  responsables: savedExecutors, // Cargar en ambos campos para que se muestre en todas las vistas
                  supervisors: savedItem?.supervisors || []
                };
              });
              
              // Mostrar items inmediatamente
              setMaintenanceItems(items);
              
              // Cargar datos completos de mantenimientos en paralelo (sin bloquear)
              if (items.length > 0) {
                const loadMaintenanceDetails = async () => {
                  try {
                    const maintenancePromises = items.map(async (item, index) => {
                      try {
                        const fullData = await fetchMaintenanceDetails(item.maintenanceId);
                        return { index, data: fullData || item.maintenanceData };
                      } catch (error) {
                        return { index, data: item.maintenanceData };
                      }
                    });
                    
                    const results = await Promise.all(maintenancePromises);
                    
                    setMaintenanceItems(prevItems => {
                      const updated = [...prevItems];
                      results.forEach(({ index, data }) => {
                        if (updated[index]) {
                          updated[index] = { ...updated[index], maintenanceData: data };
                        }
                      });
                      return updated;
                    });
                  } catch (error) {
                    console.error('Error cargando detalles de mantenimientos:', error);
                  }
                };
                
                // Cargar en segundo plano sin bloquear
                loadMaintenanceDetails();
              }
              
              // Cargar responsables y firmas guardados
              if (savedResponsibles) {
                setResponsibles({
                  ejecutores: savedResponsibles.ejecutores || [''],
                  supervisores: savedResponsibles.supervisores || ['']
                });
              }
              
              if (savedSignatures) {
                if (savedSignatures.executors) {
                  setExecutorSignatures(savedSignatures.executors);
                }
                if (savedSignatures.supervisors) {
                  setSupervisorSignatures(savedSignatures.supervisors);
                }
              }
              
              toast({
                title: "Checklist en progreso cargado",
                description: `Se cargó la ejecución guardada de: ${checklist.title}`,
                variant: "default"
              });
              
              setLoadingChecklist(false);
              return;
            }
          } catch (error) {
            console.error('Error cargando ejecución en progreso:', error);
            // Continuar con la carga normal si falla
          }
        }
        
        // Cargar automáticamente todos los mantenimientos del checklist (si no hay ejecución en progreso)
        // Obtener items desde fases o items directos
        let itemsToLoad: any[] = [];
        if (checklist.phases && checklist.phases.length > 0) {
          // Si tiene fases, obtener items de todas las fases
          itemsToLoad = checklist.phases.reduce((acc: any[], phase: any) => {
            if (phase.items && phase.items.length > 0) {
              return [...acc, ...phase.items];
            }
            return acc;
          }, []);
        } else if (checklist.items && checklist.items.length > 0) {
          // Si no tiene fases, usar items directos
          itemsToLoad = checklist.items;
        }
        
        if (itemsToLoad.length > 0) {
          // Crear items iniciales inmediatamente (sin bloquear)
          const items: MaintenanceItem[] = itemsToLoad.map((item: any, index: number) => ({
            id: `item-${Date.now()}-${item.maintenanceId}-${index}`,
            maintenanceId: item.maintenanceId,
            maintenanceData: item, // Datos básicos primero
            currentKilometers: item.unidadMovil?.kilometraje || 0,
            currentHours: 0,
            notes: '',
            issues: ''
          }));
          
          // Mostrar items inmediatamente
          setMaintenanceItems(items);
          
          // Cargar datos completos en paralelo (sin bloquear UI)
          const loadMaintenanceDetails = async () => {
            try {
              const maintenancePromises = items.map(async (item, index) => {
                try {
                  const fullData = await fetchMaintenanceDetails(item.maintenanceId);
                  return { index, data: fullData || item.maintenanceData };
                } catch (error) {
                  return { index, data: item.maintenanceData };
                }
              });
              
              const results = await Promise.all(maintenancePromises);
              
              setMaintenanceItems(prevItems => {
                const updated = [...prevItems];
                results.forEach(({ index, data }) => {
                  if (updated[index]) {
                    updated[index] = { ...updated[index], maintenanceData: data };
                  }
                });
                return updated;
              });
            } catch (error) {
              console.error('Error cargando detalles de mantenimientos:', error);
            }
          };
          
          // Cargar en segundo plano
          loadMaintenanceDetails();
        }
        
        toast({
          title: "Checklist cargado",
          description: `Se cargó: ${checklist.title} con ${itemsToLoad.length || 0} mantenimientos`,
          variant: "default"
        });
      } else {
        toast({
          title: "Error",
          description: "No se encontró el checklist con ese ID",
          variant: "destructive"
        });
      }
    } catch (error) {
      
      toast({
        title: "Error",
        description: "No se pudo cargar el checklist",
        variant: "destructive"
      });
    } finally {
      setLoadingChecklist(false);
    }
  };


  // Hook personalizado para debouncing
  const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);

      return () => {
        clearTimeout(handler);
      };
    }, [value, delay]);

    return debouncedValue;
  };

  // Usar debouncing para búsquedas de empleados (mejora rendimiento)
  const debouncedEmployeeSearch = useDebounce(employeeSearch, 300);
  const debouncedMassEmployeeSearch = useDebounce(massEmployeeSearch, 300);

  // Filtrar empleados con useMemo para evitar recálculos innecesarios
  const filteredEmployees = useMemo(() => {
    if (!debouncedEmployeeSearch) return employees;
    const search = debouncedEmployeeSearch.toLowerCase();
    return employees.filter(emp => 
      emp.name.toLowerCase().includes(search)
    );
  }, [employees, debouncedEmployeeSearch]);

  const filteredMassEmployees = useMemo(() => {
    if (!debouncedMassEmployeeSearch) return employees;
    const search = debouncedMassEmployeeSearch.toLowerCase();
    return employees.filter(emp => 
      emp.name.toLowerCase().includes(search)
    );
  }, [employees, debouncedMassEmployeeSearch]);

  const handleLoadChecklist = useCallback(() => {
    const id = parseInt(checklistId);
    if (isNaN(id)) {
      toast({
        title: "Error",
        description: "Ingresa un ID de checklist válido",
        variant: "destructive"
      });
      return;
    }
    
    fetchChecklistById(id);
  }, [checklistId, fetchChecklistById]);

  // Memoizar validación de fecha para evitar recreaciones
  const isValidDateFormat = useCallback((dateString: string): boolean => {
    const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = dateString.match(regex);
    
    if (!match) return false;
    
    const [, day, month, year] = match;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    return d.getDate() === parseInt(day) &&
           d.getMonth() === parseInt(month) - 1 &&
           d.getFullYear() === parseInt(year);
  }, []);

  const handleItemChange = useCallback((itemId: string, field: keyof MaintenanceItem, value: any) => {
     // Validar formato de fecha si es un campo de fecha
     if ((field === 'completedDate' || field === 'rescheduleDate') && value) {
       if (!isValidDateFormat(value)) {
         toast({
           title: "Formato de fecha inválido",
           description: "Usa el formato dd/mm/yyyy (ej: 25/12/2024)",
           variant: "destructive"
         });
         return;
       }
     }

     setMaintenanceItems(prev => prev.map(item => {
       if (item.id !== itemId) return item;

       let updates: Partial<MaintenanceItem> = { [field]: value };

       // Sincronizar executors y responsables
       if (field === 'executors') {
         updates.responsables = value;
         // Si quita todos los responsables y tiene completedDate, limpiar
         if (Array.isArray(value) && value.length === 0 && item.completedDate) {
           toast({ title: 'Fecha eliminada', description: 'Se quitó la fecha porque no hay responsable', variant: 'default' });
           updates.completedDate = '';
         }
       }
       if (field === 'responsables') {
         updates.executors = value;
         // Si quita todos los responsables y tiene completedDate, limpiar
         if (Array.isArray(value) && value.length === 0 && item.completedDate) {
           toast({ title: 'Fecha eliminada', description: 'Se quitó la fecha porque no hay responsable', variant: 'default' });
           updates.completedDate = '';
         }
       }
       // Si quita todos los supervisores, limpiar fechas
       if (field === 'supervisors' && Array.isArray(value) && value.length === 0) {
         if (item.completedDate) {
           toast({ title: 'Fecha eliminada', description: 'Se quitó la fecha de realizado porque no hay supervisor', variant: 'default' });
           updates.completedDate = '';
         }
         if (item.rescheduleDate) {
           toast({ title: 'Fecha eliminada', description: 'Se quitó la fecha de reprogramar porque no hay supervisor', variant: 'default' });
           updates.rescheduleDate = '';
         }
       }

       return { ...item, ...updates };
     }));
  }, [isValidDateFormat]);

  // Funciones de formateo memoizadas para mejor rendimiento
  const formatDateForDisplay = useCallback((dateString: string): string => {
    if (dateString.includes('/')) return dateString;
     if (dateString.includes('-') && dateString.length === 10) {
       const parts = dateString.split('-');
       if (parts.length === 3) {
         const [year, month, day] = parts;
         return `${day}/${month}/${year}`;
       }
     }
     return dateString;
  }, []);

  const formatDateForInput = useCallback((dateString: string): string => {
    if (dateString.includes('-') && dateString.length === 10) return dateString;
     const parts = dateString.split('/');
     if (parts.length === 3) {
       const [day, month, year] = parts;
       return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
     }
     const date = new Date(dateString);
     if (isNaN(date.getTime())) return '';
     return date.toISOString().split('T')[0];
  }, []);

  const formatDateFromInput = useCallback((inputDate: string): string => {
     const parts = inputDate.split('-');
     if (parts.length !== 3) return '';
     const [year, month, day] = parts;
     return `${day}/${month}/${year}`;
  }, []);

  const getTodayDdMmYyyy = useCallback((): string => {
    const d = new Date();
    const day = `${d.getDate()}`.padStart(2, '0');
    const month = `${d.getMonth() + 1}`.padStart(2, '0');
    const year = d.getFullYear();
     return `${day}/${month}/${year}`;
  }, []);

  // isValidDateFormat ya está definida arriba con useCallback

  // Respuestas rápidas
  // Generación dinámica de respuestas rápidas para Notas según el título de la tarea
  const getQuickNoteOptions = (title: string | undefined): string[] => {
    const text = (title || '').toLowerCase();
    const base = new Set<string>(['Sin novedad', 'Verificación visual completa']);
    if (text.includes('limp')) base.add('Limpieza realizada');
    if (text.includes('engras')) base.add('Engrasado realizado');
    if (text.includes('lubric')) base.add('Lubricación aplicada');
    if (text.includes('control')) base.add('Control realizado');
    if (text.includes('consum')) base.add('Consumo verificado');
    if (text.includes('ajust')) base.add('Ajuste realizado');
    if (text.includes('cambiar') || text.includes('reempl')) base.add('Reemplazo realizado');
    return Array.from(base);
  };
  const quickIssueOptions = [
    'Sin inconvenientes',
    'Falta repuesto',
    'Se detectó fuga',
    'Ruidos anormales'
  ];

  // Funciones helper optimizadas con useCallback (definidas más abajo)

  const resolveMaintenanceId = useCallback((item: MaintenanceItem): number | null => {
    const candidates: Array<number | string | undefined | null> = [
      item.maintenanceId,
      item.maintenanceData?.maintenanceId,
      item.maintenanceData?.id,
      item.maintenanceData?.workOrderId
    ];

    for (const candidate of candidates) {
      if (candidate === undefined || candidate === null) continue;
      const numericValue = typeof candidate === 'string' ? parseInt(candidate, 10) : candidate;
      if (typeof numericValue === 'number' && !isNaN(numericValue) && numericValue > 0) {
        return numericValue;
      }
    }

    return null;
  }, []);

  // Las funciones getItemName y getItemContext ya están definidas más abajo con useCallback

  // Funciones helper optimizadas con useCallback (definidas ANTES del useMemo que las usa)
  const getItemName = useCallback((item: MaintenanceItem): string => {
    const data = item.maintenanceData || {};
    return (
      data.title ||
      data.name ||
      data.maintenanceName ||
      data.descripcion ||
      `Tarea ${item.maintenanceId || item.id}`
    );
  }, []);

  const getItemContext = useCallback((item: MaintenanceItem): string => {
    const data = item.maintenanceData || {};
    const parts: string[] = [];
    
    if (data.sectorName) parts.push(`Sector: ${data.sectorName}`);
    if (data.sector?.name) parts.push(`Sector: ${data.sector.name}`);
    if (data.machineName) parts.push(`Máquina: ${data.machineName}`);
    if (data.machine?.name) parts.push(`Máquina: ${data.machine.name}`);
    if (data.brand) parts.push(`Marca: ${data.brand}`);
    if (data.machine?.brand) parts.push(`Marca: ${data.machine.brand}`);
    if (checklist?.sectorName) parts.push(`Sector: ${checklist.sectorName}`);
    if (checklist?.machineName) parts.push(`Máquina: ${checklist.machineName}`);
    
    return parts.length > 0 ? ` (${parts.join(', ')})` : '';
  }, [checklist]);

  // Memoizar validación del checklist para evitar recálculos innecesarios
  const checklistValidation = useMemo(() => {
    const errors: Array<{ message: string; itemId?: string; field?: string }> = [];

    // Validar que todos tengan fecha (completado o reprogramado)
    const invalidItems = maintenanceItems.filter(item => 
      !item.completedDate && !item.rescheduleDate
    );

    invalidItems.forEach(item => {
      const itemName = getItemName(item);
      const context = getItemContext(item);
      // Determinar qué tipo de fecha falta basado en si el item está marcado como completado o no
      const hasCompletedCheckbox = item.isCompleted;
      const fechaType = hasCompletedCheckbox ? 'fecha de completado' : 'fecha (completado o reprogramación)';
      errors.push({
        message: `Falta completar la ${fechaType} en: ${itemName}${context}`,
        itemId: item.id,
        field: 'date'
      });
    });

    // Validar items con fecha (completados o reprogramados): deben tener notas, inconvenientes, ejecutores y supervisores
    maintenanceItems.forEach(item => {
      // Validar para items con fecha de completado o reprogramación
      if (!!item.completedDate || !!item.rescheduleDate) {
        const hasNotes = (item.notes || '').trim() !== '';
        const hasIssues = (item.issues || '').trim() !== '';
        const hasExecutors = item.executors && item.executors.length > 0 && item.executors.some(e => e.trim() !== '');
        const hasSupervisors = item.supervisors && item.supervisors.length > 0 && item.supervisors.some(s => s.trim() !== '');
        const itemName = getItemName(item);
        const context = getItemContext(item);

        // Validar notas e inconvenientes por separado - siempre agregar errores individuales (obligatorios para todos)
        if (!hasNotes) {
          errors.push({
            message: `Faltan notas en: ${itemName}${context}`,
            itemId: item.id,
            field: 'notes'
          });
        }
        if (!hasIssues) {
          errors.push({
            message: `Faltan inconvenientes en: ${itemName}${context}`,
            itemId: item.id,
            field: 'issues'
          });
        }

        // Validar ejecutores solo para items completados
        if (!!item.completedDate && !hasExecutors) {
          errors.push({
            message: `Faltan responsables en: ${itemName}${context}`,
            itemId: item.id,
            field: 'executors'
          });
        }
        
        // Validar supervisores para items completados
        if (!!item.completedDate && !hasSupervisors) {
          errors.push({
            message: `Faltan supervisores en: ${itemName}${context}`,
            itemId: item.id,
            field: 'supervisors'
          });
        }
      }
    });

    // NUEVA VALIDACIÓN: Si hay fecha de reprogramación, debe haber supervisor
    maintenanceItems.forEach(item => {
      if (!!item.rescheduleDate && (!item.supervisors || item.supervisors.length === 0 || item.supervisors.every(s => !s.trim()))) {
        const itemName = getItemName(item);
        const context = getItemContext(item);
        errors.push({
          message: `Faltan supervisores en: ${itemName}${context} (ítem reprogramado)`,
          itemId: item.id,
          field: 'supervisors'
        });
      }
    });

    // Validar responsables generales: solo son obligatorios si algún item no tiene sus propios responsables/supervisores
    // Verificar si todos los items tienen sus propios responsables y supervisores
    // Para ejecutores: solo se requieren en items completados (no en items reprogramados)
    const allCompletedItemsHaveExecutors = maintenanceItems
      .filter(item => !!item.completedDate) // Solo items completados
      .every(item => 
        item.executors && item.executors.length > 0 && item.executors.some(e => e.trim() !== '')
      );
    // Para supervisores: se requieren en items completados Y en items reprogramados
    const allItemsHaveSupervisores = maintenanceItems.every(item => 
      item.supervisors && item.supervisors.length > 0 && item.supervisors.some(s => s.trim() !== '')
    );

    const ejecutoresValidos = responsibles.ejecutores.filter(e => e.trim() !== '');
    const supervisoresValidos = responsibles.supervisores.filter(s => s.trim() !== '');

    // Solo validar responsables generales si no todos los items completados tienen sus propios ejecutores
    // Los items reprogramados no necesitan ejecutores, solo supervisores
    if (!allCompletedItemsHaveExecutors && ejecutoresValidos.length === 0) {
      const itemsWithoutExecutors = maintenanceItems
        .filter(item => !!item.completedDate)
        .filter(item => !item.executors || item.executors.length === 0 || item.executors.every(e => !e.trim()));
      itemsWithoutExecutors.forEach(item => {
        errors.push({
          message: `Faltan responsables en: ${getItemName(item)} (asignar en el ítem o generales)`,
          itemId: item.id,
          field: 'executors'
        });
      });
    }

    // Validar supervisores: se requieren en todos los items (completados y reprogramados)
    if (!allItemsHaveSupervisores && supervisoresValidos.length === 0) {
      const itemsWithoutSupervisores = maintenanceItems.filter(item =>
        !item.supervisors || item.supervisors.length === 0 || item.supervisors.every(s => !s.trim())
      );
      itemsWithoutSupervisores.forEach(item => {
        errors.push({
          message: `Faltan supervisores en: ${getItemName(item)} (asignar en el ítem o generales)`,
          itemId: item.id,
          field: 'supervisors'
        });
      });
    }

    // Validar que todas las firmas estén presentes
    // Obtener todos los ejecutores y supervisores únicos de los items
    const allExecutors = new Set<string>();
    const allSupervisors = new Set<string>();
    
    maintenanceItems.forEach(item => {
      (item.executors || []).forEach(name => {
        if (name.trim()) allExecutors.add(name.trim());
      });
      (item.supervisors || []).forEach(name => {
        if (name.trim()) allSupervisors.add(name.trim());
      });
    });
    
    // Agregar ejecutores y supervisores de responsables generales
    responsibles.ejecutores.forEach(name => {
      if (name.trim()) allExecutors.add(name.trim());
    });
    responsibles.supervisores.forEach(name => {
      if (name.trim()) allSupervisors.add(name.trim());
    });
    
    // Función helper para verificar si una firma tiene contenido real
    const hasValidSignature = (signatureDataUrl: string | undefined): boolean => {
      if (!signatureDataUrl) return false;
      // Si la firma existe, asumimos que tiene contenido (la validación se hace al guardar)
      // Pero podemos hacer una verificación adicional si es necesario
      return signatureDataUrl.length > 100; // Las firmas reales son mucho más largas que un canvas vacío
    };
    
    // Verificar que todos los ejecutores tengan firma válida
    const executorsWithoutSignature = Array.from(allExecutors).filter(name => {
      const signature = executorSignatures[name];
      return !hasValidSignature(signature);
    });
    if (executorsWithoutSignature.length > 0) {
      errors.push({
        message: `Faltan firmas de responsables: ${executorsWithoutSignature.join(', ')}`,
        field: 'signatures-executors'
      });
    }
    
    // Verificar que todos los supervisores tengan firma válida
    const supervisorsWithoutSignature = Array.from(allSupervisors).filter(name => {
      const signature = supervisorSignatures[name];
      return !hasValidSignature(signature);
    });
    if (supervisorsWithoutSignature.length > 0) {
      errors.push({
        message: `Faltan firmas de supervisores: ${supervisorsWithoutSignature.join(', ')}`,
        field: 'signatures-supervisors'
      });
    }

    return {
      isComplete: errors.length === 0,
      errors
    };
  }, [maintenanceItems, responsibles, executorSignatures, supervisorSignatures, getItemName, getItemContext]);

  // Función wrapper para compatibilidad (usa el valor memoizado)
  const isChecklistComplete = useCallback(() => checklistValidation, [checklistValidation]);

  // Memoizar cálculos costosos para validación de supervisor
  const itemsWithRescheduleButNoSupervisor = useMemo(() => {
    return maintenanceItems.filter(item =>
      !!item.rescheduleDate && (
        !item.supervisors || item.supervisors.length === 0 || item.supervisors.every(s => !s.trim())
      )
    );
  }, [maintenanceItems]);

  const handleSubmit = useCallback(async (shouldFinalize: boolean = false) => {
    if (maintenanceItems.length === 0) {
      toast({
        title: "Error",
        description: "Debes agregar al menos un mantenimiento",
        variant: "destructive"
      });
      return;
    }

    // Solo validar cuando se finaliza, no cuando se guarda progreso
    if (shouldFinalize) {
      // Validar supervisor si hay reprogramación
      if (itemsWithRescheduleButNoSupervisor.length > 0) {
        toast({
          title: "Supervisor requerido",
          description: "Los ítems con fecha de reprogramación deben tener al menos un Supervisor asignado",
          variant: "destructive"
        });
        return;
      }

      // Validar que esté completo
      if (!checklistValidation.isComplete) {
        toast({
          title: "Checklist incompleto",
          description: checklistValidation.errors.map(e => e.message).join('. '),
          variant: "destructive"
        });
        return;
      }
    }
    // Si solo se guarda progreso, NO validar nada - guardar el estado actual

    setIsSubmitting(true);
    try {
      // Usar fecha y hora actual automáticamente
      const executedAtDate = new Date();

      // Subir fotos a S3 si hay alguna
      const photoUrlsByItemId: Record<string, string[]> = {};
      const itemsWithPhotos = maintenanceItems.filter(item => (itemPhotos[item.id] || []).length > 0);

      if (itemsWithPhotos.length > 0) {
        toast({
          title: 'Subiendo fotos...',
          description: `Procesando ${itemsWithPhotos.reduce((acc, item) => acc + (itemPhotos[item.id] || []).length, 0)} foto(s)`
        });

        for (const item of itemsWithPhotos) {
          const photos = itemPhotos[item.id] || [];
          const urls: string[] = [];

          for (const photo of photos) {
            try {
              const formData = new FormData();
              formData.append('file', photo.file);
              formData.append('entityType', 'maintenance');
              formData.append('fileType', 'execution-photo');
              formData.append('entityId', String(resolveMaintenanceId(item) || item.id));

              const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData
              });

              if (uploadResponse.ok) {
                const uploadData = await uploadResponse.json();
                urls.push(uploadData.url);
              } else {
                console.error('Error subiendo foto:', await uploadResponse.text());
              }
            } catch (uploadError) {
              console.error('Error subiendo foto:', uploadError);
            }
          }

          if (urls.length > 0) {
            photoUrlsByItemId[item.id] = urls;
          }
        }
      }

      const missingMaintenanceItems: MaintenanceItem[] = [];
      const normalizedMaintenanceItems = maintenanceItems.map(item => {
        const maintenanceId = resolveMaintenanceId(item);

        if (!maintenanceId) {
          missingMaintenanceItems.push(item);
        }

        return {
          maintenanceId,
          completedDate: item.completedDate,
          rescheduleDate: item.rescheduleDate,
          currentKilometers: item.currentKilometers,
          currentHours: item.currentHours,
          notes: item.notes,
          issues: item.issues,
          // El API espera "executors", pero en la UI usamos "responsables"
          executors: item.responsables || item.executors || [],
          supervisors: item.supervisors || [],
          // Incluir URLs de fotos subidas
          photoUrls: photoUrlsByItemId[item.id] || []
        };
      });

      // Solo validar maintenanceId cuando se finaliza, no cuando se guarda progreso
      if (shouldFinalize && missingMaintenanceItems.length > 0) {
        const missingNames = missingMaintenanceItems.map(getItemName).join(', ');
        toast({
          title: "No se pudo identificar el mantenimiento",
          description: `Verificá que las tareas estén vinculadas a un mantenimiento válido: ${missingNames}`,
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }

      const toNumericId = (value: any): number | null => {
        if (value === undefined || value === null) return null;
        const numericValue = typeof value === 'string' ? parseInt(value, 10) : value;
        return typeof numericValue === 'number' && !isNaN(numericValue) ? numericValue : null;
      };

      const resolvedCompanyId = toNumericId(loadedChecklist?.companyId ?? checklist?.companyId ?? currentCompany?.id);
      const resolvedSectorId = toNumericId(loadedChecklist?.sectorId ?? checklist?.sectorId ?? currentSector?.id);

      if (!resolvedCompanyId) {
        toast({
          title: "Falta información de la empresa",
          description: "No se pudo determinar la empresa asociada al checklist.",
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }

      const executionData = {
        checklistId: loadedChecklist?.id || checklist?.id,
        executedAt: executedAtDate.toISOString(),
        maintenanceItems: normalizedMaintenanceItems.map(item => ({
          ...item,
          maintenanceId: item.maintenanceId as number
        })),
        responsibles: {
          ejecutores: responsibles.ejecutores.filter(e => e.trim() !== ''),
          supervisores: responsibles.supervisores.filter(s => s.trim() !== ''),
          fechaEjecucion: format(new Date(), 'yyyy-MM-dd'),
          horaFinalizacion: format(new Date(), 'HH:mm')
        },
        signatures: {
          executors: executorSignatures,
          supervisors: supervisorSignatures
        },
        executedBy: user?.name || user?.email || 'Usuario Actual',
        executedById: user?.id ?? null
      };

       // Enviando datos al API

       // Llamar a la API para guardar la ejecución
       // Iniciando petición HTTP
       const response = await fetch('/api/maintenance/checklist-execution', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json'
         },
        body: JSON.stringify({
          checklistId: loadedChecklist?.id || checklist?.id,
          executionId: currentExecutionId, // ID de ejecución existente (si hay) para actualizar en vez de crear
          executedAt: executionData.executedAt, // Usar la fecha/hora calculada
          maintenanceItems: executionData.maintenanceItems,
          responsibles: executionData.responsibles,
          signatures: executionData.signatures,
          executedByName: executionData.executedBy,
          executedById: executionData.executedById,
          companyId: resolvedCompanyId,
          sectorId: resolvedSectorId,
          isFinalized: shouldFinalize, // Nuevo campo para indicar si se finaliza o solo se guarda
          status: shouldFinalize ? 'COMPLETED' : 'IN_PROGRESS' // Estado según si se finaliza
        })
       });
       
       // Respuesta del servidor recibida
       const result = await response.json();

      if (response.ok && result.success) {
        if (shouldFinalize) {
          toast({
            title: "Checklist finalizado",
            description: result.message || `Se ejecutaron ${maintenanceItems.length} mantenimientos correctamente`,
            variant: "default",
            action: (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Abrir modal de impresión o redirigir a página de impresión
                  window.open(`/maintenance/checklist-print/${result.executionId}`, '_blank');
                }}
              >
                Imprimir
              </Button>
            )
          });

          // Guardar el executionId para poder imprimir después
          const executionId = result.executionId;

          // Limpiar localStorage porque ya se finalizó el checklist
          const checklistIdForClear = loadedChecklist?.id || checklist?.id;
          if (checklistIdForClear) {
            clearSavedExecutionId(checklistIdForClear);
          }

          onChecklistCompleted(loadedChecklist?.id || checklist?.id, executionData);
          
          // Cerrar después de un breve delay para que el usuario vea el mensaje
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          // Guardar el ID de ejecución en localStorage y en state para poder recargar/actualizar
          const checklistIdForSave = loadedChecklist?.id || checklist?.id;
          if (result.executionId) {
            // Actualizar el state con el ID de ejecución (para futuras actualizaciones)
            setCurrentExecutionId(result.executionId);
            // Guardar en localStorage para persistir entre sesiones
            if (checklistIdForSave) {
              setSavedExecutionId(checklistIdForSave, result.executionId);
            }
          }
          toast({
            title: "Checklist guardado",
            description: "El checklist se ha guardado correctamente. Puedes continuar completándolo más tarde.",
            variant: "default"
          });
          // Notificar al componente padre para que recargue la lista
          onChecklistCompleted(loadedChecklist?.id || checklist?.id, executionData);
          // No cerrar el diálogo, permitir continuar editando
        }
      } else {
        throw new Error(result.error || 'Error al guardar la ejecución');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo completar la ejecución del checklist",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [maintenanceItems, itemsWithRescheduleButNoSupervisor, checklistValidation, loadedChecklist, checklist, currentCompany, currentSector, responsibles, executorSignatures, supervisorSignatures, user, getItemName, resolveMaintenanceId, onChecklistCompleted, onClose, itemPhotos, currentExecutionId]);

  // Auto-guardar al cerrar el modal
  const handleCloseWithAutoSave = useCallback(async (open: boolean) => {
    if (!open && maintenanceItems.length > 0 && !isSubmitting) {
      // Si hay items y no estamos en medio de un submit, guardar automáticamente
      try {
        await handleSubmit(false);
      } catch (error) {
        // Si falla el auto-save, solo mostrar un warning
        console.error('Auto-save failed:', error);
      }
    }
    onClose();
  }, [maintenanceItems.length, isSubmitting, handleSubmit, onClose]);

  const resetForm = useCallback(() => {
     setMaintenanceItems([]);
     setChecklistId('');
     setLoadedChecklist(null);
     setCurrentExecutionId(null); // Limpiar ID de ejecución para empezar fresco
    setResponsibles({
      ejecutores: [''],
      supervisores: ['']
    });
    // Limpiar caché cuando se resetea el formulario
    maintenanceCacheRef.current.clear();
    // Limpiar URLs de fotos para liberar memoria
    Object.values(itemPhotos).forEach(photos => {
      photos.forEach(photo => {
        if (photo.preview) URL.revokeObjectURL(photo.preview);
      });
    });
    setItemPhotos({});
    // Resetear timer y filtros
    setItemSearchTerm('');
    setShowCompletedOnly('all');
    setHasUnsavedChanges(false);
    setLastAutoSave(null);
    // Resetear ref de checklist cargado
    lastLoadedChecklistIdRef.current = null;
  }, [itemPhotos]);

  // Caché en memoria para mantenimientos (evita llamadas repetidas)
  const maintenanceCacheRef = useRef<Map<number, { data: any; timestamp: number }>>(new Map());
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  // Función optimizada para obtener datos completos del mantenimiento con caché
  const fetchMaintenanceDetails = useCallback(async (maintenanceId: number) => {
    // Verificar caché primero
    const cached = maintenanceCacheRef.current.get(maintenanceId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    try {
      let companyId = currentCompany?.id ? String(currentCompany.id) : localStorage.getItem('companyId');
      if (!companyId) {
        try {
          const savedCompanyRaw = localStorage.getItem('savedCompany');
          if (savedCompanyRaw) {
            const sc = JSON.parse(savedCompanyRaw);
            if (sc?.id) companyId = String(sc.id);
          }
        } catch {}
      }

      // Intentar primero con la API de preventive (más rápida)
      let response = await fetch(`/api/maintenance/preventive/${maintenanceId}`);
      
      if (response.ok) {
        const data = await response.json();
        const maintenance = data.maintenance || data;
        // Guardar en caché
        maintenanceCacheRef.current.set(maintenanceId, { data: maintenance, timestamp: Date.now() });
        return maintenance;
      }

      // Si falla, intentar con la API de all
      if (companyId) {
        response = await fetch(`/api/maintenance/all?companyId=${companyId}`);
        if (response.ok) {
          const data = await response.json();
          const maintenances = data.maintenances || [];
          const maintenance = maintenances.find((m: any) => m.id === maintenanceId);
          if (maintenance) {
            // Guardar en caché
            maintenanceCacheRef.current.set(maintenanceId, { data: maintenance, timestamp: Date.now() });
            return maintenance;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Error fetching maintenance details:', error);
      return null;
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    if (isOpen) {
      // Evitar reinicializar si ya cargamos este mismo checklist (evita perder cambios del usuario)
      const checklistId = checklist?.id;
      if (checklistId && lastLoadedChecklistIdRef.current === checklistId) {
        return; // Ya cargamos este checklist, no reinicializar
      }

      resetForm();
      lastLoadedChecklistIdRef.current = checklistId || null;

      // Cargar instructivos del checklist si se pasa como prop
      if (checklist?.instructives && Array.isArray(checklist.instructives) && checklist.instructives.length > 0) {
        setChecklistInstructives(checklist.instructives);
      } else if (checklist) {
        setChecklistInstructives([]);
      }
      
      // Cargar empleados activos de Administración (en paralelo, sin bloquear)
      (async () => {
        try {
          let companyId = currentCompany?.id ? String(currentCompany.id) : localStorage.getItem('companyId');
          if (!companyId) {
            try {
              const savedCompanyRaw = localStorage.getItem('savedCompany');
              if (savedCompanyRaw) {
                const sc = JSON.parse(savedCompanyRaw);
                if (sc?.id) companyId = String(sc.id);
              }
            } catch {}
          }
          
          if (!companyId) return;
          
          // Intentar todas las fuentes en paralelo para mayor velocidad
          const employeePromises = [
            // Fuente principal: Administración → Costos
            fetch(`/api/costos/empleados?companyId=${companyId}`)
              .then(resp => resp.ok ? resp.json() : null)
              .catch(() => null),
            
            // Fallback 1: prisma.employee export
            fetch(`/api/employees/export-salaries?companyId=${companyId}`)
              .then(resp => resp.ok ? resp.json() : null)
              .catch(() => null),
            
            // Fallback 2: export crudo de costos
            fetch(`/api/costos/empleados/export?companyId=${companyId}`)
              .then(resp => resp.ok ? resp.json() : null)
              .catch(() => null)
          ];
          
          // Esperar todas las respuestas en paralelo
          const results = await Promise.all(employeePromises);
          
                  const allowed = ['bloques', 'viguetas'];
          let aggregated: Array<{ id: string; name: string }> = [];
          
          // Procesar resultados en orden de prioridad
          for (const data of results) {
            if (!data || !Array.isArray(data)) continue;
            
            const filtered = data.filter((e: any) => {
              const cat = (e.categoryName || e.category || e.employee_categories?.name || '').toLowerCase();
              return cat ? allowed.includes(cat) : true;
                  });
            
            const mapped = filtered
              .map((e: any) => ({ id: String(e.id), name: e.name }))
              .filter(e => e.name);
            
            aggregated = aggregated.concat(mapped);
            
            // Si encontramos empleados en la primera fuente, no necesitamos los fallbacks
            if (aggregated.length > 0) break;
          }

          // Deduplicar por id
          const unique = Array.from(new Map(aggregated.map(e => [e.id, e])).values());
          setEmployees(unique);
          
          if (unique.length === 0) {
            // Solo mostrar toast si realmente no hay empleados (no bloquear UI)
            setTimeout(() => {
            toast({
              title: 'Empleados no encontrados',
              description: 'No se pudieron cargar empleados activos desde Administración. Verifica que existan y estén activos.',
              variant: 'destructive'
            });
            }, 1000);
          }
        } catch (e) {
          console.error('Error cargando empleados:', e);
        }
      })();
      
      // Si el checklist tiene una ejecución en progreso, cargar sus datos
      // Primero verificar si tenemos un ID guardado en localStorage de auto-save anterior
      const savedExecForThisChecklist = getSavedExecutionId(checklist.id);
      const executionIdToLoad = checklist.inProgressExecutionId || savedExecForThisChecklist;

      if ((checklist.hasInProgressExecution && checklist.inProgressExecutionId) || savedExecForThisChecklist) {
        fetchChecklistById(checklist.id, executionIdToLoad || undefined);
      } else {
        // Si se pasa un checklist específico, cargar automáticamente sus mantenimientos
        // Obtener items desde fases o items directos
        let itemsToLoad: any[] = [];
        if (checklist.phases && checklist.phases.length > 0) {
          // Si tiene fases, obtener items de todas las fases
          itemsToLoad = checklist.phases.reduce((acc: any[], phase: any) => {
            if (phase.items && phase.items.length > 0) {
              return [...acc, ...phase.items];
            }
            return acc;
          }, []);
        } else if (checklist.items && checklist.items.length > 0) {
          // Si no tiene fases, usar items directos
          itemsToLoad = checklist.items;
        }
        
        if (itemsToLoad.length > 0) {
          // Mostrar el checklist inmediatamente para que el modal se vea fluido
          setLoadedChecklist(checklist);
          
          // Cargar instructivos del checklist inmediatamente (ya están disponibles)
          if (checklist.instructives && Array.isArray(checklist.instructives) && checklist.instructives.length > 0) {
            setChecklistInstructives(checklist.instructives);
          } else {
            setChecklistInstructives([]);
          }

          // Crear items iniciales con datos básicos (sin bloquear la UI)
          const initialItems: MaintenanceItem[] = itemsToLoad.map((item, index) => {
              const maintenanceId = item.maintenanceId || item.id;
            return {
              id: `item-${Date.now()}-${maintenanceId}-${index}`,
                maintenanceId: maintenanceId,
              maintenanceData: item, // Datos básicos primero
              currentKilometers: item.unidadMovil?.kilometraje || 0,
                currentHours: 0,
                notes: '',
                issues: ''
              };
          });
          
          // Mostrar items básicos inmediatamente
          setMaintenanceItems(initialItems);
          
          // Cargar datos completos de mantenimientos en paralelo (sin bloquear UI)
          const loadMaintenanceItems = async () => {
            try {
              // Cargar todos los mantenimientos en paralelo
              const maintenancePromises = itemsToLoad.map(async (item, index) => {
                const maintenanceId = item.maintenanceId || item.id;
                try {
                  const fullMaintenanceData = await fetchMaintenanceDetails(maintenanceId);
                  return {
                    index,
                    maintenanceId,
                    data: fullMaintenanceData || item
                  };
                } catch (error) {
                  console.error(`Error cargando mantenimiento ${maintenanceId}:`, error);
                  return {
                    index,
                    maintenanceId,
                    data: item // Fallback a datos básicos
                  };
                }
              });
              
              // Esperar todas las cargas en paralelo
              const results = await Promise.all(maintenancePromises);
              
              // Actualizar items con datos completos
              setMaintenanceItems(prevItems => {
                const updatedItems = [...prevItems];
                results.forEach(({ index, data }) => {
                  if (updatedItems[index]) {
                    updatedItems[index] = {
                      ...updatedItems[index],
                      maintenanceData: data,
                      currentKilometers: data?.unidadMovil?.kilometraje || updatedItems[index].currentKilometers || 0
                    };
                  }
                });
                return updatedItems;
              });
            } catch (error) {
              console.error('Error cargando mantenimientos:', error);
            }
          };
          
          // Cargar en segundo plano sin bloquear
          loadMaintenanceItems();
        } else {
          // Si no hay items, aún así cargar instructivos si existen
          if (checklist.instructives && Array.isArray(checklist.instructives) && checklist.instructives.length > 0) {
            setChecklistInstructives(checklist.instructives);
          } else {
            setChecklistInstructives([]);
          }
        }
      }
    }
  }, [isOpen, checklist]);

  // Detectar vista móvil y seleccionar primer ítem abierto
  useEffect(() => {
    const handleResize = () => setIsMobile(typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false);
    handleResize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleCloseWithAutoSave}>
      <DialogContent size="xl" className="h-[100dvh] md:h-auto md:max-h-[95vh] overflow-hidden p-0 md:p-6 flex flex-col rounded-none md:rounded-lg">
        {/* Header - Solo visible en desktop */}
        <DialogHeader className="hidden md:block space-y-2 md:space-y-3 px-4 pt-4 md:px-0 md:pt-0 flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <DialogTitle className="flex flex-col sm:flex-row sm:items-center gap-2 text-base md:text-lg leading-tight flex-1">
              <FileText className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
              <span className="break-words whitespace-normal min-w-0">
              {loadedChecklist?.title || checklist?.title || 'Checklist'}
              </span>
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs md:text-sm break-words whitespace-normal leading-relaxed sr-only">
            Ejecutar mantenimientos del checklist
          </DialogDescription>
        </DialogHeader>

        {/* ============= BARRA DE PROGRESO (MÓVIL: COMPACTA, DESKTOP: CON TIMER) ============= */}
        {maintenanceItems.length > 0 && (
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b px-3 py-2 md:px-4 md:py-3 md:rounded-lg md:border md:mx-0 flex-shrink-0">
            <div className="flex items-center gap-3">
              {/* Timer - Solo desktop */}
              <div className="hidden md:flex items-center gap-3">
                <div className={`p-2 rounded-full ${executionStartTime ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <Timer className={`h-5 w-5 ${executionStartTime ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tiempo</p>
                  <p className={`text-xl font-mono font-bold ${!isExecutionPaused ? 'text-green-600' : 'text-gray-600'}`}>
                    {formatElapsedTime(elapsedSeconds)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setIsExecutionPaused(!isExecutionPaused)}
                >
                  {isExecutionPaused ? (
                    <Play className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Pause className="h-3.5 w-3.5 text-orange-500" />
                  )}
                </Button>
              </div>

              {/* Progreso - Siempre visible, compacto en móvil */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{progressData.completed}/{progressData.total}</span>
                  <span className="text-xs font-bold text-primary">{progressData.percentage}%</span>
                </div>
                <Progress value={progressData.percentage} className="h-2" />
              </div>

              {/* Auto-guardado indicator - Solo desktop */}
              {lastAutoSave && (
                <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Save className="h-3 w-3" />
                  <span>Guardado: {format(lastAutoSave, 'HH:mm')}</span>
                </div>
              )}

              {/* Botón ejecución masiva */}
              {progressData.completed < progressData.total && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 md:h-8 text-xs border-amber-400 text-amber-700 hover:bg-amber-50 px-2 md:px-3"
                  onClick={() => setIsMassAssignOpen(true)}
                >
                  Ejecución masiva
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Información del activo seleccionado */}
        {selectedAsset && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 md:p-3 bg-muted/50 rounded-lg mx-4 md:mx-0 flex-shrink-0">
            <span className="text-xs md:text-sm font-medium whitespace-nowrap">Ejecutando para:</span>
            <Badge variant="outline" className="text-xs md:text-sm break-words">
              {selectedAsset.type === 'unidad-movil' ? '🚗' : '⚙️'} {selectedAsset.name}
            </Badge>
          </div>
        )}

        {/* ============= VISTA SWIPE CARDS - SOLO MÓVIL ============= */}
        {isMobile && maintenanceItems.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Selector de tarea */}
            <div className="flex-shrink-0 border-b bg-muted/30 px-3 py-2">
              <Select
                value={currentCardIndex.toString()}
                onValueChange={(val) => setCurrentCardIndex(parseInt(val))}
              >
                <SelectTrigger className="w-full h-10 text-sm">
                  <SelectValue placeholder="Seleccionar tarea..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {filteredItems.map((item, idx) => {
                    const isCompleted = !!item.completedDate;
                    const isRescheduled = !!item.rescheduleDate && !item.completedDate;
                    const statusIcon = isCompleted ? '✅' : isRescheduled ? '🟡' : '⬜';
                    const title = item.maintenanceData?.title || `Tarea ${idx + 1}`;
                    return (
                      <SelectItem key={item.id} value={idx.toString()} className="text-sm py-2">
                        <span className="flex items-center gap-2">
                          <span>{statusIcon}</span>
                          <span className="truncate">{idx + 1}. {title.length > 35 ? title.substring(0, 35) + '...' : title}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Card actual con swipe - Carrusel */}
            <div
              ref={cardContainerRef}
              className="flex-1 overflow-hidden relative"
              onTouchStart={(e) => {
                setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
                setTouchDelta(0);
                setIsDragging(true);
              }}
              onTouchMove={(e) => {
                if (!touchStart) return;
                const deltaX = e.touches[0].clientX - touchStart.x;
                const deltaY = Math.abs(e.touches[0].clientY - touchStart.y);
                // Solo swipe horizontal si el movimiento es más horizontal que vertical
                if (Math.abs(deltaX) > deltaY) {
                  e.preventDefault();
                  setTouchDelta(deltaX);
                }
              }}
              onTouchEnd={() => {
                const isValidSwipe = Math.abs(touchDelta) > 80;
                const canGoNext = touchDelta < 0 && currentCardIndex < filteredItems.length - 1;
                const canGoPrev = touchDelta > 0 && currentCardIndex > 0;

                if (isValidSwipe) {
                  if (canGoNext) {
                    setCurrentCardIndex(prev => prev + 1);
                  } else if (canGoPrev) {
                    setCurrentCardIndex(prev => prev - 1);
                  }
                }

                setTouchStart(null);
                setTouchDelta(0);
                setIsDragging(false);
              }}
            >
              {/* Contenedor del carrusel con todas las cards */}
              <div
                className="absolute inset-0 flex"
                style={{
                  transform: `translateX(calc(-${currentCardIndex * 100}% + ${touchDelta}px))`,
                  transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
                }}
              >
                {filteredItems.map((item, idx) => {
                  const isCompleted = !!item.completedDate;
                  const isRescheduled = !!item.rescheduleDate && !item.completedDate;
                  const photos = itemPhotos[item.id] || [];

                  return (
                    <div
                      key={item.id}
                      className="w-full flex-shrink-0 p-3 overflow-y-auto"
                      style={{ minWidth: '100%' }}
                    >
                      <Card className={`${isCompleted ? 'border-green-300 bg-green-50/50' : isRescheduled ? 'border-yellow-300 bg-yellow-50/50' : ''}`}>
                      <CardHeader className="p-3 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-semibold leading-tight break-words">
                              {item.maintenanceData?.title || `Item ${idx + 1}`}
                            </CardTitle>
                            {(item.maintenanceData?.machineName || item.maintenanceData?.componentNames) && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {[
                                  item.maintenanceData?.machineName,
                                  Array.isArray(item.maintenanceData?.componentNames)
                                    ? item.maintenanceData?.componentNames.join(', ')
                                    : item.maintenanceData?.componentNames
                                ].filter(Boolean).join(' › ')}
                              </p>
                            )}
                          </div>
                          <Badge className={isCompleted ? 'bg-green-600' : isRescheduled ? 'bg-yellow-600' : 'bg-gray-500'}>
                            {isCompleted ? 'Realizado' : isRescheduled ? 'Reprogramado' : 'Pendiente'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 pt-0 space-y-2.5">
                        {/* Calcular sets globales UNA VEZ para este item */}
                        {(() => {
                          // Recolectar TODOS los ejecutores y supervisores de TODOS los items
                          const allGlobalExecutors = new Set<string>();
                          const allGlobalSupervisors = new Set<string>();
                          maintenanceItems.forEach(mi => {
                            (mi.executors || []).forEach((n: string) => { if (n) allGlobalExecutors.add(n); });
                            (mi.supervisors || []).forEach((n: string) => { if (n) allGlobalSupervisors.add(n); });
                          });

                          // Verificar si el item actual tiene supervisor y responsable (para validación de fecha)
                          const currentHasSupervisor = item.supervisors && item.supervisors.length > 0;
                          const currentHasExecutor = item.executors && item.executors.length > 0;
                          const canSetCompletedDate = currentHasSupervisor && currentHasExecutor;

                          return (
                            <>
                              {/* Supervisor - PRIMERO */}
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Supervisor</label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full h-9 justify-between text-xs mt-1">
                                      {item.supervisors?.length ? `${item.supervisors.length} seleccionado(s)` : 'Seleccionar...'}
                                      <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-72 p-2" align="start">
                                    <div className="space-y-1 max-h-48 overflow-y-auto">
                                      {employees.map(emp => {
                                        const isSelected = item.supervisors?.includes(emp.name);
                                        // Verificar si es ejecutor en CUALQUIER item (regla global: 1 rol por persona)
                                        const isExecutorGlobal = allGlobalExecutors.has(emp.name);
                                        // También verificar si ya es supervisor en OTRO item (pero permitir en el actual)
                                        const isBlocked = isExecutorGlobal;
                                        return (
                                          <div
                                            key={emp.id}
                                            className={`flex items-center gap-2 p-2 rounded ${isBlocked && !isSelected ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-muted'} ${isSelected ? 'bg-primary/10' : ''}`}
                                            onClick={() => {
                                              if (isBlocked && !isSelected) {
                                                toast({ title: 'No permitido', description: 'Esta persona ya es responsable. Solo puede tener 1 rol en el checklist.', variant: 'destructive' });
                                                return;
                                              }
                                              setMaintenanceItems(prev => prev.map(mi => {
                                                if (mi.id !== item.id) return mi;
                                                const existing = mi.supervisors || [];
                                                if (isSelected) {
                                                  // Si quita supervisor y tiene fecha completado, limpiar fecha
                                                  const newSupervisors = existing.filter(n => n !== emp.name);
                                                  if (newSupervisors.length === 0 && mi.completedDate) {
                                                    toast({ title: 'Fecha eliminada', description: 'Se quitó la fecha porque no hay supervisor', variant: 'default' });
                                                    return { ...mi, supervisors: newSupervisors, completedDate: '' };
                                                  }
                                                  return { ...mi, supervisors: newSupervisors };
                                                } else {
                                                  return { ...mi, supervisors: [...existing, emp.name] };
                                                }
                                              }));
                                            }}
                                          >
                                            <Checkbox checked={isSelected} disabled={isBlocked && !isSelected} />
                                            <span className="text-xs">{emp.name}</span>
                                            {isBlocked && !isSelected && <span className="text-[9px] text-orange-500 ml-auto">(Es responsable)</span>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                                {item.supervisors && item.supervisors.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.supervisors.map((name, i) => (
                                      <Badge key={i} variant="outline" className="text-[10px] gap-1 pr-1">
                                        {name}
                                        <button onClick={() => setMaintenanceItems(prev => prev.map(mi => {
                                          if (mi.id !== item.id) return mi;
                                          const newSupervisors = mi.supervisors?.filter((_, idx) => idx !== i) || [];
                                          // Si quita el último supervisor, limpiar fechas
                                          if (newSupervisors.length === 0) {
                                            const updates: Partial<MaintenanceItem> = { supervisors: newSupervisors };
                                            if (mi.completedDate) {
                                              toast({ title: 'Fecha eliminada', description: 'Se quitó la fecha de realizado porque no hay supervisor', variant: 'default' });
                                              updates.completedDate = '';
                                            }
                                            if (mi.rescheduleDate) {
                                              toast({ title: 'Fecha eliminada', description: 'Se quitó la fecha de reprogramar porque no hay supervisor', variant: 'default' });
                                              updates.rescheduleDate = '';
                                            }
                                            return { ...mi, ...updates };
                                          }
                                          return { ...mi, supervisors: newSupervisors };
                                        }))} className="hover:bg-muted rounded-full">
                                          <X className="h-2.5 w-2.5" />
                                        </button>
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Responsable - SEGUNDO */}
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Responsable</label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full h-9 justify-between text-xs mt-1">
                                      {item.executors?.length ? `${item.executors.length} seleccionado(s)` : 'Seleccionar...'}
                                      <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-72 p-2" align="start">
                                    <div className="space-y-1 max-h-48 overflow-y-auto">
                                      {employees.map(emp => {
                                        const isSelected = item.executors?.includes(emp.name);
                                        // Verificar si es supervisor en CUALQUIER item (regla global: 1 rol por persona)
                                        const isSupervisorGlobal = allGlobalSupervisors.has(emp.name);
                                        const isBlocked = isSupervisorGlobal;
                                        return (
                                          <div
                                            key={emp.id}
                                            className={`flex items-center gap-2 p-2 rounded ${isBlocked && !isSelected ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-muted'} ${isSelected ? 'bg-primary/10' : ''}`}
                                            onClick={() => {
                                              if (isBlocked && !isSelected) {
                                                toast({ title: 'No permitido', description: 'Esta persona ya es supervisor. Solo puede tener 1 rol en el checklist.', variant: 'destructive' });
                                                return;
                                              }
                                              setMaintenanceItems(prev => prev.map(mi => {
                                                if (mi.id !== item.id) return mi;
                                                const existingExec = mi.executors || [];
                                                const existingResp = mi.responsables || [];
                                                if (isSelected) {
                                                  // Si quita responsable y tiene fecha completado, limpiar fecha
                                                  const newExecutors = existingExec.filter(n => n !== emp.name);
                                                  const newResponsables = existingResp.filter(n => n !== emp.name);
                                                  if (newExecutors.length === 0 && mi.completedDate) {
                                                    toast({ title: 'Fecha eliminada', description: 'Se quitó la fecha porque no hay responsable', variant: 'default' });
                                                    return { ...mi, executors: newExecutors, responsables: newResponsables, completedDate: '' };
                                                  }
                                                  return { ...mi, executors: newExecutors, responsables: newResponsables };
                                                } else {
                                                  // Agregar a ambos campos para mantener sincronizados
                                                  return { ...mi, executors: [...existingExec, emp.name], responsables: [...existingResp, emp.name] };
                                                }
                                              }));
                                            }}
                                          >
                                            <Checkbox checked={isSelected} disabled={isBlocked && !isSelected} />
                                            <span className="text-xs">{emp.name}</span>
                                            {isBlocked && !isSelected && <span className="text-[9px] text-blue-500 ml-auto">(Es supervisor)</span>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                                {item.executors && item.executors.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.executors.map((name, i) => (
                                      <Badge key={i} variant="secondary" className="text-[10px] gap-1 pr-1">
                                        {name}
                                        <button onClick={() => setMaintenanceItems(prev => prev.map(mi => {
                                          if (mi.id !== item.id) return mi;
                                          const newExecutors = mi.executors?.filter((_, idx) => idx !== i) || [];
                                          const newResponsables = mi.responsables?.filter(n => n !== name) || [];
                                          // Si quita el último responsable y tiene fecha, limpiar fecha
                                          if (newExecutors.length === 0 && mi.completedDate) {
                                            toast({ title: 'Fecha eliminada', description: 'Se quitó la fecha porque no hay responsable', variant: 'default' });
                                            return { ...mi, executors: newExecutors, responsables: newResponsables, completedDate: '' };
                                          }
                                          return { ...mi, executors: newExecutors, responsables: newResponsables };
                                        }))} className="hover:bg-muted rounded-full">
                                          <X className="h-2.5 w-2.5" />
                                        </button>
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Fechas */}
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground">Fecha Realizado</label>
                                  <DatePicker
                                    value={item.completedDate ? (() => {
                                      const parts = item.completedDate.split('/');
                                      return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : '';
                                    })() : ''}
                                    onChange={(date) => {
                                      if (date) {
                                        // Validar que tenga supervisor Y responsable
                                        if (!canSetCompletedDate) {
                                          toast({
                                            title: 'Faltan datos',
                                            description: 'Debe asignar supervisor Y responsable antes de marcar como realizado',
                                            variant: 'destructive'
                                          });
                                          return;
                                        }
                                        // Convertir yyyy-MM-dd a dd/MM/yyyy sin problemas de timezone
                                        const [year, month, day] = date.split('-');
                                        const formatted = `${day}/${month}/${year}`;
                                        setMaintenanceItems(prev => prev.map(mi => mi.id !== item.id ? mi : { ...mi, completedDate: formatted, rescheduleDate: '' }));
                                      } else {
                                        setMaintenanceItems(prev => prev.map(mi => mi.id !== item.id ? mi : { ...mi, completedDate: '' }));
                                      }
                                    }}
                                    placeholder={canSetCompletedDate ? "Seleccionar" : "Asignar sup/resp primero"}
                                    disabled={!canSetCompletedDate && !item.completedDate}
                                    className="h-8 text-xs mt-1"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground">Reprogramar</label>
                                  <DatePicker
                                    value={item.rescheduleDate ? (() => {
                                      const parts = item.rescheduleDate.split('/');
                                      return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : '';
                                    })() : ''}
                                    onChange={(date) => {
                                      if (date) {
                                        // Validar que tenga supervisor antes de reprogramar
                                        if (!currentHasSupervisor) {
                                          toast({
                                            title: 'Supervisor requerido',
                                            description: 'Debe asignar un supervisor antes de reprogramar',
                                            variant: 'destructive'
                                          });
                                          return;
                                        }
                                        // Convertir yyyy-MM-dd a dd/MM/yyyy sin problemas de timezone
                                        const [year, month, day] = date.split('-');
                                        const formatted = `${day}/${month}/${year}`;
                                        setMaintenanceItems(prev => prev.map(mi => mi.id !== item.id ? mi : { ...mi, rescheduleDate: formatted, completedDate: '' }));
                                      } else {
                                        setMaintenanceItems(prev => prev.map(mi => mi.id !== item.id ? mi : { ...mi, rescheduleDate: '' }));
                                      }
                                    }}
                                    placeholder={currentHasSupervisor ? "Seleccionar" : "Asignar supervisor primero"}
                                    disabled={!currentHasSupervisor && !item.rescheduleDate}
                                    className="h-8 text-xs mt-1"
                                  />
                                </div>
                              </div>

                              {/* Notas con respuestas rápidas */}
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Notas</label>
                                <div className="flex flex-wrap gap-1 mt-1 mb-1">
                                  {['Sin novedad', 'OK', 'Verificado'].map(resp => (
                                    <Button
                                      key={resp}
                                      variant="outline"
                                      size="sm"
                                      className="h-6 text-[10px] px-2"
                                      onClick={() => setMaintenanceItems(prev => prev.map(mi => mi.id !== item.id ? mi : { ...mi, notes: resp }))}
                                    >
                                      {resp}
                                    </Button>
                                  ))}
                                </div>
                                <Textarea
                                  value={item.notes || ''}
                                  onChange={(e) => setMaintenanceItems(prev => prev.map(mi => mi.id !== item.id ? mi : { ...mi, notes: e.target.value }))}
                                  placeholder="Observaciones..."
                                  className="h-14 text-xs resize-none"
                                />
                              </div>

                              {/* Inconvenientes con respuestas rápidas */}
                              <div>
                                <label className="text-xs font-medium text-orange-600">Inconvenientes</label>
                                <div className="flex flex-wrap gap-1 mt-1 mb-1">
                                  {['Falta repuesto', 'Requiere revisión', 'Desgaste'].map(resp => (
                                    <Button
                                      key={resp}
                                      variant="outline"
                                      size="sm"
                                      className="h-6 text-[10px] px-2 border-orange-200 text-orange-700"
                                      onClick={() => setMaintenanceItems(prev => prev.map(mi => mi.id !== item.id ? mi : { ...mi, issues: (mi.issues ? mi.issues + ', ' : '') + resp }))}
                                    >
                                      {resp}
                                    </Button>
                                  ))}
                                </div>
                                <Textarea
                                  value={item.issues || ''}
                                  onChange={(e) => setMaintenanceItems(prev => prev.map(mi => mi.id !== item.id ? mi : { ...mi, issues: e.target.value }))}
                                  placeholder="Problemas encontrados..."
                                  className="h-14 text-xs resize-none border-orange-200"
                                />
                              </div>

                              {/* Fotos */}
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Fotos</label>
                                <div className="flex gap-2 mt-1 flex-wrap">
                                  {photos.map((photo, idx) => (
                                    <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border">
                                      <img src={photo.preview} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                                      <button
                                        onClick={() => handleRemovePhoto(item.id, idx)}
                                        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5"
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  ))}
                                  <label className="w-14 h-14 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:bg-muted/50">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      capture="environment"
                                      className="hidden"
                                      onChange={(e) => handleAddPhoto(item.id, e)}
                                    />
                                    <Camera className="h-5 w-5 text-muted-foreground" />
                                  </label>
                                </div>
                              </div>

                              {/* Navegación */}
                              <div className="flex justify-between items-center pt-2 border-t">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCurrentCardIndex(prev => Math.max(0, prev - 1))}
                                  disabled={currentCardIndex === 0}
                                  className="text-xs"
                                >
                                  ← Anterior
                                </Button>
                                <span className="text-xs text-muted-foreground">
                                  {currentCardIndex + 1} / {filteredItems.length}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCurrentCardIndex(prev => Math.min(filteredItems.length - 1, prev + 1))}
                                  disabled={currentCardIndex === filteredItems.length - 1}
                                  className="text-xs"
                                >
                                  Siguiente →
                                </Button>
                              </div>
                            </>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
              </div>
            </div>

            {/* Botones de acción */}
            {progressData.total > 0 && (
              <div className="flex-shrink-0 px-3 py-2 border-t bg-background space-y-2">
                {/* Botón Ejecución masiva - SIEMPRE visible */}
                <Button
                  variant="outline"
                  className="w-full h-8 text-xs"
                  onClick={() => setIsMassAssignOpen(true)}
                >
                  Ejecución masiva
                </Button>

                {/* Botón principal según estado */}
                {(() => {
                  // Recolectar todas las personas asignadas (solo executors, ya no usamos responsables)
                  const allExecutors: string[] = [];
                  const allSupervisors: string[] = [];
                  maintenanceItems.forEach(mi => {
                    (mi.executors || []).forEach((n: string) => { if (n && !allExecutors.includes(n)) allExecutors.push(n); });
                    (mi.supervisors || []).forEach((n: string) => { if (n && !allSupervisors.includes(n)) allSupervisors.push(n); });
                  });

                  const execSinFirma = allExecutors.filter(n => !executorSignatures[n] || executorSignatures[n].length < 100);
                  const supSinFirma = allSupervisors.filter(n => !supervisorSignatures[n] || supervisorSignatures[n].length < 100);
                  const totalSinFirma = execSinFirma.length + supSinFirma.length;
                  const allCompleted = progressData.completed === progressData.total;

                  // Validar requisitos para finalizar
                  const itemsFaltantes: string[] = [];
                  maintenanceItems.forEach(mi => {
                    const taskName = mi.maintenanceData?.title || `ID ${mi.maintenanceId}`;
                    const hasSupervisor = (mi.supervisors || []).length > 0;
                    const hasExecutor = (mi.executors || []).length > 0;
                    const hasCompletedDate = mi.completedDate && mi.completedDate.length > 0;
                    const hasRescheduleDate = mi.rescheduleDate && mi.rescheduleDate.length > 0;
                    const hasNotes = mi.notes && mi.notes.trim().length > 0;
                    const hasIssues = mi.issues && mi.issues.trim().length > 0;

                    const faltantes: string[] = [];

                    // Si solo tiene supervisor (sin responsable), solo puede reprogramar
                    if (hasSupervisor && !hasExecutor) {
                      if (!hasRescheduleDate) faltantes.push('fecha de reprogramación');
                    } else {
                      // Si tiene ambos o ninguno, necesita fecha realizado o reprogramado
                      if (!hasCompletedDate && !hasRescheduleDate) faltantes.push('fecha realizado/reprogramado');
                      if (!hasSupervisor) faltantes.push('supervisor');
                      if (!hasExecutor) faltantes.push('responsable');
                    }

                    if (!hasNotes) faltantes.push('notas');
                    if (!hasIssues) faltantes.push('inconvenientes');

                    if (faltantes.length > 0) {
                      itemsFaltantes.push(`${taskName}: ${faltantes.join(', ')}`);
                    }
                  });

                  const canFinalize = itemsFaltantes.length === 0;

                  if (!allCompleted) {
                    return (
                      <Button variant="secondary" className="w-full h-9 text-sm" onClick={() => handleSubmit(false)}>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar progreso
                      </Button>
                    );
                  }

                  if (totalSinFirma > 0) {
                    return (
                      <Button
                        className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-sm"
                        onClick={() => {
                          if (execSinFirma.length > 0) {
                            setSignatureModal({ open: true, role: 'executors', name: execSinFirma[0] });
                          } else {
                            setSignatureModal({ open: true, role: 'supervisors', name: supSinFirma[0] });
                          }
                        }}
                      >
                        <Edit3 className="h-4 w-4 mr-2" />
                        Cargar firmas ({totalSinFirma})
                      </Button>
                    );
                  }

                  if (!canFinalize) {
                    return (
                      <Button
                        className="w-full h-9 bg-yellow-600 hover:bg-yellow-700 text-sm"
                        onClick={() => {
                          toast({
                            title: `Faltan datos en ${itemsFaltantes.length} tarea(s)`,
                            description: itemsFaltantes.slice(0, 3).join('\n') + (itemsFaltantes.length > 3 ? `\n...y ${itemsFaltantes.length - 3} más` : ''),
                            variant: 'destructive',
                            duration: 5000
                          });
                        }}
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Faltan datos ({itemsFaltantes.length})
                      </Button>
                    );
                  }

                  return (
                    <Button className="w-full h-9 bg-green-600 hover:bg-green-700 text-sm" onClick={() => handleSubmit(true)}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Finalizar Checklist
                    </Button>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ============= VISTA DESKTOP (OCULTA EN MÓVIL) ============= */}
        <div className={`flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-0 min-h-0 ${isMobile && maintenanceItems.length > 0 ? 'hidden' : ''}`}>
          <div className="space-y-3 md:space-y-4 pb-4">

          {/* ============= FILTRO Y BÚSQUEDA DE ITEMS ============= */}
          {maintenanceItems.length > 3 && (
            <div className="flex flex-col md:flex-row gap-2 p-2 md:p-3 bg-muted/30 rounded-lg">
              {/* Búsqueda */}
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar item..."
                  className="pl-8 h-9 text-sm"
                  value={itemSearchTerm}
                  onChange={(e) => setItemSearchTerm(e.target.value)}
                />
              </div>

              {/* Filtro por estado */}
              <div className="flex gap-1">
                <Button
                  variant={showCompletedOnly === 'all' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-9 flex-1 md:flex-none"
                  onClick={() => setShowCompletedOnly('all')}
                >
                  Todos ({maintenanceItems.length})
                </Button>
                <Button
                  variant={showCompletedOnly === 'pending' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-9 flex-1 md:flex-none"
                  onClick={() => setShowCompletedOnly('pending')}
                >
                  Pendientes ({progressData.total - progressData.completed})
                </Button>
                <Button
                  variant={showCompletedOnly === 'completed' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-9 flex-1 md:flex-none"
                  onClick={() => setShowCompletedOnly('completed')}
                >
                  Hechos ({progressData.completed})
                </Button>
              </div>
            </div>
          )}

          {/* Botones para ejecución masiva e instructivos */}
          <div className="flex justify-end gap-2 w-full">
            {(checklistInstructives.length > 0 || (loadedChecklist?.instructives && loadedChecklist.instructives.length > 0) || (checklist?.instructives && checklist.instructives.length > 0)) && (
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="text-xs md:text-sm whitespace-nowrap"
                onClick={async () => {
                  // Cargar instructivos si no están cargados
                  let instructivesToShow = checklistInstructives.length > 0 
                    ? checklistInstructives 
                    : (loadedChecklist?.instructives || checklist?.instructives || []);
                  
                  // Si aún no hay instructivos, intentar cargarlos desde el backend
                  if (instructivesToShow.length === 0) {
                    const checklistIdToLoad = loadedChecklist?.id || checklist?.id;
                    if (checklistIdToLoad) {
                      try {
                        const response = await fetch(`/api/maintenance/checklists/${checklistIdToLoad}`);
                        if (response.ok) {
                          const result = await response.json();
                          if (result.success && result.checklist?.instructives) {
                            instructivesToShow = result.checklist.instructives;
                          }
                        }
                      } catch (error) {
                        console.error('Error cargando instructivos:', error);
                      }
                    }
                  }
                  
                  if (instructivesToShow.length > 0) {
                    setChecklistInstructives(instructivesToShow);
                    setIsInstructivesModalOpen(true);
                    setSelectedInstructiveIndex(0);
                  } else {
                    toast({
                      title: 'Sin instructivos',
                      description: 'Este checklist no tiene instructivos disponibles',
                      variant: 'default'
                    });
                  }
                }}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Instructivo Checklist
              </Button>
            )}
            {maintenanceItems.length > 0 && (
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="text-xs md:text-sm whitespace-nowrap"
                onClick={() => {
                  setIsMassAssignOpen(true);
                  setMassAssignRole('executors');
                  setMassSelectedEmployee(null);
                  setMassSelectedItems({});
                  setMassTaskAssignments({});
                  setMassTaskEmployeeSearch({});
                  setMassTaskPopoverOpen({});
                  setAccumulatedAssignments({});
                  setMassTaskNotes({});
                  setMassTaskNotesPopoverOpen({});
                }}
              >
                Ejecución masiva
              </Button>
            )}
          </div>

          {/* Sección para cargar checklist por ID - Solo mostrar si no se pasa un checklist específico */}
          {!checklist && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cargar Checklist por ID</CardTitle>
              </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="ID del checklist (ej: 429)"
                  value={checklistId}
                  onChange={(e) => setChecklistId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleLoadChecklist();
                    }
                  }}
                  className="flex-1"
                />
                <Button 
                  onClick={handleLoadChecklist}
                  disabled={loadingChecklist || !checklistId}
                >
                  {loadingChecklist ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Cargar Checklist
                </Button>
              </div>
              {loadedChecklist && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Checklist cargado:</span>
                  </div>
                  <p className="text-green-700 mt-1">
                    {loadedChecklist.title} - {maintenanceItems.length} mantenimientos
                  </p>
                </div>
              )}
            </CardContent>
            </Card>
          )}


          {/* Tabla de mantenimientos */}
          {maintenanceItems.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader className="p-3 md:p-6">
                <CardTitle className="text-base md:text-lg break-words">
                  Mantenimientos {filteredItems.length !== maintenanceItems.length ? (
                    <span className="text-muted-foreground font-normal">
                      ({filteredItems.length} de {maintenanceItems.length})
                    </span>
                  ) : (
                    <span>({maintenanceItems.length})</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0">
                <div className="space-y-3 md:space-y-4">
                  {/* Estado vacío cuando el filtro no encuentra resultados */}
                  {filteredItems.length === 0 && maintenanceItems.length > 0 && (
                    <div className="text-center py-8 px-4">
                      <Search className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-sm text-muted-foreground mb-2">
                        No se encontraron items con ese criterio
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setItemSearchTerm('');
                          setShowCompletedOnly('all');
                        }}
                      >
                        Limpiar filtros
                      </Button>
                    </div>
                  )}

                  {filteredItems.map((item) => {
                    const isExpanded = !isMobile || openItemId === item.id;
                    const isItemCompleted = !!(item.completedDate || item.rescheduleDate);
                    return (
                    <div
                      key={item.id}
                      id={`item-${item.id}`}
                      ref={(el) => { itemRefs.current[item.id] = el; }}
                      className={`border rounded-lg p-3 md:p-4 space-y-3 md:space-y-4 overflow-hidden transition-all duration-300 ${isMobile ? 'cursor-pointer' : ''} ${isExpanded ? 'expanded' : ''} ${isItemCompleted ? 'bg-green-50/50 border-green-200' : ''}`}
                      onClick={() => {
                        if (isMobile) {
                          setOpenItemId(prev => prev === item.id ? null : item.id);
                        }
                      }}
                    >
                      {/* Información del mantenimiento */}
                      <div className="flex justify-between items-start gap-2 min-w-0">
                        <div className="flex-1 min-w-0">
                          {isMobile && !isExpanded ? (
                            <div className="flex flex-col gap-1.5 cursor-pointer w-full min-w-0">
                              <h4 className="font-semibold text-sm leading-tight md:text-lg break-words min-w-0">{item.maintenanceData.title}</h4>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                                {item.maintenanceData?.nextMaintenanceDate && (
                                  <span className="whitespace-nowrap">Próx: {format(new Date(item.maintenanceData.nextMaintenanceDate), 'dd/MM/yyyy')}</span>
                                )}
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-xxs shrink-0">ID: {item.maintenanceId}</Badge>
                                  {item.maintenanceId && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 w-5 p-0 hover:bg-blue-100"
                                      onClick={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        try {
                                          const maintenanceData = await fetchMaintenanceDetails(item.maintenanceId);
                                          if (maintenanceData) {
                                            setSelectedMaintenanceForDetail(maintenanceData);
                                            setIsMaintenanceDetailOpen(true);
                                          } else {
                                            toast({
                                              title: 'Error',
                                              description: 'No se pudo cargar el detalle del mantenimiento',
                                              variant: 'destructive'
                                            });
                                          }
                                        } catch (error) {
                                          console.error('Error loading maintenance detail:', error);
                                          toast({
                                            title: 'Error',
                                            description: 'No se pudo cargar el detalle del mantenimiento',
                                            variant: 'destructive'
                                          });
                                        }
                                      }}
                                      title="Ver detalles del mantenimiento"
                                    >
                                      <Info className="h-3 w-3 text-blue-600" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              {isMobile ? (
                                <div className="mb-2 min-w-0">
                                  <h4 className="font-semibold text-base leading-snug md:text-lg break-words min-w-0">{item.maintenanceData.title}</h4>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                                    <div className="flex items-center gap-1">
                                      <Badge variant="outline" className="text-xxs shrink-0">ID: {item.maintenanceId || item.maintenanceData.id || item.maintenanceData.maintenanceId}</Badge>
                                      {(item.maintenanceId || item.maintenanceData.id || item.maintenanceData.maintenanceId) && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-0 hover:bg-blue-100"
                                          onClick={async (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const maintId = item.maintenanceId || item.maintenanceData.id || item.maintenanceData.maintenanceId;
                                            try {
                                              const maintenanceData = await fetchMaintenanceDetails(maintId);
                                              if (maintenanceData) {
                                                setSelectedMaintenanceForDetail(maintenanceData);
                                                setIsMaintenanceDetailOpen(true);
                                              } else {
                                                toast({
                                                  title: 'Error',
                                                  description: 'No se pudo cargar el detalle del mantenimiento',
                                                  variant: 'destructive'
                                                });
                                              }
                                            } catch (error) {
                                              console.error('Error loading maintenance detail:', error);
                                              toast({
                                                title: 'Error',
                                                description: 'No se pudo cargar el detalle del mantenimiento',
                                                variant: 'destructive'
                                              });
                                            }
                                          }}
                                          title="Ver detalles del mantenimiento"
                                        >
                                          <Info className="h-3 w-3 text-blue-600" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                          <div className="flex flex-wrap items-center gap-2 mb-2 min-w-0">
                            <h4 className="font-semibold text-lg break-words min-w-0">{item.maintenanceData.title}</h4>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs shrink-0">ID: {item.maintenanceId || item.maintenanceData.id || item.maintenanceData.maintenanceId}</Badge>
                              {(item.maintenanceId || item.maintenanceData.id || item.maintenanceData.maintenanceId) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-blue-100"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const maintId = item.maintenanceId || item.maintenanceData.id || item.maintenanceData.maintenanceId;
                                    try {
                                      const maintenanceData = await fetchMaintenanceDetails(maintId);
                                      if (maintenanceData) {
                                        setSelectedMaintenanceForDetail(maintenanceData);
                                        setIsMaintenanceDetailOpen(true);
                                      } else {
                                        toast({
                                          title: 'Error',
                                          description: 'No se pudo cargar el detalle del mantenimiento',
                                          variant: 'destructive'
                                        });
                                      }
                                    } catch (error) {
                                      console.error('Error loading maintenance detail:', error);
                                      toast({
                                        title: 'Error',
                                        description: 'No se pudo cargar el detalle del mantenimiento',
                                        variant: 'destructive'
                                      });
                                    }
                                  }}
                                  title="Ver detalles del mantenimiento"
                                >
                                  <Info className="h-4 w-4 text-blue-600" />
                                </Button>
                              )}
                            </div>
                          </div>
                              )}
                          <div className="flex items-start gap-2 mb-2">
                            <p className="text-xs md:text-sm text-gray-600 break-words min-w-0 flex-1">{item.maintenanceData.description}</p>
                            {/* Botón leer en voz alta */}
                            {item.maintenanceData.description && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  speakText(`${item.maintenanceData.title}. ${item.maintenanceData.description}`);
                                }}
                                title="Leer instrucciones en voz alta"
                              >
                                <Volume2 className="h-4 w-4 text-blue-600" />
                              </Button>
                            )}
                          </div>

                          {/* Indicador de estado */}
                          {isItemCompleted && (
                            <div className="mb-2 flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-sm text-green-700">Completado: {item.completedDate}</span>
                            </div>
                          )}
                          <div className="mb-3 space-y-2">
                            {(() => {
                              const maintenanceStatus = calculateMaintenanceStatus(item.maintenanceData);
                              const getStatusColor = (status: string) => {
                                switch (status) {
                                  case 'completed': return 'bg-green-100 text-green-800 border-green-200';
                                  case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
                                  case 'not-due': return 'bg-blue-100 text-blue-800 border-blue-200';
                                  case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                                  case 'no-periodicity': return 'bg-gray-100 text-gray-800 border-gray-200';
                                  case 'periodic': return 'bg-blue-100 text-blue-800 border-blue-200';
                                  default: return 'bg-gray-100 text-gray-800 border-gray-200';
                                }
                              };
                              return (
                                <>
                                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(maintenanceStatus.status)}`}>
                                    {maintenanceStatus.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                                    {maintenanceStatus.status === 'overdue' && <AlertCircle className="h-3 w-3 mr-1" />}
                                    {maintenanceStatus.status === 'not-due' && <Calendar className="h-3 w-3 mr-1" />}
                                    {maintenanceStatus.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                                    {maintenanceStatus.message}
                                  </div>
                                  <div className="flex gap-4 text-xs text-gray-600">
                                    {item.maintenanceData?.lastMaintenanceDate && (
                                      <div className="flex items-center gap-1">
                                        <CheckCircle className="h-3 w-3 text-green-600" />
                                        <span>Último: {format(new Date(item.maintenanceData.lastMaintenanceDate), 'dd/MM/yyyy')}</span>
                                      </div>
                                    )}
                                    {item.maintenanceData?.nextMaintenanceDate && (
                                      <div className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3 text-blue-600" />
                                        <span>Próximo: {format(new Date(item.maintenanceData.nextMaintenanceDate), 'dd/MM/yyyy')}</span>
                                      </div>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                          <div className="flex gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <Badge variant="secondary">{item.maintenanceData.type === 'PREVENTIVE' ? 'Preventivo' : item.maintenanceData.type}</Badge>
                            </div>
                            {item.maintenanceData.unidadMovil && (
                              <div className="flex items-center gap-1">
                                <Gauge className="h-3 w-3" />
                                <span>{item.maintenanceData.unidadMovil.nombre}</span>
                              </div>
                            )}
                          </div>
                            </>
                          )}
                        </div>
                        {/* Right-side actions (oculto en móvil cuando expandido) */}
                        {!(isMobile && isExpanded) && (
                        <div className="md:pl-4 md:min-w-[220px] min-w-[40px] flex flex-col items-end gap-2 w-auto md:w-auto mt-2 md:mt-0 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {isMobile ? (
                            <Checkbox
                              checked={!!item.completedDate}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  const execOk = Array.isArray(item.executors) && item.executors.length > 0;
                                  const supOk = Array.isArray(item.supervisors) && item.supervisors.length > 0;
                                  if (!execOk || !supOk) {
                                    toast({
                                      title: 'Asignación requerida',
                                      description: 'Antes de marcar como completado, asigna al menos un Responsable y un Supervisor.',
                                      variant: 'destructive'
                                    });
                                    return;
                                  }
                                  setConfirmCompleteItemId(item.id);
                                } else {
                                  setConfirmUncompleteItemId(item.id);
                                }
                              }}
                            />
                          ) : (
                            <>
                              <label className="text-sm font-medium inline-flex items-center gap-2">
                                <Checkbox
                                  checked={!!item.completedDate}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      const execOk = Array.isArray(item.executors) && item.executors.length > 0;
                                      const supOk = Array.isArray(item.supervisors) && item.supervisors.length > 0;
                                      if (!execOk || !supOk) {
                                        toast({
                                          title: 'Asignación requerida',
                                          description: 'Antes de marcar como completado, asigna al menos un Responsable y un Supervisor.',
                                          variant: 'destructive'
                                        });
                                        return;
                                      }
                                      setConfirmCompleteItemId(item.id);
                                    } else {
                                      setConfirmUncompleteItemId(item.id);
                                    }
                                  }}
                                />
                                Marcar como completado
                              </label>
                              {item.completedDate && (
                                <Badge variant="outline" className="text-xs">
                                  Realizado: {formatDateForDisplay(item.completedDate)}
                                </Badge>
                              )}
                            </>
                          )}
                      </div>
                        )}
                      </div>
                      {isExpanded && (
                      <>
                      {/* Acciones debajo del título en móvil */}
                      {isMobile && (
                        <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                          <label className="text-sm font-medium inline-flex items-center gap-2">
                            <Checkbox
                              checked={!!item.completedDate}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  const execOk = Array.isArray(item.executors) && item.executors.length > 0;
                                  const supOk = Array.isArray(item.supervisors) && item.supervisors.length > 0;
                                  if (!execOk || !supOk) {
                                    toast({
                                      title: 'Asignación requerida',
                                      description: 'Antes de marcar como completado, asigna al menos un Responsable y un Supervisor.',
                                      variant: 'destructive'
                                    });
                                    return;
                                  }
                                  setConfirmCompleteItemId(item.id);
                                } else {
                                  setConfirmUncompleteItemId(item.id);
                                }
                              }}
                            />
                            Marcar como completado
                          </label>
                          {item.completedDate && (
                            <Badge variant="outline" className="text-xs mt-1">
                              Realizado: {formatDateForDisplay(item.completedDate)}
                            </Badge>
                          )}
                        </div>
                      )}
                      {/* Fechas */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3" onClick={(e) => e.stopPropagation()}>
                         <div className="space-y-2">
                           <label className="text-sm font-medium flex items-center gap-2">
                             <CheckCircle className="h-4 w-4 text-green-600" />
                            Fecha de realizado {item.completedDate ? <span className="text-red-600">*</span> : null}
                           </label>
                           <div id={`completedDateContainer-${item.id}`}>
                             <DatePicker
                               value={item.completedDate ? formatDateForInput(item.completedDate) : ''}
                               onChange={(date) => {
                                 const hasBoth = (item.executors && item.executors.length > 0) && (item.supervisors && item.supervisors.length > 0);
                                 if (!hasBoth) {
                                   toast({ title: 'Asignación requerida', description: 'Debes asignar Responsable y Supervisor antes de colocar fecha.', variant: 'destructive' });
                                   return;
                                 }
                                 const formattedDate = date ? formatDateFromInput(date) : '';
                                 handleItemChange(item.id, 'completedDate', formattedDate);
                                 if (formattedDate) {
                                   handleItemChange(item.id, 'rescheduleDate', '');
                                 }
                               }}
                               placeholder="dd/mm/aaaa"
                               disabled={!((item.executors && item.executors.length > 0) && (item.supervisors && item.supervisors.length > 0))}
                             />
                           </div>
                         </div>
                        
                         <div className="space-y-2">
                           <label className="text-sm font-medium flex items-center gap-2">
                             <Calendar className="h-4 w-4 text-orange-600" />
                             Fecha a reprogramar
                             {item.rescheduleDate && (!item.supervisors || item.supervisors.length === 0 || item.supervisors.every(s => !s.trim())) && (
                               <span className="text-red-600 text-xs font-normal">* Requiere Supervisor</span>
                             )}
                           </label>
                           <div id={`rescheduleDateContainer-${item.id}`}>
                             <DatePicker
                               value={item.rescheduleDate ? formatDateForInput(item.rescheduleDate) : ''}
                               onChange={(date) => {
                                 // Validar que tenga supervisor ANTES de permitir reprogramar
                                 const hasSupervisor = item.supervisors && item.supervisors.length > 0 && item.supervisors.some(s => s.trim() !== '');
                                 if (date && !hasSupervisor) {
                                   toast({
                                     title: "Supervisor requerido",
                                     description: "Debes asignar un Supervisor antes de reprogramar.",
                                     variant: "destructive"
                                   });
                                   return;
                                 }
                                 const formattedDate = date ? formatDateFromInput(date) : '';
                                 handleItemChange(item.id, 'rescheduleDate', formattedDate);
                                 if (formattedDate) {
                                   handleItemChange(item.id, 'completedDate', '');
                                 }
                               }}
                               placeholder={item.supervisors && item.supervisors.length > 0 ? "dd/mm/aaaa" : "Asignar supervisor primero"}
                               disabled={!(item.supervisors && item.supervisors.length > 0) && !item.rescheduleDate}
                             />
                           </div>
                         </div>
                      </div>

                      {/* Campos específicos para unidades móviles */}
                      {item.maintenanceData.unidadMovil && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                              <Gauge className="h-4 w-4" />
                              KM actuales
                            </label>
                            <Input
                              type="number"
                              placeholder="Kilometraje actual"
                              value={item.currentKilometers || ''}
                              onChange={(e) => handleItemChange(item.id, 'currentKilometers', parseInt(e.target.value) || 0)}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              Horas actuales
                            </label>
                            <Input
                              type="number"
                              placeholder="Horas actuales"
                              value={item.currentHours || ''}
                              onChange={(e) => handleItemChange(item.id, 'currentHours', parseInt(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                      )}

                      {/* Responsables y Supervisores por tarea */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Responsables</label>
                          <Popover open={executorPopoverOpen[item.id] || false} onOpenChange={(open) => setExecutorPopoverOpen(prev => ({ ...prev, [item.id]: open }))}>
                            <PopoverTrigger asChild>
                              <div id={`executors-${item.id}`} className="flex h-10 items-center rounded-md border border-input px-3 text-sm bg-background hover:bg-muted/50 cursor-pointer">
                                <span className="truncate">
                                  {(item.executors && item.executors.length > 0)
                                    ? item.executors.join(', ')
                                    : 'Seleccionar empleados...'}
                                </span>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-3 space-y-2" align="center" side="bottom" sideOffset={8}>
                              <Input placeholder="Buscar empleado..." value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} />
                              <div className="max-h-64 overflow-auto pr-1 space-y-1">
                                {employees.length === 0 && (
                                  <div className="text-xs text-muted-foreground py-2">No se encontraron empleados activos. Revise Administración → Empleados.</div>
                                )}
                                {employees
                                  .filter(e => e.name.toLowerCase().includes(employeeSearch.toLowerCase()))
                                  .map(emp => {
                                    const checked = (item.executors || []).includes(emp.name);
                                    return (
                                      <label key={emp.id} className="flex items-center gap-2 text-sm">
                                        <Checkbox checked={checked} onCheckedChange={(c) => {
                                          const current = new Set(item.executors || []);
                                          if (c) current.add(emp.name); else current.delete(emp.name);
                                          handleItemChange(item.id, 'executors', Array.from(current));
                                          // Cerrar popover en móvil al seleccionar
                                          if (isMobile) {
                                            setExecutorPopoverOpen(prev => ({ ...prev, [item.id]: false }));
                                          }
                                        }} />
                                        {emp.name}
                                      </label>
                                    );
                                  })}
                              </div>
                            </PopoverContent>
                          </Popover>
                          {(item.executors && item.executors.length > 0) && (
                            <div className="flex flex-wrap gap-2">
                              {item.executors.map(name => (
                                <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Supervisores</label>
                          <Popover open={supervisorPopoverOpen[item.id] || false} onOpenChange={(open) => setSupervisorPopoverOpen(prev => ({ ...prev, [item.id]: open }))}>
                            <PopoverTrigger asChild>
                              <div id={`supervisors-${item.id}`} className="flex h-10 items-center rounded-md border border-input px-3 text-sm bg-background hover:bg-muted/50 cursor-pointer">
                                <span className="truncate">
                                  {(item.supervisors && item.supervisors.length > 0)
                                    ? item.supervisors.join(', ')
                                    : 'Seleccionar empleados...'}
                                </span>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-3 space-y-2" align="center" side="bottom" sideOffset={8}>
                              <Input placeholder="Buscar empleado..." value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} />
                              <div className="max-h-64 overflow-auto pr-1 space-y-1">
                                {employees.length === 0 && (
                                  <div className="text-xs text-muted-foreground py-2">No se encontraron empleados activos. Revise Administración → Empleados.</div>
                                )}
                                {employees
                                  .filter(e => e.name.toLowerCase().includes(employeeSearch.toLowerCase()))
                                  .map(emp => {
                                    const checked = (item.supervisors || []).includes(emp.name);
                                    return (
                                      <label key={emp.id} className="flex items-center gap-2 text-sm">
                                        <Checkbox checked={checked} onCheckedChange={(c) => {
                                          const current = new Set(item.supervisors || []);
                                          if (c) current.add(emp.name); else current.delete(emp.name);
                                          handleItemChange(item.id, 'supervisors', Array.from(current));
                                          // Cerrar popover en móvil al seleccionar
                                          if (isMobile) {
                                            setSupervisorPopoverOpen(prev => ({ ...prev, [item.id]: false }));
                                          }
                                        }} />
                                        {emp.name}
                                      </label>
                                    );
                                  })}
                              </div>
                            </PopoverContent>
                          </Popover>
                          {(item.supervisors && item.supervisors.length > 0) && (
                            <div className="flex flex-wrap gap-2">
                              {item.supervisors.map(name => (
                                <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Campos de notas e inconvenientes */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-2">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Notas {item.completedDate ? <span className="text-red-600">*</span> : null}
                          </label>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button type="button" variant="secondary" size="sm">Respuestas rápidas</Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-2 space-y-2">
                                {getQuickNoteOptions(item.maintenanceData?.title).map((q) => (
                                  <label key={q} className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                      checked={item.quickNotesSelected?.includes(q) || false}
                                      onCheckedChange={(checked) => {
                                        const current = new Set(item.quickNotesSelected || []);
                                        if (checked) current.add(q); else current.delete(q);
                                        const arr = Array.from(current);
                                        handleItemChange(item.id, 'quickNotesSelected', arr);
                                        handleItemChange(item.id, 'notes', arr.join(', '));
                                      }}
                                    />
                                    {q}
                                  </label>
                                ))}
                              </PopoverContent>
                            </Popover>
                            {/* Botón de voz para dictar notas */}
                            <Button
                              type="button"
                              variant={isRecording && currentVoiceItemId === item.id && voiceField === 'notes' ? 'destructive' : 'outline'}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isRecording && currentVoiceItemId === item.id) {
                                  stopVoiceInput();
                                } else {
                                  startVoiceInput(item.id, 'notes');
                                }
                              }}
                              title={isRecording ? 'Detener grabación' : 'Dictar notas por voz'}
                            >
                              {isRecording && currentVoiceItemId === item.id && voiceField === 'notes' ? (
                                <><MicOff className="h-4 w-4 mr-1" />Detener</>
                              ) : (
                                <><Mic className="h-4 w-4 mr-1" />Dictar</>
                              )}
                            </Button>
                          </div>
                          <Textarea
                            id={`notes-${item.id}`}
                            placeholder="Notas sobre la ejecución..."
                            value={item.notes || ''}
                            onChange={(e) => handleItemChange(item.id, 'notes', e.target.value)}
                            rows={3}
                            className="text-xl md:text-sm min-h-[150px] md:min-h-[60px] p-4 md:p-2 leading-relaxed"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Inconvenientes {item.completedDate ? <span className="text-red-600">*</span> : null}
                          </label>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button type="button" variant="secondary" size="sm">Respuestas rápidas</Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-2 space-y-2">
                                {quickIssueOptions.map((q) => (
                                  <label key={q} className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                      checked={item.quickIssuesSelected?.includes(q) || false}
                                      onCheckedChange={(checked) => {
                                        const current = new Set(item.quickIssuesSelected || []);
                                        if (checked) current.add(q); else current.delete(q);
                                        const arr = Array.from(current);
                                        handleItemChange(item.id, 'quickIssuesSelected', arr);
                                        handleItemChange(item.id, 'issues', arr.join(', '));
                                      }}
                                    />
                                    {q}
                                  </label>
                                ))}
                              </PopoverContent>
                            </Popover>
                            {/* Botón de voz para dictar inconvenientes */}
                            <Button
                              type="button"
                              variant={isRecording && currentVoiceItemId === item.id && voiceField === 'issues' ? 'destructive' : 'outline'}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isRecording && currentVoiceItemId === item.id) {
                                  stopVoiceInput();
                                } else {
                                  startVoiceInput(item.id, 'issues');
                                }
                              }}
                              title={isRecording ? 'Detener grabación' : 'Dictar inconvenientes por voz'}
                            >
                              {isRecording && currentVoiceItemId === item.id && voiceField === 'issues' ? (
                                <><MicOff className="h-4 w-4 mr-1" />Detener</>
                              ) : (
                                <><Mic className="h-4 w-4 mr-1" />Dictar</>
                              )}
                            </Button>
                          </div>
                          <Textarea
                            id={`issues-${item.id}`}
                            placeholder="Problemas o inconvenientes encontrados..."
                            value={item.issues || ''}
                            onChange={(e) => handleItemChange(item.id, 'issues', e.target.value)}
                            rows={3}
                            className="text-xl md:text-sm min-h-[150px] md:min-h-[60px] p-4 md:p-2 leading-relaxed"
                          />
                        </div>

                        {/* Fotos del item */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <Camera className="h-4 w-4" />
                            Fotos / Evidencia
                          </label>

                          {/* Previews de fotos existentes */}
                          {(itemPhotos[item.id] || []).length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {(itemPhotos[item.id] || []).map((photo, idx) => (
                                <div key={idx} className="relative group">
                                  <img
                                    src={photo.preview}
                                    alt={`Foto ${idx + 1}`}
                                    className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg border"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemovePhoto(item.id, idx);
                                    }}
                                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity shadow-sm"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Botón para agregar foto */}
                          <div className="flex gap-2">
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => handleAddPhoto(item.id, e)}
                              />
                              <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-muted hover:bg-muted/80 rounded-lg border border-dashed border-muted-foreground/30 transition-colors">
                                <Camera className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Agregar foto</span>
                              </div>
                            </label>
                            {/* Botón para cámara en móvil */}
                            <label className="cursor-pointer md:hidden">
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => handleAddPhoto(item.id, e)}
                              />
                              <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg border border-primary/30 transition-colors">
                                <Camera className="h-4 w-4 text-primary" />
                                <span className="text-sm text-primary font-medium">Tomar foto</span>
                              </div>
                            </label>
                          </div>

                          {(itemPhotos[item.id] || []).length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {(itemPhotos[item.id] || []).length} foto(s) adjunta(s)
                            </p>
                          )}
                        </div>
                      </div>
                      </>
                      )}
                    </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Campos de fecha y hora de ejecución */}

          {/* Resumen por persona con firmas */}
          {maintenanceItems.length > 0 && (() => {
            const executorToTasks: Record<string, Array<{ id: number; title: string }>> = {};
            const supervisorToTasks: Record<string, Array<{ id: number; title: string }>> = {};
            maintenanceItems.forEach(mi => {
              (mi.executors || []).forEach(name => {
                if (!executorToTasks[name]) executorToTasks[name] = [];
                executorToTasks[name].push({ id: mi.maintenanceId, title: mi.maintenanceData?.title });
              });
              (mi.supervisors || []).forEach(name => {
                if (!supervisorToTasks[name]) supervisorToTasks[name] = [];
                supervisorToTasks[name].push({ id: mi.maintenanceId, title: mi.maintenanceData?.title });
              });
            });

            const executorNames = Object.keys(executorToTasks);
            const supervisorNames = Object.keys(supervisorToTasks);

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Responsables y Supervisores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8">
                  {/* Tabla Responsables */}
                  <div>
                    <h4 className="font-medium mb-2">Responsables</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-600">
                            <th className="py-2 pr-4">Empleado</th>
                            <th className="py-2 pr-4">Tareas realizadas</th>
                            <th className="py-2 pr-4 w-64">Firma</th>
                          </tr>
                        </thead>
                        <tbody>
                          {executorNames.length === 0 && (
                            <tr className="border-t"><td colSpan={3} className="py-3 text-muted-foreground">Sin responsables asignados</td></tr>
                          )}
                          {executorNames.map(name => (
                            <tr key={name} className="border-t align-top">
                              <td className="py-2 pr-4 whitespace-nowrap">{name}</td>
                              <td className="py-2 pr-4">
                                <ul className="list-disc pl-5 space-y-1">
                                  {executorToTasks[name].map(t => (
                                    <li key={t.id}>{t.title} <span className="text-xs text-muted-foreground">(ID {t.id})</span></li>
                                  ))}
                                </ul>
                              </td>
                              <td className="py-2 pr-4">
                                {executorSignatures[name] ? (
                                  <div className="flex items-center gap-2">
                                    <img src={executorSignatures[name]} alt={`Firma ${name}`} className="h-12 border rounded bg-white" />
                                    <div className="flex flex-col gap-1">
                                      <Button type="button" size="xs" variant="outline" onClick={() => setSignatureModal({ open: true, role: 'executors', name })}>Editar firma</Button>
                                      <Button 
                                        type="button" 
                                        size="xs" 
                                        variant="ghost" 
                                        onClick={() => {
                                          setExecutorSignatures(prev => {
                                            const newSignatures = { ...prev };
                                            delete newSignatures[name];
                                            return newSignatures;
                                          });
                                        }}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                                      >
                                        Eliminar
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <Button 
                                    type="button" 
                                    size="xs" 
                                    variant="outline" 
                                    onClick={() => setSignatureModal({ open: true, role: 'executors', name })}
                                  >
                                    Firmar
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Tabla Supervisores */}
                  <div>
                    <h4 className="font-medium mb-2">Supervisores</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-600">
                            <th className="py-2 pr-4">Empleado</th>
                            <th className="py-2 pr-4">Tareas supervisadas</th>
                            <th className="py-2 pr-4 w-64">Firma</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supervisorNames.length === 0 && (
                            <tr className="border-t"><td colSpan={3} className="py-3 text-muted-foreground">Sin supervisores asignados</td></tr>
                          )}
                          {supervisorNames.map(name => (
                            <tr key={name} className="border-t align-top">
                              <td className="py-2 pr-4 whitespace-nowrap">{name}</td>
                              <td className="py-2 pr-4">
                                <ul className="list-disc pl-5 space-y-1">
                                  {supervisorToTasks[name].map(t => (
                                    <li key={t.id}>{t.title} <span className="text-xs text-muted-foreground">(ID {t.id})</span></li>
                                  ))}
                                </ul>
                              </td>
                              <td className="py-2 pr-4">
                                {supervisorSignatures[name] ? (
                                  <div className="flex items-center gap-2">
                                    <img src={supervisorSignatures[name]} alt={`Firma ${name}`} className="h-12 border rounded bg-white" />
                                    <div className="flex flex-col gap-1">
                                      <Button type="button" size="xs" variant="outline" onClick={() => setSignatureModal({ open: true, role: 'supervisors', name })}>Editar firma</Button>
                                      <Button 
                                        type="button" 
                                        size="xs" 
                                        variant="ghost" 
                                        onClick={() => {
                                          setSupervisorSignatures(prev => {
                                            const newSignatures = { ...prev };
                                            delete newSignatures[name];
                                            return newSignatures;
                                          });
                                        }}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                                      >
                                        Eliminar
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <Button 
                                    type="button" 
                                    size="xs" 
                                    variant="outline" 
                                    onClick={() => setSignatureModal({ open: true, role: 'supervisors', name })}
                                  >
                                    Firmar
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

        {/* Botón de Guardar/Finalizar Checklist */}
        {maintenanceItems.length > 0 && (() => {
          const isComplete = checklistValidation.isComplete;
          
          // Función para hacer scroll hasta un campo específico
          const scrollToField = (itemId: string, field: string) => {
            // Función para resaltar un elemento en naranja
            const highlightElement = (element: HTMLElement) => {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              
              // Guardar referencia para limpiar después
              const originalBgClass = Array.from(element.classList).find(cls => cls.startsWith('bg-'));
              
              // Remover clases de fondo que puedan interferir
              if (originalBgClass) {
                element.classList.remove(originalBgClass);
              }
              
              // Aplicar resaltado naranja con estilos inline fuertes
              element.style.cssText += `
                transition: all 0.3s ease !important;
                border: 3px solid #f97316 !important;
                background-color: #fff7ed !important;
                border-radius: 6px !important;
                box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.2) !important;
              `;
              
              // Remover el resaltado después de 3 segundos
              setTimeout(() => {
                // Restaurar clase de fondo original si existía
                if (originalBgClass) {
                  element.classList.add(originalBgClass);
                }
                
                // Limpiar estilos inline
                element.style.removeProperty('border');
                element.style.removeProperty('background-color');
                element.style.removeProperty('border-radius');
                element.style.removeProperty('box-shadow');
                element.style.removeProperty('transition');
              }, 3000);
            };
            
            // Buscar el elemento según el tipo de campo
            let targetElement: HTMLElement | null = null;
            
            if (field === 'date') {
              // Para fechas, buscar el contenedor de fecha de realizado
              targetElement = document.getElementById(`completedDateContainer-${itemId}`);
              
              // Si no existe, buscar el contenedor de fecha de reprogramación
              if (!targetElement) {
                targetElement = document.getElementById(`rescheduleDateContainer-${itemId}`);
              }
            } else if (field === 'notes' || field === 'issues') {
              // Para notas e inconvenientes, buscar primero el textarea
              const textarea = document.getElementById(`${field}-${itemId}`) as HTMLTextAreaElement;
              if (textarea) {
                // Buscar el div padre que contiene el textarea (div.space-y-2)
                let parent = textarea.parentElement;
                while (parent && !parent.classList.contains('space-y-2')) {
                  parent = parent.parentElement;
                }
                targetElement = parent || textarea;
              }
            } else if (field === 'executors' || field === 'supervisors') {
              // Para ejecutores y supervisores, buscar el div con el ID específico
              targetElement = document.getElementById(`${field}-${itemId}`);
            } else {
              // Para otros campos, buscar directamente
              targetElement = document.getElementById(`${field}-${itemId}`);
            }
            
            if (targetElement) {
              // Resaltar el elemento encontrado
              highlightElement(targetElement);
              
              // Si es un campo de fecha, intentar abrir el date picker después de un pequeño delay
              if (field === 'date') {
                setTimeout(() => {
                  const dateInput = document.getElementById(`completedDate-${itemId}`) as HTMLInputElement ||
                                   document.getElementById(`rescheduleDate-${itemId}`) as HTMLInputElement;
                  
                  if (dateInput) {
                    try {
                      dateInput.showPicker?.();
                    } catch (e) {
                      if (targetElement) {
                        targetElement.click();
                      } else {
                        dateInput.focus();
                        dateInput.click();
                      }
                    }
                  }
                }, 400);
              }
              
              // Si es un campo de notas o inconvenientes, hacer focus
              if (field === 'notes' || field === 'issues') {
                setTimeout(() => {
                  const textarea = document.getElementById(`${field}-${itemId}`) as HTMLTextAreaElement;
                  if (textarea) {
                    textarea.focus();
                    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }, 400);
              }
              
              // Para ejecutores y supervisores, solo resaltar en naranja (no abrir popover)
            } else {
              // Si no encuentra el elemento, intentar encontrar el item y expandirlo
              const itemElement = document.getElementById(`item-${itemId}`);
              if (itemElement) {
                itemElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Resaltar el item brevemente
                itemElement.style.transition = 'all 0.3s ease';
                itemElement.style.borderColor = '#f97316';
                itemElement.style.borderWidth = '3px';
                itemElement.style.borderStyle = 'solid';
                setTimeout(() => {
                  itemElement.style.borderColor = '';
                  itemElement.style.borderWidth = '';
                  itemElement.style.borderStyle = '';
                }, 3000);
                
                // Expandir el item si está colapsado
                if (openItemId !== itemId) {
                  setOpenItemId(itemId);
                  setTimeout(() => {
                    // Buscar el campo después de expandir
                    let fieldElement: HTMLElement | null = null;
                    
                    if (field === 'date') {
                      fieldElement = document.getElementById(`completedDateContainer-${itemId}`) || 
                                   document.getElementById(`rescheduleDateContainer-${itemId}`);
                    } else if (field === 'notes' || field === 'issues') {
                      const textarea = document.getElementById(`${field}-${itemId}`) as HTMLTextAreaElement;
                      if (textarea) {
                        let parent = textarea.parentElement;
                        while (parent && !parent.classList.contains('space-y-2')) {
                          parent = parent.parentElement;
                        }
                        fieldElement = parent || textarea;
                      }
                    } else {
                      fieldElement = document.getElementById(`${field}-${itemId}`);
                    }
                    
                    if (fieldElement) {
                      highlightElement(fieldElement);
                      
                      // Hacer focus en el campo si es necesario
                      if (field === 'notes' || field === 'issues') {
                        const textarea = document.getElementById(`${field}-${itemId}`) as HTMLTextAreaElement;
                        if (textarea) {
                          setTimeout(() => textarea.focus(), 200);
                        }
                      }
                      // Para ejecutores y supervisores, solo resaltar (no abrir popover)
                    }
                  }, 300);
                }
              }
            }
          };
          
          // Debug: mostrar errores en consola
          if (!isComplete) {
            // Obtener todos los ejecutores y supervisores únicos
            const allExecutors = new Set<string>();
            const allSupervisors = new Set<string>();
            maintenanceItems.forEach(item => {
              (item.executors || []).forEach(name => {
                if (name.trim()) allExecutors.add(name.trim());
              });
              (item.supervisors || []).forEach(name => {
                if (name.trim()) allSupervisors.add(name.trim());
              });
            });
            responsibles.ejecutores.forEach(name => {
              if (name.trim()) allExecutors.add(name.trim());
            });
            responsibles.supervisores.forEach(name => {
              if (name.trim()) allSupervisors.add(name.trim());
            });
          }
          
          return (
            <div className="sticky bottom-0 bg-background border-t pt-4 pb-2 mt-6 flex flex-col sm:flex-row gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleCloseWithAutoSave(false)}
                className="w-full sm:w-auto"
              >
                Cerrar
              </Button>
              {!isComplete && (
                <Button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Guardar Checklist
                    </>
                  )}
                </Button>
              )}
              <div className="flex items-center gap-2">
                {!isComplete && (
                  <Popover open={showIncompleteErrorsPopover} onOpenChange={setShowIncompleteErrorsPopover}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto border-orange-500 text-orange-600 hover:bg-orange-50"
                        title="Ver qué falta para finalizar"
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Ver qué falta
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" onWheel={(e) => e.stopPropagation()}>
                      <div className="p-4 pb-2">
                        <h4 className="font-semibold text-sm mb-2">Falta completar:</h4>
                      </div>
                      <div 
                        className="px-4 pb-4 overflow-y-auto overscroll-contain"
                        style={{ 
                          maxHeight: '24rem',
                          WebkitOverflowScrolling: 'touch',
                          touchAction: 'pan-y',
                          scrollBehavior: 'smooth'
                        }}
                        onWheel={(e) => {
                          // Permitir scroll con la ruedita
                          e.stopPropagation();
                        }}
                        onTouchMove={(e) => {
                          // Permitir scroll táctil - solo prevenir propagación si realmente estamos haciendo scroll
                          const target = e.currentTarget;
                          const scrollHeight = target.scrollHeight;
                          const clientHeight = target.clientHeight;
                          const scrollTop = target.scrollTop;
                          
                          // Si hay contenido para hacer scroll, permitirlo
                          if (scrollHeight > clientHeight) {
                            e.stopPropagation();
                          }
                        }}
                      >
                        <ul className="space-y-1 text-sm">
                          {checklistValidation.errors.map((error, index) => {
                            const errorKey = `${error.itemId || index}-${error.field || 'error'}`;
                            
                            return (
                              <li 
                                key={index} 
                                className={`flex items-start gap-2 ${error.itemId && error.field ? 'cursor-pointer hover:bg-orange-50 active:bg-orange-100 p-2 rounded transition-colors' : 'text-orange-700'}`}
                                onTouchStart={(e) => {
                                  // Guardar posición inicial del touch
                                  touchStateRef.current[errorKey] = {
                                    startY: e.touches[0].clientY,
                                    hasMoved: false
                                  };
                                }}
                                onTouchMove={(e) => {
                                  // Detectar si es un gesto de scroll o tap
                                  const state = touchStateRef.current[errorKey];
                                  if (state) {
                                    const touchY = e.touches[0].clientY;
                                    const deltaY = Math.abs(touchY - state.startY);
                                    
                                    // Si el movimiento es mayor a 8px, considerarlo scroll
                                    if (deltaY > 8) {
                                      state.hasMoved = true;
                                    }
                                  }
                                }}
                                onTouchEnd={(e) => {
                                  // Si no hubo movimiento significativo, es un tap
                                  const state = touchStateRef.current[errorKey];
                                  if (state && !state.hasMoved && error.itemId && error.field) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Cerrar el Popover
                                    setShowIncompleteErrorsPopover(false);
                                    // Pequeño delay para ejecutar scrollToField después de cerrar
                                    setTimeout(() => {
                                      scrollToField(error.itemId, error.field);
                                    }, 200);
                                  }
                                  // Limpiar el estado después de usar
                                  delete touchStateRef.current[errorKey];
                                }}
                                onClick={(e) => {
                                  // Para desktop/mouse, ejecutar directamente
                                  if (error.itemId && error.field) {
                                    e.preventDefault();
                                    // Cerrar el Popover
                                    setShowIncompleteErrorsPopover(false);
                                    // Pequeño delay para ejecutar scrollToField después de cerrar
                                    setTimeout(() => {
                                      scrollToField(error.itemId, error.field);
                                    }, 200);
                                  }
                                }}
                              >
                                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <span className={`${error.itemId && error.field ? 'text-orange-700 hover:text-orange-900 select-none' : 'text-orange-700'} break-words`}>{error.message}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                <Button
                  type="button"
                  onClick={() => {
                    if (!isComplete) {
                      const errorMessages = checklistValidation.errors.map(e => e.message).join('. ');
                      toast({
                        title: "Checklist incompleto",
                        description: errorMessages,
                        variant: "destructive",
                        duration: 5000
                      });
                      return;
                    }
                    handleSubmit(true);
                  }}
                  disabled={isSubmitting}
                  className={`w-full sm:w-auto ${isComplete ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600'} text-white`}
                  title={!isComplete ? `Completa toda la información para finalizar. Haz clic en "Ver qué falta" para más detalles.` : 'Finalizar checklist'}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isComplete ? 'Finalizando...' : 'Guardando...'}
                    </>
                  ) : (
                    <>
                      {isComplete ? (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 mr-2" />
                      )}
                      Finalizar Checklist
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })()}
          </div>
        </div>


        {/* Indicador de grabación de voz */}
        {isRecording && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
            <Mic className="h-5 w-5" />
            <span className="text-sm font-medium">Grabando... Toca para detener</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-white hover:bg-red-600"
              onClick={stopVoiceInput}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    {/* Modal Ejecución masiva - FULLSCREEN */}
    <Dialog open={isMassAssignOpen} onOpenChange={(open) => {
      if (!open) {
        // Reset al cerrar
        setMassResultOption('realizado');
        setMassExecutionDate(format(new Date(), 'yyyy-MM-dd'));
        setMassItemsToProcess([]);
        setMassExecutors([]);
        setMassSupervisors([]);
        setEditDateItemId(null);
      }
      setIsMassAssignOpen(open);
    }}>
      <DialogContent hideCloseButton className="w-screen h-[100dvh] max-w-none max-h-none m-0 p-0 rounded-none flex flex-col overflow-hidden gap-0 bg-background">
        <DialogTitle className="sr-only">Ejecución masiva</DialogTitle>

        {/* Barra de control compacta */}
        <div className="flex-shrink-0 border-b bg-muted/30">
          {/* Fila 1: Seleccionar todo + Ver qué falta + Cerrar */}
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={massItemsToProcess.length === maintenanceItems.filter(mi => !mi.completedDate).length && massItemsToProcess.length > 0}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setMassItemsToProcess(maintenanceItems.filter(mi => !mi.completedDate).map(mi => mi.id));
                  } else {
                    setMassItemsToProcess([]);
                  }
                }}
              />
              <span className="text-xs font-medium">
                {massItemsToProcess.length > 0
                  ? `${massItemsToProcess.length} sel.`
                  : 'Todos'}
              </span>
              {/* Ver faltantes - clickeable */}
              {(() => {
                const itemsFaltantes = maintenanceItems.filter(mi => {
                  if (mi.completedDate || mi.rescheduleDate) return false;
                  const sinResponsable = !mi.responsables || mi.responsables.length === 0;
                  const sinSupervisor = !mi.supervisors || mi.supervisors.length === 0;
                  return sinResponsable || sinSupervisor;
                });
                return itemsFaltantes.length > 0 ? (
                  <Popover open={showFaltantesPopover} onOpenChange={setShowFaltantesPopover}>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1">
                        <Badge variant="destructive" className="text-[9px] h-4 px-1.5 cursor-pointer hover:bg-red-600">
                          Ver faltantes ({itemsFaltantes.length})
                        </Badge>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2" align="start">
                      <p className="text-xs font-medium mb-2 text-muted-foreground">Items con datos faltantes:</p>
                      <div
                        className="space-y-1.5 max-h-48 overflow-y-auto pr-1 overscroll-contain"
                        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                      >
                        {itemsFaltantes.map((mi, idx) => {
                          const sinResponsable = !mi.responsables || mi.responsables.length === 0;
                          const sinSupervisor = !mi.supervisors || mi.supervisors.length === 0;
                          const faltanArr = [];
                          if (sinResponsable) faltanArr.push('Responsable');
                          if (sinSupervisor) faltanArr.push('Supervisor');
                          return (
                            <div key={mi.id} className="text-[10px] p-1.5 bg-muted/50 rounded">
                              <p className="font-medium truncate">{mi.maintenanceData?.title || `Item ${idx + 1}`}</p>
                              <p className="text-red-600">Falta: {faltanArr.join(', ')}</p>
                            </div>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-green-600 border-green-300">
                    Todo completo
                  </Badge>
                );
              })()}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setIsMassAssignOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Fila 2: Resultado + Fecha */}
          <div className="flex items-center gap-1.5 px-2 py-1">
            {/* Resultado - solo Realizado y Reprogramar */}
            <Select
              value={massResultOption}
              onValueChange={(v: MassResultOption) => setMassResultOption(v)}
            >
              <SelectTrigger className="h-6 text-[10px] flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="realizado">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Realizado
                  </span>
                </SelectItem>
                <SelectItem value="reprogramar">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-yellow-600" />
                    Reprogramar
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Fecha */}
            <DatePicker
              value={massExecutionDate}
              onChange={(date) => setMassExecutionDate(date)}
              placeholder="Fecha"
              className="h-6 text-[10px] w-28 px-1.5"
              clearable={false}
            />
          </div>

          {/* Fila 3: Supervisores (PRIMERO) */}
          <div className="px-2 pb-1">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-muted-foreground">Supervisores:</span>
              {massSupervisors.map(emp => (
                <Badge key={emp.id} variant="default" className="text-[10px] h-5 gap-1 pr-1 bg-blue-100 text-blue-700 hover:bg-blue-200">
                  {emp.name}
                  <button
                    onClick={() => setMassSupervisors(prev => prev.filter(e => e.id !== emp.id))}
                    className="hover:bg-blue-300 rounded-full"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              <Select
                value=""
                onValueChange={(empId) => {
                  const emp = employees.find(e => e.id === empId);
                  if (emp && !massSupervisors.find(e => e.id === emp.id)) {
                    // Validación: no puede ser responsable
                    if (massResponsables.find(e => e.id === emp.id)) {
                      toast({
                        title: 'No permitido',
                        description: 'Un supervisor no puede ser también responsable',
                        variant: 'destructive'
                      });
                      return;
                    }
                    setMassSupervisors(prev => [...prev, emp]);
                  }
                }}
              >
                <SelectTrigger className="h-6 w-6 p-0 border-dashed">
                  <span className="text-lg leading-none">+</span>
                </SelectTrigger>
                <SelectContent>
                  {/* Filtrar: no mostrar supervisores ya seleccionados NI responsables */}
                  {employees.filter(emp =>
                    !massSupervisors.find(e => e.id === emp.id) &&
                    !massResponsables.find(e => e.id === emp.id)
                  ).map(emp => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fila 4: Responsables (SEGUNDO) */}
          <div className="px-2 pb-2">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-muted-foreground">Responsables:</span>
              {massResponsables.map(emp => (
                <Badge key={emp.id} variant="outline" className="text-[10px] h-5 gap-1 pr-1 bg-green-100 text-green-700 hover:bg-green-200">
                  {emp.name}
                  <button
                    onClick={() => setMassResponsables(prev => prev.filter(e => e.id !== emp.id))}
                    className="hover:bg-green-300 rounded-full"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              <Select
                value=""
                onValueChange={(empId) => {
                  const emp = employees.find(e => e.id === empId);
                  if (emp && !massResponsables.find(e => e.id === emp.id)) {
                    // Validación: no puede ser supervisor
                    if (massSupervisors.find(e => e.id === emp.id)) {
                      toast({
                        title: 'No permitido',
                        description: 'Un responsable no puede ser también supervisor',
                        variant: 'destructive'
                      });
                      return;
                    }
                    setMassResponsables(prev => [...prev, emp]);
                  }
                }}
              >
                <SelectTrigger className="h-6 w-6 p-0 border-dashed">
                  <span className="text-lg leading-none">+</span>
                </SelectTrigger>
                <SelectContent>
                  {/* Filtrar: no mostrar responsables ya seleccionados NI supervisores */}
                  {employees.filter(emp =>
                    !massResponsables.find(e => e.id === emp.id) &&
                    !massResponsables.find(e => e.id === emp.id)
                  ).map(emp => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botón Aplicar */}
          <div className="px-2 pb-1">
            <Button
              size="sm"
              className="w-full h-6 bg-green-600 hover:bg-green-700 text-[10px] font-medium"
              disabled={massItemsToProcess.length === 0 || (massResultOption === 'realizado' && (massResponsables.length === 0 || massSupervisors.length === 0)) || (massResultOption === 'reprogramar' && massSupervisors.length === 0)}
              onClick={() => {
                // Validación: para "realizado" se requiere responsable Y supervisor
                if (massResultOption === 'realizado') {
                  if (massResponsables.length === 0 || massSupervisors.length === 0) {
                    toast({
                      title: 'Datos incompletos',
                      description: 'Para marcar como realizado se requiere al menos un responsable Y un supervisor',
                      variant: 'destructive'
                    });
                    return;
                  }
                }

                // Validación: para "reprogramar" se requiere supervisor
                if (massResultOption === 'reprogramar') {
                  if (massSupervisors.length === 0) {
                    toast({
                      title: 'Supervisor requerido',
                      description: 'Para reprogramar se requiere al menos un supervisor',
                      variant: 'destructive'
                    });
                    return;
                  }
                }

                const today = getTodayDdMmYyyy();
                setMaintenanceItems(prev => prev.map(mi => {
                  if (!massItemsToProcess.includes(mi.id)) return mi;

                  let updatedItem = { ...mi };

                  // Aplicar según resultado seleccionado
                  if (massResultOption === 'realizado') {
                    // Convertir yyyy-MM-dd a dd/MM/yyyy sin problemas de timezone
                    let formattedDate = today;
                    if (massExecutionDate) {
                      const [year, month, day] = massExecutionDate.split('-');
                      formattedDate = `${day}/${month}/${year}`;
                    }
                    updatedItem.completedDate = formattedDate;
                    updatedItem.rescheduleDate = '';
                  } else if (massResultOption === 'reprogramar') {
                    // Convertir yyyy-MM-dd a dd/MM/yyyy sin problemas de timezone
                    let formattedDate = today;
                    if (massExecutionDate) {
                      const [year, month, day] = massExecutionDate.split('-');
                      formattedDate = `${day}/${month}/${year}`;
                    }
                    updatedItem.rescheduleDate = formattedDate;
                    updatedItem.completedDate = '';
                  }

                  // Aplicar responsables (para ambos casos) - actualizar tanto responsables como executors
                  if (massResponsables.length > 0) {
                    const setNamesResp = new Set(updatedItem.responsables || []);
                    const setNamesExec = new Set(updatedItem.executors || []);
                    massResponsables.forEach(emp => {
                      setNamesResp.add(emp.name);
                      setNamesExec.add(emp.name);
                    });
                    updatedItem.responsables = Array.from(setNamesResp);
                    updatedItem.executors = Array.from(setNamesExec);
                  }

                  // Aplicar supervisores (para ambos casos)
                  if (massSupervisors.length > 0) {
                    const setNames = new Set(updatedItem.supervisors || []);
                    massSupervisors.forEach(emp => setNames.add(emp.name));
                    updatedItem.supervisors = Array.from(setNames);
                  }

                  return updatedItem;
                }));

                toast({
                  title: 'Aplicado',
                  description: `${massItemsToProcess.length} items actualizados`
                });
                setMassItemsToProcess([]);
              }}
            >
              Aplicar a {massItemsToProcess.length} seleccionados
            </Button>
          </div>
        </div>

        {/* Lista de items */}
        <div className="flex-1 overflow-y-auto">
          {maintenanceItems.map((mi, idx) => {
            const isCompleted = !!mi.completedDate;
            const isRescheduled = !!mi.rescheduleDate && !mi.completedDate;
            const isPending = !isCompleted && !isRescheduled;
            const isSelected = massItemsToProcess.includes(mi.id);

            // Handler para double tap - usa timeout para no marcar en double tap
            const handleTap = (e: React.MouseEvent) => {
              e.stopPropagation();

              // Si hay un timeout pendiente, es double tap
              if (tapTimeoutRef.current[mi.id]) {
                clearTimeout(tapTimeoutRef.current[mi.id]!);
                tapTimeoutRef.current[mi.id] = null;
                // Double tap - abrir detalle
                setSelectedMaintenanceForDetail(mi.maintenanceData);
                setIsMaintenanceDetailOpen(true);
              } else {
                // Primer tap - programar toggle con delay
                tapTimeoutRef.current[mi.id] = setTimeout(() => {
                  tapTimeoutRef.current[mi.id] = null;
                  // Single tap - toggle selection (si no está completado)
                  if (!isCompleted) {
                    // Validar que haya responsables y supervisores
                    if (massResponsables.length === 0 || massSupervisors.length === 0) {
                      const faltantes = [];
                      if (massResponsables.length === 0) faltantes.push('responsable');
                      if (massSupervisors.length === 0) faltantes.push('supervisor');
                      toast({
                        title: 'Falta personal',
                        description: `Seleccione al menos un ${faltantes.join(' y un ')} antes de seleccionar items`,
                        variant: 'destructive'
                      });
                      return;
                    }
                    setMassItemsToProcess(prev =>
                      prev.includes(mi.id)
                        ? prev.filter(id => id !== mi.id)
                        : [...prev, mi.id]
                    );
                  }
                }, 250);
              }
            };

            return (
              <div
                key={mi.id}
                className={`px-3 py-2 border-b ${
                  isCompleted ? 'bg-green-50/50' :
                  isRescheduled ? 'bg-yellow-50/50' :
                  isSelected ? 'bg-primary/5' : ''
                }`}
                onClick={handleTap}
              >
                {/* Fila principal */}
                <div className="flex items-start gap-2">
                  <div className="pt-0.5">
                    <Checkbox
                      checked={isSelected}
                      disabled={isCompleted}
                      onCheckedChange={(checked) => {
                        if (isCompleted) return;
                        // No permitir selección si no hay responsables ni supervisores
                        if (massResponsables.length === 0 || massSupervisors.length === 0) {
                          const faltantes = [];
                          if (massResponsables.length === 0) faltantes.push('responsable');
                          if (massSupervisors.length === 0) faltantes.push('supervisor');
                          toast({
                            title: 'Falta personal',
                            description: `Seleccione al menos un ${faltantes.join(' y un ')} antes de seleccionar items`,
                            variant: 'destructive'
                          });
                          return;
                        }
                        setMassItemsToProcess(prev =>
                          checked
                            ? [...prev, mi.id]
                            : prev.filter(id => id !== mi.id)
                        );
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-5 w-5"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Título con número - texto más chico y wrap */}
                    <p className={`text-[11px] leading-tight ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                      <span className={`inline-flex items-center justify-center w-4 h-4 mr-1 rounded text-[9px] font-medium ${
                        isCompleted ? 'bg-green-100 text-green-700' :
                        isRescheduled ? 'bg-yellow-100 text-yellow-700' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {idx + 1}
                      </span>
                      {mi.maintenanceData?.title || `Item ${idx + 1}`}
                    </p>
                    {/* Máquina / Componente */}
                    {(mi.maintenanceData?.machineName || mi.maintenanceData?.unidadMovil?.nombre || mi.maintenanceData?.componentNames) && (
                      <p className="text-[9px] text-muted-foreground mt-0.5 truncate">
                        {[
                          mi.maintenanceData?.machineName || mi.maintenanceData?.unidadMovil?.nombre,
                          Array.isArray(mi.maintenanceData?.componentNames)
                            ? mi.maintenanceData?.componentNames.join(', ')
                            : mi.maintenanceData?.componentNames
                        ].filter(Boolean).join(' › ')}
                      </p>
                    )}

                    {/* Asignaciones actuales con botón de eliminar - Supervisores PRIMERO, luego Responsables */}
                    {((mi.responsables && mi.responsables.length > 0) || (mi.supervisors && mi.supervisors.length > 0)) && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {/* Supervisores PRIMERO - en AZUL */}
                        {mi.supervisors?.map((name, i) => (
                          <Badge key={`sup-${i}`} className="text-[9px] h-4 gap-0.5 pr-0.5 py-0 bg-blue-100 text-blue-700 hover:bg-blue-200">
                            <Users className="h-2 w-2" />
                            {name}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMaintenanceItems(prev => prev.map(item => {
                                  if (item.id !== mi.id) return item;
                                  const newSupervisors = item.supervisors?.filter((_, idx) => idx !== i) || [];
                                  // Si quita el último supervisor, limpiar fechas
                                  if (newSupervisors.length === 0) {
                                    const updates: Partial<MaintenanceItem> = { supervisors: newSupervisors };
                                    if (item.completedDate) {
                                      toast({ title: 'Fecha eliminada', description: 'Se quitó la fecha de realizado porque no hay supervisor', variant: 'default' });
                                      updates.completedDate = '';
                                    }
                                    if (item.rescheduleDate) {
                                      toast({ title: 'Fecha eliminada', description: 'Se quitó la fecha de reprogramar porque no hay supervisor', variant: 'default' });
                                      updates.rescheduleDate = '';
                                    }
                                    return { ...item, ...updates };
                                  }
                                  return { ...item, supervisors: newSupervisors };
                                }));
                              }}
                              className="hover:bg-blue-300 rounded-full ml-0.5"
                            >
                              <X className="h-2 w-2" />
                            </button>
                          </Badge>
                        ))}
                        {/* Responsables SEGUNDO - en VERDE */}
                        {mi.responsables?.map((name, i) => (
                          <Badge key={`resp-${i}`} className="text-[9px] h-4 gap-0.5 pr-0.5 py-0 bg-green-100 text-green-700 hover:bg-green-200">
                            <User className="h-2 w-2" />
                            {name}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMaintenanceItems(prev => prev.map(item => {
                                  if (item.id !== mi.id) return item;
                                  const newResponsables = item.responsables?.filter((_, idx) => idx !== i) || [];
                                  const newExecutors = item.executors?.filter(n => n !== name) || [];
                                  // Si quita el último responsable y tiene fecha de completado, limpiar
                                  if (newResponsables.length === 0 && item.completedDate) {
                                    toast({ title: 'Fecha eliminada', description: 'Se quitó la fecha porque no hay responsable', variant: 'default' });
                                    return { ...item, responsables: newResponsables, executors: newExecutors, completedDate: '' };
                                  }
                                  return { ...item, responsables: newResponsables, executors: newExecutors };
                                }));
                              }}
                              className="hover:bg-green-300 rounded-full ml-0.5"
                            >
                              <X className="h-2 w-2" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Estado/Fecha - clickeable si completado + indicador de notas */}
                  <div className="shrink-0 flex items-center gap-1">
                    {/* Indicador de notas - siempre visible, clickeable para agregar/ver notas */}
                    <Popover
                      open={notesPopoverItemId === mi.id}
                      onOpenChange={(open) => setNotesPopoverItemId(open ? mi.id : null)}
                    >
                      <PopoverTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setNotesPopoverItemId(mi.id);
                          }}
                          className={`p-1 rounded hover:bg-muted ${
                            (mi.issues || massTaskNotes[mi.id]?.issues)
                              ? 'text-orange-500'
                              : (mi.notes || massTaskNotes[mi.id]?.notes)
                                ? 'text-green-600'
                                : 'text-muted-foreground'
                          }`}
                          title={
                            (mi.issues || massTaskNotes[mi.id]?.issues)
                              ? 'Hay inconvenientes registrados'
                              : (mi.notes || massTaskNotes[mi.id]?.notes)
                                ? 'Ver/editar notas'
                                : 'Agregar notas'
                          }
                        >
                          <MessageSquare className="h-5 w-5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-2 max-h-[70vh] overflow-y-auto" align="end" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-3">
                          {/* Sección Notas */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium">Notas / Observaciones</p>
                              {(massTaskNotes[mi.id]?.notes || mi.notes) && (
                                <button
                                  className="text-[9px] text-red-500 hover:text-red-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMassTaskNotes(prev => ({
                                      ...prev,
                                      [mi.id]: { ...prev[mi.id], notes: '' }
                                    }));
                                  }}
                                >
                                  Limpiar
                                </button>
                              )}
                            </div>
                            <Textarea
                              placeholder="Observaciones del trabajo realizado..."
                              value={massTaskNotes[mi.id]?.notes || mi.notes || ''}
                              onChange={(e) => {
                                setMassTaskNotes(prev => ({
                                  ...prev,
                                  [mi.id]: { ...prev[mi.id], notes: e.target.value, issues: prev[mi.id]?.issues || mi.issues || '' }
                                }));
                              }}
                              className="h-14 text-xs resize-none"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex flex-wrap gap-1">
                              {getQuickNoteOptions(mi.maintenanceData?.title).map((q) => (
                                <Button
                                  key={q}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-[8px] h-5 px-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentNotes = massTaskNotes[mi.id]?.notes || mi.notes || '';
                                    const notesArray = currentNotes ? currentNotes.split(', ').filter((n: string) => n.trim() !== '') : [];
                                    if (!notesArray.includes(q)) {
                                      const newNotes = notesArray.length > 0 ? `${notesArray.join(', ')}, ${q}` : q;
                                      setMassTaskNotes(prev => ({
                                        ...prev,
                                        [mi.id]: { ...prev[mi.id], notes: newNotes, issues: prev[mi.id]?.issues || mi.issues || '' }
                                      }));
                                    }
                                  }}
                                >
                                  {q}
                                </Button>
                              ))}
                            </div>
                          </div>

                          {/* Sección Inconvenientes */}
                          <div className="space-y-1.5 pt-2 border-t">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-orange-600">Inconvenientes</p>
                              {(massTaskNotes[mi.id]?.issues || mi.issues) && (
                                <button
                                  className="text-[9px] text-red-500 hover:text-red-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMassTaskNotes(prev => ({
                                      ...prev,
                                      [mi.id]: { ...prev[mi.id], issues: '' }
                                    }));
                                  }}
                                >
                                  Limpiar
                                </button>
                              )}
                            </div>
                            <Textarea
                              placeholder="Problemas encontrados durante la ejecución..."
                              value={massTaskNotes[mi.id]?.issues || mi.issues || ''}
                              onChange={(e) => {
                                setMassTaskNotes(prev => ({
                                  ...prev,
                                  [mi.id]: { ...prev[mi.id], issues: e.target.value, notes: prev[mi.id]?.notes || mi.notes || '' }
                                }));
                              }}
                              className="h-14 text-xs resize-none"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex flex-wrap gap-1">
                              {['Sin inconvenientes', 'Falta repuesto', 'Se detectó fuga', 'Ruidos anormales'].map((q) => (
                                <Button
                                  key={q}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-[8px] h-5 px-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentIssues = massTaskNotes[mi.id]?.issues || mi.issues || '';
                                    const issuesArray = currentIssues ? currentIssues.split(', ').filter((n: string) => n.trim() !== '') : [];
                                    if (!issuesArray.includes(q)) {
                                      const newIssues = issuesArray.length > 0 ? `${issuesArray.join(', ')}, ${q}` : q;
                                      setMassTaskNotes(prev => ({
                                        ...prev,
                                        [mi.id]: { ...prev[mi.id], issues: newIssues, notes: prev[mi.id]?.notes || mi.notes || '' }
                                      }));
                                    }
                                  }}
                                >
                                  {q}
                                </Button>
                              ))}
                            </div>
                          </div>

                          <Button
                            size="sm"
                            className="w-full h-6 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMaintenanceItems(prev => prev.map(item => {
                                if (item.id !== mi.id) return item;
                                return {
                                  ...item,
                                  notes: massTaskNotes[mi.id]?.notes || item.notes || '',
                                  issues: massTaskNotes[mi.id]?.issues || item.issues || ''
                                };
                              }));
                              setNotesPopoverItemId(null);
                            }}
                          >
                            Guardar
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Botón cámara para fotos - abre cámara directamente */}
                    <label
                      onClick={(e) => e.stopPropagation()}
                      className={`p-1 rounded hover:bg-muted cursor-pointer ${
                        (itemPhotos[mi.id] || []).length > 0 ? 'text-blue-600' : 'text-muted-foreground'
                      }`}
                      title={(itemPhotos[mi.id] || []).length > 0
                        ? `${(itemPhotos[mi.id] || []).length} foto(s) - Tomar otra`
                        : 'Tomar foto'
                      }
                    >
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleAddPhoto(mi.id, e)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Camera className="h-5 w-5" />
                    </label>
                    {(itemPhotos[mi.id] || []).length > 0 && (
                      <span className="text-[10px] text-blue-600 font-medium bg-blue-100 rounded-full px-1.5">
                        {(itemPhotos[mi.id] || []).length}
                      </span>
                    )}

                    {isCompleted && (
                      <Popover open={editDateItemId === mi.id} onOpenChange={(open) => setEditDateItemId(open ? mi.id : null)}>
                        <PopoverTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditDateItemId(mi.id);
                            }}
                            className="flex items-center gap-1 text-[10px] text-green-600 hover:bg-green-100 px-1.5 py-0.5 rounded"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            {mi.completedDate}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" align="end">
                          <div className="space-y-2">
                            <p className="text-xs font-medium">Cambiar fecha</p>
                            <Input
                              type="date"
                              defaultValue={mi.completedDate ? (() => {
                                const parts = mi.completedDate.split('/');
                                return `${parts[2]}-${parts[1]}-${parts[0]}`;
                              })() : ''}
                              onChange={(e) => {
                                if (e.target.value) {
                                  // Convertir yyyy-MM-dd a dd/MM/yyyy sin problemas de timezone
                                  const [year, month, day] = e.target.value.split('-');
                                  const newDate = `${day}/${month}/${year}`;
                                  setMaintenanceItems(prev => prev.map(item => {
                                    if (item.id !== mi.id) return item;
                                    return { ...item, completedDate: newDate };
                                  }));
                                  setEditDateItemId(null);
                                }
                              }}
                              className="h-8 text-xs"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full h-7 text-xs text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMaintenanceItems(prev => prev.map(item => {
                                  if (item.id !== mi.id) return item;
                                  return { ...item, completedDate: '' };
                                }));
                                setEditDateItemId(null);
                              }}
                            >
                              Quitar fecha
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                    {isRescheduled && (
                      <span className="flex items-center gap-1 text-[10px] text-yellow-600">
                        <Clock className="h-3.5 w-3.5" />
                        {mi.rescheduleDate}
                      </span>
                    )}
                    {isPending && (
                      <span className="text-[9px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                        Pendiente
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer con resumen */}
        <div className="flex-shrink-0 border-t bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-center gap-6 text-xs">
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
              {maintenanceItems.filter(mi => mi.completedDate).length}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-yellow-600" />
              {maintenanceItems.filter(mi => mi.rescheduleDate && !mi.completedDate).length}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Timer className="h-3.5 w-3.5" />
              {maintenanceItems.filter(mi => !mi.completedDate && !mi.rescheduleDate).length}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* ========== MODAL VIEJO COMENTADO (backup) ==========
    <Dialog open={isMassAssignOpen} onOpenChange={setIsMassAssignOpen}>
      <DialogContent size="full" className="max-h-[95dvh] md:max-h-[90dvh] p-0 flex flex-col overflow-hidden gap-0">
        <DialogHeader className="px-4 md:px-6 py-3 md:py-4 border-b flex-shrink-0">
          ... código viejo aquí si necesitas restaurar ...
        </DialogHeader>
      </DialogContent>
    </Dialog>
    ========== FIN MODAL VIEJO ========== */}

    {/* Modal Ejecución masiva LEGACY - Solo para referencia, eliminar cuando el nuevo esté estable */}
    {false && <Dialog open={false}>
      <DialogContent size="full">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Rol</label>
              <Select
                value={massAssignRole} 
                onValueChange={(v: 'executors' | 'supervisors') => {
                  // Guardar las asignaciones actuales antes de cambiar el rol
                  if (massSelectedEmployee) {
                    setAccumulatedAssignments(prev => {
                      const updated = { ...prev };
                      Object.keys(massSelectedItems).forEach(itemId => {
                        if (massSelectedItems[itemId]) {
                          const assignment = massTaskAssignments[itemId];
                          if (assignment && assignment.employee) {
                            if (!updated[itemId]) {
                              updated[itemId] = [];
                            }
                            // Verificar que no esté ya guardada
                            const exists = updated[itemId].some(
                              a => a.employee.id === assignment.employee!.id && a.role === assignment.role
                            );
                            if (!exists) {
                              updated[itemId] = [...updated[itemId], {
                                role: assignment.role,
                                employee: assignment.employee
                              }];
                            }
                          }
                        }
                      });
                      
                      // Después de guardar, verificar si el empleado ya está en las asignaciones acumuladas con el nuevo rol
                      const newSelectedItems: Record<string, boolean> = {};
                      const newAssignments: Record<string, { role: 'executors' | 'supervisors'; employee: { id: string; name: string } }> = {};
                      
                      maintenanceItems.forEach(mi => {
                        const accumulated = updated[mi.id] || [];
                        const hasThisEmployeeInRole = accumulated.some(
                          a => a.employee.id === massSelectedEmployee.id && a.role === v
                        );
                        
                        if (hasThisEmployeeInRole) {
                          newSelectedItems[mi.id] = true;
                          newAssignments[mi.id] = { role: v, employee: massSelectedEmployee };
                        }
                      });
                      
                      // Actualizar los estados después de que se complete el setState
                      setTimeout(() => {
                        setMassSelectedItems(newSelectedItems);
                        setMassTaskAssignments(newAssignments);
                      }, 0);
                      
                      return updated;
                    });
                  }
                  
                  setMassAssignRole(v);
                  
                  // Si no hay empleado, solo actualizar el rol en las tareas ya tildadas
                  if (!massSelectedEmployee) {
                    setMassTaskAssignments(prev => {
                      const updated = { ...prev };
                      Object.keys(massSelectedItems).forEach(itemId => {
                        if (massSelectedItems[itemId] && updated[itemId]) {
                          updated[itemId] = { ...updated[itemId], role: v };
                        }
                      });
                      return updated;
                    });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="executors">Responsable</SelectItem>
                  <SelectItem value="supervisors">Supervisor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium">Empleado</label>
              <Popover open={massEmployeePopoverOpen} onOpenChange={setMassEmployeePopoverOpen}>
                <PopoverTrigger asChild>
                  <div className="flex h-10 items-center rounded-md border border-input px-3 text-sm bg-background hover:bg-muted/50 cursor-pointer">
                    <span className="truncate">{massSelectedEmployee ? massSelectedEmployee.name : 'Seleccionar empleado...'}</span>
                  </div>
                </PopoverTrigger>
                <PopoverContent className="md:w-96 w-[78vw] p-3 space-y-2">
                  <Input placeholder="Buscar empleado..." value={massEmployeeSearch} onChange={(e) => setMassEmployeeSearch(e.target.value)} />
                  <div className="max-h-64 overflow-auto pr-1 space-y-1">
                    {employees
                      .filter(e => e.name.toLowerCase().includes(massEmployeeSearch.toLowerCase()))
                      .map(emp => (
                        <button 
                          key={emp.id} 
                          className="w-full text-left text-sm px-2 py-1 hover:bg-muted rounded" 
                          onClick={() => {
                            // Cerrar el popover al seleccionar un empleado
                            setMassEmployeePopoverOpen(false);
                            // Guardar las asignaciones actuales antes de cambiar de empleado
                            setAccumulatedAssignments(prev => {
                              const updated = { ...prev };
                              Object.keys(massSelectedItems).forEach(itemId => {
                                if (massSelectedItems[itemId]) {
                                  const assignment = massTaskAssignments[itemId];
                                  if (assignment && assignment.employee) {
                                    if (!updated[itemId]) {
                                      updated[itemId] = [];
                                    }
                                    // Verificar que no esté ya guardada
                                    const exists = updated[itemId].some(
                                      a => a.employee.id === assignment.employee!.id && a.role === assignment.role
                                    );
                                    if (!exists) {
                                      updated[itemId] = [...updated[itemId], {
                                        role: assignment.role,
                                        employee: assignment.employee
                                      }];
                                    }
                                  }
                                }
                              });
                              return updated;
                            });
                            
                            // Cambiar el empleado
                            setMassSelectedEmployee(emp);
                            
                            // Verificar si este empleado con este rol ya está en las asignaciones acumuladas
                            // Si es así, tildar automáticamente esas tareas
                            const newSelectedItems: Record<string, boolean> = {};
                            const newAssignments: Record<string, { role: 'executors' | 'supervisors'; employee: { id: string; name: string } }> = {};
                            
                            maintenanceItems.forEach(mi => {
                              const accumulated = accumulatedAssignments[mi.id] || [];
                              const hasThisEmployeeInRole = accumulated.some(
                                a => a.employee.id === emp.id && a.role === massAssignRole
                              );
                              
                              if (hasThisEmployeeInRole) {
                                newSelectedItems[mi.id] = true;
                                newAssignments[mi.id] = { role: massAssignRole, employee: emp };
                              }
                            });
                            
                            setMassSelectedItems(newSelectedItems);
                            setMassTaskAssignments(newAssignments);
                          }}
                        >
                          {emp.name}
                        </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>


          <div className="space-y-2">
            <label className="text-sm font-medium">Mantenimientos</label>
            <div className="max-h-[55vh] overflow-auto border rounded p-2">
              {maintenanceItems.map(mi => {
                const checked = !!massSelectedItems[mi.id];
                const hasResponsible = mi.executors && mi.executors.length > 0 && mi.executors.some(e => e.trim() !== '');
                const hasSupervisor = mi.supervisors && mi.supervisors.length > 0 && mi.supervisors.some(s => s.trim() !== '');
                const isCompleted = !!mi.completedDate;
                const assignment = massTaskAssignments[mi.id];
                // Si no hay asignación individual, usar los valores globales o los existentes en la tarea
                const currentRole = assignment?.role || massAssignRole || (mi.executors && mi.executors.length > 0 ? 'executors' : 'supervisors');
                const currentEmployee = assignment?.employee || massSelectedEmployee || 
                  (mi.executors && mi.executors.length > 0 ? employees.find(e => e.name === mi.executors[0]) : null) ||
                  (mi.supervisors && mi.supervisors.length > 0 ? employees.find(e => e.name === mi.supervisors[0]) : null);
                
                // Verificar también las asignaciones acumuladas para determinar el estado
                const accumulated = accumulatedAssignments[mi.id] || [];
                const hasAccumulatedExecutor = accumulated.some(a => a.role === 'executors');
                const hasAccumulatedSupervisor = accumulated.some(a => a.role === 'supervisors');
                
                // Estado final considerando asignaciones actuales y acumuladas
                const finalHasExecutor = hasResponsible || hasAccumulatedExecutor || (checked && currentRole === 'executors' && currentEmployee);
                const finalHasSupervisor = hasSupervisor || hasAccumulatedSupervisor || (checked && currentRole === 'supervisors' && currentEmployee);
                
                // Si tiene responsable Y supervisor → completado, si solo supervisor → reprogramar
                const shouldShowReprogramar = finalHasSupervisor && !finalHasExecutor && !isCompleted;
                
                return (
                  <div key={mi.id} className="flex items-start gap-3 text-sm md:text-base py-3 border-b border-border/60 last:border-b-0 first:pt-0 last:pb-0">
                    <Checkbox 
                      checked={checked} 
                      onCheckedChange={(c) => {
                        if (c) {
                          // Validar que no haya conflicto antes de tildar
                          if (massSelectedEmployee) {
                            const employeeName = massSelectedEmployee.name;
                            const isExecutor = (mi.executors || []).includes(employeeName);
                            const isSupervisor = (mi.supervisors || []).includes(employeeName);
                            
                            // Verificar en asignaciones acumuladas
                            const accumulated = accumulatedAssignments[mi.id] || [];
                            const hasConflictingRole = accumulated.some(a => {
                              if (a.employee.id === massSelectedEmployee.id) {
                                return (massAssignRole === 'executors' && a.role === 'supervisors') ||
                                       (massAssignRole === 'supervisors' && a.role === 'executors');
                              }
                              return false;
                            });
                            
                            if (hasConflictingRole ||
                                (massAssignRole === 'executors' && isSupervisor) ||
                                (massAssignRole === 'supervisors' && isExecutor)) {
                              toast({ 
                                title: 'Conflicto de roles', 
                                description: `${massSelectedEmployee.name} no puede ser responsable y supervisor en la misma tarea`,
                                variant: 'destructive' 
                              });
                              return;
                            }
                            
                            setMassTaskAssignments(prev => ({
                              ...prev,
                              [mi.id]: { role: massAssignRole, employee: massSelectedEmployee }
                            }));
                          }
                          setMassSelectedItems(prev => ({ ...prev, [mi.id]: true }));
                        } else {
                          // Si se desmarca, eliminar la asignación del empleado para esta tarea
                          setMassSelectedItems(prev => ({ ...prev, [mi.id]: false }));
                          setMassTaskAssignments(prev => {
                            const newAssignments = { ...prev };
                            delete newAssignments[mi.id];
                            return newAssignments;
                          });
                          
                          // Eliminar de las asignaciones acumuladas si existe
                          if (massSelectedEmployee) {
                            setAccumulatedAssignments(prev => {
                              const current = prev[mi.id] || [];
                              const filtered = current.filter(a => 
                                !(a.employee.id === massSelectedEmployee.id && a.role === massAssignRole)
                              );
                              if (filtered.length === 0) {
                                const newAccumulated = { ...prev };
                                delete newAccumulated[mi.id];
                                return newAccumulated;
                              }
                              return { ...prev, [mi.id]: filtered };
                            });
                            
                            // Eliminar también de la tarea real en maintenanceItems
                            const employeeName = massSelectedEmployee.name;
                            if (massAssignRole === 'executors') {
                              const updatedExecutors = (mi.executors || []).filter(e => e !== employeeName);
                              handleItemChange(mi.id, 'executors', updatedExecutors);
                            } else {
                              const updatedSupervisors = (mi.supervisors || []).filter(s => s !== employeeName);
                              handleItemChange(mi.id, 'supervisors', updatedSupervisors);
                            }
                          }
                        }
                      }} 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 overflow-x-auto overflow-y-visible md:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                         <div 
                           className={`break-words whitespace-normal leading-snug min-w-[120px] shrink-0 text-sm md:text-base ${mi.maintenanceId ? 'cursor-pointer hover:text-blue-600 transition-colors select-none' : ''}`}
                           onClick={async (e) => {
                             e.preventDefault();
                             e.stopPropagation();
                             
                             if (!mi.maintenanceId) return;
                             
                             const timerKey = `maintenance-${mi.maintenanceId}`;
                             const existingTimer = clickTimers[timerKey];
                             
                             // Si hay un timer existente, significa que es el segundo clic
                             if (existingTimer) {
                               clearTimeout(existingTimer);
                               setClickTimers(prev => {
                                 const newTimers = { ...prev };
                                 delete newTimers[timerKey];
                                 return newTimers;
                               });
                               
                               // Es un doble clic, abrir el detalle
                               try {
                                 const maintenanceData = await fetchMaintenanceDetails(mi.maintenanceId);
                                 if (maintenanceData) {
                                   setSelectedMaintenanceForDetail(maintenanceData);
                                   setIsMaintenanceDetailOpen(true);
                                 } else {
                                   toast({
                                     title: 'Error',
                                     description: 'No se pudo cargar el detalle del mantenimiento',
                                     variant: 'destructive'
                                   });
                                 }
                               } catch (error) {
                                 console.error('❌ Error loading maintenance detail:', error);
                                 toast({
                                   title: 'Error',
                                   description: 'No se pudo cargar el detalle del mantenimiento',
                                   variant: 'destructive'
                                 });
                               }
                             } else {
                               // Es el primer clic, crear un timer
                               const timer = setTimeout(() => {
                                 setClickTimers(prev => {
                                   const newTimers = { ...prev };
                                   delete newTimers[timerKey];
                                   return newTimers;
                                 });
                               }, 300); // 300ms para detectar doble clic
                               
                               setClickTimers(prev => ({
                                 ...prev,
                                 [timerKey]: timer
                               }));
                             }
                           }}
                           title={mi.maintenanceId ? 'Toca dos veces para ver detalles del mantenimiento' : ''}
                         >
                           {mi.maintenanceData?.title}
                         </div>
                        {(isCompleted || (finalHasExecutor && finalHasSupervisor)) && (
                          <label 
                            className={`relative inline-flex items-center justify-center shrink-0 ${(finalHasExecutor && finalHasSupervisor) ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-50'}`}
                            title={(finalHasExecutor && finalHasSupervisor) ? "Clic para cambiar fecha de realizado" : "Asigna Responsable y Supervisor primero"}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!(finalHasExecutor && finalHasSupervisor)) {
                                toast({ 
                                  title: 'Asignación requerida', 
                                  description: 'Debes asignar al menos un Responsable y un Supervisor antes de colocar la fecha realizada.', 
                                  variant: 'destructive' 
                                });
                                return;
                              }
                              const hiddenInput = document.getElementById(`massCompletedDate-${mi.id}`) as HTMLInputElement;
                              if (hiddenInput) {
                                hiddenInput.click();
                                setTimeout(() => {
                                  if (hiddenInput.showPicker) {
                                    hiddenInput.showPicker();
                                  }
                                }, 10);
                              }
                            }}
                          >
                            <CheckCircle className="h-6 w-6 md:h-5 md:w-5 text-green-600 shrink-0 pointer-events-none" />
                            <input
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              id={`massCompletedDate-${mi.id}`}
                              type="date"
                              value={mi.completedDate ? formatDateForInput(mi.completedDate) : ''}
                              disabled={!(finalHasExecutor && finalHasSupervisor)}
                              onChange={(e) => {
                                e.stopPropagation();
                                const hasBoth = (finalHasExecutor && finalHasSupervisor);
                                if (!hasBoth) {
                                  e.preventDefault();
                                  toast({ 
                                    title: 'Asignación requerida', 
                                    description: 'Debes asignar Responsable y Supervisor antes de colocar fecha.', 
                                    variant: 'destructive' 
                                  });
                                  return;
                                }
                                const formattedDate = e.target.value ? formatDateFromInput(e.target.value) : '';
                                handleItemChange(mi.id, 'completedDate', formattedDate);
                                if (formattedDate) {
                                  handleItemChange(mi.id, 'rescheduleDate', '');
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </label>
                        )}
                        {shouldShowReprogramar && !mi.rescheduleDate && (
                          <div 
                            className="relative inline-block cursor-pointer shrink-0"
                            title="Clic para agregar fecha de reprogramación"
                          >
                            <Badge 
                              variant="outline" 
                              className="text-xxs md:text-xs shrink-0 bg-yellow-50 text-yellow-700 border-yellow-300 cursor-pointer hover:opacity-80"
                              onClick={(e) => {
                                e.stopPropagation();
                                const hiddenInput = document.getElementById(`massRescheduleDate-${mi.id}`) as HTMLInputElement;
                                if (hiddenInput) {
                                  hiddenInput.focus();
                                  hiddenInput.click();
                                  setTimeout(() => {
                                    if (hiddenInput.showPicker) {
                                      hiddenInput.showPicker();
                                    }
                                  }, 50);
                                }
                              }}
                            >
                              Reprogramar
                            </Badge>
                            <input
                              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-10 pointer-events-none"
                              id={`massRescheduleDate-${mi.id}`}
                              type="date"
                              value={mi.rescheduleDate ? formatDateForInput(mi.rescheduleDate) : ''}
                              onChange={(e) => {
                                e.stopPropagation();
                                // Validar que tenga supervisor antes de reprogramar
                                if (e.target.value && !finalHasSupervisor) {
                                  toast({
                                    title: 'Supervisor requerido',
                                    description: 'Debes asignar un Supervisor antes de reprogramar.',
                                    variant: 'destructive'
                                  });
                                  return;
                                }
                                const formattedDate = e.target.value ? formatDateFromInput(e.target.value) : '';
                                handleItemChange(mi.id, 'rescheduleDate', formattedDate);
                                if (formattedDate) {
                                  handleItemChange(mi.id, 'completedDate', '');
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}
                        {mi.rescheduleDate && (
                          <div 
                            className="relative inline-block cursor-pointer shrink-0"
                            title={`Reprogramado: ${formatDateForDisplay(mi.rescheduleDate)} - Clic para cambiar`}
                          >
                            <div
                              className="relative inline-flex items-center justify-center shrink-0 hover:opacity-80"
                              onClick={(e) => {
                                e.stopPropagation();
                                const hiddenInput = document.getElementById(`massRescheduleDate-${mi.id}`) as HTMLInputElement;
                                if (hiddenInput) {
                                  hiddenInput.focus();
                                  hiddenInput.click();
                                  setTimeout(() => {
                                    if (hiddenInput.showPicker) {
                                      hiddenInput.showPicker();
                                    }
                                  }, 50);
                                }
                              }}
                            >
                              <Calendar className="h-6 w-6 md:h-5 md:w-5 text-yellow-600 pointer-events-none" />
                              <CheckCircle className="h-3 w-3 md:h-2 md:w-2 text-yellow-600 absolute -top-0.5 -right-0.5 bg-white rounded-full pointer-events-none" />
                            </div>
                            <input
                              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-10 pointer-events-none"
                              id={`massRescheduleDate-${mi.id}`}
                              type="date"
                              value={mi.rescheduleDate ? formatDateForInput(mi.rescheduleDate) : ''}
                              onChange={(e) => {
                                e.stopPropagation();
                                // Validar que tenga supervisor antes de reprogramar
                                if (e.target.value && !finalHasSupervisor) {
                                  toast({
                                    title: 'Supervisor requerido',
                                    description: 'Debes asignar un Supervisor antes de reprogramar.',
                                    variant: 'destructive'
                                  });
                                  return;
                                }
                                const formattedDate = e.target.value ? formatDateFromInput(e.target.value) : '';
                                handleItemChange(mi.id, 'rescheduleDate', formattedDate);
                                if (formattedDate) {
                                  handleItemChange(mi.id, 'completedDate', '');
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-1 shrink-0 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          {/* Botón de notas */}
                          <Popover 
                            open={massTaskNotesPopoverOpen[mi.id] || false}
                            onOpenChange={(open) => {
                              setMassTaskNotesPopoverOpen(prev => ({ ...prev, [mi.id]: open }));
                              
                              // Limpiar observer e intervalo anteriores si existen
                              if (popoverObserversRef.current[mi.id]) {
                                popoverObserversRef.current[mi.id].disconnect();
                                delete popoverObserversRef.current[mi.id];
                              }
                              if (popoverIntervalsRef.current[mi.id]) {
                                clearInterval(popoverIntervalsRef.current[mi.id]);
                                delete popoverIntervalsRef.current[mi.id];
                              }
                              
                              if (open) {
                                // Forzar que el popover se abra en el centro de la pantalla
                                const forcePopoverPosition = () => {
                                  // Buscar el popover específico usando el atributo data-popover-id
                                  const popoverContent = document.querySelector(`[data-popover-id="notes-${mi.id}"]`) as HTMLElement;
                                  let popoverElement: HTMLElement | null = null;
                                  
                                  if (popoverContent) {
                                    // Buscar el wrapper del popover (parent con data-radix-popper-content-wrapper)
                                    let parent = popoverContent.parentElement;
                                    while (parent && !parent.hasAttribute('data-radix-popper-content-wrapper')) {
                                      parent = parent.parentElement;
                                    }
                                    popoverElement = parent as HTMLElement;
                                  }
                                  
                                  // Si no encontró, buscar por contenido "Notas"
                                  if (!popoverElement) {
                                    const allPopovers = document.querySelectorAll('[data-radix-popper-content-wrapper]');
                                    const notesPopovers = Array.from(allPopovers).filter((el: any) => {
                                      const content = el.querySelector('[role="dialog"]');
                                      return content && content.textContent?.includes('Notas');
                                    });
                                    
                                    if (notesPopovers.length > 0) {
                                      popoverElement = notesPopovers[notesPopovers.length - 1] as HTMLElement;
                                    }
                                  }
                                  
                                  if (popoverElement && popoverContent) {
                                    // Obtener dimensiones del popover y de la ventana
                                    const popoverRect = popoverContent.getBoundingClientRect();
                                    const windowWidth = window.innerWidth;
                                    const windowHeight = window.innerHeight;
                                    
                                    // Usar dimensiones reales del popover o valores por defecto
                                    const popoverWidth = popoverRect.width || 320;
                                    const popoverHeight = popoverRect.height || 500;
                                    
                                    // Calcular posición centrada
                                    const centerX = (windowWidth - popoverWidth) / 2;
                                    const centerY = (windowHeight - popoverHeight) / 2;
                                    
                                    // Forzar posición en el centro de la pantalla
                                    popoverElement.style.setProperty('position', 'fixed', 'important');
                                    popoverElement.style.setProperty('top', `${Math.max(10, centerY)}px`, 'important');
                                    popoverElement.style.setProperty('left', `${Math.max(10, centerX)}px`, 'important');
                                    popoverElement.style.setProperty('transform', 'none', 'important');
                                    popoverElement.style.setProperty('bottom', 'auto', 'important');
                                    popoverElement.style.setProperty('right', 'auto', 'important');
                                  }
                                };
                                
                                // Ejecutar inmediatamente y en intervalos para mantener la posición
                                forcePopoverPosition();
                                
                                const intervals: NodeJS.Timeout[] = [];
                                intervals.push(setTimeout(forcePopoverPosition, 50));
                                intervals.push(setTimeout(forcePopoverPosition, 150));
                                intervals.push(setTimeout(forcePopoverPosition, 300));
                                intervals.push(setTimeout(forcePopoverPosition, 500));
                                
                                // Intervalo para mantener la posición mientras el popover esté abierto
                                const positionInterval = setInterval(() => {
                                  if (!massTaskNotesPopoverOpen[mi.id]) {
                                    clearInterval(positionInterval);
                                    intervals.forEach(i => clearTimeout(i));
                                    delete popoverIntervalsRef.current[mi.id];
                                    return;
                                  }
                                  forcePopoverPosition();
                                }, 100);
                                
                                // Observar cambios en el DOM
                                const observer = new MutationObserver(() => {
                                  if (massTaskNotesPopoverOpen[mi.id]) {
                                    forcePopoverPosition();
                                  }
                                });
                                
                                observer.observe(document.body, {
                                  childList: true,
                                  subtree: true,
                                  attributes: true,
                                  attributeFilter: ['style']
                                });
                                
                                // Guardar el observer e intervalo para limpiarlos después
                                popoverObserversRef.current[mi.id] = observer;
                                popoverIntervalsRef.current[mi.id] = positionInterval;
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button 
                                id={`mass-notes-button-${mi.id}`}
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 md:h-8 md:w-8 p-0 relative flex-shrink-0"
                                title="Agregar notas"
                              >
                                <FileText className="h-6 w-6 md:h-5 md:w-5" />
                                {(massTaskNotes[mi.id]?.notes || mi.notes) && (massTaskNotes[mi.id]?.issues || mi.issues) && (
                                  <CheckCircle className="h-2 w-2 text-green-600 absolute -top-0.5 -right-0.5 bg-white rounded-full" />
                                )}
                              </Button>
                            </PopoverTrigger>
                              <PopoverContent 
                                data-popover-id={`notes-${mi.id}`}
                                className="w-80 p-3 space-y-3 max-h-[500px] overflow-y-auto" 
                                onClick={(e) => e.stopPropagation()}
                                side="bottom"
                                align="start"
                                sideOffset={5}
                                avoidCollisions={false}
                                collisionPadding={20}
                                onOpenAutoFocus={(e) => {
                                  // Prevenir auto-focus para evitar scroll no deseado
                                  e.preventDefault();
                                }}
                              >
                                <div className="space-y-2">
                                  <label className="text-xs font-medium">Notas</label>
                                  <Textarea
                                    placeholder="Notas sobre la ejecución..."
                                    value={massTaskNotes[mi.id]?.notes || mi.notes || ''}
                                    onChange={(e) => setMassTaskNotes(prev => ({
                                      ...prev,
                                      [mi.id]: { ...prev[mi.id], notes: e.target.value, issues: prev[mi.id]?.issues || mi.issues || '' }
                                    }))}
                                    rows={3}
                                    className="text-xs"
                                  />
                                  <div className="flex flex-wrap gap-1">
                                    {getQuickNoteOptions(mi.maintenanceData?.title).map((q) => (
                                      <Button
                                        key={q}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="text-xxs h-6 px-2"
                                        onClick={() => {
                                          const currentNotes = massTaskNotes[mi.id]?.notes || mi.notes || '';
                                          const notesArray = currentNotes ? currentNotes.split(', ').filter(n => n.trim() !== '') : [];
                                          if (!notesArray.includes(q)) {
                                            setMassTaskNotes(prev => ({
                                              ...prev,
                                              [mi.id]: { 
                                                notes: notesArray.length > 0 ? `${notesArray.join(', ')}, ${q}` : q,
                                                issues: prev[mi.id]?.issues || mi.issues || ''
                                              }
                                            }));
                                          }
                                        }}
                                      >
                                        {q}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-medium">Inconvenientes</label>
                                  <Textarea
                                    placeholder="Inconvenientes encontrados..."
                                    value={massTaskNotes[mi.id]?.issues || mi.issues || ''}
                                    onChange={(e) => setMassTaskNotes(prev => ({
                                      ...prev,
                                      [mi.id]: { ...prev[mi.id], issues: e.target.value, notes: prev[mi.id]?.notes || mi.notes || '' }
                                    }))}
                                    rows={3}
                                    className="text-xs"
                                  />
                                  <div className="flex flex-wrap gap-1">
                                    {['Sin inconvenientes', 'Falta repuesto', 'Se detectó fuga', 'Ruidos anormales'].map((q) => (
                                      <Button
                                        key={q}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="text-xxs h-6 px-2"
                                        onClick={() => {
                                          const currentIssues = massTaskNotes[mi.id]?.issues || mi.issues || '';
                                          const issuesArray = currentIssues ? currentIssues.split(', ').filter(i => i.trim() !== '') : [];
                                          if (!issuesArray.includes(q)) {
                                            setMassTaskNotes(prev => ({
                                              ...prev,
                                              [mi.id]: { 
                                                issues: issuesArray.length > 0 ? `${issuesArray.join(', ')}, ${q}` : q,
                                                notes: prev[mi.id]?.notes || mi.notes || ''
                                              }
                                            }));
                                          }
                                        }}
                                      >
                                        {q}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => {
                                    const taskNotes = massTaskNotes[mi.id];
                                    if (taskNotes) {
                                      handleItemChange(mi.id, 'notes', taskNotes.notes);
                                      handleItemChange(mi.id, 'issues', taskNotes.issues);
                                    }
                                    setMassTaskNotesPopoverOpen(prev => ({ ...prev, [mi.id]: false }));
                                  }}
                                >
                                  Guardar
                                </Button>
                              </PopoverContent>
                            </Popover>
                            
                            {/* Badge para cambiar rol y empleado - siempre visible */}
                            <Popover>
                              <PopoverTrigger asChild>
                                <Badge 
                                  variant="outline" 
                                  className="text-xxs md:text-xs cursor-pointer hover:bg-muted shrink-0"
                                  title="Clic para cambiar rol y empleado"
                                >
                                  {currentRole === 'executors' ? 'Responsable' : 'Supervisor'}: {currentEmployee?.name || massSelectedEmployee?.name || 'Sin asignar'}
                                </Badge>
                              </PopoverTrigger>
                                <PopoverContent className="w-80 p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium">Rol</label>
                                    <Select 
                                      value={currentRole} 
                                      onValueChange={(v: 'executors' | 'supervisors') => {
                                        setMassTaskAssignments(prev => ({
                                          ...prev,
                                          [mi.id]: { role: v, employee: prev[mi.id]?.employee || massSelectedEmployee || currentEmployee }
                                        }));
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="executors">Responsable</SelectItem>
                                        <SelectItem value="supervisors">Supervisor</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium">Empleado</label>
                                    <Select
                                      value={currentEmployee?.id || massSelectedEmployee?.id || ''}
                                      onValueChange={(value) => {
                                        const selectedEmp = employees.find(e => e.id === value);
                                        if (selectedEmp) {
                                          setMassTaskAssignments(prev => ({
                                            ...prev,
                                            [mi.id]: { role: currentRole, employee: selectedEmp }
                                          }));
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Seleccionar empleado..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {employees.map(emp => (
                                          <SelectItem key={emp.id} value={emp.id}>
                                            {emp.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </PopoverContent>
                              </Popover>
                          </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 md:hidden">ID {mi.maintenanceId}</div>
                      
                      {/* Mostrar asignaciones acumuladas (guardadas pero no tildadas) */}
                      {accumulatedAssignments[mi.id] && accumulatedAssignments[mi.id].length > 0 && (
                        <div className="mt-1 space-y-1">
                          <div className="text-[10px] font-medium text-blue-600">Asignaciones guardadas:</div>
                          <div className="flex flex-wrap gap-1">
                            {accumulatedAssignments[mi.id].map((acc, idx) => (
                              <Badge 
                                key={idx}
                                variant="outline" 
                                className="text-xxs bg-blue-50 text-blue-700 border-blue-300"
                              >
                                {acc.role === 'executors' ? 'Responsable' : 'Supervisor'}: {acc.employee.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Mostrar empleados ya asignados en la tarea */}
                      {(mi.executors && mi.executors.length > 0) || (mi.supervisors && mi.supervisors.length > 0) ? (
                        <div className="mt-1 space-y-1">
                          {mi.executors && mi.executors.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-[9px] font-medium text-muted-foreground">Resp:</span>
                              <div className="flex flex-wrap gap-0.5">
                                {mi.executors.map((exec, idx) => (
                                  <Badge key={idx} variant="outline" className="text-[9px] h-4 px-1 py-0">
                                    {exec}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {mi.supervisors && mi.supervisors.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-[9px] font-medium text-muted-foreground">Sup:</span>
                              <div className="flex flex-wrap gap-0.5">
                                {mi.supervisors.map((sup, idx) => (
                                  <Badge key={idx} variant="outline" className="text-[9px] h-4 px-1 py-0">
                                    {sup}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <Badge variant="outline" className="ml-2 text-xxs md:text-xs hidden md:inline-flex">ID {mi.maintenanceId}</Badge>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer fijo */}
        <div className="border-t bg-muted/30 px-4 md:px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={() => {
              setIsMassAssignOpen(false);
              setMassTaskAssignments({});
              setMassTaskEmployeeSearch({});
              setMassTaskPopoverOpen({});
              setAccumulatedAssignments({});
              setMassTaskNotes({});
              setMassTaskNotesPopoverOpen({});
            }}>Cancelar</Button>
            <Button type="button" size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => {
              const today = getTodayDdMmYyyy();
              let hasErrors = false;
              
              // Validar que todas las tareas tildadas tengan empleado asignado
              const itemsToAssign = Object.keys(massSelectedItems).filter(id => massSelectedItems[id]);
              for (const itemId of itemsToAssign) {
                const assignment = massTaskAssignments[itemId];
                // Si no hay asignación específica, usar los valores globales
                if (!assignment || !assignment.employee) {
                  if (!massSelectedEmployee) {
                    toast({ 
                      title: 'Falta empleado', 
                      description: 'Todas las tareas tildadas deben tener un empleado asignado',
                      variant: 'destructive' 
                    });
                    hasErrors = true;
                    break;
                  }
                }
              }
              
              if (hasErrors) return;
              
              // Validar que un empleado no sea responsable y supervisor en la misma tarea
              for (const itemId of itemsToAssign) {
                const assignment = massTaskAssignments[itemId];
                const employeeToUse = assignment?.employee || massSelectedEmployee;
                const roleToUse = assignment?.role || massAssignRole;
                
                if (employeeToUse) {
                  const mi = maintenanceItems.find(m => m.id === itemId);
                  if (mi) {
                    // Verificar en asignaciones acumuladas
                    const accumulated = accumulatedAssignments[itemId] || [];
                    const hasConflictingRole = accumulated.some(a => {
                      if (a.employee.id === employeeToUse.id) {
                        // Si el empleado ya está en el otro rol, hay conflicto
                        return (roleToUse === 'executors' && a.role === 'supervisors') ||
                               (roleToUse === 'supervisors' && a.role === 'executors');
                      }
                      return false;
                    });
                    
                    // Verificar en asignaciones actuales de la tarea
                    const currentExecutors = mi.executors || [];
                    const currentSupervisors = mi.supervisors || [];
                    const employeeName = employeeToUse.name;
                    const isExecutor = currentExecutors.includes(employeeName);
                    const isSupervisor = currentSupervisors.includes(employeeName);
                    
                    if (hasConflictingRole || 
                        (roleToUse === 'executors' && isSupervisor) ||
                        (roleToUse === 'supervisors' && isExecutor)) {
                      toast({ 
                        title: 'Conflicto de roles', 
                        description: `${employeeToUse.name} no puede ser responsable y supervisor en la misma tarea`,
                        variant: 'destructive' 
                      });
                      hasErrors = true;
                      break;
                    }
                  }
                }
              }
              
              if (hasErrors) return;
              
              // Aplicar TODAS las asignaciones acumuladas + las actuales
              setMaintenanceItems(prev => prev.map(mi => {
                const allAssignmentsForItem: Array<{ role: 'executors' | 'supervisors'; employee: { id: string; name: string } }> = [];
                
                // Guardar las fechas manuales ANTES de aplicar las asignaciones
                const hasManualCompletedDate = !!mi.completedDate;
                const hasManualRescheduleDate = !!mi.rescheduleDate;
                const manualCompletedDate = mi.completedDate;
                const manualRescheduleDate = mi.rescheduleDate;
                
                // Agregar asignaciones acumuladas
                if (accumulatedAssignments[mi.id]) {
                  allAssignmentsForItem.push(...accumulatedAssignments[mi.id]);
                }
                
                // Agregar asignaciones actuales (tildadas)
                if (massSelectedItems[mi.id]) {
                  const assignment = massTaskAssignments[mi.id];
                  const employeeToUse = assignment?.employee || massSelectedEmployee;
                  const roleToUse = assignment?.role || massAssignRole;
                  
                  if (employeeToUse) {
                    // Verificar que no esté ya en las acumuladas
                    const exists = allAssignmentsForItem.some(
                      a => a.employee.id === employeeToUse.id && a.role === roleToUse
                    );
                    if (!exists) {
                      allAssignmentsForItem.push({
                        role: roleToUse,
                        employee: employeeToUse
                      });
                    }
                  }
                }
                
                // Si no hay asignaciones para este item, verificar si hay notas para aplicar
                const taskNotes = massTaskNotes[mi.id];
                const hasNotesToApply = taskNotes && (taskNotes.notes || taskNotes.issues);
                
                // Si no hay asignaciones ni notas, no hacer nada
                if (allAssignmentsForItem.length === 0 && !hasNotesToApply) return mi;
                
                let updatedItem = { ...mi };
                
                // Aplicar notas si están definidas
                if (taskNotes) {
                  if (taskNotes.notes) {
                    updatedItem.notes = taskNotes.notes;
                  }
                  if (taskNotes.issues) {
                    updatedItem.issues = taskNotes.issues;
                  }
                }
                
                let hasExecutor = false;
                let hasSupervisor = false;
                
                // Aplicar todas las asignaciones (verificando que no haya conflictos)
                allAssignmentsForItem.forEach(assignment => {
                  const employeeName = assignment.employee.name;
                  
                  if (assignment.role === 'executors') {
                    // Verificar que no sea supervisor
                    const isSupervisor = (updatedItem.supervisors || []).includes(employeeName);
                    if (!isSupervisor) {
                      const setNames = new Set(updatedItem.executors || []);
                  setNames.add(employeeName);
                      updatedItem.executors = Array.from(setNames);
                      hasExecutor = true;
                    }
                } else {
                    // Verificar que no sea responsable
                    const isExecutor = (updatedItem.executors || []).includes(employeeName);
                    if (!isExecutor) {
                      const setNames = new Set(updatedItem.supervisors || []);
                  setNames.add(employeeName);
                      updatedItem.supervisors = Array.from(setNames);
                      hasSupervisor = true;
                    }
                  }
                });
                
                // Verificar si tiene responsable Y supervisor
                const finalExecutors = updatedItem.executors || [];
                const finalSupervisors = updatedItem.supervisors || [];
                const hasFinalExecutor = finalExecutors.length > 0 && finalExecutors.some(e => e.trim() !== '');
                const hasFinalSupervisor = finalSupervisors.length > 0 && finalSupervisors.some(s => s.trim() !== '');
                
                // Solo establecer fechas automáticamente si no hay fechas ya establecidas manualmente
                // Si el usuario ya seleccionó una fecha, respetarla y no sobrescribirla
                // Usar las fechas guardadas ANTES de aplicar las asignaciones
                
                // Si tiene responsable Y supervisor → marcar como realizada (solo si no hay fecha manual)
                if (hasFinalExecutor && hasFinalSupervisor) {
                  if (!hasManualCompletedDate && !hasManualRescheduleDate) {
                    // Solo establecer automáticamente si no hay fechas manuales
                    updatedItem.completedDate = today;
                    updatedItem.rescheduleDate = '';
                  } else if (hasManualRescheduleDate && !hasManualCompletedDate) {
                    // Si hay fecha de reprogramación manual pero ahora tiene ambos roles, cambiar a completado
                    updatedItem.completedDate = today;
                    updatedItem.rescheduleDate = '';
                  } else if (hasManualCompletedDate) {
                    // Si ya hay fecha de completado manual, mantenerla tal cual
                    updatedItem.completedDate = manualCompletedDate;
                    updatedItem.rescheduleDate = '';
                  }
                } 
                // Si solo tiene supervisor (sin responsable) → marcar como reprogramada (solo si no hay fecha manual)
                else if (hasFinalSupervisor && !hasFinalExecutor) {
                  if (!hasManualCompletedDate && !hasManualRescheduleDate) {
                    // Solo establecer automáticamente si no hay fechas manuales
                    updatedItem.rescheduleDate = today;
                    updatedItem.completedDate = '';
                  } else if (hasManualCompletedDate && !hasManualRescheduleDate) {
                    // Si hay fecha de completado manual pero solo tiene supervisor, cambiar a reprogramación
                    updatedItem.rescheduleDate = today;
                    updatedItem.completedDate = '';
                  } else if (hasManualRescheduleDate) {
                    // Si ya hay fecha de reprogramación manual, mantenerla tal cual
                    updatedItem.rescheduleDate = manualRescheduleDate;
                    updatedItem.completedDate = '';
                  }
                }
                // Si solo tiene responsable (sin supervisor) → marcar como completado (solo si no hay fecha manual)
                else if (hasFinalExecutor && !hasFinalSupervisor) {
                  if (!hasManualCompletedDate && !hasManualRescheduleDate) {
                    // Solo establecer automáticamente si no hay fechas manuales
                    updatedItem.completedDate = today;
                    updatedItem.rescheduleDate = '';
                  } else if (hasManualRescheduleDate && !hasManualCompletedDate) {
                    // Si hay fecha de reprogramación manual pero solo tiene responsable, cambiar a completado
                    updatedItem.completedDate = today;
                    updatedItem.rescheduleDate = '';
                  } else if (hasManualCompletedDate) {
                    // Si ya hay fecha de completado manual, mantenerla tal cual
                    updatedItem.completedDate = manualCompletedDate;
                    updatedItem.rescheduleDate = '';
                  }
                }
                // Si no tiene ninguno → marcar como reprogramada (solo si no hay fecha manual)
                else {
                  if (!hasManualCompletedDate && !hasManualRescheduleDate) {
                    // Solo establecer automáticamente si no hay fechas manuales
                    updatedItem.rescheduleDate = today;
                    updatedItem.completedDate = '';
                  } else if (hasManualCompletedDate && !hasManualRescheduleDate) {
                    // Si hay fecha de completado pero no tiene asignaciones, cambiar a reprogramación
                    updatedItem.rescheduleDate = today;
                    updatedItem.completedDate = '';
                  } else if (hasManualRescheduleDate) {
                    // Si ya hay fecha de reprogramación manual, mantenerla tal cual
                    updatedItem.rescheduleDate = manualRescheduleDate;
                    updatedItem.completedDate = '';
                  }
                }
                
                return updatedItem;
              }));
              
              setIsMassAssignOpen(false);
              setMassTaskAssignments({});
              setMassTaskEmployeeSearch({});
              setMassTaskPopoverOpen({});
              setAccumulatedAssignments({});
              setMassTaskNotes({});
              setMassTaskNotesPopoverOpen({});
              toast({ title: 'Asignado', description: 'Asignación masiva aplicada' });
            }}>Aplicar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>}
    {/* Modal de confirmación para marcar como completado */}
    <AlertDialog open={!!confirmCompleteItemId} onOpenChange={(open) => !open && setConfirmCompleteItemId(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar completado</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro de marcar completada esta tarea? Se establecerá la fecha de realizado para hoy.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmCompleteItemId(null)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => {
            const itemId = confirmCompleteItemId;
            if (itemId) {
              const today = getTodayDdMmYyyy();
              handleItemChange(itemId, 'completedDate', today);
              handleItemChange(itemId, 'rescheduleDate', '');
            }
            setConfirmCompleteItemId(null);
          }}>Marcar completado</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    {/* Modal de firma */}
    <Dialog open={!!signatureModal?.open} onOpenChange={(open) => { if (!open) setSignatureModal(null); }}>
      <DialogContent size="default" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Firma {signatureModal?.role === 'executors' ? 'Responsable' : 'Supervisor'}</DialogTitle>
          <DialogDescription>{signatureModal?.name}</DialogDescription>
        </DialogHeader>

        {/* Lista de tareas que firma esta persona */}
        {signatureModal && (() => {
          const tareasAsignadas = maintenanceItems.filter(mi => {
            if (signatureModal.role === 'executors') {
              return (mi.executors || []).includes(signatureModal.name);
            } else {
              return (mi.supervisors || []).includes(signatureModal.name);
            }
          });

          if (tareasAsignadas.length === 0) return null;

          return (
            <div className="border rounded-lg p-3 bg-muted/30 mb-2">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                {signatureModal.role === 'executors' ? 'Tareas realizadas' : 'Tareas supervisadas'} ({tareasAsignadas.length}):
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {tareasAsignadas.map((mi, idx) => {
                  const taskName = mi.maintenanceData?.title || `Mantenimiento ${mi.maintenanceId}`;
                  const isCompleted = mi.completedDate && mi.completedDate.length > 0;
                  return (
                    <div key={mi.id || mi.itemId} className="flex items-start gap-2 text-xs">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 ${isCompleted ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {idx + 1}
                      </span>
                      <span className="flex-1">{taskName}</span>
                      {isCompleted && (
                        <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <SignatureCanvas
          onCancel={() => setSignatureModal(null)}
          onSave={(dataUrl) => {
            if (!signatureModal) return;
            if (signatureModal.role === 'executors') {
              setExecutorSignatures(prev => ({ ...prev, [signatureModal.name]: dataUrl }));
            } else {
              setSupervisorSignatures(prev => ({ ...prev, [signatureModal.name]: dataUrl }));
            }
            setSignatureModal(null);
          }}
        />
      </DialogContent>
    </Dialog>
    <AlertDialog open={!!confirmUncompleteItemId} onOpenChange={(open) => !open && setConfirmUncompleteItemId(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Quitar completado</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Deseás desmarcar esta tarea como completada? Se eliminará la fecha de realizado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmUncompleteItemId(null)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => {
            const itemId = confirmUncompleteItemId;
            if (itemId) {
              handleItemChange(itemId, 'completedDate', '');
            }
            setConfirmUncompleteItemId(null);
          }}>Desmarcar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Modal de detalle de mantenimiento */}
    {selectedMaintenanceForDetail && currentCompany?.id && (
      <Suspense fallback={<div className="p-4">Cargando detalles...</div>}>
      <MaintenanceDetailDialog
        isOpen={isMaintenanceDetailOpen}
        onClose={() => {
          setIsMaintenanceDetailOpen(false);
          setSelectedMaintenanceForDetail(null);
        }}
        maintenance={selectedMaintenanceForDetail}
        canEdit={canEditMaintenance}
        companyId={parseInt(String(currentCompany.id))}
      />
      </Suspense>
    )}
    {/* Modal para ver instructivos completos */}
    <Dialog open={isInstructivesModalOpen} onOpenChange={setIsInstructivesModalOpen}>
      <DialogContent size="lg" className="max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Instructivos del Checklist
          </DialogTitle>
          <DialogDescription>
            {loadedChecklist?.title || checklist?.title || 'Checklist'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          {checklistInstructives.length > 0 && selectedInstructiveIndex !== null ? (
            <>
              {/* Navegación entre instructivos */}
              {checklistInstructives.length > 1 && (
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedInstructiveIndex > 0) {
                        setSelectedInstructiveIndex(selectedInstructiveIndex - 1);
                      }
                    }}
                    disabled={selectedInstructiveIndex === 0}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm font-medium">
                    {selectedInstructiveIndex + 1} de {checklistInstructives.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedInstructiveIndex < checklistInstructives.length - 1) {
                        setSelectedInstructiveIndex(selectedInstructiveIndex + 1);
                      }
                    }}
                    disabled={selectedInstructiveIndex === checklistInstructives.length - 1}
                  >
                    Siguiente
                  </Button>
                </div>
              )}
              
              {/* Instructivo actual */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{checklistInstructives[selectedInstructiveIndex]?.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: checklistInstructives[selectedInstructiveIndex]?.content || '' }}
                    style={{
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word'
                    }}
                  />
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No hay instructivos disponibles</p>
              <p className="text-sm">
                Este checklist no tiene instructivos asociados
              </p>
            </div>
          )}
        </div>
        
        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => setIsInstructivesModalOpen(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

// Componente simple de canvas para capturar firma
function SignatureCanvas({ onSave, onCancel }: { onSave: (dataUrl: string) => void; onCancel: () => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = React.useRef(false);
  const lastPointRef = React.useRef<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#111827';
    }
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    } else {
      return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
    }
  };

  const startDraw = (e: any) => {
    e.preventDefault();
    isDrawingRef.current = true;
    lastPointRef.current = getPos(e);
  };
  const moveDraw = (e: any) => {
    if (!isDrawingRef.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = getPos(e);
    const lp = lastPointRef.current || p;
    ctx.beginPath();
    ctx.moveTo(lp.x, lp.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
  };
  const endDraw = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const save = () => {
    const canvas = canvasRef.current!;
    
    // Verificar que la firma no esté vacía
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    // Verificar si hay algún pixel que no sea blanco (o casi blanco)
    let hasContent = false;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];
      
      // Si hay un pixel que no sea blanco (o casi blanco) y tenga opacidad, hay contenido
      if (a > 0 && (r < 250 || g < 250 || b < 250)) {
        hasContent = true;
        break;
      }
    }
    
    if (!hasContent) {
      alert('Por favor, dibuja una firma antes de guardar. No se puede guardar una firma vacía.');
      return;
    }
    
    // exportar a dataURL a 2x para mejor nitidez
    const exportCanvas = document.createElement('canvas');
    const rect = canvas.getBoundingClientRect();
    const scale = 2;
    exportCanvas.width = rect.width * scale;
    exportCanvas.height = rect.height * scale;
    const dst = exportCanvas.getContext('2d')!;
    dst.scale(scale, scale);
    dst.drawImage(canvas, 0, 0, rect.width, rect.height);
    onSave(exportCanvas.toDataURL('image/png'));
  };

  return (
    <div className="space-y-3">
      <div
        className="border rounded bg-white"
        style={{ width: '100%', height: 200 }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onMouseDown={startDraw}
          onMouseMove={moveDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={moveDraw}
          onTouchEnd={endDraw}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={clear}>Borrar</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="button" onClick={save}>Guardar firma</Button>
      </div>
    </div>
  );
}

