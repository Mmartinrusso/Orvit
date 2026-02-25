'use client';

import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Upload, Eye, Trash2 } from 'lucide-react';
import { SectionCard } from '../SectionCard';
import { EmptyState } from '../EmptyState';

interface InstructivesStepProps {
  instructives: any[];
  instructiveDescription: string;
  setInstructiveDescription: React.Dispatch<React.SetStateAction<string>>;
  uploadingInstructive: boolean;
  handleInstructiveUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDeleteInstructive: (id: string) => void;
  handleViewInstructive: (url: string) => void;
}

export function InstructivesStep({
  instructives,
  instructiveDescription,
  setInstructiveDescription,
  uploadingInstructive,
  handleInstructiveUpload,
  handleDeleteInstructive,
  handleViewInstructive,
}: InstructivesStepProps) {
  return (
    <>
      {/* Subir Instructivo */}
      <SectionCard
        title="Subir Instructivo"
        icon={Upload}
        description="Archivos con las instrucciones detalladas para realizar este mantenimiento"
      >
        <div className="space-y-4">
          {/* Dropzone */}
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 hover:border-muted-foreground/40 transition-colors">
            <div className="text-center space-y-4">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
              <div>
                <h4 className="text-sm font-semibold mb-1">Seleccionar archivo</h4>
                <p className="text-xs text-muted-foreground">
                  Máx 10MB
                </p>
              </div>

              {/* Campo de descripción */}
              <div className="text-left max-w-md mx-auto">
                <Label htmlFor="instructiveDescription" className="text-xs font-medium">
                  Descripción del instructivo
                </Label>
                <Textarea
                  id="instructiveDescription"
                  placeholder="Describe brevemente el contenido..."
                  value={instructiveDescription}
                  onChange={(e) => setInstructiveDescription(e.target.value)}
                  className="mt-1.5 resize-none"
                  rows={3}
                />
              </div>

              <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 transition-colors text-sm">
                <Upload className="h-4 w-4" />
                {uploadingInstructive ? 'Subiendo...' : 'Seleccionar archivo'}
                <input
                  type="file"
                  onChange={handleInstructiveUpload}
                  className="hidden"
                  disabled={uploadingInstructive}
                />
              </label>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Lista de instructivos */}
      <SectionCard
        title={`Instructivos subidos (${instructives.length})`}
        icon={FileText}
        description={instructives.length === 0 ? 'Los instructivos ayudarán a los técnicos a realizar el mantenimiento correctamente' : undefined}
      >
        {instructives.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No hay instructivos subidos"
            subtitle="Sube archivos con las instrucciones para este mantenimiento"
          />
        ) : (
          <div className="space-y-3">
            {instructives.map((instructive) => (
              <div
                key={instructive.id}
                className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs truncate">
                      {instructive.originalName || instructive.fileName}
                    </p>
                    {instructive.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {instructive.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Subido el {new Date(instructive.uploadedAt).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewInstructive(instructive.url)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteInstructive(instructive.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}
