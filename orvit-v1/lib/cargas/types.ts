/**
 * Tipos compartidos para el módulo de cargas
 */

export interface TruckData {
  id: number;
  internalId?: number | null;
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
  description?: string | null;
  isActive?: boolean;
}

export interface GridPosition {
  floor: number; // Piso (1-4, donde 1 es abajo)
  row: number; // Fila (1-3)
  col: number; // Columna (1-N, dinámico según largo)
}

export interface LoadItem {
  id?: number;
  productId: string;
  productName: string;
  quantity: number;
  length?: number | null;
  weight?: number | null;
  position: number;
  notes?: string | null;
  tempCode?: string;
  gridPosition?: GridPosition;
}

export interface PackagedItem {
  item: LoadItem;
  packages: number;
  gridPositions: GridPosition[];
  usesPackages: boolean; // true = paquetes de 10 (>=5.80m), false = paquetes de 20 (<5.80m)
}

export interface Load {
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
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  length?: number;
  weight?: number;
}

export interface ClientData {
  id: string;
  name: string;
  address?: string;
}

export interface DistributionResult {
  layoutItems: LoadItem[];
  gridVisualization: { [key: string]: LoadItem[] };
  chasisLayout: LoadItem[];
  acopladoLayout: LoadItem[];
  chasisGridViz: { [key: string]: LoadItem[] };
  acopladoGridViz: { [key: string]: LoadItem[] };
  chasisCols: number;
  acopladoCols: number;
  fullCols: number;
  itemsNotPlaced: Array<{ productName: string; quantity: number; reason: string }>;
  stats: DistributionStats;
}

export interface DistributionStats {
  totalItems: number;
  totalPackages: number;
  placedPackages: number;
  notPlacedPackages: number;
  totalWeight: number;
  chasisWeight: number;
  acopladoWeight: number;
  utilizationPercent: number;
}

export interface LoadFormData {
  date: string;
  description: string;
  deliveryClient: string;
  deliveryAddress: string;
  isCorralon: boolean;
}

// Constantes de distribución
export const DISTRIBUTION_CONSTANTS = {
  MIN_LENGTH_FOR_LARGE_PACKAGE: 5.80, // metros
  PACKAGE_SIZE_LARGE: 10, // unidades por paquete para viguetas >= 5.80m
  PACKAGE_SIZE_SMALL: 20, // unidades por paquete para viguetas < 5.80m
  FLOORS: 4, // pisos disponibles
  ROWS: 3, // filas por piso
  MAX_COLS: 50, // máximo de columnas dinámicas
} as const;

// Tipos para templates
export interface LoadTemplate {
  id: number;
  name: string;
  companyId: number;
  truckId?: number | null;
  items: LoadItem[];
  createdAt: string;
  updatedAt: string;
}

// Tipos para auditoría
export interface LoadAuditEntry {
  id: number;
  loadId: number;
  userId: number;
  userName?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'DUPLICATE' | 'PRINT';
  changes: Record<string, { old: any; new: any }>;
  createdAt: string;
}

// Tipos para métricas
export interface LoadMetrics {
  totalLoads: number;
  loadsToday: number;
  loadsThisWeek: number;
  loadsThisMonth: number;
  avgItemsPerLoad: number;
  mostUsedTruck: { id: number; name: string; count: number } | null;
  mostFrequentClient: { name: string; count: number } | null;
  totalWeightThisMonth: number;
}

// ============================================
// Tipos para Estados de Carga (Workflow)
// ============================================

export type LoadStatus = 'DRAFT' | 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export const LOAD_STATUS_CONFIG: Record<LoadStatus, {
  label: string;
  color: string;
  bgColor: string;
  description: string;
  allowedTransitions: LoadStatus[];
}> = {
  DRAFT: {
    label: 'Borrador',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    description: 'Carga en preparación',
    allowedTransitions: ['PENDING', 'CANCELLED'],
  },
  PENDING: {
    label: 'Pendiente',
    color: 'text-warning-muted-foreground',
    bgColor: 'bg-warning-muted',
    description: 'Lista para cargar',
    allowedTransitions: ['IN_TRANSIT', 'DRAFT', 'CANCELLED'],
  },
  IN_TRANSIT: {
    label: 'En Tránsito',
    color: 'text-info-muted-foreground',
    bgColor: 'bg-info-muted',
    description: 'Camión en ruta',
    allowedTransitions: ['DELIVERED', 'CANCELLED'],
  },
  DELIVERED: {
    label: 'Entregado',
    color: 'text-success-muted-foreground',
    bgColor: 'bg-success-muted',
    description: 'Entrega completada',
    allowedTransitions: [],
  },
  CANCELLED: {
    label: 'Cancelado',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    description: 'Carga cancelada',
    allowedTransitions: ['DRAFT'],
  },
};

// ============================================
// Tipos para Optimización con IA
// ============================================

export interface AIPlacement {
  itemIndex: number;
  productName: string;
  floor: number;
  row: number;
  col: number;
  packages: number;
}

export interface AIOptimizationStats {
  weightPerFloor: number[];
  centerOfGravity: { x: number; y: number; z: number };
  balanceScore: number; // 0-100, donde 100 es perfecto balance
  utilizationPercent: number;
  totalWeight: number;
}

export interface AIOptimizationResult {
  placements: AIPlacement[];
  stats: AIOptimizationStats;
  reasoning?: string;
  warnings?: string[];
}

export interface OptimizeLoadRequest {
  items: LoadItem[];
  truckId: number;
  preferences?: {
    prioritize?: 'weight_balance' | 'space_utilization' | 'delivery_order';
  };
}

export interface OptimizeLoadResponse {
  success: boolean;
  data: AIOptimizationResult;
  truck: {
    id: number;
    name: string;
    type: string;
  };
  error?: string;
}
