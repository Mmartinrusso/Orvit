import { useState } from 'react';
import { CheckCircle, Loader2, Cpu, Zap } from 'lucide-react';
import { Modal, Button, Select } from '@/components/common';
import type { ModelType, PipelineMode } from '@/api/types';

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (model: ModelType, pipelineMode: PipelineMode) => void;
  opportunityTitle: string;
  isLoading?: boolean;
}

const modelOptions = [
  { value: 'sonnet', label: 'Sonnet (Recomendado)' },
  { value: 'haiku', label: 'Haiku (Rapido)' },
  { value: 'opus', label: 'Opus (Mas Capaz)' },
];

const pipelineModeOptions = [
  { value: 'simple', label: 'Simple (Un solo agente, directo)' },
  { value: 'auto', label: 'Auto (Recomendado)' },
  { value: 'fast', label: 'Fast (2 etapas, rapido)' },
  { value: 'full', label: 'Full (7 etapas, mas verificacion)' },
];

export function ApprovalModal({
  isOpen,
  onClose,
  onConfirm,
  opportunityTitle,
  isLoading,
}: ApprovalModalProps) {
  const [model, setModel] = useState<ModelType>('sonnet');
  const [pipelineMode, setPipelineMode] = useState<PipelineMode>('auto');

  const handleConfirm = () => {
    onConfirm(model, pipelineMode);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Aprobar Oportunidad"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Aprobando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Aprobar y Ejecutar
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
          Vas a aprobar la implementacion de:
        </p>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="font-medium text-gray-900">{opportunityTitle}</p>
        </div>

        <div className="space-y-4 pt-2">
          <div className="flex items-start gap-2">
            <Cpu className="h-5 w-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <Select
                label="Modelo de IA"
                value={model}
                onChange={(e) => setModel(e.target.value as ModelType)}
                options={modelOptions}
              />
              <p className="mt-1 text-xs text-gray-500">
                Sonnet balancea costo y capacidad. Opus es mas capaz pero mas costoso.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Zap className="h-5 w-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <Select
                label="Modo de Ejecucion"
                value={pipelineMode}
                onChange={(e) => setPipelineMode(e.target.value as PipelineMode)}
                options={pipelineModeOptions}
              />
              <p className="mt-1 text-xs text-gray-500">
                Simple usa un solo agente. Auto selecciona entre Fast y Full segun complejidad.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
