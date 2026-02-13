"use client";

import { ArrowUpDown, ArrowUp, ArrowDown, Calendar, Clock, AlertTriangle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type SortField = "dueDate" | "createdAt" | "updatedAt" | "priority" | "title" | "assignee";
export type SortDirection = "asc" | "desc";

export interface SortOption {
  field: SortField;
  direction: SortDirection;
}

interface TasksSortDropdownProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

const sortOptions: Array<{ field: SortField; label: string; icon: React.ElementType }> = [
  { field: "dueDate", label: "Fecha de vencimiento", icon: Calendar },
  { field: "createdAt", label: "Fecha de creación", icon: Clock },
  { field: "updatedAt", label: "Última actualización", icon: Clock },
  { field: "priority", label: "Prioridad", icon: AlertTriangle },
  { field: "title", label: "Título (A-Z)", icon: ArrowUpDown },
  { field: "assignee", label: "Responsable", icon: User },
];

const fieldLabels: Record<SortField, string> = {
  dueDate: "Vencimiento",
  createdAt: "Creación",
  updatedAt: "Actualización",
  priority: "Prioridad",
  title: "Título",
  assignee: "Responsable",
};

export function TasksSortDropdown({ currentSort, onSortChange }: TasksSortDropdownProps) {
  const handleSortClick = (field: SortField) => {
    if (currentSort.field === field) {
      onSortChange({
        field,
        direction: currentSort.direction === "asc" ? "desc" : "asc",
      });
    } else {
      const defaultDirection: SortDirection =
        field === "priority" || field === "dueDate" ? "asc" : "desc";
      onSortChange({ field, direction: defaultDirection });
    }
  };

  const DirectionIcon = currentSort.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{fieldLabels[currentSort.field]}</span>
          <DirectionIcon className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sortOptions.map((option) => {
          const Icon = option.icon;
          const isActive = currentSort.field === option.field;
          return (
            <DropdownMenuItem
              key={option.field}
              onClick={() => handleSortClick(option.field)}
              className={cn(
                "flex items-center justify-between",
                isActive && "bg-accent"
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{option.label}</span>
              </div>
              {isActive && (
                <DirectionIcon className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
