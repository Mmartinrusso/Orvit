'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, ChevronRight, Sparkles } from 'lucide-react';
import PermissionAIAssistant from '@/components/admin/PermissionAIAssistant';
import PermissionList from './PermissionList';
import { cn } from '@/lib/utils';
import type { PermissionData, RoleData } from '@/hooks/use-permissions-data';

// ─── Module mapping ──────────────────────────────────────────────
const MODULE_DEFS: { id: string; label: string; icon: string; prefixes: string[] }[] = [
  { id: 'general', label: 'General', icon: '⚙️', prefixes: ['usuarios', 'empresas', 'configuracion', 'auditoria', 'notificaciones', 'admin', 'navegacion', 'sectores', 'planta', 'preferencias', 'qr'] },
  { id: 'mantenimiento', label: 'Mantenimiento', icon: '🔧', prefixes: ['maquinas', 'tareas', 'tareas_fijas', 'ordenes_trabajo', 'mantenimiento_preventivo', 'reportes', 'controles', 'contadores', 'calibracion', 'lubricacion', 'monitoreo', 'conocimiento'] },
  { id: 'panol', label: 'Pañol', icon: '🏭', prefixes: ['panol'] },
  { id: 'produccion', label: 'Producción', icon: '📊', prefixes: ['produccion'] },
  { id: 'ventas', label: 'Ventas', icon: '💰', prefixes: ['ventas'] },
  { id: 'almacen', label: 'Almacén', icon: '📦', prefixes: ['almacen'] },
  { id: 'compras', label: 'Compras', icon: '🛒', prefixes: ['compras'] },
  { id: 'tesoreria', label: 'Tesorería', icon: '🏦', prefixes: ['tesoreria'] },
  { id: 'seguridad', label: 'Seguridad', icon: '🛡️', prefixes: ['ptw', 'loto', 'skills', 'contratistas', 'moc'] },
  { id: 'cargas', label: 'Cargas', icon: '🚚', prefixes: ['cargas'] },
];

function getCategoryModule(category: string): string {
  for (const mod of MODULE_DEFS) {
    if (mod.prefixes.some(prefix => category === prefix || category.startsWith(prefix + '_'))) {
      return mod.id;
    }
  }
  return 'general';
}

// ─── Component ──────────────────────────────────────────────────

interface RoleDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleName: string | null;
  roleData: RoleData | null;
  allPermissions: PermissionData[];
  lang: 'es' | 'en';
  onLangChange: (lang: 'es' | 'en') => void;
  onTogglePermission: (roleName: string, permissionId: number, isGranted: boolean) => Promise<boolean>;
  onApplyBatch: (roleName: string, permissionNames: string[], currentPermNames: string[]) => Promise<void>;
}

export default function RoleDetailSheet({
  open,
  onOpenChange,
  roleName,
  roleData,
  allPermissions,
  lang,
  onLangChange,
  onTogglePermission,
  onApplyBatch,
}: RoleDetailSheetProps) {
  const [showAI, setShowAI] = useState(false);
  const [activeModule, setActiveModule] = useState('general');

  const grantedPermissions = useMemo(() => {
    if (!roleData) return new Set<string>();
    return new Set(roleData.permissions.map(p => p.name));
  }, [roleData]);

  const currentPermNames = useMemo(() => {
    if (!roleData) return [] as string[];
    return roleData.permissions.map(p => p.name);
  }, [roleData]);

  // Compute per-module permission counts & filter
  const { modules, filteredPermissions } = useMemo(() => {
    const moduleMap: Record<string, PermissionData[]> = {};
    for (const p of allPermissions) {
      const mod = getCategoryModule(p.category || 'sin_categoria');
      if (!moduleMap[mod]) moduleMap[mod] = [];
      moduleMap[mod].push(p);
    }

    const modules = MODULE_DEFS
      .filter(def => moduleMap[def.id]?.length > 0)
      .map(def => {
        const perms = moduleMap[def.id] || [];
        const granted = perms.filter(p => grantedPermissions.has(p.name)).length;
        return { ...def, total: perms.length, granted };
      });

    const filteredPermissions = moduleMap[activeModule] || [];

    return { modules, filteredPermissions };
  }, [allPermissions, grantedPermissions, activeModule]);

  const handleToggle = useCallback(async (permissionId: number, _permissionName: string, isGranted: boolean) => {
    if (roleName) {
      await onTogglePermission(roleName, permissionId, isGranted);
    }
  }, [roleName, onTogglePermission]);

  const handleApplyAI = useCallback(async (permissionNames: string[]) => {
    if (roleName) {
      await onApplyBatch(roleName, permissionNames, currentPermNames);
    }
  }, [roleName, currentPermNames, onApplyBatch]);

  if (!roleName || !roleData) return null;

  const grantedCount = roleData.permissions.length;
  const totalCount = allPermissions.length;
  const progress = totalCount > 0 ? Math.round((grantedCount / totalCount) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        className="sm:!max-w-[75vw] max-h-[85dvh]"
      >
        {/* Header */}
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div>
                <DialogTitle>{roleData.displayName || roleName}</DialogTitle>
                {roleData.description && (
                  <DialogDescription>{roleData.description}</DialogDescription>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 mr-6">
              <Badge variant="outline" className="text-xs h-5">
                <Users className="h-3 w-3 mr-1" />
                {roleData.userCount} {roleData.userCount === 1 ? 'usuario' : 'usuarios'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{grantedCount}</span>/{totalCount} ({progress}%)
              </span>
              <div className="flex items-center gap-0">
                <Button
                  variant={lang === 'es' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 px-2 text-xs rounded-r-none"
                  onClick={() => onLangChange('es')}
                >
                  ES
                </Button>
                <Button
                  variant={lang === 'en' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 px-2 text-xs rounded-l-none"
                  onClick={() => onLangChange('en')}
                >
                  EN
                </Button>
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-1.5 mt-2">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </DialogHeader>

        {/* Body */}
        <DialogBody>
          <div className="space-y-3">
            {/* AI Assistant toggle */}
            <button
              onClick={() => setShowAI(!showAI)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all duration-200",
                showAI
                  ? "bg-primary/5 border-primary/25 shadow-sm"
                  : "bg-muted/40 border-transparent hover:bg-muted/60 hover:border-border"
              )}
            >
              <div className={cn(
                "h-7 w-7 rounded-md flex items-center justify-center shrink-0 transition-colors",
                showAI ? "bg-primary/10" : "bg-background border border-border"
              )}>
                <Sparkles className={cn("h-3.5 w-3.5 transition-colors", showAI ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">Asistente IA</p>
                <p className="text-[11px] text-muted-foreground">Sugerencias inteligentes de permisos</p>
              </div>
              <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200", showAI && "rotate-90")} />
            </button>
            {showAI && (
              <PermissionAIAssistant
                roleName={roleData.displayName || roleName}
                currentPermissions={currentPermNames}
                onApplyPermissions={handleApplyAI}
                lang={lang}
              />
            )}

            {/* Module tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {modules.map(mod => {
                const isActive = mod.id === activeModule;
                return (
                  <button
                    key={mod.id}
                    onClick={() => setActiveModule(mod.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {mod.label}
                    <span className={cn(
                      "text-[10px] px-1 py-0.5 rounded-full min-w-[18px] text-center",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-background text-muted-foreground"
                    )}>
                      {mod.granted}/{mod.total}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Filtered permission list */}
            <PermissionList
              permissions={filteredPermissions}
              grantedPermissions={grantedPermissions}
              onToggle={handleToggle}
              lang={lang}
              showCheckboxes={true}
              emptyMessage="No hay permisos en este módulo"
            />
          </div>
        </DialogBody>

        {/* Footer */}
        <DialogFooter className="sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Los cambios afectan a todos los usuarios con este rol
          </p>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
