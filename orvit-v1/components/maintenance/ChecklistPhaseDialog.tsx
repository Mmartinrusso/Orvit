import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Square, Plus, Trash2, Clock, FileText, ArrowUp, ArrowDown, Copy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ChecklistPhase {
 id: string;
 name: string;
 description: string;
 order: number;
 estimatedTime: number;
 items: ChecklistItem[];
}

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
 isMaintenanceItem?: boolean;
}

interface ChecklistPhaseDialogProps {
 isOpen: boolean;
 onClose: () => void;
 onSave: (phases: ChecklistPhase[]) => void;
 initialPhases?: ChecklistPhase[];
}

export function ChecklistPhaseDialog({ 
 isOpen, 
 onClose, 
 onSave, 
 initialPhases = [] 
}: ChecklistPhaseDialogProps) {
 const [phases, setPhases] = useState<ChecklistPhase[]>(initialPhases.length > 0 ? initialPhases : [
 {
 id: 'phase_1',
 name: 'Fase 1 - Inicio de Turno',
 description: 'Mantenimientos antes de comenzar producción',
 order: 1,
 estimatedTime: 0,
 items: []
 }
 ]);

 const [availableMaintenances, setAvailableMaintenances] = useState<any[]>([]);
 const [selectedMaintenances, setSelectedMaintenances] = useState<number[]>([]);
 const [activeTab, setActiveTab] = useState<'phases' | 'maintenances'>('phases');

 useEffect(() => {
 if (isOpen) {
 loadAvailableMaintenances();
 }
 }, [isOpen]);

 const loadAvailableMaintenances = async () => {
 try {
 const companyId = localStorage.getItem('companyId');
 const response = await fetch(`/api/maintenance/all?companyId=${companyId}&sectorId=1`);
 
 if (response.ok) {
 const data = await response.json();
 const allMaintenances = data.maintenances || [];
 
 // Filtrar para excluir fallas y mantenimientos correctivos
 const filteredMaintenances = allMaintenances.filter((m: any) => {
 const isFailure = m.notes?.includes('"isFailure":true');
 const isCorrective = m.type === 'CORRECTIVE';
 return !isFailure && !isCorrective;
 });
 
 setAvailableMaintenances(filteredMaintenances);
 }
 } catch (error) {
 console.error('Error loading maintenances:', error);
 }
 };

 const addPhase = () => {
 const newPhase: ChecklistPhase = {
 id: `phase_${Date.now()}`,
 name: `Fase ${phases.length + 1}`,
 description: '',
 order: phases.length + 1,
 estimatedTime: 0,
 items: []
 };
 
 setPhases(prev => [...prev, newPhase]);
 };

 const removePhase = (phaseId: string) => {
 setPhases(prev => prev.filter(phase => phase.id !== phaseId));
 };

 const duplicatePhase = (phase: ChecklistPhase) => {
 const duplicatedPhase: ChecklistPhase = {
 ...phase,
 id: `phase_${Date.now()}`,
 name: `${phase.name} (copia)`,
 order: phases.length + 1,
 items: phase.items.map((item, idx) => ({
 ...item,
 id: `${item.id}_copy_${Date.now()}_${idx}`,
 order: idx
 }))
 };

 setPhases(prev => [...prev, duplicatedPhase]);

 toast({
 title: 'Fase duplicada',
 description: `Se creó una copia de "${phase.name}"`,
 });
 };

 const updatePhase = (phaseId: string, updates: Partial<ChecklistPhase>) => {
 setPhases(prev => prev.map(phase =>
 phase.id === phaseId ? { ...phase, ...updates } : phase
 ));
 };

 const addMaintenanceToPhase = (maintenance: any, phaseId: string) => {
 const maintenanceItem: ChecklistItem = {
 id: `maintenance_${maintenance.id}`,
 title: maintenance.title,
 description: maintenance.description || `Mantenimiento preventivo`,
 isRequired: true,
 order: 0,
 category: 'MAINTENANCE',
 estimatedTime: maintenance.estimatedHours ? Math.round(maintenance.estimatedHours * 60) : 30,
 maintenanceId: maintenance.id,
 maintenanceType: 'PREVENTIVE',
 isMaintenanceItem: true
 };

 setPhases(prev => prev.map(phase => {
 if (phase.id === phaseId) {
 return {
 ...phase,
 items: [...phase.items, { ...maintenanceItem, order: phase.items.length }]
 };
 }
 return phase;
 }));

 setSelectedMaintenances(prev => [...prev, maintenance.id]);
 };

 const removeMaintenanceFromPhase = (maintenanceId: string, phaseId: string) => {
 const numericId = parseInt(maintenanceId.replace('maintenance_', ''));
 
 setPhases(prev => prev.map(phase => {
 if (phase.id === phaseId) {
 return {
 ...phase,
 items: phase.items.filter(item => item.id !== maintenanceId)
 };
 }
 return phase;
 }));

 setSelectedMaintenances(prev => prev.filter(id => id !== numericId));
 };

 const handleSave = () => {
 if (phases.length === 0) {
 toast({
 title: 'Error',
 description: 'Debe crear al menos una fase',
 variant: 'destructive'
 });
 return;
 }

 onSave(phases);
 onClose();
 };

 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent size="lg">
 <DialogHeader>
 <DialogTitle>Configurar Fases del Checklist</DialogTitle>
 </DialogHeader>

 <DialogBody>
 {/* Pestañas */}
 <div className="flex space-x-2 border-b">
 <button
 onClick={() => setActiveTab('phases')}
 className={cn('px-4 py-2', activeTab === 'phases' && 'border-b-2 border-primary')}
 >
 Fases
 </button>
 <button
 onClick={() => setActiveTab('maintenances')}
 className={cn('px-4 py-2', activeTab === 'maintenances' && 'border-b-2 border-primary')}
 >
 Mantenimientos Disponibles
 </button>
 </div>

 {activeTab === 'phases' && (
 <div className="space-y-4">
 {phases.map((phase, index) => (
 <Card key={phase.id}>
 <CardHeader>
 <CardTitle className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <FileText className="h-4 w-4" />
 {phase.name}
 </div>
 <div className="flex items-center gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={() => duplicatePhase(phase)}
 title="Duplicar fase"
 >
 <Copy className="h-4 w-4" />
 </Button>
 <Button
 variant="outline"
 size="sm"
 onClick={() => removePhase(phase.id)}
 disabled={phases.length === 1}
 title="Eliminar fase"
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Nombre de la Fase</Label>
 <Input
 value={phase.name}
 onChange={(e) => updatePhase(phase.id, { name: e.target.value })}
 placeholder="Ej: Fase 1 - Inicio de Turno"
 />
 </div>
 <div className="space-y-2">
 <Label>Descripción</Label>
 <Input
 value={phase.description}
 onChange={(e) => updatePhase(phase.id, { description: e.target.value })}
 placeholder="Descripción de la fase"
 />
 </div>
 </div>

 {/* Elementos de la fase */}
 <div className="space-y-2">
 <Label>Elementos de la Fase ({phase.items.length})</Label>
 {phase.items.length === 0 ? (
 <div className="text-center py-4 text-muted-foreground">
 <p>No hay elementos en esta fase</p>
 <p className="text-sm">Ve a &quot;Mantenimientos Disponibles&quot; para agregar elementos</p>
 </div>
 ) : (
 <div className="space-y-2">
 {phase.items.map((item, itemIndex) => (
 <div key={item.id} className="flex items-center justify-between p-2 border rounded">
 <div className="flex-1">
 <h4 className="font-medium text-sm">{item.title}</h4>
 {item.description && (
 <p className="text-xs text-muted-foreground">{item.description}</p>
 )}
 <div className="flex items-center gap-2 mt-1">
 <Clock className="h-3 w-3" />
 <span className="text-xs text-muted-foreground">{item.estimatedTime} min</span>
 </div>
 </div>
 <Button
 variant="outline"
 size="sm"
 onClick={() => removeMaintenanceFromPhase(item.id, phase.id)}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 ))}
 </div>
 )}
 </div>
 </CardContent>
 </Card>
 ))}

 <Button onClick={addPhase} className="w-full">
 <Plus className="h-4 w-4 mr-2" />
 Agregar Fase
 </Button>
 </div>
 )}

 {activeTab === 'maintenances' && (
 <div className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>Mantenimientos Preventivos Disponibles</CardTitle>
 </CardHeader>
 <CardContent>
 {availableMaintenances.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <p>No hay mantenimientos preventivos disponibles</p>
 </div>
 ) : (
 <div className="grid gap-3">
 {availableMaintenances.map((maintenance) => (
 <div
 key={maintenance.id}
 className={cn('p-3 border rounded-lg cursor-pointer transition-colors', selectedMaintenances.includes(maintenance.id) ? 'border-success bg-success-muted' : 'border-border hover:border-border')}
 onClick={() => {
 if (selectedMaintenances.includes(maintenance.id)) {
 // Deseleccionar
 setSelectedMaintenances(prev => prev.filter(id => id !== maintenance.id));
 // Remover de todas las fases
 setPhases(prev => prev.map(phase => ({
 ...phase,
 items: phase.items.filter(item => item.maintenanceId !== maintenance.id)
 })));
 } else {
 // Seleccionar - agregar a la primera fase
 const firstPhase = phases[0];
 if (firstPhase) {
 addMaintenanceToPhase(maintenance, firstPhase.id);
 }
 }
 }}
 >
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <h4 className="font-medium text-sm">{maintenance.title}</h4>
 
 {/* Máquina */}
 {maintenance.machine && (
 <p className="text-xs text-info-muted-foreground font-medium mt-1">
 Máquina: {maintenance.machine.name}
 </p>
 )}
 
 {/* Descripción completa */}
 {maintenance.description && (
 <p className="text-xs text-muted-foreground mt-1">
 {maintenance.description}
 </p>
 )}
 
 {/* Información de máquina y ubicación */}
 {maintenance.machine && (
 <div className="mt-2">
 {(() => {
 const hasComponents = maintenance.components && maintenance.components.length > 0;
 const hasSubcomponents = maintenance.subcomponents && maintenance.subcomponents.length > 0;
 
 return (
 <div className="text-xs text-foreground">
 {hasComponents && hasSubcomponents && (
 <span className="text-muted-foreground">
 {hasComponents && `${maintenance.components.length} componente${maintenance.components.length > 1 ? 's' : ''}`}
 {hasComponents && hasSubcomponents && ' • '}
 {hasSubcomponents && `${maintenance.subcomponents.length} subcomponente${maintenance.subcomponents.length > 1 ? 's' : ''}`}
 </span>
 )}
 </div>
 );
 })()}
 </div>
 )}
 
 <div className="flex items-center gap-2 mt-2">
 <Badge variant="default">
 Preventivo
 </Badge>
 {maintenance.estimatedHours && (
 <Badge variant="outline">
 {Math.round(maintenance.estimatedHours * 60)} min
 </Badge>
 )}
 </div>
 </div>
 <div className="ml-2">
 {selectedMaintenances.includes(maintenance.id) ? (
 <CheckCircle2 className="h-5 w-5 text-success" />
 ) : (
 <Square className="h-5 w-5 text-muted-foreground" />
 )}
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 </div>
 )}
 </DialogBody>

 <DialogFooter>
 <Button variant="outline" onClick={onClose} size="default">
 Cancelar
 </Button>
 <Button onClick={handleSave} size="default">
 Guardar Fases
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
