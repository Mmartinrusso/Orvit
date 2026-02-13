'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle2, XCircle, FileText, Cpu, Merge, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImportProgressProps {
  jobId: number;
  onComplete: (extractedData: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

interface JobStatus {
  id: number;
  status: string;
  stage: string;
  progressPercent: number;
  currentStep: string;
  totalFiles: number;
  processedFiles: number;
  errorMessage?: string;
  extractedData?: any;
  files?: Array<{
    id: number;
    fileName: string;
    fileTypes: string[];
    isProcessed: boolean;
  }>;
}

const STAGE_ICONS: Record<string, React.ReactNode> = {
  uploading: <FileText className="h-5 w-5" />,
  queued: <Loader2 className="h-5 w-5 animate-spin" />,
  starting: <Loader2 className="h-5 w-5 animate-spin" />,
  preprocessing: <FileText className="h-5 w-5" />,
  extracting: <Cpu className="h-5 w-5" />,
  merging: <Merge className="h-5 w-5" />,
  finalizing: <Package className="h-5 w-5" />,
  complete: <CheckCircle2 className="h-5 w-5 text-green-600" />,
  error: <XCircle className="h-5 w-5 text-destructive" />,
};

const STAGE_LABELS: Record<string, string> = {
  uploading: 'Subiendo archivos',
  queued: 'En cola',
  starting: 'Iniciando',
  preprocessing: 'Extrayendo texto',
  extracting: 'Analizando con IA',
  merging: 'Consolidando',
  finalizing: 'Finalizando',
  complete: 'Completado',
  error: 'Error',
};

const POLL_INTERVAL = 2000; // 2 seconds

export function ImportProgress({ jobId, onComplete, onError, onCancel }: ImportProgressProps) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/maquinas/import/${jobId}`);
      if (!response.ok) {
        throw new Error('Error al obtener estado');
      }

      const data: JobStatus = await response.json();
      setStatus(data);

      // Check completion
      if (data.status === 'DRAFT_READY') {
        setIsPolling(false);
        onComplete(data.extractedData);
      } else if (data.status === 'ERROR') {
        setIsPolling(false);
        onError(data.errorMessage || 'Error desconocido');
      } else if (data.status === 'COMPLETED') {
        setIsPolling(false);
        // Already confirmed, redirect?
      }

    } catch (error) {
      console.error('Error polling status:', error);
    }
  }, [jobId, onComplete, onError]);

  useEffect(() => {
    // Initial fetch
    fetchStatus();

    // Setup polling
    if (isPolling) {
      const interval = setInterval(fetchStatus, POLL_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [fetchStatus, isPolling]);

  const handleCancel = async () => {
    if (confirm('¿Cancelar la importación? Los archivos ya subidos serán eliminados.')) {
      try {
        await fetch(`/api/maquinas/import/${jobId}`, {
          method: 'DELETE',
        });
        onCancel();
      } catch (error) {
        console.error('Error canceling:', error);
      }
    }
  };

  const handleRetry = async () => {
    try {
      const response = await fetch(`/api/maquinas/import/${jobId}/process`, {
        method: 'POST',
      });

      if (response.ok) {
        setIsPolling(true);
      }
    } catch (error) {
      console.error('Error retrying:', error);
    }
  };

  if (!status) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const stages = ['uploading', 'preprocessing', 'extracting', 'merging', 'finalizing', 'complete'];
  const currentStageIndex = stages.indexOf(status.stage || 'uploading');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            {STAGE_ICONS[status.stage || 'uploading']}
            Procesando documentación
          </span>
          <Badge variant={status.status === 'ERROR' ? 'destructive' : 'secondary'}>
            {status.status}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{status.currentStep}</span>
            <span className="font-medium">{status.progressPercent}%</span>
          </div>
          <Progress value={status.progressPercent} className="h-3" />
        </div>

        {/* Stage Pipeline */}
        <div className="flex items-center justify-between">
          {stages.map((stage, index) => {
            const isActive = index === currentStageIndex;
            const isCompleted = index < currentStageIndex;
            const isError = status.status === 'ERROR' && isActive;

            return (
              <div key={stage} className="flex items-center">
                <div
                  className={cn(
                    "flex flex-col items-center gap-1",
                    isActive && "text-primary",
                    isCompleted && "text-green-600",
                    isError && "text-destructive",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center border-2",
                      isActive && "border-primary bg-primary/10",
                      isCompleted && "border-green-600 bg-green-50",
                      isError && "border-destructive bg-destructive/10",
                      !isActive && !isCompleted && !isError && "border-muted"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : isActive ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </div>
                  <span className="text-xs text-center max-w-[80px] truncate">
                    {STAGE_LABELS[stage]}
                  </span>
                </div>

                {index < stages.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 w-8 mx-1",
                      index < currentStageIndex ? "bg-green-600" : "bg-muted"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* File List */}
        {status.files && status.files.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Archivos ({status.processedFiles}/{status.totalFiles} procesados)
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1 rounded border p-2 bg-muted/30">
              {status.files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between py-1 px-2 rounded text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{file.fileName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {file.fileTypes?.map((type: string) => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                    {file.isProcessed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {status.status === 'ERROR' && status.errorMessage && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive">
            <p className="text-sm text-destructive font-medium mb-2">Error en el procesamiento:</p>
            <p className="text-sm text-destructive/80">{status.errorMessage}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          {status.status === 'ERROR' && (
            <Button variant="outline" onClick={handleRetry}>
              Reintentar
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={handleCancel}
            disabled={status.status === 'COMPLETED' || status.status === 'DRAFT_READY'}
          >
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
