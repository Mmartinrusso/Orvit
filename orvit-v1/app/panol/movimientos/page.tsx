'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Calendar,
  User,
  Package,
  Download,
  X,
  ArrowLeftRight,
  Wrench,
  RotateCcw,
  Box,
  Cog,
  History,
  Loader2,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import MovementDialog from '@/components/panol/MovementDialog';
import { toast } from 'sonner';
import { useCompany } from '@/contexts/CompanyContext';
import { cn } from '@/lib/utils';

interface Movement {
  id: number;
  type: 'IN' | 'OUT' | 'TRANSFER' | 'MAINTENANCE' | 'RETURN';
  quantity: number;
  reason: string;
  description: string | null;
  createdAt: string;
  userId: number;
  tool: {
    id: number;
    name: string;
    itemType: string;
  };
  user?: {
    id: number;
    name: string;
  };
}

const MOVEMENT_TYPES = {
  IN: { label: 'Entrada', icon: ArrowUpCircle, color: 'text-success' },
  OUT: { label: 'Salida', icon: ArrowDownCircle, color: 'text-destructive' },
  TRANSFER: { label: 'Transferencia', icon: ArrowLeftRight, color: 'text-info-muted-foreground' },
  MAINTENANCE: { label: 'Mantenimiento', icon: Wrench, color: 'text-warning-muted-foreground' },
  RETURN: { label: 'Devolución', icon: RotateCcw, color: 'text-purple-600' },
};

const ITEM_TYPE_ICONS: Record<string, React.ElementType> = {
  TOOL: Wrench,
  SUPPLY: Box,
  SPARE_PART: Cog,
  HAND_TOOL: Wrench,
};

export default function MovimientosPage() {
  const { currentCompany } = useCompany();

  const [movements, setMovements] = useState<Movement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [limit, setLimit] = useState(50);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);

  const loadMovements = useCallback(async (showRefresh = false) => {
    if (!currentCompany?.id) return;

    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await fetch(
        `/api/tools/movements?companyId=${currentCompany.id}&limit=${limit}`
      );

      if (!response.ok) throw new Error('Error al cargar movimientos');

      const data = await response.json();
      const movementsArray = Array.isArray(data) ? data : (data?.movements || data?.items || []);
      setMovements(movementsArray);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar movimientos');
      setMovements([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentCompany?.id, limit]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const filteredMovements = useMemo(() => {
    return movements.filter((movement) => {
      const matchesSearch =
        movement.tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (movement.description || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = selectedType === 'all' || movement.type === selectedType;

      return matchesSearch && matchesType;
    });
  }, [movements, searchTerm, selectedType]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayMovements = movements.filter(
      (m) => new Date(m.createdAt) >= today
    );

    return {
      total: movements.length,
      today: todayMovements.length,
      entries: movements.filter((m) => m.type === 'IN' || m.type === 'RETURN').length,
      exits: movements.filter((m) => m.type === 'OUT').length,
    };
  }, [movements]);

  const handleExportCSV = () => {
    if (filteredMovements.length === 0) {
      toast.error('No hay movimientos para exportar');
      return;
    }

    const headers = ['Fecha', 'Tipo', 'Item', 'Cantidad', 'Razón', 'Usuario'];
    const rows = filteredMovements.map((m) => [
      format(new Date(m.createdAt), 'dd/MM/yyyy HH:mm'),
      MOVEMENT_TYPES[m.type]?.label || m.type,
      m.tool.name,
      m.type === 'OUT' ? `-${m.quantity}` : `+${m.quantity}`,
      m.reason,
      m.user?.name || '-',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `movimientos_panol_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();

    toast.success('Archivo CSV descargado');
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedType('all');
  };

  const hasFilters = searchTerm || selectedType !== 'all';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
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
              <h1 className="text-xl font-semibold text-foreground">Movimientos</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Historial de entradas, salidas y transferencias
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => loadMovements(true)}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Actualizar</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9" onClick={handleExportCSV}>
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Exportar CSV</TooltipContent>
              </Tooltip>
              <Button size="sm" className="h-9" onClick={() => setMovementDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4 px-4 md:px-6 pb-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total Registros</p>
                    <p className="text-2xl font-bold mt-1">{stats.total}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <History className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Hoy</p>
                    <p className="text-2xl font-bold mt-1">{stats.today}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Entradas</p>
                    <p className="text-2xl font-bold mt-1 text-success">{stats.entries}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Salidas</p>
                    <p className="text-2xl font-bold mt-1 text-destructive">{stats.exits}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por item, razón..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 bg-background"
              />
            </div>

            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full sm:w-40 h-9 bg-background">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="IN">Entradas</SelectItem>
                <SelectItem value="OUT">Salidas</SelectItem>
                <SelectItem value="TRANSFER">Transferencias</SelectItem>
                <SelectItem value="MAINTENANCE">Mantenimiento</SelectItem>
                <SelectItem value="RETURN">Devoluciones</SelectItem>
              </SelectContent>
            </Select>

            <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
              <SelectTrigger className="w-full sm:w-32 h-9 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
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

            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground px-2">
              <span className="font-medium text-foreground">{filteredMovements.length}</span>
              <span>de {movements.length}</span>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border bg-card overflow-hidden">
            {filteredMovements.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mx-auto mb-4">
                  <Package className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No hay movimientos</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {movements.length === 0 ? 'No hay movimientos registrados aún' : 'Prueba ajustando los filtros'}
                </p>
                {movements.length === 0 && (
                  <Button size="sm" onClick={() => setMovementDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Registrar primer movimiento
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs font-medium">Fecha</TableHead>
                    <TableHead className="text-xs font-medium">Tipo</TableHead>
                    <TableHead className="text-xs font-medium">Item</TableHead>
                    <TableHead className="text-xs font-medium text-center">Cantidad</TableHead>
                    <TableHead className="text-xs font-medium">Razón</TableHead>
                    <TableHead className="text-xs font-medium">Usuario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.map((movement) => {
                    const typeConfig = MOVEMENT_TYPES[movement.type] || MOVEMENT_TYPES.IN;
                    const TypeIcon = typeConfig.icon;
                    const ItemIcon = ITEM_TYPE_ICONS[movement.tool.itemType] || Package;

                    return (
                      <TableRow key={movement.id} className="hover:bg-muted/20">
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm text-muted-foreground cursor-default">
                                {formatDistanceToNow(new Date(movement.createdAt), {
                                  addSuffix: true,
                                  locale: es,
                                })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {format(new Date(movement.createdAt), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TypeIcon className={cn('h-4 w-4', typeConfig.color)} />
                            <Badge variant="secondary" className="text-xs font-normal">
                              {typeConfig.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded bg-muted flex items-center justify-center">
                              <ItemIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <span className="text-sm font-medium">{movement.tool.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn(
                            'text-sm font-bold',
                            movement.type === 'OUT' ? 'text-destructive' : 'text-success'
                          )}>
                            {movement.type === 'OUT' ? '-' : '+'}{movement.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {movement.reason}
                        </TableCell>
                        <TableCell>
                          {movement.user ? (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <User className="h-3.5 w-3.5" />
                              {movement.user.name}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {filteredMovements.length >= limit && (
            <div className="text-center">
              <Button variant="outline" size="sm" onClick={() => setLimit((prev) => prev + 50)}>
                Cargar más
              </Button>
            </div>
          )}
        </div>

        {/* Movement Dialog */}
        <MovementDialog
          isOpen={movementDialogOpen}
          onClose={() => setMovementDialogOpen(false)}
          onSave={() => {
            toast.success('Movimiento registrado exitosamente');
            loadMovements(true);
          }}
        />
      </div>
    </TooltipProvider>
  );
}
