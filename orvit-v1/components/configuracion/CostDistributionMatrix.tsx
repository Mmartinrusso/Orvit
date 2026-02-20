'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/contexts/CompanyContext';
import { Plus, Save, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  month?: string;
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
  onSave,
  month,
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
      const currentM = month || new Date().toISOString().slice(0, 7);

      // Cargar categorías de costos indirectos + distribución existente desde la nueva API
      const [distributionRes, categoriesRes] = await Promise.all([
        fetch(`/api/costos/indirect/distribution?month=${currentM}`),
        fetch(`/api/productos/categorias?companyId=${currentCompany.id}`),
      ]);

      let indirectData: IndirectCost[] = [];
      let existingDistributions: any[] = [];

      if (distributionRes.ok) {
        const data = await distributionRes.json();
        const apiCategories: any[] = data.categories || [];

        // Mapear categorías de la API al formato IndirectCost que usa la matriz
        indirectData = apiCategories.map((cat: any, idx: number) => ({
          id: idx + 1,                     // id numérico incremental
          label: cat.label,               // "Servicios Públicos"
          category: cat.key,              // "UTILITIES" — usado para el POST
          currentPrice: cat.monthTotal ?? 0,
        }));

        // Recopilar distribuciones existentes para pre-cargar la matriz
        apiCategories.forEach((cat: any, idx: number) => {
          (cat.distributions || []).forEach((d: any) => {
            existingDistributions.push({
              costId: idx + 1,
              productCategoryId: d.productCategoryId,
              percentage: d.percentage,
            });
          });
        });

        setIndirectCosts(indirectData);
      }

      let categoriesData: ProductCategory[] = [];
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        categoriesData = Array.isArray(data) ? data : data.categories || [];
        setProductCategories(categoriesData);
      }

      // Inicializar matriz con distribuciones existentes
      const initialMatrix: Record<string, Record<string, number>> = {};
      indirectData.forEach((cost) => {
        initialMatrix[cost.id.toString()] = {};
        categoriesData.forEach((category) => {
          const existing = existingDistributions.find(
            (d) => d.costId === cost.id && d.productCategoryId === category.id
          );
          initialMatrix[cost.id.toString()][category.id.toString()] = existing?.percentage ?? 0;
        });
      });
      setMatrix(initialMatrix);

    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
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
    const total = values.reduce((sum, value) => {
      const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
      return sum + numValue;
    }, 0);
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
      const apiPayload: Array<{
        indirectCategory: string;
        productCategoryId: number;
        productCategoryName: string;
        percentage: number;
      }> = [];

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
            apiPayload.push({
              indirectCategory: (cost as any).category, // "UTILITIES", "VEHICLES", etc.
              productCategoryId: category.id,
              productCategoryName: category.name,
              percentage,
            });
          }
        });
      });

      // Guardar en la nueva API
      const saveRes = await fetch('/api/costos/indirect/distribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distributions: apiPayload }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}));
        throw new Error(err.error || 'Error al guardar');
      }

      await onSave(distributions);
      toast.success('Distribución de costos guardada exitosamente');
      onClose();

    } catch (error) {
      console.error('Error guardando distribuciones:', error);
      toast.error(error instanceof Error ? error.message : 'Error al guardar la distribución');
    } finally {
      setSaving(false);
    }
  };

  const getRowTotalColor = (total: number): string => {
    if (total === 100) return 'text-success bg-success-muted';
    if (total > 100) return 'text-destructive bg-destructive/10';
    return 'text-warning-muted-foreground bg-warning-muted';
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Distribución de Costos Indirectos - Matriz Tipo Excel
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-info" />
              <span className="ml-2">Cargando datos...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-border">
                <thead>
                  <tr className="bg-muted">
                    <th className="border border-border p-2 text-left font-semibold min-w-[200px]">
                      Costos Indirectos
                    </th>
                    {productCategories.map(category => {
                      const columnTotal = calculateColumnTotal(category.id.toString());
                      return (
                        <th key={category.id} className="border border-border p-2 text-center font-semibold min-w-[120px]">
                          <div className="flex flex-col">
                            <span className="text-sm">{category.name}</span>
                            <span className="text-xs text-muted-foreground font-normal">
                              Total: {(typeof columnTotal === 'number' ? columnTotal : 0).toFixed(1)}%
                            </span>
                          </div>
                        </th>
                      );
                    })}
                    <th className="border border-border p-2 text-center font-semibold bg-info-muted min-w-[100px]">
                      Total Fila
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {indirectCosts.map(cost => {
                    const rowTotal = calculateRowTotal(cost.id.toString());
                    return (
                      <tr key={cost.id} className="hover:bg-muted">
                        <td className="border border-border p-2 font-medium">
                          <div className="flex flex-col">
                            <span className="text-sm">{cost.label}</span>
                            <span className="text-xs text-muted-foreground">
                              ${cost.currentPrice.toLocaleString()}
                            </span>
                          </div>
                        </td>
                        {productCategories.map(category => (
                          <td key={category.id} className="border border-border p-1">
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
                        <td className={cn('border border-border p-2 text-center font-semibold', getRowTotalColor(rowTotal))}>
                          <div className="flex items-center justify-center gap-1">
                            {rowTotal === 100 ? (
                              <CheckCircle className="h-4 w-4 text-success" />
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
          <div className="bg-muted p-4 rounded-lg">
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
                <span className="ml-1 text-success font-semibold">
                  {indirectCosts.filter(cost => calculateRowTotal(cost.id.toString()) === 100).length}
                </span>
              </div>
              <div>
                <span className="font-medium">Filas con Errores:</span> 
                <span className="ml-1 text-destructive font-semibold">
                  {indirectCosts.filter(cost => calculateRowTotal(cost.id.toString()) !== 100).length}
                </span>
              </div>
            </div>
          </div>
        </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-info hover:bg-info/90"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar Distribución
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
