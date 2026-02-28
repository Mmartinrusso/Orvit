'use client';

import { useState, useMemo } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { usePanolPermissions } from '@/hooks/use-panol-permissions';
import { useToolsDashboard } from '@/hooks/use-tools-dashboard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ToolDialog, ToolQRLabel } from '@/components/panol';
import type { ToolType } from '@/components/panol';
import {
  Plus,
  Search,
  Package,
  Wrench,
  Box,
  Cog,
  AlertTriangle,
  TrendingDown,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  ArrowUp,
  ArrowDown,
  QrCode,
  Loader2,
  X,
  LayoutGrid,
  List,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApiMutation, createFetchMutation } from '@/hooks/use-api-mutation';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

const ITEM_TYPE_CONFIG = {
  TOOL: { label: 'Herramienta', icon: Wrench, color: 'bg-info', iconBg: 'bg-info-muted', iconColor: 'text-info-muted-foreground' },
  SUPPLY: { label: 'Insumo', icon: Box, color: 'bg-success', iconBg: 'bg-success-muted', iconColor: 'text-success' },
  SPARE_PART: { label: 'Repuesto', icon: Cog, color: 'bg-accent-purple', iconBg: 'bg-accent-purple-muted', iconColor: 'text-accent-purple-muted-foreground' },
  HAND_TOOL: { label: 'Herramienta Manual', icon: Wrench, color: 'bg-warning', iconBg: 'bg-warning-muted', iconColor: 'text-warning-muted-foreground' },
};

export default function PanolPage() {
  const confirm = useConfirm();
  const { currentCompany } = useCompany();
  const permissions = usePanolPermissions();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [itemTypeFilter, setItemTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<ToolType | null>(null);
  const [dialogMode, setDialogMode] = useState<'view' | 'edit' | 'create'>('create');

  // Data fetching
  const companyId = currentCompany?.id ? parseInt(String(currentCompany.id)) : null;
  const { data, isLoading, refetch } = useToolsDashboard(companyId, { enabled: !!companyId });

  const tools: ToolType[] = (data?.tools || []) as ToolType[];
  const categories = data?.categories || [];

  // Mutations
  const deleteTool = useApiMutation<unknown, { id: number }>({
    mutationFn: createFetchMutation({
      url: (vars) => `/api/tools/${vars.id}`,
      method: 'DELETE',
    }),
    successMessage: 'Producto eliminado',
    errorMessage: 'Error al eliminar',
    onSuccess: () => refetch(),
  });

  const stockInMutation = useApiMutation<unknown, { toolId: number; type: string; quantity: number; reason: string; companyId: number | null }>({
    mutationFn: createFetchMutation({
      url: '/api/tools/movements',
      method: 'POST',
    }),
    successMessage: 'Entrada registrada',
    errorMessage: 'Error al registrar entrada',
    onSuccess: () => refetch(),
  });

  const stockOutMutation = useApiMutation<unknown, { toolId: number; type: string; quantity: number; reason: string; companyId: number | null }>({
    mutationFn: createFetchMutation({
      url: '/api/tools/movements',
      method: 'POST',
    }),
    successMessage: 'Salida registrada',
    errorMessage: 'Error al registrar salida',
    onSuccess: () => refetch(),
  });

  // Stats
  const stats = useMemo(() => {
    const total = tools.length;
    const lowStock = tools.filter(t => t.stockQuantity > 0 && t.stockQuantity <= t.minStockLevel).length;
    const outOfStock = tools.filter(t => t.stockQuantity === 0).length;
    const totalValue = tools.reduce((sum, t) => sum + ((t.cost || 0) * t.stockQuantity), 0);
    return { total, lowStock, outOfStock, totalValue };
  }, [tools]);

  // Filter tools
  const filteredTools = useMemo(() => {
    return tools.filter(tool => {
      const matchesSearch =
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.code?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'low_stock' && tool.stockQuantity <= tool.minStockLevel && tool.stockQuantity > 0) ||
        (statusFilter === 'out_of_stock' && tool.stockQuantity === 0) ||
        (statusFilter === 'ok' && tool.stockQuantity > tool.minStockLevel);

      const matchesCategory = categoryFilter === 'all' || tool.category === categoryFilter;
      const matchesItemType = itemTypeFilter === 'all' || tool.itemType === itemTypeFilter;

      return matchesSearch && matchesStatus && matchesCategory && matchesItemType;
    });
  }, [tools, searchQuery, statusFilter, categoryFilter, itemTypeFilter]);

  // Handlers
  const handleViewTool = (tool: ToolType) => {
    setSelectedTool(tool);
    setDialogMode('view');
    setIsDialogOpen(true);
  };

  const handleEditTool = (tool: ToolType) => {
    if (!permissions.canEditProduct) {
      toast.error('No tienes permisos para editar productos');
      return;
    }
    setSelectedTool(tool);
    setDialogMode('edit');
    setIsDialogOpen(true);
  };

  const handleDeleteTool = async (tool: ToolType) => {
    if (!permissions.canDeleteProduct) {
      toast.error('No tienes permisos para eliminar productos');
      return;
    }
    const ok = await confirm({
      title: 'Eliminar producto',
      description: `¿Eliminar "${tool.name}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    deleteTool.mutate({ id: tool.id });
  };

  const handleStockIn = (tool: ToolType) => {
    if (!permissions.canRegisterMovement) {
      toast.error('No tienes permisos para registrar movimientos');
      return;
    }
    const quantity = prompt(`Cantidad a agregar al stock de "${tool.name}":`, '1');
    if (!quantity || isNaN(parseInt(quantity))) return;

    stockInMutation.mutate({
      toolId: tool.id,
      type: 'STOCK_IN',
      quantity: parseInt(quantity),
      reason: 'Entrada de stock',
      companyId,
    });
  };

  const handleStockOut = (tool: ToolType) => {
    if (!permissions.canRegisterMovement) {
      toast.error('No tienes permisos para registrar movimientos');
      return;
    }
    const quantity = prompt(`Cantidad a retirar de "${tool.name}" (stock: ${tool.stockQuantity}):`, '1');
    if (!quantity || isNaN(parseInt(quantity))) return;
    if (parseInt(quantity) > tool.stockQuantity) {
      toast.error('No hay suficiente stock disponible');
      return;
    }

    stockOutMutation.mutate({
      toolId: tool.id,
      type: 'STOCK_OUT',
      quantity: parseInt(quantity),
      reason: 'Salida de stock',
      companyId,
    });
  };

  const handleCreateTool = () => {
    if (!permissions.canCreateProduct) {
      toast.error('No tienes permisos para crear productos');
      return;
    }
    setSelectedTool(null);
    setDialogMode('create');
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedTool(null);
  };

  const handleSave = () => {
    handleDialogClose();
    refetch();
  };

  const getStockBadge = (tool: ToolType) => {
    if (tool.stockQuantity === 0) {
      return <Badge variant="destructive" className="text-xs">Sin stock</Badge>;
    }
    if (tool.stockQuantity <= tool.minStockLevel) {
      return <Badge variant="outline" className="text-xs border-warning-muted text-warning-muted-foreground">Stock bajo</Badge>;
    }
    return <Badge variant="outline" className="text-xs border-success-muted text-success">OK</Badge>;
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setItemTypeFilter('all');
  };

  const hasFilters = searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' || itemTypeFilter !== 'all';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="w-full p-0">
        {/* Header */}
        <div className="px-4 md:px-6 pt-4 pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Pañol</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gestión de herramientas e insumos
              </p>
            </div>
            {permissions.canCreateProduct && (
              <Button onClick={handleCreateTool} size="sm" className="h-9">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo producto
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4 px-4 md:px-6 pb-6">
          {/* KPIs */}
          <div className={cn("grid gap-4", permissions.canViewCosts ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3")}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total Items</p>
                    <p className="text-2xl font-bold mt-1">{stats.total}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={stats.lowStock > 0 ? 'border-warning-muted/50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Stock Bajo</p>
                    <p className="text-2xl font-bold mt-1 text-warning-muted-foreground">{stats.lowStock}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-warning-muted">
                    <TrendingDown className="h-4 w-4 text-warning-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={stats.outOfStock > 0 ? 'border-destructive/30/50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Sin Stock</p>
                    <p className="text-2xl font-bold mt-1 text-destructive">{stats.outOfStock}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {permissions.canViewCosts && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Valor Total</p>
                      <p className="text-2xl font-bold mt-1">${stats.totalValue.toLocaleString('es-AR')}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-success-muted">
                      <Package className="h-4 w-4 text-success" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, código, categoría..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-background"
              />
            </div>

            <Select value={itemTypeFilter} onValueChange={setItemTypeFilter}>
              <SelectTrigger className="w-full sm:w-40 h-9 bg-background">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="TOOL">Herramientas</SelectItem>
                <SelectItem value="SUPPLY">Insumos</SelectItem>
                <SelectItem value="SPARE_PART">Repuestos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36 h-9 bg-background">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ok">Stock OK</SelectItem>
                <SelectItem value="low_stock">Stock bajo</SelectItem>
                <SelectItem value="out_of_stock">Sin stock</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-40 h-9 bg-background">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((cat: string) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}

            {/* View Toggle */}
            <div className="flex border rounded-lg p-0.5 bg-background">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setViewMode('table')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Vista tabla</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setViewMode('cards')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Vista tarjetas</TooltipContent>
              </Tooltip>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground px-2">
              <span className="font-medium text-foreground">{filteredTools.length}</span>
              <span>de {tools.length}</span>
            </div>
          </div>

          {/* Empty State */}
          {filteredTools.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mx-auto mb-4">
                    <Package className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No hay productos</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    {tools.length === 0 ? 'Aún no has agregado ningún producto' : 'No hay productos que coincidan con los filtros'}
                  </p>
                  {tools.length === 0 && permissions.canCreateProduct && (
                    <Button onClick={handleCreateTool} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Crear primer producto
                    </Button>
                  )}
                  {tools.length > 0 && hasFilters && (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Limpiar filtros
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : viewMode === 'table' ? (
            /* Table View */
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs font-medium">Código</TableHead>
                    <TableHead className="text-xs font-medium">Nombre</TableHead>
                    <TableHead className="text-xs font-medium">Tipo</TableHead>
                    <TableHead className="text-xs font-medium">Categoría</TableHead>
                    <TableHead className="text-xs font-medium text-center">Stock</TableHead>
                    <TableHead className="text-xs font-medium">Estado</TableHead>
                    {permissions.canViewCosts && (
                      <TableHead className="text-xs font-medium text-right">Costo</TableHead>
                    )}
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTools.map((tool) => {
                    const typeConfig = ITEM_TYPE_CONFIG[tool.itemType as keyof typeof ITEM_TYPE_CONFIG] || ITEM_TYPE_CONFIG.TOOL;
                    const TypeIcon = typeConfig.icon;

                    return (
                      <TableRow
                        key={tool.id}
                        className="group cursor-pointer hover:bg-muted/20"
                        onClick={() => handleViewTool(tool)}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {tool.code || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={cn("h-7 w-7 rounded flex items-center justify-center", typeConfig.iconBg)}>
                              <TypeIcon className={cn("h-3.5 w-3.5", typeConfig.iconColor)} />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{tool.name}</p>
                              {tool.brand && (
                                <p className="text-xs text-muted-foreground">{tool.brand}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs font-normal">
                            {typeConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tool.category || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn(
                            "text-sm font-semibold",
                            tool.stockQuantity === 0 && "text-destructive",
                            tool.stockQuantity > 0 && tool.stockQuantity <= tool.minStockLevel && "text-warning-muted-foreground"
                          )}>
                            {tool.stockQuantity}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">/ {tool.minStockLevel}</span>
                        </TableCell>
                        <TableCell>{getStockBadge(tool)}</TableCell>
                        {permissions.canViewCosts && (
                          <TableCell className="text-right text-sm">
                            {tool.cost ? `$${tool.cost.toLocaleString('es-AR')}` : '-'}
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {permissions.canRegisterMovement && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-success"
                                    onClick={(e) => { e.stopPropagation(); handleStockIn(tool); }}
                                  >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Entrada</TooltipContent>
                              </Tooltip>
                            )}
                            {permissions.canRegisterMovement && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    onClick={(e) => { e.stopPropagation(); handleStockOut(tool); }}
                                    disabled={tool.stockQuantity === 0}
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Salida</TooltipContent>
                              </Tooltip>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewTool(tool)}>
                                  <Eye className="h-4 w-4 mr-2" /> Ver detalles
                                </DropdownMenuItem>
                                {permissions.canEditProduct && (
                                  <DropdownMenuItem onClick={() => handleEditTool(tool)}>
                                    <Edit className="h-4 w-4 mr-2" /> Editar
                                  </DropdownMenuItem>
                                )}
                                <ToolQRLabel
                                  toolId={tool.id}
                                  toolName={tool.name}
                                  trigger={
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                      <QrCode className="h-4 w-4 mr-2" /> Código QR
                                    </DropdownMenuItem>
                                  }
                                />
                                {permissions.canDeleteProduct && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => handleDeleteTool(tool)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* Card View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTools.map((tool) => {
                const typeConfig = ITEM_TYPE_CONFIG[tool.itemType as keyof typeof ITEM_TYPE_CONFIG] || ITEM_TYPE_CONFIG.TOOL;
                const TypeIcon = typeConfig.icon;
                const isLowStock = tool.stockQuantity > 0 && tool.stockQuantity <= tool.minStockLevel;
                const isOutOfStock = tool.stockQuantity === 0;

                return (
                  <Card
                    key={tool.id}
                    className={cn(
                      "group cursor-pointer transition-all hover:shadow-md overflow-hidden",
                      isOutOfStock && "border-destructive/30/50",
                      isLowStock && !isOutOfStock && "border-warning-muted/50"
                    )}
                    onClick={() => handleViewTool(tool)}
                  >
                    {/* Status bar */}
                    <div className={cn(
                      "h-1 w-full",
                      isOutOfStock ? "bg-destructive" : isLowStock ? "bg-warning" : "bg-success"
                    )} />

                    <CardContent className="p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className={cn("p-2 rounded-lg", typeConfig.iconBg)}>
                          <TypeIcon className={cn("h-5 w-5", typeConfig.iconColor)} />
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewTool(tool)}>
                              <Eye className="h-4 w-4 mr-2" /> Ver detalles
                            </DropdownMenuItem>
                            {permissions.canEditProduct && (
                              <DropdownMenuItem onClick={() => handleEditTool(tool)}>
                                <Edit className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                            )}
                            <ToolQRLabel
                              toolId={tool.id}
                              toolName={tool.name}
                              trigger={
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <QrCode className="h-4 w-4 mr-2" /> Código QR
                                </DropdownMenuItem>
                              }
                            />
                            {permissions.canDeleteProduct && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDeleteTool(tool)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Info */}
                      <div className="mb-3">
                        <h3 className="font-semibold text-sm truncate">{tool.name}</h3>
                        {tool.code && (
                          <p className="text-xs text-muted-foreground font-mono">{tool.code}</p>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <Badge variant="secondary" className="text-xs">
                          {typeConfig.label}
                        </Badge>
                        {tool.category && (
                          <Badge variant="outline" className="text-xs">
                            {tool.category}
                          </Badge>
                        )}
                      </div>

                      {/* Location */}
                      {tool.location && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                          <MapPin className="h-3 w-3" />
                          <span>{tool.location}</span>
                        </div>
                      )}

                      {/* Stock */}
                      <div className="flex items-center justify-between pt-3 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground">Stock</p>
                          <div className="flex items-baseline gap-1">
                            <span className={cn(
                              "text-lg font-bold",
                              isOutOfStock && "text-destructive",
                              isLowStock && !isOutOfStock && "text-warning-muted-foreground"
                            )}>
                              {tool.stockQuantity}
                            </span>
                            <span className="text-xs text-muted-foreground">/ {tool.minStockLevel} mín</span>
                          </div>
                        </div>
                        {permissions.canRegisterMovement && (
                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-success border-success-muted hover:bg-success-muted"
                                  onClick={(e) => { e.stopPropagation(); handleStockIn(tool); }}
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Entrada</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                                  onClick={(e) => { e.stopPropagation(); handleStockOut(tool); }}
                                  disabled={tool.stockQuantity === 0}
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Salida</TooltipContent>
                            </Tooltip>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Dialog */}
        <ToolDialog
          isOpen={isDialogOpen}
          onClose={handleDialogClose}
          tool={selectedTool}
          mode={dialogMode}
          onSave={handleSave}
        />
      </div>
    </TooltipProvider>
  );
}
