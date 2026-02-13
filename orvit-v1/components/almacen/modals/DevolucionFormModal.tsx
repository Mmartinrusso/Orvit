'use client';

import { useState, useCallback, useEffect } from 'react';
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
import { Loader2, Plus, Trash2, Search, RotateCcw } from 'lucide-react';
import { useDevolucionesMutations, useWarehouses, useInventario } from '../hooks';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface DevolucionItem {
  supplierItemId: number;
  nombre: string;
  codigo: string;
  unidad: string;
  cantidadDevuelta: number;
}

interface DevolucionFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  despachoId?: number;
  // Para devolución rápida desde inventario
  preselectedItem?: {
    supplierItemId: number;
    warehouseId: number;
    nombre: string;
    codigo: string;
    unidad: string;
    stockDisponible: number;
  };
}

/**
 * Modal para crear devolución con selección de items
 */
export function DevolucionFormModal({
  open,
  onClose,
  onSuccess,
  despachoId,
  preselectedItem,
}: DevolucionFormModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: warehouses = [] } = useWarehouses();
  const { create } = useDevolucionesMutations();

  const [formData, setFormData] = useState({
    warehouseId: preselectedItem?.warehouseId?.toString() || '',
    motivo: '',
    notas: '',
  });

  const [items, setItems] = useState<DevolucionItem[]>(
    preselectedItem
      ? [
          {
            supplierItemId: preselectedItem.supplierItemId,
            nombre: preselectedItem.nombre,
            codigo: preselectedItem.codigo,
            unidad: preselectedItem.unidad,
            cantidadDevuelta: 1,
          },
        ]
      : []
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [showItemSearch, setShowItemSearch] = useState(false);

  // Efecto para cargar item preseleccionado cuando se abre el modal
  useEffect(() => {
    if (open && preselectedItem) {
      setFormData((prev) => ({
        ...prev,
        warehouseId: preselectedItem.warehouseId?.toString() || prev.warehouseId,
      }));
      setItems([
        {
          supplierItemId: preselectedItem.supplierItemId,
          nombre: preselectedItem.nombre,
          codigo: preselectedItem.codigo,
          unidad: preselectedItem.unidad,
          cantidadDevuelta: 1,
        },
      ]);
    }
  }, [open, preselectedItem]);

  // Reset form cuando se cierra el modal
  useEffect(() => {
    if (!open) {
      setItems([]);
      setFormData({ warehouseId: '', motivo: '', notas: '' });
      setSearchTerm('');
      setShowItemSearch(false);
    }
  }, [open]);

  // Cargar inventario del depósito seleccionado para buscar items
  const { data: inventarioData } = useInventario({
    filters: {
      warehouseId: formData.warehouseId ? Number(formData.warehouseId) : undefined,
      search: searchTerm,
    },
    pagination: { page: 1, pageSize: 20 },
    enabled: !!formData.warehouseId && showItemSearch,
  });

  const inventarioItems = inventarioData?.items || [];

  // Agregar item a la devolución
  const handleAddItem = useCallback((item: any) => {
    // Verificar si ya está agregado
    if (items.some((i) => i.supplierItemId === item.supplierItemId)) {
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
        supplierItemId: item.supplierItemId || item.supplierItem?.id,
        nombre: item.supplierItem?.nombre || item.nombre,
        codigo: item.supplierItem?.codigoProveedor || item.codigo,
        unidad: item.supplierItem?.unidad || item.unidad,
        cantidadDevuelta: 1,
      },
    ]);
    setShowItemSearch(false);
    setSearchTerm('');
  }, [items, toast]);

  // Actualizar cantidad de un item
  const handleUpdateQuantity = useCallback((supplierItemId: number, cantidad: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.supplierItemId === supplierItemId
          ? { ...item, cantidadDevuelta: Math.max(0.01, cantidad) }
          : item
      )
    );
  }, []);

  // Remover item
  const handleRemoveItem = useCallback((supplierItemId: number) => {
    setItems((prev) => prev.filter((item) => item.supplierItemId !== supplierItemId));
  }, []);

  // Validar antes de enviar
  const validateForm = useCallback(() => {
    if (!formData.warehouseId) {
      toast({ title: 'Error', description: 'Seleccione un depósito', variant: 'destructive' });
      return false;
    }
    if (!formData.motivo) {
      toast({ title: 'Error', description: 'Ingrese el motivo de la devolución', variant: 'destructive' });
      return false;
    }
    if (items.length === 0) {
      toast({ title: 'Error', description: 'Agregue al menos un item', variant: 'destructive' });
      return false;
    }
    return true;
  }, [formData.warehouseId, formData.motivo, items, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id || !validateForm()) return;

    try {
      await create.mutateAsync({
        warehouseId: Number(formData.warehouseId),
        solicitanteId: user.id,
        motivo: formData.motivo,
        notas: formData.notas || undefined,
        despachoId,
        items: items.map((item) => ({
          itemType: 'SUPPLIER_ITEM',
          supplierItemId: item.supplierItemId,
          cantidadDevuelta: item.cantidadDevuelta,
          unidad: item.unidad,
        })),
      });

      toast({ title: 'Devolución creada correctamente' });
      onSuccess?.();
      onClose();
      // Reset form
      setItems([]);
      setFormData({ warehouseId: '', motivo: '', notas: '' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al crear devolución',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Devolución</DialogTitle>
          <DialogDescription>
            Registra la entrada de materiales devueltos al almacén
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Depósito */}
            <div className="space-y-2">
              <Label htmlFor="warehouse">Depósito Destino *</Label>
              <Select
                value={formData.warehouseId}
                onValueChange={(v) => {
                  setFormData((prev) => ({ ...prev, warehouseId: v }));
                  setItems([]); // Limpiar items al cambiar depósito
                }}
              >
                <SelectTrigger id="warehouse">
                  <SelectValue placeholder="Seleccionar depósito" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id.toString()}>
                      {w.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Motivo */}
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo *</Label>
              <Input
                id="motivo"
                value={formData.motivo}
                onChange={(e) => setFormData((prev) => ({ ...prev, motivo: e.target.value }))}
                placeholder="Ej: Sobrante de trabajo, Material no utilizado..."
              />
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notas">Notas adicionales</Label>
            <Textarea
              id="notas"
              value={formData.notas}
              onChange={(e) => setFormData((prev) => ({ ...prev, notas: e.target.value }))}
              placeholder="Observaciones adicionales..."
              rows={2}
            />
          </div>

          {/* Items Section */}
          <div className="space-y-2 border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Items a Devolver *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowItemSearch(!showItemSearch)}
                disabled={!formData.warehouseId}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar Item
              </Button>
            </div>

            {/* Búsqueda de items */}
            {showItemSearch && formData.warehouseId && (
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
                  {inventarioItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {searchTerm ? 'No se encontraron items' : 'Escriba para buscar'}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {inventarioItems.map((item: any) => (
                        <div
                          key={item.supplierItemId}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer"
                          onClick={() => handleAddItem(item)}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">{item.supplierItem?.nombre}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.supplierItem?.codigoProveedor}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {item.stockDisponible?.toFixed(2)} {item.supplierItem?.unidad}
                            </p>
                            <p className="text-xs text-muted-foreground">en stock</p>
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
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right w-[120px]">Cantidad</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.supplierItemId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.nombre}</p>
                          <p className="text-xs text-muted-foreground">{item.codigo}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={item.cantidadDevuelta}
                            onChange={(e) =>
                              handleUpdateQuantity(item.supplierItemId, parseFloat(e.target.value) || 0)
                            }
                            className="w-20 text-right"
                          />
                          <span className="text-sm text-muted-foreground">{item.unidad}</span>
                        </div>
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
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <RotateCcw className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">No hay items agregados</p>
                <p className="text-xs">
                  {formData.warehouseId
                    ? 'Use el botón "Agregar Item" para buscar'
                    : 'Seleccione un depósito primero'}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || items.length === 0}
            >
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Devolución ({items.length} items)
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
