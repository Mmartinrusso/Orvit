'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Settings2, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface CostVersionToggleProps {
  companyId: string;
  onVersionChange?: (version: string) => void;
}

interface PrerequisiteModule {
  ready: boolean;
  reason?: string;
  [key: string]: any;
}

interface PrerequisitesData {
  ready: boolean;
  readyCount: number;
  totalModules: number;
  currentVersion: string;
  modules: {
    payroll: PrerequisiteModule;
    purchases: PrerequisiteModule;
    sales: PrerequisiteModule;
    production: PrerequisiteModule;
    indirect: PrerequisiteModule;
    maintenance: PrerequisiteModule;
  };
  config: {
    usePayrollData: boolean;
    useComprasData: boolean;
    useVentasData: boolean;
    useProdData: boolean;
    useIndirectData: boolean;
    useMaintData: boolean;
    v2EnabledAt: string | null;
  };
}

const MODULE_LABELS: Record<string, string> = {
  payroll: 'Nominas',
  purchases: 'Compras',
  sales: 'Ventas',
  production: 'Produccion',
  indirect: 'Indirectos',
  maintenance: 'Mantenimiento'
};

export function CostVersionToggle({ companyId, onVersionChange }: CostVersionToggleProps) {
  const queryClient = useQueryClient();
  const [prerequisites, setPrerequisites] = useState<PrerequisitesData | null>(null);
  const [version, setVersion] = useState<string>('V1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  // Cargar prerrequisitos y configuracion
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/costos/v2/prerequisites');
        if (response.ok) {
          const data = await response.json();
          setPrerequisites(data);
          setVersion(data.currentVersion || 'V1');
        }
      } catch (error) {
        console.error('Error fetching prerequisites:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [companyId]);

  const handleVersionChange = async (newVersion: string) => {
    setSaving(true);
    try {
      const response = await fetch('/api/costos/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: newVersion })
      });

      if (response.ok) {
        setVersion(newVersion);
        // Invalidar queries para que ExecutiveDashboard se actualice
        queryClient.invalidateQueries({ queryKey: ['costConfig'] });
        onVersionChange?.(newVersion);
      }
    } catch (error) {
      console.error('Error updating version:', error);
    } finally {
      setSaving(false);
    }
  };

  const refreshPrerequisites = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/costos/v2/prerequisites');
      if (response.ok) {
        const data = await response.json();
        setPrerequisites(data);
      }
    } catch (error) {
      console.error('Error refreshing prerequisites:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-spin h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full" />
        <span className="text-sm text-muted-foreground">Cargando...</span>
      </div>
    );
  }

  // V2 disponible si hay al menos 1 módulo listo (antes requería todos)
  const readyCount = prerequisites?.readyCount ?? 0;
  const totalModules = prerequisites?.totalModules ?? 6;
  const v2Ready = readyCount > 0; // Permitir V2 si hay al menos 1 módulo
  const allReady = prerequisites?.ready ?? false;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-3">
        {/* Badge de version actual */}
        <Badge
          variant={version === 'V2' ? 'default' : version === 'HYBRID' ? 'secondary' : 'outline'}
          className="font-mono"
        >
          {version}
        </Badge>

        {/* Estado de V2 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              {allReady ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : readyCount > 0 ? (
                <AlertCircle className="h-4 w-4 text-warning-muted-foreground" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="text-xs text-muted-foreground">
                {readyCount}/{totalModules}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {allReady
              ? 'V2 completo - todos los modulos listos'
              : readyCount > 0
              ? `V2 parcial - ${readyCount} modulos con datos`
              : 'Sin datos en ningun modulo'}
          </TooltipContent>
        </Tooltip>

        {/* Popover de configuracion */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Settings2 className="h-4 w-4 mr-1" />
              Configurar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Modo de Datos</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshPrerequisites}
                  disabled={loading}
                >
                  <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                </Button>
              </div>

              <RadioGroup
                value={version}
                onValueChange={handleVersionChange}
                disabled={saving}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="V1" id="v1" />
                  <Label htmlFor="v1" className="flex-1 cursor-pointer">
                    <span className="font-medium">Manual (V1)</span>
                    <p className="text-xs text-muted-foreground">
                      Datos ingresados manualmente
                    </p>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="HYBRID" id="hybrid" />
                  <Label htmlFor="hybrid" className="flex-1 cursor-pointer">
                    <span className="font-medium">Hibrido</span>
                    <p className="text-xs text-muted-foreground">
                      V2 donde hay datos, V1 el resto
                    </p>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="V2"
                    id="v2"
                    disabled={!v2Ready}
                  />
                  <Label
                    htmlFor="v2"
                    className={cn('flex-1 cursor-pointer', !v2Ready && 'opacity-50')}
                  >
                    <span className="font-medium">Automatico (V2)</span>
                    <p className="text-xs text-muted-foreground">
                      {allReady ? 'Datos de todos los modulos' : `Datos de ${readyCount} modulos`}
                    </p>
                  </Label>
                  {!v2Ready ? (
                    <Badge variant="outline" className="text-xs">
                      No disponible
                    </Badge>
                  ) : !allReady ? (
                    <Badge variant="secondary" className="text-xs">
                      Parcial
                    </Badge>
                  ) : null}
                </div>
              </RadioGroup>

              {/* Estado de modulos */}
              <div className="pt-3 border-t">
                <h5 className="text-sm font-medium mb-2">Estado de Modulos</h5>
                <div className="space-y-1">
                  {prerequisites?.modules && Object.entries(prerequisites.modules).map(([key, module]) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {MODULE_LABELS[key] || key}
                      </span>
                      {module.ready ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Tooltip>
                          <TooltipTrigger>
                            <XCircle className="h-3.5 w-3.5 text-destructive" />
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-[200px]">
                            {module.reason || 'No hay datos'}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {prerequisites?.config?.v2EnabledAt && (
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  V2 habilitado: {new Date(prerequisites.config.v2EnabledAt).toLocaleDateString('es-AR')}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </TooltipProvider>
  );
}
