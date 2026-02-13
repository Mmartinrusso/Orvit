'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  FileText,
  CreditCard,
  Receipt,
  TrendingUp,
  RefreshCw,
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Banknote,
  ArrowDownRight,
  ArrowUpRight,
  Link2,
} from 'lucide-react';
import { useViewMode } from '@/contexts/ViewModeContext';

interface DocumentoRelacionado {
  id: number | string;
  tipo: 'OP' | 'NCA' | 'NC' | 'ANT' | 'REMITO' | 'DEVOLUCION';
  numero: string;
  fecha: string;
  monto: number;
  estado?: string;
  docType?: 'T1' | 'T2';
}

interface RelacionesDocumentoModalProps {
  open: boolean;
  onClose: () => void;
  facturaId: number;
  facturaNumero: string;
  facturaTotal: number;
  proveedorId?: number;
  facturaDocType?: 'T1' | 'T2';
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const tipoConfig: Record<string, { label: string; icon: React.ReactNode; bgColor: string; textColor: string; borderColor: string }> = {
  OP: {
    label: 'Orden de Pago',
    icon: <Banknote className="w-4 h-4" />,
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    textColor: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  NCA: {
    label: 'Nota de Crédito',
    icon: <Receipt className="w-4 h-4" />,
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    textColor: 'text-green-600 dark:text-green-400',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  NC: {
    label: 'Nota de Crédito',
    icon: <Receipt className="w-4 h-4" />,
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  ANT: {
    label: 'Anticipo',
    icon: <TrendingUp className="w-4 h-4" />,
    bgColor: 'bg-teal-50 dark:bg-teal-950/30',
    textColor: 'text-teal-600 dark:text-teal-400',
    borderColor: 'border-teal-200 dark:border-teal-800',
  },
  REMITO: {
    label: 'Remito',
    icon: <Package className="w-4 h-4" />,
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    textColor: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  DEVOLUCION: {
    label: 'Devolución',
    icon: <RefreshCw className="w-4 h-4" />,
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    textColor: 'text-red-600 dark:text-red-400',
    borderColor: 'border-red-200 dark:border-red-800',
  },
};

const getEstadoIcon = (estado?: string) => {
  if (!estado) return null;
  const estadoLower = estado.toLowerCase();
  if (estadoLower.includes('aplicada') || estadoLower.includes('pagada') || estadoLower.includes('confirmad')) {
    return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
  }
  if (estadoLower.includes('pendiente') || estadoLower.includes('emitida')) {
    return <Clock className="w-3.5 h-3.5 text-amber-500" />;
  }
  return <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />;
};

export function RelacionesDocumentoModal({
  open,
  onClose,
  facturaId,
  facturaNumero,
  facturaTotal,
  proveedorId,
  facturaDocType,
}: RelacionesDocumentoModalProps) {
  const { mode } = useViewMode();
  const [loading, setLoading] = useState(false);
  const [relacionados, setRelacionados] = useState<DocumentoRelacionado[]>([]);
  const [activeTab, setActiveTab] = useState<'todos' | 'pagos' | 'creditos'>('todos');
  const [totales, setTotales] = useState({
    pagos: 0,
    creditos: 0,
    anticipos: 0,
    saldoPendiente: 0,
  });

  useEffect(() => {
    if (open && facturaId) {
      loadRelaciones();
    }
  }, [open, facturaId]);

  const loadRelaciones = async () => {
    setLoading(true);
    try {
      // Para OPs necesitamos proveedorId para que incluya los recibos
      const opUrl = proveedorId
        ? `/api/compras/ordenes-pago?proveedorId=${proveedorId}`
        : `/api/compras/ordenes-pago`;
      const [opRes, ncaRes, grRes] = await Promise.all([
        fetch(opUrl).then(r => r.ok ? r.json() : { data: [] }),
        fetch(`/api/compras/notas-credito-debito?facturaId=${facturaId}`).then(r => r.ok ? r.json() : { data: [] }),
        fetch(`/api/compras/recepciones?facturaId=${facturaId}`).then(r => r.ok ? r.json() : { data: [] }),
      ]);

      const docs: DocumentoRelacionado[] = [];
      let totalPagos = 0;
      let totalCreditos = 0;
      let totalAnticipos = 0;

      // Process OPs - la API devuelve "recibos" (no "receipts")
      const ops = opRes.data || opRes || [];
      ops.forEach((op: any) => {
        const recibos = op.recibos || op.receipts || [];
        const receiptAlloc = recibos.find((r: any) =>
          r.receiptId === facturaId ||
          r.receipt?.id === facturaId ||
          Number(r.receiptId) === facturaId ||
          Number(r.receipt?.id) === facturaId
        );
        if (receiptAlloc) {
          const monto = receiptAlloc.montoAplicado || op.totalPago || 0;
          docs.push({
            id: op.id,
            tipo: 'OP',
            numero: op.numero || `OP-${op.id}`,
            fecha: op.fechaPago || op.createdAt,
            monto: Number(monto),
            estado: op.estado,
            docType: op.docType,
          });
          totalPagos += Number(monto);
        }

        if (op.isAnticipo || op.anticipoAplicado) {
          docs.push({
            id: `ant-${op.id}`,
            tipo: 'ANT',
            numero: op.numero || `ANT-${op.id}`,
            fecha: op.fechaPago || op.createdAt,
            monto: Number(op.anticipoMonto || 0),
            estado: 'aplicado',
            docType: op.docType,
          });
          totalAnticipos += Number(op.anticipoMonto || 0);
        }
      });

      // Process NCAs/NCs
      const ncas = ncaRes.data || ncaRes || [];
      ncas.forEach((nca: any) => {
        if (nca.facturaId === facturaId) {
          // En T2 es NC, en T1 es NCA
          const tipoNota = nca.docType === 'T2' ? 'NC' : 'NCA';
          docs.push({
            id: nca.id,
            tipo: tipoNota,
            numero: nca.numeroSerie || nca.numero,
            fecha: nca.fechaEmision || nca.createdAt,
            monto: Number(nca.total || 0),
            estado: nca.estado,
            docType: nca.docType,
          });
          totalCreditos += Number(nca.total || 0);
        }
      });

      // Process Remitos
      const grs = grRes.data || grRes || [];
      grs.forEach((gr: any) => {
        docs.push({
          id: gr.id,
          tipo: 'REMITO',
          numero: gr.numeroRemito || gr.numero || `REM-${gr.id}`,
          fecha: gr.fechaRecepcion || gr.createdAt,
          monto: 0,
          estado: gr.estado,
          docType: gr.docType,
        });
      });

      // Filtrar por T1/T2 según viewMode
      let filteredDocs = docs;
      if (mode === 'T1') {
        filteredDocs = docs.filter(d => d.docType !== 'T2');
      } else if (mode === 'T2') {
        filteredDocs = docs.filter(d => d.docType !== 'T1');
      }

      setRelacionados(filteredDocs);
      setTotales({
        pagos: totalPagos,
        creditos: totalCreditos,
        anticipos: totalAnticipos,
        saldoPendiente: facturaTotal - totalPagos - totalCreditos - totalAnticipos,
      });
    } catch (error) {
      console.error('Error loading relaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const docsFiltrados = relacionados.filter(doc => {
    if (activeTab === 'todos') return true;
    if (activeTab === 'pagos') return doc.tipo === 'OP' || doc.tipo === 'ANT';
    if (activeTab === 'creditos') return doc.tipo === 'NCA' || doc.tipo === 'NC';
    return true;
  });

  const tipoFactura = facturaDocType === 'T2' ? 'PPT' : 'FCA';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Link2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                    {tipoFactura}
                  </Badge>
                  <DialogTitle className="text-lg">{facturaNumero}</DialogTitle>
                </div>
                <p className="text-sm text-muted-foreground">
                  Total: {formatCurrency(facturaTotal)}
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Cargando...</p>
          </div>
        ) : relacionados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-sm">Sin documentos relacionados</p>
            <p className="text-xs text-muted-foreground mt-1">
              Esta factura no tiene pagos ni notas de crédito
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="todos" className="text-xs">
                  Todos ({relacionados.length})
                </TabsTrigger>
                <TabsTrigger value="pagos" className="text-xs">
                  Pagos ({relacionados.filter(d => d.tipo === 'OP' || d.tipo === 'ANT').length})
                </TabsTrigger>
                <TabsTrigger value="creditos" className="text-xs">
                  Créditos ({relacionados.filter(d => d.tipo === 'NCA' || d.tipo === 'NC').length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-3">
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {docsFiltrados.map((doc) => {
                    const config = tipoConfig[doc.tipo] || tipoConfig.OP;
                    const isCredit = doc.tipo === 'NCA' || doc.tipo === 'NC' || doc.tipo === 'ANT';
                    return (
                      <div
                        key={`${doc.tipo}-${doc.id}`}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded flex items-center justify-center ${config.bgColor}`}>
                            <span className={config.textColor}>{config.icon}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-[10px] px-1.5 ${config.textColor} border-current`}>
                                {doc.tipo}
                              </Badge>
                              <span className="font-medium text-sm">{doc.numero}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{formatDate(doc.fecha)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {doc.monto > 0 && (
                            <p className={`font-semibold text-sm ${isCredit ? 'text-green-600' : 'text-purple-600'}`}>
                              {isCredit ? '-' : ''}{formatCurrency(doc.monto)}
                            </p>
                          )}
                          {doc.estado && (
                            <div className="flex items-center gap-1">
                              {getEstadoIcon(doc.estado)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>

            {/* Resumen */}
            <div className="grid grid-cols-4 gap-3 p-3 rounded-lg bg-muted/30 text-center text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-semibold">{formatCurrency(facturaTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pagos</p>
                <p className="font-semibold text-purple-600">
                  {totales.pagos > 0 ? `-${formatCurrency(totales.pagos)}` : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Créditos</p>
                <p className="font-semibold text-green-600">
                  {totales.creditos > 0 ? `-${formatCurrency(totales.creditos)}` : '-'}
                </p>
              </div>
              <div className="border-l">
                <p className="text-xs text-muted-foreground">Saldo</p>
                <p className={`font-bold ${totales.saldoPendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(Math.abs(totales.saldoPendiente))}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
