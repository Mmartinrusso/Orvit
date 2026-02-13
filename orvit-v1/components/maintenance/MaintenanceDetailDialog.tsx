'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Calendar,
  Clock,
  User,
  Wrench,
  Building,
  FileText,
  Package,
  Download,
  Edit,
  Settings,
  History,
  MessageSquare,
  MapPin,
  Cog,
  BarChart3,
  CalendarDays,
  Timer,
  Target,
  Info,
  AlertTriangle,
  RotateCcw,
  Eye,
  Search,
  Plus,
  ChevronRight,
  File,
  Image as ImageIcon,
  FileCode,
  CheckCircle,
  Play,
  Pause,
  X,
  Copy,
  Share2,
  QrCode,
  Bell,
  BellOff,
  Camera,
  Send,
  MoreVertical,
  ExternalLink,
  Link2,
  Printer,
  ZoomIn,
  ChevronLeft,
  Loader2,
  RefreshCw,
  Trash2,
  Star,
  StarOff
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useGlobalCache, createCacheKey } from '@/hooks/use-global-cache';
import { toast } from '@/hooks/use-toast';

interface MaintenanceDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  maintenance: any;
  onEdit?: (maintenance: any) => void;
  onExecute?: (maintenance: any) => void;
  onComplete?: (maintenance: any) => void;
  onReschedule?: (maintenance: any, newDate: Date) => void;
  onCancel?: (maintenance: any, reason: string) => void;
  onDuplicate?: (maintenance: any) => void;
  companyId: number;
  canEdit?: boolean;
}

// Interfaz para comentarios
interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: Date;
  attachments?: Array<{ name: string; url: string; type: string }>;
  mentions?: string[];
}

// Interfaz para fotos/evidencias
interface Evidence {
  id: string;
  url: string;
  thumbnail?: string;
  caption?: string;
  type: 'before' | 'after' | 'during';
  uploadedAt: Date;
  uploadedBy: string;
}

// Interfaz para audit log
interface AuditEntry {
  id: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  userId: string;
  userName: string;
  timestamp: Date;
}

// ============================================
// COMPONENTES REUTILIZABLES
// ============================================

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="bg-muted rounded-full p-3 mb-4">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground mb-4 max-w-sm">{description}</p>
      )}
      {action && (
        <Button variant="outline" size="default" onClick={action.onClick} className="text-xs">
          {action.icon && <span className="mr-1.5">{action.icon}</span>}
          {action.label}
        </Button>
      )}
    </div>
  );
}

interface StatCardProps {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'blue' | 'green' | 'purple' | 'orange';
}

function StatCard({ value, label, icon, variant = 'default' }: StatCardProps) {
  // Paleta sobria - solo usamos primary para destacar el primer item
  const isHighlighted = variant === 'blue'; // El primero se destaca sutilmente

  return (
    <div className={`rounded-lg p-4 text-center ${isHighlighted ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50 border'}`}>
      {icon && <div className="flex justify-center mb-2">{icon}</div>}
      <div className={`text-2xl font-bold ${isHighlighted ? 'text-primary' : 'text-foreground'}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
}

function InfoItem({ icon, label, value }: InfoItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground mt-0.5">
          {value || <span className="text-muted-foreground">N/A</span>}
        </p>
      </div>
    </div>
  );
}

interface ListItemRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string | React.ReactNode;
  onClick?: () => void;
}

function ListItemRow({ icon, title, subtitle, badge, onClick }: ListItemRowProps) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <div className="text-muted-foreground flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {badge && (
        <div className="flex-shrink-0">
          {typeof badge === 'string' ? (
            <Badge variant="secondary" className="text-xs">{badge}</Badge>
          ) : (
            badge
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// FUNCIONES UTILITARIAS
// ============================================

const formatDateTime = (date: string | Date) => {
  if (!date) return 'N/A';
  try {
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: es });
  } catch {
    return 'Fecha inválida';
  }
};

const formatDateOnly = (date: string | Date) => {
  if (!date) return 'N/A';
  try {
    return format(new Date(date), "dd/MM/yyyy", { locale: es });
  } catch {
    return 'Fecha inválida';
  }
};

const getMachineTypeLabel = (type: string) => {
  switch (type?.toUpperCase()) {
    case 'PRODUCTION':
      return 'Producción';
    case 'MAINTENANCE':
      return 'Mantenimiento';
    case 'UTILITY':
      return 'Utilidad';
    case 'PACKAGING':
      return 'Empaque';
    case 'TRANSPORTATION':
      return 'Transporte';
    case 'OTHER':
      return 'Otro';
    default:
      return type;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'URGENT': return 'bg-red-100 text-red-800 border-red-200';
    case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-muted text-muted-foreground border-border';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-200';
    case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'OVERDUE': return 'bg-red-100 text-red-800 border-red-200';
    case 'CANCELLED': return 'bg-gray-100 text-gray-800 border-gray-200';
    default: return 'bg-muted text-muted-foreground border-border';
  }
};

const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case 'URGENT': return 'Urgente';
    case 'HIGH': return 'Alta';
    case 'MEDIUM': return 'Media';
    case 'LOW': return 'Baja';
    default: return priority;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'COMPLETED': return 'Completado';
    case 'IN_PROGRESS': return 'En Progreso';
    case 'PENDING': return 'Pendiente';
    case 'OVERDUE': return 'Vencido';
    case 'CANCELLED': return 'Cancelado';
    default: return status;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'PREVENTIVE': return 'Preventivo';
    case 'CORRECTIVE': return 'Correctivo';
    case 'PREDICTIVE': return 'Predictivo';
    case 'EMERGENCY': return 'Emergencia';
    default: return type;
  }
};

// Formatear duración en horas decimales a formato legible
const formatDuration = (hours: number | null | undefined): string => {
  if (hours === null || hours === undefined || isNaN(hours)) return 'N/A';

  const totalMinutes = Math.round(hours * 60);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (m === 0) {
    return `${h}h`;
  }

  return `${h}h ${m}min`;
};

// Obtener label para outcome/resultado
const getOutcomeLabel = (outcome: string | null | undefined): string => {
  switch (outcome) {
    case 'FUNCIONÓ': return '✅ Funcionó';
    case 'PARCIAL': return '⚠️ Parcial';
    case 'NO_FUNCIONÓ': return '❌ No funcionó';
    default: return outcome || 'N/A';
  }
};

// Obtener label para tipo de arreglo
const getFixTypeLabel = (fixType: string | null | undefined): string => {
  switch (fixType) {
    case 'PARCHE': return 'Parche temporal';
    case 'DEFINITIVA': return 'Solución definitiva';
    default: return fixType || 'N/A';
  }
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function MaintenanceDetailDialog({
  isOpen,
  onClose,
  maintenance,
  onEdit,
  onExecute,
  onComplete,
  onReschedule,
  onCancel,
  onDuplicate,
  companyId,
  canEdit = false
}: MaintenanceDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [executionHistory, setExecutionHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [components, setComponents] = useState<any[]>([]);
  const [subcomponents, setSubcomponents] = useState<any[]>([]);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [searchComponent, setSearchComponent] = useState('');
  const [searchSubcomponent, setSearchSubcomponent] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | '7d' | '30d'>('all');

  // ============= NUEVOS ESTADOS PARA MEJORAS =============
  // Estados para acciones rápidas
  const [showReschedulePopover, setShowReschedulePopover] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completeNotes, setCompleteNotes] = useState('');

  // Estados para comentarios
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Estados para fotos/evidencias
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [loadingEvidences, setLoadingEvidences] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);

  // Estados para mantenimientos relacionados
  const [relatedMaintenances, setRelatedMaintenances] = useState<any[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // Estados para suscripción y audit log
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Estado para móvil y FAB
  const [isMobile, setIsMobile] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const cache = useGlobalCache();

  // Detectar móvil
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calcular contadores - contar elementos únicos asociados al mantenimiento
  const componentCount = useMemo(() => {
    const componentIds = maintenance?.componentIds || [];
    const components = maintenance?.components || [];
    
    // Si hay objetos completos, usar esos; si no, usar los IDs
    if (components.length > 0) {
      return components.length;
    }
    if (componentIds.length > 0) {
      return componentIds.length;
    }
    return 0;
  }, [maintenance]);

  const subcomponentCount = useMemo(() => {
    const subcomponentIds = maintenance?.subcomponentIds || [];
    const subcomponents = maintenance?.subcomponents || [];
    
    // Si hay objetos completos, usar esos; si no, usar los IDs
    if (subcomponents.length > 0) {
      return subcomponents.length;
    }
    if (subcomponentIds.length > 0) {
      return subcomponentIds.length;
    }
    return 0;
  }, [maintenance]);

  const toolsCount = useMemo(() => {
    return ((maintenance?.toolsRequired || []).length + (maintenance?.tools || []).length);
  }, [maintenance]);

  const partsCount = useMemo(() => {
    return ((maintenance?.spareParts || []).length + (maintenance?.parts || []).length);
  }, [maintenance]);

  const instructivesCount = useMemo(() => {
    return ((maintenance?.instructives || []).length + (maintenance?.instructiveFiles || []).length);
  }, [maintenance]);

  const fetchExecutionHistory = useCallback(async () => {
    if (!maintenance?.id) return;
    
    const cacheKey = createCacheKey('maintenance-history', maintenance.id.toString(), companyId.toString());
    const cached = cache.get<any[]>(cacheKey);
    if (cached) {
      // Filtrar solo las ejecuciones de este mantenimiento
      const filtered = cached.filter((exec: any) => 
        Number(exec.maintenanceId) === Number(maintenance.id)
      );
      setExecutionHistory(filtered);
      return;
    }
    
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/maintenance/history?maintenanceId=${maintenance.id}&companyId=${companyId}`);
      if (response.ok) {
        const data = await response.json();
        const executions = data.data?.executions || [];
        // Filtrar solo las ejecuciones de este mantenimiento específico
        const filtered = executions.filter((exec: any) => 
          Number(exec.maintenanceId) === Number(maintenance.id)
        );
        setExecutionHistory(filtered);
        cache.set(cacheKey, filtered);
      }
    } catch (error) {
      console.error('Error fetching execution history:', error);
    } finally {
      setLoadingHistory(false);
    }
  }, [maintenance?.id, companyId, cache]);

  const fetchMaintenanceStats = useCallback(async () => {
    if (!maintenance?.id) return;
    
    const cacheKey = createCacheKey('maintenance-stats', maintenance.id.toString());
    const cached = cache.get<any>(cacheKey);
    if (cached) {
      setStats(cached);
      return;
    }
    
    setLoadingStats(true);
    try {
      const response = await fetch(`/api/maintenance/${maintenance.id}/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
        cache.set(cacheKey, data.data);
      }
    } catch (error) {
      console.error('Error fetching maintenance stats:', error);
    } finally {
      setLoadingStats(false);
    }
  }, [maintenance?.id, cache]);

  const fetchComponentsAndSubcomponents = useCallback(async () => {
    if (!maintenance?.machineId) return;
    
    // Si el mantenimiento ya tiene los componentes/subcomponentes completos, usarlos directamente
    if (maintenance.components && maintenance.components.length > 0) {
      setComponents(maintenance.components);
    }
    
    if (maintenance.subcomponents && maintenance.subcomponents.length > 0) {
      setSubcomponents(maintenance.subcomponents);
    }
    
    // Si ya tenemos los datos completos del mantenimiento, no necesitamos hacer fetch
    if ((maintenance.components && maintenance.components.length > 0) && 
        (maintenance.subcomponents !== undefined)) {
      setLoadingComponents(false);
      return;
    }
    
    const cacheKey = createCacheKey('maintenance-components', maintenance.machineId.toString());
    const cached = cache.get<{components: any[], subcomponents: any[]}>(cacheKey);
    if (cached) {
      // Combinar con los componentes del mantenimiento si existen
      if (maintenance.components && maintenance.components.length > 0) {
        const existingIds = new Set(cached.components.map((c: any) => c.id));
        const additionalComponents = maintenance.components.filter((c: any) => !existingIds.has(c.id));
        setComponents([...cached.components, ...additionalComponents]);
      } else {
        setComponents(cached.components);
      }
      
      if (maintenance.subcomponents && maintenance.subcomponents.length > 0) {
        const existingIds = new Set(cached.subcomponents.map((s: any) => s.id));
        const additionalSubcomponents = maintenance.subcomponents.filter((s: any) => !existingIds.has(s.id));
        setSubcomponents([...cached.subcomponents, ...additionalSubcomponents]);
      } else {
        setSubcomponents(cached.subcomponents);
      }
      return;
    }
    
    setLoadingComponents(true);
    try {
      const componentsResponse = await fetch(`/api/maquinas/${maintenance.machineId}/components`);
      if (componentsResponse.ok) {
        const componentsData = await componentsResponse.json();
        const componentsArray = Array.isArray(componentsData) ? componentsData : [];
        
        // Combinar con los componentes del mantenimiento si existen
        if (maintenance.components && maintenance.components.length > 0) {
          const existingIds = new Set(componentsArray.map((c: any) => c.id));
          const additionalComponents = maintenance.components.filter((c: any) => !existingIds.has(c.id));
          setComponents([...componentsArray, ...additionalComponents]);
        } else {
          setComponents(componentsArray);
        }

        const subcomponentPromises = componentsArray.map(async (component: any) => {
          try {
            const subcomponentsResponse = await fetch(`/api/components/${component.id}/subcomponents`);
            if (subcomponentsResponse.ok) {
              const subcomponentsData = await subcomponentsResponse.json();
              return Array.isArray(subcomponentsData) ? subcomponentsData : [];
            }
            return [];
          } catch (error) {
            return [];
          }
        });

        const subcomponentsArrays = await Promise.all(subcomponentPromises);
        const allSubcomponents = subcomponentsArrays.flat();
        
        // Combinar con los subcomponentes del mantenimiento si existen
        if (maintenance.subcomponents && maintenance.subcomponents.length > 0) {
          const existingIds = new Set(allSubcomponents.map((s: any) => s.id));
          const additionalSubcomponents = maintenance.subcomponents.filter((s: any) => !existingIds.has(s.id));
          setSubcomponents([...allSubcomponents, ...additionalSubcomponents]);
        } else {
          setSubcomponents(allSubcomponents);
        }
        
        cache.set(cacheKey, { 
          components: maintenance.components && maintenance.components.length > 0 
            ? [...componentsArray, ...maintenance.components.filter((c: any) => !componentsArray.some((ec: any) => ec.id === c.id))]
            : componentsArray,
          subcomponents: maintenance.subcomponents && maintenance.subcomponents.length > 0
            ? [...allSubcomponents, ...maintenance.subcomponents.filter((s: any) => !allSubcomponents.some((es: any) => es.id === s.id))]
            : allSubcomponents
        });
      }
    } catch (error) {
      console.error('Error fetching components:', error);
    } finally {
      setLoadingComponents(false);
    }
  }, [maintenance, cache]);

  // Cargar datos
  useEffect(() => {
    if (isOpen && maintenance?.id) {
      fetchExecutionHistory();
      fetchMaintenanceStats();
      // Cargar componentes para cualquier tipo de mantenimiento que tenga machineId
      if (maintenance.machineId) {
        fetchComponentsAndSubcomponents();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, maintenance?.id, maintenance?.type, companyId]);

  // Filtrar componentes por búsqueda y por los que están asociados al mantenimiento
  const filteredComponents = useMemo(() => {
    const maintenanceComponentIds = maintenance?.componentIds || [];
    const maintenanceComponents = maintenance?.components || [];

    // Primero, usar los componentes que vienen directamente en maintenance
    let filtered: any[] = [...maintenanceComponents];

    // Si hay IDs pero no componentes completos, crear objetos placeholder
    if (maintenanceComponentIds.length > 0 && maintenanceComponents.length === 0) {
      // Buscar en el state de components
      const foundInState = components.filter((c: any) =>
        maintenanceComponentIds.includes(c.id)
      );

      if (foundInState.length > 0) {
        filtered = foundInState;
      } else {
        // Crear placeholders con los IDs
        filtered = maintenanceComponentIds.map((id: any) => ({
          id,
          name: `Componente #${id}`
        }));
      }
    }

    // Si hay componentes en state que coinciden, agregarlos si no existen
    if (components.length > 0) {
      const existingIds = new Set(filtered.map((c: any) => c.id));
      components.forEach((c: any) => {
        if (maintenanceComponentIds.includes(c.id) && !existingIds.has(c.id)) {
          filtered.push(c);
        }
      });
    }

    // Aplicar búsqueda si hay texto
    if (searchComponent) {
      const search = searchComponent.toLowerCase();
      filtered = filtered.filter((c: any) =>
        c.name?.toLowerCase().includes(search) ||
        c.nombre?.toLowerCase().includes(search) ||
        c.title?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [components, searchComponent, maintenance]);

  // Filtrar subcomponentes por búsqueda y por los que están asociados al mantenimiento
  const filteredSubcomponents = useMemo(() => {
    const maintenanceSubcomponentIds = maintenance?.subcomponentIds || [];
    const maintenanceSubcomponents = maintenance?.subcomponents || [];

    // Primero, usar los subcomponentes que vienen directamente en maintenance
    let filtered: any[] = [...maintenanceSubcomponents];

    // Si hay IDs pero no subcomponentes completos, crear objetos placeholder
    if (maintenanceSubcomponentIds.length > 0 && maintenanceSubcomponents.length === 0) {
      // Buscar en el state de subcomponents
      const foundInState = subcomponents.filter((sc: any) =>
        maintenanceSubcomponentIds.includes(sc.id)
      );

      if (foundInState.length > 0) {
        filtered = foundInState;
      } else {
        // Crear placeholders con los IDs
        filtered = maintenanceSubcomponentIds.map((id: any) => ({
          id,
          name: `Subcomponente #${id}`
        }));
      }
    }

    // Si hay subcomponentes en state que coinciden, agregarlos si no existen
    if (subcomponents.length > 0) {
      const existingIds = new Set(filtered.map((sc: any) => sc.id));
      subcomponents.forEach((sc: any) => {
        if (maintenanceSubcomponentIds.includes(sc.id) && !existingIds.has(sc.id)) {
          filtered.push(sc);
        }
      });
    }

    // Aplicar búsqueda si hay texto
    if (searchSubcomponent) {
      const search = searchSubcomponent.toLowerCase();
      filtered = filtered.filter((sc: any) =>
        sc.name?.toLowerCase().includes(search) ||
        sc.nombre?.toLowerCase().includes(search) ||
        sc.title?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [subcomponents, searchSubcomponent, maintenance]);

  // Últimas 3 ejecuciones
  const lastExecutions = useMemo(() => {
    return executionHistory.slice(0, 3);
  }, [executionHistory]);

  // Filtrar historial por período de tiempo
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return executionHistory;

    const now = new Date();
    const cutoffDays = historyFilter === '7d' ? 7 : 30;
    const cutoffDate = new Date(now.getTime() - cutoffDays * 24 * 60 * 60 * 1000);

    return executionHistory.filter((execution: any) => {
      const execDate = new Date(execution.executedAt);
      return execDate >= cutoffDate;
    });
  }, [executionHistory, historyFilter]);

  // ============= FUNCIONES DE ACCIONES RÁPIDAS =============

  // Copiar enlace al portapapeles
  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/mantenimiento/${maintenance?.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: 'Enlace copiado',
        description: 'El enlace ha sido copiado al portapapeles',
      });
    }).catch(() => {
      toast({
        title: 'Error',
        description: 'No se pudo copiar el enlace',
        variant: 'destructive',
      });
    });
  }, [maintenance?.id]);

  // Generar QR
  const handleGenerateQR = useCallback(() => {
    const url = `${window.location.origin}/mantenimiento/${maintenance?.id}`;
    // Usar API de QR
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    window.open(qrUrl, '_blank');
    toast({
      title: 'Código QR generado',
      description: 'Se abrió el código QR en una nueva ventana',
    });
  }, [maintenance?.id]);

  // Imprimir / Exportar PDF
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Confirmar reprogramación
  const handleConfirmReschedule = useCallback(() => {
    if (rescheduleDate && onReschedule) {
      onReschedule(maintenance, rescheduleDate);
      setShowReschedulePopover(false);
      setRescheduleDate(undefined);
      toast({
        title: 'Reprogramado',
        description: `Mantenimiento reprogramado para ${format(rescheduleDate, "dd/MM/yyyy", { locale: es })}`,
      });
    }
  }, [rescheduleDate, onReschedule, maintenance]);

  // Confirmar cancelación
  const handleConfirmCancel = useCallback(() => {
    if (cancelReason.trim() && onCancel) {
      onCancel(maintenance, cancelReason);
      setShowCancelDialog(false);
      setCancelReason('');
      toast({
        title: 'Cancelado',
        description: 'El mantenimiento ha sido cancelado',
      });
    }
  }, [cancelReason, onCancel, maintenance]);

  // Confirmar completado rápido
  const handleConfirmComplete = useCallback(() => {
    if (onComplete) {
      onComplete(maintenance);
      setShowCompleteDialog(false);
      setCompleteNotes('');
      toast({
        title: 'Completado',
        description: 'El mantenimiento ha sido marcado como completado',
      });
    }
  }, [onComplete, maintenance]);

  // Agregar comentario
  const handleAddComment = useCallback(async () => {
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      // Simular llamada a API
      const newCommentObj: Comment = {
        id: `comment-${Date.now()}`,
        userId: 'current-user',
        userName: 'Usuario Actual',
        content: newComment,
        createdAt: new Date(),
        mentions: newComment.match(/@(\w+)/g)?.map(m => m.slice(1)) || [],
      };

      setComments(prev => [...prev, newCommentObj]);
      setNewComment('');
      toast({
        title: 'Comentario agregado',
        description: 'Tu comentario ha sido publicado',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo agregar el comentario',
        variant: 'destructive',
      });
    } finally {
      setSubmittingComment(false);
    }
  }, [newComment]);

  // Subir foto
  const handleUploadPhoto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newEvidence: Evidence = {
          id: `evidence-${Date.now()}-${Math.random()}`,
          url: event.target?.result as string,
          type: 'during',
          uploadedAt: new Date(),
          uploadedBy: 'Usuario Actual',
          caption: file.name,
        };
        setEvidences(prev => [...prev, newEvidence]);
      };
      reader.readAsDataURL(file);
    });

    toast({
      title: 'Foto subida',
      description: `${files.length} foto(s) agregada(s)`,
    });
  }, []);

  // Toggle suscripción
  const handleToggleSubscription = useCallback(() => {
    setIsSubscribed(prev => !prev);
    toast({
      title: isSubscribed ? 'Dejaste de seguir' : 'Siguiendo',
      description: isSubscribed
        ? 'Ya no recibirás notificaciones de este mantenimiento'
        : 'Recibirás notificaciones de cambios en este mantenimiento',
    });
  }, [isSubscribed]);

  // Refrescar datos
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchExecutionHistory(),
        fetchMaintenanceStats(),
      ]);
      toast({
        title: 'Actualizado',
        description: 'Los datos han sido actualizados',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchExecutionHistory, fetchMaintenanceStats]);

  // Early return después de todos los hooks
  if (!maintenance) {
    return null;
  }

  // Variables derivadas del maintenance
  const machineName: string = maintenance.machine?.name || maintenance.unidadMovil?.nombre || `ID: ${maintenance.id}`;
  const sectorName: string = maintenance.sector?.name || 'Sin sector';
  const assignedTo: string = maintenance.assignedTo?.name || maintenance.assignedWorker?.name || 'Sin asignar';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="xl" className="p-0 flex flex-col">
        {/* HEADER */}
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3">
          <div className="space-y-3">
            {/* Primera fila: Título y badges principales */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <Wrench className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-xl font-bold">
                    {maintenance.title || machineName}
                  </DialogTitle>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                    <span>ID: {maintenance.id}</span>
                    <span>•</span>
                    <span>Sector: {sectorName}</span>
                    {maintenance.machine?.name && (
                      <>
                        <span>•</span>
                        <span>Máquina: {maintenance.machine.name}</span>
                      </>
                    )}
                    {maintenance.unidadMovil?.nombre && (
                      <>
                        <span>•</span>
                        <span>Unidad: {maintenance.unidadMovil.nombre}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{assignedTo}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`${getPriorityColor(maintenance.priority)} border-2 text-xs`}>
                  {getPriorityLabel(maintenance.priority)}
                </Badge>
                <Badge className={`${getStatusColor(maintenance.status)} border-2 text-xs`}>
                  {getStatusLabel(maintenance.status)}
                </Badge>
                <Badge variant="outline" className="border-2 text-xs">
                  {getTypeLabel(maintenance.type)}
                </Badge>
              </div>
            </div>

            {/* Segunda fila: Acciones secundarias compactas */}
            <div className="flex items-center justify-end gap-1 pt-1">
              {/* Suscripción */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={handleToggleSubscription}
              >
                {isSubscribed ? (
                  <>
                    <Bell className="h-3.5 w-3.5 text-primary" />
                    <span className="hidden sm:inline">Siguiendo</span>
                  </>
                ) : (
                  <>
                    <BellOff className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Seguir</span>
                  </>
                )}
              </Button>

              {/* Refrescar */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Actualizar"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>

              {/* Menú opciones */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleCopyLink}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Copiar enlace
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleGenerateQR}>
                    <QrCode className="h-4 w-4 mr-2" />
                    Generar QR
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir / PDF
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {onDuplicate && (
                    <DropdownMenuItem onClick={() => onDuplicate(maintenance)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicar
                    </DropdownMenuItem>
                  )}
                  {onEdit && canEdit && (
                    <DropdownMenuItem onClick={() => { onEdit(maintenance); onClose(); }}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancelar mantenimiento
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Tercera fila: Acciones rápidas principales */}
            {maintenance.status !== 'COMPLETED' && maintenance.status !== 'CANCELLED' && canEdit && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                {/* Ejecutar ahora */}
                {onExecute && (
                  <Button
                    size="sm"
                    className="h-8 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => { onExecute(maintenance); onClose(); }}
                  >
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                    Ejecutar
                  </Button>
                )}

                {/* Marcar completado */}
                {onComplete && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-green-300 text-green-700 hover:bg-green-50"
                    onClick={() => setShowCompleteDialog(true)}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                    Completar
                  </Button>
                )}

                {/* Reprogramar */}
                {onReschedule && (
                  <Popover open={showReschedulePopover} onOpenChange={setShowReschedulePopover}>
                    <PopoverTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-blue-300 text-blue-700 hover:bg-blue-50"
                      >
                        <Calendar className="h-3.5 w-3.5 mr-1.5" />
                        Reprogramar
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={rescheduleDate}
                        onSelect={setRescheduleDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                      <div className="p-3 border-t flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowReschedulePopover(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleConfirmReschedule}
                          disabled={!rescheduleDate}
                        >
                          Confirmar
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                {/* Pausar - solo si está en progreso */}
                {maintenance.status === 'IN_PROGRESS' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-orange-300 text-orange-700 hover:bg-orange-50"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    <Pause className="h-3.5 w-3.5 mr-1.5" />
                    Pausar
                  </Button>
                )}

                {/* Cancelar - solo si no está en progreso */}
                {maintenance.status !== 'IN_PROGRESS' && onCancel && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    <X className="h-3.5 w-3.5 mr-1.5" />
                    Cancelar
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        {/* TABS - Centrados, FUERA del body */}
        <div className="flex justify-center px-4 sm:px-6 py-3 border-b bg-muted/20">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-auto flex-wrap bg-background border rounded-lg p-1 gap-1">
              <TabsTrigger
                value="overview"
                className="h-7 px-2 sm:px-3 rounded-md text-[10px] sm:text-xs font-medium flex items-center gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Resumen
              </TabsTrigger>
              {maintenance.type === 'CORRECTIVE' && (
                <TabsTrigger
                  value="failure"
                  className="h-7 px-2 sm:px-3 rounded-md text-[10px] sm:text-xs font-medium flex items-center gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  Falla
                </TabsTrigger>
              )}
              <TabsTrigger
                value="equipment"
                className="h-7 px-2 sm:px-3 rounded-md text-[10px] sm:text-xs font-medium flex items-center gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Building className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Equipos
                {(componentCount + subcomponentCount) > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-0.5">
                    {componentCount + subcomponentCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="schedule"
                className="h-7 px-2 sm:px-3 rounded-md text-[10px] sm:text-xs font-medium flex items-center gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Programa
              </TabsTrigger>
              <TabsTrigger
                value="resources"
                className="h-7 px-2 sm:px-3 rounded-md text-[10px] sm:text-xs font-medium flex items-center gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Package className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Recursos
                {(toolsCount + partsCount + instructivesCount) > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-0.5">
                    {toolsCount + partsCount + instructivesCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="h-7 px-2 sm:px-3 rounded-md text-[10px] sm:text-xs font-medium flex items-center gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <History className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Historial
                {executionHistory.length > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-0.5">
                    {executionHistory.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <DialogBody className="p-0">
        {/* CONTENT */}
        <div className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
              {/* TAB 1: RESUMEN */}
              <TabsContent value="overview" className="space-y-4 sm:space-y-6 mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  {/* Información General */}
                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Info className="h-4 w-4" />
                        Información General
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <InfoItem
                          icon={<User className="h-4 w-4" />}
                          label="Asignado a"
                          value={assignedTo}
                        />
                        <InfoItem
                          icon={<Clock className="h-4 w-4" />}
                          label={maintenance.status === 'COMPLETED' && maintenance.actualHours ? "Tiempo real" : "Tiempo estimado"}
                          value={(() => {
                            // Si está completado y tiene tiempo real, mostrar ese
                            if (maintenance.status === 'COMPLETED' && maintenance.actualHours) {
                              return formatDuration(maintenance.actualHours);
                            }
                            // Sino, mostrar tiempo estimado
                            if (maintenance.estimatedHours) {
                              return formatDuration(maintenance.estimatedHours);
                            }
                            if (maintenance.timeValue && maintenance.timeUnit) {
                              const unit = maintenance.timeUnit === 'HOURS' ? 'h' :
                                          maintenance.timeUnit === 'MINUTES' ? 'min' : 'd';
                              return `${maintenance.timeValue} ${unit}`;
                            }
                            return null;
                          })()}
                        />
                        <InfoItem
                          icon={<Calendar className="h-4 w-4" />}
                          label="Fecha programada"
                          value={maintenance.scheduledDate ? formatDateTime(maintenance.scheduledDate) : null}
                        />
                        <InfoItem
                          icon={<Target className="h-4 w-4" />}
                          label="Estado"
                          value={getStatusLabel(maintenance.status)}
                        />
                      </div>

                      {/* Sección de cierre para mantenimientos completados */}
                      {maintenance.status === 'COMPLETED' && (maintenance.diagnosisNotes || maintenance.workPerformedNotes || maintenance.resultNotes || maintenance.closingMode) && (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-primary" />
                            Resumen de cierre
                          </h4>
                          <div className="space-y-3">
                            {maintenance.diagnosisNotes && (
                              <div className="p-3 bg-muted/50 rounded-lg border">
                                <p className="text-xs font-semibold text-muted-foreground mb-1">Diagnóstico</p>
                                <p className="text-sm">{maintenance.diagnosisNotes}</p>
                              </div>
                            )}
                            {maintenance.workPerformedNotes && (
                              <div className="p-3 bg-muted/50 rounded-lg border">
                                <p className="text-xs font-semibold text-muted-foreground mb-1">Solución aplicada</p>
                                <p className="text-sm">{maintenance.workPerformedNotes}</p>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-3">
                              {maintenance.resultNotes && (
                                <div className="flex-1 min-w-[120px] p-2 bg-muted rounded-lg text-center">
                                  <p className="text-xs text-muted-foreground mb-1">Resultado</p>
                                  <p className="text-sm font-semibold">{getOutcomeLabel(maintenance.resultNotes)}</p>
                                </div>
                              )}
                              {maintenance.closingMode && (
                                <div className="flex-1 min-w-[120px] p-2 bg-muted rounded-lg text-center">
                                  <p className="text-xs text-muted-foreground mb-1">Tipo de arreglo</p>
                                  <p className="text-sm font-semibold">
                                    {maintenance.closingMode === 'PROFESSIONAL' ? 'Profesional' : 'Mínimo'}
                                  </p>
                                </div>
                              )}
                              {maintenance.actualHours && (
                                <div className="flex-1 min-w-[120px] p-2 bg-muted rounded-lg text-center">
                                  <p className="text-xs text-muted-foreground mb-1">Tiempo trabajado</p>
                                  <p className="text-sm font-semibold">{formatDuration(maintenance.actualHours)}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* KPIs */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <BarChart3 className="h-4 w-4" />
                        Estadísticas Rápidas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <StatCard
                        value={maintenance.maintenanceCount || executionHistory.length || (maintenance.status === 'COMPLETED' ? 1 : 0)}
                        label="Veces realizado"
                        variant="blue"
                      />
                      <StatCard
                        value={maintenance.frequencyDays || 'N/A'}
                        label="Días de frecuencia"
                        variant="green"
                      />
                      <StatCard
                        value={toolsCount + partsCount + instructivesCount}
                        label="Recursos"
                        variant="purple"
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Últimas ejecuciones */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-base">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Últimas ejecuciones
                      </div>
                      {executionHistory.length > 3 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveTab('history')}
                          className="text-xs"
                        >
                          Ver historial completo
                          <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                    <CardContent>
                      {loadingHistory ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                        </div>
                      ) : lastExecutions.length > 0 ? (
                        <div className="space-y-2">
                          {lastExecutions.map((execution: any, index: number) => (
                            <div key={execution.id || index} className="p-3 border rounded-lg">
                              <div className="flex items-start justify-between mb-2">
                                <p className="text-sm font-medium">{execution.title || 'Mantenimiento'}</p>
                                <Badge
                                  variant={execution.completionStatus === 'RESCHEDULED' ? 'secondary' : 'default'}
                                  className="text-xs"
                                >
                                  {execution.completionStatus === 'RESCHEDULED' ? 'Reprogramado' : 'Completado'}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(execution.executedAt)} • {execution.assignedToName || 'N/A'}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          icon={<History className="h-5 w-5 text-muted-foreground" />}
                          title="Todavía no hay ejecuciones registradas"
                          description="Las ejecuciones de mantenimiento aparecerán aquí una vez que se completen"
                        />
                      )}
                    </CardContent>
                  </Card>

                {/* Notas y comentarios (movido desde tab separado) */}
                {(maintenance.rootCause || maintenance.solution || maintenance.notes || maintenance.comments) && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MessageSquare className="h-4 w-4" />
                        Notas y comentarios
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {maintenance.rootCause && (
                        <div className="p-3 bg-muted/50 rounded-lg border">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                            <p className="text-xs font-semibold text-muted-foreground">Causa Raíz</p>
                          </div>
                          <p className="text-sm">{maintenance.rootCause}</p>
                        </div>
                      )}
                      {maintenance.solution && (
                        <div className="p-3 bg-muted/50 rounded-lg border">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                            <p className="text-xs font-semibold text-muted-foreground">Solución</p>
                          </div>
                          <p className="text-sm">{maintenance.solution}</p>
                        </div>
                      )}
                      {maintenance.notes && (
                        <div className="p-3 bg-muted/50 rounded-lg border">
                          <div className="flex items-center gap-2 mb-1">
                            <Info className="h-4 w-4 text-muted-foreground" />
                            <p className="text-xs font-semibold text-muted-foreground">Notas</p>
                          </div>
                          <p className="text-sm">{maintenance.notes}</p>
                        </div>
                      )}
                      {maintenance.comments && (
                        <div className="p-3 bg-muted/50 rounded-lg border">
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            <p className="text-xs font-semibold text-muted-foreground">Comentarios</p>
                          </div>
                          <p className="text-sm">{maintenance.comments}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Galería de fotos/evidencias */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Camera className="h-4 w-4" />
                        Fotos y evidencias
                        {evidences.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {evidences.length}
                          </Badge>
                        )}
                      </CardTitle>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Agregar
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {evidences.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {evidences.map((evidence) => (
                          <div
                            key={evidence.id}
                            className="relative group cursor-pointer rounded-lg overflow-hidden border bg-muted aspect-square"
                            onClick={() => {
                              setSelectedEvidence(evidence);
                              setShowLightbox(true);
                            }}
                          >
                            <img
                              src={evidence.thumbnail || evidence.url}
                              alt={evidence.caption || 'Evidencia'}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                              <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            {evidence.type && (
                              <Badge
                                variant="secondary"
                                className="absolute top-2 left-2 text-[10px] bg-black/60 text-white border-0"
                              >
                                {evidence.type === 'before' ? 'Antes' : evidence.type === 'after' ? 'Después' : 'Durante'}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={<Camera className="h-5 w-5 text-muted-foreground" />}
                        title="Sin fotos registradas"
                        description="Agrega fotos antes, durante o después del mantenimiento"
                        action={canEdit ? {
                          label: 'Subir foto',
                          onClick: () => fileInputRef.current?.click(),
                          icon: <Camera className="h-3.5 w-3.5" />
                        } : undefined}
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Sección de comentarios/discusión */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MessageSquare className="h-4 w-4" />
                      Discusión
                      {comments.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {comments.length}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Lista de comentarios */}
                    {comments.length > 0 ? (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {comments.map((comment) => (
                          <div key={comment.id} className="flex gap-3 p-3 rounded-lg bg-muted/30">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              {comment.userAvatar ? (
                                <img
                                  src={comment.userAvatar}
                                  alt={comment.userName}
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                <User className="h-4 w-4 text-primary" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium">{comment.userName}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(comment.createdAt, { addSuffix: true, locale: es })}
                                </span>
                              </div>
                              <p className="text-sm text-foreground/80">{comment.content}</p>
                              {comment.attachments && comment.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {comment.attachments.map((attachment, idx) => (
                                    <a
                                      key={idx}
                                      href={attachment.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                    >
                                      <File className="h-3 w-3" />
                                      {attachment.name}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Sin comentarios aún</p>
                      </div>
                    )}

                    {/* Input para nuevo comentario */}
                    <div className="flex gap-2 pt-3 border-t items-end">
                      <Textarea
                        ref={commentInputRef}
                        placeholder="Escribe un comentario..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="min-h-[36px] max-h-[80px] text-sm resize-none py-2"
                        rows={1}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (newComment.trim() && !submittingComment) {
                              handleAddComment();
                            }
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        className="h-9 w-9 flex-shrink-0"
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || submittingComment}
                      >
                        {submittingComment ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Enter envía · Shift+Enter nueva línea
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB 2: EQUIPAMIENTO */}
              <TabsContent value="equipment" className="space-y-4 sm:space-y-6 mt-0">
                {/* Información de la máquina - Hero card */}
                <Card className="bg-muted/30 border-l-4 border-l-primary">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 p-3 rounded-lg">
                        <Building className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold truncate">{machineName}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-sm text-muted-foreground">
                          {maintenance.machine?.type && (
                            <Badge variant="outline" className="text-xs">
                              {getMachineTypeLabel(maintenance.machine.type)}
                            </Badge>
                          )}
                          <span>{sectorName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Responsable: {assignedTo}
                        </p>
                      </div>
                      {/* Resumen de componentes */}
                      <div className="hidden sm:flex gap-3">
                        <div className="text-center px-3 py-1.5 bg-background rounded-lg border">
                          <p className="text-lg font-bold">{componentCount}</p>
                          <p className="text-[10px] text-muted-foreground">Componentes</p>
                        </div>
                        <div className="text-center px-3 py-1.5 bg-background rounded-lg border">
                          <p className="text-lg font-bold">{subcomponentCount}</p>
                          <p className="text-[10px] text-muted-foreground">Subcomponentes</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Estructura jerárquica de componentes */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Cog className="h-4 w-4" />
                        Estructura de equipamiento
                      </CardTitle>
                      {canEdit && (
                        <Button variant="ghost" size="sm" className="text-xs">
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Agregar
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Buscador unificado */}
                    <Input
                      placeholder="Buscar componente o subcomponente…"
                      value={searchComponent}
                      onChange={(e) => {
                        setSearchComponent(e.target.value);
                        setSearchSubcomponent(e.target.value);
                      }}
                      className="h-8 text-xs"
                    />

                    {loadingComponents ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                      </div>
                    ) : (componentCount > 0 || subcomponentCount > 0) ? (
                      <div className="space-y-1">
                        {/* Vista jerárquica: Componentes con sus subcomponentes */}
                        {filteredComponents.length > 0 ? (
                          filteredComponents.map((component: any) => {
                            // Buscar subcomponentes de este componente
                            const childSubs = filteredSubcomponents.filter(
                              (sub: any) => sub.componentId === component.id || sub.parentId === component.id
                            );

                            return (
                              <div key={component.id} className="border rounded-lg overflow-hidden">
                                {/* Componente padre */}
                                <div className="flex items-center gap-3 p-3 bg-muted/30">
                                  <div className="p-1.5 bg-primary/10 rounded">
                                    <Cog className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {component.name || component.nombre || component.title || `Componente #${component.id}`}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Componente principal
                                    </p>
                                  </div>
                                  {childSubs.length > 0 && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      {childSubs.length} sub
                                    </Badge>
                                  )}
                                </div>

                                {/* Subcomponentes hijos */}
                                {childSubs.length > 0 && (
                                  <div className="border-t bg-background">
                                    {childSubs.map((sub: any, subIdx: number) => (
                                      <div
                                        key={sub.id}
                                        className={`flex items-center gap-3 p-2.5 pl-8 ${
                                          subIdx < childSubs.length - 1 ? 'border-b border-dashed' : ''
                                        }`}
                                      >
                                        <div className="w-4 h-4 border-l-2 border-b-2 border-muted-foreground/30 rounded-bl" />
                                        <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                                        <p className="text-xs truncate">
                                          {sub.name || sub.nombre || sub.title || `Subcomponente #${sub.id}`}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : null}

                        {/* Subcomponentes huérfanos (sin componente padre asignado) */}
                        {(() => {
                          const orphanSubs = filteredSubcomponents.filter(
                            (sub: any) => !filteredComponents.some(
                              (comp: any) => comp.id === sub.componentId || comp.id === sub.parentId
                            )
                          );

                          if (orphanSubs.length === 0) return null;

                          return (
                            <div className="border rounded-lg overflow-hidden border-dashed">
                              <div className="flex items-center gap-3 p-3 bg-muted/20">
                                <div className="p-1.5 bg-muted rounded">
                                  <Settings className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-muted-foreground">
                                    Sin asignar
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Subcomponentes independientes
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-[10px]">
                                  {orphanSubs.length}
                                </Badge>
                              </div>
                              <div className="border-t bg-background">
                                {orphanSubs.map((sub: any, subIdx: number) => (
                                  <div
                                    key={sub.id}
                                    className={`flex items-center gap-3 p-2.5 pl-8 ${
                                      subIdx < orphanSubs.length - 1 ? 'border-b border-dashed' : ''
                                    }`}
                                  >
                                    <div className="w-4 h-4 border-l-2 border-b-2 border-muted-foreground/20 rounded-bl" />
                                    <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                                    <p className="text-xs truncate">
                                      {sub.name || sub.nombre || sub.title || `Subcomponente #${sub.id}`}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <EmptyState
                        icon={<Cog className="h-5 w-5 text-muted-foreground" />}
                        title="Sin equipamiento registrado"
                        description="Agrega componentes y subcomponentes a esta máquina"
                        action={canEdit ? {
                          label: 'Agregar componente',
                          onClick: () => {},
                          icon: <Plus className="h-3.5 w-3.5" />
                        } : undefined}
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB 3: PROGRAMACIÓN */}
              <TabsContent value="schedule" className="space-y-4 sm:space-y-6 mt-0">
                {/* Resumen de frecuencia - paleta sobria */}
                {(maintenance.scheduledDate || maintenance.frequencyDays) && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-muted/50 border rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground font-medium">Frecuencia</p>
                      <p className="text-lg font-bold">
                        {maintenance.frequencyDays ? `${maintenance.frequencyDays}d` : 'N/A'}
                      </p>
                    </div>
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground font-medium">Próximo</p>
                      <p className="text-sm font-bold text-primary">
                        {maintenance.scheduledDate ? format(new Date(maintenance.scheduledDate), 'dd MMM', { locale: es }) : 'N/A'}
                      </p>
                    </div>
                    <div className="bg-muted/50 border rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground font-medium">Al año</p>
                      <p className="text-lg font-bold">
                        {maintenance.frequencyDays ? Math.round(365 / maintenance.frequencyDays) : 'N/A'}
                      </p>
                    </div>
                    <div className="bg-muted/50 border rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground font-medium">Realizados</p>
                      <p className="text-lg font-bold">
                        {maintenance.maintenanceCount || executionHistory.length || 0}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Mini Calendario Visual */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Calendar className="h-4 w-4" />
                        Calendario de Mantenimiento
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {maintenance.frequencyDays && maintenance.scheduledDate ? (
                        <div className="flex flex-col items-center">
                          <CalendarComponent
                            mode="multiple"
                            selected={(() => {
                              const dates: Date[] = [];
                              const baseDate = new Date(maintenance.scheduledDate);
                              for (let i = 0; i < 10; i++) {
                                const date = new Date(baseDate);
                                date.setDate(date.getDate() + (i * maintenance.frequencyDays));
                                dates.push(date);
                              }
                              return dates;
                            })()}
                            className="rounded-md border"
                            modifiers={{
                              next: [new Date(maintenance.scheduledDate)],
                            }}
                            modifiersClassNames={{
                              next: 'bg-green-500 text-white hover:bg-green-600',
                            }}
                          />
                          <p className="text-xs text-muted-foreground mt-2 text-center">
                            Los días marcados muestran las próximas 10 ejecuciones programadas
                          </p>
                        </div>
                      ) : (
                        <EmptyState
                          icon={<Calendar className="h-5 w-5 text-muted-foreground" />}
                          title="Sin programación configurada"
                          description="Configura la frecuencia y fechas de este mantenimiento"
                          action={canEdit ? {
                            label: 'Configurar',
                            onClick: () => {},
                            icon: <Calendar className="h-3.5 w-3.5" />
                          } : undefined}
                        />
                      )}
                    </CardContent>
                  </Card>

                  {/* Lista de próximas fechas */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <CalendarDays className="h-4 w-4" />
                        Próximas 5 Ejecuciones
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {maintenance.frequencyDays && maintenance.scheduledDate ? (
                        <div className="space-y-2">
                          {Array.from({ length: 5 }, (_, i) => {
                            const date = new Date(maintenance.scheduledDate);
                            date.setDate(date.getDate() + (i * maintenance.frequencyDays));
                            const isFirst = i === 0;
                            const isPast = date < new Date();

                            return (
                              <div
                                key={i}
                                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                                  isFirst
                                    ? 'bg-primary/5 border-primary/30'
                                    : isPast
                                      ? 'bg-muted/30 border-muted opacity-60'
                                      : 'bg-card hover:bg-muted/30'
                                }`}
                              >
                                {/* Día grande */}
                                <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg ${
                                  isFirst ? 'bg-primary text-primary-foreground' : isPast ? 'bg-muted text-muted-foreground' : 'bg-muted'
                                }`}>
                                  <span className="text-lg font-bold leading-none">{format(date, 'd')}</span>
                                  <span className="text-[10px] uppercase">{format(date, 'MMM', { locale: es })}</span>
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium ${isPast ? 'text-muted-foreground' : ''}`}>
                                    {format(date, "EEEE", { locale: es })}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(date, "dd 'de' MMMM yyyy", { locale: es })}
                                  </p>
                                </div>

                                {/* Badge */}
                                {isFirst && (
                                  <Badge className="text-xs">Próximo</Badge>
                                )}
                                {isPast && !isFirst && (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">Pasado</Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <EmptyState
                          icon={<CalendarDays className="h-5 w-5 text-muted-foreground" />}
                          title="No hay próximas fechas"
                          description="Configura la programación"
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* TAB 4: RECURSOS (Herramientas + Repuestos + Instructivos) */}
              <TabsContent value="resources" className="space-y-4 sm:space-y-6 mt-0">
                {/* Resumen de recursos - paleta sobria */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 border rounded-lg">
                    <div className="p-2 bg-foreground/10 rounded-lg">
                      <Wrench className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{toolsCount}</p>
                      <p className="text-xs text-muted-foreground">Herramientas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 border rounded-lg">
                    <div className="p-2 bg-foreground/10 rounded-lg">
                      <Package className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{partsCount}</p>
                      <p className="text-xs text-muted-foreground">Repuestos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 border rounded-lg">
                    <div className="p-2 bg-foreground/10 rounded-lg">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{instructivesCount}</p>
                      <p className="text-xs text-muted-foreground">Instructivos</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Herramientas */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Wrench className="h-4 w-4" />
                          Herramientas
                          {toolsCount > 0 && (
                            <Badge variant="secondary" className="text-xs">{toolsCount}</Badge>
                          )}
                        </CardTitle>
                        {canEdit && (
                          <Button variant="ghost" size="sm" className="text-xs">
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Agregar
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3">
                      {(maintenance.toolsRequired || maintenance.tools || []).length > 0 ? (
                        <div className="grid grid-cols-1 gap-2">
                          {(maintenance.toolsRequired || maintenance.tools || []).map((tool: any, index: number) => (
                            <div
                              key={index}
                              className="flex items-center gap-3 p-2.5 bg-muted/30 border rounded-lg"
                            >
                              <div className="p-1.5 bg-muted rounded">
                                <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{tool.name || `Herramienta ${index + 1}`}</p>
                                {tool.location && (
                                  <p className="text-xs text-muted-foreground">{tool.location}</p>
                                )}
                              </div>
                              {tool.quantity && (
                                <Badge variant="outline" className="text-xs">
                                  x{tool.quantity}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <Wrench className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Sin herramientas</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Repuestos */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Package className="h-4 w-4" />
                          Repuestos
                          {partsCount > 0 && (
                            <Badge variant="secondary" className="text-xs">{partsCount}</Badge>
                          )}
                        </CardTitle>
                        {canEdit && (
                          <Button variant="ghost" size="sm" className="text-xs">
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Agregar
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3">
                      {(maintenance.spareParts || maintenance.parts || []).length > 0 ? (
                        <div className="grid grid-cols-1 gap-2">
                          {(maintenance.spareParts || maintenance.parts || []).map((part: any, index: number) => (
                            <div
                              key={index}
                              className="flex items-center gap-3 p-2.5 bg-muted/30 border rounded-lg"
                            >
                              <div className="p-1.5 bg-muted rounded">
                                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{part.name || part.description || `Repuesto ${index + 1}`}</p>
                                {part.partNumber && (
                                  <p className="text-xs text-muted-foreground">P/N: {part.partNumber}</p>
                                )}
                              </div>
                              {part.quantity && (
                                <Badge variant="outline" className="text-xs">
                                  x{part.quantity}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Sin repuestos</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Instructivos (integrado en Recursos) */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-4 w-4" />
                        Instructivos
                        {instructivesCount > 0 && (
                          <Badge variant="secondary" className="text-xs">{instructivesCount}</Badge>
                        )}
                      </CardTitle>
                      {canEdit && (
                        <Button variant="ghost" size="sm" className="text-xs">
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Subir
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-3">
                    {(maintenance.instructives || maintenance.instructiveFiles || []).length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(maintenance.instructives || maintenance.instructiveFiles || []).map((instructive: any, index: number) => {
                          const fileName = instructive.originalName || instructive.fileName || `Instructivo ${index + 1}`;
                          const isPDF = fileName.toLowerCase().endsWith('.pdf');
                          const isImage = /\.(jpg|jpeg|png|gif)$/i.test(fileName);

                          return (
                            <div key={index} className="flex flex-col p-3 bg-muted/30 border rounded-lg hover:bg-muted/50 transition-colors">
                              <div className="flex items-start gap-3 mb-2">
                                <div className="p-2 bg-muted rounded">
                                  {isPDF ? (
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                  ) : isImage ? (
                                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <File className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{fileName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {instructive.uploadedAt ? formatDateOnly(instructive.uploadedAt) : 'Sin fecha'}
                                  </p>
                                </div>
                              </div>
                              {instructive.url && (
                                <div className="flex gap-1 mt-auto pt-2 border-t">
                                  <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" asChild>
                                    <a href={instructive.url} target="_blank" rel="noopener noreferrer">
                                      <Eye className="h-3 w-3 mr-1" />
                                      Ver
                                    </a>
                                  </Button>
                                  <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" asChild>
                                    <a href={instructive.url} download>
                                      <Download className="h-3 w-3 mr-1" />
                                      Descargar
                                    </a>
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Sin instructivos</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB 6: HISTORIAL - Timeline Visual + Audit Log */}
              <TabsContent value="history" className="space-y-4 sm:space-y-6 mt-0">
                {/* Resumen rápido de historial - paleta sobria */}
                {executionHistory.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-muted/50 border rounded-lg p-3 text-center">
                      <p className="text-lg font-bold">
                        {executionHistory.filter((e: any) => e.completionStatus !== 'RESCHEDULED').length}
                      </p>
                      <p className="text-xs text-muted-foreground">Completados</p>
                    </div>
                    <div className="bg-muted/50 border rounded-lg p-3 text-center">
                      <p className="text-lg font-bold">
                        {executionHistory.filter((e: any) => e.completionStatus === 'RESCHEDULED').length}
                      </p>
                      <p className="text-xs text-muted-foreground">Reprogramados</p>
                    </div>
                    <div className="bg-muted/50 border rounded-lg p-3 text-center">
                      <p className="text-lg font-bold">
                        {executionHistory.filter((e: any) => e.isFromChecklist).length}
                      </p>
                      <p className="text-xs text-muted-foreground">Por Checklist</p>
                    </div>
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-primary">{executionHistory.length}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>
                )}

                {/* Timeline de ejecuciones */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <History className="h-4 w-4" />
                        Timeline de Ejecuciones
                        {executionHistory.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {executionHistory.length}
                          </Badge>
                        )}
                      </CardTitle>
                      {/* Filtros rápidos de fecha */}
                      {executionHistory.length > 0 && (
                        <div className="flex gap-1">
                          <Button
                            variant={historyFilter === '7d' ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setHistoryFilter('7d')}
                          >
                            Últimos 7d
                          </Button>
                          <Button
                            variant={historyFilter === '30d' ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setHistoryFilter('30d')}
                          >
                            Último mes
                          </Button>
                          <Button
                            variant={historyFilter === 'all' ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setHistoryFilter('all')}
                          >
                            Todos
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-3">
                    {loadingHistory ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                      </div>
                    ) : filteredHistory.length > 0 ? (
                      <div className="relative">
                        {/* Indicador de filtro activo */}
                        {historyFilter !== 'all' && (
                          <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              Mostrando {filteredHistory.length} de {executionHistory.length} ejecuciones
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => setHistoryFilter('all')}
                            >
                              Ver todas
                            </Button>
                          </div>
                        )}

                        {/* Línea vertical del timeline */}
                        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-muted-foreground/50 to-muted" />

                        {/* Items del timeline */}
                        <div className="space-y-6">
                          {filteredHistory.map((execution: any, index: number) => {
                            const isCompleted = execution.completionStatus !== 'RESCHEDULED';
                            const isFirst = index === 0;

                            return (
                              <div key={execution.id || index} className="relative flex gap-4">
                                {/* Indicador circular */}
                                <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                  isFirst
                                    ? 'bg-primary ring-4 ring-primary/20'
                                    : isCompleted
                                      ? 'bg-muted-foreground/70'
                                      : 'bg-muted-foreground/40'
                                }`}>
                                  {isCompleted ? (
                                    <CheckCircle className="h-4 w-4 text-white" />
                                  ) : (
                                    <RotateCcw className="h-4 w-4 text-white" />
                                  )}
                                </div>

                                {/* Contenido */}
                                <div className={`flex-1 pb-2 ${isFirst ? '' : 'opacity-80'}`}>
                                  <div className={`bg-card border rounded-lg p-4 shadow-sm ${isFirst ? 'ring-1 ring-primary/30' : ''}`}>
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-2">
                                      <div>
                                        <h4 className="text-sm font-semibold">
                                          {execution.title || 'Mantenimiento ejecutado'}
                                        </h4>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          {formatDateTime(execution.executedAt)}
                                        </p>
                                      </div>
                                      <div className="flex gap-1">
                                        <Badge
                                          variant={isCompleted ? 'default' : 'secondary'}
                                          className="text-xs"
                                        >
                                          {isCompleted ? 'Completado' : 'Reprogramado'}
                                        </Badge>
                                        {execution.isFromChecklist && (
                                          <Badge variant="outline" className="text-xs">Checklist</Badge>
                                        )}
                                      </div>
                                    </div>

                                    {/* Métricas */}
                                    <div className="flex flex-wrap items-center gap-4 text-xs mb-3">
                                      <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <User className="h-3.5 w-3.5" />
                                        <span>{execution.assignedToName || 'Sin asignar'}</span>
                                      </div>
                                      {execution.actualDuration && (
                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                          <Timer className="h-3.5 w-3.5" />
                                          <span>
                                            {execution.actualDuration < 60
                                              ? `${execution.actualDuration} min`
                                              : `${Math.floor(execution.actualDuration / 60)}h ${execution.actualDuration % 60}m`}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Notas */}
                                    {execution.notes && (
                                      <div className="bg-muted/50 rounded-md p-2.5 text-xs">
                                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                          <MessageSquare className="h-3 w-3" />
                                          <span className="font-medium">Notas</span>
                                        </div>
                                        <p className="text-foreground/80">{execution.notes}</p>
                                      </div>
                                    )}

                                    {/* Issues */}
                                    {execution.issues && (
                                      <div className="bg-muted/70 border rounded-md p-2.5 text-xs mt-2">
                                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                          <AlertTriangle className="h-3 w-3" />
                                          <span className="font-medium">Problemas reportados</span>
                                        </div>
                                        <p className="text-foreground/80">{execution.issues}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : executionHistory.length > 0 ? (
                      // Hay historial pero el filtro no muestra resultados
                      <div className="text-center py-8">
                        <History className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                        <p className="text-sm font-medium mb-1">
                          Sin ejecuciones en {historyFilter === '7d' ? 'los últimos 7 días' : 'el último mes'}
                        </p>
                        <p className="text-xs text-muted-foreground mb-3">
                          Hay {executionHistory.length} ejecuciones en el historial completo
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHistoryFilter('all')}
                        >
                          Ver todas las ejecuciones
                        </Button>
                      </div>
                    ) : (
                      <EmptyState
                        icon={<History className="h-5 w-5 text-muted-foreground" />}
                        title="Todavía no hay historial de ejecución"
                        description="Las ejecuciones de mantenimiento aparecerán aquí una vez que se completen"
                        action={canEdit ? {
                          label: 'Registrar ejecución',
                          onClick: () => {},
                          icon: <Plus className="h-3.5 w-3.5" />
                        } : undefined}
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Audit Log - Historial de cambios */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-4 w-4" />
                        Registro de cambios
                        {auditLog.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {auditLog.length}
                          </Badge>
                        )}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={handleToggleSubscription}
                      >
                        {isSubscribed ? (
                          <>
                            <BellOff className="h-3.5 w-3.5 mr-1" />
                            Dejar de seguir
                          </>
                        ) : (
                          <>
                            <Bell className="h-3.5 w-3.5 mr-1" />
                            Seguir cambios
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingAudit ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                      </div>
                    ) : auditLog.length > 0 ? (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {auditLog.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              <History className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{entry.userName}</span>
                                <span className="text-xs text-muted-foreground">
                                  {entry.action}
                                </span>
                                {entry.field && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {entry.field}
                                  </Badge>
                                )}
                              </div>
                              {(entry.oldValue || entry.newValue) && (
                                <div className="flex items-center gap-2 mt-1 text-xs">
                                  {entry.oldValue && (
                                    <span className="text-red-600 line-through">{entry.oldValue}</span>
                                  )}
                                  {entry.oldValue && entry.newValue && (
                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                  )}
                                  {entry.newValue && (
                                    <span className="text-green-600">{entry.newValue}</span>
                                  )}
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(entry.timestamp, { addSuffix: true, locale: es })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={<FileText className="h-5 w-5 text-muted-foreground" />}
                        title="Sin registro de cambios"
                        description={isSubscribed
                          ? "Recibirás notificaciones cuando haya cambios"
                          : "Suscríbete para recibir notificaciones de cambios"}
                        action={!isSubscribed ? {
                          label: 'Seguir cambios',
                          onClick: handleToggleSubscription,
                          icon: <Bell className="h-3.5 w-3.5" />
                        } : undefined}
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

            </Tabs>
          </div>
        </DialogBody>

        <DialogFooter>
          {onEdit && canEdit ? (
            <Button
              size="sm"
              onClick={() => {
                onEdit(maintenance);
                onClose();
              }}
            >
              <Edit className="h-3.5 w-3.5 mr-1.5" />
              Editar
            </Button>
          ) : (
            <Badge variant="outline" className="h-8 px-3 flex items-center text-xs">
              Solo lectura
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>

        {/* Hidden file input para fotos */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          multiple
          onChange={handleUploadPhoto}
        />

        {/* FAB para móvil */}
        {isMobile && canEdit && maintenance.status !== 'COMPLETED' && maintenance.status !== 'CANCELLED' && (
          <div className="fixed bottom-6 right-6 z-50">
            {showFabMenu && (
              <div className="absolute bottom-16 right-0 flex flex-col gap-2 mb-2 animate-in slide-in-from-bottom-2">
                {onExecute && (
                  <Button
                    size="sm"
                    className="shadow-lg bg-green-600 hover:bg-green-700 text-white rounded-full h-10 px-4"
                    onClick={() => { onExecute(maintenance); onClose(); setShowFabMenu(false); }}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Ejecutar
                  </Button>
                )}
                {onComplete && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shadow-lg bg-white rounded-full h-10 px-4"
                    onClick={() => { setShowCompleteDialog(true); setShowFabMenu(false); }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Completar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="shadow-lg bg-white rounded-full h-10 px-4"
                  onClick={() => { fileInputRef.current?.click(); setShowFabMenu(false); }}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Foto
                </Button>
              </div>
            )}
            <Button
              size="lg"
              className={`shadow-xl rounded-full h-14 w-14 p-0 transition-transform ${showFabMenu ? 'rotate-45 bg-gray-600' : 'bg-primary'}`}
              onClick={() => setShowFabMenu(!showFabMenu)}
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>
        )}
      </DialogContent>

      {/* AlertDialog para Cancelar */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-red-500" />
              Cancelar mantenimiento
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción cancelará el mantenimiento programado. Por favor, indica el motivo de la cancelación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Motivo de cancelación (requerido)..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowCancelDialog(false); setCancelReason(''); }}>
              Volver
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              disabled={!cancelReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirmar cancelación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog para Completar rápido */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Marcar como completado
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de marcar este mantenimiento como completado? Puedes agregar notas opcionales.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Notas de cierre (opcional)..."
              value={completeNotes}
              onChange={(e) => setCompleteNotes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowCompleteDialog(false); setCompleteNotes(''); }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmComplete}
              className="bg-green-600 hover:bg-green-700"
            >
              Completar mantenimiento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lightbox para ver fotos */}
      {showLightbox && selectedEvidence && (
        <Dialog open={showLightbox} onOpenChange={setShowLightbox}>
          <DialogContent className="max-w-4xl p-0 bg-black/95">
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
                onClick={() => setShowLightbox(false)}
              >
                <X className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 left-4 z-10 text-white hover:bg-white/20"
                onClick={() => setShowLightbox(false)}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center justify-center min-h-[70vh] p-8">
                <img
                  src={selectedEvidence.url}
                  alt={selectedEvidence.caption || 'Evidencia'}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              </div>
              {selectedEvidence.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                  <p className="text-white text-sm">{selectedEvidence.caption}</p>
                  <p className="text-white/60 text-xs mt-1">
                    {format(selectedEvidence.uploadedAt, "dd/MM/yyyy HH:mm", { locale: es })} • {selectedEvidence.uploadedBy}
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
