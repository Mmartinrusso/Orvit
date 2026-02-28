'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProveedorModal } from '@/components/compras/proveedor-modal';
import { ImportarProveedoresDialog } from '@/components/compras/importar-proveedores-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Phone,
  Mail,
  MoreHorizontal,
  Loader2,
  X,
  Upload,
  Ban,
  CheckCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useAuth } from '@/contexts/AuthContext';

interface Proveedor {
  id: string;
  nombre: string;
  razonSocial: string;
  codigo?: string;
  cuit: string;
  email: string;
  telefono: string;
  direccion: string;
  // Campos extendidos para que el modal de edición tenga toda la información
  ciudad?: string;
  codigoPostal?: string;
  provincia?: string;
  contactoNombre?: string;
  contactoTelefono?: string;
  contactoEmail?: string;
  condicionesPago?: string;
  notas?: string;
  cbu?: string;
  aliasCbu?: string;
  banco?: string;
  tipoCuenta?: string;
  numeroCuenta?: string;
  condicionIva?: string;
  ingresosBrutos?: string;
  estado: 'activo' | 'inactivo';
  ordenesCompletadas: number;
  montoTotal: number;
}

export default function ProveedoresPage() {
  const confirm = useConfirm();
  const router = useRouter();
  const { hasPermission } = useAuth();

  // Permission checks
  const canCreate = hasPermission('compras.proveedores.create');
  const canEditProv = hasPermission('compras.proveedores.edit');
  const canDeleteProv = hasPermission('compras.proveedores.delete');

  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('activo');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Mutations ──────────────────────────────────────────
  const deleteSingleMutation = useApiMutation<unknown, { id: string }>({
    mutationFn: async ({ id }) => {
      const response = await fetch(`/api/compras/proveedores/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Error al eliminar el proveedor');
      }
      return response.json();
    },
    successMessage: 'Proveedor eliminado',
    errorMessage: 'Error al eliminar el proveedor',
    onSuccess: () => { loadProveedores(); },
  });

  const bulkDeleteMutation = useApiMutation<{ successCount: number; errorCount: number }, { ids: Set<string> }>({
    mutationFn: async ({ ids }) => {
      let successCount = 0;
      let errorCount = 0;
      for (const id of ids) {
        try {
          const response = await fetch(`/api/compras/proveedores/${id}`, { method: 'DELETE' });
          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }
      // If all failed, throw so onError fires
      if (successCount === 0 && errorCount > 0) {
        throw new Error(`${errorCount} proveedor(es) no se pudieron eliminar`);
      }
      return { successCount, errorCount };
    },
    successMessage: null, // Custom toasts below
    onSuccess: (data) => {
      if (data.successCount > 0) {
        toast.success(`${data.successCount} proveedor(es) eliminado(s)`);
      }
      if (data.errorCount > 0) {
        toast.error(`${data.errorCount} proveedor(es) no se pudieron eliminar`);
      }
      setSelectedIds(new Set());
      loadProveedores();
    },
  });

  const toggleActiveMutation = useApiMutation<unknown, { proveedor: Proveedor }>({
    mutationFn: async ({ proveedor }) => {
      const response = await fetch(`/api/compras/proveedores/${proveedor.id}`, { method: 'PATCH' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Error al actualizar el proveedor');
      }
      return response.json();
    },
    successMessage: null, // Dynamic message in onSuccess
    onSuccess: (_data, { proveedor }) => {
      const wasActive = proveedor.estado === 'activo';
      toast.success(wasActive ? 'Proveedor desactivado' : 'Proveedor activado');
      loadProveedores();
    },
    errorMessage: 'Error al actualizar el proveedor',
  });

  const loadProveedores = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/compras/proveedores?showInactive=true');
      if (!response.ok) {
        throw new Error('Error al obtener proveedores');
      }
      const data = await response.json();
      const mapped: Proveedor[] = (data || []).map((p: any) => ({
        id: String(p.id),
        nombre: p.name,
        razonSocial: p.razon_social || p.name,
        codigo: p.codigo || undefined,
        cuit: p.cuit || '',
        email: p.email || '',
        telefono: p.phone || '',
        direccion: p.address || '',
        ciudad: p.city || undefined,
        codigoPostal: p.postal_code || undefined,
        provincia: p.province || undefined,
        contactoNombre: p.contact_person || undefined,
        contactoTelefono: p.contact_phone || undefined,
        contactoEmail: p.contact_email || undefined,
        condicionesPago: p.condiciones_pago || undefined,
        notas: p.notes || undefined,
        cbu: p.cbu || undefined,
        aliasCbu: p.alias_cbu || undefined,
        banco: p.banco || undefined,
        tipoCuenta: p.tipo_cuenta || undefined,
        numeroCuenta: p.numero_cuenta || undefined,
        condicionIva: p.condicion_iva || undefined,
        ingresosBrutos: p.ingresos_brutos || undefined,
        estado: p.isBlocked ? 'inactivo' : 'activo',
        ordenesCompletadas: 0,
        montoTotal: 0,
      }));
      setProveedores(mapped);
    } catch (error) {
      console.error('Error loading proveedores:', error);
      toast.error('Error al cargar proveedores');
      setProveedores([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProveedores();
  }, []);

  const filteredProveedores = proveedores.filter(proveedor => {
    const matchesSearch =
      proveedor.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proveedor.razonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (proveedor.codigo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      proveedor.cuit.includes(searchTerm) ||
      proveedor.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesEstado = estadoFilter === 'all' || proveedor.estado === estadoFilter;

    return matchesSearch && matchesEstado;
  });

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchTerm, estadoFilter]);

  // Bulk selection functions
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProveedores.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProveedores.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const ok = await confirm({
      title: 'Eliminar proveedores',
      description: `¿Está seguro de eliminar ${selectedIds.size} proveedor(es)?`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    bulkDeleteMutation.mutate({ ids: selectedIds });
  };

  const handleDeleteSingle = async (id: string) => {
    const ok = await confirm({
      title: 'Eliminar proveedor',
      description: '¿Está seguro de eliminar este proveedor?',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    deleteSingleMutation.mutate({ id });
  };

  const handleToggleActive = async (proveedor: Proveedor) => {
    const desactivando = proveedor.estado === 'activo';
    const ok = await confirm({
      title: desactivando ? 'Desactivar proveedor' : 'Activar proveedor',
      description: desactivando
        ? `¿Desactivar a ${proveedor.nombre}? Desaparecerá de la lista pero sus datos quedarán intactos.`
        : `¿Activar a ${proveedor.nombre}?`,
      confirmText: desactivando ? 'Desactivar' : 'Activar',
      variant: desactivando ? 'destructive' : 'default',
    });
    if (!ok) return;

    toggleActiveMutation.mutate({ proveedor });
  };

  return (
    <div className="w-full p-0">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-3 border-b border-border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Proveedores</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredProveedores.length} proveedor(es) registrados
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canCreate && (
              <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Importar
              </Button>
            )}
            {canCreate && (
              <Button size="sm" onClick={() => {
                setEditingProveedor(null);
                setIsModalOpen(true);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Proveedor
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Filtros inline */}
      <div className="px-4 md:px-6 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar nombre, CUIT, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos</SelectItem>
              <SelectItem value="activo" className="text-xs">Activo</SelectItem>
              <SelectItem value="inactivo" className="text-xs">Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="mx-4 md:mx-6 mt-4 flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {selectedIds.size} seleccionado(s)
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Deseleccionar
            </Button>
          </div>
          {canDeleteProv && (
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1" />
              )}
              Eliminar seleccionados
            </Button>
          )}
        </div>
      )}

      {/* Tabla de Proveedores */}
      <div className="px-4 md:px-6 pt-4">
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
            <p className="text-xs text-muted-foreground mt-2">Cargando proveedores...</p>
          </div>
        ) : filteredProveedores.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-xs text-muted-foreground">No se encontraron proveedores</p>
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg mt-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={filteredProveedores.length > 0 && selectedIds.size === filteredProveedores.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Seleccionar todos"
                    />
                  </TableHead>
                  <TableHead className="text-xs font-medium w-[80px]">Código</TableHead>
                  <TableHead className="text-xs font-medium">Nombre</TableHead>
                  <TableHead className="text-xs font-medium">CUIT</TableHead>
                  <TableHead className="text-xs font-medium">Contacto</TableHead>
                  <TableHead className="text-xs font-medium w-[80px]">Estado</TableHead>
                  <TableHead className="text-xs font-medium text-right w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProveedores.map((proveedor) => (
                  <TableRow
                    key={proveedor.id}
                    className={cn(
                      "cursor-pointer hover:bg-muted/30",
                      selectedIds.has(proveedor.id) && "bg-primary/5"
                    )}
                    onClick={() => router.push(`/administracion/compras/proveedores/${proveedor.id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(proveedor.id)}
                        onCheckedChange={() => toggleSelect(proveedor.id)}
                        aria-label={`Seleccionar ${proveedor.nombre}`}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{proveedor.codigo || '-'}</TableCell>
                    <TableCell className="text-xs">
                      <span className="font-medium">{proveedor.nombre}</span>
                      {proveedor.razonSocial && proveedor.razonSocial !== proveedor.nombre && (
                        <span className="block text-xs text-muted-foreground truncate max-w-[200px]">
                          {proveedor.razonSocial}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{proveedor.cuit}</TableCell>
                    <TableCell className="text-xs">
                      {proveedor.email && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span className="truncate max-w-[150px]">{proveedor.email}</span>
                        </div>
                      )}
                      {proveedor.telefono && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="w-2.5 h-2.5" />
                          {proveedor.telefono}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={proveedor.estado === 'activo' ? 'default' : 'secondary'}
                        className="text-xs px-1.5 py-0"
                      >
                        {proveedor.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() => router.push(`/administracion/compras/proveedores/${proveedor.id}`)}
                          >
                            <Eye className="w-3.5 h-3.5 mr-2" />
                            Ver detalle
                          </DropdownMenuItem>
                          {canEditProv && (
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingProveedor(proveedor);
                                setIsModalOpen(true);
                              }}
                            >
                              <Edit className="w-3.5 h-3.5 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          {canEditProv && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleToggleActive(proveedor)}
                              >
                                {proveedor.estado === 'activo' ? (
                                  <>
                                    <Ban className="w-3.5 h-3.5 mr-2" />
                                    Desactivar
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-3.5 h-3.5 mr-2" />
                                    Activar
                                  </>
                                )}
                              </DropdownMenuItem>
                            </>
                          )}
                          {canDeleteProv && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteSingle(proveedor.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          )}
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

      {/* Dialog de importación masiva */}
      <ImportarProveedoresDialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportado={loadProveedores}
      />

      {/* Modal de Proveedor */}
      <ProveedorModal
        proveedor={editingProveedor}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProveedor(null);
        }}
        onProveedorSaved={(proveedor) => {
          // Actualizar lista localmente sin usar datos mock
          setProveedores(prev => {
            const exists = prev.some(p => p.id === proveedor.id);
            if (exists) {
              return prev.map(p => (p.id === proveedor.id ? proveedor : p));
            }
            return [...prev, proveedor];
          });
          setIsModalOpen(false);
          setEditingProveedor(null);
        }}
      />
    </div>
  );
}

