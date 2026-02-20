'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Upload, 
  Eye, 
  EyeOff,
  Save,
  X
} from 'lucide-react';

interface UserProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: number;
}

interface UserData {
  id: number;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: string;
  companies?: any[];
  stats?: {
    assignedTasks: number;
    createdTasks: number;
    assignedWorkOrders: number;
    createdWorkOrders: number;
  };
}

export default function UserProfileDialog({ isOpen, onClose, userId }: UserProfileDialogProps) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  // Estados para los formularios
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
  });
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const targetUserId = userId || parseInt(currentUser?.id || '0');
  const isOwnProfile = targetUserId === parseInt(currentUser?.id || '0');

  useEffect(() => {
    if (isOpen && targetUserId) {
      fetchUserData();
    }
  }, [isOpen, targetUserId]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${targetUserId}`);
      if (response.ok) {
        const data = await response.json();
        setUserData(data.user);
        setProfileForm({
          name: data.user.name || '',
          email: data.user.email || '',
          phone: data.user.phone || '',
        });
        setAvatarPreview(data.user.avatar);
      } else {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los datos del usuario',
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
      setLoading(false);
    }
  };

  const handleProfileSave = async () => {
    setSaving(true);
    try {
      const updateData: any = {
        name: profileForm.name,
        email: profileForm.email,
        phone: profileForm.phone,
      };

      if (avatarFile) {
        // Aquí podrías implementar upload de imagen a S3 o similar
        // Por ahora solo guardamos la información
      }

      const response = await fetch(`/api/users/${targetUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        toast({
          title: 'Perfil actualizado',
          description: 'Los datos del perfil se han actualizado correctamente',
        });
        fetchUserData(); // Refrescar datos
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Error al actualizar el perfil',
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

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Las contraseñas no coinciden',
        variant: 'destructive',
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'La contraseña debe tener al menos 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/users/${targetUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword: passwordForm.newPassword,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Contraseña actualizada',
          description: 'La contraseña se ha cambiado correctamente',
        });
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Error al cambiar la contraseña',
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

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: 'Error',
          description: 'El archivo debe ser menor a 5MB',
          variant: 'destructive',
        });
        return;
      }

      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPERADMIN': return 'bg-destructive/10 text-destructive';
      case 'ADMIN': return 'bg-info-muted text-info-muted-foreground';
      case 'SUPERVISOR': return 'bg-success-muted text-success';
      default: return 'bg-muted text-muted-foreground';
    }
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

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent size="md">
          <div className="flex items-center justify-center p-6">
            <div className="text-muted-foreground">Cargando perfil...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {isOwnProfile ? 'Mi Perfil' : `Perfil de ${userData?.name}`}
          </DialogTitle>
          <DialogDescription>
            {isOwnProfile 
              ? 'Gestiona tu información personal y configuración'
              : 'Ver y editar información del usuario'
            }
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        {userData && (
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="profile">Perfil</TabsTrigger>
              <TabsTrigger value="security">Seguridad</TabsTrigger>
              <TabsTrigger value="activity">Actividad</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Información Personal</CardTitle>
                  <CardDescription>
                    Actualiza tu información personal y foto de perfil
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Avatar */}
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={avatarPreview || userData.avatar} />
                      <AvatarFallback className="text-lg">
                        {userData.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                      <Label htmlFor="avatar">Foto de perfil</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="avatar"
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarChange}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('avatar')?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Cambiar foto
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Información básica */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre completo</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="name"
                          value={profileForm.name}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                          className="pl-10"
                          placeholder="Tu nombre completo"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          value={profileForm.email}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                          className="pl-10"
                          placeholder="tu@email.com"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="pl-10"
                        placeholder="+54 9 11 1234-5678"
                      />
                    </div>
                  </div>

                  {/* Información de solo lectura */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label>Rol</Label>
                      <div className={cn('px-3 py-2 rounded-md text-sm font-medium', getRoleBadgeColor(userData.role))}>
                        {getRoleLabel(userData.role)}
                      </div>
                    </div>
                    
                    {userData.companies && userData.companies.length > 0 && (
                      <div className="space-y-2">
                        <Label>Empresa</Label>
                        <div className="text-sm text-muted-foreground">
                          {userData.companies.map(c => c.name).join(', ')}
                        </div>
                      </div>
                    )}
                  </div>

                  <Button 
                    onClick={handleProfileSave} 
                    disabled={saving}
                    className="w-full"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cambiar Contraseña</CardTitle>
                  <CardDescription>
                    Actualiza tu contraseña para mantener tu cuenta segura
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nueva contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                        className="pl-10 pr-10"
                        placeholder="Mínimo 6 caracteres"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="pl-10"
                        placeholder="Repite la nueva contraseña"
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={handlePasswordChange} 
                    disabled={saving || !passwordForm.newPassword}
                    className="w-full"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    {saving ? 'Actualizando...' : 'Cambiar contraseña'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Estadísticas de Actividad</CardTitle>
                  <CardDescription>
                    Resumen de actividad en el sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {userData.stats && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-info-muted rounded-lg">
                        <div className="text-2xl font-bold text-info-muted-foreground">
                          {userData.stats.assignedTasks}
                        </div>
                        <div className="text-sm text-info-muted-foreground">
                          Tareas asignadas
                        </div>
                      </div>

                      <div className="text-center p-4 bg-success-muted rounded-lg">
                        <div className="text-2xl font-bold text-success">
                          {userData.stats.createdTasks}
                        </div>
                        <div className="text-sm text-success">
                          Tareas creadas
                        </div>
                      </div>

                      <div className="text-center p-4 bg-muted rounded-lg">
                        <div className="text-2xl font-bold text-foreground">
                          {userData.stats.assignedWorkOrders}
                        </div>
                        <div className="text-sm text-foreground">
                          Órdenes asignadas
                        </div>
                      </div>

                      <div className="text-center p-4 bg-warning-muted rounded-lg">
                        <div className="text-2xl font-bold text-warning-muted-foreground">
                          {userData.stats.createdWorkOrders}
                        </div>
                        <div className="text-sm text-warning-muted-foreground">
                          Órdenes creadas
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 