'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Search, ArrowRight, Package, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Warehouse {
  id: number;
  codigo: string;
  nombre: string;
}

interface StockItem {
  id: number;
  supplierItemId: number;
  supplierItemNombre: string;
  unidad: string;
  cantidad: number;
  cantidadReservada: number;
  disponible: number;
}

interface TransferItem {
  supplierItemId: number;
  supplierItemNombre: string;
  unidad: string;
  disponible: number;
  cantidad: number;
  notas?: string;
}

interface TransferFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const formSchema = z.object({
  warehouseOrigenId: z.string().min(1, 'Seleccione depósito origen'),
  warehouseDestinoId: z.string().min(1, 'Seleccione depósito destino'),
  motivo: z.string().optional(),
  notas: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function TransferFormModal({
  open,
  onOpenChange,
  onSaved,
}: TransferFormModalProps) {
  const [saving, setSaving] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stockOrigen, setStockOrigen] = useState<StockItem[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [items, setItems] = useState<TransferItem[]>([]);
  const [searchItem, setSearchItem] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const warehouseOrigenId = watch('warehouseOrigenId');
  const warehouseDestinoId = watch('warehouseDestinoId');

  // Cargar warehouses
  useEffect(() => {
    async function loadWarehouses() {
      try {
        const res = await fetch('/api/compras/depositos');
        if (res.ok) {
          const data = await res.json();
          setWarehouses((data.data || data).filter((w: any) => !w.isTransit));
        }
      } catch (error) {
        console.error('Error loading warehouses:', error);
      }
    }
    if (open) {
      loadWarehouses();
    }
  }, [open]);

  // Cargar stock del depósito origen
  useEffect(() => {
    async function loadStock() {
      if (!warehouseOrigenId) {
        setStockOrigen([]);
        return;
      }
      setLoadingStock(true);
      try {
        const res = await fetch(`/api/compras/stock?warehouseId=${warehouseOrigenId}&limit=500`);
        if (res.ok) {
          const data = await res.json();
          setStockOrigen(data.data || []);
        }
      } catch (error) {
        console.error('Error loading stock:', error);
      } finally {
        setLoadingStock(false);
      }
    }
    loadStock();
    setItems([]); // Limpiar items al cambiar origen
  }, [warehouseOrigenId]);

  // Filtrar stock para búsqueda
  const filteredStock = stockOrigen.filter(
    (s) =>
      s.disponible > 0 &&
      !items.some((i) => i.supplierItemId === s.supplierItemId) &&
      (searchItem.length < 2 ||
        s.supplierItemNombre.toLowerCase().includes(searchItem.toLowerCase()))
  );

  // Agregar item a la transferencia
  const addItem = (stockItem: StockItem) => {
    setItems([
      ...items,
      {
        supplierItemId: stockItem.supplierItemId,
        supplierItemNombre: stockItem.supplierItemNombre,
        unidad: stockItem.unidad,
        disponible: stockItem.disponible,
        cantidad: stockItem.disponible, // Por defecto transferir todo
      },
    ]);
    setSearchItem('');
  };

  // Actualizar cantidad
  const updateItemQuantity = (index: number, cantidad: number) => {
    const newItems = [...items];
    newItems[index].cantidad = Math.min(cantidad, newItems[index].disponible);
    setItems(newItems);
  };

  // Eliminar item
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      reset();
      setItems([]);
      setSearchItem('');
      setStockOrigen([]);
    }
  }, [open, reset]);

  const onSubmit = async (data: FormData) => {
    if (items.length === 0) {
      toast.error('Debe agregar al menos un item');
      return;
    }

    if (data.warehouseOrigenId === data.warehouseDestinoId) {
      toast.error('El depósito origen y destino deben ser diferentes');
      return;
    }

    // Validar cantidades
    const itemsInvalidos = items.filter((i) => i.cantidad <= 0 || i.cantidad > i.disponible);
    if (itemsInvalidos.length > 0) {
      toast.error('Hay items con cantidades inválidas');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/compras/stock/transferencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseOrigenId: data.warehouseOrigenId,
          warehouseDestinoId: data.warehouseDestinoId,
          motivo: data.motivo || null,
          notas: data.notas || null,
          items: items.map((i) => ({
            supplierItemId: i.supplierItemId,
            cantidad: i.cantidad,
            notas: i.notas,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear la transferencia');
      }

      const transfer = await response.json();
      toast.success(`Transferencia ${transfer.numero} creada correctamente`);
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      console.error('Error saving transfer:', error);
      toast.error(error instanceof Error ? error.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const warehouseOrigenNombre = warehouses.find((w) => String(w.id) === warehouseOrigenId)?.codigo;
  const warehouseDestinoNombre = warehouses.find((w) => String(w.id) === warehouseDestinoId)?.codigo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Nueva Transferencia
          </DialogTitle>
          <DialogDescription>
            Transfiera mercadería entre depósitos
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Depósitos */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Depósito Origen *</Label>
              <Select
                value={warehouseOrigenId}
                onValueChange={(v) => setValue('warehouseOrigenId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar origen" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses
                    .filter((w) => String(w.id) !== warehouseDestinoId)
                    .map((wh) => (
                      <SelectItem key={wh.id} value={String(wh.id)}>
                        {wh.codigo} - {wh.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {errors.warehouseOrigenId && (
                <p className="text-xs text-destructive">{errors.warehouseOrigenId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Depósito Destino *</Label>
              <Select
                value={warehouseDestinoId}
                onValueChange={(v) => setValue('warehouseDestinoId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar destino" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses
                    .filter((w) => String(w.id) !== warehouseOrigenId)
                    .map((wh) => (
                      <SelectItem key={wh.id} value={String(wh.id)}>
                        {wh.codigo} - {wh.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {errors.warehouseDestinoId && (
                <p className="text-xs text-destructive">{errors.warehouseDestinoId.message}</p>
              )}
            </div>
          </div>

          {/* Indicador de flujo */}
          {warehouseOrigenId && warehouseDestinoId && (
            <div className="flex items-center justify-center gap-4 py-2 bg-muted/50 rounded-lg">
              <Badge variant="outline">{warehouseOrigenNombre}</Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline">{warehouseDestinoNombre}</Badge>
            </div>
          )}

          {/* Motivo */}
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Input
              placeholder="Motivo de la transferencia (opcional)"
              {...register('motivo')}
            />
          </div>

          {/* Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Items a Transferir</Label>
              <Badge variant="secondary">{items.length} items</Badge>
            </div>

            {/* Buscar y agregar item */}
            {warehouseOrigenId && (
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar item con stock disponible..."
                      value={searchItem}
                      onChange={(e) => setSearchItem(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                {loadingStock ? (
                  <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-lg p-4 text-center">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  </div>
                ) : filteredStock.length > 0 && searchItem.length >= 2 ? (
                  <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
                    {filteredStock.slice(0, 10).map((item) => (
                      <button
                        key={item.supplierItemId}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-accent text-sm flex items-center justify-between"
                        onClick={() => addItem(item)}
                      >
                        <div>
                          <div className="font-medium">{item.supplierItemNombre}</div>
                        </div>
                        <Badge variant="outline" className="text-green-600">
                          Disp: {item.disponible} {item.unidad}
                        </Badge>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {/* Tabla de items */}
            {items.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right w-24">Disponible</TableHead>
                      <TableHead className="text-right w-32">Cantidad</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={item.supplierItemId}>
                        <TableCell>
                          <div className="font-medium">{item.supplierItemNombre}</div>
                          <div className="text-xs text-muted-foreground">{item.unidad}</div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.disponible.toLocaleString('es-AR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={item.disponible}
                            value={item.cantidad}
                            onChange={(e) =>
                              updateItemQuantity(index, parseFloat(e.target.value) || 0)
                            }
                            className="w-24 text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="border rounded-lg p-8 text-center text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>
                  {warehouseOrigenId
                    ? 'Busque items para agregar a la transferencia'
                    : 'Seleccione un depósito origen'}
                </p>
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label>Notas adicionales</Label>
            <Textarea placeholder="Notas adicionales (opcional)" {...register('notas')} rows={2} />
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3 flex gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <p>
                La transferencia se creará en estado <strong>Borrador</strong>. Luego deberá
                enviarla para que el stock pase a &quot;En Tránsito&quot; y finalmente recibirla en
                destino.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || items.length === 0}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear Transferencia
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
