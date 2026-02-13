'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Category } from '@/lib/types/sales';
import { toast } from 'sonner';
import { Save, X, Plus, Trash2, Loader2 } from 'lucide-react';

interface ProductBulkCreateGridProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSave: () => Promise<void>;
}

interface NewProduct {
  tempId: string;
  code: string;
  name: string;
  categoryId: number;
  weight: number;
  volume: number;
  costPrice: number;
  minStock: number;
  currentStock: number;
  unit: string;
  location: string;
}

const UNIT_OPTIONS = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'metro', label: 'Metro' },
  { value: 'metro2', label: 'M2' },
  { value: 'metro3', label: 'M3' },
  { value: 'kilogramo', label: 'Kg' },
  { value: 'tonelada', label: 'Ton' },
  { value: 'litro', label: 'Lt' },
  { value: 'bolsa', label: 'Bolsa' },
  { value: 'pallet', label: 'Pallet' },
  { value: 'caja', label: 'Caja' },
];

const createEmptyProduct = (): NewProduct => ({
  tempId: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  code: '',
  name: '',
  categoryId: 0,
  weight: 0,
  volume: 0,
  costPrice: 0,
  minStock: 0,
  currentStock: 0,
  unit: 'unidad',
  location: '',
});

export function ProductBulkCreateGrid({ isOpen, onClose, categories, onSave }: ProductBulkCreateGridProps) {
  const [products, setProducts] = useState<NewProduct[]>([]);
  const [saving, setSaving] = useState(false);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | HTMLButtonElement | null }>({});

  useEffect(() => {
    if (isOpen) {
      const initialProducts = Array(5).fill(null).map(() => createEmptyProduct());
      setProducts(initialProducts);
    }
  }, [isOpen]);

  const handleFieldChange = (tempId: string, field: keyof NewProduct, value: any) => {
    setProducts(prev =>
      prev.map(p => p.tempId === tempId ? { ...p, [field]: value } : p)
    );
  };

  const addRow = () => {
    setProducts(prev => [...prev, createEmptyProduct()]);
  };

  const removeRow = (tempId: string) => {
    if (products.length <= 1) {
      toast.error('Debe haber al menos una fila');
      return;
    }
    setProducts(prev => prev.filter(p => p.tempId !== tempId));
  };

  const generateCode = (name: string) => {
    if (!name) return '';
    const prefix = name.substring(0, 3).toUpperCase();
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `${prefix}-${random}`;
  };

  const handleNameBlur = (tempId: string, name: string) => {
    const product = products.find(p => p.tempId === tempId);
    if (product && !product.code && name) {
      handleFieldChange(tempId, 'code', generateCode(name));
    }
  };

  const handleSave = async () => {
    const validProducts = products.filter(p => p.name.trim() && p.code.trim());

    if (validProducts.length === 0) {
      toast.error('Ingresa al menos un producto con nombre y codigo');
      return;
    }

    const productsWithoutCategory = validProducts.filter(p => !p.categoryId || p.categoryId < 1);
    if (productsWithoutCategory.length > 0) {
      toast.error('Todos los productos deben tener una categoria');
      return;
    }

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const product of validProducts) {
        try {
          const response = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: product.name,
              code: product.code,
              categoryId: product.categoryId,
              unit: product.unit,
              costPrice: product.costPrice || 0,
              currentStock: product.currentStock || 0,
              minStock: product.minStock || 0,
              weight: product.weight || 0,
              volume: product.volume || 0,
              location: product.location || '',
              description: '',
              isActive: true,
              costType: 'MANUAL',
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
            const error = await response.json().catch(() => ({}));
            console.error(`Error creando ${product.name}:`, error);
          }
        } catch (e) {
          errorCount++;
          console.error(`Error creando ${product.name}:`, e);
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} producto(s) creado(s) correctamente`);
        await onSave();
        onClose();
      }

      if (errorCount > 0) {
        toast.error(`${errorCount} producto(s) no se pudieron crear`);
      }
    } catch (error) {
      console.error('Error saving products:', error);
      toast.error('Error al guardar los productos');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    const hasData = products.some(p => p.name.trim() || p.code.trim());
    if (hasData) {
      if (!confirm('Tienes datos sin guardar. Descartar cambios?')) {
        return;
      }
    }
    onClose();
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    productIndex: number,
    fieldIndex: number,
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      const totalFields = 10;
      let nextProductIndex = productIndex;
      let nextFieldIndex = fieldIndex + 1;

      if (nextFieldIndex >= totalFields) {
        nextFieldIndex = 0;
        nextProductIndex = productIndex + 1;

        if (nextProductIndex >= products.length) {
          addRow();
          nextProductIndex = products.length;
        }
      }

      const nextKey = `${products[nextProductIndex]?.tempId || ''}_${nextFieldIndex}`;
      setTimeout(() => {
        const nextInput = inputRefs.current[nextKey];
        if (nextInput) {
          nextInput.focus();
          if (nextInput instanceof HTMLInputElement) {
            nextInput.select();
          }
        }
      }, 50);
    }
  };

  const validCount = products.filter(p => p.name.trim() && p.code.trim() && p.categoryId > 0).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>Crear Productos en Masa</DialogTitle>
          <DialogDescription>
            Crea multiples productos a la vez. Presiona Enter para moverte entre campos.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="border rounded-lg overflow-auto">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-muted sticky top-0 z-10">
                  <tr>
                    <th className="border p-2 text-left text-sm font-semibold min-w-[50px]">#</th>
                    <th className="border p-2 text-left text-sm font-semibold min-w-[100px]">Codigo *</th>
                    <th className="border p-2 text-left text-sm font-semibold min-w-[200px]">Nombre *</th>
                    <th className="border p-2 text-left text-sm font-semibold min-w-[150px]">Categoria *</th>
                    <th className="border p-2 text-left text-sm font-semibold min-w-[100px]">Unidad</th>
                    <th className="border p-2 text-left text-sm font-semibold min-w-[120px]">Precio Costo</th>
                    <th className="border p-2 text-left text-sm font-semibold min-w-[100px]">Stock Actual</th>
                    <th className="border p-2 text-left text-sm font-semibold min-w-[100px]">Stock Min</th>
                    <th className="border p-2 text-left text-sm font-semibold min-w-[100px]">Peso</th>
                    <th className="border p-2 text-left text-sm font-semibold min-w-[120px]">Ubicacion</th>
                    <th className="border p-2 text-left text-sm font-semibold min-w-[50px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, productIndex) => (
                    <tr key={product.tempId} className="hover:bg-muted/50">
                      <td className="border p-1 text-center text-sm text-muted-foreground">
                        {productIndex + 1}
                      </td>
                      <td className="border p-1">
                        <Input
                          ref={el => { inputRefs.current[`${product.tempId}_0`] = el; }}
                          value={product.code}
                          onChange={e => handleFieldChange(product.tempId, 'code', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, productIndex, 0)}
                          className="h-8 text-sm"
                          placeholder="Codigo"
                        />
                      </td>
                      <td className="border p-1">
                        <Input
                          ref={el => { inputRefs.current[`${product.tempId}_1`] = el; }}
                          value={product.name}
                          onChange={e => handleFieldChange(product.tempId, 'name', e.target.value)}
                          onBlur={e => handleNameBlur(product.tempId, e.target.value)}
                          onKeyDown={e => handleKeyDown(e, productIndex, 1)}
                          className="h-8 text-sm"
                          placeholder="Nombre"
                        />
                      </td>
                      <td className="border p-1">
                        <Select
                          value={product.categoryId > 0 ? product.categoryId.toString() : ''}
                          onValueChange={v => handleFieldChange(product.tempId, 'categoryId', parseInt(v))}
                        >
                          <SelectTrigger
                            ref={el => { inputRefs.current[`${product.tempId}_2`] = el as any; }}
                            className="h-8 text-sm"
                          >
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat.id} value={cat.id.toString()}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="border p-1">
                        <Select
                          value={product.unit}
                          onValueChange={v => handleFieldChange(product.tempId, 'unit', v)}
                        >
                          <SelectTrigger
                            ref={el => { inputRefs.current[`${product.tempId}_3`] = el as any; }}
                            className="h-8 text-sm"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIT_OPTIONS.map(u => (
                              <SelectItem key={u.value} value={u.value}>
                                {u.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="border p-1">
                        <Input
                          ref={el => { inputRefs.current[`${product.tempId}_4`] = el; }}
                          type="number"
                          step="0.01"
                          min="0"
                          value={product.costPrice || ''}
                          onChange={e => handleFieldChange(product.tempId, 'costPrice', parseFloat(e.target.value) || 0)}
                          onKeyDown={e => handleKeyDown(e, productIndex, 4)}
                          className="h-8 text-sm"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="border p-1">
                        <Input
                          ref={el => { inputRefs.current[`${product.tempId}_5`] = el; }}
                          type="number"
                          min="0"
                          value={product.currentStock || ''}
                          onChange={e => handleFieldChange(product.tempId, 'currentStock', parseInt(e.target.value) || 0)}
                          onKeyDown={e => handleKeyDown(e, productIndex, 5)}
                          className="h-8 text-sm"
                          placeholder="0"
                        />
                      </td>
                      <td className="border p-1">
                        <Input
                          ref={el => { inputRefs.current[`${product.tempId}_6`] = el; }}
                          type="number"
                          min="0"
                          value={product.minStock || ''}
                          onChange={e => handleFieldChange(product.tempId, 'minStock', parseInt(e.target.value) || 0)}
                          onKeyDown={e => handleKeyDown(e, productIndex, 6)}
                          className="h-8 text-sm"
                          placeholder="0"
                        />
                      </td>
                      <td className="border p-1">
                        <Input
                          ref={el => { inputRefs.current[`${product.tempId}_7`] = el; }}
                          type="number"
                          step="0.01"
                          min="0"
                          value={product.weight || ''}
                          onChange={e => handleFieldChange(product.tempId, 'weight', parseFloat(e.target.value) || 0)}
                          onKeyDown={e => handleKeyDown(e, productIndex, 7)}
                          className="h-8 text-sm"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="border p-1">
                        <Input
                          ref={el => { inputRefs.current[`${product.tempId}_8`] = el; }}
                          value={product.location}
                          onChange={e => handleFieldChange(product.tempId, 'location', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, productIndex, 8)}
                          className="h-8 text-sm"
                          placeholder="A-1"
                        />
                      </td>
                      <td className="border p-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeRow(product.tempId)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={addRow}
            className="mt-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Fila
          </Button>
        </DialogBody>

        <DialogFooter className="border-t pt-4">
          <div className="flex items-center gap-2 mr-auto text-sm text-muted-foreground">
            {validCount} de {products.length} producto(s) listos para crear
          </div>
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || validCount === 0}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Crear {validCount} Producto(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
