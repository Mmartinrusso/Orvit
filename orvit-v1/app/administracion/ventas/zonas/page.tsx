'use client';

/**
 * Zonas de Venta (Sales Territories) Page
 */

import { useState, useEffect } from 'react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Plus, Edit, Users, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface Zona {
  id: number;
  nombre: string;
  descripcion: string;
  vendedoresCount: number;
  clientesCount: number;
  ventasMes: number;
  isActive: boolean;
}

export default function ZonasPage() {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ nombre: '', descripcion: '', isActive: true });

  useEffect(() => {
    loadZonas();
  }, []);

  const loadZonas = async () => {
    try {
      const response = await fetch('/api/ventas/zonas', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setZonas(data.data || []);
      }
    } catch (error) {
      console.error('Error loading zonas:', error);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch('/api/ventas/zonas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error();

      toast.success('Zona creada');
      setDialogOpen(false);
      loadZonas();
    } catch (error) {
      toast.error('Error al crear zona');
    }
  };

  return (
    <PermissionGuard permission="ventas.config.edit">
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Zonas de Venta</h1>
            <p className="text-muted-foreground">Territorios comerciales</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Zona
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {zonas.map((zona) => (
            <Card key={zona.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  {zona.nombre}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{zona.descripcion}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1 text-muted-foreground text-sm">
                      <Users className="w-3 h-3" />
                      <span>Vendedores</span>
                    </div>
                    <div className="text-xl font-bold">{zona.vendedoresCount}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-muted-foreground text-sm">
                      <DollarSign className="w-3 h-3" />
                      <span>Ventas/Mes</span>
                    </div>
                    <div className="text-xl font-bold">{formatCurrency(zona.ventasMes)}</div>
                  </div>
                </div>
                <Badge variant={zona.isActive ? 'default' : 'secondary'}>
                  {zona.isActive ? 'Activa' : 'Inactiva'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Zona de Venta</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Zona Norte"
                />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="CABA, GBA Norte..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Crear Zona</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}
