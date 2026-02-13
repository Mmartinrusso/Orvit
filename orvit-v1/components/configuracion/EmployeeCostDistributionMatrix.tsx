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

interface EmployeeCategory {
  id: number;
  name: string;
  description?: string;
}

interface ProductCategory {
  id: number;
  name: string;
  description?: string;
}

interface EmployeeCostDistributionMatrixProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (distributions: EmployeeCostDistribution[]) => void;
}

interface EmployeeCostDistribution {
  employeeCategoryId: number;
  employeeCategoryName: string;
  productCategoryId: number;
  productCategoryName: string;
  percentage: number;
}

export default function EmployeeCostDistributionMatrix({
  isOpen,
  onClose,
  onSave
}: EmployeeCostDistributionMatrixProps) {
  const { currentCompany } = useCompany();
  const [indirectCosts, setIndirectCosts] = useState<IndirectCost[]>([]);
  const [employeeCategories, setEmployeeCategories] = useState<EmployeeCategory[]>([]);
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
      // Cargar categorías de empleados
      const employeeResponse = await fetch(`/api/employee-categories?companyId=${currentCompany.id}`);
      let employeeData = [];
      if (employeeResponse.ok) {
        employeeData = await employeeResponse.json();
        setEmployeeCategories(employeeData);
      }

      // Cargar categorías de productos
      const productResponse = await fetch(`/api/productos/categorias?companyId=${currentCompany.id}`);
      let productData = [];
      if (productResponse.ok) {
        productData = await productResponse.json();
        setProductCategories(productData);
      }

      // Cargar distribuciones existentes después de cargar las categorías
      await loadExistingDistributions(employeeData, productData);

    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingDistributions = async (employeeCategoriesData: EmployeeCategory[], productCategoriesData: ProductCategory[]) => {
    try {
      const response = await fetch(`/api/employee-cost-distribution/bulk?companyId=${currentCompany?.id}`);
      if (response.ok) {
        const existingDistributions = await response.json();
        
        // Inicializar matriz con distribuciones existentes
        const initialMatrix: Record<string, Record<string, number>> = {};
        
        employeeCategoriesData.forEach(employeeCategory => {
          initialMatrix[employeeCategory.id.toString()] = {};
          productCategoriesData.forEach(productCategory => {
            const existing = existingDistributions.find((d: any) => 
              d.employeeCategoryId === employeeCategory.id && d.productCategoryId === productCategory.id
            );
            const percentage = existing?.percentage ? parseFloat(existing.percentage) : 0;
            initialMatrix[employeeCategory.id.toString()][productCategory.id.toString()] = percentage;
          });
        });
        
        setMatrix(initialMatrix);
      }
    } catch (error) {
      console.error('Error cargando distribuciones existentes:', error);
    }
  };

  const updateMatrixValue = (employeeCategoryId: string, productCategoryId: string, value: string) => {
    const numericValue = parseFloat(value) || 0;
    
    setMatrix(prev => ({
      ...prev,
      [employeeCategoryId]: {
        ...prev[employeeCategoryId],
        [productCategoryId]: numericValue
      }
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent, employeeCategoryId: string, productCategoryId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // Encontrar el índice actual de la categoría de empleado y producto
      const currentEmployeeIndex = employeeCategories.findIndex(category => category.id.toString() === employeeCategoryId);
      const currentProductIndex = productCategories.findIndex(category => category.id.toString() === productCategoryId);
      
      if (currentEmployeeIndex < employeeCategories.length - 1) {
        // Si no es la última categoría de empleado, mover a la siguiente categoría de empleado en la misma columna de producto
        const nextEmployeeId = employeeCategories[currentEmployeeIndex + 1].id.toString();
        const nextInput = document.querySelector(`input[data-employee-id="${nextEmployeeId}"][data-product-id="${productCategoryId}"]`) as HTMLInputElement;
        
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      } else if (currentProductIndex < productCategories.length - 1) {
        // Si es la última categoría de empleado pero no la última categoría de producto, mover a la primera fila de la siguiente columna
        const nextProductId = productCategories[currentProductIndex + 1].id.toString();
        const nextInput = document.querySelector(`input[data-employee-id="${employeeCategories[0].id.toString()}"][data-product-id="${nextProductId}"]`) as HTMLInputElement;
        
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

  const calculateRowTotal = (employeeCategoryId: string): number => {
    const row = matrix[employeeCategoryId] || {};
    const values = Object.values(row);
    console.log(`🔍 Calculando total fila ${employeeCategoryId}:`, values);
    const total = values.reduce((sum, value) => {
      const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
      return sum + numValue;
    }, 0);
    console.log(`✅ Total calculado:`, total);
    return isNaN(total) ? 0 : total;
  };

  const calculateColumnTotal = (productCategoryId: string): number => {
    const total = Object.values(matrix).reduce((sum, row) => {
      const value = row[productCategoryId];
      const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
      return sum + numValue;
    }, 0);
    return isNaN(total) ? 0 : total;
  };

  const validateMatrix = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Verificar que cada fila (categoría de empleado) sume 100%
    employeeCategories.forEach(employeeCategory => {
      const rowTotal = calculateRowTotal(employeeCategory.id.toString());
      if (rowTotal !== 100) {
        errors.push(`${employeeCategory.name}: debe sumar 100% (actual: ${rowTotal.toFixed(1)}%)`);
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
      const distributions: EmployeeCostDistribution[] = [];
      
      employeeCategories.forEach(employeeCategory => {
        productCategories.forEach(productCategory => {
          const percentage = matrix[employeeCategory.id.toString()]?.[productCategory.id.toString()] || 0;
          if (percentage > 0) {
            distributions.push({
              employeeCategoryId: employeeCategory.id,
              employeeCategoryName: employeeCategory.name,
              productCategoryId: productCategory.id,
              productCategoryName: productCategory.name,
              percentage
            });
          }
        });
      });

      await onSave(distributions);
      toast.success('Distribución de empleados por categorías de productos guardada exitosamente');
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
            Distribución de Empleados por Categorías de Productos - Matriz Tipo Excel
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
                      Categorías de Empleados
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
                  {employeeCategories.map(employeeCategory => {
                    const rowTotal = calculateRowTotal(employeeCategory.id.toString());
                    return (
                      <tr key={employeeCategory.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-2 font-medium">
                          <div className="flex flex-col">
                            <span className="text-sm">{employeeCategory.name}</span>
                            {employeeCategory.description && (
                              <span className="text-xs text-gray-500">
                                {employeeCategory.description}
                              </span>
                            )}
                          </div>
                        </td>
                        {productCategories.map(productCategory => (
                          <td key={productCategory.id} className="border border-gray-300 p-1">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={matrix[employeeCategory.id.toString()]?.[productCategory.id.toString()] || ''}
                              onChange={(e) => updateMatrixValue(employeeCategory.id.toString(), productCategory.id.toString(), e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, employeeCategory.id.toString(), productCategory.id.toString())}
                              className="w-full text-center border-0 focus:ring-1 focus:ring-blue-500"
                              placeholder="0"
                              data-employee-id={employeeCategory.id.toString()}
                              data-product-id={productCategory.id.toString()}
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
                <span className="font-medium">Categorías de Empleados:</span> {employeeCategories.length}
              </div>
              <div>
                <span className="font-medium">Categorías de Productos:</span> {productCategories.length}
              </div>
              <div>
                <span className="font-medium">Filas Válidas (100%):</span> 
                <span className="ml-1 text-green-600 font-semibold">
                  {employeeCategories.filter(category => calculateRowTotal(category.id.toString()) === 100).length}
                </span>
              </div>
              <div>
                <span className="font-medium">Filas con Errores:</span> 
                <span className="ml-1 text-red-600 font-semibold">
                  {employeeCategories.filter(category => calculateRowTotal(category.id.toString()) !== 100).length}
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
