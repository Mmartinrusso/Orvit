'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { SkeletonTable } from '@/components/ui/skeleton-table';
import { useStockData } from '@/hooks/compras/use-stock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow
} from '@/components/ui/table';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
 Package,
 Search,
 RefreshCw,
 Loader2,
 MoreHorizontal,
 Settings,
 History,
 ArrowRightLeft,
 AlertTriangle,
 AlertCircle,
 TrendingDown,
 DollarSign,
 Boxes,
 Truck,
 X,
 Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useViewMode } from '@/contexts/ViewModeContext';
import { StockConfigModal } from './stock-config-modal';

interface StockKPIs {
 totalItems: number;
 valorTotal: number;
 itemsBajoStock: number;
 itemsSinStock: number;
 valorEnTransito: number;
 porWarehouse: Array<{
 warehouseId: number;
 codigo: string;
 nombre: string;
 totalItems: number;
 valorTotal: number;
 bajoStock: number;
 }>;
}

interface StockLocation {
 id: number;
 warehouseId: number;
 supplierItemId: number;
 cantidad: number;
 cantidadReservada: number;
 stockMinimo: number | null;
 stockMaximo: number | null;
 costoUnitario: number | null;
 criticidad: string | null;
 ubicacion: string | null;
 // Códigos del último movimiento (para trazabilidad)
 codigoPropio: string | null; // Código interno usado en última entrada
 codigoProveedor: string | null; // Código del proveedor usado en última entrada
 descripcionItem: string | null; // Descripción del item en última entrada
 warehouse: {
 id: number;
 codigo: string;
 nombre: string;
 };
 supplierItem: {
 id: number;
 nombre: string;
 unidad: string;
 codigoProveedor: string | null;
 precioUnitario: number;
 supplier: {
 id: number;
 name: string;
 };
 supply?: {
 id: number;
 code: string | null;
 name: string;
 } | null;
 };
 alertas: {
 stockBajo: boolean;
 stockAlto: boolean;
 sinStock: boolean;
 };
 enCamino?: number;
}

interface Warehouse {
 id: number;
 codigo: string;
 nombre: string;
 isTransit: boolean;
}

interface StockSinDeposito {
 id: number;
 supplierItemId: number;
 cantidad: number;
 unidad: string;
 precioUnitario: number;
 ultimaActualizacion: string;
 supplierItem: {
 id: number;
 nombre: string;
 unidad: string;
 codigoProveedor: string | null;
 supplier: {
 id: number;
 name: string;
 };
 } | null;
}

const CRITICIDAD_CONFIG: Record<string, { label: string; color: string }> = {
 CRITICO: { label: 'Critico', color: 'bg-destructive/10 text-destructive border-destructive/30' },
 A: { label: 'A', color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted' },
 B: { label: 'B', color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted' },
 C: { label: 'C', color: 'bg-muted text-foreground border-border' },
};

export function StockList() {
 // ViewMode para reactividad al juego de tecla
 const { mode: viewMode } = useViewMode();

 // Filters
 const [searchTerm, setSearchTerm] = useState('');
 const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
 const [alertaFilter, setAlertaFilter] = useState<string>('all');
 const [criticidadFilter, setCriticidadFilter] = useState<string>('all');
 const [page, setPage] = useState(1);

 // Data via TanStack Query
 const {
 warehouses, kpis, stockItems, totalPages, stockSinDeposito, loadingSinDeposito,
 isLoading: loading, isFetching: refreshing,
 invalidateAll, invalidateStock, invalidateKPIs, invalidateSinDeposito,
 } = useStockData({ page, warehouseFilter, alertaFilter, searchTerm });

 // Selection
 const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

 // Modal
 const [configModalOpen, setConfigModalOpen] = useState(false);
 const [selectedForConfig, setSelectedForConfig] = useState<StockLocation | null>(null);

 // Items sin deposito
 const [showSinDeposito, setShowSinDeposito] = useState(false);
 const [assigningWarehouse, setAssigningWarehouse] = useState<number | null>(null);

 const handleAsignarDeposito = async (supplierItemId: number, warehouseId: number) => {
 setAssigningWarehouse(supplierItemId);
 try {
 const response = await fetch('/api/compras/stock/sin-deposito', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ supplierItemId, warehouseId }),
 });

 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.error || 'Error al asignar deposito');
 }

 toast.success('Deposito asignado correctamente');
 invalidateAll();
 } catch (error) {
 console.error('Error asignando deposito:', error);
 toast.error(error instanceof Error ? error.message : 'Error al asignar deposito');
 } finally {
 setAssigningWarehouse(null);
 }
 };

 const handleRefresh = () => {
 invalidateAll();
 toast.success('Stock actualizado');
 };

 const handleSearch = () => {
 setPage(1);
 // TanStack Query re-fetches automatically when page/filters change
 };

 const clearFilters = () => {
 setSearchTerm('');
 setWarehouseFilter('all');
 setAlertaFilter('all');
 setCriticidadFilter('all');
 setPage(1);
 };

 const hasActiveFilters = searchTerm || warehouseFilter !== 'all' || alertaFilter !== 'all' || criticidadFilter !== 'all';

 const handleConfigStock = (item: StockLocation) => {
 setSelectedForConfig(item);
 setConfigModalOpen(true);
 };

 const handleViewKardex = (item: StockLocation) => {
 // Navigate to kardex page filtered by this item
 window.location.href = `/administracion/compras/stock/kardex?supplierItemId=${item.supplierItemId}`;
 };

 const handleSelectItem = (id: number) => {
 const newSelected = new Set(selectedItems);
 if (newSelected.has(id)) {
 newSelected.delete(id);
 } else {
 newSelected.add(id);
 }
 setSelectedItems(newSelected);
 };

 const handleSelectAll = () => {
 if (selectedItems.size === stockItems.length) {
 setSelectedItems(new Set());
 } else {
 setSelectedItems(new Set(stockItems.map(i => i.id)));
 }
 };

 // Filter by criticidad and search (client-side for now)
 const filteredStock = useMemo(() => {
 let filtered = stockItems;

 if (criticidadFilter !== 'all') {
 filtered = filtered.filter(item => item.criticidad === criticidadFilter);
 }

 if (searchTerm) {
 const search = searchTerm.toLowerCase();
 filtered = filtered.filter(item =>
 // Primero buscar en los códigos reales del stock
 item.codigoPropio?.toLowerCase().includes(search) ||
 item.codigoProveedor?.toLowerCase().includes(search) ||
 item.descripcionItem?.toLowerCase().includes(search) ||
 // Fallback a datos del supplierItem
 item.supplierItem?.nombre?.toLowerCase().includes(search) ||
 item.supplierItem?.supplier?.name?.toLowerCase().includes(search) ||
 item.supplierItem?.codigoProveedor?.toLowerCase().includes(search) ||
 item.supplierItem?.supply?.code?.toLowerCase().includes(search) ||
 item.supplierItem?.supply?.name?.toLowerCase().includes(search)
 );
 }

 return filtered;
 }, [stockItems, criticidadFilter, searchTerm]);

 const formatCurrency = (value: number) => {
 return new Intl.NumberFormat('es-AR', {
 style: 'currency',
 currency: 'ARS',
 maximumFractionDigits: 0,
 }).format(value);
 };

 const getStockStatusBadge = (item: StockLocation) => {
 const cantidad = Number(item.cantidad || 0);
 const reservado = Number(item.cantidadReservada || 0);
 const minimo = Number(item.stockMinimo || 0);
 const maximo = Number(item.stockMaximo || 0);
 const disponible = cantidad - reservado;
 const enCamino = item.enCamino || 0;

 if (cantidad <= 0) {
 return <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">Sin Stock</Badge>;
 }
 if (minimo > 0 && (disponible + enCamino) < minimo) {
 return <Badge className="bg-warning-muted text-warning-muted-foreground border-warning-muted text-[10px]">Bajo</Badge>;
 }
 if (maximo > 0 && cantidad > maximo) {
 return <Badge className="bg-info-muted text-info-muted-foreground border-info-muted text-[10px]">Exceso</Badge>;
 }
 return <Badge className="bg-success-muted text-success border-success-muted text-[10px]">OK</Badge>;
 };

 return (
 <div className="w-full p-0">
 <div className="px-6 py-4">
 {/* Header */}
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <Package className="w-5 h-5 text-muted-foreground" />
 <h1 className="text-sm font-medium">Stock e Inventario</h1>
 {kpis && (
 <span className="text-xs text-muted-foreground">({kpis.totalItems} items)</span>
 )}
 </div>
 <div className="flex items-center gap-2">
 <Button
 variant="ghost"
 size="sm"
 onClick={handleRefresh}
 disabled={refreshing}
 className="h-8"
 >
 <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
 </Button>
 <Button
 size="sm"
 className="h-8 text-xs"
 onClick={() => window.location.href = '/administracion/compras/stock/ajustes'}
 >
 <Plus className="w-3.5 h-3.5 mr-1" />
 Ajuste
 </Button>
 </div>
 </div>

 {/* KPIs */}
 {kpis && (
 <div className="grid grid-cols-5 gap-3 mb-4">
 <Card
 className={cn('cursor-pointer transition-all duration-200 hover:shadow-md', alertaFilter === 'all' && 'ring-2 ring-primary')}
 onClick={() => setAlertaFilter('all')}
 >
 <CardContent className="p-3">
 <div className="flex items-center gap-2">
 <Boxes className="w-4 h-4 text-muted-foreground" />
 <div>
 <p className="text-xl font-bold">{kpis.totalItems}</p>
 <p className="text-[10px] text-muted-foreground">Total Items</p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="cursor-pointer">
 <CardContent className="p-3">
 <div className="flex items-center gap-2">
 <DollarSign className="w-4 h-4 text-success" />
 <div>
 <p className="text-xl font-bold">{formatCurrency(kpis.valorTotal)}</p>
 <p className="text-[10px] text-muted-foreground">Valor Total</p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card
 className={cn('cursor-pointer transition-all duration-200 hover:shadow-md', alertaFilter === 'bajo' && 'ring-2 ring-primary')}
 onClick={() => setAlertaFilter(alertaFilter === 'bajo' ? 'all' : 'bajo')}
 >
 <CardContent className="p-3">
 <div className="flex items-center gap-2">
 <TrendingDown className="w-4 h-4 text-warning-muted-foreground" />
 <div>
 <p className="text-xl font-bold text-warning-muted-foreground">{kpis.itemsBajoStock}</p>
 <p className="text-[10px] text-muted-foreground">Bajo Stock</p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="cursor-pointer">
 <CardContent className="p-3">
 <div className="flex items-center gap-2">
 <AlertCircle className="w-4 h-4 text-destructive" />
 <div>
 <p className="text-xl font-bold text-destructive">{kpis.itemsSinStock}</p>
 <p className="text-[10px] text-muted-foreground">Sin Stock</p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="cursor-pointer">
 <CardContent className="p-3">
 <div className="flex items-center gap-2">
 <Truck className="w-4 h-4 text-info-muted-foreground" />
 <div>
 <p className="text-xl font-bold text-info-muted-foreground">{formatCurrency(kpis.valorEnTransito)}</p>
 <p className="text-[10px] text-muted-foreground">En Transito</p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 )}

 {/* Filters */}
 <div className="flex items-center gap-3 mb-4">
 <div className="relative flex-1 max-w-sm">
 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
 <Input
 placeholder="Buscar item, proveedor, codigo..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
 className="h-8 pl-8 text-xs"
 />
 </div>

 <Select value={warehouseFilter} onValueChange={(v) => { setWarehouseFilter(v); setPage(1); }}>
 <SelectTrigger className="w-[160px] h-8 text-xs">
 <SelectValue placeholder="Deposito" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todos los depositos</SelectItem>
 {warehouses.map(wh => (
 <SelectItem key={wh.id} value={wh.id.toString()}>{wh.nombre}</SelectItem>
 ))}
 </SelectContent>
 </Select>

 <Select value={criticidadFilter} onValueChange={setCriticidadFilter}>
 <SelectTrigger className="w-[120px] h-8 text-xs">
 <SelectValue placeholder="Criticidad" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todas</SelectItem>
 <SelectItem value="CRITICO">Critico</SelectItem>
 <SelectItem value="A">A</SelectItem>
 <SelectItem value="B">B</SelectItem>
 <SelectItem value="C">C</SelectItem>
 </SelectContent>
 </Select>

 {hasActiveFilters && (
 <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
 <X className="w-3 h-3 mr-1" />
 Limpiar
 </Button>
 )}
 </div>

 {/* Selected actions */}
 {selectedItems.size > 0 && (
 <div className="flex items-center gap-2 mb-3 p-2 bg-muted/50 rounded-lg">
 <span className="text-xs text-muted-foreground">{selectedItems.size} seleccionados</span>
 <Button size="sm" variant="outline" className="h-7 text-xs">
 <Plus className="w-3 h-3 mr-1" />
 Crear OC
 </Button>
 <Button size="sm" variant="outline" className="h-7 text-xs">
 Ajuste Masivo
 </Button>
 <Button
 size="sm"
 variant="ghost"
 className="h-7 text-xs"
 onClick={() => setSelectedItems(new Set())}
 >
 Cancelar
 </Button>
 </div>
 )}

 {/* Items sin deposito - Banner */}
 {stockSinDeposito.length > 0 && (
 <div className="mb-4">
 <div
 className="flex items-center justify-between p-3 bg-warning-muted border border-warning-muted rounded-lg cursor-pointer hover:bg-warning-muted transition-colors"
 onClick={() => setShowSinDeposito(!showSinDeposito)}
 >
 <div className="flex items-center gap-2">
 <AlertTriangle className="w-4 h-4 text-warning-muted-foreground" />
 <span className="text-sm font-medium text-warning-muted-foreground ">
 {stockSinDeposito.length} items sin deposito asignado
 </span>
 <span className="text-xs text-warning-muted-foreground ">
 (click para {showSinDeposito ? 'ocultar' : 'ver y asignar'})
 </span>
 </div>
 <Badge variant="outline" className="bg-warning-muted text-warning-muted-foreground border-warning-muted">
 Pendiente
 </Badge>
 </div>

 {/* Lista de items sin deposito */}
 {showSinDeposito && (
 <div className="mt-2 border rounded-lg overflow-hidden">
 <Table>
 <TableHeader>
 <TableRow className="bg-warning-muted/50 ">
 <TableHead className="text-xs font-medium">Item</TableHead>
 <TableHead className="text-xs font-medium">Proveedor</TableHead>
 <TableHead className="text-xs font-medium text-right">Cantidad</TableHead>
 <TableHead className="text-xs font-medium text-right">Costo</TableHead>
 <TableHead className="text-xs font-medium w-[180px]">Asignar Deposito</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {stockSinDeposito.map((item) => (
 <TableRow key={item.id} className="hover:bg-warning-muted/30">
 <TableCell>
 <div>
 {/* Preferir descripcionItem, fallback a supplierItem.nombre */}
 <p className="text-xs font-medium">{item.descripcionItem || item.supplierItem?.nombre}</p>
 {(item.codigoProveedor || item.supplierItem?.codigoProveedor) && (
 <p className="text-[10px] text-muted-foreground">Cod: {item.codigoProveedor || item.supplierItem?.codigoProveedor}</p>
 )}
 </div>
 </TableCell>
 <TableCell className="text-xs">
 {item.supplierItem?.supplier?.name || '-'}
 </TableCell>
 <TableCell className="text-xs text-right font-medium">
 {item.cantidad.toLocaleString('es-AR')} {item.unidad || item.supplierItem?.unidad}
 </TableCell>
 <TableCell className="text-xs text-right">
 {formatCurrency(item.precioUnitario)}
 </TableCell>
 <TableCell>
 <Select
 onValueChange={(warehouseId) => handleAsignarDeposito(item.supplierItemId, parseInt(warehouseId))}
 disabled={assigningWarehouse === item.supplierItemId}
 >
 <SelectTrigger className="h-7 text-xs">
 {assigningWarehouse === item.supplierItemId ? (
 <Loader2 className="w-3 h-3 animate-spin" />
 ) : (
 <SelectValue placeholder="Seleccionar..." />
 )}
 </SelectTrigger>
 <SelectContent>
 {warehouses.map(wh => (
 <SelectItem key={wh.id} value={wh.id.toString()}>
 {wh.codigo} - {wh.nombre}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 )}
 </div>
 )}

 {/* Table */}
 {loading ? (
 <SkeletonTable rows={5} cols={14} />
 ) : filteredStock.length === 0 ? (
 <div className="text-center py-12">
 <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
 <p className="text-sm font-medium">No hay items en stock</p>
 <p className="text-xs text-muted-foreground mt-1">Los items aparecerán aquí cuando se registren movimientos de stock</p>
 {hasActiveFilters && (
 <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
 Limpiar filtros
 </Button>
 )}
 </div>
 ) : (
 <div className="border rounded-lg overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow className="bg-muted/30">
 <TableHead className="w-[40px]">
 <Checkbox
 checked={selectedItems.size === stockItems.length && stockItems.length > 0}
 onCheckedChange={handleSelectAll}
 />
 </TableHead>
 <TableHead className="text-xs font-medium w-[90px]">Cód. Interno</TableHead>
 <TableHead className="text-xs font-medium w-[90px]">Cód. Prov.</TableHead>
 <TableHead className="text-xs font-medium">Item</TableHead>
 <TableHead className="text-xs font-medium">Deposito</TableHead>
 <TableHead className="text-xs font-medium text-right">Stock</TableHead>
 <TableHead className="text-xs font-medium text-right">Reservado</TableHead>
 <TableHead className="text-xs font-medium text-right">En Camino</TableHead>
 <TableHead className="text-xs font-medium text-right">Disponible</TableHead>
 <TableHead className="text-xs font-medium text-right">Costo</TableHead>
 <TableHead className="text-xs font-medium text-right">Valor</TableHead>
 <TableHead className="text-xs font-medium text-center">Estado</TableHead>
 <TableHead className="text-xs font-medium text-center">Crit.</TableHead>
 <TableHead className="w-[50px]"></TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredStock.map((item) => {
 const cantidad = Number(item.cantidad || 0);
 const reservado = Number(item.cantidadReservada || 0);
 const costo = Number(item.costoUnitario || item.supplierItem?.precioUnitario || 0);
 const enCamino = item.enCamino || 0;
 const disponible = cantidad - reservado + enCamino;
 const valor = cantidad * costo;

 return (
 <TableRow
 key={item.id}
 className={cn('hover:bg-muted/30', item.alertas.sinStock ? 'bg-destructive/10' : item.alertas.stockBajo ? 'bg-warning-muted' : '')}
 >
 <TableCell>
 <Checkbox
 checked={selectedItems.has(item.id)}
 onCheckedChange={() => handleSelectItem(item.id)}
 />
 </TableCell>
 <TableCell className="text-xs font-mono">
 {/* Preferir código propio del stock, fallback a supply.code */}
 {item.codigoPropio || item.supplierItem?.supply?.code || (
 <span className="text-muted-foreground text-[10px]">-</span>
 )}
 </TableCell>
 <TableCell className="text-xs font-mono">
 {/* Preferir código proveedor del stock, fallback a supplierItem.codigoProveedor */}
 {item.codigoProveedor || item.supplierItem?.codigoProveedor || (
 <span className="text-muted-foreground text-[10px]">-</span>
 )}
 </TableCell>
 <TableCell>
 <div>
 {/* Preferir descripción del stock, fallback a supplierItem.nombre */}
 <p className="text-xs font-medium">{item.descripcionItem || item.supplierItem?.nombre}</p>
 <p className="text-[10px] text-muted-foreground">{item.supplierItem?.supplier?.name}</p>
 </div>
 </TableCell>
 <TableCell className="text-xs">{item.warehouse?.codigo}</TableCell>
 <TableCell className="text-xs text-right font-medium">
 {cantidad.toLocaleString('es-AR')} {item.supplierItem?.unidad}
 </TableCell>
 <TableCell className="text-xs text-right text-muted-foreground">
 {reservado > 0 ? reservado.toLocaleString('es-AR') : '-'}
 </TableCell>
 <TableCell className="text-xs text-right text-info-muted-foreground">
 {enCamino > 0 ? `+${enCamino.toLocaleString('es-AR')}` : '-'}
 </TableCell>
 <TableCell className="text-xs text-right font-medium">
 {disponible.toLocaleString('es-AR')}
 </TableCell>
 <TableCell className="text-xs text-right">
 {formatCurrency(costo)}
 </TableCell>
 <TableCell className="text-xs text-right font-medium">
 {formatCurrency(valor)}
 </TableCell>
 <TableCell className="text-center">
 {getStockStatusBadge(item)}
 </TableCell>
 <TableCell className="text-center">
 {item.criticidad && CRITICIDAD_CONFIG[item.criticidad] ? (
 <Badge className={cn(CRITICIDAD_CONFIG[item.criticidad].color, 'text-[10px]')}>
 {CRITICIDAD_CONFIG[item.criticidad].label}
 </Badge>
 ) : (
 <span className="text-[10px] text-muted-foreground">-</span>
 )}
 </TableCell>
 <TableCell>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="icon" className="h-7 w-7">
 <MoreHorizontal className="w-3.5 h-3.5" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-40">
 <DropdownMenuItem onClick={() => handleViewKardex(item)}>
 <History className="w-3.5 h-3.5 mr-2" />
 Ver Kardex
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => handleConfigStock(item)}>
 <Settings className="w-3.5 h-3.5 mr-2" />
 Configurar
 </DropdownMenuItem>
 <DropdownMenuSeparator />
 <DropdownMenuItem>
 <ArrowRightLeft className="w-3.5 h-3.5 mr-2" />
 Transferir
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </div>
 )}

 {/* Pagination */}
 {totalPages > 1 && (
 <div className="flex items-center justify-between mt-4">
 <p className="text-xs text-muted-foreground">
 Pagina {page} de {totalPages}
 </p>
 <div className="flex items-center gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={() => setPage(p => Math.max(1, p - 1))}
 disabled={page === 1}
 className="h-8"
 >
 Anterior
 </Button>
 <Button
 variant="outline"
 size="sm"
 onClick={() => setPage(p => Math.min(totalPages, p + 1))}
 disabled={page === totalPages}
 className="h-8"
 >
 Siguiente
 </Button>
 </div>
 </div>
 )}
 </div>

 {/* Config Modal */}
 <StockConfigModal
 open={configModalOpen}
 onOpenChange={setConfigModalOpen}
 stockLocation={selectedForConfig}
 onSave={() => {
 invalidateStock();
 invalidateKPIs();
 }}
 />
 </div>
 );
}
