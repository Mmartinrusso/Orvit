'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Zap, 
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
  Settings,
  BarChart3,
  FileText,
  Edit,
  History,
  BarChart
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';

interface Servicio {
  id: number;
  nombre: string;
  categoria: string;
  tipo: 'fijo' | 'variable';
  costoMensual: number;
  costoAnterior: number;
  variacion: number;
  proveedor: string;
  frecuencia: string;
  estado: 'ok' | 'warning' | 'danger';
  ultimaActualizacion: string;
  asignacion: string;
  descripcion?: string;
}

interface CategoriaServicio {
  id: number;
  nombre: string;
  servicios: number;
  costoTotal: number;
  variacion: number;
}

interface ProveedorServicio {
  id: number;
  nombre: string;
  servicios: number;
  costoTotal: number;
  rating: number;
}

interface HistorialCosto {
  id: number;
  servicio: string;
  servicioId: number;
  costo: number;
  costoAnterior: number;
  fecha: string;
  mes: string; // Formato: "2024-01", "2024-02", etc.
  motivo: string;
  realizadoPor: string;
  variacionPorcentual: number;
}

interface EstadisticasServicio {
  servicioId: number;
  servicioNombre: string;
  costoPromedio: number;
  costoMaximo: number;
  costoMinimo: number;
  variacionPromedio: number;
  ultimaActualizacion: string;
}

interface NuevoCosto {
  servicioId: number;
  servicioNombre: string;
  costo: number;
  mes: string;
  motivo: string;
}

export default function ServiciosPage() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [categorias, setCategorias] = useState<CategoriaServicio[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorServicio[]>([]);
  const [historial, setHistorial] = useState<HistorialCosto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('todas');
  const [selectedTipo, setSelectedTipo] = useState('todos');
  const [activeTab, setActiveTab] = useState('servicios');

  // Estados para modales
  const [isServicioModalOpen, setIsServicioModalOpen] = useState(false);
  const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false);
  const [isProveedorModalOpen, setIsProveedorModalOpen] = useState(false);
  const [isEditServicioModalOpen, setIsEditServicioModalOpen] = useState(false);
  const [isEditCategoriaModalOpen, setIsEditCategoriaModalOpen] = useState(false);
  const [isEditProveedorModalOpen, setIsEditProveedorModalOpen] = useState(false);
  const [isHistorialModalOpen, setIsHistorialModalOpen] = useState(false);
  const [isEstadisticasModalOpen, setIsEstadisticasModalOpen] = useState(false);

  // Estados para formularios
  const [nuevoServicio, setNuevoServicio] = useState({
    nombre: '',
    categoria: '',
    tipo: 'fijo' as 'fijo' | 'variable',
    costoMensual: 0,
    proveedor: '',
    frecuencia: 'Mensual',
    asignacion: 'Porcentaje fijo',
    descripcion: ''
  });

  const [nuevaCategoria, setNuevaCategoria] = useState({
    nombre: ''
  });

  const [nuevoProveedor, setNuevoProveedor] = useState({
    nombre: '',
    rating: 5
  });

  const [editingServicio, setEditingServicio] = useState<Servicio | null>(null);
  const [editingCategoria, setEditingCategoria] = useState<CategoriaServicio | null>(null);
  const [editingProveedor, setEditingProveedor] = useState<ProveedorServicio | null>(null);
  const [editServicioData, setEditServicioData] = useState({
    nombre: '',
    categoria: '',
    tipo: 'fijo' as 'fijo' | 'variable',
    costoMensual: 0,
    proveedor: '',
    frecuencia: 'Mensual',
    asignacion: 'Porcentaje fijo',
    descripcion: ''
  });

  const [editCategoriaData, setEditCategoriaData] = useState({
    nombre: ''
  });

  const [editProveedorData, setEditProveedorData] = useState({
    nombre: '',
    rating: 5
  });

  const [nuevoCosto, setNuevoCosto] = useState<NuevoCosto>({
    servicioId: 0,
    servicioNombre: '',
    costo: 0,
    mes: new Date().toISOString().slice(0, 7), // Formato: "2024-01"
    motivo: ''
  });

  const [selectedServicioForHistorial, setSelectedServicioForHistorial] = useState<Servicio | null>(null);
  const [estadisticasServicio, setEstadisticasServicio] = useState<EstadisticasServicio | null>(null);

  useEffect(() => {
    // Simular carga de datos
    const loadData = async () => {
      setIsLoading(true);
      
      // Simular delay de carga
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Datos de ejemplo
      setServicios([
        {
          id: 1,
          nombre: 'Electricidad',
          categoria: 'Energía',
          tipo: 'variable',
          costoMensual: 85000,
          costoAnterior: 78000,
          variacion: 8.97,
          proveedor: 'EDESUR',
          frecuencia: 'Mensual',
          estado: 'warning',
          ultimaActualizacion: '2024-01-15',
          asignacion: 'Por tiempo de máquina'
        },
        {
          id: 2,
          nombre: 'Gas Natural',
          categoria: 'Energía',
          tipo: 'variable',
          costoMensual: 45000,
          costoAnterior: 46000,
          variacion: -2.17,
          proveedor: 'Metrogas',
          frecuencia: 'Mensual',
          estado: 'ok',
          ultimaActualizacion: '2024-01-10',
          asignacion: 'Por m²'
        },
        {
          id: 3,
          nombre: 'Mantenimiento Preventivo',
          categoria: 'Mantenimiento',
          tipo: 'fijo',
          costoMensual: 32000,
          costoAnterior: 28500,
          variacion: 12.28,
          proveedor: 'Servicios Técnicos SRL',
          frecuencia: 'Mensual',
          estado: 'danger',
          ultimaActualizacion: '2024-01-08',
          asignacion: 'Porcentaje fijo'
        },
        {
          id: 4,
          nombre: 'Alquiler',
          categoria: 'Inmobiliario',
          tipo: 'fijo',
          costoMensual: 150000,
          costoAnterior: 150000,
          variacion: 0,
          proveedor: 'Inmobiliaria del Sur',
          frecuencia: 'Mensual',
          estado: 'ok',
          ultimaActualizacion: '2024-01-01',
          asignacion: 'Porcentaje fijo'
        },
        {
          id: 5,
          nombre: 'Transporte',
          categoria: 'Logística',
          tipo: 'variable',
          costoMensual: 28000,
          costoAnterior: 25000,
          variacion: 12,
          proveedor: 'Transportes Rápidos',
          frecuencia: 'Mensual',
          estado: 'warning',
          ultimaActualizacion: '2024-01-12',
          asignacion: 'Por unidades producidas'
        }
      ]);
      
      setCategorias([
        {
          id: 1,
          nombre: 'Energía',
          servicios: 2,
          costoTotal: 130000,
          variacion: 4.8
        },
        {
          id: 2,
          nombre: 'Mantenimiento',
          servicios: 1,
          costoTotal: 32000,
          variacion: 12.3
        },
        {
          id: 3,
          nombre: 'Inmobiliario',
          servicios: 1,
          costoTotal: 150000,
          variacion: 0
        },
        {
          id: 4,
          nombre: 'Logística',
          servicios: 1,
          costoTotal: 28000,
          variacion: 12
        }
      ]);
      
      setProveedores([
        {
          id: 1,
          nombre: 'EDESUR',
          servicios: 1,
          costoTotal: 85000,
          rating: 4.2
        },
        {
          id: 2,
          nombre: 'Metrogas',
          servicios: 1,
          costoTotal: 45000,
          rating: 4.5
        },
        {
          id: 3,
          nombre: 'Servicios Técnicos SRL',
          servicios: 1,
          costoTotal: 32000,
          rating: 4.8
        },
        {
          id: 4,
          nombre: 'Inmobiliaria del Sur',
          servicios: 1,
          costoTotal: 150000,
          rating: 4.0
        }
      ]);
      
      setHistorial([
        {
          id: 1,
          servicio: 'Electricidad',
          servicioId: 1,
          costo: 85000,
          costoAnterior: 78000,
          fecha: '2024-01-15',
          mes: '2024-01',
          motivo: 'Aumento tarifario',
          realizadoPor: 'Usuario1',
          variacionPorcentual: 8.97
        },
        {
          id: 2,
          servicio: 'Mantenimiento Preventivo',
          servicioId: 3,
          costo: 32000,
          costoAnterior: 28500,
          fecha: '2024-01-08',
          mes: '2024-01',
          motivo: 'Nuevo contrato',
          realizadoPor: 'Usuario2',
          variacionPorcentual: 12.28
        },
        {
          id: 3,
          servicio: 'Transporte',
          servicioId: 5,
          costo: 28000,
          costoAnterior: 25000,
          fecha: '2024-01-12',
          mes: '2024-01',
          motivo: 'Incremento combustible',
          realizadoPor: 'Usuario1',
          variacionPorcentual: 12
        }
      ]);
      
      setIsLoading(false);
    };
    
    loadData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR');
  };

  const getEstadoBadge = (estado: 'ok' | 'warning' | 'danger') => {
    switch (estado) {
      case 'ok':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">OK</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Atención</Badge>;
      case 'danger':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Crítico</Badge>;
    }
  };

  const getVariacionIcon = (variacion: number) => {
    if (variacion > 0) {
      return <TrendingUp className="h-4 w-4 text-red-500" />;
    } else if (variacion < 0) {
      return <TrendingDown className="h-4 w-4 text-green-500" />;
    } else {
      return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTipoBadge = (tipo: 'fijo' | 'variable') => {
    return tipo === 'fijo' 
      ? <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Fijo</Badge>
      : <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Variable</Badge>;
  };

  // Funciones para manejar modales
  const handleCreateServicio = () => {
    if (!nuevoServicio.nombre || !nuevoServicio.categoria || !nuevoServicio.proveedor) return;
    
    const newServicio: Servicio = {
      id: Math.max(...servicios.map(s => s.id)) + 1,
      nombre: nuevoServicio.nombre,
      categoria: nuevoServicio.categoria,
      tipo: nuevoServicio.tipo,
      costoMensual: nuevoServicio.costoMensual,
      costoAnterior: nuevoServicio.costoMensual,
      variacion: 0,
      proveedor: nuevoServicio.proveedor,
      frecuencia: nuevoServicio.frecuencia,
      estado: 'ok',
      ultimaActualizacion: new Date().toISOString().split('T')[0],
      asignacion: nuevoServicio.asignacion,
      descripcion: nuevoServicio.descripcion
    };

    setServicios([...servicios, newServicio]);
    setNuevoServicio({
      nombre: '',
      categoria: '',
      tipo: 'fijo',
      costoMensual: 0,
      proveedor: '',
      frecuencia: 'Mensual',
      asignacion: 'Porcentaje fijo',
      descripcion: ''
    });
    setIsServicioModalOpen(false);
  };

  const handleCreateCategoria = () => {
    if (!nuevaCategoria.nombre) return;
    
    const newCategoria: CategoriaServicio = {
      id: Math.max(...categorias.map(c => c.id)) + 1,
      nombre: nuevaCategoria.nombre,
      servicios: 0,
      costoTotal: 0,
      variacion: 0
    };

    setCategorias([...categorias, newCategoria]);
    setNuevaCategoria({ nombre: '' });
    setIsCategoriaModalOpen(false);
  };

  const handleCreateProveedor = () => {
    if (!nuevoProveedor.nombre) return;
    
    const newProveedor: ProveedorServicio = {
      id: Math.max(...proveedores.map(p => p.id)) + 1,
      nombre: nuevoProveedor.nombre,
      servicios: 0,
      costoTotal: 0,
      rating: nuevoProveedor.rating
    };

    setProveedores([...proveedores, newProveedor]);
    setNuevoProveedor({ nombre: '', rating: 5 });
    setIsProveedorModalOpen(false);
  };

  const handleEditServicio = (servicio: Servicio) => {
    setEditingServicio(servicio);
    setNuevoCosto({
      servicioId: servicio.id,
      servicioNombre: servicio.nombre,
      costo: servicio.costoMensual,
      mes: new Date().toISOString().slice(0, 7),
      motivo: ''
    });
    setIsEditServicioModalOpen(true);
  };

  const handleUpdateServicio = () => {
    if (!editingServicio) return;
    
    const oldCosto = editingServicio.costoMensual;
    const newCosto = editServicioData.costoMensual;
    const variacion = oldCosto !== 0 ? ((newCosto - oldCosto) / oldCosto) * 100 : 0;
    
    const updatedServicio: Servicio = {
      ...editingServicio,
      nombre: editServicioData.nombre,
      categoria: editServicioData.categoria,
      tipo: editServicioData.tipo,
      costoMensual: newCosto,
      costoAnterior: oldCosto,
      variacion: variacion,
      proveedor: editServicioData.proveedor,
      frecuencia: editServicioData.frecuencia,
      asignacion: editServicioData.asignacion,
      descripcion: editServicioData.descripcion,
      ultimaActualizacion: new Date().toISOString().split('T')[0]
    };

    setServicios(servicios.map(s => s.id === editingServicio.id ? updatedServicio : s));
    
    // Agregar al historial si el costo cambió
    if (oldCosto !== newCosto) {
      const newHistorialItem: HistorialCosto = {
        id: Math.max(...historial.map(h => h.id)) + 1,
        servicio: editServicioData.nombre,
        servicioId: editingServicio.id,
        costo: newCosto,
        costoAnterior: oldCosto,
        fecha: new Date().toISOString().split('T')[0],
        mes: new Date().toISOString().split('-')[0] + '-' + new Date().toISOString().split('-')[1],
        motivo: 'Actualización de costo',
        realizadoPor: user?.name || 'Usuario',
        variacionPorcentual: variacion
      };
      setHistorial([newHistorialItem, ...historial]);
    }

    setEditingServicio(null);
    setIsEditServicioModalOpen(false);
    setEditServicioData({
      nombre: '',
      categoria: '',
      tipo: 'fijo',
      costoMensual: 0,
      proveedor: '',
      frecuencia: 'Mensual',
      asignacion: 'Porcentaje fijo',
      descripcion: ''
    });
  };

  const handleEditCategoria = (categoria: CategoriaServicio) => {
    setEditingCategoria(categoria);
    setEditCategoriaData({ nombre: categoria.nombre });
    setIsEditCategoriaModalOpen(true);
  };

  const handleUpdateCategoria = () => {
    if (!editingCategoria) return;
    
    const oldNombre = editingCategoria.nombre;
    const newNombre = editCategoriaData.nombre;
    
    const updatedCategoria: CategoriaServicio = {
      ...editingCategoria,
      nombre: newNombre
    };

    setCategorias(categorias.map(c => c.id === editingCategoria.id ? updatedCategoria : c));
    
    // Actualizar servicios que usan esta categoría
    setServicios(servicios.map(servicio =>
      servicio.categoria === oldNombre
        ? { ...servicio, categoria: newNombre }
        : servicio
    ));

    setEditingCategoria(null);
    setIsEditCategoriaModalOpen(false);
    setEditCategoriaData({ nombre: '' });
  };

  const handleEditProveedor = (proveedor: ProveedorServicio) => {
    setEditingProveedor(proveedor);
    setEditProveedorData({ nombre: proveedor.nombre, rating: proveedor.rating });
    setIsEditProveedorModalOpen(true);
  };

  const handleUpdateProveedor = () => {
    if (!editingProveedor) return;
    
    const oldNombre = editingProveedor.nombre;
    const newNombre = editProveedorData.nombre;
    const newRating = editProveedorData.rating;
    
    const updatedProveedor: ProveedorServicio = {
      ...editingProveedor,
      nombre: newNombre,
      rating: newRating
    };

    setProveedores(proveedores.map(p => p.id === editingProveedor.id ? updatedProveedor : p));
    
    // Actualizar servicios que usan este proveedor
    setServicios(servicios.map(servicio =>
      servicio.proveedor === oldNombre
        ? { ...servicio, proveedor: newNombre }
        : servicio
    ));

    setEditingProveedor(null);
    setIsEditProveedorModalOpen(false);
    setEditProveedorData({ nombre: '', rating: 5 });
  };

  const handleViewHistorial = (servicio: Servicio) => {
    setSelectedServicioForHistorial(servicio);
    setIsHistorialModalOpen(true);
  };

  const handleViewEstadisticas = (servicio: Servicio) => {
    const historialServicio = historial.filter(h => h.servicioId === servicio.id);
    const costos = historialServicio.map(h => h.costo);
    const costoPromedio = costos.length > 0 ? costos.reduce((a, b) => a + b, 0) / costos.length : servicio.costoMensual;
    const costoMaximo = costos.length > 0 ? Math.max(...costos) : servicio.costoMensual;
    const costoMinimo = costos.length > 0 ? Math.min(...costos) : servicio.costoMensual;
    const variacionPromedio = historialServicio.length > 0 
      ? historialServicio.reduce((sum, h) => sum + h.variacionPorcentual, 0) / historialServicio.length 
      : 0;

    setEstadisticasServicio({
      servicioId: servicio.id,
      servicioNombre: servicio.nombre,
      costoPromedio,
      costoMaximo,
      costoMinimo,
      variacionPromedio,
      ultimaActualizacion: servicio.ultimaActualizacion
    });
    setIsEstadisticasModalOpen(true);
  };

  const handleRegisterCosto = () => {
    if (!editingServicio || !nuevoCosto.costo || !nuevoCosto.motivo) return;
    
    const oldCosto = editingServicio.costoMensual;
    const newCosto = nuevoCosto.costo;
    const variacion = oldCosto !== 0 ? ((newCosto - oldCosto) / oldCosto) * 100 : 0;
    
    // Actualizar el servicio con el nuevo costo
    const updatedServicio: Servicio = {
      ...editingServicio,
      costoMensual: newCosto,
      costoAnterior: oldCosto,
      variacion: variacion,
      ultimaActualizacion: new Date().toISOString().split('T')[0]
    };

    setServicios(servicios.map(s => s.id === editingServicio.id ? updatedServicio : s));
    
    // Agregar al historial
    const newHistorialItem: HistorialCosto = {
      id: Math.max(...historial.map(h => h.id)) + 1,
      servicio: editingServicio.nombre,
      servicioId: editingServicio.id,
      costo: newCosto,
      costoAnterior: oldCosto,
      fecha: new Date().toISOString().split('T')[0],
      mes: nuevoCosto.mes,
      motivo: nuevoCosto.motivo,
      realizadoPor: user?.name || 'Usuario',
      variacionPorcentual: variacion
    };
    setHistorial([newHistorialItem, ...historial]);

    setEditingServicio(null);
    setIsEditServicioModalOpen(false);
    setNuevoCosto({
      servicioId: 0,
      servicioNombre: '',
      costo: 0,
      mes: new Date().toISOString().slice(0, 7),
      motivo: ''
    });
  };

  const getButtonText = () => {
    switch (activeTab) {
      case 'servicios':
        return 'Nuevo Servicio';
      case 'categorias':
        return 'Nueva Categoría';
      case 'proveedores':
        return 'Nuevo Proveedor';
      default:
        return 'Nuevo';
    }
  };

  const handleButtonClick = () => {
    switch (activeTab) {
      case 'servicios':
        setIsServicioModalOpen(true);
        break;
      case 'categorias':
        setIsCategoriaModalOpen(true);
        break;
      case 'proveedores':
        setIsProveedorModalOpen(true);
        break;
    }
  };

  const filteredServicios = servicios.filter(servicio => {
    const matchesSearch = servicio.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = selectedCategoria === 'todas' || servicio.categoria === selectedCategoria;
    const matchesTipo = selectedTipo === 'todos' || servicio.tipo === selectedTipo;
    return matchesSearch && matchesCategoria && matchesTipo;
  });

  const totalCostoServicios = servicios.reduce((sum, servicio) => sum + servicio.costoMensual, 0);

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
            <h1 className="text-3xl font-bold tracking-tight">Servicios Operativos</h1>
            <p className="text-muted-foreground">
              Gestión de costos fijos, variables y registro de costos mensuales con historial
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
            {(activeTab === 'servicios' || activeTab === 'categorias' || activeTab === 'proveedores') && (
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
            <CardTitle className="text-sm font-medium">Total Servicios</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{servicios.length}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Zap className="h-4 w-4" />
              <span>Servicios activos</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo Total Mensual</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCostoServicios)}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-red-500" />
              <span>+6.8% vs mes anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorías</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categorias.length}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span>Categorías activas</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proveedores</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{proveedores.length}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Settings className="h-4 w-4" />
              <span>Proveedores activos</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="servicios">Servicios</TabsTrigger>
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
        </TabsList>

        <TabsContent value="servicios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Servicios</CardTitle>
              <CardDescription>Gestión completa de servicios y sus costos</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="flex items-center space-x-4 mb-6">
                <div className="flex-1">
                  <Label htmlFor="search">Buscar servicio</Label>
                  <Input
                    id="search"
                    placeholder="Nombre del servicio..."
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
                <div>
                  <Label htmlFor="tipo">Tipo</Label>
                  <select
                    id="tipo"
                    value={selectedTipo}
                    onChange={(e) => setSelectedTipo(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="todos">Todos los tipos</option>
                    <option value="fijo">Fijo</option>
                    <option value="variable">Variable</option>
                  </select>
                </div>
              </div>

              {/* Tabla de servicios */}
              <div className="space-y-4">
                {filteredServicios.map((servicio) => (
                  <div key={servicio.id} className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors duration-200" onClick={() => handleEditServicio(servicio)}>
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">{servicio.nombre}</div>
                        <div className="text-sm text-muted-foreground">
                          {servicio.categoria} • {servicio.proveedor} • {servicio.frecuencia}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Asignación: {servicio.asignacion}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(servicio.costoMensual)}</div>
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          {getVariacionIcon(servicio.variacion)}
                          <span className={servicio.variacion > 0 ? 'text-red-500' : 'text-green-500'}>
                            {servicio.variacion > 0 ? '+' : ''}{servicio.variacion.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getTipoBadge(servicio.tipo)}
                        {getEstadoBadge(servicio.estado)}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewHistorial(servicio);
                          }}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewEstadisticas(servicio);
                          }}
                        >
                          <BarChart className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditServicio(servicio);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                          <span className="ml-1">Registrar Costo</span>
                        </Button>
                      </div>
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
              <CardTitle>Categorías de Servicios</CardTitle>
              <CardDescription>Análisis de costos por categoría</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categorias.map((categoria) => (
                  <div key={categoria.id} className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors duration-200" onClick={() => handleEditCategoria(categoria)}>
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">{categoria.nombre}</div>
                        <div className="text-sm text-muted-foreground">
                          {categoria.servicios} servicios
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(categoria.costoTotal)}</div>
                        <div className="text-sm text-muted-foreground">Costo total</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{categoria.variacion > 0 ? '+' : ''}{categoria.variacion.toFixed(1)}%</div>
                        <div className="text-sm text-muted-foreground">Variación</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proveedores" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Proveedores de Servicios</CardTitle>
              <CardDescription>Análisis de proveedores y sus costos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {proveedores.map((proveedor) => (
                  <div key={proveedor.id} className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors duration-200" onClick={() => handleEditProveedor(proveedor)}>
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">{proveedor.nombre}</div>
                        <div className="text-sm text-muted-foreground">
                          {proveedor.servicios} servicios • Rating: {proveedor.rating}/5
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(proveedor.costoTotal)}</div>
                      <div className="text-sm text-muted-foreground">Costo total</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Costos</CardTitle>
              <CardDescription>Registro de cambios de costos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {historial.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">{item.servicio}</div>
                        <div className="text-sm text-muted-foreground">
                          {item.motivo}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(item.costo)}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(item.fecha)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
                    const porcentaje = (categoria.costoTotal / totalCostoServicios) * 100;
                    return (
                      <div key={categoria.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full bg-primary"></div>
                          <span className="text-sm font-medium">{categoria.nombre}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{formatCurrency(categoria.costoTotal)}</div>
                          <div className="text-xs text-muted-foreground">{porcentaje.toFixed(1)}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alertas y Notificaciones</CardTitle>
                <CardDescription>Estado actual del sistema de servicios</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span>Mantenimiento +12.3%</span>
                  </div>
                  <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Crítico</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span>Electricidad +9.0%</span>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Atención</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Gas -2.2%</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">OK</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modales */}
      
      {/* Modal Nuevo Servicio */}
      <Dialog open={isServicioModalOpen} onOpenChange={setIsServicioModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Nuevo Servicio</DialogTitle>
            <DialogDescription>
              Crear un nuevo servicio operativo con sus costos y configuración
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombreServicio">Nombre del Servicio</Label>
                <Input
                  id="nombreServicio"
                  value={nuevoServicio.nombre}
                  onChange={(e) => setNuevoServicio({...nuevoServicio, nombre: e.target.value})}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('categoriaServicio')?.focus();
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoriaServicio">Categoría</Label>
                <Select value={nuevoServicio.categoria} onValueChange={(value) => setNuevoServicio({...nuevoServicio, categoria: value})}>
                  <SelectTrigger id="categoriaServicio" onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('tipoServicio')?.focus();
                    }
                  }}>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map(cat => (
                      <SelectItem key={cat.id} value={cat.nombre}>{cat.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipoServicio">Tipo</Label>
                <Select value={nuevoServicio.tipo} onValueChange={(value) => setNuevoServicio({...nuevoServicio, tipo: value as 'fijo' | 'variable'})}>
                  <SelectTrigger id="tipoServicio" onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('costoMensualServicio')?.focus();
                    }
                  }}>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fijo">Fijo</SelectItem>
                    <SelectItem value="variable">Variable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="costoMensualServicio">Costo Mensual</Label>
                <Input
                  id="costoMensualServicio"
                  type="number"
                  placeholder="0"
                  value={nuevoServicio.costoMensual || ''}
                  onChange={(e) => setNuevoServicio({...nuevoServicio, costoMensual: Number(e.target.value)})}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('proveedorServicio')?.focus();
                    }
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proveedorServicio">Proveedor</Label>
                <Select value={nuevoServicio.proveedor} onValueChange={(value) => setNuevoServicio({...nuevoServicio, proveedor: value})}>
                  <SelectTrigger id="proveedorServicio" onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('frecuenciaServicio')?.focus();
                    }
                  }}>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {proveedores.map(prov => (
                      <SelectItem key={prov.id} value={prov.nombre}>{prov.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="frecuenciaServicio">Frecuencia</Label>
                <Select value={nuevoServicio.frecuencia} onValueChange={(value) => setNuevoServicio({...nuevoServicio, frecuencia: value})}>
                  <SelectTrigger id="frecuenciaServicio" onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('asignacionServicio')?.focus();
                    }
                  }}>
                    <SelectValue placeholder="Seleccionar frecuencia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mensual">Mensual</SelectItem>
                    <SelectItem value="Trimestral">Trimestral</SelectItem>
                    <SelectItem value="Semestral">Semestral</SelectItem>
                    <SelectItem value="Anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="asignacionServicio">Asignación</Label>
              <Select value={nuevoServicio.asignacion} onValueChange={(value) => setNuevoServicio({...nuevoServicio, asignacion: value})}>
                <SelectTrigger id="asignacionServicio" onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('descripcionServicio')?.focus();
                  }
                }}>
                  <SelectValue placeholder="Seleccionar asignación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Porcentaje fijo">Porcentaje fijo</SelectItem>
                  <SelectItem value="Por tiempo de máquina">Por tiempo de máquina</SelectItem>
                  <SelectItem value="Por m²">Por m²</SelectItem>
                  <SelectItem value="Por unidades producidas">Por unidades producidas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="descripcionServicio">Descripción (opcional)</Label>
              <Textarea
                id="descripcionServicio"
                value={nuevoServicio.descripcion}
                onChange={(e) => setNuevoServicio({...nuevoServicio, descripcion: e.target.value})}
                placeholder="Descripción del servicio..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsServicioModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateServicio}>
              Crear Servicio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Nueva Categoría */}
      <Dialog open={isCategoriaModalOpen} onOpenChange={setIsCategoriaModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nueva Categoría</DialogTitle>
            <DialogDescription>
              Crear una nueva categoría de servicios
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombreCategoria">Nombre de la Categoría</Label>
              <Input
                id="nombreCategoria"
                value={nuevaCategoria.nombre}
                onChange={(e) => setNuevaCategoria({...nuevaCategoria, nombre: e.target.value})}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateCategoria();
                  }
                }}
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

      {/* Modal Nuevo Proveedor */}
      <Dialog open={isProveedorModalOpen} onOpenChange={setIsProveedorModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nuevo Proveedor</DialogTitle>
            <DialogDescription>
              Crear un nuevo proveedor de servicios
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombreProveedor">Nombre del Proveedor</Label>
              <Input
                id="nombreProveedor"
                value={nuevoProveedor.nombre}
                onChange={(e) => setNuevoProveedor({...nuevoProveedor, nombre: e.target.value})}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('ratingProveedor')?.focus();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ratingProveedor">Rating (1-5)</Label>
              <Select value={nuevoProveedor.rating.toString()} onValueChange={(value) => setNuevoProveedor({...nuevoProveedor, rating: Number(value)})}>
                <SelectTrigger id="ratingProveedor" onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateProveedor();
                  }
                }}>
                  <SelectValue placeholder="Seleccionar rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Muy malo</SelectItem>
                  <SelectItem value="2">2 - Malo</SelectItem>
                  <SelectItem value="3">3 - Regular</SelectItem>
                  <SelectItem value="4">4 - Bueno</SelectItem>
                  <SelectItem value="5">5 - Excelente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProveedorModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateProveedor}>
              Crear Proveedor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Servicio */}
      <Dialog open={isEditServicioModalOpen} onOpenChange={setIsEditServicioModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Registrar Costo: {editingServicio?.nombre}</DialogTitle>
            <DialogDescription>
              Registrar un nuevo costo mensual para este servicio
            </DialogDescription>
          </DialogHeader>
          {editingServicio && (
            <div className="grid gap-4 py-4">
              {/* Información del servicio actual */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium mb-2">Información del Servicio</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Costo actual:</span>
                    <div className="font-medium">{formatCurrency(editingServicio.costoMensual)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Última actualización:</span>
                    <div className="font-medium">{formatDate(editingServicio.ultimaActualizacion)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Categoría:</span>
                    <div className="font-medium">{editingServicio.categoria}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Proveedor:</span>
                    <div className="font-medium">{editingServicio.proveedor}</div>
                  </div>
                </div>
              </div>

              {/* Formulario para nuevo costo */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="costoMensualEdit">Nuevo Costo Mensual</Label>
                  <Input
                    id="costoMensualEdit"
                    type="number"
                    placeholder="0"
                    value={nuevoCosto.costo || ''}
                    onChange={(e) => setNuevoCosto({...nuevoCosto, costo: Number(e.target.value)})}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('mesEdit')?.focus();
                      }
                    }}
                  />
                  {nuevoCosto.costo > 0 && editingServicio.costoMensual > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Variación: {((nuevoCosto.costo - editingServicio.costoMensual) / editingServicio.costoMensual * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mesEdit">Mes</Label>
                  <Input
                    id="mesEdit"
                    type="month"
                    value={nuevoCosto.mes}
                    onChange={(e) => setNuevoCosto({...nuevoCosto, mes: e.target.value})}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('motivoEdit')?.focus();
                      }
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="motivoEdit">Motivo del Cambio</Label>
                <Textarea
                  id="motivoEdit"
                  value={nuevoCosto.motivo}
                  onChange={(e) => setNuevoCosto({...nuevoCosto, motivo: e.target.value})}
                  placeholder="Descripción del motivo del cambio de costo (ej: aumento tarifario, cambio de proveedor, etc.)..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      e.preventDefault();
                      handleRegisterCosto();
                    }
                  }}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditServicioModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleRegisterCosto}
              disabled={!nuevoCosto.costo || !nuevoCosto.motivo || !nuevoCosto.mes}
            >
              Registrar Costo
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
              Modificar los detalles de la categoría y ver los servicios asignados
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombreCategoriaEdit">Nombre de la Categoría</Label>
              <Input
                id="nombreCategoriaEdit"
                value={editCategoriaData.nombre}
                onChange={(e) => setEditCategoriaData({...editCategoriaData, nombre: e.target.value})}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleUpdateCategoria();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Servicios de esta categoría</Label>
              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                {editingCategoria && servicios.filter(servicio => servicio.categoria === editingCategoria.nombre).length > 0 ? (
                  <div className="space-y-2">
                    {servicios
                      .filter(servicio => servicio.categoria === editingCategoria.nombre)
                      .map((servicio) => (
                        <div key={servicio.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <div className="font-medium">{servicio.nombre}</div>
                            <div className="text-sm text-muted-foreground">
                              {servicio.tipo} • {servicio.proveedor} • {servicio.frecuencia}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">{formatCurrency(servicio.costoMensual)}</div>
                            <div className="text-xs text-muted-foreground">Costo mensual</div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    No hay servicios asignados a esta categoría
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

      {/* Modal Editar Proveedor */}
      <Dialog open={isEditProveedorModalOpen} onOpenChange={setIsEditProveedorModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Editar Proveedor: {editingProveedor?.nombre}</DialogTitle>
            <DialogDescription>
              Modificar los detalles del proveedor y ver los servicios asignados
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombreProveedorEdit">Nombre del Proveedor</Label>
              <Input
                id="nombreProveedorEdit"
                value={editProveedorData.nombre}
                onChange={(e) => setEditProveedorData({...editProveedorData, nombre: e.target.value})}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('ratingProveedorEdit')?.focus();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ratingProveedorEdit">Rating (1-5)</Label>
              <Select value={editProveedorData.rating.toString()} onValueChange={(value) => setEditProveedorData({...editProveedorData, rating: Number(value)})}>
                <SelectTrigger id="ratingProveedorEdit" onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleUpdateProveedor();
                  }
                }}>
                  <SelectValue placeholder="Seleccionar rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Muy malo</SelectItem>
                  <SelectItem value="2">2 - Malo</SelectItem>
                  <SelectItem value="3">3 - Regular</SelectItem>
                  <SelectItem value="4">4 - Bueno</SelectItem>
                  <SelectItem value="5">5 - Excelente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Servicios de este proveedor</Label>
              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                {editingProveedor && servicios.filter(servicio => servicio.proveedor === editingProveedor.nombre).length > 0 ? (
                  <div className="space-y-2">
                    {servicios
                      .filter(servicio => servicio.proveedor === editingProveedor.nombre)
                      .map((servicio) => (
                        <div key={servicio.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <div className="font-medium">{servicio.nombre}</div>
                            <div className="text-sm text-muted-foreground">
                              {servicio.categoria} • {servicio.tipo} • {servicio.frecuencia}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">{formatCurrency(servicio.costoMensual)}</div>
                            <div className="text-xs text-muted-foreground">Costo mensual</div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    No hay servicios asignados a este proveedor
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditProveedorModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateProveedor}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Historial */}
      <Dialog open={isHistorialModalOpen} onOpenChange={setIsHistorialModalOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Historial de Costos: {selectedServicioForHistorial?.nombre}</DialogTitle>
            <DialogDescription>
              Historial completo de cambios de costos para este servicio
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-4">
              {selectedServicioForHistorial && historial.filter(h => h.servicioId === selectedServicioForHistorial.id).length > 0 ? (
                <div className="space-y-2">
                  {historial
                    .filter(h => h.servicioId === selectedServicioForHistorial.id)
                    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                    .map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <div className="font-medium">{item.motivo}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(item.fecha)} • Mes: {item.mes} • Realizado por: {item.realizadoPor}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(item.costo)}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.variacionPorcentual > 0 ? '+' : ''}{item.variacionPorcentual.toFixed(1)}% vs anterior
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  No hay historial de cambios para este servicio
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistorialModalOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Estadísticas */}
      <Dialog open={isEstadisticasModalOpen} onOpenChange={setIsEstadisticasModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Estadísticas: {estadisticasServicio?.servicioNombre}</DialogTitle>
            <DialogDescription>
              Análisis estadístico de costos para este servicio
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {estadisticasServicio && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Costo Promedio</Label>
                  <div className="text-2xl font-bold">{formatCurrency(estadisticasServicio.costoPromedio)}</div>
                </div>
                <div className="space-y-2">
                  <Label>Costo Máximo</Label>
                  <div className="text-2xl font-bold text-red-600">{formatCurrency(estadisticasServicio.costoMaximo)}</div>
                </div>
                <div className="space-y-2">
                  <Label>Costo Mínimo</Label>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(estadisticasServicio.costoMinimo)}</div>
                </div>
                <div className="space-y-2">
                  <Label>Variación Promedio</Label>
                  <div className="text-2xl font-bold">{estadisticasServicio.variacionPromedio > 0 ? '+' : ''}{estadisticasServicio.variacionPromedio.toFixed(1)}%</div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEstadisticasModalOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 