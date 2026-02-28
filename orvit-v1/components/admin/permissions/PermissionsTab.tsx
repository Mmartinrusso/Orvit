'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Eye, Settings, Search, X } from 'lucide-react';
import { getCategoryLabel } from '@/lib/permissions-catalog';
import PermissionList from './PermissionList';
import type { PermissionData, RolePermissionMap } from '@/hooks/use-permissions-data';

interface PermissionsTabProps {
  permissions: PermissionData[];
  categories: string[];
  rolePermissions: RolePermissionMap;
  lang: 'es' | 'en';
  onLangChange: (lang: 'es' | 'en') => void;
  loading: boolean;
}

export default function PermissionsTab({
  permissions,
  categories,
  rolePermissions,
  lang,
  onLangChange,
  loading,
}: PermissionsTabProps) {
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Role counts per permission
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of permissions) {
      counts[p.name] = Object.values(rolePermissions).filter(role =>
        role.permissions.some(rp => rp.name === p.name)
      ).length;
    }
    return counts;
  }, [permissions, rolePermissions]);

  // Filter by category
  const filteredPermissions = useMemo(() => {
    if (categoryFilter === 'all') return permissions;
    return permissions.filter(p => p.category === categoryFilter);
  }, [permissions, categoryFilter]);

  const activeCount = permissions.filter(p => p.isActive).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
        <span className="text-muted-foreground">Cargando permisos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Permisos</p>
                <p className="text-2xl font-bold mt-1">{permissions.length}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted">
                <Shield className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Activos</p>
                <p className="text-2xl font-bold mt-1">{activeCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted">
                <Eye className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${permissions.length > 0 ? Math.round((activeCount / permissions.length) * 100) : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="hidden lg:block">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Categorías</p>
                <p className="text-2xl font-bold mt-1">{categories.length}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted">
                <Settings className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category filter + lang toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48 h-9 bg-background">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>
                {getCategoryLabel(cat, lang)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {categoryFilter !== 'all' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCategoryFilter('all')}
            className="h-9 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Limpiar
          </Button>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-0">
          <Button
            variant={lang === 'es' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 px-2 text-xs rounded-r-none"
            onClick={() => onLangChange('es')}
          >
            ES
          </Button>
          <Button
            variant={lang === 'en' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 px-2 text-xs rounded-l-none"
            onClick={() => onLangChange('en')}
          >
            EN
          </Button>
        </div>
      </div>

      {/* Permission list (read-only mode) */}
      <PermissionList
        permissions={filteredPermissions}
        grantedPermissions={new Set(permissions.filter(p => p.isActive).map(p => p.name))}
        lang={lang}
        showCheckboxes={false}
        showRoleCounts={roleCounts}
        filterModes={['all']}
        emptyMessage="No hay permisos disponibles"
      />
    </div>
  );
}
