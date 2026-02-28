'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Loader2 } from 'lucide-react';
import type { RoleData } from '@/hooks/use-permissions-data';

interface CloneRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceRoleName: string | null;
  sourceRoleData: RoleData | null;
  isCloning: boolean;
  onClone: (newName: string, newDisplayName: string, newDescription: string) => void;
}

export default function CloneRoleDialog({
  open,
  onOpenChange,
  sourceRoleName,
  sourceRoleData,
  isCloning,
  onClone,
}: CloneRoleDialogProps) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');

  // Reset form when dialog opens with new role
  useEffect(() => {
    if (open && sourceRoleData) {
      setName(`${sourceRoleData.name}_copia`);
      setDisplayName(`${sourceRoleData.displayName} (Copia)`);
      setDescription(sourceRoleData.description || '');
    }
  }, [open, sourceRoleData]);

  const handleClose = () => {
    onOpenChange(false);
    setName('');
    setDisplayName('');
    setDescription('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Clonar Rol
          </DialogTitle>
          <DialogDescription>
            Se crear&aacute; un nuevo rol con los mismos permisos que &quot;{sourceRoleData?.displayName}&quot;
            ({sourceRoleData?.permissions.length || 0} permisos)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="clone-name">Nombre interno</Label>
            <Input
              id="clone-name"
              placeholder="nombre_rol"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
            />
            <p className="text-xs text-muted-foreground">
              Identificador &uacute;nico del rol (sin espacios)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clone-displayName">Nombre de visualizaci&oacute;n</Label>
            <Input
              id="clone-displayName"
              placeholder="Nombre del Rol"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clone-description">Descripci&oacute;n</Label>
            <Textarea
              id="clone-description"
              placeholder="Descripción del rol..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCloning}>
            Cancelar
          </Button>
          <Button
            onClick={() => onClone(name, displayName, description)}
            disabled={isCloning || !name || !displayName}
          >
            {isCloning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Clonando...
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Clonar Rol
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
