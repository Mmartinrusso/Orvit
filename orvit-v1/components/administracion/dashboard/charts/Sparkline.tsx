import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartTooltip } from './chart-utils';

type Point = { x: string; y: number };

export function Sparkline({
  data,
  isLoading,
  height = 36,
  valueFormatter,
}: {
  data?: Point[];
  isLoading?: boolean;
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  if (isLoading) return <Skeleton className="w-full" style={{ height }} />;
  if (!data || data.length === 0) return <div style={{ height }} />;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            cursor={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.7 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const v = payload[0]?.value as number;
              return (
                <ChartTooltip>
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
            fill="url(#sparkFill)"
            dot={false}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}


