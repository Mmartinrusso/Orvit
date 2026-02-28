'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { usePanolPermissions } from '@/hooks/use-panol-permissions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  TrendingDown,
  Boxes,
  ShieldAlert,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  Download,
  Loader2,
  X,
  Cog,
  DollarSign,
  History,
} from 'lucide-react';

interface SparePart {
  id: number;
  name: string;
  description: string | null;
  code: string | null;
  category: string | null;
  brand: string | null;
  model: string | null;
  stockQuantity: number;
  minStockLevel: number;
  maxStockLevel: number;
  reorderPoint: number | null;
  location: string | null;
  status: string;
  cost: number | null;
  supplier: string | null;
  isCritical: boolean;
  leadTimeDays: number | null;
  unit: string | null;
  updatedAt: string;
  toolMachines?: { machine: { id: number; name: string } }[];
}

interface KPIs {
  total: number;
  lowStock: number;
  critical: number;
  outOfStock: number;
  totalValue: number;
}

export default function RepuestosPage() {
  const { currentCompany } = useCompany();
  const { canViewProducts, canCreateProduct, canEditProduct, canDeleteProduct } = usePanolPermissions();

  const queryClient = useQueryClient();

  const { data: spareParts = [], isLoading: loading } = useQuery({
    queryKey: ['panol', 'repuestos', currentCompany?.id],
    queryFn: async () => {
      const res = await fetch(`/api/tools?companyId=${currentCompany!.id}&itemType=SPARE_PART`);
      if (!res.ok) throw new Error('Error cargando repuestos');
      const data = await res.json();
      return (Array.isArray(data) ? data : (data?.tools || data?.items || [])) as SparePart[];
    },
    enabled: !!currentCompany?.id,
    staleTime: 3 * 60 * 1000,
  });

  const invalidateParts = () => queryClient.invalidateQueries({ queryKey: ['panol', 'repuestos', currentCompany?.id] });

  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPart, setSelectedPart] = useState<SparePart | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    code: '',
    category: '',
    brand: '',
    model: '',
    stockQuantity: 0,
    minStockLevel: 0,
    maxStockLevel: 100,
    reorderPoint: 0,
    location: '',
    cost: 0,
    supplier: '',
    isCritical: false,
    leadTimeDays: 0,
    unit: 'unidad',
  });
  const [submitting, setSubmitting] = useState(false);

  const kpis = useMemo<KPIs>(() => {
    const total = spareParts.length;
    const lowStock = spareParts.filter(p => p.stockQuantity <= p.minStockLevel && p.stockQuantity > 0).length;
    const outOfStock = spareParts.filter(p => p.stockQuantity === 0).length;
    const critical = spareParts.filter(p => p.isCritical).length;
    const totalValue = spareParts.reduce((acc, p) => acc + (p.cost || 0) * p.stockQuantity, 0);

    return { total, lowStock, critical, outOfStock, totalValue };
  }, [spareParts]);

  const filteredParts = useMemo(() => {
    let result = [...spareParts];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.code?.toLowerCase().includes(term) ||
        p.category?.toLowerCase().includes(term) ||
        p.brand?.toLowerCase().includes(term)
      );
    }

    if (stockFilter === 'low') {
      result = result.filter(p => p.stockQuantity <= p.minStockLevel && p.stockQuantity > 0);
    } else if (stockFilter === 'out') {
      result = result.filter(p => p.stockQuantity === 0);
    } else if (stockFilter === 'critical') {
      result = result.filter(p => p.isCritical);
    } else if (stockFilter === 'ok') {
      result = result.filter(p => p.stockQuantity > p.minStockLevel);
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'stock':
          comparison = a.stockQuantity - b.stockQuantity;
          break;
        case 'cost':
          comparison = (a.cost || 0) - (b.cost || 0);
          break;
        case 'updated':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [spareParts, searchTerm, stockFilter, sortBy, sortOrder]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      code: '',
      category: '',
      brand: '',
      model: '',
      stockQuantity: 0,
      minStockLevel: 0,
      maxStockLevel: 100,
      reorderPoint: 0,
      location: '',
      cost: 0,
      supplier: '',
      isCritical: false,
      leadTimeDays: 0,
      unit: 'unidad',
    });
  };

  const handleCreate = async () => {
    if (!canCreateProduct) {
      toast.error('No tienes permisos para crear repuestos');
      return;
    }
    if (!formData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          itemType: 'SPARE_PART',
          companyId: currentCompany?.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error creando repuesto');
      }

      toast.success('Repuesto creado correctamente');
      setShowCreateDialog(false);
      resetForm();
      invalidateParts();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!canEditProduct) {
      toast.error('No tienes permisos para editar repuestos');
      return;
    }
    if (!selectedPart || !formData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/tools/${selectedPart.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error actualizando repuesto');
      }

      toast.success('Repuesto actualizado correctamente');
      setShowEditDialog(false);
      setSelectedPart(null);
      resetForm();
      invalidateParts();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!canDeleteProduct) {
      toast.error('No tienes permisos para eliminar repuestos');
      return;
    }
    if (!selectedPart) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/tools/${selectedPart.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error eliminando repuesto');
      }

      toast.success('Repuesto eliminado correctamente');
      setShowDeleteDialog(false);
      setSelectedPart(null);
      invalidateParts();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (part: SparePart) => {
    if (!canEditProduct) {
      toast.error('No tienes permisos para editar repuestos');
      return;
    }
    setSelectedPart(part);
    setFormData({
      name: part.name,
      description: part.description || '',
      code: part.code || '',
      category: part.category || '',
      brand: part.brand || '',
      model: part.model || '',
      stockQuantity: part.stockQuantity,
      minStockLevel: part.minStockLevel,
      maxStockLevel: part.maxStockLevel,
      reorderPoint: part.reorderPoint || 0,
      location: part.location || '',
      cost: part.cost || 0,
      supplier: part.supplier || '',
      isCritical: part.isCritical,
      leadTimeDays: part.leadTimeDays || 0,
      unit: part.unit || 'unidad',
    });
    setShowEditDialog(true);
  };

  const exportCSV = () => {
    const headers = ['Código', 'Nombre', 'Categoría', 'Stock', 'Mínimo', 'Ubicación', 'Costo', 'Crítico'];
    const rows = filteredParts.map(p => [
      p.code || '',
      p.name,
      p.category || '',
      p.stockQuantity,
      p.minStockLevel,
      p.location || '',
      p.cost || 0,
      p.isCritical ? 'Sí' : 'No',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `repuestos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('CSV exportado');
  };

  const getStockBadge = (part: SparePart) => {
    if (part.stockQuantity === 0) {
      return <Badge variant="destructive">Sin stock</Badge>;
    }
    if (part.stockQuantity <= part.minStockLevel) {
      return <Badge variant="outline" className="border-warning-muted text-warning-muted-foreground">Stock bajo</Badge>;
    }
    return <Badge variant="outline" className="border-success-muted text-success">OK</Badge>;
  };

  if (loading) {
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
              <h1 className="text-xl font-semibold text-foreground">Repuestos</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gestión de repuestos y partes de recambio
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9" onClick={() => invalidateParts()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Actualizar</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 hidden sm:flex" onClick={exportCSV}>
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Exportar CSV</TooltipContent>
              </Tooltip>
              {canCreateProduct && (
                <Button size="sm" className="h-9" onClick={() => { resetForm(); setShowCreateDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Repuesto
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4 px-4 md:px-6 pb-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total Repuestos</p>
                    <p className="text-2xl font-bold mt-1">{kpis.total}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <Boxes className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={kpis.lowStock > 0 ? 'border-warning-muted/50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Stock Bajo</p>
                    <p className="text-2xl font-bold mt-1 text-warning-muted-foreground">{kpis.lowStock}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-warning-muted">
                    <TrendingDown className="h-4 w-4 text-warning-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={kpis.outOfStock > 0 ? 'border-destructive/30/50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Sin Stock</p>
                    <p className="text-2xl font-bold mt-1 text-destructive">{kpis.outOfStock}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Críticos</p>
                    <p className="text-2xl font-bold mt-1 text-accent-purple-muted-foreground">{kpis.critical}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-accent-purple-muted">
                    <ShieldAlert className="h-4 w-4 text-accent-purple-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Valor Total</p>
                    <p className="text-2xl font-bold mt-1">${kpis.totalValue.toLocaleString('es-AR')}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-success-muted">
                    <DollarSign className="h-4 w-4 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, código, categoría..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9 bg-background"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="w-full sm:w-[150px] h-9 bg-background">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ok">Stock OK</SelectItem>
                <SelectItem value="low">Stock Bajo</SelectItem>
                <SelectItem value="out">Sin Stock</SelectItem>
                <SelectItem value="critical">Críticos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[130px] h-9 bg-background hidden sm:flex">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nombre</SelectItem>
                <SelectItem value="stock">Stock</SelectItem>
                <SelectItem value="cost">Costo</SelectItem>
                <SelectItem value="updated">Actualizado</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 hidden sm:flex"
              onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>

          {/* Content */}
          {filteredParts.length === 0 ? (
            <div className="text-center py-12 rounded-lg border bg-card">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay repuestos que mostrar</p>
              {canCreateProduct && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => { resetForm(); setShowCreateDialog(true); }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primer repuesto
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile: Cards */}
              <div className="space-y-2 md:hidden">
                {filteredParts.map((part) => (
                  <div
                    key={part.id}
                    className="p-3 rounded-lg border bg-card"
                    onClick={() => { setSelectedPart(part); setShowDetailDialog(true); }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm truncate">{part.name}</p>
                          {part.isCritical && <ShieldAlert className="h-3.5 w-3.5 text-accent-purple-muted-foreground shrink-0" />}
                        </div>
                        {part.code && <p className="text-xs font-mono text-muted-foreground">{part.code}</p>}
                      </div>
                      {getStockBadge(part)}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-sm">
                      <div className="flex items-center gap-3">
                        <span className={cn('font-bold', part.stockQuantity <= part.minStockLevel ? 'text-destructive' : '')}>
                          {part.stockQuantity}
                        </span>
                        <span className="text-muted-foreground text-xs">mín: {part.minStockLevel}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {canEditProduct && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); openEditDialog(part); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedPart(part); setShowDetailDialog(true); }}>
                              <Eye className="h-4 w-4 mr-2" /> Ver detalles
                            </DropdownMenuItem>
                            {canDeleteProduct && (
                              <DropdownMenuItem className="text-destructive" onClick={() => { setSelectedPart(part); setShowDeleteDialog(true); }}>
                                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: Table */}
              <div className="hidden md:block rounded-lg border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-medium">Código</TableHead>
                      <TableHead className="font-medium">Nombre</TableHead>
                      <TableHead className="font-medium">Categoría</TableHead>
                      <TableHead className="text-center font-medium">Stock</TableHead>
                      <TableHead className="font-medium">Estado</TableHead>
                      <TableHead className="font-medium">Ubicación</TableHead>
                      <TableHead className="text-right font-medium">Costo</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParts.map((part) => (
                      <TableRow key={part.id} className="group">
                        <TableCell className="font-mono text-xs">
                          {part.code || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{part.name}</span>
                            {part.isCritical && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <ShieldAlert className="h-4 w-4 text-accent-purple-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>Repuesto crítico</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          {part.brand && (
                            <p className="text-xs text-muted-foreground">{part.brand} {part.model}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{part.category || 'Sin categoría'}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-semibold ${part.stockQuantity <= part.minStockLevel ? 'text-destructive' : ''}`}>
                            {part.stockQuantity}
                          </span>
                          <span className="text-muted-foreground text-xs"> / {part.minStockLevel}</span>
                        </TableCell>
                        <TableCell>{getStockBadge(part)}</TableCell>
                        <TableCell className="text-muted-foreground">{part.location || '-'}</TableCell>
                        <TableCell className="text-right">
                          {part.cost ? `$${part.cost.toLocaleString('es-AR')}` : '-'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelectedPart(part); setShowDetailDialog(true); }}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver detalles
                              </DropdownMenuItem>
                              {canEditProduct && (
                                <DropdownMenuItem onClick={() => openEditDialog(part)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {canDeleteProduct && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => { setSelectedPart(part); setShowDeleteDialog(true); }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        {/* Dialog Crear */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nuevo Repuesto</DialogTitle>
              <DialogDescription>
                Agrega un nuevo repuesto al inventario
              </DialogDescription>
            </DialogHeader>
            <SparePartForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleCreate}
              onCancel={() => setShowCreateDialog(false)}
              submitting={submitting}
              submitLabel="Crear Repuesto"
            />
          </DialogContent>
        </Dialog>

        {/* Dialog Editar */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Repuesto</DialogTitle>
              <DialogDescription>
                Modifica los datos del repuesto
              </DialogDescription>
            </DialogHeader>
            <SparePartForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleEdit}
              onCancel={() => { setShowEditDialog(false); setSelectedPart(null); }}
              submitting={submitting}
              submitLabel="Guardar Cambios"
            />
          </DialogContent>
        </Dialog>

        {/* Dialog Detalle */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {selectedPart?.name}
              </DialogTitle>
            </DialogHeader>
            {selectedPart && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Código</p>
                    <p className="font-medium font-mono">{selectedPart.code || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Categoría</p>
                    <p className="font-medium">{selectedPart.category || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Stock Actual</p>
                    <p className="font-medium">{selectedPart.stockQuantity} {selectedPart.unit}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Stock Mínimo</p>
                    <p className="font-medium">{selectedPart.minStockLevel}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ubicación</p>
                    <p className="font-medium">{selectedPart.location || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Costo Unitario</p>
                    <p className="font-medium">{selectedPart.cost ? `$${selectedPart.cost}` : '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Proveedor</p>
                    <p className="font-medium">{selectedPart.supplier || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Lead Time</p>
                    <p className="font-medium">{selectedPart.leadTimeDays ? `${selectedPart.leadTimeDays} días` : '-'}</p>
                  </div>
                </div>
                {selectedPart.description && (
                  <div>
                    <p className="text-muted-foreground text-sm">Descripción</p>
                    <p className="text-sm">{selectedPart.description}</p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {selectedPart.isCritical && (
                    <Badge className="bg-accent-purple-muted text-accent-purple-muted-foreground">
                      <ShieldAlert className="h-3 w-3 mr-1" />
                      Crítico
                    </Badge>
                  )}
                  {getStockBadge(selectedPart)}
                </div>

                {/* Historial de Movimientos */}
                <SparePartMovements
                  toolId={selectedPart.id}
                  companyId={currentCompany?.id}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog Eliminar */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Eliminar Repuesto
              </DialogTitle>
              <DialogDescription>
                ¿Estás seguro de eliminar <strong>{selectedPart?.name}</strong>?
                Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

interface SparePartFormProps {
  formData: any;
  setFormData: (data: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  submitLabel: string;
}

function SparePartForm({ formData, setFormData, onSubmit, onCancel, submitting, submitLabel }: SparePartFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Nombre *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Nombre del repuesto"
            className="h-9"
          />
        </div>

        <div>
          <Label>Código</Label>
          <Input
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="Código interno"
            className="h-9"
          />
        </div>

        <div>
          <Label>Categoría</Label>
          <Input
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            placeholder="Ej: Rodamientos, Filtros..."
            className="h-9"
          />
        </div>

        <div>
          <Label>Marca</Label>
          <Input
            value={formData.brand}
            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            placeholder="Marca"
            className="h-9"
          />
        </div>

        <div>
          <Label>Modelo</Label>
          <Input
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            placeholder="Modelo o número de parte"
            className="h-9"
          />
        </div>

        <div className="col-span-2">
          <Label>Descripción</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Descripción detallada del repuesto"
            rows={2}
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Boxes className="h-4 w-4" />
          Stock
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <Label>Cantidad</Label>
            <Input
              type="number"
              value={formData.stockQuantity}
              onChange={(e) => setFormData({ ...formData, stockQuantity: parseInt(e.target.value) || 0 })}
              min={0}
              className="h-9"
            />
          </div>
          <div>
            <Label>Mínimo</Label>
            <Input
              type="number"
              value={formData.minStockLevel}
              onChange={(e) => setFormData({ ...formData, minStockLevel: parseInt(e.target.value) || 0 })}
              min={0}
              className="h-9"
            />
          </div>
          <div>
            <Label>Máximo</Label>
            <Input
              type="number"
              value={formData.maxStockLevel}
              onChange={(e) => setFormData({ ...formData, maxStockLevel: parseInt(e.target.value) || 0 })}
              min={0}
              className="h-9"
            />
          </div>
          <div>
            <Label>Punto Reorden</Label>
            <Input
              type="number"
              value={formData.reorderPoint}
              onChange={(e) => setFormData({ ...formData, reorderPoint: parseInt(e.target.value) || 0 })}
              min={0}
              className="h-9"
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Cog className="h-4 w-4" />
          Detalles
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Ubicación</Label>
            <Input
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Ej: Estante A-3"
              className="h-9"
            />
          </div>
          <div>
            <Label>Unidad</Label>
            <Input
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              placeholder="Ej: unidad, metro, litro"
              className="h-9"
            />
          </div>
          <div>
            <Label>Costo Unitario</Label>
            <Input
              type="number"
              value={formData.cost}
              onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
              min={0}
              step={0.01}
              className="h-9"
            />
          </div>
          <div>
            <Label>Proveedor</Label>
            <Input
              value={formData.supplier}
              onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              placeholder="Nombre del proveedor"
              className="h-9"
            />
          </div>
          <div>
            <Label>Lead Time (días)</Label>
            <Input
              type="number"
              value={formData.leadTimeDays}
              onChange={(e) => setFormData({ ...formData, leadTimeDays: parseInt(e.target.value) || 0 })}
              min={0}
              className="h-9"
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Checkbox
              id="isCritical"
              checked={formData.isCritical}
              onCheckedChange={(checked) => setFormData({ ...formData, isCritical: !!checked })}
            />
            <Label htmlFor="isCritical" className="cursor-pointer flex items-center gap-1">
              <ShieldAlert className="h-4 w-4 text-accent-purple-muted-foreground" />
              Repuesto Crítico
            </Label>
          </div>
        </div>
      </div>

      <DialogFooter className="pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {submitLabel}
        </Button>
      </DialogFooter>
    </div>
  );
}

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  IN: 'Entrada',
  OUT: 'Salida',
  TRANSFER: 'Transferencia',
  MAINTENANCE: 'Mantenimiento',
  RETURN: 'Devolución',
  ADJUSTMENT: 'Ajuste',
  LOAN: 'Préstamo',
};

function SparePartMovements({ toolId, companyId }: { toolId: number; companyId?: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['panol', 'movements', toolId],
    queryFn: async () => {
      const res = await fetch(`/api/tools/movements?companyId=${companyId}&toolId=${toolId}&limit=10`);
      if (!res.ok) throw new Error('Error cargando movimientos');
      const json = await res.json();
      return (json.movements || []) as Array<{
        id: number;
        type: string;
        quantity: number;
        reason: string | null;
        createdAt: string;
      }>;
    },
    enabled: !!companyId && !!toolId,
    staleTime: 60 * 1000,
  });

  return (
    <div className="border-t pt-4">
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <History className="h-4 w-4" />
        Últimos Movimientos
      </h4>
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">Sin movimientos registrados</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs">Cant.</TableHead>
                <TableHead className="text-xs">Motivo</TableHead>
                <TableHead className="text-xs">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((mov) => (
                <TableRow key={mov.id}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        mov.type === 'IN' || mov.type === 'RETURN'
                          ? 'border-success-muted text-success'
                          : mov.type === 'OUT' || mov.type === 'LOAN'
                          ? 'border-destructive/30 text-destructive'
                          : ''
                      )}
                    >
                      {MOVEMENT_TYPE_LABELS[mov.type] || mov.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {mov.type === 'IN' || mov.type === 'RETURN' ? '+' : '-'}{mov.quantity}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {mov.reason || '-'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(mov.createdAt).toLocaleDateString('es-AR', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
