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
    <Card className="h-full rounded-lg border border-gray-300/90 shadow-sm bg-gradient-to-t from-black/5 via-gray-100/50 to-white dark:border-gray-600/90 dark:from-black/10 dark:via-gray-800/50 dark:to-gray-900">
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


