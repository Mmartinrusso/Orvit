'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Recipe, RecipeIngredient } from '@/hooks/use-recetas';
import {
  TestTube, Plus, Trash2, Undo2, Redo2, Save, RefreshCw,
  TrendingUp, TrendingDown, Package, DollarSign, Calculator,
  ChevronRight, Loader2, FileText, Copy, ArrowRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend as RechartsLegend, Cell
} from 'recharts';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UserColorPreferences {
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  kpiPositive: string;
  kpiNegative: string;
  kpiNeutral: string;
}

interface PruebasCostosV2Props {
  recipes: Recipe[];
  products: any[];
  supplies: any[];
  userColors: UserColorPreferences;
  getCurrentPrice: (supplyId: number) => number;
  fetchRecipeDetail: (id: number) => Promise<any>;
  companyId?: number;
}

interface TestIngredient extends RecipeIngredient {
  testPrice?: number;
}

interface CostSimulationResult {
  totalCost: number;
  totalCostPerUnit: number;
  materialsCost: number;
  materialsCostPerUnit: number;
  employeeCosts: number;
  employeeCostPerUnit: number;
  indirectCosts: number;
  indirectCostPerUnit: number;
  categoryName?: string;
  productionQuantity?: number;
}

// Helper function to format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

// Helper to calculate toneladas from pulsos
const calculateToneladas = (pulsos: string | number, kgPorPulso: string | number): number => {
  const p = typeof pulsos === 'string' ? parseFloat(pulsos) || 0 : pulsos;
  const k = typeof kgPorPulso === 'string' ? parseFloat(kgPorPulso) || 0 : kgPorPulso;
  return (p * k) / 1000; // Convert kg to TN
};

export default function PruebasCostosV2({
  recipes,
  products,
  supplies,
  userColors,
  getCurrentPrice,
  fetchRecipeDetail,
  companyId
}: PruebasCostosV2Props) {
  // Recipe selection states
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productRecipes, setProductRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  // Test ingredients and original for comparison
  const [testIngredients, setTestIngredients] = useState<TestIngredient[]>([]);
  const [originalIngredients, setOriginalIngredients] = useState<TestIngredient[]>([]);

  // Production simulation
  const [productionDays, setProductionDays] = useState<number>(0);
  const [productionPlatesPerDay, setProductionPlatesPerDay] = useState<number>(0);
  const [productionMonth, setProductionMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  // Results
  const [testResults, setTestResults] = useState<CostSimulationResult | null>(null);
  const [originalResults, setOriginalResults] = useState<CostSimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);

  // History for undo/redo
  const [history, setHistory] = useState<TestIngredient[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedo = useRef(false);
  const lastSavedState = useRef<TestIngredient[]>([]);
  const MAX_HISTORY = 50;

  // Temporary input values for controlled inputs
  const [tempInputValues, setTempInputValues] = useState<Record<string, string>>({});

  // Add ingredient dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newIngredient, setNewIngredient] = useState({
    supplyId: '',
    quantity: '',
    pulsos: '',
    kgPorPulso: ''
  });

  // Calculate production quantity in units
  const productionQuantityInUnits = useMemo(() => {
    if (!selectedRecipe) return 0;
    const totalPlates = (productionPlatesPerDay || 0) * (productionDays || 0);
    const unitsPerItem = selectedRecipe.unitsPerItem || 1;
    return totalPlates * unitsPerItem;
  }, [selectedRecipe, productionPlatesPerDay, productionDays]);

  // Load recipes when product changes
  useEffect(() => {
    if (!selectedProductId) {
      setProductRecipes([]);
      return;
    }

    const loadProductRecipes = async () => {
      setLoadingRecipes(true);
      try {
        const filtered = recipes.filter(r => r.productId?.toString() === selectedProductId);
        setProductRecipes(filtered);
      } catch (error) {
        console.error('Error loading product recipes:', error);
      } finally {
        setLoadingRecipes(false);
      }
    };

    loadProductRecipes();
  }, [selectedProductId, recipes]);

  // Load recipe detail and set ingredients
  const loadRecipeForTest = useCallback(async (recipe: Recipe) => {
    try {
      const detail = await fetchRecipeDetail(recipe.id);
      if (detail?.ingredients) {
        const ingredients: TestIngredient[] = detail.ingredients.map((ing: any) => ({
          supplyId: ing.supplyId,
          supplyName: ing.supplyName || supplies.find(s => s.id === ing.supplyId)?.name || 'Desconocido',
          quantity: ing.quantity,
          unitMeasure: ing.unitMeasure || 'TN',
          pulsos: ing.pulsos,
          kgPorPulso: ing.kgPorPulso,
          testPrice: getCurrentPrice(ing.supplyId)
        }));

        setTestIngredients(ingredients);
        setOriginalIngredients(JSON.parse(JSON.stringify(ingredients)));
        setSelectedRecipe(recipe);

        // Reset history
        setHistory([JSON.parse(JSON.stringify(ingredients))]);
        setHistoryIndex(0);
        lastSavedState.current = JSON.parse(JSON.stringify(ingredients));

        // Reset results
        setTestResults(null);
        setOriginalResults(null);
      }
    } catch (error) {
      console.error('Error loading recipe:', error);
      toast.error('Error al cargar la receta');
    }
  }, [fetchRecipeDetail, supplies, getCurrentPrice]);

  // Save history when ingredients change
  useEffect(() => {
    if (isUndoRedo.current) {
      isUndoRedo.current = false;
      return;
    }

    if (testIngredients.length === 0) return;

    const currentState = JSON.stringify(testIngredients);
    const lastState = JSON.stringify(lastSavedState.current);

    if (currentState === lastState) return;

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(currentState));

    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
    }

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    lastSavedState.current = JSON.parse(currentState);
  }, [testIngredients, history, historyIndex]);

  // Undo/Redo handlers
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedo.current = true;
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setTestIngredients(JSON.parse(JSON.stringify(history[newIndex])));
      lastSavedState.current = JSON.parse(JSON.stringify(history[newIndex]));
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedo.current = true;
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setTestIngredients(JSON.parse(JSON.stringify(history[newIndex])));
      lastSavedState.current = JSON.parse(JSON.stringify(history[newIndex]));
    }
  }, [historyIndex, history]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Update ingredient field
  const updateIngredient = useCallback((index: number, field: keyof TestIngredient, value: any) => {
    setTestIngredients(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // Auto-calculate quantity when pulsos or kgPorPulso changes
      if (field === 'pulsos' || field === 'kgPorPulso') {
        const pulsos = field === 'pulsos' ? value : updated[index].pulsos;
        const kgPorPulso = field === 'kgPorPulso' ? value : updated[index].kgPorPulso;
        if (pulsos !== undefined && kgPorPulso !== undefined) {
          updated[index].quantity = calculateToneladas(pulsos, kgPorPulso);
        }
      }

      return updated;
    });
  }, []);

  // Add new ingredient
  const addIngredient = useCallback(() => {
    if (!newIngredient.supplyId) return;

    const supply = supplies.find(s => s.id.toString() === newIngredient.supplyId);
    if (!supply) return;

    const quantity = newIngredient.pulsos && newIngredient.kgPorPulso
      ? calculateToneladas(newIngredient.pulsos, newIngredient.kgPorPulso)
      : parseFloat(newIngredient.quantity) || 0;

    const ingredient: TestIngredient = {
      supplyId: supply.id,
      supplyName: supply.name,
      quantity,
      unitMeasure: supply.unitMeasure || 'TN',
      pulsos: newIngredient.pulsos ? parseInt(newIngredient.pulsos) : undefined,
      kgPorPulso: newIngredient.kgPorPulso ? parseFloat(newIngredient.kgPorPulso) : undefined,
      testPrice: getCurrentPrice(supply.id)
    };

    setTestIngredients(prev => [...prev, ingredient]);
    setShowAddDialog(false);
    setNewIngredient({ supplyId: '', quantity: '', pulsos: '', kgPorPulso: '' });
  }, [newIngredient, supplies, getCurrentPrice]);

  // Remove ingredient
  const removeIngredient = useCallback((index: number) => {
    setTestIngredients(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Simulate costs
  const simulateCosts = useCallback(async () => {
    if (!selectedRecipe || testIngredients.length === 0) return;

    setSimulating(true);
    try {
      const product = products.find(p => p.id.toString() === selectedProductId);

      const fetchSimulation = async (ingredients: TestIngredient[]) => {
        const res = await fetch('/api/recipes/simulate-total-cost', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipeId: selectedRecipe.id,
            ingredients: ingredients.map(ing => ({
              supplyId: ing.supplyId,
              quantity: ing.quantity,
              testPrice: ing.testPrice
            })),
            productionQuantity: productionQuantityInUnits,
            productionMonth,
            productCategoryId: product?.categoryId,
            productId: product?.id
          })
        });

        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.details || error.error || 'Error en simulacion');
        }

        return res.json();
      };

      // Fetch both simulations in parallel
      const [originalData, testData] = await Promise.all([
        originalIngredients.length > 0 ? fetchSimulation(originalIngredients) : null,
        fetchSimulation(testIngredients)
      ]);

      if (originalData?.success) {
        setOriginalResults(originalData.results);
      }

      if (testData?.success) {
        setTestResults(testData.results);
      }
    } catch (error: any) {
      console.error('Error simulating costs:', error);
      toast.error('Error al simular costos', { description: error.message });
    } finally {
      setSimulating(false);
    }
  }, [selectedRecipe, testIngredients, originalIngredients, productionQuantityInUnits, productionMonth, products, selectedProductId]);

  // Calculate materials cost for quick preview
  const materialsCost = useMemo(() => {
    return testIngredients.reduce((sum, ing) => {
      const price = ing.testPrice ?? getCurrentPrice(ing.supplyId) ?? 0;
      return sum + (ing.quantity * price);
    }, 0);
  }, [testIngredients, getCurrentPrice]);

  // Calculate comparison data
  const comparisonData = useMemo(() => {
    if (!testResults || !originalResults) return null;

    const totalDiff = testResults.totalCost - originalResults.totalCost;
    const totalDiffPerUnit = testResults.totalCostPerUnit - originalResults.totalCostPerUnit;
    const totalDiffPercent = originalResults.totalCost > 0
      ? (totalDiff / originalResults.totalCost) * 100
      : 0;

    return {
      totalDiff,
      totalDiffPerUnit,
      totalDiffPercent,
      isSaving: totalDiff < 0,
      chartData: [
        { name: 'Total', original: originalResults.totalCost, test: testResults.totalCost },
        { name: 'Materiales', original: originalResults.materialsCost, test: testResults.materialsCost },
        { name: 'Empleados', original: originalResults.employeeCosts, test: testResults.employeeCosts },
        { name: 'Indirectos', original: originalResults.indirectCosts, test: testResults.indirectCosts }
      ]
    };
  }, [testResults, originalResults]);

  // Calculate ingredient changes
  const ingredientChanges = useMemo(() => {
    if (originalIngredients.length === 0 || testIngredients.length === 0) return [];

    const changes: Array<{
      name: string;
      originalQty: number;
      newQty: number;
      qtyDiff: number;
      qtyPercent: number;
      costDiff: number;
      isNew: boolean;
      isRemoved: boolean;
      priceChanged: boolean;
    }> = [];

    // Check modified and new ingredients
    testIngredients.forEach(testIng => {
      const origIng = originalIngredients.find(o => o.supplyId === testIng.supplyId);

      if (origIng) {
        const qtyDiff = testIng.quantity - origIng.quantity;
        const origPrice = origIng.testPrice ?? getCurrentPrice(origIng.supplyId) ?? 0;
        const newPrice = testIng.testPrice ?? getCurrentPrice(testIng.supplyId) ?? 0;
        const costDiff = (testIng.quantity * newPrice) - (origIng.quantity * origPrice);
        const priceChanged = Math.abs(newPrice - origPrice) > 0.01;

        if (qtyDiff !== 0 || priceChanged) {
          changes.push({
            name: testIng.supplyName || 'Desconocido',
            originalQty: origIng.quantity,
            newQty: testIng.quantity,
            qtyDiff,
            qtyPercent: origIng.quantity > 0 ? (qtyDiff / origIng.quantity) * 100 : 100,
            costDiff,
            isNew: false,
            isRemoved: false,
            priceChanged
          });
        }
      } else {
        // New ingredient
        const price = testIng.testPrice ?? getCurrentPrice(testIng.supplyId) ?? 0;
        changes.push({
          name: testIng.supplyName || 'Desconocido',
          originalQty: 0,
          newQty: testIng.quantity,
          qtyDiff: testIng.quantity,
          qtyPercent: 100,
          costDiff: testIng.quantity * price,
          isNew: true,
          isRemoved: false,
          priceChanged: false
        });
      }
    });

    // Check removed ingredients
    originalIngredients.forEach(origIng => {
      const exists = testIngredients.some(t => t.supplyId === origIng.supplyId);
      if (!exists) {
        const price = origIng.testPrice ?? getCurrentPrice(origIng.supplyId) ?? 0;
        changes.push({
          name: origIng.supplyName || 'Desconocido',
          originalQty: origIng.quantity,
          newQty: 0,
          qtyDiff: -origIng.quantity,
          qtyPercent: -100,
          costDiff: -(origIng.quantity * price),
          isNew: false,
          isRemoved: true,
          priceChanged: false
        });
      }
    });

    return changes.sort((a, b) => Math.abs(b.costDiff) - Math.abs(a.costDiff));
  }, [testIngredients, originalIngredients, getCurrentPrice]);

  // Clear all
  const clearAll = useCallback(() => {
    setSelectedProductId('');
    setSelectedRecipe(null);
    setTestIngredients([]);
    setOriginalIngredients([]);
    setTestResults(null);
    setOriginalResults(null);
    setHistory([]);
    setHistoryIndex(-1);
    setProductionDays(0);
    setProductionPlatesPerDay(0);
  }, []);

  // Get available months for selection
  const availableMonths = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        value: date.toISOString().slice(0, 7),
        label: date.toLocaleDateString('es-AR', { year: 'numeric', month: 'long' })
      });
    }
    return months;
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pruebas de Costos</h2>
          <p className="text-muted-foreground">Simula costos y compara con la receta actual</p>
        </div>
        {testIngredients.length > 0 && (
          <Button variant="outline" onClick={clearAll}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Limpiar Todo
          </Button>
        )}
      </div>

      {/* Recipe Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Cargar Receta Base
          </CardTitle>
          <CardDescription>Selecciona un producto y su receta para comenzar la simulacion</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Producto</label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(product => (
                    <SelectItem key={product.id} value={product.id.toString()}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Recipe selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Receta</label>
              <Select
                value={selectedRecipe?.id?.toString() || ''}
                onValueChange={(value) => {
                  const recipe = productRecipes.find(r => r.id.toString() === value);
                  if (recipe) loadRecipeForTest(recipe);
                }}
                disabled={!selectedProductId || loadingRecipes}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    loadingRecipes ? 'Cargando...' :
                    productRecipes.length === 0 ? 'Sin recetas disponibles' :
                    'Seleccionar receta'
                  } />
                </SelectTrigger>
                <SelectContent>
                  {productRecipes.map(recipe => (
                    <SelectItem key={recipe.id} value={recipe.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{recipe.name} (v{recipe.version})</span>
                        {recipe.isActive && (
                          <Badge variant="secondary" className="bg-success-muted text-success">
                            Activa
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Or select any recipe */}
          {!selectedProductId && (
            <div className="space-y-2">
              <label className="text-sm font-medium">O cargar cualquier receta</label>
              <Select
                value={selectedRecipe?.id?.toString() || ''}
                onValueChange={(value) => {
                  const recipe = recipes.find(r => r.id.toString() === value);
                  if (recipe) {
                    setSelectedProductId(recipe.productId?.toString() || '');
                    loadRecipeForTest(recipe);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cualquier receta" />
                </SelectTrigger>
                <SelectContent>
                  {recipes.map(recipe => (
                    <SelectItem key={recipe.id} value={recipe.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{recipe.name} - {recipe.productName} (v{recipe.version})</span>
                        {recipe.isActive && (
                          <Badge variant="secondary" className="bg-success-muted text-success">
                            Activa
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ingredients Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Simulacion de Costos</CardTitle>
              <CardDescription>
                Modifica precios, cantidades y agrega/quita ingredientes
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                title="Deshacer (Ctrl+Z)"
              >
                <Undo2 className="h-4 w-4 mr-1" />
                Deshacer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                title="Rehacer (Ctrl+Y)"
              >
                <Redo2 className="h-4 w-4 mr-1" />
                Rehacer
              </Button>
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Agregar Insumo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {testIngredients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium">Insumo</th>
                    <th className="text-left p-3 font-medium w-20">Pulsos</th>
                    <th className="text-left p-3 font-medium w-24">kg/pulso</th>
                    <th className="text-left p-3 font-medium w-24">Cantidad</th>
                    <th className="text-left p-3 font-medium w-16">Unidad</th>
                    <th className="text-left p-3 font-medium w-28">Precio</th>
                    <th className="text-right p-3 font-medium w-28">Subtotal</th>
                    <th className="text-center p-3 font-medium w-16">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {testIngredients.map((ingredient, index) => {
                    const price = ingredient.testPrice ?? getCurrentPrice(ingredient.supplyId) ?? 0;
                    const subtotal = ingredient.quantity * price;

                    return (
                      <tr key={index} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="p-3">
                          <span className="font-medium">{ingredient.supplyName}</span>
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={tempInputValues[`pulsos-${index}`] ?? ingredient.pulsos ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTempInputValues(prev => ({ ...prev, [`pulsos-${index}`]: val }));
                              if (val !== '') {
                                updateIngredient(index, 'pulsos', parseInt(val) || 0);
                              }
                            }}
                            onBlur={() => {
                              setTempInputValues(prev => {
                                const next = { ...prev };
                                delete next[`pulsos-${index}`];
                                return next;
                              });
                            }}
                            className="h-8 w-full"
                            placeholder="0"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={tempInputValues[`kgPorPulso-${index}`] ?? ingredient.kgPorPulso ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTempInputValues(prev => ({ ...prev, [`kgPorPulso-${index}`]: val }));
                              if (val !== '') {
                                updateIngredient(index, 'kgPorPulso', parseFloat(val) || 0);
                              }
                            }}
                            onBlur={() => {
                              setTempInputValues(prev => {
                                const next = { ...prev };
                                delete next[`kgPorPulso-${index}`];
                                return next;
                              });
                            }}
                            className="h-8 w-full"
                            placeholder="0"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            step="0.00001"
                            value={tempInputValues[`quantity-${index}`] ?? ingredient.quantity ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTempInputValues(prev => ({ ...prev, [`quantity-${index}`]: val }));
                              if (val !== '') {
                                updateIngredient(index, 'quantity', parseFloat(val) || 0);
                              }
                            }}
                            onBlur={() => {
                              setTempInputValues(prev => {
                                const next = { ...prev };
                                delete next[`quantity-${index}`];
                                return next;
                              });
                            }}
                            className="h-8 w-full"
                            placeholder="0"
                          />
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {ingredient.unitMeasure}
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={tempInputValues[`testPrice-${index}`] ?? ingredient.testPrice ?? price}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTempInputValues(prev => ({ ...prev, [`testPrice-${index}`]: val }));
                              if (val !== '') {
                                updateIngredient(index, 'testPrice', parseFloat(val) || 0);
                              }
                            }}
                            onBlur={() => {
                              setTempInputValues(prev => {
                                const next = { ...prev };
                                delete next[`testPrice-${index}`];
                                return next;
                              });
                            }}
                            className="h-8 w-full"
                            placeholder="0"
                          />
                        </td>
                        <td className="p-3 text-right font-semibold">
                          {formatCurrency(subtotal)}
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeIngredient(index)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50">
                    <td colSpan={6} className="p-3 text-right font-semibold">
                      Total Materiales:
                    </td>
                    <td className="p-3 text-right font-bold text-lg">
                      {formatCurrency(materialsCost)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <TestTube className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No hay ingredientes en la simulacion</p>
              <p className="text-sm mt-1">Selecciona una receta o agrega insumos manualmente</p>
            </div>
          )}

          {/* Production simulation fields */}
          {testIngredients.length > 0 && selectedRecipe && (
            <div className="mt-6 p-4 bg-muted/30 rounded-lg border">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Calcular Costo Total (con Empleados e Indirectos)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Placas por Dia</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={productionPlatesPerDay || ''}
                    onChange={(e) => {
                      setProductionPlatesPerDay(parseFloat(e.target.value) || 0);
                      setTestResults(null);
                      setOriginalResults(null);
                    }}
                    placeholder="Ej: 1920"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cantidad de Dias</label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={productionDays || ''}
                    onChange={(e) => {
                      setProductionDays(parseInt(e.target.value) || 0);
                      setTestResults(null);
                      setOriginalResults(null);
                    }}
                    placeholder="Ej: 22"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mes de Gastos</label>
                  <Select value={productionMonth} onValueChange={setProductionMonth}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMonths.map(month => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">&nbsp;</label>
                  <Button
                    onClick={simulateCosts}
                    disabled={simulating || productionQuantityInUnits === 0}
                    className="w-full"
                  >
                    {simulating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Simulando...
                      </>
                    ) : (
                      <>
                        <Calculator className="h-4 w-4 mr-2" />
                        Simular Costos
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {productionQuantityInUnits > 0 && (
                <p className="text-sm text-muted-foreground mt-3">
                  Total a producir: <span className="font-medium">{productionQuantityInUnits.toLocaleString('es-AR')} unidades</span>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ingredient Changes Summary */}
      {ingredientChanges.length > 0 && (
        <Card className="border-info-muted bg-info-muted/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Resumen de Cambios en Insumos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ingredientChanges.map((change, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "p-3 rounded-lg border",
                    change.isNew && "bg-success-muted border-success-muted",
                    change.isRemoved && "bg-destructive/10 border-destructive/30",
                    !change.isNew && !change.isRemoved && "bg-card border-border"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{change.name}</span>
                      {change.isNew && <Badge className="bg-success-muted text-success">Nuevo</Badge>}
                      {change.isRemoved && <Badge className="bg-destructive/10 text-destructive">Eliminado</Badge>}
                      {change.priceChanged && <Badge className="bg-info-muted text-info-muted-foreground">Precio modificado</Badge>}
                    </div>
                    <div className={cn(
                      "font-semibold",
                      change.costDiff < 0 ? "text-success" : change.costDiff > 0 ? "text-warning-muted-foreground" : ""
                    )}>
                      {change.costDiff >= 0 ? '+' : ''}{formatCurrency(change.costDiff)}
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                    <span>Original: {change.originalQty.toFixed(4)} TN</span>
                    <ArrowRight className="h-3 w-3" />
                    <span>Nuevo: {change.newQty.toFixed(4)} TN</span>
                    <span className={cn(
                      change.qtyPercent < 0 ? "text-success" : change.qtyPercent > 0 ? "text-warning-muted-foreground" : ""
                    )}>
                      ({change.qtyPercent >= 0 ? '+' : ''}{change.qtyPercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison Results */}
      {comparisonData && testResults && originalResults && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparacion de Costos</CardTitle>
            <CardDescription>
              {productionQuantityInUnits.toLocaleString('es-AR')} unidades • {testResults.categoryName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              {/* Original */}
              <div className="p-4 border rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground text-center mb-3">Original</h4>
                <div className="space-y-2 text-center">
                  <div className="text-xs">
                    <span className="text-muted-foreground">Materiales: </span>
                    <span className="font-medium">{formatCurrency(originalResults.materialsCostPerUnit)}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Empleados: </span>
                    <span className="font-medium">{formatCurrency(originalResults.employeeCostPerUnit)}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Indirectos: </span>
                    <span className="font-medium">{formatCurrency(originalResults.indirectCostPerUnit)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div>
                    <span className="text-xs font-medium">Total: </span>
                    <span className="text-lg font-bold">{formatCurrency(originalResults.totalCostPerUnit)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">por unidad</p>
                </div>
              </div>

              {/* Difference */}
              <div className="p-4 border rounded-lg bg-muted/30">
                <h4 className="text-sm font-medium text-muted-foreground text-center mb-3">Diferencia</h4>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {comparisonData.isSaving ? (
                      <TrendingDown className="h-5 w-5 text-success" />
                    ) : (
                      <TrendingUp className="h-5 w-5 text-warning-muted-foreground" />
                    )}
                    <span className="font-semibold">
                      {comparisonData.isSaving ? 'Ahorro' : 'Incremento'}
                    </span>
                  </div>
                  <div className={cn(
                    "text-2xl font-bold",
                    comparisonData.isSaving ? "text-success" : "text-warning-muted-foreground"
                  )}>
                    {comparisonData.isSaving ? '-' : '+'}{formatCurrency(Math.abs(comparisonData.totalDiffPerUnit))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    ({Math.abs(comparisonData.totalDiffPercent).toFixed(1)}%)
                  </p>
                </div>
              </div>

              {/* Test */}
              <div className="p-4 border rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground text-center mb-3">Prueba</h4>
                <div className="space-y-2 text-center">
                  <div className="text-xs">
                    <span className="text-muted-foreground">Materiales: </span>
                    <span className="font-medium">{formatCurrency(testResults.materialsCostPerUnit)}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Empleados: </span>
                    <span className="font-medium">{formatCurrency(testResults.employeeCostPerUnit)}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Indirectos: </span>
                    <span className="font-medium">{formatCurrency(testResults.indirectCostPerUnit)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div>
                    <span className="text-xs font-medium">Total: </span>
                    <span className="text-lg font-bold">{formatCurrency(testResults.totalCostPerUnit)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">por unidad</p>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="border rounded-lg p-4">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={comparisonData.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                  <Bar dataKey="original" fill="#64748b" name="Original" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="test" fill={userColors.chart1 || '#3b82f6'} name="Prueba" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium">Concepto</th>
                    <th className="text-right p-3 font-medium">Original</th>
                    <th className="text-right p-3 font-medium">Prueba</th>
                    <th className="text-right p-3 font-medium">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-3">Materiales</td>
                    <td className="p-3 text-right">{formatCurrency(originalResults.materialsCost)}</td>
                    <td className="p-3 text-right">{formatCurrency(testResults.materialsCost)}</td>
                    <td className={cn(
                      "p-3 text-right font-medium",
                      testResults.materialsCost - originalResults.materialsCost < 0 ? "text-success" : "text-warning-muted-foreground"
                    )}>
                      {testResults.materialsCost - originalResults.materialsCost < 0 ? '-' : '+'}
                      {formatCurrency(Math.abs(testResults.materialsCost - originalResults.materialsCost))}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">Empleados</td>
                    <td className="p-3 text-right">{formatCurrency(originalResults.employeeCosts)}</td>
                    <td className="p-3 text-right text-muted-foreground">{formatCurrency(testResults.employeeCosts)}</td>
                    <td className="p-3 text-right text-muted-foreground">—</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">Indirectos</td>
                    <td className="p-3 text-right">{formatCurrency(originalResults.indirectCosts)}</td>
                    <td className="p-3 text-right text-muted-foreground">{formatCurrency(testResults.indirectCosts)}</td>
                    <td className="p-3 text-right text-muted-foreground">—</td>
                  </tr>
                  <tr className="bg-muted/30 font-semibold">
                    <td className="p-3">TOTAL</td>
                    <td className="p-3 text-right">{formatCurrency(originalResults.totalCost)}</td>
                    <td className="p-3 text-right">{formatCurrency(testResults.totalCost)}</td>
                    <td className={cn(
                      "p-3 text-right",
                      comparisonData.isSaving ? "text-success" : "text-warning-muted-foreground"
                    )}>
                      {comparisonData.isSaving ? '-' : '+'}
                      {formatCurrency(Math.abs(comparisonData.totalDiff))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Ingredient Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Insumo</DialogTitle>
            <DialogDescription>
              Selecciona un insumo y define la cantidad
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Insumo</label>
              <Select
                value={newIngredient.supplyId}
                onValueChange={(value) => setNewIngredient(prev => ({ ...prev, supplyId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar insumo" />
                </SelectTrigger>
                <SelectContent>
                  {supplies.filter(s => s.isActive).map(supply => (
                    <SelectItem key={supply.id} value={supply.id.toString()}>
                      {supply.name} ({supply.unitMeasure})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Pulsos</label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={newIngredient.pulsos}
                  onChange={(e) => setNewIngredient(prev => ({ ...prev, pulsos: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">kg/pulso</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newIngredient.kgPorPulso}
                  onChange={(e) => setNewIngredient(prev => ({ ...prev, kgPorPulso: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">O cantidad directa (TN)</label>
              <Input
                type="number"
                min="0"
                step="0.00001"
                value={newIngredient.quantity}
                onChange={(e) => setNewIngredient(prev => ({ ...prev, quantity: e.target.value }))}
                placeholder="0"
              />
            </div>

            {newIngredient.pulsos && newIngredient.kgPorPulso && (
              <p className="text-sm text-muted-foreground">
                Cantidad calculada: {calculateToneladas(newIngredient.pulsos, newIngredient.kgPorPulso).toFixed(5)} TN
              </p>
            )}

          </DialogBody>
          <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={addIngredient}
                disabled={!newIngredient.supplyId || (!newIngredient.quantity && !newIngredient.pulsos)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
