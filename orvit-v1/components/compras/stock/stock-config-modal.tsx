'use client';

import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Package, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';

const configSchema = z.object({
  stockMinimo: z.coerce.number().min(0, 'Debe ser >= 0').optional().nullable(),
  stockMaximo: z.coerce.number().min(0, 'Debe ser >= 0').optional().nullable(),
  puntoReposicion: z.coerce.number().min(0, 'Debe ser >= 0').optional().nullable(),
  criticidad: z.enum(['A', 'B', 'C', 'CRITICO', '']).optional().nullable(),
  ubicacionFisica: z.string().max(100).optional().nullable(),
}).refine((data) => {
  if (data.stockMinimo && data.stockMaximo && data.stockMinimo > data.stockMaximo) {
    return false;
  }
  return true;
}, {
  message: 'El stock mínimo no puede ser mayor al máximo',
  path: ['stockMinimo'],
});

type ConfigFormData = z.infer<typeof configSchema>;

interface StockItem {
  id: number;
  supplierItemId: number;
  supplierItemNombre: string;
  warehouseId: number;
  warehouseCodigo: string;
  stockMinimo?: number | null;
  stockMaximo?: number | null;
  puntoReposicion?: number | null;
  criticidad?: string | null;
  ubicacionFisica?: string | null;
  cantidad: number;
}

interface StockConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: StockItem | null;
  onSaved?: () => void;
}

export function StockConfigModal({
  open,
  onOpenChange,
  item,
  onSaved,
}: StockConfigModalProps) {
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
  });

  // Cargar datos del item cuando se abre el modal
  useEffect(() => {
    if (open && item) {
      reset({
        stockMinimo: item.stockMinimo ?? null,
        stockMaximo: item.stockMaximo ?? null,
        puntoReposicion: item.puntoReposicion ?? null,
        criticidad: (item.criticidad as any) ?? '',
        ubicacionFisica: item.ubicacionFisica ?? '',
      });
    }
  }, [open, item, reset]);

  const criticidad = watch('criticidad');
  const stockMinimo = watch('stockMinimo');

  const onSubmit = async (data: ConfigFormData) => {
    if (!item) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/compras/stock/ubicaciones/${item.id}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockMinimo: data.stockMinimo || null,
          stockMaximo: data.stockMaximo || null,
          puntoReposicion: data.puntoReposicion || null,
          criticidad: data.criticidad || null,
          ubicacionFisica: data.ubicacionFisica || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar configuración');
      }

      toast.success('Configuración guardada');
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error(error instanceof Error ? error.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Configurar Stock
          </DialogTitle>
          <DialogDescription>
            {item.supplierItemNombre} en {item.warehouseCodigo}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Info actual */}
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">Stock actual</div>
            <div className="text-2xl font-semibold">{item.cantidad}</div>
          </div>

          {/* Niveles de stock */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stockMinimo">Stock Mínimo</Label>
              <Input
                id="stockMinimo"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                {...register('stockMinimo')}
              />
              {errors.stockMinimo && (
                <p className="text-xs text-destructive">{errors.stockMinimo.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Alerta cuando disponible + en camino &lt; mínimo
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stockMaximo">Stock Máximo</Label>
              <Input
                id="stockMaximo"
                type="number"
                step="0.01"
                min="0"
                placeholder="Sin límite"
                {...register('stockMaximo')}
              />
              {errors.stockMaximo && (
                <p className="text-xs text-destructive">{errors.stockMaximo.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Alerta de exceso cuando stock &gt; máximo
              </p>
            </div>
          </div>

          {/* Punto de reposición */}
          <div className="space-y-2">
            <Label htmlFor="puntoReposicion">
              Punto de Reposición
              <span className="text-muted-foreground font-normal ml-1">(opcional)</span>
            </Label>
            <Input
              id="puntoReposicion"
              type="number"
              step="0.01"
              min="0"
              placeholder={stockMinimo ? String(stockMinimo) : 'Igual al mínimo'}
              {...register('puntoReposicion')}
            />
            <p className="text-xs text-muted-foreground">
              Si no se especifica, se usa el stock mínimo
            </p>
          </div>

          {/* Criticidad */}
          <div className="space-y-2">
            <Label>Criticidad</Label>
            <Select
              value={criticidad || ''}
              onValueChange={(value) => setValue('criticidad', value as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin clasificar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin clasificar</SelectItem>
                <SelectItem value="A">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    A - Alta rotación / Alto valor
                  </div>
                </SelectItem>
                <SelectItem value="B">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    B - Media rotación / Medio valor
                  </div>
                </SelectItem>
                <SelectItem value="C">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    C - Baja rotación / Bajo valor
                  </div>
                </SelectItem>
                <SelectItem value="CRITICO">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-red-600" />
                    CRÍTICO - Sin sustituto / Vital
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Clasificación ABC para priorizar gestión de inventario
            </p>
          </div>

          {/* Ubicación física */}
          <div className="space-y-2">
            <Label htmlFor="ubicacionFisica">
              Ubicación Física
              <span className="text-muted-foreground font-normal ml-1">(opcional)</span>
            </Label>
            <Input
              id="ubicacionFisica"
              placeholder="Ej: Pasillo A, Estante 3, Nivel 2"
              maxLength={100}
              {...register('ubicacionFisica')}
            />
          </div>

          {/* Info box */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3 flex gap-2">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <p className="font-medium">Fórmula de reposición</p>
              <p className="text-xs mt-1">
                Se sugiere reposición cuando: <br />
                <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">
                  Disponible + En Camino ≤ Punto de Reposición
                </code>
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
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
