'use client';

import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { sanitizeHtml } from '@/lib/sanitize';
import {
  Clock,
  User,
  Star,
  Wrench,
  Package,
  FileText,
  Plus,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useFailureSolutions, FailureSolution } from '@/hooks/mantenimiento/use-failure-solutions';

interface SolutionsListProps {
  occurrenceId: number | null;
  workOrderId?: number | null;
  onAddSolution?: () => void;
  showAddButton?: boolean;
  className?: string;
}

function SolutionCard({ solution, isFirst }: { solution: FailureSolution; isFirst: boolean }) {
  const [isOpen, setIsOpen] = React.useState(isFirst);

  const getEffectivenessStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              'h-3 w-3',
              star <= rating ? 'fill-warning-muted-foreground text-warning-muted-foreground' : 'text-muted-foreground'
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn(
        'border',
        solution.isPreferred && 'border-success-muted bg-success-muted/50'
      )}>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-sm font-medium">
                    {solution.title}
                  </CardTitle>
                  {solution.isPreferred && (
                    <Badge variant="default" className="bg-success text-success-foreground text-xs">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      Preferida
                    </Badge>
                  )}
                  {solution.effectiveness && getEffectivenessStars(solution.effectiveness)}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {solution.appliedByName || 'Usuario desconocido'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(solution.appliedAt), "dd MMM yyyy", { locale: es })}
                  </span>
                  {solution.actualHours && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {solution.actualHours} {solution.timeUnit === 'minutes' ? 'min' : 'h'}
                    </span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4 space-y-4">
            {/* Descripción */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">Descripción</h4>
              <div
                className="text-sm prose prose-sm max-w-none prose-p:my-1"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(solution.description) }}
              />
            </div>

            {/* Causa raíz */}
            {solution.rootCause && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Causa Raíz
                </h4>
                <p className="text-sm">{solution.rootCause}</p>
              </div>
            )}

            {/* Acciones preventivas */}
            {solution.preventiveActions && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">
                  Acciones Preventivas
                </h4>
                <p className="text-sm">{solution.preventiveActions}</p>
              </div>
            )}

            {/* Herramientas y repuestos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {solution.toolsUsed && solution.toolsUsed.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Wrench className="h-3 w-3" />
                    Herramientas
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {solution.toolsUsed.map((tool: any, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {tool.name} {tool.quantity && `(${tool.quantity})`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {solution.sparePartsUsed && solution.sparePartsUsed.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    Repuestos
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {solution.sparePartsUsed.map((part: any, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {part.name} {part.quantity && `(${part.quantity})`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Archivos adjuntos */}
            {solution.attachments && solution.attachments.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Documentación
                </h4>
                <div className="flex flex-wrap gap-2">
                  {solution.attachments.map((file: any, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {file.name || file}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function SolutionsList({
  occurrenceId,
  workOrderId,
  onAddSolution,
  showAddButton = true,
  className,
}: SolutionsListProps) {
  const { data, isLoading, error } = useFailureSolutions(occurrenceId);

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Soluciones aplicadas</h3>
        </div>
        <div className="animate-pulse space-y-2">
          <div className="h-20 bg-muted rounded-lg" />
          <div className="h-20 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4 bg-destructive/10 text-destructive rounded-lg text-sm', className)}>
        Error al cargar soluciones: {error.message}
      </div>
    );
  }

  const solutions = data?.solutions || [];

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          Soluciones aplicadas
          {solutions.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {solutions.length}
            </Badge>
          )}
        </h3>
        {showAddButton && onAddSolution && (
          <Button variant="outline" size="sm" onClick={onAddSolution} className="gap-1">
            <Plus className="h-4 w-4" />
            Agregar solución
          </Button>
        )}
      </div>

      {solutions.length === 0 ? (
        <div className="text-center py-8 bg-muted/30 rounded-lg">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No hay soluciones registradas para esta falla
          </p>
          {showAddButton && onAddSolution && (
            <Button
              variant="link"
              size="sm"
              onClick={onAddSolution}
              className="mt-2"
            >
              Agregar la primera solución
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {solutions.map((solution, index) => (
            <SolutionCard
              key={solution.id}
              solution={solution}
              isFirst={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default SolutionsList;
