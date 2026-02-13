'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Gauge,
  Plus,
  Search,
  RefreshCw,
  Thermometer,
  Activity,
  Droplet,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  ClipboardList,
} from 'lucide-react';

interface MeasuringPoint {
  id: number;
  machineId: number;
  machineName: string;
  name: string;
  code?: string;
  measurementType: string;
  unit: string;
  normalMin?: number;
  normalMax?: number;
  warningMin?: number;
  warningMax?: number;
  criticalMin?: number;
  criticalMax?: number;
  readingCount: number;
  lastValue?: number;
  lastStatus?: string;
}

interface InspectionRound {
  id: number;
  name: string;
  sectorName?: string;
  frequencyHours: number;
  executionCount: number;
  lastExecutedAt?: string;
  isActive: boolean;
}

const MEASUREMENT_TYPES: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  TEMPERATURE: { label: 'Temperatura', icon: Thermometer, color: 'text-red-500' },
  VIBRATION: { label: 'Vibración', icon: Activity, color: 'text-purple-500' },
  PRESSURE: { label: 'Presión', icon: Gauge, color: 'text-blue-500' },
  LEVEL: { label: 'Nivel', icon: Droplet, color: 'text-cyan-500' },
  CURRENT: { label: 'Corriente', icon: Zap, color: 'text-yellow-500' },
  OTHER: { label: 'Otro', icon: Gauge, color: 'text-gray-500' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  OK: { label: 'Normal', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  NORMAL: { label: 'Normal', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  WARNING: { label: 'Alerta', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle },
  CRITICAL: { label: 'Crítico', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function PuntosMedicionPage() {
  const { currentCompany } = useCompany();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('points');

  const { data: pointsData, isLoading: loadingPoints, refetch: refetchPoints } = useQuery({
    queryKey: ['measuring-points', currentCompany?.id],
    queryFn: async () => {
      const res = await fetch(`/api/measuring-points?companyId=${currentCompany?.id}&view=points`);
      if (!res.ok) throw new Error('Error fetching points');
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });

  const { data: roundsData, isLoading: loadingRounds, refetch: refetchRounds } = useQuery({
    queryKey: ['inspection-rounds', currentCompany?.id],
    queryFn: async () => {
      const res = await fetch(`/api/measuring-points?companyId=${currentCompany?.id}&view=rounds`);
      if (!res.ok) throw new Error('Error fetching rounds');
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });

  const points: MeasuringPoint[] = pointsData?.points || [];
  const rounds: InspectionRound[] = roundsData?.rounds || [];
  const summary = pointsData?.summary || {};

  const filteredPoints = points.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.machineName.toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === 'all' || p.measurementType === typeFilter;
    const matchesStatus = statusFilter === 'all' || p.lastStatus === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleRefresh = () => {
    refetchPoints();
    refetchRounds();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gauge className="h-6 w-6" />
            Puntos de Medición
          </h1>
          <p className="text-muted-foreground">
            Monitoreo manual de variables y rondas de inspección
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Punto
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Puntos</p>
                <p className="text-2xl font-bold">{summary.total || 0}</p>
              </div>
              <Gauge className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Normales</p>
                <p className="text-2xl font-bold text-green-600">{summary.normal || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En Alerta</p>
                <p className="text-2xl font-bold text-yellow-600">{summary.warning || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Críticos</p>
                <p className="text-2xl font-bold text-red-600">{summary.critical || 0}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="points" className="flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            Puntos de Medición
          </TabsTrigger>
          <TabsTrigger value="rounds" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Rondas de Inspección
          </TabsTrigger>
        </TabsList>

        <TabsContent value="points" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o máquina..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="TEMPERATURE">Temperatura</SelectItem>
                <SelectItem value="VIBRATION">Vibración</SelectItem>
                <SelectItem value="PRESSURE">Presión</SelectItem>
                <SelectItem value="LEVEL">Nivel</SelectItem>
                <SelectItem value="CURRENT">Corriente</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="OK">Normal</SelectItem>
                <SelectItem value="WARNING">Alerta</SelectItem>
                <SelectItem value="CRITICAL">Crítico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Points Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Punto</TableHead>
                    <TableHead>Máquina</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Última Lectura</TableHead>
                    <TableHead>Rango Normal</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPoints ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : filteredPoints.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No se encontraron puntos de medición
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPoints.map((point) => {
                      const typeConfig = MEASUREMENT_TYPES[point.measurementType] || MEASUREMENT_TYPES.OTHER;
                      const TypeIcon = typeConfig.icon;
                      const statusConfig = STATUS_CONFIG[point.lastStatus || 'OK'] || STATUS_CONFIG.OK;
                      const StatusIcon = statusConfig.icon;

                      return (
                        <TableRow key={point.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{point.name}</p>
                              {point.code && <p className="text-xs text-muted-foreground">{point.code}</p>}
                            </div>
                          </TableCell>
                          <TableCell>{point.machineName}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <TypeIcon className={`h-4 w-4 ${typeConfig.color}`} />
                              {typeConfig.label}
                            </div>
                          </TableCell>
                          <TableCell>
                            {point.lastValue !== undefined ? (
                              <span className="font-mono">
                                {point.lastValue} {point.unit}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {point.normalMin !== undefined && point.normalMax !== undefined ? (
                              <span className="text-sm text-muted-foreground">
                                {point.normalMin} - {point.normalMax} {point.unit}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusConfig.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm">
                              Registrar
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rounds" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Ronda
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingRounds ? (
              Array(3).fill(0).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="pt-6">
                    <div className="h-24 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))
            ) : rounds.length === 0 ? (
              <div className="col-span-3 text-center py-12">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay rondas de inspección configuradas</p>
              </div>
            ) : (
              rounds.map((round) => (
                <Card key={round.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{round.name}</CardTitle>
                      <Badge variant={round.isActive ? 'default' : 'secondary'}>
                        {round.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {round.sectorName && (
                        <p className="text-muted-foreground">{round.sectorName}</p>
                      )}
                      <p>Frecuencia: cada {round.frequencyHours}h</p>
                      <p>Ejecuciones: {round.executionCount}</p>
                      {round.lastExecutedAt && (
                        <p className="text-xs text-muted-foreground">
                          Última: {new Date(round.lastExecutedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Button className="w-full mt-4" variant="outline" size="sm">
                      Iniciar Ronda
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
