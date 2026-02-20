'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
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
import {
  Package,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Link2,
  Unlink,
  RefreshCw,
  Boxes,
  ArrowDownCircle,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { RecipeInputLinker } from './input-item-linker';

interface MaterialRequirement {
  inputItemId: string;
  inputItemName: string;
  supplierItemId: number | null;
  supplierItemName: string | null;
  quantityPerUnit: number;
  totalQuantity: number;
  unit: string;
  conversionFactor: number;
  available?: number;
  hasStock: boolean;
}

interface ConsumptionSummary {
  totalConsumed: Array<{
    supplierItemId: number;
    supplierItemName: string;
    totalQuantity: number;
    unit: string;
  }>;
  byReport: Array<{
    reportId: number;
    date: string;
    producedQty: number;
    consumptions: Array<{
      supplierItemId: number;
      quantity: number;
    }>;
  }>;
}

interface Warehouse {
  id: number;
  nombre: string;
  codigo: string;
}

interface StockConsumptionPanelProps {
  productionOrderId: number;
  recipeId?: string;
  companyId: number;
  status: string;
  quantity: number;
}

export function StockConsumptionPanel({
  productionOrderId,
  recipeId,
  companyId,
  status,
  quantity,
}: StockConsumptionPanelProps) {
  const [loading, setLoading] = useState(true);
  const [requirements, setRequirements] = useState<MaterialRequirement[]>([]);
  const [summary, setSummary] = useState<ConsumptionSummary | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [showLinkerDialog, setShowLinkerDialog] = useState(false);

  // Fetch material requirements
  const fetchRequirements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        productionOrderId: String(productionOrderId),
        action: 'requirements',
      });

      if (selectedWarehouse) {
        params.append('warehouseId', selectedWarehouse);
      }

      const res = await fetch(`/api/production/stock-consumption?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRequirements(data.requirements || []);
      }
    } catch (error) {
      console.error('Error fetching requirements:', error);
    } finally {
      setLoading(false);
    }
  }, [productionOrderId, selectedWarehouse]);

  // Fetch consumption summary
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/production/stock-consumption?productionOrderId=${productionOrderId}&action=summary`
      );
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  }, [productionOrderId]);

  // Fetch warehouses
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await fetch(`/api/warehouses?companyId=${companyId}`);
        if (res.ok) {
          const data = await res.json();
          setWarehouses(data.warehouses || data || []);
        }
      } catch (error) {
        console.error('Error fetching warehouses:', error);
      }
    };

    fetchWarehouses();
  }, [companyId]);

  useEffect(() => {
    fetchRequirements();
    fetchSummary();
  }, [fetchRequirements, fetchSummary]);

  const linkedCount = requirements.filter((r) => r.supplierItemId).length;
  const allLinked = linkedCount === requirements.length && requirements.length > 0;

  const hasInsufficientStock = requirements.some(
    (r) => r.available !== undefined && r.totalQuantity > r.available
  );

  if (!recipeId) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Sin Receta Asignada</h3>
            <p className="text-sm text-muted-foreground">
              Esta orden de producción no tiene una receta asignada.
              El consumo de stock no está disponible.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Insumos Vinculados
                </p>
                <p className="text-2xl font-bold">
                  {linkedCount}/{requirements.length}
                </p>
              </div>
              <div
                className={cn('h-10 w-10 rounded-full flex items-center justify-center',
                  allLinked ? 'bg-success-muted' : 'bg-warning-muted'
                )}
              >
                {allLinked ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <Link2 className="h-5 w-5 text-warning-muted-foreground" />
                )}
              </div>
            </div>
            {!allLinked && (
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto mt-2 text-warning-muted-foreground"
                onClick={() => setShowLinkerDialog(true)}
              >
                Vincular insumos faltantes
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Consumido
                </p>
                <p className="text-2xl font-bold">
                  {summary?.totalConsumed.length || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  items de {summary?.byReport.length || 0} reportes
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-info-muted flex items-center justify-center">
                <ArrowDownCircle className="h-5 w-5 text-info-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Stock
                </p>
                <p className="text-2xl font-bold">
                  {hasInsufficientStock ? (
                    <span className="text-destructive">Insuficiente</span>
                  ) : selectedWarehouse ? (
                    <span className="text-success">OK</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </p>
              </div>
              <div
                className={cn('h-10 w-10 rounded-full flex items-center justify-center',
                  hasInsufficientStock ? 'bg-destructive/10' : 'bg-success-muted'
                )}
              >
                {hasInsufficientStock ? (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                ) : (
                  <Boxes className="h-5 w-5 text-success" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requirements Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Requerimientos de Material</CardTitle>
            <CardDescription>
              Insumos necesarios para producir {quantity.toLocaleString()} unidades
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Verificar en depósito" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin seleccionar</SelectItem>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={String(wh.id)}>
                    {wh.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchRequirements}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando requerimientos...
            </div>
          ) : requirements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay requerimientos de material definidos en la receta
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo (Receta)</TableHead>
                  <TableHead>Item Inventario</TableHead>
                  <TableHead className="text-right">Necesario</TableHead>
                  {selectedWarehouse && (
                    <TableHead className="text-right">Disponible</TableHead>
                  )}
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requirements.map((req) => {
                  const insufficient =
                    req.available !== undefined && req.totalQuantity > req.available;

                  return (
                    <TableRow key={req.inputItemId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{req.inputItemName}</p>
                          <p className="text-xs text-muted-foreground">
                            {req.quantityPerUnit.toFixed(4)} por unidad
                            {req.conversionFactor !== 1 && (
                              <span> · Factor: {req.conversionFactor}</span>
                            )}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {req.supplierItemId ? (
                          <div>
                            <p className="font-medium text-success">
                              {req.supplierItemName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              ID: {req.supplierItemId}
                            </p>
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-warning-muted text-warning-muted-foreground cursor-pointer"
                            onClick={() => setShowLinkerDialog(true)}
                          >
                            <Unlink className="h-3 w-3 mr-1" />
                            Sin vincular
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {req.totalQuantity.toFixed(2)} {req.unit}
                      </TableCell>
                      {selectedWarehouse && (
                        <TableCell className="text-right font-mono">
                          {req.available !== undefined ? (
                            <span
                              className={
                                insufficient ? 'text-destructive' : 'text-success'
                              }
                            >
                              {req.available.toFixed(2)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        {!req.supplierItemId ? (
                          <Badge className="bg-warning-muted text-warning-muted-foreground">
                            Sin Link
                          </Badge>
                        ) : insufficient ? (
                          <Badge className="bg-destructive/10 text-destructive">
                            Insuficiente
                          </Badge>
                        ) : (
                          <Badge className="bg-success-muted text-success">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Consumption Summary */}
      {summary && summary.totalConsumed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowDownCircle className="h-5 w-5" />
              Consumo Acumulado
            </CardTitle>
            <CardDescription>
              Total consumido en {summary.byReport.length} reportes de producción
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Cantidad Consumida</TableHead>
                  <TableHead>Unidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.totalConsumed.map((item) => (
                  <TableRow key={item.supplierItemId}>
                    <TableCell className="font-medium">
                      {item.supplierItemName}
                    </TableCell>
                    <TableCell className="text-right font-mono text-destructive">
                      -{item.totalQuantity.toFixed(2)}
                    </TableCell>
                    <TableCell>{item.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Not linked warning */}
      {!allLinked && (
        <div className="flex items-start gap-3 p-4 bg-warning-muted rounded-lg border border-warning-muted">
          <AlertCircle className="h-5 w-5 text-warning-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium text-warning-muted-foreground">
              Insumos sin vincular
            </p>
            <p className="text-sm text-warning-muted-foreground mt-1">
              Hay {requirements.length - linkedCount} insumo(s) de la receta que no
              están vinculados a items del inventario. El consumo automático de stock
              no funcionará para estos items.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 border-warning-muted text-warning-muted-foreground hover:bg-warning-muted"
              onClick={() => setShowLinkerDialog(true)}
            >
              <Link2 className="h-4 w-4 mr-2" />
              Vincular Insumos
            </Button>
          </div>
        </div>
      )}

      {/* Linker Dialog */}
      <Dialog open={showLinkerDialog} onOpenChange={setShowLinkerDialog}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Vincular Insumos a Inventario</DialogTitle>
            <DialogDescription>
              Conecta los insumos de la receta con los items del inventario para
              habilitar el consumo automático de stock.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
          {recipeId && (
            <RecipeInputLinker
              recipeId={recipeId}
              companyId={companyId}
              onAllLinked={() => {
                fetchRequirements();
                setShowLinkerDialog(false);
                toast.success('Todos los insumos fueron vinculados');
              }}
            />
          )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkerDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// CONSUME STOCK DIALOG - For daily reports
// ============================================
interface ConsumeStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dailyReportId: number;
  productionOrderCode: string;
  producedQuantity: number;
  companyId: number;
  onSuccess: () => void;
}

export function ConsumeStockDialog({
  open,
  onOpenChange,
  dailyReportId,
  productionOrderCode,
  producedQuantity,
  companyId,
  onSuccess,
}: ConsumeStockDialogProps) {
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [allowNegative, setAllowNegative] = useState(false);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await fetch(`/api/warehouses?companyId=${companyId}`);
        if (res.ok) {
          const data = await res.json();
          setWarehouses(data.warehouses || data || []);
        }
      } catch (error) {
        console.error('Error fetching warehouses:', error);
      }
    };

    if (open) {
      fetchWarehouses();
    }
  }, [open, companyId]);

  const handleConsume = async () => {
    if (!selectedWarehouse) {
      toast.error('Seleccione un depósito');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/production/stock-consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyReportId,
          warehouseId: Number(selectedWarehouse),
          userId: 1, // TODO: Get from auth
          allowNegative,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Stock consumido correctamente (${data.movements?.length || 0} movimientos)`);
        if (data.warnings?.length > 0) {
          data.warnings.forEach((w: string) => toast.warning(w));
        }
        onSuccess();
        onOpenChange(false);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error al consumir stock');
      }
    } catch (error) {
      toast.error('Error al consumir stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5 text-info" />
            Consumir Stock
          </DialogTitle>
          <DialogDescription>
            Registrar consumo de materiales para la producción reportada.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Orden:</strong> {productionOrderCode}
            </p>
            <p className="text-sm">
              <strong>Cantidad Producida:</strong> {producedQuantity.toLocaleString()}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Depósito de Origen</label>
            <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar depósito" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={String(wh.id)}>
                    {wh.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allowNegative"
              checked={allowNegative}
              onChange={(e) => setAllowNegative(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="allowNegative" className="text-sm">
              Permitir stock negativo
            </label>
          </div>

          <div className="p-3 bg-info-muted text-info-muted-foreground rounded-lg text-sm">
            <p>
              El consumo se calculará automáticamente según la receta de la orden
              de producción y la cantidad reportada.
            </p>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConsume} disabled={loading || !selectedWarehouse}>
            <ArrowDownCircle className="h-4 w-4 mr-2" />
            Consumir Stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// REVERSE CONSUMPTION DIALOG
// ============================================
interface ReverseConsumptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dailyReportId: number;
  onSuccess: () => void;
}

export function ReverseConsumptionDialog({
  open,
  onOpenChange,
  dailyReportId,
  onSuccess,
}: ReverseConsumptionDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleReverse = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/production/stock-consumption', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyReportId,
          userId: 1, // TODO: Get from auth
        }),
      });

      if (res.ok) {
        toast.success('Consumo revertido correctamente');
        onSuccess();
        onOpenChange(false);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error al revertir consumo');
      }
    } catch (error) {
      toast.error('Error al revertir consumo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-warning" />
            Revertir Consumo de Stock
          </AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción revertirá todos los movimientos de stock asociados a este
            reporte de producción. El stock será restaurado a los valores anteriores.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleReverse} disabled={loading}>
            {loading ? 'Procesando...' : 'Revertir Consumo'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
