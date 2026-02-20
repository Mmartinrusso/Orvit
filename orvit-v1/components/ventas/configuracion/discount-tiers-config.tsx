'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Percent, Plus, Trash2, Save, ArrowUpDown, Info } from 'lucide-react';
import { toast } from 'sonner';

// =====================================================
// TYPES
// =====================================================

interface DiscountTier {
  id: string;
  minAmount: number;
  maxAmount?: number;
  discountPercent: number;
  discountFixed?: number;
  description?: string;
}

interface DiscountTiersConfigProps {
  config: {
    discountTiers?: DiscountTier[];
    discountTiersEnabled?: boolean;
  };
  onSave: (updates: { discountTiers: DiscountTier[]; discountTiersEnabled: boolean }) => Promise<void>;
}

// =====================================================
// COMPONENT
// =====================================================

export function DiscountTiersConfig({ config, onSave }: DiscountTiersConfigProps) {
  const [enabled, setEnabled] = useState(config?.discountTiersEnabled ?? false);
  const [tiers, setTiers] = useState<DiscountTier[]>(
    config?.discountTiers || []
  );
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<DiscountTier | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    minAmount: '',
    maxAmount: '',
    discountPercent: '',
    discountFixed: '',
    description: '',
  });

  const resetForm = () => {
    setFormData({
      minAmount: '',
      maxAmount: '',
      discountPercent: '',
      discountFixed: '',
      description: '',
    });
    setEditingTier(null);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (tier: DiscountTier) => {
    setEditingTier(tier);
    setFormData({
      minAmount: tier.minAmount.toString(),
      maxAmount: tier.maxAmount?.toString() || '',
      discountPercent: tier.discountPercent.toString(),
      discountFixed: tier.discountFixed?.toString() || '',
      description: tier.description || '',
    });
    setDialogOpen(true);
  };

  const handleSaveTier = () => {
    const minAmount = parseFloat(formData.minAmount);
    const discountPercent = parseFloat(formData.discountPercent);

    if (isNaN(minAmount) || minAmount < 0) {
      toast.error('Monto mínimo inválido');
      return;
    }

    if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      toast.error('Descuento inválido (0-100%)');
      return;
    }

    const newTier: DiscountTier = {
      id: editingTier?.id || `tier_${Date.now()}`,
      minAmount,
      maxAmount: formData.maxAmount ? parseFloat(formData.maxAmount) : undefined,
      discountPercent,
      discountFixed: formData.discountFixed ? parseFloat(formData.discountFixed) : undefined,
      description: formData.description || undefined,
    };

    if (editingTier) {
      setTiers(prev => prev.map(t => t.id === editingTier.id ? newTier : t));
    } else {
      setTiers(prev => [...prev, newTier].sort((a, b) => a.minAmount - b.minAmount));
    }

    setDialogOpen(false);
    resetForm();
    toast.success(editingTier ? 'Nivel actualizado' : 'Nivel agregado');
  };

  const handleDeleteTier = (id: string) => {
    setTiers(prev => prev.filter(t => t.id !== id));
    toast.success('Nivel eliminado');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Sort tiers by minAmount
      const sortedTiers = [...tiers].sort((a, b) => a.minAmount - b.minAmount);
      await onSave({ discountTiers: sortedTiers, discountTiersEnabled: enabled });
      toast.success('Configuración guardada');
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="w-5 h-5" />
              <CardTitle>Descuentos Escalonados por Volumen</CardTitle>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
          <CardDescription>
            Define descuentos automáticos basados en el monto total de la compra.
            Los descuentos se aplican automáticamente al crear cotizaciones y órdenes.
          </CardDescription>
        </CardHeader>

        {enabled && (
          <CardContent className="space-y-4">
            {/* Info Box */}
            <div className="bg-info-muted border border-info-muted rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-info-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="text-sm text-foreground">
                  <p className="font-medium">¿Cómo funcionan los descuentos escalonados?</p>
                  <ul className="mt-2 space-y-1 text-foreground">
                    <li>• Se aplica el descuento del nivel más alto alcanzado</li>
                    <li>• Ejemplo: Si el total es $75,000 y hay niveles en $50,000 (5%) y $100,000 (8%), se aplica 5%</li>
                    <li>• Los descuentos se pueden combinar con descuentos manuales (según configuración)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Tiers Table */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Monto Mínimo</TableHead>
                    <TableHead className="w-[180px]">Monto Máximo</TableHead>
                    <TableHead className="w-[120px]">Descuento %</TableHead>
                    <TableHead className="w-[120px]">Descuento $</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No hay niveles de descuento configurados
                      </TableCell>
                    </TableRow>
                  ) : (
                    tiers.map((tier, index) => (
                      <TableRow key={tier.id}>
                        <TableCell className="font-medium">
                          {formatCurrency(tier.minAmount)}
                        </TableCell>
                        <TableCell>
                          {tier.maxAmount ? formatCurrency(tier.maxAmount) : 'Sin límite'}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-success-muted text-success">
                            {tier.discountPercent}%
                          </span>
                        </TableCell>
                        <TableCell>
                          {tier.discountFixed ? formatCurrency(tier.discountFixed) : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tier.description || `Nivel ${index + 1}`}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(tier)}
                            >
                              <ArrowUpDown className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar nivel?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción eliminará el nivel de descuento para montos desde {formatCurrency(tier.minAmount)}.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteTier(tier.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Add Button */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={openAddDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Nivel
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingTier ? 'Editar Nivel de Descuento' : 'Nuevo Nivel de Descuento'}
                  </DialogTitle>
                  <DialogDescription>
                    Define el rango de montos y el descuento a aplicar.
                  </DialogDescription>
                </DialogHeader>

                <DialogBody className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="minAmount">Monto Mínimo ($) *</Label>
                      <Input
                        id="minAmount"
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="10000"
                        value={formData.minAmount}
                        onChange={(e) => setFormData(prev => ({ ...prev, minAmount: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxAmount">Monto Máximo ($)</Label>
                      <Input
                        id="maxAmount"
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="Sin límite"
                        value={formData.maxAmount}
                        onChange={(e) => setFormData(prev => ({ ...prev, maxAmount: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="discountPercent">Descuento (%) *</Label>
                      <Input
                        id="discountPercent"
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        placeholder="5"
                        value={formData.discountPercent}
                        onChange={(e) => setFormData(prev => ({ ...prev, discountPercent: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="discountFixed">Descuento Fijo ($)</Label>
                      <Input
                        id="discountFixed"
                        type="number"
                        min="0"
                        step="100"
                        placeholder="Opcional"
                        value={formData.discountFixed}
                        onChange={(e) => setFormData(prev => ({ ...prev, discountFixed: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción (opcional)</Label>
                    <Input
                      id="description"
                      placeholder="Ej: Descuento Mayorista"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </DialogBody>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveTier}>
                    {editingTier ? 'Actualizar' : 'Agregar'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Example Calculation */}
            {tiers.length > 0 && (
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Ejemplo de cálculo:</p>
                <p className="text-sm text-muted-foreground">
                  Compra de $75,000 → Se aplica {
                    tiers
                      .filter(t => t.minAmount <= 75000)
                      .sort((a, b) => b.minAmount - a.minAmount)[0]?.discountPercent || 0
                  }% de descuento = {formatCurrency(75000 * (1 - (
                    tiers
                      .filter(t => t.minAmount <= 75000)
                      .sort((a, b) => b.minAmount - a.minAmount)[0]?.discountPercent || 0
                  ) / 100))}
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </div>
    </div>
  );
}
