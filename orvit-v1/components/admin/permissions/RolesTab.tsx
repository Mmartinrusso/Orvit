'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Settings, Copy, Trash2, Users, Shield } from 'lucide-react';
import type { RolePermissionMap, PermissionData } from '@/hooks/use-permissions-data';
import { useAuth } from '@/contexts/AuthContext';

const SYSTEM_ROLES = ['SUPERADMIN', 'ADMIN', 'SUPERVISOR', 'USER', 'ADMIN_ENTERPRISE'];

interface RolesTabProps {
  rolePermissions: RolePermissionMap;
  totalPermissions: number;
  onManageRole: (roleName: string) => void;
  onCloneRole: (roleName: string) => void;
  onDeleteRole: (roleName: string) => void;
  onCreateRole: () => void;
}

export default function RolesTab({
  rolePermissions,
  totalPermissions,
  onManageRole,
  onCloneRole,
  onDeleteRole,
  onCreateRole,
}: RolesTabProps) {
  const { hasPermission } = useAuth();
  const canManageRoles = hasPermission('admin.roles');

  const customRoles = useMemo(() =>
    Object.entries(rolePermissions).filter(([name]) => !SYSTEM_ROLES.includes(name)),
    [rolePermissions]
  );

  const totalUsers = customRoles.reduce((acc, [, data]) => acc + data.userCount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Roles del Sistema</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {customRoles.length} roles personalizados &bull; {totalUsers} usuarios asignados
          </p>
        </div>
        {canManageRoles && (
          <Button type="button" size="sm" onClick={onCreateRole}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Rol
          </Button>
        )}
      </div>

      {/* Grid */}
      {customRoles.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Sin roles personalizados</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            Crea roles para definir conjuntos de permisos que puedas asignar a usuarios
          </p>
          <Button onClick={onCreateRole}>
            <Plus className="h-4 w-4 mr-2" />
            Crear primer rol
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {customRoles.map(([roleName, roleData]) => {
            const permCount = roleData.permissions.length;
            const progress = totalPermissions > 0 ? Math.round((permCount / totalPermissions) * 100) : 0;

            return (
              <div
                key={roleName}
                className="group rounded-lg border bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all duration-200"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{roleData.displayName}</h3>
                      <p className="text-xs text-muted-foreground">
                        {roleData.userCount} {roleData.userCount === 1 ? 'usuario' : 'usuarios'} &bull; {permCount} permisos
                      </p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {roleData.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {roleData.description}
                  </p>
                )}

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Permisos</span>
                    <span className="text-xs font-medium">{permCount}/{totalPermissions}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8"
                    onClick={() => onManageRole(roleName)}
                  >
                    <Settings className="h-3.5 w-3.5 mr-1.5" />
                    Gestionar
                  </Button>

                  {canManageRoles && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => onCloneRole(roleName)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Duplicar rol</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}

                  {canManageRoles && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => onDeleteRole(roleName)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Eliminar rol</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
