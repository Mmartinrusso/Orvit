import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bug,
  Zap,
  Shield,
  Code,
  Wrench,
  Sparkles,
  FileText,
  TestTube,
  Accessibility,
  Palette,
  Archive,
  Package,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileCode,
} from 'lucide-react';
import { Card, Button, Badge } from '@/components/common';
import { ApprovalModal } from './ApprovalModal';
import type { Opportunity, OpportunityCategory, OpportunityPriority, OpportunityComplexity, ModelType, PipelineMode } from '@/api/types';
import { cn, formatRelativeTime } from '@/utils';

interface OpportunityCardProps {
  opportunity: Opportunity;
  onApprove: (opportunityId: string, model?: ModelType, pipelineMode?: PipelineMode) => void;
  onReject: (opportunityId: string, reason?: string) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

const categoryIcons: Record<OpportunityCategory, React.ComponentType<{ className?: string }>> = {
  bug_fix: Bug,
  performance: Zap,
  security: Shield,
  code_quality: Code,
  refactoring: Wrench,
  new_feature: Sparkles,
  documentation: FileText,
  testing: TestTube,
  accessibility: Accessibility,
  ux_improvement: Palette,
  tech_debt: Archive,
  dependency_update: Package,
  other: MoreHorizontal,
};

const categoryLabels: Record<OpportunityCategory, string> = {
  bug_fix: 'Bug Fix',
  performance: 'Performance',
  security: 'Seguridad',
  code_quality: 'Calidad',
  refactoring: 'Refactoring',
  new_feature: 'Nueva Feature',
  documentation: 'Documentacion',
  testing: 'Testing',
  accessibility: 'Accesibilidad',
  ux_improvement: 'UX',
  tech_debt: 'Deuda Tecnica',
  dependency_update: 'Dependencias',
  other: 'Otro',
};

const categoryColors: Record<OpportunityCategory, string> = {
  bug_fix: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
  performance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400',
  security: 'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-400',
  code_quality: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400',
  refactoring: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-400',
  new_feature: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400',
  documentation: 'bg-gray-100 text-gray-800 dark:bg-gray-500/15 dark:text-gray-400',
  testing: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-400',
  accessibility: 'bg-pink-100 text-pink-800 dark:bg-pink-500/15 dark:text-pink-400',
  ux_improvement: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-400',
  tech_debt: 'bg-stone-100 text-stone-800 dark:bg-stone-500/15 dark:text-stone-400',
  dependency_update: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-400',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-500/15 dark:text-gray-400',
};

const priorityColors: Record<OpportunityPriority, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-white',
  low: 'bg-gray-400 text-white',
};

const priorityBorderColors: Record<OpportunityPriority, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-gray-300',
};

const complexityLabels: Record<OpportunityComplexity, string> = {
  trivial: 'Trivial',
  simple: 'Simple',
  moderate: 'Moderado',
  complex: 'Complejo',
  very_complex: 'Muy Complejo',
};

export function OpportunityCard({
  opportunity,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  selected,
  onSelect,
}: OpportunityCardProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const CategoryIcon = categoryIcons[opportunity.category];
  const isPending = opportunity.status === 'pending';
  const isProcessing = isApproving || isRejecting;

  const handleApproveClick = () => {
    if (!isProcessing) {
      setShowApprovalModal(true);
    }
  };

  const handleApproveConfirm = (model: ModelType, pipelineMode: PipelineMode) => {
    onApprove(opportunity.opportunity_id, model, pipelineMode);
    setShowApprovalModal(false);
  };

  const handleReject = () => {
    if (!isProcessing) {
      onReject(opportunity.opportunity_id);
    }
  };

  return (
    <Card className={cn(
      'hover:shadow-md transition-shadow border-l-4',
      priorityBorderColors[opportunity.priority],
      selected && 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-dark-bg'
    )}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            {/* Selection checkbox area */}
            {onSelect && (
              <button
                onClick={onSelect}
                className={cn(
                  'mt-1 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors shrink-0',
                  selected
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'border-gray-300 dark:border-dark-border hover:border-blue-400'
                )}
              >
                {selected && <CheckCircle className="h-3 w-3" />}
              </button>
            )}

            {/* Larger category icon */}
            <div className={cn('p-3 rounded-xl shrink-0', categoryColors[opportunity.category])}>
              <CategoryIcon className="h-7 w-7" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-dark-text line-clamp-1">
                {opportunity.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-dark-text-secondary line-clamp-2 mt-1">
                {opportunity.description}
              </p>
            </div>
          </div>

          {/* Priority Badge */}
          <Badge className={priorityColors[opportunity.priority]}>
            {opportunity.priority.toUpperCase()}
          </Badge>
        </div>

        {/* Meta Info */}
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-dark-text-secondary">
          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', categoryColors[opportunity.category])}>
            {categoryLabels[opportunity.category]}
          </span>
          <span>|</span>
          <span>{complexityLabels[opportunity.estimated_complexity]}</span>
          {opportunity.created_at && (
            <>
              <span>|</span>
              <span>{formatRelativeTime(opportunity.created_at)}</span>
            </>
          )}
        </div>

        {/* Tags */}
        {opportunity.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {opportunity.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-gray-100 dark:bg-dark-hover text-gray-600 dark:text-dark-text-secondary text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Expandable Content with smooth transition */}
        <div
          className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out',
            expanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div className="pt-3 border-t border-gray-200 dark:border-dark-border space-y-3">
            {/* Reasoning */}
            {opportunity.reasoning && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Razonamiento</h4>
                <p className="text-sm text-gray-600 dark:text-dark-text-secondary">{opportunity.reasoning}</p>
              </div>
            )}

            {/* Affected Files */}
            {opportunity.affected_files && opportunity.affected_files.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Archivos Afectados</h4>
                <div className="flex flex-wrap gap-1">
                  {opportunity.affected_files.map((file) => (
                    <span
                      key={file}
                      className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-dark-text-secondary text-xs rounded font-mono"
                    >
                      <FileCode className="h-3 w-3 mr-1" />
                      {file}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* External Reference */}
            {opportunity.external_reference && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Referencia Externa</h4>
                <a
                  href={opportunity.external_reference}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  {opportunity.external_reference}
                </a>
              </div>
            )}

            {/* Prompt Preview */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Prompt de Implementacion</h4>
              <pre className="text-xs text-gray-600 dark:text-dark-text-secondary bg-gray-50 dark:bg-dark-hover/50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                {opportunity.prompt.length > 500
                  ? opportunity.prompt.substring(0, 500) + '...'
                  : opportunity.prompt
                }
              </pre>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-dark-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Menos
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Mas Detalles
              </>
            )}
          </Button>

          {isPending && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleReject}
                disabled={isProcessing}
              >
                {isRejecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-1" />
                    Rechazar
                  </>
                )}
              </Button>
              <button
                onClick={handleApproveClick}
                disabled={isProcessing}
                className={cn(
                  'inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all',
                  'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700',
                  'shadow-sm shadow-green-200 dark:shadow-green-900/30',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Aprobar
                  </>
                )}
              </button>
            </div>
          )}

          <ApprovalModal
            isOpen={showApprovalModal}
            onClose={() => setShowApprovalModal(false)}
            onConfirm={handleApproveConfirm}
            opportunityTitle={opportunity.title}
            isLoading={isApproving}
          />

          {opportunity.status === 'in_progress' && (
            <div className="flex items-center gap-2 text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">En Progreso</span>
            </div>
          )}

          {opportunity.status === 'completed' && opportunity.task_id && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/tasks/${opportunity.task_id}`)}
            >
              Ver Task
            </Button>
          )}

          {opportunity.status === 'rejected' && (
            <Badge variant="secondary">Rechazada</Badge>
          )}

          {opportunity.status === 'failed' && (
            <Badge variant="error">Fallida</Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
