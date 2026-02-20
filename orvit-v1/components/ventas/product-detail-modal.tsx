'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Package,
  MapPin,
  Scale,
  Ruler,
  AlertTriangle,
  Factory,
  ShoppingCart,
  Pencil,
  DollarSign,
  Clock,
  Tag,
  Barcode,
  TrendingUp,
  TrendingDown,
  History,
  Copy,
  Download,
  Edit,
  Warehouse,
  Info,
  CheckCircle2,
  XCircle,
  Calendar,
  User,
  FileText,
  Image as ImageIcon,
  BarChart3,
  Settings,
} from 'lucide-react';
import { Product } from '@/lib/types/sales';
import { toast } from 'sonner';
import { ProductStockHistory } from './product-stock-history';
import { ProductCostHistory } from './product-cost-history';
import { ProductPriceHistory } from './product-price-history';
import { MarginIndicator, MarginBar } from './margin-indicator';
import { TagDisplay } from '@/components/ui/tag-input';

interface ProductDetailModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (product: Product) => void;
}

// Opciones de moneda
const CURRENCY_OPTIONS: Record<string, { label: string; symbol: string }> = {
  ARS: { label: 'Pesos', symbol: '$' },
  USD: { label: 'Dolares', symbol: 'US$' },
  EUR: { label: 'Euros', symbol: 'E' },
};

// Tipos de costo
const COST_TYPE_LABELS: Record<string, { label: string; icon: typeof Pencil; color: string; bg: string }> = {
  MANUAL: { label: 'Manual', icon: Pencil, color: 'text-warning-muted-foreground', bg: 'bg-warning-muted' },
  PRODUCTION: { label: 'Produccion', icon: Factory, color: 'text-primary', bg: 'bg-primary/10' },
  PURCHASE: { label: 'Compra', icon: ShoppingCart, color: 'text-info-muted-foreground', bg: 'bg-info-muted' },
};

export function ProductDetailModal({ product, isOpen, onClose, onEdit }: ProductDetailModalProps) {
  const [activeTab, setActiveTab] = useState('general');
  const [showStockHistory, setShowStockHistory] = useState(false);
  const [showCostHistory, setShowCostHistory] = useState(false);
  const [showPriceHistory, setShowPriceHistory] = useState(false);

  const costCurrency = product.costCurrency || 'ARS';
  const saleCurrency = product.saleCurrency || 'ARS';
  const currencyInfo = CURRENCY_OPTIONS[costCurrency] || CURRENCY_OPTIONS.ARS;

  const formatCurrency = (amount: number, currency?: string) => {
    const curr = currency || costCurrency;
    const symbol = CURRENCY_OPTIONS[curr]?.symbol || '$';
    return `${symbol} ${new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)}`;
  };

  const getStockStatus = () => {
    const current = product.currentStock || 0;
    const min = product.minStock || 0;

    if (current === 0) {
      return { color: 'text-destructive', bg: 'bg-destructive/10', label: 'Sin Stock', icon: XCircle, progress: 0 };
    }
    if (current <= min) {
      return { color: 'text-destructive', bg: 'bg-destructive/10', label: 'Stock Bajo', icon: AlertTriangle, progress: (current / min) * 100 };
    }
    if (current <= min * 1.5) {
      return { color: 'text-warning-muted-foreground', bg: 'bg-warning-muted', label: 'Stock Medio', icon: AlertTriangle, progress: Math.min((current / (min * 2)) * 100, 100) };
    }
    return { color: 'text-success', bg: 'bg-success-muted', label: 'Stock OK', icon: CheckCircle2, progress: 100 };
  };

  const stockStatus = getStockStatus();
  const StockIcon = stockStatus.icon;

  const costType = product.costType || 'MANUAL';
  const costInfo = COST_TYPE_LABELS[costType] || COST_TYPE_LABELS.MANUAL;
  const CostIcon = costInfo.icon;

  // Calcular margen si hay precio de venta
  const hasMargin = product.costPrice && product.costPrice > 0 && product.salePrice && product.salePrice > 0;
  const margin = hasMargin ? ((product.salePrice! - product.costPrice) / product.costPrice) * 100 : null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(product.code);
    toast.success('Codigo copiado al portapapeles');
  };

  const handleDuplicate = async () => {
    try {
      const response = await fetch(`/api/products/${product.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Error duplicando producto');
      const data = await response.json();
      toast.success(`Producto duplicado: ${data.product.name}`);
      onClose();
    } catch (error) {
      toast.error('Error al duplicar el producto');
    }
  };

  const handleExport = () => {
    window.open(`/api/products/export?productId=${product.id}`, '_blank');
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent size="xl">
          {/* Header con info principal */}
          <DialogHeader className="pb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={product.isActive ? 'default' : 'secondary'} className="text-xs">
                    {product.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {product.category?.name || 'Sin categoria'}
                  </Badge>
                  {product.costType && (
                    <Badge className={cn('text-xs border-0', costInfo.bg, costInfo.color)}>
                      <CostIcon className="w-3 h-3 mr-1" />
                      {costInfo.label}
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-xl font-bold truncate">{product.name}</DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {product.code}
                  </code>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyCode}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Imagen miniatura si existe */}
              {product.images && Array.isArray(product.images) && product.images.length > 0 && (
                <div className="w-20 h-20 rounded-lg border overflow-hidden bg-muted flex-shrink-0">
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            {/* Stats rapidos */}
            <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Costo</p>
                <p className="text-lg font-bold text-success">{formatCurrency(product.costPrice)}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Venta</p>
                <p className="text-lg font-bold text-info-muted-foreground">
                  {product.salePrice ? formatCurrency(product.salePrice, saleCurrency) : '-'}
                </p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Margen</p>
                <p className={cn('text-lg font-bold', margin && margin > 0 ? 'text-success' : margin && margin < 0 ? 'text-destructive' : '')}>
                  {margin ? `${margin.toFixed(1)}%` : '-'}
                </p>
              </div>
              <div className={cn('text-center p-2 rounded-lg', stockStatus.bg)}>
                <p className="text-xs text-muted-foreground">Stock</p>
                <p className={cn('text-lg font-bold', stockStatus.color)}>
                  {product.currentStock} <span className="text-xs font-normal">{product.unit}</span>
                </p>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="pt-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start overflow-x-auto mb-4">
                <TabsTrigger value="general" className="text-xs">
                  <Info className="w-3.5 h-3.5 mr-1.5" />
                  General
                </TabsTrigger>
                <TabsTrigger value="pricing" className="text-xs">
                  <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                  Precios
                </TabsTrigger>
                <TabsTrigger value="stock" className="text-xs">
                  <Warehouse className="w-3.5 h-3.5 mr-1.5" />
                  Stock
                </TabsTrigger>
                <TabsTrigger value="specs" className="text-xs">
                  <Settings className="w-3.5 h-3.5 mr-1.5" />
                  Detalles
                </TabsTrigger>
              </TabsList>

              {/* Tab General */}
              <TabsContent value="general" className="space-y-4">
                {/* Descripcion */}
                {product.description && (
                  <div className="p-4 rounded-lg border bg-card">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Descripcion
                    </h4>
                    <p className="text-sm">{product.description}</p>
                  </div>
                )}

                {/* Codigos */}
                <div className="p-4 rounded-lg border bg-card">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Barcode className="w-4 h-4" />
                    Codigos e Identificadores
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Codigo Interno</p>
                      <p className="font-mono font-medium">{product.code}</p>
                    </div>
                    {product.barcode && (
                      <div>
                        <p className="text-xs text-muted-foreground">Codigo de Barras</p>
                        <p className="font-mono font-medium">{product.barcode}</p>
                      </div>
                    )}
                    {product.sku && (
                      <div>
                        <p className="text-xs text-muted-foreground">SKU</p>
                        <p className="font-mono font-medium">{product.sku}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {product.tags && Array.isArray(product.tags) && product.tags.length > 0 && (
                  <div className="p-4 rounded-lg border bg-card">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      Etiquetas
                    </h4>
                    <TagDisplay tags={product.tags as string[]} />
                  </div>
                )}

                {/* Origen del Producto */}
                {(product.recipe || product.purchaseInput) && (
                  <div className="p-4 rounded-lg border bg-card">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      {product.costType === 'PRODUCTION' ? (
                        <Factory className="w-4 h-4 text-purple-500" />
                      ) : (
                        <ShoppingCart className="w-4 h-4 text-info-muted-foreground" />
                      )}
                      Origen del Costo
                    </h4>
                    {product.recipe && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50">
                        <div>
                          <p className="text-xs text-purple-600">Receta de Produccion</p>
                          <p className="font-medium">{product.recipe.name}</p>
                        </div>
                        {product.recipe.totalCost && (
                          <p className="font-semibold text-purple-600">
                            {formatCurrency(product.recipe.totalCost)}
                          </p>
                        )}
                      </div>
                    )}
                    {product.purchaseInput && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-info-muted">
                        <div>
                          <p className="text-xs text-info-muted-foreground">Insumo de Compra</p>
                          <p className="font-medium">{product.purchaseInput.name}</p>
                        </div>
                        {product.purchaseInput.currentPrice && (
                          <p className="font-semibold text-info-muted-foreground">
                            {formatCurrency(product.purchaseInput.currentPrice)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Info del sistema */}
                <div className="p-4 rounded-lg border bg-card">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Informacion del Sistema
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Creado</p>
                      <p>{new Date(product.createdAt).toLocaleDateString('es-AR', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Actualizado</p>
                      <p>{new Date(product.updatedAt).toLocaleDateString('es-AR', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Tab Precios */}
              <TabsContent value="pricing" className="space-y-4">
                {/* Precios */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground mb-1">Precio de Costo</p>
                    <p className="text-2xl font-bold text-success">{formatCurrency(product.costPrice)}</p>
                    <p className="text-xs text-muted-foreground">{currencyInfo.label}</p>
                    {product.lastCostUpdate && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Actualizado: {new Date(product.lastCostUpdate).toLocaleDateString('es-AR')}
                      </p>
                    )}
                  </div>
                  <div className="p-4 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground mb-1">Precio de Venta</p>
                    {product.salePrice ? (
                      <>
                        <p className="text-2xl font-bold text-info-muted-foreground">{formatCurrency(product.salePrice, saleCurrency)}</p>
                        <p className="text-xs text-muted-foreground">{CURRENCY_OPTIONS[saleCurrency]?.label || saleCurrency}</p>
                      </>
                    ) : (
                      <p className="text-lg text-muted-foreground">No definido</p>
                    )}
                  </div>
                </div>

                {/* Indicador de Margen */}
                {hasMargin && (
                  <div className="p-4 rounded-lg border bg-card">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Analisis de Margen
                    </h4>
                    <div className="space-y-4">
                      <MarginIndicator
                        costPrice={product.costPrice}
                        salePrice={product.salePrice!}
                        costCurrency={costCurrency}
                        saleCurrency={saleCurrency}
                        marginMin={product.marginMin}
                        marginMax={product.marginMax}
                        size="lg"
                      />
                      <MarginBar
                        current={margin!}
                        min={product.marginMin}
                        max={product.marginMax}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0%</span>
                        {product.marginMin && <span className="text-destructive">Min: {product.marginMin}%</span>}
                        {product.marginMax && <span className="text-info-muted-foreground">Max: {product.marginMax}%</span>}
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Limites de margen */}
                {(product.marginMin || product.marginMax) && (
                  <div className="p-4 rounded-lg border bg-card">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">Limites de Margen Configurados</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-destructive/10">
                        <p className="text-xs text-destructive">Margen Minimo</p>
                        <p className="text-lg font-bold text-destructive">{product.marginMin || '-'}%</p>
                      </div>
                      <div className="p-3 rounded-lg bg-info-muted">
                        <p className="text-xs text-info-muted-foreground">Margen Maximo</p>
                        <p className="text-lg font-bold text-info-muted-foreground">{product.marginMax || '-'}%</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botones historial de precios */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowCostHistory(true)}
                  >
                    <History className="w-4 h-4 mr-2" />
                    Historial de Costos
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowPriceHistory(true)}
                  >
                    <History className="w-4 h-4 mr-2" />
                    Historial de Precios
                  </Button>
                </div>
              </TabsContent>

              {/* Tab Stock */}
              <TabsContent value="stock" className="space-y-4">
                {/* Estado del stock */}
                <div className={cn('p-4 rounded-lg border', stockStatus.bg)}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <StockIcon className={cn('w-5 h-5', stockStatus.color)} />
                      <span className={cn('font-medium', stockStatus.color)}>{stockStatus.label}</span>
                    </div>
                    <Badge variant="outline">{product.unit}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Stock Actual</p>
                      <p className="text-3xl font-bold">{product.currentStock}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Stock Minimo</p>
                      <p className="text-3xl font-bold text-muted-foreground">{product.minStock}</p>
                    </div>
                  </div>
                  <Progress value={stockStatus.progress} className="h-2" />
                </div>

                {/* Ubicacion */}
                {product.location && (
                  <div className="p-4 rounded-lg border bg-card">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Ubicacion en Almacen
                    </h4>
                    <p className="text-lg font-medium">{product.location}</p>
                  </div>
                )}

                {/* Trazabilidad */}
                {(product.trackBatches || product.trackExpiration) && (
                  <div className="p-4 rounded-lg border bg-card">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">Trazabilidad</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Seguimiento de Lotes</span>
                        <Badge variant={product.trackBatches ? 'default' : 'secondary'}>
                          {product.trackBatches ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Control de Vencimiento</span>
                        <Badge variant={product.trackExpiration ? 'default' : 'secondary'}>
                          {product.trackExpiration ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}

                {/* Alerta de stock bajo */}
                {product.currentStock <= product.minStock && (
                  <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/10">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-destructive">Stock Bajo - Se recomienda reabastecer</p>
                        <p className="text-sm text-destructive mt-1">
                          El stock actual ({product.currentStock} {product.unit}) esta en o por debajo del minimo ({product.minStock} {product.unit}).
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Boton historial de stock */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowStockHistory(true)}
                >
                  <History className="w-4 h-4 mr-2" />
                  Ver Historial de Movimientos
                </Button>
              </TabsContent>

              {/* Tab Especificaciones */}
              <TabsContent value="specs" className="space-y-4">
                {/* Especificaciones fisicas */}
                <div className="p-4 rounded-lg border bg-card">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Ruler className="w-4 h-4" />
                    Especificaciones Fisicas
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Scale className="w-4 h-4" />
                        <span className="text-xs">Peso</span>
                      </div>
                      <p className="text-lg font-medium">{product.weight || 0} kg</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Ruler className="w-4 h-4" />
                        <span className="text-xs">Volumen</span>
                      </div>
                      <p className="text-lg font-medium">
                        {product.volume || 0} {product.volumeUnit === 'metros_cuadrados' ? 'm2' : 'm'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bloques por m2 */}
                {product.blocksPerM2 && (
                  <div className="p-4 rounded-lg border bg-card">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Cobertura</h4>
                    <p className="text-xl font-bold">{product.blocksPerM2} <span className="text-sm font-normal text-muted-foreground">unidades/m2</span></p>
                  </div>
                )}

                {/* Imagenes */}
                {product.images && Array.isArray(product.images) && product.images.length > 0 && (
                  <div className="p-4 rounded-lg border bg-card">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Imagenes ({product.images.length})
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {product.images.map((img, idx) => (
                        <div key={idx} className="aspect-square rounded-lg border overflow-hidden bg-muted">
                          <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Archivos */}
                {product.files && Array.isArray(product.files) && product.files.length > 0 && (
                  <div className="p-4 rounded-lg border bg-card">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Archivos Adjuntos
                    </h4>
                    <p className="text-sm">{product.files.length} archivo(s)</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </DialogBody>

          <DialogFooter className="border-t pt-4 flex-shrink-0">
            <div className="flex items-center justify-between w-full">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDuplicate}>
                  <Copy className="w-4 h-4 mr-1" />
                  Duplicar
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cerrar
                </Button>
                {onEdit && (
                  <Button onClick={() => onEdit(product)}>
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modales de historial */}
      <ProductStockHistory
        open={showStockHistory}
        onOpenChange={setShowStockHistory}
        productId={product.id}
        productName={product.name}
        currentStock={product.currentStock}
        unit={product.unit}
      />

      <ProductCostHistory
        open={showCostHistory}
        onOpenChange={setShowCostHistory}
        productId={product.id}
        productName={product.name}
        currentCost={product.costPrice}
        currency={costCurrency}
      />

      <ProductPriceHistory
        open={showPriceHistory}
        onOpenChange={setShowPriceHistory}
        productId={product.id}
        productName={product.name}
        currentPrice={product.salePrice ?? null}
        currency={saleCurrency}
      />
    </>
  );
}
