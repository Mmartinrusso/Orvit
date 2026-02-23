'use client';

import { formatNumber } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Layers } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku?: string;
  unit: string;
  salePrice?: number;
}

interface BundleComponent {
  concepto: string;
  monto: number;
  productId?: string;
  productSearch: string;
}

export interface BundleResult {
  descripcion: string;
  precioUnitario: number;
  costBreakdown: { concepto: string; monto: number }[];
}

interface SavedBundle {
  id: number;
  nombre: string;
  components: Array<{
    concepto: string;
    monto: number;
    productId?: string | null;
    product?: { id: string; name: string; code: string } | null;
  }>;
}

interface BundleBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  onAdd: (result: BundleResult) => void;
}

export function BundleBuilderDialog({
  open,
  onOpenChange,
  products,
  onAdd,
}: BundleBuilderDialogProps) {
  const [nombre, setNombre] = useState('');
  const [components, setComponents] = useState<BundleComponent[]>([
    { concepto: '', monto: 0, productSearch: '' },
    { concepto: '', monto: 0, productSearch: '' },
  ]);
  const [openPopoverIndex, setOpenPopoverIndex] = useState<number | null>(null);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [savedBundles, setSavedBundles] = useState<SavedBundle[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      resetForm();
      loadBundles();
    }
  }, [open]);

  const loadBundles = async () => {
    try {
      const res = await fetch('/api/ventas/bundles');
      if (res.ok) {
        const data = await res.json();
        setSavedBundles(data.data || []);
      }
    } catch {
      // silent
    }
  };

  const resetForm = () => {
    setNombre('');
    setComponents([
      { concepto: '', monto: 0, productSearch: '' },
      { concepto: '', monto: 0, productSearch: '' },
    ]);
    setSaveAsTemplate(false);
  };

  const totalMonto = components.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);

  const applyTemplate = (bundleId: string) => {
    const bundle = savedBundles.find(b => b.id.toString() === bundleId);
    if (!bundle) return;
    setNombre(bundle.nombre);
    setComponents(
      bundle.components.map(c => ({
        concepto: c.concepto,
        monto: Number(c.monto),
        productId: c.productId ?? undefined,
        productSearch: c.product
          ? `${c.product.code ? c.product.code + ' - ' : ''}${c.product.name}`
          : '',
      }))
    );
  };

  const addComponent = () => {
    setComponents(prev => [...prev, { concepto: '', monto: 0, productSearch: '' }]);
  };

  const removeComponent = (index: number) => {
    if (components.length <= 2) return;
    setComponents(prev => prev.filter((_, i) => i !== index));
  };

  const updateComponent = (index: number, updates: Partial<BundleComponent>) => {
    setComponents(prev => prev.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  };

  const handleProductSelect = (index: number, product: Product) => {
    updateComponent(index, {
      productId: product.id,
      concepto: components[index].concepto || product.name,
      monto: product.salePrice || 0,
      productSearch: `${product.sku ? product.sku + ' - ' : ''}${product.name}`,
    });
    setOpenPopoverIndex(null);
  };

  const getFilteredProducts = (search: string) => {
    if (!search.trim()) return [];
    const s = search.toLowerCase();
    return products
      .filter(
        p =>
          p.name.toLowerCase().includes(s) ||
          (p.sku && p.sku.toLowerCase().includes(s))
      )
      .slice(0, 8);
  };

  const handleConfirm = async () => {
    if (!nombre.trim()) {
      toast.error('Ingresá un nombre para el item combinado');
      return;
    }
    if (components.some(c => !c.concepto.trim())) {
      toast.error('Todos los componentes requieren un concepto');
      return;
    }
    if (components.length < 2) {
      toast.error('Se requieren al menos 2 componentes');
      return;
    }
    if (totalMonto <= 0) {
      toast.error('El total debe ser mayor a 0');
      return;
    }

    setSaving(true);
    try {
      if (saveAsTemplate) {
        const res = await fetch('/api/ventas/bundles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: nombre.trim(),
            components: components.map(c => ({
              concepto: c.concepto.trim(),
              monto: Number(c.monto),
              cantidad: 1,
              productId: c.productId || null,
            })),
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || 'Error al guardar plantilla');
          setSaving(false);
          return;
        }
        toast.success('Plantilla guardada correctamente');
      }

      onAdd({
        descripcion: nombre.trim(),
        precioUnitario: totalMonto,
        costBreakdown: components.map(c => ({
          concepto: c.concepto.trim(),
          monto: Number(c.monto),
        })),
      });
      onOpenChange(false);
    } catch {
      toast.error('Error al agregar item combinado');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Combinar Productos en un Item
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Plantilla */}
          {savedBundles.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">
                Cargar desde plantilla guardada
              </Label>
              <Select onValueChange={applyTemplate}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar plantilla..." />
                </SelectTrigger>
                <SelectContent>
                  {savedBundles.map(b => (
                    <SelectItem key={b.id} value={b.id.toString()}>
                      {b.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Nombre */}
          <div>
            <Label htmlFor="bundle-nombre">Nombre del item combinado *</Label>
            <Input
              id="bundle-nombre"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Adoquín completo (incluye flete y tarima)"
              className="mt-1"
            />
          </div>

          <Separator />

          {/* Componentes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Componentes</Label>
              <Button type="button" variant="outline" size="sm" onClick={addComponent}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Agregar componente
              </Button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-12 gap-2 px-1">
              <div className="col-span-4 text-xs text-muted-foreground">Producto (opcional)</div>
              <div className="col-span-4 text-xs text-muted-foreground">Concepto *</div>
              <div className="col-span-3 text-xs text-muted-foreground">Monto</div>
              <div className="col-span-1" />
            </div>

            {components.map((comp, index) => {
              const filtered = getFilteredProducts(comp.productSearch);
              return (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  {/* Product search */}
                  <div className="col-span-4">
                    <Popover
                      open={openPopoverIndex === index && filtered.length > 0}
                      onOpenChange={o => {
                        if (!o) setOpenPopoverIndex(null);
                        else setOpenPopoverIndex(index);
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Input
                          value={comp.productSearch}
                          onChange={e => {
                            updateComponent(index, {
                              productSearch: e.target.value,
                              productId: undefined,
                            });
                            setOpenPopoverIndex(index);
                          }}
                          placeholder="Buscar producto..."
                          className="text-sm h-8"
                        />
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0" align="start">
                        <Command>
                          <CommandList>
                            <CommandGroup>
                              {filtered.map(p => (
                                <CommandItem
                                  key={p.id}
                                  onSelect={() => handleProductSelect(index, p)}
                                >
                                  <div>
                                    <p className="text-sm font-medium">{p.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {p.sku} | ${formatNumber(p.salePrice)}
                                    </p>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Concepto */}
                  <div className="col-span-4">
                    <Input
                      value={comp.concepto}
                      onChange={e => updateComponent(index, { concepto: e.target.value })}
                      placeholder="Concepto..."
                      className="text-sm h-8"
                    />
                  </div>

                  {/* Monto */}
                  <div className="col-span-3">
                    <Input
                      type="number"
                      value={comp.monto || ''}
                      onChange={e =>
                        updateComponent(index, { monto: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="$0"
                      className="text-sm h-8"
                      min="0"
                    />
                  </div>

                  {/* Remove */}
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeComponent(index)}
                      disabled={components.length <= 2}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Total */}
          <div className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
            <span className="text-sm font-medium">Total combinado por unidad:</span>
            <span className="text-lg font-bold tabular-nums">{formatCurrency(totalMonto)}</span>
          </div>

          {/* Guardar como plantilla */}
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Checkbox
              id="save-template"
              checked={saveAsTemplate}
              onCheckedChange={v => setSaveAsTemplate(v === true)}
            />
            <div>
              <Label htmlFor="save-template" className="cursor-pointer text-sm font-medium">
                Guardar como plantilla reutilizable
              </Label>
              <p className="text-xs text-muted-foreground">
                Disponible para usar en futuras cotizaciones
              </p>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || !nombre.trim() || totalMonto <= 0}
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Layers className="w-4 h-4 mr-2" />
            Agregar a cotización
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
