'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  Package,
  Calculator,
  DollarSign,
  Factory,
  ShoppingCart,
  Pencil,
  Info,
  TrendingUp,
  Save,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

// Tipos de costo disponibles
const COST_TYPES = [
  {
    id: 'PRODUCTION',
    name: 'Producción',
    description: 'El costo se calcula a partir de la receta de fabricación',
    icon: Factory,
    details: 'Para productos fabricados. Vincula con recetas y calcula costo de insumos.',
  },
  {
    id: 'PURCHASE',
    name: 'Compra',
    description: 'El costo se actualiza automáticamente con cada compra',
    icon: ShoppingCart,
    details: 'Para productos revendidos. Usa promedio ponderado considerando stock.',
  },
  {
    id: 'MANUAL',
    name: 'Manual',
    description: 'El costo se ingresa manualmente',
    icon: Pencil,
    details: 'Para productos con costos especiales o servicios.',
  },
] as const;

// Configuraciones de productos
const PRODUCT_FEATURES = [
  {
    id: 'autoCostUpdate',
    name: 'Actualización automática de costos',
    description: 'Actualiza el costo del producto automáticamente al registrar compras',
    category: 'costs',
  },
  {
    id: 'weightedAverage',
    name: 'Costo promedio ponderado',
    description: 'Calcula el costo considerando stock existente y precio anterior',
    category: 'costs',
  },
  {
    id: 'costHistory',
    name: 'Historial de costos',
    description: 'Mantiene un registro de la evolución de costos en el tiempo',
    category: 'costs',
  },
  {
    id: 'marginAlerts',
    name: 'Alertas de margen',
    description: 'Alerta cuando el margen de un producto cae bajo el mínimo configurado',
    category: 'alerts',
  },
  {
    id: 'stockAlerts',
    name: 'Alertas de stock',
    description: 'Alerta cuando el stock de un producto llega al mínimo',
    category: 'alerts',
  },
  {
    id: 'priceLists',
    name: 'Múltiples listas de precios',
    description: 'Permite definir diferentes precios para distintos tipos de clientes',
    category: 'pricing',
  },
];

interface ProductStats {
  total: number;
  byType: {
    PRODUCTION: number;
    PURCHASE: number;
    MANUAL: number;
  };
}

export function ProductConfig() {
  const [config, setConfig] = useState<Record<string, boolean>>({
    autoCostUpdate: true,
    weightedAverage: true,
    costHistory: true,
    marginAlerts: true,
    stockAlerts: true,
    priceLists: false,
  });
  const [originalConfig, setOriginalConfig] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Cargar configuración
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/ventas/product-config');
        if (res.ok) {
          const data = await res.json();
          const loadedConfig = data.config || {};
          setConfig(loadedConfig);
          setOriginalConfig(loadedConfig);
          setStats(data.stats);
        }
      } catch (error) {
        console.error('Error cargando configuración:', error);
        toast.error('Error cargando configuración de productos');
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, []);

  // Detectar cambios
  useEffect(() => {
    const changed = JSON.stringify(config) !== JSON.stringify(originalConfig);
    setHasChanges(changed);
  }, [config, originalConfig]);

  const toggleFeature = (featureId: string) => {
    setConfig(prev => ({
      ...prev,
      [featureId]: !prev[featureId],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/ventas/product-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      if (res.ok) {
        const data = await res.json();
        setOriginalConfig(data.config);
        toast.success('Configuración guardada correctamente');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error guardando configuración');
      }
    } catch (error) {
      console.error('Error guardando:', error);
      toast.error('Error guardando configuración');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(originalConfig);
    toast.info('Cambios descartados');
  };

  const costFeatures = PRODUCT_FEATURES.filter(f => f.category === 'costs');
  const alertFeatures = PRODUCT_FEATURES.filter(f => f.category === 'alerts');
  const pricingFeatures = PRODUCT_FEATURES.filter(f => f.category === 'pricing');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header con acciones */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Configuración de Productos</h2>
            <p className="text-sm text-muted-foreground">
              Gestiona cómo se calculan y actualizan los costos de los productos
            </p>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Button variant="outline" size="sm" onClick={handleReset} disabled={isSaving}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Descartar
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar
            </Button>
          </div>
        </div>

        {/* Estadísticas de productos por tipo de costo */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">{stats.total}</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Producción</p>
                  <p className="text-lg font-bold">{stats.byType.PRODUCTION}</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-success" />
                <div>
                  <p className="text-xs text-muted-foreground">Compra</p>
                  <p className="text-lg font-bold">{stats.byType.PURCHASE}</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-orange-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Manual</p>
                  <p className="text-lg font-bold">{stats.byType.MANUAL}</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Tipos de Costo */}
        <div>
          <h3 className="text-base font-semibold mb-2">Tipos de Costo Disponibles</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Cada producto puede tener un tipo de costo diferente. Esto permite que tu empresa
            maneje tanto productos fabricados como comprados.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COST_TYPES.map((type) => {
              const Icon = type.icon;
              const count = stats?.byType[type.id as keyof typeof stats.byType] || 0;
              return (
                <Card key={type.id} className="relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary/60" />
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Icon className="w-5 h-5 text-primary" />
                        {type.name}
                      </span>
                      <Badge variant="secondary">{count}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                    <p className="text-xs text-muted-foreground mt-2 italic">{type.details}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Configuración de Costos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              Configuración de Costos
            </CardTitle>
            <CardDescription className="text-xs">
              Opciones para el cálculo y seguimiento de costos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {costFeatures.map((feature) => (
                <div
                  key={feature.id}
                  className={cn('p-3 border rounded-lg transition-colors', config[feature.id] ? 'bg-primary/5 border-primary/20' : 'bg-background')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-sm font-medium">{feature.name}</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-3 h-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs">{feature.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {feature.description}
                      </p>
                    </div>
                    <Switch
                      checked={config[feature.id] || false}
                      onCheckedChange={() => toggleFeature(feature.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alertas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Alertas y Notificaciones
            </CardTitle>
            <CardDescription className="text-xs">
              Configuración de alertas para productos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alertFeatures.map((feature) => (
                <div
                  key={feature.id}
                  className={cn('p-3 border rounded-lg transition-colors', config[feature.id] ? 'bg-primary/5 border-primary/20' : 'bg-background')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <Label className="text-sm font-medium">{feature.name}</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {feature.description}
                      </p>
                    </div>
                    <Switch
                      checked={config[feature.id] || false}
                      onCheckedChange={() => toggleFeature(feature.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Precios */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Precios y Listas
            </CardTitle>
            <CardDescription className="text-xs">
              Configuración de precios de venta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pricingFeatures.map((feature) => (
                <div
                  key={feature.id}
                  className={cn('p-3 border rounded-lg transition-colors', config[feature.id] ? 'bg-primary/5 border-primary/20' : 'bg-background')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <Label className="text-sm font-medium">{feature.name}</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {feature.description}
                      </p>
                    </div>
                    <Switch
                      checked={config[feature.id] || false}
                      onCheckedChange={() => toggleFeature(feature.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Info de cómo funcionará */}
        <Card className="border-warning-muted bg-warning-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="w-4 h-4 text-warning-muted-foreground" />
              Cómo funciona el cálculo de costos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>
              <strong>Producción:</strong> El costo se calcula sumando el costo de los insumos
              de la receta asignada al producto.
            </p>
            <p>
              <strong>Compra:</strong> Al registrar una compra, el sistema calcula el nuevo costo
              usando promedio ponderado: <code className="bg-muted px-1 rounded">
              (stock_actual × costo_actual + cant_comprada × precio_compra) / stock_nuevo</code>
            </p>
            <p>
              <strong>Manual:</strong> El costo se mantiene fijo hasta que lo modifiques manualmente.
            </p>
          </CardContent>
        </Card>

        {/* Estado */}
        <div className="flex items-center justify-end gap-2 text-sm">
          {hasChanges ? (
            <>
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <span className="text-orange-600">Cambios sin guardar</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-success">Configuración guardada</span>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
