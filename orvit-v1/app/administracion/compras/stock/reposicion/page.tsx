'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle,
  Package,
  ShoppingCart,
  TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface ReplenishmentSuggestion {
  id: number;
  supplierItemId: number;
  supplierItemNombre: string;
  supplierItemCodigo?: string;
  unidad: string;
  proveedorId: number;
  proveedorNombre: string;
  warehouseId: number;
  warehouseCodigo: string;
  stockActual: number;
  stockReservado: number;
  stockDisponible: number;
  enCamino: number;
  stockMinimo: number;
  stockMaximo?: number;
  cantidadSugerida: number;
  costoUnitario: number;
  valorSugerido: number;
  urgencia: 'CRITICA' | 'ALTA' | 'NORMAL' | 'BAJA';
  criticidad?: string;
}

interface Warehouse {
  id: number;
  codigo: string;
  nombre: string;
}

interface Supplier {
  id: number;
  name: string;
  razon_social?: string;
}

const URGENCIA_CONFIG: Record<string, { label: string; color: string; icon: any; bgColor: string }> = {
  CRITICA: { label: 'Crítica', color: 'text-destructive', icon: AlertTriangle, bgColor: 'bg-destructive/10 border-destructive/30' },
  ALTA: { label: 'Alta', color: 'text-warning-muted-foreground', icon: AlertCircle, bgColor: 'bg-warning-muted border-warning-muted' },
  NORMAL: { label: 'Normal', color: 'text-warning-muted-foreground', icon: Clock, bgColor: 'bg-warning-muted border-warning-muted' },
  BAJA: { label: 'Baja', color: 'text-success', icon: CheckCircle, bgColor: 'bg-success-muted border-success-muted' },
};

export default function ReposicionPage() {
  const [sugerencias, setSugerencias] = useState<ReplenishmentSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    total: 0,
    criticas: 0,
    altas: 0,
    normales: 0,
    bajas: 0,
    valorTotal: 0
  });

  // Filtros
  const [urgenciaFilter, setUrgenciaFilter] = useState<string>('');
  const [proveedorFilter, setProveedorFilter] = useState<string>('');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('');

  // Selección
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Datos auxiliares
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [proveedores, setProveedores] = useState<Supplier[]>([]);

  // Cargar datos auxiliares
  useEffect(() => {
    async function loadAuxData() {
      try {
        const [whRes, provRes] = await Promise.all([
          fetch('/api/compras/depositos'),
          fetch('/api/suppliers?limit=100')
        ]);

        if (whRes.ok) {
          const data = await whRes.json();
          setWarehouses((data.data || data).filter((w: any) => !w.isTransit));
        }
        if (provRes.ok) {
          const data = await provRes.json();
          setProveedores(data.data || data.suppliers || []);
        }
      } catch (error) {
        console.error('Error loading aux data:', error);
      }
    }
    loadAuxData();
  }, []);

  // Cargar sugerencias
  const loadSugerencias = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (urgenciaFilter) params.set('urgencia', urgenciaFilter);
      if (proveedorFilter) params.set('proveedorId', proveedorFilter);
      if (warehouseFilter) params.set('warehouseId', warehouseFilter);

      const res = await fetch(`/api/compras/stock/reposicion?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar sugerencias');

      const data = await res.json();
      setSugerencias(data.data || []);
      setKpis(data.kpis || {
        total: 0, criticas: 0, altas: 0, normales: 0, bajas: 0, valorTotal: 0
      });
      setSelected(new Set());
    } catch (error) {
      console.error('Error loading sugerencias:', error);
      toast.error('Error al cargar sugerencias de reposición');
    } finally {
      setLoading(false);
    }
  }, [urgenciaFilter, proveedorFilter, warehouseFilter]);

  useEffect(() => {
    loadSugerencias();
  }, [loadSugerencias]);

  // Agrupar por urgencia
  const porUrgencia = {
    CRITICA: sugerencias.filter(s => s.urgencia === 'CRITICA'),
    ALTA: sugerencias.filter(s => s.urgencia === 'ALTA'),
    NORMAL: sugerencias.filter(s => s.urgencia === 'NORMAL'),
    BAJA: sugerencias.filter(s => s.urgencia === 'BAJA'),
  };

  // Toggle selección
  const toggleSelect = (id: number) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  // Seleccionar todos de un grupo
  const selectAll = (items: ReplenishmentSuggestion[]) => {
    const newSelected = new Set(selected);
    items.forEach(i => newSelected.add(i.id));
    setSelected(newSelected);
  };

  // Crear OC desde seleccionados
  const handleCreateOC = () => {
    if (selected.size === 0) {
      toast.error('Seleccione al menos un item');
      return;
    }

    const selectedItems = sugerencias.filter(s => selected.has(s.id));
    const proveedoresUnicos = new Set(selectedItems.map(s => s.proveedorId));

    if (proveedoresUnicos.size > 1) {
      toast.warning(`Se crearán ${proveedoresUnicos.size} órdenes de compra (una por proveedor)`);
    }

    // TODO: Navegar a crear OC con items pre-seleccionados
    toast.info('Función de crear OC será implementada próximamente');
  };

  // Calcular totales seleccionados
  const selectedItems = sugerencias.filter(s => selected.has(s.id));
  const totalSeleccionado = selectedItems.reduce((sum, s) => sum + s.valorSugerido, 0);

  return (
    <div className="w-full p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/administracion/compras/stock">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Sugerencias de Reposición</h1>
            <p className="text-sm text-muted-foreground">
              Items que necesitan ser repuestos según stock mínimo configurado
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadSugerencias}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          {selected.size > 0 && (
            <Button onClick={handleCreateOC}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Crear OC ({selected.size})
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{kpis.total}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Críticas</p>
                <p className="text-2xl font-bold text-destructive">{kpis.criticas}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-warning-muted">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Altas</p>
                <p className="text-2xl font-bold text-warning-muted-foreground">{kpis.altas}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-warning-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-warning-muted">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Normales</p>
                <p className="text-2xl font-bold text-warning-muted-foreground">{kpis.normales}</p>
              </div>
              <Clock className="h-8 w-8 text-warning-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-success-muted">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bajas</p>
                <p className="text-2xl font-bold text-success">{kpis.bajas}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-xl font-bold">${kpis.valorTotal.toLocaleString('es-AR')}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Urgencia</Label>
              <Select value={urgenciaFilter || 'all'} onValueChange={(v) => setUrgenciaFilter(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(URGENCIA_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <Select value={proveedorFilter || 'all'} onValueChange={(v) => setProveedorFilter(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {proveedores.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.razon_social || p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Depósito</Label>
              <Select value={warehouseFilter || 'all'} onValueChange={(v) => setWarehouseFilter(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={String(wh.id)}>
                      {wh.codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selección info */}
      {selected.size > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{selected.size} items seleccionados</span>
                <span className="text-muted-foreground ml-2">
                  Valor: ${totalSeleccionado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                Limpiar selección
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contenido */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sugerencias.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-success mb-4" />
              <h3 className="text-lg font-medium mb-2">Stock en buen estado</h3>
              <p className="text-muted-foreground">
                No hay items que necesiten reposición en este momento.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={['CRITICA', 'ALTA']} className="space-y-4">
          {(['CRITICA', 'ALTA', 'NORMAL', 'BAJA'] as const).map((urgencia) => {
            const items = porUrgencia[urgencia];
            if (items.length === 0) return null;

            const config = URGENCIA_CONFIG[urgencia];
            const Icon = config.icon;

            return (
              <AccordionItem key={urgencia} value={urgencia} className={`border rounded-lg ${config.bgColor}`}>
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${config.color}`} />
                    <span className={`font-medium ${config.color}`}>{config.label}</span>
                    <Badge variant="secondary">{items.length}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectAll(items);
                      }}
                      className="ml-2"
                    >
                      Seleccionar todos
                    </Button>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Depósito</TableHead>
                        <TableHead className="text-right">Disponible</TableHead>
                        <TableHead className="text-right">En Camino</TableHead>
                        <TableHead className="text-right">Mínimo</TableHead>
                        <TableHead className="text-right">Sugerido</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Checkbox
                              checked={selected.has(item.id)}
                              onCheckedChange={() => toggleSelect(item.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{item.supplierItemNombre}</div>
                            {item.supplierItemCodigo && (
                              <div className="text-xs text-muted-foreground">{item.supplierItemCodigo}</div>
                            )}
                            {item.criticidad && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                {item.criticidad}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{item.proveedorNombre}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.warehouseCodigo}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={item.stockDisponible <= 0 ? 'text-destructive font-medium' : ''}>
                              {item.stockDisponible.toLocaleString('es-AR')}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {item.enCamino > 0 ? `+${item.enCamino.toLocaleString('es-AR')}` : '-'}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {item.stockMinimo.toLocaleString('es-AR')}
                          </TableCell>
                          <TableCell className="text-right font-medium text-primary">
                            {item.cantidadSugerida.toLocaleString('es-AR')} {item.unidad}
                          </TableCell>
                          <TableCell className="text-right">
                            ${item.valorSugerido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Info */}
      <Card className="bg-info-muted border-info-muted">
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <AlertCircle className="h-4 w-4 text-info-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm text-info-muted-foreground">
              <p className="font-medium">Fórmula de reposición</p>
              <p className="mt-1">
                Se sugiere reposición cuando: <strong>Disponible + En Camino ≤ Punto de Reposición</strong>
              </p>
              <p className="mt-1 text-xs">
                Solo se muestran items con stock mínimo configurado. Configure el mínimo desde la página de Stock.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
