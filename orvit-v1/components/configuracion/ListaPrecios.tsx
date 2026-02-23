'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCompany } from '@/contexts/CompanyContext';
import { cn, formatNumber } from '@/lib/utils';
import { DollarSign, Package, Calculator, TrendingUp, Info, Calendar, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface ProductPrice {
  id: number;
  product_name: string;
  product_description: string;
  sku: string;
  current_price: number;
  current_cost: number;
  stock_quantity: number;
  category_name: string;
  category_id: number; // ID de la categoría del producto
  recipe_id: number | null;
  recipe_name: string | null;
  output_quantity: number;
  output_unit_label: string;
  intermediate_quantity: number; // Cantidad de placas/pastones por lote
  intermediate_unit_label: string; // Unidad intermedia (placas, pastones, etc.)
  base_type: string;
  calculated_cost: number;
  calculated_price: number;
  units_per_item: number; // Unidades por placa/pastón/etc
  cost_breakdown: {
    materials: number;
    indirect_costs: number;
    employee_costs: number;
    total: number;
  };
  cost_breakdown_per_unit: {
    materials: number;
    indirect_costs: number;
    employee_costs: number;
    total: number;
  };
  recipe_details: any[];
  indirect_costs_breakdown: any[];
  employee_costs_breakdown: any[];
  total_products_in_category: number;
  total_production_in_category: number;
  production_info: {
    source: string;
    actual_production: number;
    planned_production: number;
    production_month: string | null;
    batches_needed: number;
    materials_cost_per_batch: number;
  };
  average_sale_price: number;
}

export default function ListaPrecios() {
  const { currentCompany } = useCompany();
  const [productPrices, setProductPrices] = useState<ProductPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProductionMonth, setSelectedProductionMonth] = useState<string>('planificada');
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  
  // Estados para el simulador
  const [simulationProduct, setSimulationProduct] = useState<ProductPrice | null>(null);
  const [simulationQuantity, setSimulationQuantity] = useState<number>(0);
  const [simulationUnit, setSimulationUnit] = useState<string>('unidades');
  const [simulationDays, setSimulationDays] = useState<number>(1);
  const [simulationResult, setSimulationResult] = useState<{
    unitPrice: number;
    totalCost: number;
    profitMargin: number;
    batchesNeeded: number;
    actualQuantity: number;
    costBreakdown: {
      materials: number;
      indirect: number;
      employees: number;
    };
  } | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);

  // Estados para costos de distribución
  const [indirectCostsTotal, setIndirectCostsTotal] = useState<number>(0);
  const [employeeCostsTotal, setEmployeeCostsTotal] = useState<number>(0);

  // Generar meses para el selector (últimos 12 meses)
  const generateMonths = () => {
    const months = [];
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthStr = date.toISOString().slice(0, 7);
      months.push(monthStr);
    }
    return months;
  };

  const months = generateMonths();

    useEffect(() => {
  if (currentCompany) {
    loadProductPrices();
  }
}, [currentCompany, selectedProductionMonth]);

  // Función para calcular costos de distribución por categoría
  const calculateDistributionCosts = async (productCategoryId: number) => {
    if (!currentCompany) return { indirect: 0, employee: 0 };
    
    try {
      // Cargar distribución de costos indirectos para esta categoría
      const costResponse = await fetch(`/api/cost-distribution?companyId=${currentCompany.id}`);
      if (costResponse.ok) {
        const costData = await costResponse.json();
        const categoryCosts = costData.filter((cost: any) => cost.product_category_id === productCategoryId);
        
        // Obtener valores totales de costos indirectos
        const indirectResponse = await fetch(`/api/indirect-items?companyId=${currentCompany.id}`);
        if (indirectResponse.ok) {
          const indirectData = await indirectResponse.json();
          
          let totalIndirect = 0;
          categoryCosts.forEach((cost: any) => {
            const matchingIndirectCost = indirectData.indirectItems.find((ic: any) => 
              ic.label === cost.cost_name
            );
            if (matchingIndirectCost) {
              const percentage = parseFloat(cost.percentage) || 0;
              const totalCost = parseFloat(matchingIndirectCost.currentPrice) || 0;
              totalIndirect += (totalCost * percentage) / 100;
            }
          });
          
          // Cargar distribución de empleados para esta categoría
          const empResponse = await fetch(`/api/employee-distribution?companyId=${currentCompany.id}`);
          if (empResponse.ok) {
            const empData = await empResponse.json();
            const categoryEmployees = empData.filter((emp: any) => emp.productCategoryId === productCategoryId);
            
            // Obtener salarios totales
            const salariesResponse = await fetch(`/api/employee-categories/salaries?companyId=${currentCompany.id}`);
            if (salariesResponse.ok) {
              const salariesData = await salariesResponse.json();
              
              let totalEmployee = 0;
              categoryEmployees.forEach((emp: any) => {
                const matchingSalary = salariesData.find((cat: any) => cat.category_id === emp.employeeId);
                if (matchingSalary) {
                  const percentage = parseFloat(emp.percentage) || 0;
                  const totalSalary = parseFloat(matchingSalary.total_salary) || 0;
                  totalEmployee += (totalSalary * percentage) / 100;
                }
              });
              
              return { indirect: totalIndirect, employee: totalEmployee };
            }
          }
        }
      }
    } catch (error) {
      console.error('Error calculando costos de distribución:', error);
    }
    
    return { indirect: 0, employee: 0 };
  };

  const loadProductPrices = async () => {
    if (!currentCompany) return;
    
    setLoading(true);
    try {
      let url = `/api/lista-precios-recetas?companyId=${currentCompany.id}`;
      if (selectedProductionMonth && selectedProductionMonth !== 'planificada') {
        url += `&productionMonth=${selectedProductionMonth}`;
      }
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        setProductPrices(data.productPrices);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const syncPrices = async () => {
    if (!currentCompany) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/sync-precios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId: currentCompany.id
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Precios sincronizados con Recetas! Procesados: ${result.processed}, Actualizados: ${result.updated}. Ahora ambas secciones mostrarán los mismos precios.`);
        
        // Recargar los precios
        await loadProductPrices();
      } else {
        const error = await response.json();
        console.error('❌ Error sincronizando:', error);
        toast.error('Error al sincronizar precios');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      toast.error('Error al sincronizar precios');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // formatNumber imported from @/lib/utils

  // Función para calcular la simulación de precios
  const calculateSimulation = async () => {
    if (!simulationProduct || simulationQuantity <= 0 || simulationDays <= 0) {
      toast.warning('Por favor completa todos los campos con valores válidos');
      return;
    }

    // Calcular cantidad total en la unidad seleccionada (cantidad por día × días de producción)
    const totalQuantityInSelectedUnit = simulationQuantity * simulationDays;
    
    // Obtener unidades por item desde la receta
    const unitsPerItem = simulationProduct.units_per_item || 1;

    // Convertir a unidades según la unidad seleccionada y la receta del producto
    let totalQuantityInUnits;
    if (simulationUnit === 'unidades') {
      // Si es unidades, usar directamente
      totalQuantityInUnits = totalQuantityInSelectedUnit;
    } else if (simulationUnit.toLowerCase() === 'pastones' || simulationUnit.toLowerCase() === 'paston') {
      // Si es pastones, multiplicar por unidades por lote (output_quantity)
      totalQuantityInUnits = totalQuantityInSelectedUnit * simulationProduct.output_quantity;
    } else if (simulationUnit.toLowerCase() === simulationProduct.intermediate_unit_label?.toLowerCase()) {
      // Si la unidad seleccionada coincide con la unidad intermedia de la receta (placas, moldes, etc.)
      totalQuantityInUnits = totalQuantityInSelectedUnit * unitsPerItem;
    } else {
      // Si es otra unidad, asumir 1:1 por ahora (se puede mejorar después)
      totalQuantityInUnits = totalQuantityInSelectedUnit;
    }

    // Calcular lotes necesarios basado en unidades
    const batchesNeeded = Math.ceil(totalQuantityInUnits / simulationProduct.output_quantity);

    // La cantidad real es la cantidad calculada, no ajustada por lotes
    const actualQuantityInUnits = totalQuantityInUnits;

    // Calcular costos por lote
    const materialsCostPerBatch = simulationProduct.cost_breakdown.materials;

    // Costos totales
    const totalMaterialsCost = materialsCostPerBatch * batchesNeeded;

    // Calcular costos de distribución por categoría del producto
    const distributionCosts = await calculateDistributionCosts(simulationProduct.category_id);
    const totalIndirectCosts = distributionCosts.indirect;
    const totalEmployeeCosts = distributionCosts.employee;
    const totalCost = totalMaterialsCost + totalIndirectCosts + totalEmployeeCosts;
    
    // Calcular precio unitario (sin margen de ganancia)
    const unitPrice = totalCost / actualQuantityInUnits;

    setSimulationResult({
      unitPrice: unitPrice,
      totalCost: totalCost,
      profitMargin: 0, // Sin margen de ganancia
      batchesNeeded: batchesNeeded,
      actualQuantity: actualQuantityInUnits,
      costBreakdown: {
        materials: totalMaterialsCost,
        indirect: totalIndirectCosts,
        employees: totalEmployeeCosts
      }
    });
  };

  const toggleProductExpansion = (productId: number) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const isProductExpanded = (productId: number) => {
    return expandedProducts.has(productId);
  };

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">Selecciona una empresa para continuar</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Calculando precios de productos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Cálculo de Precios</h1>
        <div className="flex items-center gap-2">
          <Button 
            onClick={syncPrices}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Sincronizar con Recetas
          </Button>
          <Badge variant="outline" className="text-sm">
            {currentCompany.name}
          </Badge>
        </div>
      </div>

      {/* Simulador de Precios */}
      <Card>
        <CardHeader 
          className="cursor-pointer hover:bg-accent transition-colors"
          onClick={() => setIsSimulatorOpen(!isSimulatorOpen)}
        >
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calculator className="h-5 w-5" />
              <span>Simulador de Precios</span>
            </div>
            {isSimulatorOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </CardTitle>
          <CardDescription>
            Simula precios unitarios basados en diferentes cantidades de producción
          </CardDescription>
        </CardHeader>
        {isSimulatorOpen && (
          <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="simulationProduct">Producto</Label>
              <Select onValueChange={(value) => {
                const product = productPrices.find(p => p.id.toString() === value);
                if (product) {
                  setSimulationProduct(product);
                  setSimulationQuantity(product.output_quantity);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {productPrices.map((product) => (
                    <SelectItem key={product.id} value={product.id.toString()}>
                      {product.product_name} ({product.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="simulationQuantity">Cantidad por Día</Label>
              <Input
                id="simulationQuantity"
                type="number"
                value={simulationQuantity}
                onChange={(e) => setSimulationQuantity(parseInt(e.target.value) || 0)}
                placeholder="Ej: 1920"
              />
            </div>
            <div>
              <Label htmlFor="simulationUnit">Unidad de Medida</Label>
              <Select value={simulationUnit} onValueChange={setSimulationUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar unidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unidades">Unidades</SelectItem>
                  <SelectItem value="pastones">Pastones</SelectItem>
                  <SelectItem value="placas">Placas</SelectItem>
                  <SelectItem value="metros">Metros</SelectItem>
                  <SelectItem value="kg">Kilogramos</SelectItem>
                  <SelectItem value="toneladas">Toneladas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="simulationDays">Días de Producción</Label>
              <Input
                id="simulationDays"
                type="number"
                value={simulationDays}
                onChange={(e) => setSimulationDays(parseInt(e.target.value) || 1)}
                placeholder="Ej: 5"
                min="1"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={calculateSimulation} className="w-full">
                <Calculator className="h-4 w-4 mr-2" />
                Calcular Precio
              </Button>
            </div>
          </div>
          
          {simulationResult && (
            <div className="mt-4 space-y-4">
              {/* Resultado principal */}
              <div className="p-4 bg-info-muted rounded-lg">
                <h4 className="font-semibold text-info-muted-foreground mb-2">📊 Resultado de la Simulación:</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">
                      {formatCurrency(simulationResult.unitPrice)}
                    </div>
                    <div className="text-sm text-muted-foreground">Costo por Unidad</div>
                    <div className="text-xs text-muted-foreground">
                      ({formatNumber(simulationResult.actualQuantity)} unidades)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatNumber(simulationQuantity)} {simulationUnit}/día × {simulationDays} días
                      {simulationUnit !== 'unidades' && (simulationUnit.toLowerCase() === 'pastones' || simulationUnit.toLowerCase() === 'paston') && (
                        <span> × {simulationProduct.output_quantity} unidades/lote</span>
                      )}
                      {simulationUnit !== 'unidades' && simulationUnit.toLowerCase() !== 'pastones' && simulationUnit.toLowerCase() !== 'paston' && simulationUnit.toLowerCase() === simulationProduct.intermediate_unit_label?.toLowerCase() && (
                        <span> × {simulationProduct.units_per_item || 1} unidades/{simulationProduct.intermediate_unit_label?.slice(0, -1)}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-info-muted-foreground">
                      {formatCurrency(simulationResult.totalCost)}
                    </div>
                    <div className="text-sm text-muted-foreground">Costo Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-warning-muted-foreground">
                      {formatNumber(simulationResult.batchesNeeded)}
                    </div>
                    <div className="text-sm text-muted-foreground">Lotes Necesarios</div>
                  </div>
                </div>
                
                {/* Desglose detallado de costos */}
                <div className="mt-4 p-3 bg-card rounded-lg border">
                  <h5 className="font-semibold text-foreground mb-3">💰 Desglose de Costos:</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-destructive">
                        {formatCurrency(simulationResult.costBreakdown.materials)}
                      </div>
                      <div className="text-sm text-muted-foreground">Materiales</div>
                      <div className="text-xs text-muted-foreground">
                        {formatNumber((simulationResult.costBreakdown.materials / simulationResult.totalCost) * 100, 1)}% del total
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-warning-muted-foreground">
                        {formatCurrency(simulationResult.costBreakdown.indirect)}
                      </div>
                      <div className="text-sm text-muted-foreground">Costos Indirectos</div>
                      <div className="text-xs text-muted-foreground">
                        {formatNumber((simulationResult.costBreakdown.indirect / simulationResult.totalCost) * 100, 1)}% del total
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-info-muted-foreground">
                        {formatCurrency(simulationResult.costBreakdown.employees)}
                      </div>
                      <div className="text-sm text-muted-foreground">Costos de Empleados</div>
                      <div className="text-xs text-muted-foreground">
                        {formatNumber((simulationResult.costBreakdown.employees / simulationResult.totalCost) * 100, 1)}% del total
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabla comparativa de escenarios */}
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold text-foreground mb-3">📈 Comparación de Escenarios:</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Cantidad Total (unidades)</th>
                        <th className="text-right p-2">Pastones</th>
                        <th className="text-right p-2">Placas</th>
                        <th className="text-right p-2">Costo Total</th>
                        <th className="text-right p-2">Precio Unitario</th>
                        <th className="text-right p-2">Ahorro por Unidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((multiplier) => {
                        const unitsPerItem = simulationProduct.units_per_item || 1;
                        const totalQuantityInSelectedUnit = (simulationQuantity * simulationDays) * multiplier;
                        
                        // Convertir a unidades según la unidad seleccionada y la receta del producto
                        let requestedQuantity;
                        if (simulationUnit === 'unidades') {
                          // Si es unidades, usar directamente
                          requestedQuantity = Math.round(totalQuantityInSelectedUnit);
                        } else if (simulationUnit.toLowerCase() === 'pastones' || simulationUnit.toLowerCase() === 'paston') {
                          // Si es pastones, multiplicar por unidades por lote (output_quantity)
                          requestedQuantity = Math.round(totalQuantityInSelectedUnit * simulationProduct.output_quantity);
                        } else if (simulationUnit.toLowerCase() === simulationProduct.intermediate_unit_label?.toLowerCase()) {
                          // Si la unidad seleccionada coincide con la unidad intermedia de la receta (placas, moldes, etc.)
                          requestedQuantity = Math.round(totalQuantityInSelectedUnit * unitsPerItem);
                        } else {
                          // Si es otra unidad, asumir 1:1 por ahora
                          requestedQuantity = Math.round(totalQuantityInSelectedUnit);
                        }
                        
                        const batches = Math.ceil(requestedQuantity / simulationProduct.output_quantity);
                        const actualQuantity = requestedQuantity; // Usar la cantidad solicitada, no ajustada por lotes
                        
                        // Calcular pastones y placas equivalentes
                        const pastones = Math.round(actualQuantity / simulationProduct.output_quantity);
                        const placas = Math.round(actualQuantity / unitsPerItem);
                        
                        // Calcular cantidades diarias para tooltips
                        const pastonesDiarios = Math.round(pastones / simulationDays);
                        const placasDiarias = Math.round(placas / simulationDays);
                        
                        // Calcular costos por lote
                        const materialsCostPerBatch = simulationProduct.cost_breakdown.materials;
                        
                        // Costos totales
                        const totalMaterialsCost = materialsCostPerBatch * batches;
                        // Usar costos de distribución por categoría (mismo que en el cálculo principal)
                        const totalIndirectCosts = simulationResult?.costBreakdown.indirect || 0;
                        const totalEmployeeCosts = simulationResult?.costBreakdown.employees || 0;
                        const totalCost = totalMaterialsCost + totalIndirectCosts + totalEmployeeCosts;
                        
                        const unitPrice = totalCost / actualQuantity;
                        const finalPrice = unitPrice; // Sin margen de ganancia
                        const difference = finalPrice - simulationResult.unitPrice;
                        const percentageDifference = simulationResult.unitPrice > 0 ? (difference / simulationResult.unitPrice) * 100 : 0;
                        
                        return (
                          <tr key={multiplier} className="border-b hover:bg-accent">
                            <td className="p-2">
                              {formatNumber(actualQuantity)} unidades
                              {actualQuantity !== requestedQuantity && (
                                <div className="text-xs text-muted-foreground">
                                  (solicitado: {formatNumber(requestedQuantity)} unidades)
                                </div>
                              )}
                            </td>
                            <td className="p-2 text-right group relative">
                              <span className="cursor-help hover:text-info-muted-foreground transition-colors">
                                {formatNumber(pastones)}
                              </span>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-foreground text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 whitespace-nowrap">
                                {formatNumber(pastonesDiarios)} pastones/día
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                              </div>
                            </td>
                            <td className="p-2 text-right group relative">
                              <span className="cursor-help hover:text-info-muted-foreground transition-colors">
                                {formatNumber(placas)}
                              </span>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-foreground text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 whitespace-nowrap">
                                {formatNumber(placasDiarias)} placas/día
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                              </div>
                            </td>
                            <td className="p-2 text-right">{formatCurrency(totalCost)}</td>
                            <td className="p-2 text-right font-semibold">{formatCurrency(finalPrice)}</td>
                            <td className={cn('p-2 text-right', difference < 0 ? 'text-success' : 'text-destructive')}>
                              <div className="flex flex-col items-end">
                                <span className="font-medium">
                                  {difference < 0 ? 'Ahorro: ' : 'Costo extra: '}{formatCurrency(Math.abs(difference))}
                                </span>
                                <span className="text-xs opacity-75">
                                  {difference < 0 ? '-' : '+'}{formatNumber(Math.abs(percentageDifference), 1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  * Al producir más, los costos indirectos y de empleados se distribuyen entre más unidades, reduciendo el costo unitario
                </div>
              </div>
            </div>
          )}
          </CardContent>
        )}
      </Card>

      {/* Selector de mes de producción */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Configuración de Cálculo</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="productionMonth">Mes</Label>
              <Select value={selectedProductionMonth} onValueChange={setSelectedProductionMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar mes de producción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planificada">Producción Planificada (Receta)</SelectItem>
                  {months.map((month) => (
                    <SelectItem key={month} value={month}>
                      Producción Real - {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="text-sm text-muted-foreground">
                {selectedProductionMonth === 'planificada' 
                  ? 'Usando cantidad de producción de la receta'
                  : `Mostrando producción y ventas del mes ${selectedProductionMonth}`
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen de cálculo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calculator className="h-5 w-5" />
            <span>Resumen del Cálculo de Precios</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-info-muted-foreground">
                {productPrices.length}
              </div>
              <div className="text-sm text-muted-foreground">Productos</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-success">
                {productPrices.filter(p => p.recipe_id).length}
              </div>
              <div className="text-sm text-muted-foreground">Con Receta</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-warning-muted-foreground">
                {productPrices.filter(p => !p.recipe_id).length}
              </div>
              <div className="text-sm text-muted-foreground">Sin Receta</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-info-muted-foreground">
                {productPrices.filter(p => p.calculated_price > p.current_price).length}
              </div>
              <div className="text-sm text-muted-foreground">Precio Ajustado</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Costos Totales de Materiales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calculator className="h-5 w-5" />
            <span>Costos Totales de Materiales</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg bg-info-muted">
              <div className="text-2xl font-bold text-info-muted-foreground">
                {formatCurrency(productPrices
                  .filter(p => p.production_info && p.production_info.actual_production > 0)
                  .reduce((sum, p) => sum + p.cost_breakdown.materials, 0))}
              </div>
              <div className="text-sm text-info-muted-foreground">Materiales Totales</div>
              <div className="text-xs text-muted-foreground mt-1">
                Solo productos con producción en {selectedProductionMonth === 'planificada' ? 'planificada' : selectedProductionMonth}
              </div>
            </div>
            
            <div className="text-center p-4 border rounded-lg bg-warning-muted">
              <div className="text-2xl font-bold text-warning-muted-foreground">
                {formatCurrency(productPrices
                  .filter(p => p.production_info && p.production_info.actual_production > 0)
                  .reduce((sum, p) => sum + p.cost_breakdown.indirect_costs, 0))}
              </div>
              <div className="text-sm text-warning-muted-foreground">Costos Indirectos Totales</div>
              <div className="text-xs text-muted-foreground mt-1">
                Solo productos con producción en {selectedProductionMonth === 'planificada' ? 'planificada' : selectedProductionMonth}
              </div>
            </div>
            
            <div className="text-center p-4 border rounded-lg bg-info-muted">
              <div className="text-2xl font-bold text-info-muted-foreground">
                {formatCurrency(productPrices
                  .filter(p => p.production_info && p.production_info.actual_production > 0)
                  .reduce((sum, p) => sum + p.cost_breakdown.employee_costs, 0))}
              </div>
              <div className="text-sm text-info-muted-foreground">Costos Empleados Totales</div>
              <div className="text-xs text-muted-foreground mt-1">
                Solo productos con producción en {selectedProductionMonth === 'planificada' ? 'planificada' : selectedProductionMonth}
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-4 border rounded-lg bg-success-muted">
            <div className="text-center">
              <div className="text-3xl font-bold text-success">
                {formatCurrency(productPrices
                  .filter(p => p.production_info && p.production_info.actual_production > 0)
                  .reduce((sum, p) => sum + p.cost_breakdown.total, 0))}
              </div>
              <div className="text-lg text-success">Costo Total General</div>
              <div className="text-sm text-muted-foreground mt-1">
                Materiales + Indirectos + Empleados (mes {selectedProductionMonth === 'planificada' ? 'planificada' : selectedProductionMonth})
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de productos con precios */}
      <div className="space-y-3">
        {productPrices.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            {/* Header compacto - siempre visible */}
            <CardHeader className="bg-muted p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleProductExpansion(product.id)}
                    className="p-1 h-6 w-6"
                  >
                    {isProductExpanded(product.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                  <Package className="h-5 w-5 text-info-muted-foreground" />
                  <div className="flex-1">
                    <CardTitle className="text-lg">{product.product_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {product.product_description} • SKU: {product.sku}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <Badge variant="outline" className="mb-1">
                      {product.category_name}
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      Producción: {formatNumber(product.production_info?.actual_production || 0)} Un
                    </div>
                  </div>
                  
                  {/* Información clave de precios */}
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Precio Promedio de Venta</div>
                    <div className="text-lg font-bold text-info-muted-foreground">
                      {product.average_sale_price > 0 ? formatCurrency(product.average_sale_price) : 'Sin ventas'}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Costo por Unidad</div>
                    <div className="text-lg font-bold text-info-muted-foreground">
                      {formatCurrency(product.calculated_cost)}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            {/* Contenido expandible */}
            {isProductExpanded(product.id) && (
              <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Información de receta */}
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center space-x-2">
                      <Info className="h-4 w-4" />
                      <span>Información de Receta</span>
                    </h4>
                    
                    {product.recipe_id ? (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Receta:</span>
                          <span className="font-medium">{product.recipe_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Producción Planificada:</span>
                          <span className="font-medium">
                            {formatNumber(product.output_quantity)} {product.output_unit_label} por lote
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Tipo:</span>
                          <span className="font-medium">{product.base_type}</span>
                        </div>
                        
                        {/* Información de producción utilizada */}
                        {product.production_info && (
                          <div className="mt-3 p-3 border rounded-lg bg-info-muted">
                            <h5 className="text-sm font-medium mb-2 text-info-muted-foreground">Producción Utilizada para el Cálculo:</h5>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-xs text-info-muted-foreground">Fuente:</span>
                                <span className="text-xs font-medium text-info-muted-foreground">
                                  {product.production_info.source === 'real' ? 'Producción Real' : 'Producción Planificada'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-xs text-info-muted-foreground">Cantidad:</span>
                                <span className="text-xs font-medium text-info-muted-foreground">
                                  {formatNumber(product.production_info.actual_production)} {product.output_unit_label}
                                </span>
                              </div>
                              {product.production_info.production_month && (
                                <div className="flex justify-between">
                                  <span className="text-xs text-info-muted-foreground">Mes:</span>
                                  <span className="text-xs font-medium text-info-muted-foreground">
                                    {product.production_info.production_month}
                                  </span>
                                </div>
                              )}
                              {product.production_info.source === 'real' && (
                                <div className="flex justify-between">
                                  <span className="text-xs text-info-muted-foreground">Diferencia vs Planificado:</span>
                                  <span className={cn(
                                    'text-xs font-medium',
                                    product.production_info.actual_production > product.production_info.planned_production
                                      ? 'text-success'
                                      : 'text-destructive'
                                  )}>
                                    {product.production_info.actual_production > product.production_info.planned_production ? '+' : ''}
                                    {formatNumber((product.production_info.actual_production - product.production_info.planned_production) / product.production_info.planned_production * 100, 1)}%
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-xs text-info-muted-foreground">Lotes necesarios:</span>
                                <span className="text-xs font-medium text-info-muted-foreground">
                                  {formatNumber(product.production_info.batches_needed)} lotes
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-xs text-info-muted-foreground">Costo materiales por lote:</span>
                                <span className="text-xs font-medium text-info-muted-foreground">
                                  {formatCurrency(product.production_info.materials_cost_per_batch)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Detalles de insumos */}
                        {product.recipe_details && product.recipe_details.length > 0 && (
                          <div className="mt-4">
                            <h5 className="text-sm font-medium mb-2">Insumos utilizados:</h5>
                            <div className="space-y-1">
                              {product.recipe_details.map((item: any, index: number) => (
                                <div key={index} className="text-xs text-muted-foreground">
                                  • {item.supply_name}: {item.quantity} {item.unit_measure}
                                  {item.price_per_unit && ` (${formatCurrency(item.price_per_unit)}/${item.unit_measure})`}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Información de redistribución dinámica */}
                        {product.indirect_costs_breakdown && product.indirect_costs_breakdown.length > 0 && (
                          <div className="mt-4 p-3 border rounded-lg bg-warning-muted">
                            <h5 className="text-sm font-medium mb-2 text-warning-muted-foreground">Redistribución Dinámica de Costos:</h5>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-xs text-warning-muted-foreground">Productos con producción en categoría:</span>
                                <span className="text-xs font-medium text-warning-muted-foreground">
                                  {product.total_products_in_category} productos
                                </span>
                              </div>
                              {product.total_production_in_category > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-xs text-warning-muted-foreground">Producción total en categoría:</span>
                                  <span className="text-xs font-medium text-warning-muted-foreground">
                                    {formatNumber(product.total_production_in_category)} unidades
                                  </span>
                                </div>
                              )}
                              
                              {/* Mostrar tipo de distribución */}
                              {product.indirect_costs_breakdown.some((cost: any) => cost.distribution_type === 'redistribuido_a_otras_categorias') && (
                                <div className="mt-2 p-2 bg-destructive/10 border border-destructive/30 rounded">
                                  <div className="text-xs text-destructive font-medium">
                                    ⚠️ Sin producción en esta categoría
                                  </div>
                                  <div className="text-xs text-destructive mt-1">
                                    Los costos se redistribuyen a otras categorías con producción
                                  </div>
                                </div>
                              )}
                              
                              {product.indirect_costs_breakdown.some((cost: any) => cost.distribution_type === 'normal') && (
                                <div className="text-xs text-warning-muted-foreground mt-2">
                                  💡 Los costos se redistribuyen solo entre productos que se producen realmente
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No hay receta activa configurada
                      </div>
                    )}
                  </div>

                  {/* Análisis de costos y precios */}
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center space-x-2">
                      <TrendingUp className="h-4 w-4" />
                      <span>Análisis de Costos y Precios</span>
                    </h4>
                    
                    <div className="space-y-3">
                      {/* Desglose de costos */}
                      {product.recipe_id && (
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium">Desglose de costos por lote:</h5>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Materiales:</span>
                              <span>{formatCurrency(product.cost_breakdown.materials)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Costos indirectos:</span>
                              <span>{formatCurrency(product.cost_breakdown.indirect_costs)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Costos empleados:</span>
                              <span>{formatCurrency(product.cost_breakdown.employee_costs)}</span>
                            </div>
                            <div className="flex justify-between border-t pt-1 font-medium">
                              <span>Total por lote:</span>
                              <span>{formatCurrency(product.cost_breakdown.total)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Costo por unidad:</span>
                              <span>{formatCurrency(product.calculated_cost)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Recomendación */}
                      {product.recipe_id && (
                        <div className={cn(
                          'p-3 rounded-lg text-sm',
                          product.average_sale_price > 0 && product.average_sale_price < product.calculated_cost
                            ? 'bg-destructive/10 text-destructive border border-destructive/30'
                            : 'bg-success-muted text-success border border-success-muted'
                        )}>
                          <div className="font-medium">
                            {product.average_sale_price > 0 && product.average_sale_price < product.calculated_cost
                              ? '⚠️ Precio de venta por debajo del costo'
                              : product.average_sale_price > 0 
                                ? '✅ Precio de venta adecuado'
                                : 'ℹ️ Sin datos de ventas para comparar'
                            }
                          </div>
                          <div className="text-xs mt-1">
                            {product.average_sale_price > 0 && product.average_sale_price < product.calculated_cost
                              ? `El precio promedio de venta (${formatCurrency(product.average_sale_price)}) está por debajo del costo (${formatCurrency(product.calculated_cost)})`
                              : product.average_sale_price > 0 
                                ? `El precio promedio de venta (${formatCurrency(product.average_sale_price)}) cubre los costos con margen`
                                : 'No hay ventas registradas para este producto en el mes seleccionado'
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {productPrices.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay productos configurados</h3>
            <p className="text-muted-foreground">
              Configura productos y recetas para ver la lista de precios calculados
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
