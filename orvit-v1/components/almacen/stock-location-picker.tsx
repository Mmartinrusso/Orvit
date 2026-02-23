'use client';

import { formatNumber } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Package,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

export interface StockLocationOption {
  id: number;
  cantidad: number;
  cantidadReservada: number;
  disponible: number;
  ubicacion?: string;
  ubicacionFisica?: string;
  lote?: string;
  fechaVencimiento?: string;
  costoUnitario?: number;
  fechaEntrada?: string;
}

interface StockLocationPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierItemId: number;
  supplierItemName: string;
  warehouseId: number;
  quantityNeeded: number;
  onSelect: (selections: Array<{ locationId: number; quantity: number; lote?: string }>) => void;
  companyId: number;
}

type PickMethod = 'FIFO' | 'FEFO' | 'MANUAL';

export function StockLocationPicker({
  open,
  onOpenChange,
  supplierItemId,
  supplierItemName,
  warehouseId,
  quantityNeeded,
  onSelect,
  companyId,
}: StockLocationPickerProps) {
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<StockLocationOption[]>([]);
  const [pickMethod, setPickMethod] = useState<PickMethod>('FIFO');
  const [manualSelections, setManualSelections] = useState<Record<number, number>>({});

  // Fetch stock locations
  useEffect(() => {
    const fetchLocations = async () => {
      if (!open || !supplierItemId || !warehouseId) return;

      setLoading(true);
      try {
        const res = await fetch(
          `/api/compras/stock/ubicaciones?companyId=${companyId}&warehouseId=${warehouseId}&supplierItemId=${supplierItemId}`
        );
        if (res.ok) {
          const data = await res.json();
          const locs = (data.ubicaciones || data.data || []).map((loc: any) => ({
            id: loc.id,
            cantidad: Number(loc.cantidad || 0),
            cantidadReservada: Number(loc.cantidadReservada || 0),
            disponible: Number(loc.cantidad || 0) - Number(loc.cantidadReservada || 0),
            ubicacion: loc.ubicacion,
            ubicacionFisica: loc.ubicacionFisica,
            lote: loc.lote,
            fechaVencimiento: loc.fechaVencimiento,
            costoUnitario: loc.costoUnitario ? Number(loc.costoUnitario) : undefined,
            fechaEntrada: loc.createdAt || loc.fechaEntrada,
          }));
          setLocations(locs.filter((l: StockLocationOption) => l.disponible > 0));
        }
      } catch (error) {
        console.error('Error fetching locations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, [open, supplierItemId, warehouseId, companyId]);

  // Reset selections when method changes
  useEffect(() => {
    setManualSelections({});
  }, [pickMethod]);

  // Sort locations based on pick method
  const getSortedLocations = (): StockLocationOption[] => {
    const sorted = [...locations];

    switch (pickMethod) {
      case 'FIFO':
        // First In, First Out - sort by entry date (oldest first)
        return sorted.sort((a, b) => {
          const dateA = a.fechaEntrada ? new Date(a.fechaEntrada).getTime() : 0;
          const dateB = b.fechaEntrada ? new Date(b.fechaEntrada).getTime() : 0;
          return dateA - dateB;
        });

      case 'FEFO':
        // First Expired, First Out - sort by expiration date (soonest first)
        return sorted.sort((a, b) => {
          // Items without expiration go last
          if (!a.fechaVencimiento && !b.fechaVencimiento) return 0;
          if (!a.fechaVencimiento) return 1;
          if (!b.fechaVencimiento) return -1;
          return new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime();
        });

      case 'MANUAL':
      default:
        return sorted;
    }
  };

  // Calculate auto-selections for FIFO/FEFO
  const getAutoSelections = (): Array<{ locationId: number; quantity: number; lote?: string }> => {
    const sorted = getSortedLocations();
    const selections: Array<{ locationId: number; quantity: number; lote?: string }> = [];
    let remaining = quantityNeeded;

    for (const loc of sorted) {
      if (remaining <= 0) break;

      const toTake = Math.min(remaining, loc.disponible);
      if (toTake > 0) {
        selections.push({
          locationId: loc.id,
          quantity: toTake,
          lote: loc.lote,
        });
        remaining -= toTake;
      }
    }

    return selections;
  };

  // Get selections based on method
  const getSelections = (): Array<{ locationId: number; quantity: number; lote?: string }> => {
    if (pickMethod === 'MANUAL') {
      return Object.entries(manualSelections)
        .filter(([_, qty]) => qty > 0)
        .map(([locId, qty]) => {
          const loc = locations.find((l) => l.id === Number(locId));
          return {
            locationId: Number(locId),
            quantity: qty,
            lote: loc?.lote,
          };
        });
    }
    return getAutoSelections();
  };

  const totalSelected = getSelections().reduce((acc, s) => acc + s.quantity, 0);
  const isComplete = totalSelected >= quantityNeeded;
  const totalAvailable = locations.reduce((acc, l) => acc + l.disponible, 0);

  const handleManualChange = (locationId: number, value: string) => {
    const qty = parseFloat(value) || 0;
    const loc = locations.find((l) => l.id === locationId);
    const maxQty = loc?.disponible || 0;

    setManualSelections({
      ...manualSelections,
      [locationId]: Math.min(Math.max(0, qty), maxQty),
    });
  };

  const handleConfirm = () => {
    const selections = getSelections();
    onSelect(selections);
    onOpenChange(false);
  };

  const getExpirationBadge = (fecha?: string) => {
    if (!fecha) return null;

    const days = differenceInDays(new Date(fecha), new Date());

    if (days < 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          Vencido
        </Badge>
      );
    }
    if (days <= 30) {
      return (
        <Badge className="bg-warning-muted text-warning-muted-foreground text-xs">
          {days} días
        </Badge>
      );
    }
    if (days <= 90) {
      return (
        <Badge className="bg-warning-muted text-warning-muted-foreground text-xs">
          {days} días
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        {format(new Date(fecha), 'dd/MM/yyyy', { locale: es })}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Seleccionar Ubicaciones de Stock
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Item Info */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="font-medium">{supplierItemName}</p>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span>Necesario: <strong className="text-foreground">{quantityNeeded}</strong></span>
              <span>Disponible: <strong className={totalAvailable >= quantityNeeded ? 'text-success' : 'text-destructive'}>{formatNumber(totalAvailable, 2)}</strong></span>
            </div>
          </div>

          {/* Pick Method Selection */}
          <div className="space-y-2">
            <Label>Método de Asignación</Label>
            <RadioGroup
              value={pickMethod}
              onValueChange={(v) => setPickMethod(v as PickMethod)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="FIFO" id="fifo" />
                <Label htmlFor="fifo" className="cursor-pointer">
                  FIFO (Primero en Entrar)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="FEFO" id="fefo" />
                <Label htmlFor="fefo" className="cursor-pointer">
                  FEFO (Primero en Vencer)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="MANUAL" id="manual" />
                <Label htmlFor="manual" className="cursor-pointer">
                  Manual
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Locations Table */}
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              Cargando ubicaciones...
            </div>
          ) : locations.length === 0 ? (
            <div className="py-8 text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No hay stock disponible</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                  {pickMethod === 'MANUAL' ? (
                    <TableHead className="w-[120px]">Cantidad</TableHead>
                  ) : (
                    <TableHead className="text-right">Asignado</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {getSortedLocations().map((loc, index) => {
                  const autoSelection = getAutoSelections().find(
                    (s) => s.locationId === loc.id
                  );
                  const isSelected =
                    pickMethod === 'MANUAL'
                      ? (manualSelections[loc.id] || 0) > 0
                      : !!autoSelection;

                  return (
                    <TableRow
                      key={loc.id}
                      className={isSelected ? 'bg-primary/5' : ''}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{loc.ubicacionFisica || loc.ubicacion || `Ubicación ${index + 1}`}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {loc.lote ? (
                          <Badge variant="outline">{loc.lote}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {loc.fechaVencimiento ? (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {getExpirationBadge(loc.fechaVencimiento)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(loc.disponible, 2)}
                      </TableCell>
                      {pickMethod === 'MANUAL' ? (
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={loc.disponible}
                            step="0.01"
                            value={manualSelections[loc.id] || ''}
                            onChange={(e) => handleManualChange(loc.id, e.target.value)}
                            placeholder="0"
                            className="w-full"
                          />
                        </TableCell>
                      ) : (
                        <TableCell className="text-right">
                          {autoSelection ? (
                            <span className="font-mono text-primary font-medium">
                              {formatNumber(autoSelection.quantity, 2)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Summary */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              {isComplete ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-warning-muted-foreground" />
              )}
              <span>
                Total seleccionado:{' '}
                <strong className={isComplete ? 'text-success' : 'text-warning-muted-foreground'}>
                  {formatNumber(totalSelected, 2)}
                </strong>{' '}
                de {quantityNeeded}
              </span>
            </div>
            {!isComplete && totalAvailable < quantityNeeded && (
              <Badge variant="destructive">Stock insuficiente</Badge>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={totalSelected === 0}>
            Confirmar Selección
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
