"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, SlidersHorizontal } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from '@/components/ui/date-picker';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface AdvancedFilters {
  statuses: string[];
  priorities: string[];
  tags: string[];
  assignedTo?: string;
  createdBy?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  hasAttachments: boolean;
  hasSubtasks: boolean;
}

interface TasksAdvancedFiltersSheetProps {
  filters: AdvancedFilters;
  onFiltersChange: (filters: AdvancedFilters) => void;
  users?: Array<{ id: string; name: string; email: string }>;
  canViewAll?: boolean;
}

export function TasksAdvancedFiltersSheet({
  filters,
  onFiltersChange,
  users = [],
  canViewAll = false,
}: TasksAdvancedFiltersSheetProps) {
  const [tagInput, setTagInput] = useState("");

  const handleAddTag = () => {
    if (tagInput.trim() && !filters.tags.includes(tagInput.trim())) {
      onFiltersChange({
        ...filters,
        tags: [...filters.tags, tagInput.trim()],
      });
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    onFiltersChange({
      ...filters,
      tags: filters.tags.filter((t) => t !== tag),
    });
  };

  const toggleStatus = (status: string) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const togglePriority = (priority: string) => {
    const newPriorities = filters.priorities.includes(priority)
      ? filters.priorities.filter((p) => p !== priority)
      : [...filters.priorities, priority];
    onFiltersChange({ ...filters, priorities: newPriorities });
  };

  const clearFilters = () => {
    onFiltersChange({
      statuses: [],
      priorities: [],
      tags: [],
      assignedTo: undefined,
      createdBy: undefined,
      dueDateFrom: undefined,
      dueDateTo: undefined,
      hasAttachments: false,
      hasSubtasks: false,
    });
  };

  const hasActiveFilters =
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    filters.tags.length > 0 ||
    filters.assignedTo ||
    filters.createdBy ||
    filters.dueDateFrom ||
    filters.dueDateTo ||
    filters.hasAttachments ||
    filters.hasSubtasks;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="lg">
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filtros
        </Button>
      </SheetTrigger>
      <SheetContent side="right" size="sm">
        <SheetHeader>
          <SheetTitle>Filtros avanzados</SheetTitle>
          <SheetDescription>
            Aplicá múltiples filtros para encontrar tareas específicas
          </SheetDescription>
        </SheetHeader>

        {/* Resumen de filtros activos */}
        {hasActiveFilters && (
          <div className="px-6 pt-4 pb-2 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Filtros activos:
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-6 px-2 text-xs"
              >
                Limpiar todo
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {filters.statuses.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">
                  Estado: {s === "en-curso" ? "En curso" : s}
                  <button
                    onClick={() => toggleStatus(s)}
                    className="ml-1.5 hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {filters.priorities.map((p) => (
                <Badge key={p} variant="secondary" className="text-xs">
                  Prioridad: {p}
                  <button
                    onClick={() => togglePriority(p)}
                    className="ml-1.5 hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {filters.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1.5 hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {filters.assignedTo && (
                <Badge variant="secondary" className="text-xs">
                  Asignado: {users.find((u) => u.id === filters.assignedTo)?.name}
                  <button
                    onClick={() =>
                      onFiltersChange({ ...filters, assignedTo: undefined })
                    }
                    className="ml-1.5 hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filters.createdBy && (
                <Badge variant="secondary" className="text-xs">
                  Solicitante: {users.find((u) => u.id === filters.createdBy)?.name}
                  <button
                    onClick={() =>
                      onFiltersChange({ ...filters, createdBy: undefined })
                    }
                    className="ml-1.5 hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {(filters.dueDateFrom || filters.dueDateTo) && (
                <Badge variant="secondary" className="text-xs">
                  Fecha: {filters.dueDateFrom || "..."} - {filters.dueDateTo || "..."}
                  <button
                    onClick={() =>
                      onFiltersChange({
                        ...filters,
                        dueDateFrom: undefined,
                        dueDateTo: undefined,
                      })
                    }
                    className="ml-1.5 hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filters.hasAttachments && (
                <Badge variant="secondary" className="text-xs">
                  Con adjuntos
                  <button
                    onClick={() =>
                      onFiltersChange({ ...filters, hasAttachments: false })
                    }
                    className="ml-1.5 hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filters.hasSubtasks && (
                <Badge variant="secondary" className="text-xs">
                  Con subtareas
                  <button
                    onClick={() =>
                      onFiltersChange({ ...filters, hasSubtasks: false })
                    }
                    className="ml-1.5 hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          </div>
        )}

        <SheetBody>
          <Accordion type="multiple" defaultValue={["estado", "prioridad"]} className="w-full">
              {/* Estado */}
              <AccordionItem value="estado">
                <AccordionTrigger className="text-sm">Estado</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-1">
                    {["pendiente", "en-curso", "realizada", "cancelada"].map(
                      (status) => (
                        <div key={status} className="flex items-center space-x-2">
                          <Checkbox
                            id={`status-${status}`}
                            checked={filters.statuses.includes(status)}
                            onCheckedChange={() => toggleStatus(status)}
                          />
                          <Label
                            htmlFor={`status-${status}`}
                            className="text-sm font-normal cursor-pointer capitalize"
                          >
                            {status === "en-curso" ? "En curso" : status}
                          </Label>
                        </div>
                      )
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Prioridad */}
              <AccordionItem value="prioridad">
                <AccordionTrigger className="text-sm">Prioridad</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-1">
                    {["alta", "media", "baja"].map((priority) => (
                      <div key={priority} className="flex items-center space-x-2">
                        <Checkbox
                          id={`priority-${priority}`}
                          checked={filters.priorities.includes(priority)}
                          onCheckedChange={() => togglePriority(priority)}
                        />
                        <Label
                          htmlFor={`priority-${priority}`}
                          className="text-sm font-normal cursor-pointer capitalize"
                        >
                          {priority}
                        </Label>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Etiquetas */}
              <AccordionItem value="etiquetas">
                <AccordionTrigger className="text-sm">Etiquetas</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-1">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Presiona Enter para agregar"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                        className="h-9"
                      />
                      <Button
                        type="button"
                        onClick={handleAddTag}
                        size="sm"
                        className="h-9"
                      >
                        Agregar
                      </Button>
                    </div>
                    {filters.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {filters.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="flex items-center gap-1 text-xs"
                          >
                            {tag}
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className="ml-1 hover:bg-muted rounded-full p-0.5"
                              aria-label={`Eliminar etiqueta ${tag}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {canViewAll && (
                <>
                  {/* Asignado a */}
                  <AccordionItem value="asignado">
                    <AccordionTrigger className="text-sm">Asignado a</AccordionTrigger>
                    <AccordionContent>
                      <div className="pt-1">
                        <Select
                          value={filters.assignedTo || "all"}
                          onValueChange={(value) =>
                            onFiltersChange({
                              ...filters,
                              assignedTo: value === "all" ? undefined : value,
                            })
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Todos" />
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
                    </AccordionContent>
                  </AccordionItem>

                  {/* Solicitante */}
                  <AccordionItem value="solicitante">
                    <AccordionTrigger className="text-sm">Solicitante</AccordionTrigger>
                    <AccordionContent>
                      <div className="pt-1">
                        <Select
                          value={filters.createdBy || "all"}
                          onValueChange={(value) =>
                            onFiltersChange({
                              ...filters,
                              createdBy: value === "all" ? undefined : value,
                            })
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Todos" />
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
                    </AccordionContent>
                  </AccordionItem>
                </>
              )}

              {/* Fecha límite */}
              <AccordionItem value="fecha">
                <AccordionTrigger className="text-sm">Fecha límite</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-1">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        Desde
                      </Label>
                      <DatePicker
                        value={filters.dueDateFrom || ""}
                        onChange={(date) =>
                          onFiltersChange({
                            ...filters,
                            dueDateFrom: date || undefined,
                          })
                        }
                        placeholder="Seleccionar fecha"
                        clearable
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        Hasta
                      </Label>
                      <DatePicker
                        value={filters.dueDateTo || ""}
                        onChange={(date) =>
                          onFiltersChange({
                            ...filters,
                            dueDateTo: date || undefined,
                          })
                        }
                        placeholder="Seleccionar fecha"
                        clearable
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Opciones adicionales */}
              <AccordionItem value="opciones">
                <AccordionTrigger className="text-sm">Opciones adicionales</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="has-attachments"
                        checked={filters.hasAttachments}
                        onCheckedChange={(checked) =>
                          onFiltersChange({
                            ...filters,
                            hasAttachments: checked === true,
                          })
                        }
                      />
                      <Label
                        htmlFor="has-attachments"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Solo con adjuntos
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="has-subtasks"
                        checked={filters.hasSubtasks}
                        onCheckedChange={(checked) =>
                          onFiltersChange({
                            ...filters,
                            hasSubtasks: checked === true,
                          })
                        }
                      />
                      <Label
                        htmlFor="has-subtasks"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Solo con subtareas
                      </Label>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
          </Accordion>
        </SheetBody>

        <SheetFooter>
          <Button
            variant="outline"
            onClick={clearFilters}
            className="flex-1"
            disabled={!hasActiveFilters}
          >
            Limpiar todo
          </Button>
          <Button variant="default" className="flex-1" asChild>
            <SheetTrigger>Aplicar filtros</SheetTrigger>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

