'use client';

import { useUserColors } from '@/hooks/use-user-colors';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Package,
  Plus,
  Calendar,
  Clock,
  Loader2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  Send,
  Lock,
  Unlock,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from 'sonner';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';



interface SectorProduct {
  id: string;
  name: string;
  code: string;
  unit: string;
  recipe?: { id: string; name: string } | null;
}

interface SessionEntry {
  id: number;
  productId: string;
  quantity: number;
  scrapQuantity: number;
  uom: string;
  batchNumber?: string;
  notes?: string;
  product: {
    id: string; name: string; code: string; unit: string;
    recipeId?: string;
    recipe?: { id: string; name: string } | null;
  };
  workCenter?: { id: number; name: string; code: string } | null;
  registeredBy: { id: number; name: string };
}

interface Session {
  id: number;
  productionDate: string;
  sectorId: number;
  shiftId: number | null;
  status: string;
  notes: string | null;
  sector: { id: number; name: string };
  shift: { id: number; name: string; code: string } | null;
  submittedBy: { id: number; name: string } | null;
  approvedBy: { id: number; name: string } | null;
  entries: SessionEntry[];
}

interface Shift {
  id: number;
  name: string;
  code: string;
  type: string;
  startTime: string;
  endTime: string;
}

export default function ProduccionDelDiaPage() {
  const { currentSector } = useCompany();
  const { user } = useAuth();
  const confirm = useConfirm();
  const userColors = useUserColors();

  // State
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [sectorProducts, setSectorProducts] = useState<SectorProduct[]>([]);
  const [allProducts, setAllProducts] = useState<SectorProduct[]>([]);

  // Selected date and shift
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedShiftId, setSelectedShiftId] = useState<string>('_none');

  // Inline editing
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<number, { quantity: string; scrapQuantity: string }>>({});
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add product
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);

  // Status actions
  const [submitting, setSubmitting] = useState(false);

  const isReadOnly = session?.status !== 'DRAFT';
  const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd');
  const formattedDate = format(parseISO(selectedDate), "EEEE d 'de' MMMM yyyy", { locale: es });

  // Detect current shift
  useEffect(() => {
    if (shifts.length > 0 && selectedShiftId === '_none') {
      const now = new Date();
      const currentTime = format(now, 'HH:mm');
      const detected = shifts.find(s => {
        if (s.startTime <= s.endTime) {
          return currentTime >= s.startTime && currentTime < s.endTime;
        }
        return currentTime >= s.startTime || currentTime < s.endTime;
      });
      if (detected) {
        setSelectedShiftId(detected.id.toString());
      }
    }
  }, [shifts, selectedShiftId]);

  // Fetch shifts
  useEffect(() => {
    const fetchShifts = async () => {
      try {
        const res = await fetch('/api/production/shifts?isActive=true');
        const data = await res.json();
        if (data.success) setShifts(data.shifts || []);
      } catch (error) {
        console.error('Error fetching shifts:', error);
      }
    };
    fetchShifts();
  }, []);

  // Fetch sector products
  useEffect(() => {
    if (!currentSector) return;
    const fetchProducts = async () => {
      try {
        const [sectorRes, allRes] = await Promise.all([
          fetch(`/api/production/sector-products?sectorId=${currentSector.id}`),
          fetch('/api/products?isActive=true&limit=500'),
        ]);
        const [sectorData, allData] = await Promise.all([sectorRes.json(), allRes.json()]);
        if (sectorData.success) setSectorProducts(sectorData.products || []);
        if (allData.success) setAllProducts(allData.products || []);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };
    fetchProducts();
  }, [currentSector]);

  // Fetch or create session
  const fetchSession = useCallback(async () => {
    if (!currentSector) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sectorId: currentSector.id.toString(),
        productionDate: selectedDate,
      });
      if (selectedShiftId && selectedShiftId !== '_none') {
        params.set('shiftId', selectedShiftId);
      }
      const res = await fetch(`/api/production/daily-sessions?${params}`);
      const data = await res.json();
      if (data.success) {
        setSession(data.session);
        // Initialize edit values
        const values: Record<number, { quantity: string; scrapQuantity: string }> = {};
        data.session.entries.forEach((e: SessionEntry) => {
          values[e.id] = {
            quantity: Number(e.quantity).toString(),
            scrapQuantity: Number(e.scrapQuantity).toString(),
          };
        });
        setEditValues(values);
      }
    } catch (error) {
      console.error('Error fetching session:', error);
      toast.error('Error al cargar sesión');
    } finally {
      setLoading(false);
    }
  }, [currentSector, selectedDate, selectedShiftId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Auto-save entry (debounced)
  const saveEntry = useCallback(async (entryId: number, quantity: string, scrapQuantity: string) => {
    try {
      const res = await fetch(`/api/production/daily-entries/${entryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: parseFloat(quantity) || 0,
          scrapQuantity: parseFloat(scrapQuantity) || 0,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'Error al guardar');
      }
    } catch {
      toast.error('Error al guardar cambios');
    }
  }, []);

  const handleValueChange = (entryId: number, field: 'quantity' | 'scrapQuantity', value: string) => {
    setEditValues(prev => ({
      ...prev,
      [entryId]: { ...prev[entryId], [field]: value },
    }));

    // Debounced save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const vals = { ...editValues[entryId], [field]: value };
      saveEntry(entryId, vals.quantity, vals.scrapQuantity);
    }, 2000);
  };

  // Add product to session
  const handleAddProduct = async (productId: string) => {
    if (!session) return;
    setAddingProduct(true);
    try {
      const res = await fetch('/api/production/daily-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          productId,
          quantity: 0,
          scrapQuantity: 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAddProductOpen(false);
        fetchSession();
      } else {
        toast.error(data.error || 'Error al agregar producto');
      }
    } catch {
      toast.error('Error al agregar producto');
    } finally {
      setAddingProduct(false);
    }
  };

  // Delete entry
  const handleDeleteEntry = async (entryId: number) => {
    const ok = await confirm({
      title: 'Eliminar registro',
      description: '¿Eliminar este registro?',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/production/daily-entries/${entryId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Registro eliminado');
        fetchSession();
      } else {
        toast.error(data.error || 'Error al eliminar');
      }
    } catch {
      toast.error('Error al eliminar');
    }
  };

  // Submit session
  const handleSubmit = async () => {
    if (!session) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/production/daily-sessions/${session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SUBMITTED' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Turno enviado para aprobación');
        setSession(data.session);
      } else {
        toast.error(data.error || 'Error al enviar');
      }
    } catch {
      toast.error('Error al enviar turno');
    } finally {
      setSubmitting(false);
    }
  };

  // Approve session
  const handleApprove = async () => {
    if (!session) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/production/daily-sessions/${session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Sesión aprobada');
        setSession(data.session);
      } else {
        toast.error(data.error || 'Error al aprobar');
      }
    } catch {
      toast.error('Error al aprobar');
    } finally {
      setSubmitting(false);
    }
  };

  // Reopen to draft
  const handleReopen = async () => {
    if (!session) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/production/daily-sessions/${session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DRAFT' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Sesión reabierta');
        setSession(data.session);
      } else {
        toast.error(data.error || 'Error al reabrir');
      }
    } catch {
      toast.error('Error al reabrir');
    } finally {
      setSubmitting(false);
    }
  };

  // Date navigation
  const goToPreviousDay = () => setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'));
  const goToNextDay = () => {
    const next = addDays(parseISO(selectedDate), 1);
    if (next <= new Date()) setSelectedDate(format(next, 'yyyy-MM-dd'));
  };
  const goToToday = () => setSelectedDate(format(new Date(), 'yyyy-MM-dd'));

  // Totals
  const totals = useMemo(() => {
    if (!session) return { quantity: 0, scrap: 0, count: 0, scrapPct: 0 };
    const quantity = session.entries.reduce((s, e) => {
      const val = editValues[e.id]?.quantity;
      return s + (val !== undefined ? parseFloat(val) || 0 : Number(e.quantity));
    }, 0);
    const scrap = session.entries.reduce((s, e) => {
      const val = editValues[e.id]?.scrapQuantity;
      return s + (val !== undefined ? parseFloat(val) || 0 : Number(e.scrapQuantity));
    }, 0);
    const total = quantity + scrap;
    return {
      quantity,
      scrap,
      count: session.entries.length,
      scrapPct: total > 0 ? ((scrap / total) * 100).toFixed(1) : '0',
    };
  }, [session, editValues]);

  // Products not yet in session
  const availableProducts = useMemo(() => {
    if (!session) return sectorProducts;
    const usedIds = new Set(session.entries.map(e => e.productId));
    return sectorProducts.filter(p => !usedIds.has(p.id));
  }, [session, sectorProducts]);

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    DRAFT: { label: 'Borrador', color: 'bg-warning-muted text-warning-muted-foreground', icon: <Clock className="h-3.5 w-3.5" /> },
    SUBMITTED: { label: 'Enviado', color: 'bg-info-muted text-info-muted-foreground', icon: <Send className="h-3.5 w-3.5" /> },
    APPROVED: { label: 'Aprobado', color: 'bg-success-muted text-success', icon: <Check className="h-3.5 w-3.5" /> },
    LOCKED: { label: 'Cerrado', color: 'bg-muted text-foreground', icon: <Lock className="h-3.5 w-3.5" /> },
  };

  if (!currentSector) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="text-lg font-medium mb-1">Sin sector seleccionado</h3>
          <p className="text-muted-foreground text-sm">Seleccioná un sector para cargar producción</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${userColors.chart5}15` }}
            >
              <Package className="h-5 w-5" style={{ color: userColors.chart5 }} />
            </div>
            Producción del Día
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {currentSector.name}
          </p>
        </div>

        {/* Status actions */}
        <div className="flex items-center gap-2">
          {session && (
            <Badge className={cn('gap-1', statusConfig[session.status]?.color)}>
              {statusConfig[session.status]?.icon}
              {statusConfig[session.status]?.label}
            </Badge>
          )}
          {session?.status === 'DRAFT' && session.entries.length > 0 && (
            <Button size="sm" onClick={handleSubmit} disabled={submitting} className="gap-1">
              <Send className="h-4 w-4" />
              Enviar turno
            </Button>
          )}
          {session?.status === 'SUBMITTED' && (
            <>
              <Button size="sm" variant="outline" onClick={handleReopen} disabled={submitting} className="gap-1">
                <Unlock className="h-4 w-4" />
                Reabrir
              </Button>
              <Button size="sm" onClick={handleApprove} disabled={submitting} className="gap-1">
                <Check className="h-4 w-4" />
                Aprobar
              </Button>
            </>
          )}
          {session?.status === 'APPROVED' && (
            <Button size="sm" variant="outline" onClick={handleReopen} disabled={submitting} className="gap-1">
              <Unlock className="h-4 w-4" />
              Reabrir
            </Button>
          )}
        </div>
      </div>

      {/* Date & Shift Navigation */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPreviousDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 px-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium capitalize text-sm">{formattedDate}</span>
                {isToday && <Badge variant="secondary" className="text-xs">Hoy</Badge>}
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextDay} disabled={isToday}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isToday && (
                <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs">
                  Ir a hoy
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                <SelectTrigger className="w-[160px] h-8">
                  <SelectValue placeholder="Turno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin turno</SelectItem>
                  {shifts.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name} ({s.startTime}-{s.endTime})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Production Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Cargando sesión...</p>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_120px_100px_100px_48px] md:grid-cols-[1fr_150px_120px_120px_48px] items-center px-4 py-2 border-b bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>Producto</span>
              <span>Receta</span>
              <span className="text-right">Cantidad</span>
              <span className="text-right">Scrap</span>
              <span></span>
            </div>

            {/* Entries */}
            {session?.entries.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-[1fr_120px_100px_100px_48px] md:grid-cols-[1fr_150px_120px_120px_48px] items-center px-4 py-2 border-b hover:bg-muted/20 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{entry.product.name}</p>
                  <p className="text-xs text-muted-foreground">{entry.product.code} · {entry.product.unit}</p>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {entry.product.recipe?.name || '-'}
                </div>
                <div className="text-right">
                  {isReadOnly ? (
                    <span className="font-semibold" style={{ color: userColors.kpiPositive }}>
                      {Number(entry.quantity).toLocaleString()}
                    </span>
                  ) : (
                    <Input
                      type="number"
                      className="h-8 text-right text-sm w-full"
                      value={editValues[entry.id]?.quantity ?? ''}
                      onChange={(e) => handleValueChange(entry.id, 'quantity', e.target.value)}
                      min="0"
                      step="any"
                    />
                  )}
                </div>
                <div className="text-right">
                  {isReadOnly ? (
                    <span className={Number(entry.scrapQuantity) > 0 ? 'text-destructive' : 'text-muted-foreground'}>
                      {Number(entry.scrapQuantity) > 0 ? Number(entry.scrapQuantity).toLocaleString() : '-'}
                    </span>
                  ) : (
                    <Input
                      type="number"
                      className="h-8 text-right text-sm w-full"
                      value={editValues[entry.id]?.scrapQuantity ?? ''}
                      onChange={(e) => handleValueChange(entry.id, 'scrapQuantity', e.target.value)}
                      min="0"
                      step="any"
                    />
                  )}
                </div>
                <div className="flex justify-center">
                  {!isReadOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteEntry(entry.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {/* Add product row */}
            {!isReadOnly && (
              <div className="px-4 py-3 border-b">
                <Popover open={addProductOpen} onOpenChange={setAddProductOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                      <Plus className="h-4 w-4" />
                      Agregar producto
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar producto..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron productos.</CommandEmpty>
                        {availableProducts.length > 0 && (
                          <CommandGroup heading="Productos del sector">
                            {availableProducts.map(p => (
                              <CommandItem
                                key={p.id}
                                value={`${p.code} ${p.name}`}
                                onSelect={() => handleAddProduct(p.id)}
                                disabled={addingProduct}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{p.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {p.code} · {p.unit}
                                    {p.recipe && <> · {p.recipe.name}</>}
                                  </p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                        {allProducts.length > 0 && (
                          <CommandGroup heading="Todos los productos">
                            {allProducts
                              .filter(p => !session?.entries.some(e => e.productId === p.id))
                              .slice(0, 20)
                              .map(p => (
                                <CommandItem
                                  key={p.id}
                                  value={`all-${p.code} ${p.name}`}
                                  onSelect={() => handleAddProduct(p.id)}
                                  disabled={addingProduct}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm truncate">{p.name}</p>
                                    <p className="text-xs text-muted-foreground">{p.code}</p>
                                  </div>
                                </CommandItem>
                              ))
                            }
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Empty state */}
            {session?.entries.length === 0 && (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <h3 className="font-medium mb-1">Sin registros</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Agregá productos para cargar la producción del día
                </p>
              </div>
            )}

            {/* Footer totals */}
            {session && session.entries.length > 0 && (
              <div className="px-4 py-3 bg-muted/20 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Total producción:</span>
                    <span className="font-bold" style={{ color: userColors.kpiPositive }}>
                      {totals.quantity.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Scrap:</span>
                    <span className={cn('font-medium', totals.scrap > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                      {totals.scrap.toLocaleString()} ({totals.scrapPct}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Productos:</span>
                    <span className="font-medium">{totals.count}</span>
                  </div>
                </div>
                {!isReadOnly && (
                  <p className="text-xs text-muted-foreground">
                    Auto-guardado activo
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
