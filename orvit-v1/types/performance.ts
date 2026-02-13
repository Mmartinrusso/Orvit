/**
 * TIPOS COMPARTIDOS PARA ENDPOINTS OPTIMIZADOS
 * 
 * Centraliza todos los tipos de datos de los nuevos endpoints
 * para evitar duplicación y facilitar mantenimiento
 */

// ============================================================================
// MANTENIMIENTO - Dashboard
// ============================================================================

export interface MaintenanceSummary {
  id: number;
  title: string;
  description?: string | null;
  type: string;
  priority: string;
  status: string;
  scheduledDate?: Date | string | null;
  completedDate?: Date | string | null;
  actualHours?: number | null;
  machineId?: number | null;
  unidadMovilId?: number | null;
  machine?: {
    id: number;
    name: string;
    nickname?: string | null;
    type?: string | null;
  } | null;
  unidadMovil?: {
    id: number;
    nombre: string;
    tipo?: string | null;
    patente?: string | null;
  } | null;
}

export interface MachineSummary {
  id: number;
  name: string;
  nickname?: string | null;
  type?: string | null;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  status?: string | null;
  sectorId?: number | null;
  companyId: number;
}

export interface MobileUnitSummary {
  id: number;
  nombre: string;
  tipo?: string | null;
  marca?: string | null;
  modelo?: string | null;
  patente?: string | null;
  kilometraje?: number | null;
  estado?: string | null;
  sectorId?: number | null;
  companyId: number;
}

export interface MaintenanceKPIs {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  completionRate: number;
  onTimeRate: number;
  avgCompletionTime: number;
  period: {
    start: string;
    end: string;
  };
}

export interface MaintenanceDashboardData {
  pending: MaintenanceSummary[];
  completedToday: MaintenanceSummary[];
  machines: MachineSummary[];
  mobileUnits: MobileUnitSummary[];
  kpis: MaintenanceKPIs;
  metadata: {
    companyId: number;
    sectorId?: number | null;
    timestamp: string;
    pageSize: number;
  };
}

// ============================================================================
// ADMINISTRACIÓN - Catálogos
// ============================================================================

export interface ProductSummary {
  id: number;
  name: string;
  description?: string | null;
  sku: string;
  categoryId: number;
  subcategoryId?: number | null;
  companyId: number;
  unitPrice?: number | null;
  unitCost?: number | null;
  stockQuantity?: number | null;
  minStockLevel?: number | null;
  isActive: boolean;
  categoryName?: string | null;
  subcategoryName?: string | null;
}

export interface CategorySummary {
  id: number;
  name: string;
  description?: string | null;
  companyId: number;
  createdAt?: string;
}

export interface SubcategorySummary {
  id: number;
  name: string;
  description?: string | null;
  categoryId: number;
  companyId: number;
  categoryName?: string | null;
}

export interface SupplySummary {
  id: number;
  name: string;
  description?: string | null;
  unit: string;
  unitPrice?: number | null;
  supplierId?: number | null;
  companyId: number;
  stockQuantity?: number | null;
  minStockLevel?: number | null;
  isActive: boolean;
  supplierName?: string | null;
}

export interface EmployeeSummary {
  id: number;
  name: string;
  categoryId?: number | null;
  monthlySalary?: number | null;
  workHoursPerMonth?: number | null;
  isActive: boolean;
}

export interface EmployeeCategorySummary {
  id: number;
  name: string;
  description?: string | null;
}

export interface ClientSummary {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  companyId: number;
  taxId?: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface SupplierSummary {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  companyId: number;
  taxId?: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface AdminCatalogsData {
  products: ProductSummary[];
  categories: CategorySummary[];
  subcategories: SubcategorySummary[];
  supplies: SupplySummary[];
  employees: EmployeeSummary[];
  employeeCategories: EmployeeCategorySummary[];
  clients: ClientSummary[];
  suppliers: SupplierSummary[];
  metadata: {
    companyId: number;
    timestamp: string;
    counts: {
      products: number;
      categories: number;
      subcategories: number;
      supplies: number;
      employees: number;
      employeeCategories: number;
      clients: number;
      suppliers: number;
    };
  };
}

// ============================================================================
// AGENDA - Bootstrap
// ============================================================================

export interface TaskSummary {
  id: number;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: Date | string | null;
  completedAt?: Date | string | null;
  createdAt: Date | string;
  assignedToId?: number | null;
  createdById?: number | null;
}

export interface ContactSummary {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  position?: string | null;
  notes?: string | null;
  isActive: boolean;
}

export interface ReminderSummary {
  id: number;
  title: string;
  description?: string | null;
  reminderDate: Date | string;
  isActive: boolean;
  createdAt: Date | string;
}

export interface AgendaBootstrapData {
  tasks: TaskSummary[];
  contacts: ContactSummary[];
  reminders: ReminderSummary[];
  metadata: {
    userId: number;
    companyId: number;
    timestamp: string;
    counts: {
      tasks: number;
      contacts: number;
      reminders: number;
    };
  };
}

// ============================================================================
// HOOKS RETURN TYPES
// ============================================================================

export interface UseOptimizedDataReturn<T> {
  data: T | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

/**
 * Tipo para componentes que deben ser memo-izados
 */
export interface MemoizableComponentProps {
  // Marcar props que deben ser estables
  [key: string]: any;
}

/**
 * Configuración de cache para hooks optimizados
 */
export interface CacheConfig {
  ttl?: number; // Time to live en milisegundos
  key?: string; // Cache key personalizado
  staleWhileRevalidate?: boolean; // Devolver cache mientras recarga
}

