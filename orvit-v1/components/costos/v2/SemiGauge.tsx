'use client';

import { PieChart, Pie, Cell } from 'recharts';
import { cn } from '@/lib/utils';

interface SemiGaugeProps {
  /** Porcentaje a mostrar (0-100). Se trunca automáticamente al rango. */
  pct: number;
  /** Etiqueta debajo del valor */
  label: string;
  /** Meta a mostrar (ej: "<35%", "100%"). Opcional. SemiGauge agrega "Meta: " como prefijo. */
  meta?: string;
  /** Color de relleno del arco */
  color: string;
  /** Tamaño del gauge */
  size?: 'sm' | 'md';
  /** Valor alternativo a mostrar en lugar del % calculado */
  displayValue?: string;
}

/**
 * Gauge semi-circular basado en recharts PieChart.
 *
 * Layout:
 *   - PieChart con cy="50%" renderiza el círculo completo
 *   - El div padre tiene overflow:hidden y altura = outer+margin, mostrando sólo la mitad superior
 *   - El valor y la etiqueta van DEBAJO del contenedor clipeado (sin superposición con el arco)
 */
export function SemiGauge({
  pct,
  label,
  meta,
  color,
  size = 'md',
  displayValue,
}: SemiGaugeProps) {
  const capped = Math.min(100, Math.max(0, pct));

  const dims = size === 'sm'
    ? { w: 110, inner: 32, outer: 48, textSize: 'text-sm' }
    : { w: 150, inner: 45, outer: 65, textSize: 'text-lg' };

  // El contenedor muestra sólo la mitad superior del círculo (y = 0..outer+margin)
  const containerH = dims.outer + 6;
  // El chart tiene el doble de alto: cy="50%" ubica el centro justo en containerH
  const chartH = containerH * 2;

  const bgData = [{ value: 100 }];
  const fgData = [{ value: capped }, { value: 100 - capped }];

  return (
    <div className="flex flex-col items-center">
      {/* Semi-círculo — clipea en la línea plana */}
      <div style={{ width: dims.w, height: containerH, overflow: 'hidden' }}>
        <PieChart
          width={dims.w}
          height={chartH}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          {/* Fondo gris */}
          <Pie
            data={bgData}
            cx="50%"
            cy="50%"
            innerRadius={dims.inner}
            outerRadius={dims.outer}
            startAngle={180}
            endAngle={0}
            dataKey="value"
            strokeWidth={0}
          >
            <Cell fill="hsl(var(--muted))" />
          </Pie>
          {/* Arco coloreado */}
          <Pie
            data={fgData}
            cx="50%"
            cy="50%"
            innerRadius={dims.inner}
            outerRadius={dims.outer}
            startAngle={180}
            endAngle={0}
            dataKey="value"
            strokeWidth={0}
          >
            <Cell fill={color} />
            <Cell fill="transparent" />
          </Pie>
        </PieChart>
      </div>

      {/* Valor — justo debajo de la línea plana, sin superposición */}
      <p className={cn('font-bold leading-none mt-1', dims.textSize)}>
        {displayValue ?? `${capped.toFixed(1)}%`}
      </p>

      {/* Etiqueta y meta */}
      <p className="text-xs font-medium mt-1.5 text-center leading-tight px-2 max-w-[130px]">
        {label}
      </p>
      {meta && (
        <p className="text-xs text-muted-foreground mt-0.5">Meta: {meta}</p>
      )}
    </div>
  );
}
