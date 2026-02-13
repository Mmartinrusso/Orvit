import type { ReactNode } from 'react';

export function ChartEmpty({ title = 'Sin datos', description = 'No hay información para mostrar.' }: { title?: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

export function ChartTooltip({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-popover text-popover-foreground shadow-md px-3 py-2 text-xs">
      {label && <div className="font-medium mb-1">{label}</div>}
      <div className="space-y-1">{children}</div>
    </div>
  );
}


