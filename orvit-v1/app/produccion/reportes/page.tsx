'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  Loader2,
  FileSpreadsheet,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface ReportData {
  production: {
    byDay: { date: string; good: number; scrap: number; rework: number }[];
    byWorkCenter: { name: string; total: number; scrap: number }[];
    byShift: { name: string; total: number }[];
  };
  downtimes: {
    byReason: { name: string; minutes: number; count: number }[];
    byType: { type: string; minutes: number }[];
    trend: { date: string; planned: number; unplanned: number }[];
  };
  quality: {
    byResult: { result: string; count: number }[];
    trend: { date: string; approved: number; rejected: number }[];
  };
  orders: {
    byStatus: { status: string; count: number }[];
    completionRate: number;
  };
}

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function ProductionReportsPage() {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [workCenters, setWorkCenters] = useState<{ id: number; name: string }[]>([]);
  const [selectedWorkCenter, setSelectedWorkCenter] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
      });
      if (selectedWorkCenter) {
        params.set('workCenterId', selectedWorkCenter);
      }

      // Fetch KPIs which contain most of the data we need
      const res = await fetch(`/api/production/kpis?${params}`);
      const data = await res.json();

      if (data.success) {
        // Transform KPI data into report format
        setReportData({
          production: {
            byDay: data.kpis.charts.productionByDay.map((d: any) => ({
              ...d,
              rework: 0, // Not tracked separately in KPIs
            })),
            byWorkCenter: [], // Would need separate query
            byShift: [], // Would need separate query
          },
          downtimes: {
            byReason: data.kpis.downtimes.paretoByReason,
            byType: [
              { type: 'Planificadas', minutes: data.kpis.production.totalDowntimeMinutes * (data.kpis.downtimes.planned / Math.max(data.kpis.downtimes.total, 1)) },
              { type: 'No Planificadas', minutes: data.kpis.production.totalDowntimeMinutes * (data.kpis.downtimes.unplanned / Math.max(data.kpis.downtimes.total, 1)) },
            ],
            trend: [],
          },
          quality: {
            byResult: [
              { result: 'Aprobados', count: data.kpis.quality.approved },
              { result: 'Rechazados', count: data.kpis.quality.rejected },
              { result: 'Retenidos', count: data.kpis.quality.hold },
            ].filter(d => d.count > 0),
            trend: [],
          },
          orders: {
            byStatus: [
              { status: 'En Progreso', count: data.kpis.orders.inProgress },
              { status: 'Completadas', count: data.kpis.orders.completed },
              { status: 'Pausadas', count: data.kpis.orders.paused },
            ],
            completionRate: data.kpis.orders.planVsRealPercent,
          },
        });
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error('Error al cargar datos del reporte');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedWorkCenter]);

  const fetchWorkCenters = useCallback(async () => {
    try {
      const res = await fetch('/api/production/work-centers?status=ACTIVE');
      const data = await res.json();
      if (data.success) {
        setWorkCenters(data.workCenters);
      }
    } catch (error) {
      console.error('Error fetching work centers:', error);
    }
  }, []);

  useEffect(() => {
    fetchWorkCenters();
  }, [fetchWorkCenters]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const setQuickPeriod = (period: 'month' | 'lastMonth' | 'quarter' | 'year') => {
    const today = new Date();
    switch (period) {
      case 'month':
        setDateFrom(format(startOfMonth(today), 'yyyy-MM-dd'));
        setDateTo(format(today, 'yyyy-MM-dd'));
        break;
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        setDateFrom(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
        setDateTo(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));
        break;
      case 'quarter':
        setDateFrom(format(subDays(today, 90), 'yyyy-MM-dd'));
        setDateTo(format(today, 'yyyy-MM-dd'));
        break;
      case 'year':
        setDateFrom(format(new Date(today.getFullYear(), 0, 1), 'yyyy-MM-dd'));
        setDateTo(format(today, 'yyyy-MM-dd'));
        break;
    }
  };

  const exportToCSV = async () => {
    if (!reportData) return;

    setExporting(true);
    try {
      // Create CSV content for production by day
      let csv = 'Fecha,Buenas,Scrap\n';
      reportData.production.byDay.forEach(d => {
        csv += `${d.date},${d.good},${d.scrap}\n`;
      });

      // Create blob and download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `reporte_produccion_${dateFrom}_${dateTo}.csv`;
      link.click();

      toast.success('Reporte exportado');
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-3 border-b border-border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Reportes de Producción</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Análisis y tendencias del módulo de producción
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={exportToCSV} disabled={exporting || !reportData}>
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Exportar CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 space-y-6">

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod('month')}>
                Este Mes
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod('lastMonth')}>
                Mes Anterior
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod('quarter')}>
                Trimestre
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod('year')}>
                Año
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-36"
              />
              <span className="text-muted-foreground">a</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-36"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedWorkCenter || 'all'} onValueChange={(v) => setSelectedWorkCenter(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos los centros" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los centros</SelectItem>
                  {workCenters.map((wc) => (
                    <SelectItem key={wc.id} value={wc.id.toString()}>
                      {wc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-info-muted-foreground" />
        </div>
      ) : reportData ? (
        <>
          {/* Production Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Production Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-success" />
                  Producción por Día
                </CardTitle>
                <CardDescription>
                  Unidades buenas vs scrap
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reportData.production.byDay.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={reportData.production.byDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: es })}
                        fontSize={12}
                      />
                      <YAxis fontSize={12} />
                      <Tooltip
                        labelFormatter={(value) => format(new Date(value), 'dd MMM yyyy', { locale: es })}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="good"
                        name="Buenas"
                        stroke="#10b981"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="scrap"
                        name="Scrap"
                        stroke="#ef4444"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Sin datos para el período seleccionado
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-info-muted-foreground" />
                  Estado de Órdenes
                </CardTitle>
                <CardDescription>
                  Distribución por estado
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reportData.orders.byStatus.some(s => s.count > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={reportData.orders.byStatus.filter(s => s.count > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="status"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {reportData.orders.byStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Sin órdenes en el período
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Downtime Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Downtime by Reason (Pareto) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-destructive" />
                  Pareto de Paradas
                </CardTitle>
                <CardDescription>
                  Top motivos por tiempo total
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reportData.downtimes.byReason.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={reportData.downtimes.byReason}
                      layout="vertical"
                      margin={{ left: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" fontSize={12} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        fontSize={12}
                        width={75}
                        tickFormatter={(value) => value.length > 12 ? value.substring(0, 12) + '...' : value}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatMinutes(value), 'Tiempo']}
                      />
                      <Bar dataKey="minutes" fill="#ef4444" radius={[0, 4, 4, 0]}>
                        {reportData.downtimes.byReason.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Sin paradas registradas
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quality Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  Controles de Calidad
                </CardTitle>
                <CardDescription>
                  Distribución por resultado
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reportData.quality.byResult.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={reportData.quality.byResult}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="result"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#ef4444" />
                        <Cell fill="#f59e0b" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Sin controles de calidad
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Cumplimiento Plan vs Real</p>
                  <p className={`text-4xl font-bold ${
                    reportData.orders.completionRate >= 100 ? 'text-success' : 'text-warning-muted-foreground'
                  }`}>
                    {reportData.orders.completionRate}%
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Total Paradas (min)</p>
                  <p className="text-4xl font-bold text-destructive">
                    {formatMinutes(
                      reportData.downtimes.byType.reduce((acc, d) => acc + d.minutes, 0)
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Tasa Aprobación QC</p>
                  <p className="text-4xl font-bold text-success">
                    {reportData.quality.byResult.length > 0
                      ? Math.round(
                          (reportData.quality.byResult.find(r => r.result === 'Aprobados')?.count || 0) /
                          reportData.quality.byResult.reduce((acc, r) => acc + r.count, 0) * 100
                        )
                      : 0}%
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <div className="text-center text-muted-foreground py-12">
          No se pudieron cargar los datos del reporte
        </div>
      )}
      </div>
    </div>
  );
}
