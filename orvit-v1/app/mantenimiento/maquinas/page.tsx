'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { MachineStatus, MachineType, Machine, MachineComponent } from '@/lib/types';
import MachineGrid, { ViewMode, SortField, SortOrder } from '@/components/maquinas/MachineGrid';
import MachineDialog from '@/components/maquinas/MachineDialog';
import MachineDetailDialog from '@/components/maquinas/MachineDetailDialog';
import ComponentDetailsModal from '@/components/maquinas/ComponentDetailsModal';
import PlantZoneDialog from '@/components/maquinas/PlantZoneDialog';
import ZoneSchemaView from '@/components/maquinas/ZoneSchemaView';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Search,
  Loader2,
  GitBranch,
  X,
  RotateCcw,
  Pencil,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Cog,
  ChevronDown,
  Building2,
  Download,
  FileJson,
  FileSpreadsheet,
  QrCode,
  Copy,
  LayoutGrid,
  List,
  TableIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Heart,
  Shield,
  AlertTriangle,
  Wrench,
  Factory,
  Filter,
  Star,
  Trash2,
  CheckSquare,
  Square,
  Check,
  Network,
  Sparkles,
  FileUp,
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useMachinesInitial } from '@/hooks/use-machines-initial';

export default function MaquinasPage() {
  const { currentArea, currentSector, isLoading: companyLoading } = useCompany();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { theme } = useTheme();
  const router = useRouter();

  // Helper functions for theme-based styling
  const getButtonClasses = (variant: 'primary' | 'outline' | 'secondary' = 'primary') => {
    switch (theme) {
      case 'light':
        return variant === 'primary' ? 'bg-black hover:bg-gray-800 text-white' : 
               variant === 'outline' ? 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700' :
               'bg-gray-100 hover:bg-gray-200 text-gray-900';
      case 'dark':
        return variant === 'primary' ? 'bg-white hover:bg-gray-200 text-black' : 
               variant === 'outline' ? 'border border-gray-600 bg-zinc-800 hover:bg-zinc-700 text-white' :
               'bg-zinc-700 hover:bg-zinc-600 text-white';
      case 'metal':
        return variant === 'primary' ? 'bg-[#58717D] hover:bg-[#4A6068] text-[#F4FEFE]' : 
               variant === 'outline' ? 'border border-[#3A4F5A] bg-[#1E3A46] hover:bg-[#182B31] text-[#F4FEFE]' :
               'bg-[#58717D] hover:bg-[#4A6068] text-[#F4FEFE]';
      default:
        return variant === 'primary' ? 'bg-black hover:bg-gray-800 text-white' : 
               variant === 'outline' ? 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700' :
               'bg-gray-100 hover:bg-gray-200 text-gray-900';
    }
  };

  const getInputClasses = () => {
    switch (theme) {
      case 'light':
        return 'bg-white border-gray-300 text-gray-900 placeholder-gray-500';
      case 'dark':
        return 'bg-zinc-800 border-gray-600 text-white placeholder-gray-400';
      case 'metal':
        return 'bg-[#1E3A46] border-[#3A4F5A] text-[#F4FEFE] placeholder-[#B4C3CC]';
      default:
        return 'bg-white border-gray-300 text-gray-900 placeholder-gray-500';
    }
  };

  const getSelectClasses = () => {
    switch (theme) {
      case 'light':
        return 'bg-white border-gray-300 text-gray-900';
      case 'dark':
        return 'bg-zinc-800 border-gray-600 text-white';
      case 'metal':
        return 'bg-[#1E3A46] border-[#3A4F5A] text-[#F4FEFE]';
      default:
        return 'bg-white border-gray-300 text-gray-900';
    }
  };

  // 🔍 PERMISOS DE MÁQUINAS
  const { hasPermission: canCreateMachine } = usePermissionRobust('crear_maquina');
  const { hasPermission: canEditMachine } = usePermissionRobust('editar_maquina');
  const { hasPermission: canDeleteMachine } = usePermissionRobust('eliminar_maquina');
  const { hasPermission: canViewMachineHistory } = usePermissionRobust('ver_historial_maquina');

  // console.log('🔥🔥🔥 PERMISOS MAQUINAS (MANTENIMIENTO):', {
  //   usuario: currentUser?.name,
  //   rol: currentUser?.role,
  //   permisos: { canCreateMachine, canEditMachine, canDeleteMachine }
  // });
  const [machines, setMachines] = useState<Machine[]>([]);

  // ✨ MEJORA: Filtros persistentes en localStorage
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('machines_filter_search') || '';
    }
    return '';
  });
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('machines_filter_status') || 'all';
    }
    return 'all';
  });
  const [typeFilter, setTypeFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('machines_filter_type') || 'all';
    }
    return 'all';
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('id');
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedComponentId, setSelectedComponentId] = useState<number | undefined>(undefined);

  // Estado para modal de detalle de componente (desde esquema de zonas)
  const [selectedComponent, setSelectedComponent] = useState<MachineComponent | null>(null);
  const [isComponentDetailOpen, setIsComponentDetailOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<string>('info');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentEditMachine, setCurrentEditMachine] = useState<Machine | null>(null);
  const [machineOrder, setMachineOrder] = useState<{[key: string]: number}>({});
  const [isSavingMachineOrder, setIsSavingMachineOrder] = useState(false);
  const [selectedMachineForReorder, setSelectedMachineForReorder] = useState<Machine | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [hasOrderChanges, setHasOrderChanges] = useState(false);

  // ✨ Estados para Zonas de Planta
  const [plantZones, setPlantZones] = useState<any[]>([]);
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);
  const [currentEditZone, setCurrentEditZone] = useState<any | null>(null);
  const [selectedParentZone, setSelectedParentZone] = useState<any | null>(null);
  // ✨ MEJORA: Persistir estado de expansión de zonas en localStorage
  const [expandedZones, setExpandedZones] = useState<Set<number>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('machines_expanded_zones');
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch {
          return new Set();
        }
      }
    }
    return new Set();
  });
  const [isLoadingZones, setIsLoadingZones] = useState(false);
  const [preselectedZoneId, setPreselectedZoneId] = useState<number | undefined>(undefined);
  const [isExporting, setIsExporting] = useState(false);

  // ✨ MEJORA: Selección múltiple y favoritos
  const [selectedMachineIds, setSelectedMachineIds] = useState<Set<number>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('machines_favorites');
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch {
          return new Set();
        }
      }
    }
    return new Set();
  });

  // ✨ MEJORA: Filtros avanzados
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<{
    minHealthScore: number;
    maxHealthScore: number;
    hasWarrantyExpiring: boolean;
    hasOpenFailures: boolean;
    hasPendingWorkOrders: boolean;
    brands: string[];
    productionLines: string[];
  }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('machines_advanced_filters');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // Default values
        }
      }
    }
    return {
      minHealthScore: 0,
      maxHealthScore: 100,
      hasWarrantyExpiring: false,
      hasOpenFailures: false,
      hasPendingWorkOrders: false,
      brands: [],
      productionLines: [],
    };
  });

  // Conteo de filtros activos
  const activeAdvancedFiltersCount = [
    advancedFilters.minHealthScore > 0,
    advancedFilters.maxHealthScore < 100,
    advancedFilters.hasWarrantyExpiring,
    advancedFilters.hasOpenFailures,
    advancedFilters.hasPendingWorkOrders,
    advancedFilters.brands.length > 0,
    advancedFilters.productionLines.length > 0,
  ].filter(Boolean).length;

  // ✨ MEJORA: View modes y ordenamiento
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('machines_view_mode') as ViewMode) || 'grid';
    }
    return 'grid';
  });
  const [sortField, setSortField] = useState<SortField | undefined>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('machines_sort_field');
      return saved ? (saved as SortField) : undefined;
    }
    return undefined;
  });
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('machines_sort_order') as SortOrder) || 'asc';
    }
    return 'asc';
  });

  // ✨ MEJORA: Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15; // Máquinas por página

  // ✨ OPTIMIZADO: Usar hook con React Query (1 solo request)
  const companyIdNum = currentSector?.companyId ? parseInt(String(currentSector.companyId)) : null;
  const sectorIdNum = currentSector?.id ? parseInt(String(currentSector.id)) : null;
  const { data: machinesData, isLoading, refetch: refetchMachines } = useMachinesInitial(
    companyIdNum,
    sectorIdNum,
    { enabled: !!sectorIdNum }
  );

  // ✨ Sincronizar datos del hook con estados locales
  useEffect(() => {
    if (machinesData?.machines && !isLoading) {
      const machinesList = machinesData.machines as Machine[];
      setMachines(machinesList);
    }
  }, [machinesData?.machines, isLoading]);

  // ✨ Cargar zonas de planta
  const fetchPlantZones = useCallback(async () => {
    if (!sectorIdNum || !companyIdNum) return;

    setIsLoadingZones(true);
    try {
      const response = await fetch(
        `/api/plant-zones?sectorId=${sectorIdNum}&companyId=${companyIdNum}&includeChildren=true&includeMachines=true`
      );
      if (response.ok) {
        const data = await response.json();
        setPlantZones(data);
        // Expandir todas las zonas por defecto
        const allZoneIds = new Set<number>();
        const collectIds = (zones: any[]) => {
          zones.forEach(z => {
            allZoneIds.add(z.id);
            if (z.children?.length) collectIds(z.children);
          });
        };
        collectIds(data);
        setExpandedZones(allZoneIds);
      }
    } catch (error) {
      console.error('Error al cargar zonas:', error);
    } finally {
      setIsLoadingZones(false);
    }
  }, [sectorIdNum, companyIdNum]);

  useEffect(() => {
    fetchPlantZones();
  }, [fetchPlantZones]);

  // ✨ MEJORA: Persistir filtros en localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('machines_filter_search', searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('machines_filter_status', statusFilter);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('machines_filter_type', typeFilter);
    }
  }, [typeFilter]);

  // Efecto para cerrar el modal de detalle cuando selectedMachine sea null
  useEffect(() => {
    if (!selectedMachine && isDetailOpen) {
      setIsDetailOpen(false);
    }
  }, [selectedMachine, isDetailOpen]);

  // Función para aplicar el orden al array de máquinas
  const applyOrderToMachines = useCallback((order: {[key: string]: number}) => {
    setMachines(prevMachines => {
      // Crear un array ordenado basado en el orden guardado
      const sortedMachines = [...prevMachines].sort((a, b) => {
        const orderA = order[a.id.toString()] || 999;
        const orderB = order[b.id.toString()] || 999;
        return orderA - orderB;
      });
      
      // console.log('🔄 [APPLY ORDER] Aplicando orden al array de máquinas');
      return sortedMachines;
    });
  }, []);


  // Cargar orden solo cuando se cargan las máquinas por primera vez
  useEffect(() => {
    if (machines.length > 0 && Object.keys(machineOrder).length === 0) {
      // Cargar orden directamente sin usar la función que causa loops
      const loadOrder = async () => {
        if (!currentSector?.companyId) return;
        
        try {
          const response = await fetch(`/api/companies/${currentSector.companyId}/machine-order`);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.order) {
              setMachineOrder(data.order);
              // Aplicar el orden al array de máquinas
              applyOrderToMachines(data.order);
              return;
            }
          }
        } catch (error) {
          // Silently fail
        }
        
        // Si no hay en la API, intentar desde localStorage
        const localStorageKey = `company_${currentSector.companyId}_machine_order`;
        const savedOrder = localStorage.getItem(localStorageKey);
        
        if (savedOrder) {
          try {
            const parsedOrder = JSON.parse(savedOrder);
            setMachineOrder(parsedOrder);
            applyOrderToMachines(parsedOrder);
            return;
          } catch (error) {
            // Silently fail
          }
        }
        
        // Si no hay orden guardado en ningún lado, crear orden por defecto
        const initialOrder = machines.reduce((acc, machine, index) => {
          acc[machine.id.toString()] = index + 1;
          return acc;
        }, {} as {[key: string]: number});
        setMachineOrder(initialOrder);
      };
      
      loadOrder();
    }
  }, [machines.length, currentSector?.companyId]);

  // Función para guardar el orden de máquinas en la base de datos
  const saveMachineOrder = useCallback(async (newOrder: {[key: string]: number}) => {
    if (!currentSector?.companyId) {
      console.warn('No hay companyId, no se puede guardar el orden');
      return;
    }
    
    setIsSavingMachineOrder(true);
    
    // Guardar en localStorage inmediatamente (solución temporal)
    const localStorageKey = `company_${currentSector.companyId}_machine_order`;
    localStorage.setItem(localStorageKey, JSON.stringify(newOrder));
    
    try {
      const response = await fetch(`/api/companies/${currentSector.companyId}/machine-order`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order: newOrder }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al guardar el orden');
      }
      
      const result = await response.json();
      console.log('✅ Orden de máquinas guardado exitosamente:', result);
      
      // Mostrar toast de éxito (solo si no hay error)
      toast({
        title: "Orden guardado",
        description: "El orden de las máquinas se ha guardado correctamente",
      });
    } catch (error) {
      console.error('❌ Error al guardar el orden de máquinas en API:', error);
      // El orden ya está guardado en localStorage, así que no es crítico
      // Pero mostramos un warning
      toast({
        title: "Advertencia",
        description: "El orden se guardó localmente pero hubo un problema al guardarlo en el servidor",
        variant: "destructive",
      });
    } finally {
      setIsSavingMachineOrder(false);
    }
  }, [currentSector?.companyId, toast]);

  // Funciones para reordenar máquinas - ENFOQUE SIMPLE
  const handleReorderMachine = useCallback(async (machineId: number, direction: 'left' | 'right') => {
    if (!currentSector?.companyId) return;
    
    // Trabajar sobre el array filtrado visible (sortedMachines) para que el cambio sea inmediato
    setMachines(prevMachines => {
      // Crear una copia del array
      const newMachines = [...prevMachines];
      
      // Encontrar el índice de la máquina actual
      const currentIndex = newMachines.findIndex(m => m.id === machineId);
      
      if (currentIndex === -1) {
        return prevMachines;
      }
      
      // Calcular nuevo índice
      let newIndex = currentIndex;
      if (direction === 'left' && currentIndex > 0) {
        newIndex = currentIndex - 1;
      } else if (direction === 'right' && currentIndex < newMachines.length - 1) {
        newIndex = currentIndex + 1;
      } else {
        return prevMachines;
      }
      
      // Intercambiar las máquinas en el array
      [newMachines[currentIndex], newMachines[newIndex]] = 
      [newMachines[newIndex], newMachines[currentIndex]];
      
      // Actualizar el orden en el estado
      const newOrder = newMachines.reduce((acc, machine, index) => {
        acc[machine.id.toString()] = index + 1;
        return acc;
      }, {} as {[key: string]: number});
      
      // Actualizar el estado del orden
      setMachineOrder(newOrder);

      // Marcar que hay cambios pendientes (NO guardar automáticamente)
      setHasOrderChanges(true);

      return newMachines;
    });
  }, [currentSector?.companyId, saveMachineOrder, toast]);

  // ✨ Drag & Drop: Manejar nuevo orden de máquinas
  const handleDragReorder = useCallback((newMachineIds: number[]) => {
    // Crear un mapa de la nueva posición para las máquinas reordenadas
    const newPositionMap = new Map(newMachineIds.map((id, index) => [id, index]));
    const reorderedSet = new Set(newMachineIds);

    // Función helper para reordenar un array de máquinas
    const reorderMachineArray = (machinesArray: Machine[]): Machine[] => {
      const reorderedMachines: Machine[] = [];
      const otherMachines: Machine[] = [];

      for (const machine of machinesArray) {
        if (reorderedSet.has(machine.id)) {
          reorderedMachines.push(machine);
        } else {
          otherMachines.push(machine);
        }
      }

      // Si no hay máquinas para reordenar en este array, retornar como está
      if (reorderedMachines.length === 0) {
        return machinesArray;
      }

      // Ordenar las máquinas reordenadas según el nuevo orden
      reorderedMachines.sort((a, b) => {
        const posA = newPositionMap.get(a.id) ?? 0;
        const posB = newPositionMap.get(b.id) ?? 0;
        return posA - posB;
      });

      // Reconstruir el array
      const result: Machine[] = [];
      let reorderedInserted = false;

      for (const machine of machinesArray) {
        if (reorderedSet.has(machine.id)) {
          if (!reorderedInserted) {
            result.push(...reorderedMachines);
            reorderedInserted = true;
          }
        } else {
          result.push(machine);
        }
      }

      if (!reorderedInserted) {
        result.push(...reorderedMachines);
      }

      return result;
    };

    // Reordenar el array completo de máquinas (sin zona)
    setMachines(prevMachines => reorderMachineArray(prevMachines));

    // ✨ También actualizar las máquinas dentro de plantZones
    setPlantZones(prevZones => {
      // Función recursiva para actualizar zonas y sub-zonas
      const updateZoneMachines = (zones: any[]): any[] => {
        return zones.map(zone => {
          const updatedZone = { ...zone };

          // Actualizar máquinas de esta zona si las tiene
          if (zone.machines && zone.machines.length > 0) {
            updatedZone.machines = reorderMachineArray(zone.machines);
          }

          // Recursivamente actualizar sub-zonas
          if (zone.children && zone.children.length > 0) {
            updatedZone.children = updateZoneMachines(zone.children);
          }

          return updatedZone;
        });
      };

      return updateZoneMachines(prevZones);
    });

    // Actualizar el orden global
    setMachineOrder(prev => {
      const newOrder = { ...prev };
      newMachineIds.forEach((id, index) => {
        newOrder[id.toString()] = index + 1;
      });
      return newOrder;
    });

    // Marcar que hay cambios pendientes
    setHasOrderChanges(true);
  }, []);

  // Filtrado y ordenamiento de máquinas - USAR ORDEN DEL ARRAY DIRECTAMENTE
  const filteredMachines = machines.filter(machine => {
    const matchesSearch = searchQuery === '' ||
      machine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (machine.nickname || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || machine.status === statusFilter;
    const matchesType = typeFilter === 'all' || machine.type === typeFilter;

    // ✨ Filtros avanzados
    const machineAny = machine as any;

    // Health Score
    const healthScore = machineAny.healthScore ?? 100;
    const matchesHealthScore = healthScore >= advancedFilters.minHealthScore &&
                                healthScore <= advancedFilters.maxHealthScore;

    // Garantía por vencer (próximos 30 días)
    let matchesWarrantyExpiring = true;
    if (advancedFilters.hasWarrantyExpiring) {
      const warrantyDate = machineAny.warrantyExpiration ? new Date(machineAny.warrantyExpiration) : null;
      if (warrantyDate) {
        const daysUntil = Math.ceil((warrantyDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        matchesWarrantyExpiring = daysUntil <= 30 && daysUntil >= 0;
      } else {
        matchesWarrantyExpiring = false;
      }
    }

    // Fallas abiertas
    let matchesOpenFailures = true;
    if (advancedFilters.hasOpenFailures) {
      matchesOpenFailures = (machineAny.openFailures ?? 0) > 0;
    }

    // OTs pendientes
    let matchesPendingWorkOrders = true;
    if (advancedFilters.hasPendingWorkOrders) {
      matchesPendingWorkOrders = (machineAny.pendingWorkOrders ?? 0) > 0;
    }

    // Marca
    let matchesBrand = true;
    if (advancedFilters.brands.length > 0) {
      matchesBrand = machine.brand ? advancedFilters.brands.includes(machine.brand) : false;
    }

    // Línea de producción
    let matchesProductionLine = true;
    if (advancedFilters.productionLines.length > 0) {
      matchesProductionLine = machine.productionLine ? advancedFilters.productionLines.includes(machine.productionLine) : false;
    }

    return matchesSearch && matchesStatus && matchesType &&
           matchesHealthScore && matchesWarrantyExpiring && matchesOpenFailures &&
           matchesPendingWorkOrders && matchesBrand && matchesProductionLine;
  });

  // ✨ MEJORA: Paginación
  const totalPages = Math.ceil(filteredMachines.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const sortedMachines = filteredMachines.slice(startIndex, startIndex + pageSize);

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter, advancedFilters]);

  // ✨ MEJORA: Persistir view mode y sort preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('machines_view_mode', viewMode);
    }
  }, [viewMode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (sortField) {
        localStorage.setItem('machines_sort_field', sortField);
      } else {
        localStorage.removeItem('machines_sort_field');
      }
    }
  }, [sortField]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('machines_sort_order', sortOrder);
    }
  }, [sortOrder]);

  // Handler para cambiar el ordenamiento
  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      // Si es el mismo campo, alternar orden
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // Si es un nuevo campo, usar orden ascendente
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // ✨ MEJORA: Persistir filtros avanzados
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('machines_advanced_filters', JSON.stringify(advancedFilters));
    }
  }, [advancedFilters]);

  // Handler para limpiar filtros avanzados
  const clearAdvancedFilters = () => {
    setAdvancedFilters({
      minHealthScore: 0,
      maxHealthScore: 100,
      hasWarrantyExpiring: false,
      hasOpenFailures: false,
      hasPendingWorkOrders: false,
      brands: [],
      productionLines: [],
    });
  };

  // ✨ Obtener listas únicas de brands y production lines para los filtros
  const uniqueBrands = Array.from(new Set(machines.filter(m => m.brand).map(m => m.brand!)));
  const uniqueProductionLines = Array.from(new Set(machines.filter(m => m.productionLine).map(m => m.productionLine!)));

  // ✨ MEJORA: Persistir favoritos
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('machines_favorites', JSON.stringify(Array.from(favorites)));
    }
  }, [favorites]);

  // Handlers para selección múltiple
  const toggleMachineSelection = (machineId: number) => {
    setSelectedMachineIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(machineId)) {
        newSet.delete(machineId);
      } else {
        newSet.add(machineId);
      }
      return newSet;
    });
  };

  const selectAllMachines = () => {
    const allIds = filteredMachines.map(m => m.id);
    setSelectedMachineIds(new Set(allIds));
  };

  const clearSelection = () => {
    setSelectedMachineIds(new Set());
    setIsMultiSelectMode(false);
  };

  // Handlers para favoritos
  const toggleFavorite = (machineId: number) => {
    setFavorites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(machineId)) {
        newSet.delete(machineId);
        toast({ title: 'Eliminado de favoritos' });
      } else {
        newSet.add(machineId);
        toast({ title: 'Agregado a favoritos' });
      }
      return newSet;
    });
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedMachineIds.size === 0) return;

    const confirmDelete = window.confirm(
      `¿Estás seguro de eliminar ${selectedMachineIds.size} máquina${selectedMachineIds.size > 1 ? 's' : ''}? Esta acción no se puede deshacer.`
    );

    if (!confirmDelete) return;

    try {
      const deletePromises = Array.from(selectedMachineIds).map(id =>
        fetch(`/api/maquinas/${id}`, { method: 'DELETE' })
      );

      await Promise.all(deletePromises);

      toast({ title: 'Máquinas eliminadas', description: `Se eliminaron ${selectedMachineIds.size} máquina${selectedMachineIds.size > 1 ? 's' : ''} correctamente.` });
      clearSelection();
      refetchMachines();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron eliminar algunas máquinas', variant: 'destructive' });
    }
  };

  const handleAddMachine = async (machine: any) => {
    try {
      const payload = {
        ...machine,
        companyId: currentSector?.companyId || '1',
        sectorId: currentSector?.id || '1'
      };
      
      const response = await fetch('/api/maquinas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Error al agregar la máquina');

      await response.json();
      refetchMachines(); // ✨ Usar refetch en lugar de actualizar estado local
      await fetchPlantZones(); // Refrescar zonas para mostrar la máquina
      setIsDialogOpen(false);
      setPreselectedZoneId(undefined);
      toast({
        title: 'Máquina agregada',
        description: 'La máquina ha sido agregada correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo agregar la máquina',
        variant: 'destructive',
      });
    }
  };

  const handleEditMachine = async (machine: any) => {
    if (!machine.id) {
      alert('Error: la máquina no tiene ID. No se puede actualizar.');
      return;
    }
    try {
      const response = await fetch(`/api/maquinas/${machine.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(machine),
      });

      if (!response.ok) throw new Error('Error al editar la máquina');

      const updatedMachine = await response.json();
      refetchMachines(); // ✨ Usar refetch en lugar de actualizar estado local
      await fetchPlantZones(); // Refrescar zonas por si se cambió la zona
      setIsEditDialogOpen(false);
      setIsDetailOpen(false);
      // Mantener la máquina seleccionada para reordenar después de editar
      if (currentEditMachine) {
        setSelectedMachineForReorder({ ...currentEditMachine, ...updatedMachine });
      }
      toast({
        title: 'Máquina actualizada',
        description: 'La máquina ha sido actualizada correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la máquina',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteMachine = async (machine: Machine) => {
    try {
      // Cerrar modales ANTES de eliminar para evitar conflictos
      if (selectedMachine && Number(selectedMachine.id) === Number(machine.id)) {
        setIsDetailOpen(false);
        setSelectedMachine(null);
      }
      
      if (currentEditMachine && Number(currentEditMachine.id) === Number(machine.id)) {
        setIsEditDialogOpen(false);
        setCurrentEditMachine(null);
      }
      
      const response = await fetch(`/api/maquinas/${machine.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Error al eliminar la máquina');
      
      refetchMachines(); // ✨ Usar refetch en lugar de actualizar estado local
      
      toast({
        title: 'Máquina eliminada',
        description: 'La máquina ha sido eliminada correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la máquina',
        variant: 'destructive',
      });
    }
  };

  // ✨ Handlers para Zonas de Planta
  // NOTA: El PlantZoneDialog ya maneja las llamadas API internamente,
  // estos handlers solo refrescan los datos después de la operación exitosa
  const handleZoneSaved = async (_zone?: any) => {
    await fetchPlantZones();
    setIsZoneDialogOpen(false);
    setSelectedParentZone(null);
    setCurrentEditZone(null);
    toast({
      title: currentEditZone ? 'Zona actualizada' : 'Zona creada',
      description: currentEditZone
        ? 'La zona ha sido actualizada correctamente'
        : 'La zona ha sido creada correctamente',
    });
  };

  const handleDeleteZone = async (zone: any) => {
    if (!window.confirm(`¿Eliminar la zona "${zone.name}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/plant-zones/${zone.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar zona');
      }

      await fetchPlantZones();
      toast({
        title: 'Zona eliminada',
        description: 'La zona ha sido eliminada correctamente',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar la zona',
        variant: 'destructive',
      });
    }
  };

  // Handler para agregar máquina a una zona específica
  const handleAddMachineToZone = (zoneId: number) => {
    setPreselectedZoneId(zoneId);
    setIsDialogOpen(true);
  };

  const toggleZoneExpand = (zoneId: number) => {
    setExpandedZones(prev => {
      const newSet = new Set(prev);
      if (newSet.has(zoneId)) {
        newSet.delete(zoneId);
      } else {
        newSet.add(zoneId);
      }
      // Persistir en localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('machines_expanded_zones', JSON.stringify([...newSet]));
      }
      return newSet;
    });
  };

  // ✨ Handler para duplicar máquina
  const handleDuplicateMachine = async (machine: Machine) => {
    try {
      const response = await fetch(`/api/machines/${machine.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          includeComponents: true,
          includeSubcomponents: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al duplicar');
      }

      const result = await response.json();
      refetchMachines();
      await fetchPlantZones();

      toast({
        title: 'Máquina duplicada',
        description: `Se creó "${result.machine.name}" como copia de "${machine.name}"`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo duplicar la máquina',
        variant: 'destructive',
      });
    }
  };

  // ✨ Handler para generar QR
  const handleGenerateQR = async (machine: Machine) => {
    try {
      // Abrir en nueva ventana la página de QR
      window.open(`/mantenimiento/qr/${machine.id}`, '_blank');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo generar el código QR',
        variant: 'destructive',
      });
    }
  };

  // ✨ Handler para exportar máquinas
  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        format,
        ...(sectorIdNum && { sectorId: sectorIdNum.toString() }),
        ...(companyIdNum && { companyId: companyIdNum.toString() }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(typeFilter !== 'all' && { type: typeFilter }),
        includeComponents: 'true',
      });

      const response = await fetch(`/api/machines/export?${params}`);

      if (!response.ok) throw new Error('Error al exportar');

      if (format === 'json') {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `maquinas_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `maquinas_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }

      toast({
        title: 'Exportación completada',
        description: `Las máquinas se exportaron en formato ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron exportar las máquinas',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Obtener máquinas sin zona asignada
  const machinesWithoutZone = machines.filter(m => !m.plantZoneId);

  const handleSelectMachine = (machine: Machine) => {
    if (isReorderMode) {
      // Si está en modo reordenar, solo seleccionar para mover
      setSelectedMachineForReorder(machine);
    } else {
      // Si no está en modo reordenar, abrir el detalle
      setSelectedMachine(machine);
      setSelectedComponentId(undefined);
      setInitialTab('info');
      setIsDetailOpen(true);
    }
  };

  const handleSelectMachineWithComponent = (machineWithComponent: any) => {
    setSelectedMachine(machineWithComponent);
    setSelectedComponentId(machineWithComponent.selectedComponent?.id);
    setInitialTab('components');
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedMachine(null);
  };

  // Handler para abrir detalle de componente desde el esquema de zonas
  const handleSelectComponent = (component: MachineComponent) => {
    setSelectedComponent(component);
    setIsComponentDetailOpen(true);
  };

  const handleCloseComponentDetail = () => {
    setIsComponentDetailOpen(false);
    setSelectedComponent(null);
  };

  if (companyLoading || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-full sidebar-shell">
      <div className="space-y-6">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/80 backdrop-blur border-b border-border">
          <div className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 flex items-center gap-2 sm:gap-4 justify-between">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-semibold tracking-tight">Máquinas</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 hidden sm:block">
                Gestión de máquinas{currentSector ? ` en ${currentSector.name}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Botón Exportar */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className={`h-8 sm:h-9 text-xs px-2 sm:px-3 ${getButtonClasses('outline')}`}
                    disabled={isExporting || machines.length === 0}
                  >
                    {isExporting ? (
                      <Loader2 className="h-3.5 w-3.5 sm:mr-2 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5 sm:mr-2" />
                    )}
                    <span className="hidden sm:inline">Exportar</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('csv')}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Exportar CSV (Excel)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('json')}>
                    <FileJson className="mr-2 h-4 w-4" />
                    Exportar JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Botón Agregar */}
              {canCreateMachine && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className={`h-8 sm:h-9 text-xs px-2 sm:px-3 ${getButtonClasses('primary')}`}>
                      <Plus className="h-3.5 w-3.5 sm:mr-2" />
                      <span className="hidden sm:inline">Agregar</span>
                      <ChevronDown className="ml-1 sm:ml-2 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedParentZone(null);
                        setCurrentEditZone(null);
                        setIsZoneDialogOpen(true);
                      }}
                    >
                      <Building2 className="mr-2 h-4 w-4" />
                      Zona / Módulo
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Cog className="mr-2 h-4 w-4" />
                        Máquina
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => setIsDialogOpen(true)}>
                          <FileUp className="mr-2 h-4 w-4" />
                          Manual
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push('/mantenimiento/maquinas/importar')}>
                          <Sparkles className="mr-2 h-4 w-4 text-purple-500" />
                          Con planos (IA)
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
        
        {/* Filtros */}
        <div className="px-3 sm:px-4 md:px-6">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o apodo..."
                className={`pl-8 h-8 sm:h-9 text-sm ${getInputClasses()}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex gap-1.5 sm:gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className={`w-[100px] sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm ${getSelectClasses()}`}>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value={MachineStatus.ACTIVE}>Activo</SelectItem>
                  <SelectItem value={MachineStatus.OUT_OF_SERVICE}>Fuera de servicio</SelectItem>
                  <SelectItem value={MachineStatus.DECOMMISSIONED}>Baja</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className={`w-[100px] sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm ${getSelectClasses()}`}>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value={MachineType.PRODUCTION}>Producción</SelectItem>
                  <SelectItem value={MachineType.MAINTENANCE}>Mantenimiento</SelectItem>
                  <SelectItem value={MachineType.UTILITY}>Utilidad</SelectItem>
                  <SelectItem value={MachineType.PACKAGING}>Empaque</SelectItem>
                  <SelectItem value={MachineType.TRANSPORTATION}>Transporte</SelectItem>
                  <SelectItem value={MachineType.OTHER}>Otro</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Botón Limpiar Filtros (solo si hay filtros activos) */}
              {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 sm:h-9 px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setTypeFilter('all');
                    localStorage.removeItem('machines_filter_search');
                    localStorage.removeItem('machines_filter_status');
                    localStorage.removeItem('machines_filter_type');
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}

              {/* Botón Multi-selección */}
              <Button
                variant="outline"
                size="sm"
                className={`h-8 sm:h-9 hidden sm:flex ${getButtonClasses('outline')} ${isMultiSelectMode ? 'bg-primary/10 border-primary' : ''}`}
                onClick={() => {
                  if (isMultiSelectMode) {
                    clearSelection();
                  } else {
                    setIsMultiSelectMode(true);
                  }
                }}
                title={isMultiSelectMode ? 'Cancelar selección' : 'Activar selección múltiple'}
              >
                {isMultiSelectMode ? (
                  <>
                    <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                    {selectedMachineIds.size > 0 ? `${selectedMachineIds.size} sel.` : 'Seleccionar'}
                  </>
                ) : (
                  <>
                    <Square className="h-3.5 w-3.5 mr-1.5" />
                    Selección
                  </>
                )}
              </Button>

              {/* Botón Editar/Ordenar */}
              <Button
                variant="outline"
                size="sm"
                className={`h-8 sm:h-9 px-2 sm:px-3 ${getButtonClasses('outline')}`}
                onClick={() => {
                  if (isReorderMode) {
                    // Si se desactiva (cancelar), descartar cambios y recargar
                    if (hasOrderChanges) {
                      // Recargar máquinas para restaurar el orden original
                      refetchMachines();
                      setHasOrderChanges(false);
                    }
                    setSelectedMachineForReorder(null);
                    setIsReorderMode(false);
                  } else {
                    // Si se activa el modo, seleccionar la primera máquina si no hay ninguna seleccionada
                    setIsReorderMode(true);
                    if (!selectedMachineForReorder && sortedMachines.length > 0) {
                      setSelectedMachineForReorder(sortedMachines[0]);
                    }
                  }
                }}
              >
                {isReorderMode ? (
                  <>
                    <X className="h-3.5 w-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline">Cancelar</span>
                  </>
                ) : (
                  <>
                    <Pencil className="h-3.5 w-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline">Ordenar</span>
                  </>
                )}
              </Button>

              {/* Botón Guardar Cambios - solo en modo reordenar con cambios pendientes */}
              {isReorderMode && hasOrderChanges && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 sm:h-9 px-2 sm:px-3"
                  onClick={async () => {
                    await saveMachineOrder(machineOrder);
                    setHasOrderChanges(false);
                    setIsReorderMode(false);
                    setSelectedMachineForReorder(null);
                  }}
                  disabled={isSavingMachineOrder}
                >
                  {isSavingMachineOrder ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 sm:mr-1.5 animate-spin" />
                      <span className="hidden sm:inline">Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5 sm:mr-1.5" />
                      <span className="hidden sm:inline">Guardar cambios</span>
                    </>
                  )}
                </Button>
              )}

              {/* Separador visual */}
              <div className="h-6 w-px bg-border hidden sm:block" />

              {/* ✨ View Mode Toggle */}
              <div className="hidden sm:flex items-center gap-1 bg-muted/50 rounded-md p-1">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setViewMode('grid')}
                  title="Vista en grilla"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setViewMode('list')}
                  title="Vista en lista"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setViewMode('table')}
                  title="Vista en tabla"
                >
                  <TableIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'schema' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setViewMode('schema')}
                  title="Vista esquema"
                >
                  <Network className="h-4 w-4" />
                </Button>
              </div>

              {/* ✨ Sort Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-9 hidden sm:flex ${getButtonClasses('outline')}`}
                  >
                    {sortField ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5 mr-1.5" /> : <ArrowDown className="h-3.5 w-3.5 mr-1.5" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    <span className="text-xs">
                      {sortField === 'name' ? 'Nombre' :
                       sortField === 'healthScore' ? 'Health Score' :
                       sortField === 'status' ? 'Estado' :
                       sortField === 'updatedAt' ? 'Actualizado' :
                       sortField === 'createdAt' ? 'Creado' :
                       'Ordenar'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleSortChange('name')}>
                    <span className="flex-1">Nombre</span>
                    {sortField === 'name' && (
                      sortOrder === 'asc' ? <ArrowUp className="h-4 w-4 ml-2" /> : <ArrowDown className="h-4 w-4 ml-2" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange('healthScore')}>
                    <span className="flex-1">Health Score</span>
                    {sortField === 'healthScore' && (
                      sortOrder === 'asc' ? <ArrowUp className="h-4 w-4 ml-2" /> : <ArrowDown className="h-4 w-4 ml-2" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange('status')}>
                    <span className="flex-1">Estado</span>
                    {sortField === 'status' && (
                      sortOrder === 'asc' ? <ArrowUp className="h-4 w-4 ml-2" /> : <ArrowDown className="h-4 w-4 ml-2" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange('updatedAt')}>
                    <span className="flex-1">Última actualización</span>
                    {sortField === 'updatedAt' && (
                      sortOrder === 'asc' ? <ArrowUp className="h-4 w-4 ml-2" /> : <ArrowDown className="h-4 w-4 ml-2" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange('createdAt')}>
                    <span className="flex-1">Fecha de creación</span>
                    {sortField === 'createdAt' && (
                      sortOrder === 'asc' ? <ArrowUp className="h-4 w-4 ml-2" /> : <ArrowDown className="h-4 w-4 ml-2" />
                    )}
                  </DropdownMenuItem>
                  {sortField && (
                    <>
                      <div className="my-1 h-px bg-border" />
                      <DropdownMenuItem onClick={() => { setSortField(undefined); setSortOrder('asc'); }}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Quitar ordenamiento
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* ✨ Advanced Filters Button */}
              <Sheet open={isAdvancedFiltersOpen} onOpenChange={setIsAdvancedFiltersOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-9 hidden sm:flex relative ${getButtonClasses('outline')}`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                    <span className="text-xs">Filtros</span>
                    {activeAdvancedFiltersCount > 0 && (
                      <Badge className="absolute -top-1.5 -right-1.5 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary">
                        {activeAdvancedFiltersCount}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[380px] sm:w-[440px] flex flex-col">
                  <SheetHeader className="pb-4 border-b">
                    <div className="flex items-center justify-between">
                      <SheetTitle className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Filter className="h-4 w-4 text-primary" />
                        </div>
                        Filtros Avanzados
                      </SheetTitle>
                      {activeAdvancedFiltersCount > 0 && (
                        <Badge variant="secondary" className="gap-1">
                          {activeAdvancedFiltersCount} activo{activeAdvancedFiltersCount > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    {/* Preview de resultados */}
                    <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-muted/50 border">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Cog className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{filteredMachines.length} máquinas</p>
                        <p className="text-xs text-muted-foreground">coinciden con los filtros</p>
                      </div>
                    </div>
                  </SheetHeader>

                  <div className="flex-1 overflow-y-auto py-4 space-y-5">
                    {/* Health Score Range - Card mejorado */}
                    <div className="rounded-lg border p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-sm font-medium">
                          <Heart className="h-4 w-4 text-rose-500" />
                          Health Score
                        </Label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                            {advancedFilters.minHealthScore}%
                          </span>
                          <span className="text-xs text-muted-foreground">-</span>
                          <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                            {advancedFilters.maxHealthScore}%
                          </span>
                        </div>
                      </div>
                      {/* Barra visual de gradiente */}
                      <div className="relative h-2 rounded-full overflow-hidden">
                        <div
                          className="absolute inset-0"
                          style={{
                            background: 'linear-gradient(to right, #ef4444 0%, #f59e0b 30%, #eab308 50%, #84cc16 70%, #22c55e 100%)'
                          }}
                        />
                        {/* Zona activa */}
                        <div
                          className="absolute top-0 bottom-0 bg-black/20"
                          style={{
                            left: 0,
                            width: `${advancedFilters.minHealthScore}%`
                          }}
                        />
                        <div
                          className="absolute top-0 bottom-0 bg-black/20"
                          style={{
                            right: 0,
                            width: `${100 - advancedFilters.maxHealthScore}%`
                          }}
                        />
                      </div>
                      <Slider
                        min={0}
                        max={100}
                        step={5}
                        value={[advancedFilters.minHealthScore, advancedFilters.maxHealthScore]}
                        onValueChange={(value) => setAdvancedFilters(prev => ({
                          ...prev,
                          minHealthScore: value[0],
                          maxHealthScore: value[1],
                        }))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Crítico</span>
                        <span>Malo</span>
                        <span>Regular</span>
                        <span>Bueno</span>
                        <span>Óptimo</span>
                      </div>
                    </div>

                    {/* Condiciones - Cards individuales */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Condiciones
                      </Label>
                      <div className="grid gap-2">
                        {/* Garantía por vencer */}
                        <div
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            advancedFilters.hasWarrantyExpiring
                              ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setAdvancedFilters(prev => ({
                            ...prev,
                            hasWarrantyExpiring: !prev.hasWarrantyExpiring,
                          }))}
                        >
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                            advancedFilters.hasWarrantyExpiring ? 'bg-amber-100 dark:bg-amber-900/50' : 'bg-muted'
                          }`}>
                            <Shield className={`h-4 w-4 ${advancedFilters.hasWarrantyExpiring ? 'text-amber-600' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Garantía por vencer</p>
                            <p className="text-xs text-muted-foreground">Próximos 30 días</p>
                          </div>
                          <Checkbox
                            checked={advancedFilters.hasWarrantyExpiring}
                            className="pointer-events-none"
                          />
                        </div>

                        {/* Fallas abiertas */}
                        <div
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            advancedFilters.hasOpenFailures
                              ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setAdvancedFilters(prev => ({
                            ...prev,
                            hasOpenFailures: !prev.hasOpenFailures,
                          }))}
                        >
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                            advancedFilters.hasOpenFailures ? 'bg-red-100 dark:bg-red-900/50' : 'bg-muted'
                          }`}>
                            <AlertTriangle className={`h-4 w-4 ${advancedFilters.hasOpenFailures ? 'text-red-600' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Con fallas abiertas</p>
                            <p className="text-xs text-muted-foreground">Requieren atención</p>
                          </div>
                          <Checkbox
                            checked={advancedFilters.hasOpenFailures}
                            className="pointer-events-none"
                          />
                        </div>

                        {/* OTs pendientes */}
                        <div
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            advancedFilters.hasPendingWorkOrders
                              ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setAdvancedFilters(prev => ({
                            ...prev,
                            hasPendingWorkOrders: !prev.hasPendingWorkOrders,
                          }))}
                        >
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                            advancedFilters.hasPendingWorkOrders ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-muted'
                          }`}>
                            <Wrench className={`h-4 w-4 ${advancedFilters.hasPendingWorkOrders ? 'text-blue-600' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Con OTs pendientes</p>
                            <p className="text-xs text-muted-foreground">Trabajo programado</p>
                          </div>
                          <Checkbox
                            checked={advancedFilters.hasPendingWorkOrders}
                            className="pointer-events-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Brands Filter - Mejorado */}
                    {uniqueBrands.length > 0 && (
                      <div className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2 text-sm font-medium">
                            <Factory className="h-4 w-4 text-violet-500" />
                            Marca
                          </Label>
                          {advancedFilters.brands.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs px-2"
                              onClick={() => setAdvancedFilters(prev => ({ ...prev, brands: [] }))}
                            >
                              Limpiar
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {uniqueBrands.map(brand => {
                            const isSelected = advancedFilters.brands.includes(brand);
                            return (
                              <Badge
                                key={brand}
                                variant={isSelected ? 'default' : 'outline'}
                                className={`cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-violet-600 hover:bg-violet-700'
                                    : 'hover:bg-violet-50 hover:border-violet-300 dark:hover:bg-violet-950/50'
                                }`}
                                onClick={() => setAdvancedFilters(prev => ({
                                  ...prev,
                                  brands: prev.brands.includes(brand)
                                    ? prev.brands.filter(b => b !== brand)
                                    : [...prev.brands, brand],
                                }))}
                              >
                                {isSelected && <Check className="h-3 w-3 mr-1" />}
                                {brand}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Production Lines Filter - Mejorado */}
                    {uniqueProductionLines.length > 0 && (
                      <div className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2 text-sm font-medium">
                            <GitBranch className="h-4 w-4 text-emerald-500" />
                            Línea de Producción
                          </Label>
                          {advancedFilters.productionLines.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs px-2"
                              onClick={() => setAdvancedFilters(prev => ({ ...prev, productionLines: [] }))}
                            >
                              Limpiar
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {uniqueProductionLines.map(line => {
                            const isSelected = advancedFilters.productionLines.includes(line);
                            return (
                              <Badge
                                key={line}
                                variant={isSelected ? 'default' : 'outline'}
                                className={`cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-emerald-600 hover:bg-emerald-700'
                                    : 'hover:bg-emerald-50 hover:border-emerald-300 dark:hover:bg-emerald-950/50'
                                }`}
                                onClick={() => setAdvancedFilters(prev => ({
                                  ...prev,
                                  productionLines: prev.productionLines.includes(line)
                                    ? prev.productionLines.filter(l => l !== line)
                                    : [...prev.productionLines, line],
                                }))}
                              >
                                {isSelected && <Check className="h-3 w-3 mr-1" />}
                                {line}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer fijo */}
                  <div className="border-t pt-4 space-y-3">
                    {activeAdvancedFiltersCount > 0 && (
                      <Button
                        variant="ghost"
                        onClick={clearAdvancedFilters}
                        className="w-full justify-center text-muted-foreground hover:text-destructive"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Limpiar todos los filtros
                      </Button>
                    )}
                    <Button onClick={() => setIsAdvancedFiltersOpen(false)} className="w-full h-11">
                      <Check className="h-4 w-4 mr-2" />
                      Ver {filteredMachines.length} máquina{filteredMachines.length !== 1 ? 's' : ''}
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        {/* ✨ Barra de acciones masivas */}
        {isMultiSelectMode && selectedMachineIds.size > 0 && (
          <div className="mx-4 md:mx-6 p-3 rounded-lg bg-primary/5 border border-primary/20 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="h-7 px-3">
                {selectedMachineIds.size} máquina{selectedMachineIds.size > 1 ? 's' : ''} seleccionada{selectedMachineIds.size > 1 ? 's' : ''}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllMachines}
                className="h-7 text-xs"
              >
                Seleccionar todo ({filteredMachines.length})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="h-7 text-xs"
              >
                Limpiar
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {/* Agregar a favoritos */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  selectedMachineIds.forEach(id => {
                    if (!favorites.has(id)) {
                      setFavorites(prev => new Set([...prev, id]));
                    }
                  });
                  toast({ title: `${selectedMachineIds.size} máquina${selectedMachineIds.size > 1 ? 's' : ''} agregada${selectedMachineIds.size > 1 ? 's' : ''} a favoritos` });
                }}
                className="h-8"
              >
                <Star className="h-3.5 w-3.5 mr-1.5" />
                Favoritos
              </Button>
              {/* Eliminar selección */}
              {canDeleteMachine && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="h-8"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Vista de Zonas y Máquinas */}
        {viewMode === 'schema' ? (
          <div className="px-4 md:px-6 pb-6">
            <ZoneSchemaView
              zones={plantZones}
              machines={machines}
              onMachineClick={handleSelectMachine}
              onComponentClick={handleSelectComponent}
              sectorName={currentSector?.name || 'Sector'}
            />
          </div>
        ) : (
        <div className="px-4 md:px-6 pb-6 space-y-4">
          {/* Zonas de planta */}
          {plantZones.length > 0 && (
            <div className="space-y-3">
              {plantZones.map((zone) => (
                <ZoneContainer
                  key={zone.id}
                  zone={zone}
                  depth={0}
                  expandedZones={expandedZones}
                  onToggle={toggleZoneExpand}
                  onSelectMachine={handleSelectMachine}
                  onEditMachine={canEditMachine ? (machine) => {
                    setCurrentEditMachine(machine);
                    setSelectedMachineForReorder(machine);
                    setIsEditDialogOpen(true);
                  } : undefined}
                  onDeleteMachine={canDeleteMachine ? handleDeleteMachine : undefined}
                  onDuplicateMachine={canEditMachine ? handleDuplicateMachine : undefined}
                  onGenerateQR={handleGenerateQR}
                  onEditZone={canEditMachine ? (z) => {
                    setCurrentEditZone(z);
                    setIsZoneDialogOpen(true);
                  } : undefined}
                  onDeleteZone={canDeleteMachine ? handleDeleteZone : undefined}
                  onAddSubZone={canCreateMachine ? (parentZone) => {
                    setSelectedParentZone(parentZone);
                    setCurrentEditZone(null);
                    setIsZoneDialogOpen(true);
                  } : undefined}
                  onAddMachine={canCreateMachine ? handleAddMachineToZone : undefined}
                  canEditMachine={canEditMachine}
                  canDeleteMachine={canDeleteMachine}
                  canViewHistory={canViewMachineHistory}
                  isReorderMode={isReorderMode}
                  onReorderMachine={handleReorderMachine}
                  onDragReorderMachine={handleDragReorder}
                  getButtonClasses={getButtonClasses}
                  viewMode={viewMode}
                  sortField={sortField}
                  sortOrder={sortOrder}
                  isMultiSelectMode={isMultiSelectMode}
                  selectedMachineIds={selectedMachineIds}
                  onToggleSelection={toggleMachineSelection}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          )}

          {/* Máquinas sin zona */}
          {machinesWithoutZone.length > 0 && (
            <div className="bg-card rounded-lg border shadow-sm">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cog className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Máquinas sin zona asignada</span>
                  <span className="text-sm text-muted-foreground">({machinesWithoutZone.length})</span>
                </div>
              </div>
              <MachineGrid
                machines={machinesWithoutZone.filter(m => {
                  const matchesSearch = searchQuery === '' ||
                    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (m.nickname || '').toLowerCase().includes(searchQuery.toLowerCase());
                  const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
                  const matchesType = typeFilter === 'all' || m.type === typeFilter;
                  return matchesSearch && matchesStatus && matchesType;
                })}
                onDelete={canDeleteMachine ? handleDeleteMachine : undefined}
                onSelect={handleSelectMachine}
                onReorder={isReorderMode ? handleReorderMachine : undefined}
                onDragReorder={isReorderMode ? handleDragReorder : undefined}
                onEdit={canEditMachine ? (machine) => {
                  setCurrentEditMachine(machine);
                  setSelectedMachineForReorder(machine);
                  setIsEditDialogOpen(true);
                } : undefined}
                onDuplicate={canEditMachine ? handleDuplicateMachine : undefined}
                onGenerateQR={handleGenerateQR}
                canDeleteMachine={canDeleteMachine}
                canEditMachine={canEditMachine}
                canViewHistory={canViewMachineHistory}
                isReorderMode={isReorderMode}
                viewMode={viewMode}
                sortField={sortField}
                sortOrder={sortOrder}
                isMultiSelectMode={isMultiSelectMode}
                selectedMachineIds={selectedMachineIds}
                onToggleSelection={toggleMachineSelection}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
              />
            </div>
          )}

          {/* Mensaje cuando no hay zonas ni máquinas */}
          {plantZones.length === 0 && machines.length === 0 && !isLoading && !isLoadingZones && (
            <div className="bg-card rounded-lg border shadow-sm p-8 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Sin zonas ni máquinas</h3>
              <p className="text-muted-foreground mb-4">
                Comienza creando una zona para organizar tus máquinas
              </p>
              {canCreateMachine && (
                <Button
                  onClick={() => {
                    setSelectedParentZone(null);
                    setCurrentEditZone(null);
                    setIsZoneDialogOpen(true);
                  }}
                  className={getButtonClasses('primary')}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Crear primera zona
                </Button>
              )}
            </div>
          )}
        </div>
        )}

        {/* Diálogos */}
        {canCreateMachine && (
        <MachineDialog
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setPreselectedZoneId(undefined);
          }}
          onSave={handleAddMachine}
          preselectedZoneId={preselectedZoneId}
        />
        )}
        
        {isDetailOpen && selectedMachine && (
          <MachineDetailDialog
            isOpen={isDetailOpen}
            onClose={handleCloseDetail}
            machine={selectedMachine}
            components={[]} // Se cargan via useMachineDetail hook
            onEdit={canEditMachine ? (machine) => {
              setCurrentEditMachine(machine);
              setIsEditDialogOpen(true);
            } : undefined}
            onDelete={canDeleteMachine ? handleDeleteMachine : undefined}
            initialTab={initialTab}
            selectedComponentId={selectedComponentId}
          />
        )}

        {/* Modal de detalle de componente (desde esquema de zonas) */}
        <ComponentDetailsModal
          component={selectedComponent}
          isOpen={isComponentDetailOpen}
          onClose={handleCloseComponentDetail}
          onDeleted={() => {
            handleCloseComponentDetail();
            fetchMachines();
          }}
        />

        {isEditDialogOpen && currentEditMachine && canEditMachine && (
          <MachineDialog
            isOpen={isEditDialogOpen}
            onClose={() => {
              setIsEditDialogOpen(false);
              setCurrentEditMachine(null);
              setSelectedMachineForReorder(null);
            }}
            onSave={handleEditMachine}
            machine={currentEditMachine}
          />
        )}

        {/* Dialog para crear/editar zonas */}
        <PlantZoneDialog
          isOpen={isZoneDialogOpen}
          onClose={() => {
            setIsZoneDialogOpen(false);
            setCurrentEditZone(null);
            setSelectedParentZone(null);
          }}
          onSave={handleZoneSaved}
          zone={currentEditZone}
          sectorId={sectorIdNum || 0}
          companyId={companyIdNum || 0}
          sectorName={currentSector?.name}
          parentZone={selectedParentZone ? {
            id: selectedParentZone.id,
            name: selectedParentZone.name,
            breadcrumb: selectedParentZone.breadcrumb || [selectedParentZone.name]
          } : undefined}
        />
      </div>
    </div>
  );
}

// ✨ Componente ZoneContainer para mostrar zonas jerárquicamente
interface ZoneContainerProps {
  zone: any;
  depth: number;
  expandedZones: Set<number>;
  onToggle: (zoneId: number) => void;
  onSelectMachine: (machine: Machine) => void;
  onEditMachine?: (machine: Machine) => void;
  onDeleteMachine?: (machine: Machine) => Promise<void>;
  onDuplicateMachine?: (machine: Machine) => void;
  onGenerateQR?: (machine: Machine) => void;
  onEditZone?: (zone: any) => void;
  onDeleteZone?: (zone: any) => void;
  onAddSubZone?: (parentZone: any) => void;
  onAddMachine?: (zoneId: number) => void;
  canEditMachine: boolean;
  canDeleteMachine: boolean;
  canViewHistory: boolean;
  isReorderMode: boolean;
  onReorderMachine?: (machineId: number, direction: 'left' | 'right') => void;
  onDragReorderMachine?: (machineIds: number[]) => void;
  getButtonClasses: (variant: 'primary' | 'outline' | 'secondary') => string;
  viewMode?: ViewMode;
  sortField?: SortField;
  sortOrder?: SortOrder;
  isMultiSelectMode?: boolean;
  selectedMachineIds?: Set<number>;
  onToggleSelection?: (machineId: number) => void;
  favorites?: Set<number>;
  onToggleFavorite?: (machineId: number) => void;
}

function ZoneContainer({
  zone,
  depth,
  expandedZones,
  onToggle,
  onSelectMachine,
  onEditMachine,
  onDeleteMachine,
  onDuplicateMachine,
  onGenerateQR,
  onEditZone,
  onDeleteZone,
  onAddSubZone,
  onAddMachine,
  canEditMachine,
  canDeleteMachine,
  canViewHistory,
  isReorderMode,
  onReorderMachine,
  onDragReorderMachine,
  getButtonClasses,
  viewMode,
  sortField,
  sortOrder,
  isMultiSelectMode,
  selectedMachineIds,
  onToggleSelection,
  favorites,
  onToggleFavorite,
}: ZoneContainerProps) {
  const isExpanded = expandedZones.has(zone.id);
  const hasChildren = zone.children?.length > 0;
  const hasMachines = zone.machines?.length > 0;
  const totalMachines = countAllMachines(zone);
  const totalSubzones = countAllSubzones(zone);

  // Color de la zona o color por defecto
  const zoneColor = zone.color || '#6B7280';

  return (
    <div
      className="bg-card rounded-lg border shadow-sm overflow-hidden"
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: zoneColor,
        marginLeft: depth > 0 ? `${depth * 16}px` : 0
      }}
    >
      {/* Header de la zona */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => onToggle(zone.id)}
      >
        <div className="flex items-center gap-3">
          {/* Icono de expandir/colapsar */}
          <button className="p-1 rounded hover:bg-muted">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {/* Logo o icono */}
          {zone.logo ? (
            <img src={zone.logo} alt={zone.name} className="h-8 w-8 rounded object-cover" />
          ) : (
            <div
              className="h-8 w-8 rounded flex items-center justify-center"
              style={{ backgroundColor: zoneColor + '20' }}
            >
              <Building2 className="h-4 w-4" style={{ color: zoneColor }} />
            </div>
          )}

          {/* Nombre y estadísticas */}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{zone.name}</span>
              {zone.description && (
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  - {zone.description}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {totalSubzones > 0 && (
                <span className="flex items-center gap-1">
                  <FolderOpen className="h-3 w-3" />
                  {totalSubzones} sub-zona{totalSubzones !== 1 ? 's' : ''}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Cog className="h-3 w-3" />
                {totalMachines} máquina{totalMachines !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1 sm:gap-2" onClick={(e) => e.stopPropagation()}>
          {onAddMachine && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-1.5 sm:px-2"
              onClick={() => onAddMachine(zone.id)}
              title="Agregar máquina a esta zona"
            >
              <Plus className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Máquina</span>
            </Button>
          )}
          {onAddSubZone && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-1.5 sm:px-2"
              onClick={() => onAddSubZone(zone)}
              title="Agregar sub-zona"
            >
              <Plus className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Sub-zona</span>
            </Button>
          )}
          {onEditZone && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onEditZone(zone)}
              title="Editar zona"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {onDeleteZone && !hasChildren && !hasMachines && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={() => onDeleteZone(zone)}
              title="Eliminar zona"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Contenido expandido */}
      {isExpanded && (
        <div className="border-t">
          {/* Sub-zonas */}
          {hasChildren && (
            <div className="p-2 space-y-2">
              {zone.children.map((childZone: any) => (
                <ZoneContainer
                  key={childZone.id}
                  zone={childZone}
                  depth={depth + 1}
                  expandedZones={expandedZones}
                  onToggle={onToggle}
                  onSelectMachine={onSelectMachine}
                  onEditMachine={onEditMachine}
                  onDeleteMachine={onDeleteMachine}
                  onDuplicateMachine={onDuplicateMachine}
                  onGenerateQR={onGenerateQR}
                  onEditZone={onEditZone}
                  onDeleteZone={onDeleteZone}
                  onAddSubZone={onAddSubZone}
                  onAddMachine={onAddMachine}
                  canEditMachine={canEditMachine}
                  canDeleteMachine={canDeleteMachine}
                  canViewHistory={canViewHistory}
                  isReorderMode={isReorderMode}
                  onReorderMachine={onReorderMachine}
                  onDragReorderMachine={onDragReorderMachine}
                  getButtonClasses={getButtonClasses}
                  viewMode={viewMode}
                  sortField={sortField}
                  sortOrder={sortOrder}
                  isMultiSelectMode={isMultiSelectMode}
                  selectedMachineIds={selectedMachineIds}
                  onToggleSelection={onToggleSelection}
                  favorites={favorites}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          )}

          {/* Máquinas de esta zona */}
          {hasMachines && (
            <div className="p-2">
              <MachineGrid
                machines={zone.machines}
                onDelete={canDeleteMachine ? onDeleteMachine : undefined}
                onSelect={onSelectMachine}
                onEdit={canEditMachine ? onEditMachine : undefined}
                onDuplicate={canEditMachine ? onDuplicateMachine : undefined}
                onGenerateQR={onGenerateQR}
                onReorder={isReorderMode ? onReorderMachine : undefined}
                onDragReorder={isReorderMode ? onDragReorderMachine : undefined}
                canDeleteMachine={canDeleteMachine}
                canEditMachine={canEditMachine}
                canViewHistory={canViewHistory}
                isReorderMode={isReorderMode}
                viewMode={viewMode}
                sortField={sortField}
                sortOrder={sortOrder}
                isMultiSelectMode={isMultiSelectMode}
                selectedMachineIds={selectedMachineIds}
                onToggleSelection={onToggleSelection}
                favorites={favorites}
                onToggleFavorite={onToggleFavorite}
              />
            </div>
          )}

          {/* Mensaje si está vacía */}
          {!hasChildren && !hasMachines && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Esta zona está vacía. Agrega sub-zonas o máquinas.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helpers para contar máquinas y subzonas recursivamente
function countAllMachines(zone: any): number {
  let count = zone.machines?.length || 0;
  if (zone.children) {
    for (const child of zone.children) {
      count += countAllMachines(child);
    }
  }
  return count;
}

function countAllSubzones(zone: any): number {
  let count = zone.children?.length || 0;
  if (zone.children) {
    for (const child of zone.children) {
      count += countAllSubzones(child);
    }
  }
  return count;
} 