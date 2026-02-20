'use client';

import React, { useState } from 'react';
import {
  Plus,
  RefreshCw,
  Calendar,
  Clock,
  CheckSquare,
  AlertTriangle,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Settings,
  Play,
  CheckCircle2,
  XCircle,
  ClipboardList,
  User,
  MapPin,
  Image,
  FileText,
  Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { DEFAULT_COLORS } from '@/lib/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';

import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import NewRoutineExecutionForm from '@/components/production/NewRoutineExecutionForm';
import NewRoutineTemplateForm from '@/components/production/NewRoutineTemplateForm';
import RoutinePendingCard from '@/components/production/RoutinePendingCard';

import { useRoutineExecutions } from '@/hooks/production/use-routine-executions';
import { useRoutineTemplates, type RoutineTemplate } from '@/hooks/production/use-routine-templates';
import { useRoutineDrafts } from '@/hooks/production/use-routine-drafts';
import { useMyRoutines } from '@/hooks/production/use-my-routines';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

interface RoutineExecutionDetail {
  id: number;
  date: string;
  hasIssues: boolean;
  issueDescription: string | null;
  responses: any[];
  executedAt: string;
  template: {
    id: number;
    code: string;
    name: string;
    type: string;
    items: any;
    groups?: any[];
    itemsStructure?: 'flat' | 'hierarchical';
  };
  workCenter: { id: number; name: string; code: string } | null;
  shift: { id: number; name: string } | null;
  executedBy: { id: number; name: string };
}

const ROUTINE_TYPES = [
  { value: 'SHIFT_START', label: 'Inicio de Turno', color: 'bg-info' },
  { value: 'SHIFT_END', label: 'Fin de Turno', color: 'bg-indigo-500' },
  { value: 'SETUP', label: 'Setup/Cambio', color: 'bg-purple-500' },
  { value: 'SAFETY', label: 'Seguridad', color: 'bg-destructive' },
  { value: '5S', label: '5S', color: 'bg-success' },
];

export default function RoutinesPage() {
  const { hasPermission } = useAuth();
  const { currentSector } = useCompany();
  const confirm = useConfirm();

  const canExecute = hasPermission('produccion.rutinas.execute');
  const canManage = hasPermission('produccion.rutinas.manage');

  const defaultTab = (canExecute && !canManage) ? 'my-routines' : 'executions';
  const [activeTab, setActiveTab] = useState<'my-routines' | 'executions' | 'templates'>(defaultTab);

  // Filters
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hasIssuesFilter, setHasIssuesFilter] = useState<string>('all');

  // Pagination (local page state — hooks receive it as param)
  const [execPage, setExecPage] = useState(1);
  const [tmplPage, setTmplPage] = useState(1);

  // Dialogs
  const [showExecuteDialog, setShowExecuteDialog] = useState(false);
  const [showNewTemplateDialog, setShowNewTemplateDialog] = useState(false);
  const [showExecutionDetailDialog, setShowExecutionDetailDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RoutineTemplate | null>(null);
  const [selectedExecutionDetail, setSelectedExecutionDetail] = useState<RoutineExecutionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [draftToResume, setDraftToResume] = useState<any>(null);
  const [showDraftDetailDialog, setShowDraftDetailDialog] = useState(false);
  const [selectedDraftDetail, setSelectedDraftDetail] = useState<any>(null);

  // ─── TanStack Query hooks ────────────────────────────────
  const {
    executions, stats: executionStats, pagination: executionPagination, isLoading: loadingExecutions, invalidate: invalidateExecutions,
  } = useRoutineExecutions(
    { dateFrom, dateTo, hasIssuesFilter, page: execPage, limit: 20 },
    activeTab === 'executions',
  );

  const {
    templates, pagination: templatePagination, isLoading: loadingTemplates, invalidate: invalidateTemplates,
  } = useRoutineTemplates(tmplPage, 20, activeTab === 'templates');

  const {
    drafts, isLoading: loadingDrafts, invalidate: invalidateDrafts,
  } = useRoutineDrafts(canManage && activeTab === 'executions');

  const {
    routines: myRoutines, summary: myRoutinesSummary, isLoading: loadingMyRoutines, invalidate: invalidateMyRoutines,
  } = useMyRoutines(activeTab === 'my-routines' ? currentSector?.id : undefined);

  const isLoading = activeTab === 'executions' ? loadingExecutions : activeTab === 'templates' ? loadingTemplates : loadingMyRoutines;

  // ─── Mutation handlers ───────────────────────────────────
  const fetchExecutionDetail = async (id: number) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/production/routines/${id}`);
      const data = await res.json();

      if (data.success) {
        const routine = data.routine;
        const templateItems = routine.template.items;
        const isNewFormat = templateItems && typeof templateItems === 'object' && !Array.isArray(templateItems) && 'itemsStructure' in templateItems;

        const transformedRoutine = {
          ...routine,
          template: {
            ...routine.template,
            itemsStructure: isNewFormat ? templateItems.itemsStructure : 'flat',
            items: isNewFormat ? templateItems.items : templateItems,
            groups: isNewFormat ? templateItems.groups : null,
          }
        };

        setSelectedExecutionDetail(transformedRoutine);
        setShowExecutionDetailDialog(true);
      } else {
        toast.error(data.error || 'Error al cargar detalle');
      }
    } catch {
      toast.error('Error al cargar detalle');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDeleteExecution = async (id: number) => {
    const ok = await confirm({
      title: 'Eliminar ejecución',
      description: '¿Eliminar esta ejecución de rutina?',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/production/routines/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Ejecución eliminada');
        invalidateExecutions();
      } else {
        toast.error(data.error || 'Error al eliminar');
      }
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleResumeDraft = async (draft: any) => {
    try {
      const res = await fetch(`/api/production/routines/${draft.id}`);
      const data = await res.json();
      if (data.success) {
        setDraftToResume({
          id: draft.id,
          responses: data.routine.responses || [],
          startedAt: data.routine.startedAt,
          template: draft.template,
        });
        setSelectedTemplate(null);
        setShowExecuteDialog(true);
      } else {
        toast.error('Error al cargar borrador');
      }
    } catch {
      toast.error('Error al cargar borrador');
    }
  };

  const handleSendReminder = async (draft: any) => {
    try {
      toast.loading('Enviando recordatorio...', { id: 'reminder' });
      const res = await fetch('/api/production/routines/draft/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: draft.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Recordatorio enviado por Discord', { id: 'reminder' });
        invalidateDrafts();
      } else {
        toast.error(data.error || 'Error al enviar', { id: 'reminder' });
      }
    } catch {
      toast.error('Error al enviar recordatorio', { id: 'reminder' });
    }
  };

  const handleViewDraftDetail = (draft: any) => {
    const templateItems = draft.template.items;
    let items: any[] = [];
    let groups: any[] | null = null;
    let itemsStructure = 'flat';

    if (templateItems && typeof templateItems === 'object') {
      if ('items' in templateItems && Array.isArray(templateItems.items)) {
        items = templateItems.items;
        groups = templateItems.groups || null;
        itemsStructure = templateItems.itemsStructure || 'flat';
      } else if (Array.isArray(templateItems)) {
        items = templateItems;
      }
    }

    setSelectedDraftDetail({
      ...draft,
      parsedItems: items,
      parsedGroups: groups,
      parsedItemsStructure: itemsStructure,
    });
    setShowDraftDetailDialog(true);
  };

  const handleDeleteDraft = async (draftId: number) => {
    const ok = await confirm({
      title: 'Eliminar borrador',
      description: '¿Eliminar este borrador en progreso?',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/production/routines/draft?id=${draftId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Borrador eliminado');
        invalidateDrafts();
      } else {
        toast.error(data.error || 'Error al eliminar');
      }
    } catch {
      toast.error('Error al eliminar borrador');
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    const ok = await confirm({
      title: 'Eliminar plantilla',
      description: '¿Eliminar esta plantilla? Si tiene ejecuciones, solo se desactivará.',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/production/routines/templates/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        invalidateTemplates();
      } else {
        toast.error(data.error || 'Error al eliminar');
      }
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleStartFromCard = async (templateId: number) => {
    const found = templates.find(t => t.id === templateId);
    if (found) {
      setSelectedTemplate(found);
      setDraftToResume(null);
      setShowExecuteDialog(true);
      return;
    }
    try {
      const res = await fetch(`/api/production/routines/templates/${templateId}`);
      const data = await res.json();
      if (data.success && data.template) {
        setSelectedTemplate(data.template);
        setDraftToResume(null);
        setShowExecuteDialog(true);
      } else {
        toast.error('No se pudo cargar la plantilla');
      }
    } catch {
      toast.error('Error al cargar la plantilla');
    }
  };

  const handleContinueFromCard = async (draftId: number) => {
    try {
      const res = await fetch(`/api/production/routines/${draftId}`);
      const data = await res.json();
      if (data.success) {
        setDraftToResume({
          id: draftId,
          responses: data.routine.responses || [],
          startedAt: data.routine.startedAt,
          template: data.routine.template,
        });
        setSelectedTemplate(null);
        setShowExecuteDialog(true);
      } else {
        toast.error('Error al cargar borrador');
      }
    } catch {
      toast.error('Error al cargar borrador');
    }
  };

  const handleRefresh = () => {
    if (activeTab === 'my-routines') invalidateMyRoutines();
    else if (activeTab === 'executions') { invalidateExecutions(); invalidateDrafts(); }
    else invalidateTemplates();
  };

  const handleExecutionSuccess = () => {
    setShowExecuteDialog(false);
    setSelectedTemplate(null);
    setDraftToResume(null);
    invalidateExecutions();
    invalidateDrafts();
    invalidateMyRoutines();
  };

  const getTypeInfo = (type: string) => {
    return ROUTINE_TYPES.find(t => t.value === type) || { value: type, label: type, color: 'bg-muted-foreground' };
  };

  return (
    <div className="px-4 md:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rutinas de Producción</h1>
          <p className="text-sm text-muted-foreground">
            Checklists operativos, ejecuciones y seguimiento
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Actualizar
          </Button>
          {canExecute && (
            <Button size="sm" onClick={() => { setDraftToResume(null); setSelectedTemplate(null); setShowExecuteDialog(true); }}>
              <Play className="h-4 w-4 mr-2" />
              Ejecutar Rutina
            </Button>
          )}
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setShowNewTemplateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Plantilla
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: CheckSquare, label: 'Ejecuciones', value: executionStats.totalExecutions, color: DEFAULT_COLORS.chart1 },
          { icon: CheckCircle2, label: 'Sin Problemas', value: executionStats.withoutIssues, color: DEFAULT_COLORS.kpiPositive },
          { icon: AlertTriangle, label: 'Con Problemas', value: executionStats.withIssues, color: DEFAULT_COLORS.kpiNegative },
          { icon: ClipboardList, label: 'Plantillas', value: templates.length, color: DEFAULT_COLORS.chart2 },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${stat.color}15` }}
                >
                  <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'my-routines' | 'executions' | 'templates')}>
        <TabsList>
          {canExecute && (
            <TabsTrigger value="my-routines">
              <ClipboardList className="h-4 w-4 mr-2" />
              Mis Rutinas
            </TabsTrigger>
          )}
          <TabsTrigger value="executions">
            <CheckSquare className="h-4 w-4 mr-2" />
            Ejecuciones
          </TabsTrigger>
          {canManage && (
            <TabsTrigger value="templates">
              <Settings className="h-4 w-4 mr-2" />
              Plantillas
            </TabsTrigger>
          )}
        </TabsList>

        {/* My Routines Tab (Employee View) */}
        {canExecute && (
          <TabsContent value="my-routines" className="space-y-4">
            {!currentSector ? (
              <Card>
                <CardContent className="p-10 text-center">
                  <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-warning-muted flex items-center justify-center">
                    <AlertTriangle className="h-7 w-7 text-warning-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-1">Sin sector seleccionado</h3>
                  <p className="text-sm text-muted-foreground">Selecciona un sector en el panel lateral para ver tus rutinas del día</p>
                </CardContent>
              </Card>
            ) : loadingMyRoutines ? (
              <div className="flex items-center justify-center h-48">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <ClipboardList className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">Cargando rutinas...</p>
                </div>
              </div>
            ) : myRoutines.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center">
                  <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-success-muted flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-success" />
                  </div>
                  <h3 className="text-lg font-medium mb-1">No hay rutinas asignadas</h3>
                  <p className="text-sm text-muted-foreground">No hay plantillas activas para este sector</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Progress overview card */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">Mi progreso hoy</span>
                        {myRoutinesSummary.completed === myRoutinesSummary.total && myRoutinesSummary.total > 0 && (
                          <Badge className="bg-success-muted text-success border-0 text-xs">
                            Todo completado
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={invalidateMyRoutines}
                        disabled={loadingMyRoutines}
                      >
                        <RefreshCw className={cn('h-4 w-4', loadingMyRoutines && 'animate-spin')} />
                      </Button>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-2">
                      <div className="h-3 w-full rounded-full overflow-hidden flex bg-muted">
                        {myRoutinesSummary.completed > 0 && (
                          <div
                            className="h-full bg-success transition-all"
                            style={{ width: `${(myRoutinesSummary.completed / myRoutinesSummary.total) * 100}%` }}
                          />
                        )}
                        {myRoutinesSummary.inProgress > 0 && (
                          <div
                            className="h-full bg-warning transition-all"
                            style={{ width: `${(myRoutinesSummary.inProgress / myRoutinesSummary.total) * 100}%` }}
                          />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-success" />
                            {myRoutinesSummary.completed} completadas
                          </span>
                          {myRoutinesSummary.inProgress > 0 && (
                            <span className="flex items-center gap-1.5">
                              <div className="h-2.5 w-2.5 rounded-full bg-warning" />
                              {myRoutinesSummary.inProgress} en progreso
                            </span>
                          )}
                          {myRoutinesSummary.pending > 0 && (
                            <span className="flex items-center gap-1.5">
                              <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                              {myRoutinesSummary.pending} pendientes
                            </span>
                          )}
                        </div>
                        <span className="font-medium text-foreground">
                          {myRoutinesSummary.completed}/{myRoutinesSummary.total}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Routine cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {myRoutines.map((routine) => (
                    <RoutinePendingCard
                      key={routine.templateId}
                      routine={routine}
                      onStart={handleStartFromCard}
                      onContinue={handleContinueFromCard}
                    />
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        )}

        {/* Executions Tab */}
        <TabsContent value="executions" className="space-y-4">
          {/* In-Progress Routines (Drafts) - Only for managers */}
          {canManage && drafts.length > 0 && (
            <Card className="border-warning-muted/50" style={{ backgroundColor: `${DEFAULT_COLORS.chart4}08` }}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-warning-muted flex items-center justify-center">
                      <Clock className="h-4 w-4 text-warning-muted-foreground" />
                    </div>
                    Rutinas en Progreso
                  </CardTitle>
                  <Badge className="bg-warning-muted text-warning-muted-foreground border-0">
                    {drafts.length} activa{drafts.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {drafts.map((draft) => {
                    const isOverdue = draft.isOverdue || false;
                    const minutesSinceStarted = draft.minutesSinceStarted || 0;
                    const minutesSinceLastActivity = draft.minutesSinceLastActivity || 0;
                    const maxMinutes = draft.template?.maxCompletionTimeMinutes || 60;
                    const progressColor = isOverdue ? DEFAULT_COLORS.kpiNegative : DEFAULT_COLORS.chart4;

                    return (
                      <div
                        key={draft.id}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-xl border bg-background transition-colors',
                          isOverdue && 'border-destructive/30'
                        )}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Circular progress */}
                          <div className="relative shrink-0">
                            <svg width="44" height="44" viewBox="0 0 44 44">
                              <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4" className="stroke-muted" />
                              <circle
                                cx="22" cy="22" r="18" fill="none" strokeWidth="4"
                                strokeLinecap="round"
                                style={{
                                  stroke: progressColor,
                                  strokeDasharray: `${2 * Math.PI * 18}`,
                                  strokeDashoffset: `${2 * Math.PI * 18 * (1 - draft.progress.percentage / 100)}`,
                                  transform: 'rotate(-90deg)',
                                  transformOrigin: '50% 50%',
                                }}
                              />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color: progressColor }}>
                              {draft.progress.percentage}%
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{draft.template.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {draft.executedBy.name} · {draft.progress.completed}/{draft.progress.total} items
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={cn('text-xs', isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                                {minutesSinceStarted} min
                                {isOverdue && ` (excede ${maxMinutes})`}
                              </span>
                              {minutesSinceLastActivity > 5 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-warning-muted-foreground border-warning-muted">
                                  Inactivo {minutesSinceLastActivity}m
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => handleViewDraftDetail(draft)}
                            title="Ver respuestas parciales"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-warning-muted-foreground hover:text-warning-muted-foreground hover:bg-warning-muted"
                            onClick={() => handleSendReminder(draft)}
                            title="Enviar recordatorio Discord"
                          >
                            <Bell className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-info-muted-foreground hover:text-info-muted-foreground hover:bg-info-muted"
                            onClick={() => handleResumeDraft(draft)}
                            title="Continuar esta rutina"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteDraft(draft.id)}
                            title="Eliminar borrador"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-[140px]"
                  />
                  <span className="self-center text-muted-foreground">a</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-[140px]"
                  />
                </div>

                <Select value={hasIssuesFilter} onValueChange={setHasIssuesFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="true">Con problemas</SelectItem>
                    <SelectItem value="false">Sin problemas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Executions Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha/Hora</TableHead>
                    <TableHead>Rutina</TableHead>
                    <TableHead className="hidden md:table-cell">Centro</TableHead>
                    <TableHead className="hidden sm:table-cell">Turno</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="hidden lg:table-cell">Ejecutado por</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingExecutions ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        <p className="mt-2 text-muted-foreground">Cargando ejecuciones...</p>
                      </TableCell>
                    </TableRow>
                  ) : executions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <CheckSquare className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="mt-2 text-muted-foreground">No hay ejecuciones registradas</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    executions.map(execution => {
                      const typeInfo = getTypeInfo(execution.template.type);
                      return (
                        <TableRow key={execution.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium capitalize">
                                {format(new Date(execution.executedAt), "EEEE d 'de' MMMM", { locale: es })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(execution.executedAt), 'HH:mm', { locale: es })} hs · {format(new Date(execution.executedAt), 'yyyy')}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                <Badge className={`${typeInfo.color} text-white text-xs`}>
                                  {typeInfo.label}
                                </Badge>
                              </div>
                              <div className="text-sm">
                                [{execution.template.code}] {execution.template.name}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {execution.workCenter?.name || '-'}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {execution.shift?.name || '-'}
                          </TableCell>
                          <TableCell>
                            {execution.hasIssues ? (
                              <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                <AlertTriangle className="h-3 w-3" />
                                Con problemas
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="flex items-center gap-1 w-fit text-success">
                                <CheckCircle2 className="h-3 w-3" />
                                OK
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {execution.executedBy.name}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => fetchExecutionDetail(execution.id)}
                                  disabled={loadingDetail}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  {loadingDetail ? 'Cargando...' : 'Ver detalle'}
                                </DropdownMenuItem>

                                {canManage && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => handleDeleteExecution(execution.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {executionPagination.totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Página {executionPagination.page} de {executionPagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={execPage === 1}
                      onClick={() => setExecPage(p => p - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={execPage === executionPagination.totalPages}
                      onClick={() => setExecPage(p => p + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden md:table-cell">Tipo</TableHead>
                    <TableHead className="hidden sm:table-cell">Frecuencia</TableHead>
                    <TableHead className="hidden lg:table-cell">Centro</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingTemplates ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        <p className="mt-2 text-muted-foreground">Cargando plantillas...</p>
                      </TableCell>
                    </TableRow>
                  ) : templates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="mt-2 text-muted-foreground">No hay plantillas configuradas</p>
                        {canManage && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-4"
                            onClick={() => setShowNewTemplateDialog(true)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Crear primera plantilla
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    templates.map(template => {
                      const typeInfo = getTypeInfo(template.type);
                      return (
                        <TableRow key={template.id}>
                          <TableCell className="font-mono font-medium">
                            {template.code}
                          </TableCell>
                          <TableCell className="font-medium">
                            {template.name}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge className={`${typeInfo.color} text-white`}>
                              {typeInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {template.frequency === 'EVERY_SHIFT' ? 'Cada turno' :
                             template.frequency === 'DAILY' ? 'Diario' :
                             template.frequency === 'WEEKLY' ? 'Semanal' : template.frequency}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {template.workCenter?.name || 'Todos'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {Array.isArray(template.items) ? template.items.length : 0} items
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {template.isActive ? (
                              <Badge variant="secondary" className="text-success">Activa</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-muted-foreground">Inactiva</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canExecute && template.isActive && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-success hover:text-success hover:bg-success-muted"
                                  onClick={() => {
                                    setSelectedTemplate(template);
                                    setDraftToResume(null);
                                    setShowExecuteDialog(true);
                                  }}
                                  title="Ejecutar rutina"
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canExecute && template.isActive && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedTemplate(template);
                                      setDraftToResume(null);
                                      setShowExecuteDialog(true);
                                    }}
                                  >
                                    <Play className="h-4 w-4 mr-2 text-success" />
                                    Ejecutar
                                  </DropdownMenuItem>
                                )}

                                {canManage && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedTemplate(template);
                                        setShowNewTemplateDialog(true);
                                      }}
                                    >
                                      <Edit className="h-4 w-4 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => handleDeleteTemplate(template.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {templatePagination.totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Página {templatePagination.page} de {templatePagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={tmplPage === 1}
                      onClick={() => setTmplPage(p => p - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={tmplPage === templatePagination.totalPages}
                      onClick={() => setTmplPage(p => p + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Execute Routine Dialog */}
      <Dialog open={showExecuteDialog} onOpenChange={(open) => {
        setShowExecuteDialog(open);
        if (!open) {
          setSelectedTemplate(null);
          setDraftToResume(null);
        }
      }}>
        <DialogContent className="!max-w-5xl w-[98vw] h-[95dvh] !max-h-[95dvh] flex flex-col p-0">
          <DialogHeader className="px-6 py-3 border-b flex-shrink-0">
            <DialogTitle>
              {draftToResume ? 'Continuar Rutina' : 'Ejecutar Rutina'}
            </DialogTitle>
            <DialogDescription>
              {draftToResume
                ? `Continuando rutina: ${draftToResume.template?.name}`
                : selectedTemplate
                  ? `Ejecutar rutina: ${selectedTemplate.name}`
                  : 'Seleccione una rutina para ejecutar'}
            </DialogDescription>
          </DialogHeader>
          <div className="px-2 py-2 flex-1 overflow-hidden flex flex-col min-h-0">
            <NewRoutineExecutionForm
              preselectedTemplate={selectedTemplate}
              draftToResume={draftToResume}
              onSuccess={handleExecutionSuccess}
              onCancel={() => {
                setShowExecuteDialog(false);
                setSelectedTemplate(null);
                setDraftToResume(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* New/Edit Template Dialog */}
      <Dialog open={showNewTemplateDialog} onOpenChange={(open) => {
        setShowNewTemplateDialog(open);
        if (!open) setSelectedTemplate(null);
      }}>
        <DialogContent size="full" className="max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 py-4 border-b sticky top-0 bg-background z-10">
            <DialogTitle>
              {selectedTemplate ? 'Editar Plantilla' : 'Nueva Plantilla de Rutina'}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate
                ? 'Modifique los datos de la plantilla'
                : 'Configure una nueva plantilla de rutina'}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            <NewRoutineTemplateForm
              template={selectedTemplate}
              defaultSectorId={currentSector?.id}
              onSuccess={() => {
                setShowNewTemplateDialog(false);
                setSelectedTemplate(null);
                invalidateTemplates();
              }}
              onCancel={() => {
                setShowNewTemplateDialog(false);
                setSelectedTemplate(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Draft Detail Dialog (Partial Responses) */}
      <Dialog open={showDraftDetailDialog} onOpenChange={(open) => {
        setShowDraftDetailDialog(open);
        if (!open) setSelectedDraftDetail(null);
      }}>
        <DialogContent className="!max-w-3xl w-[95vw] h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-warning-muted flex items-center justify-center">
                <Clock className="h-4 w-4 text-warning-muted-foreground" />
              </div>
              <span>Respuestas Parciales</span>
            </DialogTitle>
            <DialogDescription>
              {selectedDraftDetail && (
                <span className="flex items-center gap-2 mt-1">
                  <span className="font-medium text-foreground">{selectedDraftDetail.template.name}</span>
                  <span className="text-muted-foreground">·</span>
                  <span>{selectedDraftDetail.executedBy.name}</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-5 space-y-5">
              {selectedDraftDetail && (
                <>
                  {/* Progress overview */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Progreso general</span>
                      <span className={cn(
                        'text-sm font-bold',
                        selectedDraftDetail.isOverdue ? 'text-destructive' : 'text-warning-muted-foreground'
                      )}>
                        {selectedDraftDetail.progress.percentage}%
                      </span>
                    </div>
                    <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          backgroundColor: selectedDraftDetail.isOverdue ? DEFAULT_COLORS.kpiNegative : DEFAULT_COLORS.chart4,
                          width: `${selectedDraftDetail.progress.percentage}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Status summary cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl bg-success-muted border border-success-muted text-center">
                      <p className="text-2xl font-bold text-success">{selectedDraftDetail.progress.completed}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Completados</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50 border text-center">
                      <p className="text-2xl font-bold text-muted-foreground">
                        {selectedDraftDetail.progress.total - selectedDraftDetail.progress.completed}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Pendientes</p>
                    </div>
                    <div className={cn(
                      'p-4 rounded-xl border text-center',
                      selectedDraftDetail.isOverdue
                        ? 'bg-destructive/10 border-destructive/30'
                        : 'bg-warning-muted border-warning-muted'
                    )}>
                      <p className={cn(
                        'text-2xl font-bold',
                        selectedDraftDetail.isOverdue ? 'text-destructive' : 'text-warning-muted-foreground'
                      )}>
                        {selectedDraftDetail.minutesSinceStarted}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Minutos</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Items detail */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Detalle por item ({selectedDraftDetail.progress.completed}/{selectedDraftDetail.progress.total})
                    </h3>

                    {selectedDraftDetail.parsedItemsStructure === 'hierarchical' && selectedDraftDetail.parsedGroups ? (
                      <div className="space-y-4">
                        {selectedDraftDetail.parsedGroups.map((group: any) => (
                          <div key={group.id} className="rounded-xl border overflow-hidden">
                            <div className="px-4 py-2.5 bg-muted/50 border-b">
                              <p className="text-sm font-medium">{group.name}</p>
                            </div>
                            <div className="divide-y">
                              {group.items?.filter((item: any) => !item.disabled).map((item: any) => {
                                const response = (selectedDraftDetail.responses as any[])?.find((r: any) => r.itemId === item.id);
                                return (
                                  <DraftItemRow key={item.id} item={item} response={response} />
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border overflow-hidden divide-y">
                        {selectedDraftDetail.parsedItems
                          .filter((item: any) => !item.disabled)
                          .map((item: any) => {
                            const response = (selectedDraftDetail.responses as any[])?.find((r: any) => r.itemId === item.id);
                            return (
                              <DraftItemRow key={item.id} item={item} response={response} />
                            );
                          })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Execution Detail Dialog */}
      <Dialog open={showExecutionDetailDialog} onOpenChange={(open) => {
        setShowExecutionDetailDialog(open);
        if (!open) setSelectedExecutionDetail(null);
      }}>
        <DialogContent className="!max-w-3xl w-[95vw] h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {selectedExecutionDetail && (
                <Badge className={`${getTypeInfo(selectedExecutionDetail.template.type).color} text-white text-xs`}>
                  {getTypeInfo(selectedExecutionDetail.template.type).label}
                </Badge>
              )}
              <span>{selectedExecutionDetail?.template.name}</span>
            </DialogTitle>
            <DialogDescription>
              [{selectedExecutionDetail?.template.code}] · Ejecutado el{' '}
              {selectedExecutionDetail && format(new Date(selectedExecutionDetail.executedAt), "dd 'de' MMMM 'a las' HH:mm", { locale: es })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-5 space-y-5">
              {selectedExecutionDetail && (
                <>
                  {/* Status Banner */}
                  <div className={cn(
                    'p-4 rounded-xl border flex items-start gap-3',
                    selectedExecutionDetail.hasIssues
                      ? 'border-destructive/30 bg-destructive/10/80'
                      : 'border-success-muted bg-success-muted/80'
                  )}>
                    <div className={cn(
                      'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
                      selectedExecutionDetail.hasIssues ? 'bg-destructive/10' : 'bg-success-muted'
                    )}>
                      {selectedExecutionDetail.hasIssues ? (
                        <AlertTriangle className="h-4.5 w-4.5 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-4.5 w-4.5 text-success" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'font-semibold text-sm',
                        selectedExecutionDetail.hasIssues ? 'text-destructive' : 'text-success'
                      )}>
                        {selectedExecutionDetail.hasIssues ? 'Se reportaron problemas' : 'Completada sin problemas'}
                      </p>
                      {selectedExecutionDetail.issueDescription && (
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                          {selectedExecutionDetail.issueDescription}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { icon: Calendar, label: 'Fecha', value: format(new Date(selectedExecutionDetail.date), 'dd/MM/yyyy', { locale: es }) },
                      { icon: Clock, label: 'Hora', value: format(new Date(selectedExecutionDetail.executedAt), 'HH:mm', { locale: es }) },
                      { icon: MapPin, label: 'Centro', value: selectedExecutionDetail.workCenter?.name || 'No especificado' },
                      { icon: User, label: 'Ejecutó', value: selectedExecutionDetail.executedBy.name },
                    ].map((meta, i) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/40 border">
                        <div className="flex items-center gap-2 mb-1">
                          <meta.icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{meta.label}</p>
                        </div>
                        <p className="font-medium text-sm truncate">{meta.value}</p>
                      </div>
                    ))}
                  </div>

                  {selectedExecutionDetail.shift && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Turno: {selectedExecutionDetail.shift.name}
                      </Badge>
                    </div>
                  )}

                  <Separator />

                  {/* Responses */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Respuestas de la rutina
                    </h3>

                    {selectedExecutionDetail.template.itemsStructure === 'hierarchical' && selectedExecutionDetail.template.groups ? (
                      <div className="space-y-4">
                        {selectedExecutionDetail.template.groups.map((group: any) => (
                          <div key={group.id} className="rounded-xl border overflow-hidden">
                            <div className="px-4 py-2.5 bg-muted/50 border-b">
                              <p className="text-sm font-medium">{group.name}</p>
                            </div>
                            <div className="divide-y">
                              {group.items?.map((item: any) => {
                                const response = selectedExecutionDetail.responses?.find((r: any) => r.itemId === item.id);
                                return (
                                  <ExecutionItemRow key={item.id} item={item} response={response} />
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border overflow-hidden divide-y">
                        {(Array.isArray(selectedExecutionDetail.template.items) ? selectedExecutionDetail.template.items : []).map((item: any) => {
                          const response = selectedExecutionDetail.responses?.find((r: any) => r.itemId === item.id);
                          return (
                            <ExecutionItemRow key={item.id} item={item} response={response} />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExecutionItemRow({ item, response }: { item: any; response: any }) {
  const hasValue = response?.inputs?.some(
    (inp: any) => inp.value !== null && inp.value !== '' && inp.value !== undefined
  ) || (response?.value !== undefined && response?.value !== null && response?.value !== '');

  const getValue = () => {
    if (!response) return null;
    if (response.inputs && Array.isArray(response.inputs)) return response.inputs;
    return response.value;
  };

  const value = getValue();

  return (
    <div className={cn('px-4 py-3 transition-colors', hasValue ? 'bg-background' : 'bg-muted/20')}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={cn(
            'h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
            hasValue ? 'bg-success-muted' : 'bg-muted'
          )}>
            {hasValue ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{item.description || item.label}</p>

            {item.inputs && Array.isArray(item.inputs) && item.inputs.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {item.inputs.map((input: any) => {
                  const inputResponse = response?.inputs?.find((i: any) => i.inputId === input.id);
                  const hasInputValue = inputResponse?.value !== null && inputResponse?.value !== '' && inputResponse?.value !== undefined;
                  return (
                    <div key={input.id} className="flex items-center gap-2 text-xs bg-muted/40 rounded-lg px-3 py-1.5">
                      <span className="text-muted-foreground shrink-0">{input.label}:</span>
                      {hasInputValue ? (
                        <span className="font-medium text-foreground">
                          {input.type === 'CHECK'
                            ? (inputResponse.value === true || inputResponse.value === 'true' ? '✓ Sí' : '✗ No')
                            : input.type === 'PHOTO'
                              ? (
                                  <a href={inputResponse.value} target="_blank" rel="noopener noreferrer" className="text-info-muted-foreground underline inline-flex items-center gap-1">
                                    <Image className="h-3 w-3" />
                                    Ver foto
                                  </a>
                                )
                              : `${inputResponse.value}${input.unit ? ` ${input.unit}` : ''}`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">–</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {!item.inputs && (
          <div className="text-right shrink-0">
            {item.type === 'CHECK' ? (
              value === true || value === 'true' ? (
                <Badge className="bg-success-muted text-success border-0">✓ Sí</Badge>
              ) : value === false || value === 'false' ? (
                <Badge className="bg-destructive/10 text-destructive border-0">✗ No</Badge>
              ) : (
                <span className="text-xs text-muted-foreground">–</span>
              )
            ) : item.type === 'PHOTO' && value ? (
              <a href={value} target="_blank" rel="noopener noreferrer" className="text-info-muted-foreground underline inline-flex items-center gap-1 text-xs">
                <Image className="h-3.5 w-3.5" />
                Ver foto
              </a>
            ) : value !== undefined && value !== null && value !== '' ? (
              <span className="font-semibold text-sm">
                {value}
                {item.unit && <span className="text-muted-foreground font-normal ml-1 text-xs">{item.unit}</span>}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">–</span>
            )}
          </div>
        )}
      </div>

      {response?.notes && (
        <div className="mt-2 ml-9 text-xs text-muted-foreground bg-warning-muted border border-warning-muted px-3 py-1.5 rounded-lg">
          <span className="font-medium">Nota:</span> {response.notes}
        </div>
      )}
    </div>
  );
}

function DraftItemRow({ item, response }: { item: any; response: any }) {
  const hasResponse = response?.inputs?.some(
    (inp: any) => inp.value !== null && inp.value !== '' && inp.value !== undefined
  );

  return (
    <div className={cn('px-4 py-3 transition-colors', hasResponse ? 'bg-success-muted/30' : 'bg-background')}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
          hasResponse ? 'bg-success-muted' : 'bg-muted'
        )}>
          {hasResponse ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          ) : (
            <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={cn('text-sm font-medium', !hasResponse && 'text-muted-foreground')}>
              {item.description || item.label}
            </p>
            <span className={cn(
              'text-[10px] font-medium uppercase tracking-wider shrink-0 px-2 py-0.5 rounded-full',
              hasResponse
                ? 'bg-success-muted text-success'
                : 'bg-muted text-muted-foreground'
            )}>
              {hasResponse ? 'Listo' : 'Pendiente'}
            </span>
          </div>

          {hasResponse && item.inputs && Array.isArray(item.inputs) && (
            <div className="mt-1.5 space-y-1">
              {item.inputs.map((input: any) => {
                const inputResponse = response?.inputs?.find((i: any) => i.inputId === input.id);
                const hasValue = inputResponse?.value !== null && inputResponse?.value !== '' && inputResponse?.value !== undefined;
                return (
                  <div key={input.id} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{input.label}:</span>
                    {hasValue ? (
                      <span className="font-medium text-success">
                        {input.type === 'CHECK'
                          ? (inputResponse.value === true || inputResponse.value === 'true' ? 'Sí' : 'No')
                          : `${inputResponse.value}${input.unit ? ` ${input.unit}` : ''}`}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">–</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {response?.notes && (
            <p className="text-xs text-muted-foreground mt-1.5 bg-warning-muted border border-warning-muted px-2.5 py-1 rounded-lg">
              <span className="font-medium">Nota:</span> {response.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
