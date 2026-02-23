---
name: orvit-charts
description: Gráficos y dashboards en Orvit — Chart.js (react-chartjs-2) y Recharts con el sistema de colores dinámicos del usuario. Usar al crear widgets de dashboard, KPIs, gráficos de barras/líneas/torta.
---

# Charts & Dashboard — Orvit Patterns

## Librerías disponibles

- **Chart.js** via `react-chartjs-2` — barras, líneas, torta, doughnut
- **Recharts** — área, líneas compuestas, scatter
- **Usar siempre** `userColors` del sistema de colores — nunca hardcodear hex

---

## Sistema de colores — obtenerlos

```tsx
// Siempre consumir los colores del usuario desde CompanyContext o props
import { useCompany } from '@/contexts/CompanyContext';

const { userColors } = useCompany();
// userColors.chart1  → azul/indigo (primario)
// userColors.chart2  → violeta
// userColors.chart3  → rosa/magenta
// userColors.chart4  → ámbar/naranja (advertencia)
// userColors.chart5  → verde/esmeralda (éxito)
// userColors.chart6  → cyan
// userColors.kpiPositive → verde #10b981
// userColors.kpiNegative → rojo #ef4444
// userColors.kpiNeutral  → gris #64748b
```

---

## Chart.js — Gráfico de barras

```tsx
'use client';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend,
} from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Props {
  data: { label: string; value: number }[];
  title?: string;
  userColors: UserColorPreferences;
}

export function BarChart({ data, title, userColors }: Props) {
  const chartData = {
    labels: data.map(d => d.label),
    datasets: [{
      label: title ?? 'Valor',
      data: data.map(d => d.value),
      backgroundColor: `${userColors.chart1}80`,  // 50% opacidad
      borderColor: userColors.chart1,
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${formatCurrency(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { callback: (v: number) => formatShortNumber(v) },
      },
    },
  };

  return (
    <div className="h-[250px]">
      <Bar data={chartData} options={options} />
    </div>
  );
}
```

---

## Chart.js — Gráfico de líneas (tendencia)

```tsx
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, ... } from 'chart.js';

const chartData = {
  labels,
  datasets: [
    {
      label: 'Ventas',
      data: salesData,
      borderColor: userColors.chart1,
      backgroundColor: `${userColors.chart1}15`,
      tension: 0.3,
      fill: true,
    },
    {
      label: 'Costos',
      data: costsData,
      borderColor: userColors.kpiNegative,
      backgroundColor: `${userColors.kpiNegative}10`,
      tension: 0.3,
      fill: true,
    },
  ],
};
```

---

## Chart.js — Doughnut / Torta

```tsx
import { Doughnut } from 'react-chartjs-2';

const chartData = {
  labels: segments.map(s => s.label),
  datasets: [{
    data: segments.map(s => s.value),
    backgroundColor: [
      `${userColors.chart1}CC`,
      `${userColors.chart2}CC`,
      `${userColors.chart3}CC`,
      `${userColors.chart4}CC`,
      `${userColors.chart5}CC`,
    ],
    borderWidth: 0,
  }],
};

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right' as const,
      labels: { boxWidth: 12, font: { size: 12 } },
    },
  },
  cutout: '65%',  // doughnut vs pie
};
```

---

## Recharts — AreaChart (tendencia suavizada)

```tsx
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={250}>
  <AreaChart data={data}>
    <defs>
      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={userColors.chart1} stopOpacity={0.3} />
        <stop offset="95%" stopColor={userColors.chart1} stopOpacity={0} />
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
    <YAxis tick={{ fontSize: 12 }} tickFormatter={formatShortNumber} />
    <Tooltip formatter={(value: number) => formatCurrency(value)} />
    <Area
      type="monotone"
      dataKey="value"
      stroke={userColors.chart1}
      strokeWidth={2}
      fill="url(#colorValue)"
    />
  </AreaChart>
</ResponsiveContainer>
```

---

## Widget de Dashboard — estructura

```tsx
// Siempre envolver en Card con header y contenido
<Card>
  <CardHeader className="pb-2">
    <div className="flex items-center justify-between">
      <CardTitle className="text-sm font-medium flex items-center gap-2">
        <TrendingUp className="h-4 w-4" style={{ color: userColors.chart1 }} />
        Ventas del Mes
      </CardTitle>
      <Badge variant="secondary" className="text-xs">
        {format(new Date(), 'MMM yyyy', { locale: es })}
      </Badge>
    </div>
  </CardHeader>
  <CardContent className="pt-0">
    {/* número principal */}
    <div className="text-2xl font-bold mb-1">{formatCurrency(total)}</div>
    <p className="text-xs text-muted-foreground mb-4">
      <span className="font-medium" style={{ color: userColors.kpiPositive }}>
        +{pct}%
      </span>{' '}
      vs mes anterior
    </p>
    {/* gráfico */}
    <BarChart data={chartData} userColors={userColors} />
  </CardContent>
</Card>
```

---

## Formateo de números para gráficos

```tsx
// Formato corto para ejes (1.2K, 3.5M)
const formatShortNumber = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
};

// Moneda (para tooltips y KPIs)
const formatCurrency = (n: number): string =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
```

---

## Anti-patterns

- ❌ Colores hardcodeados como `'#6366f1'` — siempre `userColors.chart1`
- ❌ Gráfico sin `maintainAspectRatio: false` y sin altura fija en el wrapper `<div className="h-[250px]">`
- ❌ `<ResponsiveContainer>` sin `width="100%"` — se rompe en resize
- ❌ Tooltips sin formateo de moneda/fecha — siempre formatear los valores
- ❌ Más de 6 colores distintos en un gráfico — dificulta la lectura
