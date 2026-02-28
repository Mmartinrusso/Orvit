'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';

interface CreateRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCreating: boolean;
  sectors: any[];
  loadingSectors: boolean;
  onFetchSectors: () => void;
  onCreate: (data: { name: string; displayName: string; description: string; sectorId: number | null }) => void;
}

export default function CreateRoleDialog({
  open,
  onOpenChange,
  isCreating,
  sectors,
  loadingSectors,
  onFetchSectors,
  onCreate,
}: CreateRoleDialogProps) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [sectorId, setSectorId] = useState<number | null>(null);

  const isSupervisor = name.toLowerCase() === 'supervisor' || displayName.toLowerCase() === 'supervisor';

  // Load sectors when "supervisor" is typed
  useEffect(() => {
    if (isSupervisor && open && sectors.length === 0 && !loadingSectors) {
      onFetchSectors();
    }
  }, [isSupervisor, open, sectors.length, loadingSectors, onFetchSectors]);

  const handleClose = () => {
    onOpenChange(false);
    setName('');
    setDisplayName('');
    setDescription('');
    setSectorId(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear nuevo rol</DialogTitle>
          <DialogDescription>
            Ingresa los datos para el nuevo rol personalizado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="role-name">Nombre interno</Label>
            <Input
              id="role-name"
              placeholder="Ej: supervisor, auditor"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-display">Nombre visible</Label>
            <Input
              id="role-display"
              placeholder="Ej: Supervisor, Auditor"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-description">Descripci&oacute;n</Label>
            <Textarea
              id="role-description"
              placeholder="Descripción del rol"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {isSupervisor && (
            <div className="space-y-2">
              <Label htmlFor="role-sector">Sector (Opcional)</Label>
              <Select
                value={sectorId?.toString() || 'none'}
                onValueChange={(value) => setSectorId(value === 'none' ? null : parseInt(value))}
              >
                <SelectTrigger id="role-sector">
                  <SelectValue placeholder="Selecciona un sector" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin sector</SelectItem>
                  {loadingSectors ? (
                    <SelectItem value="loading" disabled>Cargando sectores...</SelectItem>
                  ) : sectors.length > 0 ? (
                    sectors.map((sector) => (
                      <SelectItem key={sector.id} value={sector.id.toString()}>
                        {sector.name} {sector.area?.name ? `(${sector.area.name})` : ''}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-sectors" disabled>No hay sectores disponibles</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {!loadingSectors && sectors.length === 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  No se encontraron sectores. Verifica que existan sectores en la empresa.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => onCreate({ name, displayName, description, sectorId })}
            disabled={isCreating || !name || !displayName}
          >
            {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Crear Rol
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
