'use client';

// ✅ OPTIMIZACIÓN: Desactivar logs en producción
const DEBUG = false;
const log = DEBUG ? console.log.bind(console) : () => {};

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogBody,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Package, Plus, Edit, Trash2, X, Printer, Search, LayoutGrid, Table2, Filter, Copy, Download, CheckSquare, Sparkles } from 'lucide-react';
import LoadPrintView, { type LoadPrintViewRef } from './LoadPrintView';
import LoadsToolbar from './LoadsToolbar';
import LoadsMetrics from './LoadsMetrics';
import BulkActionsBar from './BulkActionsBar';
import CapacityWarning from './CapacityWarning';
import LoadStatusBadge from './LoadStatusBadge';
import AIOptimizeButton from './AIOptimizeButton';
import AILoadCreator from './AILoadCreator';
import { LoadStatus, LOAD_STATUS_CONFIG, AIOptimizationResult } from '@/lib/cargas/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCompany } from '@/contexts/CompanyContext';
import { useAdminCatalogs } from '@/hooks/use-admin-catalogs';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import { useCargasBootstrap } from '@/hooks/use-cargas-bootstrap';
import { DatePicker } from '@/components/ui/date-picker';
import { exportLoadsToCSV, downloadCSV } from '@/lib/cargas/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TruckData {
  id: number;
  name: string;
  type: 'CHASIS' | 'EQUIPO' | 'SEMI';
  length: number;
  chasisLength?: number | null;
  acopladoLength?: number | null;
  chasisWeight?: number | null;
  acopladoWeight?: number | null;
  maxWeight?: number | null;
  isOwn?: boolean;
  client?: string | null;
}

interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  length?: number;
  weight?: number; // Peso en kg, lo convertiremos a toneladas
}

interface LoadItem {
  id?: number;
  productId: string;
  productName: string;
  quantity: number;
  length?: number | null;
  weight?: number | null;
  position: number;
  notes?: string | null;
  tempCode?: string; // Código temporal mientras se ingresa
  gridPosition?: GridPosition; // Posición en la grilla 3x3x3
}

interface GridPosition {
  floor: number; // Piso (1-3, donde 3 es arriba)
  row: number; // Fila (1-3)
  col: number; // Columna (1-3)
}

interface PackagedItem {
  item: LoadItem;
  packages: number; // Cantidad de paquetes (10 unidades para >= 5.80m, 20 unidades para < 5.80m)
  gridPositions: GridPosition[]; // Posiciones ocupadas en la grilla
  usesPackages: boolean; // Si usa paquetes de 10 (>= 5.80m) o paquetes de 20 (< 5.80m)
}

interface Load {
  id: number;
  internalId?: number | null;
  truckId: number;
  date: string;
  description?: string | null;
  deliveryClient?: string | null;
  deliveryAddress?: string | null;
  isCorralon?: boolean;
  status?: LoadStatus;
  scheduledDate?: string | null;
  departureDate?: string | null;
  deliveryDate?: string | null;
  truck: TruckData;
  items: LoadItem[];
}

interface LoadsManagerProps {
  companyId: number;
}

interface ClientData {
  id: string;
  name: string;
  address?: string;
}

export default function LoadsManager({ companyId }: LoadsManagerProps) {
  // ✨ OPTIMIZACIÓN: Usar catálogos consolidados
  const { data: catalogsData, isLoading: catalogsLoading } = useAdminCatalogs(companyId);
  
  // ✨ OPTIMIZACIÓN: Usar bootstrap consolidado (trucks + loads en una sola request)
  const { data: bootstrapData, isLoading: bootstrapLoading, refetch: refetchBootstrap } = useCargasBootstrap(companyId);
  
  // ✨ PERMISOS: Verificar permisos de cargas
  const { hasPermission: canView } = usePermissionRobust('cargas.view');
  const { hasPermission: canManageLoads } = usePermissionRobust('cargas.manage_loads');
  
  // ✨ OPTIMIZACIÓN: Usar datos del bootstrap en lugar de state local
  const loads = bootstrapData?.loads || [];
  const trucks = bootstrapData?.trucks || [];
  
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const loading = bootstrapLoading || catalogsLoading;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAICreatorOpen, setIsAICreatorOpen] = useState(false);
  const [editingLoad, setEditingLoad] = useState<Load | null>(null);
  const [printingLoad, setPrintingLoad] = useState<Load | null>(null);
  const [printingDistribution, setPrintingDistribution] = useState<any>(null); // Distribución pre-calculada para impresión
  const [detailLoad, setDetailLoad] = useState<Load | null>(null);
  const printViewRef = useRef<LoadPrintViewRef>(null);
  const [selectedTruck, setSelectedTruck] = useState<number | null>(null);
  const [loadItems, setLoadItems] = useState<LoadItem[]>([]);
  
  // Estados para búsqueda, filtros y vista
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTruckType, setFilterTruckType] = useState<'ALL' | 'CHASIS' | 'EQUIPO' | 'SEMI'>('ALL');
  const [filterClient, setFilterClient] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  // Estados para selección múltiple (bulk actions)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLoadIds, setSelectedLoadIds] = useState<number[]>([]);

  // Estado para mostrar métricas
  const [showMetrics, setShowMetrics] = useState(true);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    deliveryClient: '',
    deliveryAddress: '',
    isCorralon: false,
  });
  const quantityInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const { toast } = useToast();
  const { currentCompany } = useCompany();

  // ✨ PERMISOS: Si no puede ver, no mostrar nada
  if (!canView) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">No tienes permisos para ver cargas.</p>
      </div>
    );
  }
  
  // ✨ OPTIMIZADO: Ya no necesitamos loadTrucks ni loadLoads, se obtienen del bootstrap
  const lastCatalogsDataRef = useRef<string | null>(null);

  // ✨ OPTIMIZADO: Solo procesar catalogsData cuando cambie (productos y clientes)
  useEffect(() => {
    if (!catalogsData || catalogsLoading) return;
    
    const catalogsKey = JSON.stringify({
      products: catalogsData.products?.length || 0,
      clients: catalogsData.clients?.length || 0,
    });
    const lastKey = lastCatalogsDataRef.current;
    
    if (catalogsKey === lastKey) return;
    
    lastCatalogsDataRef.current = catalogsKey;
    
    loadProducts();
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogsData, catalogsLoading]);

  // ✨ FIX: Memoizar funciones para evitar recreaciones y dependencias circulares
  const loadClients = useCallback(() => {
    // ✨ OPTIMIZACIÓN: Usar catálogos consolidados en lugar de fetch individual
    // ANTES: await fetch('/api/clients')
    // DESPUÉS: Usar catalogsData.clients
    try {
      if (catalogsData?.clients) {
        setClients(catalogsData.clients as any[] || []);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  }, [catalogsData?.clients]);

  const loadProducts = useCallback(() => {
    // ✨ OPTIMIZACIÓN: Usar catálogos consolidados en lugar de fetch individual
    // ANTES: await fetch(`/api/productos/productos?companyId=${companyId}`)
    // DESPUÉS: Usar catalogsData.products
    try {
      if (catalogsData?.products) {
        const data = catalogsData.products;
        // Filtrar solo viguetas (por categoría o nombre, excluyendo bloques)
        const viguetas = data
          .map((p: any) => {
            const categoryName = (p.categoryName || '').toLowerCase();
            const productName = (p.name || '').toLowerCase();
            const isVigueta = categoryName.includes('vigueta') || productName.includes('vigueta');
            const isBloque = categoryName.includes('bloque') || productName.includes('bloque');
            
            // Solo incluir si es vigueta y NO es bloque
            if (!isVigueta || isBloque) {
              return null;
            }
            
            const lengthMatch = p.name.match(/(\d+\.?\d*)\s*(m|mts|metros?)/i);
            
            // Usar el peso de la base de datos directamente (en kilos)
            // Si no está disponible, intentar extraerlo del nombre o descripción
            let weightKg: number | undefined = undefined;
            
            // Primero intentar usar el peso de la BD (asumimos que está en kilos)
            if (p.weight !== null && p.weight !== undefined) {
              weightKg = typeof p.weight === 'number' ? p.weight : parseFloat(p.weight.toString());
              // Si el peso es muy pequeño (< 1), probablemente está en toneladas, convertir a kilos
              if (weightKg < 1 && weightKg > 0) {
                weightKg = weightKg * 1000;
              }
            } else {
              // Fallback: extraer peso del nombre o descripción (buscar patrones como "kg", "toneladas", "tn", "ton")
            const fullText = (p.name + ' ' + (p.description || '')).toLowerCase();
            const weightMatch = fullText.match(/(\d+\.?\d*)\s*(kg|toneladas?|tn|ton)/i);
            if (weightMatch) {
              const weightValue = parseFloat(weightMatch[1]);
              const unit = weightMatch[2].toLowerCase();
                // Convertir a kilos
              if (unit.includes('kg')) {
                  weightKg = weightValue; // Ya está en kilos
              } else {
                  weightKg = weightValue * 1000; // Convertir toneladas a kilos
                }
              }
            }
            
            return {
              id: p.id.toString(),
              code: (p.sku || p.code || p.id || '').toString().toLowerCase(),
              name: p.name,
              description: p.description,
              length: lengthMatch ? parseFloat(lengthMatch[1]) : undefined,
              weight: weightKg ?? undefined, // Peso en kilos
            };
          })
          .filter((p: Product | null): p is Product => p !== null)
          .sort((a: Product, b: Product) => (a.length || 0) - (b.length || 0));
        setProducts(viguetas);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }, [catalogsData?.products]);

  // ✨ OPTIMIZADO: Ya no necesitamos loadLoads, se obtiene del bootstrap
  // Función helper para refrescar datos después de crear/editar/eliminar
  const refreshLoads = async () => {
    await refetchBootstrap();
  };

  // ✨ BULK ACTIONS: Handlers para acciones masivas
  const toggleLoadSelection = (loadId: number) => {
    setSelectedLoadIds(prev =>
      prev.includes(loadId)
        ? prev.filter(id => id !== loadId)
        : [...prev, loadId]
    );
  };

  const selectAllLoads = () => {
    setSelectedLoadIds(loads.map(l => l.id));
  };

  const clearSelection = () => {
    setSelectedLoadIds([]);
  };

  const handleDuplicate = async (loadId: number) => {
    try {
      toast({
        title: 'Duplicando...',
        description: 'Creando copia de la carga',
      });

      const response = await fetch(`/api/loads/${loadId}/duplicate`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Error al duplicar');
      }

      toast({
        title: 'Carga duplicada',
        description: 'Se creó una copia de la carga exitosamente',
      });

      await refreshLoads();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo duplicar la carga',
        variant: 'destructive',
      });
    }
  };

  const handleBulkPrint = () => {
    // Por ahora, imprimir la primera seleccionada
    const firstSelected = loads.find(l => selectedLoadIds.includes(l.id));
    if (firstSelected) {
      setPrintingLoad(firstSelected);
    }
  };

  const handleBulkExport = () => {
    const selectedLoads = loads.filter(l => selectedLoadIds.includes(l.id));
    if (selectedLoads.length > 0) {
      const csvContent = exportLoadsToCSV(selectedLoads as any[]);
      downloadCSV(csvContent, `cargas_export_${new Date().toISOString().split('T')[0]}.csv`);
      toast({
        title: 'Exportado',
        description: `Se exportaron ${selectedLoads.length} cargas`,
      });
    }
  };

  const handleBulkDuplicate = async () => {
    if (selectedLoadIds.length === 0) return;

    toast({
      title: 'Duplicando...',
      description: `Duplicando ${selectedLoadIds.length} cargas`,
    });

    try {
      for (const loadId of selectedLoadIds) {
        await fetch(`/api/loads/${loadId}/duplicate`, {
          method: 'POST',
          credentials: 'include',
        });
      }

      toast({
        title: 'Cargas duplicadas',
        description: `Se duplicaron ${selectedLoadIds.length} cargas`,
      });

      setSelectedLoadIds([]);
      await refreshLoads();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron duplicar las cargas',
        variant: 'destructive',
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLoadIds.length === 0) return;

    if (!confirm(`¿Eliminar ${selectedLoadIds.length} cargas? Esta acción no se puede deshacer.`)) {
      return;
    }

    toast({
      title: 'Eliminando...',
      description: `Eliminando ${selectedLoadIds.length} cargas`,
    });

    try {
      for (const loadId of selectedLoadIds) {
        await fetch(`/api/loads/${loadId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
      }

      toast({
        title: 'Cargas eliminadas',
        description: `Se eliminaron ${selectedLoadIds.length} cargas`,
      });

      setSelectedLoadIds([]);
      setSelectionMode(false);
      await refreshLoads();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron eliminar las cargas',
        variant: 'destructive',
      });
    }
  };

  const handleExportAll = () => {
    if (loads.length > 0) {
      const csvContent = exportLoadsToCSV(loads as any[]);
      downloadCSV(csvContent, `todas_cargas_${new Date().toISOString().split('T')[0]}.csv`);
      toast({
        title: 'Exportado',
        description: `Se exportaron ${loads.length} cargas`,
      });
    }
  };

  const handleCodeInput = (index: number, code: string) => {
    if (!code.trim()) {
      return;
    }

    const trimmedCode = code.trim().toLowerCase();
    
    log('🔍 [handleCodeInput] Buscando producto con código:', trimmedCode);
    log('🔍 [handleCodeInput] Productos disponibles:', products.map(p => ({ code: p.code, name: p.name })));
    
    // PRIORIDAD 1: Buscar producto por código EXACTO primero
    let product = products.find(
      (p) => p.code.toLowerCase() === trimmedCode
    );
    
    log('🔍 [handleCodeInput] Producto encontrado por código exacto:', product ? { code: product.code, name: product.name } : 'No encontrado');
    
    // PRIORIDAD 2: Si no se encuentra por código exacto, buscar por nombre
    // pero solo si el código ingresado no parece ser un código numérico
    // (para evitar confusiones como "60" encontrando productos con "16" en el nombre)
    if (!product) {
      // Si el código es numérico, solo buscar por código exacto
      const isNumeric = /^\d+$/.test(trimmedCode);
      if (!isNumeric) {
        product = products.find(
          (p) => p.name.toLowerCase().includes(trimmedCode)
        );
        log('🔍 [handleCodeInput] Producto encontrado por nombre:', product ? { code: product.code, name: product.name } : 'No encontrado');
      } else {
        log('🔍 [handleCodeInput] Código es numérico, no se busca por nombre');
      }
    }

    if (!product) {
      toast({
        title: 'Error',
        description: `No se encontró vigueta con código "${code}"`,
        variant: 'destructive',
      });
      // Limpiar el código temporal
      const newItems = [...loadItems];
      if (newItems[index]) {
        newItems[index] = {
          ...newItems[index],
          tempCode: '',
        };
        setLoadItems(newItems);
      }
      return;
    }

    // Permitir múltiples casilleros con el mismo producto
    // No verificar duplicados, simplemente agregar el producto al casillero actual

    // Actualizar item con la vigueta encontrada
    const newItems = [...loadItems];
    newItems[index] = {
      productId: product.id,
      productName: product.name,
      quantity: newItems[index]?.quantity || 1,
      length: product.length || null,
      weight: product.weight || null, // Peso automático del producto
      position: index,
      notes: null,
      tempCode: '',
    };
    setLoadItems(newItems);

    // Focus en el campo de cantidad del mismo casillero
    setTimeout(() => {
      const qtyInput = quantityInputRefs.current[index];
      if (qtyInput) {
        qtyInput.focus();
        qtyInput.select();
      }
    }, 50);
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    // Solo actualizar el casillero específico, no afectar otros
    const newItems = [...loadItems];
    if (newItems[index] && newItems[index].productId) {
      // Solo actualizar si tiene un producto asignado
      newItems[index] = {
        ...newItems[index],
        quantity: Math.max(1, quantity || 1), // Mínimo 1
      };
      setLoadItems(newItems);
    }
  };

  const handleAddItem = () => {
    if (products.length === 0) {
      toast({
        title: 'Error',
        description: 'No hay productos disponibles',
        variant: 'destructive',
      });
      return;
    }

    const newItem: LoadItem = {
      productId: products[0].id,
      productName: products[0].name,
      quantity: 1,
      length: products[0].length || null,
      weight: null,
      position: loadItems.length,
      notes: null,
    };
    setLoadItems([...loadItems, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = loadItems.filter((_, i) => i !== index);
    // Reordenar posiciones
    const reorderedItems = newItems.map((item, i) => ({
      ...item,
      position: i,
    }));
    setLoadItems(reorderedItems);
  };

  const handleItemChange = (index: number, field: keyof LoadItem, value: any) => {
    const newItems = [...loadItems];
    newItems[index] = {
      ...newItems[index],
      [field]: value,
    };
    // Si cambia el producto, actualizar nombre y longitud
    if (field === 'productId') {
      const product = products.find((p) => p.id === value);
      if (product) {
        newItems[index].productName = product.name;
        newItems[index].length = product.length || null;
      }
    }
    setLoadItems(newItems);
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === loadItems.length - 1)
    ) {
      return;
    }

    const newItems = [...loadItems];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [
      newItems[targetIndex],
      newItems[index],
    ];
    // Actualizar posiciones
    newItems.forEach((item, i) => {
      item.position = i;
    });
    setLoadItems(newItems);
  };

  // Calcular disposición óptima en grilla 3x3x3 (3 pisos, 3 filas, 3 columnas = 27 posiciones)
  // Reglas:
  // - Paquetes de 10 unidades para viguetas >= 5.80m
  // - Paquetes de 20 unidades para viguetas < 5.80m
  // - Si no hay nada abajo, las más largas van abajo (piso 1)
  // - Si hay algo en piso 2, SIEMPRE debe haber algo en piso 1
  // - Para EQUIPO: dos distribuciones separadas (chasis y acoplado)
  const calculateOptimalLayout = (
    items: LoadItem[], 
    truckData?: TruckData | null,
    section: 'chasis' | 'acoplado' | 'full' = 'full'
  ): LoadItem[] => {
    const MIN_LENGTH_FOR_PACKAGE = 5.80; // Umbral para determinar tipo de paquete
    const PACKAGE_SIZE_LARGE = 10; // Unidades por paquete para viguetas >= 5.80m
    const PACKAGE_SIZE_SMALL = 20; // Unidades por paquete para viguetas < 5.80m
    const FLOORS = 4; // 4 pisos disponibles
    const ROWS = 3;

    // Filtrar items válidos
    const validItems = items.filter(item => item.productId && item.quantity > 0);
    
    // Obtener largo máximo disponible según el tipo de camión y sección
    let maxLength = truckData?.length || 0;
    if (truckData?.type === 'EQUIPO' && section !== 'full') {
      maxLength = section === 'chasis' 
        ? (truckData.chasisLength || 0)
        : (truckData.acopladoLength || 0);
    }
    
    // Para EQUIPO, filtrar por longitud según la sección
    let itemsToDistribute = validItems;
    if (truckData?.type === 'EQUIPO' && section !== 'full') {
      itemsToDistribute = validItems.filter(item => (item.length || 0) <= maxLength);
    }
    
    // Las columnas son dinámicas según el largo disponible
    // No limitamos a un número fijo, sino que calculamos según el largo de cada vigueta
    // Usamos un COLS inicial para la grilla, pero permitimos expandir dinámicamente
    // Calcular un COLS base basado en la vigueta más pequeña
    let COLS = 3; // Mínimo 3 columnas
    if (itemsToDistribute.length > 0 && maxLength > 0) {
      const minItemLength = Math.min(...itemsToDistribute.map(item => item.length || maxLength).filter(l => l > 0));
      if (minItemLength > 0) {
        // Calcular cuántos paquetes caben en el largo del camión
        const colsThatFit = Math.floor(maxLength / minItemLength);
        // Usar al menos 3 columnas, pero permitir más (sin límite máximo estricto)
        COLS = Math.max(3, colsThatFit);
      }
    }
    
    // Para la grilla, usamos un tamaño generoso que permita expandir
    // La distribución real verificará el largo disponible en cada fila
    const MAX_COLS = Math.max(COLS, 50); // Permitir hasta 50 columnas si es necesario
    const TOTAL_POSITIONS = FLOORS * ROWS * MAX_COLS;

    // ✨ FIX: Mantener el orden original del usuario (por position) en lugar de ordenar por espacio
    // Esto respeta el orden que el usuario definió en el formulario
    const sortedItems = [...itemsToDistribute].sort((a, b) => {
      return (a.position ?? 999) - (b.position ?? 999);
    });

    // Convertir items a paquetes/posiciones
    // Regla: Cada posición (celda) contiene 1 paquete
    // - Viguetas >= 5.80m: cada paquete tiene 10 unidades
    // - Viguetas < 5.80m: cada paquete tiene 20 unidades
    // - Cuántos paquetes caben en el largo del camión = largo_camion / largo_vigueta
    const packagedItems: PackagedItem[] = sortedItems
      .map(item => {
        const itemLength = item.length || 0;
        const usesPackages = itemLength >= MIN_LENGTH_FOR_PACKAGE;
        
        let packages: number;
        if (usesPackages) {
          // Viguetas >= 5.80m: cada paquete tiene 10 unidades
          packages = Math.ceil(item.quantity / PACKAGE_SIZE_LARGE);
        } else {
          // Viguetas < 5.80m: cada paquete tiene 20 unidades
          // Primero calcular cuántos paquetes necesito según la cantidad
          const totalPackagesNeeded = Math.ceil(item.quantity / PACKAGE_SIZE_SMALL);
          
          // Luego calcular cuántos paquetes caben físicamente en el largo del camión
          if (itemLength > 0 && maxLength > 0) {
            // Cuántos paquetes caben a lo largo del camión (uno por cada largo de vigueta)
            const packagesThatFitInLength = Math.floor(maxLength / itemLength);
            // El número de paquetes es el máximo entre los necesarios y los que caben
            // Pero si necesito más de los que caben, se distribuyen en filas siguientes
            packages = totalPackagesNeeded;
          } else {
            // Fallback: usar paquetes de 20 si no hay largo definido
            packages = totalPackagesNeeded;
          }
        }
        
        return {
          item,
          packages,
          gridPositions: [],
          usesPackages,
        };
      })

    // Calcular total de posiciones necesarias
    const totalPositions = packagedItems.reduce((sum, p) => sum + p.packages, 0);

    // Matriz 3D para rastrear posiciones ocupadas: [floor][row][col]
    // Usamos MAX_COLS para permitir expansión dinámica
    const grid: boolean[][][] = Array(FLOORS)
      .fill(null)
      .map(() => Array(ROWS).fill(null).map(() => Array(MAX_COLS).fill(false)));

    // Estrategia: Llenar primero el piso 1 completamente, permitiendo mezclar diferentes viguetas en la misma fila
    // Solo pasar al piso 2 cuando el piso 1 esté completamente lleno
    let currentFloor = 0; // Siempre empezar desde el piso 1 (índice 0)
    let currentRow = 0;
    let currentCol = 0;

    // Crear una lista de todos los paquetes individuales para distribuir
    // Incluir información sobre el tipo de paquete (10 o 20 unidades)
    const allPackages: Array<{
      item: LoadItem;
      packageIndex: number;
      itemLength: number;
      usesLargePackage: boolean; // true si es paquete de 10, false si es de 20
    }> = [];
    
    log(`🔍 [calculateOptimalLayout] Creando paquetes para ${packagedItems.length} items (ordenados por espacio total DESC)`);
    packagedItems.forEach((packagedItem, idx) => {
      const itemLength = packagedItem.item.length || 0;
      const totalSpace = itemLength * packagedItem.item.quantity;
      log(`  📦 [${idx + 1}] ${packagedItem.item.productName}, largo: ${itemLength}m, cantidad: ${packagedItem.item.quantity}, espacio total: ${totalSpace.toFixed(2)}m, paquetes: ${packagedItem.packages}, tipo: ${packagedItem.usesPackages ? '10 uds' : '20 uds'}`);
      for (let p = 0; p < packagedItem.packages; p++) {
        allPackages.push({
          item: packagedItem.item,
          packageIndex: p,
          itemLength: itemLength,
          usesLargePackage: packagedItem.usesPackages, // true para >= 5.80m (10 unidades)
        });
      }
    });
    
    // ✅ OPTIMIZACIÓN: Ordenar paquetes para maximizar combinaciones cercanas a 7m en piso 1
    // Estrategia: Priorizar paquetes MEDIANOS que puedan combinarse para acercarse a 7m
    // Los paquetes muy largos (cercanos a 7m) van al final, para que primero se formen combinaciones
    allPackages.sort((a, b) => {
      // PRIORIDAD 1: Paquetes que pueden combinarse mejor (medianos, no muy largos ni muy cortos)
      // Los paquetes entre 2m y 5m pueden combinarse mejor para acercarse a 7m
      const aIsMedium = a.itemLength >= 2.0 && a.itemLength < maxLength * 0.75; // Entre 2m y ~5.25m (75% de 7m)
      const bIsMedium = b.itemLength >= 2.0 && b.itemLength < maxLength * 0.75;
      
      if (aIsMedium !== bIsMedium) {
        return aIsMedium ? -1 : 1; // Los medianos primero (para formar combinaciones)
      }
      
      // PRIORIDAD 2: Si ambos son medianos o ambos no, priorizar los más largos (pero no los que están muy cerca del máximo)
      // Los que están muy cerca del máximo (>= 85%) van al final, para que primero se formen combinaciones
      const aTooCloseToMax = a.itemLength >= maxLength * 0.85 && a.itemLength <= maxLength;
      const bTooCloseToMax = b.itemLength >= maxLength * 0.85 && b.itemLength <= maxLength;
      
      if (aTooCloseToMax !== bTooCloseToMax) {
        return aTooCloseToMax ? 1 : -1; // Los muy cercanos al máximo van al final
      }
      
      // PRIORIDAD 3: Entre paquetes del mismo tipo, ordenar por longitud (más largos primero, pero no los que están muy cerca del máximo)
      if (Math.abs(a.itemLength - b.itemLength) > 0.01) {
        return b.itemLength - a.itemLength;
      }
      
      // PRIORIDAD 4: Si tienen la misma longitud, priorizar los de 10 unidades (>= 5.80m)
      if (a.usesLargePackage !== b.usesLargePackage) {
        return a.usesLargePackage ? -1 : 1;
      }
      return 0;
    });
    
    log(`🔍 [calculateOptimalLayout] Total de paquetes creados: ${allPackages.length}`);
    log(`🔍 [calculateOptimalLayout] Distribución por tipo:`, {
      '10 uds': allPackages.filter(p => p.usesLargePackage).length,
      '20 uds': allPackages.filter(p => !p.usesLargePackage).length
    });
    log(`🔍 [calculateOptimalLayout] Paquetes ordenados por longitud DESC (primeros 5):`, 
      allPackages.slice(0, 5).map(p => `${p.item.productName} (${p.itemLength}m)`));

    // ✅ Los items están ordenados por espacio total (cantidad * largo) DESCENDENTE
    // ✅ Los paquetes están ordenados por longitud DESCENDENTE
    // Esto garantiza que las combinaciones más largas (que ocupan más espacio) vayan primero al piso 1

    // Rastrear el largo usado en cada fila para no exceder el largo del camión
    // Estructura: [floor][row] = suma de longitudes en esa fila
    const rowLengthUsed: number[][] = [];
    for (let f = 0; f < FLOORS; f++) {
      rowLengthUsed[f] = [];
      for (let r = 0; r < ROWS; r++) {
        rowLengthUsed[f][r] = 0;
      }
    }

    // Rastrear el tipo de paquete en cada posición para verificar compatibilidad
    // Estructura: [floor][row][col] = tipo de paquete (true = 10 unidades, false = 20 unidades, undefined = vacío)
    const packageTypeGrid: (boolean | undefined)[][][] = Array(FLOORS)
      .fill(null)
      .map(() => Array(ROWS).fill(null).map(() => Array(MAX_COLS).fill(undefined)));

    // Rastrear la longitud de la vigueta en cada posición para verificar compatibilidad
    // Estructura: [floor][row][col] = longitud de la vigueta (undefined = vacío)
    const itemLengthGrid: (number | undefined)[][][] = Array(FLOORS)
      .fill(null)
      .map(() => Array(ROWS).fill(null).map(() => Array(MAX_COLS).fill(undefined)));

    // Función auxiliar para verificar compatibilidad de paquetes y soporte
    // REGLA CRÍTICA (CORREGIDA): 
    // - Viguetas >= 5.80m (paquetes de 10) SÍ pueden ir encima de cualquier vigueta
    // - Viguetas < 5.80m (paquetes de 20) NO pueden ir encima de viguetas >= 5.80m
    // Esto es porque los paquetes de 20 unidades son más pesados y no deben apoyarse sobre paquetes de 10
    const canPlaceOnTop = (floor: number, row: number, col: number, usesLargePackage: boolean, itemLength: number): boolean => {
      if (floor === 0) return true; // Piso 1 no necesita verificación
      
      const MIN_LENGTH_FOR_PACKAGE = 5.80;
      const placingIsLarge = itemLength >= MIN_LENGTH_FOR_PACKAGE;
      
      // Verificar si hay algo directamente abajo en la misma columna
      for (let checkFloor = floor - 1; checkFloor >= 0; checkFloor--) {
        if (grid[checkFloor][row][col]) {
          const belowLength = itemLengthGrid[checkFloor][row][col];
          // Si hay algo directamente abajo, verificar compatibilidad por longitud
          if (belowLength !== undefined) {
            const belowIsLarge = belowLength >= MIN_LENGTH_FOR_PACKAGE;
            // REGLA CORREGIDA:
            // - Si estamos colocando vigueta >= 5.80m (paquete de 10): puede ir sobre cualquier cosa
            // - Si estamos colocando vigueta < 5.80m (paquete de 20): NO puede ir sobre vigueta >= 5.80m
            if (placingIsLarge) {
              // Viguetas >= 5.80m pueden ir sobre cualquier vigueta
              return true;
            } else {
              // Viguetas < 5.80m solo pueden ir sobre viguetas < 5.80m
              return !belowIsLarge;
            }
          }
        }
      }
      
      // Si no hay nada directamente abajo, verificar si hay soporte en la misma fila
      // Buscar en todos los pisos inferiores
      for (let checkFloor = floor - 1; checkFloor >= 0; checkFloor--) {
        let hasSupportInRow = false;
        let foundLength: number | undefined = undefined;
        
        // Buscar si hay algo en esta fila en el piso inferior
        for (let checkCol = 0; checkCol < MAX_COLS; checkCol++) {
          if (grid[checkFloor][row][checkCol]) {
            hasSupportInRow = true;
            const belowLength = itemLengthGrid[checkFloor][row][checkCol];
            if (belowLength !== undefined) {
              foundLength = belowLength;
              break; // Usar la primera longitud encontrada en esta fila
            }
          }
        }
        
        // Si encontramos soporte en esta fila, verificar compatibilidad por longitud
        if (hasSupportInRow && foundLength !== undefined) {
          const belowIsLarge = foundLength >= MIN_LENGTH_FOR_PACKAGE;
          // REGLA CORREGIDA:
          // - Si estamos colocando vigueta >= 5.80m (paquete de 10): puede ir sobre cualquier cosa
          // - Si estamos colocando vigueta < 5.80m (paquete de 20): NO puede ir sobre vigueta >= 5.80m
          if (placingIsLarge) {
            return true; // Viguetas >= 5.80m pueden ir sobre cualquier vigueta
          } else {
            return !belowIsLarge; // Viguetas < 5.80m solo pueden ir sobre viguetas < 5.80m
          }
        }
        
        // Si hay soporte pero no encontramos longitud específica, continuar buscando
        if (hasSupportInRow) {
          continue;
        }
      }
      
      // Si no hay soporte en ningún piso inferior, no podemos colocar aquí
      return false;
    };

    // Distribuir paquetes con estrategia mejorada
    // 1. Priorizar llenar completamente el piso 1
    // 2. Luego llenar pisos superiores respetando compatibilidad de paquetes
    // 3. Maximizar espacios mezclando diferentes viguetas en la misma fila
    log(`🔍 [calculateOptimalLayout] Iniciando distribución de ${allPackages.length} paquetes en grilla ${FLOORS}x${ROWS}x${MAX_COLS} (maxLength: ${maxLength}m)`);
    let placedCount = 0;
    let notPlacedCount = 0;
    const notPlacedByProduct: { [key: string]: number } = {};
    
    allPackages.forEach((pkg, pkgIndex) => {
      let found = false;
      const pkgLength = pkg.itemLength;
      const usesLargePackage = pkg.usesLargePackage;
      
      if (pkgIndex % 10 === 0 || pkgIndex < 5) {
        log(`  🔄 Intentando paquete ${pkgIndex + 1}/${allPackages.length}: ${pkg.item.productName} (${pkgLength}m, ${usesLargePackage ? '10 uds' : '20 uds'})`);
      }

      // ✅ ESTRATEGIA OPTIMIZADA: Priorizar llenar filas vacías del piso 1 primero
      // Esto permite que las combinaciones más largas (ej: 7m) se formen en filas vacías del piso 1
      // Solo después de llenar todas las filas vacías, empezar a llenar filas parciales
      
      // Crear lista de filas del piso 1 ordenadas: primero vacías, luego por espacio usado
      const floor1Rows = Array.from({ length: ROWS }, (_, i) => i)
        .map(row => ({
          row,
          spaceUsed: rowLengthUsed[0][row],
          remainingSpace: maxLength - rowLengthUsed[0][row],
          isEmpty: rowLengthUsed[0][row] < 0.01 // Considerar vacía si tiene menos de 1cm
        }))
        .filter(r => r.remainingSpace >= pkgLength) // Solo filas con espacio suficiente
        .sort((a, b) => {
          // PRIORIDAD 1: Filas vacías primero (para formar combinaciones largas desde cero)
          if (a.isEmpty !== b.isEmpty) {
            return a.isEmpty ? -1 : 1; // Vacías primero
          }
          // PRIORIDAD 2: Si ambas están vacías o ambas tienen contenido, priorizar las que tienen menos espacio usado
          // Esto permite llenar filas vacías primero, y luego completar las parciales
          if (Math.abs(a.spaceUsed - b.spaceUsed) < 0.01) {
            return a.remainingSpace - b.remainingSpace; // Menos espacio restante primero (para completar filas)
          }
          return a.spaceUsed - b.spaceUsed; // Menos espacio usado primero (llenar vacías antes que parciales)
        });
      
      // Intentar colocar en las filas ordenadas del piso 1
      for (const rowInfo of floor1Rows) {
        if (found) break;
        const f1Row = rowInfo.row;
        const currentLengthInRow = rowLengthUsed[0][f1Row];
        
        // Verificar si hay espacio en términos de largo en esta fila
        if (currentLengthInRow + pkgLength <= maxLength) {
          // Buscar en TODAS las columnas posibles (hasta MAX_COLS)
          for (let f1Col = 0; f1Col < MAX_COLS && !found; f1Col++) {
            // Verificar que la posición esté vacía
            if (!grid[0][f1Row][f1Col]) {
              // Verificar nuevamente el largo antes de colocar (por si cambió)
              const verifyLength = rowLengthUsed[0][f1Row];
              if (verifyLength + pkgLength <= maxLength) {
                // Cabe en esta fila y columna, agregarlo
                grid[0][f1Row][f1Col] = true;
                packageTypeGrid[0][f1Row][f1Col] = usesLargePackage;
                itemLengthGrid[0][f1Row][f1Col] = pkgLength;
                rowLengthUsed[0][f1Row] += pkgLength;
                const packagedItem = packagedItems.find(p => p.item.productId === pkg.item.productId);
                if (packagedItem) {
                  packagedItem.gridPositions.push({
                    floor: 1, // Piso 1
                    row: f1Row + 1,
                    col: f1Col + 1,
                  });
                }
                found = true;
                placedCount++;
                if (pkgIndex < 5 || placedCount % 10 === 0) {
                  log(`    ✅ Colocado en Piso 1, Fila ${f1Row + 1}, Col ${f1Col + 1} (largo usado: ${rowLengthUsed[0][f1Row].toFixed(2)}m/${maxLength}m)`);
                }
              }
            }
          }
        }
      }
        
      // Si aún no encontramos espacio en piso 1, buscar en pisos superiores (2, 3, 4)
      // ESTRATEGIA MEJORADA: Buscar de manera más exhaustiva y flexible
      if (!found) {
        // Buscar en orden: piso 2, luego 3, luego 4
        for (let floor = 1; floor < FLOORS && !found; floor++) {
          for (let fRow = 0; fRow < ROWS && !found; fRow++) {
            // Verificar si hay espacio en términos de largo en esta fila del piso actual
            const currentLengthInRow = rowLengthUsed[floor][fRow];
            if (currentLengthInRow + pkgLength <= maxLength) {
              // Buscar en TODAS las columnas posibles (hasta MAX_COLS)
              for (let fCol = 0; fCol < MAX_COLS && !found; fCol++) {
                // Verificar que la posición esté vacía en el piso actual
                if (!grid[floor][fRow][fCol]) {
                  // Verificar compatibilidad de paquetes y soporte
                  if (canPlaceOnTop(floor, fRow, fCol, usesLargePackage, pkgLength)) {
                    // Verificar que haya soporte (directo o en la misma fila)
                    let hasSupport = false;
                    
                    // Verificar soporte directo abajo
                    for (let checkFloor = floor - 1; checkFloor >= 0; checkFloor--) {
                      if (grid[checkFloor][fRow][fCol]) {
                        hasSupport = true;
                        break;
                      }
                    }
                    
                    // Si no hay soporte directo, verificar soporte en la misma fila
                    if (!hasSupport) {
                      for (let checkFloor = floor - 1; checkFloor >= 0; checkFloor--) {
                        for (let checkCol = 0; checkCol < MAX_COLS; checkCol++) {
                          if (grid[checkFloor][fRow][checkCol]) {
                            hasSupport = true;
                            break;
                          }
                        }
                        if (hasSupport) break;
                      }
                    }
                    
                    // Si hay soporte y compatibilidad, colocar el paquete
                    if (hasSupport) {
                      // Verificar nuevamente el largo antes de colocar
                      const finalLengthInRow = rowLengthUsed[floor][fRow];
                      if (finalLengthInRow + pkgLength <= maxLength) {
                        // Colocar el paquete
                        grid[floor][fRow][fCol] = true;
                        packageTypeGrid[floor][fRow][fCol] = usesLargePackage;
                        itemLengthGrid[floor][fRow][fCol] = pkgLength;
                        rowLengthUsed[floor][fRow] += pkgLength;
                        const packagedItem = packagedItems.find(p => p.item.productId === pkg.item.productId);
                        if (packagedItem) {
                          packagedItem.gridPositions.push({
                            floor: floor + 1, // Piso 2, 3 o 4
                            row: fRow + 1,
                            col: fCol + 1,
                          });
                        }
                        found = true;
                        placedCount++;
                        if (pkgIndex < 5 || placedCount % 10 === 0) {
                          log(`    ✅ Colocado en Piso ${floor + 1}, Fila ${fRow + 1}, Col ${fCol + 1}`);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      // ÚLTIMO INTENTO: Si aún no se encontró posición, intentar colocar en cualquier espacio disponible
      // Esto asegura que no dejemos paquetes afuera si hay espacio físico disponible
      if (!found) {
        log(`  ⚠️ [ÚLTIMO INTENTO] Buscando posición alternativa para ${pkg.item.productName} (${pkgLength}m)`);
        
        // Buscar en todos los pisos, filas y columnas de manera más agresiva
        // Priorizar piso 1 primero, luego pisos superiores
        for (let floor = 0; floor < FLOORS && !found; floor++) {
          for (let fRow = 0; fRow < ROWS && !found; fRow++) {
            const currentLengthInRow = rowLengthUsed[floor][fRow];
            // Verificar si hay espacio en términos de largo
            if (currentLengthInRow + pkgLength <= maxLength) {
              // Buscar en TODAS las columnas posibles
              for (let fCol = 0; fCol < MAX_COLS && !found; fCol++) {
                if (!grid[floor][fRow][fCol]) {
                  // Para piso 1, siempre permitir si hay espacio
                  if (floor === 0) {
                    // Verificar nuevamente el largo antes de colocar
                    const verifyLength = rowLengthUsed[floor][fRow];
                    if (verifyLength + pkgLength <= maxLength) {
                      grid[floor][fRow][fCol] = true;
                      packageTypeGrid[floor][fRow][fCol] = usesLargePackage;
                      itemLengthGrid[floor][fRow][fCol] = pkgLength;
                      rowLengthUsed[floor][fRow] += pkgLength;
                      const packagedItem = packagedItems.find(p => p.item.productId === pkg.item.productId);
                      if (packagedItem) {
                        packagedItem.gridPositions.push({
                          floor: floor + 1,
                          row: fRow + 1,
                          col: fCol + 1,
                        });
                      }
                      found = true;
                      placedCount++;
                      log(`    ✅ [ÚLTIMO INTENTO] Colocado en Piso ${floor + 1}, Fila ${fRow + 1}, Col ${fCol + 1} (largo usado: ${rowLengthUsed[floor][fRow].toFixed(2)}m/${maxLength}m)`);
                    }
                  } else {
                    // Para pisos superiores, ser más flexible:
                    // 1. Si hay algo en cualquier piso inferior en esta fila, permitir (soporte lateral)
                    // 2. Verificar compatibilidad por longitud real (>= 5.80m solo con >= 5.80m)
                    const MIN_LENGTH_FOR_PACKAGE = 5.80;
                    const placingIsLarge = pkgLength >= MIN_LENGTH_FOR_PACKAGE;
                    let hasSupportInRow = false;
                    let compatibleLength = true;
                    
                    // Buscar soporte en cualquier piso inferior de esta fila
                    for (let checkFloor = floor - 1; checkFloor >= 0; checkFloor--) {
                      for (let checkCol = 0; checkCol < MAX_COLS; checkCol++) {
                        if (grid[checkFloor][fRow][checkCol]) {
                          hasSupportInRow = true;
                          // Si hay algo directamente abajo en la misma columna, verificar compatibilidad por longitud
                          if (checkCol === fCol) {
                            const belowLength = itemLengthGrid[checkFloor][fRow][checkCol];
                            if (belowLength !== undefined) {
                              const belowIsLarge = belowLength >= MIN_LENGTH_FOR_PACKAGE;
                              // REGLA CORREGIDA:
                              // - Si estamos colocando vigueta >= 5.80m (paquete de 10): puede ir sobre cualquier cosa
                              // - Si estamos colocando vigueta < 5.80m (paquete de 20): NO puede ir sobre vigueta >= 5.80m
                              if (!placingIsLarge && belowIsLarge) {
                                // Vigueta < 5.80m NO puede ir sobre vigueta >= 5.80m
                                compatibleLength = false;
                              }
                              // Si placingIsLarge es true, siempre es compatible (puede ir sobre cualquier cosa)
                            }
                          }
                          break;
                        }
                      }
                      if (hasSupportInRow) break;
                    }
                    
                    // Si hay soporte en la fila y es compatible por longitud, colocar
                    if (hasSupportInRow && compatibleLength) {
                      // Verificar nuevamente el largo antes de colocar
                      const verifyLength = rowLengthUsed[floor][fRow];
                      if (verifyLength + pkgLength <= maxLength) {
                        grid[floor][fRow][fCol] = true;
                        packageTypeGrid[floor][fRow][fCol] = usesLargePackage;
                        itemLengthGrid[floor][fRow][fCol] = pkgLength;
                        rowLengthUsed[floor][fRow] += pkgLength;
                        const packagedItem = packagedItems.find(p => p.item.productId === pkg.item.productId);
                        if (packagedItem) {
                          packagedItem.gridPositions.push({
                            floor: floor + 1,
                            row: fRow + 1,
                            col: fCol + 1,
                          });
                        }
                        found = true;
                        placedCount++;
                        log(`    ✅ [ÚLTIMO INTENTO] Colocado en Piso ${floor + 1}, Fila ${fRow + 1}, Col ${fCol + 1} (soporte lateral)`);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      if (!found) {
        notPlacedCount++;
        const productName = pkg.item.productName;
        notPlacedByProduct[productName] = (notPlacedByProduct[productName] || 0) + 1;
        // Solo mostrar los primeros 3 errores para reducir ruido en consola
        if (notPlacedCount <= 3) {
          log(`❌ No se pudo encontrar posición para paquete ${pkgIndex + 1} de ${pkg.item.productName} (largo: ${pkgLength}m, tipo: ${usesLargePackage ? '10 unidades' : '20 unidades'}, largo disponible: ${maxLength}m)`);
        }
      }
    });
    
    log(`📊 [calculateOptimalLayout] Distribución completada:`);
    log(`  ✅ Paquetes colocados: ${placedCount}/${allPackages.length}`);
    log(`  ❌ Paquetes NO colocados: ${notPlacedCount}/${allPackages.length}`);
    
    // Verificar que todos los paquetes se procesaron
    if (placedCount + notPlacedCount !== allPackages.length) {
      console.error(`  ⚠️ ERROR: Discrepancia en conteo! ${placedCount} + ${notPlacedCount} != ${allPackages.length}`);
    }
    
    // Mostrar resumen por producto
    const packagesByProduct: { [key: string]: { total: number; placed: number; notPlaced: number } } = {};
    allPackages.forEach(pkg => {
      const name = pkg.item.productName;
      if (!packagesByProduct[name]) {
        packagesByProduct[name] = { total: 0, placed: 0, notPlaced: 0 };
      }
      packagesByProduct[name].total++;
    });
    
    packagedItems.forEach(packagedItem => {
      const name = packagedItem.item.productName;
      if (packagesByProduct[name]) {
        packagesByProduct[name].placed = packagedItem.gridPositions.length;
        packagesByProduct[name].notPlaced = packagesByProduct[name].total - packagesByProduct[name].placed;
      }
    });
    
    log(`  📋 Resumen por producto:`, packagesByProduct);
    
    if (notPlacedCount > 0) {
      console.warn(`  ⚠️ ATENCIÓN: ${notPlacedCount} paquetes NO pudieron ser colocados`);
      console.warn(`  📋 Paquetes no colocados por producto:`, notPlacedByProduct);
    }

    // Crear un item por cada paquete con su posición individual
    // Esto permite que cada casillero tenga máximo 1 paquete
    const itemsWithPositions: LoadItem[] = [];
    
    log(`🔍 [calculateOptimalLayout] Creando items con posiciones para ${packagedItems.length} packagedItems`);
    packagedItems.forEach((packagedItem) => {
      const itemLength = packagedItem.item.length || 0;
      const usesPackages = packagedItem.usesPackages;
      const packageSize = usesPackages ? PACKAGE_SIZE_LARGE : PACKAGE_SIZE_SMALL;
      
      const placedPackages = packagedItem.gridPositions.length;
      const totalPackages = packagedItem.packages;
      const notPlacedPackages = totalPackages - placedPackages;
      
      log(`  📦 Procesando ${packagedItem.item.productName}: ${placedPackages} posiciones de ${totalPackages} paquetes totales (${notPlacedPackages} sin posición)`);
      
      // Crear un item por cada paquete COLOCADO
      packagedItem.gridPositions.forEach((position, index) => {
        const unitsInThisPackage = Math.min(
          packageSize,
          packagedItem.item.quantity - (index * packageSize)
        );
        
        itemsWithPositions.push({
          ...packagedItem.item,
          quantity: unitsInThisPackage, // Cantidad en este paquete específico
          gridPosition: position,
        });
      });
      
      // IMPORTANTE: Si hay paquetes sin posición, crear items sin gridPosition
      // para que no se pierdan las unidades
      if (notPlacedPackages > 0) {
        const totalUnitsPlaced = placedPackages * packageSize;
        const remainingUnits = packagedItem.item.quantity - totalUnitsPlaced;
        
        if (remainingUnits > 0) {
          // Solo loggear si hay muchos items sin posición para reducir ruido
          if (notPlacedCount > 5) {
            log(`  ⚠️ Creando item SIN posición para ${remainingUnits} unidades restantes de ${packagedItem.item.productName}`);
          }
          // Crear un item con las unidades restantes pero sin posición
          // Esto permitirá que se muestren en el resumen pero no en la grilla
          itemsWithPositions.push({
            ...packagedItem.item,
            quantity: remainingUnits,
            gridPosition: undefined, // Sin posición = no cabe en el camión
          });
        }
      }
    });
    
    log('📦 [calculateOptimalLayout] Items retornados:', itemsWithPositions.length);
    log('📦 [calculateOptimalLayout] Items con gridPosition:', itemsWithPositions.filter(item => item.gridPosition).length);
    if (itemsWithPositions.length > 0) {
      log('📦 [calculateOptimalLayout] Primeros 3 items:', itemsWithPositions.slice(0, 3).map(item => ({
        productName: item.productName,
        quantity: item.quantity,
        gridPosition: item.gridPosition
      })));
    }
    
    // Ordenar filas: las más largas abajo, respetando regla de viguetas >= 5.80m
    const sortedItemsByRow = sortRowsByLength(itemsWithPositions);
    
    return sortedItemsByRow;
  };

  // Función para ordenar filas: más largas abajo, respetando regla de viguetas
  const sortRowsByLength = (items: LoadItem[]): LoadItem[] => {
    const MIN_LENGTH_THRESHOLD = 5.80;
    
    // Separar items con y sin posición
    const itemsWithPosition = items.filter(item => item.gridPosition);
    const itemsWithoutPosition = items.filter(item => !item.gridPosition);
    
    if (itemsWithPosition.length === 0) {
      return items;
    }
    
    // Agrupar items por piso y fila
    const itemsByFloorRow: { [floor: number]: { [row: number]: LoadItem[] } } = {};
    
    itemsWithPosition.forEach(item => {
      if (!item.gridPosition) return;
      const floor = item.gridPosition.floor;
      const row = item.gridPosition.row;
      
      if (!itemsByFloorRow[floor]) {
        itemsByFloorRow[floor] = {};
      }
      if (!itemsByFloorRow[floor][row]) {
        itemsByFloorRow[floor][row] = [];
      }
      itemsByFloorRow[floor][row].push(item);
    });
    
    // Calcular longitud total y tipo de cada fila
    const rowInfo: Array<{
      floor: number;
      row: number;
      totalLength: number;
      hasLargeViguetas: boolean; // true si tiene al menos una vigueta >= 5.80m
      items: LoadItem[];
    }> = [];
    
    Object.keys(itemsByFloorRow).forEach(floorStr => {
      const floor = parseInt(floorStr);
      Object.keys(itemsByFloorRow[floor]).forEach(rowStr => {
        const row = parseInt(rowStr);
        const rowItems = itemsByFloorRow[floor][row];
        
        // Calcular longitud total de la fila (suma de longitudes de items)
        const totalLength = rowItems.reduce((sum, item) => {
          return sum + (item.length || 0) * item.quantity;
        }, 0);
        
        // Verificar si la fila tiene viguetas >= 5.80m
        const hasLargeViguetas = rowItems.some(item => (item.length || 0) >= MIN_LENGTH_THRESHOLD);
        
        rowInfo.push({
          floor,
          row,
          totalLength,
          hasLargeViguetas,
          items: rowItems,
        });
      });
    });
    
    // Ordenar filas dentro de cada piso
    // Estrategia: 
    // 1. Ordenar TODAS las filas por longitud (más largas primero = abajo)
    // 2. Aplicar regla de viguetas: si una fila con viguetas < 5.80m está arriba de una con >= 5.80m, intercambiar
    // 3. Asegurar que las filas más largas queden abajo, respetando la regla
    
    const floors = Object.keys(itemsByFloorRow).map(f => parseInt(f)).sort((a, b) => a - b);
    const newRowAssignments: { [floor: number]: { [oldRow: number]: number } } = {};
    
    floors.forEach(floor => {
      const floorRows = rowInfo.filter(r => r.floor === floor);
      
      // Primero ordenar TODAS las filas por longitud (más largas primero = abajo)
      const sortedByLength = [...floorRows].sort((a, b) => b.totalLength - a.totalLength);
      
      // Aplicar regla de viguetas: filas con viguetas < 5.80m NO pueden estar arriba de filas con >= 5.80m
      // Si encontramos una fila pequeña arriba de una grande, intercambiar
      const finalOrder: typeof sortedByLength = [];
      const remainingRows = [...sortedByLength];
      
      // Estrategia: ir colocando filas de abajo hacia arriba
      // - Si la fila más larga tiene viguetas >= 5.80m, puede ir abajo
      // - Si la fila más larga tiene viguetas < 5.80m, verificar que no haya filas con >= 5.80m pendientes
      while (remainingRows.length > 0) {
        // Buscar la fila más larga que pueda ir en la siguiente posición
        let selectedIndex = -1;
        
        for (let i = 0; i < remainingRows.length; i++) {
          const candidate = remainingRows[i];
          
          // Si la fila candidata tiene viguetas >= 5.80m, puede ir en cualquier posición
          if (candidate.hasLargeViguetas) {
            selectedIndex = i;
            break;
          }
          
          // Si la fila candidata tiene viguetas < 5.80m, verificar que no haya filas con >= 5.80m pendientes
          // Si no hay filas grandes pendientes, puede ir
          const hasLargeRowsPending = remainingRows.some((r, idx) => idx !== i && r.hasLargeViguetas);
          if (!hasLargeRowsPending) {
            selectedIndex = i;
            break;
          }
        }
        
        // Si no encontramos candidato válido, tomar el primero (no debería pasar)
        if (selectedIndex === -1) {
          selectedIndex = 0;
        }
        
        finalOrder.push(remainingRows[selectedIndex]);
        remainingRows.splice(selectedIndex, 1);
      }
      
      // Asignar nuevas posiciones de fila (abajo = menor número)
      if (!newRowAssignments[floor]) {
        newRowAssignments[floor] = {};
      }
      
      finalOrder.forEach((rowInfo, index) => {
        newRowAssignments[floor][rowInfo.row] = index;
      });
    });
    
    // Reasignar posiciones de fila en los items
    const reorderedItems = itemsWithPosition.map(item => {
      if (!item.gridPosition) return item;
      
      const floor = item.gridPosition.floor;
      const oldRow = item.gridPosition.row;
      const newRow = newRowAssignments[floor]?.[oldRow];
      
      if (newRow !== undefined && newRow !== oldRow) {
        return {
          ...item,
          gridPosition: {
            ...item.gridPosition,
            row: newRow,
          },
        };
      }
      
      return item;
    });
    
    // Combinar items reordenados con items sin posición
    return [...reorderedItems, ...itemsWithoutPosition];
  };

  // Ordenar items: más largas abajo (mayor posición), más cortas arriba (menor posición)
  const sortItemsByLength = (items: LoadItem[]): LoadItem[] => {
    // Primero calcular la disposición óptima
    const itemsWithLayout = calculateOptimalLayout(items, selectedTruckData);
    
    // Luego ordenar por posición en la grilla (piso, fila, columna)
    const sorted = [...itemsWithLayout].sort((a, b) => {
      if (a.gridPosition && b.gridPosition) {
        // Ordenar por piso (ascendente: piso 1 primero si empezamos desde abajo), luego fila, luego columna
        if (a.gridPosition.floor !== b.gridPosition.floor) {
          return a.gridPosition.floor - b.gridPosition.floor; // Piso 1 primero
        }
        if (a.gridPosition.row !== b.gridPosition.row) {
          return a.gridPosition.row - b.gridPosition.row;
        }
        return a.gridPosition.col - b.gridPosition.col;
      }
      // Si no tienen posición en grilla, ordenar por longitud
      const lengthA = a.length || 0;
      const lengthB = b.length || 0;
      return lengthB - lengthA;
    });
    
    // Reasignar posiciones
    return sorted.map((item, index) => ({
      ...item,
      position: index,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTruck) {
      toast({
        title: 'Error',
        description: 'Seleccione un camión',
        variant: 'destructive',
      });
      return;
    }

    // Filtrar items vacíos antes de validar
    const validItems = loadItems.filter(item => item.productId && item.productId !== '');
    
    if (validItems.length === 0) {
      toast({
        title: 'Error',
        description: 'Agregue al menos una vigueta a la carga',
        variant: 'destructive',
      });
      return;
    }

    // Calcular pesos individuales para EQUIPO antes de validar (en kilos, luego convertir a toneladas)
    const calculatedChasisWeightKg = selectedTruckData?.type === 'EQUIPO' && chasisLayout
      ? chasisLayout.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0)
      : 0;
    const calculatedChasisWeight = calculatedChasisWeightKg / 1000; // Convertir a toneladas
    
    const calculatedAcopladoWeightKg = selectedTruckData?.type === 'EQUIPO' && acopladoLayout
      ? acopladoLayout.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0)
      : 0;
    const calculatedAcopladoWeight = calculatedAcopladoWeightKg / 1000; // Convertir a toneladas

    // Validar pesos individuales para EQUIPO antes de guardar
    if (selectedTruckData?.type === 'EQUIPO') {
      if (selectedTruckData.chasisWeight && calculatedChasisWeight > selectedTruckData.chasisWeight) {
        toast({
          title: 'Error',
          description: `El peso del chasis (${calculatedChasisWeight.toFixed(2)} Tn) excede el máximo permitido (${selectedTruckData.chasisWeight} Tn)`,
          variant: 'destructive',
        });
        return;
      }
      if (selectedTruckData.acopladoWeight && calculatedAcopladoWeight > selectedTruckData.acopladoWeight) {
        toast({
          title: 'Error',
          description: `El peso del acoplado (${calculatedAcopladoWeight.toFixed(2)} Tn) excede el máximo permitido (${selectedTruckData.acopladoWeight} Tn)`,
          variant: 'destructive',
        });
        return;
      }
    }

    // Para EQUIPO, usar los items distribuidos entre chasis y acoplado
    // Para otros tipos, usar los items originales ordenados
    let itemsToSave: LoadItem[] = [];
    
    if (selectedTruckData?.type === 'EQUIPO' && chasisLayout && acopladoLayout) {
      // Agrupar TODOS los items (chasis + acoplado) por producto y sumar cantidades
      const itemsByProduct: { [productId: string]: LoadItem } = {};
      
      // ✨ FIX: Guardar el orden original de los items definido por el usuario
      const originalPositions: { [productId: string]: number } = {};
      validItems.forEach((item, index) => {
        if (originalPositions[item.productId] === undefined) {
          originalPositions[item.productId] = item.position ?? index;
        }
      });
      
      // Procesar TODOS los items del chasis (con y sin posición)
      chasisLayout.forEach(item => {
        const key = item.productId;
        if (!itemsByProduct[key]) {
          itemsByProduct[key] = {
            ...item,
            quantity: 0,
            gridPosition: undefined, // No guardar gridPosition en la BD
          };
        }
        itemsByProduct[key].quantity += item.quantity;
      });
      
      // Procesar TODOS los items del acoplado (con y sin posición)
      acopladoLayout.forEach(item => {
        const key = item.productId;
        if (!itemsByProduct[key]) {
          itemsByProduct[key] = {
            ...item,
            quantity: 0,
            gridPosition: undefined, // No guardar gridPosition en la BD
          };
        }
        itemsByProduct[key].quantity += item.quantity;
      });
      
      // ✨ FIX: Convertir a array, ordenar por posición original del usuario, y reasignar posiciones
      itemsToSave = Object.values(itemsByProduct)
        .filter(item => item.quantity > 0)
        .sort((a, b) => (originalPositions[a.productId] ?? 999) - (originalPositions[b.productId] ?? 999))
        .map((item, index) => ({
          ...item,
          position: index,
        }));
      
      log('📦 [GUARDAR EQUIPO] Items a guardar:', itemsToSave.length);
      log('📦 [GUARDAR EQUIPO] Items:', itemsToSave.map(i => `${i.productName}: ${i.quantity} uds`));
      log('📦 [GUARDAR EQUIPO] Total unidades:', itemsToSave.reduce((sum, item) => sum + item.quantity, 0));
      
      // Verificar que no se perdieron items
      const totalOriginalQuantity = validItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalSavedQuantity = itemsToSave.reduce((sum, item) => sum + item.quantity, 0);
      log('📦 [GUARDAR EQUIPO] Verificación: Originales:', totalOriginalQuantity, 'Guardados:', totalSavedQuantity);
      
      if (totalOriginalQuantity !== totalSavedQuantity) {
        console.warn(`⚠️ [GUARDAR EQUIPO] ADVERTENCIA: Diferencia de ${totalOriginalQuantity - totalSavedQuantity} unidades`);
      }
    } else {
      // Para CHASIS o SEMI, usar el layout ya calculado (layoutItems) para mantener consistencia
      // con la visualización que el usuario ve antes de guardar
      if (layoutItems && layoutItems.length > 0) {
        // Agrupar items por producto y sumar cantidades (igual que para EQUIPO)
        const itemsByProduct: { [productId: string]: LoadItem } = {};
        
        layoutItems.forEach(item => {
          const key = item.productId;
          if (!itemsByProduct[key]) {
            itemsByProduct[key] = {
              ...item,
              quantity: 0,
              gridPosition: undefined, // No guardar gridPosition en la BD
            };
          }
          itemsByProduct[key].quantity += item.quantity;
        });
        
        // Convertir a array y mantener solo los items con cantidad > 0
        // Ordenar por la posición original del primer item de cada producto
        const originalPositions: { [productId: string]: number } = {};
        validItems.forEach((item, index) => {
          if (originalPositions[item.productId] === undefined) {
            originalPositions[item.productId] = index;
          }
        });
        
        itemsToSave = Object.values(itemsByProduct)
          .filter(item => item.quantity > 0)
          .sort((a, b) => (originalPositions[a.productId] || 0) - (originalPositions[b.productId] || 0))
          .map((item, index) => ({
            ...item,
            position: index,
          }));
        
        log('📦 [GUARDAR CHASIS/SEMI] Items a guardar:', itemsToSave.length);
        log('📦 [GUARDAR CHASIS/SEMI] Items:', itemsToSave.map(i => `${i.productName}: ${i.quantity} uds`));
      } else {
        // Fallback: usar los items originales ordenados si no hay layoutItems
        itemsToSave = sortItemsByLength(validItems);
      }
    }

    try {
      const url = editingLoad ? `/api/loads/${editingLoad.id}` : '/api/loads';
      const method = editingLoad ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          truckId: selectedTruck,
          date: formData.date,
          description: formData.description || null,
          deliveryClient: selectedTruckData?.isOwn ? (formData.isCorralon ? null : (formData.deliveryClient || null)) : null,
          deliveryAddress: selectedTruckData?.isOwn ? (formData.isCorralon ? 'Corralón' : (formData.deliveryAddress || null)) : null,
          isCorralon: selectedTruckData?.isOwn ? formData.isCorralon : false,
          items: itemsToSave,
          // Enviar pesos calculados para validación en EQUIPO
          chasisWeight: selectedTruckData?.type === 'EQUIPO' ? calculatedChasisWeight : undefined,
          acopladoWeight: selectedTruckData?.type === 'EQUIPO' ? calculatedAcopladoWeight : undefined,
        }),
      });

      if (response.ok) {
        const savedLoad = await response.json();
        toast({
          title: 'Éxito',
          description: editingLoad
            ? 'Carga actualizada correctamente'
            : 'Carga creada correctamente',
        });
        setIsDialogOpen(false);
        resetForm();
        refreshLoads();
        
        // Abrir vista de impresión con la carga guardada
        // La API ya devuelve la carga completa con truck e items
        if (savedLoad && savedLoad.id) {
          // ✨ FIX: Guardar la distribución actual para que LoadPrintView la use
          setPrintingDistribution({
            chasisLayout,
            acopladoLayout,
            chasisGridViz,
            acopladoGridViz,
            chasisCols,
            acopladoCols,
            layoutItems,
            gridVisualization,
            fullCols,
          });
          setPrintingLoad(savedLoad);
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Error al guardar la carga',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving load:', error);
      toast({
        title: 'Error',
        description: 'Error al guardar la carga',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (load: Load) => {
    setEditingLoad(load);
    setSelectedTruck(load.truckId);
    // Agregar tempCode a los items existentes y un casillero vacío al final
    const itemsWithTempCode = load.items.map(item => ({
      ...item,
      tempCode: '',
    }));
    setLoadItems([...itemsWithTempCode, {
      productId: '',
      productName: '',
      quantity: 1,
      length: null,
      weight: null,
      position: load.items.length,
      notes: null,
      tempCode: '',
    }]);
    setFormData({
      date: new Date(load.date).toISOString().split('T')[0],
      description: load.description || '',
      deliveryClient: load.deliveryClient || '',
      deliveryAddress: load.deliveryAddress || '',
      isCorralon: load.isCorralon || false,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Está seguro de que desea eliminar esta carga?')) {
      return;
    }

    try {
      const response = await fetch(`/api/loads/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: 'Carga eliminada correctamente',
        });
        refreshLoads();
      } else {
        toast({
          title: 'Error',
          description: 'Error al eliminar la carga',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting load:', error);
      toast({
        title: 'Error',
        description: 'Error al eliminar la carga',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      deliveryClient: '',
      deliveryAddress: '',
      isCorralon: false,
    });
    setSelectedTruck(null);
    // Inicializar con un casillero vacío
    setLoadItems([{
      productId: '',
      productName: '',
      quantity: 1,
      length: null,
      weight: null,
      position: 0,
      notes: null,
      tempCode: '',
    }]);
    setEditingLoad(null);
  };

  const selectedTruckData = trucks.find((t) => t.id === selectedTruck);
  
  // Calcular peso total (correcto)
  const totalWeight = loadItems.reduce(
    (sum, item) => sum + (item.weight || 0) * item.quantity,
    0
  );
  
  // Calcular pesos individuales para EQUIPO (se calculan después del useMemo)
  // Estas variables se usarán en el render, pero en handleSubmit se calcularán de nuevo
  
  // Para "Total cargado", usar el largo del camión si hay items, no la suma de longitudes
  // El largo cargado es el largo del camión utilizado (no la suma de todas las viguetas)
  const totalLengthUsed = selectedTruckData 
    ? (loadItems.filter(item => item.productId && item.quantity > 0).length > 0 
        ? selectedTruckData.length 
        : 0)
    : 0;

  // Función para renderizar la visualización de la grilla
  const renderGridVisualization = (
    gridViz: { [key: string]: LoadItem[] },
    layoutItems: LoadItem[],
    sectionPrefix: string = '',
    numCols: number = 3
  ) => {
    const MIN_LENGTH_FOR_PACKAGE = 5.80;
    const PACKAGE_SIZE_LARGE = 10;
    const PACKAGE_SIZE_SMALL = 20;
    // No agregar guion aquí, lo agregaremos al construir las claves
    const prefix = sectionPrefix || '';
    
    // Debug: mostrar todas las claves disponibles
    if (Object.keys(gridViz).length > 0) {
      log(`GridViz keys (sectionPrefix: "${sectionPrefix}", prefix: "${prefix}"):`, Object.keys(gridViz).sort());
      // Debug opcional: buscar claves específicas (solo en modo debug)
      // Comentado para reducir ruido en consola
      // const c3Keys = Object.keys(gridViz).filter(k => k.match(/-\d+-\d+-3$/));
      // if (c3Keys.length > 0) {
      //   log(`🔍 Claves que contienen C3 en gridViz:`, c3Keys);
      // }
    }
    
    // Obtener largo máximo según la sección
    const maxLength = selectedTruckData?.type === 'EQUIPO' && sectionPrefix === 'chasis'
      ? (selectedTruckData.chasisLength || 0)
      : selectedTruckData?.type === 'EQUIPO' && sectionPrefix === 'acoplado'
      ? (selectedTruckData.acopladoLength || 0)
      : (selectedTruckData?.length || 0);
    
    return (
      <>
        {/* Grilla por pisos */}
        <div className="space-y-6">
          {[1, 2, 3, 4].map((floor) => {
            // Para cada fila, calcular qué columnas tienen contenido
            // Buscar TODAS las columnas con contenido en este piso
            // Buscar directamente en gridViz sin limitaciones
            const rowsData: Array<{ row: number; cols: number[] }> = [];
            
            [1, 2, 3].forEach((row) => {
              const colsWithContent: number[] = [];
              // Buscar en un rango amplio de columnas (hasta 50 para asegurar que encontramos todas)
              for (let col = 1; col <= 50; col++) {
                // Construir clave igual que en useMemo: con guion después del prefijo
                const key = prefix ? `${prefix}-${floor}-${row}-${col}` : `${floor}-${row}-${col}`;
                const itemsInPosition = gridViz[key] || [];
                if (itemsInPosition.length > 0) {
                  colsWithContent.push(col);
                  // Debug específico para C3
                  if (col === 3) {
                    log(`✅ C3 encontrado en renderGridVisualization: Piso ${floor}, Fila ${row}, Key: "${key}", Items:`, itemsInPosition);
                  }
                }
              }
              
              // Si no encontramos C3 pero debería estar, buscar todas las claves que contengan el piso y fila
              if (!colsWithContent.includes(3)) {
                // Buscar todas las claves que contengan este piso y fila
                const keysForThisFloorRow = Object.keys(gridViz).filter(k => {
                  if (prefix) {
                    return k.startsWith(`${prefix}-${floor}-${row}-`);
                  } else {
                    return k.startsWith(`${floor}-${row}-`);
                  }
                });
                if (keysForThisFloorRow.length > 0) {
                  log(`🔍 Piso ${floor}, Fila ${row} - Claves encontradas:`, keysForThisFloorRow);
                  // Extraer columnas de estas claves
                  keysForThisFloorRow.forEach(k => {
                    const parts = k.split('-');
                    const colFromKey = parseInt(parts[parts.length - 1]);
                    if (!isNaN(colFromKey) && !colsWithContent.includes(colFromKey)) {
                      log(`   ⚠️ Columna ${colFromKey} encontrada en clave "${k}" pero no estaba en colsWithContent`);
                      colsWithContent.push(colFromKey);
                    }
                  });
                  // Ordenar columnas
                  colsWithContent.sort((a, b) => a - b);
                }
              }
              
              // Debug: mostrar columnas encontradas
              if (colsWithContent.length > 0) {
                log(`Piso ${floor}, Fila ${row}: Columnas encontradas:`, colsWithContent);
                if (colsWithContent.includes(3)) {
                  log(`✅ C3 SÍ está en la lista para Piso ${floor}, Fila ${row}`);
                } else {
                  log(`⚠️ C3 NO está en la lista de columnas encontradas para Piso ${floor}, Fila ${row}`);
                }
                rowsData.push({ row, cols: colsWithContent });
              }
            });
            
            return (
              <div key={floor} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={floor === 4 ? 'default' : floor === 3 ? 'secondary' : floor === 2 ? 'outline' : 'secondary'}>
                    Piso {floor}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {floor === 4 ? '(Arriba - Paquetes más grandes)' : 
                     floor === 3 ? '(Medio-Alto)' : 
                     floor === 2 ? '(Medio)' : 
                     '(Abajo - Paquetes más pequeños)'}
                  </span>
                </div>
                {rowsData.length > 0 ? (
                  <div className="space-y-2">
                    {rowsData.map(({ row, cols }) => (
                      <div key={row} className="flex gap-2">
                        <div className="flex items-center justify-center w-12 text-xs font-semibold text-muted-foreground">
                          F{row}
                        </div>
                        <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
                          {cols.map((col) => {
                            // Construir clave igual que en useMemo: con guion después del prefijo
                            const key = prefix ? `${prefix}-${floor}-${row}-${col}` : `${floor}-${row}-${col}`;
                            const itemsInPosition = gridViz[key] || [];
                            
                            return (
                              <div
                                key={col}
                                className="border-2 rounded p-2 min-h-[60px] text-xs bg-primary/20 border-primary"
                              >
                                <div className="font-semibold text-center mb-1">
                                  C{col}
                                </div>
                                <div className="space-y-1">
                                  {/* Cada celda solo muestra 1 paquete (itemsInPosition[0]) */}
                                  {itemsInPosition[0] && (() => {
                                    const item = itemsInPosition[0];
                                    return (
                                      <div className="text-[10px] leading-tight">
                                        <div className="font-medium truncate" title={item.productName}>
                                          {item.productName.substring(0, 15)}...
                                        </div>
                                        <div className="text-muted-foreground">
                                          1 pqt ({item.quantity} uds)
                                        </div>
                                        {item.length && (
                                          <div className="text-muted-foreground">
                                            {item.length}m
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground/50 text-sm py-4">
                    Sin contenido en este piso
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </>
    );
  };

  // Calcular número de columnas dinámicamente según el largo del camión
  const calculateColumns = (items: LoadItem[], truckData?: TruckData | null, section: 'chasis' | 'acoplado' | 'full' = 'full') => {
    if (!truckData || items.length === 0) return 3;
    
    let maxLength = truckData.length || 0;
    if (truckData.type === 'EQUIPO' && section !== 'full') {
      maxLength = section === 'chasis' 
        ? (truckData.chasisLength || 0)
        : (truckData.acopladoLength || 0);
    }
    
    if (maxLength === 0) return 3;
    
    // Encontrar la vigueta más pequeña para calcular columnas
    const minItemLength = Math.min(...items.map(item => item.length || maxLength).filter(l => l > 0));
    if (minItemLength === 0 || minItemLength > maxLength) return 3;
    
    // Calcular cuántas columnas caben en el largo
    const cols = Math.floor(maxLength / minItemLength);
    // Usar al menos 3 columnas, pero permitir más si el largo lo permite (máximo 20 para UI)
    return Math.max(3, Math.min(cols, 20));
  };

  // Calcular disposición óptima para visualización (usando useMemo para optimizar)
  const { layoutItems, gridVisualization, chasisLayout, acopladoLayout, chasisGridViz, acopladoGridViz, chasisCols, acopladoCols, fullCols, itemsNotPlaced } = useMemo(() => {
    const validItems = loadItems.filter(item => item.productId && item.quantity > 0);
    log('🔍 [useMemo] validItems:', validItems.length, validItems);
    log('🔍 [useMemo] selectedTruckData:', selectedTruckData);
    log('🔍 [useMemo] loadItems total:', loadItems.length, loadItems);
    

    
    // Si es EQUIPO, calcular dos distribuciones separadas SIN REPETIR viguetas
    // Y verificar que no se excedan los límites de peso
    if (selectedTruckData?.type === 'EQUIPO' && selectedTruckData.chasisLength && selectedTruckData.acopladoLength) {
      // Separar items entre chasis y acoplado sin repetir
      // Las viguetas más largas van al chasis si caben, las más cortas al acoplado
      const chasisLength = selectedTruckData.chasisLength;
      const acopladoLength = selectedTruckData.acopladoLength;
      
      // ✨ FIX: Mantener el orden original por position (definido por el usuario)
      const sortedItems = [...validItems].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      
      const chasisItems: LoadItem[] = [];
      const acopladoItems: LoadItem[] = [];
      const usedItemIds = new Set<string>();
      
      // ESTRATEGIA: Primero llenar COMPLETAMENTE el chasis, luego el acoplado
      // 1. Intentar llenar el chasis con items que solo caben en el chasis o que caben en ambos
      // 2. Calcular distribución del chasis
      // 3. Los items que no se pudieron colocar en el chasis van al acoplado
      // 4. También agregar items que solo caben en el acoplado
      
      // PASO 1: Separar items según dónde caben
      const itemsOnlyChasis: LoadItem[] = []; // Solo caben en chasis
      const itemsOnlyAcoplado: LoadItem[] = []; // Solo caben en acoplado
      const itemsBoth: LoadItem[] = []; // Caben en ambos
      
      for (const item of sortedItems) {
        const itemLength = item.length || 0;
        const fitsChasis = itemLength <= chasisLength;
        const fitsAcoplado = itemLength <= acopladoLength;
        
        if (fitsChasis && fitsAcoplado) {
          itemsBoth.push(item);
        } else if (fitsChasis) {
          itemsOnlyChasis.push(item);
        } else if (fitsAcoplado) {
          itemsOnlyAcoplado.push(item);
        }
      }
      
      log('📊 [EQUIPO] Items solo chasis:', itemsOnlyChasis.length);
      log('📊 [EQUIPO] Items solo acoplado:', itemsOnlyAcoplado.length);
      log('📊 [EQUIPO] Items ambos:', itemsBoth.length);
      
      // PASO 2: Intentar llenar el chasis primero con TODOS los items que caben
      // Agregar items que solo caben en chasis
      chasisItems.push(...itemsOnlyChasis);
      itemsOnlyChasis.forEach(item => usedItemIds.add(item.productId));
      
      // Agregar items que caben en ambos, priorizando el chasis
      chasisItems.push(...itemsBoth);
      itemsBoth.forEach(item => usedItemIds.add(item.productId));
      
      // ✨ FIX: Ordenar chasisItems por position antes de calcular layout
      chasisItems.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
      
      // PASO 3: Calcular distribución del chasis con TODOS los items que caben
      // Esto intentará colocar todos los paquetes posibles en el chasis
      const chasisLayoutCalc = calculateOptimalLayout(chasisItems, selectedTruckData, 'chasis');
      
      // Contar cuántos paquetes de cada producto se colocaron REALMENTE en el chasis
      const chasisPackagesByProduct: { [productId: string]: number } = {};
      const chasisQuantityByProduct: { [productId: string]: number } = {};
      chasisLayoutCalc.forEach(item => {
        if (item.gridPosition) {
          chasisPackagesByProduct[item.productId] = (chasisPackagesByProduct[item.productId] || 0) + 1;
          chasisQuantityByProduct[item.productId] = (chasisQuantityByProduct[item.productId] || 0) + item.quantity;
        }
      });
      
      log('📊 [EQUIPO] Paquetes colocados en chasis por producto:', chasisPackagesByProduct);
      log('📊 [EQUIPO] Cantidades colocadas en chasis por producto:', chasisQuantityByProduct);
      
      // PASO 4: Procesar TODOS los items originales y distribuir entre chasis y acoplado
      const MIN_LENGTH_FOR_PACKAGE = 5.80;
      const PACKAGE_SIZE_LARGE = 10;
      const PACKAGE_SIZE_SMALL = 20;
      
      // Agrupar TODOS los items originales por producto
      const allItemsByProduct: { [productId: string]: LoadItem[] } = {};
      sortedItems.forEach(item => {
        if (!allItemsByProduct[item.productId]) {
          allItemsByProduct[item.productId] = [];
        }
        allItemsByProduct[item.productId].push(item);
      });
      
      // Calcular items finales para chasis y acoplado
      const finalChasisItems: LoadItem[] = [];
      const finalAcopladoItems: LoadItem[] = [];
      const itemsNotPlaced: Array<{ productName: string; quantity: number; reason: string }> = [];
      
      // Procesar TODOS los productos originales
      Object.keys(allItemsByProduct).forEach(productId => {
        const items = allItemsByProduct[productId];
        // Sumar todas las cantidades de este producto (puede haber múltiples casilleros)
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
        const itemLength = items[0].length || 0;
        const usesLargePackage = itemLength >= MIN_LENGTH_FOR_PACKAGE;
        const packageSize = usesLargePackage ? PACKAGE_SIZE_LARGE : PACKAGE_SIZE_SMALL;
        
        // Determinar si el item cabe en chasis y/o acoplado
        const fitsChasis = itemLength <= chasisLength;
        const fitsAcoplado = itemLength <= acopladoLength;
        
        // Cantidad que realmente se colocó en el chasis
        const quantityInChasis = fitsChasis ? (chasisQuantityByProduct[productId] || 0) : 0;
        const quantityInAcoplado = totalQuantity - quantityInChasis;
        
        log(`📦 [EQUIPO] Producto ${items[0].productName}: ${totalQuantity} unidades totales, ${quantityInChasis} en chasis, ${quantityInAcoplado} restantes`);
        
        // Agregar al chasis si se colocó algo
        if (quantityInChasis > 0) {
          finalChasisItems.push({
            ...items[0],
            quantity: quantityInChasis,
          });
        }
        
        // Agregar al acoplado si hay cantidad restante Y cabe en el acoplado
        if (quantityInAcoplado > 0) {
          if (fitsAcoplado) {
            finalAcopladoItems.push({
              ...items[0],
              quantity: quantityInAcoplado,
            });
          } else {
            // No cabe en acoplado - registrar para mostrar al operario
            itemsNotPlaced.push({
              productName: items[0].productName,
              quantity: quantityInAcoplado,
              reason: `No cabe en acoplado (largo: ${itemLength}m > ${acopladoLength}m)`
            });
            console.warn(`⚠️ [EQUIPO] ${quantityInAcoplado} unidades de ${items[0].productName} NO CABEN en acoplado`);
          }
        }
        
        // Si el item solo cabe en acoplado (no cabe en chasis), agregar toda la cantidad al acoplado
        if (!fitsChasis && fitsAcoplado && totalQuantity > 0) {
          // Verificar que no esté ya agregado
          const alreadyInAcoplado = finalAcopladoItems.find(i => i.productId === productId);
          if (!alreadyInAcoplado) {
            finalAcopladoItems.push({
              ...items[0],
              quantity: totalQuantity,
            });
            log(`📦 [EQUIPO] Item solo acoplado agregado: ${items[0].productName} - ${totalQuantity} unidades`);
          }
        }
      });
      
      // Verificar que todas las cantidades se distribuyeron
      const totalOriginalQuantity = sortedItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalChasisQuantity = finalChasisItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalAcopladoQuantity = finalAcopladoItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalNotPlacedQuantity = itemsNotPlaced.reduce((sum, item) => sum + item.quantity, 0);
      const totalDistributed = totalChasisQuantity + totalAcopladoQuantity + totalNotPlacedQuantity;
      
      log(`📊 [EQUIPO] Verificación: ${totalOriginalQuantity} unidades originales`);
      log(`📊 [EQUIPO] - ${totalChasisQuantity} en chasis`);
      log(`📊 [EQUIPO] - ${totalAcopladoQuantity} en acoplado`);
      log(`📊 [EQUIPO] - ${totalNotPlacedQuantity} NO colocadas`);
      log(`📊 [EQUIPO] - ${totalDistributed} distribuidas/registradas`);
      
      // Permitir pequeñas diferencias por redondeo (hasta 5 unidades)
      const difference = Math.abs(totalOriginalQuantity - totalDistributed);
      if (difference > 5) {
        console.error(`❌ [EQUIPO] ERROR: Faltan ${totalOriginalQuantity - totalDistributed} unidades por distribuir (Original: ${totalOriginalQuantity}, Distribuido: ${totalDistributed})`);
      } else if (difference > 0) {
        log(`⚠️ [EQUIPO] Diferencia menor de ${difference} unidades (posible redondeo)`);
      }
      
      // Mostrar advertencia si hay items no colocados
      if (itemsNotPlaced.length > 0) {
        console.warn('⚠️ [EQUIPO] ITEMS NO COLOCADOS:', itemsNotPlaced);
      }
      
      // ✨ FIX: Ordenar finalChasisItems y finalAcopladoItems por position original antes de asignar
      finalChasisItems.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
      finalAcopladoItems.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
      
      // Actualizar listas finales
      chasisItems.length = 0;
      chasisItems.push(...finalChasisItems);
      
      acopladoItems.length = 0;
      acopladoItems.push(...finalAcopladoItems);
      
      log('📊 [EQUIPO] Distribución final - Chasis:', chasisItems.length, 'items, Acoplado:', acopladoItems.length, 'items');
      log('📊 [EQUIPO] Cantidades en chasis:', chasisItems.map(i => `${i.productName}: ${i.quantity}`));
      log('📊 [EQUIPO] Cantidades en acoplado:', acopladoItems.map(i => `${i.productName}: ${i.quantity}`));
      
      // Verificar pesos y ajustar distribución si es necesario
      const chasisMaxWeightKg = (selectedTruckData.chasisWeight || 0) * 1000; // Convertir a kilos
      const acopladoMaxWeightKg = (selectedTruckData.acopladoWeight || 0) * 1000; // Convertir a kilos
      
      // Calcular pesos actuales en kilos
      const currentChasisWeightKg = chasisItems.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0);
      const currentAcopladoWeightKg = acopladoItems.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0);
      
      log(`⚖️ [EQUIPO] Pesos actuales - Chasis: ${currentChasisWeightKg.toFixed(2)} kg (máx: ${chasisMaxWeightKg.toFixed(2)} kg), Acoplado: ${currentAcopladoWeightKg.toFixed(2)} kg (máx: ${acopladoMaxWeightKg.toFixed(2)} kg)`);
      
      // Si se exceden los límites, intentar redistribuir
      if ((chasisMaxWeightKg > 0 && currentChasisWeightKg > chasisMaxWeightKg) || 
          (acopladoMaxWeightKg > 0 && currentAcopladoWeightKg > acopladoMaxWeightKg)) {
        log('⚠️ [EQUIPO] Los pesos exceden los límites, intentando redistribuir...');
        
        // Función para redistribuir items entre chasis y acoplado
        const redistributeItems = (items: LoadItem[]): { chasis: LoadItem[], acoplado: LoadItem[] } => {
          const newChasis: LoadItem[] = [];
          const newAcoplado: LoadItem[] = [];
          
          // Separar items según dónde caben
          const itemsOnlyChasis: LoadItem[] = [];
          const itemsOnlyAcoplado: LoadItem[] = [];
          const itemsBoth: LoadItem[] = [];
          
          items.forEach(item => {
            const itemLength = item.length || 0;
            const fitsChasis = itemLength <= chasisLength;
            const fitsAcoplado = itemLength <= acopladoLength;
            
            if (fitsChasis && fitsAcoplado) {
              itemsBoth.push(item);
            } else if (fitsChasis) {
              itemsOnlyChasis.push(item);
            } else if (fitsAcoplado) {
              itemsOnlyAcoplado.push(item);
            }
          });
          
          // Agregar items que solo caben en chasis
          itemsOnlyChasis.forEach(item => {
            newChasis.push(item);
          });
          
          // Agregar items que solo caben en acoplado
          itemsOnlyAcoplado.forEach(item => {
            newAcoplado.push(item);
          });
          
          // Para items que caben en ambos, distribuirlos intentando balancear el peso
          // Ordenar por peso (más pesados primero) para mejor distribución
          const sortedBoth = [...itemsBoth].sort((a, b) => {
            const weightA = (a.weight || 0) * a.quantity;
            const weightB = (b.weight || 0) * b.quantity;
            return weightB - weightA; // Descendente
          });
          
          let tempChasisWeight = newChasis.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0);
          let tempAcopladoWeight = newAcoplado.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0);
          
          // Distribuir items que caben en ambos, priorizando el que tiene menos peso
          sortedBoth.forEach(item => {
            const itemWeight = (item.weight || 0) * item.quantity;
            
            // Intentar agregar al chasis primero si tiene espacio
            if (chasisMaxWeightKg === 0 || tempChasisWeight + itemWeight <= chasisMaxWeightKg) {
              newChasis.push(item);
              tempChasisWeight += itemWeight;
            } else if (acopladoMaxWeightKg === 0 || tempAcopladoWeight + itemWeight <= acopladoMaxWeightKg) {
              // Si no cabe en chasis, intentar acoplado
              newAcoplado.push(item);
              tempAcopladoWeight += itemWeight;
            } else {
              // Si no cabe en ninguno, intentar dividir la cantidad
              // Calcular cuánto cabe en cada uno
              const availableChasis = chasisMaxWeightKg > 0 ? Math.max(0, chasisMaxWeightKg - tempChasisWeight) : Infinity;
              const availableAcoplado = acopladoMaxWeightKg > 0 ? Math.max(0, acopladoMaxWeightKg - tempAcopladoWeight) : Infinity;
              
              const unitWeight = item.weight || 0;
              if (unitWeight > 0) {
                const qtyChasis = Math.floor(availableChasis / unitWeight);
                const qtyAcoplado = Math.floor(availableAcoplado / unitWeight);
                
                if (qtyChasis > 0) {
                  newChasis.push({ ...item, quantity: Math.min(qtyChasis, item.quantity) });
                  tempChasisWeight += unitWeight * Math.min(qtyChasis, item.quantity);
                }
                
                const remaining = item.quantity - Math.min(qtyChasis, item.quantity);
                if (remaining > 0 && qtyAcoplado > 0) {
                  newAcoplado.push({ ...item, quantity: Math.min(remaining, qtyAcoplado) });
                  tempAcopladoWeight += unitWeight * Math.min(remaining, qtyAcoplado);
                }
              }
            }
          });
          
          return { chasis: newChasis, acoplado: newAcoplado };
        };
        
        // Intentar redistribuir (usar los items originales agrupados por producto)
        const allItemsForRedistribution: LoadItem[] = [];
        Object.keys(allItemsByProduct).forEach(productId => {
          const items = allItemsByProduct[productId];
          const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
          allItemsForRedistribution.push({
            ...items[0],
            quantity: totalQuantity,
          });
        });
        const redistributed = redistributeItems(allItemsForRedistribution);
        
        // Verificar si la nueva distribución es válida
        const newChasisWeightKg = redistributed.chasis.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0);
        const newAcopladoWeightKg = redistributed.acoplado.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0);
        
        const chasisValid = chasisMaxWeightKg === 0 || newChasisWeightKg <= chasisMaxWeightKg;
        const acopladoValid = acopladoMaxWeightKg === 0 || newAcopladoWeightKg <= acopladoMaxWeightKg;
        
        if (chasisValid && acopladoValid) {
          log(`✅ [EQUIPO] Redistribución exitosa - Chasis: ${newChasisWeightKg.toFixed(2)} kg, Acoplado: ${newAcopladoWeightKg.toFixed(2)} kg`);
          chasisItems.length = 0;
          chasisItems.push(...redistributed.chasis);
          acopladoItems.length = 0;
          acopladoItems.push(...redistributed.acoplado);
        } else {
          log(`⚠️ [EQUIPO] No se pudo redistribuir completamente - Chasis: ${newChasisWeightKg.toFixed(2)}/${chasisMaxWeightKg.toFixed(2)} kg, Acoplado: ${newAcopladoWeightKg.toFixed(2)}/${acopladoMaxWeightKg.toFixed(2)} kg`);
        }
      }
      
      // Calcular layouts finales con los items correctos
      const finalChasisLayoutCalc = calculateOptimalLayout(chasisItems, selectedTruckData, 'chasis');
      const acopladoLayoutCalc = calculateOptimalLayout(acopladoItems, selectedTruckData, 'acoplado');
      
      // Agrupar por posición para cada sección
      // Cada item en layoutCalc ya es un paquete individual, así que cada celda tendrá máximo 1 item
      const chasisViz: { [key: string]: LoadItem[] } = {};
      finalChasisLayoutCalc.forEach(item => {
        if (item.gridPosition) {
          const key = `chasis-${item.gridPosition.floor}-${item.gridPosition.row}-${item.gridPosition.col}`;
          // Cada celda solo puede tener 1 paquete
          if (!chasisViz[key]) {
            chasisViz[key] = [item]; // Inicializar con el item (solo 1 paquete por celda)
          }
          // Debug: mostrar posiciones asignadas
          if (item.gridPosition.col === 3) {
            log(`🔵 Chasis - Item colocado en C3: Piso ${item.gridPosition.floor}, Fila ${item.gridPosition.row}, Col ${item.gridPosition.col}, Key: ${key}`, item);
          }
        }
      });
      // Debug: mostrar todas las claves de chasis que contienen C3 (columna 3)
      const chasisC3Keys = Object.keys(chasisViz).filter(k => k.match(/-\d+-\d+-3$/));
      log('🔵 Chasis - Todas las claves con C3:', chasisC3Keys);
      
      const acopladoViz: { [key: string]: LoadItem[] } = {};
      acopladoLayoutCalc.forEach(item => {
        if (item.gridPosition) {
          const key = `acoplado-${item.gridPosition.floor}-${item.gridPosition.row}-${item.gridPosition.col}`;
          // Cada celda solo puede tener 1 paquete
          if (!acopladoViz[key]) {
            acopladoViz[key] = [item]; // Inicializar con el item (solo 1 paquete por celda)
          }
          // Debug: mostrar posiciones asignadas
          if (item.gridPosition.col === 3) {
            log(`🟢 Acoplado - Item colocado en C3: Piso ${item.gridPosition.floor}, Fila ${item.gridPosition.row}, Col ${item.gridPosition.col}, Key: ${key}`, item);
          }
        }
      });
      // Debug: mostrar todas las claves de acoplado que contienen C3 (columna 3)
      const acopladoC3Keys = Object.keys(acopladoViz).filter(k => k.match(/-\d+-\d+-3$/));
      log('🟢 Acoplado - Todas las claves con C3:', acopladoC3Keys);
      
      const chasisColsCalc = calculateColumns(chasisItems, selectedTruckData, 'chasis');
      const acopladoColsCalc = calculateColumns(acopladoItems, selectedTruckData, 'acoplado');
      
      return {
        layoutItems: [],
        gridVisualization: {},
        chasisLayout: finalChasisLayoutCalc,
        acopladoLayout: acopladoLayoutCalc,
        chasisGridViz: chasisViz,
        acopladoGridViz: acopladoViz,
        chasisCols: chasisColsCalc,
        acopladoCols: acopladoColsCalc,
        fullCols: 3,
        itemsNotPlaced: itemsNotPlaced,
      };
    } else {
      // Distribución normal (CHASIS o SEMI)
      const calculatedLayout = calculateOptimalLayout(validItems, selectedTruckData, 'full');
      const fullColsCalc = calculateColumns(validItems, selectedTruckData, 'full');
      
      // Agrupar items por posición en la grilla para visualización
      // Cada item en calculatedLayout ya es un paquete individual, así que cada celda tendrá máximo 1 item
      const gridViz: { [key: string]: LoadItem[] } = {};
      calculatedLayout.forEach(item => {
        if (item.gridPosition) {
          const key = `${item.gridPosition.floor}-${item.gridPosition.row}-${item.gridPosition.col}`;
          // Cada celda solo puede tener 1 paquete
          if (!gridViz[key]) {
            gridViz[key] = [item]; // Inicializar con el item (solo 1 paquete por celda)
          }
          // Debug: mostrar posiciones asignadas
          if (item.gridPosition.col === 3) {
            log(`🟡 Full - Item colocado en C3: Piso ${item.gridPosition.floor}, Fila ${item.gridPosition.row}, Col ${item.gridPosition.col}, Key: ${key}`, item);
          }
        }
      });
      // Debug: mostrar todas las claves que contienen C3 (columna 3)
      const fullC3Keys = Object.keys(gridViz).filter(k => k.match(/-\d+-\d+-3$/));
      log('🟡 Full - Todas las claves con C3:', fullC3Keys);
      log('🟡 Full - Total de items en calculatedLayout:', calculatedLayout.length);
      log('🟡 Full - Items con gridPosition:', calculatedLayout.filter(item => item.gridPosition).length);
      log('🟡 Full - Total de claves en gridViz:', Object.keys(gridViz).length);
      
      return {
        layoutItems: calculatedLayout,
        gridVisualization: gridViz,
        chasisLayout: [],
        acopladoLayout: [],
        chasisGridViz: {},
        acopladoGridViz: {},
        chasisCols: 3,
        acopladoCols: 3,
        fullCols: fullColsCalc,
        itemsNotPlaced: [],
      };
    }
  }, [loadItems, selectedTruckData]);

  // Calcular pesos individuales para EQUIPO (después del useMemo)
  // Los pesos de los items están en kilos, convertimos a toneladas para comparar con límites
  const chasisWeightKg = selectedTruckData?.type === 'EQUIPO' && chasisLayout
    ? chasisLayout.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0)
    : 0;
  const chasisWeight = chasisWeightKg / 1000; // Convertir a toneladas
  
  const acopladoWeightKg = selectedTruckData?.type === 'EQUIPO' && acopladoLayout
    ? acopladoLayout.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0)
    : 0;
  const acopladoWeight = acopladoWeightKg / 1000; // Convertir a toneladas

  // Calcular distribución para el detalle
  const detailDistribution = useMemo(() => {
    if (!detailLoad) {
      return {
        chasisLayout: [],
        acopladoLayout: [],
        chasisGridViz: {},
        acopladoGridViz: {},
        chasisCols: 3,
        acopladoCols: 3,
        layoutItems: [],
        gridVisualization: {},
        fullCols: 3,
      };
    }

    const detailValidItems = detailLoad.items.filter(item => item.productId && item.quantity > 0);
    const detailTruckData: TruckData = detailLoad.truck;
    
    if (detailTruckData.type === 'EQUIPO' && detailTruckData.chasisLength && detailTruckData.acopladoLength) {
      const chasisLength = detailTruckData.chasisLength;
      const acopladoLength = detailTruckData.acopladoLength;
      // ✨ FIX: Mantener el orden original por position (definido por el usuario)
      const sortedItems = [...detailValidItems].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      
      const itemsOnlyChasis: LoadItem[] = [];
      const itemsOnlyAcoplado: LoadItem[] = [];
      const itemsBoth: LoadItem[] = [];
      
      for (const item of sortedItems) {
        const itemLength = item.length || 0;
        const fitsChasis = itemLength <= chasisLength;
        const fitsAcoplado = itemLength <= acopladoLength;
        
        if (fitsChasis && fitsAcoplado) {
          itemsBoth.push(item);
        } else if (fitsChasis) {
          itemsOnlyChasis.push(item);
        } else if (fitsAcoplado) {
          itemsOnlyAcoplado.push(item);
        }
      }
      
      const chasisItems: LoadItem[] = [];
      chasisItems.push(...itemsOnlyChasis);
      chasisItems.push(...itemsBoth);
      
      // ✨ FIX: Ordenar chasisItems por position antes de calcular layout
      chasisItems.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
      
      const chasisLayoutCalc = calculateOptimalLayout(chasisItems, detailTruckData, 'chasis');
      
      const chasisQuantityByProduct: { [productId: string]: number } = {};
      chasisLayoutCalc.forEach(item => {
        if (item.gridPosition) {
          chasisQuantityByProduct[item.productId] = (chasisQuantityByProduct[item.productId] || 0) + item.quantity;
        }
      });
      
      const allItemsByProduct: { [productId: string]: LoadItem[] } = {};
      sortedItems.forEach(item => {
        if (!allItemsByProduct[item.productId]) {
          allItemsByProduct[item.productId] = [];
        }
        allItemsByProduct[item.productId].push(item);
      });
      
      const finalChasisItems: LoadItem[] = [];
      const finalAcopladoItems: LoadItem[] = [];
      
      // Procesar TODOS los productos originales (igual que useMemo principal)
      Object.keys(allItemsByProduct).forEach(productId => {
        const items = allItemsByProduct[productId];
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
        const itemLength = items[0].length || 0;
        
        const fitsChasis = itemLength <= chasisLength;
        const fitsAcoplado = itemLength <= acopladoLength;
        
        const quantityInChasis = fitsChasis ? (chasisQuantityByProduct[productId] || 0) : 0;
        const quantityInAcoplado = totalQuantity - quantityInChasis;
        
        // Agregar al chasis si se colocó algo
        if (quantityInChasis > 0) {
          finalChasisItems.push({
            ...items[0],
            quantity: quantityInChasis,
          });
        }
        
        // Agregar al acoplado si hay cantidad restante Y cabe en el acoplado
        if (quantityInAcoplado > 0 && fitsAcoplado) {
          finalAcopladoItems.push({
            ...items[0],
            quantity: quantityInAcoplado,
          });
        }
        
        // Si el item solo cabe en acoplado (no cabe en chasis), agregar toda la cantidad al acoplado
        if (!fitsChasis && fitsAcoplado && totalQuantity > 0) {
          const alreadyInAcoplado = finalAcopladoItems.find(i => i.productId === productId);
          if (!alreadyInAcoplado) {
            finalAcopladoItems.push({
              ...items[0],
              quantity: totalQuantity,
            });
          }
        }
      });
      
      // ✨ FIX: Ordenar por position original antes de calcular layout para mantener el orden del usuario
      finalChasisItems.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
      finalAcopladoItems.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
      
      const finalChasisLayout = calculateOptimalLayout(finalChasisItems, detailTruckData, 'chasis');
      const acopladoLayoutCalc = calculateOptimalLayout(finalAcopladoItems, detailTruckData, 'acoplado');
      
      const chasisViz: { [key: string]: LoadItem[] } = {};
      finalChasisLayout.forEach(item => {
        if (item.gridPosition) {
          const key = `chasis-${item.gridPosition.floor}-${item.gridPosition.row}-${item.gridPosition.col}`;
          if (!chasisViz[key]) {
            chasisViz[key] = [item];
          }
        }
      });
      
      const acopladoViz: { [key: string]: LoadItem[] } = {};
      acopladoLayoutCalc.forEach(item => {
        if (item.gridPosition) {
          const key = `acoplado-${item.gridPosition.floor}-${item.gridPosition.row}-${item.gridPosition.col}`;
          if (!acopladoViz[key]) {
            acopladoViz[key] = [item];
          }
        }
      });
      
      const chasisColsCalc = calculateColumns(finalChasisItems, detailTruckData, 'chasis');
      const acopladoColsCalc = calculateColumns(finalAcopladoItems, detailTruckData, 'acoplado');
      
      return {
        chasisLayout: finalChasisLayout,
        acopladoLayout: acopladoLayoutCalc,
        chasisGridViz: chasisViz,
        acopladoGridViz: acopladoViz,
        chasisCols: chasisColsCalc,
        acopladoCols: acopladoColsCalc,
        layoutItems: [],
        gridVisualization: {},
        fullCols: 3,
      };
    } else {
      const fullLayout = calculateOptimalLayout(detailValidItems, detailTruckData, 'full');
      const fullViz: { [key: string]: LoadItem[] } = {};
      fullLayout.forEach(item => {
        if (item.gridPosition) {
          const key = `${item.gridPosition.floor}-${item.gridPosition.row}-${item.gridPosition.col}`;
          if (!fullViz[key]) {
            fullViz[key] = [item];
          }
        }
      });
      const fullColsCalc = calculateColumns(detailValidItems, detailTruckData, 'full');
      return {
        layoutItems: fullLayout,
        gridVisualization: fullViz,
        fullCols: fullColsCalc,
        chasisLayout: [],
        acopladoLayout: [],
        chasisGridViz: {},
        acopladoGridViz: {},
        chasisCols: 3,
        acopladoCols: 3,
      };
    }
  }, [detailLoad]);

  // Función para generar HTML de la grilla de distribución (compacta)
  const generateGridHTML = (
    gridViz: { [key: string]: LoadItem[] },
    layoutItems: LoadItem[],
    sectionPrefix: string = '',
    numCols: number = 3,
    sectionName: string = ''
  ): string => {
    const prefix = sectionPrefix || '';
    let html = '';
    
    // Grilla por pisos
    html += '<div style="display: flex; flex-direction: column; gap: 2px;">';
    [1, 2, 3, 4].forEach((floor) => {
      const rowsData: Array<{ row: number; cols: number[] }> = [];
      
      [1, 2, 3].forEach((row) => {
        const colsWithContent: number[] = [];
        for (let col = 1; col <= 50; col++) {
          const key = prefix ? `${prefix}-${floor}-${row}-${col}` : `${floor}-${row}-${col}`;
          const itemsInPosition = gridViz[key] || [];
          if (itemsInPosition.length > 0) {
            colsWithContent.push(col);
          }
        }
        
        if (colsWithContent.length > 0) {
          colsWithContent.sort((a, b) => a - b);
          rowsData.push({ row, cols: colsWithContent });
        }
      });
      
      if (rowsData.length > 0) {
        html += `<div class="grid-floor" style="margin-bottom: 2px; ${floor < 4 ? 'border-top: 1px solid #9ca3af; padding-top: 2px; margin-top: 2px;' : ''}">`;
        html += `<div class="grid-floor-title">Piso ${floor} - ${floor === 4 ? '(Arriba)' : floor === 3 ? '(Medio-Alto)' : floor === 2 ? '(Medio)' : '(Abajo)'}</div>`;
        
        rowsData.forEach(({ row, cols }) => {
          html += `<div class="grid-row">`;
          html += `<div class="row-label">F${row}</div>`;
          html += `<div style="flex: 1; display: grid; gap: 2px; grid-template-columns: repeat(${cols.length}, minmax(0, 1fr));">`;
          
          cols.forEach((col, colIndex) => {
            const key = prefix ? `${prefix}-${floor}-${row}-${col}` : `${floor}-${row}-${col}`;
            const itemsInPosition = gridViz[key] || [];
            const item = itemsInPosition[0];
            
            html += `<div class="grid-cell">`;
            html += `<div class="grid-cell-label">C${col}</div>`;
            
            if (item) {
              html += `<div class="grid-cell-content">`;
              html += `<div style="font-weight: 500; text-align: center; margin-bottom: 1px; font-size: 7px;">${item.length ? `${item.length}m` : 'Sin largo'}</div>`;
              html += `<div style="text-align: center; color: #6b7280;">1 pqt (${item.quantity} uds)</div>`;
              html += `</div>`;
            }
            
            html += `</div>`;
          });
          
          html += `</div></div>`;
        });
        
        html += `</div>`;
      }
    });
    html += '</div>';
    
    return html;
  };

  // Función para imprimir directamente desde el detalle usando detailDistribution
  const handleDirectPrintFromDetail = () => {
    if (!detailLoad) return;
    
    // Cerrar el modal de detalle y abrir el modal de impresión
    const loadToPrint = detailLoad;
    setDetailLoad(null);
    setTimeout(() => {
      setPrintingLoad(loadToPrint);
    }, 100);
    return;
    
    // Código anterior (comentado para mantener como referencia)
    const load = detailLoad;
    const dist = detailDistribution;
    
    // Crear un iframe oculto para imprimir sin abrir nueva ventana
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    // Calcular totales
    const totalLength = load.items.reduce(
      (sum, item) => sum + (item.length || 0) * item.quantity,
      0
    );
    const totalWeight = load.items.reduce(
      (sum, item) => sum + (item.weight || 0) * item.quantity,
      0
    );

    // Agrupar materiales por producto
    const materialsByProduct = load.items.reduce((acc, item) => {
      if (!item.productId) return acc;
      const key = item.productId;
      if (!acc[key]) {
        acc[key] = {
          name: item.productName,
          length: item.length ?? null,
          totalQuantity: 0,
          totalPackages: 0,
        };
      }
      acc[key].totalQuantity += item.quantity;
      const MIN_LENGTH_FOR_PACKAGE = 5.80;
      const PACKAGE_SIZE_LARGE = 10;
      const PACKAGE_SIZE_SMALL = 20;
      const usesLargePackage = (item.length || 0) >= MIN_LENGTH_FOR_PACKAGE;
      const packageSize = usesLargePackage ? PACKAGE_SIZE_LARGE : PACKAGE_SIZE_SMALL;
      acc[key].totalPackages += Math.ceil(item.quantity / packageSize);
      return acc;
    }, {} as { [key: string]: { name: string; length: number | null; totalQuantity: number; totalPackages: number } });

    // Generar HTML del contenido de impresión
    const printContent = `
      <div class="print-header">
        <h1>ORDEN DE CARGA</h1>
        ${currentCompany ? `<p>${currentCompany.name}</p>` : ''}
      </div>

      <div class="print-info">
        <div class="print-info-item">
          <strong>Camión:</strong> ${load.truck.name} (${load.truck.type === 'CHASIS' ? 'Chasis' : load.truck.type === 'EQUIPO' ? 'Equipo' : 'Semi'})
          ${load.truck.type === 'EQUIPO' && load.truck.chasisLength && load.truck.acopladoLength 
            ? ` ${load.truck.chasisLength}m + ${load.truck.acopladoLength}m` 
            : ''}
        </div>
        <div class="print-info-item">
          <strong>Fecha:</strong> ${new Date(load.date).toLocaleDateString('es-AR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </div>
        <div class="print-info-item">
          <strong>Capacidad:</strong> ${load.truck.length}m${load.truck.maxWeight ? ` • ${load.truck.maxWeight}Tn` : ''}
        </div>
        <div class="print-info-item">
          <strong>Total:</strong> ${totalLength.toFixed(2)}m${totalWeight > 0 ? ` • ${totalWeight.toFixed(2)}Tn` : ''}
        </div>
      </div>

      ${load.truck.isOwn && (load.deliveryClient || load.deliveryAddress || load.isCorralon) ? `
        <div class="divider"></div>
        <div style="margin-bottom: 3px; padding: 2px; background: #e3f2fd; border-radius: 2px; border: 1px solid #2196f3; font-size: 6px;">
          <strong>Entrega:</strong> ${load.isCorralon 
            ? '📍 Corralón' 
            : `${load.deliveryClient ? load.deliveryClient : ''}${load.deliveryAddress ? ` - ${load.deliveryAddress}` : ''}`}
        </div>
      ` : ''}

      <div class="divider"></div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 3px; margin-bottom: 3px;">
        <div class="materials-list">
          <h3>Materiales</h3>
          <ul>
            ${Object.values(materialsByProduct).map((material) => `
              <li><strong>${material.length ? `${material.length}m` : 'Sin largo'}</strong>: ${material.totalPackages} pqt (${material.totalQuantity} uds)</li>
            `).join('')}
          </ul>
        </div>

        <div class="print-summary">
          <h3>Resumen</h3>
          <table>
            <tbody>
              <tr>
                <td>Total viguetas:</td>
                <td>${load.items.reduce((sum, item) => sum + item.quantity, 0)} uds</td>
              </tr>
              <tr>
                <td>Total metros:</td>
                <td>${totalLength.toFixed(2)} m</td>
              </tr>
              ${totalWeight > 0 ? `
                <tr>
                  <td>Total peso:</td>
                  <td>${totalWeight.toFixed(2)} Tn</td>
                </tr>
              ` : ''}
              <tr>
                <td>Utilización:</td>
                <td>
                  ${((totalLength / load.truck.length) * 100).toFixed(1)}%
                  ${load.truck.maxWeight ? ` • ${((totalWeight / (load.truck.maxWeight || 1)) * 100).toFixed(1)}% peso` : ''}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="divider"></div>

      ${(() => {
        // Usar detailDistribution que ya está calculado
        if (!dist || (load.truck.type === 'EQUIPO' && Object.keys(dist.chasisGridViz || {}).length === 0 && Object.keys(dist.acopladoGridViz || {}).length === 0) || (load.truck.type !== 'EQUIPO' && Object.keys(dist.gridVisualization || {}).length === 0)) {
          return '<div style="padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; margin: 10px 0;"><p style="margin: 0; font-size: 9px;">⚠️ La distribución de carga no está disponible.</p></div>';
        }
        
        if (load.truck.type === 'EQUIPO' && load.truck.chasisLength && load.truck.acopladoLength) {
          return `
            <div class="grid-section">
              <div class="grid-section-title">Orden de Carga - EQUIPO</div>
              
              <div style="margin-bottom: 3px; padding: 3px; border: 1px solid #000; border-radius: 2px; background: #fff;">
                <div style="font-weight: bold; margin-bottom: 2px; font-size: 8px;">
                  Chasis (${load.truck.chasisLength}m) - ${Object.keys(dist.chasisGridViz || {}).length} posiciones
                </div>
                ${generateGridHTML(dist.chasisGridViz || {}, dist.chasisLayout || [], 'chasis', dist.chasisCols || 3, 'Chasis')}
              </div>
              
              <div style="padding: 3px; border: 1px solid #000; border-radius: 2px; background: #fff;">
                <div style="font-weight: bold; margin-bottom: 2px; font-size: 8px;">
                  Acoplado (${load.truck.acopladoLength}m) - ${Object.keys(dist.acopladoGridViz || {}).length} posiciones
                </div>
                ${generateGridHTML(dist.acopladoGridViz || {}, dist.acopladoLayout || [], 'acoplado', dist.acopladoCols || 3, 'Acoplado')}
              </div>
            </div>
          `;
        } else {
          return `
            <div class="grid-section">
              <div class="grid-section-title">Orden de Carga</div>
              <div style="padding: 3px; border: 1px solid #000; border-radius: 2px; background: #fff;">
                <div style="font-weight: bold; margin-bottom: 2px; font-size: 8px;">
                  ${Object.keys(dist.gridVisualization || {}).length} posiciones
                </div>
                ${generateGridHTML(dist.gridVisualization || {}, dist.layoutItems || [], '', dist.fullCols || 3, '')}
              </div>
            </div>
          `;
        }
      })()}
    `;

    const style = `
      <style>
        @page {
          size: A4 portrait;
          margin: 0.3cm;
        }
        * {
          box-sizing: border-box;
        }
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 3px;
          font-size: 7px;
          line-height: 1.2;
        }
        .print-header {
          text-align: center;
          margin-bottom: 2px;
          border-bottom: 1px solid #000;
          padding-bottom: 2px;
        }
        .print-header h1 {
          margin: 0;
          font-size: 10px;
          font-weight: bold;
          line-height: 1.1;
        }
        .print-header p {
          margin: 1px 0 0 0;
          font-size: 7px;
          line-height: 1.1;
        }
        .divider {
          border-top: 1px solid #ccc;
          margin: 3px 0;
        }
        .print-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px;
          margin-bottom: 3px;
        }
        .print-info-item {
          padding: 2px;
          background: #f5f5f5;
          border-radius: 2px;
          font-size: 6px;
          line-height: 1.2;
        }
        .print-info-item strong {
          display: inline;
          font-size: 6px;
        }
        .materials-list {
          margin: 2px 0;
          padding: 2px;
          background: #fff3cd;
          border-radius: 2px;
          border: 1px solid #ffc107;
        }
        .materials-list h3 {
          margin: 0 0 1px 0;
          font-size: 7px;
          font-weight: bold;
        }
        .materials-list ul {
          margin: 0;
          padding-left: 10px;
          font-size: 6px;
          line-height: 1.2;
        }
        .materials-list li {
          margin: 0.5px 0;
        }
        .print-summary {
          margin-top: 2px;
          padding: 2px;
          background: #f0f0f0;
          border-radius: 2px;
        }
        .print-summary h3 {
          margin: 0 0 1px 0;
          font-size: 7px;
          font-weight: bold;
        }
        .print-summary table {
          width: 100%;
          border-collapse: collapse;
          font-size: 6px;
        }
        .print-summary td {
          padding: 0.5px 2px;
          border-bottom: 1px solid #ddd;
        }
        .print-summary td:first-child {
          font-weight: bold;
        }
        /* Estilos para la grilla de distribución */
        .grid-section {
          margin: 4px 0;
          border: 1px solid #000;
          border-radius: 3px;
          padding: 4px;
          background: #fafafa;
        }
        .grid-section-title {
          text-align: center;
          font-weight: bold;
          font-size: 9px;
          margin-bottom: 3px;
          padding: 2px;
          background: #e0e0e0;
          border-radius: 2px;
        }
        .grid-section p {
          margin: 2px 0;
          font-size: 6px;
          color: #666;
        }
        .grid-floor {
          margin-bottom: 3px;
        }
        .grid-floor-title {
          font-weight: bold;
          margin-bottom: 2px;
          padding: 2px;
          background: #f0f0f0;
          border-radius: 2px;
          font-size: 7px;
        }
        .grid-row {
          display: flex;
          gap: 2px;
          margin-bottom: 2px;
        }
        .grid-cell {
          border: 1px solid #3b82f6;
          border-radius: 2px;
          padding: 2px;
          min-height: 25px;
          background: rgba(59, 130, 246, 0.2);
          font-size: 6px;
        }
        .grid-cell-label {
          font-weight: bold;
          text-align: center;
          margin-bottom: 1px;
          font-size: 6px;
        }
        .grid-cell-content {
          font-size: 5px;
          line-height: 1.1;
        }
        .grid-cell-content div {
          margin: 0;
          padding: 0;
        }
        .row-label {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          font-size: 6px;
          font-weight: bold;
          color: #6b7280;
        }
        @media print {
          @page {
            margin: 0.3cm;
          }
          body {
            margin: 0;
            padding: 3px;
          }
        }
      </style>
    `;

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      toast({
        title: 'Error',
        description: 'No se pudo crear el documento de impresión.',
        variant: 'destructive',
      });
      return;
    }

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Orden de Carga - ${load.truck.name}</title>
          ${style}
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    iframeDoc.close();

    // Esperar a que el contenido se cargue y luego imprimir
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // Remover el iframe después de imprimir
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 500);
    }, 250);
  };

  return (
    <div className="space-y-4">
      {/* Dialog para crear/editar carga */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogTrigger asChild>
          <span className="hidden" />
        </DialogTrigger>
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle>
                {editingLoad ? 'Editar Carga' : 'Nueva Carga'}
              </DialogTitle>
              <DialogDescription>
                {editingLoad
                  ? 'Modifique los datos de la carga'
                  : 'Seleccione un camión y agregue las viguetas'}
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="truck">Camión *</Label>
                    <Select
                      value={selectedTruck?.toString() || ''}
                      onValueChange={(value) =>
                        setSelectedTruck(parseInt(value))
                      }
                      disabled={!!editingLoad}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un camión" />
                      </SelectTrigger>
                      <SelectContent>
                        {trucks.map((truck) => (
                          <SelectItem key={truck.id} value={truck.id.toString()}>
                            {truck.name} ({truck.length}m - {truck.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date">Fecha *</Label>
                    <DatePicker
                      value={formData.date}
                      onChange={(date) =>
                        setFormData({ ...formData, date: date })
                      }
                      placeholder="Seleccionar fecha"
                    />
                  </div>
                </div>

                {selectedTruckData && (
                  <>
                    <div className="p-3 bg-muted rounded-lg space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Largo del camión:</span>
                        <span className="font-medium">{selectedTruckData.length} m</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Largo utilizado:</span>
                        <span className="font-medium">
                          {selectedTruckData.type === 'EQUIPO' 
                            ? `${selectedTruckData.chasisLength || 0}m (Chasis) + ${selectedTruckData.acopladoLength || 0}m (Acoplado)`
                            : `${totalLengthUsed.toFixed(2)} m`}
                        </span>
                      </div>
                      {selectedTruckData.type === 'EQUIPO' ? (
                        <>
                          {selectedTruckData.chasisWeight && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Peso Chasis (máx):</span>
                              <span className="font-medium">{selectedTruckData.chasisWeight} Tn</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Peso Chasis (cargado):</span>
                            <span className={`font-medium ${selectedTruckData.chasisWeight && chasisWeight > (selectedTruckData.chasisWeight || 0) ? 'text-destructive' : ''}`}>
                              {chasisWeight.toFixed(2)} Tn
                            </span>
                          </div>
                          {selectedTruckData.acopladoWeight && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Peso Acoplado (máx):</span>
                              <span className="font-medium">{selectedTruckData.acopladoWeight} Tn</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Peso Acoplado (cargado):</span>
                            <span className={`font-medium ${selectedTruckData.acopladoWeight && acopladoWeight > (selectedTruckData.acopladoWeight || 0) ? 'text-destructive' : ''}`}>
                              {acopladoWeight.toFixed(2)} Tn
                            </span>
                          </div>
                          <div className="flex justify-between text-sm pt-1 border-t">
                            <span className="text-muted-foreground">Peso Total:</span>
                            <span className={`font-medium ${totalWeight > (selectedTruckData.maxWeight || 0) ? 'text-destructive' : ''}`}>
                              {totalWeight.toFixed(2)} Tn
                            </span>
                          </div>
                        </>
                      ) : selectedTruckData.maxWeight ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Peso máximo:</span>
                            <span className="font-medium">{selectedTruckData.maxWeight} Tn</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Peso cargado:</span>
                            <span className={`font-medium ${totalWeight > (selectedTruckData.maxWeight || 0) ? 'text-destructive' : ''}`}>
                              {totalWeight.toFixed(2)} Tn
                            </span>
                          </div>
                        </>
                      ) : null}
                      {/* Validar capacidad basándose en la grilla, no en suma de longitudes */}
                      {(() => {
                        const validItems = loadItems.filter(item => item.productId && item.quantity > 0);
                        if (validItems.length === 0) return null;
                        
                        // Calcular total de paquetes necesarios
                        const MIN_LENGTH = 5.80;
                        const PACKAGE_SIZE_LARGE = 10;
                        const PACKAGE_SIZE_SMALL = 20;
                        const TOTAL_POSITIONS = 27; // 3x3x3
                        
                        let totalPackages = 0;
                        if (selectedTruckData.type === 'EQUIPO') {
                          // Para EQUIPO, calcular paquetes para chasis y acoplado por separado
                          const chasisItems = validItems.filter(item => {
                            const itemLength = item.length || 0;
                            return itemLength <= (selectedTruckData.chasisLength || 0);
                          });
                          const acopladoItems = validItems.filter(item => {
                            const itemLength = item.length || 0;
                            return itemLength <= (selectedTruckData.acopladoLength || 0);
                          });
                          
                          const chasisPackages = chasisItems.reduce((sum, item) => {
                            const itemLength = item.length || 0;
                            const usesLarge = itemLength >= MIN_LENGTH;
                            return sum + (usesLarge 
                              ? Math.ceil(item.quantity / PACKAGE_SIZE_LARGE)
                              : Math.ceil(item.quantity / PACKAGE_SIZE_SMALL));
                          }, 0);
                          
                          const acopladoPackages = acopladoItems.reduce((sum, item) => {
                            const itemLength = item.length || 0;
                            const usesLarge = itemLength >= MIN_LENGTH;
                            return sum + (usesLarge 
                              ? Math.ceil(item.quantity / PACKAGE_SIZE_LARGE)
                              : Math.ceil(item.quantity / PACKAGE_SIZE_SMALL));
                          }, 0);
                          
                          totalPackages = Math.max(chasisPackages, acopladoPackages);
                        } else {
                          totalPackages = validItems.reduce((sum, item) => {
                            const itemLength = item.length || 0;
                            const usesLarge = itemLength >= MIN_LENGTH;
                            return sum + (usesLarge 
                              ? Math.ceil(item.quantity / PACKAGE_SIZE_LARGE)
                              : Math.ceil(item.quantity / PACKAGE_SIZE_SMALL));
                          }, 0);
                        }
                        
                        const exceedsCapacity = totalPackages > TOTAL_POSITIONS || 
                          (selectedTruckData.maxWeight && totalWeight > selectedTruckData.maxWeight);
                        
                        return exceedsCapacity ? (
                          <p className="text-xs text-destructive mt-1">
                            ⚠️ La carga excede la capacidad disponible ({totalPackages} paquetes / {TOTAL_POSITIONS} posiciones)
                          </p>
                        ) : null;
                      })()}
                    </div>

                    {/* Campos de entrega solo si el camión es propio */}
                    {selectedTruckData.isOwn && (
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                        <h3 className="font-semibold text-foreground">Datos de Entrega</h3>
                        
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="isCorralon"
                              checked={formData.isCorralon}
                              onChange={(e) =>
                                setFormData({ ...formData, isCorralon: e.target.checked, deliveryAddress: e.target.checked ? 'Corralón' : formData.deliveryAddress })
                              }
                              className="h-4 w-4"
                            />
                            <Label htmlFor="isCorralon" className="cursor-pointer">
                              Entrega en Corralón
                            </Label>
                          </div>
                        </div>

                        {!formData.isCorralon && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="deliveryClient">Cliente de Entrega *</Label>
                              {clients.length > 0 ? (
                                <Select
                                  value={formData.deliveryClient}
                                  onValueChange={(value) => {
                                    const selectedClient = clients.find(c => c.name === value);
                                    setFormData({ 
                                      ...formData, 
                                      deliveryClient: value,
                                      deliveryAddress: selectedClient?.address || formData.deliveryAddress
                                    });
                                  }}
                                  required={!formData.isCorralon}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleccione un cliente" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {clients.map((client) => (
                                      <SelectItem key={client.id} value={client.name}>
                                        {client.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  id="deliveryClient"
                                  value={formData.deliveryClient}
                                  onChange={(e) =>
                                    setFormData({ ...formData, deliveryClient: e.target.value })
                                  }
                                  placeholder="Nombre del cliente"
                                  required={!formData.isCorralon}
                                />
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="deliveryAddress">Dirección de Entrega *</Label>
                              <Textarea
                                id="deliveryAddress"
                                value={formData.deliveryAddress}
                                onChange={(e) =>
                                  setFormData({ ...formData, deliveryAddress: e.target.value })
                                }
                                placeholder="Dirección completa de entrega"
                                rows={2}
                                required={!formData.isCorralon}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-2">
                  <Label>Viguetas en la carga</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Ingrese el código de la vigueta en cada fila. Se agregará automáticamente al presionar Enter.
                  </p>

                  <ScrollArea className="h-[400px] border rounded-lg">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/50 sticky top-0 z-10">
                          <tr>
                            <th className="text-left p-2 text-xs font-semibold border-b">#</th>
                            <th className="text-left p-2 text-xs font-semibold border-b">Código</th>
                            <th className="text-left p-2 text-xs font-semibold border-b">Vigueta</th>
                            <th className="text-left p-2 text-xs font-semibold border-b">Largo (m)</th>
                            <th className="text-left p-2 text-xs font-semibold border-b">Cantidad</th>
                            <th className="text-left p-2 text-xs font-semibold border-b">Peso x Unidad (kg)</th>
                            <th className="text-left p-2 text-xs font-semibold border-b">Total (m)</th>
                            <th className="text-left p-2 text-xs font-semibold border-b">Total (kg)</th>
                            <th className="text-left p-2 text-xs font-semibold border-b w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {loadItems.map((item, index) => (
                            <tr 
                              key={index} 
                              data-casillero-index={index}
                              className={`border-b hover:bg-muted/30 ${!item.productId ? 'bg-muted/20' : ''}`}
                            >
                              <td className="p-2 text-xs text-muted-foreground">{index + 1}</td>
                              <td className="p-2">
                                <Input
                                  placeholder="Código"
                                  value={item.productId 
                                    ? (products.find(p => p.id === item.productId)?.code || '')
                                    : (item.tempCode || '')
                                  }
                                  onChange={(e) => {
                                    const code = e.target.value;
                                    const newItems = [...loadItems];
                                    if (!item.productId) {
                                      newItems[index] = {
                                        ...newItems[index],
                                        tempCode: code,
                                      };
                                      setLoadItems(newItems);
                                    }
                                  }}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const code = (e.target as HTMLInputElement).value;
                                      if (code.trim()) {
                                        handleCodeInput(index, code);
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const code = e.target.value;
                                    if (code.trim() && !item.productId) {
                                      handleCodeInput(index, code);
                                    }
                                  }}
                                  className="h-8 w-24 text-xs"
                                  autoFocus={index === loadItems.length - 1 && !item.productId}
                                  disabled={!!item.productId}
                                />
                              </td>
                              <td className="p-2">
                                {item.productId ? (
                                  <span className="text-xs font-medium">{item.productName}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="p-2">
                                {item.length ? (
                                  <span className="text-xs">{item.length}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="p-2">
                                <Input
                                  ref={(el) => {
                                    quantityInputRefs.current[index] = el;
                                  }}
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const quantity = parseInt(e.target.value) || 1;
                                    handleQuantityChange(index, quantity);
                                  }}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const currentQuantity = parseInt((e.target as HTMLInputElement).value) || 1;
                                      handleQuantityChange(index, currentQuantity);
                                      
                                      const emptyItem: LoadItem = {
                                        productId: '',
                                        productName: '',
                                        quantity: 1,
                                        length: null,
                                        weight: null,
                                        position: loadItems.length,
                                        notes: null,
                                        tempCode: '',
                                      };
                                      setLoadItems([...loadItems, emptyItem]);
                                      
                                      setTimeout(() => {
                                        const codeInputs = document.querySelectorAll('input[placeholder*="Código"]:not([disabled])');
                                        if (codeInputs[codeInputs.length - 1]) {
                                          (codeInputs[codeInputs.length - 1] as HTMLInputElement).focus();
                                        }
                                      }, 50);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const quantity = parseInt(e.target.value) || 1;
                                    handleQuantityChange(index, quantity);
                                  }}
                                  className="h-8 w-20 text-xs"
                                  placeholder="1"
                                  disabled={!item.productId}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.weight || ''}
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      'weight',
                                      e.target.value
                                        ? parseFloat(e.target.value)
                                        : null
                                    )
                                  }
                                  className="h-8 w-20 text-xs"
                                  placeholder="Auto"
                                  readOnly={!!item.weight}
                                  disabled={!item.productId}
                                />
                              </td>
                              <td className="p-2">
                                {item.productId ? (
                                  <span className="text-xs">{(item.length || 0) * item.quantity}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="p-2">
                                {item.productId && item.weight ? (
                                  <span className="text-xs">{(item.weight * item.quantity).toFixed(2)}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="p-2">
                                {item.productId && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveItem(index)}
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ScrollArea>
                </div>

                {/* Visualización de la grilla 3x3x3 */}
                {loadItems.filter(item => item.productId && item.quantity > 0).length > 0 && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    {selectedTruckData?.type === 'EQUIPO' ? (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <Label className="text-base font-semibold">Orden de Carga - EQUIPO</Label>
                        </div>
                        <p className="text-xs text-muted-foreground mb-4">
                          Viguetas {'>='} 5.80m se empaquetan en grupos de 10. Las más largas van abajo si no hay nada abajo. 
                          Si hay algo en piso 2, debe haber algo en piso 1.
                        </p>
                        
                        {/* Grilla Chasis */}
                        <div className="space-y-4 mb-6 p-4 border rounded-lg bg-background">
                          <div className="flex items-center justify-between">
                            <Label className="text-base font-semibold">Chasis ({selectedTruckData.chasisLength}m)</Label>
                            <Badge variant="secondary">
                              {Object.keys(chasisGridViz).length} / {3 * 3 * chasisCols} posiciones
                            </Badge>
                          </div>
                          {renderGridVisualization(chasisGridViz, chasisLayout, 'chasis', chasisCols)}
                        </div>
                        
                        {/* Grilla Acoplado */}
                        <div className="space-y-4 p-4 border rounded-lg bg-background">
                          <div className="flex items-center justify-between">
                            <Label className="text-base font-semibold">Acoplado ({selectedTruckData.acopladoLength}m)</Label>
                            <Badge variant="secondary">
                              {Object.keys(acopladoGridViz).length} / {3 * 3 * acopladoCols} posiciones
                            </Badge>
                          </div>
                          {renderGridVisualization(acopladoGridViz, acopladoLayout, 'acoplado', acopladoCols)}
                        </div>
                        
                        {/* Advertencia de items no colocados */}
                        {itemsNotPlaced && itemsNotPlaced.length > 0 && (
                          <div className="mt-4 p-4 border-2 border-destructive rounded-lg bg-destructive/10">
                            <div className="flex items-start gap-2">
                              <div className="text-destructive font-bold text-lg">⚠️</div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-destructive mb-2">ATENCIÓN OPERARIO: Items No Colocados</h4>
                                <p className="text-sm text-muted-foreground mb-2">
                                  Los siguientes items NO pudieron ser colocados en ninguna sección del camión:
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-sm">
                                  {itemsNotPlaced.map((item, idx) => (
                                    <li key={idx} className="text-foreground">
                                      <strong>{item.productName}</strong>: {item.quantity} unidades - {item.reason}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">Orden de Carga</Label>
                          <Badge variant="secondary">
                            {Object.keys(gridVisualization).length} / {3 * 3 * fullCols} posiciones
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Viguetas {'>='} 5.80m se empaquetan en grupos de 10. Las más largas van abajo si no hay nada abajo. 
                          Si hay algo en piso 2, debe haber algo en piso 1.
                        </p>
                        {renderGridVisualization(gridVisualization, layoutItems, '', fullCols)}
                      </>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Notas adicionales sobre la carga"
                    rows={3}
                  />
                </div>
              </div>
            </form>
            </DialogBody>
            <DialogFooter className="flex justify-between">
              <div>
                {selectedTruck && loadItems.length > 0 && (
                  <AIOptimizeButton
                    items={loadItems}
                    truckId={selectedTruck}
                    truckName={trucks.find(t => t.id === selectedTruck)?.name || 'Camión'}
                    disabled={!selectedTruck || loadItems.length === 0}
                    onOptimizationComplete={(result) => {
                      // Aplicar las posiciones de la IA a los items
                      const updatedItems = loadItems.map((item, index) => {
                        const placement = result.placements.find(p => p.itemIndex === index);
                        if (placement) {
                          return {
                            ...item,
                            gridPosition: {
                              floor: placement.floor,
                              row: placement.row,
                              col: placement.col,
                            },
                          };
                        }
                        return item;
                      });
                      setLoadItems(updatedItems);
                      toast({ title: 'Optimización aplicada', description: `Balance: ${result.stats.balanceScore}%, Utilización: ${result.stats.utilizationPercent}%` });
                    }}
                  />
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="default" onClick={handleSubmit}>
                  {editingLoad ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Dashboard de métricas */}
      {!loading && loads.length > 0 && showMetrics && (
        <LoadsMetrics loads={loads as any[]} className="mb-4" />
      )}

      {/* Controles de búsqueda, filtros y vista */}
      {!loading && loads.length > 0 && (
        <TooltipProvider>
          <LoadsToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filterTruckType={filterTruckType}
            onFilterTruckTypeChange={setFilterTruckType as any}
            filterClient={filterClient}
            onFilterClientChange={setFilterClient}
            uniqueClients={Array.from(new Set(loads.filter(l => l.deliveryClient).map(l => l.deliveryClient!))).sort()}
            dateRange={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined}
            onDateRangeChange={(range) => setDateRange(range ? { from: range.from, to: range.to } : {})}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            selectionMode={selectionMode}
            onSelectionModeChange={(mode) => {
              setSelectionMode(mode);
              if (!mode) setSelectedLoadIds([]);
            }}
            selectedCount={selectedLoadIds.length}
            onExport={handleExportAll}
            onCreateNew={() => {
              resetForm();
              setIsDialogOpen(true);
            }}
            onCreateWithAI={() => setIsAICreatorOpen(true)}
            onRefresh={refreshLoads}
            canManageLoads={canManageLoads}
            isLoading={loading}
            totalCount={loads.length}
          />
        </TooltipProvider>
      )}

      {/* Barra de acciones masivas */}
      {!loading && loads.length > 0 && selectionMode && (
        <BulkActionsBar
          selectedCount={selectedLoadIds.length}
          totalCount={loads.length}
          onSelectAll={selectAllLoads}
          onClearSelection={clearSelection}
          onBulkPrint={handleBulkPrint}
          onBulkExport={handleBulkExport}
          onBulkDuplicate={handleBulkDuplicate}
          onBulkDelete={handleBulkDelete}
          isAllSelected={selectedLoadIds.length === loads.length}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Cargando cargas...</p>
        </div>
      ) : loads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-12 w-12 text-purple-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay cargas registradas</h3>
            <p className="text-muted-foreground text-center mb-6">
              Creá tu primera carga usando la inteligencia artificial
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setIsDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear Manual
              </Button>
              <Button
                onClick={() => setIsAICreatorOpen(true)}
                className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <Sparkles className="h-4 w-4" />
                Crear con IA
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (() => {
        // Filtrar y buscar cargas
        const filteredLoads = loads.filter((load) => {
          // Filtro por tipo de camión
          if (filterTruckType !== 'ALL' && load.truck.type !== filterTruckType) {
            return false;
          }

          // Filtro por cliente
          if (filterClient !== 'ALL' && load.deliveryClient !== filterClient) {
            return false;
          }

          // Filtro por rango de fechas
          if (dateRange.from || dateRange.to) {
            const loadDate = new Date(load.date);
            if (dateRange.from && loadDate < dateRange.from) {
              return false;
            }
            if (dateRange.to && loadDate > dateRange.to) {
              return false;
            }
          }

          // Búsqueda por ID, ID interno, nombre de camión o cliente
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesId = load.id.toString().includes(query);
            const matchesInternalId = load.internalId?.toString().includes(query);
            const matchesTruck = load.truck.name.toLowerCase().includes(query);
            const matchesClient = load.deliveryClient?.toLowerCase().includes(query);
            if (!matchesId && !matchesInternalId && !matchesTruck && !matchesClient) {
              return false;
            }
          }

          return true;
        });

        if (filteredLoads.length === 0) {
          return (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No se encontraron cargas con los filtros aplicados.
                </p>
              </CardContent>
            </Card>
          );
        }

        return viewMode === 'card' ? (
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-1">
              {filteredLoads.map((load) => {
              const loadTotalLength = load.items.reduce(
                (sum, item) => sum + (item.length || 0) * item.quantity,
                0
              );
              const totalItems = load.items.reduce((sum, item) => sum + item.quantity, 0);
              const totalPackages = load.items.length;
              
              const isSelected = selectedLoadIds.includes(load.id);

              return (
                <Card
                  key={load.id}
                  className={`group cursor-pointer hover:shadow-lg transition-all relative ${
                    selectionMode && isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
                  }`}
                  onClick={() => {
                    if (selectionMode) {
                      toggleLoadSelection(load.id);
                    } else {
                      setDetailLoad(load);
                    }
                  }}
                >
                  {/* Checkbox para selección */}
                  {selectionMode && (
                    <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleLoadSelection(load.id)}
                      />
                    </div>
                  )}

                  {/* Botones de acción que aparecen en hover */}
                  <div className={`absolute top-2 right-2 flex gap-1 transition-opacity z-10 ${selectionMode ? 'hidden' : 'opacity-0 group-hover:opacity-100'}`}>
                    {canManageLoads && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 bg-background/90 backdrop-blur-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicate(load.id);
                          }}
                          title="Duplicar"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 bg-background/90 backdrop-blur-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(load);
                          }}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 bg-background/90 backdrop-blur-sm text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(load.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                  
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                    <CardTitle className="text-sm font-semibold leading-tight">
                      {load.truck.name}
                    </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">ID: {load.id}</p>
                        {load.internalId && (
                          <p className="text-xs text-muted-foreground mt-0.5">ID Interno: {load.internalId}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={`${
                          load.truck.type === 'CHASIS' ? 'bg-blue-500' :
                          load.truck.type === 'EQUIPO' ? 'bg-green-500' :
                          'bg-orange-500'
                        } text-white text-xs`}>
                          {load.truck.type === 'CHASIS' ? 'Chasis' :
                           load.truck.type === 'EQUIPO' ? 'Equipo' : 'Semi'}
                        </Badge>
                        {load.status && (
                          <LoadStatusBadge
                            status={load.status}
                            loadId={load.id}
                            canEdit={canManageLoads}
                            size="sm"
                            onStatusChange={async (newStatus) => {
                              try {
                                const res = await fetch(`/api/loads/${load.id}/status`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ status: newStatus }),
                                });
                                if (!res.ok) throw new Error('Error al cambiar estado');
                                refetchBootstrap();
                              } catch {
                                toast({ title: 'Error', description: 'No se pudo cambiar el estado', variant: 'destructive' });
                              }
                            }}
                          />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(load.date).toLocaleDateString('es-AR')}
                    </p>
                  </CardHeader>
                  
                  <CardContent className="pt-0 space-y-2">
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Capacidad:</span>
                        <span className="font-medium">{load.truck.length} m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total cargado:</span>
                        <span className="font-semibold text-primary">{loadTotalLength.toFixed(2)} m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Viguetas:</span>
                        <span className="font-medium">{totalItems} uds ({totalPackages} tipos)</span>
                      </div>
                    </div>
                    
                    {load.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-2 pt-2 border-t">
                        {load.description}
                      </p>
                    )}
                    
                    {load.deliveryClient && (
                      <div className="text-xs text-muted-foreground pt-2 border-t">
                        <div className="font-medium">Cliente: {load.deliveryClient}</div>
                        {load.deliveryAddress && (
                          <div className="text-xs mt-0.5">{load.deliveryAddress}</div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
        ) : (
          <div className="border-2 border-border rounded-lg overflow-hidden bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b-2 border-border">
                  <tr>
                    {selectionMode && (
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground w-10">
                        <Checkbox
                          checked={selectedLoadIds.length === filteredLoads.length && filteredLoads.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedLoadIds(filteredLoads.map(l => l.id));
                            } else {
                              setSelectedLoadIds([]);
                            }
                          }}
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Estado</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Fecha</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Camión</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Tipo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Capacidad</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Cargado</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Viguetas</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Cliente</th>
                    {canManageLoads && (
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredLoads.map((load) => {
                    const loadTotalLength = load.items.reduce(
                      (sum, item) => sum + (item.length || 0) * item.quantity,
                      0
                    );
                    const totalItems = load.items.reduce((sum, item) => sum + item.quantity, 0);
                    const isSelected = selectedLoadIds.includes(load.id);

                    return (
                      <tr
                        key={load.id}
                        className={`border-b border-border hover:bg-muted/50 cursor-pointer transition-colors ${
                          selectionMode && isSelected ? 'bg-primary/5' : 'bg-background'
                        }`}
                        onClick={() => {
                          if (selectionMode) {
                            toggleLoadSelection(load.id);
                          } else {
                            setDetailLoad(load);
                          }
                        }}
                      >
                        {selectionMode && (
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleLoadSelection(load.id)}
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm font-medium">{load.id}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {load.status ? (
                            <LoadStatusBadge
                              status={load.status}
                              loadId={load.id}
                              canEdit={canManageLoads}
                              size="sm"
                              onStatusChange={async (newStatus) => {
                                try {
                                  const res = await fetch(`/api/loads/${load.id}/status`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    credentials: 'include',
                                    body: JSON.stringify({ status: newStatus }),
                                  });
                                  if (!res.ok) throw new Error('Error al cambiar estado');
                                  refetchBootstrap();
                                } catch {
                                  toast({ title: 'Error', description: 'No se pudo cambiar el estado', variant: 'destructive' });
                                }
                              }}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{new Date(load.date).toLocaleDateString('es-AR')}</td>
                        <td className="px-4 py-3 text-sm font-medium">{load.truck.name}</td>
                        <td className="px-4 py-3 text-sm">
                          <Badge className={`${
                            load.truck.type === 'CHASIS' ? 'bg-blue-500' :
                            load.truck.type === 'EQUIPO' ? 'bg-green-500' :
                            'bg-orange-500'
                          } text-white`}>
                            {load.truck.type === 'CHASIS' ? 'Chasis' :
                             load.truck.type === 'EQUIPO' ? 'Equipo' : 'Semi'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm">{load.truck.length} m</td>
                        <td className="px-4 py-3 text-sm font-semibold text-primary">{loadTotalLength.toFixed(2)} m</td>
                        <td className="px-4 py-3 text-sm">{totalItems} uds</td>
                        <td className="px-4 py-3 text-sm">{load.deliveryClient || '-'}</td>
                        {canManageLoads && !selectionMode && (
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDuplicate(load.id)}
                                title="Duplicar"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(load)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(load.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        )}
                        {canManageLoads && selectionMode && (
                          <td className="px-4 py-3 text-sm">-</td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {printingLoad && (
        <LoadPrintView
          load={printingLoad}
          onClose={() => {
            setPrintingLoad(null);
            setPrintingDistribution(null);
          }}
          preCalculatedDistribution={printingDistribution}
        />
      )}

      {/* Dialog de detalle */}
      {detailLoad && (
          <Dialog open={!!detailLoad} onOpenChange={(open) => !open && setDetailLoad(null)}>
            <DialogContent size="full" className="flex flex-col p-0">
              <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
                <DialogTitle className="text-lg sm:text-xl">
                  Detalle de Carga - {detailLoad.truck.name}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  {new Date(detailLoad.date).toLocaleDateString('es-AR')}
                </DialogDescription>
              </DialogHeader>

              <DialogBody className="px-2 sm:px-4 md:px-6">
                {/* Reutilizar el contenido del modal de impresión sin overlay */}
                <LoadPrintView
                  ref={printViewRef}
                  load={detailLoad}
                  onClose={() => {}}
                  hideOverlay={true}
                  hideButtons={true}
                  preCalculatedDistribution={detailDistribution}
                />
              </DialogBody>

              <DialogFooter className="flex gap-3 flex-wrap sm:flex-nowrap">
              {canManageLoads && (
                <>
              <Button
                variant="outline"
                size="default"
                onClick={() => {
                  setDetailLoad(null);
                  handleEdit(detailLoad);
                }}
                className="flex-1 sm:flex-initial"
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
              <Button
                variant="outline"
                size="default"
                onClick={() => {
                  setDetailLoad(null);
                  handleDelete(detailLoad.id);
                }}
                className="text-destructive hover:text-destructive flex-1 sm:flex-initial"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
                </>
              )}
              <Button
                size="default"
                onClick={() => {
                  if (printViewRef.current) {
                    printViewRef.current.handlePrint();
                  }
                }}
                type="button"
                className="flex-1 sm:flex-initial"
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
              <Button variant="outline" size="default" onClick={() => setDetailLoad(null)} className="flex-1 sm:flex-initial">
                Cerrar
              </Button>
              </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* AI Load Creator */}
      <AILoadCreator
        open={isAICreatorOpen}
        onOpenChange={setIsAICreatorOpen}
        trucks={trucks as any[]}
        products={products}
        onSave={async (data) => {
          try {
            const response = await fetch('/api/loads', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                truckId: data.truckId,
                date: data.date,
                description: data.description,
                deliveryClient: data.deliveryClient,
                deliveryAddress: data.deliveryAddress,
                items: data.items.map((item, idx) => ({
                  productId: item.productId,
                  productName: item.productName,
                  quantity: item.quantity,
                  length: item.length,
                  weight: item.weight,
                  position: idx,
                })),
              }),
            });

            if (!response.ok) {
              throw new Error('Error al guardar');
            }

            refetchBootstrap();
          } catch (error) {
            throw error;
          }
        }}
      />
    </div>
  );
}

