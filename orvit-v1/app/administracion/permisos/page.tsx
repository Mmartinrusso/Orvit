'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { useGlobalCache, createCacheKey } from '@/hooks/use-global-cache';
import {
  Plus,
  Search,
  Settings,
  Shield,
  Users,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Copy,
  X
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface Permission {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RolePermissionData {
  [role: string]: {
    name: string;
    displayName: string;
    description: string;
    isSystem: boolean;
    userCount: number;
    permissions: Permission[];
  };
}

interface UserData {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  companies?: any[];
  userSpecificPermissions?: any[];
  rolePermissionCount?: number;
  userSpecificPermissionsCount?: number;
}

export default function PermisosPage() {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const cache = useGlobalCache();
  const loadingRef = useRef({ permissions: false, roles: false, users: false, sectors: false });

  // ✨ OPTIMIZACIÓN: Usar permisos de AuthContext (en memoria, sin fetches)
  const { hasPermission, hasAnyPermission, user } = useAuth();
  
  // ✨ OPTIMIZACIÓN: Verificar si es Administrador (rol de empresa o sistema) - memoizado
  // Reconoce múltiples variantes del rol Administrador para máxima compatibilidad
  const isAdminRole = useMemo(() => {
    if (!user?.role) return false;
    const normalizedRole = user.role.trim().toUpperCase();
    const adminVariants = [
      'SUPERADMIN',
      'ADMIN', 
      'ADMIN_ENTERPRISE',
      'ADMINISTRADOR', // Rol de empresa (exacto)
      'ADMINISTRATOR', // Variante en inglés
      'ADMIN.', // Con punto
      'ADMIN ' // Con espacio
    ];
    return adminVariants.includes(normalizedRole) || 
           normalizedRole.startsWith('ADMIN'); // Cualquier variante que empiece con ADMIN
  }, [user?.role]);
  
  // ✨ OPTIMIZACIÓN: Verificar permisos directamente desde memoria (0 requests adicionales)
  // Si es Administrador, tiene acceso automático a TODO (sin verificar permisos específicos)
  const canViewPermisos = useMemo(() => {
    if (isAdminRole) return true; // Administradores siempre pueden ver permisos
    return hasPermission('admin.permissions');
  }, [isAdminRole, hasPermission]);
  
  const canViewRoles = useMemo(() => {
    if (isAdminRole) return true; // Administradores siempre pueden ver roles
    return hasPermission('admin.roles');
  }, [isAdminRole, hasPermission]);
  
  const canAccessPermisosRoles = useMemo(() => {
    if (isAdminRole) return true; // Administradores siempre pueden acceder
    return hasPermission('ingresar_permisos_roles');
  }, [isAdminRole, hasPermission]);

  // Estado principal
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionData>({});
  const [loading, setLoading] = useState(true);
  
  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('permissions');
  
  // Estados de diálogo
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreateRoleDialogOpen, setIsCreateRoleDialogOpen] = useState(false);
  const [newPermission, setNewPermission] = useState({
    name: '',
    description: '',
    category: ''
  });
  const [newRole, setNewRole] = useState({
    name: '',
    displayName: '',
    description: '',
    sectorId: null as number | null
  });
  const [sectors, setSectors] = useState<any[]>([]);
  const [loadingSectors, setLoadingSectors] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Estados para gestión de roles
  const [isRoleDetailOpen, setIsRoleDetailOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = useState(false);

  // Estados para clonar rol
  const [isCloneRoleDialogOpen, setIsCloneRoleDialogOpen] = useState(false);
  const [roleToClone, setRoleToClone] = useState<string | null>(null);
  const [cloneRoleData, setCloneRoleData] = useState({
    name: '',
    displayName: '',
    description: ''
  });
  
  // Estados para gestión de usuarios
  const [users, setUsers] = useState<UserData[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isUserPermissionsOpen, setIsUserPermissionsOpen] = useState(false);
  const [userPermissionsData, setUserPermissionsData] = useState<any>(null);
  const [loadingUserPermissions, setLoadingUserPermissions] = useState(false);
  
  // Estados para eliminar roles
  const [isDeleteRoleDialogOpen, setIsDeleteRoleDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  const [isDeletingRole, setIsDeletingRole] = useState(false);

  // Estados para el modal de permisos de usuario mejorado
  const [userPermissionSearch, setUserPermissionSearch] = useState('');
  const [userPermissionFilter, setUserPermissionFilter] = useState<'all' | 'role' | 'custom'>('all');
  const [collapsedUserCategories, setCollapsedUserCategories] = useState<Set<string>>(new Set());

  // Estados para el modal de permisos de rol mejorado
  const [rolePermissionSearch, setRolePermissionSearch] = useState('');
  const [rolePermissionFilter, setRolePermissionFilter] = useState<'all' | 'granted' | 'not_granted'>('all');
  const [collapsedRoleCategories, setCollapsedRoleCategories] = useState<Set<string>>(new Set());

  // ✨ OPTIMIZACIÓN: Determinar tabs basado en permisos en memoria
  const availableTabs: string[] = [];
  if (canViewPermisos) {
    availableTabs.push('permissions');
  }
  if (canViewRoles) {
    availableTabs.push('roles');
  }
  availableTabs.push('users');

  // Determinar el tab inicial
  const getInitialTab = () => {
    if (availableTabs.includes('permissions')) return 'permissions';
    if (availableTabs.includes('roles')) return 'roles';
    return 'users';
  };

  useEffect(() => {
    if (!user) return;
    
    // ✨ OPTIMIZACIÓN: Verificar acceso usando permisos en memoria (0 requests)
    // Si es Administrador o tiene alguno de los permisos, tiene acceso
    const hasAccess = isAdminRole || canAccessPermisosRoles || canViewPermisos || canViewRoles;
    
    if (!hasAccess) {
      toast({
        title: 'Acceso denegado',
        description: 'No tienes permisos para acceder a esta sección. Contacta a tu administrador.',
        variant: 'destructive',
      });
      return;
    }

    // Establecer tab inicial
    setActiveTab(getInitialTab());

    // Cargar datos en paralelo
    Promise.all([
      fetchPermissions(),
      fetchRolePermissions(),
      fetchUsers()
    ]);
  }, [user, isAdminRole, canViewPermisos, canViewRoles, canAccessPermisosRoles, toast]);

  // Debounce para búsqueda de usuarios
  useEffect(() => {
    if (!user) return;
    
    const timeoutId = setTimeout(() => {
      fetchUsers();
    }, 300); // Esperar 300ms después del último cambio

    return () => clearTimeout(timeoutId);
  }, [userSearch, userRoleFilter, user]);

  // Cargar sectores cuando se detecta "supervisor" en el nombre del rol
  useEffect(() => {
    const isSupervisor = newRole.name.toLowerCase() === 'supervisor' || newRole.displayName.toLowerCase() === 'supervisor';
    if (isSupervisor && isCreateRoleDialogOpen && currentCompany?.id && sectors.length === 0 && !loadingSectors) {
      fetchSectors();
    }
  }, [newRole.name, newRole.displayName, isCreateRoleDialogOpen, currentCompany?.id, sectors.length, loadingSectors]);

  const fetchPermissions = useCallback(async () => {
    if (loadingRef.current.permissions) return;
    
    const cacheKey = createCacheKey('permissions');
    const cached = cache.get<{permissions: Permission[], categories: string[]}>(cacheKey);
    if (cached) {
      setPermissions(cached.permissions);
      setCategories(cached.categories);
      return;
    }

    loadingRef.current.permissions = true;
    try {
      setLoading(true);
      const response = await fetch('/api/admin/permissions');
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          const permissionsData = data.permissions || [];
          setPermissions(permissionsData);
          
          // Si no hay categorías en la respuesta, extraerlas de los permisos
          const receivedCategories = (data.categories || []) as string[];
          let categoriesData: string[] = receivedCategories;
          if (receivedCategories.length === 0 && permissionsData.length > 0) {
            const uniqueCategories: string[] = [];
            permissionsData.forEach((p: Permission) => {
              if (p.category && p.category.trim() !== '' && !uniqueCategories.includes(p.category)) {
                uniqueCategories.push(p.category);
              }
            });
            categoriesData = uniqueCategories;
          }
          setCategories(categoriesData);
          
          // Guardar en caché
          cache.set(cacheKey, { permissions: permissionsData, categories: categoriesData });
        }
      } else {
        throw new Error('Error cargando permisos');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los permisos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      loadingRef.current.permissions = false;
    }
  }, [cache, toast]);

  const fetchSectors = useCallback(async () => {
    if (!currentCompany?.id || loadingRef.current.sectors) return;
    
    const cacheKey = createCacheKey('sectors', currentCompany.id.toString());
    const cached = cache.get<any[]>(cacheKey);
    if (cached) {
      setSectors(cached);
      return;
    }

    loadingRef.current.sectors = true;
    try {
      setLoadingSectors(true);
      const response = await fetch(`/api/sectores?companyId=${currentCompany.id}`);
      if (response.ok) {
        const data = await response.json();
        const sectorsData = Array.isArray(data) ? data : [];
        setSectors(sectorsData);
        cache.set(cacheKey, sectorsData);
      }
    } catch (error) {
      // Error silencioso
    } finally {
      setLoadingSectors(false);
      loadingRef.current.sectors = false;
    }
  }, [currentCompany?.id, cache]);

  const fetchRolePermissions = useCallback(async () => {
    if (loadingRef.current.roles) return;
    
    const cacheKey = createCacheKey('role-permissions');
    const cached = cache.get<RolePermissionData>(cacheKey);
    if (cached) {
      setRolePermissions(cached);
      return;
    }

    loadingRef.current.roles = true;
    try {
      const response = await fetch('/api/admin/roles');
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          const rolesData = data.roles || {};
          setRolePermissions(rolesData);
          cache.set(cacheKey, rolesData);
        }
      } else {
        throw new Error('Error cargando roles');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los roles',
        variant: 'destructive',
      });
    } finally {
      loadingRef.current.roles = false;
    }
  }, [cache, toast]);

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      
      // Construir query params
      const params = new URLSearchParams();
      if (currentCompany?.id) params.append('companyId', currentCompany.id);
      if (userSearch) params.append('search', userSearch);
      if (userRoleFilter && userRoleFilter !== 'all') params.append('role', userRoleFilter);
      
      const url = `/api/admin/users-with-roles?${params.toString()}`;
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          setUsers(data.users || []);
        }
      } else {
        throw new Error('Error cargando usuarios');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los usuarios',
        variant: 'destructive',
      });
    } finally {
      setUsersLoading(false);
    }
  };

  const loadUserSpecificPermissions = async (user: UserData) => {
    try {
      const response = await fetch(`/api/admin/user-specific-permissions?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        // Actualizar el usuario con los permisos específicos cargados
        user.userSpecificPermissions = data.specificPermissions || [];
        return user;
      } else {
        user.userSpecificPermissions = [];
        return user;
      }
    } catch (error) {
      user.userSpecificPermissions = [];
      return user;
    }
  };

  const getPermissionsByCategory = () => {
    const filteredPermissions = permissions.filter(permission => {
      const matchesSearch = permission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (permission.description && permission.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = categoryFilter === 'all' || permission.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    return filteredPermissions.reduce((acc, permission) => {
      const category = permission.category || 'Sin categoría';
      if (!acc[category]) acc[category] = [];
      acc[category].push(permission);
      return acc;
    }, {} as Record<string, Permission[]>);
  };

  const getRoleCount = (permissionName: string) => {
    return Object.values(rolePermissions).filter(role =>
      role.permissions.some(p => p.name === permissionName)
    ).length;
  };

  // Obtener nombres de roles que tienen un permiso específico
  const getRoleNames = (permissionName: string): string[] => {
    return Object.values(rolePermissions)
      .filter(role => role.permissions.some(p => p.name === permissionName))
      .map(role => role.displayName || role.name);
  };

  // Normalizar nombres de categorías
  const getCategoryDisplayName = (category: string): string => {
    const categoryMap: Record<string, string> = {
      'fixed_tasks': 'Tareas Fijas',
      'tasks': 'Tareas',
      'machines': 'Máquinas',
      'navigation': 'Navegación',
      'plant': 'Planta',
      'sectors': 'Sectores',
      'companies': 'Empresas',
      'PREVENTIVE_MAINTENANCE': 'Mantenimiento Preventivo',
      'WORK_ORDERS': 'Órdenes de Trabajo',
      'users': 'Usuarios',
      'admin': 'Administración',
      'reports': 'Reportes',
      'settings': 'Configuración',
      'audit': 'Auditoría',
      'notifications': 'Notificaciones',
      'tools': 'Herramientas',
      'panol': 'Pañol',
      'AREAS': 'Áreas',
      'Administración': 'Administración'
    };
    return categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  };

  // Estado para categorías colapsadas
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const expandAllCategories = () => setCollapsedCategories(new Set());
  const collapseAllCategories = () => setCollapsedCategories(new Set(categories));

  // Toggle para categorías en modal de usuario
  const toggleUserCategory = (category: string) => {
    setCollapsedUserCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // Toggle para categorías en modal de rol
  const toggleRoleCategory = (category: string) => {
    setCollapsedRoleCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const handleDeleteRole = async (roleName: string) => {
    try {
      setIsDeletingRole(true);
      
      const response = await fetch(`/api/admin/roles?role=${encodeURIComponent(roleName)}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Rol eliminado',
          description: data.message,
        });
        
        // Recargar los roles
        await fetchRolePermissions();
        setIsDeleteRoleDialogOpen(false);
        setRoleToDelete(null);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Error eliminando el rol',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error eliminando el rol',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingRole(false);
    }
  };

  // Iniciar proceso de clonar rol
  const handleStartCloneRole = (roleName: string) => {
    const sourceRole = rolePermissions[roleName];
    if (sourceRole) {
      setRoleToClone(roleName);
      setCloneRoleData({
        name: `${sourceRole.name}_copia`,
        displayName: `${sourceRole.displayName} (Copia)`,
        description: sourceRole.description || ''
      });
      setIsCloneRoleDialogOpen(true);
    }
  };

  // Ejecutar clonación de rol usando el endpoint optimizado
  const handleCloneRole = async () => {
    if (!roleToClone || !cloneRoleData.name || !cloneRoleData.displayName) {
      toast({
        title: 'Error',
        description: 'Nombre y nombre de visualización son requeridos',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCreating(true);

      // Usar el endpoint optimizado que clona en una sola transacción
      const response = await fetch('/api/admin/roles/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceRoleName: roleToClone,
          newName: cloneRoleData.name,
          newDisplayName: cloneRoleData.displayName,
          newDescription: cloneRoleData.description
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al clonar el rol');
      }

      toast({
        title: 'Rol clonado',
        description: data.message || `El rol "${cloneRoleData.displayName}" ha sido creado`,
      });

      // Limpiar y cerrar
      setIsCloneRoleDialogOpen(false);
      setRoleToClone(null);
      setCloneRoleData({ name: '', displayName: '', description: '' });

      // Recargar roles
      await fetchRolePermissions();
    } catch (error: any) {
      toast({
        title: 'Error al clonar',
        description: error.message || 'Error al clonar el rol',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <PermissionGuard permission="ingresar_permisos">
      <div className="w-full p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0">
          {/* Header con tabs */}
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

          {canViewPermisos && (
          <TabsContent value="permissions" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
            {/* KPIs estilo Tareas Fijas - Cards con progreso */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                      <p className="text-2xl font-bold mt-1">{permissions.filter(p => p.isActive).length}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${permissions.length > 0 ? Math.round((permissions.filter(p => p.isActive).length / permissions.length) * 100) : 0}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
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

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Roles</p>
                      <p className="text-2xl font-bold mt-1">{Object.keys(rolePermissions).length}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted">
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Barra de filtros */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar permisos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 bg-background"
                />
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-48 h-9 bg-background">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {getCategoryDisplayName(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(searchTerm || categoryFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setCategoryFilter('all');
                  }}
                  className="h-9 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Limpiar
                </Button>
              )}

              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground px-2">
                <span className="font-medium text-foreground">
                  {(() => {
                    const filtered = getPermissionsByCategory();
                    return Object.values(filtered).flat().length;
                  })()}
                </span>
                <span>de {permissions.length}</span>
              </div>

              <div className="hidden sm:flex items-center gap-1 border-l border-border pl-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={expandAllCategories}
                  className="h-8 px-2 text-xs"
                >
                  Expandir
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={collapseAllCategories}
                  className="h-8 px-2 text-xs"
                >
                  Colapsar
                </Button>
              </div>
            </div>

            {/* Lista de permisos por categoría - Diseño mejorado */}
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-muted-foreground">Cargando permisos...</span>
                </div>
              ) : permissions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mx-auto mb-4">
                    <Shield className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No hay permisos</h3>
                  <p className="text-muted-foreground">No hay permisos disponibles en el sistema</p>
                </div>
              ) : (() => {
                const permissionsByCategory = getPermissionsByCategory();
                const entries = Object.entries(permissionsByCategory);

                if (entries.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mx-auto mb-4">
                        <Search className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Sin resultados</h3>
                      <p className="text-muted-foreground mb-4">No hay permisos que coincidan con los filtros</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearchTerm('');
                          setCategoryFilter('all');
                        }}
                      >
                        Limpiar filtros
                      </Button>
                    </div>
                  );
                }

                return (
                  <TooltipProvider>
                    {entries.map(([category, categoryPermissions]) => {
                      const isCollapsed = collapsedCategories.has(category);
                      const activeCount = categoryPermissions.filter((p: Permission) => p.isActive).length;
                      const progress = categoryPermissions.length > 0 ? Math.round((activeCount / categoryPermissions.length) * 100) : 0;

                      return (
                        <Collapsible
                          key={category}
                          open={!isCollapsed}
                          onOpenChange={() => toggleCategory(category)}
                        >
                          <div className="rounded-lg border bg-card overflow-hidden">
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                    {isCollapsed ? (
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">
                                      {getCategoryDisplayName(category)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {categoryPermissions.length} permisos
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="hidden sm:flex items-center gap-2 w-32">
                                    <div className="flex-1 bg-muted rounded-full h-1.5">
                                      <div
                                        className="bg-primary/70 h-1.5 rounded-full transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-muted-foreground w-8">{progress}%</span>
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {activeCount} activos
                                  </Badge>
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="border-t">
                                <div className="divide-y">
                                  {categoryPermissions.map((permission: Permission) => {
                                    const roleNames = getRoleNames(permission.name);
                                    const roleCount = roleNames.length;

                                    return (
                                      <div key={permission.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                          <div className={cn(
                                            "w-2 h-2 rounded-full shrink-0",
                                            permission.isActive ? "bg-primary" : "bg-muted-foreground/30"
                                          )} />
                                          <div className="min-w-0">
                                            <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                                              {permission.name}
                                            </code>
                                            {permission.description && (
                                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                                {permission.description}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          {roleCount > 0 ? (
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Badge
                                                  variant="secondary"
                                                  className="cursor-help text-xs"
                                                >
                                                  {roleCount} {roleCount === 1 ? 'rol' : 'roles'}
                                                </Badge>
                                              </TooltipTrigger>
                                              <TooltipContent side="left" className="max-w-xs">
                                                <p className="font-medium mb-1 text-xs">Roles:</p>
                                                <ul className="text-xs space-y-0.5">
                                                  {roleNames.slice(0, 5).map((name, idx) => (
                                                    <li key={idx}>• {name}</li>
                                                  ))}
                                                  {roleNames.length > 5 && (
                                                    <li className="text-muted-foreground">+{roleNames.length - 5} más</li>
                                                  )}
                                                </ul>
                                              </TooltipContent>
                                            </Tooltip>
                                          ) : (
                                            <span className="text-xs text-muted-foreground">-</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      );
                    })}
                  </TooltipProvider>
                );
              })()}
            </div>
          </TabsContent>
        )}

          {canViewRoles && (
          <TabsContent value="roles" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
            {/* Header con stats y botón */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Roles del Sistema</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {(() => {
                    const systemRoles = ['SUPERADMIN', 'ADMIN', 'SUPERVISOR', 'USER', 'ADMIN_ENTERPRISE'];
                    const customRoles = Object.entries(rolePermissions).filter(([roleName]) => !systemRoles.includes(roleName));
                    const totalUsers = customRoles.reduce((acc, [, data]) => acc + data.userCount, 0);
                    return `${customRoles.length} roles personalizados • ${totalUsers} usuarios asignados`;
                  })()}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsCreateRoleDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Rol
              </Button>
            </div>

            {/* Grid de roles mejorado */}
            {(() => {
              const systemRoles = ['SUPERADMIN', 'ADMIN', 'SUPERVISOR', 'USER', 'ADMIN_ENTERPRISE'];
              const customRoles = Object.entries(rolePermissions).filter(
                ([roleName]) => !systemRoles.includes(roleName)
              );

              if (customRoles.length === 0) {
                return (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mx-auto mb-4">
                      <Users className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Sin roles personalizados</h3>
                    <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                      Crea roles para definir conjuntos de permisos que puedas asignar a usuarios
                    </p>
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        setIsCreateRoleDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Crear primer rol
                    </Button>
                  </div>
                );
              }

              // Calcular el máximo de permisos para normalizar las barras de progreso
              const maxPermissions = Math.max(...customRoles.map(([, data]) => data.permissions.length), 1);

              return (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {customRoles.map(([roleName, roleData]) => {
                    const permissionProgress = Math.round((roleData.permissions.length / maxPermissions) * 100);

                    return (
                      <div
                        key={roleName}
                        className="group rounded-lg border bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all duration-200"
                      >
                        {/* Header del rol */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-medium text-foreground">{roleData.displayName}</h3>
                              <p className="text-xs text-muted-foreground">{roleName}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {roleData.userCount} {roleData.userCount === 1 ? 'usuario' : 'usuarios'}
                          </Badge>
                        </div>

                        {/* Descripción */}
                        {roleData.description && (
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {roleData.description}
                          </p>
                        )}

                        {/* Progress de permisos */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">Permisos asignados</span>
                            <span className="text-xs font-medium">{roleData.permissions.length}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${permissionProgress}%` }}
                            />
                          </div>
                        </div>

                        {/* Permisos preview */}
                        <div className="flex flex-wrap gap-1 mb-4 min-h-[28px]">
                          {roleData.permissions.slice(0, 3).map((permission, index) => (
                            <Badge
                              key={permission.id || index}
                              variant="outline"
                              className="text-xs h-5 font-mono"
                            >
                              {permission.name.length > 15 ? permission.name.slice(0, 15) + '...' : permission.name}
                            </Badge>
                          ))}
                          {roleData.permissions.length > 3 && (
                            <Badge variant="secondary" className="text-xs h-5">
                              +{roleData.permissions.length - 3}
                            </Badge>
                          )}
                          {roleData.permissions.length === 0 && (
                            <span className="text-xs text-muted-foreground italic">Sin permisos</span>
                          )}
                        </div>

                        {/* Acciones */}
                        <div className="flex gap-2 pt-3 border-t border-border/50">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8"
                            onClick={() => {
                              setSelectedRole(roleName);
                              setIsRoleDetailOpen(true);
                            }}
                          >
                            <Settings className="h-3.5 w-3.5 mr-1.5" />
                            Gestionar
                          </Button>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleStartCloneRole(roleName)}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Duplicar rol</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setRoleToDelete(roleName);
                                    setIsDeleteRoleDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Eliminar rol</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </TabsContent>
        )}

          <TabsContent value="users" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          {/* Header con stats */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Permisos por Usuario</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {(() => {
                  const filteredUsers = users.filter(u => u.role !== 'SUPERADMIN');
                  const withCustom = filteredUsers.filter(u => (u.userSpecificPermissionsCount || 0) > 0).length;
                  return `${filteredUsers.length} usuarios • ${withCustom} con permisos personalizados`;
                })()}
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuarios..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9 h-9 bg-background"
              />
            </div>

            <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
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
                onClick={() => {
                  setUserSearch('');
                  setUserRoleFilter('all');
                }}
                className="h-9 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}

            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground px-2">
              <span className="font-medium text-foreground">
                {users.filter(u => u.role !== 'SUPERADMIN').length}
              </span>
              <span>usuarios</span>
            </div>
          </div>

          {/* Tabla de usuarios */}
          {usersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-muted-foreground">Cargando usuarios...</span>
            </div>
          ) : users.filter(u => u.role !== 'SUPERADMIN').length === 0 ? (
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
                  {users.filter(u => u.role !== 'SUPERADMIN').map((userData) => (
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
                        <Badge variant="outline" className="text-xs">
                          {userData.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-medium">{userData.rolePermissionCount || 0}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {(userData.userSpecificPermissionsCount || 0) > 0 ? (
                          <Badge variant="secondary" className="text-xs">
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
                          onClick={async () => {
                            const updatedUser = await loadUserSpecificPermissions(userData);
                            setSelectedUser(updatedUser);
                            setIsUserPermissionsOpen(true);
                          }}
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
        </TabsContent>

        </Tabs>
      </div>

      {/* Diálogo de confirmación para eliminar rol */}
      <Dialog open={isDeleteRoleDialogOpen} onOpenChange={setIsDeleteRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Rol</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar el rol &quot;{roleToDelete}&quot;? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDeleteRoleDialogOpen(false);
                setRoleToDelete(null);
              }}
              disabled={isDeletingRole}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => roleToDelete && handleDeleteRole(roleToDelete)}
              disabled={isDeletingRole}
            >
              {isDeletingRole ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar Rol
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para clonar rol */}
      <Dialog open={isCloneRoleDialogOpen} onOpenChange={(open) => {
        setIsCloneRoleDialogOpen(open);
        if (!open) {
          setRoleToClone(null);
          setCloneRoleData({ name: '', displayName: '', description: '' });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Clonar Rol
            </DialogTitle>
            <DialogDescription>
              Se creará un nuevo rol con los mismos permisos que &quot;{roleToClone && rolePermissions[roleToClone]?.displayName}&quot;
              ({roleToClone && rolePermissions[roleToClone]?.permissions.length || 0} permisos)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clone-name">Nombre interno</Label>
              <Input
                id="clone-name"
                placeholder="nombre_rol"
                value={cloneRoleData.name}
                onChange={(e) => setCloneRoleData({ ...cloneRoleData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
              />
              <p className="text-xs text-muted-foreground">
                Identificador único del rol (sin espacios)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clone-displayName">Nombre de visualización</Label>
              <Input
                id="clone-displayName"
                placeholder="Nombre del Rol"
                value={cloneRoleData.displayName}
                onChange={(e) => setCloneRoleData({ ...cloneRoleData, displayName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clone-description">Descripción</Label>
              <Textarea
                id="clone-description"
                placeholder="Descripción del rol..."
                value={cloneRoleData.description}
                onChange={(e) => setCloneRoleData({ ...cloneRoleData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCloneRoleDialogOpen(false);
                setRoleToClone(null);
                setCloneRoleData({ name: '', displayName: '', description: '' });
              }}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCloneRole}
              disabled={isCreating || !cloneRoleData.name || !cloneRoleData.displayName}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Clonando...
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Clonar Rol
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isRoleDetailOpen && selectedRole && rolePermissions[selectedRole] && (
        <Dialog
          open={isRoleDetailOpen}
          onOpenChange={(open) => {
            setIsRoleDetailOpen(open);
            if (!open) {
              // Limpiar filtros al cerrar
              setRolePermissionSearch('');
              setRolePermissionFilter('all');
              setCollapsedRoleCategories(new Set());
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
            {/* Header fijo */}
            <div className="px-6 py-4 border-b bg-background sticky top-0 z-10">
              <DialogHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <DialogTitle className="text-base">
                        {rolePermissions[selectedRole].displayName}
                      </DialogTitle>
                      <p className="text-xs text-muted-foreground">
                        {rolePermissions[selectedRole].description || 'Sin descripción'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {rolePermissions[selectedRole].userCount} {rolePermissions[selectedRole].userCount === 1 ? 'usuario' : 'usuarios'}
                  </Badge>
                </div>

                {/* Stats compactas */}
                {(() => {
                  const grantedCount = rolePermissions[selectedRole].permissions.length;
                  const totalCount = permissions.length;
                  const progress = totalCount > 0 ? Math.round((grantedCount / totalCount) * 100) : 0;
                  return (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          <span className="font-medium text-foreground">{grantedCount}</span> de {totalCount} permisos ({progress}%)
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Barra de filtros */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar permisos..."
                      value={rolePermissionSearch}
                      onChange={(e) => setRolePermissionSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-1 p-0.5 bg-muted rounded-md">
                    <Button
                      variant={rolePermissionFilter === 'all' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => setRolePermissionFilter('all')}
                    >
                      Todos
                    </Button>
                    <Button
                      variant={rolePermissionFilter === 'granted' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => setRolePermissionFilter('granted')}
                    >
                      Activos
                    </Button>
                    <Button
                      variant={rolePermissionFilter === 'not_granted' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => setRolePermissionFilter('not_granted')}
                    >
                      Sin asignar
                    </Button>
                  </div>
                  {rolePermissionSearch && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => setRolePermissionSearch('')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </DialogHeader>
            </div>

            {/* Contenido scrolleable */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-2">
                {(() => {
                  // Agrupar permisos por categoría y aplicar filtros
                  const groupedPermissions = categories.reduce((acc, category) => {
                    const categoryPerms = permissions.filter(p => {
                      if (p.category !== category) return false;

                      // Filtro de búsqueda
                      if (rolePermissionSearch) {
                        const searchLower = rolePermissionSearch.toLowerCase();
                        const matchesSearch =
                          p.name.toLowerCase().includes(searchLower) ||
                          (p.description && p.description.toLowerCase().includes(searchLower));
                        if (!matchesSearch) return false;
                      }

                      // Filtro por estado
                      const hasPermission = rolePermissions[selectedRole].permissions.some(
                        (rp: Permission) => rp.name === p.name
                      );

                      if (rolePermissionFilter === 'granted' && !hasPermission) return false;
                      if (rolePermissionFilter === 'not_granted' && hasPermission) return false;

                      return true;
                    });

                    if (categoryPerms.length > 0) {
                      acc[category] = categoryPerms;
                    }
                    return acc;
                  }, {} as Record<string, Permission[]>);

                  const entries = Object.entries(groupedPermissions);

                  if (entries.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <div className="w-14 h-14 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mx-auto mb-4">
                          <Search className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        <h3 className="text-sm font-medium mb-1">Sin resultados</h3>
                        <p className="text-xs text-muted-foreground mb-3">No hay permisos que coincidan con los filtros</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRolePermissionSearch('');
                            setRolePermissionFilter('all');
                          }}
                        >
                          Limpiar filtros
                        </Button>
                      </div>
                    );
                  }

                  return entries.map(([category, categoryPermissions]) => {
                    const isCollapsed = collapsedRoleCategories.has(category);
                    const grantedInCategory = categoryPermissions.filter(p =>
                      rolePermissions[selectedRole].permissions.some((rp: Permission) => rp.name === p.name)
                    ).length;

                    return (
                      <Collapsible
                        key={category}
                        open={!isCollapsed}
                        onOpenChange={() => toggleRoleCategory(category)}
                      >
                        <div className="rounded-lg border bg-card overflow-hidden">
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center">
                                  {isCollapsed ? (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <span className="text-sm font-medium">
                                  {getCategoryDisplayName(category)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={grantedInCategory === categoryPermissions.length ? 'default' : 'secondary'}
                                  className="text-xs h-5"
                                >
                                  {grantedInCategory}/{categoryPermissions.length}
                                </Badge>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t divide-y">
                              {categoryPermissions.map(permission => {
                                const hasPermission = rolePermissions[selectedRole].permissions.some(
                                  (p: Permission) => p.name === permission.name
                                );

                                return (
                                  <div
                                    key={permission.id}
                                    className={cn(
                                      "flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30",
                                      hasPermission && "bg-primary/5"
                                    )}
                                  >
                                    <Checkbox
                                      checked={hasPermission}
                                      onCheckedChange={async (checked) => {
                                        try {
                                          const response = await fetch('/api/admin/roles', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              roleName: selectedRole,
                                              permissionId: permission.id,
                                              isGranted: !!checked
                                            })
                                          });

                                          if (response.ok) {
                                            await fetchRolePermissions();
                                            toast({
                                              title: checked ? 'Permiso agregado' : 'Permiso removido',
                                              description: `${permission.name} ${checked ? 'asignado al' : 'quitado del'} rol`,
                                            });
                                          }
                                        } catch (error) {
                                          toast({
                                            title: 'Error',
                                            description: 'No se pudo actualizar el permiso',
                                            variant: 'destructive',
                                          });
                                        }
                                      }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate">
                                          {permission.name}
                                        </code>
                                        {hasPermission && (
                                          <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                        )}
                                      </div>
                                      {permission.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                          {permission.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Footer fijo */}
            <div className="px-6 py-3 border-t bg-background">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Los cambios afectan a todos los usuarios con este rol
                </p>
                <Button variant="outline" size="sm" onClick={() => setIsRoleDetailOpen(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog 
        open={isCreateRoleDialogOpen} 
        onOpenChange={(open) => {
          setIsCreateRoleDialogOpen(open);
          if (open && currentCompany?.id) {
            // No cargar sectores aquí, se cargarán cuando se detecte "supervisor"
          } else {
            setNewRole({ name: '', displayName: '', description: '', sectorId: null });
            setSectors([]); // Limpiar sectores al cerrar
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear nuevo rol</DialogTitle>
            <DialogDescription>
              Ingresa los datos para el nuevo rol personalizado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Nombre interno</Label>
              <Input
                id="role-name"
                placeholder="Ej: supervisor, auditor"
                value={newRole.name}
                onChange={e => {
                  const newName = e.target.value;
                  setNewRole({ ...newRole, name: newName });
                  // Si el nombre es "supervisor", cargar sectores si aún no se cargaron
                  if ((newName.toLowerCase() === 'supervisor' || newRole.displayName.toLowerCase() === 'supervisor') && sectors.length === 0 && !loadingSectors && currentCompany?.id) {
                    fetchSectors();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-display">Nombre visible</Label>
              <Input
                id="role-display"
                placeholder="Ej: Supervisor, Auditor"
                value={newRole.displayName}
                onChange={e => {
                  const newDisplayName = e.target.value;
                  setNewRole({ ...newRole, displayName: newDisplayName });
                  // Si el nombre visible es "supervisor", cargar sectores si aún no se cargaron
                  if ((newRole.name.toLowerCase() === 'supervisor' || newDisplayName.toLowerCase() === 'supervisor') && sectors.length === 0 && !loadingSectors && currentCompany?.id) {
                    fetchSectors();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Descripción</Label>
              <Textarea
                id="role-description"
                placeholder="Descripción del rol"
                value={newRole.description}
                onChange={e => setNewRole({ ...newRole, description: e.target.value })}
              />
            </div>
            {(newRole.name.toLowerCase() === 'supervisor' || newRole.displayName.toLowerCase() === 'supervisor') && (
              <div className="space-y-2">
                <Label htmlFor="role-sector">Sector (Opcional)</Label>
                <Select
                  value={newRole.sectorId?.toString() || 'none'}
                  onValueChange={(value) => setNewRole({ ...newRole, sectorId: value === 'none' ? null : parseInt(value) })}
                >
                  <SelectTrigger id="role-sector">
                    <SelectValue placeholder="Selecciona un sector" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin sector</SelectItem>
                    {loadingSectors ? (
                      <SelectItem value="loading" disabled>Cargando sectores...</SelectItem>
                    ) : sectors.length > 0 ? (
                      sectors.map((sector) => (
                        <SelectItem key={sector.id} value={sector.id.toString()}>
                          {sector.name} {sector.area?.name ? `(${sector.area.name})` : ''}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-sectors" disabled>No hay sectores disponibles</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {!loadingSectors && sectors.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    No se encontraron sectores. Verifica que existan sectores en la empresa.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateRoleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                setIsCreating(true);
                const res = await fetch('/api/admin/roles', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(newRole)
                });
                const data = await res.json();
                setIsCreating(false);
                if (res.ok) {
                  toast({ title: 'Rol creado', description: data.message });
                  setIsCreateRoleDialogOpen(false);
                  setNewRole({ name: '', displayName: '', description: '', sectorId: null });
                  await fetchRolePermissions();
                } else {
                  toast({ title: 'Error', description: data.error || 'Error creando rol', variant: 'destructive' });
                }
              }}
              disabled={isCreating || !newRole.name || !newRole.displayName}
            >
              {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Crear Rol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isUserPermissionsOpen && selectedUser && (
        <Dialog
          open={isUserPermissionsOpen}
          onOpenChange={(open) => {
            setIsUserPermissionsOpen(open);
            if (!open) {
              // Limpiar filtros al cerrar
              setUserPermissionSearch('');
              setUserPermissionFilter('all');
              setCollapsedUserCategories(new Set());
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
            {/* Header fijo */}
            <div className="px-6 py-4 border-b bg-background sticky top-0 z-10">
              <DialogHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {selectedUser.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <DialogTitle className="text-base">
                        {selectedUser.name}
                      </DialogTitle>
                      <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {selectedUser.role}
                  </Badge>
                </div>

                {/* Stats compactas */}
                {(() => {
                  const rolePermsCount = rolePermissions[selectedUser.role]?.permissions?.length || 0;
                  const customPermsCount = selectedUser.userSpecificPermissions?.length || 0;
                  return (
                    <div className="flex items-center gap-4 text-xs">
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
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="font-medium">{permissions.length}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Barra de filtros */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar permisos..."
                      value={userPermissionSearch}
                      onChange={(e) => setUserPermissionSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-1 p-0.5 bg-muted rounded-md">
                    <Button
                      variant={userPermissionFilter === 'all' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => setUserPermissionFilter('all')}
                    >
                      Todos
                    </Button>
                    <Button
                      variant={userPermissionFilter === 'role' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => setUserPermissionFilter('role')}
                    >
                      Del Rol
                    </Button>
                    <Button
                      variant={userPermissionFilter === 'custom' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => setUserPermissionFilter('custom')}
                    >
                      Editables
                    </Button>
                  </div>
                  {userPermissionSearch && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => setUserPermissionSearch('')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </DialogHeader>
            </div>

            {/* Contenido scrolleable */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-2">
                {(() => {
                  // Agrupar permisos por categoría y aplicar filtros
                  const groupedPermissions = categories.reduce((acc, category) => {
                    const categoryPerms = permissions.filter(p => {
                      if (p.category !== category) return false;

                      // Filtro de búsqueda
                      if (userPermissionSearch) {
                        const searchLower = userPermissionSearch.toLowerCase();
                        const matchesSearch =
                          p.name.toLowerCase().includes(searchLower) ||
                          (p.description && p.description.toLowerCase().includes(searchLower));
                        if (!matchesSearch) return false;
                      }

                      // Filtro por tipo
                      const hasByRole = rolePermissions[selectedUser.role]?.permissions?.some(
                        (rp: any) => rp.id === p.id
                      );

                      if (userPermissionFilter === 'role' && !hasByRole) return false;
                      if (userPermissionFilter === 'custom' && hasByRole) return false;

                      return true;
                    });

                    if (categoryPerms.length > 0) {
                      acc[category] = categoryPerms;
                    }
                    return acc;
                  }, {} as Record<string, Permission[]>);

                  const entries = Object.entries(groupedPermissions);

                  if (entries.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <div className="w-14 h-14 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mx-auto mb-4">
                          <Search className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        <h3 className="text-sm font-medium mb-1">Sin resultados</h3>
                        <p className="text-xs text-muted-foreground mb-3">No hay permisos que coincidan con los filtros</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setUserPermissionSearch('');
                            setUserPermissionFilter('all');
                          }}
                        >
                          Limpiar filtros
                        </Button>
                      </div>
                    );
                  }

                  return entries.map(([category, categoryPermissions]) => {
                    const isCollapsed = collapsedUserCategories.has(category);
                    const rolePermsInCategory = categoryPermissions.filter(p =>
                      rolePermissions[selectedUser.role]?.permissions?.some((rp: any) => rp.id === p.id)
                    ).length;
                    const customPermsInCategory = categoryPermissions.filter(p =>
                      selectedUser.userSpecificPermissions?.some((up: any) => up.permissionId === p.id)
                    ).length;

                    return (
                      <Collapsible
                        key={category}
                        open={!isCollapsed}
                        onOpenChange={() => toggleUserCategory(category)}
                      >
                        <div className="rounded-lg border bg-card overflow-hidden">
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center">
                                  {isCollapsed ? (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <span className="text-sm font-medium">
                                  {getCategoryDisplayName(category)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {rolePermsInCategory > 0 && (
                                  <Badge variant="secondary" className="text-xs h-5">
                                    {rolePermsInCategory} del rol
                                  </Badge>
                                )}
                                {customPermsInCategory > 0 && (
                                  <Badge className="text-xs h-5 bg-primary/10 text-primary hover:bg-primary/20">
                                    {customPermsInCategory} custom
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground ml-1">
                                  {categoryPermissions.length}
                                </span>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t divide-y">
                              {categoryPermissions.map(permission => {
                                const hasPersonalized = selectedUser.userSpecificPermissions?.some(
                                  (up: any) => up.permissionId === permission.id && up.isGranted === true
                                );
                                const hasByRole = rolePermissions[selectedUser.role]?.permissions?.some(
                                  (p: any) => p.id === permission.id
                                );
                                const checked = hasPersonalized || hasByRole;
                                const isFromRole = hasByRole && !hasPersonalized;

                                return (
                                  <div
                                    key={permission.id}
                                    className={cn(
                                      "flex items-center gap-3 px-4 py-2.5 transition-colors",
                                      isFromRole ? "bg-muted/20" : "hover:bg-muted/30"
                                    )}
                                  >
                                    <Checkbox
                                      checked={checked}
                                      disabled={isFromRole}
                                      className={cn(
                                        isFromRole && "opacity-50"
                                      )}
                                      onCheckedChange={async (checked) => {
                                        if (isFromRole) return;
                                        try {
                                          const response = await fetch('/api/admin/user-specific-permissions', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              userId: selectedUser.id,
                                              permissionId: permission.id,
                                              isGranted: !!checked
                                            })
                                          });

                                          if (response.ok) {
                                            const updatedUser = await loadUserSpecificPermissions(selectedUser);
                                            setSelectedUser(updatedUser);
                                            await fetchUsers();
                                            toast({
                                              title: checked ? 'Permiso otorgado' : 'Permiso revocado',
                                              description: `${permission.name} ${checked ? 'agregado' : 'quitado'}`,
                                            });
                                          }
                                        } catch (error) {
                                          toast({
                                            title: 'Error',
                                            description: 'No se pudo actualizar el permiso',
                                            variant: 'destructive',
                                          });
                                        }
                                      }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate">
                                          {permission.name}
                                        </code>
                                        {isFromRole && (
                                          <Badge variant="outline" className="text-xs h-5 shrink-0">
                                            Del rol
                                          </Badge>
                                        )}
                                        {hasPersonalized && (
                                          <Badge className="text-xs h-5 bg-primary/10 text-primary hover:bg-primary/20 shrink-0">
                                            Personalizado
                                          </Badge>
                                        )}
                                      </div>
                                      {permission.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                          {permission.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Footer fijo */}
            <div className="px-6 py-3 border-t bg-background">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Los permisos personalizados sobrescriben los del rol
                </p>
                <Button variant="outline" size="sm" onClick={() => setIsUserPermissionsOpen(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </PermissionGuard>
  );
} 