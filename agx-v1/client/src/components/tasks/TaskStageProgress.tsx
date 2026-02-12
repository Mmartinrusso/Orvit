import { Check } from 'lucide-react';
import type { StageRecord, PipelineStage } from '@/api';
import { cn } from '@/utils';

const FULL_PIPELINE_STAGES: PipelineStage[] = [
  'locator',
  'planner',
  'implementer',
  'verifier',
  'fixer',
  'git',
];

const FAST_PIPELINE_STAGES: PipelineStage[] = ['fast-dev', 'fast-finish'];

const SIMPLE_PIPELINE_STAGES: PipelineStage[] = ['simple'];

const STAGE_LABELS: Record<string, string> = {
  analyzer: 'Analizador',
  locator: 'Localizador',
  planner: 'Planificador',
  implementer: 'Implementador',
  verifier: 'Verificador',
  fixer: 'Corrector',
  git: 'Git',
  'fast-dev': 'Dev',
  'fast-finish': 'Finish',
  simple: 'Simple',
};

interface TaskStageProgressProps {
  stages: StageRecord[];
  currentStage?: string;
}

export function TaskStageProgress({ stages, currentStage }: TaskStageProgressProps) {
  const completedStages = stages.map((s) => s.stage_name);
  const isSimpleMode = stages.some((s) => s.stage_name === 'simple') || currentStage === 'simple';
  const isFastMode = stages.some(
    (s) => s.stage_name === 'fast-dev' || s.stage_name === 'fast-finish'
  );
  const pipelineStages = isSimpleMode
    ? SIMPLE_PIPELINE_STAGES
    : isFastMode
    ? FAST_PIPELINE_STAGES
    : FULL_PIPELINE_STAGES;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {pipelineStages.map((stage, index) => {
        const isCompleted = completedStages.includes(stage);
        const isCurrent = currentStage === stage;
        const stageData = stages.find((s) => s.stage_name === stage);
        const hasFailed = stageData && !stageData.success;

        return (
          <div key={stage} className="flex items-center">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all',
                isCompleted && !hasFailed && 'bg-green-500 text-white',
                hasFailed && 'bg-red-500 text-white',
                isCurrent && !isCompleted && 'bg-blue-500 text-white animate-pulse',
                !isCompleted && !isCurrent && 'bg-gray-200 text-gray-500 dark:bg-dark-hover dark:text-dark-text-secondary'
              )}
              title={`${STAGE_LABELS[stage]}${stageData?.duration_ms ? ` - ${stageData.duration_ms}ms` : ''}`}
            >
              {isCompleted && !hasFailed ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            {index < pipelineStages.length - 1 && (
              <div
                className={cn(
                  'w-6 h-0.5 mx-1',
                  isCompleted && !hasFailed ? 'bg-green-500' : 'bg-gray-200 dark:bg-dark-hover'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
