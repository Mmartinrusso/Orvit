'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Package, AlertCircle, TrendingUp, Sparkles, CheckCircle2 } from 'lucide-react';
import { mlForecastDemand } from '@/lib/ai/ml-demand-forecasting';
import { toast } from 'sonner';

interface SaleItem {
  id: number;
  productId: number;
  codigo: string;
  descripcion: string;
  cantidad: number;
  cantidadEntregada: number;
  cantidadPendiente: number;
  unidad: string;
  precioUnitario: number;
}

interface DeliveryItemSelection {
  saleItemId: number;
  cantidad: number;
  selected: boolean;
}

interface PartialDeliverySelectorProps {
  saleId: number;
  items: SaleItem[];
  onConfirm: (selections: Array<{ saleItemId: number; cantidad: number }>) => void;
  onCancel: () => void;
  enableAISuggestions?: boolean;
}

interface AISuggestion {
  saleItemId: number;
  suggestedQuantity: number;
  reasoning: string;
  urgencyScore: number;
  confidence: number;
}

export default function PartialDeliverySelector({
  saleId,
  items,
  onConfirm,
  onCancel,
  enableAISuggestions = true,
}: PartialDeliverySelectorProps) {
  const [selections, setSelections] = useState<DeliveryItemSelection[]>([]);
  const [aiSuggestions, setAISuggestions] = useState<AISuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    // Initialize selections
    const initialSelections: DeliveryItemSelection[] = items.map(item => ({
      saleItemId: item.id,
      cantidad: item.cantidadPendiente,
      selected: item.cantidadPendiente > 0,
    }));
    setSelections(initialSelections);

    // Load AI suggestions
    if (enableAISuggestions) {
      loadAISuggestions();
    }
  }, [items, enableAISuggestions]);

  const loadAISuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const suggestions: AISuggestion[] = [];

      for (const item of items) {
        if (item.cantidadPendiente > 0) {
          // Fetch historical data for ML forecasting
          const response = await fetch(`/api/ventas/productos/${item.productId}/historical-sales`);
          if (response.ok) {
            const historicalData = await response.json();

            if (historicalData.length >= 3) {
              const forecast = await mlForecastDemand(item.productId, historicalData, 1);

              // Determine suggested quantity based on forecast and current stock
              const predictedDemand = forecast.forecasts[0]?.cantidadPrediccion || 0;
              const urgencyMultiplier = forecast.trend.direction === 'up' ? 1.2 : 1.0;
              const suggestedQuantity = Math.min(
                item.cantidadPendiente,
                Math.ceil(predictedDemand * urgencyMultiplier)
              );

              let reasoning = `Demanda proyectada: ${predictedDemand} unidades. `;
              if (forecast.trend.direction === 'up') {
                reasoning += 'Tendencia creciente detectada (+20%). ';
              }
              reasoning += `Stock recomendado: ${forecast.recommendation.stockLevel} unidades.`;

              suggestions.push({
                saleItemId: item.id,
                suggestedQuantity,
                reasoning,
                urgencyScore: forecast.trend.direction === 'up' ? 8 : 5,
                confidence: forecast.accuracy.mape < 20 ? 85 : 65,
              });
            }
          }
        }
      }

      setAISuggestions(suggestions);
    } catch (error) {
      console.error('Error loading AI suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleQuantityChange = (saleItemId: number, newQuantity: string) => {
    const quantity = parseFloat(newQuantity);
    const item = items.find(i => i.id === saleItemId);

    if (!item) return;

    // Validate quantity
    const newErrors = { ...errors };
    if (isNaN(quantity) || quantity <= 0) {
      newErrors[saleItemId] = 'Cantidad debe ser mayor a 0';
    } else if (quantity > item.cantidadPendiente) {
      newErrors[saleItemId] = `Máximo: ${item.cantidadPendiente} ${item.unidad}`;
    } else {
      delete newErrors[saleItemId];
    }
    setErrors(newErrors);

    // Update selection
    setSelections(prev =>
      prev.map(sel =>
        sel.saleItemId === saleItemId
          ? { ...sel, cantidad: isNaN(quantity) ? 0 : quantity }
          : sel
      )
    );
  };

  const handleToggleSelection = (saleItemId: number) => {
    setSelections(prev =>
      prev.map(sel =>
        sel.saleItemId === saleItemId ? { ...sel, selected: !sel.selected } : sel
      )
    );
  };

  const handleApplyAISuggestion = (saleItemId: number) => {
    const suggestion = aiSuggestions.find(s => s.saleItemId === saleItemId);
    if (suggestion) {
      setSelections(prev =>
        prev.map(sel =>
          sel.saleItemId === saleItemId
            ? { ...sel, cantidad: suggestion.suggestedQuantity, selected: true }
            : sel
        )
      );

      // Clear any errors
      const newErrors = { ...errors };
      delete newErrors[saleItemId];
      setErrors(newErrors);
    }
  };

  const handleApplyAllSuggestions = () => {
    const newSelections = [...selections];
    const newErrors: Record<number, string> = {};

    aiSuggestions.forEach(suggestion => {
      const index = newSelections.findIndex(s => s.saleItemId === suggestion.saleItemId);
      if (index !== -1) {
        newSelections[index].cantidad = suggestion.suggestedQuantity;
        newSelections[index].selected = true;
      }
    });

    setSelections(newSelections);
    setErrors(newErrors);
  };

  const handleConfirm = () => {
    // Validate all selections
    const selectedItems = selections.filter(sel => sel.selected && sel.cantidad > 0);

    if (selectedItems.length === 0) {
      toast.warning('Debe seleccionar al menos un producto para entregar');
      return;
    }

    // Check for errors
    if (Object.keys(errors).length > 0) {
      toast.warning('Por favor corrija los errores antes de continuar');
      return;
    }

    // Format for API
    const deliveryItems = selectedItems.map(sel => ({
      saleItemId: sel.saleItemId,
      cantidad: sel.cantidad,
    }));

    onConfirm(deliveryItems);
  };

  const selectedCount = selections.filter(s => s.selected).length;
  const totalSelectedQuantity = selections
    .filter(s => s.selected)
    .reduce((sum, s) => sum + s.cantidad, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Seleccionar Productos para Entrega Parcial
            </CardTitle>
            {enableAISuggestions && aiSuggestions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleApplyAllSuggestions}
                disabled={loadingSuggestions}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Aplicar Todas las Sugerencias IA
              </Button>
            )}
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>
              Productos seleccionados: <strong>{selectedCount}</strong> de {items.length}
            </span>
            <span>
              Cantidad total: <strong>{totalSelectedQuantity.toFixed(2)}</strong>
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loadingSuggestions && (
            <Alert className="mb-4">
              <Sparkles className="w-4 h-4" />
              <AlertDescription>
                Analizando demanda con Machine Learning para optimizar entregas...
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            {items.map(item => {
              const selection = selections.find(s => s.saleItemId === item.id);
              const suggestion = aiSuggestions.find(s => s.saleItemId === item.id);
              const error = errors[item.id];

              if (!selection) return null;

              const progressPercent =
                (item.cantidadEntregada / item.cantidad) * 100;

              return (
                <Card
                  key={item.id}
                  className={cn(selection.selected && 'border-primary', 'transition-all')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <Checkbox
                        checked={selection.selected}
                        onCheckedChange={() => handleToggleSelection(item.id)}
                        className="mt-1"
                      />

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="font-medium">{item.descripcion}</div>
                            <div className="text-sm text-muted-foreground">
                              Código: {item.codigo}
                            </div>
                          </div>

                          {/* Progress Badge */}
                          <Badge variant={progressPercent === 100 ? 'default' : 'secondary'}>
                            {item.cantidadEntregada} / {item.cantidad} {item.unidad}
                          </Badge>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-muted rounded-full h-2 mb-3">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>

                        {/* Quantity Input */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 max-w-xs">
                            <label className="text-sm font-medium mb-1 block">
                              Cantidad a entregar
                            </label>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                min={0}
                                max={item.cantidadPendiente}
                                step={0.01}
                                value={selection.cantidad}
                                onChange={e => handleQuantityChange(item.id, e.target.value)}
                                disabled={!selection.selected}
                                className={error ? 'border-destructive' : ''}
                              />
                              <span className="flex items-center text-sm text-muted-foreground min-w-[60px]">
                                {item.unidad}
                              </span>
                            </div>
                            {error && (
                              <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {error}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Pendiente: {item.cantidadPendiente} {item.unidad}
                            </p>
                          </div>

                          {/* AI Suggestion */}
                          {suggestion && (
                            <div className="flex-1">
                              <div className="bg-info-muted border border-info rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <Sparkles className="w-4 h-4 text-primary" />
                                  <span className="text-sm font-medium text-foreground">
                                    Sugerencia IA
                                  </span>
                                  <Badge
                                    variant={suggestion.urgencyScore >= 7 ? 'destructive' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {suggestion.urgencyScore >= 7 ? 'Alta prioridad' : 'Normal'}
                                  </Badge>
                                </div>
                                <p className="text-sm text-foreground mb-2">
                                  {suggestion.suggestedQuantity} {item.unidad}
                                </p>
                                <p className="text-xs text-muted-foreground mb-2">
                                  {suggestion.reasoning}
                                </p>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-info-muted-foreground">
                                    Confianza: {suggestion.confidence}%
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleApplyAISuggestion(item.id)}
                                    className="text-xs h-7"
                                  >
                                    Aplicar
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Additional Info */}
                        {selection.selected && selection.cantidad > 0 && (
                          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                            <span>
                              Valor: ${(item.precioUnitario * selection.cantidad).toFixed(2)}
                            </span>
                            {suggestion && suggestion.urgencyScore >= 7 && (
                              <span className="flex items-center gap-1 text-orange-600">
                                <TrendingUp className="w-3 h-3" />
                                Demanda creciente
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Summary */}
          {selectedCount > 0 && (
            <Alert className="mt-4">
              <CheckCircle2 className="w-4 h-4" />
              <AlertDescription>
                Se creará una entrega parcial con {selectedCount} producto(s) y un total de{' '}
                {totalSelectedQuantity.toFixed(2)} unidades.
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={selectedCount === 0 || Object.keys(errors).length > 0}>
              <Package className="w-4 h-4 mr-2" />
              Crear Entrega Parcial ({selectedCount} productos)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
