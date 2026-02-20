"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Search, SlidersHorizontal, X, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useTaskStore } from "@/hooks/use-task-store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function TaskFilters() {
  const [users, setUsers] = useState<User[]>([]);
  const { filters, setFilters } = useTaskStore();
  const [searchText, setSearchText] = useState(filters.search || "");
  const debouncedSearch = useDebouncedValue(searchText, 300);

  // Evitar fetch por cada tecla (Zustand hoy refetch-ea en cada setFilters)
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      setFilters({ search: debouncedSearch });
    }
  }, [debouncedSearch, filters.search, setFilters]);

  // Si el store cambia por "Limpiar", reflejar en el input
  useEffect(() => {
    setSearchText(filters.search || "");
  }, [filters.search]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users', {
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Error al obtener usuarios');
        const data = await response.json();
        setUsers(data);
      } catch (error) {
        console.error('Error al cargar usuarios:', error);
      }
    };

    fetchUsers();
  }, []);

  const clearFilters = () => {
    setFilters({
      status: 'all',
      priority: 'all',
      assignedTo: 'all',
      dateRange: 'all',
      search: '',
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 w-full">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tareas..."
            className="pl-9 w-full"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 min-w-[120px]">
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filtros</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select 
                  value={filters.status} 
                  onValueChange={(value) => setFilters({ status: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="en-curso">En Curso</SelectItem>
                    <SelectItem value="realizada">Completada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select 
                  value={filters.priority}
                  onValueChange={(value) => setFilters({ priority: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Usuario asignado</Label>
                <Select 
                  value={filters.assignedTo}
                  onValueChange={(value) => setFilters({ assignedTo: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Rango de fechas</Label>
                <Select 
                  value={filters.dateRange}
                  onValueChange={(value) => setFilters({ dateRange: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rango" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="today">Hoy</SelectItem>
                    <SelectItem value="week">Esta semana</SelectItem>
                    <SelectItem value="month">Este mes</SelectItem>
                    <SelectItem value="overdue">Vencidas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button 
                  variant="outline" 
                  className="gap-2 min-w-[90px] flex items-center justify-center"
                  onClick={clearFilters}
                >
                  <X className="h-4 w-4" />
                  Limpiar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <div className="flex space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters({ dateRange: "today" })}
                  className={cn('px-4 py-1.5 text-sm font-medium relative min-w-[90px] rounded-md transition-colors duration-150 ease-in-out', filters.dateRange === "today" ? "bg-primary text-primary-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/70")}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Hoy
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Tareas con fecha límite para hoy</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters({ dateRange: "week" })}
                  className={cn('px-4 py-1.5 text-sm font-medium relative min-w-[120px] rounded-md transition-colors duration-150 ease-in-out', filters.dateRange === "week" ? "bg-primary text-primary-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/70")}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Esta semana
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Tareas de esta semana</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters({ dateRange: "month" as any })}
                  className={cn('px-4 py-1.5 text-sm font-medium relative min-w-[90px] rounded-md transition-colors duration-150 ease-in-out', (filters.dateRange as any) === "month" ? "bg-primary text-primary-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/70")}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Mes
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Tareas de este mes</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters({ dateRange: "all" })}
                  className={cn('px-4 py-1.5 text-sm font-medium relative min-w-[90px] rounded-md transition-colors duration-150 ease-in-out', filters.dateRange === "all" ? "bg-primary text-primary-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/70")}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Todas
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Mostrar todas las tareas</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
} 