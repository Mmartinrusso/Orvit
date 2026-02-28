'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Link2,
  Lock,
  RefreshCcw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBankReconciliation } from '@/hooks/use-bank-reconciliation';
import ReconciliationSummary from '@/components/conciliacion/ReconciliationSummary';
import BankReconciliation from '@/components/conciliacion/BankReconciliation';
import MatchingSuggestions from '@/components/conciliacion/MatchingSuggestions';
import CSVImportDialog from '@/components/conciliacion/CSVImportDialog';
import { generateBankReconciliationPDF } from '@/lib/pdf/bank-reconciliation-pdf';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ConciliacionPage() {
  const { mode: viewMode } = useViewMode();
  const { currentCompany } = useCompany();
  const { hasPermission } = useAuth();
  const canReconcile = hasPermission('treasury.reconcile');
  const companyId = currentCompany?.id || 0;

  const reconciliation = useBankReconciliation(companyId, viewMode);

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isCierreDialogOpen, setIsCierreDialogOpen] = useState(false);
  const [cierreData, setCierreData] = useState({
    notasCierre: '',
    forzarCierre: false,
    generarAjuste: false,
    diferencias: [] as Array<{ monto: number; concepto: string; justificacion: string }>,
  });
  const [nuevaDiferencia, setNuevaDiferencia] = useState({ monto: 0, concepto: '', justificacion: '' });

  // ═══════════════════════════════════════════════════════════════════
  // Handlers
  // ═══════════════════════════════════════════════════════════════════

  const handleImport = (data: Parameters<typeof reconciliation.importMutation.mutate>[0]) => {
    reconciliation.importMutation.mutate(data, {
      onSuccess: () => setIsImportDialogOpen(false),
    });
  };

  const handleAcceptSuggestion = (bankMovementId: number, paymentId: number) => {
    // Confirmar sugerencia de ML via API
    fetch('/api/tesoreria/conciliacion/sugerencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankMovementId, paymentId, paymentType: 'CLIENTE' }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Error');
        return res.json();
      })
      .then(() => {
        toast.success('Sugerencia aceptada');
        reconciliation.refetch();
      })
      .catch(() => toast.error('Error al aceptar sugerencia'));
  };

  const handleCierre = () => {
    if (!reconciliation.selectedStatementId) return;

    reconciliation.cierreMutation.mutate(
      {
        statementId: reconciliation.selectedStatementId,
        justificacionDiferencias: cierreData.diferencias,
        notasCierre: cierreData.notasCierre || undefined,
        forzarCierre: cierreData.forzarCierre,
        generarAjuste: cierreData.generarAjuste,
      },
      {
        onSuccess: () => {
          setIsCierreDialogOpen(false);
          setCierreData({ notasCierre: '', forzarCierre: false, generarAjuste: false, diferencias: [] });
        },
      }
    );
  };

  const handleExportPDF = async () => {
    if (!reconciliation.selectedStatementId) return;

    try {
      toast.loading('Generando PDF...', { id: 'pdf' });
      const res = await fetch(
        `/api/tesoreria/conciliacion/reporte/${reconciliation.selectedStatementId}`
      );
      if (!res.ok) throw new Error('Error al obtener datos del reporte');
      const data = await res.json();

      const pdfUrl = generateBankReconciliationPDF(data);
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `conciliacion_${data.periodo}_${data.banco.nombre.replace(/\s/g, '_')}.pdf`;
      link.click();
      toast.success('PDF descargado', { id: 'pdf' });
    } catch {
      toast.error('Error al generar PDF', { id: 'pdf' });
    }
  };

  const handleAddDiferencia = () => {
    if (!nuevaDiferencia.concepto || !nuevaDiferencia.justificacion) {
      toast.error('Complete concepto y justificación');
      return;
    }
    setCierreData({
      ...cierreData,
      diferencias: [...cierreData.diferencias, { ...nuevaDiferencia }],
    });
    setNuevaDiferencia({ monto: 0, concepto: '', justificacion: '' });
  };

  // ═══════════════════════════════════════════════════════════════════
  // Loading / Error states
  // ═══════════════════════════════════════════════════════════════════

  if (reconciliation.isLoading) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6 grid grid-cols-2 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (reconciliation.error) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <h1 className="text-xl font-semibold text-foreground">Conciliación Bancaria</h1>
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Error al cargar extractos</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const {
    statements,
    bancos,
    detail,
    summary,
    suggestions,
    selectedStatementId,
    filters,
    searchTerm,
  } = reconciliation;

  const pendientes = statements.filter((s) => s.estado === 'PENDIENTE' || s.estado === 'EN_PROCESO').length;
  const completadas = statements.filter((s) => s.estado === 'COMPLETADA' || s.estado === 'CERRADA').length;
  const conDiferencias = statements.filter((s) => s.estado === 'CON_DIFERENCIAS').length;

  const selectedStmt = statements.find((s) => s.id === selectedStatementId);
  const isClosed = selectedStmt?.estado === 'CERRADA' || selectedStmt?.estado === 'COMPLETADA';

  return (
    <div className="w-full p-0">
      {/* ═══ Header ═══ */}
      <div className="px-4 md:px-6 pt-4 pb-3 border-b border-border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Conciliación Bancaria</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Comparar extractos bancarios con movimientos del sistema
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => reconciliation.refetch()}
              disabled={reconciliation.isFetching}
              className={cn(
                'inline-flex items-center border border-border rounded-md p-0.5 bg-muted/40 h-7',
                'px-2 text-xs font-normal gap-1.5',
                'hover:bg-muted disabled:opacity-50',
                reconciliation.isFetching && 'bg-background shadow-sm'
              )}
            >
              <RefreshCcw className={cn('h-3.5 w-3.5', reconciliation.isFetching && 'animate-spin')} />
              Actualizar
            </button>
            {canReconcile && (
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => setIsImportDialogOpen(true)}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              Importar Extracto
            </Button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ KPI Cards ═══ */}
      <div className="px-4 md:px-6 pt-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Pendientes</p>
                  <p className="text-2xl font-bold mt-1 text-info-muted-foreground">{pendientes}</p>
                  <p className="text-xs text-muted-foreground mt-1">Por conciliar</p>
                </div>
                <div className="p-2 rounded-lg bg-info-muted">
                  <Clock className="h-4 w-4 text-info-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Completadas</p>
                  <p className="text-2xl font-bold mt-1 text-success">{completadas}</p>
                  <p className="text-xs text-muted-foreground mt-1">100% conciliadas</p>
                </div>
                <div className="p-2 rounded-lg bg-success-muted">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Con Diferencias</p>
                  <p className="text-2xl font-bold mt-1 text-warning-muted-foreground">{conDiferencias}</p>
                  <p className="text-xs text-muted-foreground mt-1">Items suspense</p>
                </div>
                <div className="p-2 rounded-lg bg-warning-muted">
                  <AlertCircle className="h-4 w-4 text-warning-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total Extractos</p>
                  <p className="text-2xl font-bold mt-1 text-primary">{statements.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Importados</p>
                </div>
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══ Content Tabs ═══ */}
      <div className="px-4 md:px-6 pt-4 pb-6">
        <Tabs defaultValue="statements" className="w-full">
          <TabsList className="w-full max-w-lg justify-start overflow-x-auto">
            <TabsTrigger value="statements" className="text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
              Extractos
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="text-xs" disabled={!selectedStatementId}>
              <Link2 className="h-3.5 w-3.5 mr-1" />
              Conciliación
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="text-xs" disabled={!selectedStatementId}>
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Sugerencias
            </TabsTrigger>
          </TabsList>

          {/* ═══ TAB: Extractos ═══ */}
          <TabsContent value="statements" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <CardTitle className="text-sm font-medium">Extractos Bancarios</CardTitle>
                    <CardDescription className="text-xs">
                      Seleccione un extracto para conciliar
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={filters.bankAccountId}
                      onValueChange={(value) =>
                        reconciliation.setFilters({ ...filters, bankAccountId: value === 'all' ? '' : value, offset: 0 })
                      }
                    >
                      <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue placeholder="Todos los bancos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los bancos</SelectItem>
                        {bancos.map((banco) => (
                          <SelectItem key={banco.id} value={banco.id.toString()}>
                            {banco.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={filters.estado}
                      onValueChange={(value) =>
                        reconciliation.setFilters({ ...filters, estado: value === 'all' ? '' : value, offset: 0 })
                      }
                    >
                      <SelectTrigger className="w-[150px] h-8 text-xs">
                        <SelectValue placeholder="Todos los estados" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                        <SelectItem value="EN_PROCESO">En proceso</SelectItem>
                        <SelectItem value="COMPLETADA">Completada</SelectItem>
                        <SelectItem value="CON_DIFERENCIAS">Con diferencias</SelectItem>
                        <SelectItem value="CERRADA">Cerrada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {statements.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center py-12">
                      <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                        <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-medium mb-1">No hay extractos</h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        Importe un extracto bancario para comenzar la conciliación
                      </p>
                      {canReconcile && (
                      <Button onClick={() => setIsImportDialogOpen(true)}>
                        <Upload className="h-4 w-4 mr-2" />
                        Importar primer extracto
                      </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-xs">Período</TableHead>
                          <TableHead className="text-xs">Banco</TableHead>
                          <TableHead className="text-xs text-center">Items</TableHead>
                          <TableHead className="text-xs text-center">Conciliados</TableHead>
                          <TableHead className="text-xs text-center">Suspense</TableHead>
                          <TableHead className="text-xs text-right">Saldo Final</TableHead>
                          <TableHead className="text-xs">Estado</TableHead>
                          <TableHead className="text-xs text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statements.map((stmt) => (
                          <TableRow
                            key={stmt.id}
                            className={cn(
                              'hover:bg-muted/30 cursor-pointer',
                              selectedStatementId === stmt.id && 'bg-primary/5'
                            )}
                            onClick={() => reconciliation.setSelectedStatementId(stmt.id)}
                          >
                            <TableCell className="text-sm font-medium">{stmt.periodo}</TableCell>
                            <TableCell className="text-xs">
                              <div className="flex items-center gap-1.5">
                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                {stmt.bankAccount.nombre}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-center">{stmt.totalItems}</TableCell>
                            <TableCell className="text-sm text-center">
                              <span className="text-success">{stmt.itemsConciliados}</span>
                              <span className="text-muted-foreground">/{stmt.totalItems}</span>
                            </TableCell>
                            <TableCell className="text-sm text-center">
                              {stmt.itemsSuspense > 0 ? (
                                <span className="text-warning-muted-foreground">{stmt.itemsSuspense}</span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-right font-mono">
                              {formatCurrency(stmt.saldoFinal)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  stmt.estado === 'COMPLETADA' || stmt.estado === 'CERRADA'
                                    ? 'default'
                                    : stmt.estado === 'CON_DIFERENCIAS'
                                    ? 'secondary'
                                    : 'outline'
                                }
                                className="text-xs"
                              >
                                {stmt.estado}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {canReconcile && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  title="Auto-match"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    reconciliation.autoMatchMutation.mutate(stmt.id);
                                  }}
                                  disabled={
                                    reconciliation.autoMatchMutation.isPending ||
                                    stmt.estado === 'CERRADA'
                                  }
                                >
                                  <Sparkles className="h-4 w-4 text-primary" />
                                </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ TAB: Conciliación (Two-Column) ═══ */}
          <TabsContent value="reconciliation" className="mt-4 space-y-4">
            {selectedStatementId && detail && (
              <>
                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h2 className="text-base font-semibold">
                      {detail.periodo} - {detail.bankAccount.nombre}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {detail.itemsConciliados} de {detail.totalItems} items conciliados
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={handleExportPDF}
                    >
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </Button>
                    {!isClosed && canReconcile && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setIsCierreDialogOpen(true)}
                      >
                        <Lock className="h-3.5 w-3.5" />
                        Cerrar Conciliación
                      </Button>
                    )}
                    {isClosed && (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {selectedStmt?.estado}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* KPI Summary */}
                <ReconciliationSummary
                  saldoContable={Number(detail.bankAccount.saldoContable) || 0}
                  saldoBancario={detail.saldoFinal}
                  totalItems={detail.totalItems}
                  itemsConciliados={detail.itemsConciliados}
                  itemsPendientes={detail.itemsPendientes}
                  itemsSuspense={detail.itemsSuspense}
                  matchBreakdown={summary?.matchBreakdown}
                />

                {/* Two-Column Reconciliation */}
                <BankReconciliation
                  items={detail.items || []}
                  unmatchedMovements={reconciliation.filteredUnmatched}
                  selectedBankItems={reconciliation.selectedBankItems}
                  selectedSystemMovements={reconciliation.selectedSystemMovements}
                  onToggleBankItem={reconciliation.toggleBankItemSelection}
                  onToggleSystemMovement={reconciliation.toggleSystemMovementSelection}
                  onManualMatch={reconciliation.handleManualMatch}
                  onUnmatch={(itemId) =>
                    reconciliation.unmatchMutation.mutate({
                      statementId: selectedStatementId,
                      itemId,
                    })
                  }
                  onAutoMatch={() =>
                    reconciliation.autoMatchMutation.mutate(selectedStatementId)
                  }
                  isAutoMatching={reconciliation.autoMatchMutation.isPending}
                  isManualMatching={reconciliation.manualMatchMutation.isPending}
                  searchTerm={searchTerm}
                  onSearchChange={reconciliation.setSearchTerm}
                  isLoadingUnmatched={reconciliation.isLoadingUnmatched}
                />
              </>
            )}

            {selectedStatementId && reconciliation.isLoadingDetail && (
              <div className="space-y-4">
                <Skeleton className="h-28" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-64" />
                  <Skeleton className="h-64" />
                </div>
              </div>
            )}
          </TabsContent>

          {/* ═══ TAB: Sugerencias ML ═══ */}
          <TabsContent value="suggestions" className="mt-4">
            {selectedStatementId && (
              <MatchingSuggestions
                suggestions={suggestions}
                isLoading={reconciliation.isLoadingSuggestions}
                onAcceptSuggestion={handleAcceptSuggestion}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ═══ Import Dialog ═══ */}
      <CSVImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        bancos={bancos}
        onImport={handleImport}
        isImporting={reconciliation.importMutation.isPending}
      />

      {/* ═══ Cierre Dialog ═══ */}
      <Dialog open={isCierreDialogOpen} onOpenChange={setIsCierreDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Cerrar Conciliación
            </DialogTitle>
            <DialogDescription>
              {summary?.pending === 0
                ? 'Todos los items están conciliados. La conciliación se cerrará como COMPLETADA.'
                : `Hay ${summary?.pending || 0} item(s) pendientes. Justifique las diferencias para cerrar.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Resumen */}
            {summary && (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-success-muted">
                  <p className="text-xl font-bold text-success">{summary.matched}</p>
                  <p className="text-xs text-muted-foreground">Conciliados</p>
                </div>
                <div className="p-3 rounded-lg bg-warning-muted">
                  <p className="text-xl font-bold text-warning-muted-foreground">{summary.pending}</p>
                  <p className="text-xs text-muted-foreground">Pendientes</p>
                </div>
                <div className="p-3 rounded-lg bg-destructive/10">
                  <p className="text-xl font-bold text-destructive">{summary.suspense}</p>
                  <p className="text-xs text-muted-foreground">Suspense</p>
                </div>
              </div>
            )}

            {/* Diferencias - solo si hay pendientes */}
            {(summary?.pending || 0) > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Justificación de diferencias</Label>

                {/* Lista de diferencias agregadas */}
                {cierreData.diferencias.map((dif, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border text-sm">
                    <span className="font-mono font-medium">{formatCurrency(dif.monto)}</span>
                    <span className="text-muted-foreground">-</span>
                    <span className="font-medium">{dif.concepto}</span>
                    <span className="text-muted-foreground truncate flex-1">{dif.justificacion}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() =>
                        setCierreData({
                          ...cierreData,
                          diferencias: cierreData.diferencias.filter((_, i) => i !== idx),
                        })
                      }
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}

                {/* Agregar nueva diferencia */}
                <div className="grid grid-cols-[100px_1fr_1fr_auto] gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Monto"
                    value={nuevaDiferencia.monto || ''}
                    onChange={(e) =>
                      setNuevaDiferencia({ ...nuevaDiferencia, monto: parseFloat(e.target.value) || 0 })
                    }
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="Concepto"
                    value={nuevaDiferencia.concepto}
                    onChange={(e) =>
                      setNuevaDiferencia({ ...nuevaDiferencia, concepto: e.target.value })
                    }
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="Justificación"
                    value={nuevaDiferencia.justificacion}
                    onChange={(e) =>
                      setNuevaDiferencia({ ...nuevaDiferencia, justificacion: e.target.value })
                    }
                    className="h-8 text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={handleAddDiferencia}
                  >
                    Agregar
                  </Button>
                </div>

                {/* Opciones de cierre */}
                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cierreData.forzarCierre}
                      onChange={(e) =>
                        setCierreData({ ...cierreData, forzarCierre: e.target.checked })
                      }
                      className="rounded"
                    />
                    Forzar cierre con items pendientes
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cierreData.generarAjuste}
                      onChange={(e) =>
                        setCierreData({ ...cierreData, generarAjuste: e.target.checked })
                      }
                      className="rounded"
                    />
                    Generar asiento contable de ajuste automático
                  </label>
                </div>
              </div>
            )}

            {/* Notas */}
            <div className="space-y-2">
              <Label htmlFor="notasCierre" className="text-sm">Notas de cierre</Label>
              <textarea
                id="notasCierre"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Observaciones sobre esta conciliación..."
                value={cierreData.notasCierre}
                onChange={(e) =>
                  setCierreData({ ...cierreData, notasCierre: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCierreDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCierre}
              disabled={
                reconciliation.cierreMutation.isPending ||
                ((summary?.pending || 0) > 0 && !cierreData.forzarCierre)
              }
            >
              {reconciliation.cierreMutation.isPending
                ? 'Cerrando...'
                : summary?.pending === 0
                ? 'Completar Conciliación'
                : 'Cerrar con Diferencias'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
