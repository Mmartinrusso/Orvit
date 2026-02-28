'use client';

import { useMemo, useCallback } from 'react';
import { StandardSheet } from '@/components/ui/standard-sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PermissionList from './PermissionList';
import type { PermissionData, RoleData, UserData } from '@/hooks/use-permissions-data';

interface UserPermissionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserData | null;
  roleData: RoleData | null;
  allPermissions: PermissionData[];
  lang: 'es' | 'en';
  onTogglePermission: (userId: number, permissionId: number, isGranted: boolean) => Promise<boolean>;
  onRefreshUser: (user: UserData) => Promise<UserData>;
  onRefreshUsers: () => void;
}

export default function UserPermissionsSheet({
  open,
  onOpenChange,
  user,
  roleData,
  allPermissions,
  lang,
  onTogglePermission,
  onRefreshUser,
  onRefreshUsers,
}: UserPermissionsSheetProps) {
  // All granted permissions (role + custom)
  const grantedPermissions = useMemo(() => {
    const set = new Set<string>();
    if (roleData) {
      roleData.permissions.forEach(p => set.add(p.name));
    }
    if (user?.userSpecificPermissions) {
      user.userSpecificPermissions.forEach((up: any) => {
        if (up.isGranted) {
          // Find permission name by ID
          const perm = allPermissions.find(p => p.id === up.permissionId);
          if (perm) set.add(perm.name);
        }
      });
    }
    return set;
  }, [roleData, user?.userSpecificPermissions, allPermissions]);

  // Permissions that are read-only (from role)
  const readOnlyPermissions = useMemo(() => {
    if (!roleData) return new Set<string>();
    return new Set(roleData.permissions.map(p => p.name));
  }, [roleData]);

  // Source labels for each permission
  const sourceLabels = useMemo(() => {
    const labels: Record<string, 'role' | 'custom'> = {};
    if (roleData) {
      roleData.permissions.forEach(p => { labels[p.name] = 'role'; });
    }
    if (user?.userSpecificPermissions) {
      user.userSpecificPermissions.forEach((up: any) => {
        if (up.isGranted) {
          const perm = allPermissions.find(p => p.id === up.permissionId);
          if (perm) labels[perm.name] = 'custom';
        }
      });
    }
    return labels;
  }, [roleData, user?.userSpecificPermissions, allPermissions]);

  const handleToggle = useCallback(async (permissionId: number, _permissionName: string, isGranted: boolean) => {
    if (!user) return;
    const success = await onTogglePermission(user.id, permissionId, isGranted);
    if (success) {
      await onRefreshUser(user);
      onRefreshUsers();
    }
  }, [user, onTogglePermission, onRefreshUser, onRefreshUsers]);

  if (!user) return null;

  const rolePermsCount = roleData?.permissions?.length || 0;
  const customPermsCount = user.userSpecificPermissions?.filter((up: any) => up.isGranted)?.length || 0;

  return (
    <StandardSheet
      open={open}
      onOpenChange={onOpenChange}
      title={user.name}
      description={user.email}
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <p className="text-xs text-muted-foreground">
            Los permisos personalizados sobrescriben los del rol
          </p>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Stats header */}
        <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg border">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-semibold text-primary">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 text-xs">
              <Badge variant="outline" className="text-xs">{user.role}</Badge>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                <span className="text-muted-foreground">Del rol:</span>
                <span className="font-medium">{rolePermsCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Personalizados:</span>
                <span className="font-medium">{customPermsCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Permission list */}
        <PermissionList
          permissions={allPermissions}
          grantedPermissions={grantedPermissions}
          onToggle={handleToggle}
          readOnlyPermissions={readOnlyPermissions}
          lang={lang}
          showCheckboxes={true}
          sourceLabels={sourceLabels}
          filterModes={['all', 'granted', 'not_granted']}
          emptyMessage="No hay permisos que coincidan con los filtros"
        />
      </div>
    </StandardSheet>
  );
}
