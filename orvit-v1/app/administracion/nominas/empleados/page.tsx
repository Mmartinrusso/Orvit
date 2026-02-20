'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Upload,
  Download,
  Search,
  MoreHorizontal,
  Building2,
  MapPin,
  FileSpreadsheet,
  AlertCircle,
  Loader2,
  DollarSign,
  Table2,
  X,
  Save,
  Briefcase,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

interface PayrollEmployee {
  id: string;
  name: string;
  role: string;
  cuil: string | null;
  grossSalary: number;
  payrollTaxes: number;
  hireDate: string | null;
  terminationDate: string | null;
  active: boolean;
  unionCategoryId: number | null;
  workSectorId: number | null;
  categoryName: string | null;
  categoryCode: string | null;
  unionId: number | null;
  unionName: string | null;
  unionCode: string | null;
  sectorName: string | null;
}

interface PayrollUnion {
  id: number;
  name: string;
  code: string | null;
  categories?: UnionCategory[];
}

interface UnionCategory {
  id: number;
  unionId: number;
  name: string;
  code: string | null;
}

interface WorkSector {
  id: number;
  name: string;
  code: string | null;
  sourceSectorId: number | null;
}

interface BulkEditRow {
  id: string;
  name: string;
  role: string;
  cuil: string;
  hireDate: string;
  unionCategoryId: string;
  workSectorId: string;
  changed: boolean;
}

interface WorkStationOption {
  id: number;
  name: string;
  code: string;
  sectorId: number;
  sectorName: string;
}

export default function EmpleadosPage() {
  const confirm = useConfirm();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentCompany } = useCompany();

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<PayrollEmployee | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnionId, setFilterUnionId] = useState<string>('all');
  const [filterSectorId, setFilterSectorId] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);

  // Bulk edit states
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkEdits, setBulkEdits] = useState<Record<string, BulkEditRow>>({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    cuil: '',
    hireDate: '',
    unionId: '',
    unionCategoryId: '',
    workSectorId: '',
  });

  // Import state
  const [importData, setImportData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [updateExisting, setUpdateExisting] = useState(false);

  // Fetch employees
  const { data: employeesData, isLoading: loadingEmployees } = useQuery({
    queryKey: ['payroll-employees', showInactive],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (showInactive) params.set('includeInactive', 'true');
      const res = await fetch(`/api/nominas/empleados?${params}`);
      if (!res.ok) throw new Error('Error al cargar empleados');
      return res.json();
    },
  });

  // Fetch unions with categories
  const { data: unionsData } = useQuery({
    queryKey: ['payroll-unions-with-categories'],
    queryFn: async () => {
      const res = await fetch('/api/nominas/gremios?includeCategories=true');
      if (!res.ok) throw new Error('Error al cargar gremios');
      return res.json();
    },
  });

  // Fetch sectors
  const { data: sectorsData } = useQuery({
    queryKey: ['work-sectors'],
    queryFn: async () => {
      const res = await fetch('/api/nominas/sectores');
      if (!res.ok) throw new Error('Error al cargar sectores');
      return res.json();
    },
  });

  // Fetch puestos de trabajo (WorkStations) de mantenimiento
  const { data: workStationsData } = useQuery({
    queryKey: ['work-stations-for-employees', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return { workStations: [] };
      const res = await fetch(`/api/work-stations?companyId=${currentCompany.id}`);
      if (!res.ok) return { workStations: [] };
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const method = editingEmployee ? 'PUT' : 'POST';
      const res = await fetch('/api/nominas/empleados', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingEmployee ? { ...data, id: editingEmployee.id } : data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al guardar');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-employees'] });
      toast.success(data.message);
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/nominas/empleados?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al eliminar');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-employees'] });
      toast.success(data.message);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Bulk save mutation
  const bulkSaveMutation = useMutation({
    mutationFn: async (employees: any[]) => {
      const res = await fetch('/api/nominas/empleados/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al guardar');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-employees'] });
      toast.success(data.message);
      setBulkEditMode(false);
      setBulkEdits({});
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (data: { employees: any[]; updateExisting: boolean }) => {
      const res = await fetch('/api/nominas/empleados/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al importar');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-employees'] });
      toast.success(data.message);
      if (data.errors?.length > 0) {
        setImportErrors(data.errors);
      } else {
        setIsImportDialogOpen(false);
        setImportData([]);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const employees = employeesData?.employees || [];
  const stats = employeesData?.stats || { total: 0, active: 0, withCategory: 0, withSector: 0 };
  const unions: PayrollUnion[] = unionsData?.unions || [];
  const sectors: WorkSector[] = sectorsData?.sectors || [];

  // Puestos de trabajo de mantenimiento
  const workStations: WorkStationOption[] = useMemo(() => {
    return (workStationsData?.workStations || [])
      .filter((ws: any) => ws.status === 'ACTIVE')
      .map((ws: any) => ({
        id: ws.id,
        name: ws.name,
        code: ws.code,
        sectorId: ws.sectorId,
        sectorName: ws.sector?.name || '',
      }));
  }, [workStationsData]);

  // Mapear WorkSector (nominas) -> Sector (mantenimiento) via sourceSectorId
  const getWorkStationsForSector = useCallback((workSectorId: string) => {
    if (!workSectorId) return workStations;
    const sector = sectors.find(s => s.id === parseInt(workSectorId));
    if (!sector?.sourceSectorId) return workStations;
    const filtered = workStations.filter(ws => ws.sectorId === sector.sourceSectorId);
    return filtered.length > 0 ? filtered : workStations;
  }, [workStations, sectors]);

  // Get categories for selected union (dialog form)
  const selectedUnionCategories = useMemo(() => {
    if (!formData.unionId) return [];
    const union = unions.find(u => u.id === parseInt(formData.unionId));
    return union?.categories || [];
  }, [formData.unionId, unions]);

  // Get all categories flat for bulk edit
  const allCategories = useMemo(() => {
    const cats: (UnionCategory & { unionName: string })[] = [];
    unions.forEach(u => {
      (u.categories || []).forEach(c => {
        cats.push({ ...c, unionName: u.name });
      });
    });
    return cats;
  }, [unions]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp: PayrollEmployee) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!emp.name.toLowerCase().includes(term) &&
            !emp.cuil?.toLowerCase().includes(term) &&
            !emp.role?.toLowerCase().includes(term)) {
          return false;
        }
      }
      if (filterUnionId !== 'all' && emp.unionId !== parseInt(filterUnionId)) {
        return false;
      }
      if (filterSectorId !== 'all' && emp.workSectorId !== parseInt(filterSectorId)) {
        return false;
      }
      return true;
    });
  }, [employees, searchTerm, filterUnionId, filterSectorId]);

  // Count changed rows in bulk edit
  const changedCount = useMemo(() => {
    return Object.values(bulkEdits).filter(r => r.changed).length;
  }, [bulkEdits]);

  const handleOpenDialog = (employee?: PayrollEmployee) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        name: employee.name,
        role: employee.role || '',
        cuil: employee.cuil || '',
        hireDate: employee.hireDate ? employee.hireDate.split('T')[0] : '',
        unionId: employee.unionId?.toString() || '',
        unionCategoryId: employee.unionCategoryId?.toString() || '',
        workSectorId: employee.workSectorId?.toString() || '',
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        name: '',
        role: '',
        cuil: '',
        hireDate: '',
        unionId: '',
        unionCategoryId: '',
        workSectorId: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingEmployee(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      name: formData.name,
      role: formData.role,
      cuil: formData.cuil || null,
      hireDate: formData.hireDate || null,
      unionCategoryId: formData.unionCategoryId ? parseInt(formData.unionCategoryId) : null,
      workSectorId: formData.workSectorId ? parseInt(formData.workSectorId) : null,
    });
  };

  // Bulk edit handlers
  const enterBulkEdit = useCallback(() => {
    const edits: Record<string, BulkEditRow> = {};
    filteredEmployees.forEach((emp: PayrollEmployee) => {
      edits[emp.id] = {
        id: emp.id,
        name: emp.name,
        role: emp.role || '',
        cuil: emp.cuil || '',
        hireDate: emp.hireDate ? emp.hireDate.split('T')[0] : '',
        unionCategoryId: emp.unionCategoryId?.toString() || '',
        workSectorId: emp.workSectorId?.toString() || '',
        changed: false,
      };
    });
    setBulkEdits(edits);
    setBulkEditMode(true);
  }, [filteredEmployees]);

  const exitBulkEdit = useCallback(async () => {
    if (changedCount > 0) {
      const ok = await confirm({
        title: 'Cambios sin guardar',
        description: `Tenés ${changedCount} cambio${changedCount !== 1 ? 's' : ''} sin guardar. ¿Salir?`,
        confirmText: 'Confirmar',
        variant: 'default',
      });
      if (!ok) return;
    }
    setBulkEditMode(false);
    setBulkEdits({});
  }, [changedCount, confirm]);

  const updateBulkField = useCallback((id: string, field: keyof BulkEditRow, value: string) => {
    setBulkEdits(prev => {
      const row = prev[id];
      if (!row) return prev;
      // Check if changed from original
      const emp = employees.find((e: PayrollEmployee) => e.id === id);
      const original: Record<string, string> = {
        name: emp?.name || '',
        role: emp?.role || '',
        cuil: emp?.cuil || '',
        hireDate: emp?.hireDate ? emp.hireDate.split('T')[0] : '',
        unionCategoryId: emp?.unionCategoryId?.toString() || '',
        workSectorId: emp?.workSectorId?.toString() || '',
      };
      const updated = { ...row, [field]: value };
      // Reset puesto si cambia el sector
      if (field === 'workSectorId') {
        updated.role = '';
      }
      const changed = Object.keys(original).some(k => updated[k as keyof BulkEditRow] !== original[k]);
      return { ...prev, [id]: { ...updated, changed } };
    });
  }, [employees]);

  const handleBulkSave = useCallback(() => {
    const changedRows = Object.values(bulkEdits).filter(r => r.changed);
    if (changedRows.length === 0) {
      toast.info('No hay cambios para guardar');
      return;
    }
    const payload = changedRows.map(r => ({
      id: r.id,
      name: r.name,
      role: r.role,
      cuil: r.cuil || null,
      hireDate: r.hireDate || null,
      unionCategoryId: r.unionCategoryId ? parseInt(r.unionCategoryId) : null,
      workSectorId: r.workSectorId ? parseInt(r.workSectorId) : null,
    }));
    bulkSaveMutation.mutate(payload);
  }, [bulkEdits, bulkSaveMutation]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Map Excel columns to expected format
        const mappedData = jsonData.map((row: any) => ({
          name: row['Nombre'] || row['name'] || row['NOMBRE'] || '',
          cuil: row['CUIL'] || row['cuil'] || row['Cuil'] || '',
          role: row['Cargo'] || row['role'] || row['CARGO'] || row['Rol'] || '',
          hireDate: row['Fecha Ingreso'] || row['hireDate'] || row['Ingreso'] || '',
          unionCategoryCode: row['Código Categoría'] || row['unionCategoryCode'] || row['Cat.'] || '',
          unionCategoryName: row['Categoría'] || row['unionCategoryName'] || row['Categoria'] || '',
          workSectorName: row['Sector'] || row['workSectorName'] || '',
        }));

        setImportData(mappedData);
        setImportErrors([]);
        setIsImportDialogOpen(true);
      } catch (error) {
        toast.error('Error al leer el archivo Excel');
      }
    };
    reader.readAsArrayBuffer(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = () => {
    if (importData.length === 0) {
      toast.error('No hay datos para importar');
      return;
    }
    importMutation.mutate({ employees: importData, updateExisting });
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Nombre': 'Juan Pérez',
        'CUIL': '20-12345678-9',
        'Cargo': 'Operario',
        'Fecha Ingreso': '2024-01-15',
        'Código Categoría': 'OF',
        'Categoría': 'OFICIAL',
        'Sector': 'Albañilería',
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Empleados');
    XLSX.writeFile(wb, 'plantilla_empleados.xlsx');
  };

  if (loadingEmployees) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border">
        <div className="px-4 md:px-6 py-3">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            Empleados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.active} activos · {stats.withCategory} con categoria · {stats.withSector} con sector
          </p>
        </div>
      </div>

      {/* Employee Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-6">
          <form onSubmit={handleSubmit}>
            <DialogHeader className="pb-4">
              <DialogTitle>
                {editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
              </DialogTitle>
              <DialogDescription>
                {editingEmployee
                  ? 'Modifica los datos del empleado'
                  : 'Registra un nuevo empleado con su gremio y sector'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-4 max-h-[60vh] overflow-y-auto">
              {/* Nombre y CUIL */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Juan Perez"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cuil">CUIL</Label>
                  <Input
                    id="cuil"
                    value={formData.cuil}
                    onChange={(e) => setFormData({ ...formData, cuil: e.target.value })}
                    placeholder="20-12345678-9"
                  />
                </div>
              </div>

              {/* Fecha Ingreso y Sector */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hireDate">Fecha de Ingreso</Label>
                  <Input
                    id="hireDate"
                    type="date"
                    value={formData.hireDate}
                    onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sector de Trabajo</Label>
                  <Select
                    value={formData.workSectorId || '__NONE__'}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      workSectorId: value === '__NONE__' ? '' : value,
                      role: '', // Reset puesto al cambiar sector
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar sector" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__NONE__">Sin sector</SelectItem>
                      {sectors.map((sector) => (
                        <SelectItem key={sector.id} value={sector.id.toString()}>
                          {sector.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Puesto de Trabajo */}
              <div className="space-y-2">
                <Label>Puesto de Trabajo</Label>
                <Select
                  value={formData.role || '__NONE__'}
                  onValueChange={(value) => setFormData({ ...formData, role: value === '__NONE__' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.workSectorId ? "Seleccionar puesto" : "Primero selecciona sector"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">Sin puesto</SelectItem>
                    {getWorkStationsForSector(formData.workSectorId).map((ws) => (
                      <SelectItem key={ws.id} value={ws.name}>
                        {ws.name}
                        {ws.sectorName ? ` (${ws.sectorName})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Gremio y Categoría */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Gremio</Label>
                  <Select
                    value={formData.unionId || '__NONE__'}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      unionId: value === '__NONE__' ? '' : value,
                      unionCategoryId: '',
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar gremio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__NONE__">Sin gremio</SelectItem>
                      {unions.map((union) => (
                        <SelectItem key={union.id} value={union.id.toString()}>
                          {union.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Categoria Gremial</Label>
                  <Select
                    value={formData.unionCategoryId || '__NONE__'}
                    onValueChange={(value) => setFormData({ ...formData, unionCategoryId: value === '__NONE__' ? '' : value })}
                    disabled={!formData.unionId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.unionId ? "Seleccionar categoria" : "Primero selecciona gremio"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__NONE__">Sin categoria</SelectItem>
                      {selectedUnionCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.code ? `${cat.code} - ` : ''}{cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending || !formData.name.trim()}>
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  editingEmployee ? 'Actualizar' : 'Crear'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Importar Empleados desde Excel</DialogTitle>
            <DialogDescription>
              {importData.length} empleados encontrados en el archivo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {importErrors.length > 0 && (
              <Card className="border-destructive">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    Errores en la importacion
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    {importErrors.slice(0, 10).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {importErrors.length > 10 && (
                      <li>...y {importErrors.length - 10} errores mas</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Nombre</TableHead>
                    <TableHead>CUIL</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Sector</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importData.slice(0, 10).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.name || '-'}</TableCell>
                      <TableCell>{row.cuil || '-'}</TableCell>
                      <TableCell>{row.unionCategoryName || row.unionCategoryCode || '-'}</TableCell>
                      <TableCell>{row.workSectorName || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {importData.length > 10 && (
                <div className="p-2 text-center text-xs text-muted-foreground bg-muted/50">
                  ...y {importData.length - 10} empleados mas
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="updateExisting"
                checked={updateExisting}
                onCheckedChange={(checked) => setUpdateExisting(checked === true)}
              />
              <label
                htmlFor="updateExisting"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Actualizar empleados existentes (por CUIL)
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsImportDialogOpen(false);
              setImportData([]);
              setImportErrors([]);
            }}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={importMutation.isPending}>
              {importMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar {importData.length} empleados
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content */}
      <div className="px-4 md:px-6 pb-6 space-y-4">
        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="flex flex-1 gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o CUIL..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                disabled={bulkEditMode}
              />
            </div>
            <Select value={filterUnionId} onValueChange={setFilterUnionId} disabled={bulkEditMode}>
              <SelectTrigger className="w-[160px]">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Gremio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los gremios</SelectItem>
                {unions.map((union) => (
                  <SelectItem key={union.id} value={union.id.toString()}>
                    {union.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSectorId} onValueChange={setFilterSectorId} disabled={bulkEditMode}>
              <SelectTrigger className="w-[160px]">
                <MapPin className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los sectores</SelectItem>
                {sectors.map((sector) => (
                  <SelectItem key={sector.id} value={sector.id.toString()}>
                    {sector.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            {!bulkEditMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={enterBulkEdit}
                  disabled={filteredEmployees.length === 0}
                >
                  <Table2 className="h-4 w-4 mr-2" />
                  Edicion masiva
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar desde Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={downloadTemplate}>
                      <Download className="h-4 w-4 mr-2" />
                      Descargar plantilla
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button size="sm" onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Empleado
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={exitBulkEdit}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleBulkSave}
                  disabled={changedCount === 0 || bulkSaveMutation.isPending}
                >
                  {bulkSaveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar {changedCount > 0 ? `(${changedCount})` : ''}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Bulk edit info bar */}
        {bulkEditMode && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
            <Table2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Modo edicion masiva · {filteredEmployees.length} empleado{filteredEmployees.length !== 1 ? 's' : ''} · {changedCount} modificado{changedCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Show inactive toggle */}
        {!bulkEditMode && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="showInactive"
              checked={showInactive}
              onCheckedChange={(checked) => setShowInactive(checked === true)}
            />
            <label
              htmlFor="showInactive"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Mostrar empleados inactivos
            </label>
          </div>
        )}

        {/* Employees list */}
        {filteredEmployees.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Sin empleados</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || filterUnionId !== 'all' || filterSectorId !== 'all'
                  ? 'No se encontraron empleados con los filtros aplicados'
                  : 'Crea tu primer empleado o importa desde Excel'
                }
              </p>
              {!searchTerm && filterUnionId === 'all' && filterSectorId === 'all' && (
                <div className="flex justify-center gap-2">
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar Excel
                  </Button>
                  <Button onClick={() => handleOpenDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Empleado
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : bulkEditMode ? (
          /* Bulk edit table */
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="min-w-[200px]">Nombre</TableHead>
                  <TableHead className="min-w-[180px]">Puesto de Trabajo</TableHead>
                  <TableHead className="min-w-[140px]">CUIL</TableHead>
                  <TableHead className="min-w-[140px]">Fecha Ingreso</TableHead>
                  <TableHead className="min-w-[200px]">Categoria Gremial</TableHead>
                  <TableHead className="min-w-[160px]">Sector</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp: PayrollEmployee) => {
                  const row = bulkEdits[emp.id];
                  if (!row) return null;
                  return (
                    <TableRow
                      key={emp.id}
                      className={cn(
                        !emp.active && 'opacity-50',
                        row.changed && 'bg-primary/5'
                      )}
                    >
                      <TableCell className="px-2">
                        {row.changed && (
                          <div className="h-2 w-2 rounded-full bg-primary" title="Modificado" />
                        )}
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          value={row.name}
                          onChange={(e) => updateBulkField(emp.id, 'name', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Select
                          value={row.role || '__NONE__'}
                          onValueChange={(value) => updateBulkField(emp.id, 'role', value === '__NONE__' ? '' : value)}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Sin puesto" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__NONE__">Sin puesto</SelectItem>
                            {getWorkStationsForSector(row.workSectorId).map((ws) => (
                              <SelectItem key={ws.id} value={ws.name}>
                                {ws.name} ({ws.sectorName})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          value={row.cuil}
                          onChange={(e) => updateBulkField(emp.id, 'cuil', e.target.value)}
                          className="h-8 text-sm font-mono"
                          placeholder="20-12345678-9"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="date"
                          value={row.hireDate}
                          onChange={(e) => updateBulkField(emp.id, 'hireDate', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Select
                          value={row.unionCategoryId || '__NONE__'}
                          onValueChange={(value) => updateBulkField(emp.id, 'unionCategoryId', value === '__NONE__' ? '' : value)}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Sin categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__NONE__">Sin categoria</SelectItem>
                            {allCategories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id.toString()}>
                                {cat.unionName} - {cat.code ? `${cat.code} ` : ''}{cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Select
                          value={row.workSectorId || '__NONE__'}
                          onValueChange={(value) => updateBulkField(emp.id, 'workSectorId', value === '__NONE__' ? '' : value)}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Sin sector" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__NONE__">Sin sector</SelectItem>
                            {sectors.map((sector) => (
                              <SelectItem key={sector.id} value={sector.id.toString()}>
                                {sector.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          /* Normal view table */
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Empleado</TableHead>
                  <TableHead>CUIL</TableHead>
                  <TableHead>Gremio / Categoria</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp: PayrollEmployee) => (
                  <TableRow key={emp.id} className={!emp.active ? 'opacity-50' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                          {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {emp.name}
                            {!emp.active && (
                              <Badge variant="outline" className="text-[10px]">Inactivo</Badge>
                            )}
                          </div>
                          {emp.role && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              {emp.role}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {emp.cuil || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {emp.unionName ? (
                        <div>
                          <div className="text-sm">{emp.unionName}</div>
                          {emp.categoryName && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              {emp.categoryCode ? `${emp.categoryCode} - ` : ''}{emp.categoryName}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {emp.sectorName ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {emp.sectorName}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/administracion/nominas/empleados/${emp.id}`)}>
                            <DollarSign className="h-4 w-4 mr-2" />
                            Conceptos Fijos
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenDialog(emp)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={async () => {
                              const ok = await confirm({
                                title: 'Desactivar empleado',
                                description: `¿Desactivar a ${emp.name}?`,
                                confirmText: 'Eliminar',
                                variant: 'destructive',
                              });
                              if (ok) {
                                deleteMutation.mutate(emp.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Desactivar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
