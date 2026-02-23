'use client';

import { formatNumber } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Users,
  Plus, 
  Search, 
  Filter, 
  Download, 
  Upload,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  UserPlus,
  Settings,
  X,
  Calculator
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';

interface Empleado {
  id: number;
  nombre: string;
  apellido: string;
  categoria: string;
  sueldoBasico: number;
  adicionales: number;
  cargasSociales: number;
  costoTotal: number;
  estado: 'activo' | 'inactivo';
  fechaIngreso: string;
  ultimoAumento: string;
}

interface Categoria {
  id: number;
  nombre: string;
  sueldoBasico: number;
  empleados: number;
  costoTotal: number;
}

interface Aumento {
  id: number;
  empleado: string;
  categoria: string;
  porcentaje: number;
  monto: number;
  fecha: string;
  motivo: string;
  realizadoPor: string;
}

interface AsignacionCosto {
  id: number;
  producto: string;
  categoria: string;
  porcentaje: number;
  costoAsignado: number;
  fechaCreacion: string;
  activo: boolean;
}

interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  costoActual: number;
}

export default function CostosLaboralesPage() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [aumentos, setAumentos] = useState<Aumento[]>([]);
  const [asignaciones, setAsignaciones] = useState<AsignacionCosto[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('todas');
  const [activeTab, setActiveTab] = useState('empleados');
  const [searchAumentos, setSearchAumentos] = useState('');
  
  // Estados para modales
  const [isEmpleadoModalOpen, setIsEmpleadoModalOpen] = useState(false);
  const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false);
  const [isAumentoModalOpen, setIsAumentoModalOpen] = useState(false);
  const [isEditEmpleadoModalOpen, setIsEditEmpleadoModalOpen] = useState(false);
  const [isEditCategoriaModalOpen, setIsEditCategoriaModalOpen] = useState(false);
  const [isAumentoDetailModalOpen, setIsAumentoDetailModalOpen] = useState(false);
  const [isAsignacionModalOpen, setIsAsignacionModalOpen] = useState(false);
  const [isEditAsignacionModalOpen, setIsEditAsignacionModalOpen] = useState(false);
  
  // Estados para formularios
  const [nuevoEmpleado, setNuevoEmpleado] = useState({
    nombre: '',
    apellido: '',
    categoria: '',
    sueldoBasico: 0,
    adicionales: 0,
    fechaIngreso: new Date().toISOString().split('T')[0]
  });
  
  const [editingEmpleado, setEditingEmpleado] = useState<Empleado | null>(null);
  const [editEmpleadoData, setEditEmpleadoData] = useState({
    nombre: '',
    apellido: '',
    sueldoBasico: 0
  });
  
  const [nuevaCategoria, setNuevaCategoria] = useState({
    nombre: ''
  });
  
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [selectedAumento, setSelectedAumento] = useState<Aumento | null>(null);
  
  const [nuevoAumento, setNuevoAumento] = useState({
    tipo: 'empleado' as 'empleado' | 'categoria',
    empleado: '',
    categoria: '',
    porcentaje: '',
    motivo: '',
    fecha: new Date().toISOString().split('T')[0],
    realizadoPor: ''
  });

  const [nuevaAsignacion, setNuevaAsignacion] = useState({
    producto: '',
    categoria: '',
    porcentaje: ''
  });

  const [editingAsignacion, setEditingAsignacion] = useState<AsignacionCosto | null>(null);

  useEffect(() => {
    // Simular carga de datos
    const loadData = async () => {
      setIsLoading(true);
      
      // Simular delay de carga
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Datos de ejemplo
      setEmpleados([
        {
          id: 1,
          nombre: 'Juan',
          apellido: 'Pérez',
          categoria: 'Oficial',
          sueldoBasico: 150000,
          adicionales: 25000,
          cargasSociales: 52500,
          costoTotal: 227500,
          estado: 'activo',
          fechaIngreso: '2023-01-15',
          ultimoAumento: '2024-01-01'
        },
        {
          id: 2,
          nombre: 'María',
          apellido: 'González',
          categoria: 'Medio Oficial',
          sueldoBasico: 120000,
          adicionales: 20000,
          cargasSociales: 42000,
          costoTotal: 182000,
          estado: 'activo',
          fechaIngreso: '2023-03-20',
          ultimoAumento: '2024-01-01'
        },
        {
          id: 3,
          nombre: 'Carlos',
          apellido: 'López',
          categoria: 'Ayudante',
          sueldoBasico: 90000,
          adicionales: 15000,
          cargasSociales: 31500,
          costoTotal: 136500,
          estado: 'activo',
          fechaIngreso: '2023-06-10',
          ultimoAumento: '2024-01-01'
        }
      ]);
      
      setCategorias([
        {
          id: 1,
          nombre: 'Oficial',
          sueldoBasico: 150000,
          empleados: 15,
          costoTotal: 3412500
        },
        {
          id: 2,
          nombre: 'Medio Oficial',
          sueldoBasico: 120000,
          empleados: 20,
          costoTotal: 3640000
        },
        {
          id: 3,
          nombre: 'Ayudante',
          sueldoBasico: 90000,
          empleados: 10,
          costoTotal: 1365000
        }
      ]);
      
      setAumentos([
        {
          id: 1,
          empleado: 'Juan Pérez',
          categoria: 'Oficial',
          porcentaje: 15,
          monto: 19500,
          fecha: '2024-01-01',
          motivo: 'Aumento general',
          realizadoPor: 'Juan Carlos Rodríguez'
        },
        {
          id: 2,
          empleado: 'María González',
          categoria: 'Medio Oficial',
          porcentaje: 12,
          monto: 14400,
          fecha: '2024-01-01',
          motivo: 'Aumento general',
          realizadoPor: 'Ana María Silva'
        }
      ]);

      // Datos de ejemplo para productos
      setProductos([
        {
          id: 1,
          nombre: 'Bloque 20x20x40',
          categoria: 'Bloques',
          costoActual: 45.50
        },
        {
          id: 2,
          nombre: 'Vigueta 12x20',
          categoria: 'Viguetas',
          costoActual: 125.80
        },
        {
          id: 3,
          nombre: 'Adoquín 20x20x6',
          categoria: 'Adoquines',
          costoActual: 28.90
        }
      ]);

      // Datos de ejemplo para asignaciones
      setAsignaciones([
        {
          id: 1,
          producto: 'Bloque 20x20x40',
          categoria: 'Bloques',
          porcentaje: 30,
          costoAsignado: 682500, // 30% del costo total laboral
          fechaCreacion: '2024-01-01',
          activo: true
        },
        {
          id: 2,
          producto: 'Vigueta 12x20',
          categoria: 'Viguetas',
          porcentaje: 70,
          costoAsignado: 1592500, // 70% del costo total laboral
          fechaCreacion: '2024-01-01',
          activo: true
        }
      ]);
      
      setIsLoading(false);
    };
    
    loadData();
  }, [user]); // Agregar user como dependencia para que se actualice cuando cambie

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR');
  };

  const getEstadoBadge = (estado: 'activo' | 'inactivo') => {
    return estado === 'activo' 
      ? <Badge className="bg-success-muted text-success hover:bg-success-muted">Activo</Badge>
      : <Badge className="bg-muted text-foreground hover:bg-muted">Inactivo</Badge>;
  };

  const filteredEmpleados = empleados.filter(empleado => {
    const matchesSearch = `${empleado.nombre} ${empleado.apellido}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = selectedCategoria === 'todas' || empleado.categoria === selectedCategoria;
    return matchesSearch && matchesCategoria;
  });

  const filteredAumentos = aumentos.filter(aumento => {
    const matchesSearch = aumento.empleado.toLowerCase().includes(searchAumentos.toLowerCase()) ||
                         aumento.categoria.toLowerCase().includes(searchAumentos.toLowerCase()) ||
                         aumento.motivo.toLowerCase().includes(searchAumentos.toLowerCase()) ||
                         aumento.realizadoPor.toLowerCase().includes(searchAumentos.toLowerCase());
    return matchesSearch;
  });

  const totalCostoLaboral = empleados.reduce((sum, emp) => sum + emp.costoTotal, 0);

  const handleCreateEmpleado = () => {
    const nuevoId = Math.max(...empleados.map(e => e.id)) + 1;
    const cargasSociales = nuevoEmpleado.sueldoBasico * 0.35; // 35% de cargas sociales
    const costoTotal = nuevoEmpleado.sueldoBasico + nuevoEmpleado.adicionales + cargasSociales;
    
    const empleado: Empleado = {
      id: nuevoId,
      nombre: nuevoEmpleado.nombre,
      apellido: nuevoEmpleado.apellido,
      categoria: nuevoEmpleado.categoria,
      sueldoBasico: nuevoEmpleado.sueldoBasico,
      adicionales: nuevoEmpleado.adicionales,
      cargasSociales,
      costoTotal,
      estado: 'activo',
      fechaIngreso: nuevoEmpleado.fechaIngreso,
      ultimoAumento: new Date().toISOString().split('T')[0]
    };
    
    setEmpleados([...empleados, empleado]);
    setIsEmpleadoModalOpen(false);
    setNuevoEmpleado({ nombre: '', apellido: '', categoria: '', sueldoBasico: 0, adicionales: 0, fechaIngreso: '' });
  };

  const handleCreateCategoria = () => {
    const nuevoId = Math.max(...categorias.map(c => c.id)) + 1;
    const categoria: Categoria = {
      id: nuevoId,
      nombre: nuevaCategoria.nombre,
      sueldoBasico: 0, // Default to 0, will be updated later
      empleados: 0,
      costoTotal: 0
    };
    
    setCategorias([...categorias, categoria]);
    setIsCategoriaModalOpen(false);
    setNuevaCategoria({ nombre: '' });
  };

  const handleEditCategoria = (categoria: Categoria) => {
    setEditingCategoria(categoria);
    setNuevaCategoria({ nombre: categoria.nombre });
    setIsEditCategoriaModalOpen(true);
  };

  const handleUpdateCategoria = () => {
    if (!editingCategoria) return;

    const oldNombre = editingCategoria.nombre;
    const newNombre = nuevaCategoria.nombre;

    // Actualizar la categoría
    const updatedCategoria = {
      ...editingCategoria,
      nombre: newNombre
    };

    setCategorias(categorias.map(c => c.id === editingCategoria.id ? updatedCategoria : c));

    // Actualizar todos los empleados que pertenecen a esta categoría
    setEmpleados(empleados.map(emp => 
      emp.categoria === oldNombre 
        ? { ...emp, categoria: newNombre }
        : emp
    ));

    setEditingCategoria(null);
    setIsEditCategoriaModalOpen(false);
    setNuevaCategoria({ nombre: '' });
  };

  const handleCreateAumento = () => {
    const nuevoId = Math.max(...aumentos.map(a => a.id)) + 1;
    const porcentaje = parseFloat(nuevoAumento.porcentaje) || 0;
    
    let empleadoNombre = '';
    let categoriaNombre = '';
    let monto = 0;
    
    if (nuevoAumento.tipo === 'empleado') {
      empleadoNombre = nuevoAumento.empleado;
      const empleado = empleados.find(e => `${e.nombre} ${e.apellido}` === nuevoAumento.empleado);
      categoriaNombre = empleado?.categoria || '';
      monto = empleado ? (empleado.sueldoBasico * porcentaje) / 100 : 0;
    } else {
      empleadoNombre = 'Categoría completa';
      categoriaNombre = nuevoAumento.categoria;
      const empleadosCategoria = empleados.filter(e => e.categoria === nuevoAumento.categoria);
      monto = empleadosCategoria.reduce((sum, emp) => sum + (emp.sueldoBasico * porcentaje) / 100, 0);
    }
    
    const aumento: Aumento = {
      id: nuevoId,
      empleado: empleadoNombre,
      categoria: categoriaNombre,
      porcentaje,
      monto,
      fecha: nuevoAumento.fecha,
      motivo: nuevoAumento.motivo,
      realizadoPor: user?.name || 'Usuario' // Usar el usuario actual
    };
    
    setAumentos([...aumentos, aumento]);
    setIsAumentoModalOpen(false);
    setNuevoAumento({ tipo: 'empleado', empleado: '', categoria: '', porcentaje: '', motivo: '', fecha: new Date().toISOString().split('T')[0], realizadoPor: '' });
  };

  const handleEditEmpleado = (empleado: Empleado) => {
    setEditingEmpleado(empleado);
    setEditEmpleadoData({
      nombre: empleado.nombre,
      apellido: empleado.apellido,
      sueldoBasico: empleado.sueldoBasico
    });
    setIsEditEmpleadoModalOpen(true);
  };

  const handleUpdateEmpleado = () => {
    if (!editingEmpleado) return;

    const cargasSociales = editEmpleadoData.sueldoBasico * 0.35;
    const costoTotal = editEmpleadoData.sueldoBasico + editingEmpleado.adicionales + cargasSociales;

    const updatedEmpleado: Empleado = {
      ...editingEmpleado,
      nombre: editEmpleadoData.nombre,
      apellido: editEmpleadoData.apellido,
      sueldoBasico: editEmpleadoData.sueldoBasico,
      cargasSociales,
      costoTotal
    };

    setEmpleados(empleados.map(emp => emp.id === editingEmpleado.id ? updatedEmpleado : emp));
    setIsEditEmpleadoModalOpen(false);
    setEditingEmpleado(null);
    setEditEmpleadoData({ nombre: '', apellido: '', sueldoBasico: 0 });
  };

  const handleViewAumento = (aumento: Aumento) => {
    setSelectedAumento(aumento);
    setIsAumentoDetailModalOpen(true);
  };

  const handleCreateAsignacion = () => {
    const nuevoId = Math.max(...asignaciones.map(a => a.id)) + 1;
    const porcentaje = parseFloat(nuevaAsignacion.porcentaje) || 0;
    const costoAsignado = (totalCostoLaboral * porcentaje) / 100;
    
    const asignacion: AsignacionCosto = {
      id: nuevoId,
      producto: nuevaAsignacion.producto,
      categoria: nuevaAsignacion.categoria,
      porcentaje,
      costoAsignado,
      fechaCreacion: new Date().toISOString().split('T')[0],
      activo: true
    };
    
    setAsignaciones([...asignaciones, asignacion]);
    setIsAsignacionModalOpen(false);
    setNuevaAsignacion({ producto: '', categoria: '', porcentaje: '' });
  };

  const handleEditAsignacion = (asignacion: AsignacionCosto) => {
    setEditingAsignacion(asignacion);
    setNuevaAsignacion({
      producto: asignacion.producto,
      categoria: asignacion.categoria,
      porcentaje: asignacion.porcentaje.toString()
    });
    setIsEditAsignacionModalOpen(true);
  };

  const handleUpdateAsignacion = () => {
    if (!editingAsignacion) return;

    const porcentaje = parseFloat(nuevaAsignacion.porcentaje) || 0;
    const costoAsignado = (totalCostoLaboral * porcentaje) / 100;

    const updatedAsignacion: AsignacionCosto = {
      ...editingAsignacion,
      producto: nuevaAsignacion.producto,
      categoria: nuevaAsignacion.categoria,
      porcentaje,
      costoAsignado
    };

    setAsignaciones(asignaciones.map(a => a.id === editingAsignacion.id ? updatedAsignacion : a));
    setIsEditAsignacionModalOpen(false);
    setEditingAsignacion(null);
    setNuevaAsignacion({ producto: '', categoria: '', porcentaje: '' });
  };

  const getButtonText = () => {
    switch (activeTab) {
      case 'empleados':
        return 'Nuevo Empleado';
      case 'categorias':
        return 'Nueva Categoría';
      case 'aumentos':
        return 'Nuevo Aumento';
      case 'asignacion':
        return 'Nueva Asignación';
      case 'reportes':
        return null; // No mostrar botón en reportes
      default:
        return 'Nuevo';
    }
  };

  const handleButtonClick = () => {
    switch (activeTab) {
      case 'empleados':
        setIsEmpleadoModalOpen(true);
        break;
      case 'categorias':
        setIsCategoriaModalOpen(true);
        break;
      case 'aumentos':
        setIsAumentoModalOpen(true);
        break;
      case 'asignacion':
        setIsAsignacionModalOpen(true);
        break;
      case 'reportes':
        // No hacer nada en reportes
        break;
    }
  };

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
            <h1 className="text-3xl font-bold tracking-tight">Costos Laborales</h1>
            <p className="text-muted-foreground">
              Gestión de empleados, categorías, sueldos y cargas sociales
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            {getButtonText() && (
              <Button onClick={handleButtonClick}>
                <Plus className="h-4 w-4 mr-2" />
                {getButtonText()}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Empleados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{empleados.length}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Empleados activos</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo Total Mensual</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCostoLaboral)}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-success" />
              <span>+3.1% vs mes anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorías</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categorias.length}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Settings className="h-4 w-4" />
              <span>Categorías activas</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Últimos Aumentos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aumentos.length}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Este mes</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="empleados">Empleados</TabsTrigger>
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="aumentos">Aumentos</TabsTrigger>
          <TabsTrigger value="asignacion">Asignación</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
        </TabsList>

        <TabsContent value="empleados" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Empleados</CardTitle>
              <CardDescription>Gestión completa de empleados y sus costos</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="flex items-center space-x-4 mb-6">
                <div className="flex-1">
                  <Label htmlFor="search">Buscar empleado</Label>
                  <Input
                    id="search"
                    placeholder="Nombre o apellido..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="categoria">Categoría</Label>
                  <select
                    id="categoria"
                    value={selectedCategoria}
                    onChange={(e) => setSelectedCategoria(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="todas">Todas las categorías</option>
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tabla de empleados */}
              <div className="space-y-4">
                {filteredEmpleados.map((empleado) => (
                  <div 
                    key={empleado.id} 
                    className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors duration-200"
                    onClick={() => handleEditEmpleado(empleado)}
                  >
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">{empleado.nombre} {empleado.apellido}</div>
                        <div className="text-sm text-muted-foreground">
                          {empleado.categoria} • Ingreso: {formatDate(empleado.fechaIngreso)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(empleado.costoTotal)}/mes</div>
                        <div className="text-sm text-muted-foreground">
                          Básico: {formatCurrency(empleado.sueldoBasico)}
                        </div>
                      </div>
                      {getEstadoBadge(empleado.estado)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categorias" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Categorías de Empleados</CardTitle>
              <CardDescription>Configuración de categorías</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categorias.map((categoria) => (
                  <div 
                    key={categoria.id} 
                    className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors duration-200"
                    onClick={() => handleEditCategoria(categoria)}
                  >
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">{categoria.nombre}</div>
                        <div className="text-sm text-muted-foreground">
                          {categoria.empleados} empleados
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(categoria.costoTotal)}</div>
                        <div className="text-sm text-muted-foreground">Costo total</div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aumentos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Aumentos</CardTitle>
              <CardDescription>Registro de aumentos salariales por empleado o categoría</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtros para aumentos */}
              <div className="flex items-center space-x-4 mb-6">
                <div className="flex-1">
                  <Label htmlFor="searchAumentos">Buscar aumentos</Label>
                  <Input
                    id="searchAumentos"
                    placeholder="Empleado, categoría, motivo o realizado por..."
                    value={searchAumentos}
                    onChange={(e) => setSearchAumentos(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {filteredAumentos.map((aumento) => (
                  <div 
                    key={aumento.id} 
                    className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors duration-200"
                    onClick={() => handleViewAumento(aumento)}
                  >
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">{aumento.empleado}</div>
                        <div className="text-sm text-muted-foreground">
                          {aumento.categoria} • {aumento.motivo} • Realizado por: {aumento.realizadoPor}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-medium">+{aumento.porcentaje}%</div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(aumento.monto)}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(aumento.fecha)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="asignacion" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Asignación de Costos Laborales</CardTitle>
              <CardDescription>
                Distribuir los costos laborales totales entre diferentes productos según porcentajes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Resumen de distribución */}
              <div className="mb-6 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Resumen de Distribución</h3>
                  <Badge className="bg-info-muted text-info-muted-foreground hover:bg-info-muted">
                    {asignaciones.reduce((sum, a) => sum + a.porcentaje, 0)}% asignado
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Costo total laboral:</span>
                    <div className="font-medium">{formatCurrency(totalCostoLaboral)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Costo asignado:</span>
                    <div className="font-medium">{formatCurrency(asignaciones.reduce((sum, a) => sum + a.costoAsignado, 0))}</div>
                  </div>
                </div>
                {asignaciones.reduce((sum, a) => sum + a.porcentaje, 0) !== 100 && (
                  <div className="mt-2 p-2 bg-warning-muted border border-warning-muted rounded text-warning-muted-foreground text-sm">
                    ⚠️ El total de porcentajes asignados debe ser 100%. Actualmente: {asignaciones.reduce((sum, a) => sum + a.porcentaje, 0)}%
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {asignaciones.map((asignacion) => (
                  <div 
                    key={asignacion.id} 
                    className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors duration-200"
                    onClick={() => handleEditAsignacion(asignacion)}
                  >
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">{asignacion.producto}</div>
                        <div className="text-sm text-muted-foreground">
                          {asignacion.categoria} • {asignacion.porcentaje}% del costo laboral
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(asignacion.costoAsignado)}</div>
                        <div className="text-sm text-muted-foreground">
                          {asignacion.porcentaje}% de {formatCurrency(totalCostoLaboral)}
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {asignaciones.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay asignaciones configuradas</p>
                    <p className="text-sm">Haz clic en &quot;Nueva Asignación&quot; para comenzar</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reportes" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Análisis de Costos</CardTitle>
                <CardDescription>Distribución de costos por categoría</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categorias.map((categoria) => {
                    const porcentaje = (categoria.costoTotal / totalCostoLaboral) * 100;
                    return (
                      <div key={categoria.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full bg-primary"></div>
                          <span className="text-sm font-medium">{categoria.nombre}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{formatCurrency(categoria.costoTotal)}</div>
                          <div className="text-xs text-muted-foreground">{formatNumber(porcentaje, 1)}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Asignación por Producto</CardTitle>
                <CardDescription>Distribución de costos laborales por producto</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {asignaciones.length > 0 ? (
                    asignaciones.map((asignacion) => (
                      <div key={asignacion.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full bg-success"></div>
                          <span className="text-sm font-medium">{asignacion.producto}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{formatCurrency(asignacion.costoAsignado)}</div>
                          <div className="text-xs text-muted-foreground">{asignacion.porcentaje}%</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-sm">No hay asignaciones configuradas</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Alertas y Notificaciones</CardTitle>
              <CardDescription>Estado actual del sistema de costos laborales</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
                  <span>3 empleados sin aumento este año</span>
                </div>
                <Badge className="bg-warning-muted text-warning-muted-foreground hover:bg-warning-muted">Atención</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Costos laborales estables</span>
                </div>
                <Badge className="bg-success-muted text-success hover:bg-success-muted">OK</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-info-muted-foreground" />
                  <span>Próximo aumento general en 2 meses</span>
                </div>
                <Badge className="bg-info-muted text-info-muted-foreground hover:bg-info-muted">Programado</Badge>
              </div>
              {asignaciones.reduce((sum, a) => sum + a.porcentaje, 0) !== 100 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
                    <span>Distribución de costos incompleta ({asignaciones.reduce((sum, a) => sum + a.porcentaje, 0)}%)</span>
                  </div>
                  <Badge className="bg-warning-muted text-warning-muted-foreground hover:bg-warning-muted">Incompleto</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Nuevo Empleado */}
      <Dialog open={isEmpleadoModalOpen} onOpenChange={setIsEmpleadoModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nuevo Empleado</DialogTitle>
            <DialogDescription>
              Agregar un nuevo empleado al sistema de costos laborales
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  value={nuevoEmpleado.nombre}
                  onChange={(e) => setNuevoEmpleado({...nuevoEmpleado, nombre: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apellido">Apellido</Label>
                <Input
                  id="apellido"
                  value={nuevoEmpleado.apellido}
                  onChange={(e) => setNuevoEmpleado({...nuevoEmpleado, apellido: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría</Label>
              <Select value={nuevoEmpleado.categoria} onValueChange={(value) => setNuevoEmpleado({...nuevoEmpleado, categoria: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.nombre}>{cat.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sueldoBasico">Sueldo Básico</Label>
                <Input
                  id="sueldoBasico"
                  type="number"
                  value={nuevoEmpleado.sueldoBasico}
                  onChange={(e) => setNuevoEmpleado({...nuevoEmpleado, sueldoBasico: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adicionales">Adicionales</Label>
                <Input
                  id="adicionales"
                  type="number"
                  value={nuevoEmpleado.adicionales}
                  onChange={(e) => setNuevoEmpleado({...nuevoEmpleado, adicionales: Number(e.target.value)})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaIngreso">Fecha de Ingreso</Label>
              <DatePicker
                value={nuevoEmpleado.fechaIngreso}
                onChange={(date) => setNuevoEmpleado({...nuevoEmpleado, fechaIngreso: date})}
                placeholder="Seleccionar fecha"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmpleadoModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateEmpleado}>
              Crear Empleado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Nueva Categoría */}
      <Dialog open={isCategoriaModalOpen} onOpenChange={setIsCategoriaModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nueva Categoría</DialogTitle>
            <DialogDescription>
              Crear una nueva categoría de empleados
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombreCategoria">Nombre de la Categoría</Label>
              <Input
                id="nombreCategoria"
                value={nuevaCategoria.nombre}
                onChange={(e) => setNuevaCategoria({...nuevaCategoria, nombre: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoriaModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateCategoria}>
              Crear Categoría
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Categoría */}
      <Dialog open={isEditCategoriaModalOpen} onOpenChange={setIsEditCategoriaModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Editar Categoría: {editingCategoria?.nombre}</DialogTitle>
            <DialogDescription>
              Modificar los detalles de la categoría y ver los empleados asignados
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombreCategoriaEdit">Nombre de la Categoría</Label>
              <Input
                id="nombreCategoriaEdit"
                value={nuevaCategoria.nombre}
                onChange={(e) => setNuevaCategoria({...nuevaCategoria, nombre: e.target.value})}
              />
            </div>
            
            {/* Lista de empleados de la categoría */}
            <div className="space-y-2">
              <Label>Empleados en esta categoría</Label>
              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                {editingCategoria && empleados.filter(emp => emp.categoria === editingCategoria.nombre).length > 0 ? (
                  <div className="space-y-2">
                    {empleados
                      .filter(emp => emp.categoria === editingCategoria.nombre)
                      .map((empleado) => (
                        <div key={empleado.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <div className="font-medium">{empleado.nombre} {empleado.apellido}</div>
                            <div className="text-sm text-muted-foreground">
                              Sueldo: {formatCurrency(empleado.sueldoBasico)} • Ingreso: {formatDate(empleado.fechaIngreso)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">{formatCurrency(empleado.costoTotal)}/mes</div>
                            <div className="text-xs text-muted-foreground">Costo total</div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    No hay empleados asignados a esta categoría
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditCategoriaModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateCategoria}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Nuevo Aumento */}
      <Dialog open={isAumentoModalOpen} onOpenChange={setIsAumentoModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nuevo Aumento</DialogTitle>
            <DialogDescription>
              Registrar un nuevo aumento salarial
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tipoAumento">Tipo de Aumento</Label>
              <Select value={nuevoAumento.tipo} onValueChange={(value) => setNuevoAumento({...nuevoAumento, tipo: value as 'empleado' | 'categoria'})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="empleado">Empleado Individual</SelectItem>
                  <SelectItem value="categoria">Categoría Completa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {nuevoAumento.tipo === 'empleado' && (
              <div className="space-y-2">
                <Label htmlFor="empleadoAumento">Empleado</Label>
                <Select value={nuevoAumento.empleado} onValueChange={(value) => setNuevoAumento({...nuevoAumento, empleado: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    {empleados.map((emp) => (
                      <SelectItem key={emp.id} value={`${emp.nombre} ${emp.apellido}`}>
                        {emp.nombre} {emp.apellido} - {emp.categoria}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {nuevoAumento.tipo === 'categoria' && (
              <div className="space-y-2">
                <Label htmlFor="categoriaAumento">Categoría</Label>
                <Select value={nuevoAumento.categoria} onValueChange={(value) => setNuevoAumento({...nuevoAumento, categoria: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((cat) => (
                      <SelectItem key={cat.id} value={cat.nombre}>{cat.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="porcentaje">Porcentaje (%)</Label>
                <Input
                  id="porcentaje"
                  type="number"
                  placeholder="0"
                  value={nuevoAumento.porcentaje}
                  onChange={(e) => setNuevoAumento({...nuevoAumento, porcentaje: e.target.value})}
                  onFocus={(e) => {
                    if (e.target.value === '0') {
                      e.target.select();
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaAumento">Fecha</Label>
                <DatePicker
                  value={nuevoAumento.fecha}
                  onChange={(date) => setNuevoAumento({...nuevoAumento, fecha: date})}
                  placeholder="Seleccionar fecha"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo</Label>
              <Textarea
                id="motivo"
                value={nuevoAumento.motivo}
                onChange={(e) => setNuevoAumento({...nuevoAumento, motivo: e.target.value})}
                placeholder="Descripción del motivo del aumento..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="realizadoPor">Realizado por</Label>
              <Input
                id="realizadoPor"
                value={user?.name || 'Usuario no identificado'}
                disabled
                className="bg-muted"
                placeholder="Cargando usuario..."
              />
              <p className="text-xs text-muted-foreground">
                Este campo se llena automáticamente con tu nombre de usuario
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAumentoModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateAumento}>
              Realizar Aumento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Empleado */}
      <Dialog open={isEditEmpleadoModalOpen} onOpenChange={setIsEditEmpleadoModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Empleado: {editingEmpleado?.nombre} {editingEmpleado?.apellido}</DialogTitle>
            <DialogDescription>
              Modificar los detalles del empleado
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombreEdit">Nombre</Label>
                <Input
                  id="nombreEdit"
                  value={editEmpleadoData.nombre}
                  onChange={(e) => setEditEmpleadoData({...editEmpleadoData, nombre: e.target.value})}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('apellidoEdit')?.focus();
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apellidoEdit">Apellido</Label>
                <Input
                  id="apellidoEdit"
                  value={editEmpleadoData.apellido}
                  onChange={(e) => setEditEmpleadoData({...editEmpleadoData, apellido: e.target.value})}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('sueldoBasicoEdit')?.focus();
                    }
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sueldoBasicoEdit">Sueldo Básico</Label>
              <Input
                id="sueldoBasicoEdit"
                type="number"
                placeholder="0"
                value={editEmpleadoData.sueldoBasico}
                onChange={(e) => setEditEmpleadoData({...editEmpleadoData, sueldoBasico: Number(e.target.value)})}
                onFocus={(e) => {
                  if (e.target.value === '0') {
                    e.target.select();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleUpdateEmpleado();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditEmpleadoModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateEmpleado}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalles del Aumento */}
      <Dialog open={isAumentoDetailModalOpen} onOpenChange={setIsAumentoDetailModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Detalles del Aumento</DialogTitle>
            <DialogDescription>
              Información completa del aumento salarial
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {selectedAumento && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Empleado/Categoría</Label>
                    <div className="text-sm font-medium">{selectedAumento.empleado}</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Categoría</Label>
                    <div className="text-sm font-medium">{selectedAumento.categoria}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Porcentaje de Aumento</Label>
                    <div className="text-sm font-medium text-success">+{selectedAumento.porcentaje}%</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Monto del Aumento</Label>
                    <div className="text-sm font-medium">{formatCurrency(selectedAumento.monto)}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Fecha</Label>
                  <div className="text-sm font-medium">{formatDate(selectedAumento.fecha)}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Realizado por</Label>
                  <div className="text-sm font-medium">{selectedAumento.realizadoPor}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Motivo</Label>
                  <div className="text-sm p-3 bg-muted rounded-lg">
                    {selectedAumento.motivo}
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAumentoDetailModalOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Nueva Asignación */}
      <Dialog open={isAsignacionModalOpen} onOpenChange={setIsAsignacionModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nueva Asignación de Costo Laboral</DialogTitle>
            <DialogDescription>
              Asignar un porcentaje de los costos laborales a un producto
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="productoAsignacion">Producto</Label>
              <Select value={nuevaAsignacion.producto} onValueChange={(value) => setNuevaAsignacion({...nuevaAsignacion, producto: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {productos.map((prod) => (
                    <SelectItem key={prod.id} value={prod.nombre}>{prod.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoriaAsignacion">Categoría</Label>
              <Select value={nuevaAsignacion.categoria} onValueChange={(value) => setNuevaAsignacion({...nuevaAsignacion, categoria: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.nombre}>{cat.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="porcentajeAsignacion">Porcentaje (%)</Label>
              <Input
                id="porcentajeAsignacion"
                type="number"
                placeholder="0"
                value={nuevaAsignacion.porcentaje}
                onChange={(e) => setNuevaAsignacion({...nuevaAsignacion, porcentaje: e.target.value})}
                onFocus={(e) => {
                  if (e.target.value === '0') {
                    e.target.select();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateAsignacion();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Porcentaje del costo laboral total que se asignará a este producto
              </p>
            </div>
            {nuevaAsignacion.porcentaje && (
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="text-sm font-medium">Costo que se asignará:</div>
                <div className="text-lg font-semibold text-success">
                  {formatCurrency((totalCostoLaboral * parseFloat(nuevaAsignacion.porcentaje)) / 100)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {nuevaAsignacion.porcentaje}% de {formatCurrency(totalCostoLaboral)}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAsignacionModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateAsignacion}
              disabled={!nuevaAsignacion.producto || !nuevaAsignacion.categoria || !nuevaAsignacion.porcentaje}
            >
              Crear Asignación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Asignación */}
      <Dialog open={isEditAsignacionModalOpen} onOpenChange={setIsEditAsignacionModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Asignación: {editingAsignacion?.producto}</DialogTitle>
            <DialogDescription>
              Modificar el porcentaje de asignación del producto
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="productoAsignacionEdit">Producto</Label>
              <Select value={nuevaAsignacion.producto} onValueChange={(value) => setNuevaAsignacion({...nuevaAsignacion, producto: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {productos.map((prod) => (
                    <SelectItem key={prod.id} value={prod.nombre}>{prod.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoriaAsignacionEdit">Categoría</Label>
              <Select value={nuevaAsignacion.categoria} onValueChange={(value) => setNuevaAsignacion({...nuevaAsignacion, categoria: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.nombre}>{cat.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="porcentajeAsignacionEdit">Porcentaje (%)</Label>
              <Input
                id="porcentajeAsignacionEdit"
                type="number"
                placeholder="0"
                value={nuevaAsignacion.porcentaje}
                onChange={(e) => setNuevaAsignacion({...nuevaAsignacion, porcentaje: e.target.value})}
                onFocus={(e) => {
                  if (e.target.value === '0') {
                    e.target.select();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleUpdateAsignacion();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Porcentaje del costo laboral total que se asignará a este producto
              </p>
            </div>
            {nuevaAsignacion.porcentaje && (
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="text-sm font-medium">Costo que se asignará:</div>
                <div className="text-lg font-semibold text-success">
                  {formatCurrency((totalCostoLaboral * parseFloat(nuevaAsignacion.porcentaje)) / 100)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {nuevaAsignacion.porcentaje}% de {formatCurrency(totalCostoLaboral)}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditAsignacionModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdateAsignacion}
              disabled={!nuevaAsignacion.producto || !nuevaAsignacion.categoria || !nuevaAsignacion.porcentaje}
            >
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 