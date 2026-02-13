'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  Settings,
  Phone,
  CreditCard,
  Truck,
  Receipt,
  Sparkles,
  Save,
  RotateCcw,
  Lock,
  Info,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { CLIENT_FORM_FEATURES, FEATURE_CATEGORIES, DEFAULT_ENABLED_FEATURES, type ClientFormFeature } from '@/lib/constants/client-form-features';

const CATEGORY_ICONS: Record<string, any> = {
  basic: Lock,
  contact: Phone,
  commercial: Truck,
  financial: CreditCard,
  tax: Receipt,
  advanced: Sparkles,
};

export function ClientFormConfig() {
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>(DEFAULT_ENABLED_FEATURES);
  const [maxFeatures, setMaxFeatures] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/ventas/client-form-config');
        if (res.ok) {
          const data = await res.json();
          setEnabledFields(data.enabledFields || DEFAULT_ENABLED_FEATURES);
          setOriginalConfig(data.enabledFields || DEFAULT_ENABLED_FEATURES);
          setMaxFeatures(data.maxFeatures);
        }
      } catch (error) {
        console.error('Error cargando configuración:', error);
        toast.error('Error cargando configuración');
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    const changed = JSON.stringify(enabledFields) !== JSON.stringify(originalConfig);
    setHasChanges(changed);
  }, [enabledFields, originalConfig]);

  const stats = useMemo(() => {
    const coreFeatures = CLIENT_FORM_FEATURES.filter(f => f.isCore);
    const optionalFeatures = CLIENT_FORM_FEATURES.filter(f => !f.isCore);
    const enabledOptional = optionalFeatures.filter(f => enabledFields[f.id]).length;
    const totalOptional = optionalFeatures.length;

    return {
      coreCount: coreFeatures.length,
      optionalCount: totalOptional,
      enabledOptional,
      percentage: totalOptional > 0 ? Math.round((enabledOptional / totalOptional) * 100) : 0,
      remainingSlots: maxFeatures !== null ? Math.max(0, maxFeatures - enabledOptional) : null,
      canAddMore: maxFeatures === null || enabledOptional < maxFeatures,
    };
  }, [enabledFields, maxFeatures]);

  const featuresByCategory = useMemo(() => {
    const grouped: Record<string, ClientFormFeature[]> = {};
    FEATURE_CATEGORIES.forEach(cat => {
      grouped[cat.id] = CLIENT_FORM_FEATURES.filter(f => f.category === cat.id);
    });
    return grouped;
  }, []);

  const toggleFeature = (featureId: string) => {
    const feature = CLIENT_FORM_FEATURES.find(f => f.id === featureId);
    if (!feature || feature.isCore) return;

    const currentlyEnabled = enabledFields[featureId];

    if (!currentlyEnabled && maxFeatures !== null && stats.enabledOptional >= maxFeatures) {
      toast.error(`Límite alcanzado (${maxFeatures} funcionalidades)`);
      return;
    }

    setEnabledFields(prev => ({
      ...prev,
      [featureId]: !prev[featureId],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/ventas/client-form-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledFields }),
      });

      if (res.ok) {
        const data = await res.json();
        setOriginalConfig(data.enabledFields);
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
    setEnabledFields(originalConfig);
    toast.info('Cambios descartados');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
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
            <h2 className="text-lg font-semibold">Campos del Formulario</h2>
            <p className="text-sm text-muted-foreground">
              Personaliza qué campos aparecen al crear o editar clientes
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

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Básicos</p>
                <p className="text-lg font-bold">{stats.coreCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Activas</p>
                <p className="text-lg font-bold">{stats.enabledOptional}/{stats.optionalCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Disponibles</p>
                <p className="text-lg font-bold">{stats.remainingSlots !== null ? stats.remainingSlots : '∞'}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              {hasChanges ? (
                <AlertCircle className="w-4 h-4 text-orange-500" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              )}
              <div>
                <p className="text-xs text-muted-foreground">Estado</p>
                <p className="text-sm font-medium">{hasChanges ? 'Sin guardar' : 'Guardado'}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs por categoría */}
        <Tabs defaultValue="contact" className="w-full">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 p-1">
            {FEATURE_CATEGORIES.filter(c => c.id !== 'basic').map((cat) => {
              const Icon = CATEGORY_ICONS[cat.id] || Settings;
              const categoryFeatures = featuresByCategory[cat.id] || [];
              const enabledCount = categoryFeatures.filter(f => enabledFields[f.id]).length;

              return (
                <TabsTrigger key={cat.id} value={cat.id} className="gap-1.5 text-xs">
                  <Icon className="w-3.5 h-3.5" />
                  {cat.name}
                  {enabledCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                      {enabledCount}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {FEATURE_CATEGORIES.filter(c => c.id !== 'basic').map((cat) => {
            const categoryFeatures = featuresByCategory[cat.id] || [];

            return (
              <TabsContent key={cat.id} value={cat.id} className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{cat.name}</CardTitle>
                    <CardDescription className="text-xs">{cat.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {categoryFeatures.map((feature) => {
                        const isEnabled = enabledFields[feature.id];
                        const canEnable = stats.canAddMore || isEnabled;

                        return (
                          <div
                            key={feature.id}
                            className={`p-3 border rounded-lg transition-colors ${
                              isEnabled ? 'bg-primary/5 border-primary/20' : 'bg-background'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Label className="text-sm font-medium">{feature.name}</Label>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Info className="w-3 h-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <p className="text-xs">{feature.description}</p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Campos: {feature.fields.join(', ')}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {feature.description}
                                </p>
                              </div>
                              <Switch
                                checked={isEnabled}
                                disabled={!canEnable && !isEnabled}
                                onCheckedChange={() => toggleFeature(feature.id)}
                              />
                            </div>
                          </div>
                        );
                      })}

                      {categoryFeatures.length === 0 && (
                        <p className="text-muted-foreground col-span-2 text-center py-6 text-sm">
                          No hay funcionalidades en esta categoría
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>

        {/* Campos básicos */}
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-500" />
              Campos Básicos (Siempre Activos)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {CLIENT_FORM_FEATURES.filter(f => f.isCore).map((feature) => (
                <Badge key={feature.id} variant="secondary" className="py-1 px-2 text-xs">
                  {feature.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
