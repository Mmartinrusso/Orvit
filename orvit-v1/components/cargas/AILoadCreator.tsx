'use client';

/**
 * AILoadCreator - Creador de cargas impulsado por IA
 *
 * Flujo simplificado:
 * 1. Seleccionar camión
 * 2. Agregar materiales (producto + cantidad)
 * 3. La IA optimiza automáticamente
 * 4. Ver resultado y guardar
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Truck,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Package,
  Scale,
  Ruler,
  Search,
  Wand2,
  Save,
  RotateCcw,
  ChevronsUpDown,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TruckData, LoadItem, AIOptimizationResult } from '@/lib/cargas/types';

interface Product {
  id: string;
  code: string;
  name: string;
  length?: number;
  weight?: number;
}

interface AILoadCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trucks: TruckData[];
  products: Product[];
  onSave: (data: {
    truckId: number;
    date: string;
    description: string;
    deliveryClient: string;
    deliveryAddress: string;
    items: LoadItem[];
  }) => Promise<void>;
}

interface ItemEntry {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  length: number;
  weight: number;
}

export default function AILoadCreator({
  open,
  onOpenChange,
  trucks,
  products,
  onSave,
}: AILoadCreatorProps) {
  // Estado del formulario
  const [selectedTruckId, setSelectedTruckId] = useState<number | null>(null);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [deliveryClient, setDeliveryClient] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // Estado de items
  const [items, setItems] = useState<ItemEntry[]>([]);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [productSearchValue, setProductSearchValue] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(10);

  // Estado de IA
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [aiResult, setAiResult] = useState<AIOptimizationResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Estado de guardado
  const [isSaving, setIsSaving] = useState(false);

  // Camión seleccionado
  const selectedTruck = useMemo(() =>
    trucks.find(t => t.id === selectedTruckId),
    [trucks, selectedTruckId]
  );

  // Producto seleccionado para agregar
  const selectedProduct = useMemo(() =>
    products.find(p => p.id === selectedProductId),
    [products, selectedProductId]
  );

  // Totales
  const totals = useMemo(() => {
    const totalWeight = items.reduce((sum, item) =>
      sum + (item.weight * item.quantity) / 1000, 0); // kg a toneladas
    const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalTypes = items.length;
    return { totalWeight, totalUnits, totalTypes };
  }, [items]);

  // Reset form
  const resetForm = useCallback(() => {
    setSelectedTruckId(null);
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setDeliveryClient('');
    setDeliveryAddress('');
    setItems([]);
    setAiResult(null);
    setAiError(null);
    setSelectedProductId('');
    setQuantity(10);
  }, []);

  // Agregar item
  const handleAddItem = useCallback(() => {
    if (!selectedProduct || quantity <= 0) return;

    const newItem: ItemEntry = {
      id: `item-${Date.now()}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity,
      length: selectedProduct.length || 0,
      weight: selectedProduct.weight || 0,
    };

    setItems(prev => [...prev, newItem]);
    setSelectedProductId('');
    setQuantity(10);
    setProductSearchValue('');

    // Limpiar resultado de IA cuando se agregan items
    setAiResult(null);
  }, [selectedProduct, quantity]);

  // Remover item
  const handleRemoveItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
    setAiResult(null);
  }, []);

  // Optimizar con IA
  const handleOptimize = useCallback(async () => {
    if (!selectedTruckId || items.length === 0) {
      toast.error('Seleccioná un camión y agregá items');
      return;
    }

    setIsOptimizing(true);
    setAiError(null);

    try {
      const response = await fetch('/api/loads/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: items.map(item => ({
            productName: item.productName,
            quantity: item.quantity,
            length: item.length,
            weight: item.weight,
          })),
          truckId: selectedTruckId,
          preferences: { prioritize: 'weight_balance' },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al optimizar');
      }

      const data = await response.json();
      setAiResult(data.data);
      toast.success('Carga optimizada por IA');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setAiError(message);
      toast.error(message);
    } finally {
      setIsOptimizing(false);
    }
  }, [selectedTruckId, items]);

  // Guardar carga
  const handleSave = useCallback(async () => {
    if (!selectedTruckId || items.length === 0) {
      toast.error('Completá los datos requeridos');
      return;
    }

    setIsSaving(true);

    try {
      const loadItems: LoadItem[] = items.map((item, index) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        length: item.length,
        weight: item.weight,
        position: index,
        gridPosition: aiResult?.placements.find(p => p.itemIndex === index)
          ? {
              floor: aiResult.placements.find(p => p.itemIndex === index)!.floor,
              row: aiResult.placements.find(p => p.itemIndex === index)!.row,
              col: aiResult.placements.find(p => p.itemIndex === index)!.col,
            }
          : undefined,
      }));

      await onSave({
        truckId: selectedTruckId,
        date,
        description,
        deliveryClient,
        deliveryAddress,
        items: loadItems,
      });

      toast.success('Carga guardada');
      resetForm();
      onOpenChange(false);
    } catch (err) {
      toast.error('Error al guardar la carga');
    } finally {
      setIsSaving(false);
    }
  }, [selectedTruckId, items, date, description, deliveryClient, deliveryAddress, aiResult, onSave, resetForm, onOpenChange]);

  // Auto-optimizar cuando hay items y camión
  useEffect(() => {
    if (selectedTruckId && items.length > 0 && !aiResult && !isOptimizing) {
      // Debounce para no llamar en cada cambio
      const timer = setTimeout(() => {
        handleOptimize();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedTruckId, items.length]); // Solo dependencias clave

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetForm();
      onOpenChange(newOpen);
    }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-info-muted-foreground" />
            Nueva Carga con IA
          </DialogTitle>
          <DialogDescription>
            Agregá los materiales y la IA optimiza el acomodo automáticamente
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="grid grid-cols-2 gap-6">
            {/* Columna izquierda: Configuración y materiales */}
            <div className="space-y-4">
              {/* Selección de camión */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Camión
                </Label>
                <Select
                  value={selectedTruckId?.toString() || ''}
                  onValueChange={(v) => {
                    setSelectedTruckId(parseInt(v));
                    setAiResult(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar camión" />
                  </SelectTrigger>
                  <SelectContent>
                    {trucks.filter(t => t.isActive !== false).map((truck) => (
                      <SelectItem key={truck.id} value={truck.id.toString()}>
                        <div className="flex items-center gap-2">
                          <span>{truck.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {truck.type}
                          </Badge>
                          <span className="text-muted-foreground text-xs">
                            {truck.length}m
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Info del camión seleccionado */}
              {selectedTruck && (
                <Card className="bg-muted/50">
                  <CardContent className="p-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Tipo:</span>
                      <p className="font-medium">{selectedTruck.type}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Largo:</span>
                      <p className="font-medium">{selectedTruck.length}m</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Peso máx:</span>
                      <p className="font-medium">{selectedTruck.maxWeight || '-'} Tn</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Agregar material */}
              <div className="space-y-2 p-3 border rounded-lg bg-background">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Package className="h-4 w-4" />
                  Agregar Material
                </Label>

                <div className="flex gap-2">
                  {/* Buscador de producto */}
                  <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={productSearchOpen}
                        className="flex-1 justify-between"
                      >
                        {selectedProduct ? selectedProduct.name : "Buscar producto..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Buscar por nombre o código..."
                          value={productSearchValue}
                          onValueChange={setProductSearchValue}
                        />
                        <CommandList>
                          <CommandEmpty>No se encontraron productos</CommandEmpty>
                          <CommandGroup>
                            {products
                              .filter(p =>
                                p.name.toLowerCase().includes(productSearchValue.toLowerCase()) ||
                                p.code.toLowerCase().includes(productSearchValue.toLowerCase())
                              )
                              .slice(0, 20)
                              .map((product) => (
                                <CommandItem
                                  key={product.id}
                                  value={product.id}
                                  onSelect={() => {
                                    setSelectedProductId(product.id);
                                    setProductSearchOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedProductId === product.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex-1">
                                    <p className="text-sm">{product.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {product.code} • {product.length || 0}m • {product.weight || 0}kg
                                    </p>
                                  </div>
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {/* Cantidad */}
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                    className="w-24"
                    min={1}
                    placeholder="Cant."
                  />

                  {/* Botón agregar */}
                  <Button
                    onClick={handleAddItem}
                    disabled={!selectedProduct || quantity <= 0}
                    size="icon"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Lista de items agregados */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Materiales ({items.length})
                </Label>
                <ScrollArea className="h-[200px] border rounded-lg">
                  {items.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      Agregá materiales para cargar
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {items.map((item, index) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} uds • {item.length}m • {item.weight}kg/u
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Datos adicionales (colapsado) */}
              <details className="border rounded-lg">
                <summary className="p-3 cursor-pointer text-sm font-medium">
                  Datos adicionales (opcional)
                </summary>
                <div className="p-3 pt-0 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Fecha</Label>
                    <DatePicker
                      value={date}
                      onChange={(d) => setDate(d)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cliente</Label>
                    <Input
                      value={deliveryClient}
                      onChange={(e) => setDeliveryClient(e.target.value)}
                      placeholder="Nombre del cliente"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dirección</Label>
                    <Input
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Dirección de entrega"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notas</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Notas adicionales"
                      rows={2}
                    />
                  </div>
                </div>
              </details>
            </div>

            {/* Columna derecha: Resultado de IA */}
            <div className="space-y-4">
              {/* Estado de la IA */}
              <Card className={cn(
                "transition-colors",
                isOptimizing && "border-info/50 bg-info-muted/50",
                aiResult && "border-success/50 bg-success-muted/50",
                aiError && "border-destructive/50 bg-destructive/5"
              )}>
                <CardContent className="p-4">
                  {!selectedTruckId || items.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Wand2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Seleccioná un camión y agregá materiales</p>
                      <p className="text-xs mt-1">La IA optimizará automáticamente</p>
                    </div>
                  ) : isOptimizing ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-12 w-12 mx-auto mb-3 animate-spin text-info-muted-foreground" />
                      <p className="text-sm font-medium">Optimizando con IA...</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Analizando {items.length} materiales para {selectedTruck?.name}
                      </p>
                    </div>
                  ) : aiError ? (
                    <div className="text-center py-8">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-destructive" />
                      <p className="text-sm font-medium text-destructive">Error de optimización</p>
                      <p className="text-xs text-muted-foreground mt-1">{aiError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={handleOptimize}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reintentar
                      </Button>
                    </div>
                  ) : aiResult ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-success">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-medium">Carga optimizada</span>
                      </div>

                      {/* Stats de la optimización */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-background rounded-lg border">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">Balance</span>
                            <Badge variant={aiResult.stats.balanceScore >= 70 ? "default" : "destructive"}>
                              {aiResult.stats.balanceScore}%
                            </Badge>
                          </div>
                          <Progress value={aiResult.stats.balanceScore} className="h-2" />
                        </div>
                        <div className="p-3 bg-background rounded-lg border">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">Utilización</span>
                            <Badge variant="outline">
                              {aiResult.stats.utilizationPercent}%
                            </Badge>
                          </div>
                          <Progress value={aiResult.stats.utilizationPercent} className="h-2" />
                        </div>
                      </div>

                      {/* Peso total */}
                      <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                        <div className="flex items-center gap-2">
                          <Scale className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Peso total</span>
                        </div>
                        <span className="font-bold">
                          {(aiResult.stats.totalWeight / 1000).toFixed(2)} Tn
                        </span>
                      </div>

                      {/* Peso por piso */}
                      <div className="p-3 bg-background rounded-lg border">
                        <span className="text-xs text-muted-foreground block mb-2">Distribución por piso</span>
                        <div className="flex gap-1">
                          {aiResult.stats.weightPerFloor.map((weight, floor) => (
                            <div key={floor} className="flex-1 text-center">
                              <div
                                className="bg-info-muted rounded-t"
                                style={{
                                  height: `${Math.max(20, (weight / Math.max(...aiResult.stats.weightPerFloor)) * 60)}px`
                                }}
                              />
                              <div className="text-[10px] text-muted-foreground mt-1">P{floor + 1}</div>
                              <div className="text-xs font-medium">{weight}kg</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Razonamiento de la IA */}
                      {aiResult.reasoning && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground">
                            <Sparkles className="h-3 w-3 inline mr-1" />
                            {aiResult.reasoning}
                          </p>
                        </div>
                      )}

                      {/* Advertencias */}
                      {aiResult.warnings && aiResult.warnings.length > 0 && (
                        <div className="space-y-1">
                          {aiResult.warnings.map((warning, i) => (
                            <div key={i} className="flex items-start gap-2 text-warning-muted-foreground text-xs">
                              <AlertTriangle className="h-3 w-3 mt-0.5" />
                              <span>{warning}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Botón reoptimizar */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={handleOptimize}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reoptimizar
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Sparkles className="h-12 w-12 mx-auto mb-3 text-info-muted-foreground/50" />
                      <p className="text-sm">Listo para optimizar</p>
                      <Button
                        className="mt-3"
                        onClick={handleOptimize}
                      >
                        <Wand2 className="h-4 w-4 mr-2" />
                        Optimizar con IA
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Resumen de la carga */}
              {items.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="text-sm font-medium mb-3">Resumen</h4>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="text-2xl font-bold text-info-muted-foreground">
                          {totals.totalUnits}
                        </div>
                        <div className="text-xs text-muted-foreground">unidades</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-info-muted-foreground">
                          {totals.totalTypes}
                        </div>
                        <div className="text-xs text-muted-foreground">tipos</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-success">
                          {totals.totalWeight.toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground">toneladas</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!selectedTruckId || items.length === 0 || isSaving}
            className="gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Guardar Carga
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
