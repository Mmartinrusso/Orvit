'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle,
  Clock,
  FileText,
  Settings,
  Wrench,
  Calendar,
  User,
  Building,
  Layers,
  Cog,
  CheckSquare,
  AlertTriangle,
  Info,
  X,
  Eye,
  Edit3,
  Play,
  History,
  Printer,
  RotateCcw,
  BookOpen,
  Plus,
  Trash2,
  Loader2,
  Copy,
  Cpu,
  Truck,
  CalendarClock
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { generateChecklistPrintContent as sharedGenerateChecklistPrintContent } from '@/lib/checklist-print-utils';
import { fetchAllMaintenancesCached } from '@/hooks/use-all-maintenances';
import { ChecklistOverviewTab } from '@/components/checklists/ChecklistOverviewTab';
import { ChecklistItemsTab } from '@/components/checklists/ChecklistItemsTab';
import { ChecklistInstructivesTab } from '@/components/checklists/ChecklistInstructivesTab';
import { ChecklistDetailsTab } from '@/components/checklists/ChecklistDetailsTab';
import { ChecklistExecutionTab } from '@/components/checklists/ChecklistExecutionTab';

// Estilos CSS para mejorar el scroll
const scrollStyles = `
  .checklist-tabs-scroll::-webkit-scrollbar {
    height: 6px;
  }
  .checklist-tabs-scroll::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
  }
  .checklist-tabs-scroll::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 10px;
  }
  .checklist-tabs-scroll::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
  .checklist-content-scroll::-webkit-scrollbar {
    width: 8px;
  }
  .checklist-content-scroll::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
  }
  .checklist-content-scroll::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 10px;
  }
  .checklist-content-scroll::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
`;

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  isRequired: boolean;
  order: number;
  category: string;
  estimatedTime: number;
  maintenanceId?: number;
  maintenanceType?: string;
  isMaintenanceItem: boolean;
}

interface ChecklistPhase {
  id: string;
  name: string;
  description: string;
  order: number;
  estimatedTime: number;
  items: ChecklistItem[];
}

interface ChecklistData {
  id: number;
  title: string;
  description: string;
  frequency: string;
  machineId?: number;
  sectorId?: number;
  companyId: number;
  isActive: boolean;
  category: string;
  estimatedTotalTime: number;
  phases?: ChecklistPhase[];
  items?: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
  isCompleted?: boolean;
  executionStatus?: string;
  lastExecutionDate?: string;
  instructives?: Array<{
    id?: string | number;
    title: string;
    content: string;
  }>;
  machine?: {
    id: number;
    name: string;
    type: string;
  };
  sector?: {
    id: number;
    name: string;
    description?: string;
  };
  company?: {
    id: number;
    name: string;
  };
}

interface ChecklistDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  checklist: ChecklistData | null;
  onEdit?: (checklist: ChecklistData) => void;
  onExecute?: (checklist: ChecklistData) => void;
  onViewHistory?: (checklist: ChecklistData) => void;
  onChecklistUpdated?: () => void;
  canEdit?: boolean; // Permiso para editar checklist
}

export default function ChecklistDetailDialog({
  isOpen,
  onClose,
  checklist,
  onEdit,
  onExecute,
  onViewHistory,
  onChecklistUpdated,
  canEdit = false
}: ChecklistDetailDialogProps) {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [isReopening, setIsReopening] = useState(false);
  const [instructives, setInstructives] = useState<Array<{ id: string; title: string; content: string }>>([]);
  const [currentInstructive, setCurrentInstructive] = useState({ title: '', content: '' });
  const [isSavingInstructives, setIsSavingInstructives] = useState(false);
  const [viewingInstructiveIndex, setViewingInstructiveIndex] = useState<number | null>(null);
  const [maintenanceDataMap, setMaintenanceDataMap] = useState<Map<number, any>>(new Map());
  const [isLoadingMaintenanceData, setIsLoadingMaintenanceData] = useState(false);
  

  
  const [activeTab, setActiveTab] = useState('overview');
  const [isPrinting, setIsPrinting] = useState(false);
  
  // Cargar instructivos cuando se abre el diálogo
  useEffect(() => {
    if (isOpen && checklist) {
      if (checklist.instructives && Array.isArray(checklist.instructives) && checklist.instructives.length > 0) {
        const loadedInstructives = checklist.instructives.map((inst: any, index: number) => ({
          id: inst.id?.toString() || `instructive_${index}`,
          title: inst.title || '',
          content: inst.content || ''
        }));
        setInstructives(loadedInstructives);
      } else {
        setInstructives([]);
      }
      setCurrentInstructive({ title: '', content: '' });
    }
  }, [isOpen, checklist]);

  // Cargar datos de mantenimiento para agrupar items
  useEffect(() => {
    if (isOpen && checklist) {
      const loadMaintenanceData = async () => {
        setIsLoadingMaintenanceData(true);
        const maintenanceIds: number[] = [];
        
        // Recopilar todos los maintenanceIds
        if (checklist.phases && checklist.phases.length > 0) {
          checklist.phases.forEach((phase: any) => {
            if (phase.items && phase.items.length > 0) {
              phase.items.forEach((item: any) => {
                if (item.maintenanceId) {
                  maintenanceIds.push(item.maintenanceId);
                }
              });
            }
          });
        } else if (checklist.items && checklist.items.length > 0) {
          checklist.items.forEach((item: any) => {
            if (item.maintenanceId) {
              maintenanceIds.push(item.maintenanceId);
            }
          });
        }

        if (maintenanceIds.length > 0) {
          try {
            const companyId = checklist.companyId || currentCompany?.id;
            if (companyId) {
              // Usar cache global para evitar llamadas duplicadas
              const maintenances = await fetchAllMaintenancesCached(companyId);
              const newMap = new Map<number, any>();
              maintenanceIds.forEach(maintenanceId => {
                const maintenance = maintenances.find((m: any) => m.id === maintenanceId);
                if (maintenance) {
                  newMap.set(maintenanceId, maintenance);
                }
              });
              setMaintenanceDataMap(newMap);
            }
          } catch (error) {
            console.error('Error cargando datos de mantenimiento:', error);
          }
        }
        setIsLoadingMaintenanceData(false);
      };

      loadMaintenanceData();
    } else {
      setMaintenanceDataMap(new Map());
    }
  }, [isOpen, checklist, currentCompany]);

  // Calcular total de items usando useMemo
  const totalItems = React.useMemo(() => {
    if (checklist?.phases && checklist.phases.length > 0) {
      return checklist.phases.reduce((total: number, phase: any) => total + (phase.items?.length || 0), 0);
    }
    return checklist?.items?.length || 0;
  }, [checklist?.phases, checklist?.items]);

  // Calcular tiempo total estimado usando useMemo
  const totalEstimatedTime = React.useMemo(() => {
    // Calculating total estimated time
    
    if (checklist?.phases && checklist.phases.length > 0) {
      const calculated = checklist.phases.reduce((total: number, phase: any) => {
        // Sumar el tiempo de todos los items en cada fase
        const phaseTime = phase.items.reduce((phaseTotal: number, item: any) => {
          return phaseTotal + (item.estimatedTime || 0);
        }, 0);
        return total + phaseTime;
      }, 0);
      return calculated;
    }
    
    // Si no hay fases, intentar calcular desde los items directamente
    if (checklist?.items && checklist.items.length > 0) {
      const calculatedFromItems = checklist.items.reduce((total: number, item: any) => {
        return total + (item.estimatedTime || 0);
      }, 0);
      return calculatedFromItems;
    }
    
    const fallbackTime = checklist?.estimatedTotalTime || 0;
    // Using checklist estimated total time
    return fallbackTime;
  }, [checklist?.phases, checklist?.estimatedTotalTime, checklist?.items]);

  if (!checklist) return null;

  const handlePrintChecklist = async (checklist: any) => {
    if (isPrinting) return;
    
    setIsPrinting(true);

    const maintenanceDataMap = new Map<number, any>();
    const maintenanceIds: number[] = [];
    
    if (checklist.phases && checklist.phases.length > 0) {
      checklist.phases.forEach((phase: any) => {
        if (phase.items && phase.items.length > 0) {
          phase.items.forEach((item: any) => {
            if (item.maintenanceId) {
              maintenanceIds.push(item.maintenanceId);
            }
          });
        }
      });
    } else if (checklist.items && checklist.items.length > 0) {
      checklist.items.forEach((item: any) => {
        if (item.maintenanceId) {
          maintenanceIds.push(item.maintenanceId);
        }
      });
    }
    
    if (maintenanceIds.length > 0) {
      const companyId = checklist.companyId || currentCompany?.id;
      if (companyId) {
        try {
          const maintenances = await fetchAllMaintenancesCached(companyId);
          maintenanceIds.forEach(maintenanceId => {
            const maintenance = maintenances.find((m: any) => m.id === maintenanceId);
            if (maintenance) {
              maintenanceDataMap.set(maintenanceId, maintenance);
            }
          });
        } catch (error) {
          // Silently fail
        }
      }
    }

    try {
      const printContent = generateChecklistPrintContent(checklist, totalItems, totalEstimatedTime, maintenanceDataMap);
      
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none';
      document.body.appendChild(iframe);
      
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('No se pudo acceder al documento del iframe');
      }
      
      iframeDoc.open();
      iframeDoc.write(printContent);
      iframeDoc.close();
      
      let hasPrinted = false;
      
      const doPrint = () => {
        if (hasPrinted) return;
        hasPrinted = true;
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            if (iframe.parentNode) document.body.removeChild(iframe);
            setIsPrinting(false);
          }, 1000);
        } catch (printError) {
          if (iframe.parentNode) document.body.removeChild(iframe);
          setIsPrinting(false);
          alert('Error al iniciar la impresión. Intenta usar Ctrl+P manualmente.');
        }
      };
      
      iframe.onload = () => doPrint();
      setTimeout(() => { if (iframe.parentNode && !hasPrinted) doPrint(); }, 500);
      
    } catch (error) {
      setIsPrinting(false);
      alert('Error al generar el contenido para imprimir.');
    }
  };

  const handlePrintChecklistExecution = (checklist: any) => {
    // Usar la misma función de impresión que el botón principal
    handlePrintChecklist(checklist);
  };

  const generateChecklistExecutionPrintContent = (checklist: any) => {
    const currentDate = new Date().toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const getFrequencyLabel = (frequency: string) => {
      const labels: { [key: string]: string } = {
        'DAILY': 'Diario',
        'WEEKLY': 'Semanal',
        'BIWEEKLY': 'Quincenal',
        'MONTHLY': 'Mensual',
        'QUARTERLY': 'Trimestral',
        'SEMIANNUAL': 'Semestral',
        'ANNUAL': 'Anual'
      };
      return labels[frequency] || frequency;
    };

    const calculateMaintenanceStatus = (maintenanceData: any) => {
      if (!maintenanceData) return { status: 'unknown', message: 'Sin datos' };
      
      if (maintenanceData.status === 'COMPLETED') {
        return { status: 'completed', message: 'Completado' };
      }
      
      return { status: 'pending', message: 'Pendiente' };
    };

    let maintenanceItems = '';
    
    // Si no hay fases, crear items de ejemplo basados en el checklist
    if (!checklist.phases || checklist.phases.length === 0) {
      // Crear items de ejemplo para testing
      const exampleItems = [
        {
          title: "asdadsa",
          description: "Cambio de aceite del motor y filtro de aceite. Verificar nivel de aceite y estado del filtro.",
          maintenanceData: {
            status: 'COMPLETED',
            lastMaintenanceDate: '2025-10-23',
            nextMaintenanceDate: '2025-10-30',
            frequency: 'MONTHLY'
          }
        },
        {
          title: "Cambio de aceite del motor",
          description: "Cambio de aceite del motor y filtro de aceite. Verificar nivel de aceite y estado del filtro.",
          maintenanceData: {
            status: 'PENDING',
            nextMaintenanceDate: '2025-10-29',
            frequency: 'MONTHLY'
          }
        }
      ];
      
      maintenanceItems = exampleItems.map((item: any, itemIndex: number) => {
        const maintenanceData = item.maintenanceData || {};
        const status = calculateMaintenanceStatus(maintenanceData);
        
        return `
          <div class="maintenance-item">
            <div class="maintenance-header">
              <div class="maintenance-info">
                <h4 class="maintenance-title">${item.title}</h4>
                <p class="maintenance-description">${item.description || ''}</p>
                <div class="maintenance-badges">
                  ${status.status === 'completed' ? 
                    '<div class="badge badge-completed"><span class="badge-icon">✓</span>Completado</div>' : 
                    `<div class="badge badge-frequency">${getFrequencyLabel(maintenanceData.frequency || 'MONTHLY')}</div>`
                  }
                  <div class="badge badge-type">Preventivo</div>
                </div>
                <div class="maintenance-dates">
                  ${maintenanceData.lastMaintenanceDate ? 
                    `<div class="date-info"><span class="date-icon completed">✓</span>Último: ${new Date(maintenanceData.lastMaintenanceDate).toLocaleDateString('es-AR')}</div>` : ''
                  }
                  ${maintenanceData.nextMaintenanceDate ? 
                    `<div class="date-info"><span class="date-icon upcoming">📅</span>Próximo: ${new Date(maintenanceData.nextMaintenanceDate).toLocaleDateString('es-AR')}</div>` : ''
                  }
                </div>
              </div>
            </div>
            
            <div class="execution-fields">
              <div class="field-row">
                <div class="field-group">
                  <label class="field-label">
                    <span class="field-icon completed">✓</span>
                    Fecha de realizado
                  </label>
                  <div class="date-input">
                    <input type="text" placeholder="dd/mm/aaaa" class="date-field" />
                    <span class="calendar-icon">📅</span>
                  </div>
                </div>
                <div class="field-group">
                  <label class="field-label">
                    <span class="field-icon reschedule">📅</span>
                    Fecha a reprogramar
                  </label>
                  <div class="date-input">
                    <input type="text" placeholder="dd/mm/aaaa" class="date-field" />
                    <span class="calendar-icon">📅</span>
                  </div>
                </div>
              </div>
              
              <div class="field-row">
                <div class="field-group">
                  <label class="field-label">
                    <span class="field-icon notes">📄</span>
                    Notas
                  </label>
                  <textarea class="notes-field" placeholder="Notas sobre la ejecución..." rows="3"></textarea>
                </div>
                <div class="field-group">
                  <label class="field-label">
                    <span class="field-icon issues">⚠️</span>
                    Inconvenientes
                  </label>
                  <textarea class="notes-field" placeholder="Problemas o inconvenientes encontrados..." rows="3"></textarea>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } else if (checklist.phases && checklist.phases.length > 0) {
      maintenanceItems = checklist.phases.map((phase: any, phaseIndex: number) => {
        if (phase.items && phase.items.length > 0) {
          return phase.items.map((item: any, itemIndex: number) => {
            const maintenanceData = item.maintenanceData || {};
            const status = calculateMaintenanceStatus(maintenanceData);
            
            return `
              <div class="maintenance-item">
                <div class="maintenance-header">
                  <div class="maintenance-info">
                    <h4 class="maintenance-title">${item.title}</h4>
                    <p class="maintenance-description">${item.description || ''}</p>
                    <div class="maintenance-badges">
                      ${status.status === 'completed' ? 
                        '<div class="badge badge-completed"><span class="badge-icon">✓</span>Completado</div>' : 
                        `<div class="badge badge-frequency">${getFrequencyLabel(maintenanceData.frequency || 'MONTHLY')}</div>`
                      }
                      <div class="badge badge-type">Preventivo</div>
                    </div>
                    <div class="maintenance-dates">
                      ${maintenanceData.lastMaintenanceDate ? 
                        `<div class="date-info"><span class="date-icon completed">✓</span>Último: ${new Date(maintenanceData.lastMaintenanceDate).toLocaleDateString('es-AR')}</div>` : ''
                      }
                      ${maintenanceData.nextMaintenanceDate ? 
                        `<div class="date-info"><span class="date-icon upcoming">📅</span>Próximo: ${new Date(maintenanceData.nextMaintenanceDate).toLocaleDateString('es-AR')}</div>` : ''
                      }
                    </div>
                  </div>
                </div>
                
                <div class="execution-fields">
                  <div class="field-row">
                    <div class="field-group">
                      <label class="field-label">
                        <span class="field-icon completed">✓</span>
                        Fecha de realizado
                      </label>
                      <div class="date-input">
                        <input type="text" placeholder="dd/mm/aaaa" class="date-field" />
                        <span class="calendar-icon">📅</span>
                      </div>
                    </div>
                    <div class="field-group">
                      <label class="field-label">
                        <span class="field-icon reschedule">📅</span>
                        Fecha a reprogramar
                      </label>
                      <div class="date-input">
                        <input type="text" placeholder="dd/mm/aaaa" class="date-field" />
                        <span class="calendar-icon">📅</span>
                      </div>
                    </div>
                  </div>
                  
                  <div class="field-row">
                    <div class="field-group">
                      <label class="field-label">
                        <span class="field-icon notes">📄</span>
                        Notas
                      </label>
                      <textarea class="notes-field" placeholder="Notas sobre la ejecución..." rows="3"></textarea>
                    </div>
                    <div class="field-group">
                      <label class="field-label">
                        <span class="field-icon issues">⚠️</span>
                        Inconvenientes
                      </label>
                      <textarea class="notes-field" placeholder="Problemas o inconvenientes encontrados..." rows="3"></textarea>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('');
        }
        return '';
      }).join('');
    }

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ejecutar Checklist - ${checklist.title}</title>
        <style>
          @media print {
            body { margin: 0; padding: 20px; }
            .no-print { display: none; }
            .page-break { page-break-before: always; }
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f8fafc;
          }
          
          .modal-container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          
          .modal-header {
            padding: 24px;
            border-bottom: 1px solid #e5e7eb;
            background: white;
          }
          
          .modal-title {
            font-size: 20px;
            font-weight: 600;
            color: #111827;
            margin: 0 0 8px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .modal-description {
            font-size: 14px;
            color: #6b7280;
            margin: 0;
          }
          
          .modal-content {
            padding: 24px;
          }
          
          .maintenances-section {
            background: white;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            overflow: hidden;
          }
          
          .section-header {
            padding: 24px 24px 0 24px;
          }
          
          .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #111827;
            margin: 0;
          }
          
          .maintenances-list {
            padding: 24px;
          }
          
          .maintenance-item {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 16px;
            background: white;
          }
          
          .maintenance-header {
            margin-bottom: 16px;
          }
          
          .maintenance-info {
            flex: 1;
          }
          
          .maintenance-title {
            font-size: 18px;
            font-weight: 600;
            color: #111827;
            margin: 0 0 8px 0;
          }
          
          .maintenance-description {
            font-size: 14px;
            color: #6b7280;
            margin: 0 0 12px 0;
          }
          
          .maintenance-badges {
            margin-bottom: 12px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }
          
          .badge {
            display: inline-flex;
            align-items: center;
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 500;
            border: 1px solid;
          }
          
          .badge-completed {
            background-color: #dcfce7;
            color: #166534;
            border-color: #bbf7d0;
          }
          
          .badge-icon {
            margin-right: 4px;
          }
          
          .badge-frequency {
            background-color: #dbeafe;
            color: #1e40af;
            border-color: #bfdbfe;
          }
          
          .badge-type {
            background-color: #f3f4f6;
            color: #374151;
            border-color: #d1d5db;
          }
          
          .maintenance-dates {
            display: flex;
            gap: 16px;
            font-size: 12px;
            color: #6b7280;
          }
          
          .date-info {
            display: flex;
            align-items: center;
            gap: 4px;
          }
          
          .date-icon {
            font-size: 12px;
          }
          
          .date-icon.completed {
            color: #16a34a;
          }
          
          .date-icon.upcoming {
            color: #2563eb;
          }
          
          .execution-fields {
            margin-top: 16px;
          }
          
          .field-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 16px;
          }
          
          .field-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          
          .field-label {
            font-size: 14px;
            font-weight: 500;
            color: #374151;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .field-icon {
            font-size: 16px;
          }
          
          .field-icon.completed {
            color: #16a34a;
          }
          
          .field-icon.reschedule {
            color: #ea580c;
          }
          
          .field-icon.notes {
            color: #6b7280;
          }
          
          .field-icon.issues {
            color: #dc2626;
          }
          
          .date-input {
            position: relative;
          }
          
          .date-field {
            width: 100%;
            height: 40px;
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            background: white;
            cursor: pointer;
          }
          
          .date-field:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }
          
          .calendar-icon {
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: #6b7280;
            pointer-events: none;
          }
          
          .notes-field {
            width: 100%;
            min-height: 80px;
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            font-family: inherit;
            resize: vertical;
            background: white;
          }
          
          .notes-field:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }
          
          .modal-footer {
            padding: 24px;
            border-top: 1px solid #e5e7eb;
            background: #f9fafb;
            display: flex;
            justify-content: flex-end;
            gap: 8px;
          }
          
          .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            border: 1px solid;
            cursor: pointer;
            transition: all 0.2s;
          }
          
          .btn-secondary {
            background: white;
            color: #374151;
            border-color: #d1d5db;
          }
          
          .btn-primary {
            background: #3b82f6;
            color: white;
            border-color: #3b82f6;
          }
          
          .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            background-color: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
          }
          
          .print-button:hover {
            background-color: #2563eb;
          }
          
          .responsibles-section {
            background: white;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
            overflow: hidden;
            margin-top: 16px;
          }
          
          .responsibles-content {
            padding: 16px;
          }
          
          .responsible-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 12px;
          }
          
          .responsible-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          
          .responsible-label {
            font-size: 12px;
            font-weight: 600;
            color: #374151;
            margin: 0;
          }
          
          .signature-line {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: 8px;
          }
          
          .signature-space {
            height: 24px;
            border-bottom: 1px solid #374151;
            margin-bottom: 2px;
          }
          
          .name-field {
            margin-top: 2px;
          }
          
          .name-input {
            width: 100%;
            height: 28px;
            padding: 4px 8px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-size: 12px;
            background: white;
          }
          
          .name-input:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
          }
          
          .date-field, .time-field {
            margin-top: 2px;
          }
          
          .date-input-field, .time-input-field {
            width: 100%;
            height: 28px;
            padding: 4px 8px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-size: 12px;
            background: white;
          }
          
          .date-input-field:focus, .time-input-field:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
          }
        </style>
      </head>
      <body>
        
        <div class="modal-container">
          <div class="modal-header">
            <h2 class="modal-title">
              📄 Ejecutar Checklist: ${checklist.title}
            </h2>
            <div style="margin-top: 8px; font-size: 14px; color: #6b7280;">
              <strong>ID del Checklist:</strong> ${checklist.id}
            </div>
            <p class="modal-description">
              Mantenimientos del checklist cargados automáticamente. Marca cada uno como completado o reprograma con nueva fecha.
            </p>
          </div>
          
          <div class="modal-content">
            <div class="maintenances-section">
              <div class="section-header">
                <h3 class="section-title">Mantenimientos (${checklist.phases?.reduce((total, phase) => total + (phase.items?.length || 0), 0) || 2})</h3>
              </div>
              <div class="maintenances-list">
                ${maintenanceItems || '<p style="color: #6b7280; font-style: italic;">Sin mantenimientos definidos</p>'}
              </div>
            </div>
          </div>
          
          <div class="responsibles-section">
            <div class="section-header">
              <h3 class="section-title">Responsables</h3>
            </div>
            <div class="responsibles-content">
              <div class="responsible-row">
                <div class="responsible-field">
                  <label class="responsible-label">Responsables de Ejecución:</label>
                  <div class="signature-line">
                    <div class="signature-space"></div>
                    <div class="name-field">
                      <input type="text" placeholder="Nombre completo" class="name-input" />
                    </div>
                  </div>
                  <div class="signature-line">
                    <div class="signature-space"></div>
                    <div class="name-field">
                      <input type="text" placeholder="Nombre completo" class="name-input" />
                    </div>
                  </div>
                </div>
                <div class="responsible-field">
                  <label class="responsible-label">Supervisores:</label>
                  <div class="signature-line">
                    <div class="signature-space"></div>
                    <div class="name-field">
                      <input type="text" placeholder="Nombre completo" class="name-input" />
                    </div>
                  </div>
                  <div class="signature-line">
                    <div class="signature-space"></div>
                    <div class="name-field">
                      <input type="text" placeholder="Nombre completo" class="name-input" />
                    </div>
                  </div>
                </div>
              </div>
              <div class="responsible-row">
                <div class="responsible-field">
                  <label class="responsible-label">Fecha de Ejecución:</label>
                  <div class="date-field">
                    <input type="text" placeholder="dd/mm/aaaa" class="date-input-field" />
                  </div>
                </div>
                <div class="responsible-field">
                  <label class="responsible-label">Hora de Finalización:</label>
                  <div class="time-field">
                    <input type="text" placeholder="hh:mm" class="time-input-field" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button class="btn btn-secondary">Cancelar</button>
            <button class="btn btn-primary">Ejecutar Checklist</button>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Funciones auxiliares para formateo (usadas dentro y fuera de generateChecklistPrintContent)
  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels: { [key: string]: string } = {
      'DAILY': 'Diario',
      'WEEKLY': 'Semanal',
      'BIWEEKLY': 'Quincenal',
      'MONTHLY': 'Mensual',
      'QUARTERLY': 'Trimestral',
      'SEMIANNUAL': 'Semestral',
      'ANNUAL': 'Anual'
    };
    return labels[frequency] || frequency;
  };

  const getCategoryLabel = (category: string) => {
    const labels: { [key: string]: string } = {
      'SAFETY': 'Seguridad',
      'QUALITY': 'Calidad',
      'PRODUCTION': 'Producción',
      'MAINTENANCE': 'Mantenimiento',
      'CLEANING': 'Limpieza',
      'INSPECTION': 'Inspección'
    };
    return labels[category] || category;
  };

  // Usar la función compartida
  const generateChecklistPrintContent = sharedGenerateChecklistPrintContent;

  const _generateChecklistPrintContent_OLD = (checklist: any, totalItems: number, totalEstimatedTime: number, maintenanceDataMap?: Map<number, any>) => {
    console.log('🖨️ [PRINT] ========== FUNCIÓN LLAMADA ==========');
    console.log('🖨️ [PRINT] Parámetros recibidos:', {
      checklistId: checklist?.id,
      checklistTitle: checklist?.title,
      totalItems,
      totalEstimatedTime,
      maintenanceDataMapSize: maintenanceDataMap?.size || 0,
      maintenanceDataMapType: typeof maintenanceDataMap,
      maintenanceDataMapIsMap: maintenanceDataMap instanceof Map
    });
    
    try {
      console.log('🖨️ [PRINT] ========== INICIANDO GENERACIÓN DE CONTENIDO ==========');
      console.log('🖨️ [PRINT] Generando contenido de impresión del checklist:', {
        checklistId: checklist.id,
        checklistTitle: checklist.title,
        hasPhases: !!checklist.phases,
        phasesCount: checklist.phases?.length || 0,
        hasItems: !!checklist.items,
        itemsCount: checklist.items?.length || 0,
        maintenanceDataMapSize: maintenanceDataMap?.size || 0,
        maintenanceDataMapType: typeof maintenanceDataMap
      });

    const currentDate = new Date().toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Recopilar todos los items con su información de fase
    const allItems: Array<{ item: any; phaseIndex?: number; itemIndex: number; globalIndex: number }> = [];
    let globalIndex = 0;
    
    if (checklist.phases && checklist.phases.length > 0) {
      checklist.phases.forEach((phase: any, phaseIndex: number) => {
        if (phase.items && phase.items.length > 0) {
          phase.items.forEach((item: any, itemIndex: number) => {
            console.log('🖨️ [PRINT] Item de fase:', {
              phaseIndex,
              itemIndex,
              itemTitle: item.title,
              maintenanceId: item.maintenanceId,
              hasMachine: !!item.machine,
              machineName: item.machine?.name,
              hasUnidadMovil: !!item.unidadMovil,
              unidadMovilName: item.unidadMovil?.name,
              fullItem: item
            });
            allItems.push({ item, phaseIndex, itemIndex, globalIndex: globalIndex++ });
          });
        }
      });
    } else if (checklist.items && checklist.items.length > 0) {
      checklist.items.forEach((item: any, index: number) => {
        console.log('🖨️ [PRINT] Item directo:', {
          index,
          itemTitle: item.title,
          maintenanceId: item.maintenanceId,
          hasMachine: !!item.machine,
          machineName: item.machine?.name,
          hasUnidadMovil: !!item.unidadMovil,
          unidadMovilName: item.unidadMovil?.name,
          fullItem: item
        });
        allItems.push({ item, itemIndex: index, globalIndex: globalIndex++ });
      });
    }

    console.log('🖨️ [PRINT] Total items recopilados:', allItems.length);

    // Agrupar items por máquina
    const itemsByMachine: { [key: string]: Array<{ item: any; phaseIndex?: number; itemIndex: number; globalIndex: number; machineInfo: any }> } = {};
    let itemsWithoutMachine: Array<{ item: any; phaseIndex?: number; itemIndex: number; globalIndex: number }> = [];

    // Si el checklist tiene una máquina asociada, usarla como fallback
    const checklistMachine = checklist.machine;

    allItems.forEach((itemData) => {
      const maintenanceId = itemData.item.maintenanceId;
      let machine = null;
      let unidadMovil = null;
      let component = null;
      let subcomponent = null;

      // Intentar obtener información desde el mapa de datos de mantenimiento
      if (maintenanceId && maintenanceDataMap) {
        const maintenanceData = maintenanceDataMap.get(maintenanceId);
        console.log('🖨️ [PRINT] Buscando mantenimiento:', {
          maintenanceId,
          found: !!maintenanceData,
          hasMachine: !!maintenanceData?.machine,
          hasUnidadMovil: !!maintenanceData?.unidadMovil
        });
        
        if (maintenanceData) {
          machine = maintenanceData.machine;
          unidadMovil = maintenanceData.unidadMovil;
          
          console.log('🖨️ [PRINT] Datos de mantenimiento obtenidos:', {
            maintenanceId,
            machine: machine ? { id: machine.id, name: machine.name } : null,
            unidadMovil: unidadMovil ? { id: unidadMovil.id, name: unidadMovil.name } : null
          });
          
          // Obtener componente y subcomponente
          if (maintenanceData.componentIds && maintenanceData.componentIds.length > 0) {
            // Si hay componente, intentar obtenerlo
            if (maintenanceData.component) {
              component = maintenanceData.component;
            } else if (maintenanceData.components && maintenanceData.components.length > 0) {
              component = maintenanceData.components[0];
            } else {
              component = { 
                id: maintenanceData.componentIds[0],
                name: maintenanceData.componentNames?.[0] || `Componente ${maintenanceData.componentIds[0]}`
              };
            }
          }
          
          if (maintenanceData.subcomponentIds && maintenanceData.subcomponentIds.length > 0) {
            // Si hay subcomponente, intentar obtenerlo
            if (maintenanceData.subcomponents && maintenanceData.subcomponents.length > 0) {
              subcomponent = maintenanceData.subcomponents[0];
            } else {
              subcomponent = { 
                id: maintenanceData.subcomponentIds[0],
                name: maintenanceData.subcomponentNames?.[0] || `Subcomponente ${maintenanceData.subcomponentIds[0]}`
              };
            }
          }
        }
      }

      // Si no se encontró en el mapa, intentar desde el item directamente
      if (!machine && !unidadMovil) {
        machine = itemData.item.machine;
        unidadMovil = itemData.item.unidadMovil;
      }
      
      // Si no tiene máquina directa, intentar desde maintenanceData del item
      if (!machine && !unidadMovil && itemData.item.maintenanceData) {
        machine = itemData.item.maintenanceData.machine;
        unidadMovil = itemData.item.maintenanceData.unidadMovil;
      }

      // Si aún no tiene máquina, usar la máquina del checklist como fallback
      if (!machine && !unidadMovil && checklistMachine) {
        machine = checklistMachine;
      }

      // Crear clave de agrupación: máquina_componente_subcomponente
      const machineKey = machine 
        ? `${machine.id || 'unknown'}_${machine.name || 'Sin nombre'}`
        : unidadMovil
        ? `unidad_${unidadMovil.id || 'unknown'}_${unidadMovil.name || 'Sin nombre'}`
        : null;

      const componentKey = component 
        ? `_comp_${component.id || 'unknown'}_${component.name || 'Sin nombre'}`
        : '';

      const subcomponentKey = subcomponent
        ? `_subcomp_${subcomponent.id || 'unknown'}_${subcomponent.name || 'Sin nombre'}`
        : '';

      const fullKey = machineKey ? `${machineKey}${componentKey}${subcomponentKey}` : null;

      console.log('🖨️ [PRINT] Agrupando item:', {
        itemTitle: itemData.item.title,
        maintenanceId,
        machineKey,
        componentKey,
        subcomponentKey,
        fullKey,
        hasMachine: !!machine,
        hasUnidadMovil: !!unidadMovil
      });

      if (fullKey) {
        if (!itemsByMachine[fullKey]) {
          itemsByMachine[fullKey] = [];
        }
        itemsByMachine[fullKey].push({ 
          ...itemData, 
          machineInfo: machine || unidadMovil,
          componentInfo: component,
          subcomponentInfo: subcomponent
        });
      } else {
        console.warn('🖨️ [PRINT] Item sin máquina:', itemData.item.title);
        itemsWithoutMachine.push(itemData);
      }
    });

    // Si no hay items agrupados por máquina pero hay items sin máquina y el checklist tiene máquina,
    // agrupar todos bajo la máquina del checklist
    if (Object.keys(itemsByMachine).length === 0 && itemsWithoutMachine.length > 0 && checklistMachine) {
      const machineKey = `${checklistMachine.id || 'unknown'}_${checklistMachine.name || 'Sin nombre'}`;
      itemsByMachine[machineKey] = itemsWithoutMachine.map(item => ({ ...item, machineInfo: checklistMachine }));
      itemsWithoutMachine = [];
    }

    console.log('🖨️ [PRINT] Items agrupados por máquina:', {
      machinesCount: Object.keys(itemsByMachine).length,
      machines: Object.keys(itemsByMachine),
      itemsWithoutMachine: itemsWithoutMachine.length,
      maintenanceDataMapSize: maintenanceDataMap?.size || 0,
      maintenanceDataMapKeys: maintenanceDataMap ? Array.from(maintenanceDataMap.keys()) : []
    });

    // Generar contenido de tabla agrupado por máquina
    let tableRows = '';
    let itemCounter = 0;

    // Función para generar filas de items
    const generateItemRows = (items: Array<{ item: any; phaseIndex?: number; itemIndex: number; globalIndex: number }>) => {
      let rows = '';
      items.forEach((itemData) => {
        itemCounter++;
        const { item, phaseIndex, itemIndex } = itemData;
        const fullTitle = phaseIndex !== undefined 
          ? `${phaseIndex + 1}.${itemIndex + 1} ${item.title}`
          : `${itemCounter}. ${item.title}`;
        const itemId = item.maintenanceId || item.id || 'N/A';
        const maintenanceText = `${fullTitle} - ID: ${itemId}`;
        
        rows += `
          <tr>
            <td class="table-cell maintenance-cell">${maintenanceText}</td>
            <td class="table-cell date-cell">
              <div class="date-field">__ / __ / __</div>
            </td>
            <td class="table-cell date-cell">
              <div class="date-field">__ / __ / __</div>
            </td>
            <td class="table-cell notes-cell">
              <div class="notes-field"></div>
            </td>
            <td class="table-cell notes-cell">
              <div class="notes-field"></div>
            </td>
            <td class="table-cell responsible-cell">
              <div class="responsible-field">_________________</div>
            </td>
          </tr>
        `;
      });
      return rows;
    };

    // Generar secciones por máquina, componente y subcomponente
    // Agrupar primero por máquina
    const machinesMap: { [machineKey: string]: { [fullKey: string]: typeof itemsByMachine[string] } } = {};
    
    console.log('🖨️ [PRINT] Agrupando por máquinas...', {
      itemsByMachineKeys: Object.keys(itemsByMachine),
      itemsByMachineCount: Object.keys(itemsByMachine).length
    });
    
    Object.keys(itemsByMachine).forEach((fullKey) => {
      // Extraer la clave de máquina (antes del primer _comp_ o _subcomp_)
      const machineKeyMatch = fullKey.match(/^(unidad_[\d_]+|[\d_]+)/);
      const machineKey = machineKeyMatch ? machineKeyMatch[0] : fullKey;
      
      if (!machinesMap[machineKey]) {
        machinesMap[machineKey] = {};
      }
      machinesMap[machineKey][fullKey] = itemsByMachine[fullKey];
    });

    console.log('🖨️ [PRINT] Máquinas agrupadas:', {
      machinesMapKeys: Object.keys(machinesMap),
      machinesMapCount: Object.keys(machinesMap).length
    });

    // Generar secciones
    Object.keys(machinesMap).forEach((machineKey) => {
      console.log('🖨️ [PRINT] Generando sección para máquina:', machineKey);
      const machineGroups = machinesMap[machineKey];
      const firstGroupKey = Object.keys(machineGroups)[0];
      const firstItemData = machineGroups[firstGroupKey][0];
      const machineInfo = firstItemData.machineInfo || firstItemData.item.machine || firstItemData.item.unidadMovil;
      const machineName = machineInfo?.name || 'Sin nombre';
      const machineType = machineInfo?.type || '';
      const isUnidadMovil = machineKey.startsWith('unidad_');
      
      // Encabezado de máquina
      console.log('🖨️ [PRINT] Agregando encabezado de máquina:', {
        machineKey,
        machineName,
        machineType,
        isUnidadMovil
      });
      
      tableRows += `
        <tr class="machine-header-row">
          <td colspan="6" style="text-align: center;">
            <strong>${isUnidadMovil ? 'Unidad Móvil' : 'Máquina'}: ${machineName}</strong>
          </td>
        </tr>
      `;
      
      // Agrupar por componente dentro de esta máquina
      const componentsMap: { [componentKey: string]: { [subcomponentKey: string]: typeof itemsByMachine[string] } } = {};
      
      Object.keys(machineGroups).forEach((fullKey) => {
        const items = machineGroups[fullKey];
        const firstItem = items[0];
        const componentInfo = firstItem.componentInfo;
        const subcomponentInfo = firstItem.subcomponentInfo;
        
        // Crear clave de componente
        const componentKey = componentInfo 
          ? `comp_${componentInfo.id}_${componentInfo.name || 'Sin nombre'}`
          : 'sin_componente';
        
        // Crear clave de subcomponente
        const subcomponentKey = subcomponentInfo
          ? `subcomp_${subcomponentInfo.id}_${subcomponentInfo.name || 'Sin nombre'}`
          : 'sin_subcomponente';
        
        if (!componentsMap[componentKey]) {
          componentsMap[componentKey] = {};
        }
        if (!componentsMap[componentKey][subcomponentKey]) {
          componentsMap[componentKey][subcomponentKey] = [];
        }
        componentsMap[componentKey][subcomponentKey].push(...items);
      });
      
      // Generar grupos por componente y subcomponente
      Object.keys(componentsMap).forEach((componentKey) => {
        const subcomponentsMap = componentsMap[componentKey];
        const firstSubcomponentKey = Object.keys(subcomponentsMap)[0];
        const firstItem = subcomponentsMap[firstSubcomponentKey][0];
        const componentInfo = firstItem.componentInfo;
        
        // Encabezado de componente si existe
        if (componentInfo) {
          const componentName = componentInfo.name || `Componente ${componentInfo.id}`;
          tableRows += `
            <tbody class="component-group">
            <tr class="component-header-row" style="background-color: #f3f4f6; font-weight: bold;">
              <td colspan="6" style="padding: 8px; font-size: 12px; border-left: 3px solid #3b82f6; text-align: center;">
                <strong>Componente: ${componentName}</strong>
              </td>
            </tr>
          `;
        }
        
        // Generar grupos por subcomponente dentro de este componente
        Object.keys(subcomponentsMap).forEach((subcomponentKey) => {
          const items = subcomponentsMap[subcomponentKey];
          const firstItem = items[0];
          const subcomponentInfo = firstItem.subcomponentInfo;
          
          // Encabezado de subcomponente si existe
          if (subcomponentInfo) {
            const subcomponentName = subcomponentInfo.name || `Subcomponente ${subcomponentInfo.id}`;
            tableRows += `
            <tbody class="subcomponent-group">
            <tr class="subcomponent-header-row" style="background-color: #f9fafb; font-weight: bold;">
              <td colspan="6" style="padding: 6px 8px 6px 20px; font-size: 11px; border-left: 3px solid #60a5fa; text-align: center;">
                <strong>Subcomponente: ${subcomponentName}</strong>
              </td>
            </tr>
            `;
          }
          
          // Items de este grupo
          tableRows += generateItemRows(items);
          
          // Cerrar tbody del subcomponente
          if (subcomponentInfo) {
            tableRows += `</tbody>`;
          }
        });
        
        // Cerrar tbody del componente
        if (componentInfo) {
          tableRows += `</tbody>`;
        }
      });
    });

    // Items sin máquina asignada
    if (itemsWithoutMachine.length > 0) {
      tableRows += `
        <tr class="unassigned-header-row">
          <td colspan="6" style="text-align: center;">
            <strong>Mantenimientos sin máquina asignada</strong>
          </td>
        </tr>
      `;
      tableRows += generateItemRows(itemsWithoutMachine);
    }

    // Si no hay items
    if (allItems.length === 0) {
      tableRows = '<tr><td colspan="6" style="text-align: center; color: #6b7280; font-style: italic; padding: 20px;">Sin items definidos</td></tr>';
    }

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Checklist - ${checklist.title}</title>
        <style>
          @media print {
            @page {
              size: landscape;
              margin: 10mm;
            }
            body { margin: 0; padding: 10px; }
            .no-print { display: none; }
            .page-break { page-break-before: always; }
            .header { margin-bottom: 10px; padding-bottom: 10px; }
            .info-grid { margin-bottom: 10px; }
            .description { margin-bottom: 10px; padding: 10px; }
            .phases-section h2 { margin-bottom: 10px; padding-bottom: 5px; }
          }
          
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
          }
          
          @media print {
            .checklist-table {
              font-size: 9px;
              width: 100%;
            }
            
            .checklist-table th,
            .checklist-table td {
              padding: 4px 3px;
            }
            
            .maintenance-cell {
              width: 20%;
              min-width: 180px;
            }
            
            .date-cell {
              width: 12%;
              min-width: 90px;
            }
            
            .notes-cell {
              width: 22%;
              min-width: 150px;
            }
            
            .responsible-cell {
              width: 22%;
              min-width: 150px;
            }
          }
          
          .header {
            text-align: center;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          
          .title {
            font-size: 24px;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 5px;
          }
          
          .subtitle {
            font-size: 12px;
            font-weight: bold;
            color: #6b7280;
            margin-bottom: 3px;
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 15px;
            font-size: 11px;
          }
          
          .info-card {
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            padding: 8px;
            background-color: #f9fafb;
          }
          
          .info-label {
            font-weight: bold;
            color: #374151;
            margin-bottom: 3px;
            font-size: 10px;
          }
          
          .info-value {
            color: #111827;
            font-size: 11px;
            font-weight: bold;
          }
          
          .description {
            background-color: #f3f4f6;
            border-left: 3px solid #3b82f6;
            padding: 8px;
            margin-bottom: 15px;
            border-radius: 0 4px 4px 0;
            font-size: 11px;
          }
          
          .phases-section {
            margin-bottom: 15px;
          }
          
          .table-container {
            overflow-x: auto;
            margin-top: 20px;
          }
          
          .checklist-table {
            width: 100%;
            border-collapse: collapse;
            border: 2px solid #1e40af;
            background-color: white;
            font-size: 11px;
            table-layout: fixed;
          }
          
          .checklist-table thead {
            background-color: #f3f4f6;
          }
          
          .checklist-table th {
            padding: 8px 6px;
            text-align: center;
            font-weight: 900;
            border: 1px solid #1e3a8a;
            font-size: 11px;
            color: #000000;
            background-color: #f3f4f6;
          }
          
          .checklist-table td {
            padding: 6px 4px;
            border: 1px solid #d1d5db;
            vertical-align: top;
          }
          
          .checklist-table tbody tr:nth-child(even) {
            background-color: #f9fafb;
          }
          
          .checklist-table tbody tr:hover {
            background-color: #f3f4f6;
          }
          
          .table-cell {
            min-height: 40px;
          }
          
          .maintenance-cell {
            width: 20%;
            font-weight: 500;
            color: #000000;
          }
          
          .date-cell {
            width: 12%;
            text-align: center;
            color: #000000;
          }
          
          .date-field {
            min-height: 30px;
            padding: 4px;
            text-align: center;
            color: #000000;
            font-size: 14px;
            letter-spacing: 2px;
          }
          
          .notes-cell {
            width: 22%;
          }
          
          .notes-field {
            border: 1px solid #d1d5db;
            border-radius: 0;
            min-height: 80px;
            background-color: white;
            padding: 4px;
          }
          
          .responsible-cell {
            width: 22%;
          }
          
          .responsible-field {
            border-bottom: 1px solid #d1d5db;
            min-height: 30px;
            padding: 4px;
          }
          
          .footer {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 10px;
          }
          
          .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background-color: #2563eb;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
          }
          
          .print-button:hover {
            background-color: #1d4ed8;
          }
          
          .machine-header-row {
            background-color: #e5e7eb !important;
            font-weight: bold;
            border-top: 3px solid #1e40af;
            border-bottom: 2px solid #1e40af;
            page-break-inside: avoid;
            page-break-after: avoid;
          }
          
          .machine-header-row td {
            padding: 12px !important;
            font-size: 14px !important;
            border: 2px solid #1e40af !important;
            background-color: #e5e7eb !important;
            text-align: center !important;
          }
          
          .component-header-row {
            page-break-inside: avoid;
            page-break-after: avoid;
          }
          
          .subcomponent-header-row {
            page-break-inside: avoid;
            page-break-after: avoid;
          }
          
          /* Agrupar encabezado con sus items para evitar separación */
          .component-group {
            page-break-inside: avoid;
          }
          
          .subcomponent-group {
            page-break-inside: avoid;
          }
          
          /* Mantener juntos el encabezado y al menos el primer item */
          .component-header-row + tr,
          .subcomponent-header-row + tr {
            page-break-before: avoid;
          }
          
          .unassigned-header-row {
            background-color: #fef3c7 !important;
            font-weight: bold;
            border-top: 3px solid #f59e0b;
            border-bottom: 2px solid #f59e0b;
            page-break-inside: avoid;
            page-break-after: avoid;
          }
          
          .unassigned-header-row td {
            padding: 12px !important;
            font-size: 14px !important;
            border: 2px solid #f59e0b !important;
            background-color: #fef3c7 !important;
            text-align: center !important;
          }
          
          /* Centrar contenido de la tabla */
          .checklist-table {
            text-align: center;
          }
          
          .checklist-table td {
            text-align: center;
          }
          
          .checklist-table .maintenance-cell {
            text-align: left;
          }
        </style>
      </head>
      <body>
        
        <div class="header">
          <div class="title">${checklist.title}</div>
          <div class="subtitle">Checklist de Mantenimiento</div>
          <div class="subtitle">Generado el ${currentDate}</div>
        </div>
        
        <div class="info-grid">
          <div class="info-card">
            <div class="info-label">Categoría</div>
            <div class="info-value">${getCategoryLabel(checklist.category)}</div>
          </div>
          <div class="info-card">
            <div class="info-label">Frecuencia</div>
            <div class="info-value">${getFrequencyLabel(checklist.frequency)}</div>
          </div>
          <div class="info-card">
            <div class="info-label">Total Items</div>
            <div class="info-value">${totalItems}</div>
          </div>
          <div class="info-card">
            <div class="info-label">Tiempo Estimado</div>
            <div class="info-value">${formatTime(totalEstimatedTime)}</div>
          </div>
        </div>
        
        ${checklist.description ? `
        <div class="description">
          <div class="info-label">Descripción</div>
          <div class="info-value">${checklist.description}</div>
        </div>
        ` : ''}
        
        <div class="phases-section">
          <h2 style="color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; margin-bottom: 10px; font-size: 16px;">
            Items del Checklist
          </h2>
          
          <div class="table-container">
            <table class="checklist-table">
              <thead>
                <tr>
                  <th style="width: 20%;">Mantenimiento</th>
                  <th style="width: 12%;">Fecha de realizado</th>
                  <th style="width: 12%;">Fecha a reprogramar</th>
                  <th style="width: 22%;">Notas</th>
                  <th style="width: 22%;">Inconvenientes</th>
                  <th style="width: 22%;">Responsables y supervisores</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="footer">
          <p style="font-size: 10px;">Este checklist fue generado automáticamente por el sistema de mantenimiento - Fecha de impresión: ${currentDate}</p>
        </div>
      </body>
      </html>
    `;
    } catch (error) {
      console.error('🖨️ [PRINT] Error en generateChecklistPrintContent:', error);
      // Retornar contenido de error
      return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Error al generar checklist</title>
        </head>
        <body>
          <h1>Error al generar el checklist</h1>
          <p>${error instanceof Error ? error.message : 'Error desconocido'}</p>
        </body>
        </html>
      `;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'SAFETY': 'bg-red-100 text-red-800',
      'QUALITY': 'bg-blue-100 text-blue-800',
      'PRODUCTION': 'bg-green-100 text-green-800',
      'MAINTENANCE': 'bg-orange-100 text-orange-800',
      'CLEANING': 'bg-purple-100 text-purple-800',
      'INSPECTION': 'bg-indigo-100 text-indigo-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const handleReopenChecklist = async () => {
    if (!checklist) return;

    // Confirmar con el usuario
    const confirmed = window.confirm(
      `¿Estás seguro de que deseas re-abrir el checklist "${checklist.title}"?\n\n` +
      `Esto permitirá que el checklist pueda ser ejecutado nuevamente.`
    );

    if (!confirmed) return;

    setIsReopening(true);
    try {
      const response = await fetch('/api/maintenance/checklists', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          checklistId: checklist.id,
          isCompleted: false,
          executionStatus: 'PENDING'
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Checklist re-abierto",
          description: `El checklist "${checklist.title}" ha sido re-abierto y está listo para ser ejecutado nuevamente.`,
          variant: "default"
        });

        // Notificar al componente padre para que actualice la lista
        if (onChecklistUpdated) {
          onChecklistUpdated();
        }

        // Cerrar el diálogo para que se recargue con el nuevo estado
        onClose();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Error al re-abrir el checklist');
      }
    } catch (error: any) {
      console.error('Error al re-abrir el checklist:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo re-abrir el checklist",
        variant: "destructive"
      });
    } finally {
      setIsReopening(false);
    }
  };


  return (
    <>
      <style>{scrollStyles}</style>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent size="xl" className="p-0 flex flex-col">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b">
            <div className="space-y-3">
              {/* Fila superior: Título y badges */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg flex-shrink-0">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="tracking-tight text-sm sm:text-base font-bold truncate">
                        {checklist.title}
                      </h2>
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-blue-50 text-blue-700 border-blue-200">
                        v1.0
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-5 px-1.5 ${checklist.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                      >
                        {checklist.isActive ? 'Activo' : 'Borrador'}
                      </Badge>
                    </div>

                    {/* Información de máquina/equipo y sector */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                      {checklist.machine ? (
                        <span className="flex items-center gap-1">
                          <Cpu className="h-3 w-3" />
                          {checklist.machine.name}
                        </span>
                      ) : checklist.sector ? (
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {checklist.sector.name}
                        </span>
                      ) : null}

                      {checklist.lastExecutionDate && (
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          Última: {format(new Date(checklist.lastExecutionDate), 'dd/MM/yy', { locale: es })}
                        </span>
                      )}

                      {totalEstimatedTime > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {totalEstimatedTime < 60 ? `${totalEstimatedTime}min` : `${Math.floor(totalEstimatedTime / 60)}h ${totalEstimatedTime % 60}min`}
                        </span>
                      )}

                      <span className="flex items-center gap-1">
                        <CheckSquare className="h-3 w-3" />
                        {totalItems} items
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {!checklist.isCompleted && onExecute && (
                    <button
                      onClick={() => onExecute(checklist)}
                      className="justify-center whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-white h-8 rounded-md px-3 flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-xs"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Ejecutar
                    </button>
                  )}

                  {onEdit && canEdit && (
                    <button
                      onClick={() => onEdit(checklist)}
                      className="justify-center whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-2.5 flex items-center gap-1.5 text-xs"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span className="hidden sm:inline">Editar</span>
                    </button>
                  )}

                  <button
                    onClick={() => handlePrintChecklist(checklist)}
                    className="justify-center whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-2.5 flex items-center gap-1.5 text-xs"
                    title="Imprimir checklist"
                  >
                    <Printer className="h-3 w-3" />
                    <span className="hidden sm:inline">Imprimir</span>
                  </button>

                  <button
                    onClick={() => {
                      toast({
                        title: 'Duplicar checklist',
                        description: 'Función próximamente disponible',
                      });
                    }}
                    className="justify-center whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-2.5 flex items-center gap-1.5 text-xs"
                    title="Duplicar checklist"
                  >
                    <Copy className="h-3 w-3" />
                    <span className="hidden lg:inline">Duplicar</span>
                  </button>
                </div>
              </div>
            </div>
          </DialogHeader>

        <DialogBody className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col min-h-0">
            <div className="flex-shrink-0 bg-background px-4 sm:px-6">
              <div className="w-full">
                <TabsList className="w-full h-9 bg-muted/40 border border-border rounded-md p-1 overflow-x-auto">
                <TabsTrigger
                  value="overview"
                  className="ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 transition-colors duration-150 ease-in-out data-[state=active]:text-primary-foreground data-[state=active]:font-semibold data-[state=inactive]:hover:bg-muted/70 data-[state=inactive]:hover:text-foreground before:absolute before:inset-0 before:z-[-1] before:rounded-md before:shadow-md before:transition-transform before:duration-300 before:ease-in-out before:scale-x-0 before:origin-left before:bg-primary data-[state=active]:before:scale-x-100 relative z-10 justify-center whitespace-nowrap rounded-md py-1.5 text-xs font-normal h-7 px-2 sm:px-3 flex-1 data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-1"
                >
                  <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  Resumen
                </TabsTrigger>
                <TabsTrigger
                  value="items"
                  className="ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 transition-colors duration-150 ease-in-out data-[state=active]:text-primary-foreground data-[state=active]:font-semibold data-[state=inactive]:hover:bg-muted/70 data-[state=inactive]:hover:text-foreground before:absolute before:inset-0 before:z-[-1] before:rounded-md before:shadow-md before:transition-transform before:duration-300 before:ease-in-out before:scale-x-0 before:origin-left before:bg-primary data-[state=active]:before:scale-x-100 relative z-10 justify-center whitespace-nowrap rounded-md py-1.5 text-xs font-normal h-7 px-2 sm:px-3 flex-1 data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-1"
                >
                  <CheckSquare className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  Items
                </TabsTrigger>
                <TabsTrigger
                  value="instructives"
                  className="ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 transition-colors duration-150 ease-in-out data-[state=active]:text-primary-foreground data-[state=active]:font-semibold data-[state=inactive]:hover:bg-muted/70 data-[state=inactive]:hover:text-foreground before:absolute before:inset-0 before:z-[-1] before:rounded-md before:shadow-md before:transition-transform before:duration-300 before:ease-in-out before:scale-x-0 before:origin-left before:bg-primary data-[state=active]:before:scale-x-100 relative z-10 justify-center whitespace-nowrap rounded-md py-1.5 text-xs font-normal h-7 px-2 sm:px-3 flex-1 data-[state=active]:bg-background data-[state=active]:shadow-sm group flex items-center gap-1"
                >
                  <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  Instructivos
                </TabsTrigger>
                <TabsTrigger
                  value="details"
                  className="ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 transition-colors duration-150 ease-in-out data-[state=active]:text-primary-foreground data-[state=active]:font-semibold data-[state=inactive]:hover:bg-muted/70 data-[state=inactive]:hover:text-foreground before:absolute before:inset-0 before:z-[-1] before:rounded-md before:shadow-md before:transition-transform before:duration-300 before:ease-in-out before:scale-x-0 before:origin-left before:bg-primary data-[state=active]:before:scale-x-100 relative z-10 justify-center whitespace-nowrap rounded-md py-1.5 text-xs font-normal h-7 px-2 sm:px-3 flex-1 data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-1"
                >
                  <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  Detalles
                </TabsTrigger>
                <TabsTrigger
                  value="execution"
                  className="ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 transition-colors duration-150 ease-in-out data-[state=active]:text-primary-foreground data-[state=active]:font-semibold data-[state=inactive]:hover:bg-muted/70 data-[state=inactive]:hover:text-foreground before:absolute before:inset-0 before:z-[-1] before:rounded-md before:shadow-md before:transition-transform before:duration-300 before:ease-in-out before:scale-x-0 before:origin-left before:bg-primary data-[state=active]:before:scale-x-100 relative z-10 justify-center whitespace-nowrap rounded-md py-1.5 text-xs font-normal h-7 px-2 sm:px-3 flex-1 data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-1"
                >
                  <Play className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  Ejecución
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 transition-colors duration-150 ease-in-out data-[state=active]:text-primary-foreground data-[state=active]:font-semibold data-[state=inactive]:hover:bg-muted/70 data-[state=inactive]:hover:text-foreground before:absolute before:inset-0 before:z-[-1] before:rounded-md before:shadow-md before:transition-transform before:duration-300 before:ease-in-out before:scale-x-0 before:origin-left before:bg-primary data-[state=active]:before:scale-x-100 relative z-10 justify-center whitespace-nowrap rounded-md py-1.5 text-xs font-normal h-7 px-2 sm:px-3 flex-1 data-[state=active]:bg-background data-[state=active]:shadow-sm group flex items-center gap-1"
                >
                  <History className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  Historial
                </TabsTrigger>
              </TabsList>
              </div>
            </div>
            
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-4 sm:p-6">
                {/* Tab de Resumen */}
                <TabsContent value="overview" className="ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-right-1 data-[state=active]:duration-300 data-[state=active]:ease-out space-y-4 sm:space-y-6 mt-0">
                  {checklist?.id ? (
                    <ChecklistOverviewTab checklistId={checklist.id} />
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground">No hay información del checklist</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Tab de Items */}
                <TabsContent value="items" className="ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-right-1 data-[state=active]:duration-300 data-[state=active]:ease-out space-y-4 sm:space-y-6 mt-0">
                  {checklist?.id ? (
                    <ChecklistItemsTab checklistId={checklist.id} />
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <CheckSquare className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground">Este checklist no tiene items cargados</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

            {/* Tab de Instructivos */}
                <TabsContent value="instructives" className="ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-right-1 data-[state=active]:duration-300 data-[state=active]:ease-out space-y-4 sm:space-y-6 mt-0">
                  {checklist?.id ? (
                    <ChecklistInstructivesTab checklistId={checklist.id} />
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground">No hay instructivos cargados</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

            {/* Tab de Detalles */}
                <TabsContent value="details" className="ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-right-1 data-[state=active]:duration-300 data-[state=active]:ease-out space-y-4 sm:space-y-6 mt-0">
                  <ChecklistDetailsTab checklist={checklist} />
                </TabsContent>

            {/* Tab de Ejecución */}
                <TabsContent value="execution" className="ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-right-1 data-[state=active]:duration-300 data-[state=active]:ease-out space-y-4 sm:space-y-6 mt-0">
                  <ChecklistExecutionTab
                    checklist={checklist}
                    onExecute={() => onExecute && onExecute(checklist)}
                    onViewHistory={() => setActiveTab('history')}
                    onEdit={() => onEdit && onEdit(checklist)}
                    canExecute={!checklist?.isCompleted}
                    canEdit={!!onEdit}
                    canViewHistory={true}
                  />
                </TabsContent>

                {/* Tab de Historial */}
                <TabsContent value="history" className="ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-right-1 data-[state=active]:duration-300 data-[state=active]:ease-out space-y-4 sm:space-y-6 mt-0">
                  <ChecklistHistoryContent checklistId={checklist?.id} companyId={checklist?.companyId} checklist={checklist} onPrintChecklist={handlePrintChecklist} />
                </TabsContent>
              </div>
            </div>
          </Tabs>
        </DialogBody>
      </DialogContent>
      
      {/* Modal para ver instructivo completo */}
      <Dialog open={viewingInstructiveIndex !== null} onOpenChange={(open) => !open && setViewingInstructiveIndex(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {viewingInstructiveIndex !== null && instructives[viewingInstructiveIndex]?.title}
            </DialogTitle>
            <DialogDescription>
              Instructivo del checklist: {checklist?.title}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            {viewingInstructiveIndex !== null && instructives[viewingInstructiveIndex] && (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: instructives[viewingInstructiveIndex].content }}
                style={{
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word'
                }}
              />
            )}
          </DialogBody>

          <DialogFooter className="justify-between">
            {instructives.length > 1 && viewingInstructiveIndex !== null && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (viewingInstructiveIndex > 0) {
                      setViewingInstructiveIndex(viewingInstructiveIndex - 1);
                    }
                  }}
                  disabled={viewingInstructiveIndex === 0}
                >
                  Anterior
                </Button>
                <span className="text-sm font-medium">
                  {viewingInstructiveIndex + 1} de {instructives.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (viewingInstructiveIndex < instructives.length - 1) {
                      setViewingInstructiveIndex(viewingInstructiveIndex + 1);
                    }
                  }}
                  disabled={viewingInstructiveIndex === instructives.length - 1}
                >
                  Siguiente
                </Button>
              </div>
            )}
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={() => setViewingInstructiveIndex(null)}>
                Cerrar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
    </>
  );
}

// Componente para mostrar el historial de ejecuciones del checklist
function ChecklistHistoryContent({ checklistId, companyId, checklist, onPrintChecklist }: { checklistId?: number; companyId?: number; checklist?: ChecklistData | null; onPrintChecklist?: (checklist: any) => void }) {
  const { toast } = useToast();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [printExecutionId, setPrintExecutionId] = useState<number | null>(null);

  // Normalizar companyId para mantener consistencia en el array de dependencias
  const normalizedCompanyId = companyId ?? null;
  
  // Mover fetchHistory dentro del useEffect para evitar dependencias faltantes
  useEffect(() => {
  const fetchHistory = async () => {
    if (!checklistId) return;
    setLoading(true);
    try {
        const response = await fetch(`/api/maintenance/checklist-execution?checklistId=${checklistId}${normalizedCompanyId ? `&companyId=${normalizedCompanyId}` : ''}`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.executions || []);
      }
    } catch (error) {
      console.error('Error fetching checklist history:', error);
    } finally {
      setLoading(false);
    }
  };

    if (checklistId) {
      fetchHistory();
    }
  }, [checklistId, normalizedCompanyId]); // Array de dependencias siempre tiene el mismo tamaño

  const handlePrint = (executionId: number) => {
    // Abrir el modal de impresión
    setPrintExecutionId(executionId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-xs text-gray-500">Cargando historial...</div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-sm font-semibold mb-2">Sin historial disponible</h3>
          <p className="text-xs text-gray-600">No hay ejecuciones de este checklist registradas</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-gray-900">Historial de Ejecuciones</h3>
          <Badge variant="outline" className="text-xs">{history.length} ejecuciones</Badge>
        </div>
        
        {history.map((execution) => (
          <Card key={execution.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {execution.status === 'COMPLETED' ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />
                    )}
                    <h3 className="font-medium text-xs text-gray-900">
                      Ejecución #{execution.id}
                    </h3>
                    <Badge className={`${execution.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'} text-xs`}>
                      {execution.status === 'COMPLETED' ? 'Completado' : execution.status}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-600 mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {(() => {
                          // Intentar obtener la hora de finalización de los detalles
                          const executionDetails = execution.executionDetails || {};
                          const responsibles = executionDetails.responsibles || {};
                          const horaFinalizacion = responsibles.horaFinalizacion;
                          
                          const fecha = new Date(execution.executedAt);
                          
                          // Si executedAt tiene hora 00:00 y hay horaFinalizacion en los detalles, usar horaFinalizacion
                          // Si executedAt ya tiene una hora válida (no 00:00), usarla directamente
                          if (fecha.getHours() === 0 && fecha.getMinutes() === 0 && horaFinalizacion) {
                            const [horas, minutos] = horaFinalizacion.split(':');
                            fecha.setHours(parseInt(horas) || 0, parseInt(minutos) || 0, 0, 0);
                          }
                          
                          return format(fecha, 'dd/MM/yyyy HH:mm', { locale: es });
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      <span>{execution.executedBy}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>{execution.completedItems}/{execution.totalItems} items</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{execution.executionTime} min</span>
                    </div>
                  </div>
                </div>

                <div className="ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrint(execution.id)}
                    className="flex items-center gap-2 h-8 text-xs"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Imprimir
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal de impresión */}
      <ChecklistPrintModal 
        executionId={printExecutionId} 
        isOpen={printExecutionId !== null}
        onClose={() => setPrintExecutionId(null)}
      />
    </>
  );
}

// Componente modal para imprimir la ejecución del checklist
function ChecklistPrintModal({ executionId, isOpen, onClose }: { executionId: number | null; isOpen: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [executionData, setExecutionData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [checklistTitle, setChecklistTitle] = useState<string | null>(null);
  const [maintenanceMap, setMaintenanceMap] = useState<Record<number, { title: string; description: string }>>({});

  useEffect(() => {
    if (!isOpen || !executionId) {
      return;
    }

    const fetchExecutionData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/maintenance/checklist-execution?executionId=${executionId}`);
        const data = await response.json();

        if (response.ok && data.success) {
          const exec = data.execution;
          
          // Extraer título del checklist
          const extractChecklistTitle = (checklist: any): string | null => {
            if (!checklist) return null;
            if (typeof checklist === 'string') {
              try {
                const parsed = JSON.parse(checklist);
                return parsed.title || parsed.name || null;
              } catch {
                return checklist.trim() || null;
              }
            }
            if (typeof checklist === 'object' && checklist !== null) {
              return checklist.title || checklist.name || checklist.checklistTitle || checklist.checklistName || null;
            }
            return null;
          };

          let foundTitle = extractChecklistTitle(exec.checklist);
          let finalChecklist = exec.checklist;

          if (foundTitle) {
            setChecklistTitle(foundTitle);
          } else if (!exec.checklist && exec.checklistId) {
            // Intentar obtener desde API de checklists
            try {
              const checklistResponse = await fetch(`/api/maintenance/checklists?checklistId=${exec.checklistId}`, {
                credentials: 'include'
              });
              if (checklistResponse.ok) {
                const checklistResult = await checklistResponse.json();
                if (checklistResult.success && checklistResult.checklists && checklistResult.checklists.length > 0) {
                  const checklistFromAPI = checklistResult.checklists[0];
                  finalChecklist = checklistFromAPI;
                  exec.checklist = checklistFromAPI;
                  foundTitle = extractChecklistTitle(checklistFromAPI);
                  if (foundTitle) {
                    setChecklistTitle(foundTitle);
                  }
                }
              }
            } catch (apiErr) {
              console.error('Error obteniendo checklist desde API:', apiErr);
            }
          }

          setExecutionData({ ...exec, checklist: finalChecklist });

          // Cargar información de mantenimientos usando cache
          if (exec?.companyId) {
            try {
              const maints = await fetchAllMaintenancesCached(exec.companyId);
              const map: Record<number, { title: string; description: string }> = {};
              maints.forEach((m: any) => {
                if (m?.id) {
                  map[m.id] = {
                    title: m.title || `Mantenimiento ID ${m.id}`,
                    description: m.description || '',
                  };
                }
              });
              setMaintenanceMap(map);
            } catch (maintErr) {
              console.error('Error cargando datos de mantenimientos:', maintErr);
            }
          }
        } else {
          setError(data.error || 'Error al cargar los datos');
        }
      } catch (err) {
        setError('Error al cargar los datos de la ejecución');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchExecutionData();
  }, [isOpen, executionId]);

  // Auto-print DESACTIVADO - el usuario debe hacer clic en el botón para imprimir
  // useEffect(() => {
  //   if (!loading && executionData && !error && isOpen) {
  //     const printTimer = setTimeout(() => {
  //       try {
  //         window.print();
  //       } catch (err) {
  //         console.error('Error al iniciar la impresión:', err);
  //       }
  //     }, 1500);
  //     return () => clearTimeout(printTimer);
  //   }
  // }, [loading, executionData, error, isOpen]);

  const finalTitle = useMemo(() => {
    const execution = executionData;
    const checklist = executionData?.checklist || null;
    return checklistTitle || checklist?.title || (execution?.checklistId ? `Checklist ID ${execution.checklistId}` : 'Checklist de Mantenimiento');
  }, [checklistTitle, executionData?.checklist?.title, executionData?.checklistId, executionData]);

  // Agregar estilos de impresión al documento cuando el modal está abierto
  // IMPORTANTE: Este hook debe estar ANTES de cualquier return condicional
  useEffect(() => {
    if (!isOpen) {
      // Limpiar estilos cuando el modal se cierra
      const existingStyle = document.getElementById('checklist-print-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
      return;
    }
    
    const style = document.createElement('style');
    style.id = 'checklist-print-styles';
    style.textContent = `
      @media print {
        /* Ocultar SOLO el overlay del Dialog, NO el contenido */
        [data-radix-dialog-overlay] {
          display: none !important;
        }
        
        /* Asegurar que el contenido del Dialog sea visible y estético */
        [data-radix-dialog-content] {
          position: static !important;
          transform: none !important;
          max-width: 100% !important;
          max-height: none !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          box-shadow: none !important;
          background: white !important;
          opacity: 1 !important;
          display: block !important;
          visibility: visible !important;
        }
        
        /* Asegurar que todos los elementos dentro del DialogContent sean visibles */
        [data-radix-dialog-content],
        [data-radix-dialog-content] *,
        [data-print-content="true"],
        [data-print-content="true"] * {
          visibility: visible !important;
        }
        
        /* Asegurar que los divs con contenido sean visibles */
        [data-radix-dialog-content] > div,
        [data-print-content="true"] > div {
          display: block !important;
          visibility: visible !important;
        }
        
        /* Excepciones para elementos que deben estar ocultos */
        [data-radix-dialog-content] button,
        [data-radix-dialog-content] [class*="print:hidden"],
        [data-radix-dialog-content] .print\\:hidden,
        [data-print-content="true"] button,
        [data-print-content="true"] [class*="print:hidden"],
        [data-print-content="true"] .print\\:hidden {
          display: none !important;
        }
        
        /* Ocultar elementos no imprimibles fuera del DialogContent */
        button:not([data-radix-dialog-content] button),
        [class*="print:hidden"]:not([data-radix-dialog-content] [class*="print:hidden"]) {
          display: none !important;
        }
        
        /* Asegurar que el body sea blanco */
        body {
          background: white !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        /* Ajustar página A4 */
        @page {
          size: A4;
          margin: 10mm;
        }
        
        /* Asegurar que el contenido principal sea visible */
        .bg-white {
          background: white !important;
          display: block !important;
          visibility: visible !important;
        }
        
        /* Asegurar que el contenedor principal no tenga restricciones */
        .max-w-6xl {
          max-width: 100% !important;
        }
        
        /* Asegurar que todos los textos sean visibles */
        p, h1, h2, h3, h4, h5, h6, span, div, li, ul, ol {
          color: black !important;
          visibility: visible !important;
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      const existingStyle = document.getElementById('checklist-print-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, [isOpen]);

  // Función para generar HTML completo para impresión
  const generatePrintHTML = useCallback(() => {
    if (!executionData) return '';
    
    const execution = executionData;
    const checklist = executionData?.checklist || null;
    const details = execution?.executionDetails || {};
    const signatures = details.signatures || {};
    const responsibles = details.responsibles || {};
    
    // Calcular título
    const title = checklistTitle || checklist?.title || (execution?.checklistId ? `Checklist ID ${execution.checklistId}` : 'Checklist de Mantenimiento');

    // Procesar items de mantenimiento
    const maintenanceItems = details.maintenanceItems || [];
    const legacyCompleted = details.completed || [];
    const legacyIncomplete = details.incomplete || [];

    const allMaintenanceItems = [
      ...maintenanceItems,
      ...legacyCompleted.map((item: any) => ({
        maintenanceId: item.maintenanceId ?? item.id,
        completedDate: item.completedAt ? format(new Date(item.completedAt), 'dd/MM/yyyy HH:mm', { locale: es }) : '',
        rescheduleDate: '',
        notes: item.justification || '',
        issues: '',
        currentKilometers: null,
        currentHours: null,
        executors: [],
        supervisors: [],
      })),
      ...legacyIncomplete.map((item: any) => ({
        maintenanceId: item.maintenanceId ?? item.id,
        completedDate: '',
        rescheduleDate: '',
        notes: item.justification || '',
        issues: '',
        currentKilometers: null,
        currentHours: null,
        executors: [],
        supervisors: [],
      })),
    ];

    // Agrupar tareas por responsable
    const tasksByExecutor: Record<string, Array<{ title: string; id: number }>> = {};
    const tasksBySupervisor: Record<string, Array<{ title: string; id: number }>> = {};
    
    allMaintenanceItems.forEach((item: any) => {
      const maintInfo = maintenanceMap[item.maintenanceId] || {
        title: `Mantenimiento ID ${item.maintenanceId}`,
        description: ''
      };
      const taskInfo = { title: maintInfo.title, id: item.maintenanceId };
      
      (item.executors || []).forEach((exec: string) => {
        if (!tasksByExecutor[exec]) {
          tasksByExecutor[exec] = [];
        }
        tasksByExecutor[exec].push(taskInfo);
      });
      
      (item.supervisors || []).forEach((sup: string) => {
        if (!tasksBySupervisor[sup]) {
          tasksBySupervisor[sup] = [];
        }
        tasksBySupervisor[sup].push(taskInfo);
      });
    });
    
    const allExecutors = Object.keys(tasksByExecutor);
    const allSupervisors = Object.keys(tasksBySupervisor);
    const allPeople = Array.from(new Set([...allExecutors, ...allSupervisors]));

    // Generar HTML de mantenimientos
    const maintenanceItemsHTML = allMaintenanceItems.map((item: any, index: number) => {
      const maintInfo = maintenanceMap[item.maintenanceId] || {
        title: `Mantenimiento ID ${item.maintenanceId}`,
        description: ''
      };
      const itemExecutors = item.executors || [];
      const itemSupervisors = item.supervisors || [];
      
      return `
        <div style="border: 1px solid #9ca3af; border-radius: 4px; padding: 10px; margin-bottom: 12px; background: #f9fafb; page-break-inside: avoid;">
          <div style="font-weight: 600; font-size: 12px; margin-bottom: 4px;">
            ${maintInfo.title} <span style="font-size: 10px; font-weight: normal; color: #6b7280;">(ID: ${item.maintenanceId})</span>
          </div>
          ${item.completedDate ? `<div style="font-size: 10px; color: #374151; margin-bottom: 2px;"><strong>Fecha de completado:</strong> ${item.completedDate}</div>` : ''}
          ${item.notes ? `<div style="font-size: 10px; color: #374151; margin-top: 4px;"><strong>Notas:</strong> ${item.notes}</div>` : ''}
          ${item.issues ? `<div style="font-size: 10px; color: #374151; margin-top: 4px;"><strong>Inconvenientes:</strong> ${item.issues}</div>` : ''}
          ${(itemExecutors.length > 0 || itemSupervisors.length > 0) ? `
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #9ca3af;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 10px;">
                ${itemExecutors.length > 0 ? `
                  <div>
                    <strong>Responsables:</strong>
                    <ul style="list-style: disc; list-style-position: inside; margin-left: 4px; margin-top: 2px; font-size: 9px;">
                      ${itemExecutors.map((exec: string) => `<li>${exec}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
                ${itemSupervisors.length > 0 ? `
                  <div>
                    <strong>Supervisores:</strong>
                    <ul style="list-style: disc; list-style-position: inside; margin-left: 4px; margin-top: 2px; font-size: 9px;">
                      ${itemSupervisors.map((sup: string) => `<li>${sup}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Generar HTML de resumen de firmas
    const signaturesHTML = allPeople.map((personName: string) => {
      const executorTasks = tasksByExecutor[personName] || [];
      const supervisorTasks = tasksBySupervisor[personName] || [];
      
      let signature: string | null = null;
      if (Array.isArray(signatures.executors)) {
        const executorSig = signatures.executors.find((s: any) => s.name === personName);
        signature = executorSig?.signature || null;
      } else if (signatures.executors && typeof signatures.executors === 'object') {
        signature = signatures.executors[personName] || null;
      }
      
      if (!signature) {
        if (Array.isArray(signatures.supervisors)) {
          const supervisorSig = signatures.supervisors.find((s: any) => s.name === personName);
          signature = supervisorSig?.signature || null;
        } else if (signatures.supervisors && typeof signatures.supervisors === 'object') {
          signature = signatures.supervisors[personName] || null;
        }
      }

      return `
        <div style="border: 1px solid #9ca3af; border-radius: 4px; padding: 12px; margin-bottom: 12px; background: #f9fafb; page-break-inside: avoid;">
          <div style="display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: start;">
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px;">${personName}</div>
              ${executorTasks.length > 0 ? `
                <div style="margin-bottom: 8px;">
                  <div style="font-weight: 500; font-size: 11px; margin-bottom: 4px;">Tareas como Responsable:</div>
                  <div style="margin-left: 12px;">
                    ${executorTasks.map((task: any) => `
                      <div style="font-size: 10px; color: #374151; margin-bottom: 2px;">
                        • ${task.title} <span style="color: #6b7280; font-size: 9px;">(ID: ${task.id})</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
              ${supervisorTasks.length > 0 ? `
                <div style="margin-bottom: 8px;">
                  <div style="font-weight: 500; font-size: 11px; margin-bottom: 4px;">Tareas como Supervisor:</div>
                  <div style="margin-left: 12px;">
                    ${supervisorTasks.map((task: any) => `
                      <div style="font-size: 10px; color: #374151; margin-bottom: 2px;">
                        • ${task.title} <span style="color: #6b7280; font-size: 9px;">(ID: ${task.id})</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
            <div style="width: 180px; flex-shrink: 0;">
              <div style="font-weight: 500; font-size: 10px; margin-bottom: 6px; text-align: center;">Firma:</div>
              ${signature ? `
                <div style="margin-top: 6px;">
                  <img src="${signature}" alt="Firma ${personName}" style="width: 100%; height: 70px; object-fit: contain; border: 1px solid #9ca3af; background: white; padding: 4px;" />
                </div>
              ` : `
                <div style="margin-top: 6px;">
                  <div style="border-bottom: 2px solid #4b5563; height: 50px; margin-bottom: 4px;"></div>
                  <div style="font-size: 9px; color: #6b7280; text-align: center;">Firma</div>
                </div>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ejecución del Checklist - ${title}</title>
        <style>
          @media print {
            @page {
              size: A4;
              margin: 8mm;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.4;
            color: #333;
            padding: 12px;
            background: white;
            font-size: 11px;
          }
          .header {
            border-bottom: 2px solid #1f2937;
            padding-bottom: 12px;
            margin-bottom: 12px;
          }
          .header h1 {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 8px;
            text-align: center;
          }
          .header-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            font-size: 10px;
          }
          .section {
            margin-bottom: 16px;
          }
          .section h2 {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <div class="header-info">
            <div><strong>ID del Checklist:</strong> ${execution.checklistId}</div>
            <div><strong>ID de Ejecución:</strong> ${execution.id}</div>
            <div><strong>Fecha de Ejecución:</strong> ${format(new Date(execution.executedAt), 'dd/MM/yyyy HH:mm', { locale: es })}</div>
            <div><strong>Ejecutado por:</strong> ${execution.executedBy}</div>
            <div><strong>Estado:</strong> ${execution.status === 'COMPLETED' ? 'Completado' : execution.status}</div>
            <div><strong>Items completados:</strong> ${execution.completedItems} / ${execution.totalItems}</div>
          </div>
        </div>

        ${allMaintenanceItems.length > 0 ? `
          <div class="section">
            <h2>Mantenimientos Ejecutados</h2>
            ${maintenanceItemsHTML}
          </div>
        ` : ''}

        ${allPeople.length > 0 ? `
          <div class="section" style="margin-top: 24px; border-top: 2px solid #1f2937; padding-top: 16px; page-break-before: always;">
            <h2>Resumen por Persona y Firmas</h2>
            ${signaturesHTML}
          </div>
        ` : ''}
      </body>
      </html>
    `;
  }, [executionData, checklistTitle, maintenanceMap]);

  // Ahora sí podemos hacer el return condicional después de todos los hooks
  if (!isOpen) return null;

  const execution = executionData;
  const checklist = executionData?.checklist || null;
  const details = execution?.executionDetails || {};
  const signatures = details.signatures || {};
  const responsibles = details.responsibles || {};

  // Procesar items de mantenimiento
  const maintenanceItems = details.maintenanceItems || [];
  const legacyCompleted = details.completed || [];
  const legacyIncomplete = details.incomplete || [];

  const allMaintenanceItems = [
    ...maintenanceItems,
    ...legacyCompleted.map((item: any) => ({
      maintenanceId: item.maintenanceId ?? item.id,
      completedDate: item.completedAt ? format(new Date(item.completedAt), 'dd/MM/yyyy HH:mm', { locale: es }) : '',
      rescheduleDate: '',
      notes: item.justification || '',
      issues: '',
      currentKilometers: null,
      currentHours: null,
      executors: [],
      supervisors: [],
    })),
    ...legacyIncomplete.map((item: any) => ({
      maintenanceId: item.maintenanceId ?? item.id,
      completedDate: '',
      rescheduleDate: '',
      notes: item.justification || '',
      issues: '',
      currentKilometers: null,
      currentHours: null,
      executors: [],
      supervisors: [],
    })),
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="xl"
        className="print:max-w-full print:max-h-none print:overflow-visible print:static print:transform-none print:shadow-none print:border-none print:p-0 print:m-0 print:bg-white"
        style={{
          // @ts-ignore - para asegurar visibilidad en impresion
          '--print-display': 'block'
        } as React.CSSProperties}
        data-print-content="true"
      >
        <DialogHeader className="print:hidden">
          <DialogTitle>Imprimir Ejecucion del Checklist</DialogTitle>
        </DialogHeader>

        <DialogBody>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : error || !executionData ? (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-red-600 mb-4">{error || 'No se encontraron datos'}</p>
            <Button onClick={onClose} variant="outline" size="sm">
              Cerrar
            </Button>
          </div>
        ) : (
          <div className="bg-white print:bg-white print:block" style={{ display: 'block', visibility: 'visible' }}>
            {/* Botones de accion - ocultos en impresion */}
            <div className="mb-6 flex gap-4 print:hidden">
              <Button onClick={onClose} variant="outline" size="sm">
                <X className="h-4 w-4 mr-2" />
                Cerrar
              </Button>
              <Button onClick={() => {
                const htmlContent = generatePrintHTML();
                
                if (!htmlContent || htmlContent.trim().length === 0) {
                  alert('No hay datos para imprimir');
                  return;
                }
                
                const iframe = document.createElement('iframe');
                iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none';
                document.body.appendChild(iframe);
                
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                if (!iframeDoc) {
                  alert('Error al crear el iframe para imprimir');
                  return;
                }
                
                iframeDoc.open();
                iframeDoc.write(htmlContent);
                iframeDoc.close();
                
                let hasPrinted = false;
                
                const doPrint = () => {
                  if (hasPrinted) return;
                  
                  const iframeBody = iframe.contentWindow?.document?.body;
                  if (!iframeBody || iframeBody.innerHTML.trim().length === 0) return;
                  
                  hasPrinted = true;
                  
                  try {
                    setTimeout(() => {
                      iframe.contentWindow?.focus();
                      iframe.contentWindow?.print();
                      setTimeout(() => {
                        if (iframe.parentNode) document.body.removeChild(iframe);
                      }, 1000);
                    }, 200);
                  } catch (printError) {
                    if (iframe.parentNode) document.body.removeChild(iframe);
                    alert('Error al iniciar la impresión. Intenta usar Ctrl+P manualmente.');
                  }
                };
                
                iframe.onload = () => setTimeout(doPrint, 300);
                setTimeout(() => { if (iframe.parentNode && !hasPrinted) doPrint(); }, 1500);
              }} className="bg-blue-600 hover:bg-blue-700">
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
            </div>

            {/* Contenido imprimible - Optimizado para A4 */}
            <div className="w-full bg-white print:w-full print:max-w-none print:mx-0 print:px-8" style={{ display: 'block', visibility: 'visible' }}>
              {/* Encabezado - Mejorado para A4 */}
              <div className="border-b-2 border-gray-800 pb-5 mb-6 print:border-b-3 print:pb-6" style={{ display: 'block', visibility: 'visible' }}>
                <h1 className="text-3xl font-bold mb-6 text-center print:text-4xl print:mb-7 print:mt-0" style={{ display: 'block', visibility: 'visible' }}>
                  {finalTitle}
                </h1>
                <div className="grid grid-cols-2 gap-4 text-sm print:gap-6 print:text-base">
                  <div className="print:py-2">
                    <strong className="text-gray-800">ID del Checklist:</strong> <span className="ml-2">{execution.checklistId}</span>
                  </div>
                  <div className="print:py-2">
                    <strong className="text-gray-800">ID de Ejecución:</strong> <span className="ml-2">{execution.id}</span>
                  </div>
                  <div className="print:py-2">
                    <strong className="text-gray-800">Fecha de Ejecución:</strong>{' '}
                    <span className="ml-2">{format(new Date(execution.executedAt), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
                  </div>
                  <div className="print:py-2">
                    <strong className="text-gray-800">Ejecutado por:</strong> <span className="ml-2">{execution.executedBy}</span>
                  </div>
                  <div className="print:py-2">
                    <strong className="text-gray-800">Estado:</strong> <span className="ml-2">{execution.status === 'COMPLETED' ? 'Completado' : execution.status}</span>
                  </div>
                  <div className="print:py-2">
                    <strong className="text-gray-800">Items completados:</strong> <span className="ml-2">{execution.completedItems} / {execution.totalItems}</span>
                  </div>
                </div>
              </div>

              {/* Mantenimientos Ejecutados - Con responsables y supervisores */}
              {allMaintenanceItems.length > 0 && (
                <div className="mb-8 print:mb-10">
                  <h2 className="text-xl font-semibold mb-5 print:text-2xl print:mb-6">Mantenimientos Ejecutados</h2>
                  <div className="space-y-6">
                    {allMaintenanceItems.map((item: any, index: number) => {
                      const maintInfo = maintenanceMap[item.maintenanceId] || {
                        title: `Mantenimiento ID ${item.maintenanceId}`,
                        description: ''
                      };
                      const itemExecutors = item.executors || [];
                      const itemSupervisors = item.supervisors || [];
                      return (
                        <div key={index} className="border-2 border-gray-400 rounded-lg p-4 bg-gray-50 print:p-5 print:mb-5">
                          <div className="font-semibold text-lg mb-2 print:text-xl print:mb-3">
                            {maintInfo.title} <span className="text-sm font-normal text-gray-600 print:text-base">(ID: {item.maintenanceId})</span>
                          </div>
                          {item.completedDate && (
                            <div className="text-sm text-gray-700 mb-1 print:text-base print:mb-2">
                              <strong>Fecha de completado:</strong> {item.completedDate}
                            </div>
                          )}
                          {item.notes && (
                            <div className="text-sm text-gray-700 mt-2 print:text-base print:mt-3">
                              <strong>Notas:</strong> {item.notes}
                            </div>
                          )}
                          {item.issues && (
                            <div className="text-sm text-gray-700 mt-2 print:text-base print:mt-3">
                              <strong>Inconvenientes:</strong> {item.issues}
                            </div>
                          )}
                          {/* Responsables y Supervisores de este mantenimiento */}
                          {(itemExecutors.length > 0 || itemSupervisors.length > 0) && (
                            <div className="mt-3 pt-3 border-t-2 border-gray-400 print:mt-4 print:pt-4">
                              <div className="grid grid-cols-2 gap-4 text-sm print:gap-6 print:text-base">
                                {itemExecutors.length > 0 && (
                                  <div>
                                    <strong>Responsables:</strong>
                                    <ul className="list-disc list-inside ml-2 mt-1">
                                      {itemExecutors.map((exec: string, idx: number) => (
                                        <li key={idx}>{exec}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {itemSupervisors.length > 0 && (
                                  <div>
                                    <strong>Supervisores:</strong>
                                    <ul className="list-disc list-inside ml-2 mt-1">
                                      {itemSupervisors.map((sup: string, idx: number) => (
                                        <li key={idx}>{sup}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Resumen por Persona - Tareas y Firmas */}
              {(() => {
                // Agrupar tareas por responsable
                const tasksByExecutor: Record<string, Array<{ title: string; id: number }>> = {};
                const tasksBySupervisor: Record<string, Array<{ title: string; id: number }>> = {};
                
                allMaintenanceItems.forEach((item: any) => {
                  const maintInfo = maintenanceMap[item.maintenanceId] || {
                    title: `Mantenimiento ID ${item.maintenanceId}`,
                    description: ''
                  };
                  const taskInfo = { title: maintInfo.title, id: item.maintenanceId };
                  
                  // Agrupar por ejecutores
                  (item.executors || []).forEach((exec: string) => {
                    if (!tasksByExecutor[exec]) {
                      tasksByExecutor[exec] = [];
                    }
                    tasksByExecutor[exec].push(taskInfo);
                  });
                  
                  // Agrupar por supervisores
                  (item.supervisors || []).forEach((sup: string) => {
                    if (!tasksBySupervisor[sup]) {
                      tasksBySupervisor[sup] = [];
                    }
                    tasksBySupervisor[sup].push(taskInfo);
                  });
                });
                
                // Obtener todas las personas únicas
                const allExecutors = Object.keys(tasksByExecutor);
                const allSupervisors = Object.keys(tasksBySupervisor);
                const allPeople = Array.from(new Set([...allExecutors, ...allSupervisors]));
                
                return (
                  <div className="mt-12 border-t-3 border-gray-800 pt-6 print:mt-14 print:pt-8 print:border-t-4">
                    <h2 className="text-xl font-semibold mb-6 print:text-2xl print:mb-8">Resumen por Persona y Firmas</h2>
                    
                    {allPeople.length > 0 ? (
                      <div className="space-y-8">
                        {allPeople.map((personName: string) => {
                          const executorTasks = tasksByExecutor[personName] || [];
                          const supervisorTasks = tasksBySupervisor[personName] || [];
                          
                          // Buscar firma - puede ser array o objeto
                          let signature: string | null = null;
                          
                          // Si signatures.executors es un array
                          if (Array.isArray(signatures.executors)) {
                            const executorSig = signatures.executors.find((s: any) => s.name === personName);
                            signature = executorSig?.signature || null;
                          } 
                          // Si signatures.executors es un objeto (Record<string, string>)
                          else if (signatures.executors && typeof signatures.executors === 'object') {
                            signature = signatures.executors[personName] || null;
                          }
                          
                          // Si no encontró en ejecutores, buscar en supervisores
                          if (!signature) {
                            if (Array.isArray(signatures.supervisors)) {
                              const supervisorSig = signatures.supervisors.find((s: any) => s.name === personName);
                              signature = supervisorSig?.signature || null;
                            } 
                            else if (signatures.supervisors && typeof signatures.supervisors === 'object') {
                              signature = signatures.supervisors[personName] || null;
                            }
                          }
                          
                          return (
                            <div key={personName} className="border-2 border-gray-400 rounded-lg p-5 bg-gray-50 print:p-6 print:mb-6">
                              <div className="grid grid-cols-[1fr_auto] gap-6 print:gap-8 items-start">
                                {/* Columna izquierda: Tareas */}
                                <div className="flex-1">
                                  <div className="font-semibold text-lg mb-4 print:text-xl print:mb-5">{personName}</div>
                                  
                                  {/* Tareas como Responsable */}
                                  {executorTasks.length > 0 && (
                                    <div className="mb-4 print:mb-5">
                                      <div className="font-medium text-base mb-2 print:text-lg print:mb-3">Tareas como Responsable:</div>
                                      <div className="space-y-1 ml-4 print:space-y-2">
                                        {executorTasks.map((task, idx) => (
                                          <div key={idx} className="text-sm text-gray-700 print:text-base">
                                            • {task.title} <span className="text-gray-500 print:text-sm">(ID: {task.id})</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Tareas como Supervisor */}
                                  {supervisorTasks.length > 0 && (
                                    <div className="mb-4 print:mb-5">
                                      <div className="font-medium text-base mb-2 print:text-lg print:mb-3">Tareas como Supervisor:</div>
                                      <div className="space-y-1 ml-4 print:space-y-2">
                                        {supervisorTasks.map((task, idx) => (
                                          <div key={idx} className="text-sm text-gray-700 print:text-base">
                                            • {task.title} <span className="text-gray-500 print:text-sm">(ID: {task.id})</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Columna derecha: Firma */}
                                <div className="w-48 print:w-56 flex-shrink-0">
                                  <div className="font-medium text-sm mb-2 print:text-base print:mb-3 text-center">Firma:</div>
                                  {signature ? (
                                    <div className="mt-2 print:mt-3">
                                      <img 
                                        src={signature} 
                                        alt={`Firma ${personName}`} 
                                        className="w-full h-24 object-contain border-2 border-gray-400 bg-white print:h-28" 
                                      />
                                    </div>
                                  ) : (
                                    <div className="mt-2 print:mt-3">
                                      <div className="border-b-2 border-gray-600 h-20 mb-2 print:h-24 print:mb-3"></div>
                                      <div className="text-xs text-gray-500 text-center print:text-sm">Firma</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      // Si no hay personas, mostrar al menos una línea para firmar
                      <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                        <div className="font-semibold text-lg mb-4">Responsable</div>
                        <div className="mt-4 pt-4 border-t border-gray-300">
                          <div className="font-medium mb-2">Firma:</div>
                          <div className="mt-2">
                            <div className="border-b-2 border-gray-600 h-20 mb-2"></div>
                            <div className="text-xs text-gray-500 text-center">Firma</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
