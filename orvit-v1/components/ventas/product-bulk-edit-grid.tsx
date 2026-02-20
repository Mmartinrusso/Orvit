'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Product, Category } from '@/lib/types/sales';
import { toast } from 'sonner';
import { Save, X } from 'lucide-react';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

interface ProductBulkEditGridProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  categories: Category[];
  onSave: (updatedProducts: Product[]) => Promise<void>;
}

interface EditableProduct extends Partial<Product> {
  id: string;
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
  isActive: boolean;
}

export function ProductBulkEditGrid({ isOpen, onClose, products, categories, onSave }: ProductBulkEditGridProps) {
  const confirm = useConfirm();
  const [editableProducts, setEditableProducts] = useState<EditableProduct[]>([]);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | HTMLButtonElement | null }>({});

  useEffect(() => {
    if (isOpen && products.length > 0) {
      // Inicializar productos editables
      const initialProducts: EditableProduct[] = products.map(p => ({
        id: p.id,
        code: p.code || '',
        name: p.name || '',
        categoryId: p.categoryId || 0,
        weight: p.weight || 0,
        volume: p.volume || 0,
        costPrice: p.costPrice || 0,
        minStock: p.minStock || 0,
        currentStock: p.currentStock || 0,
        unit: p.unit || 'unidad',
        location: p.location || '',
        isActive: p.isActive ?? true,
      }));
      setEditableProducts(initialProducts);
      setHasChanges(false);
    }
  }, [isOpen, products]);

  const handleFieldChange = (productId: string, field: keyof EditableProduct, value: any) => {
    setEditableProducts(prev => {
      const updated = prev.map(p => {
        if (p.id === productId) {
          return { ...p, [field]: value };
        }
        return p;
      });
      return updated;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Convertir productos editables a formato Product completo
      const updatedProducts: Product[] = editableProducts.map(ep => {
        const originalProduct = products.find(p => p.id === ep.id);
        if (!originalProduct) return null;
        
        return {
          ...originalProduct,
          code: ep.code,
          name: ep.name,
          categoryId: ep.categoryId,
          weight: ep.weight,
          volume: ep.volume,
          costPrice: ep.costPrice,
          minStock: ep.minStock,
          currentStock: ep.currentStock,
          unit: ep.unit,
          location: ep.location,
          isActive: ep.isActive,
        };
      }).filter((p): p is Product => p !== null);

      await onSave(updatedProducts);
      toast.success(`${updatedProducts.length} producto(s) actualizado(s) correctamente`);
      setHasChanges(false);
      onClose();
    } catch (error) {
      console.error('Error saving products:', error);
      toast.error('Error al guardar los productos');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (hasChanges) {
      const ok = await confirm({
        title: 'Descartar cambios',
        description: '¿Estás seguro de que quieres descartar los cambios?',
        confirmText: 'Confirmar',
        variant: 'default',
      });
      if (!ok) return;
    }
    onClose();
  };

  // Función para manejar la navegación con Enter
  const handleKeyDown = (
    e: React.KeyboardEvent,
    productIndex: number,
    fieldIndex: number,
    fieldType: 'input' | 'select' = 'input'
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      const totalFields = 11; // Total de columnas
      const totalProducts = editableProducts.length;
      
      let nextProductIndex = productIndex;
      let nextFieldIndex = fieldIndex;
      
      // Si estamos en un Select, primero necesitamos cerrarlo
      if (fieldType === 'select') {
        // Pequeño delay para que el Select se cierre
        setTimeout(() => {
          // Mover al siguiente campo en la misma columna (hacia abajo)
          nextProductIndex = productIndex + 1;
          
          // Si llegamos al final de la columna, ir a la primera fila de la siguiente columna
          if (nextProductIndex >= totalProducts) {
            nextProductIndex = 0;
            nextFieldIndex = fieldIndex + 1;
            
            // Si llegamos al final de todas las columnas, volver al inicio
            if (nextFieldIndex >= totalFields) {
              nextProductIndex = 0;
              nextFieldIndex = 0;
            }
          }
          
          moveToNextField(nextProductIndex, nextFieldIndex);
        }, 100);
        return;
      }
      
      // Mover al siguiente campo en la misma columna (hacia abajo)
      nextProductIndex = productIndex + 1;
      
      // Si llegamos al final de la columna, ir a la primera fila de la siguiente columna
      if (nextProductIndex >= totalProducts) {
        nextProductIndex = 0;
        nextFieldIndex = fieldIndex + 1;
        
        // Si llegamos al final de todas las columnas, volver al inicio
        if (nextFieldIndex >= totalFields) {
          nextProductIndex = 0;
          nextFieldIndex = 0;
        }
      }
      
      moveToNextField(nextProductIndex, nextFieldIndex);
    }
  };

  const moveToNextField = (productIndex: number, fieldIndex: number) => {
    if (productIndex >= editableProducts.length || fieldIndex >= 11) {
      return;
    }

    const product = editableProducts[productIndex];
    if (!product) return;

    const fieldNames = ['code', 'name', 'categoryId', 'weight', 'volume', 'costPrice', 'minStock', 'currentStock', 'unit', 'location', 'isActive'];
    const fieldName = fieldNames[fieldIndex];
    const fieldKey = `${product.id}-${fieldName}`;
    
    // Los campos 2 (categoría) y 10 (estado) son Selects
    const isSelect = fieldIndex === 2 || fieldIndex === 10;
    
    const nextElement = inputRefs.current[fieldKey];
    
    if (nextElement) {
      if (isSelect && 'click' in nextElement) {
        // Para Selects, hacer click para abrirlos
        nextElement.click();
      } else if ('focus' in nextElement) {
        nextElement.focus();
        // Seleccionar el texto si es un input
        if (nextElement instanceof HTMLInputElement) {
          nextElement.select();
        }
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>Editar Productos en Masa</DialogTitle>
          <DialogDescription>
            Edita multiples productos a la vez. Los cambios se guardaran cuando presiones "Guardar".
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="border rounded-lg overflow-auto">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-muted sticky top-0 z-10">
                <tr>
                  <th className="border p-2 text-left text-sm font-semibold min-w-[80px]">Código</th>
                  <th className="border p-2 text-left text-sm font-semibold min-w-[200px]">Nombre</th>
                  <th className="border p-2 text-left text-sm font-semibold min-w-[150px]">Categoría</th>
                  <th className="border p-2 text-left text-sm font-semibold min-w-[100px]">Peso</th>
                  <th className="border p-2 text-left text-sm font-semibold min-w-[100px]">Volumen</th>
                  <th className="border p-2 text-left text-sm font-semibold min-w-[120px]">Precio Costo</th>
                  <th className="border p-2 text-left text-sm font-semibold min-w-[100px]">Stock Mín</th>
                  <th className="border p-2 text-left text-sm font-semibold min-w-[100px]">Stock Actual</th>
                  <th className="border p-2 text-left text-sm font-semibold min-w-[100px]">Unidad</th>
                  <th className="border p-2 text-left text-sm font-semibold min-w-[120px]">Ubicación</th>
                  <th className="border p-2 text-left text-sm font-semibold min-w-[100px]">Estado</th>
                </tr>
              </thead>
              <tbody>
                {editableProducts.map((product, productIndex) => (
                  <tr key={product.id} className="hover:bg-muted/50">
                    <td className="border p-1">
                      <Input
                        ref={(el) => { inputRefs.current[`${product.id}-code`] = el; }}
                        value={product.code}
                        onChange={(e) => handleFieldChange(product.id, 'code', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, productIndex, 0, 'input')}
                        className="h-8 text-sm"
                        placeholder="Código"
                      />
                    </td>
                    <td className="border p-1">
                      <Input
                        ref={(el) => { inputRefs.current[`${product.id}-name`] = el; }}
                        value={product.name}
                        onChange={(e) => handleFieldChange(product.id, 'name', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, productIndex, 1, 'input')}
                        className="h-8 text-sm"
                        placeholder="Nombre"
                      />
                    </td>
                    <td className="border p-1">
                      <Select
                        value={product.categoryId?.toString() || ''}
                        onValueChange={(value) => {
                          handleFieldChange(product.id, 'categoryId', parseInt(value));
                          // Mover al siguiente campo después de seleccionar (misma columna, siguiente fila)
                          setTimeout(() => {
                            const nextProductIndex = productIndex + 1 >= editableProducts.length ? 0 : productIndex + 1;
                            const nextFieldIndex = productIndex + 1 >= editableProducts.length ? 3 : 2;
                            moveToNextField(nextProductIndex, nextFieldIndex);
                          }, 100);
                        }}
                      >
                        <SelectTrigger 
                          ref={(el) => { inputRefs.current[`${product.id}-categoryId`] = el; }}
                          className="h-8 text-sm"
                          onKeyDown={(e) => handleKeyDown(e, productIndex, 2, 'select')}
                        >
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id.toString()}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="border p-1">
                      <Input
                        ref={(el) => { inputRefs.current[`${product.id}-weight`] = el; }}
                        type="number"
                        step="0.01"
                        value={product.weight}
                        onChange={(e) => handleFieldChange(product.id, 'weight', parseFloat(e.target.value) || 0)}
                        onKeyDown={(e) => handleKeyDown(e, productIndex, 3, 'input')}
                        className="h-8 text-sm"
                        placeholder="0"
                      />
                    </td>
                    <td className="border p-1">
                      <Input
                        ref={(el) => { inputRefs.current[`${product.id}-volume`] = el; }}
                        type="number"
                        step="0.01"
                        value={product.volume}
                        onChange={(e) => handleFieldChange(product.id, 'volume', parseFloat(e.target.value) || 0)}
                        onKeyDown={(e) => handleKeyDown(e, productIndex, 4, 'input')}
                        className="h-8 text-sm"
                        placeholder="0"
                      />
                    </td>
                    <td className="border p-1">
                      <Input
                        ref={(el) => { inputRefs.current[`${product.id}-costPrice`] = el; }}
                        type="number"
                        step="0.01"
                        value={product.costPrice}
                        onChange={(e) => handleFieldChange(product.id, 'costPrice', parseFloat(e.target.value) || 0)}
                        onKeyDown={(e) => handleKeyDown(e, productIndex, 5, 'input')}
                        className="h-8 text-sm"
                        placeholder="0"
                      />
                    </td>
                    <td className="border p-1">
                      <Input
                        ref={(el) => { inputRefs.current[`${product.id}-minStock`] = el; }}
                        type="number"
                        step="1"
                        value={product.minStock}
                        onChange={(e) => handleFieldChange(product.id, 'minStock', parseInt(e.target.value) || 0)}
                        onKeyDown={(e) => handleKeyDown(e, productIndex, 6, 'input')}
                        className="h-8 text-sm"
                        placeholder="0"
                      />
                    </td>
                    <td className="border p-1">
                      <Input
                        ref={(el) => { inputRefs.current[`${product.id}-currentStock`] = el; }}
                        type="number"
                        step="1"
                        value={product.currentStock}
                        onChange={(e) => handleFieldChange(product.id, 'currentStock', parseInt(e.target.value) || 0)}
                        onKeyDown={(e) => handleKeyDown(e, productIndex, 7, 'input')}
                        className="h-8 text-sm"
                        placeholder="0"
                      />
                    </td>
                    <td className="border p-1">
                      <Input
                        ref={(el) => { inputRefs.current[`${product.id}-unit`] = el; }}
                        value={product.unit}
                        onChange={(e) => handleFieldChange(product.id, 'unit', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, productIndex, 8, 'input')}
                        className="h-8 text-sm"
                        placeholder="unidad"
                      />
                    </td>
                    <td className="border p-1">
                      <Input
                        ref={(el) => { inputRefs.current[`${product.id}-location`] = el; }}
                        value={product.location}
                        onChange={(e) => handleFieldChange(product.id, 'location', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, productIndex, 9, 'input')}
                        className="h-8 text-sm"
                        placeholder="Ubicación"
                      />
                    </td>
                    <td className="border p-1">
                      <Select
                        value={product.isActive ? 'active' : 'inactive'}
                        onValueChange={(value) => {
                          handleFieldChange(product.id, 'isActive', value === 'active');
                          // Mover al siguiente campo después de seleccionar (misma columna, siguiente fila)
                          setTimeout(() => {
                            const nextProductIndex = productIndex + 1 >= editableProducts.length ? 0 : productIndex + 1;
                            const nextFieldIndex = productIndex + 1 >= editableProducts.length ? 0 : 10;
                            moveToNextField(nextProductIndex, nextFieldIndex);
                          }, 100);
                        }}
                      >
                        <SelectTrigger 
                          ref={(el) => { inputRefs.current[`${product.id}-isActive`] = el; }}
                          className="h-8 text-sm"
                          onKeyDown={(e) => handleKeyDown(e, productIndex, 10, 'select')}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Activo</SelectItem>
                          <SelectItem value="inactive">Inactivo</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

