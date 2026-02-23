'use client';

import { formatNumber } from '@/lib/utils';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Cell,
} from 'recharts';

interface ProductPoint {
  id: string;
  name: string;
  code: string;
  costPrice: number;
  salePrice: number;
  margin: number;
  sales: number;
  velocity: 'ALTA' | 'MEDIA' | 'BAJA';
}

interface MarginMatrixChartProps {
  products: {
    product: { id: string; name: string; code: string };
    metrics: {
      costPrice: number;
      salePrice: number;
      averageMargin: number;
      totalSales: number;
      velocity: 'ALTA' | 'MEDIA' | 'BAJA';
    };
  }[];
  marginMin?: number;
  marginMax?: number;
  onProductClick?: (productId: string) => void;
}

export function MarginMatrixChart({
  products,
  marginMin = 20,
  marginMax = 50,
  onProductClick,
}: MarginMatrixChartProps) {
  // Transformar datos para el gráfico
  const data: ProductPoint[] = products.map((p) => ({
    id: p.product.id,
    name: p.product.name,
    code: p.product.code,
    costPrice: p.metrics.costPrice,
    salePrice: p.metrics.salePrice,
    margin: p.metrics.averageMargin,
    sales: p.metrics.totalSales,
    velocity: p.metrics.velocity,
  }));

  // Calcular rangos para los ejes
  const maxCost = Math.max(...data.map((d) => d.costPrice)) * 1.1;
  const maxPrice = Math.max(...data.map((d) => d.salePrice)) * 1.1;

  // Función para determinar el color según el margen
  const getColorByMargin = (margin: number): string => {
    if (margin < 0) return '#ef4444'; // red-500
    if (margin < marginMin) return '#f97316'; // orange-500
    if (margin >= marginMin && margin <= marginMax) return '#10b981'; // green-500
    return '#3b82f6'; // blue-500
  };

  // Función para determinar el tamaño según las ventas
  const getSizeByVolume = (sales: number, maxSales: number): number => {
    const normalizedSize = (sales / maxSales) * 200 + 50;
    return Math.min(normalizedSize, 300);
  };

  const maxSales = Math.max(...data.map((d) => d.sales));

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload as ProductPoint;
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
          <p className="font-semibold mb-1">
            {point.code} - {point.name}
          </p>
          <div className="space-y-1 text-xs">
            <p>
              <span className="text-muted-foreground">Costo:</span>{' '}
              <span className="font-medium">${formatNumber(point.costPrice, 2)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Precio:</span>{' '}
              <span className="font-medium">${formatNumber(point.salePrice, 2)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Margen:</span>{' '}
              <span className="font-medium">{formatNumber(point.margin, 2)}%</span>
            </p>
            <p>
              <span className="text-muted-foreground">Ventas:</span>{' '}
              <span className="font-medium">${formatNumber(point.sales, 2)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Velocidad:</span>{' '}
              <span className="font-medium">{point.velocity}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[500px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          onClick={(e) => {
            if (e && e.activePayload && e.activePayload.length > 0) {
              const point = e.activePayload[0].payload as ProductPoint;
              if (onProductClick) {
                onProductClick(point.id);
              }
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />

          {/* Reference Area: Zona de Pérdida (Precio < Costo) */}
          <ReferenceArea
            x1={0}
            y1={0}
            x2={maxCost}
            y2={maxCost}
            fill="#ef4444"
            fillOpacity={0.1}
            label={{
              value: 'Zona de Pérdida',
              position: 'insideTopLeft',
              fontSize: 10,
              fill: '#ef4444',
            }}
          />

          {/* Reference Line: Break-even (Precio = Costo) */}
          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: maxCost, y: maxCost },
            ]}
            stroke="#ef4444"
            strokeDasharray="5 5"
            strokeWidth={2}
          />

          <XAxis
            type="number"
            dataKey="costPrice"
            name="Costo"
            unit="$"
            domain={[0, maxCost]}
            label={{
              value: 'Precio de Costo ($)',
              position: 'insideBottom',
              offset: -10,
            }}
          />
          <YAxis
            type="number"
            dataKey="salePrice"
            name="Precio"
            unit="$"
            domain={[0, maxPrice]}
            label={{
              value: 'Precio de Venta ($)',
              angle: -90,
              position: 'insideLeft',
            }}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />

          <Scatter
            data={data}
            fill="#8884d8"
            cursor="pointer"
            shape="circle"
            animationDuration={500}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getColorByMargin(entry.margin)}
                r={Math.max(getSizeByVolume(entry.sales, maxSales) / 20, 4)}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Leyenda */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-destructive" />
          <span>Negativo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span>Bajo Mínimo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-success" />
          <span>Óptimo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span>Sobre Máximo</span>
        </div>
        <div className="ml-4 text-muted-foreground">
          <span>Tamaño del punto = Volumen de ventas</span>
        </div>
      </div>
    </div>
  );
}
