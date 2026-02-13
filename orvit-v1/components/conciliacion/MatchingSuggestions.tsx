'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';
import type { MatchSuggestion } from '@/hooks/use-bank-reconciliation';

const DEFAULT_COLORS = {
  chart1: '#6366f1',
  chart5: '#10b981',
  chart4: '#f59e0b',
  kpiNeutral: '#64748b',
};

interface MatchingSuggestionsProps {
  suggestions: MatchSuggestion[];
  isLoading: boolean;
  onAcceptSuggestion: (bankMovementId: number, paymentId: number) => void;
  isAccepting?: boolean;
}

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const config = {
    high: { label: 'Alta', color: DEFAULT_COLORS.chart5 },
    medium: { label: 'Media', color: DEFAULT_COLORS.chart4 },
    low: { label: 'Baja', color: DEFAULT_COLORS.kpiNeutral },
  };
  const c = config[confidence];
  return (
    <Badge
      style={{ backgroundColor: `${c.color}20`, color: c.color }}
      className="text-xs"
    >
      {c.label}
    </Badge>
  );
}

export default function MatchingSuggestions({
  suggestions,
  isLoading,
  onAcceptSuggestion,
  isAccepting,
}: MatchingSuggestionsProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const userColors = DEFAULT_COLORS;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: userColors.chart1 }} />
            Sugerencias de Matching
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: userColors.chart1 }} />
            Sugerencias de Matching
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay sugerencias de matching disponibles
          </p>
        </CardContent>
      </Card>
    );
  }

  // Filtrar solo sugerencias con matches
  const validSuggestions = suggestions.filter((s) => s.matches.length > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: userColors.chart1 }} />
          Sugerencias de Matching
          <Badge variant="secondary" className="text-xs ml-auto">
            {validSuggestions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {validSuggestions.map((suggestion) => {
            const bestMatch = suggestion.matches[0];
            const isExpanded = expandedId === suggestion.bankMovement.id;

            return (
              <div
                key={suggestion.bankMovement.id}
                className="border rounded-lg overflow-hidden"
              >
                {/* Header - movimiento bancario */}
                <div
                  className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : suggestion.bankMovement.id)
                  }
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {suggestion.bankMovement.concepto || 'Sin descripción'}
                      </p>
                      <ConfidenceBadge confidence={bestMatch.confidence} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(suggestion.bankMovement.fecha), 'dd/MM/yyyy', { locale: es })}
                      {' · '}
                      <span className="font-medium">
                        {formatCurrency(suggestion.bankMovement.monto)}
                      </span>
                      {' · Score: '}
                      {bestMatch.score.toFixed(0)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {suggestion.matches.length > 1 && (
                      <Badge variant="outline" className="text-xs">
                        +{suggestion.matches.length - 1}
                      </Badge>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Matches expandidos */}
                {isExpanded && (
                  <div className="border-t">
                    {suggestion.matches.map((match) => (
                      <div
                        key={match.paymentId}
                        className="flex items-center justify-between p-3 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            {match.payment?.clientName || `Pago #${match.paymentId}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {match.payment?.numero}
                            {match.payment?.fecha &&
                              ` · ${format(new Date(match.payment.fecha), 'dd/MM/yyyy', { locale: es })}`}
                            {match.payment?.monto &&
                              ` · ${formatCurrency(match.payment.monto)}`}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <ConfidenceBadge confidence={match.confidence} />
                            <span className="text-xs text-muted-foreground">
                              Score: {match.score.toFixed(0)}/100
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAcceptSuggestion(
                              suggestion.bankMovement.id,
                              match.paymentId
                            );
                          }}
                          disabled={isAccepting}
                        >
                          <Check className="h-3 w-3" />
                          Aceptar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
