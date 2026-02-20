'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogBody,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Loader2 } from 'lucide-react';
import { LogoUpload } from '@/components/ui/LogoUpload';

const sectorSchema = z.object({
  name: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres' }),
  description: z.string().optional(),
  imageUrl: z.string().optional()
});

type SectorFormValues = z.infer<typeof sectorSchema>;

interface AddSectorDialogProps {
  children: React.ReactNode;
}

export default function AddSectorDialog({ children }: AddSectorDialogProps) {
  const { currentCompany, currentArea, isLoading, setSector, updateSectors } = useCompany();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const form = useForm<SectorFormValues>({
    resolver: zodResolver(sectorSchema),
    defaultValues: {
      name: '',
      description: '',
      imageUrl: ''
    },
  });
  
  const [imageUrl, setImageUrl] = useState<string>('');

  const onSubmit = async (data: SectorFormValues) => {
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/sectores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...data, 
          imageUrl: imageUrl || undefined,
          areaId: currentArea?.id
        }),
      });
      const sector = await response.json();
      if (!response.ok) throw new Error(sector.error || 'Error al crear sector');
      updateSectors(sector);
      setSector(sector);
      setIsOpen(false);
      form.reset();
      setImageUrl('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || !currentCompany || !currentArea) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Crear nuevo sector</DialogTitle>
          <DialogDescription>
            Complete los datos para registrar un nuevo sector.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del sector</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ej: Producción, Ensamblaje, Almacén..." disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Descripción del sector..." disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="space-y-2">
              <LogoUpload
                entityType="sector"
                entityId="temp"
                currentLogo={imageUrl || undefined}
                onLogoUploaded={(url) => {
                  setImageUrl(url);
                  form.setValue('imageUrl', url);
                }}
                onLogoRemoved={() => {
                  setImageUrl('');
                  form.setValue('imageUrl', '');
                }}
                title="Foto de perfil del sector"
                description="Sube una foto para identificar este sector"
                disabled={loading}
                className="w-full"
              />
            </div>

            {error && (
              <div className="mb-2 p-2 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>
            )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear sector'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}