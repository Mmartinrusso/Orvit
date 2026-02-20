'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Settings, RotateCcw, Loader2 } from 'lucide-react';
import { VENTAS_MODULES, MODULE_CATEGORIES, getCoreModules } from '@/lib/sidebar/ventas-modules';
import { useSidebarPreferences } from '@/hooks/use-sidebar-preferences';
import { toast } from 'sonner';

interface SidebarCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SidebarCustomizer({ open, onOpenChange }: SidebarCustomizerProps) {
  const { preferences, toggleModule, resetToDefaults, isUpdating } = useSidebarPreferences('ventas');
  const [localVisible, setLocalVisible] = useState<string[]>([]);

  // Initialize local state when preferences load
  useState(() => {
    if (preferences) {
      setLocalVisible(preferences.visible);
    }
  });

  const handleToggle = (moduleId: string) => {
    toggleModule(moduleId);
  };

  const handleResetToDefaults = () => {
    resetToDefaults();
    toast.success('Preferencias restablecidas a valores predeterminados');
  };

  // Group modules by category
  const coreModules = VENTAS_MODULES.filter((m) => m.category === 'core');
  const optionalModules = VENTAS_MODULES.filter((m) => m.category === 'optional');
  const advancedModules = VENTAS_MODULES.filter((m) => m.category === 'advanced');
  const futureModules = VENTAS_MODULES.filter((m) => m.category === 'future');

  const isModuleVisible = (moduleId: string) => {
    return preferences?.visible.includes(moduleId) ?? true;
  };

  const getCategoryColor = (category: keyof typeof MODULE_CATEGORIES) => {
    const colors = {
      core: 'bg-info-muted text-info-muted-foreground',
      optional: 'bg-muted text-foreground',
      advanced: 'bg-purple-100 text-purple-700',
      future: 'bg-success-muted text-success-muted-foreground',
    };
    return colors[category];
  };

  const renderModuleGroup = (
    title: string,
    modules: typeof VENTAS_MODULES,
    category: keyof typeof MODULE_CATEGORIES
  ) => {
    if (modules.length === 0) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <Badge variant="outline" className={getCategoryColor(category)}>
            {modules.length} módulos
          </Badge>
        </div>
        <div className="space-y-2">
          {modules.map((module) => (
            <div
              key={module.id}
              className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors"
            >
              <Checkbox
                id={module.id}
                checked={isModuleVisible(module.id)}
                onCheckedChange={() => handleToggle(module.id)}
                disabled={module.isCore || isUpdating}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={module.id}
                    className={cn('text-sm font-medium cursor-pointer', module.isCore && 'text-muted-foreground')}
                  >
                    {module.name}
                  </Label>
                  {module.isCore && (
                    <Badge variant="outline" className="text-xs">
                      Requerido
                    </Badge>
                  )}
                  {module.isNew && (
                    <Badge variant="outline" className="text-xs bg-success-muted text-success-muted-foreground">
                      NUEVO
                    </Badge>
                  )}
                </div>
                {module.description && (
                  <p className="text-xs text-muted-foreground mt-1">{module.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Personalizar Sidebar de Ventas
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-6">
          <div className="bg-info-muted border border-info rounded-lg p-4">
            <p className="text-sm text-foreground">
              Selecciona los módulos que deseas ver en tu sidebar. Los módulos marcados como{' '}
              <strong>&quot;Requerido&quot;</strong> no pueden ser desactivados.
            </p>
          </div>

          {renderModuleGroup('Módulos Principales', coreModules, 'core')}
          {renderModuleGroup('Módulos Opcionales', optionalModules, 'optional')}
          {renderModuleGroup('Módulos Avanzados', advancedModules, 'advanced')}
          {renderModuleGroup('Nuevos Módulos', futureModules, 'future')}
        </DialogBody>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToDefaults}
              disabled={isUpdating}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restablecer
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isUpdating}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </DialogFooter>

        {isUpdating && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
