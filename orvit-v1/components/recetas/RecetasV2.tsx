'use client';

import { DEFAULT_COLORS, type UserColorPreferences } from '@/lib/colors';
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRecetas, Recipe } from '@/hooks/use-recetas';
import { useProductos } from '@/hooks/use-productos';
import { useInsumos } from '@/hooks/use-insumos';
import { useCompany } from '@/contexts/CompanyContext';
import {
  BookOpen, Plus, Edit, Trash2, Eye, Calculator, Package, DollarSign,
  Send, TestTube, TrendingUp, Search, ToggleLeft, ToggleRight, X,
  LayoutGrid, List, Filter, MoreVertical, ChevronDown, Layers,
  FileText, Copy, Beaker, ArrowUpDown, Sparkles, Activity, Target,
  Zap, ChefHat, FlaskConical, Boxes, Scale, Download, CheckSquare,
  Square, CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatNumber } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

// Import sub-components
import RecetaFormV2 from './RecetaFormV2';
import RecetaDetailSheet from './RecetaDetailSheet';
import PruebasCostosV2 from './PruebasCostosV2';

// Color preferences interface




// Helper function to format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

type ViewMode = 'grid' | 'list' | 'compact';
type ActiveSection = 'recipes' | 'simulator';

export default function RecetasV2() {
  const confirm = useConfirm();
  const { currentCompany } = useCompany();
  const { recipes, loading, error, fetchRecipeDetail, createRecipe, updateRecipe, deleteRecipe, refreshData } = useRecetas();
  const { products, categories } = useProductos();
  const { supplies, getCurrentPrice } = useInsumos();

  // Color preferences
  const [userColors, setUserColors] = useState<UserColorPreferences>(DEFAULT_COLORS);

  // View states
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeSection, setActiveSection] = useState<ActiveSection>('recipes');
  const [showFilters, setShowFilters] = useState(false);

  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProductId, setFilterProductId] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterBaseType, setFilterBaseType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'date' | 'ingredients'>('name');

  // Dialog/Sheet States
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [notesContent, setNotesContent] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Recipe prices cache
  const [recipePrices, setRecipePrices] = useState<{[key: number]: number}>({});

  // Bulk selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedRecipes, setSelectedRecipes] = useState<number[]>([]);

  // Load user color preferences
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

  // Load recipe prices
  useEffect(() => {
    const loadPrices = async () => {
      if (!currentCompany?.id || recipes.length === 0) return;

      const prices: {[key: number]: number} = {};

      try {
        const response = await fetch(`/api/recetas?companyId=${currentCompany?.id}&includeIngredients=true`);
        if (!response.ok) return;

        const recipesWithIngredients = await response.json();

        for (const recipe of recipesWithIngredients) {
          if (recipe.ingredients && recipe.ingredients.length > 0) {
            const costoPorPaston = recipe.ingredients.reduce((total: number, ingredient: any) => {
              const latestPrice = ingredient.currentPrice || getCurrentPrice(ingredient.supplyId);
              return total + (ingredient.quantity * latestPrice);
            }, 0);

            const costoBanco = (recipe.bankIngredients || []).reduce((total: number, ingredient: any) => {
              const latestPrice = ingredient.currentPrice || getCurrentPrice(ingredient.supplyId);
              return total + (ingredient.quantity * latestPrice);
            }, 0);

            if (recipe.baseType === 'PER_BANK' && recipe.cantidadPastones) {
              prices[recipe.id] = (costoPorPaston * recipe.cantidadPastones) + costoBanco;
            } else {
              prices[recipe.id] = costoPorPaston + costoBanco;
            }
          } else {
            prices[recipe.id] = 0;
          }
        }

        setRecipePrices(prices);
      } catch (error) {
        console.error('Error loading recipe prices:', error);
      }
    };

    loadPrices();
  }, [currentCompany?.id, recipes, getCurrentPrice]);

  // Calculate cost per unit for a recipe
  const calculateCostPerUnit = (recipe: Recipe) => {
    const totalPrice = recipePrices[recipe.id] || 0;
    if (recipe.baseType === 'PER_BANK' && recipe.metrosUtiles) {
      return totalPrice / recipe.metrosUtiles;
    }
    if (recipe.outputQuantity) {
      return totalPrice / recipe.outputQuantity;
    }
    return totalPrice;
  };

  // Filtered and sorted recipes
  const filteredRecipes = useMemo(() => {
    let result = [...recipes];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r =>
        r.name.toLowerCase().includes(term) ||
        r.productName?.toLowerCase().includes(term) ||
        r.subcategoryName?.toLowerCase().includes(term) ||
        r.version?.toString().includes(term)
      );
    }

    // Product filter
    if (filterProductId !== 'all') {
      result = result.filter(r => r.productId?.toString() === filterProductId);
    }

    // Status filter
    if (filterActive !== 'all') {
      result = result.filter(r => filterActive === 'active' ? r.isActive : !r.isActive);
    }

    // Base type filter
    if (filterBaseType !== 'all') {
      result = result.filter(r => r.baseType === filterBaseType);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'cost':
          return (recipePrices[b.id] || 0) - (recipePrices[a.id] || 0);
        case 'ingredients':
          return (b.ingredientCount || 0) - (a.ingredientCount || 0);
        case 'date':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [recipes, searchTerm, filterProductId, filterActive, filterBaseType, sortBy, recipePrices]);

  // Stats
  const stats = useMemo(() => {
    const activeRecipes = recipes.filter(r => r.isActive);
    const inactiveRecipes = recipes.filter(r => !r.isActive);
    const totalCost = Object.values(recipePrices).reduce((sum, p) => sum + p, 0);
    const totalIngredients = recipes.reduce((sum, r) => sum + (r.ingredientCount || 0), 0);

    // Validation warnings
    const withoutIngredients = recipes.filter(r => !r.ingredientCount || r.ingredientCount === 0);
    const withoutCost = recipes.filter(r => !recipePrices[r.id] || recipePrices[r.id] === 0);
    const lowCost = recipes.filter(r => recipePrices[r.id] && recipePrices[r.id] < 1000);

    // Top recipes by cost
    const topByCost = [...recipes]
      .filter(r => recipePrices[r.id] > 0)
      .sort((a, b) => (recipePrices[b.id] || 0) - (recipePrices[a.id] || 0))
      .slice(0, 5);

    // Top by ingredients
    const topByIngredients = [...recipes]
      .sort((a, b) => (b.ingredientCount || 0) - (a.ingredientCount || 0))
      .slice(0, 5);

    // By type
    const byType = {
      PER_BATCH: recipes.filter(r => r.baseType === 'PER_BATCH'),
      PER_BANK: recipes.filter(r => r.baseType === 'PER_BANK'),
      PER_M3: recipes.filter(r => r.baseType === 'PER_M3'),
    };

    // Cost ranges
    const costRanges = {
      bajo: recipes.filter(r => recipePrices[r.id] && recipePrices[r.id] < 50000).length,
      medio: recipes.filter(r => recipePrices[r.id] && recipePrices[r.id] >= 50000 && recipePrices[r.id] < 150000).length,
      alto: recipes.filter(r => recipePrices[r.id] && recipePrices[r.id] >= 150000).length,
    };

    // Min and max cost
    const costsArray = Object.values(recipePrices).filter(p => p > 0);
    const minCost = costsArray.length > 0 ? Math.min(...costsArray) : 0;
    const maxCost = costsArray.length > 0 ? Math.max(...costsArray) : 0;

    return {
      total: recipes.length,
      active: activeRecipes.length,
      inactive: inactiveRecipes.length,
      totalCost,
      avgCost: recipes.length > 0 ? totalCost / recipes.length : 0,
      totalIngredients,
      avgIngredients: recipes.length > 0 ? totalIngredients / recipes.length : 0,
      byType: {
        PER_BATCH: byType.PER_BATCH.length,
        PER_BANK: byType.PER_BANK.length,
        PER_M3: byType.PER_M3.length,
      },
      warnings: {
        withoutIngredients: withoutIngredients.length,
        withoutCost: withoutCost.length,
        lowCost: lowCost.length,
        total: withoutIngredients.length + withoutCost.length
      },
      topByCost,
      topByIngredients,
      costRanges,
      minCost,
      maxCost,
    };
  }, [recipes, recipePrices]);

  // Handlers
  const handleViewRecipe = async (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setShowDetailSheet(true);
  };

  const handleEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setShowCreateDialog(true);
  };

  const handleDeleteRecipe = async (recipeId: number) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    const ok = await confirm({
      title: 'Eliminar receta',
      description: `¿Eliminar la receta "${recipe.name}"?`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await deleteRecipe(recipeId);
      toast.success('Receta eliminada');
    } catch (error) {
      toast.error('Error al eliminar receta');
    }
  };

  const handleToggleRecipeActive = async (recipe: Recipe) => {
    try {
      await updateRecipe(recipe.id, { isActive: !recipe.isActive });
      toast.success(recipe.isActive ? 'Receta desactivada' : 'Receta activada');
    } catch (error) {
      toast.error('Error al cambiar estado');
    }
  };

  const handleDuplicateRecipe = async (recipe: Recipe) => {
    try {
      toast.loading('Duplicando receta...', { id: 'duplicate' });

      // Obtener detalles completos de la receta
      const detail = await fetchRecipeDetail(recipe.id);
      if (!detail) {
        toast.error('No se pudo obtener la receta', { id: 'duplicate' });
        return;
      }

      // Crear nueva receta con los mismos datos
      const success = await createRecipe({
        name: `${detail.name} (copia)`,
        productId: detail.productId,
        subcategoryId: detail.subcategoryId,
        baseType: detail.baseType,
        version: '1.0',
        description: detail.description,
        notes: detail.notes,
        outputQuantity: detail.outputQuantity,
        outputUnitLabel: detail.outputUnitLabel,
        intermediateQuantity: detail.intermediateQuantity,
        intermediateUnitLabel: detail.intermediateUnitLabel,
        unitsPerItem: detail.unitsPerItem,
        metrosUtiles: detail.metrosUtiles,
        cantidadPastones: detail.cantidadPastones,
        ingredients: detail.ingredients.map(ing => ({
          supplyId: ing.supplyId,
          quantity: ing.quantity,
          unitMeasure: ing.unitMeasure,
          pulsos: ing.pulsos,
          kgPorPulso: ing.kgPorPulso,
        })),
        bankIngredients: detail.bankIngredients?.map(ing => ({
          supplyId: ing.supplyId,
          quantity: ing.quantity,
          unitMeasure: ing.unitMeasure,
          pulsos: ing.pulsos,
          kgPorPulso: ing.kgPorPulso,
        })),
      });

      if (success) {
        toast.success('Receta duplicada exitosamente', { id: 'duplicate' });
        refreshData();
      } else {
        toast.error('Error al duplicar receta', { id: 'duplicate' });
      }
    } catch (error) {
      toast.error('Error al duplicar receta', { id: 'duplicate' });
    }
  };

  const handleSendRecipe = async (recipe: Recipe) => {
    // Copiar información al portapapeles
    const detail = await fetchRecipeDetail(recipe.id);
    if (!detail) {
      toast.error('No se pudo obtener la receta');
      return;
    }

    const text = `📋 RECETA: ${detail.name}
━━━━━━━━━━━━━━━━━━━━━━
Tipo: ${detail.baseType === 'PER_BATCH' ? 'Por Batea' : detail.baseType === 'PER_BANK' ? 'Por Banco' : 'Por M³'}
${detail.metrosUtiles ? `Metros útiles: ${detail.metrosUtiles}m` : ''}
${detail.cantidadPastones ? `Pastones: ${detail.cantidadPastones}` : ''}

🧪 INGREDIENTES:
${detail.ingredients.map(ing => `  • ${ing.supplyName}: ${ing.quantity} ${ing.unitMeasure}`).join('\n')}
${detail.bankIngredients?.length ? `\n🏗️ INGREDIENTES BANCO:\n${detail.bankIngredients.map(ing => `  • ${ing.supplyName}: ${ing.quantity} ${ing.unitMeasure}`).join('\n')}` : ''}

💰 COSTO TOTAL: ${formatCurrency(detail.totalBatchCost)}
💵 COSTO/UNIDAD: ${formatCurrency(detail.costPerUnit)}`;

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Receta copiada al portapapeles');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  // Bulk actions
  const handleBulkActivate = async () => {
    if (selectedRecipes.length === 0) return;

    toast.loading(`Activando ${selectedRecipes.length} recetas...`, { id: 'bulk' });
    try {
      for (const id of selectedRecipes) {
        await updateRecipe(id, { isActive: true });
      }
      toast.success(`${selectedRecipes.length} recetas activadas`, { id: 'bulk' });
      setSelectedRecipes([]);
      setSelectionMode(false);
      refreshData();
    } catch {
      toast.error('Error al activar recetas', { id: 'bulk' });
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedRecipes.length === 0) return;

    toast.loading(`Desactivando ${selectedRecipes.length} recetas...`, { id: 'bulk' });
    try {
      for (const id of selectedRecipes) {
        await updateRecipe(id, { isActive: false });
      }
      toast.success(`${selectedRecipes.length} recetas desactivadas`, { id: 'bulk' });
      setSelectedRecipes([]);
      setSelectionMode(false);
      refreshData();
    } catch {
      toast.error('Error al desactivar recetas', { id: 'bulk' });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRecipes.length === 0) return;

    const ok = await confirm({
      title: 'Eliminar recetas',
      description: `¿Eliminar ${selectedRecipes.length} recetas? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    toast.loading(`Eliminando ${selectedRecipes.length} recetas...`, { id: 'bulk' });
    try {
      for (const id of selectedRecipes) {
        await deleteRecipe(id);
      }
      toast.success(`${selectedRecipes.length} recetas eliminadas`, { id: 'bulk' });
      setSelectedRecipes([]);
      setSelectionMode(false);
      refreshData();
    } catch {
      toast.error('Error al eliminar recetas', { id: 'bulk' });
    }
  };

  const toggleRecipeSelection = (recipeId: number) => {
    setSelectedRecipes(prev =>
      prev.includes(recipeId)
        ? prev.filter(id => id !== recipeId)
        : [...prev, recipeId]
    );
  };

  const selectAllRecipes = () => {
    if (selectedRecipes.length === filteredRecipes.length) {
      setSelectedRecipes([]);
    } else {
      setSelectedRecipes(filteredRecipes.map(r => r.id));
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Nombre', 'Tipo', 'Insumos', 'Costo Total', 'Costo/Unidad', 'Estado', 'Metros Útiles', 'Pastones'];
    const rows = filteredRecipes.map(recipe => [
      recipe.name,
      recipe.baseType === 'PER_BATCH' ? 'Por Batea' : recipe.baseType === 'PER_BANK' ? 'Por Banco' : 'Por M³',
      recipe.ingredientCount || 0,
      recipePrices[recipe.id] || 0,
      calculateCostPerUnit(recipe),
      recipe.isActive ? 'Activa' : 'Inactiva',
      recipe.metrosUtiles || '',
      recipe.cantidadPastones || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `recetas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Archivo CSV descargado');
  };

  const handleCreateSuccess = () => {
    setShowCreateDialog(false);
    setEditingRecipe(null);
    refreshData();
    toast.success(editingRecipe ? 'Receta actualizada' : 'Receta creada');
  };

  // Get base type info
  const getBaseTypeInfo = (baseType: string) => {
    switch (baseType) {
      case 'PER_BATCH':
        return { label: 'Batea', icon: Boxes, color: 'bg-info-muted text-info-muted-foreground border-info-muted' };
      case 'PER_BANK':
        return { label: 'Banco', icon: Layers, color: 'bg-info-muted text-info-muted-foreground border-info-muted' };
      case 'PER_M3':
        return { label: 'M³', icon: Scale, color: 'bg-info-muted text-info-muted-foreground border-info-muted' };
      default:
        return { label: baseType, icon: Package, color: 'bg-muted text-foreground border-border' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <ChefHat className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Cargando recetas...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Recetas</h1>
            <p className="text-muted-foreground text-sm">Gestiona las listas de materiales (BOM) de tus productos</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Section Toggle */}
            <div className="flex border rounded-lg p-1 bg-muted/30">
              <Button
                variant={activeSection === 'recipes' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveSection('recipes')}
                className="gap-2"
              >
                <BookOpen className="h-4 w-4" />
                Recetas
              </Button>
              <Button
                variant={activeSection === 'simulator' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveSection('simulator')}
                className="gap-2"
              >
                <FlaskConical className="h-4 w-4" />
                Pruebas de Costos
              </Button>
            </div>
            {activeSection === 'recipes' && (
              <Button
                onClick={() => {
                  setEditingRecipe(null);
                  setShowCreateDialog(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Nueva Receta
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        {activeSection === 'recipes' && (
          <div className="space-y-4">
            {/* Row 1: Main KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Recetas</p>
                      <p className="text-2xl font-bold">{stats.total}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium" style={{ color: userColors.kpiPositive }}>{stats.active}</span> activas
                      </p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${userColors.chart1}15` }}
                    >
                      <BookOpen className="h-5 w-5" style={{ color: userColors.chart1 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Recetas Activas</p>
                      <p className="text-2xl font-bold">{stats.active}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium" style={{ color: userColors.kpiNeutral }}>{stats.inactive}</span> inactivas
                      </p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${userColors.kpiPositive}15` }}
                    >
                      <Activity className="h-5 w-5" style={{ color: userColors.kpiPositive }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Insumos</p>
                      <p className="text-2xl font-bold">{stats.totalIngredients}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ~{formatNumber(stats.avgIngredients, 1)} por receta
                      </p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${userColors.chart2}15` }}
                    >
                      <Package className="h-5 w-5" style={{ color: userColors.chart2 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Costo Promedio</p>
                      <p className="text-2xl font-bold">{formatCurrency(stats.avgCost)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        por receta
                      </p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${userColors.chart5}15` }}
                    >
                      <DollarSign className="h-5 w-5" style={{ color: userColors.chart5 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Costo Total</p>
                      <p className="text-2xl font-bold">{formatCurrency(stats.totalCost)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        todas las recetas
                      </p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${userColors.chart6}15` }}
                    >
                      <TrendingUp className="h-5 w-5" style={{ color: userColors.chart6 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Row 2: Distribution and Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Distribution by Type */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Distribución por Tipo</p>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: userColors.chart1 }} />
                          <span className="text-sm">Por Batea</span>
                        </div>
                        <span className="text-xs font-medium">{stats.byType.PER_BATCH}</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            backgroundColor: userColors.chart1,
                            width: stats.total > 0 ? `${(stats.byType.PER_BATCH / stats.total) * 100}%` : '0%'
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: userColors.chart2 }} />
                          <span className="text-sm">Por Banco</span>
                        </div>
                        <span className="text-xs font-medium">{stats.byType.PER_BANK}</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            backgroundColor: userColors.chart2,
                            width: stats.total > 0 ? `${(stats.byType.PER_BANK / stats.total) * 100}%` : '0%'
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: userColors.chart3 }} />
                          <span className="text-sm">Por M³</span>
                        </div>
                        <span className="text-xs font-medium">{stats.byType.PER_M3}</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            backgroundColor: userColors.chart3,
                            width: stats.total > 0 ? `${(stats.byType.PER_M3 / stats.total) * 100}%` : '0%'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Ranges */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Rangos de Costo</p>
                  {/* Stacked Bar */}
                  <div className="h-3 w-full rounded-full overflow-hidden flex mb-3">
                    <div
                      className="h-full transition-all"
                      style={{
                        backgroundColor: userColors.kpiPositive,
                        width: stats.total > 0 ? `${(stats.costRanges.bajo / stats.total) * 100}%` : '0%'
                      }}
                    />
                    <div
                      className="h-full transition-all"
                      style={{
                        backgroundColor: userColors.chart4,
                        width: stats.total > 0 ? `${(stats.costRanges.medio / stats.total) * 100}%` : '0%'
                      }}
                    />
                    <div
                      className="h-full transition-all"
                      style={{
                        backgroundColor: userColors.kpiNegative,
                        width: stats.total > 0 ? `${(stats.costRanges.alto / stats.total) * 100}%` : '0%'
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: userColors.kpiPositive }} />
                        <span className="text-sm">&lt; $50k</span>
                      </div>
                      <Badge variant="secondary" className="text-xs" style={{ backgroundColor: `${userColors.kpiPositive}15`, color: userColors.kpiPositive }}>{stats.costRanges.bajo}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: userColors.chart4 }} />
                        <span className="text-sm">$50k - $150k</span>
                      </div>
                      <Badge variant="secondary" className="text-xs" style={{ backgroundColor: `${userColors.chart4}15`, color: userColors.chart4 }}>{stats.costRanges.medio}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: userColors.kpiNegative }} />
                        <span className="text-sm">&gt; $150k</span>
                      </div>
                      <Badge variant="secondary" className="text-xs" style={{ backgroundColor: `${userColors.kpiNegative}15`, color: userColors.kpiNegative }}>{stats.costRanges.alto}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Warnings */}
              <Card style={stats.warnings.total > 0 ? { borderColor: `${userColors.chart4}50`, backgroundColor: `${userColors.chart4}08` } : {}}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Alertas</p>
                    {stats.warnings.total > 0 && (
                      <Badge style={{ backgroundColor: `${userColors.chart4}20`, color: userColors.chart4, borderColor: `${userColors.chart4}40` }}>{stats.warnings.total}</Badge>
                    )}
                  </div>
                  {stats.warnings.total === 0 ? (
                    <div className="flex items-center gap-2" style={{ color: userColors.kpiPositive }}>
                      <Target className="h-4 w-4" />
                      <span className="text-sm font-medium">Todo en orden</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {stats.warnings.withoutIngredients > 0 && (
                        <div className="flex items-center justify-between" style={{ color: userColors.chart4 }}>
                          <span className="text-sm">Sin insumos</span>
                          <Badge variant="outline" className="text-xs" style={{ borderColor: `${userColors.chart4}60` }}>{stats.warnings.withoutIngredients}</Badge>
                        </div>
                      )}
                      {stats.warnings.withoutCost > 0 && (
                        <div className="flex items-center justify-between" style={{ color: userColors.chart4 }}>
                          <span className="text-sm">Sin costo</span>
                          <Badge variant="outline" className="text-xs" style={{ borderColor: `${userColors.chart4}60` }}>{stats.warnings.withoutCost}</Badge>
                        </div>
                      )}
                      {stats.warnings.lowCost > 0 && (
                        <div className="flex items-center justify-between" style={{ color: userColors.chart4 }}>
                          <span className="text-sm">Costo bajo</span>
                          <Badge variant="outline" className="text-xs" style={{ borderColor: `${userColors.chart4}60` }}>{stats.warnings.lowCost}</Badge>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Min/Max Cost */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Rango de Costos</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Mínimo</span>
                      <span className="font-semibold" style={{ color: userColors.kpiPositive }}>{formatCurrency(stats.minCost)}</span>
                    </div>
                    <div
                      className="h-2 w-full rounded-full"
                      style={{ background: `linear-gradient(to right, ${userColors.kpiPositive}40, ${userColors.chart4}40, ${userColors.kpiNegative}40)` }}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Máximo</span>
                      <span className="font-semibold" style={{ color: userColors.kpiNegative }}>{formatCurrency(stats.maxCost)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Row 3: Top Recipes */}
            {stats.topByCost.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top by Cost */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="h-4 w-4" style={{ color: userColors.chart5 }} />
                      Top 5 Recetas por Costo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {stats.topByCost.map((recipe, index) => (
                        <div
                          key={recipe.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleViewRecipe(recipe)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-muted-foreground w-5">{index + 1}</span>
                            <div>
                              <p className="text-sm font-medium truncate max-w-[200px]">{recipe.name}</p>
                              <p className="text-xs text-muted-foreground">{recipe.ingredientCount || 0} insumos</p>
                            </div>
                          </div>
                          <span className="font-semibold" style={{ color: userColors.chart5 }}>{formatCurrency(recipePrices[recipe.id] || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Top by Ingredients */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="h-4 w-4" style={{ color: userColors.chart2 }} />
                      Top 5 Recetas por Cantidad de Insumos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {stats.topByIngredients.map((recipe, index) => (
                        <div
                          key={recipe.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleViewRecipe(recipe)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-muted-foreground w-5">{index + 1}</span>
                            <div>
                              <p className="text-sm font-medium truncate max-w-[200px]">{recipe.name}</p>
                              <p className="text-xs text-muted-foreground">{formatCurrency(recipePrices[recipe.id] || 0)}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" style={{ backgroundColor: `${userColors.chart2}15`, color: userColors.chart2 }}>{recipe.ingredientCount || 0} insumos</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        {activeSection === 'recipes' ? (
          <div className="flex-1 flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar recetas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setSearchTerm('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Quick Filters */}
              <Select value={filterBaseType} onValueChange={setFilterBaseType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="PER_BATCH">Por Batea</SelectItem>
                  <SelectItem value="PER_BANK">Por Banco</SelectItem>
                  <SelectItem value="PER_M3">Por M³</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterActive} onValueChange={(v: any) => setFilterActive(v)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="active">Activas</SelectItem>
                  <SelectItem value="inactive">Inactivas</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <ArrowUpDown className="h-4 w-4" />
                    Ordenar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortBy('name')}>
                    Por nombre {sortBy === 'name' && '✓'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('cost')}>
                    Por costo {sortBy === 'cost' && '✓'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('ingredients')}>
                    Por insumos {sortBy === 'ingredients' && '✓'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('date')}>
                    Más recientes {sortBy === 'date' && '✓'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* View Toggle */}
              <div className="flex border rounded-lg p-1 gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setViewMode('grid')}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Vista grilla</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Vista lista</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'compact' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setViewMode('compact')}
                    >
                      <Layers className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Vista compacta</TooltipContent>
                </Tooltip>
              </div>

              {/* Selection Mode Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={selectionMode ? 'secondary' : 'outline'}
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      setSelectionMode(!selectionMode);
                      setSelectedRecipes([]);
                    }}
                  >
                    <CheckSquare className="h-4 w-4" />
                    {selectionMode ? 'Cancelar' : 'Seleccionar'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Modo selección múltiple</TooltipContent>
              </Tooltip>

              {/* Export Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleExportCSV}
                  >
                    <Download className="h-4 w-4" />
                    Exportar
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Exportar a CSV</TooltipContent>
              </Tooltip>
            </div>

            {/* Bulk Actions Bar */}
            {selectionMode && (
              <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedRecipes.length === filteredRecipes.length && filteredRecipes.length > 0}
                    onCheckedChange={selectAllRecipes}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedRecipes.length === 0
                      ? 'Seleccionar todas'
                      : `${selectedRecipes.length} seleccionada${selectedRecipes.length !== 1 ? 's' : ''}`}
                  </span>
                </div>
                {selectedRecipes.length > 0 && (
                  <div className="flex items-center gap-2 ml-auto">
                    <Button variant="outline" size="sm" className="gap-1" onClick={handleBulkActivate}>
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      Activar
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={handleBulkDeactivate}>
                      <XCircle className="h-4 w-4 text-warning-muted-foreground" />
                      Desactivar
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 text-destructive hover:bg-destructive/10" onClick={handleBulkDelete}>
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Results count */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filteredRecipes.length === recipes.length
                  ? `${recipes.length} recetas en total`
                  : `${filteredRecipes.length} de ${recipes.length} recetas`}
              </p>
              {(filterProductId !== 'all' || filterActive !== 'all' || filterBaseType !== 'all' || searchTerm) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterProductId('all');
                    setFilterActive('all');
                    setFilterBaseType('all');
                    setSearchTerm('');
                  }}
                  className="text-muted-foreground"
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpiar filtros
                </Button>
              )}
            </div>

            {/* Recipe Grid/List */}
            {filteredRecipes.length === 0 ? (
              <Card className="flex-1 flex items-center justify-center">
                <div className="text-center py-12">
                  <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-1">No hay recetas</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    {recipes.length === 0
                      ? 'Crea tu primera receta para comenzar'
                      : 'No se encontraron recetas con los filtros seleccionados'}
                  </p>
                  {recipes.length === 0 && (
                    <Button onClick={() => setShowCreateDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Crear primera receta
                    </Button>
                  )}
                </div>
              </Card>
            ) : (
              <ScrollArea className="flex-1">
                {viewMode === 'grid' ? (
                  /* GRID VIEW */
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-4">
                    {filteredRecipes.map((recipe) => {
                      const typeInfo = getBaseTypeInfo(recipe.baseType);
                      const cost = calculateCostPerUnit(recipe);
                      const TypeIcon = typeInfo.icon;

                      return (
                        <Card
                          key={recipe.id}
                          className={cn(
                            "group relative overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer border",
                            !recipe.isActive && "opacity-60 bg-muted/30",
                            selectionMode && selectedRecipes.includes(recipe.id) && "ring-2 ring-primary"
                          )}
                          onClick={() => {
                            if (selectionMode) {
                              toggleRecipeSelection(recipe.id);
                            } else {
                              handleViewRecipe(recipe);
                            }
                          }}
                        >
                          {/* Left border accent */}
                          <div className={cn(
                            "absolute left-0 top-0 bottom-0 w-1",
                            recipe.isActive ? "bg-success" : "bg-muted-foreground/30"
                          )} />

                          <CardContent className="p-4">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                              {selectionMode && (
                                <div className="mr-2" onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={selectedRecipes.includes(recipe.id)}
                                    onCheckedChange={() => toggleRecipeSelection(recipe.id)}
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-base truncate">{recipe.name}</h3>
                                <p className="text-xs text-muted-foreground truncate">
                                  {recipe.productName || recipe.subcategoryName || 'Sin asignar'}
                                </p>
                              </div>
                              {!selectionMode && <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem onClick={() => handleViewRecipe(recipe)}>
                                    <Eye className="h-4 w-4 mr-2" /> Ver detalles
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEditRecipe(recipe)}>
                                    <Edit className="h-4 w-4 mr-2" /> Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedRecipe(recipe);
                                    setNotesContent(recipe.notes || '');
                                    setShowNotesDialog(true);
                                  }}>
                                    <FileText className="h-4 w-4 mr-2" /> Notas
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDuplicateRecipe(recipe)}>
                                    <Copy className="h-4 w-4 mr-2" /> Duplicar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleToggleRecipeActive(recipe)}>
                                    {recipe.isActive ? (
                                      <><ToggleLeft className="h-4 w-4 mr-2" /> Desactivar</>
                                    ) : (
                                      <><ToggleRight className="h-4 w-4 mr-2" /> Activar</>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteRecipe(recipe.id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>}
                            </div>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              <Badge variant="outline" className={cn("text-xs", typeInfo.color)}>
                                <TypeIcon className="h-3 w-3 mr-1" />
                                {typeInfo.label}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {recipe.ingredientCount || 0} insumos
                              </Badge>
                              {recipe.isActive ? (
                                <Badge className="bg-success-muted text-success border-success-muted text-xs">
                                  Activa
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Inactiva</Badge>
                              )}
                            </div>

                            {/* Bank info */}
                            {recipe.baseType === 'PER_BANK' && recipe.metrosUtiles && (
                              <div className="flex items-center gap-2 mb-3 p-2 bg-info-muted rounded-lg">
                                <Layers className="h-4 w-4 text-info-muted-foreground" />
                                <span className="text-xs text-info-muted-foreground">
                                  {recipe.metrosUtiles}m útiles
                                  {recipe.cantidadPastones && ` • ${recipe.cantidadPastones} pastones`}
                                </span>
                              </div>
                            )}

                            {/* Cost */}
                            <div className="flex items-center justify-between pt-3 border-t">
                              <span className="text-xs text-muted-foreground">
                                {recipe.baseType === 'PER_BANK' ? 'Costo/metro' : 'Costo/unidad'}
                              </span>
                              <span className="font-bold text-lg text-success">
                                {formatCurrency(cost)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : viewMode === 'list' ? (
                  /* LIST VIEW */
                  <div className="space-y-2 pb-4">
                    {filteredRecipes.map((recipe) => {
                      const typeInfo = getBaseTypeInfo(recipe.baseType);
                      const cost = calculateCostPerUnit(recipe);
                      const TypeIcon = typeInfo.icon;

                      return (
                        <Card
                          key={recipe.id}
                          className={cn(
                            "group transition-all hover:shadow-md cursor-pointer",
                            !recipe.isActive && "opacity-60",
                            selectionMode && selectedRecipes.includes(recipe.id) && "ring-2 ring-primary"
                          )}
                          onClick={() => {
                            if (selectionMode) {
                              toggleRecipeSelection(recipe.id);
                            } else {
                              handleViewRecipe(recipe);
                            }
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              {/* Selection Checkbox */}
                              {selectionMode && (
                                <div onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={selectedRecipes.includes(recipe.id)}
                                    onCheckedChange={() => toggleRecipeSelection(recipe.id)}
                                  />
                                </div>
                              )}
                              {/* Icon */}
                              <div className={cn(
                                "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                                "bg-info-muted"
                              )}>
                                <TypeIcon className={cn(
                                  "h-6 w-6",
                                  "text-info-muted-foreground"
                                )} />
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold truncate">{recipe.name}</h3>
                                  {recipe.isActive ? (
                                    <Badge className="bg-success-muted text-success border-success-muted text-xs shrink-0">
                                      Activa
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-xs shrink-0">Inactiva</Badge>
                                  )}
                                  {recipe.notes && (
                                    <Badge variant="outline" className="bg-warning-muted text-warning-muted-foreground border-warning-muted text-xs shrink-0">
                                      <FileText className="h-3 w-3 mr-1" />
                                      Notas
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span>{recipe.productName || recipe.subcategoryName || 'Sin asignar'}</span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <TypeIcon className="h-3 w-3" />
                                    {typeInfo.label}
                                  </span>
                                  <span>•</span>
                                  <span>{recipe.ingredientCount || 0} insumos</span>
                                  {recipe.baseType === 'PER_BANK' && recipe.metrosUtiles && (
                                    <>
                                      <span>•</span>
                                      <span>{recipe.metrosUtiles}m / {recipe.cantidadPastones} pastones</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Cost */}
                              <div className="text-right shrink-0">
                                <p className="text-xs text-muted-foreground">
                                  {recipe.baseType === 'PER_BANK' ? 'Costo/metro' : 'Costo/unidad'}
                                </p>
                                <p className="font-bold text-xl text-success">{formatCurrency(cost)}</p>
                              </div>

                              {/* Actions */}
                              {!selectionMode && <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEditRecipe(recipe)}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={cn("h-8 w-8 p-0", recipe.isActive ? "text-success" : "text-muted-foreground")}
                                      onClick={() => handleToggleRecipeActive(recipe)}
                                    >
                                      {recipe.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{recipe.isActive ? 'Desactivar' : 'Activar'}</TooltipContent>
                                </Tooltip>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => {
                                      setSelectedRecipe(recipe);
                                      setNotesContent(recipe.notes || '');
                                      setShowNotesDialog(true);
                                    }}>
                                      <FileText className="h-4 w-4 mr-2" /> Notas
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDuplicateRecipe(recipe)}>
                                      <Copy className="h-4 w-4 mr-2" /> Duplicar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleSendRecipe(recipe)}>
                                      <Send className="h-4 w-4 mr-2" /> Enviar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleDeleteRecipe(recipe.id)} className="text-destructive">
                                      <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  /* COMPACT VIEW */
                  <Card>
                    <div className="divide-y">
                      {filteredRecipes.map((recipe) => {
                        const typeInfo = getBaseTypeInfo(recipe.baseType);
                        const cost = calculateCostPerUnit(recipe);

                        return (
                          <div
                            key={recipe.id}
                            className={cn(
                              "flex items-center gap-4 p-3 hover:bg-muted/50 cursor-pointer transition-colors group",
                              !recipe.isActive && "opacity-60",
                              selectionMode && selectedRecipes.includes(recipe.id) && "bg-primary/5"
                            )}
                            onClick={() => {
                              if (selectionMode) {
                                toggleRecipeSelection(recipe.id);
                              } else {
                                handleViewRecipe(recipe);
                              }
                            }}
                          >
                            {selectionMode && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedRecipes.includes(recipe.id)}
                                  onCheckedChange={() => toggleRecipeSelection(recipe.id)}
                                />
                              </div>
                            )}
                            <div className={cn("h-2 w-2 rounded-full shrink-0", recipe.isActive ? "bg-success" : "bg-muted-foreground/30")} />
                            <span className="font-medium flex-1 truncate">{recipe.name}</span>
                            <Badge variant="outline" className={cn("text-xs shrink-0", typeInfo.color)}>
                              {typeInfo.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground shrink-0 w-20">{recipe.ingredientCount} insumos</span>
                            <span className="font-semibold text-success shrink-0 w-24 text-right">{formatCurrency(cost)}</span>
                            {!selectionMode && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEditRecipe(recipe)}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleToggleRecipeActive(recipe)}>
                                  {recipe.isActive ? <ToggleRight className="h-3 w-3 text-success" /> : <ToggleLeft className="h-3 w-3" />}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}
              </ScrollArea>
            )}
          </div>
        ) : (
          /* SIMULATOR SECTION */
          <PruebasCostosV2
            recipes={recipes}
            products={products}
            supplies={supplies}
            userColors={userColors}
            getCurrentPrice={getCurrentPrice}
            fetchRecipeDetail={fetchRecipeDetail}
            companyId={currentCompany?.id}
          />
        )}

        {/* Create/Edit Recipe Dialog */}
        <RecetaFormV2
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          editingRecipe={editingRecipe}
          products={products}
          categories={categories}
          supplies={supplies}
          getCurrentPrice={getCurrentPrice}
          onSuccess={handleCreateSuccess}
        />

        {/* Recipe Detail Sheet */}
        <RecetaDetailSheet
          open={showDetailSheet}
          onOpenChange={setShowDetailSheet}
          recipe={selectedRecipe}
          supplies={supplies}
          getCurrentPrice={getCurrentPrice}
          userColors={userColors}
          onEdit={() => {
            setShowDetailSheet(false);
            if (selectedRecipe) handleEditRecipe(selectedRecipe);
          }}
        />

        {/* Notes Dialog */}
        <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Notas de la Receta
              </DialogTitle>
              <DialogDescription>
                {selectedRecipe?.name}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              {isEditingNotes ? (
                <Textarea
                  value={notesContent}
                  onChange={(e) => setNotesContent(e.target.value)}
                  placeholder="Escribe notas sobre esta receta..."
                  className="min-h-[150px]"
                />
              ) : (
                <div className="min-h-[150px] p-3 border rounded-lg bg-muted/30">
                  {notesContent ? (
                    <p className="text-sm whitespace-pre-wrap">{notesContent}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Sin notas</p>
                  )}
                </div>
              )}
            </DialogBody>
            <DialogFooter className="flex gap-2">
              {isEditingNotes ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNotesContent(selectedRecipe?.notes || '');
                      setIsEditingNotes(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={async () => {
                      if (selectedRecipe) {
                        try {
                          await updateRecipe(selectedRecipe.id, { notes: notesContent });
                          toast.success('Notas guardadas');
                          setIsEditingNotes(false);
                          refreshData();
                        } catch (error) {
                          toast.error('Error al guardar notas');
                        }
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
                    onClick={() => setShowNotesDialog(false)}
                  >
                    Cerrar
                  </Button>
                  <Button
                    onClick={() => setIsEditingNotes(true)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
