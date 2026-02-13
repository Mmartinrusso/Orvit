'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Loader2,
  Package,
  Plus,
  Minus,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  RotateCcw,
  History,
  TrendingUp,
  TrendingDown,
  User,
  Calendar,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface StockMovement {
  id: string;
  productId: string;
  companyId: number;
  tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  cantidad: number;
  stockAnterior: number;
  stockPosterior: number;
  sourceType: string | null;
  sourceId: string | null;
  sourceNumber: string | null;
  motivo: string | null;
  notas: string | null;
  createdBy: number;
  createdAt: string;
  user?: { id: number; name: string };
}

interface ProductStockHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  currentStock: number;
  unit: string;
  onStockUpdated?: () => void;
}

export function ProductStockHistory({
  open,
  onOpenChange,
  productId,
  productName,
  currentStock,
  unit,
  onStockUpdated,
}: ProductStockHistoryProps) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [tipo, setTipo] = useState<'ENTRADA' | 'SALIDA' | 'AJUSTE'>('ENTRADA');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [notas, setNotas] = useState('');

  useEffect(() => {
    if (open && productId) {
      loadMovements();
    }
  }, [open, productId]);

  const loadMovements = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/products/${productId}/stock-movements?limit=100`);
      if (!response.ok) throw new Error('Error cargando movimientos');
      const data = await response.json();
      setMovements(data.movements || []);
    } catch (error) {
      console.error('Error loading movements:', error);
      toast.error('Error al cargar el historial de stock');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cantidad || parseFloat(cantidad) <= 0) {
      toast.error('Ingresa una cantidad valida');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/products/${productId}/stock-movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          cantidad: parseFloat(cantidad),
          motivo: motivo || null,
          notas: notas || null,
          sourceType: 'MANUAL',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al registrar movimiento');
      }

      toast.success('Movimiento de stock registrado');
      setCantidad('');
      setMotivo('');
      setNotas('');
      setShowAddForm(false);
      loadMovements();
      onStockUpdated?.();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getMovementIcon = (tipo: string) => {
    switch (tipo) {
      case 'ENTRADA':
        return <ArrowUpCircle className="w-5 h-5 text-green-600" />;
      case 'SALIDA':
        return <ArrowDownCircle className="w-5 h-5 text-red-600" />;
      case 'AJUSTE':
        return <RotateCcw className="w-5 h-5 text-blue-600" />;
      default:
        return <Package className="w-5 h-5" />;
    }
  };

  const getMovementColor = (tipo: string) => {
    switch (tipo) {
      case 'ENTRADA':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'SALIDA':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'AJUSTE':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  const getSourceLabel = (sourceType: string | null) => {
    switch (sourceType) {
      case 'SALE':
        return 'Venta';
      case 'RETURN':
        return 'Devolucion';
      case 'ADJUSTMENT':
        return 'Ajuste';
      case 'PRODUCTION':
        return 'Produccion';
      case 'MANUAL':
        return 'Manual';
      default:
        return sourceType || 'Desconocido';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Historial de Stock
          </DialogTitle>
          <DialogDescription>
            {productName} - Stock actual: {currentStock} {unit}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex-1 overflow-y-auto space-y-4">
          {/* Boton para agregar movimiento */}
          {!showAddForm && (
            <Button
              onClick={() => setShowAddForm(true)}
              className="w-full"
              variant="outline"
            >
              <Plus className="w-4 h-4 mr-2" />
              Registrar Movimiento Manual
            </Button>
          )}

          {/* Formulario de nuevo movimiento */}
          {showAddForm && (
            <Card>
              <CardContent className="pt-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Tipo de Movimiento</Label>
                      <Select
                        value={tipo}
                        onValueChange={(value) => setTipo(value as any)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ENTRADA">
                            <div className="flex items-center gap-2">
                              <ArrowUpCircle className="w-4 h-4 text-green-600" />
                              Entrada
                            </div>
                          </SelectItem>
                          <SelectItem value="SALIDA">
                            <div className="flex items-center gap-2">
                              <ArrowDownCircle className="w-4 h-4 text-red-600" />
                              Salida
                            </div>
                          </SelectItem>
                          <SelectItem value="AJUSTE">
                            <div className="flex items-center gap-2">
                              <RotateCcw className="w-4 h-4 text-blue-600" />
                              Ajuste (valor absoluto)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="cantidad">
                        {tipo === 'AJUSTE' ? 'Nuevo Stock' : 'Cantidad'}
                      </Label>
                      <Input
                        id="cantidad"
                        type="number"
                        min="0"
                        step="0.01"
                        value={cantidad}
                        onChange={(e) => setCantidad(e.target.value)}
                        placeholder={tipo === 'AJUSTE' ? 'Nuevo valor de stock' : 'Cantidad'}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="motivo">Motivo</Label>
                    <Input
                      id="motivo"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Ej: Compra de mercaderia, Inventario fisico, etc."
                    />
                  </div>

                  <div>
                    <Label htmlFor="notas">Notas adicionales</Label>
                    <Textarea
                      id="notas"
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Observaciones..."
                      rows={2}
                    />
                  </div>

                  {/* Preview del cambio */}
                  {cantidad && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Vista previa:</p>
                      <p className="font-medium">
                        Stock: {currentStock} {unit} {' -> '}
                        {tipo === 'AJUSTE'
                          ? parseFloat(cantidad)
                          : tipo === 'ENTRADA'
                          ? currentStock + parseFloat(cantidad)
                          : currentStock - parseFloat(cantidad)}{' '}
                        {unit}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowAddForm(false);
                        setCantidad('');
                        setMotivo('');
                        setNotas('');
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Registrar Movimiento
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Lista de movimientos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <History className="w-4 h-4" />
                Movimientos Recientes
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMovements}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : movements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No hay movimientos registrados</p>
              </div>
            ) : (
              <div className="space-y-2">
                {movements.map((movement) => (
                  <div
                    key={movement.id}
                    className={`p-3 rounded-lg border ${getMovementColor(movement.tipo)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getMovementIcon(movement.tipo)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{movement.tipo}</span>
                            <Badge variant="outline" className="text-xs">
                              {getSourceLabel(movement.sourceType)}
                            </Badge>
                          </div>
                          <div className="text-sm mt-1">
                            <span className="text-muted-foreground">
                              {movement.stockAnterior} {unit}
                            </span>
                            {' -> '}
                            <span className="font-medium">
                              {movement.stockPosterior} {unit}
                            </span>
                            <span className="ml-2">
                              ({movement.tipo === 'SALIDA' ? '-' : '+'}
                              {Math.abs(movement.cantidad)})
                            </span>
                          </div>
                          {movement.motivo && (
                            <p className="text-sm mt-1">{movement.motivo}</p>
                          )}
                          {movement.notas && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {movement.notas}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-right text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(movement.createdAt), 'dd/MM/yyyy HH:mm', {
                            locale: es,
                          })}
                        </div>
                        {movement.user && (
                          <div className="flex items-center gap-1 mt-1">
                            <User className="w-3 h-3" />
                            {movement.user.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
