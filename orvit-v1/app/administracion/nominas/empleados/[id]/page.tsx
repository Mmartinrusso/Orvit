'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  User,
  Building2,
  Briefcase,
  Save,
  Users,
} from 'lucide-react';

// ========== INTERFACES ==========

interface UnionCategory {
  id: number;
  unionId: number;
  name: string;
  code: string | null;
  description: string | null;
  level: number;
  isActive: boolean;
  employeeCount: number;
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

interface FixedConcept {
  id: number;
  employeeId: string;
  componentId: number;
  componentCode: string;
  componentName: string;
  componentType: string;
  conceptType: string;
  isRemunerative: boolean;
  quantity: number;
  unitAmount: number;
  total: number;
  comment: string | null;
  noDelete: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  source: string;
  isActive: boolean;
  isCurrent: boolean;
}

interface EmployeeData {
  id: string;
  name: string;
  unionCategoryId: number | null;
  unionCategoryName: string | null;
  unionId: number | null;
  unionName: string | null;
  workSectorId: number | null;
  workSectorName: string | null;
  currentRate: {
    dailyRate: number;
    hourlyRate: number | null;
    presenteeismRate: number | null;
    effectiveFrom: string;
  } | null;
}

interface ConceptsResponse {
  employee: EmployeeData;
  concepts: FixedConcept[];
  totals: {
    earnings: number;
    deductions: number;
    remunerative: number;
  };
}

interface SalaryComponent {
  id: number;
  code: string;
  name: string;
  type: string;
  conceptType: string;
  isRemunerative: boolean;
}

// ========== UTILS ==========

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR');
}

// ========== COMPONENT ==========

export default function EmpleadoDetallePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const employeeId = params.id as string;

  // State para gremio/categoría
  const [selectedUnionId, setSelectedUnionId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);

  // State para el dialog de conceptos
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConcept, setEditingConcept] = useState<FixedConcept | null>(null);
  const [formData, setFormData] = useState({
    componentId: '',
    quantity: '1',
    unitAmount: '',
    comment: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
  });

  // ========== QUERIES ==========

  // Fetch employee data with fixed concepts
  const { data, isLoading, error } = useQuery<ConceptsResponse>({
    queryKey: ['employee-fixed-concepts', employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/nominas/empleados/${employeeId}/conceptos-fijos`);
      if (!res.ok) throw new Error('Error al cargar datos del empleado');
      return res.json();
    },
  });

  // Fetch gremios with categories
  const { data: unionsData } = useQuery<{ unions: PayrollUnion[] }>({
    queryKey: ['payroll-unions-with-categories'],
    queryFn: async () => {
      const res = await fetch('/api/nominas/gremios?includeCategories=true');
      if (!res.ok) throw new Error('Error al cargar gremios');
      return res.json();
    },
  });

  // Fetch salary components for select
  const { data: components } = useQuery<SalaryComponent[]>({
    queryKey: ['salary-components-fixed'],
    queryFn: async () => {
      const res = await fetch('/api/nominas/componentes?conceptType=FIXED_INPUT');
      if (!res.ok) throw new Error('Error al cargar componentes');
      return res.json();
    },
  });

  // Set initial values when data loads
  useEffect(() => {
    if (data?.employee) {
      if (data.employee.unionId) {
        setSelectedUnionId(data.employee.unionId.toString());
      }
      if (data.employee.unionCategoryId) {
        setSelectedCategoryId(data.employee.unionCategoryId.toString());
      }
    }
  }, [data?.employee]);

  // Track changes
  useEffect(() => {
    if (!data?.employee) return;

    const originalUnionId = data.employee.unionId?.toString() || '';
    const originalCategoryId = data.employee.unionCategoryId?.toString() || '';

    const changed = selectedUnionId !== originalUnionId || selectedCategoryId !== originalCategoryId;
    setHasChanges(changed);
  }, [selectedUnionId, selectedCategoryId, data?.employee]);

  // Get categories for selected union
  const selectedUnion = unionsData?.unions.find(u => u.id.toString() === selectedUnionId);
  const availableCategories = selectedUnion?.categories || [];

  // ========== MUTATIONS ==========

  // Update employee union/category
  const updateEmployeeMutation = useMutation({
    mutationFn: async (categoryId: number | null) => {
      const res = await fetch(`/api/nominas/empleados/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unionCategoryId: categoryId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al actualizar empleado');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-fixed-concepts', employeeId] });
      toast.success('Gremio y categoría actualizados');
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Create fixed concept
  const createMutation = useMutation({
    mutationFn: async (conceptData: typeof formData) => {
      const res = await fetch(`/api/nominas/empleados/${employeeId}/conceptos-fijos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentId: parseInt(conceptData.componentId),
          quantity: parseFloat(conceptData.quantity),
          unitAmount: parseFloat(conceptData.unitAmount),
          comment: conceptData.comment || null,
          effectiveFrom: conceptData.effectiveFrom,
          effectiveTo: conceptData.effectiveTo || null,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear concepto');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-fixed-concepts', employeeId] });
      toast.success('Concepto agregado correctamente');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update fixed concept
  const updateMutation = useMutation({
    mutationFn: async (conceptData: typeof formData & { conceptId: number }) => {
      const res = await fetch(`/api/nominas/empleados/${employeeId}/conceptos-fijos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptId: conceptData.conceptId,
          quantity: parseFloat(conceptData.quantity),
          unitAmount: parseFloat(conceptData.unitAmount),
          comment: conceptData.comment || null,
          effectiveTo: conceptData.effectiveTo || null,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al actualizar concepto');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-fixed-concepts', employeeId] });
      toast.success('Concepto actualizado');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete fixed concept
  const deleteMutation = useMutation({
    mutationFn: async (conceptId: number) => {
      const res = await fetch(
        `/api/nominas/empleados/${employeeId}/conceptos-fijos?conceptId=${conceptId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al eliminar concepto');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-fixed-concepts', employeeId] });
      toast.success('Concepto eliminado');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ========== HANDLERS ==========

  const handleUnionChange = (value: string) => {
    setSelectedUnionId(value);
    setSelectedCategoryId(''); // Reset category when union changes
  };

  const handleSaveUnionCategory = () => {
    const categoryId = selectedCategoryId ? parseInt(selectedCategoryId) : null;
    updateEmployeeMutation.mutate(categoryId);
  };

  const handleOpenDialog = (concept?: FixedConcept) => {
    if (concept) {
      setEditingConcept(concept);
      setFormData({
        componentId: concept.componentId.toString(),
        quantity: concept.quantity.toString(),
        unitAmount: concept.unitAmount.toString(),
        comment: concept.comment || '',
        effectiveFrom: concept.effectiveFrom.split('T')[0],
        effectiveTo: concept.effectiveTo ? concept.effectiveTo.split('T')[0] : '',
      });
    } else {
      setEditingConcept(null);
      setFormData({
        componentId: '',
        quantity: '1',
        unitAmount: '',
        comment: '',
        effectiveFrom: new Date().toISOString().split('T')[0],
        effectiveTo: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingConcept(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingConcept) {
      updateMutation.mutate({ ...formData, conceptId: editingConcept.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  // ========== COMPUTED ==========

  const currentConcepts = data?.concepts.filter(c => c.isCurrent) || [];
  const earnings = currentConcepts.filter(c => c.componentType === 'EARNING');
  const deductions = currentConcepts.filter(c => c.componentType === 'DEDUCTION');

  // ========== LOADING STATE ==========

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6 space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  // ========== ERROR STATE ==========

  if (error || !data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Error al cargar el empleado</p>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>
              Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ========== RENDER ==========

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border">
        <div className="px-4 md:px-6 py-3 flex items-start gap-4 justify-between">
          <div className="min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 -ml-2"
              onClick={() => router.push('/administracion/nominas/empleados')}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver a Empleados
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
                  {data.employee.name}
                </h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                  {data.employee.unionName && (
                    <>
                      <Users className="h-3.5 w-3.5" />
                      <span>{data.employee.unionName}</span>
                      {data.employee.unionCategoryName && (
                        <>
                          <span>-</span>
                          <span>{data.employee.unionCategoryName}</span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar Concepto
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 pb-6 space-y-6">

        {/* ========== SELECCIÓN DE GREMIO Y CATEGORÍA ========== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Gremio y Categoría
            </CardTitle>
            <CardDescription>
              Selecciona el gremio y categoría del empleado para aplicar las tasas de convenio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Selector de Gremio */}
              <div className="space-y-2">
                <Label htmlFor="union">Gremio/Sindicato</Label>
                <Select value={selectedUnionId} onValueChange={handleUnionChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar gremio..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin gremio</SelectItem>
                    {unionsData?.unions.map((union) => (
                      <SelectItem key={union.id} value={union.id.toString()}>
                        {union.name}
                        {union.code && ` (${union.code})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Selector de Categoría */}
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select
                  value={selectedCategoryId}
                  onValueChange={setSelectedCategoryId}
                  disabled={!selectedUnionId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedUnionId ? "Seleccionar categoría..." : "Primero selecciona un gremio"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                        {cat.code && ` (${cat.code})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tasa de convenio vigente */}
            {data.employee.currentRate && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    Tasa de Convenio Vigente
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Valor Día</p>
                    <p className="font-semibold">{formatCurrency(data.employee.currentRate.dailyRate)}</p>
                  </div>
                  {data.employee.currentRate.hourlyRate && (
                    <div>
                      <p className="text-muted-foreground text-xs">Valor Hora</p>
                      <p className="font-semibold">{formatCurrency(data.employee.currentRate.hourlyRate)}</p>
                    </div>
                  )}
                  {data.employee.currentRate.presenteeismRate && (
                    <div>
                      <p className="text-muted-foreground text-xs">Presentismo/Día</p>
                      <p className="font-semibold">{formatCurrency(data.employee.currentRate.presenteeismRate)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground text-xs">Vigente desde</p>
                    <p className="font-semibold">{formatDate(data.employee.currentRate.effectiveFrom)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Botón guardar */}
            {hasChanges && (
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveUnionCategory}
                  disabled={updateEmployeeMutation.isPending}
                >
                  {updateEmployeeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Guardar Cambios
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Alerta si no tiene gremio */}
            {!data.employee.unionId && !selectedUnionId && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-800 dark:text-amber-200">
                    Este empleado no tiene gremio asignado. Selecciona uno para aplicar las tasas de convenio.
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* ========== RESUMEN DE CONCEPTOS ========== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Haberes Brutos</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(data.totals.earnings)}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Deducciones</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(data.totals.deductions)}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Remunerativo</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(data.totals.remunerative)}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ========== HABERES ========== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Haberes
            </CardTitle>
            <CardDescription>Conceptos que suman al salario bruto</CardDescription>
          </CardHeader>
          <CardContent>
            {earnings.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm">No hay haberes configurados</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Importe Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {earnings.map((concept) => (
                    <TableRow key={concept.id}>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{concept.componentName}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {concept.componentCode}
                            </Badge>
                            {concept.isRemunerative && (
                              <Badge variant="secondary" className="text-[10px]">
                                REM
                              </Badge>
                            )}
                          </div>
                          {concept.comment && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {concept.comment}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{concept.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(concept.unitAmount)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(concept.total)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDate(concept.effectiveFrom)}
                          {concept.effectiveTo && (
                            <span className="text-muted-foreground">
                              {' '} - {formatDate(concept.effectiveTo)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(concept)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!concept.noDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm('¿Eliminar este concepto?')) {
                                  deleteMutation.mutate(concept.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ========== DEDUCCIONES ========== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-red-600" />
              Deducciones
            </CardTitle>
            <CardDescription>Conceptos que restan del salario bruto</CardDescription>
          </CardHeader>
          <CardContent>
            {deductions.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm">No hay deducciones fijas configuradas</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Importe Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deductions.map((concept) => (
                    <TableRow key={concept.id}>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{concept.componentName}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {concept.componentCode}
                            </Badge>
                          </div>
                          {concept.comment && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {concept.comment}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{concept.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(concept.unitAmount)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        -{formatCurrency(concept.total)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDate(concept.effectiveFrom)}
                          {concept.effectiveTo && (
                            <span className="text-muted-foreground">
                              {' '} - {formatDate(concept.effectiveTo)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(concept)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!concept.noDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm('¿Eliminar este concepto?')) {
                                  deleteMutation.mutate(concept.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Info */}
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              <strong>Nota:</strong> Los conceptos fijos se aplican automáticamente en cada liquidación.
              Al agregar un nuevo valor para un concepto existente, el anterior se cierra automáticamente.
              Los conceptos marcados con <Badge variant="secondary" className="text-[10px] mx-1">REM</Badge>
              son remunerativos y afectan el cálculo de aportes.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ========== DIALOG CONCEPTO FIJO ========== */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingConcept ? 'Editar Concepto Fijo' : 'Agregar Concepto Fijo'}
              </DialogTitle>
              <DialogDescription>
                {editingConcept
                  ? 'Modifica los valores del concepto'
                  : 'Agrega un nuevo concepto fijo al empleado'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {!editingConcept && (
                <div className="grid gap-2">
                  <Label htmlFor="componentId">Concepto *</Label>
                  <Select
                    value={formData.componentId}
                    onValueChange={(value) => setFormData({ ...formData, componentId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar concepto" />
                    </SelectTrigger>
                    <SelectContent>
                      {components?.map((comp) => (
                        <SelectItem key={comp.id} value={comp.id.toString()}>
                          {comp.code} - {comp.name}
                          {comp.type === 'DEDUCTION' && ' (Deducción)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {editingConcept && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">{editingConcept.componentName}</p>
                  <p className="text-xs text-muted-foreground">{editingConcept.componentCode}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="quantity">Cantidad</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="1"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="unitAmount">Importe Unitario *</Label>
                  <Input
                    id="unitAmount"
                    type="number"
                    step="0.01"
                    value={formData.unitAmount}
                    onChange={(e) => setFormData({ ...formData, unitAmount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="effectiveFrom">Vigente Desde *</Label>
                  <Input
                    id="effectiveFrom"
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                    required
                    disabled={!!editingConcept}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="effectiveTo">Vigente Hasta</Label>
                  <Input
                    id="effectiveTo"
                    type="date"
                    value={formData.effectiveTo}
                    onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="comment">Comentario</Label>
                <Textarea
                  id="comment"
                  value={formData.comment}
                  onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                  placeholder="Nota opcional sobre el concepto..."
                  rows={2}
                />
              </div>

              {formData.quantity && formData.unitAmount && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Total:</p>
                  <p className="text-lg font-bold">
                    {formatCurrency(
                      parseFloat(formData.quantity || '0') * parseFloat(formData.unitAmount || '0')
                    )}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  (!editingConcept && !formData.componentId) ||
                  !formData.unitAmount
                }
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
