'use client';

import React, { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sparkles,
  Mic,
  MicOff,
  Send,
  Loader2,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Wand2,
} from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { ROLE_TEMPLATES, type RoleTemplate } from '@/lib/ai/role-templates';
import { CATEGORY_LABELS } from '@/lib/permissions-catalog';
import { toast } from 'sonner';

interface PermissionSuggestion {
  permission: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  alreadyAssigned: boolean;
  descriptionEs: string;
  descriptionEn: string;
  category: string;
}

interface PermissionAIAssistantProps {
  roleName: string;
  currentPermissions: string[];
  onApplyPermissions: (permissionNames: string[]) => Promise<void>;
  lang?: 'es' | 'en';
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const CONFIDENCE_LABELS: Record<string, Record<string, string>> = {
  high: { es: 'Alta', en: 'High' },
  medium: { es: 'Media', en: 'Medium' },
  low: { es: 'Baja', en: 'Low' },
};

export default function PermissionAIAssistant({
  roleName,
  currentPermissions,
  onApplyPermissions,
  lang = 'es',
}: PermissionAIAssistantProps) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [suggestions, setSuggestions] = useState<PermissionSuggestion[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [aiMessage, setAiMessage] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const onSpeechResult = useCallback((text: string) => {
    setPrompt(text);
  }, []);

  const {
    isListening,
    interimTranscript,
    isSupported: speechSupported,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    onResult: onSpeechResult,
  });

  const handleSubmit = useCallback(async () => {
    const text = prompt.trim();
    if (!text || isLoading) return;

    setIsLoading(true);
    setSuggestions([]);
    setAiMessage('');
    setSelectedPermissions(new Set());

    try {
      const res = await fetch('/api/admin/permissions/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt: text,
          currentPermissions,
          roleName,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error del asistente');
      }

      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setAiMessage(data.message || '');

      const preSelected = new Set<string>();
      (data.suggestions || []).forEach((s: PermissionSuggestion) => {
        if (!s.alreadyAssigned && (s.confidence === 'high' || s.confidence === 'medium')) {
          preSelected.add(s.permission);
        }
      });
      setSelectedPermissions(preSelected);
    } catch (error: any) {
      toast.error(error.message || 'Error al consultar el asistente');
    } finally {
      setIsLoading(false);
    }
  }, [prompt, isLoading, currentPermissions, roleName]);

  const handleApplyTemplate = useCallback((template: RoleTemplate) => {
    const templateSuggestions: PermissionSuggestion[] = template.permissions.map(perm => ({
      permission: perm,
      reason: `Incluido en template "${template.name}"`,
      confidence: 'high' as const,
      alreadyAssigned: currentPermissions.includes(perm),
      descriptionEs: perm,
      descriptionEn: perm,
      category: 'template',
    }));
    setSuggestions(templateSuggestions);
    setAiMessage(`Template "${template.name}" aplicado: ${template.description}`);
    const preSelected = new Set<string>();
    templateSuggestions.forEach(s => {
      if (!s.alreadyAssigned) preSelected.add(s.permission);
    });
    setSelectedPermissions(preSelected);
  }, [currentPermissions]);

  const handleApply = useCallback(async () => {
    if (selectedPermissions.size === 0) return;

    setIsApplying(true);
    try {
      await onApplyPermissions(Array.from(selectedPermissions));
      setSuggestions([]);
      setSelectedPermissions(new Set());
      setAiMessage('');
      setPrompt('');
    } catch (error: any) {
      toast.error(error.message || 'Error al aplicar permisos');
    } finally {
      setIsApplying(false);
    }
  }, [selectedPermissions, onApplyPermissions]);

  const togglePermission = (perm: string) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  };

  const selectAll = () => {
    const allNew = new Set<string>();
    suggestions.forEach(s => {
      if (!s.alreadyAssigned) allNew.add(s.permission);
    });
    setSelectedPermissions(allNew);
  };

  const deselectAll = () => setSelectedPermissions(new Set());

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const groupedSuggestions = suggestions.reduce<Record<string, PermissionSuggestion[]>>(
    (acc, s) => {
      const cat = s.category || 'otros';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(s);
      return acc;
    },
    {}
  );

  const newPermissionsCount = suggestions.filter(s => !s.alreadyAssigned).length;
  const selectedCount = selectedPermissions.size;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.02] overflow-hidden">
      {/* Panel body */}
      <div className="p-3 space-y-3">

        {/* Templates rápidos */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {lang === 'es' ? 'Templates rápidos' : 'Quick templates'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_TEMPLATES.slice(0, 6).map((template) => (
              <button
                key={template.id}
                onClick={() => handleApplyTemplate(template)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-background border border-border hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all duration-150 text-muted-foreground"
              >
                <Wand2 className="h-3 w-3 shrink-0" />
                {template.name}
              </button>
            ))}
          </div>
        </div>

        {/* Separador */}
        <div className="border-t border-border/50" />

        {/* Input */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {lang === 'es' ? 'Describir permisos necesarios' : 'Describe needed permissions'}
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                placeholder={
                  lang === 'es'
                    ? 'Ej: "puede ver y crear órdenes de trabajo"'
                    : 'E.g: "can view and create work orders"'
                }
                value={isListening ? (interimTranscript || prompt) : prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                disabled={isLoading || isListening}
                className="h-8 text-xs pr-8"
              />
              {isListening && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                </div>
              )}
            </div>

            {speechSupported && (
              <Button
                variant={isListening ? 'destructive' : 'outline'}
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={isListening ? stopListening : startListening}
                disabled={isLoading}
                title={isListening ? 'Detener' : 'Hablar'}
              >
                {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </Button>
            )}

            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleSubmit}
              disabled={isLoading || !prompt.trim()}
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/15">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
            <span className="text-xs text-muted-foreground">
              {lang === 'es' ? 'Analizando permisos...' : 'Analyzing permissions...'}
            </span>
          </div>
        )}

        {/* Resultados */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            {/* Mensaje IA */}
            {aiMessage && (
              <div className="flex gap-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/15">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-foreground leading-relaxed">{aiMessage}</p>
              </div>
            )}

            {/* Toolbar selección */}
            <div className="flex items-center justify-between py-0.5">
              <span className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{selectedCount}</span>
                {' '}{lang === 'es' ? 'seleccionados' : 'selected'}
                {newPermissionsCount < suggestions.length && (
                  <span className="ml-1 text-muted-foreground/60">
                    · {suggestions.length} {lang === 'es' ? 'sugerencias' : 'suggestions'}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="text-xs text-primary hover:underline underline-offset-2">
                  {lang === 'es' ? 'Todos' : 'All'}
                </button>
                <span className="text-muted-foreground/40 text-xs">|</span>
                <button onClick={deselectAll} className="text-xs text-muted-foreground hover:underline underline-offset-2">
                  {lang === 'es' ? 'Ninguno' : 'None'}
                </button>
              </div>
            </div>

            {/* Lista por categoría */}
            <div className="max-h-[280px] overflow-y-auto space-y-1.5 pr-0.5">
              {Object.entries(groupedSuggestions).map(([cat, catSuggestions]) => {
                const catLabel = CATEGORY_LABELS[cat]
                  ? (lang === 'es' ? CATEGORY_LABELS[cat].es : CATEGORY_LABELS[cat].en)
                  : cat;
                const isCollapsed = collapsedCategories.has(cat);
                const catSelectedCount = catSuggestions.filter(
                  s => selectedPermissions.has(s.permission)
                ).length;

                return (
                  <div key={cat} className="rounded-md border border-border/60 overflow-hidden">
                    <button
                      onClick={() => toggleCategory(cat)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        {isCollapsed
                          ? <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        }
                        <span className="text-xs font-medium">{catLabel}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-background border border-border text-muted-foreground">
                          {catSuggestions.length}
                        </span>
                      </div>
                      {catSelectedCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {catSelectedCount} {lang === 'es' ? 'sel.' : 'sel.'}
                        </span>
                      )}
                    </button>

                    {!isCollapsed && (
                      <div className="divide-y divide-border/30">
                        {catSuggestions.map((suggestion) => (
                          <label
                            key={suggestion.permission}
                            className={cn(
                              'flex items-start gap-2.5 px-2.5 py-2 cursor-pointer hover:bg-muted/20 transition-colors',
                              suggestion.alreadyAssigned && 'opacity-50 cursor-default'
                            )}
                          >
                            <Checkbox
                              checked={
                                suggestion.alreadyAssigned ||
                                selectedPermissions.has(suggestion.permission)
                              }
                              disabled={suggestion.alreadyAssigned}
                              onCheckedChange={() => togglePermission(suggestion.permission)}
                              className="mt-0.5 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <code className="text-[11px] font-mono text-foreground">
                                  {suggestion.permission}
                                </code>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-[9px] h-3.5 px-1 border-0',
                                    CONFIDENCE_COLORS[suggestion.confidence]
                                  )}
                                >
                                  {CONFIDENCE_LABELS[suggestion.confidence]?.[lang] || suggestion.confidence}
                                </Badge>
                                {suggestion.alreadyAssigned && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] h-3.5 px-1 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-0"
                                  >
                                    {lang === 'es' ? 'Ya asignado' : 'Already assigned'}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {lang === 'es' ? suggestion.descriptionEs : suggestion.descriptionEn}
                              </p>
                              {suggestion.reason && (
                                <p className="text-[10px] text-muted-foreground/60 mt-0.5 italic">
                                  {suggestion.reason}
                                </p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Botones de acción */}
            <div className="flex items-center gap-2 pt-0.5">
              <Button
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={handleApply}
                disabled={selectedCount === 0 || isApplying}
              >
                {isApplying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                )}
                {lang === 'es'
                  ? `Aplicar ${selectedCount} permiso${selectedCount !== 1 ? 's' : ''}`
                  : `Apply ${selectedCount} permission${selectedCount !== 1 ? 's' : ''}`}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSuggestions([]);
                  setSelectedPermissions(new Set());
                  setAiMessage('');
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
