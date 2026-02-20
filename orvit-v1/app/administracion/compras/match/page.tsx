'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Link2,
  ArrowRight,
  FileText,
  Package,
  ShoppingCart,
  User,
  Timer,
  AlertOctagon,
  Flame,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow, differenceInHours, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { ReasonCodeSelector } from '@/components/compras/reason-code-selector';

interface MatchException {
  id: number;
  tipo: string;
  campo: string;
  valorEsperado?: string;
  valorRecibido?: string;
  diferencia?: number;
  porcentajeDiff?: number;
  montoAfectado?: number;
  resuelto: boolean;
  resueltoPor?: number;
  resueltoAt?: string;
  // Owner and SLA fields
  ownerId?: number;
  ownerRole?: string;
  ownerName?: string;
  slaDeadline?: string;
  slaBreached?: boolean;
  prioridad?: 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE';
  reasonCode?: string;
  reasonText?: string;
}

interface MatchResult {
  id: number;
  estado: string;
  matchOcRecepcion?: boolean;
  matchRecepcionFactura?: boolean;
  matchOcFactura?: boolean;
  matchCompleto: boolean;
  createdAt: string;
  // Owner and SLA at match level
  ownerId?: number;
  ownerRole?: string;
  ownerName?: string;
  slaDeadline?: string;
  slaBreached?: boolean;
  prioridad?: 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE';
  purchaseOrder?: { id: number; numero: string; total: number };
  goodsReceipt?: { id: number; numero: string };
  factura: {
    id: number;
    numero_factura: string;
    monto_total: number;
    fecha: string;
    supplier: { id: number; name: string };
  };
  exceptions: MatchException[];
}

const estadoColors: Record<string, string> = {
  'PENDIENTE': 'bg-muted-foreground',
  'MATCH_OK': 'bg-success',
  'DISCREPANCIA': 'bg-warning',
  'RESUELTO': 'bg-info',
  'BLOQUEADO': 'bg-destructive'
};

const prioridadConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  'URGENTE': { color: 'bg-destructive text-white', icon: <Flame className="w-3 h-3" />, label: 'Urgente' },
  'ALTA': { color: 'bg-warning text-white', icon: <ArrowUp className="w-3 h-3" />, label: 'Alta' },
  'NORMAL': { color: 'bg-info text-white', icon: <Minus className="w-3 h-3" />, label: 'Normal' },
  'BAJA': { color: 'bg-muted-foreground text-white', icon: <ArrowDown className="w-3 h-3" />, label: 'Baja' },
};

// Helper to calculate SLA status
function getSlaStatus(slaDeadline?: string, slaBreached?: boolean): {
  status: 'ok' | 'warning' | 'breached' | 'none';
  timeLeft?: string;
  hoursLeft?: number;
} {
  if (!slaDeadline) return { status: 'none' };
  if (slaBreached) return { status: 'breached', timeLeft: 'SLA vencido' };

  const deadline = new Date(slaDeadline);
  const now = new Date();
  const hoursLeft = differenceInHours(deadline, now);

  if (isPast(deadline)) {
    return { status: 'breached', timeLeft: 'SLA vencido', hoursLeft: 0 };
  }

  if (hoursLeft <= 4) {
    return {
      status: 'warning',
      timeLeft: formatDistanceToNow(deadline, { locale: es, addSuffix: true }),
      hoursLeft
    };
  }

  return {
    status: 'ok',
    timeLeft: formatDistanceToNow(deadline, { locale: es, addSuffix: true }),
    hoursLeft
  };
}

export default function MatchPage() {
  const [estadoFilter, setEstadoFilter] = useState<string>('all');
  const [prioridadFilter, setPrioridadFilter] = useState<string>('all');
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolucionNotas, setResolucionNotas] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [reasonText, setReasonText] = useState('');

  const loadMatchResults = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(estadoFilter !== 'all' && { estado: estadoFilter }),
        ...(estadoFilter === 'all' && { pendientes: 'true' }),
        ...(prioridadFilter !== 'all' && { prioridad: prioridadFilter })
      });

      const response = await fetch(`/api/compras/match?${params}`);
      if (!response.ok) throw new Error('Error al obtener resultados');

      const data = await response.json();
      setMatchResults(data.data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar resultados de match');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatchResults();
  }, [estadoFilter, prioridadFilter]);

  // Calculate stats with SLA breaches
  const stats = useMemo(() => {
    const slaBreached = matchResults.filter(m => m.slaBreached || getSlaStatus(m.slaDeadline).status === 'breached').length;
    const slaWarning = matchResults.filter(m => {
      const sla = getSlaStatus(m.slaDeadline);
      return sla.status === 'warning';
    }).length;
    const urgentes = matchResults.filter(m => m.prioridad === 'URGENTE').length;

    return { slaBreached, slaWarning, urgentes };
  }, [matchResults]);

  const handleResolver = async (accion: 'aprobar' | 'rechazar') => {
    if (!selectedMatch) return;

    // Validate reason code for rejection
    if (accion === 'rechazar' && !reasonCode) {
      toast.error('Debe seleccionar un código de razón para rechazar');
      return;
    }

    setResolving(true);
    try {
      const response = await fetch(`/api/compras/match/${selectedMatch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion,
          notas: resolucionNotas,
          reasonCode: reasonCode || undefined,
          reasonText: reasonText || undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al resolver');
      }

      toast.success(accion === 'aprobar' ? 'Match aprobado' : 'Match rechazado');
      setIsDetailOpen(false);
      setSelectedMatch(null);
      setResolucionNotas('');
      setReasonCode('');
      setReasonText('');
      loadMatchResults();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setResolving(false);
    }
  };

  // Reset form when opening dialog
  const handleOpenDetail = (match: MatchResult) => {
    setSelectedMatch(match);
    setResolucionNotas('');
    setReasonCode('');
    setReasonText('');
    setIsDetailOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: es });
  };

  const MatchIndicator = ({ value }: { value?: boolean }) => {
    if (value === undefined || value === null) {
      return <span className="text-muted-foreground">-</span>;
    }
    return value ? (
      <CheckCircle className="w-5 h-5 text-success" />
    ) : (
      <XCircle className="w-5 h-5 text-destructive" />
    );
  };

  return (
    <TooltipProvider>
      <div className="m-3 rounded-2xl surface-card dashboard-surface px-6 md:px-8 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">3-Way Match</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Validación automática: Orden de Compra ↔ Recepción ↔ Factura
            </p>
          </div>
          {(stats.slaBreached > 0 || stats.urgentes > 0) && (
            <div className="flex gap-2">
              {stats.slaBreached > 0 && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertOctagon className="w-3 h-3" />
                  {stats.slaBreached} SLA vencido{stats.slaBreached !== 1 && 's'}
                </Badge>
              )}
              {stats.urgentes > 0 && (
                <Badge className="bg-destructive flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  {stats.urgentes} urgente{stats.urgentes !== 1 && 's'}
                </Badge>
              )}
            </div>
          )}
        </div>

      {/* Diagrama de flujo */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-4">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-info-muted flex items-center justify-center">
                <ShoppingCart className="w-8 h-8 text-info-muted-foreground" />
              </div>
              <span className="text-sm mt-2">Orden Compra</span>
            </div>
            <ArrowRight className="w-6 h-6 text-muted-foreground" />
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-success-muted flex items-center justify-center">
                <Package className="w-8 h-8 text-success" />
              </div>
              <span className="text-sm mt-2">Recepción</span>
            </div>
            <ArrowRight className="w-6 h-6 text-muted-foreground" />
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <FileText className="w-8 h-8 text-purple-600" />
              </div>
              <span className="text-sm mt-2">Factura</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Pendientes</p>
                <p className="text-2xl font-bold">
                  {matchResults.filter(m => m.estado === 'PENDIENTE').length}
                </p>
              </div>
              <Clock className="w-7 h-7 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Discrepancias</p>
                <p className="text-2xl font-bold">
                  {matchResults.filter(m => m.estado === 'DISCREPANCIA').length}
                </p>
              </div>
              <AlertTriangle className="w-7 h-7 text-warning-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className={stats.slaBreached > 0 ? 'border-destructive/30' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase">SLA Vencido</p>
                <p className="text-2xl font-bold text-destructive">
                  {stats.slaBreached}
                </p>
              </div>
              <AlertOctagon className="w-7 h-7 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card className={stats.slaWarning > 0 ? 'border-warning-muted' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase">SLA Alerta</p>
                <p className="text-2xl font-bold text-warning-muted-foreground">
                  {stats.slaWarning}
                </p>
              </div>
              <Timer className="w-7 h-7 text-warning-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className={stats.urgentes > 0 ? 'border-destructive/30' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Urgentes</p>
                <p className="text-2xl font-bold text-destructive">
                  {stats.urgentes}
                </p>
              </div>
              <Flame className="w-7 h-7 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Bloqueados</p>
                <p className="text-2xl font-bold">
                  {matchResults.filter(m => m.estado === 'BLOQUEADO').length}
                </p>
              </div>
              <XCircle className="w-7 h-7 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos (pendientes)</SelectItem>
                <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                <SelectItem value="MATCH_OK">Match OK</SelectItem>
                <SelectItem value="DISCREPANCIA">Discrepancia</SelectItem>
                <SelectItem value="RESUELTO">Resuelto</SelectItem>
                <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={prioridadFilter} onValueChange={setPrioridadFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="URGENTE">
                  <div className="flex items-center gap-2">
                    <Flame className="w-3 h-3 text-destructive" />
                    Urgente
                  </div>
                </SelectItem>
                <SelectItem value="ALTA">
                  <div className="flex items-center gap-2">
                    <ArrowUp className="w-3 h-3 text-warning-muted-foreground" />
                    Alta
                  </div>
                </SelectItem>
                <SelectItem value="NORMAL">
                  <div className="flex items-center gap-2">
                    <Minus className="w-3 h-3 text-info-muted-foreground" />
                    Normal
                  </div>
                </SelectItem>
                <SelectItem value="BAJA">
                  <div className="flex items-center gap-2">
                    <ArrowDown className="w-3 h-3 text-muted-foreground" />
                    Baja
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEstadoFilter('all');
                setPrioridadFilter('all');
              }}
            >
              Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Cargando...</p>
            </div>
          ) : matchResults.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
              <p className="text-muted-foreground">No hay matches pendientes de revisión</p>
            </div>
          ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Factura</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead className="text-center">OC↔Fact</TableHead>
                    <TableHead className="text-center">Rec↔Fact</TableHead>
                    <TableHead className="text-center">OC↔Rec</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>SLA</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Excepciones</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchResults.map((match) => {
                    const slaStatus = getSlaStatus(match.slaDeadline, match.slaBreached);
                    const prioridad = match.prioridad || 'NORMAL';
                    const prioridadInfo = prioridadConfig[prioridad];

                    return (
                      <TableRow
                        key={match.id}
                        className={slaStatus.status === 'breached' ? 'bg-destructive/10' : ''}
                      >
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge className={`${prioridadInfo.color} flex items-center gap-1`}>
                                {prioridadInfo.icon}
                                <span className="hidden sm:inline">{prioridadInfo.label}</span>
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>Prioridad: {prioridadInfo.label}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          {match.factura.numero_factura}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {match.factura.supplier.name}
                        </TableCell>
                        <TableCell>{formatCurrency(match.factura.monto_total)}</TableCell>
                        <TableCell className="text-center">
                          <MatchIndicator value={match.matchOcFactura} />
                        </TableCell>
                        <TableCell className="text-center">
                          <MatchIndicator value={match.matchRecepcionFactura} />
                        </TableCell>
                        <TableCell className="text-center">
                          <MatchIndicator value={match.matchOcRecepcion} />
                        </TableCell>
                        <TableCell>
                          <Badge className={estadoColors[match.estado]}>
                            {match.estado.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {slaStatus.status !== 'none' && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge
                                  variant="outline"
                                  className={
                                    slaStatus.status === 'breached' ? 'border-destructive/30 text-destructive' :
                                    slaStatus.status === 'warning' ? 'border-warning-muted text-warning-muted-foreground' :
                                    'border-success-muted text-success'
                                  }
                                >
                                  {slaStatus.status === 'breached' && <AlertOctagon className="w-3 h-3 mr-1" />}
                                  {slaStatus.status === 'warning' && <Timer className="w-3 h-3 mr-1" />}
                                  {slaStatus.status === 'ok' && <Clock className="w-3 h-3 mr-1" />}
                                  <span className="hidden sm:inline">{slaStatus.timeLeft}</span>
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {slaStatus.status === 'breached' ? 'SLA vencido' : `Vence ${slaStatus.timeLeft}`}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>
                          {match.ownerName ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-sm truncate max-w-[80px]">{match.ownerName}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {match.ownerName}
                                {match.ownerRole && <span className="ml-1 text-muted-foreground">({match.ownerRole})</span>}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground text-xs">Sin asignar</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {match.exceptions.length > 0 && (
                            <Badge variant="outline">
                              {match.exceptions.filter(e => !e.resuelto).length} pendientes
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetail(match)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalle */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              Detalle de Match
              {selectedMatch?.prioridad && (
                <Badge className={prioridadConfig[selectedMatch.prioridad]?.color}>
                  {prioridadConfig[selectedMatch.prioridad]?.icon}
                  <span className="ml-1">{prioridadConfig[selectedMatch.prioridad]?.label}</span>
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Revisa las discrepancias y toma una decisión
            </DialogDescription>
          </DialogHeader>

          {selectedMatch && (
            <div className="space-y-6">
              {/* Owner and SLA Info */}
              <div className="flex flex-wrap gap-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Responsable:</span>
                  {selectedMatch.ownerName ? (
                    <span className="text-sm font-medium">
                      {selectedMatch.ownerName}
                      {selectedMatch.ownerRole && (
                        <span className="text-muted-foreground ml-1">({selectedMatch.ownerRole})</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Sin asignar</span>
                  )}
                </div>

                {selectedMatch.slaDeadline && (() => {
                  const slaStatus = getSlaStatus(selectedMatch.slaDeadline, selectedMatch.slaBreached);
                  return (
                    <div className="flex items-center gap-2">
                      <Timer className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">SLA:</span>
                      <Badge
                        variant="outline"
                        className={
                          slaStatus.status === 'breached' ? 'border-destructive/30 text-destructive bg-destructive/10' :
                          slaStatus.status === 'warning' ? 'border-warning-muted text-warning-muted-foreground bg-warning-muted' :
                          'border-success-muted text-success bg-success-muted'
                        }
                      >
                        {slaStatus.status === 'breached' && <AlertOctagon className="w-3 h-3 mr-1" />}
                        {slaStatus.status === 'warning' && <Timer className="w-3 h-3 mr-1" />}
                        {slaStatus.timeLeft}
                      </Badge>
                    </div>
                  );
                })()}

                <div className="flex items-center gap-2 ml-auto">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Creado: {formatDate(selectedMatch.createdAt)}
                  </span>
                </div>
              </div>

              {/* Documentos vinculados */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className="w-4 h-4" />
                    <span className="font-medium">Orden de Compra</span>
                  </div>
                  {selectedMatch.purchaseOrder ? (
                    <div>
                      <p className="font-medium">{selectedMatch.purchaseOrder.numero}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(selectedMatch.purchaseOrder.total)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No vinculada</p>
                  )}
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4" />
                    <span className="font-medium">Recepción</span>
                  </div>
                  {selectedMatch.goodsReceipt ? (
                    <p className="font-medium">{selectedMatch.goodsReceipt.numero}</p>
                  ) : (
                    <p className="text-muted-foreground">No vinculada</p>
                  )}
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4" />
                    <span className="font-medium">Factura</span>
                  </div>
                  <p className="font-medium">{selectedMatch.factura.numero_factura}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(selectedMatch.factura.monto_total)}
                  </p>
                </div>
              </div>

              {/* Excepciones */}
              {selectedMatch.exceptions.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning-muted-foreground" />
                    Excepciones detectadas ({selectedMatch.exceptions.filter(e => !e.resuelto).length} pendientes)
                  </h4>
                  <div className="space-y-3">
                    {selectedMatch.exceptions.map((exc) => {
                      const excSla = getSlaStatus(exc.slaDeadline, exc.slaBreached);
                      const excPrioridad = exc.prioridad || 'NORMAL';

                      return (
                        <div
                          key={exc.id}
                          className={`p-4 border rounded-lg ${
                            exc.resuelto
                              ? 'bg-success-muted border-success-muted'
                              : excSla.status === 'breached'
                              ? 'bg-destructive/10 border-destructive/30'
                              : 'bg-warning-muted border-warning-muted'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline">{exc.tipo.replace(/_/g, ' ')}</Badge>
                              <span className="text-sm font-medium">{exc.campo}</span>
                              {exc.prioridad && (
                                <Badge className={`${prioridadConfig[excPrioridad].color} text-xs`}>
                                  {prioridadConfig[excPrioridad].icon}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {exc.ownerName && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {exc.ownerName}
                                </span>
                              )}
                              {excSla.status !== 'none' && !exc.resuelto && (
                                <Badge
                                  variant="outline"
                                  className={
                                    excSla.status === 'breached' ? 'border-destructive/30 text-destructive text-xs' :
                                    excSla.status === 'warning' ? 'border-warning-muted text-warning-muted-foreground text-xs' :
                                    'border-success-muted text-success text-xs'
                                  }
                                >
                                  {excSla.timeLeft}
                                </Badge>
                              )}
                              {exc.resuelto && (
                                <Badge variant="outline" className="border-success-muted text-success">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Resuelto
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Values comparison */}
                          {exc.valorEsperado && exc.valorRecibido && (
                            <div className="mt-2 text-sm flex flex-wrap gap-x-4 gap-y-1">
                              <span>
                                <span className="text-muted-foreground">Esperado:</span>{' '}
                                <span className="font-medium">{exc.valorEsperado}</span>
                              </span>
                              <span>→</span>
                              <span>
                                <span className="text-muted-foreground">Recibido:</span>{' '}
                                <span className="font-medium">{exc.valorRecibido}</span>
                              </span>
                              {exc.porcentajeDiff !== undefined && (
                                <span className="text-destructive font-medium">
                                  ({exc.porcentajeDiff.toFixed(1)}% diferencia)
                                </span>
                              )}
                              {exc.montoAfectado !== undefined && (
                                <span className="text-destructive">
                                  Monto afectado: {formatCurrency(exc.montoAfectado)}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Resolution info if resolved */}
                          {exc.resuelto && exc.reasonCode && (
                            <div className="mt-2 pt-2 border-t text-sm">
                              <span className="text-muted-foreground">Razón:</span>{' '}
                              <span>{exc.reasonCode.replace(/_/g, ' ')}</span>
                              {exc.reasonText && (
                                <p className="text-muted-foreground mt-1">{exc.reasonText}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Resolution section */}
              {selectedMatch.estado === 'DISCREPANCIA' && (
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-medium">Resolución</h4>

                  {/* Reason Code Selector */}
                  <ReasonCodeSelector
                    entityType="MATCH"
                    actionType="RESOLVER"
                    value={reasonCode}
                    textValue={reasonText}
                    onChange={(code, text) => {
                      setReasonCode(code);
                      setReasonText(text || '');
                    }}
                    required
                    label="Código de razón"
                  />

                  {/* Additional notes */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Notas adicionales (opcional)
                    </label>
                    <Textarea
                      value={resolucionNotas}
                      onChange={(e) => setResolucionNotas(e.target.value)}
                      placeholder="Información adicional sobre la resolución..."
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              Cerrar
            </Button>
            {selectedMatch?.estado === 'DISCREPANCIA' && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => handleResolver('rechazar')}
                  disabled={resolving}
                >
                  <ThumbsDown className="w-4 h-4 mr-2" />
                  Rechazar
                </Button>
                <Button
                  onClick={() => handleResolver('aprobar')}
                  disabled={resolving}
                >
                  <ThumbsUp className="w-4 h-4 mr-2" />
                  Aprobar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </TooltipProvider>
  );
}
