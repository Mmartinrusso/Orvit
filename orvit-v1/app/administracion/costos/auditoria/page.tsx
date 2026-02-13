'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  Search, 
  Filter, 
  Download, 
  Calendar,
  User,
  Clock,
  Settings,
  FileText,
  AlertTriangle,
  CheckCircle,
  Eye,
  History
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';

interface Auditoria {
  id: number;
  usuario: string;
  accion: string;
  entidad: string;
  entidadId: number;
  valoresAnteriores: any;
  valoresNuevos: any;
  fecha: string;
  ip: string;
  userAgent: string;
}

interface Permiso {
  id: number;
  rol: string;
  permiso: string;
  descripcion: string;
  estado: 'activo' | 'inactivo';
  fechaCreacion: string;
  ultimaModificacion: string;
}

interface Trazabilidad {
  id: number;
  entidad: string;
  entidadId: number;
  accion: string;
  usuario: string;
  fecha: string;
  cambios: Cambio[];
}

interface Cambio {
  campo: string;
  valorAnterior: any;
  valorNuevo: any;
}

export default function AuditoriaPage() {
  const { currentCompany } = useCompany();
  const [isLoading, setIsLoading] = useState(true);
  const [auditoria, setAuditoria] = useState<Auditoria[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [trazabilidad, setTrazabilidad] = useState<Trazabilidad[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntidad, setSelectedEntidad] = useState('todas');
  const [selectedUsuario, setSelectedUsuario] = useState('todos');

  useEffect(() => {
    // Simular carga de datos
    const loadData = async () => {
      setIsLoading(true);
      
      // Simular delay de carga
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Datos de ejemplo
      setAuditoria([
        {
          id: 1,
          usuario: 'admin@empresa.com',
          accion: 'UPDATE',
          entidad: 'empleado',
          entidadId: 1,
          valoresAnteriores: { sueldoBasico: 150000 },
          valoresNuevos: { sueldoBasico: 165000 },
          fecha: '2024-01-15T10:30:00Z',
          ip: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        {
          id: 2,
          usuario: 'finanzas@empresa.com',
          accion: 'CREATE',
          entidad: 'insumo',
          entidadId: 15,
          valoresAnteriores: null,
          valoresNuevos: { nombre: 'Cemento Portland', precio: 850, categoria: 'Materiales Básicos' },
          fecha: '2024-01-14T14:20:00Z',
          ip: '192.168.1.101',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        {
          id: 3,
          usuario: 'rrhh@empresa.com',
          accion: 'DELETE',
          entidad: 'categoria',
          entidadId: 5,
          valoresAnteriores: { nombre: 'Categoría Obsoleta', empleados: 0 },
          valoresNuevos: null,
          fecha: '2024-01-13T09:15:00Z',
          ip: '192.168.1.102',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        {
          id: 4,
          usuario: 'admin@empresa.com',
          accion: 'UPDATE',
          entidad: 'receta',
          entidadId: 3,
          valoresAnteriores: { costoUnitario: 32.80 },
          valoresNuevos: { costoUnitario: 35.20 },
          fecha: '2024-01-12T16:45:00Z',
          ip: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      ]);
      
      setPermisos([
        {
          id: 1,
          rol: 'ADMIN',
          permiso: 'costos.full_access',
          descripcion: 'Acceso completo al módulo de costos',
          estado: 'activo',
          fechaCreacion: '2024-01-01',
          ultimaModificacion: '2024-01-15'
        },
        {
          id: 2,
          rol: 'FINANZAS',
          permiso: 'costos.read_write',
          descripcion: 'Lectura y escritura en costos',
          estado: 'activo',
          fechaCreacion: '2024-01-01',
          ultimaModificacion: '2024-01-10'
        },
        {
          id: 3,
          rol: 'RRHH',
          permiso: 'costos.laborales',
          descripcion: 'Acceso solo a costos laborales',
          estado: 'activo',
          fechaCreacion: '2024-01-01',
          ultimaModificacion: '2024-01-08'
        },
        {
          id: 4,
          rol: 'COMPRAS',
          permiso: 'costos.materia_prima',
          descripcion: 'Acceso solo a materia prima',
          estado: 'activo',
          fechaCreacion: '2024-01-01',
          ultimaModificacion: '2024-01-05'
        }
      ]);
      
      setTrazabilidad([
        {
          id: 1,
          entidad: 'empleado',
          entidadId: 1,
          accion: 'Historial completo',
          usuario: 'admin@empresa.com',
          fecha: '2024-01-15',
          cambios: [
            { campo: 'sueldoBasico', valorAnterior: 150000, valorNuevo: 165000 },
            { campo: 'categoria', valorAnterior: 'Oficial', valorNuevo: 'Oficial' },
            { campo: 'estado', valorAnterior: 'activo', valorNuevo: 'activo' }
          ]
        },
        {
          id: 2,
          entidad: 'insumo',
          entidadId: 15,
          accion: 'Creación',
          usuario: 'finanzas@empresa.com',
          fecha: '2024-01-14',
          cambios: [
            { campo: 'nombre', valorAnterior: null, valorNuevo: 'Cemento Portland' },
            { campo: 'precio', valorAnterior: null, valorNuevo: 850 },
            { campo: 'categoria', valorAnterior: null, valorNuevo: 'Materiales Básicos' }
          ]
        }
      ]);
      
      setIsLoading(false);
    };
    
    loadData();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAccionBadge = (accion: string) => {
    switch (accion) {
      case 'CREATE':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Crear</Badge>;
      case 'UPDATE':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Actualizar</Badge>;
      case 'DELETE':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Eliminar</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">{accion}</Badge>;
    }
  };

  const getEstadoBadge = (estado: 'activo' | 'inactivo') => {
    return estado === 'activo' 
      ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Activo</Badge>
      : <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Inactivo</Badge>;
  };

  const getEntidadBadge = (entidad: string) => {
    const entidades = {
      'empleado': { label: 'Empleado', color: 'bg-blue-100 text-blue-800' },
      'insumo': { label: 'Insumo', color: 'bg-orange-100 text-orange-800' },
      'categoria': { label: 'Categoría', color: 'bg-purple-100 text-purple-800' },
      'receta': { label: 'Receta', color: 'bg-green-100 text-green-800' },
      'servicio': { label: 'Servicio', color: 'bg-red-100 text-red-800' }
    };
    
    const entidadInfo = entidades[entidad as keyof typeof entidades] || { label: entidad, color: 'bg-gray-100 text-gray-800' };
    
    return <Badge className={entidadInfo.color}>{entidadInfo.label}</Badge>;
  };

  const filteredAuditoria = auditoria.filter(item => {
    const matchesSearch = item.usuario.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.accion.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.entidad.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEntidad = selectedEntidad === 'todas' || item.entidad === selectedEntidad;
    const matchesUsuario = selectedUsuario === 'todos' || item.usuario === selectedUsuario;
    return matchesSearch && matchesEntidad && matchesUsuario;
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Auditoría</h1>
            <p className="text-muted-foreground">
              Historial de cambios, permisos y trazabilidad
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button>
              <Eye className="h-4 w-4 mr-2" />
              Ver Reporte
            </Button>
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Registros</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{auditoria.length}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Registros de auditoría</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Set(auditoria.map(a => a.usuario)).size}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Usuarios únicos</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Permisos</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{permisos.length}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Settings className="h-4 w-4" />
              <span>Permisos configurados</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Actividad</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15/01/2024</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Hace 2 días</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principales */}
      <Tabs defaultValue="auditoria" className="space-y-4">
        <TabsList>
          <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
          <TabsTrigger value="permisos">Permisos</TabsTrigger>
          <TabsTrigger value="trazabilidad">Trazabilidad</TabsTrigger>
        </TabsList>

        <TabsContent value="auditoria" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Auditoría</CardTitle>
              <CardDescription>Registro completo de todas las acciones realizadas</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="flex items-center space-x-4 mb-6">
                <div className="flex-1">
                  <Label htmlFor="search">Buscar</Label>
                  <Input
                    id="search"
                    placeholder="Usuario, acción o entidad..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="entidad">Entidad</Label>
                  <select
                    id="entidad"
                    value={selectedEntidad}
                    onChange={(e) => setSelectedEntidad(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="todas">Todas las entidades</option>
                    <option value="empleado">Empleado</option>
                    <option value="insumo">Insumo</option>
                    <option value="categoria">Categoría</option>
                    <option value="receta">Receta</option>
                    <option value="servicio">Servicio</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="usuario">Usuario</Label>
                  <select
                    id="usuario"
                    value={selectedUsuario}
                    onChange={(e) => setSelectedUsuario(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="todos">Todos los usuarios</option>
                    {Array.from(new Set(auditoria.map(a => a.usuario))).map(usuario => (
                      <option key={usuario} value={usuario}>{usuario}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tabla de auditoría */}
              <div className="space-y-4">
                {filteredAuditoria.map((item) => (
                  <div key={item.id} className="border rounded-lg">
                    <div className="flex items-center justify-between p-4 border-b">
                      <div className="flex items-center space-x-4">
                        <div>
                          <div className="font-medium">{item.usuario}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(item.fecha)} • IP: {item.ip}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="font-medium">ID: {item.entidadId}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.entidad}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getEntidadBadge(item.entidad)}
                          {getAccionBadge(item.accion)}
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="text-sm font-medium mb-2">Cambios:</div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {item.valoresAnteriores && Object.entries(item.valoresAnteriores).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="font-medium">{key}:</span>
                            <span className="text-muted-foreground">
                              {value !== null ? String(value) : 'null'} → {item.valoresNuevos?.[key] !== null ? String(item.valoresNuevos[key]) : 'null'}
                            </span>
                          </div>
                        ))}
                        {!item.valoresAnteriores && item.valoresNuevos && Object.entries(item.valoresNuevos).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="font-medium">{key}:</span>
                            <span className="text-muted-foreground">
                              null → {value !== null ? String(value) : 'null'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permisos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Permisos</CardTitle>
              <CardDescription>Gestión de permisos por rol</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {permisos.map((permiso) => (
                  <div key={permiso.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">{permiso.permiso}</div>
                        <div className="text-sm text-muted-foreground">
                          {permiso.descripcion} • Rol: {permiso.rol}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Creado: {formatDate(permiso.fechaCreacion)} • Última modificación: {formatDate(permiso.ultimaModificacion)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      {getEstadoBadge(permiso.estado)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trazabilidad" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trazabilidad de Entidades</CardTitle>
              <CardDescription>Historial completo de cambios por entidad</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trazabilidad.map((item) => (
                  <div key={item.id} className="border rounded-lg">
                    <div className="flex items-center justify-between p-4 border-b">
                      <div className="flex items-center space-x-4">
                        <div>
                          <div className="font-medium">{item.entidad} #{item.entidadId}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.accion} • {item.usuario} • {formatDate(item.fecha)}
                          </div>
                        </div>
                      </div>
                      {getEntidadBadge(item.entidad)}
                    </div>
                    <div className="p-4">
                      <div className="text-sm font-medium mb-2">Cambios realizados:</div>
                      <div className="space-y-2">
                        {item.cambios.map((cambio, index) => (
                          <div key={index} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                            <span className="font-medium">{cambio.campo}:</span>
                            <span className="text-muted-foreground">
                              {cambio.valorAnterior !== null ? String(cambio.valorAnterior) : 'null'} → {cambio.valorNuevo !== null ? String(cambio.valorNuevo) : 'null'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 