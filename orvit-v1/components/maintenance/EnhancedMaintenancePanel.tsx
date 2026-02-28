'use client';

// ✅ OPTIMIZACIÓN: Desactivar logs en producción
const DEBUG = false;
const log = DEBUG ? (...args: unknown[]) => { /* debug */ } : () => {};

import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
 DialogBody,
 DialogFooter,
} from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { 
 Calendar, 
 Clock, 
 AlertTriangle, 
 CheckCircle, 
 TrendingUp, 
 TrendingDown,
 Filter,
 Search,
 Plus,
 Eye,
 Edit,
 BarChart3,
 Settings,
 FileText,
 Wrench,
 Timer,
 Target,
 DollarSign,
 Activity,
 Layers,
 ChartColumn,
 AlertCircle,
 CheckCircle2,
 XCircle,
 Zap,
 CheckSquare,
 Cog,
 Trash2,
 PlayCircle,
 ListTodo,
 Circle,
 Check,
 RefreshCw,
 CalendarDays,
 Printer,
 X,
 CalendarIcon,
 Building,
 User,
 SquarePen,
 List,
 Play,
 Copy,
 Menu
} from 'lucide-react';
import { cn, stripHtmlTags, formatNumber } from '@/lib/utils';
// Lazy-loaded dialogs: solo se cargan cuando el usuario los abre
const PreventiveMaintenanceDialog = lazy(() => import('../work-orders/PreventiveMaintenanceDialog'));
const CorrectiveMaintenanceDialog = lazy(() => import('../work-orders/CorrectiveMaintenanceDialog'));
const FailureRegistrationDialog = lazy(() => import('../failures/FailureRegistrationDialog'));
const LoadSolutionDialog = lazy(() => import('../failures/LoadSolutionDialog'));
const PredictiveMaintenanceDialog = lazy(() => import('../work-orders/PredictiveMaintenanceDialog'));
const UnidadMovilMaintenanceDialog = lazy(() => import('./UnidadMovilMaintenanceDialog'));
const ChecklistManagementDialog = lazy(() => import('./ChecklistManagementDialog'));
import MaintenanceTypeSelector from './MaintenanceTypeSelector';
import AssetTypeSelector from './AssetTypeSelector';
import { MaintenanceDashboardProvider, useMaintenanceDashboardContext } from '@/contexts/MaintenanceDashboardContext'; // ✨ OPTIMIZACIÓN v2
import { useSectors } from '@/hooks/use-sectors'; // ✨ OPTIMIZACIÓN: Sectores centralizados
import { useMaintenanceCompleted, useChecklists } from '@/hooks/mantenimiento'; // ✨ OPTIMIZACIÓN: Hooks centralizados
const ChecklistExecutionDialog = lazy(() => import('./ChecklistExecutionDialog'));
const ChecklistExecutionTableDialog = lazy(() => import('./ChecklistExecutionTableDialog'));
const MaintenanceDetailDialog = lazy(() => import('./MaintenanceDetailDialog'));
const ExecuteMaintenanceDialog = lazy(() => import('./ExecuteMaintenanceDialog'));
const ManualMaintenanceCompletionDialog = lazy(() => import('./ManualServiceCompletionDialog'));
const DeleteChecklistDialog = lazy(() => import('./DeleteChecklistDialog'));
const ReExecuteChecklistDialog = lazy(() => import('./ReExecuteChecklistDialog'));
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import ChecklistHistoryTab from './ChecklistHistoryTab';
const ChecklistDetailDialog = lazy(() => import('./ChecklistDetailDialog'));
import { generateChecklistPrintContent as sharedGenerateChecklistPrintContent } from '@/lib/checklist-print-utils';
import { 
 MaintenanceKPIs, 
 EnhancedWorkOrder, 
 MaintenanceHistory, 
 MaintenanceChecklist,
 ExecutionWindow,
 TimeUnit,
 ChecklistFrequency
} from '@/lib/types';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { toast } from '@/hooks/use-toast';
import { 
 shouldResetChecklist, 
 getNextResetDate, 
 getFrequencyLabel, 
 formatLastExecution 
} from '@/lib/checklist-utils';
const MaintenanceFilterModal = lazy(() => import('./MaintenanceFilterModal'));
import MaintenanceScreenView from './MaintenanceScreenView';
import MaintenanceCalendar from './MaintenanceCalendar';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import { useGlobalCache, createCacheKey } from '@/hooks/use-global-cache';

const buildItemKey = (item: { id: any; type?: any }) => `${item.id}-${item.type ?? ''}`;

const mergeItemsUnique = <T extends { id: any; type?: any }>(
 current: T[],
 incoming: T[]
) => {
 if (!incoming.length) {
 return current;
 }

 const existingKeys = new Set(current.map(buildItemKey));
 const merged = [...current];

 for (const item of incoming) {
 const key = buildItemKey(item);
 if (!existingKeys.has(key)) {
 existingKeys.add(key);
 merged.push(item);
 }
 }

 return merged;
};

// Tipo personalizado para el historial que viene del API
interface MaintenanceHistoryItem {
 id: string;
 maintenanceId: number;
 maintenanceType: 'PREVENTIVE' | 'CORRECTIVE';
 title?: string;
 description?: string;
 machineId?: number;
 machineName?: string;
 assignedToId?: number;
 assignedToName?: string;
 executedAt: string;
 actualDuration?: number;
 actualValue?: number;
 actualUnit?: string;
 estimatedDuration?: number;
 estimatedValue?: number;
 efficiency?: number;
 variance?: number;
 mttr?: number;
 cost?: number;
 notes?: string;
 issues?: string;
 qualityScore?: number;
 completionStatus?: 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED' | 'RESCHEDULED';
 componentIds?: number[];
 subcomponentIds?: number[];
 executedById?: number;
 companyId?: number;
 createdAt?: string;
 updatedAt?: string;
 isFromChecklist?: boolean;
 checklistId?: string;
 newDate?: string;
 originalDate?: string;
 rescheduleReason?: string;
}

interface EnhancedMaintenancePanelProps {
 machineId?: number;
 sectorId?: number;
 companyId: number;
 machineName?: string;
 sectorName?: string;
 initialMaintenanceId?: number; // Para abrir un mantenimiento específico automáticamente
}

/**
 * ✨ WRAPPER: Provee el contexto del dashboard para todo el panel
 * Garantiza 1 solo request al dashboard sin importar cuántos subcomponentes lo usen
 */
export default function EnhancedMaintenancePanel({
 machineId,
 sectorId,
 companyId,
 machineName,
 sectorName,
 initialMaintenanceId
}: EnhancedMaintenancePanelProps) {
 // ✅ Si no hay companyId o sectorId, mostrar mensaje
 if (!companyId || !sectorId) {
 return (
 <div className="flex items-center justify-center h-full p-8">
 <div className="text-center">
 <p className="text-sm text-muted-foreground">
 Selecciona una empresa y sector para ver el panel de mantenimiento
 </p>
 </div>
 </div>
 );
 }

 // ✅ Envolver todo el contenido con el Provider
 return (
 <MaintenanceDashboardProvider companyId={companyId} sectorId={sectorId}>
 <EnhancedMaintenancePanelContent
 machineId={machineId}
 sectorId={sectorId}
 companyId={companyId}
 machineName={machineName}
 sectorName={sectorName}
 initialMaintenanceId={initialMaintenanceId}
 />
 </MaintenanceDashboardProvider>
 );
}

/**
 * ✨ CONTENIDO: Panel principal de mantenimiento
 * Usa el contexto del dashboard en lugar de hacer fetches directos
 */
function EnhancedMaintenancePanelContent({
 machineId,
 sectorId,
 companyId,
 machineName,
 sectorName,
 initialMaintenanceId
}: EnhancedMaintenancePanelProps) {
 
 // Debug logs removed for cleaner console
 
 const { currentCompany } = useCompany();
 const { user } = useAuth();
 const cache = useGlobalCache();
 
 // ✨ OPTIMIZACIÓN v2: Usar contexto del dashboard (NO hace fetch, solo lee)
 const { 
 data: dashboardData, 
 isLoading: dashboardLoading,
 isError: dashboardError,
 refresh: refetchDashboard 
 } = useMaintenanceDashboardContext();
 
 // Permisos de Mantenimientos
 const { hasPermission: canCreateMaintenance } = usePermissionRobust('preventive_maintenance.create');
 const { hasPermission: canCreateChecklist } = usePermissionRobust('preventive_maintenance.create');
 const { hasPermission: canExecuteMaintenance } = usePermissionRobust('preventive_maintenance.complete');
 const { hasPermission: canEditMaintenance } = usePermissionRobust('preventive_maintenance.edit');
 const { hasPermission: canDeleteMaintenance } = usePermissionRobust('preventive_maintenance.delete');
 const { hasPermission: canDuplicateMaintenance } = usePermissionRobust('preventive_maintenance.create');
 const { hasPermission: canEditChecklist } = usePermissionRobust('preventive_maintenance.edit');
 const { hasPermission: canDeleteChecklist } = usePermissionRobust('preventive_maintenance.delete');
 
 // log('EnhancedMaintenancePanel props:', {
 // machineId,
 // sectorId,
 // companyId,
 // machineName,
 // sectorName
 // });
 const [activeTab, setActiveTab] = useState('overview');
 
 // ✨ OPTIMIZACIÓN: Estados derivados del dashboard (en lugar de fetches separados)
 // Mantener estados locales para compatibilidad con código existente
 const [pendingMaintenances, setPendingMaintenances] = useState<EnhancedWorkOrder[]>([]);
 const [completedMaintenances, setCompletedMaintenances] = useState<EnhancedWorkOrder[]>([]);
 const [completedTodayMaintenances, setCompletedTodayMaintenances] = useState<EnhancedWorkOrder[]>([]);
 const [rescheduledMaintenances, setRescheduledMaintenances] = useState<EnhancedWorkOrder[]>([]);
 const [allMaintenances, setAllMaintenances] = useState<EnhancedWorkOrder[]>([]);
 const [forceRender, setForceRender] = useState<number>(0);
 const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistoryItem[]>([]);
 const [historySearchTerm, setHistorySearchTerm] = useState('');
 const [checklistSearchTerm, setChecklistSearchTerm] = useState('');
 const [historySuggestions, setHistorySuggestions] = useState<Array<{title: string, machineName: string, id: string, isUnidadMovil: boolean}>>([]);
 const [allHistorySuggestions, setAllHistorySuggestions] = useState<Array<{title: string, machineName: string, id: string, isUnidadMovil: boolean}>>([]);
 const [selectedHistoryItems, setSelectedHistoryItems] = useState<string[]>([]);
 const [showSuggestions, setShowSuggestions] = useState(false);
 const [filteredHistory, setFilteredHistory] = useState<MaintenanceHistoryItem[]>([]);
 const [checklists, setChecklists] = useState<MaintenanceChecklist[]>([]);
 const [kpis, setKpis] = useState<MaintenanceKPIs | null>(null);
 const historyList = useMemo(() => {
 if (selectedHistoryItems.length > 0) {
 return filteredHistory;
 }
 if (historySearchTerm) {
 return filteredHistory;
 }
 return maintenanceHistory;
 }, [selectedHistoryItems, filteredHistory, maintenanceHistory, historySearchTerm]);

 // Filtrar checklists por nombre o ID
 const filteredChecklists = useMemo(() => {
 if (!checklistSearchTerm.trim()) {
 return checklists;
 }
 const searchLower = checklistSearchTerm.toLowerCase().trim();
 return checklists.filter(checklist => {
 const titleMatch = checklist.title?.toLowerCase().includes(searchLower);
 const idMatch = checklist.id.toString().includes(searchLower);
 return titleMatch || idMatch;
 });
 }, [checklists, checklistSearchTerm]);

 // Calcular métricas de KPIs para la pestaña Pendientes
 const pendingKPIs = useMemo(() => {
 const now = new Date();
 now.setHours(0, 0, 0, 0);
 
 const in7Days = new Date(now);
 in7Days.setDate(in7Days.getDate() + 7);
 
 let overdue = 0;
 let dueToday = 0;
 let next7Days = 0;
 let backlog = 0;
 
 pendingMaintenances.forEach(maintenance => {
 // Usar nextMaintenanceDate o scheduledDate, lo que esté disponible
 const maintenanceDate = maintenance.nextMaintenanceDate 
 ? new Date(maintenance.nextMaintenanceDate)
 : maintenance.scheduledDate 
 ? new Date(maintenance.scheduledDate)
 : null;
 
 if (!maintenanceDate || isNaN(maintenanceDate.getTime())) {
 backlog++; // Sin fecha = backlog
 return;
 }
 
 maintenanceDate.setHours(0, 0, 0, 0);
 const daysDiff = Math.floor((maintenanceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
 
 if (daysDiff < 0) {
 overdue++;
 } else if (daysDiff === 0) {
 dueToday++;
 } else if (daysDiff <= 7) {
 next7Days++;
 } else {
 backlog++;
 }
 });
 
 return { overdue, dueToday, next7Days, backlog };
 }, [pendingMaintenances]);

 const [loading, setLoading] = useState(false);
 // Estados para rastrear si los datos iniciales ya se cargaron
 const [pendingDataLoaded, setPendingDataLoaded] = useState(false);
 const [completedDataLoaded, setCompletedDataLoaded] = useState(false);
 const [checklistsDataLoaded, setChecklistsDataLoaded] = useState(false);
 
 // Estado para período seleccionado en Resumen (días hacia atrás desde hoy)
 const [summaryPeriodDays, setSummaryPeriodDays] = useState<number>(30); // 30 días por defecto
 
 // Estado para mostrar/ocultar KPIs en la pestaña Pendientes
 const [showKPIs, setShowKPIs] = useState(false);
 
 // Estado para mostrar/ocultar KPIs en la pestaña Completados
 const [showCompletedKPIs, setShowCompletedKPIs] = useState(false);
 
 // Estado para mostrar/ocultar KPIs en la pestaña Todos
 const [showAllKPIs, setShowAllKPIs] = useState(false);
 
 // Estado para período seleccionado en Historial (días hacia atrás desde hoy)
 const [historyPeriodDays, setHistoryPeriodDays] = useState<number>(30); // 30 días por defecto
 
 // Estado para mostrar/ocultar KPIs en la pestaña Historial
 const [showHistoryKPIs, setShowHistoryKPIs] = useState(false);
 
 // Estado para período seleccionado en Estadísticas (días hacia atrás desde hoy)
 const [analyticsPeriodDays, setAnalyticsPeriodDays] = useState<number>(30); // 30 días por defecto
 
 // ✅ OPTIMIZACIÓN: Dashboard se usa SOLO para KPIs (no para listas)
 // Las listas siguen usando sus fetches individuales para máxima compatibilidad
 useEffect(() => {
 if (dashboardData && !dashboardLoading) {
 // ✅ SOLO sincronizar KPIs desde el dashboard
 if (dashboardData.kpis) {
 const safeKpis = {
 total: dashboardData.kpis.total || 0,
 completed: dashboardData.kpis.completed || 0,
 pending: dashboardData.kpis.pending || 0,
 overdue: dashboardData.kpis.overdue || 0,
 completionRate: dashboardData.kpis.completionRate || 0,
 onTimeRate: dashboardData.kpis.onTimeRate || 0,
 avgCompletionTime: dashboardData.kpis.avgCompletionTime || 0,
 avgMTTR: (dashboardData.kpis as any).avgMTTR || 0, // Tiempo promedio de reparación
 avgMTBF: (dashboardData.kpis as any).avgMTBF || 0, // Tiempo promedio entre fallas
 uptime: (dashboardData.kpis as any).uptime || 100,
 period: dashboardData.kpis.period || { start: '', end: '' }
 };
 setKpis(safeKpis as any);
 }
 
 // Sincronizar máquinas y unidades móviles desde dashboard
 if (dashboardData.machines && Array.isArray(dashboardData.machines)) {
 setAvailableMachines(dashboardData.machines);
 }
 
 if (dashboardData.mobileUnits && Array.isArray(dashboardData.mobileUnits)) {
 setAvailableUnidadesMoviles(dashboardData.mobileUnits);
 }
 
 // Inicializar contadores con datos del dashboard
 if (dashboardData.pending && Array.isArray(dashboardData.pending)) {
 setPendingMaintenances(dashboardData.pending as any);
 setPendingDataLoaded(true);
 } else if (dashboardData && !dashboardLoading) {
 setPendingDataLoaded(true);
 }
 
 if (dashboardData.completedToday && Array.isArray(dashboardData.completedToday) && dashboardData.completedToday.length > 0) {
 setCompletedTodayMaintenances(dashboardData.completedToday as any);
 setCompletedDataLoaded(true);
 }
 }
 }, [dashboardData, dashboardLoading]);

 const [checklistsPage, setChecklistsPage] = useState(0);
 const [hasMoreChecklists, setHasMoreChecklists] = useState(true);
 const [loadingMoreChecklists, setLoadingMoreChecklists] = useState(false);
 const checklistsContainerRef = useRef<HTMLDivElement>(null);
 const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

 const PAGE_SIZE = 50;
 const INFINITE_SCROLL_SPACER = 1200;

 const [pendingPage, setPendingPage] = useState(0);
 const [pendingHasMore, setPendingHasMore] = useState(true);
 const [pendingLoadingMore, setPendingLoadingMore] = useState(false);

 const [completedPage, setCompletedPage] = useState(0);
 const [completedHasMore, setCompletedHasMore] = useState(true);
 const [completedLoadingMore, setCompletedLoadingMore] = useState(false);

 const [allPage, setAllPage] = useState(0);
 const [allHasMore, setAllHasMore] = useState(true);
 const [allLoadingMore, setAllLoadingMore] = useState(false);

 const [historyPage, setHistoryPage] = useState(0);
 const [historyHasMore, setHistoryHasMore] = useState(true);
 const [historyLoadingMore, setHistoryLoadingMore] = useState(false);

 const [pendingTailHeight, setPendingTailHeight] = useState(0);
 const [completedTailHeight, setCompletedTailHeight] = useState(0);
 const [allTailHeight, setAllTailHeight] = useState(0);
 const [historyTailHeight, setHistoryTailHeight] = useState(0);
 const [checklistsTailHeight, setChecklistsTailHeight] = useState(0);

 const pendingLoadMoreRef = useRef<HTMLDivElement | null>(null);
 const completedLoadMoreRef = useRef<HTMLDivElement | null>(null);
 const allLoadMoreRef = useRef<HTMLDivElement | null>(null);
 const historyLoadMoreRef = useRef<HTMLDivElement | null>(null);
 
 const updateHistorySuggestions = useCallback(
 (executions: MaintenanceHistoryItem[]) => {
 const suggestionMap = new Map<
 string,
 { title: string; machineName: string; id: string; isUnidadMovil: boolean }
 >();

 executions.forEach((exec) => {
 if (exec.title && exec.id) {
 const assetName = exec.machineName || 'Sin especificar';
 const key = `${exec.title}-${assetName}`;
 if (!suggestionMap.has(key)) {
 suggestionMap.set(key, {
 title: exec.title,
 machineName: assetName,
 id: String(exec.id),
 isUnidadMovil: false
 });
 }
 }
 });

 const uniqueSuggestions = Array.from(suggestionMap.values());
 setAllHistorySuggestions(uniqueSuggestions);
 setHistorySuggestions(uniqueSuggestions);
 },
 []
 );

 // Estados para vista en pantalla
 const [showMaintenanceScreen, setShowMaintenanceScreen] = useState(false);
 const [maintenanceScreenData, setMaintenanceScreenData] = useState<any>(null);
 
 
 // Filtros
 const [filters, setFilters] = useState({
 status: 'all',
 priority: 'all',
 type: 'all',
 frequency: 'all',
 dateRange: '30',
 searchTerm: '',
 selectedMachines: [] as string[],
 selectedUnidadesMoviles: [] as string[],
 assetTypeFilter: [] as string[],
 startDate: '',
 endDate: ''
 });

 // Estado separado para el input de búsqueda
 const [searchInput, setSearchInput] = useState('');

 // Estado para filtro de sector/sección (declarado antes de los useEffect que lo usan)
 // Inicializar con el sectorId prop si está disponible, de lo contrario undefined
 const [selectedSectorFilter, setSelectedSectorFilter] = useState<number | undefined>(sectorId);
 
 // Verificar si el usuario es administrador
 const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
 
 // ✅ OPTIMIZACIÓN: Hook centralizado de sectores (cache de 5 min, deduplicación automática)
 const { sectors: availableSectors, isLoading: sectorsLoading } = useSectors(companyId, { enabled: isAdmin });
 
 // Obtener el sectorId del usuario (si no es administrador)
 const userSectorId = user?.sectorId || null;

 // Estados para filtros específicos (definidos antes de los hooks)
 const [completedTimeFilter, setCompletedTimeFilter] = useState('today'); // 'today', 'week', 'month', 'all'
 const [pendingSortOrder, setPendingSortOrder] = useState('oldest'); // 'oldest', 'newest', 'priority'

 // Helper para obtener rango de frecuencia (definido antes de los hooks)
 const getFrequencyRange = (frequencyFilter: string) => {
 switch (frequencyFilter) {
 case 'daily': return { minDays: 1, maxDays: 1 };
 case 'weekly': return { minDays: 2, maxDays: 7 };
 case 'biweekly': return { minDays: 8, maxDays: 15 };
 case 'monthly': return { minDays: 16, maxDays: 30 };
 case 'quarterly': return { minDays: 31, maxDays: 90 };
 case 'semiannual': return { minDays: 91, maxDays: 180 };
 case 'yearly': return { minDays: 181, maxDays: 365 };
 default: return null;
 }
 };

 // ✨ OPTIMIZACIÓN: Hooks React Query para evitar duplicados
 const frequencyRange = filters.frequency !== 'all' ? getFrequencyRange(filters.frequency) : null;
 const isPendingTabActive = activeTab === 'pending' || activeTab === 'overview';
 const isCompletedTabActive = activeTab === 'completed-today';
 const isChecklistsTabActive = activeTab === 'checklists';

 // ✨ UNIFICACIÓN: Usar allMaintenances para ambos tabs 'pending' y 'all'
 // Filtrar en el frontend para mostrar solo pendientes cuando activeTab === 'pending'
 const displayedMaintenances = useMemo(() => {
 if (activeTab === 'pending') {
 // Filtrar solo pendientes de allMaintenances (status === 'PENDING')
 return allMaintenances.filter(m => m.status === 'PENDING');
 }
 // Para 'all', mostrar todos
 return allMaintenances;
 }, [allMaintenances, activeTab]);

 // ❌ ELIMINADO: useMaintenancePending - ahora usamos fetchAllMaintenances para ambos tabs
 // Los datos se filtran en el frontend con displayedMaintenances

 const completedTodayQuery = useMaintenanceCompleted({
 companyId,
 sectorId: selectedSectorFilter,
 machineId: machineId || null,
 todayOnly: true,
 priority: filters.priority !== 'all' ? filters.priority : undefined,
 type: filters.type !== 'all' ? filters.type : undefined,
 machineIds: !machineId && filters.selectedMachines.length > 0 ? filters.selectedMachines.join(',') : undefined,
 unidadMovilIds: !machineId && filters.selectedUnidadesMoviles.length > 0 ? filters.selectedUnidadesMoviles.join(',') : undefined,
 searchTerm: filters.searchTerm || undefined,
 minFrequencyDays: frequencyRange?.minDays,
 maxFrequencyDays: frequencyRange?.maxDays,
 page: 0,
 pageSize: PAGE_SIZE,
 enabled: isCompletedTabActive && !!companyId, // Siempre habilitado cuando el tab está activo
 staleTime: 30 * 1000
 });

 const checklistsQuery = useChecklists({
 companyId,
 sectorId: selectedSectorFilter,
 machineId: machineId || null,
 skip: 0,
 take: 10,
 enabled: isChecklistsTabActive && !!companyId, // Siempre habilitado cuando el tab está activo
 staleTime: 60 * 1000
 });

 // ❌ ELIMINADO: Sincronización de pendingQuery - ahora usamos allMaintenances directamente

 useEffect(() => {
 if (completedTodayQuery.data && isCompletedTabActive) {
 const data = completedTodayQuery.data;
 const incoming: EnhancedWorkOrder[] = data.maintenances || [];
 // Solo actualizar si es la primera página (para evitar sobrescribir infinite scroll)
 if (completedPage === 0 || completedTodayMaintenances.length === 0) {
 setCompletedTodayMaintenances(incoming);
 setCompletedHasMore(data.pagination?.hasMore ?? incoming.length === PAGE_SIZE);
 setCompletedPage(0);
 setCompletedDataLoaded(true);
 setCompletedTailHeight(0);
 }
 }
 }, [completedTodayQuery.data, isCompletedTabActive, completedPage]);

 useEffect(() => {
 if (checklistsQuery.data && isChecklistsTabActive) {
 const data = checklistsQuery.data;
 const checklistsArray = data.checklists || data || [];
 // Solo actualizar si es la primera carga (para evitar sobrescribir infinite scroll)
 if (checklistsPage === 0 || checklists.length === 0) {
 setChecklists(checklistsArray);
 setChecklistsPage(1);
 setChecklistsTailHeight(0);
 setChecklistsDataLoaded(true);
 setHasMoreChecklists(data.hasMore !== false && checklistsArray.length === 10);
 }
 }
 }, [checklistsQuery.data, isChecklistsTabActive, checklistsPage]);

 // Debounce para el buscador
 useEffect(() => {
 const timeoutId = setTimeout(() => {
 setFilters(prev => ({ ...prev, searchTerm: searchInput }));
 }, 500);
 
 return () => clearTimeout(timeoutId);
 }, [searchInput]);

 // Resetear el buscador cuando cambian los props principales
 useEffect(() => {
 setSearchInput('');
 setFilters(prev => ({ ...prev, searchTerm: '' }));
 }, [machineId, companyId, selectedSectorFilter]);

 // Estados para modales
 const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
 const [isAssetTypeSelectorOpen, setIsAssetTypeSelectorOpen] = useState(false);
 const [isUnidadMovilMaintenanceDialogOpen, setIsUnidadMovilMaintenanceDialogOpen] = useState(false);
 const [isPreventiveDialogOpen, setIsPreventiveDialogOpen] = useState(false);
 const [isCorrectiveDialogOpen, setIsCorrectiveDialogOpen] = useState(false);
 const [isPredictiveDialogOpen, setIsPredictiveDialogOpen] = useState(false);
 const [isFailureDialogOpen, setIsFailureDialogOpen] = useState(false);
 const [isLoadSolutionDialogOpen, setIsLoadSolutionDialogOpen] = useState(false);
 const [isChecklistDialogOpen, setIsChecklistDialogOpen] = useState(false);
 const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
 const [selectedMaintenance, setSelectedMaintenance] = useState(null);
 const [editingMaintenance, setEditingMaintenance] = useState(null);
 const [selectedUnidadForMaintenance, setSelectedUnidadForMaintenance] = useState(null);
 const [failureData, setFailureData] = useState(null);
 const [editingChecklist, setEditingChecklist] = useState(null);
 const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
 
 // Estados para ejecución de checklists
 const [isExecutionDialogOpen, setIsExecutionDialogOpen] = useState(false);
 const [isTableExecutionDialogOpen, setIsTableExecutionDialogOpen] = useState(false);
 const [checklistToExecute, setChecklistToExecute] = useState(null);
 
 // Estados para duplicación de mantenimientos
 const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
 const [maintenanceToDuplicate, setMaintenanceToDuplicate] = useState<any>(null);
 const [selectedMachineForDuplicate, setSelectedMachineForDuplicate] = useState<number | null>(null);
 const [selectedUnidadForDuplicate, setSelectedUnidadForDuplicate] = useState<number | null>(null);
 
 // Estados para el nuevo flujo de selección
 const [selectedAsset, setSelectedAsset] = useState<{
 type: 'unidad-movil' | 'maquina';
 id: number;
 name: string;
 } | null>(null);
 
 // Estados para eliminación
 const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
 const [maintenanceToDelete, setMaintenanceToDelete] = useState(null);
 const [isDeleting, setIsDeleting] = useState(false);
 
 // Estados para eliminación de checklists
 const [isDeleteChecklistDialogOpen, setIsDeleteChecklistDialogOpen] = useState(false);
 const [checklistToDelete, setChecklistToDelete] = useState(null);
 
 // Estados para re-ejecución de checklists
 const [isReExecuteChecklistDialogOpen, setIsReExecuteChecklistDialogOpen] = useState(false);
 const [checklistToReExecute, setChecklistToReExecute] = useState(null);
 
 // Estados para detalles del checklist
 const [isChecklistDetailDialogOpen, setIsChecklistDetailDialogOpen] = useState(false);
 const [checklistToShowDetails, setChecklistToShowDetails] = useState(null);
 
 // Estados para carga manual de servicios
 const [isManualServiceDialogOpen, setIsManualServiceDialogOpen] = useState(false);
 
 // Estados para filtro de máquinas
 const [availableMachines, setAvailableMachines] = useState<any[]>([]);
 const [availableUnidadesMoviles, setAvailableUnidadesMoviles] = useState<any[]>([]);
 const [isMachineFilterOpen, setIsMachineFilterOpen] = useState(false);
 const [machineFilterMode, setMachineFilterMode] = useState<'individual' | 'category'>('individual');
 
 // Estados para PDF de mantenimientos
 const [isPDFFilterOpen, setIsPDFFilterOpen] = useState(false);
 const [filterModalMode, setFilterModalMode] = useState<'list' | 'filter'>('list');
 
 // Estado para refrescar el historial de checklists
 const [checklistHistoryRefreshTrigger, setChecklistHistoryRefreshTrigger] = useState(0);

 // Estado para trackear si ya se procesó el mantenimiento inicial
 const [initialMaintenanceProcessed, setInitialMaintenanceProcessed] = useState(false);

 // useEffect para abrir automáticamente un mantenimiento específico si viene por URL
 useEffect(() => {
 if (initialMaintenanceId && !initialMaintenanceProcessed && allMaintenances.length > 0) {
 const maintenance = allMaintenances.find(m => m.id === initialMaintenanceId);
 if (maintenance) {
 setSelectedMaintenance(maintenance as any);
 setIsDetailDialogOpen(true);
 setInitialMaintenanceProcessed(true);
 }
 }
 }, [initialMaintenanceId, allMaintenances, initialMaintenanceProcessed]);

 // Reset del estado cuando cambia el initialMaintenanceId
 useEffect(() => {
 if (initialMaintenanceId) {
 setInitialMaintenanceProcessed(false);
 }
 }, [initialMaintenanceId]);

 // Estado para el modal de filtros
 const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);
 
 // Estado temporal para los filtros en el modal
 const [tempFilters, setTempFilters] = useState({
 status: 'all',
 priority: 'all',
 type: 'all',
 frequency: 'all',
 dateRange: '30',
 searchTerm: '',
 selectedMachines: [] as string[],
 selectedUnidadesMoviles: [] as string[],
 assetTypeFilter: [] as string[],
 startDate: '',
 endDate: ''
 });

 // Estados para búsqueda y filtros en equipos (modal de filtros)
 const [equipmentSearchTerm, setEquipmentSearchTerm] = useState('');
 const [equipmentTab, setEquipmentTab] = useState<'machines' | 'mobile'>('machines');
 const [equipmentStatusFilter, setEquipmentStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
 const [showSummarySheet, setShowSummarySheet] = useState(false);
 const [activeFilterSection, setActiveFilterSection] = useState<'equipment' | 'type' | 'status' | 'dates' | 'priority' | 'frequency'>('equipment');
 


 // Estados para ejecución de mantenimiento
 const [isExecuteDialogOpen, setIsExecuteDialogOpen] = useState(false);
 const [maintenanceToExecute, setMaintenanceToExecute] = useState(null);
 const [isExecuting, setIsExecuting] = useState(false);

 // ❌ ELIMINADO: fetchSectors() → Ahora usa hook centralizado useSectors()
 // Los sectores se cargan automáticamente con cache de 5 minutos

 // Auto-filtrar por sector del usuario si no es administrador (solo una vez al cargar)
 const hasAutoFilteredRef = useRef(false);
 const userSectorIdRef = useRef<number | null>(null);
 
 // Actualizar la referencia cuando cambia el userSectorId
 useEffect(() => {
 userSectorIdRef.current = userSectorId;
 }, [userSectorId]);
 
 // Actualizar el filtro cuando cambia el sectorId prop
 useEffect(() => {
 if (sectorId !== undefined) {
 setSelectedSectorFilter(sectorId);
 }
 }, [sectorId]);
 
 useEffect(() => {
 // Solo auto-filtrar una vez cuando se carga el componente
 if (!hasAutoFilteredRef.current) {
 if (sectorId !== undefined) {
 hasAutoFilteredRef.current = true;
 } else if (!isAdmin && userSectorIdRef.current) {
 setSelectedSectorFilter(userSectorIdRef.current);
 hasAutoFilteredRef.current = true;
 } else if (isAdmin) {
 hasAutoFilteredRef.current = true;
 }
 }
 }, [isAdmin, sectorId]); // Incluir sectorId en las dependencias

 // ❌ DESACTIVADO: fetchMaintenanceData() automático en el mount
 // Las listas ahora se cargan bajo demanda (al cambiar de pestaña o usar filtros)
 // useEffect(() => {
 // fetchMaintenanceData();
 // }, [machineId, selectedSectorFilter, companyId, filters, completedTimeFilter, pendingSortOrder]);

 // ✅ OPTIMIZADO: Cargar datos según la pestaña activa (evita duplicados)
 // ✨ Los hooks React Query ahora manejan la primera carga automáticamente
 useEffect(() => {
 if (!companyId) return;
 
 // Cuando cambia el tab, resetear el flag para forzar sincronización
 // Esto asegura que los datos del hook se sincronicen con el estado local
 switch (activeTab) {
 case 'pending':
 case 'all':
 // ✨ Usar la misma llamada para ambos tabs - no duplicar requests
 // Los datos se filtrarán en el frontend para mostrar solo pendientes cuando activeTab === 'pending'
 // Asegurar que siempre se carguen todos los mantenimientos (incluyendo unidades móviles)
 // forceAllStatus=true para traer todos los estados y no filtrar por status
 if (allMaintenances.length === 0) {
 fetchAllMaintenances(0, false, true);
 }
 break;
 case 'overview':
 // También cargar completados para contadores en overview usando el hook
 if (completedTodayMaintenances.length === 0 && !completedDataLoaded) {
 completedTodayQuery.refetch();
 }
 // Cargar todos los mantenimientos si no están cargados (para el contador de pendientes)
 // forceAllStatus=true para traer todos los estados
 if (allMaintenances.length === 0) {
 fetchAllMaintenances(0, false, true);
 }
 break;
 case 'completed-today':
 // Resetear flag para forzar sincronización cuando cambias a este tab
 if (!completedDataLoaded) {
 setCompletedDataLoaded(false);
 }
 break;
 case 'history':
 if (maintenanceHistory.length === 0) {
 fetchMaintenanceHistory();
 }
 break;
 case 'checklists':
 // Resetear flag para forzar sincronización cuando cambias a este tab
 if (!checklistsDataLoaded) {
 setChecklistsDataLoaded(false);
 }
 break;
 }
 }, [activeTab, companyId, sectorId]); // Cargar cuando cambia pestaña o contexto
 
 // ✅ ARREGLADO: Recargar cuando cambian filtros
 // ✨ Los hooks React Query se recargan automáticamente cuando cambian los parámetros
 useEffect(() => {
 // Resetear página y flags cuando cambian filtros para que los hooks se vuelvan a ejecutar
 if (isPendingTabActive) {
 setPendingPage(0);
 setPendingMaintenances([]);
 setPendingDataLoaded(false);
 }
 if (isCompletedTabActive) {
 setCompletedPage(0);
 setCompletedTodayMaintenances([]);
 setCompletedDataLoaded(false);
 }
 if (isChecklistsTabActive) {
 setChecklistsPage(0);
 setChecklists([]);
 setChecklistsDataLoaded(false);
 }
 
 // Recargar manualmente solo para tabs que NO tienen hooks
 const hasData = allMaintenances.length > 0 || maintenanceHistory.length > 0;
 
 if (!hasData) return;
 
 // Recargar la pestaña activa (solo para tabs sin hooks)
 switch (activeTab) {
 case 'all':
 fetchAllMaintenances(0, false, true);
 break;
 case 'history':
 fetchMaintenanceHistory();
 break;
 // pending, completed-today, checklists: los hooks se recargan automáticamente
 }
 }, [filters, completedTimeFilter, pendingSortOrder, selectedSectorFilter]);
 
 // ✅ El dashboard se carga automáticamente vía el Provider al montar el componente
 // NO se dispara en cada cambio de filtro, solo cuando cambia company/sector

 // Verificar reinicios automáticos cuando se carga la página
 useEffect(() => {
 if (companyId) {
 checkAndResetChecklists();
 }
 }, [companyId]);

 // Función para filtrar sugerencias y historial localmente
 const filterHistoryLocally = (searchTerm: string) => {
 if (!searchTerm.trim()) {
 setFilteredHistory(maintenanceHistory);
 setShowSuggestions(false);
 return;
 }

 const filtered = maintenanceHistory.filter(history => 
 history.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
 history.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
 history.notes?.toLowerCase().includes(searchTerm.toLowerCase())
 );
 
 setFilteredHistory(filtered);
 
 // Filtrar sugerencias
 const filteredSuggestions = allHistorySuggestions.filter(suggestion =>
 suggestion.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
 suggestion.machineName.toLowerCase().includes(searchTerm.toLowerCase())
 );
 setHistorySuggestions(filteredSuggestions);
 setShowSuggestions(true);
 };

 // Efecto para filtrar localmente cuando cambia el término de búsqueda
 useEffect(() => {
 const timeoutId = setTimeout(() => {
 if (historySearchTerm) {
 filterHistoryLocally(historySearchTerm);
 } else {
 // Si no hay término de búsqueda, cargar todo el historial
 fetchMaintenanceHistory();
 }
 }, 300); // Debounce de 300ms

 return () => clearTimeout(timeoutId);
 }, [historySearchTerm]);

 // Efecto para aplicar filtros cuando cambian las selecciones
 useEffect(() => {
 applySelectedFilters();
 }, [selectedHistoryItems, maintenanceHistory]);

 // Función para seleccionar una sugerencia
 const handleSuggestionSelect = (suggestion: {title: string, machineName: string, id: string, isUnidadMovil: boolean}) => {
 if (selectedHistoryItems.includes(suggestion.id)) {
 // Si ya está seleccionado, lo quitamos
 setSelectedHistoryItems(prev => prev.filter(id => id !== suggestion.id));
 } else {
 // Si no está seleccionado, lo agregamos
 setSelectedHistoryItems(prev => [...prev, suggestion.id]);
 }
 setShowSuggestions(false);
 };

 // Función para limpiar la búsqueda
 const handleClearSearch = () => {
 setHistorySearchTerm('');
 setShowSuggestions(false);
 setFilteredHistory([]);
 setSelectedHistoryItems([]);
 fetchMaintenanceHistory();
 };

 // Función para aplicar filtros basados en selecciones
 const applySelectedFilters = () => {
 if (selectedHistoryItems.length === 0) {
 setFilteredHistory(maintenanceHistory);
 return;
 }

 const filtered = maintenanceHistory.filter(history => 
 selectedHistoryItems.includes(history.id)
 );
 setFilteredHistory(filtered);
 };

 // Función para contar el total de items en un checklist
 const getTotalItemsCount = (checklist: any) => {
 // Si tiene fases, contar items de todas las fases
 if (checklist.phases && checklist.phases.length > 0) {
 return checklist.phases.reduce((total: number, phase: any) => {
 return total + (phase.items?.length || 0);
 }, 0);
 }
 // Si no tiene fases, usar items directos
 return checklist.items?.length || 0;
 };

 // Funciones para manejar modales
 const handleMaintenanceSave = async (data: any) => {
 log('Mantenimiento guardado:', data);
 
 // Si es un mantenimiento correctivo, usar la lógica específica
 if (data.type === 'CORRECTIVE') {
 try {
 // Crear el work order con status COMPLETED ya que es un mantenimiento correctivo
 const completedDate = (() => {
 // Crear fecha en zona horaria de Argentina (UTC-3)
 const now = new Date();
 const argOffset = -3 * 60; // Argentina es UTC-3 (en minutos)
 const argTime = new Date(now.getTime() + (argOffset * 60 * 1000));
 return argTime.toISOString();
 })();
 
 // Creating corrective maintenance
 
 const workOrderData = {
 title: data.title,
 description: data.description,
 priority: data.priority,
 type: 'CORRECTIVE',
 machineId: data.machineId,
 componentId: data.componentIds && data.componentIds.length > 0 ? data.componentIds[0] : null,
 assignedToId: data.assignedToId,
 createdById: data.createdById,
 estimatedHours: data.estimatedHours,
 notes: `${data.notes || ''}\n\nDescripción de la falla: ${data.failureDescription || 'No especificada'}\nCausa raíz: ${data.rootCause || 'No especificada'}\nSolución aplicada: ${data.solution || 'No especificada'}\nFecha de falla: ${data.failureDate || 'No especificada'}`,
 companyId: data.companyId,
 sectorId: data.sectorId,
 status: 'COMPLETED', // Los mantenimientos correctivos se crean como completados
 completedDate: completedDate, // Marcar como completado hoy en zona horaria de Argentina
 actualHours: data.estimatedHours // Usar las horas estimadas como reales
 };

 log('🚀 ENVIANDO REQUEST A work-orders API:', JSON.stringify(workOrderData, null, 2));
 
 const response = await fetch('/api/work-orders', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify(workOrderData)
 });

 if (response.ok) {
 const result = await response.json();
 log('✅ Mantenimiento correctivo creado exitosamente:', result);
 
 // ✨ OPTIMIZACIÓN: Agregar directamente al estado local sin recargar todo
 if (result && result.id) {
 // Formatear el work order para que coincida con el formato de allMaintenances
 const newMaintenance = {
 ...result,
 type: result.type || 'CORRECTIVE',
 isPreventive: false,
 status: result.status || 'COMPLETED',
 assignedToName: result.assignedTo?.name || result.assignedWorker?.name || 'Sin asignar',
 instructives: result.attachments || []
 };
 
 setAllMaintenances(prev => [newMaintenance, ...prev]);
 }
 
 toast({
 title: '✅ Mantenimiento Correctivo Creado',
 description: 'El mantenimiento correctivo se ha registrado exitosamente como completado',
 });
 
 // Solo refrescar el dashboard para actualizar KPIs
 refetchDashboard();
 } else {
 const error = await response.json();
 throw new Error(error.error || 'Error al crear el mantenimiento correctivo');
 }
 } catch (error: any) {
 console.error('Error saving corrective maintenance:', error);
 toast({
 title: 'Error',
 description: error.message || 'No se pudo guardar el mantenimiento correctivo',
 variant: 'destructive'
 });
 return; // No cerrar el modal si hay error
 }
 } else {
 // Para mantenimientos preventivos
 // ✨ OPTIMIZACIÓN: Recargar solo la primera página de allMaintenances para obtener el nuevo
 // El diálogo de preventivo ya maneja la creación, solo necesitamos refrescar
 fetchAllMaintenances(0, false, true).then(() => {
 toast({
 title: '✅ Mantenimiento guardado',
 description: 'El mantenimiento se ha guardado correctamente',
 });
 });
 }
 
 setIsPreventiveDialogOpen(false);
 setIsCorrectiveDialogOpen(false);
 setEditingMaintenance(null);
 };

 const handleChecklistSave = async (data: any) => {
 log('✅ Checklist guardado:', data);
 log('🔍 Estructura completa de data:', JSON.stringify(data, null, 2));
 
 // Manejar diferentes formatos de respuesta (POST devuelve directamente, PUT devuelve { success, checklist })
 const checklist = data.checklist || data;
 
 // Intentar obtener el título de múltiples fuentes
 let checklistTitle = checklist?.title;
 if (!checklistTitle && data.title) {
 checklistTitle = data.title;
 }
 if (!checklistTitle && editingChecklist?.title) {
 checklistTitle = editingChecklist.title;
 }
 if (!checklistTitle) {
 checklistTitle = 'el checklist';
 }
 
 const isEdit = !!data.checklist || !!data.success || !!editingChecklist;
 
 log('🔍 Título final extraído:', checklistTitle);
 log('🔍 Es edición?', isEdit);
 
 // ✨ Refrescar usando hook React Query y esperar
 await checklistsQuery.refetch();
 toast({
 title: isEdit ? 'Checklist Actualizado' : 'Checklist Creado',
 description: `El checklist "${checklistTitle}" se ha ${isEdit ? 'actualizado' : 'creado'} exitosamente`,
 });
 // No llamar a refetchDashboard() aquí porque refresca los pendientes y los limpia
 setIsChecklistDialogOpen(false);
 setEditingChecklist(null);
 };

 const handleDeleteChecklist = (checklist: any) => {
 setChecklistToDelete(checklist);
 setIsDeleteChecklistDialogOpen(true);
 };

 const handlePrintChecklist = async (checklist: any) => {
 log('🖨️ [PRINT] Iniciando impresión del checklist desde EnhancedMaintenancePanel:', {
 checklistId: checklist.id,
 checklistTitle: checklist.title,
 hasPhases: !!checklist.phases,
 hasItems: !!checklist.items
 });

 // Cargar datos de mantenimiento para cada item
 const maintenanceDataMap = new Map<number, any>();
 
 // Recopilar todos los maintenanceIds
 const maintenanceIds: number[] = [];
 if (checklist.phases && checklist.phases.length > 0) {
 checklist.phases.forEach((phase: any) => {
 if (phase.items && phase.items.length > 0) {
 phase.items.forEach((item: any) => {
 if (item.maintenanceId) {
 maintenanceIds.push(item.maintenanceId);
 }
 });
 }
 });
 } else if (checklist.items && checklist.items.length > 0) {
 checklist.items.forEach((item: any) => {
 if (item.maintenanceId) {
 maintenanceIds.push(item.maintenanceId);
 }
 });
 }

 // Cargar datos de mantenimiento
 if (maintenanceIds.length > 0) {
 try {
 const companyIdForPrint = checklist.companyId || companyId || currentCompany?.id;
 if (companyIdForPrint) {
 const response = await fetch(`/api/maintenance/all?companyId=${companyIdForPrint}`);
 if (response.ok) {
 const data = await response.json();
 const maintenances = data.maintenances || [];
 maintenanceIds.forEach(maintenanceId => {
 const maintenance = maintenances.find((m: any) => m.id === maintenanceId);
 if (maintenance) {
 maintenanceDataMap.set(maintenanceId, maintenance);
 }
 });
 }
 }
 } catch (error) {
 console.error('🖨️ [PRINT] Error cargando datos de mantenimiento:', error);
 }
 }

 // Calcular totalItems y totalEstimatedTime
 const totalItems = checklist.phases && checklist.phases.length > 0
 ? checklist.phases.reduce((total: number, phase: any) => total + (phase.items?.length || 0), 0)
 : checklist.items?.length || 0;

 const totalEstimatedTime = checklist.phases && checklist.phases.length > 0
 ? checklist.phases.reduce((total: number, phase: any) => {
 const phaseTime = phase.items.reduce((phaseTotal: number, item: any) => {
 return phaseTotal + (item.estimatedTime || 0);
 }, 0);
 return total + phaseTime;
 }, 0)
 : checklist.items?.reduce((total: number, item: any) => total + (item.estimatedTime || 0), 0) || checklist.estimatedTotalTime || 0;

 try {
 // Generar el contenido HTML para imprimir con los datos de mantenimiento
 // Usar la función actualizada que agrupa por máquina/componente/subcomponente
 const printContent = generateChecklistPrintContent(checklist, totalItems, totalEstimatedTime, maintenanceDataMap);
 
 // Crear un iframe oculto para evitar bloqueo de popups
 const iframe = document.createElement('iframe');
 iframe.style.position = 'fixed';
 iframe.style.right = '0';
 iframe.style.bottom = '0';
 iframe.style.width = '0';
 iframe.style.height = '0';
 iframe.style.border = '0';
 iframe.style.opacity = '0';
 iframe.style.pointerEvents = 'none';
 
 document.body.appendChild(iframe);
 
 // Escribir el contenido en el iframe
 const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
 if (!iframeDoc) {
 throw new Error('No se pudo acceder al documento del iframe');
 }
 
 iframeDoc.open();
 iframeDoc.write(printContent);
 iframeDoc.close();
 
 let hasPrinted = false;
 
 // Función para imprimir (solo una vez)
 const doPrint = () => {
 if (hasPrinted) {
 log('🖨️ [PRINT] Ya se imprimió, ignorando llamada duplicada...');
 return;
 }
 hasPrinted = true;
 try {
 iframe.contentWindow?.focus();
 iframe.contentWindow?.print();
 
 // Remover el iframe después de un tiempo
 setTimeout(() => {
 if (iframe.parentNode) {
 document.body.removeChild(iframe);
 }
 }, 1000);
 } catch (printError) {
 console.error('🖨️ [PRINT] Error al imprimir:', printError);
 if (iframe.parentNode) {
 document.body.removeChild(iframe);
 }
 toast({
 title: 'Error',
 description: 'Error al iniciar la impresión. Intenta usar Ctrl+P manualmente.',
 variant: 'destructive'
 });
 }
 };
 
 // Esperar a que se cargue el contenido y luego imprimir
 iframe.onload = () => {
 doPrint();
 };
 
 // Fallback: si onload no se dispara, intentar imprimir después de un breve delay
 setTimeout(() => {
 if (iframe.parentNode && !hasPrinted) {
 doPrint();
 }
 }, 500);
 
 } catch (error) {
 console.error('🖨️ [PRINT] Error generando contenido:', error);
 toast({
 title: 'Error',
 description: 'Error al generar el contenido para imprimir.',
 variant: 'destructive'
 });
 }
 };

 const handlePrintChecklistExecution = (checklist: any) => {
 // Crear una nueva ventana para imprimir en formato de ejecución
 const printWindow = window.open('', '_blank');
 if (!printWindow) {
 toast({
 title: 'Error',
 description: 'No se pudo abrir la ventana de impresión. Verifica que el bloqueador de popups esté deshabilitado.',
 variant: 'destructive'
 });
 return;
 }

 // Generar el contenido HTML para imprimir en formato de ejecución
 const printContent = generateChecklistExecutionPrintContent(checklist);
 
 printWindow.document.write(printContent);
 printWindow.document.close();
 
 // Esperar a que se cargue el contenido y luego imprimir
 printWindow.onload = () => {
 printWindow.print();
 printWindow.close();
 };
 };

 // Usar la función compartida
 const generateChecklistPrintContent = sharedGenerateChecklistPrintContent;

 const _generateChecklistPrintContent_OLD = (checklist: any, totalItems: number, totalEstimatedTime: number, maintenanceDataMap?: Map<number, any>) => {
 const formatTime = (minutes: number) => {
 if (minutes < 60) {
 return `${minutes} min`;
 }
 const hours = Math.floor(minutes / 60);
 const remainingMinutes = minutes % 60;
 return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
 };

 const getFrequencyLabel = (frequency: string) => {
 const labels: { [key: string]: string } = {
 'DAILY': 'Diario',
 'WEEKLY': 'Semanal',
 'BIWEEKLY': 'Quincenal',
 'MONTHLY': 'Mensual',
 'QUARTERLY': 'Trimestral',
 'SEMIANNUAL': 'Semestral',
 'ANNUAL': 'Anual'
 };
 return labels[frequency] || frequency;
 };

 const getCategoryLabel = (category: string) => {
 const labels: { [key: string]: string } = {
 'SAFETY': 'Seguridad',
 'QUALITY': 'Calidad',
 'PRODUCTION': 'Producción',
 'MAINTENANCE': 'Mantenimiento',
 'CLEANING': 'Limpieza',
 'INSPECTION': 'Inspección'
 };
 return labels[category] || category;
 };

 // Usar los parámetros pasados en lugar de calcularlos
 // totalItems y totalEstimatedTime ya vienen como parámetros

 const currentDate = new Date().toLocaleDateString('es-AR', {
 year: 'numeric',
 month: 'long',
 day: 'numeric'
 });

 // Recopilar todos los items con su información de fase
 const allItems: Array<{ item: any; phaseIndex?: number; itemIndex: number; globalIndex: number }> = [];
 let globalIndex = 0;
 
 if (checklist.phases && checklist.phases.length > 0) {
 checklist.phases.forEach((phase: any, phaseIndex: number) => {
 if (phase.items && phase.items.length > 0) {
 phase.items.forEach((item: any, itemIndex: number) => {
 allItems.push({ item, phaseIndex, itemIndex, globalIndex: globalIndex++ });
 });
 }
 });
 } else if (checklist.items && checklist.items.length > 0) {
 checklist.items.forEach((item: any, index: number) => {
 allItems.push({ item, itemIndex: index, globalIndex: globalIndex++ });
 });
 }

 // Agrupar items por máquina, componente y subcomponente
 const itemsByMachine: { [key: string]: Array<{ item: any; phaseIndex?: number; itemIndex: number; globalIndex: number; machineInfo: any; componentInfo: any; subcomponentInfo: any }> } = {};
 let itemsWithoutMachine: Array<{ item: any; phaseIndex?: number; itemIndex: number; globalIndex: number }> = [];

 const checklistMachine = checklist.machine;

 allItems.forEach((itemData) => {
 const maintenanceId = itemData.item.maintenanceId;
 let machine = null;
 let unidadMovil = null;
 let component = null;
 let subcomponent = null;

 // Intentar obtener información desde el mapa de datos de mantenimiento
 if (maintenanceId && maintenanceDataMap) {
 const maintenanceData = maintenanceDataMap.get(maintenanceId);
 if (maintenanceData) {
 machine = maintenanceData.machine;
 unidadMovil = maintenanceData.unidadMovil;
 
 if (maintenanceData.componentIds && maintenanceData.componentIds.length > 0) {
 if (maintenanceData.component) {
 component = maintenanceData.component;
 } else if (maintenanceData.components && maintenanceData.components.length > 0) {
 component = maintenanceData.components[0];
 } else {
 component = { 
 id: maintenanceData.componentIds[0],
 name: maintenanceData.componentNames?.[0] || `Componente ${maintenanceData.componentIds[0]}`
 };
 }
 }
 
 if (maintenanceData.subcomponentIds && maintenanceData.subcomponentIds.length > 0) {
 if (maintenanceData.subcomponents && maintenanceData.subcomponents.length > 0) {
 subcomponent = maintenanceData.subcomponents[0];
 } else {
 subcomponent = { 
 id: maintenanceData.subcomponentIds[0],
 name: maintenanceData.subcomponentNames?.[0] || `Subcomponente ${maintenanceData.subcomponentIds[0]}`
 };
 }
 }
 }
 }

 if (!machine && !unidadMovil) {
 machine = itemData.item.machine;
 unidadMovil = itemData.item.unidadMovil;
 }
 
 if (!machine && !unidadMovil && itemData.item.maintenanceData) {
 machine = itemData.item.maintenanceData.machine;
 unidadMovil = itemData.item.maintenanceData.unidadMovil;
 }

 if (!machine && !unidadMovil && checklistMachine) {
 machine = checklistMachine;
 }

 const machineKey = machine 
 ? `${machine.id || 'unknown'}_${machine.name || 'Sin nombre'}`
 : unidadMovil
 ? `unidad_${unidadMovil.id || 'unknown'}_${unidadMovil.nombre || 'Sin nombre'}`
 : null;

 const componentKey = component 
 ? `_comp_${component.id || 'unknown'}_${component.name || 'Sin nombre'}`
 : '';

 const subcomponentKey = subcomponent
 ? `_subcomp_${subcomponent.id || 'unknown'}_${subcomponent.name || 'Sin nombre'}`
 : '';

 const fullKey = machineKey ? `${machineKey}${componentKey}${subcomponentKey}` : null;

 if (fullKey) {
 if (!itemsByMachine[fullKey]) {
 itemsByMachine[fullKey] = [];
 }
 itemsByMachine[fullKey].push({ 
 ...itemData, 
 machineInfo: machine || unidadMovil,
 componentInfo: component,
 subcomponentInfo: subcomponent
 });
 } else {
 itemsWithoutMachine.push(itemData);
 }
 });

 if (Object.keys(itemsByMachine).length === 0 && itemsWithoutMachine.length > 0 && checklistMachine) {
 const machineKey = `${checklistMachine.id || 'unknown'}_${checklistMachine.name || 'Sin nombre'}`;
 itemsByMachine[machineKey] = itemsWithoutMachine.map(item => ({ 
 ...item, 
 machineInfo: checklistMachine,
 componentInfo: null,
 subcomponentInfo: null
 }));
 itemsWithoutMachine = [];
 }

 // Generar contenido de tabla agrupado por máquina
 let tableRows = '';
 let itemCounter = 0;

 const generateItemRows = (items: Array<{ item: any; phaseIndex?: number; itemIndex: number; globalIndex: number }>) => {
 let rows = '';
 items.forEach((itemData) => {
 itemCounter++;
 const { item, phaseIndex, itemIndex } = itemData;
 const fullTitle = phaseIndex !== undefined 
 ? `${phaseIndex + 1}.${itemIndex + 1} ${item.title}`
 : `${itemCounter}. ${item.title}`;
 const itemId = item.maintenanceId || item.id || 'N/A';
 const maintenanceText = `${fullTitle} - ID: ${itemId}`;
 
 rows += `
 <tr>
 <td class="table-cell maintenance-cell">${maintenanceText}</td>
 <td class="table-cell date-cell">
 <div class="date-field">__ / __ / __</div>
 </td>
 <td class="table-cell date-cell">
 <div class="date-field">__ / __ / __</div>
 </td>
 <td class="table-cell notes-cell">
 <div class="notes-field"></div>
 </td>
 <td class="table-cell notes-cell">
 <div class="notes-field"></div>
 </td>
 <td class="table-cell responsible-cell">
 <div class="responsible-field">_________________</div>
 </td>
 </tr>
 `;
 });
 return rows;
 };

 // Agrupar primero por máquina
 const machinesMap: { [machineKey: string]: { [fullKey: string]: typeof itemsByMachine[string] } } = {};
 
 Object.keys(itemsByMachine).forEach((fullKey) => {
 const machineKeyMatch = fullKey.match(/^(unidad_[\d_]+|[\d_]+)/);
 const machineKey = machineKeyMatch ? machineKeyMatch[0] : fullKey;
 
 if (!machinesMap[machineKey]) {
 machinesMap[machineKey] = {};
 }
 machinesMap[machineKey][fullKey] = itemsByMachine[fullKey];
 });

 // Generar secciones
 Object.keys(machinesMap).forEach((machineKey) => {
 const machineGroups = machinesMap[machineKey];
 const firstGroupKey = Object.keys(machineGroups)[0];
 const firstItemData = machineGroups[firstGroupKey][0];
 const machineInfo = firstItemData.machineInfo || firstItemData.item.machine || firstItemData.item.unidadMovil;
 const machineName = machineInfo?.name || machineInfo?.nombre || 'Sin nombre';
 const isUnidadMovil = machineKey.startsWith('unidad_');
 
 tableRows += `
 <tbody class="machine-group">
 <tr class="machine-header-row">
 <td colspan="6" style="text-align: center;">
 <strong>${isUnidadMovil ? 'Unidad Móvil' : 'Máquina'}: ${machineName}</strong>
 </td>
 </tr>
 `;
 
 // Agrupar por componente dentro de esta máquina
 const componentsMap: { [componentKey: string]: { [subcomponentKey: string]: typeof itemsByMachine[string] } } = {};
 
 Object.keys(machineGroups).forEach((fullKey) => {
 const items = machineGroups[fullKey];
 const firstItem = items[0];
 const componentInfo = firstItem.componentInfo;
 const subcomponentInfo = firstItem.subcomponentInfo;
 
 const componentKey = componentInfo 
 ? `comp_${componentInfo.id}_${componentInfo.name || 'Sin nombre'}`
 : 'sin_componente';
 
 const subcomponentKey = subcomponentInfo
 ? `subcomp_${subcomponentInfo.id}_${subcomponentInfo.name || 'Sin nombre'}`
 : 'sin_subcomponente';
 
 if (!componentsMap[componentKey]) {
 componentsMap[componentKey] = {};
 }
 if (!componentsMap[componentKey][subcomponentKey]) {
 componentsMap[componentKey][subcomponentKey] = [];
 }
 componentsMap[componentKey][subcomponentKey].push(...items);
 });
 
 // Generar grupos por componente y subcomponente
 Object.keys(componentsMap).forEach((componentKey) => {
 const subcomponentsMap = componentsMap[componentKey];
 const firstSubcomponentKey = Object.keys(subcomponentsMap)[0];
 const firstItem = subcomponentsMap[firstSubcomponentKey][0];
 const componentInfo = firstItem.componentInfo;
 
 if (componentInfo && componentKey !== 'sin_componente') {
 const componentName = componentInfo.name || `Componente ${componentInfo.id}`;
 tableRows += `
 <tbody class="component-group">
 <tr class="component-header-row" style="background-color: #f3f4f6; font-weight: bold;">
 <td colspan="6" style="padding: 8px; font-size: 12px; border-left: 3px solid #3b82f6; text-align: center;">
 <strong>Componente: ${componentName}</strong>
 </td>
 </tr>
 `;
 }
 
 Object.keys(subcomponentsMap).forEach((subcomponentKey) => {
 const items = subcomponentsMap[subcomponentKey];
 const firstItem = items[0];
 const subcomponentInfo = firstItem.subcomponentInfo;
 
 if (subcomponentInfo && subcomponentKey !== 'sin_subcomponente') {
 const subcomponentName = subcomponentInfo.name || `Subcomponente ${subcomponentInfo.id}`;
 tableRows += `
 <tbody class="subcomponent-group">
 <tr class="subcomponent-header-row" style="background-color: #f9fafb; font-weight: bold;">
 <td colspan="6" style="padding: 6px 8px 6px 20px; font-size: 11px; border-left: 3px solid #60a5fa; text-align: center;">
 <strong>Subcomponente: ${subcomponentName}</strong>
 </td>
 </tr>
 `;
 }
 
 tableRows += generateItemRows(items);
 
 if (subcomponentInfo && subcomponentKey !== 'sin_subcomponente') {
 tableRows += `</tbody>`;
 }
 });
 
 if (componentInfo && componentKey !== 'sin_componente') {
 tableRows += `</tbody>`;
 }
 });
 tableRows += `</tbody>`;
 });

 if (itemsWithoutMachine.length > 0) {
 tableRows += `
 <tbody class="unassigned-group">
 <tr class="unassigned-header-row">
 <td colspan="6" style="text-align: center;">
 <strong>Mantenimientos sin máquina asignada</strong>
 </td>
 </tr>
 `;
 tableRows += generateItemRows(itemsWithoutMachine);
 tableRows += `</tbody>`;
 }

 if (allItems.length === 0) {
 tableRows = '<tr><td colspan="6" style="text-align: center; color: #6b7280; font-style: italic; padding: 20px;">Sin items definidos</td></tr>';
 }

 return `
 <!DOCTYPE html>
 <html lang="es">
 <head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>Checklist - ${checklist.title}</title>
 <style>
 @media print {
 @page {
 size: landscape;
 margin: 10mm;
 }
 body { margin: 0; padding: 10px; }
 .no-print { display: none; }
 .page-break { page-break-before: always; }
 .header { margin-bottom: 10px; padding-bottom: 10px; }
 .info-grid { margin-bottom: 10px; }
 .description { margin-bottom: 10px; padding: 10px; }
 .phases-section h2 { margin-bottom: 10px; padding-bottom: 5px; }
 }
 
 body {
 font-family: Arial, sans-serif;
 line-height: 1.6;
 color: #333;
 max-width: 1200px;
 margin: 0 auto;
 padding: 20px;
 }
 
 @media print {
 .checklist-table {
 font-size: 9px;
 width: 100%;
 }
 
 .checklist-table th,
 .checklist-table td {
 padding: 4px 3px;
 }
 
 .maintenance-cell {
 width: 20%;
 min-width: 180px;
 }
 
 .date-cell {
 width: 12%;
 min-width: 90px;
 }
 
 .notes-cell {
 width: 22%;
 min-width: 150px;
 }
 
 .responsible-cell {
 width: 22%;
 min-width: 150px;
 }
 }
 
 .header {
 text-align: center;
 border-bottom: 2px solid #2563eb;
 padding-bottom: 10px;
 margin-bottom: 15px;
 }
 
 .title {
 font-size: 24px;
 font-weight: bold;
 color: #1e40af;
 margin-bottom: 5px;
 }
 
 .subtitle {
 font-size: 12px;
 font-weight: bold;
 color: #6b7280;
 margin-bottom: 3px;
 }
 
 .info-grid {
 display: grid;
 grid-template-columns: repeat(4, 1fr);
 gap: 10px;
 margin-bottom: 15px;
 font-size: 11px;
 }
 
 .info-card {
 border: 1px solid #e5e7eb;
 border-radius: 4px;
 padding: 8px;
 background-color: #f9fafb;
 }
 
 .info-label {
 font-weight: bold;
 color: #374151;
 margin-bottom: 3px;
 font-size: 10px;
 }
 
 .info-value {
 color: #111827;
 font-size: 11px;
 font-weight: bold;
 }
 
 .description {
 background-color: #f3f4f6;
 border-left: 3px solid #3b82f6;
 padding: 8px;
 margin-bottom: 15px;
 border-radius: 0 4px 4px 0;
 font-size: 11px;
 }
 
 .phases-section {
 margin-bottom: 15px;
 }
 
 .table-container {
 overflow-x: auto;
 margin-top: 20px;
 }
 
 .checklist-table {
 width: 100%;
 border-collapse: collapse;
 border: 2px solid #1e40af;
 background-color: white;
 font-size: 11px;
 table-layout: fixed;
 }
 
 .checklist-table thead {
 background-color: #f3f4f6;
 }
 
 .checklist-table th {
 padding: 8px 6px;
 text-align: center;
 font-weight: 900;
 border: 1px solid #1e3a8a;
 font-size: 11px;
 color: #000000;
 background-color: #f3f4f6;
 }
 
 .checklist-table td {
 padding: 6px 4px;
 border: 1px solid #d1d5db;
 vertical-align: top;
 }
 
 .checklist-table tbody tr:nth-child(even) {
 background-color: #f9fafb;
 }
 
 .checklist-table tbody tr:hover {
 background-color: #f3f4f6;
 }
 
 .table-cell {
 min-height: 40px;
 }
 
 .maintenance-cell {
 width: 20%;
 font-weight: 500;
 color: #000000;
 }
 
 .date-cell {
 width: 12%;
 text-align: center;
 color: #000000;
 }
 
 .date-field {
 min-height: 30px;
 padding: 4px;
 text-align: center;
 color: #000000;
 font-size: 14px;
 letter-spacing: 2px;
 }
 
 .notes-cell {
 width: 22%;
 }
 
 .notes-field {
 border: 1px solid #d1d5db;
 border-radius: 0;
 min-height: 80px;
 background-color: white;
 padding: 4px;
 }
 
 .responsible-cell {
 width: 22%;
 }
 
 .responsible-field {
 border-bottom: 1px solid #d1d5db;
 min-height: 30px;
 padding: 4px;
 }
 
 .footer {
 margin-top: 20px;
 padding-top: 10px;
 border-top: 1px solid #e5e7eb;
 text-align: center;
 color: #6b7280;
 font-size: 10px;
 }
 
 .print-button {
 position: fixed;
 top: 20px;
 right: 20px;
 padding: 10px 20px;
 background-color: #2563eb;
 color: white;
 border: none;
 border-radius: 6px;
 cursor: pointer;
 font-size: 16px;
 }
 
 .print-button:hover {
 background-color: #1d4ed8;
 }
 </style>
 </head>
 <body>
 <button class="print-button no-print" onclick="window.print()">🖨️ Imprimir</button>
 
 <div class="header">
 <div class="title">${checklist.title}</div>
 <div class="subtitle">Checklist de Mantenimiento</div>
 <div class="subtitle">Generado el ${currentDate}</div>
 </div>
 
 <div class="info-grid">
 <div class="info-card">
 <div class="info-label">Categoría</div>
 <div class="info-value">${getCategoryLabel(checklist.category)}</div>
 </div>
 <div class="info-card">
 <div class="info-label">Frecuencia</div>
 <div class="info-value">${getFrequencyLabel(checklist.frequency)}</div>
 </div>
 <div class="info-card">
 <div class="info-label">Total Items</div>
 <div class="info-value">${totalItems}</div>
 </div>
 <div class="info-card">
 <div class="info-label">Tiempo Estimado</div>
 <div class="info-value">${formatTime(totalEstimatedTime)}</div>
 </div>
 </div>
 
 ${checklist.description ? `
 <div class="description">
 <div class="info-label">Descripción</div>
 <div class="info-value">${checklist.description}</div>
 </div>
 ` : ''}
 
 <div class="phases-section">
 <h2 style="color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; margin-bottom: 10px; font-size: 16px;">
 Items del Checklist
 </h2>
 
 <div class="table-container">
 <table class="checklist-table">
 <thead>
 <tr>
 <th style="width: 20%;">Mantenimiento</th>
 <th style="width: 12%;">Fecha de realizado</th>
 <th style="width: 12%;">Fecha a reprogramar</th>
 <th style="width: 22%;">Notas</th>
 <th style="width: 22%;">Inconvenientes</th>
 <th style="width: 22%;">Responsables y supervisores</th>
 </tr>
 </thead>
 <tbody>
 ${tableRows}
 </tbody>
 </table>
 </div>
 </div>
 
 <div class="footer">
 <p style="font-size: 10px;">Este checklist fue generado automáticamente por el sistema de mantenimiento - Fecha de impresión: ${currentDate}</p>
 </div>
 </body>
 </html>
 `;
 };

 const generateChecklistExecutionPrintContent = (checklist: any) => {
 const formatTime = (minutes: number) => {
 if (minutes < 60) {
 return `${minutes} min`;
 }
 const hours = Math.floor(minutes / 60);
 const remainingMinutes = minutes % 60;
 return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
 };

 const getFrequencyLabel = (frequency: string) => {
 const labels: { [key: string]: string } = {
 'DAILY': 'Diario',
 'WEEKLY': 'Semanal',
 'BIWEEKLY': 'Quincenal',
 'MONTHLY': 'Mensual',
 'QUARTERLY': 'Trimestral',
 'SEMIANNUAL': 'Semestral',
 'ANNUAL': 'Anual'
 };
 return labels[frequency] || frequency;
 };

 const calculateMaintenanceStatus = (maintenanceData: any) => {
 if (maintenanceData.lastMaintenanceDate) {
 return { status: 'completed', label: 'Completado' };
 }
 return { status: 'pending', label: 'Pendiente' };
 };

 const currentDate = new Date().toLocaleDateString('es-AR', {
 year: 'numeric',
 month: 'long',
 day: 'numeric'
 });

 let maintenanceItems = '';
 
 // Si no hay fases, crear items de ejemplo basados en el checklist
 if (!checklist.phases || checklist.phases.length === 0) {
 // Crear items de ejemplo para testing
 const exampleItems = [
 {
 title: "asdadsa",
 description: "Cambio de aceite del motor y filtro de aceite. Verificar nivel de aceite y estado del filtro.",
 maintenanceData: {
 status: 'COMPLETED',
 lastMaintenanceDate: '2025-10-23',
 nextMaintenanceDate: '2025-10-30',
 frequency: 'MONTHLY'
 }
 },
 {
 title: "Cambio de aceite del motor",
 description: "Cambio de aceite del motor y filtro de aceite. Verificar nivel de aceite y estado del filtro.",
 maintenanceData: {
 status: 'PENDING',
 nextMaintenanceDate: '2025-10-29',
 frequency: 'MONTHLY'
 }
 }
 ];
 
 maintenanceItems = exampleItems.map((item: any, itemIndex: number) => {
 const maintenanceData = item.maintenanceData || {};
 const status = calculateMaintenanceStatus(maintenanceData);
 
 return `
 <div class="maintenance-item">
 <div class="maintenance-header">
 <div class="maintenance-info">
 <div class="maintenance-title-row">
 <h4 class="maintenance-title">${item.title}</h4>
 <div class="maintenance-id-badge">ID: ${(item.id || (itemIndex + 1)).toString().replace('maintenance_', '')}</div>
 </div>
 <p class="maintenance-description">${item.description || ''}</p>
 <div class="maintenance-badges">
 ${status.status === 'completed' ? 
 '<div class="badge badge-completed"><span class="badge-icon">✓</span>Completado</div>' : 
 `<div class="badge badge-frequency">${getFrequencyLabel(maintenanceData.frequency || 'MONTHLY')}</div>`
 }
 <div class="badge badge-type">Preventivo</div>
 </div>
 <div class="maintenance-dates">
 ${maintenanceData.lastMaintenanceDate ? 
 `<div class="date-info"><span class="date-icon completed">✓</span>Último: ${new Date(maintenanceData.lastMaintenanceDate).toLocaleDateString('es-AR')}</div>` : ''
 }
 ${maintenanceData.nextMaintenanceDate ? 
 `<div class="date-info"><span class="date-icon upcoming">📅</span>Próximo: ${new Date(maintenanceData.nextMaintenanceDate).toLocaleDateString('es-AR')}</div>` : ''
 }
 </div>
 </div>
 </div>
 
 <div class="execution-fields">
 <div class="field-row">
 <div class="field-group">
 <label class="field-label">
 <span class="field-icon completed">✓</span>
 Fecha de realizado
 </label>
 <div class="date-input">
 <input type="text" class="date-field" />
 </div>
 </div>
 <div class="field-group">
 <label class="field-label">
 <span class="field-icon reschedule">📅</span>
 Fecha a reprogramar
 </label>
 <div class="date-input">
 <input type="text" class="date-field" />
 </div>
 </div>
 </div>
 
 <div class="field-row">
 <div class="field-group">
 <label class="field-label">
 <span class="field-icon notes">📄</span>
 Notas
 </label>
 <textarea class="notes-field" rows="3"></textarea>
 </div>
 <div class="field-group">
 <label class="field-label">
 <span class="field-icon issues">⚠️</span>
 Inconvenientes
 </label>
 <textarea class="notes-field" rows="3"></textarea>
 </div>
 </div>
 
 <div class="responsible-section">
 <label class="responsible-label">Responsable:</label>
 <div class="signature-line">
 <div class="signature-space"></div>
 <div class="name-field">
 <input type="text" class="name-input" />
 </div>
 </div>
 </div>
 </div>
 </div>
 `;
 }).join('');
 } else if (checklist.phases && checklist.phases.length > 0) {
 maintenanceItems = checklist.phases.map((phase: any, phaseIndex: number) => {
 if (phase.items && phase.items.length > 0) {
 return phase.items.map((item: any, itemIndex: number) => {
 const maintenanceData = item.maintenanceData || {};
 const status = calculateMaintenanceStatus(maintenanceData);
 
 return `
 <div class="maintenance-item">
 <div class="maintenance-header">
 <div class="maintenance-info">
 <div class="maintenance-title-row">
 <h4 class="maintenance-title">${item.title}</h4>
 <div class="maintenance-id-badge">ID: ${(item.id || (itemIndex + 1)).toString().replace('maintenance_', '')}</div>
 </div>
 <p class="maintenance-description">${item.description || ''}</p>
 <div class="maintenance-badges">
 ${status.status === 'completed' ? 
 '<div class="badge badge-completed"><span class="badge-icon">✓</span>Completado</div>' : 
 `<div class="badge badge-frequency">${getFrequencyLabel(maintenanceData.frequency || 'MONTHLY')}</div>`
 }
 <div class="badge badge-type">Preventivo</div>
 </div>
 <div class="maintenance-dates">
 ${maintenanceData.lastMaintenanceDate ? 
 `<div class="date-info"><span class="date-icon completed">✓</span>Último: ${new Date(maintenanceData.lastMaintenanceDate).toLocaleDateString('es-AR')}</div>` : ''
 }
 ${maintenanceData.nextMaintenanceDate ? 
 `<div class="date-info"><span class="date-icon upcoming">📅</span>Próximo: ${new Date(maintenanceData.nextMaintenanceDate).toLocaleDateString('es-AR')}</div>` : ''
 }
 </div>
 </div>
 </div>
 
 <div class="execution-fields">
 <div class="field-row">
 <div class="field-group">
 <label class="field-label">
 <span class="field-icon completed">✓</span>
 Fecha de realizado
 </label>
 <div class="date-input">
 <input type="text" class="date-field" />
 </div>
 </div>
 <div class="field-group">
 <label class="field-label">
 <span class="field-icon reschedule">📅</span>
 Fecha a reprogramar
 </label>
 <div class="date-input">
 <input type="text" class="date-field" />
 </div>
 </div>
 </div>
 
 <div class="field-row">
 <div class="field-group">
 <label class="field-label">
 <span class="field-icon notes">📄</span>
 Notas
 </label>
 <textarea class="notes-field" rows="3"></textarea>
 </div>
 <div class="field-group">
 <label class="field-label">
 <span class="field-icon issues">⚠️</span>
 Inconvenientes
 </label>
 <textarea class="notes-field" rows="3"></textarea>
 </div>
 </div>
 
 <div class="responsible-section">
 <label class="responsible-label">Responsable:</label>
 <div class="signature-line">
 <div class="signature-space"></div>
 <div class="name-field">
 <input type="text" class="name-input" />
 </div>
 </div>
 </div>
 </div>
 </div>
 `;
 }).join('');
 }
 return '';
 }).join('');
 }

 return `
 <!DOCTYPE html>
 <html lang="es">
 <head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>Ejecutar Checklist - ${checklist.title}</title>
 <style>
 @media print {
 body { margin: 0; padding: 20px; }
 .no-print { display: none; }
 .page-break { page-break-before: always; }
 }
 
 * {
 box-sizing: border-box;
 }
 
 body {
 font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
 line-height: 1.4;
 color: #333;
 background: #f8fafc;
 margin: 0;
 padding: 15px;
 font-size: 12px;
 }
 
 .print-button {
 position: fixed;
 top: 20px;
 right: 20px;
 background: #3b82f6;
 color: white;
 border: none;
 padding: 12px 24px;
 border-radius: 8px;
 cursor: pointer;
 font-size: 16px;
 font-weight: 600;
 box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
 z-index: 1000;
 }
 
 .print-button:hover {
 background: #2563eb;
 }
 
 .modal-container {
 max-width: 1000px;
 margin: 0 auto;
 background: white;
 border-radius: 12px;
 box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.1);
 overflow: hidden;
 }
 
 .modal-header {
 background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
 color: white;
 padding: 15px;
 text-align: center;
 }
 
 .modal-title {
 font-size: 18px;
 font-weight: 700;
 margin: 0 0 5px 0;
 text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
 }
 
 .modal-description {
 font-size: 12px;
 margin: 0;
 opacity: 0.9;
 }
 
 .modal-content {
 padding: 15px;
 }
 
 .summary-section {
 background: #f8fafc;
 border-radius: 6px;
 padding: 12px;
 margin-bottom: 15px;
 border: 1px solid #e2e8f0;
 }
 
 .summary-title {
 font-size: 14px;
 font-weight: 600;
 color: #1e293b;
 margin: 0 0 10px 0;
 display: flex;
 align-items: center;
 gap: 6px;
 }
 
 .summary-cards {
 display: grid;
 grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
 gap: 8px;
 }
 
 .summary-card {
 background: white;
 border-radius: 6px;
 padding: 8px;
 border: 1px solid #e2e8f0;
 text-align: center;
 }
 
 .summary-card-title {
 font-size: 10px;
 color: #64748b;
 margin: 0 0 4px 0;
 font-weight: 500;
 }
 
 .summary-card-value {
 font-size: 14px;
 font-weight: 700;
 color: #1e293b;
 margin: 0;
 }
 
 .maintenance-item {
 background: white;
 border: 1px solid #e2e8f0;
 border-radius: 8px;
 margin-bottom: 12px;
 overflow: hidden;
 box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
 }
 
 .maintenance-header {
 background: #f8fafc;
 padding: 12px;
 border-bottom: 1px solid #e2e8f0;
 }
 
 .maintenance-title-row {
 display: flex;
 align-items: center;
 gap: 8px;
 margin-bottom: 6px;
 }
 
 .maintenance-title {
 font-size: 14px;
 font-weight: 600;
 color: #1e293b;
 margin: 0;
 }
 
 .maintenance-id-badge {
 background: #f1f5f9;
 border: 1px solid #cbd5e1;
 border-radius: 4px;
 padding: 2px 6px;
 font-size: 10px;
 font-weight: 500;
 color: #475569;
 }
 
 .maintenance-description {
 color: #64748b;
 margin: 0 0 8px 0;
 line-height: 1.4;
 font-size: 11px;
 }
 
 .maintenance-badges {
 display: flex;
 gap: 6px;
 margin-bottom: 8px;
 flex-wrap: wrap;
 }
 
 .badge {
 display: inline-flex;
 align-items: center;
 padding: 2px 8px;
 border-radius: 12px;
 font-size: 9px;
 font-weight: 600;
 text-transform: uppercase;
 letter-spacing: 0.3px;
 }
 
 .badge-completed {
 background: #dcfce7;
 color: #166534;
 border: 1px solid #bbf7d0;
 }
 
 .badge-frequency {
 background: #dbeafe;
 color: #1e40af;
 border: 1px solid #93c5fd;
 }
 
 .badge-type {
 background: #fef3c7;
 color: #92400e;
 border: 1px solid #fde68a;
 }
 
 .badge-icon {
 margin-right: 4px;
 }
 
 .maintenance-dates {
 display: flex;
 gap: 12px;
 flex-wrap: wrap;
 }
 
 .date-info {
 display: flex;
 align-items: center;
 gap: 4px;
 font-size: 10px;
 color: #64748b;
 }
 
 .date-icon {
 font-size: 12px;
 }
 
 .date-icon.completed {
 color: #16a34a;
 }
 
 .date-icon.upcoming {
 color: #3b82f6;
 }
 
 .execution-fields {
 padding: 12px;
 background: #fefefe;
 }
 
 .field-row {
 display: grid;
 grid-template-columns: 1fr 1fr;
 gap: 12px;
 margin-bottom: 12px;
 }
 
 .field-group {
 display: flex;
 flex-direction: column;
 }
 
 .field-label {
 display: flex;
 align-items: center;
 gap: 6px;
 font-size: 11px;
 font-weight: 600;
 color: #374151;
 margin-bottom: 6px;
 }
 
 .field-icon {
 font-size: 12px;
 }
 
 .field-icon.completed {
 color: #16a34a;
 }
 
 .field-icon.reschedule {
 color: #f59e0b;
 }
 
 .field-icon.notes {
 color: #3b82f6;
 }
 
 .field-icon.issues {
 color: #dc2626;
 }
 
 .date-input {
 position: relative;
 display: flex;
 align-items: center;
 }
 
 .date-field {
 width: 100%;
 padding: 8px 12px;
 border: 1px solid #e5e7eb;
 border-radius: 6px;
 font-size: 11px;
 background: white;
 transition: border-color 0.2s;
 }
 
 .date-field:focus {
 outline: none;
 border-color: #3b82f6;
 box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
 }
 
 
 .notes-field {
 width: 100%;
 padding: 8px 12px;
 border: 1px solid #e5e7eb;
 border-radius: 6px;
 font-size: 11px;
 font-family: inherit;
 background: white;
 resize: vertical;
 min-height: 50px;
 transition: border-color 0.2s;
 }
 
 .notes-field:focus {
 outline: none;
 border-color: #3b82f6;
 box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
 }
 
 .modal-footer {
 background: #f8fafc;
 padding: 12px 15px;
 border-top: 1px solid #e2e8f0;
 display: flex;
 justify-content: space-between;
 align-items: center;
 }
 
 .btn {
 padding: 8px 16px;
 border-radius: 6px;
 font-size: 11px;
 font-weight: 600;
 cursor: pointer;
 border: none;
 transition: all 0.2s;
 }
 
 .btn-secondary {
 background: #f1f5f9;
 color: #475569;
 border: 1px solid #cbd5e1;
 }
 
 .btn-secondary:hover {
 background: #e2e8f0;
 }
 
 .btn-primary {
 background: #3b82f6;
 color: white;
 }
 
 .btn-primary:hover {
 background: #2563eb;
 }
 
 .section-title {
 font-size: 14px;
 font-weight: 600;
 color: #1e293b;
 margin: 0 0 12px 0;
 padding-bottom: 8px;
 border-bottom: 2px solid #e2e8f0;
 }
 
 .section-header {
 padding: 12px 15px;
 border-bottom: 1px solid #e2e8f0;
 background: #f8fafc;
 }
 
 .supervisor-section {
 background: white;
 border: 1px solid #e5e7eb;
 border-radius: 6px;
 margin-top: 16px;
 overflow: hidden;
 }
 
 .supervisor-content {
 padding: 16px;
 }
 
 .supervisor-field {
 display: flex;
 flex-direction: column;
 gap: 6px;
 }
 
 .supervisor-label {
 font-size: 12px;
 font-weight: 600;
 color: #374151;
 margin: 0 0 6px 0;
 }
 
 .responsible-section {
 margin-top: 12px;
 padding-top: 12px;
 border-top: 1px solid #e5e7eb;
 }
 
 .responsible-label {
 font-size: 12px;
 font-weight: 600;
 color: #374151;
 margin: 0 0 6px 0;
 }
 
 .signature-line {
 display: flex;
 flex-direction: column;
 gap: 4px;
 margin-bottom: 8px;
 }
 
 .signature-space {
 height: 40px;
 border-bottom: 2px solid #374151;
 margin-bottom: 4px;
 }
 
 .name-field {
 margin-top: 4px;
 }
 
 .name-input {
 width: 100%;
 height: 32px;
 padding: 4px 8px;
 border: 1px solid #d1d5db;
 border-radius: 4px;
 font-size: 12px;
 background: white;
 }
 
 .name-input:focus {
 outline: none;
 border-color: #3b82f6;
 box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
 }
 
 .date-input-field, .time-input-field {
 width: 100%;
 height: 32px;
 padding: 4px 8px;
 border: 1px solid #d1d5db;
 border-radius: 4px;
 font-size: 12px;
 background: white;
 }
 
 .date-input-field:focus, .time-input-field:focus {
 outline: none;
 border-color: #3b82f6;
 box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
 }
 
 @media print {
 .print-button {
 display: none;
 }
 
 .modal-container {
 box-shadow: none;
 border-radius: 0;
 }
 
 .modal-header {
 background: #f8fafc !important;
 color: #1e293b !important;
 border-bottom: 2px solid #e2e8f0;
 }
 
 .maintenance-item {
 break-inside: avoid;
 margin-bottom: 16px;
 }
 
 .field-row {
 grid-template-columns: 1fr 1fr;
 }
 
 .execution-fields {
 background: white !important;
 }
 
 .date-field, .notes-field {
 border: 1px solid #d1d5db !important;
 background: white !important;
 }
 
 .responsible-section {
 margin-top: 12px !important;
 padding-top: 12px !important;
 border-top: 1px solid #e5e7eb !important;
 }
 
 .responsible-label {
 font-size: 12px !important;
 font-weight: 600 !important;
 color: #374151 !important;
 margin: 0 0 6px 0 !important;
 }
 
 .supervisor-section {
 background: white !important;
 border: 1px solid #e5e7eb !important;
 border-radius: 6px !important;
 margin-top: 16px !important;
 overflow: hidden !important;
 }
 
 .supervisor-content {
 padding: 16px !important;
 }
 
 .supervisor-field {
 display: flex !important;
 flex-direction: column !important;
 gap: 6px !important;
 }
 
 .supervisor-label {
 font-size: 12px !important;
 font-weight: 600 !important;
 color: #374151 !important;
 margin: 0 !important;
 }
 
 .signature-line {
 display: flex !important;
 flex-direction: column !important;
 gap: 4px !important;
 margin-bottom: 8px !important;
 }
 
 .signature-space {
 height: 40px !important;
 border-bottom: 2px solid #374151 !important;
 margin-bottom: 4px !important;
 }
 
 .name-field {
 margin-top: 4px !important;
 }
 
 .name-input {
 width: 100% !important;
 height: 32px !important;
 padding: 4px 8px !important;
 border: 1px solid #d1d5db !important;
 border-radius: 4px !important;
 font-size: 12px !important;
 background: white !important;
 }
 
 .date-input-field, .time-input-field {
 width: 100% !important;
 height: 32px !important;
 padding: 4px 8px !important;
 border: 1px solid #d1d5db !important;
 border-radius: 4px !important;
 font-size: 12px !important;
 background: white !important;
 }
 
 .date-field, .time-field {
 margin-top: 2px !important;
 }
 
 .date-input-field, .time-input-field {
 width: 100% !important;
 height: 28px !important;
 padding: 4px 8px !important;
 border: 1px solid #d1d5db !important;
 border-radius: 4px !important;
 font-size: 12px !important;
 background: white !important;
 }
 }
 </style>
 </head>
 <body>
 <button class="print-button no-print" onclick="window.print()">🖨️ Imprimir</button>
 
 <div class="modal-container">
 <div class="modal-header">
 <h2 class="modal-title">
 📄 Ejecutar Checklist: ${checklist.title}
 </h2>
 <div style="margin-top: 8px; font-size: 14px; color: #6b7280;">
 <strong>ID del Checklist:</strong> ${checklist.id}
 </div>
 <p class="modal-description">
 Mantenimientos del checklist cargados automáticamente. Marca cada uno como completado o reprograma con nueva fecha.
 </p>
 </div>
 
 <div class="modal-content">
 <div class="summary-section">
 <h3 class="summary-title">
 📊 Resumen del Checklist
 </h3>
 <div class="summary-cards">
 <div class="summary-card">
 <p class="summary-card-title">Categoría</p>
 <p class="summary-card-value">Mantenimiento</p>
 </div>
 <div class="summary-card">
 <p class="summary-card-title">Frecuencia</p>
 <p class="summary-card-value">${getFrequencyLabel(checklist.frequency || 'MONTHLY')}</p>
 </div>
 <div class="summary-card">
 <p class="summary-card-title">Total Items</p>
 <p class="summary-card-value">${checklist.phases?.reduce((total, phase) => total + (phase.items?.length || 0), 0) || 2}</p>
 </div>
 <div class="summary-card">
 <p class="summary-card-title">Tiempo Estimado</p>
 <p class="summary-card-value">${formatTime(checklist.estimatedTotalTime || 0)}</p>
 </div>
 </div>
 </div>
 
 <h3 class="section-title">Mantenimientos (${checklist.phases?.reduce((total, phase) => total + (phase.items?.length || 0), 0) || 2})</h3>
 ${maintenanceItems}
 </div>
 
 <div class="supervisor-section">
 <div class="section-header">
 <h3 class="section-title">Supervisor</h3>
 </div>
 <div class="supervisor-content">
 <div class="supervisor-field">
 <label class="supervisor-label">Supervisor:</label>
 <div class="signature-line">
 <div class="signature-space"></div>
 <div class="name-field">
 <input type="text" class="name-input" />
 </div>
 </div>
 </div>
 </div>
 </div>
 
 </div>
 </body>
 </html>
 `;
 };

 const confirmDeleteChecklist = async () => {
 if (!checklistToDelete) return;

 try {
 const response = await fetch(`/api/maintenance/checklists?id=${checklistToDelete.id}`, {
 method: 'DELETE'
 });

 if (response.ok) {
 // ✨ Refrescar usando hook React Query y esperar
 await checklistsQuery.refetch();
 toast({
 title: 'Checklist Eliminado',
 description: 'El checklist se ha eliminado correctamente',
 });
 setIsDeleteChecklistDialogOpen(false);
 setChecklistToDelete(null);
 } else {
 const error = await response.json();
 throw new Error(error.error || 'Error al eliminar el checklist');
 }
 } catch (error: any) {
 console.error('Error deleting checklist:', error);
 toast({
 title: 'Error',
 description: error.message || 'No se pudo eliminar el checklist',
 variant: 'destructive'
 });
 }
 };

 const handleExecuteChecklist = (checklist: any) => {
 // Verificar si el checklist ya está completado y si debe reiniciarse
 const needsReset = shouldResetChecklist({
 lastExecutionDate: checklist.lastExecutionDate,
 frequency: checklist.frequency,
 isCompleted: checklist.isCompleted
 });

 if (checklist.isCompleted && !needsReset) {
 // Si está completado y no necesita reinicio, mostrar diálogo de confirmación
 const nextResetDate = getNextResetDate({
 lastExecutionDate: checklist.lastExecutionDate,
 frequency: checklist.frequency,
 isCompleted: checklist.isCompleted
 });

 setChecklistToReExecute({ ...checklist, nextResetDate });
 setIsReExecuteChecklistDialogOpen(true);
 return;
 }

 // Si necesita reinicio automático, actualizar el estado
 if (needsReset) {
 updateChecklistStatus(checklist.id, false);
 }

 setChecklistToExecute(checklist);
 setIsTableExecutionDialogOpen(true);
 };

 const confirmReExecuteChecklist = () => {
 if (!checklistToReExecute) return;
 
 setChecklistToExecute(checklistToReExecute);
 setIsTableExecutionDialogOpen(true);
 };

 // Funciones para el nuevo flujo de selección
 const resetChecklistFlow = () => {
 setSelectedAsset(null);
 setChecklistToExecute(null);
 setIsTableExecutionDialogOpen(false);
 setIsChecklistDialogOpen(false);
 };

 const updateChecklistStatus = async (checklistId: number, isCompleted: boolean) => {
 try {
 const response = await fetch('/api/maintenance/checklists', {
 method: 'PUT',
 headers: {
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 checklistId,
 isCompleted,
 lastExecutionDate: isCompleted ? new Date().toISOString() : undefined
 })
 });

 if (response.ok) {
 log('✅ Estado del checklist actualizado');
 refetchDashboard(); // ✅ OPTIMIZADO
 } else {
 console.error('Error updating checklist status');
 }
 } catch (error) {
 console.error('Error updating checklist status:', error);
 }
 };

 const checkAndResetChecklists = async () => {
 try {
 const response = await fetch(`/api/maintenance/checklists/reset?companyId=${companyId}`, {
 method: 'POST'
 });

 if (response.ok) {
 const result = await response.json();
 if (result.resetResults.length > 0) {
 toast({
 title: '🔄 Checklists Reiniciados',
 description: `${result.resetResults.length} checklists han sido reiniciados automáticamente según su frecuencia`,
 });
 refetchDashboard(); // ✅ OPTIMIZADO
 }
 } else {
 console.error('Error checking checklist resets');
 }
 } catch (error) {
 console.error('Error checking checklist resets:', error);
 }
 };


 const handleViewMaintenance = (maintenance: any) => {
 setSelectedMaintenance(maintenance);
 setIsDetailDialogOpen(true);
 };

 const handleEditMaintenance = (maintenance: any) => {
 setEditingMaintenance(maintenance);
 setDialogMode('edit');
 
 // Determinar qué tipo de diálogo abrir basado en el tipo de mantenimiento
 if (maintenance.unidadMovilId || maintenance.unidadMovil) {
 // Es un mantenimiento de unidad móvil
 setSelectedUnidadForMaintenance(maintenance.unidadMovil || { id: maintenance.unidadMovilId });
 setIsUnidadMovilMaintenanceDialogOpen(true);
 } else if (maintenance.type === 'PREVENTIVE' || maintenance.isPreventive) {
 setIsPreventiveDialogOpen(true);
 } else {
 setIsCorrectiveDialogOpen(true);
 }
 };

 const handleDeleteMaintenance = (maintenance: any) => {
 setMaintenanceToDelete(maintenance);
 setIsDeleteDialogOpen(true);
 };

 const handleDuplicateMaintenance = async (maintenance: any) => {
 setMaintenanceToDuplicate(maintenance);
 setSelectedMachineForDuplicate(null);
 setSelectedUnidadForDuplicate(null);
 
 // Cargar máquinas y unidades móviles disponibles
 await fetchAvailableMachines(); // ⚠️ REACTIVADO
 
 setIsDuplicateDialogOpen(true);
 };

 const handleConfirmDuplicate = async () => {
 if (!maintenanceToDuplicate || (!selectedMachineForDuplicate && !selectedUnidadForDuplicate)) return;

 try {
 // Crear el objeto de duplicación
 const duplicateData = {
 title: maintenanceToDuplicate.title,
 description: maintenanceToDuplicate.description,
 type: maintenanceToDuplicate.type,
 priority: maintenanceToDuplicate.priority,
 machineId: selectedMachineForDuplicate,
 unidadMovilId: selectedUnidadForDuplicate,
 companyId: companyId,
 sectorId: maintenanceToDuplicate.sectorId,
 estimatedHours: maintenanceToDuplicate.estimatedHours,
 estimatedMinutes: maintenanceToDuplicate.estimatedMinutes,
 estimatedTimeType: maintenanceToDuplicate.estimatedTimeType,
 timeValue: maintenanceToDuplicate.timeValue,
 timeUnit: maintenanceToDuplicate.timeUnit,
 frequency: maintenanceToDuplicate.frequency,
 frequencyUnit: maintenanceToDuplicate.frequencyUnit,
 frequencyDays: maintenanceToDuplicate.frequencyDays,
 executionWindow: maintenanceToDuplicate.executionWindow,
 assignedToId: maintenanceToDuplicate.assignedToId,
 notes: maintenanceToDuplicate.notes
 };

 const response = await fetch('/api/maintenance/duplicate', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify(duplicateData),
 });

 if (!response.ok) {
 const errorData = await response.json();
 throw new Error(errorData.error || 'Error al duplicar el mantenimiento');
 }

 const result = await response.json();
 
 toast({
 title: "Mantenimiento duplicado",
 description: `El mantenimiento se ha duplicado exitosamente en el destino seleccionado`,
 duration: 3000,
 });

 // Cerrar modal y limpiar estado
 setIsDuplicateDialogOpen(false);
 setMaintenanceToDuplicate(null);
 setSelectedMachineForDuplicate(null);
 setSelectedUnidadForDuplicate(null);

 // Recargar los datos
 setTimeout(() => {
 refetchDashboard(); // ✅ OPTIMIZACIÓN: Usar dashboard consolidado
 }, 1000);

 } catch (error) {
 console.error('Error duplicando mantenimiento:', error);
 toast({
 title: "Error",
 description: error instanceof Error ? error.message : 'Error al duplicar el mantenimiento',
 variant: 'destructive',
 duration: 5000,
 });
 }
 };

 const confirmDelete = async () => {
 if (!maintenanceToDelete) return;

 setIsDeleting(true);
 
 try {
 const type = maintenanceToDelete.isPreventive ? 'preventive' : 'corrective';
 
 // Obtener el ID correcto del mantenimiento
 let maintenanceId = maintenanceToDelete.id;
 
 // Para mantenimientos preventivos, usar templateId si existe, sino usar id
 if (maintenanceToDelete.isPreventive) {
 maintenanceId = maintenanceToDelete.templateId || maintenanceToDelete.id;
 }
 
 // Verificar que tenemos un ID válido
 if (!maintenanceId) {
 throw new Error('No se pudo obtener el ID del mantenimiento a eliminar');
 }
 
 // Deleting maintenance

 const response = await fetch(`/api/maintenance/delete?id=${maintenanceId}&type=${type}`, {
 method: 'DELETE',
 });

 if (!response.ok) {
 const errorData = await response.json();
 throw new Error(errorData.error || 'Error al eliminar el mantenimiento');
 }

 const result = await response.json();
 log('✅ Mantenimiento eliminado:', result);

 // ✨ OPTIMIZACIÓN: Eliminar directamente del estado local sin recargar todo
 setAllMaintenances(prev => {
 // Filtrar el mantenimiento eliminado por ID
 const filtered = prev.filter(m => {
 // Para preventivos, comparar por templateId o id
 if (maintenanceToDelete.isPreventive) {
 const templateId = maintenanceToDelete.templateId || maintenanceToDelete.id;
 return m.id !== templateId && m.templateId !== templateId;
 }
 // Para correctivos, comparar por id
 return m.id !== maintenanceToDelete.id;
 });
 return filtered;
 });

 // Mostrar notificación de éxito
 toast({
 title: "Mantenimiento eliminado",
 description: result.message,
 duration: 3000,
 });

 // Cerrar diálogo y limpiar estado
 setIsDeleteDialogOpen(false);
 setMaintenanceToDelete(null);

 // Solo refrescar el dashboard para actualizar KPIs (sin recargar toda la lista)
 refetchDashboard();

 } catch (error) {
 console.error('❌ Error eliminando mantenimiento:', error);
 toast({
 title: "Error",
 description: error.message || 'Error al eliminar el mantenimiento',
 variant: "destructive",
 duration: 5000,
 });
 } finally {
 setIsDeleting(false);
 }
 };

 const cancelDelete = () => {
 setIsDeleteDialogOpen(false);
 setMaintenanceToDelete(null);
 setIsDeleting(false);
 };

 const handleExecuteMaintenance = (maintenance: any) => {
 log('🔧 Ejecutando mantenimiento:', maintenance);
 setMaintenanceToExecute(maintenance);
 setIsExecuteDialogOpen(true);
 };

 const handleMaintenanceExecution = async (executionData: any) => {
 setIsExecuting(true);
 
 try {
 log('🔧 Enviando datos de ejecución:', executionData);

 const response = await fetch('/api/maintenance/execute', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify(executionData)
 });

 if (!response.ok) {
 const errorData = await response.json();
 throw new Error(errorData.error || 'Error al ejecutar el mantenimiento');
 }

 const result = await response.json();
 log('✅ Mantenimiento ejecutado:', result);

 // Mostrar notificación de éxito
 toast({
 title: "Mantenimiento ejecutado",
 description: result.message,
 duration: 3000,
 });

 // Cerrar diálogo y limpiar estado
 setIsExecuteDialogOpen(false);
 setMaintenanceToExecute(null);

 // Recargar los datos incluyendo historial
 setTimeout(async () => {
 await refetchDashboard(); // ✅ OPTIMIZADO
 if (activeTab === 'history') {
 await fetchMaintenanceHistory(); // Solo si está en la pestaña de historial
 }
 }, 1000);

 } catch (error) {
 console.error('❌ Error ejecutando mantenimiento:', error);
 toast({
 title: "Error",
 description: error.message || 'Error al ejecutar el mantenimiento',
 variant: "destructive",
 duration: 5000,
 });
 } finally {
 setIsExecuting(false);
 }
 };

 const handleSelectMaintenanceType = (type: 'PREVENTIVE' | 'CORRECTIVE' | 'PREDICTIVE' | 'EMERGENCY') => {
 setIsTypeSelectorOpen(false);
 setEditingMaintenance(null);
 setDialogMode('create');
 
 switch (type) {
 case 'PREVENTIVE':
 setIsPreventiveDialogOpen(true);
 break;
 case 'CORRECTIVE':
 case 'EMERGENCY':
 // Para mantenimiento correctivo, abrir primero el registro de falla
 setIsFailureDialogOpen(true);
 break;
 case 'PREDICTIVE':
 // Para mantenimiento predictivo, abrir directamente el modal predictivo
 setIsPredictiveDialogOpen(true);
 break;
 }
 };

 const handleSelectAssetType = (assetType: 'MACHINE' | 'UNIDAD_MOVIL') => {
 setIsAssetTypeSelectorOpen(false);
 setEditingMaintenance(null);
 setDialogMode('create');
 
 if (assetType === 'MACHINE') {
 // Para máquinas, abrir el selector de tipo de mantenimiento
 setIsTypeSelectorOpen(true);
 } else if (assetType === 'UNIDAD_MOVIL') {
 // Para unidades móviles, abrir directamente el dialog de mantenimiento
 setIsUnidadMovilMaintenanceDialogOpen(true);
 }
 };

 const handleUnidadMovilMaintenanceSave = async (data: any) => {
 try {
 log('Mantenimiento de unidad móvil guardado exitosamente');
 
 // ✨ OPTIMIZACIÓN: Recargar solo la primera página para obtener el nuevo mantenimiento
 if (data.success) {
 // Recargar solo allMaintenances (sin limpiar todo el storage)
 await fetchAllMaintenances(0, false, true);
 
 // Mostrar mensaje de éxito
 toast({
 title: '✅ Mantenimiento guardado',
 description: 'El mantenimiento de unidad móvil se ha guardado correctamente',
 });
 }
 
 } catch (error) {
 console.error('Error refreshing maintenance data:', error);
 toast({
 title: 'Error',
 description: 'Error al actualizar los datos',
 variant: 'destructive'
 });
 }
 };

 const handleFailureSaved = (failureData: any) => {
 log('✅ Falla guardada:', failureData);
 setIsFailureDialogOpen(false);
 toast({
 title: "Falla registrada",
 description: "La falla se ha registrado correctamente",
 duration: 3000,
 });
 };

 const handleLoadSolution = async (failureData: any) => {
 log('🔧 [DEBUG] handleLoadSolution llamado con:', failureData);
 log('🔧 [DEBUG] Estados actuales:', {
 isFailureDialogOpen,
 isLoadSolutionDialogOpen,
 isCorrectiveDialogOpen
 });
 
 try {
 // Primero guardar la falla usando la API de fallas
 log('🔧 [DEBUG] Enviando request a /api/failures...');
 const response = await fetch('/api/failures', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 title: failureData.title,
 description: failureData.description,
 machineId: failureData.machineId,
 selectedComponents: failureData.affectedComponents || [],
 selectedSubcomponents: [],
 failureType: failureData.failureType || 'MECANICA',
 priority: failureData.priority || 'MEDIUM',
 estimatedHours: failureData.estimatedTime || 0,
 timeUnit: failureData.timeUnit || 'hours', // ✅ Agregar unidad de tiempo
 reportedDate: failureData.reportDate || new Date().toISOString().split('T')[0],
 failureAttachments: failureData.files || [],
 companyId: companyId,
 createdById: failureData.createdById || user?.id, // ✅ Usar empleado seleccionado o usuario actual
 createdByName: failureData.createdByName || null // ✅ Nombre del empleado que reporta
 })
 });

 log('🔧 [DEBUG] Response status:', response.status);

 if (response.ok) {
 const result = await response.json();
 log('✅ [DEBUG] Falla guardada exitosamente:', result);

 // Actualizar failureData con el ID de la falla creada y las notes
 // ✅ Incluir las notes para que LoadSolutionDialog pueda preservar reportedByName/reportedById
 const savedFailure = {
 ...failureData,
 id: result.failure?.id || result.id,
 notes: result.failure?.notes || JSON.stringify({
 reportedByName: failureData.createdByName || null,
 reportedById: failureData.createdById || null,
 failureType: failureData.failureType || 'MECANICA',
 affectedComponents: failureData.affectedComponents || [],
 timeUnit: failureData.timeUnit || 'hours'
 })
 };

 log('🔧 [DEBUG] Cerrando modal de falla y abriendo modal de solución...');
 log('🔧 [DEBUG] savedFailure:', savedFailure);
 
 setFailureData(savedFailure);
 setIsFailureDialogOpen(false);
 setIsLoadSolutionDialogOpen(true);
 
 log('🔧 [DEBUG] Estados después de cambio:', {
 isFailureDialogOpen: false,
 isLoadSolutionDialogOpen: true,
 failureData: savedFailure
 });
 
 toast({
 title: "✅ Falla Registrada",
 description: "Ahora completa los datos del mantenimiento aplicado",
 });
 } else {
 const error = await response.json();
 console.error('❌ Error al guardar falla:', error);
 toast({
 title: "Error",
 description: "No se pudo guardar la falla: " + (typeof error.error === 'string' ? error.error : error.message || 'Error desconocido'),
 variant: "destructive",
 });
 }
 } catch (error) {
 console.error('❌ Error al guardar falla:', error);
 toast({
 title: "Error",
 description: "No se pudo guardar la falla",
 variant: "destructive",
 });
 }
 };

 const handleSaveSolution = async (solutionData: any) => {
 log('✅ Solución guardada, recargando datos:', solutionData);
 await refetchDashboard(); // ✅ OPTIMIZADO
 setIsLoadSolutionDialogOpen(false);
 };

 const handleEditChecklist = (checklist: any) => {
 setEditingChecklist(checklist);
 setDialogMode('edit');
 setIsChecklistDialogOpen(true);
 };

 // ✨ OPTIMIZADO: Usar datos del dashboard context en lugar de fetch manual
 // Las máquinas y unidades móviles ya vienen en dashboardData
 const fetchAvailableMachines = useCallback(async () => {
 // Los datos ya vienen del contexto dashboardData
 if (dashboardData?.machines) {
 setAvailableMachines(dashboardData.machines as any[]);
 }
 if (dashboardData?.mobileUnits) {
 setAvailableUnidadesMoviles(dashboardData.mobileUnits as any[]);
 }
 }, [dashboardData]);

 // ✅ OPTIMIZADO: Solo cargar datos de la pestaña activa + máquinas
 // ✨ Los hooks React Query ahora manejan la carga automáticamente
 const fetchMaintenanceData = async () => {
 setLoading(true);
 try {
 // Siempre cargar máquinas disponibles
 const machinesPromise = fetchAvailableMachines();
 
 // ✨ Usar refetch de hooks en lugar de fetch directo
 switch (activeTab) {
 case 'pending':
 // ✨ Usar fetchAllMaintenances en lugar de pendingQuery (eliminado)
 await Promise.all([machinesPromise, fetchAllMaintenances(0, false, true)]);
 break;
 case 'completed-today':
 await Promise.all([machinesPromise, completedTodayQuery.refetch()]);
 break;
 case 'all':
 await Promise.all([machinesPromise, fetchAllMaintenances(0, false, true)]);
 break;
 case 'history':
 await Promise.all([machinesPromise, fetchMaintenanceHistory()]);
 break;
 case 'checklists':
 await Promise.all([machinesPromise, checklistsQuery.refetch()]);
 break;
 default:
 // overview: solo máquinas, el dashboard ya viene del provider
 await machinesPromise;
 }
 } catch (error) {
 console.error('Error fetching maintenance data:', error);
 } finally {
 setLoading(false);
 }
 };

 const fetchPendingMaintenances = useCallback(
 async (pageToLoad = 0, append = false) => {
 try {
 if (append) {
 setPendingLoadingMore(true);
 } else {
 setPendingLoadingMore(false);
 setPendingHasMore(true);
 setPendingPage(0);
 setPendingMaintenances([]);
 }

 const params = new URLSearchParams({
 companyId: companyId.toString(),
 ...(selectedSectorFilter && { sectorId: selectedSectorFilter.toString() }),
 ...(machineId && { machineId: machineId.toString() }),
 ...(filters.priority !== 'all' && { priority: filters.priority }),
 ...(filters.type !== 'all' && { type: filters.type }),
 ...(filters.frequency !== 'all' &&
 (() => {
 const range = getFrequencyRange(filters.frequency);
 return range
 ? { minFrequencyDays: range.minDays, maxFrequencyDays: range.maxDays }
 : {};
 })()),
 ...(filters.searchTerm && { searchTerm: filters.searchTerm }),
 ...(!machineId &&
 filters.selectedMachines.length > 0 && {
 machineIds: filters.selectedMachines.join(',')
 }),
 ...(!machineId &&
 filters.selectedUnidadesMoviles.length > 0 && {
 unidadMovilIds: filters.selectedUnidadesMoviles.join(',')
 }),
 ...(pendingSortOrder && { sortOrder: pendingSortOrder })
 });

 params.append('page', pageToLoad.toString());
 params.append('pageSize', PAGE_SIZE.toString());

 const response = await fetch(`/api/maintenance/pending?${params.toString()}`);
 if (response.ok) {
 const data = await response.json();
 const incoming: EnhancedWorkOrder[] = data.maintenances || [];
 setPendingMaintenances(prev =>
 append ? mergeItemsUnique(prev, incoming) : incoming
 );
 setPendingHasMore(data.pagination?.hasMore ?? incoming.length === PAGE_SIZE);
 setPendingPage(pageToLoad);
 setForceRender(Date.now());
 if (!append) {
 setPendingDataLoaded(true);
 }
 if (append) {
 if (incoming.length > 0) {
 setPendingTailHeight(0);
 } else {
 setPendingTailHeight(prev => prev + INFINITE_SCROLL_SPACER);
 }
 } else {
 setPendingTailHeight(0);
 }
 } else {
 console.error(
 '❌ Error response from pending API:',
 response.status,
 response.statusText
 );
 if (!append) {
 setPendingMaintenances([]);
 }
 setPendingHasMore(false);
 if (!append) {
 setPendingTailHeight(0);
 }
 }
 } catch (error) {
 console.error('Error fetching pending maintenances:', error);
 if (!append) {
 setPendingMaintenances([]);
 }
 setPendingHasMore(false);
 if (!append) {
 setPendingTailHeight(0);
 }
 } finally {
 setPendingLoadingMore(false);
 }
 },
 [PAGE_SIZE, companyId, filters, machineId, pendingSortOrder, selectedSectorFilter]
 );

 const fetchCompletedMaintenances = async () => {
 try {
 const params = new URLSearchParams({
 companyId: companyId.toString(),
 ...(selectedSectorFilter && { sectorId: selectedSectorFilter.toString() }),
 ...(machineId && { machineId: machineId.toString() }),
 // NO enviar status a API completed porque ya está hardcodeado como COMPLETED
 // Agregar filtro de tiempo basado en completedTimeFilter
 ...(completedTimeFilter === 'today' && { todayOnly: 'true' }),
 ...(completedTimeFilter !== 'today' && { timeFilter: completedTimeFilter }),
 ...(filters.priority !== 'all' && { priority: filters.priority }),
 ...(filters.type !== 'all' && { type: filters.type }),
 ...(filters.frequency !== 'all' && (() => {
 const range = getFrequencyRange(filters.frequency);
 return range ? { minFrequencyDays: range.minDays, maxFrequencyDays: range.maxDays } : {};
 })()),
 ...(filters.searchTerm && { searchTerm: filters.searchTerm }),
 // Solo aplicar filtros de máquinas si NO se especifica un machineId específico
 ...(!machineId && filters.selectedMachines.length > 0 && { 
 machineIds: filters.selectedMachines.join(','),
 }),
 ...(!machineId && filters.selectedUnidadesMoviles.length > 0 && { 
 unidadMovilIds: filters.selectedUnidadesMoviles.join(','),
 })
 });

 const response = await fetch(`/api/maintenance/completed?${params}`);
 if (response.ok) {
 const data = await response.json();
 setCompletedMaintenances(data.maintenances || []);
 }
 } catch (error) {
 console.error('Error fetching completed maintenances:', error);
 setCompletedMaintenances([]);
 }
 };

 const fetchCompletedTodayMaintenances = useCallback(
 async (pageToLoad = 0, append = false) => {
 try {
 if (append) {
 setCompletedLoadingMore(true);
 } else {
 setCompletedLoadingMore(false);
 setCompletedHasMore(true);
 setCompletedPage(0);
 setCompletedTodayMaintenances([]);
 }

 const params = new URLSearchParams({
 companyId: companyId.toString(),
 todayOnly: 'true',
 ...(selectedSectorFilter && { sectorId: selectedSectorFilter.toString() }),
 ...(machineId && { machineId: machineId.toString() }),
 ...(filters.priority !== 'all' && { priority: filters.priority }),
 ...(filters.type !== 'all' && { type: filters.type }),
 ...(filters.frequency !== 'all' &&
 (() => {
 const range = getFrequencyRange(filters.frequency);
 return range
 ? { minFrequencyDays: range.minDays, maxFrequencyDays: range.maxDays }
 : {};
 })()),
 ...(filters.searchTerm && { searchTerm: filters.searchTerm }),
 ...(!machineId &&
 filters.selectedMachines.length > 0 && {
 machineIds: filters.selectedMachines.join(',')
 }),
 ...(!machineId &&
 filters.selectedUnidadesMoviles.length > 0 && {
 unidadMovilIds: filters.selectedUnidadesMoviles.join(',')
 })
 });

 params.append('page', pageToLoad.toString());
 params.append('pageSize', PAGE_SIZE.toString());

 const response = await fetch(`/api/maintenance/completed?${params.toString()}`);
 if (response.ok) {
 const data = await response.json();
 const incoming: EnhancedWorkOrder[] = data.maintenances || [];
 setCompletedTodayMaintenances(prev =>
 append ? mergeItemsUnique(prev, incoming) : incoming
 );
 setCompletedHasMore(data.pagination?.hasMore ?? incoming.length === PAGE_SIZE);
 setCompletedPage(pageToLoad);
 if (!append) {
 setCompletedDataLoaded(true);
 }
 if (append) {
 if (incoming.length > 0) {
 setCompletedTailHeight(0);
 } else {
 setCompletedTailHeight(prev => prev + INFINITE_SCROLL_SPACER);
 }
 } else {
 setCompletedTailHeight(0);
 }
 } else {
 console.error('❌ Error response from completed API:', response.status, response.statusText);
 if (!append) {
 setCompletedTodayMaintenances([]);
 }
 setCompletedHasMore(false);
 if (!append) {
 setCompletedTailHeight(0);
 }
 }
 } catch (error) {
 console.error('Error fetching completed today maintenances:', error);
 if (!append) {
 setCompletedTodayMaintenances([]);
 }
 setCompletedHasMore(false);
 if (!append) {
 setCompletedTailHeight(0);
 }
 } finally {
 setCompletedLoadingMore(false);
 }
 },
 [PAGE_SIZE, companyId, filters, machineId, selectedSectorFilter]
 );

 const fetchRescheduledMaintenances = async () => {
 try {
 // Fetching rescheduled maintenances
 
 const params = new URLSearchParams({
 companyId: companyId.toString(),
 rescheduled: 'true',
 ...(selectedSectorFilter && { sectorId: selectedSectorFilter.toString() }),
 ...(machineId && { machineId: machineId.toString() }),
 ...(filters.priority !== 'all' && { priority: filters.priority }),
 ...(filters.type !== 'all' && { type: filters.type }),
 ...(filters.frequency !== 'all' && (() => {
 const range = getFrequencyRange(filters.frequency);
 return range ? { minFrequencyDays: range.minDays, maxFrequencyDays: range.maxDays } : {};
 })()),
 ...(filters.searchTerm && { searchTerm: filters.searchTerm }),
 ...(!machineId && filters.selectedMachines.length > 0 && { 
 machineIds: filters.selectedMachines.join(',')
 }),
 ...(!machineId && filters.selectedUnidadesMoviles.length > 0 && { 
 unidadMovilIds: filters.selectedUnidadesMoviles.join(',')
 })
 });

 const response = await fetch(`/api/maintenance/pending?${params.toString()}`);
 
 if (response.ok) {
 const data = await response.json();
 // Rescheduled maintenances loaded
 setRescheduledMaintenances(data.maintenances || []);
 } else {
 console.error('❌ Error response from rescheduled API:', response.status, response.statusText);
 }
 } catch (error) {
 console.error('Error fetching rescheduled maintenances:', error);
 setRescheduledMaintenances([]);
 }
 };

 const fetchAllMaintenances = useCallback(
 async (pageToLoad = 0, append = false) => {
 try {
 if (append) {
 setAllLoadingMore(true);
 } else {
 setAllLoadingMore(false);
 setAllHasMore(true);
 setAllPage(0);
 setAllMaintenances([]);
 }

 const params = new URLSearchParams({
 companyId: companyId.toString(),
 ...(selectedSectorFilter && { sectorId: selectedSectorFilter.toString() }),
 ...(machineId && { machineId: machineId.toString() }),
 ...(filters.status !== 'all' && { status: filters.status }),
 ...(filters.priority !== 'all' && { priority: filters.priority }),
 ...(filters.type !== 'all' && { type: filters.type }),
 ...(filters.frequency !== 'all' &&
 (() => {
 const range = getFrequencyRange(filters.frequency);
 return range
 ? { minFrequencyDays: range.minDays, maxFrequencyDays: range.maxDays }
 : {};
 })()),
 ...(filters.searchTerm && { searchTerm: filters.searchTerm }),
 ...(!machineId &&
 filters.selectedMachines.length > 0 && {
 machineIds: filters.selectedMachines.join(',')
 }),
 ...(!machineId &&
 filters.selectedUnidadesMoviles.length > 0 && {
 unidadMovilIds: filters.selectedUnidadesMoviles.join(',')
 })
 });

 params.append('page', pageToLoad.toString());
 params.append('pageSize', PAGE_SIZE.toString());

 const response = await fetch(`/api/maintenance/all?${params.toString()}`);
 if (response.ok) {
 const data = await response.json();
 const incoming: EnhancedWorkOrder[] = data.maintenances || [];
 setAllMaintenances(prev => (append ? mergeItemsUnique(prev, incoming) : incoming));
 setAllHasMore(data.pagination?.hasMore ?? incoming.length === PAGE_SIZE);
 setAllPage(pageToLoad);
 if (append) {
 if (incoming.length > 0) {
 setAllTailHeight(0);
 } else {
 setAllTailHeight(prev => prev + INFINITE_SCROLL_SPACER);
 }
 } else {
 setAllTailHeight(0);
 }
 } else {
 console.error(
 '❌ Error response from fetchAllMaintenances:',
 response.status,
 response.statusText
 );
 if (!append) {
 setAllMaintenances([]);
 }
 setAllHasMore(false);
 if (!append) {
 setAllTailHeight(0);
 }
 }
 } catch (error) {
 console.error('Error fetching all maintenances:', error);
 if (!append) {
 setAllMaintenances([]);
 }
 setAllHasMore(false);
 if (!append) {
 setAllTailHeight(0);
 }
 } finally {
 setAllLoadingMore(false);
 }
 },
 [PAGE_SIZE, companyId, filters, machineId, selectedSectorFilter]
 );

 const fetchMaintenanceHistory = useCallback(
 async (pageToLoad = 0, append = false) => {
 try {
 if (append) {
 setHistoryLoadingMore(true);
 } else {
 setHistoryLoadingMore(false);
 setHistoryHasMore(true);
 setHistoryPage(0);
 setMaintenanceHistory([]);
 }

 const params = new URLSearchParams();
 params.append('companyId', companyId.toString());
 if (selectedSectorFilter) {
 params.append('sectorId', selectedSectorFilter.toString());
 }
 if (machineId) {
 params.append('machineId', machineId.toString());
 }
 if (historySearchTerm) {
 params.append('searchTerm', historySearchTerm);
 }
 if (!machineId && filters.selectedMachines.length > 0) {
 params.append('machineIds', filters.selectedMachines.join(','));
 }
 if (!machineId && filters.selectedUnidadesMoviles.length > 0) {
 params.append('unidadMovilIds', filters.selectedUnidadesMoviles.join(','));
 }

 params.append('page', pageToLoad.toString());
 params.append('pageSize', PAGE_SIZE.toString());

 const response = await fetch(`/api/maintenance/history?${params.toString()}`);
 if (response.ok) {
 const data = await response.json();
 const executions: MaintenanceHistoryItem[] = data.data?.executions || [];

 setMaintenanceHistory(prev => {
 const merged = append ? mergeItemsUnique(prev, executions) : executions;
 updateHistorySuggestions(merged);
 return merged;
 });
 setHistoryHasMore(data.pagination?.hasMore ?? executions.length === PAGE_SIZE);
 setHistoryPage(pageToLoad);
 if (append) {
 if (executions.length > 0) {
 setHistoryTailHeight(0);
 } else {
 setHistoryTailHeight(prev => prev + INFINITE_SCROLL_SPACER);
 }
 } else {
 setHistoryTailHeight(0);
 }
 } else {
 console.error(
 '❌ Failed to fetch maintenance history:',
 response.status,
 response.statusText
 );
 if (!append) {
 setMaintenanceHistory([]);
 }
 setHistoryHasMore(false);
 if (!append) {
 setHistoryTailHeight(0);
 }
 }
 } catch (error) {
 console.error('Error fetching maintenance history:', error);
 if (!append) {
 setMaintenanceHistory([]);
 }
 setHistoryHasMore(false);
 if (!append) {
 setHistoryTailHeight(0);
 }
 } finally {
 setHistoryLoadingMore(false);
 }
 },
 [
 PAGE_SIZE,
 companyId,
 filters.selectedMachines,
 filters.selectedUnidadesMoviles,
 historySearchTerm,
 machineId,
 sectorId,
 updateHistorySuggestions
 ]
 );

 useEffect(() => {
 const element = pendingLoadMoreRef.current;
 if (!element) return;

 const observer = new IntersectionObserver(
 ([entry]) => {
 if (
 entry.isIntersecting &&
 activeTab === 'pending' &&
 pendingHasMore &&
 !pendingLoadingMore
 ) {
 fetchPendingMaintenances(pendingPage + 1, true);
 } else if (
 entry.isIntersecting &&
 activeTab === 'pending' &&
 !pendingHasMore
 ) {
 setPendingTailHeight(prev => prev + INFINITE_SCROLL_SPACER);
 }
 },
 { root: null, rootMargin: '200px' }
 );

 observer.observe(element);
 return () => observer.disconnect();
 }, [
 activeTab,
 pendingHasMore,
 pendingLoadingMore,
 fetchPendingMaintenances,
 pendingPage
 ]);

 useEffect(() => {
 const element = completedLoadMoreRef.current;
 if (!element) return;

 const observer = new IntersectionObserver(
 ([entry]) => {
 if (
 entry.isIntersecting &&
 activeTab === 'completed-today' &&
 completedHasMore &&
 !completedLoadingMore
 ) {
 fetchCompletedTodayMaintenances(completedPage + 1, true);
 } else if (
 entry.isIntersecting &&
 activeTab === 'completed-today' &&
 !completedHasMore
 ) {
 setCompletedTailHeight(prev => prev + INFINITE_SCROLL_SPACER);
 }
 },
 { root: null, rootMargin: '200px' }
 );

 observer.observe(element);
 return () => observer.disconnect();
 }, [
 activeTab,
 completedHasMore,
 completedLoadingMore,
 fetchCompletedTodayMaintenances,
 completedPage
 ]);

 useEffect(() => {
 const element = allLoadMoreRef.current;
 if (!element) return;

 const observer = new IntersectionObserver(
 ([entry]) => {
 if (
 entry.isIntersecting &&
 activeTab === 'all' &&
 allHasMore &&
 !allLoadingMore
 ) {
 fetchAllMaintenances(allPage + 1, true);
 } else if (
 entry.isIntersecting &&
 activeTab === 'all' &&
 !allHasMore
 ) {
 setAllTailHeight(prev => prev + INFINITE_SCROLL_SPACER);
 }
 },
 { root: null, rootMargin: '200px' }
 );

 observer.observe(element);
 return () => observer.disconnect();
 }, [
 activeTab,
 allHasMore,
 allLoadingMore,
 fetchAllMaintenances,
 allPage
 ]);

 useEffect(() => {
 const element = historyLoadMoreRef.current;
 if (!element) return;

 const observer = new IntersectionObserver(
 ([entry]) => {
 if (
 entry.isIntersecting &&
 activeTab === 'history' &&
 historyHasMore &&
 !historyLoadingMore
 ) {
 fetchMaintenanceHistory(historyPage + 1, true);
 } else if (
 entry.isIntersecting &&
 activeTab === 'history' &&
 !historyHasMore
 ) {
 setHistoryTailHeight(prev => prev + INFINITE_SCROLL_SPACER);
 }
 },
 { root: null, rootMargin: '200px' }
 );

 observer.observe(element);
 return () => observer.disconnect();
 }, [
 activeTab,
 historyHasMore,
 historyLoadingMore,
 fetchMaintenanceHistory,
 historyPage
 ]);

 const fetchChecklists = async (reset = false, pageOverride?: number) => {
 try {
 const page = reset ? 0 : (pageOverride !== undefined ? pageOverride : checklistsPage);
 const skip = page * 10;
 const take = 10;

 // Fetching checklists
 const params = new URLSearchParams({
 companyId: companyId.toString(),
 ...(selectedSectorFilter && { sectorId: selectedSectorFilter.toString() }),
 ...(machineId && { machineId: machineId.toString() }),
 skip: skip.toString(),
 take: take.toString()
 });

 if (reset) {
 setLoading(true);
 } else {
 setLoadingMoreChecklists(true);
 }

 const response = await fetch(`/api/maintenance/checklists?${params}`);
 
 if (response.ok) {
 const data = await response.json();
 const checklistsArray = data.checklists || data || [];
 
 if (reset) {
 setChecklists(checklistsArray);
 setChecklistsPage(1);
 setChecklistsTailHeight(0);
 setChecklistsDataLoaded(true);
 } else {
 setChecklists(prev => [...prev, ...checklistsArray]);
 setChecklistsPage(prev => prev + 1);
 if (checklistsArray.length === 0) {
 setChecklistsTailHeight(prev => prev + INFINITE_SCROLL_SPACER);
 } else {
 setChecklistsTailHeight(0);
 }
 }
 
 setHasMoreChecklists(data.hasMore !== false && checklistsArray.length === take);
 } else {
 console.error('❌ Error response from checklists API:', response.status, response.statusText);
 const errorData = await response.json();
 console.error('❌ Error details:', errorData);
 }
 } catch (error) {
 console.error('❌ Error fetching checklists:', error);
 if (reset) {
 setChecklists([]);
 setChecklistsTailHeight(0);
 }
 } finally {
 setLoading(false);
 setLoadingMoreChecklists(false);
 }
 };

 const loadMoreChecklists = useCallback(() => {
 if (!loadingMoreChecklists && hasMoreChecklists) {
 setChecklistsPage(currentPage => {
 fetchChecklists(false, currentPage);
 return currentPage;
 });
 }
 }, [hasMoreChecklists, loadingMoreChecklists]);

 // IntersectionObserver para scroll infinito
 useEffect(() => {
 if (!hasMoreChecklists) return;

 const container = checklistsContainerRef.current?.parentElement;
 if (!container) return;

 const observer = new IntersectionObserver(
 (entries) => {
 const first = entries[0];
 if (first.isIntersecting && hasMoreChecklists && !loadingMoreChecklists) {
 loadMoreChecklists();
 } else if (first.isIntersecting && !hasMoreChecklists) {
 setChecklistsTailHeight(prev => prev + INFINITE_SCROLL_SPACER);
 }
 },
 { 
 threshold: 0.1,
 root: container,
 rootMargin: '100px' // Cargar cuando esté a 100px del final
 }
 );

 const currentTrigger = loadMoreTriggerRef.current;
 if (currentTrigger) {
 observer.observe(currentTrigger);
 }

 return () => {
 if (currentTrigger) {
 observer.unobserve(currentTrigger);
 }
 };
 }, [hasMoreChecklists, loadingMoreChecklists, loadMoreChecklists]);

 // ❌ ELIMINADO DE fetchMaintenanceData: Esta función ya NO se llama
 // Los KPIs ahora vienen desde dashboardData.kpis (sin fetch separado)
 const fetchKPIs = async () => {
 // Esta función se mantiene por si se necesita en el futuro, pero ya NO se usa
 return; // Early return - no ejecutar
 
 try {
 const params = new URLSearchParams({
 companyId: companyId.toString(),
 ...(selectedSectorFilter && { sectorId: selectedSectorFilter.toString() }),
 ...(machineId && { machineId: machineId.toString() })
 });

 const response = await fetch(`/api/maintenance/kpis?${params}`);
 if (response.ok) {
 const data = await response.json();
 setKpis(data);
 }
 } catch (error) {
 console.error('Error fetching KPIs:', error);
 // KPIs por defecto
 setKpis({
 totalMaintenances: 0,
 completedOnTime: 0,
 overdueMaintenance: 0,
 avgCompletionTime: 0,
 avgMTTR: 0,
 avgMTBF: 0,
 completionRate: 0,
 costEfficiency: 0,
 qualityScore: 0,
 uptime: 0,
 downtime: 0,
 preventiveVsCorrective: {
 preventive: 0,
 corrective: 0
 }
 });
 }
 };

 const getPriorityColor = (priority: string) => {
 switch (priority) {
 case 'LOW': return 'bg-muted text-foreground';
 case 'MEDIUM': return 'bg-warning-muted text-warning-muted-foreground';
 case 'HIGH': return 'bg-warning-muted text-warning-muted-foreground';
 case 'URGENT': return 'bg-destructive/10 text-destructive';
 default: return 'bg-muted text-foreground';
 }
 };

 const getStatusColor = (status: string) => {
 switch (status) {
 case 'PENDING': return 'bg-warning-muted text-warning-muted-foreground';
 case 'IN_PROGRESS': return 'bg-info-muted text-info-muted-foreground';
 case 'COMPLETED': return 'bg-success-muted text-success-muted-foreground';
 case 'CANCELLED': return 'bg-muted text-foreground';
 case 'ON_HOLD': return 'bg-accent-purple-muted text-accent-purple-muted-foreground';
 default: return 'bg-muted text-foreground';
 }
 };

 const getPriorityLabel = (priority: string) => {
 switch (priority) {
 case 'LOW': return 'Baja';
 case 'MEDIUM': return 'Media';
 case 'HIGH': return 'Alta';
 case 'URGENT': return 'Urgente';
 default: return priority;
 }
 };

 const translateExecutionWindow = (window: string) => {
 const translations = {
 '1': 'Antes del inicio',
 '2': 'Mitad del turno',
 '3': 'Fin del turno',
 '4': 'Cualquier momento',
 '5': 'Programado',
 '6': 'Fin de semana',
 'NONE': 'Sin especificar',
 'BEFORE_START': 'Antes del inicio',
 'MID_SHIFT': 'Mitad del turno',
 'END_SHIFT': 'Fin del turno',
 'ANY_TIME': 'Cualquier momento',
 'SCHEDULED': 'Programado',
 'WEEKEND': 'Fin de semana'
 };
 return translations[window as keyof typeof translations] || 'Sin especificar';
 };

 const translatePriority = (priority: string) => {
 const translations: { [key: string]: string } = {
 'LOW': 'Baja',
 'MEDIUM': 'Media',
 'HIGH': 'Alta',
 'URGENT': 'Urgente',
 'CRITICAL': 'Crítica'
 };
 
 return translations[priority] || priority;
 };

 // SLA status basado en scheduledDate
 const getSLAStatus = (maintenance: EnhancedWorkOrder): { label: string; className: string } | null => {
 const scheduled = maintenance.scheduledDate;
 if (!scheduled) return null;
 const now = new Date();
 const scheduledDate = new Date(scheduled);
 const diffMs = scheduledDate.getTime() - now.getTime();
 const diffDays = diffMs / (1000 * 60 * 60 * 24);

 if (diffDays < 0) {
 const overdueDays = Math.abs(Math.ceil(diffDays));
 return { label: `Vencido ${overdueDays}d`, className: 'bg-destructive/10 text-destructive border-destructive/30' };
 }
 if (diffDays < 1) {
 return { label: 'Vence hoy', className: 'bg-warning-muted text-warning-muted-foreground border-warning-muted' };
 }
 if (diffDays <= 3) {
 return { label: `Vence en ${Math.ceil(diffDays)}d`, className: 'bg-warning-muted text-warning-muted-foreground border-warning-muted' };
 }
 return { label: 'En tiempo', className: 'bg-success-muted text-success-muted-foreground border-success-muted' };
 };

 const getStatusLabel = (status: string) => {
 switch (status) {
 case 'PENDING': return 'Pendiente';
 case 'IN_PROGRESS': return 'En Progreso';
 case 'COMPLETED': return 'Completado';
 case 'CANCELLED': return 'Cancelado';
 case 'ON_HOLD': return 'En Espera';
 default: return status;
 }
 };

 const getFrequencyFromDays = (days: number) => {
 if (days <= 1) return 'Diaria';
 if (days >= 2 && days <= 7) return 'Semanal';
 if (days >= 8 && days <= 15) return 'Quincenal';
 if (days >= 16 && days <= 30) return 'Mensual';
 if (days >= 31 && days <= 90) return 'Trimestral';
 if (days >= 91 && days <= 180) return 'Semestral';
 if (days >= 181 && days <= 365) return 'Anual';
 return 'Personalizada';
 };

 const getFrequencyColor = (days: number) => {
 if (days <= 1) return 'bg-destructive/10 text-destructive border-destructive/30';
 if (days >= 2 && days <= 7) return 'bg-warning-muted text-warning-muted-foreground border-warning-muted';
 if (days >= 8 && days <= 15) return 'bg-warning-muted text-warning-muted-foreground border-warning-muted';
 if (days >= 16 && days <= 30) return 'bg-info-muted text-info-muted-foreground border-info-muted';
 if (days >= 31 && days <= 90) return 'bg-accent-purple-muted text-accent-purple-muted-foreground border-accent-purple-muted';
 if (days >= 91 && days <= 180) return 'bg-indigo-100 text-indigo-800 border-indigo-200';
 if (days >= 181 && days <= 365) return 'bg-success-muted text-success-muted-foreground border-success-muted';
 return 'bg-muted text-foreground border-border';
 };

 // Funciones para manejar filtro de máquinas y unidades móviles
 const handleMachineToggle = (machineId: number) => {
 // Toggling machine filter
 setFilters(prev => {
 const newSelectedMachines = prev.selectedMachines.includes(machineId)
 ? prev.selectedMachines.filter(id => id !== machineId)
 : [...prev.selectedMachines, machineId];
 return {
 ...prev,
 selectedMachines: newSelectedMachines
 };
 });
 };

 const handleUnidadMovilToggle = (unidadId: number) => {
 // Toggling unidad móvil filter
 setFilters(prev => {
 const unidadIdStr = unidadId.toString();
 const newSelectedUnidadesMoviles = prev.selectedUnidadesMoviles.includes(unidadIdStr)
 ? prev.selectedUnidadesMoviles.filter(id => id !== unidadIdStr)
 : [...prev.selectedUnidadesMoviles, unidadIdStr];
 return {
 ...prev,
 selectedUnidadesMoviles: newSelectedUnidadesMoviles
 };
 });
 };

 const handleSelectAllMachines = () => {
 const allMachines = availableMachines.map(machine => machine.id.toString());
 const allUnidadesMoviles = availableUnidadesMoviles.map(unidad => unidad.id.toString());
 setFilters(prev => ({
 ...prev,
 selectedMachines: allMachines,
 selectedUnidadesMoviles: allUnidadesMoviles
 }));
 };

 const handleClearMachineFilter = () => {
 setFilters(prev => ({
 ...prev,
 selectedMachines: [],
 selectedUnidadesMoviles: []
 }));
 };

 // Función para obtener todos los elementos disponibles (máquinas + unidades móviles)
 const getAllAvailableItems = () => {
 const machines = availableMachines.map(machine => ({
 ...machine,
 type: 'MACHINE',
 displayName: machine.name,
 displayType: machine.type === 'PRODUCTION' ? 'Producción' : 
 machine.type === 'TRANSPORTATION' ? 'Transporte' :
 machine.type === 'UTILITY' ? 'Utilidad' : 'Otros',
 displayStatus: machine.status === 'ACTIVE' ? 'Activo' :
 machine.status === 'INACTIVE' ? 'Inactivo' :
 machine.status === 'MAINTENANCE' ? 'Mantenimiento' :
 machine.status === 'OUT_OF_SERVICE' ? 'Fuera de Servicio' : machine.status
 }));
 
 const unidades = availableUnidadesMoviles.map(unidad => ({
 ...unidad,
 type: 'UNIDAD_MOVIL',
 displayName: unidad.nombre,
 displayType: 'Unidad Móvil',
 displayStatus: unidad.estado === 'ACTIVO' ? 'Activo' :
 unidad.estado === 'INACTIVO' ? 'Inactivo' :
 unidad.estado === 'MANTENIMIENTO' ? 'Mantenimiento' :
 unidad.estado === 'FUERA_DE_SERVICIO' ? 'Fuera de Servicio' : unidad.estado
 }));
 
 return [...machines, ...unidades];
 };

 // Función para obtener categorías de máquinas y unidades móviles
 const getMachineCategories = () => {
 const allItems = getAllAvailableItems();
 const categories = allItems.reduce((acc, item: any) => {
 let category;
 if (item.type === 'UNIDAD_MOVIL') {
 category = 'Unidades Móviles';
 } else {
 category = item.displayType;
 }
 
 if (!acc[category]) {
 acc[category] = [];
 }
 acc[category].push(item);
 return acc;
 }, {} as Record<string, any[]>);
 
 return categories;
 };

 // Función para seleccionar toda una categoría
 const handleSelectCategory = (category: string) => {
 const categories = getMachineCategories();
 const categoryMachines = categories[category] || [];
 const categoryMachineIds = categoryMachines.filter((machine: any) => machine.type === 'MACHINE').map((machine: any) => machine.id.toString());
 const categoryUnidadMovilIds = categoryMachines.filter((machine: any) => machine.type === 'UNIDAD_MOVIL').map((machine: any) => machine.id.toString());
 
 setFilters(prev => ({
 ...prev,
 selectedMachines: [...prev.selectedMachines, ...categoryMachineIds],
 selectedUnidadesMoviles: [...prev.selectedUnidadesMoviles, ...categoryUnidadMovilIds]
 }));
 };

 // Función para deseleccionar toda una categoría
 const handleDeselectCategory = (category: string) => {
 const categories = getMachineCategories();
 const categoryMachines = categories[category] || [];
 const categoryMachineIds = categoryMachines.filter((machine: any) => machine.type === 'MACHINE').map((machine: any) => machine.id.toString());
 const categoryUnidadMovilIds = categoryMachines.filter((machine: any) => machine.type === 'UNIDAD_MOVIL').map((machine: any) => machine.id.toString());
 
 setFilters(prev => ({
 ...prev,
 selectedMachines: prev.selectedMachines.filter(id => !categoryMachineIds.includes(id)),
 selectedUnidadesMoviles: prev.selectedUnidadesMoviles.filter(id => !categoryUnidadMovilIds.includes(id))
 }));
 };

 // Función para mostrar mantenimientos en pantalla
 // Funciones para manejar eventos del calendario
 const handleEventClick = (event: any) => {
 // Buscar el mantenimiento completo en allMaintenances
 const maintenance = allMaintenances.find(m => m.id.toString() === event.id);
 if (maintenance) {
 setSelectedMaintenance(maintenance);
 setIsDetailDialogOpen(true);
 }
 };

 const handleEventSelect = (event: any) => {
 // Buscar el mantenimiento completo en allMaintenances
 const maintenance = allMaintenances.find(m => m.id.toString() === event.id);
 if (maintenance) {
 setSelectedMaintenance(maintenance);
 setIsDetailDialogOpen(true);
 }
 };

 const handleEventEdit = (event: any) => {
 // Buscar el mantenimiento completo en allMaintenances
 const maintenance = allMaintenances.find(m => m.id.toString() === event.id);
 if (maintenance) {
 setEditingMaintenance(maintenance);
 if (maintenance.type === 'PREVENTIVE' || maintenance.isPreventive) {
 setIsPreventiveDialogOpen(true);
 } else {
 setIsCorrectiveDialogOpen(true);
 }
 }
 };


 const handleViewScreen = async (filters: {
 machineIds?: number[] | string[];
 unidadMovilIds?: number[] | string[];
 maintenanceTypes?: string[];
 selectedMachines?: string[];
 selectedUnidadesMoviles?: string[];
 assetTypeFilter?: string[];
 }) => {
 try {
 // Applying filters to maintenances
 
 // Manejar diferentes estructuras de filtros y convertir a string[]
 const machineIds = (filters.machineIds || filters.selectedMachines || []).map(id => id.toString());
 const unidadMovilIds = (filters.unidadMovilIds || filters.selectedUnidadesMoviles || []).map(id => id.toString());
 const maintenanceTypes = filters.maintenanceTypes || filters.assetTypeFilter || [];
 
 // Obtener datos de mantenimientos filtrados
 const params = new URLSearchParams({
 companyId: companyId.toString(),
 ...(selectedSectorFilter && { sectorId: selectedSectorFilter.toString() }),
 maintenanceTypes: maintenanceTypes.join(',')
 });
 
 if (machineIds.length > 0) {
 params.append('machineIds', machineIds.join(','));
 }
 
 if (unidadMovilIds.length > 0) {
 params.append('unidadMovilIds', unidadMovilIds.join(','));
 }
 
 const url = `/api/maintenance/pdf-data?${params.toString()}`;
 log('🔗 URL construida:', url);
 const response = await fetch(url);
 
 if (!response.ok) {
 throw new Error('Error al obtener datos de mantenimientos');
 }
 
 const result = await response.json();
 
 if (!result.success) {
 throw new Error(result.error || 'Error al obtener datos');
 }
 
 log('✅ Datos obtenidos para pantalla:', result.data);
 
 // Mostrar en pantalla
 log('📺 Mostrando en pantalla:', result.data);
 // Normalizar filtros para que MaintenanceScreenView los entienda
 const normalizedFilters = {
 ...filters,
 maintenanceTypes: filters.maintenanceTypes || filters.assetTypeFilter || ['PREVENTIVE', 'CORRECTIVE']
 };
 setMaintenanceScreenData({
 data: result.data,
 filters: normalizedFilters,
 companyName: currentCompany?.name || 'Empresa'
 });
 setShowMaintenanceScreen(true);
 
 toast({
 title: '📺 Vista en Pantalla',
 description: 'Los mantenimientos se están mostrando en pantalla',
 });
 
 } catch (error) {
 console.error('❌ Error mostrando mantenimientos:', error);
 toast({
 title: '❌ Error',
 description: 'No se pudo mostrar el listado de mantenimientos',
 variant: 'destructive',
 });
 }
 };

 // formatDate and formatDateTime are now imported from @/lib/date-utils

 const getExecutionWindowLabel = (window: ExecutionWindow) => {
 const labels = {
 BEFORE_START: 'Antes del turno',
 MID_SHIFT: 'Mitad del turno',
 END_SHIFT: 'Fin del turno',
 ANY_TIME: 'Cualquier momento',
 SCHEDULED: 'Horario específico'
 };
 return labels[window] || window;
 };

 const getTimeUnitLabel = (unit: TimeUnit) => {
 const labels = {
 HOURS: 'Horas',
 MINUTES: 'Minutos',
 DAYS: 'Días',
 CYCLES: 'Ciclos',
 KILOMETERS: 'Kilómetros',
 SHIFTS: 'Turnos',
 UNITS_PRODUCED: 'Unidades producidas'
 };
 return labels[unit] || unit;
 };

 // Helper para formatear horas decimales a formato legible
 const formatHoursToReadable = (hours: number): string => {
 if (!hours || isNaN(hours)) return '';
 const totalMinutes = Math.round(hours * 60);
 if (totalMinutes < 60) {
 return `${totalMinutes}min`;
 }
 const h = Math.floor(totalMinutes / 60);
 const m = totalMinutes % 60;
 if (m === 0) {
 return `${h}h`;
 }
 return `${h}h ${m}min`;
 };

 const getDurationDisplay = (maintenance: any) => {
 // PRIORIDAD 1: Si está completado y tiene actualHours, mostrar tiempo real
 if (maintenance.status === 'COMPLETED' && maintenance.actualHours && maintenance.actualHours > 0) {
 return `Duración: ${formatHoursToReadable(maintenance.actualHours)}`;
 }

 // Para unidades móviles, usar estimatedMinutes y estimatedTimeType (prioridad alta)
 if (maintenance.unidadMovilId || maintenance.unidadMovil) {
 if (maintenance.estimatedMinutes && maintenance.estimatedMinutes > 0) {
 if (maintenance.estimatedTimeType === 'HOURS') {
 const hours = Math.floor(maintenance.estimatedMinutes / 60);
 const minutes = maintenance.estimatedMinutes % 60;
 if (hours > 0 && minutes > 0) {
 return `Duración: ${hours}h ${minutes}m`;
 } else if (hours > 0) {
 return `Duración: ${hours}h`;
 } else {
 return `Duración: ${minutes}m`;
 }
 } else {
 return `Duración: ${maintenance.estimatedMinutes}m`;
 }
 }
 // Fallback a timeValue y timeUnit si estimatedMinutes no está disponible
 if (maintenance.timeValue && maintenance.timeUnit) {
 const unitText = getTimeUnitLabel(maintenance.timeUnit);
 return `Duración: ${maintenance.timeValue}${unitText === 'Horas' ? 'h' : 'm'}`;
 }
 // Fallback a estimatedHours
 if (maintenance.estimatedHours && maintenance.estimatedHours > 0) {
 return `Duración: ${formatHoursToReadable(maintenance.estimatedHours)}`;
 }
 return 'Sin tiempo estimado';
 }

 // Para máquinas, usar timeValue y timeUnit
 if (maintenance.timeValue && maintenance.timeUnit) {
 const unitText = getTimeUnitLabel(maintenance.timeUnit);
 return `Duración: ${maintenance.timeValue}${unitText === 'Horas' ? 'h' : 'm'}`;
 }

 // Fallback a estimatedHours para cualquier tipo de mantenimiento
 if (maintenance.estimatedHours && maintenance.estimatedHours > 0) {
 return `Duración: ${formatHoursToReadable(maintenance.estimatedHours)}`;
 }

 return 'Sin tiempo estimado';
 };

 const formatFrequency = (frequency: number | string, unit?: string): string => {
 // Si frequency es un string (como "MONTHLY"), usar getFrequencyLabel
 if (typeof frequency === 'string') {
 return getFrequencyLabel(frequency);
 }
 
 // Si frequency es número pero no hay unit, asumir DAYS
 const actualUnit = unit || 'DAYS';
 
 if (!frequency || !actualUnit) {
 return 'Diaria (1 día)';
 }
 
 // Si la unidad no es DAYS, usar el formato original
 if (actualUnit.toUpperCase() !== 'DAYS') {
 const unitMap: { [key: string]: string } = {
 'WEEKS': 'semanas',
 'MONTHS': 'meses',
 'YEARS': 'años',
 'HOURS': 'horas',
 'KILOMETERS': 'kilómetros'
 };
 const unitText = unitMap[actualUnit.toUpperCase()] || actualUnit.toLowerCase();
 return `Cada ${frequency} ${unitText}`;
 }
 
 // Para DAYS, usar los rangos como en la imagen
 const days = frequency;
 
 if (days === 1) {
 return 'Diaria (1 día)';
 } else if (days >= 2 && days <= 7) {
 return 'Semanal (2-7 días)';
 } else if (days >= 8 && days <= 15) {
 return 'Quincenal (8-15 días)';
 } else if (days >= 16 && days <= 30) {
 return 'Mensual (16-30 días)';
 } else if (days >= 31 && days <= 90) {
 return 'Trimestral (31-90 días)';
 } else if (days >= 91 && days <= 180) {
 return 'Semestral (91-180 días)';
 } else if (days >= 181 && days <= 365) {
 return 'Anual (181-365 días)';
 } else {
 // Para frecuencias fuera de los rangos estándar
 return `Cada ${days} días`;
 }
 };

 // Función helper para calcular fechas correctamente considerando meses con diferentes días
 const calculateNextDate = (completedDate: Date, frequency: number, frequencyUnit: string): Date => {
 const nextDate = new Date(completedDate);
 
 switch (frequencyUnit) {
 case 'DAYS':
 nextDate.setDate(completedDate.getDate() + frequency);
 break;
 case 'WEEKS':
 nextDate.setDate(completedDate.getDate() + (frequency * 7));
 break;
 case 'MONTHS':
 // Manejar correctamente los meses con diferentes días
 const targetMonth = completedDate.getMonth() + frequency;
 const targetYear = completedDate.getFullYear() + Math.floor(targetMonth / 12);
 const finalMonth = targetMonth % 12;
 
 // Obtener el último día del mes objetivo
 const lastDayOfTargetMonth = new Date(targetYear, finalMonth + 1, 0).getDate();
 
 // Si el día actual es mayor al último día del mes objetivo, usar el último día
 const targetDay = Math.min(completedDate.getDate(), lastDayOfTargetMonth);
 
 nextDate.setFullYear(targetYear);
 nextDate.setMonth(finalMonth);
 nextDate.setDate(targetDay);
 break;
 case 'YEARS':
 // Manejar años bisiestos
 const targetYearForYear = completedDate.getFullYear() + frequency;
 const isLeapYear = (targetYearForYear % 4 === 0 && targetYearForYear % 100 !== 0) || (targetYearForYear % 400 === 0);
 
 // Si es 29 de febrero y el año objetivo no es bisiesto, usar 28 de febrero
 if (completedDate.getMonth() === 1 && completedDate.getDate() === 29 && !isLeapYear) {
 nextDate.setFullYear(targetYearForYear);
 nextDate.setMonth(1);
 nextDate.setDate(28);
 } else {
 nextDate.setFullYear(targetYearForYear);
 }
 break;
 default:
 // Default a 1 mes con manejo correcto
 const defaultTargetMonth = completedDate.getMonth() + 1;
 const defaultTargetYear = completedDate.getFullYear() + Math.floor(defaultTargetMonth / 12);
 const defaultFinalMonth = defaultTargetMonth % 12;
 
 const defaultLastDayOfTargetMonth = new Date(defaultTargetYear, defaultFinalMonth + 1, 0).getDate();
 const defaultTargetDay = Math.min(completedDate.getDate(), defaultLastDayOfTargetMonth);
 
 nextDate.setFullYear(defaultTargetYear);
 nextDate.setMonth(defaultFinalMonth);
 nextDate.setDate(defaultTargetDay);
 }
 
 return nextDate;
 };

 const getFrequencyLabel = (frequency: ChecklistFrequency | string) => {
 const labels = {
 DAILY: 'Diario',
 WEEKLY: 'Semanal',
 BIWEEKLY: 'Quincenal',
 MONTHLY: 'Mensual',
 QUARTERLY: 'Trimestral',
 SEMIANNUAL: 'Semestral',
 ANNUAL: 'Anual',
 YEARLY: 'Anual' // Alias para YEARLY
 };
 return labels[frequency as keyof typeof labels] || frequency;
 };

 // Componente de KPIs
 const KPICards = () => {
 // ⚠️ NO devolver null para evitar pantalla en blanco
 // Si no hay KPIs, mostrar valores por defecto
 if (!kpis) {
 return (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
 <Card>
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Completados a Tiempo</p>
 <p className="text-sm font-medium text-muted-foreground">--</p>
 </div>
 <CheckCircle className="h-4 w-4 text-muted-foreground" />
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">MTTR Promedio</p>
 <p className="text-sm font-medium text-muted-foreground">--</p>
 </div>
 <Timer className="h-4 w-4 text-muted-foreground" />
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">MTBF Promedio</p>
 <p className="text-sm font-medium text-muted-foreground">--</p>
 </div>
 <Activity className="h-4 w-4 text-muted-foreground" />
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Disponibilidad</p>
 <p className="text-sm font-medium text-muted-foreground">--</p>
 </div>
 <Target className="h-4 w-4 text-muted-foreground" />
 </div>
 </CardContent>
 </Card>
 </div>
 );
 }

 return (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
 <Card>
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Completados a Tiempo</p>
 <p className="text-sm font-medium text-success">{formatNumber(kpis.completionRate, 1)}%</p>
 </div>
 <CheckCircle className="h-4 w-4 text-success" />
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <div className="flex flex-col">
 <p className="text-xs text-muted-foreground">MTTR Promedio</p>
 <p className="text-xs text-muted-foreground">Tiempo promedio de reparación</p>
 </div>
 <p className="text-sm font-medium text-info-muted-foreground">{formatNumber(kpis.avgMTTR, 1)}h</p>
 </div>
 <Timer className="h-4 w-4 text-info-muted-foreground" />
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <div className="flex flex-col">
 <p className="text-xs text-muted-foreground">MTBF Promedio</p>
 <p className="text-xs text-muted-foreground">Tiempo promedio entre fallas</p>
 </div>
 <p className="text-sm font-medium text-accent-purple-muted-foreground">{formatNumber(kpis.avgMTBF, 1)}h</p>
 </div>
 <Activity className="h-4 w-4 text-accent-purple-muted-foreground" />
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Disponibilidad</p>
 <p className="text-sm font-medium text-indigo-600">{formatNumber(kpis.uptime, 1)}%</p>
 </div>
 <Target className="h-4 w-4 text-indigo-600" />
 </div>
 </CardContent>
 </Card>
 </div>
 );
 };

 // Función para limpiar todos los filtros
 const clearAllFilters = () => {
 setFilters({
 status: 'all',
 priority: 'all',
 type: 'all',
 frequency: 'all',
 dateRange: '30',
 searchTerm: '',
 selectedMachines: [],
 selectedUnidadesMoviles: [],
 assetTypeFilter: [],
 startDate: '',
 endDate: ''
 });
 setSearchInput('');
 
 // ✅ ARREGLADO: Recargar datos cuando se limpian los filtros
 // ✨ Usar hooks React Query para evitar duplicados
 switch (activeTab) {
 case 'pending':
 // ✨ Usar fetchAllMaintenances en lugar de pendingQuery (eliminado)
 fetchAllMaintenances(0, false, true);
 break;
 case 'completed-today':
 completedTodayQuery.refetch();
 break;
 case 'all':
 fetchAllMaintenances(0, false, true);
 break;
 case 'history':
 fetchMaintenanceHistory();
 break;
 case 'checklists':
 checklistsQuery.refetch();
 break;
 }
 };

 // Función para verificar si hay filtros activos
 const hasActiveFilters = () => {
 return (
 filters.status !== 'all' ||
 filters.priority !== 'all' ||
 filters.type !== 'all' ||
 filters.frequency !== 'all' ||
 filters.selectedMachines.length > 0 ||
 filters.selectedUnidadesMoviles.length > 0 ||
 filters.assetTypeFilter.length > 0 ||
 filters.startDate !== '' ||
 filters.endDate !== ''
 );
 };

 // ✅ ARREGLADO: Cargar todas las unidades móviles cuando se abre el modal de filtros
 useEffect(() => {
 if (isFiltersModalOpen && companyId && availableUnidadesMoviles.length === 0) {
 const loadAllUnidadesMoviles = async () => {
 try {
 const response = await fetch(`/api/mantenimiento/unidades-moviles?companyId=${companyId}`);
 if (response.ok) {
 const data = await response.json();
 if (data.success && data.unidades) {
 setAvailableUnidadesMoviles(data.unidades);
 }
 }
 } catch (error) {
 console.error('Error cargando unidades móviles:', error);
 }
 };
 loadAllUnidadesMoviles();
 }
 }, [isFiltersModalOpen, companyId, availableUnidadesMoviles.length]);

 // Cargar unidades móviles cuando se abre el modal de Listar
 useEffect(() => {
 if (isPDFFilterOpen && companyId && availableUnidadesMoviles.length === 0) {
 const loadAllUnidadesMoviles = async () => {
 try {
 const response = await fetch(`/api/mantenimiento/unidades-moviles?companyId=${companyId}`);
 if (response.ok) {
 const data = await response.json();
 if (data.success && data.unidades) {
 setAvailableUnidadesMoviles(data.unidades);
 }
 }
 } catch (error) {
 console.error('Error cargando unidades móviles:', error);
 }
 };
 loadAllUnidadesMoviles();
 }
 }, [isPDFFilterOpen, companyId, availableUnidadesMoviles.length]);

 // Función para abrir el modal de filtros
 const openFiltersModal = () => {
 setTempFilters(filters); // Inicializar con los filtros actuales
 setIsFiltersModalOpen(true);
 };

 // Filtrar equipos visibles (máquinas) según búsqueda y estado
 const filteredEquipmentMachines = useMemo(() => {
 let filtered = availableMachines;
 
 if (equipmentSearchTerm.trim()) {
 const searchLower = equipmentSearchTerm.toLowerCase();
 filtered = filtered.filter(m => 
 m.name?.toLowerCase().includes(searchLower) ||
 m.id?.toString().includes(searchLower) ||
 m.sector?.name?.toLowerCase().includes(searchLower) ||
 m.nickname?.toLowerCase().includes(searchLower)
 );
 }
 
 if (equipmentStatusFilter === 'active') {
 filtered = filtered.filter(m => m.status === 'ACTIVE');
 } else if (equipmentStatusFilter === 'inactive') {
 filtered = filtered.filter(m => m.status !== 'ACTIVE');
 }
 
 return filtered;
 }, [availableMachines, equipmentSearchTerm, equipmentStatusFilter]);

 // Filtrar equipos visibles (unidades móviles) según búsqueda y estado
 const filteredEquipmentMobiles = useMemo(() => {
 let filtered = availableUnidadesMoviles;
 
 if (equipmentSearchTerm.trim()) {
 const searchLower = equipmentSearchTerm.toLowerCase();
 filtered = filtered.filter(u => 
 u.nombre?.toLowerCase().includes(searchLower) ||
 u.id?.toString().includes(searchLower) ||
 u.sector?.name?.toLowerCase().includes(searchLower) ||
 u.patente?.toLowerCase().includes(searchLower)
 );
 }
 
 if (equipmentStatusFilter === 'active') {
 filtered = filtered.filter(u => u.estado === 'ACTIVO');
 } else if (equipmentStatusFilter === 'inactive') {
 filtered = filtered.filter(u => u.estado !== 'ACTIVO');
 }
 
 return filtered;
 }, [availableUnidadesMoviles, equipmentSearchTerm, equipmentStatusFilter]);

 // Funciones para seleccionar visibles
 const handleSelectVisibleMachines = () => {
 const visibleIds = filteredEquipmentMachines.map(m => m.id.toString());
 const allVisibleSelected = visibleIds.every(id => tempFilters.selectedMachines.includes(id));
 
 if (allVisibleSelected) {
 setTempFilters({ ...tempFilters, selectedMachines: tempFilters.selectedMachines.filter(id => !visibleIds.includes(id)) });
 } else {
 setTempFilters({ ...tempFilters, selectedMachines: [...new Set([...tempFilters.selectedMachines, ...visibleIds])] });
 }
 };

 const handleSelectVisibleMobiles = () => {
 const visibleIds = filteredEquipmentMobiles.map(u => u.id.toString());
 const allVisibleSelected = visibleIds.every(id => tempFilters.selectedUnidadesMoviles.includes(id));
 
 if (allVisibleSelected) {
 setTempFilters({ ...tempFilters, selectedUnidadesMoviles: tempFilters.selectedUnidadesMoviles.filter(id => !visibleIds.includes(id)) });
 } else {
 setTempFilters({ ...tempFilters, selectedUnidadesMoviles: [...new Set([...tempFilters.selectedUnidadesMoviles, ...visibleIds])] });
 }
 };

 // Función para resetear un filtro específico
 const resetSingleFilter = (filterType: 'equipment' | 'type' | 'status' | 'dates' | 'priority' | 'frequency') => {
 switch (filterType) {
 case 'equipment':
 setTempFilters({ ...tempFilters, selectedMachines: [], selectedUnidadesMoviles: [] });
 break;
 case 'type':
 setTempFilters({ ...tempFilters, assetTypeFilter: [] });
 break;
 case 'status':
 setTempFilters({ ...tempFilters, status: 'all' });
 break;
 case 'dates':
 setTempFilters({ ...tempFilters, startDate: '', endDate: '' });
 break;
 case 'priority':
 setTempFilters({ ...tempFilters, priority: 'all' });
 break;
 case 'frequency':
 setTempFilters({ ...tempFilters, frequency: 'all' });
 break;
 }
 };

 // Helper para obtener label de fechas
 const getDateRangeLabel = () => {
 if (!tempFilters.startDate && !tempFilters.endDate) return null;
 
 const today = new Date().toISOString().split('T')[0];
 const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
 const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
 const now = new Date();
 const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
 const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
 
 if (tempFilters.startDate === today && tempFilters.endDate === today) return 'Hoy';
 if (tempFilters.startDate === last7Days && tempFilters.endDate === today) return 'Últimos 7 días';
 if (tempFilters.startDate === last30Days && tempFilters.endDate === today) return 'Últimos 30 días';
 if (tempFilters.startDate === monthStart && tempFilters.endDate === monthEnd) return 'Mes actual';
 
 if (tempFilters.startDate && tempFilters.endDate) {
 return `${tempFilters.startDate} - ${tempFilters.endDate}`;
 }
 if (tempFilters.startDate) return `Desde ${tempFilters.startDate}`;
 if (tempFilters.endDate) return `Hasta ${tempFilters.endDate}`;
 return null;
 };

 // Función para aplicar los filtros temporales
 const applyTempFilters = () => {
 setFilters(tempFilters);
 setIsFiltersModalOpen(false);
 
 // ✅ ARREGLADO: Recargar datos cuando se aplican filtros
 // ✨ Usar hooks React Query para evitar duplicados
 // Los hooks se recargan automáticamente cuando cambian los parámetros (filtros)
 // No necesitamos llamar refetch manualmente aquí porque los hooks ya se recargan
 // cuando cambian las dependencias (filters, completedTimeFilter, pendingSortOrder)
 };


 return (
 <div key={forceRender} className="space-y-6 min-h-full">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
 <div className="min-w-0">
 <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
 Mantenimientos {machineName ? `- ${machineName}` : sectorName ? `- ${sectorName}` : ''}
 </h1>
 <p className="text-sm text-muted-foreground mt-1">
 Sistema avanzado de gestión de mantenimientos
 </p>
 </div>
 <div className="flex gap-2 flex-wrap sm:flex-nowrap items-center">
 {/* Filtro de Sector/Sección - Solo visible para administradores */}
 {isAdmin && (
 <div className="flex items-center gap-2">
 <Label htmlFor="sector-filter" className="text-xs text-muted-foreground whitespace-nowrap">
 Sector:
 </Label>
 <Select
 value={selectedSectorFilter?.toString() || 'all'}
 onValueChange={(value) => {
 setSelectedSectorFilter(value === 'all' ? undefined : parseInt(value));
 }}
 >
 <SelectTrigger id="sector-filter" className="w-[180px] h-9">
 <SelectValue placeholder="Todas las secciones" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todos los sectores</SelectItem>
 {availableSectors.map((sector) => (
 <SelectItem key={sector.id} value={sector.id.toString()}>
 {sector.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}
 <Button 
 type="button"
 variant="outline" 
 size="sm"
 onClick={(e) => {
 e.preventDefault();
 e.stopPropagation();
 setFilterModalMode('list');
 setIsPDFFilterOpen(true);
 }}
 className="hidden md:inline-flex h-9 text-xs"
 >
 <FileText className="h-3 w-3 mr-2" />
 Listar
 </Button>
 
 {canExecuteMaintenance && (
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={(e) => {
 e.preventDefault();
 e.stopPropagation();
 setIsManualServiceDialogOpen(true);
 }}
 className="bg-success-muted hover:bg-success-muted text-success border-success-muted hidden md:inline-flex h-9 text-xs"
 >
 <CheckCircle className="h-3 w-3 mr-2" />
 Ejecución Mantenimiento
 </Button>
 )}
 
 <div className="relative">
 <Button 
 variant="outline" 
 size="sm"
 onClick={(e) => {
 e.preventDefault();
 e.stopPropagation();
 setFilterModalMode('filter');
 setIsPDFFilterOpen(true);
 }}
 className="hidden md:inline-flex h-9 text-xs"
 >
 <Filter className="h-3 w-3 mr-2" />
 Filtros
 </Button>
 {hasActiveFilters() && (
 <div className="absolute -top-2 -right-2 bg-destructive/100 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold">
 {[
 filters.status !== 'all' ? 1 : 0,
 filters.priority !== 'all' ? 1 : 0,
 filters.type !== 'all' ? 1 : 0,
 filters.frequency !== 'all' ? 1 : 0,
 filters.selectedMachines.length > 0 ? 1 : 0,
 filters.selectedUnidadesMoviles.length > 0 ? 1 : 0,
 filters.assetTypeFilter.length > 0 ? 1 : 0,
 filters.startDate !== '' ? 1 : 0,
 filters.endDate !== '' ? 1 : 0
 ].reduce((a, b) => a + b, 0)}
 </div>
 )}
 </div>
 {hasActiveFilters() && (
 <Button 
 variant="outline" 
 size="sm"
 onClick={clearAllFilters}
 className="text-destructive hover:text-destructive hover:bg-destructive/10 hidden sm:inline-flex h-9 text-xs"
 >
 <X className="h-3 w-3 mr-2" />
 Quitar Filtros
 </Button>
 )}
 {canCreateChecklist && (
 <Button 
 type="button"
 variant="outline" 
 size="sm"
 onClick={(e) => {
 e.preventDefault();
 e.stopPropagation();
 setIsChecklistDialogOpen(true);
 }}
 className="hidden md:inline-flex h-9 text-xs"
 >
 <CheckSquare className="h-3 w-3 mr-2" />
 Checklists
 </Button>
 )}
 {canCreateMaintenance && (
 <Button 
 type="button"
 size="sm" 
 className="bg-black hover:bg-accent text-white hidden sm:inline-flex h-9 text-xs"
 onClick={(e) => {
 e.preventDefault();
 e.stopPropagation();
 setEditingMaintenance(null);
 setDialogMode('create');
 setIsAssetTypeSelectorOpen(true);
 }}
 >
 <Plus className="h-3 w-3 mr-2" />
 Nuevo Mantenimiento
 </Button>
 )}

 {/* Menú compacto para móvil */}
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="outline" size="sm" className="md:hidden">
 <Menu className="h-4 w-4 mr-2" />
 Acciones
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-56">
 <DropdownMenuItem 
 onClick={(e) => {
 e.preventDefault();
 e.stopPropagation();
 setFilterModalMode('list');
 setIsPDFFilterOpen(true);
 }}
 >
 <FileText className="h-4 w-4 mr-2" /> Listar
 </DropdownMenuItem>
 {canExecuteMaintenance && (
 <DropdownMenuItem 
 onClick={(e) => {
 e.preventDefault();
 e.stopPropagation();
 setIsManualServiceDialogOpen(true);
 }}
 >
 <CheckCircle className="h-4 w-4 mr-2" /> Ejecución Mantenimiento
 </DropdownMenuItem>
 )}
 <DropdownMenuItem 
 onClick={(e) => {
 e.preventDefault();
 e.stopPropagation();
 setFilterModalMode('filter');
 setIsPDFFilterOpen(true);
 }}
 >
 <Filter className="h-4 w-4 mr-2" /> Filtros
 </DropdownMenuItem>
 {hasActiveFilters() && (
 <DropdownMenuItem 
 onClick={(e) => {
 e.preventDefault();
 e.stopPropagation();
 clearAllFilters();
 }}
 >
 <X className="h-4 w-4 mr-2" /> Quitar Filtros
 </DropdownMenuItem>
 )}
 {canCreateChecklist && (
 <DropdownMenuItem 
 onClick={(e) => {
 e.preventDefault();
 e.stopPropagation();
 setIsChecklistDialogOpen(true);
 }}
 >
 <CheckSquare className="h-4 w-4 mr-2" /> Checklists
 </DropdownMenuItem>
 )}
 {canCreateMaintenance && (
 <DropdownMenuItem 
 onClick={(e) => {
 e.preventDefault();
 e.stopPropagation();
 setEditingMaintenance(null);
 setDialogMode('create');
 setIsAssetTypeSelectorOpen(true);
 }}
 >
 <Plus className="h-4 w-4 mr-2" /> Nuevo Mantenimiento
 </DropdownMenuItem>
 )}
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </div>

 {/* KPIs movidos al tab Resumen (overview) */}


 {/* Estilos CSS para scroll personalizado */}
 <style>{`
 .maintenance-tabs-scroll::-webkit-scrollbar {
 height: 6px;
 }
 .maintenance-tabs-scroll::-webkit-scrollbar-track {
 background: #f1f1f1;
 border-radius: 10px;
 }
 .maintenance-tabs-scroll::-webkit-scrollbar-thumb {
 background: #888;
 border-radius: 10px;
 }
 .maintenance-tabs-scroll::-webkit-scrollbar-thumb:hover {
 background: #555;
 }
 .maintenance-content-scroll::-webkit-scrollbar {
 width: 8px;
 }
 .maintenance-content-scroll::-webkit-scrollbar-track {
 background: #f1f1f1;
 border-radius: 10px;
 }
 .maintenance-content-scroll::-webkit-scrollbar-thumb {
 background: #888;
 border-radius: 10px;
 }
 .maintenance-content-scroll::-webkit-scrollbar-thumb:hover {
 background: #555;
 }
 `}</style>

 {/* Tabs */}
 <Tabs
 value={activeTab}
 onValueChange={setActiveTab}
 className="flex flex-col md:h-[calc(100vh-240px)]"
 >
 <div className="mb-3 flex-shrink-0">
 <TabsList className="w-full sm:w-fit h-9 bg-muted/40 border border-border rounded-md p-1 overflow-x-auto">
 <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs font-normal h-7 px-3 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm">
 Resumen
 </TabsTrigger>
 <TabsTrigger value="pending" className="group flex items-center gap-1.5 text-xs font-normal h-7 px-3 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm">
 Pendientes
 <div className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors text-foreground bg-background group-data-[state=active]:!text-white group-data-[state=active]:border-white/30 group-data-[state=active]:bg-transparent">
 {allMaintenances.length > 0 
 ? allMaintenances.filter(m => m.status === 'PENDING').length 
 : (dashboardData?.kpis?.pending ?? 0)}
 </div>
 </TabsTrigger>
 <TabsTrigger value="completed-today" className="group flex items-center gap-1.5 text-xs font-normal h-7 px-3 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm">
 Completados
 {completedDataLoaded && (completedTodayMaintenances.length > 0 || (dashboardData?.completedToday?.length ?? 0) > 0) && (
 <div className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors text-foreground bg-background group-data-[state=active]:!text-white group-data-[state=active]:border-white/30 group-data-[state=active]:bg-transparent">
 {completedTodayMaintenances.length > 0 ? completedTodayMaintenances.length : (dashboardData?.completedToday?.length ?? 0)}
 </div>
 )}
 </TabsTrigger>
 <TabsTrigger value="all" className="group flex items-center gap-1.5 text-xs font-normal h-7 px-3 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm">
 Todos
 <div className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors text-foreground bg-background group-data-[state=active]:!text-white group-data-[state=active]:border-white/30 group-data-[state=active]:bg-transparent">
 {allMaintenances.length}
 </div>
 </TabsTrigger>
 <TabsTrigger value="calendar" className="flex items-center gap-1.5 text-xs font-normal h-7 px-3 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm">
 <CalendarDays className="h-3.5 w-3.5" />
 Calendario
 </TabsTrigger>
 <TabsTrigger value="history" className="flex items-center gap-1.5 text-xs font-normal h-7 px-3 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm">
 Historial
 </TabsTrigger>
 <TabsTrigger value="checklists" className="group flex items-center gap-1.5 text-xs font-normal h-7 px-3 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm">
 Checklists
 {checklistsDataLoaded && checklists.length > 0 && (
 <div className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors text-foreground bg-background group-data-[state=active]:!text-white group-data-[state=active]:border-white/30 group-data-[state=active]:bg-transparent">
 {checklists.length}
 </div>
 )}
 </TabsTrigger>
 <TabsTrigger value="analytics" className="flex items-center gap-1.5 text-xs font-normal h-7 px-3 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm">
 Estadísticas
 </TabsTrigger>
 </TabsList>
 </div>

 <TabsContent
 value="overview"
 className="space-y-6 pr-2 md:flex-1 overflow-y-auto"
 style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
 >
 {/* Selector de Período */}
 <div className="flex items-center justify-end gap-2">
 <Label htmlFor="period-input" className="text-xs text-muted-foreground whitespace-nowrap">
 Últimos
 </Label>
 <input
 id="period-input"
 type="number"
 min="0"
 value={summaryPeriodDays}
 onChange={(e) => {
 const value = parseInt(e.target.value) || 0;
 setSummaryPeriodDays(Math.max(0, value));
 }}
 className="flex h-8 w-20 rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:border-input"
 placeholder="30"
 />
 <Label htmlFor="period-input" className="text-xs text-muted-foreground whitespace-nowrap">
 días
 </Label>
 </div>

 {/* Métricas de KPIs (Completados a Tiempo, MTTR, MTBF, Disponibilidad) */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Completados a Tiempo</p>
 <p className="text-sm font-medium text-success">
 {kpis ? `${formatNumber(kpis.completionRate, 1)}%` : '--'}
 </p>
 </div>
 <div className="h-8 w-8 bg-success-muted rounded-full flex items-center justify-center">
 <CheckCircle className="h-4 w-4 text-success" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">MTTR Promedio</p>
 <p className="text-xs text-muted-foreground mb-1">Tiempo promedio de reparación</p>
 <p className="text-sm font-medium text-info-muted-foreground">
 {kpis ? `${formatNumber(kpis.avgMTTR, 1)}h` : '--'}
 </p>
 </div>
 <div className="h-8 w-8 bg-info-muted rounded-full flex items-center justify-center">
 <Timer className="h-4 w-4 text-info-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">MTBF Promedio</p>
 <p className="text-xs text-muted-foreground mb-1">Tiempo promedio entre fallas</p>
 <p className="text-sm font-medium text-accent-purple-muted-foreground">
 {kpis ? `${formatNumber(kpis.avgMTBF, 1)}h` : '--'}
 </p>
 </div>
 <div className="h-8 w-8 bg-accent-purple-muted rounded-full flex items-center justify-center">
 <Activity className="h-4 w-4 text-accent-purple-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Disponibilidad</p>
 <p className="text-sm font-medium text-indigo-600">
 {kpis ? `${formatNumber(kpis.uptime, 1)}%` : '--'}
 </p>
 </div>
 <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center">
 <Target className="h-4 w-4 text-indigo-600" />
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Resumen de Actividad */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Pendientes</p>
 <p className="text-sm font-medium text-warning-muted-foreground">
 {allMaintenances.length > 0 
 ? allMaintenances.filter(m => m.status === 'PENDING').length 
 : (dashboardData?.kpis?.pending ?? 0)}
 </p>
 </div>
 <div className="h-8 w-8 bg-warning-muted rounded-full flex items-center justify-center">
 <Clock className="h-4 w-4 text-warning-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Completados Hoy</p>
 <p className="text-sm font-medium text-success">{completedTodayMaintenances.length}</p>
 </div>
 <div className="h-8 w-8 bg-success-muted rounded-full flex items-center justify-center">
 <CheckCircle className="h-4 w-4 text-success" />
 </div>
 </div>
 </CardContent>
 </Card>


 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Preventivos</p>
 <p className="text-sm font-medium text-info-muted-foreground">{allMaintenances.filter(m => m.type === 'PREVENTIVE').length}</p>
 </div>
 <div className="h-8 w-8 bg-info-muted rounded-full flex items-center justify-center">
 <Wrench className="h-4 w-4 text-info-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Correctivos</p>
 <p className="text-sm font-medium text-warning-muted-foreground">{allMaintenances.filter(m => m.type === 'CORRECTIVE').length}</p>
 </div>
 <div className="h-8 w-8 bg-warning-muted rounded-full flex items-center justify-center">
 <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Métricas del Sistema */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <Card>
 <CardHeader>
 <CardTitle className="text-sm font-medium flex items-center gap-2">
 <TrendingUp className="h-4 w-4" />
 Estado del Sistema
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 <div className="flex justify-between items-center">
 <span className="text-xs text-muted-foreground">Uptime</span>
 <div className="flex items-center gap-2">
 <div className="w-16 bg-muted rounded-full h-2">
 <div className="bg-success-muted0 h-2 rounded-full" style={{width: '100%'}}></div>
 </div>
 <span className="text-sm font-medium text-success">100.0%</span>
 </div>
 </div>
 <div className="flex justify-between items-center">
 <div className="flex flex-col">
 <span className="text-xs text-muted-foreground">MTTR Promedio</span>
 <span className="text-xs text-muted-foreground">Tiempo promedio de reparación</span>
 </div>
 <span className="text-sm font-medium">0.0h</span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-xs text-muted-foreground">Tasa de Completitud</span>
 <div className="flex items-center gap-2">
 <div className="w-16 bg-muted rounded-full h-2">
 <div className="bg-info-muted0 h-2 rounded-full" style={{width: '0%'}}></div>
 </div>
 <span className="text-sm font-medium text-info-muted-foreground">0.0%</span>
 </div>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-xs text-muted-foreground">Calidad Promedio</span>
 <div className="flex items-center gap-2">
 <div className="w-16 bg-muted rounded-full h-2">
 <div className="bg-accent-purple-muted-foreground h-2 rounded-full" style={{width: '75%'}}></div>
 </div>
 <span className="text-sm font-medium">7.5/10</span>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="text-sm font-medium flex items-center gap-2">
 <Target className="h-4 w-4" />
 Próximos Mantenimientos
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {pendingMaintenances.slice(0, 3).map((maintenance, index) => (
 <div 
 key={maintenance.id} 
 className="flex items-center justify-between p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted transition-colors"
 onClick={() => {
 setActiveTab('pending');
 setSelectedMaintenance(maintenance);
 setIsDetailDialogOpen(true);
 }}
 >
 <div className="flex-1">
 <p className="text-xs font-medium text-foreground truncate">{maintenance.title}</p>
 <p className="text-xs text-muted-foreground">
 ID: {maintenance.id} • {(maintenance as any).unidadMovil?.nombre || maintenance.machine?.name || 'Sin equipo'}
 </p>
 </div>
 <div className="text-right space-y-1">
 <p className="text-xs text-muted-foreground">
 {maintenance.scheduledDate ? new Date(maintenance.scheduledDate).toLocaleDateString() : 'Sin fecha'}
 </p>
 <div className="flex items-center gap-1 justify-end">
 {(() => {
 const sla = getSLAStatus(maintenance);
 if (!sla) return null;
 return (
 <span className={cn("inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs font-semibold", sla.className)} role="status" aria-label={`SLA: ${sla.label}`}>
 {sla.label}
 </span>
 );
 })()}
 <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold border-transparent bg-warning-muted text-warning-muted-foreground">
 {translatePriority(maintenance.priority || 'MEDIUM')}
 </span>
 </div>
 </div>
 </div>
 ))}
 {pendingMaintenances.length === 0 && (
 <p className="text-sm text-muted-foreground text-center py-4">No hay mantenimientos pendientes</p>
 )}
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Resumen por Tipo */}
 <Card>
 <CardHeader>
 <CardTitle className="text-sm font-medium flex items-center gap-2">
 <ChartColumn className="h-4 w-4" />
 Distribución por Tipo
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="text-center p-4 bg-info-muted rounded-lg">
 <div className="text-sm font-medium text-info-muted-foreground">
 {allMaintenances.filter(m => m.type === 'PREVENTIVE').length}
 </div>
 <div className="text-xs text-info-muted-foreground">Preventivos</div>
 <div className="text-xs text-info-muted-foreground mt-1">
 {allMaintenances.length > 0 ? 
 Math.round((allMaintenances.filter(m => m.type === 'PREVENTIVE').length / allMaintenances.length) * 100) : 0}%
 </div>
 </div>
 <div className="text-center p-4 bg-warning-muted rounded-lg">
 <div className="text-sm font-medium text-warning-muted-foreground">
 {allMaintenances.filter(m => m.type === 'CORRECTIVE').length}
 </div>
 <div className="text-xs text-warning-muted-foreground">Correctivos</div>
 <div className="text-xs text-warning-muted-foreground mt-1">
 {allMaintenances.length > 0 ? 
 Math.round((allMaintenances.filter(m => m.type === 'CORRECTIVE').length / allMaintenances.length) * 100) : 0}%
 </div>
 </div>
 <div className="text-center p-4 bg-success-muted rounded-lg">
 <div className="text-sm font-medium text-success">
 {completedTodayMaintenances.length}
 </div>
 <div className="text-xs text-success">Completados Hoy</div>
 <div className="text-xs text-success mt-1">
 {pendingMaintenances.length + completedTodayMaintenances.length > 0 ? 
 Math.round((completedTodayMaintenances.length / (pendingMaintenances.length + completedTodayMaintenances.length)) * 100) : 0}%
 </div>
 </div>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent
 value="pending"
 className="space-y-4 md:flex-1 md:overflow-y-auto pr-2 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-300px)] md:max-h-none maintenance-content-scroll"
 style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
 >
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 overflow-x-hidden">
 <h2 className="text-sm text-muted-foreground">Mantenimientos Pendientes</h2>
 <div className="flex items-center gap-2 shrink-0">
 <span className="text-xs text-muted-foreground whitespace-nowrap">Ordenar por:</span>
 <Select value={pendingSortOrder} onValueChange={setPendingSortOrder}>
 <SelectTrigger className="w-full sm:w-36 h-8 text-xs">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="oldest">Fecha programada (más antiguo)</SelectItem>
 <SelectItem value="newest">Fecha programada (más reciente)</SelectItem>
 <SelectItem value="priority">Por prioridad</SelectItem>
 </SelectContent>
 </Select>
 <Button 
 variant="outline" 
 size="sm" 
 className="h-8 text-xs gap-1"
 onClick={() => setShowKPIs(!showKPIs)}
 >
 <BarChart3 className="h-3 w-3" />
 Ver KPIs
 </Button>
 </div>
 </div>

 {/* KPIs principales (Completados a Tiempo, MTTR, MTBF, Disponibilidad) */}
 {showKPIs && (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 mt-4" role="region" aria-label="Indicadores clave de mantenimiento">
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Completados a Tiempo</p>
 <p className="text-sm font-medium text-success">
 {kpis ? `${formatNumber(kpis.completionRate, 1)}%` : '--'}
 </p>
 </div>
 <div className="h-10 w-10 bg-success-muted rounded-full flex items-center justify-center">
 <CheckCircle className="h-5 w-5 text-success" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">MTTR Promedio</p>
 <p className="text-sm font-medium text-info-muted-foreground">
 {kpis ? `${formatNumber(kpis.avgMTTR, 1)}h` : '--'}
 </p>
 </div>
 <div className="h-10 w-10 bg-info-muted rounded-full flex items-center justify-center">
 <Timer className="h-5 w-5 text-info-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">MTBF Promedio</p>
 <p className="text-sm font-medium text-accent-purple-muted-foreground">
 {kpis ? `${formatNumber(kpis.avgMTBF, 1)}h` : '--'}
 </p>
 </div>
 <div className="h-10 w-10 bg-accent-purple-muted rounded-full flex items-center justify-center">
 <Activity className="h-5 w-5 text-accent-purple-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Disponibilidad</p>
 <p className="text-sm font-medium text-indigo-600">
 {kpis ? `${formatNumber(kpis.uptime, 1)}%` : '--'}
 </p>
 </div>
 <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
 <Target className="h-5 w-5 text-indigo-600" />
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 )}

 {/* Línea divisora */}
 <div className="border-t border-border my-4"></div>

 {/* KPIs de Pendientes */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Vencidos</p>
 <p className="text-sm font-medium text-destructive">{pendingKPIs.overdue}</p>
 </div>
 <div className="h-10 w-10 bg-destructive/10 rounded-full flex items-center justify-center">
 <AlertTriangle className="h-5 w-5 text-destructive" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Vencen Hoy</p>
 <p className="text-sm font-medium text-warning-muted-foreground">{pendingKPIs.dueToday}</p>
 </div>
 <div className="h-10 w-10 bg-warning-muted rounded-full flex items-center justify-center">
 <Clock className="h-5 w-5 text-warning-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Próximos 7 días</p>
 <p className="text-sm font-medium text-warning-muted-foreground">{pendingKPIs.next7Days}</p>
 </div>
 <div className="h-10 w-10 bg-warning-muted rounded-full flex items-center justify-center">
 <CalendarDays className="h-5 w-5 text-warning-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Backlog</p>
 <p className="text-sm font-medium text-foreground">{pendingKPIs.backlog}</p>
 </div>
 <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
 <ListTodo className="h-5 w-5 text-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 <div className="space-y-4 overflow-x-hidden" role="list" aria-label="Lista de mantenimientos pendientes">
 {displayedMaintenances.map(maintenance => (
 <Card
 key={maintenance.id}
 className="cursor-pointer hover:shadow-md transition-shadow w-full overflow-hidden"
 onClick={() => handleViewMaintenance(maintenance)}
 role="listitem"
 aria-label={`${maintenance.title || 'Sin título'} - ${maintenance.type === 'CORRECTIVE' ? 'Correctivo' : 'Preventivo'} - ${getPriorityLabel(maintenance.priority)}`}
 >
 <div className="p-4 sm:p-4 overflow-x-hidden">
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
 <div className="flex-1 min-w-0">
 <div className="flex flex-wrap items-center gap-2 mb-2">
 <h3 className="text-sm font-medium break-words">{maintenance.title || 'Sin título'}</h3>
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-muted text-muted-foreground shrink-0">
 ID: {maintenance.id}
 </div>
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-primary/80 bg-warning-muted text-warning-muted-foreground shrink-0">
 {getPriorityLabel(maintenance.priority)}
 </div>
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-primary/80 bg-warning-muted text-warning-muted-foreground shrink-0">
 Pendiente
 </div>
 {(() => {
 const sla = getSLAStatus(maintenance);
 if (!sla) return null;
 return (
 <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shrink-0", sla.className)} role="status" aria-label={`Estado SLA: ${sla.label}`}>
 <AlertCircle className="h-3 w-3 mr-1" aria-hidden="true" />
 {sla.label}
 </div>
 );
 })()}
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground shrink-0">
 {maintenance.type === 'CORRECTIVE' ? 'Correctivo' : 'Preventivo'}
 </div>
 </div>
 <p className="text-xs text-muted-foreground mb-2 break-words">{stripHtmlTags(maintenance.description) || 'Sin descripción'}</p>
 <div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
 <div className="flex items-center gap-1">
 <Clock className="h-3 w-3" />
 <span>Ventana: {maintenance.executionWindow ? translateExecutionWindow(maintenance.executionWindow) : 'Cualquier momento'}</span>
 </div>
 </div>
 <div className="flex items-center gap-2 mb-2 flex-wrap">
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground text-xs">
 <Wrench className="h-3 w-3 mr-1" />
 {maintenance.unidadMovil?.nombre || maintenance.machine?.name || 'Sin equipo'}
 </div>
 {maintenance.machine?.sector && (
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-xs bg-success-muted text-success">
 <Building className="h-3 w-3 mr-1" />
 {maintenance.machine.sector.name}
 </div>
 )}
 {/* Componentes */}
 {(() => {
 const componentNames = maintenance.componentNames || (maintenance.components?.map((c: any) => c.name)) || [];
 const componentIds = maintenance.componentIds || (maintenance.components?.map((c: any) => c.id)) || [];
 const allComponents = componentNames.length > 0 ? componentNames : componentIds.map((id: number) => `Componente ${id}`);
 return allComponents.map((name: string, idx: number) => (
 <div key={`component-${idx}`} className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-xs bg-info-muted text-info-muted-foreground">
 <Cog className="h-3 w-3 mr-1" />
 {name}
 </div>
 ));
 })()}
 {/* Subcomponentes */}
 {(() => {
 const subcomponentNames = maintenance.subcomponentNames || (maintenance.subcomponents?.map((s: any) => s.name)) || [];
 const subcomponentIds = maintenance.subcomponentIds || (maintenance.subcomponents?.map((s: any) => s.id)) || [];
 const allSubcomponents = subcomponentNames.length > 0 ? subcomponentNames : subcomponentIds.map((id: number) => `Subcomponente ${id}`);
 return allSubcomponents.map((name: string, idx: number) => (
 <div key={`subcomponent-${idx}`} className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-xs bg-accent-purple-muted text-accent-purple-muted-foreground">
 <Settings className="h-3 w-3 mr-1" />
 {name}
 </div>
 ));
 })()}
 </div>
 <div className="flex items-center gap-4 text-xs text-muted-foreground">
 {/* Periodicidad */}
 {(() => {
 // Usar frequency si está disponible, sino frequencyDays
 const frequency = maintenance.frequency || maintenance.frequencyDays;
 
 if (frequency) {
 return (
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 <span>{formatFrequency(frequency)}</span>
 </div>
 );
 }
 return null;
 })()}
 {/* Duración */}
 <div className="flex items-center gap-1">
 <Clock className="h-3 w-3" />
 {getDurationDisplay(maintenance)}
 </div>
 {/* Fecha próxima */}
 {(() => {
 // Para mantenimientos completados, calcular la fecha próxima basada en completedDate + frequency
 if (maintenance.status === 'COMPLETED' && maintenance.completedDate) {
 try {
 const completedDate = new Date(maintenance.completedDate);
 
 if (isNaN(completedDate.getTime())) {
 return maintenance.nextMaintenanceDate ? (
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 <span>Próximo: {formatDate(maintenance.nextMaintenanceDate)}</span>
 </div>
 ) : null;
 }
 
 let nextDate = new Date(completedDate);
 
 // Usar la misma lógica que en la pestaña Completados
 let frequency = maintenance.frequency || maintenance.frequencyDays;
 let frequencyUnit = maintenance.frequencyUnit;
 
 // Si frequency es un string como 'MONTHLY', convertirlo a número
 if (typeof frequency === 'string') {
 switch (frequency.toUpperCase()) {
 case 'MONTHLY':
 frequency = 1;
 frequencyUnit = 'MONTHS';
 break;
 case 'WEEKLY':
 frequency = 1;
 frequencyUnit = 'WEEKS';
 break;
 case 'DAILY':
 frequency = 1;
 frequencyUnit = 'DAYS';
 break;
 case 'YEARLY':
 frequency = 1;
 frequencyUnit = 'YEARS';
 break;
 default:
 const parsedFreq = parseInt(frequency);
 if (!isNaN(parsedFreq)) {
 frequency = parsedFreq;
 } else {
 frequency = 1;
 frequencyUnit = 'MONTHS';
 }
 }
 }
 
 if (!frequencyUnit) {
 frequencyUnit = frequency >= 365 ? 'YEARS' :
 frequency >= 30 ? 'MONTHS' :
 frequency >= 7 ? 'WEEKS' : 'DAYS';
 }
 
 if (!frequency || frequency === 0) {
 frequency = 1;
 frequencyUnit = 'MONTHS';
 }
 
 // Usar la función helper para calcular la fecha correctamente
 nextDate = calculateNextDate(completedDate, frequency, frequencyUnit);
 
 if (isNaN(nextDate.getTime())) {
 return maintenance.nextMaintenanceDate ? (
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 <span>Próximo: {formatDate(maintenance.nextMaintenanceDate)}</span>
 </div>
 ) : null;
 }
 
 return (
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 <span>Próximo: {formatDate(nextDate.toISOString())}</span>
 </div>
 );
 } catch (error) {
 console.error('Error calculating next date:', error);
 return maintenance.nextMaintenanceDate ? (
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 <span>Próximo: {formatDate(maintenance.nextMaintenanceDate)}</span>
 </div>
 ) : null;
 }
 }
 
 // Para mantenimientos no completados, usar la fecha del backend
 return maintenance.nextMaintenanceDate ? (
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 <span>Próximo: {formatDate(maintenance.nextMaintenanceDate)}</span>
 </div>
 ) : null;
 })()}
 {/* Reportado por (para correctivos pendientes) o Asignado (para preventivos) */}
 <div className="flex items-center gap-1">
 <User className="h-3 w-3" />
 {maintenance.type === 'CORRECTIVE'
 ? (maintenance.reportedByName || maintenance.assignedTo?.name || maintenance.assignedWorker?.name || 'Sin asignar')
 : (maintenance.assignedTo?.name || maintenance.assignedWorker?.name || 'Sin asignar')}
 </div>
 </div>
 </div>
 <div className="flex gap-2 ml-4">
 {canEditMaintenance && (
 <Button
 variant="outline"
 size="sm"
 className="h-8 w-8 p-0"
 onClick={(e) => {
 e.stopPropagation();
 handleEditMaintenance(maintenance);
 }}
 title="Editar"
 aria-label={`Editar ${maintenance.title}`}
 >
 <SquarePen className="h-3.5 w-3.5" />
 </Button>
 )}
 {canExecuteMaintenance && (
 <Button
 variant="default"
 size="sm"
 className="h-8 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90"
 onClick={(e) => {
 e.stopPropagation();
 handleExecuteMaintenance(maintenance);
 }}
 title="Realizar mantenimiento"
 aria-label={`Realizar ${maintenance.title}`}
 >
 <Check className="h-4 w-4" />
 </Button>
 )}
 {canDeleteMaintenance && (
 <Button
 variant="outline"
 size="sm"
 className="h-8 w-8 p-0"
 onClick={(e) => {
 e.stopPropagation();
 handleDeleteMaintenance(maintenance);
 }}
 title="Eliminar mantenimiento"
 aria-label={`Eliminar ${maintenance.title}`}
 >
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 )}
 {canDuplicateMaintenance && (
 <Button
 variant="outline"
 size="sm"
 className="h-8 w-8 p-0"
 onClick={(e) => {
 e.stopPropagation();
 handleDuplicateMaintenance(maintenance);
 }}
 title="Duplicar mantenimiento"
 aria-label={`Duplicar ${maintenance.title}`}
 >
 <Copy className="h-3.5 w-3.5" />
 </Button>
 )}
 </div>
 </div>
 </div>
 </Card>
 ))}
 {pendingMaintenances.length === 0 && (
 <Card>
 <div className="p-8 text-center">
 <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
 <h3 className="text-lg font-semibold mb-2">¡Excelente!</h3>
 <p className="text-sm text-muted-foreground">No hay mantenimientos pendientes</p>
 </div>
 </Card>
 )}
 <div
 ref={pendingLoadMoreRef}
 className="h-10 flex items-center justify-center text-xs text-muted-foreground"
 >
 {pendingMaintenances.length === 0
 ? 'Sin mantenimientos pendientes'
 : pendingLoadingMore
 ? 'Cargando mantenimientos...'
 : 'Seguí desplazando...'}
 </div>
 {pendingTailHeight > 0 && (
 <div style={{ height: pendingTailHeight }} className="w-full" />
 )}
 </div>
 </TabsContent>

 <TabsContent
 value="completed-today"
 className="space-y-4 md:flex-1 overflow-y-auto pr-2"
 style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
 >
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
 <h2 className="text-xs text-muted-foreground">Mantenimientos Completados</h2>
 <div className="flex items-center gap-2 shrink-0">
 <span className="text-xs text-muted-foreground whitespace-nowrap">Período:</span>
 <Select value={completedTimeFilter} onValueChange={setCompletedTimeFilter}>
 <SelectTrigger className="w-full sm:w-36 h-8 text-xs">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="today">Hoy</SelectItem>
 <SelectItem value="week">Esta semana</SelectItem>
 <SelectItem value="month">Este mes</SelectItem>
 <SelectItem value="all">Todos</SelectItem>
 </SelectContent>
 </Select>
 <Button 
 variant="outline" 
 size="sm" 
 className="h-8 text-xs gap-1"
 onClick={() => setShowCompletedKPIs(!showCompletedKPIs)}
 >
 <BarChart3 className="h-3 w-3" />
 Ver KPIs
 </Button>
 </div>
 </div>

 {/* KPIs principales (Completados a Tiempo, MTTR, MTBF, Disponibilidad) */}
 {showCompletedKPIs && (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 mt-4">
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Completados a Tiempo</p>
 <p className="text-sm font-medium text-success">
 {kpis ? `${formatNumber(kpis.completionRate, 1)}%` : '--'}
 </p>
 </div>
 <div className="h-10 w-10 bg-success-muted rounded-full flex items-center justify-center">
 <CheckCircle className="h-5 w-5 text-success" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">MTTR Promedio</p>
 <p className="text-sm font-medium text-info-muted-foreground">
 {kpis ? `${formatNumber(kpis.avgMTTR, 1)}h` : '--'}
 </p>
 </div>
 <div className="h-10 w-10 bg-info-muted rounded-full flex items-center justify-center">
 <Timer className="h-5 w-5 text-info-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">MTBF Promedio</p>
 <p className="text-sm font-medium text-accent-purple-muted-foreground">
 {kpis ? `${formatNumber(kpis.avgMTBF, 1)}h` : '--'}
 </p>
 </div>
 <div className="h-10 w-10 bg-accent-purple-muted rounded-full flex items-center justify-center">
 <Activity className="h-5 w-5 text-accent-purple-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Disponibilidad</p>
 <p className="text-sm font-medium text-indigo-600">
 {kpis ? `${formatNumber(kpis.uptime, 1)}%` : '--'}
 </p>
 </div>
 <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
 <Target className="h-5 w-5 text-indigo-600" />
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 )}

 {/* Línea divisora */}
 <div className="border-t border-border my-4"></div>

 <div className="space-y-4">
 {completedTodayMaintenances.map(maintenance => (
 <Card 
 key={maintenance.id} 
 className="cursor-pointer hover:shadow-md transition-shadow"
 onClick={() => handleViewMaintenance(maintenance)}
 >
 <div className="p-4">
 <div className="flex justify-between items-start">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <h3 className="text-sm font-medium">{maintenance.title || 'Sin título'}</h3>
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-muted text-muted-foreground">
 ID: {maintenance.id}
 </div>
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-primary/80 bg-warning-muted text-warning-muted-foreground">
 {getPriorityLabel(maintenance.priority)}
 </div>
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-primary/80 bg-success-muted text-success-muted-foreground">
 {maintenance.type === 'CORRECTIVE' ? 'Realizado' : 'Completado'}
 </div>
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground">
 {maintenance.type === 'CORRECTIVE' ? 'Correctivo' : 'Preventivo'}
 </div>
 </div>
 <p className="text-xs text-muted-foreground mb-2">{stripHtmlTags(maintenance.description) || 'Sin descripción'}</p>
 <div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
 <div className="flex items-center gap-1">
 <Clock className="h-3 w-3" />
 <span>Ventana: {translateExecutionWindow(maintenance.executionWindow || '4')}</span>
 </div>
 </div>
 <div className="flex items-center gap-2 mb-2 flex-wrap">
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground text-xs">
 <Wrench className="h-3 w-3 mr-1" />
 {maintenance.unidadMovil?.nombre || maintenance.machine?.name || 'Sin equipo'}
 </div>
 {/* ✅ Mostrar componentes afectados para correctivos */}
 {maintenance.type === 'CORRECTIVE' && maintenance.affectedComponents && maintenance.affectedComponents.length > 0 && (
 maintenance.componentNames && maintenance.componentNames.length > 0 ? (
 maintenance.componentNames.map((name: string, idx: number) => (
 <div key={idx} className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors text-foreground text-xs bg-info-muted border-info-muted">
 <Cog className="h-3 w-3 mr-1 text-info-muted-foreground" />
 {name}
 </div>
 ))
 ) : (
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors text-foreground text-xs bg-info-muted border-info-muted">
 <Cog className="h-3 w-3 mr-1 text-info-muted-foreground" />
 {maintenance.affectedComponents.length} componente(s)
 </div>
 )
 )}
 </div>
 <div className="flex items-center gap-4 text-xs text-muted-foreground">
 {/* Periodicidad */}
 {(() => {
 const frequency = maintenance.frequency || maintenance.frequencyDays;
 if (frequency) {
 return (
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 <span>{formatFrequency(frequency)}</span>
 </div>
 );
 }
 return null;
 })()}
 {/* Duración */}
 <div className="flex items-center gap-1">
 <Clock className="h-3 w-3" />
 {getDurationDisplay(maintenance).replace('Duración: ', '')}
 </div>
 {/* Fecha completada/realizada */}
 {maintenance.completedDate && (
 <div className="flex items-center gap-1">
 <CheckCircle className="h-3 w-3" />
 <span>{maintenance.type === 'CORRECTIVE' ? 'Realizado' : 'Completado'}: {formatDate(maintenance.completedDate)}</span>
 </div>
 )}
 {/* Fecha próxima */}
 {(() => {
 if (maintenance.completedDate && (maintenance.frequency || maintenance.frequencyDays)) {
 try {
 const completedDate = new Date(maintenance.completedDate);
 
 // Validar que la fecha sea válida
 if (isNaN(completedDate.getTime())) {
 console.warn('Invalid completedDate:', maintenance.completedDate);
 return null;
 }
 
 let nextDate = new Date(completedDate);
 
 // Usar frequencyDays si frequency no está disponible
 let frequency = maintenance.frequency || maintenance.frequencyDays;
 let frequencyUnit = maintenance.frequencyUnit;
 
 // Si frequency es un string como 'MONTHLY', convertirlo a número
 if (typeof frequency === 'string') {
 switch (frequency.toUpperCase()) {
 case 'MONTHLY':
 frequency = 1;
 frequencyUnit = 'MONTHS';
 break;
 case 'WEEKLY':
 frequency = 1;
 frequencyUnit = 'WEEKS';
 break;
 case 'DAILY':
 frequency = 1;
 frequencyUnit = 'DAYS';
 break;
 case 'YEARLY':
 frequency = 1;
 frequencyUnit = 'YEARS';
 break;
 default:
 // Intentar parsear como número
 const parsedFreq = parseInt(frequency);
 if (!isNaN(parsedFreq)) {
 frequency = parsedFreq;
 } else {
 frequency = 1;
 frequencyUnit = 'MONTHS';
 }
 }
 }
 
 // Si no hay frequencyUnit, determinarlo basado en el valor
 if (!frequencyUnit) {
 frequencyUnit = frequency >= 365 ? 'YEARS' :
 frequency >= 30 ? 'MONTHS' :
 frequency >= 7 ? 'WEEKS' : 'DAYS';
 }
 
 // Si no hay frecuencia, asumir mensual (1 mes)
 if (!frequency || frequency === 0) {
 frequency = 1;
 frequencyUnit = 'MONTHS';
 }
 
 switch (frequencyUnit) {
 case 'DAYS':
 nextDate.setDate(completedDate.getDate() + frequency);
 break;
 case 'WEEKS':
 nextDate.setDate(completedDate.getDate() + (frequency * 7));
 break;
 case 'MONTHS':
 nextDate.setMonth(completedDate.getMonth() + frequency);
 break;
 case 'YEARS':
 nextDate.setFullYear(completedDate.getFullYear() + frequency);
 break;
 default:
 console.warn('Unknown frequencyUnit:', frequencyUnit);
 return null;
 }
 
 // Validar que la fecha calculada sea válida
 if (isNaN(nextDate.getTime())) {
 console.warn('Invalid calculated nextDate');
 return null;
 }
 
 return (
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 <span>Próximo: {formatDate(nextDate.toISOString())}</span>
 </div>
 );
 } catch (error) {
 console.error('Error calculating next date:', error);
 return null;
 }
 }
 return null;
 })()}
 {/* Realizado por (para correctivos) o Asignado (para preventivos) */}
 <div className="flex items-center gap-1">
 <User className="h-3 w-3" />
 {maintenance.type === 'CORRECTIVE'
 ? (maintenance.appliedBy || maintenance.assignedToName || 'Sin asignar')
 : (maintenance.assignedToName || 'Sin asignar')}
 </div>
 </div>
 {/* Resumen de cierre para correctivos completados */}
 {maintenance.type === 'CORRECTIVE' && maintenance.status === 'COMPLETED' && (maintenance.diagnosisNotes || maintenance.workPerformedNotes || maintenance.resultNotes) && (
 <div className="mt-3 pt-3 border-t space-y-2">
 {maintenance.diagnosisNotes && (
 <div className="text-xs">
 <span className="font-medium text-warning-muted-foreground">Diagnóstico:</span>{' '}
 <span className="text-muted-foreground">
 {maintenance.diagnosisNotes.length > 100 ? maintenance.diagnosisNotes.substring(0, 100) + '...' : maintenance.diagnosisNotes}
 </span>
 </div>
 )}
 {maintenance.workPerformedNotes && (
 <div className="text-xs">
 <span className="font-medium text-success-muted-foreground">Solución:</span>{' '}
 <span className="text-muted-foreground">
 {maintenance.workPerformedNotes.length > 100 ? maintenance.workPerformedNotes.substring(0, 100) + '...' : maintenance.workPerformedNotes}
 </span>
 </div>
 )}
 {maintenance.resultNotes && (
 <div className="flex items-center gap-2 text-xs">
 <span className="font-medium">Resultado:</span>
 <span className={cn("font-semibold",
 maintenance.resultNotes === 'FUNCIONÓ' && 'text-success',
 maintenance.resultNotes === 'PARCIAL' && 'text-warning-muted-foreground',
 maintenance.resultNotes === 'NO_FUNCIONÓ' && 'text-destructive',
 )}>
 {maintenance.resultNotes === 'FUNCIONÓ' ? '✅ Funcionó' :
 maintenance.resultNotes === 'PARCIAL' ? '⚠️ Parcial' :
 maintenance.resultNotes === 'NO_FUNCIONÓ' ? '❌ No funcionó' :
 maintenance.resultNotes}
 </span>
 </div>
 )}
 </div>
 )}
 </div>
 <div className="flex gap-2 ml-4">
 <Button
 variant="outline"
 size="sm"
 onClick={(e) => {
 e.stopPropagation();
 handleViewMaintenance(maintenance);
 }}
 title="Ver detalles"
 className="h-8 w-8 p-0"
 >
 <Eye className="h-3.5 w-3.5" />
 </Button>
 {canEditMaintenance && (
 <Button
 variant="outline"
 size="sm"
 onClick={(e) => {
 e.stopPropagation();
 handleEditMaintenance(maintenance);
 }}
 title="Editar"
 className="h-8 w-8 p-0"
 >
 <SquarePen className="h-3.5 w-3.5" />
 </Button>
 )}
 {canDeleteMaintenance && (
 <Button
 variant="outline"
 size="sm"
 onClick={(e) => {
 e.stopPropagation();
 handleDeleteMaintenance(maintenance);
 }}
 title="Eliminar mantenimiento"
 className="h-8 w-8 p-0"
 >
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 )}
 {canDuplicateMaintenance && (
 <Button
 variant="outline"
 size="sm"
 onClick={(e) => {
 e.stopPropagation();
 handleDuplicateMaintenance(maintenance);
 }}
 title="Duplicar mantenimiento"
 className="h-8 w-8 p-0"
 >
 <Copy className="h-3.5 w-3.5" />
 </Button>
 )}
 </div>
 </div>
 </div>
 </Card>
 ))}
 {completedTodayMaintenances.length === 0 && (
 <Card>
 <div className="p-8 text-center">
 <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
 <h3 className="text-lg font-semibold mb-2">Sin completados hoy</h3>
 <p className="text-sm text-muted-foreground">No hay mantenimientos completados hoy</p>
 </div>
 </Card>
 )}
 <div
 ref={completedLoadMoreRef}
 className="h-10 flex items-center justify-center text-xs text-muted-foreground"
 >
 {completedTodayMaintenances.length === 0
 ? 'Sin mantenimientos completados en el período'
 : completedLoadingMore
 ? 'Cargando mantenimientos...'
 : 'Seguí desplazando...'}
 </div>
 {completedTailHeight > 0 && (
 <div style={{ height: completedTailHeight }} className="w-full" />
 )}
 </div>
 </TabsContent>

 <TabsContent
 value="all"
 className="space-y-4 md:flex-1 md:overflow-y-auto pr-2 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-300px)] md:max-h-none maintenance-content-scroll"
 style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
 >
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 overflow-x-hidden">
 <h2 className="text-sm font-medium">Todos los Mantenimientos</h2>
 <div className="flex items-center gap-2 shrink-0">
 <span className="text-xs text-muted-foreground whitespace-nowrap">Estado:</span>
 <Select 
 value={filters.status} 
 onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
 >
 <SelectTrigger className="w-36 h-8 text-xs">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todos</SelectItem>
 <SelectItem value="PENDING">Pendientes</SelectItem>
 <SelectItem value="COMPLETED">Completados</SelectItem>
 </SelectContent>
 </Select>
 <Button 
 variant="outline" 
 size="sm" 
 className="h-8 text-xs gap-1"
 onClick={() => setShowAllKPIs(!showAllKPIs)}
 >
 <BarChart3 className="h-3 w-3" />
 Ver KPIs
 </Button>
 </div>
 </div>

 {/* KPIs principales (Completados a Tiempo, MTTR, MTBF, Disponibilidad) */}
 {showAllKPIs && (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 mt-4">
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Completados a Tiempo</p>
 <p className="text-sm font-medium text-success">
 {kpis ? `${formatNumber(kpis.completionRate, 1)}%` : '--'}
 </p>
 </div>
 <div className="h-10 w-10 bg-success-muted rounded-full flex items-center justify-center">
 <CheckCircle className="h-5 w-5 text-success" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">MTTR Promedio</p>
 <p className="text-sm font-medium text-info-muted-foreground">
 {kpis ? `${formatNumber(kpis.avgMTTR, 1)}h` : '--'}
 </p>
 </div>
 <div className="h-10 w-10 bg-info-muted rounded-full flex items-center justify-center">
 <Timer className="h-5 w-5 text-info-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">MTBF Promedio</p>
 <p className="text-sm font-medium text-accent-purple-muted-foreground">
 {kpis ? `${formatNumber(kpis.avgMTBF, 1)}h` : '--'}
 </p>
 </div>
 <div className="h-10 w-10 bg-accent-purple-muted rounded-full flex items-center justify-center">
 <Activity className="h-5 w-5 text-accent-purple-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Disponibilidad</p>
 <p className="text-sm font-medium text-indigo-600">
 {kpis ? `${formatNumber(kpis.uptime, 1)}%` : '--'}
 </p>
 </div>
 <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
 <Target className="h-5 w-5 text-indigo-600" />
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 )}

 {/* Línea divisora */}
 <div className="border-t border-border my-4"></div>

 <div className="space-y-4 overflow-x-hidden" role="list" aria-label="Lista de mantenimientos completados">
 {displayedMaintenances.map(maintenance => (
 <Card
 key={maintenance.id}
 className="cursor-pointer hover:shadow-md transition-shadow w-full overflow-hidden"
 onClick={() => handleViewMaintenance(maintenance)}
 role="listitem"
 aria-label={`${maintenance.title || 'Sin título'} - ${maintenance.type === 'CORRECTIVE' ? 'Correctivo' : 'Preventivo'} - ${getStatusLabel(maintenance.status)}`}
 >
 <div className="p-4 sm:p-4 overflow-x-hidden">
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
 <div className="flex-1 min-w-0">
 <div className="flex flex-wrap items-center gap-2 mb-2">
 <h3 className="text-sm font-medium break-words">{maintenance.title || 'Sin título'}</h3>
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-muted text-muted-foreground shrink-0">
 ID: {maintenance.id}
 </div>
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-primary/80 bg-warning-muted text-warning-muted-foreground shrink-0">
 {getPriorityLabel(maintenance.priority)}
 </div>
 <div className={cn(
 "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-primary/80 shrink-0",
 maintenance.status === 'COMPLETED'
 ? 'bg-success-muted text-success-muted-foreground'
 : (maintenance.lastExecutionDate && maintenance.status !== 'COMPLETED')
 ? 'bg-warning-muted text-warning-muted-foreground'
 : 'bg-warning-muted text-warning-muted-foreground'
 )}>
 {maintenance.status === 'COMPLETED' 
 ? 'Completado' 
 : (maintenance.lastExecutionDate && maintenance.status !== 'COMPLETED')
 ? 'Reprogramado'
 : 'Pendiente'}
 </div>
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground shrink-0">
 {maintenance.type === 'CORRECTIVE' ? 'Correctivo' : 'Preventivo'}
 </div>
 </div>
 <p className="text-xs text-muted-foreground mb-2 break-words">{stripHtmlTags(maintenance.description) || 'Sin descripción'}</p>
 <div className="flex flex-wrap items-center gap-3 mb-2 text-xs text-muted-foreground">
 <div className="flex items-center gap-1">
 <Clock className="h-3 w-3 shrink-0" />
 <span>Ventana: {translateExecutionWindow(maintenance.executionWindow || '4')}</span>
 </div>
 </div>
 <div className="flex items-center gap-2 mb-2 flex-wrap">
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground text-xs">
 <Wrench className="h-3 w-3 mr-1" />
 {maintenance.unidadMovil?.nombre || maintenance.machine?.name || 'Sin equipo'}
 </div>
 {maintenance.machine?.sector && (
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-xs bg-success-muted text-success">
 <Building className="h-3 w-3 mr-1" />
 {maintenance.machine.sector.name}
 </div>
 )}
 {/* Componentes */}
 {(() => {
 const componentNames = maintenance.componentNames || (maintenance.components?.map((c: any) => c.name)) || [];
 const componentIds = maintenance.componentIds || (maintenance.components?.map((c: any) => c.id)) || [];
 const allComponents = componentNames.length > 0 ? componentNames : componentIds.map((id: number) => `Componente ${id}`);
 return allComponents.map((name: string, idx: number) => (
 <div key={`component-${idx}`} className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-xs bg-info-muted text-info-muted-foreground">
 <Cog className="h-3 w-3 mr-1" />
 {name}
 </div>
 ));
 })()}
 {/* Subcomponentes */}
 {(() => {
 const subcomponentNames = maintenance.subcomponentNames || (maintenance.subcomponents?.map((s: any) => s.name)) || [];
 const subcomponentIds = maintenance.subcomponentIds || (maintenance.subcomponents?.map((s: any) => s.id)) || [];
 const allSubcomponents = subcomponentNames.length > 0 ? subcomponentNames : subcomponentIds.map((id: number) => `Subcomponente ${id}`);
 return allSubcomponents.map((name: string, idx: number) => (
 <div key={`subcomponent-${idx}`} className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-xs bg-accent-purple-muted text-accent-purple-muted-foreground">
 <Settings className="h-3 w-3 mr-1" />
 {name}
 </div>
 ));
 })()}
 </div>
 <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-muted-foreground">
 {/* Periodicidad */}
 {(() => {
 // Usar frequency si está disponible, sino frequencyDays
 const frequency = maintenance.frequency || maintenance.frequencyDays;
 
 if (frequency) {
 return (
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 <span>{formatFrequency(frequency)}</span>
 </div>
 );
 }
 return null;
 })()}
 {/* Duración */}
 <div className="flex items-center gap-1">
 <Clock className="h-3 w-3" />
 {getDurationDisplay(maintenance)}
 </div>
 {/* Fecha próxima */}
 {(() => {
 // Para mantenimientos completados, calcular la fecha próxima basada en completedDate + frequency
 if (maintenance.status === 'COMPLETED' && maintenance.completedDate) {
 try {
 const completedDate = new Date(maintenance.completedDate);
 
 if (isNaN(completedDate.getTime())) {
 return maintenance.nextMaintenanceDate ? (
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 <span>Próximo: {formatDate(maintenance.nextMaintenanceDate)}</span>
 </div>
 ) : null;
 }
 
 let nextDate = new Date(completedDate);
 
 // Usar la misma lógica que en la pestaña Completados
 let frequency = maintenance.frequency || maintenance.frequencyDays;
 let frequencyUnit = maintenance.frequencyUnit;
 
 // Si frequency es un string como 'MONTHLY', convertirlo a número
 if (typeof frequency === 'string') {
 switch (frequency.toUpperCase()) {
 case 'MONTHLY':
 frequency = 1;
 frequencyUnit = 'MONTHS';
 break;
 case 'WEEKLY':
 frequency = 1;
 frequencyUnit = 'WEEKS';
 break;
 case 'DAILY':
 frequency = 1;
 frequencyUnit = 'DAYS';
 break;
 case 'YEARLY':
 frequency = 1;
 frequencyUnit = 'YEARS';
 break;
 default:
 const parsedFreq = parseInt(frequency);
 if (!isNaN(parsedFreq)) {
 frequency = parsedFreq;
 } else {
 frequency = 1;
 frequencyUnit = 'MONTHS';
 }
 }
 }
 
 if (!frequencyUnit) {
 frequencyUnit = frequency >= 365 ? 'YEARS' :
 frequency >= 30 ? 'MONTHS' :
 frequency >= 7 ? 'WEEKS' : 'DAYS';
 }
 
 if (!frequency || frequency === 0) {
 frequency = 1;
 frequencyUnit = 'MONTHS';
 }
 
 // Usar la función helper para calcular la fecha correctamente
 nextDate = calculateNextDate(completedDate, frequency, frequencyUnit);
 
 if (isNaN(nextDate.getTime())) {
 return maintenance.nextMaintenanceDate ? (
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 <span>Próximo: {formatDate(maintenance.nextMaintenanceDate)}</span>
 </div>
 ) : null;
 }
 
 return (
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 <span>Próximo: {formatDate(nextDate.toISOString())}</span>
 </div>
 );
 } catch (error) {
 console.error('Error calculating next date:', error);
 return maintenance.nextMaintenanceDate ? (
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 <span>Próximo: {formatDate(maintenance.nextMaintenanceDate)}</span>
 </div>
 ) : null;
 }
 }
 
 // Para mantenimientos no completados, usar la fecha del backend
 return maintenance.nextMaintenanceDate ? (
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 <span>Próximo: {formatDate(maintenance.nextMaintenanceDate)}</span>
 </div>
 ) : null;
 })()}
 {/* Fecha de completado */}
 {maintenance.status === 'COMPLETED' && (
 <div className="flex items-center gap-1">
 <CheckCircle className="h-3 w-3" />
 {maintenance.completedDate ? formatDate(maintenance.completedDate) : 'Sin completar'}
 </div>
 )}
 {/* Para correctivos completados: Realizado por, Para correctivos pendientes: Reportado por, Para preventivos: Asignado */}
 <div className="flex items-center gap-1">
 <User className="h-3 w-3" />
 {maintenance.type === 'CORRECTIVE'
 ? (maintenance.status === 'COMPLETED'
 ? (maintenance.appliedBy || maintenance.assignedToName || 'Sin asignar')
 : (maintenance.reportedByName || maintenance.assignedToName || 'Sin asignar'))
 : (maintenance.assignedToName || 'Sin asignar')}
 </div>
 </div>
 </div>
 <div className="flex gap-2 sm:ml-4 mt-2 sm:mt-0">
 {canEditMaintenance && (
 <Button
 variant="outline"
 size="sm"
 onClick={(e) => {
 e.stopPropagation();
 handleEditMaintenance(maintenance);
 }}
 title="Editar"
 className="shrink-0 h-8 w-8 p-0"
 >
 <SquarePen className="h-3.5 w-3.5" />
 </Button>
 )}
 {maintenance.status === 'PENDING' && canExecuteMaintenance && (
 <Button 
 variant="default"
 size="sm"
 onClick={(e) => {
 e.stopPropagation();
 handleExecuteMaintenance(maintenance);
 }}
 title="Realizar mantenimiento"
 className="shrink-0 h-8 w-8 p-0"
 >
 <Check className="h-4 w-4" />
 </Button>
 )}
 {canDeleteMaintenance && (
 <Button 
 variant="outline" 
 size="sm"
 onClick={(e) => {
 e.stopPropagation();
 handleDeleteMaintenance(maintenance);
 }}
 title="Eliminar mantenimiento"
 className="h-8 w-8 p-0"
 >
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 )}
 {canDuplicateMaintenance && (
 <Button 
 variant="outline" 
 size="sm"
 onClick={(e) => {
 e.stopPropagation();
 handleDuplicateMaintenance(maintenance);
 }}
 title="Duplicar mantenimiento"
 className="h-8 w-8 p-0"
 >
 <Copy className="h-3.5 w-3.5" />
 </Button>
 )}
 </div>
 </div>
 </div>
 </Card>
 ))}
 {allMaintenances.length === 0 && (
 <Card>
 <div className="p-8 text-center">
 <ListTodo className="h-12 w-12 text-info-muted-foreground mx-auto mb-4" />
 <h3 className="text-lg font-semibold mb-2">Sin mantenimientos</h3>
 <p className="text-sm text-muted-foreground">No hay mantenimientos registrados</p>
 </div>
 </Card>
 )}
 <div
 ref={allLoadMoreRef}
 className="h-10 flex items-center justify-center text-xs text-muted-foreground"
 >
 {allMaintenances.length === 0
 ? 'Sin mantenimientos disponibles'
 : allLoadingMore
 ? 'Cargando mantenimientos...'
 : 'Seguí desplazando...'}
 </div>
 {allTailHeight > 0 && (
 <div style={{ height: allTailHeight }} className="w-full" />
 )}
 </div>
 </TabsContent>

 <TabsContent value="calendar" className="space-y-4 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-300px)] md:max-h-none" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
 <MaintenanceCalendar
 maintenances={allMaintenances}
 onEventClick={handleEventClick}
 onEventSelect={handleEventSelect}
 filters={filters}
 companyId={companyId}
 canEdit={canEditMaintenance}
 onEdit={handleEditMaintenance}
 />
 </TabsContent>

 <TabsContent
 value="history"
 className="space-y-4 md:flex-1 overflow-y-auto pr-2"
 >
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
 <h2 className="text-sm font-medium">Historial de Mantenimientos</h2>
 <div className="flex items-center gap-2 shrink-0">
 <Label htmlFor="history-period-input" className="text-xs text-muted-foreground whitespace-nowrap">
 Últimos
 </Label>
 <input
 id="history-period-input"
 type="number"
 min="0"
 value={historyPeriodDays}
 onChange={(e) => {
 const value = parseInt(e.target.value) || 0;
 setHistoryPeriodDays(Math.max(0, value));
 }}
 className="flex h-8 w-20 rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:border-input"
 placeholder="30"
 />
 <Label htmlFor="history-period-input" className="text-xs text-muted-foreground whitespace-nowrap">
 días
 </Label>
 <Button 
 variant="outline" 
 size="sm" 
 className="h-8 text-xs gap-1"
 onClick={() => setShowHistoryKPIs(!showHistoryKPIs)}
 >
 <BarChart3 className="h-3 w-3" />
 Ver KPIs
 </Button>
 </div>
 </div>

 {/* KPIs principales (Completados a Tiempo, MTTR, MTBF, Disponibilidad) */}
 {showHistoryKPIs && (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 mt-4">
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Completados a Tiempo</p>
 <p className="text-sm font-medium text-success">
 {kpis ? `${formatNumber(kpis.completionRate, 1)}%` : '--'}
 </p>
 </div>
 <div className="h-10 w-10 bg-success-muted rounded-full flex items-center justify-center">
 <CheckCircle className="h-5 w-5 text-success" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">MTTR Promedio</p>
 <p className="text-sm font-medium text-info-muted-foreground">
 {kpis ? `${formatNumber(kpis.avgMTTR, 1)}h` : '--'}
 </p>
 </div>
 <div className="h-10 w-10 bg-info-muted rounded-full flex items-center justify-center">
 <Timer className="h-5 w-5 text-info-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">MTBF Promedio</p>
 <p className="text-sm font-medium text-accent-purple-muted-foreground">
 {kpis ? `${formatNumber(kpis.avgMTBF, 1)}h` : '--'}
 </p>
 </div>
 <div className="h-10 w-10 bg-accent-purple-muted rounded-full flex items-center justify-center">
 <Activity className="h-5 w-5 text-accent-purple-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Disponibilidad</p>
 <p className="text-sm font-medium text-indigo-600">
 {kpis ? `${formatNumber(kpis.uptime, 1)}%` : '--'}
 </p>
 </div>
 <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
 <Target className="h-5 w-5 text-indigo-600" />
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 )}
 
 {/* Filtro de búsqueda para el historial con autocompletado */}
 <div className="flex items-center gap-2">
 <div className="flex-1 relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <input
 type="text"
 placeholder="Buscar mantenimiento en el historial..."
 value={historySearchTerm}
 onChange={(e) => setHistorySearchTerm(e.target.value)}
 onFocus={() => historySearchTerm && setShowSuggestions(true)}
 onBlur={() => {
 // Delay para permitir click en sugerencias
 setTimeout(() => setShowSuggestions(false), 200);
 }}
 className="w-full pl-10 pr-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
 />
 
 {/* Dropdown de sugerencias */}
 {showSuggestions && historySuggestions.length > 0 && (
 <div className="absolute top-full left-0 right-0 bg-background border border-border rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
 {historySuggestions.slice(0, 10).map((suggestion, index) => (
 <div
 key={index}
 onClick={() => handleSuggestionSelect(suggestion)}
 className={cn("px-3 py-2 hover:bg-muted cursor-pointer border-b border-border last:border-b-0 flex items-center justify-between",
 selectedHistoryItems.includes(suggestion.id) && "bg-info-muted"
 )}
 >
 <div className="flex-1">
 <div className="text-sm font-medium text-foreground">{suggestion.title}</div>
 <div className="text-xs text-muted-foreground">{suggestion.machineName}</div>
 </div>
 <div className="ml-2">
 {selectedHistoryItems.includes(suggestion.id) ? (
 <div className="w-4 h-4 bg-info-muted0 rounded text-white text-xs flex items-center justify-center">✓</div>
 ) : (
 <div className="w-4 h-4 border border-border rounded"></div>
 )}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 {(historySearchTerm || selectedHistoryItems.length > 0) && (
 <div className="flex gap-2 items-center">
 {selectedHistoryItems.length > 0 && (
 <div className="text-sm text-foreground">
 {selectedHistoryItems.length} seleccionado{selectedHistoryItems.length !== 1 ? 's' : ''}
 </div>
 )}
 <button
 onClick={handleClearSearch}
 className="px-3 py-2 text-sm text-foreground hover:text-foreground underline"
 >
 Limpiar
 </button>
 </div>
 )}
 </div>

 {/* Línea divisora */}
 <div className="border-t border-border my-4"></div>

 <div className="space-y-4">
 {historyList.map(history => (
 <Card key={history.id}>
 <div className="p-4">
 <div className="flex justify-between items-start">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <h3 className="text-sm font-medium">{history.title || 'Mantenimiento'}</h3>
 <div className={cn(
 "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-primary/80",
 history.completionStatus === 'RESCHEDULED'
 ? 'bg-warning-muted text-warning-muted-foreground'
 : 'bg-success-muted text-success-muted-foreground'
 )}>
 {history.completionStatus === 'RESCHEDULED' ? 'Reprogramado' : 'Completado'}
 </div>
 {history.isFromChecklist && (
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-primary/80 bg-info-muted text-info-muted-foreground">
 Checklist
 </div>
 )}
 {history.qualityScore && (
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground">
 Calidad: {history.qualityScore}/10
 </div>
 )}
 </div>
 <p className="text-xs text-muted-foreground mb-2">
 Ejecutado por: {history.assignedToName || 'N/A'} • {formatDateTime(history.executedAt)}
 </p>
 <div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
 {history.completionStatus === 'RESCHEDULED' ? (
 <div className="flex items-center gap-1">
 <Calendar className="h-3 w-3" />
 <span>Reprogramado para: {history.newDate ? new Date(history.newDate).toLocaleDateString('es-ES') : 'N/A'}</span>
 </div>
 ) : (
 <>
 <div className="flex items-center gap-1">
 <Clock className="h-3 w-3" />
 <span>Duración: {history.actualDuration 
 ? history.actualDuration < 60 
 ? `${history.actualDuration}m` 
 : `${Math.round(history.actualDuration / 60)}h ${history.actualDuration % 60}m`
 : 'N/A'}</span>
 </div>
 {!history.isFromChecklist && history.actualValue && history.actualValue !== null && (
 <div className="flex items-center gap-1">
 <Target className="h-3 w-3" />
 <span>Cantidad: {history.actualValue} {history.actualUnit === 'CYCLES' ? 'Ciclos' : history.actualUnit}</span>
 </div>
 )}
 </>
 )}
 </div>
 <div className="flex items-center gap-4 text-xs text-muted-foreground">
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 {formatDateTime(history.executedAt)}
 </div>
 <div className="flex items-center gap-1">
 <CheckCircle className="h-3 w-3" />
 {history.completionStatus === 'RESCHEDULED' ? 'Reprogramado' : 'Completado'}
 </div>
 <div className="flex items-center gap-1">
 <User className="h-3 w-3" />
 {history.assignedToName || 'Sin asignar'}
 </div>
 {/* Eficiencia removida */}
 </div>
 {history.notes && (
 <div className="mt-2 p-2 bg-muted rounded text-xs">
 <p className="text-foreground font-medium">Notas:</p>
 <p className="text-foreground">{history.notes}</p>
 {history.completionStatus === 'RESCHEDULED' && history.rescheduleReason && (
 <p className="text-foreground mt-1">
 <span className="font-medium">Motivo de reprogramación:</span> {history.rescheduleReason}
 </p>
 )}
 </div>
 )}
 {history.issues && (
 <div className="mt-2 p-2 bg-destructive/10 rounded text-xs">
 <p className="text-destructive font-medium">Problemas encontrados:</p>
 <p className="text-destructive">{history.issues}</p>
 </div>
 )}
 </div>
 </div>
 </div>
 </Card>
 ))}
 <div
 ref={historyLoadMoreRef}
 className="h-10 flex items-center justify-center text-xs text-muted-foreground"
 >
 {historyList.length === 0
 ? 'Sin ejecuciones registradas'
 : historyLoadingMore
 ? 'Cargando historial...'
 : 'Seguí desplazando...'}
 </div>
 {historyTailHeight > 0 && (
 <div style={{ height: historyTailHeight }} className="w-full" />
 )}
 {historyList.length === 0 && (
 <Card>
 <div className="p-8 text-center">
 <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
 <h3 className="text-lg font-semibold mb-2">Sin historial</h3>
 <p className="text-sm text-muted-foreground">No hay mantenimientos completados en el período seleccionado</p>
 </div>
 </Card>
 )}
 {checklists.length > 0 && filteredChecklists.length === 0 && checklistSearchTerm && (
 <Card>
 <div className="p-8 text-center">
 <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
 <h3 className="text-lg font-semibold mb-2">No se encontraron resultados</h3>
 <p className="text-sm text-muted-foreground">No hay checklists que coincidan con "{checklistSearchTerm}"</p>
 </div>
 </Card>
 )}
 </div>
 </TabsContent>

 <TabsContent value="checklists" className="flex flex-col space-y-4">
 <div className="flex justify-between items-center flex-shrink-0">
 <h2 className="text-sm font-medium">Checklists</h2>
 {canCreateChecklist && (
 <Button 
 onClick={() => {
 setDialogMode('create');
 setEditingChecklist(null);
 setIsChecklistDialogOpen(true);
 }}
 className="h-9 text-xs"
 >
 <Plus className="h-3 w-3 mr-2" />
 Crear Checklist
 </Button>
 )}
 </div>

 {/* Buscador de Checklists */}
 <div className="flex items-center gap-2">
 <div className="flex-1 relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <input
 type="text"
 placeholder="Buscar por nombre o ID del checklist..."
 value={checklistSearchTerm}
 onChange={(e) => setChecklistSearchTerm(e.target.value)}
 className="w-full pl-10 pr-3 h-9 border border-input bg-background rounded-md text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:border-primary/50 transition-colors"
 />
 </div>
 </div>

 {/* Línea divisora */}
 <div className="border-t border-border my-4"></div>

 <div className="relative pr-2 max-h-[calc(100vh-280px)] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
 <div ref={checklistsContainerRef} className="space-y-4 pb-32 md:pb-12">
 {filteredChecklists.map(checklist => {
 // Verificar si el checklist debe reiniciarse
 const needsReset = shouldResetChecklist({
 lastExecutionDate: checklist.lastExecutionDate,
 frequency: checklist.frequency,
 isCompleted: checklist.isCompleted
 });

 // Si necesita reinicio, actualizar automáticamente
 if (needsReset && checklist.isCompleted) {
 updateChecklistStatus(checklist.id, false);
 }

 return (
 <Card 
 key={checklist.id} 
 className="cursor-pointer hover:shadow-md transition-shadow"
 onClick={() => {
 // Opening checklist detail dialog
 setChecklistToShowDetails(checklist);
 setIsChecklistDetailDialogOpen(true);
 }}
 >
 <div className="p-3 md:p-4">
 <div className="flex flex-col md:flex-row md:justify-between items-start gap-3">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <h3 className="text-sm font-medium">{checklist.title}</h3>
 <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
 ID: {checklist.id}
 </Badge>
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-normal transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground">
 {getFrequencyLabel(checklist.frequency)}
 </div>
 {checklist.isCompleted && (
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-normal transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-primary/80 bg-success-muted text-success-muted-foreground">
 Completado
 </div>
 )}
 {checklist.hasInProgressExecution && !checklist.isCompleted && (
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-normal transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-primary/80 bg-info-muted text-info-muted-foreground">
 En Progreso
 </div>
 )}
 {checklist.isTemplate && (
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-normal transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-primary/80 bg-info-muted text-info-muted-foreground">
 Plantilla
 </div>
 )}
 </div>
 {checklist.description && (
 <p className="text-xs text-muted-foreground mb-2">&quot;{checklist.description}&quot;</p>
 )}
 <div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
 <div className="flex items-center gap-1">
 <CheckSquare className="h-3 w-3" />
 <span>Items: {getTotalItemsCount(checklist)}</span>
 </div>
 <div className="flex items-center gap-1">
 <Settings className="h-3 w-3" />
 <span>Máquina: {checklist.machine?.name || 'Todas'}</span>
 </div>
 </div>
 <div className="flex items-center gap-2 mb-2">
 <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-normal transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground text-xs">
 <Timer className="h-3 w-3 mr-1" />
 {checklist.estimatedTotalTime ? (() => {
 const totalMinutes = checklist.estimatedTotalTime;
 if (totalMinutes >= 60) {
 const hours = Math.floor(totalMinutes / 60);
 const minutes = totalMinutes % 60;
 if (minutes > 0) {
 return `${hours}h ${minutes}m estimadas`;
 } else {
 return `${hours}h estimadas`;
 }
 } else {
 return `${totalMinutes}m estimadas`;
 }
 })() : 'Sin tiempo estimado'}
 </div>
 </div>
 <div className="flex items-center gap-4 text-xs text-muted-foreground">
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 {formatLastExecution(checklist.lastExecutionDate)}
 </div>
 <div className="flex items-center gap-1">
 <Clock className="h-3 w-3" />
 {checklist.isCompleted ? 'Completado' : checklist.hasInProgressExecution ? 'En Progreso' : 'Pendiente'}
 </div>
 </div>
 </div>
 <div className="flex gap-2 md:ml-4 flex-wrap justify-end w-full md:w-auto">
 <Button 
 variant="outline" 
 size="sm" 
 onClick={(e) => {
 e.stopPropagation();
 handlePrintChecklist(checklist);
 }}
 title="Imprimir Checklist"
 className="h-8 w-8 p-0"
 >
 <Printer className="h-3.5 w-3.5" />
 </Button>
 {canEditChecklist && (
 <Button 
 variant="outline" 
 size="sm" 
 onClick={(e) => {
 e.stopPropagation();
 handleEditChecklist(checklist);
 }}
 title="Editar checklist"
 className="h-8 w-8 p-0"
 >
 <Edit className="h-3.5 w-3.5" />
 </Button>
 )}
 {canExecuteMaintenance && (
 <Button 
 variant="default"
 size="sm"
 onClick={(e) => {
 e.stopPropagation();
 handleExecuteChecklist(checklist);
 }}
 title={
 checklist.isCompleted 
 ? 'Re-abrir' 
 : checklist.hasInProgressExecution 
 ? 'Terminar Checklist' 
 : 'Ejecutar'
 }
 className={cn("h-8 w-8 p-0",
 checklist.hasInProgressExecution && !checklist.isCompleted
 ? 'bg-warning hover:bg-warning/90'
 : checklist.isCompleted
 ? 'bg-success hover:bg-success/90'
 : ''
 )}
 >
 {checklist.hasInProgressExecution && !checklist.isCompleted ? (
 <PlayCircle className="h-3.5 w-3.5" />
 ) : (
 <Check className="h-3.5 w-3.5" />
 )}
 </Button>
 )}
 {canDeleteChecklist && (
 <Button
 variant="outline"
 size="sm"
 onClick={(e) => {
 e.stopPropagation();
 handleDeleteChecklist(checklist);
 }}
 title="Eliminar checklist"
 className="h-8 w-8 p-0"
 >
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 )}
 </div>
 </div>
 </div>
 </Card>
 );
 })}

 {/* Trigger para scroll infinito */}
 <div ref={loadMoreTriggerRef} className="h-20 flex items-center justify-center py-8 text-sm text-muted-foreground">
 {checklists.length === 0
 ? 'Sin checklists disponibles'
 : filteredChecklists.length === 0 && checklistSearchTerm
 ? 'No se encontraron checklists con ese criterio'
 : loadingMoreChecklists
 ? (
 <div className="flex items-center gap-2">
 <RefreshCw className="h-4 w-4 animate-spin" />
 <span>Cargando más checklists...</span>
 </div>
 )
 : 'Seguí desplazando...'}
 </div>
 {checklistsTailHeight > 0 && (
 <div style={{ height: checklistsTailHeight }} className="w-full" />
 )}

 {checklists.length === 0 && !loading && (
 <Card>
 <div className="p-8 text-center">
 <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
 <h3 className="text-sm font-medium mb-2">Sin checklists</h3>
 <p className="text-sm text-muted-foreground">No hay checklists configurados</p>
 {canCreateChecklist && (
 <Button 
 className="mt-4 h-9 text-xs" 
 onClick={() => {
 setDialogMode('create');
 setEditingChecklist(null);
 setIsChecklistDialogOpen(true);
 }}
 >
 <Plus className="h-3 w-3 mr-2" />
 Crear Checklist
 </Button>
 )}
 </div>
 </Card>
 )}
 </div>
 </div>
 </TabsContent>

 <TabsContent value="analytics" className="space-y-6 pr-2 max-h-[600px] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
 {/* Header con selector de período */}
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
 <h2 className="text-sm font-medium">Estadísticas de Mantenimientos</h2>
 <div className="flex items-center gap-2 shrink-0">
 <Label htmlFor="analytics-period-input" className="text-xs text-muted-foreground whitespace-nowrap">
 Últimos
 </Label>
 <input
 id="analytics-period-input"
 type="number"
 min="0"
 value={analyticsPeriodDays}
 onChange={(e) => {
 const value = parseInt(e.target.value) || 0;
 setAnalyticsPeriodDays(Math.max(0, value));
 }}
 className="flex h-8 w-20 rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:border-input"
 placeholder="30"
 />
 <Label htmlFor="analytics-period-input" className="text-xs text-muted-foreground whitespace-nowrap">
 días
 </Label>
 </div>
 </div>

 {/* Línea divisora */}
 <div className="border-t border-border my-4"></div>

 {/* KPIs Principales */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 {/* Total Mantenimientos */}
 <Card>
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Total Mantenimientos</p>
 <p className="text-lg font-medium">{allMaintenances.length}</p>
 </div>
 <div className="bg-muted p-3 rounded-lg">
 <Wrench className="h-4 w-4 text-muted-foreground" />
 </div>
 </div>
 <div className="mt-4 flex items-center text-xs">
 <TrendingUp className="h-3 w-3 text-muted-foreground mr-1" />
 <span className="text-muted-foreground">+12%</span>
 <span className="text-muted-foreground ml-1">vs mes anterior</span>
 </div>
 </CardContent>
 </Card>

 {/* Completados */}
 <Card>
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Completados</p>
 <p className="text-lg font-medium">{allMaintenances.filter(m => m.status === 'COMPLETED').length}</p>
 </div>
 <div className="bg-muted p-3 rounded-lg">
 <CheckCircle className="h-4 w-4 text-muted-foreground" />
 </div>
 </div>
 <div className="mt-4 flex items-center text-xs">
 <TrendingUp className="h-3 w-3 text-muted-foreground mr-1" />
 <span className="text-muted-foreground">+8%</span>
 <span className="text-muted-foreground ml-1">vs mes anterior</span>
 </div>
 </CardContent>
 </Card>

 {/* Pendientes */}
 <Card>
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Pendientes</p>
 <p className="text-lg font-medium">{allMaintenances.filter(m => m.status === 'PENDING').length}</p>
 </div>
 <div className="bg-muted p-3 rounded-lg">
 <Clock className="h-4 w-4 text-muted-foreground" />
 </div>
 </div>
 <div className="mt-4 flex items-center text-xs">
 <TrendingUp className="h-3 w-3 text-muted-foreground mr-1" />
 <span className="text-muted-foreground">+3%</span>
 <span className="text-muted-foreground ml-1">vs mes anterior</span>
 </div>
 </CardContent>
 </Card>

 {/* Tiempo Promedio */}
 <Card>
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Tiempo Promedio</p>
 <p className="text-lg font-medium">
 {(() => {
 const completedMaintenances = allMaintenances.filter(m => m.status === 'COMPLETED');
 if (completedMaintenances.length === 0) return '0h';
 
 const totalHours = completedMaintenances.reduce((sum, maintenance) => {
 const estimatedHours = maintenance.estimatedHours || 0;
 const timeUnit = maintenance.timeUnit || 'HOURS';
 return sum + (timeUnit === 'MINUTES' ? estimatedHours / 60 : estimatedHours);
 }, 0);
 
 const averageHours = totalHours / completedMaintenances.length;
 return averageHours > 0 ? `${formatNumber(averageHours, 1)}h` : '0h';
 })()}
 </p>
 </div>
 <div className="bg-muted p-3 rounded-lg">
 <Timer className="h-4 w-4 text-muted-foreground" />
 </div>
 </div>
 <div className="mt-4 flex items-center text-xs">
 <TrendingUp className="h-3 w-3 text-muted-foreground mr-1" />
 <span className="text-muted-foreground">-5%</span>
 <span className="text-muted-foreground ml-1">vs mes anterior</span>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Distribuciones */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Distribución por Tipo */}
 <Card>
 <CardHeader>
 <CardTitle className="text-sm font-medium flex items-center gap-2">
 <ChartColumn className="h-4 w-4" />
 Distribución por Tipo
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-3 h-3 rounded-full bg-muted-foreground"></div>
 <span className="text-xs font-medium">Preventivo</span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-xs text-muted-foreground">{allMaintenances.filter(m => m.type === 'PREVENTIVE').length}</span>
 <span className="text-xs font-medium">
 {allMaintenances.length > 0 ?
 formatNumber((allMaintenances.filter(m => m.type === 'PREVENTIVE').length / allMaintenances.length) * 100, 1) : 0}%
 </span>
 </div>
 </div>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-3 h-3 rounded-full bg-muted-foreground"></div>
 <span className="text-xs font-medium">Correctivo</span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-xs text-muted-foreground">{allMaintenances.filter(m => m.type === 'CORRECTIVE').length}</span>
 <span className="text-xs font-medium">
 {allMaintenances.length > 0 ?
 formatNumber((allMaintenances.filter(m => m.type === 'CORRECTIVE').length / allMaintenances.length) * 100, 1) : 0}%
 </span>
 </div>
 </div>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-3 h-3 rounded-full bg-muted-foreground"></div>
 <span className="text-xs font-medium">Predictivo</span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-xs text-muted-foreground">0</span>
 <span className="text-xs font-medium">0.0%</span>
 </div>
 </div>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-3 h-3 rounded-full bg-muted-foreground"></div>
 <span className="text-xs font-medium">Emergencia</span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-xs text-muted-foreground">0</span>
 <span className="text-xs font-medium">0.0%</span>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Distribución por Prioridad */}
 <Card>
 <CardHeader>
 <CardTitle className="text-sm font-medium flex items-center gap-2">
 <AlertTriangle className="h-4 w-4" />
 Distribución por Prioridad
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-3 h-3 rounded-full bg-muted-foreground"></div>
 <span className="text-xs font-medium">Baja</span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-xs text-muted-foreground">{allMaintenances.filter(m => m.priority === 'LOW').length}</span>
 <span className="text-xs font-medium">
 {allMaintenances.length > 0 ? 
 formatNumber((allMaintenances.filter(m => m.priority === 'LOW').length / allMaintenances.length) * 100, 1) : 0}%
 </span>
 </div>
 </div>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-3 h-3 rounded-full bg-muted-foreground"></div>
 <span className="text-xs font-medium">Media</span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-xs text-muted-foreground">{allMaintenances.filter(m => m.priority === 'MEDIUM').length}</span>
 <span className="text-xs font-medium">
 {allMaintenances.length > 0 ? 
 formatNumber((allMaintenances.filter(m => m.priority === 'MEDIUM').length / allMaintenances.length) * 100, 1) : 0}%
 </span>
 </div>
 </div>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-3 h-3 rounded-full bg-muted-foreground"></div>
 <span className="text-xs font-medium">Alta</span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-xs text-muted-foreground">{allMaintenances.filter(m => m.priority === 'HIGH').length}</span>
 <span className="text-xs font-medium">
 {allMaintenances.length > 0 ? 
 formatNumber((allMaintenances.filter(m => m.priority === 'HIGH').length / allMaintenances.length) * 100, 1) : 0}%
 </span>
 </div>
 </div>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-3 h-3 rounded-full bg-muted-foreground"></div>
 <span className="text-xs font-medium">Crítica</span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-xs text-muted-foreground">{allMaintenances.filter(m => m.priority === 'CRITICAL').length}</span>
 <span className="text-xs font-medium">
 {allMaintenances.length > 0 ? 
 formatNumber((allMaintenances.filter(m => m.priority === 'CRITICAL').length / allMaintenances.length) * 100, 1) : 0}%
 </span>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Mantenimientos por Activo */}
 <Card>
 <CardHeader>
 <CardTitle className="text-sm font-medium flex items-center gap-2">
 <Building className="h-4 w-4" />
 Mantenimientos por Activo
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {(() => {
 // Agrupar mantenimientos por máquina/unidad móvil
 const assetGroups = allMaintenances.reduce((acc, maintenance) => {
 const assetName = (maintenance as any).unidadMovil?.nombre || maintenance.machine?.name || 'Sin equipo';
 if (!acc[assetName]) {
 acc[assetName] = {
 name: assetName,
 completed: 0,
 pending: 0,
 total: 0
 };
 }
 acc[assetName].total++;
 if (maintenance.status === 'COMPLETED') {
 acc[assetName].completed++;
 } else {
 acc[assetName].pending++;
 }
 return acc;
 }, {} as any);

 return Object.values(assetGroups).slice(0, 5).map((asset: any, index) => (
 <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
 <div className="flex items-center gap-3">
 <div className="bg-muted p-2 rounded-lg">
 <Wrench className="h-4 w-4 text-muted-foreground" />
 </div>
 <div>
 <p className="text-sm font-medium">{asset.name}</p>
 <p className="text-xs text-muted-foreground">Sin apodo</p>
 </div>
 </div>
 <div className="flex items-center gap-6">
 <div className="text-center">
 <p className="text-lg font-medium">{asset.completed}</p>
 <p className="text-xs text-muted-foreground">Completados</p>
 </div>
 <div className="text-center">
 <p className="text-lg font-medium">{asset.pending}</p>
 <p className="text-xs text-muted-foreground">Pendientes</p>
 </div>
 <div className="text-center">
 <p className="text-lg font-medium">{asset.total}</p>
 <p className="text-xs text-muted-foreground">Total</p>
 </div>
 </div>
 </div>
 ));
 })()}
 </div>
 </CardContent>
 </Card>

 {/* Gráficos adicionales */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Mantenimientos por Mes */}
 <Card>
 <CardHeader>
 <CardTitle className="text-sm font-medium flex items-center gap-2">
 <Calendar className="h-4 w-4" />
 Mantenimientos por Mes
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {(() => {
 // Calcular mantenimientos por mes de los últimos 6 meses
 const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
 const currentDate = new Date();
 const monthlyData = [];
 
 // Generar los últimos 6 meses
 for (let i = 5; i >= 0; i--) {
 const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
 const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
 const monthName = monthNames[monthDate.getMonth()];
 
 const count = allMaintenances.filter(maintenance => {
 if (!maintenance.scheduledDate) return false;
 const maintenanceDate = new Date(maintenance.scheduledDate);
 return maintenanceDate >= monthDate && maintenanceDate < nextMonth;
 }).length;
 
 monthlyData.push({ month: monthName, count });
 }
 
 const maxCount = Math.max(...monthlyData.map(d => d.count), 1);
 
 return monthlyData.map(({ month, count }) => {
 const percentage = (count / maxCount) * 100;
 return (
 <div key={month} className="flex items-center justify-between">
 <span className="text-xs font-medium">{month}</span>
 <div className="flex items-center gap-2">
 <div className="w-24 bg-muted rounded-full h-2">
 <div 
 className="bg-muted-foreground h-2 rounded-full" 
 style={{width: `${percentage}%`}}
 ></div>
 </div>
 <span className="text-xs text-muted-foreground w-8">{count}</span>
 </div>
 </div>
 );
 });
 })()}
 </div>
 </CardContent>
 </Card>

 {/* Técnicos Más Activos */}
 <Card>
 <CardHeader>
 <CardTitle className="text-sm font-medium flex items-center gap-2">
 <User className="h-4 w-4" />
 Técnicos Más Activos
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {(() => {
 // Calcular técnicos más activos basado en datos reales
 const technicianStats = allMaintenances.reduce((acc, maintenance) => {
 let technicianName = 'Sin asignar';
 
 // Intentar obtener el nombre del técnico de diferentes maneras
 if (maintenance.assignedTo) {
 if (typeof maintenance.assignedTo === 'string') {
 technicianName = maintenance.assignedTo;
 } else if (typeof maintenance.assignedTo === 'object' && maintenance.assignedTo.name) {
 technicianName = maintenance.assignedTo.name;
 }
 }
 
 // Si aún no tenemos nombre, intentar obtenerlo de assignedToName
 if (technicianName === 'Sin asignar' && (maintenance as any).assignedToName) {
 technicianName = (maintenance as any).assignedToName;
 }
 
 if (!acc[technicianName]) {
 acc[technicianName] = {
 name: technicianName,
 count: 0
 };
 }
 acc[technicianName].count++;
 return acc;
 }, {} as any);

 const sortedTechnicians = Object.values(technicianStats)
 .sort((a: any, b: any) => b.count - a.count)
 .slice(0, 4) as any[];

 const maxCount = sortedTechnicians.length > 0 ? sortedTechnicians[0].count : 1;

 return sortedTechnicians.map((tech, index) => {
 const initials = tech.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
 const percentage = (tech.count / maxCount) * 100;
 return (
 <div key={index} className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
 <span className="text-xs font-medium text-muted-foreground">{initials}</span>
 </div>
 <span className="text-xs font-medium">{tech.name}</span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-xs text-muted-foreground">{tech.count} mantenimientos</span>
 <div className="w-16 bg-muted rounded-full h-2">
 <div 
 className="bg-muted-foreground h-2 rounded-full" 
 style={{width: `${percentage}%`}}
 ></div>
 </div>
 </div>
 </div>
 );
 });
 })()}
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Resumen de Eficiencia removido */}
 </TabsContent>
 </Tabs>
 {/* Modales */}
 <AssetTypeSelector
 isOpen={isAssetTypeSelectorOpen}
 onClose={() => setIsAssetTypeSelectorOpen(false)}
 onSelectAssetType={handleSelectAssetType}
 />

 <MaintenanceTypeSelector
 isOpen={isTypeSelectorOpen}
 onClose={() => setIsTypeSelectorOpen(false)}
 onSelectType={handleSelectMaintenanceType}
 machineName={machineName}
 />

 {/* Suspense boundary para lazy-loaded dialogs */}
 <Suspense fallback={null}>
 <UnidadMovilMaintenanceDialog
 isOpen={isUnidadMovilMaintenanceDialogOpen}
 onClose={() => {
 setIsUnidadMovilMaintenanceDialogOpen(false);
 setEditingMaintenance(null);
 setSelectedUnidadForMaintenance(null);
 }}
 onSave={handleUnidadMovilMaintenanceSave}
 companyId={companyId}
 sectorId={selectedSectorFilter}
 selectedUnidad={selectedUnidadForMaintenance}
 editingMaintenance={editingMaintenance}
 mode={dialogMode}
 />

 <PreventiveMaintenanceDialog
 isOpen={isPreventiveDialogOpen}
 onClose={() => {
 setIsPreventiveDialogOpen(false);
 setEditingMaintenance(null);
 }}
 onSave={handleMaintenanceSave}
 editingMaintenance={editingMaintenance}
 mode={dialogMode}
 preselectedMachineId={machineId}
 />

 <PredictiveMaintenanceDialog
 isOpen={isPredictiveDialogOpen}
 onClose={() => {
 setIsPredictiveDialogOpen(false);
 setEditingMaintenance(null);
 }}
 onSave={handleMaintenanceSave}
 editingMaintenance={editingMaintenance}
 mode={dialogMode}
 preselectedMachineId={machineId}
 />

 <FailureRegistrationDialog
 isOpen={isFailureDialogOpen}
 onClose={() => setIsFailureDialogOpen(false)}
 onFailureSaved={handleFailureSaved}
 onLoadSolution={handleLoadSolution}
 machineId={machineId}
 machineName={machineName}
 />

 <LoadSolutionDialog
 isOpen={isLoadSolutionDialogOpen}
 onClose={() => {
 setIsLoadSolutionDialogOpen(false);
 setFailureData(null);
 }}
 onSave={handleSaveSolution}
 failureData={failureData}
 />

 <CorrectiveMaintenanceDialog
 isOpen={isCorrectiveDialogOpen}
 onClose={() => {
 setIsCorrectiveDialogOpen(false);
 setEditingMaintenance(null);
 setFailureData(null);
 }}
 onSave={handleMaintenanceSave}
 editingMaintenance={editingMaintenance}
 mode={dialogMode}
 preselectedMachineId={machineId}
 failureData={failureData}
 />

 <ChecklistManagementDialog
 isOpen={isChecklistDialogOpen}
 onClose={() => {
 setIsChecklistDialogOpen(false);
 setEditingChecklist(null);
 setSelectedAsset(null);
 // El reset del formulario se maneja internamente en el componente
 }}
 onSave={handleChecklistSave}
 editingChecklist={editingChecklist}
 mode={dialogMode}
 companyId={companyId}
 machineId={machineId}
 sectorId={selectedSectorFilter}
 selectedAsset={selectedAsset}
 />


 <MaintenanceDetailDialog
 isOpen={isDetailDialogOpen}
 onClose={() => {
 setIsDetailDialogOpen(false);
 setSelectedMaintenance(null);
 }}
 maintenance={selectedMaintenance}
 canEdit={canEditMaintenance}
 onEdit={handleEditMaintenance}
 companyId={companyId}
 />

 <ExecuteMaintenanceDialog
 isOpen={isExecuteDialogOpen}
 onClose={() => {
 setIsExecuteDialogOpen(false);
 setMaintenanceToExecute(null);
 }}
 maintenance={maintenanceToExecute}
 onExecute={handleMaintenanceExecution}
 isLoading={isExecuting}
 />

 <DeleteConfirmationDialog
 isOpen={isDeleteDialogOpen}
 onClose={cancelDelete}
 onConfirm={confirmDelete}
 maintenanceTitle={maintenanceToDelete?.title || 'Mantenimiento'}
 maintenanceType={maintenanceToDelete?.isPreventive ? 'preventive' : 'corrective'}
 isLoading={isDeleting}
 />

 {/* Modal de duplicación de mantenimiento */}
 <Dialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
 <DialogContent size="md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Copy className="h-5 w-5" />
 Duplicar Mantenimiento
 </DialogTitle>
 <DialogDescription>
 Selecciona la máquina destino para duplicar &quot;{maintenanceToDuplicate?.title}&quot;
 </DialogDescription>
 </DialogHeader>
 
 <DialogBody className="space-y-4">
 <div className="p-4 bg-muted/50 rounded-lg">
 <h4 className="font-semibold mb-2">Mantenimiento a duplicar:</h4>
 <p className="text-sm text-muted-foreground">{maintenanceToDuplicate?.title}</p>
 <p className="text-sm text-muted-foreground">
 Máquina actual: {maintenanceToDuplicate?.machineName || 'Sin asignar'}
 </p>
 </div>
 
 <div className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="machine-select">Seleccionar máquina destino:</Label>
 <Select onValueChange={(value) => setSelectedMachineForDuplicate(parseInt(value))}>
 <SelectTrigger>
 <SelectValue placeholder="Selecciona una máquina" />
 </SelectTrigger>
 <SelectContent>
 {availableMachines.map((machine: any) => (
 <SelectItem key={machine.id} value={machine.id.toString()}>
 {machine.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 
 <div className="space-y-2">
 <Label htmlFor="unidad-select">O seleccionar unidad móvil destino:</Label>
 <Select onValueChange={(value) => setSelectedUnidadForDuplicate(parseInt(value))}>
 <SelectTrigger>
 <SelectValue placeholder="Selecciona una unidad móvil" />
 </SelectTrigger>
 <SelectContent>
 {availableUnidadesMoviles.map((unidad: any) => (
 <SelectItem key={unidad.id} value={unidad.id.toString()}>
 {unidad.nombre}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>
 </DialogBody>

 <DialogFooter>
 <Button variant="outline" onClick={() => setIsDuplicateDialogOpen(false)}>
 Cancelar
 </Button>
 <Button
 onClick={handleConfirmDuplicate}
 disabled={!selectedMachineForDuplicate && !selectedUnidadForDuplicate}
 >
 Duplicar Mantenimiento
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 <ChecklistExecutionDialog
 isOpen={isExecutionDialogOpen}
 onClose={() => {
 setIsExecutionDialogOpen(false);
 setChecklistToExecute(null);
 }}
 checklist={checklistToExecute}
 onChecklistCompleted={(checklistId, executionData) => {
 // Checklist completado, actualizando datos
 // Usar un solo refresh con debounce para evitar múltiples llamadas
 setTimeout(() => {
 refetchDashboard(); // ✅ OPTIMIZADO
 setChecklistHistoryRefreshTrigger(prev => prev + 1);
 }, 1000); // Un solo delay para asegurar que la API haya terminado
 }}
 />

 <DeleteChecklistDialog
 isOpen={isDeleteChecklistDialogOpen}
 onClose={() => {
 setIsDeleteChecklistDialogOpen(false);
 setChecklistToDelete(null);
 }}
 onConfirm={confirmDeleteChecklist}
 checklistTitle={checklistToDelete?.title || 'Checklist'}
 />

 <ReExecuteChecklistDialog
 isOpen={isReExecuteChecklistDialogOpen}
 onClose={() => {
 setIsReExecuteChecklistDialogOpen(false);
 setChecklistToReExecute(null);
 }}
 onConfirm={confirmReExecuteChecklist}
 checklistTitle={checklistToReExecute?.title || 'Checklist'}
 nextResetDate={checklistToReExecute?.nextResetDate}
 frequency={checklistToReExecute?.frequency || 'MONTHLY'}
 />

 <ChecklistDetailDialog
 isOpen={isChecklistDetailDialogOpen}
 onClose={() => {
 setIsChecklistDetailDialogOpen(false);
 setChecklistToShowDetails(null);
 }}
 checklist={checklistToShowDetails}
 canEdit={canEditChecklist}
 onEdit={(checklist) => {
 setEditingChecklist(checklist);
 setDialogMode('edit');
 setIsChecklistDetailDialogOpen(false);
 setIsChecklistDialogOpen(true);
 }}
 onExecute={(checklist) => {
 setChecklistToExecute(checklist);
 setIsChecklistDetailDialogOpen(false);
 setIsTableExecutionDialogOpen(true);
 }}
 onViewHistory={() => {
 setIsChecklistDetailDialogOpen(false);
 setActiveTab('history');
 }}
 onChecklistUpdated={() => {
 // ✨ Recargar usando hook React Query
 checklistsQuery.refetch();
 }}
 />

 {/* Machine Filter Dialog */}
 <Dialog open={isMachineFilterOpen} onOpenChange={setIsMachineFilterOpen}>
 <DialogContent size="lg">
 <DialogHeader>
 <DialogTitle>Filtrar por Máquinas y Unidades Móviles</DialogTitle>
 <DialogDescription>
 Selecciona las máquinas y unidades móviles para filtrar los mantenimientos
 </DialogDescription>
 </DialogHeader>
 
 <DialogBody className="space-y-6">
 {/* Selector de modo */}
 <div className="space-y-3">
 <h3 className="text-lg font-semibold">Modo de Selección</h3>
 <div className="flex gap-4">
 <Button
 variant={machineFilterMode === 'individual' ? 'default' : 'outline'}
 onClick={() => setMachineFilterMode('individual')}
 className="flex-1"
 >
 <Settings className="h-4 w-4 mr-2" />
 Individual
 </Button>
 <Button
 variant={machineFilterMode === 'category' ? 'default' : 'outline'}
 onClick={() => setMachineFilterMode('category')}
 className="flex-1"
 >
 <Layers className="h-4 w-4 mr-2" />
 Por Categoría
 </Button>
 </div>
 </div>

 {/* Botones de acción */}
 <div className="flex gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={handleSelectAllMachines}
 disabled={availableMachines.length === 0 && availableUnidadesMoviles.length === 0}
 >
 Seleccionar Todas
 </Button>
 <Button
 variant="outline"
 size="sm"
 onClick={handleClearMachineFilter}
 disabled={filters.selectedMachines.length === 0 && filters.selectedUnidadesMoviles.length === 0}
 >
 Limpiar Selección
 </Button>
 </div>

 {/* Contenido según el modo */}
 {machineFilterMode === 'individual' ? (
 <div className="max-h-96 overflow-y-auto space-y-2">
 {getAllAvailableItems().length === 0 ? (
 <p className="text-muted-foreground text-center py-4">
 No hay máquinas o unidades móviles disponibles
 </p>
 ) : (
 getAllAvailableItems().map((item) => (
 <div
 key={item.id}
 className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted cursor-pointer"
 onClick={() => item.type === 'MACHINE' ? handleMachineToggle(item.id) : handleUnidadMovilToggle(item.id)}
 >
 <Checkbox
 checked={item.type === 'MACHINE' ? filters.selectedMachines.includes(item.id.toString()) : filters.selectedUnidadesMoviles.includes(item.id.toString())}
 onChange={() => item.type === 'MACHINE' ? handleMachineToggle(item.id) : handleUnidadMovilToggle(item.id)}
 />
 <div className="flex-1">
 <div className="flex items-center gap-2">
 <p className="font-medium">{item.displayName}</p>
 {item.type === 'UNIDAD_MOVIL' && (
 <Badge variant="outline" className="text-xs">
 Unidad Móvil
 </Badge>
 )}
 </div>
 <p className="text-sm text-muted-foreground">
 {item.displayType} • {item.displayStatus}
 </p>
 {item.patente && (
 <p className="text-xs text-info-muted-foreground">
 Patente: {item.patente}
 </p>
 )}
 </div>
 </div>
 ))
 )}
 </div>
 ) : (
 <div className="space-y-4">
 {Object.entries(getMachineCategories()).map(([category, machines]: [string, any[]]) => {
 const categoryMachineIds = machines.filter((m: any) => m.type === 'MACHINE').map((m: any) => m.id);
 const categoryUnidadMovilIds = machines.filter((m: any) => m.type === 'UNIDAD_MOVIL').map((m: any) => m.id);
 const selectedMachinesInCategory = categoryMachineIds.filter((id: any) => 
 filters.selectedMachines.includes(id.toString())
 );
 const selectedUnidadesInCategory = categoryUnidadMovilIds.filter((id: any) => 
 filters.selectedUnidadesMoviles.includes(id.toString())
 );
 const totalSelected = selectedMachinesInCategory.length + selectedUnidadesInCategory.length;
 const totalItems = categoryMachineIds.length + categoryUnidadMovilIds.length;
 const isFullySelected = totalSelected === totalItems;
 const isPartiallySelected = totalSelected > 0 && !isFullySelected;
 
 return (
 <div key={category} className="border rounded-lg p-4">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center space-x-2">
 <Checkbox
 checked={isFullySelected}
 onChange={() => {
 if (isFullySelected) {
 handleDeselectCategory(category);
 } else {
 handleSelectCategory(category);
 }
 }}
 />
 <h4 className="font-semibold text-lg">{category}</h4>
 <Badge variant="secondary" className="text-xs">
 {totalItems} elementos
 </Badge>
 </div>
 <div className="flex gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={() => handleSelectCategory(category)}
 disabled={isFullySelected}
 >
 Seleccionar Todas
 </Button>
 <Button
 variant="outline"
 size="sm"
 onClick={() => handleDeselectCategory(category)}
 disabled={totalSelected === 0}
 >
 Deseleccionar Todas
 </Button>
 </div>
 </div>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
 {machines.map((item: any) => (
 <div
 key={item.id}
 className="flex items-center space-x-2 p-2 rounded border hover:bg-muted cursor-pointer"
 onClick={() => item.type === 'MACHINE' ? handleMachineToggle(item.id) : handleUnidadMovilToggle(item.id)}
 >
 <Checkbox
 checked={item.type === 'MACHINE' ? filters.selectedMachines.includes(item.id.toString()) : filters.selectedUnidadesMoviles.includes(item.id.toString())}
 onChange={() => item.type === 'MACHINE' ? handleMachineToggle(item.id) : handleUnidadMovilToggle(item.id)}
 />
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-1">
 <p className="text-sm font-medium truncate">{item.displayName}</p>
 {item.type === 'UNIDAD_MOVIL' && (
 <Badge variant="outline" className="text-xs">
 Unidad Móvil
 </Badge>
 )}
 </div>
 <p className="text-xs text-muted-foreground">
 {item.displayStatus}
 </p>
 {item.patente && (
 <p className="text-xs text-info-muted-foreground">
 {item.patente}
 </p>
 )}
 </div>
 </div>
 ))}
 </div>
 </div>
 );
 })}
 </div>
 )}

 {(filters.selectedMachines.length > 0 || filters.selectedUnidadesMoviles.length > 0) && (
 <div className="p-3 bg-info-muted rounded-lg">
 <p className="text-sm text-info-muted-foreground">
 <strong>{filters.selectedMachines.length + filters.selectedUnidadesMoviles.length}</strong> elemento(s) seleccionado(s)
 </p>
 </div>
 )}
 </DialogBody>

 <DialogFooter>
 <Button
 variant="outline"
 onClick={() => setIsMachineFilterOpen(false)}
 >
 Cerrar
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Modal de filtros para PDF/Listado */}
 <MaintenanceFilterModal
 isOpen={isPDFFilterOpen}
 onClose={() => setIsPDFFilterOpen(false)}
 onViewScreen={handleViewScreen}
 onApplyFilters={(newFilters) => {
 setFilters({
 ...filters,
 selectedMachines: newFilters.selectedMachines,
 selectedUnidadesMoviles: newFilters.selectedUnidadesMoviles,
 assetTypeFilter: newFilters.assetTypeFilter
 });
 }}
 mode={filterModalMode}
 companyId={companyId}
 machines={availableMachines}
 unidadesMoviles={availableUnidadesMoviles}
 initialFilters={{
 machineIds: filters.selectedMachines.map(id => parseInt(id)).filter(id => !isNaN(id)),
 unidadMovilIds: filters.selectedUnidadesMoviles.map(id => parseInt(id)).filter(id => !isNaN(id)),
 maintenanceTypes: ['PREVENTIVE', 'CORRECTIVE'] // Default types
 }}
 />

 {/* Vista en pantalla de mantenimientos */}
 {maintenanceScreenData && (
 <MaintenanceScreenView
 isOpen={showMaintenanceScreen}
 onClose={() => setShowMaintenanceScreen(false)}
 data={maintenanceScreenData.data}
 filters={maintenanceScreenData.filters}
 companyName={maintenanceScreenData.companyName}
 />
 )}

 {/* Selector de tipo de checklist */}


 {/* Nuevo diálogo de ejecución de checklist con tabla */}
 <ChecklistExecutionTableDialog
 isOpen={isTableExecutionDialogOpen}
 onClose={resetChecklistFlow}
 checklist={checklistToExecute}
 selectedAsset={selectedAsset}
 onChecklistCompleted={(checklistId, executionData) => {
 // Checklist completado con tabla
 
 // Cerrar el modal primero
 resetChecklistFlow();
 
 // Si tenemos información sobre los mantenimientos procesados, actualizar inmediatamente los estados locales
 if (executionData?.processedMaintenances) {
 // Actualizar inmediatamente los estados locales para feedback visual
 setPendingMaintenances(prev => 
 prev.filter(m => !executionData.processedMaintenances.some(p => p.maintenanceId === m.id))
 );
 }
 
 // Un solo refresh consolidado para evitar múltiples llamadas que causan re-renders infinitos
 setTimeout(() => {
 refetchDashboard(); // ✅ OPTIMIZADO
 setChecklistHistoryRefreshTrigger(prev => prev + 1);
 setForceRender(Date.now());
 }, 1000); // Un solo delay para asegurar que la API haya terminado
 }}
 />

 <ManualMaintenanceCompletionDialog
 isOpen={isManualServiceDialogOpen}
 onClose={() => {
 setIsManualServiceDialogOpen(false);
 }}
 companyId={companyId}
 sectorId={selectedSectorFilter}
 onMaintenanceCompleted={() => {
 refetchDashboard(); // ✅ OPTIMIZADO
 if (activeTab === 'history') {
 fetchMaintenanceHistory(); // Solo si está en la pestaña
 }
 }}
 />
 </Suspense>

 </div>
 );
}
