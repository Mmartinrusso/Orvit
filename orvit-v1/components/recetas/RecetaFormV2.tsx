'use client';

import { DEFAULT_COLORS, type UserColorPreferences } from '@/lib/colors';
import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Recipe, RecipeIngredient } from '@/hooks/use-recetas';
import { useSubcategories } from '@/hooks/use-subcategories';
import { useCompany } from '@/contexts/CompanyContext';
import {
  Plus, Trash2, Package, Scale, BookOpen, Loader2, Factory, Layers, Boxes, ShoppingCart,
  ChevronDown, Search, Tag, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';





// Zod schema for form validation
const RecipeFormSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  recipeTarget: z.enum(['product', 'subcategory']),
  productId: z.string().optional(),
  subcategoryId: z.string().optional(),
  baseType: z.enum(['PER_BATCH', 'PER_BANK', 'PER_M3']),
  version: z.string().default('1'),
  description: z.string().optional(),
  notes: z.string().optional(),
  outputQuantity: z.string().optional(),
  outputUnitLabel: z.string().default('unidades'),
  intermediateQuantity: z.string().optional(),
  intermediateUnitLabel: z.string().default('placas'),
  unitsPerItem: z.string().optional(),
  metrosUtiles: z.string().optional(),
  cantidadPastones: z.string().optional(),
});

type RecipeFormData = z.infer<typeof RecipeFormSchema>;

interface RecetaFormV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRecipe: Recipe | null;
  products: any[];
  categories: any[];
  supplies: any[];
  getCurrentPrice: (supplyId: number) => number;
  onSuccess: () => void;
  userColors?: UserColors;
}

export default function RecetaFormV2({
  open,
  onOpenChange,
  editingRecipe,
  products,
  categories,
  supplies,
  getCurrentPrice,
  onSuccess,
  userColors = DEFAULT_COLORS,
}: RecetaFormV2Props) {
  const { currentCompany } = useCompany();
  const [saving, setSaving] = useState(false);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [bankIngredients, setBankIngredients] = useState<RecipeIngredient[]>([]);

  // Ingredient input state
  const [selectedSupplyId, setSelectedSupplyId] = useState('');
  const [ingredientQuantity, setIngredientQuantity] = useState('');
  const [inputMode, setInputMode] = useState<'direct' | 'pulsos'>('direct');
  const [pulsos, setPulsos] = useState('');
  const [kgPorPulso, setKgPorPulso] = useState('');

  // Bank ingredient input state
  const [selectedBankSupplyId, setSelectedBankSupplyId] = useState('');
  const [bankIngredientQuantity, setBankIngredientQuantity] = useState('');

  // Combobox de insumos: búsqueda y filtro
  const [supplyPopoverOpen, setSupplyPopoverOpen] = useState(false);
  const [supplySearch, setSupplySearch] = useState('');
  const [supplyCategoryFilter, setSupplyCategoryFilter] = useState<string>('all');

  // Subcategories
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>();
  const { subcategories } = useSubcategories(currentCompany?.id, selectedCategoryId);

  const form = useForm<RecipeFormData>({
    resolver: zodResolver(RecipeFormSchema),
    defaultValues: {
      name: '',
      recipeTarget: 'product',
      productId: '',
      subcategoryId: '',
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
      cantidadPastones: '',
    },
  });

  const baseType = form.watch('baseType');

  // Load recipe data when editing
  useEffect(() => {
    if (open) {
      if (editingRecipe) {
        form.reset({
          name: editingRecipe.name || '',
          recipeTarget: editingRecipe.subcategoryId ? 'subcategory' : 'product',
          productId: editingRecipe.productId?.toString() || '',
          subcategoryId: editingRecipe.subcategoryId?.toString() || '',
          baseType: (editingRecipe.baseType as any) || 'PER_BATCH',
          version: editingRecipe.version || '1',
          description: editingRecipe.description || '',
          notes: editingRecipe.notes || '',
          outputQuantity: editingRecipe.outputQuantity?.toString() || '',
          outputUnitLabel: editingRecipe.outputUnitLabel || 'unidades',
          intermediateQuantity: editingRecipe.intermediateQuantity?.toString() || '',
          intermediateUnitLabel: editingRecipe.intermediateUnitLabel || 'placas',
          unitsPerItem: editingRecipe.unitsPerItem?.toString() || '',
          metrosUtiles: editingRecipe.metrosUtiles?.toString() || '',
          cantidadPastones: editingRecipe.cantidadPastones?.toString() || '',
        });
        loadRecipeIngredients(editingRecipe.id);
      } else {
        form.reset();
        setIngredients([]);
        setBankIngredients([]);
      }
    }
  }, [open, editingRecipe]);

  const loadRecipeIngredients = async (recipeId: number) => {
    try {
      const response = await fetch(`/api/recetas/${recipeId}?companyId=${currentCompany?.id}`);
      if (response.ok) {
        const data = await response.json();
        setIngredients(data.ingredients || []);
        setBankIngredients(data.bankIngredients || []);
      }
    } catch (error) {
      console.error('Error loading recipe ingredients:', error);
    }
  };

  // Categorías únicas de los supplies disponibles
  const supplyCategories = useMemo(() => {
    const cats = new Map<number, string>();
    supplies.forEach(s => {
      if (s.categoryId && s.categoryName) cats.set(s.categoryId, s.categoryName);
    });
    return Array.from(cats.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [supplies]);

  // Supplies filtrados para el picker (excluye ya agregados, aplica búsqueda y categoría)
  const filteredSuppliesForPicker = useMemo(() => {
    return supplies
      .filter(s => !ingredients.some(i => i.supplyId === s.id))
      .filter(s => {
        if (supplyCategoryFilter !== 'all' && s.categoryId?.toString() !== supplyCategoryFilter) return false;
        if (supplySearch && !s.name.toLowerCase().includes(supplySearch.toLowerCase())) return false;
        return true;
      });
  }, [supplies, ingredients, supplyCategoryFilter, supplySearch]);

  const selectedSupplyData = supplies.find(s => s.id.toString() === selectedSupplyId);

  // Calculate costs
  const totalCost = ingredients.reduce((sum, ing) => {
    const price = getCurrentPrice(ing.supplyId);
    return sum + (Number(ing.quantity || 0) * price);
  }, 0);

  const bankCost = bankIngredients.reduce((sum, ing) => {
    const price = getCurrentPrice(ing.supplyId);
    return sum + (Number(ing.quantity || 0) * price);
  }, 0);

  const cantidadPastonesNum = parseFloat(form.watch('cantidadPastones') || '1');
  const totalRecipeCost = baseType === 'PER_BANK'
    ? (totalCost * cantidadPastonesNum) + bankCost
    : totalCost + bankCost;

  // Add ingredient
  const handleAddIngredient = () => {
    if (!selectedSupplyId) {
      toast.error('Selecciona un insumo');
      return;
    }

    const supply = supplies.find(s => s.id.toString() === selectedSupplyId);
    if (!supply) return;

    let quantity = parseFloat(ingredientQuantity);

    if (inputMode === 'pulsos' && pulsos && kgPorPulso) {
      quantity = parseFloat(pulsos) * parseFloat(kgPorPulso);
    }

    if (!quantity || quantity <= 0) {
      toast.error('Cantidad inválida');
      return;
    }

    if (ingredients.some(i => i.supplyId === supply.id)) {
      toast.error('Este insumo ya está en la receta');
      return;
    }

    const newIngredient: RecipeIngredient = {
      supplyId: supply.id,
      supplyName: supply.name,
      quantity,
      unitMeasure: supply.unitMeasure,
      pulsos: inputMode === 'pulsos' ? parseFloat(pulsos) : undefined,
      kgPorPulso: inputMode === 'pulsos' ? parseFloat(kgPorPulso) : undefined,
    };

    setIngredients([...ingredients, newIngredient]);
    setSelectedSupplyId('');
    setIngredientQuantity('');
    setPulsos('');
    setKgPorPulso('');
  };

  // Add bank ingredient
  const handleAddBankIngredient = () => {
    if (!selectedBankSupplyId) {
      toast.error('Selecciona un insumo');
      return;
    }

    const supply = supplies.find(s => s.id.toString() === selectedBankSupplyId);
    if (!supply) return;

    const quantity = parseFloat(bankIngredientQuantity);
    if (!quantity || quantity <= 0) {
      toast.error('Cantidad inválida');
      return;
    }

    if (bankIngredients.some(i => i.supplyId === supply.id)) {
      toast.error('Este insumo ya está en el banco');
      return;
    }

    const newIngredient: RecipeIngredient = {
      supplyId: supply.id,
      supplyName: supply.name,
      quantity,
      unitMeasure: supply.unitMeasure,
    };

    setBankIngredients([...bankIngredients, newIngredient]);
    setSelectedBankSupplyId('');
    setBankIngredientQuantity('');
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleRemoveBankIngredient = (index: number) => {
    setBankIngredients(bankIngredients.filter((_, i) => i !== index));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const onSubmit = async (data: RecipeFormData) => {
    if (ingredients.length === 0) {
      toast.error('Agrega al menos un ingrediente');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: data.name,
        productId: data.recipeTarget === 'product' && data.productId
          ? parseInt(data.productId)
          : null,
        subcategoryId: data.recipeTarget === 'subcategory' && data.subcategoryId
          ? parseInt(data.subcategoryId)
          : null,
        baseType: data.baseType,
        version: data.version,
        description: data.description,
        notes: data.notes,
        outputQuantity: data.outputQuantity ? parseFloat(data.outputQuantity) : null,
        outputUnitLabel: data.outputUnitLabel,
        intermediateQuantity: data.intermediateQuantity
          ? parseFloat(data.intermediateQuantity)
          : null,
        intermediateUnitLabel: data.intermediateUnitLabel,
        unitsPerItem: data.unitsPerItem ? parseFloat(data.unitsPerItem) : null,
        metrosUtiles: data.metrosUtiles ? parseFloat(data.metrosUtiles) : null,
        cantidadPastones: data.cantidadPastones ? parseInt(data.cantidadPastones) : null,
        ingredients,
        bankIngredients: data.baseType === 'PER_BANK' ? bankIngredients : [],
        companyId: currentCompany?.id,
      };

      const url = editingRecipe
        ? `/api/recetas/${editingRecipe.id}`
        : '/api/recetas';

      const response = await fetch(url, {
        method: editingRecipe ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al guardar');
      }

      toast.success(editingRecipe ? 'Receta actualizada' : 'Receta creada');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar receta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <BookOpen className="h-5 w-5" />
            {editingRecipe ? 'Editar Receta' : 'Nueva Receta'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Configure la receta con sus ingredientes y rendimientos
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            <DialogBody>
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="text-foreground">Nombre de la Receta *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Receta Bloque H20 v1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="version"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">Versión</FormLabel>
                        <FormControl>
                          <Input placeholder="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="baseType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">Tipo de Base *</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PER_BATCH">Por Batea (pastón)</SelectItem>
                            <SelectItem value="PER_BANK">Por Banco (viguetas)</SelectItem>
                            <SelectItem value="PER_M3">Por M³</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Recipe Target */}
                <div className="space-y-4 p-4 bg-muted/10 rounded-lg border border-border/30">
                  <h4 className="font-medium text-foreground">Asociar a *</h4>
                  <FormField
                    control={form.control}
                    name="recipeTarget"
                    render={({ field }) => (
                      <FormItem>
                        <Tabs value={field.value} onValueChange={field.onChange}>
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="product">Producto</TabsTrigger>
                            <TabsTrigger value="subcategory">Subcategoría</TabsTrigger>
                          </TabsList>

                          <TabsContent value="product" className="mt-4">
                            <FormField
                              control={form.control}
                              name="productId"
                              render={({ field: productField }) => (
                                <Select value={productField.value} onValueChange={productField.onChange}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar producto" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {products.map(p => (
                                      <SelectItem key={p.id} value={p.id.toString()}>
                                        <div className="flex items-center gap-2">
                                          <Factory className="h-4 w-4" />
                                          {p.name}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </TabsContent>

                          <TabsContent value="subcategory" className="mt-4 space-y-4">
                            <Select
                              value={selectedCategoryId?.toString() || ''}
                              onValueChange={(v) => {
                                setSelectedCategoryId(parseInt(v));
                                form.setValue('subcategoryId', '');
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Primero selecciona una categoría" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map(c => (
                                  <SelectItem key={c.id} value={c.id.toString()}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {selectedCategoryId && (
                              <FormField
                                control={form.control}
                                name="subcategoryId"
                                render={({ field: subField }) => (
                                  <Select value={subField.value} onValueChange={subField.onChange}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleccionar subcategoría" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {subcategories.map((s: any) => (
                                        <SelectItem key={s.id} value={s.id.toString()}>
                                          {s.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            )}
                          </TabsContent>
                        </Tabs>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Yield Configuration - based on baseType */}
                {baseType === 'PER_BATCH' && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="outputQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cantidad de Salida</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Ej: 50" {...field} />
                          </FormControl>
                          <FormDescription>Productos por batea</FormDescription>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="outputUnitLabel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unidad de Medida</FormLabel>
                          <FormControl>
                            <Input placeholder="unidades" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {baseType === 'PER_BANK' && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="metrosUtiles"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Metros Útiles del Banco</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Ej: 1300" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cantidadPastones"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cantidad de Pastones</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Ej: 14" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <Separator />

                {/* Ingredients Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-foreground flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Ingredientes
                        {baseType === 'PER_BANK' && (
                          <Badge variant="outline" className="ml-2">Por pastón</Badge>
                        )}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Agregue los insumos necesarios
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Costo ingredientes:</div>
                      <div className="text-lg font-bold" style={{ color: userColors.kpiPositive }}>
                        {formatCurrency(totalCost)}
                      </div>
                    </div>
                  </div>

                  {/* Add ingredient form */}
                  <div className="p-4 border border-border/30 rounded-lg space-y-4">
                    <div className="flex gap-2 mb-3">
                      <Button
                        type="button"
                        variant={inputMode === 'direct' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setInputMode('direct')}
                      >
                        Cantidad directa
                      </Button>
                      <Button
                        type="button"
                        variant={inputMode === 'pulsos' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setInputMode('pulsos')}
                      >
                        Pulsos × Kg
                      </Button>
                    </div>

                    <div className="grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-5">
                        <label className="text-sm font-medium">Insumo</label>
                        <Popover open={supplyPopoverOpen} onOpenChange={setSupplyPopoverOpen}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                                "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                              )}
                            >
                              {selectedSupplyData ? (
                                <div className="flex items-center gap-2 min-w-0">
                                  {(selectedSupplyData.stockCantidad ?? 0) > 0 ? (
                                    <Boxes className="h-3.5 w-3.5 text-success shrink-0" />
                                  ) : (selectedSupplyData.supplierItemCount ?? 0) > 0 ? (
                                    <ShoppingCart className="h-3.5 w-3.5 text-warning shrink-0" />
                                  ) : (
                                    <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  )}
                                  <span className="truncate">{selectedSupplyData.name}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Seleccionar insumo</span>
                              )}
                              <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[380px] p-0" align="start">
                            {/* Búsqueda */}
                            <div className="p-2 space-y-2 border-b">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                  placeholder="Buscar insumo..."
                                  value={supplySearch}
                                  onChange={(e) => setSupplySearch(e.target.value)}
                                  className="pl-8 h-8 text-sm"
                                  autoFocus
                                />
                                {supplySearch && (
                                  <button
                                    type="button"
                                    onClick={() => setSupplySearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              {/* Filtro por categoría — siempre visible */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => setSupplyCategoryFilter('all')}
                                  className={cn(
                                    "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors",
                                    supplyCategoryFilter === 'all'
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background border-border hover:bg-muted"
                                  )}
                                >
                                  Todos
                                </button>
                                {supplyCategories.map(cat => (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSupplyCategoryFilter(
                                      supplyCategoryFilter === cat.id.toString() ? 'all' : cat.id.toString()
                                    )}
                                    className={cn(
                                      "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors",
                                      supplyCategoryFilter === cat.id.toString()
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-background border-border hover:bg-muted"
                                    )}
                                  >
                                    <Tag className="h-2.5 w-2.5" />
                                    {cat.name}
                                  </button>
                                ))}
                                {supplyCategories.length === 0 && (
                                  <span className="text-xs text-muted-foreground italic">
                                    Sin categorías configuradas
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Lista con scroll nativo */}
                            <div className="overflow-y-auto max-h-[280px]">
                              {filteredSuppliesForPicker.length === 0 ? (
                                <div className="py-8 text-center text-sm text-muted-foreground">
                                  Sin resultados
                                </div>
                              ) : (
                                <div className="p-1">
                                  {filteredSuppliesForPicker.map(s => {
                                    const precio = getCurrentPrice(s.id);
                                    const tieneStock = (s.stockCantidad ?? 0) > 0;
                                    const pasoPorCompras = (s.supplierItemCount ?? 0) > 0;
                                    return (
                                      <button
                                        key={s.id}
                                        type="button"
                                        className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent text-left"
                                        onClick={() => {
                                          setSelectedSupplyId(s.id.toString());
                                          setSupplyPopoverOpen(false);
                                          setSupplySearch('');
                                        }}
                                      >
                                        {tieneStock ? (
                                          <Boxes className="h-4 w-4 text-success shrink-0" />
                                        ) : pasoPorCompras ? (
                                          <ShoppingCart className="h-4 w-4 text-warning shrink-0" />
                                        ) : (
                                          <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-medium truncate">{s.name}</div>
                                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                            {s.categoryName && (
                                              <span className="text-muted-foreground/70">{s.categoryName}</span>
                                            )}
                                            {precio > 0 && (
                                              <span>{formatCurrency(precio)}/{s.unitMeasure}</span>
                                            )}
                                            {tieneStock && (
                                              <span className="text-success font-medium">
                                                · Stock: {Number(s.stockCantidad).toFixed(2)} {s.unitMeasure}
                                              </span>
                                            )}
                                            {!tieneStock && pasoPorCompras && (
                                              <span className="text-warning">· Sin stock</span>
                                            )}
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {inputMode === 'direct' ? (
                        <div className="col-span-4">
                          <label className="text-sm font-medium">Cantidad</label>
                          <Input
                            type="number"
                            value={ingredientQuantity}
                            onChange={(e) => setIngredientQuantity(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="col-span-2">
                            <label className="text-sm font-medium">Pulsos</label>
                            <Input
                              type="number"
                              value={pulsos}
                              onChange={(e) => setPulsos(e.target.value)}
                              placeholder="0"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-sm font-medium">Kg/pulso</label>
                            <Input
                              type="number"
                              value={kgPorPulso}
                              onChange={(e) => setKgPorPulso(e.target.value)}
                              placeholder="0"
                            />
                          </div>
                        </>
                      )}

                      <div className="col-span-3">
                        <Button type="button" onClick={handleAddIngredient} className="w-full">
                          <Plus className="h-4 w-4 mr-1" />
                          Agregar
                        </Button>
                      </div>
                    </div>

                    {inputMode === 'pulsos' && pulsos && kgPorPulso && (
                      <div className="text-sm text-muted-foreground">
                        Total calculado: <strong>{(parseFloat(pulsos) * parseFloat(kgPorPulso)).toFixed(2)} kg</strong>
                      </div>
                    )}
                  </div>

                  {/* Ingredients list */}
                  {ingredients.length > 0 && (
                    <div className="space-y-2">
                      {ingredients.map((ing, index) => {
                        const price = getCurrentPrice(ing.supplyId);
                        const cost = Number(ing.quantity || 0) * price;
                        const supplyData = supplies.find(s => s.id === ing.supplyId);
                        const tieneStock = (supplyData?.stockCantidad ?? 0) > 0;
                        const stockCantidad = supplyData?.stockCantidad ?? 0;
                        const cantidadUsada = Number(ing.quantity || 0);
                        const stockInsuficiente = tieneStock && cantidadUsada > stockCantidad;
                        return (
                          <div
                            key={index}
                            className={cn(
                              "grid grid-cols-12 gap-3 items-center p-3 rounded-lg",
                              stockInsuficiente ? "bg-warning-muted/30 border border-warning-muted" : "bg-muted/50"
                            )}
                          >
                            <div className="col-span-5">
                              <div className="flex items-center gap-1.5">
                                {tieneStock ? (
                                  <Boxes className="h-3.5 w-3.5 text-success shrink-0" />
                                ) : (supplyData?.supplierItemCount ?? 0) > 0 ? (
                                  <ShoppingCart className="h-3.5 w-3.5 text-warning shrink-0" />
                                ) : null}
                                <p className="font-medium">{ing.supplyName}</p>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {cantidadUsada.toFixed(2)} {ing.unitMeasure}
                                {ing.pulsos && ` (${ing.pulsos} pulsos × ${ing.kgPorPulso} kg)`}
                              </p>
                              {tieneStock && (
                                <p className={cn(
                                  "text-xs mt-0.5",
                                  stockInsuficiente ? "text-warning font-medium" : "text-success"
                                )}>
                                  Stock: {Number(stockCantidad).toFixed(2)} {ing.unitMeasure}
                                  {stockInsuficiente && " · Insuficiente"}
                                </p>
                              )}
                            </div>
                            <div className="col-span-3 text-right text-sm text-muted-foreground">
                              {price > 0 ? `${formatCurrency(price)}/${ing.unitMeasure}` : '—'}
                            </div>
                            <div className="col-span-3 text-right font-medium" style={{ color: userColors.kpiPositive }}>
                              {formatCurrency(cost)}
                            </div>
                            <div className="col-span-1 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveIngredient(index)}
                                className="h-8 w-8 p-0 hover:bg-destructive/10"
                                style={{ color: userColors.kpiNegative }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Bank Ingredients Section (only for PER_BANK) */}
                {baseType === 'PER_BANK' && (
                  <>
                    <Separator />
                    <div className="space-y-4 p-4 rounded-lg" style={{ backgroundColor: `${userColors.chart2}08`, borderColor: `${userColors.chart2}30`, borderWidth: 1 }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium flex items-center gap-2" style={{ color: userColors.chart2 }}>
                            <Scale className="h-4 w-4" />
                            Insumos del Banco
                            <Badge variant="outline" style={{ backgroundColor: `${userColors.chart2}10`, color: userColors.chart2, borderColor: `${userColors.chart2}40` }}>
                              Únicos por banco
                            </Badge>
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Insumos que se agregan una sola vez por banco
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Costo banco:</div>
                          <div className="text-lg font-bold" style={{ color: userColors.chart2 }}>
                            {formatCurrency(bankCost)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-6">
                          <label className="text-sm font-medium">Insumo</label>
                          <Select value={selectedBankSupplyId} onValueChange={setSelectedBankSupplyId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar insumo" />
                            </SelectTrigger>
                            <SelectContent>
                              {supplies
                                .filter(s => !bankIngredients.some(i => i.supplyId === s.id))
                                .map(s => (
                                  <SelectItem key={s.id} value={s.id.toString()}>
                                    {s.name} ({s.unitMeasure})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          <label className="text-sm font-medium">Cantidad</label>
                          <Input
                            type="number"
                            value={bankIngredientQuantity}
                            onChange={(e) => setBankIngredientQuantity(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div className="col-span-3">
                          <Button type="button" variant="outline" onClick={handleAddBankIngredient} className="w-full">
                            <Plus className="h-4 w-4 mr-1" />
                            Agregar
                          </Button>
                        </div>
                      </div>

                      {bankIngredients.length > 0 && (
                        <div className="space-y-2 mt-4">
                          {bankIngredients.map((ing, index) => {
                            const price = getCurrentPrice(ing.supplyId);
                            const cost = Number(ing.quantity || 0) * price;
                            return (
                              <div
                                key={index}
                                className="flex items-center justify-between p-3 rounded-lg"
                                style={{ backgroundColor: `${userColors.chart2}15` }}
                              >
                                <div>
                                  <p className="font-medium">{ing.supplyName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {Number(ing.quantity || 0).toFixed(2)} {ing.unitMeasure}
                                  </p>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="font-medium" style={{ color: userColors.chart2 }}>
                                    {formatCurrency(cost)}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveBankIngredient(index)}
                                    className="h-8 w-8 p-0 hover:bg-destructive/10"
                                    style={{ color: userColors.kpiNegative }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

                <Separator />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción (opcional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descripción de la receta..." rows={2} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Summary */}
                {ingredients.length > 0 && (
                  <div className="p-4 bg-muted/10 rounded-lg border border-border/30">
                    <h4 className="font-medium text-foreground mb-3">Resumen de Costos</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Costo ingredientes (por pastón):</span>
                        <span className="font-medium">{formatCurrency(totalCost)}</span>
                      </div>
                      {baseType === 'PER_BANK' && form.watch('cantidadPastones') && (
                        <>
                          <div className="flex justify-between text-muted-foreground">
                            <span>× {form.watch('cantidadPastones')} pastones:</span>
                            <span>{formatCurrency(totalCost * cantidadPastonesNum)}</span>
                          </div>
                          {bankCost > 0 && (
                            <div className="flex justify-between text-muted-foreground">
                              <span>+ Insumos del banco:</span>
                              <span>{formatCurrency(bankCost)}</span>
                            </div>
                          )}
                        </>
                      )}
                      <Separator className="my-2" />
                      <div className="flex justify-between text-lg">
                        <span className="font-bold">Total:</span>
                        <span className="font-bold" style={{ color: userColors.kpiPositive }}>
                          {formatCurrency(totalRecipeCost)}
                        </span>
                      </div>
                      {baseType === 'PER_BANK' && form.watch('metrosUtiles') && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Costo por metro:</span>
                          <span className="font-medium" style={{ color: userColors.kpiPositive }}>
                            {formatCurrency(totalRecipeCost / parseFloat(form.watch('metrosUtiles') || '1'))}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={saving || ingredients.length === 0}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    {editingRecipe ? 'Actualizar Receta' : 'Crear Receta'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
