'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Package,
  Layers,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Wrench,
  ChevronRight,
  History,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { usePanolPermissions } from '@/hooks/use-panol-permissions';

interface Lot {
  id: number;
  toolId: number;
  lotNumber: string;
  serialNumber?: string;
  quantity: number;
  remainingQty: number;
  expiresAt?: string;
  unitCost?: number;
  status: 'AVAILABLE' | 'DEPLETED' | 'EXPIRED';
  receivedAt: string;
  notes?: string;
  tool: {
    id: number;
    name: string;
    category?: string;
    unit?: string;
    itemType?: string;
  };
  installations?: Installation[];
}

interface Installation {
  id: number;
  quantity: number;
  installedAt: string;
  removedAt?: string;
  removalReason?: string;
  notes?: string;
  machine: { id: number; name: string; code?: string };
  component?: { id: number; name: string };
  installedBy: { id: number; name: string };
  removedBy?: { id: number; name: string };
  workOrder?: { id: number; title: string; status: string };
}

const statusConfig = {
  AVAILABLE: { label: 'Disponible', color: 'bg-success-muted text-success', icon: CheckCircle2 },
  DEPLETED: { label: 'Agotado', color: 'bg-muted text-foreground', icon: Package },
  EXPIRED: { label: 'Vencido', color: 'bg-destructive/10 text-destructive', icon: XCircle },
};

export default function LotesPage() {
  const permissions = usePanolPermissions();

  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stats, setStats] = useState<any>({});

  // Detail dialog
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [loadingInstallations, setLoadingInstallations] = useState(false);

  const fetchLots = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      params.set('withInstallations', 'false');

      const res = await fetch(`/api/panol/lots?${params}`);
      const data = await res.json();

      if (data.success) {
        setLots(data.data);
        setStats(data.stats);
      }
    } catch (error) {
      toast.error('Error al cargar lotes');
    } finally {
      setLoading(false);
    }
  };

  const fetchLotDetail = async (lot: Lot) => {
    setSelectedLot(lot);
    setLoadingInstallations(true);

    try {
      const res = await fetch(`/api/panol/lots?toolId=${lot.toolId}&withInstallations=true`);
      const data = await res.json();

      if (data.success) {
        const fullLot = data.data.find((l: Lot) => l.id === lot.id);
        if (fullLot) {
          setSelectedLot(fullLot);
        }
      }
    } catch (error) {
      toast.error('Error al cargar instalaciones');
    } finally {
      setLoadingInstallations(false);
    }
  };

  useEffect(() => {
    fetchLots();
  }, [statusFilter]);

  const filteredLots = useMemo(() => {
    if (!searchTerm) return lots;
    const term = searchTerm.toLowerCase();
    return lots.filter(l =>
      l.lotNumber.toLowerCase().includes(term) ||
      l.tool.name.toLowerCase().includes(term) ||
      l.serialNumber?.toLowerCase().includes(term)
    );
  }, [lots, searchTerm]);

  const getExpirationInfo = (lot: Lot) => {
    if (!lot.expiresAt) return null;

    const expiresDate = new Date(lot.expiresAt);
    const daysUntil = differenceInDays(expiresDate, new Date());

    if (daysUntil < 0) {
      return { status: 'expired', label: 'Vencido', color: 'text-destructive', days: Math.abs(daysUntil) };
    } else if (daysUntil <= 7) {
      return { status: 'critical', label: 'Vence pronto', color: 'text-destructive', days: daysUntil };
    } else if (daysUntil <= 30) {
      return { status: 'warning', label: 'Por vencer', color: 'text-warning-muted-foreground', days: daysUntil };
    }
    return { status: 'ok', label: 'Vigente', color: 'text-success', days: daysUntil };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Layers className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Cargando lotes...</p>
        </div>
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
              <h1 className="text-xl font-semibold text-foreground">Trazabilidad de Lotes</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Seguimiento de lotes e instalaciones en máquinas
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4 px-4 md:px-6 pb-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Disponibles</p>
                    <p className="text-2xl font-bold text-success">
                      {stats.byStatus?.AVAILABLE?.count || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {stats.byStatus?.AVAILABLE?.quantity || 0} unidades
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-success-muted flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Agotados</p>
                    <p className="text-2xl font-bold text-muted-foreground">
                      {stats.byStatus?.DEPLETED?.count || 0}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={cn(stats.expiringSoon > 0 && 'border-warning-muted/50')}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Por Vencer (30d)</p>
                    <p className="text-2xl font-bold text-warning-muted-foreground">
                      {stats.expiringSoon || 0}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-warning-muted flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-warning-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total Lotes</p>
                    <p className="text-2xl font-bold">
                      {(stats.byStatus?.AVAILABLE?.count || 0) +
                        (stats.byStatus?.DEPLETED?.count || 0) +
                        (stats.byStatus?.EXPIRED?.count || 0)}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Layers className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número de lote, repuesto, serie..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9 bg-background"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="AVAILABLE">Disponibles</SelectItem>
                    <SelectItem value="DEPLETED">Agotados</SelectItem>
                    <SelectItem value="EXPIRED">Vencidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lote / Repuesto</TableHead>
                    <TableHead className="text-center">Cantidad</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Recibido</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLots.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Layers className="h-8 w-8 text-muted-foreground/50" />
                          <p className="text-muted-foreground">No hay lotes</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLots.map((lot) => {
                      const statusInfo = statusConfig[lot.status];
                      const StatusIcon = statusInfo.icon;
                      const expInfo = getExpirationInfo(lot);
                      const usedPercent = ((lot.quantity - lot.remainingQty) / lot.quantity) * 100;

                      return (
                        <TableRow key={lot.id} className="cursor-pointer hover:bg-muted/50" onClick={() => fetchLotDetail(lot)}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                                <Layers className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{lot.lotNumber}</p>
                                <p className="text-xs text-muted-foreground">{lot.tool.name}</p>
                                {lot.serialNumber && (
                                  <p className="text-xs text-muted-foreground">S/N: {lot.serialNumber}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <p className="font-semibold">{lot.remainingQty} / {lot.quantity}</p>
                              <Progress value={100 - usedPercent} className="h-1.5 mt-1 w-20 mx-auto" />
                              <p className="text-xs text-muted-foreground">{lot.tool.unit}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {expInfo ? (
                              <div className="flex items-center gap-2">
                                {expInfo.status !== 'ok' && (
                                  <AlertTriangle className={cn('h-4 w-4', expInfo.color)} />
                                )}
                                <div>
                                  <p className={cn('text-sm font-medium', expInfo.color)}>
                                    {expInfo.status === 'expired' ? `Hace ${expInfo.days}d` : `${expInfo.days}d`}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDate(lot.expiresAt!)}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Sin vencimiento</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn('gap-1', statusInfo.color)}>
                              <StatusIcon className="h-3 w-3" />
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {formatDate(lot.receivedAt)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Detail Dialog */}
        <Dialog open={!!selectedLot} onOpenChange={() => setSelectedLot(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Lote: {selectedLot?.lotNumber}
              </DialogTitle>
              <DialogDescription>
                {selectedLot?.tool.name}
                {selectedLot?.serialNumber && ` • S/N: ${selectedLot.serialNumber}`}
              </DialogDescription>
            </DialogHeader>

            {selectedLot && (
              <div className="space-y-6">
                {/* Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Cantidad Original</p>
                    <p className="font-semibold">{selectedLot.quantity} {selectedLot.tool.unit}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Restante</p>
                    <p className="font-semibold text-success">{selectedLot.remainingQty} {selectedLot.tool.unit}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Recibido</p>
                    <p className="font-semibold">{formatDate(selectedLot.receivedAt)}</p>
                  </div>
                  {permissions.canViewCosts && selectedLot.unitCost && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Costo Unitario</p>
                      <p className="font-semibold">${selectedLot.unitCost.toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {/* Expiration */}
                {selectedLot.expiresAt && (
                  <div className={cn(
                    'p-3 rounded-lg border flex items-center gap-3',
                    getExpirationInfo(selectedLot)?.status === 'expired' ? 'bg-destructive/10 border-destructive/30' :
                    getExpirationInfo(selectedLot)?.status === 'critical' ? 'bg-destructive/10 border-destructive/30' :
                    getExpirationInfo(selectedLot)?.status === 'warning' ? 'bg-warning-muted border-warning-muted' :
                    'bg-success-muted border-success-muted'
                  )}>
                    <Calendar className={cn('h-5 w-5', getExpirationInfo(selectedLot)?.color)} />
                    <div>
                      <p className="text-sm font-medium">
                        Vencimiento: {format(new Date(selectedLot.expiresAt), "dd 'de' MMMM, yyyy", { locale: es })}
                      </p>
                      <p className={cn('text-xs', getExpirationInfo(selectedLot)?.color)}>
                        {getExpirationInfo(selectedLot)?.label}
                      </p>
                    </div>
                  </div>
                )}

                {/* Installations History */}
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Historial de Instalaciones
                  </h4>

                  {loadingInstallations ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="h-6 w-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin mx-auto mb-2" />
                      Cargando lotes...
                    </div>
                  ) : selectedLot.installations && selectedLot.installations.length > 0 ? (
                    <div className="space-y-3">
                      {selectedLot.installations.map((inst) => (
                        <div
                          key={inst.id}
                          className={cn(
                            'p-3 rounded-lg border',
                            inst.removedAt ? 'bg-muted/30' : 'bg-background'
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                'p-2 rounded-lg',
                                inst.removedAt ? 'bg-muted' : 'bg-success-muted'
                              )}>
                                <Wrench className={cn(
                                  'h-4 w-4',
                                  inst.removedAt ? 'text-muted-foreground' : 'text-success'
                                )} />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{inst.machine.name}</p>
                                {inst.component && (
                                  <p className="text-xs text-muted-foreground">
                                    Componente: {inst.component.name}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  <span>{inst.quantity} {selectedLot.tool.unit}</span>
                                  <span>•</span>
                                  <span>Por {inst.installedBy.name}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right text-xs">
                              <p className="text-muted-foreground">
                                {formatDateTime(inst.installedAt)}
                              </p>
                              {inst.workOrder && (
                                <Badge variant="outline" className="text-xs mt-1">
                                  OT-{inst.workOrder.id}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {inst.removedAt && (
                            <div className="mt-2 pt-2 border-t border-dashed text-xs text-muted-foreground">
                              <span className="text-destructive">Removido:</span>{' '}
                              {formatDateTime(inst.removedAt)}
                              {inst.removalReason && ` - ${inst.removalReason}`}
                              {inst.removedBy && ` (por ${inst.removedBy.name})`}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                      <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Sin instalaciones registradas</p>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {selectedLot.notes && (
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Notas</p>
                    <p className="text-sm">{selectedLot.notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
