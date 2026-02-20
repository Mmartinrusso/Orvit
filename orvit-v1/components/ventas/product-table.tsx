'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Search,
  Edit,
  Eye,
  AlertTriangle,
  Trash2,
  Grid3x3,
  Package,
  LayoutGrid,
  LayoutList,
  Factory,
  Loader2,
  Upload,
  RefreshCcw,
  X,
  MoreHorizontal,
  CheckCircle2,
  TrendingUp,
  Download,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Product, Category } from '@/lib/types/sales';
import { toast } from 'sonner';
import { ProductDetailModal } from './product-detail-modal';
import { ProductEditModal } from './product-edit-modal';
import { ProductBulkEditGrid } from './product-bulk-edit-grid';
import { ProductBulkCreateGrid } from './product-bulk-create-grid';
import { ProductCreateDialog } from './product-create-dialog';
import { ProductImportDialog } from './product-import-dialog';
import { useCompany } from '@/contexts/CompanyContext';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

export function ProductTable() {
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isBulkCreateOpen, setIsBulkCreateOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, categoryFilter, statusFilter]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchTerm, categoryFilter, statusFilter]);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const companyId = currentCompany?.id || 1;

      const [productsResponse, categoriesResponse] = await Promise.all([
        fetch('/api/ventas/productos'),
        fetch('/api/ventas/product-config')
      ]);

      let productsData: Product[] = [];

      if (productsResponse.ok) {
        const productsJson = await productsResponse.json();
        productsData = Array.isArray(productsJson) ? productsJson : (productsJson.data || []);
        const productsWithImages = productsData.map((p: Product) => ({
          ...p,
          images: p.images
            ? (Array.isArray(p.images) ? p.images : (typeof p.images === 'string' ? (() => { try { return JSON.parse(p.images as string); } catch { return []; } })() : []))
            : []
        }));
        setProducts(productsWithImages);
      } else {
        throw new Error('Error al cargar productos');
      }

      // Extract unique categories from loaded products
      const productCategories = productsData
        .map((p: Product) => p.category)
        .filter((cat: any) => cat !== null && cat !== undefined)
        .reduce((acc: any[], cat: any) => {
          if (!acc.find((c: any) => c.id === cat.id)) {
            acc.push(cat);
          }
          return acc;
        }, []);
      setCategories(productCategories);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
      setProducts([]);
      setCategories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterProducts = () => {
    let filtered = [...products];

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(product => {
        const nameMatch = product.name?.toLowerCase().includes(searchLower) || false;
        const codeMatch = product.code?.toLowerCase().includes(searchLower) || false;
        const descriptionMatch = product.description?.toLowerCase().includes(searchLower) || false;
        return nameMatch || codeMatch || descriptionMatch;
      });
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(product => {
        const categoryIdMatch = product.categoryId?.toString() === categoryFilter;
        const categoryMatch = product.category?.id?.toString() === categoryFilter;
        return categoryIdMatch || categoryMatch;
      });
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        filtered = filtered.filter(p => p.isActive);
      } else if (statusFilter === 'inactive') {
        filtered = filtered.filter(p => !p.isActive);
      } else if (statusFilter === 'low-stock') {
        filtered = filtered.filter(p => p.currentStock <= p.minStock);
      }
    }

    setFilteredProducts(filtered);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const getCategoryName = (categoryId: number) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category?.name || 'Sin categoria';
  };

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsDetailModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsEditModalOpen(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    const ok = await confirm({
      title: 'Eliminar producto',
      description: '¿Estas seguro de que quieres eliminar este producto?',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const response = await fetch(`/api/ventas/productos/${productId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Error al eliminar producto');
      }

      setProducts(prev => prev.filter(p => p.id !== productId));
      toast.success('Producto eliminado correctamente');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Error al eliminar producto');
    }
  };

  const handleProductUpdated = async (updatedProduct: Product) => {
    const imagesArray = updatedProduct.images
      ? (Array.isArray(updatedProduct.images) ? updatedProduct.images : [updatedProduct.images])
      : [];

    setProducts(prev => prev.map(p => {
      if (p.id === updatedProduct.id) {
        return { ...updatedProduct, images: imagesArray };
      }
      return p;
    }));

    setIsEditModalOpen(false);
    setEditingProduct(null);

    setTimeout(() => {
      loadData(true);
    }, 500);
  };

  const handleProductCreated = (newProduct: Product) => {
    setProducts(prev => [...prev, newProduct]);
    setIsCreateDialogOpen(false);
    toast.success('Producto creado correctamente');
  };

  // Bulk selection functions
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);
    setBulkDeleteDialog(false);
    let successCount = 0;
    let errorCount = 0;

    for (const id of selectedIds) {
      try {
        const response = await fetch(`/api/ventas/productos/${id}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }
    }

    setIsDeleting(false);
    setSelectedIds(new Set());

    if (successCount > 0) {
      toast.success(`${successCount} producto(s) eliminado(s)`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} producto(s) no se pudieron eliminar`);
    }
    loadData(true);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  const hasActiveFilters = searchTerm || categoryFilter !== 'all' || statusFilter !== 'all';

  const exportProducts = () => {
    const csvContent = [
      ['Código', 'Nombre', 'Categoría', 'Precio Costo', 'Stock', 'Unidad', 'Stock Mín', 'Estado'],
      ...filteredProducts.map(p => [
        p.code || '',
        p.name || '',
        p.category?.name || getCategoryName(p.categoryId) || 'Sin categoría',
        p.costPrice?.toString() || '0',
        p.currentStock?.toString() || '0',
        p.unit || '',
        p.minStock?.toString() || '0',
        p.isActive ? 'Activo' : 'Inactivo',
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `productos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Stats
  const productStats = useMemo(() => {
    const active = products.filter(p => p.isActive).length;
    const inactive = products.filter(p => !p.isActive).length;
    const lowStock = products.filter(p => p.currentStock <= p.minStock).length;
    return { total: products.length, active, inactive, lowStock };
  }, [products]);

  if (loading) {
    return (
      <div className="w-full p-0">
        <div className="px-4 md:px-6 pt-4 pb-3 border-b border-border">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="px-4 md:px-6 pt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </div>
        <div className="px-4 md:px-6 pt-4 pb-6">
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-0">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-3 border-b border-border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Gestion de Productos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Administra tu catalogo de productos, costos e inventario
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => loadData(true)} disabled={refreshing}>
                  <RefreshCcw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
                  Actualizar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportProducts}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Excel
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsBulkEditOpen(true)}>
                  <Grid3x3 className="h-4 w-4 mr-2" />
                  Edición Masiva
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsBulkCreateOpen(true)}>
                  <Grid3x3 className="h-4 w-4 mr-2" />
                  Creación Masiva
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" className="h-7 text-xs" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nuevo Producto
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="px-4 md:px-6 pt-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setStatusFilter('all')}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total Productos</p>
                  <p className="text-2xl font-bold mt-1">{productStats.total}</p>
                </div>
                <div className="p-2 rounded-lg bg-primary/10">
                  <Package className="h-4 w-4 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setStatusFilter('active')}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Activos</p>
                  <p className="text-2xl font-bold mt-1 text-success">{productStats.active}</p>
                </div>
                <div className="p-2 rounded-lg bg-success-muted">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setStatusFilter('low-stock')}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Stock Bajo</p>
                  <p className="text-2xl font-bold mt-1 text-warning-muted-foreground">{productStats.lowStock}</p>
                </div>
                <div className="p-2 rounded-lg bg-warning-muted">
                  <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Categorias</p>
                  <p className="text-2xl font-bold mt-1 text-primary">{categories.length}</p>
                </div>
                <div className="p-2 rounded-lg bg-primary/10">
                  <Factory className="h-4 w-4 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filtros y Tabla */}
      <div className="px-4 md:px-6 pt-4 pb-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <CardTitle className="text-sm font-medium">Catalogo de Productos</CardTitle>
                <CardDescription className="text-xs">
                  {filteredProducts.length} de {products.length} productos
                </CardDescription>
              </div>
              <div className="flex items-center border rounded-md p-0.5 bg-muted/40">
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    viewMode === 'table' ? "bg-background shadow-sm" : "hover:bg-muted"
                  )}
                  title="Vista tabla"
                >
                  <LayoutList className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('card')}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    viewMode === 'card' ? "bg-background shadow-sm" : "hover:bg-muted"
                  )}
                  title="Vista tarjetas"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filtros */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, codigo o descripcion..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 bg-background"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px] h-9 bg-background">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorias</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px] h-9 bg-background">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                  <SelectItem value="low-stock">Stock Bajo</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={clearFilters}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Limpiar filtros
                </Button>
              )}
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between p-3 mb-4 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    {selectedIds.size} seleccionado(s)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Deseleccionar
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setBulkDeleteDialog(true)}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                  )}
                  Eliminar seleccionados
                </Button>
              </div>
            )}

            {/* Vista Tabla */}
            {viewMode === 'table' && (
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Seleccionar todos"
                        />
                      </TableHead>
                      <TableHead className="text-xs">Código</TableHead>
                      <TableHead className="text-xs">Nombre</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Categoría</TableHead>
                      <TableHead className="text-xs text-right hidden sm:table-cell">Precio Costo</TableHead>
                      <TableHead className="text-xs hidden lg:table-cell">Stock</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                      <TableHead className="text-xs text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                          No hay productos que coincidan con los filtros
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map((product) => (
                        <TableRow
                          key={product.id}
                          className={cn(
                            "cursor-pointer hover:bg-muted/30",
                            selectedIds.has(product.id) && "bg-primary/5"
                          )}
                          onClick={() => handleViewProduct(product)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(product.id)}
                              onCheckedChange={() => toggleSelect(product.id)}
                              aria-label={`Seleccionar ${product.name}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono font-medium text-sm">{product.code}</TableCell>
                          <TableCell className="text-sm">
                            <div className="max-w-[200px]">
                              <p className="font-medium truncate">{product.name}</p>
                              {product.description && (
                                <p className="text-xs text-muted-foreground truncate">{product.description}</p>
                              )}
                              {/* Mobile-only category display */}
                              <p className="text-xs text-muted-foreground md:hidden">
                                {product.category?.name || getCategoryName(product.categoryId) || 'Sin categoría'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant="outline" className="text-xs">
                              {product.category?.name || getCategoryName(product.categoryId) || 'Sin categoría'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-sm hidden sm:table-cell">
                            {formatCurrency(product.costPrice)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{product.currentStock}</span>
                              <span className="text-xs text-muted-foreground">{product.unit}</span>
                              {product.currentStock <= product.minStock && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Bajo</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={product.isActive ? 'default' : 'secondary'}
                              className={cn(
                                "text-xs",
                                product.isActive
                                  ? "bg-success-muted text-success"
                                  : ""
                              )}
                            >
                              {product.isActive ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewProduct(product); }}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Ver Detalle
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditProduct(product); }}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Vista Cards */}
            {viewMode === 'card' && (
              <div>
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No hay productos que coincidan con los filtros
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredProducts.map((product) => (
                      <Card
                        key={product.id}
                        className={cn(
                          "cursor-pointer hover:shadow-md transition-all",
                          selectedIds.has(product.id) && "ring-2 ring-primary"
                        )}
                      >
                        <CardContent className="p-4">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Checkbox
                                checked={selectedIds.has(product.id)}
                                onCheckedChange={() => toggleSelect(product.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="min-w-0 flex-1" onClick={() => handleViewProduct(product)}>
                                <p className="font-mono font-medium text-sm">{product.code}</p>
                                <p className="text-sm font-medium truncate mt-0.5" title={product.name}>
                                  {product.name}
                                </p>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewProduct(product); }}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver Detalle
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditProduct(product); }}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Badges */}
                          <div className="flex flex-wrap gap-1.5 mb-3" onClick={() => handleViewProduct(product)}>
                            <Badge variant="outline" className="text-xs">
                              {product.category?.name || getCategoryName(product.categoryId) || 'Sin categoria'}
                            </Badge>
                            <Badge
                              variant={product.isActive ? 'default' : 'secondary'}
                              className={cn(
                                "text-xs",
                                product.isActive
                                  ? "bg-success-muted text-success"
                                  : ""
                              )}
                            >
                              {product.isActive ? 'Activo' : 'Inactivo'}
                            </Badge>
                            {product.currentStock <= product.minStock && (
                              <Badge variant="destructive" className="text-xs">Stock Bajo</Badge>
                            )}
                          </div>

                          {/* Info */}
                          <div className="space-y-1.5 text-xs" onClick={() => handleViewProduct(product)}>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Precio Costo</span>
                              <span className="font-medium">{formatCurrency(product.costPrice)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Stock</span>
                              <span className="font-medium">{product.currentStock} {product.unit}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Contador de productos */}
            {filteredProducts.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                Mostrando {filteredProducts.length} de {products.length} productos
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modales */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedProduct(null);
          }}
          onEdit={handleEditProduct}
        />
      )}

      {editingProduct && (
        <ProductEditModal
          product={editingProduct}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingProduct(null);
          }}
          onProductUpdated={handleProductUpdated}
        />
      )}

      <ProductBulkEditGrid
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        products={filteredProducts.length > 0 ? filteredProducts : products}
        categories={categories}
        onSave={async (updatedProducts) => {
          try {
            const companyId = currentCompany?.id || 1;

            const savePromises = updatedProducts.map(async (product) => {
              const requestBody = {
                id: product.id,
                name: product.name,
                code: product.code,
                description: product.description || '',
                categoryId: product.categoryId,
                unit: product.unit || 'unidad',
                costPrice: product.costPrice || 0,
                minStock: product.minStock || 0,
                currentStock: product.currentStock || 0,
                volume: product.volume || 0,
                weight: product.weight || 0,
                location: product.location || '',
                isActive: product.isActive ?? true,
                images: product.images || [],
                volumeUnit: (product as any).volumeUnit || 'metros_lineales',
              };

              const response = await fetch(`/api/ventas/productos/${product.id}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
                throw new Error(`Error al actualizar producto ${product.name}: ${errorData.error || 'Error desconocido'}`);
              }

              return response.json();
            });

            await Promise.all(savePromises);
            await loadData(true);
          } catch (error) {
            console.error('Error saving products:', error);
            throw error;
          }
        }}
      />

      <ProductCreateDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onProductCreated={handleProductCreated}
      />

      <ProductImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        categories={categories}
        onImportComplete={() => loadData(true)}
      />

      <ProductBulkCreateGrid
        isOpen={isBulkCreateOpen}
        onClose={() => setIsBulkCreateOpen(false)}
        categories={categories}
        onSave={() => loadData(true)}
      />

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteDialog} onOpenChange={setBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar {selectedIds.size} producto(s)? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
