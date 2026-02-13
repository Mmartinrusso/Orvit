'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Loader2, Package, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface SourceItem {
  id: number;
  supplierItemId?: number;
  descripcion: string;
  cantidad: number;
  cantidadRecibida?: number;
  unidad: string;
  precioUnitario?: number;
  codigoProveedor?: string;
}

interface DevolucionFromDocumentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sourceType: 'factura' | 'remito';
  sourceId: number;
  sourceNumero: string;
  proveedorId: number;
  proveedorNombre: string;
  warehouseId?: number;
  items: SourceItem[];
  /** T1 = AFIP standard, T2 = Extendido/interno - hereda del documento origen */
  docType?: 'T1' | 'T2';
}

const tipoOptions = [
  { value: 'DEFECTO', label: 'Defecto - Mercaderia defectuosa' },
  { value: 'EXCESO', label: 'Exceso - Llego de mas' },
  { value: 'ERROR_PEDIDO', label: 'Error en pedido - No era lo solicitado' },
  { value: 'GARANTIA', label: 'Garantia - Falla en garantia' },
  { value: 'OTRO', label: 'Otro motivo' },
];

interface ItemDevolucion {
  sourceItemId: number;
  supplierItemId: number;
  descripcion: string;
  cantidadMaxima: number;
  cantidadDevolver: number;
  unidad: string;
  motivo: string;
  precioReferencia?: number;
  selected: boolean;
  hasValidSupplierItem?: boolean; // Track if item has valid supplier item link
}

export function DevolucionFromDocumentModal({
  open,
  onClose,
  onSuccess,
  sourceType,
  sourceId,
  sourceNumero,
  proveedorId,
  proveedorNombre,
  warehouseId,
  items: sourceItems,
  docType = 'T1',
}: DevolucionFromDocumentModalProps) {
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    warehouseId: warehouseId?.toString() || '',
    tipo: 'DEFECTO',
    motivo: '',
    descripcion: '',
  });

  const [items, setItems] = useState<ItemDevolucion[]>([]);

  // Initialize items from source
  useEffect(() => {
    if (open && sourceItems.length > 0) {
      const initialItems: ItemDevolucion[] = sourceItems.map(si => ({
        sourceItemId: si.id,
        supplierItemId: si.supplierItemId || 0, // Allow 0 for items without linked supplier item
        descripcion: si.descripcion,
        cantidadMaxima: si.cantidadRecibida ?? si.cantidad,
        cantidadDevolver: 0,
        unidad: si.unidad,
        motivo: '',
        precioReferencia: si.precioUnitario,
        selected: false,
        hasValidSupplierItem: !!si.supplierItemId, // Track if has valid link
      }));
      setItems(initialItems);
    }
  }, [open, sourceItems]);

  // Load warehouses
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await fetch('/api/compras/depositos?limit=100');
        if (response.ok) {
          const result = await response.json();
          setWarehouses(result.data || result);
        }
      } catch (error) {
        console.error('Error loading warehouses:', error);
      }
    };
    if (open) {
      fetchWarehouses();
    }
  }, [open]);

  const toggleItemSelection = (index: number) => {
    const updated = [...items];
    // Only allow toggling for items with valid supplierItemId
    if (!updated[index].hasValidSupplierItem) return;
    updated[index].selected = !updated[index].selected;
    if (updated[index].selected && updated[index].cantidadDevolver === 0) {
      updated[index].cantidadDevolver = updated[index].cantidadMaxima;
    }
    setItems(updated);
  };

  const updateItemCantidad = (index: number, cantidad: number) => {
    const updated = [...items];
    updated[index].cantidadDevolver = Math.min(cantidad, updated[index].cantidadMaxima);
    setItems(updated);
  };

  const updateItemMotivo = (index: number, motivo: string) => {
    const updated = [...items];
    updated[index].motivo = motivo;
    setItems(updated);
  };

  const selectAll = () => {
    const updated = items.map(item => ({
      ...item,
      // Only select items with valid supplierItemId
      selected: item.hasValidSupplierItem ? true : false,
      cantidadDevolver: item.hasValidSupplierItem
        ? (item.cantidadDevolver || item.cantidadMaxima)
        : item.cantidadDevolver,
    }));
    setItems(updated);
  };

  const deselectAll = () => {
    const updated = items.map(item => ({
      ...item,
      selected: false,
    }));
    setItems(updated);
  };

  const handleSubmit = async () => {
    const selectedItems = items.filter(i => i.selected && i.cantidadDevolver > 0);

    if (selectedItems.length === 0) {
      toast.error('Seleccione al menos un item para devolver');
      return;
    }

    if (!formData.tipo || !formData.motivo) {
      toast.error('Complete el tipo y motivo de la devolucion');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/compras/devoluciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedorId,
          warehouseId: formData.warehouseId ? parseInt(formData.warehouseId) : undefined,
          goodsReceiptId: sourceType === 'remito' ? sourceId : undefined,
          facturaId: sourceType === 'factura' ? sourceId : undefined,
          tipo: formData.tipo,
          motivo: formData.motivo,
          descripcion: formData.descripcion || `Devolucion desde ${sourceType === 'factura' ? 'Factura' : 'Remito'} ${sourceNumero}`,
          docType, // Heredar T1/T2 del documento origen
          items: selectedItems.map(i => ({
            supplierItemId: i.supplierItemId,
            descripcion: i.descripcion,
            cantidad: i.cantidadDevolver,
            unidad: i.unidad,
            motivo: i.motivo,
            precioReferencia: i.precioReferencia,
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear devolucion');
      }

      toast.success('Devolucion creada correctamente');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Error al crear devolucion');
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = items.filter(i => i.selected).length;
  const selectableCount = items.filter(i => i.hasValidSupplierItem).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent size="full" className="overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Nueva Devolucion desde {sourceType === 'factura' ? 'Factura' : 'Remito'} {sourceNumero}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info del documento origen */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Proveedor: </span>
                <span className="font-medium">{proveedorNombre}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{sourceType === 'factura' ? 'Factura' : 'Remito'}: </span>
                <span className="font-medium">{sourceNumero}</span>
              </div>
            </div>
          </div>

          {/* Tipo y Deposito */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de devolucion *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tipoOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Deposito origen</Label>
              <Select
                value={formData.warehouseId}
                onValueChange={(value) => setFormData({ ...formData, warehouseId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar deposito" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id.toString()}>
                      {w.codigo} - {w.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label>Motivo breve *</Label>
            <Input
              value={formData.motivo}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              placeholder="Ej: Mercaderia con defectos de fabrica"
            />
          </div>

          {/* Descripcion */}
          <div className="space-y-2">
            <Label>Descripcion detallada</Label>
            <Textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Describa el problema en detalle..."
              rows={2}
            />
          </div>

          {/* Items a devolver */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Items a devolver ({selectedCount} de {selectableCount} seleccionados)
                {items.length > selectableCount && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({items.length - selectableCount} sin stock vinculado)
                  </span>
                )}
              </Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                  Seleccionar todos
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={deselectAll}>
                  Deseleccionar
                </Button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground border rounded-lg">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                <p>No hay items disponibles para devolver</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-center w-24">Disponible</TableHead>
                      <TableHead className="text-center w-28">A devolver</TableHead>
                      <TableHead className="w-40">Motivo item</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow
                        key={item.sourceItemId}
                        className={
                          item.selected
                            ? 'bg-primary/5'
                            : !item.hasValidSupplierItem
                              ? 'opacity-50 bg-muted/20'
                              : ''
                        }
                      >
                        <TableCell>
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={() => toggleItemSelection(index)}
                            disabled={!item.hasValidSupplierItem}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{item.descripcion}</p>
                              <p className="text-xs text-muted-foreground">{item.unidad}</p>
                            </div>
                            {!item.hasValidSupplierItem && (
                              <Badge variant="outline" className="text-xs text-amber-600 border-amber-400 shrink-0" title="Item sin producto vinculado - no se puede devolver">
                                Sin stock
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{item.cantidadMaxima}</Badge>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={item.cantidadMaxima}
                            step="0.01"
                            value={item.cantidadDevolver || ''}
                            onChange={(e) => updateItemCantidad(index, parseFloat(e.target.value) || 0)}
                            disabled={!item.selected || !item.hasValidSupplierItem}
                            className="w-24 text-center"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.motivo}
                            onChange={(e) => updateItemMotivo(index, e.target.value)}
                            placeholder="Opcional"
                            disabled={!item.selected || !item.hasValidSupplierItem}
                            className="text-xs"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || selectedCount === 0}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crear Devolucion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
