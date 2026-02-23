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
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Package, 
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
  ShoppingCart,
  BarChart3,
  Eye
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';

interface Insumo {
  id: number;
  nombre: string;
  categoria: string;
  unidadMedida: string;
  precioActual: number;
  precioAnterior: number;
  variacion: number;
  proveedor: string;
  stock: number;
  stockMinimo: number;
  estado: 'ok' | 'warning' | 'danger';
  ultimaActualizacion: string;
}

interface CategoriaInsumo {
  id: number;
  nombre: string;
  insumos: number;
  costoTotal: number;
  variacion: number;
}

interface Proveedor {
  id: number;
  nombre: string;
  insumos: number;
  costoTotal: number;
  rating: number;
}

interface HistorialPrecio {
  id: number;
  insumoId: number;
  insumoNombre: string;
  precioAnterior: number;
  precioNuevo: number;
  fecha: string;
  mes: string;
  motivo: string;
  realizadoPor: string;
  variacionPorcentual: number;
}

interface EstadisticasPrecio {
  precioMinimo: number;
  precioMaximo: number;
  precioPromedio: number;
  variacionTotal: number;
  cantidadCambios: number;
  ultimoCambio: string;
  tendencia: 'ascendente' | 'descendente' | 'estable';
}

interface NuevoPrecio {
  precio: string;
  mes: string;
  motivo: string;
}

export default function MateriaPrimaPage() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [categorias, setCategorias] = useState<CategoriaInsumo[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [historial, setHistorial] = useState<HistorialPrecio[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('todas');
  const [selectedProveedor, setSelectedProveedor] = useState('todos');
  const [activeTab, setActiveTab] = useState('insumos');
  
  // Estados para modales
  const [isInsumoModalOpen, setIsInsumoModalOpen] = useState(false);
  const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false);
  const [isProveedorModalOpen, setIsProveedorModalOpen] = useState(false);
  const [isEditPrecioModalOpen, setIsEditPrecioModalOpen] = useState(false);
  const [isHistorialModalOpen, setIsHistorialModalOpen] = useState(false);
  const [isEstadisticasModalOpen, setIsEstadisticasModalOpen] = useState(false);
  const [isEditCategoriaModalOpen, setIsEditCategoriaModalOpen] = useState(false);
  const [isEditProveedorModalOpen, setIsEditProveedorModalOpen] = useState(false);
  
  // Estados para formularios
  const [nuevoInsumo, setNuevoInsumo] = useState({
    nombre: '',
    categoria: '',
    unidadMedida: '',
    precioActual: '',
    proveedor: '',
    stock: '',
    stockMinimo: ''
  });
  
  const [nuevaCategoria, setNuevaCategoria] = useState({
    nombre: ''
  });
  
  const [nuevoProveedor, setNuevoProveedor] = useState({
    nombre: '',
    rating: 5
  });

  // Estados para edición de precios
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [editPrecioData, setEditPrecioData] = useState({
    precioNuevo: '',
    motivo: ''
  });
  const [nuevoPrecio, setNuevoPrecio] = useState<NuevoPrecio>({
    precio: '',
    mes: '',
    motivo: ''
  });
  const [selectedInsumoForHistorial, setSelectedInsumoForHistorial] = useState<Insumo | null>(null);
  const [estadisticasInsumo, setEstadisticasInsumo] = useState<EstadisticasPrecio | null>(null);

  // Estados para edición de categorías
  const [editingCategoria, setEditingCategoria] = useState<CategoriaInsumo | null>(null);

  // Estados para edición de proveedores
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [editProveedorData, setEditProveedorData] = useState({
    nombre: '',
    rating: 5
  });

  useEffect(() => {
    // Simular carga de datos
    const loadData = async () => {
      setIsLoading(true);
      
      // Simular delay de carga
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Datos de ejemplo
      setInsumos([
        {
          id: 1,
          nombre: 'Cemento Portland',
          categoria: 'Materiales Básicos',
          unidadMedida: 'kg',
          precioActual: 850,
          precioAnterior: 800,
          variacion: 6.25,
          proveedor: 'Loma Negra',
          stock: 5000,
          stockMinimo: 1000,
          estado: 'ok',
          ultimaActualizacion: '2024-01-15'
        },
        {
          id: 2,
          nombre: 'Arena Fina',
          categoria: 'Áridos',
          unidadMedida: 'm³',
          precioActual: 4500,
          precioAnterior: 4200,
          variacion: 7.14,
          proveedor: 'Áridos del Sur',
          stock: 200,
          stockMinimo: 50,
          estado: 'warning',
          ultimaActualizacion: '2024-01-10'
        },
        {
          id: 3,
          nombre: 'Piedra Partida',
          categoria: 'Áridos',
          unidadMedida: 'm³',
          precioActual: 5200,
          precioAnterior: 5200,
          variacion: 0,
          proveedor: 'Áridos del Sur',
          stock: 150,
          stockMinimo: 30,
          estado: 'ok',
          ultimaActualizacion: '2024-01-12'
        },
        {
          id: 4,
          nombre: 'Hierro 6mm',
          categoria: 'Acero',
          unidadMedida: 'kg',
          precioActual: 1200,
          precioAnterior: 1100,
          variacion: 9.09,
          proveedor: 'Aceros del Norte',
          stock: 800,
          stockMinimo: 200,
          estado: 'danger',
          ultimaActualizacion: '2024-01-08'
        }
      ]);
      
      setCategorias([
        {
          id: 1,
          nombre: 'Materiales Básicos',
          insumos: 8,
          costoTotal: 1250000,
          variacion: 5.2
        },
        {
          id: 2,
          nombre: 'Áridos',
          insumos: 12,
          costoTotal: 850000,
          variacion: 3.1
        },
        {
          id: 3,
          nombre: 'Acero',
          insumos: 6,
          costoTotal: 650000,
          variacion: 8.7
        }
      ]);
      
      setProveedores([
        {
          id: 1,
          nombre: 'Loma Negra',
          insumos: 5,
          costoTotal: 450000,
          rating: 4.5
        },
        {
          id: 2,
          nombre: 'Áridos del Sur',
          insumos: 8,
          costoTotal: 380000,
          rating: 4.2
        },
        {
          id: 3,
          nombre: 'Aceros del Norte',
          insumos: 4,
          costoTotal: 320000,
          rating: 4.8
        }
      ]);
      
      setHistorial([
        {
          id: 1,
          insumoId: 1,
          insumoNombre: 'Cemento Portland',
          precioAnterior: 850,
          precioNuevo: 850,
          fecha: '2024-01-15',
          mes: '2024-01',
          motivo: 'Ajuste de precios',
          realizadoPor: 'Usuario1',
          variacionPorcentual: 0
        },
        {
          id: 2,
          insumoId: 2,
          insumoNombre: 'Arena Fina',
          precioAnterior: 4500,
          precioNuevo: 4500,
          fecha: '2024-01-10',
          mes: '2024-01',
          motivo: 'Incremento de costos de transporte',
          realizadoPor: 'Usuario2',
          variacionPorcentual: 0
        },
        {
          id: 3,
          insumoId: 4,
          insumoNombre: 'Hierro 6mm',
          precioAnterior: 1200,
          precioNuevo: 1200,
          fecha: '2024-01-08',
          mes: '2024-01',
          motivo: 'Variación del dólar',
          realizadoPor: 'Usuario3',
          variacionPorcentual: 0
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
        return <Badge className="bg-success-muted text-success hover:bg-success-muted">OK</Badge>;
      case 'warning':
        return <Badge className="bg-warning-muted text-warning-muted-foreground hover:bg-warning-muted">Atención</Badge>;
      case 'danger':
        return <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10">Crítico</Badge>;
    }
  };

  const getVariacionIcon = (variacion: number) => {
    if (variacion > 0) {
      return <TrendingUp className="h-4 w-4 text-destructive" />;
    } else if (variacion < 0) {
      return <TrendingDown className="h-4 w-4 text-success" />;
    } else {
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const filteredInsumos = insumos.filter(insumo => {
    const matchesSearch = insumo.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = selectedCategoria === 'todas' || insumo.categoria === selectedCategoria;
    const matchesProveedor = selectedProveedor === 'todos' || insumo.proveedor === selectedProveedor;
    return matchesSearch && matchesCategoria && matchesProveedor;
  });

  const totalCostoMateriaPrima = insumos.reduce((sum, insumo) => sum + insumo.precioActual, 0);

  const handleCreateInsumo = () => {
    const nuevoId = Math.max(...insumos.map(i => i.id)) + 1;
    const insumo: Insumo = {
      id: nuevoId,
      nombre: nuevoInsumo.nombre,
      categoria: nuevoInsumo.categoria,
      unidadMedida: nuevoInsumo.unidadMedida,
      precioActual: Number(nuevoInsumo.precioActual),
      precioAnterior: Number(nuevoInsumo.precioActual),
      variacion: 0,
      proveedor: nuevoInsumo.proveedor,
      stock: Number(nuevoInsumo.stock),
      stockMinimo: Number(nuevoInsumo.stockMinimo),
      estado: Number(nuevoInsumo.stock) > Number(nuevoInsumo.stockMinimo) ? 'ok' : 'warning',
      ultimaActualizacion: new Date().toISOString().split('T')[0]
    };
    
    setInsumos([...insumos, insumo]);
    setIsInsumoModalOpen(false);
    setNuevoInsumo({ nombre: '', categoria: '', unidadMedida: '', precioActual: '', proveedor: '', stock: '', stockMinimo: '' });
  };

  const handleCreateCategoria = () => {
    const nuevoId = Math.max(...categorias.map(c => c.id)) + 1;
    const categoria: CategoriaInsumo = {
      id: nuevoId,
      nombre: nuevaCategoria.nombre,
      insumos: 0,
      costoTotal: 0,
      variacion: 0
    };
    
    setCategorias([...categorias, categoria]);
    setIsCategoriaModalOpen(false);
    setNuevaCategoria({ nombre: '' });
  };

  const handleCreateProveedor = () => {
    const nuevoId = Math.max(...proveedores.map(p => p.id)) + 1;
    const proveedor: Proveedor = {
      id: nuevoId,
      nombre: nuevoProveedor.nombre,
      insumos: 0,
      costoTotal: 0,
      rating: nuevoProveedor.rating
    };
    
    setProveedores([...proveedores, proveedor]);
    setIsProveedorModalOpen(false);
    setNuevoProveedor({ nombre: '', rating: 5 });
  };

  const handleEditCategoria = (categoria: CategoriaInsumo) => {
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

    // Actualizar todos los insumos que pertenecen a esta categoría
    setInsumos(insumos.map(insumo => 
      insumo.categoria === oldNombre 
        ? { ...insumo, categoria: newNombre }
        : insumo
    ));

    setEditingCategoria(null);
    setIsEditCategoriaModalOpen(false);
    setNuevaCategoria({ nombre: '' });
  };

  const handleEditProveedor = (proveedor: Proveedor) => {
    setEditingProveedor(proveedor);
    setEditProveedorData({ nombre: proveedor.nombre, rating: proveedor.rating });
    setIsEditProveedorModalOpen(true);
  };

  const handleUpdateProveedor = () => {
    if (!editingProveedor) return;

    const oldNombre = editingProveedor.nombre;
    const newNombre = editProveedorData.nombre;
    const newRating = editProveedorData.rating;

    // Actualizar el proveedor
    const updatedProveedor: Proveedor = {
      ...editingProveedor,
      nombre: newNombre,
      rating: newRating
    };

    setProveedores(proveedores.map(p => p.id === editingProveedor.id ? updatedProveedor : p));

    // Actualizar todos los insumos que pertenecen a este proveedor
    setInsumos(insumos.map(insumo => 
      insumo.proveedor === oldNombre 
        ? { ...insumo, proveedor: newNombre }
        : insumo
    ));

    setEditingProveedor(null);
    setIsEditProveedorModalOpen(false);
    setEditProveedorData({ nombre: '', rating: 5 });
  };

  const handleEditPrecio = (insumo: Insumo) => {
    setEditingInsumo(insumo);
    setNuevoPrecio({
      precio: insumo.precioActual.toString(),
      mes: new Date().toISOString().slice(0, 7), // Current month in YYYY-MM format
      motivo: ''
    });
    setIsEditPrecioModalOpen(true);
  };

  const handleRegisterPrecio = () => {
    if (!editingInsumo) return;

    const precioNuevo = Number(nuevoPrecio.precio);
    const precioAnterior = editingInsumo.precioActual;
    const variacionPorcentual = ((precioNuevo - precioAnterior) / precioAnterior) * 100;

    // Crear entrada en el historial
    const nuevoHistorial: HistorialPrecio = {
      id: Math.max(...historial.map(h => h.id)) + 1,
      insumoId: editingInsumo.id,
      insumoNombre: editingInsumo.nombre,
      precioAnterior,
      precioNuevo,
      fecha: new Date().toISOString().split('T')[0],
      mes: nuevoPrecio.mes,
      motivo: nuevoPrecio.motivo,
      realizadoPor: user?.name || 'Usuario',
      variacionPorcentual
    };

    // Actualizar el insumo
    const updatedInsumo: Insumo = {
      ...editingInsumo,
      precioAnterior: precioAnterior,
      precioActual: precioNuevo,
      variacion: variacionPorcentual,
      ultimaActualizacion: new Date().toISOString().split('T')[0]
    };

    setInsumos(insumos.map(i => i.id === editingInsumo.id ? updatedInsumo : i));
    setHistorial([nuevoHistorial, ...historial]);
    
    setIsEditPrecioModalOpen(false);
    setEditingInsumo(null);
    setNuevoPrecio({ precio: '', mes: '', motivo: '' });
  };

  const handleViewHistorial = (insumo: Insumo) => {
    setSelectedInsumoForHistorial(insumo);
    setIsHistorialModalOpen(true);
  };

  const handleViewEstadisticas = (insumo: Insumo) => {
    const historialInsumo = historial.filter(h => h.insumoId === insumo.id);
    
    if (historialInsumo.length === 0) {
      setEstadisticasInsumo(null);
    } else {
      const precios = historialInsumo.map(h => h.precioNuevo);
      const preciosAnteriores = historialInsumo.map(h => h.precioAnterior);
      const todosLosPrecios = [...precios, ...preciosAnteriores, insumo.precioActual];
      
      const estadisticas: EstadisticasPrecio = {
        precioMinimo: Math.min(...todosLosPrecios),
        precioMaximo: Math.max(...todosLosPrecios),
        precioPromedio: todosLosPrecios.reduce((sum, precio) => sum + precio, 0) / todosLosPrecios.length,
        variacionTotal: historialInsumo.reduce((sum, h) => sum + h.variacionPorcentual, 0),
        cantidadCambios: historialInsumo.length,
        ultimoCambio: historialInsumo[0]?.fecha || insumo.ultimaActualizacion,
        tendencia: historialInsumo.length > 0 
          ? historialInsumo[0].variacionPorcentual > 0 
            ? 'ascendente' 
            : historialInsumo[0].variacionPorcentual < 0 
              ? 'descendente' 
              : 'estable'
          : 'estable'
      };
      
      setEstadisticasInsumo(estadisticas);
    }
    
    setSelectedInsumoForHistorial(insumo);
    setIsEstadisticasModalOpen(true);
  };

  const getButtonText = () => {
    switch (activeTab) {
      case 'insumos':
        return 'Nuevo Insumo';
      case 'categorias':
        return 'Nueva Categoría';
      case 'proveedores':
        return 'Nuevo Proveedor';
      case 'historial':
        return null; // No mostrar botón en historial
      case 'reportes':
        return null; // No mostrar botón en reportes
      default:
        return 'Nuevo';
    }
  };

  const handleButtonClick = () => {
    switch (activeTab) {
      case 'insumos':
        setIsInsumoModalOpen(true);
        break;
      case 'categorias':
        setIsCategoriaModalOpen(true);
        break;
      case 'proveedores':
        setIsProveedorModalOpen(true);
        break;
      case 'historial':
        // No hacer nada en historial
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
            <h1 className="text-3xl font-bold tracking-tight">Materia Prima</h1>
            <p className="text-muted-foreground">
              Gestión de insumos, precios, proveedores y registro de costos mensuales con historial
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
            <CardTitle className="text-sm font-medium">Total Insumos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insumos.length}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Insumos registrados</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCostoMateriaPrima)}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-destructive" />
              <span>+5.2% vs mes anterior</span>
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
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{proveedores.length}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <ShoppingCart className="h-4 w-4" />
              <span>Proveedores activos</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="insumos">Insumos</TabsTrigger>
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
        </TabsList>

        <TabsContent value="insumos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Insumos</CardTitle>
              <CardDescription>Gestión completa de insumos y sus precios</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="flex items-center space-x-4 mb-6">
                <div className="flex-1">
                  <Label htmlFor="search">Buscar insumo</Label>
                  <Input
                    id="search"
                    placeholder="Nombre del insumo..."
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
                  <Label htmlFor="proveedor">Proveedor</Label>
                  <select
                    id="proveedor"
                    value={selectedProveedor}
                    onChange={(e) => setSelectedProveedor(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="todos">Todos los proveedores</option>
                    {proveedores.map(prov => (
                      <option key={prov.id} value={prov.nombre}>{prov.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tabla de insumos */}
              <div className="space-y-4">
                {filteredInsumos.map((insumo) => (
                  <div key={insumo.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors duration-200">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">{insumo.nombre}</div>
                        <div className="text-sm text-muted-foreground">
                          {insumo.categoria} • {insumo.unidadMedida} • {insumo.proveedor}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(insumo.precioActual)}</div>
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          {getVariacionIcon(insumo.variacion)}
                          <span className={insumo.variacion > 0 ? 'text-destructive' : 'text-success'}>
                            {insumo.variacion > 0 ? '+' : ''}{formatNumber(insumo.variacion, 1)}%
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">Stock: {insumo.stock}</div>
                        <div className="text-xs text-muted-foreground">
                          Mín: {insumo.stockMinimo}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getEstadoBadge(insumo.estado)}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditPrecio(insumo);
                          }}
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Registrar Precio
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewHistorial(insumo);
                          }}
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewEstadisticas(insumo);
                          }}
                        >
                          <BarChart3 className="h-4 w-4" />
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
              <CardTitle>Categorías de Insumos</CardTitle>
              <CardDescription>Análisis de costos por categoría</CardDescription>
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
                          {categoria.insumos} insumos
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(categoria.costoTotal)}</div>
                        <div className="text-sm text-muted-foreground">Costo total</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{categoria.variacion > 0 ? '+' : ''}{formatNumber(categoria.variacion, 1)}%</div>
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
              <CardTitle>Proveedores</CardTitle>
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
                          {proveedor.insumos} insumos • Rating: {proveedor.rating}/5
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
              <CardTitle>Historial de Precios</CardTitle>
              <CardDescription>Registro de cambios de precios</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {historial
                  .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                  .map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div>
                          <div className="font-medium">{item.insumoNombre}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.motivo}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Mes: {item.mes} • Fecha: {formatDate(item.fecha)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(item.precioAnterior)} → {formatCurrency(item.precioNuevo)}</div>
                          <div className="text-sm text-muted-foreground">
                            Realizado por: {item.realizadoPor}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{item.variacionPorcentual > 0 ? '+' : ''}{formatNumber(item.variacionPorcentual, 1)}%</div>
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
                    const porcentaje = (categoria.costoTotal / totalCostoMateriaPrima) * 100;
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
                <CardTitle>Alertas y Notificaciones</CardTitle>
                <CardDescription>Estado actual del sistema de materia prima</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span>Hierro 6mm +9.09%</span>
                  </div>
                  <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10">Crítico</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
                    <span>Arena Fina stock bajo</span>
                  </div>
                  <Badge className="bg-warning-muted text-warning-muted-foreground hover:bg-warning-muted">Atención</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span>Piedra Partida estable</span>
                  </div>
                  <Badge className="bg-success-muted text-success hover:bg-success-muted">OK</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal Nuevo Insumo */}
      <Dialog open={isInsumoModalOpen} onOpenChange={setIsInsumoModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nuevo Insumo</DialogTitle>
            <DialogDescription>
              Agregar un nuevo insumo al sistema de materia prima
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombreInsumo">Nombre del Insumo</Label>
              <Input
                id="nombreInsumo"
                value={nuevoInsumo.nombre}
                onChange={(e) => setNuevoInsumo({...nuevoInsumo, nombre: e.target.value})}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('categoriaInsumo')?.focus();
                  }
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoriaInsumo">Categoría</Label>
                <Select value={nuevoInsumo.categoria} onValueChange={(value) => setNuevoInsumo({...nuevoInsumo, categoria: value})}>
                  <SelectTrigger id="categoriaInsumo" onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('unidadMedida')?.focus();
                    }
                  }}>
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
                <Label htmlFor="unidadMedida">Unidad de Medida</Label>
                <Select value={nuevoInsumo.unidadMedida} onValueChange={(value) => setNuevoInsumo({...nuevoInsumo, unidadMedida: value})}>
                  <SelectTrigger id="unidadMedida" onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('precioActual')?.focus();
                    }
                  }}>
                    <SelectValue placeholder="Seleccionar unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="m³">m³</SelectItem>
                    <SelectItem value="l">l</SelectItem>
                    <SelectItem value="unidad">unidad</SelectItem>
                    <SelectItem value="m">m</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="precioActual">Precio Actual</Label>
                <Input
                  id="precioActual"
                  type="number"
                  placeholder="0"
                  value={nuevoInsumo.precioActual}
                  onChange={(e) => setNuevoInsumo({...nuevoInsumo, precioActual: e.target.value})}
                  onFocus={(e) => {
                    if (e.target.value === '' || e.target.value === '0') {
                      e.target.select();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('proveedorInsumo')?.focus();
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proveedorInsumo">Proveedor</Label>
                <Select value={nuevoInsumo.proveedor} onValueChange={(value) => setNuevoInsumo({...nuevoInsumo, proveedor: value})}>
                  <SelectTrigger id="proveedorInsumo" onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('stock')?.focus();
                    }
                  }}>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {proveedores.map((prov) => (
                      <SelectItem key={prov.id} value={prov.nombre}>{prov.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock">Stock Actual</Label>
                <Input
                  id="stock"
                  type="number"
                  placeholder="0"
                  value={nuevoInsumo.stock}
                  onChange={(e) => setNuevoInsumo({...nuevoInsumo, stock: e.target.value})}
                  onFocus={(e) => {
                    if (e.target.value === '' || e.target.value === '0') {
                      e.target.select();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('stockMinimo')?.focus();
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stockMinimo">Stock Mínimo</Label>
                <Input
                  id="stockMinimo"
                  type="number"
                  placeholder="0"
                  value={nuevoInsumo.stockMinimo}
                  onChange={(e) => setNuevoInsumo({...nuevoInsumo, stockMinimo: e.target.value})}
                  onFocus={(e) => {
                    if (e.target.value === '' || e.target.value === '0') {
                      e.target.select();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateInsumo();
                    }
                  }}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInsumoModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateInsumo}>
              Crear Insumo
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
              Crear una nueva categoría de insumos
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nuevo Proveedor</DialogTitle>
            <DialogDescription>
              Agregar un nuevo proveedor al sistema
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

      {/* Modal Editar Precio */}
      <Dialog open={isEditPrecioModalOpen} onOpenChange={setIsEditPrecioModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Registrar Precio: {editingInsumo?.nombre}</DialogTitle>
            <DialogDescription>
              Registrar un nuevo precio mensual para este insumo
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Información del insumo */}
            {editingInsumo && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h4 className="font-medium">Información del Insumo</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Precio actual:</span>
                    <div className="font-medium">{formatCurrency(editingInsumo.precioActual)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Última actualización:</span>
                    <div className="font-medium">{formatDate(editingInsumo.ultimaActualizacion)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Categoría:</span>
                    <div className="font-medium">{editingInsumo.categoria}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Proveedor:</span>
                    <div className="font-medium">{editingInsumo.proveedor}</div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="precioNuevo">Nuevo Precio</Label>
              <Input
                id="precioNuevo"
                type="number"
                placeholder="0"
                value={nuevoPrecio.precio}
                onChange={(e) => setNuevoPrecio({...nuevoPrecio, precio: e.target.value})}
                onFocus={(e) => {
                  if (e.target.value === '0') {
                    e.target.select();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('mesPrecio')?.focus();
                  }
                }}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="mesPrecio">Mes</Label>
              <Input
                id="mesPrecio"
                type="month"
                value={nuevoPrecio.mes}
                onChange={(e) => setNuevoPrecio({...nuevoPrecio, mes: e.target.value})}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('motivoPrecio')?.focus();
                  }
                }}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="motivoPrecio">Motivo del Cambio</Label>
              <Textarea
                id="motivoPrecio"
                value={nuevoPrecio.motivo}
                onChange={(e) => setNuevoPrecio({...nuevoPrecio, motivo: e.target.value})}
                placeholder="Descripción del motivo del cambio de precio..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    handleRegisterPrecio();
                  }
                }}
              />
            </div>
            
            {/* Mostrar variación en tiempo real */}
            {editingInsumo && nuevoPrecio.precio && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Variación:</div>
                <div className={`font-medium ${
                  Number(nuevoPrecio.precio) > editingInsumo.precioActual 
                    ? 'text-destructive' 
                    : Number(nuevoPrecio.precio) < editingInsumo.precioActual 
                      ? 'text-success' 
                      : 'text-muted-foreground'
                }`}>
                  {formatNumber((Number(nuevoPrecio.precio) - editingInsumo.precioActual) / editingInsumo.precioActual * 100, 1)}%
                  {Number(nuevoPrecio.precio) > editingInsumo.precioActual ? ' (Incremento)' : 
                   Number(nuevoPrecio.precio) < editingInsumo.precioActual ? ' (Decremento)' : ' (Sin cambios)'}
                </div>
              </div>
            )}
            
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
            <Button variant="outline" onClick={() => setIsEditPrecioModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleRegisterPrecio}
              disabled={!nuevoPrecio.precio || !nuevoPrecio.motivo || !nuevoPrecio.mes}
            >
              Registrar Precio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Historial de Precios */}
      <Dialog open={isHistorialModalOpen} onOpenChange={setIsHistorialModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Historial de Precios: {selectedInsumoForHistorial?.nombre}</DialogTitle>
            <DialogDescription>
              Historial completo de cambios de precios para este insumo
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {selectedInsumoForHistorial && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <div className="font-medium">Precio Actual</div>
                    <div className="text-2xl font-bold">{formatCurrency(selectedInsumoForHistorial.precioActual)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Variación</div>
                    <div className={`font-medium ${selectedInsumoForHistorial.variacion > 0 ? 'text-destructive' : 'text-success'}`}>
                      {selectedInsumoForHistorial.variacion > 0 ? '+' : ''}{formatNumber(selectedInsumoForHistorial.variacion, 1)}%
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Historial de Cambios</Label>
                  <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                    {historial.filter(h => h.insumoId === selectedInsumoForHistorial.id).length > 0 ? (
                      <div className="space-y-3">
                        {historial
                          .filter(h => h.insumoId === selectedInsumoForHistorial.id)
                          .map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div>
                                <div className="font-medium">
                                  {formatCurrency(item.precioAnterior)} → {formatCurrency(item.precioNuevo)}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {item.motivo} • Realizado por: {item.realizadoPor}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Mes: {item.mes} • Fecha: {formatDate(item.fecha)}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`font-medium ${item.variacionPorcentual > 0 ? 'text-destructive' : 'text-success'}`}>
                                  {item.variacionPorcentual > 0 ? '+' : ''}{formatNumber(item.variacionPorcentual, 1)}%
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-4">
                        No hay historial de cambios de precios para este insumo
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistorialModalOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Estadísticas de Precios */}
      <Dialog open={isEstadisticasModalOpen} onOpenChange={setIsEstadisticasModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Estadísticas de Precios: {selectedInsumoForHistorial?.nombre}</DialogTitle>
            <DialogDescription>
              Análisis estadístico de los precios históricos
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {estadisticasInsumo ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Precio Mínimo</Label>
                    <div className="text-lg font-medium">{formatCurrency(estadisticasInsumo.precioMinimo)}</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Precio Máximo</Label>
                    <div className="text-lg font-medium">{formatCurrency(estadisticasInsumo.precioMaximo)}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Precio Promedio</Label>
                  <div className="text-lg font-medium">{formatCurrency(estadisticasInsumo.precioPromedio)}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Variación Total</Label>
                    <div className={`text-lg font-medium ${estadisticasInsumo.variacionTotal > 0 ? 'text-destructive' : 'text-success'}`}>
                      {estadisticasInsumo.variacionTotal > 0 ? '+' : ''}{formatNumber(estadisticasInsumo.variacionTotal, 1)}%
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Cantidad de Cambios</Label>
                    <div className="text-lg font-medium">{estadisticasInsumo.cantidadCambios}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Último Cambio</Label>
                  <div className="text-sm font-medium">{formatDate(estadisticasInsumo.ultimoCambio)}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Tendencia</Label>
                  <div className="flex items-center space-x-2">
                    {estadisticasInsumo.tendencia === 'ascendente' && <TrendingUp className="h-4 w-4 text-destructive" />}
                    {estadisticasInsumo.tendencia === 'descendente' && <TrendingDown className="h-4 w-4 text-success" />}
                    {estadisticasInsumo.tendencia === 'estable' && <BarChart3 className="h-4 w-4 text-info-muted-foreground" />}
                    <span className={`font-medium ${
                      estadisticasInsumo.tendencia === 'ascendente' ? 'text-destructive' : 
                      estadisticasInsumo.tendencia === 'descendente' ? 'text-success' : 'text-info-muted-foreground'
                    }`}>
                      {estadisticasInsumo.tendencia === 'ascendente' ? 'Ascendente' : 
                       estadisticasInsumo.tendencia === 'descendente' ? 'Descendente' : 'Estable'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-4">
                No hay suficientes datos para generar estadísticas
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

      {/* Modal Editar Categoría */}
      <Dialog open={isEditCategoriaModalOpen} onOpenChange={setIsEditCategoriaModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Editar Categoría: {editingCategoria?.nombre}</DialogTitle>
            <DialogDescription>
              Modificar los detalles de la categoría y ver los insumos asignados
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombreCategoriaEdit">Nombre de la Categoría</Label>
              <Input
                id="nombreCategoriaEdit"
                value={nuevaCategoria.nombre}
                onChange={(e) => setNuevaCategoria({...nuevaCategoria, nombre: e.target.value})}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleUpdateCategoria();
                  }
                }}
              />
            </div>
            
            {/* Lista de insumos de la categoría */}
            <div className="space-y-2">
              <Label>Insumos en esta categoría</Label>
              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                {editingCategoria && insumos.filter(insumo => insumo.categoria === editingCategoria.nombre).length > 0 ? (
                  <div className="space-y-2">
                    {insumos
                      .filter(insumo => insumo.categoria === editingCategoria.nombre)
                      .map((insumo) => (
                        <div key={insumo.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <div className="font-medium">{insumo.nombre}</div>
                            <div className="text-sm text-muted-foreground">
                              {insumo.unidadMedida} • {insumo.proveedor} • Stock: {insumo.stock}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">{formatCurrency(insumo.precioActual)}</div>
                            <div className="text-xs text-muted-foreground">Precio actual</div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    No hay insumos asignados a esta categoría
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
              Modificar los detalles del proveedor y ver los insumos asignados
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
                    // No hay acción adicional para guardar cambios de proveedor aquí
                    // La lógica de guardar cambios se maneja en el estado de proveedores
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
            
            {/* Lista de insumos del proveedor */}
            <div className="space-y-2">
              <Label>Insumos de este proveedor</Label>
              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                {editingProveedor && insumos.filter(insumo => insumo.proveedor === editingProveedor.nombre).length > 0 ? (
                  <div className="space-y-2">
                    {insumos
                      .filter(insumo => insumo.proveedor === editingProveedor.nombre)
                      .map((insumo) => (
                        <div key={insumo.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <div className="font-medium">{insumo.nombre}</div>
                            <div className="text-sm text-muted-foreground">
                              {insumo.categoria} • {insumo.unidadMedida} • Stock: {insumo.stock}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">{formatCurrency(insumo.precioActual)}</div>
                            <div className="text-xs text-muted-foreground">Precio actual</div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    No hay insumos asignados a este proveedor
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
    </div>
  );
} 