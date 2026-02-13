'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { 
  Package, 
  Plus,
  Search,
  CheckCircle2,
  X,
  AlertTriangle,
  Clock,
  Send
} from 'lucide-react';

interface ToolRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  plantStopId?: string;
}

interface ToolRequest {
  toolId: string;
  toolName: string;
  quantity: number;
  reason: string;
}

export default function ToolRequestDialog({ isOpen, onClose, plantStopId }: ToolRequestDialogProps) {
  const { currentSector, currentCompany } = useCompany();
  const { user } = useAuth();
  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const [toolsPopoverOpen, setToolsPopoverOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [requestForm, setRequestForm] = useState({
    toolName: '',
    quantity: 1,
    reason: '',
    urgency: 'alta' as 'baja' | 'media' | 'alta' | 'critica'
  });

  const [toolRequests, setToolRequests] = useState<ToolRequest[]>([]);

  useEffect(() => {
    if (isOpen && currentCompany) {
      fetchAvailableTools();
    }
  }, [isOpen, currentCompany]);

  const fetchAvailableTools = async (search?: string) => {
    try {
      const response = await fetch(`/api/tools?companyId=${currentCompany?.id}&search=${search || ''}&status=AVAILABLE`);
      if (response.ok) {
        const data = await response.json();
        setAvailableTools(data.tools || []);
      }
    } catch (error) {
      console.error('Error fetching tools:', error);
      setAvailableTools([]);
    }
  };

  const handleAddToolRequest = () => {
    if (!requestForm.toolName.trim()) {
      toast.error('Por favor ingresa el nombre de la herramienta');
      return;
    }

    if (requestForm.quantity < 1) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    if (!requestForm.reason.trim()) {
      toast.error('Por favor especifica para qué necesitas la herramienta');
      return;
    }

    const newRequest: ToolRequest = {
      toolId: selectedTool?.id || `manual-${Date.now()}`,
      toolName: requestForm.toolName,
      quantity: requestForm.quantity,
      reason: requestForm.reason
    };

    setToolRequests(prev => [...prev, newRequest]);
    
    // Reset form
    setRequestForm({
      toolName: '',
      quantity: 1,
      reason: '',
      urgency: 'alta'
    });
    setSelectedTool(null);
    setSearchTerm('');
    setToolsPopoverOpen(false);

    toast.success(`${requestForm.toolName} agregado a la solicitud`);
  };

  const handleRemoveToolRequest = (index: number) => {
    setToolRequests(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitRequests = async () => {
    if (toolRequests.length === 0) {
      toast.error('Debes agregar al menos una herramienta para enviar la solicitud');
      return;
    }

    setIsLoading(true);
    try {
      // Enviar cada herramienta como solicitud individual al pañolero
      const promises = toolRequests.map(async (toolRequest) => {
        const response = await fetch('/api/tool-requests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            toolName: toolRequest.toolName,
            quantity: toolRequest.quantity,
            requestedById: user?.id,
            requestedByName: user?.name,
            companyId: currentCompany?.id,
            reason: toolRequest.reason,
            urgency: requestForm.urgency,
            plantStopId: plantStopId,
            sectorName: currentSector?.name || 'Planta',
            machineName: 'Parada de Planta'
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Error con ${toolRequest.toolName}: ${errorData.error}`);
        }

        return response.json();
      });

      const results = await Promise.all(promises);
      
      toast.success(`${toolRequests.length} solicitudes enviadas al pañolero exitosamente`);
      
      // Reset form
      setToolRequests([]);
      setRequestForm({
        toolName: '',
        quantity: 1,
        reason: '',
        urgency: 'alta'
      });
      
      onClose();

    } catch (error) {
      console.error('❌ Error en solicitud de herramientas:', error);
      toast.error('Error al enviar las solicitudes: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToolSelect = (tool: any) => {
    setSelectedTool(tool);
    setRequestForm(prev => ({ ...prev, toolName: tool.name }));
    setToolsPopoverOpen(false);
  };

  const urgencyOptions = [
    { id: 'baja', name: 'Baja', color: 'bg-gray-100 text-gray-700', description: 'Puede esperar' },
    { id: 'media', name: 'Media', color: 'bg-blue-100 text-blue-700', description: 'Necesario pronto' },
    { id: 'alta', name: 'Alta', color: 'bg-orange-100 text-orange-700', description: 'Urgente' },
    { id: 'critica', name: 'Crítica', color: 'bg-red-100 text-red-700', description: 'Inmediato' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-600" />
            Solicitar Productos - {currentSector?.name}
          </DialogTitle>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-muted-foreground">
                Planta en parada - Solicitud prioritaria al pañolero
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" />
              <span className="text-blue-600 font-medium">
                Registro obligatorio: Las herramientas solicitadas se guardarán en el historial de reparación
              </span>
            </div>
          </div>
        </DialogHeader>

        <DialogBody>
        <div className="space-y-6">
          {/* Alert de planta parada */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                              <span className="font-semibold text-red-800">Parada de Planta Activa</span>
            </div>
            <p className="text-red-700 text-sm">
              Las solicitudes de herramientas durante paradas de planta tienen máxima prioridad y se notificarán inmediatamente al pañolero.
            </p>
            <p className="text-red-600 text-sm font-medium mt-2">
                              Debes solicitar al menos una herramienta para registrar en el historial de la reparación.
            </p>
          </div>

          {/* Formulario para agregar herramientas */}
          <Card className="border-2 border-dashed border-blue-200">
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Agregar Herramienta
              </h3>

              <div className="space-y-4">
                {/* Búsqueda de herramienta */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Herramienta Necesaria *
                  </label>
                  <Popover open={toolsPopoverOpen} onOpenChange={setToolsPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <Search className="mr-2 h-4 w-4" />
                        {requestForm.toolName || "Buscar producto en el pañol..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0">
                      <Command>
                        <CommandInput 
                          placeholder="Buscar productos en pañol..." 
                          value={searchTerm}
                          onValueChange={(search) => {
                            setSearchTerm(search);
                            fetchAvailableTools(search);
                          }}
                        />
                        <CommandList>
                          <CommandEmpty>
                            <div className="text-center p-4">
                              <p className="text-sm text-muted-foreground mb-2">
                                No se encontró esta herramienta en el pañol
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Solo se pueden solicitar productos registrados en el sistema
                              </p>
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {availableTools.map((tool) => (
                              <CommandItem
                                key={tool.id}
                                onSelect={() => handleToolSelect(tool)}
                                className="cursor-pointer"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <div>
                                    <span className="font-medium">{tool.name}</span>
                                    <p className="text-xs text-muted-foreground">
                                      Stock: {tool.currentStock} • {tool.location}
                                    </p>
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Cantidad y motivo */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Cantidad *
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={requestForm.quantity}
                      onChange={(e) => setRequestForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">
                      ¿Para qué la necesitas? *
                    </label>
                    <Input
                      placeholder="Ej: Reparar motor, cambiar correa, medir voltaje..."
                      value={requestForm.reason}
                      onChange={(e) => setRequestForm(prev => ({ ...prev, reason: e.target.value }))}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleAddToolRequest}
                  className="w-full"
                  variant="outline"
                  disabled={!requestForm.toolName.trim() || !requestForm.reason.trim() || requestForm.quantity < 1}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {!requestForm.toolName.trim() || !requestForm.reason.trim() || requestForm.quantity < 1
                    ? 'Completa todos los campos'
                    : 'Agregar a la Solicitud'
                  }
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista de herramientas solicitadas */}
          {toolRequests.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Package className="h-5 w-5" />
                Herramientas a Solicitar ({toolRequests.length})
              </h3>
              
              <div className="space-y-3">
                {toolRequests.map((request, index) => (
                  <Card key={index} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{request.toolName}</h4>
                            <Badge variant="secondary">
                              Cantidad: {request.quantity}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Motivo:</span> {request.reason}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveToolRequest(index)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Prioridad de la solicitud */}
              <div className="mt-6">
                <label className="block text-sm font-medium mb-2">
                  Prioridad de la Solicitud
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {urgencyOptions.map((urgency) => (
                    <Card 
                      key={urgency.id}
                      className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                        requestForm.urgency === urgency.id 
                          ? 'ring-2 ring-blue-500 shadow-lg' 
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => setRequestForm(prev => ({ ...prev, urgency: urgency.id as any }))}
                    >
                      <CardContent className="p-3 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${urgency.color}`}>
                          {urgency.name}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {urgency.description}
                        </p>
                        {requestForm.urgency === urgency.id && (
                          <CheckCircle2 className="h-4 w-4 text-blue-600 mx-auto mt-2" />
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mensaje cuando no hay herramientas agregadas */}
          {toolRequests.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-800 text-sm">
                    No has agregado ninguna herramienta
                  </p>
                  <p className="text-amber-700 text-sm">
                    Agrega al menos una herramienta usando el formulario de arriba para poder enviar la solicitud al pañolero.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>

          <Button
            size="sm"
            onClick={handleSubmitRequests}
            disabled={toolRequests.length === 0 || isLoading}
            className={`${
              toolRequests.length === 0
                ? 'bg-gray-400 cursor-not-allowed text-white opacity-50'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Enviando Solicitud...
              </>
            ) : toolRequests.length === 0 ? (
              <>
                <Package className="h-4 w-4 mr-2" />
                Agrega Herramientas Primero
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar Solicitud al Pañolero ({toolRequests.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 