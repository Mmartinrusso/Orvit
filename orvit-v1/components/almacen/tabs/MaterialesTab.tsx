'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SkeletonTable } from '@/components/ui/skeleton-table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, RefreshCw, FlaskConical, Package } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { MaterialDetailSheet } from '../sheets/MaterialDetailSheet';
import { cn } from '@/lib/utils';

interface SupplyItem {
  id: number;
  code?: string;
  name: string;
  unitMeasure: string;
  supplierId?: number;
  supplierName?: string;
  categoryId?: number;
  categoryName?: string;
  categoryColor?: string;
  isActive: boolean;
  hasFicha: boolean;
}

interface Category {
  id: number;
  name: string;
  color?: string;
}

export function MaterialesTab() {
  const { currentCompany } = useCompany();

  const [supplies, setSupplies] = useState<SupplyItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [localSearch, setLocalSearch] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedSupplyId, setSelectedSupplyId] = useState<number | null>(null);

  const fetchSupplies = useCallback(async () => {
    if (!currentCompany?.id) return;
    setIsLoading(true);
    try {
      const [suppliesRes, categoriesRes] = await Promise.all([
        fetch(`/api/insumos/insumos?companyId=${currentCompany.id}`),
        fetch(`/api/almacen/supply-categories?companyId=${currentCompany.id}`).catch(() => ({ ok: false, json: async () => ({ categories: [] }) })),
      ]);

      const suppliesData = await suppliesRes.json();
      const rawItems: any[] = Array.isArray(suppliesData) ? suppliesData : suppliesData.supplies ?? suppliesData.data ?? [];

      // Fetch ficha status for all supplies in batch via API list (or derive from data)
      // The insumos list endpoint returns items; we check if technicalSheet exists via a separate endpoint
      // For performance, we batch-check by fetching all technical sheets for this company
      const fichaTecnicaRes = await fetch(`/api/insumos/insumos/ficha-tecnica-status?companyId=${currentCompany.id}`).catch(() => null);
      let fichaTecnicaIds = new Set<number>();
      if (fichaTecnicaRes?.ok) {
        const fd = await fichaTecnicaRes.json();
        fichaTecnicaIds = new Set(fd.supplyIds ?? []);
      }

      setSupplies(
        rawItems.map((s: any) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          unitMeasure: s.unitMeasure ?? s.unit_measure,
          supplierId: s.supplierId ?? s.supplier_id,
          supplierName: s.supplierName,
          categoryId: s.categoryId,
          categoryName: s.categoryName,
          categoryColor: s.categoryColor,
          isActive: s.isActive ?? s.is_active ?? true,
          hasFicha: fichaTecnicaIds.has(s.id),
        }))
      );

      if (categoriesRes.ok) {
        const catData = await (categoriesRes as Response).json();
        setCategories(catData.categories ?? []);
      }
    } catch (err) {
      console.error('Error cargando materiales:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    fetchSupplies();
  }, [fetchSupplies]);

  const handleSearch = useCallback(() => {
    setSearch(localSearch);
  }, [localSearch]);

  const filtered = supplies.filter((s) => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.code ?? '').toLowerCase().includes(search.toLowerCase());
    const matchCategory =
      selectedCategoryId === 'all' || String(s.categoryId) === selectedCategoryId;
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar insumo..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-8 h-9"
          />
        </div>

        {categories.length > 0 && (
          <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  <span className="flex items-center gap-2">
                    {c.color && (
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                    )}
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={fetchSupplies}
          title="Actualizar"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>

        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} insumo{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm font-medium">Sin insumos</p>
          <p className="text-xs mt-1">
            {search ? 'No hay resultados para tu búsqueda' : 'No hay insumos registrados'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs w-28">Código</TableHead>
                  <TableHead className="text-xs">Nombre</TableHead>
                  <TableHead className="text-xs w-20">Unidad</TableHead>
                  <TableHead className="text-xs w-36">Categoría</TableHead>
                  <TableHead className="text-xs w-40">Proveedor</TableHead>
                  <TableHead className="text-xs w-32 text-center">Ficha Técnica</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((supply) => (
                  <TableRow
                    key={supply.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => setSelectedSupplyId(supply.id)}
                  >
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {supply.code ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {supply.name}
                        {!supply.isActive && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            Inactivo
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{supply.unitMeasure}</TableCell>
                    <TableCell>
                      {supply.categoryName ? (
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={
                            supply.categoryColor
                              ? {
                                  color: supply.categoryColor,
                                  borderColor: `${supply.categoryColor}50`,
                                  backgroundColor: `${supply.categoryColor}10`,
                                }
                              : undefined
                          }
                        >
                          {supply.categoryName}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {supply.supplierName ?? '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {supply.hasFicha ? (
                        <Badge className="text-xs bg-success-muted text-success-muted-foreground border-success-muted gap-1">
                          <FlaskConical className="h-3 w-3" />
                          Completa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                          <FlaskConical className="h-3 w-3" />
                          Pendiente
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {filtered.map((supply) => (
              <div
                key={supply.id}
                className={cn(
                  'p-3 rounded-lg border cursor-pointer hover:bg-muted/40 transition-colors',
                  'flex items-center justify-between gap-3'
                )}
                onClick={() => setSelectedSupplyId(supply.id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{supply.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {supply.code && (
                      <span className="text-xs font-mono text-muted-foreground">{supply.code}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{supply.unitMeasure}</span>
                    {supply.categoryName && (
                      <span className="text-xs text-muted-foreground">{supply.categoryName}</span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {supply.hasFicha ? (
                    <Badge className="text-[10px] bg-success-muted text-success-muted-foreground border-success-muted gap-1">
                      <FlaskConical className="h-2.5 w-2.5" />
                      Completa
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
                      <FlaskConical className="h-2.5 w-2.5" />
                      Pendiente
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Sheet de detalle */}
      <MaterialDetailSheet
        supplyId={selectedSupplyId}
        onClose={() => setSelectedSupplyId(null)}
        onFichaSaved={fetchSupplies}
      />
    </div>
  );
}
