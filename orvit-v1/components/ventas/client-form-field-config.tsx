'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Settings2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { CLIENT_FORM_FEATURES } from '@/lib/constants/client-form-features';
import { cn } from '@/lib/utils';

interface ClientFormFieldConfigProps {
  onConfigChange?: () => void;
}

export function ClientFormFieldConfig({ onConfigChange }: ClientFormFieldConfigProps) {
  const [open, setOpen] = useState(false);
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [maxFeatures, setMaxFeatures] = useState<number | null>(null);

  // Cargar configuración actual
  useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open]);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ventas/client-form-config');
      if (res.ok) {
        const data = await res.json();
        setEnabledFields(data.enabledFields || {});
        setMaxFeatures(data.maxFeatures);
      }
    } catch (error) {
      console.error('Error loading config:', error);
      toast.error('Error cargando configuración');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFeature = async (featureId: string, enabled: boolean) => {
    // No permitir deshabilitar features core
    const feature = CLIENT_FORM_FEATURES.find(f => f.id === featureId);
    if (feature?.isCore) {
      toast.error('Este campo es obligatorio y no se puede deshabilitar');
      return;
    }

    // Calcular cuántos opcionales están habilitados
    const optionalFeatures = CLIENT_FORM_FEATURES.filter(f => !f.isCore);
    const currentEnabled = optionalFeatures.filter(f => enabledFields[f.id]).length;

    // Validar límite si se está habilitando
    if (enabled && maxFeatures !== null && currentEnabled >= maxFeatures) {
      toast.error(`Límite alcanzado: máximo ${maxFeatures} funcionalidades opcionales`);
      return;
    }

    // Actualizar estado local inmediatamente
    const newConfig = { ...enabledFields, [featureId]: enabled };
    setEnabledFields(newConfig);

    // Guardar en servidor
    setIsSaving(true);
    try {
      const res = await fetch('/api/ventas/client-form-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledFields: newConfig }),
      });

      if (res.ok) {
        toast.success(enabled ? 'Campo habilitado' : 'Campo deshabilitado');
        onConfigChange?.();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error guardando configuración');
        // Revertir cambio local
        setEnabledFields(enabledFields);
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Error guardando configuración');
      // Revertir cambio local
      setEnabledFields(enabledFields);
    } finally {
      setIsSaving(false);
    }
  };

  // Agrupar por categoría
  const groupedFeatures = CLIENT_FORM_FEATURES.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, typeof CLIENT_FORM_FEATURES>);

  const categoryNames = {
    basic: 'Datos Básicos',
    contact: 'Contacto',
    financial: 'Financiero',
    commercial: 'Comercial',
    tax: 'Impositivo',
    advanced: 'Avanzado',
  };

  const categoryIcons = {
    basic: '📋',
    contact: '📞',
    financial: '💰',
    commercial: '🏢',
    tax: '📊',
    advanced: '⚙️',
  };

  // Calcular estadísticas
  const totalOptional = CLIENT_FORM_FEATURES.filter(f => !f.isCore).length;
  const enabledOptional = CLIENT_FORM_FEATURES.filter(f => !f.isCore && enabledFields[f.id]).length;
  const remaining = maxFeatures !== null ? maxFeatures - enabledOptional : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title="Configurar campos del formulario"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px]" align="end">
        <div className="space-y-4">
          {/* Header */}
          <div className="space-y-1">
            <h4 className="font-medium leading-none flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Configurar Formulario
            </h4>
            <p className="text-xs text-muted-foreground">
              Elige qué campos mostrar en el formulario de cliente
            </p>
          </div>

          {/* Stats */}
          {maxFeatures !== null && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <div className="flex-1">
                <p className="text-xs font-medium">Campos opcionales</p>
                <p className="text-xs text-muted-foreground">
                  {enabledOptional} de {maxFeatures} habilitados
                </p>
              </div>
              {remaining !== null && (
                <Badge variant={remaining > 0 ? 'secondary' : 'destructive'}>
                  {remaining === 0 ? 'Límite alcanzado' : `${remaining} disponibles`}
                </Badge>
              )}
            </div>
          )}

          {/* Loading state */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Features by category */}
              <div className="max-h-[400px] overflow-y-auto pr-2">
                <Accordion type="single" collapsible defaultValue="basic">
                  {Object.entries(groupedFeatures).map(([category, features]) => (
                    <AccordionItem key={category} value={category}>
                      <AccordionTrigger className="text-sm">
                        <span className="flex items-center gap-2">
                          <span>{categoryIcons[category as keyof typeof categoryIcons]}</span>
                          <span>{categoryNames[category as keyof typeof categoryNames]}</span>
                          <Badge variant="outline" className="text-xs">
                            {features.filter(f => enabledFields[f.id] || f.isCore).length}/{features.length}
                          </Badge>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 pl-6 pr-2">
                          {features.map((feature) => {
                            const isEnabled = enabledFields[feature.id] || feature.isCore;
                            const isCore = feature.isCore;

                            return (
                              <div
                                key={feature.id}
                                className={cn(
                                  "flex items-start gap-3 p-2 rounded-md transition-colors",
                                  isEnabled && "bg-primary/5"
                                )}
                              >
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={(checked) => toggleFeature(feature.id, checked)}
                                  disabled={isCore || isSaving}
                                  className="mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Label className={cn(
                                      "text-xs font-medium cursor-pointer",
                                      !isEnabled && "text-muted-foreground"
                                    )}>
                                      {feature.name}
                                    </Label>
                                    {isCore && (
                                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                        Obligatorio
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {feature.description}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                    Campos: {feature.fields.join(', ')}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>

              {/* Footer info */}
              <div className="pt-2 border-t">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <p>
                    Los cambios se aplican inmediatamente. Los campos obligatorios no se pueden deshabilitar.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
