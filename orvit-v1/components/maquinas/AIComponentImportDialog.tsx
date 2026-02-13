'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Copy,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { COMPONENT_ONLY_PROMPTS, OutputLanguage } from '@/lib/import/extraction-prompt';

const LANGUAGE_LABELS: Record<OutputLanguage, string> = {
  es: 'Español',
  en: 'English',
  it: 'Italiano',
  pt: 'Português',
};

interface AIComponentImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  machineId: number;
  machineName: string;
}

export default function AIComponentImportDialog({
  isOpen,
  onClose,
  onSuccess,
  machineId,
  machineName,
}: AIComponentImportDialogProps) {
  const [language, setLanguage] = useState<OutputLanguage>('es');
  const [aiResponse, setAiResponse] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCopyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(COMPONENT_ONLY_PROMPTS[language]);
      setPromptCopied(true);
      toast.success('Prompt copiado al portapapeles');
      setTimeout(() => setPromptCopied(false), 3000);
    } catch {
      toast.error('No se pudo copiar');
    }
  }, [language]);

  const handleCreate = useCallback(async () => {
    if (!aiResponse.trim()) return;

    setIsCreating(true);
    toast.loading('Creando componentes...', { id: 'ai-import' });

    try {
      const res = await fetch('/api/components/import-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiResponse, machineId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar');
      }

      toast.success(`${data.componentsCreated} componentes creados`, { id: 'ai-import' });
      setAiResponse('');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Error al crear componentes', { id: 'ai-import' });
    } finally {
      setIsCreating(false);
    }
  }, [aiResponse, machineId, onSuccess, onClose]);

  const handleClose = () => {
    if (isCreating) return;
    setAiResponse('');
    setPromptCopied(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent size="lg" className="max-h-[95vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Agregar componentes con IA
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Máquina: <span className="font-medium">{machineName}</span>
          </p>
        </DialogHeader>

        <DialogBody className="flex-1 overflow-y-auto space-y-5">
          {/* Step 1: Copy Prompt */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              <Label className="font-semibold">Copiá el prompt</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Usá este prompt en ChatGPT, Gemini o Claude junto con tus documentos técnicos (PDF, imágenes)
            </p>

            {/* Language selector */}
            <div className="flex items-center gap-2">
              <Label className="text-xs">Idioma:</Label>
              <div className="flex gap-1">
                {(Object.keys(LANGUAGE_LABELS) as OutputLanguage[]).map((lang) => (
                  <Button
                    key={lang}
                    variant={language === lang ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setLanguage(lang);
                      setPromptCopied(false);
                    }}
                    className="px-2 h-7 text-xs"
                  >
                    {LANGUAGE_LABELS[lang]}
                  </Button>
                ))}
              </div>
            </div>

            {/* Prompt preview + copy */}
            <div className="relative">
              <pre className="bg-muted p-3 rounded-lg text-[11px] overflow-auto max-h-56 whitespace-pre-wrap font-mono">
                {COMPONENT_ONLY_PROMPTS[language]}
              </pre>
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2 h-7 text-xs"
                onClick={handleCopyPrompt}
              >
                {promptCopied ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copiar
                  </>
                )}
              </Button>
            </div>

            {/* AI service links */}
            <div className="flex flex-wrap gap-1.5">
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <a href="https://chat.openai.com" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  ChatGPT
                </a>
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Gemini
                </a>
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <a href="https://claude.ai" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Claude
                </a>
              </Button>
            </div>
          </div>

          {/* Step 2: Paste Response */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              <Label className="font-semibold">Pegá la respuesta de la IA</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Copiá la respuesta completa que te devuelve la IA y pegala acá
            </p>

            <Textarea
              placeholder={'Pegá acá la respuesta de la IA...\n\n=== ÁRBOL DE COMPONENTES ===\n├── Ensamble Principal\n│   ├── Pieza 1\n\n=== DETALLE DE COMPONENTES ===\n...'}
              className="min-h-[200px] font-mono text-xs"
              value={aiResponse}
              onChange={(e) => setAiResponse(e.target.value)}
              disabled={isCreating}
            />

            <p className="text-xs text-muted-foreground">
              {aiResponse.length > 0 ? `${aiResponse.length} caracteres` : 'Esperando respuesta...'}
            </p>
          </div>

          {/* Info card */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 text-xs">Cómo funciona</p>
                <ol className="mt-1 space-y-0.5 text-[11px] text-amber-700 list-decimal list-inside">
                  <li>Copiá el prompt de arriba</li>
                  <li>Abrí ChatGPT, Gemini o Claude</li>
                  <li>Subí tus documentos técnicos (PDF, imágenes)</li>
                  <li>Pegá el prompt y enviá</li>
                  <li>Copiá la respuesta y pegala acá</li>
                </ol>
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!aiResponse.trim() || isCreating}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Crear componentes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
