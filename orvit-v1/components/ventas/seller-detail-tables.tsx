'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronUp, FileText, ShoppingCart, Receipt } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const BREAKDOWN_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444', '#ec4899'];

const ESTADO_COTIZACION: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  BORRADOR: { label: 'Borrador', variant: 'secondary' },
  ENVIADA: { label: 'Enviada', variant: 'outline' },
  ACEPTADA: { label: 'Aceptada', variant: 'default' },
  RECHAZADA: { label: 'Rechazada', variant: 'destructive' },
  VENCIDA: { label: 'Vencida', variant: 'secondary' },
  CONVERTIDA: { label: 'Convertida', variant: 'default' },
  ANULADA: { label: 'Anulada', variant: 'destructive' },
};

const ESTADO_VENTA: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  BORRADOR: { label: 'Borrador', variant: 'secondary' },
  CONFIRMADA: { label: 'Confirmada', variant: 'outline' },
  EN_PREPARACION: { label: 'En Prep.', variant: 'outline' },
  ENTREGADA: { label: 'Entregada', variant: 'default' },
  FACTURADA: { label: 'Facturada', variant: 'default' },
  COMPLETADA: { label: 'Completada', variant: 'default' },
  CANCELADA: { label: 'Cancelada', variant: 'destructive' },
};

interface CostBreakdown {
  id: number;
  concepto: string;
  monto: number;
  orden: number;
}

interface ItemConBreakdown {
  id: number;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  costBreakdown: CostBreakdown[];
}

function MiniDonut({ breakdown }: { breakdown: CostBreakdown[] }) {
  if (!breakdown || breakdown.length === 0) return null;
  const data = breakdown.map((cb) => ({
    name: cb.concepto,
    value: Number(cb.monto),
  }));

  return (
    <ResponsiveContainer width={60} height={60}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          cx="50%"
          cy="50%"
          innerRadius={15}
          outerRadius={25}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }: any) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-popover border rounded p-1.5 text-xs shadow-lg">
                <p>{d.name}: {formatCurrency(d.value)}</p>
              </div>
            );
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ExpandableItemRow({ item }: { item: ItemConBreakdown }) {
  const hasBreakdown = item.costBreakdown && item.costBreakdown.length > 0;

  return (
    <div className="py-2 border-b last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{item.descripcion}</p>
          <p className="text-xs text-muted-foreground">
            {Number(item.cantidad)} x {formatCurrency(Number(item.precioUnitario))} = {formatCurrency(Number(item.subtotal))}
          </p>
        </div>
        {hasBreakdown && <MiniDonut breakdown={item.costBreakdown} />}
      </div>
      {hasBreakdown && (
        <div className="mt-1 ml-4 space-y-0.5">
          {item.costBreakdown.map((cb, i) => (
            <div key={cb.id || i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <div
                className="w-2 h-2 rounded-sm shrink-0"
                style={{ backgroundColor: BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length] }}
              />
              <span>{cb.concepto}</span>
              <span className="ml-auto tabular-nums">{formatCurrency(Number(cb.monto))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExpandableRow({
  children,
  expanded,
  onToggle,
  items,
}: {
  children: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  items: ItemConBreakdown[];
}) {
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        {children}
        <TableCell className="w-8">
          {items.length > 0 && (
            expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
          )}
        </TableCell>
      </TableRow>
      {expanded && items.length > 0 && (
        <TableRow>
          <TableCell colSpan={10} className="p-0">
            <div className="bg-muted/30 px-6 py-3 border-l-2 border-primary">
              {items.map((item) => (
                <ExpandableItemRow key={item.id} item={item} />
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

interface SellerDetailTablesProps {
  cotizaciones: any[];
  ventas: any[];
  facturas: any[];
}

export function SellerDetailTables({ cotizaciones, ventas, facturas }: SellerDetailTablesProps) {
  const [expandedCot, setExpandedCot] = useState<Set<number>>(new Set());
  const [expandedVentas, setExpandedVentas] = useState<Set<number>>(new Set());

  const toggleCot = (id: number) => {
    setExpandedCot((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleVenta = (id: number) => {
    setExpandedVentas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Card>
      <Tabs defaultValue="cotizaciones">
        <CardHeader className="pb-2">
          <TabsList>
            <TabsTrigger value="cotizaciones" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Cotizaciones ({cotizaciones.length})
            </TabsTrigger>
            <TabsTrigger value="ventas" className="gap-1.5">
              <ShoppingCart className="w-3.5 h-3.5" />
              Ventas ({ventas.length})
            </TabsTrigger>
            <TabsTrigger value="facturas" className="gap-1.5">
              <Receipt className="w-3.5 h-3.5" />
              Facturas ({facturas.length})
            </TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent>
          {/* Cotizaciones Tab */}
          <TabsContent value="cotizaciones" className="mt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cotizaciones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Sin cotizaciones en el periodo
                    </TableCell>
                  </TableRow>
                ) : (
                  cotizaciones.map((cot) => {
                    const estado = ESTADO_COTIZACION[cot.estado] || { label: cot.estado, variant: 'secondary' as const };
                    return (
                      <ExpandableRow
                        key={cot.id}
                        expanded={expandedCot.has(cot.id)}
                        onToggle={() => toggleCot(cot.id)}
                        items={cot.items || []}
                      >
                        <TableCell className="font-mono text-sm">{cot.numero}</TableCell>
                        <TableCell>{cot.client?.legalName || '-'}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(cot.fechaEmision), 'dd/MM/yy', { locale: es })}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(Number(cot.total))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={estado.variant}>{estado.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {cot.sale ? cot.sale.numero : '-'}
                        </TableCell>
                      </ExpandableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Ventas Tab */}
          <TabsContent value="ventas" className="mt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Comisión</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Sin ventas en el periodo
                    </TableCell>
                  </TableRow>
                ) : (
                  ventas.map((venta) => {
                    const estado = ESTADO_VENTA[venta.estado] || { label: venta.estado, variant: 'secondary' as const };
                    return (
                      <ExpandableRow
                        key={venta.id}
                        expanded={expandedVentas.has(venta.id)}
                        onToggle={() => toggleVenta(venta.id)}
                        items={venta.items || []}
                      >
                        <TableCell className="font-mono text-sm">{venta.numero}</TableCell>
                        <TableCell>{venta.client?.legalName || '-'}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(venta.fechaEmision), 'dd/MM/yy', { locale: es })}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(Number(venta.total))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={estado.variant}>{estado.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {venta.comisionPagada ? (
                            <Badge variant="default" className="bg-success">Pagada</Badge>
                          ) : Number(venta.comisionMonto) > 0 ? (
                            <span className="text-sm tabular-nums text-amber-600">
                              {formatCurrency(Number(venta.comisionMonto))}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </ExpandableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Facturas Tab */}
          <TabsContent value="facturas" className="mt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Factura</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facturas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Sin facturas en el periodo
                    </TableCell>
                  </TableRow>
                ) : (
                  facturas.map((fac) => (
                    <TableRow key={fac.id}>
                      <TableCell className="font-mono text-sm">{fac.numeroCompleto}</TableCell>
                      <TableCell>{fac.client?.legalName || '-'}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(fac.fechaEmision), 'dd/MM/yy', { locale: es })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fac.sale?.numero || '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(Number(fac.total))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(fac.saldoPendiente) > 0 ? (
                          <span className="text-amber-600">
                            {formatCurrency(Number(fac.saldoPendiente))}
                          </span>
                        ) : (
                          <span className="text-success-muted-foreground">Cobrada</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={fac.estado === 'ANULADA' ? 'destructive' : 'outline'}>
                          {fac.estado}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
