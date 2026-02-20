import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getVariant = (status: string) => {
    switch (status) {
      case 'realizada':
      case 'completed':
      case 'COMPLETED':
        return 'completed' as const;
      case 'en-curso':
      case 'in-progress':
      case 'IN_PROGRESS':
        return 'in_progress' as const;
      case 'pendiente':
      case 'pending':
      case 'PENDING':
      case 'TODO':
        return 'pending' as const;
      default:
        return 'secondary' as const;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'realizada':
      case 'completed':
      case 'COMPLETED':
        return 'Realizada';
      case 'en-curso':
      case 'in-progress':
      case 'IN_PROGRESS':
        return 'En Curso';
      case 'pendiente':
      case 'pending':
      case 'PENDING':
      case 'TODO':
        return 'Pendiente';
      default:
        return status;
    }
  };

  return (
    <Badge variant={getVariant(status)} className={cn(className)}>
      {getStatusText(status)}
    </Badge>
  );
}
