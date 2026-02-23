export const statusLabels: Record<string, string> = {
  'ACTIVE': 'Activo',
  'INACTIVE': 'Inactivo',
  'MAINTENANCE': 'En mantenimiento',
};

export const statusColors: Record<string, string> = {
  'ACTIVE': 'bg-success/10 text-success-muted-foreground border-success-muted',
  'INACTIVE': 'bg-muted text-muted-foreground border-border',
  'MAINTENANCE': 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
};
