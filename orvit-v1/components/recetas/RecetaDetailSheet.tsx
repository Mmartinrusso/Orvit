'use client';

import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Recipe, RecipeIngredient } from '@/hooks/use-recetas';
import { useCompany } from '@/contexts/CompanyContext';
import {
  Edit, Package, Scale, DollarSign, Layers, Hash, FileText,
  Clock, CheckCircle2, XCircle, Calculator, PieChart, BarChart3,
  TrendingUp, Info, Copy, Printer
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecetaDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: Recipe | null;
  supplies: any[];
  getCurrentPrice: (supplyId: number) => number;
  userColors: any;
  onEdit: () => void;
}

export default function RecetaDetailSheet({
  open,
  onOpenChange,
  recipe,
  supplies,
  getCurrentPrice,
  userColors,
  onEdit,
}: RecetaDetailSheetProps) {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [recipeDetail, setRecipeDetail] = useState<any>(null);

  // Load recipe details when opened
  useEffect(() => {
    if (open && recipe) {
      loadRecipeDetail(recipe.id);
    } else {
      setRecipeDetail(null);
    }
  }, [open, recipe]);

  const loadRecipeDetail = async (recipeId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/recetas/${recipeId}?companyId=${currentCompany?.id}`);
      if (response.ok) {
        const data = await response.json();
        setRecipeDetail(data);
      }
    } catch (error) {
      console.error('Error loading recipe detail:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!recipe) return null;

  // Calculate costs
  const ingredients = recipeDetail?.ingredients || [];
  const bankIngredients = recipeDetail?.bankIngredients || [];

  const ingredientsCost = ingredients.reduce((sum: number, ing: any) => {
    const price = ing.currentPrice || getCurrentPrice(ing.supplyId);
    return sum + (ing.quantity * price);
  }, 0);

  const bankCost = bankIngredients.reduce((sum: number, ing: any) => {
    const price = ing.currentPrice || getCurrentPrice(ing.supplyId);
    return sum + (ing.quantity * price);
  }, 0);

  const totalRecipeCost = recipe.baseType === 'PER_BANK' && recipe.cantidadPastones
    ? (ingredientsCost * recipe.cantidadPastones) + bankCost
    : ingredientsCost + bankCost;

  const costPerUnit = recipe.baseType === 'PER_BANK' && recipe.metrosUtiles
    ? totalRecipeCost / recipe.metrosUtiles
    : recipe.outputQuantity
    ? totalRecipeCost / recipe.outputQuantity
    : totalRecipeCost;

  // Get base type info
  const getBaseTypeLabel = (baseType: string) => {
    switch (baseType) {
      case 'PER_BATCH': return 'Por Batea';
      case 'PER_BANK': return 'Por Banco';
      case 'PER_M3': return 'Por M³';
      default: return baseType;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <SheetTitle className="text-xl">{recipe.name}</SheetTitle>
              <SheetDescription>
                {recipe.productName || recipe.subcategoryName || 'Sin producto'}
                {recipe.version && ` • Versión ${recipe.version}`}
              </SheetDescription>
            </div>
            <Badge
              variant={recipe.isActive ? 'default' : 'secondary'}
              className={cn(recipe.isActive && 'bg-green-500')}
            >
              {recipe.isActive ? 'Activa' : 'Inactiva'}
            </Badge>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
            <Button variant="outline" size="sm">
              <Copy className="h-4 w-4 mr-2" />
              Duplicar
            </Button>
            <Button variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Tabs defaultValue="info" className="space-y-4">
              <TabsList className="w-full">
                <TabsTrigger value="info" className="flex-1">Info</TabsTrigger>
                <TabsTrigger value="ingredients" className="flex-1">
                  Ingredientes
                  {ingredients.length > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                      {ingredients.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="costs" className="flex-1">Costos</TabsTrigger>
              </TabsList>

              {/* Info Tab */}
              <TabsContent value="info" className="space-y-4">
                {/* Type and output info */}
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Tipo de base</p>
                        <Badge variant="outline" className="mt-1">
                          <Scale className="h-3 w-3 mr-1" />
                          {getBaseTypeLabel(recipe.baseType)}
                        </Badge>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Ingredientes</p>
                        <p className="font-medium mt-1">{ingredients.length} insumos</p>
                      </div>

                      {recipe.baseType === 'PER_BANK' ? (
                        <>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase">Metros útiles</p>
                            <p className="font-medium mt-1">{recipe.metrosUtiles || '-'} m</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase">Pastones</p>
                            <p className="font-medium mt-1">{recipe.cantidadPastones || '-'}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase">Cantidad salida</p>
                            <p className="font-medium mt-1">
                              {recipe.outputQuantity || '-'} {recipe.outputUnitLabel || 'unidades'}
                            </p>
                          </div>
                          {recipe.intermediateQuantity && (
                            <div>
                              <p className="text-xs text-muted-foreground uppercase">Intermedios</p>
                              <p className="font-medium mt-1">
                                {recipe.intermediateQuantity} {recipe.intermediateUnitLabel || 'placas'}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Cost summary */}
                <Card className="border-l-4" style={{ borderLeftColor: userColors.kpiPositive }}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">
                          Costo por {recipe.baseType === 'PER_BANK' ? 'metro' : 'unidad'}
                        </p>
                        <p className="text-2xl font-bold" style={{ color: userColors.kpiPositive }}>
                          ${costPerUnit.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="h-12 w-12 rounded-full flex items-center justify-center"
                           style={{ backgroundColor: userColors.kpiPositive + '20' }}>
                        <DollarSign className="h-6 w-6" style={{ color: userColors.kpiPositive }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Description and notes */}
                {(recipe.description || recipe.notes) && (
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      {recipe.description && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-1">Descripción</p>
                          <p className="text-sm">{recipe.description}</p>
                        </div>
                      )}
                      {recipe.notes && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-1 flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            Notas
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{recipe.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Ingredients Tab */}
              <TabsContent value="ingredients" className="space-y-4">
                {ingredients.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-8">
                      <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">Sin ingredientes</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Ingredients list */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Ingredientes por pastón
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y">
                          {ingredients.map((ing: any, index: number) => {
                            const price = ing.currentPrice || getCurrentPrice(ing.supplyId);
                            const cost = Number(ing.quantity || 0) * price;
                            const percentage = ingredientsCost > 0 ? (cost / ingredientsCost) * 100 : 0;

                            return (
                              <div key={index} className="p-4 hover:bg-muted/50 transition-colors">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <p className="font-medium">{ing.supplyName}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {Number(ing.quantity || 0).toFixed(2)} {ing.unitMeasure}
                                      {ing.pulsos && ` (${ing.pulsos} pulsos × ${ing.kgPorPulso} kg)`}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-medium text-green-600">
                                      ${cost.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {percentage.toFixed(1)}%
                                    </p>
                                  </div>
                                </div>
                                <Progress
                                  value={percentage}
                                  className="h-1.5"
                                  style={{
                                    ['--progress-background' as any]: userColors.chart1 + '30',
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Bank ingredients (for PER_BANK) */}
                    {recipe.baseType === 'PER_BANK' && bankIngredients.length > 0 && (
                      <Card className="border-purple-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2 text-purple-700">
                            <Layers className="h-4 w-4" />
                            Insumos del Banco
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="divide-y">
                            {bankIngredients.map((ing: any, index: number) => {
                              const price = ing.currentPrice || getCurrentPrice(ing.supplyId);
                              const cost = Number(ing.quantity || 0) * price;

                              return (
                                <div key={index} className="p-4 hover:bg-purple-50/50 transition-colors">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <p className="font-medium">{ing.supplyName}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {Number(ing.quantity || 0).toFixed(2)} {ing.unitMeasure}
                                      </p>
                                    </div>
                                    <p className="font-medium text-purple-600">
                                      ${cost.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </TabsContent>

              {/* Costs Tab */}
              <TabsContent value="costs" className="space-y-4">
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Desglose de Costos
                    </h4>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Costo por pastón</span>
                        <span className="font-medium">
                          ${ingredientsCost.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {recipe.baseType === 'PER_BANK' && recipe.cantidadPastones && (
                        <>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">
                              × {recipe.cantidadPastones} pastones
                            </span>
                            <span>
                              ${(ingredientsCost * recipe.cantidadPastones).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                            </span>
                          </div>

                          {bankCost > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">+ Insumos banco</span>
                              <span>
                                ${bankCost.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </>
                      )}

                      <Separator />

                      <div className="flex justify-between items-center">
                        <span className="font-bold">
                          Total {recipe.baseType === 'PER_BANK' ? 'banco' : 'batea'}
                        </span>
                        <span className="font-bold text-lg text-green-600">
                          ${totalRecipeCost.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm">
                          Costo por {recipe.baseType === 'PER_BANK' ? 'metro' : 'unidad'}
                        </span>
                        <span className="font-medium text-green-600">
                          ${costPerUnit.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Cost breakdown by ingredient */}
                {ingredients.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <PieChart className="h-4 w-4" />
                        Distribución del Costo
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {ingredients
                          .map((ing: any) => {
                            const price = ing.currentPrice || getCurrentPrice(ing.supplyId);
                            const cost = ing.quantity * price;
                            const percentage = ingredientsCost > 0 ? (cost / ingredientsCost) * 100 : 0;
                            return { ...ing, cost, percentage };
                          })
                          .sort((a: any, b: any) => b.percentage - a.percentage)
                          .map((ing: any, index: number) => {
                            const colors = [
                              userColors.donut1,
                              userColors.donut2,
                              userColors.donut3,
                              userColors.donut4,
                              userColors.donut5,
                            ];
                            const color = colors[index % colors.length];

                            return (
                              <div key={index} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: color }}
                                    />
                                    {ing.supplyName}
                                  </span>
                                  <span className="font-medium">{ing.percentage.toFixed(1)}%</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${ing.percentage}%`,
                                      backgroundColor: color,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
