'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
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
import { Label } from '@/components/ui/label';
import {
  AlertTriangle,
  Target,
  Shield,
  Factory,
  DollarSign,
  CheckCircle2,
  Search,
  Save,
  RefreshCw,
  ArrowUpDown,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';

interface Machine {
  id: number;
  name: string;
  type: string;
  location: string;
  status: string;
  healthScore: number | null;
  criticalityScore: number | null;
  criticalityProduction: number | null;
  criticalitySafety: number | null;
  criticalityQuality: number | null;
  criticalityCost: number | null;
  criticalityLevel: string;
  healthLevel: string;
  area?: { id: number; name: string };
  sector?: { id: number; name: string };
}

interface Summary {
  total: number;
  assessed: number;
  needsAssessment: number;
  distribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  averageScores: {
    production: number;
    safety: number;
    quality: number;
    cost: number;
  };
}

const criticalityColors: Record<string, string> = {
  CRITICAL: 'bg-destructive',
  HIGH: 'bg-warning',
  MEDIUM: 'bg-warning',
  LOW: 'bg-success',
  NOT_ASSESSED: 'bg-muted-foreground',
};

const criticalityLabels: Record<string, string> = {
  CRITICAL: 'Crítico',
  HIGH: 'Alto',
  MEDIUM: 'Medio',
  LOW: 'Bajo',
  NOT_ASSESSED: 'Sin evaluar',
};

export default function CriticalityMatrixPage() {
  const { currentCompany, currentArea } = useCompany();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'criticality' | 'health'>('criticality');
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [editScores, setEditScores] = useState({
    production: 5,
    safety: 5,
    quality: 5,
    cost: 5,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['criticality-matrix', currentCompany?.id, currentArea?.id],
    queryFn: async () => {
      const params = new URLSearchParams({
        companyId: String(currentCompany?.id),
      });
      if (currentArea?.id) params.append('areaId', String(currentArea.id));

      const res = await fetch(`/api/criticality-matrix?${params}`);
      if (!res.ok) throw new Error('Error fetching criticality matrix');
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: any[]) => {
      const res = await fetch('/api/criticality-matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) throw new Error('Error updating criticality');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Criticidad actualizada');
      queryClient.invalidateQueries({ queryKey: ['criticality-matrix'] });
      setSelectedMachine(null);
    },
    onError: () => {
      toast.error('Error al actualizar criticidad');
    },
  });

  const filteredMachines = useMemo(() => {
    if (!data?.machines) return [];

    let filtered = data.machines.filter((m: Machine) => {
      const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.location?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLevel = filterLevel === 'all' || m.criticalityLevel === filterLevel;
      return matchesSearch && matchesLevel;
    });

    // Sort
    filtered.sort((a: Machine, b: Machine) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'criticality') return (b.criticalityScore || 0) - (a.criticalityScore || 0);
      if (sortBy === 'health') return (b.healthScore || 0) - (a.healthScore || 0);
      return 0;
    });

    return filtered;
  }, [data?.machines, searchTerm, filterLevel, sortBy]);

  const handleEditMachine = (machine: Machine) => {
    setSelectedMachine(machine);
    setEditScores({
      production: machine.criticalityProduction || 5,
      safety: machine.criticalitySafety || 5,
      quality: machine.criticalityQuality || 5,
      cost: machine.criticalityCost || 5,
    });
  };

  const handleSave = () => {
    if (!selectedMachine) return;

    updateMutation.mutate([
      {
        machineId: selectedMachine.id,
        ...editScores,
      },
    ]);
  };

  const calculateTotalScore = () => {
    const weights = { production: 0.3, safety: 0.35, quality: 0.2, cost: 0.15 };
    return Math.round(
      editScores.production * weights.production * 10 +
      editScores.safety * weights.safety * 10 +
      editScores.quality * weights.quality * 10 +
      editScores.cost * weights.cost * 10
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const summary: Summary = data?.summary || {
    total: 0,
    assessed: 0,
    needsAssessment: 0,
    distribution: { critical: 0, high: 0, medium: 0, low: 0 },
    averageScores: { production: 0, safety: 0, quality: 0, cost: 0 },
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6" />
            Matriz de Criticidad
          </h1>
          <p className="text-muted-foreground">
            Evalúa y prioriza tus activos según su impacto en producción, seguridad, calidad y costo
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.distribution.critical}</p>
                <p className="text-xs text-muted-foreground">Críticos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-warning-muted">
                <Target className="h-5 w-5 text-warning-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.distribution.high}</p>
                <p className="text-xs text-muted-foreground">Alta prioridad</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-success-muted">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.assessed}</p>
                <p className="text-xs text-muted-foreground">Evaluados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-muted">
                <Activity className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.needsAssessment}</p>
                <p className="text-xs text-muted-foreground">Sin evaluar</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Average Scores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Promedios por Categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Factory className="h-4 w-4 text-info-muted-foreground" />
                <span className="text-sm font-medium">Producción</span>
              </div>
              <Progress value={summary.averageScores.production * 10} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {summary.averageScores.production}/10
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium">Seguridad</span>
              </div>
              <Progress value={summary.averageScores.safety * 10} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {summary.averageScores.safety}/10
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">Calidad</span>
              </div>
              <Progress value={summary.averageScores.quality * 10} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {summary.averageScores.quality}/10
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-warning-muted-foreground" />
                <span className="text-sm font-medium">Costo</span>
              </div>
              <Progress value={summary.averageScores.cost * 10} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {summary.averageScores.cost}/10
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar máquina..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Nivel de criticidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los niveles</SelectItem>
            <SelectItem value="CRITICAL">Crítico</SelectItem>
            <SelectItem value="HIGH">Alto</SelectItem>
            <SelectItem value="MEDIUM">Medio</SelectItem>
            <SelectItem value="LOW">Bajo</SelectItem>
            <SelectItem value="NOT_ASSESSED">Sin evaluar</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-[180px]">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="criticality">Mayor criticidad</SelectItem>
            <SelectItem value="health">Mayor salud</SelectItem>
            <SelectItem value="name">Nombre A-Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Machines Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Máquina</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead className="text-center">Criticidad</TableHead>
              <TableHead className="text-center">Salud</TableHead>
              <TableHead className="text-center">Producción</TableHead>
              <TableHead className="text-center">Seguridad</TableHead>
              <TableHead className="text-center">Calidad</TableHead>
              <TableHead className="text-center">Costo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMachines.map((machine: Machine) => (
              <TableRow key={machine.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{machine.name}</p>
                    <p className="text-xs text-muted-foreground">{machine.type}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{machine.location || '-'}</span>
                </TableCell>
                <TableCell className="text-center">
                  <Badge className={criticalityColors[machine.criticalityLevel]}>
                    {machine.criticalityScore || '-'}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {machine.healthScore !== null ? (
                    <span className="text-sm">{machine.healthScore}%</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-sm">{machine.criticalityProduction || '-'}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-sm">{machine.criticalitySafety || '-'}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-sm">{machine.criticalityQuality || '-'}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-sm">{machine.criticalityCost || '-'}</span>
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditMachine(machine)}
                  >
                    Evaluar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filteredMachines.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No se encontraron máquinas
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!selectedMachine} onOpenChange={() => setSelectedMachine(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Evaluar Criticidad</DialogTitle>
          </DialogHeader>

          {selectedMachine && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="font-medium">{selectedMachine.name}</p>
                <p className="text-sm text-muted-foreground">{selectedMachine.location}</p>
              </div>

              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Score Total</p>
                <p className="text-4xl font-bold">{calculateTotalScore()}</p>
                <Badge className={criticalityColors[calculateTotalScore() >= 80 ? 'CRITICAL' : calculateTotalScore() >= 60 ? 'HIGH' : calculateTotalScore() >= 40 ? 'MEDIUM' : 'LOW']}>
                  {criticalityLabels[calculateTotalScore() >= 80 ? 'CRITICAL' : calculateTotalScore() >= 60 ? 'HIGH' : calculateTotalScore() >= 40 ? 'MEDIUM' : 'LOW']}
                </Badge>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-2">
                      <Factory className="h-4 w-4" />
                      Impacto en Producción
                    </Label>
                    <span className="font-medium">{editScores.production}</span>
                  </div>
                  <Slider
                    value={[editScores.production]}
                    onValueChange={([v]) => setEditScores({ ...editScores, production: v })}
                    min={1}
                    max={10}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    30% del peso total
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Impacto en Seguridad
                    </Label>
                    <span className="font-medium">{editScores.safety}</span>
                  </div>
                  <Slider
                    value={[editScores.safety]}
                    onValueChange={([v]) => setEditScores({ ...editScores, safety: v })}
                    min={1}
                    max={10}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    35% del peso total
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Impacto en Calidad
                    </Label>
                    <span className="font-medium">{editScores.quality}</span>
                  </div>
                  <Slider
                    value={[editScores.quality]}
                    onValueChange={([v]) => setEditScores({ ...editScores, quality: v })}
                    min={1}
                    max={10}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    20% del peso total
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Impacto en Costo
                    </Label>
                    <span className="font-medium">{editScores.cost}</span>
                  </div>
                  <Slider
                    value={[editScores.cost]}
                    onValueChange={([v]) => setEditScores({ ...editScores, cost: v })}
                    min={1}
                    max={10}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    15% del peso total
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMachine(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
