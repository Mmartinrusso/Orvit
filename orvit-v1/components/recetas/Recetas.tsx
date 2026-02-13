'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useRecetas, Recipe, RecipeIngredient } from '@/hooks/use-recetas';
import { useProductos } from '@/hooks/use-productos';
import { useInsumos } from '@/hooks/use-insumos';
import { useSubcategories } from '@/hooks/use-subcategories';
import { useCompany } from '@/contexts/CompanyContext';
import { BookOpen, Plus, Edit, Trash2, Eye, Calculator, Package, DollarSign, Send, PieChart, TestTube, TrendingUp, TrendingDown, Target, RefreshCw, Users, Building2, Search, X, ToggleLeft, ToggleRight, Undo2, Redo2 } from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { BarChart, Bar as RechartsBar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend as RechartsLegend } from 'recharts';
import { toast } from 'sonner';

// ✅ OPTIMIZACIÓN: Desactivar logs en producción
const DEBUG = false; // Desactivado para mejor rendimiento
const log = DEBUG ? console.log.bind(console) : () => {};

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

// 🎨 Interfaz de colores de usuario
interface UserColorPreferences {
  themeName: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  chart6: string;
  progressPrimary: string;
  progressSecondary: string;
  progressWarning: string;
  progressDanger: string;
  kpiPositive: string;
  kpiNegative: string;
  kpiNeutral: string;
  cardHighlight: string;
  cardMuted: string;
  donut1: string;
  donut2: string;
  donut3: string;
  donut4: string;
  donut5: string;
}

const DEFAULT_COLORS: UserColorPreferences = {
  themeName: 'Predeterminado',
  chart1: '#3b82f6',
  chart2: '#10b981',
  chart3: '#f59e0b',
  chart4: '#8b5cf6',
  chart5: '#06b6d4',
  chart6: '#ef4444',
  progressPrimary: '#3b82f6',
  progressSecondary: '#10b981',
  progressWarning: '#f59e0b',
  progressDanger: '#ef4444',
  kpiPositive: '#10b981',
  kpiNegative: '#ef4444',
  kpiNeutral: '#64748b',
  cardHighlight: '#ede9fe',
  cardMuted: '#f1f5f9',
  donut1: '#3b82f6',
  donut2: '#10b981',
  donut3: '#f59e0b',
  donut4: '#8b5cf6',
  donut5: '#94a3b8',
};

export default function Recetas() {
  // Todos los hooks deben estar al inicio, antes de cualquier return condicional
  const pathname = usePathname();
  const { currentCompany } = useCompany();
  const { recipes, loading, error, fetchRecipeDetail, createRecipe, updateRecipe, deleteRecipe, refreshData } = useRecetas();
  const { products, categories } = useProductos();
  const { supplies, getCurrentPrice } = useInsumos();

  // 🎨 Colores de usuario
  const [userColors, setUserColors] = useState<UserColorPreferences>(DEFAULT_COLORS);

  // Cargar colores del usuario
  useEffect(() => {
    const loadColorPreferences = async () => {
      if (!currentCompany?.id) return;
      try {
        const response = await fetch(`/api/costos/color-preferences?companyId=${currentCompany.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.colors) {
            setUserColors(data.colors);
          }
        }
      } catch (error) {
        console.error('Error loading color preferences:', error);
      }
    };
    loadColorPreferences();
  }, [currentCompany?.id]);

  // Hook para subcategorías - se cargará dinámicamente según la categoría seleccionada
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>();
  const { subcategories } = useSubcategories(currentCompany?.id, selectedCategoryId);

  // Estados para el diálogo de crear receta
  const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [recipeForm, setRecipeForm] = useState({
      name: '',
      productId: '',
      subcategoryId: '',
      recipeTarget: 'product' as 'product' | 'subcategory', // Nuevo campo para seleccionar el tipo
      baseType: 'PER_BATCH' as 'PER_BATCH' | 'PER_M3' | 'PER_BANK',
      version: '1',
      description: '',
      notes: '',
      outputQuantity: '',
      outputUnitLabel: 'unidades',
      intermediateQuantity: '',
      intermediateUnitLabel: 'placas',
      unitsPerItem: '', // Unidades por placa/pastón/etc
      // Campos específicos para "Por Banco"
      metrosUtiles: '', // Metros útiles totales del banco
      cantidadPastones: '' // Cantidad de pastones del banco
    });

    // Estados para los insumos
    const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
    const [selectedSupplyId, setSelectedSupplyId] = useState('');
    const [ingredientQuantity, setIngredientQuantity] = useState('');
    const [pulsos, setPulsos] = useState('');
    const [kgPorPulso, setKgPorPulso] = useState('');
    const [inputMode, setInputMode] = useState<'pulsos' | 'direct'>('pulsos');

    // Estados para insumos del banco (solo para recetas "Por Banco")
    const [bankIngredients, setBankIngredients] = useState<RecipeIngredient[]>([]);
    const [selectedBankSupplyId, setSelectedBankSupplyId] = useState('');
    const [bankIngredientQuantity, setBankIngredientQuantity] = useState('');
    const [bankPulsos, setBankPulsos] = useState('');
    const [bankKgPorPulso, setBankKgPorPulso] = useState('');
    const [bankInputMode, setBankInputMode] = useState<'pulsos' | 'direct'>('pulsos');

    // Estados para editar/ver receta
    const [showViewDialog, setShowViewDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showNotesDialog, setShowNotesDialog] = useState(false);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notesContent, setNotesContent] = useState('');
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [selectedRecipeDetail, setSelectedRecipeDetail] = useState<any>(null);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
    
    // Estados para editar ingredientes del banco
    const [showEditBankIngredientDialog, setShowEditBankIngredientDialog] = useState(false);
    const [editingBankIngredientIndex, setEditingBankIngredientIndex] = useState<number | null>(null);
    const [editingBankIngredientData, setEditingBankIngredientData] = useState<RecipeIngredient>({
      supplyId: 0,
      supplyName: '',
      quantity: 0,
      unitMeasure: '',
      pulsos: 0,
      kgPorPulso: 0
    });
     
     // Estados para productos de subcategoría
     const [subcategoryProducts, setSubcategoryProducts] = useState<any[]>([]);
     const [subcategoryCosts, setSubcategoryCosts] = useState<any>(null);
     const [loadingSubcategoryProducts, setLoadingSubcategoryProducts] = useState(false);

    // Función para calcular unidades por placa automáticamente
    const calculateUnitsPerItem = () => {
      const outputQty = parseFloat(recipeForm.outputQuantity);
      const intermediateQty = parseFloat(recipeForm.intermediateQuantity);
      
      if (outputQty > 0 && intermediateQty > 0) {
        const unitsPerItem = outputQty / intermediateQty;
        // Redondear a 2 decimales y eliminar ceros innecesarios
        const roundedValue = Math.round(unitsPerItem * 100) / 100;
        setRecipeForm(prev => ({ ...prev, unitsPerItem: roundedValue.toString() }));
      }
    };

     // Función para cargar productos de subcategoría
     const loadSubcategoryProducts = async (subcategoryId: number) => {
       if (!currentCompany?.id) return;
       
       setLoadingSubcategoryProducts(true);
       try {
         const response = await fetch(`/api/productos/subcategorias/${subcategoryId}/productos?companyId=${currentCompany.id}`);
         if (response.ok) {
           const data = await response.json();
           setSubcategoryProducts(data.products || []);
           setSubcategoryCosts(data);
           log('📊 Productos de subcategoría cargados:', data);
         } else {
           console.error('Error cargando productos de subcategoría');
           setSubcategoryProducts([]);
           setSubcategoryCosts(null);
         }
       } catch (error) {
         console.error('Error cargando productos de subcategoría:', error);
         setSubcategoryProducts([]);
         setSubcategoryCosts(null);
       } finally {
         setLoadingSubcategoryProducts(false);
       }
     };

     // Función para calcular unidades por placa automáticamente en edición
     const calculateUnitsPerItemEdit = () => {
       const outputQty = editingRecipe?.outputQuantity;
       const intermediateQty = editingRecipe?.intermediateQuantity;
      
      if (outputQty && intermediateQty && outputQty > 0 && intermediateQty > 0) {
        const unitsPerItem = outputQty / intermediateQty;
        // Redondear a 2 decimales y eliminar ceros innecesarios
        const roundedValue = Math.round(unitsPerItem * 100) / 100;
        setEditingRecipe(prev => prev ? { ...prev, unitsPerItem: roundedValue } : null);
      }
    };
    const [editingIngredients, setEditingIngredients] = useState<RecipeIngredient[]>([]);
    const [recipePrices, setRecipePrices] = useState<{[key: number]: number}>({});

    // Estados para editar ingredientes
    const [showEditIngredientDialog, setShowEditIngredientDialog] = useState(false);
    const [editingIngredientIndex, setEditingIngredientIndex] = useState<number>(-1);
    const [editingIngredientData, setEditingIngredientData] = useState<RecipeIngredient>({
      supplyId: 0,
      supplyName: '',
      quantity: 0,
      unitMeasure: ''
    });
    const [editingPulsos, setEditingPulsos] = useState('');
    const [editingKgPorPulso, setEditingKgPorPulso] = useState('');
    const [chartType, setChartType] = useState<'cost' | 'quantity'>('cost');
    
    // Estados para la pestaña de pruebas
    const [selectedProductForTest, setSelectedProductForTest] = useState('');
    const [testIngredients, setTestIngredients] = useState<RecipeIngredient[]>([]);
    const [testResults, setTestResults] = useState<any>(null);
    const [editingTestIngredient, setEditingTestIngredient] = useState<any>(null);
    const [showEditTestDialog, setShowEditTestDialog] = useState(false);
    
    // Estados temporales para mantener valores mientras se escribe (para permitir "0.", "0.4", etc.)
    const [tempInputValues, setTempInputValues] = useState<{[key: string]: string}>({});
    
    // Estados para la simulación tipo Excel
    const [showAddIngredientDialog, setShowAddIngredientDialog] = useState(false);
    const [newTestIngredient, setNewTestIngredient] = useState({
      supplyId: '',
      quantity: '',
      pulsos: '',
      kgPorPulso: '',
      price: ''
    });
    
    // Estados para comparación con receta activa
    const [originalRecipe, setOriginalRecipe] = useState<RecipeIngredient[]>([]);
    const [comparisonResults, setComparisonResults] = useState<any>(null);
    const [selectedRecipeForComparison, setSelectedRecipeForComparison] = useState<Recipe | null>(null);
    
    // Estados para guardar pruebas de costos
    const [showSaveTestDialog, setShowSaveTestDialog] = useState(false);
    const [savedTests, setSavedTests] = useState<any[]>([]);
    const [testName, setTestName] = useState('');
    const [testNotes, setTestNotes] = useState('');
    const [loadingSavedTests, setLoadingSavedTests] = useState(false);
    
    // Estados para historial de cambios (undo/redo)
    const [history, setHistory] = useState<RecipeIngredient[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const MAX_HISTORY = 50; // Máximo de estados en el historial
    const isUndoRedoRef = useRef(false); // Bandera para evitar guardar en historial durante undo/redo
    
    // Estados para el modal de nueva receta
    const [showNewRecipeDialog, setShowNewRecipeDialog] = useState(false);
    const [newRecipeName, setNewRecipeName] = useState('');
    const [newRecipeVersion, setNewRecipeVersion] = useState('1');
    
    // Estados para recetas del producto seleccionado
    const [productRecipes, setProductRecipes] = useState<Recipe[]>([]);
    const [loadingProductRecipes, setLoadingProductRecipes] = useState(false);
    
    // Estados para simulación completa con empleados e indirectos
    const [productionDias, setProductionDias] = useState<number>(0); // Cantidad de días
    const [productionPlacasPorDia, setProductionPlacasPorDia] = useState<number>(0); // Placas producidas por día
    const [productionMonth, setProductionMonth] = useState<string>(new Date().toISOString().slice(0, 7));
    const [simulatingTotalCost, setSimulatingTotalCost] = useState(false);
    const [totalCostResults, setTotalCostResults] = useState<any>(null);
    
    // Estados para búsqueda y filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProductId, setFilterProductId] = useState<string>('all');
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
    const [originalTotalCostResults, setOriginalTotalCostResults] = useState<any>(null);
    
    // Refs para navegación entre campos
    const diasInputRef = useRef<HTMLInputElement>(null);

    // ✅ Función para convertir placas por día × días a unidades
    const getProductionQuantityInUnits = (): number => {
      if (!selectedRecipeForComparison) return 0;
      
      // Convertir días a unidades: (placas por día × días) × unitsPerItem
      const placasTotales = (productionPlacasPorDia || 0) * (productionDias || 0);
      const unitsPerItem = selectedRecipeForComparison.unitsPerItem || 1;
      return placasTotales * unitsPerItem;
    };


    // ✅ OPTIMIZADO: Cargar precios de todas las recetas en una sola llamada
    // ANTES: 27+ llamadas individuales a /api/recetas/{id}
    // DESPUÉS: 1 llamada a /api/recetas?includeIngredients=true
    const loadRecipePrices = async () => {
      const prices: {[key: number]: number} = {};
      
      try {
        // Obtener todas las recetas con ingredientes en una sola llamada
        const response = await fetch(`/api/recetas?companyId=${currentCompany?.id}&includeIngredients=true`);
        if (!response.ok) {
          console.error('Error cargando recetas con ingredientes');
          return;
        }
        
        const recipesWithIngredients = await response.json();
        
        for (const recipe of recipesWithIngredients) {
          if (recipe.ingredients && recipe.ingredients.length > 0) {
            // Calcular costo de ingredientes de la receta
            const costoPorPaston = recipe.ingredients.reduce((total: number, ingredient: any) => {
              // Usar precio incluido en la respuesta o fallback a getCurrentPrice
              const latestPrice = ingredient.currentPrice || getCurrentPrice(ingredient.supplyId);
              return total + (ingredient.quantity * latestPrice);
            }, 0);
            
            // Calcular costo de ingredientes del banco (si los hay)
            const costoBanco = (recipe.bankIngredients || []).reduce((total: number, ingredient: any) => {
              const latestPrice = ingredient.currentPrice || getCurrentPrice(ingredient.supplyId);
              return total + (ingredient.quantity * latestPrice);
            }, 0);
            
            // Si es receta "Por Banco", multiplicar solo los ingredientes de la receta por cantidad de pastones
            if (recipe.baseType === 'PER_BANK' && recipe.cantidadPastones) {
              const costoRecetaMultiplicado = costoPorPaston * recipe.cantidadPastones;
              prices[recipe.id] = costoRecetaMultiplicado + costoBanco;
            } else {
              prices[recipe.id] = costoPorPaston + costoBanco;
            }
          } else {
            prices[recipe.id] = 0;
          }
        }
      } catch (error) {
        console.error('Error calculando precios de recetas:', error);
      }
      
      setRecipePrices(prices);
    };

    // Función para simular costos - definida antes de los hooks
    const simulateCosts = async () => {
      if (!selectedRecipeForComparison || testIngredients.length === 0) {
        setTestResults(null);
        setTotalCostResults(null);
        setOriginalTotalCostResults(null);
        return;
      }

      // ✅ Convertir cantidad a unidades según el tipo de entrada
      const quantityInUnits = getProductionQuantityInUnits();
      
      // Si hay cantidad de producción, calcular costos completos (materiales + empleados + indirectos)
      if (quantityInUnits > 0 && productionMonth) {
        setSimulatingTotalCost(true);
        try {
          // Obtener producto para obtener categoría
          const product = products.find(p => p.id.toString() === selectedProductForTest);
          
          // ⚡ OPTIMIZADO: Hacer ambas llamadas en paralelo con Promise.all
          const promises = [];
          
          // Helper function para manejar errores y mostrar detalles
          const fetchSimulation = async (data: any) => {
            try {
              const res = await fetch('/api/recipes/simulate-total-cost', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
              });
              
              if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                console.error('❌ Error en simulate-total-cost:', {
                  status: res.status,
                  statusText: res.statusText,
                  error: errorData.error,
                  details: errorData.details,
                });
                throw new Error(errorData.details || errorData.error || `Error ${res.status}: ${res.statusText}`);
              }
              
              return await res.json();
            } catch (error: any) {
              console.error('❌ Error en fetch simulation:', error);
              // Retornar null para que no rompa la otra llamada, pero loguear el error
              return { success: false, error: error.message };
            }
          };
          
          // Llamada para receta ORIGINAL (solo si hay receta original)
          if (originalRecipe.length > 0) {
            promises.push(
              fetchSimulation({
                recipeId: selectedRecipeForComparison.id,
                ingredients: originalRecipe.map(ing => ({
                  supplyId: ing.supplyId,
                  quantity: ing.quantity,
                  testPrice: undefined,
                })),
                productionQuantity: quantityInUnits,
                productionMonth: productionMonth,
                productCategoryId: product?.categoryId,
                productId: product?.id,
              })
            );
          } else {
            promises.push(Promise.resolve(null));
          }
          
          // Llamada para receta de PRUEBA
          promises.push(
            fetchSimulation({
              recipeId: selectedRecipeForComparison.id,
              ingredients: testIngredients.map(ing => ({
                supplyId: ing.supplyId,
                quantity: ing.quantity,
                testPrice: ing.testPrice,
              })),
              productionQuantity: quantityInUnits,
              productionMonth: productionMonth,
              productCategoryId: product?.categoryId,
              productId: product?.id,
            })
          );

          // ⚡ Ejecutar ambas llamadas en paralelo
          const [originalData, testData] = await Promise.all(promises);
          
          // Procesar resultados de receta ORIGINAL
          if (originalData?.success && originalRecipe.length > 0) {
            setOriginalTotalCostResults(originalData.results);
          } else if (originalData?.error) {
            console.error('Error en simulación de receta original:', originalData.error);
          }
          
          // Procesar resultados de receta de PRUEBA
          if (testData?.success) {
            setTotalCostResults(testData.results);
            
            // Calcular costo de materiales solo para comparación
            const materialsCost = testIngredients.reduce((sum, ingredient) => {
              const price = ingredient.testPrice !== undefined && ingredient.testPrice !== null ? ingredient.testPrice : (getCurrentPrice(ingredient.supplyId) || 0);
              const quantity = ingredient.quantity !== undefined && ingredient.quantity !== null ? ingredient.quantity : 0;
              return sum + (quantity * price);
            }, 0);
            
            const outputQuantity = selectedRecipeForComparison.outputQuantity || 1;
            const materialsCostPerUnit = materialsCost / outputQuantity;
            
            setTestResults({
              totalCost: materialsCost,
              costPerUnit: materialsCostPerUnit,
              ingredients: testIngredients.map(ingredient => ({
                ...ingredient,
                currentPrice: ingredient.testPrice || getCurrentPrice(ingredient.supplyId),
                totalCost: ingredient.quantity * (ingredient.testPrice || getCurrentPrice(ingredient.supplyId)),
                percentage: materialsCost > 0 ? ((ingredient.quantity * (ingredient.testPrice || getCurrentPrice(ingredient.supplyId))) / materialsCost) * 100 : 0
              }))
            });
          } else if (testData?.error) {
            console.error('Error en simulación de receta de prueba:', testData.error);
            // Mostrar mensaje de error al usuario
            toast.error('Error al calcular costos', {
              description: testData.error,
            });
          }
        } catch (error) {
          console.error('Error en simulación de costos totales:', error);
        } finally {
          setSimulatingTotalCost(false);
        }
      }
    };

    // Función para calcular comparación - definida antes de los hooks
    const calculateComparison = () => {
      if (!selectedRecipeForComparison || testIngredients.length === 0 || originalRecipe.length === 0) {
        setComparisonResults(null);
        return;
      }

      const originalTotalCost = originalRecipe.reduce((sum, ingredient) => {
        const price = getCurrentPrice(ingredient.supplyId);
        return sum + (ingredient.quantity * price);
      }, 0);

      const simulationTotalCost = testIngredients.reduce((sum, ingredient) => {
        const price = ingredient.testPrice !== undefined && ingredient.testPrice !== null ? ingredient.testPrice : (getCurrentPrice(ingredient.supplyId) || 0);
        const quantity = ingredient.quantity !== undefined && ingredient.quantity !== null ? ingredient.quantity : 0;
        return sum + (quantity * price);
      }, 0);

      const costDifference = simulationTotalCost - originalTotalCost;
      const percentageDifference = originalTotalCost > 0 ? (costDifference / originalTotalCost) * 100 : 0;

      const ingredientComparisons = testIngredients.map(testIngredient => {
        const originalIngredient = originalRecipe.find(orig => orig.supplyId === testIngredient.supplyId);

        if (!originalIngredient) {
          return {
            ...testIngredient,
            originalQuantity: 0,
            originalPrice: 0,
            originalCost: 0,
            costDifference: testIngredient.quantity * (testIngredient.testPrice || getCurrentPrice(testIngredient.supplyId)),
            percentageDifference: 100 // Nuevo ingrediente
          };
        }

        const originalPrice = getCurrentPrice(originalIngredient.supplyId);
        const originalCost = originalIngredient.quantity * originalPrice;
        const testCost = testIngredient.quantity * (testIngredient.testPrice || originalPrice);
        const costDiff = testCost - originalCost;
        const percentageDiff = originalCost > 0 ? (costDiff / originalCost) * 100 : 0;

        return {
          ...testIngredient,
          originalQuantity: originalIngredient.quantity,
          originalPrice: originalPrice,
          originalCost: originalCost,
          costDifference: costDiff,
          percentageDifference: percentageDiff
        };
      });

      // Calcular costos por unidad (costo total ÷ cantidad de unidades que salen por batch)
      const outputQuantity = selectedRecipeForComparison?.outputQuantity || 1;
      const originalCostPerUnit = originalTotalCost / outputQuantity;
      const simulationCostPerUnit = simulationTotalCost / outputQuantity;
      const costPerUnitDifference = simulationCostPerUnit - originalCostPerUnit;
      const costPerUnitPercentageDifference = originalCostPerUnit > 0 ? (costPerUnitDifference / originalCostPerUnit) * 100 : 0;

      // Estadísticas adicionales
      const totalIngredients = testIngredients.length;
      const modifiedIngredients = ingredientComparisons.filter(comp => comp.costDifference !== 0).length;
      const newIngredients = ingredientComparisons.filter(comp => comp.percentageDifference === 100).length;
      const removedIngredients = originalRecipe.filter(orig => 
        !testIngredients.some(test => test.supplyId === orig.supplyId)
      ).length;

      // Ingrediente con mayor impacto
      const maxImpactIngredient = ingredientComparisons.reduce((max, current) => 
        Math.abs(current.costDifference) > Math.abs(max.costDifference) ? current : max
      );

      // Ingrediente con mayor ahorro
      const maxSavingsIngredient = ingredientComparisons.reduce((max, current) => 
        current.costDifference < max.costDifference ? current : max
      );

      // Ingrediente con mayor aumento
      const maxIncreaseIngredient = ingredientComparisons.reduce((max, current) => 
        current.costDifference > max.costDifference ? current : max
      );

      setComparisonResults({
        originalTotalCost,
        simulationTotalCost,
        costDifference,
        percentageDifference,
        originalCostPerUnit,
        simulationCostPerUnit,
        costPerUnitDifference,
        costPerUnitPercentageDifference,
        ingredientComparisons,
        totalIngredients,
        modifiedIngredients,
        newIngredients,
        removedIngredients,
        maxImpactIngredient,
        maxSavingsIngredient,
        maxIncreaseIngredient
      });
    };

    // Función para cargar pruebas guardadas - definida antes de los hooks
    const loadSavedTests = async () => {
      if (!selectedRecipeForComparison) return;
      
      setLoadingSavedTests(true);
      try {
        const response = await fetch(`/api/costs/recipe-cost-tests?recipeId=${selectedRecipeForComparison.id}`);
        if (response.ok) {
          const data = await response.json();
          setSavedTests(Array.isArray(data) ? data : []);
        } else {
          console.error('Error cargando pruebas guardadas');
          setSavedTests([]);
        }
      } catch (error) {
        console.error('Error cargando pruebas guardadas:', error);
        setSavedTests([]);
      } finally {
        setLoadingSavedTests(false);
      }
    };

    // Función para cargar las recetas de un producto específico - definida antes de los hooks
    const loadProductRecipes = async (productId: string) => {
      if (!productId || !currentCompany?.id) {
        setProductRecipes([]);
        return;
      }
      
      setLoadingProductRecipes(true);
      try {
        const response = await fetch(`/api/recetas?companyId=${currentCompany.id}&productId=${productId}`);
        if (response.ok) {
          const data = await response.json();
          // Filtrar recetas que pertenecen al producto seleccionado
          const filteredRecipes = Array.isArray(data) 
            ? data.filter((recipe: any) => recipe.productId?.toString() === productId.toString())
            : [];
          setProductRecipes(filteredRecipes);
        } else {
          console.error('Error cargando recetas del producto');
          setProductRecipes([]);
        }
      } catch (error) {
        console.error('Error cargando recetas del producto:', error);
        setProductRecipes([]);
      } finally {
        setLoadingProductRecipes(false);
      }
    };

    // Función para cargar receta actual para pruebas - definida antes de los hooks
    const loadCurrentRecipeForTest = async (productId: string) => {
      try {
        // Buscar la receta activa del producto
        const activeRecipe = recipes.find(r => 
          r.productId === productId && r.isActive
        );
        
        if (activeRecipe) {
          const recipeDetail = await fetchRecipeDetail(activeRecipe.id);
          if (recipeDetail && recipeDetail.ingredients) {
            // Cargar ingredientes en la simulación
            const ingredientsWithPrices = recipeDetail.ingredients.map(ing => ({
              ...ing,
              testPrice: getCurrentPrice(ing.supplyId)
            }));
            setTestIngredients(ingredientsWithPrices);
            // Guardar receta original para comparación (con el precio que tenía al cargar)
            setOriginalRecipe(ingredientsWithPrices);
            // Inicializar historial con el estado inicial
            setHistory([JSON.parse(JSON.stringify(ingredientsWithPrices))]);
            setHistoryIndex(0);
          }
        } else {
          setOriginalRecipe([]);
          setTestIngredients([]);
          setHistory([]);
          setHistoryIndex(-1);
        }
      } catch (error) {
        console.error('Error cargando receta para pruebas:', error);
        setOriginalRecipe([]);
        setTestIngredients([]);
      }
    };

    // Hooks - deben estar antes de cualquier return condicional
    // Limpiar estados cuando se sale de la página de recetas
    useEffect(() => {
      // Si no estamos en la página de recetas, limpiar estados
      if (pathname && !pathname.includes('/recetas')) {
        setTestIngredients([]);
        setTestResults(null);
        setComparisonResults(null);
        setSelectedRecipeForComparison(null);
        setTotalCostResults(null);
        setOriginalTotalCostResults(null);
        setProductionDias(0);
        setProductionPlacasPorDia(0);
        setProductionMonth(new Date().toISOString().slice(0, 7));
        setTestName('');
        setTestNotes('');
      }
      
      return () => {
        // Limpiar todos los estados cuando el componente se desmonte
        setTestIngredients([]);
        setTestResults(null);
        setComparisonResults(null);
        setSelectedRecipeForComparison(null);
        setTotalCostResults(null);
        setOriginalTotalCostResults(null);
        setProductionDias(0);
        setProductionPlacasPorDia(0);
        setProductionMonth(new Date().toISOString().slice(0, 7));
        setTestName('');
        setTestNotes('');
      };
    }, [pathname]);

    // Cargar precios cuando se carguen las recetas
    useEffect(() => {
      if (recipes.length > 0 && supplies.length > 0) {
        loadRecipePrices();
      }
    }, [recipes, supplies]);

    // Guardar en historial cuando cambien los ingredientes (excepto durante undo/redo)
    const lastSavedStateRef = useRef<RecipeIngredient[]>([]);
    const historyIndexRef = useRef(historyIndex);
    
    // Actualizar ref cuando cambie historyIndex
    React.useEffect(() => {
      historyIndexRef.current = historyIndex;
    }, [historyIndex]);
    
    React.useEffect(() => {
      // No guardar si viene de undo/redo
      if (isUndoRedoRef.current) {
        lastSavedStateRef.current = JSON.parse(JSON.stringify(testIngredients));
        return;
      }
      
      // No guardar si es el estado inicial vacío
      if (testIngredients.length === 0) {
        lastSavedStateRef.current = [];
        return;
      }
      
      // Verificar si realmente hubo un cambio comparando con el último estado guardado
      if (JSON.stringify(lastSavedStateRef.current) === JSON.stringify(testIngredients)) {
        return; // No hay cambios, no guardar
      }
      
      // Hay un cambio real, guardar en historial
      const ingredientsCopy = JSON.parse(JSON.stringify(testIngredients));
      lastSavedStateRef.current = ingredientsCopy;
      
      setHistory(prev => {
        // Si no hay historial, inicializar
        if (prev.length === 0) {
          setHistoryIndex(0);
          return [ingredientsCopy];
        }
        
        // Eliminar cualquier estado futuro si estamos en medio del historial
        const currentIndex = historyIndexRef.current;
        const newHistory = prev.slice(0, currentIndex + 1);
        newHistory.push(ingredientsCopy);
        
        // Limitar el tamaño del historial
        if (newHistory.length > MAX_HISTORY) {
          const limited = newHistory.slice(-MAX_HISTORY);
          setHistoryIndex(MAX_HISTORY - 1);
          return limited;
        }
        
        setHistoryIndex(newHistory.length - 1);
        return newHistory;
      });
    }, [testIngredients]);

    // Simular costos automáticamente cuando cambien los ingredientes
    React.useEffect(() => {
      // Usar setTimeout para evitar setState durante render
      const timeoutId = setTimeout(() => {
        if (selectedRecipeForComparison && testIngredients.length > 0) {
          simulateCosts();
        }
        if (selectedRecipeForComparison && testIngredients.length > 0 && originalRecipe.length > 0) {
          calculateComparison();
        }
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }, [testIngredients, originalRecipe, selectedRecipeForComparison]);

    // Cargar pruebas guardadas cuando cambie la receta seleccionada
    React.useEffect(() => {
      if (selectedRecipeForComparison) {
        loadSavedTests();
      }
    }, [selectedRecipeForComparison]);

    // Manejar atajos de teclado para deshacer/rehacer
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Ctrl+Z o Cmd+Z para volver al original
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          if (history.length > 0 && historyIndex > 0) {
            handleUndo();
          }
        }
        // Ctrl+Y o Ctrl+Shift+Z para rehacer
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
          e.preventDefault();
          if (history.length > 0 && historyIndex < history.length - 1) {
            handleRedo();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [historyIndex, history.length]);

    // Cargar recetas del producto cuando cambie la selección
    React.useEffect(() => {
      if (selectedProductForTest) {
        loadProductRecipes(selectedProductForTest);
      } else {
        setProductRecipes([]);
      }
    }, [selectedProductForTest]);

  // Verificar si la empresa está seleccionada
  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">Selecciona una empresa para continuar</div>
      </div>
    );
  }

  // Verificar si los datos están disponibles
  if (!products || !supplies) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Cargando datos...</div>
      </div>
    );
  }

  // Función para calcular toneladas automáticamente
  const calculateToneladas = (pulsos: string, kgPorPulso: string) => {
    const pulsosNum = parseFloat(pulsos) || 0;
    const kgPorPulsoNum = parseFloat(kgPorPulso) || 0;
    const toneladas = (pulsosNum * kgPorPulsoNum) / 1000;
    return toneladas;
  };

    // Función para agregar insumo
    const addIngredient = () => {
      log('🔍 addIngredient llamado con:', { selectedSupplyId, ingredientQuantity, pulsos, kgPorPulso });
      
      if (!selectedSupplyId || !ingredientQuantity) {
        log('❌ Campos vacíos, no se puede agregar');
        return;
      }

      const supply = supplies.find(s => s.id === parseInt(selectedSupplyId));
      if (!supply) {
        log('❌ Supply no encontrado');
        return;
      }

      const newIngredient: RecipeIngredient = {
        supplyId: parseInt(selectedSupplyId),
        supplyName: supply.name,
        quantity: parseFloat(ingredientQuantity),
        unitMeasure: supply.unitMeasure,
        pulsos: parseInt(pulsos) || 100,
        kgPorPulso: parseFloat(kgPorPulso) || 0
      };

      log('✅ Agregando nuevo ingrediente:', newIngredient);
      log('📊 Estado actual de ingredients:', ingredients);
      
      setIngredients(prev => {
        const newIngredients = [...prev, newIngredient];
        log('🔄 Nuevo estado de ingredients:', newIngredients);
        return newIngredients;
      });
      
      setSelectedSupplyId('');
      setIngredientQuantity('');
      setPulsos('');
      setKgPorPulso('');
    };

    // Función para remover insumo
    const removeIngredient = (index: number) => {
      setIngredients(ingredients.filter((_, i) => i !== index));
    };

    // Función para agregar ingrediente del banco
    const addBankIngredient = () => {
      log('🔍 addBankIngredient llamado con:', { selectedBankSupplyId, bankIngredientQuantity, bankPulsos, bankKgPorPulso });
      
      if (!selectedBankSupplyId || !bankIngredientQuantity) {
        log('❌ Campos vacíos, no se puede agregar');
        return;
      }

      const supply = supplies.find(s => s.id === parseInt(selectedBankSupplyId));
      if (!supply) {
        log('❌ Supply no encontrado');
        return;
      }

      // Verificar si el ingrediente ya existe en insumos del banco
      const existingBankIngredient = bankIngredients.find(ing => ing.supplyId.toString() === selectedBankSupplyId);
      if (existingBankIngredient) {
        toast.warning('Insumo duplicado', {
          description: 'Este insumo ya está en los insumos del banco',
        });
        return;
      }

      // Verificar si el ingrediente ya existe en insumos de la receta
      const existingRecipeIngredient = ingredients.find(ing => ing.supplyId.toString() === selectedBankSupplyId);
      if (existingRecipeIngredient) {
        toast.warning('Insumo duplicado', {
          description: 'Este insumo ya está en los insumos de la receta',
        });
        return;
      }

      const newBankIngredient: RecipeIngredient = {
        supplyId: parseInt(selectedBankSupplyId),
        supplyName: supply.name,
        quantity: parseFloat(bankIngredientQuantity),
        unitMeasure: supply.unitMeasure,
        pulsos: parseInt(bankPulsos) || 100,
        kgPorPulso: parseFloat(bankKgPorPulso) || 0
      };

      log('✅ Agregando nuevo ingrediente del banco:', newBankIngredient);
      setBankIngredients(prev => {
        const newBankIngredients = [...prev, newBankIngredient];
        log('🔄 Nuevo estado de bankIngredients:', newBankIngredients);
        return newBankIngredients;
      });
      
      setSelectedBankSupplyId('');
      setBankIngredientQuantity('');
      setBankPulsos('');
      setBankKgPorPulso('');
    };

    // Función para remover insumo del banco
    const removeBankIngredient = (index: number) => {
      setBankIngredients(bankIngredients.filter((_, i) => i !== index));
    };

    // Función para editar ingrediente
    const handleEditIngredient = (index: number, ingredient: RecipeIngredient) => {
      setEditingIngredientIndex(index);
      setEditingIngredientData({ ...ingredient });
      
      // Usar los valores reales de la base de datos si están disponibles
      const pulsosCalculados = ingredient.pulsos || 100;
      const kgPorPulsoCalculados = ingredient.kgPorPulso || 0;
      
      setEditingPulsos(pulsosCalculados.toString());
      setEditingKgPorPulso(kgPorPulsoCalculados.toString());
      setShowEditIngredientDialog(true);
    };

    // Función para editar ingrediente del banco
    const handleEditBankIngredient = (index: number, ingredient: RecipeIngredient) => {
      setEditingBankIngredientIndex(index);
      setEditingBankIngredientData({ ...ingredient });
      
      // Usar los valores reales de la base de datos si están disponibles
      const pulsosCalculados = ingredient.pulsos || 100;
      const kgPorPulsoCalculados = ingredient.kgPorPulso || 0;
      
      setEditingPulsos(pulsosCalculados.toString());
      setEditingKgPorPulso(kgPorPulsoCalculados.toString());
      setShowEditBankIngredientDialog(true);
    };

    // Función para guardar cambios del ingrediente editado
    const handleSaveIngredientEdit = () => {
      if (editingIngredientIndex >= 0) {
        const updatedIngredients = [...editingIngredients];
        
        // Calcular la cantidad final basada en pulsos y kg/pulsos
        const toneladasCalculadas = calculateToneladas(editingPulsos, editingKgPorPulso);
        
        updatedIngredients[editingIngredientIndex] = {
          ...editingIngredientData,
          quantity: toneladasCalculadas,
          pulsos: parseInt(editingPulsos) || 100,
          kgPorPulso: parseFloat(editingKgPorPulso) || 0
        };
        
        setEditingIngredients(updatedIngredients);
        setShowEditIngredientDialog(false);
        setEditingIngredientIndex(-1);
        setEditingPulsos('');
        setEditingKgPorPulso('');
      }
    };

    // Función para guardar cambios del ingrediente del banco editado
    const handleSaveBankIngredientEdit = () => {
      if (editingBankIngredientIndex !== null && editingBankIngredientIndex >= 0) {
        const updatedBankIngredients = [...bankIngredients];
        
        // Calcular la cantidad final basada en pulsos y kg/pulsos
        const toneladasCalculadas = calculateToneladas(editingPulsos, editingKgPorPulso);
        
        updatedBankIngredients[editingBankIngredientIndex] = {
          ...editingBankIngredientData,
          quantity: toneladasCalculadas,
          pulsos: parseInt(editingPulsos) || 100,
          kgPorPulso: parseFloat(editingKgPorPulso) || 0
        };
        
        setBankIngredients(updatedBankIngredients);
        setShowEditBankIngredientDialog(false);
        setEditingBankIngredientIndex(null);
        setEditingPulsos('');
        setEditingKgPorPulso('');
      }
    };

    // Función para crear receta
    const handleCreateRecipe = async () => {
      log('🔍 Validando formulario para crear receta:');
      log('- Nombre:', recipeForm.name);
      log('- Tipo de receta:', recipeForm.recipeTarget);
      log('- Producto ID:', recipeForm.productId);
      log('- Subcategoría ID:', recipeForm.subcategoryId);
      log('- Cantidad de salida:', recipeForm.outputQuantity);
      log('- Cantidad de ingredientes:', ingredients.length);
      log('- Ingredientes:', ingredients);
      
      // Validación según el tipo de receta
      const hasTarget = recipeForm.recipeTarget === 'product' ? recipeForm.productId : recipeForm.subcategoryId;
      
      // Validación especial para recetas "Por Banco"
      if (recipeForm.baseType === 'PER_BANK') {
        if (!recipeForm.metrosUtiles || !recipeForm.cantidadPastones) {
          log('❌ Validación falló - campos de banco faltantes');
          toast.warning('Campos requeridos faltantes', {
            description: 'Para recetas "Por Banco" debes completar los metros útiles y cantidad de pastones',
          });
          return;
        }
      }
      
      // Para recetas "Por Banco", no requerir outputQuantity
      const hasRequiredFields = recipeForm.baseType === 'PER_BANK' 
        ? recipeForm.name && hasTarget && ingredients.length > 0
        : recipeForm.name && hasTarget && recipeForm.outputQuantity && ingredients.length > 0;
      
      if (!hasRequiredFields) {
        log('❌ Validación falló');
        toast.warning('Campos incompletos', {
          description: 'Por favor completa todos los campos requeridos y agrega al menos un insumo',
        });
        return;
      }
      
      log('✅ Validación exitosa, procediendo a crear receta');

      const recipeData: any = {
        name: recipeForm.name,
        baseType: recipeForm.baseType,
        version: recipeForm.version,
        description: recipeForm.description || undefined,
        notes: recipeForm.notes || undefined,
        ingredients,
        // Campos específicos para "Por Banco"
        metrosUtiles: recipeForm.baseType === 'PER_BANK' ? parseFloat(recipeForm.metrosUtiles) : undefined,
        cantidadPastones: recipeForm.baseType === 'PER_BANK' ? parseFloat(recipeForm.cantidadPastones) : undefined,
        // Insumos del banco (solo para recetas "Por Banco")
        bankIngredients: recipeForm.baseType === 'PER_BANK' ? bankIngredients : []
      };

      // Solo agregar campos de configuración de rendimiento si NO es "Por Banco"
      if (recipeForm.baseType !== 'PER_BANK') {
        recipeData.outputQuantity = parseFloat(recipeForm.outputQuantity);
        recipeData.outputUnitLabel = recipeForm.outputUnitLabel;
        recipeData.intermediateQuantity = recipeForm.intermediateQuantity ? parseFloat(recipeForm.intermediateQuantity) : undefined;
        recipeData.intermediateUnitLabel = recipeForm.intermediateUnitLabel || undefined;
        recipeData.unitsPerItem = recipeForm.unitsPerItem ? parseFloat(recipeForm.unitsPerItem) : undefined;
      }

      // Agregar producto o subcategoría según el tipo
      if (recipeForm.recipeTarget === 'product') {
        recipeData.productId = recipeForm.productId;
      } else {
        recipeData.subcategoryId = parseInt(recipeForm.subcategoryId);
      }

      const success = await createRecipe(recipeData);

      if (success) {
        setShowCreateDialog(false);
        resetForm();
      }
    };

    // Función para resetear el formulario
    const resetForm = () => {
      setRecipeForm({
        name: '',
        productId: '',
        subcategoryId: '',
        recipeTarget: 'product',
        baseType: 'PER_BATCH',
        version: '1',
        description: '',
        notes: '',
        outputQuantity: '',
        outputUnitLabel: 'unidades',
        intermediateQuantity: '',
        intermediateUnitLabel: 'placas',
        unitsPerItem: '',
        metrosUtiles: '',
        cantidadPastones: ''
      });
      setSelectedCategoryId(undefined);
      setIngredients([]);
      setSelectedSupplyId('');
      setIngredientQuantity('');
      setPulsos('');
      setKgPorPulso('');
      // Limpiar insumos del banco
      setBankIngredients([]);
      setSelectedBankSupplyId('');
      setBankIngredientQuantity('');
      setBankPulsos('');
      setBankKgPorPulso('');
      setBankInputMode('pulsos');
    };

    // Función para ver receta
    const handleViewRecipe = async (recipe: Recipe) => {
      setSelectedRecipe(recipe);
      setShowViewDialog(true);
      
      // Cargar los ingredientes de la receta
      try {
        const recipeDetail = await fetchRecipeDetail(recipe.id);
        if (recipeDetail && recipeDetail.ingredients) {
          setSelectedRecipeDetail(recipeDetail);
        }
        
        // Si la receta está asociada a una subcategoría, cargar productos de la subcategoría
        log('🔍 Datos de la receta para debug:', {
          id: recipe.id,
          name: recipe.name,
          subcategoryId: recipe.subcategoryId,
          subcategoryName: recipe.subcategoryName,
          baseType: recipe.baseType,
          productId: recipe.productId,
          productName: recipe.productName
        });
        
        if (recipe.subcategoryId) {
          log('✅ Cargando productos de subcategoría:', recipe.subcategoryId);
          await loadSubcategoryProducts(recipe.subcategoryId);
        } else {
          log('❌ No hay subcategoryId, no se cargarán productos');
          setSubcategoryProducts([]);
          setSubcategoryCosts(null);
        }
      } catch (error) {
        console.error('Error cargando ingredientes:', error);
      }
    };

    // Función para editar receta
    const handleEditRecipe = async (recipe: Recipe) => {
      setEditingRecipe(recipe);
      setShowEditDialog(true);
      
      // Cargar los ingredientes de la receta
      try {
        const recipeDetail = await fetchRecipeDetail(recipe.id);
        if (recipeDetail && recipeDetail.ingredients) {
          setEditingIngredients(recipeDetail.ingredients);
          // También cargar los ingredientes del banco si existen
          if (recipeDetail.bankIngredients) {
            setBankIngredients(recipeDetail.bankIngredients);
          } else {
            setBankIngredients([]);
          }
        } else {
          setEditingIngredients([]);
          setBankIngredients([]);
        }
      } catch (error) {
        console.error('Error cargando ingredientes:', error);
        setEditingIngredients([]);
        setBankIngredients([]);
      }
    };

    // Función para eliminar receta
    const handleDeleteRecipe = async (recipeId: number) => {
      if (confirm('¿Estás seguro de que quieres eliminar esta receta? Esta acción no se puede deshacer.')) {
        const success = await deleteRecipe(recipeId);
        if (success) {
          toast.success('Receta eliminada', {
            description: 'La receta ha sido eliminada exitosamente',
          });
        }
      }
    };

    // Función para actualizar receta
    const handleUpdateRecipe = async () => {
      if (!editingRecipe) return;

      // Validar que haya al menos un ingrediente
      if (editingIngredients.length === 0) {
        toast.warning('Ingredientes requeridos', {
          description: 'La receta debe tener al menos un ingrediente',
        });
        return;
      }

      try {
        const updateData = {
          name: editingRecipe.name,
          productId: editingRecipe.productId?.toString(),
          subcategoryId: editingRecipe.subcategoryId,
          baseType: editingRecipe.baseType,
          version: editingRecipe.version,
          description: editingRecipe.description,
          notes: editingRecipe.notes,
          outputQuantity: editingRecipe.outputQuantity ? parseFloat(editingRecipe.outputQuantity.toString()) : undefined,
          outputUnitLabel: editingRecipe.outputUnitLabel,
          intermediateQuantity: editingRecipe.intermediateQuantity ? parseFloat(editingRecipe.intermediateQuantity.toString()) : undefined,
          intermediateUnitLabel: editingRecipe.intermediateUnitLabel,
          unitsPerItem: editingRecipe.unitsPerItem ? parseFloat(editingRecipe.unitsPerItem.toString()) : undefined,
          isActive: editingRecipe.isActive,
          // Campos específicos para recetas "Por Banco"
          metrosUtiles: editingRecipe.baseType === 'PER_BANK' ? editingRecipe.metrosUtiles : undefined,
          cantidadPastones: editingRecipe.baseType === 'PER_BANK' ? editingRecipe.cantidadPastones : undefined,
          ingredients: editingIngredients.map(ingredient => ({
            ...ingredient,
            supplyId: parseInt(ingredient.supplyId.toString()),
            quantity: parseFloat(ingredient.quantity.toString())
          })),
          // Incluir ingredientes del banco si es receta "Por Banco"
          bankIngredients: editingRecipe.baseType === 'PER_BANK' ? bankIngredients.map(ingredient => ({
            ...ingredient,
            supplyId: parseInt(ingredient.supplyId.toString()),
            quantity: parseFloat(ingredient.quantity.toString())
          })) : []
        };

        log('🔍 Datos a enviar para actualizar:', updateData);
        log('🔍 outputQuantity tipo:', typeof updateData.outputQuantity, 'valor:', updateData.outputQuantity);

        const success = await updateRecipe(editingRecipe.id, updateData);

        if (success) {
          setShowEditDialog(false);
          setEditingIngredients([]);
          toast.success('Receta actualizada', {
            description: 'La receta ha sido actualizada exitosamente',
          });
        }
      } catch (error) {
        console.error('Error actualizando receta:', error);
        toast.error('Error al actualizar', {
          description: 'No se pudo actualizar la receta. Por favor, intenta nuevamente.',
        });
      }
    };

    // Calcular costo total del batch
    const calculateTotalBatchCost = () => {
      // Calcular costo de insumos de la receta (se multiplican por pastones)
      const recipeCost = ingredients.reduce((total, ingredient) => {
        const latestPrice = getCurrentPrice(ingredient.supplyId);
        const subtotal = ingredient.quantity * latestPrice;
        log(`Ingrediente ${ingredient.supplyId}: cantidad=${ingredient.quantity}, precio=${latestPrice}, subtotal=${subtotal}`);
        return total + subtotal;
      }, 0);
      
      // Calcular costo de insumos del banco (NO se multiplican)
      const bankCost = bankIngredients.reduce((total, ingredient) => {
        const latestPrice = getCurrentPrice(ingredient.supplyId);
        const subtotal = ingredient.quantity * latestPrice;
        log(`Insumo del banco ${ingredient.supplyId}: cantidad=${ingredient.quantity}, precio=${latestPrice}, subtotal=${subtotal}`);
        return total + subtotal;
      }, 0);
      
      // Si es receta "Por Banco", multiplicar solo los insumos de la receta por la cantidad de pastones
      let finalTotal = recipeCost + bankCost;
      if (recipeForm.baseType === 'PER_BANK' && recipeForm.cantidadPastones) {
        const cantidadPastones = parseFloat(recipeForm.cantidadPastones);
        const recipeCostMultiplied = recipeCost * cantidadPastones;
        finalTotal = recipeCostMultiplied + bankCost;
        log(`Receta Por Banco: costo insumos por pastón=${recipeCost}, cantidad pastones=${cantidadPastones}, costo insumos total=${recipeCostMultiplied}, costo insumos banco=${bankCost}, total banco=${finalTotal}`);
      }
      
      log(`Total del batch: ${finalTotal}`);
      return finalTotal;
    };

    // Calcular precio de una receta específica
    const calculateRecipePrice = (recipe: Recipe) => {
      return recipePrices[recipe.id] || 0;
    };

    // Calcular costo por unidad
    const calculateCostPerUnit = (recipe: Recipe) => {
      const batchCost = calculateRecipePrice(recipe);
      
      // Para recetas "Por Banco", usar metros útiles como base de cálculo
      if (recipe.baseType === 'PER_BANK' && recipe.metrosUtiles) {
        return batchCost / recipe.metrosUtiles; // Costo por metro
      } else {
        const unitsPerBatch = recipe.outputQuantity || 1;
        return batchCost / unitsPerBatch;
      }
    };


    // Función para formatear moneda
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
        useGrouping: true, // Esto asegura que se usen comas como separadores de miles
      }).format(amount);
    };
    
    // Función para formatear números con comas (sin símbolo de moneda)
    const formatNumber = (num: number, decimals: number = 0) => {
      return new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: true, // Comas como separadores de miles
      }).format(num);
    };

    // Función para cargar receta actual para pruebas (actualizada)
    const loadCurrentRecipeForTestUpdated = async (productId: string) => {
      try {
        // Buscar la receta activa del producto
        const activeRecipe = recipes.find(r => 
          r.productId === productId && r.isActive
        );
        
        if (activeRecipe) {
          const recipeDetail = await fetchRecipeDetail(activeRecipe.id);
          if (recipeDetail && recipeDetail.ingredients) {
            // Guardar receta original para comparación
            setOriginalRecipe(recipeDetail.ingredients);
            setSelectedRecipeForComparison(activeRecipe);
            // Cargar ingredientes para simulación (con precios actuales)
            const ingredientsWithCurrentPrices = recipeDetail.ingredients.map(ingredient => ({
              ...ingredient,
              testPrice: getCurrentPrice(ingredient.supplyId)
            }));
            setTestIngredients(ingredientsWithCurrentPrices);
            setTestResults(null);
            setComparisonResults(null);
          }
        } else {
          setTestIngredients([]);
          setOriginalRecipe([]);
          setSelectedRecipeForComparison(null);
          setTestResults(null);
          setComparisonResults(null);
        }
      } catch (error) {
        console.error('Error cargando receta para prueba:', error);
        setTestIngredients([]);
        setOriginalRecipe([]);
        setTestResults(null);
        setComparisonResults(null);
      }
    };

    // Función para editar ingrediente en simulación
    const handleEditTestIngredient = (ingredient: any, index: number) => {
      setEditingTestIngredient({
        ...ingredient,
        index,
        testPulsos: ingredient.pulsos?.toString() || '100',
        testKgPorPulso: ingredient.kgPorPulso?.toString() || '0',
        testQuantity: ingredient.quantity.toString(),
        testPrice: getCurrentPrice(ingredient.supplyId).toString()
      });
      setShowEditTestDialog(true);
    };

    // Función para guardar cambios en ingrediente de simulación
    const handleSaveTestIngredientEdit = () => {
      if (!editingTestIngredient) return;

      const updatedIngredients = [...testIngredients];
      const index = editingTestIngredient.index;
      
      // Calcular nueva cantidad basada en pulsos y kg/pulsos
      const pulsos = parseFloat(editingTestIngredient.testPulsos) || 0;
      const kgPorPulso = parseFloat(editingTestIngredient.testKgPorPulso) || 0;
      const newQuantity = (pulsos * kgPorPulso) / 1000; // Convertir a toneladas
      
      updatedIngredients[index] = {
        ...updatedIngredients[index],
        quantity: newQuantity,
        pulsos: pulsos,
        kgPorPulso: kgPorPulso,
        testPrice: parseFloat(editingTestIngredient.testPrice) || 0
      };

      setTestIngredients(updatedIngredients);
      setShowEditTestDialog(false);
      setEditingTestIngredient(null);
      setTestResults(null); // Limpiar resultados para recalcular
    };

    // Función para agregar nuevo ingrediente a la simulación
    const addTestIngredient = () => {
      if (!newTestIngredient.supplyId || !newTestIngredient.quantity || !newTestIngredient.price) {
        toast.warning('Campos incompletos', {
          description: 'Por favor completa todos los campos',
        });
        return;
      }

      const selectedSupply = supplies.find(s => s.id.toString() === newTestIngredient.supplyId);
      if (!selectedSupply) {
        toast.error('Insumo no encontrado', {
          description: 'El insumo seleccionado no existe en el sistema',
        });
        return;
      }

      const newIngredient: RecipeIngredient = {
        supplyId: parseInt(newTestIngredient.supplyId),
        supplyName: selectedSupply.name,
        quantity: parseFloat(newTestIngredient.quantity),
        unitMeasure: selectedSupply.unitMeasure,
        pulsos: parseFloat(newTestIngredient.pulsos) || 0,
        kgPorPulso: parseFloat(newTestIngredient.kgPorPulso) || 0,
        testPrice: parseFloat(newTestIngredient.price)
      };

      // El historial se guardará automáticamente en el useEffect cuando cambie testIngredients
      const updatedIngredients = [...testIngredients, newIngredient];
      setTestIngredients(updatedIngredients);
      setNewTestIngredient({
        supplyId: '',
        quantity: '',
        pulsos: '',
        kgPorPulso: '',
        price: ''
      });
      setShowAddIngredientDialog(false);
      setTestResults(null); // Limpiar resultados para recalcular
    };


    // Función para deshacer (undo) - vuelve al estado original
    const handleUndo = () => {
      if (history.length === 0 || historyIndex <= 0) {
        toast.info('Ya estás en el estado original');
        return;
      }
      
      // Volver al estado original (índice 0)
      isUndoRedoRef.current = true; // Marcar que es un undo
      const originalState = history[0];
      setTestIngredients(JSON.parse(JSON.stringify(originalState))); // Deep copy
      setHistoryIndex(0);
      setTestResults(null); // Limpiar resultados para recalcular
      toast.success('Vuelto al estado original');
      setTimeout(() => {
        isUndoRedoRef.current = false; // Resetear después de que se actualice el estado
      }, 0);
    };

    // Función para rehacer (redo)
    const handleRedo = () => {
      if (historyIndex < history.length - 1) {
        isUndoRedoRef.current = true; // Marcar que es un redo
        const nextState = history[historyIndex + 1];
        setTestIngredients(JSON.parse(JSON.stringify(nextState))); // Deep copy
        setHistoryIndex(prev => prev + 1);
        setTestResults(null); // Limpiar resultados para recalcular
        toast.success('Cambio rehecho');
        setTimeout(() => {
          isUndoRedoRef.current = false; // Resetear después de que se actualice el estado
        }, 0);
      } else {
        toast.info('No hay más cambios para rehacer');
      }
    };

    // Función para eliminar ingrediente de la simulación
    const removeTestIngredient = (index: number) => {
      // El historial se guardará automáticamente en el useEffect cuando cambie testIngredients
      const updatedIngredients = testIngredients.filter((_, i) => i !== index);
      setTestIngredients(updatedIngredients);
      setTestResults(null); // Limpiar resultados para recalcular
    };

    // Función para actualizar ingrediente directamente en la tabla
    const updateTestIngredient = (index: number, field: string, value: any) => {
      // Guardar estado actual en historial solo si el valor realmente cambió
      const currentValue = testIngredients[index]?.[field as keyof RecipeIngredient];
      if (currentValue !== value) {
        // Solo guardar en historial si no estamos en medio de un cambio (evitar guardar en cada keystroke)
        // Guardaremos en onBlur en lugar de aquí para mejor UX
      }
      
      const updatedIngredients = [...testIngredients];
      
      // Si se actualiza pulsos o kg/pulsos, recalcular cantidad solo si ambos tienen valor
      if (field === 'pulsos' || field === 'kgPorPulso') {
        const pulsos = field === 'pulsos' ? (value !== undefined ? value : updatedIngredients[index].pulsos) : (updatedIngredients[index].pulsos ?? 0);
        const kgPorPulso = field === 'kgPorPulso' ? (value !== undefined ? value : updatedIngredients[index].kgPorPulso) : (updatedIngredients[index].kgPorPulso ?? 0);
        
        // Solo recalcular si ambos valores están definidos y no son null
        let newQuantity = updatedIngredients[index].quantity;
        if (pulsos !== undefined && kgPorPulso !== undefined && pulsos !== null && kgPorPulso !== null) {
          newQuantity = (pulsos * kgPorPulso) / 1000;
        }
        
        updatedIngredients[index] = {
          ...updatedIngredients[index],
          [field]: value,
          quantity: newQuantity
        };
      } else {
        updatedIngredients[index] = {
          ...updatedIngredients[index],
          [field]: value
        };
      }
      
      setTestIngredients(updatedIngredients);
      setTestResults(null); // Limpiar resultados para recalcular
    };


    // Función para guardar prueba de costos
    const saveCostTest = async () => {
      if (!testName.trim()) {
        toast.warning('Nombre requerido', {
          description: 'Por favor ingresa un nombre para la prueba',
        });
        return;
      }

      if (!selectedRecipeForComparison) {
        toast.warning('Receta no seleccionada', {
          description: 'Por favor selecciona una receta para guardar la prueba',
        });
        return;
      }

      if (testIngredients.length === 0) {
        toast.warning('Ingredientes requeridos', {
          description: 'No hay ingredientes en la prueba para guardar',
        });
        return;
      }

      try {
        // Usar totalCostResults si está disponible (comparación completa), sino usar testResults
        const finalTotalCost = totalCostResults?.totalCost || testResults?.totalCost || 0;
        const finalCostPerUnit = totalCostResults?.totalCostPerUnit || testResults?.costPerUnit || 0;
        
        const testData = {
          ingredients: testIngredients,
          totalCost: finalTotalCost,
          costPerUnit: finalCostPerUnit,
          comparisonResults: comparisonResults,
          // Incluir datos de comparación si están disponibles
          ...(totalCostResults && {
            materialsCost: totalCostResults.materialsCost,
            employeeCosts: totalCostResults.employeeCosts,
            indirectCosts: totalCostResults.indirectCosts,
            materialsCostPerUnit: totalCostResults.materialsCostPerUnit,
            employeeCostPerUnit: totalCostResults.employeeCostPerUnit,
            indirectCostPerUnit: totalCostResults.indirectCostPerUnit,
            productionQuantity: totalCostResults.productionQuantity,
            categoryName: totalCostResults.categoryName
          })
        };

        log('📤 Enviando prueba al servidor:', {
          recipeId: selectedRecipeForComparison.id,
          testName: testName.trim(),
          hasTestData: !!testData,
          totalCost: finalTotalCost,
          costPerUnit: finalCostPerUnit,
          hasTotalCostResults: !!totalCostResults,
          hasTestResults: !!testResults
        });

        const response = await fetch('/api/costs/recipe-cost-tests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipeId: selectedRecipeForComparison.id,
            testName: testName.trim(),
            notes: testNotes.trim() || null,
            testData: testData,
            totalCost: finalTotalCost,
            costPerUnit: finalCostPerUnit
          }),
        });

        log('📥 Respuesta del servidor:', response.status, response.statusText);

        if (response.ok) {
          const savedTest = await response.json();
          log('✅ Prueba guardada exitosamente:', savedTest);
          toast.success('Prueba guardada', {
            description: `La prueba "${testName.trim()}" ha sido guardada exitosamente`,
          });
          setShowSaveTestDialog(false);
          setTestName('');
          setTestNotes('');
          // Recargar las pruebas guardadas
          loadSavedTests();
        } else {
          const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
          console.error('❌ Error guardando prueba:', response.status, error);
          toast.error('Error al guardar', {
            description: error.error || 'Error desconocido',
          });
        }
      } catch (error: any) {
        console.error('❌ Error guardando prueba:', error);
        toast.error('Error al guardar', {
          description: error.message || 'Error de conexión',
        });
      }
    };


    // Función para cargar una prueba guardada
    const loadSavedTest = (test: any) => {
      log('📦 Cargando prueba guardada:', test);
      // Manejar tanto snake_case como camelCase
      const testData = test.testData || test.test_data;
      const testName = test.testName || test.test_name;
      const totalCost = test.totalCost ?? test.total_cost;
      const costPerUnit = test.costPerUnit ?? test.cost_per_unit;
      
      if (testData && testData.ingredients) {
        setTestIngredients(testData.ingredients);
        setTestResults({
          totalCost: parseFloat(totalCost?.toString() || '0'),
          costPerUnit: parseFloat(costPerUnit?.toString() || '0'),
          ingredients: testData.ingredients.map((ingredient: any) => ({
            ...ingredient,
            currentPrice: ingredient.testPrice || getCurrentPrice(ingredient.supplyId),
            totalCost: ingredient.quantity * (ingredient.testPrice || getCurrentPrice(ingredient.supplyId)),
            percentage: parseFloat(totalCost?.toString() || '0') > 0 ? ((ingredient.quantity * (ingredient.testPrice || getCurrentPrice(ingredient.supplyId))) / parseFloat(totalCost?.toString() || '0')) * 100 : 0
          }))
        });
        toast.success('Prueba cargada', {
          description: `La prueba "${testName}" ha sido cargada exitosamente`,
        });
      } else {
        console.error('❌ La prueba no tiene ingredientes:', test);
        toast.error('Error al cargar', {
          description: 'La prueba no tiene datos de ingredientes',
        });
      }
    };

    // Función para eliminar una prueba guardada
    const deleteSavedTest = async (testId: number, testName: string) => {
      if (!confirm(`¿Estás seguro de que quieres eliminar la prueba "${testName}"? Esta acción no se puede deshacer.`)) {
        return;
      }

      try {
        log('🗑️ Eliminando prueba guardada:', testId);
        const response = await fetch(`/api/costs/recipe-cost-tests/${testId}`, {
          method: 'DELETE',
        });

        log('📥 Respuesta del servidor:', response.status, response.statusText);

        if (response.ok) {
          log('✅ Prueba eliminada exitosamente');
          toast.success('Prueba eliminada', {
            description: `La prueba "${testName}" ha sido eliminada exitosamente`,
          });
          // Recargar las pruebas guardadas
          loadSavedTests();
        } else {
          const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
          console.error('❌ Error eliminando prueba:', response.status, error);
          toast.error('Error al eliminar', {
            description: error.error || 'Error desconocido',
          });
        }
      } catch (error: any) {
        console.error('❌ Error eliminando prueba:', error);
        toast.error('Error al eliminar', {
          description: error.message || 'Error de conexión',
        });
      }
    };

    // Función para cargar una receta existente para hacer pruebas
    const loadRecipeForTest = async (recipe: Recipe, clearProduct: boolean = false) => {
      try {
        // Cargar los detalles de la receta
        const recipeDetail = await fetchRecipeDetail(recipe.id);
        if (!recipeDetail || !recipeDetail.ingredients) {
          alert('No se pudieron cargar los ingredientes de la receta');
          return;
        }

        // Convertir los ingredientes de la receta a formato de prueba
        const testIngredients = recipeDetail.ingredients.map((ingredient: any) => ({
          supplyId: ingredient.supplyId,
          supplyName: ingredient.supplyName,
          quantity: ingredient.quantity,
          unitMeasure: ingredient.unitMeasure,
          pulsos: ingredient.pulsos || 0,
          kgPorPulso: ingredient.kgPorPulso || 0,
          testPrice: getCurrentPrice(ingredient.supplyId) // Usar precio actual como precio de prueba
        }));

        // Establecer los ingredientes de prueba
        setTestIngredients(testIngredients);
        
        // Establecer la receta original para comparación (con el precio que tenía al cargar)
        const originalRecipeWithPrice = recipeDetail.ingredients.map((ingredient: any) => ({
          ...ingredient,
          testPrice: getCurrentPrice(ingredient.supplyId) // Guardar el precio original al momento de cargar
        }));
        setOriginalRecipe(originalRecipeWithPrice);
        
        // Inicializar historial con el estado inicial
        setHistory([JSON.parse(JSON.stringify(testIngredients))]);
        setHistoryIndex(0);
        
        // Solo limpiar el producto si se está cargando desde "cualquier receta" (no desde producto)
        if (clearProduct) {
          setSelectedProductForTest('');
        }
        
        log('Receta cargada para pruebas:', recipe.name, testIngredients);
      } catch (error) {
        console.error('Error cargando receta para pruebas:', error);
        toast.error('Error al cargar', {
          description: 'No se pudo cargar la receta. Por favor, intenta nuevamente.',
        });
      }
    };

    // Función para guardar nueva receta (nueva versión)
    const handleSaveNewRecipe = async () => {
      if (!selectedRecipeForComparison || !currentCompany?.id) {
        toast.warning('Datos faltantes', {
          description: 'No hay receta seleccionada o empresa',
        });
        return;
      }

      if (!newRecipeName || !newRecipeName.trim()) {
        toast.warning('Nombre requerido', {
          description: 'Por favor ingresa un nombre para la receta',
        });
        return;
      }

      if (!newRecipeVersion || !newRecipeVersion.trim()) {
        toast.warning('Versión requerida', {
          description: 'Por favor ingresa una versión para la receta',
        });
        return;
      }

      if (testIngredients.length === 0) {
        toast.warning('Ingredientes requeridos', {
          description: 'No hay ingredientes para guardar',
        });
        return;
      }

      try {
        const recipeDetail = await fetchRecipeDetail(selectedRecipeForComparison.id);
        if (!recipeDetail) {
          alert('Error al cargar los detalles de la receta');
          return;
        }

        // Verificar si ya existe una receta con el mismo nombre y versión
        const existingRecipe = recipes.find(
          r => r.name === newRecipeName.trim() && 
               r.version === newRecipeVersion.trim() &&
               r.productId === recipeDetail.productId?.toString()
        );

        if (existingRecipe) {
          const confirmMessage = `Ya existe una receta "${newRecipeName.trim()}" versión ${newRecipeVersion.trim()} para este producto. ¿Deseas crear otra versión?`;
          if (!confirm(confirmMessage)) {
            return;
          }
        }

        const newIngredients = testIngredients.map(ing => ({
          supplyId: ing.supplyId,
          supplyName: ing.supplyName,
          quantity: ing.quantity,
          unitMeasure: ing.unitMeasure || 'kg',
          pulsos: ing.pulsos || 0,
          kgPorPulso: ing.kgPorPulso || 0
        }));

        // Preparar los datos de la receta
        // IMPORTANTE: Usar el nombre EXACTO de la receta original para que sea una versión, no una receta nueva
        const recipeData: any = {
          name: selectedRecipeForComparison.name, // Nombre exacto de la receta original (no modificable)
          productId: recipeDetail.productId?.toString(),
          subcategoryId: recipeDetail.subcategoryId,
          baseType: recipeDetail.baseType || 'PER_BATCH',
          version: newRecipeVersion.trim(),
          description: recipeDetail.description || '',
          notes: recipeDetail.notes || '',
          outputUnitLabel: recipeDetail.outputUnitLabel || 'unidades',
          intermediateUnitLabel: recipeDetail.intermediateUnitLabel || 'placas',
          isActive: false,
          ingredients: newIngredients.map(ingredient => ({
            supplyId: parseInt(ingredient.supplyId.toString()),
            quantity: parseFloat(ingredient.quantity.toString()),
            unitMeasure: ingredient.unitMeasure || 'kg',
            pulsos: ingredient.pulsos || 0,
            kgPorPulso: ingredient.kgPorPulso || 0
          })),
          bankIngredients: recipeDetail.baseType === 'PER_BANK' && recipeDetail.bankIngredients 
            ? recipeDetail.bankIngredients.map(ingredient => ({
                supplyId: parseInt(ingredient.supplyId.toString()),
                quantity: parseFloat(ingredient.quantity.toString()),
                unitMeasure: ingredient.unitMeasure || 'kg',
                pulsos: ingredient.pulsos || 0,
                kgPorPulso: ingredient.kgPorPulso || 0
              })) 
            : []
        };

        // Solo agregar outputQuantity si existe y no es PER_BANK
        if (recipeDetail.baseType !== 'PER_BANK' && recipeDetail.outputQuantity) {
          recipeData.outputQuantity = parseFloat(recipeDetail.outputQuantity.toString());
        }

        // Solo agregar campos intermedios si existen
        if (recipeDetail.intermediateQuantity) {
          recipeData.intermediateQuantity = parseFloat(recipeDetail.intermediateQuantity.toString());
        }
        if (recipeDetail.unitsPerItem) {
          recipeData.unitsPerItem = parseFloat(recipeDetail.unitsPerItem.toString());
        }

        // Solo agregar campos de banco si es PER_BANK
        if (recipeDetail.baseType === 'PER_BANK') {
          if (recipeDetail.metrosUtiles) {
            recipeData.metrosUtiles = parseFloat(recipeDetail.metrosUtiles.toString());
          }
          if (recipeDetail.cantidadPastones) {
            recipeData.cantidadPastones = parseInt(recipeDetail.cantidadPastones.toString());
          }
        }

        const success = await createRecipe(recipeData);

        if (success) {
          toast.success('Nueva versión creada', {
            description: `La versión "${selectedRecipeForComparison.name}" v${newRecipeVersion.trim()} ha sido creada exitosamente como INACTIVA. Puedes activarla cuando estés listo.`,
            duration: 5000,
          });
          setShowNewRecipeDialog(false);
          setNewRecipeName('');
          setNewRecipeVersion('1');
          refreshData();
        }
      } catch (error: any) {
        console.error('Error creando nueva receta:', error);
        toast.error('Error al crear', {
          description: error.message || 'Error desconocido',
        });
      }
    };

    // Función para activar/desactivar receta
    const handleToggleRecipeActive = async (recipe: Recipe) => {
      try {
        const recipeDetail = await fetchRecipeDetail(recipe.id);
        if (!recipeDetail) {
          alert('Error al cargar los detalles de la receta');
          return;
        }

        const updateData = {
          ...recipe,
          name: recipe.name,
          productId: recipe.productId,
          subcategoryId: recipe.subcategoryId,
          baseType: recipe.baseType,
          version: recipe.version,
          description: recipe.description || '',
          notes: recipe.notes || '',
          outputQuantity: recipe.outputQuantity,
          outputUnitLabel: recipe.outputUnitLabel,
          intermediateQuantity: recipe.intermediateQuantity,
          intermediateUnitLabel: recipe.intermediateUnitLabel,
          unitsPerItem: recipe.unitsPerItem,
          isActive: !recipe.isActive,
          ingredients: recipeDetail.ingredients || [],
          bankIngredients: recipeDetail.bankIngredients || [],
          metrosUtiles: recipe.metrosUtiles,
          cantidadPastones: recipe.cantidadPastones
        };

        const success = await updateRecipe(recipe.id, updateData);
        if (success) {
          refreshData();
        }
      } catch (error) {
        console.error('Error cambiando estado de receta:', error);
        toast.error('Error al cambiar estado', {
          description: 'No se pudo cambiar el estado de la receta. Por favor, intenta nuevamente.',
        });
      }
    };

    // Filtrar recetas según búsqueda y filtros
    const filteredRecipes = useMemo(() => {
      return recipes.filter(recipe => {
        // Filtro por búsqueda
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          const matchesSearch = 
            recipe.name.toLowerCase().includes(searchLower) ||
            recipe.version.toLowerCase().includes(searchLower) ||
            recipe.productName?.toLowerCase().includes(searchLower) ||
            recipe.subcategoryName?.toLowerCase().includes(searchLower) ||
            recipe.description?.toLowerCase().includes(searchLower);
          
          if (!matchesSearch) return false;
        }

        // Filtro por producto
        if (filterProductId !== 'all') {
          if (recipe.productId?.toString() !== filterProductId) return false;
        }

        // Filtro por estado activo/inactivo
        if (filterActive === 'active' && !recipe.isActive) return false;
        if (filterActive === 'inactive' && recipe.isActive) return false;

        return true;
      });
    }, [recipes, searchTerm, filterProductId, filterActive]);

    // Función para enviar receta
    const handleSendRecipe = async (recipe: Recipe) => {
      try {
        // Cargar los ingredientes de la receta
        const recipeDetail = await fetchRecipeDetail(recipe.id);
        if (!recipeDetail || !recipeDetail.ingredients) {
          alert('No se pudieron cargar los ingredientes de la receta');
          return;
        }

        // Generar el reporte
        const reportData = {
          receta: {
            nombre: recipe.name,
            producto: recipe.productName,
            version: recipe.version,
            cantidadSalida: recipe.outputQuantity,
            unidadSalida: recipe.outputUnitLabel,
            fecha: new Date().toLocaleDateString('es-AR'),
            empresa: currentCompany?.name || 'Empresa'
          },
          ingredientes: recipeDetail.ingredients.map((ingredient: any) => {
            // Usar los valores reales de pulsos y kg/pulsos de la base de datos
            const toneladas = parseFloat(ingredient.quantity) || 0;
            const kilos = toneladas * 1000; // Convertir a kilos
            
            // Usar los valores reales guardados en la base de datos
            const pulsos = ingredient.pulsos || 100; // Valor por defecto si no existe
            const kgPorPulso = ingredient.kgPorPulso || 0; // Valor real de la BD
            
            return {
              nombre: ingredient.supplyName,
              pulsos: pulsos,
              kgPorPulso: kgPorPulso.toFixed(2),
              cantidadKilos: kilos.toFixed(2),
              unidad: ingredient.unitMeasure
            };
          })
        };

        // Crear el contenido del reporte
        const reportContent = `
REPORTE DE RECETA
================

Empresa: ${reportData.receta.empresa}
Fecha: ${reportData.receta.fecha}

INFORMACIÓN DE LA RECETA:
- Nombre: ${reportData.receta.nombre}
- Producto: ${reportData.receta.producto}
- Versión: ${reportData.receta.version}
- Cantidad de Salida: ${reportData.receta.cantidadSalida} ${reportData.receta.unidadSalida}

INGREDIENTES:
${reportData.ingredientes.map((ing: any, index: number) => `
${index + 1}. ${ing.nombre}
   - Pulsos: ${ing.pulsos}
   - kg/pulsos: ${ing.kgPorPulso}
   - Cantidad: ${ing.cantidadKilos} kg
   - Unidad: ${ing.unidad}
`).join('')}

Total de ingredientes: ${reportData.ingredientes.length}
        `.trim();

        // Crear y descargar el archivo
        const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `receta_${recipe.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success('Reporte generado', {
          description: 'El reporte de receta ha sido generado y descargado exitosamente',
        });

      } catch (error) {
        console.error('Error generando reporte:', error);
        toast.error('Error al generar reporte', {
          description: 'No se pudo generar el reporte de la receta. Por favor, intenta nuevamente.',
        });
      }
    };

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Cargando recetas...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-red-600">Error: {error}</div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-medium text-foreground">Recetas</h1>
            <p className="text-sm text-muted-foreground">Gestiona las listas de materiales (BOM) de tus productos</p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowCreateDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Receta
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="recetas" className="space-y-4">
          <TabsList className="w-full sm:w-fit bg-muted/40 border border-border rounded-md p-1 h-auto flex flex-wrap gap-1">
            <TabsTrigger value="recetas" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Recetas
            </TabsTrigger>
            <TabsTrigger value="pruebas" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              Pruebas de Costos
            </TabsTrigger>
          </TabsList>

          {/* Pestaña: Recetas */}
          <TabsContent value="recetas" className="space-y-4">

            {/* KPIs Mejorados */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: userColors.chart1 }}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Recetas</p>
                      <p className="text-3xl font-bold mt-1" style={{ color: userColors.chart1 }}>{recipes.length}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        fórmulas registradas
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: userColors.chart1 + '20' }}>
                      <BookOpen className="h-6 w-6" style={{ color: userColors.chart1 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: userColors.chart2 }}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Recetas Activas</p>
                      <p className="text-3xl font-bold mt-1" style={{ color: userColors.chart2 }}>{recipes.filter(r => r.isActive).length}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        en producción
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: userColors.chart2 + '20' }}>
                      <Package className="h-6 w-6" style={{ color: userColors.chart2 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: userColors.chart4 }}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Insumos</p>
                      <p className="text-3xl font-bold mt-1" style={{ color: userColors.chart4 }}>
                        {recipes.reduce((total, r) => total + r.ingredientCount, 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ingredientes usados
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: userColors.chart4 + '20' }}>
                      <Calculator className="h-6 w-6" style={{ color: userColors.chart4 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: userColors.chart3 }}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Costo Promedio</p>
                      <p className="text-2xl font-bold mt-1" style={{ color: userColors.chart3 }}>
                        {formatCurrency(
                          recipes.length > 0
                            ? Object.values(recipePrices).reduce((sum, price) => sum + price, 0) / recipes.length
                            : 0
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        por receta
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: userColors.chart3 + '20' }}>
                      <DollarSign className="h-6 w-6" style={{ color: userColors.chart3 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: userColors.chart6 }}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Costo Total</p>
                      <p className="text-2xl font-bold mt-1" style={{ color: userColors.chart6 }}>
                        {formatCurrency(
                          Object.values(recipePrices).reduce((sum, price) => sum + price, 0)
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        todas las recetas
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: userColors.chart6 + '20' }}>
                      <TrendingUp className="h-6 w-6" style={{ color: userColors.chart6 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

        {/* Lista de Recetas */}
        <Card className="border-t-4" style={{ borderTopColor: userColors.chart1 }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: userColors.chart1 + '20' }}>
                  <BookOpen className="h-5 w-5" style={{ color: userColors.chart1 }} />
                </div>
                <div>
                  <CardTitle className="text-base">Recetas Existentes</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Gestiona las fórmulas de producción de tus productos
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                {filteredRecipes.length} de {recipes.length} recetas
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Búsqueda y Filtros */}
            <div className="space-y-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Búsqueda */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre, versión, producto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                    {searchTerm && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => setSearchTerm('')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Filtro por Producto */}
                <Select value={filterProductId} onValueChange={setFilterProductId}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Todos los productos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los productos</SelectItem>
                    {products.filter(p => p.isActive).map((product) => (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Filtro por Estado */}
                <Select value={filterActive} onValueChange={(value: 'all' | 'active' | 'inactive') => setFilterActive(value)}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="active">Solo activas</SelectItem>
                    <SelectItem value="inactive">Solo inactivas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filteredRecipes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {recipes.length === 0 
                  ? 'No hay recetas creadas. Crea tu primera receta para comenzar.'
                  : 'No se encontraron recetas con los filtros seleccionados.'}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRecipes.map((recipe) => (
                  <div key={recipe.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{recipe.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {recipe.productName || recipe.subcategoryName || 'Sin asignar'} • Versión {recipe.version}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">
                          {recipe.baseType === 'PER_BATCH' ? 'Por Batea' : 
                           recipe.baseType === 'PER_M3' ? 'Por m³' : 
                           'Por Banco'}
                        </Badge>
                        {recipe.baseType === 'PER_BANK' && recipe.metrosUtiles && recipe.cantidadPastones && (
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                            {recipe.metrosUtiles}m / {recipe.cantidadPastones} pastones
                          </Badge>
                        )}
                        <Badge variant="outline">{recipe.ingredientCount} insumos</Badge>
                        <Badge variant={recipe.isActive ? "default" : "secondary"}>
                          {recipe.isActive ? 'Activa' : 'Inactiva'}
                        </Badge>
                        {recipe.notes && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            <BookOpen className="h-3 w-3 mr-1" />
                            Con notas
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2">
                        <p className="text-sm font-medium text-green-600">
                          {recipe.baseType === 'PER_BANK' ? 'Costo por metro' : 'Costo por unidad'}: {formatCurrency(calculateCostPerUnit(recipe))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {recipe.productName ? `Producto: ${recipe.productName}` : 
                           recipe.subcategoryName ? `Subcategoría: ${recipe.subcategoryName}` : 
                           'Sin asignar'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleToggleRecipeActive(recipe)}
                        className={recipe.isActive ? "text-green-600 hover:text-green-700 hover:bg-green-50" : "text-gray-600 hover:text-gray-700 hover:bg-gray-50"}
                        title={recipe.isActive ? "Desactivar receta" : "Activar receta"}
                      >
                        {recipe.isActive ? (
                          <>
                            <ToggleRight className="h-4 w-4 mr-2" />
                            Activa
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-4 w-4 mr-2" />
                            Inactiva
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleViewRecipe(recipe)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditRecipe(recipe)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedRecipe(recipe);
                          setNotesContent(recipe.notes || '');
                          setIsEditingNotes(false);
                          setShowNotesDialog(true);
                        }}
                        className={recipe.notes ? "text-amber-700 hover:text-amber-800 hover:bg-amber-50" : "text-muted-foreground hover:text-foreground"}
                      >
                        <BookOpen className="h-4 w-4 mr-2" />
                        Notas
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleSendRecipe(recipe)}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Enviar
                      </Button>
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteRecipe(recipe.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog: Crear Nueva Receta */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Crear Nueva Receta (BOM)
              </DialogTitle>
              <DialogDescription>
                Configure la lista de materiales (Bill of Materials) para un producto
              </DialogDescription>
            </DialogHeader>

            <DialogBody>
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleCreateRecipe(); }}>
              {/* Información básica */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium">Nombre de la Receta</label>
                  <Input
                    value={recipeForm.name}
                    onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
                    placeholder="Ej: Receta Bloque H8 v1"
                  />
                </div>
                
                {/* Tipo de receta */}
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium">Tipo de Receta</label>
                  <Select 
                    value={recipeForm.recipeTarget} 
                    onValueChange={(value: 'product' | 'subcategory') => {
                      setRecipeForm({ 
                        ...recipeForm, 
                        recipeTarget: value,
                        productId: '',
                        subcategoryId: '',
                        selectedCategoryId: undefined
                      });
                      setSelectedCategoryId(undefined);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Para Producto Específico</SelectItem>
                      <SelectItem value="subcategory">Para Subcategoría (Viguetas)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {recipeForm.recipeTarget === 'product' 
                      ? 'La receta se aplicará a un producto específico'
                      : 'La receta se aplicará a todos los productos de una subcategoría'
                    }
                  </p>
                </div>

                {/* Selección de producto o subcategoría */}
                {recipeForm.recipeTarget === 'product' ? (
                  <div className="space-y-2 col-span-2">
                    <label className="text-sm font-medium">Producto</label>
                    <Select value={recipeForm.productId} onValueChange={(value) => setRecipeForm({ ...recipeForm, productId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id.toString()}>
                            {product.name} {product.subcategoryName && `(${product.subcategoryName})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <>
                    {/* Selección de categoría para filtrar subcategorías */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Categoría</label>
                      <Select 
                        value={selectedCategoryId?.toString() || ''} 
                        onValueChange={(value) => {
                          const categoryId = parseInt(value);
                          setSelectedCategoryId(categoryId);
                          setRecipeForm({ ...recipeForm, subcategoryId: '' });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Selección de subcategoría */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Subcategoría</label>
                      <Select 
                        value={recipeForm.subcategoryId} 
                        onValueChange={(value) => setRecipeForm({ ...recipeForm, subcategoryId: value })}
                        disabled={!selectedCategoryId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={selectedCategoryId ? "Seleccionar subcategoría" : "Primero selecciona una categoría"} />
                        </SelectTrigger>
                        <SelectContent>
                          {subcategories.map((subcategory) => (
                            <SelectItem key={subcategory.id} value={subcategory.id.toString()}>
                              {subcategory.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Base de la Receta</label>
                  <Select value={recipeForm.baseType} onValueChange={(value: 'PER_BATCH' | 'PER_M3' | 'PER_BANK') => setRecipeForm({ ...recipeForm, baseType: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PER_BATCH">Por Batea</SelectItem>
                      <SelectItem value="PER_M3">Por m³</SelectItem>
                      <SelectItem value="PER_BANK">Por Banco</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">Base de cálculo de la receta</p>
                </div>

                {/* Campos específicos para "Por Banco" */}
                {recipeForm.baseType === 'PER_BANK' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Metros Útiles del Banco</label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={recipeForm.metrosUtiles}
                        onChange={(e) => setRecipeForm({ ...recipeForm, metrosUtiles: e.target.value })}
                        placeholder="Ej: 120.00"
                      />
                      <p className="text-sm text-muted-foreground">Total de metros útiles que produce el banco</p>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Cantidad de Pastones</label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={recipeForm.cantidadPastones}
                        onChange={(e) => setRecipeForm({ ...recipeForm, cantidadPastones: e.target.value })}
                        placeholder="Ej: 100"
                      />
                      <p className="text-sm text-muted-foreground">Total de pastones que produce el banco</p>
                    </div>
                  </>
                )}
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Versión</label>
                  <Input
                    type="number"
                    min="1"
                    value={recipeForm.version}
                    onChange={(e) => setRecipeForm({ ...recipeForm, version: e.target.value })}
                    placeholder="1"
                  />
                  <p className="text-sm text-muted-foreground">Número de versión de la receta</p>
                </div>
                
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium">Descripción (Opcional)</label>
                  <Input
                    value={recipeForm.description}
                    onChange={(e) => setRecipeForm({ ...recipeForm, description: e.target.value })}
                    placeholder="Descripción de la receta..."
                  />
                </div>
                
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium">Notas (Opcional)</label>
                  <Textarea
                    value={recipeForm.notes}
                    onChange={(e) => setRecipeForm({ ...recipeForm, notes: e.target.value })}
                    placeholder="Notas adicionales sobre la receta..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Configuración de Rendimiento - Solo para recetas que NO son "Por Banco" */}
              {recipeForm.baseType !== 'PER_BANK' && (
                <div className="space-y-4 p-4 bg-muted/10 rounded-lg border border-border/30">
                  <div>
                    <h4 className="text-lg font-medium mb-2">Configuración de Rendimiento</h4>
                    <p className="text-sm text-muted-foreground">Configure cuántos productos y placas produce esta receta</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Cantidad de Unidad de Medida</label>
                      <Input
                        type="number"
                        min="0.00001"
                        step="0.00001"
                        value={recipeForm.outputQuantity}
                        onChange={(e) => {
                          setRecipeForm({ ...recipeForm, outputQuantity: e.target.value });
                          // Calcular automáticamente cuando cambie
                          setTimeout(calculateUnitsPerItem, 100);
                        }}
                        placeholder="Ej: 241.2"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Unidad de Medida</label>
                      <Input
                        value={recipeForm.outputUnitLabel}
                        onChange={(e) => setRecipeForm({ ...recipeForm, outputUnitLabel: e.target.value })}
                        placeholder="Ej: unidades, kg, litros"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Cantidad de Unidad de Medida</label>
                      <Input
                        type="number"
                        min="0.00001"
                        step="0.00001"
                        value={recipeForm.intermediateQuantity}
                        onChange={(e) => {
                          setRecipeForm({ ...recipeForm, intermediateQuantity: e.target.value });
                          // Calcular automáticamente cuando cambie
                          setTimeout(calculateUnitsPerItem, 100);
                        }}
                        placeholder="Ej: 13.4"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nombre de la Unidad de Medida</label>
                      <Input
                        value={recipeForm.intermediateUnitLabel}
                        onChange={(e) => setRecipeForm({ ...recipeForm, intermediateUnitLabel: e.target.value })}
                        placeholder="Ej: placas, moldes, piezas"
                      />
                    </div>
                    
                    <div className="space-y-2 col-span-2">
                      <label className="text-sm font-medium">Unidades por {recipeForm.intermediateUnitLabel || 'placa'}</label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={recipeForm.unitsPerItem}
                        onChange={(e) => setRecipeForm({ ...recipeForm, unitsPerItem: e.target.value })}
                        placeholder="Se calcula automáticamente"
                        className="bg-muted"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Insumos de la Receta */}
              <div className="space-y-4">
                                 <div className="flex items-center justify-between">
                   <div>
                     <h4 className="text-lg font-medium">Insumos de la Receta</h4>
                     <p className="text-sm text-muted-foreground">
                       {recipeForm.baseType === 'PER_BANK' 
                         ? 'Agregue los insumos necesarios con sus cantidades para producir 1 pastón'
                         : 'Agregue los insumos necesarios con sus cantidades para producir 1 batch'
                       }
                       <span className="ml-2 text-blue-600 font-medium">
                         ({ingredients.length} ingrediente{ingredients.length !== 1 ? 's' : ''} agregado{ingredients.length !== 1 ? 's' : ''})
                       </span>
                     </p>
                   </div>
                   <div className="text-right">
                     <div className="text-sm text-muted-foreground">
                       {recipeForm.baseType === 'PER_BANK' ? 'Costo total del banco:' : 'Costo total del batch:'}
                     </div>
                     <div className="text-xl font-bold text-primary">
                       {formatCurrency(calculateTotalBatchCost())}
                     </div>
                   </div>
                 </div>

                {/* Lista de insumos */}
                <div className="space-y-3">
                  {ingredients.map((ingredient, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-end p-4 border border-border/30 rounded-lg">
                      <div className="col-span-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Insumo</label>
                          <div className="h-10 flex items-center text-sm text-muted-foreground">
                            {ingredient.supplyName} ({ingredient.unitMeasure})
                          </div>
                        </div>
                      </div>
                      
                      <div className="col-span-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Cantidad</label>
                          <div className="h-10 flex items-center text-sm text-muted-foreground">
                            {ingredient.quantity}
                          </div>
                        </div>
                      </div>
                      
                                           <div className="col-span-2">
                       <label className="text-sm font-medium">Precio Unitario</label>
                       <div className="h-10 flex items-center text-sm text-muted-foreground">
                         {(() => {
                           const price = getCurrentPrice(ingredient.supplyId);
                           return price > 0 ? formatCurrency(price) : '-';
                         })()}
                       </div>
                     </div>
                     
                     <div className="col-span-1">
                       <label className="text-sm font-medium">Subtotal</label>
                       <div className="h-10 flex items-center font-bold text-primary text-sm">
                         {(() => {
                           const price = getCurrentPrice(ingredient.supplyId);
                           return price > 0 ? formatCurrency(ingredient.quantity * price) : '-';
                         })()}
                       </div>
                     </div>
                      
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeIngredient(index)}
                          className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Agregar nuevo insumo */}
                <div className="space-y-4 p-4 border border-border/30 rounded-lg">
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Insumo</label>
                        <Select value={selectedSupplyId} onValueChange={setSelectedSupplyId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar insumo" />
                          </SelectTrigger>
                          <SelectContent>
                            {supplies.filter(s => s.isActive).map((supply) => (
                              <SelectItem key={supply.id} value={supply.id.toString()}>
                                {supply.name} ({supply.unitMeasure})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Toggle para modo de entrada */}
                  <div className="flex items-center space-x-4">
                    <label className="text-sm font-medium">Modo de entrada:</label>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setInputMode('pulsos')}
                        className={`px-3 py-1 text-xs rounded-md ${
                          inputMode === 'pulsos' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        Por Pulsos
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputMode('direct')}
                        className={`px-3 py-1 text-xs rounded-md ${
                          inputMode === 'direct' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        Directo en TN
                      </button>
                    </div>
                  </div>

                  {inputMode === 'pulsos' ? (
                    <div className="grid grid-cols-12 gap-3 items-end">
                  
                  <div className="col-span-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Pulsos</label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={pulsos}
                        onChange={(e) => {
                          setPulsos(e.target.value);
                          // Calcular automáticamente las toneladas
                          const toneladas = calculateToneladas(e.target.value, kgPorPulso);
                          setIngredientQuantity(toneladas.toString());
                        }}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  
                  <div className="col-span-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">kg/pulsos</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={kgPorPulso}
                        onChange={(e) => {
                          setKgPorPulso(e.target.value);
                          // Calcular automáticamente las toneladas
                          const toneladas = calculateToneladas(pulsos, e.target.value);
                          setIngredientQuantity(toneladas.toString());
                        }}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  
                  <div className="col-span-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Cantidad (TN)</label>
                      <Input
                        type="number"
                        min="0.00001"
                        step="0.00001"
                        value={ingredientQuantity}
                        onChange={(e) => setIngredientQuantity(e.target.value)}
                        placeholder="0"
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>
                  </div>
                  
                  <div className="col-span-1">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Precio Unitario</label>
                      <div className="h-10 flex items-center text-sm text-muted-foreground">
                        {selectedSupplyId ? 
                          (() => {
                            const price = getCurrentPrice(parseInt(selectedSupplyId));
                            return price > 0 ? formatCurrency(price) : '-';
                          })() : '-'
                        }
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-span-1">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Subtotal</label>
                      <div className="h-10 flex items-center font-bold text-primary text-sm">
                        {selectedSupplyId && ingredientQuantity ? 
                          (() => {
                            const price = getCurrentPrice(parseInt(selectedSupplyId));
                            const quantity = parseFloat(ingredientQuantity);
                            return price > 0 ? formatCurrency(quantity * price) : '-';
                          })() : '-'
                        }
                      </div>
                    </div>
                    </div>
                  </div>
                  ) : (
                    <div className="grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Cantidad (TN)</label>
                          <Input
                            type="number"
                            min="0.00001"
                            step="0.00001"
                            value={ingredientQuantity}
                            onChange={(e) => setIngredientQuantity(e.target.value)}
                            placeholder="0"
                          />
                          <p className="text-xs text-muted-foreground">
                            Ingrese directamente la cantidad en toneladas
                          </p>
                        </div>
                      </div>
                      
                      <div className="col-span-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Precio Unitario</label>
                          <div className="h-10 flex items-center text-sm text-muted-foreground">
                            {selectedSupplyId ? 
                              (() => {
                                const price = getCurrentPrice(parseInt(selectedSupplyId));
                                return price > 0 ? formatCurrency(price) : '-';
                              })() : '-'
                            }
                          </div>
                        </div>
                      </div>
                      
                      <div className="col-span-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Subtotal</label>
                          <div className="h-10 flex items-center font-bold text-primary text-sm">
                            {selectedSupplyId && ingredientQuantity ? 
                              (() => {
                                const price = getCurrentPrice(parseInt(selectedSupplyId));
                                const quantity = parseFloat(ingredientQuantity);
                                return price > 0 ? formatCurrency(quantity * price) : '-';
                              })() : '-'
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addIngredient}
                    disabled={!selectedSupplyId || !ingredientQuantity}
                    className="flex-1"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Insumo
                  </Button>
                </div>
              </div>

              {/* Insumos del Banco - Solo para recetas "Por Banco" */}
              {recipeForm.baseType === 'PER_BANK' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-medium">Insumos del Banco</h4>
                      <p className="text-sm text-muted-foreground">
                        Agregue los insumos que se aplican directamente al banco completo (NO se multiplican por pastones)
                      </p>
                    </div>
                  </div>

                  {/* Lista de insumos del banco */}
                  {bankIngredients.length > 0 && (
                    <div className="space-y-2">
                      {bankIngredients.map((ingredient, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">{ingredient.supplyName}</div>
                            <div className="text-sm text-muted-foreground">
                              {ingredient.quantity} {ingredient.unitMeasure}
                              {ingredient.pulsos && ingredient.kgPorPulso && (
                                <span> ({ingredient.pulsos} pulsos × {ingredient.kgPorPulso} kg/pulso)</span>
                              )}
                            </div>
                          </div>
                          <div className="text-sm font-medium text-green-600">
                            {formatCurrency(ingredient.quantity * getCurrentPrice(ingredient.supplyId))}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeBankIngredient(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Formulario para agregar insumo del banco */}
                  <div className="border border-dashed border-border rounded-lg p-4">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Insumo</label>
                        <Select value={selectedBankSupplyId} onValueChange={setSelectedBankSupplyId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar insumo" />
                          </SelectTrigger>
                          <SelectContent>
                            {supplies.map((supply) => (
                              <SelectItem key={supply.id} value={supply.id.toString()}>
                                {supply.name} - {formatCurrency(getCurrentPrice(supply.id))}/{supply.unitMeasure}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Selector de modo de entrada para insumos del banco */}
                      <div className="flex space-x-2">
                        <Button
                          type="button"
                          variant={bankInputMode === 'pulsos' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setBankInputMode('pulsos')}
                        >
                          Por Pulsos
                        </Button>
                        <Button
                          type="button"
                          variant={bankInputMode === 'direct' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setBankInputMode('direct')}
                        >
                          Directo (TN)
                        </Button>
                      </div>

                      {bankInputMode === 'pulsos' ? (
                        <div className="grid grid-cols-12 gap-3 items-end">
                          <div className="col-span-2">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Pulsos</label>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={bankPulsos}
                                onChange={(e) => {
                                  setBankPulsos(e.target.value);
                                  const toneladas = calculateToneladas(e.target.value, bankKgPorPulso);
                                  setBankIngredientQuantity(toneladas.toString());
                                }}
                                placeholder="0"
                              />
                            </div>
                          </div>
                          
                          <div className="col-span-2">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">kg/pulsos</label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={bankKgPorPulso}
                                onChange={(e) => {
                                  setBankKgPorPulso(e.target.value);
                                  const toneladas = calculateToneladas(bankPulsos, e.target.value);
                                  setBankIngredientQuantity(toneladas.toString());
                                }}
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          
                          <div className="col-span-3">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Total (TN)</label>
                              <Input
                                type="number"
                                min="0"
                                step="0.00001"
                                value={bankIngredientQuantity}
                                readOnly
                                className="bg-muted"
                              />
                            </div>
                          </div>
                          
                          <div className="col-span-3">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Precio Unitario</label>
                              <Input
                                value={selectedBankSupplyId ? formatCurrency(getCurrentPrice(parseInt(selectedBankSupplyId))) : ''}
                                readOnly
                                className="bg-muted"
                              />
                            </div>
                          </div>
                          
                          <div className="col-span-2">
                            <Button
                              type="button"
                              onClick={addBankIngredient}
                              disabled={!selectedBankSupplyId || !bankIngredientQuantity}
                              className="w-full"
                            >
                              Agregar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-12 gap-3 items-end">
                          <div className="col-span-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Cantidad (TN)</label>
                              <Input
                                type="number"
                                min="0"
                                step="0.00001"
                                value={bankIngredientQuantity}
                                onChange={(e) => setBankIngredientQuantity(e.target.value)}
                                placeholder="0.00000"
                              />
                            </div>
                          </div>
                          
                          <div className="col-span-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Precio Unitario</label>
                              <Input
                                value={selectedBankSupplyId ? formatCurrency(getCurrentPrice(parseInt(selectedBankSupplyId))) : ''}
                                readOnly
                                className="bg-muted"
                              />
                            </div>
                          </div>
                          
                          <div className="col-span-4">
                            <Button
                              type="button"
                              onClick={addBankIngredient}
                              disabled={!selectedBankSupplyId || !bankIngredientQuantity}
                              className="w-full"
                            >
                              Agregar Insumo
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Receta
                </Button>
              </div>
            </form>
            </DialogBody>
          </DialogContent>
        </Dialog>

        {/* Dialog: Ver Receta */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Ver Receta
              </DialogTitle>
              <DialogDescription>
                Detalles completos de la receta y sus ingredientes
              </DialogDescription>
            </DialogHeader>

            <DialogBody>
            {selectedRecipe && (
              <div className="space-y-6">
                {/* Información básica */}
                <div className="space-y-4 p-4 bg-muted/10 rounded-lg border border-border/30">
                  <h4 className="text-lg font-medium">Información General</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Nombre</label>
                      <p className="text-lg font-semibold">{selectedRecipe.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Producto</label>
                      <p className="text-lg">{selectedRecipe.productName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Base</label>
                      <p className="text-lg">
                        {selectedRecipe.baseType === 'PER_BATCH' ? 'Por Batea' : 
                         selectedRecipe.baseType === 'PER_M3' ? 'Por m³' : 
                         'Por Banco'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Versión</label>
                      <p className="text-lg">{selectedRecipe.version}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Cantidad de Salida</label>
                      <p className="text-lg">{selectedRecipe.outputQuantity} {selectedRecipe.outputQuantity > 1 ? selectedRecipe.outputUnitLabel : selectedRecipe.outputUnitLabel.slice(0, -1)}</p>
                      {selectedRecipe.baseType === 'PER_BANK' && (
                        <div className="mt-1 space-y-1">
                          {selectedRecipe.cantidadPastones && (
                            <p className="text-sm text-blue-600 font-medium">
                              🔢 Usando {selectedRecipe.cantidadPastones} pastones
                            </p>
                          )}
                          {selectedRecipe.metrosUtiles && (
                            <p className="text-sm text-green-600 font-medium">
                              📏 {selectedRecipe.metrosUtiles}m útiles de banco
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Estado</label>
                      <Badge variant={selectedRecipe.isActive ? "default" : "secondary"}>
                        {selectedRecipe.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>
                  </div>

                  {selectedRecipe.description && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Descripción</label>
                      <p className="text-lg">{selectedRecipe.description}</p>
                    </div>
                  )}
                  
                  {selectedRecipe.notes && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Notas</label>
                      <p className="text-lg whitespace-pre-wrap">{selectedRecipe.notes}</p>
                    </div>
                  )}

                  {selectedRecipe.intermediateQuantity && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Cantidad Intermedia</label>
                      <p className="text-lg">{selectedRecipe.intermediateQuantity} {selectedRecipe.intermediateUnitLabel}</p>
                    </div>
                  )}
                </div>

                {/* Estadísticas de la receta */}
                <div className="space-y-4 p-4 bg-muted/10 rounded-lg border border-border/30">
                  <h4 className="text-lg font-medium">Estadísticas Generales</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{selectedRecipe.ingredientCount}</div>
                      <div className="text-sm text-muted-foreground">Total Insumos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {Number(selectedRecipe.outputQuantity).toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">Productos por Batch</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {selectedRecipe.isActive ? 'Sí' : 'No'}
                      </div>
                      <div className="text-sm text-muted-foreground">Disponible</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {formatCurrency(calculateCostPerUnit(selectedRecipe))}
                      </div>
                      <div className="text-sm text-muted-foreground">Costo por Unidad</div>
                    </div>
                  </div>
                </div>

                {/* Información específica para recetas Por Banco */}
                {selectedRecipe.baseType === 'PER_BANK' && (
                  <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="text-lg font-medium text-blue-900 dark:text-blue-100">Configuración del Banco</h4>
                    <div className="grid grid-cols-3 gap-4">
                      {selectedRecipe.cantidadPastones && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">{Number(selectedRecipe.cantidadPastones).toFixed(2)}</div>
                          <div className="text-sm text-muted-foreground">Pastones Utilizados</div>
                        </div>
                      )}
                      {selectedRecipe.metrosUtiles && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">{Number(selectedRecipe.metrosUtiles).toFixed(2)}m</div>
                          <div className="text-sm text-muted-foreground">Metros Útiles</div>
                        </div>
                      )}
                      {selectedRecipe.cantidadPastones && selectedRecipe.metrosUtiles && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">
                            {(selectedRecipe.metrosUtiles / selectedRecipe.cantidadPastones).toFixed(2)}m
                          </div>
                          <div className="text-sm text-muted-foreground">Metros por Pastón</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Análisis detallado de ingredientes con gráfico de pizza */}
                <div className="space-y-4 p-4 bg-muted/10 rounded-lg border border-border/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-medium">Análisis Detallado de Ingredientes</h4>
                      <p className="text-sm text-muted-foreground">
                        Composición porcentual y análisis de costos por insumo
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={chartType === 'cost' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setChartType('cost')}
                        className="flex items-center gap-2"
                      >
                        <DollarSign className="h-4 w-4" />
                        % Costo
                      </Button>
                      <Button
                        variant={chartType === 'quantity' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setChartType('quantity')}
                        className="flex items-center gap-2"
                      >
                        <Package className="h-4 w-4" />
                        % Cantidad
                      </Button>
                    </div>
                  </div>
                  
                  {(() => {
                    // Obtener ingredientes de la receta
                    const recipeDetail = selectedRecipeDetail;
                    const totalCost = calculateRecipePrice(selectedRecipe);
                    
                    // Calcular cantidades totales considerando ingredientes de receta y banco
                    const recipeQuantity = recipeDetail?.ingredients?.reduce((sum: number, ing: any) => sum + (parseFloat(ing.quantity) || 0), 0) || 0;
                    const bankQuantity = recipeDetail?.bankIngredients?.reduce((sum: number, ing: any) => sum + (parseFloat(ing.quantity) || 0), 0) || 0;
                    const totalQuantity = recipeQuantity + bankQuantity;
                    
                    if (!recipeDetail?.ingredients) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>Cargando ingredientes...</p>
                        </div>
                      );
                    }
                    
                    // Preparar datos para ingredientes de la receta
                    const recipeChartData = recipeDetail.ingredients.map((ingredient: any) => {
                      let ingredientCost = getCurrentPrice(ingredient.supplyId) * ingredient.quantity;
                      
                      // Si es receta "Por Banco", multiplicar el costo de ingredientes de receta por cantidad de pastones
                      if (selectedRecipe.baseType === 'PER_BANK' && selectedRecipe.cantidadPastones) {
                        ingredientCost *= selectedRecipe.cantidadPastones;
                      }
                      
                      const costPercentage = totalCost > 0 ? (ingredientCost / totalCost) * 100 : 0;
                      const quantityPercentage = totalQuantity > 0 ? (ingredient.quantity / totalQuantity) * 100 : 0;
                      
                      return {
                        name: ingredient.supplyName,
                        cost: ingredientCost,
                        quantity: ingredient.quantity,
                        costPercentage,
                        quantityPercentage,
                        isBank: false
                      };
                    });
                    
                    // Preparar datos para ingredientes del banco (si los hay)
                    const bankChartData = (recipeDetail.bankIngredients || []).map((ingredient: any) => {
                      const ingredientCost = getCurrentPrice(ingredient.supplyId) * ingredient.quantity; // NO se multiplica por pastones
                      const costPercentage = totalCost > 0 ? (ingredientCost / totalCost) * 100 : 0;
                      const quantityPercentage = totalQuantity > 0 ? (ingredient.quantity / totalQuantity) * 100 : 0;
                      
                      return {
                        name: `${ingredient.supplyName} (Banco)`,
                        cost: ingredientCost,
                        quantity: ingredient.quantity,
                        costPercentage,
                        quantityPercentage,
                        isBank: true
                      };
                    });
                    
                    // Combinar ambos datasets
                    const chartData = [...recipeChartData, ...bankChartData];
                    
                    // Configurar colores para el gráfico
                    const colors = [
                      '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
                      '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
                    ];
                    
                    const chartConfig = {
                      labels: chartData.map((item: any) => item.name),
                      datasets: [{
                        data: chartData.map((item: any) => 
                          chartType === 'cost' ? item.costPercentage : item.quantityPercentage
                        ),
                        backgroundColor: colors.slice(0, chartData.length),
                        borderColor: colors.slice(0, chartData.length).map((color: string) => color + '80'),
                        borderWidth: 2,
                      }]
                    };
                    
                    const options = {
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'right' as const,
                          labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                              size: 12
                            }
                          }
                        },
                        tooltip: {
                          callbacks: {
                            label: function(context: any) {
                              const item = chartData[context.dataIndex];
                              const value = context.parsed;
                              const unit = chartType === 'cost' ? 'del costo total' : 'de la cantidad total';
                              return `${item.name}: ${value.toFixed(1)}% ${unit}`;
                            }
                          }
                        }
                      }
                    };
                    
                    return (
                      <div className="space-y-4">
                        {/* Gráfico de pizza */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                          <div className="flex items-center justify-center mb-4">
                            <PieChart className="h-5 w-5 mr-2" />
                            <h5 className="font-semibold">
                              {chartType === 'cost' ? 'Distribución por Costo' : 'Distribución por Cantidad'}
                            </h5>
                          </div>
                          <div className="h-80">
                            <Pie data={chartConfig} options={options} />
                          </div>
                        </div>
                        
                        {/* Tabla de detalles */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                          <h5 className="font-semibold mb-3">Detalles por Ingrediente</h5>
                          <div className="space-y-2">
                            {chartData.map((item: any, index: number) => {
                              // Encontrar la unidad de medida correcta
                              let unitMeasure = 'TN';
                              if (!item.isBank && recipeDetail.ingredients[index - bankChartData.length]) {
                                unitMeasure = recipeDetail.ingredients[index - bankChartData.length].unitMeasure;
                              } else if (item.isBank) {
                                const bankIndex = index - recipeChartData.length;
                                if (recipeDetail.bankIngredients && recipeDetail.bankIngredients[bankIndex]) {
                                  unitMeasure = recipeDetail.bankIngredients[bankIndex].unitMeasure;
                                }
                              } else if (recipeDetail.ingredients[index]) {
                                unitMeasure = recipeDetail.ingredients[index].unitMeasure;
                              }
                              
                              return (
                                <div key={index} className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-700">
                                  <div className="flex items-center gap-3">
                                    <div 
                                      className="w-4 h-4 rounded-full"
                                      style={{ backgroundColor: colors[index] }}
                                    ></div>
                                    <div>
                                      <div className="font-medium">{item.name}</div>
                                      <div className="text-sm text-muted-foreground">
                                        {item.quantity} {unitMeasure}
                                        {item.isBank && <span className="ml-1 text-xs bg-blue-100 text-blue-800 px-1 rounded">BANCO</span>}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold">
                                      {chartType === 'cost' 
                                        ? formatCurrency(item.cost)
                                        : `${item.quantityPercentage.toFixed(1)}%`
                                      }
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {chartType === 'cost' 
                                        ? `${item.costPercentage.toFixed(1)}% del costo`
                                        : `${item.costPercentage.toFixed(1)}% del costo`
                                      }
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        {/* Resumen total */}
                        <div className="p-4 border-2 border-primary rounded-lg bg-primary/5">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-bold text-lg">Total de la Receta</h5>
                              <p className="text-sm text-muted-foreground">
                                {Number(totalQuantity).toFixed(3)} unidades • {chartData.length} insumos
                                {bankChartData.length > 0 && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-1 rounded">{bankChartData.length} del banco</span>}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-primary">
                                {formatCurrency(totalCost)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Costo total por batch
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Sección de Productos de Subcategoría */}
                {selectedRecipe?.subcategoryId && (
                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold text-lg mb-4 text-blue-900 dark:text-blue-100">
                      Costos por Producto de la Subcategoría
                    </h4>
                    
                    {loadingSubcategoryProducts ? (
                      <div className="text-center py-4">
                        <div className="text-sm text-muted-foreground">Cargando productos...</div>
                      </div>
                    ) : subcategoryCosts ? (
                      <div className="space-y-4">
                        {/* Resumen de costos */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-white dark:bg-gray-800 rounded border">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {formatCurrency(subcategoryCosts.costPerMeter)}
                            </div>
                            <div className="text-sm text-muted-foreground">Costo por Metro</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {subcategoryCosts.summary?.totalProducts || 0}
                            </div>
                            <div className="text-sm text-muted-foreground">Productos</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">
                              {formatCurrency(subcategoryCosts.summary?.averageCost || 0)}
                            </div>
                            <div className="text-sm text-muted-foreground">Costo Promedio</div>
                          </div>
                        </div>

                        {/* Lista de productos */}
                        <div className="space-y-2">
                          <h5 className="font-medium text-blue-900 dark:text-blue-100">Productos Individuales:</h5>
                          {subcategoryProducts.filter(p => p.hasMeters).map((product, index) => (
                            <div key={product.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border">
                              <div className="flex-1">
                                <div className="font-medium">{product.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {product.meters}m • SKU: {product.sku || 'N/A'}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-lg">
                                  {formatCurrency(product.totalCost)}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {formatCurrency(product.costPerMeter)}/m × {product.meters}m
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {/* Productos sin metros detectados */}
                          {subcategoryProducts.filter(p => !p.hasMeters).length > 0 && (
                            <div className="mt-4">
                              <h6 className="font-medium text-orange-900 dark:text-orange-100 mb-2">
                                Productos sin metros detectados:
                              </h6>
                              <div className="space-y-1">
                                {subcategoryProducts.filter(p => !p.hasMeters).map((product) => (
                                  <div key={product.id} className="text-sm text-muted-foreground p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                                    {product.name} - No se pudieron extraer metros del nombre
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        <p>No hay productos activos en esta subcategoría</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Información de fechas */}
                <div className="space-y-4 p-4 bg-muted/10 rounded-lg border border-border/30">
                  <h4 className="text-lg font-medium">Información de Fechas</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Creada</label>
                      <p className="text-lg">{new Date(selectedRecipe.createdAt).toLocaleDateString('es-AR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Última Actualización</label>
                      <p className="text-lg">{new Date(selectedRecipe.updatedAt).toLocaleDateString('es-AR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</p>
                    </div>
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowViewDialog(false)}
                  >
                    Cerrar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (selectedRecipe) {
                        handleSendRecipe(selectedRecipe);
                      }
                    }}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Receta
                  </Button>
                  <Button
                    onClick={() => {
                      setShowViewDialog(false);
                      handleEditRecipe(selectedRecipe);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                </div>
              </div>
            )}
            </DialogBody>
          </DialogContent>
        </Dialog>

        {/* Dialog: Editar Receta */}
        <Dialog open={showEditDialog} onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) {
            setEditingIngredients([]);
            setBankIngredients([]);
            setSelectedSupplyId('');
            setIngredientQuantity('');
            setPulsos('');
            setKgPorPulso('');
            setSelectedBankSupplyId('');
            setBankIngredientQuantity('');
            setBankPulsos('');
            setBankKgPorPulso('');
          }
        }}>
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Editar Receta
              </DialogTitle>
              <DialogDescription>
                Modifica los datos de la receta y sus ingredientes
              </DialogDescription>
            </DialogHeader>

            <DialogBody>
            {editingRecipe && (
              <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleUpdateRecipe(); }}>
                {/* Información básica */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <label className="text-sm font-medium">Nombre de la Receta</label>
                    <Input
                      value={editingRecipe.name}
                      onChange={(e) => setEditingRecipe({ ...editingRecipe, name: e.target.value })}
                      placeholder="Ej: Receta Bloque H8 v1"
                    />
                  </div>
                  
                  <div className="space-y-2 col-span-2">
                    <label className="text-sm font-medium">Producto</label>
                    <Select 
                      value={editingRecipe.productId?.toString() || ''} 
                      onValueChange={(value) => setEditingRecipe({ ...editingRecipe, productId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id.toString()}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Base de la Receta</label>
                    <Select 
                      value={editingRecipe.baseType} 
                      onValueChange={(value: 'PER_BATCH' | 'PER_M3' | 'PER_BANK') => setEditingRecipe({ ...editingRecipe, baseType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PER_BATCH">Por Batea</SelectItem>
                        <SelectItem value="PER_M3">Por m³</SelectItem>
                        <SelectItem value="PER_BANK">Por Banco</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Versión</label>
                    <Input
                      type="number"
                      min="1"
                      value={editingRecipe.version}
                      onChange={(e) => setEditingRecipe({ ...editingRecipe, version: e.target.value })}
                      placeholder="1"
                    />
                  </div>
                  
                  <div className="space-y-2 col-span-2">
                    <label className="text-sm font-medium">Descripción (Opcional)</label>
                    <Input
                      value={editingRecipe.description || ''}
                      onChange={(e) => setEditingRecipe({ ...editingRecipe, description: e.target.value })}
                      placeholder="Descripción de la receta..."
                    />
                  </div>
                  
                  <div className="space-y-2 col-span-2">
                    <label className="text-sm font-medium">Notas (Opcional)</label>
                    <Textarea
                      value={editingRecipe.notes || ''}
                      onChange={(e) => setEditingRecipe({ ...editingRecipe, notes: e.target.value })}
                      placeholder="Notas adicionales sobre la receta..."
                      rows={3}
                    />
                  </div>
                </div>

                {/* Configuración de Rendimiento */}
                <div className="space-y-4 p-4 bg-muted/10 rounded-lg border border-border/30">
                  <div>
                    <h4 className="text-lg font-medium mb-2">Configuración de Rendimiento</h4>
                    <p className="text-sm text-muted-foreground">Configure cuántos productos y placas produce esta receta</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Cantidad de Unidad de Medida</label>
                      <Input
                        type="number"
                        min="0.00001"
                        step="0.00001"
                        value={editingRecipe.outputQuantity}
                        onChange={(e) => {
                          setEditingRecipe({ ...editingRecipe, outputQuantity: parseFloat(e.target.value) });
                          // Calcular automáticamente cuando cambie
                          setTimeout(calculateUnitsPerItemEdit, 100);
                        }}
                        placeholder="Ej: 241.2"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Unidad de Medida</label>
                      <Input
                        value={editingRecipe.outputUnitLabel}
                        onChange={(e) => setEditingRecipe({ ...editingRecipe, outputUnitLabel: e.target.value })}
                        placeholder="Ej: unidades, kg, litros"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Cantidad de Unidad de Medida</label>
                      <Input
                        type="number"
                        min="0.00001"
                        step="0.00001"
                        value={editingRecipe.intermediateQuantity || ''}
                        onChange={(e) => {
                          setEditingRecipe({ ...editingRecipe, intermediateQuantity: e.target.value ? parseFloat(e.target.value) : undefined });
                          // Calcular automáticamente cuando cambie
                          setTimeout(calculateUnitsPerItemEdit, 100);
                        }}
                        placeholder="Ej: 13.4"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nombre de la Unidad de Medida</label>
                      <Input
                        value={editingRecipe.intermediateUnitLabel || ''}
                        onChange={(e) => setEditingRecipe({ ...editingRecipe, intermediateUnitLabel: e.target.value })}
                        placeholder="Ej: placas, moldes, piezas"
                      />
                    </div>
                    
                    <div className="space-y-2 col-span-2">
                      <label className="text-sm font-medium">Unidades por {editingRecipe.intermediateUnitLabel || 'placa'}</label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={editingRecipe.unitsPerItem || ''}
                        onChange={(e) => setEditingRecipe({ ...editingRecipe, unitsPerItem: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder="Se calcula automáticamente"
                        className="bg-muted"
                      />
                    </div>
                  </div>
                </div>

                {/* Estado de la receta */}
                <div className="space-y-4 p-4 bg-muted/10 rounded-lg border border-border/30">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={editingRecipe.isActive}
                      onChange={(e) => setEditingRecipe({ ...editingRecipe, isActive: e.target.checked })}
                      className="rounded"
                    />
                    <label htmlFor="isActive" className="text-sm font-medium">
                      Receta Activa
                    </label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Las recetas inactivas no se pueden usar en la producción
                  </p>
                </div>

                {/* Gestión de Ingredientes */}
                <div className="space-y-4 p-4 bg-muted/10 rounded-lg border border-border/30">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-medium">Ingredientes de la Receta</h4>
                    <div className="text-sm text-muted-foreground">
                      {editingIngredients.length} ingrediente{editingIngredients.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  
                  {/* Lista de ingredientes actuales */}
                  <div className="space-y-3">
                    {editingIngredients.map((ingredient, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{ingredient.supplyName}</div>
                          <div className="text-sm text-muted-foreground">
                            {ingredient.quantity} {ingredient.unitMeasure}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditIngredient(index, ingredient)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingIngredients(editingIngredients.filter((_, i) => i !== index));
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Agregar nuevo ingrediente */}
                  <div className="grid grid-cols-12 gap-3 items-end p-4 border border-border/30 rounded-lg">
                    <div className="col-span-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Insumo</label>
                        <Select value={selectedSupplyId} onValueChange={setSelectedSupplyId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar insumo" />
                          </SelectTrigger>
                          <SelectContent>
                            {supplies.filter(s => s.isActive).map((supply) => (
                              <SelectItem key={supply.id} value={supply.id.toString()}>
                                {supply.name} ({supply.unitMeasure})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="col-span-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Pulsos</label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={pulsos}
                          onChange={(e) => {
                            setPulsos(e.target.value);
                            // Calcular automáticamente las toneladas
                            const toneladas = calculateToneladas(e.target.value, kgPorPulso);
                            setIngredientQuantity(toneladas.toString());
                          }}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    
                    <div className="col-span-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">kg/pulsos</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={kgPorPulso}
                          onChange={(e) => {
                            setKgPorPulso(e.target.value);
                            // Calcular automáticamente las toneladas
                            const toneladas = calculateToneladas(pulsos, e.target.value);
                            setIngredientQuantity(toneladas.toString());
                          }}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    
                    <div className="col-span-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Cantidad (TN)</label>
                        <Input
                          type="number"
                          min="0.00001"
                          step="0.00001"
                          value={ingredientQuantity}
                          onChange={(e) => setIngredientQuantity(e.target.value)}
                          placeholder="0"
                          readOnly
                          className="bg-gray-50"
                        />
                      </div>
                    </div>
                    
                    <div className="col-span-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (selectedSupplyId && ingredientQuantity) {
                            const supply = supplies.find(s => s.id === parseInt(selectedSupplyId));
                            if (supply) {
                              const newIngredient: RecipeIngredient = {
                                supplyId: parseInt(selectedSupplyId),
                                supplyName: supply.name,
                                quantity: parseFloat(ingredientQuantity),
                                unitMeasure: supply.unitMeasure,
                                pulsos: parseInt(pulsos) || 100,
                                kgPorPulso: parseFloat(kgPorPulso) || 0
                              };
                              setEditingIngredients([...editingIngredients, newIngredient]);
                              setSelectedSupplyId('');
                              setIngredientQuantity('');
                              setPulsos('');
                              setKgPorPulso('');
                            }
                          }
                        }}
                        disabled={!selectedSupplyId || !ingredientQuantity}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Ingredientes del Banco (solo para recetas "Por Banco") */}
                {editingRecipe?.baseType === 'PER_BANK' && (
                  <div className="space-y-4 p-4 bg-blue-50/50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-medium text-blue-900">Ingredientes del Banco</h4>
                      <div className="text-sm text-blue-700">
                        {bankIngredients.length} ingrediente{bankIngredients.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    
                    {/* Lista de ingredientes del banco actuales */}
                    <div className="space-y-3">
                      {bankIngredients.map((ingredient, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border border-blue-200 rounded-lg bg-white">
                          <div className="flex-1">
                            <div className="font-medium text-blue-900">{ingredient.supplyName}</div>
                            <div className="text-sm text-blue-700">
                              {ingredient.quantity} {ingredient.unitMeasure}
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditBankIngredient(index, ingredient)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setBankIngredients(bankIngredients.filter((_, i) => i !== index));
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Agregar nuevo ingrediente del banco */}
                    <div className="grid grid-cols-12 gap-3 items-end p-4 border border-blue-200 rounded-lg bg-white">
                      <div className="col-span-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-blue-900">Insumo del Banco</label>
                          <Select value={selectedBankSupplyId} onValueChange={setSelectedBankSupplyId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar insumo" />
                            </SelectTrigger>
                            <SelectContent>
                              {supplies.filter(s => s.isActive).map((supply) => (
                                <SelectItem key={supply.id} value={supply.id.toString()}>
                                  {supply.name} ({supply.unitMeasure})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="col-span-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-blue-900">Pulsos</label>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={bankPulsos}
                            onChange={(e) => {
                              setBankPulsos(e.target.value);
                              const toneladas = calculateToneladas(e.target.value, bankKgPorPulso);
                              setBankIngredientQuantity(toneladas.toString());
                            }}
                            placeholder="0"
                          />
                        </div>
                      </div>
                      
                      <div className="col-span-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-blue-900">kg/pulsos</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={bankKgPorPulso}
                            onChange={(e) => {
                              setBankKgPorPulso(e.target.value);
                              const toneladas = calculateToneladas(bankPulsos, e.target.value);
                              setBankIngredientQuantity(toneladas.toString());
                            }}
                            placeholder="0"
                          />
                        </div>
                      </div>
                      
                      <div className="col-span-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-blue-900">Cantidad (TN)</label>
                          <Input
                            type="number"
                            min="0.00001"
                            step="0.00001"
                            value={bankIngredientQuantity}
                            onChange={(e) => setBankIngredientQuantity(e.target.value)}
                            placeholder="0"
                            readOnly
                            className="bg-gray-50"
                          />
                        </div>
                      </div>
                      
                      <div className="col-span-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (selectedBankSupplyId && bankIngredientQuantity) {
                              const supply = supplies.find(s => s.id === parseInt(selectedBankSupplyId));
                              if (supply) {
                                const newBankIngredient: RecipeIngredient = {
                                  supplyId: parseInt(selectedBankSupplyId),
                                  supplyName: supply.name,
                                  quantity: parseFloat(bankIngredientQuantity),
                                  unitMeasure: supply.unitMeasure,
                                  pulsos: parseInt(bankPulsos) || 100,
                                  kgPorPulso: parseFloat(bankKgPorPulso) || 0
                                };
                                setBankIngredients([...bankIngredients, newBankIngredient]);
                                setSelectedBankSupplyId('');
                                setBankIngredientQuantity('');
                                setBankPulsos('');
                                setBankKgPorPulso('');
                              }
                            }
                          }}
                          disabled={!selectedBankSupplyId || !bankIngredientQuantity}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botones de acción */}
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditDialog(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    <Edit className="h-4 w-4 mr-2" />
                    Actualizar Receta
                  </Button>
                </div>
              </form>
            )}
            </DialogBody>
          </DialogContent>
        </Dialog>

        {/* Modal de edición de ingredientes */}
        <Dialog open={showEditIngredientDialog} onOpenChange={setShowEditIngredientDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Ingrediente</DialogTitle>
              <DialogDescription>
                Modifica la cantidad del ingrediente usando pulsos y kg/pulsos
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Insumo</label>
                <div className="mt-1 p-2 bg-muted rounded-md">
                  <span className="text-sm">{editingIngredientData.supplyName}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Pulsos</label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={editingPulsos}
                    onChange={(e) => {
                      setEditingPulsos(e.target.value);
                      // Calcular automáticamente las toneladas
                      const toneladas = calculateToneladas(e.target.value, editingKgPorPulso);
                      setEditingIngredientData({
                        ...editingIngredientData,
                        quantity: toneladas
                      });
                    }}
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">kg/pulsos</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingKgPorPulso}
                    onChange={(e) => {
                      setEditingKgPorPulso(e.target.value);
                      // Calcular automáticamente las toneladas
                      const toneladas = calculateToneladas(editingPulsos, e.target.value);
                      setEditingIngredientData({
                        ...editingIngredientData,
                        quantity: toneladas
                      });
                    }}
                    placeholder="0"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Cantidad (TN)</label>
                <Input
                  type="number"
                  min="0.00001"
                  step="0.00001"
                  value={editingIngredientData.quantity}
                  onChange={(e) => setEditingIngredientData({
                    ...editingIngredientData,
                    quantity: parseFloat(e.target.value) || 0
                  })}
                  placeholder="0"
                  readOnly
                  className="bg-gray-50"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Calculado automáticamente: Pulsos × kg/pulsos ÷ 1000
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium">Unidad de Medida</label>
                <div className="mt-1 p-2 bg-muted rounded-md">
                  <span className="text-sm">{editingIngredientData.unitMeasure}</span>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditIngredientDialog(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSaveIngredientEdit}>
                  Guardar Cambios
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de edición de ingredientes del banco */}
        <Dialog open={showEditBankIngredientDialog} onOpenChange={setShowEditBankIngredientDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-blue-900">Editar Ingrediente del Banco</DialogTitle>
              <DialogDescription>
                Modifica la cantidad del ingrediente del banco usando pulsos y kg/pulsos
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-blue-900">Insumo del Banco</label>
                <div className="mt-1 p-2 bg-blue-50 rounded-md border border-blue-200">
                  <span className="text-sm text-blue-900">{editingBankIngredientData.supplyName}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-blue-900">Pulsos</label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={editingPulsos}
                    onChange={(e) => {
                      setEditingPulsos(e.target.value);
                      // Calcular automáticamente las toneladas
                      const toneladas = calculateToneladas(e.target.value, editingKgPorPulso);
                      setEditingBankIngredientData({
                        ...editingBankIngredientData,
                        quantity: toneladas
                      });
                    }}
                    placeholder="0"
                    className="border-blue-200 focus:border-blue-400"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-blue-900">kg/pulsos</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingKgPorPulso}
                    onChange={(e) => {
                      setEditingKgPorPulso(e.target.value);
                      // Calcular automáticamente las toneladas
                      const toneladas = calculateToneladas(editingPulsos, e.target.value);
                      setEditingBankIngredientData({
                        ...editingBankIngredientData,
                        quantity: toneladas
                      });
                    }}
                    placeholder="0"
                    className="border-blue-200 focus:border-blue-400"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-blue-900">Cantidad (TN)</label>
                <Input
                  type="number"
                  min="0.00001"
                  step="0.00001"
                  value={editingBankIngredientData.quantity}
                  onChange={(e) => setEditingBankIngredientData({
                    ...editingBankIngredientData,
                    quantity: parseFloat(e.target.value) || 0
                  })}
                  placeholder="0"
                  readOnly
                  className="bg-blue-50 border-blue-200"
                />
                <p className="text-xs text-blue-700 mt-1">
                  Calculado automáticamente: Pulsos × kg/pulsos ÷ 1000
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-blue-900">Unidad de Medida</label>
                <div className="mt-1 p-2 bg-blue-50 rounded-md border border-blue-200">
                  <span className="text-sm text-blue-900">{editingBankIngredientData.unitMeasure}</span>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditBankIngredientDialog(false)}
                  className="border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSaveBankIngredientEdit}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Guardar Cambios
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal para editar ingrediente en simulación */}
        <Dialog open={showEditTestDialog} onOpenChange={setShowEditTestDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Ingrediente para Simulación</DialogTitle>
              <DialogDescription>
                Modifica precios, cantidades, pulsos y kg/pulsos para la simulación
              </DialogDescription>
            </DialogHeader>
            {editingTestIngredient && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Insumo</label>
                  <div className="mt-1 p-2 bg-muted rounded-md">
                    <span className="text-sm">{editingTestIngredient.supplyName}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Pulsos</label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={editingTestIngredient.testPulsos}
                      onChange={(e) => {
                        const pulsos = e.target.value;
                        const kgPorPulso = editingTestIngredient.testKgPorPulso;
                        const toneladas = calculateToneladas(pulsos, kgPorPulso);
                        setEditingTestIngredient({
                          ...editingTestIngredient,
                          testPulsos: pulsos,
                          testQuantity: toneladas.toString()
                        });
                      }}
                      placeholder="0"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">kg/pulsos</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingTestIngredient.testKgPorPulso}
                      onChange={(e) => {
                        const kgPorPulso = e.target.value;
                        const pulsos = editingTestIngredient.testPulsos;
                        const toneladas = calculateToneladas(pulsos, kgPorPulso);
                        setEditingTestIngredient({
                          ...editingTestIngredient,
                          testKgPorPulso: kgPorPulso,
                          testQuantity: toneladas.toString()
                        });
                      }}
                      placeholder="0"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Cantidad (TN)</label>
                  <Input
                    type="number"
                    min="0.00001"
                    step="0.00001"
                    value={editingTestIngredient.testQuantity}
                    onChange={(e) => setEditingTestIngredient({
                      ...editingTestIngredient,
                      testQuantity: e.target.value
                    })}
                    placeholder="0"
                    readOnly
                    className="bg-gray-50"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Calculado automáticamente: Pulsos × kg/pulsos ÷ 1000
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Precio de Prueba ($)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingTestIngredient.testPrice}
                    onChange={(e) => setEditingTestIngredient({
                      ...editingTestIngredient,
                      testPrice: e.target.value
                    })}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Precio actual: {formatCurrency(getCurrentPrice(editingTestIngredient.supplyId))}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Unidad de Medida</label>
                  <div className="mt-1 p-2 bg-muted rounded-md">
                    <span className="text-sm">{editingTestIngredient.unitMeasure}</span>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditTestDialog(false)}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveTestIngredientEdit}>
                    Guardar Cambios
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal para agregar ingrediente a la simulación */}
        <Dialog open={showAddIngredientDialog} onOpenChange={setShowAddIngredientDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Insumo a la Simulación</DialogTitle>
              <DialogDescription>
                Agrega un nuevo insumo para probar diferentes escenarios de costos
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Insumo</label>
                <Select 
                  value={newTestIngredient.supplyId} 
                  onValueChange={(value) => {
                    const supply = supplies.find(s => s.id.toString() === value);
                    setNewTestIngredient({
                      ...newTestIngredient,
                      supplyId: value,
                      price: supply ? getCurrentPrice(supply.id).toString() : ''
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar insumo" />
                  </SelectTrigger>
                  <SelectContent>
                    {supplies.filter(s => s.isActive).map((supply) => (
                      <SelectItem key={supply.id} value={supply.id.toString()}>
                        {supply.name} ({supply.unitMeasure})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Pulsos</label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={newTestIngredient.pulsos}
                    onChange={(e) => {
                      const pulsos = e.target.value;
                      const kgPorPulso = newTestIngredient.kgPorPulso;
                      const toneladas = calculateToneladas(pulsos, kgPorPulso);
                      setNewTestIngredient({
                        ...newTestIngredient,
                        pulsos: pulsos,
                        quantity: toneladas.toString()
                      });
                    }}
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">kg/pulsos</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newTestIngredient.kgPorPulso}
                    onChange={(e) => {
                      const kgPorPulso = e.target.value;
                      const pulsos = newTestIngredient.pulsos;
                      const toneladas = calculateToneladas(pulsos, kgPorPulso);
                      setNewTestIngredient({
                        ...newTestIngredient,
                        kgPorPulso: kgPorPulso,
                        quantity: toneladas.toString()
                      });
                    }}
                    placeholder="0"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Cantidad (TN)</label>
                <Input
                  type="number"
                  min="0.00001"
                  step="0.00001"
                  value={newTestIngredient.quantity}
                  onChange={(e) => setNewTestIngredient({
                    ...newTestIngredient,
                    quantity: e.target.value
                  })}
                  placeholder="0"
                  readOnly
                  className="bg-gray-50"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Calculado automáticamente: Pulsos × kg/pulsos ÷ 1000
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium">Precio ($)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newTestIngredient.price}
                  onChange={(e) => setNewTestIngredient({
                    ...newTestIngredient,
                    price: e.target.value
                  })}
                  placeholder="0"
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddIngredientDialog(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={addTestIngredient}>
                  Agregar Insumo
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

          </TabsContent>

          {/* Pestaña: Pruebas de Costos */}
          <TabsContent value="pruebas" className="space-y-6">
            <div className="space-y-6">
              {/* Header de Pruebas */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Pruebas de Costos</h2>
                  <p className="text-muted-foreground">Simula costos y compara con la receta actual</p>
                </div>
              </div>

              {/* Selección de Producto */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TestTube className="h-5 w-5" />
                    Cargar Receta Base
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Producto para Cargar Receta</label>
                    <div className="flex gap-2">
                      <Select 
                        value={selectedProductForTest} 
                        onValueChange={(value) => {
                          setSelectedProductForTest(value);
                          loadCurrentRecipeForTest(value);
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Seleccionar producto para cargar receta base" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id.toString()}>
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setTestIngredients([]);
                          setTestResults(null);
                          setHistory([]);
                          setHistoryIndex(-1);
                          lastSavedStateRef.current = [];
                        }}
                      >
                        Limpiar
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Selecciona un producto para cargar su receta actual como base, o comienza desde cero
                    </p>
                  </div>

                  {/* Selector de Recetas del Producto */}
                  {selectedProductForTest && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Recetas de este Producto</label>
                      <div className="flex gap-2">
                        <Select 
                          value={selectedRecipeForComparison?.id?.toString() || ''} 
                          onValueChange={(value) => {
                            const recipe = productRecipes.find(r => r.id.toString() === value);
                            if (recipe) {
                              setSelectedRecipeForComparison(recipe);
                              loadRecipeForTest(recipe, false); // No limpiar el producto cuando se selecciona desde el producto
                            }
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder={
                              loadingProductRecipes 
                                ? "Cargando recetas..." 
                                : productRecipes.length > 0 
                                  ? "Seleccionar receta del producto" 
                                  : "No hay recetas para este producto"
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            {productRecipes.map((recipe) => (
                              <SelectItem 
                                key={recipe.id} 
                                value={recipe.id.toString()}
                                className={recipe.isActive ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300" : ""}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{recipe.name} (v{recipe.version})</span>
                                  {recipe.isActive && (
                                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                      Activa
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setSelectedRecipeForComparison(null);
                            setTestIngredients([]);
                            setTestResults(null);
                            setOriginalRecipe([]);
                            setHistory([]);
                            setHistoryIndex(-1);
                            lastSavedStateRef.current = [];
                          }}
                        >
                          Limpiar
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {productRecipes.length > 0 
                          ? `Selecciona una de las ${productRecipes.length} recetas disponibles para este producto`
                          : "Este producto no tiene recetas creadas aún"
                        }
                      </p>
                    </div>
                  )}

                  {/* Selector de Todas las Recetas (solo si no hay producto seleccionado) */}
                  {!selectedProductForTest && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">O Cargar Cualquier Receta</label>
                      <div className="flex gap-2">
                        <Select 
                          value={selectedRecipeForComparison?.id?.toString() || ''} 
                          onValueChange={(value) => {
                            const recipe = recipes.find(r => r.id.toString() === value);
                            if (recipe) {
                              setSelectedRecipeForComparison(recipe);
                              loadRecipeForTest(recipe, true); // Limpiar el producto cuando se selecciona desde "cualquier receta"
                            }
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Seleccionar cualquier receta existente" />
                          </SelectTrigger>
                          <SelectContent>
                            {recipes.map((recipe) => (
                              <SelectItem 
                                key={recipe.id} 
                                value={recipe.id.toString()}
                                className={recipe.isActive ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300" : ""}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{recipe.name} - {recipe.productName} (v{recipe.version})</span>
                                  {recipe.isActive && (
                                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                      Activa
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setSelectedRecipeForComparison(null);
                            setTestIngredients([]);
                            setTestResults(null);
                            setOriginalRecipe([]);
                            setHistory([]);
                            setHistoryIndex(-1);
                            lastSavedStateRef.current = [];
                          }}
                        >
                          Limpiar
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Selecciona cualquier receta existente para cargar sus ingredientes y hacer modificaciones
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tabla de Simulación tipo Excel */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Simulación de Costos</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Modifica precios, cantidades y agrega/quita ingredientes como en Excel
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Botones de Deshacer/Rehacer */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        title="Deshacer (Ctrl+Z)"
                      >
                        <Undo2 className="h-4 w-4 mr-2" />
                        Deshacer
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRedo}
                        disabled={historyIndex >= history.length - 1}
                        title="Rehacer (Ctrl+Y)"
                      >
                        <Redo2 className="h-4 w-4 mr-2" />
                        Rehacer
                      </Button>
                      <Button 
                        onClick={() => setShowAddIngredientDialog(true)}
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar Insumo
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {testIngredients.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2 font-medium">Insumo</th>
                            <th className="text-left p-2 font-medium">Pulsos</th>
                            <th className="text-left p-2 font-medium">kg/pulsos</th>
                            <th className="text-left p-2 font-medium">Cantidad</th>
                            <th className="text-left p-2 font-medium">Unidad</th>
                            <th className="text-left p-2 font-medium">Precio</th>
                            <th className="text-left p-2 font-medium">Subtotal</th>
                            <th className="text-left p-2 font-medium">vs Original</th>
                            <th className="text-left p-2 font-medium">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {testIngredients.map((ingredient, index) => {
                            const price = ingredient.testPrice !== undefined && ingredient.testPrice !== null ? ingredient.testPrice : (getCurrentPrice(ingredient.supplyId) || 0);
                            const quantity = ingredient.quantity !== undefined && ingredient.quantity !== null ? ingredient.quantity : 0;
                            const subtotal = quantity * price;
                            const percentage = testResults?.totalCost > 0 ? (subtotal / testResults.totalCost) * 100 : 0;
                            
                            // Obtener datos de comparación
                            const comparison = comparisonResults?.ingredientComparisons?.[index];
                            const costDiff = comparison?.costDifference || 0;
                            const percentageDiff = comparison?.percentageDifference || 0;
                            
                            return (
                              <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="p-2">
                                  <div className="font-medium">{ingredient.supplyName}</div>
                                </td>
                                <td className="p-2">
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={tempInputValues[`pulsos-${index}`] !== undefined
                                      ? tempInputValues[`pulsos-${index}`]
                                      : (ingredient.pulsos !== undefined && ingredient.pulsos !== null ? ingredient.pulsos.toString() : '')}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const key = `pulsos-${index}`;
                                      
                                      setTempInputValues(prev => ({ ...prev, [key]: val }));
                                      
                                      if (val === '') {
                                        updateTestIngredient(index, 'pulsos', undefined);
                                        return;
                                      }
                                      
                                      // Solo números enteros
                                      const numVal = val.replace(/[^0-9]/g, '');
                                      if (numVal === '') {
                                        updateTestIngredient(index, 'pulsos', undefined);
                                      } else {
                                        const parsed = parseInt(numVal);
                                        if (!isNaN(parsed)) {
                                          updateTestIngredient(index, 'pulsos', parsed);
                                        }
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const val = e.target.value;
                                      const key = `pulsos-${index}`;
                                      
                                      setTempInputValues(prev => {
                                        const newVals = { ...prev };
                                        delete newVals[key];
                                        return newVals;
                                      });
                                      
                                      // El historial se guardará automáticamente en el useEffect cuando cambie testIngredients
                                      
                                      // Si queda vacío, mantener undefined (no poner 0 automáticamente)
                                      if (val === '') {
                                        return;
                                      }
                                    }}
                                    className="w-16"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={tempInputValues[`kgPorPulso-${index}`] !== undefined 
                                      ? tempInputValues[`kgPorPulso-${index}`]
                                      : (ingredient.kgPorPulso !== undefined && ingredient.kgPorPulso !== null ? ingredient.kgPorPulso.toString() : '')}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const key = `kgPorPulso-${index}`;
                                      
                                      // Guardar valor temporal mientras se escribe
                                      setTempInputValues(prev => ({ ...prev, [key]: val }));
                                      
                                      // Permitir campo vacío
                                      if (val === '') {
                                        updateTestIngredient(index, 'kgPorPulso', undefined);
                                        return;
                                      }
                                      
                                      // Filtrar solo números y punto decimal
                                      let numVal = val.replace(/[^0-9.]/g, '');
                                      // Solo permitir un punto decimal
                                      const parts = numVal.split('.');
                                      if (parts.length > 2) {
                                        numVal = parts[0] + '.' + parts.slice(1).join('');
                                        setTempInputValues(prev => ({ ...prev, [key]: numVal }));
                                      }
                                      
                                      // Actualizar solo si es un número completo válido
                                      if (numVal && numVal !== '.' && !numVal.endsWith('.')) {
                                        const parsed = parseFloat(numVal);
                                        if (!isNaN(parsed)) {
                                          updateTestIngredient(index, 'kgPorPulso', parsed);
                                        }
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const val = e.target.value;
                                      const key = `kgPorPulso-${index}`;
                                      
                                      // Limpiar valor temporal
                                      setTempInputValues(prev => {
                                        const newVals = { ...prev };
                                        delete newVals[key];
                                        return newVals;
                                      });
                                      
                                      // El historial se guardará automáticamente en el useEffect cuando cambie testIngredients
                                      
                                      // Si queda vacío o solo punto, mantener undefined
                                      if (val === '' || val === '.') {
                                        updateTestIngredient(index, 'kgPorPulso', undefined);
                                        return;
                                      }
                                      
                                      const parsed = parseFloat(val);
                                      if (!isNaN(parsed)) {
                                        updateTestIngredient(index, 'kgPorPulso', parsed);
                                      }
                                    }}
                                    className="w-20"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={tempInputValues[`quantity-${index}`] !== undefined
                                      ? tempInputValues[`quantity-${index}`]
                                      : (ingredient.quantity !== undefined && ingredient.quantity !== null ? ingredient.quantity.toString() : '')}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const key = `quantity-${index}`;
                                      
                                      setTempInputValues(prev => ({ ...prev, [key]: val }));
                                      
                                      if (val === '') {
                                        updateTestIngredient(index, 'quantity', undefined);
                                        return;
                                      }
                                      
                                      let numVal = val.replace(/[^0-9.]/g, '');
                                      const parts = numVal.split('.');
                                      if (parts.length > 2) {
                                        numVal = parts[0] + '.' + parts.slice(1).join('');
                                        setTempInputValues(prev => ({ ...prev, [key]: numVal }));
                                      }
                                      
                                      if (numVal && numVal !== '.' && !numVal.endsWith('.')) {
                                        const parsed = parseFloat(numVal);
                                        if (!isNaN(parsed)) {
                                          updateTestIngredient(index, 'quantity', parsed);
                                        }
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const val = e.target.value;
                                      const key = `quantity-${index}`;
                                      
                                      setTempInputValues(prev => {
                                        const newVals = { ...prev };
                                        delete newVals[key];
                                        return newVals;
                                      });
                                      
                                      // El historial se guardará automáticamente en el useEffect cuando cambie testIngredients
                                      
                                      if (val === '' || val === '.') {
                                        updateTestIngredient(index, 'quantity', undefined);
                                        return;
                                      }
                                      
                                      const parsed = parseFloat(val);
                                      if (!isNaN(parsed)) {
                                        updateTestIngredient(index, 'quantity', parsed);
                                      }
                                    }}
                                    className="w-20"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="p-2 text-sm text-muted-foreground">
                                  {ingredient.unitMeasure}
                                </td>
                                <td className="p-2">
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={tempInputValues[`testPrice-${index}`] !== undefined
                                      ? tempInputValues[`testPrice-${index}`]
                                      : (ingredient.testPrice !== undefined && ingredient.testPrice !== null ? ingredient.testPrice.toString() : (price !== undefined && price !== null ? price.toString() : ''))}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const key = `testPrice-${index}`;
                                      
                                      setTempInputValues(prev => ({ ...prev, [key]: val }));
                                      
                                      if (val === '') {
                                        updateTestIngredient(index, 'testPrice', undefined);
                                        return;
                                      }
                                      
                                      let numVal = val.replace(/[^0-9.]/g, '');
                                      const parts = numVal.split('.');
                                      if (parts.length > 2) {
                                        numVal = parts[0] + '.' + parts.slice(1).join('');
                                        setTempInputValues(prev => ({ ...prev, [key]: numVal }));
                                      }
                                      
                                      if (numVal && numVal !== '.' && !numVal.endsWith('.')) {
                                        const parsed = parseFloat(numVal);
                                        if (!isNaN(parsed)) {
                                          updateTestIngredient(index, 'testPrice', parsed);
                                        }
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const val = e.target.value;
                                      const key = `testPrice-${index}`;
                                      
                                      setTempInputValues(prev => {
                                        const newVals = { ...prev };
                                        delete newVals[key];
                                        return newVals;
                                      });
                                      
                                      // El historial se guardará automáticamente en el useEffect cuando cambie testIngredients
                                      
                                      if (val === '' || val === '.') {
                                        // Si queda vacío, restaurar precio original
                                        const currentPrice = getCurrentPrice(ingredient.supplyId);
                                        if (currentPrice) {
                                          updateTestIngredient(index, 'testPrice', currentPrice);
                                        } else {
                                          updateTestIngredient(index, 'testPrice', undefined);
                                        }
                                        return;
                                      }
                                      
                                      const parsed = parseFloat(val);
                                      if (!isNaN(parsed)) {
                                        updateTestIngredient(index, 'testPrice', parsed);
                                      }
                                    }}
                                    className="w-24"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="p-2 font-semibold">
                                  {formatCurrency(subtotal)}
                                </td>
                                <td className="p-2">
                                  <div className="text-sm">
                                    <div className={`font-medium ${costDiff >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {costDiff >= 0 ? '+' : ''}{formatCurrency(costDiff)}
                                    </div>
                                    <div className={`text-xs ${percentageDiff >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                                      {percentageDiff >= 0 ? '+' : ''}{percentageDiff.toFixed(1)}%
                                    </div>
                                  </div>
                                </td>
                                <td className="p-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeTestIngredient(index)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <TestTube className="h-12 w-12 mx-auto mb-4" />
                      <p>No hay ingredientes en la simulación</p>
                      <p className="text-sm">Haz clic en &quot;Agregar Insumo&quot; para comenzar</p>
                    </div>
                  )}
                  
                  {/* Campos para cálculo con empleados e indirectos */}
                  {testIngredients.length > 0 && selectedRecipeForComparison && (
                    <div className="mt-4 p-4 bg-muted/50 dark:bg-muted/30 rounded-lg border">
                      <h4 className="font-semibold mb-3 text-foreground">
                        Calcular Costo Total (con Empleados e Indirectos)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Placas por Día</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={productionPlacasPorDia || ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              setProductionPlacasPorDia(value);
                              setTotalCostResults(null);
                              setOriginalTotalCostResults(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                diasInputRef.current?.focus();
                              }
                            }}
                            placeholder="Ej: 1920"
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Cantidad de Días</label>
                          <Input
                            ref={diasInputRef}
                            type="number"
                            min="0"
                            step="1"
                            value={productionDias || ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              setProductionDias(value);
                              setTotalCostResults(null);
                              setOriginalTotalCostResults(null);
                            }}
                            placeholder="Ej: 22"
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Mes de Gastos</label>
                          <Select
                            value={productionMonth}
                            onValueChange={(value) => {
                              setProductionMonth(value);
                              setTotalCostResults(null);
                              setOriginalTotalCostResults(null);
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue>
                                {productionMonth ? (() => {
                                  const [year, month] = productionMonth.split('-');
                                  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                                  return date.toLocaleDateString('es-AR', { year: 'numeric', month: 'long' });
                                })() : 'Seleccionar mes'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {(() => {
                                const currentYear = new Date().getFullYear();
                                const months = [];
                                for (let year = currentYear - 1; year <= currentYear + 1; year++) {
                                  for (let month = 1; month <= 12; month++) {
                                    const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
                                    const date = new Date(year, month - 1, 1);
                                    const monthName = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
                                    months.push(
                                      <SelectItem key={monthStr} value={monthStr}>
                                        {monthName}
                                      </SelectItem>
                                    );
                                  }
                                }
                                return months;
                              })()}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      {/* Mostrar conversión a unidades si hay datos */}
                      {productionDias > 0 && productionPlacasPorDia > 0 && selectedRecipeForComparison?.unitsPerItem && (
                        <div className="mt-3 p-4 bg-muted rounded-lg border">
                          <div className="flex items-center gap-2 mb-2">
                            <Calculator className="h-4 w-4" />
                            <span className="text-sm font-semibold">Cálculo de Producción</span>
                          </div>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex items-center gap-2">
                              <span>{productionPlacasPorDia.toLocaleString('es-AR', { useGrouping: true })} placas/día</span>
                              <span>×</span>
                              <span>{productionDias.toLocaleString('es-AR', { useGrouping: true })} días</span>
                              <span>=</span>
                              <span className="font-semibold">{(productionPlacasPorDia * productionDias).toLocaleString('es-AR', { useGrouping: true })} placas</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span>{(productionPlacasPorDia * productionDias).toLocaleString('es-AR', { useGrouping: true })} placas</span>
                              <span>×</span>
                              <span>{Number(selectedRecipeForComparison.unitsPerItem || 0).toLocaleString('es-AR', { useGrouping: true })} unidades/placa</span>
                              <span>=</span>
                              <span className="font-bold">
                                {((productionPlacasPorDia * productionDias) * (selectedRecipeForComparison.unitsPerItem || 1)).toLocaleString('es-AR', { useGrouping: true })} unidades
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-4">
                        <Button
                          onClick={simulateCosts}
                          disabled={simulatingTotalCost || !productionDias || !productionPlacasPorDia || !productionMonth}
                          className="w-full"
                          size="lg"
                        >
                          {simulatingTotalCost ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Calculando...
                            </>
                          ) : (
                            <>
                              <Calculator className="h-4 w-4 mr-2" />
                              Calcular Costo Total
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Totales de Peso */}
                  {testIngredients.length > 0 && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 border rounded text-center">
                        <div className="text-xs text-muted-foreground mb-1">Peso Total del Pastón</div>
                        <div className="text-base font-medium">
                          {(() => {
                            const totalTN = testIngredients.reduce((sum, ing) => sum + (parseFloat(ing.quantity) || 0), 0);
                            const totalKG = Number(totalTN) * 1000;
                            return (Number(totalKG) || 0).toFixed(2);
                          })()} kg
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          ({(() => {
                            const totalTN = testIngredients.reduce((sum, ing) => sum + (parseFloat(ing.quantity) || 0), 0);
                            return (Number(totalTN) || 0).toFixed(3);
                          })()} TN)
                        </div>
                      </div>
                      
                      {(() => {
                        const aridos = ['arena gruesa', 'arena fina', 'triturado 3/9', 'polvo de piedra', 'triturado 0/6'];
                        const totalAridosTN = testIngredients
                          .filter(ing => aridos.some(arido => ing.supplyName.toLowerCase().includes(arido)))
                          .reduce((sum, ing) => sum + (parseFloat(ing.quantity) || 0), 0);
                        const totalAridosKG = Number(totalAridosTN) * 1000;
                        
                        // Obtener el nombre del producto seleccionado
                        const selectedProduct = products.find(p => p.id.toString() === selectedProductForTest);
                        const productName = selectedProduct?.name?.toLowerCase() || '';
                        
                        // Determinar si excede el límite según el tipo de producto
                        const isAdoquin = productName.includes('adoquin') || productName.includes('adoquín');
                        const isBloque = productName.includes('bloque');
                        const limiteAdoquin = 2540;
                        const limiteBloque = 2850;
                        
                        const excedeLimite = (isAdoquin && totalAridosKG > limiteAdoquin) || 
                                            (isBloque && totalAridosKG > limiteBloque);
                        
                        return (
                          <div className={`p-3 border rounded text-center ${excedeLimite ? 'border-red-300 dark:border-red-700' : ''}`}>
                            <div className={`text-xs mb-1 ${excedeLimite ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'}`}>
                              Peso Total de Áridos
                              {excedeLimite && (
                                <span className="ml-2 text-xs font-normal">
                                  (⚠️ Excede límite: {isAdoquin ? `${limiteAdoquin}kg` : `${limiteBloque}kg`})
                                </span>
                              )}
                            </div>
                            <div className={`text-base ${excedeLimite ? 'text-red-700 dark:text-red-300 font-bold' : 'font-medium'}`}>
                              {(Number(totalAridosKG) || 0).toFixed(2)} kg
                            </div>
                            <div className={`text-xs mt-1 ${excedeLimite ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                              ({(Number(totalAridosTN) || 0).toFixed(3)} TN)
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Resultados de Costo Total (con Empleados e Indirectos) - OCULTO, solo se muestra la comparación */}
              {totalCostResults && !originalTotalCostResults && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="h-5 w-5" />
                      Costo Total por Unidad (Materiales + Empleados + Indirectos)
                    </CardTitle>
                    <CardDescription>
                      Para {getProductionQuantityInUnits().toLocaleString('es-AR', { useGrouping: true })} unidades - {totalCostResults.categoryName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Resumen de Costos por Unidad */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">Materiales</div>
                        <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                          {formatCurrency(totalCostResults.materialsCostPerUnit)}
                        </div>
                        <div className="text-xs text-blue-500 dark:text-blue-400">Por unidad</div>
                      </div>
                      
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="text-sm font-medium text-green-600 dark:text-green-400">Empleados</div>
                        <div className="text-xl font-bold text-green-700 dark:text-green-300">
                          {formatCurrency(totalCostResults.employeeCostPerUnit)}
                        </div>
                        <div className="text-xs text-green-500 dark:text-green-400">Por unidad</div>
                      </div>
                      
                      <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                        <div className="text-sm font-medium text-orange-600 dark:text-orange-400">Indirectos</div>
                        <div className="text-xl font-bold text-orange-700 dark:text-orange-300">
                          {formatCurrency(totalCostResults.indirectCostPerUnit)}
                        </div>
                        <div className="text-xs text-orange-500 dark:text-orange-400">Por unidad</div>
                      </div>
                      
                      <div className="p-4 bg-muted/50 dark:bg-muted/30 rounded-lg border">
                        <div className="text-sm font-medium text-muted-foreground">Total</div>
                        <div className="text-2xl font-bold text-foreground">
                          {formatCurrency(totalCostResults.totalCostPerUnit)}
                        </div>
                        <div className="text-xs text-muted-foreground">Por unidad</div>
                      </div>
                    </div>

                    {/* Costos Totales para la Producción */}
                    <div className="p-4 bg-muted/10 rounded-lg border">
                      <h4 className="font-semibold mb-3">Costos Totales para {getProductionQuantityInUnits().toLocaleString('es-AR', { useGrouping: true })} unidades</h4>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">Materiales</div>
                          <div className="text-lg font-bold">{formatCurrency(totalCostResults.materialsCost)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Empleados</div>
                          <div className="text-lg font-bold">{formatCurrency(totalCostResults.employeeCosts)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Indirectos</div>
                          <div className="text-lg font-bold">{formatCurrency(totalCostResults.indirectCosts)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Total</div>
                          <div className="text-xl font-bold text-foreground">{formatCurrency(totalCostResults.totalCost)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Información de Distribución */}
                    <div className="p-4 bg-muted/10 rounded-lg border">
                      <h4 className="font-semibold mb-2">Distribución de Costos</h4>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span>Producción simulada:</span>
                          <span className="font-medium">{getProductionQuantityInUnits().toLocaleString('es-AR', { useGrouping: true })} unidades</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total categoría ({totalCostResults.categoryName}):</span>
                          <span className="font-medium">{totalCostResults.totalCategoryQuantity.toLocaleString('es-AR')} unidades</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Ratio de distribución:</span>
                          <span className="font-medium">{(totalCostResults.distributionRatio * 100).toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Resumen de Insumos Modificados - Aparece cuando se modifica la receta */}
              {originalRecipe.length > 0 && testIngredients.length > 0 && !showSaveTestDialog && (() => {
                // Calcular el costo total de materiales de la receta original
                const totalOriginalCost = originalRecipe.reduce((total, ing) => {
                  const price = ing.testPrice !== undefined ? ing.testPrice : (getCurrentPrice(ing.supplyId) || 0);
                  return total + (ing.quantity * price);
                }, 0);

                // Calcular diferencias en insumos
                const ingredientChanges: Array<{
                  name: string;
                  originalQty: number;
                  newQty: number;
                  difference: number;
                  percentage: number;
                  costVariationPercentage: number;
                  unitMeasure: string;
                  isNew: boolean;
                  isRemoved: boolean;
                  priceChanged: boolean;
                  originalPrice?: number;
                  newPrice?: number;
                }> = [];

                // Insumos modificados o nuevos
                testIngredients.forEach(testIng => {
                  const originalIng = originalRecipe.find(orig => orig.supplyId === testIng.supplyId);
                  
                  if (originalIng) {
                    // Insumo existente - verificar si cambió cantidad o precio
                    const qtyDiff = testIng.quantity - originalIng.quantity;
                    // Usar el precio que tenía cuando se cargó la receta original
                    const originalPrice = originalIng.testPrice !== undefined ? originalIng.testPrice : (getCurrentPrice(originalIng.supplyId) || 0);
                    const newPrice = testIng.testPrice !== undefined ? testIng.testPrice : (getCurrentPrice(testIng.supplyId) || 0);
                    const priceChanged = testIng.testPrice !== undefined && originalIng.testPrice !== undefined && testIng.testPrice !== originalIng.testPrice;
                    
                    if (qtyDiff !== 0 || priceChanged) {
                      // Variación del batch (cantidad)
                      const percentage = originalIng.quantity > 0 
                        ? (qtyDiff / originalIng.quantity) * 100 
                        : (testIng.quantity > 0 ? 100 : 0);
                      
                      // Calcular el costo del insumo original y nuevo
                      const originalCost = originalIng.quantity * originalPrice;
                      const newCost = testIng.quantity * newPrice;
                      const costDifference = newCost - originalCost;
                      
                      // Impacto en el precio total del producto
                      // Si el insumo representa X% del costo total y varía Y%, el impacto es proporcional
                      const costVariationPercentage = totalOriginalCost > 0 
                        ? (costDifference / totalOriginalCost) * 100 
                        : 0;
                      
                      ingredientChanges.push({
                        name: testIng.supplyName || 'Desconocido',
                        originalQty: originalIng.quantity,
                        newQty: testIng.quantity,
                        difference: qtyDiff,
                        percentage: percentage,
                        costVariationPercentage: costVariationPercentage,
                        unitMeasure: testIng.unitMeasure || originalIng.unitMeasure || 'kg',
                        isNew: false,
                        isRemoved: false,
                        priceChanged: priceChanged,
                        originalPrice: originalPrice,
                        newPrice: newPrice
                      });
                    }
                  } else {
                    // Nuevo insumo agregado
                    const price = testIng.testPrice !== undefined ? testIng.testPrice : (getCurrentPrice(testIng.supplyId) || 0);
                    const newCost = testIng.quantity * price;
                    // Impacto en el precio total: el nuevo costo como porcentaje del costo total original
                    const costVariationPercentage = totalOriginalCost > 0 
                      ? (newCost / totalOriginalCost) * 100 
                      : (newCost > 0 ? 100 : 0);
                    ingredientChanges.push({
                      name: testIng.supplyName || 'Desconocido',
                      originalQty: 0,
                      newQty: testIng.quantity,
                      difference: testIng.quantity,
                      percentage: 100,
                      costVariationPercentage: costVariationPercentage,
                      unitMeasure: testIng.unitMeasure || 'kg',
                      isNew: true,
                      isRemoved: false,
                      priceChanged: false,
                      newPrice: price
                    });
                  }
                });

                // Insumos eliminados
                originalRecipe.forEach(origIng => {
                  const existsInTest = testIngredients.some(test => test.supplyId === origIng.supplyId);
                  if (!existsInTest) {
                    const originalPrice = origIng.testPrice !== undefined ? origIng.testPrice : (getCurrentPrice(origIng.supplyId) || 0);
                    const originalCost = origIng.quantity * originalPrice;
                    // Impacto en el precio total: la reducción del costo eliminado como porcentaje del costo total original
                    const costVariationPercentage = totalOriginalCost > 0 
                      ? (-originalCost / totalOriginalCost) * 100 
                      : 0;
                    ingredientChanges.push({
                      name: origIng.supplyName || 'Desconocido',
                      originalQty: origIng.quantity,
                      newQty: 0,
                      difference: -origIng.quantity,
                      percentage: -100,
                      costVariationPercentage: costVariationPercentage,
                      unitMeasure: origIng.unitMeasure || 'kg',
                      isNew: false,
                      isRemoved: true,
                      priceChanged: false,
                      originalPrice: originalPrice
                    });
                  }
                });

                // Ordenar por mayor cambio absoluto
                ingredientChanges.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

                if (ingredientChanges.length === 0) {
                  return null; // No hay cambios, no mostrar resumen
                }

                // Función helper para formatear unidades
                const formatQuantity = (qty: number, unit: string) => {
                  if (unit === 'TN' || unit === 'tn' || unit === 'ton' || unit === 'tonelada') {
                    return `${qty.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 3, useGrouping: true })} TN`;
                  } else if (unit === 'KG' || unit === 'kg' || unit === 'kilogramo') {
                    if (qty >= 1000) {
                      return `${(qty / 1000).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 3, useGrouping: true })} TN`;
                    }
                    return `${qty.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })} kg`;
                  }
                  return `${qty.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })} ${unit}`;
                };

                return (
                  <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Resumen de Insumos Modificados
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Cambios en cantidades y precios de insumos
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {ingredientChanges.map((change, idx) => (
                          <div 
                            key={idx}
                            className={`p-3 rounded-lg border ${
                              change.isNew 
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                : change.isRemoved
                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm truncate">{change.name}</span>
                                  {change.isNew && (
                                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs">
                                      Nuevo
                                    </Badge>
                                  )}
                                  {change.isRemoved && (
                                    <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs">
                                      Eliminado
                                    </Badge>
                                  )}
                                  {change.priceChanged && (
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs">
                                      Precio modificado
                                    </Badge>
                                  )}
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Original: </span>
                                    <span className="font-medium">
                                      {change.originalQty > 0 ? formatQuantity(change.originalQty, change.unitMeasure) : '—'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Nuevo: </span>
                                    <span className="font-medium">
                                      {change.newQty > 0 ? formatQuantity(change.newQty, change.unitMeasure) : '—'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Variación del batch: </span>
                                    <span className={`font-medium ${
                                      change.percentage > 0 
                                        ? 'text-orange-600 dark:text-orange-400'
                                        : change.percentage < 0
                                        ? 'text-green-600 dark:text-green-400'
                                        : ''
                                    }`}>
                                      {change.percentage > 0 ? '+' : ''}
                                      {change.percentage.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Variación en el precio: </span>
                                    <span className={`font-medium ${
                                      change.costVariationPercentage > 0 
                                        ? 'text-orange-600 dark:text-orange-400'
                                        : change.costVariationPercentage < 0
                                        ? 'text-green-600 dark:text-green-400'
                                        : ''
                                    }`}>
                                      {change.costVariationPercentage > 0 ? '+' : ''}
                                      {change.costVariationPercentage.toFixed(1)}%
                                    </span>
                                  </div>
                                </div>

                                {change.priceChanged && change.originalPrice !== undefined && change.newPrice !== undefined && (
                                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div>
                                        <span className="text-muted-foreground">Precio original: </span>
                                        <span className="font-medium">{formatCurrency(change.originalPrice)}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Precio nuevo: </span>
                                        <span className="font-medium">{formatCurrency(change.newPrice)}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Comparación entre Receta Original y Prueba */}
              {totalCostResults && originalTotalCostResults && (() => {
                const diferenciaTotal = totalCostResults.totalCost - originalTotalCostResults.totalCost;
                const diferenciaPorUnidad = totalCostResults.totalCostPerUnit - originalTotalCostResults.totalCostPerUnit;
                const porcentajeDiferencia = (diferenciaTotal / originalTotalCostResults.totalCost) * 100;
                const isAhorro = diferenciaTotal < 0;

                // Datos para gráfico de barras con Recharts
                const barChartData = [
                  {
                    name: 'Total',
                    original: originalTotalCostResults.totalCost,
                    prueba: totalCostResults.totalCost
                  },
                  {
                    name: 'Materiales',
                    original: originalTotalCostResults.materialsCost,
                    prueba: totalCostResults.materialsCost
                  },
                  {
                    name: 'Empleados',
                    original: originalTotalCostResults.employeeCosts,
                    prueba: totalCostResults.employeeCosts
                  },
                  {
                    name: 'Indirectos',
                    original: originalTotalCostResults.indirectCosts,
                    prueba: totalCostResults.indirectCosts
                  }
                ];

                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Comparación de Costos</CardTitle>
                      <CardDescription className="text-xs">
                        {getProductionQuantityInUnits().toLocaleString('es-AR', { useGrouping: true })} unidades • {totalCostResults.categoryName}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Resumen con Desglose */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 border rounded">
                          <div className="text-xs text-muted-foreground mb-2 text-center font-medium">Original</div>
                          <div className="space-y-1.5 text-center">
                            <div>
                              <span className="text-xs text-muted-foreground">Materiales: </span>
                              <span className="text-xs font-medium">{formatCurrency(originalTotalCostResults.materialsCostPerUnit)}</span>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Empleados: </span>
                              <span className="text-xs font-medium">{formatCurrency(originalTotalCostResults.employeeCostPerUnit)}</span>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Indirectos: </span>
                              <span className="text-xs font-medium">{formatCurrency(originalTotalCostResults.indirectCostPerUnit)}</span>
                            </div>
                            <div className="border-t pt-1.5 mt-1.5">
                              <div>
                                <span className="text-xs font-semibold">Total: </span>
                                <span className="text-sm font-bold">{formatCurrency(originalTotalCostResults.totalCostPerUnit)}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">por unidad</div>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 border rounded bg-muted/30">
                          <div className="text-xs text-muted-foreground mb-2 text-center font-medium">Diferencia</div>
                          <div className="space-y-1.5 text-center">
                            <div>
                              <span className={`text-xs font-medium ${
                                (totalCostResults.materialsCostPerUnit - originalTotalCostResults.materialsCostPerUnit) < 0 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : (totalCostResults.materialsCostPerUnit - originalTotalCostResults.materialsCostPerUnit) > 0
                                  ? 'text-orange-600 dark:text-orange-400'
                                  : 'text-muted-foreground'
                              }`}>
                                {(totalCostResults.materialsCostPerUnit - originalTotalCostResults.materialsCostPerUnit) < 0 ? '-' : '+'}
                                {formatCurrency(Math.abs(totalCostResults.materialsCostPerUnit - originalTotalCostResults.materialsCostPerUnit))}
                              </span>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-muted-foreground">
                                {formatCurrency(totalCostResults.employeeCostPerUnit - originalTotalCostResults.employeeCostPerUnit)}
                              </span>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-muted-foreground">
                                {formatCurrency(totalCostResults.indirectCostPerUnit - originalTotalCostResults.indirectCostPerUnit)}
                              </span>
                            </div>
                            <div className="border-t pt-1.5 mt-1.5">
                              <div>
                                <span className={`text-sm font-bold ${
                                  isAhorro 
                                    ? 'text-green-600 dark:text-green-400' 
                                    : diferenciaPorUnidad > 0
                                    ? 'text-orange-600 dark:text-orange-400'
                                    : 'text-muted-foreground'
                                }`}>
                                  {isAhorro ? '-' : '+'}{formatCurrency(Math.abs(diferenciaPorUnidad))}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                ({Math.abs(porcentajeDiferencia).toFixed(1)}%)
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 border rounded">
                          <div className="text-xs text-muted-foreground mb-2 text-center font-medium">Prueba</div>
                          <div className="space-y-1.5 text-center">
                            <div>
                              <span className="text-xs text-muted-foreground">Materiales: </span>
                              <span className="text-xs font-medium">{formatCurrency(totalCostResults.materialsCostPerUnit)}</span>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Empleados: </span>
                              <span className="text-xs font-medium">{formatCurrency(totalCostResults.employeeCostPerUnit)}</span>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Indirectos: </span>
                              <span className="text-xs font-medium">{formatCurrency(totalCostResults.indirectCostPerUnit)}</span>
                            </div>
                            <div className="border-t pt-1.5 mt-1.5">
                              <div>
                                <span className="text-xs font-semibold">Total: </span>
                                <span className="text-sm font-bold">{formatCurrency(totalCostResults.totalCostPerUnit)}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">por unidad</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Diferencia */}
                      <div className="p-4 rounded-lg border-2 bg-muted/50 dark:bg-muted/30 border-border text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          {isAhorro ? (
                            <TrendingDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <TrendingUp className="h-5 w-5 text-muted-foreground" />
                          )}
                          <span className="text-sm font-semibold text-foreground">
                            {isAhorro ? 'Ahorro' : 'Incremento'}
                          </span>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-foreground">
                            {isAhorro ? '-' : '+'}{formatCurrency(Math.abs(diferenciaPorUnidad))}
                          </div>
                          <div className="text-xs font-medium text-muted-foreground">
                            ({Math.abs(porcentajeDiferencia).toFixed(1)}%)
                          </div>
                        </div>
                      </div>

                      {/* Gráfico de Barras con Recharts */}
                      <div className="border rounded-lg p-3">
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                            <XAxis 
                              dataKey="name" 
                              tick={{ fontSize: 11, fill: '#6b7280' }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis 
                              tick={{ fontSize: 11, fill: '#6b7280' }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(value) => {
                                if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                                if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                                return `$${value}`;
                              }}
                            />
                            <RechartsTooltip 
                              contentStyle={{ 
                                backgroundColor: 'white', 
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                fontSize: '12px'
                              }}
                              formatter={(value: any) => formatCurrency(value)}
                            />
                            <RechartsLegend 
                              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                              iconType="circle"
                            />
                            <RechartsBar 
                              dataKey="original" 
                              fill="#64748b" 
                              name="Original"
                              radius={[6, 6, 0, 0]}
                            />
                            <RechartsBar 
                              dataKey="prueba" 
                              fill="#475569" 
                              name="Prueba"
                              radius={[6, 6, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Tabla Simplificada */}
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="text-left p-2 font-medium">Concepto</th>
                              <th className="text-right p-2 font-medium">Original</th>
                              <th className="text-right p-2 font-medium">Prueba</th>
                              <th className="text-right p-2 font-medium">Diferencia</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2">Materiales</td>
                              <td className="p-2 text-right">{formatCurrency(originalTotalCostResults.materialsCost)}</td>
                              <td className="p-2 text-right">{formatCurrency(totalCostResults.materialsCost)}</td>
                              <td className={`p-2 text-right ${
                                (totalCostResults.materialsCost - originalTotalCostResults.materialsCost) < 0 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : 'text-orange-600 dark:text-orange-400'
                              }`}>
                                {(totalCostResults.materialsCost - originalTotalCostResults.materialsCost) < 0 ? '-' : '+'}
                                {formatCurrency(Math.abs(totalCostResults.materialsCost - originalTotalCostResults.materialsCost))}
                              </td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2">Empleados</td>
                              <td className="p-2 text-right">{formatCurrency(originalTotalCostResults.employeeCosts)}</td>
                              <td className="p-2 text-right text-muted-foreground">{formatCurrency(totalCostResults.employeeCosts)}</td>
                              <td className="p-2 text-right text-muted-foreground">—</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2">Indirectos</td>
                              <td className="p-2 text-right">{formatCurrency(originalTotalCostResults.indirectCosts)}</td>
                              <td className="p-2 text-right text-muted-foreground">{formatCurrency(totalCostResults.indirectCosts)}</td>
                              <td className="p-2 text-right text-muted-foreground">—</td>
                            </tr>
                            <tr className="border-t bg-muted/20 font-medium">
                              <td className="p-2">TOTAL</td>
                              <td className="p-2 text-right">{formatCurrency(originalTotalCostResults.totalCost)}</td>
                              <td className="p-2 text-right">{formatCurrency(totalCostResults.totalCost)}</td>
                              <td className={`p-2 text-right ${
                                isAhorro ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
                              }`}>
                                {isAhorro ? '-' : '+'}{formatCurrency(Math.abs(diferenciaTotal))}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Botón Guardar como Nueva Receta - Al final, después del resumen de insumos */}
              {selectedRecipeForComparison && testIngredients.length > 0 && originalRecipe.length > 0 && !showSaveTestDialog && (
                <Card>
                  <CardContent className="pt-6">
                    <Button 
                      onClick={async () => {
                        if (!selectedRecipeForComparison) {
                          toast.warning('Receta no seleccionada', {
                            description: 'Por favor selecciona una receta',
                          });
                          return;
                        }

                        if (testIngredients.length === 0) {
                          toast.warning('Ingredientes requeridos', {
                            description: 'No hay ingredientes para guardar',
                          });
                          return;
                        }

                        try {
                          // Buscar la última versión de recetas con el mismo nombre EXACTO y producto
                          const recipeDetail = await fetchRecipeDetail(selectedRecipeForComparison.id);
                          if (!recipeDetail) {
                            alert('Error al cargar los detalles de la receta');
                            return;
                          }

                          // Usar el nombre EXACTO de la receta original (sin modificaciones)
                          const originalRecipeName = selectedRecipeForComparison.name;

                          // Buscar todas las recetas con el mismo nombre EXACTO y producto
                          const sameNameRecipes = recipes.filter(
                            r => r.name === originalRecipeName &&
                                 r.productId === recipeDetail.productId?.toString()
                          );

                          // Buscar la versión más alta entre las recetas con el mismo nombre
                          let maxVersion = 0;
                          sameNameRecipes.forEach(r => {
                            // Intentar extraer el número de versión al inicio (puede tener texto después)
                            const versionMatch = r.version?.match(/^(\d+)/);
                            if (versionMatch) {
                              const versionNum = parseInt(versionMatch[1]);
                              if (versionNum > maxVersion) {
                                maxVersion = versionNum;
                              }
                            }
                          });

                          // Sugerir la siguiente versión (máximo + 1) sin descripción inicial
                          const suggestedVersion = `${maxVersion + 1}`;
                          
                          // Abrir el modal con el nombre bloqueado y versión sugerida
                          setNewRecipeName(originalRecipeName); // Nombre exacto, no modificable
                          setNewRecipeVersion(suggestedVersion);
                          setShowNewRecipeDialog(true);
                        } catch (error) {
                          console.error('Error preparando nueva versión:', error);
                          // Si hay error, usar valores por defecto
                          setNewRecipeName(selectedRecipeForComparison.name);
                          setNewRecipeVersion('1');
                          setShowNewRecipeDialog(true);
                        }
                      }}
                      className="w-full"
                      size="lg"
                    >
                      <BookOpen className="h-4 w-4 mr-2" />
                      Guardar Nueva Versión
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Crea una nueva versión de la receta con los ingredientes modificados
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Resultados de la Simulación - Solo cuando se modifica la receta (sin calcular costo total) */}
              {testResults && !totalCostResults && testIngredients.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Resultados de la Simulación</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Resumen de Costos */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 border rounded text-center">
                        <div className="text-xs text-muted-foreground mb-1">Costo Total</div>
                        <div className="text-base font-medium">
                          {formatCurrency(testResults.totalCost)}
                        </div>
                        <div className="text-xs text-muted-foreground">Por batch completo</div>
                      </div>
                      
                      <div className="p-3 border rounded text-center">
                        <div className="text-xs text-muted-foreground mb-1">Costo por Unidad</div>
                        <div className="text-base font-medium">
                          {formatCurrency(testResults.costPerUnit)}
                        </div>
                        <div className="text-xs text-muted-foreground">Por producto individual</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Pruebas Guardadas */}
              {selectedRecipeForComparison && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Pruebas Guardadas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingSavedTests ? (
                      <div className="text-center py-4">
                        <div className="text-muted-foreground">Cargando pruebas...</div>
                      </div>
                    ) : savedTests.length > 0 ? (
                      <div className="space-y-3">
                        {savedTests.map((test) => {
                          // Manejar tanto snake_case como camelCase
                          const testName = test.testName || test.test_name || 'Sin nombre';
                          const createdAt = test.createdAt || test.created_at;
                          const totalCost = test.totalCost ?? test.total_cost ?? 0;
                          const costPerUnit = test.costPerUnit ?? test.cost_per_unit ?? 0;
                          const notes = test.notes;
                          
                          return (
                            <div key={test.id} className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h4 className="font-semibold">{testName}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {createdAt ? new Date(createdAt).toLocaleDateString('es-AR') : 'Sin fecha'} - 
                                    Costo: {formatCurrency(totalCost)} - 
                                    Por unidad: {formatCurrency(costPerUnit)}
                                  </p>
                                  {notes && (
                                    <p className="text-sm text-muted-foreground mt-1">{notes}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button 
                                    onClick={() => loadSavedTest(test)}
                                    variant="outline"
                                    size="sm"
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    Cargar
                                  </Button>
                                  <Button 
                                    onClick={() => deleteSavedTest(test.id, testName)}
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">No hay pruebas guardadas para esta receta</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Guarda una prueba de costos para verla aquí
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Mensaje cuando no hay producto seleccionado */}
              {!selectedProductForTest && (
                <Card>
                  <CardContent className="text-center py-12">
                    <TestTube className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">Selecciona un Producto</h3>
                    <p className="text-muted-foreground">
                      Elige un producto para cargar su receta actual y simular costos
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialog: Nueva Receta */}
        <Dialog open={showNewRecipeDialog} onOpenChange={(open) => {
          setShowNewRecipeDialog(open);
          if (!open) {
            setNewRecipeName('');
            setNewRecipeVersion('1');
          }
        }}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Guardar Nueva Versión
              </DialogTitle>
              <DialogDescription>
                {selectedRecipeForComparison && `Crear nueva versión de "${selectedRecipeForComparison.name}"`}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre de la Receta</label>
                <Input
                  value={newRecipeName}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  El nombre se mantiene igual para crear una nueva versión de la misma receta
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Versión</label>
                <Input
                  value={newRecipeVersion}
                  onChange={(e) => setNewRecipeVersion(e.target.value)}
                  placeholder="Ej: 1 - Cambio en insumos, 2 - Optimización de costos..."
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Puedes incluir una descripción: "1 - descripción de cambios" o simplemente el número "1"
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowNewRecipeDialog(false);
                  setNewRecipeName('');
                  setNewRecipeVersion('1');
                }}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveNewRecipe}
                disabled={!newRecipeName.trim() || !newRecipeVersion.trim()}
              >
                Guardar Versión
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Ver/Editar Notas */}
        <Dialog open={showNotesDialog} onOpenChange={(open) => {
          setShowNotesDialog(open);
          if (!open) {
            setIsEditingNotes(false);
            setNotesContent('');
          }
        }}>
          <DialogContent size="md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-amber-700" />
                {isEditingNotes ? 'Editar Notas' : 'Notas de la Receta'}
              </DialogTitle>
              <DialogDescription>
                {selectedRecipe?.name}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {isEditingNotes ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notas</label>
                  <Textarea
                    value={notesContent}
                    onChange={(e) => setNotesContent(e.target.value)}
                    placeholder="Escribe las notas de la receta..."
                    rows={8}
                    className="min-h-[200px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Puedes agregar observaciones, ajustes o cualquier información relevante sobre esta receta.
                  </p>
                </div>
              ) : (
                <>
                  {notesContent ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
                        {notesContent}
                      </p>
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">
                        Esta receta no tiene notas.
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Haz clic en &quot;Editar&quot; para agregar notas.
                      </p>
                    </div>
                  )}
                </>
              )}
              
              <div className="flex justify-end gap-2">
                {isEditingNotes ? (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsEditingNotes(false);
                        setNotesContent(selectedRecipe?.notes || '');
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={async () => {
                        if (!selectedRecipe) return;
                        
                        try {
                          // Cargar los ingredientes de la receta
                          const recipeDetail = await fetchRecipeDetail(selectedRecipe.id);
                          if (!recipeDetail) {
                            alert('Error al cargar los detalles de la receta');
                            return;
                          }
                          
                          const success = await updateRecipe(selectedRecipe.id, {
                            ...selectedRecipe,
                            name: selectedRecipe.name,
                            productId: selectedRecipe.productId,
                            subcategoryId: selectedRecipe.subcategoryId,
                            baseType: selectedRecipe.baseType,
                            version: selectedRecipe.version,
                            description: selectedRecipe.description,
                            notes: notesContent,
                            outputQuantity: selectedRecipe.outputQuantity,
                            outputUnitLabel: selectedRecipe.outputUnitLabel,
                            intermediateQuantity: selectedRecipe.intermediateQuantity,
                            intermediateUnitLabel: selectedRecipe.intermediateUnitLabel,
                            unitsPerItem: selectedRecipe.unitsPerItem,
                            isActive: selectedRecipe.isActive,
                            metrosUtiles: selectedRecipe.metrosUtiles,
                            cantidadPastones: selectedRecipe.cantidadPastones,
                            ingredients: recipeDetail.ingredients || [],
                            bankIngredients: recipeDetail.bankIngredients || []
                          });
                          
                          if (success) {
                            setIsEditingNotes(false);
                            // Actualizar la receta en la lista
                            const updatedRecipe = { ...selectedRecipe, notes: notesContent };
                            setSelectedRecipe(updatedRecipe);
                            // Refrescar la lista de recetas
                            refreshData();
                          }
                        } catch (error) {
                          console.error('Error guardando notas:', error);
                          toast.error('Error al guardar', {
                            description: 'No se pudieron guardar las notas. Por favor, intenta nuevamente.',
                          });
                        }
                      }}
                    >
                      Guardar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setIsEditingNotes(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      {notesContent ? 'Editar' : 'Agregar Notas'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowNotesDialog(false)}
                    >
                      Cerrar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Guardar Prueba de Costos */}
        <Dialog open={showSaveTestDialog} onOpenChange={setShowSaveTestDialog}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-green-700" />
                Guardar Prueba de Costos
              </DialogTitle>
              <DialogDescription>
                Guarda esta simulación de costos para poder recuperarla más tarde
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre de la Prueba *</label>
                <Input
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="Ej: Prueba con cemento nuevo, Optimización enero 2024..."
                  maxLength={255}
                />
                <p className="text-xs text-muted-foreground">
                  Elige un nombre descriptivo para identificar esta prueba
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notas (opcional)</label>
                <Textarea
                  value={testNotes}
                  onChange={(e) => setTestNotes(e.target.value)}
                  placeholder="Agrega observaciones sobre esta prueba..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Puedes agregar comentarios sobre los cambios realizados o el objetivo de la prueba
                </p>
              </div>

              {/* Resumen de la prueba */}
              {testResults && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h4 className="font-semibold mb-2">Resumen de la Prueba</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Costo Total:</span>
                      <div className="font-semibold">{formatCurrency(testResults.totalCost)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Costo por Unidad:</span>
                      <div className="font-semibold">{formatCurrency(testResults.costPerUnit)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ingredientes:</span>
                      <div className="font-semibold">{testIngredients.length}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Receta:</span>
                      <div className="font-semibold">{selectedRecipeForComparison?.name}</div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowSaveTestDialog(false);
                    setTestName('');
                    setTestNotes('');
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={saveCostTest}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Guardar Prueba
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
}
