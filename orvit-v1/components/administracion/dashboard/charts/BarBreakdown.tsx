import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartEmpty, ChartTooltip } from './chart-utils';

type Row = Record<string, unknown>;

export function BarBreakdown({
  data,
  isLoading,
  height = 220,
  xKey,
  yKey,
  valueFormatter,
}: {
  data?: Row[];
  isLoading?: boolean;
  height?: number;
  xKey: string;
  yKey: string;
  valueFormatter?: (v: number) => string;
}) {
  if (isLoading) return <Skeleton className="w-full" style={{ height }} />;
  if (!data || data.length === 0) return <ChartEmpty />;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.35} vertical={false} />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.5 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const v = payload[0]?.value as number;
              return (
                <ChartTooltip label={String(label)}>
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-muted-foreground">Valor</span>
                    <span className="font-medium">{valueFormatter ? valueFormatter(v) : String(v)}</span>
                  </div>
                </ChartTooltip>
              );
            }}
          />
          <Bar dataKey={yKey} fill="hsl(var(--primary))" radius={[6, 6, 6, 6]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}


