'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Wallet, Plus, Trash2, Save, Info, Calculator } from 'lucide-react';
import { toast } from 'sonner';

// =====================================================
// TYPES
// =====================================================

type CommissionType = 'FLAT' | 'TIERED' | 'BY_CATEGORY' | 'BY_PRODUCT' | 'MIXED';

interface CommissionTier {
  id: string;
  minAmount: number;
  maxAmount?: number;
  rate: number;
}

interface CategoryCommission {
  categoryId: number;
  categoryName: string;
  rate: number;
}

interface ProductCommission {
  productId: string;
  productName: string;
  rate: number;
}

interface CommissionConfig {
  type: CommissionType;
  defaultRate: number;
  tiers: CommissionTier[];
  byCategory: CategoryCommission[];
  byProduct: ProductCommission[];
  applyOnMargin: boolean; // If true, commission is on margin, not on total sale
  includeInCost: boolean; // If true, commission affects cost calculation
}

interface CommissionConfigProps {
  config: CommissionConfig | null;
  categories?: Array<{ id: number; name: string }>;
  onSave: (config: CommissionConfig) => Promise<void>;
}

// =====================================================
// DEFAULT CONFIG
// =====================================================

const DEFAULT_CONFIG: CommissionConfig = {
  type: 'FLAT',
  defaultRate: 0,
  tiers: [],
  byCategory: [],
  byProduct: [],
  applyOnMargin: false,
  includeInCost: false,
};

// =====================================================
// COMPONENT
// =====================================================

export function CommissionConfig({ config, categories = [], onSave }: CommissionConfigProps) {
  const [commissionConfig, setCommissionConfig] = useState<CommissionConfig>({
    ...DEFAULT_CONFIG,
    ...config,
  });
  const [saving, setSaving] = useState(false);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  // Tier form state
  const [tierForm, setTierForm] = useState({
    minAmount: '',
    maxAmount: '',
    rate: '',
  });

  // Category form state
  const [categoryForm, setCategoryForm] = useState({
    categoryId: '',
    rate: '',
  });

  const handleTypeChange = (type: CommissionType) => {
    setCommissionConfig(prev => ({ ...prev, type }));
  };

  const handleDefaultRateChange = (value: string) => {
    const rate = parseFloat(value) || 0;
    setCommissionConfig(prev => ({ ...prev, defaultRate: Math.min(100, Math.max(0, rate)) }));
  };

  // Tier Management
  const handleAddTier = () => {
    const minAmount = parseFloat(tierForm.minAmount);
    const rate = parseFloat(tierForm.rate);

    if (isNaN(minAmount) || minAmount < 0) {
      toast.error('Monto mínimo inválido');
      return;
    }

    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error('Comisión inválida (0-100%)');
      return;
    }

    const newTier: CommissionTier = {
      id: `tier_${Date.now()}`,
      minAmount,
      maxAmount: tierForm.maxAmount ? parseFloat(tierForm.maxAmount) : undefined,
      rate,
    };

    setCommissionConfig(prev => ({
      ...prev,
      tiers: [...prev.tiers, newTier].sort((a, b) => a.minAmount - b.minAmount),
    }));

    setTierForm({ minAmount: '', maxAmount: '', rate: '' });
    setTierDialogOpen(false);
    toast.success('Nivel agregado');
  };

  const handleRemoveTier = (id: string) => {
    setCommissionConfig(prev => ({
      ...prev,
      tiers: prev.tiers.filter(t => t.id !== id),
    }));
  };

  // Category Commission Management
  const handleAddCategory = () => {
    const categoryId = parseInt(categoryForm.categoryId);
    const rate = parseFloat(categoryForm.rate);

    if (!categoryForm.categoryId) {
      toast.error('Seleccione una categoría');
      return;
    }

    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error('Comisión inválida (0-100%)');
      return;
    }

    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    // Check if already exists
    if (commissionConfig.byCategory.some(c => c.categoryId === categoryId)) {
      toast.error('Esta categoría ya tiene comisión configurada');
      return;
    }

    const newCategoryCommission: CategoryCommission = {
      categoryId,
      categoryName: category.name,
      rate,
    };

    setCommissionConfig(prev => ({
      ...prev,
      byCategory: [...prev.byCategory, newCategoryCommission],
    }));

    setCategoryForm({ categoryId: '', rate: '' });
    setCategoryDialogOpen(false);
    toast.success('Comisión por categoría agregada');
  };

  const handleRemoveCategory = (categoryId: number) => {
    setCommissionConfig(prev => ({
      ...prev,
      byCategory: prev.byCategory.filter(c => c.categoryId !== categoryId),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(commissionConfig);
      toast.success('Configuración de comisiones guardada');
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
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            <CardTitle>Configuración de Comisiones</CardTitle>
          </div>
          <CardDescription>
            Define cómo se calculan las comisiones de los vendedores.
            Puedes usar comisión fija, escalonada, por categoría o una combinación.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Commission Type Selection */}
          <div className="space-y-4">
            <Label className="text-base">Tipo de Comisión</Label>
            <RadioGroup
              value={commissionConfig.type}
              onValueChange={(v) => handleTypeChange(v as CommissionType)}
              className="grid grid-cols-2 gap-4"
            >
              <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-muted">
                <RadioGroupItem value="FLAT" id="flat" />
                <Label htmlFor="flat" className="cursor-pointer flex-1">
                  <div className="font-medium">Comisión Fija</div>
                  <div className="text-sm text-muted-foreground">
                    Mismo porcentaje para todas las ventas
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-muted">
                <RadioGroupItem value="TIERED" id="tiered" />
                <Label htmlFor="tiered" className="cursor-pointer flex-1">
                  <div className="font-medium">Escalonada</div>
                  <div className="text-sm text-muted-foreground">
                    Mayor comisión a mayor monto vendido
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-muted">
                <RadioGroupItem value="BY_CATEGORY" id="by_category" />
                <Label htmlFor="by_category" className="cursor-pointer flex-1">
                  <div className="font-medium">Por Categoría</div>
                  <div className="text-sm text-muted-foreground">
                    Diferentes tasas según el rubro del producto
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-muted">
                <RadioGroupItem value="MIXED" id="mixed" />
                <Label htmlFor="mixed" className="cursor-pointer flex-1">
                  <div className="font-medium">Mixta</div>
                  <div className="text-sm text-muted-foreground">
                    Combina múltiples reglas de comisión
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Tabs defaultValue="general" className="w-full">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              {(commissionConfig.type === 'TIERED' || commissionConfig.type === 'MIXED') && (
                <TabsTrigger value="tiers">Niveles</TabsTrigger>
              )}
              {(commissionConfig.type === 'BY_CATEGORY' || commissionConfig.type === 'MIXED') && (
                <TabsTrigger value="categories">Por Categoría</TabsTrigger>
              )}
              <TabsTrigger value="options">Opciones</TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultRate">Comisión Base (%)</Label>
                  <Input
                    id="defaultRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={commissionConfig.defaultRate}
                    onChange={(e) => handleDefaultRateChange(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se usa cuando no aplica otra regla específica
                  </p>
                </div>
              </div>

              {/* Quick Calculator */}
              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="w-4 h-4" />
                  <span className="font-medium text-sm">Calculadora rápida</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Venta de {formatCurrency(100000)} → Comisión: {formatCurrency(100000 * (commissionConfig.defaultRate / 100))} ({commissionConfig.defaultRate}%)
                </p>
              </div>
            </TabsContent>

            {/* Tiers Tab */}
            <TabsContent value="tiers" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Define niveles de comisión según el monto de la venta
                </p>
                <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Nivel
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nuevo Nivel de Comisión</DialogTitle>
                      <DialogDescription>
                        Define el rango de ventas y la comisión correspondiente
                      </DialogDescription>
                    </DialogHeader>
                    <DialogBody className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Monto Mínimo ($)</Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={tierForm.minAmount}
                            onChange={(e) => setTierForm(prev => ({ ...prev, minAmount: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Monto Máximo ($)</Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="Sin límite"
                            value={tierForm.maxAmount}
                            onChange={(e) => setTierForm(prev => ({ ...prev, maxAmount: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Comisión (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          placeholder="5"
                          value={tierForm.rate}
                          onChange={(e) => setTierForm(prev => ({ ...prev, rate: e.target.value }))}
                        />
                      </div>
                    </DialogBody>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setTierDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleAddTier}>Agregar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Monto Mínimo</TableHead>
                    <TableHead>Monto Máximo</TableHead>
                    <TableHead>Comisión</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissionConfig.tiers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No hay niveles configurados
                      </TableCell>
                    </TableRow>
                  ) : (
                    commissionConfig.tiers.map((tier) => (
                      <TableRow key={tier.id}>
                        <TableCell>{formatCurrency(tier.minAmount)}</TableCell>
                        <TableCell>
                          {tier.maxAmount ? formatCurrency(tier.maxAmount) : 'Sin límite'}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-info-muted text-info-muted-foreground">
                            {tier.rate}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleRemoveTier(tier.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Categories Tab */}
            <TabsContent value="categories" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Define comisiones específicas por categoría de producto
                </p>
                <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Categoría
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Comisión por Categoría</DialogTitle>
                      <DialogDescription>
                        Define la comisión para una categoría específica
                      </DialogDescription>
                    </DialogHeader>
                    <DialogBody className="space-y-4">
                      <div className="space-y-2">
                        <Label>Categoría</Label>
                        <Select
                          value={categoryForm.categoryId}
                          onValueChange={(v) => setCategoryForm(prev => ({ ...prev, categoryId: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar categoría" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories
                              .filter(c => !commissionConfig.byCategory.some(bc => bc.categoryId === c.id))
                              .map((cat) => (
                                <SelectItem key={cat.id} value={cat.id.toString()}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Comisión (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          placeholder="5"
                          value={categoryForm.rate}
                          onChange={(e) => setCategoryForm(prev => ({ ...prev, rate: e.target.value }))}
                        />
                      </div>
                    </DialogBody>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleAddCategory}>Agregar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Comisión</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissionConfig.byCategory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No hay comisiones por categoría configuradas
                      </TableCell>
                    </TableRow>
                  ) : (
                    commissionConfig.byCategory.map((cat) => (
                      <TableRow key={cat.categoryId}>
                        <TableCell className="font-medium">{cat.categoryName}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {cat.rate}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleRemoveCategory(cat.categoryId)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Options Tab */}
            <TabsContent value="options" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base">Calcular sobre Margen</Label>
                    <p className="text-sm text-muted-foreground">
                      Si está activo, la comisión se calcula sobre el margen de ganancia, no sobre el total de la venta
                    </p>
                  </div>
                  <Switch
                    checked={commissionConfig.applyOnMargin}
                    onCheckedChange={(checked) =>
                      setCommissionConfig(prev => ({ ...prev, applyOnMargin: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base">Incluir en Cálculo de Costos</Label>
                    <p className="text-sm text-muted-foreground">
                      Si está activo, las comisiones se incluyen como costo en los reportes de rentabilidad
                    </p>
                  </div>
                  <Switch
                    checked={commissionConfig.includeInCost}
                    onCheckedChange={(checked) =>
                      setCommissionConfig(prev => ({ ...prev, includeInCost: checked }))
                    }
                  />
                </div>
              </div>

              <div className="bg-info-muted border border-info-muted rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-info-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-foreground">
                    <p className="font-medium">Ejemplo de cálculo</p>
                    <ul className="mt-2 space-y-1 text-foreground">
                      <li>• Venta: $100,000 | Costo: $70,000 | Margen: $30,000</li>
                      <li>
                        • Comisión ({commissionConfig.defaultRate}%) sobre{' '}
                        {commissionConfig.applyOnMargin ? 'margen' : 'venta'}:{' '}
                        {formatCurrency(
                          (commissionConfig.applyOnMargin ? 30000 : 100000) *
                            (commissionConfig.defaultRate / 100)
                        )}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
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
