'use client';

import { useState } from 'react';
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  DollarSign,
  BarChart3,
  FileText,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog';
import { useIndirectCosts } from '@/hooks/use-indirect-costs';
import { useIndirectCostsStats } from '@/hooks/use-indirect-costs-stats';

interface CostoIndirecto {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  month: string;
  description: string;
  status: 'pending' | 'paid' | 'overdue';
  dueDate: string;
  createdAt: string;
}

interface CategoriaCostoIndirecto {
  id: string;
  name: string;
  description: string;
  type: 'fixed' | 'variable' | 'periodic';
  color: string;
  icon: string;
}

interface CostosIndirectosProps {
  companyId: string;
}

export function CostosIndirectos({ companyId }: CostosIndirectosProps) {
  // Hooks para datos
  const { categories, costs, history, loading, error, createCategory, createCost, refreshData } = useIndirectCosts({ companyId });
  const { stats, loading: statsLoading, error: statsError, refreshStats } = useIndirectCostsStats({ companyId });
  
  // Estados para modales
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showCostDialog, setShowCostDialog] = useState(false);
  
  // Estados para formularios
  const [newCategory, setNewCategory] = useState({
    name: '',
    description: '',
    type: 'fixed' as const,
    color: '#3B82F6',
    icon: 'Building2'
  });
  
  const [newCost, setNewCost] = useState({
    name: '',
    categoryId: '',
    amount: '',
    month: new Date().toISOString().slice(0, 7),
    description: '',
    dueDate: new Date().toISOString().slice(0, 10),
    status: 'pending' as const
  });

  // Funciones helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatMonth = (month: string) => {
    if (!month) return '';
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('es-AR', { year: 'numeric', month: 'long' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="default" className="bg-success-muted text-success">Pagado</Badge>;
      case 'pending':
        return <Badge variant="outline" className="border-warning-muted text-warning-muted-foreground">Pendiente</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Vencido</Badge>;
      default:
        return <Badge variant="secondary">Desconocido</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'fixed':
        return <Badge variant="secondary">Fijo</Badge>;
      case 'variable':
        return <Badge variant="outline">Variable</Badge>;
      case 'periodic':
        return <Badge variant="default">Periódico</Badge>;
      default:
        return <Badge variant="secondary">Desconocido</Badge>;
    }
  };

  // Funciones de manejo
  const handleCreateCategory = async () => {
    const success = await createCategory({
      name: newCategory.name,
      description: newCategory.description,
      type: newCategory.type,
      color: newCategory.color,
      icon: newCategory.icon,
      companyId
    });

    if (success) {
      setNewCategory({ name: '', description: '', type: 'fixed', color: '#3B82F6', icon: 'Building2' });
      setShowCategoryDialog(false);
      refreshData();
    }
  };

  const handleCreateCost = async () => {
    const success = await createCost({
      name: newCost.name,
      categoryId: newCost.categoryId,
      amount: parseFloat(newCost.amount),
      month: newCost.month,
      description: newCost.description,
      dueDate: newCost.dueDate,
      status: newCost.status,
      companyId
    });

    if (success) {
      setNewCost({
        name: '',
        categoryId: '',
        amount: '',
        month: new Date().toISOString().slice(0, 7),
        description: '',
        dueDate: new Date().toISOString().slice(0, 10),
        status: 'pending'
      });
      setShowCostDialog(false);
      refreshData();
      refreshStats();
    }
  };

  // Calcular estadísticas
  const totalCosts = costs.reduce((sum, cost) => sum + cost.amount, 0);
  const paidCosts = costs.filter(cost => cost.status === 'paid').reduce((sum, cost) => sum + cost.amount, 0);
  const pendingCosts = costs.filter(cost => cost.status === 'pending').reduce((sum, cost) => sum + cost.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Costos Indirectos
          </h2>
          <p className="text-muted-foreground mt-1">
            Gestión de gastos operativos, impuestos y servicios de la empresa
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button variant="outline" onClick={() => setShowCategoryDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Categoría
          </Button>
          <Button onClick={() => setShowCostDialog(true)} className="bg-black hover:bg-foreground/90">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Costo
          </Button>
        </div>
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Costos</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCosts)}</div>
            <p className="text-xs text-muted-foreground">
              Costos del mes actual
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagados</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatCurrency(paidCosts)}</div>
            <p className="text-xs text-muted-foreground">
              {totalCosts > 0 ? ((paidCosts / totalCosts) * 100).toFixed(1) : 0}% del total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning-muted-foreground">{formatCurrency(pendingCosts)}</div>
            <p className="text-xs text-muted-foreground">
              {totalCosts > 0 ? ((pendingCosts / totalCosts) * 100).toFixed(1) : 0}% del total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorías</CardTitle>
            <BarChart3 className="h-4 w-4 text-info-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
            <p className="text-xs text-muted-foreground">
              Tipos de costos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principales */}
      <Tabs defaultValue="categorias" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="costos">Costos Mensuales</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="estadisticas">Estadísticas</TabsTrigger>
        </TabsList>

        {/* Tab: Categorías */}
        <TabsContent value="categorias" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Categorías de Costos Indirectos</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-foreground mx-auto" />
                  <p className="mt-2 text-muted-foreground">Cargando categorías...</p>
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p>No hay categorías disponibles</p>
                  <p className="text-sm">Crea tu primera categoría para comenzar</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {categories.map((category) => (
                    <div key={category.id} className="group relative flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-all duration-200">
                      <div className="flex items-center gap-4">
                        <div 
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-white"
                          style={{ backgroundColor: category.color }}
                        >
                          <Building2 className="h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{category.name}</h4>
                          <p className="text-sm text-muted-foreground">{category.description}</p>
                          <div className="flex gap-2 mt-2">
                            {getTypeBadge(category.type)}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Costos Mensuales */}
        <TabsContent value="costos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Costos del Mes - {formatMonth(costs[0]?.month || '')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-foreground mx-auto" />
                  <p className="mt-2 text-muted-foreground">Cargando costos...</p>
                </div>
              ) : costs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p>No hay costos registrados</p>
                  <p className="text-sm">Crea tu primer costo para comenzar</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {costs.map((cost) => (
                    <div key={cost.id} className="group relative flex items-center justify-between p-4 bg-muted rounded-lg hover:bg-accent transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-info-muted text-info-muted-foreground flex items-center justify-center">
                          <DollarSign className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold">{cost.name}</div>
                          <div className="text-sm text-muted-foreground">{cost.categoryName}</div>
                          <div className="text-sm text-muted-foreground">{cost.description}</div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span>Vencimiento: {new Date(cost.dueDate).toLocaleDateString('es-AR')}</span>
                            <span>•</span>
                            <span>Creado: {new Date(cost.createdAt).toLocaleDateString('es-AR')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-lg font-bold">{formatCurrency(cost.amount)}</div>
                          {getStatusBadge(cost.status)}
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4 mr-1" />
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Historial */}
        <TabsContent value="historial" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Historial de Costos
                <Button onClick={refreshData} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-foreground mx-auto" />
                  <p className="mt-2 text-muted-foreground">Cargando historial...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p>No hay historial disponible</p>
                  <p className="text-sm">Los cambios se registrarán automáticamente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-info-muted text-info-muted-foreground flex items-center justify-center">
                          <DollarSign className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold">{entry.costName}</div>
                          <div className="text-sm text-muted-foreground">{entry.categoryName}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleDateString('es-AR')} • {entry.month}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          {entry.oldAmount ? `${formatCurrency(entry.oldAmount)} → ` : ''}
                          {formatCurrency(entry.newAmount)}
                        </div>
                        <Badge variant="outline" className="mt-1">
                          {entry.changeType === 'created' ? 'Creado' : 
                           entry.changeType === 'updated' ? 'Actualizado' : 
                           entry.changeType === 'status_changed' ? 'Estado Cambiado' : 'Eliminado'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Estadísticas */}
        <TabsContent value="estadisticas" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Estadísticas y Análisis
                <Button onClick={refreshStats} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-foreground mx-auto" />
                  <p className="mt-2 text-muted-foreground">Cargando estadísticas...</p>
                </div>
              ) : statsError ? (
                <div className="text-center py-8 text-destructive">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
                  <p>Error: {statsError}</p>
                </div>
              ) : !stats ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p>No hay datos disponibles</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Métricas Generales */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Total General</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.general.totalGeneral)}</div>
                        <p className="text-sm text-muted-foreground">{stats.general.totalCostos} costos registrados</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Promedio por Costo</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.general.promedioCosto)}</div>
                        <p className="text-sm text-muted-foreground">{stats.general.totalCategorias} categorías activas</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Tendencia</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          {stats.tendencias.tendencia === 'incremento' ? (
                            <TrendingUp className="h-5 w-5 text-success" />
                          ) : stats.tendencias.tendencia === 'decremento' ? (
                            <TrendingDown className="h-5 w-5 text-destructive" />
                          ) : (
                            <BarChart3 className="h-5 w-5 text-muted-foreground" />
                          )}
                          <span className="text-2xl font-bold">{stats.tendencias.variacion}%</span>
                        </div>
                        <p className="text-sm text-muted-foreground">vs mes anterior</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Distribución por Categoría */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Distribución por Categoría</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {stats.distribucionPorCategoria.map((categoria) => (
                          <div key={categoria.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div>
                              <div className="font-medium">{categoria.name}</div>
                              <div className="text-sm text-muted-foreground">{categoria.costoCount} costos</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">{formatCurrency(categoria.totalCost)}</div>
                              <div className="text-sm text-muted-foreground">{categoria.porcentaje.toFixed(1)}%</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Costos Más Altos */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Costos Más Altos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {stats.costosMasAltos.map((costo) => (
                          <div key={costo.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <div className="font-medium">{costo.name}</div>
                              <div className="text-sm text-muted-foreground">{costo.categoryName} • {costo.month}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">{formatCurrency(costo.amount)}</div>
                              {getStatusBadge(costo.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo para Nueva Categoría */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Nueva Categoría de Costo</DialogTitle>
            <DialogDescription>
              Crea una nueva categoría para organizar tus costos indirectos
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="categoryName">Nombre *</Label>
                <Input
                  id="categoryName"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="Ej: Impuestos, Marketing, Servicios"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="categoryDescription">Descripción</Label>
                <Textarea
                  id="categoryDescription"
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  placeholder="Descripción opcional de la categoría"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="categoryType">Tipo</Label>
                <Select
                  value={newCategory.type}
                  onValueChange={(value) => setNewCategory({ ...newCategory, type: value as 'fixed' | 'variable' | 'periodic' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fijo</SelectItem>
                    <SelectItem value="variable">Variable</SelectItem>
                    <SelectItem value="periodic">Periódico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCategory}
              disabled={!newCategory.name.trim()}
            >
              Crear Categoría
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para Nuevo Costo */}
      <Dialog open={showCostDialog} onOpenChange={setShowCostDialog}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Nuevo Costo Indirecto</DialogTitle>
            <DialogDescription>
              Registra un nuevo costo indirecto para tu empresa
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="costName">Nombre *</Label>
              <Input
                id="costName"
                value={newCost.name}
                onChange={(e) => setNewCost({ ...newCost, name: e.target.value })}
                placeholder="Ej: Impuesto municipal, Publicidad Facebook"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="costCategory">Categoría *</Label>
              <Select
                value={newCost.categoryId}
                onValueChange={(value) => setNewCost({ ...newCost, categoryId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="costAmount">Monto *</Label>
                <Input
                  id="costAmount"
                  type="number"
                  value={newCost.amount}
                  onChange={(e) => setNewCost({ ...newCost, amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="costMonth">Mes *</Label>
                <Input
                  id="costMonth"
                  type="month"
                  value={newCost.month}
                  onChange={(e) => setNewCost({ ...newCost, month: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="costDescription">Descripción</Label>
              <Textarea
                id="costDescription"
                value={newCost.description}
                onChange={(e) => setNewCost({ ...newCost, description: e.target.value })}
                placeholder="Descripción adicional del costo"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="costDueDate">Fecha de Vencimiento</Label>
                <DatePicker
                  value={newCost.dueDate}
                  onChange={(date) => setNewCost({ ...newCost, dueDate: date })}
                  placeholder="Seleccionar fecha"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="costStatus">Estado</Label>
                <Select
                  value={newCost.status}
                  onValueChange={(value) => setNewCost({ ...newCost, status: value as 'pending' | 'paid' | 'overdue' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="paid">Pagado</SelectItem>
                    <SelectItem value="overdue">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCostDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCost}
              disabled={!newCost.name.trim() || !newCost.categoryId || !newCost.amount || !newCost.month}
            >
              Registrar Costo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
