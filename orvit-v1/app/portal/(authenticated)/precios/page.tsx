'use client';

import { DEFAULT_COLORS, type UserColorPreferences } from '@/lib/colors';
import { useState, useEffect, useMemo } from 'react';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DollarSign, Search, Package, Loader2, X, Tag, Layers, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Color preferences interface




interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  unidad: string;
  categoria: { id: number; name: string } | null;
  precio: number | null;
  moneda: string;
}

interface Categoria {
  id: number;
  name: string;
}

interface PreciosResponse {
  productos: Producto[];
  categorias: Categoria[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  message?: string;
}

export default function PortalPreciosPage() {
  const { user, canViewPrices } = usePortalAuth();

  // Color preferences
  const [userColors, setUserColors] = useState<UserColorPreferences>(DEFAULT_COLORS);

  // Data states
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PreciosResponse | null>(null);

  // Filter states
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [page, setPage] = useState(1);

  // Load color preferences
  useEffect(() => {
    const loadColorPreferences = async () => {
      if (!user?.companyId) return;
      try {
        const response = await fetch(`/api/costos/color-preferences?companyId=${user.companyId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.colors) {
            setUserColors(data.colors);
          }
        }
      } catch (error) {
        console.error('Error loading color preferences:', error);
      }
    };
    loadColorPreferences();
  }, [user?.companyId]);

  const fetchPrices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (categoryId && categoryId !== 'all') params.set('categoryId', categoryId);
      params.set('page', page.toString());
      params.set('limit', '50');

      const response = await fetch(`/api/portal/precios?${params.toString()}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching prices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canViewPrices) {
      fetchPrices();
    }
  }, [canViewPrices, page, categoryId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPrices();
  };

  const handleClearSearch = () => {
    setSearch('');
    setPage(1);
    fetchPrices();
  };

  // Stats
  const stats = useMemo(() => {
    if (!data) return null;
    const totalProducts = data.pagination.total;
    const withPrice = data.productos.filter(p => p.precio !== null).length;
    const categories = data.categorias.length;
    return { totalProducts, withPrice, categories };
  }, [data]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!data?.productos || data.productos.length === 0) {
      toast.error('No hay productos para exportar');
      return;
    }

    const headers = ['Codigo', 'Producto', 'Categoria', 'Unidad', 'Precio', 'Moneda'];
    const rows = data.productos.map(p => [
      p.codigo,
      p.nombre,
      p.categoria?.name || '-',
      p.unidad,
      p.precio !== null ? p.precio.toFixed(2) : '-',
      p.moneda
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `lista_precios_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Lista de precios exportada');
  };

  if (!canViewPrices) {
    return (
      <TooltipProvider>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div
              className="h-16 w-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${userColors.kpiNegative}15` }}
            >
              <DollarSign className="h-8 w-8" style={{ color: userColors.kpiNegative }} />
            </div>
            <h2 className="text-xl font-semibold mb-2">Acceso restringido</h2>
            <p className="text-muted-foreground">No tenes permisos para ver la lista de precios.</p>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Lista de Precios</h1>
            <p className="text-muted-foreground">Consulta los precios actualizados de productos</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV}>
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </TooltipTrigger>
            <TooltipContent>Exportar a CSV</TooltipContent>
          </Tooltip>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Productos
                  </p>
                  <p className="text-2xl font-bold">
                    {loading ? '-' : stats?.totalProducts || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    En lista de precios
                  </p>
                </div>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.chart1}15` }}
                >
                  <Package className="h-5 w-5" style={{ color: userColors.chart1 }} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Categorias
                  </p>
                  <p className="text-2xl font-bold">
                    {loading ? '-' : stats?.categories || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Disponibles
                  </p>
                </div>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.chart2}15` }}
                >
                  <Layers className="h-5 w-5" style={{ color: userColors.chart2 }} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2 md:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Con Precio
                  </p>
                  <p className="text-2xl font-bold">
                    {loading ? '-' : stats?.withPrice || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    De esta pagina
                  </p>
                </div>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.chart5}15` }}
                >
                  <DollarSign className="h-5 w-5" style={{ color: userColors.chart5 }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex items-center gap-4 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, SKU o descripcion..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-background"
                />
                {search && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={handleClearSearch}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Category Filter */}
              <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorias</SelectItem>
                  {data?.categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button type="submit">
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4" style={{ color: userColors.chart1 }} />
              Productos
              {data && (
                <Badge variant="secondary" className="font-normal">
                  {data.pagination.total} productos
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <Package className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">Cargando productos...</p>
                </div>
              </div>
            ) : data?.message ? (
              <div className="text-center py-12">
                <div
                  className="h-16 w-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.chart4}15` }}
                >
                  <Package className="h-8 w-8" style={{ color: userColors.chart4 }} />
                </div>
                <h3 className="text-lg font-medium mb-1">Sin lista de precios</h3>
                <p className="text-muted-foreground text-sm">{data.message}</p>
              </div>
            ) : data?.productos.length === 0 ? (
              <div className="text-center py-12">
                <div
                  className="h-16 w-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.kpiNeutral}15` }}
                >
                  <Package className="h-8 w-8" style={{ color: userColors.kpiNeutral }} />
                </div>
                <h3 className="text-lg font-medium mb-1">No se encontraron productos</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Intenta con otros terminos de busqueda
                </p>
                <Button variant="outline" onClick={handleClearSearch}>
                  Limpiar filtros
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Codigo</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Unidad</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.productos.map((producto) => (
                        <TableRow
                          key={producto.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <TableCell className="font-mono text-sm">
                            {producto.codigo}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{producto.nombre}</p>
                              {producto.descripcion && (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {producto.descripcion}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {producto.categoria ? (
                              <Badge variant="outline" className="text-xs">
                                {producto.categoria.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{producto.unidad}</TableCell>
                          <TableCell className="text-right">
                            {producto.precio !== null ? (
                              <span className="font-bold text-foreground">
                                {producto.moneda === 'USD' ? 'US$' : '$'}
                                {producto.precio.toLocaleString('es-AR', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {data && data.pagination.pages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Pagina {data.pagination.page} de {data.pagination.pages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === data.pagination.pages}
                        onClick={() => setPage(page + 1)}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
