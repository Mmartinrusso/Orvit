import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Sparkles } from 'lucide-react';
import { Button, Spinner } from '@/components/common';
import { ExpertModeSelector } from '@/components/forms';
import { PromptEnhancementPreview } from './PromptEnhancementPreview';
import { useEnhancePrompt } from '@/hooks/useTasks';
import { apiClient } from '@/api';
import type { ModelType, PipelineMode, ExpertMode } from '@/api';

interface TaskCreatorProps {
  onTaskCreated?: (taskId: string) => void;
}

export function TaskCreator({ onTaskCreated }: TaskCreatorProps) {
  const navigate = useNavigate();
  const enhanceMutation = useEnhancePrompt();

  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<ModelType>('sonnet');
  const [pipelineMode, setPipelineMode] = useState<PipelineMode>('auto');
  const [expertMode, setExpertMode] = useState<ExpertMode>('general');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Enhancement state
  const [enhancement, setEnhancement] = useState<{
    enhanced: string;
    improvements: string[];
    complexity: 'simple' | 'medium' | 'complex';
  } | null>(null);

  const handleSubmitTask = async (taskPrompt?: string) => {
    const finalPrompt = taskPrompt || prompt;
    if (!finalPrompt.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setEnhancement(null);
    try {
      const { data } = await apiClient.post('/api/task', {
        prompt: finalPrompt.trim(),
        model,
        pipeline_mode: pipelineMode,
        expert_mode: expertMode,
      });
      if (data.task_id) {
        setPrompt('');
        onTaskCreated?.(data.task_id);
        navigate(`/tasks/${data.task_id}`);
      }
    } catch {
      // Error handled by caller
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnhance = async () => {
    if (!prompt.trim() || enhanceMutation.isPending) return;
    try {
      const result = await enhanceMutation.mutateAsync({
        prompt: prompt.trim(),
        expert_mode: expertMode,
      });
      if (result.success && result.enhanced_prompt) {
        setEnhancement({
          enhanced: result.enhanced_prompt,
          improvements: result.improvements || [],
          complexity: result.estimated_complexity || 'medium',
        });
      }
    } catch {
      // Silently fail - user can still submit original
    }
  };

  const handleAcceptEnhancement = (acceptedPrompt: string) => {
    setEnhancement(null);
    handleSubmitTask(acceptedPrompt);
  };

  const handleEditEnhancement = (editPrompt: string) => {
    setPrompt(editPrompt);
    setEnhancement(null);
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-dark-surface">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Que quieres hacer?</p>
      <textarea
        value={prompt}
        onChange={(e) => { setPrompt(e.target.value); setEnhancement(null); }}
        placeholder="Describe la tarea... Ej: Agrega validacion al formulario de login"
        rows={3}
        className="w-full resize-none rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-dark-hover p-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); handleSubmitTask(); }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleEnhance(); }
        }}
      />

      {/* Expert Mode */}
      <div className="mt-3">
        <ExpertModeSelector value={expertMode} onChange={setExpertMode} />
      </div>

      {/* Enhancement Preview */}
      {enhancement && (
        <div className="mt-3">
          <PromptEnhancementPreview
            original={prompt}
            enhanced={enhancement.enhanced}
            improvements={enhancement.improvements}
            complexity={enhancement.complexity}
            onAccept={handleAcceptEnhancement}
            onEdit={handleEditEnhancement}
            onDismiss={() => setEnhancement(null)}
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as ModelType)}
            className="text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-dark-hover px-2 py-1 text-slate-600 dark:text-slate-300"
          >
            <option value="sonnet">Sonnet</option>
            <option value="opus">Opus</option>
            <option value="haiku">Haiku</option>
          </select>
          <select
            value={pipelineMode}
            onChange={(e) => setPipelineMode(e.target.value as PipelineMode)}
            className="text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-dark-hover px-2 py-1 text-slate-600 dark:text-slate-300"
          >
            <option value="auto">Auto</option>
            <option value="fast">Fast</option>
            <option value="full">Full</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleEnhance}
            disabled={!prompt.trim() || enhanceMutation.isPending}
          >
            {enhanceMutation.isPending ? <Spinner size="sm" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Mejorar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSubmitTask()}
            disabled={!prompt.trim() || isSubmitting}
          >
            {isSubmitting ? <Spinner size="sm" /> : <Play className="h-4 w-4 mr-1" />}
            Ejecutar
          </Button>
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 dark:text-slate-500">
        <span>Ctrl+Enter: mejorar</span>
        <span>Shift+Enter: ejecutar directo</span>
      </div>
    </div>
  );
}
