'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import {
  FileText,
  DollarSign,
  Calculator,
  TrendingDown,
  Eye,
  EyeOff,
  Info,
  Save,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Percent,
  List,
} from 'lucide-react';

// Métodos de pricing disponibles
const PRICING_METHODS = [
  {
    id: 'LIST',
    name: 'Lista de Precios',
    description: 'Los precios se toman de la lista asignada al cliente',
    icon: List,
    details: 'Ideal para empresas con precios definidos por catálogo (ej: Pretensados Córdoba)',
    hidesCost: true,
    hidesMargin: true,
  },
  {
    id: 'MARGIN',
    name: 'Margen sobre Costo',
    description: 'El precio se calcula aplicando un margen al costo',
    icon: Calculator,
    details: 'Permite calcular precio = costo × (1 + margen). Muestra margen en cotización.',
    hidesCost: false,
    hidesMargin: false,
  },
  {
    id: 'DISCOUNT',
    name: 'Descuento sobre Precio',
    description: 'El precio se calcula aplicando descuentos al precio base',
    icon: TrendingDown,
    details: 'Similar a lista pero con descuentos negociables por cliente.',
    hidesCost: true,
    hidesMargin: true,
  },
] as const;

interface QuoteConfigData {
  pricingMethod: 'LIST' | 'MARGIN' | 'DISCOUNT';
  showCostsInQuotes: boolean;
  showMarginsInQuotes: boolean;
}

export function QuoteConfig() {
  const [config, setConfig] = useState<QuoteConfigData>({
    pricingMethod: 'LIST',
    showCostsInQuotes: false,
    showMarginsInQuotes: false,
  });
  const [originalConfig, setOriginalConfig] = useState<QuoteConfigData>({
    pricingMethod: 'LIST',
    showCostsInQuotes: false,
    showMarginsInQuotes: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Cargar configuración
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/ventas/configuracion/pricing');
        if (res.ok) {
          const data = await res.json();
          setConfig(data.config);
          setOriginalConfig(data.config);
        }
      } catch (error) {
        console.error('Error cargando configuración:', error);
        toast.error('Error cargando configuración de cotizaciones');
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/ventas/configuracion/pricing', {
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

  const selectedMethod = PRICING_METHODS.find(m => m.id === config.pricingMethod);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con acciones */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Configuración de Cotizaciones</h2>
          <p className="text-sm text-muted-foreground">
            Define cómo se calculan y muestran los precios en las cotizaciones
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

      {/* Método de Pricing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Método de Pricing
          </CardTitle>
          <CardDescription className="text-xs">
            Selecciona cómo tu empresa calcula los precios de venta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={config.pricingMethod}
            onValueChange={(value) =>
              setConfig({ ...config, pricingMethod: value as 'LIST' | 'MARGIN' | 'DISCOUNT' })
            }
          >
            <div className="space-y-3">
              {PRICING_METHODS.map((method) => {
                const Icon = method.icon;
                const isSelected = config.pricingMethod === method.id;
                return (
                  <div
                    key={method.id}
                    className={`relative p-4 border rounded-lg transition-colors cursor-pointer ${
                      isSelected ? 'bg-primary/5 border-primary' : 'bg-background hover:bg-muted/50'
                    }`}
                    onClick={() =>
                      setConfig({ ...config, pricingMethod: method.id as 'LIST' | 'MARGIN' | 'DISCOUNT' })
                    }
                  >
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value={method.id} id={method.id} className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="w-4 h-4 text-primary" />
                          <Label htmlFor={method.id} className="text-sm font-medium cursor-pointer">
                            {method.name}
                          </Label>
                          {isSelected && <Badge variant="default" className="text-xs">Activo</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mb-1.5">{method.description}</p>
                        <p className="text-xs text-muted-foreground italic">{method.details}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Visibilidad de Información Sensible */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Visibilidad de Información Sensible
          </CardTitle>
          <CardDescription className="text-xs">
            Controla qué información financiera se muestra en las cotizaciones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Mostrar costos */}
            <div
              className={`p-3 border rounded-lg transition-colors ${
                config.showCostsInQuotes ? 'bg-primary/5 border-primary/20' : 'bg-background'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-sm font-medium">Mostrar Costos</Label>
                    {selectedMethod?.hidesCost && (
                      <Badge variant="secondary" className="text-xs">
                        <EyeOff className="w-3 h-3 mr-1" />
                        Oculto por método
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Muestra el costo unitario de cada producto en la cotización
                  </p>
                  {selectedMethod?.hidesCost && (
                    <p className="text-xs text-orange-600 mt-1">
                      ⚠️ El método "{selectedMethod.name}" oculta esta información automáticamente
                    </p>
                  )}
                </div>
                <Switch
                  checked={config.showCostsInQuotes && !selectedMethod?.hidesCost}
                  onCheckedChange={(checked) => setConfig({ ...config, showCostsInQuotes: checked })}
                  disabled={selectedMethod?.hidesCost}
                />
              </div>
            </div>

            {/* Mostrar márgenes */}
            <div
              className={`p-3 border rounded-lg transition-colors ${
                config.showMarginsInQuotes ? 'bg-primary/5 border-primary/20' : 'bg-background'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-sm font-medium">Mostrar Márgenes</Label>
                    {selectedMethod?.hidesMargin && (
                      <Badge variant="secondary" className="text-xs">
                        <EyeOff className="w-3 h-3 mr-1" />
                        Oculto por método
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Muestra el margen de ganancia (%) en la cotización
                  </p>
                  {selectedMethod?.hidesMargin && (
                    <p className="text-xs text-orange-600 mt-1">
                      ⚠️ El método "{selectedMethod.name}" oculta esta información automáticamente
                    </p>
                  )}
                </div>
                <Switch
                  checked={config.showMarginsInQuotes && !selectedMethod?.hidesMargin}
                  onCheckedChange={(checked) => setConfig({ ...config, showMarginsInQuotes: checked })}
                  disabled={selectedMethod?.hidesMargin}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Información de seguridad */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600" />
            Consideraciones de Seguridad
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            <strong>¿Por qué ocultar costos y márgenes?</strong> En algunos casos, mostrar el costo
            o margen en una cotización puede revelar información sensible de tu empresa.
          </p>
          <p>
            Por ejemplo, con el método "Lista de Precios", el cliente solo ve precios finales sin
            saber cuánto te cuesta producir cada item.
          </p>
          <p className="text-amber-600">
            <AlertCircle className="w-3 h-3 inline mr-1" />
            <strong>Recomendación:</strong> Si trabajas con revendedores o competidores, mantén
            esta información oculta.
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
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-green-600">Configuración guardada</span>
          </>
        )}
      </div>
    </div>
  );
}
