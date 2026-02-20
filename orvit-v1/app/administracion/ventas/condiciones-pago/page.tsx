'use client';

/**
 * Condiciones de Pago (Payment Terms) Master
 *
 * Complete payment terms management:
 * - Standard terms (Net 30, Net 60, etc.)
 * - Custom terms per client
 * - Due date calculation
 * - Early payment discounts
 */

import { useState, useEffect } from 'react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Calendar, Plus, Edit, Percent, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface CondicionPago {
  id: number;
  nombre: string;
  dias: number;
  descuentoProntoPago: number;
  diasDescuento: number;
  isActive: boolean;
}

export default function CondicionesPagoPage() {
  const [condiciones, setCondiciones] = useState<CondicionPago[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    dias: '30',
    descuentoProntoPago: '0',
    diasDescuento: '0',
    isActive: true,
  });

  useEffect(() => {
    loadCondiciones();
  }, []);

  const loadCondiciones = async () => {
    try {
      const response = await fetch('/api/ventas/condiciones-pago', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setCondiciones(data.data || []);
      }
    } catch (error) {
      console.error('Error loading condiciones:', error);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch('/api/ventas/condiciones-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nombre: formData.nombre,
          dias: parseInt(formData.dias),
          descuentoProntoPago: parseFloat(formData.descuentoProntoPago),
          diasDescuento: parseInt(formData.diasDescuento),
          isActive: formData.isActive,
        }),
      });

      if (!response.ok) throw new Error();

      toast.success('Condición creada');
      setDialogOpen(false);
      loadCondiciones();
    } catch (error) {
      toast.error('Error al crear condición');
    }
  };

  return (
    <PermissionGuard permission="ventas.config.edit">
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Condiciones de Pago</h1>
            <p className="text-muted-foreground">Términos de pago para clientes</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Condición
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {condiciones.map((condicion) => (
            <Card key={condicion.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-info-muted-foreground" />
                  {condicion.nombre}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1 text-muted-foreground text-sm">
                      <Clock className="w-3 h-3" />
                      <span>Plazo</span>
                    </div>
                    <div className="text-2xl font-bold">{condicion.dias}</div>
                    <div className="text-xs text-muted-foreground">días</div>
                  </div>
                  {condicion.descuentoProntoPago > 0 && (
                    <div>
                      <div className="flex items-center gap-1 text-muted-foreground text-sm">
                        <Percent className="w-3 h-3" />
                        <span>Descuento PP</span>
                      </div>
                      <div className="text-2xl font-bold">{condicion.descuentoProntoPago}%</div>
                      <div className="text-xs text-muted-foreground">
                        en {condicion.diasDescuento} días
                      </div>
                    </div>
                  )}
                </div>
                <Badge variant={condicion.isActive ? 'default' : 'secondary'}>
                  {condicion.isActive ? 'Activa' : 'Inactiva'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Condición de Pago</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Net 30, Contado, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Días de Plazo</Label>
                <Input
                  type="number"
                  value={formData.dias}
                  onChange={(e) => setFormData({ ...formData, dias: e.target.value })}
                  placeholder="30"
                />
              </div>
              <div className="space-y-2">
                <Label>Descuento Pronto Pago (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.descuentoProntoPago}
                  onChange={(e) => setFormData({ ...formData, descuentoProntoPago: e.target.value })}
                  placeholder="2.0"
                />
              </div>
              <div className="space-y-2">
                <Label>Días para Descuento</Label>
                <Input
                  type="number"
                  value={formData.diasDescuento}
                  onChange={(e) => setFormData({ ...formData, diasDescuento: e.target.value })}
                  placeholder="10"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Crear Condición</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}
