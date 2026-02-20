'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  ChevronLeft,
  Loader2,
  Calculator,
  Check,
  X,
  DollarSign,
  Eye,
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCcw,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  usePayrolls,
  usePayrollPeriods,
  useGeneratePayroll,
  useUpdatePayroll,
} from '@/hooks/use-payroll-dashboard';

interface PayrollItem {
  employeeId: string;
  employeeName: string;
  daysWorked: number;
  daysInPeriod: number;
  prorateFactor: number;
  baseSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  advancesDiscounted: number;
  netSalary: number;
  employerCost: number;
  lines: {
    code: string;
    name: string;
    type: string;
    finalAmount: number;
  }[];
}

interface PayrollDetail {
  id: number;
  period: {
    id: number;
    periodType: string;
    year: number;
    month: number;
  };
  status: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  totalEmployerCost: number;
  employeeCount: number;
  items: PayrollItem[];
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: 'Borrador', variant: 'secondary' },
  CALCULATED: { label: 'Calculada', variant: 'default' },
  APPROVED: { label: 'Aprobada', variant: 'outline' },
  PAID: { label: 'Pagada', variant: 'default' },
  CANCELLED: { label: 'Cancelada', variant: 'destructive' },
};

const periodTypeLabels: Record<string, string> = {
  QUINCENA_1: '1ra Quincena',
  QUINCENA_2: '2da Quincena',
  MONTHLY: 'Mensual',
};

const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function LiquidacionesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [year] = useState(new Date().getFullYear());
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollDetail | null>(null);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');

  const { data: payrollsData, isLoading, error, refetch, isFetching } = usePayrolls(year);
  const { data: periodsData } = usePayrollPeriods(year);

  const generatePayrollMutation = useGeneratePayroll();
  const updatePayrollMutation = useUpdatePayroll();

  const handleGeneratePayroll = async () => {
    if (!selectedPeriodId) {
      toast({ title: 'Seleccione un periodo', variant: 'destructive' });
      return;
    }

    try {
      await generatePayrollMutation.mutateAsync({ periodId: parseInt(selectedPeriodId) });
      toast({ title: 'Liquidacion generada correctamente' });
      setGenerateDialogOpen(false);
      setSelectedPeriodId('');
    } catch (error) {
      toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const viewPayrollDetail = async (payrollId: number) => {
    try {
      const res = await fetch(`/api/payroll/${payrollId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedPayroll(data.payroll);
        setDetailDialogOpen(true);
      }
    } catch (error) {
      toast({ title: 'Error al cargar detalle', variant: 'destructive' });
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await updatePayrollMutation.mutateAsync({ id, action: 'approve' });
      toast({ title: 'Liquidacion aprobada' });
      setDetailDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const handlePay = async (id: number) => {
    try {
      await updatePayrollMutation.mutateAsync({ id, action: 'pay' });
      toast({ title: 'Liquidacion marcada como pagada' });
      setDetailDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const handleCancel = async (id: number) => {
    const reason = prompt('Motivo de la cancelacion:');
    if (!reason) return;

    try {
      await updatePayrollMutation.mutateAsync({ id, action: 'cancel', cancelReason: reason });
      toast({ title: 'Liquidacion cancelada' });
      setDetailDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);

  const formatPeriodDisplay = (periodType: string, month: number, yr: number) => {
    return `${periodTypeLabels[periodType] || periodType} - ${monthNames[month - 1]} ${yr}`;
  };

  const payrolls = (payrollsData?.payrolls || []).filter(
    (p) => filter === 'all' || p.status === filter
  );
  const periods = (periodsData?.periods || []).filter((p) => !p.hasPayroll);

  // Loading
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Liquidaciones</h1>
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6">
          <Card>
            <CardContent className="py-10 text-center">
              <AlertTriangle className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">Error al cargar las liquidaciones</p>
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCcw className="w-4 h-4 mr-2" />
                Reintentar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border">
        <div className="px-4 md:px-6 py-3 flex items-start gap-4 justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/administracion/nominas')}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Liquidaciones</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Generar, aprobar y pagar nominas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className={cn(
                'inline-flex items-center border border-border rounded-md p-0.5 bg-muted/40 h-7',
                'px-2 text-[11px] font-normal gap-1.5',
                'hover:bg-muted disabled:opacity-50',
                isFetching && 'bg-background shadow-sm'
              )}
            >
              <RefreshCcw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Actualizar
            </button>
            <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8">
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Nueva Liquidacion
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generar Liquidacion</DialogTitle>
                  <DialogDescription>
                    Seleccione el periodo para generar la liquidacion
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Periodo</Label>
                    <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Seleccionar periodo" />
                      </SelectTrigger>
                      <SelectContent>
                        {periods.map((period) => (
                          <SelectItem key={period.id} value={period.id.toString()}>
                            {formatPeriodDisplay(period.periodType, period.month, period.year)} - Pago: {new Date(period.paymentDate).toLocaleDateString('es-AR')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleGeneratePayroll}
                    className="w-full h-9"
                    disabled={generatePayrollMutation.isPending}
                  >
                    {generatePayrollMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Calculator className="mr-2 h-4 w-4" />
                    )}
                    Generar y Calcular
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 pb-6 space-y-4">
        {/* Filtros */}
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="DRAFT">Borrador</SelectItem>
              <SelectItem value="CALCULATED">Calculadas</SelectItem>
              <SelectItem value="APPROVED">Aprobadas</SelectItem>
              <SelectItem value="PAID">Pagadas</SelectItem>
              <SelectItem value="CANCELLED">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista de liquidaciones */}
        {payrolls.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <FileText className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No hay liquidaciones</p>
              <p className="text-xs text-muted-foreground mt-1">
                Genere una nueva liquidacion para comenzar
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {payrolls.map((payroll) => (
              <Card key={payroll.id}>
                <CardContent className="py-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">
                          {formatPeriodDisplay(payroll.periodType, payroll.month, payroll.year)}
                        </h3>
                        <Badge variant={statusConfig[payroll.status]?.variant || 'secondary'} className="text-[10px]">
                          {statusConfig[payroll.status]?.label || payroll.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Empleados</p>
                          <p className="font-medium">{payroll.employeeCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Bruto</p>
                          <p className="font-medium">{formatCurrency(payroll.totalGross)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Deducciones</p>
                          <p className="font-medium">{formatCurrency(payroll.totalDeductions)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Neto a Pagar</p>
                          <p className="font-medium text-success">{formatCurrency(payroll.totalNet)}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Costo Empleador: {formatCurrency(payroll.totalEmployerCost)}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => viewPayrollDetail(payroll.id)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Ver
                      </Button>

                      {payroll.status === 'CALCULATED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-success border-success-muted hover:bg-success-muted"
                          onClick={() => handleApprove(payroll.id)}
                          disabled={updatePayrollMutation.isPending}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Aprobar
                        </Button>
                      )}

                      {payroll.status === 'APPROVED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-info-muted-foreground border-info-muted hover:bg-info-muted"
                          onClick={() => handlePay(payroll.id)}
                          disabled={updatePayrollMutation.isPending}
                        >
                          <DollarSign className="h-3.5 w-3.5 mr-1" />
                          Pagar
                        </Button>
                      )}

                      {!['PAID', 'CANCELLED'].includes(payroll.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => handleCancel(payroll.id)}
                          disabled={updatePayrollMutation.isPending}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog de Detalle */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detalle de Liquidacion
              {selectedPayroll && (
                <Badge variant={statusConfig[selectedPayroll.status]?.variant || 'secondary'} className="text-[10px]">
                  {statusConfig[selectedPayroll.status]?.label || selectedPayroll.status}
                </Badge>
              )}
            </DialogTitle>
            {selectedPayroll && (
              <DialogDescription>
                {formatPeriodDisplay(selectedPayroll.period.periodType, selectedPayroll.period.month, selectedPayroll.period.year)}
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedPayroll && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Empleados</p>
                  <p className="text-xl font-bold">{selectedPayroll.employeeCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Bruto</p>
                  <p className="text-xl font-bold">{formatCurrency(selectedPayroll.totalGross)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Deducciones</p>
                  <p className="text-xl font-bold text-destructive">{formatCurrency(selectedPayroll.totalDeductions)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Neto a Pagar</p>
                  <p className="text-xl font-bold text-success">{formatCurrency(selectedPayroll.totalNet)}</p>
                </div>
              </div>

              {/* Items por empleado */}
              <div>
                <h4 className="text-sm font-medium mb-2">Detalle por Empleado</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Empleado</TableHead>
                      <TableHead className="text-right">Dias</TableHead>
                      <TableHead className="text-right">Bruto</TableHead>
                      <TableHead className="text-right">Deducciones</TableHead>
                      <TableHead className="text-right">Neto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPayroll.items?.map((item) => (
                      <>
                        <TableRow
                          key={item.employeeId}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedEmployee(
                            expandedEmployee === item.employeeId ? null : item.employeeId
                          )}
                        >
                          <TableCell>
                            {expandedEmployee === item.employeeId ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{item.employeeName}</TableCell>
                          <TableCell className="text-right">
                            {item.daysWorked}/{item.daysInPeriod}
                            {item.prorateFactor < 1 && (
                              <span className="text-[10px] text-muted-foreground ml-1">
                                ({Math.round(item.prorateFactor * 100)}%)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(item.totalEarnings)}</TableCell>
                          <TableCell className="text-right text-destructive">{formatCurrency(item.totalDeductions)}</TableCell>
                          <TableCell className="text-right font-medium text-success">{formatCurrency(item.netSalary)}</TableCell>
                        </TableRow>
                        {expandedEmployee === item.employeeId && (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted/30 p-0">
                              <div className="p-4 space-y-2">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-2">Haberes</p>
                                    {item.lines
                                      .filter(l => l.type === 'EARNING')
                                      .map((line, i) => (
                                        <div key={i} className="flex justify-between text-xs py-1">
                                          <span>{line.name}</span>
                                          <span>{formatCurrency(line.finalAmount)}</span>
                                        </div>
                                      ))}
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-2">Deducciones</p>
                                    {item.lines
                                      .filter(l => l.type === 'DEDUCTION')
                                      .map((line, i) => (
                                        <div key={i} className="flex justify-between text-xs py-1">
                                          <span>{line.name}</span>
                                          <span className="text-destructive">-{formatCurrency(line.finalAmount)}</span>
                                        </div>
                                      ))}
                                    {item.advancesDiscounted > 0 && (
                                      <div className="flex justify-between text-xs py-1 border-t mt-2 pt-2">
                                        <span className="font-medium">Adelantos</span>
                                        <span className="text-destructive">-{formatCurrency(item.advancesDiscounted)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground pt-2 border-t">
                                  Costo Empleador: {formatCurrency(item.employerCost)}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Acciones */}
              <div className="flex gap-2 justify-end pt-4 border-t">
                {selectedPayroll.status === 'CALCULATED' && (
                  <Button onClick={() => handleApprove(selectedPayroll.id)} disabled={updatePayrollMutation.isPending}>
                    {updatePayrollMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Aprobar Liquidacion
                  </Button>
                )}

                {selectedPayroll.status === 'APPROVED' && (
                  <Button onClick={() => handlePay(selectedPayroll.id)} disabled={updatePayrollMutation.isPending}>
                    {updatePayrollMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
                    Marcar como Pagada
                  </Button>
                )}

                {!['PAID', 'CANCELLED'].includes(selectedPayroll.status) && (
                  <Button variant="destructive" onClick={() => handleCancel(selectedPayroll.id)} disabled={updatePayrollMutation.isPending}>
                    {updatePayrollMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
