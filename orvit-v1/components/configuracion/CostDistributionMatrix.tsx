'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/contexts/CompanyContext';
import { Plus, Save, X, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface IndirectCost {
  id: number;
  label: string;
  category: string;
  currentPrice: number;
}

interface ProductCategory {
  id: number;
  name: string;
  description?: string;
}

interface CostDistributionMatrixProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (distributions: CostDistribution[]) => void;
}

interface CostDistribution {
  costId: number;
  costName: string;
  categoryId: number;
  categoryName: string;
  percentage: number;
}

export default function CostDistributionMatrix({
  isOpen,
  onClose,
  onSave
}: CostDistributionMatrixProps) {
  const { currentCompany } = useCompany();
  const [indirectCosts, setIndirectCosts] = useState<IndirectCost[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Cargar datos al abrir el modal
  useEffect(() => {
    if (isOpen && currentCompany) {
      loadData();
    }
  }, [isOpen, currentCompany]);

  const loadData = async () => {
    if (!currentCompany) return;

    setLoading(true);
    try {
      // Cargar costos indirectos
      const indirectResponse = await fetch(`/api/indirect-items?companyId=${currentCompany.id}`);
      let indirectData: IndirectCost[] = [];
      if (indirectResponse.ok) {
        const data = await indirectResponse.json();
        indirectData = data.indirectItems || [];
        setIndirectCosts(indirectData);
      }

      // Cargar categorías de productos
      const categoriesResponse = await fetch(`/api/productos/categorias?companyId=${currentCompany.id}`);
      let categoriesData: ProductCategory[] = [];
      if (categoriesResponse.ok) {
        categoriesData = await categoriesResponse.json();
        setProductCategories(categoriesData);
      }

      // Cargar distribuciones existentes después de tener los datos
      await loadExistingDistributions(indirectData, categoriesData);

    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingDistributions = async (costs: IndirectCost[], categories: ProductCategory[]) => {
    try {
      const response = await fetch(`/api/cost-distribution/bulk?companyId=${currentCompany?.id}`);
      if (response.ok) {
        const existingDistributions = await response.json();
        
        console.log('📊 Costos indirectos para matriz:', costs.length);
        console.log('📊 Categorías de productos para matriz:', categories.length);
        console.log('📊 Distribuciones existentes:', existingDistributions.length);
        
        // Inicializar matriz con distribuciones existentes
        const initialMatrix: Record<string, Record<string, number>> = {};
        
        costs.forEach(cost => {
          initialMatrix[cost.id.toString()] = {};
          categories.forEach(category => {
            const existing = existingDistributions.find((d: any) => 
              d.costName === cost.label && d.productCategoryId === category.id
            );
            const percentage = existing?.percentage ? parseFloat(existing.percentage) : 0;
            initialMatrix[cost.id.toString()][category.id.toString()] = percentage;
          });
        });
        
        console.log('📊 Matriz inicializada:', initialMatrix);
        setMatrix(initialMatrix);
      }
    } catch (error) {
      console.error('Error cargando distribuciones existentes:', error);
    }
  };

  const updateMatrixValue = (costId: string, categoryId: string, value: string) => {
    const numericValue = parseFloat(value) || 0;
    
    setMatrix(prev => ({
      ...prev,
      [costId]: {
        ...prev[costId],
        [categoryId]: numericValue
      }
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent, costId: string, categoryId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // Encontrar el índice actual del costo y categoría
      const currentCostIndex = indirectCosts.findIndex(cost => cost.id.toString() === costId);
      const currentCategoryIndex = productCategories.findIndex(category => category.id.toString() === categoryId);
      
      if (currentCostIndex < indirectCosts.length - 1) {
        // Si no es el último costo, mover al siguiente costo en la misma categoría
        const nextCostId = indirectCosts[currentCostIndex + 1].id.toString();
        const nextInput = document.querySelector(`input[data-cost-id="${nextCostId}"][data-category-id="${categoryId}"]`) as HTMLInputElement;
        
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      } else if (currentCategoryIndex < productCategories.length - 1) {
        // Si es el último costo pero no la última categoría, mover a la primera fila de la siguiente categoría
        const nextCategoryId = productCategories[currentCategoryIndex + 1].id.toString();
        const nextInput = document.querySelector(`input[data-cost-id="${indirectCosts[0].id.toString()}"][data-category-id="${nextCategoryId}"]`) as HTMLInputElement;
        
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
    } else if (e.key === 'Tab') {
      // Permitir navegación normal con Tab (horizontal)
      // No hacer preventDefault para mantener comportamiento estándar
    }
  };

  const calculateRowTotal = (costId: string): number => {
    const row = matrix[costId] || {};
    const values = Object.values(row);
    console.log(`🔍 Calculando total fila ${costId}:`, values);
    const total = values.reduce((sum, value) => {
      const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
      return sum + numValue;
    }, 0);
    console.log(`✅ Total calculado:`, total);
    return isNaN(total) ? 0 : total;
  };

  const calculateColumnTotal = (categoryId: string): number => {
    const total = Object.values(matrix).reduce((sum, row) => {
      const value = row[categoryId];
      const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
      return sum + numValue;
    }, 0);
    return isNaN(total) ? 0 : total;
  };

  const validateMatrix = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Verificar que cada fila sume 100%
    indirectCosts.forEach(cost => {
      const rowTotal = calculateRowTotal(cost.id.toString());
      if (rowTotal !== 100) {
        errors.push(`${cost.label}: debe sumar 100% (actual: ${rowTotal.toFixed(1)}%)`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const handleSave = async () => {
    const validation = validateMatrix();
    
    if (!validation.isValid) {
      toast.error('Hay errores en la distribución:', {
        description: validation.errors.join(', ')
      });
      return;
    }

    setSaving(true);
    try {
      const distributions: CostDistribution[] = [];
      
      indirectCosts.forEach(cost => {
        productCategories.forEach(category => {
          const percentage = matrix[cost.id.toString()]?.[category.id.toString()] || 0;
          if (percentage > 0) {
            distributions.push({
              costId: cost.id,
              costName: cost.label,
              categoryId: category.id,
              categoryName: category.name,
              percentage
            });
          }
        });
      });

      await onSave(distributions);
      toast.success('Distribución de costos guardada exitosamente');
      onClose();
      
    } catch (error) {
      console.error('Error guardando distribuciones:', error);
      toast.error('Error al guardar la distribución');
    } finally {
      setSaving(false);
    }
  };

  const getRowTotalColor = (total: number): string => {
    if (total === 100) return 'text-green-600 bg-green-50';
    if (total > 100) return 'text-red-600 bg-red-50';
    return 'text-yellow-600 bg-yellow-50';
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="full" className="max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Distribución de Costos Indirectos - Matriz Tipo Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-auto max-h-[70vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Cargando datos...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 p-2 text-left font-semibold min-w-[200px]">
                      Costos Indirectos
                    </th>
                    {productCategories.map(category => {
                      const columnTotal = calculateColumnTotal(category.id.toString());
                      return (
                        <th key={category.id} className="border border-gray-300 p-2 text-center font-semibold min-w-[120px]">
                          <div className="flex flex-col">
                            <span className="text-sm">{category.name}</span>
                            <span className="text-xs text-gray-500 font-normal">
                              Total: {(typeof columnTotal === 'number' ? columnTotal : 0).toFixed(1)}%
                            </span>
                          </div>
                        </th>
                      );
                    })}
                    <th className="border border-gray-300 p-2 text-center font-semibold bg-blue-50 min-w-[100px]">
                      Total Fila
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {indirectCosts.map(cost => {
                    const rowTotal = calculateRowTotal(cost.id.toString());
                    return (
                      <tr key={cost.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-2 font-medium">
                          <div className="flex flex-col">
                            <span className="text-sm">{cost.label}</span>
                            <span className="text-xs text-gray-500">
                              ${cost.currentPrice.toLocaleString()}
                            </span>
                          </div>
                        </td>
                        {productCategories.map(category => (
                          <td key={category.id} className="border border-gray-300 p-1">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={matrix[cost.id.toString()]?.[category.id.toString()] || ''}
                              onChange={(e) => updateMatrixValue(cost.id.toString(), category.id.toString(), e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, cost.id.toString(), category.id.toString())}
                              className="w-full text-center border-0 focus:ring-1 focus:ring-blue-500"
                              placeholder="0"
                              data-cost-id={cost.id.toString()}
                              data-category-id={category.id.toString()}
                            />
                          </td>
                        ))}
                        <td className={`border border-gray-300 p-2 text-center font-semibold ${getRowTotalColor(rowTotal)}`}>
                          <div className="flex items-center justify-center gap-1">
                            {rowTotal === 100 ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4" />
                            )}
                            <span>{(typeof rowTotal === 'number' ? rowTotal : 0).toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Resumen de validación */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Resumen de Validación:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Costos Indirectos:</span> {indirectCosts.length}
              </div>
              <div>
                <span className="font-medium">Categorías de Productos:</span> {productCategories.length}
              </div>
              <div>
                <span className="font-medium">Filas Válidas (100%):</span> 
                <span className="ml-1 text-green-600 font-semibold">
                  {indirectCosts.filter(cost => calculateRowTotal(cost.id.toString()) === 100).length}
                </span>
              </div>
              <div>
                <span className="font-medium">Filas con Errores:</span> 
                <span className="ml-1 text-red-600 font-semibold">
                  {indirectCosts.filter(cost => calculateRowTotal(cost.id.toString()) !== 100).length}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar Distribución
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
