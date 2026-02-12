import type { TaskRecord } from '@/api';
import { TaskCard } from './TaskCard';
import { EmptyState, SkeletonCard } from '@/components/common';
import { Inbox, PlusCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/common';

interface TaskListProps {
  tasks: TaskRecord[];
  isLoading?: boolean;
  onContinue?: (taskId: string) => void;
  onRetry?: (taskId: string) => void;
}

export function TaskList({ tasks, isLoading, onContinue, onRetry }: TaskListProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="h-12 w-12" />}
        title="No hay tasks"
        description="Crea tu primera task para empezar a automatizar tu desarrollo"
        action={
          <Button onClick={() => navigate('/tasks/new')} className="mt-2">
            <PlusCircle className="h-4 w-4 mr-2" />
            Crear primera task
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <TaskCard key={task.task_id} task={task} onContinue={onContinue} onRetry={onRetry} />
      ))}
    </div>
  );
}
