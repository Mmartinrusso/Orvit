'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, X, Settings, Users } from 'lucide-react';
import type { UserData } from '@/hooks/use-permissions-data';

interface UsersTabProps {
  users: UserData[];
  usersLoading: boolean;
  userSearch: string;
  onUserSearchChange: (search: string) => void;
  userRoleFilter: string;
  onUserRoleFilterChange: (filter: string) => void;
  onManageUser: (user: UserData) => void;
}

export default function UsersTab({
  users,
  usersLoading,
  userSearch,
  onUserSearchChange,
  userRoleFilter,
  onUserRoleFilterChange,
  onManageUser,
}: UsersTabProps) {
  const filteredUsers = users.filter(u => u.role !== 'SUPERADMIN');
  const withCustom = filteredUsers.filter(u => (u.userSpecificPermissionsCount || 0) > 0).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Permisos por Usuario</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredUsers.length} usuarios &bull; {withCustom} con permisos personalizados
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuarios..."
            value={userSearch}
            onChange={(e) => onUserSearchChange(e.target.value)}
            className="pl-9 h-9 bg-background"
          />
        </div>

        <Select value={userRoleFilter} onValueChange={onUserRoleFilterChange}>
          <SelectTrigger className="w-full sm:w-44 h-9 bg-background">
            <SelectValue placeholder="Filtrar por rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="ADMIN">Administrador</SelectItem>
            <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
            <SelectItem value="USER">Usuario</SelectItem>
          </SelectContent>
        </Select>

        {(userSearch || userRoleFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { onUserSearchChange(''); onUserRoleFilterChange('all'); }}
            className="h-9 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Limpiar
          </Button>
        )}

        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground px-2">
          <span className="font-medium text-foreground">{filteredUsers.length}</span>
          <span>usuarios</span>
        </div>
      </div>

      {/* Table */}
      {usersLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
          <span className="text-muted-foreground">Cargando usuarios...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Sin usuarios</h3>
          <p className="text-muted-foreground">No se encontraron usuarios con los filtros aplicados</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[300px]">Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-center">Permisos del Rol</TableHead>
                <TableHead className="text-center">Personalizados</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((userData) => (
                <TableRow key={userData.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-medium text-primary">
                          {userData.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{userData.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{userData.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{userData.role}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm font-medium">{userData.rolePermissionCount || 0}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    {(userData.userSpecificPermissionsCount || 0) > 0 ? (
                      <Badge className="text-xs bg-primary/10 text-primary hover:bg-primary/20">
                        {userData.userSpecificPermissionsCount}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => onManageUser(userData)}
                    >
                      <Settings className="h-3.5 w-3.5 mr-1.5" />
                      Gestionar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
