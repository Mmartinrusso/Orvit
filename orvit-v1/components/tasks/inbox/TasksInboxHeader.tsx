"use client";

import { Plus, List, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type TasksViewMode = "list" | "kanban";

interface TasksInboxHeaderProps {
  onNewTask: () => void;
  viewMode?: TasksViewMode;
  onViewModeChange?: (mode: TasksViewMode) => void;
}

export function TasksInboxHeader({ onNewTask, viewMode = "list", onViewModeChange }: TasksInboxHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
      <div>
        <h2 className="text-base font-semibold">Tareas</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Bandeja de entrada y gestión de tareas
        </p>
      </div>
      <div className="flex gap-2 items-center">
        {/* View Toggle */}
        {onViewModeChange && (
          <TooltipProvider>
            <div className="flex border rounded-lg p-1 gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => onViewModeChange('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Vista lista</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => onViewModeChange('kanban')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Vista Kanban (por persona)</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        )}

        <Button onClick={onNewTask} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Tarea
        </Button>
      </div>
    </div>
  );
}

