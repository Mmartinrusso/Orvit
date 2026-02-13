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
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Search, Package, AlertTriangle } from 'lucide-react';
import { useDespachosMutations, useWarehouses, useInventario } from '../hooks';
import { DespachoTypes, DespachoTypeLabels } from '@/lib/almacen/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/hooks/use-users';
import { cn } from '@/lib/utils';

interface DespachoItem {
  supplierItemId: number;
  nombre: string;
  codigo: string;
  unidad: string;
  stockDisponible: number;
  cantidadDespachada: number;
}

interface DespachoFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  materialRequestId?: number;
  // Para salida rápida desde inventario
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
 * Modal para crear despacho con selección de items
 */
export function DespachoFormModal({
  open,
  onClose,
  onSuccess,
  materialRequestId,
  preselectedItem,
}: DespachoFormModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: warehouses = [] } = useWarehouses();
  const { create } = useDespachosMutations();
  const { users: empleados } = useUsers();

  const [formData, setFormData] = useState({
    tipo: 'ENTREGA_PERSONA' as const,
    warehouseId: preselectedItem?.warehouseId?.toString() || '',
    destinatario: '',
    notas: '',
  });

  const [items, setItems] = useState<DespachoItem[]>(
    preselectedItem
      ? [
          {
            supplierItemId: preselectedItem.supplierItemId,
            nombre: preselectedItem.nombre,
            codigo: preselectedItem.codigo,
            unidad: preselectedItem.unidad,
            stockDisponible: preselectedItem.stockDisponible,
            cantidadDespachada: 1,
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
          stockDisponible: preselectedItem.stockDisponible,
          cantidadDespachada: 1,
        },
      ]);
    }
  }, [open, preselectedItem]);

  // Reset form cuando se cierra el modal
  useEffect(() => {
    if (!open) {
      setItems([]);
      setFormData({ tipo: 'ENTREGA_PERSONA', warehouseId: '', destinatario: '', notas: '' });
      setSearchTerm('');
      setShowItemSearch(false);
    }
  }, [open]);

  // Cargar inventario del depósito seleccionado
  const { data: inventarioData } = useInventario({
    filters: {
      warehouseId: formData.warehouseId ? Number(formData.warehouseId) : undefined,
      search: searchTerm,
    },
    pagination: { page: 1, pageSize: 20 },
    enabled: !!formData.warehouseId && showItemSearch,
  });

  const inventarioItems = inventarioData?.items || [];

  // Agregar item al despacho
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
        stockDisponible: item.stockDisponible ?? item.available ?? 0,
        cantidadDespachada: 1,
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
          ? { ...item, cantidadDespachada: Math.max(0.01, cantidad) }
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
    if (items.length === 0) {
      toast({ title: 'Error', description: 'Agregue al menos un item', variant: 'destructive' });
      return false;
    }
    // Validar cantidades
    for (const item of items) {
      if (item.cantidadDespachada > item.stockDisponible) {
        toast({
          title: 'Stock insuficiente',
          description: `${item.nombre}: disponible ${item.stockDisponible}, solicitado ${item.cantidadDespachada}`,
          variant: 'destructive',
        });
        return false;
      }
    }
    return true;
  }, [formData.warehouseId, items, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id || !validateForm()) return;

    try {
      await create.mutateAsync({
        tipo: formData.tipo,
        warehouseId: Number(formData.warehouseId),
        despachadorId: user.id,
        destinatario: formData.destinatario || undefined,
        notas: formData.notas || undefined,
        materialRequestId,
        items: items.map((item) => ({
          itemType: 'SUPPLIER_ITEM',
          supplierItemId: item.supplierItemId,
          cantidadSolicitada: item.cantidadDespachada,
          cantidadDespachada: item.cantidadDespachada,
          unidad: item.unidad,
        })),
      });

      toast({ title: 'Despacho creado correctamente' });
      onSuccess?.();
      onClose();
      // Reset form
      setItems([]);
      setFormData({ tipo: 'ENTREGA_PERSONA', warehouseId: '', destinatario: '', notas: '' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al crear despacho',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle>Nuevo Despacho</DialogTitle>
          <DialogDescription>
            Registra la salida de materiales del almacén
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Primera fila: Tipo y Depósito */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Despacho</Label>
              <Select
                value={formData.tipo}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, tipo: v as any }))}
              >
                <SelectTrigger id="tipo" className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DespachoTypes.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {DespachoTypeLabels[tipo]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="warehouse">Depósito de Origen *</Label>
              <Select
                value={formData.warehouseId}
                onValueChange={(v) => {
                  setFormData((prev) => ({ ...prev, warehouseId: v }));
                  setItems([]); // Limpiar items al cambiar depósito
                }}
              >
                <SelectTrigger id="warehouse" className="h-10">
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
          </div>

          {/* Segunda fila: Destinatario y Notas */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="destinatario">Destinatario (quien recibe)</Label>
              <Select
                value={formData.destinatario}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, destinatario: v }))}
              >
                <SelectTrigger id="destinatario" className="h-10">
                  <SelectValue placeholder="Seleccionar empleado" />
                </SelectTrigger>
                <SelectContent>
                  {empleados.map((emp) => (
                    <SelectItem key={emp.id} value={emp.name}>
                      {emp.name}
                      {emp.specialty && (
                        <span className="text-muted-foreground ml-2">({emp.specialty})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notas">Notas</Label>
              <Input
                id="notas"
                value={formData.notas}
                onChange={(e) => setFormData((prev) => ({ ...prev, notas: e.target.value }))}
                placeholder="Motivo, observaciones..."
                className="h-10"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-3 border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Items a Despachar *</Label>
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
                          className={cn(
                            'flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer',
                            item.stockDisponible <= 0 && 'opacity-50'
                          )}
                          onClick={() => item.stockDisponible > 0 && handleAddItem(item)}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">{item.supplierItem?.nombre}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.supplierItem?.codigoProveedor}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={cn(
                              'text-sm font-medium',
                              item.stockDisponible <= 0 && 'text-red-500'
                            )}>
                              {item.stockDisponible?.toFixed(2)} {item.supplierItem?.unidad}
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
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right w-[100px]">Disponible</TableHead>
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
                      <TableCell className="text-right">
                        <span className={cn(
                          item.stockDisponible < item.cantidadDespachada && 'text-red-500'
                        )}>
                          {item.stockDisponible.toFixed(2)}
                        </span>
                        <span className="text-muted-foreground ml-1">{item.unidad}</span>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={item.stockDisponible}
                          value={item.cantidadDespachada}
                          onChange={(e) =>
                            handleUpdateQuantity(item.supplierItemId, parseFloat(e.target.value) || 0)
                          }
                          className={cn(
                            'w-full text-right',
                            item.cantidadDespachada > item.stockDisponible && 'border-red-500'
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
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <Package className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">No hay items agregados</p>
                <p className="text-xs">
                  {formData.warehouseId
                    ? 'Use el botón "Agregar Item" para buscar'
                    : 'Seleccione un depósito primero'}
                </p>
              </div>
            )}

            {/* Warning si hay items con stock insuficiente */}
            {items.some((i) => i.cantidadDespachada > i.stockDisponible) && (
              <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-md text-red-700">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">
                  Algunos items exceden el stock disponible
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || items.length === 0}
            >
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Despacho ({items.length} items)
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
