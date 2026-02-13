'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Calendar,
  DollarSign,
  ChevronRight,
  Building2,
  Layers,
  CheckCircle,
  Download,
  FileText,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UnionCategory {
  id: number;
  unionId: number;
  name: string;
  code: string | null;
  description: string | null;
  level: number;
  isActive: boolean;
  employeeCount: number;
  currentRate?: {
    dailyRate: number;
    hourlyRate: number | null;
    presenteeismRate: number | null;
    effectiveFrom: string;
  } | null;
}

interface PayrollUnion {
  id: number;
  name: string;
  code: string | null;
  conventionCode: string | null;
  paymentScheduleType: string;
  isActive: boolean;
  categoryCount: number;
  employeeCount: number;
  categories?: UnionCategory[];
}

interface GremioTemplate {
  id: number;
  code: string;
  name: string;
  fullName: string | null;
  conventionCode: string | null;
  paymentScheduleType: string;
  description: string | null;
  categoryCount: number;
  isEnabled: boolean;
}

const PAYMENT_SCHEDULE_OPTIONS = [
  { value: 'BIWEEKLY_FIXED', label: 'Quincenal (dias 15 y ultimo)' },
  { value: 'BIWEEKLY_1_15_16_EOM', label: 'Quincenal (1-15 y 16-fin)' },
  { value: 'MONTHLY_SAME_MONTH', label: 'Mensual (mismo mes)' },
  { value: 'MONTHLY_NEXT_MONTH', label: 'Mensual (mes siguiente)' },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(value);
}

function getScheduleLabel(type: string): string {
  return PAYMENT_SCHEDULE_OPTIONS.find(o => o.value === type)?.label || type;
}

export default function GremiosPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<UnionCategory | null>(null);
  const [selectedUnionId, setSelectedUnionId] = useState<number | null>(null);

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    code: '',
    description: '',
    level: 0,
  });

  // Fetch plantillas disponibles
  const { data: templatesData, isLoading: loadingTemplates } = useQuery<{ templates: GremioTemplate[] }>({
    queryKey: ['gremio-templates'],
    queryFn: async () => {
      const res = await fetch('/api/nominas/gremios/templates');
      if (!res.ok) throw new Error('Error al cargar plantillas');
      return res.json();
    },
  });

  // Fetch gremios habilitados
  const { data: unionsData, isLoading: loadingUnions, error } = useQuery<{ unions: PayrollUnion[] }>({
    queryKey: ['payroll-unions'],
    queryFn: async () => {
      const res = await fetch('/api/nominas/gremios?includeCategories=true');
      if (!res.ok) throw new Error('Error al cargar gremios');
      return res.json();
    },
  });

  // Habilitar gremio mutation
  const enableGremioMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const res = await fetch('/api/nominas/gremios/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al habilitar gremio');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-unions'] });
      queryClient.invalidateQueries({ queryKey: ['gremio-templates'] });
      toast.success(data.message);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete union mutation
  const deleteUnionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/nominas/gremios?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al eliminar');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-unions'] });
      queryClient.invalidateQueries({ queryKey: ['gremio-templates'] });
      toast.success('Gremio eliminado');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Create/Update category mutation
  const saveCategoryMutation = useMutation({
    mutationFn: async (data: typeof categoryFormData & { unionId: number; categoryId?: number }) => {
      const method = data.categoryId ? 'PUT' : 'POST';
      const res = await fetch(`/api/nominas/gremios/${data.unionId}/categorias`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al guardar');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-unions'] });
      toast.success(editingCategory ? 'Categoria actualizada' : 'Categoria creada');
      handleCloseCategoryDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async ({ unionId, categoryId }: { unionId: number; categoryId: number }) => {
      const res = await fetch(`/api/nominas/gremios/${unionId}/categorias?categoryId=${categoryId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al eliminar');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-unions'] });
      toast.success('Categoria eliminada');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleOpenCategoryDialog = (unionId: number, category?: UnionCategory) => {
    setSelectedUnionId(unionId);
    if (category) {
      setEditingCategory(category);
      setCategoryFormData({
        name: category.name,
        code: category.code || '',
        description: category.description || '',
        level: category.level,
      });
    } else {
      setEditingCategory(null);
      setCategoryFormData({ name: '', code: '', description: '', level: 0 });
    }
    setIsCategoryDialogOpen(true);
  };

  const handleCloseCategoryDialog = () => {
    setIsCategoryDialogOpen(false);
    setEditingCategory(null);
    setSelectedUnionId(null);
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnionId) return;
    saveCategoryMutation.mutate({
      ...categoryFormData,
      unionId: selectedUnionId,
      categoryId: editingCategory?.id,
    });
  };

  const isLoading = loadingTemplates || loadingUnions;
  const templates = templatesData?.templates || [];
  const unions = unionsData?.unions || [];
  const availableTemplates = templates.filter(t => !t.isEnabled);
  const enabledTemplates = templates.filter(t => t.isEnabled);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">Error al cargar los gremios</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border">
        <div className="px-4 md:px-6 py-3">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            Gremios y Categorias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Habilita los gremios de tu empresa y gestiona sus categorias salariales
          </p>
        </div>
      </div>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <form onSubmit={handleCategorySubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? 'Editar Categoria' : 'Nueva Categoria'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="catName">Nombre *</Label>
                <Input
                  id="catName"
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  placeholder="Ej: OFICIAL"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="catCode">Codigo</Label>
                  <Input
                    id="catCode"
                    value={categoryFormData.code}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, code: e.target.value })}
                    placeholder="Ej: OF"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="catLevel">Nivel</Label>
                  <Input
                    id="catLevel"
                    type="number"
                    value={categoryFormData.level}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, level: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="catDescription">Descripcion</Label>
                <Input
                  id="catDescription"
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  placeholder="Descripcion opcional..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseCategoryDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveCategoryMutation.isPending}>
                {saveCategoryMutation.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Content */}
      <div className="px-4 md:px-6 pb-6">
        <Tabs defaultValue={unions.length > 0 ? "habilitados" : "disponibles"} className="space-y-6">
          <TabsList>
            <TabsTrigger value="habilitados" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Mis Gremios ({unions.length})
            </TabsTrigger>
            <TabsTrigger value="disponibles" className="gap-2">
              <Download className="h-4 w-4" />
              Disponibles ({availableTemplates.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab: Gremios Habilitados */}
          <TabsContent value="habilitados" className="space-y-4">
            {unions.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">Sin gremios habilitados</h3>
                  <p className="text-muted-foreground mb-4">
                    Ve a la pestana "Disponibles" para habilitar los gremios que usa tu empresa
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Accordion type="multiple" className="space-y-4">
                {unions.map((union) => (
                  <AccordionItem key={union.id} value={`union-${union.id}`} className="border rounded-lg">
                    <Card className="border-0 shadow-none">
                      <CardContent className="p-0">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline [&[data-state=open]>div>.chevron]:rotate-90">
                          <div className="flex items-start justify-between w-full pr-4">
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center gap-3 mb-1">
                                <h3 className="text-lg font-semibold">{union.name}</h3>
                                {union.code && (
                                  <Badge variant="outline">{union.code}</Badge>
                                )}
                                {union.conventionCode && (
                                  <Badge variant="secondary">CCT {union.conventionCode}</Badge>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {getScheduleLabel(union.paymentScheduleType)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Layers className="h-3.5 w-3.5" />
                                  {union.categoryCount} categorias
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3.5 w-3.5" />
                                  {union.employeeCount} empleados
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (union.employeeCount > 0) {
                                    toast.error('No se puede eliminar un gremio con empleados');
                                    return;
                                  }
                                  if (confirm('Eliminar este gremio y todas sus categorias?')) {
                                    deleteUnionMutation.mutate(union.id);
                                  }
                                }}
                                disabled={union.employeeCount > 0}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <ChevronRight className="h-4 w-4 text-muted-foreground chevron transition-transform" />
                            </div>
                          </div>
                        </AccordionTrigger>

                        <AccordionContent className="px-4 pb-4">
                          <div className="border-t pt-4 mt-2">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-medium text-muted-foreground">
                                Categorias del Gremio
                              </h4>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenCategoryDialog(union.id)}
                              >
                                <Plus className="mr-1 h-3 w-3" />
                                Nueva Categoria
                              </Button>
                            </div>

                            {union.categories && union.categories.length > 0 ? (
                              <div className="space-y-2">
                                {union.categories.map((cat) => (
                                  <div
                                    key={cat.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{cat.name}</span>
                                        {cat.code && (
                                          <Badge variant="outline" className="text-xs">
                                            {cat.code}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                        <span>{cat.employeeCount} empleados</span>
                                        {cat.description && (
                                          <span className="truncate max-w-[200px]">{cat.description}</span>
                                        )}
                                        {cat.currentRate && (
                                          <span className="flex items-center gap-1">
                                            <DollarSign className="h-3 w-3" />
                                            {formatCurrency(cat.currentRate.dailyRate)}/dia
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => router.push(`/administracion/nominas/gremios/${union.id}/categorias/${cat.id}/tasas`)}
                                      >
                                        <DollarSign className="h-3.5 w-3.5 mr-1" />
                                        Tasas
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleOpenCategoryDialog(union.id, cat)}
                                      >
                                        <Edit className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => {
                                          if (cat.employeeCount > 0) {
                                            toast.error('No se puede eliminar una categoria con empleados');
                                            return;
                                          }
                                          if (confirm('Eliminar esta categoria?')) {
                                            deleteCategoryMutation.mutate({
                                              unionId: union.id,
                                              categoryId: cat.id,
                                            });
                                          }
                                        }}
                                        disabled={cat.employeeCount > 0}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-6 text-sm text-muted-foreground">
                                Sin categorias. Crea la primera categoria para este gremio.
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </CardContent>
                    </Card>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>

          {/* Tab: Gremios Disponibles */}
          <TabsContent value="disponibles" className="space-y-4">
            {availableTemplates.length === 0 && enabledTemplates.length > 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <h3 className="text-lg font-medium mb-2">Todos los gremios habilitados</h3>
                  <p className="text-muted-foreground">
                    Ya tienes todos los gremios disponibles habilitados para tu empresa
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => (
                  <Card key={template.id} className={template.isEnabled ? 'opacity-60' : ''}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {template.name}
                            {template.isEnabled && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </CardTitle>
                          {template.conventionCode && (
                            <Badge variant="secondary" className="mt-1">
                              {template.conventionCode}
                            </Badge>
                          )}
                        </div>
                        <Badge variant="outline">
                          {template.categoryCount} cat.
                        </Badge>
                      </div>
                      {template.fullName && (
                        <CardDescription className="text-xs mt-2">
                          {template.fullName}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {getScheduleLabel(template.paymentScheduleType)}
                        </div>
                        {template.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {template.description}
                          </p>
                        )}
                        <Button
                          className="w-full"
                          variant={template.isEnabled ? "outline" : "default"}
                          disabled={template.isEnabled || enableGremioMutation.isPending}
                          onClick={() => enableGremioMutation.mutate(template.id)}
                        >
                          {template.isEnabled ? (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Habilitado
                            </>
                          ) : enableGremioMutation.isPending ? (
                            'Habilitando...'
                          ) : (
                            <>
                              <Download className="mr-2 h-4 w-4" />
                              Habilitar Gremio
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Info box */}
            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
              <CardContent className="py-4">
                <div className="flex gap-3">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      Gremios con categorias pre-cargadas
                    </p>
                    <p className="text-blue-700 dark:text-blue-300 mt-1">
                      Al habilitar un gremio, se crean automaticamente todas sus categorias segun el convenio colectivo.
                      Luego podras agregar categorias personalizadas o cargar las tasas de cada categoria.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
