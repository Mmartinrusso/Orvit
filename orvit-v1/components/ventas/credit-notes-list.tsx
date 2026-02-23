'use client';

/**
 * Credit Notes List Component
 *
 * Comprehensive credit/debit notes management with:
 * - Advanced filtering and search
 * - Bulk actions
 * - T1/T2 support
 * - Real-time status updates
 * - Quick actions menu
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText,
  Plus,
  Search,
  Eye,
  Check,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  Filter,
  RefreshCcw,
  Download,
  MoreHorizontal,
  Calendar,
  Loader2,
  Edit,
  FileCheck,
  Ban,
  Send,
  FileX,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { SkeletonTable } from '@/components/ui/skeleton-table';

interface CreditNote {
  id: number;
  tipo: 'NOTA_CREDITO' | 'NOTA_DEBITO';
  numero: string;
  fecha: string;
  motivo: string;
  netoGravado: number;
  iva21: number;
  iva105: number;
  iva27: number;
  exento: number;
  noGravado: number;
  total: number;
  fiscalStatus: string;
  afectaStock: boolean;
  cae?: string;
  descripcion?: string;
  docType: 'T1' | 'T2';
  client: {
    id: string;
    name: string;
    cuit?: string;
    legalName?: string;
  };
  invoice?: { id: number; numero: string };
  _count?: { items: number };
  createdAt: string;
}

interface CreditNotesListProps {
  viewMode?: 'S' | 'E';
}

const STATUS_CONFIG: Record<string, { label: string; color: string; variant: any }> = {
  DRAFT: { label: 'Borrador', color: 'bg-muted text-foreground', variant: 'secondary' },
  PENDING_AFIP: { label: 'Pendiente AFIP', color: 'bg-warning-muted text-warning-muted-foreground', variant: 'default' },
  PROCESSING: { label: 'Procesando', color: 'bg-info-muted text-info-muted-foreground', variant: 'default' },
  AUTHORIZED: { label: 'Autorizada', color: 'bg-success-muted text-success', variant: 'default' },
  REJECTED: { label: 'Rechazada', color: 'bg-destructive/10 text-destructive', variant: 'destructive' },
  CANCELLED: { label: 'Anulada', color: 'bg-muted text-muted-foreground', variant: 'outline' },
};

const MOTIVO_LABELS: Record<string, string> = {
  DEVOLUCION: 'Devolución',
  DIFERENCIA_CARGA: 'Diferencia de carga',
  DIFERENCIA_PRECIO: 'Diferencia de precio',
  BONIFICACION: 'Bonificación',
  AJUSTE_FINANCIERO: 'Ajuste financiero',
  REFACTURACION: 'Refacturación',
  FLETE: 'Flete',
  OTRO: 'Otro',
};

export function CreditNotesList({ viewMode = 'S' }: CreditNotesListProps) {
  const router = useRouter();
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotes, setSelectedNotes] = useState<number[]>([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterClient, setFilterClient] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Dialogs
  const [emitDialog, setEmitDialog] = useState<{ open: boolean; noteId: number | null; numero: string }>({
    open: false,
    noteId: null,
    numero: '',
  });
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; noteId: number | null; numero: string }>({
    open: false,
    noteId: null,
    numero: '',
  });

  useEffect(() => {
    loadNotes();
  }, [viewMode, filterTipo, filterStatus, filterClient, fechaDesde, fechaHasta]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('viewMode', viewMode);
      if (filterTipo) params.append('tipo', filterTipo);
      if (filterStatus) params.append('fiscalStatus', filterStatus);
      if (filterClient) params.append('clientId', filterClient);
      if (fechaDesde) params.append('fechaDesde', fechaDesde);
      if (fechaHasta) params.append('fechaHasta', fechaHasta);
      params.append('limit', '100');

      const response = await fetch(`/api/ventas/notas-credito?${params}`);
      if (!response.ok) throw new Error('Error al cargar notas');

      const data = await response.json();
      setNotes(data.data || []);
    } catch (error) {
      console.error('Error loading notes:', error);
      toast.error('Error al cargar notas de crédito');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectNote = (noteId: number, checked: boolean) => {
    if (checked) {
      setSelectedNotes((prev) => [...prev, noteId]);
    } else {
      setSelectedNotes((prev) => prev.filter((id) => id !== noteId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedNotes(filteredNotes.map((n) => n.id));
    } else {
      setSelectedNotes([]);
    }
  };

  const handleViewDetail = (noteId: number) => {
    router.push(`/administracion/ventas/notas-credito/${noteId}`);
  };

  const handleEmit = async () => {
    if (!emitDialog.noteId) return;

    try {
      const response = await fetch(`/api/ventas/notas-credito/${emitDialog.noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'emit' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al emitir nota');
      }

      const result = await response.json();
      toast.success(result.message || 'Nota emitida exitosamente');
      loadNotes();
      setEmitDialog({ open: false, noteId: null, numero: '' });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCancel = async () => {
    if (!cancelDialog.noteId) return;

    try {
      const response = await fetch(`/api/ventas/notas-credito/${cancelDialog.noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al anular nota');
      }

      toast.success('Nota anulada exitosamente');
      loadNotes();
      setCancelDialog({ open: false, noteId: null, numero: '' });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleRetry = async (noteId: number) => {
    try {
      const response = await fetch(`/api/ventas/notas-credito/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al reintentar');
      }

      toast.success('Nota lista para reintentar emisión');
      loadNotes();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleExport = async () => {
    toast.info('Exportación en desarrollo');
  };

  const filteredNotes = notes.filter((n) => {
    const matchesSearch =
      n.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.client.legalName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const stats = {
    totalCreditos: notes.filter((n) => n.tipo === 'NOTA_CREDITO').reduce((sum, n) => sum + Number(n.total), 0),
    totalDebitos: notes.filter((n) => n.tipo === 'NOTA_DEBITO').reduce((sum, n) => sum + Number(n.total), 0),
    borradores: notes.filter((n) => n.fiscalStatus === 'DRAFT').length,
    autorizadas: notes.filter((n) => n.fiscalStatus === 'AUTHORIZED').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Notas de Crédito</p>
                <p className="text-2xl font-bold text-success">
                  {formatCurrency(stats.totalCreditos)}
                </p>
              </div>
              <ArrowDownCircle className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Notas de Débito</p>
                <p className="text-2xl font-bold text-destructive">
                  {formatCurrency(stats.totalDebitos)}
                </p>
              </div>
              <ArrowUpCircle className="w-8 h-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Borradores</p>
                <p className="text-2xl font-bold">{stats.borradores}</p>
              </div>
              <FileText className="w-8 h-8 text-warning-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Autorizadas</p>
                <p className="text-2xl font-bold">{stats.autorizadas}</p>
              </div>
              <FileCheck className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Filtros de Búsqueda</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                setSearchTerm('');
                setFilterTipo('');
                setFilterStatus('');
                setFechaDesde('');
                setFechaHasta('');
              }}>
                Limpiar
              </Button>
              <Button variant="outline" size="sm" onClick={loadNotes}>
                <RefreshCcw className="w-4 h-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Número, cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="NOTA_CREDITO">Nota de Crédito</SelectItem>
                  <SelectItem value="NOTA_DEBITO">Nota de Débito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="DRAFT">Borrador</SelectItem>
                  <SelectItem value="AUTHORIZED">Autorizada</SelectItem>
                  <SelectItem value="REJECTED">Rechazada</SelectItem>
                  <SelectItem value="CANCELLED">Anulada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha Desde</Label>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Fecha Hasta</Label>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {selectedNotes.length > 0 && (
        <Card className="bg-info-muted border-info-muted">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {selectedNotes.length} nota(s) seleccionada(s)
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedNotes([])}
                >
                  Deseleccionar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4">
              <SkeletonTable rows={5} cols={9} />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-12">
              <FileX className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">No hay notas de crédito</p>
              <p className="text-xs text-muted-foreground mt-1">Las notas de crédito y débito aparecerán aquí</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedNotes.length === filteredNotes.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNotes.map((note) => (
                    <TableRow key={note.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedNotes.includes(note.id)}
                          onCheckedChange={(checked) =>
                            handleSelectNote(note.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={note.tipo === 'NOTA_CREDITO' ? 'default' : 'destructive'}
                        >
                          {note.tipo === 'NOTA_CREDITO' ? 'NC' : 'ND'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono font-medium">
                        {note.numero}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {note.client.legalName || note.client.name}
                          </p>
                          {note.client.cuit && (
                            <p className="text-xs text-muted-foreground">
                              {note.client.cuit}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(note.fecha)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {MOTIVO_LABELS[note.motivo] || note.motivo}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <span className={note.tipo === 'NOTA_CREDITO' ? 'text-success' : 'text-destructive'}>
                          {formatCurrency(Number(note.total))}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_CONFIG[note.fiscalStatus]?.variant || 'default'}>
                          {STATUS_CONFIG[note.fiscalStatus]?.label || note.fiscalStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleViewDetail(note.id)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Ver Detalle
                            </DropdownMenuItem>
                            {note.fiscalStatus === 'DRAFT' && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => setEmitDialog({ open: true, noteId: note.id, numero: note.numero })}
                                  className="text-success"
                                >
                                  <Send className="w-4 h-4 mr-2" />
                                  Emitir / Autorizar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setCancelDialog({ open: true, noteId: note.id, numero: note.numero })}
                                  className="text-destructive"
                                >
                                  <Ban className="w-4 h-4 mr-2" />
                                  Anular Borrador
                                </DropdownMenuItem>
                              </>
                            )}
                            {note.fiscalStatus === 'REJECTED' && (
                              <DropdownMenuItem
                                onClick={() => handleRetry(note.id)}
                              >
                                <RefreshCcw className="w-4 h-4 mr-2" />
                                Reintentar
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
        </CardContent>
      </Card>

      {/* Emit Dialog */}
      <AlertDialog open={emitDialog.open} onOpenChange={(open) => !open && setEmitDialog({ open: false, noteId: null, numero: '' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emitir y Autorizar en AFIP</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Confirma la emisión de la nota <strong>{emitDialog.numero}</strong>?
              <br /><br />
              Esta acción:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Enviará la nota a AFIP para autorización</li>
                <li>Afectará la cuenta corriente del cliente</li>
                <li>No podrá ser revertida una vez autorizada</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmit} className="bg-success hover:bg-success/90">
              Sí, Emitir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialog.open} onOpenChange={(open) => !open && setCancelDialog({ open: false, noteId: null, numero: '' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular Borrador</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Confirma la anulación del borrador <strong>{cancelDialog.numero}</strong>?
              <br /><br />
              Esta acción eliminará el borrador permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive hover:bg-destructive/90">
              Sí, Anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
