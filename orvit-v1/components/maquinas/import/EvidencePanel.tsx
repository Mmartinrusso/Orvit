'use client';

import { useState } from 'react';
import {
  FileText,
  ExternalLink,
  Eye,
  ChevronRight,
  Quote,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

export interface Evidence {
  fileId: number;
  fileName: string;
  page?: number;
  snippet?: string;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface EvidencePanelProps {
  evidences: Evidence[];
  componentName: string;
  onViewFile: (fileId: number, page?: number) => void;
  jobId: number;
}

export function EvidencePanel({ evidences = [], componentName, onViewFile, jobId }: EvidencePanelProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopySnippet = async (snippet: string, index: number) => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiedIndex(index);
      toast.success('Texto copiado');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      toast.error('Error al copiar');
    }
  };

  // Early return if no evidences (check before reduce)
  if (!evidences || evidences.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Evidencias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Quote className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Sin evidencias documentales</p>
            <p className="text-xs mt-1">
              Este componente no tiene referencias en los documentos analizados
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const groupedByFile = evidences.reduce((acc, ev) => {
    if (!acc[ev.fileName]) {
      acc[ev.fileName] = [];
    }
    acc[ev.fileName].push(ev);
    return acc;
  }, {} as Record<string, Evidence[]>);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Evidencias para "{componentName}"
          </span>
          <Badge variant="secondary">{evidences.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="p-4 space-y-4">
            {Object.entries(groupedByFile).map(([fileName, fileEvidences]) => (
              <div key={fileName}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium truncate max-w-[200px]" title={fileName}>
                      {fileName}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {fileEvidences.length} ref
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => onViewFile(fileEvidences[0].fileId)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Ver
                  </Button>
                </div>

                <div className="space-y-2 pl-6">
                  {fileEvidences.map((evidence, index) => (
                    <div
                      key={`${evidence.fileId}-${evidence.page}-${index}`}
                      className="group relative rounded-lg border bg-muted/30 p-3 hover:bg-muted/50 transition-colors"
                    >
                      {/* Page Reference */}
                      {evidence.page && (
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary" className="text-xs">
                            Página {evidence.page}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => onViewFile(evidence.fileId, evidence.page)}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      {/* Snippet */}
                      {evidence.snippet && (
                        <div className="relative">
                          <Quote className="absolute -left-1 -top-1 h-3 w-3 text-muted-foreground/50" />
                          <p className="text-sm text-muted-foreground pl-3 pr-8 italic leading-relaxed">
                            "{evidence.snippet}"
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleCopySnippet(evidence.snippet!, index)}
                          >
                            {copiedIndex === index ? (
                              <Check className="h-3 w-3 text-success" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      )}

                      {/* BBox indicator */}
                      {evidence.bbox && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <ChevronRight className="h-3 w-3" />
                          <span>Ubicación marcada en documento</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <Separator className="mt-4" />
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
