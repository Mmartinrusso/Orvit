"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TasksInboxHeaderProps {
  onNewTask: () => void;
}

export function TasksInboxHeader({ onNewTask }: TasksInboxHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
      <div>
        <h2 className="text-base font-semibold">Tareas</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Bandeja de entrada y gestión de tareas
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={onNewTask} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Tarea
        </Button>
      </div>
    </div>
  );
}

