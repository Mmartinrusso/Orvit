'use client';

import { useState } from 'react';
import { Sector } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Factory, MapPin, Activity, Pencil, Trash2, Wrench } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { LogoUpload } from '@/components/ui/LogoUpload';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { SectorToolsDialog } from './SectorToolsDialog';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

interface SectorCardProps {
  sector: Sector;
  onSelect: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

// Función para formatear el estado del sector según los requerimientos del usuario
const formatSectorStatus = (estado: string | null | undefined): string => {
  if (!estado) return 'Activo'; // Si no tiene estado definido, está activo (no parada)
  
  switch (estado.toUpperCase()) {
    case 'ACTIVO':
      return 'Activo';
    case 'INACTIVO':
      return 'Parada';
    default:
      return 'Activo'; // Por defecto está activo
  }
};

// Función para convertir el estado formateado de vuelta al valor de la base de datos
const parseFormattedStatus = (formattedStatus: string): string | null => {
  switch (formattedStatus) {
    case 'Activo':
      return 'ACTIVO';
    case 'Parada':
      return 'INACTIVO';
    default:
      return 'ACTIVO';
  }
};

export default function SectorCard({ sector, onSelect, canEdit = true, canDelete = true }: SectorCardProps) {
  const { updateSectors, setSector, currentArea } = useCompany();
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isToolsDialogOpen, setIsToolsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editData, setEditData] = useState({
    name: sector.name,
    description: sector.description || '',
    imageUrl: (sector as any).imageUrl || '',
    enabledForProduction: (sector as any).enabledForProduction || false,
  });

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar que se active el onClick del Card
    setIsLoading(true);
    try {
      const response = await fetch(`/api/sectores/${sector.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Error al eliminar el sector');
      
      // Actualizar la lista de sectores eliminando el sector
      updateSectors({ ...sector, _delete: true });
      toast({
        title: 'Sector eliminado',
        description: 'El sector ha sido eliminado correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el sector',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch(`/api/sectores/${sector.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });
      if (!response.ok) throw new Error('Error al actualizar el sector');
      
      const updatedSector = await response.json();
      // Actualizar la lista de sectores con el sector actualizado
      updateSectors(updatedSector);
      toast({
        title: 'Sector actualizado',
        description: 'El sector ha sido actualizado correctamente',
      });
      setIsEditDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el sector',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleImageUploaded = (url: string) => {
    setEditData(prev => ({ ...prev, imageUrl: url }));
  };
  
  const handleImageRemoved = () => {
    setEditData(prev => ({ ...prev, imageUrl: '' }));
  };

  const handleSelect = () => {
    setSector(sector);
    
    if (onSelect) {
      onSelect();
    } else {
      // Fallback si no hay onSelect
      if (currentArea?.name.trim().toUpperCase() === 'MANTENIMIENTO') {
        router.push('/mantenimiento/dashboard');
      } else {
        router.push('/areas');
      }
    }
  };

  return (
    <>
      <div 
        className="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col"
        onClick={handleSelect}
      >
        {/* Badge de Producción */}
        {(sector as any).enabledForProduction && (
          <div className="absolute top-3 left-3 z-10">
            <Badge className="bg-blue-500 text-white hover:bg-blue-600 text-xs">
              <Factory className="h-3 w-3 mr-1" />
              Producción
            </Badge>
          </div>
        )}

        {/* Imagen grande arriba */}
        <div className="relative w-full h-48 bg-primary/5 overflow-hidden">
          {(sector as any).imageUrl ? (
            <img 
              src={(sector as any).imageUrl} 
              alt={sector.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
              <Factory className="h-16 w-16 text-primary/40" />
            </div>
          )}
          
          {/* Acciones que aparecen al hover sobre la imagen */}
          {(canEdit || canDelete) && (
            <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {canEdit && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 bg-background/90 backdrop-blur-sm hover:bg-background"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditDialogOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 bg-background/90 backdrop-blur-sm hover:bg-background"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsToolsDialogOpen(true);
                }}
              >
                <Wrench className="h-4 w-4" />
              </Button>
              {canDelete && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 bg-background/90 backdrop-blur-sm hover:bg-background text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
        
        {/* Contenido abajo */}
        <div className="p-4 flex flex-col items-center text-center">
          <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors mb-1">
            {sector.name}
          </h3>
          {sector.description && (
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
              {sector.description}
            </p>
          )}
          <Button 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={(e) => {
              e.stopPropagation();
              handleSelect();
            }}
          >
            Ingresar
          </Button>
        </div>
      </div>

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el sector
              &quot;{sector.name}&quot; y toda su información asociada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de edición */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Editar Sector</DialogTitle>
            <DialogDescription>
              Modifica la información del sector.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del sector</Label>
              <Input
                id="name"
                value={editData.name}
                onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                value={editData.description}
                onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                disabled={isLoading}
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="enabledForProduction" className="text-sm font-medium flex items-center gap-2">
                  <Factory className="h-4 w-4 text-blue-500" />
                  Habilitar para Producción
                </Label>
                <p className="text-xs text-muted-foreground">
                  Permite acceder a este sector desde el área de Producción
                </p>
              </div>
              <Switch
                id="enabledForProduction"
                checked={editData.enabledForProduction}
                onCheckedChange={(checked) => setEditData(prev => ({ ...prev, enabledForProduction: checked }))}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <LogoUpload
                entityType="sector"
                entityId={sector.id.toString()}
                currentLogo={editData.imageUrl || undefined}
                onLogoUploaded={handleImageUploaded}
                onLogoRemoved={handleImageRemoved}
                title="Foto de perfil del sector"
                description="Sube una foto para identificar este sector"
                disabled={isLoading}
                className="w-full"
              />
            </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditDialogOpen(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isLoading}>
                {isLoading ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para gestionar herramientas del sector */}
      <SectorToolsDialog
        isOpen={isToolsDialogOpen}
        onClose={() => setIsToolsDialogOpen(false)}
        sectorId={Number(sector.id)}
        companyId={Number(sector.companyId)}
      />
    </>
  );
}