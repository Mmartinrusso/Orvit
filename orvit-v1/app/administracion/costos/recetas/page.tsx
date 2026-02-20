'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  BookOpen, 
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
  Calculator,
  History,
  Edit,
  Trash2,
  Eye,
  Copy,
  Save
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';

interface Receta {
  id: number;
  nombre: string;
  categoria: string;
  version: string;
  costoUnitario: number;
  costoAnterior: number;
  variacion: number;
  margen: number;
  estado: 'ok' | 'warning' | 'danger';
  ultimaActualizacion: string;
  insumos: InsumoReceta[];
  descripcion?: string;
  observaciones?: string;
}

interface InsumoReceta {
  id: number;
  nombre: string;
  cantidad: number;
  unidad: string;
  costoUnitario: number;
  costoTotal: number;
  merma: number;
}

interface CategoriaReceta {
  id: number;
  nombre: string;
  recetas: number;
  costoPromedio: number;
  variacion: number;
  descripcion?: string;
}

interface VersionReceta {
  id: number;
  receta: string;
  version: string;
  fecha: string;
  costoUnitario: number;
  motivo: string;
  realizadoPor?: string;
}

interface InsumoDisponible {
  id: number;
  nombre: string;
  categoria: string;
  unidad: string;
  precioActual: number;
  stock: number;
}

interface NuevaReceta {
  nombre: string;
  categoria: string;
  descripcion: string;
  observaciones: string;
  insumos: Omit<InsumoReceta, 'id' | 'costoTotal'>[];
}

interface NuevaCategoria {
  nombre: string;
  descripcion: string;
}

export default function RecetasPage() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [categorias, setCategorias] = useState<CategoriaReceta[]>([]);
  const [versiones, setVersiones] = useState<VersionReceta[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('todas');
  const [activeTab, setActiveTab] = useState('recetas');

  // Estados para modales
  const [isRecetaModalOpen, setIsRecetaModalOpen] = useState(false);
  const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false);
  const [isEditRecetaModalOpen, setIsEditRecetaModalOpen] = useState(false);
  const [isEditCategoriaModalOpen, setIsEditCategoriaModalOpen] = useState(false);
  const [isViewRecetaModalOpen, setIsViewRecetaModalOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);

  // Estados para formularios
  const [nuevaReceta, setNuevaReceta] = useState<NuevaReceta>({
    nombre: '',
    categoria: '',
    descripcion: '',
    observaciones: '',
    insumos: []
  });
  const [nuevaCategoria, setNuevaCategoria] = useState<NuevaCategoria>({
    nombre: '',
    descripcion: ''
  });
  const [editingReceta, setEditingReceta] = useState<Receta | null>(null);
  const [editingCategoria, setEditingCategoria] = useState<CategoriaReceta | null>(null);
  const [selectedRecetaForView, setSelectedRecetaForView] = useState<Receta | null>(null);
  const [selectedRecetaForVersion, setSelectedRecetaForVersion] = useState<Receta | null>(null);

  // Datos mock para insumos disponibles
  const [insumosDisponibles] = useState<InsumoDisponible[]>([
    { id: 1, nombre: 'Cemento Portland', categoria: 'Cementos', unidad: 'kg', precioActual: 850, stock: 5000 },
    { id: 2, nombre: 'Arena Fina', categoria: 'Áridos', unidad: 'm³', precioActual: 4500, stock: 100 },
    { id: 3, nombre: 'Piedra Partida', categoria: 'Áridos', unidad: 'm³', precioActual: 5200, stock: 80 },
    { id: 4, nombre: 'Hierro 6mm', categoria: 'Acero', unidad: 'kg', precioActual: 1200, stock: 2000 },
    { id: 5, nombre: 'Hierro 8mm', categoria: 'Acero', unidad: 'kg', precioActual: 1150, stock: 1500 },
    { id: 6, nombre: 'Aditivo Plastificante', categoria: 'Aditivos', unidad: 'L', precioActual: 2500, stock: 200 }
  ]);

  useEffect(() => {
    // Simular carga de datos
    const loadData = async () => {
      setIsLoading(true);
      
      // Simular delay de carga
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Datos de ejemplo
      setRecetas([
        {
          id: 1,
          nombre: 'Bloque 20x20x40',
          categoria: 'Bloques',
          version: 'v2.1',
          costoUnitario: 45.50,
          costoAnterior: 42.80,
          variacion: 6.31,
          margen: 25.3,
          estado: 'ok',
          ultimaActualizacion: '2024-01-15',
          insumos: [
            { id: 1, nombre: 'Cemento Portland', cantidad: 8.5, unidad: 'kg', costoUnitario: 850, costoTotal: 7225, merma: 2 },
            { id: 2, nombre: 'Arena Fina', cantidad: 0.025, unidad: 'm³', costoUnitario: 4500, costoTotal: 112.5, merma: 5 },
            { id: 3, nombre: 'Piedra Partida', cantidad: 0.015, unidad: 'm³', costoUnitario: 5200, costoTotal: 78, merma: 3 }
          ]
        },
        {
          id: 2,
          nombre: 'Vigueta 12x30',
          categoria: 'Viguetas',
          version: 'v1.8',
          costoUnitario: 78.20,
          costoAnterior: 75.50,
          variacion: 3.58,
          margen: 18.7,
          estado: 'warning',
          ultimaActualizacion: '2024-01-10',
          insumos: [
            { id: 4, nombre: 'Cemento Portland', cantidad: 12.0, unidad: 'kg', costoUnitario: 850, costoTotal: 10200, merma: 2 },
            { id: 5, nombre: 'Hierro 6mm', cantidad: 2.5, unidad: 'kg', costoUnitario: 1200, costoTotal: 3000, merma: 1 },
            { id: 6, nombre: 'Arena Fina', cantidad: 0.035, unidad: 'm³', costoUnitario: 4500, costoTotal: 157.5, merma: 5 }
          ]
        },
        {
          id: 3,
          nombre: 'Adoquín 20x10',
          categoria: 'Adoquines',
          version: 'v1.5',
          costoUnitario: 32.80,
          costoAnterior: 32.80,
          variacion: 0,
          margen: 32.1,
          estado: 'ok',
          ultimaActualizacion: '2024-01-12',
          insumos: [
            { id: 7, nombre: 'Cemento Portland', cantidad: 6.0, unidad: 'kg', costoUnitario: 850, costoTotal: 5100, merma: 2 },
            { id: 8, nombre: 'Arena Fina', cantidad: 0.020, unidad: 'm³', costoUnitario: 4500, costoTotal: 90, merma: 5 }
          ]
        },
        {
          id: 4,
          nombre: 'Losa 60x60',
          categoria: 'Losas',
          version: 'v1.2',
          costoUnitario: 125.40,
          costoAnterior: 118.90,
          variacion: 5.47,
          margen: 15.2,
          estado: 'danger',
          ultimaActualizacion: '2024-01-08',
          insumos: [
            { id: 9, nombre: 'Cemento Portland', cantidad: 18.0, unidad: 'kg', costoUnitario: 850, costoTotal: 15300, merma: 2 },
            { id: 10, nombre: 'Arena Fina', cantidad: 0.045, unidad: 'm³', costoUnitario: 4500, costoTotal: 202.5, merma: 5 },
            { id: 11, nombre: 'Piedra Partida', cantidad: 0.025, unidad: 'm³', costoUnitario: 5200, costoTotal: 130, merma: 3 }
          ]
        }
      ]);
      
      setCategorias([
        {
          id: 1,
          nombre: 'Bloques',
          recetas: 3,
          costoPromedio: 45.50,
          variacion: 6.3
        },
        {
          id: 2,
          nombre: 'Viguetas',
          recetas: 2,
          costoPromedio: 78.20,
          variacion: 3.6
        },
        {
          id: 3,
          nombre: 'Adoquines',
          recetas: 2,
          costoPromedio: 32.80,
          variacion: 0
        },
        {
          id: 4,
          nombre: 'Losas',
          recetas: 1,
          costoPromedio: 125.40,
          variacion: 5.5
        }
      ]);
      
      setVersiones([
        {
          id: 1,
          receta: 'Bloque 20x20x40',
          version: 'v2.1',
          fecha: '2024-01-15',
          costoUnitario: 45.50,
          motivo: 'Ajuste de precios de insumos'
        },
        {
          id: 2,
          receta: 'Vigueta 12x30',
          version: 'v1.8',
          fecha: '2024-01-10',
          costoUnitario: 78.20,
          motivo: 'Actualización de fórmula'
        },
        {
          id: 3,
          receta: 'Losa 60x60',
          version: 'v1.2',
          fecha: '2024-01-08',
          costoUnitario: 125.40,
          motivo: 'Incremento de costos'
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

  const getMargenBadge = (margen: number) => {
    if (margen >= 25) {
      return <Badge className="bg-success-muted text-success hover:bg-success-muted">{margen.toFixed(1)}%</Badge>;
    } else if (margen >= 15) {
      return <Badge className="bg-warning-muted text-warning-muted-foreground hover:bg-warning-muted">{margen.toFixed(1)}%</Badge>;
    } else {
      return <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10">{margen.toFixed(1)}%</Badge>;
    }
  };

  // Funciones para modales
  const handleCreateReceta = () => {
    const nuevaRecetaCompleta: Receta = {
      id: Math.max(...recetas.map(r => r.id)) + 1,
      nombre: nuevaReceta.nombre,
      categoria: nuevaReceta.categoria,
      version: 'v1.0',
      costoUnitario: nuevaReceta.insumos.reduce((sum, insumo) => {
        const costoTotal = insumo.cantidad * insumo.costoUnitario * (1 + insumo.merma / 100);
        return sum + costoTotal;
      }, 0),
      costoAnterior: 0,
      variacion: 0,
      margen: 25, // Margen por defecto
      estado: 'ok',
      ultimaActualizacion: new Date().toISOString().split('T')[0],
      insumos: nuevaReceta.insumos.map((insumo, index) => ({
        id: index + 1,
        ...insumo,
        costoTotal: insumo.cantidad * insumo.costoUnitario * (1 + insumo.merma / 100)
      })),
      descripcion: nuevaReceta.descripcion,
      observaciones: nuevaReceta.observaciones
    };

    setRecetas([...recetas, nuevaRecetaCompleta]);
    setNuevaReceta({
      nombre: '',
      categoria: '',
      descripcion: '',
      observaciones: '',
      insumos: []
    });
    setIsRecetaModalOpen(false);
  };

  const handleCreateCategoria = () => {
    const nuevaCategoriaCompleta: CategoriaReceta = {
      id: Math.max(...categorias.map(c => c.id)) + 1,
      nombre: nuevaCategoria.nombre,
      recetas: 0,
      costoPromedio: 0,
      variacion: 0,
      descripcion: nuevaCategoria.descripcion
    };

    setCategorias([...categorias, nuevaCategoriaCompleta]);
    setNuevaCategoria({
      nombre: '',
      descripcion: ''
    });
    setIsCategoriaModalOpen(false);
  };

  const handleEditReceta = (receta: Receta) => {
    setEditingReceta(receta);
    setIsEditRecetaModalOpen(true);
  };

  const handleUpdateReceta = () => {
    if (!editingReceta) return;

    const recetaActualizada = {
      ...editingReceta,
      costoUnitario: editingReceta.insumos.reduce((sum, insumo) => {
        const costoTotal = insumo.cantidad * insumo.costoUnitario * (1 + insumo.merma / 100);
        return sum + costoTotal;
      }, 0)
    };

    setRecetas(recetas.map(r => r.id === editingReceta.id ? recetaActualizada : r));
    setEditingReceta(null);
    setIsEditRecetaModalOpen(false);
  };

  const handleEditCategoria = (categoria: CategoriaReceta) => {
    setEditingCategoria(categoria);
    setIsEditCategoriaModalOpen(true);
  };

  const handleUpdateCategoria = () => {
    if (!editingCategoria) return;

    setCategorias(categorias.map(c => c.id === editingCategoria.id ? editingCategoria : c));
    setEditingCategoria(null);
    setIsEditCategoriaModalOpen(false);
  };

  const handleViewReceta = (receta: Receta) => {
    setSelectedRecetaForView(receta);
    setIsViewRecetaModalOpen(true);
  };

  const handleCreateVersion = (receta: Receta) => {
    setSelectedRecetaForVersion(receta);
    setIsVersionModalOpen(true);
  };

  const handleAddInsumo = () => {
    setNuevaReceta({
      ...nuevaReceta,
      insumos: [...nuevaReceta.insumos, {
        nombre: '',
        cantidad: 0,
        unidad: '',
        costoUnitario: 0,
        merma: 0
      }]
    });
  };

  const handleRemoveInsumo = (index: number) => {
    setNuevaReceta({
      ...nuevaReceta,
      insumos: nuevaReceta.insumos.filter((_, i) => i !== index)
    });
  };

  const handleInsumoChange = (index: number, field: keyof Omit<InsumoReceta, 'id' | 'costoTotal'>, value: string | number) => {
    const insumosActualizados = [...nuevaReceta.insumos];
    insumosActualizados[index] = {
      ...insumosActualizados[index],
      [field]: value
    };
    setNuevaReceta({
      ...nuevaReceta,
      insumos: insumosActualizados
    });
  };

  const getButtonText = () => {
    switch (activeTab) {
      case 'recetas':
        return 'Nueva Receta';
      case 'categorias':
        return 'Nueva Categoría';
      default:
        return 'Nuevo';
    }
  };

  const handleButtonClick = () => {
    switch (activeTab) {
      case 'recetas':
        setIsRecetaModalOpen(true);
        break;
      case 'categorias':
        setIsCategoriaModalOpen(true);
        break;
    }
  };

  const filteredRecetas = recetas.filter(receta => {
    const matchesSearch = receta.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = selectedCategoria === 'todas' || receta.categoria === selectedCategoria;
    return matchesSearch && matchesCategoria;
  });

  const totalCostoRecetas = recetas.reduce((sum, receta) => sum + receta.costoUnitario, 0);

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
            <h1 className="text-3xl font-bold tracking-tight">Recetas de Producto</h1>
            <p className="text-muted-foreground">
              Gestión de fórmulas, costos unitarios y versionado de recetas
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
            <Button onClick={handleButtonClick}>
              <Plus className="h-4 w-4 mr-2" />
              {getButtonText()}
            </Button>
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recetas</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recetas.length}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              <span>Recetas activas</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo Promedio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCostoRecetas / recetas.length)}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-destructive" />
              <span>+3.8% vs mes anterior</span>
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
            <CardTitle className="text-sm font-medium">Versiones</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{versiones.length}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <History className="h-4 w-4" />
              <span>Este mes</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="recetas">Recetas</TabsTrigger>
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="versiones">Versiones</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
        </TabsList>

        <TabsContent value="recetas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Recetas</CardTitle>
              <CardDescription>Gestión completa de recetas y sus costos</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="flex items-center space-x-4 mb-6">
                <div className="flex-1">
                  <Label htmlFor="search">Buscar receta</Label>
                  <Input
                    id="search"
                    placeholder="Nombre de la receta..."
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

              {/* Tabla de recetas */}
              <div className="space-y-4">
                {filteredRecetas.map((receta) => (
                  <div key={receta.id} className="border rounded-lg hover:bg-muted/30 cursor-pointer">
                    <div className="flex items-center justify-between p-4 border-b">
                      <div className="flex items-center space-x-4">
                        <div>
                          <div className="font-medium">{receta.nombre}</div>
                          <div className="text-sm text-muted-foreground">
                            {receta.categoria} • Versión {receta.version} • {receta.insumos.length} insumos
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(receta.costoUnitario)}</div>
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            {getVariacionIcon(receta.variacion)}
                            <span className={receta.variacion > 0 ? 'text-destructive' : 'text-success'}>
                              {receta.variacion > 0 ? '+' : ''}{receta.variacion.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getMargenBadge(receta.margen)}
                          {getEstadoBadge(receta.estado)}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewReceta(receta);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditReceta(receta);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateVersion(receta);
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="text-sm font-medium mb-2">Insumos:</div>
                      <div className="grid gap-2 md:grid-cols-3">
                        {receta.insumos.map((insumo) => (
                          <div key={insumo.id} className="flex justify-between text-sm">
                            <span>{insumo.nombre}</span>
                            <span className="text-muted-foreground">
                              {insumo.cantidad} {insumo.unidad} • {formatCurrency(insumo.costoTotal)}
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

        <TabsContent value="categorias" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Categorías de Recetas</CardTitle>
              <CardDescription>Análisis de costos por categoría</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categorias.map((categoria) => (
                  <div key={categoria.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 cursor-pointer">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">{categoria.nombre}</div>
                        <div className="text-sm text-muted-foreground">
                          {categoria.recetas} recetas
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(categoria.costoPromedio)}</div>
                        <div className="text-sm text-muted-foreground">Costo promedio</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{categoria.variacion > 0 ? '+' : ''}{categoria.variacion.toFixed(1)}%</div>
                        <div className="text-sm text-muted-foreground">Variación</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCategoria(categoria);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versiones" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Versiones</CardTitle>
              <CardDescription>Registro de cambios y versionado de recetas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {versiones.map((version) => (
                  <div key={version.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">{version.receta}</div>
                        <div className="text-sm text-muted-foreground">
                          Versión {version.version} • {version.motivo}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(version.costoUnitario)}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(version.fecha)}
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
                    const porcentaje = (categoria.costoPromedio / (totalCostoRecetas / recetas.length)) * 100;
                    return (
                      <div key={categoria.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full bg-primary"></div>
                          <span className="text-sm font-medium">{categoria.nombre}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{formatCurrency(categoria.costoPromedio)}</div>
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
                <CardDescription>Estado actual del sistema de recetas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span>Losa 60x60 margen bajo</span>
                  </div>
                  <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10">Crítico</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
                    <span>Vigueta 12x30 margen bajo</span>
                  </div>
                  <Badge className="bg-warning-muted text-warning-muted-foreground hover:bg-warning-muted">Atención</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span>Bloque 20x20x40 estable</span>
                  </div>
                  <Badge className="bg-success-muted text-success hover:bg-success-muted">OK</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal Nueva Receta */}
      <Dialog open={isRecetaModalOpen} onOpenChange={setIsRecetaModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Receta</DialogTitle>
            <DialogDescription>
              Crea una nueva receta de producto con sus insumos y costos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nombre">Nombre de la Receta</Label>
                <Input
                  id="nombre"
                  placeholder="Ej: Bloque 20x20x40"
                  value={nuevaReceta.nombre}
                  onChange={(e) => setNuevaReceta({...nuevaReceta, nombre: e.target.value})}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => e.key === 'Enter' && document.getElementById('categoria')?.focus()}
                />
              </div>
              <div>
                <Label htmlFor="categoria">Categoría</Label>
                <Select value={nuevaReceta.categoria} onValueChange={(value) => setNuevaReceta({...nuevaReceta, categoria: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map(cat => (
                      <SelectItem key={cat.id} value={cat.nombre}>{cat.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                placeholder="Descripción detallada de la receta..."
                value={nuevaReceta.descripcion}
                onChange={(e) => setNuevaReceta({...nuevaReceta, descripcion: e.target.value})}
                onFocus={(e) => e.target.select()}
              />
            </div>

            <div>
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                placeholder="Observaciones adicionales..."
                value={nuevaReceta.observaciones}
                onChange={(e) => setNuevaReceta({...nuevaReceta, observaciones: e.target.value})}
                onFocus={(e) => e.target.select()}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <Label>Insumos</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddInsumo}>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Insumo
                </Button>
              </div>
              
              <div className="space-y-4">
                {nuevaReceta.insumos.map((insumo, index) => (
                  <div key={index} className="grid grid-cols-6 gap-4 p-4 border rounded-lg">
                    <div className="col-span-2">
                      <Label>Insumo</Label>
                      <Select 
                        value={insumo.nombre} 
                        onValueChange={(value) => {
                          const insumoSeleccionado = insumosDisponibles.find(i => i.nombre === value);
                          handleInsumoChange(index, 'nombre', value);
                          if (insumoSeleccionado) {
                            handleInsumoChange(index, 'unidad', insumoSeleccionado.unidad);
                            handleInsumoChange(index, 'costoUnitario', insumoSeleccionado.precioActual);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona insumo" />
                        </SelectTrigger>
                        <SelectContent>
                          {insumosDisponibles.map(ins => (
                            <SelectItem key={ins.id} value={ins.nombre}>{ins.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={insumo.cantidad || ''}
                        onChange={(e) => handleInsumoChange(index, 'cantidad', parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => e.key === 'Enter' && document.getElementById(`unidad-${index}`)?.focus()}
                      />
                    </div>
                    <div>
                      <Label>Unidad</Label>
                      <Input
                        id={`unidad-${index}`}
                        placeholder="kg"
                        value={insumo.unidad}
                        onChange={(e) => handleInsumoChange(index, 'unidad', e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => e.key === 'Enter' && document.getElementById(`costo-${index}`)?.focus()}
                      />
                    </div>
                    <div>
                      <Label>Costo Unitario</Label>
                      <Input
                        id={`costo-${index}`}
                        type="number"
                        placeholder="0"
                        value={insumo.costoUnitario || ''}
                        onChange={(e) => handleInsumoChange(index, 'costoUnitario', parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => e.key === 'Enter' && document.getElementById(`merma-${index}`)?.focus()}
                      />
                    </div>
                    <div>
                      <Label>Merma (%)</Label>
                      <Input
                        id={`merma-${index}`}
                        type="number"
                        placeholder="0"
                        value={insumo.merma || ''}
                        onChange={(e) => handleInsumoChange(index, 'merma', parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddInsumo()}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveInsumo(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRecetaModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateReceta}>
              <Save className="h-4 w-4 mr-2" />
              Crear Receta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Nueva Categoría */}
      <Dialog open={isCategoriaModalOpen} onOpenChange={setIsCategoriaModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Categoría</DialogTitle>
            <DialogDescription>
              Crea una nueva categoría para organizar las recetas
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="categoria-nombre">Nombre de la Categoría</Label>
              <Input
                id="categoria-nombre"
                placeholder="Ej: Bloques"
                value={nuevaCategoria.nombre}
                onChange={(e) => setNuevaCategoria({...nuevaCategoria, nombre: e.target.value})}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => e.key === 'Enter' && document.getElementById('categoria-descripcion')?.focus()}
              />
            </div>
            <div>
              <Label htmlFor="categoria-descripcion">Descripción</Label>
              <Textarea
                id="categoria-descripcion"
                placeholder="Descripción de la categoría..."
                value={nuevaCategoria.descripcion}
                onChange={(e) => setNuevaCategoria({...nuevaCategoria, descripcion: e.target.value})}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCategoria()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoriaModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateCategoria}>
              <Save className="h-4 w-4 mr-2" />
              Crear Categoría
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Receta */}
      <Dialog open={isEditRecetaModalOpen} onOpenChange={setIsEditRecetaModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Receta</DialogTitle>
            <DialogDescription>
              Modifica los detalles de la receta y sus insumos
            </DialogDescription>
          </DialogHeader>
          {editingReceta && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-nombre">Nombre de la Receta</Label>
                  <Input
                    id="edit-nombre"
                    placeholder="Ej: Bloque 20x20x40"
                    value={editingReceta.nombre}
                    onChange={(e) => setEditingReceta({...editingReceta, nombre: e.target.value})}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-categoria">Categoría</Label>
                  <Select value={editingReceta.categoria} onValueChange={(value) => setEditingReceta({...editingReceta, categoria: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map(cat => (
                        <SelectItem key={cat.id} value={cat.nombre}>{cat.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="edit-descripcion">Descripción</Label>
                <Textarea
                  id="edit-descripcion"
                  placeholder="Descripción detallada de la receta..."
                  value={editingReceta.descripcion || ''}
                  onChange={(e) => setEditingReceta({...editingReceta, descripcion: e.target.value})}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div>
                <Label htmlFor="edit-observaciones">Observaciones</Label>
                <Textarea
                  id="edit-observaciones"
                  placeholder="Observaciones adicionales..."
                  value={editingReceta.observaciones || ''}
                  onChange={(e) => setEditingReceta({...editingReceta, observaciones: e.target.value})}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label>Insumos</Label>
                  <div className="text-sm text-muted-foreground">
                    Costo Total: {formatCurrency(editingReceta.insumos.reduce((sum, insumo) => sum + insumo.costoTotal, 0))}
                  </div>
                </div>
                
                <div className="space-y-4">
                  {editingReceta.insumos.map((insumo, index) => (
                    <div key={insumo.id} className="grid grid-cols-6 gap-4 p-4 border rounded-lg">
                      <div className="col-span-2">
                        <Label>Insumo</Label>
                        <Input
                          value={insumo.nombre}
                          onChange={(e) => {
                            const insumosActualizados = [...editingReceta.insumos];
                            insumosActualizados[index] = {...insumo, nombre: e.target.value};
                            setEditingReceta({...editingReceta, insumos: insumosActualizados});
                          }}
                          onFocus={(e) => e.target.select()}
                        />
                      </div>
                      <div>
                        <Label>Cantidad</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={insumo.cantidad || ''}
                          onChange={(e) => {
                            const insumosActualizados = [...editingReceta.insumos];
                            const cantidad = parseFloat(e.target.value) || 0;
                            const costoTotal = cantidad * insumo.costoUnitario * (1 + insumo.merma / 100);
                            insumosActualizados[index] = {...insumo, cantidad, costoTotal};
                            setEditingReceta({...editingReceta, insumos: insumosActualizados});
                          }}
                          onFocus={(e) => e.target.select()}
                        />
                      </div>
                      <div>
                        <Label>Unidad</Label>
                        <Input
                          placeholder="kg"
                          value={insumo.unidad}
                          onChange={(e) => {
                            const insumosActualizados = [...editingReceta.insumos];
                            insumosActualizados[index] = {...insumo, unidad: e.target.value};
                            setEditingReceta({...editingReceta, insumos: insumosActualizados});
                          }}
                          onFocus={(e) => e.target.select()}
                        />
                      </div>
                      <div>
                        <Label>Costo Unitario</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={insumo.costoUnitario || ''}
                          onChange={(e) => {
                            const insumosActualizados = [...editingReceta.insumos];
                            const costoUnitario = parseFloat(e.target.value) || 0;
                            const costoTotal = insumo.cantidad * costoUnitario * (1 + insumo.merma / 100);
                            insumosActualizados[index] = {...insumo, costoUnitario, costoTotal};
                            setEditingReceta({...editingReceta, insumos: insumosActualizados});
                          }}
                          onFocus={(e) => e.target.select()}
                        />
                      </div>
                      <div>
                        <Label>Merma (%)</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={insumo.merma || ''}
                          onChange={(e) => {
                            const insumosActualizados = [...editingReceta.insumos];
                            const merma = parseFloat(e.target.value) || 0;
                            const costoTotal = insumo.cantidad * insumo.costoUnitario * (1 + merma / 100);
                            insumosActualizados[index] = {...insumo, merma, costoTotal};
                            setEditingReceta({...editingReceta, insumos: insumosActualizados});
                          }}
                          onFocus={(e) => e.target.select()}
                        />
                      </div>
                      <div className="flex items-end">
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(insumo.costoTotal)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditRecetaModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateReceta}>
              <Save className="h-4 w-4 mr-2" />
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Categoría */}
      <Dialog open={isEditCategoriaModalOpen} onOpenChange={setIsEditCategoriaModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Categoría</DialogTitle>
            <DialogDescription>
              Modifica los detalles de la categoría
            </DialogDescription>
          </DialogHeader>
          {editingCategoria && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-categoria-nombre">Nombre de la Categoría</Label>
                <Input
                  id="edit-categoria-nombre"
                  placeholder="Ej: Bloques"
                  value={editingCategoria.nombre}
                  onChange={(e) => setEditingCategoria({...editingCategoria, nombre: e.target.value})}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => e.key === 'Enter' && document.getElementById('edit-categoria-descripcion')?.focus()}
                />
              </div>
              <div>
                <Label htmlFor="edit-categoria-descripcion">Descripción</Label>
                <Textarea
                  id="edit-categoria-descripcion"
                  placeholder="Descripción de la categoría..."
                  value={editingCategoria.descripcion || ''}
                  onChange={(e) => setEditingCategoria({...editingCategoria, descripcion: e.target.value})}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdateCategoria()}
                />
              </div>
              <div>
                <Label>Recetas en esta categoría</Label>
                <div className="text-sm text-muted-foreground mt-1">
                  {recetas.filter(r => r.categoria === editingCategoria.nombre).length} recetas
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditCategoriaModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateCategoria}>
              <Save className="h-4 w-4 mr-2" />
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Ver Receta */}
      <Dialog open={isViewRecetaModalOpen} onOpenChange={setIsViewRecetaModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles de la Receta</DialogTitle>
            <DialogDescription>
              Información completa de la receta y sus costos
            </DialogDescription>
          </DialogHeader>
          {selectedRecetaForView && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Nombre</Label>
                  <div className="text-lg font-semibold">{selectedRecetaForView.nombre}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Categoría</Label>
                  <div className="text-lg">{selectedRecetaForView.categoria}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Versión</Label>
                  <div className="text-lg">{selectedRecetaForView.version}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Costo Unitario</Label>
                  <div className="text-lg font-semibold text-success">{formatCurrency(selectedRecetaForView.costoUnitario)}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Margen</Label>
                  <div className="text-lg">{getMargenBadge(selectedRecetaForView.margen)}</div>
                </div>
              </div>

              {selectedRecetaForView.descripcion && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Descripción</Label>
                  <div className="text-sm bg-muted p-3 rounded-md">{selectedRecetaForView.descripcion}</div>
                </div>
              )}

              {selectedRecetaForView.observaciones && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Observaciones</Label>
                  <div className="text-sm bg-muted p-3 rounded-md">{selectedRecetaForView.observaciones}</div>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium text-muted-foreground">Insumos</Label>
                <div className="space-y-2 mt-2">
                  {selectedRecetaForView.insumos.map((insumo) => (
                    <div key={insumo.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div>
                          <div className="font-medium">{insumo.nombre}</div>
                          <div className="text-sm text-muted-foreground">
                            {insumo.cantidad} {insumo.unidad} • Merma: {insumo.merma}%
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(insumo.costoTotal)}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(insumo.costoUnitario)} c/u
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Última Actualización</Label>
                  <div className="text-sm">{formatDate(selectedRecetaForView.ultimaActualizacion)}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Estado</Label>
                  <div className="text-sm">{getEstadoBadge(selectedRecetaForView.estado)}</div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewRecetaModalOpen(false)}>
              Cerrar
            </Button>
            {selectedRecetaForView && (
              <Button onClick={() => {
                setIsViewRecetaModalOpen(false);
                handleEditReceta(selectedRecetaForView);
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Editar Receta
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Crear Versión */}
      <Dialog open={isVersionModalOpen} onOpenChange={setIsVersionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Nueva Versión</DialogTitle>
            <DialogDescription>
              Crea una nueva versión de la receta con los cambios realizados
            </DialogDescription>
          </DialogHeader>
          {selectedRecetaForVersion && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Receta</Label>
                <div className="text-lg font-semibold">{selectedRecetaForVersion.nombre}</div>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Versión Actual</Label>
                <div className="text-lg">{selectedRecetaForVersion.version}</div>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Nueva Versión</Label>
                <div className="text-lg font-semibold text-info-muted-foreground">
                  v{(parseFloat(selectedRecetaForVersion.version.replace('v', '')) + 0.1).toFixed(1)}
                </div>
              </div>
              <div>
                <Label htmlFor="version-motivo">Motivo del Cambio</Label>
                <Textarea
                  id="version-motivo"
                  placeholder="Describe los cambios realizados..."
                  onFocus={(e) => e.target.select()}
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Costo Actual</Label>
                <div className="text-lg font-semibold text-success">{formatCurrency(selectedRecetaForVersion.costoUnitario)}</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVersionModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => {
              // Aquí se implementaría la lógica para crear la nueva versión
              setIsVersionModalOpen(false);
            }}>
              <Copy className="h-4 w-4 mr-2" />
              Crear Versión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 