'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Shield,
  Search,
  Loader2,
  Users,
  ShoppingCart,
  ShoppingBag,
  Wrench,
  Calculator,
  Building2,
  Puzzle,
  Eye,
  Edit,
  Trash2,
  Plus,
  Settings,
  Lock,
  Unlock,
  FileText,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Permission {
  key: string;
  name: string;
  description: string;
  category: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  companyId: number | null;
  companyName: string | null;
  isSystem: boolean;
  usersCount: number;
  permissions: string[];
}

const categoryIcons: Record<string, any> = {
  VENTAS: ShoppingCart,
  COMPRAS: ShoppingBag,
  MANTENIMIENTO: Wrench,
  COSTOS: Calculator,
  ADMINISTRACION: Building2,
  GENERAL: Puzzle,
  USUARIOS: Users,
  REPORTES: BarChart3,
};

const categoryColors: Record<string, string> = {
  VENTAS: 'bg-info/10 text-info-muted-foreground border-info-muted/20',
  COMPRAS: 'bg-success/10 text-success border-success-muted/20',
  MANTENIMIENTO: 'bg-warning/10 text-warning-muted-foreground border-warning-muted/20',
  COSTOS: 'bg-accent-purple/10 text-accent-purple border-accent-purple/20',
  ADMINISTRACION: 'bg-muted text-muted-foreground border-border',
  GENERAL: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  USUARIOS: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  REPORTES: 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20',
};

// Datos de ejemplo
const mockPermissions: Permission[] = [
  // Ventas
  { key: 'quotes.view', name: 'Ver Cotizaciones', description: 'Permite ver cotizaciones', category: 'VENTAS' },
  { key: 'quotes.create', name: 'Crear Cotizaciones', description: 'Permite crear nuevas cotizaciones', category: 'VENTAS' },
  { key: 'quotes.edit', name: 'Editar Cotizaciones', description: 'Permite editar cotizaciones existentes', category: 'VENTAS' },
  { key: 'quotes.delete', name: 'Eliminar Cotizaciones', description: 'Permite eliminar cotizaciones', category: 'VENTAS' },
  { key: 'sales_orders.view', name: 'Ver Órdenes de Venta', description: 'Permite ver órdenes de venta', category: 'VENTAS' },
  { key: 'sales_orders.create', name: 'Crear Órdenes de Venta', description: 'Permite crear nuevas órdenes de venta', category: 'VENTAS' },
  { key: 'invoices.view', name: 'Ver Facturas', description: 'Permite ver facturas de venta', category: 'VENTAS' },
  { key: 'invoices.create', name: 'Crear Facturas', description: 'Permite crear facturas', category: 'VENTAS' },

  // Compras
  { key: 'purchase_orders.view', name: 'Ver Órdenes de Compra', description: 'Permite ver órdenes de compra', category: 'COMPRAS' },
  { key: 'purchase_orders.create', name: 'Crear Órdenes de Compra', description: 'Permite crear nuevas órdenes de compra', category: 'COMPRAS' },
  { key: 'purchase_orders.approve', name: 'Aprobar Órdenes de Compra', description: 'Permite aprobar órdenes de compra', category: 'COMPRAS' },
  { key: 'suppliers.view', name: 'Ver Proveedores', description: 'Permite ver proveedores', category: 'COMPRAS' },
  { key: 'suppliers.manage', name: 'Gestionar Proveedores', description: 'Permite crear/editar proveedores', category: 'COMPRAS' },

  // Mantenimiento
  { key: 'work_orders.view', name: 'Ver Órdenes de Trabajo', description: 'Permite ver órdenes de trabajo', category: 'MANTENIMIENTO' },
  { key: 'work_orders.create', name: 'Crear Órdenes de Trabajo', description: 'Permite crear órdenes de trabajo', category: 'MANTENIMIENTO' },
  { key: 'work_orders.complete', name: 'Completar Órdenes de Trabajo', description: 'Permite marcar órdenes como completadas', category: 'MANTENIMIENTO' },
  { key: 'machines.view', name: 'Ver Máquinas', description: 'Permite ver el listado de máquinas', category: 'MANTENIMIENTO' },
  { key: 'machines.manage', name: 'Gestionar Máquinas', description: 'Permite crear/editar máquinas', category: 'MANTENIMIENTO' },

  // Costos
  { key: 'costs.view', name: 'Ver Costos', description: 'Permite ver información de costos', category: 'COSTOS' },
  { key: 'costs.edit', name: 'Editar Costos', description: 'Permite editar costos de productos', category: 'COSTOS' },
  { key: 'margins.view', name: 'Ver Márgenes', description: 'Permite ver márgenes de rentabilidad', category: 'COSTOS' },

  // Usuarios
  { key: 'users.view', name: 'Ver Usuarios', description: 'Permite ver usuarios de la empresa', category: 'USUARIOS' },
  { key: 'users.create', name: 'Crear Usuarios', description: 'Permite crear nuevos usuarios', category: 'USUARIOS' },
  { key: 'users.edit', name: 'Editar Usuarios', description: 'Permite editar usuarios existentes', category: 'USUARIOS' },
  { key: 'roles.manage', name: 'Gestionar Roles', description: 'Permite crear y editar roles', category: 'USUARIOS' },

  // Reportes
  { key: 'reports.sales', name: 'Reportes de Ventas', description: 'Acceso a reportes de ventas', category: 'REPORTES' },
  { key: 'reports.purchases', name: 'Reportes de Compras', description: 'Acceso a reportes de compras', category: 'REPORTES' },
  { key: 'reports.maintenance', name: 'Reportes de Mantenimiento', description: 'Acceso a reportes de mantenimiento', category: 'REPORTES' },
  { key: 'reports.export', name: 'Exportar Reportes', description: 'Permite exportar reportes a Excel/PDF', category: 'REPORTES' },
];

const mockRoles: Role[] = [
  {
    id: '1',
    name: 'Administrador',
    description: 'Acceso completo a todas las funcionalidades',
    companyId: null,
    companyName: null,
    isSystem: true,
    usersCount: 5,
    permissions: mockPermissions.map(p => p.key),
  },
  {
    id: '2',
    name: 'Supervisor',
    description: 'Gestión de operaciones y personal',
    companyId: null,
    companyName: null,
    isSystem: true,
    usersCount: 12,
    permissions: mockPermissions.filter(p =>
      !p.key.includes('delete') && !p.key.includes('manage')
    ).map(p => p.key),
  },
  {
    id: '3',
    name: 'Operador',
    description: 'Acceso básico para tareas operativas',
    companyId: null,
    companyName: null,
    isSystem: true,
    usersCount: 45,
    permissions: mockPermissions.filter(p =>
      p.key.includes('view') || p.key.includes('create')
    ).map(p => p.key),
  },
  {
    id: '4',
    name: 'Vendedor',
    description: 'Gestión de ventas y clientes',
    companyId: 1,
    companyName: 'Industria ABC SA',
    isSystem: false,
    usersCount: 8,
    permissions: mockPermissions.filter(p =>
      p.category === 'VENTAS' || p.key === 'reports.sales'
    ).map(p => p.key),
  },
];

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  useEffect(() => {
    setTimeout(() => {
      setPermissions(mockPermissions);
      setRoles(mockRoles);
      setLoading(false);
    }, 500);
  }, []);

  const permissionsByCategory = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const filteredPermissions = permissions.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.key.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPermissionsByCategory = filteredPermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const stats = {
    totalPermissions: permissions.length,
    totalRoles: roles.length,
    systemRoles: roles.filter(r => r.isSystem).length,
    customRoles: roles.filter(r => !r.isSystem).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Permisos del Sistema</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestiona los permisos y roles disponibles
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-info-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalPermissions}</p>
                <p className="text-sm text-muted-foreground">Permisos Totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-accent-purple/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-accent-purple" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalRoles}</p>
                <p className="text-sm text-muted-foreground">Roles Totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                <Lock className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.systemRoles}</p>
                <p className="text-sm text-muted-foreground">Roles del Sistema</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <Unlock className="h-6 w-6 text-warning-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.customRoles}</p>
                <p className="text-sm text-muted-foreground">Roles Personalizados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="permissions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="permissions">
            Catálogo de Permisos
          </TabsTrigger>
          <TabsTrigger value="roles">
            Roles
          </TabsTrigger>
        </TabsList>

        {/* Tab: Permisos */}
        <TabsContent value="permissions" className="space-y-6">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar permisos..."
              className="pl-9"
            />
          </div>

          {Object.entries(filteredPermissionsByCategory).map(([category, categoryPerms]) => {
            const CategoryIcon = categoryIcons[category] || Puzzle;
            return (
              <Card key={category}>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className={cn("p-2 rounded-lg border", categoryColors[category])}>
                      <CategoryIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle>{category}</CardTitle>
                      <CardDescription>
                        {categoryPerms.length} permisos
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {categoryPerms.map((perm) => (
                      <div
                        key={perm.key}
                        className="flex items-start justify-between p-4 rounded-lg bg-muted/30 border"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {perm.name}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {perm.description}
                          </p>
                          <Badge variant="outline" className="text-xs mt-2 font-mono">
                            {perm.key}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Tab: Roles */}
        <TabsContent value="roles" className="space-y-6">
          <div className="flex justify-end">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Rol
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {roles.map((role) => (
              <Card key={role.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        role.isSystem ? "bg-accent-purple/10" : "bg-info/10"
                      )}>
                        <Shield className={cn(
                          "h-5 w-5",
                          role.isSystem ? "text-accent-purple" : "text-info-muted-foreground"
                        )} />
                      </div>
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {role.name}
                          {role.isSystem && (
                            <Badge className="text-xs bg-accent-purple/10 text-accent-purple border-accent-purple/20">
                              Sistema
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {role.description}
                        </CardDescription>
                      </div>
                    </div>
                    {!role.isSystem && (
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm mb-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{role.usersCount} usuarios</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Shield className="h-4 w-4" />
                        <span>{role.permissions.length} permisos</span>
                      </div>
                    </div>
                    {role.companyName && (
                      <Badge variant="outline" className="text-xs">
                        <Building2 className="h-3 w-3 mr-1" />
                        {role.companyName}
                      </Badge>
                    )}
                  </div>

                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="permissions" className="border-0">
                      <AccordionTrigger className="text-sm py-2 hover:no-underline">
                        Ver permisos asignados
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-wrap gap-1 pt-2">
                          {Object.entries(permissionsByCategory).map(([category, catPerms]) => {
                            const enabledPerms = catPerms.filter(p =>
                              role.permissions.includes(p.key)
                            );
                            if (enabledPerms.length === 0) return null;

                            return (
                              <Badge
                                key={category}
                                variant="outline"
                                className={cn("text-xs", categoryColors[category])}
                              >
                                {category}: {enabledPerms.length}/{catPerms.length}
                              </Badge>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
