'use client';

import { useSidebarPreferences } from '@/hooks/use-sidebar-preferences';
import { VENTAS_MODULES } from '@/lib/sidebar/ventas-modules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Eye, EyeOff, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SidebarPreferencesConfig() {
  const {
    preferences,
    isLoading,
    isModuleVisible,
    toggleModule,
    resetToDefaults,
  } = useSidebarPreferences('ventas');

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <p>Cargando preferencias...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group modules by category
  const coreModules = VENTAS_MODULES.filter((m) => m.category === 'core');
  const optionalModules = VENTAS_MODULES.filter((m) => m.category === 'optional');
  const advancedModules = VENTAS_MODULES.filter((m) => m.category === 'advanced');
  const futureModules = VENTAS_MODULES.filter((m) => m.category === 'future');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">Personalizar Navegación</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Selecciona qué módulos quieres ver en tu menú lateral. Los módulos
            marcados como "Core" son esenciales y no se pueden ocultar.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={resetToDefaults}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Restaurar predeterminados
        </Button>
      </div>

      <Separator />

      {/* Core Modules (Always visible) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-warning-muted-foreground" />
            Módulos Core
          </CardTitle>
          <CardDescription>
            Estos módulos son esenciales y siempre estarán visibles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {coreModules.map((module) => {
              const visible = isModuleVisible(module.id);
              return (
                <div
                  key={module.id}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border',
                    'bg-muted/30 cursor-not-allowed'
                  )}
                >
                  <Checkbox checked={true} disabled className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{module.name}</p>
                      <Badge variant="secondary" className="text-xs">
                        Core
                      </Badge>
                    </div>
                    {module.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {module.description}
                      </p>
                    )}
                  </div>
                  <Eye className="h-4 w-4 text-muted-foreground mt-1" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Optional Modules */}
      {optionalModules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Módulos Opcionales</CardTitle>
            <CardDescription>
              Activa o desactiva estos módulos según tus necesidades
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {optionalModules.map((module) => {
                const visible = isModuleVisible(module.id);
                return (
                  <div
                    key={module.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                      visible
                        ? 'bg-primary/5 border-primary/20'
                        : 'bg-muted/30 hover:bg-muted/50',
                      'cursor-pointer'
                    )}
                    onClick={() => toggleModule(module.id)}
                  >
                    <Checkbox
                      checked={visible}
                      onCheckedChange={() => toggleModule(module.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{module.name}</p>
                        {module.isNew && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-success-muted text-success-muted-foreground border-success"
                          >
                            Nuevo
                          </Badge>
                        )}
                      </div>
                      {module.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {module.description}
                        </p>
                      )}
                    </div>
                    {visible ? (
                      <Eye className="h-4 w-4 text-primary mt-1" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground mt-1" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Advanced Modules */}
      {advancedModules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Módulos Avanzados</CardTitle>
            <CardDescription>
              Funcionalidades avanzadas para usuarios experimentados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {advancedModules.map((module) => {
                const visible = isModuleVisible(module.id);
                return (
                  <div
                    key={module.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                      visible
                        ? 'bg-primary/5 border-primary/20'
                        : 'bg-muted/30 hover:bg-muted/50',
                      'cursor-pointer'
                    )}
                    onClick={() => toggleModule(module.id)}
                  >
                    <Checkbox
                      checked={visible}
                      onCheckedChange={() => toggleModule(module.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{module.name}</p>
                        {module.isNew && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-success-muted text-success-muted-foreground border-success"
                          >
                            Nuevo
                          </Badge>
                        )}
                      </div>
                      {module.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {module.description}
                        </p>
                      )}
                    </div>
                    {visible ? (
                      <Eye className="h-4 w-4 text-primary mt-1" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground mt-1" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Future Modules */}
      {futureModules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Módulos Futuros</CardTitle>
            <CardDescription>
              Próximas funcionalidades en desarrollo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {futureModules.map((module) => {
                const visible = isModuleVisible(module.id);
                return (
                  <div
                    key={module.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                      visible
                        ? 'bg-primary/5 border-primary/20'
                        : 'bg-muted/30 hover:bg-muted/50',
                      'cursor-pointer'
                    )}
                    onClick={() => toggleModule(module.id)}
                  >
                    <Checkbox
                      checked={visible}
                      onCheckedChange={() => toggleModule(module.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{module.name}</p>
                        <Badge
                          variant="outline"
                          className="text-xs bg-info-muted text-info-muted-foreground border-info"
                        >
                          Próximamente
                        </Badge>
                        {module.isNew && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-success-muted text-success-muted-foreground border-success"
                          >
                            Nuevo
                          </Badge>
                        )}
                      </div>
                      {module.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {module.description}
                        </p>
                      )}
                    </div>
                    {visible ? (
                      <Eye className="h-4 w-4 text-primary mt-1" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground mt-1" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Footer */}
      <Card className="bg-info-muted border-info">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Personalización guardada automáticamente
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Tus cambios se guardan automáticamente y solo afectan tu propia
                experiencia. Los módulos ocultos seguirán siendo accesibles a
                través de la búsqueda.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
