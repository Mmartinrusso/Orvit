'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Users,
  Save,
  Plus,
  Trash2,
  Edit2,
  Tag,
  Percent,
  DollarSign,
  Crown,
  Building2,
  ShoppingCart,
  Star,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

// =====================================================
// TYPES
// =====================================================

type PricingType = 'DISCOUNT_PERCENT' | 'MARKUP_PERCENT' | 'FIXED_PRICE_LIST';

interface CustomerSegment {
  id: string;
  name: string;
  code: string;
  description?: string;
  icon: string;
  color: string;
  pricingType: PricingType;
  value: number; // percent or price list ID
  priceListId?: number;
  priority: number; // higher = more priority
  minPurchaseAmount?: number;
  isDefault?: boolean;
}

interface SegmentPricingConfig {
  enabled: boolean;
  segments: CustomerSegment[];
  defaultSegmentId?: string;
  applyToQuotes: boolean;
  applyToOrders: boolean;
  applyToInvoices: boolean;
  allowManualOverride: boolean;
  showSegmentOnDocuments: boolean;
}

interface SegmentPricingConfigProps {
  config: Partial<SegmentPricingConfig>;
  onSave: (config: SegmentPricingConfig) => Promise<void>;
  priceLists?: { id: number; name: string }[];
}

// =====================================================
// DEFAULT CONFIG
// =====================================================

const DEFAULT_CONFIG: SegmentPricingConfig = {
  enabled: false,
  segments: [],
  applyToQuotes: true,
  applyToOrders: true,
  applyToInvoices: true,
  allowManualOverride: true,
  showSegmentOnDocuments: false,
};

const SEGMENT_ICONS = [
  { value: 'crown', label: 'VIP', Icon: Crown },
  { value: 'building', label: 'Empresa', Icon: Building2 },
  { value: 'cart', label: 'Minorista', Icon: ShoppingCart },
  { value: 'star', label: 'Premium', Icon: Star },
  { value: 'users', label: 'Mayorista', Icon: Users },
  { value: 'tag', label: 'Etiqueta', Icon: Tag },
];

const SEGMENT_COLORS = [
  { value: 'purple', label: 'Púrpura', class: 'bg-purple-100 text-purple-700' },
  { value: 'blue', label: 'Azul', class: 'bg-blue-100 text-blue-700' },
  { value: 'green', label: 'Verde', class: 'bg-green-100 text-green-700' },
  { value: 'yellow', label: 'Amarillo', class: 'bg-yellow-100 text-yellow-700' },
  { value: 'red', label: 'Rojo', class: 'bg-red-100 text-red-700' },
  { value: 'orange', label: 'Naranja', class: 'bg-orange-100 text-orange-700' },
  { value: 'pink', label: 'Rosa', class: 'bg-pink-100 text-pink-700' },
  { value: 'gray', label: 'Gris', class: 'bg-gray-100 text-gray-700' },
];

const PRICING_TYPES: { value: PricingType; label: string; description: string }[] = [
  {
    value: 'DISCOUNT_PERCENT',
    label: 'Descuento %',
    description: 'Aplica un descuento porcentual sobre el precio base',
  },
  {
    value: 'MARKUP_PERCENT',
    label: 'Recargo %',
    description: 'Aplica un recargo porcentual sobre el precio base',
  },
  {
    value: 'FIXED_PRICE_LIST',
    label: 'Lista de Precios',
    description: 'Usa una lista de precios específica para este segmento',
  },
];

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function generateId(): string {
  return `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getIconComponent(iconName: string) {
  const found = SEGMENT_ICONS.find((i) => i.value === iconName);
  return found?.Icon || Tag;
}

function getColorClass(colorName: string): string {
  const found = SEGMENT_COLORS.find((c) => c.value === colorName);
  return found?.class || 'bg-gray-100 text-gray-700';
}

// =====================================================
// COMPONENT
// =====================================================

export function SegmentPricingConfig({
  config,
  onSave,
  priceLists = [],
}: SegmentPricingConfigProps) {
  const [pricingConfig, setPricingConfig] = useState<SegmentPricingConfig>({
    ...DEFAULT_CONFIG,
    ...config,
    segments: config?.segments || [],
  });

  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<CustomerSegment | null>(null);

  // Form state for segment dialog
  const [formData, setFormData] = useState<Partial<CustomerSegment>>({
    name: '',
    code: '',
    description: '',
    icon: 'tag',
    color: 'blue',
    pricingType: 'DISCOUNT_PERCENT',
    value: 0,
    priority: 1,
    minPurchaseAmount: undefined,
    isDefault: false,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(pricingConfig);
      toast.success('Configuración de segmentos guardada');
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const openAddDialog = () => {
    setEditingSegment(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      icon: 'tag',
      color: 'blue',
      pricingType: 'DISCOUNT_PERCENT',
      value: 0,
      priority: pricingConfig.segments.length + 1,
      minPurchaseAmount: undefined,
      isDefault: false,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (segment: CustomerSegment) => {
    setEditingSegment(segment);
    setFormData({ ...segment });
    setDialogOpen(true);
  };

  const handleSaveSegment = () => {
    if (!formData.name || !formData.code) {
      toast.error('Nombre y código son requeridos');
      return;
    }

    // Check for duplicate code
    const existingWithCode = pricingConfig.segments.find(
      (s) => s.code === formData.code && s.id !== editingSegment?.id
    );
    if (existingWithCode) {
      toast.error('Ya existe un segmento con ese código');
      return;
    }

    const segment: CustomerSegment = {
      id: editingSegment?.id || generateId(),
      name: formData.name!,
      code: formData.code!,
      description: formData.description,
      icon: formData.icon || 'tag',
      color: formData.color || 'blue',
      pricingType: formData.pricingType || 'DISCOUNT_PERCENT',
      value: formData.value || 0,
      priceListId: formData.priceListId,
      priority: formData.priority || 1,
      minPurchaseAmount: formData.minPurchaseAmount,
      isDefault: formData.isDefault || false,
    };

    if (editingSegment) {
      // Update
      setPricingConfig((prev) => ({
        ...prev,
        segments: prev.segments.map((s) => (s.id === editingSegment.id ? segment : s)),
      }));
    } else {
      // Add
      setPricingConfig((prev) => ({
        ...prev,
        segments: [...prev.segments, segment],
      }));
    }

    setDialogOpen(false);
    toast.success(editingSegment ? 'Segmento actualizado' : 'Segmento agregado');
  };

  const handleDeleteSegment = (id: string) => {
    setPricingConfig((prev) => ({
      ...prev,
      segments: prev.segments.filter((s) => s.id !== id),
      defaultSegmentId: prev.defaultSegmentId === id ? undefined : prev.defaultSegmentId,
    }));
    toast.success('Segmento eliminado');
  };

  const handleSetDefault = (id: string) => {
    setPricingConfig((prev) => ({
      ...prev,
      defaultSegmentId: prev.defaultSegmentId === id ? undefined : id,
      segments: prev.segments.map((s) => ({
        ...s,
        isDefault: s.id === id,
      })),
    }));
  };

  const formatPricingValue = (segment: CustomerSegment): string => {
    switch (segment.pricingType) {
      case 'DISCOUNT_PERCENT':
        return `-${segment.value}%`;
      case 'MARKUP_PERCENT':
        return `+${segment.value}%`;
      case 'FIXED_PRICE_LIST':
        const list = priceLists.find((p) => p.id === segment.priceListId);
        return list?.name || 'Lista no encontrada';
      default:
        return String(segment.value);
    }
  };

  // Preview calculation
  const PreviewCalculation = () => {
    const basePrice = 1000;

    return (
      <div className="bg-muted rounded-lg p-4 mt-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Vista Previa de Precios
        </h4>
        <p className="text-sm text-muted-foreground mb-3">
          Precio base de ejemplo: ${basePrice.toLocaleString()}
        </p>
        <div className="space-y-2">
          {pricingConfig.segments
            .filter((s) => s.pricingType !== 'FIXED_PRICE_LIST')
            .map((segment) => {
              let finalPrice = basePrice;
              if (segment.pricingType === 'DISCOUNT_PERCENT') {
                finalPrice = basePrice * (1 - segment.value / 100);
              } else if (segment.pricingType === 'MARKUP_PERCENT') {
                finalPrice = basePrice * (1 + segment.value / 100);
              }

              const IconComponent = getIconComponent(segment.icon);

              return (
                <div
                  key={segment.id}
                  className="flex items-center justify-between p-2 bg-background rounded"
                >
                  <div className="flex items-center gap-2">
                    <Badge className={getColorClass(segment.color)}>
                      <IconComponent className="w-3 h-3 mr-1" />
                      {segment.name}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatPricingValue(segment)}
                    </span>
                  </div>
                  <span className="font-medium">${finalPrice.toLocaleString()}</span>
                </div>
              );
            })}
          {pricingConfig.segments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Agrega segmentos para ver la vista previa
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <CardTitle>Precios por Segmento de Cliente</CardTitle>
            </div>
            <Switch
              checked={pricingConfig.enabled}
              onCheckedChange={(checked) =>
                setPricingConfig((prev) => ({ ...prev, enabled: checked }))
              }
            />
          </div>
          <CardDescription>
            Define diferentes políticas de precios según el segmento del cliente. Los segmentos se
            asignan a cada cliente y determinan sus precios automáticamente.
          </CardDescription>
        </CardHeader>

        {pricingConfig.enabled && (
          <CardContent className="space-y-6">
            {/* Options */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label>Aplicar a Cotizaciones</Label>
                  <p className="text-xs text-muted-foreground">
                    Usa precios de segmento en cotizaciones
                  </p>
                </div>
                <Switch
                  checked={pricingConfig.applyToQuotes}
                  onCheckedChange={(checked) =>
                    setPricingConfig((prev) => ({ ...prev, applyToQuotes: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label>Aplicar a Órdenes</Label>
                  <p className="text-xs text-muted-foreground">
                    Usa precios de segmento en órdenes de venta
                  </p>
                </div>
                <Switch
                  checked={pricingConfig.applyToOrders}
                  onCheckedChange={(checked) =>
                    setPricingConfig((prev) => ({ ...prev, applyToOrders: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label>Permitir Sobrescribir</Label>
                  <p className="text-xs text-muted-foreground">
                    El vendedor puede cambiar precios manualmente
                  </p>
                </div>
                <Switch
                  checked={pricingConfig.allowManualOverride}
                  onCheckedChange={(checked) =>
                    setPricingConfig((prev) => ({ ...prev, allowManualOverride: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label>Mostrar en Documentos</Label>
                  <p className="text-xs text-muted-foreground">
                    Indica el segmento en facturas y remitos
                  </p>
                </div>
                <Switch
                  checked={pricingConfig.showSegmentOnDocuments}
                  onCheckedChange={(checked) =>
                    setPricingConfig((prev) => ({ ...prev, showSegmentOnDocuments: checked }))
                  }
                />
              </div>
            </div>

            {/* Segments Table */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Segmentos de Clientes
                </h4>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={openAddDialog}>
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Segmento
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>
                        {editingSegment ? 'Editar Segmento' : 'Nuevo Segmento'}
                      </DialogTitle>
                      <DialogDescription>
                        Define las propiedades del segmento y su política de precios.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nombre *</Label>
                          <Input
                            value={formData.name || ''}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, name: e.target.value }))
                            }
                            placeholder="Ej: VIP, Mayorista"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Código *</Label>
                          <Input
                            value={formData.code || ''}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                code: e.target.value.toUpperCase(),
                              }))
                            }
                            placeholder="Ej: VIP, MAY"
                            maxLength={10}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Descripción</Label>
                        <Input
                          value={formData.description || ''}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, description: e.target.value }))
                          }
                          placeholder="Descripción opcional del segmento"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Icono</Label>
                          <Select
                            value={formData.icon}
                            onValueChange={(v) => setFormData((prev) => ({ ...prev, icon: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SEGMENT_ICONS.map((icon) => (
                                <SelectItem key={icon.value} value={icon.value}>
                                  <div className="flex items-center gap-2">
                                    <icon.Icon className="w-4 h-4" />
                                    {icon.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Color</Label>
                          <Select
                            value={formData.color}
                            onValueChange={(v) => setFormData((prev) => ({ ...prev, color: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SEGMENT_COLORS.map((color) => (
                                <SelectItem key={color.value} value={color.value}>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded ${color.class}`} />
                                    {color.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Tipo de Precio</Label>
                        <Select
                          value={formData.pricingType}
                          onValueChange={(v: PricingType) =>
                            setFormData((prev) => ({ ...prev, pricingType: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRICING_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                <div>
                                  <div className="font-medium">{type.label}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {type.description}
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.pricingType === 'FIXED_PRICE_LIST' ? (
                        <div className="space-y-2">
                          <Label>Lista de Precios</Label>
                          <Select
                            value={formData.priceListId?.toString()}
                            onValueChange={(v) =>
                              setFormData((prev) => ({ ...prev, priceListId: parseInt(v) }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar lista" />
                            </SelectTrigger>
                            <SelectContent>
                              {priceLists.map((list) => (
                                <SelectItem key={list.id} value={list.id.toString()}>
                                  {list.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {priceLists.length === 0 && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              No hay listas de precios disponibles
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>
                            {formData.pricingType === 'DISCOUNT_PERCENT'
                              ? 'Descuento (%)'
                              : 'Recargo (%)'}
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={formData.value || 0}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  value: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="w-24"
                            />
                            <Percent className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Prioridad</Label>
                          <Input
                            type="number"
                            min="1"
                            max="100"
                            value={formData.priority || 1}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                priority: parseInt(e.target.value) || 1,
                              }))
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            Mayor = más prioridad
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>Compra mínima ($)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={formData.minPurchaseAmount || ''}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                minPurchaseAmount: e.target.value
                                  ? parseFloat(e.target.value)
                                  : undefined,
                              }))
                            }
                            placeholder="Sin mínimo"
                          />
                        </div>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSaveSegment}>
                        {editingSegment ? 'Guardar Cambios' : 'Agregar'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {pricingConfig.segments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Segmento</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Prioridad</TableHead>
                      <TableHead>Min. Compra</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pricingConfig.segments
                      .sort((a, b) => b.priority - a.priority)
                      .map((segment) => {
                        const IconComponent = getIconComponent(segment.icon);
                        return (
                          <TableRow key={segment.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge className={getColorClass(segment.color)}>
                                  <IconComponent className="w-3 h-3 mr-1" />
                                  {segment.name}
                                </Badge>
                                {segment.isDefault && (
                                  <Badge variant="outline" className="text-xs">
                                    Default
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <code className="text-sm">{segment.code}</code>
                            </TableCell>
                            <TableCell>
                              <span
                                className={
                                  segment.pricingType === 'DISCOUNT_PERCENT'
                                    ? 'text-green-600'
                                    : segment.pricingType === 'MARKUP_PERCENT'
                                    ? 'text-red-600'
                                    : ''
                                }
                              >
                                {formatPricingValue(segment)}
                              </span>
                            </TableCell>
                            <TableCell>{segment.priority}</TableCell>
                            <TableCell>
                              {segment.minPurchaseAmount
                                ? `$${segment.minPurchaseAmount.toLocaleString()}`
                                : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSetDefault(segment.id)}
                                  title={
                                    segment.isDefault ? 'Quitar como default' : 'Establecer como default'
                                  }
                                >
                                  <Star
                                    className={`w-4 h-4 ${
                                      segment.isDefault ? 'fill-yellow-400 text-yellow-400' : ''
                                    }`}
                                  />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(segment)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteSegment(segment.id)}
                                  className="text-red-500 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 border rounded-lg bg-muted/50">
                  <Users className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No hay segmentos configurados</p>
                  <p className="text-sm text-muted-foreground">
                    Agrega segmentos para definir políticas de precios diferenciadas
                  </p>
                </div>
              )}
            </div>

            {/* Preview */}
            <PreviewCalculation />
          </CardContent>
        )}
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </div>
    </div>
  );
}
