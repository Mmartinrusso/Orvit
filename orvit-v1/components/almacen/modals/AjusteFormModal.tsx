'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
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
import { Loader2, Plus, Trash2, Search, AlertTriangle } from 'lucide-react';
import { useWarehouses, useInventario, useAjustesMutations } from '../hooks';
import { AdjustmentTypes, AdjustmentTypeLabels, type AdjustmentType } from '@/lib/almacen/types';
import { useToast } from '@/hooks/use-toast';
import { cn, formatNumber } from '@/lib/utils';

// ============================================
// Reason codes por tipo de ajuste
// ============================================
const REASON_CODES: Record<string, string[]> = {
  INVENTARIO_FISICO: ['Conteo físico', 'Reconciliación', 'Auditoría'],
  ROTURA: ['Caída', 'Transporte', 'Manipulación', 'Otro'],
  VENCIMIENTO: ['Fecha pasada', 'Deterioro visible', 'Control de calidad'],
  MERMA: ['Evaporación', 'Pesaje', 'Proceso productivo', 'Otro'],
  CORRECCION: ['Error de carga', 'Error de sistema', 'Ajuste contable'],
  DEVOLUCION_INTERNA: ['Reingreso producción', 'Producto no usado', 'Otro'],
};

// ============================================
// Reglas de aprobación
// ============================================
const REQUIERE_APROBACION_TIPOS = ['INVENTARIO_FISICO'];
const REQUIERE_APROBACION_MONTO = 50000;
const REQUIERE_APROBACION_CANTIDAD = 100;

// ============================================
// Types
// ============================================
interface AjusteItem {
  supplierItemId: number;
  nombre: string;
  codigo: string;
  unidad: string;
  cantidadActual: number;
  cantidadNueva: string;
}

interface AjusteFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Modal para crear un nuevo ajuste de stock
 */
export function AjusteFormModal({
  open,
  onClose,
  onSuccess,
}: AjusteFormModalProps) {
  const { toast } = useToast();
  const { data: warehouses = [] } = useWarehouses();
  const { create } = useAjustesMutations();

  const [formData, setFormData] = useState({
    tipo: '' as string,
    warehouseId: '',
    motivo: '',
    motivoDetalle: '',
    reasonCode: '',
    notas: '',
  });

  const [items, setItems] = useState<AjusteItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showItemSearch, setShowItemSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Cargar inventario del depósito seleccionado
  const { data: inventarioData } = useInventario({
    filters: {
      warehouseId: formData.warehouseId ? Number(formData.warehouseId) : undefined,
    },
    pagination: { page: 1, pageSize: 100 },
    enabled: !!formData.warehouseId,
  });

  const inventarioItems = inventarioData?.items || [];

  // Items disponibles para agregar (excluir los ya agregados)
  const availableItems = inventarioItems.filter(
    (item: any) =>
      !items.some((i) => i.supplierItemId === (item.supplierItemId || item.supplierItem?.id))
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

  // Reason codes para el tipo seleccionado
  const currentReasonCodes = formData.tipo ? REASON_CODES[formData.tipo] || [] : [];

  // Calcular si requiere aprobación
  const requiresApproval = useMemo(() => {
    if (REQUIERE_APROBACION_TIPOS.includes(formData.tipo)) return true;

    const totalAbsDiferencia = items.reduce((acc, item) => {
      const cantidadNueva = parseFloat(item.cantidadNueva);
      if (isNaN(cantidadNueva)) return acc;
      return acc + Math.abs(cantidadNueva - item.cantidadActual);
    }, 0);

    return totalAbsDiferencia > REQUIERE_APROBACION_CANTIDAD;
  }, [formData.tipo, items]);

  // Reset form cuando se cierra el modal
  useEffect(() => {
    if (!open) {
      setFormData({
        tipo: '',
        warehouseId: '',
        motivo: '',
        motivoDetalle: '',
        reasonCode: '',
        notas: '',
      });
      setItems([]);
      setIsSubmitting(false);
      setShowItemSearch(false);
      setSearchTerm('');
    }
  }, [open]);

  // Agregar item al ajuste
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
          cantidadActual: item.stockDisponible ?? 0,
          cantidadNueva: String(item.stockDisponible ?? 0),
        },
      ]);
      setShowItemSearch(false);
      setSearchTerm('');
    },
    [items, toast]
  );

  // Actualizar cantidad nueva de un item
  const handleUpdateCantidadNueva = useCallback((supplierItemId: number, value: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.supplierItemId === supplierItemId ? { ...item, cantidadNueva: value } : item
      )
    );
  }, []);

  // Remover item
  const handleRemoveItem = useCallback((supplierItemId: number) => {
    setItems((prev) => prev.filter((item) => item.supplierItemId !== supplierItemId));
  }, []);

  // Validar antes de enviar
  const validateForm = useCallback(() => {
    if (!formData.tipo) {
      toast({ title: 'Error', description: 'Seleccione un tipo de ajuste', variant: 'destructive' });
      return false;
    }
    if (!formData.warehouseId) {
      toast({ title: 'Error', description: 'Seleccione un depósito', variant: 'destructive' });
      return false;
    }
    if (formData.motivo.length < 10) {
      toast({ title: 'Error', description: 'El motivo debe tener al menos 10 caracteres', variant: 'destructive' });
      return false;
    }
    if (items.length === 0) {
      toast({ title: 'Error', description: 'Agregue al menos un item', variant: 'destructive' });
      return false;
    }
    for (const item of items) {
      const cantidadNueva = parseFloat(item.cantidadNueva);
      if (isNaN(cantidadNueva) || cantidadNueva < 0) {
        toast({
          title: 'Cantidad inválida',
          description: `${item.nombre}: la cantidad nueva debe ser mayor o igual a 0`,
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
        tipo: formData.tipo,
        warehouseId: parseInt(formData.warehouseId),
        motivo: formData.motivo,
        motivoDetalle: formData.motivoDetalle || undefined,
        reasonCode: formData.reasonCode || undefined,
        notas: formData.notas || undefined,
        items: items.map((i) => ({
          supplierItemId: i.supplierItemId,
          cantidadActual: i.cantidadActual,
          cantidadNueva: parseFloat(i.cantidadNueva),
        })),
      });
      toast({ title: 'Ajuste creado correctamente' });
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al crear ajuste',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo Ajuste de Stock</DialogTitle>
          <DialogDescription>
            Registrar un ajuste de inventario en un depósito
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {/* Tipo de Ajuste y Depósito */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Ajuste *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(v) => {
                  setFormData((prev) => ({
                    ...prev,
                    tipo: v,
                    reasonCode: '', // Limpiar reason code al cambiar tipo
                  }));
                }}
              >
                <SelectTrigger id="tipo" className="h-10">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {AdjustmentTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {AdjustmentTypeLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="warehouse">Depósito *</Label>
              <Select
                value={formData.warehouseId}
                onValueChange={(v) => {
                  setFormData((prev) => ({ ...prev, warehouseId: v }));
                  setItems([]); // Limpiar items al cambiar depósito
                  setShowItemSearch(false);
                  setSearchTerm('');
                }}
              >
                <SelectTrigger id="warehouse" className="h-10">
                  <SelectValue placeholder="Seleccionar depósito" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id.toString()}>
                      {w.nombre} ({w.codigo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reason Code y Motivo Detalle */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reasonCode">Código de Motivo</Label>
              <Select
                value={formData.reasonCode}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, reasonCode: v }))
                }
                disabled={!formData.tipo}
              >
                <SelectTrigger id="reasonCode" className="h-10">
                  <SelectValue placeholder={formData.tipo ? 'Seleccionar motivo' : 'Seleccione un tipo primero'} />
                </SelectTrigger>
                <SelectContent>
                  {currentReasonCodes.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivoDetalle">Detalle del Motivo</Label>
              <Input
                id="motivoDetalle"
                value={formData.motivoDetalle}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, motivoDetalle: e.target.value }))
                }
                placeholder="Detalle adicional..."
                className="h-10"
              />
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo *</Label>
            <Textarea
              id="motivo"
              value={formData.motivo}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, motivo: e.target.value }))
              }
              placeholder="Describa el motivo del ajuste..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Mínimo 10 caracteres
            </p>
          </div>

          {/* Approval warning */}
          {requiresApproval && (
            <div className="flex items-center gap-2 p-3 bg-warning-muted border border-warning-muted-foreground/30 rounded-md">
              <AlertTriangle className="h-4 w-4 text-warning-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-warning-muted-foreground">
                  Este ajuste requiere aprobación
                </p>
                <p className="text-xs text-warning-muted-foreground/80">
                  {REQUIERE_APROBACION_TIPOS.includes(formData.tipo)
                    ? 'Los ajustes de tipo inventario físico requieren aprobación de un supervisor'
                    : 'La cantidad total de diferencias supera el umbral permitido'}
                </p>
              </div>
              <Badge variant="outline" className="border-warning-muted-foreground/50 text-warning-muted-foreground">
                Requiere aprobación
              </Badge>
            </div>
          )}

          {/* Items Section */}
          <div className="space-y-3 border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Items a ajustar *</Label>
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
                    <TableHead className="w-[100px]">Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-right w-[100px]">Stock Actual</TableHead>
                    <TableHead className="text-right w-[120px]">Cantidad Nueva</TableHead>
                    <TableHead className="text-right w-[100px]">Diferencia</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const cantidadNueva = parseFloat(item.cantidadNueva);
                    const diferencia = isNaN(cantidadNueva) ? 0 : cantidadNueva - item.cantidadActual;

                    return (
                      <TableRow key={item.supplierItemId}>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{item.codigo}</span>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{item.nombre}</p>
                          <p className="text-xs text-muted-foreground">{item.unidad}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm">{formatNumber(item.cantidadActual, 2)}</span>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.cantidadNueva}
                            onChange={(e) =>
                              handleUpdateCantidadNueva(item.supplierItemId, e.target.value)
                            }
                            className="w-full text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              'text-sm font-medium',
                              diferencia > 0 && 'text-green-600',
                              diferencia < 0 && 'text-destructive',
                              diferencia === 0 && 'text-muted-foreground'
                            )}
                          >
                            {diferencia > 0 ? '+' : ''}
                            {formatNumber(diferencia, 2)}
                          </span>
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
                <AlertTriangle className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">No hay items agregados</p>
                <p className="text-xs">
                  {formData.warehouseId
                    ? 'Use el botón "Agregar Item" para buscar'
                    : 'Seleccione un depósito primero'}
                </p>
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
            Crear Ajuste ({items.length} {items.length === 1 ? 'item' : 'items'})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
