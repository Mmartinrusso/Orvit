'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export default function DebugPermissionsPage() {
  const { user, loading, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();
  const { currentCompany, currentArea, currentSector } = useCompany();

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-center">No hay usuario autenticado</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Lista de permisos críticos para verificar
  const criticalPermissions = [
    // Navegación - Áreas
    'ingresar_administracion',
    'ingresar_mantenimiento',
    'ingresar_produccion',
    
    // Mantenimiento - Navegación
    'ordenes_de_trabajo',
    'mantenimientos',
    'maquinas_mantenimiento',
    'unidades_moviles',
    'puestos_trabajo',
    'panol',
    'historial_mantenimiento',
    'reportes_mantenimiento',
    
    // Mantenimiento - Acciones
    'crear_mantenimiento',
    'editar_mantenimiento',
    'eliminar_mantenimiento',
    'duplicar_mantenimiento',
    'ejecucion_mantenimiento',
    
    // Administración - Navegación
    'ingresar_dashboard_administracion',
    'ingresar_tareas',
    'ingresar_permisos',
    'ingresar_usuarios',
    'ingresar_reportes',
    'ingresar_configuracion',
    
    // Administración - Módulos
    'ventas',
    'costos',
    'produccion',
    'personal',
    'compras',
    'cargas',
    
    // Ventas
    'ventas_dashboard',
    'clientes',
    'productos',
    'cotizaciones',
    'ventas_modulo',
    
    // Costos
    'ingresar_costos',
    'ver_costos',
    'editar_costos',
    
    // Producción
    'ingresar_dashboard_produccion',
    'maquinas_produccion',
    'vehiculos_produccion',
    
    // Agenda
    'ver_agenda',
    'ver_historial',
    'ver_estadisticas',
    
    // Otros importantes
    'gestionar_usuarios',
    'admin.permissions',
    'admin.roles',
  ];

  const permissionResults = criticalPermissions.map(perm => ({
    permission: perm,
    hasAccess: hasPermission(perm)
  }));

  const granted = permissionResults.filter(r => r.hasAccess);
  const denied = permissionResults.filter(r => !r.hasAccess);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold mb-2">🔐 Debug de Permisos</h1>
        <p className="text-gray-600">Diagnóstico del sistema de permisos optimizado</p>
      </div>

      {/* Información del Usuario */}
      <Card>
        <CardHeader>
          <CardTitle>👤 Información del Usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">ID</p>
              <p className="font-mono">{user.id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Nombre</p>
              <p className="font-semibold">{user.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-mono">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Rol</p>
              <Badge className="text-sm">{user.role}</Badge>
            </div>
            <div>
              <p className="text-sm text-gray-600">Sector ID</p>
              <p className="font-mono">{user.sectorId || 'null'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Permisos Cargados</p>
              <p className="font-bold text-2xl">{user.permissions?.length || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Información de Contexto */}
      <Card>
        <CardHeader>
          <CardTitle>🏢 Contexto Actual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Empresa</p>
              <p className="font-semibold">{currentCompany?.name || 'No seleccionada'}</p>
              <p className="text-xs text-gray-500">ID: {currentCompany?.id || 'null'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Área</p>
              <p className="font-semibold">{currentArea?.name || 'No seleccionada'}</p>
              <p className="text-xs text-gray-500">ID: {currentArea?.id || 'null'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Sector</p>
              <p className="font-semibold">{currentSector?.name || 'No seleccionado'}</p>
              <p className="text-xs text-gray-500">ID: {currentSector?.id || 'null'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen de Permisos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{granted.length}</p>
              <p className="text-sm text-gray-600">Permisos Concedidos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{denied.length}</p>
              <p className="text-sm text-gray-600">Permisos Denegados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{user.permissions?.length || 0}</p>
              <p className="text-sm text-gray-600">Total en Memoria</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Permisos Críticos Verificados */}
      <Card>
        <CardHeader>
          <CardTitle>🔍 Permisos Críticos Verificados ({criticalPermissions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {permissionResults.map(({ permission, hasAccess }) => (
              <div
                key={permission}
                className={`flex items-center gap-2 p-3 rounded-lg border ${
                  hasAccess
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                {hasAccess ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                )}
                <span className={`font-mono text-sm ${hasAccess ? 'text-green-900' : 'text-red-900'}`}>
                  {permission}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Todos los Permisos en Memoria */}
      <Card>
        <CardHeader>
          <CardTitle>📦 Todos los Permisos en Memoria ({user.permissions?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {user.permissions && user.permissions.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-96 overflow-y-auto">
              {user.permissions.map((perm) => (
                <div
                  key={perm}
                  className="px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm font-mono"
                >
                  {perm}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="font-bold text-red-600">⚠️ NO HAY PERMISOS CARGADOS</p>
              <p className="text-sm text-gray-600 mt-2">
                El array de permisos está vacío. Esto causa que todos los elementos del sidebar 
                y botones se oculten.
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Verifica que `/api/auth/me` esté devolviendo el campo `permissions` correctamente.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test de Helpers */}
      <Card>
        <CardHeader>
          <CardTitle>🧪 Test de Helpers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
              <code className="flex-1">hasPermission('ingresar_mantenimiento')</code>
              <Badge variant={hasPermission('ingresar_mantenimiento') ? 'default' : 'destructive'}>
                {String(hasPermission('ingresar_mantenimiento'))}
              </Badge>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
              <code className="flex-1">hasAnyPermission(['ventas', 'costos', 'produccion'])</code>
              <Badge variant={hasAnyPermission(['ventas', 'costos', 'produccion']) ? 'default' : 'destructive'}>
                {String(hasAnyPermission(['ventas', 'costos', 'produccion']))}
              </Badge>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
              <code className="flex-1">hasAllPermissions(['ingresar_mantenimiento', 'ingresar_administracion'])</code>
              <Badge variant={hasAllPermissions(['ingresar_mantenimiento', 'ingresar_administracion']) ? 'default' : 'destructive'}>
                {String(hasAllPermissions(['ingresar_mantenimiento', 'ingresar_administracion']))}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Información Técnica */}
      <Card>
        <CardHeader>
          <CardTitle>🔧 Información Técnica</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>AuthContext loading:</strong> {String(loading)}</p>
            <p><strong>User object exists:</strong> {String(!!user)}</p>
            <p><strong>Permissions array exists:</strong> {String(!!user?.permissions)}</p>
            <p><strong>Permissions is Array:</strong> {String(Array.isArray(user?.permissions))}</p>
            <p><strong>Permissions length:</strong> {user?.permissions?.length || 0}</p>
            <p><strong>Rol es ADMIN/SUPERADMIN:</strong> {String(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN')}</p>
          </div>
          
          <div className="mt-4 p-4 bg-gray-100 rounded font-mono text-xs overflow-auto max-h-64">
            <pre>{JSON.stringify({ user, currentCompany, currentArea, currentSector }, null, 2)}</pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

