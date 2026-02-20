'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Package,
  Lock,
  Unlock,
  MoreHorizontal,
  Eye,
  Trash2,
  FileCheck,
  Boxes,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/providers/ThemeProvider';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface QualityControl {
  id: number;
  controlType: string;
  parameter: string | null;
  expectedValue: string | null;
  actualValue: string | null;
  unit: string | null;
  result: string;
  rejectionReason: string | null;
  notes: string | null;
  inspectedAt: string;
  productionOrder: {
    id: number;
    code: string;
    product: { name: string };
  } | null;
  batchLot: {
    id: number;
    lotCode: string;
    qualityStatus: string;
  } | null;
  inspectedBy: { id: number; name: string };
}

interface BatchLot {
  id: number;
  lotCode: string;
  quantity: number;
  uom: string;
  qualityStatus: string;
  productionDate: string;
  expirationDate: string | null;
  blockedReason: string | null;
  blockedAt: string | null;
  releasedAt: string | null;
  productionOrder: {
    id: number;
    code: string;
    product: { name: string; code: string };
  };
  blockedBy: { name: string } | null;
  releasedBy: { name: string } | null;
  _count: {
    qualityControls: number;
    defects: number;
  };
}

const RESULT_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  APPROVED: { label: 'Aprobado', color: 'bg-success', icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED: { label: 'Rechazado', color: 'bg-destructive', icon: <XCircle className="h-3 w-3" /> },
  HOLD: { label: 'En Espera', color: 'bg-warning', icon: <Clock className="h-3 w-3" /> },
  PENDING: { label: 'Pendiente', color: 'bg-muted-foreground', icon: <Clock className="h-3 w-3" /> },
};

const LOT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-muted-foreground' },
  APPROVED: { label: 'Aprobado', color: 'bg-success' },
  BLOCKED: { label: 'Bloqueado', color: 'bg-destructive' },
  REJECTED: { label: 'Rechazado', color: 'bg-destructive' },
};

export default function QualityPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState('controls');

  // Controls state
  const [controls, setControls] = useState<QualityControl[]>([]);
  const [controlsLoading, setControlsLoading] = useState(true);
  const [controlStats, setControlStats] = useState<Record<string, number>>({});

  // Lots state
  const [lots, setLots] = useState<BatchLot[]>([]);
  const [lotsLoading, setLotsLoading] = useState(true);
  const [lotStats, setLotStats] = useState<Record<string, { count: number; quantity: number }>>({});

  // Filters
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialogs
  const [blockDialog, setBlockDialog] = useState<{ open: boolean; lot: BatchLot | null; reason: string }>({
    open: false,
    lot: null,
    reason: '',
  });
  const [releaseDialog, setReleaseDialog] = useState<{ open: boolean; lot: BatchLot | null }>({
    open: false,
    lot: null,
  });

  const canCreate = hasPermission('produccion.calidad.create');
  const canApprove = hasPermission('produccion.calidad.approve');
  const canBlockLot = hasPermission('produccion.calidad.block_lot');
  const canReleaseLot = hasPermission('produccion.calidad.release_lot');

  const fetchControls = useCallback(async () => {
    setControlsLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (resultFilter !== 'all') params.append('result', resultFilter);

      const res = await fetch(`/api/production/quality?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setControls(data.controls);
        setControlStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching controls:', error);
      toast.error('Error al cargar controles');
    } finally {
      setControlsLoading(false);
    }
  }, [dateFrom, dateTo, resultFilter]);

  const fetchLots = useCallback(async () => {
    setLotsLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (statusFilter !== 'all') params.append('qualityStatus', statusFilter);

      const res = await fetch(`/api/production/lots?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setLots(data.lots);
        setLotStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching lots:', error);
      toast.error('Error al cargar lotes');
    } finally {
      setLotsLoading(false);
    }
  }, [dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    if (activeTab === 'controls') {
      fetchControls();
    } else {
      fetchLots();
    }
  }, [activeTab, fetchControls, fetchLots]);

  const handleBlockLot = async () => {
    if (!blockDialog.lot || !blockDialog.reason) return;

    try {
      const res = await fetch(`/api/production/lots/${blockDialog.lot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'block',
          blockedReason: blockDialog.reason,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Lote bloqueado');
        setBlockDialog({ open: false, lot: null, reason: '' });
        fetchLots();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Error al bloquear lote');
    }
  };

  const handleReleaseLot = async () => {
    if (!releaseDialog.lot) return;

    try {
      const res = await fetch(`/api/production/lots/${releaseDialog.lot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'release' }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Lote liberado');
        setReleaseDialog({ open: false, lot: null });
        fetchLots();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Error al liberar lote');
    }
  };

  const handleApproveLot = async (lot: BatchLot) => {
    try {
      const res = await fetch(`/api/production/lots/${lot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Lote aprobado');
        fetchLots();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Error al aprobar lote');
    }
  };

  return (
    <div className="px-4 md:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#06b6d415' }}>
              <FileCheck className="h-5 w-5" style={{ color: '#06b6d4' }} />
            </div>
            Control de Calidad
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Controles de calidad y gestión de lotes</p>
        </div>

        <Button variant="outline" size="sm" onClick={() => activeTab === 'controls' ? fetchControls() : fetchLots()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Aprobados', value: controlStats.APPROVED || 0, icon: CheckCircle2, color: '#10b981' },
          { label: 'Rechazados', value: controlStats.REJECTED || 0, icon: XCircle, color: '#ef4444' },
          { label: 'Lotes Bloqueados', value: lotStats.BLOCKED?.count || 0, icon: Lock, color: '#f59e0b' },
          { label: 'Lotes Pendientes', value: lotStats.PENDING?.count || 0, icon: Boxes, color: '#6366f1' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${stat.color}15` }}>
                  <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="controls">
            <FileCheck className="h-4 w-4 mr-2" />
            Controles
          </TabsTrigger>
          <TabsTrigger value="lots">
            <Boxes className="h-4 w-4 mr-2" />
            Lotes
          </TabsTrigger>
        </TabsList>

        {/* Controls Tab */}
        <TabsContent value="controls" className="space-y-4">
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

                <Select value={resultFilter} onValueChange={setResultFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Resultado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="APPROVED">Aprobados</SelectItem>
                    <SelectItem value="REJECTED">Rechazados</SelectItem>
                    <SelectItem value="HOLD">En Espera</SelectItem>
                    <SelectItem value="PENDING">Pendientes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Controls Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="hidden md:table-cell">Orden/Lote</TableHead>
                    <TableHead className="hidden sm:table-cell">Parámetro</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead className="hidden lg:table-cell">Inspector</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {controlsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : controls.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <FileCheck className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="mt-2 text-muted-foreground">No hay controles registrados</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    controls.map(control => {
                      const resultConfig = RESULT_CONFIG[control.result];
                      return (
                        <TableRow key={control.id}>
                          <TableCell>
                            {format(new Date(control.inspectedAt), 'dd/MM HH:mm', { locale: es })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{control.controlType}</Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {control.productionOrder ? (
                              <div>
                                <div className="font-medium">{control.productionOrder.code}</div>
                                <div className="text-xs text-muted-foreground">{control.productionOrder.product.name}</div>
                              </div>
                            ) : control.batchLot ? (
                              <div className="font-medium">{control.batchLot.lotCode}</div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {control.parameter ? (
                              <div>
                                <div>{control.parameter}</div>
                                {control.expectedValue && (
                                  <div className="text-xs text-muted-foreground">
                                    Esperado: {control.expectedValue} {control.unit}
                                  </div>
                                )}
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${resultConfig.color} text-white`}>
                              {resultConfig.icon}
                              <span className="ml-1">{resultConfig.label}</span>
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {control.inspectedBy.name}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lots Tab */}
        <TabsContent value="lots" className="space-y-4">
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

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="PENDING">Pendientes</SelectItem>
                    <SelectItem value="APPROVED">Aprobados</SelectItem>
                    <SelectItem value="BLOCKED">Bloqueados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Lots Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Orden</TableHead>
                    <TableHead className="hidden sm:table-cell">Cantidad</TableHead>
                    <TableHead className="hidden md:table-cell">Fecha Prod.</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : lots.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Boxes className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="mt-2 text-muted-foreground">No hay lotes registrados</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    lots.map(lot => {
                      const statusConfig = LOT_STATUS_CONFIG[lot.qualityStatus];
                      return (
                        <TableRow key={lot.id}>
                          <TableCell>
                            <div className="font-medium">{lot.lotCode}</div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{lot.productionOrder.code}</div>
                              <div className="text-xs text-muted-foreground">{lot.productionOrder.product.name}</div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {Number(lot.quantity).toLocaleString()} {lot.uom}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {format(new Date(lot.productionDate), 'dd/MM/yyyy', { locale: es })}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${statusConfig.color} text-white`}>
                              {statusConfig.label}
                            </Badge>
                            {lot.blockedReason && (
                              <p className="text-xs text-destructive mt-1">{lot.blockedReason}</p>
                            )}
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
                                  onClick={() => router.push(`/produccion/calidad/lotes/${lot.id}`)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver detalle
                                </DropdownMenuItem>

                                {canApprove && lot.qualityStatus === 'PENDING' && (
                                  <DropdownMenuItem onClick={() => handleApproveLot(lot)}>
                                    <CheckCircle2 className="h-4 w-4 mr-2 text-success" />
                                    Aprobar
                                  </DropdownMenuItem>
                                )}

                                {canBlockLot && lot.qualityStatus !== 'BLOCKED' && (
                                  <DropdownMenuItem
                                    onClick={() => setBlockDialog({ open: true, lot, reason: '' })}
                                  >
                                    <Lock className="h-4 w-4 mr-2 text-destructive" />
                                    Bloquear
                                  </DropdownMenuItem>
                                )}

                                {canReleaseLot && lot.qualityStatus === 'BLOCKED' && (
                                  <DropdownMenuItem
                                    onClick={() => setReleaseDialog({ open: true, lot })}
                                  >
                                    <Unlock className="h-4 w-4 mr-2 text-success" />
                                    Liberar
                                  </DropdownMenuItem>
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Block Dialog */}
      <Dialog open={blockDialog.open} onOpenChange={(open) => setBlockDialog({ ...blockDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear Lote</DialogTitle>
            <DialogDescription>
              Bloquear el lote {blockDialog.lot?.lotCode}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo del bloqueo *</Label>
              <Textarea
                value={blockDialog.reason}
                onChange={(e) => setBlockDialog({ ...blockDialog, reason: e.target.value })}
                placeholder="Ingrese el motivo del bloqueo..."
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBlockDialog({ open: false, lot: null, reason: '' })}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleBlockLot}
              disabled={!blockDialog.reason}
            >
              <Lock className="h-4 w-4 mr-2" />
              Bloquear
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Release Dialog */}
      <AlertDialog
        open={releaseDialog.open}
        onOpenChange={(open) => setReleaseDialog({ open, lot: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar Lote</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Liberar el lote {releaseDialog.lot?.lotCode}?
              {releaseDialog.lot?.blockedReason && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  <strong>Motivo de bloqueo:</strong> {releaseDialog.lot.blockedReason}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReleaseLot}>
              <Unlock className="h-4 w-4 mr-2" />
              Liberar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
