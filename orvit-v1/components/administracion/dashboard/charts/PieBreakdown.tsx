import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartEmpty, ChartTooltip } from './chart-utils';

type Slice = { name: string; value: number };

const DEFAULT_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--primary) / 0.8)',
  'hsl(var(--primary) / 0.65)',
  'hsl(var(--primary) / 0.5)',
  'hsl(var(--primary) / 0.35)',
];

export function PieBreakdown({
  data,
  isLoading,
  height = 220,
  valueFormatter,
}: {
  data?: Slice[];
  isLoading?: boolean;
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  if (isLoading) return <Skeleton className="w-full" style={{ height }} />;
  if (!data || data.length === 0) return <ChartEmpty />;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0] as any;
              const name = p?.name as string;
              const v = p?.value as number;
              return (
                <ChartTooltip label={name}>
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-muted-foreground">Valor</span>
                    <span className="font-medium">{valueFormatter ? valueFormatter(v) : String(v)}</span>
                  </div>
                </ChartTooltip>
              );
            }}
          />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}


