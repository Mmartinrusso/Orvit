import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartEmpty, ChartTooltip } from './chart-utils';

type Point = { x: string; y: number };

export function AreaTrend({
  data,
  isLoading,
  height = 220,
  valueFormatter,
}: {
  data?: Point[];
  isLoading?: boolean;
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  if (isLoading) {
    return <Skeleton className="w-full" style={{ height }} />;
  }

  if (!data || data.length === 0) {
    return <ChartEmpty />;
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.35} vertical={false} />
          <XAxis dataKey="x" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
          <YAxis hide />
          <Tooltip
            cursor={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.6 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const v = payload[0]?.value as number;
              return (
                <ChartTooltip label={label}>
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-muted-foreground">Valor</span>
                    <span className="font-medium">{valueFormatter ? valueFormatter(v) : String(v)}</span>
                  </div>
                </ChartTooltip>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="y"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#trendFill)"
            dot={false}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}


