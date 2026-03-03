"use client";

import { useState } from "react";
import { formatNumber } from '@/lib/utils';
import { Clock, FileText, CheckCircle, Upload, X, Loader2, Minus, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ── Design tokens (equal to FixedTaskDetailSheet) ────────────────────────────

const FREQ_CONF: Record<string, { label: string; short: string; bg: string; border: string; color: string }> = {
  diaria:     { label: 'Diaria',     short: 'D',  bg: '#EDF4F0', border: '#C2D4C8', color: '#305848' },
  semanal:    { label: 'Semanal',    short: 'S',  bg: '#EEF3F8', border: '#CCDAE8', color: '#3A5878' },
  quincenal:  { label: 'Quincenal',  short: 'Q',  bg: '#F5F2EA', border: '#DED5B0', color: '#685C30' },
  mensual:    { label: 'Mensual',    short: 'M',  bg: '#F3EFF8', border: '#D8CBE8', color: '#584878' },
  trimestral: { label: 'Trimestral', short: 'T',  bg: '#FAF0EB', border: '#E8D0C0', color: '#784838' },
  semestral:  { label: 'Semestral',  short: 'Se', bg: '#EBF4F4', border: '#B8D8D8', color: '#305858' },
  anual:      { label: 'Anual',      short: 'A',  bg: '#F0EEF8', border: '#C8C4D8', color: '#484858' },
};

const PRIORITY_CONF: Record<string, { label: string; bg: string; text: string }> = {
  baja:  { label: 'Baja',  bg: '#F3F4F6', text: '#6B7280' },
  media: { label: 'Media', bg: '#EFF6FF', text: '#1D4ED8' },
  alta:  { label: 'Alta',  bg: '#FEF3C7', text: '#D97706' },
};

// ── Types ────────────────────────────────────────────────────────────────────

interface FixedTask {
  id: string;
  title: string;
  description: string;
  frequency: 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'trimestral' | 'semestral' | 'anual';
  assignedTo: { id: string; name: string };
  department: string;
  instructives: { id: string; title: string; content: string; attachments?: string[] }[];
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

// ── Component ────────────────────────────────────────────────────────────────

export function TaskExecutionModal({ task, isOpen, onClose, onComplete }: TaskExecutionModalProps) {
  const [actualTime, setActualTime] = useState<number>(task?.estimatedTime || 0);
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isCompleting, setIsCompleting] = useState(false);
  const [startTime] = useState<Date>(new Date());

  if (!task) return null;

  const freqCfg = FREQ_CONF[task.frequency] ?? FREQ_CONF.mensual;
  const priCfg = PRIORITY_CONF[task.priority] ?? PRIORITY_CONF.baja;

  const timeDiff = actualTime - task.estimatedTime;
  const isOverTime = timeDiff > 0;
  const isUnderTime = timeDiff < 0;

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
      executedBy: "Usuario Actual",
      completedAt: new Date().toISOString(),
    };
    try {
      await onComplete(task.id, executionData);
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          {/* Compact task header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                {/* Frequency badge */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '3px 10px', borderRadius: '999px',
                  background: freqCfg.bg, border: `1px solid ${freqCfg.border}`,
                  fontSize: '11px', fontWeight: 700, color: freqCfg.color,
                }}>
                  {freqCfg.short} · {freqCfg.label}
                </span>
                {/* Priority badge */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '3px 10px', borderRadius: '999px',
                  background: priCfg.bg,
                  fontSize: '11px', fontWeight: 700, color: priCfg.text,
                }}>
                  {priCfg.label}
                </span>
              </div>
              <DialogTitle style={{ fontSize: '17px', fontWeight: 700, color: '#111827', lineHeight: 1.3, letterSpacing: '-0.02em' }}>
                {task.title}
              </DialogTitle>
              {task.description && (
                <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px', lineHeight: 1.5 }}>
                  {task.description}
                </p>
              )}
            </div>
            {/* Start time */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: '10px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Inicio</p>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginTop: '2px' }}>
                {startTime.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-5">

          {/* Tiempo de ejecución */}
          <div style={{ border: '1px solid #E4E4E8', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0F0F4', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock style={{ height: '14px', width: '14px', color: '#9CA3AF', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151', letterSpacing: '-0.01em' }}>Tiempo de ejecución</span>
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Estimado</p>
                  <p style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>{formatTime(task.estimatedTime)}</p>
                </div>
                {/* +/- time control */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tiempo real</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => setActualTime(t => Math.max(1, t - 5))}
                      style={{
                        width: '30px', height: '30px', borderRadius: '8px',
                        border: '1px solid #E4E4E8', background: '#FAFAFA',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 120ms ease', color: '#374151',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#FAFAFA'; }}
                    >
                      <Minus style={{ height: '12px', width: '12px' }} />
                    </button>
                    <div style={{ textAlign: 'center', minWidth: '72px' }}>
                      <p style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>{formatTime(actualTime)}</p>
                      <p style={{ fontSize: '10px', color: '#9CA3AF' }}>{actualTime} min</p>
                    </div>
                    <button
                      onClick={() => setActualTime(t => t + 5)}
                      style={{
                        width: '30px', height: '30px', borderRadius: '8px',
                        border: '1px solid #E4E4E8', background: '#FAFAFA',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 120ms ease', color: '#374151',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#FAFAFA'; }}
                    >
                      <Plus style={{ height: '12px', width: '12px' }} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Time diff indicator */}
              {timeDiff !== 0 && (
                <div style={{
                  padding: '8px 12px', borderRadius: '8px',
                  background: isOverTime ? '#FEF2F2' : '#ECFDF5',
                  border: `1px solid ${isOverTime ? '#FECACA' : '#A7F3D0'}`,
                }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: isOverTime ? '#DC2626' : '#059669' }}>
                    {isOverTime
                      ? `⚠ Tiempo excedido en ${Math.abs(timeDiff)} min`
                      : `✓ Completado ${Math.abs(timeDiff)} min antes del estimado`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notas */}
          <div style={{ border: '1px solid #E4E4E8', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0F0F4', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText style={{ height: '14px', width: '14px', color: '#9CA3AF', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151', letterSpacing: '-0.01em' }}>Notas de ejecución</span>
              <span style={{ fontSize: '11px', color: '#C8C8D0', marginLeft: 'auto' }}>Opcional</span>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <Textarea
                placeholder="Observaciones, problemas encontrados, acciones tomadas..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                style={{
                  resize: 'none', border: '1px solid #E4E4E8', borderRadius: '8px',
                  fontSize: '13px', color: '#374151', padding: '10px 12px',
                  outline: 'none', width: '100%', background: '#FAFAFA',
                }}
              />
            </div>
          </div>

          {/* Adjuntos */}
          <div style={{ border: '1px solid #E4E4E8', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0F0F4', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Upload style={{ height: '14px', width: '14px', color: '#9CA3AF', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151', letterSpacing: '-0.01em' }}>Archivos adjuntos</span>
              {attachments.length > 0 && (
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 7px', borderRadius: '999px', background: '#F3F4F6', color: '#6B7280', marginLeft: 'auto' }}>
                  {attachments.length}
                </span>
              )}
            </div>
            <div style={{ padding: '14px 16px' }}>
              <input type="file" multiple onChange={handleFileUpload} className="hidden" id="exec-file-upload" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
              <label htmlFor="exec-file-upload" style={{ cursor: 'pointer', display: 'block' }}>
                <div style={{
                  border: '1.5px dashed #D8D8DE', borderRadius: '8px',
                  padding: '16px', textAlign: 'center',
                  transition: 'all 150ms ease', background: '#FAFAFA',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F3F4F6'; (e.currentTarget as HTMLDivElement).style.borderColor = '#B8B8C0'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#FAFAFA'; (e.currentTarget as HTMLDivElement).style.borderColor = '#D8D8DE'; }}
                >
                  <Upload style={{ height: '20px', width: '20px', margin: '0 auto 6px', color: '#C8C8D0' }} />
                  <p style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 500 }}>PDF, DOC, JPG, PNG</p>
                </div>
              </label>

              {attachments.length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {attachments.map((file, index) => (
                    <div key={index} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px', borderRadius: '8px',
                      background: '#F9FAFB', border: '1px solid #F0F0F4',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <FileText style={{ height: '14px', width: '14px', color: '#6B7280', flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                        <span style={{ fontSize: '11px', color: '#9CA3AF', flexShrink: 0 }}>({formatNumber(file.size / 1024, 1)} KB)</span>
                      </div>
                      <button
                        onClick={() => removeAttachment(index)}
                        style={{ height: '20px', width: '20px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', flexShrink: 0, transition: 'all 100ms ease' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.color = '#DC2626'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                      >
                        <X style={{ height: '11px', width: '11px' }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isCompleting}>
            Cancelar
          </Button>
          <button
            onClick={handleComplete}
            disabled={isCompleting}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 20px', borderRadius: '8px', border: 'none',
              background: isCompleting ? '#374151' : '#111827',
              color: '#FFFFFF', fontSize: '13px', fontWeight: 600,
              cursor: isCompleting ? 'not-allowed' : 'pointer',
              transition: 'background 150ms ease', opacity: isCompleting ? 0.7 : 1,
            }}
            onMouseEnter={e => { if (!isCompleting) e.currentTarget.style.background = '#374151'; }}
            onMouseLeave={e => { if (!isCompleting) e.currentTarget.style.background = '#111827'; }}
          >
            {isCompleting ? (
              <>
                <Loader2 style={{ height: '14px', width: '14px', animation: 'spin 1s linear infinite' }} />
                Completando...
              </>
            ) : (
              <>
                <CheckCircle style={{ height: '14px', width: '14px' }} />
                Completar tarea
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
