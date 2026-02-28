'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search, X, Shield } from 'lucide-react';
import { getPermissionDescription, getCategoryLabel } from '@/lib/permissions-catalog';
import { cn } from '@/lib/utils';
import type { PermissionData } from '@/hooks/use-permissions-data';

type FilterMode = 'all' | 'granted' | 'not_granted';

interface PermissionListProps {
  permissions: PermissionData[];
  grantedPermissions: Set<string>;
  onToggle?: (permissionId: number, permissionName: string, isGranted: boolean) => void;
  readOnlyPermissions?: Set<string>;
  lang: 'es' | 'en';
  showCheckboxes?: boolean;
  showRoleCounts?: Record<string, number>;
  emptyMessage?: string;
  filterModes?: FilterMode[];
  sourceLabels?: Record<string, 'role' | 'custom'>;
}

export default function PermissionList({
  permissions,
  grantedPermissions,
  onToggle,
  readOnlyPermissions,
  lang,
  showCheckboxes = true,
  showRoleCounts,
  emptyMessage = 'No hay permisos disponibles',
  filterModes = ['all', 'granted', 'not_granted'],
  sourceLabels,
}: PermissionListProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');

  // Group and filter permissions
  const { grouped, totalFiltered, totalGranted } = useMemo(() => {
    const filtered = permissions.filter(p => {
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const desc = getPermissionDescription(p.name, lang);
        const matches =
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          desc.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Status filter
      const isGranted = grantedPermissions.has(p.name);
      if (filter === 'granted' && !isGranted) return false;
      if (filter === 'not_granted' && isGranted) return false;

      return true;
    });

    const grouped: Record<string, PermissionData[]> = {};
    for (const p of filtered) {
      const cat = p.category || 'sin_categoria';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    }

    return {
      grouped,
      totalFiltered: filtered.length,
      totalGranted: filtered.filter(p => grantedPermissions.has(p.name)).length,
    };
  }, [permissions, search, filter, grantedPermissions, lang]);

  const entries = Object.entries(grouped).sort(([a], [b]) =>
    getCategoryLabel(a, lang).localeCompare(getCategoryLabel(b, lang))
  );

  const filterLabels: Record<FilterMode, string> = {
    all: 'Todos',
    granted: 'Asignados',
    not_granted: 'Sin asignar',
  };

  const handleToggleCategory = (categoryPerms: PermissionData[], shouldGrant: boolean) => {
    if (!onToggle) return;
    for (const p of categoryPerms) {
      const isReadOnly = readOnlyPermissions?.has(p.name);
      const currentlyGranted = grantedPermissions.has(p.name);
      if (!isReadOnly && currentlyGranted !== shouldGrant) {
        onToggle(p.id, p.name, shouldGrant);
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar permisos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {filterModes.length > 1 && (
          <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-md">
            {filterModes.map(mode => (
              <Button
                key={mode}
                variant={filter === mode ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setFilter(mode)}
              >
                {filterLabels[mode]}
              </Button>
            ))}
          </div>
        )}

        {search && (
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setSearch('')}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Counter */}
      {showCheckboxes && (
        <div className="text-xs text-muted-foreground px-1">
          <span className="font-medium text-foreground">{totalGranted}</span> de{' '}
          <span className="font-medium text-foreground">{totalFiltered}</span> seleccionados
          {search && ` (filtrados de ${permissions.length})`}
        </div>
      )}

      {/* Permission list */}
      {entries.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mx-auto mb-4">
            <Shield className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <h3 className="text-sm font-medium mb-1">Sin resultados</h3>
          <p className="text-xs text-muted-foreground mb-3">{emptyMessage}</p>
          {(search || filter !== 'all') && (
            <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilter('all'); }}>
              Limpiar filtros
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map(([category, categoryPerms]) => {
            const grantedInCat = categoryPerms.filter(p => grantedPermissions.has(p.name)).length;
            const allGranted = grantedInCat === categoryPerms.length;
            const someGranted = grantedInCat > 0 && !allGranted;

            return (
              <div key={category} className="rounded-lg border bg-card overflow-hidden">
                {/* Category header */}
                <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                  <div className="flex items-center gap-2">
                    {showCheckboxes && onToggle && (
                      <Checkbox
                        checked={allGranted}
                        className={cn(someGranted && "opacity-60")}
                        onCheckedChange={(checked) => handleToggleCategory(categoryPerms, !!checked)}
                      />
                    )}
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {getCategoryLabel(category, lang)}
                    </span>
                  </div>
                  <Badge
                    variant={allGranted ? 'default' : 'secondary'}
                    className="text-xs h-5"
                  >
                    {grantedInCat}/{categoryPerms.length}
                  </Badge>
                </div>

                {/* Permission rows */}
                <div className="divide-y">
                  {categoryPerms.map(permission => {
                    const isGranted = grantedPermissions.has(permission.name);
                    const isReadOnly = readOnlyPermissions?.has(permission.name);
                    const source = sourceLabels?.[permission.name];
                    const desc = getPermissionDescription(permission.name, lang);
                    const hasDesc = desc !== permission.name;
                    const roleCount = showRoleCounts?.[permission.name];

                    return (
                      <div
                        key={permission.id}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 transition-colors",
                          isGranted && "bg-primary/5",
                          isReadOnly ? "opacity-70" : "hover:bg-muted/30"
                        )}
                      >
                        {showCheckboxes && (
                          <Checkbox
                            checked={isGranted}
                            disabled={isReadOnly}
                            onCheckedChange={(checked) => {
                              if (!isReadOnly && onToggle) {
                                onToggle(permission.id, permission.name, !!checked);
                              }
                            }}
                          />
                        )}

                        {!showCheckboxes && (
                          <div className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            permission.isActive ? "bg-primary" : "bg-muted-foreground/30"
                          )} />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate">
                              {permission.name}
                            </code>
                            {source === 'role' && (
                              <Badge variant="outline" className="text-xs h-5 shrink-0">Del rol</Badge>
                            )}
                            {source === 'custom' && (
                              <Badge className="text-xs h-5 bg-primary/10 text-primary hover:bg-primary/20 shrink-0">
                                Personalizado
                              </Badge>
                            )}
                          </div>
                          {hasDesc && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{desc}</p>
                          )}
                        </div>

                        {roleCount !== undefined && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {roleCount} {roleCount === 1 ? 'rol' : 'roles'}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
