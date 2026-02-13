'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  DollarSign,
  Package,
  Loader2,
  Pencil,
  Trash2,
  Star,
  X,
  ChevronDown,
  ChevronRight,
  Settings,
  Copy,
  List,
  Tag,
  Download,
  BarChart3,
  TrendingUp,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PriceList {
  id: number;
  nombre: string;
  descripcion?: string;
  moneda: string;
  porcentajeBase?: number;
  esDefault: boolean;
  isActive: boolean;
  validFrom?: string;
  validUntil?: string;
  _count?: { items: number };
  items?: PriceListItem[];
}

interface PriceListItem {
  id: number;
  priceListId: number;
  productId: string;
  precioUnitario: number;
  porcentaje?: number;
  product: {
    id: string;
    code: string;
    name: string;
    costPrice: number;
    unit?: string;
    category?: { id: number; name: string };
  };
}

interface Product {
  id: string;
  code: string;
  name: string;
  costPrice: number;
  unit?: string;
  category?: { name: string };
}

export default function ListasPreciosPage() {
  const { currentCompany } = useCompany();

  // Estado principal
  const [lists, setLists] = useState<PriceList[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('listas');

  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Estados de dialogo - Lista
  const [isListDialogOpen, setIsListDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState<PriceList | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listForm, setListForm] = useState({
    nombre: '',
    descripcion: '',
    moneda: 'ARS',
    porcentajeBase: '',
    esDefault: false,
    validFrom: '',
    validUntil: '',
  });

  // Estados para gestionar items de una lista
  const [selectedList, setSelectedList] = useState<PriceList | null>(null);
  const [isItemsDialogOpen, setIsItemsDialogOpen] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  // Estados para agregar producto
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [itemForm, setItemForm] = useState({
    productId: '',
    precioUnitario: '',
    porcentaje: '',
  });

  // Estados para eliminar
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [listToDelete, setListToDelete] = useState<PriceList | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados para analytics
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    if (currentCompany) {
      fetchLists();
      fetchProducts();
    }
  }, [currentCompany]);

  const fetchLists = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ventas/listas-precios?onlyActive=false');
      if (res.ok) {
        const data = await res.json();
        setLists(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error cargando listas:', error);
      toast.error('Error al cargar las listas de precios');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products?onlyActive=true');
      if (res.ok) {
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error cargando productos:', error);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoadingAnalytics(true);
      const res = await fetch('/api/ventas/listas-precios/analytics');
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      } else {
        toast.error('Error al cargar analytics');
      }
    } catch (error) {
      console.error('Error cargando analytics:', error);
      toast.error('Error al cargar analytics');
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  const loadListDetails = useCallback(async (listId: number) => {
    try {
      setLoadingItems(true);
      const res = await fetch(`/api/ventas/listas-precios/${listId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedList(data);
      }
    } catch (error) {
      console.error('Error cargando detalles:', error);
      toast.error('Error al cargar los productos de la lista');
    } finally {
      setLoadingItems(false);
    }
  }, []);

  // Filtrar listas
  const filteredLists = useMemo(() => {
    return lists.filter(list => {
      const matchesSearch =
        list.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (list.descripcion && list.descripcion.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && list.isActive) ||
        (statusFilter === 'inactive' && !list.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [lists, searchTerm, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = lists.length;
    const active = lists.filter(l => l.isActive).length;
    const withDefault = lists.find(l => l.esDefault);
    const totalProducts = lists.reduce((acc, l) => acc + (l._count?.items || 0), 0);
    return { total, active, hasDefault: !!withDefault, totalProducts };
  }, [lists]);

  // Handlers
  const handleOpenCreate = () => {
    setEditingList(null);
    setListForm({
      nombre: '',
      descripcion: '',
      moneda: 'ARS',
      porcentajeBase: '',
      esDefault: false,
      validFrom: '',
      validUntil: '',
    });
    setIsListDialogOpen(true);
  };

  const handleOpenEdit = (list: PriceList) => {
    setEditingList(list);
    setListForm({
      nombre: list.nombre,
      descripcion: list.descripcion || '',
      moneda: list.moneda,
      porcentajeBase: list.porcentajeBase?.toString() || '',
      esDefault: list.esDefault,
      validFrom: list.validFrom?.split('T')[0] || '',
      validUntil: list.validUntil?.split('T')[0] || '',
    });
    setIsListDialogOpen(true);
  };

  const handleExport = async (list: PriceList) => {
    try {
      const res = await fetch(`/api/ventas/listas-precios/${list.id}/export`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lista-precios-${list.nombre.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Lista exportada correctamente');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al exportar');
      }
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Error al exportar lista');
    }
  };

  const handleDuplicate = async (list: PriceList) => {
    const newName = prompt(`Nombre para la nueva lista (copiada de "${list.nombre}"):`, `${list.nombre} (Copia)`);
    if (!newName || !newName.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/ventas/listas-precios/${list.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newName: newName.trim(),
          copyItems: true,
          setAsActive: true,
          setAsDefault: false,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        toast.success(result.message || 'Lista duplicada correctamente');
        fetchLists();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al duplicar lista');
      }
    } catch (error) {
      console.error('Error duplicating:', error);
      toast.error('Error al duplicar lista');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitList = async () => {
    if (!listForm.nombre.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingList
        ? `/api/ventas/listas-precios/${editingList.id}`
        : '/api/ventas/listas-precios';

      const res = await fetch(url, {
        method: editingList ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...listForm,
          porcentajeBase: listForm.porcentajeBase ? parseFloat(listForm.porcentajeBase) : null,
          validFrom: listForm.validFrom || null,
          validUntil: listForm.validUntil || null,
        }),
      });

      if (res.ok) {
        toast.success(editingList ? 'Lista actualizada' : 'Lista creada');
        setIsListDialogOpen(false);
        fetchLists();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al guardar');
      }
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (list: PriceList) => {
    try {
      const res = await fetch(`/api/ventas/listas-precios/${list.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !list.isActive }),
      });

      if (res.ok) {
        toast.success(list.isActive ? 'Lista desactivada' : 'Lista activada');
        fetchLists();
      }
    } catch (error) {
      toast.error('Error al cambiar estado');
    }
  };

  const handleDelete = async () => {
    if (!listToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/ventas/listas-precios/${listToDelete.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Lista eliminada');
        setIsDeleteDialogOpen(false);
        setListToDelete(null);
        fetchLists();
      }
    } catch (error) {
      toast.error('Error al eliminar');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenItems = async (list: PriceList) => {
    setSelectedList(list);
    await loadListDetails(list.id);
    setIsItemsDialogOpen(true);
  };

  const handleAddItem = async () => {
    if (!selectedList || !itemForm.productId || !itemForm.precioUnitario) {
      toast.error('Producto y precio son requeridos');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/ventas/listas-precios/${selectedList.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: itemForm.productId,
          precioUnitario: parseFloat(itemForm.precioUnitario),
          porcentaje: itemForm.porcentaje ? parseFloat(itemForm.porcentaje) : null,
        }),
      });

      if (res.ok) {
        toast.success('Producto agregado');
        setIsAddItemDialogOpen(false);
        setItemForm({ productId: '', precioUnitario: '', porcentaje: '' });
        setProductSearch('');
        await loadListDetails(selectedList.id);
        fetchLists();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al agregar producto');
      }
    } catch (error) {
      toast.error('Error al agregar producto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (item: PriceListItem) => {
    if (!selectedList) return;

    try {
      const res = await fetch(`/api/ventas/listas-precios/${selectedList.id}/items?itemId=${item.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Producto eliminado');
        await loadListDetails(selectedList.id);
        fetchLists();
      }
    } catch (error) {
      toast.error('Error al eliminar producto');
    }
  };

  // Helpers
  const formatCurrency = (value: number, currency: string = 'ARS') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency,
    }).format(value);
  };

  const calcularMargen = (item: PriceListItem) => {
    if (!item.product.costPrice || item.product.costPrice === 0) return null;
    const margen = ((item.precioUnitario - item.product.costPrice) / item.product.costPrice) * 100;
    return margen.toFixed(1);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.code.toLowerCase().includes(productSearch.toLowerCase())
  );

  if (loading) {
    return (
      <PermissionGuard permission="ventas.listas_precios.view">
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard permission="ventas.listas_precios.view">
    <div className="w-full p-0">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0">
        {/* Header con tabs */}
        <div className="px-4 md:px-6 pt-4 pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Listas de Precios</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gestiona las listas de precios para asignar a clientes
              </p>
            </div>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Lista
            </Button>
          </div>
          <TabsList className="w-full sm:w-fit bg-muted/40 border border-border rounded-md p-1 h-9 overflow-x-auto">
            <TabsTrigger value="listas" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <List className="h-3.5 w-3.5 mr-1.5" />
              Listas
            </TabsTrigger>
            <TabsTrigger value="productos" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Package className="h-3.5 w-3.5 mr-1.5" />
              Por Producto
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              onClick={() => !analytics && fetchAnalytics()}
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              Analytics
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab: Listas */}
        <TabsContent value="listas" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total Listas</p>
                    <p className="text-2xl font-bold mt-1">{stats.total}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <List className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Activas</p>
                    <p className="text-2xl font-bold mt-1">{stats.active}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Productos en Listas</p>
                    <p className="text-2xl font-bold mt-1">{stats.totalProducts}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Lista Default</p>
                    <p className="text-2xl font-bold mt-1">{stats.hasDefault ? 'Si' : 'No'}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <Star className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Barra de filtros */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar listas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 bg-background"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-full sm:w-40 h-9 bg-background">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="active">Activas</SelectItem>
                <SelectItem value="inactive">Inactivas</SelectItem>
              </SelectContent>
            </Select>

            {(searchTerm || statusFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                className="h-9 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}

            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground px-2">
              <span className="font-medium text-foreground">{filteredLists.length}</span>
              <span>de {lists.length}</span>
            </div>
          </div>

          {/* Grid de listas */}
          {filteredLists.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mx-auto mb-4">
                <DollarSign className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {lists.length === 0 ? 'Sin listas de precios' : 'Sin resultados'}
              </h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                {lists.length === 0
                  ? 'Crea tu primera lista de precios para asignar a clientes'
                  : 'No hay listas que coincidan con los filtros'}
              </p>
              {lists.length === 0 && (
                <Button onClick={handleOpenCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primera lista
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredLists.map((list) => {
                const itemCount = list._count?.items || 0;

                return (
                  <div
                    key={list.id}
                    className="group rounded-lg border bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all duration-200"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                          list.isActive ? "bg-primary/10" : "bg-muted"
                        )}>
                          <DollarSign className={cn(
                            "h-5 w-5",
                            list.isActive ? "text-primary" : "text-muted-foreground"
                          )} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-foreground">{list.nombre}</h3>
                            {list.esDefault && (
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{list.moneda}</p>
                        </div>
                      </div>
                      <Badge variant={list.isActive ? 'default' : 'secondary'} className="text-xs">
                        {list.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>

                    {/* Descripcion */}
                    {list.descripcion && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {list.descripcion}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 mb-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{itemCount}</span>
                        <span className="text-muted-foreground">productos</span>
                      </div>
                      {list.porcentajeBase && (
                        <div className="flex items-center gap-1.5">
                          <Tag className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">+{list.porcentajeBase}%</span>
                        </div>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-2 pt-3 border-t border-border/50">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8"
                        onClick={() => handleOpenItems(list)}
                      >
                        <Settings className="h-3.5 w-3.5 mr-1.5" />
                        Productos
                      </Button>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleExport(list)}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Exportar a Excel</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleDuplicate(list)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Duplicar lista</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleOpenEdit(list)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar lista</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setListToDelete(list);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Eliminar lista</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab: Por Producto */}
        <TabsContent value="productos" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mx-auto mb-4">
              <Package className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Vista por Producto</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Proximamente podras ver y comparar precios de un producto en todas las listas
            </p>
          </div>
        </TabsContent>

        {/* Tab: Analytics */}
        <TabsContent value="analytics" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          {loadingAnalytics ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : analytics ? (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Listas</p>
                        <p className="text-2xl font-bold">{analytics.resumen.totalListas}</p>
                      </div>
                      <List className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Badge variant="default" className="text-xs">
                        {analytics.resumen.listasActivas} activas
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {analytics.resumen.listasInactivas} inactivas
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Productos Totales</p>
                        <p className="text-2xl font-bold">{analytics.distribucion.productos.total}</p>
                      </div>
                      <Package className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Promedio: {analytics.distribucion.productos.promedio} por lista
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Clientes Asignados</p>
                        <p className="text-2xl font-bold">{analytics.distribucion.clientes.totalConListaAsignada}</p>
                      </div>
                      <Users className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Promedio: {analytics.distribucion.clientes.promedioClientesPorLista} por lista
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Precio Promedio</p>
                        <p className="text-2xl font-bold">
                          ${analytics.analisisPrecios.precioPromedio.toLocaleString('es-AR')}
                        </p>
                      </div>
                      <DollarSign className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Margen: {analytics.analisisPrecios.margenPromedio.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Alertas */}
              {(analytics.alertas.listasSinProductos > 0 || analytics.alertas.listasSinClientes > 0) && (
                <Card className="border-orange-200 bg-orange-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm text-orange-900">Alertas de Listas</h3>
                        <div className="mt-2 space-y-1 text-sm text-orange-800">
                          {analytics.alertas.listasSinProductos > 0 && (
                            <p>• {analytics.alertas.listasSinProductos} lista(s) sin productos</p>
                          )}
                          {analytics.alertas.listasSinClientes > 0 && (
                            <p>• {analytics.alertas.listasSinClientes} lista(s) sin clientes asignados</p>
                          )}
                          {analytics.alertas.listasInactivas > 0 && (
                            <p>• {analytics.alertas.listasInactivas} lista(s) inactivas</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top Listas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm mb-3">Top 5 Listas Más Utilizadas</h3>
                    <div className="space-y-2">
                      {analytics.topListas.masUtilizadas.slice(0, 5).map((lista: any, idx: number) => (
                        <div key={lista.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">#{idx + 1}</Badge>
                            <span className="text-sm font-medium">{lista.nombre}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            {lista.clientesAsignados}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm mb-3">Ranking por Utilidad</h3>
                    <div className="space-y-2">
                      {analytics.ranking.slice(0, 5).map((lista: any, idx: number) => (
                        <div key={lista.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">#{idx + 1}</Badge>
                            <div>
                              <span className="text-sm font-medium block">{lista.nombre}</span>
                              <span className="text-xs text-muted-foreground">
                                {lista.items} productos • {lista.clientes} clientes
                              </span>
                            </div>
                          </div>
                          {lista.esDefault && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Distribución por Moneda */}
              {Object.keys(analytics.distribucion.porMoneda).length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm mb-3">Distribución por Moneda</h3>
                    <div className="flex gap-4">
                      {Object.entries(analytics.distribucion.porMoneda).map(([moneda, count]: [string, any]) => (
                        <div key={moneda} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                          <span className="text-sm font-medium">{moneda}:</span>
                          <span className="text-sm text-muted-foreground">{count} lista(s)</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Últimas Actualizaciones */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-3">Últimas Actualizaciones</h3>
                  <div className="space-y-2">
                    {analytics.ultimasActualizaciones.map((lista: any) => (
                      <div key={lista.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                        <span className="text-sm font-medium">{lista.nombre}</span>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{lista.items} productos</span>
                          <span>{new Date(lista.updatedAt).toLocaleDateString('es-AR')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-16">
              <BarChart3 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">Cargando analytics...</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: Crear/Editar Lista */}
      <Dialog open={isListDialogOpen} onOpenChange={setIsListDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingList ? 'Editar Lista' : 'Nueva Lista de Precios'}
            </DialogTitle>
            <DialogDescription>
              {editingList
                ? 'Modifica los datos de la lista de precios'
                : 'Crea una nueva lista para asignar precios especiales a clientes'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={listForm.nombre}
                onChange={(e) => setListForm({ ...listForm, nombre: e.target.value })}
                placeholder="Ej: Lista Mayorista"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripcion</Label>
              <Input
                id="descripcion"
                value={listForm.descripcion}
                onChange={(e) => setListForm({ ...listForm, descripcion: e.target.value })}
                placeholder="Descripcion opcional"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="moneda">Moneda</Label>
                <Select
                  value={listForm.moneda}
                  onValueChange={(v) => setListForm({ ...listForm, moneda: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS (Pesos)</SelectItem>
                    <SelectItem value="USD">USD (Dolares)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="porcentajeBase">% Base sobre costo</Label>
                <Input
                  id="porcentajeBase"
                  type="number"
                  step="0.01"
                  value={listForm.porcentajeBase}
                  onChange={(e) => setListForm({ ...listForm, porcentajeBase: e.target.value })}
                  placeholder="Ej: 30"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="validFrom">Valida desde</Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={listForm.validFrom}
                  onChange={(e) => setListForm({ ...listForm, validFrom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validUntil">Valida hasta</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={listForm.validUntil}
                  onChange={(e) => setListForm({ ...listForm, validUntil: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="esDefault"
                checked={listForm.esDefault}
                onCheckedChange={(checked) => setListForm({ ...listForm, esDefault: checked })}
              />
              <Label htmlFor="esDefault" className="cursor-pointer">
                Lista por defecto
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsListDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitList} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingList ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar eliminar */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Lista</DialogTitle>
            <DialogDescription>
              ¿Estas seguro de que quieres eliminar la lista &quot;{listToDelete?.nombre}&quot;?
              Esta accion no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setListToDelete(null);
              }}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Gestionar productos de la lista */}
      {selectedList && (
        <Dialog open={isItemsDialogOpen} onOpenChange={setIsItemsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
            {/* Header fijo */}
            <div className="px-6 py-4 border-b bg-background sticky top-0 z-10">
              <DialogHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <DialogTitle className="text-base flex items-center gap-2">
                        {selectedList.nombre}
                        {selectedList.esDefault && (
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </DialogTitle>
                      <p className="text-xs text-muted-foreground">
                        {selectedList.descripcion || 'Sin descripcion'} - {selectedList.moneda}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={selectedList.isActive}
                      onCheckedChange={() => {
                        handleToggleActive(selectedList);
                        setSelectedList({ ...selectedList, isActive: !selectedList.isActive });
                      }}
                    />
                    <span className="text-sm">
                      {selectedList.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </div>

                {/* Stats y boton agregar */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant="outline">
                      {selectedList.items?.length || 0} productos
                    </Badge>
                    {selectedList.porcentajeBase && (
                      <span className="text-muted-foreground">
                        Base: +{selectedList.porcentajeBase}%
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setIsAddItemDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Agregar Producto
                  </Button>
                </div>
              </DialogHeader>
            </div>

            {/* Contenido scrolleable */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loadingItems ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-muted-foreground">Cargando productos...</span>
                </div>
              ) : !selectedList.items || selectedList.items.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mx-auto mb-4">
                    <Package className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-sm font-medium mb-1">Sin productos</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Agrega productos a esta lista para definir sus precios
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setIsAddItemDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Agregar primer producto
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[100px]">Codigo</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Costo</TableHead>
                        <TableHead className="text-right">Precio Venta</TableHead>
                        <TableHead className="text-right">Margen</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedList.items.map((item) => {
                        const margen = calcularMargen(item);
                        return (
                          <TableRow key={item.id} className="hover:bg-muted/30">
                            <TableCell className="font-mono text-sm">
                              {item.product.code}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.product.name}</p>
                                {item.product.category && (
                                  <p className="text-xs text-muted-foreground">
                                    {item.product.category.name}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {formatCurrency(item.product.costPrice || 0, selectedList.moneda)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(item.precioUnitario, selectedList.moneda)}
                            </TableCell>
                            <TableCell className="text-right">
                              {margen ? (
                                <Badge variant={parseFloat(margen) > 0 ? 'default' : 'destructive'}>
                                  {margen}%
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteItem(item)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Footer fijo */}
            <div className="px-6 py-3 border-t bg-background">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Los precios de esta lista se aplican a clientes asignados
                </p>
                <Button variant="outline" size="sm" onClick={() => setIsItemsDialogOpen(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog: Agregar producto */}
      <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Producto</DialogTitle>
            <DialogDescription>
              Busca un producto y define su precio para esta lista
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Producto *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar producto..."
                  className="pl-10"
                />
              </div>
              {productSearch && (
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground text-center">
                      No se encontraron productos
                    </p>
                  ) : (
                    filteredProducts.slice(0, 10).map((p) => (
                      <div
                        key={p.id}
                        className={cn(
                          "p-2 cursor-pointer hover:bg-muted transition-colors",
                          itemForm.productId === p.id && "bg-muted"
                        )}
                        onClick={() => {
                          setItemForm({ ...itemForm, productId: p.id });
                          setProductSearch(p.name);
                        }}
                      >
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.code} - Costo: {formatCurrency(p.costPrice || 0)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="precioUnitario">Precio de Venta *</Label>
                <Input
                  id="precioUnitario"
                  type="number"
                  step="0.01"
                  value={itemForm.precioUnitario}
                  onChange={(e) => setItemForm({ ...itemForm, precioUnitario: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="porcentaje">% Adicional</Label>
                <Input
                  id="porcentaje"
                  type="number"
                  step="0.01"
                  value={itemForm.porcentaje}
                  onChange={(e) => setItemForm({ ...itemForm, porcentaje: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddItemDialogOpen(false);
                setItemForm({ productId: '', precioUnitario: '', porcentaje: '' });
                setProductSearch('');
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddItem}
              disabled={isSubmitting || !itemForm.productId || !itemForm.precioUnitario}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PermissionGuard>
  );
}
