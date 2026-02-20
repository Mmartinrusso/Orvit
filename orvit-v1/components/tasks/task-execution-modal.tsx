"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Clock, FileText, CheckCircle, Upload, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface FixedTask {
  id: string;
  title: string;
  description: string;
  frequency: 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'trimestral' | 'semestral' | 'anual';
  assignedTo: {
    id: string;
    name: string;
  };
  department: string;
  instructives: {
    id: string;
    title: string;
    content: string;
    attachments?: string[];
  }[];
  estimatedTime: number;
  priority: 'baja' | 'media' | 'alta';
  isActive: boolean;
  lastExecuted?: string;
  nextExecution: string;
  createdAt: string;
  completedAt?: string;
  isCompleted?: boolean;
}

interface TaskExecutionModalProps {
  task: FixedTask | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (taskId: string, executionData: ExecutionData) => void;
}

interface ExecutionData {
  actualTime: number;
  notes: string;
  attachments: File[];
  executedBy: string;
  completedAt: string;
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours} horas`;
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'alta': return 'bg-destructive/10 text-destructive border-destructive/30';
    case 'media': return 'bg-warning-muted text-warning-muted-foreground border-warning-muted';
    case 'baja': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/50';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

export function TaskExecutionModal({ 
  task, 
  isOpen, 
  onClose, 
  onComplete 
}: TaskExecutionModalProps) {
  const [actualTime, setActualTime] = useState<number>(task?.estimatedTime || 0);
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isCompleting, setIsCompleting] = useState(false);
  const [startTime] = useState<Date>(new Date());

  if (!task) return null;

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    
    const executionData: ExecutionData = {
      actualTime,
      notes,
      attachments,
      executedBy: "Usuario Actual", // En la app real, esto vendría del contexto de auth
      completedAt: new Date().toISOString()
    };

    try {
      await onComplete(task.id, executionData);
      
      // Reset form
      setActualTime(task.estimatedTime);
      setNotes("");
      setAttachments([]);
      
      onClose();
    } catch (error) {
      console.error("Error al completar tarea:", error);
    } finally {
      setIsCompleting(false);
    }
  };

  const timeDifference = actualTime - task.estimatedTime;
  const isOverTime = timeDifference > 0;
  const isUnderTime = timeDifference < 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <DialogTitle className="text-xl font-semibold text-foreground">
                Ejecutar Tarea
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={getPriorityColor(task.priority)}
                >
                  Prioridad {task.priority}
                </Badge>
                <Badge variant="outline">
                  {task.department}
                </Badge>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Iniciado:</p>
              <p className="text-sm font-medium text-foreground">
                {startTime.toLocaleTimeString()}
              </p>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {/* Información de la tarea */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {task.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{task.description}</p>
            </CardContent>
          </Card>

          {/* Tiempo de ejecución */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Tiempo de Ejecución
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Tiempo estimado
                  </label>
                  <p className="text-foreground font-medium">
                    {formatTime(task.estimatedTime)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Tiempo real (minutos)
                  </label>
                  <Input
                    type="number"
                    value={actualTime}
                    onChange={(e) => setActualTime(Number(e.target.value))}
                    min="1"
                    className="mt-1"
                  />
                </div>
              </div>
              
              {timeDifference !== 0 && (
                <div className={cn('p-3 rounded-lg border', isOverTime ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'bg-success-muted border-success-muted text-success')}>
                  <p className="text-sm font-medium">
                    {isOverTime 
                      ? `⚠️ Tiempo excedido en ${Math.abs(timeDifference)} minutos` 
                      : `✅ Completado ${Math.abs(timeDifference)} minutos antes`
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notas de ejecución */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notas de Ejecución</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Describe cómo se realizó la tarea, observaciones, problemas encontrados, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </CardContent>
          </Card>

          {/* Archivos adjuntos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Archivos Adjuntos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:bg-muted/50 transition-colors">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Clic para subir archivos (PDF, DOC, imágenes)
                    </p>
                  </div>
                </label>
              </div>

              {attachments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Archivos seleccionados:</p>
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded border">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-sm text-foreground">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeAttachment(index)}
                        className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isCompleting}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleComplete}
            disabled={isCompleting}
            className="bg-success hover:bg-success/90 text-white"
          >
            {isCompleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Completando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Completar Tarea
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 