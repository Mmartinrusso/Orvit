'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Activity,
  Search,
  Filter,
  Loader2,
  RefreshCw,
  User,
  Building2,
  Settings,
  Shield,
  FileText,
  Puzzle,
  LogIn,
  LogOut,
  Edit,
  Trash2,
  Plus,
  Eye,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ActivityLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  details: string | null;
  userId: number;
  userName: string;
  userEmail: string;
  companyId: number | null;
  companyName: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const actionIcons: Record<string, any> = {
  LOGIN: LogIn,
  LOGOUT: LogOut,
  CREATE: Plus,
  UPDATE: Edit,
  DELETE: Trash2,
  VIEW: Eye,
  SETTINGS: Settings,
};

const actionColors: Record<string, string> = {
  LOGIN: 'bg-success/10 text-success border-success-muted/20',
  LOGOUT: 'bg-muted text-muted-foreground border-border',
  CREATE: 'bg-info/10 text-info-muted-foreground border-info-muted/20',
  UPDATE: 'bg-warning/10 text-warning-muted-foreground border-warning-muted/20',
  DELETE: 'bg-destructive/10 text-destructive border-destructive/30/20',
  VIEW: 'bg-accent-purple/10 text-accent-purple border-accent-purple/20',
  SETTINGS: 'bg-muted text-muted-foreground border-border',
};

const entityIcons: Record<string, any> = {
  USER: User,
  COMPANY: Building2,
  MODULE: Puzzle,
  PERMISSION: Shield,
  TEMPLATE: FileText,
  SETTINGS: Settings,
};

// Datos de ejemplo - En producción vendría de la API
const mockLogs: ActivityLog[] = [
  {
    id: '1',
    action: 'LOGIN',
    entityType: 'AUTH',
    entityId: null,
    entityName: null,
    details: 'Inicio de sesión exitoso',
    userId: 1,
    userName: 'SuperAdmin',
    userEmail: 'admin@orvit.com',
    companyId: null,
    companyName: null,
    ipAddress: '192.168.1.100',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: '2',
    action: 'CREATE',
    entityType: 'COMPANY',
    entityId: '5',
    entityName: 'Empresa Demo SRL',
    details: 'Nueva empresa creada con template Industria',
    userId: 1,
    userName: 'SuperAdmin',
    userEmail: 'admin@orvit.com',
    companyId: 5,
    companyName: 'Empresa Demo SRL',
    ipAddress: '192.168.1.100',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: '3',
    action: 'UPDATE',
    entityType: 'MODULE',
    entityId: 'mod_1',
    entityName: 'Gestión de Stock',
    details: 'Módulo habilitado para Empresa ABC',
    userId: 1,
    userName: 'SuperAdmin',
    userEmail: 'admin@orvit.com',
    companyId: 2,
    companyName: 'Empresa ABC',
    ipAddress: '192.168.1.100',
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: '4',
    action: 'DELETE',
    entityType: 'USER',
    entityId: '15',
    entityName: 'Juan Pérez',
    details: 'Usuario eliminado del sistema',
    userId: 1,
    userName: 'SuperAdmin',
    userEmail: 'admin@orvit.com',
    companyId: 3,
    companyName: 'Industrial SA',
    ipAddress: '192.168.1.100',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: '5',
    action: 'SETTINGS',
    entityType: 'SETTINGS',
    entityId: null,
    entityName: 'Configuración Global',
    details: 'Actualización de configuración del sistema',
    userId: 1,
    userName: 'SuperAdmin',
    userEmail: 'admin@orvit.com',
    companyId: null,
    companyName: null,
    ipAddress: '192.168.1.100',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterEntity, setFilterEntity] = useState<string>('all');

  useEffect(() => {
    // Simular carga de datos
    setTimeout(() => {
      setLogs(mockLogs);
      setLoading(false);
    }, 500);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLogs(mockLogs);
      setLoading(false);
      toast.success('Actividad actualizada');
    }, 500);
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.userName.toLowerCase().includes(search.toLowerCase()) ||
      log.entityName?.toLowerCase().includes(search.toLowerCase()) ||
      log.details?.toLowerCase().includes(search.toLowerCase());
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesEntity = filterEntity === 'all' || log.entityType === filterEntity;
    return matchesSearch && matchesAction && matchesEntity;
  });

  const stats = {
    total: logs.length,
    today: logs.filter(l => {
      const logDate = new Date(l.createdAt);
      const today = new Date();
      return logDate.toDateString() === today.toDateString();
    }).length,
    creates: logs.filter(l => l.action === 'CREATE').length,
    updates: logs.filter(l => l.action === 'UPDATE').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Actividad del Sistema</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Registro de todas las acciones realizadas en el sistema
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-info-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Registros</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.today}</p>
                <p className="text-sm text-muted-foreground">Hoy</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-accent-purple/10 flex items-center justify-center">
                <Plus className="h-6 w-6 text-accent-purple" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.creates}</p>
                <p className="text-sm text-muted-foreground">Creaciones</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <Edit className="h-6 w-6 text-warning-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.updates}</p>
                <p className="text-sm text-muted-foreground">Actualizaciones</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por usuario, entidad o detalles..."
            className="pl-9"
          />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar acción" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las acciones</SelectItem>
            <SelectItem value="LOGIN">Inicio de sesión</SelectItem>
            <SelectItem value="LOGOUT">Cierre de sesión</SelectItem>
            <SelectItem value="CREATE">Creación</SelectItem>
            <SelectItem value="UPDATE">Actualización</SelectItem>
            <SelectItem value="DELETE">Eliminación</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar entidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las entidades</SelectItem>
            <SelectItem value="USER">Usuarios</SelectItem>
            <SelectItem value="COMPANY">Empresas</SelectItem>
            <SelectItem value="MODULE">Módulos</SelectItem>
            <SelectItem value="TEMPLATE">Templates</SelectItem>
            <SelectItem value="SETTINGS">Configuración</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Activity Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha/Hora</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Entidad</TableHead>
              <TableHead>Detalles</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.map((log) => {
              const ActionIcon = actionIcons[log.action] || Activity;
              const EntityIcon = entityIcons[log.entityType] || FileText;
              return (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    <div>
                      <p className="text-sm font-medium">
                        {format(new Date(log.createdAt), 'dd/MM/yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.createdAt), 'HH:mm:ss')}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("text-xs", actionColors[log.action])}>
                      <ActionIcon className="h-3 w-3 mr-1" />
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <EntityIcon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{log.entityType}</p>
                        {log.entityName && (
                          <p className="text-xs text-muted-foreground">{log.entityName}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-muted-foreground max-w-[300px] truncate">
                      {log.details || '-'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-3 w-3 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{log.userName}</p>
                        <p className="text-xs text-muted-foreground">{log.userEmail}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground font-mono">
                      {log.ipAddress || '-'}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredLogs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No se encontraron registros de actividad
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
