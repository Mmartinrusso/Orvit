'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Database,
  Loader2,
  HardDrive,
  Activity,
  Server,
  RefreshCw,
  Download,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
  BarChart3,
  Table2,
  FileJson,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface DatabaseStats {
  status: 'healthy' | 'warning' | 'critical';
  version: string;
  uptime: string;
  connections: {
    active: number;
    idle: number;
    max: number;
  };
  storage: {
    used: number;
    total: number;
    percentage: number;
  };
  performance: {
    avgQueryTime: number;
    slowQueries: number;
    cacheHitRatio: number;
  };
}

interface TableInfo {
  name: string;
  rows: number;
  size: string;
  lastVacuum: string | null;
  lastAnalyze: string | null;
}

interface Backup {
  id: string;
  filename: string;
  size: string;
  createdAt: string;
  type: 'manual' | 'automatic';
  status: 'completed' | 'in_progress' | 'failed';
}

// Datos de ejemplo
const mockStats: DatabaseStats = {
  status: 'healthy',
  version: 'PostgreSQL 15.4',
  uptime: '15 days, 4 hours',
  connections: {
    active: 8,
    idle: 12,
    max: 100,
  },
  storage: {
    used: 2.4,
    total: 10,
    percentage: 24,
  },
  performance: {
    avgQueryTime: 12.5,
    slowQueries: 3,
    cacheHitRatio: 98.5,
  },
};

const mockTables: TableInfo[] = [
  { name: 'users', rows: 156, size: '2.1 MB', lastVacuum: '2025-01-10', lastAnalyze: '2025-01-10' },
  { name: 'companies', rows: 12, size: '128 KB', lastVacuum: '2025-01-10', lastAnalyze: '2025-01-10' },
  { name: 'work_orders', rows: 3420, size: '45.2 MB', lastVacuum: '2025-01-10', lastAnalyze: '2025-01-10' },
  { name: 'tasks', rows: 8750, size: '62.8 MB', lastVacuum: '2025-01-10', lastAnalyze: '2025-01-10' },
  { name: 'machines', rows: 245, size: '8.4 MB', lastVacuum: '2025-01-10', lastAnalyze: '2025-01-10' },
  { name: 'maintenance_checklists', rows: 89, size: '12.3 MB', lastVacuum: '2025-01-10', lastAnalyze: '2025-01-10' },
  { name: 'products', rows: 1250, size: '15.6 MB', lastVacuum: '2025-01-10', lastAnalyze: '2025-01-10' },
  { name: 'audit_logs', rows: 45620, size: '128.4 MB', lastVacuum: '2025-01-09', lastAnalyze: '2025-01-09' },
];

const mockBackups: Backup[] = [
  { id: '1', filename: 'backup_2025-01-11_00-00.sql', size: '285 MB', createdAt: '2025-01-11T00:00:00Z', type: 'automatic', status: 'completed' },
  { id: '2', filename: 'backup_2025-01-10_00-00.sql', size: '283 MB', createdAt: '2025-01-10T00:00:00Z', type: 'automatic', status: 'completed' },
  { id: '3', filename: 'backup_2025-01-09_15-30.sql', size: '281 MB', createdAt: '2025-01-09T15:30:00Z', type: 'manual', status: 'completed' },
  { id: '4', filename: 'backup_2025-01-09_00-00.sql', size: '280 MB', createdAt: '2025-01-09T00:00:00Z', type: 'automatic', status: 'completed' },
];

const statusConfig = {
  healthy: { label: 'Saludable', color: 'bg-green-500/10 text-green-500 border-green-500/20', icon: CheckCircle },
  warning: { label: 'Advertencia', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', icon: AlertCircle },
  critical: { label: 'Crítico', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: AlertCircle },
};

export default function DatabasePage() {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setStats(mockStats);
      setTables(mockTables);
      setBackups(mockBackups);
      setLoading(false);
    }, 500);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      toast.success('Estadísticas actualizadas');
    }, 1000);
  };

  const handleCreateBackup = () => {
    setCreatingBackup(true);
    setTimeout(() => {
      setCreatingBackup(false);
      toast.success('Backup creado correctamente');
      setBackups([
        {
          id: String(Date.now()),
          filename: `backup_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.sql`,
          size: '286 MB',
          createdAt: new Date().toISOString(),
          type: 'manual',
          status: 'completed',
        },
        ...backups,
      ]);
    }, 3000);
  };

  const handleVacuum = () => {
    toast.success('Vacuum iniciado. Este proceso puede tomar varios minutos.');
  };

  const handleAnalyze = () => {
    toast.success('Analyze iniciado. Este proceso puede tomar varios minutos.');
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const StatusIcon = statusConfig[stats.status].icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Base de Datos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitoreo y mantenimiento de la base de datos
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Actualizar
        </Button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", statusConfig[stats.status].color.split(' ')[0])}>
                <StatusIcon className={cn("h-6 w-6", statusConfig[stats.status].color.split(' ')[1])} />
              </div>
              <div>
                <Badge className={cn("text-xs mb-1", statusConfig[stats.status].color)}>
                  {statusConfig[stats.status].label}
                </Badge>
                <p className="text-sm text-muted-foreground">{stats.version}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Server className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats.connections.active}/{stats.connections.max}
                </p>
                <p className="text-sm text-muted-foreground">Conexiones</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <HardDrive className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats.storage.used} GB
                </p>
                <p className="text-sm text-muted-foreground">
                  de {stats.storage.total} GB ({stats.storage.percentage}%)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Zap className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats.performance.cacheHitRatio}%
                </p>
                <p className="text-sm text-muted-foreground">Cache Hit Ratio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Rendimiento
            </CardTitle>
            <CardDescription>
              Métricas de rendimiento de la base de datos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Tiempo promedio de consulta</span>
              </div>
              <span className="font-medium">{stats.performance.avgQueryTime} ms</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Consultas lentas (últimas 24h)</span>
              </div>
              <Badge variant="outline">{stats.performance.slowQueries}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Uptime</span>
              </div>
              <span className="font-medium">{stats.uptime}</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Uso de almacenamiento</span>
                <span>{stats.storage.percentage}%</span>
              </div>
              <Progress value={stats.storage.percentage} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Maintenance Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Mantenimiento
            </CardTitle>
            <CardDescription>
              Acciones de mantenimiento de la base de datos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={handleVacuum}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Vacuum
              </Button>
              <Button variant="outline" onClick={handleAnalyze}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Analyze
              </Button>
            </div>
            <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Download className="h-4 w-4" />
                Backups
              </h4>
              <p className="text-xs text-muted-foreground">
                Último backup: {formatDistanceToNow(new Date(backups[0]?.createdAt), { addSuffix: true, locale: es })}
              </p>
              <Button onClick={handleCreateBackup} disabled={creatingBackup} className="w-full">
                {creatingBackup ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Crear Backup Manual
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Table2 className="h-5 w-5 text-primary" />
            Tablas
          </CardTitle>
          <CardDescription>
            Información de las tablas principales
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tabla</TableHead>
                <TableHead className="text-right">Registros</TableHead>
                <TableHead className="text-right">Tamaño</TableHead>
                <TableHead>Último Vacuum</TableHead>
                <TableHead>Último Analyze</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tables.map((table) => (
                <TableRow key={table.name}>
                  <TableCell className="font-mono text-sm">{table.name}</TableCell>
                  <TableCell className="text-right">{table.rows.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{table.size}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {table.lastVacuum ? format(new Date(table.lastVacuum), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {table.lastAnalyze ? format(new Date(table.lastAnalyze), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Backups */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-primary" />
            Historial de Backups
          </CardTitle>
          <CardDescription>
            Últimos backups realizados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Archivo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Tamaño</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.map((backup) => (
                <TableRow key={backup.id}>
                  <TableCell className="font-mono text-sm">{backup.filename}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {backup.type === 'automatic' ? 'Automático' : 'Manual'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{backup.size}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(backup.createdAt), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn(
                      "text-xs",
                      backup.status === 'completed'
                        ? "bg-green-500/10 text-green-500 border-green-500/20"
                        : backup.status === 'in_progress'
                        ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                        : "bg-red-500/10 text-red-500 border-red-500/20"
                    )}>
                      {backup.status === 'completed' ? 'Completado' : backup.status === 'in_progress' ? 'En progreso' : 'Fallido'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
