'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { hasPermission, createPermissionContext, getAssignableRoles, UserRole } from '@/lib/permissions';
import {
  User,
  Mail,
  Shield,
  Save,
  X,
  AlertTriangle,
  CheckCircle,
  XCircle,
  UserPlus,
  Lock,
  Eye,
  EyeOff,
  Calendar,
  Clock,
  Activity,
} from 'lucide-react';

interface UserEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: number; // Opcional para modo creación
  onUserUpdated?: () => void;
}

interface UserData {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  globalRole?: string;
  isActive: boolean;
  companies?: any[];
  ownedCompanies?: any[];
  stats?: {
    assignedTasks: number;
    createdTasks: number;
    assignedWorkOrders: number;
    createdWorkOrders: number;
  };
}

export default function UserEditDialog({ isOpen, onClose, userId, onUserUpdated }: UserEditDialogProps) {
  const { user: currentUser } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<Array<{name: string, displayName: string}>>([]);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '', // Solo para crear usuarios
    role: 'USER' as string,
    isActive: true,
  });

  const [originalData, setOriginalData] = useState<any>(null);
  const isCreateMode = !userId; // Modo crear si no hay userId

  useEffect(() => {
    if (isOpen && currentCompany?.id) {
      fetchAvailableRoles();
      if (userId) {
        fetchUserData(); // Modo editar
      } else {
        // Modo crear - resetear formulario
        setFormData({
          name: '',
          email: '',
          password: '',
          role: 'USER' as string,
          isActive: true,
        });
        setOriginalData(null);
        setUserData(null);
      }
    }
  }, [isOpen, userId, currentCompany?.id]);

  const fetchAvailableRoles = async () => {
    if (!currentCompany?.id) {
      console.warn('No hay empresa seleccionada para cargar roles');
      setAvailableRoles([]);
      return;
    }
    
    try {
      // Obtener roles específicos de la empresa actual
      const response = await fetch(`/api/admin/roles?companyId=${currentCompany.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.roles) {
          // Roles del sistema
          const systemRoles = ['SUPERADMIN', 'ADMIN', 'SUPERVISOR', 'USER', 'ADMIN_ENTERPRISE'];
          
          // Primero, separar roles personalizados y del sistema
          const personalizedRoles: Array<{ name: string; displayName: string }> = [];
          const systemRolesList: Array<{ name: string; displayName: string }> = [];
          
          Object.entries(data.roles).forEach(([name, roleData]: [string, any]) => {
            const roleName = name.trim();
            const roleNameUpper = roleName.toUpperCase();
            
            // Filtrar SUPERADMIN
            if (roleNameUpper === 'SUPERADMIN') {
              return;
            }
            
            const roleEntry = {
              name: roleName,
              displayName: roleData.displayName || roleName
            };
            
            if (systemRoles.includes(roleNameUpper)) {
              systemRolesList.push(roleEntry);
            } else {
              personalizedRoles.push(roleEntry);
            }
          });
          
          // Crear un Map para evitar duplicados (usando displayName como clave única)
          const rolesMap = new Map<string, { name: string; displayName: string }>();
          
          // Primero agregar roles personalizados (tienen prioridad)
          personalizedRoles.forEach(role => {
            const key = role.displayName.trim().toUpperCase();
            if (!rolesMap.has(key)) {
              rolesMap.set(key, role);
            }
          });
          
          // Luego agregar roles del sistema solo si no hay un personalizado con el mismo displayName
          systemRolesList.forEach(role => {
            const key = role.displayName.trim().toUpperCase();
            if (!rolesMap.has(key)) {
              rolesMap.set(key, role);
            }
          });
          
          // Convertir el Map a array y ordenar alfabéticamente por displayName
          const rolesArray = Array.from(rolesMap.values()).sort((a, b) => 
            a.displayName.localeCompare(b.displayName)
          );
          
          setAvailableRoles(rolesArray);
        } else {
          setAvailableRoles([]);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('🔍 [UserEditDialog] Error al cargar roles:', response.status, errorData);
        setAvailableRoles([]);
      }
    } catch (error) {
      console.error('🔍 [UserEditDialog] Error fetching available roles:', error);
      setAvailableRoles([]);
    }
  };

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setUserData(data.user);
        
        // Usar el rol específico de la empresa en lugar del rol global
        const companyRole = data.user.companies?.[0]?.role?.name || data.user.role;
        
        const formValues = {
          name: data.user.name || '',
          email: data.user.email || '',
          password: '', // En modo editar se usa solo para nueva contraseña (opcional)
          role: companyRole as UserRole,
          isActive: data.user.isActive,
        };
        
        setFormData(formValues);
        setOriginalData(formValues);
      } else {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los datos del usuario',
          variant: 'destructive',
        });
        onClose();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error de conexión',
        variant: 'destructive',
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;

    // Validaciones básicas
    if (!formData.name.trim() || !formData.email.trim()) {
      toast({
        title: 'Error',
        description: 'Nombre y email son requeridos',
        variant: 'destructive',
      });
      return;
    }

    if (isCreateMode && !formData.password.trim()) {
      toast({
        title: 'Error',
        description: 'La contraseña es requerida para crear un usuario',
        variant: 'destructive',
      });
      return;
    }

    const trimmedPassword = formData.password.trim();

    if (isCreateMode && trimmedPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'La contraseña debe tener al menos 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    // En modo editar, si se está cambiando la contraseña, validar también longitud mínima
    if (!isCreateMode && trimmedPassword && trimmedPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'La nueva contraseña debe tener al menos 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    // Verificar permisos
    if (isCreateMode) {
      const context = createPermissionContext(
        { id: parseInt(currentUser.id), role: (currentUser.systemRole || currentUser.role) as UserRole }
      );

      if (!hasPermission('users.create', context)) {
        toast({
          title: 'Sin permisos',
          description: 'No tienes permisos para crear usuarios',
          variant: 'destructive',
        });
        return;
      }
    } else {
      // Modo editar
      const context = createPermissionContext(
        { id: parseInt(currentUser.id), role: (currentUser.systemRole || currentUser.role) as UserRole },
        {
          targetUserId: userId,
          companyId: userData?.companies?.[0]?.id,
          targetCompanyId: userData?.companies?.[0]?.id
        }
      );

      const canEdit = hasPermission('users.edit', context);
      const canEditRole = hasPermission('users.edit_role', context);
      const isChangingRole = formData.role !== originalData?.role;

      if (!canEdit) {
        toast({
          title: 'Sin permisos',
          description: 'No tienes permisos para editar este usuario',
          variant: 'destructive',
        });
        return;
      }

      // Verificar si puede cambiar el rol
      if (isChangingRole && !canEditRole) {
        toast({
          title: 'Sin permisos',
          description: 'No tienes permisos para cambiar el rol de este usuario',
          variant: 'destructive',
        });
        return;
      }
    }

    setSaving(true);
    try {
      const url = isCreateMode ? '/api/users' : `/api/users/${userId}`;
      const method = isCreateMode ? 'POST' : 'PUT';
      
      // Preparar datos para enviar
      const bodyData = isCreateMode 
        // Crear usuario: usar password normal
        ? { 
            ...formData, 
            role: formData.role.trim(), 
            companyId: currentCompany?.id 
          }
        // Editar usuario: enviar solo campos relevantes + newPassword opcional
        : { 
            name: formData.name.trim(),
            email: formData.email.trim(),
            role: formData.role.trim(),
            isActive: formData.isActive,
            companyId: currentCompany?.id,
            // Solo enviar newPassword si el admin escribió algo
            newPassword: trimmedPassword ? trimmedPassword : undefined,
          };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      if (response.ok) {
        toast({
          title: isCreateMode ? 'Usuario creado' : 'Usuario actualizado',
          description: isCreateMode 
            ? 'El usuario se ha creado exitosamente'
            : 'Los datos del usuario se han actualizado correctamente',
        });
        onUserUpdated?.();
        onClose();
      } else {
        const error = await response.json();
        console.error('❌ [UserEditDialog] Error del servidor:', error);
        console.error('❌ [UserEditDialog] Status:', response.status);
        toast({
          title: 'Error',
          description: error.error || `Error al ${isCreateMode ? 'crear' : 'actualizar'} el usuario`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error de conexión',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadgeColor = (role: UserRole | string) => {
    switch (role) {
      case 'SUPERADMIN': return 'destructive';
      case 'ADMIN': return 'default';
      case 'SUPERVISOR': return 'secondary';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: UserRole | string) => {
    // Buscar en los roles disponibles primero
    const availableRole = availableRoles.find(r => r.name === role);
    if (availableRole) {
      return availableRole.displayName;
    }
    
    // Fallback a los roles del sistema
    const labels = {
      'SUPERADMIN': 'Super Admin',
      'ADMIN': 'Administrador',
      'SUPERVISOR': 'Supervisor',
      'USER': 'Usuario',
    };
    return labels[role as UserRole] || role;
  };

  const hasChanges = () => {
    if (isCreateMode) {
      return formData.name.trim() || formData.email.trim() || formData.password.trim();
    }
    if (!originalData) return false;
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  };

  const isOwnProfile = userId === parseInt(currentUser?.id || '0');

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent size="md">
          <div className="flex items-center justify-center p-6">
            <div className="text-muted-foreground">Cargando usuario...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="lg" className="p-0 gap-0">
        {/* Header fijo */}
        <div className="px-6 py-4 border-b bg-background shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', isCreateMode ? 'bg-primary/10' : 'bg-muted')}>
              {isCreateMode ? (
                <UserPlus className="h-4 w-4 text-primary" />
              ) : (
                <User className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold">
                {isCreateMode ? 'Crear nuevo usuario' : 'Editar usuario'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isCreateMode
                  ? 'Completa los datos para registrar un nuevo usuario'
                  : 'Modifica la información del usuario'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {/* Header con avatar y info básica - Solo en modo editar */}
            {!isCreateMode && userData && (
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                <Avatar className="h-11 w-11 shrink-0">
                  <AvatarImage src={userData.avatar} />
                  <AvatarFallback className="text-base bg-primary/10 text-primary font-medium">
                    {userData.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{userData.name}</span>
                    <Badge variant={getRoleBadgeColor(userData.role)} className="shrink-0 text-xs h-5">
                      {userData.companies?.[0]?.role?.displayName || getRoleLabel(userData.role)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{userData.email}</p>
                </div>

                <div className="shrink-0">
                  {userData.isActive ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-success-muted rounded-md">
                      <div className="w-1.5 h-1.5 rounded-full bg-success" />
                      <span className="text-xs font-medium text-success">Activo</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-destructive/10 rounded-md">
                      <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                      <span className="text-xs font-medium text-destructive">Inactivo</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Alertas */}
            {!isCreateMode && isOwnProfile && (
              <div className="flex items-center gap-2 p-2.5 bg-warning-muted border border-warning-muted-foreground/20 rounded-lg">
                <AlertTriangle className="h-3.5 w-3.5 text-warning-muted-foreground shrink-0" />
                <span className="text-xs text-warning-muted-foreground">
                  Estás editando tu propio perfil. Ten cuidado al cambiar tu rol.
                </span>
              </div>
            )}

            {/* Formulario */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs">Nombre completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="pl-9 h-9 text-sm"
                      placeholder="Nombre completo"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="pl-9 h-9 text-sm"
                      placeholder="usuario@empresa.com"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Contraseña */}
              <div className="space-y-1.5">
                <Label htmlFor={isCreateMode ? "password" : "newPassword"} className="text-xs">
                  {isCreateMode ? 'Contraseña' : 'Nueva contraseña (opcional)'}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    id={isCreateMode ? "password" : "newPassword"}
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="pl-9 pr-9 h-9 text-sm"
                    placeholder={isCreateMode ? "Mínimo 6 caracteres" : "Dejar vacío para no cambiar"}
                    required={isCreateMode}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="role" className="text-xs">Rol</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: string) => setFormData(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role.name} value={role.name}>
                          <div className="flex items-center gap-2">
                            <Shield className="h-3.5 w-3.5" />
                            <span className="text-sm">{role.displayName}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="isActive" className="text-xs">Estado</Label>
                  <div className="flex items-center h-9 px-3 border rounded-md bg-background">
                    <Switch
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                      className="scale-90"
                    />
                    <Label htmlFor="isActive" className="text-sm ml-2 cursor-pointer">
                      {formData.isActive ? 'Activa' : 'Inactiva'}
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Estadísticas de actividad - Solo en modo editar */}
            {!isCreateMode && userData?.stats && (
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-2.5">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Actividad</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center py-2 px-1 bg-info-muted/50 rounded-md border border-info-muted-foreground/10">
                    <div className="text-base font-semibold text-info-muted-foreground">
                      {userData.stats.assignedTasks}
                    </div>
                    <div className="text-[9px] text-info-muted-foreground/70 leading-tight">
                      Tareas<br/>asignadas
                    </div>
                  </div>
                  <div className="text-center py-2 px-1 bg-success-muted/50 rounded-md border border-success/10">
                    <div className="text-base font-semibold text-success">
                      {userData.stats.createdTasks}
                    </div>
                    <div className="text-[9px] text-success/70 leading-tight">
                      Tareas<br/>creadas
                    </div>
                  </div>
                  <div className="text-center py-2 px-1 bg-muted/50 rounded-md border border-border">
                    <div className="text-base font-semibold text-foreground">
                      {userData.stats.assignedWorkOrders}
                    </div>
                    <div className="text-[9px] text-foreground/70 leading-tight">
                      OT<br/>asignadas
                    </div>
                  </div>
                  <div className="text-center py-2 px-1 bg-warning-muted/50 rounded-md border border-warning-muted-foreground/10">
                    <div className="text-base font-semibold text-warning-muted-foreground">
                      {userData.stats.createdWorkOrders}
                    </div>
                    <div className="text-[9px] text-warning-muted-foreground/70 leading-tight">
                      OT<br/>creadas
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer fijo */}
        <div className="px-6 py-3 border-t bg-muted/30 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isCreateMode && hasChanges() && (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-warning-muted-foreground animate-pulse" />
                  <span className="text-xs text-warning-muted-foreground font-medium">Cambios sin guardar</span>
                </>
              )}
              {!isCreateMode && !hasChanges() && (
                <span className="text-xs text-muted-foreground">Sin cambios</span>
              )}
              {isCreateMode && (
                <span className="text-xs text-muted-foreground">Completa todos los campos</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 px-3 text-xs">
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !hasChanges()}
                className="h-8 px-4 text-xs"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {isCreateMode ? 'Creando...' : 'Guardando...'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Save className="h-3.5 w-3.5" />
                    {isCreateMode ? 'Crear' : 'Guardar'}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 