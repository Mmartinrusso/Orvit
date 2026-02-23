'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  Package,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  Save,
  RefreshCw,
  Download,
  ScanLine,
  Loader2,
  Clock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useCompany } from '@/contexts/CompanyContext';
import { cn, formatNumber } from '@/lib/utils';
import { QRScanner } from '@/components/panol';

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

type CountStatus = 'not_started' | 'in_progress' | 'completed' | 'adjusting';

export default function ConteoPage() {
  const { currentCompany } = useCompany();

  const [tools, setTools] = useState<Tool[]>([]);
  const [countItems, setCountItems] = useState<CountItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const loadTools = useCallback(async () => {
    if (!currentCompany?.id) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/tools?companyId=${currentCompany.id}`);
      if (!response.ok) throw new Error('Error al cargar items');
      const data = await response.json();
      const toolsArray = Array.isArray(data) ? data : (data?.tools || data?.items || []);
      setTools(toolsArray);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar items');
      setTools([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

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

  const startCount = () => {
    const items: CountItem[] = filteredToolsForCount.map(tool => ({
      toolId: tool.id,
      tool,
      systemQty: tool.stockQuantity,
      countedQty: null,
      difference: 0,
      status: 'pending',
      notes: '',
    }));

    setCountItems(items);
    setCountStatus('in_progress');
    setCountStartTime(new Date());
    toast.success(`Conteo iniciado con ${items.length} items`);
  };

  const updateCount = (toolId: number, countedQty: number | null) => {
    setCountItems(prev => prev.map(item => {
      if (item.toolId !== toolId) return item;

      const difference = countedQty !== null ? countedQty - item.systemQty : 0;
      return {
        ...item,
        countedQty,
        difference,
        status: countedQty !== null ? 'counted' : 'pending',
      };
    }));
  };

  const updateNotes = (toolId: number, notes: string) => {
    setCountItems(prev => prev.map(item =>
      item.toolId === toolId ? { ...item, notes } : item
    ));
  };

  const handleScanResult = (tool: Tool) => {
    setShowScannerDialog(false);

    const item = countItems.find(i => i.toolId === tool.id);
    if (item) {
      const input = document.getElementById(`count-input-${tool.id}`);
      if (input) {
        (input as HTMLInputElement).focus();
        (input as HTMLInputElement).select();
      }
      toast.success(`Item encontrado: ${tool.name}`);
    } else {
      toast.error('Este item no está en el conteo actual');
    }
  };

  const stats = useMemo(() => {
    const total = countItems.length;
    const counted = countItems.filter(i => i.status === 'counted').length;
    const pending = countItems.filter(i => i.status === 'pending').length;
    const withDifference = countItems.filter(i => i.countedQty !== null && i.difference !== 0).length;
    const positiveAdjust = countItems.filter(i => i.difference > 0).reduce((s, i) => s + i.difference, 0);
    const negativeAdjust = countItems.filter(i => i.difference < 0).reduce((s, i) => s + Math.abs(i.difference), 0);

    return {
      total,
      counted,
      pending,
      withDifference,
      positiveAdjust,
      negativeAdjust,
      progress: total > 0 ? (counted / total) * 100 : 0,
    };
  }, [countItems]);

  const displayedItems = useMemo(() => {
    return countItems.filter(item => {
      const matchesSearch =
        item.tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.tool.code || '').toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;
      if (showOnlyPending && item.status !== 'pending') return false;
      if (showOnlyDifferences && item.difference === 0) return false;

      return true;
    });
  }, [countItems, searchTerm, showOnlyPending, showOnlyDifferences]);

  const applyAdjustments = async () => {
    const itemsToAdjust = countItems.filter(i => i.countedQty !== null && i.difference !== 0);

    if (itemsToAdjust.length === 0) {
      toast.info('No hay diferencias que ajustar');
      return;
    }

    setIsAdjusting(true);
    toast.loading(`Ajustando ${itemsToAdjust.length} items...`, { id: 'adjust' });

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const item of itemsToAdjust) {
        try {
          const response = await fetch('/api/tools/movements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toolId: item.toolId,
              type: item.difference > 0 ? 'IN' : 'OUT',
              quantity: Math.abs(item.difference),
              reason: `Ajuste por conteo físico - ${item.notes || 'Sin observaciones'}`,
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }

      if (errorCount === 0) {
        toast.success(`${successCount} ajustes aplicados correctamente`, { id: 'adjust' });
        setCountStatus('completed');

        setCountItems(prev => prev.map(item => ({
          ...item,
          status: item.countedQty !== null ? 'adjusted' : item.status,
        })));
      } else {
        toast.error(`${successCount} exitosos, ${errorCount} errores`, { id: 'adjust' });
      }
    } catch (error) {
      toast.error('Error al aplicar ajustes', { id: 'adjust' });
    } finally {
      setIsAdjusting(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Código', 'Nombre', 'Categoría', 'Ubicación', 'Stock Sistema', 'Stock Contado', 'Diferencia', 'Notas'];
    const rows = countItems.map(item => [
      item.tool.code || '',
      item.tool.name,
      item.tool.category || '',
      item.tool.location || '',
      item.systemQty,
      item.countedQty ?? '',
      item.difference,
      item.notes,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `conteo_fisico_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`;
    link.click();

    toast.success('Archivo CSV descargado');
  };

  const resetCount = () => {
    setCountItems([]);
    setCountStatus('not_started');
    setCountStartTime(null);
    setShowOnlyPending(false);
    setShowOnlyDifferences(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="w-full p-0">
        {/* Header */}
        <div className="px-4 md:px-6 pt-4 pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Conteo Físico</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Auditoría y ajuste de inventario
              </p>
            </div>

            {countStatus === 'not_started' && (
              <Button size="sm" className="h-9" onClick={startCount} disabled={filteredToolsForCount.length === 0}>
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Iniciar Conteo
              </Button>
            )}

            {countStatus === 'in_progress' && (
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9" onClick={() => setShowScannerDialog(true)}>
                      <ScanLine className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Escanear QR</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9" onClick={exportToCSV}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Exportar CSV</TooltipContent>
                </Tooltip>
                <Button size="sm" className="h-9" onClick={() => setShowConfirmDialog(true)} disabled={stats.counted === 0}>
                  <Save className="h-4 w-4 mr-2" />
                  Finalizar
                </Button>
              </div>
            )}

            {countStatus === 'completed' && (
              <Button size="sm" className="h-9" onClick={resetCount}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Nuevo Conteo
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4 px-4 md:px-6 pb-6">
          {/* Setup - Not Started */}
          {countStatus === 'not_started' && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-medium mb-3">Configurar Conteo</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Selecciona qué items incluir en el conteo físico. Puedes filtrar por categoría y ubicación.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label className="text-xs">Categoría</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="h-9 bg-background">
                        <SelectValue placeholder="Todas las categorías" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las categorías</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Ubicación</Label>
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                      <SelectTrigger className="h-9 bg-background">
                        <SelectValue placeholder="Todas las ubicaciones" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las ubicaciones</SelectItem>
                        {locations.map(loc => (
                          <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm">
                    <strong>{filteredToolsForCount.length}</strong> items serán incluidos en el conteo
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* In Progress or Completed */}
          {(countStatus === 'in_progress' || countStatus === 'completed') && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Total Items</p>
                        <p className="text-2xl font-bold mt-1">{stats.total}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Contados</p>
                        <p className="text-2xl font-bold mt-1 text-success">{stats.counted}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-success-muted">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Pendientes</p>
                        <p className="text-2xl font-bold mt-1 text-warning-muted-foreground">{stats.pending}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-warning-muted">
                        <Clock className="h-4 w-4 text-warning-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={stats.withDifference > 0 ? 'border-destructive/30/50' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Con Diferencia</p>
                        <p className="text-2xl font-bold mt-1 text-destructive">{stats.withDifference}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-destructive/10">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Sobrante</p>
                        <p className="text-2xl font-bold mt-1 text-success">+{stats.positiveAdjust}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-success-muted">
                        <TrendingUp className="h-4 w-4 text-success" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Faltante</p>
                        <p className="text-2xl font-bold mt-1 text-destructive">-{stats.negativeAdjust}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-destructive/10">
                        <TrendingDown className="h-4 w-4 text-destructive" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Progress Bar */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Progreso del Conteo</span>
                    <span className="text-sm text-muted-foreground">{formatNumber(stats.progress, 0)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${stats.progress}%` }}
                    />
                  </div>
                  {countStartTime && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Iniciado: {format(countStartTime, "dd 'de' MMMM 'a las' HH:mm", { locale: es })}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o código..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9 bg-background"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={showOnlyPending}
                      onCheckedChange={(checked) => setShowOnlyPending(!!checked)}
                    />
                    Solo pendientes
                  </label>

                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={showOnlyDifferences}
                      onCheckedChange={(checked) => setShowOnlyDifferences(!!checked)}
                    />
                    Solo diferencias
                  </label>
                </div>
              </div>

              {/* Table */}
              <div className="rounded-lg border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12 font-medium">#</TableHead>
                      <TableHead className="font-medium">Item</TableHead>
                      <TableHead className="font-medium">Ubicación</TableHead>
                      <TableHead className="text-center font-medium">Sistema</TableHead>
                      <TableHead className="text-center w-32 font-medium">Contado</TableHead>
                      <TableHead className="text-center font-medium">Diferencia</TableHead>
                      <TableHead className="font-medium">Notas</TableHead>
                      <TableHead className="w-24 font-medium">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedItems.map((item, index) => (
                      <TableRow
                        key={item.toolId}
                        className={cn(
                          item.difference !== 0 && 'bg-warning-muted/50',
                          item.status === 'adjusted' && 'bg-success-muted/50'
                        )}
                      >
                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.tool.name}</p>
                            {item.tool.code && (
                              <p className="text-xs text-muted-foreground">{item.tool.code}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.tool.location || '-'}</TableCell>
                        <TableCell className="text-center font-medium">{item.systemQty}</TableCell>
                        <TableCell>
                          <Input
                            id={`count-input-${item.toolId}`}
                            type="number"
                            min="0"
                            value={item.countedQty ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateCount(item.toolId, val === '' ? null : parseInt(val));
                            }}
                            className="w-20 h-8 text-center mx-auto"
                            disabled={countStatus === 'completed'}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {item.countedQty !== null && (
                            <Badge
                              variant={item.difference === 0 ? 'default' : 'destructive'}
                              className={cn(
                                item.difference > 0 && 'bg-success-muted text-success',
                                item.difference < 0 && 'bg-destructive/10 text-destructive'
                              )}
                            >
                              {item.difference > 0 ? '+' : ''}{item.difference}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Observaciones..."
                            value={item.notes}
                            onChange={(e) => updateNotes(item.toolId, e.target.value)}
                            className="text-sm h-8"
                            disabled={countStatus === 'completed'}
                          />
                        </TableCell>
                        <TableCell>
                          {item.status === 'pending' && (
                            <Badge variant="secondary">Pendiente</Badge>
                          )}
                          {item.status === 'counted' && (
                            <Badge variant="default" className="bg-info-muted text-info-muted-foreground">
                              Contado
                            </Badge>
                          )}
                          {item.status === 'adjusted' && (
                            <Badge variant="default" className="bg-success-muted text-success">
                              Ajustado
                            </Badge>
                          )}
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
            </>
          )}
        </div>

        {/* Confirm Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Finalizar Conteo</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Resumen del conteo físico:
              </p>

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
                  <p className="text-xs text-warning-muted-foreground mt-1">
                    Esta acción no se puede deshacer.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={applyAdjustments} disabled={isAdjusting}>
                {isAdjusting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Aplicar Ajustes
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* QR Scanner Dialog */}
        <QRScanner
          isOpen={showScannerDialog}
          onClose={() => setShowScannerDialog(false)}
          onToolFound={handleScanResult}
          mode="view"
        />
      </div>
    </TooltipProvider>
  );
}
