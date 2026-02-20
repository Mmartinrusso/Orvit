'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogBody,
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
  Search,
  Link2,
  Unlink,
  Package,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

interface SupplierItem {
  id: number;
  nombre: string;
  codigoProveedor?: string;
  unidad: string;
  activo: boolean;
  stockLocations?: Array<{
    warehouseId: number;
    cantidad: number;
    cantidadReservada: number;
    warehouse: { id: number; nombre: string };
  }>;
}

interface InputItemLinkerProps {
  inputItemId: string;
  inputItemName: string;
  inputItemUnit: string;
  currentSupplierItemId?: number | null;
  currentSupplierItemName?: string | null;
  conversionFactor?: number;
  companyId: number;
  onLinked?: (supplierItem: SupplierItem | null) => void;
}

export function InputItemLinker({
  inputItemId,
  inputItemName,
  inputItemUnit,
  currentSupplierItemId,
  currentSupplierItemName,
  conversionFactor = 1,
  companyId,
  onLinked,
}: InputItemLinkerProps) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SupplierItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [factor, setFactor] = useState(conversionFactor);

  // Search supplier items
  const searchItems = useCallback(async () => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(
        `/api/compras/items?companyId=${companyId}&search=${encodeURIComponent(searchTerm)}&limit=20`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.items || data.data || []);
      }
    } catch (error) {
      console.error('Error searching items:', error);
    } finally {
      setSearching(false);
    }
  }, [companyId, searchTerm]);

  useEffect(() => {
    const timer = setTimeout(searchItems, 300);
    return () => clearTimeout(timer);
  }, [searchItems]);

  const handleLink = async (supplierItem: SupplierItem) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/production/input-items/${inputItemId}/link-supplier`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierItemId: supplierItem.id,
          conversionFactor: factor,
        }),
      });

      if (res.ok) {
        toast.success(`"${inputItemName}" vinculado a "${supplierItem.nombre}"`);
        onLinked?.(supplierItem);
        setOpen(false);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error al vincular');
      }
    } catch (error) {
      toast.error('Error al vincular');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    const ok = await confirm({
      title: 'Desvincular insumo',
      description: '¿Desvincular este insumo del item de inventario?',
      confirmText: 'Confirmar',
      variant: 'default',
    });
    if (!ok) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/production/input-items/${inputItemId}/link-supplier`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierItemId: null }),
      });

      if (res.ok) {
        toast.success('Vinculación eliminada');
        onLinked?.(null);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error al desvincular');
      }
    } catch (error) {
      toast.error('Error al desvincular');
    } finally {
      setSaving(false);
    }
  };

  const getTotalStock = (item: SupplierItem) => {
    if (!item.stockLocations) return 0;
    return item.stockLocations.reduce(
      (acc, loc) => acc + Number(loc.cantidad) - Number(loc.cantidadReservada || 0),
      0
    );
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {currentSupplierItemId ? (
          <>
            <Badge variant="outline" className="bg-success-muted text-success gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {currentSupplierItemName || `Item #${currentSupplierItemId}`}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-destructive"
              onClick={handleUnlink}
              disabled={saving}
            >
              <Unlink className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <Badge
            variant="outline"
            className="bg-warning-muted text-warning-muted-foreground gap-1 cursor-pointer hover:bg-warning-muted/80"
            onClick={() => setOpen(true)}
          >
            <AlertCircle className="h-3 w-3" />
            Sin vincular
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => setOpen(true)}
        >
          <Link2 className="h-3 w-3" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Vincular Insumo a Inventario
            </DialogTitle>
            <DialogDescription>
              Vincular &quot;{inputItemName}&quot; ({inputItemUnit}) a un item del inventario
              para consumo automático de stock.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {/* Search */}
            <div className="space-y-2">
              <Label>Buscar Item de Inventario</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>
            </div>

            {/* Conversion Factor */}
            <div className="space-y-2">
              <Label>Factor de Conversión</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={factor}
                  onChange={(e) => setFactor(parseFloat(e.target.value) || 1)}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">
                  1 {inputItemUnit} (receta) = {factor} unidad (inventario)
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Usa esto si las unidades de la receta difieren del inventario (ej: receta en kg, inventario en g → factor = 1000)
              </p>
            </div>

            {/* Results */}
            <div className="border rounded-lg max-h-[300px] overflow-y-auto">
              {searching ? (
                <p className="p-4 text-center text-muted-foreground">Buscando...</p>
              ) : searchResults.length === 0 ? (
                <p className="p-4 text-center text-muted-foreground">
                  {searchTerm.length >= 2
                    ? 'No se encontraron items'
                    : 'Escribe al menos 2 caracteres'}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead className="text-right">Stock Disp.</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((item) => {
                      const stock = getTotalStock(item);
                      const isLinked = item.id === currentSupplierItemId;

                      return (
                        <TableRow
                          key={item.id}
                          className={isLinked ? 'bg-success-muted' : ''}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.nombre}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.codigoProveedor}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{item.unidad}</TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                stock > 0 ? 'text-success' : 'text-muted-foreground'
                              }
                            >
                              {stock.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {isLinked ? (
                              <Badge className="bg-success-muted text-success">
                                Vinculado
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleLink(item)}
                                disabled={saving}
                              >
                                <Link2 className="h-3 w-3 mr-1" />
                                Vincular
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Bulk linker for recipe items - shows all inputs and their link status
 */
interface RecipeInputLinkerProps {
  recipeId: string;
  companyId: number;
  onAllLinked?: () => void;
}

export function RecipeInputLinker({
  recipeId,
  companyId,
  onAllLinked,
}: RecipeInputLinkerProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<
    Array<{
      id: string;
      inputId: string;
      quantity: number;
      unitLabel: string;
      input: {
        id: string;
        name: string;
        unitLabel: string;
        supplierItemId: number | null;
        supplierItem: { id: number; nombre: string } | null;
        conversionFactor: number;
      };
    }>
  >([]);

  const fetchRecipeItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/production/recipes/${recipeId}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.recipe?.items || []);
      }
    } catch (error) {
      console.error('Error fetching recipe items:', error);
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

  useEffect(() => {
    fetchRecipeItems();
  }, [fetchRecipeItems]);

  const linkedCount = items.filter((i) => i.input.supplierItemId).length;
  const allLinked = linkedCount === items.length && items.length > 0;

  useEffect(() => {
    if (allLinked) {
      onAllLinked?.();
    }
  }, [allLinked, onAllLinked]);

  if (loading) {
    return <div className="text-center py-4 text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Insumos de la Receta</h4>
        <Badge
          variant="outline"
          className={allLinked ? 'bg-success-muted text-success' : 'bg-warning-muted text-warning-muted-foreground'}
        >
          {linkedCount}/{items.length} vinculados
        </Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Insumo</TableHead>
            <TableHead>Cantidad</TableHead>
            <TableHead>Vinculación</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{item.input.name}</p>
                  <p className="text-xs text-muted-foreground">{item.input.unitLabel}</p>
                </div>
              </TableCell>
              <TableCell>
                {Number(item.quantity).toFixed(4)} {item.unitLabel}
              </TableCell>
              <TableCell>
                <InputItemLinker
                  inputItemId={item.input.id}
                  inputItemName={item.input.name}
                  inputItemUnit={item.input.unitLabel}
                  currentSupplierItemId={item.input.supplierItemId}
                  currentSupplierItemName={item.input.supplierItem?.nombre}
                  conversionFactor={Number(item.input.conversionFactor || 1)}
                  companyId={companyId}
                  onLinked={() => fetchRecipeItems()}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {!allLinked && (
        <div className="flex items-center gap-2 p-3 bg-warning-muted rounded-lg text-warning-muted-foreground text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>
            Vincula todos los insumos para habilitar el consumo automático de stock
          </span>
        </div>
      )}
    </div>
  );
}
