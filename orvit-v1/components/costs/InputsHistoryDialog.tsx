'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { History, Search, TrendingUp, TrendingDown, Calendar, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCompany } from '@/contexts/CompanyContext';

interface InputHistoryEntry {
  id: string;
  inputId: string;
  inputName: string;
  unitLabel: string;
  price: number;
  effectiveFrom: string;
  createdAt: string;
  previousPrice?: number;
  changePercent?: number;
}

interface InputsHistoryDialogProps {
  children?: React.ReactNode;
}

export function InputsHistoryDialog({ children }: InputsHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<InputHistoryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredHistory, setFilteredHistory] = useState<InputHistoryEntry[]>([]);
  const { currentCompany } = useCompany();

  const fetchHistory = async () => {
    if (!currentCompany) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(`/api/inputs/history?companyId=${currentCompany.id}`);
      
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      } else {
        toast.error('Error al cargar historial de insumos');
      }
    } catch (error) {
      console.error('Error fetching inputs history:', error);
      toast.error('Error al cargar historial de insumos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open, currentCompany]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = history.filter(entry => 
        entry.inputName.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredHistory(filtered);
    } else {
      setFilteredHistory(history);
    }
  }, [history, searchTerm]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: es });
  };

  const getChangeIcon = (changePercent?: number) => {
    if (!changePercent || changePercent === 0) return null;
    return changePercent > 0 ? (
      <TrendingUp className="h-3 w-3 text-green-600" />
    ) : (
      <TrendingDown className="h-3 w-3 text-red-600" />
    );
  };

  const getChangeColor = (changePercent?: number) => {
    if (!changePercent || changePercent === 0) return 'text-muted-foreground';
    return changePercent > 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline">
            <History className="h-4 w-4 mr-2" />
            Ver Historial
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <History className="h-5 w-5" />
            Historial Completo de Insumos
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Todos los cambios de precios de insumos ordenados cronológicamente.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        <div className="space-y-6">
          {/* Search */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar insumo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={fetchHistory} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Summary Stats */}
          {history.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-muted/10 rounded-lg border border-border/30">
                <div className="text-sm text-muted-foreground">Total Cambios</div>
                <div className="text-2xl font-bold text-foreground">{filteredHistory.length}</div>
              </div>
              <div className="p-3 bg-muted/10 rounded-lg border border-border/30">
                <div className="text-sm text-muted-foreground">Insumos Distintos</div>
                <div className="text-2xl font-bold text-primary">
                  {new Set(filteredHistory.map(h => h.inputId)).size}
                </div>
              </div>
              <div className="p-3 bg-muted/10 rounded-lg border border-border/30">
                <div className="text-sm text-muted-foreground">Últimos 7 días</div>
                <div className="text-2xl font-bold text-foreground">
                  {filteredHistory.filter(h => {
                    const entryDate = new Date(h.createdAt);
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return entryDate >= weekAgo;
                  }).length}
                </div>
              </div>
            </div>
          )}

          {/* History Timeline */}
          <div>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-muted-foreground">Cargando historial...</span>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{searchTerm ? 'No se encontraron resultados' : 'No hay historial de precios disponible'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Cronología de Cambios ({filteredHistory.length})
                </h4>
                
                <div className="border border-border/30 rounded-lg max-h-[500px] overflow-y-auto">
                  {filteredHistory.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`p-4 flex items-center justify-between ${
                        index % 2 === 0 ? 'bg-background' : 'bg-muted/5'
                      } ${index < filteredHistory.length - 1 ? 'border-b border-border/30' : ''}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-primary"></div>
                          <div>
                            <div className="font-medium text-foreground">
                              {entry.inputName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatCurrency(entry.price)} / {entry.unitLabel}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Efectivo desde: {formatDate(entry.effectiveFrom)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        {entry.changePercent !== undefined && (
                          <div className={`flex items-center gap-1 text-sm font-medium ${getChangeColor(entry.changePercent)}`}>
                            {getChangeIcon(entry.changePercent)}
                            <span>
                              {entry.changePercent >= 0 ? '+' : ''}
                              {entry.changePercent.toFixed(1)}%
                            </span>
                          </div>
                        )}
                        {entry.previousPrice && (
                          <div className="text-xs text-muted-foreground">
                            Anterior: {formatCurrency(entry.previousPrice)}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Registrado: {formatDateTime(entry.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Summary insights */}
          {filteredHistory.length > 0 && (
            <div className="p-4 bg-muted/10 rounded-lg border border-border/30">
              <h5 className="font-medium text-foreground mb-2">Resumen de Cambios</h5>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  {(() => {
                    const increases = filteredHistory.filter(h => h.changePercent && h.changePercent > 0);
                    const decreases = filteredHistory.filter(h => h.changePercent && h.changePercent < 0);
                    
                    return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Aumentos:</span>
                          <span className="font-medium text-green-600">{increases.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Disminuciones:</span>
                          <span className="font-medium text-red-600">{decreases.length}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="space-y-2">
                  {(() => {
                    const changesWithPercent = filteredHistory.filter(h => h.changePercent !== undefined);
                    const avgChange = changesWithPercent.length > 0 
                      ? changesWithPercent.reduce((sum, h) => sum + (h.changePercent || 0), 0) / changesWithPercent.length
                      : 0;
                    
                    return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cambio promedio:</span>
                          <span className={`font-medium ${getChangeColor(avgChange)}`}>
                            {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Con cambios:</span>
                          <span className="font-medium">{changesWithPercent.length}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
