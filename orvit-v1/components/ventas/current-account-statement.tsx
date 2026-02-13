'use client';

/**
 * Current Account Statement Component
 *
 * Displays complete transaction history for a client:
 * - Invoices, payments, credit notes
 * - Running balance
 * - Date range filtering
 * - Export capability
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  FileText,
  Receipt,
  FileX,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Printer,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface Transaction {
  id: number;
  tipo: 'FACTURA' | 'PAGO' | 'NOTA_CREDITO';
  numero: string;
  fecha: string;
  debe: number;
  haber: number;
  saldo: number;
  estado: string;
  detalles?: string;
}

interface CurrentAccountData {
  client: {
    id: string;
    nombre: string;
    cuit?: string;
    saldoActual: number;
  };
  transactions: Transaction[];
  summary: {
    totalFacturado: number;
    totalCobrado: number;
    totalNotasCredito: number;
    saldoActual: number;
    cantidadFacturas: number;
    cantidadPagos: number;
    cantidadNotasCredito: number;
  };
  filters: {
    fechaDesde: string | null;
    fechaHasta: string | null;
  };
}

interface CurrentAccountStatementProps {
  clientId: string;
}

export function CurrentAccountStatement({ clientId }: CurrentAccountStatementProps) {
  const [data, setData] = useState<CurrentAccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  useEffect(() => {
    loadCurrentAccount();
  }, [clientId]);

  const loadCurrentAccount = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fechaDesde) params.append('fechaDesde', fechaDesde);
      if (fechaHasta) params.append('fechaHasta', fechaHasta);

      const response = await fetch(
        `/api/ventas/cuenta-corriente/${clientId}?${params.toString()}`
      );

      if (response.ok) {
        const accountData = await response.json();
        setData(accountData);
      } else {
        toast.error('Error al cargar el estado de cuenta');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar el estado de cuenta');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    loadCurrentAccount();
  };

  const handleClearFilters = () => {
    setFechaDesde('');
    setFechaHasta('');
    loadCurrentAccount();
  };

  const handleExportExcel = async () => {
    toast.info('Exportación a Excel en desarrollo');
    // TODO: Implement Excel export
  };

  const handlePrint = () => {
    window.print();
  };

  const getTransactionIcon = (tipo: string) => {
    switch (tipo) {
      case 'FACTURA':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'PAGO':
        return <Receipt className="w-4 h-4 text-green-600" />;
      case 'NOTA_CREDITO':
        return <FileX className="w-4 h-4 text-orange-600" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No se pudo cargar el estado de cuenta
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Client Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Estado de Cuenta</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {data.client.nombre}
                {data.client.cuit && ` - CUIT: ${data.client.cuit}`}
              </p>
            </div>
            <div className="text-right">
              <Label className="text-xs text-muted-foreground">Saldo Actual</Label>
              <div
                className={`text-2xl font-bold ${
                  data.client.saldoActual > 0 ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {formatCurrency(data.client.saldoActual)}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fechaDesde">Desde</Label>
              <Input
                id="fechaDesde"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaHasta">Hasta</Label>
              <Input
                id="fechaHasta"
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleApplyFilters} className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" />
                Aplicar
              </Button>
              <Button onClick={handleClearFilters} variant="outline">
                Limpiar
              </Button>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleExportExcel} variant="outline" className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Excel
              </Button>
              <Button onClick={handlePrint} variant="outline">
                <Printer className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Facturado</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(data.summary.totalFacturado)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600 opacity-50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {data.summary.cantidadFacturas} facturas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Cobrado</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(data.summary.totalCobrado)}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-green-600 opacity-50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {data.summary.cantidadPagos} pagos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Notas de Crédito</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(data.summary.totalNotasCredito)}
                </p>
              </div>
              <FileX className="w-8 h-8 text-orange-600 opacity-50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {data.summary.cantidadNotasCredito} notas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saldo</p>
                <p
                  className={`text-2xl font-bold ${
                    data.summary.saldoActual > 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {formatCurrency(data.summary.saldoActual)}
                </p>
              </div>
              {data.summary.saldoActual > 0 ? (
                <TrendingUp className="w-8 h-8 text-red-600 opacity-50" />
              ) : (
                <TrendingDown className="w-8 h-8 text-green-600 opacity-50" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {data.summary.saldoActual > 0 ? 'A favor empresa' : 'A favor cliente'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          {data.transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No hay movimientos en el período seleccionado
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Comprobante</TableHead>
                    <TableHead>Detalles</TableHead>
                    <TableHead className="text-right">Debe</TableHead>
                    <TableHead className="text-right">Haber</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.map((txn) => (
                    <TableRow key={`${txn.tipo}-${txn.id}`}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(txn.fecha), 'dd/MM/yyyy', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(txn.tipo)}
                          <span className="text-sm">
                            {txn.tipo === 'FACTURA'
                              ? 'Factura'
                              : txn.tipo === 'PAGO'
                              ? 'Pago'
                              : 'N/C'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{txn.numero}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {txn.detalles || '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {txn.debe > 0 ? formatCurrency(txn.debe) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {txn.haber > 0 ? formatCurrency(txn.haber) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        <span
                          className={
                            txn.saldo > 0 ? 'text-red-600' : txn.saldo < 0 ? 'text-green-600' : ''
                          }
                        >
                          {formatCurrency(txn.saldo)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {txn.estado}
                        </Badge>
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
  );
}
