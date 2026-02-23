"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Task } from "@/hooks/use-task-store";
import { useMemo } from "react";

type InboxTab = "recibidas" | "enviadas" | "todas";
type QuickFilter = string;

interface TasksQuickFiltersProps {
  activeTab: InboxTab;
  tasks: Task[];
  currentUserId?: string;
  quickFilter: QuickFilter;
  onQuickFilterChange: (filter: QuickFilter) => void;
  includeCompleted: boolean;
  onIncludeCompletedChange: (include: boolean) => void;
}

export function TasksQuickFilters({
  activeTab,
  tasks,
  currentUserId,
  quickFilter,
  onQuickFilterChange,
  includeCompleted,
  onIncludeCompletedChange,
}: TasksQuickFiltersProps) {
  const filteredTasks = useMemo(() => {
    let base = tasks;
    if (activeTab === "recibidas") {
      base = tasks.filter((t) => t.assignedTo?.id?.toString() === currentUserId);
    } else if (activeTab === "enviadas") {
      base = tasks.filter((t) => t.createdBy?.id?.toString() === currentUserId);
    }
    return base;
  }, [tasks, activeTab, currentUserId]);

  const quickFilters = useMemo(() => {
    if (activeTab === "recibidas") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekFromNow = new Date(today);
      weekFromNow.setDate(today.getDate() + 7);

      const atrasadas = filteredTasks.filter((t) => {
        if (!t.dueDate || t.status === "realizada") return false;
        const due = new Date(t.dueDate);
        return due < today && t.status !== "realizada";
      }).length;

      const vencenHoy = filteredTasks.filter((t) => {
        if (!t.dueDate || t.status === "realizada") return false;
        const due = new Date(t.dueDate);
        due.setHours(0, 0, 0, 0);
        return due.getTime() === today.getTime();
      }).length;

      const prox7d = filteredTasks.filter((t) => {
        if (!t.dueDate || t.status === "realizada") return false;
        const due = new Date(t.dueDate);
        return due >= today && due <= weekFromNow && t.status !== "realizada";
      }).length;

      const sinFecha = filteredTasks.filter(
        (t) => !t.dueDate && t.status !== "realizada"
      ).length;

      return [
        { key: "atrasadas", label: "Atrasadas", count: atrasadas },
        { key: "vencen-hoy", label: "Vencen hoy", count: vencenHoy },
        { key: "prox-7d", label: "Próx 7 días", count: prox7d },
        { key: "sin-fecha", label: "Sin fecha", count: sinFecha },
      ];
    } else if (activeTab === "enviadas") {
      const pendientes = filteredTasks.filter(
        (t) => t.status === "pendiente"
      ).length;
      const enCurso = filteredTasks.filter(
        (t) => t.status === "en-curso"
      ).length;
      const sinAsignar = filteredTasks.filter(
        (t) => !t.assignedTo?.id
      ).length;

      return [
        { key: "pendientes", label: "Pendientes", count: pendientes },
        { key: "en-curso", label: "En curso", count: enCurso },
        { key: "sin-asignar", label: "Sin asignar", count: sinAsignar },
      ];
    } else {
      // Todas
      const pendientes = filteredTasks.filter(
        (t) => t.status === "pendiente"
      ).length;
      const enCurso = filteredTasks.filter(
        (t) => t.status === "en-curso"
      ).length;
      const completadas = filteredTasks.filter(
        (t) => t.status === "realizada"
      ).length;

      return [
        { key: "pendiente", label: "Pendiente", count: pendientes },
        { key: "en-curso", label: "En curso", count: enCurso },
        { key: "alta", label: "Alta", count: filteredTasks.filter((t) => t.priority === "alta").length },
        { key: "media", label: "Media", count: filteredTasks.filter((t) => t.priority === "media").length },
        { key: "baja", label: "Baja", count: filteredTasks.filter((t) => t.priority === "baja").length },
      ];
    }
  }, [activeTab, filteredTasks]);

  if (quickFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 py-3 border-b border-border">
      <div className="flex flex-wrap gap-2">
        {quickFilters.map((filter) => (
          <Button
            key={filter.key}
            variant={quickFilter === filter.key ? "default" : "outline"}
            size="sm"
            onClick={() =>
              onQuickFilterChange(
                quickFilter === filter.key ? "" : filter.key
              )
            }
            className="h-7 text-xs font-normal"
          >
            {filter.label}
            {filter.count > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 h-5 px-1.5 text-xs"
              >
                {filter.count}
              </Badge>
            )}
          </Button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Checkbox
          id="include-completed"
          checked={includeCompleted}
          onCheckedChange={(checked) =>
            onIncludeCompletedChange(checked === true)
          }
        />
        <Label
          htmlFor="include-completed"
          className="text-xs text-muted-foreground cursor-pointer"
        >
          Incluir completadas
        </Label>
      </div>
    </div>
  );
}

