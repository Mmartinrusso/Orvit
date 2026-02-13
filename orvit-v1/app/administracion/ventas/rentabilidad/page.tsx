'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { RentabilityFilters } from '@/components/ventas/analytics/rentability-filters';
import { MarginMatrixChart } from '@/components/ventas/analytics/margin-matrix-chart';
import { ProfitabilityRankingTable } from '@/components/ventas/analytics/profitability-ranking-table';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, DollarSign, Package, AlertTriangle } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useRouter } from 'next/navigation';

interface ProfitabilityData {
  periodo: {
    desde: Date;
    hasta: Date;
  };
  ranking: any[];
  summary: {
    totalProducts: number;
    productsWithSales: number;
    averageMargin: number;
    totalContribution: number;
    totalRevenue: number;
  };
  distribution: {
    byMargin: { range: string; count: number; percentage: number }[];
    byVelocity: { alta: number; media: number; baja: number };
  };
}

export default function RentabilidadPage() {
  const router = useRouter();

  // State para filtros
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(subMonths(new Date(), 2)),
    to: endOfMonth(new Date()),
  });
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState('margen');
  const [margenMinimo, setMargenMinimo] = useState<number | null>(null);
  const [rankingTab, setRankingTab] = useState('all');

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const res = await fetch('/api/ventas/product-config');
      if (!res.ok) throw new Error('Failed to fetch categories');
      const data = await res.json();
      return data.categories || [];
    },
  });

  // Fetch profitability data
  const {
    data: profitabilityData,
    isLoading,
    error,
    refetch,
  } = useQuery<ProfitabilityData>({
    queryKey: [
      'profitability-analysis',
      dateRange.from,
      dateRange.to,
      sortBy,
      selectedCategory,
      margenMinimo,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        fechaDesde: dateRange.from.toISOString(),
        fechaHasta: dateRange.to.toISOString(),
        ordenarPor: sortBy,
        limite: '100',
      });
      if (selectedCategory) params.append('categoriaId', selectedCategory.toString());
      if (margenMinimo !== null) params.append('margenMinimo', margenMinimo.toString());

      const res = await fetch(`/api/ventas/productos/analytics/rentabilidad?${params}`);
      if (!res.ok) throw new Error('Failed to fetch profitability data');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 10 * 60 * 1000, // 10 min
  });

  const handleResetFilters = () => {
    setSelectedCategory(null);
    setMargenMinimo(null);
  };

  const handleProductClick = (productId: string) => {
    router.push(`/administracion/ventas/productos?productId=${productId}`);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Filtrar ranking según el tab
  const filteredRanking = profitabilityData?.ranking || [];
  const displayedRanking =
    rankingTab === 'top'
      ? filteredRanking.slice(0, 20)
      : rankingTab === 'bottom'
      ? filteredRanking.slice(-20).reverse()
      : filteredRanking;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Error al cargar el análisis de rentabilidad. Intenta nuevamente.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { summary, distribution } = profitabilityData!;

  // Datos para gráfico de velocidad
  const velocityChartData = [
    { name: 'Alta', value: distribution.byVelocity.alta, color: '#10b981' },
    { name: 'Media', value: distribution.byVelocity.media, color: '#3b82f6' },
    { name: 'Baja', value: distribution.byVelocity.baja, color: '#6b7280' },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Análisis de Rentabilidad</h1>
        <p className="text-muted-foreground mt-1">
          Optimiza tus márgenes y estrategia de precios
        </p>
      </div>

      {/* Filters */}
      <RentabilityFilters
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        categories={categoriesData || []}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        margenMinimo={margenMinimo}
        onMargenMinimoChange={setMargenMinimo}
        onReset={handleResetFilters}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margen Promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.averageMargin.toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              De {summary.productsWithSales} productos con ventas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos Rentables</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.productsWithSales}/{summary.totalProducts}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.totalProducts > 0
                ? ((summary.productsWithSales / summary.totalProducts) * 100).toFixed(1)
                : 0}
              % con ventas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contribución Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalContribution)}</div>
            <p className="text-xs text-muted-foreground mt-1">Ganancia bruta del período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Revenue del período</p>
          </CardContent>
        </Card>
      </div>

      {/* Margin Matrix Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Matriz Costo vs Precio</CardTitle>
          <CardDescription>
            Visualización de productos según costo y precio de venta. Los productos debajo de la
            línea roja están operando con pérdida.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MarginMatrixChart
            products={profitabilityData!.ranking}
            marginMin={20}
            marginMax={50}
            onProductClick={handleProductClick}
          />
        </CardContent>
      </Card>

      {/* Ranking Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Ranking de Productos</CardTitle>
              <CardDescription>
                Productos ordenados por {sortBy === 'margen' ? 'margen' : sortBy === 'ventas' ? 'ventas' : sortBy === 'contribucion' ? 'contribución' : 'rotación'}
              </CardDescription>
            </div>
            <Tabs value={rankingTab} onValueChange={setRankingTab}>
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="top">Top 20</TabsTrigger>
                <TabsTrigger value="bottom">Bottom 20</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <ProfitabilityRankingTable
            products={displayedRanking}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onProductSelect={handleProductClick}
          />
        </CardContent>
      </Card>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Margin Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Margen</CardTitle>
            <CardDescription>Cantidad de productos por rango de margen</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={distribution.byMargin}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Velocity Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Velocidad de Rotación</CardTitle>
            <CardDescription>Distribución de productos por velocidad</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={velocityChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {velocityChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
