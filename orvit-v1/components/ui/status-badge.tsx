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
        return 'default'; // Usar default y aplicar color verde manualmente
      case 'en-curso':
      case 'in-progress':
      case 'IN_PROGRESS':
        return 'default';
      case 'pendiente':
      case 'pending':
      case 'PENDING':
      case 'TODO':
        return 'destructive';
      default:
        return 'secondary';
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

  const isRealizada = ['realizada', 'completed', 'COMPLETED'].includes(status);

  return (
    <Badge 
      variant={getVariant(status) as any} 
      className={cn(className, isRealizada && 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300')}
    >
      {getStatusText(status)}
    </Badge>
  );
} 