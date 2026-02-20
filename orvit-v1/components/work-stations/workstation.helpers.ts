export const statusLabels: Record<string, string> = {
  'ACTIVE': 'Activo',
  'INACTIVE': 'Inactivo',
  'MAINTENANCE': 'En mantenimiento',
};

export const statusColors: Record<string, string> = {
  'ACTIVE': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  'INACTIVE': 'bg-muted text-muted-foreground border-border',
  'MAINTENANCE': 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
};
