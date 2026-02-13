'use client';

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
  Calculator,
  BarChart3,
  Eye,
  Edit,
  Target,
  Zap,
  Users,
  BookOpen,
  FileText
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';

interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  costoTotal: number;
  costoMateriaPrima: number;
  costoLaboral: number;
  costoServicios: number;
  costoIndirectos: number;
  margen: number;
  precioVenta: number;
  estado: 'ok' | 'warning' | 'danger';
  ultimaActualizacion: string;
  variacion: number;
}

interface ComponenteCosto {
  tipo: 'materia_prima' | 'laboral' | 'servicios' | 'indirectos';
  nombre: string;
  monto: number;
  porcentaje: number;
  variacion: number;
}

interface DetalleProducto {
  id: number;
  nombre: string;
  categoria: string;
  componentes: ComponenteCosto[];
  costoTotal: number;
  margenActual: number;
  margenObjetivo: number;
  precioVentaActual: number;
  precioVentaSugerido: number;
  estado: 'ok' | 'warning' | 'danger';
}

export default function ProductosPage() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('todas');
  const [activeTab, setActiveTab] = useState('productos');
  const [selectedProducto, setSelectedProducto] = useState<DetalleProducto | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Mock data
  const mockProductos: Producto[] = [
    {
      id: 1,
      nombre: 'Bloque',
      categoria: 'Bloques',
      costoTotal: 1250.50,
      costoMateriaPrima: 850.30,
      costoLaboral: 300.00,
      costoServicios: 80.20,
      costoIndirectos: 20.00,
      margen: 25.5,
      precioVenta: 1570.00,
      estado: 'ok',
      ultimaActualizacion: '2024-01-15',
      variacion: 2.3
    },
    {
      id: 2,
      nombre: 'Vigueta',
      categoria: 'Viguetas',
      costoTotal: 2100.75,
      costoMateriaPrima: 1400.50,
      costoLaboral: 500.00,
      costoServicios: 150.25,
      costoIndirectos: 50.00,
      margen: 22.8,
      precioVenta: 2720.00,
      estado: 'warning',
      ultimaActualizacion: '2024-01-14',
      variacion: -1.2
    },
    {
      id: 3,
      nombre: 'Adoquín',
      categoria: 'Adoquines',
      costoTotal: 890.25,
      costoMateriaPrima: 600.00,
      costoLaboral: 200.00,
      costoServicios: 60.25,
      costoIndirectos: 30.00,
      margen: 28.3,
      precioVenta: 1240.00,
      estado: 'ok',
      ultimaActualizacion: '2024-01-13',
      variacion: 0.8
    }
  ];

  const mockDetalles: { [key: number]: DetalleProducto } = {
    1: {
      id: 1,
      nombre: 'Bloque',
      categoria: 'Bloques',
      componentes: [
        {
          tipo: 'materia_prima',
          nombre: 'Cemento',
          monto: 450.30,
          porcentaje: 36.0,
          variacion: 1.2
        },
        {
          tipo: 'materia_prima',
          nombre: 'Arena',
          monto: 250.00,
          porcentaje: 20.0,
          variacion: 0.5
        },
        {
          tipo: 'materia_prima',
          nombre: 'Piedra',
          monto: 150.00,
          porcentaje: 12.0,
          variacion: -0.3
        },
        {
          tipo: 'laboral',
          nombre: 'Mano de obra',
          monto: 300.00,
          porcentaje: 24.0,
          variacion: 2.1
        },
        {
          tipo: 'servicios',
          nombre: 'Energía eléctrica',
          monto: 50.20,
          porcentaje: 4.0,
          variacion: 1.8
        },
        {
          tipo: 'servicios',
          nombre: 'Agua',
          monto: 30.00,
          porcentaje: 2.4,
          variacion: 0.0
        },
        {
          tipo: 'indirectos',
          nombre: 'Gastos generales',
          monto: 20.00,
          porcentaje: 1.6,
          variacion: 0.0
        }
      ],
      costoTotal: 1250.50,
      margenActual: 25.5,
      margenObjetivo: 30.0,
      precioVentaActual: 1570.00,
      precioVentaSugerido: 1625.65,
      estado: 'ok'
    },
    2: {
      id: 2,
      nombre: 'Vigueta',
      categoria: 'Viguetas',
      componentes: [
        {
          tipo: 'materia_prima',
          nombre: 'Cemento',
          monto: 800.50,
          porcentaje: 38.1,
          variacion: 1.5
        },
        {
          tipo: 'materia_prima',
          nombre: 'Arena',
          monto: 400.00,
          porcentaje: 19.0,
          variacion: 0.8
        },
        {
          tipo: 'materia_prima',
          nombre: 'Piedra',
          monto: 200.00,
          porcentaje: 9.5,
          variacion: -0.2
        },
        {
          tipo: 'laboral',
          nombre: 'Mano de obra',
          monto: 500.00,
          porcentaje: 23.8,
          variacion: 2.3
        },
        {
          tipo: 'servicios',
          nombre: 'Energía eléctrica',
          monto: 100.25,
          porcentaje: 4.8,
          variacion: 2.1
        },
        {
          tipo: 'servicios',
          nombre: 'Agua',
          monto: 50.00,
          porcentaje: 2.4,
          variacion: 0.0
        },
        {
          tipo: 'indirectos',
          nombre: 'Gastos generales',
          monto: 50.00,
          porcentaje: 2.4,
          variacion: 0.0
        }
      ],
      costoTotal: 2100.75,
      margenActual: 22.8,
      margenObjetivo: 30.0,
      precioVentaActual: 2720.00,
      precioVentaSugerido: 2731.00,
      estado: 'warning'
    },
    3: {
      id: 3,
      nombre: 'Adoquín',
      categoria: 'Adoquines',
      componentes: [
        {
          tipo: 'materia_prima',
          nombre: 'Cemento',
          monto: 300.00,
          porcentaje: 33.7,
          variacion: 1.0
        },
        {
          tipo: 'materia_prima',
          nombre: 'Arena',
          monto: 200.00,
          porcentaje: 22.5,
          variacion: 0.3
        },
        {
          tipo: 'materia_prima',
          nombre: 'Piedra',
          monto: 100.00,
          porcentaje: 11.2,
          variacion: -0.1
        },
        {
          tipo: 'laboral',
          nombre: 'Mano de obra',
          monto: 200.00,
          porcentaje: 22.5,
          variacion: 1.8
        },
        {
          tipo: 'servicios',
          nombre: 'Energía eléctrica',
          monto: 40.25,
          porcentaje: 4.5,
          variacion: 1.2
        },
        {
          tipo: 'servicios',
          nombre: 'Agua',
          monto: 20.00,
          porcentaje: 2.2,
          variacion: 0.0
        },
        {
          tipo: 'indirectos',
          nombre: 'Gastos generales',
          monto: 30.00,
          porcentaje: 3.4,
          variacion: 0.0
        }
      ],
      costoTotal: 890.25,
      margenActual: 28.3,
      margenObjetivo: 30.0,
      precioVentaActual: 1240.00,
      precioVentaSugerido: 1157.33,
      estado: 'ok'
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      // Simular carga de datos
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setProductos(mockProductos);
      setFilteredProductos(mockProductos);
      setIsLoading(false);
    };

    loadData();
  }, []);

  useEffect(() => {
    let filtered = productos;

    if (searchTerm) {
      filtered = filtered.filter(producto =>
        producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        producto.categoria.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategoria !== 'todas') {
      filtered = filtered.filter(producto => producto.categoria === selectedCategoria);
    }

    setFilteredProductos(filtered);
  }, [productos, searchTerm, selectedCategoria]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getEstadoBadge = (estado: 'ok' | 'warning' | 'danger') => {
    const variants = {
      ok: 'bg-green-100 text-green-800 hover:bg-green-100',
      warning: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
      danger: 'bg-red-100 text-red-800 hover:bg-red-100'
    };
    
    const labels = {
      ok: 'OK',
      warning: 'Atención',
      danger: 'Crítico'
    };

    return <Badge className={variants[estado]}>{labels[estado]}</Badge>;
  };

  const getVariacionIcon = (variacion: number) => {
    if (variacion > 0) {
      return <TrendingUp className="h-4 w-4 text-red-500" />;
    } else if (variacion < 0) {
      return <TrendingDown className="h-4 w-4 text-green-500" />;
    } else {
      return <TrendingUp className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleViewProducto = (producto: Producto) => {
    const detalle = mockDetalles[producto.id];
    if (detalle) {
      setSelectedProducto(detalle);
      setIsDetailModalOpen(true);
    }
  };

  const getComponenteIcon = (tipo: string) => {
    switch (tipo) {
      case 'materia_prima':
        return <Package className="h-4 w-4" />;
      case 'laboral':
        return <Users className="h-4 w-4" />;
      case 'servicios':
        return <Zap className="h-4 w-4" />;
      case 'indirectos':
        return <Calculator className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getComponenteColor = (tipo: string) => {
    switch (tipo) {
      case 'materia_prima':
        return 'text-blue-600';
      case 'laboral':
        return 'text-green-600';
      case 'servicios':
        return 'text-orange-600';
      case 'indirectos':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
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
            <h1 className="text-3xl font-bold tracking-tight">Costo Total de Productos</h1>
            <p className="text-muted-foreground">
              Análisis completo del costo total por producto con todos sus componentes
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productos.length}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Productos activos</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo Promedio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(productos.reduce((sum, p) => sum + p.costoTotal, 0) / productos.length)}
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-red-500" />
              <span>+2.1% vs mes anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margen Promedio</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentage(productos.reduce((sum, p) => sum + p.margen, 0) / productos.length)}
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>Objetivo: 30%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado General</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {productos.filter(p => p.estado === 'ok').length}/{productos.length}
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Productos OK</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="analisis">Análisis</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
        </TabsList>

        <TabsContent value="productos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Productos</CardTitle>
              <CardDescription>Costos totales desglosados por producto</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="flex items-center space-x-4 mb-6">
                <div className="flex-1">
                  <Label htmlFor="search">Buscar producto</Label>
                  <Input
                    id="search"
                    placeholder="Nombre del producto..."
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
                    {Array.from(new Set(productos.map(p => p.categoria))).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tabla de productos */}
              <div className="space-y-4">
                {filteredProductos.map((producto) => (
                  <div key={producto.id} className="border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors duration-200">
                    <div className="flex items-center justify-between p-4 border-b">
                      <div className="flex items-center space-x-4">
                        <div>
                          <div className="font-medium">{producto.nombre}</div>
                          <div className="text-sm text-muted-foreground">
                            {producto.categoria} • Última actualización: {producto.ultimaActualizacion}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="font-medium text-lg">{formatCurrency(producto.costoTotal)}</div>
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            {getVariacionIcon(producto.variacion)}
                            <span className={producto.variacion > 0 ? 'text-red-500' : 'text-green-500'}>
                              {producto.variacion > 0 ? '+' : ''}{producto.variacion.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                            {formatPercentage(producto.margen)}
                          </Badge>
                          {getEstadoBadge(producto.estado)}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewProducto(producto);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Materia Prima</div>
                          <div className="font-medium">{formatCurrency(producto.costoMateriaPrima)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Laboral</div>
                          <div className="font-medium">{formatCurrency(producto.costoLaboral)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Servicios</div>
                          <div className="font-medium">{formatCurrency(producto.costoServicios)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Indirectos</div>
                          <div className="font-medium">{formatCurrency(producto.costoIndirectos)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analisis" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Costos</CardTitle>
                <CardDescription>Porcentaje de cada componente en el costo total</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['Materia Prima', 'Laboral', 'Servicios', 'Indirectos'].map((tipo) => {
                    const total = productos.reduce((sum, p) => {
                      switch (tipo) {
                        case 'Materia Prima': return sum + p.costoMateriaPrima;
                        case 'Laboral': return sum + p.costoLaboral;
                        case 'Servicios': return sum + p.costoServicios;
                        case 'Indirectos': return sum + p.costoIndirectos;
                        default: return sum;
                      }
                    }, 0);
                    const porcentaje = (total / productos.reduce((sum, p) => sum + p.costoTotal, 0)) * 100;
                    
                    return (
                      <div key={tipo} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                          <span className="text-sm font-medium">{tipo}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(total)}</div>
                          <div className="text-xs text-muted-foreground">{formatPercentage(porcentaje)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Márgenes por Producto</CardTitle>
                <CardDescription>Comparación de márgenes actuales vs objetivo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {productos.map((producto) => (
                    <div key={producto.id} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{producto.nombre}</div>
                        <div className="text-sm text-muted-foreground">{producto.categoria}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatPercentage(producto.margen)}</div>
                        <div className="text-xs text-muted-foreground">
                          Objetivo: 30%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reportes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reportes de Costos</CardTitle>
              <CardDescription>Análisis detallado y exportación de datos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Button variant="outline" className="h-20 flex-col">
                  <BarChart3 className="h-6 w-6 mb-2" />
                  <span>Evolución de Costos</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col">
                  <Target className="h-6 w-6 mb-2" />
                  <span>Análisis de Márgenes</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col">
                  <TrendingUp className="h-6 w-6 mb-2" />
                  <span>Comparativa Mensual</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col">
                  <AlertTriangle className="h-6 w-6 mb-2" />
                  <span>Alertas de Costos</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col">
                  <Download className="h-6 w-6 mb-2" />
                  <span>Exportar Excel</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col">
                  <FileText className="h-6 w-6 mb-2" />
                  <span>Reporte PDF</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Detalle del Producto */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Detalle de Costos: {selectedProducto?.nombre}</DialogTitle>
            <DialogDescription>
              Análisis completo del costo total y sus componentes
            </DialogDescription>
          </DialogHeader>
          {selectedProducto && (
            <div className="space-y-6">
              {/* Resumen general */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">Costo Total</div>
                  <div className="text-2xl font-bold">{formatCurrency(selectedProducto.costoTotal)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Margen Actual</div>
                  <div className="text-2xl font-bold">{formatPercentage(selectedProducto.margenActual)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Precio Venta Actual</div>
                  <div className="text-lg font-semibold">{formatCurrency(selectedProducto.precioVentaActual)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Precio Sugerido</div>
                  <div className="text-lg font-semibold">{formatCurrency(selectedProducto.precioVentaSugerido)}</div>
                </div>
              </div>

              {/* Componentes del costo */}
              <div>
                <h3 className="font-medium mb-4">Componentes del Costo</h3>
                <div className="space-y-3">
                  {selectedProducto.componentes.map((componente, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full bg-muted ${getComponenteColor(componente.tipo)}`}>
                          {getComponenteIcon(componente.tipo)}
                        </div>
                        <div>
                          <div className="font-medium">{componente.nombre}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatPercentage(componente.porcentaje)} del costo total
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(componente.monto)}</div>
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          {getVariacionIcon(componente.variacion)}
                          <span className={componente.variacion > 0 ? 'text-red-500' : 'text-green-500'}>
                            {componente.variacion > 0 ? '+' : ''}{componente.variacion.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Análisis de márgenes */}
              <div>
                <h3 className="font-medium mb-4">Análisis de Márgenes</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Margen Actual</div>
                    <div className="text-2xl font-bold">{formatPercentage(selectedProducto.margenActual)}</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedProducto.margenActual >= selectedProducto.margenObjetivo ? '✅' : '⚠️'} 
                      Objetivo: {formatPercentage(selectedProducto.margenObjetivo)}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Diferencia</div>
                    <div className="text-2xl font-bold">
                      {formatPercentage(selectedProducto.margenActual - selectedProducto.margenObjetivo)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedProducto.margenActual >= selectedProducto.margenObjetivo ? 'Por encima' : 'Por debajo'} del objetivo
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
              Cerrar
            </Button>
            <Button>
              <Download className="h-4 w-4 mr-2" />
              Exportar Detalle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 