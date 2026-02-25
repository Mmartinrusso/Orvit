'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
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
import { Loader2, Plus, Trash2, Search, Package } from 'lucide-react';
import { useWarehouses, useInventario, useTransferenciasMutations } from '../hooks';
import { useToast } from '@/hooks/use-toast';
import { cn, formatNumber } from '@/lib/utils';

interface TransferItem {
  supplierItemId: number;
  nombre: string;
  codigo: string;
  unidad: string;
  disponible: number;
  cantidad: string;
  notas: string;
}

interface TransferenciaFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Modal para crear una nueva transferencia de stock entre depósitos
 */
export function TransferenciaFormModal({
  open,
  onClose,
  onSuccess,
}: TransferenciaFormModalProps) {
  const { toast } = useToast();
  const { data: warehouses = [] } = useWarehouses();
  const { create } = useTransferenciasMutations();

  const [formData, setFormData] = useState({
    warehouseOrigenId: '',
    warehouseDestinoId: '',
    motivo: '',
    notas: '',
  });

  const [items, setItems] = useState<TransferItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showItemSearch, setShowItemSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar depósitos: excluir los de tránsito
  const nonTransitWarehouses = warehouses.filter((w) => !w.isTransit);

  // Depósitos disponibles para destino: excluir tránsito y el seleccionado como origen
  const destinoWarehouses = nonTransitWarehouses.filter(
    (w) => w.id.toString() !== formData.warehouseOrigenId
  );

  // Cargar inventario del depósito origen seleccionado
  const { data: inventarioData } = useInventario({
    filters: {
      warehouseId: formData.warehouseOrigenId ? Number(formData.warehouseOrigenId) : undefined,
    },
    pagination: { page: 1, pageSize: 100 },
    enabled: !!formData.warehouseOrigenId,
  });

  const inventarioItems = inventarioData?.items || [];

  // Items disponibles para agregar (excluir los ya agregados)
  const availableItems = inventarioItems.filter(
    (item: any) =>
      !items.some((i) => i.supplierItemId === (item.supplierItemId || item.supplierItem?.id)) &&
      (item.stockDisponible ?? 0) > 0
  );

  // Filtrar por término de búsqueda
  const filteredAvailableItems = searchTerm
    ? availableItems.filter((item: any) => {
        const nombre = (item.supplierItem?.nombre || '').toLowerCase();
        const codigo = (item.supplierItem?.codigoProveedor || '').toLowerCase();
        const term = searchTerm.toLowerCase();
        return nombre.includes(term) || codigo.includes(term);
      })
    : availableItems;

  // Reset form cuando se cierra el modal
  useEffect(() => {
    if (!open) {
      setFormData({
        warehouseOrigenId: '',
        warehouseDestinoId: '',
        motivo: '',
        notas: '',
      });
      setItems([]);
      setIsSubmitting(false);
      setShowItemSearch(false);
      setSearchTerm('');
    }
  }, [open]);

  // Agregar item a la transferencia
  const handleAddItem = useCallback(
    (item: any) => {
      const supplierItemId = item.supplierItemId || item.supplierItem?.id;

      if (items.some((i) => i.supplierItemId === supplierItemId)) {
        toast({
          title: 'Item ya agregado',
          description: 'Este item ya está en la lista',
          variant: 'destructive',
        });
        return;
      }

      setItems((prev) => [
        ...prev,
        {
          supplierItemId,
          nombre: item.supplierItem?.nombre || item.nombre || '',
          codigo: item.supplierItem?.codigoProveedor || item.codigo || '',
          unidad: item.supplierItem?.unidad || item.unidad || '',
          disponible: item.stockDisponible ?? 0,
          cantidad: '1',
          notas: '',
        },
      ]);
      setShowItemSearch(false);
      setSearchTerm('');
    },
    [items, toast]
  );

  // Actualizar cantidad de un item
  const handleUpdateQuantity = useCallback((supplierItemId: number, value: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.supplierItemId === supplierItemId ? { ...item, cantidad: value } : item
      )
    );
  }, []);

  // Remover item
  const handleRemoveItem = useCallback((supplierItemId: number) => {
    setItems((prev) => prev.filter((item) => item.supplierItemId !== supplierItemId));
  }, []);

  // Validar antes de enviar
  const validateForm = useCallback(() => {
    if (!formData.warehouseOrigenId) {
      toast({ title: 'Error', description: 'Seleccione un depósito de origen', variant: 'destructive' });
      return false;
    }
    if (!formData.warehouseDestinoId) {
      toast({ title: 'Error', description: 'Seleccione un depósito de destino', variant: 'destructive' });
      return false;
    }
    if (formData.warehouseOrigenId === formData.warehouseDestinoId) {
      toast({ title: 'Error', description: 'Los depósitos de origen y destino deben ser diferentes', variant: 'destructive' });
      return false;
    }
    if (items.length === 0) {
      toast({ title: 'Error', description: 'Agregue al menos un item', variant: 'destructive' });
      return false;
    }
    for (const item of items) {
      const cantidad = parseFloat(item.cantidad);
      if (!cantidad || cantidad <= 0) {
        toast({
          title: 'Cantidad inválida',
          description: `${item.nombre}: la cantidad debe ser mayor a 0`,
          variant: 'destructive',
        });
        return false;
      }
      if (cantidad > item.disponible) {
        toast({
          title: 'Stock insuficiente',
          description: `${item.nombre}: disponible ${formatNumber(item.disponible, 2)}, solicitado ${formatNumber(cantidad, 2)}`,
          variant: 'destructive',
        });
        return false;
      }
    }
    return true;
  }, [formData, items, toast]);

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await create.mutateAsync({
        warehouseOrigenId: parseInt(formData.warehouseOrigenId),
        warehouseDestinoId: parseInt(formData.warehouseDestinoId),
        motivo: formData.motivo || undefined,
        notas: formData.notas || undefined,
        items: items.map((i) => ({
          supplierItemId: i.supplierItemId,
          cantidad: parseFloat(i.cantidad),
        })),
      });
      toast({ title: 'Transferencia creada correctamente' });
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al crear transferencia',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verificar si hay items con cantidad excedida
  const hasOverstock = items.some((i) => {
    const cantidad = parseFloat(i.cantidad);
    return cantidad > i.disponible;
  });

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva Transferencia</DialogTitle>
          <DialogDescription>
            Transferir stock entre depósitos
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {/* Depósito Origen y Destino */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="warehouseOrigen">Depósito Origen *</Label>
              <Select
                value={formData.warehouseOrigenId}
                onValueChange={(v) => {
                  setFormData((prev) => ({
                    ...prev,
                    warehouseOrigenId: v,
                    // Limpiar destino si coincide con el nuevo origen
                    warehouseDestinoId:
                      prev.warehouseDestinoId === v ? '' : prev.warehouseDestinoId,
                  }));
                  setItems([]); // Limpiar items al cambiar depósito origen
                  setShowItemSearch(false);
                  setSearchTerm('');
                }}
              >
                <SelectTrigger id="warehouseOrigen" className="h-10">
                  <SelectValue placeholder="Seleccionar depósito" />
                </SelectTrigger>
                <SelectContent>
                  {nonTransitWarehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id.toString()}>
                      {w.nombre} ({w.codigo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="warehouseDestino">Depósito Destino *</Label>
              <Select
                value={formData.warehouseDestinoId}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, warehouseDestinoId: v }))
                }
              >
                <SelectTrigger id="warehouseDestino" className="h-10">
                  <SelectValue placeholder="Seleccionar depósito" />
                </SelectTrigger>
                <SelectContent>
                  {destinoWarehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id.toString()}>
                      {w.nombre} ({w.codigo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo</Label>
            <Input
              id="motivo"
              value={formData.motivo}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, motivo: e.target.value }))
              }
              placeholder="Ej: Reabastecimiento, redistribución..."
              className="h-10"
            />
          </div>

          {/* Items Section */}
          <div className="space-y-3 border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Items a transferir *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowItemSearch(!showItemSearch)}
                disabled={!formData.warehouseOrigenId}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar Item
              </Button>
            </div>

            {/* Búsqueda de items */}
            {showItemSearch && formData.warehouseOrigenId && (
              <div className="border rounded-md p-3 bg-muted/30 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o código..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                    autoFocus
                  />
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {filteredAvailableItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {searchTerm
                        ? 'No se encontraron items'
                        : availableItems.length === 0
                          ? 'No hay items disponibles en este depósito'
                          : 'Escriba para buscar'}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {filteredAvailableItems.map((item: any) => (
                        <div
                          key={item.supplierItemId || item.supplierItem?.id}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer"
                          onClick={() => handleAddItem(item)}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {item.supplierItem?.nombre}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.supplierItem?.codigoProveedor}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {formatNumber(item.stockDisponible, 2)}{' '}
                              {item.supplierItem?.unidad}
                            </p>
                            <p className="text-xs text-muted-foreground">disponible</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Lista de items seleccionados */}
            {items.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="w-[70px]">Unidad</TableHead>
                    <TableHead className="text-right w-[100px]">Disponible</TableHead>
                    <TableHead className="text-right w-[120px]">Cantidad</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const cantidad = parseFloat(item.cantidad);
                    const exceedsStock = cantidad > item.disponible;

                    return (
                      <TableRow key={item.supplierItemId}>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{item.codigo}</span>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{item.nombre}</p>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{item.unidad}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(exceedsStock && 'text-destructive')}
                          >
                            {formatNumber(item.disponible, 2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={item.disponible}
                            value={item.cantidad}
                            onChange={(e) =>
                              handleUpdateQuantity(item.supplierItemId, e.target.value)
                            }
                            className={cn(
                              'w-full text-right',
                              exceedsStock && 'border-destructive'
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.supplierItemId)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <Package className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">No hay items agregados</p>
                <p className="text-xs">
                  {formData.warehouseOrigenId
                    ? 'Use el botón "Agregar Item" para buscar'
                    : 'Seleccione un depósito de origen primero'}
                </p>
              </div>
            )}

            {/* Warning si hay items con stock insuficiente */}
            {hasOverstock && (
              <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/30 rounded-md text-destructive">
                <span className="text-sm">
                  Algunos items exceden el stock disponible
                </span>
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              value={formData.notas}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notas: e.target.value }))
              }
              placeholder="Observaciones adicionales..."
              rows={3}
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || items.length === 0}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear Transferencia ({items.length} {items.length === 1 ? 'item' : 'items'})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
