'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { usePanolPermissions } from '@/hooks/use-panol-permissions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  HandMetal, Search, Loader2, MoreHorizontal, RotateCcw,
  Clock, CheckCircle2, AlertTriangle, User, Package, RefreshCw, Wrench,
} from 'lucide-react';
import { formatDistanceToNow, isPast, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/date-utils';

interface Loan {
  id: number;
  toolId: number;
  userId: number | null;
  workerId: number | null;
  quantity: number;
  status: 'BORROWED' | 'RETURNED' | 'OVERDUE';
  borrowedAt: string;
  returnedAt: string | null;
  dueDate: string | null;
  notes: string | null;
  tool: {
    id: number;
    name: string;
    itemType: string;
    category: string | null;
    serialNumber: string | null;
  };
  user?: { id: number; name: string; email: string } | null;
  worker?: { id: number; name: string; phone: string | null; specialty: string | null } | null;
}

async function fetchLoans(companyId: number, status: string): Promise<Loan[]> {
  const params = new URLSearchParams({ companyId: String(companyId) });
  if (status !== 'all') params.set('status', status);
  const res = await fetch(`/api/tools/loans?${params.toString()}`);
  if (!res.ok) throw new Error('Error al cargar préstamos');
  const data = await res.json();
  return data.loans || data.data || data || [];
}

async function returnLoan(loanId: number, body: { returnNotes?: string; condition?: string }) {
  const res = await fetch(`/api/tools/loans/${loanId}/return`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al devolver');
  }
  return res.json();
}

function getBorrowerName(loan: Loan): string {
  if (loan.user) return loan.user.name;
  if (loan.worker) return loan.worker.name;
  return 'Desconocido';
}

function getDueBadge(loan: Loan) {
  if (!loan.dueDate || loan.status === 'RETURNED') return null;
  const due = new Date(loan.dueDate);
  if (isPast(due)) {
    const days = differenceInDays(new Date(), due);
    return (
      <Badge variant="destructive" className="text-xs">
        Vencido hace {days}d
      </Badge>
    );
  }
  const days = differenceInDays(due, new Date());
  if (days <= 2) {
    return (
      <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        Vence en {days}d
      </Badge>
    );
  }
  return null;
}

export default function PrestamosPage() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const { canManageLoans } = usePanolPermissions();
  const [statusFilter, setStatusFilter] = useState('BORROWED');
  const [searchTerm, setSearchTerm] = useState('');
  const [returnDialog, setReturnDialog] = useState<Loan | null>(null);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnCondition, setReturnCondition] = useState<string>('OK');

  const { data: loans = [], isLoading, refetch } = useQuery({
    queryKey: ['tool-loans', currentCompany?.id, statusFilter],
    queryFn: () => fetchLoans(currentCompany!.id, statusFilter),
    enabled: !!currentCompany?.id,
    staleTime: 1000 * 60 * 2,
  });

  const returnMutation = useMutation({
    mutationFn: ({ loanId, body }: { loanId: number; body: { returnNotes?: string; condition?: string } }) =>
      returnLoan(loanId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-loans', currentCompany?.id] });
      setReturnDialog(null);
      setReturnNotes('');
      setReturnCondition('OK');
      toast.success('Herramienta devuelta correctamente');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleReturn = () => {
    if (!canManageLoans) {
      toast.error('No tienes permisos para gestionar préstamos');
      return;
    }
    if (!returnDialog) return;
    returnMutation.mutate({
      loanId: returnDialog.id,
      body: {
        returnNotes: returnNotes || undefined,
        condition: returnCondition !== 'OK' ? returnCondition : undefined,
      },
    });
  };

  const filtered = loans.filter((loan) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      loan.tool.name.toLowerCase().includes(term) ||
      getBorrowerName(loan).toLowerCase().includes(term) ||
      (loan.tool.serialNumber || '').toLowerCase().includes(term) ||
      (loan.tool.category || '').toLowerCase().includes(term)
    );
  });

  const stats = {
    borrowed: loans.filter((l) => l.status === 'BORROWED').length,
    overdue: loans.filter((l) => {
      if (l.status !== 'BORROWED' || !l.dueDate) return false;
      return isPast(new Date(l.dueDate));
    }).length,
    returned: statusFilter === 'RETURNED' ? loans.length : 0,
    total: loans.length,
  };

  return (
    <TooltipProvider>
      <div className="w-full p-0">
        {/* Header */}
        <div className="px-4 md:px-6 pt-4 pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Préstamos</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Control de herramientas prestadas a técnicos
              </p>
            </div>
            <Button variant="outline" size="sm" className="h-9" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
          </div>
        </div>

        <div className="space-y-4 px-4 md:px-6 pb-6">
          {/* KPIs — mobile: 2 cards, desktop: 3 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Prestados</p>
                    <p className="text-2xl font-bold mt-1">{stats.borrowed}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <HandMetal className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={stats.overdue > 0 ? 'border-destructive/50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Vencidos</p>
                    <p className={cn('text-2xl font-bold mt-1', stats.overdue > 0 && 'text-destructive')}>{stats.overdue}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hidden sm:block">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold mt-1">{stats.total}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar herramienta o persona..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9 bg-background"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 h-9 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BORROWED">Prestados</SelectItem>
                <SelectItem value="RETURNED">Devueltos</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Loading */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            /* Empty state */
            <Card className="flex items-center justify-center min-h-[250px]">
              <div className="text-center py-12">
                <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <HandMetal className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No hay préstamos</h3>
                <p className="text-sm text-muted-foreground">
                  {statusFilter === 'BORROWED' ? 'No hay herramientas prestadas actualmente' : 'No hay registros para mostrar'}
                </p>
              </div>
            </Card>
          ) : (
            <>
              {/* MOBILE: Cards view */}
              <div className="sm:hidden space-y-3">
                {filtered.map((loan) => (
                  <Card key={loan.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{loan.tool.name}</p>
                          <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                            <User className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{getBorrowerName(loan)}</span>
                          </div>
                          {loan.tool.serialNumber && (
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{loan.tool.serialNumber}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <Badge variant={loan.status === 'RETURNED' ? 'outline' : 'default'} className="text-xs">
                            {loan.quantity} ud.
                          </Badge>
                          {getDueBadge(loan)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(loan.borrowedAt), { addSuffix: true, locale: es })}
                        </span>
                        {loan.status === 'BORROWED' && canManageLoans && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => setReturnDialog(loan)}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                            Devolver
                          </Button>
                        )}
                        {loan.status === 'RETURNED' && (
                          <Badge variant="outline" className="text-xs text-success">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Devuelto
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* DESKTOP: Table view */}
              <div className="hidden sm:block rounded-lg border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-medium">Herramienta</TableHead>
                      <TableHead className="text-xs font-medium">Persona</TableHead>
                      <TableHead className="text-xs font-medium text-center">Cant.</TableHead>
                      <TableHead className="text-xs font-medium">Prestado</TableHead>
                      <TableHead className="text-xs font-medium">Vencimiento</TableHead>
                      <TableHead className="text-xs font-medium">Estado</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((loan) => {
                      const isOverdue = loan.status === 'BORROWED' && loan.dueDate && isPast(new Date(loan.dueDate));
                      return (
                        <TableRow key={loan.id} className={cn(isOverdue && 'bg-destructive/5')}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{loan.tool.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {loan.tool.serialNumber && (
                                  <span className="text-xs text-muted-foreground font-mono">{loan.tool.serialNumber}</span>
                                )}
                                {loan.tool.category && (
                                  <Badge variant="outline" className="text-xs">{loan.tool.category}</Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{getBorrowerName(loan)}</p>
                                {loan.worker?.specialty && (
                                  <p className="text-xs text-muted-foreground">{loan.worker.specialty}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-medium">{loan.quantity}</TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm text-muted-foreground cursor-default">
                                  {formatDistanceToNow(new Date(loan.borrowedAt), { addSuffix: true, locale: es })}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{formatDateTime(loan.borrowedAt)}</TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            {loan.dueDate ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{formatDateTime(loan.dueDate)}</span>
                                {getDueBadge(loan)}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Sin fecha</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {loan.status === 'BORROWED' && (
                              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                <Clock className="h-3 w-3 mr-1" />
                                Prestado
                              </Badge>
                            )}
                            {loan.status === 'RETURNED' && (
                              <Badge variant="outline" className="text-success">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Devuelto
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {loan.status === 'BORROWED' && canManageLoans && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setReturnDialog(loan)}>
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Devolver
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        {/* Return Dialog */}
        <Dialog open={!!returnDialog} onOpenChange={() => { setReturnDialog(null); setReturnNotes(''); setReturnCondition('OK'); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Devolver Herramienta</DialogTitle>
              <DialogDescription>
                Devolver <strong>{returnDialog?.quantity}</strong> ud. de <strong>{returnDialog?.tool.name}</strong>
                {' '}prestada a <strong>{returnDialog ? getBorrowerName(returnDialog) : ''}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label className="text-xs">Estado de la herramienta</Label>
                <Select value={returnCondition} onValueChange={setReturnCondition}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OK">Buen estado</SelectItem>
                    <SelectItem value="DAMAGED">Dañada</SelectItem>
                    <SelectItem value="MAINTENANCE">Requiere mantenimiento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Notas (opcional)</Label>
                <Textarea
                  placeholder="Observaciones sobre la devolución..."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </div>

              {returnCondition === 'DAMAGED' && (
                <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="text-sm text-destructive font-medium">
                    La herramienta se marcará como dañada y no estará disponible hasta su reparación.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setReturnDialog(null); setReturnNotes(''); setReturnCondition('OK'); }}>
                Cancelar
              </Button>
              <Button onClick={handleReturn} disabled={returnMutation.isPending}>
                {returnMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Procesando...</>
                ) : (
                  <><RotateCcw className="h-4 w-4 mr-2" />Devolver</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
