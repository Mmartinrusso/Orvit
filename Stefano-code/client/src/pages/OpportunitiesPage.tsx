import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lightbulb,
  Search,
  History,
  RefreshCw,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  useScanHistory,
  useActiveScans,
  usePendingOpportunities,
  useOpportunityStats,
  useStartScan,
  useApproveOpportunity,
  useRejectOpportunity,
  useStartResearch,
  useResearchHistory,
  useActiveResearches,
} from '@/hooks';
import { useToast } from '@/context';
import { Button, Card } from '@/components/common';
import {
  ScanForm,
  OpportunityList,
  ResearchForm,
  OpportunityHeroStats,
  UnifiedHistoryPanel,
} from '@/components/opportunities';
import { cn } from '@/utils';
import type { OpportunityScanRequest, ModelType, PipelineMode, ResearchOpportunityRequest } from '@/api/types';

export function OpportunitiesPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  // Panel toggle states
  const [showScanForm, setShowScanForm] = useState(false);
  const [showResearchForm, setShowResearchForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Approval / rejection state
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [rejectingIds, setRejectingIds] = useState<Set<string>>(new Set());

  // Inline filters
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'priority'>('newest');

  // Queries
  const { data: pendingData, isLoading: loadingPending, refetch: refetchPending } = usePendingOpportunities(100);
  const { data: scansData, isLoading: _loadingScans } = useScanHistory(50);
  const { data: statsData } = useOpportunityStats();
  const { data: activeScansData } = useActiveScans(true);
  const { data: researchHistoryData } = useResearchHistory(50);
  const { data: activeResearchesData } = useActiveResearches(true);

  // Mutations
  const startScanMutation = useStartScan();
  const approveMutation = useApproveOpportunity();
  const rejectMutation = useRejectOpportunity();
  const startResearchMutation = useStartResearch();

  const pendingOpportunities = pendingData?.opportunities || [];
  const scans = scansData?.scans || [];
  const stats = statsData?.stats || null;
  const activeScans = activeScansData?.scans || [];
  const researches = researchHistoryData?.researches || [];
  const activeResearches = activeResearchesData?.researches || [];

  // Compute hero stats
  const heroStats = useMemo(() => {
    const pending = pendingOpportunities.length;
    const activeScanCount = activeScans.length + activeResearches.length;
    const approved = stats?.approved || 0;
    const completed = stats?.completed || 0;
    const total = stats?.total || 0;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { pending, activeScans: activeScanCount, approved, successRate };
  }, [pendingOpportunities, activeScans, activeResearches, stats]);

  // Extract unique filter values
  const filterOptions = useMemo(() => {
    const categories = new Set<string>();
    const priorities = new Set<string>();

    pendingOpportunities.forEach((opp) => {
      if (opp.category) categories.add(opp.category);
      if (opp.priority) priorities.add(opp.priority);
    });

    return {
      categories: Array.from(categories),
      priorities: Array.from(priorities),
    };
  }, [pendingOpportunities]);

  // Priority sort order map
  const priorityWeight: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  // Filtered + sorted opportunities
  const filteredOpportunities = useMemo(() => {
    let filtered = pendingOpportunities.filter((opp) => {
      if (filterCategory && opp.category !== filterCategory) return false;
      if (filterPriority && opp.priority !== filterPriority) return false;
      return true;
    });

    filtered = [...filtered].sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortOrder === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortOrder === 'priority') return (priorityWeight[a.priority] ?? 99) - (priorityWeight[b.priority] ?? 99);
      return 0;
    });

    return filtered;
  }, [pendingOpportunities, filterCategory, filterPriority, sortOrder]);

  const hasActiveFilters = filterCategory || filterPriority;

  // Handlers
  const handleStartScan = async (request: OpportunityScanRequest) => {
    try {
      const response = await startScanMutation.mutateAsync(request);
      if (response.success) {
        addToast('Scan iniciado correctamente', 'success');
        setShowScanForm(false);
        navigate(`/opportunities/scan/${response.scan_id}`);
      } else {
        addToast(response.error || 'Error al iniciar scan', 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar scan';
      addToast(message, 'error');
    }
  };

  const handleApprove = async (opportunityId: string, model?: ModelType, pipelineMode?: PipelineMode) => {
    setApprovingIds((prev) => new Set([...prev, opportunityId]));
    try {
      const response = await approveMutation.mutateAsync({
        opportunityId,
        request: { model, pipeline_mode: pipelineMode },
      });
      if (response.success) {
        addToast('Oportunidad aprobada, task iniciada', 'success');
        if (response.task_id) {
          navigate(`/tasks/${response.task_id}`);
        }
      } else {
        addToast(response.error || 'Error al aprobar', 'error');
      }
    } catch (err) {
      addToast('Error al aprobar oportunidad', 'error');
    } finally {
      setApprovingIds((prev) => {
        const next = new Set(prev);
        next.delete(opportunityId);
        return next;
      });
    }
  };

  const handleReject = async (opportunityId: string, reason?: string) => {
    setRejectingIds((prev) => new Set([...prev, opportunityId]));
    try {
      const response = await rejectMutation.mutateAsync({ opportunityId, request: { reason } });
      if (response.success) {
        addToast('Oportunidad rechazada', 'success');
      } else {
        addToast(response.error || 'Error al rechazar', 'error');
      }
    } catch (err) {
      addToast('Error al rechazar oportunidad', 'error');
    } finally {
      setRejectingIds((prev) => {
        const next = new Set(prev);
        next.delete(opportunityId);
        return next;
      });
    }
  };

  const handleStartResearch = async (request: ResearchOpportunityRequest) => {
    try {
      const response = await startResearchMutation.mutateAsync(request);
      if (response.success) {
        addToast('Investigacion iniciada correctamente', 'success');
        setShowResearchForm(false);
        navigate(`/opportunities/research/${response.research_id}`);
      } else {
        addToast(response.error || 'Error al iniciar investigacion', 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar investigacion';
      addToast(message, 'error');
    }
  };

  const handleRefresh = () => {
    refetchPending();
  };

  const toggleScanForm = () => {
    setShowScanForm((v) => !v);
    if (!showScanForm) setShowResearchForm(false);
  };

  const toggleResearchForm = () => {
    setShowResearchForm((v) => !v);
    if (!showResearchForm) setShowScanForm(false);
  };

  return (
    <div className="space-y-6 page-transition">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-yellow-500 flex items-center justify-center shadow-md shadow-yellow-500/15">
            <Lightbulb className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-dark-text">Oportunidades</h1>
            <p className="text-xs text-slate-500 dark:text-dark-text-secondary">
              Analiza tu codigo y encuentra mejoras automaticamente
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={handleRefresh} loading={loadingPending}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Hero Stats */}
      <OpportunityHeroStats
        pending={heroStats.pending}
        activeScans={heroStats.activeScans}
        approved={heroStats.approved}
        successRate={heroStats.successRate}
      />

      {/* Active Process Banners */}
      {activeScans.length > 0 && (
        <Card className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                <Search className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-pulse" />
              </div>
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-400">
                  {activeScans.length} scan{activeScans.length > 1 ? 's' : ''} en progreso
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Analizando repositorios...
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/opportunities/scan/${activeScans[0].scan_id}`)}
            >
              Ver progreso
            </Button>
          </div>
        </Card>
      )}

      {activeResearches.length > 0 && (
        <Card className="bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-full">
                <Loader2 className="h-5 w-5 text-yellow-600 dark:text-yellow-400 animate-spin" />
              </div>
              <div>
                <p className="font-medium text-yellow-900 dark:text-yellow-400">
                  {activeResearches.length} investigacion{activeResearches.length > 1 ? 'es' : ''} en progreso
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {activeResearches[0].idea.substring(0, 60)}...
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/opportunities/research/${activeResearches[0].research_id}`)}
            >
              Ver progreso
            </Button>
          </div>
        </Card>
      )}

      {/* Action Buttons Row */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={toggleScanForm}
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm',
            showScanForm
              ? 'bg-blue-600 text-white shadow-blue-200 dark:shadow-blue-900/40'
              : 'bg-blue-500 text-white hover:bg-blue-600 shadow-blue-200 dark:shadow-blue-900/40'
          )}
        >
          <Search className="h-4 w-4" />
          Nuevo Scan
          {showScanForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <button
          onClick={toggleResearchForm}
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm',
            showResearchForm
              ? 'bg-yellow-600 text-white shadow-yellow-200 dark:shadow-yellow-900/40'
              : 'bg-yellow-500 text-white hover:bg-yellow-600 shadow-yellow-200 dark:shadow-yellow-900/40'
          )}
        >
          <Sparkles className="h-4 w-4" />
          Investigar Idea
          {showResearchForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <button
          onClick={() => setShowHistory((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border',
            showHistory
              ? 'bg-gray-100 dark:bg-dark-hover border-gray-300 dark:border-dark-border text-gray-900 dark:text-dark-text'
              : 'bg-white dark:bg-dark-surface border-gray-200 dark:border-dark-border text-gray-700 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-hover'
          )}
        >
          <History className="h-4 w-4" />
          Historial
          {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Collapsible Scan Form */}
      <div className={cn(
        'overflow-hidden transition-all duration-300 ease-in-out',
        showScanForm ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'
      )}>
        <ScanForm
          onSubmit={handleStartScan}
          isSubmitting={startScanMutation.isPending}
        />
      </div>

      {/* Collapsible Research Form */}
      <div className={cn(
        'overflow-hidden transition-all duration-300 ease-in-out',
        showResearchForm ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
      )}>
        <ResearchForm
          onSubmit={handleStartResearch}
          isSubmitting={startResearchMutation.isPending}
        />
      </div>

      {/* Opportunities Section */}
      <div className="space-y-4">
        {/* Section header with filters */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-dark-text">
              Oportunidades Pendientes
            </h2>
            {pendingOpportunities.length > 0 && (
              <span className="text-sm text-slate-500 dark:text-dark-text-secondary">
                ({filteredOpportunities.length}{hasActiveFilters ? ` de ${pendingOpportunities.length}` : ''})
              </span>
            )}
          </div>
          {pendingOpportunities.length > 0 && (
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-slate-400" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-slate-600 dark:text-dark-text focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Categoria</option>
                {filterOptions.categories.map((cat) => (
                  <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-slate-600 dark:text-dark-text focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Prioridad</option>
                {filterOptions.priorities.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest' | 'priority')}
                className="px-2.5 py-1.5 text-xs border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-slate-600 dark:text-dark-text focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="newest">Recientes</option>
                <option value="oldest">Antiguas</option>
                <option value="priority">Prioridad</option>
              </select>
              {hasActiveFilters && (
                <button
                  onClick={() => { setFilterCategory(''); setFilterPriority(''); }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors"
                  title="Limpiar filtros"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        <OpportunityList
          opportunities={filteredOpportunities}
          isLoading={loadingPending}
          onApprove={handleApprove}
          onReject={handleReject}
          approvingIds={approvingIds}
          rejectingIds={rejectingIds}
          emptyMessage="No hay oportunidades pendientes. Inicia un scan para descubrir mejoras."
        />
      </div>

      {/* Collapsible History */}
      <div className={cn(
        'overflow-hidden transition-all duration-300 ease-in-out',
        showHistory ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'
      )}>
        <UnifiedHistoryPanel
          scans={scans}
          researches={researches}
        />
      </div>
    </div>
  );
}
