import { useState, useMemo } from 'react';
import {
  Search,
  Globe,
  Zap,
  Scale,
  Crown,
  Palette,
  Server,
  Database,
  Shield,
  TestTube,
  Sparkles,
  Wrench,
  CheckCheck,
  X,
} from 'lucide-react';
import { Button, Card, Select } from '@/components/common';
import { cn } from '@/utils';
import type { OpportunityScanRequest, ModelType, OpportunityLanguage } from '@/api/types';

interface ScanFormProps {
  onSubmit: (request: OpportunityScanRequest) => void;
  isSubmitting: boolean;
}

// ─── Scan Area Presets ───────────────────────────────────────────────

interface ScanAreaPreset {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  focusText: string;
  selectedBg: string;
  iconColor: string;
}

const scanAreaPresets: ScanAreaPreset[] = [
  {
    id: 'frontend',
    label: 'Frontend / UI',
    icon: Palette,
    focusText: 'Busca mejoras en componentes React, UI/UX, accesibilidad, responsive design, y experiencia de usuario',
    selectedBg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-500',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'backend',
    label: 'Backend / API',
    icon: Server,
    focusText: 'Busca mejoras en endpoints API, validaciones, manejo de errores, y logica de servidor',
    selectedBg: 'bg-gray-100 dark:bg-gray-900/20 border-gray-500 dark:border-gray-500',
    iconColor: 'text-gray-600 dark:text-gray-400',
  },
  {
    id: 'database',
    label: 'Base de Datos',
    icon: Database,
    focusText: 'Busca mejoras en queries Prisma, indices, optimizacion de consultas, y modelo de datos',
    selectedBg: 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-500',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  {
    id: 'security',
    label: 'Seguridad',
    icon: Shield,
    focusText: 'Busca vulnerabilidades de seguridad, autenticacion, permisos, inyeccion SQL, XSS, y OWASP top 10',
    selectedBg: 'bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-500',
    iconColor: 'text-red-600 dark:text-red-400',
  },
  {
    id: 'performance',
    label: 'Performance',
    icon: Zap,
    focusText: 'Busca problemas de rendimiento, optimizacion de carga, lazy loading, caching, y memory leaks',
    selectedBg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 dark:border-yellow-500',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
  },
  {
    id: 'testing',
    label: 'Testing',
    icon: TestTube,
    focusText: 'Busca codigo sin tests, mejoras en cobertura de tests, y tests faltantes para casos criticos',
    selectedBg: 'bg-green-50 dark:bg-green-900/20 border-green-600 dark:border-green-600',
    iconColor: 'text-green-700 dark:text-green-300',
  },
  {
    id: 'features',
    label: 'Nuevas Features',
    icon: Sparkles,
    focusText: 'Sugiere nuevas funcionalidades utiles basandote en el codigo existente y mejores practicas del mercado',
    selectedBg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-600 dark:border-yellow-600',
    iconColor: 'text-yellow-700 dark:text-yellow-300',
  },
  {
    id: 'refactoring',
    label: 'Refactoring',
    icon: Wrench,
    focusText: 'Busca codigo duplicado, funciones muy largas, deuda tecnica, y oportunidades de refactoring',
    selectedBg: 'bg-gray-100 dark:bg-gray-900/20 border-gray-600 dark:border-gray-600',
    iconColor: 'text-gray-700 dark:text-gray-300',
  },
];

// ─── Model Cards ─────────────────────────────────────────────────────

const modelCards: Array<{
  value: ModelType;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  speed: number;
  quality: number;
  selectedBg: string;
  iconColor: string;
}> = [
  {
    value: 'haiku',
    label: 'Haiku',
    subtitle: 'Rapido',
    icon: Zap,
    speed: 3,
    quality: 1,
    selectedBg: 'bg-green-50 dark:bg-green-900/20 border-green-500',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  {
    value: 'sonnet',
    label: 'Sonnet',
    subtitle: 'Equilibrado',
    icon: Scale,
    speed: 2,
    quality: 2,
    selectedBg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-500',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: 'opus',
    label: 'Opus',
    subtitle: 'Potente',
    icon: Crown,
    speed: 1,
    quality: 3,
    selectedBg: 'bg-gray-100 dark:bg-gray-900/20 border-gray-500',
    iconColor: 'text-gray-700 dark:text-gray-300',
  },
];

function DotIndicator({ filled, total, color }: { filled: number; total: number; color: string }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            i < filled ? color : 'bg-gray-200 dark:bg-gray-600'
          )}
        />
      ))}
    </div>
  );
}

// ─── ScanForm Component ──────────────────────────────────────────────

export function ScanForm({ onSubmit, isSubmitting }: ScanFormProps) {
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set());
  const [customPrompt, setCustomPrompt] = useState('');
  const [model, setModel] = useState<ModelType>('sonnet');
  const [minOpportunities, setMinOpportunities] = useState(5);
  const [maxOpportunities, setMaxOpportunities] = useState(10);
  const [language, setLanguage] = useState<OpportunityLanguage>('es');

  const generatedPrompt = useMemo(() => {
    const parts: string[] = [];
    scanAreaPresets.forEach((preset) => {
      if (selectedAreas.has(preset.id)) {
        parts.push(preset.focusText);
      }
    });
    return parts.join('. ');
  }, [selectedAreas]);

  const finalPrompt = useMemo(() => {
    const parts: string[] = [];
    if (generatedPrompt) parts.push(generatedPrompt);
    if (customPrompt.trim()) parts.push(customPrompt.trim());
    return parts.join('. ');
  }, [generatedPrompt, customPrompt]);

  const toggleArea = (id: string) => {
    setSelectedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedAreas.size === scanAreaPresets.length) {
      setSelectedAreas(new Set());
    } else {
      setSelectedAreas(new Set(scanAreaPresets.map((p) => p.id)));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const request: OpportunityScanRequest = {
      model,
      min_opportunities: minOpportunities,
      max_opportunities: maxOpportunities,
      language,
    };

    if (finalPrompt) {
      request.focus_prompt = finalPrompt;
    }

    onSubmit(request);
  };

  const allSelected = selectedAreas.size === scanAreaPresets.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card title="Escanear Proyecto">
        <div className="space-y-5">
          <p className="text-sm text-gray-500 dark:text-dark-text-secondary">
            Selecciona las areas que queres analizar o escribe un enfoque personalizado.
          </p>

          {/* ── Area Presets ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text">
                Areas de Busqueda
              </label>
              <div className="flex items-center gap-2">
                {selectedAreas.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedAreas(new Set())}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-dark-text-secondary dark:hover:text-dark-text transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Limpiar
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleAll}
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border',
                    allSelected
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-dark-border text-gray-600 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-hover'
                  )}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {allSelected ? 'Deseleccionar' : 'Todas'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {scanAreaPresets.map((preset) => {
                const Icon = preset.icon;
                const isSelected = selectedAreas.has(preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => toggleArea(preset.id)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-left transition-all text-sm',
                      isSelected
                        ? preset.selectedBg
                        : 'border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface hover:border-gray-300 dark:hover:border-gray-500'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', isSelected ? preset.iconColor : 'text-gray-400 dark:text-gray-500')} />
                    <span className={cn(
                      'font-medium truncate',
                      isSelected ? 'text-gray-900 dark:text-dark-text' : 'text-gray-600 dark:text-dark-text-secondary'
                    )}>
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedAreas.size > 0 && (
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                {selectedAreas.size} area{selectedAreas.size !== 1 ? 's' : ''} seleccionada{selectedAreas.size !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* ── Custom Focus Prompt ── */}
          <div>
            <label htmlFor="customPrompt" className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
              Enfoque Adicional
              <span className="text-gray-400 font-normal ml-1">
                (opcional)
              </span>
            </label>
            <textarea
              id="customPrompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Ej: Enfocate especialmente en el modulo de facturacion y los hooks de compras..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
            />
          </div>

          {/* ── Preview of combined prompt ── */}
          {finalPrompt && (
            <div className="bg-gray-50 dark:bg-dark-hover/50 rounded-lg p-3 border border-gray-200 dark:border-dark-border">
              <p className="text-xs font-medium text-gray-500 dark:text-dark-text-secondary mb-1">
                Prompt final:
              </p>
              <p className="text-xs text-gray-600 dark:text-dark-text-secondary line-clamp-3">
                {finalPrompt}
              </p>
            </div>
          )}

          {/* ── Model Selection + Settings Row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                Modelo de IA
              </label>
              <div className="grid grid-cols-3 gap-2">
                {modelCards.map((m) => {
                  const Icon = m.icon;
                  const isSelected = model === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setModel(m.value)}
                      className={cn(
                        'relative p-3 rounded-xl border-2 text-left transition-all',
                        isSelected
                          ? m.selectedBg
                          : 'border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface hover:border-gray-300 dark:hover:border-gray-500'
                      )}
                    >
                      {isSelected && (
                        <div className={cn('absolute top-2 right-2 h-2 w-2 rounded-full', m.value === 'haiku' ? 'bg-green-500' : m.value === 'sonnet' ? 'bg-blue-500' : 'bg-gray-500')} />
                      )}
                      <Icon className={cn('h-5 w-5 mb-1.5', m.iconColor)} />
                      <p className="font-semibold text-gray-900 dark:text-dark-text text-sm">{m.label}</p>
                      <p className="text-xs text-gray-500 dark:text-dark-text-secondary">{m.subtitle}</p>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Velocidad</span>
                          <DotIndicator filled={m.speed} total={3} color={m.value === 'haiku' ? 'bg-green-500' : m.value === 'sonnet' ? 'bg-blue-500' : 'bg-gray-500'} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Calidad</span>
                          <DotIndicator filled={m.quality} total={3} color={m.value === 'haiku' ? 'bg-green-500' : m.value === 'sonnet' ? 'bg-blue-500' : 'bg-gray-500'} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Settings Column */}
            <div className="space-y-4">
              {/* Language */}
              <div className="w-48">
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
                  Idioma
                </label>
                <Select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as OpportunityLanguage)}
                  options={[
                    { value: 'es', label: 'Espanol' },
                    { value: 'en', label: 'English' },
                  ]}
                />
              </div>

              {/* Opportunities Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
                    Min Oportunidades
                  </label>
                  <input
                    type="number"
                    value={minOpportunities}
                    onChange={(e) => setMinOpportunities(parseInt(e.target.value) || 5)}
                    min={1}
                    max={20}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
                    Max Oportunidades
                  </label>
                  <input
                    type="number"
                    value={maxOpportunities}
                    onChange={(e) => setMaxOpportunities(parseInt(e.target.value) || 10)}
                    min={1}
                    max={50}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-between items-center">
        <div className="flex items-center text-sm text-gray-500 dark:text-dark-text-secondary">
          <Globe className="h-4 w-4 mr-1" />
          Analiza el proyecto local para encontrar mejoras
        </div>
        <Button
          type="submit"
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          <Search className="h-4 w-4 mr-2" />
          Iniciar Scan
        </Button>
      </div>
    </form>
  );
}
