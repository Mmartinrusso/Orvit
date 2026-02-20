'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  RefreshCw,
  ShoppingCart,
  CalendarDays,
  TrendingUp
} from 'lucide-react';

interface ComprasMensualesProps {
  companyId: string;
  selectedMonth: string;
}

interface PurchaseRecord {
  month: string;
  amount: number;
  createdAt?: string;
}

const months = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' }
];

const getYearFromSelectedMonth = (selectedMonth: string) => {
  const [year] = selectedMonth.split('-');
  const parsed = parseInt(year, 10);
  return Number.isNaN(parsed) ? new Date().getFullYear() : parsed;
};

const getMonthNumber = (selectedMonth: string) => {
  const [, month] = selectedMonth.split('-');
  const parsed = parseInt(month, 10);
  return Number.isNaN(parsed) ? new Date().getMonth() + 1 : parsed;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value || 0);

export function ComprasMensuales({
  companyId,
  selectedMonth
}: ComprasMensualesProps) {
  const [selectedYear, setSelectedYear] = useState(
    getYearFromSelectedMonth(selectedMonth)
  );
  const [purchases, setPurchases] = useState<Record<number, number>>({});
  const [purchaseInputs, setPurchaseInputs] = useState<Record<number, string>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingMonth, setSavingMonth] = useState<number | null>(null);

  const today = useMemo(() => new Date(), []);
  const actualMonthNumber = today.getMonth() + 1;
  const actualYear = today.getFullYear();
  const currentMonthNumber = actualMonthNumber;

  const years = useMemo(() => {
    const baseYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, index) => baseYear - index);
  }, []);

  const loadPurchases = async (year: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/purchases/monthly?companyId=${companyId}&year=${year}`
      );
      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }
      const data: { purchases: PurchaseRecord[] } = await response.json();

      const map: Record<number, number> = {};
      const inputs: Record<number, string> = {};

      data.purchases?.forEach((purchase) => {
        const [, month] = purchase.month.split('-');
        const monthNumber = parseInt(month, 10);
        if (!Number.isNaN(monthNumber)) {
          map[monthNumber] = purchase.amount;
        }
      });

      months.forEach(({ value }) => {
        inputs[value] =
          map[value] !== undefined && !Number.isNaN(map[value])
            ? map[value].toString()
            : '';
      });

      setPurchases(map);
      setPurchaseInputs(inputs);
    } catch (err) {
      console.error('❌ Error loading monthly purchases:', err);
      setError('No se pudieron cargar las compras del año seleccionado.');
      setPurchases({});
      setPurchaseInputs({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedYear(getYearFromSelectedMonth(selectedMonth));
  }, [selectedMonth]);

  useEffect(() => {
    loadPurchases(selectedYear);
  }, [selectedYear, companyId]);

  const handleInputChange = (monthNumber: number, value: string) => {
    setPurchaseInputs((prev) => ({ ...prev, [monthNumber]: value }));
    setError(null);
  };

  const handleSave = async (monthNumber: number) => {
    const rawValue = purchaseInputs[monthNumber];
    const trimmed = rawValue?.trim() ?? '';

    setSavingMonth(monthNumber);
    setError(null);

    try {
      if (trimmed === '') {
        // Delete existing record
        const response = await fetch('/api/purchases/monthly', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: parseInt(companyId, 10),
            year: selectedYear,
            month: monthNumber
          })
        });

        if (!response.ok) {
          throw new Error(`Status ${response.status}`);
        }

        setPurchases((prev) => {
          const { [monthNumber]: _removed, ...rest } = prev;
          return rest;
        });
        setPurchaseInputs((prev) => ({ ...prev, [monthNumber]: '' }));
        return;
      }

      const numericAmount = Number(trimmed);
      if (Number.isNaN(numericAmount)) {
        setError('Ingresá un monto válido para guardar.');
        return;
      }

      const response = await fetch('/api/purchases/monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: parseInt(companyId, 10),
          year: selectedYear,
          month: monthNumber,
          amount: numericAmount
        })
      });

      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }

      setPurchases((prev) => ({ ...prev, [monthNumber]: numericAmount }));
      setPurchaseInputs((prev) => ({
        ...prev,
        [monthNumber]: numericAmount.toString()
      }));
    } catch (err) {
      console.error('❌ Error saving purchase:', err);
      setError('No se pudo guardar la compra. Intentá nuevamente.');
    } finally {
      setSavingMonth(null);
    }
  };

  const totalAnnual = Object.values(purchases).reduce(
    (sum, value) => sum + value,
    0
  );
  const currentMonthAmount =
    selectedYear === actualYear ? purchases[currentMonthNumber] ?? 0 : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-medium text-foreground">Compras mensuales</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Registrá el total de compras de cada mes para seguir su evolución.
            El campo vacío elimina el registro del mes al guardar.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Label htmlFor="year-selector">Año</Label>
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value, 10))}
            >
              <SelectTrigger id="year-selector" className="w-[140px]">
                <SelectValue placeholder="Seleccionar año" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Card className="bg-info-muted border-info-muted text-info-muted-foreground">
            <CardContent className="p-4">
              <div className="text-xs uppercase font-semibold tracking-wide">
                {months[currentMonthNumber - 1]?.label ?? ''} {actualYear}
              </div>
              <div className="text-xl font-bold">
                {formatCurrency(currentMonthAmount)}
              </div>
              <div className="text-xs flex items-center gap-1 text-info-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                Mes seleccionado
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalle de compras mensuales</CardTitle>
          <CardDescription>
            Ingresá el monto total para cada mes. Guardá vacío para eliminar el
            registro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8 gap-3 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Cargando compras del {selectedYear}...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border rounded-lg">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 border-b">Mes</th>
                    <th className="text-right p-3 border-b">
                      Monto registrado
                    </th>
                    <th className="text-right p-3 border-b">Nuevo monto</th>
                    <th className="text-right p-3 border-b">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((month, index) => {
                    const amount = purchases[month.value];
                    const inputValue = purchaseInputs[month.value] ?? '';
                    const isCurrentMonth =
                      month.value === currentMonthNumber &&
                      selectedYear === actualYear;
                    const rowClass = `border-b ${
                      isCurrentMonth
                        ? 'bg-info-muted'
                        : index % 2 === 0
                        ? 'bg-background'
                        : 'bg-muted/30'
                    }`;
                    return (
                      <tr key={month.value} className={rowClass}>
                        <td className="p-3 font-medium">
                          <div className="flex items-center gap-2">
                            <span>{month.label}</span>
                            {isCurrentMonth && (
                              <span className="text-xs font-semibold text-info-muted-foreground">
                                (actual)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right font-semibold">
                          {amount !== undefined ? formatCurrency(amount) : '-'}
                        </td>
                        <td className="p-3 text-right">
                          <Input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            value={inputValue}
                            onChange={(event) =>
                              handleInputChange(
                                month.value,
                                event.target.value
                              )
                            }
                            placeholder="0.00"
                            className="text-right"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSave(month.value)}
                            disabled={savingMonth === month.value}
                          >
                            {savingMonth === month.value ? 'Guardando…' : 'Guardar'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-semibold bg-muted">
                    <td className="p-3" colSpan={2}>
                      Total anual registrado
                    </td>
                    <td className="p-3 text-right">
                      {formatCurrency(totalAnnual)}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        Actualizado automáticamente
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

