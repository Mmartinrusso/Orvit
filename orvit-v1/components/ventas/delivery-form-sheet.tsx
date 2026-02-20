'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Truck, Package, User, Calendar, MapPin, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// =====================================================
// TYPES
// =====================================================

interface SaleItem {
  id: number;
  productId: number;
  product: {
    id: number;
    name: string;
    codigo?: string;
  };
  cantidad: number;
  cantidadEntregada: number;
  unidadMedida: string;
}

interface Sale {
  id: number;
  numero: string;
  client: {
    id: number;
    legalName?: string;
    name?: string;
    address?: string;
    phone?: string;
  };
  items: SaleItem[];
}

interface DeliveryFormData {
  saleId: number;
  tipo: 'ENVIO' | 'RETIRO';
  fechaProgramada: string;
  direccionEntrega: string;
  transportista: string;
  vehiculo: string;
  conductorNombre: string;
  conductorDNI: string;
  notas: string;
  items: Array<{
    saleItemId: number;
    productId: number;
    cantidad: number;
  }>;
}

interface DeliveryFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale?: Sale | null;
  delivery?: any; // For editing
  onSuccess?: () => void;
}

// =====================================================
// COMPONENT
// =====================================================

export function DeliveryFormSheet({
  open,
  onOpenChange,
  sale,
  delivery,
  onSuccess,
}: DeliveryFormSheetProps) {
  const isEditing = !!delivery;

  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<Array<{ name: string; dni?: string }>>([]);
  const [vehicles, setVehicles] = useState<Array<{ name: string; patente?: string }>>([]);

  const [formData, setFormData] = useState<DeliveryFormData>({
    saleId: sale?.id || 0,
    tipo: 'ENVIO',
    fechaProgramada: new Date().toISOString().split('T')[0],
    direccionEntrega: sale?.client?.address || '',
    transportista: '',
    vehiculo: '',
    conductorNombre: '',
    conductorDNI: '',
    notas: '',
    items: [],
  });

  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({});

  // Load drivers and vehicles for autocomplete
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
        direccionEntrega: sale.client?.address || '',
      }));

      // Pre-select items with pending quantities
      const initial: Record<number, number> = {};
      sale.items?.forEach((item) => {
        const pending = item.cantidad - (item.cantidadEntregada || 0);
        if (pending > 0) {
          initial[item.id] = pending;
        }
      });
      setSelectedItems(initial);
    }
  }, [sale]);

  // Initialize form when editing
  useEffect(() => {
    if (delivery) {
      setFormData({
        saleId: delivery.saleId,
        tipo: delivery.tipo || 'ENVIO',
        fechaProgramada: delivery.fechaProgramada?.split('T')[0] || '',
        direccionEntrega: delivery.direccionEntrega || '',
        transportista: delivery.transportista || '',
        vehiculo: delivery.vehiculo || '',
        conductorNombre: delivery.conductorNombre || '',
        conductorDNI: delivery.conductorDNI || '',
        notas: delivery.notas || '',
        items: delivery.items?.map((i: any) => ({
          saleItemId: i.saleItemId,
          productId: i.productId,
          cantidad: i.cantidad,
        })) || [],
      });

      // Initialize selected items from delivery
      const initial: Record<number, number> = {};
      delivery.items?.forEach((item: any) => {
        initial[item.saleItemId] = item.cantidad;
      });
      setSelectedItems(initial);
    }
  }, [delivery]);

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
    if (!formData.fechaProgramada) {
      toast.error('La fecha programada es requerida');
      return;
    }

    if (formData.tipo === 'ENVIO' && !formData.direccionEntrega) {
      toast.error('La dirección es requerida para envío');
      return;
    }

    const itemsToDeliver = Object.entries(selectedItems)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const saleItem = sale?.items.find((i) => i.id === parseInt(itemId));
        return {
          saleItemId: parseInt(itemId),
          productId: saleItem?.productId || 0,
          cantidad: qty,
        };
      });

    if (itemsToDeliver.length === 0 && !isEditing) {
      toast.error('Debe seleccionar al menos un item para entregar');
      return;
    }

    setLoading(true);
    try {
      const url = isEditing
        ? `/api/ventas/entregas/${delivery.id}`
        : '/api/ventas/entregas';

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          fechaProgramada: new Date(formData.fechaProgramada).toISOString(),
          items: itemsToDeliver,
        }),
      });

      if (response.ok) {
        toast.success(isEditing ? 'Entrega actualizada' : 'Entrega creada');
        onOpenChange(false);
        onSuccess?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al guardar entrega');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al guardar entrega');
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
        const pending = item.cantidad - (item.cantidadEntregada || 0);
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="lg" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            {isEditing ? 'Editar Entrega' : 'Nueva Entrega'}
          </SheetTitle>
          <SheetDescription>
            {sale && (
              <span>
                Orden: <strong>{sale.numero}</strong> - Cliente:{' '}
                <strong>{sale.client?.legalName || sale.client?.name}</strong>
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Tipo de Entrega */}
          <div className="space-y-2">
            <Label>Tipo de Entrega</Label>
            <Select
              value={formData.tipo}
              onValueChange={(v: 'ENVIO' | 'RETIRO') =>
                setFormData((prev) => ({ ...prev, tipo: v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ENVIO">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    Envío a domicilio
                  </div>
                </SelectItem>
                <SelectItem value="RETIRO">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Retiro en local
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fecha Programada */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Fecha Programada *
            </Label>
            <Input
              type="date"
              value={formData.fechaProgramada}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, fechaProgramada: e.target.value }))
              }
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Dirección (solo para envío) */}
          {formData.tipo === 'ENVIO' && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Dirección de Entrega *
              </Label>
              <Textarea
                value={formData.direccionEntrega}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, direccionEntrega: e.target.value }))
                }
                placeholder="Dirección completa"
                rows={2}
              />
            </div>
          )}

          {/* Transportista / Conductor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Transportista</Label>
              <Input
                value={formData.transportista}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, transportista: e.target.value }))
                }
                placeholder="Nombre del transportista"
                list="transportistas"
              />
            </div>

            <div className="space-y-2">
              <Label>Vehículo</Label>
              <Input
                value={formData.vehiculo}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, vehiculo: e.target.value }))
                }
                placeholder="Patente o descripción"
                list="vehiculos"
              />
              <datalist id="vehiculos">
                {vehicles.map((v, i) => (
                  <option key={i} value={v.name}>
                    {v.patente && `(${v.patente})`}
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Conductor
              </Label>
              <Input
                value={formData.conductorNombre}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, conductorNombre: e.target.value }))
                }
                placeholder="Nombre del conductor"
                list="conductores"
              />
              <datalist id="conductores">
                {drivers.map((d, i) => (
                  <option key={i} value={d.name}>
                    {d.dni && `DNI: ${d.dni}`}
                  </option>
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label>DNI Conductor</Label>
              <Input
                value={formData.conductorDNI}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, conductorDNI: e.target.value }))
                }
                placeholder="DNI"
              />
            </div>
          </div>

          {/* Items a Entregar */}
          {sale?.items && sale.items.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Items a Entregar</Label>
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
                      <TableHead className="text-right">Entregado</TableHead>
                      <TableHead className="text-right">Pendiente</TableHead>
                      <TableHead className="text-right w-28">A Entregar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sale.items.map((item) => {
                      const pending = item.cantidad - (item.cantidadEntregada || 0);
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
                          <TableCell className="text-right text-success">
                            {item.cantidadEntregada || 0}
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

          {/* Notas */}
          <div className="space-y-2">
            <Label>Notas / Instrucciones</Label>
            <Textarea
              value={formData.notas}
              onChange={(e) => setFormData((prev) => ({ ...prev, notas: e.target.value }))}
              placeholder="Instrucciones especiales para la entrega..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
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
                  {isEditing ? 'Guardar Cambios' : 'Crear Entrega'}
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
