'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, 
  DollarSign, 
  TrendingUp,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { formatCurrency, formatPercentage } from './utils/metrics';

interface TopProductsProps {
  companyId: string;
  selectedMonth?: string;
}

interface ProductData {
  id: number;
  name: string;
  totalQuantity: number;
  totalRevenue: number;
  unitPrice: number;
  salesCount: number;
  estimatedCost?: number;
  margin?: number;
  marginPct?: number;
}

interface TopProductsData {
  topByQuantity: ProductData[];
  topByRevenue: ProductData[];
  topByMargin: ProductData[];
  period: string;
}

export function TopProducts({ companyId, selectedMonth }: TopProductsProps) {
  const [data, setData] = useState<TopProductsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('quantity');

  useEffect(() => {
    const fetchTopProducts = async () => {
      try {
        setIsLoading(true);
        const currentMonth = selectedMonth || new Date().toISOString().slice(0, 7);
        const response = await fetch(`/api/dashboard/top-products?companyId=${companyId}&month=${currentMonth}&limit=10`);
        if (response.ok) {
          const productsData = await response.json();
          setData(productsData);
        } else {
          console.error('Error fetching top products:', response.status);
        }
      } catch (error) {
        console.error('Error fetching top products:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopProducts();
  }, [companyId, selectedMonth]);

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Verificar si no hay datos útiles
  const hasNoProducts = !data || 
    (data.topByQuantity.length === 0 && data.topByRevenue.length === 0) ||
    (data.topByQuantity.every(p => p.totalQuantity === 0) && data.topByRevenue.every(p => p.totalRevenue === 0));

  if (hasNoProducts) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Sin ventas de productos</h3>
            <p className="text-muted-foreground mb-4">
              No se encontraron ventas de productos para <strong>{selectedMonth}</strong>.
            </p>
            <div className="bg-warning-muted border border-warning-muted rounded-lg p-3">
              <p className="text-sm text-warning-muted-foreground">
                💡 <strong>Sugerencia:</strong> Para ver productos aquí, necesitas registrar ventas en el módulo de Ventas Mensuales.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderProductList = (products: ProductData[], type: 'quantity' | 'revenue' | 'margin') => {
    return (
      <div className="space-y-3">
        {products.map((product, index) => (
          <div
            key={product.id}
            className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0 w-6 h-6 bg-muted rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-foreground">
                  {index + 1}
                </span>
              </div>
              
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {product.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs bg-info-muted text-info-muted-foreground border-info-muted">
                    {product.salesCount} ventas
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    ${formatCurrency(product.unitPrice)} c/u
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-right">
                <p className="text-sm font-bold text-foreground">
                  {type === 'quantity' && `${product.totalQuantity} unidades`}
                  {type === 'revenue' && formatCurrency(product.totalRevenue)}
                  {type === 'margin' && formatCurrency(product.margin || 0)}
                </p>
                {type === 'margin' && (
                  <p className="text-xs text-muted-foreground">
                    {formatPercentage(product.marginPct || 0)} margen
                  </p>
                )}
                {type === 'revenue' && (
                  <p className="text-xs text-muted-foreground">
                    {product.totalQuantity} unidades
                  </p>
                )}
                {type === 'quantity' && (
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(product.totalRevenue)} total
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold text-foreground">
              Top Productos
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {data.period}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Contraer
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Expandir
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isExpanded ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="quantity" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Por Cantidad
              </TabsTrigger>
              <TabsTrigger value="revenue" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Por Ingresos
              </TabsTrigger>
              <TabsTrigger value="margin" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Por Margen
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="quantity" className="mt-4">
              {renderProductList(data.topByQuantity, 'quantity')}
            </TabsContent>
            
            <TabsContent value="revenue" className="mt-4">
              {renderProductList(data.topByRevenue, 'revenue')}
            </TabsContent>
            
            <TabsContent value="margin" className="mt-4">
              {renderProductList(data.topByMargin, 'margin')}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-3">
            {data.topByQuantity.slice(0, 5).map((product, index) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-muted rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-foreground">
                      {index + 1}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {product.totalQuantity} unidades • {formatCurrency(product.totalRevenue)}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs bg-success-muted text-success border-success-muted">
                  {product.salesCount} ventas
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
