'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  ChevronDown, 
  ChevronRight, 
  Package, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Info,
  BarChart3
} from 'lucide-react';
import { CostBreakdownChart } from './CostBreakdownChart';
import { cn } from '@/lib/utils';

interface ProductPrice {
  id: number;
  product_name: string;
  product_description: string;
  sku: string;
  current_price: number;
  current_cost: number;
  stock_quantity: number;
  category_name: string;
  category_id: number;
  recipe_id: number | null;
  recipe_name: string | null;
  output_quantity: number;
  output_unit_label: string;
  intermediate_quantity: number;
  intermediate_unit_label: string;
  units_per_item: number;
  calculated_cost: number;
  calculated_price: number;
  cost_breakdown: {
    materials: number;
    indirect_costs: number;
    employee_costs: number;
    total: number;
  };
  distribution_info?: {
    method: string;
    data_source: string;
    product_quantity: number;
    category_total_quantity: number;
    distribution_ratio: number;
    has_real_data: boolean;
    // Información específica para viguetas
    product_meters_sold?: number;
    category_total_meters?: number;
    product_length?: number;
  };
  recipe_details: any[];
  average_sale_price: number;
  production_info?: {
    source: string;
    quantity_produced: number;
    meters_produced?: number;
    production_month: string;
    production_date: string | null;
    distributed_indirect_costs: number;
    distributed_employee_costs: number;
    has_production_data: boolean;
    production_record_id?: number | null;
    real_production_record?: any;
    distribution_method?: string;
    product_length?: number;
    total_meters_produced?: number;
  };
}

interface ProductCostCardProps {
  product: ProductPrice;
  expanded?: boolean;
  onToggleExpand?: () => void;
  showProductionInfo?: boolean;
  simulationEscenarios?: any[];
  simulationEstadisticas?: any;
  isSimulationMode?: boolean;
}

export function ProductCostCard({ 
  product, 
  expanded = false, 
  onToggleExpand, 
  showProductionInfo = false,
  simulationEscenarios = [],
  simulationEstadisticas = null,
  isSimulationMode = false
}: ProductCostCardProps) {
  const [activeTab, setActiveTab] = useState('info');
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-AR').format(num);
  };

  const getStatusBadge = () => {
    if (product.calculated_cost === 0) {
      return <Badge className="bg-destructive/10 text-destructive">Sin costo</Badge>;
    }
    
    const margin = product.average_sale_price > 0 
      ? ((product.average_sale_price - product.calculated_cost) / product.average_sale_price) * 100 
      : 0;
    
    if (margin < 0) {
      return <Badge className="bg-destructive/10 text-destructive">Pérdida</Badge>;
    }
    if (margin < 10) {
      return <Badge className="bg-warning-muted text-warning-muted-foreground">Bajo margen</Badge>;
    }
    return <Badge className="bg-success-muted text-success">OK</Badge>;
  };

  const getMarginColor = (margin: number) => {
    if (margin < 0) return 'text-destructive';
    if (margin < 10) return 'text-warning-muted-foreground';
    return 'text-success';
  };

  const margin = product.average_sale_price > 0 
    ? ((product.average_sale_price - product.calculated_cost) / product.average_sale_price) * 100 
    : 0;

  // Verificar si debe mostrar la pestaña de variaciones de cuartos
  const isBloques = product.category_name?.toLowerCase().includes('bloque');
  const isViguetas = product.category_name?.toLowerCase().includes('vigueta');
  const showCuartosTab = isBloques && isSimulationMode && simulationEscenarios && simulationEscenarios.length > 0;
  const showBancosTab = isViguetas && isSimulationMode && simulationEscenarios && simulationEscenarios.length > 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader 
        className="cursor-pointer hover:bg-accent transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {onToggleExpand && (
              expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )
            )}
            <Package className="h-5 w-5 text-info-muted-foreground" />
            <div>
              <CardTitle className="text-lg">{product.product_name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {product.sku} • {product.category_name}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-lg font-bold">{formatCurrency(product.calculated_cost)}</div>
              <div className="text-sm text-muted-foreground">
                Costo calculado
                {product.average_sale_price > 0 && (
                  <span className={cn('ml-2 font-medium', getMarginColor(
                    ((product.average_sale_price - product.calculated_cost) / product.average_sale_price) * 100
                  ))}>
                    ({(((product.average_sale_price - product.calculated_cost) / product.average_sale_price) * 100).toFixed(1)}% ganancia)
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">{formatCurrency(product.average_sale_price)}</div>
              <div className="text-sm text-muted-foreground">Precio promedio de venta</div>
            </div>
            {getStatusBadge()}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="border-t bg-muted">
          {(showCuartosTab || showBancosTab) ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="info">Información</TabsTrigger>
                {showCuartosTab && (
                  <TabsTrigger value="cuartos" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Variaciones de Cuartos
                  </TabsTrigger>
                )}
                {showBancosTab && (
                  <TabsTrigger value="bancos" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Variaciones de Bancos
                  </TabsTrigger>
                )}
              </TabsList>
              
              <TabsContent value="info" className="mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Información general */}
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-3 flex items-center">
                  <Info className="h-4 w-4 mr-2" />
                  Información General
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Stock actual:</span>
                    <span className="font-medium">{formatNumber(product.stock_quantity)} unidades</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor del stock:</span>
                    <span className="font-medium">{formatCurrency(product.calculated_cost * product.stock_quantity)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Precio venta promedio:</span>
                    <span className="font-medium">{formatCurrency(product.average_sale_price)}</span>
                  </div>
                  {product.average_sale_price > 0 && (
                    <div className="flex justify-between">
                      <span>Margen de ganancia:</span>
                      <span className={cn('font-medium', getMarginColor(margin))}>
                        {margin.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Información de producción */}
              {showProductionInfo && product.production_info && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center">
                    <Package className="h-4 w-4 mr-2" />
                    Información de Producción
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Unidades producidas:</span>
                      <span className="font-medium text-info-muted-foreground">
                        {formatNumber(product.production_info.quantity_produced)} unidades
                      </span>
                    </div>
                    {product.production_info.meters_produced !== undefined && (
                      <div className="flex justify-between">
                        <span>Metros producidos:</span>
                        <span className="font-medium text-success">
                          {formatNumber(product.production_info.meters_produced)} metros
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Mes de producción:</span>
                      <span className="font-medium">{product.production_info.production_month}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Distribución de costos:</span>
                      <span className="font-medium">
                        {product.production_info.distribution_method === 'by_meters_produced' ? (
                          <Badge variant="secondary" className="bg-info-muted text-info-muted-foreground">
                            Por metros producidos
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-muted text-foreground">
                            Método estándar
                          </Badge>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fuente de datos:</span>
                      <span className="font-medium">
                        {product.production_info.has_production_data ? (
                          <Badge variant="secondary" className="bg-success-muted text-success">
                            Datos reales
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-muted text-foreground">
                            Sin producción
                          </Badge>
                        )}
                      </span>
                    </div>
                    {product.production_info.quantity_produced > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span>Costos indirectos distribuidos:</span>
                          <span className="font-medium">{formatCurrency(product.production_info.distributed_indirect_costs)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Costos empleados distribuidos:</span>
                          <span className="font-medium">{formatCurrency(product.production_info.distributed_employee_costs)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Información de receta */}
              <div>
                <h4 className="font-semibold mb-3">Información de Receta</h4>
                {product.recipe_details && product.recipe_details.length > 0 ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2 text-success">
                      <CheckCircle className="h-4 w-4" />
                      <span>Receta configurada</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ingredientes:</span>
                      <span className="font-medium">{product.recipe_details.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Costo materiales:</span>
                      <span className="font-medium">{formatCurrency(product.cost_breakdown.materials)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-warning-muted-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">Usando costo base del producto</span>
                  </div>
                )}
              </div>

              {/* Desglose de costos */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Desglose de Costos
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Materiales:</span>
                    <span className="font-medium">{formatCurrency(product.cost_breakdown.materials)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Costos indirectos:</span>
                    <span className="font-medium">{formatCurrency(product.cost_breakdown.indirect_costs)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Costos empleados:</span>
                    <span className="font-medium">{formatCurrency(product.cost_breakdown.employee_costs)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Total:</span>
                    <span>{formatCurrency(product.cost_breakdown.total)}</span>
                  </div>
                </div>
              </div>

              {/* Información de distribución */}
              {product.distribution_info && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Distribución de Costos
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Método:</span>
                      <span className="font-medium capitalize">{product.distribution_info.data_source === 'ventas' ? 'Ventas' : product.distribution_info.data_source === 'producción' ? 'Producción' : product.distribution_info.data_source}</span>
                    </div>
                    
                    {/* Información específica para viguetas */}
                    {product.distribution_info.product_meters_sold && (
                      <>
                        <div className="bg-info-muted p-3 rounded-lg space-y-2">
                          <div className="flex justify-between font-semibold text-info-muted-foreground">
                            <span>Metros vendidos - {product.product_name}:</span>
                            <span>{formatNumber(product.distribution_info.product_meters_sold)} metros</span>
                          </div>
                          <div className="flex justify-between text-info-muted-foreground">
                            <span>Total metros categoría ({product.category_name}):</span>
                            <span>{formatNumber(product.distribution_info.category_total_meters)} metros</span>
                          </div>
                          <div className="flex justify-between text-info-muted-foreground font-semibold border-t border-info-muted pt-2">
                            <span>Porcentaje del total:</span>
                            <span>{product.distribution_info.category_total_meters > 0 
                              ? ((product.distribution_info.product_meters_sold / product.distribution_info.category_total_meters) * 100).toFixed(2)
                              : '0.00'}%</span>
                          </div>
                          <div className="flex justify-between text-sm text-muted-foreground mt-1">
                            <span>Largo unitario:</span>
                            <span>{product.distribution_info.product_length}m por unidad</span>
                          </div>
                        </div>
                      </>
                    )}
                    
                    {/* Información normal para otros productos */}
                    {!product.distribution_info.product_meters_sold && (
                      <div className="bg-info-muted p-3 rounded-lg space-y-2">
                        <div className="flex justify-between font-semibold text-info-muted-foreground">
                          <span>Unidades {product.distribution_info.data_source === 'ventas' ? 'vendidas' : product.distribution_info.data_source === 'producción' ? 'producidas' : ''} - {product.product_name}:</span>
                          <span>{formatNumber(product.distribution_info.product_quantity)} unidades</span>
                        </div>
                        <div className="flex justify-between text-info-muted-foreground">
                          <span>Total categoría ({product.category_name}):</span>
                          <span>{formatNumber(product.distribution_info.category_total_quantity)} unidades</span>
                        </div>
                        <div className="flex justify-between text-info-muted-foreground font-semibold border-t border-info-muted pt-2">
                          <span>Porcentaje del total:</span>
                          <span>{product.distribution_info.percentage_of_category ? product.distribution_info.percentage_of_category.toFixed(2) : (product.distribution_info.distribution_ratio * 100).toFixed(2)}%</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex justify-between pt-2 border-t">
                      <span>Datos:</span>
                      <span className={cn('font-medium', product.distribution_info.has_real_data ? 'text-success' : 'text-warning-muted-foreground')}>
                        {product.distribution_info.has_real_data ? 'Reales' : 'Estimados'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Gráfico de costos */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center">
                <TrendingUp className="h-4 w-4 mr-2" />
                Distribución de Costos
              </h4>
              <CostBreakdownChart data={product.cost_breakdown} />
            </div>
          </div>

          {/* Ingredientes de receta */}
          {product.recipe_details && product.recipe_details.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold mb-3">Ingredientes de Receta</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border rounded-lg">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 border-b">Insumo</th>
                      <th className="text-right p-3 border-b">Cantidad</th>
                      <th className="text-right p-3 border-b">Unidad</th>
                      <th className="text-right p-3 border-b">Precio Unitario</th>
                      <th className="text-right p-3 border-b">Costo Total</th>
                      <th className="text-right p-3 border-b">% del Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.recipe_details.map((ingredient, index) => {
                      const percentage = product.cost_breakdown.materials > 0 
                        ? (ingredient.total_cost / product.cost_breakdown.materials) * 100 
                        : 0;
                      
                      return (
                        <tr key={index} className="border-b hover:bg-accent">
                          <td className="p-3 font-medium">{ingredient.supply_name}</td>
                          <td className="text-right p-3">{formatNumber(ingredient.quantity)}</td>
                          <td className="text-right p-3">{ingredient.unit_measure}</td>
                          <td className="text-right p-3">{formatCurrency(ingredient.unit_price)}</td>
                          <td className="text-right p-3 font-medium">{formatCurrency(ingredient.total_cost)}</td>
                          <td className="text-right p-3 text-muted-foreground">{percentage.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
              </TabsContent>
              
              <TabsContent value="cuartos" className="mt-0">
                <div className="space-y-4">
                  {simulationEstadisticas && (() => {
                    const baseProduct = simulationEscenarios.find((e: any) => e.variacionCuartos === 0);
                    const baseProductInScenario = baseProduct?.resultado?.productPrices?.find((p: any) => p.id === product.id);
                    const baseQty = baseProductInScenario?.distribution_info?.product_quantity || baseProductInScenario?.production_info?.quantity_produced || product.distribution_info?.product_quantity || 0;
                    const baseCostPerUnit = baseProductInScenario?.calculated_cost || product.calculated_cost || 0;
                    
                    return (
                      <div className="mb-5 p-4 bg-gradient-to-r from-info-muted to-info-muted rounded-xl border-2 border-info-muted shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">Placas actuales:</span>
                              <span className="font-bold text-lg text-info-muted-foreground">
                                {simulationEstadisticas.placasActuales?.toLocaleString('es-AR') || '0'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">({simulationEstadisticas.cuartosActuales?.toFixed(2) || '0'} cuartos)</span>
                              <span className="text-xs text-muted-foreground bg-card/60 px-2 py-1 rounded">1 cuarto = 240 placas</span>
                            </div>
                          </div>
                          {baseQty > 0 && baseCostPerUnit > 0 && (
                            <div className="pt-2 md:pt-0 md:pl-4 md:border-l-2 border-info-muted">
                              <div className="text-xs font-medium text-muted-foreground mb-1">Costo actual por placa</div>
                              <div className="text-xl font-bold text-info-muted-foreground">
                                {formatCurrency(baseCostPerUnit)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {simulationEscenarios
                      .filter((escenario: any) => escenario.variacionCuartos !== 0)
                      .map((escenario: any, index: number) => {
                        // Buscar el producto específico en este escenario
                        const productInScenario = escenario.resultado?.productPrices?.find((p: any) => p.id === product.id);
                        const qtyInScenario = productInScenario?.distribution_info?.product_quantity || productInScenario?.production_info?.quantity_produced || 0;
                        
                        // Calcular costo total usando cost_breakdown (materials + indirect_costs + employee_costs)
                        const costBreakdown = productInScenario?.cost_breakdown || product.cost_breakdown;
                        const costPerUnitInScenario = costBreakdown?.total || productInScenario?.calculated_cost || product.calculated_cost || 0;
                        const totalCostos = costPerUnitInScenario * qtyInScenario;
                        
                        // Calcular costo actual para comparar (basado en la simulación actual/base)
                        const baseProduct = simulationEscenarios.find((e: any) => e.variacionCuartos === 0);
                        const baseProductInScenario = baseProduct?.resultado?.productPrices?.find((p: any) => p.id === product.id);
                        const baseQty = baseProductInScenario?.distribution_info?.product_quantity || baseProductInScenario?.production_info?.quantity_produced || product.distribution_info?.product_quantity || 0;
                        
                        // Calcular costo base usando cost_breakdown
                        const baseCostBreakdown = baseProductInScenario?.cost_breakdown || product.cost_breakdown;
                        const baseCostPerUnit = baseCostBreakdown?.total || baseProductInScenario?.calculated_cost || product.calculated_cost || 0;
                        const costoActual = baseCostPerUnit * baseQty;
                        
                        const diferencia = totalCostos - costoActual;
                        const porcentajeCambio = costoActual > 0 ? (diferencia / costoActual) * 100 : 0;
                        
                        // Calcular diferencia en costo por placa
                        const diferenciaCostoPorPlaca = baseCostPerUnit > 0 
                          ? costPerUnitInScenario - baseCostPerUnit 
                          : 0;
                        const porcentajeCambioPorPlaca = baseCostPerUnit > 0 
                          ? (diferenciaCostoPorPlaca / baseCostPerUnit) * 100 
                          : 0;
                        const esMejor = costPerUnitInScenario < baseCostPerUnit;
                        
                        return (
                          <div
                            key={index}
                            className={cn('p-4 rounded-xl border-2 shadow-sm transition-all hover:shadow-md',
                              escenario.variacionCuartos < 0
                                ? 'bg-gradient-to-br from-info-muted to-info-muted border-info-muted'
                                : 'bg-gradient-to-br from-warning-muted to-warning-muted border-warning-muted'
                            )}
                          >
                            <div className="mb-3 pb-2 border-b border-border">
                              <span className={cn('font-bold text-base',
                                escenario.variacionCuartos < 0
                                  ? 'text-info-muted-foreground'
                                  : 'text-warning-muted-foreground'
                              )}>
                                {escenario.nombre}
                              </span>
                            </div>
                            
                            <div className="space-y-2.5 text-sm">
                              {/* Información de producción */}
                              <div className="flex items-center justify-between py-1.5 px-2 bg-card/60 rounded-md">
                                <span className="font-medium text-muted-foreground">Placas:</span>
                                <span className="font-semibold text-foreground">
                                  {escenario.placas?.toLocaleString('es-AR') || '0'}
                                </span>
                              </div>
                              
                              <div className="flex items-center justify-between py-1.5 px-2 bg-card/60 rounded-md">
                                <span className="font-medium text-muted-foreground">Cuartos:</span>
                                <span className="font-semibold text-foreground">
                                  {escenario.cuartos?.toFixed(2) || '0'}
                                </span>
                              </div>
                              
                              {/* Costo Total */}
                              <div className="pt-2 mt-2 border-t-2 border-border">
                                <div className="mb-1">
                                  <span className="text-xs font-medium text-muted-foreground">Costo Total</span>
                                </div>
                                <div className="text-base font-bold text-foreground mb-1">
                                  {formatCurrency(totalCostos)}
                                </div>
                                {costoActual > 0 && (
                                  <div className={cn('text-xs font-semibold flex items-center gap-1',
                                    diferencia < 0 ? 'text-success' : diferencia > 0 ? 'text-destructive' : 'text-muted-foreground'
                                  )}>
                                    <span>{diferencia < 0 ? '↓' : diferencia > 0 ? '↑' : '→'}</span>
                                    <span>{Math.abs(porcentajeCambio).toFixed(1)}%</span>
                                    <span className="text-muted-foreground">
                                      ({diferencia < 0 ? '-' : '+'}{formatCurrency(Math.abs(diferencia))})
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Costo por placa */}
                              {qtyInScenario > 0 && baseCostPerUnit > 0 && (
                                <div className="pt-2 mt-2 border-t-2 border-border">
                                  <div className="mb-1">
                                    <span className="text-xs font-medium text-muted-foreground">Costo por placa</span>
                                  </div>
                                  <div className="text-base font-bold text-foreground mb-1">
                                    {formatCurrency(costPerUnitInScenario)}
                                  </div>
                                  <div className={cn('text-xs font-semibold flex flex-col gap-0.5',
                                    esMejor
                                      ? 'text-success'
                                      : diferenciaCostoPorPlaca > 0
                                      ? 'text-destructive'
                                      : 'text-muted-foreground'
                                  )}>
                                    <div className="flex items-center gap-1">
                                      <span>{esMejor ? '↓' : diferenciaCostoPorPlaca > 0 ? '↑' : '→'}</span>
                                      <span>
                                        {esMejor ? 'Ahorro' : diferenciaCostoPorPlaca > 0 ? 'Más caro' : 'Igual'}
                                      </span>
                                      <span className="font-bold">
                                        {Math.abs(porcentajeCambioPorPlaca).toFixed(2)}%
                                      </span>
                                    </div>
                                    <div className="text-muted-foreground pl-4">
                                      {formatCurrency(Math.abs(diferenciaCostoPorPlaca))} por placa
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </TabsContent>
              
              {showBancosTab && (
                <TabsContent value="bancos" className="mt-0">
                  <div className="space-y-4">
                    {simulationEstadisticas && (() => {
                      const baseProduct = simulationEscenarios.find((e: any) => e.variacionBancos === 0 || e.variacionBancos === undefined);
                      const baseProductInScenario = baseProduct?.resultado?.productPrices?.find((p: any) => p.id === product.id);
                      const baseQty = baseProductInScenario?.distribution_info?.product_quantity || baseProductInScenario?.production_info?.quantity_produced || product.distribution_info?.product_quantity || 0;
                      const baseCostPerUnit = baseProductInScenario?.calculated_cost || product.calculated_cost || 0;
                      
                      return (
                        <div className="mb-5 p-4 bg-gradient-to-r from-success-muted to-success-muted rounded-xl border-2 border-success-muted shadow-sm">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">Bancos actuales:</span>
                                <span className="font-bold text-lg text-success">
                                  {simulationEstadisticas.bancosActuales?.toLocaleString('es-AR') || '0'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">({simulationEstadisticas.metrosActuales?.toFixed(2) || '0'} metros)</span>
                                <span className="text-xs text-muted-foreground bg-card/60 px-2 py-1 rounded">1 banco = 1300 m útiles</span>
                              </div>
                            </div>
                            {baseQty > 0 && baseCostPerUnit > 0 && (
                              <div className="pt-2 md:pt-0 md:pl-4 md:border-l-2 border-success-muted">
                                <div className="text-xs font-medium text-muted-foreground mb-1">Costo actual por unidad</div>
                                <div className="text-xl font-bold text-success">
                                  {formatCurrency(baseCostPerUnit)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {simulationEscenarios
                        .filter((escenario: any) => escenario.variacionBancos !== undefined && escenario.variacionBancos !== 0)
                        .map((escenario: any, index: number) => {
                          // Buscar el producto específico en este escenario
                          const productInScenario = escenario.resultado?.productPrices?.find((p: any) => p.id === product.id);
                          const qtyInScenario = productInScenario?.distribution_info?.product_quantity || productInScenario?.production_info?.quantity_produced || 0;
                          
                          // Calcular costo total usando cost_breakdown (materials + indirect_costs + employee_costs)
                          const costBreakdown = productInScenario?.cost_breakdown || product.cost_breakdown;
                          const costPerUnitInScenario = costBreakdown?.total || productInScenario?.calculated_cost || product.calculated_cost || 0;
                          const totalCostos = costPerUnitInScenario * qtyInScenario;
                          
                          // Calcular costo actual para comparar (basado en la simulación actual/base)
                          const baseProduct = simulationEscenarios.find((e: any) => e.variacionBancos === 0 || e.variacionBancos === undefined);
                          const baseProductInScenario = baseProduct?.resultado?.productPrices?.find((p: any) => p.id === product.id);
                          const baseQty = baseProductInScenario?.distribution_info?.product_quantity || baseProductInScenario?.production_info?.quantity_produced || product.distribution_info?.product_quantity || 0;
                          
                          // Calcular costo base usando cost_breakdown
                          const baseCostBreakdown = baseProductInScenario?.cost_breakdown || product.cost_breakdown;
                          const baseCostPerUnit = baseCostBreakdown?.total || baseProductInScenario?.calculated_cost || product.calculated_cost || 0;
                          const costoActual = baseCostPerUnit * baseQty;
                          
                          const diferencia = totalCostos - costoActual;
                          const porcentajeCambio = costoActual > 0 ? (diferencia / costoActual) * 100 : 0;
                          
                          // Calcular diferencia en costo por unidad
                          const diferenciaCostoPorUnidad = baseCostPerUnit > 0 
                            ? costPerUnitInScenario - baseCostPerUnit 
                            : 0;
                          const porcentajeCambioPorUnidad = baseCostPerUnit > 0 
                            ? (diferenciaCostoPorUnidad / baseCostPerUnit) * 100 
                            : 0;
                          const esMejor = costPerUnitInScenario < baseCostPerUnit;
                          
                          return (
                            <div
                              key={index}
                              className={cn('p-4 rounded-xl border-2 shadow-sm transition-all hover:shadow-md',
                                escenario.variacionBancos < 0
                                  ? 'bg-gradient-to-br from-success-muted to-success-muted border-success-muted'
                                  : 'bg-gradient-to-br from-info-muted to-info-muted border-info-muted'
                              )}
                            >
                              <div className="mb-3 pb-2 border-b border-border">
                                <span className={cn('font-bold text-base',
                                  escenario.variacionBancos < 0
                                    ? 'text-success'
                                    : 'text-info-muted-foreground'
                                )}>
                                  {escenario.nombre}
                                </span>
                              </div>
                              
                              <div className="space-y-2.5 text-sm">
                                {/* Información de producción */}
                                <div className="flex items-center justify-between py-1.5 px-2 bg-card/60 rounded-md">
                                  <span className="font-medium text-muted-foreground">Bancos:</span>
                                  <span className="font-semibold text-foreground">
                                    {escenario.bancos?.toLocaleString('es-AR') || '0'}
                                  </span>
                                </div>
                                
                                <div className="flex items-center justify-between py-1.5 px-2 bg-card/60 rounded-md">
                                  <span className="font-medium text-muted-foreground">Metros:</span>
                                  <span className="font-semibold text-foreground">
                                    {escenario.metros?.toFixed(2) || '0'}
                                  </span>
                                </div>
                                
                                {/* Costo Total */}
                                <div className="pt-2 mt-2 border-t-2 border-border">
                                  <div className="mb-1">
                                    <span className="text-xs font-medium text-muted-foreground">Costo Total</span>
                                  </div>
                                  <div className="text-base font-bold text-foreground mb-1">
                                    {formatCurrency(totalCostos)}
                                  </div>
                                  {costoActual > 0 && (
                                    <div className={cn('text-xs font-semibold flex items-center gap-1',
                                      diferencia < 0 ? 'text-success' : diferencia > 0 ? 'text-destructive' : 'text-muted-foreground'
                                    )}>
                                      <span>{diferencia < 0 ? '↓' : diferencia > 0 ? '↑' : '→'}</span>
                                      <span>{Math.abs(porcentajeCambio).toFixed(1)}%</span>
                                      <span className="text-muted-foreground">
                                        ({diferencia < 0 ? '-' : '+'}{formatCurrency(Math.abs(diferencia))})
                                      </span>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Costo por unidad */}
                                {qtyInScenario > 0 && baseCostPerUnit > 0 && (
                                  <div className="pt-2 mt-2 border-t-2 border-border">
                                    <div className="mb-1">
                                      <span className="text-xs font-medium text-muted-foreground">Costo por unidad</span>
                                    </div>
                                    <div className="text-base font-bold text-foreground mb-1">
                                      {formatCurrency(costPerUnitInScenario)}
                                    </div>
                                    <div className={cn('text-xs font-semibold flex flex-col gap-0.5',
                                      esMejor
                                        ? 'text-success'
                                        : diferenciaCostoPorUnidad > 0
                                        ? 'text-destructive'
                                        : 'text-muted-foreground'
                                    )}>
                                      <div className="flex items-center gap-1">
                                        <span>{esMejor ? '↓' : diferenciaCostoPorUnidad > 0 ? '↑' : '→'}</span>
                                        <span>
                                          {esMejor ? 'Ahorro' : diferenciaCostoPorUnidad > 0 ? 'Más caro' : 'Igual'}
                                        </span>
                                        <span className="font-bold">
                                          {Math.abs(porcentajeCambioPorUnidad).toFixed(2)}%
                                        </span>
                                      </div>
                                      <div className="text-muted-foreground pl-4">
                                        {formatCurrency(Math.abs(diferenciaCostoPorUnidad))} por unidad
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Información general */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center">
                      <Info className="h-4 w-4 mr-2" />
                      Información General
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Stock actual:</span>
                        <span className="font-medium">{formatNumber(product.stock_quantity)} unidades</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Valor del stock:</span>
                        <span className="font-medium">{formatCurrency(product.calculated_cost * product.stock_quantity)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Precio venta promedio:</span>
                        <span className="font-medium">{formatCurrency(product.average_sale_price)}</span>
                      </div>
                      {product.average_sale_price > 0 && (
                        <div className="flex justify-between">
                          <span>Margen de ganancia:</span>
                          <span className={cn('font-medium', getMarginColor(margin))}>
                            {margin.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Información de producción */}
                  {showProductionInfo && product.production_info && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center">
                        <Package className="h-4 w-4 mr-2" />
                        Información de Producción
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Unidades producidas:</span>
                          <span className="font-medium text-info-muted-foreground">
                            {formatNumber(product.production_info.quantity_produced)} unidades
                          </span>
                        </div>
                        {product.production_info.meters_produced !== undefined && (
                          <div className="flex justify-between">
                            <span>Metros producidos:</span>
                            <span className="font-medium text-success">
                              {formatNumber(product.production_info.meters_produced)} metros
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Mes de producción:</span>
                          <span className="font-medium">{product.production_info.production_month}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Distribución de costos:</span>
                          <span className="font-medium">
                            {product.production_info.distribution_method === 'by_meters_produced' ? (
                              <Badge variant="secondary" className="bg-info-muted text-info-muted-foreground">
                                Por metros producidos
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-muted text-foreground">
                                Método estándar
                              </Badge>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Fuente de datos:</span>
                          <span className="font-medium">
                            {product.production_info.has_production_data ? (
                              <Badge variant="secondary" className="bg-success-muted text-success">
                                Datos reales
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-muted text-foreground">
                                Sin producción
                              </Badge>
                            )}
                          </span>
                        </div>
                        {product.production_info.quantity_produced > 0 && (
                          <>
                            <div className="flex justify-between">
                              <span>Costos indirectos distribuidos:</span>
                              <span className="font-medium">{formatCurrency(product.production_info.distributed_indirect_costs)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Costos empleados distribuidos:</span>
                              <span className="font-medium">{formatCurrency(product.production_info.distributed_employee_costs)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Información de receta */}
                  <div>
                    <h4 className="font-semibold mb-3">Información de Receta</h4>
                    {product.recipe_details && product.recipe_details.length > 0 ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center space-x-2 text-success">
                          <CheckCircle className="h-4 w-4" />
                          <span>Receta configurada</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Ingredientes:</span>
                          <span className="font-medium">{product.recipe_details.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Costo materiales:</span>
                          <span className="font-medium">{formatCurrency(product.cost_breakdown.materials)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 text-warning-muted-foreground">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm">Usando costo base del producto</span>
                      </div>
                    )}
                  </div>

                  {/* Desglose de costos */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center">
                      <DollarSign className="h-4 w-4 mr-2" />
                      Desglose de Costos
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Materiales:</span>
                        <span className="font-medium">{formatCurrency(product.cost_breakdown.materials)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Costos indirectos:</span>
                        <span className="font-medium">{formatCurrency(product.cost_breakdown.indirect_costs)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Costos empleados:</span>
                        <span className="font-medium">{formatCurrency(product.cost_breakdown.employee_costs)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 font-semibold">
                        <span>Total:</span>
                        <span>{formatCurrency(product.cost_breakdown.total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Información de distribución */}
                  {product.distribution_info && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Distribución de Costos
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Método:</span>
                          <span className="font-medium capitalize">{product.distribution_info.data_source === 'ventas' ? 'Ventas' : product.distribution_info.data_source === 'producción' ? 'Producción' : product.distribution_info.data_source}</span>
                        </div>
                        
                        {/* Información específica para viguetas */}
                        {product.distribution_info.product_meters_sold && (
                          <>
                            <div className="bg-info-muted p-3 rounded-lg space-y-2">
                              <div className="flex justify-between font-semibold text-info-muted-foreground">
                                <span>Metros vendidos - {product.product_name}:</span>
                                <span>{formatNumber(product.distribution_info.product_meters_sold)} metros</span>
                              </div>
                              <div className="flex justify-between text-info-muted-foreground">
                                <span>Total metros categoría ({product.category_name}):</span>
                                <span>{formatNumber(product.distribution_info.category_total_meters)} metros</span>
                              </div>
                              <div className="flex justify-between text-info-muted-foreground font-semibold border-t border-info-muted pt-2">
                                <span>Porcentaje del total:</span>
                                <span>{product.distribution_info.category_total_meters > 0 
                                  ? ((product.distribution_info.product_meters_sold / product.distribution_info.category_total_meters) * 100).toFixed(2)
                                  : '0.00'}%</span>
                              </div>
                              <div className="flex justify-between text-sm text-muted-foreground mt-1">
                                <span>Largo unitario:</span>
                                <span>{product.distribution_info.product_length}m por unidad</span>
                              </div>
                            </div>
                          </>
                        )}
                        
                        {/* Información normal para otros productos */}
                        {!product.distribution_info.product_meters_sold && (
                          <div className="bg-info-muted p-3 rounded-lg space-y-2">
                            <div className="flex justify-between font-semibold text-info-muted-foreground">
                              <span>Unidades {product.distribution_info.data_source === 'ventas' ? 'vendidas' : product.distribution_info.data_source === 'producción' ? 'producidas' : ''} - {product.product_name}:</span>
                              <span>{formatNumber(product.distribution_info.product_quantity)} unidades</span>
                            </div>
                            <div className="flex justify-between text-info-muted-foreground">
                              <span>Total categoría ({product.category_name}):</span>
                              <span>{formatNumber(product.distribution_info.category_total_quantity)} unidades</span>
                            </div>
                            <div className="flex justify-between text-info-muted-foreground font-semibold border-t border-info-muted pt-2">
                              <span>Porcentaje del total:</span>
                              <span>{product.distribution_info.percentage_of_category ? product.distribution_info.percentage_of_category.toFixed(2) : (product.distribution_info.distribution_ratio * 100).toFixed(2)}%</span>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex justify-between pt-2 border-t">
                          <span>Datos:</span>
                          <span className={cn('font-medium', product.distribution_info.has_real_data ? 'text-success' : 'text-warning-muted-foreground')}>
                            {product.distribution_info.has_real_data ? 'Reales' : 'Estimados'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Gráfico de costos */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Distribución de Costos
                  </h4>
                  <CostBreakdownChart data={product.cost_breakdown} />
                </div>
              </div>

              {/* Ingredientes de receta */}
              {product.recipe_details && product.recipe_details.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-3">Ingredientes de Receta</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border rounded-lg">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-3 border-b">Insumo</th>
                          <th className="text-right p-3 border-b">Cantidad</th>
                          <th className="text-right p-3 border-b">Unidad</th>
                          <th className="text-right p-3 border-b">Precio Unitario</th>
                          <th className="text-right p-3 border-b">Costo Total</th>
                          <th className="text-right p-3 border-b">% del Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.recipe_details.map((ingredient, index) => {
                          const percentage = product.cost_breakdown.materials > 0 
                            ? (ingredient.total_cost / product.cost_breakdown.materials) * 100 
                            : 0;
                          
                          return (
                            <tr key={index} className="border-b hover:bg-accent">
                              <td className="p-3 font-medium">{ingredient.supply_name}</td>
                              <td className="text-right p-3">{formatNumber(ingredient.quantity)}</td>
                              <td className="text-right p-3">{ingredient.unit_measure}</td>
                              <td className="text-right p-3">{formatCurrency(ingredient.unit_price)}</td>
                              <td className="text-right p-3 font-medium">{formatCurrency(ingredient.total_cost)}</td>
                              <td className="text-right p-3 text-muted-foreground">{percentage.toFixed(1)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}