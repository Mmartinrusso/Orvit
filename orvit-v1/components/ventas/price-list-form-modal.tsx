'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tag, Save, Loader2, Calendar, Percent, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

// =====================================================
// TYPES
// =====================================================

interface PriceListFormData {
  nombre: string;
  descripcion: string;
  tipoAjuste: 'PORCENTAJE' | 'MONTO_FIJO';
  valorAjuste: number;
  moneda: string;
  fechaVigenciaDesde: string;
  fechaVigenciaHasta: string;
  activa: boolean;
  esDefault: boolean;
  aplicaA: 'TODOS' | 'SEGMENTO' | 'CLIENTE_ESPECIFICO';
  segmentoId?: string;
  clienteId?: number;
}

interface PriceList {
  id: number;
  nombre: string;
  descripcion?: string;
  tipoAjuste: string;
  valorAjuste: number;
  moneda: string;
  fechaVigenciaDesde?: string;
  fechaVigenciaHasta?: string;
  activa: boolean;
  esDefault: boolean;
  aplicaA?: string;
  segmentoId?: string;
  clienteId?: number;
}

interface PriceListFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceList?: PriceList | null; // For editing
  onSuccess?: () => void;
}

// =====================================================
// DEFAULT VALUES
// =====================================================

const DEFAULT_FORM_DATA: PriceListFormData = {
  nombre: '',
  descripcion: '',
  tipoAjuste: 'PORCENTAJE',
  valorAjuste: 0,
  moneda: 'ARS',
  fechaVigenciaDesde: '',
  fechaVigenciaHasta: '',
  activa: true,
  esDefault: false,
  aplicaA: 'TODOS',
};

// =====================================================
// COMPONENT
// =====================================================

export function PriceListFormModal({
  open,
  onOpenChange,
  priceList,
  onSuccess,
}: PriceListFormModalProps) {
  const isEditing = !!priceList;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<PriceListFormData>(DEFAULT_FORM_DATA);

  // Initialize form when editing
  useEffect(() => {
    if (priceList) {
      setFormData({
        nombre: priceList.nombre || '',
        descripcion: priceList.descripcion || '',
        tipoAjuste: (priceList.tipoAjuste as 'PORCENTAJE' | 'MONTO_FIJO') || 'PORCENTAJE',
        valorAjuste: priceList.valorAjuste || 0,
        moneda: priceList.moneda || 'ARS',
        fechaVigenciaDesde: priceList.fechaVigenciaDesde?.split('T')[0] || '',
        fechaVigenciaHasta: priceList.fechaVigenciaHasta?.split('T')[0] || '',
        activa: priceList.activa ?? true,
        esDefault: priceList.esDefault ?? false,
        aplicaA: (priceList.aplicaA as 'TODOS' | 'SEGMENTO' | 'CLIENTE_ESPECIFICO') || 'TODOS',
        segmentoId: priceList.segmentoId,
        clienteId: priceList.clienteId,
      });
    } else {
      setFormData(DEFAULT_FORM_DATA);
    }
  }, [priceList, open]);

  const handleSubmit = async () => {
    // Validation
    if (!formData.nombre.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    if (formData.valorAjuste === 0 && formData.tipoAjuste === 'PORCENTAJE') {
      toast.error('El porcentaje de ajuste no puede ser 0');
      return;
    }

    setLoading(true);
    try {
      const url = isEditing
        ? `/api/ventas/listas-precios/${priceList.id}`
        : '/api/ventas/listas-precios';

      const body = {
        ...formData,
        fechaVigenciaDesde: formData.fechaVigenciaDesde
          ? new Date(formData.fechaVigenciaDesde).toISOString()
          : null,
        fechaVigenciaHasta: formData.fechaVigenciaHasta
          ? new Date(formData.fechaVigenciaHasta).toISOString()
          : null,
      };

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(isEditing ? 'Lista actualizada' : 'Lista creada');
        onOpenChange(false);
        onSuccess?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al guardar lista de precios');
    } finally {
      setLoading(false);
    }
  };

  // Preview calculation
  const previewPrice = (basePrice: number) => {
    if (formData.tipoAjuste === 'PORCENTAJE') {
      return basePrice * (1 + formData.valorAjuste / 100);
    }
    return basePrice + formData.valorAjuste;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            {isEditing ? 'Editar Lista de Precios' : 'Nueva Lista de Precios'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los datos de la lista de precios'
              : 'Crea una nueva lista con ajustes de precios'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Nombre */}
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              value={formData.nombre}
              onChange={(e) => setFormData((prev) => ({ ...prev, nombre: e.target.value }))}
              placeholder="Ej: Lista Mayorista, Precios VIP"
            />
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) => setFormData((prev) => ({ ...prev, descripcion: e.target.value }))}
              placeholder="Descripción opcional de la lista"
              rows={2}
            />
          </div>

          {/* Tipo y Valor de Ajuste */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Ajuste</Label>
              <Select
                value={formData.tipoAjuste}
                onValueChange={(v: 'PORCENTAJE' | 'MONTO_FIJO') =>
                  setFormData((prev) => ({ ...prev, tipoAjuste: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PORCENTAJE">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4" />
                      Porcentaje
                    </div>
                  </SelectItem>
                  <SelectItem value="MONTO_FIJO">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Monto Fijo
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {formData.tipoAjuste === 'PORCENTAJE' ? 'Porcentaje (%)' : 'Monto ($)'}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step={formData.tipoAjuste === 'PORCENTAJE' ? '0.1' : '1'}
                  value={formData.valorAjuste}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      valorAjuste: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-28"
                />
                <Badge
                  variant={formData.valorAjuste >= 0 ? 'default' : 'destructive'}
                  className="whitespace-nowrap"
                >
                  {formData.valorAjuste >= 0 ? '+' : ''}
                  {formData.valorAjuste}
                  {formData.tipoAjuste === 'PORCENTAJE' ? '%' : '$'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-muted rounded-lg p-3">
            <p className="text-sm text-muted-foreground mb-2">Vista previa:</p>
            <div className="flex items-center gap-4 text-sm">
              <span>Base: $1,000</span>
              <span>→</span>
              <span className="font-medium">
                Final: ${previewPrice(1000).toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          {/* Vigencia */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Vigente desde
              </Label>
              <Input
                type="date"
                value={formData.fechaVigenciaDesde}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, fechaVigenciaDesde: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Vigente hasta</Label>
              <Input
                type="date"
                value={formData.fechaVigenciaHasta}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, fechaVigenciaHasta: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Aplica A */}
          <div className="space-y-2">
            <Label>Aplicar a</Label>
            <Select
              value={formData.aplicaA}
              onValueChange={(v: 'TODOS' | 'SEGMENTO' | 'CLIENTE_ESPECIFICO') =>
                setFormData((prev) => ({ ...prev, aplicaA: v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos los clientes</SelectItem>
                <SelectItem value="SEGMENTO">Segmento específico</SelectItem>
                <SelectItem value="CLIENTE_ESPECIFICO">Cliente específico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Switches */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="activa"
                  checked={formData.activa}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, activa: checked }))
                  }
                />
                <Label htmlFor="activa">Activa</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="esDefault"
                  checked={formData.esDefault}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, esDefault: checked }))
                  }
                />
                <Label htmlFor="esDefault">Lista por defecto</Label>
              </div>
            </div>
          </div>
        </DialogBody>

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
                {isEditing ? 'Guardar Cambios' : 'Crear Lista'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
