'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Search, Package, ClipboardCheck, CheckCircle2,
  Save, RefreshCw, Download, ScanLine, Loader2,
  History, Play, Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useCompany } from '@/contexts/CompanyContext';
import { cn, formatNumber } from '@/lib/utils';
import { QRScanner } from '@/components/panol';
import { usePanolPermissions } from '@/hooks/use-panol-permissions';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Tool {
  id: number;
  name: string;
  code: string | null;
  itemType: string;
  category: string | null;
  location: string | null;
  stockQuantity: number;
  minStockLevel: number;
  isCritical: boolean;
}

interface CountItem {
  toolId: number;
  tool: Tool;
  systemQty: number;
  countedQty: number | null;
  difference: number;
  status: 'pending' | 'counted' | 'adjusted';
  notes: string;
}

type CountStatus = 'not_started' | 'in_progress' | 'completed';

interface SessionSummary {
  id: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  totalItems: number;
  countedItems: number;
  adjustedItems: number;
  categoryFilter: string | null;
  locationFilter: string | null;
  startedAt: string;
  completedAt: string | null;
  createdBy: { id: number; name: string | null };
}

// ─── Fetchers ───────────────────────────────────────────────────────────────

async function fetchTools(companyId: number): Promise<Tool[]> {
  const res = await fetch(`/api/tools?companyId=${companyId}`);
  if (!res.ok) throw new Error('Error al cargar items');
  const data = await res.json();
  return Array.isArray(data) ? data : (data?.tools || data?.items || []);
}

async function fetchSessions(): Promise<SessionSummary[]> {
  const res = await fetch('/api/panol/conteo');
  if (!res.ok) throw new Error('Error al cargar sesiones');
  const data = await res.json();
  return data.sessions || [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSessionItems(items: any[]): CountItem[] {
  return items.map((item) => ({
    toolId: item.toolId,
    tool: item.tool,
    systemQty: item.systemQty,
    countedQty: item.countedQty,
    difference: item.difference,
    status: item.status as 'pending' | 'counted' | 'adjusted',
    notes: item.notes || '',
  }));
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ConteoPage() {
  const { currentCompany } = useCompany();
  const permissions = usePanolPermissions();
  const queryClient = useQueryClient();

  // ── Server queries ────────────────────────────────────────────────────
  const { data: tools = [], isLoading: isLoadingTools } = useQuery({
    queryKey: ['panol-tools-conteo', currentCompany?.id],
    queryFn: () => fetchTools(currentCompany!.id),
    enabled: !!currentCompany?.id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery({
    queryKey: ['panol-conteo-sessions', currentCompany?.id],
    queryFn: fetchSessions,
    enabled: !!currentCompany?.id,
    staleTime: 1000 * 60,
  });

  // ── Local state ───────────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [countItems, setCountItems] = useState<CountItem[]>([]);
  const [countStatus, setCountStatus] = useState<CountStatus>('not_started');
  const [countStartTime, setCountStartTime] = useState<Date | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showScannerDialog, setShowScannerDialog] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  // ── Debounced auto-save ───────────────────────────────────────────────
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef<number | null>(null);
  sessionIdRef.current = sessionId;

  const saveToServer = useCallback(async (items: CountItem[]) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    const payload = items.map((i) => ({
      toolId: i.toolId,
      countedQty: i.countedQty,
      notes: i.notes || undefined,
    }));
    try {
      await fetch(`/api/panol/conteo/${sid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload }),
      });
    } catch (err) {
      console.error('Error al guardar progreso:', err);
    }
  }, []);

  const debouncedSave = useCallback((items: CountItem[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveToServer(items), 2000);
  }, [saveToServer]);

  // Cleanup on unmount — flush pending save
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────
  const { categories, locations } = useMemo(() => {
    const cats = [...new Set(tools.map(t => t.category).filter(Boolean))] as string[];
    const locs = [...new Set(tools.map(t => t.location).filter(Boolean))] as string[];
    return { categories: cats.sort(), locations: locs.sort() };
  }, [tools]);

  const filteredToolsForCount = useMemo(() => {
    return tools.filter(tool => {
      if (selectedCategory !== 'all' && tool.category !== selectedCategory) return false;
      if (selectedLocation !== 'all' && tool.location !== selectedLocation) return false;
      return true;
    });
  }, [tools, selectedCategory, selectedLocation]);

  const stats = useMemo(() => {
    const total = countItems.length;
    const counted = countItems.filter(i => i.status === 'counted' || i.status === 'adjusted').length;
    const pending = countItems.filter(i => i.status === 'pending').length;
    const withDifference = countItems.filter(i => i.countedQty !== null && i.difference !== 0).length;
    const positiveAdjust = countItems.filter(i => i.difference > 0).reduce((s, i) => s + i.difference, 0);
    const negativeAdjust = countItems.filter(i => i.difference < 0).reduce((s, i) => s + Math.abs(i.difference), 0);
    return { total, counted, pending, withDifference, positiveAdjust, negativeAdjust, progress: total > 0 ? (counted / total) * 100 : 0 };
  }, [countItems]);

  const displayedItems = useMemo(() => {
    return countItems.filter(item => {
      const matchesSearch = item.tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.tool.code || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (showOnlyPending && item.status !== 'pending') return false;
      if (showOnlyDifferences && item.difference === 0) return false;
      return true;
    });
  }, [countItems, searchTerm, showOnlyPending, showOnlyDifferences]);

  const activeSession = useMemo(
    () => sessions.find(s => s.status === 'IN_PROGRESS'),
    [sessions],
  );

  const pastSessions = useMemo(
    () => sessions.filter(s => s.status !== 'IN_PROGRESS'),
    [sessions],
  );

  // ── Actions ───────────────────────────────────────────────────────────

  const startCount = async () => {
    setIsStarting(true);
    try {
      const res = await fetch('/api/panol/conteo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryFilter: selectedCategory,
          locationFilter: selectedLocation,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Error al iniciar conteo');
        return;
      }
      const data = await res.json();
      const session = data.session;
      setSessionId(session.id);
      setCountItems(mapSessionItems(session.items));
      setCountStatus('in_progress');
      setCountStartTime(new Date(session.startedAt));
      queryClient.invalidateQueries({ queryKey: ['panol-conteo-sessions'] });
      toast.success(`Conteo iniciado con ${session.items.length} items`);
    } catch {
      toast.error('Error al iniciar conteo');
    } finally {
      setIsStarting(false);
    }
  };

  const resumeSession = async (id: number) => {
    setIsResuming(true);
    try {
      const res = await fetch(`/api/panol/conteo/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const session = data.session;
      setSessionId(session.id);
      setCountItems(mapSessionItems(session.items));
      setCountStatus(session.status === 'COMPLETED' ? 'completed' : 'in_progress');
      setCountStartTime(new Date(session.startedAt));
    } catch {
      toast.error('Error al cargar sesión');
    } finally {
      setIsResuming(false);
    }
  };

  const updateCount = useCallback((toolId: number, rawQty: number | null) => {
    const countedQty = rawQty !== null && (!isNaN(rawQty) && rawQty >= 0) ? rawQty : null;
    setCountItems(prev => {
      const updated = prev.map(item => {
        if (item.toolId !== toolId) return item;
        const difference = countedQty !== null ? countedQty - item.systemQty : 0;
        return { ...item, countedQty, difference, status: countedQty !== null ? 'counted' as const : 'pending' as const };
      });
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave]);

  const updateNotes = useCallback((toolId: number, notes: string) => {
    setCountItems(prev => {
      const updated = prev.map(item => item.toolId === toolId ? { ...item, notes } : item);
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave]);

  const handleScanResult = (tool: Tool) => {
    setShowScannerDialog(false);
    const item = countItems.find(i => i.toolId === tool.id);
    if (item) {
      const input = document.getElementById(`count-input-${tool.id}`);
      if (input) { (input as HTMLInputElement).focus(); (input as HTMLInputElement).select(); }
      toast.success(`Item encontrado: ${tool.name}`);
    } else {
      toast.error('Este item no está en el conteo actual');
    }
  };

  const applyAdjustments = async () => {
    if (!permissions.canPerformCount) {
      toast.error('Sin permisos para aplicar ajustes');
      return;
    }
    if (!sessionId) return;

    // Flush pending save first
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    await saveToServer(countItems);

    setIsAdjusting(true);
    toast.loading('Aplicando ajustes...', { id: 'adjust' });

    try {
      const res = await fetch(`/api/panol/conteo/${sessionId}/finalize`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        if (data.errorCount === 0) {
          toast.success(`${data.adjustedCount} ajustes aplicados correctamente`, { id: 'adjust' });
          setCountStatus('completed');
          setCountItems(prev => prev.map(item => ({
            ...item,
            status: item.countedQty !== null && item.difference !== 0 ? 'adjusted' : item.status,
          })));
        } else {
          toast.error(`${data.adjustedCount} exitosos, ${data.errorCount} errores`, { id: 'adjust' });
        }
      } else {
        toast.error(data.error || 'Error al finalizar', { id: 'adjust' });
      }
    } catch {
      toast.error('Error al finalizar conteo', { id: 'adjust' });
    }

    setIsAdjusting(false);
    setShowConfirmDialog(false);
    queryClient.invalidateQueries({ queryKey: ['panol-conteo-sessions'] });
  };

  const exportToCSV = () => {
    const headers = ['Código', 'Nombre', 'Categoría', 'Ubicación', 'Stock Sistema', 'Stock Contado', 'Diferencia', 'Notas'];
    const rows = countItems.map(item => [
      item.tool.code || '', item.tool.name, item.tool.category || '', item.tool.location || '',
      item.systemQty, item.countedQty ?? '', item.difference, item.notes,
    ]);
    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `conteo_fisico_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`;
    link.click();
    toast.success('Archivo CSV descargado');
  };

  const resetCount = () => {
    setCountItems([]); setCountStatus('not_started'); setCountStartTime(null);
    setSessionId(null); setShowOnlyPending(false); setShowOnlyDifferences(false);
    queryClient.invalidateQueries({ queryKey: ['panol-conteo-sessions'] });
  };

  // ── Loading ───────────────────────────────────────────────────────────

  if (isLoadingTools && isLoadingSessions) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="w-full p-0">
        {/* Header */}
        <div className="px-4 md:px-6 pt-4 pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Conteo Físico</h1>
              <p className="text-sm text-muted-foreground mt-1">Auditoría y ajuste de inventario</p>
            </div>

            {countStatus === 'not_started' && (
              <Button size="sm" className="h-9" onClick={startCount} disabled={filteredToolsForCount.length === 0 || !permissions.canPerformCount || isStarting}>
                {isStarting
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Iniciando...</>
                  : <><ClipboardCheck className="h-4 w-4 mr-2" />Iniciar Conteo</>
                }
              </Button>
            )}

            {countStatus === 'in_progress' && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-9" onClick={() => setShowScannerDialog(true)}>
                  <ScanLine className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-9 hidden sm:flex" onClick={exportToCSV}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button size="sm" className="h-9" onClick={() => setShowConfirmDialog(true)} disabled={stats.counted === 0 || !permissions.canPerformCount}>
                  <Save className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Finalizar</span>
                </Button>
              </div>
            )}

            {countStatus === 'completed' && (
              <Button size="sm" className="h-9" onClick={resetCount}>
                <RefreshCw className="h-4 w-4 mr-2" />Nuevo Conteo
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4 px-4 md:px-6 pb-6">
          {/* ── Setup ────────────────────────────────────────────────── */}
          {countStatus === 'not_started' && (
            <>
              {/* Resume banner for in-progress session */}
              {activeSession && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Hay un conteo en progreso</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Iniciado {format(new Date(activeSession.startedAt), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                          {' — '}{activeSession.countedItems}/{activeSession.totalItems} contados
                        </p>
                      </div>
                      <Button size="sm" className="h-8 shrink-0" onClick={() => resumeSession(activeSession.id)} disabled={isResuming}>
                        {isResuming
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <><Play className="h-3.5 w-3.5 mr-1.5" />Reanudar</>
                        }
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Config card */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium mb-3">Configurar Conteo</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Seleccioná qué items incluir en el conteo físico.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label className="text-xs">Categoría</Label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="h-9 bg-background"><SelectValue placeholder="Todas" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas las categorías</SelectItem>
                          {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Ubicación</Label>
                      <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                        <SelectTrigger className="h-9 bg-background"><SelectValue placeholder="Todas" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas las ubicaciones</SelectItem>
                          {locations.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm"><strong>{filteredToolsForCount.length}</strong> items serán incluidos en el conteo</p>
                  </div>
                </CardContent>
              </Card>

              {/* History */}
              {pastSessions.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium">Historial de Conteos</h3>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="font-medium">Fecha</TableHead>
                            <TableHead className="font-medium">Estado</TableHead>
                            <TableHead className="text-center font-medium">Items</TableHead>
                            <TableHead className="text-center font-medium">Contados</TableHead>
                            <TableHead className="text-center font-medium">Ajustados</TableHead>
                            <TableHead className="font-medium">Creado por</TableHead>
                            <TableHead className="w-20" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pastSessions.slice(0, 10).map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="text-sm">
                                {format(new Date(s.startedAt), 'dd/MM/yyyy HH:mm')}
                              </TableCell>
                              <TableCell>
                                {s.status === 'COMPLETED' && (
                                  <Badge className="bg-success-muted text-success text-xs">Completado</Badge>
                                )}
                                {s.status === 'CANCELLED' && (
                                  <Badge variant="secondary" className="text-xs">Cancelado</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center">{s.totalItems}</TableCell>
                              <TableCell className="text-center">{s.countedItems}</TableCell>
                              <TableCell className="text-center">{s.adjustedItems}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{s.createdBy?.name || '-'}</TableCell>
                              <TableCell>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => resumeSession(s.id)}>
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ver detalle</TooltipContent>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile cards */}
                    <div className="sm:hidden space-y-2">
                      {pastSessions.slice(0, 5).map((s) => (
                        <div key={s.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                          <div>
                            <p className="text-sm font-medium">{format(new Date(s.startedAt), 'dd/MM/yyyy HH:mm')}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.countedItems}/{s.totalItems} contados · {s.adjustedItems} ajustados
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {s.status === 'COMPLETED' && (
                              <Badge className="bg-success-muted text-success text-xs">OK</Badge>
                            )}
                            {s.status === 'CANCELLED' && (
                              <Badge variant="secondary" className="text-xs">Canc.</Badge>
                            )}
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => resumeSession(s.id)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* ── In Progress or Completed ─────────────────────────────── */}
          {(countStatus === 'in_progress' || countStatus === 'completed') && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card><CardContent className="p-3 sm:p-4">
                  <p className="text-xs font-medium text-muted-foreground">Total</p>
                  <p className="text-xl sm:text-2xl font-bold mt-1">{stats.total}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3 sm:p-4">
                  <p className="text-xs font-medium text-muted-foreground">Contados</p>
                  <p className="text-xl sm:text-2xl font-bold mt-1 text-success">{stats.counted}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3 sm:p-4">
                  <p className="text-xs font-medium text-muted-foreground">Pendientes</p>
                  <p className="text-xl sm:text-2xl font-bold mt-1 text-warning-muted-foreground">{stats.pending}</p>
                </CardContent></Card>
                <Card className={stats.withDifference > 0 ? 'border-destructive/30' : ''}>
                  <CardContent className="p-3 sm:p-4">
                    <p className="text-xs font-medium text-muted-foreground">Diferencias</p>
                    <p className="text-xl sm:text-2xl font-bold mt-1 text-destructive">{stats.withDifference}</p>
                  </CardContent>
                </Card>
                <Card className="hidden sm:block"><CardContent className="p-3 sm:p-4">
                  <p className="text-xs font-medium text-muted-foreground">Sobrante</p>
                  <p className="text-xl sm:text-2xl font-bold mt-1 text-success">+{stats.positiveAdjust}</p>
                </CardContent></Card>
                <Card className="hidden sm:block"><CardContent className="p-3 sm:p-4">
                  <p className="text-xs font-medium text-muted-foreground">Faltante</p>
                  <p className="text-xl sm:text-2xl font-bold mt-1 text-destructive">-{stats.negativeAdjust}</p>
                </CardContent></Card>
              </div>

              {/* Progress */}
              <Card><CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progreso</span>
                  <span className="text-sm text-muted-foreground">{formatNumber(stats.progress, 0)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${stats.progress}%` }} />
                </div>
                {countStartTime && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Iniciado: {format(countStartTime, "dd 'de' MMMM 'a las' HH:mm", { locale: es })}
                  </p>
                )}
              </CardContent></Card>

              {/* Filtros */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar por nombre o código..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-9 bg-background" />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={showOnlyPending} onCheckedChange={(c) => setShowOnlyPending(!!c)} />
                    <span className="hidden sm:inline">Solo pendientes</span>
                    <span className="sm:hidden">Pendientes</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={showOnlyDifferences} onCheckedChange={(c) => setShowOnlyDifferences(!!c)} />
                    <span className="hidden sm:inline">Solo diferencias</span>
                    <span className="sm:hidden">Diferencias</span>
                  </label>
                </div>
              </div>

              {/* MOBILE: Cards */}
              <div className="sm:hidden space-y-2">
                {displayedItems.map((item) => (
                  <Card key={item.toolId} className={cn(
                    'overflow-hidden',
                    item.difference !== 0 && 'border-amber-300 dark:border-amber-700',
                    item.status === 'adjusted' && 'border-green-300 dark:border-green-700'
                  )}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{item.tool.name}</p>
                          {item.tool.code && <p className="text-xs text-muted-foreground font-mono">{item.tool.code}</p>}
                        </div>
                        {item.status === 'pending' && <Badge variant="secondary" className="text-xs shrink-0">Pendiente</Badge>}
                        {item.status === 'counted' && <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shrink-0">Contado</Badge>}
                        {item.status === 'adjusted' && <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 shrink-0">Ajustado</Badge>}
                      </div>

                      <div className="grid grid-cols-3 gap-2 items-end">
                        <div>
                          <p className="text-xs text-muted-foreground">Sistema</p>
                          <p className="font-bold text-lg">{item.systemQty}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Contado</p>
                          <Input
                            id={`count-input-${item.toolId}`}
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={item.countedQty ?? ''}
                            onChange={(e) => updateCount(item.toolId, e.target.value === '' ? null : parseInt(e.target.value))}
                            className="h-10 text-center text-lg font-bold"
                            disabled={countStatus === 'completed'}
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Dif.</p>
                          {item.countedQty !== null ? (
                            <p className={cn('font-bold text-lg', item.difference > 0 ? 'text-success' : item.difference < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                              {item.difference > 0 ? '+' : ''}{item.difference}
                            </p>
                          ) : <p className="text-lg text-muted-foreground">—</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* DESKTOP: Table */}
              <div className="hidden sm:block rounded-lg border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12 font-medium">#</TableHead>
                      <TableHead className="font-medium">Item</TableHead>
                      <TableHead className="font-medium hidden md:table-cell">Ubicación</TableHead>
                      <TableHead className="text-center font-medium">Sistema</TableHead>
                      <TableHead className="text-center w-28 font-medium">Contado</TableHead>
                      <TableHead className="text-center font-medium">Dif.</TableHead>
                      <TableHead className="font-medium hidden lg:table-cell">Notas</TableHead>
                      <TableHead className="w-24 font-medium">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedItems.map((item, index) => (
                      <TableRow key={item.toolId} className={cn(
                        item.difference !== 0 && 'bg-warning-muted/50',
                        item.status === 'adjusted' && 'bg-success-muted/50'
                      )}>
                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.tool.name}</p>
                            {item.tool.code && <p className="text-xs text-muted-foreground">{item.tool.code}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden md:table-cell">{item.tool.location || '-'}</TableCell>
                        <TableCell className="text-center font-medium">{item.systemQty}</TableCell>
                        <TableCell>
                          <Input
                            id={`count-input-${item.toolId}`}
                            type="number"
                            min="0"
                            value={item.countedQty ?? ''}
                            onChange={(e) => updateCount(item.toolId, e.target.value === '' ? null : parseInt(e.target.value))}
                            className="w-20 h-8 text-center mx-auto"
                            disabled={countStatus === 'completed'}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {item.countedQty !== null && (
                            <Badge variant={item.difference === 0 ? 'default' : 'destructive'} className={cn(
                              item.difference > 0 && 'bg-success-muted text-success',
                              item.difference < 0 && 'bg-destructive/10 text-destructive'
                            )}>
                              {item.difference > 0 ? '+' : ''}{item.difference}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Input placeholder="Observaciones..." value={item.notes} onChange={(e) => updateNotes(item.toolId, e.target.value)} className="text-sm h-8" disabled={countStatus === 'completed'} />
                        </TableCell>
                        <TableCell>
                          {item.status === 'pending' && <Badge variant="secondary">Pendiente</Badge>}
                          {item.status === 'counted' && <Badge className="bg-info-muted text-info-muted-foreground">Contado</Badge>}
                          {item.status === 'adjusted' && <Badge className="bg-success-muted text-success">Ajustado</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {displayedItems.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No hay items que mostrar</p>
                  </div>
                )}
              </div>

              {/* Mobile empty */}
              {displayedItems.length === 0 && (
                <div className="sm:hidden text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No hay items que mostrar</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Confirm Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Finalizar Conteo</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Resumen del conteo físico:</p>
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Items contados</p>
                  <p className="text-xl font-bold">{stats.counted} / {stats.total}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Con diferencias</p>
                  <p className="text-xl font-bold text-warning-muted-foreground">{stats.withDifference}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sobrante total</p>
                  <p className="text-lg font-bold text-success">+{stats.positiveAdjust}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Faltante total</p>
                  <p className="text-lg font-bold text-destructive">-{stats.negativeAdjust}</p>
                </div>
              </div>
              {stats.withDifference > 0 && (
                <div className="p-4 bg-warning-muted rounded-lg border border-warning-muted">
                  <p className="text-sm font-medium text-warning-muted-foreground">
                    Se aplicarán {stats.withDifference} ajustes de inventario
                  </p>
                  <p className="text-xs text-warning-muted-foreground mt-1">Esta acción no se puede deshacer.</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Cancelar</Button>
              <Button onClick={applyAdjustments} disabled={isAdjusting}>
                {isAdjusting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Aplicando...</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Aplicar Ajustes</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* QR Scanner */}
        <QRScanner isOpen={showScannerDialog} onClose={() => setShowScannerDialog(false)} onToolFound={handleScanResult} mode="view" />
      </div>
    </TooltipProvider>
  );
}
