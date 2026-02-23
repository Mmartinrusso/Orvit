'use client';

import React, { useState, useEffect } from 'react';
import { cn, formatNumber } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { useCalculadoraCostosFinal } from '@/hooks/use-dashboard-data';
import { usePriceComparisons } from '@/hooks/use-price-comparisons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogBody } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCompany } from '@/contexts/CompanyContext';
import { ProductCostCard } from '@/components/costos/ProductCostCard';
import { ExportButton } from '@/components/costos/ExportButton';
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
    FileText,
    BookOpen,
    Download,
    BarChart2,
    Plus,
    X,
    Trash2,
    Loader2
} from 'lucide-react';
import { NotesDialog } from '@/components/ui/NotesDialog';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { toast } from 'sonner';
import { formatCurrency } from '@/components/dashboard';
import * as XLSX from 'xlsx';

// ✅ OPTIMIZACIÓN: Desactivar logs en producción
// Para debugging temporal, cambiar a true
const DEBUG = false; // Desactivado para mejor rendimiento
const log = DEBUG ? (...args: unknown[]) => { /* debug */ } : () => {};
const warn = DEBUG ? console.warn.bind(console) : () => {};

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

interface Competitor {
    id: string;
    name: string;
    prices: { [productId: number]: number | null };
}

interface PriceComparison {
    id: string;
    name: string;
    competitors: Competitor[];
    createdAt: string;
    products: Array<{
        productId: number;
        productName: string;
        myPrice: number;
    }>;
}

export function CalculadoraCostosEmbedded() {
    const { currentCompany } = useCompany();
    const confirm = useConfirm();
    const [activeTab, setActiveTab] = useState('calculadora');

    // ✨ OPTIMIZADO: React Query maneja el fetch automáticamente cuando activeTab === 'produccion'
    // No necesitamos useEffect aquí

    // Estados principales
    const [selectedMonth, setSelectedMonth] = useState('2025-08');
    
    // ✨ OPTIMIZADO: Usar React Query hooks en lugar de fetch directo (elimina duplicados)
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
    
    // Estados principales
    const [availableMonths, setAvailableMonths] = useState<string[]>([]);
    const [loadingMonths, setLoadingMonths] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
    const [summary, setSummary] = useState<any>(null);
    
    // Extraer summary de la query activa
    useEffect(() => {
        if (activeTab === 'calculadora' && salesQuery.data?.summary) {
            setSummary(salesQuery.data.summary);
        } else if (activeTab === 'produccion' && productionQuery.data?.summary) {
            setSummary(productionQuery.data.summary);
        }
    }, [activeTab, salesQuery.data?.summary, productionQuery.data?.summary]);
    
    // Estados para simulación de producción
    const [isSimulationMode, setIsSimulationMode] = useState(false);
    const [simulatedQuantities, setSimulatedQuantities] = useState<{ [key: string | number]: number }>({});
    const [showNotesDialog, setShowNotesDialog] = useState(false);
    const [simulationResults, setSimulationResults] = useState<ProductPrice[]>([]);
    const [simulationEscenarios, setSimulationEscenarios] = useState<any[]>([]);
    const [simulationEstadisticas, setSimulationEstadisticas] = useState<any>(null);
    const [categoryQuantities, setCategoryQuantities] = useState<{ [category: string]: number }>({});
    const [categoryConfigMode, setCategoryConfigMode] = useState<{ [category: string]: 'total' | 'individual' }>({});
    const [categoryPlacas, setCategoryPlacas] = useState<{ [category: string]: number }>({});
    const [categoryDias, setCategoryDias] = useState<{ [category: string]: number }>({});
    const [categoryBancos, setCategoryBancos] = useState<{ [category: string]: number }>({});
    const [categoryDiasViguetas, setCategoryDiasViguetas] = useState<{ [category: string]: number }>({});
    const [simulationLoading, setSimulationLoading] = useState(false);

    // Estados para comparativa de meses - FIXED v2.1
    const [selectedMonths, setSelectedMonths] = useState<string[]>(['2025-08']);
    const [comparisonData, setComparisonData] = useState<{ [month: string]: ProductPrice[] }>({});
    
    // ✨ OPTIMIZADO: Usar React Query hook para price-comparisons (elimina duplicados)
    const { data: comparisonsData } = usePriceComparisons(
        currentCompany?.id,
        !!currentCompany
    );
    
    // Estados para comparativas de precios
    const [comparisons, setComparisons] = useState<PriceComparison[]>([]);
    const [isComparisonsDialogOpen, setIsComparisonsDialogOpen] = useState(false);
    const [isNewComparisonDialogOpen, setIsNewComparisonDialogOpen] = useState(false);
    const [newComparisonName, setNewComparisonName] = useState('');
    const [competitors, setCompetitors] = useState<Competitor[]>([]);
    const [newCompetitorName, setNewCompetitorName] = useState('');
    const [currentComparison, setCurrentComparison] = useState<PriceComparison | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

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

        const ensureSelectedMonths = (months: string[], fallbackMonth: string) => {
            setSelectedMonths(prev => {
                const filtered = prev.filter(month => months.includes(month));
                if (filtered.length === 0) {
                    return [fallbackMonth];
                }
                return filtered;
            });
        };

        const fetchAvailableMonths = async () => {
            setLoadingMonths(true);
            try {
                const response = await fetch(`/api/dashboard/available-months?companyId=${currentCompany.id}`);
                if (response.ok) {
                    const months = await response.json();
                    if (Array.isArray(months) && months.length > 0) {
                        setAvailableMonths(months);
                        const nextSelected = months.includes(selectedMonth) ? selectedMonth : months[0];
                        setSelectedMonth(nextSelected);
                        ensureSelectedMonths(months, nextSelected);
                        return;
                    }
                }
                const fallbackMonths = generateFallbackMonths();
                setAvailableMonths(fallbackMonths);
                const nextSelected = fallbackMonths.includes(selectedMonth) ? selectedMonth : fallbackMonths[0];
                setSelectedMonth(nextSelected);
                ensureSelectedMonths(fallbackMonths, nextSelected);
            } catch (error) {
                console.error('Error fetching available months:', error);
                const fallbackMonths = generateFallbackMonths();
                setAvailableMonths(fallbackMonths);
                const nextSelected = fallbackMonths.includes(selectedMonth) ? selectedMonth : fallbackMonths[0];
                setSelectedMonth(nextSelected);
                ensureSelectedMonths(fallbackMonths, nextSelected);
            } finally {
                setLoadingMonths(false);
            }
        };

        fetchAvailableMonths();
    }, [currentCompany]);

    // ✨ OPTIMIZADO: Sincronizar datos de React Query con estado local (para compatibilidad)
    useEffect(() => {
        if (comparisonsData) {
            log('✅ Comparativas cargadas desde React Query:', comparisonsData.length, 'comparativas');
            setComparisons(comparisonsData);
        } else if (currentCompany) {
            // Fallback a localStorage solo si no hay datos de React Query
            const savedComparisons = localStorage.getItem(`price_comparisons_${currentCompany.id}`);
            if (savedComparisons) {
                try {
                    const parsed = JSON.parse(savedComparisons);
                    // Migrar comparativas antiguas (con competitorName) a la nueva estructura
                    const migrated = parsed.map((comp: any) => {
                        // Si tiene competitorName, es una comparativa antigua
                        if (comp.competitorName && !comp.competitors) {
                            const competitor: Competitor = {
                                id: Date.now().toString(),
                                name: comp.competitorName,
                                prices: comp.products.reduce((acc: any, product: any) => {
                                    acc[product.productId] = product.competitorPrice !== null 
                                        ? parseFloat(formatNumber(product.competitorPrice as number, 2))
                                        : null;
                                    return acc;
                                }, {})
                            };
                            return {
                                ...comp,
                                competitors: [competitor]
                            };
                        }
                        // Si ya tiene competitors, asegurar que los precios tengan 2 decimales
                        if (comp.competitors) {
                            return {
                                ...comp,
                                competitors: comp.competitors.map((comp: Competitor) => ({
                                    ...comp,
                                    prices: Object.keys(comp.prices).reduce((acc, productId) => {
                                        const price = comp.prices[parseInt(productId)];
                                        acc[parseInt(productId)] = price !== null ? parseFloat((price as number).toFixed(2)) : null;
                                        return acc;
                                    }, {} as { [productId: number]: number | null })
                                }))
                            };
                        }
                        return comp;
                    });
                    setComparisons(migrated);
                } catch (parseError) {
                    console.error('Error parseando comparativas de localStorage:', parseError);
                }
            }
        }
    }, [comparisonsData, currentCompany]);

    // Guardar comparativas en el backend
    const saveComparisons = async (newComparisons: PriceComparison[]) => {
        if (!currentCompany) return;
        
        setComparisons(newComparisons);
        
        // También guardar en localStorage como backup
        localStorage.setItem(`price_comparisons_${currentCompany.id}`, JSON.stringify(newComparisons));
    };

    // Función para formatear moneda con 2 decimales
    const formatCurrencyWithDecimals = (amount: number): string => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    };

    const formatMonthLabel = (month: string) => {
        const [year, monthPart] = month.split('-');
        const date = new Date(parseInt(year), parseInt(monthPart) - 1, 1);
        const monthName = date.toLocaleString('es-AR', { month: 'long' });
        const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        return `${capitalized} ${year}`;
    };

    const formatMonthShort = (month: string) => {
        const [year, monthPart] = month.split('-');
        const date = new Date(parseInt(year), parseInt(monthPart) - 1, 1);
        const shortName = date.toLocaleString('es-AR', { month: 'short' }).replace('.', '');
        const capitalized = shortName.charAt(0).toUpperCase() + shortName.slice(1);
        return capitalized;
    };

    const formatMonthShortWithYear = (month: string) => {
        const [year] = month.split('-');
        return `${formatMonthShort(month)} ${year}`;
    };

    // ✨ OPTIMIZADO: React Query maneja el fetch automáticamente, no necesitamos useEffect
    // Las queries se ejecutan cuando enabled es true y los params están listos

    // Cargar datos de comparativa cuando cambian los meses seleccionados
    useEffect(() => {
        if (activeTab === 'comparativa' && currentCompany && selectedMonths.length > 0) {
            loadComparisonData();
        }
    }, [activeTab, selectedMonths, currentCompany]);

    // ✨ OPTIMIZADO: Reemplazado por React Query hook useCalculadoraCostosFinal
    // Esta función se mantiene solo para compatibilidad con botones de refetch
    const loadProductPrices = async () => {
        await salesQuery.refetch();
    };

    // ✨ OPTIMIZADO: Reemplazado por React Query hook useCalculadoraCostosFinal
    // Esta función se mantiene solo para compatibilidad con botones de refetch
    const loadProductionPricesSimple = async () => {
        const result = await productionQuery.refetch();
        if (result.data?.productPrices) {
            // Inicializar cantidades simuladas en 0
            const initialQuantities: { [productId: number]: number } = {};
            result.data.productPrices.forEach((product: ProductPrice) => {
                initialQuantities[product.id] = 0;
            });
            setSimulatedQuantities(initialQuantities);
        }
    };

    // Funciones para simulación
    const toggleSimulationMode = () => {
        const newMode = !isSimulationMode;
        setIsSimulationMode(newMode);
        
        if (newMode) {
            // Al activar, limpiar resultados
            setSimulationResults([]);
        } else {
            // Al desactivar, limpiar todas las cantidades configuradas y recargar datos reales
            setSimulatedQuantities({});
            setCategoryQuantities({});
            setSimulationResults([]);
            log('🧹 Modo simulación desactivado - Todas las cantidades limpiadas');
            
            // ✨ OPTIMIZADO: React Query refetch automático cuando cambian los params
            // No necesitamos llamar manualmente
        }
    };

    const updateSimulatedQuantity = (productId: number, quantity: number) => {
        setSimulatedQuantities(prev => ({
            ...prev,
            [productId]: quantity
        }));
    };

    const fillWithExampleQuantities = () => {
        const exampleQuantities: { [productId: number]: number } = {};
        productionPrices.forEach(product => {
            // Generar cantidades aleatorias entre 100 y 1000
            exampleQuantities[product.id] = Math.floor(Math.random() * 900) + 100;
        });
        setSimulatedQuantities(exampleQuantities);
    };

    const toggleCategoryConfigMode = (category: string) => {
        const newMode = categoryConfigMode[category] === 'total' ? 'individual' : 'total';
        setCategoryConfigMode(prev => ({
            ...prev,
            [category]: newMode
        }));
        
        // Si cambia a individual, limpiar el total de categoría e inicializar días a 22 para bloques y viguetas
        if (newMode === 'individual') {
            setCategoryQuantities(prev => ({
                ...prev,
                [category]: 0
            }));
            
            // Si es bloques, inicializar días a 22 para todos los productos de esa categoría
            if (category.toLowerCase().includes('bloque')) {
                const bloquesProducts = productPrices.filter(p => 
                    p.category_name?.toLowerCase().includes('bloque')
                );
                setSimulatedQuantities(prev => {
                    const updated = { ...prev };
                    bloquesProducts.forEach(product => {
                        if (!updated[`${product.id}_dias`]) {
                            updated[`${product.id}_dias`] = 22;
                        }
                    });
                    return updated;
                });
            }
            
            // Si es viguetas, inicializar días a 22 para todos los productos de esa categoría
            if (category.toLowerCase().includes('vigueta')) {
                const viguetasProducts = productPrices.filter(p => 
                    p.category_name?.toLowerCase().includes('vigueta')
                );
                setSimulatedQuantities(prev => {
                    const updated = { ...prev };
                    viguetasProducts.forEach(product => {
                        if (!updated[`${product.id}_dias_vigueta`]) {
                            updated[`${product.id}_dias_vigueta`] = 22;
                        }
                    });
                    return updated;
                });
            }
        } else {
            // Si cambia a modo "Por Total" y es Bloques, inicializar días a 22
            if (category.toLowerCase().includes('bloque')) {
                setCategoryDias(prev => {
                    if (!prev[category]) {
                        return {
                            ...prev,
                            [category]: 22
                        };
                    }
                    return prev;
                });
            }
            // Si cambia a modo "Por Total" y es Viguetas, inicializar bancos y días a 22
            if (category.toLowerCase().includes('vigueta')) {
                setCategoryBancos(prev => {
                    if (!prev[category]) {
                        return {
                            ...prev,
                            [category]: 0
                        };
                    }
                    return prev;
                });
                setCategoryDiasViguetas(prev => {
                    if (!prev[category]) {
                        return {
                            ...prev,
                            [category]: 22
                        };
                    }
                    return prev;
                });
            }
        }
    };

    const updateCategoryQuantity = (category: string, value: number) => {
        setCategoryQuantities(prev => ({
            ...prev,
            [category]: value
        }));

        // Distribuir automáticamente entre productos de la categoría
        const productsInCategory = productionPrices.filter(p => p.category_name === category);
        
        if (category.toLowerCase().includes('vigueta')) {
            // Para VIGUETAS: El valor es en METROS, distribuir proporcionalmente por largo
            distributeTotalMetersToViguetas(productsInCategory, value);
        } else if (category.toLowerCase().includes('adoquin')) {
            // Para ADOQUINES: El valor es en M², convertir a unidades y distribuir equitativamente
            const newQuantities = { ...simulatedQuantities };
            const m2PorProducto = productsInCategory.length > 0 ? value / productsInCategory.length : 0;
            productsInCategory.forEach(product => {
                // Determinar unidades por m² según el tipo de adoquín
                let unidadesPorM2 = 39.5; // Holanda por defecto
                if (product.product_name.toLowerCase().includes('unistone')) {
                    unidadesPorM2 = 41.35;
                }
                // Convertir m² a unidades
                const unidadesTotal = Math.round(m2PorProducto * unidadesPorM2);
                // Distribuir equitativamente entre los productos de adoquines
                newQuantities[product.id] = unidadesTotal;
                
                // Establecer la clave auxiliar _m2 para que el filtro funcione
                if (m2PorProducto > 0) {
                    newQuantities[`${product.id}_m2`] = m2PorProducto;
                } else {
                    delete newQuantities[`${product.id}_m2`];
                }
            });
            setSimulatedQuantities(newQuantities);
        } else {
            // Para otras categorías: Distribuir equitativamente en unidades
            const qtyPerProduct = productsInCategory.length > 0 ? Math.floor(value / productsInCategory.length) : 0;
            const newQuantities = { ...simulatedQuantities };
            const isBloques = category.toLowerCase().includes('bloque');
            const diasPorDefecto = 22;
            
            productsInCategory.forEach(product => {
                newQuantities[product.id] = qtyPerProduct;
                
                // Para bloques, establecer las claves auxiliares necesarias
                if (isBloques && qtyPerProduct > 0) {
                    // Trabajamos hacia atrás: unidades = placas * días * unidadesPorPlaca
                    // placas = unidades / (días * unidadesPorPlaca)
                    const unidadesPorPlaca = product.units_per_item || 1;
                    const placasNecesarias = Math.ceil(qtyPerProduct / (diasPorDefecto * unidadesPorPlaca));
                    newQuantities[`${product.id}_placas`] = placasNecesarias;
                    newQuantities[`${product.id}_dias`] = diasPorDefecto;
                } else if (isBloques) {
                    // Si no hay cantidad, limpiar las claves auxiliares
                    delete newQuantities[`${product.id}_placas`];
                    delete newQuantities[`${product.id}_dias`];
                }
            });
            setSimulatedQuantities(newQuantities);
        }
    };

    const distributeTotalMetersToViguetas = (viguetas: ProductPrice[], totalMeters: number) => {
        // Calcular distribución proporcional por largo de vigueta
        let totalLength = 0;
        const viguetaLengths: { [id: number]: number } = {};

        viguetas.forEach(vigueta => {
            const lengthMatch = vigueta.product_name.match(/(\d+\.?\d*)\s*(m|mts|metros?)/i);
            const length = lengthMatch ? parseFloat(lengthMatch[1]) : 1;
            viguetaLengths[vigueta.id] = length;
            totalLength += length;
        });

        // Calcular días por defecto si no existe
        const diasPorDefecto = 22;
        const metrosUtilesPorBanco = 1300;

        // Distribuir metros proporcionalmente
        const newQuantities = { ...simulatedQuantities };
        viguetas.forEach(vigueta => {
            const viguetaLength = viguetaLengths[vigueta.id];
            const proportion = totalLength > 0 ? viguetaLength / totalLength : 1 / viguetas.length;
            const metersForThisVigueta = totalMeters * proportion;
            const unitsNeeded = viguetaLength > 0 ? Math.floor(metersForThisVigueta / viguetaLength) : 0;
            
            // Establecer la cantidad de unidades
            newQuantities[vigueta.id] = unitsNeeded;
            
            // Calcular y establecer bancos necesarios para que el filtro funcione
            // Trabajamos hacia atrás: metros totales = bancos * días * metrosUtilesPorBanco
            // bancos = metrosTotales / (días * metrosUtilesPorBanco)
            if (metersForThisVigueta > 0) {
                const bancosNecesarios = Math.ceil(metersForThisVigueta / (diasPorDefecto * metrosUtilesPorBanco));
                newQuantities[`${vigueta.id}_bancos`] = bancosNecesarios;
                newQuantities[`${vigueta.id}_dias_vigueta`] = diasPorDefecto;
            } else {
                // Si no hay metros, limpiar las claves auxiliares
                delete newQuantities[`${vigueta.id}_bancos`];
                delete newQuantities[`${vigueta.id}_dias_vigueta`];
            }
        });

        setSimulatedQuantities(newQuantities);
    };

    const distributeBancosAndDiasToViguetas = (viguetas: ProductPrice[], bancos: number, dias: number) => {
        const metrosUtilesPorBanco = 1300;
        const metrosTotales = bancos * dias * metrosUtilesPorBanco;
        
        // Calcular distribución proporcional por largo de vigueta
        let totalLength = 0;
        const viguetaLengths: { [id: number]: number } = {};

        viguetas.forEach(vigueta => {
            const lengthMatch = vigueta.product_name.match(/(\d+\.?\d*)\s*(m|mts|metros?)/i);
            const length = lengthMatch ? parseFloat(lengthMatch[1]) : 1;
            viguetaLengths[vigueta.id] = length;
            totalLength += length;
        });

        // Distribuir metros y calcular unidades proporcionalmente
        const newQuantities = { ...simulatedQuantities };
        viguetas.forEach(vigueta => {
            const viguetaLength = viguetaLengths[vigueta.id];
            const proportion = totalLength > 0 ? viguetaLength / totalLength : 1 / viguetas.length;
            const metersForThisVigueta = metrosTotales * proportion;
            const unitsNeeded = viguetaLength > 0 ? Math.floor(metersForThisVigueta / viguetaLength) : 0;
            
            // Establecer la cantidad de unidades
            newQuantities[vigueta.id] = unitsNeeded;
            
            // Calcular y establecer bancos proporcionales para esta vigueta
            if (metrosTotales > 0) {
                const bancosParaEstaVigueta = Math.ceil(metersForThisVigueta / (dias * metrosUtilesPorBanco));
                newQuantities[`${vigueta.id}_bancos`] = bancosParaEstaVigueta;
                newQuantities[`${vigueta.id}_dias_vigueta`] = dias;
                newQuantities[`_metros_${vigueta.id}`] = metersForThisVigueta;
            } else {
                // Si no hay bancos, limpiar las claves auxiliares
                delete newQuantities[`${vigueta.id}_bancos`];
                delete newQuantities[`${vigueta.id}_dias_vigueta`];
                delete newQuantities[`_metros_${vigueta.id}`];
            }
        });

        setSimulatedQuantities(newQuantities);
    };

    const exportSimulationToExcel = () => {
        // Usar los resultados de la simulación si existen, sino filtrar de productionPrices
        const productsToExport = simulationResults.length > 0 
            ? simulationResults 
            : productionPrices.filter(product => {
                const quantity = simulatedQuantities[product.id] || 0;
                return quantity > 0;
            });

        if (productsToExport.length === 0) {
            toast.warning('No hay productos configurados en la simulación para exportar');
            return;
        }

        log('📊 Exportando productos:', productsToExport.map(p => ({
            name: p.product_name,
            cost_breakdown: p.cost_breakdown,
            calculated_price: p.calculated_price,
            current_price: p.current_price
        })));

        // Preparar datos para Excel - Formato simplificado para compras
        const excelData = productsToExport.map(product => {
            // Usar el costo total (materiales + indirectos + empleados) SIN margen
            const materials = product.cost_breakdown?.materials || 0;
            const indirect = product.cost_breakdown?.indirect_costs || 0;
            const employee = product.cost_breakdown?.employee_costs || 0;
            const costPerUnit = materials + indirect + employee;
            
            // Usar directamente el costo total sin agregar margen
            const finalPrice = parseFloat(costPerUnit.toFixed(2));

            log(`💰 ${product.product_name}:`);
            log(`   - Materiales: $${materials.toFixed(2)}`);
            log(`   - Indirectos: $${indirect.toFixed(2)}`);
            log(`   - Empleados: $${employee.toFixed(2)}`);
            log(`   - Costo Total: $${costPerUnit.toFixed(2)}`);
            log(`   - Precio Final para Excel: ${finalPrice} (tipo: ${typeof finalPrice})`);

            return {
                'Producto': product.product_name,
                'ID': product.sku || product.id?.toString() || '-',
                'Precio Final': finalPrice
            };
        });
        
        log('📋 Datos preparados para Excel:', excelData.slice(0, 3).map(d => ({
            producto: d.Producto,
            precio: d['Precio Final'],
            tipo: typeof d['Precio Final']
        })));

        // Crear workbook y worksheet
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Lista de Precios');

        // Verificar valores ANTES de modificar
        log('🔍 Valores en worksheet ANTES de modificar:');
        for (let R = 1; R <= Math.min(3, excelData.length); ++R) {
            const priceCell = 'C' + (R + 1);
            if (worksheet[priceCell]) {
                log(`   Celda ${priceCell}: valor=${worksheet[priceCell].v}, tipo=${worksheet[priceCell].t}`);
            }
        }

        // Asegurar que la columna de precio sea numérica ANTES de aplicar formato
        // Verificar y corregir los valores directamente desde excelData
        for (let R = 0; R < excelData.length; ++R) {
            const priceCell = 'C' + (R + 2); // R+2 porque R es 0-indexed y la fila 1 es el encabezado
            const expectedValue = excelData[R]['Precio Final'];
            
            if (worksheet[priceCell]) {
                // Verificar que el valor en el worksheet coincida con el valor esperado
                const currentValue = worksheet[priceCell].v;
                log(`🔍 Fila ${R + 2}: Esperado=${expectedValue}, Actual en worksheet=${currentValue}`);
                
                // Forzar el valor correcto
                if (typeof expectedValue === 'number' && !isNaN(expectedValue)) {
                    worksheet[priceCell].v = expectedValue;
                    worksheet[priceCell].t = 'n'; // Tipo numérico
                    log(`✅ Corregido: Celda ${priceCell} = ${expectedValue}`);
                } else {
                    // Si no es número, intentar parsearlo
                    const numValue = parseFloat(String(expectedValue));
                    if (!isNaN(numValue)) {
                        worksheet[priceCell].v = numValue;
                        worksheet[priceCell].t = 'n';
                        log(`✅ Parseado y corregido: Celda ${priceCell} = ${numValue}`);
                    }
                }
            } else {
                // Si la celda no existe, crearla
                worksheet[priceCell] = {
                    v: typeof expectedValue === 'number' ? expectedValue : parseFloat(String(expectedValue)),
                    t: 'n'
                };
                log(`✅ Creada nueva celda: ${priceCell} = ${expectedValue}`);
            }
        }
        
        // Verificar valores DESPUÉS de modificar
        log('🔍 Valores en worksheet DESPUÉS de modificar:');
        for (let R = 1; R <= Math.min(3, excelData.length); ++R) {
            const priceCell = 'C' + (R + 1);
            if (worksheet[priceCell]) {
                log(`   Celda ${priceCell}: valor=${worksheet[priceCell].v}, tipo=${worksheet[priceCell].t}, formato=${worksheet[priceCell].z || 'sin formato'}`);
            }
        }

        // Ajustar anchos de columna
        const columnWidths = [
            { wch: 40 }, // Producto
            { wch: 15 }, // ID
            { wch: 20 }  // Precio Final
        ];
        worksheet['!cols'] = columnWidths;

        // Aplicar estilos a los encabezados (fila 1) - Azul marino con texto blanco
        const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:C1');
        
        for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
            const address = XLSX.utils.encode_col(C) + "1"; // Primera fila
            if (!worksheet[address]) continue;
            
            worksheet[address].s = {
                fill: { 
                    patternType: "solid",
                    fgColor: { rgb: "1e3a8a" } // Azul marino
                },
                font: { 
                    color: { rgb: "FFFFFF" }, // Blanco
                    bold: true,
                    sz: 12
                },
                alignment: { 
                    horizontal: "center", 
                    vertical: "center" 
                }
            };
        }
        
        // Aplicar formato de moneda a la columna de precio con 2 decimales
        // Asegurar que los valores sean números y aplicar formato correcto
        for (let R = 0; R < excelData.length; ++R) {
            const priceCell = 'C' + (R + 2); // R+2 porque R es 0-indexed y la fila 1 es el encabezado
            const expectedValue = excelData[R]['Precio Final'];
            
            if (worksheet[priceCell]) {
                // Asegurar que el valor sea el correcto antes de aplicar formato
                const currentValue = worksheet[priceCell].v;
                
                // Verificar que el valor sea correcto
                if (Math.abs(currentValue - expectedValue) > 0.01) {
                    log(`⚠️ ADVERTENCIA: Celda ${priceCell} tiene valor incorrecto. Esperado: ${expectedValue}, Actual: ${currentValue}. Corrigiendo...`);
                    worksheet[priceCell].v = expectedValue;
                }
                
                // Asegurar que el valor sea un número
                if (typeof worksheet[priceCell].v === 'number' && !isNaN(worksheet[priceCell].v)) {
                    worksheet[priceCell].t = 'n'; // Tipo numérico explícito
                    // Formato de moneda: $ seguido de número con separador de miles y 2 decimales
                    // Usar formato estándar de Excel para moneda
                    worksheet[priceCell].z = '$#,##0.00'; // Formato de moneda con 2 decimales
                    log(`💰 Formato aplicado a ${priceCell}: valor=${worksheet[priceCell].v}, formato=${worksheet[priceCell].z}`);
                }
            }
        }

        // Verificación final antes de escribir el archivo
        log('🔍 VERIFICACIÓN FINAL antes de escribir el archivo:');
        for (let R = 0; R < Math.min(3, excelData.length); ++R) {
            const priceCell = 'C' + (R + 2);
            const expectedValue = excelData[R]['Precio Final'];
            if (worksheet[priceCell]) {
                const finalValue = worksheet[priceCell].v;
                log(`   ${priceCell}: Esperado=${expectedValue}, Final=${finalValue}, Tipo=${worksheet[priceCell].t}, Formato=${worksheet[priceCell].z || 'sin formato'}`);
                if (Math.abs(finalValue - expectedValue) > 0.01) {
                    console.error(`   ❌ ERROR: Valor incorrecto en ${priceCell}!`);
                }
            }
        }

        // Generar nombre de archivo con fecha y hora
        const now = new Date();
        const fecha = now.toISOString().split('T')[0];
        const hora = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const fileName = `Lista_Precios_${fecha}_${hora}.xlsx`;

        // Descargar archivo con soporte de estilos
        // Usar opciones que preserven los valores numéricos
        XLSX.writeFile(workbook, fileName, { 
            cellStyles: true, 
            bookType: 'xlsx',
            cellDates: false,
            sheetStubs: false
        });
        log(`📊 Lista de precios exportada: ${fileName}`);
    };

    const loadComparisonData = async () => {
        if (selectedMonths.length === 0) return;

        setSimulationLoading(true);
        try {
            log('🔄 Cargando datos de comparativa para meses:', selectedMonths);
            
            const promises = selectedMonths.map(async (month) => {
                const url = `/api/calculadora-costos-final?companyId=${currentCompany?.id}&distributionMethod=sales&productionMonth=${month}`;
                log(`📡 Cargando ${month}:`, url);
                
                const response = await fetch(url);
                if (!response.ok) {
                    console.error(`❌ Error en ${month}:`, response.status, response.statusText);
                    throw new Error(`Error cargando ${month}: ${response.status}`);
                }
                
                const data = await response.json();
                log(`✅ Datos recibidos para ${month}:`, data);
                
                return { month, data: data.results || data };
            });

            const results = await Promise.all(promises);
            const newComparisonData: { [month: string]: ProductPrice[] } = {};
            
            results.forEach(({ month, data }) => {
                newComparisonData[month] = data;
                log(`📊 ${month}: ${data.length} productos cargados`);
            });
            
            setComparisonData(newComparisonData);
            log('✅ Datos de comparativa cargados:', Object.keys(newComparisonData));
        } catch (error) {
            console.error('❌ Error cargando comparativa:', error);
        } finally {
            setSimulationLoading(false);
        }
    };

    // Funciones para comparativas de precios
    const handleCreateNewComparison = () => {
        // Obtener productos de la simulación actual
        const productsToCompare = simulationResults.length > 0 
            ? simulationResults 
            : productionPrices.filter(product => {
                const quantity = simulatedQuantities[product.id] || 0;
                return quantity > 0;
            });

        if (productsToCompare.length === 0) {
            toast.warning('No hay productos en la simulación para comparar. Ejecuta una simulación primero.');
            return;
        }

        setCompetitors([]);
        setNewComparisonName('');
        setNewCompetitorName('');
        setIsNewComparisonDialogOpen(true);
    };

    const handleAddCompetitor = () => {
        if (!newCompetitorName.trim()) {
            toast.warning('Por favor, ingresa un nombre para el competidor.');
            return;
        }

        const productsToCompare = simulationResults.length > 0 
            ? simulationResults 
            : productionPrices.filter(product => {
                const quantity = simulatedQuantities[product.id] || 0;
                return quantity > 0;
            });

        const initialPrices: { [productId: number]: number | null } = {};
        productsToCompare.forEach(product => {
            initialPrices[product.id] = null;
        });

        const newCompetitor: Competitor = {
            id: Date.now().toString(),
            name: newCompetitorName.trim(),
            prices: initialPrices
        };

        setCompetitors([...competitors, newCompetitor]);
        setNewCompetitorName('');
    };

    const handleAddMultipleCompetitors = () => {
        if (!newCompetitorName.trim()) {
            toast.warning('Por favor, ingresa al menos un nombre para el competidor.');
            return;
        }

        // Separar por comas y limpiar espacios
        const competitorNames = newCompetitorName
            .split(',')
            .map(name => name.trim())
            .filter(name => name.length > 0);

        if (competitorNames.length === 0) {
            toast.warning('Por favor, ingresa al menos un nombre válido para el competidor.');
            return;
        }

        const productsToCompare = simulationResults.length > 0 
            ? simulationResults 
            : productionPrices.filter(product => {
                const quantity = simulatedQuantities[product.id] || 0;
                return quantity > 0;
            });

        const initialPrices: { [productId: number]: number | null } = {};
        productsToCompare.forEach(product => {
            initialPrices[product.id] = null;
        });

        // Filtrar competidores que ya existen
        const existingNames = competitors.map(c => c.name.toLowerCase());
        const newCompetitors: Competitor[] = competitorNames
            .filter(name => !existingNames.includes(name.toLowerCase()))
            .map((name, index) => ({
                id: `${Date.now()}-${index}`,
                name: name,
                prices: { ...initialPrices }
            }));

        if (newCompetitors.length === 0) {
            toast.info('Todos los competidores ingresados ya existen.');
            setNewCompetitorName('');
            return;
        }

        setCompetitors([...competitors, ...newCompetitors]);
        setNewCompetitorName('');
    };

    const handleRemoveCompetitor = (competitorId: string) => {
        setCompetitors(competitors.filter(c => c.id !== competitorId));
    };

    const handleUpdateCompetitorPrice = (competitorId: string, productId: number, price: number | null) => {
        setCompetitors(competitors.map(comp => {
            if (comp.id === competitorId) {
                return {
                    ...comp,
                    prices: {
                        ...comp.prices,
                        [productId]: price !== null ? parseFloat(price.toFixed(2)) : null
                    }
                };
            }
            return comp;
        }));
    };

    const handleSaveNewComparison = async (): Promise<void> => {
        if (!newComparisonName.trim()) {
            toast.warning('Por favor, ingresa un nombre para la comparativa.');
            return;
        }

        if (competitors.length === 0) {
            toast.warning('Por favor, agrega al menos un competidor.');
            return;
        }

        const productsToCompare = simulationResults.length > 0 
            ? simulationResults 
            : productionPrices.filter(product => {
                const quantity = simulatedQuantities[product.id] || 0;
                return quantity > 0;
            });

        // Asegurar que los precios de los competidores tengan 2 decimales
        const competitorsWithFormattedPrices = competitors.map(comp => ({
            ...comp,
            prices: Object.keys(comp.prices).reduce((acc, productId) => {
                const price = comp.prices[parseInt(productId)];
                acc[parseInt(productId)] = price !== null ? parseFloat(price.toFixed(2)) : null;
                return acc;
            }, {} as { [productId: number]: number | null })
        }));

        const newComparison: PriceComparison = {
            id: Date.now().toString(),
            name: newComparisonName.trim(),
            competitors: competitorsWithFormattedPrices,
            createdAt: new Date().toISOString(),
            products: productsToCompare.map(product => {
                const materials = product.cost_breakdown?.materials || 0;
                const indirect = product.cost_breakdown?.indirect_costs || 0;
                const employee = product.cost_breakdown?.employee_costs || 0;
                const costPerUnit = materials + indirect + employee;
                const myPrice = parseFloat(costPerUnit.toFixed(2));

                return {
                    productId: product.id,
                    productName: product.product_name,
                    myPrice: myPrice
                };
            })
        };

        try {
            log('💾 Guardando comparativa en backend...', {
                name: newComparison.name,
                companyId: currentCompany?.id,
                competitorsCount: newComparison.competitors.length,
                productsCount: newComparison.products.length
            });

            const response = await fetch('/api/price-comparisons', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newComparison.name,
                    companyId: currentCompany?.id,
                    competitors: newComparison.competitors,
                    products: newComparison.products
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Error en respuesta del servidor:', response.status, errorText);
                throw new Error(`Error al guardar la comparativa: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            log('✅ Comparativa guardada exitosamente:', result);
            
            const updatedComparisons = [...comparisons, result.comparison];
            await saveComparisons(updatedComparisons);
            
            log('✅ Estado actualizado con nueva comparativa. Total:', updatedComparisons.length);
            
            setIsNewComparisonDialogOpen(false);
            setNewComparisonName('');
            setNewCompetitorName('');
            setCompetitors([]);
        } catch (error) {
            console.error('❌ Error guardando comparativa:', error);
            toast.error('Error al guardar la comparativa. Por favor, intenta nuevamente.');
        }
    };

    const handleDeleteComparison = async (comparisonId: string) => {
        const ok = await confirm({
            title: 'Eliminar comparativa',
            description: '¿Estás seguro de que quieres eliminar esta comparativa?',
            confirmText: 'Eliminar',
            variant: 'destructive',
        });
        if (!ok) return;
        try {
            const response = await fetch(`/api/price-comparisons?id=${comparisonId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Error al eliminar la comparativa');
            }

            const updatedComparisons = comparisons.filter(c => c.id !== comparisonId);
            await saveComparisons(updatedComparisons);
        } catch (error) {
            console.error('Error eliminando comparativa:', error);
            toast.error('Error al eliminar la comparativa. Por favor, intenta nuevamente.');
        }
    };

    const handleViewComparison = (comparison: PriceComparison) => {
        setCurrentComparison(comparison);
    };

    const handleCloseComparisonView = () => {
        setCurrentComparison(null);
    };

    const toggleMonthSelection = (month: string) => {
        setSelectedMonths(prev => {
            if (prev.includes(month)) {
                return prev.filter(m => m !== month);
            } else {
                return [...prev, month];
            }
        });
    };

    const runSimulation = async () => {
        if (!currentCompany) return;

        // Filtrar solo productos con cantidad > 0 (ignorar claves auxiliares)
        const quantities: { [key: number]: number } = {};
        
        // Primero, identificar qué productos tienen configuración real
        const productsWithRealConfig = new Set<number>();
        
        Object.entries(simulatedQuantities).forEach(([key, qty]) => {
            // Buscar productos con placas/bancos/m2 configurados
            if (key.includes('_placas') && qty > 0) {
                const productId = parseInt(key.replace('_placas', ''));
                if (!isNaN(productId)) productsWithRealConfig.add(productId);
            }
            if (key.includes('_bancos') && qty > 0) {
                const productId = parseInt(key.replace('_bancos', ''));
                if (!isNaN(productId)) productsWithRealConfig.add(productId);
            }
            if (key.includes('_m2') && qty > 0) {
                const productId = parseInt(key.replace('_m2', ''));
                if (!isNaN(productId)) productsWithRealConfig.add(productId);
            }
        });
        
        // Ahora filtrar las cantidades finales de productos
        Object.entries(simulatedQuantities).forEach(([key, qty]) => {
            // Ignorar claves auxiliares
            if (key.startsWith('_') || key.includes('_bancos') || key.includes('_placas') || 
                key.includes('_dias') || key.includes('_m2')) {
                return;
            }
            
            const productId = parseInt(key);
            
            // Solo incluir si:
            // 1. Es un ID numérico válido
            // 2. Tiene cantidad > 0
            // 3. O tiene configuración real (placas/bancos/m2 > 0)
            if (!isNaN(productId) && qty > 0) {
                // Verificar que el producto realmente tenga configuración (no sea solo "días" por defecto)
                const product = productionPrices.find(p => p.id === productId);
                if (product) {
                    const isBloques = product.category_name?.toLowerCase().includes('bloque');
                    const isViguetas = product.category_name?.toLowerCase().includes('vigueta');
                    const isAdoquines = product.category_name?.toLowerCase().includes('adoquin');
                    
                    // Para bloques/viguetas/adoquines, verificar que tengan placas/bancos/m2
                    if (isBloques || isViguetas || isAdoquines) {
                        if (productsWithRealConfig.has(productId)) {
                            quantities[productId] = qty;
                        }
                    } else {
                        // Otros productos: incluir si tienen cantidad directa
                        quantities[productId] = qty;
                    }
                }
            }
        });

        log('🎯 Cantidades filtradas para simulación:', quantities);
        log('🔍 Total productos con cantidad > 0:', Object.keys(quantities).length);

        if (Object.keys(quantities).length === 0) {
            toast.warning('Por favor introduce al menos una cantidad para simular');
            return;
        }

        setSimulationLoading(true);
        log('🎮 Ejecutando simulación con cantidades:', quantities);

        try {
            const response = await fetch('/api/calculadora-costos-final', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    companyId: currentCompany.id,
                    productionMonth: selectedMonth,
                    distributionMethod: 'production',
                    simulatedQuantities: quantities,
                    // Enviar información de placas y días para variaciones de cuartos
                    placas: categoryPlacas,
                    dias: categoryDias,
                    // Enviar información de bancos y días para variaciones de bancos en viguetas
                    bancos: categoryBancos,
                    diasViguetas: categoryDiasViguetas
                }),
            });

            if (response.ok) {
                const data = await response.json();
                log('✅ Simulación completada:', data.productPrices?.length || 0, 'productos');
                log('📊 Summary:', data.summary);
                log('📊 Escenarios:', data.escenarios?.length || 0);
                log('📊 Estadísticas:', data.estadisticas);
                
                // Filtrar solo productos con cantidad simulada > 0
                const resultsWithProduction = (data.productPrices || []).filter((p: ProductPrice) => {
                    return quantities[p.id] && quantities[p.id] > 0;
                });
                
                log('📊 Productos con producción simulada:', resultsWithProduction.length);
                setSimulationResults(resultsWithProduction);
                
                // Guardar escenarios y estadísticas
                if (data.escenarios && Array.isArray(data.escenarios)) {
                    setSimulationEscenarios(data.escenarios);
                }
                if (data.estadisticas) {
                    setSimulationEstadisticas(data.estadisticas);
                }
            } else {
                const errorData = await response.json();
                console.error('Error en simulación:', errorData);
                toast.error('Error: ' + (errorData.details || errorData.error));
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error ejecutando simulación');
        } finally {
            setSimulationLoading(false);
        }
    };

    // Funciones auxiliares

    const toggleProductExpansion = (productId: number) => {
        const newExpanded = new Set(expandedProducts);
        if (newExpanded.has(productId)) {
            newExpanded.delete(productId);
        } else {
            newExpanded.add(productId);
        }
        setExpandedProducts(newExpanded);
    };

    // Obtener datos según la pestaña activa y modo simulación
    let currentData = activeTab === 'produccion' 
        ? (isSimulationMode && simulationResults.length > 0 ? simulationResults : productionPrices)
        : productPrices;

    // Filtrar productos sin producción en la pestaña "Por Producción"
    if (activeTab === 'produccion' && !isSimulationMode) {
        currentData = currentData.filter(p => {
            // Verificar si tiene producción (quantity_produced > 0)
            const hasProduction = (p.distribution_info?.product_quantity ?? 0) > 0 || 
                                  (p.production_info?.quantity_produced ?? 0) > 0;
            return hasProduction;
        });
    }

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
            <div className="flex items-center justify-center py-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">Selecciona una empresa</h2>
                    <p className="text-muted-foreground">Necesitas seleccionar una empresa para acceder a la calculadora de costos.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                    <h1 className="text-lg font-medium text-foreground">Calculadora de Costos</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Calcula precios basados en costos de materiales, empleados e indirectos
                    </p>
                </div>
                <div className="flex items-center gap-1 md:gap-4">
                    <Button 
                        onClick={() => setShowNotesDialog(true)} 
                        variant="outline" 
                        size="sm"
                        className="text-warning-muted-foreground hover:text-warning-muted-foreground hover:bg-warning-muted"
                    >
                        <BookOpen className="h-4 w-4 mr-2" />
                        Notas
                    </Button>
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
                    <div className="text-base md:text-2xl font-bold mb-1 md:mb-2 text-info-muted-foreground">
                        {activeTab === 'produccion'
                            ? formatNumber(stats.totalProduction)
                            : formatCurrency(stats.totalValue)
                        }
                    </div>
                    <div className="flex items-center text-info-muted-foreground text-xs md:text-sm">
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
                    <TabsTrigger value="comparativo">Comparativa</TabsTrigger>
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
                        <CardContent className="p-0">
                            {/* Cartel de resumen por categoría */}
                            {(summary?.viguetas || summary?.bloques || summary?.adoquines) && (
                                <div className="p-6 pb-4 bg-gradient-to-r from-info-muted to-info-muted rounded-lg border border-info-muted mx-6 mt-6 mb-4">
                                    <h3 className="text-sm font-semibold text-info-muted-foreground mb-3">
                                        Resumen de Ventas por Categoría
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Viguetas */}
                                        {summary?.viguetas && (summary.viguetas.total_units_sold > 0 || summary.viguetas.total_meters_sold > 0) && (
                                            <div className="bg-card p-3 rounded-md border border-info-muted">
                                                <div className="mb-2">
                                                    <span className="font-semibold text-info-muted-foreground">Viguetas</span>
                                                </div>
                                                <div className="text-sm space-y-1">
                                                    <div className="text-foreground">
                                                        <span className="font-medium">Unidades vendidas:</span> {summary.viguetas.total_units_sold.toLocaleString('es-AR')}
                                                    </div>
                                                    {summary.viguetas.total_meters_sold > 0 && (
                                                        <div className="text-foreground">
                                                            <span className="font-medium">Metros vendidos:</span> {formatNumber(summary.viguetas.total_meters_sold, 2)} m
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Bloques */}
                                        {summary?.bloques && summary.bloques.total_units_sold > 0 && (
                                            <div className="bg-card p-3 rounded-md border border-border">
                                                <div className="mb-2">
                                                    <span className="font-semibold text-foreground">Bloques</span>
                                                </div>
                                                <div className="text-sm">
                                                    <div className="text-foreground">
                                                        <span className="font-medium">Unidades vendidas:</span> {summary.bloques.total_units_sold.toLocaleString('es-AR')}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Adoquines */}
                                        {summary?.adoquines && (summary.adoquines.total_units_sold > 0 || summary.adoquines.total_m2_sold > 0) && (
                                            <div className="bg-card p-3 rounded-md border border-warning-muted">
                                                <div className="mb-2">
                                                    <span className="font-semibold text-warning-muted-foreground">Adoquines</span>
                                                </div>
                                                <div className="text-sm space-y-1">
                                                    <div className="text-foreground">
                                                        <span className="font-medium">Unidades vendidas:</span> {summary.adoquines.total_units_sold.toLocaleString('es-AR')}
                                                    </div>
                                                    {summary.adoquines.total_m2_sold > 0 && (
                                                        <div className="text-foreground">
                                                            <span className="font-medium">Metros cuadrados vendidos:</span> {formatNumber(summary.adoquines.total_m2_sold, 2)} m²
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                                <div className="max-h-[600px] overflow-y-auto px-6 pb-6">
                                    <div className="space-y-4">
                                        {filteredProducts.map((product) => (
                                            <ProductCostCard
                                                key={product.id}
                                                product={product}
                                                expanded={expandedProducts.has(product.id)}
                                                onToggleExpand={() => toggleProductExpansion(product.id)}
                                                showProductionInfo={false}
                                                simulationEscenarios={[]}
                                                simulationEstadisticas={null}
                                                isSimulationMode={false}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab Por Producción */}
                <TabsContent value="produccion" className="space-y-4">
                    {/* Botón de Simulación */}
                    <Card className={isSimulationMode ? "border-2 border-info bg-info-muted" : ""}>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Play className="h-5 w-5" />
                                    Modo Simulación
                                </div>
                                <div className="flex gap-2">
                                    {isSimulationMode && (
                                        <>
                                        <Button
                                            onClick={exportSimulationToExcel}
                                            variant="outline"
                                            size="sm"
                                            className="bg-success-muted hover:bg-success-muted text-success border-success-muted"
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            Descargar Excel
                                        </Button>
                                            <Button
                                                type="button"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  setIsComparisonsDialogOpen(true);
                                                }}
                                                variant="outline"
                                                size="sm"
                                                className="bg-info-muted hover:bg-info-muted text-info-muted-foreground border-info-muted"
                                            >
                                                <BarChart2 className="h-4 w-4 mr-2" />
                                                Comparativas
                                            </Button>
                                        </>
                                    )}
                                    <Button
                                        onClick={toggleSimulationMode}
                                        variant={isSimulationMode ? "default" : "outline"}
                                        size="sm"
                                        className={isSimulationMode ? "bg-info hover:bg-info/90" : ""}
                                    >
                                        {isSimulationMode ? 'Desactivar' : 'Activar Simulación'}
                                    </Button>
                                </div>
                            </CardTitle>
                            <CardDescription>
                                {isSimulationMode 
                                    ? 'Introduce cantidades de producción ficticias para simular la distribución de costos'
                                    : 'Activa el modo simulación para introducir cantidades personalizadas'}
                            </CardDescription>
                        </CardHeader>
                        {isSimulationMode && (
                            <CardContent className="space-y-4">
                                {/* Configuración por categoría con modo mixto */}
                                <div className="space-y-3">
                                    <Label className="font-semibold">Configuración por Categoría:</Label>
                                    {categories.map(category => {
                                        const isVigueta = category.toLowerCase().includes('vigueta');
                                        const isAdoquin = category.toLowerCase().includes('adoquin');
                                        const isBloques = category.toLowerCase().includes('bloque');
                                        const productsInCategory = productionPrices.filter(p => p.category_name === category);
                                        const currentQty = categoryQuantities[category] || 0;
                                        const mode = categoryConfigMode[category] || 'total';
                                        
                                        return (
                                            <div key={category} className="border rounded-lg p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <div className="font-semibold">{category}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {productsInCategory.length} productos
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            onClick={() => toggleCategoryConfigMode(category)}
                                                            variant={mode === 'total' ? 'default' : 'outline'}
                                                            size="sm"
                                                        >
                                                            {mode === 'total' ? 'Por Total' : 'Individual'}
                                                        </Button>
                                                    </div>
                                                </div>
                                                
                                                {mode === 'total' ? (
                                                    isBloques ? (
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                value={(categoryPlacas[category] || 0) === 0 ? '' : (categoryPlacas[category] || 0)}
                                                                onChange={(e) => {
                                                                    const placas = parseInt(e.target.value) || 0;
                                                                    const dias = categoryDias[category] || 22;
                                                                    setCategoryPlacas(prev => ({
                                                                        ...prev,
                                                                        [category]: placas
                                                                    }));
                                                                    // Calcular unidades totales para todos los productos de Bloques
                                                                    const newQuantities = { ...simulatedQuantities };
                                                                    productsInCategory.forEach(product => {
                                                                        const unidadesPorPlaca = product.units_per_item || 1;
                                                                        const totalUnidades = placas > 0 ? placas * dias * unidadesPorPlaca : 0;
                                                                        newQuantities[product.id] = totalUnidades;
                                                                        // Guardar también las claves auxiliares para que runSimulation las detecte
                                                                        if (placas > 0) {
                                                                            newQuantities[`${product.id}_placas`] = placas;
                                                                            newQuantities[`${product.id}_dias`] = dias;
                                                                        } else {
                                                                            delete newQuantities[`${product.id}_placas`];
                                                                            delete newQuantities[`${product.id}_dias`];
                                                                        }
                                                                    });
                                                                    setSimulatedQuantities(newQuantities);
                                                                }}
                                                                className="flex-1 text-right"
                                                                placeholder="0"
                                                            />
                                                            <span className="text-sm font-medium min-w-16">placas</span>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                value={categoryDias[category] || 22}
                                                                onChange={(e) => {
                                                                    const dias = parseInt(e.target.value) || 22;
                                                                    const placas = categoryPlacas[category] || 0;
                                                                    setCategoryDias(prev => ({
                                                                        ...prev,
                                                                        [category]: dias
                                                                    }));
                                                                    // Calcular unidades totales para todos los productos de Bloques
                                                                    const newQuantities = { ...simulatedQuantities };
                                                                    productsInCategory.forEach(product => {
                                                                        const unidadesPorPlaca = product.units_per_item || 1;
                                                                        const totalUnidades = placas > 0 ? placas * dias * unidadesPorPlaca : 0;
                                                                        newQuantities[product.id] = totalUnidades;
                                                                        // Guardar también las claves auxiliares para que runSimulation las detecte
                                                                        if (placas > 0) {
                                                                            newQuantities[`${product.id}_placas`] = placas;
                                                                            newQuantities[`${product.id}_dias`] = dias;
                                                                        } else {
                                                                            delete newQuantities[`${product.id}_placas`];
                                                                            delete newQuantities[`${product.id}_dias`];
                                                                        }
                                                                    });
                                                                    setSimulatedQuantities(newQuantities);
                                                                }}
                                                                className="flex-1 text-right"
                                                                placeholder="22"
                                                            />
                                                            <span className="text-sm font-medium min-w-16">días</span>
                                                        </div>
                                                    ) : isVigueta ? (
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                value={(categoryBancos[category] || 0) === 0 ? '' : (categoryBancos[category] || 0)}
                                                                onChange={(e) => {
                                                                    const bancos = parseInt(e.target.value) || 0;
                                                                    const dias = categoryDiasViguetas[category] || 22;
                                                                    const metrosUtilesPorBanco = 1300;
                                                                    setCategoryBancos(prev => ({
                                                                        ...prev,
                                                                        [category]: bancos
                                                                    }));
                                                                    // Calcular unidades totales para todos los productos de Viguetas
                                                                    const newQuantities = { ...simulatedQuantities };
                                                                    productsInCategory.forEach(product => {
                                                                        // Extraer longitud de la vigueta
                                                                        const lengthMatch = product.product_name.match(/(\d+\.?\d*)\s*(m|mts|metros?)/i);
                                                                        const longitudVigueta = lengthMatch ? parseFloat(lengthMatch[1]) : 1;
                                                                        // Calcular metros totales y luego unidades
                                                                        const metrosTotales = bancos > 0 ? bancos * dias * metrosUtilesPorBanco : 0;
                                                                        const totalUnidades = longitudVigueta > 0 ? Math.floor(metrosTotales / longitudVigueta) : 0;
                                                                        newQuantities[product.id] = totalUnidades;
                                                                        // Guardar también las claves auxiliares para que runSimulation las detecte
                                                                        if (bancos > 0) {
                                                                            newQuantities[`${product.id}_bancos`] = bancos;
                                                                            newQuantities[`${product.id}_dias_vigueta`] = dias;
                                                                            newQuantities[`_metros_${product.id}`] = metrosTotales;
                                                                        } else {
                                                                            delete newQuantities[`${product.id}_bancos`];
                                                                            delete newQuantities[`${product.id}_dias_vigueta`];
                                                                            delete newQuantities[`_metros_${product.id}`];
                                                                        }
                                                                    });
                                                                    setSimulatedQuantities(newQuantities);
                                                                }}
                                                                className="flex-1 text-right"
                                                                placeholder="0"
                                                            />
                                                            <span className="text-sm font-medium min-w-16">bancos</span>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                value={categoryDiasViguetas[category] || 22}
                                                                onChange={(e) => {
                                                                    const dias = parseInt(e.target.value) || 22;
                                                                    const bancos = categoryBancos[category] || 0;
                                                                    const metrosUtilesPorBanco = 1300;
                                                                    setCategoryDiasViguetas(prev => ({
                                                                        ...prev,
                                                                        [category]: dias
                                                                    }));
                                                                    // Calcular unidades totales para todos los productos de Viguetas
                                                                    const newQuantities = { ...simulatedQuantities };
                                                                    productsInCategory.forEach(product => {
                                                                        // Extraer longitud de la vigueta
                                                                        const lengthMatch = product.product_name.match(/(\d+\.?\d*)\s*(m|mts|metros?)/i);
                                                                        const longitudVigueta = lengthMatch ? parseFloat(lengthMatch[1]) : 1;
                                                                        // Calcular metros totales y luego unidades
                                                                        const metrosTotales = bancos > 0 ? bancos * dias * metrosUtilesPorBanco : 0;
                                                                        const totalUnidades = longitudVigueta > 0 ? Math.floor(metrosTotales / longitudVigueta) : 0;
                                                                        newQuantities[product.id] = totalUnidades;
                                                                        // Guardar también las claves auxiliares para que runSimulation las detecte
                                                                        if (bancos > 0) {
                                                                            newQuantities[`${product.id}_bancos`] = bancos;
                                                                            newQuantities[`${product.id}_dias_vigueta`] = dias;
                                                                            newQuantities[`_metros_${product.id}`] = metrosTotales;
                                                                        } else {
                                                                            delete newQuantities[`${product.id}_bancos`];
                                                                            delete newQuantities[`${product.id}_dias_vigueta`];
                                                                            delete newQuantities[`_metros_${product.id}`];
                                                                        }
                                                                    });
                                                                    setSimulatedQuantities(newQuantities);
                                                                }}
                                                                className="flex-1 text-right"
                                                                placeholder="22"
                                                            />
                                                            <span className="text-sm font-medium min-w-16">días</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                value={currentQty === 0 ? '' : currentQty}
                                                                onChange={(e) => updateCategoryQuantity(category, parseInt(e.target.value) || 0)}
                                                                className="w-full text-right"
                                                                placeholder="0"
                                                            />
                                                            <span className="text-sm font-medium min-w-20">
                                                                {isAdoquin ? 'm²' : 'unidades'}
                                                            </span>
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="space-y-1 max-h-48 overflow-y-auto">
                                                        {productsInCategory.map(product => {
                                                            const isBloques = category.toLowerCase().includes('bloque');
                                                            const isAdoquinProduct = category.toLowerCase().includes('adoquin');
                                                            const isViguetaProduct = category.toLowerCase().includes('vigueta');
                                                            return (
                                                                <div key={product.id} className="flex items-center gap-2 text-sm">
                                                                    <span className="flex-1 truncate">{product.product_name}</span>
                                                                    {isBloques ? (
                                                                        <>
                                                                            <div className="flex flex-col gap-1">
                                                                                <div className="flex items-center gap-1">
                                                                                    <Input
                                                                                        type="number"
                                                                                        min="0"
                                                                                        value={(simulatedQuantities[`${product.id}_placas`] || 0) === 0 ? '' : (simulatedQuantities[`${product.id}_placas`] || 0)}
                                                                        onChange={(e) => {
                                                                            const placas = parseInt(e.target.value) || 0;
                                                                            const dias = simulatedQuantities[`${product.id}_dias`] || 22;
                                                                            const unidadesPorPlaca = product.units_per_item || 1;
                                                                            log(`🔍 DEBUG ${product.product_name}:`, {
                                                                                placas,
                                                                                dias,
                                                                                units_per_item: product.units_per_item,
                                                                                unidadesPorPlaca,
                                                                                intermediate_quantity: product.intermediate_quantity,
                                                                                output_quantity: product.output_quantity
                                                                            });
                                                                            
                                                                            // Solo calcular si placas > 0
                                                                            const totalUnidades = placas > 0 ? placas * dias * unidadesPorPlaca : 0;
                                                                            log(`📦 ${product.product_name}: ${placas} placas × ${dias} días × ${unidadesPorPlaca} unid/placa = ${totalUnidades} unidades`);
                                                                            updateSimulatedQuantity(product.id, totalUnidades);
                                                                            setSimulatedQuantities(prev => ({
                                                                                ...prev,
                                                                                [`${product.id}_placas`]: placas,
                                                                                [`${product.id}_dias`]: placas > 0 ? dias : 0
                                                                            }));
                                                                        }}
                                                                                        className="w-16 text-right h-7 text-xs"
                                                                                        placeholder="0"
                                                                                    />
                                                                                    <span className="text-xs text-muted-foreground">placas</span>
                                                                                    <span className="text-xs text-muted-foreground">×</span>
                                                                                    <Input
                                                                                        type="number"
                                                                                        min="0"
                                                                                        value={simulatedQuantities[`${product.id}_dias`] || 22}
                                                                        onChange={(e) => {
                                                                            const dias = parseInt(e.target.value) || 22;
                                                                            const placas = simulatedQuantities[`${product.id}_placas`] || 0;
                                                                            const unidadesPorPlaca = product.units_per_item || 1;
                                                                            
                                                                            // Solo calcular si placas > 0
                                                                            const totalUnidades = placas > 0 ? placas * dias * unidadesPorPlaca : 0;
                                                                            log(`📦 ${product.product_name}: ${placas} placas × ${dias} días × ${unidadesPorPlaca} unid/placa = ${totalUnidades} unidades`);
                                                                            updateSimulatedQuantity(product.id, totalUnidades);
                                                                            setSimulatedQuantities(prev => ({
                                                                                ...prev,
                                                                                [`${product.id}_dias`]: placas > 0 ? dias : 0
                                                                            }));
                                                                        }}
                                                                                        className="w-16 text-right h-7 text-xs"
                                                                                        placeholder="22"
                                                                                    />
                                                                                    <span className="text-xs text-muted-foreground">días</span>
                                                                                </div>
                                                                                <div className="text-xs text-muted-foreground text-right">
                                                                                    = {(simulatedQuantities[product.id] || 0).toLocaleString()} unid.
                                                                                    {product.units_per_item > 1 && (
                                                                                        <span className="text-muted-foreground ml-1">
                                                                                            ({product.units_per_item} unid/placa)
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </>
                                                                    ) : isAdoquinProduct ? (
                                                                        <>
                                                                            <div className="flex flex-col gap-1">
                                                                                <div className="flex items-center gap-1">
                                                                                    <Input
                                                                                        type="number"
                                                                                        min="0"
                                                                                        value={(simulatedQuantities[`${product.id}_m2`] || 0) === 0 ? '' : (simulatedQuantities[`${product.id}_m2`] || 0)}
                                                                                        onChange={(e) => {
                                                                                            const m2 = parseFloat(e.target.value) || 0;
                                                                                            // Determinar unidades por m² según el tipo de adoquín
                                                                                            let unidadesPorM2 = 39.5; // Holanda por defecto
                                                                                            if (product.product_name.toLowerCase().includes('unistone')) {
                                                                                                unidadesPorM2 = 41.35;
                                                                                            }
                                                                                            const totalUnidades = Math.round(m2 * unidadesPorM2);
                                                                                            log(`🔍 ${product.product_name}: ${m2} m² × ${unidadesPorM2} unid/m² = ${totalUnidades} unidades`);
                                                                                            updateSimulatedQuantity(product.id, totalUnidades);
                                                                                            setSimulatedQuantities(prev => ({
                                                                                                ...prev,
                                                                                                [`${product.id}_m2`]: m2
                                                                                            }));
                                                                                        }}
                                                                                        className="w-20 text-right h-7 text-xs"
                                                                                        placeholder="0"
                                                                                    />
                                                                                    <span className="text-xs text-muted-foreground">m²</span>
                                                                                </div>
                                                                                <div className="text-xs text-muted-foreground text-right">
                                                                                    = {(simulatedQuantities[product.id] || 0).toLocaleString()} unid.
                                                                                    <span className="text-muted-foreground ml-1">
                                                                                        ({product.product_name.toLowerCase().includes('unistone') ? '41.35' : '39.5'} unid/m²)
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </>
                                                                    ) : isViguetaProduct ? (
                                                                        <>
                                                                            <div className="flex flex-col gap-1">
                                                                                <div className="flex items-center gap-1">
                                                                                    <Input
                                                                                        type="number"
                                                                                        min="0"
                                                                                        value={(simulatedQuantities[`${product.id}_bancos`] || 0) === 0 ? '' : (simulatedQuantities[`${product.id}_bancos`] || 0)}
                                                                                        onChange={(e) => {
                                                                                            const bancos = parseInt(e.target.value) || 0;
                                                                                            const dias = simulatedQuantities[`${product.id}_dias_vigueta`] || 22;
                                                                                            const metrosUtilesPorBanco = 1300;
                                                                                            // Extraer longitud de la vigueta
                                                                                            const lengthMatch = product.product_name.match(/(\d+\.?\d*)\s*(m|mts|metros?)/i);
                                                                                            const longitudVigueta = lengthMatch ? parseFloat(lengthMatch[1]) : 1;
                                                                                            // Calcular metros totales y luego unidades
                                                                            const metrosTotales = bancos * dias * metrosUtilesPorBanco;
                                                                            const totalUnidades = longitudVigueta > 0 ? Math.floor(metrosTotales / longitudVigueta) : 0;
                                                                            log(`🏗️ ${product.product_name}: ${bancos} bancos × ${dias} días × ${metrosUtilesPorBanco} m/banco = ${metrosTotales} metros → ${totalUnidades} unidades (${longitudVigueta}m c/u)`);
                                                                            updateSimulatedQuantity(product.id, totalUnidades);
                                                                            setSimulatedQuantities(prev => ({
                                                                                ...prev,
                                                                                [`${product.id}_bancos`]: bancos,
                                                                                [`${product.id}_dias_vigueta`]: dias,
                                                                                [`_metros_${product.id}`]: metrosTotales
                                                                            }));
                                                                                        }}
                                                                                        className="w-16 text-right h-7 text-xs"
                                                                                        placeholder="0"
                                                                                    />
                                                                                    <span className="text-xs text-muted-foreground">bancos</span>
                                                                                    <span className="text-xs text-muted-foreground">×</span>
                                                                                    <Input
                                                                                        type="number"
                                                                                        min="0"
                                                                                        value={simulatedQuantities[`${product.id}_dias_vigueta`] || 22}
                                                                                        onChange={(e) => {
                                                                                            const dias = parseInt(e.target.value) || 22;
                                                                                            const bancos = simulatedQuantities[`${product.id}_bancos`] || 0;
                                                                                            const metrosUtilesPorBanco = 1300;
                                                                                            const lengthMatch = product.product_name.match(/(\d+\.?\d*)\s*(m|mts|metros?)/i);
                                                                                            const longitudVigueta = lengthMatch ? parseFloat(lengthMatch[1]) : 1;
                                                                            const metrosTotales = bancos * dias * metrosUtilesPorBanco;
                                                                            const totalUnidades = longitudVigueta > 0 ? Math.floor(metrosTotales / longitudVigueta) : 0;
                                                                            log(`🏗️ ${product.product_name}: ${bancos} bancos × ${dias} días × ${metrosUtilesPorBanco} m/banco = ${metrosTotales} metros → ${totalUnidades} unidades (${longitudVigueta}m c/u)`);
                                                                            updateSimulatedQuantity(product.id, totalUnidades);
                                                                            setSimulatedQuantities(prev => ({
                                                                                ...prev,
                                                                                [`${product.id}_dias_vigueta`]: dias,
                                                                                [`_metros_${product.id}`]: metrosTotales
                                                                            }));
                                                                                        }}
                                                                                        className="w-16 text-right h-7 text-xs"
                                                                                        placeholder="22"
                                                                                    />
                                                                                    <span className="text-xs text-muted-foreground">días</span>
                                                                                </div>
                                                                                <div className="text-xs text-muted-foreground text-right">
                                                                                    = {(simulatedQuantities[`_metros_${product.id}`] || 0).toLocaleString()} m → {(simulatedQuantities[product.id] || 0).toLocaleString()} unid.
                                                                                </div>
                                                                            </div>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Input
                                                                                type="number"
                                                                                min="0"
                                                                                value={(simulatedQuantities[product.id] || 0) === 0 ? '' : (simulatedQuantities[product.id] || 0)}
                                                                                onChange={(e) => updateSimulatedQuantity(product.id, parseInt(e.target.value) || 0)}
                                                                                className="w-24 text-right h-8"
                                                                                placeholder="0"
                                                                            />
                                                                            <span className="text-xs text-muted-foreground min-w-12">unid.</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Resumen de costos distribuidos por categoría - OCULTO pero activo */}
                                <div style={{ display: 'none' }}>
                                    {(() => {
                                        // Calcular costos distribuidos por categoría (mantener lógica activa)
                                        const categoryCosts: { [key: string]: { indirect: number; employee: number } } = {};
                                        
                                        const productsToUse = simulationResults.length > 0 ? simulationResults : productionPrices;
                                        
                                        productsToUse.forEach((p: ProductPrice) => {
                                            const category = p.category_name || 'Otros';
                                            const categoryLower = category.toLowerCase();
                                            
                                            let categoryKey = 'Otros';
                                            if (categoryLower.includes('adoquin')) {
                                                categoryKey = 'Adoquines';
                                            } else if (categoryLower.includes('bloque')) {
                                                categoryKey = 'Bloques';
                                            } else if (categoryLower.includes('vigueta')) {
                                                categoryKey = 'Viguetas';
                                                        }
                                            
                                            if (!categoryCosts[categoryKey]) {
                                                categoryCosts[categoryKey] = { indirect: 0, employee: 0 };
                                            }
                                            
                                            if (p.production_info?.distributed_indirect_costs !== undefined) {
                                                categoryCosts[categoryKey].indirect += p.production_info.distributed_indirect_costs || 0;
                                            }
                                            
                                            if (p.production_info?.distributed_employee_costs !== undefined) {
                                                categoryCosts[categoryKey].employee += p.production_info.distributed_employee_costs || 0;
                                            }
                                        });
                                        
                                        return null;
                                    })()}
                                </div>

                                {/* Botones de acción */}
                                <div className="flex items-center gap-2 pt-2 border-t">
                                    <Button
                                        onClick={fillWithExampleQuantities}
                                        variant="outline"
                                        size="sm"
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Llenar Ejemplo
                                    </Button>
                                    <Button
                                        onClick={runSimulation}
                                        disabled={loading || Object.values(simulatedQuantities).reduce((sum, qty) => sum + qty, 0) === 0}
                                        className="bg-success hover:bg-success/90"
                                        size="sm"
                                    >
                                        <Calculator className="h-4 w-4 mr-2" />
                                        Calcular Costos
                                    </Button>
                                    {simulationResults.length > 0 && (
                                        <Button
                                            onClick={() => setSimulationResults([])}
                                            variant="outline"
                                            size="sm"
                                        >
                                            Limpiar Resultados
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        )}
                    </Card>

                    {/* Filtros */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Package className="h-5 w-5" />
                                Calculadora por Producción
                            </CardTitle>
                            <CardDescription>
                                {isSimulationMode && simulationResults.length === 0
                                    ? 'Introduce cantidades de producción para cada producto'
                                    : (isSimulationMode && simulationResults.length > 0
                                        ? 'Resultados de la simulación - Costos calculados con cantidades introducidas'
                                        : 'Costos calculados basándose en las unidades producidas reales')}
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
                                    {!isSimulationMode && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={loadProductionPricesSimple}
                                        disabled={loading}
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Actualizar
                                    </Button>
                                    )}
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
                            <CardTitle className="text-lg">
                                {isSimulationMode && simulationResults.length === 0
                                    ? 'Configurar Cantidades de Producción'
                                    : 'Productos y Costos por Producción'}
                            </CardTitle>
                            <CardDescription>
                                {isSimulationMode && simulationResults.length === 0
                                    ? 'Introduce la cantidad de producción para cada producto que desees simular'
                                    : (isSimulationMode && simulationResults.length > 0
                                        ? `${filteredProducts.length} productos simulados - Distribución por % del total general`
                                        : `${filteredProducts.length} productos encontrados - Costos distribuidos según producción real`)}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {/* Cartel de resumen por categoría - Mostrando costos distribuidos por producto */}
                            {(() => {
                                // Agrupar productos por categoría con sus costos distribuidos
                                const categoryProducts: { [key: string]: Array<{ name: string; indirect: number; employee: number; total: number }> } = {};
                                
                                const productsToUse = simulationResults.length > 0 ? simulationResults : productionPrices;
                                
                                productsToUse.forEach((p: ProductPrice) => {
                                    const category = p.category_name || 'Otros';
                                    const categoryLower = category.toLowerCase();
                                    
                                    let categoryKey = 'Otros';
                                    if (categoryLower.includes('adoquin')) {
                                        categoryKey = 'Adoquines';
                                    } else if (categoryLower.includes('bloque')) {
                                        categoryKey = 'Bloques';
                                    } else if (categoryLower.includes('vigueta')) {
                                        categoryKey = 'Viguetas';
                                    }
                                    
                                    // Calcular costos distribuidos
                                    let indirect = 0;
                                    let employee = 0;
                                    
                                    // Si tiene production_info con distributed costs, usarlos
                                    if (p.production_info?.distributed_indirect_costs !== undefined) {
                                        indirect = p.production_info.distributed_indirect_costs || 0;
                                    } else {
                                        // Calcular basado en cost_breakdown y cantidad
                                        const qty = simulatedQuantities[p.id] || 0;
                                        const indirectPerUnit = p.cost_breakdown?.indirect_costs || 0;
                                        const isVigueta = categoryLower.includes('vigueta');
                                        
                                        if (isVigueta && qty > 0) {
                                            // Para viguetas, indirectPerUnit es por metro
                                            const lengthMatch = p.product_name.match(/(\d+\.?\d*)\s*(m|mts|metros?)/i);
                                            const productLength = lengthMatch ? parseFloat(lengthMatch[1]) : 1;
                                            const totalMeters = productLength * qty;
                                            indirect = indirectPerUnit * totalMeters;
                                        } else if (qty > 0) {
                                            indirect = indirectPerUnit * qty;
                                        }
                                    }
                                    
                                    if (p.production_info?.distributed_employee_costs !== undefined) {
                                        employee = p.production_info.distributed_employee_costs || 0;
                                    } else {
                                        // Calcular basado en cost_breakdown y cantidad
                                        const qty = simulatedQuantities[p.id] || 0;
                                        const employeePerUnit = p.cost_breakdown?.employee_costs || 0;
                                        const isVigueta = categoryLower.includes('vigueta');
                                        
                                        if (isVigueta && qty > 0) {
                                            // Para viguetas, employeePerUnit es por metro
                                            const lengthMatch = p.product_name.match(/(\d+\.?\d*)\s*(m|mts|metros?)/i);
                                            const productLength = lengthMatch ? parseFloat(lengthMatch[1]) : 1;
                                            const totalMeters = productLength * qty;
                                            employee = employeePerUnit * totalMeters;
                                        } else if (qty > 0) {
                                            employee = employeePerUnit * qty;
                                        }
                                    }
                                    
                                    // Solo incluir productos que tengan costos > 0
                                    // Y solo mostrar vigueta de 1 metro
                                    const isVigueta1m = p.product_name.toLowerCase().includes('vigueta') && 
                                                       (p.product_name.includes('1.00') || p.product_name.includes('1.0 m') || p.product_name.includes('1 mts'));
                                    
                                    if ((indirect > 0 || employee > 0) && isVigueta1m) {
                                        if (!categoryProducts[categoryKey]) {
                                            categoryProducts[categoryKey] = [];
                                        }
                                        
                                        categoryProducts[categoryKey].push({
                                            name: p.product_name,
                                            indirect: indirect,
                                            employee: employee,
                                            total: indirect + employee
                                        });
                                    }
                                });
                                
                                const categoriesToShow = ['Adoquines', 'Bloques', 'Viguetas'].filter(cat => 
                                    categoryProducts[cat] && categoryProducts[cat].length > 0
                                );
                                
                                if (categoriesToShow.length === 0) return null;
                                
                                return (
                                <div className="mb-6 p-4 bg-gradient-to-r from-info-muted to-info-muted rounded-lg border border-info-muted">
                                    <h3 className="text-sm font-semibold text-info-muted-foreground mb-3">
                                            Distribución de Costos por Categoría
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {categoriesToShow.map((categoryKey) => {
                                                const products = categoryProducts[categoryKey];
                                                const totalIndirect = products.reduce((sum, p) => sum + p.indirect, 0);
                                                const totalEmployee = products.reduce((sum, p) => sum + p.employee, 0);
                                                const total = totalIndirect + totalEmployee;
                                                
                                                const bgColors: { [key: string]: string } = {
                                                    'Adoquines': 'bg-card border-warning-muted',
                                                    'Bloques': 'bg-card border-border',
                                                    'Viguetas': 'bg-card border-info-muted'
                                                };
                                                const textColors: { [key: string]: string } = {
                                                    'Adoquines': 'text-warning-muted-foreground',
                                                    'Bloques': 'text-foreground',
                                                    'Viguetas': 'text-info-muted-foreground'
                                                };
                                                
                                                return (
                                                    <div key={categoryKey} className={cn('p-3 rounded-md border', bgColors[categoryKey] || 'bg-card border-border')}>
                                                        <div className="mb-3 flex items-center justify-between">
                                                            <span className={cn('font-semibold', textColors[categoryKey] || 'text-foreground')}>
                                                                {categoryKey}
                                                            </span>
                                                            <Badge variant="secondary" className="text-[9px] h-4 px-1 py-0">
                                                                {products.length} configs
                                                            </Badge>
                                                </div>
                                                        
                                                        {/* Lista de productos - Solo mostrar costos sin nombre */}
                                                        <div className="space-y-2 mb-3">
                                                            {products.map((product, idx) => (
                                                                <div key={idx} className="text-xs">
                                                                    <div className="space-y-0.5">
                                                                        <div className="flex justify-between text-muted-foreground">
                                                                            <span>Indirectos:</span>
                                                                            <span className="font-medium">{formatCurrency(product.indirect)}</span>
                                                </div>
                                                                        <div className="flex justify-between text-muted-foreground">
                                                                            <span>Empleados:</span>
                                                                            <span className="font-medium">{formatCurrency(product.employee)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                                            ))}
                                                        </div>
                                                        
                                                        {/* Total de la categoría */}
                                                        <div className="pt-2 border-t-2 border-border">
                                                            <div className="flex justify-between text-sm">
                                                                <span className="font-semibold text-foreground">Total Categoría:</span>
                                                                <span className="font-bold text-success">
                                                                    {formatCurrency(total)}
                                                                </span>
                                                </div>
                                                    </div>
                                                        </div>
                                                );
                                            })}
                                                </div>
                                            </div>
                                );
                            })()}
                            
                            {/* Estadísticas de variaciones de cuartos (oculto en modo simulador) */}
                            {false && isSimulationMode && simulationEscenarios.length > 0 && simulationEstadisticas && (
                                <div className="mb-6 p-4 bg-gradient-to-r from-success-muted to-success-muted rounded-lg border border-success-muted">
                                    <h3 className="text-sm font-semibold text-success mb-3">
                                        📊 Variaciones de Cuartos de Curado
                                    </h3>
                                    <div className="mb-3 text-sm text-foreground">
                                        <span className="font-medium">Placas actuales:</span> {simulationEstadisticas.placasActuales.toLocaleString('es-AR')} 
                                        <span className="ml-2">({formatNumber(simulationEstadisticas.cuartosActuales, 2)} cuartos)</span>
                                        <span className="ml-2 text-xs text-muted-foreground">1 cuarto = 240 placas</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                        {simulationEscenarios.map((escenario, index) => {
                                            if (escenario.variacionCuartos === 0) return null; // Saltar el actual en la lista
                                            
                                            const resultado = escenario.resultado;
                                            const totalCostos = resultado?.summary?.total_costs || 0;
                                            const costoActual = simulationEscenarios.find(e => e.variacionCuartos === 0)?.resultado?.summary?.total_costs || 0;
                                            const diferencia = totalCostos - costoActual;
                                            const porcentajeCambio = costoActual > 0 ? ((diferencia / costoActual) * 100) : 0;
                                            
                                            return (
                                                <div 
                                                    key={index} 
                                                    className={cn('bg-card p-3 rounded-md border',
                                                        escenario.variacionCuartos < 0
                                                            ? 'border-info-muted'
                                                            : 'border-warning-muted'
                                                    )}
                                                >
                                                    <div className="mb-2">
                                                        <span className={cn('font-semibold text-sm',
                                                            escenario.variacionCuartos < 0
                                                                ? 'text-info-muted-foreground'
                                                                : 'text-warning-muted-foreground'
                                                        )}>
                                                            {escenario.nombre}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs space-y-1 text-foreground">
                                                        <div>
                                                            <span className="font-medium">Placas:</span> {escenario.placas.toLocaleString('es-AR')}
                                                        </div>
                                                        <div>
                                                            <span className="font-medium">Cuartos:</span> {formatNumber(escenario.cuartos, 2)}
                                                        </div>
                                                        <div className="pt-1 border-t border-border">
                                                            <span className="font-medium">Costo Total:</span> ${totalCostos.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                        {costoActual > 0 && (
                                                            <div className={cn('text-xs',
                                                                diferencia < 0 ? 'text-success' : diferencia > 0 ? 'text-destructive' : ''
                                                            )}>
                                                                {diferencia < 0 ? '↓' : diferencia > 0 ? '↑' : ''} 
                                                                {formatNumber(Math.abs(porcentajeCambio), 1)}% 
                                                                ({diferencia < 0 ? '-' : '+'}${Math.abs(diferencia).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : isSimulationMode && simulationResults.length === 0 ? (
                                // MODO SIMULACIÓN: Mensaje informativo
                                <div className="text-center py-8 text-muted-foreground">
                                    <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p className="font-medium">Configura las cantidades arriba</p>
                                    <p className="text-sm">Haz clic en &quot;Calcular Costos&quot; para ver los resultados</p>
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
                                <div className="max-h-[600px] overflow-y-auto px-6 pb-6">
                                    <div className="space-y-4">
                                        {filteredProducts.map((product) => (
                                            <ProductCostCard
                                                key={product.id}
                                                product={product}
                                                expanded={expandedProducts.has(product.id)}
                                                onToggleExpand={() => toggleProductExpansion(product.id)}
                                                showProductionInfo={true}
                                                simulationEscenarios={isSimulationMode ? simulationEscenarios : []}
                                                simulationEstadisticas={isSimulationMode ? simulationEstadisticas : null}
                                                isSimulationMode={isSimulationMode}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>


                {/* Tab Comparativa de Meses */}
                <TabsContent value="comparativo" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" />
                                Comparativa de Meses
                            </CardTitle>
                            <CardDescription>
                                Compara costos entre diferentes meses seleccionados
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {/* Selector de meses mejorado */}
                                <div className="space-y-4">
                                <div>
                                    <Label className="text-base font-semibold">Seleccionar Meses para Comparar</Label>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                                        {availableMonths.map(month => (
                                            <div 
                                                key={month} 
                                                className={cn('relative flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer',
                                                    selectedMonths.includes(month)
                                                        ? 'border-info bg-info-muted shadow-md'
                                                        : 'border-border hover:border-border hover:bg-accent'
                                                )}
                                                onClick={() => toggleMonthSelection(month)}
                                            >
                                                <div className={cn('w-5 h-5 rounded border-2 flex items-center justify-center',
                                                    selectedMonths.includes(month)
                                                        ? 'border-info bg-info'
                                                        : 'border-border'
                                                )}>
                                                    {selectedMonths.includes(month) && (
                                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                            </div>
                                                <div className="flex-1">
                                                    <div className="font-medium text-sm">{formatMonthShort(month)}</div>
                                                    <div className="text-xs text-muted-foreground">{formatMonthLabel(month)}</div>
                                        </div>
                                    </div>
                                        ))}
                                </div>
                                    <div className="mt-2 text-sm text-muted-foreground">
                                        {selectedMonths.length} mes{selectedMonths.length !== 1 ? 'es' : ''} seleccionado{selectedMonths.length !== 1 ? 's' : ''}
                                            </div>
                                        </div>

                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <Label htmlFor="category-filter-comparison">Categoría</Label>
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
                                        <Button
                                            onClick={loadComparisonData}
                                            disabled={loading || selectedMonths.length === 0}
                                            className="bg-info hover:bg-info/90 text-white"
                                            size="sm"
                                        >
                                            {loading ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <RefreshCw className="h-4 w-4 mr-2" />
                                            )}
                                            {loading ? 'Cargando...' : 'Cargar Comparativa'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Resultados de comparativa */}
                    {Object.keys(comparisonData).length > 0 ? (
                                <div className="space-y-4">
                            {/* Resumen por mes */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {selectedMonths.map(month => {
                                    const monthData = comparisonData[month] || [];
                                    const filteredMonthData = selectedCategory === 'all' 
                                        ? monthData 
                                        : (Array.isArray(monthData) ? monthData.filter(p => p.category_name === selectedCategory) : []);
                                    
                                    const totalCosts = Array.isArray(filteredMonthData) ? filteredMonthData.reduce((sum, p) => sum + (p.calculated_cost || 0), 0) : 0;
                                    const totalIndirect = Array.isArray(filteredMonthData) ? filteredMonthData.reduce((sum, p) => sum + (p.cost_breakdown?.indirect_costs || 0), 0) : 0;
                                    const totalEmployee = Array.isArray(filteredMonthData) ? filteredMonthData.reduce((sum, p) => sum + (p.cost_breakdown?.employee_costs || 0), 0) : 0;
                                    
                                    return (
                                        <Card key={month} className="bg-gradient-to-br from-info-muted to-info-muted border-info-muted">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-lg text-info-muted-foreground">
                                                    {formatMonthLabel(month)}
                                                </CardTitle>
                                                <CardDescription>
                                                    {filteredMonthData.length} productos
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-medium">Total Costos:</span>
                                                    <span className="font-bold text-info-muted-foreground">
                                                        {formatCurrency(totalCosts)}
                                                </span>
                                    </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-medium">Indirectos:</span>
                                                    <span className="font-semibold text-warning-muted-foreground">
                                                        {formatCurrency(totalIndirect)}
                                                </span>
                                        </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-medium">Empleados:</span>
                                                    <span className="font-semibold text-info-muted-foreground">
                                                        {formatCurrency(totalEmployee)}
                                                    </span>
                                        </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                                </div>

                            {/* Tabla comparativa detallada */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Comparativa Detallada por Producto</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="border-b">
                                                    <th className="text-left p-2 font-semibold">Producto</th>
                                                    {selectedMonths.map(month => (
                                                        <th key={month} className="text-center p-2 font-semibold">
                                                            {formatMonthShortWithYear(month)}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    // Obtener todos los productos únicos de todos los meses
                                                    const allProducts = new Set<string>();
                                                    Object.values(comparisonData).forEach(monthData => {
                                                        if (Array.isArray(monthData)) {
                                                            monthData.forEach(product => {
                                                                allProducts.add(product.product_name);
                                                            });
                                                        }
                                                    });
                                                    
                                                    return Array.from(allProducts).slice(0, 20).map(productName => (
                                                        <tr key={productName} className="border-b hover:bg-accent">
                                                            <td className="p-2 font-medium">{productName}</td>
                                                            {selectedMonths.map(month => {
                                                                const monthData = comparisonData[month] || [];
                                                                const product = Array.isArray(monthData) ? monthData.find(p => p.product_name === productName) : null;
                                                                return (
                                                                    <td key={month} className="p-2 text-center">
                                                                        {product ? (
                                                                            <div className="space-y-1">
                                                                                <div className="font-semibold text-info-muted-foreground">
                                                                                    {formatCurrency(product.calculated_cost || 0)}
                                    </div>
                                                                                <div className="text-xs text-muted-foreground">
                                                                                    Ind: {formatCurrency(product.cost_breakdown?.indirect_costs || 0)}
                                        </div>
                                                                                <div className="text-xs text-muted-foreground">
                                                                                    Emp: {formatCurrency(product.cost_breakdown?.employee_costs || 0)}
                                    </div>
                                </div>
                                                                        ) : (
                                                                            <span className="text-muted-foreground">-</span>
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ));
                                                })()}
                                            </tbody>
                                        </table>
                            </div>
                        </CardContent>
                    </Card>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Selecciona meses para comparar</h3>
                            <p className="text-muted-foreground mb-4">
                                Marca al menos un mes y haz clic en &quot;Cargar Comparativa&quot;
                            </p>
                        </div>
                    )}
                </TabsContent>

            </Tabs>

            {/* Dialog: Notas */}
            <NotesDialog
                open={showNotesDialog}
                onOpenChange={setShowNotesDialog}
                moduleName="Calculadora de Costos"
                storageKey="calculadora_costos_notes"
            />

            {/* Dialog de Comparativas */}
            <Dialog open={isComparisonsDialogOpen} onOpenChange={(open) => {
                setIsComparisonsDialogOpen(open);
                if (open && currentCompany) {
                    // Recargar comparativas cuando se abre el diálogo
                    log('🔄 Recargando comparativas al abrir diálogo...');
                    loadComparisons();
                }
            }}>
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>Comparativas de Precios</DialogTitle>
                        <DialogDescription>
                            Gestiona comparativas de precios con empresas competidoras
                        </DialogDescription>
                    </DialogHeader>

                    <DialogBody>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Button onClick={handleCreateNewComparison} className="bg-info hover:bg-info/90">
                                <Plus className="h-4 w-4 mr-2" />
                                Agregar Nueva Comparativa
                            </Button>
        </div>

                        {comparisons.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No hay comparativas guardadas. Crea una nueva comparativa para comenzar.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {comparisons.map((comparison) => (
                                    <Card key={comparison.id} className="p-4">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h3 className="font-semibold">{comparison.name}</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    Competidores: {comparison.competitors.map(c => c.name).join(', ')}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Creada: {formatDate(comparison.createdAt)}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    onClick={() => handleViewComparison(comparison)}
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    Ver
                                                </Button>
                                                <Button
                                                    onClick={() => handleDeleteComparison(comparison.id)}
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                    </DialogBody>
                </DialogContent>
            </Dialog>

            {/* Dialog para crear nueva comparativa */}
            <Dialog open={isNewComparisonDialogOpen} onOpenChange={setIsNewComparisonDialogOpen}>
                <DialogContent size="xl">
                    <DialogHeader>
                        <DialogTitle>Nueva Comparativa</DialogTitle>
                        <DialogDescription>
                            Agrega competidores y sus precios para comparar con tus precios
                        </DialogDescription>
                    </DialogHeader>

                    <DialogBody>
                    <div className="space-y-4 flex-1 flex flex-col min-h-0">
                        <div className="flex-shrink-0">
                            <Label>Nombre de la Comparativa</Label>
                            <Input
                                value={newComparisonName}
                                onChange={(e) => setNewComparisonName(e.target.value)}
                                placeholder="Ej: Comparativa Enero 2025"
                                className="mt-1"
                            />
                        </div>

                        {/* Agregar competidores */}
                        <div className="flex-shrink-0 border rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">Competidores</Label>
                                {competitors.length > 0 && (
                                    <span className="text-xs text-muted-foreground">{competitors.length} agregado{competitors.length > 1 ? 's' : ''}</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    value={newCompetitorName}
                                    onChange={(e) => setNewCompetitorName(e.target.value)}
                                    placeholder="Ej: Corblock"
                                    className="flex-1 text-sm"
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddCompetitor();
                                        }
                                    }}
                                />
                                <Button 
                                    onClick={handleAddCompetitor} 
                                    size="sm" 
                                    className="bg-info hover:bg-info/90 flex-shrink-0"
                                    disabled={!newCompetitorName.trim()}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Agregar
                                </Button>
                            </div>
                            
                            {competitors.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {competitors.map((competitor) => (
                                        <Badge key={competitor.id} variant="secondary" className="flex items-center gap-1 px-2 py-1">
                                            <span className="text-xs">{competitor.name}</span>
                                            <button
                                                onClick={() => handleRemoveCompetitor(competitor.id)}
                                                className="ml-1 hover:bg-accent rounded-full p-0.5 transition-colors"
                                                type="button"
                                                title="Eliminar competidor"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Tabla de precios */}
                        {competitors.length > 0 && (
                            <div className="flex-1 flex flex-col min-h-0">
                                <Label className="mb-2 block flex-shrink-0">Precios por Competidor</Label>
                                <div className="border rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
                                    <div 
                                        className="flex-1 overflow-auto relative cursor-grab active:cursor-grabbing"
                                        onMouseDown={(e) => {
                                            // No activar drag si se hace clic en un input o botón
                                            if ((e.target as HTMLElement).tagName === 'INPUT' || 
                                                (e.target as HTMLElement).tagName === 'BUTTON' ||
                                                (e.target as HTMLElement).closest('input') ||
                                                (e.target as HTMLElement).closest('button')) {
                                                return;
                                            }
                                            setIsDragging(true);
                                            setStartX(e.pageX - (e.currentTarget.offsetLeft || 0));
                                            setScrollLeft(e.currentTarget.scrollLeft);
                                            e.currentTarget.style.cursor = 'grabbing';
                                        }}
                                        onMouseLeave={(e) => {
                                            setIsDragging(false);
                                            e.currentTarget.style.cursor = 'grab';
                                        }}
                                        onMouseUp={(e) => {
                                            setIsDragging(false);
                                            e.currentTarget.style.cursor = 'grab';
                                        }}
                                        onMouseMove={(e) => {
                                            if (!isDragging) return;
                                            e.preventDefault();
                                            const x = e.pageX - (e.currentTarget.offsetLeft || 0);
                                            const walk = (x - startX) * 2; // Velocidad del scroll
                                            e.currentTarget.scrollLeft = scrollLeft - walk;
                                        }}
                                        onKeyDown={(e) => {
                                            // Solo hacer scroll con flechas si no hay un input enfocado
                                            if (document.activeElement?.tagName === 'INPUT') return;
                                            if (e.key === 'ArrowLeft') {
                                                e.preventDefault();
                                                e.currentTarget.scrollLeft -= 50;
                                            } else if (e.key === 'ArrowRight') {
                                                e.preventDefault();
                                                e.currentTarget.scrollLeft += 50;
                                            }
                                        }}
                                        tabIndex={0}
                                    >
                                        <table className="w-full caption-bottom text-sm">
                                            <thead className="sticky top-0 z-20 bg-background shadow-sm [&_tr]:border-b">
                                                <tr className="border-b transition-colors">
                                                    <th className="sticky left-0 bg-background z-30 h-12 px-4 text-left align-middle font-medium text-muted-foreground min-w-[200px] border-r-2 border-border shadow-sm">Producto</th>
                                                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground min-w-[120px] bg-muted border-r-2 border-border">{currentCompany?.name || 'Mi Precio'}</th>
                                                    {competitors.map((competitor, compIndex) => {
                                                        const bgColors = ['bg-info-muted', 'bg-success-muted', 'bg-info-muted', 'bg-warning-muted', 'bg-muted'];
                                                        const borderColors = ['border-info-muted', 'border-success-muted', 'border-info-muted', 'border-warning-muted', 'border-border'];
                                                        const bgColor = bgColors[compIndex % bgColors.length];
                                                        const borderColor = borderColors[compIndex % borderColors.length];
                                                        const isLast = compIndex === competitors.length - 1;
                                                        
                                                        return (
                                                            <React.Fragment key={competitor.id}>
                                                                <th className={cn('h-12 px-4 text-center align-middle font-medium text-muted-foreground min-w-[150px] border-r-2', bgColor, borderColor)}>{competitor.name}</th>
                                                                <th className={cn('h-12 px-4 text-center align-middle font-medium text-muted-foreground min-w-[120px] border-r-2', bgColor, borderColor)}>Diferencia</th>
                                                                <th className={cn('h-12 px-4 text-center align-middle font-medium text-muted-foreground min-w-[100px]', bgColor, !isLast && 'border-r-2', !isLast && borderColor)}>% Dif.</th>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </tr>
                                            </thead>
                                            <tbody className="[&_tr:last-child]:border-0">
                                            {(simulationResults.length > 0 
                                                ? simulationResults 
                                                : productionPrices.filter(product => {
                                                    const quantity = simulatedQuantities[product.id] || 0;
                                                    return quantity > 0;
                                                })
                                            ).map((product, productIndex) => {
                                                const materials = product.cost_breakdown?.materials || 0;
                                                const indirect = product.cost_breakdown?.indirect_costs || 0;
                                                const employee = product.cost_breakdown?.employee_costs || 0;
                                                const costPerUnit = materials + indirect + employee;
                                                const myPrice = parseFloat(costPerUnit.toFixed(2));

                                                // Obtener todos los productos para navegación
                                                const allProducts = simulationResults.length > 0 
                                                    ? simulationResults 
                                                    : productionPrices.filter(p => {
                                                        const qty = simulatedQuantities[p.id] || 0;
                                                        return qty > 0;
                                                    });

                                                return (
                                                    <tr key={product.id} className="border-b transition-colors hover:bg-muted/50">
                                                        <td className="p-4 align-middle font-medium sticky left-0 bg-background z-10 border-r-2 border-border shadow-sm">
                                                            {product.product_name}
                                                        </td>
                                                        <td className="p-4 align-middle text-right font-semibold bg-muted border-r-2 border-border">
                                                            {formatCurrencyWithDecimals(myPrice)}
                                                        </td>
                                                        {competitors.map((competitor, competitorIndex) => {
                                                            const bgColors = ['bg-info-muted', 'bg-success-muted', 'bg-info-muted', 'bg-warning-muted', 'bg-muted'];
                                                            const borderColors = ['border-info-muted', 'border-success-muted', 'border-info-muted', 'border-warning-muted', 'border-border'];
                                                            const bgColor = bgColors[competitorIndex % bgColors.length];
                                                            const borderColor = borderColors[competitorIndex % borderColors.length];
                                                            const isLast = competitorIndex === competitors.length - 1;
                                                            const competitorPrice = competitor.prices[product.id] ?? null;
                                                            const difference = competitorPrice !== null 
                                                                ? parseFloat(formatNumber(myPrice - competitorPrice, 2))
                                                                : null;
                                                            // Calcular porcentaje solo si el precio del competidor es razonable (> 0.01)
                                                            const percentDifference = competitorPrice !== null && competitorPrice > 0.01
                                                                ? parseFloat(((difference! / competitorPrice) * 100).toFixed(2))
                                                                : null;

                                                            // Calcular el siguiente input para navegación (hacia abajo, mismo competidor)
                                                            const getNextInputId = () => {
                                                                const nextProductIndex = productIndex + 1;
                                                                // Mismo competidor, siguiente producto
                                                                if (nextProductIndex < allProducts.length) {
                                                                    return `price-${nextProductIndex}-${competitorIndex}`;
                                                                }
                                                                return null;
                                                            };

                                                            return (
                                                                <React.Fragment key={competitor.id}>
                                                                    <td className={cn('p-4 align-middle text-right border-r-2', bgColor, borderColor)}>
                                                                        <Input
                                                                            id={`price-${productIndex}-${competitorIndex}`}
                                                                            type="number"
                                                                            step="0.01"
                                                                            min="0"
                                                                            value={competitorPrice !== null && competitorPrice !== undefined 
                                                                                ? competitorPrice.toString()
                                                                                : ''
                                                                            }
                                                                            onChange={(e) => {
                                                                                const inputValue = e.target.value;
                                                                                let value: number | null = null;
                                                                                
                                                                                if (inputValue !== '' && inputValue !== '-') {
                                                                                    const numValue = parseFloat(inputValue);
                                                                                    if (!isNaN(numValue) && numValue >= 0) {
                                                                                        value = parseFloat(numValue.toFixed(2));
                                                                                    }
                                                                                }
                                                                                
                                                                                handleUpdateCompetitorPrice(competitor.id, product.id, value);
                                                                            }}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') {
                                                                                    e.preventDefault();
                                                                                    const nextId = getNextInputId();
                                                                                    if (nextId) {
                                                                                        const nextInput = document.getElementById(nextId) as HTMLInputElement;
                                                                                        if (nextInput) {
                                                                                            nextInput.focus();
                                                                                            nextInput.select();
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }}
                                                                            placeholder="0.00"
                                                                            className="w-32 ml-auto"
                                                                        />
                                                                    </td>
                                                                    <td className={cn('p-4 align-middle text-right font-medium border-r-2', bgColor, borderColor, difference !== null && (difference > 0 ? 'text-destructive' : difference < 0 ? 'text-success' : ''))}>
                                                                        {difference !== null 
                                                                            ? `${difference > 0 ? '+' : ''}${formatCurrencyWithDecimals(Math.abs(difference))}`
                                                                            : <span className="text-muted-foreground">-</span>
                                                                        }
                                                                    </td>
                                                                    <td className={cn('p-4 align-middle text-right font-medium', bgColor, !isLast && 'border-r-2', !isLast && borderColor, percentDifference !== null && (percentDifference > 0 ? 'text-destructive' : percentDifference < 0 ? 'text-success' : ''))}>
                                                                        {percentDifference !== null 
                                                                            ? `${percentDifference > 0 ? '+' : ''}${formatNumber(percentDifference, 2)}%`
                                                                            : <span className="text-muted-foreground">-</span>
                                                                        }
                                                                    </td>
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 flex-shrink-0">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsNewComparisonDialogOpen(false);
                                    setNewComparisonName('');
                                    setNewCompetitorName('');
                                    setCompetitors([]);
                                }}
                            >
                                Cancelar
                            </Button>
                            <Button onClick={handleSaveNewComparison} className="bg-info hover:bg-info/90">
                                Guardar Comparativa
                            </Button>
                        </div>
                    </div>
                    </DialogBody>
                </DialogContent>
            </Dialog>

            {/* Dialog para ver comparativa */}
            {currentComparison && (
                <Dialog open={!!currentComparison} onOpenChange={handleCloseComparisonView}>
                    <DialogContent size="full">
                        <DialogHeader>
                            <DialogTitle>{currentComparison.name}</DialogTitle>
                            <DialogDescription>
                                Comparativa con {currentComparison.competitors.map(c => c.name).join(', ')} - {formatDate(currentComparison.createdAt)}
                            </DialogDescription>
                        </DialogHeader>

                        <DialogBody>
                        <div className="space-y-4 flex-1 flex flex-col min-h-0">
                            <div className="border rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
                                <div 
                                    className="flex-1 overflow-auto relative cursor-grab active:cursor-grabbing select-none"
                                    onMouseDown={(e) => {
                                        setIsDragging(true);
                                        setStartX(e.pageX - (e.currentTarget.offsetLeft || 0));
                                        setScrollLeft(e.currentTarget.scrollLeft);
                                    }}
                                    onMouseLeave={() => setIsDragging(false)}
                                    onMouseUp={() => setIsDragging(false)}
                                    onMouseMove={(e) => {
                                        if (!isDragging) return;
                                        e.preventDefault();
                                        const x = e.pageX - (e.currentTarget.offsetLeft || 0);
                                        const walk = (x - startX) * 2; // Velocidad del scroll
                                        e.currentTarget.scrollLeft = scrollLeft - walk;
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'ArrowLeft') {
                                            e.preventDefault();
                                            e.currentTarget.scrollLeft -= 50;
                                        } else if (e.key === 'ArrowRight') {
                                            e.preventDefault();
                                            e.currentTarget.scrollLeft += 50;
                                        }
                                    }}
                                    tabIndex={0}
                                >
                                    <table className="w-full caption-bottom text-sm">
                                        <thead className="sticky top-0 z-20 bg-background shadow-sm [&_tr]:border-b">
                                            <tr className="border-b transition-colors">
                                                <th className="sticky left-0 bg-background z-30 h-12 px-4 text-left align-middle font-medium text-muted-foreground min-w-[200px] border-r-2 border-border shadow-sm">Producto</th>
                                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground min-w-[120px] bg-muted border-r-2 border-border">{currentCompany?.name || 'Mi Precio'}</th>
                                                {currentComparison.competitors.map((competitor, compIndex) => {
                                                    const bgColors = ['bg-info-muted', 'bg-success-muted', 'bg-info-muted', 'bg-warning-muted', 'bg-muted'];
                                                    const borderColors = ['border-info-muted', 'border-success-muted', 'border-info-muted', 'border-warning-muted', 'border-border'];
                                                    const bgColor = bgColors[compIndex % bgColors.length];
                                                    const borderColor = borderColors[compIndex % borderColors.length];
                                                    const isLast = compIndex === currentComparison.competitors.length - 1;
                                                    
                                                    return (
                                                        <React.Fragment key={competitor.id}>
                                                            <th className={cn('h-12 px-4 text-center align-middle font-medium text-muted-foreground min-w-[120px] border-r-2', bgColor, borderColor)}>{competitor.name}</th>
                                                            <th className={cn('h-12 px-4 text-center align-middle font-medium text-muted-foreground min-w-[120px] border-r-2', bgColor, borderColor)}>Dif. {competitor.name}</th>
                                                            <th className={cn('h-12 px-4 text-center align-middle font-medium text-muted-foreground min-w-[100px]', bgColor, !isLast && 'border-r-2', !isLast && borderColor)}>% Dif.</th>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody className="[&_tr:last-child]:border-0">
                                        {currentComparison.products.map((product) => {
                                            return (
                                                <tr key={product.productId} className="border-b transition-colors hover:bg-muted/50">
                                                    <td className="p-4 align-middle font-medium sticky left-0 bg-background z-10 border-r-2 border-border shadow-sm">
                                                        {product.productName}
                                                    </td>
                                                    <td className="p-4 align-middle text-right font-semibold bg-muted border-r-2 border-border">
                                                        {formatCurrencyWithDecimals(product.myPrice)}
                                                    </td>
                                                    {currentComparison.competitors.map((competitor, competitorIndex) => {
                                                        const bgColors = ['bg-info-muted', 'bg-success-muted', 'bg-info-muted', 'bg-warning-muted', 'bg-muted'];
                                                        const borderColors = ['border-info-muted', 'border-success-muted', 'border-info-muted', 'border-warning-muted', 'border-border'];
                                                        const bgColor = bgColors[competitorIndex % bgColors.length];
                                                        const borderColor = borderColors[competitorIndex % borderColors.length];
                                                        const isLast = competitorIndex === currentComparison.competitors.length - 1;
                                                        
                                                        const competitorPrice = competitor.prices[product.productId] ?? null;
                                                        const difference = competitorPrice !== null 
                                                            ? parseFloat(formatNumber(product.myPrice - competitorPrice, 2))
                                                            : null;
                                                        // Calcular porcentaje solo si el precio del competidor es razonable (> 0.01)
                                                        const percentDifference = competitorPrice !== null && competitorPrice > 0.01
                                                            ? parseFloat(((difference! / competitorPrice) * 100).toFixed(2))
                                                            : null;

                                                        return (
                                                            <React.Fragment key={competitor.id}>
                                                                <td className={cn('p-4 align-middle text-right border-r-2', bgColor, borderColor)}>
                                                                    {competitorPrice !== null 
                                                                        ? formatCurrencyWithDecimals(parseFloat(competitorPrice.toFixed(2)))
                                                                        : <span className="text-muted-foreground">-</span>
                                                                    }
                                                                </td>
                                                                <td className={cn('p-4 align-middle text-right font-medium border-r-2', bgColor, borderColor, difference !== null && (difference > 0 ? 'text-destructive' : difference < 0 ? 'text-success' : ''))}>
                                                                    {difference !== null 
                                                                        ? `${difference > 0 ? '+' : ''}${formatCurrencyWithDecimals(Math.abs(difference))}`
                                                                        : <span className="text-muted-foreground">-</span>
                                                                    }
                                                                </td>
                                                                <td className={cn('p-4 align-middle text-right font-medium', bgColor, !isLast && 'border-r-2', !isLast && borderColor, percentDifference !== null && (percentDifference > 0 ? 'text-destructive' : percentDifference < 0 ? 'text-success' : ''))}>
                                                                    {percentDifference !== null 
                                                                        ? `${percentDifference > 0 ? '+' : ''}${formatNumber(percentDifference, 2)}%`
                                                                        : <span className="text-muted-foreground">-</span>
                                                                    }
                                                                </td>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        </DialogBody>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}



