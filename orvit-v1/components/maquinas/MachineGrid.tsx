'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useCallback, useMemo, useRef } from 'react';
import { Machine, MachineStatus, MachineType } from '@/lib/types';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { FileText, Trash2, Zap, History, Pencil, AlertTriangle, Wrench, Settings, MapPin, Activity, Calendar, Copy, MoreVertical, QrCode, LayoutGrid, List, ArrowUpDown, Clock, Heart, Shield, ShieldAlert, ShieldCheck, Star, CheckCircle, Circle, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow, differenceInDays, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import MachineHistoryDialog from './MachineHistoryDialog';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

export type ViewMode = 'grid' | 'list' | 'table' | 'schema';
export type SortField = 'name' | 'healthScore' | 'status' | 'updatedAt' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

// ✨ Componente para item sorteable (fuera del componente principal para evitar re-renders)
interface SortableItemProps {
  id: number;
  children: React.ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="relative">
        {/* Drag handle - aparece arriba a la izquierda */}
        <div
          {...listeners}
          className="absolute top-2 left-2 z-20 p-2 rounded-full bg-background/90 shadow-lg cursor-grab active:cursor-grabbing hover:bg-background transition-colors"
          title="Arrastrá para reordenar"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        {children}
      </div>
    </div>
  );
}

interface MachineGridProps {
  machines: Machine[];
  onDelete?: (machine: Machine) => Promise<void>;
  onSelect?: (machine: Machine) => void;
  onCreateWorkOrder?: (machine: Machine) => void;
  onEdit?: (machine: Machine) => void;
  onReportFailure?: (machine: Machine) => void;
  onReorder?: (machineId: number, direction: 'left' | 'right') => void;
  onDragReorder?: (machineIds: number[]) => void; // Nuevo: para drag & drop
  onDuplicate?: (machine: Machine) => void;
  onGenerateQR?: (machine: Machine) => void;
  // 🔍 PERMISOS
  canDeleteMachine?: boolean;
  canEditMachine?: boolean;
  canViewHistory?: boolean;
  canReportFailure?: boolean;
  isReorderMode?: boolean;
  isLoading?: boolean;
  // ✨ View modes y ordenamiento
  viewMode?: ViewMode;
  sortField?: SortField;
  sortOrder?: SortOrder;
  // ✨ Selección y favoritos
  isMultiSelectMode?: boolean;
  selectedMachineIds?: Set<number>;
  onToggleSelection?: (machineId: number) => void;
  favorites?: Set<number>;
  onToggleFavorite?: (machineId: number) => void;
}

export default function MachineGrid({
  machines,
  onDelete,
  onSelect,
  onCreateWorkOrder,
  onEdit,
  onReportFailure,
  onReorder,
  onDragReorder,
  onDuplicate,
  onGenerateQR,
  canDeleteMachine = false,
  canEditMachine = false,
  canViewHistory = false,
  canReportFailure = false,
  isReorderMode = false,
  isLoading = false,
  viewMode = 'grid',
  sortField,
  sortOrder = 'asc',
  isMultiSelectMode = false,
  selectedMachineIds = new Set(),
  onToggleSelection,
  favorites = new Set(),
  onToggleFavorite,
}: MachineGridProps) {
  const { theme } = useTheme();
  const confirm = useConfirm();
  
  // Helper function to get card styles based on theme
  const getCardContentClasses = () => {
    switch (theme) {
      case 'light':
        return 'p-2 bg-background shadow-sm backdrop-blur-sm rounded-b-2xl';
      case 'dark':
        return 'p-2 bg-zinc-900 shadow-sm backdrop-blur-sm rounded-b-2xl';
      case 'metal':
        return 'p-2 bg-[#1E3A46] shadow-sm backdrop-blur-sm rounded-b-2xl border border-[#3A4F5A]';
      default:
        return 'p-2 bg-background shadow-sm backdrop-blur-sm rounded-b-2xl';
    }
  };

  // Helper function to get text colors based on theme
  const getMutedTextClasses = () => {
    switch (theme) {
      case 'light':
        return 'text-muted-foreground';
      case 'dark':
        return 'text-muted-foreground';
      case 'metal':
        return 'text-[#B4C3CC]';
      default:
        return 'text-muted-foreground';
    }
  };

  const getPrimaryTextClasses = () => {
    switch (theme) {
      case 'light':
        return 'text-foreground';
      case 'dark':
        return 'text-white';
      case 'metal':
        return 'text-[#F4FEFE]';
      default:
        return 'text-foreground';
    }
  };

  const getBackgroundAccentClasses = () => {
    switch (theme) {
      case 'light':
        return 'bg-muted/50';
      case 'dark':
        return 'bg-zinc-700';
      case 'metal':
        return 'bg-[#58717D]';
      default:
        return 'bg-muted/50';
    }
  };

  // Helper function to get button styles based on theme
  const getButtonClasses = (variant: 'primary' | 'outline' | 'secondary' = 'primary') => {
    switch (theme) {
      case 'light':
        return variant === 'primary' ? 'bg-foreground hover:bg-foreground/90 text-background' :
               variant === 'outline' ? 'border border-border bg-background hover:bg-muted text-foreground' :
               'bg-muted hover:bg-muted/80 text-foreground';
      case 'dark':
        return variant === 'primary' ? 'bg-background hover:bg-muted text-foreground' :
               variant === 'outline' ? 'border border-border bg-zinc-800 hover:bg-zinc-700 text-white' :
               'bg-zinc-700 hover:bg-zinc-600 text-white';
      case 'metal':
        return variant === 'primary' ? 'bg-[#58717D] hover:bg-[#4A6068] text-[#F4FEFE]' :
               variant === 'outline' ? 'border border-[#3A4F5A] bg-[#1E3A46] hover:bg-[#182B31] text-[#F4FEFE]' :
               'bg-[#58717D] hover:bg-[#4A6068] text-[#F4FEFE]';
      default:
        return variant === 'primary' ? 'bg-foreground hover:bg-foreground/90 text-background' :
               variant === 'outline' ? 'border border-border bg-background hover:bg-muted text-foreground' :
               'bg-muted hover:bg-muted/80 text-foreground';
    }
  };
  
  const [historyDialog, setHistoryDialog] = useState<{
    isOpen: boolean;
    machineId: number;
    machineName: string;
  }>({
    isOpen: false,
    machineId: 0,
    machineName: ''
  });

  // Estado para manejar errores y carga de imágenes
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  const [imageLoading, setImageLoading] = useState<Record<number, boolean>>({});

  // ✨ Mobile double-tap: Para evitar toques accidentales al scrollear
  const [lastTapTime, setLastTapTime] = useState<Record<string, number>>({});
  const DOUBLE_TAP_DELAY = 300; // ms entre toques

  // Detectar si es móvil (solo cliente)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Handler para doble toque en móvil
  // Retorna true si la acción se ejecutó, false si fue primer toque
  const handleMobileDoubleTap = useCallback((
    key: string,
    action: () => void,
    e: React.MouseEvent | React.TouchEvent
  ): boolean => {
    e.stopPropagation();

    // En desktop, ejecutar directamente
    if (!isMobile) {
      action();
      return true;
    }

    // En móvil, SIEMPRE prevenir el comportamiento por defecto
    e.preventDefault();

    const now = Date.now();
    const lastTap = lastTapTime[key] || 0;

    if (now - lastTap < DOUBLE_TAP_DELAY) {
      // Doble toque detectado - ejecutar acción
      action();
      setLastTapTime(prev => ({ ...prev, [key]: 0 }));
      return true;
    } else {
      // Primer toque - guardar tiempo, NO ejecutar
      setLastTapTime(prev => ({ ...prev, [key]: now }));
      return false;
    }
  }, [isMobile, lastTapTime]);

  // Estado para controlar dropdowns en móvil (para doble toque)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  // Ref para rastrear si la apertura fue intencional (doble toque)
  const intentionalOpenRef = useRef(false);
  // Ref para evitar que al cerrar el dropdown se abra el detalle de la card
  const menuJustClosedRef = useRef(false);

  // Handler para abrir menú de forma intencional
  const openMenuIntentionally = useCallback((machineId: number) => {
    intentionalOpenRef.current = true;
    setOpenMenuId(machineId);
  }, []);

  // Handler para cambio de estado del menú
  const handleMenuOpenChange = useCallback((open: boolean, machineId: number) => {
    if (open) {
      // Solo permitir abrir si fue intencional o no es móvil
      if (!isMobile || intentionalOpenRef.current) {
        setOpenMenuId(machineId);
      }
      intentionalOpenRef.current = false;
    } else {
      // Siempre permitir cerrar, marcar que acaba de cerrarse para bloquear el click de la card
      menuJustClosedRef.current = true;
      setOpenMenuId(null);
      setTimeout(() => { menuJustClosedRef.current = false; }, 300);
    }
  }, [isMobile]);

  // ✨ Drag & Drop: Sensores para dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Requiere mover 8px antes de iniciar drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ✨ Drag & Drop: Manejar fin del drag
  // Nota: usamos una función que cierra sobre sortedMachines directamente
  // en lugar de useCallback para que siempre tenga la referencia actual
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // Usar machines directamente (que es lo que muestra el grid)
      const currentMachines = sortField ? [...machines].sort((a, b) => {
        let valueA: any, valueB: any;
        switch (sortField) {
          case 'name':
            valueA = a.name.toLowerCase();
            valueB = b.name.toLowerCase();
            break;
          case 'healthScore':
            valueA = (a as any).healthScore ?? -1;
            valueB = (b as any).healthScore ?? -1;
            break;
          case 'status':
            valueA = a.status;
            valueB = b.status;
            break;
          case 'updatedAt':
            valueA = new Date(a.updatedAt || 0).getTime();
            valueB = new Date(b.updatedAt || 0).getTime();
            break;
          case 'createdAt':
            valueA = new Date(a.createdAt || 0).getTime();
            valueB = new Date(b.createdAt || 0).getTime();
            break;
          default:
            return 0;
        }
        if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      }) : machines;

      const oldIndex = currentMachines.findIndex(m => m.id === active.id);
      const newIndex = currentMachines.findIndex(m => m.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(currentMachines, oldIndex, newIndex);
        onDragReorder?.(newOrder.map(m => m.id));
      }
    }
  };

  const handleImageError = useCallback((machineId: number) => {
    setImageErrors(prev => ({ ...prev, [machineId]: true }));
    setImageLoading(prev => ({ ...prev, [machineId]: false }));
  }, []);

  const handleImageLoad = useCallback((machineId: number) => {
    setImageLoading(prev => ({ ...prev, [machineId]: false }));
  }, []);

  // Helper para obtener el badge del Health Score
  const getHealthScoreBadge = (score: number | null | undefined) => {
    if (score === null || score === undefined) return null;

    let bgColor = 'bg-muted-foreground';
    let label = 'Sin datos';

    if (score >= 80) {
      bgColor = 'bg-success';
      label = 'Bueno';
    } else if (score >= 50) {
      bgColor = 'bg-warning';
      label = 'Regular';
    } else {
      bgColor = 'bg-destructive';
      label = 'Crítico';
    }

    return (
      <Badge className={cn(bgColor, "text-white border-0 shadow-lg backdrop-blur-sm flex items-center gap-1 text-xs px-1.5 py-0.5")}>
        <Activity className="h-2.5 w-2.5" />
        {score}
      </Badge>
    );
  };

  // ✨ Helper para obtener el badge de garantía
  const getWarrantyBadge = (warrantyExpiration: Date | string | null | undefined) => {
    if (!warrantyExpiration) return null;

    const expirationDate = typeof warrantyExpiration === 'string'
      ? new Date(warrantyExpiration)
      : warrantyExpiration;

    if (isNaN(expirationDate.getTime())) return null;

    const today = new Date();
    const daysUntilExpiration = differenceInDays(expirationDate, today);
    const isExpired = isPast(expirationDate);

    if (isExpired) {
      return (
        <Badge className="bg-destructive/90 hover:bg-destructive text-destructive-foreground border-0 shadow-lg backdrop-blur-sm flex items-center gap-1 text-xs px-1.5 py-0.5" title="Garantía vencida">
          <ShieldAlert className="h-2.5 w-2.5" />
          Vencida
        </Badge>
      );
    }

    if (daysUntilExpiration <= 30) {
      return (
        <Badge className="bg-warning/90 hover:bg-warning text-warning-foreground border-0 shadow-lg backdrop-blur-sm flex items-center gap-1 text-xs px-1.5 py-0.5" title={`Garantía vence en ${daysUntilExpiration} días`}>
          <Shield className="h-2.5 w-2.5" />
          {daysUntilExpiration}d
        </Badge>
      );
    }

    if (daysUntilExpiration <= 90) {
      return (
        <Badge className="bg-success/90 hover:bg-success text-success-foreground border-0 shadow-lg backdrop-blur-sm flex items-center gap-1 text-xs px-1.5 py-0.5" title={`Garantía válida por ${daysUntilExpiration} días`}>
          <ShieldCheck className="h-2.5 w-2.5" />
          {Math.round(daysUntilExpiration / 30)}m
        </Badge>
      );
    }

    // Si la garantía es mayor a 90 días, no mostrar badge (ya está todo bien)
    return null;
  };

  const openHistoryDialog = (machine: Machine) => {
    setHistoryDialog({
      isOpen: true,
      machineId: machine.id,
      machineName: machine.name
    });
  };

  const closeHistoryDialog = () => {
    setHistoryDialog({
      isOpen: false,
      machineId: 0,
      machineName: ''
    });
  };

  // ✨ Ordenar máquinas según el campo y orden seleccionado
  const sortedMachines = useMemo(() => {
    if (!sortField) return machines;

    return [...machines].sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (sortField) {
        case 'name':
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
          break;
        case 'healthScore':
          valueA = (a as any).healthScore ?? -1;
          valueB = (b as any).healthScore ?? -1;
          break;
        case 'status':
          valueA = a.status;
          valueB = b.status;
          break;
        case 'updatedAt':
          valueA = new Date(a.updatedAt || 0).getTime();
          valueB = new Date(b.updatedAt || 0).getTime();
          break;
        case 'createdAt':
          valueA = new Date(a.createdAt || 0).getTime();
          valueB = new Date(b.createdAt || 0).getTime();
          break;
        default:
          return 0;
      }

      if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [machines, sortField, sortOrder]);

  // ✨ Helper para obtener el estado como texto
  const getStatusLabel = (status: MachineStatus | string) => {
    const statusStr = String(status).toUpperCase();
    switch (statusStr) {
      case 'ACTIVE': return 'Activo';
      case 'OUT_OF_SERVICE': return 'Fuera de servicio';
      case 'MAINTENANCE': return 'En Mantenimiento';
      case 'DECOMMISSIONED': return 'Dado de baja';
      default: return status;
    }
  };

  // Helper para obtener el indicador de estado (puntito de color)
  const getStatusDot = (status: MachineStatus | string) => {
    const statusStr = String(status).toUpperCase();
    switch (statusStr) {
      case 'ACTIVE':
        return <span className="w-3 h-3 rounded-full bg-success shadow-md shadow-success/50" title="Activo" />;
      case 'OUT_OF_SERVICE':
        return <span className="w-3 h-3 rounded-full bg-warning shadow-md shadow-warning/50" title="Fuera de servicio" />;
      case 'MAINTENANCE':
        return <span className="w-3 h-3 rounded-full bg-info shadow-md shadow-info/50" title="En Mantenimiento" />;
      case 'DECOMMISSIONED':
        return <span className="w-3 h-3 rounded-full bg-destructive shadow-md shadow-destructive/50" title="Baja" />;
      default:
        return <span className="w-3 h-3 rounded-full bg-muted-foreground shadow-md" title={String(status)} />;
    }
  };

  // Helper para obtener el color del borde según el estado
  const getStatusBorderColor = (status: MachineStatus | string) => {
    const statusStr = String(status).toUpperCase();
    switch (statusStr) {
      case 'ACTIVE':
        return 'border-l-4 border-l-success';
      case 'OUT_OF_SERVICE':
        return 'border-l-4 border-l-warning';
      case 'MAINTENANCE':
        return 'border-l-4 border-l-info';
      case 'DECOMMISSIONED':
        return 'border-l-4 border-l-destructive';
      default:
        return 'border-l-4 border-l-muted-foreground';
    }
  };

  const handleDelete = async (machine: Machine) => {
    if (onDelete) {
      await onDelete(machine);
    }
  };

  // Imagen de fallback por defecto
  const DEFAULT_MACHINE_IMAGE = "https://images.pexels.com/photos/3846226/pexels-photo-3846226.jpeg";

  const getFallbackImage = (machineName: string) => {
    const name = machineName.toLowerCase();
    if (name.includes('torno')) return "https://images.pexels.com/photos/2918000/pexels-photo-2918000.jpeg";
    if (name.includes('fresadora')) return "https://images.pexels.com/photos/3846226/pexels-photo-3846226.jpeg";
    if (name.includes('compresor')) return "https://images.pexels.com/photos/162553/keys-workshop-mechanic-tools-162553.jpeg";
    if (name.includes('robot')) return "https://images.pexels.com/photos/2085832/pexels-photo-2085832.jpeg";
    if (name.includes('envasadora')) return "https://images.pexels.com/photos/1267338/pexels-photo-1267338.jpeg";
    if (name.includes('transportador')) return "https://images.pexels.com/photos/236705/pexels-photo-236705.jpeg";
    if (name.includes('cabina')) return "https://images.pexels.com/photos/2760243/pexels-photo-2760243.jpeg";
    if (name.includes('mezcladora')) return "https://images.pexels.com/photos/5025669/pexels-photo-5025669.jpeg";
    return DEFAULT_MACHINE_IMAGE;
  };

  const getMachineImage = (machine: Machine) => {
    // Si hubo error cargando la imagen, usar fallback
    if (imageErrors[machine.id]) {
      return getFallbackImage(machine.name);
    }
    // Si la máquina tiene logo, úsalo
    if (machine.logo) {
      return machine.logo;
    }
    // Return placeholder images based on machine type and name
    return getFallbackImage(machine.name);
  };
  
  // Loading skeleton state
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <Card key={i} className="overflow-hidden bg-card border shadow-lg rounded-2xl">
            <Skeleton className="w-full h-40" />
            <div className="p-2 space-y-2">
              <Skeleton className="h-4 w-3/4 mx-auto" />
              <Skeleton className="h-3 w-1/2 mx-auto" />
              <Skeleton className="h-3 w-2/3 mx-auto" />
              <div className="pt-2 border-t space-y-1">
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-full" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // Handle empty state
  if (machines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center border rounded-lg bg-card/50">
        <FileText className="h-10 w-10 text-muted-foreground mb-2" />
        <h3 className="font-medium text-lg mb-1">No hay máquinas</h3>
        <p className="text-muted-foreground">
          No se encontraron máquinas con los filtros actuales.
        </p>
      </div>
    );
  }
  
  // ✨ Vista de Lista
  const renderListView = () => (
    <div className="space-y-2">
      {sortedMachines.map((machine) => (
        <div
          key={machine.id}
          className={cn("flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer", getStatusBorderColor(machine.status))}
          onClick={() => onSelect && onSelect(machine)}
        >
          {/* Imagen miniatura */}
          <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
            <Image
              src={getMachineImage(machine)}
              alt={machine.name}
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>

          {/* Información */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {getStatusDot(machine.status)}
              <h3 className={cn("font-medium truncate", getPrimaryTextClasses())}>{machine.name}</h3>
              {machine.nickname && (
                <span className={cn("text-sm truncate", getMutedTextClasses())}>"{machine.nickname}"</span>
              )}
            </div>
            <div className={cn("flex items-center gap-3 text-xs mt-1", getMutedTextClasses())}>
              {machine.brand && <span>{machine.brand}</span>}
              {machine.model && <span>• {machine.model}</span>}
              {machine.serialNumber && <span>• S/N: {machine.serialNumber}</span>}
            </div>
          </div>

          {/* Badges y acciones */}
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {getHealthScoreBadge((machine as any).healthScore)}
            {getWarrantyBadge((machine as any).warrantyExpiration)}
            {(machine as any).pendingWorkOrders > 0 && (
              <Badge variant="secondary" className="bg-warning-muted text-warning-muted-foreground">
                <Wrench className="h-3 w-3 mr-1" />
                {(machine as any).pendingWorkOrders}
              </Badge>
            )}
            {(machine as any).openFailures > 0 && (
              <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {(machine as any).openFailures}
              </Badge>
            )}

            {/* Acciones rápidas */}
            {onEdit && canEditMachine && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => { e.stopPropagation(); onEdit(machine); }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onDuplicate && canEditMachine && (
                  <DropdownMenuItem onClick={() => onDuplicate(machine)}>
                    <Copy className="h-4 w-4 mr-2" /> Duplicar
                  </DropdownMenuItem>
                )}
                {onGenerateQR && (
                  <DropdownMenuItem onClick={() => onGenerateQR(machine)}>
                    <QrCode className="h-4 w-4 mr-2" /> Código QR
                  </DropdownMenuItem>
                )}
                {canViewHistory && (
                  <DropdownMenuItem onClick={() => openHistoryDialog(machine)}>
                    <History className="h-4 w-4 mr-2" /> Ver historial
                  </DropdownMenuItem>
                )}
                {onDelete && canDeleteMachine && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDelete(machine)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  );

  // ✨ Vista de Tabla
  const renderTableView = () => (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Marca / Modelo</TableHead>
            <TableHead>Health Score</TableHead>
            <TableHead>OTs</TableHead>
            <TableHead>Fallas</TableHead>
            <TableHead className="w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedMachines.map((machine) => (
            <TableRow
              key={machine.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSelect && onSelect(machine)}
            >
              <TableCell>
                <div className="relative w-10 h-10 rounded overflow-hidden">
                  <Image
                    src={getMachineImage(machine)}
                    alt={machine.name}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{machine.name}</div>
                  {machine.nickname && (
                    <div className="text-xs text-muted-foreground">"{machine.nickname}"</div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getStatusDot(machine.status)}
                  <span className="text-sm">{getStatusLabel(machine.status)}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {machine.brand} {machine.model && `/ ${machine.model}`}
              </TableCell>
              <TableCell>{getHealthScoreBadge((machine as any).healthScore)}</TableCell>
              <TableCell>
                {(machine as any).pendingWorkOrders > 0 ? (
                  <Badge variant="secondary" className="bg-warning-muted text-warning-muted-foreground text-xs">
                    {(machine as any).pendingWorkOrders}
                  </Badge>
                ) : '-'}
              </TableCell>
              <TableCell>
                {(machine as any).openFailures > 0 ? (
                  <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">
                    {(machine as any).openFailures}
                  </Badge>
                ) : '-'}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onEdit && canEditMachine && (
                      <DropdownMenuItem onClick={() => onEdit(machine)}>
                        <Pencil className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                    )}
                    {onDuplicate && canEditMachine && (
                      <DropdownMenuItem onClick={() => onDuplicate(machine)}>
                        <Copy className="h-4 w-4 mr-2" /> Duplicar
                      </DropdownMenuItem>
                    )}
                    {onGenerateQR && (
                      <DropdownMenuItem onClick={() => onGenerateQR(machine)}>
                        <QrCode className="h-4 w-4 mr-2" /> Código QR
                      </DropdownMenuItem>
                    )}
                    {onDelete && canDeleteMachine && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(machine)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  // ✨ Renderizar grid con o sin drag & drop
  const renderGridContent = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {sortedMachines.map((machine, index) => {
        const cardContent = (
          <Card
            key={machine.id}
            className={cn("group overflow-hidden bg-card border shadow-lg hover:shadow-2xl transition-all duration-300 rounded-2xl cursor-pointer", getStatusBorderColor(machine.status))}
            onClick={(e) => {
              // No abrir el detalle si un menú acaba de cerrarse
              if (menuJustClosedRef.current) return;
              // No abrir el detalle si el clic viene de un botón de acción o del drag handle
              if (e.target instanceof Element) {
                const isActionButton = e.target.closest('button') || e.target.closest('[role="button"]') || e.target.closest('[data-drag-handle]');
                if (isActionButton) {
                  return;
                }
              }
              if (!isReorderMode) {
                onSelect && onSelect(machine);
              }
            }}
          >
          {/* Header con imagen */}
          <div className="relative w-full h-40 overflow-hidden">
            <Image
              src={getMachineImage(machine)}
              alt={machine.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              onError={() => handleImageError(machine.id)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            
            {/* Título superpuesto */}
            <div className="absolute bottom-4 left-4 right-4">
              <h3 className="text-white font-semibold text-lg leading-tight drop-shadow-lg line-clamp-2">
                {machine.name}
              </h3>
              {machine.nickname && (
                <p className="text-white/90 text-sm mt-1 drop-shadow">
                  &quot;{machine.nickname}&quot;
                </p>
              )}
            </div>

            {/* ✨ Botones superiores: Menú (3 puntos) + Favorito + Selección */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 z-10">
              {/* Menú de 3 puntitos (Editar, Duplicar, QR, Historial, Falla, Eliminar) */}
              {/* En móvil requiere doble toque para evitar toques accidentales al scrollear */}
              <DropdownMenu open={openMenuId === machine.id} onOpenChange={(open) => handleMenuOpenChange(open, machine.id)}>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => {
                      handleMobileDoubleTap(
                        `menu-${machine.id}`,
                        () => openMenuIntentionally(machine.id),
                        e
                      );
                    }}
                    onPointerDown={(e) => {
                      // Prevenir que Radix UI abra el menú automáticamente en móvil
                      if (isMobile) {
                        e.preventDefault();
                      }
                    }}
                    className={cn(
                      "p-1.5 rounded-full transition-all bg-background/80 text-muted-foreground hover:bg-background shadow-md",
                      isMobile && lastTapTime[`menu-${machine.id}`] && "ring-2 ring-primary/50"
                    )}
                    title={isMobile ? "Toca dos veces para opciones" : "Más opciones"}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {onEdit && canEditMachine && (
                    <DropdownMenuItem onClick={() => onEdit(machine)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  {onDuplicate && canEditMachine && (
                    <DropdownMenuItem onClick={() => onDuplicate(machine)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicar
                    </DropdownMenuItem>
                  )}
                  {onGenerateQR && (
                    <DropdownMenuItem onClick={() => onGenerateQR(machine)}>
                      <QrCode className="h-4 w-4 mr-2" />
                      Generar QR
                    </DropdownMenuItem>
                  )}
                  {canViewHistory && (
                    <DropdownMenuItem onClick={() => openHistoryDialog(machine)}>
                      <History className="h-4 w-4 mr-2" />
                      Ver historial
                    </DropdownMenuItem>
                  )}
                  {canReportFailure && onReportFailure && (
                    <DropdownMenuItem onClick={() => onReportFailure(machine)}>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Reportar falla
                    </DropdownMenuItem>
                  )}
                  {onDelete && canDeleteMachine && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Eliminar máquina',
                            description: `¿Estás seguro de eliminar la máquina "${machine.name}"?`,
                            confirmText: 'Eliminar',
                            variant: 'destructive',
                          });
                          if (!ok) return;
                          handleDelete(machine);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Favorito - En móvil requiere doble toque */}
              {onToggleFavorite && (
                <button
                  onClick={(e) => {
                    handleMobileDoubleTap(
                      `fav-${machine.id}`,
                      () => onToggleFavorite(machine.id),
                      e
                    );
                  }}
                  className={cn(
                    "p-1.5 rounded-full transition-all",
                    favorites.has(machine.id)
                      ? "bg-warning text-warning-foreground shadow-lg"
                      : isMobile && lastTapTime[`fav-${machine.id}`]
                        ? "bg-background/80 text-warning ring-2 ring-warning/50 shadow-md"
                        : "bg-background/80 text-muted-foreground hover:text-warning hover:bg-background shadow-md"
                  )}
                  title={isMobile
                    ? (favorites.has(machine.id) ? 'Toca 2 veces para quitar' : 'Toca 2 veces para destacar')
                    : (favorites.has(machine.id) ? 'Quitar de favoritos' : 'Agregar a favoritos')
                  }
                >
                  <Star className={cn("h-3.5 w-3.5", favorites.has(machine.id) && "fill-current")} />
                </button>
              )}
              {/* Checkbox de selección */}
              {isMultiSelectMode && onToggleSelection && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelection(machine.id);
                  }}
                  className={cn(
                    "p-1.5 rounded-full transition-all",
                    selectedMachineIds.has(machine.id)
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : "bg-background/80 text-muted-foreground hover:text-primary hover:bg-background shadow-md"
                  )}
                >
                  {selectedMachineIds.has(machine.id) ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>

            {/* Status dot + KPI badges */}
            <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap">
              {getStatusDot(machine.status)}
              {/* Health Score Badge */}
              {getHealthScoreBadge((machine as any).healthScore)}
              {/* Warranty Badge */}
              {getWarrantyBadge((machine as any).warrantyExpiration)}
              {/* KPI Badges */}
              {(machine as any).pendingWorkOrders > 0 && (
                <Badge className="bg-warning/90 hover:bg-warning text-warning-foreground border-0 shadow-lg backdrop-blur-sm flex items-center gap-1 text-xs px-1.5 py-0.5">
                  <Wrench className="h-2.5 w-2.5" />
                  {(machine as any).pendingWorkOrders}
                </Badge>
              )}
              {(machine as any).openFailures > 0 && (
                <Badge className="bg-destructive/90 hover:bg-destructive text-destructive-foreground border-0 shadow-lg backdrop-blur-sm flex items-center gap-1 text-xs px-1.5 py-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {(machine as any).openFailures}
                </Badge>
              )}
            </div>
          </div>

          {/* Contenido de la card */}
          <CardContent className={getCardContentClasses()}>
            {/* Sector */}
            {(machine as any).sector?.name && (
              <div className="flex items-center justify-center gap-1 mb-2 pb-2 border-b border-border/50">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span className={cn("text-xs", getMutedTextClasses())}>
                  {(machine as any).sector.name}
                </span>
              </div>
            )}

            {/* Información básica */}
            <div className="space-y-2">

              <div className="flex items-center justify-center gap-2">
                <span className={cn("text-xs", getMutedTextClasses())}>
                  Marca
                </span>
                <span className={cn("text-sm", getPrimaryTextClasses())}>
                  {machine.brand || '—'}
                </span>
              </div>

              <div className="flex items-center justify-center gap-2">
                <span className={cn("text-xs", getMutedTextClasses())}>
                  Modelo
                </span>
                <span className={cn("text-sm", getPrimaryTextClasses())}>
                  {machine.model || '—'}
                </span>
              </div>

              <div className="flex items-center justify-center gap-2">
                <span className={cn("text-xs", getMutedTextClasses())}>
                  Serie
                </span>
                {machine.serialNumber ? (
                  <span className={cn("text-xs font-mono px-2 py-1 rounded-md", getPrimaryTextClasses(), getBackgroundAccentClasses())}>
                    {machine.serialNumber.length > 12
                      ? `${machine.serialNumber.substring(0, 12)}...`
                      : machine.serialNumber}
                  </span>
                ) : (
                  <span className={cn("text-sm", getPrimaryTextClasses())}>
                    No especificado
                  </span>
                )}
              </div>

              {/* Contador de componentes */}
              {(machine as any)._count?.components > 0 && (
                <div className="flex items-center justify-center gap-1.5">
                  <Settings className="h-3 w-3 text-muted-foreground" />
                  <span className={cn("text-xs", getMutedTextClasses())}>
                    {(machine as any)._count.components} componentes
                  </span>
                </div>
              )}
            </div>
            
            {/* Botones de acción */}
            <div className="mt-2 pt-1.5 border-t border-border space-y-1">
              {onCreateWorkOrder && (
                              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateWorkOrder(machine);
                }}
                className={cn("w-full h-7", getButtonClasses('primary'))}
                size="sm"
              >
                <Zap className="h-3 w-3 mr-1" />
                <span className="text-xs">Crear Orden Rápida</span>
              </Button>
            )}
            
            {canViewHistory && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  openHistoryDialog(machine);
                }}
                variant="outline"
                className={cn("w-full h-7", getButtonClasses('outline'))}
                size="sm"
              >
                <History className="h-3 w-3 mr-1" />
                <span className="text-xs">Ver Historial</span>
              </Button>
            )}

            {/* Botón Reportar Falla */}
            {canReportFailure && onReportFailure && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onReportFailure(machine);
                }}
                variant="outline"
                className={cn(
                  "w-full h-7 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive",
                  theme === 'metal' && "border-destructive/50 text-destructive hover:bg-destructive/10"
                )}
                size="sm"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                <span className="text-xs">Reportar Falla</span>
              </Button>
            )}

            {/* Botones de reordenamiento - solo aparecen en modo reordenar sin drag */}
            {isReorderMode && onReorder && !onDragReorder && (
              <div className="flex gap-1 justify-center mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("flex-1 h-7 px-2 text-sm", getButtonClasses('outline'))}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReorder(machine.id, 'left');
                  }}
                  title="Mover hacia la izquierda"
                >
                  ←
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("flex-1 h-7 px-2 text-sm", getButtonClasses('outline'))}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReorder(machine.id, 'right');
                  }}
                  title="Mover hacia la derecha"
                >
                  →
                </Button>
              </div>
            )}
            </div>
          </CardContent>
        </Card>
        );

        // Si hay drag reorder, envolver con SortableItem
        if (isReorderMode && onDragReorder) {
          return (
            <SortableItem key={machine.id} id={machine.id}>
              {cardContent}
            </SortableItem>
          );
        }

        return cardContent;
      })}
    </div>
  );

  return (
    <>
      {/* Renderizar según viewMode */}
      {viewMode === 'list' && renderListView()}
      {viewMode === 'table' && renderTableView()}
      {viewMode === 'grid' && (
        isReorderMode && onDragReorder ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedMachines.map(m => m.id)}
              strategy={rectSortingStrategy}
            >
              {renderGridContent()}
            </SortableContext>
          </DndContext>
        ) : (
          renderGridContent()
        )
      )}

      {/* Dialog de historial - siempre renderizado para todos los view modes */}
      <MachineHistoryDialog
        isOpen={historyDialog.isOpen}
        onClose={closeHistoryDialog}
        machineId={historyDialog.machineId}
        machineName={historyDialog.machineName}
      />
    </>
  );
}