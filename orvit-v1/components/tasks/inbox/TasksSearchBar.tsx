"use client";

import { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TasksAdvancedFiltersSheet } from "./TasksAdvancedFiltersSheet";

interface TasksSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFiltersCount: number;
  onClearFilters: () => void;
  advancedFilters: any;
  onAdvancedFiltersChange: (filters: any) => void;
  users?: Array<{ id: string; name: string; email: string }>;
  canViewAll?: boolean;
  trailingAction?: ReactNode;
}

export function TasksSearchBar({
  searchQuery,
  onSearchChange,
  activeFiltersCount,
  onClearFilters,
  advancedFilters,
  onAdvancedFiltersChange,
  users,
  canViewAll,
  trailingAction,
}: TasksSearchBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tareas..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <TasksAdvancedFiltersSheet
          filters={advancedFilters}
          onFiltersChange={onAdvancedFiltersChange}
          users={users}
          canViewAll={canViewAll}
        />
        {trailingAction}
      </div>
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Filtros activos:</span>
          <Badge variant="secondary" className="text-xs">
            {activeFiltersCount}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-6 px-2 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Limpiar
          </Button>
        </div>
      )}
    </div>
  );
}

