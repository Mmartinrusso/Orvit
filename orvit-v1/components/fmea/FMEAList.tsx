'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Search,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  TrendingDown,
  AlertCircle,
} from 'lucide-react';
import { RPNBadge, getRPNLevel } from './RPNBadge';
import { FMEAForm } from './FMEAForm';
import { toast } from 'sonner';

interface FailureMode {
  id: number;
  failureMode: string;
  failureEffect?: string;
  failureCause?: string;
  severity: number;
  occurrence: number;
  detectability: number;
  rpn: number;
  currentControls?: string;
  recommendedActions?: string;
  component?: { id: number; name: string };
  machine?: { id: number; name: string };
}

interface FMEAListProps {
  companyId: number;
  machines: Array<{ id: number; name: string; components?: Array<{ id: number; name: string }> }>;
}

export function FMEAList({ companyId, machines }: FMEAListProps) {
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [machineFilter, setMachineFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FailureMode | null>(null);
  const [deletingItem, setDeletingItem] = useState<FailureMode | null>(null);

  const queryClient = useQueryClient();

  // Fetch FMEA data
  const { data, isLoading } = useQuery({
    queryKey: ['fmea', companyId, machineFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (machineFilter !== 'all') params.append('machineId', machineFilter);

      const res = await fetch(`/api/fmea?${params}`);
      if (!res.ok) throw new Error('Error fetching FMEA');
      return res.json();
    },
  });

  const failureModes: FailureMode[] = data?.failureModes || [];
  const summary = data?.summary;

  // Filter by search and risk level
  const filteredModes = failureModes.filter((fm) => {
    const matchesSearch = !search ||
      fm.failureMode.toLowerCase().includes(search.toLowerCase()) ||
      fm.machine?.name.toLowerCase().includes(search.toLowerCase()) ||
      fm.component?.name.toLowerCase().includes(search.toLowerCase());

    const { level } = getRPNLevel(fm.rpn);
    const matchesRisk = riskFilter === 'all' || level === riskFilter;

    return matchesSearch && matchesRisk;
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (formData: Record<string, unknown>) => {
      const res = await fetch('/api/fmea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, companyId }),
      });
      if (!res.ok) throw new Error('Error al crear análisis');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Análisis FMEA creado');
      queryClient.invalidateQueries({ queryKey: ['fmea', companyId] });
      setIsFormOpen(false);
    },
    onError: () => toast.error('Error al crear análisis'),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (formData: Record<string, unknown>) => {
      const res = await fetch(`/api/fmea/${editingItem?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Análisis actualizado');
      queryClient.invalidateQueries({ queryKey: ['fmea', companyId] });
      setEditingItem(null);
    },
    onError: () => toast.error('Error al actualizar'),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/fmea/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Análisis eliminado');
      queryClient.invalidateQueries({ queryKey: ['fmea', companyId] });
      setDeletingItem(null);
    },
    onError: () => toast.error('Error al eliminar'),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Análisis FMEA
              </CardTitle>
              <CardDescription>
                Análisis de Modos de Falla y sus Efectos
              </CardDescription>
            </div>
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Análisis
            </Button>
          </div>

          {/* Summary */}
          {summary && (
            <div className="grid grid-cols-4 gap-2 mt-4">
              <div className="p-3 rounded-lg bg-gray-50 text-center">
                <p className="text-2xl font-bold">{summary.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 text-center">
                <p className="text-2xl font-bold text-red-600">{summary.highRisk}</p>
                <p className="text-xs text-muted-foreground">Alto Riesgo</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 text-center">
                <p className="text-2xl font-bold text-amber-600">{summary.mediumRisk}</p>
                <p className="text-xs text-muted-foreground">Riesgo Medio</p>
              </div>
              <div className="p-3 rounded-lg bg-green-50 text-center">
                <p className="text-2xl font-bold text-green-600">{summary.lowRisk}</p>
                <p className="text-xs text-muted-foreground">Bajo Riesgo</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-4 mt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={machineFilter} onValueChange={setMachineFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Máquina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las máquinas</SelectItem>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id.toString()}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Nivel de riesgo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="high">Alto Riesgo</SelectItem>
                <SelectItem value="medium">Riesgo Medio</SelectItem>
                <SelectItem value="low">Bajo Riesgo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {filteredModes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay análisis FMEA registrados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modo de Falla</TableHead>
                  <TableHead>Máquina/Componente</TableHead>
                  <TableHead className="text-center">S</TableHead>
                  <TableHead className="text-center">O</TableHead>
                  <TableHead className="text-center">D</TableHead>
                  <TableHead className="text-center">RPN</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModes.map((fm) => (
                  <TableRow key={fm.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{fm.failureMode}</p>
                        {fm.failureEffect && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            Efecto: {fm.failureEffect}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {fm.machine?.name || '-'}
                      {fm.component && (
                        <span className="text-xs text-muted-foreground">
                          {' / '}{fm.component.name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-mono">{fm.severity}</TableCell>
                    <TableCell className="text-center font-mono">{fm.occurrence}</TableCell>
                    <TableCell className="text-center font-mono">{fm.detectability}</TableCell>
                    <TableCell className="text-center">
                      <RPNBadge rpn={fm.rpn} showIcon={false} size="sm" />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingItem(fm)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingItem(fm)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isFormOpen || !!editingItem}
        onOpenChange={(open) => {
          if (!open) {
            setIsFormOpen(false);
            setEditingItem(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar Análisis FMEA' : 'Nuevo Análisis FMEA'}
            </DialogTitle>
          </DialogHeader>
          <FMEAForm
            machines={machines}
            initialData={editingItem || undefined}
            onSubmit={async (data) => {
              if (editingItem) {
                await updateMutation.mutateAsync(data);
              } else {
                await createMutation.mutateAsync(data);
              }
            }}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingItem(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Análisis FMEA</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de eliminar el análisis &quot;{deletingItem?.failureMode}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingItem && deleteMutation.mutate(deletingItem.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default FMEAList;
