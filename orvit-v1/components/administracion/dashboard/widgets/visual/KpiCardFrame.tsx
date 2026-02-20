import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function KpiCardFrame({
  title,
  pill,
  children,
}: {
  title: ReactNode;
  pill?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="h-full rounded-lg border border-border shadow-sm bg-gradient-to-t from-muted/50 via-muted/20 to-background">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-1.5 px-4">
        <div className="text-muted-foreground text-xs font-normal">{title}</div>
        {pill}
      </CardHeader>
      <CardContent className="px-4 pb-1.5 pt-0">{children}</CardContent>
    </Card>
  );
}

export function KpiPill({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground text-xs">
      {children}
    </div>
  );
}


