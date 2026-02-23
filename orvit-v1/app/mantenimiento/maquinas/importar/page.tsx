'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Upload,
  Cpu,
  CheckCircle2,
  FileText,
  FolderArchive,
  Sparkles,
  AlertTriangle,
  HelpCircle,
  Copy,
  ClipboardPaste,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import {
  ImportDropzone,
  ImportProgress,
  ImportReview,
  ExtractedMachineData,
} from '@/components/maquinas/import';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  SIMPLE_EXTRACTION_PROMPTS,
  type OutputLanguage,
} from '@/lib/import/extraction-prompt';

type ImportStep = 'upload' | 'processing' | 'review' | 'complete';
type ImportMode = 'upload' | 'external-ai';

// UI labels for language selector (names in their own language)
const LANGUAGE_LABELS: Record<OutputLanguage, string> = {
  es: 'Español',
  en: 'English',
  it: 'Italiano',
  pt: 'Português',
};

export default function ImportarMaquinaPage() {
  const router = useRouter();
  const { currentCompany, currentSector } = useCompany();

  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [importMode, setImportMode] = useState<ImportMode>('external-ai'); // Default to external AI
  const [jobId, setJobId] = useState<number | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedMachineData | null>(null);
  const [createdMachineId, setCreatedMachineId] = useState<number | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // External AI states
  const [aiResponse, setAiResponse] = useState('');
  const [isParsingResponse, setIsParsingResponse] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>('es');

  // Handle upload complete
  const handleUploadComplete = useCallback(async (newJobId: number) => {
    setJobId(newJobId);
    setCurrentStep('processing');

    // Start processing
    try {
      const response = await fetch(`/api/maquinas/import/${newJobId}/process`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al iniciar procesamiento');
      }
    } catch (error) {
      console.error('Error starting processing:', error);
      toast.error('Error al iniciar el procesamiento');
    }
  }, []);

  // Handle processing complete
  const handleProcessingComplete = useCallback((data: any) => {
    setExtractedData(data);
    setCurrentStep('review');
    toast.success('Análisis completado');
  }, []);

  // Handle processing error
  const handleProcessingError = useCallback((error: string) => {
    toast.error(error);
  }, []);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setJobId(null);
    setExtractedData(null);
    setCurrentStep('upload');
  }, []);

  // Handle data change
  const handleDataChange = useCallback((newData: ExtractedMachineData) => {
    setExtractedData(newData);
  }, []);

  // Handle confirm
  const handleConfirm = useCallback(async () => {
    if (!jobId || !extractedData) return;

    // Validate required fields
    if (!currentSector?.id) {
      toast.error('Debes seleccionar un sector antes de confirmar');
      return;
    }

    setIsConfirming(true);

    try {
      // First, save the reviewed data
      await fetch(`/api/maquinas/import/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewedData: extractedData }),
      });

      // Then confirm and create the machine
      const response = await fetch(`/api/maquinas/import/${jobId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectorId: currentSector.id,
          acquisitionDate: new Date().toISOString(), // Default to today
          includePending: true, // Include all components
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear la máquina');
      }

      const result = await response.json();
      setCreatedMachineId(result.machineId);
      setCurrentStep('complete');
      toast.success('Máquina creada exitosamente');

    } catch (error) {
      console.error('Error confirming:', error);
      toast.error(error instanceof Error ? error.message : 'Error al crear la máquina');
    } finally {
      setIsConfirming(false);
    }
  }, [jobId, extractedData, currentSector?.id]);

  // Handle view machine
  const handleViewMachine = useCallback(() => {
    if (createdMachineId) {
      router.push(`/mantenimiento/maquinas/${createdMachineId}`);
    }
  }, [createdMachineId, router]);

  // Handle import another
  const handleImportAnother = useCallback(() => {
    setJobId(null);
    setExtractedData(null);
    setCreatedMachineId(null);
    setCurrentStep('upload');
    setAiResponse('');
  }, []);

  // Copy prompt to clipboard
  const handleCopyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SIMPLE_EXTRACTION_PROMPTS[outputLanguage]);
      setPromptCopied(true);
      toast.success('Prompt copiado al portapapeles');
      setTimeout(() => setPromptCopied(false), 3000);
    } catch {
      toast.error('Error al copiar');
    }
  }, [outputLanguage]);

  // Parse external AI response
  const handleParseResponse = useCallback(async () => {
    if (!aiResponse.trim()) {
      toast.error('Pegá la respuesta de la IA');
      return;
    }

    setIsParsingResponse(true);

    try {
      const response = await fetch('/api/maquinas/import/parse-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiResponse }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al parsear respuesta');
      }

      const result = await response.json();
      setExtractedData(result.data);
      setJobId(result.jobId);
      setCurrentStep('review');
      toast.success(`Datos extraídos: ${result.data.components?.length || 0} componentes`);
    } catch (error) {
      console.error('Error parsing response:', error);
      toast.error(error instanceof Error ? error.message : 'Error al procesar la respuesta');
    } finally {
      setIsParsingResponse(false);
    }
  }, [aiResponse]);

  // Step indicator
  const steps = [
    { key: 'upload', label: 'Subir', icon: Upload },
    { key: 'processing', label: 'Procesar', icon: Cpu },
    { key: 'review', label: 'Revisar', icon: FileText },
    { key: 'complete', label: 'Completado', icon: CheckCircle2 },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b">
          <div className="w-full px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-primary" />
                    Importador de Dossier Técnico
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Crea máquinas automáticamente desde documentación técnica con IA
                  </p>
                </div>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <HelpCircle className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <p className="font-medium mb-1">Cómo funciona:</p>
                  <ol className="text-xs space-y-1 list-decimal list-inside">
                    <li>Sube PDFs, planos o un ZIP con documentación</li>
                    <li>La IA analiza y extrae información</li>
                    <li>Revisa y edita los datos extraídos</li>
                    <li>Confirma para crear la máquina</li>
                  </ol>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-center mt-6 gap-2">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === currentStepIndex;
                const isCompleted = index < currentStepIndex;

                return (
                  <div key={step.key} className="flex items-center">
                    <div
                      className={`
                        flex items-center gap-2 px-4 py-2 rounded-full transition-colors
                        ${isActive ? 'bg-primary text-primary-foreground' : ''}
                        ${isCompleted ? 'bg-success-muted text-success' : ''}
                        ${!isActive && !isCompleted ? 'bg-muted text-muted-foreground' : ''}
                      `}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                      <span className="text-sm font-medium">{step.label}</span>
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`w-8 h-0.5 mx-1 ${
                          index < currentStepIndex ? 'bg-success' : 'bg-muted'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="w-full px-8 py-8">
          {/* Step: Upload */}
          {currentStep === 'upload' && (
            <div className="space-y-6">
              {/* Mode Tabs */}
              <Tabs value={importMode} onValueChange={(v) => setImportMode(v as ImportMode)} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload" disabled className="flex items-center gap-2 opacity-50 cursor-not-allowed">
                    <Upload className="h-4 w-4" />
                    Subir Archivos
                    <Badge variant="outline" className="ml-1 text-xs px-1">Próximamente</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="external-ai" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Usar IA Externa
                  </TabsTrigger>
                </TabsList>

                {/* Tab: Upload Files */}
                <TabsContent value="upload" className="space-y-6 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FolderArchive className="h-5 w-5" />
                        Sube tu documentación técnica
                      </CardTitle>
                      <CardDescription>
                        Soportamos PDFs de manuales, planos, hojas de datos, BOM y más.
                        También puedes subir un ZIP con toda la documentación de la máquina.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ImportDropzone onUploadComplete={handleUploadComplete} />
                    </CardContent>
                  </Card>

                  {/* Info cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full bg-info-muted flex items-center justify-center flex-shrink-0">
                            <FileText className="h-5 w-5 text-info-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Formatos soportados</p>
                            <p className="text-xs text-muted-foreground">
                              PDF, JPG, PNG, WebP, GIF, TIFF, ZIP
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <Cpu className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Análisis con IA</p>
                            <p className="text-xs text-muted-foreground">
                              GPT-4 extrae datos y estructura componentes
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full bg-success-muted flex items-center justify-center flex-shrink-0">
                            <CheckCircle2 className="h-5 w-5 text-success" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Revisión humana</p>
                            <p className="text-xs text-muted-foreground">
                              Siempre podrás editar antes de confirmar
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Tips */}
                  <Card className="border-info-muted bg-info-muted">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-info-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="font-medium text-info-muted-foreground text-sm">Tips para mejores resultados</p>
                          <ul className="mt-2 space-y-1 text-xs text-info-muted-foreground">
                            <li>• Incluye el manual de usuario o servicio completo</li>
                            <li>• Los planos de despiece ayudan a identificar componentes</li>
                            <li>• Las hojas de datos técnicos mejoran la información extraída</li>
                            <li>• Nombrando los archivos descriptivamente ayuda al análisis</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab: External AI */}
                <TabsContent value="external-ai" className="space-y-6 mt-6">
                  {/* Step 1: Copy Prompt */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
                        Copiá el prompt
                      </CardTitle>
                      <CardDescription>
                        Usá este prompt en ChatGPT, Gemini, Claude u otra IA junto con tus documentos técnicos
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Language selector */}
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">Idioma de salida:</Label>
                        <div className="flex gap-1">
                          {(Object.keys(LANGUAGE_LABELS) as OutputLanguage[]).map((lang) => (
                            <Button
                              key={lang}
                              variant={outputLanguage === lang ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setOutputLanguage(lang)}
                              className="px-3"
                            >
                              {LANGUAGE_LABELS[lang]}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-64 whitespace-pre-wrap font-mono">
                          {SIMPLE_EXTRACTION_PROMPTS[outputLanguage]}
                        </pre>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={handleCopyPrompt}
                        >
                          {promptCopied ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-1" />
                              Copiar
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a href="https://chat.openai.com" target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-1" />
                            ChatGPT
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Gemini
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a href="https://claude.ai" target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Claude
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Step 2: Paste Response */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
                        Pegá la respuesta de la IA
                      </CardTitle>
                      <CardDescription>
                        Copiá la respuesta que te devuelve la IA y pegala acá
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        placeholder='Pegá acá la respuesta de la IA...&#10;&#10;=== MÁQUINA ===&#10;Nombre: ...&#10;&#10;=== COMPONENTES ===&#10;1. Componente&#10;   - Padre: ...'
                        className="min-h-[200px] font-mono text-sm"
                        value={aiResponse}
                        onChange={(e) => setAiResponse(e.target.value)}
                      />

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {aiResponse.length > 0 ? `${aiResponse.length} caracteres` : 'Esperando respuesta...'}
                        </p>
                        <Button
                          onClick={handleParseResponse}
                          disabled={!aiResponse.trim() || isParsingResponse}
                        >
                          {isParsingResponse ? (
                            <>
                              <Cpu className="h-4 w-4 mr-2 animate-spin" />
                              Procesando...
                            </>
                          ) : (
                            <>
                              <ClipboardPaste className="h-4 w-4 mr-2" />
                              Procesar respuesta
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Info */}
                  <Card className="border-warning-muted bg-warning-muted">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-warning-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="font-medium text-warning-muted-foreground text-sm">Cómo usar IA externa</p>
                          <ol className="mt-2 space-y-1 text-xs text-warning-muted-foreground list-decimal list-inside">
                            <li>Copiá el prompt de arriba</li>
                            <li>Andá a ChatGPT, Gemini o Claude</li>
                            <li>Subí tus documentos técnicos (PDF, imágenes)</li>
                            <li>Pegá el prompt y enviá</li>
                            <li>Copiá la respuesta y pegala acá</li>
                          </ol>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Step: Processing */}
          {currentStep === 'processing' && jobId && (
            <div className="max-w-2xl mx-auto">
              <ImportProgress
                jobId={jobId}
                onComplete={handleProcessingComplete}
                onError={handleProcessingError}
                onCancel={handleCancel}
              />
            </div>
          )}

          {/* Step: Review */}
          {currentStep === 'review' && extractedData && jobId && (
            <ImportReview
              data={extractedData}
              jobId={jobId}
              onDataChange={handleDataChange}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
              isConfirming={isConfirming}
            />
          )}

          {/* Step: Complete */}
          {currentStep === 'complete' && (
            <div className="max-w-lg mx-auto text-center">
              <Card>
                <CardContent className="py-12">
                  <div className="h-20 w-20 rounded-full bg-success-muted flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="h-10 w-10 text-success" />
                  </div>

                  <h2 className="text-2xl font-bold mb-2">¡Máquina creada!</h2>
                  <p className="text-muted-foreground mb-6">
                    La máquina y sus {extractedData?.components.length || 0} componentes han sido creados exitosamente.
                  </p>

                  <div className="flex items-center justify-center gap-4">
                    <Button variant="outline" onClick={handleImportAnother}>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar otra
                    </Button>
                    <Button onClick={handleViewMachine}>
                      Ver máquina
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
