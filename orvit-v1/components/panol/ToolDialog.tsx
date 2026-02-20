'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Package,
  Edit,
  Save,
  X,
  Calendar,
  DollarSign,
  MapPin,
  FileText,
  Building,
  Hash,
  Tag,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useCompany } from '@/contexts/CompanyContext';
import CreatableSelect from '@/components/panol/CreatableSelect';

interface Tool {
  id?: number;
  name: string;
  description: string | null;
  itemType: 'TOOL' | 'SUPPLY';
  category: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  stockQuantity: number;
  minStockLevel: number;
  location: string | null;
  status: string;
  cost: number | null;
  supplier: string | null;
  acquisitionDate: string | null;
  notes: string | null;
}

interface ToolDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tool?: Tool | null;
  mode: 'view' | 'edit' | 'create';
  onSave?: (tool: Tool) => void;
}

export default function ToolDialog({ isOpen, onClose, tool, mode, onSave }: ToolDialogProps) {
  const { currentCompany, currentSector } = useCompany();
  const [formData, setFormData] = useState<Tool>({
    name: '',
    description: '',
    itemType: 'TOOL',
    category: '',
    brand: '',
    model: '',
    serialNumber: '',
    stockQuantity: 0,
    minStockLevel: 5,
    location: '',
    status: 'AVAILABLE',
    cost: 0,
    supplier: '',
    acquisitionDate: new Date().toISOString().split('T')[0],
    notes: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [selectedMachines, setSelectedMachines] = useState<number[]>([]);
  const [machineSearchTerm, setMachineSearchTerm] = useState('');
  const [componentUsage, setComponentUsage] = useState<any[]>([]);
  const [isLoadingComponents, setIsLoadingComponents] = useState(false);

  useEffect(() => {
    if (isOpen && currentCompany) {
      fetchCategories();
      fetchLocations();
      fetchSuppliers();
      fetchMachines();
      if (tool && (mode === 'view' || mode === 'edit')) {
        setFormData({
          ...tool,
          description: tool.description || '',
          brand: tool.brand || '',
          model: tool.model || '',
          serialNumber: tool.serialNumber || '',
          location: tool.location || '',
          supplier: tool.supplier || '',
          notes: tool.notes || '',
          cost: tool.cost || 0,
          acquisitionDate: tool.acquisitionDate ? tool.acquisitionDate.split('T')[0] : new Date().toISOString().split('T')[0]
        });
        // TODO: Cargar máquinas asociadas cuando tengamos la API
        setSelectedMachines([]);

      } else if (mode === 'create') {
        setFormData({
          name: '',
          description: '',
          itemType: 'TOOL',
          category: '',
          brand: '',
          model: '',
          serialNumber: '',
          stockQuantity: 0,
          minStockLevel: 5,
          location: '',
          status: 'AVAILABLE',
          cost: 0,
          supplier: '',
          acquisitionDate: new Date().toISOString().split('T')[0],
          notes: ''
        });
        setSelectedMachines([]);
        setComponentUsage([]);
      }
    }
  }, [isOpen, tool, mode, currentCompany?.id]);

  const fetchCategories = useCallback(async () => {
    if (!currentCompany) return;
    
    try {
      const response = await fetch(`/api/tools/categories?companyId=${currentCompany.id}`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, [currentCompany?.id]);

  const fetchLocations = useCallback(async () => {
    if (!currentCompany) return;
    
    try {
      const response = await fetch(`/api/tools/locations?companyId=${currentCompany.id}`);
      if (response.ok) {
        const data = await response.json();
        setLocations(data.locations || []);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  }, [currentCompany?.id]);

  const fetchSuppliers = useCallback(async () => {
    if (!currentCompany) return;
    
    try {
      const response = await fetch(`/api/tools/suppliers?companyId=${currentCompany.id}`);
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  }, [currentCompany?.id]);

  const fetchMachines = useCallback(async () => {
    if (!currentCompany) return;
    
    try {
      const response = await fetch(`/api/maquinas?companyId=${currentCompany.id}`);
      if (response.ok) {
        const data = await response.json();
        setMachines(data || []);
      }
    } catch (error) {
      console.error('Error fetching machines:', error);
    }
  }, [currentCompany?.id]);

  const fetchComponentUsage = useCallback(async () => {
    if (!currentCompany || !tool?.id || formData.itemType !== 'SUPPLY') return;
    
    setIsLoadingComponents(true);
    try {
      const response = await fetch(`/api/tools/${tool.id}/component-usage?companyId=${currentCompany.id}`);
      if (response.ok) {
        const data = await response.json();
        setComponentUsage(data.usage || []);
      } else {
        setComponentUsage([]);
      }
    } catch (error) {
      console.error('Error fetching component usage:', error);
      setComponentUsage([]);
    } finally {
      setIsLoadingComponents(false);
    }
     }, [currentCompany?.id, tool?.id, formData.itemType]);

  // UseEffect separado para cargar componentes cuando sea un repuesto
  useEffect(() => {
    if (isOpen && tool && tool.itemType === 'SUPPLY' && (mode === 'view' || mode === 'edit')) {
      fetchComponentUsage();
    }
  }, [isOpen, tool?.id, tool?.itemType, mode, fetchComponentUsage]);

  const handleSave = async () => {
    if (!currentCompany) {
      toast.error('Selecciona una empresa primero');
      return;
    }

    if (!formData.name || !formData.category) {
      toast.error('Nombre y categoría son requeridos');
      return;
    }

    setIsLoading(true);
    try {
      let response;
      
      if (mode === 'create') {
        const requestData = {
          ...formData,
          companyId: currentCompany.id,
          sectorId: currentSector?.id || null
        };
        
        response = await fetch('/api/tools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        });
      } else if (mode === 'edit' && tool?.id) {
        response = await fetch(`/api/tools/${tool.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }

      if (response && response.ok) {
        const data = await response.json();
        toast.success(data.message || 'Operación exitosa');
        onSave?.(data.tool);
        onClose();
        // Recargar componentes si es un repuesto editado
        if (formData.itemType === 'SUPPLY' && mode === 'edit') {
          fetchComponentUsage();
        }
      } else {
        const errorData = await response?.json().catch(() => null);
        throw new Error(errorData?.error || 'Error en la operación');
      }
    } catch (error) {
      toast.error('Error al guardar la herramienta: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-success-muted text-success';
      case 'IN_USE':
        return 'bg-info-muted text-info-muted-foreground';
      case 'MAINTENANCE':
        return 'bg-warning-muted text-warning-muted-foreground';
      case 'DAMAGED':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'Disponible';
      case 'IN_USE':
        return 'En Uso';
      case 'MAINTENANCE':
        return 'Mantenimiento';
      case 'DAMAGED':
        return 'Dañado';
      default:
        return status;
    }
  };

  const isReadonly = mode === 'view';
  const title = mode === 'create' ? 'Nuevo Producto' : 
                mode === 'edit' ? 'Editar Producto' : 
                'Detalles de Producto';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Package className="h-6 w-6 text-info-muted-foreground" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Información Básica */}
          <div className="space-y-4">
            <div className="bg-card p-4 rounded-lg border shadow-sm">
              <h3 className="font-semibold text-info-muted-foreground mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Información Básica
              </h3>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Martillo de Bola 16oz"
                    disabled={isReadonly}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isReadonly) {
                        e.preventDefault();
                        e.stopPropagation();
                        // Buscar el siguiente elemento focusable
                        const currentElement = e.target as HTMLElement;
                        const focusableElements = Array.from(document.querySelectorAll('input, button, select, textarea, [tabindex]:not([tabindex="-1"])'));
                        const currentIndex = focusableElements.indexOf(currentElement);
                        const nextElement = focusableElements[currentIndex + 1] as HTMLElement;
                        
                        if (nextElement) {
                          nextElement.focus();
                        }
                      }
                    }}
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descripción detallada del producto"
                    disabled={isReadonly}
                    rows={3}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !isReadonly) {
                        e.preventDefault();
                        e.stopPropagation();
                        // Buscar el siguiente elemento focusable
                        const currentElement = e.target as HTMLElement;
                        const focusableElements = Array.from(document.querySelectorAll('input, button, select, textarea, [tabindex]:not([tabindex="-1"])'));
                        const currentIndex = focusableElements.indexOf(currentElement);
                        const nextElement = focusableElements[currentIndex + 1] as HTMLElement;
                        
                        if (nextElement) {
                          nextElement.focus();
                        }
                      }
                    }}
                  />
                </div>

                <div>
                  <Label htmlFor="itemType">Tipo de Producto *</Label>
                  {isReadonly ? (
                    <div className="mt-1">
                      <Badge className={formData.itemType === 'TOOL' ? 'bg-info-muted text-info-muted-foreground' : 'bg-purple-100 text-purple-800'}>
                        {formData.itemType === 'TOOL' ? 'Herramienta' : 'Repuesto/Material'}
                      </Badge>
                    </div>
                  ) : (
                    <Select 
                      value={formData.itemType} 
                      onValueChange={(value: 'TOOL' | 'SUPPLY') => setFormData(prev => ({ ...prev, itemType: value }))}
                    >
                      <SelectTrigger
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isReadonly) {
                            e.preventDefault();
                            e.stopPropagation();
                            // Buscar el siguiente elemento focusable
                            const currentElement = e.target as HTMLElement;
                            const focusableElements = Array.from(document.querySelectorAll('input, button, select, textarea, [tabindex]:not([tabindex="-1"])'));
                            const currentIndex = focusableElements.indexOf(currentElement);
                            const nextElement = focusableElements[currentIndex + 1] as HTMLElement;
                            
                            if (nextElement) {
                              nextElement.focus();
                            }
                          }
                        }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TOOL">
                          <div className="flex items-center gap-2">
          
                            <div>
                              <div className="font-medium">Herramienta</div>
                              <div className="text-xs text-muted-foreground">Se presta y devuelve</div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="SUPPLY">
                          <div className="flex items-center gap-2">
          
                            <div>
                              <div className="font-medium">Repuesto/Material</div>
                              <div className="text-xs text-muted-foreground">Se consume en máquinas</div>
                            </div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  <Label htmlFor="category">Categoría *</Label>
                  {isReadonly ? (
                    <Input value={formData.category} disabled />
                  ) : (
                    <CreatableSelect
                      value={formData.category}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                      options={categories}
                      onRefresh={fetchCategories}
                      placeholder="Selecciona una categoría"
                      createLabel="Nueva Categoría"
                      apiEndpoint="/api/tools/categories"
                      createFields={[
                        { name: 'name', label: 'Nombre', required: true },
                        { name: 'description', label: 'Descripción', required: false }
                      ]}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Información del Fabricante */}
            <div className="bg-card p-4 rounded-lg border shadow-sm">
              <h3 className="font-semibold text-success mb-3 flex items-center gap-2">
                <Building className="h-4 w-4" />
                Fabricante
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="brand">Marca</Label>
                  <Input
                    id="brand"
                    value={formData.brand}
                    onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                    placeholder="Ej: Stanley"
                    disabled={isReadonly}
                  />
                </div>

                <div>
                  <Label htmlFor="model">Modelo</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                    placeholder="Ej: STHT51512"
                    disabled={isReadonly}
                  />
                </div>
              </div>

              <div className="mt-3">
                <Label htmlFor="serialNumber">Número de Serie</Label>
                <Input
                  id="serialNumber"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                  placeholder="Ej: ST-001-2024"
                  disabled={isReadonly}
                />
              </div>
            </div>
          </div>

          {/* Inventario y Estado */}
          <div className="space-y-4">
            <div className="bg-card p-4 rounded-lg border shadow-sm">
              <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Inventario
              </h3>
              
              {formData.itemType && (
                <div className="mb-3 p-2 bg-purple-100 dark:bg-purple-800/30 rounded text-xs text-purple-800 dark:text-purple-200">
                  {formData.itemType === 'TOOL' 
                                    ? 'Herramientas: Se prestan temporalmente y se devuelven al pañol'
                : 'Repuestos/Materiales: Se consumen en las máquinas y agotan el stock'
                  }
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="stockQuantity">Stock Actual</Label>
                  <Input
                    id="stockQuantity"
                    type="number"
                    value={formData.stockQuantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, stockQuantity: parseInt(e.target.value) || 0 }))}
                    min="0"
                    disabled={isReadonly}
                  />
                </div>

                <div>
                  <Label htmlFor="minStockLevel">Stock Mínimo</Label>
                  <Input
                    id="minStockLevel"
                    type="number"
                    value={formData.minStockLevel}
                    onChange={(e) => setFormData(prev => ({ ...prev, minStockLevel: parseInt(e.target.value) || 0 }))}
                    min="0"
                    disabled={isReadonly}
                  />
                </div>
              </div>

              <div className="mt-3">
                <Label htmlFor="location">Ubicación</Label>
                {isReadonly ? (
                  <Input value={formData.location} disabled />
                ) : (
                  <CreatableSelect
                    value={formData.location}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, location: value }))}
                    options={locations}
                    onRefresh={fetchLocations}
                    placeholder="Selecciona una ubicación"
                    createLabel="Nueva Ubicación"
                    apiEndpoint="/api/tools/locations"
                    createFields={[
                      { name: 'name', label: 'Nombre', required: true },
                      { name: 'description', label: 'Descripción', required: false }
                    ]}
                  />
                )}
              </div>

              <div className="mt-3">
                <Label htmlFor="status">Estado</Label>
                {isReadonly ? (
                  <div className="mt-1">
                    <Badge className={getStatusColor(formData.status)}>
                      {getStatusText(formData.status)}
                    </Badge>
                  </div>
                ) : (
                  <Select 
                    value={formData.status} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AVAILABLE">Disponible</SelectItem>
                      <SelectItem value="IN_USE">En Uso</SelectItem>
                      <SelectItem value="MAINTENANCE">Mantenimiento</SelectItem>
                      <SelectItem value="DAMAGED">Dañado</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Información Comercial */}
            <div className="bg-card p-4 rounded-lg border shadow-sm">
              <h3 className="font-semibold text-warning-muted-foreground mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Información Comercial
              </h3>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="cost">Costo ($)</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => setFormData(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    disabled={isReadonly}
                  />
                </div>

                <div>
                  <Label htmlFor="supplier">Proveedor</Label>
                  {isReadonly ? (
                    <Input value={formData.supplier} disabled />
                  ) : (
                    <CreatableSelect
                      value={formData.supplier}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, supplier: value }))}
                      options={suppliers}
                      onRefresh={fetchSuppliers}
                      placeholder="Selecciona un proveedor"
                      createLabel="Nuevo Proveedor"
                      apiEndpoint="/api/tools/suppliers"
                      createFields={[
                        { name: 'name', label: 'Nombre', required: true },
                        { name: 'contact', label: 'Contacto', required: false },
                        { name: 'phone', label: 'Teléfono', type: 'tel', required: false },
                        { name: 'email', label: 'Email', type: 'email', required: false }
                      ]}
                    />
                  )}
                </div>

                <div>
                  <Label htmlFor="acquisitionDate">Fecha de Adquisición</Label>
                  <DatePicker
                    value={formData.acquisitionDate || ''}
                    onChange={(date) => setFormData(prev => ({ ...prev, acquisitionDate: date }))}
                    placeholder="Selecciona una fecha"
                    disabled={isReadonly}
                  />
                </div>
              </div>
            </div>



            {/* Notas */}
            <div className="bg-card p-4 rounded-lg border shadow-sm">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notas Adicionales
              </h3>
              
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas adicionales sobre la herramienta..."
                disabled={isReadonly}
                rows={4}
              />
            </div>
          </div>
        </div>

        {/* Componentes y Máquinas que usan este repuesto */}
        {formData.itemType === 'SUPPLY' && (
          <div className="bg-card p-6 rounded-lg border shadow-sm mt-6">
            <h3 className="font-semibold text-warning-muted-foreground mb-4 flex items-center gap-2 text-lg">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              Componentes que utilizan este repuesto
            </h3>
            
            <div className="mb-4 p-3 bg-warning-muted rounded text-sm text-warning-muted-foreground">
                              Aquí se muestran los componentes de máquinas que requieren este repuesto para mantenimiento o reemplazo
            </div>

            {isLoadingComponents ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-warning-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Cargando componentes...</p>
              </div>
            ) : componentUsage.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">

                <p className="mt-2 text-lg font-medium">Este repuesto aún no está vinculado a ningún componente</p>
                <p className="text-sm mt-1">Los componentes que requieren este repuesto aparecerán aquí automáticamente</p>
                <Button variant="outline" className="mt-4" onClick={() => window.open('/maquinas', '_blank')}>
                  Ir a Máquinas para configurar componentes
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Estadísticas rápidas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-info-muted p-4 rounded-lg border border-info-muted">
                    <div className="text-2xl font-bold text-info-muted-foreground">{componentUsage.length}</div>
                    <div className="text-sm text-info-muted-foreground">Máquinas afectadas</div>
                  </div>
                  <div className="bg-success-muted p-4 rounded-lg border border-success-muted">
                    <div className="text-2xl font-bold text-success">
                      {componentUsage.reduce((total, usage) => total + usage.components.length, 0)}
                    </div>
                    <div className="text-sm text-success">Componentes totales</div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="text-2xl font-bold text-purple-600">
                      {componentUsage.reduce((total, usage) => 
                        total + usage.components.reduce((sum: number, comp: any) => sum + (comp.quantityNeeded || 1), 0), 0
                      )}
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-300">Unidades necesarias</div>
                  </div>
                </div>

                {/* Lista de máquinas y sus componentes */}
                <div className="space-y-4">
                  {componentUsage.map((usage, index) => (
                    <div key={usage.machine.id} className="bg-background rounded-lg border border-border overflow-hidden">
                      {/* Header de la máquina */}
                      <div className="bg-background p-4 border-b border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-info rounded-lg flex items-center justify-center text-white font-bold">
                              🏭
                            </div>
                            <div>
                              <h4 className="font-semibold text-lg text-foreground">
                                {usage.machine.name}
                              </h4>
                              {usage.machine.nickname && (
                                <p className="text-sm text-muted-foreground">
                                  &quot;{usage.machine.nickname}&quot;
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-info-muted-foreground">
                              {usage.components.length}
                            </div>
                            <div className="text-xs text-muted-foreground">componentes</div>
                          </div>
                        </div>
                      </div>

                      {/* Lista de componentes */}
                      <div className="p-4">
                        <div className="space-y-3">
                          {usage.components.map((component: any) => (
                            <div key={component.id} className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
                              <div className="flex items-center gap-3 flex-1">
                                <div className="w-8 h-8 bg-warning-muted rounded-lg flex items-center justify-center">
                  
                                </div>
                                <div className="flex-1">
                                  <h5 className="font-medium text-foreground">
                                    {component.name}
                                  </h5>
                                  {component.technicalInfo && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                      {typeof component.technicalInfo === 'string'
                                        ? component.technicalInfo
                                        : JSON.stringify(component.technicalInfo)}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className="text-lg font-semibold text-purple-600">
                                    {component.quantityNeeded || 1}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {component.quantityNeeded === 1 ? 'unidad' : 'unidades'}
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(`/maquinas/${usage.machine.id}`, '_blank')}
                                  className="text-info-muted-foreground hover:text-info-muted-foreground border-info-muted hover:border-info-muted"
                                >
                                  <span className="mr-1">🔗</span>
                                  Ver en máquina
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        </DialogBody>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {isReadonly ? 'Cerrar' : 'Cancelar'}
          </Button>

          {!isReadonly && (
            <Button size="sm" onClick={handleSave} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {mode === 'create' ? 'Crear Herramienta' : 'Guardar Cambios'}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 