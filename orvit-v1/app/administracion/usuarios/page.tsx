'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  UserPlus,
  Search,
  Edit,
  Trash2,
  Shield,
  Mail,
  Phone,
  Calendar,
  Filter,
  Download,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Activity,
  BarChart3,
  UserCheck,
  UserX,
  Settings,
  X,
  Eye,
  Clock,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import UserEditDialog from '@/components/users/UserEditDialog';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useGlobalCache, createCacheKey } from '@/hooks/use-global-cache';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  roleDisplay?: string;
  companyRole?: string;
  globalRole?: string;
  phone?: string;
  avatar?: string;
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
  companies?: any[];
  stats?: {
    assignedTasks: number;
    createdTasks: number;
    assignedWorkOrders: number;
    createdWorkOrders: number;
  };
}

interface UserActivity {
  user: any;
  stats: any;
  recentActivity: any;
}

export default function UsuariosPage() {
  const { user: currentUser } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  // Verificar permisos para acceder a esta página
  const { hasPermission: canManageUsers, isLoading: loadingPerms } = usePermissionRobust('gestionar_usuarios');
  
  // Estados principales - TODOS LOS HOOKS DEBEN IR ANTES DE CUALQUIER RETURN
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  
  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  
  // Estados de diálogos
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [bulkActionDialog, setBulkActionDialog] = useState<{
    open: boolean;
    action: string;
    newRole?: string;
  }>({ open: false, action: '' });
  
  // Estados de estadísticas
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Definir funciones antes de los useEffect
  const filterUsers = () => {
    let filtered = users;

    // Filtro de búsqueda
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro de rol
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => {
        const userRole = user.role?.toLowerCase();
        const userRoleDisplay = user.roleDisplay?.toLowerCase();
        const filterRole = roleFilter.toLowerCase();
        
        // Mapear nombres de filtro a códigos de rol
        const roleMapping: Record<string, string> = {
          'user': 'user',
          'supervisor': 'supervisor', 
          'admin': 'admin',
          'superadmin': 'superadmin',
          'administrador': 'admin',
          'usuario': 'user'
        };
        
        const mappedFilterRole = roleMapping[filterRole] || filterRole;
        
        return userRole === mappedFilterRole || 
               userRoleDisplay === filterRole ||
               userRoleDisplay?.includes(filterRole);
      });
    }

    // Filtro de estado
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        filtered = filtered.filter(user => user.isActive);
      } else if (statusFilter === 'inactive') {
        filtered = filtered.filter(user => !user.isActive);
      }
    }

    // Filtro de fecha
    if (dateFilter !== 'all') {
      const now = new Date();
      const days = parseInt(dateFilter);
      const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      
      filtered = filtered.filter(user => {
        const userDate = new Date(user.createdAt);
        return userDate >= cutoffDate;
      });
    }

    setFilteredUsers(filtered);
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : data.users || []);
      } else {
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los usuarios',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserActivities = async () => {
    try {
      setActivityLoading(true);
      const response = await fetch('/api/users/activity?period=30');
      if (response.ok) {
        const data = await response.json();
        setUserActivities(data.users || []);
      }
    } catch (error) {
    } finally {
      setActivityLoading(false);
    }
  };

  // TODOS LOS USEEFFECT DEBEN IR DESPUÉS DE LAS FUNCIONES
  useEffect(() => {
    if (canManageUsers && currentUser && currentCompany) {
    fetchUsers();
    fetchUserActivities();
    }
  }, [canManageUsers, currentUser, currentCompany]);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, roleFilter, statusFilter, dateFilter]);

  // Esperar a que el usuario y la empresa estén listos - DESPUÉS DE TODOS LOS HOOKS
  if (!currentUser || !currentCompany) {
    return (
      <div className="w-full p-0">
        <div className="px-4 md:px-6 pt-4 pb-3">
          <h1 className="text-xl font-semibold text-foreground">Gestión de Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">Cargando usuario y empresa...</p>
        </div>
      </div>
    );
  }


  const handleSelectUser = (userId: number, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(filteredUsers.map(user => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleBulkAction = async (action: string, newRole?: string) => {
    if (selectedUsers.length === 0) {
      toast({
        title: 'Sin selección',
        description: 'Selecciona al menos un usuario',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userIds: selectedUsers,
          ...(newRole && { newRole })
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Operación completada',
          description: result.message,
        });
        setSelectedUsers([]);
        fetchUsers();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Error en la operación masiva',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error de conexión',
        variant: 'destructive',
      });
    }

    setBulkActionDialog({ open: false, action: '' });
  };

  const exportUsers = () => {
    const csvContent = [
      ['Nombre', 'Email', 'Rol', 'Teléfono', 'Estado', 'Último Acceso', 'Fecha Creación'],
      ...filteredUsers.map(user => [
        user.name,
        user.email,
        user.roleDisplay || getRoleLabel(user.role),
        user.phone || '',
        user.isActive ? 'Activo' : 'Inactivo',
        user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Nunca',
        new Date(user.createdAt).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `usuarios_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getRoleBadge = (role: string): "default" | "destructive" | "secondary" | "outline" => {
    const variants = {
      'SUPERADMIN': 'destructive' as const,
      'ADMIN': 'default' as const,
      'SUPERVISOR': 'secondary' as const,
      'USER': 'outline' as const,
    };
    return variants[role as keyof typeof variants] || 'outline';
  };

  const getRoleLabel = (role: string) => {
    const labels = {
      'SUPERADMIN': 'Super Admin',
      'ADMIN': 'Administrador',
      'SUPERVISOR': 'Supervisor',
      'USER': 'Usuario',
    };
    return labels[role as keyof typeof labels] || role;
  };

  const getActivityStats = () => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.isActive).length;
    const inactiveUsers = totalUsers - activeUsers;

    // Contar admins: verificar role, roleDisplay y companyRole
    const adminKeywords = ['admin', 'superadmin', 'administrador'];
    const adminUsers = users.filter(u => {
      const role = (u.role || '').toLowerCase();
      const roleDisplay = (u.roleDisplay || '').toLowerCase();
      const companyRole = (u.companyRole || '').toLowerCase();

      return adminKeywords.some(keyword =>
        role.includes(keyword) ||
        roleDisplay.includes(keyword) ||
        companyRole.includes(keyword)
      );
    }).length;
    const recentlyActive = users.filter(u => {
      if (!u.lastLogin) return false;
      const lastLogin = new Date(u.lastLogin);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return lastLogin >= sevenDaysAgo;
    }).length;
    
    const thisMonth = users.filter(u => {
      const created = new Date(u.createdAt);
      const now = new Date();
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length;

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      adminUsers,
      recentlyActive,
      thisMonth
    };
  };

  const stats = getActivityStats();

  // Helper para tiempo relativo
  const getRelativeTime = (dateString: string | undefined | null) => {
    if (!dateString) return 'Nunca';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return 'Ahora mismo';
    if (diffMinutes < 60) return `Hace ${diffMinutes}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem`;
    if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`;
    return `Hace ${Math.floor(diffDays / 365)} años`;
  };

  // Helper para verificar si es usuario nuevo (menos de 30 días)
  const isNewUser = (createdAt: string) => {
    const created = new Date(createdAt);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return created >= thirtyDaysAgo;
  };

  // Helper para limpiar filtros
  const clearFilters = () => {
    setSearchTerm('');
    setRoleFilter('all');
    setStatusFilter('all');
    setDateFilter('all');
  };

  const hasActiveFilters = searchTerm !== '' || roleFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all';

  // Helper para color de avatar basado en rol
  const getAvatarColor = (role: string) => {
    const colors: Record<string, string> = {
      'SUPERADMIN': 'bg-red-500/10 text-red-600',
      'ADMIN': 'bg-blue-500/10 text-blue-600',
      'SUPERVISOR': 'bg-purple-500/10 text-purple-600',
      'USER': 'bg-slate-500/10 text-slate-600',
    };
    return colors[role?.toUpperCase()] || 'bg-primary/10 text-primary';
  };

  const canEdit = (targetUserId: number) => {
    // Solo necesita users.manage para todo
    return canManageUsers;
  };

  const canDelete = (targetUserId: number) => {
    // Solo necesita users.manage para todo
    return canManageUsers;
  };

  const canManageBulk = () => {
    // Solo necesita users.manage para todo
    return canManageUsers;
  };

  // Mostrar loading mientras se verifican los permisos
  if (loadingPerms) {
    return (
      <div className="w-full p-0">
        <div className="px-4 md:px-6 pt-4 pb-3">
          <h1 className="text-xl font-semibold text-foreground">Gestión de Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // Si no tiene permisos, mostrar mensaje
  if (!canManageUsers) {
    return (
      <div className="w-full p-0">
        <div className="px-4 md:px-6 pt-4 pb-3">
          <h1 className="text-xl font-semibold text-foreground">Gestión de Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">Administra usuarios, roles y permisos del sistema</p>
        </div>
        <div className="px-4 md:px-6 py-12">
          <div className="text-center">
            <div className="text-destructive mb-2 font-semibold">Sin permisos</div>
            <p className="text-sm text-muted-foreground">No tienes permisos para acceder a la gestión de usuarios.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full p-0">
        <div className="px-4 md:px-6 pt-4 pb-3">
          <h1 className="text-xl font-semibold text-foreground">Gestión de Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard permission="ingresar_usuarios" showUnauthorized={true}>
      <div className="w-full p-0">
        <Tabs defaultValue="users" className="space-y-0">
          {/* Header con tabs */}
          <div className="px-4 md:px-6 pt-4 pb-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h1 className="text-xl font-semibold text-foreground">Gestión de Usuarios</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Administra usuarios, roles y permisos del sistema
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportUsers}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
                {canManageUsers && (
                  <Button size="sm" onClick={() => {
                    setSelectedUserId(null);
                    setIsEditDialogOpen(true);
                  }}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Nuevo Usuario
                  </Button>
                )}
              </div>
            </div>
            <TabsList className="w-full sm:w-fit bg-muted/40 border border-border rounded-md p-1 h-9">
              <TabsTrigger value="users" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Usuarios
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="users" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          {/* Stats compactas */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-md border">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total:</span>
              <span className="text-sm font-semibold">{stats.totalUsers}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-md border">
              <UserCheck className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Activos:</span>
              <span className="text-sm font-semibold text-green-600">{stats.activeUsers}</span>
            </div>
            {stats.inactiveUsers > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-md border">
                <UserX className="h-4 w-4 text-red-600" />
                <span className="text-sm text-muted-foreground">Inactivos:</span>
                <span className="text-sm font-semibold text-red-600">{stats.inactiveUsers}</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-md border">
              <Shield className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-muted-foreground">Admins:</span>
              <span className="text-sm font-semibold text-blue-600">{stats.adminUsers}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-md border">
              <Activity className="h-4 w-4 text-purple-600" />
              <span className="text-sm text-muted-foreground">Activos (7d):</span>
              <span className="text-sm font-semibold text-purple-600">{stats.recentlyActive}</span>
            </div>
            {stats.thisMonth > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-md border border-primary/20">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Nuevos:</span>
                <span className="text-sm font-semibold text-primary">{stats.thisMonth}</span>
              </div>
            )}
          </div>

          {/* Filtros inline */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 bg-background"
              />
            </div>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-40 h-9 bg-background">
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="user">Usuario</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="superadmin">Super Admin</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36 h-9 bg-background">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-40 h-9 bg-background">
                <SelectValue placeholder="Actividad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Cualquier fecha</SelectItem>
                <SelectItem value="7">Últimos 7 días</SelectItem>
                <SelectItem value="30">Últimos 30 días</SelectItem>
                <SelectItem value="90">Últimos 90 días</SelectItem>
                <SelectItem value="never_logged">Nunca conectado</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}

            {/* Contador */}
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground px-2">
              <span className="font-medium text-foreground">{filteredUsers.length}</span>
              <span>de {users.length}</span>
            </div>
          </div>

          {/* Barra de acciones para usuarios seleccionados */}
          {selectedUsers.length > 0 && (
            <Card className="border-primary/20 bg-background">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{selectedUsers.length} usuarios seleccionados</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBulkActionDialog({ open: true, action: 'activate' })}
                    >
                      <UserCheck className="h-4 w-4 mr-2" />
                      Activar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBulkActionDialog({ open: true, action: 'deactivate' })}
                    >
                      <UserX className="h-4 w-4 mr-2" />
                      Desactivar
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Settings className="h-4 w-4 mr-2" />
                          Cambiar Rol
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setBulkActionDialog({ open: true, action: 'change_role', newRole: 'USER' })}>
                          Usuario
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setBulkActionDialog({ open: true, action: 'change_role', newRole: 'SUPERVISOR' })}>
                          Supervisor
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setBulkActionDialog({ open: true, action: 'change_role', newRole: 'ADMIN' })}>
                          Administrador
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setBulkActionDialog({ open: true, action: 'delete' })}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabla de usuarios */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Usuarios</CardTitle>
                {filteredUsers.length !== users.length && (
                  <Badge variant="secondary" className="text-xs">
                    {filteredUsers.length} de {users.length} mostrados
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12 pl-4">
                      <Checkbox
                        checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead className="hidden sm:table-cell">Estado</TableHead>
                    <TableHead className="hidden lg:table-cell">Último Acceso</TableHead>
                    <TableHead className="w-12 text-right pr-4">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors group"
                      onClick={() => {
                        setSelectedUserId(user.id);
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={(checked) => handleSelectUser(user.id, !!checked)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${getAvatarColor(user.role)}`}>
                            <span className="text-sm font-semibold">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{user.name}</span>
                              {isNewUser(user.createdAt) && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-primary/5 text-primary border-primary/20 shrink-0">
                                  Nuevo
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate md:hidden">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">{user.email}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadge(user.role)} className="text-xs">
                          {user.roleDisplay || getRoleLabel(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {user.isActive ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-xs text-muted-foreground">Activo</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-xs text-muted-foreground">Inactivo</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className={`text-xs ${user.lastLogin ? 'text-muted-foreground' : 'text-amber-600'}`}>
                            {getRelativeTime(user.lastLogin)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="pr-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {canEdit(user.id) && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedUserId(user.id);
                                  setIsEditDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Editar usuario
                              </DropdownMenuItem>
                            )}
                            {canEdit(user.id) && canManageUsers && <DropdownMenuSeparator />}
                            {canManageUsers && (
                              <>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedUsers([user.id]);
                                    setBulkActionDialog({
                                      open: true,
                                      action: user.isActive ? 'deactivate' : 'activate'
                                    });
                                  }}
                                >
                                  {user.isActive ? (
                                    <>
                                      <UserX className="h-4 w-4 mr-2" />
                                      Desactivar
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="h-4 w-4 mr-2" />
                                      Activar
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {canDelete(user.id) && (
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedUsers([user.id]);
                                  setBulkActionDialog({ open: true, action: 'delete' });
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12">
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="w-14 h-14 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mb-4">
                            <Users className="h-6 w-6 text-muted-foreground/50" />
                          </div>
                          {hasActiveFilters ? (
                            <>
                              <h3 className="text-sm font-medium mb-1">Sin resultados</h3>
                              <p className="text-xs text-muted-foreground mb-3">
                                No hay usuarios que coincidan con los filtros
                              </p>
                              <Button variant="outline" size="sm" onClick={clearFilters}>
                                <X className="h-3 w-3 mr-1.5" />
                                Limpiar filtros
                              </Button>
                            </>
                          ) : (
                            <>
                              <h3 className="text-sm font-medium mb-1">Sin usuarios</h3>
                              <p className="text-xs text-muted-foreground mb-3">
                                No hay usuarios registrados en el sistema
                              </p>
                              {canManageUsers && (
                                <Button size="sm" onClick={() => {
                                  setSelectedUserId(null);
                                  setIsEditDialogOpen(true);
                                }}>
                                  <UserPlus className="h-3 w-3 mr-1.5" />
                                  Crear usuario
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Diálogos */}
      <UserEditDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setSelectedUserId(null);
        }}
        userId={selectedUserId || undefined}
        onUserUpdated={fetchUsers}
      />

      {/* Diálogo de confirmación para acciones masivas */}
      <AlertDialog open={bulkActionDialog.open} onOpenChange={(open) => setBulkActionDialog({ ...bulkActionDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Acción Masiva</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkActionDialog.action === 'delete' && 
                `¿Estás seguro de eliminar ${selectedUsers.length} usuario(s)? Esta acción no se puede deshacer.`
              }
              {bulkActionDialog.action === 'activate' && 
                `¿Estás seguro de activar ${selectedUsers.length} usuario(s)?`
              }
              {bulkActionDialog.action === 'deactivate' && 
                `¿Estás seguro de desactivar ${selectedUsers.length} usuario(s)?`
              }
              {bulkActionDialog.action === 'change_role' && 
                `¿Estás seguro de cambiar el rol de ${selectedUsers.length} usuario(s) a ${bulkActionDialog.newRole}?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleBulkAction(bulkActionDialog.action, bulkActionDialog.newRole)}
              className={bulkActionDialog.action === 'delete' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PermissionGuard>
  );
} 