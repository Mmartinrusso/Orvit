'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { useAuth } from '@/contexts/AuthContext';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Calendar,
  DollarSign,
  Settings,
  ChevronRight,
  Building,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Category {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  gremio: string | null;
  conventionCode: string | null;
  paymentScheduleType: string;
  paymentRuleJson: any;
  attendancePolicyJson: any;
  employeeCount: number;
  currentRate: {
    dailyRate: number;
    hourlyRate: number | null;
    presenteeismRate: number | null;
    effectiveFrom: string;
  } | null;
}

const PAYMENT_SCHEDULE_OPTIONS = [
  { value: 'BIWEEKLY_FIXED', label: 'Quincenal (días 15 y último)' },
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

export default function CategoriasPage() {
  const confirm = useConfirm();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canManageNominas = hasPermission('ingresar_nominas');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    gremio: '',
    conventionCode: '',
    paymentScheduleType: 'BIWEEKLY_FIXED',
  });

  // Fetch categorías
  const { data: categories, isLoading, error } = useQuery<Category[]>({
    queryKey: ['payroll-categories'],
    queryFn: async () => {
      const res = await fetch('/api/nominas/categorias');
      if (!res.ok) throw new Error('Error al cargar categorías');
      return res.json();
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: number }) => {
      const url = data.id
        ? `/api/nominas/categorias/${data.id}`
        : '/api/nominas/categorias';
      const method = data.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
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
      queryClient.invalidateQueries({ queryKey: ['payroll-categories'] });
      toast.success(editingCategory ? 'Categoría actualizada' : 'Categoría creada');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/nominas/categorias/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al eliminar');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-categories'] });
      toast.success('Categoría eliminada');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleOpenDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || '',
        gremio: category.gremio || '',
        conventionCode: category.conventionCode || '',
        paymentScheduleType: category.paymentScheduleType,
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        description: '',
        gremio: '',
        conventionCode: '',
        paymentScheduleType: 'BIWEEKLY_FIXED',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCategory(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      ...formData,
      id: editingCategory?.id,
    });
  };

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
            <p className="text-muted-foreground">Error al cargar las categorías</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border">
        <div className="px-4 md:px-6 py-3 flex items-start gap-4 justify-between">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
              Categorías de Empleados
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestiona las categorías, gremios y reglas de pago
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            {canManageNominas && (
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva Categoría
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nombre *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej: OFICIAL"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descripción opcional..."
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="gremio">Gremio/Sindicato</Label>
                      <Input
                        id="gremio"
                        value={formData.gremio}
                        onChange={(e) => setFormData({ ...formData, gremio: e.target.value })}
                        placeholder="Ej: UOCRA"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="conventionCode">Código Convenio</Label>
                      <Input
                        id="conventionCode"
                        value={formData.conventionCode}
                        onChange={(e) => setFormData({ ...formData, conventionCode: e.target.value })}
                        placeholder="Ej: 76/75"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="paymentScheduleType">Frecuencia de Pago</Label>
                    <Select
                      value={formData.paymentScheduleType}
                      onValueChange={(value) => setFormData({ ...formData, paymentScheduleType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_SCHEDULE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 pb-6 space-y-4">
        {categories?.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Building className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Sin categorías</h3>
              <p className="text-muted-foreground mb-4">
                Crea tu primera categoría de empleados para comenzar
              </p>
              {canManageNominas && (
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Categoría
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          categories?.map((category) => (
            <Card key={category.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{category.name}</h3>
                      {category.gremio && (
                        <Badge variant="secondary">{category.gremio}</Badge>
                      )}
                      {!category.isActive && (
                        <Badge variant="destructive">Inactiva</Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {getScheduleLabel(category.paymentScheduleType)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {category.employeeCount} empleados
                      </span>
                      {category.currentRate && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" />
                          {formatCurrency(category.currentRate.dailyRate)}/día
                        </span>
                      )}
                    </div>

                    {category.description && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {category.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/administracion/nominas/categorias/${category.id}/tasas`)}
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      Tasas
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/administracion/nominas/categorias/${category.id}/conceptos`)}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Conceptos
                    </Button>
                    {canManageNominas && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(category)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {canManageNominas && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (category.employeeCount > 0) {
                            toast.error('No se puede eliminar una categoría con empleados');
                            return;
                          }
                          const ok = await confirm({
                            title: 'Eliminar categoría',
                            description: '¿Eliminar esta categoría?',
                            confirmText: 'Eliminar',
                            variant: 'destructive',
                          });
                          if (ok) {
                            deleteMutation.mutate(category.id);
                          }
                        }}
                        disabled={category.employeeCount > 0}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
