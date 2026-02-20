'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, TrendingUp, TrendingDown, Filter, Plus, Calendar, DollarSign, User, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SalaryHistoryEntry {
  id: string;
  oldSalary: number;
  newSalary: number;
  changeDate: string;
  changeReason: string;
  companyId: number;
}

interface HistorialIndividualProps {
  employeeId: string;
  employeeName: string;
  currentSalary: number;
  companyId: string;
  onSalaryChange: () => void;
}

export function HistorialIndividual({ 
  employeeId, 
  employeeName, 
  currentSalary, 
  companyId, 
  onSalaryChange 
}: HistorialIndividualProps) {
  const queryClient = useQueryClient();
  const queryKey = ['costos-historial-individual', employeeId, companyId];

  const { data: historial = [], isLoading: loading, error: queryError } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/costos/empleados/${employeeId}/historial?companyId=${companyId}`);
      if (!res.ok) throw new Error('Error al obtener el historial');
      return res.json() as Promise<SalaryHistoryEntry[]>;
    },
    staleTime: 2 * 60 * 1000,
  });

  const error = queryError?.message ?? null;

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntry, setNewEntry] = useState({
    oldSalary: currentSalary,
    newSalary: currentSalary,
    changeReason: ''
  });

  // Filtrado client-side (useMemo en vez de useState + useEffect)
  const filteredHistorial = useMemo(() => {
    let filtered = historial;

    if (searchTerm) {
      filtered = filtered.filter(entry =>
        entry.changeReason.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (dateFilter) {
        case 'today':
          filtered = filtered.filter(entry => new Date(entry.changeDate) >= today);
          break;
        case 'week': {
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter(entry => new Date(entry.changeDate) >= weekAgo);
          break;
        }
        case 'month': {
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter(entry => new Date(entry.changeDate) >= monthAgo);
          break;
        }
      }
    }

    return filtered;
  }, [historial, searchTerm, dateFilter]);

  // Agregar nueva entrada
  const handleAddEntry = async () => {
    if (newEntry.newSalary === newEntry.oldSalary) {
      toast.warning('El nuevo salario debe ser diferente al anterior');
      return;
    }

    try {
      const response = await fetch(`/api/costos/empleados/${employeeId}/historial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldSalary: newEntry.oldSalary,
          newSalary: newEntry.newSalary,
          changeReason: newEntry.changeReason || 'Cambio manual',
          companyId: parseInt(companyId)
        })
      });

      if (!response.ok) {
        throw new Error('Error al crear entrada en historial');
      }

      // Invalidar cache y notificar cambio
      queryClient.invalidateQueries({ queryKey });
      onSalaryChange();
      
      // Resetear formulario
      setNewEntry({
        oldSalary: currentSalary,
        newSalary: currentSalary,
        changeReason: ''
      });
      setShowAddModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculatePercentage = (oldSalary: number, newSalary: number) => {
    const change = ((newSalary - oldSalary) / oldSalary) * 100;
    return change.toFixed(1);
  };

  // Calcular estadísticas
  const getStats = () => {
    if (filteredHistorial.length === 0) return null;

    const totalChanges = filteredHistorial.length;
    const totalIncrease = filteredHistorial.reduce((sum, entry) => {
      const increase = entry.newSalary - entry.oldSalary;
      return sum + (increase > 0 ? increase : 0);
    }, 0);
    const totalDecrease = filteredHistorial.reduce((sum, entry) => {
      const decrease = entry.oldSalary - entry.newSalary;
      return sum + (decrease > 0 ? decrease : 0);
    }, 0);

    return {
      totalChanges,
      totalIncrease,
      totalDecrease,
      averageIncrease: totalIncrease / totalChanges,
      averageDecrease: totalDecrease / totalChanges,
    };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-destructive">
        <p>Error: {error}</p>
        <Button onClick={fetchHistorial} className="mt-2">Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <User className="h-5 w-5" />
            Historial de Sueldos
          </h3>
          <p className="text-muted-foreground mt-1">
            Registro de cambios salariales para {employeeName}
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="bg-foreground hover:bg-foreground/90 text-background">
          <Plus className="h-4 w-4 mr-2" />
          Agregar Cambio
        </Button>
      </div>

      {/* Filtros y Estadísticas */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filtro de búsqueda */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Search className="h-4 w-4" />
              Buscar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Buscar por motivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Filtro por fecha */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el historial</SelectItem>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="week">Última semana</SelectItem>
                <SelectItem value="month">Último mes</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Estadísticas */}
        {stats && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  Aumentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-success">
                  {formatCurrency(stats.totalIncrease)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Promedio: {formatCurrency(stats.averageIncrease)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  Disminuciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-destructive">
                  {formatCurrency(stats.totalDecrease)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Promedio: {formatCurrency(stats.averageDecrease)}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Lista del historial */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Cambios Salariales ({filteredHistorial.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredHistorial.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p>No hay cambios salariales registrados</p>
              {searchTerm || dateFilter !== 'all' ? (
                <p className="text-sm">Intenta cambiar los filtros o agregar un cambio</p>
              ) : (
                <p className="text-sm">Agrega el primer cambio salarial para comenzar</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHistorial.map((entry) => {
                const isIncrease = entry.newSalary > entry.oldSalary;
                const percentage = calculatePercentage(entry.oldSalary, entry.newSalary);
                
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-4 p-4 bg-muted rounded-lg hover:bg-accent transition-colors"
                  >
                    {/* Icono */}
                    <div className={cn('p-3 rounded-full',
                      isIncrease ? 'bg-success-muted text-success' : 'bg-destructive/10 text-destructive'
                    )}>
                      {isIncrease ? (
                        <TrendingUp className="h-5 w-5" />
                      ) : (
                        <TrendingDown className="h-5 w-5" />
                      )}
                    </div>

                    {/* Información del cambio */}
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <div className="text-lg font-semibold">
                          {formatCurrency(entry.oldSalary)} → {formatCurrency(entry.newSalary)}
                        </div>
                        <Badge variant={isIncrease ? 'default' : 'destructive'}>
                          {isIncrease ? '+' : ''}{percentage}%
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(entry.changeDate)}
                          </div>
                          {entry.changeReason && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {entry.changeReason}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal para agregar cambio */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Agregar Cambio Salarial</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Salario Anterior
                </label>
                <Input
                  type="number"
                  value={newEntry.oldSalary}
                  onChange={(e) => setNewEntry({...newEntry, oldSalary: parseFloat(e.target.value) || 0})}
                  placeholder="0"
                  step="1000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Nuevo Salario
                </label>
                <Input
                  type="number"
                  value={newEntry.newSalary}
                  onChange={(e) => setNewEntry({...newEntry, newSalary: parseFloat(e.target.value) || 0})}
                  placeholder="0"
                  step="1000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Motivo del Cambio
                </label>
                <Input
                  value={newEntry.changeReason}
                  onChange={(e) => setNewEntry({...newEntry, changeReason: e.target.value})}
                  placeholder="Ej: Aumento por desempeño, Promoción, etc."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddEntry}>
                Agregar Cambio
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
