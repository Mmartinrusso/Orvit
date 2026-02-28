'use client';

import { useState, useCallback } from 'react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { usePermissionsData, type UserData } from '@/hooks/use-permissions-data';
import { useAuth } from '@/contexts/AuthContext';

// Tab components
import PermissionsTab from '@/components/admin/permissions/PermissionsTab';
import RolesTab from '@/components/admin/permissions/RolesTab';
import UsersTab from '@/components/admin/permissions/UsersTab';

// Sheet components
import RoleDetailSheet from '@/components/admin/permissions/RoleDetailSheet';
import UserPermissionsSheet from '@/components/admin/permissions/UserPermissionsSheet';

// Dialog components
import CreateRoleDialog from '@/components/admin/permissions/CreateRoleDialog';
import CloneRoleDialog from '@/components/admin/permissions/CloneRoleDialog';
import DeleteRoleDialog from '@/components/admin/permissions/DeleteRoleDialog';

export default function PermisosPage() {
  const { hasPermission } = useAuth();
  const data = usePermissionsData();
  const [activeTab, setActiveTab] = useState('permissions');
  const [permissionLang, setPermissionLang] = useState<'es' | 'en'>('es');

  // Permisos granulares
  const canManagePermissions = hasPermission('admin.permissions');
  const canManageRoles = hasPermission('admin.roles');

  // Sheet states
  const [isRoleDetailOpen, setIsRoleDetailOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [isUserPermissionsOpen, setIsUserPermissionsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  // Dialog states
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [isCloneRoleOpen, setIsCloneRoleOpen] = useState(false);
  const [roleToClone, setRoleToClone] = useState<string | null>(null);
  const [isDeleteRoleOpen, setIsDeleteRoleOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);

  // Handlers
  const handleManageRole = useCallback((roleName: string) => {
    setSelectedRole(roleName);
    setIsRoleDetailOpen(true);
  }, []);

  const handleCloneRole = useCallback((roleName: string) => {
    setRoleToClone(roleName);
    setIsCloneRoleOpen(true);
  }, []);

  const handleDeleteRole = useCallback((roleName: string) => {
    setRoleToDelete(roleName);
    setIsDeleteRoleOpen(true);
  }, []);

  const handleManageUser = useCallback(async (userData: UserData) => {
    const updatedUser = await data.loadUserSpecificPermissions(userData);
    setSelectedUser(updatedUser);
    setIsUserPermissionsOpen(true);
  }, [data.loadUserSpecificPermissions]);

  const handleConfirmDelete = useCallback(async () => {
    if (!roleToDelete) return;
    const success = await data.deleteRole(roleToDelete);
    if (success) {
      setIsDeleteRoleOpen(false);
      setRoleToDelete(null);
    }
  }, [roleToDelete, data.deleteRole]);

  const handleConfirmClone = useCallback(async (newName: string, newDisplayName: string, newDescription: string) => {
    if (!roleToClone) return;
    const success = await data.cloneRole(roleToClone, newName, newDisplayName, newDescription);
    if (success) {
      setIsCloneRoleOpen(false);
      setRoleToClone(null);
    }
  }, [roleToClone, data.cloneRole]);

  const handleConfirmCreate = useCallback(async (roleData: { name: string; displayName: string; description: string; sectorId: number | null }) => {
    const success = await data.createRole(roleData);
    if (success) {
      setIsCreateRoleOpen(false);
    }
  }, [data.createRole]);

  const handleRefreshUser = useCallback(async (userData: UserData) => {
    const updated = await data.loadUserSpecificPermissions(userData);
    setSelectedUser(updated);
    return updated;
  }, [data.loadUserSpecificPermissions]);

  // Determine available tabs
  const { canViewPermisos, canViewRoles } = data;

  if (data.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <PermissionGuard permission="admin.permissions">
      <div className="w-full p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0">
          {/* Header */}
          <div className="px-4 md:px-6 pt-4 pb-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h1 className="text-xl font-semibold text-foreground">Gestión de Permisos y Roles</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Administra permisos, roles y usuarios del sistema
                </p>
              </div>
            </div>
            <TabsList className="w-full sm:w-fit bg-muted/40 border border-border rounded-md p-1 h-9 overflow-x-auto">
              {canViewPermisos && (
                <TabsTrigger value="permissions" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Permisos
                </TabsTrigger>
              )}
              {canViewRoles && (
                <TabsTrigger value="roles" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Roles
                </TabsTrigger>
              )}
              <TabsTrigger value="users" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Usuarios
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab content */}
          {canViewPermisos && (
            <TabsContent value="permissions" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
              <PermissionsTab
                permissions={data.permissions}
                categories={data.categories}
                rolePermissions={data.rolePermissions}
                lang={permissionLang}
                onLangChange={setPermissionLang}
                loading={data.loading}
              />
            </TabsContent>
          )}

          {canViewRoles && (
            <TabsContent value="roles" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
              <RolesTab
                rolePermissions={data.rolePermissions}
                totalPermissions={data.permissions.length}
                onManageRole={handleManageRole}
                onCloneRole={handleCloneRole}
                onDeleteRole={handleDeleteRole}
                onCreateRole={() => setIsCreateRoleOpen(true)}
              />
            </TabsContent>
          )}

          <TabsContent value="users" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
            <UsersTab
              users={data.users}
              usersLoading={data.usersLoading}
              userSearch={data.userSearch}
              onUserSearchChange={data.setUserSearch}
              userRoleFilter={data.userRoleFilter}
              onUserRoleFilterChange={data.setUserRoleFilter}
              onManageUser={handleManageUser}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Sheets */}
      <RoleDetailSheet
        open={isRoleDetailOpen}
        onOpenChange={setIsRoleDetailOpen}
        roleName={selectedRole}
        roleData={selectedRole ? data.rolePermissions[selectedRole] || null : null}
        allPermissions={data.permissions}
        lang={permissionLang}
        onLangChange={setPermissionLang}
        onTogglePermission={data.toggleRolePermission}
        onApplyBatch={data.applyBatchPermissions}
      />

      <UserPermissionsSheet
        open={isUserPermissionsOpen}
        onOpenChange={setIsUserPermissionsOpen}
        user={selectedUser}
        roleData={selectedUser ? data.rolePermissions[selectedUser.role] || null : null}
        allPermissions={data.permissions}
        lang={permissionLang}
        onTogglePermission={data.toggleUserPermission}
        onRefreshUser={handleRefreshUser}
        onRefreshUsers={() => data.fetchUsers()}
      />

      {/* Dialogs */}
      <CreateRoleDialog
        open={isCreateRoleOpen}
        onOpenChange={setIsCreateRoleOpen}
        isCreating={data.isCreating}
        sectors={data.sectors}
        loadingSectors={data.loadingSectors}
        onFetchSectors={data.fetchSectors}
        onCreate={handleConfirmCreate}
      />

      <CloneRoleDialog
        open={isCloneRoleOpen}
        onOpenChange={(open) => {
          setIsCloneRoleOpen(open);
          if (!open) setRoleToClone(null);
        }}
        sourceRoleName={roleToClone}
        sourceRoleData={roleToClone ? data.rolePermissions[roleToClone] || null : null}
        isCloning={data.isCreating}
        onClone={handleConfirmClone}
      />

      <DeleteRoleDialog
        open={isDeleteRoleOpen}
        onOpenChange={(open) => {
          setIsDeleteRoleOpen(open);
          if (!open) setRoleToDelete(null);
        }}
        roleName={roleToDelete}
        isDeleting={data.isDeletingRole}
        onConfirm={handleConfirmDelete}
      />
    </PermissionGuard>
  );
}
