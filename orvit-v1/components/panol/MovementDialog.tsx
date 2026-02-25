'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowLeftRight,
  Minus,
  RotateCcw,
  Save,
  Package,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCompany } from '@/contexts/CompanyContext';

type MovementType = 'IN' | 'OUT' | 'TRANSFER' | 'RETURN' | 'ADJUSTMENT';

const TYPE_CONFIG: Record<MovementType, {
  label: string;
  icon: React.ElementType;
  badgeClass: string;
  stockEffect: 'add' | 'subtract' | 'none' | 'adjust';
  reasons: { value: string; label: string }[];
}> = {
  IN: {
    label: 'Entrada',
    icon: ArrowUpCircle,
    badgeClass: 'bg-success-muted text-success',
    stockEffect: 'add',
    reasons: [
      { value: 'Compra', label: 'Compra' },
      { value: 'Reposición', label: 'Reposición' },
      { value: 'Reparación completada', label: 'Reparación completada' },
      { value: 'Donación', label: 'Donación' },
    ],
  },
  OUT: {
    label: 'Salida',
    icon: ArrowDownCircle,
    badgeClass: 'bg-destructive/10 text-destructive',
    stockEffect: 'subtract',
    reasons: [
      { value: 'Mantenimiento', label: 'Mantenimiento' },
      { value: 'Uso en obra', label: 'Uso en obra' },
      { value: 'Daño/Pérdida', label: 'Daño / Pérdida' },
      { value: 'Baja definitiva', label: 'Baja definitiva' },
    ],
  },
  TRANSFER: {
    label: 'Transferencia',
    icon: ArrowLeftRight,
    badgeClass: 'bg-info-muted text-info-muted-foreground',
    stockEffect: 'none',
    reasons: [
      { value: 'Cambio de ubicación', label: 'Cambio de ubicación' },
      { value: 'Reasignación de sector', label: 'Reasignación de sector' },
      { value: 'Reorganización', label: 'Reorganización' },
    ],
  },
  RETURN: {
    label: 'Devolución',
    icon: RotateCcw,
    badgeClass: 'bg-accent-purple-muted text-accent-purple-muted-foreground',
    stockEffect: 'add',
    reasons: [
      { value: 'Devolución de préstamo', label: 'Devolución de préstamo' },
      { value: 'Devolución de mantenimiento', label: 'Devolución de mantenimiento' },
      { value: 'Devolución de obra', label: 'Devolución de obra' },
      { value: 'Material no utilizado', label: 'Material no utilizado' },
    ],
  },
  ADJUSTMENT: {
    label: 'Ajuste',
    icon: Minus,
    badgeClass: 'bg-warning-muted text-warning-muted-foreground',
    stockEffect: 'adjust',
    reasons: [
      { value: 'Inventario físico', label: 'Inventario físico' },
      { value: 'Corrección de error', label: 'Corrección de error' },
      { value: 'Merma', label: 'Merma' },
      { value: 'Rotura', label: 'Rotura' },
      { value: 'Vencimiento', label: 'Vencimiento' },
    ],
  },
};

interface Tool {
  id: number;
  name: string;
  stockQuantity: number;
  location: string;
}

interface MovementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

export default function MovementDialog({ isOpen, onClose, onSave }: MovementDialogProps) {
  const { currentCompany } = useCompany();
  const [formData, setFormData] = useState({
    toolId: '',
    type: 'IN' as MovementType,
    quantity: 1,
    reason: '',
    notes: '',
    responsiblePerson: '',
    toLocation: '',
  });

  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTools, setIsLoadingTools] = useState(false);

  const config = TYPE_CONFIG[formData.type];

  useEffect(() => {
    if (isOpen) {
      fetchTools();
      resetForm();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (formData.toolId) {
      const tool = tools.find(t => t.id.toString() === formData.toolId);
      setSelectedTool(tool || null);
    } else {
      setSelectedTool(null);
    }
  }, [formData.toolId, tools]);

  const fetchTools = async () => {
    if (!currentCompany?.id) return;
    setIsLoadingTools(true);
    try {
      const response = await fetch(`/api/tools?companyId=${currentCompany.id}`);
      if (response.ok) {
        const data = await response.json();
        const toolsArray = Array.isArray(data) ? data : (data?.tools || data?.items || []);
        setTools(toolsArray);
      }
    } catch {
      toast.error('Error al cargar herramientas');
      setTools([]);
    } finally {
      setIsLoadingTools(false);
    }
  };

  const resetForm = () => {
    setFormData({
      toolId: '',
      type: 'IN',
      quantity: 1,
      reason: '',
      notes: '',
      responsiblePerson: '',
      toLocation: '',
    });
    setSelectedTool(null);
  };

  const stockAfter = useMemo(() => {
    if (!selectedTool) return null;
    switch (config.stockEffect) {
      case 'add': return selectedTool.stockQuantity + formData.quantity;
      case 'subtract': return selectedTool.stockQuantity - formData.quantity;
      case 'none': return selectedTool.stockQuantity;
      case 'adjust': return formData.quantity; // quantity = stock nuevo deseado
      default: return selectedTool.stockQuantity;
    }
  }, [selectedTool, formData.quantity, config.stockEffect]);

  const isStockInsufficient = config.stockEffect === 'subtract'
    && selectedTool
    && formData.quantity > selectedTool.stockQuantity;

  const handleSave = async () => {
    if (!formData.toolId || !formData.reason || !formData.responsiblePerson) {
      toast.error('Herramienta, motivo y responsable son requeridos');
      return;
    }

    if (config.stockEffect !== 'adjust' && formData.quantity <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    if (isStockInsufficient) {
      toast.error('No hay suficiente stock disponible');
      return;
    }

    if (formData.type === 'TRANSFER' && !formData.toLocation) {
      toast.error('Destino es requerido para transferencias');
      return;
    }

    setIsLoading(true);
    toast.loading('Registrando movimiento...', { id: 'movement' });

    try {
      // Para ADJUSTMENT: calcular el delta (nuevo - actual)
      const sendQuantity = config.stockEffect === 'adjust' && selectedTool
        ? formData.quantity - selectedTool.stockQuantity
        : formData.quantity;

      const response = await fetch('/api/tools/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: parseInt(formData.toolId),
          type: formData.type,
          quantity: sendQuantity,
          reason: `${formData.reason} - Responsable: ${formData.responsiblePerson}`,
          notes: formData.notes || undefined,
          toLocation: formData.toLocation || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al registrar movimiento');
      }

      const result = await response.json();
      toast.success(result.message || `${config.label} registrada`, { id: 'movement' });
      onSave?.();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al registrar el movimiento';
      toast.error(message, { id: 'movement' });
    } finally {
      setIsLoading(false);
    }
  };

  const TypeIcon = config.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            Registrar Movimiento
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-5">
            {/* Tipo de Movimiento */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                Tipo de Movimiento
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(Object.keys(TYPE_CONFIG) as MovementType[]).map((type) => {
                  const tc = TYPE_CONFIG[type];
                  const Icon = tc.icon;
                  return (
                    <Button
                      key={type}
                      variant={formData.type === type ? 'default' : 'outline'}
                      size="sm"
                      className="h-9"
                      onClick={() => setFormData(prev => ({ ...prev, type, reason: '' }))}
                    >
                      <Icon className="h-4 w-4 mr-1.5" />
                      <span className="truncate">{tc.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Herramienta */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Item / Herramienta *
              </Label>
              <Select
                value={formData.toolId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, toolId: value }))}
                disabled={isLoadingTools}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={isLoadingTools ? 'Cargando...' : 'Seleccionar'} />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingTools ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm text-muted-foreground">Cargando...</span>
                    </div>
                  ) : tools.length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      No hay items disponibles
                    </div>
                  ) : (
                    tools.map((tool) => (
                      <SelectItem key={tool.id} value={tool.id.toString()}>
                        {tool.name} (Stock: {tool.stockQuantity})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Cantidad + Responsable */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  {config.stockEffect === 'adjust' ? 'Stock Nuevo *' : 'Cantidad *'}
                </Label>
                <Input
                  type="number"
                  min={config.stockEffect === 'adjust' ? 0 : 1}
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData(prev => ({
                      ...prev,
                      quantity: parseInt(e.target.value) || (config.stockEffect === 'adjust' ? 0 : 1),
                    }))
                  }
                  className="h-9"
                />
                {isStockInsufficient && (
                  <p className="text-destructive text-xs mt-1">
                    Stock insuficiente (disponible: {selectedTool?.stockQuantity})
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Responsable *
                </Label>
                <Input
                  value={formData.responsiblePerson}
                  onChange={(e) => setFormData(prev => ({ ...prev, responsiblePerson: e.target.value }))}
                  placeholder="Nombre"
                  className="h-9"
                />
              </div>
            </div>

            {/* Destino (solo TRANSFER) */}
            {formData.type === 'TRANSFER' && (
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Ubicación Destino *
                </Label>
                <Input
                  value={formData.toLocation}
                  onChange={(e) => setFormData(prev => ({ ...prev, toLocation: e.target.value }))}
                  placeholder="Ej: Depósito B, Sector 3..."
                  className="h-9"
                />
              </div>
            )}

            {/* Motivo */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Motivo *
              </Label>
              <Select
                value={formData.reason}
                onValueChange={(value) => setFormData(prev => ({ ...prev, reason: value }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleccionar motivo" />
                </SelectTrigger>
                <SelectContent>
                  {config.reasons.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notas */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Notas
              </Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Detalles adicionales..."
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Resumen */}
            {selectedTool && (
              <div className="p-3 rounded-lg border bg-muted/30 space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Item</span>
                  <span className="font-medium">{selectedTool.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tipo</span>
                  <Badge className={cn('text-xs', config.badgeClass)}>
                    <TypeIcon className="h-3 w-3 mr-1" />
                    {config.label}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {config.stockEffect === 'adjust' ? 'Stock nuevo' : 'Cantidad'}
                  </span>
                  <span className="font-medium">{formData.quantity}</span>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t">
                  <span className="text-muted-foreground">Stock actual → después</span>
                  <span>
                    {selectedTool.stockQuantity}
                    <span className="text-muted-foreground mx-1">→</span>
                    <span className={cn('font-bold',
                      stockAfter !== null && stockAfter > selectedTool.stockQuantity ? 'text-success' :
                      stockAfter !== null && stockAfter < selectedTool.stockQuantity ? 'text-destructive' :
                      'text-foreground'
                    )}>
                      {stockAfter}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isLoading || isLoadingTools || !!isStockInsufficient}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Registrar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
