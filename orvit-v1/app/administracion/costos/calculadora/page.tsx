'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatNumber } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/contexts/CompanyContext';
import { ProductCostCard } from '@/components/costos/ProductCostCard';
import { ExportButton } from '@/components/costos/ExportButton';
import { useCalculadoraCostosFinal } from '@/hooks/use-dashboard-data';
import {
    Calculator,
    TrendingUp,
    Package,
    DollarSign,
    AlertTriangle,
    RefreshCw,
    CheckCircle,
    Info,
    Play,
    BarChart3,
    FileText
} from 'lucide-react';
import { formatCurrency } from '@/components/dashboard';

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
    base_type: string;
    calculated_cost: number;
    calculated_price: number;
    units_per_item: number;
    cost_breakdown: {
        materials: number;
        indirect_costs: number;
        employee_costs: number;
        total: number;
    };
    recipe_details: any[];
    average_sale_price: number;
    distribution_info?: {
        method: string;
        data_source: string;
        product_quantity: number;
        category_total_quantity: number;
        distribution_ratio: number;
        has_real_data: boolean;
        product_meters_sold?: number;
        category_total_meters?: number;
        product_length?: number;
    };
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

export default function CalculadoraCostosPage() {
    const { currentCompany } = useCompany();
    const [activeTab, setActiveTab] = useState('calculadora');

    // Estados principales
    const [selectedMonth, setSelectedMonth] = useState('2025-08');
    const [availableMonths, setAvailableMonths] = useState<string[]>([]);
    const [loadingMonths, setLoadingMonths] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());

    // ✨ OPTIMIZADO: Usar React Query hooks en lugar de fetch directo
    // Esto elimina requests duplicados y cachea automáticamente
    const salesQuery = useCalculadoraCostosFinal(
        currentCompany?.id,
        selectedMonth,
        'sales',
        activeTab === 'calculadora' && !!currentCompany && !!selectedMonth
    );

    const productionQuery = useCalculadoraCostosFinal(
        currentCompany?.id,
        selectedMonth,
        'production',
        activeTab === 'produccion' && !!currentCompany && !!selectedMonth
    );

    // Extraer datos de las queries
    const productPrices: ProductPrice[] = salesQuery.data?.productPrices || [];
    const productionPrices: ProductPrice[] = productionQuery.data?.productPrices || [];
    const loading = salesQuery.isLoading || productionQuery.isLoading;

    useEffect(() => {
        if (!currentCompany) return;

        const generateFallbackMonths = () => {
            const fallback: string[] = [];
            const now = new Date();
            for (let i = 0; i < 12; i++) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                fallback.push(date.toISOString().slice(0, 7));
            }
            return fallback;
        };

        const fetchAvailableMonths = async () => {
            setLoadingMonths(true);
            try {
                const response = await fetch(`/api/dashboard/available-months?companyId=${currentCompany.id}`);
                if (response.ok) {
                    const months = await response.json();
                    if (Array.isArray(months) && months.length > 0) {
                        setAvailableMonths(months);
                        setSelectedMonth(prev => {
                            if (prev && months.includes(prev)) {
                                return prev;
                            }
                            return months[0];
                        });
                        return;
                    }
                }
                const fallbackMonths = generateFallbackMonths();
                setAvailableMonths(fallbackMonths);
                setSelectedMonth(prev => {
                    if (prev && fallbackMonths.includes(prev)) {
                        return prev;
                    }
                    return fallbackMonths[0];
                });
            } catch (error) {
                console.error('Error fetching available months:', error);
                const fallbackMonths = generateFallbackMonths();
                setAvailableMonths(fallbackMonths);
                setSelectedMonth(prev => {
                    if (prev && fallbackMonths.includes(prev)) {
                        return prev;
                    }
                    return fallbackMonths[0];
                });
            } finally {
                setLoadingMonths(false);
            }
        };

        fetchAvailableMonths();
    }, [currentCompany]);

    // Funciones auxiliares

    const formatMonthLabel = (month: string) => {
        const [year, monthPart] = month.split('-');
        const date = new Date(parseInt(year), parseInt(monthPart) - 1, 1);
        const monthName = date.toLocaleString('es-AR', { month: 'long' });
        const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        return `${capitalized} ${year}`;
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


    // Obtener datos según la pestaña activa
    const currentData = activeTab === 'produccion' ? productionPrices : productPrices;

    // Obtener categorías únicas
    const categories = Array.from(new Set(currentData.map(p => p.category_name))).sort();

    // Filtrar productos
    const filteredProducts = selectedCategory === 'all'
        ? currentData
        : currentData.filter(p => p.category_name === selectedCategory);

    // Estadísticas
    const stats = {
        totalProducts: currentData.length,
        productsWithRecipe: currentData.filter(p => p.recipe_id !== null).length,
        productsWithoutRecipe: currentData.filter(p => p.recipe_id === null).length,
        productsWithZeroCost: currentData.filter(p => p.calculated_cost === 0).length,
        averageCost: currentData.length > 0
            ? currentData.reduce((sum, p) => sum + p.calculated_cost, 0) / currentData.length
            : 0,
        totalValue: currentData.reduce((sum, p) => sum + (p.calculated_cost * p.stock_quantity), 0),
        // Estadísticas específicas para producción
        productsWithProduction: activeTab === 'produccion'
            ? currentData.filter(p => p.production_info && p.production_info.quantity_produced > 0).length
            : 0,
        totalProduction: activeTab === 'produccion'
            ? currentData.reduce((sum, p) => sum + (p.production_info?.quantity_produced || 0), 0)
            : 0
    };

    if (!currentCompany) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">Selecciona una empresa</h2>
                    <p className="text-muted-foreground">Necesitas seleccionar una empresa para acceder a la calculadora de costos.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="m-3 rounded-2xl surface-card dashboard-surface px-6 md:px-8 py-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-1 md:pb-4 border-b border-border gap-1 md:gap-3">
                <div>
                    <h1 className="text-base md:text-2xl font-bold">Calculadora de Costos</h1>
                    <p className="text-xs md:text-sm mt-0.5 md:mt-1 text-muted-foreground">
                        Calcula precios basados en costos de materiales, empleados e indirectos
                    </p>
                </div>
                <div className="flex items-center gap-1 md:gap-4">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="month-select" className="text-xs md:text-sm font-medium">Mes de cálculo</Label>
                        <Select
                            value={selectedMonth}
                            onValueChange={setSelectedMonth}
                            disabled={loadingMonths || availableMonths.length === 0}
                        >
                            <SelectTrigger className="w-32 md:w-40 text-xs md:text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {availableMonths.map((month) => (
                                    <SelectItem key={month} value={month}>
                                        {formatMonthLabel(month)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1 md:gap-6">
                <div className="surface-card p-3 md:p-6 rounded-lg md:rounded-xl hover:shadow-lg transition-all duration-200 border border-border/30">
                    <div className="text-xs md:text-sm mb-1 md:mb-2 text-muted-foreground">Total Productos</div>
                    <div className="text-lg md:text-3xl font-bold mb-1 md:mb-2 text-foreground">{stats.totalProducts}</div>
                    <div className="flex items-center text-info-muted-foreground text-xs md:text-sm">
                        <Package className="h-2.5 w-2.5 md:h-4 md:w-4 mr-1" />
                        {stats.productsWithRecipe} con receta
                    </div>
                </div>

                <div className="surface-card p-3 md:p-6 rounded-lg md:rounded-xl hover:shadow-lg transition-all duration-200 border border-border/30">
                    <div className="text-xs md:text-sm mb-1 md:mb-2 text-muted-foreground">
                        {activeTab === 'produccion' ? 'Con Producción' : 'Sin Receta'}
                    </div>
                    <div className="text-base md:text-2xl font-bold mb-1 md:mb-2 text-foreground">
                        {activeTab === 'produccion' ? stats.productsWithProduction : stats.productsWithoutRecipe}
                    </div>
                    <div className="flex items-center text-success text-xs md:text-sm">
                        {activeTab === 'produccion' ? (
                            <CheckCircle className="h-2.5 w-2.5 md:h-4 md:w-4 mr-1" />
                        ) : (
                            <AlertTriangle className="h-2.5 w-2.5 md:h-4 md:w-4 mr-1" />
                        )}
                        {activeTab === 'produccion' ? 'Productos producidos' : 'Requieren configuración'}
                    </div>
                </div>

                <div className="surface-card p-3 md:p-6 rounded-lg md:rounded-xl hover:shadow-lg transition-all duration-200 border border-border/30">
                    <div className="text-xs md:text-sm mb-1 md:mb-2 text-muted-foreground">Costo Promedio</div>
                    <div className="text-base md:text-2xl font-bold mb-1 md:mb-2 text-foreground">{formatCurrency(stats.averageCost)}</div>
                    <div className="flex items-center text-info-muted-foreground text-xs md:text-sm">
                        <TrendingUp className="h-2.5 w-2.5 md:h-4 md:w-4 mr-1" />
                        Por producto
                    </div>
                </div>

                <div className="surface-card p-3 md:p-6 rounded-lg md:rounded-xl hover:shadow-lg transition-all duration-200 border border-border/30">
                    <div className="text-xs md:text-sm mb-1 md:mb-2 text-muted-foreground">
                        {activeTab === 'produccion' ? 'Total Producido' : 'Valor Total'}
                    </div>
                    <div className="text-base md:text-2xl font-bold mb-1 md:mb-2 text-purple-500">
                        {activeTab === 'produccion'
                            ? formatNumber(stats.totalProduction)
                            : formatCurrency(stats.totalValue)
                        }
                    </div>
                    <div className="flex items-center text-purple-500 text-xs md:text-sm">
                        {activeTab === 'produccion' ? (
                            <Package className="h-2.5 w-2.5 md:h-4 md:w-4 mr-1" />
                        ) : (
                            <DollarSign className="h-2.5 w-2.5 md:h-4 md:w-4 mr-1" />
                        )}
                        {activeTab === 'produccion' ? 'Unidades producidas' : 'Inventario valorizado'}
                    </div>
                </div>
            </div>

            {/* Tabs principales */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="w-full justify-start overflow-x-auto">
                    <TabsTrigger value="calculadora">Por Ventas</TabsTrigger>
                    <TabsTrigger value="produccion">Por Producción</TabsTrigger>
                    <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
                    <TabsTrigger value="reportes">Reportes</TabsTrigger>
                </TabsList>

                {/* Tab Por Ventas */}
                <TabsContent value="calculadora" className="space-y-4">
                    {/* Filtros */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Calculator className="h-5 w-5" />
                                Calculadora de Costos por Ventas
                            </CardTitle>
                            <CardDescription>
                                Costos calculados basándose en las unidades vendidas
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <Label htmlFor="category-filter">Categoría</Label>
                                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Todas las categorías" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas las categorías</SelectItem>
                                            {categories.map((category) => (
                                                <SelectItem key={category} value={category}>
                                                    {category}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-end gap-2">
                                    <ExportButton
                                        data={filteredProducts}
                                        filename={`costos-ventas-${selectedMonth}`}
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={loadProductPrices}
                                        disabled={loading}
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Actualizar
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Lista de productos */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Productos y Costos por Ventas</CardTitle>
                            <CardDescription>
                                {filteredProducts.length} productos encontrados - Costos distribuidos según ventas reales
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            ) : filteredProducts.length === 0 ? (
                                <div className="text-center py-8">
                                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold mb-2">No hay productos</h3>
                                    <p className="text-muted-foreground mb-4">
                                        No se encontraron productos para los filtros seleccionados.
                                    </p>
                                    <Button variant="outline" onClick={loadProductPrices}>
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Recargar datos
                                    </Button>
                                </div>
                            ) : (
                                <div className="max-h-[600px] overflow-y-auto space-y-4 pr-2">
                                    {filteredProducts.map((product) => (
                                        <ProductCostCard
                                            key={product.id}
                                            product={product}
                                            expanded={expandedProducts.has(product.id)}
                                            onToggleExpand={() => toggleProductExpansion(product.id)}
                                            showProductionInfo={false}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab Por Producción */}
                <TabsContent value="produccion" className="space-y-4">
                    {/* Filtros */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Package className="h-5 w-5" />
                                Calculadora por Producción
                            </CardTitle>
                            <CardDescription>
                                Costos calculados basándose en las unidades producidas en lugar de las vendidas
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <Label htmlFor="category-filter-production">Categoría</Label>
                                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Todas las categorías" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas las categorías</SelectItem>
                                            {categories.map((category) => (
                                                <SelectItem key={category} value={category}>
                                                    {category}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-end gap-2">
                                    <ExportButton
                                        data={filteredProducts}
                                        filename={`costos-produccion-${selectedMonth}`}
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={loadProductionPricesSimple}
                                        disabled={loading}
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Actualizar
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Información de producción */}
                    {stats.totalProduction > 0 && (
                        <Card className="bg-info-muted border-info-muted">
                            <CardHeader>
                                <CardTitle className="text-lg text-info-muted-foreground flex items-center gap-2">
                                    <Info className="h-5 w-5" />
                                    Información de Producción - {new Date(selectedMonth + '-01').toLocaleDateString('es-AR', { year: 'numeric', month: 'long' })}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-info-muted-foreground">{formatNumber(stats.totalProduction)}</div>
                                        <div className="text-sm text-info-muted-foreground">Total Unidades Producidas</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-info-muted-foreground">{stats.productsWithProduction}</div>
                                        <div className="text-sm text-info-muted-foreground">Productos con Producción</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-info-muted-foreground">
                                            {stats.productsWithProduction > 0
                                                ? Math.round(stats.totalProduction / stats.productsWithProduction)
                                                : 0
                                            }
                                        </div>
                                        <div className="text-sm text-info-muted-foreground">Promedio por Producto</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Lista de productos por producción */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Productos y Costos por Producción</CardTitle>
                            <CardDescription>
                                {filteredProducts.length} productos encontrados - Costos distribuidos según producción real
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            ) : filteredProducts.length === 0 ? (
                                <div className="text-center py-8">
                                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold mb-2">No hay datos de producción</h3>
                                    <p className="text-muted-foreground mb-4">
                                        No se encontraron registros de producción para el mes seleccionado.
                                    </p>
                                    <Button variant="outline" onClick={loadProductionPricesSimple}>
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Recargar datos
                                    </Button>
                                </div>
                            ) : (
                                <div className="max-h-[600px] overflow-y-auto space-y-4 pr-2">
                                    {filteredProducts.map((product) => (
                                        <ProductCostCard
                                            key={product.id}
                                            product={product}
                                            expanded={expandedProducts.has(product.id)}
                                            onToggleExpand={() => toggleProductExpansion(product.id)}
                                            showProductionInfo={true}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>


                {/* Tab Comparativo */}
                <TabsContent value="comparativo" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" />
                                Análisis Comparativo
                            </CardTitle>
                            <CardDescription>
                                Compara costos entre diferentes períodos y métodos de distribución
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold">Comparación Por Ventas vs Por Producción</h3>

                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                                            <span className="text-sm font-medium">Total Productos</span>
                                            <div className="flex gap-4">
                                                <span className="text-info-muted-foreground">Ventas: {productPrices.length}</span>
                                                <span className="text-success">Producción: {productionPrices.length}</span>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                                            <span className="text-sm font-medium">Costo Promedio</span>
                                            <div className="flex gap-4">
                                                <span className="text-info-muted-foreground">
                                                    {formatCurrency(productPrices.length > 0
                                                        ? productPrices.reduce((sum, p) => sum + p.calculated_cost, 0) / productPrices.length
                                                        : 0
                                                    )}
                                                </span>
                                                <span className="text-success">
                                                    {formatCurrency(productionPrices.length > 0
                                                        ? productionPrices.reduce((sum, p) => sum + p.calculated_cost, 0) / productionPrices.length
                                                        : 0
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold">Estadísticas del Período</h3>

                                    <div className="space-y-3">
                                        <div className="p-3 bg-info-muted rounded-lg">
                                            <div className="text-sm text-info-muted-foreground">Mes Seleccionado</div>
                                            <div className="text-lg font-bold text-info-muted-foreground">
                                                {new Date(selectedMonth + '-01').toLocaleDateString('es-AR', { year: 'numeric', month: 'long' })}
                                            </div>
                                        </div>

                                        <div className="p-3 bg-success-muted rounded-lg">
                                            <div className="text-sm text-success">Productos con Producción</div>
                                            <div className="text-lg font-bold text-success">{stats.productsWithProduction}</div>
                                        </div>

                                        <div className="p-3 bg-purple-50 rounded-lg">
                                            <div className="text-sm text-purple-600">Total Unidades Producidas</div>
                                            <div className="text-lg font-bold text-purple-700">{formatNumber(stats.totalProduction)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab Reportes */}
                <TabsContent value="reportes" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Reportes y Exportación
                            </CardTitle>
                            <CardDescription>
                                Genera reportes detallados de costos y exporta datos
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold">Reportes Disponibles</h3>

                                    <div className="space-y-3">
                                        <Button variant="outline" className="w-full justify-start">
                                            <FileText className="h-4 w-4 mr-2" />
                                            Reporte de Costos por Ventas
                                        </Button>

                                        <Button variant="outline" className="w-full justify-start">
                                            <FileText className="h-4 w-4 mr-2" />
                                            Reporte de Costos por Producción
                                        </Button>

                                        <Button variant="outline" className="w-full justify-start">
                                            <BarChart3 className="h-4 w-4 mr-2" />
                                            Análisis Comparativo Detallado
                                        </Button>

                                        <Button variant="outline" className="w-full justify-start">
                                            <TrendingUp className="h-4 w-4 mr-2" />
                                            Reporte de Márgenes y Rentabilidad
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold">Exportación Rápida</h3>

                                    <div className="space-y-3">
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-2">Exportar Datos por Ventas</div>
                                        <ExportButton
                                            data={productPrices}
                                            filename={`costos-ventas-completo-${selectedMonth}`}
                                            />
                                        </div>

                                        <div>
                                            <div className="text-sm text-muted-foreground mb-2">Exportar Datos por Producción</div>
                                        <ExportButton
                                            data={productionPrices}
                                            filename={`costos-produccion-completo-${selectedMonth}`}
                                            />
                                        </div>

                                        <div>
                                            <div className="text-sm text-muted-foreground mb-2">Exportar Datos Filtrados</div>
                                        <ExportButton
                                            data={filteredProducts}
                                            filename={`costos-filtrados-${selectedMonth}`}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-4 p-3 bg-muted rounded-lg">
                                        <div className="text-sm text-muted-foreground">Resumen de Exportación</div>
                                        <div className="text-sm">
                                            <div>Productos por ventas: {productPrices.length}</div>
                                            <div>Productos por producción: {productionPrices.length}</div>
                                            <div>Productos filtrados: {filteredProducts.length}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}