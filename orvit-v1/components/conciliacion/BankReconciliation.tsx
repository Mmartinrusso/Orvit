'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowRightLeft,
  ArrowUpCircle,
  CheckCircle2,
  Clock,
  Link2,
  Link2Off,
  Search,
  X,
  Zap,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { BankStatementItem, TreasuryMovement } from '@/hooks/use-bank-reconciliation';

const DEFAULT_COLORS = {
  chart1: '#6366f1',
  chart5: '#10b981',
  chart4: '#f59e0b',
  kpiPositive: '#10b981',
  kpiNegative: '#ef4444',
  kpiNeutral: '#64748b',
};

interface BankReconciliationProps {
  items: BankStatementItem[];
  unmatchedMovements: TreasuryMovement[];
  selectedBankItems: number[];
  selectedSystemMovements: number[];
  onToggleBankItem: (id: number) => void;
  onToggleSystemMovement: (id: number) => void;
  onManualMatch: () => void;
  onUnmatch: (itemId: number) => void;
  onAutoMatch: () => void;
  isAutoMatching: boolean;
  isManualMatching: boolean;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  isLoadingUnmatched: boolean;
}

function MatchTypeBadge({ matchType, confidence }: { matchType: string | null; confidence: number | null }) {
  if (!matchType) return null;

  const config: Record<string, { color: string; label: string }> = {
    EXACT: { color: DEFAULT_COLORS.kpiPositive, label: 'Exacto' },
    FUZZY: { color: DEFAULT_COLORS.chart4, label: 'Fuzzy' },
    REFERENCE: { color: DEFAULT_COLORS.chart1, label: 'Referencia' },
    MANUAL: { color: DEFAULT_COLORS.kpiNeutral, label: 'Manual' },
  };

  const c = config[matchType] || { color: DEFAULT_COLORS.kpiNeutral, label: matchType };

  return (
    <Badge
      style={{ backgroundColor: `${c.color}20`, color: c.color }}
      className="text-xs gap-1"
    >
      {c.label}
      {confidence !== null && confidence !== undefined && (
        <span className="opacity-70">{Math.round(confidence * 100)}%</span>
      )}
    </Badge>
  );
}

export default function BankReconciliation({
  items,
  unmatchedMovements,
  selectedBankItems,
  selectedSystemMovements,
  onToggleBankItem,
  onToggleSystemMovement,
  onManualMatch,
  onUnmatch,
  onAutoMatch,
  isAutoMatching,
  isManualMatching,
  searchTerm,
  onSearchChange,
  isLoadingUnmatched,
}: BankReconciliationProps) {
  const userColors = DEFAULT_COLORS;
  const [showConciliados, setShowConciliados] = useState(false);

  // Filtrar items bancarios
  const filteredItems = useMemo(() => {
    let filtered = items;
    if (!showConciliados) {
      filtered = filtered.filter((i) => !i.conciliado);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.descripcion.toLowerCase().includes(term) ||
          i.referencia?.toLowerCase().includes(term) ||
          i.fecha.includes(term)
      );
    }
    return filtered;
  }, [items, showConciliados, searchTerm]);

  // Filtrar movimientos del sistema
  const filteredMovements = useMemo(() => {
    if (!searchTerm) return unmatchedMovements;
    const term = searchTerm.toLowerCase();
    return unmatchedMovements.filter(
      (m) =>
        m.descripcion?.toLowerCase().includes(term) ||
        m.referenceType?.toLowerCase().includes(term) ||
        m.fecha.includes(term)
    );
  }, [unmatchedMovements, searchTerm]);

  // Calcular monto seleccionado de cada lado
  const selectedBankTotal = useMemo(() => {
    return items
      .filter((i) => selectedBankItems.includes(i.id))
      .reduce((sum, i) => sum + (i.credito > 0 ? i.credito : -i.debito), 0);
  }, [items, selectedBankItems]);

  const selectedSystemTotal = useMemo(() => {
    return unmatchedMovements
      .filter((m) => selectedSystemMovements.includes(m.id))
      .reduce((sum, m) => sum + m.monto, 0);
  }, [unmatchedMovements, selectedSystemMovements]);

  const canMatch = selectedBankItems.length === 1 && selectedSystemMovements.length === 1;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar en extracto y movimientos..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-background h-8 text-sm"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => onSearchChange('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="show-conciliados"
              checked={showConciliados}
              onCheckedChange={(v) => setShowConciliados(!!v)}
            />
            <label htmlFor="show-conciliados" className="text-xs text-muted-foreground cursor-pointer">
              Mostrar conciliados
            </label>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={onAutoMatch}
                disabled={isAutoMatching}
              >
                <Zap className="h-3.5 w-3.5" />
                Auto-Match
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ejecutar matching automático</TooltipContent>
          </Tooltip>

          {(selectedBankItems.length > 0 || selectedSystemMovements.length > 0) && (
            <div className="flex items-center gap-2 ml-auto p-2 bg-muted/50 rounded-lg border">
              <span className="text-xs text-muted-foreground">
                Bancario: {selectedBankItems.length} sel.
                {selectedBankItems.length > 0 && ` (${formatCurrency(selectedBankTotal)})`}
              </span>
              <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Sistema: {selectedSystemMovements.length} sel.
                {selectedSystemMovements.length > 0 && ` (${formatCurrency(selectedSystemTotal)})`}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1"
                    disabled={!canMatch || isManualMatching}
                    onClick={onManualMatch}
                  >
                    <Link2 className="h-3 w-3" />
                    Conciliar
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {canMatch
                    ? 'Conciliar item seleccionado con movimiento'
                    : 'Seleccione 1 item bancario y 1 movimiento del sistema'}
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ═══ COLUMNA IZQUIERDA: Items del Extracto Bancario ═══ */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ArrowDownCircle className="h-4 w-4" style={{ color: userColors.chart1 }} />
                Extracto Bancario
                <Badge variant="secondary" className="text-xs ml-auto">
                  {filteredItems.length} items
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Items importados del banco. Seleccione uno para conciliar manualmente.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {items.length === 0
                    ? 'No hay items en este extracto'
                    : showConciliados
                    ? 'No se encontraron items'
                    : 'Todos los items están conciliados'}
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs w-8 p-2"></TableHead>
                        <TableHead className="text-xs w-8 p-2"></TableHead>
                        <TableHead className="text-xs">Fecha</TableHead>
                        <TableHead className="text-xs">Descripción</TableHead>
                        <TableHead className="text-xs text-right">Débito</TableHead>
                        <TableHead className="text-xs text-right">Crédito</TableHead>
                        <TableHead className="text-xs">Match</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item) => (
                        <TableRow
                          key={item.id}
                          className={cn(
                            'cursor-pointer transition-colors',
                            item.conciliado && 'bg-green-50/50 dark:bg-green-900/10',
                            item.esSuspense && !item.conciliado && 'bg-yellow-50/50 dark:bg-yellow-900/10',
                            selectedBankItems.includes(item.id) && 'ring-2 ring-inset ring-primary bg-primary/5',
                          )}
                          onClick={() => {
                            if (!item.conciliado) onToggleBankItem(item.id);
                          }}
                        >
                          <TableCell className="p-2">
                            {!item.conciliado && (
                              <Checkbox
                                checked={selectedBankItems.includes(item.id)}
                                onCheckedChange={() => onToggleBankItem(item.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                          </TableCell>
                          <TableCell className="p-2">
                            {item.conciliado ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  Conciliado
                                  {item.treasuryMovement && `: ${item.treasuryMovement.tipo} ${formatCurrency(item.treasuryMovement.monto)}`}
                                </TooltipContent>
                              </Tooltip>
                            ) : item.esSuspense ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  Suspense{item.suspenseNotas ? `: ${item.suspenseNotas}` : ''}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(item.fecha), 'dd/MM/yy', { locale: es })}
                          </TableCell>
                          <TableCell className="text-xs max-w-[160px] truncate">
                            {item.descripcion}
                            {item.referencia && (
                              <span className="text-muted-foreground ml-1 text-[10px]">
                                ({item.referencia})
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono text-red-600">
                            {item.debito > 0 ? formatCurrency(item.debito) : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono text-green-600">
                            {item.credito > 0 ? formatCurrency(item.credito) : '-'}
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="flex items-center gap-1">
                              <MatchTypeBadge
                                matchType={item.matchType}
                                confidence={item.matchConfidence}
                              />
                              {item.conciliado && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 w-5 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onUnmatch(item.id);
                                      }}
                                    >
                                      <Link2Off className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Deshacer conciliación</TooltipContent>
                                </Tooltip>
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

          {/* ═══ COLUMNA DERECHA: Movimientos del Sistema ═══ */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ArrowUpCircle className="h-4 w-4" style={{ color: userColors.chart5 }} />
                Movimientos del Sistema
                <Badge variant="secondary" className="text-xs ml-auto">
                  {filteredMovements.length} pendientes
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Movimientos contables sin conciliar. Seleccione uno para hacer match.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoadingUnmatched ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
              ) : filteredMovements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No hay movimientos pendientes de conciliar
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs w-8 p-2"></TableHead>
                        <TableHead className="text-xs">Fecha</TableHead>
                        <TableHead className="text-xs">Tipo</TableHead>
                        <TableHead className="text-xs text-right">Monto</TableHead>
                        <TableHead className="text-xs">Descripción</TableHead>
                        <TableHead className="text-xs">Referencia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMovements.map((mov) => (
                        <TableRow
                          key={mov.id}
                          className={cn(
                            'cursor-pointer transition-colors hover:bg-muted/30',
                            selectedSystemMovements.includes(mov.id) &&
                              'ring-2 ring-inset ring-primary bg-primary/5',
                          )}
                          onClick={() => onToggleSystemMovement(mov.id)}
                        >
                          <TableCell className="p-2">
                            <Checkbox
                              checked={selectedSystemMovements.includes(mov.id)}
                              onCheckedChange={() => onToggleSystemMovement(mov.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(mov.fecha), 'dd/MM/yy', { locale: es })}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1">
                              {mov.tipo === 'INGRESO' ? (
                                <ArrowUpCircle className="h-3 w-3 text-green-600" />
                              ) : (
                                <ArrowDownCircle className="h-3 w-3 text-red-600" />
                              )}
                              <span className="truncate">{mov.tipo}</span>
                            </div>
                          </TableCell>
                          <TableCell
                            className={cn(
                              'text-xs text-right font-mono',
                              mov.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-600'
                            )}
                          >
                            {formatCurrency(mov.monto)}
                          </TableCell>
                          <TableCell className="text-xs max-w-[120px] truncate">
                            {mov.descripcion || '-'}
                          </TableCell>
                          <TableCell className="text-xs max-w-[80px] truncate text-muted-foreground">
                            {mov.referenceType || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
