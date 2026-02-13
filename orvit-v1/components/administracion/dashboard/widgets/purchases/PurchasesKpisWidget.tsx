import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { WidgetComponentProps } from '../../registry';

function formatCurrencyARS(value: number) {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
  } catch {
    return `$${value}`;
  }
}

export function PurchasesKpisWidget({ data, isLoading }: WidgetComponentProps) {
  const purchases = (data?.kpis?.purchases as any) || null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Compras</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        ) : !purchases ? (
          <p className="text-sm text-muted-foreground">Sin datos de compras.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">OC pendientes</p>
              <p className="text-2xl font-semibold">{purchases.ocPending}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Facturas por vencer (7d)</p>
              <p className="text-2xl font-semibold">{purchases.invoicesDue7d}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gasto (30d)</p>
              <p className="text-2xl font-semibold">{formatCurrencyARS(purchases.spend30d)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Proveedores activos</p>
              <p className="text-2xl font-semibold">{purchases.suppliersActive}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


