'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Users,
  Search,
  UserPlus,
  Loader2,
  MoreVertical,
  Shield,
  Building2,
  Mail,
  Phone,
  UserCheck,
  UserX,
  Key,
  Eye,
  Copy,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';

// Types
interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  companiesCount: number;
  subscription: {
    id: string;
    status: string;
    planId: string;
    planName: string;
  } | null;
}

interface UsersResponse {
  users: User[];
  total: number;
  hasMore: boolean;
  stats: {
    byRole: Record<string, number>;
    total: number;
  };
}

// Role config
const roleConfig: Record<string, { label: string; color: string; icon: any }> = {
  SUPERADMIN: {
    label: 'Super Admin',
    color: 'bg-red-500/10 text-red-500 border-red-500/20',
    icon: Shield,
  },
  ADMIN_ENTERPRISE: {
    label: 'Admin Empresa',
    color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    icon: Building2,
  },
  USER: {
    label: 'Usuario',
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    icon: Users,
  },
};

// Fetcher
async function fetchUsers(params: {
  search?: string;
  role?: string;
  isActive?: string;
}): Promise<UsersResponse> {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set('search', params.search);
  if (params.role && params.role !== 'all') searchParams.set('role', params.role);
  if (params.isActive && params.isActive !== 'all') searchParams.set('isActive', params.isActive);
  searchParams.set('limit', '100');

  const res = await fetch(`/api/superadmin/users?${searchParams}`);
  if (!res.ok) throw new Error('Error al obtener usuarios');
  return res.json();
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createDialog, setCreateDialog] = useState(false);
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; user: User | null }>({
    open: false,
    user: null,
  });
  const [passwordDialog, setPasswordDialog] = useState<{
    open: boolean;
    userId: number | null;
    generatedPassword: string | null;
  }>({ open: false, userId: null, generatedPassword: null });

  // Query
  const { data, isLoading } = useQuery({
    queryKey: ['users', { search, role: roleFilter, isActive: statusFilter }],
    queryFn: () => fetchUsers({ search, role: roleFilter, isActive: statusFilter }),
    refetchOnWindowFocus: false,
  });

  const users = data?.users || [];
  const stats = data?.stats;

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const res = await fetch('/api/superadmin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success('Usuario creado correctamente');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCreateDialog(false);
      if (data.generatedPassword) {
        setPasswordDialog({
          open: true,
          userId: data.user.id,
          generatedPassword: data.generatedPassword,
        });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/superadmin/users/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_active' }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/superadmin/users/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_password' }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: (data, userId) => {
      toast.success('Contrasena reseteada');
      if (data.generatedPassword) {
        setPasswordDialog({
          open: true,
          userId,
          generatedPassword: data.generatedPassword,
        });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuarios Globales</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestion de todos los usuarios del sistema
          </p>
        </div>
        <Button onClick={() => setCreateDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
                <p className="text-sm text-muted-foreground">Total Usuarios</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.byRole?.ADMIN_ENTERPRISE || 0}</p>
                <p className="text-sm text-muted-foreground">Admins Empresa</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.byRole?.USER || 0}</p>
                <p className="text-sm text-muted-foreground">Usuarios</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.byRole?.SUPERADMIN || 0}</p>
                <p className="text-sm text-muted-foreground">Super Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="SUPERADMIN">Super Admin</SelectItem>
            <SelectItem value="ADMIN_ENTERPRISE">Admin Empresa</SelectItem>
            <SelectItem value="USER">Usuario</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Activos</SelectItem>
            <SelectItem value="false">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="text-center">Empresas</TableHead>
              <TableHead>Suscripcion</TableHead>
              <TableHead>Ultimo Login</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const role = roleConfig[user.role] || roleConfig.USER;
              const RoleIcon = role.icon;

              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </div>
                        {user.phone && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {user.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('text-xs', role.color)}>
                      <RoleIcon className="h-3 w-3 mr-1" />
                      {role.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {user.companiesCount > 0 ? (
                      <Badge variant="outline">
                        <Building2 className="h-3 w-3 mr-1" />
                        {user.companiesCount}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.subscription ? (
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{user.subscription.planName}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Sin suscripcion</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.lastLogin ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(user.lastLogin), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Nunca</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {user.isActive ? (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Activo
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                        <XCircle className="h-3 w-3 mr-1" />
                        Inactivo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setDetailDialog({ open: true, user })}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalle
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            if (confirm('Resetear contrasena de este usuario?')) {
                              resetPasswordMutation.mutate(user.id);
                            }
                          }}
                        >
                          <Key className="h-4 w-4 mr-2" />
                          Resetear Contrasena
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toggleActiveMutation.mutate(user.id)}
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
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No se encontraron usuarios
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create User Dialog */}
      <CreateUserDialog
        open={createDialog}
        onClose={() => setCreateDialog(false)}
        onSubmit={(data) => createUserMutation.mutate(data)}
        loading={createUserMutation.isPending}
      />

      {/* Password Dialog */}
      <Dialog
        open={passwordDialog.open}
        onOpenChange={() => setPasswordDialog({ open: false, userId: null, generatedPassword: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contrasena Generada</DialogTitle>
            <DialogDescription>
              Guarda esta contrasena, no podras verla de nuevo.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
              <code className="flex-1 font-mono text-lg">
                {passwordDialog.generatedPassword}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(passwordDialog.generatedPassword || '')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() =>
                setPasswordDialog({ open: false, userId: null, generatedPassword: null })
              }
            >
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Detail Dialog */}
      {detailDialog.user && (
        <UserDetailDialog
          open={detailDialog.open}
          user={detailDialog.user}
          onClose={() => setDetailDialog({ open: false, user: null })}
        />
      )}
    </div>
  );
}

// Create User Dialog Component
function CreateUserDialog({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('ADMIN_ENTERPRISE');

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setRole('ADMIN_ENTERPRISE');
  };

  const handleSubmit = () => {
    if (!name || !email) {
      toast.error('Nombre y email son requeridos');
      return;
    }

    onSubmit({ name, email, phone: phone || null, role });
    resetForm();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
          resetForm();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo Usuario</DialogTitle>
          <DialogDescription>
            Crear un nuevo usuario en el sistema. Se generara una contrasena automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan Perez"
            />
          </div>

          <div className="space-y-2">
            <Label>Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@empresa.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Telefono</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+54 9 351 123 4567"
            />
          </div>

          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN_ENTERPRISE">Admin Empresa</SelectItem>
                <SelectItem value="USER">Usuario</SelectItem>
                <SelectItem value="SUPERADMIN">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onClose();
              resetForm();
            }}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Crear Usuario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// User Detail Dialog Component
function UserDetailDialog({
  open,
  user,
  onClose,
}: {
  open: boolean;
  user: User;
  onClose: () => void;
}) {
  const role = roleConfig[user.role] || roleConfig.USER;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalle de Usuario</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <span className="text-2xl font-medium">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold">{user.name}</h3>
              <Badge className={cn('text-xs', role.color)}>{role.label}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Telefono</Label>
              <p className="font-medium">{user.phone || '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Estado</Label>
              <p>
                {user.isActive ? (
                  <Badge className="bg-green-500/10 text-green-500">Activo</Badge>
                ) : (
                  <Badge className="bg-red-500/10 text-red-500">Inactivo</Badge>
                )}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Empresas</Label>
              <p className="font-medium">{user.companiesCount}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Registrado</Label>
              <p className="font-medium">
                {format(new Date(user.createdAt), 'dd/MM/yyyy', { locale: es })}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Ultimo Login</Label>
              <p className="font-medium">
                {user.lastLogin
                  ? format(new Date(user.lastLogin), 'dd/MM/yyyy HH:mm', { locale: es })
                  : 'Nunca'}
              </p>
            </div>
          </div>

          {user.subscription && (
            <div className="p-4 bg-muted rounded-lg">
              <Label className="text-muted-foreground">Suscripcion</Label>
              <div className="flex items-center gap-2 mt-1">
                <CreditCard className="h-4 w-4" />
                <span className="font-medium">{user.subscription.planName}</span>
                <Badge variant="outline" className="ml-auto">
                  {user.subscription.status}
                </Badge>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
