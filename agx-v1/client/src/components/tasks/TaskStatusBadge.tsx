import { Badge } from '@/components/common';

interface TaskStatusBadgeProps {
  success: boolean;
  stageFailed?: string | null;
}

export function TaskStatusBadge({ success, stageFailed }: TaskStatusBadgeProps) {
  if (success) {
    return <Badge variant="success">Completada</Badge>;
  }

  return (
    <Badge variant="error">
      {stageFailed ? `Fallo en ${stageFailed}` : 'Fallida'}
    </Badge>
  );
}
