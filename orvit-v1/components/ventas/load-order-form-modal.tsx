'use client';

import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, Truck, User, Calendar, Save, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// =====================================================
// TYPES
// =====================================================

interface SaleForLoad {
  id: number;
  numero: string;
  client: {
    id: number;
    legalName?: string;
    name?: string;
  };
  items: Array<{
    id: number;
    productId: number;
    product: {
      id: number;
      name: string;
      codigo?: string;
    };
    cantidad: number;
    cantidadCargada: number;
    unidadMedida: string;
  }>;
}

interface LoadOrderFormData {
  saleId: number;
  vehiculo: string;
  vehiculoPatente: string;
  chofer: string;
  choferDNI: string;
  transportista: string;
  observaciones: string;
  items: Array<{
    saleItemId: number;
    productId: number;
    cantidad: number;
    secuencia: number;
  }>;
}

interface LoadOrderFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale?: SaleForLoad | null;
  loadOrder?: any; // For editing
  onSuccess?: () => void;
}

// =====================================================
// COMPONENT
// =====================================================

export function LoadOrderFormModal({
  open,
  onOpenChange,
  sale,
  loadOrder,
  onSuccess,
}: LoadOrderFormModalProps) {
  const isEditing = !!loadOrder;
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<Array<{ name: string; dni?: string }>>([]);
  const [vehicles, setVehicles] = useState<Array<{ name: string; patente?: string }>>([]);

  const [formData, setFormData] = useState<LoadOrderFormData>({
    saleId: sale?.id || 0,
    vehiculo: '',
    vehiculoPatente: '',
    chofer: '',
    choferDNI: '',
    transportista: '',
    observaciones: '',
    items: [],
  });

  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({});

  // Load drivers and vehicles
  useEffect(() => {
    if (open) {
      loadDriversAndVehicles();
    }
  }, [open]);

  // Initialize form when sale changes
  useEffect(() => {
    if (sale) {
      setFormData((prev) => ({
        ...prev,
        saleId: sale.id,
      }));

      // Pre-select items with pending quantities to load
      const initial: Record<number, number> = {};
      sale.items?.forEach((item) => {
        const pending = item.cantidad - (item.cantidadCargada || 0);
        if (pending > 0) {
          initial[item.id] = pending;
        }
      });
      setSelectedItems(initial);
    }
  }, [sale]);

  // Initialize form when editing
  useEffect(() => {
    if (loadOrder) {
      setFormData({
        saleId: loadOrder.saleId,
        vehiculo: loadOrder.vehiculo || '',
        vehiculoPatente: loadOrder.vehiculoPatente || '',
        chofer: loadOrder.chofer || '',
        choferDNI: loadOrder.choferDNI || '',
        transportista: loadOrder.transportista || '',
        observaciones: loadOrder.observaciones || '',
        items: loadOrder.items?.map((i: any, idx: number) => ({
          saleItemId: i.saleItemId,
          productId: i.productId,
          cantidad: i.cantidad,
          secuencia: idx + 1,
        })) || [],
      });

      const initial: Record<number, number> = {};
      loadOrder.items?.forEach((item: any) => {
        initial[item.saleItemId] = item.cantidad;
      });
      setSelectedItems(initial);
    }
  }, [loadOrder]);

  const loadDriversAndVehicles = async () => {
    try {
      const [driversRes, vehiclesRes] = await Promise.all([
        fetch('/api/ventas/entregas/drivers'),
        fetch('/api/ventas/entregas/vehicles'),
      ]);

      if (driversRes.ok) {
        const data = await driversRes.json();
        setDrivers(data);
      }

      if (vehiclesRes.ok) {
        const data = await vehiclesRes.json();
        setVehicles(data);
      }
    } catch (error) {
      console.error('Error loading drivers/vehicles:', error);
    }
  };

  const handleSubmit = async () => {
    // Validate
    if (!formData.vehiculo) {
      toast.error('El vehículo es requerido');
      return;
    }

    if (!formData.chofer) {
      toast.error('El chofer es requerido');
      return;
    }

    const itemsToLoad = Object.entries(selectedItems)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty], idx) => {
        const saleItem = sale?.items.find((i) => i.id === parseInt(itemId));
        return {
          saleItemId: parseInt(itemId),
          productId: saleItem?.productId || 0,
          cantidad: qty,
          secuencia: idx + 1,
        };
      });

    if (itemsToLoad.length === 0 && !isEditing) {
      toast.error('Debe seleccionar al menos un item para cargar');
      return;
    }

    setLoading(true);
    try {
      const url = isEditing
        ? `/api/ventas/ordenes-carga/${loadOrder.id}`
        : '/api/ventas/ordenes-carga';

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items: itemsToLoad,
        }),
      });

      if (response.ok) {
        toast.success(isEditing ? 'Orden de carga actualizada' : 'Orden de carga creada');
        onOpenChange(false);
        onSuccess?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al guardar orden de carga');
    } finally {
      setLoading(false);
    }
  };

  const handleItemQuantityChange = (itemId: number, quantity: number, maxQty: number) => {
    const validQty = Math.max(0, Math.min(quantity, maxQty));
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: validQty,
    }));
  };

  const toggleSelectAll = (selected: boolean) => {
    if (selected) {
      const all: Record<number, number> = {};
      sale?.items?.forEach((item) => {
        const pending = item.cantidad - (item.cantidadCargada || 0);
        if (pending > 0) {
          all[item.id] = pending;
        }
      });
      setSelectedItems(all);
    } else {
      setSelectedItems({});
    }
  };

  const totalItemsSelected = Object.values(selectedItems).filter((q) => q > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {isEditing ? 'Editar Orden de Carga' : 'Nueva Orden de Carga'}
          </DialogTitle>
          <DialogDescription>
            {sale && (
              <span>
                Orden: <strong>{sale.numero}</strong> - Cliente:{' '}
                <strong>{sale.client?.legalName || sale.client?.name}</strong>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Vehículo y Transportista */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Vehículo *
              </Label>
              <Input
                value={formData.vehiculo}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, vehiculo: e.target.value }))
                }
                placeholder="Descripción del vehículo"
                list="vehiculos-list"
              />
              <datalist id="vehiculos-list">
                {vehicles.map((v, i) => (
                  <option key={i} value={v.name} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label>Patente</Label>
              <Input
                value={formData.vehiculoPatente}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, vehiculoPatente: e.target.value }))
                }
                placeholder="ABC-123"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Transportista</Label>
            <Input
              value={formData.transportista}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, transportista: e.target.value }))
              }
              placeholder="Nombre del transportista (opcional)"
            />
          </div>

          {/* Chofer */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Chofer *
              </Label>
              <Input
                value={formData.chofer}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, chofer: e.target.value }))
                }
                placeholder="Nombre del chofer"
                list="choferes-list"
              />
              <datalist id="choferes-list">
                {drivers.map((d, i) => (
                  <option key={i} value={d.name} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label>DNI Chofer</Label>
              <Input
                value={formData.choferDNI}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, choferDNI: e.target.value }))
                }
                placeholder="DNI"
              />
            </div>
          </div>

          {/* Items a Cargar */}
          {sale?.items && sale.items.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Items a Cargar</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{totalItemsSelected} seleccionados</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSelectAll(totalItemsSelected === 0)}
                  >
                    {totalItemsSelected === 0 ? 'Seleccionar todos' : 'Deseleccionar'}
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Pedido</TableHead>
                      <TableHead className="text-right">Cargado</TableHead>
                      <TableHead className="text-right">Pendiente</TableHead>
                      <TableHead className="text-right w-28">A Cargar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sale.items.map((item) => {
                      const pending = item.cantidad - (item.cantidadCargada || 0);
                      const isSelected = (selectedItems[item.id] || 0) > 0;

                      return (
                        <TableRow key={item.id} className={isSelected ? 'bg-primary/5' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  handleItemQuantityChange(item.id, pending, pending);
                                } else {
                                  handleItemQuantityChange(item.id, 0, pending);
                                }
                              }}
                              disabled={pending === 0}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.product?.name}</p>
                              {item.product?.codigo && (
                                <p className="text-xs text-muted-foreground">
                                  {item.product.codigo}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.cantidad} {item.unidadMedida}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {item.cantidadCargada || 0}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={pending > 0 ? 'secondary' : 'outline'}
                              className={pending === 0 ? 'text-muted-foreground' : ''}
                            >
                              {pending}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={pending}
                              value={selectedItems[item.id] || 0}
                              onChange={(e) =>
                                handleItemQuantityChange(
                                  item.id,
                                  parseInt(e.target.value) || 0,
                                  pending
                                )
                              }
                              disabled={pending === 0}
                              className="w-20 text-right"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Observaciones */}
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              value={formData.observaciones}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, observaciones: e.target.value }))
              }
              placeholder="Notas o instrucciones especiales..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isEditing ? 'Guardar Cambios' : 'Crear Orden de Carga'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
